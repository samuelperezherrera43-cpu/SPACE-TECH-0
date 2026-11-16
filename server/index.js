/**
 * Servidor autoritativo de SPACE-TECH (Colyseus 0.18).
 *
 * Expone:
 * - `GET /health`      estado del servicio
 * - `GET /rooms`       salas públicas abiertas
 * - `GET /invite/:token` información pública de una invitación
 * - `WS  /`            transporte WebSocket de Colyseus (sala `space`)
 *
 * El servidor es independiente del cliente Three.js y puede desplegarse en
 * cualquier proveedor que soporte procesos Node con WebSockets persistentes.
 */

import { createServer } from 'node:http';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SpaceRoom } from './rooms/SpaceRoom.js';
import { handleGetInvite } from './invites.js';

const PORT = Number(process.env.PORT || 2567);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const MAX_PLAYERS_PER_ROOM = 4;

/** Orígenes permitidos (CORS). Vacío = todos (sólo desarrollo). */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes('*')) return true;
  try {
    const candidate = new URL(origin).origin;
    return ALLOWED_ORIGINS.some((allowed) => {
      const normalized = allowed.replace(/\/$/, '');
      return normalized === origin || normalized === candidate;
    });
  } catch {
    return false;
  }
}

const httpServer = createServer();
const transport = new WebSocketTransport({
  server: httpServer,
  maxPayload: 8 * 1024,
  perMessageDeflate: false,
  pingInterval: 5000,
  pingMaxRetries: 2,
});

const app = transport.getExpressApp();
app.disable('x-powered-by');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'space-tech-server',
    version: '1.0.0',
    env: NODE_ENV,
    maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM,
    publicUrl: PUBLIC_URL || null,
    time: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    name: 'SPACE-TECH multiplayer server',
    protocol: 'colyseus',
    room: 'space',
    maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM,
  });
});

// Listado de salas PÚBLICAS (las privadas nunca se exponen aquí).
app.get('/rooms', async (req, res) => {
  try {
    const rooms = await matchMaker.query({ name: 'space' });
    const list = rooms
      .filter((room) => room.private !== true)
      .map((room) => ({
        code: room.roomId,
        name: room.metadata?.roomName ?? 'Sesión SPACE-TECH',
        players: room.clients ?? 0,
        maxPlayers: room.maxClients ?? MAX_PLAYERS_PER_ROOM,
        phase: room.metadata?.phase ?? 'lobby',
        destination: room.metadata?.destination ?? 'station',
        locked: room.locked === true,
      }))
      .filter((room) => room.players < room.maxPlayers && !room.locked);
    res.status(200).json({ ok: true, rooms: list });
  } catch {
    res.status(500).json({ ok: false, error: 'room_list_failed' });
  }
});

// Resuelve un token de invitación → información pública de la sala.
app.get('/invite/:token', (req, res) => {
  const data = handleGetInvite(String(req.params.token || ''));
  if (data.ok) {
    res.status(200).json(data);
    return;
  }
  const status = data.error === 'expired' ? 410 : 400;
  res.status(status).json(data);
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

const gameServer = new Server({
  transport,
  devMode: NODE_ENV !== 'production',
});

gameServer.define('space', SpaceRoom);

gameServer
  .listen(PORT, HOST)
  .then(() => {
    const where = PUBLIC_URL || `http://localhost:${PORT}`;
    console.log(`SPACE-TECH server escuchando en ${HOST}:${PORT}`);
    console.log(`  health:    ${where}/health`);
    console.log(`  websocket: ${where.replace(/^http/, 'ws')}`);
    console.log(`  entorno:   ${NODE_ENV} · orígenes: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'todos'}`);
  })
  .catch((error) => {
    console.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  });

export { gameServer, httpServer, app };
