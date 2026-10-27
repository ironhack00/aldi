/**
 * Orquestacion del modulo de analisis: elige el motor, arma el contexto y
 * delega. El contexto se construye una sola vez aca, de modo que todos los
 * motores vean exactamente los mismos datos.
 */
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { formatFechaISO, diferenciaEnDias } from '../../shared/dates.js';
import { calcularResumen } from '../metrics/metrics.service.js';
import { localProvider } from './local.provider.js';
import { codexProvider } from './codex.provider.js';
import { openaiProvider } from './openai.provider.js';
import type { AIProvider, ContextoAnalisis, RespuestaAnalisis } from './analysis.types.js';

/** Cuantos desvios se le pasan al motor como muestra (configurable por .env). */
const TAMANO_MUESTRA = env.AI_SAMPLE_SIZE;

const motores: Record<string, AIProvider> = {
  local: localProvider,
  codex: codexProvider,
  openai: openaiProvider,
};

/** Motor activo segun configuracion. */
export const motorActivo = (): AIProvider => motores[env.AI_PROVIDER] ?? localProvider;

async function armarContexto(): Promise<ContextoAnalisis> {
  const [resumen, desvios] = await Promise.all([
    calcularResumen(),
    prisma.deviation.findMany({
      take: TAMANO_MUESTRA,
      orderBy: { raisedOn: 'desc' },
      include: {
        values: {
          include: {
            field: { select: { label: true } },
            catalogItem: { select: { label: true } },
          },
        },
      },
    }),
  ]);

  return {
    resumen,
    muestra: desvios.map((d) => {
      // Se envian etiquetas legibles, no ids: al motor no le sirven los cuids.
      const atributos: Record<string, string> = {};
      for (const valor of d.values) {
        const texto =
          valor.catalogItem?.label ??
          valor.valueText ??
          (valor.valueNumber !== null ? String(valor.valueNumber) : null) ??
          (valor.valueDate !== null ? formatFechaISO(valor.valueDate) : null) ??
          (valor.valueBool !== null ? (valor.valueBool ? 'Si' : 'No') : null);
        if (texto) atributos[valor.field.label] = texto;
      }

      return {
        code: d.code,
        occurredOn: formatFechaISO(d.occurredOn),
        raisedOn: formatFechaISO(d.raisedOn),
        diasHastaDeteccion: diferenciaEnDias(d.occurredOn, d.raisedOn),
        atributos,
      };
    }),
  };
}

export async function preguntar(pregunta: string): Promise<RespuestaAnalisis> {
  const contexto = await armarContexto();
  return motorActivo().analizar(pregunta, contexto);
}
