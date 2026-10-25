/**
 * Calculo de indicadores del tablero.
 *
 * Todo se calcula en el servidor: el frontend recibe numeros listos para
 * mostrar. Asi los mismos valores alimentan el tablero y el modulo de
 * analisis, sin riesgo de que digan cosas distintas.
 */
import { FieldRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { DIAS_SEMANA, diferenciaEnDias, nombreDiaSemana } from '../../shared/dates.js';

export interface ResumenMetricas {
  totalDesvios: number;
  /** Promedio de dias entre ocurrencia y levantamiento. null si no hay datos. */
  promedioDeteccion: number | null;
  /** Detectados en una etapa posterior a la responsable. */
  detectadosTarde: number;
  /** Levantados el mismo dia en que ocurrieron. */
  detectadosMismoDia: number;
  /** Cantidad por dia de la semana (los siete, para no esconder fines de semana). */
  porDiaSemana: { dia: string; cantidad: number }[];
  /** Top de items por campo con rol semantico (causas, problemas, impactos...). */
  topPorCampo: { campo: string; label: string; items: { label: string; cantidad: number }[] }[];
}

export async function calcularResumen(): Promise<ResumenMetricas> {
  const desvios = await prisma.deviation.findMany({
    select: {
      occurredOn: true,
      raisedOn: true,
      values: {
        select: {
          field: { select: { key: true, label: true, role: true } },
          catalogItem: { select: { label: true, flowPosition: true } },
        },
      },
    },
  });

  const total = desvios.length;

  // --- Tiempos ---------------------------------------------------------------
  let sumaDias = 0;
  let mismoDia = 0;
  let tarde = 0;

  // --- Distribucion semanal: se inicializan los 7 dias en cero -------------
  const porDia = new Map<string, number>(DIAS_SEMANA.map((d) => [d, 0]));

  // --- Conteo por campo ------------------------------------------------------
  const conteos = new Map<string, { label: string; items: Map<string, number> }>();

  for (const desvio of desvios) {
    const dias = diferenciaEnDias(desvio.occurredOn, desvio.raisedOn);
    sumaDias += dias;
    if (dias === 0) mismoDia += 1;

    const dia = nombreDiaSemana(desvio.raisedOn);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);

    let origen: number | null = null;
    let deteccion: number | null = null;

    for (const valor of desvio.values) {
      if (!valor.catalogItem) continue;

      if (valor.field.role === FieldRole.ACTIVITY_ORIGIN) origen = valor.catalogItem.flowPosition;
      if (valor.field.role === FieldRole.ACTIVITY_DETECTION)
        deteccion = valor.catalogItem.flowPosition;

      const entrada =
        conteos.get(valor.field.key) ??
        { label: valor.field.label, items: new Map<string, number>() };
      entrada.items.set(
        valor.catalogItem.label,
        (entrada.items.get(valor.catalogItem.label) ?? 0) + 1,
      );
      conteos.set(valor.field.key, entrada);
    }

    // "Tarde" = se detecto en una etapa posterior del flujo a la responsable.
    if (origen !== null && deteccion !== null && deteccion > origen) tarde += 1;
  }

  return {
    totalDesvios: total,
    promedioDeteccion: total > 0 ? Number((sumaDias / total).toFixed(1)) : null,
    detectadosTarde: tarde,
    detectadosMismoDia: mismoDia,
    porDiaSemana: [...porDia.entries()].map(([dia, cantidad]) => ({ dia, cantidad })),
    topPorCampo: [...conteos.entries()].map(([campo, { label, items }]) => ({
      campo,
      label,
      items: [...items.entries()]
        .map(([l, cantidad]) => ({ label: l, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5),
    })),
  };
}

/**
 * Los desvios con mayor demora, para la tarjeta "oportunidades de deteccion".
 * Se ordena por dias de demora, que es lo que el negocio quiere atacar.
 */
export async function oportunidadesDeDeteccion(limite = 5) {
  const desvios = await prisma.deviation.findMany({
    take: 50,
    orderBy: { raisedOn: 'desc' },
    include: {
      values: {
        include: {
          field: { select: { key: true, label: true, role: true } },
          catalogItem: { select: { label: true } },
        },
      },
    },
  });

  return desvios
    .map((d) => ({
      id: d.id,
      code: d.code,
      dias: diferenciaEnDias(d.occurredOn, d.raisedOn),
      // Se arma un resumen corto con los campos marcados como relevantes.
      detalle: d.values
        .filter((v) => v.field.role !== FieldRole.NONE && v.catalogItem)
        .map((v) => v.catalogItem!.label)
        .join(' · '),
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, limite);
}
