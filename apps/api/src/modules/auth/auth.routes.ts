/** Endpoints de autenticacion: /api/auth/* */
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { loginSchema } from './auth.schemas.js';
import {
  aUsuarioPublico,
  emitirRefreshToken,
  revocarRefreshToken,
  rotarRefreshToken,
  validarCredenciales,
} from './auth.service.js';
import type { AccessTokenPayload } from '../../plugins/auth.js';

const COOKIE_REFRESH = 'desvios_rt';

/**
 * Opciones de la cookie de refresh.
 * En produccion el frontend (Vercel) y la API (Render) estan en dominios
 * distintos, asi que la cookie tiene que ser SameSite=None + Secure para que
 * el navegador la envie. En local eso no funciona sobre http, de ahi el if.
 */
const cookieOptions = (maxAgeMs: number) =>
  ({
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? ('none' as const) : ('lax' as const),
    path: '/api/auth',
    maxAge: Math.floor(maxAgeMs / 1000),
  });

export const authRoutes: FastifyPluginAsync = async (app) => {
  /** Login. Limite estricto para frenar fuerza bruta. */
  app.post(
    '/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body);
      const usuario = await validarCredenciales(email, password);

      const payload: AccessTokenPayload = {
        sub: usuario.id,
        email: usuario.email,
        role: usuario.role,
      };
      const accessToken = app.jwt.sign(payload);
      const { token: refreshToken, expiresAt } = await emitirRefreshToken(usuario.id);

      reply.setCookie(
        COOKIE_REFRESH,
        refreshToken,
        cookieOptions(expiresAt.getTime() - Date.now()),
      );

      return { accessToken, user: aUsuarioPublico(usuario) };
    },
  );

  /** Renueva el access token usando la cookie de refresh. */
  app.post('/refresh', async (request, reply) => {
    const token = request.cookies[COOKIE_REFRESH];
    if (!token) throw new UnauthorizedError('No hay sesion activa');

    const { usuario, nuevoToken, expiresAt } = await rotarRefreshToken(token);

    const accessToken = app.jwt.sign({
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
    } satisfies AccessTokenPayload);

    reply.setCookie(COOKIE_REFRESH, nuevoToken, cookieOptions(expiresAt.getTime() - Date.now()));

    return { accessToken, user: aUsuarioPublico(usuario) };
  });

  /** Logout: revoca el refresh token y borra la cookie. */
  app.post('/logout', async (request, reply) => {
    const token = request.cookies[COOKIE_REFRESH];
    if (token) await revocarRefreshToken(token);
    reply.clearCookie(COOKIE_REFRESH, { path: '/api/auth' });
    return { ok: true };
  });

  /** Usuario de la sesion actual. */
  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    const usuario = await prisma.user.findUnique({ where: { id: request.auth!.sub } });
    if (!usuario || !usuario.isActive) throw new UnauthorizedError();
    return { user: aUsuarioPublico(usuario) };
  });
};
