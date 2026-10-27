/**
 * Motor de analisis OpenAI (ChatGPT).
 *
 * Es un modelo de lenguaje de verdad: entiende cualquier pregunta sobre los
 * datos y cruza campos como quiera. Lo que NO puede hacer es ver mas de lo que
 * la API le manda en el contexto: el resumen de metricas y una muestra de
 * desvios recientes (ver TAMANO_MUESTRA en analysis.service.ts). Si un dato no
 * esta en ese contexto, la instruccion le exige decir que no lo tiene.
 *
 * Configuracion (.env):
 *   AI_PROVIDER=openai
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_MODEL=gpt-4o-mini   (opcional)
 *
 * Si falta la clave o la llamada falla, contesta el motor local con un aviso
 * adelante: la pantalla nunca queda sin respuesta.
 */
import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { localProvider } from './local.provider.js';
import type { AIProvider, ContextoAnalisis, RespuestaAnalisis } from './analysis.types.js';

/** Instruccion de sistema: acota el alcance y prohibe inventar numeros. */
const INSTRUCCION = `
Sos un analista de calidad de un insectario. Respondes preguntas sobre desvios
operativos usando UNICAMENTE los datos del contexto JSON que recibis.

El contexto tiene dos partes:
- "resumen": metricas calculadas sobre TODOS los desvios de la base (total,
  promedio de dias hasta la deteccion, detectados tarde, por dia de la semana,
  valores mas repetidos por campo). Para preguntas sobre totales usa esto.
- "muestra": los desvios mas recientes, uno por uno, con sus atributos. Sirve
  para cruzar campos, filtrar por fecha o mirar casos puntuales. Si la pregunta
  pide algo que puede exceder la muestra, aclaralo.

Reglas:
- No inventes cifras. Si el dato no esta en el contexto, deci que no lo tenes.
- Responde en espanol rioplatense, claro y breve: dos a cuatro oraciones.
- Cuando afirmes algo cuantitativo, cita el numero en el que te basas.
- En "evidence" devolve las cifras concretas que sostienen la respuesta
  (entre 1 y 6 items). Si la respuesta no tiene cifras, devolve una lista vacia.
`.trim();

const TIMEOUT_MS = 30_000;

/** Forma exacta de la respuesta: el frontend muestra answer + evidence. */
const ESQUEMA_RESPUESTA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['label', 'value'],
        additionalProperties: false,
      },
    },
  },
  required: ['answer', 'evidence'],
  additionalProperties: false,
} as const;

let cliente: OpenAI | null = null;
const obtenerCliente = (): OpenAI => {
  cliente ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: TIMEOUT_MS });
  return cliente;
};

async function responderConLocal(
  motivo: string,
  pregunta: string,
  contexto: ContextoAnalisis,
): Promise<RespuestaAnalisis> {
  const fallback = await localProvider.analizar(pregunta, contexto);
  return { ...fallback, answer: `[${motivo}] ${fallback.answer}` };
}

export const openaiProvider: AIProvider = {
  name: 'openai',

  async analizar(pregunta, contexto): Promise<RespuestaAnalisis> {
    if (!env.OPENAI_API_KEY) {
      return responderConLocal(
        'OpenAI no configurado (falta OPENAI_API_KEY), respuesta del motor local',
        pregunta,
        contexto,
      );
    }

    try {
      const respuesta = await obtenerCliente().responses.create({
        model: env.OPENAI_MODEL,
        instructions: INSTRUCCION,
        input: [
          {
            role: 'user',
            content:
              `Contexto:\n${JSON.stringify(contexto)}\n\n` + `Pregunta: ${pregunta}`,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'respuesta_analisis',
            strict: true,
            schema: ESQUEMA_RESPUESTA,
          },
        },
      });

      const texto = respuesta.output_text;
      if (!texto) throw new Error('OpenAI no devolvio texto');

      const datos = JSON.parse(texto) as { answer: string; evidence: { label: string; value: string }[] };
      if (!datos.answer) throw new Error('OpenAI devolvio una respuesta vacia');

      return {
        provider: 'openai',
        answer: datos.answer,
        evidence: datos.evidence.length > 0 ? datos.evidence : undefined,
      };
    } catch (error) {
      // Degradacion elegante: nunca se le muestra un error crudo al usuario.
      const detalle = error instanceof Error ? error.message : String(error);
      return responderConLocal(`OpenAI no disponible: ${detalle}`, pregunta, contexto);
    }
  },
};
