import * as THREE from 'three';
import { makeParticleTexture } from './Textures.js';

const _dir = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * Sistema de partículas por pooling sobre un único THREE.Points.
 * Shader propio: sprite suave, tamaño/color/alpha por partícula.
 * Sin allocations por frame y una sola draw call por sistema.
 */
export class ParticleSystem {
  constructor(scene, options = {}) {
    this.count = options.count ?? 240;
    this.drag = options.drag ?? 1.8;
    this.cursor = 0;
    this.alive = 0;
    this.baseSize = options.size ?? 0.1;
    this.baseOpacity = options.opacity ?? 0.9;
    this.baseColor = new THREE.Color(options.color ?? 0xbfefff);
    this.pixelRatio = options.pixelRatio ?? 1;

    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.lifeMax = new Float32Array(this.count);
    this.sizes = new Float32Array(this.count);
    this.alphas = new Float32Array(this.count);
    this.colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3 + 1] = -9999;
      this.colors[i * 3] = this.baseColor.r;
      this.colors[i * 3 + 1] = this.baseColor.g;
      this.colors[i * 3 + 2] = this.baseColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: makeParticleTexture() },
        uPixelRatio: { value: this.pixelRatio },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPixelRatio * (320.0 / max(0.1, -mv.z)), 1.0, 96.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: options.blending ?? THREE.AdditiveBlending,
      depthTest: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);

    this.geometry = geometry;
    this.material = material;
  }

  setPixelRatio(ratio) {
    this.pixelRatio = ratio;
    this.material.uniforms.uPixelRatio.value = ratio;
  }

  spawn(origin, direction, options = {}) {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const i3 = index * 3;

    const offset = options.offset ?? 0;
    this.positions[i3] = origin.x + (Math.random() - 0.5) * offset;
    this.positions[i3 + 1] = origin.y + (Math.random() - 0.5) * offset;
    this.positions[i3 + 2] = origin.z + (Math.random() - 0.5) * offset;

    const spread = options.spread ?? 0.5;
    _dir.copy(direction).normalize();
    _dir.x += (Math.random() - 0.5) * spread;
    _dir.y += (Math.random() - 0.5) * spread;
    _dir.z += (Math.random() - 0.5) * spread;
    _dir.normalize();

    const speed = (options.speed ?? 2) * (0.55 + Math.random() * 0.9);
    this.velocities[i3] = _dir.x * speed;
    this.velocities[i3 + 1] = _dir.y * speed;
    this.velocities[i3 + 2] = _dir.z * speed;

    const life = (options.life ?? 0.6) * (0.7 + Math.random() * 0.6);
    this.life[index] = life;
    this.lifeMax[index] = life;
    this.sizes[index] = (options.size ?? this.baseSize) * (0.7 + Math.random() * 0.6);
    this.alphas[index] = options.alpha ?? this.baseOpacity;

    if (options.color !== undefined) _color.set(options.color);
    else _color.copy(this.baseColor);
    _color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
    this.colors[i3] = _color.r;
    this.colors[i3 + 1] = _color.g;
    this.colors[i3 + 2] = _color.b;
  }

  burst(origin, direction, count, options = {}) {
    for (let i = 0; i < count; i++) {
      this.spawn(origin, direction, options);
    }
  }

  update(dt) {
    const damping = Math.exp(-this.drag * dt);
    let alive = 0;

    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;

      this.life[i] -= dt;
      const i3 = i * 3;

      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -9999;
        this.alphas[i] = 0;
        continue;
      }

      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      this.velocities[i3] *= damping;
      this.velocities[i3 + 1] *= damping;
      this.velocities[i3 + 2] *= damping;

      const t = this.life[i] / this.lifeMax[i];
      this.alphas[i] = this.baseOpacity * Math.min(1, t * 2.2) * Math.min(1, (1 - t) * 8 + 0.25);
      alive++;
    }

    this.alive = alive;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
