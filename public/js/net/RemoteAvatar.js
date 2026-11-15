import * as THREE from 'three';

/**
 * Avatar remoto: representación visual ligera de otro astronauta.
 *
 * No tiene cuerpo físico ni simulación: sólo interpola hacia la última
 * posición validada por el servidor. Esto mantiene el coste bajo (4 avatares
 * como máximo) y compatible con equipos modestos.
 */

const SUIT_COLORS = [0xeef3f7, 0xffc38d, 0x9fe3ff, 0xc9bcff];
const ACCENT_COLORS = [0x5ff0ff, 0xffd166, 0x35c4ee, 0x9c8bff];

const GEOMETRY = new Map();

function geometry(key, factory) {
  let value = GEOMETRY.get(key);
  if (!value) {
    value = factory();
    GEOMETRY.set(key, value);
  }
  return value;
}

function makeLabel(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(4, 8, 16, 0.62)';
  const width = Math.min(248, ctx.measureText(name).width + 34);
  ctx.beginPath();
  ctx.roundRect((canvas.width - width) / 2, 12, width, 40, 14);
  ctx.fill();
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillText(name, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 2.05;
  sprite.renderOrder = 4;
  return sprite;
}

export class RemoteAvatar {
  constructor(scene, { id, name = 'Astronauta', appearance = 0 }) {
    this.id = id;
    this.scene = scene;
    this.name = name;
    this.appearance = Math.abs(Math.trunc(appearance)) % SUIT_COLORS.length;
    this.connected = true;
    this.mode = 'walk';
    this.anim = 0;
    this.phase = 0;

    this.group = new THREE.Group();
    this.group.name = `remote-avatar-${id}`;
    this.visual = new THREE.Group();
    this.group.add(this.visual);
    this.scene.add(this.group);

    this._targetPosition = new THREE.Vector3();
    this._targetQuaternion = new THREE.Quaternion();
    this._hasTarget = false;

    this._build();
    this._setVisibleMode('walk');
  }

  _build() {
    const suit = new THREE.MeshStandardMaterial({
      color: SUIT_COLORS[this.appearance],
      roughness: 0.62,
      metalness: 0.08,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: ACCENT_COLORS[this.appearance],
      roughness: 0.4,
      metalness: 0.2,
      emissive: ACCENT_COLORS[this.appearance],
      emissiveIntensity: 0.35,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: 0x0a1622,
      roughness: 0.15,
      metalness: 0.85,
      emissive: 0x0d2a3a,
      emissiveIntensity: 0.6,
    });
    this.materials = [suit, accent, visor];

    const add = (mesh, parent = this.visual) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      parent.add(mesh);
      return mesh;
    };

    // Torso y mochila de soporte vital.
    add(new THREE.Mesh(geometry('torso', () => new THREE.CapsuleGeometry(0.27, 0.52, 4, 10)), suit)).position.y = 1.02;
    const backpack = add(new THREE.Mesh(geometry('pack', () => new THREE.BoxGeometry(0.42, 0.5, 0.2)), suit));
    backpack.position.set(0, 1.12, -0.24);
    const light = add(new THREE.Mesh(geometry('light', () => new THREE.BoxGeometry(0.1, 0.06, 0.04)), accent));
    light.position.set(0, 1.34, -0.35);

    // Casco y visor.
    add(new THREE.Mesh(geometry('helmet', () => new THREE.SphereGeometry(0.23, 16, 12)), suit)).position.y = 1.55;
    const glass = add(new THREE.Mesh(geometry('visor', () => new THREE.SphereGeometry(0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)), visor));
    glass.position.set(0, 1.55, 0.055);
    glass.rotation.x = Math.PI * 0.5;

    // Cinturón y franja de identidad.
    const belt = add(new THREE.Mesh(geometry('belt', () => new THREE.BoxGeometry(0.5, 0.09, 0.34)), accent));
    belt.position.y = 0.76;

    // Extremidades con pivotes para animarlas.
    this.limbs = {};
    const buildLimb = (key, x, y, radius, length) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      this.visual.add(pivot);
      const mesh = new THREE.Mesh(
        geometry(`limb-${radius}-${length}`, () => new THREE.CapsuleGeometry(radius, length, 4, 8)),
        suit
      );
      mesh.position.y = -(length / 2 + radius * 0.4);
      pivot.add(mesh);
      this.limbs[key] = pivot;
      return pivot;
    };

    buildLimb('armL', -0.34, 1.3, 0.075, 0.42);
    buildLimb('armR', 0.34, 1.3, 0.075, 0.42);
    buildLimb('legL', -0.14, 0.74, 0.095, 0.46);
    buildLimb('legR', 0.14, 0.74, 0.095, 0.46);

    const label = makeLabel(this.name, ACCENT_COLORS[this.appearance]);
    if (label) {
      this.label = label;
      this.group.add(label);
    }
  }

  /** Aplica el último estado validado por el servidor. */
  setData(data) {
    if (!data) return;
    this.name = data.name || this.name;
    this.anim = Number.isFinite(data.anim) ? Math.min(1, Math.max(0, data.anim)) : 0;
    this.mode = data.mode === 'zero' ? 'zero' : 'walk';
    this.setConnected(data.connected !== false);

    const x = Number.isFinite(data.x) ? data.x : this._targetPosition.x;
    const y = Number.isFinite(data.y) ? data.y : this._targetPosition.y;
    const z = Number.isFinite(data.z) ? data.z : this._targetPosition.z;
    this._targetPosition.set(x, y, z);

    const qx = Number.isFinite(data.qx) ? data.qx : this._targetQuaternion.x;
    const qy = Number.isFinite(data.qy) ? data.qy : this._targetQuaternion.y;
    const qz = Number.isFinite(data.qz) ? data.qz : this._targetQuaternion.z;
    const qw = Number.isFinite(data.qw) ? data.qw : this._targetQuaternion.w;
    this._targetQuaternion.set(qx, qy, qz, qw).normalize();

    if (!this._hasTarget) {
      // Primera muestra: aparecer ya en su sitio, sin deslizamiento inicial.
      this.group.position.copy(this._targetPosition);
      this.group.quaternion.copy(this._targetQuaternion);
      this._hasTarget = true;
    }

    this._setVisibleMode(this.mode);
  }

  _setVisibleMode(mode) {
    // En EVA el origen del jugador local es el centro del cuerpo; a pie, los pies.
    this.visual.position.y = mode === 'zero' ? -0.82 : 0;
  }

  setConnected(connected) {
    if (this.connected === connected) return;
    this.connected = connected;
    const opacity = connected ? 1 : 0.35;
    for (const material of this.materials) {
      material.transparent = !connected;
      material.opacity = opacity;
      material.needsUpdate = true;
    }
    if (this.label) this.label.material.opacity = connected ? 1 : 0.4;
  }

  /** Interpolación suave; llamar una vez por fotograma. */
  update(dt) {
    if (!this._hasTarget) return;

    const k = 1 - Math.exp(-dt * 11);
    this.group.position.lerp(this._targetPosition, k);
    this.group.quaternion.slerp(this._targetQuaternion, k);

    const swing = this.mode === 'walk' ? this.anim : 0;
    if (swing > 0.04) {
      this.phase += dt * (5.5 + swing * 4.5);
      const angle = Math.sin(this.phase) * 0.55 * swing;
      if (this.limbs) {
        this.limbs.legL.rotation.x = angle;
        this.limbs.legR.rotation.x = -angle;
        this.limbs.armL.rotation.x = -angle * 0.7;
        this.limbs.armR.rotation.x = angle * 0.7;
      }
    } else if (this.limbs) {
      const relax = 1 - Math.exp(-dt * 8);
      for (const pivot of Object.values(this.limbs)) {
        pivot.rotation.x += (0 - pivot.rotation.x) * relax;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.label) {
      this.label.material.map?.dispose();
      this.label.material.dispose();
      this.label = null;
    }
    for (const material of this.materials ?? []) material.dispose();
    this.materials = [];
    this.group.clear();
  }
}
