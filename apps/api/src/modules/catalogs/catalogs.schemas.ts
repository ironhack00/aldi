/** Contratos de entrada del modulo de catalogos. */
import { z } from 'zod';

/** Slug: minusculas, numeros y guiones. Es el identificador estable del catalogo. */
const keySchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones');

export const crearCatalogoSchema = z.object({
  key: keySchema,
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  hierarchical: z.boolean().default(false),
});

export const actualizarCatalogoSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
});

export const crearItemSchema = z.object({
  label: z.string().min(1).max(120),
  code: z.string().max(40).nullable().optional(),
  /** Solo para catalogos jerarquicos. */
  parentId: z.string().cuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
  /** Posicion en el flujo productivo; null = fuera del flujo secuencial. */
  flowPosition: z.number().int().min(0).nullable().optional(),
});

export const actualizarItemSchema = crearItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/** Reordenamiento por lote: el panel manda la lista completa ya ordenada. */
export const reordenarItemsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
});

export type CrearCatalogoInput = z.infer<typeof crearCatalogoSchema>;
export type CrearItemInput = z.infer<typeof crearItemSchema>;
