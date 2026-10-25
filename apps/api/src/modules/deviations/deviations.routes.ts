/**
 * Endpoints de desvios: /api/deviations/*
 *
 * Crear y leer: cualquier usuario autenticado.
 * Editar: SUPERVISOR o ADMIN (un operador no corrige registros ajenos).
 * Borrar: solo ADMIN.
 */
import type { FastifyPluginAsync } from 'fastify';
import { Role } from '@prisma/client';
import { z } from 'zod';
import {
  actualizarDesvioSchema,
  crearDesvioSchema,
  listarDesviosSchema,
} from './deviations.schemas.js';
import * as service from './deviations.service.js';

const idParams = z.object({ id: z.string().cuid() });

export const deviationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const query = listarDesviosSchema.parse(request.query);
    return service.listarDesvios(query);
  });

  app.get('/:id', { preHandler: app.authenticate }, async (request) => {
    const { id } = idParams.parse(request.params);
    return { deviation: await service.obtenerDesvio(id) };
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const input = crearDesvioSchema.parse(request.body);
    const deviation = await service.crearDesvio(input, request.auth!.sub);
    return reply.status(201).send({ deviation });
  });

  app.patch(
    '/:id',
    { preHandler: app.authorize(Role.ADMIN, Role.SUPERVISOR) },
    async (request) => {
      const { id } = idParams.parse(request.params);
      const input = actualizarDesvioSchema.parse(request.body);
      return { deviation: await service.actualizarDesvio(id, input) };
    },
  );

  app.delete('/:id', { preHandler: app.authorize(Role.ADMIN) }, async (request) => {
    const { id } = idParams.parse(request.params);
    await service.eliminarDesvio(id);
    return { ok: true };
  });
};
