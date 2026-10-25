/**
 * Hash de contrasenas.
 *
 * Se usa bcryptjs (implementacion en JS puro) en lugar de bcrypt nativo o
 * argon2 para que el deploy en Render no dependa de compilar binarios.
 */
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export const hashPassword = (plano: string): Promise<string> => bcrypt.hash(plano, ROUNDS);

export const verifyPassword = (plano: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plano, hash);
