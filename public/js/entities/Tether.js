import * as THREE from 'three';
import { makeGlowTexture } from '../engine/Textures.js';

const _dir = new THREE.Vector3();
const _force = new THREE.Vector3();
const _harness = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _point = new THREE.Vector3();
const LOW = new THREE.Color(0x6dffa8);
const MID = new THREE.Color(0xffb45f);
const HIGH = new THREE.Color(0xff5c6c);

/**
 * Cable de seguridad EVA.
 *
 * - Visual: línea de 32 puntos desde el anclaje fijo hasta el arnés.
 * - Física: muelle progresivo sobre el cuerpo de cannon-es. Empieza a frenar
 *   antes del límite y nunca teletransporta al jugador.
 * - Se recoge automáticamente al entrar en una zona presurizada.
 */
export class Tether {
  constructor(scene, player, config) {
    this.scene = scene;
    this.player = player;
    this.config = config;
    this.anchor = new THREE.Vector3(0, -7.95, 6.4);
    this.active = false;
    this.distance = 0;
    this.max = config.tetherLength;
    this.tension = 0;
    this.stretch = 0;

    this.group = new THREE.Group();
    this.group.name = 'tether';
    this.group.visible = false;
    scene.add(this.group);

    this._buildAnchor();
    this._buildCable();
  }

  _buildAnchor() {
    const clamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b3440, metalness: 0.8, roughness: 0.35 })
    );
    clamp.position.copy(this.anchor);
    clamp.rotation.x = Math.PI / 2;
    this.group.add(clamp);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0xffb45f, toneMapped: false })
    );
    ring.position.copy(this.anchor).add(new THREE.Vector3(0, 0, 0.1));
    this.group.add(ring);
    this.ring = ring;

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0xffb45f,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(0.9);
    glow.position.copy(this.anchor).add(new THREE.Vector3(0, 0, 0.12));
    this.group.add(glow);
    this.anchorGlow = glow;
  }

  _buildCable() {
    this.points = new Float32Array(32 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.points, 3));

    this.material = new THREE.LineBasicMaterial({
      color: 0x6dffa8,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    });
    this.line = new THREE.Line(geometry, this.material);
    this.line.frustumCulled = false;
    this.group.add(this.line);
  }

  setConfig(config) {
    this.config = config;
    this.max = config.tetherLength;
  }

  /** Fuerza física. Llamar antes de physics.step(). */
  applyPhysics(dt, active) {
    this.active = active;
    if (!active) {
      this.tension = 0;
      this.stretch = 0;
      return;
    }

    const body = this.player.body;
    const position = body.position;
    _dir.set(
      position.x - this.anchor.x,
      position.y - this.anchor.y,
      position.z - this.anchor.z
    );
    const distance = _dir.length();
    if (distance < 0.001) return;

    this.distance = distance;
    const max = this.config.tetherLength;
    this.max = max;

    // La tensión empieza al 80 % de la longitud y llega al máximo en el límite.
    this.tension = THREE.MathUtils.clamp((distance - max * 0.8) / (max * 0.2), 0, 1);
    this.stretch = Math.max(0, distance - max);

    if (distance > max * 0.9) {
      _dir.divideScalar(distance);
      const velocity = body.velocity;
      const outward = velocity.x * _dir.x + velocity.y * _dir.y + velocity.z * _dir.z;
      const excess = distance - max * 0.9;
      // Muelle + amortiguador radial en ambos sentidos: frena al alejarse y
      // evita que el cable devuelva al jugador hacia la estación con rebote.
      const acceleration = Math.max(
        0,
        excess * this.config.tetherStiffness + outward * this.config.tetherDamping
      );
      const magnitude = Math.min(26, acceleration) * body.mass;

      _force.set(-_dir.x * magnitude, -_dir.y * magnitude, -_dir.z * magnitude);
      body.applyForce(_force);
    }

    void dt;
  }

  /** Actualiza la curva visual. Llamar después de player.sync(). */
  updateVisual(active) {
    this.group.visible = active;
    if (!active) return;

    _harness.set(0, 0.02, -0.4).applyQuaternion(this.player.group.quaternion);
    _harness.add(this.player.group.position);

    const count = this.points.length / 3;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      _point.copy(this.anchor).lerp(_harness, t);

      // Curva suave para que el cable no parezca una barra rígida.
      const sag = (1 - this.tension) * 0.38 * Math.sin(Math.PI * t);
      _point.y -= sag;
      _point.x += Math.sin(Math.PI * t) * (1 - this.tension) * 0.12;

      this.points[i * 3] = _point.x;
      this.points[i * 3 + 1] = _point.y;
      this.points[i * 3 + 2] = _point.z;
    }

    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();

    const color = this.tension > 0.75 ? HIGH : this.tension > 0.35 ? MID : LOW;
    this.material.color.copy(color);
    this.anchorGlow.material.color.copy(color);

    const pulse = 0.55 + 0.25 * Math.sin(performance.now() * 0.004);
    this.anchorGlow.material.opacity = this.tension > 0.75 ? 0.9 : pulse;
    this.ring.scale.setScalar(1 + this.tension * 0.35);
  }

  reset() {
    this.active = false;
    this.distance = 0;
    this.tension = 0;
    this.stretch = 0;
    this.group.visible = false;
    this.material.color.copy(LOW);
  }

  get status() {
    return {
      active: this.active,
      distance: this.distance,
      max: this.max,
      tension: this.tension,
      stretch: this.stretch,
    };
  }
}
