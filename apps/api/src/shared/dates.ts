/**
 * Utilidades de fecha.
 *
 * Todo el dominio trabaja con fechas SIN hora (el dia en que ocurrio el
 * desvio). Para evitar que la zona horaria del servidor corra un dia hacia
 * atras o adelante, las fechas se construyen y serializan siempre en UTC a
 * medianoche.
 */

const MS_POR_DIA = 86_400_000;

/** "2026-10-19" -> Date en UTC a las 00:00. */
export function parseFechaISO(valor: string): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

/** Date -> "2026-10-19" */
export function formatFechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Dias enteros entre dos fechas (b - a). Negativo si b es anterior. */
export function diferenciaEnDias(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_POR_DIA);
}

export const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
] as const;

/** Nombre del dia de la semana de una fecha, leido en UTC. */
export function nombreDiaSemana(fecha: Date): string {
  return DIAS_SEMANA[fecha.getUTCDay()]!;
}
