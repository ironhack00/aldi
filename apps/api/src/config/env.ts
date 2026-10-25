/**
 * Lectura y validacion de variables de entorno.
 *
 * Se valida una sola vez, al arrancar: si falta algo el proceso muere con un
 * mensaje claro en vez de fallar mas tarde con un `undefined` en medio de un
 * request.
 *
 * El `.env` solo existe en desarrollo; en Render las variables las inyecta la
 * plataforma y `dotenv.config()` no hace nada.
 */
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /** Lista de origenes permitidos, separada por coma. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  AI_PROVIDER: z.enum(['local', 'codex']).default('local'),
  CODEX_API_URL: z.string().optional(),
  CODEX_API_KEY: z.string().optional(),

  SEED_PASSWORD: z.string().default('Demo1234!'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nConfiguracion invalida. Revisar el archivo .env:\n${detalle}\n`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  /** Origenes CORS ya normalizados a array. */
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export type Env = typeof env;
