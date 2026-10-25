/**
 * Manejador global de errores.
 *
 * Traduce errores de dominio, de validacion (zod) y de Prisma a respuestas
 * HTTP con una forma estable:
 *
 *   { error: { code, message, details? } }
 *
 * Los errores inesperados se loguean completos pero al cliente solo se le
 * informa un 500 genérico: nunca se filtra el stack ni la query SQL.
 */
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';
import { env } from '../config/env.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    // 1. Errores de dominio que lanzamos a proposito.
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    // 2. Validacion de entrada.
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los datos enviados no son validos',
          details: error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
      });
    }

    // 3. Errores conocidos de Prisma: los dos que mas aparecen en la practica.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'Ya existe un registro con esos datos' },
        });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'El registro no existe' },
        });
      }
    }

    // 4. Rate limit de Fastify.
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Esperá un momento.' },
      });
    }

    // 5. Cualquier otra cosa: log completo, respuesta opaca.
    request.log.error({ err: error }, 'Error no manejado');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: env.isProduction ? undefined : error.message,
      },
    });
  });
}
