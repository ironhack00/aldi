/**
 * Plugin de seguridad de transporte: cabeceras, CORS, cookies y rate limit.
 *
 * Se registra antes que las rutas para que aplique a todo el arbol.
 */
import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  // Cabeceras defensivas (XSS, sniffing, framing). La CSP se desactiva porque
  // esta API solo devuelve JSON; el frontend tiene la suya.
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS con lista blanca explicita. `credentials: true` es necesario porque
  // el refresh token viaja en una cookie httpOnly desde otro dominio
  // (Vercel -> Render).
  await app.register(cors, {
    origin: (origin, cb) => {
      // Peticiones sin Origin (curl, health checks) se permiten.
      if (!origin) return cb(null, true);
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origen no autorizado: ${origin}`), false);
    },
    credentials: true,
  });

  await app.register(cookie);

  // Limite global generoso; el login tiene su propio limite mas estricto.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });
}
