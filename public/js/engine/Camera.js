import * as THREE from 'three';

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _offset = new THREE.Vector3();

/**
 * Cámara orbital de tercera persona con amortiguación exponencial.
 * - El ratón orbita alrededor del astronauta (yaw / pitch).
 * - La rueda cambia la distancia.
 * - Un raycast barato contra la estación evita atravesar el casco.
 */
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;

    this.yaw = 0;
    this.pitch = 0.16;
    this.distance = 6.2;
    this.targetDistance = 6.2;
    this.sensitivity = 0.0024;

    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();
    this.shake = 0;
    this.initialized = false;

    this.raycaster = new THREE.Raycaster();
    this.occluders = [];
    this.menuAngle = 0.6;
    this.inside = false;
    this.seated = false;
    this.floor = -10.4;
    this.ceil = -7.6;
    this.seatPosition = new THREE.Vector3(0, -8.5, -12.0);
    this.seatLook = new THREE.Vector3(0, -9.2, -13.35);
  }

  rotate(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch += dy * this.sensitivity;

    const limit = Math.PI / 2 - 0.12;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));

    // Mantener el yaw en un rango pequeño evita pérdida de precisión.
    if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI * 2) this.yaw += Math.PI * 2;
  }

  zoom(delta) {
    this.targetDistance = Math.max(3.2, Math.min(12, this.targetDistance + delta * 0.0055));
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  snap(playerPosition) {
    this._computeDesired(playerPosition);
    this.smoothPos.copy(_desired);
    this.smoothLook.copy(_look);
    this.initialized = true;
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
  }

  _computeDesired(playerPosition) {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);

    _look.copy(playerPosition);
    // En el interior el techo está a 2,8 m: bajar el punto de mira evita que
    // la cámara se pegue a las luminarias.
    _look.y += this.inside ? 0.42 : 0.85;

    // Cámara al hombro: la retícula queda a la derecha de la cabeza, con
    // línea de visión limpia hacia la fuga.
    _look.x += Math.cos(this.yaw) * 0.62;
    _look.z -= Math.sin(this.yaw) * 0.62;

    _offset.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp)
      .multiplyScalar(this.distance);

    _desired.copy(_look).add(_offset);

    // Con el techo a 2,8 m, la cámara orbital subiría hasta las luminarias.
    // Se limita su altura al hueco real del hábitat.
    if (this.inside) {
      _desired.y = Math.min(this.ceil - 0.45, Math.max(this.floor + 0.4, _desired.y));
    }

    // Colisión de cámara: acercarla si hay geometría entre el jugador y ella.
    if (this.occluders.length) {
      _dir.copy(_desired).sub(_look);
      const distance = _dir.length();
      if (distance > 0.001) {
        _dir.divideScalar(distance);
        this.raycaster.set(_look, _dir);
        this.raycaster.far = distance;
        this.raycaster.near = 0;
        const hits = this.raycaster.intersectObjects(this.occluders, false);
        if (hits.length > 0) {
          const safe = Math.max(0.9, hits[0].distance - 0.35);
          _desired.copy(_look).addScaledVector(_dir, safe);
        }
      }
    }
  }

  update(dt, playerPosition) {
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * 8));

    this._computeDesired(playerPosition);

    const k = this.initialized ? 1 - Math.exp(-dt * 10) : 1;
    const kLook = this.initialized ? 1 - Math.exp(-dt * 16) : 1;

    this.smoothPos.lerp(_desired, k);
    this.smoothLook.lerp(_look, kLook);

    this.camera.position.copy(this.smoothPos);

    if (this.shake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 7);
    }

    this.camera.lookAt(this.smoothLook);
    this.initialized = true;
  }

  /** Cámara fija del puesto de mando mientras el panel está abierto. */
  updateSeated(dt) {
    _desired.copy(this.seatPosition);
    const k = 1 - Math.exp(-dt * 9);
    this.camera.position.lerp(_desired, k);
    this.camera.lookAt(this.seatLook);
  }

  /** Define el asiento activo (puente de la estación o cabina de la nave). */
  setSeat(position, look) {
    this.seatPosition.copy(position);
    this.seatLook.copy(look);
    this.seated = true;
  }

  /** Órbita lenta para la pantalla de inicio, con la estación a la derecha. */
  updateMenu(dt, focus = new THREE.Vector3(0, 0, 0)) {
    this.menuAngle += dt * 0.1;
    const radius = 26;

    this.camera.position.set(
      focus.x + Math.cos(this.menuAngle) * radius,
      focus.y + 8 + Math.sin(this.menuAngle * 0.7) * 2.5,
      focus.z + Math.sin(this.menuAngle) * radius
    );

    // Mirar a la izquierda del foco desplaza la estación al lado derecho,
    // dejando libre el panel de inicio.
    _dir.copy(focus).sub(this.camera.position).normalize();
    _offset.set(0, 1, 0).cross(_dir).normalize();
    _desired.copy(focus).addScaledVector(_offset, 10);

    this.camera.lookAt(_desired);
  }
}
