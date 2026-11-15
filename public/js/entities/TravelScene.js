import * as THREE from 'three';

/**
 * Visualización del tránsito interplanetario.
 *
 * Muestra el Sol, la Tierra, la Luna y Marte en posiciones comprimidas, la
 * trayectoria de navegación y la nave desplazándose a lo largo de ella.
 * No pretende ser una predicción orbital exacta: es una representación
 * educativa del recorrido. Las distancias reales se indican en el panel.
 */
export class TravelScene {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    this._build();
    this.curve = null;
    this.progress = 0;
    this.state = 'PREPARING';
    this._correctionShown = false;
    this._camPos = new THREE.Vector3(0, 12, 14);
    this._camLook = new THREE.Vector3(-12, 0, 1);
  }

  _build() {
    // Sol.
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd27a })
    );
    this.sun.position.set(0, 0, 0);
    this.group.add(this.sun);
    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.16, side: THREE.BackSide })
    );
    sunGlow.position.copy(this.sun.position);
    this.group.add(sunGlow);

    // Planetas.
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), new THREE.MeshPhongMaterial({ color: 0x2a6fb0, emissive: 0x0a1a30, shininess: 8 }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshPhongMaterial({ color: 0xb0b0b0 }));
    this.mars = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshPhongMaterial({ color: 0xc05030 }));
    this.earth.position.set(-14, 0, 0);
    this.moon.position.set(-10.5, 0, 2);
    this.mars.position.set(22, 0, 12);
    this.group.add(this.earth);
    this.group.add(this.moon);
    this.group.add(this.mars);

    // Órbitas.
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x4060a0, transparent: true, opacity: 0.35 });
    this.earthOrbit = new THREE.LineLoop(new THREE.RingGeometry(14, 14, 64), orbitMat);
    this.earthOrbit.rotation.x = Math.PI / 2;
    this.group.add(this.earthOrbit);
    this.marsOrbit = new THREE.LineLoop(new THREE.RingGeometry(26, 26, 64), new THREE.LineBasicMaterial({ color: 0xa05030, transparent: true, opacity: 0.3 }));
    this.marsOrbit.rotation.x = Math.PI / 2;
    this.group.add(this.marsOrbit);

    // Nave.
    this.ship = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 8), new THREE.MeshPhongMaterial({ color: 0xd0d8e0 }));
    body.rotation.x = Math.PI / 2;
    this.ship.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.3), new THREE.MeshPhongMaterial({ color: 0x8090a0 }));
    wing.position.set(0, 0, -0.2);
    this.ship.add(wing);
    this.group.add(this.ship);

    // Trayectoria.
    this.trajMat = new THREE.LineBasicMaterial({ color: 0x6df0ff, transparent: true, opacity: 0.85 });
    this.trajectory = new THREE.Line(new THREE.BufferGeometry(), this.trajMat);
    this.group.add(this.trajectory);

    // Marcador de corrección.
    this.correctionMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc873 })
    );
    this.correctionMarker.visible = false;
    this.group.add(this.correctionMarker);

    // Luz.
    const light = new THREE.PointLight(0xffffff, 2.0, 60);
    light.position.set(0, 10, 0);
    this.group.add(light);
    this.group.add(new THREE.AmbientLight(0x203050, 0.6));
  }

  _posFor(id) {
    if (id === 'station' || id === 'earth') return new THREE.Vector3(-14, 0, 0);
    if (id === 'moon') return new THREE.Vector3(-10.5, 0, 2);
    if (id === 'mars') return new THREE.Vector3(22, 0, 12);
    return new THREE.Vector3(-14, 0, 0);
  }

  setup(origin, destination) {
    const o = this._posFor(origin);
    const d = this._posFor(destination);

    this.earth.position.set(-14, 0, 0);
    this.moon.position.set(-10.5, 0, 2);
    this.mars.position.set(22, 0, 12);

    const mid = new THREE.Vector3().addVectors(o, d).multiplyScalar(0.5);
    mid.y = 4 + Math.abs(o.x - d.x) * 0.12;
    const curve = new THREE.CatmullRomCurve3([o.clone(), mid, d.clone()], false, 'catmullrom', 0.5);
    this.curve = curve;

    const points = curve.getPoints(80);
    this.trajectory.geometry.dispose();
    this.trajectory.geometry = new THREE.BufferGeometry().setFromPoints(points);

    this.correctionMarker.position.copy(curve.getPoint(0.5));
    this.correctionMarker.visible = false;

    this.ship.position.copy(o);
    this.progress = 0;
    this._correctionShown = false;

    const center = mid.clone();
    const dist = o.distanceTo(d);
    const camDist = Math.max(12, dist * 0.55);
    this._camPos.set(center.x + camDist * 0.3, camDist * 0.7, center.z + camDist * 0.6);
    this._camLook.copy(center);
  }

  update(progress) {
    this.progress = Math.max(0, Math.min(1, progress));
    if (this.curve) {
      const p = this.curve.getPoint(this.progress);
      this.ship.position.copy(p);
      const tangent = this.curve.getTangent(this.progress);
      if (tangent.length() > 1e-4) {
        this.ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.normalize());
      }
    }
    // Estados explícitos de la cinemática.
    if (this.progress < 0.1) this.state = 'PREPARING';
    else if (this.progress < 0.25) this.state = 'DEPARTURE';
    else if (this.progress < 0.65) this.state = 'CRUISE';
    else if (this.progress < 0.85) this.state = 'APPROACH';
    else this.state = 'ARRIVAL';

    if (this.progress > 0.32 && this.progress < 0.62) {
      this.correctionMarker.visible = true;
      const s = 1 + 0.3 * Math.sin(this.progress * 40);
      this.correctionMarker.scale.setScalar(s);
    } else {
      this.correctionMarker.visible = false;
    }
    const pulse = 1 + 0.04 * Math.sin(this.progress * 12);
    this.sun.scale.setScalar(pulse);
  }

  updateCamera(camera) {
    camera.position.lerp(this._camPos, 0.08);
    camera.lookAt(this._camLook);
  }

  show() { this.group.visible = true; }
  hide() { this.group.visible = false; }

  dispose() {
    this.scene.remove(this.group);
  }
}
