/**
 * Sistema modular de misiones persistentes.
 *
 * Cada misión tiene un identificador único y un estado:
 * available → accepted → in_progress → completed | failed | abandoned.
 * Sólo una misión puede estar activa, pero el historial y las misiones
 * generadas se conservan al guardar/cargar. Las misiones completadas nunca
 * vuelven a la lista de pendientes.
 */

export const MISSION_CATEGORIES = {
  exterior: 'Exterior EVA',
  interior: 'Interior',
  navigation: 'Navegación',
  science: 'Ciencia',
  maintenance: 'Mantenimiento',
  exploration: 'Exploración',
  construction: 'Construcción',
  logistics: 'Logística',
};

export const MISSION_DIFFICULTY = ['Fácil', 'Normal', 'Difícil'];

export const MISSION_STATES = {
  available: 'Disponible',
  accepted: 'Aceptada',
  in_progress: 'En progreso',
  completed: 'Completada',
  failed: 'Fallida',
  abandoned: 'Abandonada',
};

const objective = (id, label, type, target, targetId = null) => ({
  id,
  label,
  type,
  target,
  targetId,
  progress: 0,
});

export const MISSIONS = [
  {
    id: 'leak_repair',
    name: 'Reparación de fugas',
    category: 'maintenance',
    scope: 'exterior',
    location: 'station',
    difficulty: 'Normal',
    description:
      'La estación pierde presión por microfisuras y válvulas dañadas. Localiza las fugas con el escáner y séllalas con el soldador o la llave.',
    reward: { o2: 25, rcs: 20, hull: 10 },
    objectives: [objective('leaks', 'Sellar fugas del casco', 'leaks', 4)],
  },
  {
    id: 'solar_repair',
    name: 'Reparación de paneles solares',
    category: 'exterior',
    scope: 'exterior',
    location: 'station',
    difficulty: 'Normal',
    description:
      'Tres celdas de los paneles han perdido conexión. Recorre los puntos marcados y suelda los conectores con el soldador.',
    reward: { o2: 20, rcs: 18, hull: 8 },
    objectives: [objective('solar', 'Reparar celdas solares', 'solar', 3)],
  },
  {
    id: 'antenna_repair',
    name: 'Reparación de antena',
    category: 'exterior',
    scope: 'exterior',
    location: 'station',
    difficulty: 'Fácil',
    description:
      'La antena de banda X no responde. Ajusta los dos actuadores del mástil con la llave y recupera el enlace con Tierra.',
    reward: { o2: 15, rcs: 15, hull: 6 },
    objectives: [objective('antenna', 'Ajustar actuadores', 'antenna', 2)],
  },
  {
    id: 'component_swap',
    name: 'Sustitución de componentes',
    category: 'maintenance',
    scope: 'mixed',
    location: 'station',
    difficulty: 'Normal',
    description:
      'El regulador de potencia exterior está agotado. Recoge un kit de repuesto en el almacén y sustitúyelo en la toma del módulo.',
    reward: { o2: 18, rcs: 22, hull: 12 },
    objectives: [
      objective('pickup', 'Recoger kit en el almacén', 'component_pickup', 1),
      objective('install', 'Instalar el regulador', 'component_install', 1),
    ],
  },
  {
    id: 'module_inspection',
    name: 'Inspección de módulos',
    category: 'maintenance',
    scope: 'exterior',
    location: 'station',
    difficulty: 'Fácil',
    description:
      'Inspecciona tres puntos críticos del casco con el escáner para registrar el estado estructural de la estación.',
    reward: { o2: 14, rcs: 12, hull: 5 },
    objectives: [objective('inspection', 'Inspeccionar módulos', 'inspection', 3)],
  },
  {
    id: 'tool_recovery',
    name: 'Recuperación de herramientas',
    category: 'exterior',
    scope: 'exterior',
    location: 'station',
    difficulty: 'Fácil',
    description:
      'Dos herramientas se soltaron durante la última EVA y flotan cerca de la estación. Recupéralas antes de que se pierdan.',
    reward: { o2: 12, rcs: 25, hull: 4 },
    objectives: [objective('tools', 'Recuperar herramientas', 'tool_pickup', 2)],
  },
  {
    id: 'engineering_power',
    name: 'Restablecer circuitos',
    category: 'interior',
    scope: 'interior',
    location: 'station',
    difficulty: 'Normal',
    description:
      'La sala de ingeniería tiene tres circuitos caídos. Restablécelos desde la consola para devolver la potencia plena al hábitat.',
    reward: { o2: 20, rcs: 20, hull: 10 },
    objectives: [objective('circuits', 'Restablecer circuitos', 'circuit', 3)],
  },
  {
    id: 'life_support',
    name: 'Sustituir filtros de O2',
    category: 'interior',
    scope: 'interior',
    location: 'station',
    difficulty: 'Fácil',
    description:
      'Los filtros del sistema de soporte vital están saturados. Recoge dos filtros en el almacén y cámbialos en el panel del pasillo.',
    reward: { o2: 30, rcs: 10, hull: 8 },
    objectives: [objective('filters', 'Sustituir filtros', 'filter', 2)],
  },
  {
    id: 'lab_analysis',
    name: 'Analizar muestras',
    category: 'science',
    scope: 'interior',
    location: 'station',
    difficulty: 'Fácil',
    description:
      'El laboratorio guarda tres muestras pendientes. Analízalas y registra los resultados para completar el informe científico.',
    reward: { o2: 16, rcs: 12, hull: 8 },
    objectives: [objective('samples', 'Analizar muestras', 'sample', 3)],
  },
  {
    id: 'navigation_survey',
    name: 'Reconocimiento de navegación',
    category: 'navigation',
    scope: 'interior',
    location: 'station',
    difficulty: 'Fácil',
    description:
      'Revisa tres puntos de interés desde el mapa del puente de mando y marca un destino para la próxima ventana orbital.',
    reward: { o2: 14, rcs: 18, hull: 6 },
    objectives: [objective('pois', 'Revisar puntos de interés', 'poi', 3)],
  },
  {
    id: 'moon_landing',
    name: 'Primer contacto lunar',
    category: 'exploration',
    scope: 'exterior',
    location: 'moon',
    difficulty: 'Normal',
    description:
      'Viaja a la Luna, aterriza en la plataforma de Selene y recoge muestras del regolito para confirmar que la base es habitable.',
    reward: { o2: 30, rcs: 25, hull: 10 },
    objectives: [
      objective('travel', 'Aterrizar en la Luna', 'travel_moon', 1),
      objective('samples', 'Recoger regolito lunar', 'collect', 4),
    ],
  },
  {
    id: 'moon_ice',
    name: 'Hielo en los cráteres',
    category: 'science',
    scope: 'exterior',
    location: 'moon',
    difficulty: 'Normal',
    description:
      'Localiza los depósitos de hielo de agua en los cráteres y extrae suficiente material para el procesador de la base.',
    reward: { o2: 28, rcs: 20, hull: 8 },
    objectives: [objective('ice', 'Extraer hielo lunar', 'collect_ice', 4)],
  },
  {
    id: 'moon_build',
    name: 'Ampliar la base Selene',
    category: 'construction',
    scope: 'exterior',
    location: 'moon',
    difficulty: 'Normal',
    description:
      'Reúne materiales y construye un módulo nuevo en la base lunar. La estructura debe quedar operativa, no sólo proyectada.',
    reward: { o2: 35, rcs: 25, hull: 12 },
    objectives: [objective('build', 'Construir un módulo lunar', 'build', 1)],
  },
  {
    id: 'mars_mountain',
    name: 'Cordillera Ares',
    category: 'exploration',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Difícil',
    description:
      'Asciende por la cordillera del norte de Marte y registra la composición de las laderas rocosas.',
    reward: { o2: 40, rcs: 30, hull: 15 },
    objectives: [objective('mountain', 'Explorar la zona montañosa', 'mountain', 1)],
  },
  {
    id: 'mars_cave',
    name: 'Cueva de hielo marciano',
    category: 'exploration',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Normal',
    description:
      'Encuentra la entrada de la cueva al suroeste del puesto Ares, recorre el túnel y localiza el hielo subsuperficial.',
    reward: { o2: 32, rcs: 28, hull: 12 },
    objectives: [
      objective('cave', 'Entrar en la cueva', 'cave', 1),
      objective('ice', 'Extraer hielo subterráneo', 'collect_ice', 3),
    ],
  },
  {
    id: 'mars_mining',
    name: 'Minerales de Ares',
    category: 'science',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Normal',
    description:
      'Recolecta minerales y metales de los depósitos marcianos para abastecer el puesto de investigación.',
    reward: { o2: 30, rcs: 22, hull: 10 },
    objectives: [objective('minerals', 'Recolectar minerales', 'collect_minerals', 5)],
  },
  {
    id: 'mars_outpost',
    name: 'Puesto Ares ampliable',
    category: 'construction',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Normal',
    description:
      'Construye un módulo adicional en el puesto Ares y deja el refugio preparado para una tripulación permanente.',
    reward: { o2: 38, rcs: 28, hull: 14 },
    objectives: [objective('build', 'Construir un módulo marciano', 'build', 1)],
  },
  {
    id: 'mars_geology',
    name: 'Análisis geológico',
    category: 'science',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Fácil',
    description:
      'Analiza el terreno desde la consola del puesto Ares y registra la estratigrafía de la zona de aterrizaje.',
    reward: { o2: 22, rcs: 18, hull: 6 },
    objectives: [objective('geology', 'Realizar análisis geológico', 'geology', 1)],
  },
  {
    id: 'mars_equipment',
    name: 'Recuperar equipo averiado',
    category: 'maintenance',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Normal',
    description:
      'El rover y los sistemas del puesto sufrieron daños durante la tormenta. Repara el equipo desde la consola de control.',
    reward: { o2: 26, rcs: 24, hull: 10 },
    objectives: [objective('repair', 'Reparar equipo marciano', 'repair_equipment', 1)],
  },
  {
    id: 'mars_antenna',
    name: 'Enlace con la Tierra',
    category: 'logistics',
    scope: 'exterior',
    location: 'mars',
    difficulty: 'Normal',
    description:
      'Instala y calibra la antena del puesto Ares para enviar los datos geológicos a la estación orbital.',
    reward: { o2: 24, rcs: 20, hull: 8 },
    objectives: [objective('antenna', 'Instalar antena de Ares', 'antenna_install', 1)],
  },
];

const MAINTENANCE_MODULES = [
  ['hangar', 'Hangar de la nave'],
  ['engineering', 'Sala de ingeniería'],
  ['power', 'Generación eléctrica'],
  ['life', 'Control ambiental'],
  ['workshop', 'Taller mecánico'],
  ['lab', 'Laboratorio científico'],
  ['medbay', 'Enfermería'],
  ['dorms', 'Dormitorios'],
  ['mess', 'Comedor'],
  ['storage', 'Almacén'],
  ['cockpit', 'Puente de mando'],
  ['ops', 'Sala de operaciones'],
  ['evaprep', 'Preparación EVA'],
];

const cloneMission = (definition) => ({
  ...definition,
  location: definition.location ?? 'station',
  objectives: definition.objectives.map((item) => ({ ...item, progress: 0 })),
  state: 'available',
});

export class MissionManager {
  constructor() {
    this.onComplete = null;
    this.onActivate = null;
    this.generated = 0;
    this.history = [];
    this.completedIds = new Set();
    this.reset();
  }

  reset({ preserveHistory = false, autoActivate = true } = {}) {
    if (!preserveHistory) {
      this.history = [];
      this.completedIds = new Set();
      this.generated = 0;
    }

    this.missions = MISSIONS.map(cloneMission);
    this.activeId = autoActivate ? 'leak_repair' : null;
    const active = this.activeId ? this.getById(this.activeId) : null;
    if (active) active.state = 'accepted';
  }

  get list() {
    return this.missions;
  }

  getById(id) {
    return this.missions.find((mission) => mission.id === id) ?? null;
  }

  get active() {
    return this.getById(this.activeId);
  }

  /**
   * Añade una misión definida por la mesa de diseño sin tocar las existentes.
   * Devuelve la misión creada para poder activarla.
   */
  addMission(definition) {
    if (!definition?.id) return null;
    if (this.getById(definition.id)) return this.getById(definition.id);
    const mission = cloneMission(definition);
    this.missions.push(mission);
    return mission;
  }

  get completedCount() {
    return this.completedIds.size;
  }

  /** Misiones pendientes para una localización (las completadas no salen). */
  pendingFor(location = 'station') {
    return this.missions.filter(
      (mission) =>
        mission.state !== 'completed' &&
        (mission.location === 'any' || mission.location === location)
    );
  }

  historyFor(location = null) {
    return this.history.filter(
      (entry) => location === null || entry.location === 'any' || entry.location === location
    );
  }

  stateLabel(mission) {
    return MISSION_STATES[mission?.state] ?? 'Disponible';
  }

  activate(id) {
    const mission = this.getById(id);
    if (!mission) return { ok: false, reason: 'Misión inexistente.' };
    if (mission.state === 'completed') {
      return { ok: false, reason: 'Misión ya completada.' };
    }
    if (this.activeId === id) return { ok: true, mission };

    const previous = this.active;
    if (previous && previous.state !== 'completed') {
      previous.state = previous.objectives.some((item) => item.progress > 0)
        ? 'in_progress'
        : 'available';
    }

    if (mission.state === 'failed' || mission.state === 'abandoned') {
      for (const item of mission.objectives) item.progress = 0;
    }

    this.activeId = id;
    mission.state = 'accepted';
    this.onActivate?.(mission);
    return { ok: true, mission };
  }

  /** Progreso por tipo de evento. `location` evita avanzar misiones de otro planeta. */
  notify(type, amount = 1, location = null) {
    const mission = this.active;
    if (!mission) return null;
    if (location && mission.location !== 'any' && mission.location !== location) return null;

    const targets = mission.objectives.filter((item) => item.type === type);
    if (targets.length === 0) return null;

    for (const item of targets) {
      item.progress = Math.min(item.target, item.progress + amount);
    }

    if (mission.state === 'accepted') mission.state = 'in_progress';
    return this._checkCompletion(mission);
  }

  /** Progreso por visita a un módulo concreto (mantenimiento procedural). */
  notifyVisit(moduleId, location = 'station') {
    const mission = this.active;
    if (!mission) return null;
    if (mission.location !== 'any' && mission.location !== location) return null;

    const targets = mission.objectives.filter(
      (item) => item.type === 'visit' && item.targetId === moduleId
    );
    if (targets.length === 0) return null;

    for (const item of targets) {
      item.progress = Math.min(item.target, item.progress + 1);
    }

    if (mission.state === 'accepted') mission.state = 'in_progress';
    return this._checkCompletion(mission);
  }

  _checkCompletion(mission) {
    if (!this.isComplete(mission)) return null;

    mission.state = 'completed';
    this.activeId = null;
    this.completedIds.add(mission.id);
    this.history.unshift({
      id: mission.id,
      name: mission.name,
      category: mission.category,
      location: mission.location,
      difficulty: mission.difficulty,
      completedAt: Date.now(),
      objectives: mission.objectives.map((item) => ({ ...item })),
      reward: { ...mission.reward },
    });
    this.onComplete?.(mission);
    return mission;
  }

  fail(id, reason = '') {
    const mission = this.getById(id);
    if (!mission || mission.state === 'completed') return false;
    mission.state = 'failed';
    if (this.activeId === id) this.activeId = null;
    this.history.unshift({
      id: mission.id,
      name: mission.name,
      category: mission.category,
      location: mission.location,
      difficulty: mission.difficulty,
      completedAt: Date.now(),
      failed: true,
      reason,
      objectives: mission.objectives.map((item) => ({ ...item })),
      reward: { ...mission.reward },
    });
    return true;
  }

  abandon(id) {
    const mission = this.getById(id);
    if (!mission || mission.state === 'completed') return false;
    mission.state = 'abandoned';
    if (this.activeId === id) this.activeId = null;
    return true;
  }

  isComplete(mission = this.active) {
    if (!mission) return false;
    return mission.objectives.every((item) => item.progress >= item.target);
  }

  progress(mission = this.active) {
    if (!mission) return { done: 0, total: 0, ratio: 0 };
    const total = mission.objectives.reduce((sum, item) => sum + item.target, 0);
    const done = mission.objectives.reduce(
      (sum, item) => sum + Math.min(item.target, item.progress),
      0
    );
    return { done, total, ratio: total > 0 ? done / total : 0 };
  }

  setProgress(type, value) {
    const mission = this.active;
    if (!mission) return;
    for (const item of mission.objectives) {
      if (item.type === type) item.progress = Math.min(item.target, value);
    }
    if (mission.state === 'accepted') mission.state = 'in_progress';
  }

  /**
   * Genera una misión de mantenimiento única con objetivos y módulos
   * diferentes. Se usa para que la estación nunca se quede sin trabajo.
   */
  generateMaintenance(count = 1) {
    const created = [];
    for (let i = 0; i < count; i++) {
      const first = Math.floor(Math.random() * MAINTENANCE_MODULES.length);
      let second = Math.floor(Math.random() * MAINTENANCE_MODULES.length);
      if (second === first) second = (second + 1) % MAINTENANCE_MODULES.length;

      const [idA, labelA] = MAINTENANCE_MODULES[first];
      const [idB, labelB] = MAINTENANCE_MODULES[second];
      const serial = ++this.generated;
      const id = `maint_${serial}_${Date.now().toString(36)}`;

      const mission = cloneMission({
        id,
        name: `Ronda de mantenimiento ${serial}`,
        category: 'maintenance',
        scope: 'interior',
        location: 'station',
        difficulty: 'Fácil',
        description:
          `Inspecciona ${labelA} y ${labelB}. Registra el estado de las instalaciones ` +
          'para que la estación siga operativa.',
        reward: { o2: 12, rcs: 14, hull: 4 },
        objectives: [
          objective('visitA', `Revisar ${labelA}`, 'visit', 1, idA),
          objective('visitB', `Revisar ${labelB}`, 'visit', 1, idB),
        ],
      });
      this.missions.push(mission);
      created.push(mission);
    }
    return created;
  }

  serialize() {
    return {
      missions: this.missions.map((mission) => ({
        ...mission,
        objectives: mission.objectives.map((item) => ({ ...item })),
      })),
      activeId: this.activeId,
      generated: this.generated,
      history: this.history.map((entry) => ({
        ...entry,
        objectives: entry.objectives.map((item) => ({ ...item })),
        reward: { ...entry.reward },
      })),
      completedIds: [...this.completedIds],
    };
  }

  restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.missions)) return false;

    this.missions = snapshot.missions.map((mission) => ({
      ...mission,
      location: mission.location ?? 'station',
      objectives: (mission.objectives ?? []).map((item) => ({ ...item })),
    }));
    this.activeId = snapshot.activeId ?? null;
    this.generated = Number(snapshot.generated) || 0;
    this.history = (snapshot.history ?? []).map((entry) => ({
      ...entry,
      objectives: (entry.objectives ?? []).map((item) => ({ ...item })),
      reward: { ...(entry.reward ?? {}) },
    }));
    this.completedIds = new Set(snapshot.completedIds ?? []);

    // Las misiones completadas siempre mandan sobre el estado serializado.
    for (const mission of this.missions) {
      if (this.completedIds.has(mission.id)) mission.state = 'completed';
    }
    if (this.activeId && !this.getById(this.activeId)) this.activeId = null;
    return true;
  }
}
