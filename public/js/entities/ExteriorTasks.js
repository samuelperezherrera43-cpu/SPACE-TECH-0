import * as THREE from 'three';
import { makeGlowTexture } from '../engine/Textures.js';

const TASK_DEFINITIONS = [
  {
    id: 'solar_1',
    mission: 'solar_repair',
    type: 'solar',
    label: 'Celda solar A',
    position: [12.6, 0, 0],
    radius: 2.9,
    duration: 2.4,
    tool: 0,
    color: 0xffb45f,
  },
  {
    id: 'solar_2',
    mission: 'solar_repair',
    type: 'solar',
    label: 'Celda solar B',
    position: [0, 0, 12.6],
    radius: 2.9,
    duration: 2.4,
    tool: 0,
    color: 0xffb45f,
  },
  {
    id: 'solar_3',
    mission: 'solar_repair',
    type: 'solar',
    label: 'Celda solar C',
    position: [-12.6, 0, 0],
    radius: 2.9,
    duration: 2.4,
    tool: 0,
    color: 0xffb45f,
  },
  {
    id: 'antenna_1',
    mission: 'antenna_repair',
    type: 'antenna',
    label: 'Actuador de antena A',
    position: [0, 6.4, 1.4],
    radius: 2.7,
    duration: 2.0,
    tool: 1,
    color: 0x5ff0ff,
  },
  {
    id: 'antenna_2',
    mission: 'antenna_repair',
    type: 'antenna',
    label: 'Actuador de antena B',
    position: [0, 5.6, -1.4],
    radius: 2.7,
    duration: 2.0,
    tool: 1,
    color: 0x5ff0ff,
  },
  {
    id: 'inspect_1',
    mission: 'module_inspection',
    type: 'inspection',
    label: 'Inspeccionar módulo norte',
    position: [0, 2.4, 2.9],
    radius: 2.8,
    duration: 0,
    tool: 2,
    color: 0x6dffa8,
  },
  {
    id: 'inspect_2',
    mission: 'module_inspection',
    type: 'inspection',
    label: 'Inspeccionar módulo sur',
    position: [0, 2.4, -2.9],
    radius: 2.8,
    duration: 0,
    tool: 2,
    color: 0x6dffa8,
  },
  {
    id: 'inspect_3',
    mission: 'module_inspection',
    type: 'inspection',
    label: 'Inspeccionar brazo este',
    position: [3.2, 0, 0],
    radius: 2.8,
    duration: 0,
    tool: 2,
    color: 0x6dffa8,
  },
  {
    id: 'component_install',
    mission: 'component_swap',
    type: 'component_install',
    label: 'Instalar regulador de potencia',
    position: [0, -1.1, 3.4],
    radius: 2.7,
    duration: 2.6,
    tool: 1,
    requires: 'component',
    color: 0x5ff0ff,
  },
  {
    id: 'tool_1',
    mission: 'tool_recovery',
    type: 'tool_pickup',
    label: 'Recoger llave de torque',
    position: [0, 4.8, 10.6],
    radius: 2.6,
    duration: 0,
    tool: null,
    color: 0x6dffa8,
  },
  {
    id: 'tool_2',
    mission: 'tool_recovery',
    type: 'tool_pickup',
    label: 'Recoger multímetro',
    position: [-10.8, 0, 0],
    radius: 2.6,
    duration: 0,
    tool: null,
    color: 0x6dffa8,
  },
];

/**
 * Puntos interactivos del exterior (paneles, antena, inspecciones y
 * herramientas perdidas). Son objetos reales: al completarlos se actualiza
 * el estado y el progreso de la misión activa.
 */
export class ExteriorTasks {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.name = 'exterior-tasks';
    scene.add(this.group);

    this.time = 0;
    this.glowTexture = makeGlowTexture();
    this.tasks = TASK_DEFINITIONS.map((definition) => this._buildTask(definition));
  }

  _buildTask(definition) {
    const group = new THREE.Group();
    group.position.set(...definition.position);
    group.visible = false;
    this.group.add(group);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: definition.color,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.035, 6, 22),
      ringMaterial
    );
    group.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.022, 6, 18),
      ringMaterial
    );
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      new THREE.MeshBasicMaterial({ color: definition.color, toneMapped: false })
    );
    group.add(core);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: definition.color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(1.3);
    group.add(glow);

    return {
      ...definition,
      group,
      ring,
      ring2,
      core,
      glow,
      done: false,
      progress: 0,
    };
  }

  update(dt, position, activeMissionId) {
    this.time += dt;

    for (const task of this.tasks) {
      const visible = !task.done && task.mission === activeMissionId;
      task.group.visible = visible;
      if (!visible) continue;

      task.ring.rotation.z += dt * 0.8;
      task.ring2.rotation.z -= dt * 1.2;
      task.core.rotation.y += dt * 1.4;
      task.glow.material.opacity = 0.35 + 0.25 * Math.sin(this.time * 3 + task.position[2]);
      task.group.position.y = task.position[1] + Math.sin(this.time * 1.5 + task.position[0]) * 0.06;

      // Si el jugador se aleja, el progreso de la tarea se pierde suavemente.
      const distance = task.group.position.distanceTo(position);
      if (distance > task.radius + 0.8) {
        task.progress = Math.max(0, task.progress - dt * 1.5);
      }
    }
  }

  getNearby(position) {
    let best = null;
    let bestDistance = Infinity;

    for (const task of this.tasks) {
      if (!task.group.visible || task.done) continue;
      const distance = task.group.position.distanceTo(position);
      if (distance <= task.radius && distance < bestDistance) {
        best = task;
        bestDistance = distance;
      }
    }

    return best;
  }

  complete(task) {
    if (!task || task.done) return null;
    task.done = true;
    task.progress = 0;
    task.group.visible = false;
    return task.type;
  }

  reset() {
    for (const task of this.tasks) {
      task.done = false;
      task.progress = 0;
      task.group.visible = false;
    }
  }
}
