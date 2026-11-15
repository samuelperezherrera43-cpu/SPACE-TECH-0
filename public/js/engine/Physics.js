import * as CANNON from 'cannon-es';

/**
 * Grupos de colisión. El jugador sólo colisiona con la estación: no hay
 * gravedad ni otros cuerpos dinámicos, así que el mundo es diminuto.
 */
export const GROUP = {
  PLAYER: 1,
  STATION: 2,
};

/**
 * Envoltorio mínimo sobre cannon-es.
 * - Gravedad cero real (0, 0, 0).
 * - SAPBroadphase: barato para pocos cuerpos estáticos.
 * - Paso fijo de 1/60 con subpasos, independiente del framerate.
 */
export class Physics {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, 0, 0),
    });

    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 8;

    const contact = this.world.defaultContactMaterial;
    contact.friction = 0.35;
    contact.restitution = 0.12;
    contact.contactEquationStiffness = 1e7;
    contact.contactEquationRelaxation = 4;

    this.fixedStep = 1 / 60;
  }

  step(dt) {
    this.world.step(this.fixedStep, dt, 3);
  }

  /** Esfera dinámica (astronauta). */
  sphere(position, radius, mass, options = {}) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(position[0], position[1], position[2]),
      ...options,
    });
    this.world.addBody(body);
    return body;
  }

  /**
   * Cápsula dinámica (astronauta a pie). Se compone de tres esferas para que
   * las colisiones con cajas sean estables y baratas, sin convexos.
   * `height` es la altura total; el radio queda en los extremos.
   */
  capsule(position, radius, height, mass, options = {}) {
    const body = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(position[0], position[1], position[2]),
      ...options,
    });
    const half = Math.max(radius, height / 2);
    const offset = Math.max(0, half - radius);
    body.addShape(new CANNON.Sphere(radius));
    body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, offset, 0));
    body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, -offset, 0));
    this.world.addBody(body);
    return body;
  }

  /** Caja estática (módulos de la estación). */
  box(position, halfExtents, options = {}) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(
        new CANNON.Vec3(halfExtents[0], halfExtents[1], halfExtents[2])
      ),
      position: new CANNON.Vec3(position[0], position[1], position[2]),
      ...options,
    });
    this.world.addBody(body);
    return body;
  }

  /** Cilindro estático (núcleo de la estación). Eje Y, como Three.js. */
  cylinder(position, radius, height, segments = 12, options = {}) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Cylinder(radius, radius, height, segments),
      position: new CANNON.Vec3(position[0], position[1], position[2]),
      ...options,
    });
    this.world.addBody(body);
    return body;
  }
}
