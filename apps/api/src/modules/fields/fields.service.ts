/**
 * Reglas de los campos dinamicos.
 *
 * El "esquema de formulario" que consume el frontend se arma aca: cada campo
 * viaja con sus opciones ya resueltas (y agrupadas por padre, cuando hay
 * cascada), de modo que la UI no tenga que conocer la estructura de los
 * catalogos ni hacer una llamada por campo.
 */
import { FieldType, type FieldRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js';
import type { CrearCampoInput } from './fields.schemas.js';

/** Una opcion de un selector, tal como la consume el frontend. */
export interface OpcionCampo {
  id: string;
  label: string;
  /** Item padre dentro del catalogo; permite filtrar en cascada. */
  parentId: string | null;
  flowPosition: number | null;
}

/** Un campo del formulario con todo lo necesario para renderizarlo. */
export interface CampoFormulario {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  role: FieldRole;
  required: boolean;
  showInTable: boolean;
  order: number;
  helpText: string | null;
  /** Campo del que depende en cascada (su `key`), si hay. */
  dependsOn: string | null;
  /** Catalogo del que salen las opciones (null si el campo no es una lista). */
  catalogId: string | null;
  /** Si ese catalogo admite sub-items: habilita usar el campo como padre. */
  catalogHierarchical: boolean;
  options: OpcionCampo[];
}

/**
 * Esquema completo del formulario de desvio.
 * `incluirInactivos` lo usa el panel de administracion.
 */
export async function obtenerEsquemaFormulario(incluirInactivos = false): Promise<CampoFormulario[]> {
  const campos = await prisma.fieldDefinition.findMany({
    where: incluirInactivos ? undefined : { isActive: true },
    orderBy: [{ order: 'asc' }, { label: 'asc' }],
    include: {
      parentField: { select: { key: true } },
      catalog: {
        include: {
          items: {
            where: { isActive: true },
            orderBy: [{ order: 'asc' }, { label: 'asc' }],
          },
        },
      },
    },
  });

  return campos.map((campo) => ({
    id: campo.id,
    key: campo.key,
    label: campo.label,
    type: campo.type,
    role: campo.role,
    required: campo.required,
    showInTable: campo.showInTable,
    order: campo.order,
    helpText: campo.helpText,
    dependsOn: campo.parentField?.key ?? null,
    catalogId: campo.catalogId,
    catalogHierarchical: campo.catalog?.hierarchical ?? false,
    options:
      campo.catalog?.items.map((item) => ({
        id: item.id,
        label: item.label,
        parentId: item.parentId,
        flowPosition: item.flowPosition,
      })) ?? [],
  }));
}

export async function crearCampo(input: CrearCampoInput) {
  const existe = await prisma.fieldDefinition.findUnique({ where: { key: input.key } });
  if (existe) throw new ConflictError(`Ya existe un campo con la clave "${input.key}"`);

  if (input.catalogId) await asegurarCatalogo(input.catalogId);
  if (input.parentFieldId) await validarCascada(input.parentFieldId, input.catalogId ?? null);

  const order = input.order ?? (await proximoOrden());

  return prisma.fieldDefinition.create({
    data: {
      key: input.key,
      label: input.label,
      type: input.type,
      role: input.role,
      catalogId: input.catalogId ?? null,
      parentFieldId: input.parentFieldId ?? null,
      helpText: input.helpText ?? null,
      required: input.required,
      showInTable: input.showInTable,
      order,
    },
  });
}

export async function actualizarCampo(id: string, data: Record<string, unknown>) {
  const campo = await prisma.fieldDefinition.findUnique({ where: { id } });
  if (!campo) throw new NotFoundError('Campo');

  // El tipo no se puede cambiar: los valores ya guardados estan en la columna
  // que corresponde al tipo original y no se pueden reinterpretar.
  if ('type' in data) throw new BadRequestError('El tipo de un campo no se puede modificar');

  if (typeof data.catalogId === 'string') await asegurarCatalogo(data.catalogId);
  if (typeof data.parentFieldId === 'string') {
    if (data.parentFieldId === id) throw new BadRequestError('Un campo no puede depender de si mismo');
    await validarCascada(data.parentFieldId, campo.catalogId);
  }

  return prisma.fieldDefinition.update({ where: { id }, data });
}

/**
 * Borra un campo. Si ya tiene valores cargados se desactiva, para que los
 * desvios historicos no pierdan informacion.
 */
export async function eliminarCampo(id: string): Promise<{ eliminado: boolean }> {
  const campo = await prisma.fieldDefinition.findUnique({
    where: { id },
    include: { _count: { select: { values: true, childFields: true } } },
  });
  if (!campo) throw new NotFoundError('Campo');

  if (campo.isSystem) {
    throw new ConflictError('Los campos de sistema no se pueden eliminar, solo desactivar');
  }
  if (campo._count.childFields > 0) {
    throw new ConflictError('Hay campos que dependen de este en cascada');
  }

  if (campo._count.values > 0) {
    await prisma.fieldDefinition.update({ where: { id }, data: { isActive: false } });
    return { eliminado: false };
  }

  await prisma.fieldDefinition.delete({ where: { id } });
  return { eliminado: true };
}

export async function reordenarCampos(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, indice) =>
      prisma.fieldDefinition.update({ where: { id }, data: { order: indice } }),
    ),
  );
}

// --- Helpers privados --------------------------------------------------------

async function asegurarCatalogo(catalogId: string) {
  const catalogo = await prisma.catalog.findUnique({ where: { id: catalogId } });
  if (!catalogo) throw new NotFoundError('Catalogo');
  return catalogo;
}

/**
 * Una cascada solo tiene sentido si padre e hijo leen el mismo catalogo
 * jerarquico: el hijo muestra los hijos del item elegido en el padre.
 */
async function validarCascada(parentFieldId: string, catalogIdHijo: string | null): Promise<void> {
  const padre = await prisma.fieldDefinition.findUnique({
    where: { id: parentFieldId },
    include: { catalog: true },
  });
  if (!padre) throw new NotFoundError('Campo padre');

  if (!padre.catalog?.hierarchical) {
    throw new BadRequestError('El campo padre debe apuntar a un catalogo jerarquico');
  }
  if (catalogIdHijo && catalogIdHijo !== padre.catalogId) {
    throw new BadRequestError('En una cascada ambos campos deben usar el mismo catalogo');
  }
}

async function proximoOrden(): Promise<number> {
  const ultimo = await prisma.fieldDefinition.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return (ultimo?.order ?? -1) + 1;
}
