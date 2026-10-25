/** Endpoints de metricas: /api/metrics/* (lectura, cualquier autenticado). */
import type { FastifyPluginAsync } from 'fastify';
import * as service from './metrics.service.js';

export const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/summary', async () => ({ summary: await service.calcularResumen() }));

  app.get('/opportunities', async () => ({
    opportunities: await service.oportunidadesDeDeteccion(),
  }));
};
