import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GROUP } from './Physics.js';
import { makeGlowTexture } from './Textures.js';

const ASSETS = new URL('../../assets/interior/', import.meta.url);

const RED = new THREE.Color(0xff4d5e);
const GREEN = new THREE.Color(0x6dffa8);
const AMBER = new THREE.Color(0xffb347);

const FILTERS = {
  collisionFilterGroup: GROUP.STATION,
  collisionFilterMask: GROUP.PLAYER,
};

/**
 * Interior habitable: carga los GLB optimizados, crea los colisionadores
 * estáticos de cannon-es, anima compuertas y pantallas y gestiona la
 * secuencia de esclusa sin tocar la posición del jugador.
 *
 * Iluminación por capas: los módulos viven en la capa 1, así el sol (capa 0)
 * no atraviesa las paredes y las luces interiores no cuestan en el exterior.
 */
export class Interior {
  constructor(scene, physics, materials, preset) {
    this.scene = scene;
    this.physics = physics;
    this.materials = materials;
    this.preset = preset;

    this.group = new THREE.Group();
    this.group.name = 'interior';
    scene.add(this.group);

    this.occluders = [];
    this.bodies = [];
    this.doors = [];
    this.modules = {};
    this.collisionActive = true;
    this.floor = -10.4;
    this.ceil = -7.6;
    this.loaded = false;
    this.time = 0;

    // El GLB del hábitat mezcla casco y props. Desde fuera sólo hace falta el
    // casco; los props interiores (suelo, tejidos, pantallas) se ocultan.
    this.detailMeshes = [];
    this.detailVisible = true;

    this.screenTimer = 0;
    this.onEvent = null;

    this.airlock = {
      phase: 'sealed',
      direction: null,
      timer: 0,
      wait: 0,
      armed: true,
      pressurized: true,
      pressure: 1,
      bounds: null,
      outer: null,
      inner: null,
    };

    this.powerLevel = 1;

    this.stats = { modules: 0, colliders: 0, doors: 0 };

    this.ready = this._load();
  }

  /* ----------------------------------------------------------------- carga */

  async _load() {
    try {
      const loader = new GLTFLoader();
      const [habitat, door, manifest] = await Promise.all([
        this._gltf(loader, 'habitat.glb'),
        this._gltf(loader, 'door.glb'),
        fetch(new URL('colliders.json', ASSETS)).then((response) => response.json()),
      ]);

      this._buildMaterials();
      this._install(habitat.scene);
      this._buildColliders(manifest);
      this._buildDoors(manifest.doors, door.scene);
      this._buildStatusLights();
      this._buildLights();
      this._applyDetailState();

      this.modules = manifest.modules;
      this.airlock.bounds = manifest.airlock;
      const bounds = Object.values(manifest.modules);
      this.floor = Math.min(...bounds.map((module) => module.min[1]));
      this.ceil = Math.max(...bounds.map((module) => module.max[1]));
      this.stats.modules = Object.keys(manifest.modules).length;
      this.stats.colliders = this.bodies.length;
      this.stats.doors = this.doors.length;
      this.loaded = true;
    } catch (error) {
      console.error('[ORBITAL] No se pudo cargar el interior:', error);
    }
  }

  _gltf(loader, file) {
    return loader.loadAsync(new URL(file, ASSETS).href);
  }

  /* ------------------------------------------------------------- materiales */

  _buildMaterials() {
    const hull = this.materials.hull;
    const dark = this.materials.dark;

    const maps = (source) => ({
      map: source.map,
      normalMap: source.normalMap,
      roughnessMap: source.roughnessMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });

    const standard = (options) =>
      new THREE.MeshStandardMaterial({ envMapIntensity: 0.85, ...options });

    this.mats = {
      int_hull: standard({ ...maps(hull), color: 0xdde6f2, metalness: 0.35, roughness: 0.62 }),
      int_panel: standard({ ...maps(hull), color: 0x93a4ba, metalness: 0.55, roughness: 0.42 }),
      int_floor: standard({ ...maps(dark), color: 0x67738a, metalness: 0.3, roughness: 0.82 }),
      int_trim: standard({ ...maps(dark), color: 0x1e2733, metalness: 0.85, roughness: 0.32 }),
      int_fabric: standard({ color: 0x232a36, metalness: 0.05, roughness: 0.95 }),
      int_glass: standard({
        color: 0x9fd8ff,
        metalness: 0.15,
        roughness: 0.05,
        transparent: true,
        opacity: 0.16,
        envMapIntensity: 2.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      int_accent: standard({
        color: 0x0e2b33,
        emissive: 0x5ff0ff,
        emissiveIntensity: 0.8,
        metalness: 0.3,
        roughness: 0.5,
      }),
      int_amber: standard({
        color: 0x2a1a08,
        emissive: 0xff8a1e,
        emissiveIntensity: 0.8,
        metalness: 0.3,
        roughness: 0.5,
      }),
      int_door: standard({ ...maps(hull), color: 0xa8b8cc, metalness: 0.7, roughness: 0.4 }),
    };

    this.screenTexture = this._makeScreenTexture();
    this.radarTexture = this._makeRadarTexture();

    this.mats.int_screen = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      toneMapped: false,
    });
    this.mats.int_radar = new THREE.MeshBasicMaterial({
      map: this.radarTexture,
      transparent: true,
      toneMapped: false,
    });
  }

  /* --------------------------------------------------------------- pantallas */

  _canvasTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { canvas, context: canvas.getContext('2d'), texture };
  }

  _makeScreenTexture() {
    const { context, texture } = this._canvasTexture(256, 128);
    this.screenCtx = context;
    this.screenTexture = texture;
    this._drawScreen(0);
    return texture;
  }

  _makeRadarTexture() {
    const { context, texture } = this._canvasTexture(256, 256);
    this.radarCtx = context;
    this.radarTexture = texture;
    this._drawRadar(0);
    return texture;
  }

  _drawScreen(time) {
    const ctx = this.screenCtx;
    if (!ctx) return;
    const w = 256;
    const h = 128;

    ctx.fillStyle = '#041018';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(70,190,230,0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(20,70,95,0.92)';
    ctx.fillRect(0, 0, w, 20);
    ctx.fillStyle = '#5ff0ff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('ORBITAL OPS · EVA-07', 8, 14);

    const rows = [
      ['CASCO', `${(92 + Math.sin(time * 0.7) * 3).toFixed(0)}%`],
      ['O2', `${(78 + Math.sin(time * 0.9 + 1) * 4).toFixed(0)}%`],
      ['ENERGIA', `${(64 + Math.sin(time * 1.3 + 2) * 6).toFixed(0)}%`],
      ['NAV', 'LOCK'],
    ];

    ctx.font = '10px monospace';
    rows.forEach(([label, value], index) => {
      const y = 38 + index * 18;
      ctx.fillStyle = '#7fa6bb';
      ctx.fillText(label, 8, y);
      ctx.fillStyle = '#5ff0ff';
      ctx.fillText(value, 176, y);
    });

    ctx.strokeStyle = '#5ff0ff';
    ctx.beginPath();
    for (let x = 8; x <= 248; x += 3) {
      const y = 112 + Math.sin(x * 0.11 + time * 5) * 5 + Math.sin(x * 0.31 + time * 2.3) * 2;
      if (x === 8) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (Math.sin(time * 6) > 0) {
      ctx.fillStyle = '#6dffa8';
      ctx.fillRect(238, 6, 6, 6);
    }
  }

  _drawRadar(time) {
    const ctx = this.radarCtx;
    if (!ctx) return;
    const size = 256;
    const c = size / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(3,14,22,0.94)';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(95,240,255,0.32)';
    ctx.lineWidth = 1;
    for (const radius of [38, 76, 114]) {
      ctx.beginPath();
      ctx.arc(c, c, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(c, 8);
    ctx.lineTo(c, 248);
    ctx.moveTo(8, c);
    ctx.lineTo(248, c);
    ctx.stroke();

    const angle = time * 1.7;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    const gradient = ctx.createLinearGradient(0, 0, 114, 0);
    gradient.addColorStop(0, 'rgba(95,240,255,0.34)');
    gradient.addColorStop(1, 'rgba(95,240,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 114, -0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(95,240,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(114, 0);
    ctx.stroke();
    ctx.restore();

    const blips = [
      [0.5, 1.1],
      [2.3, 0.8],
      [4.2, 2.0],
      [5.4, 0.4],
    ];
    for (const [blipAngle, radius] of blips) {
      const alpha = 0.3 + 0.7 * Math.max(0, Math.sin(time * 1.7 - blipAngle + 1));
      ctx.fillStyle = `rgba(109,255,168,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(c + Math.cos(blipAngle) * radius * 45, c + Math.sin(blipAngle) * radius * 45, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ----------------------------------------------------------------- malla */

  _install(root) {
    // Materiales que forman el casco visible desde el exterior.
    const SHELL = new Set(['int_hull', 'int_panel', 'int_glass', 'int_trim']);
    root.traverse((object) => {
      if (!object.isMesh) return;
      const name = object.material?.name;
      const replacement = this.mats[name];
      if (replacement) object.material = replacement;
      // El interior está dentro del casco: el sol no lo ilumina y las luces
      // puntuales no proyectan sombras. Evitar que llene el shadow map ahorra
      // una pasada completa sin pérdida visual.
      object.castShadow = false;
      object.receiveShadow = true;
      object.layers.set(1);
      if (!SHELL.has(name)) this.detailMeshes.push(object);
    });
    this.group.add(root);
  }

  /* ------------------------------------------------------------- colisiones */

  _buildColliders(manifest) {
    this.occluderGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.occluderMaterial = new THREE.MeshBasicMaterial();

    for (const box of manifest.boxes) {
      const body = this.physics.box(box.p, box.h, FILTERS);
      if (box.r && (box.r[0] || box.r[1] || box.r[2])) {
        body.quaternion.setFromEuler(box.r[0], box.r[1], box.r[2]);
      }
      this.bodies.push(body);

      const occluder = new THREE.Mesh(this.occluderGeometry, this.occluderMaterial);
      occluder.position.set(box.p[0], box.p[1], box.p[2]);
      occluder.quaternion.copy(body.quaternion);
      occluder.scale.set(box.h[0] * 2, box.h[1] * 2, box.h[2] * 2);
      occluder.visible = false;
      occluder.layers.set(0);
      this.group.add(occluder);
      this.occluders.push(occluder);
    }
  }

  /* ----------------------------------------------------------------- puertas */

  _buildDoors(definitions, doorScene) {
    let panelGeometry = null;
    doorScene.traverse((object) => {
      if (!panelGeometry && object.isMesh) panelGeometry = object.geometry;
    });
    if (!panelGeometry) throw new Error('door.glb no contiene una malla');

    for (const definition of definitions) {
      const group = new THREE.Group();
      group.position.set(definition.position[0], definition.position[1], definition.position[2]);
      if (definition.axis === 'x') group.rotation.y = Math.PI / 2;
      group.layers.set(1);

      const panels = [];
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(panelGeometry, this.mats.int_door);
        panel.position.x = side * definition.width * 0.25;
        panel.layers.set(1);
        panel.castShadow = false;
        panel.receiveShadow = false;
        group.add(panel);
        panels.push({ mesh: panel, side });
      }
      this.group.add(group);

      const half =
        definition.axis === 'z'
          ? [definition.width / 2, definition.height / 2, 0.09]
          : [0.09, definition.height / 2, definition.width / 2];
      const body = this.physics.box(definition.position, half, FILTERS);

      const door = {
        id: definition.id,
        module: definition.module,
        axis: definition.axis,
        width: definition.width,
        height: definition.height,
        auto: definition.auto !== false,
        position: [...definition.position],
        group,
        panels,
        body,
        // Estado único compartido por animación y collider.
        state: 'closed',
        progress: 0,
        target: 0,
        solid: true,
        debugMesh: null,
      };

      // Caja de depuración del collider de la compuerta.
      const debugMesh = new THREE.Mesh(
        new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
        this.occluderMaterial
      );
      debugMesh.position.copy(group.position);
      debugMesh.visible = false;
      debugMesh.layers.enable(0);
      debugMesh.layers.enable(1);
      this.group.add(debugMesh);
      door.debugMesh = debugMesh;

      this.doors.push(door);
      if (door.id === 'airlock_outer') this.airlock.outer = door;
      if (door.id === 'airlock_inner') this.airlock.inner = door;
    }
  }

  /* ----------------------------------------------------- estado de compuertas */

  getDoor(id) {
    return this.doors.find((door) => door.id === id) ?? null;
  }

  getDoorState(id) {
    return this.getDoor(id)?.state ?? null;
  }

  /** Fija el objetivo de una compuerta y actualiza su estado de inmediato. */
  setDoorTarget(id, target) {
    const door = this.getDoor(id);
    if (!door) return null;
    door.target = target > 0.5 ? 1 : 0;
    this._syncDoorState(door);
    return door;
  }

  openDoor(id) {
    return this.setDoorTarget(id, 1);
  }

  closeDoor(id) {
    return this.setDoorTarget(id, 0);
  }

  toggleDoor(id) {
    const door = this.getDoor(id);
    if (!door) return null;
    return this.setDoorTarget(id, door.target > 0.5 ? 0 : 1);
  }

  _syncDoorState(door) {
    if (door.target > 0.5 && door.progress < 0.999) {
      door.state = 'opening';
    } else if (door.target > 0.5) {
      door.state = 'open';
    } else if (door.progress > 0.001) {
      door.state = 'closing';
    } else {
      door.state = 'closed';
    }
  }

  /** Diagnóstico para pruebas y depuración (F3). */
  getDoorDiagnostics() {
    return this.doors.map((door) => ({
      id: door.id,
      module: door.module,
      state: door.state,
      progress: Number(door.progress.toFixed(3)),
      target: door.target,
      solid: door.solid,
      position: [...door.position],
      axis: door.axis,
    }));
  }

  /** Muestra u oculta los colliders del interior (modo depuración F3). */
  setDebugColliders(visible) {
    this.debugColliders = !!visible;
    if (!this.occluderMaterial) return;
    this.occluderMaterial.wireframe = true;
    this.occluderMaterial.transparent = true;
    this.occluderMaterial.opacity = 0.32;
    this.occluderMaterial.depthTest = false;
    this.occluderMaterial.color.set(0x5ff0ff);
    for (const occluder of this.occluders) occluder.visible = this.debugColliders;
    for (const door of this.doors) {
      if (door.debugMesh) door.debugMesh.visible = this.debugColliders;
    }
  }

  /* ------------------------------------------------------- luces de estado */

  _buildStatusLights() {
    const positions = [];
    this.statusIndex = [];

    for (const door of this.doors) {
      const [x, y, z] = door.position ?? door.group.position.toArray();
      const nx = door.axis === 'z' ? 0 : 0.16;
      const nz = door.axis === 'z' ? 0.16 : 0;
      const first = positions.length / 3;
      positions.push(x - nx, y + 0.85, z - nz);
      positions.push(x + nx, y + 0.85, z + nz);
      this.statusIndex.push({ door, first });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.statusColors = new Float32Array(positions.length);
    geometry.setAttribute('color', new THREE.BufferAttribute(this.statusColors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.17,
      map: makeGlowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.statusPoints = new THREE.Points(geometry, material);
    this.statusPoints.layers.set(1);
    this.group.add(this.statusPoints);
  }

  /* ------------------------------------------------------------------ luces */

  _buildLights() {
    // Intensidades moderadas: las tiras emisivas del techo ya aportan luz y
    // con decay 2 un valor alto quema las superficies cercanas.
    const lights = [
      [0, -8.7, -2.8, 9, 10],
      [0, -8.7, -11.5, 10, 11],
      [5.0, -8.7, -1.5, 9, 12],
      [-5.0, -8.7, -1.5, 9, 12],
      // Expansión: hangar, alas oeste y norte.
      [15.0, -7.2, -5.0, 14, 18],
      [24.0, -7.2, -5.0, 14, 18],
      [-11.7, -8.7, -1.5, 8, 10],
      [-11.7, -8.7, 4.5, 8, 10],
      [-18.0, -8.7, 1.5, 8, 11],
      [-5.1, -8.7, 4.2, 8, 9],
      [4.5, -8.7, -18.5, 9, 11],
      [-4.5, -8.7, -18.5, 8, 10],
      [12.5, -8.7, -18.5, 8, 10],
      [20.0, -8.7, -18.5, 8, 10],
    ];

    this.lights = [];
    for (const [x, y, z, intensity, distance] of lights) {
      const light = new THREE.PointLight(0xbfe4ff, intensity, distance, 2);
      light.position.set(x, y, z);
      light.layers.set(1);
      light.userData.baseIntensity = intensity;
      this.group.add(light);
      this.lights.push(light);
    }

    // Relleno de bajo coste para los perfiles que usan menos luces puntuales.
    this.ambient = new THREE.HemisphereLight(0x9fc7e8, 0x11161f, 0);
    this.ambient.layers.set(1);
    this.group.add(this.ambient);
  }

  /** Módulo que contiene la posición (o null). */
  getModuleAt(position) {
    for (const [id, module] of Object.entries(this.modules)) {
      if (
        position.x >= module.min[0] - 0.6 &&
        position.x <= module.max[0] + 0.6 &&
        position.z >= module.min[2] - 0.6 &&
        position.z <= module.max[2] + 0.6 &&
        position.y >= module.min[1] - 0.9 &&
        position.y <= module.max[1] + 0.9
      ) {
        return { id, ...module };
      }
    }
    return null;
  }

  /* ----------------------------------------------------------------- estado */

  /**
   * Muestra u oculta todo el interior (solo al cambiar de destino).
   * La estructura del casco se controla aparte con setDetailVisible.
   */
  setVisible(visible) {
    const next = !!visible;
    if (next && !this.group.visible) this.lightBudgetTimer = 0;
    this.group.visible = next;
  }

  /**
   * Oculta el detalle interior cuando el astronauta está fuera: props (suelo,
   * tejidos, pantallas), puertas, marcadores y luces. El casco (hull, paneles,
   * remates y cristales) sigue dibujándose para que la estación no desaparezca
   * al alejarse en EVA.
   */
  setDetailVisible(visible) {
    const next = !!visible;
    if (next === this.detailVisible) return;
    this.detailVisible = next;
    if (next) this.lightBudgetTimer = 0;
    this._applyDetailState();
  }

  /** Aplica el estado actual de detalle (también tras cargar el GLB). */
  _applyDetailState() {
    const next = this.detailVisible;
    for (const mesh of this.detailMeshes) mesh.visible = next;
    for (const door of this.doors) door.group.visible = next;
    if (this.statusPoints) this.statusPoints.visible = next;
    // Fuera de la estación las luces puntuales no aportan nada visible y
    // cuestan mucho en la UHD 620: el casco queda a la luz del sol.
    if (!next) for (const light of this.lights ?? []) light.visible = false;
  }

  setCollisionActive(active) {
    this.collisionActive = active;
    for (const body of this.bodies) body.collisionResponse = active;
    for (const door of this.doors) {
      door.solid = active && door.state === 'closed';
      door.body.collisionResponse = door.solid;
    }
  }

  contains(position) {
    for (const module of Object.values(this.modules)) {
      if (
        position.x > module.min[0] - 0.5 &&
        position.x < module.max[0] + 0.5 &&
        position.z > module.min[2] - 0.5 &&
        position.z < module.max[2] + 0.5 &&
        position.y > module.min[1] - 0.8 &&
        position.y < module.max[1] + 0.8
      ) {
        return true;
      }
    }
    return false;
  }

  _inAirlock(position) {
    const bounds = this.airlock.bounds;
    if (!bounds) return false;
    return (
      position.x > bounds.min[0] - 0.2 &&
      position.x < bounds.max[0] + 0.2 &&
      position.z > bounds.min[2] - 0.2 &&
      position.z < bounds.max[2] + 0.2 &&
      position.y > bounds.min[1] - 0.6 &&
      position.y < bounds.max[1] + 0.6
    );
  }

  _emit(type) {
    this.onEvent?.(type);
  }

  /* --------------------------------------------------------------- update */

  update(dt, playerPosition) {
    if (!this.loaded) return;

    this.time += dt;

    if (this.group.visible) this._updateLightBudget(dt, playerPosition);
    this._updateAirlock(dt, playerPosition);
    this._updateDoors(dt, playerPosition);
    this._updateStatusLights();
    this._updateScreens(dt);
  }

  /**
   * Secuencia explícita de esclusa. Sólo arranca con E y nunca cierra una
   * compuerta encima del jugador: espera a que el cuerpo esté despejado.
   */
  _updateAirlock(dt, position) {
    const airlock = this.airlock;
    const { outer, inner } = airlock;
    if (!outer || !inner || !airlock.bounds) return;

    const bounds = airlock.bounds;
    const inAirlock = this._inAirlock(position);
    const outside = position.z > bounds.max[2] + 0.25;
    const outerClear = position.z < bounds.max[2] - 0.55;
    const innerClearEnter = position.z < bounds.min[2] - 0.55;
    const innerClearExit = position.z > bounds.min[2] + 0.55;

    // Cancelación por alejamiento: si el jugador abandona la zona con una
    // compuerta abierta, se cierra y la esclusa vuelve a su estado de reposo.
    const farFromOuter = outer.group.position.distanceTo(position) > 6.5;
    const farFromInner = inner.group.position.distanceTo(position) > 6.5;

    switch (airlock.phase) {
      case 'sealed':
      case 'vacuum':
        // La interacción E es la única que inicia la secuencia.
        break;

      case 'openingOuter':
        if (outer.progress >= 0.98) {
          airlock.phase = 'outerOpen';
          airlock.wait = 0;
        }
        break;

      case 'outerOpen':
        if (airlock.direction === 'enter') {
          if (outerClear) {
            // Ya está dentro del cuello: cerrar y presurizar.
            airlock.phase = 'closingOuter';
            outer.target = 0;
          } else {
            // Esperar a que entre. Si se aleja, se aborta sin presurizar.
            airlock.wait += dt;
            if (farFromOuter && airlock.wait > 1.5) {
              airlock.direction = 'abort';
              airlock.phase = 'closingOuter';
              outer.target = 0;
            }
          }
        } else if (airlock.direction === 'exit' && outside) {
          airlock.phase = 'closingOuter';
          outer.target = 0;
        }
        break;

      case 'closingOuter':
        if (outer.progress <= 0.02) {
          const wasExit = airlock.direction === 'exit';
          if (airlock.direction === 'enter') {
            airlock.phase = 'pressurizing';
            airlock.timer = 1.4;
            airlock.pressurized = false;
            airlock.pressure = 0;
            this._emit('pressurizing');
          } else {
            // Salida completada o entrada abortada: el estado depende de si
            // la esclusa quedó con presión o en vacío.
            airlock.phase = airlock.pressurized ? 'sealed' : 'vacuum';
            airlock.direction = null;
            airlock.armed = true;
            airlock.wait = 0;
            if (!airlock.pressurized) {
              airlock.pressure = 0;
              if (wasExit) this._emit('exited');
            }
          }
        }
        break;

      case 'pressurizing':
        airlock.timer -= dt;
        airlock.pressure = Math.max(0, Math.min(1, 1 - airlock.timer / 1.4));
        if (airlock.timer <= 0) {
          airlock.pressurized = true;
          airlock.pressure = 1;
          airlock.phase = 'openingInner';
          inner.target = 1;
          this._emit('pressurized');
        }
        break;

      case 'openingInner':
        if (inner.progress >= 0.98) {
          airlock.phase = 'innerOpen';
          airlock.wait = 0;
        }
        break;

      case 'innerOpen':
        if (airlock.direction === 'enter') {
          if (innerClearEnter) {
            airlock.phase = 'closingInner';
            inner.target = 0;
          }
        } else if (airlock.direction === 'exit') {
          if (inAirlock && innerClearExit) {
            airlock.phase = 'closingInner';
            inner.target = 0;
          } else {
            airlock.wait += dt;
            if (farFromInner && airlock.wait > 1.5) {
              airlock.direction = 'abort';
              airlock.phase = 'closingInner';
              inner.target = 0;
            }
          }
        }
        break;

      case 'closingInner':
        if (inner.progress <= 0.02) {
          airlock.wait = 0;
          if (airlock.direction === 'exit') {
            airlock.phase = 'depressurizing';
            airlock.timer = 1.4;
            this._emit('depressurizing');
          } else {
            airlock.phase = airlock.pressurized ? 'sealed' : 'vacuum';
            airlock.direction = null;
            airlock.armed = true;
            if (airlock.pressurized) {
              airlock.pressure = 1;
              this._emit('entered');
            }
          }
        }
        break;

      case 'depressurizing':
        airlock.timer -= dt;
        airlock.pressure = Math.max(0, Math.min(1, airlock.timer / 1.4));
        if (airlock.timer <= 0) {
          airlock.pressurized = false;
          airlock.pressure = 0;
          airlock.phase = 'openingOuter';
          outer.target = 1;
          this._emit('depressurized');
        }
        break;

      default:
        break;
    }

    // Con la compuerta interior abierta la esclusa sigue a presión ambiental.
    if (inAirlock && airlock.phase === 'innerOpen' && airlock.pressurized) {
      airlock.pressure = 1;
    }
  }

  /** Acción de esclusa disponible para el jugador (o null). */
  getAirlockAction(position) {
    const airlock = this.airlock;
    const { outer, inner } = airlock;
    if (!outer || !inner || !airlock.bounds) return null;
    if (!['sealed', 'vacuum'].includes(airlock.phase)) return null;

    const bounds = airlock.bounds;
    const outside = position.z > bounds.max[2] + 0.25;
    const inside = position.z < bounds.min[2] - 0.25;
    const nearOuter = outer.group.position.distanceTo(position) < 3.5;
    const nearInner = inner.group.position.distanceTo(position) < 3.5;

    if (outside && nearOuter) {
      return {
        type: 'enter',
        key: 'E',
        label: 'ENTRAR A LA NAVE',
      };
    }
    if (inside && nearInner && airlock.phase === 'sealed') {
      return { type: 'exit', key: 'E', label: 'SALIR AL EXTERIOR' };
    }
    return null;
  }

  /** Inicia la secuencia de entrada o salida. Devuelve true si arrancó. */
  requestAirlock(position) {
    const action = this.getAirlockAction(position);
    if (!action) return false;

    const airlock = this.airlock;
    airlock.wait = 0;
    if (action.type === 'enter') {
      airlock.direction = 'enter';
      airlock.phase = 'openingOuter';
      airlock.armed = false;
      airlock.outer.target = 1;
    } else {
      airlock.direction = 'exit';
      airlock.phase = 'openingInner';
      airlock.armed = false;
      airlock.inner.target = 1;
    }

    this._emit('airlockOpen');
    return true;
  }

  /** Estado legible para el HUD. */
  getAirlockStatus() {
    const airlock = this.airlock;
    const labels = {
      sealed: airlock.pressurized ? 'PRESURIZADA' : 'VACÍO',
      vacuum: 'VACÍO',
      openingOuter: 'ABRIENDO EXTERIOR',
      outerOpen: 'EXTERIOR ABIERTA',
      closingOuter: 'CERRANDO EXTERIOR',
      pressurizing: 'PRESURIZANDO',
      openingInner: 'ABRIENDO INTERIOR',
      innerOpen: 'INTERIOR ABIERTA',
      closingInner: 'CERRANDO INTERIOR',
      depressurizing: 'DESPRESURIZANDO',
    };
    return {
      phase: airlock.phase,
      pressure: airlock.pressure,
      pressurized: airlock.pressurized,
      label: labels[airlock.phase] ?? airlock.phase.toUpperCase(),
    };
  }

  isSafe(position) {
    const bounds = this.airlock.bounds;
    // Justo fuera de la compuerta exterior no hay presión, aunque el margen
    // de `contains` todavía incluya el collar de la esclusa.
    if (bounds && position.z > bounds.max[2]) return false;

    if (this._inAirlock(position)) {
      const airlock = this.airlock;
      return airlock.pressurized && airlock.pressure > 0.65;
    }
    return this.contains(position);
  }

  _updateDoors(dt, position) {
    for (const door of this.doors) {
      if (door.auto) {
        // Distancia horizontal + tolerancia vertical: la compuerta se abre
        // al acercarse por su vano, no desde otra planta o pasillo.
        const dx = door.group.position.x - position.x;
        const dz = door.group.position.z - position.z;
        const dy = Math.abs(door.group.position.y - position.y);
        const distance = Math.hypot(dx, dz);
        const inFront = distance < 2.8 && dy < 2.2;
        if (inFront) door.target = 1;
        else if (distance > 3.8 || dy >= 2.2) door.target = 0;
      }

      const delta = door.target - door.progress;
      if (Math.abs(delta) > 0.0005) {
        const step = Math.min(Math.abs(delta), dt * 3.2);
        door.progress += Math.sign(delta) * step;

        const eased = door.progress * door.progress * (3 - 2 * door.progress);
        for (const panel of door.panels) {
          panel.mesh.position.x = panel.side * (door.width * 0.25 + door.width * 0.5 * eased);
        }
      } else {
        door.progress = door.target;
      }

      this._syncDoorState(door);

      // El collider sigue el mismo estado que la animación: sólo es sólido
      // cuando la compuerta está completamente cerrada.
      const solid = this.collisionActive && door.state === 'closed';
      door.solid = solid;
      if (door.body.collisionResponse !== solid) door.body.collisionResponse = solid;
    }
  }

  _updateStatusLights() {
    if (!this.statusColors) return;

    const airlockBusy =
      this.airlock.phase === 'pressurizing' || this.airlock.phase === 'depressurizing';
    const blink = Math.sin(this.time * 9) > 0;

    for (const { door, first } of this.statusIndex) {
      const isAirlock = door === this.airlock.outer || door === this.airlock.inner;
      const color =
        airlockBusy && isAirlock
          ? blink
            ? AMBER
            : RED
          : door.state === 'open'
            ? GREEN
            : door.state === 'opening' || door.state === 'closing'
              ? AMBER
              : RED;

      for (let i = 0; i < 2; i++) {
        const offset = (first + i) * 3;
        this.statusColors[offset] = color.r;
        this.statusColors[offset + 1] = color.g;
        this.statusColors[offset + 2] = color.b;
      }
    }

    this.statusPoints.geometry.attributes.color.needsUpdate = true;
  }

  _updateScreens(dt) {
    this.screenTimer -= dt;
    if (this.screenTimer > 0) return;

    this.screenTimer = 0.1;
    this._drawScreen(this.time);
    this.screenTexture.needsUpdate = true;
    this._drawRadar(this.time);
    this.radarTexture.needsUpdate = true;
  }

  /* ----------------------------------------------------------------- reset */

  reset() {
    const airlock = this.airlock;
    airlock.phase = 'sealed';
    airlock.direction = null;
    airlock.timer = 0;
    airlock.wait = 0;
    airlock.armed = true;
    airlock.pressurized = true;
    airlock.pressure = 1;
    this.powerLevel = 1;

    for (const door of this.doors) {
      door.progress = 0;
      door.target = 0;
      door.state = 'closed';
      door.solid = true;
      door.body.collisionResponse = true;
      for (const panel of door.panels) {
        panel.mesh.position.x = panel.side * door.width * 0.25;
      }
    }

    this._applyLightPower();
  }

  /** Nivel de potencia del hábitat (0,6 emergencia → 1 plena). */
  setPower(level) {
    this.powerLevel = Math.max(0.6, Math.min(1, level));
    this._applyLightPower();
  }

  _applyLightPower() {
    const id = this.preset?.id;
    const scale = id === 'high' ? 1 : id === 'standard' || id === 'balanced' ? 0.92 : 0.8;
    for (const light of this.lights ?? []) {
      light.intensity = (light.userData.baseIntensity ?? light.intensity) * scale * this.powerLevel;
    }
    if (this.ambient) {
      this.ambient.intensity = id === 'high' ? 0 : id === 'standard' || id === 'balanced' ? 0.3 : 0.6;
    }
    // Forzar un recálculo del presupuesto de luces al cambiar de preset.
    this.lightBudgetTimer = 0;
  }

  /** Número máximo de luces puntuales activas según el preset. */
  _lightBudget() {
    const id = this.preset?.id;
    if (id === 'high') return 10;
    if (id === 'standard' || id === 'balanced') return 7;
    return 4;
  }

  /**
   * Mantiene encendidas sólo las luces más cercanas al jugador. Reduce el
   * coste por fragmento sin apagar la iluminación de la sala actual.
   */
  _updateLightBudget(dt, position) {
    if (!this.lights || this.lights.length === 0) return;
    if (!this.detailVisible) {
      for (const light of this.lights) light.visible = false;
      return;
    }
    this.lightBudgetTimer = (this.lightBudgetTimer ?? 0) - dt;
    if (this.lightBudgetTimer > 0) return;
    this.lightBudgetTimer = 0.2;

    const budget = this._lightBudget();
    if (budget >= this.lights.length) {
      for (const light of this.lights) light.visible = true;
      return;
    }

    const ranked = this.lights
      .map((light, index) => ({ light, index, d: light.position.distanceToSquared(position) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < ranked.length; i++) {
      ranked[i].light.visible = i < budget;
    }
  }

  setQuality(preset) {
    this.preset = preset;
    this._applyLightPower();
  }
}
