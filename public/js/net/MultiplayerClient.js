import { Client } from '@colyseus/sdk';

/**
 * Cliente de red del multijugador cooperativo.
 *
 * Responsabilidades:
 * - Resolver la URL del servidor (configurable, nunca localhost fijo en prod).
 * - Crear/unirse a salas por código o matchmaking público.
 * - Mantener el estado compartido y la lista de jugadores.
 * - Reconexión automática y reanudación tras recargar la página.
 * - Enviar el movimiento local a una frecuencia limitada.
 *
 * No crea renderers, bucles ni física: sólo habla con el servidor.
 */

const NAME_KEY = 'space-tech.mp.name';
const APPEARANCE_KEY = 'space-tech.mp.appearance';
const RECONNECT_KEY = 'space-tech.mp.reconnect';

/** Frecuencia de envío de movimiento (ms). ~15 Hz es suficiente y barato. */
const SEND_INTERVAL_MS = 66;
const PING_INTERVAL_MS = 2500;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento el juego sigue funcionando.
  }
}

/**
 * URL del servidor, en orden de prioridad:
 * 1. `window.SPACE_TECH_CONFIG.multiplayerUrl` (config.js del despliegue).
 * 2. `<meta name="multiplayer-url" content="...">`.
 * 3. localhost/127.0.0.1 → puerto 2567 del servidor de desarrollo.
 * 4. Cualquier otro host → mismo origen (proxy inverso del proveedor).
 */
export function resolveServerUrl() {
  const configured = globalThis.SPACE_TECH_CONFIG?.multiplayerUrl;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }

  const meta = document.querySelector('meta[name="multiplayer-url"]')?.content;
  if (typeof meta === 'string' && meta.trim()) {
    return meta.trim().replace(/\/$/, '');
  }

  const { protocol, hostname, origin } = globalThis.location ?? {};
  if (!hostname) return 'http://localhost:2567';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return `${protocol === 'https:' ? 'https' : 'http'}://${hostname}:2567`;
  }
  return origin;
}

export class MultiplayerClient {
  constructor() {
    this.serverUrl = resolveServerUrl();
    this.client = null;
    this.room = null;
    this.sessionId = '';
    this.code = '';
    this.isHost = false;
    this.phase = 'lobby';
    this.destination = 'station';
    this.maxClients = 4;
    this.players = new Map();
    this.latency = 0;
    this.status = 'idle';
    this.reconnecting = false;
    this.connected = false;

    this.name = readStorage(NAME_KEY) || '';
    this.appearance = Number(readStorage(APPEARANCE_KEY) || 0) % 4;

    this._listeners = new Map();
    this._lastSendAt = 0;
    this._pingTimer = null;
    this._startedAnnounced = false;
  }

  /* ------------------------------------------------------------ eventos */

  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this._listeners.get(event)?.delete(handler);
  }

  _emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.warn(`multiplayer: fallo en el manejador "${event}"`, error);
      }
    }
  }

  _setStatus(status, message = '') {
    this.status = status;
    this._emit('status', { status, message });
  }

  /* --------------------------------------------------------- identidad */

  setIdentity({ name, appearance }) {
    if (typeof name === 'string' && name.trim()) {
      this.name = name.trim().slice(0, 18);
      writeStorage(NAME_KEY, this.name);
    }
    if (Number.isFinite(appearance)) {
      this.appearance = Math.min(3, Math.max(0, Math.trunc(appearance)));
      writeStorage(APPEARANCE_KEY, String(this.appearance));
    }
  }

  _identityOptions() {
    return { name: this.name || undefined, appearance: this.appearance };
  }

  _ensureClient() {
    if (!this.client) this.client = new Client(this.serverUrl);
    return this.client;
  }

  /* ----------------------------------------------------------- conexión */

  async createRoom({ isPrivate = true, roomName = '' } = {}) {
    this._setStatus('connecting', 'Creando sala…');
    const client = this._ensureClient();
    const room = await client.create('space', {
      ...this._identityOptions(),
      isPrivate: isPrivate !== false,
      roomName,
    });
    return this._attach(room);
  }

  async joinRoom(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(clean)) {
      throw new Error('El código debe tener entre 4 y 10 letras o números.');
    }
    this._setStatus('connecting', `Entrando en ${clean}…`);
    const client = this._ensureClient();
    const room = await client.joinById(clean, this._identityOptions());
    return this._attach(room);
  }

  async joinPublic() {
    this._setStatus('connecting', 'Buscando partida pública…');
    const client = this._ensureClient();
    const room = await client.joinOrCreate('space', {
      ...this._identityOptions(),
      isPrivate: false,
      roomName: 'Sesión pública',
    });
    return this._attach(room);
  }

  /** Reanuda la sesión anterior si el navegador conserva el token. */
  async resumeSession() {
    let token = null;
    try {
      token = sessionStorage.getItem(RECONNECT_KEY);
    } catch {
      token = null;
    }
    if (!token) return null;

    this._setStatus('connecting', 'Recuperando sesión…');
    const client = this._ensureClient();
    try {
      const room = await client.reconnect(token);
      return this._attach(room);
    } catch {
      try {
        sessionStorage.removeItem(RECONNECT_KEY);
      } catch {
        // nada que limpiar
      }
      this._setStatus('idle');
      return null;
    }
  }

  _attach(room) {
    this.room = room;
    this.sessionId = room.sessionId;
    this.code = room.roomId;
    this.connected = true;
    this.reconnecting = false;
    this._startedAnnounced = false;

    this._persistToken();

    room.onStateChange((state) => this._onState(state));

    room.onMessage('welcome', (payload) => {
      this.code = payload?.code || room.roomId;
      this.isHost = payload?.host === true;
      this.maxClients = payload?.maxClients ?? 4;
      this._emitState();
    });

    room.onMessage('resumed', (payload) => {
      this.code = payload?.code || room.roomId;
      this.isHost = payload?.host === true;
      this._emitState();
    });

    room.onMessage('notice', (payload) => {
      this._emit('notice', payload ?? {});
    });

    room.onMessage('error', (payload) => {
      this._emit('error', { message: payload?.message || 'Error del servidor.' });
    });

    room.onMessage('started', (payload) => {
      this.phase = 'exploring';
      this.destination = payload?.destination || this.destination;
      this._emit('started', { destination: this.destination });
      this._emitState();
    });

    room.onMessage('destinationChanged', (payload) => {
      this.destination = payload?.destination || this.destination;
      this._emit('destinationChanged', { destination: this.destination });
      this._emitState();
    });

    room.onMessage('pong', (payload) => {
      const sentAt = Number(payload?.t);
      if (Number.isFinite(sentAt)) {
        const sample = Math.max(0, Math.round(performance.now() - sentAt));
        this.latency = this.latency ? Math.round(this.latency * 0.7 + sample * 0.3) : sample;
        this._emit('latency', { ms: this.latency });
      }
    });

    room.onDrop(() => {
      this.connected = false;
      this.reconnecting = true;
      this._setStatus('reconnecting', 'Conexión perdida · reconectando…');
    });

    room.onReconnect(() => {
      this.connected = true;
      this.reconnecting = false;
      this._persistToken();
      this._setStatus('connected', 'Conexión restablecida');
    });

    room.onLeave((code) => {
      this.connected = false;
      this.reconnecting = false;
      this._stopPing();
      this._clearToken();
      this.room = null;
      this.players.clear();
      this._emit('left', { code });
      this._setStatus('idle');
    });

    this._startPing();
    this._setStatus('connected');
    this._emitState();
    return room;
  }

  _persistToken() {
    try {
      if (this.room?.reconnectionToken) {
        sessionStorage.setItem(RECONNECT_KEY, this.room.reconnectionToken);
      }
    } catch {
      // sin sessionStorage no hay reanudación tras recarga
    }
  }

  _clearToken() {
    try {
      sessionStorage.removeItem(RECONNECT_KEY);
    } catch {
      // nada que limpiar
    }
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (!this.room) return;
      try {
        this.room.send('ping', { t: performance.now() });
      } catch {
        // el socket se está cerrando
      }
    }, PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = null;
  }

  /* ------------------------------------------------------------- estado */

  _onState(state) {
    if (!state) return;
    this.code = state.code || this.code;
    this.phase = state.phase || 'lobby';
    this.destination = state.destination || 'station';
    this.maxClients = state.maxClients || 4;
    this.isHost = state.hostId === this.sessionId;

    const players = new Map();
    if (state.players) {
      state.players.forEach((player, id) => {
        players.set(id, {
          id: player.id || id,
          name: player.name || 'Astronauta',
          appearance: player.appearance || 0,
          x: player.x,
          y: player.y,
          z: player.z,
          qx: player.qx,
          qy: player.qy,
          qz: player.qz,
          qw: player.qw,
          mode: player.mode,
          anim: player.anim,
          location: player.location,
          interior: player.interior,
          ready: player.ready === true,
          host: player.host === true,
          connected: player.connected !== false,
        });
      });
    }
    this.players = players;

    if (this.phase === 'exploring' && !this._startedAnnounced) {
      this._startedAnnounced = true;
      this._emit('started', { destination: this.destination });
    }

    this._emitState();
  }

  _emitState() {
    this._emit('state', {
      code: this.code,
      sessionId: this.sessionId,
      isHost: this.isHost,
      phase: this.phase,
      destination: this.destination,
      maxClients: this.maxClients,
      players: this.players,
      latency: this.latency,
      status: this.status,
    });
  }

  /* ------------------------------------------------------------ acciones */

  sendReady(ready) {
    this.room?.send('ready', { ready: ready === true });
  }

  sendStart() {
    this.room?.send('start');
  }

  sendDestination(destination) {
    this.room?.send('destination', { destination });
  }

  sendProfile(name, appearance) {
    this.room?.send('profile', { name, appearance });
  }

  /**
   * Envía el estado local como mucho una vez cada SEND_INTERVAL_MS.
   * El servidor vuelve a validar y limitar todo.
   */
  sendLocalState(sample) {
    if (!this.room || this.reconnecting) return;
    const now = performance.now();
    if (now - this._lastSendAt < SEND_INTERVAL_MS) return;
    this._lastSendAt = now;

    this.room.send('move', {
      x: sample.x,
      y: sample.y,
      z: sample.z,
      qx: sample.qx,
      qy: sample.qy,
      qz: sample.qz,
      qw: sample.qw,
      mode: sample.mode,
      anim: sample.anim,
      location: sample.location,
      interior: sample.interior,
    });
  }

  async leave() {
    const room = this.room;
    this.room = null;
    this._stopPing();
    this._clearToken();
    if (room) {
      try {
        await room.leave();
      } catch {
        // ya estaba cerrada
      }
    }
    this.players.clear();
    this.code = '';
    this.sessionId = '';
    this.isHost = false;
    this.phase = 'lobby';
    this._setStatus('idle');
  }

  /** Consulta el listado de salas públicas del servidor. */
  async listPublicRooms() {
    const response = await fetch(`${this.serverUrl}/rooms`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('El servidor no devolvió el listado de salas.');
    const body = await response.json();
    return Array.isArray(body?.rooms) ? body.rooms : [];
  }
}
