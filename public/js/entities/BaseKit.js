import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Kit de arquitectura de las bases planetarias.
 *
 * Toda la geometría decorativa se acumula por material y se fusiona al final
 * en una sola malla por material. Así una instalación con cientos de remates,
 * costillas, barandillas y tuberías cuesta 4-8 draw calls en vez de cientos,
 * que es lo que permite subir el detalle sin romper la UHD 620.
 *
 * El kit NO crea colisionadores: los colliders siguen viviendo en PlanetWorld
 * y no cambian. Aquí solo hay geometría visible.
 */

const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();

/* Materiales que proyectan sombra. Los remates finos y las tiras emisivas no
   aportan sombra legible y duplicarían la pasada de sombras sin ganancia. */
const SHADOW_KEYS = new Set([
  'hull',
  'regolith',
  'gold',
]);

export class Kit {
  /**
   * @param {Record<string, THREE.Material>} materials
   * @param {{atlas: {texture: THREE.Texture, cells: Array}, material: THREE.Material}|null} signs
   */
  constructor(materials, signs = null) {
    this.materials = materials;
    this.signs = signs;
    this.buckets = new Map();
  }

  _store(key, geometry) {
    let list = this.buckets.get(key);
    if (!list) {
      list = [];
      this.buckets.set(key, list);
    }
    list.push(geometry);
    return geometry;
  }

  /** Añade una geometría ya transformada. */
  _raw(key, geometry) {
    if (!geometry) return null;
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    return this._store(key, flat);
  }

  _add(key, geometry, position = [0, 0, 0], rotation = null, scale = null) {
    if (!this.materials[key]) return null;
    _euler.set(rotation?.[0] ?? 0, rotation?.[1] ?? 0, rotation?.[2] ?? 0);
    _quat.setFromEuler(_euler);
    _pos.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
    _scale.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1);
    _matrix.compose(_pos, _quat, _scale);
    geometry.applyMatrix4(_matrix);
    return this._raw(key, geometry);
  }

  /* ------------------------------------------------------------- primitivas */

  box(size, key, position, rotation) {
    return this._add(key, new THREE.BoxGeometry(size[0], size[1], size[2]), position, rotation);
  }

  /** Caja con aristas redondeadas: evita el aspecto de bloque de low-poly. */
  rbox(size, key, position, rotation, radius = 0.06, segments = 2) {
    const min = Math.min(size[0], size[1], size[2]);
    const r = Math.max(0.004, Math.min(radius, min * 0.45));
    const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], segments, r);
    return this._add(key, geometry, position, rotation);
  }

  cyl(radiusTop, radiusBottom, height, key, position, rotation, segments = 14) {
    return this._add(
      key,
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      position,
      rotation
    );
  }

  sphere(radius, key, position, rotation, segments = 14, rings = 8, thetaLength = Math.PI) {
    return this._add(
      key,
      new THREE.SphereGeometry(radius, segments, rings, 0, Math.PI * 2, 0, thetaLength),
      position,
      rotation
    );
  }

  torus(radius, tube, key, position, rotation, segments = 16, radial = 6, arc = Math.PI * 2) {
    return this._add(
      key,
      new THREE.TorusGeometry(radius, tube, radial, segments, arc),
      position,
      rotation
    );
  }

  /** Paraboloide abierto: antenas y reflectores. */
  dish(radius, depth, key, position, rotation, segments = 20) {
    const points = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      points.push(new THREE.Vector2(radius * t, depth * t * t));
    }
    return this._add(key, new THREE.LatheGeometry(points, segments), position, rotation);
  }

  /** Barra entre dos puntos (costillas, celosías, cables tensados). */
  beam(from, to, thickness, key, height = null) {
    _a.set(from[0], from[1], from[2]);
    _b.set(to[0], to[1], to[2]);
    _dir.subVectors(_b, _a);
    const length = _dir.length();
    if (length < 1e-4) return null;
    _dir.normalize();
    const geometry = new THREE.BoxGeometry(thickness, length, height ?? thickness);
    _quat.setFromUnitVectors(_up, _dir);
    geometry.applyQuaternion(_quat);
    geometry.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
    return this._raw(key, geometry);
  }

  /** Tubería entre dos puntos. */
  pipe(from, to, radius, key, segments = 8) {
    _a.set(from[0], from[1], from[2]);
    _b.set(to[0], to[1], to[2]);
    _dir.subVectors(_b, _a);
    const length = _dir.length();
    if (length < 1e-4) return null;
    _dir.normalize();
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
    _quat.setFromUnitVectors(_up, _dir);
    geometry.applyQuaternion(_quat);
    geometry.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
    return this._raw(key, geometry);
  }

  /**
   * Placa de señalización. Reutiliza una celda del atlas, de modo que todos
   * los carteles de la base comparten material y se fusionan en una malla.
   */
  sign(key, size, position, rotation = null) {
    if (!this.signs) return null;
    const index = this.signs.index.get(key);
    if (index === undefined) return null;
    const cell = this.signs.atlas.cells[index];
    const geometry = new THREE.PlaneGeometry(size[0], size[1]);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        cell.u0 + uv.getX(i) * (cell.u1 - cell.u0),
        cell.v0 + uv.getY(i) * (cell.v1 - cell.v0)
      );
    }
    uv.needsUpdate = true;
    return this._add('sign', geometry, position, rotation);
  }

  /* --------------------------------------------------------------- cierre */

  /**
   * Fusiona los buckets y cuelga las mallas del padre.
   * @returns {THREE.Mesh[]} mallas creadas (para poder liberarlas al resetear).
   */
  flush(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [key, list] of this.buckets) {
      if (!list.length) continue;
      const material = this.materials[key];
      let geometry = list[0];
      if (list.length > 1) {
        geometry = mergeGeometries(list, false);
        for (const item of list) item.dispose();
        if (!geometry) {
          // Atributos incompatibles: no debería ocurrir, pero nunca dejar la
          // base a medias por un fallo silencioso de fusión.
          console.warn(`[BaseKit] No se pudo fusionar el material "${key}"`);
          continue;
        }
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = cast && SHADOW_KEYS.has(key);
      mesh.receiveShadow = receive;
      mesh.name = `base-${key}`;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

/* ==========================================================================
   Rótulos. El índice en el atlas lo fija el orden de este array.
   ========================================================================== */

export const MOON_SIGNS = [
  { key: 'hab', text: 'HAB-01', sub: 'HÁBITAT PRESURIZADO' },
  { key: 'ctrl', text: 'CTRL-02', sub: 'CONTROL DE MISIÓN' },
  { key: 'lab', text: 'LAB-03', sub: 'LABORATORIO CIENTÍFICO' },
  { key: 'bio', text: 'BIO-04', sub: 'INVERNADERO EXPERIMENTAL' },
  { key: 'pwr', text: 'PWR-05', sub: 'PLANTA ENERGÉTICA' },
  { key: 'log', text: 'LOG-06', sub: 'ALMACÉN DE RECURSOS' },
  { key: 'ws', text: 'WS-07', sub: 'TALLER DE REPARACIÓN' },
  { key: 'o2', text: 'O2-08', sub: 'GENERADOR DE OXÍGENO' },
  { key: 'h2o', text: 'H2O-09', sub: 'PROCESADOR DE AGUA' },
  { key: 'com', text: 'COM-10', sub: 'ANTENA DE COMUNICACIONES' },
  { key: 'gar', text: 'GAR-11', sub: 'GARAJE DEL ROVER' },
  { key: 'pad', text: 'PAD-00', sub: 'PLATAFORMA DE ATERRIZAJE' },
];

export const MARS_SIGNS = [
  { key: 'hab', text: 'HAB-01', sub: 'HÁBITAT MODULAR' },
  { key: 'ctrl', text: 'INV-02', sub: 'CENTRO DE INVESTIGACIÓN' },
  { key: 'lab', text: 'GEO-03', sub: 'LABORATORIO GEOLÓGICO' },
  { key: 'bio', text: 'BIO-04', sub: 'INVERNADERO EXPERIMENTAL' },
  { key: 'pwr', text: 'PWR-05', sub: 'PLANTA ENERGÉTICA' },
  { key: 'log', text: 'ORE-06', sub: 'ALMACÉN DE MINERALES' },
  { key: 'ws', text: 'WS-07', sub: 'TALLER DE MANTENIMIENTO' },
  { key: 'o2', text: 'LSS-08', sub: 'SOPORTE VITAL' },
  { key: 'h2o', text: 'H2O-09', sub: 'EXTRACCIÓN DE AGUA' },
  { key: 'com', text: 'COM-10', sub: 'CENTRO DE COMUNICACIONES' },
  { key: 'gar', text: 'GAR-11', sub: 'GARAJE DEL ROVER' },
  { key: 'pad', text: 'PAD-00', sub: 'ZONA DE ATERRIZAJE' },
];
