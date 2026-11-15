/**
 * CinematicSequence - Secuencia cinematográfica 3D de embarque, despegue y llegada a EVA-07.
 * 
 * Características:
 * - Perezoso: no afecta la inicialización del juego
 * - Activable desde startNewGame({ cinematic: true })
 * - Opcional/skippable con tecla ESPACIO
 * - No bloquea el loop de renderizado cuando está idle
 * - Devuelve control al jugador al finalizar
 * - Compatible con hardware modesto (Intel UHD 620)
 * - Reutiliza objetos existentes (Player, Ship, Station, cámaras)
 */

class CinematicSequence {
  constructor(game) {
    this.game = game;
    this.state = 'idle'; // idle, active, skipped, finished
    this.skipRequested = false;
    this.currentScene = 1;
    this.elapsed = 0;
    this.dt = 0;
    this.earth = null;
    this.skipKey = ' ';
    this.cinematicElement = null;

    // Referencias a objetos del juego (se cargan cuándo se activa)
    this._scene = null;
    this._renderer = null;
    this._camera = null;
    this._player = null;
    this._ship = null;
    this._hud = null;
    this._station = null;
    this._playerGroup = null;
    this._cameraRig = null;
  }

  // Inicializar referencias cuando se active la cinemática
  _initRefs() {
    if (this._scene) return; // Ya inicializado
    
    this._scene = this.game.scene;
    this._renderer = this.game.renderer;
    this._camera = this.game.camera;
    this._player = this.game.player;
    this._ship = this.game.ship;
    this._hud = this.game.hud;
    this._station = this.game.station;
    this._playerGroup = this.player.group;
    this._cameraRig = this.game.cameraRig;
  }

  // Activar la cinemática
  activate() {
    this._initRefs();
    this.state = 'active';
    this.skipRequested = false;
    this.currentScene = 1;
    this.elapsed = 0;
    this.earth = null;
    console.log('CinematicSequence: activated');
  }

  // Solicitar saltar (tecla ESPACIO)
  requestSkip() {
    this.skipRequested = true;
  }

  // Escena 1: Instalaciones terrestres
  _scene1_landingsites(dt) {
    this.elapsed += dt;

    // Crear Tierra si no existe
    if (!this.earth) {
      const earthGeo = new THREE.SphereGeometry(5, 32, 32);
      const earthMat = new THREE.MeshStandardMaterial({
        color: 0x223355,
        emissive: 0x000033,
        emissiveIntensity: 0.5,
      });
      this.earth = new THREE.Mesh(earthGeo, earthMat);
      this.earth.layers.enable(1);
      this._scene.add(this.earth);
    }

    // Posicionar la nave en plataforma de lanzamiento terrestre
    this._ship.setPosition(-20, 0, 0);

    // Cámara orbital alrededor de la plataforma
    this.elapsedTime = (this.elapsedTime || 0) + dt * 0.5;
    const radius = 25;
    this._camera.position.set(
      -20 + Math.cos(this.elapsedTime) * radius,
      8 + Math.sin(this.elapsedTime * 0.7) * 3,
      0 + Math.sin(this.elapsedTime) * radius
    );
    this._camera.lookAt(new THREE.Vector3(-20, 0, 0));

    // Transición a escena 2 después de 5 segundos
    if (this.elapsed > 5.0) {
      this.currentScene = 2;
      this.elapsed = 0;
    }
  }

  // Escena 2: Embarque
  _scene2_embark(dt) {
    this.elapsed += dt;

    // Posicionar jugador al lado de la plataforma
    if (this.elapsed < 1.0) {
      this._playerGroup.position.set(-19, 0, 0);
      this._playerGroup.rotation.y = Math.PI;
    } else {
      // Lógica de caminata hacia la nave
      const targetPos = new THREE.Vector3(-12, 0, 0);
      const dx = targetPos.x - this._playerGroup.position.x;
      const dz = targetPos.z - this._playerGroup.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        const speed = 3.0 * dt;
        this._playerGroup.position.x += (dx / dist) * speed;
        this._playerGroup.position.z += (dz / dist) * speed;
        this._player.setAction('walk');
      } else {
        this._player.setAction('idle');
        if (this.skipRequested) this.state = 'finished';
        if (this._ship.contains(this._playerGroup.position)) {
          this.currentScene = 3;
          this.elapsed = 0;
        }
      }
    }
  }

  // Escena 3: Interior de la nave
  _scene3_interior(dt) {
    this.elapsed += dt;

    // Posicionar jugador en asiento de la cabina
    if (this.elapsed < 0.5) {
      const seatPos = this._ship.seatPosition();
      this._playerGroup.position.set(seatPos.x, seatPos.y, seatPos.z);
      this._player.setAction('sit');
    } else {
      // Cámara interna mirando al panel
      this._camera.position.set(4.5, 1.8, 0.5);
      this._camera.lookAt(4.5, 1.5, 0);

      // Transición a escena 4
      this.currentScene = 4;
    }
  }

  // Escena 4: Despegue
  _scene4_launch(dt) {
    this.elapsed += dt;

    // Activar motores y consumir energía
    this._player.thrusting = true;
    this._player.energy = Math.max(0, this._player.energy - 0.16 * dt);
    this._camera.addShake(0.02 * dt);

    // Mover nave hacia arriba
    const launchSpeed = 5.0;
    this._ship.group.position.y += launchSpeed * dt;

    // Iluminación cambia al pasar atmósfera
    if (this.earth) {
      const s = 1 - this._ship.group.position.y / 200;
      this.earth.scale.set(Math.max(0.1, s), Math.max(0.1, s), Math.max(0.1, s));
    }

    // Partículas de propulsores
    if (this._player.thrusting && this.game.thrusterParticles) {
      const exhaust = new THREE.Vector3(0, 0, -1);
      this.game.thrusterParticles.spawn(
        this._player.group.position.clone(),
        exhaust,
        { speed: 4.5, spread: 0.55, life: 0.35, offset: 0.06 }
      );
    }

    // Transición a escena 5
    if (this.elapsed > 4.0 && this._ship.group.position.y > 20) {
      this.currentScene = 5;
      this.elapsed = 0;
    }
  }

  // Escena 5: Viaje espacial
  _scene5_space(dt) {
    this.elapsed += dt;

    // Nave continúa trayectoria hacia estación
    this._ship.group.position.x += 0.8 * dt;

    // Tierra se reduce progresivamente
    if (this.earth) {
      const distance = Math.abs(this._ship.group.position.x);
      const scale = Math.max(0.1, 1 - distance / 500);
      this.earth.scale.set(scale, scale, scale);
    }

    // Estación visible a lo lejos
    if (this._station) {
      this._station.group.visible = true;
      this._station.group.position.set(
        this._ship.group.position.x + 200,
        0,
        0
      );
    }

    // Cámara externa
    this._camera.position.set(
      this._ship.group.position.x + 50,
      30,
      50
    );
    this._camera.lookAt(this._ship.group.position);

    // Aproximación a estación
    if (this._station) {
      const distToStation = Math.sqrt(
        Math.pow(this._station.group.position.x - this._ship.group.position.x, 2)
      );
      if (distToStation < 30) {
        this.currentScene = 6;
        this.elapsed = 0;
      }
    }
  }

  // Escena 6: Llegada a EVA-07
  _scene6_docking(dt) {
    this.elapsed += dt;

    // Reducir velocidad para aproximación
    this._ship.group.position.x -= 0.5 * dt;

    // Aproximación al puerto de acoplamiento
    const targetX = this._station.group.position.x - 5;
    const dx = targetX - this._ship.group.position.x;

    if (Math.abs(dx) > 0.5) {
      this._ship.group.position.x += dx * 0.3 * dt;
      this._camera.lookAt(this._ship.group.position);
    } else {
      // Acoplamiento completado
      if (this._station && this._station.onDock) {
        this._station.onDock();
      }
      if (this.elapsed > 3.0) {
        this._endCinematic();
      }
    }
  }

  // Finalizar cinemática y devolver control al jugador
  _endCinematic() {
    this.state = 'finished';

    // Rehabilitar controles del jugador
    this._playerGroup.position.set(0, 2, 18);
    this._player.setMode('zero');
    this._ship.setInteriorActive(false);
    this._player.thrusting = false;

    // Mostrar HUD
    this._hud.show();

    // Volver al estado de juego normal
    this.game.state = 'playing';

    // Limpiar objetos de cinemática
    if (this.earth) {
      this._scene.remove(this.earth);
      this.earth = null;
    }

    console.log('CinematicSequence: finished, control returned to player');
  }

  // Actualizar la secuencia cinematográfica
  update(dt) {
    // Si no está activa, hacer nada (no bloquear)
    if (this.state !== 'active') return;

    this.dt = dt;
    this.elapsed += dt;

    // Verificar solicitud de saltar
    if (this.game.controls && this.game.controls.isKeyPressed) {
      const pressed = this.game.controls.isKeyPressed(this.skipKey);
      if (pressed) this.state = 'skipped';
    }

    // Si se solicitó saltar, terminar cinemática
    if (this.state === 'skipped' || this.state === 'finished') {
      this._endCinematic();
      return;
    }

    // Ejecutar escena actual
    switch (this.currentScene) {
      case 1:
        this._scene1_landingsites(dt);
        break;
      case 2:
        this._scene2_embark(dt);
        break;
      case 3:
        this._scene3_interior(dt);
        break;
      case 4:
        this._scene4_launch(dt);
        break;
      case 5:
        this._scene5_space(dt);
        break;
      case 6:
        this._scene6_docking(dt);
        break;
    }
  }
}

// Exportar para uso con módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinematicSequence;
}