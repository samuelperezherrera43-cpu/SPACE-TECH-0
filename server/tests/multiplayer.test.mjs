import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client } from '@colyseus/sdk';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '..');
const PORT = Number(process.env.TEST_PORT || 27123);
const HTTP = `http://127.0.0.1:${PORT}`;

let child = null;
let serverLog = '';

const state = {
  clients: [],
  rooms: [],
  code: '',
  hostId: '',
};

async function waitForHealth(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${HTTP}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // todavía arrancando
    }
    await sleep(200);
  }
  throw new Error(`El servidor no respondió en ${timeoutMs} ms.\n${serverLog}`);
}

before(async () => {
  child = spawn(process.execPath, ['index.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  await waitForHealth();
});

after(async () => {
  for (const room of state.rooms) {
    try {
      await room.leave();
    } catch {
      // ya cerrada
    }
  }
  for (const client of state.clients) {
    try {
      client.close?.();
    } catch {
      // sin conexión
    }
  }
  if (child && !child.killed) {
    child.kill();
    await sleep(300);
  }
});

function newClient() {
  const client = new Client(HTTP);
  state.clients.push(client);
  return client;
}

async function waitFor(predicate, label, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (predicate()) return;
    } catch {
      // el estado todavía no existe
    }
    await sleep(50);
  }
  throw new Error(`Tiempo de espera agotado: ${label}`);
}

async function connect(fn) {
  const client = newClient();
  const room = await fn(client);
  // Evita avisos del SDK por mensajes sin manejador en el entorno de pruebas.
  room.onMessage('welcome', () => {});
  room.onMessage('resumed', () => {});
  room.onMessage('notice', () => {});
  room.onMessage('error', () => {});
  room.onMessage('pong', () => {});
  room.onMessage('started', () => {});
  room.onMessage('destinationChanged', () => {});
  state.rooms.push(room);
  await waitFor(() => room.state?.code, 'sincronización inicial del estado');
  return room;
}

test('PRUEBA 1 · el servidor responde y anuncia su estado', async () => {
  const response = await fetch(`${HTTP}/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.maxPlayersPerRoom, 4);
});

test('PRUEBA 3 · se crea una sala privada con código de invitación', async () => {
  const room = await connect((client) =>
    client.create('space', { name: 'Ana', appearance: 0, isPrivate: true, roomName: 'Prueba privada' })
  );
  state.code = room.roomId;
  state.hostId = room.sessionId;

  await waitFor(() => room.state.players.size === 1, 'primer jugador en el estado');
  assert.match(state.code, /^[A-Z2-9]{6}$/, 'el código debe tener 6 caracteres');
  assert.equal(room.state.code, state.code);
  assert.equal(room.state.isPrivate, true);
  assert.equal(room.state.phase, 'lobby');
  assert.equal(room.state.hostId, room.sessionId);
  assert.equal(room.state.players.size, 1);
  assert.equal(room.state.players.get(room.sessionId).name, 'Ana');
  assert.equal(room.state.players.get(room.sessionId).host, true);
});

test('PRUEBAS 4 y 5 · se conectan el segundo, tercer y cuarto cliente por código', async () => {
  const names = ['Bruno', 'Carla', 'Diego'];
  for (let i = 0; i < names.length; i += 1) {
    const room = await connect((client) =>
      client.joinById(state.code, { name: names[i], appearance: i + 1 })
    );
    assert.equal(room.state.code, state.code);
    await waitFor(
      () => room.state.players.size === i + 2 && state.rooms[0].state.players.size === i + 2,
      `sincronización del jugador ${i + 2}`
    );
  }

  const host = state.rooms[0];
  assert.equal(host.state.players.size, 4);
  assert.equal(host.state.maxClients, 4);
  for (const room of state.rooms) {
    assert.equal(room.state.players.size, 4, 'los cuatro clientes ven cuatro astronautas');
  }
});

test('PRUEBA 10 · un quinto jugador no puede entrar en una sala completa', async () => {
  const client = newClient();
  await assert.rejects(
    () => client.joinById(state.code, { name: 'Elena' }),
    /full|locked|llena|max/i,
    'el servidor debe rechazar al quinto jugador'
  );
  assert.equal(state.rooms[0].state.players.size, 4, 'la sala sigue con cuatro jugadores');
});

test('PRUEBA 7 · el movimiento de un astronauta se sincroniza a los demás', async () => {
  const [host, second] = state.rooms;
  host.send('move', {
    x: 12.5,
    y: 1.25,
    z: -4.75,
    qx: 0,
    qy: 0.7071,
    qz: 0,
    qw: 0.7071,
    mode: 'walk',
    anim: 0.6,
    location: 'station',
    interior: true,
  });

  await sleep(300);
  const seen = second.state.players.get(host.sessionId);
  assert.ok(seen, 'el segundo cliente ve al primero');
  assert.equal(seen.x, 12.5);
  assert.equal(seen.y, 1.25);
  assert.equal(seen.z, -4.75);
  assert.equal(seen.mode, 'walk');
  assert.equal(seen.interior, true);
  assert.ok(Math.abs(seen.anim - 0.6) < 0.001);
});

test('el servidor descarta posiciones imposibles y limita la frecuencia', async () => {
  const [host, second] = state.rooms;
  // Ráfaga: sólo el primer paquete dentro de la ventana debe aplicarse.
  host.send('move', { x: 3, y: 0, z: 0, mode: 'walk' });
  host.send('move', { x: 999999, y: Number.NaN, z: Infinity, mode: 'hack' });
  await sleep(300);
  const seen = second.state.players.get(host.sessionId);
  assert.equal(seen.x, 3, 'la ráfaga se descarta');
  assert.equal(seen.mode, 'walk', 'un modo inválido no se acepta');

  // Un valor fuera de rango sí se acota al límite del servidor.
  await sleep(60);
  host.send('move', { x: 999999, y: 0, z: -999999, mode: 'zero' });
  await sleep(300);
  const clamped = second.state.players.get(host.sessionId);
  assert.equal(clamped.x, 500);
  assert.equal(clamped.z, -500);
  assert.equal(clamped.mode, 'zero');
});

test('PRUEBA 11 · la inactividad de un jugador no detiene a los demás', async () => {
  const [host, second] = state.rooms;
  // El primer cliente simula pausa: deja de enviar. El segundo sigue moviéndose.
  second.send('move', { x: -8, y: 2, z: 6, mode: 'walk', anim: 1 });
  await sleep(300);

  const seenByPaused = host.state.players.get(second.sessionId);
  assert.equal(seenByPaused.x, -8, 'el jugador pausado sigue recibiendo el mundo');
  assert.equal(host.state.players.size, 4, 'nadie es expulsado por estar inactivo');
});

test('PRUEBAS 8 y 9 · desconexión detectada y reconexión automática', async () => {
  const [host, , , fourth] = state.rooms;
  const fourthId = fourth.sessionId;

  // El SDK sólo reintenta si la sala lleva al menos 5 s en pie.
  await sleep(5200);

  const notices = [];
  host.onMessage('notice', (message) => notices.push(message));
  const reconnected = new Promise((resolve) => fourth.onReconnect(resolve));
  // Cierre sin consentimiento = caída de red; el SDK reintenta solo.
  fourth.leave(false);

  await waitFor(
    () => notices.some((notice) => /perdió la conexión/i.test(notice.message)),
    'aviso de desconexión a los demás'
  );
  assert.equal(host.state.players.size, 4, 'el asiento se conserva durante la reconexión');

  await Promise.race([
    reconnected,
    sleep(15000).then(() => {
      throw new Error('la reconexión automática no ocurrió');
    }),
  ]);

  await waitFor(() => host.state.players.get(fourthId)?.connected === true, 'estado conectado restaurado');
  const restored = host.state.players.get(fourthId);
  assert.ok(restored, 'el jugador sigue en la sala tras reconectar');
  assert.equal(restored.connected, true, 'el estado de conexión se restaura');
  assert.equal(host.state.players.size, 4);
});

test('el anfitrión inicia la exploración y cambia el destino compartido', async () => {
  const [host, second] = state.rooms;

  // Todos los invitados se preparan antes de iniciar.
  for (const room of state.rooms.slice(1)) {
    room.send('ready', { ready: true });
  }
  await waitFor(
    () => [...host.state.players.values()].filter((player) => !player.host).every((player) => player.ready),
    'todos preparados'
  );

  const started = new Promise((resolve) => second.onMessage('started', resolve));
  host.send('start');
  const payload = await Promise.race([
    started,
    sleep(3000).then(() => {
      throw new Error('no llegó el evento started');
    }),
  ]);
  assert.equal(payload.destination, 'station');
  await waitFor(() => second.state.phase === 'exploring', 'fase exploring sincronizada');

  const changed = new Promise((resolve) => second.onMessage('destinationChanged', resolve));
  host.send('destination', { destination: 'moon' });
  const destination = await Promise.race([
    changed,
    sleep(3000).then(() => {
      throw new Error('no llegó el evento destinationChanged');
    }),
  ]);
  assert.equal(destination.destination, 'moon');
  await waitFor(() => second.state.destination === 'moon', 'destino sincronizado');
  assert.equal(second.state.destination, 'moon');
  for (const player of second.state.players.values()) {
    assert.equal(player.location, 'moon');
  }

  // Un invitado no puede cambiar el destino.
  const errors = [];
  second.onMessage('error', (message) => errors.push(message));
  second.send('destination', { destination: 'mars' });
  await sleep(300);
  assert.equal(second.state.destination, 'moon', 'sólo el anfitrión cambia el destino');
  assert.ok(errors.length >= 1, 'el invitado recibe un error');
});

test('sólo las salas públicas aparecen en el listado', async () => {
  const publicRoom = await connect((client) =>
    client.create('space', { name: 'Público', isPrivate: false, roomName: 'Sala pública' })
  );

  const response = await fetch(`${HTTP}/rooms`);
  const body = await response.json();
  assert.equal(response.status, 200);
  const codes = body.rooms.map((room) => room.code);
  assert.ok(codes.includes(publicRoom.roomId), 'la sala pública aparece');
  assert.ok(!codes.includes(state.code), 'la sala privada no aparece');

  await publicRoom.leave();
});

test('PRUEBA 8 · salida limpia, limpieza de avatar y nuevo anfitrión', async () => {
  const [host, second] = state.rooms;
  const oldHostId = host.sessionId;

  await host.leave();
  await sleep(500);

  assert.equal(second.state.players.size, 3, 'el avatar del jugador que sale se elimina');
  assert.equal(second.state.players.get(oldHostId), undefined);
  assert.notEqual(second.state.hostId, oldHostId, 'se elige un nuevo anfitrión');
  assert.ok(second.state.players.get(second.state.hostId), 'el nuevo anfitrión está en la sala');
  assert.equal(second.state.players.get(second.state.hostId).host, true);
});
