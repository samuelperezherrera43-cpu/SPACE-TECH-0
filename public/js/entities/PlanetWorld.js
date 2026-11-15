import * as THREE from 'three';
import { GROUP } from '../engine/Physics.js';
import { makeSignAtlas, makeWindowTexture, makeRegolithTextures } from '../engine/Textures.js';
import { Kit, MOON_SIGNS, MARS_SIGNS } from './BaseKit.js';
import {
  buildModule,
  buildLandingPad,
  buildBaseExtras,
  createBaseMaterials,
} from './BaseBuildings.js';

const FILTERS = {
  collisionFilterGroup: GROUP.STATION,
  collisionFilterMask: GROUP.PLAYER,
};

const smoothstep = (edge0, edge1, x) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const rng = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const BASE_CENTER = [0, 30];

const BASE_MODULES = [
  { id: 'habitat', label: 'Hábitat', offset: [0, 0], size: [8, 3.2, 6], built: true, walkable: true, cost: {} },
  { id: 'control', label: 'Control de misión', offset: [9, 0], size: [5, 3.0, 4], built: true, cost: {} },
  { id: 'lab', label: 'Laboratorio', offset: [-9, 0], size: [5, 3.0, 4], built: false, walkable: true, cost: { metals: 6, industrial: 4, electronics: 2 } },
  { id: 'greenhouse', label: 'Invernadero', offset: [-9, 8], size: [5, 3.0, 4], built: false, dome: true, cost: { metals: 4, waterIce: 3, industrial: 3 } },
  { id: 'power', label: 'Planta de energía', offset: [9, 8], size: [5, 2.6, 4], built: true, cost: {} },
  { id: 'storage', label: 'Almacén', offset: [9, -8], size: [5, 3.0, 4], built: true, cost: {} },
  { id: 'workshop', label: 'Taller', offset: [-9, -8], size: [5, 3.0, 4], built: false, cost: { metals: 8, industrial: 5 } },
  { id: 'o2', label: 'Planta de oxígeno', offset: [0, 9], size: [3.5, 2.4, 3.5], built: true, cost: {} },
  { id: 'water', label: 'Procesador de agua', offset: [4.5, 9], size: [3.2, 2.2, 3.2], built: false, cost: { metals: 3, waterIce: 4, industrial: 2 } },
  { id: 'antenna', label: 'Antena de comunicaciones', offset: [14, 0], size: [2, 7, 2], built: true, cost: {} },
  { id: 'garage', label: 'Garaje del rover', offset: [14, -8], size: [6, 3.2, 5], built: false, cost: { metals: 10, industrial: 6 } },
];

/**
 * Mundo planetario caminable: terreno procedural, base modular, recursos,
 * cueva (Marte) y rover. Todo vive en coordenadas locales de la superficie.
 */
export class PlanetWorld {
  constructor(scene, physics, materials, interactions, config) {
    this.scene = scene;
    this.physics = physics;
    this.materials = materials;
    this.interactions = interactions;
    this.config = config;

    this.group = new THREE.Group();
    this.group.name = `planet-${config.id}`;
    this.group.visible = false;
    scene.add(this.group);

    this.colliders = [];
    this.points = [];
    this.occluders = [];
    this.modules = new Map();
    this.collected = new Set();
    this.built = new Set();
    this.time = 0;
    this.caveFloor = null;
    this.caveExplored = false;
    this.mountainExplored = false;
    this._moduleContext = null;

    this._buildMaterials();
    this._buildBaseMaterials();
    this._buildTerrain();
    this._buildRocks();
    this._buildLandingPad();
    this._buildBase();
    this._buildResources();
    if (config.cave) this._buildCave();
    this._buildRover();
    if (config.dust) this._buildDust();

    // El mundo empieza oculto y sin colisiones hasta que el jugador aterrice.
    this.setVisible(false);
  }

  /* --------------------------------------------------------------- materiales */

  _buildMaterials() {
    const c = this.config;
    this.mats = {
      ground: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.98,
        metalness: 0.02,
      }),
      rock: new THREE.MeshStandardMaterial({
        color: c.rockColor,
        roughness: 0.95,
        metalness: 0.03,
      }),
      rockDark: new THREE.MeshStandardMaterial({
        color: c.rockDark,
        roughness: 0.92,
        metalness: 0.06,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: 0xc4d0dd,
        roughness: 0.5,
        metalness: 0.6,
        envMapIntensity: 0.8,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: 0x2b3440,
        roughness: 0.7,
        metalness: 0.45,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: c.glassColor,
        transparent: true,
        opacity: 0.28,
        roughness: 0.05,
        metalness: 0.2,
        envMapIntensity: 1.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: c.accentColor,
        emissive: c.accentColor,
        emissiveIntensity: 1.4,
        roughness: 0.35,
        metalness: 0.2,
      }),
      ice: new THREE.MeshStandardMaterial({
        color: 0xcdeeff,
        emissive: 0x2a6a8a,
        emissiveIntensity: 0.5,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
      }),
      ore: new THREE.MeshStandardMaterial({
        color: c.oreColor,
        emissive: c.oreColor,
        emissiveIntensity: 0.35,
        roughness: 0.55,
        metalness: 0.45,
      }),
    };
  }

  /**
   * Materiales y señalización de la base. Reutiliza la biblioteca PBR de la
   * estación para que ambas instalaciones compartan lenguaje visual.
   */
  _buildBaseMaterials() {
    const entries = this.config.id === 'mars' ? MARS_SIGNS : MOON_SIGNS;
    const atlas = makeSignAtlas(entries, {
      color: this.config.id === 'mars' ? '#ffa268' : '#5ff0ff',
    });
    this.signs = {
      atlas,
      index: new Map(entries.map((entry, index) => [entry.key, index])),
    };
    this.windowTexture = makeWindowTexture();
    this.regolithTextures = makeRegolithTextures(256);
    this.baseMats = createBaseMaterials(this.materials, this.config, atlas, this);
    this.baseMats.glass = this.mats.glass;
    this.baseMats.ice = this.mats.ice;
  }

  /* ----------------------------------------------------------------- terreno */

  heightAt(x, z) {
    const c = this.config;
    let h =
      Math.sin(x * 0.045 + 1.3) * 1.15 +
      Math.cos(z * 0.05 - 0.7) * 1.05 +
      Math.sin((x + z) * 0.11) * 0.42 +
      Math.sin(x * 0.013) * Math.cos(z * 0.017) * 3.0;

    const dx = x - c.mountain[0];
    const dz = z - c.mountain[1];
    const r = Math.hypot(dx, dz);
    if (r > c.mountainStart) {
      const t = Math.min(1, (r - c.mountainStart) / c.mountainWidth);
      const ridge = 0.65 + 0.35 * Math.sin(Math.atan2(dz, dx) * 9 + 0.7);
      h += t * t * c.mountainHeight * ridge;
    }

    for (const crater of c.craters) {
      const d = Math.hypot(x - crater.x, z - crater.z);
      if (d < crater.r * 1.45) {
        const rim = Math.exp(-((d - crater.r) ** 2) / (2 * (crater.r * 0.16) ** 2));
        const bowl = d < crater.r ? -crater.depth * (1 - (d / crater.r) ** 2) : 0;
        h += rim * crater.rim + bowl;
      }
    }

    if (c.canyon) {
      const d = Math.abs(z - c.canyon.z);
      if (d < c.canyon.width) {
        const t = 1 - d / c.canyon.width;
        h -= c.canyon.depth * t * t;
      }
    }

    // Zonas planas: base y entrada de la cueva.
    for (const zone of c.flatZones ?? []) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d < zone.radius) {
        const k = 1 - smoothstep(zone.radius * 0.55, zone.radius, d);
        h = h * (1 - k) + zone.y * k;
      }
    }

    return h;
  }

  _buildTerrain() {
    const size = 280;
    const segments = 110;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    const low = new THREE.Color(this.config.groundLow);
    const high = new THREE.Color(this.config.groundHigh);

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = this.heightAt(x, z);
      position.setY(i, y);

      const t = Math.max(0, Math.min(1, (y + 4) / 18));
      color.copy(low).lerp(high, t);
      const grain = 0.9 + 0.2 * Math.sin(x * 0.7 + z * 1.3);
      colors[i * 3] = color.r * grain;
      colors[i * 3 + 1] = color.g * grain;
      colors[i * 3 + 2] = color.b * grain;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, this.mats.ground);
    mesh.receiveShadow = true;
    mesh.name = `${this.config.id}-terrain`;
    this.group.add(mesh);
    this.terrain = mesh;
  }

  _buildRocks() {
    const random = rng(this.config.seed);
    const count = this.config.rockCount ?? 150;
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const mesh = new THREE.InstancedMesh(geometry, this.mats.rock, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 18 + random() * 105;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius + 14;
      let scale = 0.35 + random() * 1.8;
      const nearBase = Math.hypot(x - BASE_CENTER[0], z - BASE_CENTER[1]) < 30;
      const nearPad = Math.hypot(x - this.config.pad[0], z - this.config.pad[1]) < 13;
      const nearCave = this.config.cave
        ? Math.hypot(x - this.config.cave.x, z - this.config.cave.z) < 16
        : false;
      if (nearBase || nearPad || nearCave) scale = 0.02;
      const y = this.heightAt(x, z);
      dummy.position.set(x, y + scale * 0.3, z);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      dummy.scale.set(scale, scale * (0.55 + random() * 0.7), scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Rocas grandes: colisión real.
      if (scale > 1.4 && Math.hypot(x - BASE_CENTER[0], z - BASE_CENTER[1]) > 24) {
        this._addCollider([x, y + scale * 0.5, z], [scale * 0.8, scale * 0.8, scale * 0.8]);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  /* --------------------------------------------------------------- estructuras */

  _addCollider(position, half, occluder = true) {
    const body = this.physics.box(position, half, FILTERS);
    body.collisionResponse = this.group.visible;
    this.colliders.push(body);
    this._moduleContext?.colliders?.push(body);

    if (occluder) {
      const geometry = new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.visible = false;
      mesh.layers.set(0);
      this.group.add(mesh);
      this.occluders.push(mesh);
    }
    return body;
  }

  _box(size, material, position, parent = this.group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(1);
    parent.add(mesh);
    if (this._moduleContext) {
      if (this._moduleContext.scaffold) this._moduleContext.scaffoldMeshes.push(mesh);
      else this._moduleContext.meshes.push(mesh);
    }
    return mesh;
  }

  _cylinder(radius, height, material, position, rotation = null, parent = this.group) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 14), material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(1);
    parent.add(mesh);
    if (this._moduleContext) {
      if (this._moduleContext.scaffold) this._moduleContext.scaffoldMeshes.push(mesh);
      else this._moduleContext.meshes.push(mesh);
    }
    return mesh;
  }

  _buildLandingPad() {
    const [x, z] = this.config.pad;
    const y = this.heightAt(x, z);
    this.padY = y;

    const kit = new Kit(this.baseMats, this.signs);
    buildLandingPad(kit, { x, y, z });
    this.padMeshes = kit.flush(this.group);

    this.landingPad = new THREE.Vector3(x, y, z);
    this.spawn = new THREE.Vector3(x, y, z + 8.5);
    this.shipPark = new THREE.Vector3(x, y, z);

    this._addPoint({
      id: `${this.config.id}_pad`,
      label: 'Plataforma de aterrizaje',
      panel: 'base',
      position: [x, y + 0.8, z + 4.8],
      radius: 3.0,
      color: 0x5ff0ff,
    });
  }

  _buildBase() {
    const baseY = this.heightAt(BASE_CENTER[0], BASE_CENTER[1]);

    // Explanada, pista y balizas: van primero para quedar bajo los módulos.
    const extras = new Kit(this.baseMats, this.signs);
    buildBaseExtras(extras, {
      center: BASE_CENTER,
      ground: (gx, gz) => this.heightAt(gx, gz),
    });
    this.baseExtraMeshes = extras.flush(this.group);

    for (const definition of BASE_MODULES) {
      const x = BASE_CENTER[0] + definition.offset[0];
      const z = BASE_CENTER[1] + definition.offset[1];
      const y = this.heightAt(x, z);
      const module = {
        ...definition,
        x,
        y,
        z,
        baseY: y,
        initialBuilt: definition.built,
        meshes: [],
        colliders: [],
        scaffoldMeshes: [],
        scaffold: false,
      };
      this.modules.set(definition.id, module);

      if (definition.built) {
        this._buildModuleMesh(module);
        this.built.add(definition.id);
      } else {
        this._buildScaffold(module);
      }
    }

    // Consola del hábitat.
    this._addPoint({
      id: `${this.config.id}_habitat_console`,
      label: 'Consola del hábitat',
      panel: 'base',
      position: [BASE_CENTER[0], baseY + 1.5, BASE_CENTER[1] + 1.8],
      radius: 2.2,
      color: 0x6dffa8,
    });

    // Puntos de construcción de los módulos pendientes.
    for (const module of this.modules.values()) {
      if (module.built) continue;
      this._addPoint({
        id: `build_${this.config.id}_${module.id}`,
        label: `Construir ${module.label}`,
        panel: 'build',
        kind: 'build',
        module: module.id,
        position: [module.x, module.y + 0.8, module.z],
        radius: 2.6,
        color: 0xffb45f,
      });
    }
  }

  _buildModuleMesh(module) {
    this._moduleContext = module;
    try {
      this._buildModuleMeshInner(module);
    } finally {
      this._moduleContext = null;
    }
  }

  /**
   * Piel del módulo. Los colisionadores se declaran aquí con las mismas cajas
   * que la versión anterior: la simulación no cambia, solo la arquitectura.
   */
  _buildModuleMeshInner(module) {
    const { x, y, z, size, id } = module;
    const [w, h, d] = size;

    if (module.dome) {
      this._addCollider([x, y + h * 0.5, z], [w * 0.5, h * 0.5, d * 0.5], false);
    } else if (id === 'antenna') {
      this._addCollider([x, y + h / 2, z], [0.3, h / 2, 0.3], false);
    } else if (id === 'o2' || id === 'water' || id === 'power') {
      this._addCollider([x, y + h / 2, z], [w / 2, h / 2, d / 2]);
    } else if (
      id === 'habitat' ||
      id === 'lab' ||
      id === 'control' ||
      id === 'storage' ||
      id === 'workshop' ||
      id === 'garage'
    ) {
      // Muros con hueco de puerta al norte (+z), idénticos a la versión anterior.
      const door = 1.8;
      const south = (w - door) / 2;
      this._addCollider([x, y + h / 2, z - d / 2], [w / 2, h / 2, 0.08]);
      this._addCollider([x - w / 2, y + h / 2, z], [0.08, h / 2, d / 2]);
      this._addCollider([x + w / 2, y + h / 2, z], [0.08, h / 2, d / 2]);
      this._addCollider([x - (door / 2 + south / 2), y + h / 2, z + d / 2], [south / 2, h / 2, 0.08]);
      this._addCollider([x + (door / 2 + south / 2), y + h / 2, z + d / 2], [south / 2, h / 2, 0.08]);
    } else {
      this._addCollider([x, y + h / 2, z], [w / 2, h / 2, d / 2]);
    }

    const kit = new Kit(this.baseMats, this.signs);
    buildModule(kit, module);
    module.meshes.push(...kit.flush(this.group));
  }

  _buildScaffold(module) {
    const { x, y, z, size } = module;
    const [w, h, d] = size;
    module.scaffoldMeshes = module.scaffoldMeshes ?? [];
    this._moduleContext = module;
    module.scaffold = true;
    try {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          this._box([0.1, h, 0.1], this.mats.accent, [x + sx * w * 0.45, y + h / 2, z + sz * d * 0.45]);
        }
      }
      this._box([w * 0.9, 0.08, d * 0.9], this.mats.accent, [x, y + h, z]);
      this._box([w * 0.7, 0.08, d * 0.7], this.mats.accent, [x, y + h * 0.55, z]);
    } finally {
      module.scaffold = false;
      this._moduleContext = null;
    }
  }

  completeModule(id) {
    const module = this.modules.get(id);
    if (!module || module.built) return false;
    module.built = true;
    this.built.add(id);

    for (const mesh of module.scaffoldMeshes ?? []) {
      this.group.remove(mesh);
      mesh.geometry?.dispose();
    }
    module.scaffoldMeshes = [];

    this._buildModuleMesh(module);

    const point = this.points.find((item) => item.id === `build_${this.config.id}_${id}`);
    if (point) {
      point.hidden = true;
      point.group.visible = false;
    }
    return true;
  }

  /* ---------------------------------------------------------------- recursos */

  _addPoint(definition) {
    if (!this.interactions) return null;
    const point = this.interactions.addPoint({ owner: this.config.id, ...definition });
    this.points.push(point);
    return point;
  }

  _buildResources() {
    for (const node of this.config.resources) {
      const x = node.position[0];
      const z = node.position[1];
      const y = this.heightAt(x, z);
      const group = new THREE.Group();
      group.position.set(x, y, z);
      this.group.add(group);

      if (node.resource === 'waterIce') {
        for (let i = 0; i < 5; i++) {
          const crystal = new THREE.Mesh(
            new THREE.ConeGeometry(0.22 + i * 0.05, 1.1 + i * 0.25, 5),
            this.mats.ice
          );
          crystal.position.set((i - 2) * 0.32, 0.5 + i * 0.1, Math.sin(i) * 0.3);
          crystal.rotation.z = (i - 2) * 0.12;
          crystal.castShadow = true;
          crystal.layers.enable(1);
          group.add(crystal);
        }
      } else if (node.resource === 'minerals' || node.resource === 'metals') {
        for (let i = 0; i < 4; i++) {
          const ore = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.35 + i * 0.1, 0),
            this.mats.ore
          );
          ore.position.set((i - 1.5) * 0.45, 0.35 + (i % 2) * 0.2, Math.cos(i) * 0.35);
          ore.rotation.set(i, i * 0.7, i * 1.3);
          ore.castShadow = true;
          ore.layers.enable(1);
          group.add(ore);
        }
      } else {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), this.mats.rockDark);
        rock.position.y = 0.55;
        rock.scale.set(1.3, 0.8, 1.1);
        rock.castShadow = true;
        group.add(rock);
      }

      const point = this._addPoint({
        id: `res_${this.config.id}_${node.id}`,
        label: `Extraer ${node.label}`,
        panel: 'resource',
        kind: 'resource',
        resource: node.resource,
        amount: node.amount,
        node: node.id,
        position: [x, y + 0.9, z],
        radius: 2.4,
        color: node.resource === 'waterIce' ? 0x5ff0ff : node.resource === 'minerals' ? 0xffb45f : 0x6dffa8,
      });
      if (point) {
        point.mesh = group;
        point.collected = this.collected.has(node.id);
        if (point.collected) group.visible = false;
      }
    }
  }

  /* ------------------------------------------------------------------ cueva */

  _buildCave() {
    const c = this.config.cave;
    const y = this.heightAt(c.x, c.z);
    this.caveFloor = y;

    const tunnel = new THREE.Group();
    tunnel.position.set(c.x, y, c.z);
    this.group.add(tunnel);

    // Suelo, paredes y techo del túnel.
    this._box([16, 0.2, 4.6], this.mats.rockDark, [0, -0.1, 0], tunnel);
    for (const side of [-1, 1]) {
      this._box([16, 3.2, 0.8], this.mats.rock, [0, 1.6, side * 2.4], tunnel);
    }
    this._box([16, 0.7, 4.8], this.mats.rock, [0, 3.25, 0], tunnel);
    this._box([0.8, 3.2, 4.8], this.mats.rock, [-8, 1.6, 0], tunnel);

    // Arco de entrada.
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI * (i / 7);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.25, 0), this.mats.rock);
      rock.position.set(7.8, Math.sin(angle) * 2.8, Math.cos(angle) * 2.7);
      rock.rotation.set(i, i * 0.4, i * 0.2);
      rock.castShadow = true;
      tunnel.add(rock);
    }

    this._addCollider([c.x + 0.0, y + 1.6, c.z - 2.5], [8, 1.6, 0.35], false);
    this._addCollider([c.x + 0.0, y + 1.6, c.z + 2.5], [8, 1.6, 0.35], false);

    this.caveBounds = {
      min: [c.x - 8, y, c.z - 2.2],
      max: [c.x + 7.5, y + 3.2, c.z + 2.2],
    };

    this._addPoint({
      id: `${this.config.id}_cave`,
      label: 'Explorar cueva de hielo',
      panel: 'cave',
      kind: 'cave',
      position: [c.x + 7.2, y + 1.2, c.z],
      radius: 2.8,
      color: 0x5ff0ff,
    });

    // Depósito de hielo al fondo.
    const iceGroup = new THREE.Group();
    iceGroup.position.set(c.x - 6.4, y, c.z);
    for (let i = 0; i < 6; i++) {
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.24 + i * 0.04, 1.0 + i * 0.2, 5), this.mats.ice);
      crystal.position.set((i - 2.5) * 0.35, 0.5 + (i % 2) * 0.2, Math.cos(i) * 0.5);
      crystal.rotation.z = (i - 2) * 0.1;
      crystal.castShadow = true;
      iceGroup.add(crystal);
    }
    this.group.add(iceGroup);

    const icePoint = this._addPoint({
      id: `res_${this.config.id}_cave_ice`,
      label: 'Extraer hielo subsuperficial',
      panel: 'resource',
      kind: 'resource',
      resource: 'waterIce',
      amount: 6,
      node: `${this.config.id}_cave_ice`,
      position: [c.x - 6.4, y + 0.9, c.z],
      radius: 2.2,
      color: 0x5ff0ff,
    });
    if (icePoint) {
      icePoint.mesh = iceGroup;
      if (this.collected.has(`${this.config.id}_cave_ice`)) iceGroup.visible = false;
    }
  }

  /* ------------------------------------------------------------------ rover */

  _buildRover() {
    const [x, z] = this.config.rover;
    const y = this.heightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    this.group.add(group);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.5), this.mats.metal);
    body.position.y = 0.65;
    body.castShadow = true;
    body.layers.enable(1);
    group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.2), this.mats.glass);
    cabin.position.set(-0.35, 1.25, 0);
    cabin.layers.enable(1);
    group.add(cabin);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12), this.mats.dark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * 0.85, 0.38, sz * 0.78);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }
    for (const sz of [-1, 1]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), this.mats.metal);
      mast.position.set(0.9, 1.3, sz * 0.4);
      group.add(mast);
    }
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.mats.accent);
    dish.position.set(0.9, 1.72, 0);
    dish.rotation.x = Math.PI;
    group.add(dish);

    this.rover = {
      group,
      position: new THREE.Vector3(x, y, z),
      heading: 0,
      speed: 0,
      occupied: false,
      seat: new THREE.Vector3(0.2, 1.3, 0),
    };

    this._addPoint({
      id: `${this.config.id}_rover`,
      label: 'Conducir rover',
      panel: 'rover',
      kind: 'rover',
      position: [x, y + 1.2, z],
      radius: 2.8,
      color: 0x6dffa8,
    });
    this.roverPoint = this.points[this.points.length - 1];
  }

  updateRover(dt, input) {
    if (!this.rover) return;
    const rover = this.rover;
    const forward = input.z ?? 0;
    const turn = input.x ?? 0;

    rover.speed += forward * 9 * dt;
    rover.speed *= Math.exp(-dt * 1.6);
    rover.speed = Math.max(-7, Math.min(11, rover.speed));
    rover.heading += turn * dt * (1.2 + Math.abs(rover.speed) * 0.08);

    rover.position.x += Math.sin(rover.heading) * rover.speed * dt;
    rover.position.z += Math.cos(rover.heading) * rover.speed * dt;
    rover.position.y = this.heightAt(rover.position.x, rover.position.z);
    rover.group.position.copy(rover.position);
    rover.group.rotation.y = rover.heading;
  }

  roverSeatPosition() {
    if (!this.rover) return null;
    const offset = this.rover.seat.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rover.heading);
    return this.rover.position.clone().add(offset);
  }

  /* -------------------------------------------------------------------- polvo */

  _buildDust() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90 + 20;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: this.config.dustColor,
      size: 0.16,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geometry, material);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  /* --------------------------------------------------------------- consultas */

  groundHeightAt(x, z, y = null) {
    if (this.caveBounds) {
      const [minX, , minZ] = this.caveBounds.min;
      const [maxX, , maxZ] = this.caveBounds.max;
      if (x > minX && x < maxX && z > minZ && z < maxZ) {
        return this.caveFloor + 0.1;
      }
    }

    for (const module of this.modules.values()) {
      if (!module.built || !module.walkable) continue;
      const [w, , d] = module.size;
      if (
        x > module.x - w / 2 + 0.35 &&
        x < module.x + w / 2 - 0.35 &&
        z > module.z - d / 2 + 0.35 &&
        z < module.z + d / 2 - 0.35
      ) {
        // Por debajo del suelo del módulo se sigue usando el terreno.
        if (y !== null && y < module.y - 0.5) continue;
        return module.y + 0.1;
      }
    }

    return this.heightAt(x, z);
  }

  contains(position) {
    return this.isSafe(position);
  }

  isSafe(position) {
    for (const module of this.modules.values()) {
      if (!module.built || !module.walkable) continue;
      const [w, h, d] = module.size;
      if (
        position.x > module.x - w / 2 &&
        position.x < module.x + w / 2 &&
        position.z > module.z - d / 2 &&
        position.z < module.z + d / 2 &&
        position.y > module.y - 0.4 &&
        position.y < module.y + h
      ) {
        return true;
      }
    }
    return false;
  }

  getModuleAt(position) {
    for (const module of this.modules.values()) {
      if (!module.built || !module.walkable) continue;
      const [w, h, d] = module.size;
      if (
        position.x > module.x - w / 2 - 0.3 &&
        position.x < module.x + w / 2 + 0.3 &&
        position.z > module.z - d / 2 - 0.3 &&
        position.z < module.z + d / 2 + 0.3 &&
        position.y > module.y - 0.6 &&
        position.y < module.y + h + 0.4
      ) {
        return {
          id: module.id,
          min: [module.x - w / 2, module.y, module.z - d / 2],
          max: [module.x + w / 2, module.y + h, module.z + d / 2],
        };
      }
    }
    return null;
  }

  getNearby(position) {
    let best = null;
    let bestDistance = Infinity;
    for (const point of this.points) {
      if (point.collected || point.group.visible === false) continue;
      const distance = point.group.position.distanceTo(position);
      if (distance <= point.radius && distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  }

  collectNode(nodeId) {
    if (this.collected.has(nodeId)) return null;
    const point = this.points.find((item) => item.node === nodeId);
    const node =
      this.config.resources.find((item) => item.id === nodeId) ??
      (point
        ? {
            id: nodeId,
            resource: point.resource,
            amount: point.amount,
            label: point.label,
          }
        : null);
    this.collected.add(nodeId);
    if (point) {
      point.collected = true;
      if (point.mesh) point.mesh.visible = false;
      point.group.visible = false;
    }
    return node ?? null;
  }

  setVisible(visible) {
    this.group.visible = visible;
    for (const collider of this.colliders) collider.collisionResponse = visible;
    for (const point of this.points) {
      point.group.visible = visible && !point.collected && !point.hidden;
    }
    if (this.dust) this.dust.visible = visible;
  }

  isInMountain(position) {
    const c = this.config;
    const distance = Math.hypot(position.x - c.mountain[0], position.z - c.mountain[1]);
    if (distance <= c.mountainStart) return false;
    // Sólo cuenta cuando el jugador está realmente en la ladera, no en la llanura.
    return this.heightAt(position.x, position.z) > 2.5;
  }

  isInCave(position) {
    if (!this.caveBounds) return false;
    const [minX, minY, minZ] = this.caveBounds.min;
    const [maxX, maxY, maxZ] = this.caveBounds.max;
    return (
      position.x > minX + 0.5 &&
      position.x < maxX - 0.5 &&
      position.z > minZ + 0.5 &&
      position.z < maxZ - 0.5 &&
      position.y > minY - 0.8 &&
      position.y < maxY + 0.8
    );
  }

  reset() {
    this.collected.clear();
    this.caveExplored = false;
    this.mountainExplored = false;

    for (const node of this.config.resources) {
      const point = this.points.find((item) => item.node === node.id);
      if (point) {
        point.collected = false;
        point.group.visible = this.group.visible;
        if (point.mesh) point.mesh.visible = true;
      }
    }
    const caveIce = this.points.find((item) => item.node === `${this.config.id}_cave_ice`);
    if (caveIce) {
      caveIce.collected = false;
      caveIce.group.visible = this.group.visible;
      if (caveIce.mesh) caveIce.mesh.visible = true;
    }

    for (const module of this.modules.values()) {
      if (module.meshes?.length) {
        for (const mesh of module.meshes) {
          this.group.remove(mesh);
          mesh.geometry?.dispose();
        }
      }
      module.meshes = [];
      for (const collider of module.colliders ?? []) collider.collisionResponse = false;
      module.colliders = [];

      if (module.initialBuilt) {
        module.built = true;
        this.built.add(module.id);
        this._buildModuleMesh(module);
      } else {
        module.built = false;
        this.built.delete(module.id);
        if (!module.scaffoldMeshes?.length) this._buildScaffold(module);
      }

      const point = this.points.find((item) => item.id === `build_${this.config.id}_${module.id}`);
      if (point) {
        point.hidden = module.built;
        point.group.visible = this.group.visible && !module.built;
      }
    }

    if (this.rover) {
      const [x, z] = this.config.rover;
      this.rover.position.set(x, this.heightAt(x, z), z);
      this.rover.heading = 0;
      this.rover.speed = 0;
      this.rover.occupied = false;
      this.rover.group.position.copy(this.rover.position);
      this.rover.group.rotation.y = 0;
      this.roverPoint.group.position.set(x, this.rover.position.y + 1.2, z);
      this.roverPoint.position = [x, this.rover.position.y + 1.2, z];
    }
  }

  serialize() {
    return {
      collected: [...this.collected],
      built: [...this.built],
      caveExplored: this.caveExplored,
      mountainExplored: this.mountainExplored,
      rover: this.rover
        ? {
            x: this.rover.position.x,
            z: this.rover.position.z,
            heading: this.rover.heading,
          }
        : null,
    };
  }

  restore(snapshot) {
    if (!snapshot) return;
    this.reset();

    for (const id of snapshot.collected ?? []) {
      this.collectNode(id);
    }

    for (const id of snapshot.built ?? []) {
      this.completeModule(id);
    }

    this.caveExplored = !!snapshot.caveExplored;
    this.mountainExplored = !!snapshot.mountainExplored;

    if (this.rover && snapshot.rover) {
      const { x, z, heading } = snapshot.rover;
      this.rover.position.set(x, this.heightAt(x, z), z);
      this.rover.heading = heading ?? 0;
      this.rover.speed = 0;
      this.rover.group.position.copy(this.rover.position);
      this.rover.group.rotation.y = this.rover.heading;
      this.roverPoint.group.position.set(x, this.rover.position.y + 1.2, z);
      this.roverPoint.position = [x, this.rover.position.y + 1.2, z];
    }
  }

  setShip(ship) {
    if (!ship) return;
    const park = this.shipPark;
    ship.setPosition(park.x, park.y, park.z);
    ship.setInteriorActive(true);
    ship.setVisible(true);
    if (this.shipRegistered) return;
    this.shipRegistered = true;
    this._addPoint({
      id: `${this.config.id}_ship_hatch`,
      label: 'Subir a la nave de transporte',
      panel: 'ship',
      kind: 'ship',
      position: [park.x - 6.8, park.y + 0.6, park.z],
      radius: 2.6,
      color: 0x5ff0ff,
    });
  }

  update(dt, playerPosition) {
    if (!this.group.visible) return;
    this.time += dt;

    if (this.dust) {
      const positions = this.dust.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let x = positions.getX(i) + dt * 1.6;
        if (x > 45) x -= 90;
        positions.setX(i, x);
        positions.setY(i, positions.getY(i) + Math.sin(this.time + i) * dt * 0.2);
      }
      positions.needsUpdate = true;
    }

    // El rover se asienta sobre el terreno y su punto de interacción lo sigue.
    if (this.rover) {
      this.rover.position.y = this.heightAt(this.rover.position.x, this.rover.position.z);
      this.rover.group.position.copy(this.rover.position);
      if (this.roverPoint) {
        this.roverPoint.group.position.set(
          this.rover.position.x,
          this.rover.position.y + 1.2,
          this.rover.position.z
        );
        this.roverPoint.position = [
          this.rover.position.x,
          this.rover.position.y + 1.2,
          this.rover.position.z,
        ];
      }
    }

    void playerPosition;
  }
}
