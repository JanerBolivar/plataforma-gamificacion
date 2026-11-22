import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`[INFO] Servidor HTTP iniciado en http://localhost:${PORT}`);
  console.log(`[INFO] Entorno de ejecucion: ${env.NODE_ENV}`);
  console.log(`[INFO] Endpoint de verificacion de salud: http://localhost:${PORT}/api/health`);
});

/**
 * Controla el cierre ordenado de la aplicacion ante senales de terminacion.
 */
const gracefulShutdown = () => {
  console.log('[INFO] Senal de terminacion recibida. Cerrando servidor HTTP...');
  server.close(() => {
    console.log('[INFO] Servidor HTTP cerrado correctamente.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
