/**
 * Sistema de invitaciones para salas privadas de SPACE-TECH.
 *
 * - Tokens de alta entropía (`crypto.randomBytes(24)` en base64url).
 * - Almacenamiento en memoria (una instancia por proceso); revocables.
 * - TTL, usos máximos y rate limiting configurables por entorno.
 * - El token es opcional: la sala sigue siendo accesible por código.
 *
 * Las exportaciones se agrupan al final para evitar duplicados en ESM.
 */

import crypto from 'crypto';

/* ------------------------------------------------------------ configuración */

function envNumber(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

/** TTL de la invitación en ms. 0 = sin caducidad. Por defecto 1 hora. */
const INVITE_TTL_MS = process.env.INVITE_TTL_MS !== undefined
  ? envNumber('INVITE_TTL_MS', 60 * 60 * 1000)
  : envNumber('INVITE_TTL_MINUTES', 60) * 60 * 1000;

/** Usos máximos por token. 0 = ilimitado. */
const INVITE_MAX_USES = envNumber('INVITE_MAX_USES', 4);

/** Intentos fallidos antes de bloquear el token. */
const INVITE_MAX_ATTEMPTS = envNumber('INVITE_MAX_ATTEMPTS', 3);

/** Ventana (ms) para contar intentos fallidos. */
const INVITE_ATTEMPT_WINDOW_MS = envNumber('INVITE_ATTEMPT_WINDOW_MS', 60 * 1000);

/** Bloqueo (ms) tras agotar los intentos. */
const INVITE_BLOCK_MS = envNumber('INVITE_BLOCK_MS', 15 * 60 * 1000);

/** Map token → metadatos de la invitación. */
const invitations = new Map();

function now() {
  return Date.now();
}

function makeToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/* --------------------------------------------------------------- utilidades */

/** Elimina tokens caducados y reinicia bloqueos vencidos. */
function prune() {
  const stamp = now();
  for (const [token, info] of invitations) {
    if (INVITE_TTL_MS > 0 && info.expiresAt && stamp > info.expiresAt) {
      invitations.delete(token);
      continue;
    }
    if (info.blockedUntil && stamp > info.blockedUntil) {
      info.blockedUntil = 0;
      info.attempts = 0;
    }
  }
}

/**
 * Genera un token nuevo.
 *
 * @param {{roomName?: string, ttlMs?: number, maxUses?: number}} options
 * @returns {{token: string, url: string, expiresAt: number|null, usesLeft: number}}
 */
function generateToken({ roomName = 'Sesión SPACE-TECH', ttlMs, maxUses } = {}) {
  prune();
  const token = makeToken();
  const createdAt = now();
  const ttl = Number.isFinite(ttlMs) ? ttlMs : INVITE_TTL_MS;
  const expiresAt = ttl > 0 ? createdAt + ttl : null;
  const limit = Number.isFinite(maxUses) ? maxUses : INVITE_MAX_USES;

  invitations.set(token, {
    token,
    roomName,
    createdAt,
    expiresAt,
    usesLeft: limit,
    maxUses: limit,
    attempts: 0,
    blockedUntil: 0,
    revoked: false,
    code: null,
  });

  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return {
    token,
    url: base ? `${base}?invite=${token}` : `?invite=${token}`,
    expiresAt,
    usesLeft: limit,
  };
}

/** Asocia el código de sala (roomId) a un token ya generado. */
function setCode(token, code) {
  const info = invitations.get(token);
  if (info) info.code = code;
}

/** Devuelve los metadatos de un token o `null`. */
function readToken(token) {
  return invitations.get(token) || null;
}

/** Marca un token como revocado y lo elimina. */
function revokeToken(token) {
  const info = invitations.get(token);
  if (!info) return false;
  info.revoked = true;
  invitations.delete(token);
  return true;
}

/**
 * Valida un token sin consumirlo.
 *
 * @returns {{ok: true, info: object} | {ok: false, reason: string}}
 */
function validateInvite(token) {
  prune();
  const info = invitations.get(token);
  if (!info || info.revoked) return { ok: false, reason: 'invalid' };
  if (info.expiresAt && now() > info.expiresAt) {
    invitations.delete(token);
    return { ok: false, reason: 'expired' };
  }
  if (info.blockedUntil && now() < info.blockedUntil) {
    return { ok: false, reason: 'blocked' };
  }
  if (info.usesLeft <= 0) return { ok: false, reason: 'exhausted' };
  return { ok: true, info };
}

/** Consume un uso del token (llamado tras una entrada válida). */
function consumeUse(token) {
  const info = invitations.get(token);
  if (!info) return false;
  if (info.maxUses !== 0) info.usesLeft = Math.max(0, info.usesLeft - 1);
  return true;
}

/** Registra un intento fallido y aplica el bloqueo si procede. */
function recordAttempt(token) {
  const info = invitations.get(token);
  if (!info) return { allowed: false, reason: 'invalid' };
  const stamp = now();
  if (info.blockedUntil && stamp < info.blockedUntil) {
    return {
      allowed: false,
      reason: 'blocked',
      blockedForMs: info.blockedUntil - stamp,
    };
  }
  if (!info.windowStartedAt || stamp - info.windowStartedAt > INVITE_ATTEMPT_WINDOW_MS) {
    info.windowStartedAt = stamp;
    info.attempts = 0;
  }
  info.attempts += 1;
  if (info.attempts >= INVITE_MAX_ATTEMPTS) {
    info.blockedUntil = stamp + INVITE_BLOCK_MS;
    return { allowed: false, reason: 'max_attempts', blockedForMs: INVITE_BLOCK_MS };
  }
  return { allowed: true, attemptsLeft: INVITE_MAX_ATTEMPTS - info.attempts };
}

/* ------------------------------------------------------------- endpoint HTTP */

/**
 * Información pública de una invitación (`GET /invite/:token`).
 *
 * @returns {object} `{ ok: true, ... }` o `{ ok: false, error }`.
 */
function handleGetInvite(token) {
  const result = validateInvite(token);
  if (!result.ok) return { ok: false, error: result.reason };

  const { info } = result;
  return {
    ok: true,
    token: info.token,
    roomName: info.roomName,
    code: info.code,
    usesLeft: info.usesLeft,
    expiresAt: info.expiresAt,
  };
}

/* ------------------------------------------- mensajes dentro de la sala */

function onInviteGet(client, message) {
  const token = message?.token;
  if (!token) {
    client.send('error', { message: 'Falta el token de la invitación.' });
    return;
  }
  client.send('invite:get', handleGetInvite(token));
}

/**
 * Rota el token de invitación. Sólo el anfitrión debería invocarlo; la sala
 * comprueba el rol antes de delegar aquí.
 */
function onInviteRotate(client, message, context = {}) {
  const previous = message?.tokenOld;
  if (previous) revokeToken(previous);

  const created = generateToken({ roomName: context.roomName || 'Sesión SPACE-TECH' });
  if (context.code) setCode(created.token, context.code);
  client.send('invite:rotate', { ok: true, ...created });
}

export {
  generateToken,
  setCode,
  readToken,
  revokeToken,
  validateInvite,
  consumeUse,
  recordAttempt,
  prune,
  handleGetInvite,
  onInviteGet,
  onInviteRotate,
};
