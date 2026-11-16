import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

/**
 * Estado de un astronauta sincronizado con todos los clientes de la sala.
 *
 * Los valores por defecto se fijan en el constructor para que el primer
 * parche enviado al cliente sea siempre coherente (sin `undefined`).
 */
export class PlayerState extends Schema {
  constructor() {
    super();
    this.id = '';
    this.name = 'Astronauta';
    this.appearance = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.qx = 0;
    this.qy = 0;
    this.qz = 0;
    this.qw = 1;
    this.mode = 'walk';
    this.anim = 0;
    this.location = 'station';
    this.interior = true;
    this.ready = false;
    this.host = false;
    this.connected = true;
    this.lastSeen = 0;
  }
}

defineTypes(PlayerState, {
  id: 'string',
  name: 'string',
  appearance: 'uint8',
  x: 'number',
  y: 'number',
  z: 'number',
  qx: 'number',
  qy: 'number',
  qz: 'number',
  qw: 'number',
  mode: 'string',
  anim: 'number',
  location: 'string',
  interior: 'boolean',
  ready: 'boolean',
  host: 'boolean',
  connected: 'boolean',
  lastSeen: 'number',
});

/**
 * Estado autoritativo de la sala `space`.
 *
 * `code` es el código corto de 6 caracteres y coincide con `room.roomId`,
 * de modo que el cliente puede compartirlo y usarlo con `joinById`.
 */
export class SpaceState extends Schema {
  constructor() {
    super();
    this.code = '';
    this.roomName = 'Sesión SPACE-TECH';
    this.isPrivate = true;
    this.phase = 'lobby';
    this.hostId = '';
    this.maxClients = 4;
    this.destination = 'station';
    this.revision = 0;
    this.createdAt = 0;
    this.players = new MapSchema();
  }
}

defineTypes(SpaceState, {
  code: 'string',
  roomName: 'string',
  isPrivate: 'boolean',
  phase: 'string',
  hostId: 'string',
  maxClients: 'uint8',
  destination: 'string',
  revision: 'uint32',
  createdAt: 'number',
  players: { map: PlayerState },
});
