/**
 * Punto de entrada del proceso.
 *
 * Solo se ocupa de levantar el servidor y de apagarlo prolijamente: cuando
 * Render reinicia el servicio manda SIGTERM, y queremos terminar los requests
 * en vuelo y cerrar el pool de Postgres antes de salir.
 */
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';

const app = await buildApp();

try {
  // host 0.0.0.0: dentro de un contenedor, escuchar en localhost lo dejaria
  // inalcanzable desde afuera.
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'No se pudo iniciar el servidor');
  process.exit(1);
}

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, async () => {
    app.log.info(`${senal} recibido, cerrando...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
