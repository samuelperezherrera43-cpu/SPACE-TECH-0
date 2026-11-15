import * as THREE from 'three';
import { GROUP } from '../engine/Physics.js';
import { makeGlowTexture, makeCrackTexture } from '../engine/Textures.js';

/**
 * Puntos candidatos de fuga. La posición está sobre la superficie del módulo
 * y la normal indica hacia dónde escapa el aire (y hacia dónde mirar).
 */
const BREACH_POINTS = [
  { position: [4.0, 0.79, 0.2], normal: [0, 1, 0], type: 'hull' },
  { position: [6.4, 0.79, -0.2], normal: [0, 1, 0], type: 'valve' },
  { position: [8.4, 0.0, 0.78], normal: [0, 0, 1], type: 'hull' },
  { position: [-4.6, 0.79, 0.2], normal: [0, 1, 0], type: 'hull' },
  { position: [-7.2, 0.0, -0.78], normal: [0, 0, -1], type: 'valve' },
  { position: [0.78, 0.79, 4.2], normal: [0, 1, 0], type: 'hull' },
  { position: [-0.78, 0.0, 6.6], normal: [-1, 0, 0], type: 'valve' },
  { position: [0.2, 0.79, 8.2], normal: [0, 1, 0], type: 'hull' },
  { position: [0.2, 0.79, -4.4], normal: [0, 1, 0], type: 'valve' },
  { position: [0.78, 0.0, -6.8], normal: [1, 0, 0], type: 'hull' },
  { position: [1.84, 1.9, 1.84], normal: [0.707, 0, 0.707], type: 'hull' },
  { position: [-1.84, -1.7, 1.84], normal: [-0.707, 0, 0.707], type: 'valve' },
];

const MAX_ACTIVE = 3;

/**
 * Estación espacial procedural + fugas reparables.
 * Todos los colisionadores son estáticos (mass = 0).
 */
export class Station {
  constructor(scene, physics, leakParticles, materials) {
    this.scene = scene;
    this.physics = physics;
    this.leakParticles = leakParticles;
    this.materials = materials;

    this.group = new THREE.Group();
    this.group.name = 'station';
    scene.add(this.group);

    this.occluders = [];
    this.hitMeshes = [];
    this.points = [];
    this.bodies = [];
    this.active = [];
    this.repairedCount = 0;
    this.totalBreaches = 8;
    this.time = 0;
    this.navLights = [];

    this.glowTexture = makeGlowTexture();
    this.crackTexture = makeCrackTexture();

    this._buildMaterials();
    this._buildStation();
    this._buildBreaches();
    this.reset();
  }

  /** Activa sombras solo en la geometría que aporta volumen. */
  _shadow(mesh, cast = true, receive = true) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  /* --------------------------------------------------------------- materiales */

  _buildMaterials() {
    if (!this.materials) {
      throw new Error('Station requiere una MaterialLibrary');
    }
    this.matHull = this.materials.hull;
    this.matHullDark = this.materials.hullDark;
    this.matDark = this.materials.dark;
    this.matPanel = this.materials.solar;
    this.matAccent = this.materials.accent;
    this.matGreen = this.materials.green;
    this.matRed = this.materials.red;
  }

  _addCollider(mesh, kind = 'box', size = null) {
    this.occluders.push(mesh);
    const filters = { collisionFilterGroup: GROUP.STATION, collisionFilterMask: GROUP.PLAYER };
    const p = mesh.position;

    let body;
    if (kind === 'cylinder') {
      body = this.physics.cylinder([p.x, p.y, p.z], size.radius, size.height, 12, filters);
    } else {
      body = this.physics.box([p.x, p.y, p.z], [size[0], size[1], size[2]], filters);
    }
    this.bodies.push(body);
    return body;
  }

  /** Activa/desactiva las colisiones de la estación al cambiar de destino. */
  setCollisionActive(active) {
    this.collisionActive = active;
    for (const body of this.bodies) body.collisionResponse = active;
  }

  /* ------------------------------------------------------------------ montaje */

  _buildStation() {
    const g = this.group;

    // Núcleo central
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 7, 18, 1), this.matHull);
    g.add(hub);
    this._shadow(hub, true, true);
    this._addCollider(hub, 'cylinder', { radius: 2.6, height: 7 });

    // Cúpula superior
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      this.matHull
    );
    dome.position.y = 3.5;
    g.add(dome);
    this._shadow(dome, true, true);
    this.occluders.push(dome);

    // Anillos del núcleo
    for (const y of [-2.3, 0, 2.3]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.09, 6, 26), this.matHullDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
      this._shadow(ring, true, false);
    }

    // Anillo de atraque
    const dockRing = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.3, 8, 26), this.matHullDark);
    dockRing.rotation.x = Math.PI / 2;
    dockRing.position.y = 3.6;
    g.add(dockRing);
    this._shadow(dockRing, true, false);

    // Ventanas / tiras emisivas del núcleo
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.06), this.matAccent);
      strip.position.set(Math.cos(angle) * 2.61, 1.15, Math.sin(angle) * 2.61);
      strip.rotation.y = -angle;
      g.add(strip);
    }

    // Antena
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 6), this.matHullDark);
    mast.position.y = 5.2;
    g.add(mast);
    this._shadow(mast, true, false);

    this.dish = new THREE.Group();
    this.dish.position.y = 6.5;
    const dishMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
      this.matHull
    );
    dishMesh.rotation.x = Math.PI;
    dishMesh.position.y = 0.25;
    this.dish.add(dishMesh);
    this._shadow(dishMesh, true, true);

    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xff5c6c,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    beacon.scale.setScalar(1.2);
    beacon.position.y = 0.55;
    this.dish.add(beacon);
    g.add(this.dish);
    this.navLights.push({ glow: beacon, base: 0.72, phase: 0, rate: 2.6, kind: 'beacon' });

    // Cuatro brazos con paneles solares
    const armGeo = new THREE.BoxGeometry(7, 1.5, 1.5);
    const segmentGeo = new THREE.BoxGeometry(2.4, 0.92, 1.56);
    const capGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.9, 12);
    const strutGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6);
    const panelGeo = new THREE.BoxGeometry(0.12, 3.4, 6);

    const arms = [
      { position: [6.1, 0, 0], rotation: 0 },
      { position: [-6.1, 0, 0], rotation: Math.PI },
      { position: [0, 0, 6.1], rotation: -Math.PI / 2 },
      { position: [0, 0, -6.1], rotation: Math.PI / 2 },
    ];

    for (let i = 0; i < arms.length; i++) {
      const arm = new THREE.Group();
      arm.position.set(...arms[i].position);
      arm.rotation.y = arms[i].rotation;

      const body = new THREE.Mesh(armGeo, this.matHull);
      arm.add(body);
      this._shadow(body, true, true);

      for (const x of [-2.2, 2.2]) {
        const segment = new THREE.Mesh(segmentGeo, this.matDark);
        segment.position.x = x;
        arm.add(segment);
        this._shadow(segment, true, true);
      }

      // Costillas
      for (const x of [-3.2, 0, 3.2]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.62, 1.62), this.matHullDark);
        rib.position.x = x;
        arm.add(rib);
        this._shadow(rib, false, true);
      }

      // Tapa del extremo
      const cap = new THREE.Mesh(capGeo, this.matHullDark);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = 3.6;
      arm.add(cap);
      this._shadow(cap, false, true);

      // Mástil y panel
      const strut = new THREE.Mesh(strutGeo, this.matHullDark);
      strut.rotation.z = Math.PI / 2;
      strut.position.x = 4.8;
      arm.add(strut);
      this._shadow(strut, true, false);

      const panel = new THREE.Mesh(panelGeo, this.matPanel);
      panel.position.x = 5.9;
      arm.add(panel);
      this._shadow(panel, true, false);

      // Luces de navegación: babor rojo, estribor verde + glow aditivo.
      for (const z of [-2.85, 2.85]) {
        const color = z < 0 ? 0xff4d5e : 0x5cff9d;
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 6, 5),
          z < 0 ? this.matRed : this.matGreen
        );
        light.position.set(5.9, 1.62, z);
        arm.add(light);

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTexture,
          color,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }));
        glow.scale.setScalar(0.85);
        glow.position.copy(light.position);
        arm.add(glow);

        this.navLights.push({
          glow,
          base: 0.55,
          phase: i * 1.9 + (z < 0 ? 0 : Math.PI),
          rate: 3.4,
          kind: 'nav',
        });
      }

      g.add(arm);
      this.occluders.push(body, panel);
    }

    // Colisionadores de los paneles (en coordenadas de mundo)
    for (const sign of [-1, 1]) {
      this.bodies.push(this.physics.box([sign * 12.0, 0, 0], [0.08, 1.7, 3.0], {
        collisionFilterGroup: GROUP.STATION,
        collisionFilterMask: GROUP.PLAYER,
      }));
      this.bodies.push(this.physics.box([0, 0, sign * 12.0], [3.0, 1.7, 0.08], {
        collisionFilterGroup: GROUP.STATION,
        collisionFilterMask: GROUP.PLAYER,
      }));
    }

    // Colisionadores de los brazos (cajas alineadas a los ejes)
    for (const sign of [-1, 1]) {
      this.bodies.push(this.physics.box([sign * 6.1, 0, 0], [3.5, 0.75, 0.75], {
        collisionFilterGroup: GROUP.STATION,
        collisionFilterMask: GROUP.PLAYER,
      }));
      this.bodies.push(this.physics.box([0, 0, sign * 6.1], [0.75, 0.75, 3.5], {
        collisionFilterGroup: GROUP.STATION,
        collisionFilterMask: GROUP.PLAYER,
      }));
    }

    // Puerto de oxígeno (zona de recarga)
    const port = new THREE.Group();
    port.position.set(0, -1.7, 2.52);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 12), this.matDark);
    plate.rotation.x = Math.PI / 2;
    plate.position.z = 0.06;
    port.add(plate);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 18), this.matGreen);
    ring.position.z = 0.15;
    port.add(ring);

    this.portGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0x6dffa8,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.portGlow.scale.setScalar(2.0);
    this.portGlow.position.z = 0.2;
    port.add(this.portGlow);

    g.add(port);
    this.o2Port = new THREE.Vector3(0, -1.7, 3.1);
  }

  /* ------------------------------------------------------------------ fugas */

  _buildBreaches() {
    for (let i = 0; i < BREACH_POINTS.length; i++) {
      const def = BREACH_POINTS[i];
      const normal = new THREE.Vector3(...def.normal).normalize();
      const position = new THREE.Vector3(...def.position).addScaledVector(normal, 0.05);
      const isValve = def.type === 'valve';
      const color = isValve ? 0xff5c6c : 0xffa050;

      const group = new THREE.Group();
      group.position.copy(position);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      group.visible = false;

      const crack = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.15),
        new THREE.MeshBasicMaterial({
          map: this.crackTexture,
          color,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      crack.position.z = 0.02;
      group.add(crack);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      glow.scale.setScalar(2.4);
      glow.position.z = 0.06;
      group.add(glow);

      // Esfera invisible generosa para apuntar con el raycast.
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(1.05, 6, 5),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.position.z = 0.35;
      group.add(hit);

      this.group.add(group);

      const breach = {
        id: i,
        position,
        normal,
        type: def.type,
        group,
        glow,
        crack,
        hit,
        active: false,
        repaired: false,
        progress: 0,
        spawnT: 0,
        leakT: 0,
        phase: Math.random() * Math.PI * 2,
      };

      hit.userData.breach = breach;
      this.hitMeshes.push(hit);
      this.points.push(breach);
    }
  }

  /* ----------------------------------------------------------------- estado */

  reset() {
    this.repairedCount = 0;
    this.time = 0;
    this.active.length = 0;

    for (const breach of this.points) {
      breach.active = false;
      breach.repaired = false;
      breach.progress = 0;
      breach.spawnT = 0;
      breach.group.visible = false;
      breach.group.scale.setScalar(1);
    }

    this.spawn();
    this.spawn();
    this.spawn();
  }

  spawn() {
    if (this.active.length >= MAX_ACTIVE) return null;

    const free = this.points.filter((b) => !b.active && !b.repaired);
    if (free.length === 0) return null;

    const breach = free[Math.floor(Math.random() * free.length)];
    breach.active = true;
    breach.repaired = false;
    breach.progress = 0;
    breach.spawnT = 0;
    breach.leakT = 0;
    breach.group.visible = true;
    breach.group.scale.setScalar(0.01);

    this.active.push(breach);
    return breach;
  }

  repair(breach) {
    if (!breach.active) return;

    breach.active = false;
    breach.repaired = true;
    breach.progress = 1;
    breach.group.visible = false;

    this.active = this.active.filter((b) => b !== breach);
    this.repairedCount++;
  }

  /** Estado reconstruible de las fugas (sin geometría). */
  serialize() {
    return {
      repaired: this.points.filter((breach) => breach.repaired).map((breach) => breach.id),
      active: this.active.map((breach) => breach.id),
      repairedCount: this.repairedCount,
    };
  }

  restore(snapshot) {
    if (!snapshot) return;
    this.repairedCount = 0;
    this.time = 0;
    this.active.length = 0;

    for (const breach of this.points) {
      breach.active = false;
      breach.repaired = false;
      breach.progress = 0;
      breach.spawnT = 0;
      breach.group.visible = false;
      breach.group.scale.setScalar(1);
    }

    const repaired = new Set(snapshot.repaired ?? []);
    for (const breach of this.points) {
      if (!repaired.has(breach.id)) continue;
      breach.repaired = true;
      breach.progress = 1;
      this.repairedCount++;
    }

    for (const id of snapshot.active ?? []) {
      const breach = this.points.find((item) => item.id === id);
      if (!breach || breach.repaired) continue;
      breach.active = true;
      breach.progress = 0;
      breach.spawnT = 0;
      breach.leakT = 0;
      breach.group.visible = true;
      breach.group.scale.setScalar(1);
      this.active.push(breach);
    }

    // Compatibilidad: si la instantánea sólo traía el contador, genera fugas.
    if (this.active.length === 0 && this.repairedCount < this.totalBreaches) {
      while (this.active.length < Math.min(MAX_ACTIVE, this.totalBreaches - this.repairedCount)) {
        if (!this.spawn()) break;
      }
    }
  }

  update(dt) {
    this.time += dt;

    if (this.dish) this.dish.rotation.y += dt * 0.3;

    // Luces de navegación: parpadeo suave desfasado por luz.
    for (const nav of this.navLights) {
      const wave = 0.5 + 0.5 * Math.sin(this.time * nav.rate + nav.phase);
      if (nav.kind === 'beacon') {
        // Baliza de la antena: destello corto y seco.
        const strobe = Math.pow(wave, 7);
        nav.glow.material.opacity = 0.18 + strobe * 0.82;
        nav.glow.scale.setScalar(0.9 + strobe * 0.7);
      } else {
        nav.glow.material.opacity = nav.base * (0.45 + wave * 0.55);
      }
    }

    for (const breach of this.active) {
      breach.spawnT = Math.min(1, breach.spawnT + dt * 3.5);
      const grow = 1 - Math.pow(1 - breach.spawnT, 3);
      breach.group.scale.setScalar(0.25 + grow * 0.75);

      breach.glow.material.opacity = 0.42 + 0.38 * Math.sin(this.time * 5 + breach.phase);

      breach.leakT -= dt;
      if (breach.leakT <= 0 && this.leakParticles) {
        breach.leakT = 0.11 + Math.random() * 0.12;
        this.leakParticles.spawn(breach.position, breach.normal, {
          speed: 2.3,
          spread: 0.55,
          life: 0.85,
          offset: 0.3,
        });
      }
    }

    if (this.portGlow) {
      this.portGlow.material.opacity = 0.45 + 0.3 * Math.sin(this.time * 2.4);
    }
  }
}
