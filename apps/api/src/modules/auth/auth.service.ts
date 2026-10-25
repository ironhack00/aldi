/**
 * Reglas de autenticacion.
 *
 * Esquema de tokens elegido:
 *   - access token  (JWT, 15 min) -> viaja en la cabecera Authorization y lo
 *     guarda el frontend en memoria. Si se lo roban, caduca enseguida.
 *   - refresh token (opaco, 7 dias) -> viaja en una cookie httpOnly que el
 *     JavaScript de la pagina no puede leer, y esta persistido hasheado en la
 *     base para poder revocarlo.
 *
 * Esto evita el patron habitual de dejar un JWT de larga duracion en
 * localStorage, que cualquier XSS se lleva puesto.
 */
import { randomBytes, createHash } from 'node:crypto';
import type { Role, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../shared/password.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { env } from '../../config/env.js';

/** Datos del usuario que el frontend puede conocer. */
export interface UsuarioPublico {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const aUsuarioPublico = (u: User): UsuarioPublico => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Valida email + password.
 * Devuelve siempre el mismo error ante usuario inexistente, password errada o
 * usuario desactivado: no le decimos a un atacante que emails existen.
 */
export async function validarCredenciales(email: string, password: string): Promise<User> {
  const usuario = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!usuario || !usuario.isActive) throw new UnauthorizedError();

  const ok = await verifyPassword(password, usuario.passwordHash);
  if (!ok) throw new UnauthorizedError();

  return usuario;
}

/** Crea un refresh token nuevo y lo persiste hasheado. Devuelve el token en claro. */
export async function emitirRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Canjea un refresh token por el usuario dueno, rotandolo.
 * La rotacion (revocar el viejo, emitir uno nuevo) hace que un token robado
 * sirva una sola vez.
 */
export async function rotarRefreshToken(
  token: string,
): Promise<{ usuario: User; nuevoToken: string; expiresAt: Date }> {
  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  const vencido = !registro || registro.revokedAt !== null || registro.expiresAt < new Date();
  if (vencido || !registro.user.isActive) throw new UnauthorizedError('Sesion expirada');

  await prisma.refreshToken.update({
    where: { id: registro.id },
    data: { revokedAt: new Date() },
  });

  const { token: nuevoToken, expiresAt } = await emitirRefreshToken(registro.userId);
  return { usuario: registro.user, nuevoToken, expiresAt };
}

/** Revoca un refresh token puntual (logout de este dispositivo). */
export async function revocarRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
