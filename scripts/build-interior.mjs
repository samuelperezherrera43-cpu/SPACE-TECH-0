/**
 * Genera los GLB del interior habitable (herramienta de autoría, no se sirve).
 *
 * - Geometría en coordenadas de mundo, fusionada por material: ~10 draw calls.
 * - Materiales PBR con nombre para que el runtime los sustituya por la
 *   biblioteca procedural (map + normal + roughness).
 * - Exporta también colliders.json (cajas estáticas y puertas) para que
 *   cannon-es y el runtime compartan exactamente la misma arquitectura.
 *
 * Uso: node scripts/build-interior.mjs
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// GLTFExporter usa FileReader para el chunk binario; en Node no existe.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.({ target: this });
    });
  }
};

const OUT = resolve('public/assets/interior');

/* ------------------------------------------------------------------ medidas */

const FLOOR = -10.4;
const CEIL = -7.6;
const HANGAR_CEIL = -5.6;
const T = 0.18; // grosor de pared
const DOOR_W = 1.8;
const DOOR_H = 2.2;
const DOOR_TOP = FLOOR + DOOR_H; // -8.2
const DOOR_Y = FLOOR + DOOR_H / 2; // -9.3

const MODULES = {
  airlock: { min: [-1.8, FLOOR, 2.4], max: [1.8, CEIL, 5.6] },
  corridor: { min: [-1.5, FLOOR, -8], max: [1.5, CEIL, 2.4] },
  cockpit: { min: [-4.5, FLOOR, -15], max: [4.5, CEIL, -8] },
  ops: { min: [1.5, FLOOR, -4.5], max: [8.5, CEIL, 1.5] },
  lab: { min: [-8.5, FLOOR, -4.5], max: [-1.5, CEIL, 1.5] },
  storage: { min: [1.5, FLOOR, -8], max: [7.5, CEIL, -4.5] },
  // Ala este: enlace y hangar de la nave de transporte.
  hangar_link: { min: [8.5, FLOOR, -1.5], max: [10.5, CEIL, 1.5] },
  hangar: { min: [10.5, FLOOR, -14], max: [30, HANGAR_CEIL, 4] },
  // Ala oeste: tripulación y preparación EVA.
  medbay: { min: [-15, FLOOR, -4.5], max: [-8.5, CEIL, 1.5] },
  dorms: { min: [-15, FLOOR, 1.5], max: [-8.5, CEIL, 7.5] },
  mess: { min: [-21, FLOOR, -4.5], max: [-15, CEIL, 7.5] },
  evaprep: { min: [-8.5, FLOOR, 2.4], max: [-1.8, CEIL, 6.0] },
  // Ala norte: industria, energía y soporte vital.
  northlink: { min: [4.5, FLOOR, -15], max: [7.5, CEIL, -8] },
  engineering: { min: [0, FLOOR, -22], max: [9, CEIL, -15] },
  power: { min: [-9, FLOOR, -22], max: [0, CEIL, -15] },
  life: { min: [9, FLOOR, -22], max: [16, CEIL, -15] },
  workshop: { min: [16, FLOOR, -22], max: [24, CEIL, -15] },
};

const DOORS = [
  { id: 'airlock_outer', position: [0, DOOR_Y, 5.6], axis: 'z', auto: false, module: 'airlock' },
  { id: 'airlock_inner', position: [0, DOOR_Y, 2.4], axis: 'z', auto: false, module: 'airlock' },
  { id: 'cockpit', position: [0, DOOR_Y, -8], axis: 'z', auto: true, module: 'cockpit' },
  { id: 'ops', position: [1.5, DOOR_Y, -1.5], axis: 'x', auto: true, module: 'ops' },
  { id: 'lab', position: [-1.5, DOOR_Y, -1.5], axis: 'x', auto: true, module: 'lab' },
  { id: 'storage', position: [1.5, DOOR_Y, -6.25], axis: 'x', auto: true, module: 'storage' },
  // Nuevas compuertas de la expansión.
  { id: 'evaprep', position: [-1.8, DOOR_Y, 4.2], axis: 'x', auto: true, module: 'evaprep' },
  { id: 'evaprep_dorms', position: [-8.5, DOOR_Y, 4.2], axis: 'x', auto: true, module: 'evaprep' },
  { id: 'medbay', position: [-8.5, DOOR_Y, -1.5], axis: 'x', auto: true, module: 'medbay' },
  { id: 'medbay_dorms', position: [-12, DOOR_Y, 1.5], axis: 'z', auto: true, module: 'dorms' },
  { id: 'mess_medbay', position: [-15, DOOR_Y, -1.5], axis: 'x', auto: true, module: 'mess' },
  { id: 'mess_dorms', position: [-15, DOOR_Y, 4.5], axis: 'x', auto: true, module: 'mess' },
  { id: 'hangar_link', position: [8.5, DOOR_Y, 0], axis: 'x', auto: true, module: 'hangar_link' },
  { id: 'hangar', position: [10.5, DOOR_Y, 0], axis: 'x', auto: true, module: 'hangar' },
  { id: 'northlink', position: [6, DOOR_Y, -8], axis: 'z', auto: true, module: 'northlink' },
  { id: 'engineering', position: [6, DOOR_Y, -15], axis: 'z', auto: true, module: 'engineering' },
  { id: 'power', position: [0, DOOR_Y, -18.5], axis: 'x', auto: true, module: 'power' },
  { id: 'life', position: [9, DOOR_Y, -18.5], axis: 'x', auto: true, module: 'life' },
  { id: 'workshop', position: [16, DOOR_Y, -18.5], axis: 'x', auto: true, module: 'workshop' },
];

/* --------------------------------------------------------------- materiales */

function material(name, options) {
  const mat = new THREE.MeshStandardMaterial(options);
  mat.name = name;
  return mat;
}

const M = {
  int_hull: material('int_hull', { color: 0xdde6f2, metalness: 0.35, roughness: 0.62 }),
  int_panel: material('int_panel', { color: 0x93a4ba, metalness: 0.55, roughness: 0.42 }),
  int_floor: material('int_floor', { color: 0x59657a, metalness: 0.3, roughness: 0.82 }),
  int_trim: material('int_trim', { color: 0x1e2733, metalness: 0.85, roughness: 0.32 }),
  int_fabric: material('int_fabric', { color: 0x232a36, metalness: 0.05, roughness: 0.95 }),
  int_glass: material('int_glass', {
    color: 0x9fd8ff,
    metalness: 0.15,
    roughness: 0.05,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
  }),
  int_accent: material('int_accent', {
    color: 0x5ff0ff,
    emissive: 0x5ff0ff,
    emissiveIntensity: 2.4,
    metalness: 0.2,
    roughness: 0.35,
  }),
  int_amber: material('int_amber', {
    color: 0xffb347,
    emissive: 0xff8a1e,
    emissiveIntensity: 1.8,
    metalness: 0.2,
    roughness: 0.4,
  }),
  int_screen: material('int_screen', { color: 0x0a1a24, emissive: 0x0a1a24 }),
  int_radar: material('int_radar', { color: 0x0a1a24, emissive: 0x0a1a24 }),
  int_door: material('int_door', { color: 0xa8b8cc, metalness: 0.7, roughness: 0.4 }),
};

/* ------------------------------------------------------------------ builder */

class Builder {
  constructor() {
    this.parts = [];
    this.boxes = [];
  }

  add(geometry, mat, position, quaternion = null, collider = null, module = null) {
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3(...position),
      quaternion ?? new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1)
    );
    const transformed = geometry.clone().applyMatrix4(matrix);
    geometry.dispose();
    this.parts.push({ geometry: transformed, material: mat });

    if (collider) {
      const euler = new THREE.Euler().setFromQuaternion(quaternion ?? new THREE.Quaternion());
      this.boxes.push({
        p: position.map((v) => Number(v.toFixed(3))),
        h: collider.map((v) => Number(v.toFixed(3))),
        r: [euler.x, euler.y, euler.z].map((v) => Number(v.toFixed(3))),
        module,
      });
    }
  }

  box(w, h, d, mat, x, y, z, options = {}) {
    const euler = new THREE.Euler(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0);
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    this.add(
      new THREE.BoxGeometry(w, h, d),
      mat,
      [x, y, z],
      quaternion,
      options.collide ? [w / 2, h / 2, d / 2] : null,
      options.module
    );
  }

  cylinder(radiusTop, radiusBottom, height, segments, mat, x, y, z, options = {}) {
    const euler = new THREE.Euler(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0);
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const r = Math.max(radiusTop, radiusBottom);
    this.add(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      mat,
      [x, y, z],
      quaternion,
      options.collide ? [r, height / 2, r] : null,
      options.module
    );
  }

  circle(radius, segments, mat, x, y, z, options = {}) {
    const euler = new THREE.Euler(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0);
    this.add(
      new THREE.CircleGeometry(radius, segments),
      mat,
      [x, y, z],
      new THREE.Quaternion().setFromEuler(euler),
      null,
      options.module
    );
  }

  torus(radius, tube, radialSegments, tubularSegments, mat, x, y, z, options = {}) {
    const euler = new THREE.Euler(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0);
    this.add(
      new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
      mat,
      [x, y, z],
      new THREE.Quaternion().setFromEuler(euler),
      null,
      options.module
    );
  }

  beam(from, to, radius, mat) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );
    this.add(
      new THREE.CylinderGeometry(radius, radius, length, 8),
      mat,
      [mid.x, mid.y, mid.z],
      quaternion
    );
  }

  build(name) {
    const byMaterial = new Map();
    for (const part of this.parts) {
      const key = part.material.name;
      if (!byMaterial.has(key)) byMaterial.set(key, { material: part.material, geometries: [] });
      byMaterial.get(key).geometries.push(part.geometry);
    }

    const group = new THREE.Group();
    group.name = name;

    for (const { material: mat, geometries } of byMaterial.values()) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error(`No se pudo fusionar el material ${mat.name}`);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${name}_${mat.name}`;
      group.add(mesh);
      for (const geometry of geometries) geometry.dispose();
    }

    return group;
  }
}

/* ------------------------------------------------------------------ paredes */

function wallZ(b, mat, x, z0, z1, y0 = FLOOR, y1 = CEIL, module = null) {
  if (z1 - z0 <= 0.001) return;
  b.box(T, y1 - y0, z1 - z0, mat, x, (y0 + y1) / 2, (z0 + z1) / 2, {
    collide: true,
    module,
  });
}

function wallX(b, mat, z, x0, x1, y0 = FLOOR, y1 = CEIL, module = null) {
  if (x1 - x0 <= 0.001) return;
  b.box(x1 - x0, y1 - y0, T, mat, (x0 + x1) / 2, (y0 + y1) / 2, z, {
    collide: true,
    module,
  });
}

function slab(b, mat, x0, x1, z0, z1, y, thickness, module) {
  b.box(x1 - x0, thickness, z1 - z0, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, {
    collide: true,
    module,
  });
}

/**
 * Pared en Z con huecos de puerta. Cada hueco deja el vano libre hasta
 * DOOR_TOP y construye el dintel por encima, de modo que el collider y la
 * geometría visual coinciden exactamente.
 */
function wallZRun(b, mat, x, z0, z1, openings, module, y0 = FLOOR, y1 = CEIL) {
  const list = [...openings].sort((a, c) => a.center - c.center);
  let cursor = z0;
  for (const opening of list) {
    const start = opening.center - opening.width / 2;
    const end = opening.center + opening.width / 2;
    if (start > cursor + 0.001) {
      b.box(T, y1 - y0, start - cursor, mat, x, (y0 + y1) / 2, (cursor + start) / 2, {
        collide: true,
        module,
      });
    }
    if (y1 > DOOR_TOP + 0.001) {
      b.box(T, y1 - DOOR_TOP, end - start, mat, x, (DOOR_TOP + y1) / 2, opening.center, {
        collide: true,
        module,
      });
    }
    cursor = end;
  }
  if (z1 > cursor + 0.001) {
    b.box(T, y1 - y0, z1 - cursor, mat, x, (y0 + y1) / 2, (cursor + z1) / 2, {
      collide: true,
      module,
    });
  }
}

/** Pared en X con huecos de puerta. */
function wallXRun(b, mat, z, x0, x1, openings, module, y0 = FLOOR, y1 = CEIL) {
  const list = [...openings].sort((a, c) => a.center - c.center);
  let cursor = x0;
  for (const opening of list) {
    const start = opening.center - opening.width / 2;
    const end = opening.center + opening.width / 2;
    if (start > cursor + 0.001) {
      b.box(start - cursor, y1 - y0, T, mat, (cursor + start) / 2, (y0 + y1) / 2, z, {
        collide: true,
        module,
      });
    }
    if (y1 > DOOR_TOP + 0.001) {
      b.box(end - start, y1 - DOOR_TOP, T, mat, opening.center, (DOOR_TOP + y1) / 2, z, {
        collide: true,
        module,
      });
    }
    cursor = end;
  }
  if (x1 > cursor + 0.001) {
    b.box(x1 - cursor, y1 - y0, T, mat, (cursor + x1) / 2, (y0 + y1) / 2, z, {
      collide: true,
      module,
    });
  }
}

/** Marco de puerta: jambas + dintel. */
function doorFrame(b, mat, door) {
  const [x, y, z] = door.position;
  const module = door.module;
  if (door.axis === 'z') {
    b.box(DOOR_W + 0.26, 0.1, 0.32, mat, x, DOOR_TOP + 0.05, z, { module });
    b.box(0.1, DOOR_H, 0.32, mat, x - DOOR_W / 2 - 0.06, y, z, { module });
    b.box(0.1, DOOR_H, 0.32, mat, x + DOOR_W / 2 + 0.06, y, z, { module });
  } else {
    b.box(0.32, 0.1, DOOR_W + 0.26, mat, x, DOOR_TOP + 0.05, z, { module });
    b.box(0.32, DOOR_H, 0.1, mat, x, y, z - DOOR_W / 2 - 0.06, { module });
    b.box(0.32, DOOR_H, 0.1, mat, x, y, z + DOOR_W / 2 + 0.06, { module });
  }
}

/* ------------------------------------------------------------------ módulos */

function buildCorridor(b) {
  const m = 'corridor';
  const x = 1.5 + T / 2;

  slab(b, M.int_floor, -1.5 - T, 1.5 + T, -8, 2.4, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, -1.5 - T, 1.5 + T, -8, 2.4, CEIL + T / 2, T, m);

  // Pared oeste: puerta del laboratorio en z = -1.5.
  wallZ(b, M.int_hull, -x, -8, -2.4, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, -x, -0.6, 2.4, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, -x, -2.4, -0.6, DOOR_TOP, CEIL, m);

  // Pared este: puertas de operaciones (z = -1.5) y almacén (z = -6.25).
  wallZ(b, M.int_hull, x, -8, -7.15, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, x, -5.35, -2.4, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, x, -0.6, 2.4, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, x, -7.15, -5.35, DOOR_TOP, CEIL, m);
  wallZ(b, M.int_hull, x, -2.4, -0.6, DOOR_TOP, CEIL, m);

  for (const door of DOORS.filter((d) => d.module === 'corridor')) doorFrame(b, M.int_trim, door);

  // Guías del suelo y costillas del techo.
  for (const side of [-1, 1]) {
    b.box(0.5, 0.025, 10.1, M.int_trim, side * 0.82, FLOOR + 0.012, -2.8, { module: m });
  }
  for (let z = -7.4; z <= 2; z += 1.9) {
    b.box(3.2, 0.07, 0.1, M.int_trim, 0, CEIL - 0.02, z, { module: m });
  }
  for (const side of [-1, 1]) {
    b.box(0.18, 0.05, 9.6, M.int_accent, side * 0.85, CEIL - 0.04, -2.8, { module: m });
  }
  // Conductos y paneles murales.
  for (const side of [-1, 1]) {
    b.box(0.16, 0.22, 9.6, M.int_trim, side * 1.36, CEIL - 0.24, -2.8, { module: m });
    b.box(0.06, 0.5, 1.6, M.int_panel, side * 1.47, -8.9, -4.6, { module: m });
    b.box(0.06, 0.5, 1.6, M.int_panel, side * 1.47, -8.9, 0.8, { module: m });
  }
}

function buildCockpit(b) {
  const m = 'cockpit';
  const x0 = -4.5;
  const x1 = 4.5;
  const z0 = -15;
  const z1 = -8;

  slab(b, M.int_floor, x0 - T, x1 + T, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0 - T, x1 + T, z0, z1, CEIL + T / 2, T, m);

  wallZ(b, M.int_hull, x0 - T / 2, z0, z1, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, x1 + T / 2, z0, z1, FLOOR, CEIL, m);

  // Ventanas panorámicas frontales.
  const winY0 = -9.1;
  const winY1 = -7.9;
  const windowXs = [-2.9, 0, 2.9];
  wallX(b, M.int_hull, z0 - T / 2, x0, -3.95, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, -1.85, -1.05, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, 1.05, 1.85, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, 3.95, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, -3.95, 3.95, FLOOR, winY0, m);
  wallX(b, M.int_hull, z0 - T / 2, -3.95, 3.95, winY1, CEIL, m);

  for (const cx of windowXs) {
    b.box(2.1, winY1 - winY0, 0.06, M.int_glass, cx, (winY0 + winY1) / 2, z0 + 0.02, {
      collide: true,
      module: m,
    });
    b.box(2.24, 0.08, 0.2, M.int_trim, cx, winY0, z0 + 0.03, { module: m });
    b.box(2.24, 0.08, 0.2, M.int_trim, cx, winY1, z0 + 0.03, { module: m });
    b.box(0.08, winY1 - winY0, 0.2, M.int_trim, cx - 1.05, (winY0 + winY1) / 2, z0 + 0.03, { module: m });
    b.box(0.08, winY1 - winY0, 0.2, M.int_trim, cx + 1.05, (winY0 + winY1) / 2, z0 + 0.03, { module: m });
  }

  // Ventanas laterales.
  for (const side of [-1, 1]) {
    const wx = side * (4.5 + T / 2);
    b.box(0.06, 1.1, 2.2, M.int_glass, wx, -8.5, -11.8, { collide: true, module: m });
    b.box(0.2, 0.08, 2.34, M.int_trim, wx, -9.05, -11.8, { module: m });
    b.box(0.2, 0.08, 2.34, M.int_trim, wx, -7.95, -11.8, { module: m });
    b.box(0.2, 1.1, 0.08, M.int_trim, wx, -8.5, -12.95, { module: m });
    b.box(0.2, 1.1, 0.08, M.int_trim, wx, -8.5, -10.65, { module: m });
  }

  // Pared trasera compartida con el pasillo (hueco de puerta central).
  wallX(b, M.int_hull, z1 + T / 2, x0, -0.9, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, 0.9, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, -0.9, 0.9, DOOR_TOP, CEIL, m);

  // Consola principal.
  b.box(7.4, 0.14, 0.95, M.int_panel, 0, -9.5, -13.25, { collide: true, module: m });
  b.box(0.22, 0.9, 0.8, M.int_trim, -3.5, -9.97, -13.25, { collide: true, module: m });
  b.box(0.22, 0.9, 0.8, M.int_trim, 3.5, -9.97, -13.25, { collide: true, module: m });
  b.box(7.2, 0.5, 0.12, M.int_panel, 0, -9.1, -13.7, { rx: -0.3, module: m });
  b.box(7.2, 0.06, 0.16, M.int_accent, 0, -8.86, -13.74, { rx: -0.3, module: m });

  // Pantallas de la consola.
  for (const cx of [-2.45, 0, 2.45]) {
    b.box(0.98, 0.56, 0.04, M.int_screen, cx, -9.02, -13.63, { rx: -0.3, module: m });
    b.box(1.06, 0.64, 0.03, M.int_trim, cx, -9.02, -13.66, { rx: -0.3, module: m });
  }

  // Radar.
  b.circle(0.42, 24, M.int_radar, 3.3, -8.98, -13.6, { rx: -0.3, module: m });
  b.torus(0.46, 0.035, 6, 20, M.int_trim, 3.3, -8.98, -13.58, { rx: -0.3, module: m });

  // Asientos.
  for (const cx of [-2.2, 0, 2.2]) {
    b.box(0.68, 0.16, 0.62, M.int_fabric, cx, -10.16, -12.35, { module: m });
    b.cylinder(0.1, 0.13, 0.36, 8, M.int_trim, cx, -10.38, -12.35, { module: m });
    b.box(0.68, 0.82, 0.16, M.int_fabric, cx, -9.72, -12.68, { rx: 0.08, module: m });
    b.box(0.42, 0.24, 0.14, M.int_fabric, cx, -9.22, -12.7, { rx: 0.08, module: m });
    for (const side of [-1, 1]) {
      b.box(0.09, 0.1, 0.5, M.int_trim, cx + side * 0.38, -9.98, -12.35, { module: m });
    }
  }

  // Paneles superiores e indicadores.
  for (const cx of [-3.2, -1.6, 0, 1.6, 3.2]) {
    b.box(0.9, 0.06, 0.3, M.int_panel, cx, CEIL - 0.08, -10.6, { module: m });
    b.box(0.12, 0.03, 0.12, M.int_accent, cx, CEIL - 0.11, -10.6, { module: m });
  }
  for (const cx of [-3.4, 3.4]) {
    b.box(0.5, 0.7, 0.5, M.int_trim, cx, -9.95, -9.3, { collide: true, module: m });
    b.box(0.36, 0.1, 0.36, M.int_panel, cx, -9.55, -9.3, { module: m });
  }

  // Rieles de luz longitudinales: no cruzan la vista desde los asientos.
  for (const cx of [-2.9, 2.9]) {
    b.box(0.22, 0.05, 6.2, M.int_accent, cx, CEIL - 0.05, -11.5, { module: m });
  }
}

function buildOps(b) {
  const m = 'ops';
  const x0 = 1.5;
  const x1 = 8.5;
  const z0 = -4.5;
  const z1 = 1.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallZRun(b, M.int_hull, x1 + T / 2, z0, z1, [{ center: 0, width: DOOR_W }], m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);

  // Mesa holográfica.
  b.cylinder(0.5, 0.62, 0.85, 10, M.int_trim, 5.2, -9.98, -1.5, { collide: true, module: m });
  b.cylinder(1.3, 1.3, 0.08, 20, M.int_panel, 5.2, -9.52, -1.5, { collide: true, module: m });
  b.torus(1.05, 0.035, 6, 24, M.int_accent, 5.2, -9.46, -1.5, { rx: Math.PI / 2, module: m });
  b.torus(0.55, 0.025, 6, 18, M.int_accent, 5.2, -9.44, -1.5, { rx: Math.PI / 2, module: m });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    b.box(0.12, 0.1, 0.12, M.int_accent, 5.2 + Math.cos(angle) * 1.16, -9.46, -1.5 + Math.sin(angle) * 1.16, { module: m });
  }

  // Consolas perimetrales.
  for (const cz of [-3.5, -1.5, 0.5]) {
    b.box(0.7, 0.14, 1.25, M.int_panel, 8.05, -9.5, cz, { collide: true, module: m });
    b.box(0.55, 0.9, 1.1, M.int_trim, 8.15, -9.97, cz, { collide: true, module: m });
    b.box(0.05, 0.5, 0.86, M.int_screen, 7.98, -9.02, cz, { ry: -Math.PI / 2, module: m });
    b.box(0.08, 0.06, 0.86, M.int_accent, 7.96, -8.74, cz, { module: m });
  }

  // Pantalla mural y estanterías.
  b.box(1.9, 1.0, 0.06, M.int_screen, 5.2, -8.6, z1 - 0.06, { ry: Math.PI, module: m });
  b.box(2.0, 1.1, 0.04, M.int_trim, 5.2, -8.6, z1 - 0.09, { ry: Math.PI, module: m });
  for (const cx of [2.4, 3.4]) {
    b.box(0.8, 1.6, 0.4, M.int_trim, cx, -9.6, z1 - 0.25, { collide: true, module: m });
    for (let i = 0; i < 3; i++) {
      b.box(0.72, 0.04, 0.34, M.int_panel, cx, -10.2 + i * 0.45, z1 - 0.25, { module: m });
    }
  }

  // Taquillas.
  for (const cx of [2.1, 2.8, 3.5, 4.2]) {
    b.box(0.62, 1.75, 0.45, M.int_panel, cx, -9.52, z0 + 0.3, { collide: true, module: m });
    b.box(0.06, 0.12, 0.06, M.int_accent, cx + 0.22, -9.6, z0 + 0.54, { module: m });
  }

  // Rieles longitudinales sobre la mesa holográfica.
  for (const cx of [3.3, 5.0, 6.7]) {
    b.box(0.22, 0.05, 5.6, M.int_accent, cx, CEIL - 0.05, -1.5, { module: m });
  }
}

function buildLab(b) {
  const m = 'lab';
  const x0 = -8.5;
  const x1 = -1.5;
  const z0 = -4.5;
  const z1 = 1.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallZRun(b, M.int_hull, x0 - T / 2, z0, z1, [{ center: -1.5, width: DOOR_W }], m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);

  // Bancos de trabajo.
  b.box(0.9, 0.12, 4.6, M.int_panel, -7.85, -9.5, -1.5, { collide: true, module: m });
  b.box(0.7, 0.9, 4.4, M.int_trim, -8.15, -9.97, -1.5, { collide: true, module: m });
  b.box(0.05, 0.5, 0.9, M.int_screen, -7.36, -9.02, -3.0, { ry: Math.PI / 2, module: m });
  b.box(0.05, 0.5, 0.9, M.int_screen, -7.36, -9.02, -0.2, { ry: Math.PI / 2, module: m });

  // Equipos y muestras.
  for (let i = 0; i < 3; i++) {
    b.box(0.7, 0.5, 0.7, M.int_trim, -7.7, -9.05, 0.2 - i * 1.4, { collide: true, module: m });
    b.cylinder(0.1, 0.1, 0.42, 8, M.int_accent, -7.7, -8.85, 0.2 - i * 1.4, { module: m });
  }
  for (let i = 0; i < 4; i++) {
    b.cylinder(0.16, 0.16, 0.55, 10, M.int_glass, -6.6, -9.98, 0.9 - i * 0.6, { collide: true, module: m });
    b.cylinder(0.18, 0.18, 0.06, 10, M.int_trim, -6.6, -9.68, 0.9 - i * 0.6, { module: m });
  }
  b.box(1.6, 0.14, 1.2, M.int_panel, -4.0, -9.5, 0.4, { collide: true, module: m });
  b.box(1.4, 0.9, 1.0, M.int_trim, -4.0, -9.97, 0.4, { collide: true, module: m });
  b.box(1.1, 0.06, 0.7, M.int_screen, -4.0, -9.41, 0.4, { module: m });

  // Estantería de muestras en la pared sur.
  for (const cx of [-7.8, -6.9, -6.0, -5.1]) {
    b.box(0.8, 1.7, 0.42, M.int_trim, cx, -9.55, z0 + 0.28, { collide: true, module: m });
    for (let i = 0; i < 3; i++) {
      b.box(0.72, 0.04, 0.36, M.int_panel, cx, -10.2 + i * 0.45, z0 + 0.28, { module: m });
      b.box(0.14, 0.16, 0.14, M.int_accent, cx - 0.18 + (i % 2) * 0.3, -10.1 + i * 0.45, z0 + 0.28, { module: m });
    }
  }

  // Rieles longitudinales sobre los bancos.
  for (const cx of [-6.7, -5.0, -3.3]) {
    b.box(0.22, 0.05, 5.6, M.int_accent, cx, CEIL - 0.05, -1.5, { module: m });
  }
}

function buildStorage(b) {
  const m = 'storage';
  const x0 = 1.5;
  const x1 = 7.5;
  const z0 = -8;
  const z1 = -4.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallZ(b, M.int_hull, x1 + T / 2, z0, z1, FLOOR, CEIL, m);
  wallXRun(b, M.int_hull, z0 - T / 2, 4.5, x1, [{ center: 6, width: DOOR_W }], m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);

  // Estanterías en las paredes norte y sur.
  for (const cz of [z0 + 0.35, z1 - 0.35]) {
    for (const cx of [2.4, 3.5, 4.6, 5.7, 6.8]) {
      b.box(0.08, 2.2, 0.08, M.int_trim, cx - 0.45, -9.3, cz, { module: m });
      b.box(0.08, 2.2, 0.08, M.int_trim, cx + 0.45, -9.3, cz, { module: m });
      for (let i = 0; i < 3; i++) {
        b.box(0.98, 0.05, 0.5, M.int_panel, cx, -10.25 + i * 0.62, cz, { collide: i === 0, module: m });
      }
    }
  }

  // Cajas y contenedores.
  const crates = [
    [2.6, -10.1, -6.9, 0.9, 0.6, 0.7],
    [3.7, -10.1, -6.9, 0.7, 0.6, 0.6],
    [5.2, -10.1, -5.7, 0.8, 0.6, 0.8],
    [6.2, -10.1, -5.7, 0.6, 0.6, 0.6],
    [4.4, -9.55, -7.0, 0.7, 0.5, 0.55],
  ];
  for (const [cx, cy, cz, w, h, d] of crates) {
    b.box(w, h, d, M.int_panel, cx, cy, cz, { collide: true, module: m });
    b.box(w * 0.82, 0.04, d * 0.82, M.int_amber, cx, cy + h / 2 + 0.025, cz, { module: m });
  }

  // Botellas de gas.
  for (let i = 0; i < 4; i++) {
    b.cylinder(0.17, 0.17, 0.85, 10, M.int_trim, 6.9, -9.95, -7.4 + i * 0.5, { collide: true, module: m });
    b.cylinder(0.08, 0.08, 0.16, 8, M.int_accent, 6.9, -9.45, -7.4 + i * 0.5, { module: m });
  }

  // Panel de herramientas.
  b.box(0.06, 1.4, 2.2, M.int_trim, x1 - 0.08, -8.9, -6.25, { module: m });
  for (let i = 0; i < 5; i++) {
    b.box(0.05, 0.5, 0.08, M.int_panel, x1 - 0.12, -8.9, -7.15 + i * 0.45, { module: m });
  }

  // Rieles longitudinales entre estanterías.
  for (const cx of [3.2, 5.8]) {
    b.box(0.22, 0.05, 3.2, M.int_accent, cx, CEIL - 0.05, -6.25, { module: m });
  }
}

function buildAirlock(b) {
  const m = 'airlock';
  const x0 = -1.8;
  const x1 = 1.8;
  const z0 = 2.4;
  const z1 = 5.6;

  slab(b, M.int_floor, x0 - T, x1 + T, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0 - T, x1 + T, z0, z1, CEIL + T / 2, T, m);

  wallZRun(b, M.int_hull, x0 - T / 2, z0, z1, [{ center: 4.2, width: DOOR_W }], m);
  wallZ(b, M.int_hull, x1 + T / 2, z0, z1, FLOOR, CEIL, m);

  // Pared interior (hacia el pasillo) con hueco de puerta.
  wallX(b, M.int_hull, z0 - T / 2, x0, -0.9, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, 0.9, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, -0.9, 0.9, DOOR_TOP, CEIL, m);

  // Pared exterior con hueco de puerta.
  wallX(b, M.int_hull, z1 + T / 2, x0, -0.9, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, 0.9, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, -0.9, 0.9, DOOR_TOP, CEIL, m);

  // Collar exterior con franjas de peligro y luces guía.
  b.box(2.9, 0.28, 0.55, M.int_trim, 0, -8.05, z1 + 0.34, { module: m });
  b.box(2.9, 0.28, 0.55, M.int_trim, 0, -10.15, z1 + 0.34, { module: m });
  b.box(0.28, 2.9, 0.55, M.int_trim, -1.5, -9.1, z1 + 0.34, { module: m });
  b.box(0.28, 2.9, 0.55, M.int_trim, 1.5, -9.1, z1 + 0.34, { module: m });
  for (let i = 0; i < 6; i++) {
    b.box(0.34, 0.12, 0.06, M.int_amber, -0.85 + i * 0.34, -8.28, z1 + 0.62, { module: m });
    b.box(0.34, 0.12, 0.06, M.int_amber, -0.85 + i * 0.34, -9.92, z1 + 0.62, { module: m });
  }
  for (const sx of [-1.28, 1.28]) {
    for (const sy of [-8.25, -9.95]) {
      b.box(0.12, 0.12, 0.08, M.int_accent, sx, sy, z1 + 0.64, { module: m });
    }
  }
  b.torus(0.95, 0.05, 6, 24, M.int_accent, 0, -9.3, z1 + 0.64, { module: m });

  // Bancos y paneles interiores de la esclusa (retirados del vano oeste).
  for (const side of [-1, 1]) {
    b.box(0.35, 0.12, 1.5, M.int_panel, side * 1.45, -10.05, 3.05, { collide: true, module: m });
    b.box(0.06, 0.5, 1.2, M.int_screen, side * 1.6, -8.9, 3.05, { ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, module: m });
  }

  // Pasarela de servicio hacia la estación.
  b.beam([0, -3.55, 0], [0, -7.55, 4.0], 0.36, M.int_trim);
  b.beam([-1.1, -3.55, 0.2], [-1.1, -7.55, 4.0], 0.12, M.int_trim);
  b.beam([1.1, -3.55, 0.2], [1.1, -7.55, 4.0], 0.12, M.int_trim);
  b.beam([0, -7.55, 4.0], [0, -7.55, 5.6], 0.24, M.int_trim);

  // Luces del techo.
  b.box(1.5, 0.05, 0.24, M.int_accent, 0, CEIL - 0.05, 3.2, { module: m });
  b.box(1.5, 0.05, 0.24, M.int_accent, 0, CEIL - 0.05, 4.9, { module: m });
}

/* --------------------------------------------------------- expansión este */

function buildHangarLink(b) {
  const m = 'hangar_link';
  const x0 = 8.5;
  const x1 = 10.5;
  const z0 = -1.5;
  const z1 = 1.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  // Paredes norte y sur; los extremos los cierran operaciones y el hangar.
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);

  for (const side of [-1, 1]) {
    b.box(0.18, 0.05, 2.6, M.int_accent, 9.5, CEIL - 0.04, side * 0.9, { module: m });
  }
  b.box(1.6, 0.06, 0.24, M.int_trim, 9.5, CEIL - 0.02, 0, { module: m });
}

function buildHangar(b) {
  const m = 'hangar';
  const x0 = 10.5;
  const x1 = 30;
  const z0 = -14;
  const z1 = 4;
  const top = HANGAR_CEIL;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, top + T / 2, T, m);

  // Envolvente. El vano de entrada queda en el centro del muro oeste.
  wallZRun(b, M.int_hull, x0 - T / 2, z0, z1, [{ center: 0, width: DOOR_W }], m, FLOOR, top);
  wallZ(b, M.int_hull, x1 + T / 2, z0, z1, FLOOR, top, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, top, m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, top, m);

  // Plataforma de aterrizaje pintada (sin resalte: no debe tropezar).
  b.box(12.4, 0.02, 10.2, M.int_panel, 20, FLOOR + 0.012, -3, { module: m });
  for (let i = 0; i < 9; i++) {
    b.box(0.22, 0.025, 7.4, M.int_amber, 15.2 + i * 1.2, FLOOR + 0.03, -3, { module: m });
  }
  b.torus(2.4, 0.06, 6, 28, M.int_amber, 20, FLOOR + 0.035, -3, { rx: Math.PI / 2, module: m });

  // Rieles de la cuna de la nave.
  for (const side of [-1, 1]) {
    b.box(13.6, 0.08, 0.18, M.int_trim, 20, FLOOR + 0.05, -3 + side * 1.9, { module: m });
    for (let i = 0; i < 5; i++) {
      b.box(0.5, 0.18, 0.4, M.int_trim, 14.4 + i * 2.8, FLOOR + 0.09, -3 + side * 1.9, { module: m });
    }
  }

  // Puerta exterior de hangar (visual): dos hojas con franjas de peligro.
  for (const side of [-1, 1]) {
    b.box(0.18, 3.4, 5.6, M.int_panel, x1 - 0.22, FLOOR + 1.7, side * 3.0, { module: m });
    for (let i = 0; i < 5; i++) {
      b.box(0.08, 0.2, 4.9, M.int_amber, x1 - 0.32, FLOOR + 0.5 + i * 0.68, side * 3.0, { module: m });
    }
  }
  b.box(0.24, 0.3, 11.6, M.int_trim, x1 - 0.2, FLOOR + 3.55, 0, { module: m });

  // Vigas y carriles de grúa en el techo.
  for (const z of [-10, -3, 4 - 1]) {
    b.box(19.2, 0.24, 0.3, M.int_trim, 20.25, top - 0.2, z, { module: m });
  }
  for (const x of [13, 20, 27]) {
    b.box(0.26, 0.26, 17.4, M.int_trim, x, top - 0.2, -5, { module: m });
    b.box(0.1, 0.5, 0.1, M.int_trim, x, top - 0.55, -3, { module: m });
    b.box(0.7, 0.14, 0.7, M.int_trim, x, top - 0.85, -3, { module: m });
  }

  // Armarios y cajas en el perímetro, lejos de la cuna.
  for (const z of [-12.4, -10.8, 1.2, 2.6]) {
    b.box(1.2, 1.9, 0.7, M.int_panel, 11.2, FLOOR + 0.95, z, { collide: true, module: m });
    b.box(1.0, 0.06, 0.6, M.int_amber, 11.2, FLOOR + 1.4, z, { module: m });
  }
  for (const [x, z, w, d] of [[12.4, -3.0, 1.2, 1.1], [27.6, -11.4, 1.5, 1.2], [27.4, 2.2, 1.3, 1.0]]) {
    b.box(w, 1.0, d, M.int_trim, x, FLOOR + 0.5, z, { collide: true, module: m });
    b.box(w * 0.9, 0.05, d * 0.9, M.int_amber, x, FLOOR + 1.03, z, { module: m });
  }

  // Iluminación técnica.
  for (const x of [14, 20, 26]) {
    b.box(4.6, 0.08, 0.3, M.int_accent, x, top - 0.08, -7.5, { module: m });
    b.box(4.6, 0.08, 0.3, M.int_accent, x, top - 0.08, 1.5, { module: m });
  }
}

/* --------------------------------------------------------- expansión norte */

function buildNorthLink(b) {
  const m = 'northlink';
  const x0 = 4.5;
  const x1 = 7.5;
  const z0 = -15;
  const z1 = -8;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  // Oeste: pared este del puente. Sur: almacén. Norte: ingeniería.
  wallZ(b, M.int_hull, x1 + T / 2, z0, z1, FLOOR, CEIL, m);

  for (const side of [-1, 1]) {
    b.box(0.16, 0.24, 6.4, M.int_trim, side * 1.2 + 6, CEIL - 0.26, -11.5, { module: m });
  }
  for (let z = -14.2; z <= -8.6; z += 1.8) {
    b.box(2.8, 0.06, 0.12, M.int_trim, 6, CEIL - 0.03, z, { module: m });
  }
  b.box(0.22, 0.05, 6.4, M.int_accent, 6, CEIL - 0.05, -11.5, { module: m });
}

function buildEngineering(b) {
  const m = 'engineering';
  const x0 = 0;
  const x1 = 9;
  const z0 = -22;
  const z1 = -15;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallXRun(b, M.int_hull, z1 + T / 2, x0, x1, [{ center: 6, width: DOOR_W }], m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallZRun(b, M.int_hull, x0 - T / 2, z0, z1, [{ center: -18.5, width: DOOR_W }], m);
  wallZRun(b, M.int_hull, x1 + T / 2, z0, z1, [{ center: -18.5, width: DOOR_W }], m);

  // Generadores y cuadros eléctricos.
  for (const x of [2.0, 4.2, 7.0]) {
    b.cylinder(0.62, 0.62, 1.6, 12, M.int_trim, x, FLOOR + 0.8, -20.2, { collide: true, module: m });
    b.cylinder(0.7, 0.7, 0.12, 12, M.int_panel, x, FLOOR + 1.62, -20.2, { module: m });
    b.box(0.9, 0.08, 0.5, M.int_accent, x, FLOOR + 1.7, -20.2, { module: m });
  }
  for (const x of [1.2, 2.4, 3.6, 7.8]) {
    b.box(0.9, 1.5, 0.4, M.int_panel, x, FLOOR + 0.75, z1 - 0.3, { collide: true, module: m });
    b.box(0.55, 0.35, 0.04, M.int_screen, x, FLOOR + 1.15, z1 - 0.52, { ry: Math.PI, module: m });
    b.box(0.12, 0.05, 0.05, M.int_accent, x, FLOOR + 1.5, z1 - 0.52, { module: m });
  }
  // Tuberías y conductos.
  for (const y of [CEIL - 0.35, CEIL - 0.6]) {
    b.box(8.4, 0.14, 0.14, M.int_trim, 4.5, y, -21.2, { module: m });
  }
  for (const x of [2.5, 6.5]) {
    b.box(0.18, 0.05, 6.2, M.int_accent, x, CEIL - 0.05, -18.5, { module: m });
  }
}

function buildPower(b) {
  const m = 'power';
  const x0 = -9;
  const x1 = 0;
  const z0 = -22;
  const z1 = -15;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, x0 - T / 2, z0, z1, FLOOR, CEIL, m);

  // Núcleo de potencia y bancos de baterías.
  b.cylinder(1.05, 1.25, 2.0, 14, M.int_trim, -6.4, FLOOR + 1.0, -18.5, { collide: true, module: m });
  b.cylinder(0.9, 0.9, 0.1, 14, M.int_accent, -6.4, FLOOR + 2.06, -18.5, { module: m });
  b.torus(1.2, 0.05, 6, 22, M.int_amber, -6.4, FLOOR + 1.3, -18.5, { rx: Math.PI / 2, module: m });
  for (const x of [-3.4, -2.2, -1.0]) {
    b.box(1.0, 1.7, 0.55, M.int_panel, x, FLOOR + 0.85, -21.2, { collide: true, module: m });
    b.box(0.8, 0.08, 0.45, M.int_accent, x, FLOOR + 1.45, -21.2, { module: m });
  }
  b.box(4.2, 0.12, 0.8, M.int_trim, -3.2, FLOOR + 1.0, z1 - 0.5, { collide: true, module: m });
  b.box(3.8, 0.5, 0.06, M.int_screen, -3.2, FLOOR + 1.45, z1 - 0.92, { ry: Math.PI, module: m });
  for (const x of [-7.2, -3.2]) {
    b.box(0.2, 0.05, 5.8, M.int_accent, x, CEIL - 0.05, -18.5, { module: m });
  }
}

function buildLife(b) {
  const m = 'life';
  const x0 = 9;
  const x1 = 16;
  const z0 = -22;
  const z1 = -15;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallZRun(b, M.int_hull, x1 + T / 2, z0, z1, [{ center: -18.5, width: DOOR_W }], m);

  // Tanques de O2 y agua, filtros y colectores.
  for (let i = 0; i < 4; i++) {
    b.cylinder(0.5, 0.5, 2.2, 12, M.int_panel, 10.4 + i * 1.15, FLOOR + 1.1, -20.6, { collide: true, module: m });
    b.cylinder(0.54, 0.54, 0.12, 12, M.int_trim, 10.4 + i * 1.15, FLOOR + 2.26, -20.6, { module: m });
    b.box(0.7, 0.06, 0.2, M.int_accent, 10.4 + i * 1.15, FLOOR + 1.7, -20.0, { module: m });
  }
  for (const x of [9.9, 11.3, 12.7, 14.1]) {
    b.box(0.9, 1.2, 0.5, M.int_trim, x, FLOOR + 0.6, z1 - 0.4, { collide: true, module: m });
    b.box(0.7, 0.25, 0.04, M.int_screen, x, FLOOR + 0.95, z1 - 0.66, { ry: Math.PI, module: m });
  }
  b.box(5.6, 0.16, 0.16, M.int_trim, 12.5, CEIL - 0.4, -21.0, { module: m });
  for (const x of [10.5, 12.5, 14.5]) {
    b.box(0.18, 0.05, 5.8, M.int_accent, x, CEIL - 0.05, -18.5, { module: m });
  }
}

function buildWorkshop(b) {
  const m = 'workshop';
  const x0 = 16;
  const x1 = 24;
  const z0 = -22;
  const z1 = -15;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallZ(b, M.int_hull, x1 + T / 2, z0, z1, FLOOR, CEIL, m);

  // Bancos de trabajo, herramienta y piezas.
  for (const x of [18.0, 21.0]) {
    b.box(2.6, 0.16, 1.0, M.int_panel, x, FLOOR + 0.95, -20.4, { collide: true, module: m });
    b.box(2.4, 0.9, 0.8, M.int_trim, x, FLOOR + 0.45, -20.4, { collide: true, module: m });
    b.box(2.2, 0.05, 0.7, M.int_screen, x, FLOOR + 1.06, -20.4, { module: m });
  }
  b.box(0.08, 1.5, 4.6, M.int_trim, x1 - 0.2, FLOOR + 1.0, -18.5, { module: m });
  for (let i = 0; i < 7; i++) {
    b.box(0.06, 0.42, 0.08, M.int_panel, x1 - 0.28, FLOOR + 0.7 + (i % 3) * 0.4, -20.3 + i * 0.6, { module: m });
  }
  // Grúa de taller.
  b.box(6.2, 0.2, 0.22, M.int_trim, 20, CEIL - 0.35, -18.5, { module: m });
  b.box(0.08, 0.9, 0.08, M.int_trim, 20, CEIL - 0.85, -18.5, { module: m });
  b.box(0.4, 0.18, 0.4, M.int_amber, 20, CEIL - 1.35, -18.5, { module: m });
  for (const x of [18, 20, 22]) {
    b.box(0.18, 0.05, 5.6, M.int_accent, x, CEIL - 0.05, -18.5, { module: m });
  }
}

/* --------------------------------------------------------- expansión oeste */

function buildMedbay(b) {
  const m = 'medbay';
  const x0 = -15;
  const x1 = -8.5;
  const z0 = -4.5;
  const z1 = 1.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallXRun(b, M.int_hull, z1 + T / 2, x0, x1, [{ center: -12, width: DOOR_W }], m);

  // Camas médicas y monitores.
  for (const z of [-3.2, -1.2, 0.8]) {
    b.box(1.9, 0.18, 0.85, M.int_panel, -13.2, FLOOR + 0.55, z, { collide: true, module: m });
    b.box(0.7, 0.5, 0.7, M.int_trim, -14.1, FLOOR + 0.25, z, { collide: true, module: m });
    b.box(0.55, 0.38, 0.05, M.int_screen, -13.0, FLOOR + 1.15, z, { module: m });
    b.box(0.06, 0.55, 0.06, M.int_trim, -13.0, FLOOR + 0.85, z - 0.5, { module: m });
  }
  b.box(0.5, 1.7, 2.6, M.int_panel, -9.1, FLOOR + 0.85, -1.5, { collide: true, module: m });
  for (let i = 0; i < 3; i++) {
    b.box(0.05, 0.32, 0.55, M.int_screen, -9.36, FLOOR + 0.8 + i * 0.45, -1.5, { ry: Math.PI / 2, module: m });
  }
  for (const z of [-2.6, 0.4]) {
    b.box(0.18, 0.05, 4.2, M.int_accent, -11.5, CEIL - 0.05, z, { module: m });
  }
}

function buildDorms(b) {
  const m = 'dorms';
  const x0 = -15;
  const x1 = -8.5;
  const z0 = 1.5;
  const z1 = 7.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallZRun(b, M.int_hull, x1 + T / 2, z0, z1, [{ center: 4.2, width: DOOR_W }], m);

  // Literas dobles y taquillas.
  for (const x of [-14.0, -12.2, -10.4]) {
    b.box(1.5, 0.16, 2.0, M.int_fabric, x, FLOOR + 0.55, 6.2, { collide: true, module: m });
    b.box(1.5, 0.16, 2.0, M.int_fabric, x, FLOOR + 1.65, 6.2, { collide: true, module: m });
    b.box(0.12, 2.0, 2.0, M.int_trim, x - 0.78, FLOOR + 1.0, 6.2, { module: m });
    b.box(1.3, 0.12, 0.5, M.int_panel, x, FLOOR + 0.63, 6.95, { module: m });
  }
  for (const z of [2.3, 3.2, 5.4]) {
    b.box(0.6, 1.8, 0.55, M.int_panel, -14.5, FLOOR + 0.9, z, { collide: true, module: m });
    b.box(0.08, 0.12, 0.06, M.int_accent, -14.18, FLOOR + 1.1, z, { module: m });
  }
  b.box(2.4, 0.12, 1.1, M.int_panel, -11.5, FLOOR + 0.95, 3.4, { collide: true, module: m });
  b.box(2.2, 0.8, 0.9, M.int_trim, -11.5, FLOOR + 0.45, 3.4, { collide: true, module: m });
  for (const x of [-13.5, -11.5, -9.5]) {
    b.box(0.18, 0.05, 5.2, M.int_accent, x, CEIL - 0.05, 4.5, { module: m });
  }
}

function buildMess(b) {
  const m = 'mess';
  const x0 = -21;
  const x1 = -15;
  const z0 = -4.5;
  const z1 = 7.5;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallZ(b, M.int_hull, x0 - T / 2, z0, z1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  wallZRun(b, M.int_hull, x1 + T / 2, z0, z1, [
    { center: -1.5, width: DOOR_W },
    { center: 4.5, width: DOOR_W },
  ], m);

  // Mesas y bancos.
  for (const z of [-2.6, 0.4, 3.4]) {
    b.box(2.6, 0.12, 1.0, M.int_panel, -18.0, FLOOR + 0.92, z, { collide: true, module: m });
    b.box(0.18, 0.9, 0.18, M.int_trim, -19.1, FLOOR + 0.45, z, { module: m });
    b.box(0.18, 0.9, 0.18, M.int_trim, -16.9, FLOOR + 0.45, z, { module: m });
    for (const side of [-1, 1]) {
      b.box(2.2, 0.1, 0.4, M.int_fabric, -18.0, FLOOR + 0.55, z + side * 0.8, { collide: true, module: m });
    }
  }
  // Cocina y despensa.
  b.box(4.6, 0.16, 0.9, M.int_panel, -18.2, FLOOR + 0.95, z0 + 0.7, { collide: true, module: m });
  b.box(4.4, 0.9, 0.7, M.int_trim, -18.2, FLOOR + 0.45, z0 + 0.7, { collide: true, module: m });
  for (const x of [-19.6, -18.2, -16.8]) {
    b.box(0.5, 0.5, 0.05, M.int_screen, x, FLOOR + 1.3, z0 + 0.25, { ry: Math.PI, module: m });
  }
  b.box(0.6, 1.9, 2.4, M.int_panel, x0 + 0.35, FLOOR + 0.95, 5.0, { collide: true, module: m });
  for (const x of [-19.5, -18.0, -16.5]) {
    b.box(0.18, 0.05, 8.2, M.int_accent, x, CEIL - 0.05, 1.5, { module: m });
  }
}

function buildEvaPrep(b) {
  const m = 'evaprep';
  const x0 = -8.5;
  const x1 = -1.8;
  const z0 = 2.4;
  const z1 = 6.0;

  slab(b, M.int_floor, x0, x1, z0, z1, FLOOR - T / 2, T, m);
  slab(b, M.int_panel, x0, x1, z0, z1, CEIL + T / 2, T, m);

  wallX(b, M.int_hull, z0 - T / 2, x0, x1, FLOOR, CEIL, m);
  wallX(b, M.int_hull, z1 + T / 2, x0, x1, FLOOR, CEIL, m);
  // El tramo contiguo a la esclusa lo construye la esclusa; aquí sólo el
  // pequeño cierre que queda al norte de ella.
  wallZ(b, M.int_hull, x1 + T / 2, 5.6, 6.0, FLOOR, CEIL, m);

  // Taquillas de trajes EVA.
  for (const x of [-7.8, -6.7, -5.6, -4.5, -3.4, -2.3]) {
    b.box(0.9, 1.9, 0.55, M.int_panel, x, FLOOR + 0.95, z1 - 0.35, { collide: true, module: m });
    b.box(0.06, 0.5, 0.4, M.int_screen, x, FLOOR + 1.25, z1 - 0.65, { ry: Math.PI, module: m });
    b.box(0.08, 0.12, 0.06, M.int_accent, x + 0.32, FLOOR + 1.0, z1 - 0.65, { module: m });
  }
  // Banco de preparación y monitor de esclusa.
  b.box(3.6, 0.14, 0.6, M.int_panel, -6.2, FLOOR + 0.55, 2.9, { collide: true, module: m });
  b.box(0.16, 0.9, 0.16, M.int_trim, -7.8, FLOOR + 0.28, 2.9, { module: m });
  b.box(0.16, 0.9, 0.16, M.int_trim, -4.6, FLOOR + 0.28, 2.9, { module: m });
  b.box(0.8, 0.5, 0.06, M.int_screen, -2.4, FLOOR + 1.45, 4.2, { ry: -Math.PI / 2, module: m });
  b.box(0.9, 0.06, 0.08, M.int_amber, -2.4, FLOOR + 1.74, 4.2, { module: m });
  for (const x of [-7.0, -5.0, -3.0]) {
    b.box(0.18, 0.05, 3.0, M.int_accent, x, CEIL - 0.05, 4.2, { module: m });
  }
}

/* -------------------------------------------------------------------- build */

function buildHabitat() {
  const b = new Builder();
  buildAirlock(b);
  buildCorridor(b);
  buildCockpit(b);
  buildOps(b);
  buildLab(b);
  buildStorage(b);
  // Expansión 3.2.
  buildHangarLink(b);
  buildHangar(b);
  buildNorthLink(b);
  buildEngineering(b);
  buildPower(b);
  buildLife(b);
  buildWorkshop(b);
  buildMedbay(b);
  buildDorms(b);
  buildMess(b);
  buildEvaPrep(b);
  // Marcos de todas las compuertas, una sola vez.
  for (const door of DOORS) doorFrame(b, M.int_trim, door);
  return b;
}

function buildDoor() {
  const b = new Builder();
  // Panel de 0.9 x 2.2 x 0.12 en un único material (1 draw call por panel).
  b.box(0.9, 2.2, 0.1, M.int_door, 0, 0, 0);
  b.box(0.9, 0.06, 0.12, M.int_door, 0, 0.95, 0);
  b.box(0.9, 0.06, 0.12, M.int_door, 0, -0.95, 0);
  b.box(0.06, 1.7, 0.11, M.int_door, 0.36, 0, 0);
  return b.build('door_panel');
}

async function exportGLB(group, file) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolveParse, reject) => {
    exporter.parse(group, resolveParse, reject, { binary: true, onlyVisible: true });
  });
  await writeFile(file, Buffer.from(arrayBuffer));
  return arrayBuffer.byteLength;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const habitat = buildHabitat();
  const habitatGroup = habitat.build('habitat');
  const habitatBytes = await exportGLB(habitatGroup, resolve(OUT, 'habitat.glb'));

  const doorGroup = buildDoor();
  const doorBytes = await exportGLB(doorGroup, resolve(OUT, 'door.glb'));

  let triangles = 0;
  let vertices = 0;
  for (const child of habitatGroup.children) {
    const geometry = child.geometry;
    vertices += geometry.attributes.position.count;
    triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  }

  const manifest = {
    version: 1,
    modules: MODULES,
    airlock: MODULES.airlock,
    boxes: habitat.boxes,
    doors: DOORS.map(({ id, position, axis, auto, module }) => ({
      id,
      position,
      axis,
      auto,
      module,
      width: DOOR_W,
      height: DOOR_H,
    })),
  };
  await writeFile(resolve(OUT, 'colliders.json'), JSON.stringify(manifest, null, 2));

  console.log(`habitat.glb  ${(habitatBytes / 1024).toFixed(1)} KB · ${triangles} triángulos · ${vertices} vértices · ${habitatGroup.children.length} draw calls`);
  console.log(`door.glb     ${(doorBytes / 1024).toFixed(1)} KB · ${doorGroup.children.length} draw calls`);
  console.log(`colliders    ${manifest.boxes.length} cajas · ${manifest.doors.length} puertas`);
}

await main();
