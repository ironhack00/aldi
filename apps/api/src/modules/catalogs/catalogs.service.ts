/**
 * Reglas de los catalogos dinamicos.
 *
 * Invariantes que se defienden aca:
 *  - un catalogo de sistema no se borra (hay campos del formulario que
 *    dependen de el);
 *  - un item no se borra si algun desvio lo esta usando: se desactiva, para
 *    no romper el historico;
 *  - un item padre solo se admite en catalogos marcados como jerarquicos, y
 *    debe pertenecer al mismo catalogo.
 */
import { prisma } from '../../db/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js';
import type { CrearCatalogoInput, CrearItemInput } from './catalogs.schemas.js';

/** Catalogos con la cantidad de items, para el listado del panel. */
export async function listarCatalogos() {
  return prisma.catalog.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { items: true, fields: true } } },
  });
}

/**
 * Un catalogo con todos sus items.
 * `soloActivos` se usa al armar formularios; el panel de administracion
 * necesita ver tambien los desactivados.
 */
export async function obtenerCatalogo(key: string, soloActivos = false) {
  const catalogo = await prisma.catalog.findUnique({
    where: { key },
    include: {
      items: {
        where: soloActivos ? { isActive: true } : undefined,
        orderBy: [{ order: 'asc' }, { label: 'asc' }],
      },
    },
  });
  if (!catalogo) throw new NotFoundError(`Catalogo "${key}"`);
  return catalogo;
}

export async function crearCatalogo(input: CrearCatalogoInput) {
  const existe = await prisma.catalog.findUnique({ where: { key: input.key } });
  if (existe) throw new ConflictError(`Ya existe un catalogo con la clave "${input.key}"`);

  return prisma.catalog.create({ data: input });
}

export async function actualizarCatalogo(
  id: string,
  data: { name?: string; description?: string | null },
) {
  await asegurarCatalogo(id);
  return prisma.catalog.update({ where: { id }, data });
}

export async function eliminarCatalogo(id: string): Promise<void> {
  const catalogo = await asegurarCatalogo(id);
  if (catalogo.isSystem) {
    throw new ConflictError('Los catalogos de sistema no se pueden eliminar');
  }

  const camposQueDependen = await prisma.fieldDefinition.count({ where: { catalogId: id } });
  if (camposQueDependen > 0) {
    throw new ConflictError(
      `No se puede eliminar: ${camposQueDependen} campo/s del formulario usan este catalogo`,
    );
  }

  await prisma.catalog.delete({ where: { id } });
}

// --- Items -------------------------------------------------------------------

export async function crearItem(catalogId: string, input: CrearItemInput) {
  const catalogo = await asegurarCatalogo(catalogId);

  if (input.parentId) {
    if (!catalogo.hierarchical) {
      throw new BadRequestError(`El catalogo "${catalogo.name}" no admite items anidados`);
    }
    const padre = await prisma.catalogItem.findUnique({ where: { id: input.parentId } });
    if (!padre || padre.catalogId !== catalogId) {
      throw new BadRequestError('El item padre no pertenece a este catalogo');
    }
  }

  // Si no se indica orden, se agrega al final.
  const order = input.order ?? (await proximoOrden(catalogId, input.parentId ?? null));

  const duplicado = await prisma.catalogItem.findFirst({
    where: { catalogId, parentId: input.parentId ?? null, label: input.label },
  });
  if (duplicado) throw new ConflictError(`Ya existe "${input.label}" en este nivel del catalogo`);

  return prisma.catalogItem.create({
    data: {
      catalogId,
      label: input.label,
      code: input.code ?? null,
      parentId: input.parentId ?? null,
      flowPosition: input.flowPosition ?? null,
      order,
    },
  });
}

export async function actualizarItem(id: string, data: Record<string, unknown>) {
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Item de catalogo');
  return prisma.catalogItem.update({ where: { id }, data });
}

/**
 * Borra un item solo si nadie lo usa. Si esta referenciado por algun desvio
 * se desactiva en su lugar y se informa al cliente, que muestra el aviso.
 */
export async function eliminarItem(id: string): Promise<{ eliminado: boolean }> {
  const item = await prisma.catalogItem.findUnique({
    where: { id },
    include: { _count: { select: { values: true, children: true } } },
  });
  if (!item) throw new NotFoundError('Item de catalogo');

  if (item._count.values > 0) {
    await prisma.catalogItem.update({ where: { id }, data: { isActive: false } });
    return { eliminado: false };
  }

  await prisma.catalogItem.delete({ where: { id } });
  return { eliminado: true };
}

/** Reasigna el campo `order` segun la posicion en el array recibido. */
export async function reordenarItems(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, indice) =>
      prisma.catalogItem.update({ where: { id }, data: { order: indice } }),
    ),
  );
}

// --- Helpers privados --------------------------------------------------------

async function asegurarCatalogo(id: string) {
  const catalogo = await prisma.catalog.findUnique({ where: { id } });
  if (!catalogo) throw new NotFoundError('Catalogo');
  return catalogo;
}

async function proximoOrden(catalogId: string, parentId: string | null): Promise<number> {
  const ultimo = await prisma.catalogItem.findFirst({
    where: { catalogId, parentId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return (ultimo?.order ?? -1) + 1;
}
