/**
 * Endpoints de catalogos: /api/catalogs/*
 *
 * Lectura: cualquier usuario autenticado (los formularios la necesitan).
 * Escritura: solo ADMIN.
 */
import type { FastifyPluginAsync } from 'fastify';
import { Role } from '@prisma/client';
import { z } from 'zod';
import {
  actualizarCatalogoSchema,
  actualizarItemSchema,
  crearCatalogoSchema,
  crearItemSchema,
  reordenarItemsSchema,
} from './catalogs.schemas.js';
import * as service from './catalogs.service.js';

const idParams = z.object({ id: z.string().cuid() });
const keyParams = z.object({ key: z.string() });

export const catalogsRoutes: FastifyPluginAsync = async (app) => {
  const soloAdmin = { preHandler: app.authorize(Role.ADMIN) };
  const autenticado = { preHandler: app.authenticate };

  app.get('/', autenticado, async () => ({ catalogs: await service.listarCatalogos() }));

  app.get('/:key', autenticado, async (request) => {
    const { key } = keyParams.parse(request.params);
    const soloActivos = (request.query as { activos?: string }).activos === 'true';
    return { catalog: await service.obtenerCatalogo(key, soloActivos) };
  });

  app.post('/', soloAdmin, async (request, reply) => {
    const input = crearCatalogoSchema.parse(request.body);
    const catalog = await service.crearCatalogo(input);
    return reply.status(201).send({ catalog });
  });

  app.patch('/:id', soloAdmin, async (request) => {
    const { id } = idParams.parse(request.params);
    const data = actualizarCatalogoSchema.parse(request.body);
    return { catalog: await service.actualizarCatalogo(id, data) };
  });

  app.delete('/:id', soloAdmin, async (request) => {
    const { id } = idParams.parse(request.params);
    await service.eliminarCatalogo(id);
    return { ok: true };
  });

  // --- Items -----------------------------------------------------------------

  app.post('/:id/items', soloAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const input = crearItemSchema.parse(request.body);
    const item = await service.crearItem(id, input);
    return reply.status(201).send({ item });
  });

  app.patch('/items/:id', soloAdmin, async (request) => {
    const { id } = idParams.parse(request.params);
    const data = actualizarItemSchema.parse(request.body);
    return { item: await service.actualizarItem(id, data) };
  });

  app.delete('/items/:id', soloAdmin, async (request) => {
    const { id } = idParams.parse(request.params);
    return service.eliminarItem(id);
  });

  app.post('/items/reorder', soloAdmin, async (request) => {
    const { ids } = reordenarItemsSchema.parse(request.body);
    await service.reordenarItems(ids);
    return { ok: true };
  });
};
