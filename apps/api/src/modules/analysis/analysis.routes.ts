/** Endpoints de analisis: /api/analysis/* */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { motorActivo, preguntar } from './analysis.service.js';

const preguntaSchema = z.object({
  question: z.string().trim().min(3, 'La pregunta es muy corta').max(500),
});

export const analysisRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /** Que motor esta activo; el frontend lo muestra en la pantalla. */
  app.get('/provider', async () => ({ provider: motorActivo().name }));

  /**
   * Consulta en lenguaje natural.
   * Limite propio: una consulta a un modelo externo cuesta, y no queremos que
   * un bucle en el frontend dispare cientos de llamadas.
   */
  app.post(
    '/ask',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const { question } = preguntaSchema.parse(request.body);
      return preguntar(question);
    },
  );
};
