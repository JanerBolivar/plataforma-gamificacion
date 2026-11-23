import http from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { SwampRoom } from './game/SwampRoom.js';
import { CircoRoom } from './game/CircoRoom.js';

const app = createApp();
const PORT = env.PORT;
const httpServer = http.createServer(app);

// Instanciar servidor multijugador Colyseus sobre el mismo servidor HTTP
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

// Registrar salas de juego particionadas por matchId
gameServer.define('swamp_room', SwampRoom).filterBy(['matchId']);
gameServer.define('circo_room', CircoRoom).filterBy(['matchId']);

// Iniciar el servidor mediante Colyseus para enlazar rutas de matchmaking y servidor HTTP
gameServer
  .listen(PORT)
  .then(() => {
    console.log(`[INFO] Servidor HTTP e infraestructura WebSocket iniciados en http://localhost:${PORT}`);
    console.log(`[INFO] Servidor de salas Colyseus registrado exitosamente (swamp_room).`);
    console.log(`[INFO] Entorno de ejecucion: ${env.NODE_ENV}`);
    console.log(`[INFO] Endpoint de verificacion de salud: http://localhost:${PORT}/api/health`);
  })
  .catch((err) => {
    console.error('[ERROR] Error al iniciar el servidor Colyseus:', err);
    process.exit(1);
  });

/**
 * Controla el cierre ordenado de la aplicacion y de las salas activas.
 */
const gracefulShutdown = () => {
  console.log('[INFO] Senal de terminacion recibida. Cerrando servidores...');
  gameServer
    .gracefullyShutdown()
    .catch((err) => {
      console.error('[WARN] Error durante el cierre de Colyseus:', err);
    })
    .finally(() => {
      httpServer.close(() => {
        console.log('[INFO] Servidores HTTP y WebSocket cerrados correctamente.');
        process.exit(0);
      });
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
