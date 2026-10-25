/** Contratos de entrada del modulo de autenticacion. */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

export type LoginInput = z.infer<typeof loginSchema>;
