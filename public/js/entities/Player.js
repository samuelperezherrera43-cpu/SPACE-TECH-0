import * as THREE from 'three';
import { GROUP } from '../engine/Physics.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _nozzle = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _upAlt = new THREE.Vector3(1, 0, 0);

const WALK_RADIUS = 0.32;
const CAPSULE_HEIGHT = 1.6;

/**
 * Astronauta: cápsula física (tres esferas) + esqueleto procedural con
 * articulaciones animadas. El mismo cuerpo sirve para caminar por el hábitat
 * (gravedad, frenado y suelo) y para la EVA de gravedad cero (inercia y RCS).
 */
export class Player {
  constructor(scene, physics, particles, materials, balance) {
    this.physics = physics;
    this.particles = particles;
    this.materials = materials;
    this.balance = balance;

    // Cápsula: radio horizontal y media altura del cuerpo físico.
    this.radius = WALK_RADIUS;
    this.capsuleHeight = CAPSULE_HEIGHT;
    this.halfHeight = CAPSULE_HEIGHT / 2;
    // La malla se apoya en el suelo cuando el grupo está a +0,065 del centro.
    this.footOffset = 0.065;

    this.energy = 100;
    this.o2 = 100;
    this.hull = 100;
    this.speed = 0;
    this.thrusting = false;
    this.dead = false;
    this.regenDelay = 0;
    this.safe = false;
    this.o2RegenScale = 1;
    this.lastImpact = -10;
    this.onDamage = null;

    this.thrustDir = new THREE.Vector3(0, 0, -1);
    this.facing = new THREE.Vector3(0, 0, 1);
    this.thrusterAccum = 0;
    this.time = 0;
    this.inside = false;

    // Movimiento a pie (interior y planetas). El modo 'zero' conserva la EVA.
    this.mode = 'zero';
    this.gravity = 9.80665;
    this.floorY = -10.4;
    this.groundHeight = null;
    this.walkSpeed = 3.6;
    this.walkAccel = 20;
    this.walkBrake = 18;
    this.airControl = 0.28;
    this.jumpSpeed = 4.4;
    this.jumpCooldown = 0;
    this.grounded = false;
    this.stepOffset = 0.28;

    // Animación procedural.
    this.anim = {
      phase: 0,
      action: null,
      timer: 0,
      seated: false,
      prevYaw: 0,
      lean: 0,
      state: 'idle',
    };

    this.body = physics.capsule([0, 2, 18], this.radius, this.capsuleHeight, 80, {
      fixedRotation: true,
      linearDamping: 0.1,
      angularDamping: 1,
      allowSleep: false,
      collisionFilterGroup: GROUP.PLAYER,
      collisionFilterMask: GROUP.STATION,
    });

    this.body.addEventListener('collide', (event) => this._onCollide(event));

    this.group = new THREE.Group();
    this.rig = this._buildMesh();
    this.group.add(this.rig.root);

    // Punto de anclaje de la herramienta (mano derecha, mirando a +Z).
    this.hand = new THREE.Group();
    this.hand.position.set(0.44, -0.18, 0.1);
    this.hand.rotation.set(-0.12, 0.32, 0.1);
    this.group.add(this.hand);

    this.dummy = new THREE.Object3D();
    scene.add(this.group);

    this.reset();
  }

  get position() {
    return this.group.position;
  }

  /* --------------------------------------------------------------- impactos */

  _onCollide(event) {
    const contact = event.contact;
    if (!contact) return;

    let impact = 0;
    try {
      impact = Math.abs(contact.getImpactVelocityAlongNormal());
    } catch {
      return;
    }

    const config = this.balance?.values;
    const threshold = config?.hullImpactThreshold ?? 3.2;
    if (impact < threshold) return;
    if (this.time - this.lastImpact < 0.75) return;

    this.lastImpact = this.time;
    const scale = (config?.hullImpactScale ?? 1) * (this.safe ? 0.25 : 1);
    const damage = Math.min(22, (impact - threshold) * 2.2 * scale);
    if (damage < 0.4) return;

    this.hull = Math.max(0, this.hull - damage);
    this.onDamage?.(damage, impact);
  }

  applyDamage(amount) {
    this.hull = Math.max(0, this.hull - Math.max(0, amount));
    if (this.hull <= 0) this.dead = true;
  }

  repairHull(amount) {
    this.hull = Math.min(100, this.hull + Math.max(0, amount));
  }

  /* ------------------------------------------------------------------ malla */

  /**
   * Esqueleto: caderas → torso → cuello/casco y caderas → piernas, con
   * grupos pivote en cada articulación. Los materiales son los de la
   * biblioteca compartida para no duplicar texturas.
   */
  _buildMesh() {
    if (!this.materials) throw new Error('Player requiere una MaterialLibrary');

    const suit = this.materials.suit;
    const dark = this.materials.suitDark;
    const visor = this.materials.visor;
    const accent = this.materials.accent;
    const metal = this.materials.metal ?? dark;

    const shadow = (mesh, cast = true) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      return mesh;
    };

    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.02;
    root.add(hips);

    // Pelvis y cinturón.
    const pelvis = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.12, 4, 10), suit));
    pelvis.rotation.z = Math.PI / 2;
    pelvis.position.y = 0.02;
    hips.add(pelvis);

    const belt = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.045, 6, 16), dark));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.08;
    hips.add(belt);

    // Torso.
    const torso = new THREE.Group();
    torso.position.y = 0.02;
    hips.add(torso);

    const chest = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.34, 5, 12), suit));
    chest.position.y = 0.25;
    torso.add(chest);

    const chestPanel = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.1), dark));
    chestPanel.position.set(0, 0.28, 0.23);
    torso.add(chestPanel);

    const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.02), accent);
    chestLight.position.set(0, 0.32, 0.29);
    torso.add(chestLight);

    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03), accent);
      rib.position.set(side * 0.17, 0.28, 0.275);
      torso.add(rib);
    }

    // Mochila de soporte vital, tanques y mangueras.
    const pack = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.22), dark));
    pack.position.set(0, 0.26, -0.31);
    torso.add(pack);

    for (const x of [-0.15, 0.15]) {
      const tank = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.4, 10), suit), false);
      tank.position.set(x, 0.27, -0.45);
      torso.add(tank);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.05, 10), metal);
      cap.position.set(x, 0.49, -0.45);
      torso.add(cap);
    }
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 5, 12, Math.PI), dark);
    hose.position.set(0.22, 0.36, -0.22);
    hose.rotation.set(0, 0.6, 0.4);
    torso.add(hose);

    // Cuello y casco.
    const neck = new THREE.Group();
    neck.position.y = 0.55;
    torso.add(neck);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 6, 18), dark);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = -0.02;
    neck.add(collar);

    const helmet = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 14), suit));
    neck.add(helmet);

    const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.255, 18, 14), visor);
    visorMesh.scale.set(1, 0.82, 0.62);
    visorMesh.position.set(0, 0.015, 0.12);
    neck.add(visorMesh);

    const visorTrim = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.022, 5, 18), accent);
    visorTrim.rotation.x = Math.PI / 2.6;
    visorTrim.position.set(0, 0.02, 0.14);
    visorTrim.scale.set(1, 0.82, 1);
    neck.add(visorTrim);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 5), dark);
    antenna.position.set(0.19, 0.25, -0.08);
    antenna.rotation.z = -0.18;
    neck.add(antenna);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.024, 7, 6), accent);
    beacon.position.set(0.22, 0.39, -0.08);
    neck.add(beacon);

    // Brazos con hombro y codo.
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.32, 0.39, 0);
      shoulder.rotation.z = side * 0.12;
      torso.add(shoulder);

      const shoulderPad = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), dark), false);
      shoulder.add(shoulderPad);

      const upper = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), suit), false);
      upper.position.y = -0.17;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.32;
      shoulder.add(elbow);

      const elbowRing = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.02, 5, 12), metal);
      elbowRing.rotation.x = Math.PI / 2;
      elbow.add(elbowRing);

      const fore = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.22, 4, 8), suit), false);
      fore.position.y = -0.15;
      elbow.add(fore);

      const glove = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), dark), false);
      glove.scale.set(1, 0.92, 1.15);
      glove.position.y = -0.31;
      elbow.add(glove);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.022, 5, 12), accent);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.25;
      elbow.add(cuff);

      arms[side === -1 ? 'left' : 'right'] = { shoulder, elbow, glove };
    }

    // Piernas con cadera y rodilla.
    const legs = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.14, -0.02, 0);
      hips.add(hip);

      const hipRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 5, 12), metal);
      hipRing.rotation.x = Math.PI / 2;
      hip.add(hipRing);

      const thigh = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.28, 4, 9), suit), false);
      thigh.position.y = -0.2;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.39;
      hip.add(knee);

      const kneeRing = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.022, 5, 12), metal);
      kneeRing.rotation.x = Math.PI / 2;
      knee.add(kneeRing);

      const shin = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.26, 4, 9), suit), false);
      shin.position.y = -0.19;
      knee.add(shin);

      const boot = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.28), dark), false);
      boot.position.set(0, -0.37, 0.05);
      knee.add(boot);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.03, 0.29), metal);
      sole.position.set(0, -0.445, 0.05);
      knee.add(sole);

      legs[side === -1 ? 'left' : 'right'] = { hip, knee };
    }

    return { root, hips, torso, neck, arms, legs };
  }

  /* ----------------------------------------------------------------- estado */

  reset() {
    this.body.position.set(0, 2, 18);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this.body.force.setZero();
    this.body.torque.setZero();

    this.energy = 100;
    this.o2 = 100;
    this.hull = 100;
    this.speed = 0;
    this.thrusting = false;
    this.dead = false;
    this.regenDelay = 0;
    this.safe = false;
    this.o2RegenScale = 1;
    this.lastImpact = -10;
    this.facing.set(0, 0, 1);
    this.thrustDir.set(0, 0, -1);
    this.mode = 'zero';
    this.groundHeight = null;
    this.grounded = false;
    this.jumpCooldown = 0;
    this.anim.action = null;
    this.anim.timer = 0;
    this.anim.seated = false;
    this.anim.phase = 0;
    this.anim.prevYaw = 0;

    this.group.position.set(0, 2, 18);
    this.group.quaternion.identity();
    this.group.rotation.y = Math.PI;
    this.facing.set(0, 0, -1);
    this.setInterior(false);
  }

  /**
   * Cambia la capa de iluminación: fuera (0, sol) / dentro (1, luces del
   * interior). Evita que el sol atraviese las paredes de los módulos.
   */
  setInterior(inside) {
    if (this.inside === inside) return;
    this.inside = inside;
    const layer = inside ? 1 : 0;
    this.group.traverse((object) => object.layers.set(layer));
  }

  setSafe(safe) {
    this.safe = safe;
  }

  /**
   * Cambia entre EVA en gravedad cero y locomoción a pie.
   * options: { gravity, floorY, groundHeight, walkSpeed, jumpSpeed }
   */
  setMode(mode, options = {}) {
    this.mode = mode === 'walk' ? 'walk' : 'zero';
    if (this.mode === 'walk') {
      this.gravity = options.gravity ?? 9.81;
      this.floorY = options.floorY ?? this.floorY;
      this.groundHeight = options.groundHeight ?? null;
      this.walkSpeed = options.walkSpeed ?? 3.6;
      this.walkAccel = options.walkAccel ?? 20;
      this.walkBrake = options.walkBrake ?? 18;
      this.airControl = options.airControl ?? 0.28;
      this.jumpSpeed = options.jumpSpeed ?? 4.4;
      this.grounded = false;
      this.jumpCooldown = 0;
    } else {
      this.groundHeight = null;
      this.grounded = false;
    }
  }

  /** Dispara una animación de acción breve (consola, reparación, recogida). */
  setAction(action, duration = 0.9) {
    this.anim.action = action;
    this.anim.timer = Math.max(0, duration);
  }

  /** Postura sentada mientras el panel/asiento está activo. */
  setSeated(seated) {
    this.anim.seated = !!seated;
  }

  _groundY(x, z, y = this.body.position.y) {
    return this.groundHeight ? this.groundHeight(x, z, y) : this.floorY;
  }

  /** Locomoción a pie: aceleración suave, frenado rápido y gravedad real. */
  _updateWalk(dt, input, camera, boost) {
    _wish.set(0, 0, 0);

    if (input.z) {
      camera.getWorldDirection(_forward);
      _forward.y = 0;
      if (_forward.lengthSq() > 1e-4) {
        _forward.normalize();
        _wish.addScaledVector(_forward, input.z);
      }
    }
    if (input.x) {
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _right.y = 0;
      if (_right.lengthSq() > 1e-4) {
        _right.normalize();
        _wish.addScaledVector(_right, input.x);
      }
    }

    const moving = _wish.lengthSq() > 1e-4;
    if (moving) _wish.normalize();

    const speed = boost ? this.walkSpeed * 1.55 : this.walkSpeed;
    const velocity = this.body.velocity;
    const accel = this.grounded ? this.walkAccel : this.walkAccel * this.airControl;
    const k = 1 - Math.exp(-dt * accel);
    velocity.x += (_wish.x * speed - velocity.x) * k;
    velocity.z += (_wish.z * speed - velocity.z) * k;

    if (!moving && this.grounded) {
      const brake = Math.exp(-dt * this.walkBrake);
      velocity.x *= brake;
      velocity.z *= brake;
    }

    velocity.y -= this.gravity * dt;

    const ground = this._groundY(
      this.body.position.x,
      this.body.position.z,
      this.body.position.y
    );
    const feet = this.body.position.y - this.halfHeight;
    // Snap al suelo: evita vibración al caminar junto a paredes y escalones.
    if (feet <= ground + this.stepOffset) {
      this.body.position.y = ground + this.halfHeight;
      if (velocity.y < 0) velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    if (input.y > 0 && this.grounded && this.jumpCooldown <= 0) {
      velocity.y = this.jumpSpeed;
      this.grounded = false;
      this.jumpCooldown = 0.35;
    }

    this.speed = Math.hypot(velocity.x, velocity.z);
    this.thrusting = false;
  }

  /** Aplica fuerzas y consume recursos. Llamar antes de physics.step(). */
  update(dt, input, camera, boost) {
    this.time += dt;

    if (this.anim.timer > 0) {
      this.anim.timer = Math.max(0, this.anim.timer - dt);
      if (this.anim.timer === 0) this.anim.action = null;
    }

    if (this.mode === 'walk') {
      this._updateWalk(dt, input, camera, boost);
    } else {
      _wish.set(0, 0, 0);

      if (input.z) {
        camera.getWorldDirection(_forward);
        _wish.addScaledVector(_forward, input.z);
      }
      if (input.x) {
        _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        _wish.addScaledVector(_right, input.x);
      }
      if (input.y) _wish.y += input.y;

      const wantsThrust = _wish.lengthSq() > 1e-4 && this.energy > 0.5;
      this.thrusting = wantsThrust;

      if (wantsThrust) {
        _wish.normalize();
        this.thrustDir.copy(_wish);

        const acceleration = boost ? 30 : 17;
        const force = this.body.mass * acceleration;
        this.body.applyForce(
          new THREE.Vector3(_wish.x * force, _wish.y * force, _wish.z * force)
        );
      }

      // Límite de velocidad arcade: sin gravedad, evita que la partida se descontrole.
      const velocity = this.body.velocity;
      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
      const maxSpeed = boost ? 22 : 13;

      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        velocity.x *= scale;
        velocity.y *= scale;
        velocity.z *= scale;
      }
      this.speed = Math.min(speed, maxSpeed);

      // Frontera suave de la zona de misión.
      const p = this.body.position;
      const distance = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
      if (distance > 150) {
        const pull = (distance - 150) * this.body.mass * 1.6;
        this.body.applyForce(
          new THREE.Vector3(
            (-p.x / distance) * pull,
            (-p.y / distance) * pull,
            (-p.z / distance) * pull
          )
        );
      }
    }

    const config = this.balance?.values ?? {
      o2Drain: 0.42,
      o2ThrustDrain: 0.16,
      o2Regen: 10,
      rcsDrain: 2.4,
      rcsBoostDrain: 3.8,
      rcsRegen: 12,
    };

    // RCS: sólo consume mientras se aplica impulso. En el exterior no se
    // regenera; al volver a una zona presurizada se recarga.
    if (this.thrusting) {
      const drain = boost ? config.rcsBoostDrain : config.rcsDrain;
      this.energy = Math.max(0, this.energy - drain * dt);
      this.regenDelay = 0.8;
    } else {
      this.regenDelay = Math.max(0, this.regenDelay - dt);
      if (this.safe) {
        this.energy = Math.min(100, this.energy + config.rcsRegen * dt);
      }
    }

    // Oxígeno: sólo se consume durante una EVA. Dentro del hábitat o en una
    // esclusa presurizada se recupera.
    if (this.safe) {
      this.o2 = Math.min(100, this.o2 + config.o2Regen * this.o2RegenScale * dt);
    } else {
      let drain = config.o2Drain;
      if (this.thrusting) drain += config.o2ThrustDrain;
      this.o2 = Math.max(0, this.o2 - drain * dt);
    }

    if (this.o2 <= 0 || this.hull <= 0) this.dead = true;
  }

  /* -------------------------------------------------------------- animación */

  _lerpJoint(euler, axis, target, dt, speed = 14) {
    if (!euler) return;
    euler[axis] += (target - euler[axis]) * (1 - Math.exp(-dt * speed));
  }

  _animate(dt) {
    const rig = this.rig;
    if (!rig) return;

    const moving = this.mode === 'walk' && this.speed > 0.25;
    const intensity = Math.min(1, this.speed / this.walkSpeed);
    if (moving) {
      this.anim.phase += dt * (5.2 + this.speed * 1.6);
    } else {
      this.anim.phase += dt * 1.2;
    }
    const phase = this.anim.phase;
    const swing = Math.sin(phase);
    const swing2 = Math.sin(phase * 2);

    // Giro: inclinación lateral suave según el cambio de rumbo.
    const yaw = this.group.rotation.y;
    let delta = yaw - this.anim.prevYaw;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.anim.prevYaw = yaw;
    const targetLean = Math.max(-0.18, Math.min(0.18, -delta * 1.6));
    this.anim.lean += (targetLean - this.anim.lean) * (1 - Math.exp(-dt * 8));

    let state = 'idle';
    let hipsY = 0.02;
    let torsoX = 0;
    let torsoZ = this.anim.lean;
    let neckX = 0;

    let leftHip = 0;
    let rightHip = 0;
    let leftKnee = 0;
    let rightKnee = 0;
    let leftShoulderX = 0;
    let rightShoulderX = 0;
    let leftShoulderZ = 0.12;
    let rightShoulderZ = -0.12;
    let leftElbow = 0;
    let rightElbow = 0;

    if (this.anim.seated) {
      state = 'sit';
      hipsY = -0.22;
      torsoX = 0.08;
      leftHip = -1.32;
      rightHip = -1.32;
      leftKnee = 1.42;
      rightKnee = 1.42;
      leftShoulderX = -0.5;
      rightShoulderX = -0.5;
      leftElbow = -0.55;
      rightElbow = -0.55;
    } else if (this.anim.action === 'repair') {
      state = 'repair';
      torsoX = 0.18;
      leftShoulderX = -0.95 + Math.sin(phase * 9) * 0.12;
      rightShoulderX = -1.05 + Math.cos(phase * 9) * 0.12;
      leftElbow = -0.75;
      rightElbow = -0.65;
      leftHip = -0.18;
      rightHip = 0.18;
      leftKnee = 0.25;
      rightKnee = 0.12;
    } else if (this.anim.action === 'interact') {
      state = 'interact';
      torsoX = 0.08;
      rightShoulderX = -1.25;
      rightElbow = -0.45;
      leftShoulderX = -0.18;
      leftElbow = -0.18;
      neckX = 0.12;
    } else if (this.anim.action === 'pickup') {
      state = 'pickup';
      hipsY = -0.18;
      torsoX = 0.42;
      leftHip = -0.55;
      rightHip = -0.55;
      leftKnee = 0.85;
      rightKnee = 0.85;
      leftShoulderX = -0.55;
      rightShoulderX = -0.7;
      leftElbow = -0.5;
      rightElbow = -0.6;
    } else if (this.mode === 'walk' && moving) {
      state = 'walk';
      const stride = 0.55 * intensity;
      leftHip = swing * stride;
      rightHip = -swing * stride;
      leftKnee = Math.max(0, -swing) * 0.85 * intensity;
      rightKnee = Math.max(0, swing) * 0.85 * intensity;
      leftShoulderX = -swing * stride * 0.8;
      rightShoulderX = swing * stride * 0.8;
      leftElbow = -0.18 - Math.max(0, swing) * 0.3;
      rightElbow = -0.18 - Math.max(0, -swing) * 0.3;
      hipsY = 0.02 + Math.abs(swing2) * 0.025;
      torsoX = 0.06 + intensity * 0.06;
      neckX = -torsoX * 0.4;
    } else if (this.mode === 'zero') {
      state = 'eva';
      leftShoulderZ = 0.62 + Math.sin(phase * 0.8) * 0.04;
      rightShoulderZ = -0.62 - Math.sin(phase * 0.8) * 0.04;
      leftShoulderX = -0.18 + Math.sin(phase * 0.7) * 0.06;
      rightShoulderX = -0.18 + Math.cos(phase * 0.7) * 0.06;
      leftElbow = -0.32;
      rightElbow = -0.32;
      leftHip = -0.12 + Math.sin(phase * 0.6) * 0.04;
      rightHip = 0.12 + Math.cos(phase * 0.6) * 0.04;
      leftKnee = 0.22;
      rightKnee = 0.22;
      hipsY = 0.02 + Math.sin(phase * 0.9) * 0.015;
    } else {
      // Idle: respiración y micro-movimiento.
      leftShoulderX = Math.sin(phase * 0.9) * 0.03;
      rightShoulderX = Math.cos(phase * 0.9) * 0.03;
      leftElbow = -0.12;
      rightElbow = -0.12;
      hipsY = 0.02 + Math.sin(phase * 0.9) * 0.008;
      torsoX = 0.01;
      neckX = Math.sin(phase * 0.7) * 0.02;
    }

    this.anim.state = state;

    const k = 12;
    rig.hips.position.y += (hipsY - rig.hips.position.y) * (1 - Math.exp(-dt * 14));
    this._lerpJoint(rig.torso.rotation, 'x', torsoX, dt, k);
    this._lerpJoint(rig.torso.rotation, 'z', torsoZ, dt, 10);
    this._lerpJoint(rig.neck.rotation, 'x', neckX, dt, k);

    this._lerpJoint(rig.legs.left.hip.rotation, 'x', leftHip, dt, k);
    this._lerpJoint(rig.legs.right.hip.rotation, 'x', rightHip, dt, k);
    this._lerpJoint(rig.legs.left.knee.rotation, 'x', leftKnee, dt, k);
    this._lerpJoint(rig.legs.right.knee.rotation, 'x', rightKnee, dt, k);

    this._lerpJoint(rig.arms.left.shoulder.rotation, 'x', leftShoulderX, dt, k);
    this._lerpJoint(rig.arms.right.shoulder.rotation, 'x', rightShoulderX, dt, k);
    this._lerpJoint(rig.arms.left.shoulder.rotation, 'z', leftShoulderZ, dt, k);
    this._lerpJoint(rig.arms.right.shoulder.rotation, 'z', rightShoulderZ, dt, k);
    this._lerpJoint(rig.arms.left.elbow.rotation, 'x', leftElbow, dt, k);
    this._lerpJoint(rig.arms.right.elbow.rotation, 'x', rightElbow, dt, k);
  }

  /** Sincroniza malla, orientación, animación y partículas. Llamar tras physics.step(). */
  sync(dt, camera) {
    const p = this.body.position;

    if (this.mode === 'walk') {
      // Caminar: la malla se apoya en el suelo y permanece vertical.
      this.group.position.set(p.x, p.y + this.footOffset, p.z);
      const velocity = this.body.velocity;

      if (this.speed > 0.35) {
        _dir.set(velocity.x, 0, velocity.z).normalize();
        this.facing.lerp(_dir, 1 - Math.exp(-dt * 10)).normalize();
      } else {
        camera.getWorldDirection(_dir);
        _dir.y = 0;
        if (_dir.lengthSq() > 0.001) {
          _dir.normalize();
          this.facing.lerp(_dir, 1 - Math.exp(-dt * 5)).normalize();
        }
      }

      this.dummy.position.copy(this.group.position);
      this.dummy.up.set(0, 1, 0);
      this.dummy.lookAt(
        this.group.position.x + this.facing.x,
        this.group.position.y,
        this.group.position.z + this.facing.z
      );
      this.group.quaternion.slerp(this.dummy.quaternion, 1 - Math.exp(-dt * 12));
      this.thrusterAccum = 0;
      this._animate(dt);
      return;
    }

    this.group.position.set(p.x, p.y, p.z);

    // Orientación: mira hacia el movimiento; en reposo, hacia la cámara.
    if (this.speed > 0.6) {
      _dir.set(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z).normalize();
      this.facing.lerp(_dir, 1 - Math.exp(-dt * 5)).normalize();
    } else {
      camera.getWorldDirection(_dir);
      _dir.y *= 0.5;
      if (_dir.lengthSq() > 0.001) {
        _dir.normalize();
        this.facing.lerp(_dir, 1 - Math.exp(-dt * 2.2)).normalize();
      }
    }

    const up = Math.abs(this.facing.y) > 0.985 ? _upAlt : _up;
    this.dummy.position.copy(this.group.position);
    this.dummy.up.copy(up);
    this.dummy.lookAt(
      this.group.position.x + this.facing.x,
      this.group.position.y + this.facing.y,
      this.group.position.z + this.facing.z
    );
    this.group.quaternion.slerp(this.dummy.quaternion, 1 - Math.exp(-dt * 7));

    // Escape de los propulsores (dos toberas de la mochila).
    if (this.thrusting && this.particles) {
      this.thrusterAccum += dt;
      const exhaust = _dir.copy(this.thrustDir).negate();

      while (this.thrusterAccum > 0.028) {
        this.thrusterAccum -= 0.028;

        for (const side of [-1, 1]) {
          _nozzle
            .set(side * 0.17, 0.02, -0.5)
            .applyQuaternion(this.group.quaternion)
            .add(this.group.position);

          this.particles.spawn(_nozzle, exhaust, {
            speed: 4.5,
            spread: 0.55,
            life: 0.35,
            offset: 0.06,
          });
        }
      }
    } else {
      this.thrusterAccum = 0;
    }

    this._animate(dt);
  }
}
