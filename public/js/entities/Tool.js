import * as THREE from 'three';

/**
 * Herramientas: definición de datos + mallas low-poly + animación en mano.
 * El "viewmodel" no se dibuja en la cámara: va anclado a la mano del astronauta,
 * así se ve en tercera persona sin una segunda escena.
 */
export const TOOLS = [
  {
    id: 'welder',
    name: 'Soldador',
    short: 'SOLD',
    repairs: 'hull',
    repairTime: 3.0,
    color: 0x5ff0ff,
    hint: 'Sella fisuras del casco',
  },
  {
    id: 'wrench',
    name: 'Llave',
    short: 'LLAVE',
    repairs: 'valve',
    repairTime: 2.4,
    color: 0xffb45f,
    hint: 'Aprieta válvulas y conductos',
  },
  {
    id: 'scanner',
    name: 'Escáner',
    short: 'SCAN',
    repairs: null,
    repairTime: 0,
    color: 0x6dffa8,
    hint: 'Revela fugas a distancia',
  },
];

const glowMaterials = new Map();

function glowMaterial(color) {
  if (!glowMaterials.has(color)) {
    glowMaterials.set(color, new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    }));
  }
  return glowMaterials.get(color);
}

/** Materiales PBR compartidos con la biblioteca; sombras solo en piezas clave. */
function toolMaterials(materials) {
  if (!materials) throw new Error('ToolRig requiere una MaterialLibrary');
  return {
    metal: materials.metal,
    dark: materials.dark,
    grip: materials.grip,
  };
}

function buildWelder(MAT) {
  const group = new THREE.Group();
  const accent = glowMaterial(0x5ff0ff);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.06), MAT.grip);
  grip.position.set(0, -0.08, 0.0);
  group.add(grip);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.26, 8), MAT.metal);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.02, 0.15);
  body.castShadow = true;
  group.add(body);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 8), MAT.dark);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.02, 0.29);
  group.add(collar);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.018, 0.13, 8), MAT.dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.02, 0.36);
  group.add(nozzle);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), accent);
  tip.position.set(0, 0.02, 0.43);
  group.add(tip);

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.15, 6), MAT.metal);
  tank.position.set(0.075, -0.02, 0.1);
  tank.rotation.z = 0.12;
  group.add(tank);

  return group;
}

function buildWrench(MAT) {
  const group = new THREE.Group();
  const accent = glowMaterial(0xffb45f);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.038, 0.36), MAT.metal);
  handle.position.set(0, 0, 0.13);
  handle.castShadow = true;
  group.add(handle);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.05, 0.12), MAT.grip);
  grip.position.set(0, 0, 0.04);
  group.add(grip);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.075), MAT.metal);
  head.position.set(0, 0, 0.33);
  group.add(head);

  for (const side of [-1, 1]) {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.07), MAT.metal);
    jaw.position.set(side * 0.052, 0, 0.38);
    group.add(jaw);
  }

  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.02), accent);
  marker.position.set(0, 0.03, 0.12);
  group.add(marker);

  return group;
}

function buildScanner(MAT) {
  const group = new THREE.Group();
  const accent = glowMaterial(0x6dffa8);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.26), MAT.dark);
  body.position.set(0, 0.03, 0.14);
  body.castShadow = true;
  group.add(body);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), MAT.grip);
  handle.position.set(0, -0.09, 0.06);
  group.add(handle);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), accent);
  screen.position.set(0, 0.115, 0.15);
  screen.rotation.x = -Math.PI / 2;
  group.add(screen);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), accent);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.03, 0.28);
  group.add(lens);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), MAT.metal);
  antenna.position.set(0.045, 0.14, 0.04);
  antenna.rotation.z = -0.2;
  group.add(antenna);

  return group;
}

export function buildToolMesh(id, materials) {
  const MAT = toolMaterials(materials);
  if (id === 'welder') return buildWelder(MAT);
  if (id === 'wrench') return buildWrench(MAT);
  return buildScanner(MAT);
}

export class ToolRig {
  constructor(hand, materials) {
    this.hand = hand;
    this.materials = materials;
    this.index = 0;
    this.time = 0;
    this.meshes = TOOLS.map((tool) => {
      const mesh = buildToolMesh(tool.id, materials);
      mesh.visible = false;
      mesh.scale.setScalar(1.15);
      hand.add(mesh);
      return mesh;
    });
    this.set(0);
  }

  set(index) {
    this.index = Math.max(0, Math.min(TOOLS.length - 1, index));
    this.meshes.forEach((mesh, i) => {
      mesh.visible = i === this.index;
    });
  }

  update(dt, speed, repairing) {
    this.time += dt;
    const mesh = this.meshes[this.index];
    if (!mesh) return;

    const sway = Math.sin(this.time * 4.4) * 0.006;
    const shake = repairing ? Math.sin(this.time * 46) * 0.014 : 0;

    mesh.position.set(sway * 0.5, sway + shake, 0);
    mesh.rotation.z = Math.sin(this.time * 2.6) * 0.02 + shake * 0.8;
    mesh.rotation.x = -0.12 + Math.min(0.12, speed * 0.004) + (repairing ? Math.sin(this.time * 33) * 0.02 : 0);
  }
}
