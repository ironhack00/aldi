/**
 * Construccion de la aplicacion Fastify.
 *
 * Se separa de `server.ts` a proposito: `buildApp()` devuelve una instancia
 * sin escuchar en ningun puerto, lo que permite usarla en tests de
 * integracion con `app.inject()` sin levantar red.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { registerSecurity } from './plugins/security.js';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { catalogsRoutes } from './modules/catalogs/catalogs.routes.js';
import { fieldsRoutes } from './modules/fields/fields.routes.js';
import { deviationsRoutes } from './modules/deviations/deviations.routes.js';
import { metricsRoutes } from './modules/metrics/metrics.routes.js';
import { analysisRoutes } from './modules/analysis/analysis.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.isProduction
      ? { level: 'info' }
      : { level: 'info', transport: { target: 'pino-pretty' } },
    // Render y Vercel ponen la IP real del cliente en X-Forwarded-For; sin
    // esto el rate limit contaria todo el trafico como un solo cliente.
    trustProxy: true,
  });

  registerErrorHandler(app);
  await registerSecurity(app);
  await registerAuth(app);

  /**
   * Health check. Render lo consulta para saber si el servicio esta vivo y
   * tambien sirve para despertar el free tier antes de una demo.
   */
  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() };
  });

  // Un prefijo por modulo: el mapa de la API se lee de una sola pasada.
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(catalogsRoutes, { prefix: '/api/catalogs' });
  await app.register(fieldsRoutes, { prefix: '/api/fields' });
  await app.register(deviationsRoutes, { prefix: '/api/deviations' });
  await app.register(metricsRoutes, { prefix: '/api/metrics' });
  await app.register(analysisRoutes, { prefix: '/api/analysis' });

  return app;
}
