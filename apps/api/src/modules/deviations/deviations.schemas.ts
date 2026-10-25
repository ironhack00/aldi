/**
 * Contratos de entrada del modulo de desvios.
 *
 * Ojo: los campos dinamicos NO se pueden validar con un schema estatico,
 * porque cambian en runtime. Aca se valida solo la "carcasa" (fechas y el
 * sobre `values`); la validacion de cada valor contra su FieldDefinition la
 * hace `validarValores` en el servicio.
 */
import { z } from 'zod';

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: AAAA-MM-DD');

/** Un valor puede ser texto, numero, booleano, o una lista de ids (multiselect). */
const valorSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const crearDesvioSchema = z
  .object({
    occurredOn: fechaISO,
    raisedOn: fechaISO,
    /** Mapa { keyDelCampo: valor }. */
    values: z.record(valorSchema).default({}),
  })
  .refine((d) => d.raisedOn >= d.occurredOn, {
    message: 'La fecha de levantamiento no puede ser anterior a la de ocurrencia',
    path: ['raisedOn'],
  });

export const actualizarDesvioSchema = z.object({
  occurredOn: fechaISO.optional(),
  raisedOn: fechaISO.optional(),
  values: z.record(valorSchema).optional(),
});

export const listarDesviosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  /** Busqueda libre sobre codigo y valores de texto. */
  search: z.string().trim().max(120).optional(),
  desde: fechaISO.optional(),
  hasta: fechaISO.optional(),
  /** Filtro por item de catalogo (ej. todos los desvios de una especie). */
  itemId: z.string().cuid().optional(),
});

export type CrearDesvioInput = z.infer<typeof crearDesvioSchema>;
export type ListarDesviosQuery = z.infer<typeof listarDesviosSchema>;
