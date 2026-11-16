import { Room } from 'colyseus';
import { SpaceState, PlayerState } from '../schema/SpaceState.js';
import {
  generateToken,
  setCode,
  validateInvite,
  consumeUse,
  recordAttempt,
  onInviteGet,
  onInviteRotate,
} from '../invites.js';

/** Alfabeto sin caracteres ambiguos (sin O/0, I/1) para dictar códigos por voz. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const MAX_CLIENTS = 4;
const VALID_LOCATIONS = new Set(['station', 'moon', 'mars']);
const VALID_MODES = new Set(['walk', 'zero']);
const POSITION_LIMIT = 500;

/** Milisegundos mínimos entre dos paquetes de movimiento del mismo cliente. */
const MOVE_INTERVAL_MS = 40;
/** Ventana de gracia para reconectar tras una caída. */
const RECONNECT_SECONDS = 30;
/** Longitud máxima del nombre visible. */
const NAME_LENGTH = 18;
/** Longitud máxima del nombre de sala. */
const ROOM_NAME_LENGTH = 40;

/** Códigos ocupados en este proceso (evita colisiones al asignar roomId). */
const ACTIVE_CODES = new Set();

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stripControl(value) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

/** Nombre visible: sin caracteres de control, longitud acotada. */
export function sanitizeName(value) {
  return stripControl(value).slice(0, NAME_LENGTH) || 'Astronauta';
}

/** Apariencia: entero 0–3. */
export function sanitizeAppearance(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(Math.trunc(number), 0, 3) : 0;
}

/** Nombre de sala: sin controles y acotado. */
export function sanitizeRoomName(value) {
  return stripControl(value).slice(0, ROOM_NAME_LENGTH) || 'Sesión SPACE-TECH';
}

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function reserveCode() {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const code = randomCode();
    if (!ACTIVE_CODES.has(code)) {
      ACTIVE_CODES.add(code);
      return code;
    }
  }
  throw new Error('No se pudo asignar un código de sala libre.');
}

/**
 * Sala cooperativa autoritativa.
 *
 * - Máximo 4 jugadores; código de 6 caracteres como identificador público.
 * - El servidor valida movimiento, roles y cambios de destino.
 * - Reconexión automática con asiento reservado 30 s.
 */
export class SpaceRoom extends Room {
  maxClients = MAX_CLIENTS;

  state = new SpaceState();

  async onCreate(options = {}) {
    this.state.maxClients = MAX_CLIENTS;
    this.state.isPrivate = options?.isPrivate !== false;
    this.state.roomName = sanitizeRoomName(options?.roomName);
    this.state.createdAt = Date.now();
    this.state.phase = 'lobby';
    this.state.destination = 'station';
    this.state.revision = 0;
    this.state.hostId = '';

    // El código corto es también el roomId: el cliente lo comparte y lo usa
    // con joinById(). Colyseus permite sobrescribirlo durante onCreate().
    const code = reserveCode();
    this.roomId = code;
    this.state.code = code;

    const metadata = {
      roomName: this.state.roomName,
      isPrivate: this.state.isPrivate,
      phase: this.state.phase,
      destination: this.state.destination,
      inviteToken: null,
    };

    // Las salas privadas no aparecen en el listado público.
    this.setPrivate(this.state.isPrivate);

    // Token de invitación opcional para salas privadas.
    if (this.state.isPrivate) {
      const invitation = generateToken({ roomName: this.state.roomName });
      setCode(invitation.token, code);
      metadata.inviteToken = invitation.token;
    }

    await this.setMetadata(metadata);

    this.onMessage('move', (client, message) => this._onMove(client, message));
    this.onMessage('ready', (client, message) => this._onReady(client, message));
    this.onMessage('start', (client) => this._onStart(client));
    this.onMessage('destination', (client, message) => this._onDestination(client, message));
    this.onMessage('profile', (client, message) => this._onProfile(client, message));
    this.onMessage('invite:get', (client, message) => onInviteGet(client, message));
    this.onMessage('invite:rotate', (client, message) => this._onInviteRotate(client, message));
    this.onMessage('ping', (client, message) => {
      // El cliente calcula la latencia con su propio reloj (eco del timestamp).
      client.send('pong', { t: finite(message?.t, 0) });
    });
  }

  onAuth(client, options, authContext) {
    // El token de invitación es opcional: la sala también se abre por código.
    const token = options?.inviteToken || authContext?.inviteToken || null;
    const identity = {
      name: sanitizeName(options?.name),
      appearance: sanitizeAppearance(options?.appearance),
    };

    if (!token) return identity;

    const result = validateInvite(token);
    if (!result.ok) {
      recordAttempt(token);
      throw new Error('AUTH_FAILED: invitación inválida, expirada o sin usos.');
    }
    consumeUse(token);
    return identity;
  }

  onJoin(client, options, auth) {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = sanitizeName(auth?.name ?? options?.name);
    player.appearance = sanitizeAppearance(auth?.appearance ?? options?.appearance);
    player.mode = 'walk';
    player.location = this.state.destination;
    player.interior = true;
    player.connected = true;
    player.ready = false;
    player.lastSeen = Date.now() - MOVE_INTERVAL_MS;

    this.state.players.set(client.sessionId, player);

    if (!this.state.hostId || !this.state.players.has(this.state.hostId)) {
      this.state.hostId = client.sessionId;
    }
    for (const [id, entry] of this.state.players) {
      entry.host = id === this.state.hostId;
    }
    if (this.state.hostId === client.sessionId) player.ready = true;

    this._bumpRevision();

    client.send('welcome', {
      code: this.roomId,
      sessionId: client.sessionId,
      host: this.state.hostId === client.sessionId,
      maxClients: MAX_CLIENTS,
    });

    if (this.state.players.size > 1) {
      this.broadcast(
        'notice',
        { level: 'info', message: `${player.name} se unió a la tripulación.` },
        { except: client },
      );
    }
  }

  /**
   * Caída de red: el asiento se conserva y el SDK reintenta solo.
   * Sólo si la reconexión falla se elimina al jugador.
   */
  async onDrop(client, code) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.connected = false;
    player.ready = false;
    this._bumpRevision();
    this.broadcast('notice', {
      level: 'warn',
      message: `${player.name} perdió la conexión. Esperando reconexión…`,
    });

    try {
      const reconnected = await this.allowReconnection(client, RECONNECT_SECONDS);
      const restored = this.state.players.get(reconnected.sessionId);
      if (restored) {
        restored.connected = true;
        this._bumpRevision();
      }
      reconnected.send('resumed', {
        code: this.roomId,
        sessionId: reconnected.sessionId,
        host: this.state.hostId === reconnected.sessionId,
      });
      this.broadcast('notice', {
        level: 'info',
        message: `${player.name} se reconectó.`,
      });
    } catch {
      this._removePlayer(client.sessionId, 'no volvió a conectarse');
    }
  }

  onLeave(client) {
    // Idempotente: si onDrop ya lo eliminó, no hay nada que hacer.
    this._removePlayer(client.sessionId, 'salió de la partida');
  }

  async onDispose() {
    ACTIVE_CODES.delete(this.roomId);
  }

  /* ------------------------------------------------------------- internos */

  _bumpRevision() {
    this.state.revision = (this.state.revision + 1) >>> 0;
  }

  _removePlayer(sessionId, reason) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    const wasHost = this.state.hostId === sessionId;
    this.state.players.delete(sessionId);

    if (wasHost) this._electHost();
    this._bumpRevision();

    if (this.state.players.size > 0) {
      this.broadcast('notice', { level: 'info', message: `${player.name} ${reason}.` });
    }
  }

  _electHost() {
    let nextId = '';
    for (const [id, player] of this.state.players) {
      if (player.connected !== false) {
        nextId = id;
        break;
      }
    }
    if (!nextId) {
      for (const id of this.state.players.keys()) {
        nextId = id;
        break;
      }
    }

    this.state.hostId = nextId;
    for (const [id, player] of this.state.players) {
      player.host = id === nextId;
    }

    const host = this.state.players.get(nextId);
    if (host) {
      host.ready = true;
      this.broadcast('notice', { level: 'info', message: `${host.name} es el nuevo anfitrión.` });
    }
  }

  _isHost(client) {
    return client.sessionId === this.state.hostId;
  }

  /* -------------------------------------------------------------- mensajes */

  _onMove(client, message) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Límite de frecuencia: se descarta la ráfaga sin tocar el estado.
    const stamp = Date.now();
    if (stamp - player.lastSeen < MOVE_INTERVAL_MS) return;

    const x = Number(message?.x);
    const y = Number(message?.y);
    const z = Number(message?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

    player.lastSeen = stamp;
    player.x = clamp(x, -POSITION_LIMIT, POSITION_LIMIT);
    player.y = clamp(y, -POSITION_LIMIT, POSITION_LIMIT);
    player.z = clamp(z, -POSITION_LIMIT, POSITION_LIMIT);

    const qx = Number(message?.qx);
    const qy = Number(message?.qy);
    const qz = Number(message?.qz);
    const qw = Number(message?.qw);
    if ([qx, qy, qz, qw].every(Number.isFinite)) {
      const length = Math.hypot(qx, qy, qz, qw);
      if (length > 0.0001) {
        player.qx = qx / length;
        player.qy = qy / length;
        player.qz = qz / length;
        player.qw = qw / length;
      }
    }

    if (VALID_MODES.has(message?.mode)) player.mode = message.mode;
    if (VALID_LOCATIONS.has(message?.location)) player.location = message.location;
    if (typeof message?.interior === 'boolean') player.interior = message.interior;

    const anim = Number(message?.anim);
    if (Number.isFinite(anim)) player.anim = clamp(anim, 0, 1);
  }

  _onReady(client, message) {
    if (this.state.phase !== 'lobby') return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.ready = message?.ready === true;
    this._bumpRevision();
  }

  _onStart(client) {
    if (!this._isHost(client)) {
      client.send('error', { message: 'Sólo el anfitrión puede iniciar la exploración.' });
      return;
    }
    if (this.state.phase === 'exploring') return;

    const pending = [...this.state.players.values()].filter(
      (player) => player.id !== this.state.hostId && player.connected !== false && !player.ready,
    );
    if (pending.length > 0) {
      client.send('error', {
        message: `Faltan ${pending.length} tripulante(s) por prepararse.`,
      });
      return;
    }

    this.state.phase = 'exploring';
    for (const player of this.state.players.values()) {
      player.location = this.state.destination;
      player.ready = true;
    }
    this._bumpRevision();

    this.broadcast('started', {
      destination: this.state.destination,
      revision: this.state.revision,
    });
  }

  _onDestination(client, message) {
    if (!this._isHost(client)) {
      client.send('error', { message: 'Sólo el anfitrión puede cambiar el destino.' });
      return;
    }

    const destination = String(message?.destination ?? '');
    if (!VALID_LOCATIONS.has(destination)) {
      client.send('error', { message: 'Destino no válido.' });
      return;
    }

    this.state.destination = destination;
    for (const player of this.state.players.values()) {
      player.location = destination;
    }
    this._bumpRevision();

    this.broadcast('destinationChanged', {
      destination,
      revision: this.state.revision,
    });
  }

  _onProfile(client, message) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (typeof message?.name === 'string' && message.name.trim()) {
      player.name = sanitizeName(message.name);
    }
    if (message?.appearance !== undefined) {
      player.appearance = sanitizeAppearance(message.appearance);
    }
    this._bumpRevision();
  }

  _onInviteRotate(client, message) {
    if (!this._isHost(client)) {
      client.send('error', { message: 'Sólo el anfitrión puede renovar la invitación.' });
      return;
    }
    onInviteRotate(client, message, { roomName: this.state.roomName, code: this.roomId });
  }
}
