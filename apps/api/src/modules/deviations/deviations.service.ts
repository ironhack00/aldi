/**
 * Reglas de los desvios.
 *
 * Responsabilidades:
 *   - generar el codigo DEV-#### sin colisiones;
 *   - validar los valores dinamicos contra las definiciones vigentes;
 *   - devolver los desvios ya "aplanados", en una forma que la tabla del
 *     frontend pueda renderizar sin recorrer relaciones.
 */
import { FieldRole, type Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../shared/errors.js';
import { diferenciaEnDias, formatFechaISO, parseFechaISO } from '../../shared/dates.js';
import { validarValores, type CampoValidable } from './deviations.validation.js';
import type { CrearDesvioInput, ListarDesviosQuery } from './deviations.schemas.js';

const CONTADOR_DESVIOS = 'deviation_code';

/** Un desvio tal como lo consume el frontend. */
export interface DesvioAplanado {
  id: string;
  code: string;
  occurredOn: string;
  raisedOn: string;
  /** Dias entre ocurrencia y levantamiento: el KPI principal. */
  diasHastaDeteccion: number;
  /**
   * Etapas de distancia entre la actividad responsable y la de deteccion.
   * null = alguna de las dos esta fuera del flujo secuencial.
   */
  distanciaEtapas: number | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  /** { keyDelCampo: { valor crudo, etiqueta para mostrar } } */
  values: Record<string, { raw: string | number | boolean | string[] | null; label: string }>;
}

// -----------------------------------------------------------------------------
//  Lectura
// -----------------------------------------------------------------------------

const incluirRelaciones = {
  createdBy: { select: { id: true, name: true } },
  values: {
    include: {
      field: { select: { key: true, type: true, role: true } },
      catalogItem: { select: { id: true, label: true, flowPosition: true } },
    },
  },
} satisfies Prisma.DeviationInclude;

type DesvioConRelaciones = Prisma.DeviationGetPayload<{ include: typeof incluirRelaciones }>;

export async function listarDesvios(query: ListarDesviosQuery) {
  const where = armarFiltro(query);

  const [total, registros] = await Promise.all([
    prisma.deviation.count({ where }),
    prisma.deviation.findMany({
      where,
      include: incluirRelaciones,
      orderBy: [{ raisedOn: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    items: registros.map(aplanar),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function obtenerDesvio(id: string): Promise<DesvioAplanado> {
  const desvio = await prisma.deviation.findUnique({ where: { id }, include: incluirRelaciones });
  if (!desvio) throw new NotFoundError('Desvio');
  return aplanar(desvio);
}

// -----------------------------------------------------------------------------
//  Escritura
// -----------------------------------------------------------------------------

export async function crearDesvio(input: CrearDesvioInput, userId: string): Promise<DesvioAplanado> {
  const campos = await cargarCamposValidables();
  const filas = validarValores(input.values, campos);

  // Codigo y desvio en la misma transaccion: o salen los dos, o ninguno.
  const creado = await prisma.$transaction(async (tx) => {
    const code = await generarCodigo(tx);
    return tx.deviation.create({
      data: {
        code,
        occurredOn: parseFechaISO(input.occurredOn),
        raisedOn: parseFechaISO(input.raisedOn),
        createdById: userId,
        values: { createMany: { data: filas } },
      },
      include: incluirRelaciones,
    });
  });

  return aplanar(creado);
}

/**
 * Actualiza un desvio. Si llegan `values`, se reemplaza el conjunto completo
 * de valores: es mas simple de razonar que un merge parcial y coincide con lo
 * que manda el formulario (que siempre envia todos los campos).
 */
export async function actualizarDesvio(
  id: string,
  input: { occurredOn?: string; raisedOn?: string; values?: Record<string, unknown> },
): Promise<DesvioAplanado> {
  const actual = await prisma.deviation.findUnique({ where: { id } });
  if (!actual) throw new NotFoundError('Desvio');

  const filas = input.values
    ? validarValores(input.values, await cargarCamposValidables())
    : null;

  const actualizado = await prisma.$transaction(async (tx) => {
    if (filas) {
      await tx.deviationValue.deleteMany({ where: { deviationId: id } });
      if (filas.length > 0) {
        await tx.deviationValue.createMany({
          data: filas.map((f) => ({ ...f, deviationId: id })),
        });
      }
    }

    return tx.deviation.update({
      where: { id },
      data: {
        occurredOn: input.occurredOn ? parseFechaISO(input.occurredOn) : undefined,
        raisedOn: input.raisedOn ? parseFechaISO(input.raisedOn) : undefined,
      },
      include: incluirRelaciones,
    });
  });

  return aplanar(actualizado);
}

export async function eliminarDesvio(id: string): Promise<void> {
  const existe = await prisma.deviation.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw new NotFoundError('Desvio');
  await prisma.deviation.delete({ where: { id } });
}

// -----------------------------------------------------------------------------
//  Internos
// -----------------------------------------------------------------------------

/**
 * Genera el proximo codigo con un UPDATE atomico sobre la tabla de
 * contadores. Dos requests simultaneos quedan serializados por el motor, asi
 * que nunca obtienen el mismo numero (el prototipo original lo calculaba en
 * el cliente con la longitud del array, lo que colisionaba siempre).
 */
async function generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
  const contador = await tx.counter.upsert({
    where: { key: CONTADOR_DESVIOS },
    create: { key: CONTADOR_DESVIOS, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `DEV-${String(contador.value).padStart(4, '0')}`;
}

/** Carga las definiciones activas con sus opciones validas. */
async function cargarCamposValidables(): Promise<CampoValidable[]> {
  const campos = await prisma.fieldDefinition.findMany({
    where: { isActive: true },
    include: {
      catalog: { include: { items: { where: { isActive: true }, select: { id: true } } } },
    },
  });

  return campos.map((c) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    type: c.type,
    required: c.required,
    catalogId: c.catalogId,
    opcionesValidas: new Set(c.catalog?.items.map((i) => i.id) ?? []),
  }));
}

/** Traduce los filtros de la query a un `where` de Prisma. */
function armarFiltro(query: ListarDesviosQuery): Prisma.DeviationWhereInput {
  const condiciones: Prisma.DeviationWhereInput[] = [];

  if (query.desde) condiciones.push({ raisedOn: { gte: parseFechaISO(query.desde) } });
  if (query.hasta) condiciones.push({ raisedOn: { lte: parseFechaISO(query.hasta) } });
  if (query.itemId) condiciones.push({ values: { some: { catalogItemId: query.itemId } } });

  if (query.search) {
    // `mode: 'insensitive'` es especifico de Postgres; es la razon por la que
    // el proyecto apunta a Postgres y no a SQLite.
    const texto = query.search;
    condiciones.push({
      OR: [
        { code: { contains: texto, mode: 'insensitive' } },
        { values: { some: { valueText: { contains: texto, mode: 'insensitive' } } } },
        { values: { some: { catalogItem: { label: { contains: texto, mode: 'insensitive' } } } } },
      ],
    });
  }

  return condiciones.length > 0 ? { AND: condiciones } : {};
}

/**
 * Convierte el grafo de relaciones en el objeto plano que espera la UI y
 * calcula los dos indicadores derivados.
 */
function aplanar(desvio: DesvioConRelaciones): DesvioAplanado {
  const values: DesvioAplanado['values'] = {};
  let posicionOrigen: number | null = null;
  let posicionDeteccion: number | null = null;

  for (const valor of desvio.values) {
    const { key, role } = valor.field;

    if (valor.catalogItemId && valor.catalogItem) {
      // Multiselect: varias filas con la misma key, se acumulan en un array.
      const previo = values[key];
      if (previo && Array.isArray(previo.raw)) {
        previo.raw.push(valor.catalogItemId);
        previo.label = `${previo.label}, ${valor.catalogItem.label}`;
      } else if (previo) {
        values[key] = {
          raw: [String(previo.raw), valor.catalogItemId],
          label: `${previo.label}, ${valor.catalogItem.label}`,
        };
      } else {
        values[key] = { raw: valor.catalogItemId, label: valor.catalogItem.label };
      }

      if (role === FieldRole.ACTIVITY_ORIGIN) posicionOrigen = valor.catalogItem.flowPosition;
      if (role === FieldRole.ACTIVITY_DETECTION) posicionDeteccion = valor.catalogItem.flowPosition;
      continue;
    }

    if (valor.valueText !== null) values[key] = { raw: valor.valueText, label: valor.valueText };
    else if (valor.valueNumber !== null)
      values[key] = { raw: valor.valueNumber, label: String(valor.valueNumber) };
    else if (valor.valueDate !== null)
      values[key] = { raw: formatFechaISO(valor.valueDate), label: formatFechaISO(valor.valueDate) };
    else if (valor.valueBool !== null)
      values[key] = { raw: valor.valueBool, label: valor.valueBool ? 'Si' : 'No' };
  }

  return {
    id: desvio.id,
    code: desvio.code,
    occurredOn: formatFechaISO(desvio.occurredOn),
    raisedOn: formatFechaISO(desvio.raisedOn),
    diasHastaDeteccion: diferenciaEnDias(desvio.occurredOn, desvio.raisedOn),
    distanciaEtapas:
      posicionOrigen !== null && posicionDeteccion !== null
        ? posicionDeteccion - posicionOrigen
        : null,
    createdBy: desvio.createdBy,
    createdAt: desvio.createdAt.toISOString(),
    values,
  };
}
