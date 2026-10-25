/** Contratos de entrada del modulo de campos dinamicos. */
import { z } from 'zod';
import { FieldRole, FieldType } from '@prisma/client';

export const crearCampoSchema = z
  .object({
    key: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Debe empezar en minuscula y no llevar espacios'),
    label: z.string().min(1).max(80),
    type: z.nativeEnum(FieldType),
    role: z.nativeEnum(FieldRole).default(FieldRole.NONE),
    catalogId: z.string().cuid().nullable().optional(),
    parentFieldId: z.string().cuid().nullable().optional(),
    helpText: z.string().max(200).nullable().optional(),
    required: z.boolean().default(false),
    showInTable: z.boolean().default(true),
    order: z.number().int().min(0).optional(),
  })
  // Un selector sin catalogo no tiene de donde sacar opciones.
  .refine(
    (d) => !['SELECT', 'MULTISELECT'].includes(d.type) || Boolean(d.catalogId),
    { message: 'Los campos de tipo lista requieren un catalogo', path: ['catalogId'] },
  );

export const actualizarCampoSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  role: z.nativeEnum(FieldRole).optional(),
  catalogId: z.string().cuid().nullable().optional(),
  parentFieldId: z.string().cuid().nullable().optional(),
  helpText: z.string().max(200).nullable().optional(),
  required: z.boolean().optional(),
  showInTable: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const reordenarCamposSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
});

export type CrearCampoInput = z.infer<typeof crearCampoSchema>;
