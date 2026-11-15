import * as THREE from 'three';
import { GROUP } from '../engine/Physics.js';

const FILTERS = {
  collisionFilterGroup: GROUP.STATION,
  collisionFilterMask: GROUP.PLAYER,
};

const FLOOR_Y = 1.05;
const CEIL_Y = 3.75;
const HALF_LENGTH = 5.5;
const HALF_WIDTH = 2.1;

/**
 * Nave de transporte tripulable.
 *
 * Se construye en coordenadas locales con el suelo de la cabina en y=1,05 y
 * se coloca sobre la cuna del hangar. Los colisionadores se reposicionan con
 * el grupo, de modo que la misma nave puede aparcar en la Luna o Marte.
 */
export class TransportShip {
  constructor(scene, physics, materials, interactions) {
    this.scene = scene;
    this.physics = physics;
    this.materials = materials;
    this.interactions = interactions;

    this.group = new THREE.Group();
    this.group.name = 'transport-ship';
    scene.add(this.group);

    this.colliders = [];
    this.occluders = [];
    this.points = [];
    this.interiorActive = true;
    this.dockedAt = 'station';

    this._build();
    this._buildColliders();
    this._registerPoints();
    this.setPosition(20, -10.4, -3);
  }

  /* --------------------------------------------------------------- geometría */

  _mesh(geometry, material, position, rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(1);
    this.group.add(mesh);
    return mesh;
  }

  _box(size, material, position, rotation = null) {
    return this._mesh(new THREE.BoxGeometry(...size), material, position, rotation);
  }

  _build() {
    const hull = this.materials.hull;
    const dark = this.materials.dark;
    const hullDark = this.materials.hullDark;
    const visor = this.materials.visor;
    const accent = this.materials.accent;
    const green = this.materials.green;

    // Fuselaje principal y morro.
    this._box([11.0, 3.0, 4.2], hull, [0, 2.35, 0]);
    this._mesh(new THREE.CylinderGeometry(2.1, 2.1, 2.6, 18), hull, [6.1, 2.35, 0], [0, 0, Math.PI / 2]);
    this._mesh(new THREE.SphereGeometry(2.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hull, [7.2, 2.35, 0], [0, 0, -Math.PI / 2]);

    // Cintura y paneles de blindaje.
    this._box([11.2, 0.18, 4.3], hullDark, [0, 1.05, 0]);
    this._box([10.4, 0.14, 4.24], dark, [0, 3.66, 0]);
    for (const x of [-4.2, -2.1, 0, 2.1, 4.2]) {
      this._box([0.12, 2.9, 4.26], dark, [x, 2.35, 0]);
    }

    // Cabina acristalada.
    this._box([0.08, 1.05, 2.7], visor, [5.95, 2.72, 0]);
    for (const side of [-1, 1]) {
      this._box([4.6, 0.82, 0.06], visor, [2.6, 2.8, side * 2.1]);
      this._box([1.3, 0.72, 0.06], visor, [-3.6, 2.72, side * 2.1]);
      // Marco de ventanas.
      this._box([4.8, 0.1, 0.09], hullDark, [2.6, 3.25, side * 2.1]);
      this._box([4.8, 0.1, 0.09], hullDark, [2.6, 2.36, side * 2.1]);
    }

    // Alas, motores y propulsores.
    for (const side of [-1, 1]) {
      this._box([3.2, 0.18, 2.0], hullDark, [-1.0, 1.65, side * 3.0]);
      this._box([2.4, 0.08, 1.5], dark, [-1.0, 1.76, side * 3.15]);
      const engine = this._mesh(
        new THREE.CylinderGeometry(0.46, 0.52, 1.8, 14),
        dark,
        [-5.3, 2.05, side * 1.35],
        [0, 0, Math.PI / 2]
      );
      engine.layers.enable(1);
      this._mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14), accent, [-6.22, 2.05, side * 1.35], [0, 0, Math.PI / 2]);
      // Tobera inferior.
      this._mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.5, 12), accent, [-1.0, 1.42, side * 3.15], [Math.PI / 2, 0, 0]);
    }

    // Tren de aterrizaje.
    for (const x of [-3.4, 3.4]) {
      for (const side of [-1, 1]) {
        this._box([0.24, 0.9, 0.24], dark, [x, 0.45, side * 1.45]);
        this._box([0.85, 0.14, 0.85], hullDark, [x, 0.06, side * 1.45]);
      }
    }

    // Rampa trasera y marco de la escotilla.
    this._box([1.8, 0.12, 1.55], hullDark, [-6.35, 0.5, 0], [0, 0, -0.62]);
    this._box([0.12, 2.3, 0.22], dark, [-5.55, 2.2, -0.86]);
    this._box([0.12, 2.3, 0.22], dark, [-5.55, 2.2, 0.86]);
    this._box([0.12, 0.22, 1.9], dark, [-5.55, 3.34, 0]);
    this._box([0.06, 1.8, 0.75], visor, [-5.58, 2.2, -1.45]);
    this._box([0.06, 1.8, 0.75], visor, [-5.58, 2.2, 1.45]);

    // Interior: suelo, techo, asientos, consola, literas y carga.
    this._box([10.6, 0.12, 3.5], hullDark, [0, 1.0, 0]);
    this._box([10.6, 0.1, 3.5], dark, [0, CEIL_Y, 0]);
    for (const side of [-1, 1]) {
      this._box([10.4, 0.08, 0.12], accent, [0, CEIL_Y - 0.08, side * 1.55]);
    }

    // Puestos de pilotaje.
    for (const side of [-1, 1]) {
      this._box([0.85, 0.18, 0.75], dark, [3.55, 1.45, side * 0.85]);
      this._box([0.18, 0.8, 0.75], hullDark, [3.15, 1.75, side * 0.85]);
      this._box([0.5, 0.55, 0.62], hullDark, [3.55, 1.0, side * 0.85]);
      this._box([0.06, 0.08, 0.4], green, [3.6, 1.62, side * 0.85]);
    }
    this._box([1.6, 0.16, 2.6], hullDark, [4.75, 1.5, 0]);
    this._box([0.08, 0.7, 2.4], visor, [5.1, 1.95, 0], [0, 0, -0.18]);
    this._box([0.9, 0.08, 0.3], accent, [4.9, 1.62, -0.7]);
    this._box([0.9, 0.08, 0.3], green, [4.9, 1.62, 0.7]);

    // Pantallas de navegación y radar de a bordo.
    this._box([0.05, 0.62, 1.05], visor, [4.68, 2.32, -0.62], [0, 0, -0.12]);
    this._box([0.05, 0.62, 1.05], visor, [4.68, 2.32, 0.62], [0, 0, -0.12]);
    this._mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), green, [4.64, 2.32, 0], [0, 0, Math.PI / 2]);
    this._mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 24), accent, [4.62, 2.32, 0], [0, 0, Math.PI / 2]);
    this._mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 20), accent, [4.62, 2.32, 0], [0, 0, Math.PI / 2]);
    // Barrido del radar.
    this._box([0.02, 0.04, 0.62], accent, [4.6, 2.32, 0], [0.9, 0, 0]);

    // Antena radar sobre el casco.
    this._mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), this.materials.metal, [-1.6, 3.95, 0]);
    this._mesh(
      new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
      this.materials.metal,
      [-1.6, 4.2, 0],
      [Math.PI, 0, 0]
    );

    // Asientos de pasaje.
    for (const x of [-0.4, 1.4]) {
      for (const side of [-1, 1]) {
        this._box([0.7, 0.16, 0.7], dark, [x, 1.5, side * 1.25]);
        this._box([0.12, 0.72, 0.7], hullDark, [x - 0.36, 1.86, side * 1.25]);
      }
    }

    // Bodega y tanques de O2.
    for (const x of [-4.6, -3.6, -2.6]) {
      this._box([0.9, 0.75, 0.8], hullDark, [x, 1.44, -0.9]);
      this._box([0.9, 0.75, 0.8], hullDark, [x, 1.44, 0.9]);
    }
    for (const side of [-1, 1]) {
      this._mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.8, 12), this.materials.metal, [-4.6, 1.95, side * 1.55], [0, 0, Math.PI / 2]);
    }

    // Luces interiores y de navegación.
    this._box([0.5, 0.04, 2.6], accent, [2.5, CEIL_Y - 0.06, 0]);
    this._box([0.5, 0.04, 2.6], accent, [-2.5, CEIL_Y - 0.06, 0]);
    this._box([0.12, 0.12, 0.12], green, [7.1, 2.9, -1.2]);
    this._box([0.12, 0.12, 0.12], this.materials.red, [7.1, 2.9, 1.2]);

    this._box([0.5, 0.5, 0.5], hullDark, [-6.6, 0.28, 0]);
  }

  /* ------------------------------------------------------------- colisiones */

  _collider(local, half, occluder = true) {
    const body = this.physics.box([0, -999, 0], half, FILTERS);
    this.colliders.push({ body, local, half });

    if (occluder) {
      const geometry = new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.layers.set(0);
      this.scene.add(mesh);
      this.occluders.push({ mesh, local, half });
    }
  }

  _buildColliders() {
    // Suelo, paredes laterales, pared frontal y trasera con hueco de escotilla.
    this._collider([0, 0.99, 0], [5.5, 0.06, 2.1]);
    this._collider([0, 2.4, -2.1], [5.5, 1.35, 0.075]);
    this._collider([0, 2.4, 2.1], [5.5, 1.35, 0.075]);
    this._collider([5.5, 2.4, 0], [0.075, 1.35, 2.1]);
    this._collider([-5.5, 2.4, -1.4], [0.075, 1.35, 0.7]);
    this._collider([-5.5, 2.4, 1.4], [0.075, 1.35, 0.7]);
    this._collider([-5.5, 3.35, 0], [0.075, 0.4, 0.75]);

    // Techo y rampa (la rampa también se resuelve por groundHeight).
    this._collider([0, 3.8, 0], [5.5, 0.06, 2.1]);
  }

  /* ------------------------------------------------------------- interacción */

  _registerPoints() {
    if (!this.interactions) return;

    const definitions = [
      {
        id: 'ship_hatch',
        label: 'Nave de transporte · subir a bordo',
        panel: 'ship',
        position: [-6.6, 0.5, 0],
        radius: 2.2,
        color: 0x5ff0ff,
      },
      {
        id: 'ship_seat',
        label: 'Asiento del piloto de la nave',
        panel: 'ship',
        seat: true,
        position: [3.6, 1.6, 0],
        radius: 1.6,
        color: 0x6dffa8,
      },
      {
        id: 'ship_nav',
        label: 'Consola de navegación de la nave',
        panel: 'ship_nav',
        position: [4.9, 1.9, 0],
        radius: 1.9,
        color: 0x5ff0ff,
      },
      {
        id: 'ship_cargo',
        label: 'Bodega de carga',
        panel: 'ship_cargo',
        position: [-3.6, 1.7, 0],
        radius: 2.0,
        color: 0xffb45f,
      },
    ];

    for (const definition of definitions) {
      const local = definition.position;
      const point = this.interactions.addPoint({
        ...definition,
        owner: 'ship',
        position: [this.group.position.x + local[0], this.group.position.y + local[1], this.group.position.z + local[2]],
      });
      point.local = local;
      this.points.push(point);
    }
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);

    for (const collider of this.colliders) {
      collider.body.position.set(
        x + collider.local[0],
        y + collider.local[1],
        z + collider.local[2]
      );
      collider.body.aabbNeedsUpdate = true;
    }

    for (const occluder of this.occluders) {
      occluder.mesh.position.set(
        x + occluder.local[0],
        y + occluder.local[1],
        z + occluder.local[2]
      );
      occluder.mesh.updateMatrixWorld(true);
    }

    for (const point of this.points) {
      const local = point.local;
      const world = [x + local[0], y + local[1], z + local[2]];
      point.position = world;
      point.group.position.set(world[0], world[1], world[2]);
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
    for (const point of this.points) point.group.visible = visible;
    for (const occluder of this.occluders) occluder.mesh.visible = false;
  }

  setInteriorActive(active) {
    this.interiorActive = active;
    for (const collider of this.colliders) {
      collider.body.collisionResponse = active;
    }
  }

  /** Altura del suelo de la nave (o null si el punto está fuera). */
  groundHeightAt(worldX, worldZ, worldY = null) {
    if (!this.interiorActive) return null;

    const x = worldX - this.group.position.x;
    const z = worldZ - this.group.position.z;
    if (z < -2.0 || z > 2.0) return null;

    const floor = this.group.position.y + FLOOR_Y;

    // Si el jugador está claramente por debajo del suelo de la nave, debe
    // seguir usando el suelo del hangar/planeta. Evita “subir” a bordo por
    // debajo del casco al caminar por el hangar.
    if (worldY !== null && worldY < floor - 0.5) {
      // La rampa es la única excepción: conecta el suelo exterior con la nave.
      if (x >= -7.2 && x < -5.5 && z >= -0.8 && z <= 0.8) {
        const t = (x + 7.2) / 1.7;
        return this.group.position.y + t * FLOOR_Y;
      }
      return null;
    }

    if (x >= -5.5 && x <= 5.0) {
      return floor;
    }

    // Rampa: de la escotilla al suelo del hangar.
    if (x >= -7.2 && x < -5.5 && z >= -0.8 && z <= 0.8) {
      const t = (x + 7.2) / 1.7;
      return this.group.position.y + t * FLOOR_Y;
    }

    return null;
  }

  /** Módulo de cámara cuando el jugador está dentro. */
  getModuleAt(position) {
    if (!this.interiorActive) return null;
    const x = position.x - this.group.position.x;
    const z = position.z - this.group.position.z;
    const y = position.y - this.group.position.y;

    if (x >= -5.6 && x <= 5.2 && z >= -2.1 && z <= 2.1 && y >= 0.9 && y <= 4.0) {
      return {
        id: 'ship',
        min: [this.group.position.x - 5.6, this.group.position.y + FLOOR_Y, this.group.position.z - 2.1],
        max: [this.group.position.x + 5.2, this.group.position.y + CEIL_Y, this.group.position.z + 2.1],
      };
    }
    return null;
  }

  contains(position) {
    const module = this.getModuleAt(position);
    return module !== null;
  }

  /** Punto de embarque en el exterior (para planetas). */
  hatchPosition() {
    return new THREE.Vector3(
      this.group.position.x - 6.8,
      this.group.position.y + 0.2,
      this.group.position.z
    );
  }

  /** Posición interior junto a la rampa, para la acción de embarque. */
  boardPosition() {
    return new THREE.Vector3(
      this.group.position.x - 4.6,
      this.group.position.y + FLOOR_Y,
      this.group.position.z
    );
  }

  /** Asiento del piloto en coordenadas de mundo. */
  seatPosition() {
    return new THREE.Vector3(
      this.group.position.x + 3.55,
      this.group.position.y + 1.9,
      this.group.position.z
    );
  }

  update(dt) {
    void dt;
  }
}
