/**
 * Plugin de autenticacion y autorizacion.
 *
 * Expone dos helpers en la instancia de Fastify:
 *   app.authenticate            -> valida el access token y llena request.auth
 *   app.authorize(...roles)     -> valida el token y ademas exige un rol
 *
 * Se usan como `preHandler` en cada ruta, de modo que la politica de acceso
 * queda escrita al lado del endpoint y no en un middleware lejano.
 */
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../shared/errors.js';

/** Contenido del access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    authorize: (...roles: Role[]) => preHandlerHookHandler;
  }
  interface FastifyRequest {
    /** Usuario autenticado, disponible despues de `authenticate`. */
    auth?: AccessTokenPayload;
  }
}

/** Verifica el Bearer token del request y deja el payload en request.auth. */
async function verificarToken(request: FastifyRequest): Promise<AccessTokenPayload> {
  try {
    const payload = await request.jwtVerify<AccessTokenPayload>();
    request.auth = payload;
    return payload;
  } catch {
    throw new UnauthorizedError('Token invalido o expirado');
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });

  app.decorate('authenticate', async (request) => {
    await verificarToken(request);
  });

  app.decorate('authorize', (...roles: Role[]): preHandlerHookHandler => {
    return async (request) => {
      const payload = await verificarToken(request);
      if (!roles.includes(payload.role)) throw new ForbiddenError();
    };
  });
}
