/**
 * Motor de analisis Codex (PENDIENTE DE CONECTAR).
 *
 * Codex es el motor de la empresa; todavia no tenemos endpoint ni credenciales.
 * El adaptador queda escrito y enchufado para que el dia que lleguen los datos
 * el cambio sea: completar CODEX_API_URL / CODEX_API_KEY en el .env, poner
 * AI_PROVIDER=codex, y revisar los dos TODO de abajo (la forma del request y
 * de la respuesta, que dependen de la API real).
 *
 * Mientras no haya configuracion, `analizar` delega en el motor local en lugar
 * de fallar: la pantalla sigue siendo usable.
 */
import { env } from '../../config/env.js';
import { localProvider } from './local.provider.js';
import type { AIProvider, ContextoAnalisis, RespuestaAnalisis } from './analysis.types.js';

/** Instruccion de sistema: acota el alcance y prohibe inventar numeros. */
const INSTRUCCION = `
Sos un analista de calidad de un insectario. Respondes preguntas sobre desvios
operativos usando UNICAMENTE los datos del contexto que se te entrega.
Reglas:
- No inventes cifras: si el dato no esta en el contexto, deci que no lo tenes.
- Responde en espanol rioplatense, en dos o tres oraciones como maximo.
- Cuando afirmes algo cuantitativo, cita el numero en el que te basas.
`.trim();

const TIMEOUT_MS = 20_000;

export const codexProvider: AIProvider = {
  name: 'codex',

  async analizar(pregunta, contexto): Promise<RespuestaAnalisis> {
    // Sin credenciales no hay nada que intentar: se usa el motor local.
    if (!env.CODEX_API_URL || !env.CODEX_API_KEY) {
      const fallback = await localProvider.analizar(pregunta, contexto);
      return {
        ...fallback,
        answer: `[Codex no configurado, respuesta del motor local] ${fallback.answer}`,
      };
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    try {
      // TODO(codex): ajustar el cuerpo del request al contrato real de Codex.
      const respuesta = await fetch(env.CODEX_API_URL, {
        method: 'POST',
        signal: controlador.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.CODEX_API_KEY}`,
        },
        body: JSON.stringify({
          instructions: INSTRUCCION,
          question: pregunta,
          context: contexto,
        }),
      });

      if (!respuesta.ok) {
        throw new Error(`Codex respondio ${respuesta.status}`);
      }

      // TODO(codex): mapear la forma real de la respuesta.
      const datos = (await respuesta.json()) as { answer?: string; output?: string };
      const texto = datos.answer ?? datos.output;
      if (!texto) throw new Error('Codex no devolvio texto');

      return { provider: 'codex', answer: texto };
    } catch (error) {
      // Degradacion elegante: si Codex falla, contesta el motor local y se
      // avisa en la respuesta. Nunca se le muestra un error crudo al usuario.
      const fallback = await localProvider.analizar(pregunta, contexto);
      return {
        ...fallback,
        answer: `[Codex no disponible: ${(error as Error).message}] ${fallback.answer}`,
      };
    } finally {
      clearTimeout(temporizador);
    }
  },
};
