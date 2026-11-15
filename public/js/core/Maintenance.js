/**
 * Actividades reales de mantenimiento de la estación.
 *
 * Cada tarea define un objetivo, la consola donde debe ejecutarse, una
 * duración y un efecto concreto sobre el estado de la partida. El gestor
 * sólo guarda el progreso; la aplicación del efecto vive en Game para no
 * acoplar el dominio de la estación a la UI.
 */
export const MAINTENANCE_ACTIVITIES = [
  {
    id: 'reset_circuit',
    label: 'Reiniciar circuito',
    objective: 'Restablecer la alimentación de un circuito caído del hábitat.',
    location: 'engineering',
    locationLabel: 'Consola de ingeniería (operaciones)',
    duration: 2.6,
    effect: 'circuit',
  },
  {
    id: 'change_filter',
    label: 'Cambiar filtro de O2',
    objective: 'Sustituir un filtro saturado del soporte vital.',
    location: 'life_room',
    locationLabel: 'Control ambiental (sala de soporte vital)',
    duration: 2.4,
    cost: { filter: 1 },
    effect: 'filter',
  },
  {
    id: 'repair_leak',
    label: 'Reparar fuga de casco',
    objective: 'Sellar una microfuga activa en el casco exterior.',
    location: 'engineering_room',
    locationLabel: 'Sala de máquinas (ingeniería)',
    duration: 3.2,
    effect: 'leak',
  },
  {
    id: 'calibrate_sensor',
    label: 'Calibrar sensor',
    objective: 'Corregir la deriva del espectrómetro del laboratorio.',
    location: 'lab',
    locationLabel: 'Consola del laboratorio',
    duration: 2.0,
    effect: 'sensor',
  },
  {
    id: 'inspect_antenna',
    label: 'Inspeccionar antena',
    objective: 'Verificar el enlace de banda X con Tierra.',
    location: 'navigation',
    locationLabel: 'Consola de navegación (puente)',
    duration: 2.2,
    effect: 'antenna',
  },
  {
    id: 'repair_cooling',
    label: 'Reparar unidad de refrigeración',
    objective: 'Restaurar el control térmico del soporte vital.',
    location: 'power',
    locationLabel: 'Reactor y baterías (generación)',
    duration: 2.8,
    cost: { component: 1 },
    effect: 'cooling',
  },
  {
    id: 'inspect_module',
    label: 'Inspeccionar módulo',
    objective: 'Revisar la integridad estructural de un módulo habitable.',
    location: 'engineering_room',
    locationLabel: 'Sala de máquinas (ingeniería)',
    duration: 1.8,
    effect: 'module',
  },
];

export class MaintenanceManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.tasks = MAINTENANCE_ACTIVITIES.map((definition) => ({
      ...definition,
      state: 'pending',
      result: null,
      completedAt: null,
    }));
  }

  get(id) {
    return this.tasks.find((task) => task.id === id) ?? null;
  }

  /** Tareas pendientes de la primera ronda. */
  pending() {
    return this.tasks.filter((task) => task.state !== 'done');
  }

  completed() {
    return this.tasks.filter((task) => task.state === 'done');
  }

  markDone(id, result) {
    const task = this.get(id);
    if (!task) return null;
    task.state = 'done';
    task.result = result;
    task.completedAt = Date.now();
    return task;
  }

  serialize() {
    return {
      tasks: this.tasks.map((task) => ({
        id: task.id,
        state: task.state,
        result: task.result,
        completedAt: task.completedAt,
      })),
    };
  }

  restore(snapshot) {
    this.reset();
    if (!snapshot?.tasks) return;
    for (const saved of snapshot.tasks) {
      const task = this.get(saved.id);
      if (!task) continue;
      task.state = saved.state === 'done' ? 'done' : 'pending';
      task.result = saved.result ?? null;
      task.completedAt = saved.completedAt ?? null;
    }
  }
}
