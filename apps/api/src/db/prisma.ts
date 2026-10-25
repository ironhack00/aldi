/**
 * Cliente Prisma unico para todo el proceso.
 *
 * En desarrollo `tsx watch` reinicia el modulo en cada cambio; sin este cache
 * en `globalThis` se abririan decenas de pools de conexiones contra Postgres.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;
