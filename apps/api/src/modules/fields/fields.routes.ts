/**
 * Endpoints de campos dinamicos: /api/fields/*
 *
 * GET /api/fields es el endpoint que el frontend usa para construir el
 * formulario de registro y las columnas de la tabla. Escritura solo ADMIN.
 */
import type { FastifyPluginAsync } from 'fastify';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { actualizarCampoSchema, crearCampoSchema, reordenarCamposSchema } from './fields.schemas.js';
import * as service from './fields.service.js';

const idParams = z.object({ id: z.string().cuid() });

export const fieldsRoutes: FastifyPluginAsync = async (app) => {
  const soloAdmin = { preHandler: app.authorize(Role.ADMIN) };

  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const incluirInactivos = (request.query as { todos?: string }).todos === 'true';
    return { fields: await service.obtenerEsquemaFormulario(incluirInactivos) };
  });

  app.post('/', soloAdmin, async (request, reply) => {
    const input = crearCampoSchema.parse(request.body);
    const field = await service.crearCampo(input);
    return reply.status(201).send({ field });
  });

  app.patch('/:id', soloAdmin, async (request) => {
    const { id } = idParams.parse(request.params);
    const data = actualizarCampoSchema.parse(request.body);
    return { field: await service.actualizarCampo(id, data) };
  });

  app.delete('/:id', soloAdmin, async (request) => {
    const { id } = idParams.parse(request.params);
    return service.eliminarCampo(id);
  });

  app.post('/reorder', soloAdmin, async (request) => {
    const { ids } = reordenarCamposSchema.parse(request.body);
    await service.reordenarCampos(ids);
    return { ok: true };
  });
};
