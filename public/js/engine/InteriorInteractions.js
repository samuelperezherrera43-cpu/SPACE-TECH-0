import * as THREE from 'three';
import { makeGlowTexture } from './Textures.js';

const POINTS = [
  {
    id: 'navigation',
    label: 'Consola de navegación',
    panel: 'navigation',
    position: [0, -8.85, -13.0],
    radius: 2.6,
    color: 0x5ff0ff,
  },
  {
    id: 'seat',
    label: 'Asiento del piloto',
    panel: 'cockpit',
    seat: true,
    position: [0, -9.85, -12.3],
    radius: 1.45,
    color: 0x6dffa8,
  },
  {
    id: 'engineering',
    label: 'Consola de ingeniería',
    panel: 'engineering',
    position: [7.55, -8.9, -1.5],
    radius: 2.5,
    color: 0xffb45f,
  },
  {
    id: 'lab',
    label: 'Consola del laboratorio',
    panel: 'lab',
    position: [-7.0, -8.9, -1.5],
    radius: 2.5,
    color: 0x6dffa8,
  },
  {
    id: 'storage',
    label: 'Almacén y equipamiento',
    panel: 'storage',
    position: [6.9, -8.9, -6.25],
    radius: 2.5,
    color: 0xffb45f,
  },
  {
    id: 'life_support',
    label: 'Panel de soporte vital',
    panel: 'life',
    position: [1.1, -8.9, 0.8],
    radius: 2.2,
    color: 0x5ff0ff,
  },
  // Expansión 3.2: nuevas salas.
  {
    id: 'suit_locker',
    label: 'Armario de trajes EVA',
    panel: 'suit',
    position: [-5.1, -8.9, 5.1],
    radius: 2.8,
    color: 0x5ff0ff,
  },
  {
    id: 'medbay',
    label: 'Consola médica',
    panel: 'medbay',
    position: [-9.4, -8.9, -1.5],
    radius: 2.5,
    color: 0x6dffa8,
  },
  {
    id: 'dorms',
    label: 'Panel de descanso',
    panel: 'dorms',
    position: [-11.5, -8.9, 3.4],
    radius: 2.4,
    color: 0x6dffa8,
  },
  {
    id: 'mess',
    label: 'Comedor y cocina',
    panel: 'mess',
    position: [-18.0, -8.9, -1.2],
    radius: 2.6,
    color: 0xffb45f,
  },
  {
    id: 'engineering_room',
    label: 'Sala de máquinas',
    panel: 'engineering',
    position: [4.5, -8.9, -18.5],
    radius: 2.8,
    color: 0xffb45f,
  },
  {
    id: 'power',
    label: 'Reactor y baterías',
    panel: 'power',
    position: [-4.5, -8.9, -18.5],
    radius: 2.8,
    color: 0x5ff0ff,
  },
  {
    id: 'life_room',
    label: 'Control ambiental',
    panel: 'life',
    position: [12.5, -8.9, -18.5],
    radius: 2.8,
    color: 0x5ff0ff,
  },
  {
    id: 'workshop',
    label: 'Taller mecánico',
    panel: 'workshop',
    position: [20.0, -8.9, -18.5],
    radius: 2.8,
    color: 0xffb45f,
  },
  {
    id: 'hangar',
    label: 'Consola de hangar',
    panel: 'hangar',
    position: [12.4, -8.9, -10.5],
    radius: 2.8,
    color: 0x5ff0ff,
  },
];

/**
 * Consolas y puntos interactivos del interior.
 * Cada punto es una consola real: abre un panel con acciones que modifican
 * estado (circuitos, filtros, muestras, inventario y misiones).
 */
export class InteriorInteractions {
  constructor(scene, materials) {
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.name = 'interior-interactions';
    scene.add(this.group);

    this.time = 0;
    this.glowTexture = makeGlowTexture();
    this.points = POINTS.map((definition) => this._buildPoint({ owner: 'station', ...definition }));
  }

  /** Añade un punto interactivo en tiempo de ejecución (nave, rover...). */
  addPoint(definition) {
    const point = this._buildPoint({ owner: 'station', ...definition });
    this.points.push(point);
    return point;
  }

  setStationVisible(visible) {
    for (const point of this.points) {
      if (point.owner === 'station') point.group.visible = visible;
    }
  }

  _buildPoint(definition) {
    const group = new THREE.Group();
    group.position.set(...definition.position);
    group.layers.set(1);
    this.group.add(group);

    const material = new THREE.MeshBasicMaterial({
      color: definition.color,
      transparent: true,
      opacity: 0.8,
      toneMapped: false,
    });

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 5, 18), material);
    ring.layers.set(1);
    group.add(ring);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 5, 14), material);
    ring2.rotation.x = Math.PI / 2;
    ring2.layers.set(1);
    group.add(ring2);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: definition.color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(0.9);
    glow.layers.set(1);
    group.add(glow);

    return { ...definition, group, ring, ring2, glow };
  }

  update(dt, position) {
    this.time += dt;
    for (const point of this.points) {
      point.ring.rotation.z += dt * 0.9;
      point.ring2.rotation.z -= dt * 1.3;
      point.glow.material.opacity = 0.3 + 0.2 * Math.sin(this.time * 2.6 + point.position[0]);
      point.group.position.y = point.position[1] + Math.sin(this.time * 1.4 + point.position[2]) * 0.025;
      void position;
    }
  }

  getNearby(position, owner = null) {
    let best = null;
    let bestDistance = Infinity;

    for (const point of this.points) {
      if (point.group.visible === false) continue;
      if (owner && point.owner !== owner) continue;
      const distance = point.group.position.distanceTo(position);
      if (distance <= point.radius && distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }

    return best;
  }
}
