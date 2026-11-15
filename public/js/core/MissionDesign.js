/**
 * Mesa de diseño de misiones (Prompt 3.7, secciones 8-9).
 *
 * Implementa el proceso educativo de seis fases inspirado en NASA, los cuatro
 * segmentos de arquitectura, la madurez de concepto CML 1-4 (inspirada en JPL)
 * y las modalidades de la Mission Design Lab. No calcula trayectorias reales:
 * los valores son parámetros simplificados del juego y así se declaran.
 */

export const DESIGN_PHASES = [
  {
    id: 1,
    key: 'need',
    title: 'Identificar la necesidad',
    short: 'Necesidad',
    description:
      'Define qué problema científico quieres investigar y qué medida demostraría que la misión ha tenido éxito.',
  },
  {
    id: 2,
    key: 'concept',
    title: 'Definir el concepto',
    short: 'Concepto',
    description:
      'Elige el tipo de misión y la modalidad de diseño. Compara alternativas antes de comprometer recursos.',
  },
  {
    id: 3,
    key: 'requirements',
    title: 'Establecer los requisitos',
    short: 'Requisitos',
    description:
      'Fija masa, potencia, coste, datos y ancho de banda. Los requisitos deben ser medibles y verificables.',
  },
  {
    id: 4,
    key: 'design',
    title: 'Diseñar',
    short: 'Diseño',
    description:
      'Selecciona lanzador, instrumentos, trayectoria y estación de tierra. Cada elección consume masa, energía o presupuesto.',
  },
  {
    id: 5,
    key: 'verify',
    title: 'Construir y verificar',
    short: 'Verificar',
    description:
      'Comprueba el diseño contra los requisitos y las restricciones. Un diseño no verificado no se implementa.',
  },
  {
    id: 6,
    key: 'implement',
    title: 'Implementar',
    short: 'Implementar',
    description:
      'Prepara la misión, consume recursos del simulador y añádela al sistema real de misiones para ejecutarla.',
  },
];

export const DESIGN_SEGMENTS = [
  {
    id: 'launch',
    name: 'Launch Segment',
    description: 'Vehículo de lanzamiento, integración y servicios de lanzamiento.',
  },
  {
    id: 'space',
    name: 'Space Segment',
    description: 'Nave, módulos, instrumentos, orbitador, aterrizador o rover.',
  },
  {
    id: 'ground',
    name: 'Ground Segment',
    description: 'Estaciones de comunicación, recepción de datos y centro de control.',
  },
  {
    id: 'user',
    name: 'User Segment',
    description: 'Equipo científico y usuarios que interpretan los datos.',
  },
];

export const DESIGN_MODALITIES = [
  {
    id: 'concept',
    name: 'Concept Development',
    description: 'Explorar una idea y madurarla hasta un concepto defendible.',
  },
  {
    id: 'trade',
    name: 'Trade Studies',
    description: 'Comparar alternativas con métricas comunes antes de elegir.',
  },
  {
    id: 'point',
    name: 'Point Design',
    description: 'Definir una arquitectura concreta y verificar sus números.',
  },
];

export const SCIENCE_GOALS = [
  {
    id: 'lunar_ice',
    name: 'Hielo de agua en cráteres lunares',
    question: '¿Dónde hay hielo de agua accesible cerca del polo lunar?',
    destination: 'moon',
    destinationName: 'Luna',
    objectiveType: 'collect_ice',
    objectiveLabel: 'Extraer muestras de hielo lunar',
    target: 2,
    tags: ['spectrometer', 'drill', 'camera'],
    minPowerW: 90,
    minDataGB: 12,
    minBandwidthKbps: 128,
    description:
      'El hielo lunar es un recurso científico y operativo: puede dar agua, oxígeno e hidrógeno. La misión debe medir su distribución y confirmar su acceso.',
  },
  {
    id: 'mars_geology',
    name: 'Estratigrafía de Marte',
    question: '¿Qué capas del terreno de Ares revelan la historia del agua?',
    destination: 'mars',
    destinationName: 'Marte',
    objectiveType: 'geology',
    objectiveLabel: 'Completar análisis geológico en Ares',
    target: 1,
    tags: ['camera', 'spectrometer', 'weather'],
    minPowerW: 110,
    minDataGB: 18,
    minBandwidthKbps: 192,
    description:
      'Las capas sedimentarias registran episodios de agua y clima. La misión necesita imagen, espectroscopía y contexto ambiental.',
  },
  {
    id: 'earth_climate',
    name: 'Nubes y hielo de la Tierra',
    question: '¿Cómo cambian las nubes y el hielo polar a lo largo del año?',
    destination: 'station',
    destinationName: 'Órbita terrestre',
    objectiveType: 'sample',
    objectiveLabel: 'Procesar datos de observación terrestre',
    target: 2,
    tags: ['camera', 'radiometer'],
    minPowerW: 140,
    minDataGB: 24,
    minBandwidthKbps: 256,
    description:
      'La observación repetida de la Tierra exige órbita adecuada, calibración radiométrica y un enlace capaz de descargar series temporales.',
  },
  {
    id: 'solar_weather',
    name: 'Clima espacial y partículas solares',
    question: '¿Qué partículas energéticas llegan a la órbita de la estación?',
    destination: 'station',
    destinationName: 'Órbita terrestre',
    objectiveType: 'sample',
    objectiveLabel: 'Analizar datos de partículas solares',
    target: 2,
    tags: ['particle', 'magnetometer'],
    minPowerW: 80,
    minDataGB: 10,
    minBandwidthKbps: 96,
    description:
      'El clima espacial afecta a tripulaciones y electrónica. Medir partículas y campo magnético permite emitir alertas.',
  },
  {
    id: 'comms_relay',
    name: 'Relé de comunicaciones Tierra-Luna',
    question: '¿Puede un relé reducir los huecos de comunicación en la Luna?',
    destination: 'moon',
    destinationName: 'Luna',
    objectiveType: 'antenna',
    objectiveLabel: 'Calibrar el enlace del relé lunar',
    target: 2,
    tags: ['transponder', 'antenna'],
    minPowerW: 100,
    minDataGB: 8,
    minBandwidthKbps: 512,
    description:
      'Un relé en órbita lunar puede cubrir la cara oculta. La prioridad es el enlace, no la masa de instrumentos científicos.',
  },
];

export const CONCEPTS = [
  {
    id: 'orbiter',
    name: 'Orbitador',
    description: 'Observa desde órbita; buena cobertura y bajo riesgo de aterrizaje.',
    baseMassKg: 420,
    basePowerW: 45,
    baseCostM: 48,
    risk: 1,
    destinations: ['moon', 'mars', 'station'],
  },
  {
    id: 'lander',
    name: 'Aterrizador fijo',
    description: 'Mide in situ en un punto; alta precisión y riesgo de descenso.',
    baseMassKg: 760,
    basePowerW: 60,
    baseCostM: 78,
    risk: 2,
    destinations: ['moon', 'mars'],
  },
  {
    id: 'rover',
    name: 'Rover móvil',
    description: 'Explora varias zonas; más masa y operaciones complejas.',
    baseMassKg: 980,
    basePowerW: 85,
    baseCostM: 112,
    risk: 3,
    destinations: ['moon', 'mars'],
  },
  {
    id: 'relay',
    name: 'Relé de comunicaciones',
    description: 'Prioriza antena y potencia para enlazar otros activos.',
    baseMassKg: 540,
    basePowerW: 110,
    baseCostM: 70,
    risk: 1,
    destinations: ['moon', 'mars', 'station'],
  },
  {
    id: 'sample_return',
    name: 'Retorno de muestras',
    description: 'Recoge y devuelve material; máxima complejidad y coste.',
    baseMassKg: 1250,
    basePowerW: 95,
    baseCostM: 165,
    risk: 4,
    destinations: ['moon'],
  },
];

export const INSTRUMENTS = [
  {
    id: 'camera',
    name: 'Cámara multiespectral',
    tags: ['camera'],
    massKg: 24,
    powerW: 18,
    dataGB: 6,
    costM: 14,
    description: 'Imagen y contexto; no identifica composición por sí sola.',
  },
  {
    id: 'spectrometer',
    name: 'Espectrómetro de reflectancia',
    tags: ['spectrometer'],
    massKg: 32,
    powerW: 22,
    dataGB: 5,
    costM: 18,
    description: 'Bandas de absorción para identificar minerales y hielo.',
  },
  {
    id: 'drill',
    name: 'Taladro subsuperficial',
    tags: ['drill'],
    massKg: 46,
    powerW: 35,
    dataGB: 2,
    costM: 22,
    description: 'Accede a hielo y regolito bajo la superficie.',
  },
  {
    id: 'weather',
    name: 'Estación meteorológica',
    tags: ['weather'],
    massKg: 18,
    powerW: 12,
    dataGB: 3,
    costM: 9,
    description: 'Presión, temperatura y viento para contexto ambiental.',
  },
  {
    id: 'radiometer',
    name: 'Radiómetro calibrado',
    tags: ['radiometer'],
    massKg: 20,
    powerW: 16,
    dataGB: 7,
    costM: 13,
    description: 'Mide flujos radiativos; clave para clima terrestre.',
  },
  {
    id: 'particle',
    name: 'Detector de partículas',
    tags: ['particle'],
    massKg: 15,
    powerW: 10,
    dataGB: 4,
    costM: 11,
    description: 'Cuenta partículas energéticas y estima dosis.',
  },
  {
    id: 'magnetometer',
    name: 'Magnetómetro',
    tags: ['magnetometer'],
    massKg: 12,
    powerW: 8,
    dataGB: 2,
    costM: 8,
    description: 'Mide campo magnético y ayuda a interpretar el plasma.',
  },
  {
    id: 'transponder',
    name: 'Transpondedor de banda X',
    tags: ['transponder'],
    massKg: 28,
    powerW: 30,
    dataGB: 1,
    costM: 20,
    description: 'Enlace de datos y rastreo para relés y comunicaciones.',
  },
  {
    id: 'antenna',
    name: 'Antena de alta ganancia',
    tags: ['antenna'],
    massKg: 34,
    powerW: 20,
    dataGB: 1,
    costM: 17,
    description: 'Aumenta el margen de enlace con el segmento de tierra.',
  },
];

export const LAUNCH_VEHICLES = [
  {
    id: 'vector_s',
    name: 'Vector-S · clase ligera',
    maxMassKg: 1500,
    costM: 32,
    description: 'Hasta 1.500 kg a órbita baja. Adecuado para orbitadores pequeños.',
  },
  {
    id: 'atlas_m',
    name: 'Atlas-M · clase media',
    maxMassKg: 3500,
    costM: 68,
    description: 'Hasta 3.500 kg. Cubre rovers y aterrizadores medios.',
  },
  {
    id: 'heavy_l',
    name: 'Hércules-L · clase pesada',
    maxMassKg: 8000,
    costM: 128,
    description: 'Hasta 8.000 kg. Para retorno de muestras o arquitecturas grandes.',
  },
];

export const TRAJECTORIES = [
  {
    id: 'direct',
    name: 'Transferencia directa',
    massFactor: 1.0,
    costM: 0,
    risk: 1,
    description: 'Menos maniobras; ventana de lanzamiento más estrecha.',
  },
  {
    id: 'assist',
    name: 'Asistencia gravitatoria',
    massFactor: 1.12,
    costM: 8,
    risk: 2,
    description: 'Ahorra impulso a cambio de masa de navegación y más duración.',
  },
  {
    id: 'loiter',
    name: 'Espera en órbita',
    massFactor: 1.06,
    costM: 5,
    risk: 1,
    description: 'Flexibiliza la ventana; añade operaciones y tiempo de misión.',
  },
];

export const GROUND_STATIONS = [
  {
    id: 'station_array',
    name: 'Red de estaciones de la estación',
    bandwidthKbps: 128,
    costM: 6,
    description: 'Cobertura básica y bajo coste.',
  },
  {
    id: 'deep_network',
    name: 'Red de espacio profundo (simulada)',
    bandwidthKbps: 512,
    costM: 24,
    description: 'Mayor cobertura y ancho de banda para Marte y la Luna.',
  },
  {
    id: 'dedicated',
    name: 'Estación dedicada',
    bandwidthKbps: 1024,
    costM: 40,
    description: 'Máxima disponibilidad; consume más presupuesto.',
  },
];

export const CML_LEVELS = [
  { id: 1, name: 'CML 1 · Idea inicial', description: 'Necesidad científica identificada.' },
  { id: 2, name: 'CML 2 · Viabilidad inicial', description: 'Concepto y destino definidos.' },
  {
    id: 3,
    name: 'CML 3 · Comparación de alternativas',
    description: 'Requisitos fijados y trade study realizado.',
  },
  {
    id: 4,
    name: 'CML 4 · Diseño definido',
    description: 'Diseño completo y verificado contra requisitos.',
  },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 10) / 10;

export function newDesignState() {
  return {
    phase: 1,
    goalId: null,
    conceptId: null,
    modality: 'concept',
    requirements: {
      massKg: 1500,
      powerW: 220,
      costM: 180,
      dataGB: 30,
      bandwidthKbps: 256,
    },
    vehicleId: null,
    instrumentIds: [],
    trajectoryId: 'direct',
    groundId: 'station_array',
    tradeChoice: 'balanced',
    compared: [],
    verified: null,
    implemented: false,
    report: null,
  };
}

export function goalById(id) {
  return SCIENCE_GOALS.find((item) => item.id === id) ?? null;
}

export function conceptById(id) {
  return CONCEPTS.find((item) => item.id === id) ?? null;
}

export function instrumentById(id) {
  return INSTRUMENTS.find((item) => item.id === id) ?? null;
}

export function vehicleById(id) {
  return LAUNCH_VEHICLES.find((item) => item.id === id) ?? null;
}

export function trajectoryById(id) {
  return TRAJECTORIES.find((item) => item.id === id) ?? null;
}

export function groundById(id) {
  return GROUND_STATIONS.find((item) => item.id === id) ?? null;
}

export function requirementsFor(goal) {
  if (!goal) return { ...newDesignState().requirements };
  return {
    massKg: goal.destination === 'moon' ? 1400 : 1900,
    powerW: Math.round(goal.minPowerW * 1.5),
    costM: goal.id === 'sample_return' ? 260 : 220,
    dataGB: Math.round(goal.minDataGB * 1.4),
    bandwidthKbps: Math.max(goal.minBandwidthKbps, 128),
  };
}

/** Métricas comunes para comparar alternativas y verificar el diseño. */
export function computeTotals(state) {
  const concept = conceptById(state.conceptId);
  const trajectory = trajectoryById(state.trajectoryId) ?? TRAJECTORIES[0];
  const vehicle = vehicleById(state.vehicleId);
  const ground = groundById(state.groundId) ?? GROUND_STATIONS[0];
  const instruments = (state.instrumentIds ?? []).map(instrumentById).filter(Boolean);

  const instrumentMass = instruments.reduce((sum, item) => sum + item.massKg, 0);
  const instrumentPower = instruments.reduce((sum, item) => sum + item.powerW, 0);
  const instrumentData = instruments.reduce((sum, item) => sum + item.dataGB, 0);
  const instrumentCost = instruments.reduce((sum, item) => sum + item.costM, 0);

  const baseMass = concept ? concept.baseMassKg : 0;
  const massKg = round((baseMass + instrumentMass) * trajectory.massFactor);
  const powerW = round((concept?.basePowerW ?? 0) + instrumentPower);
  const costM = round(
    (concept?.baseCostM ?? 0) +
      instrumentCost +
      (vehicle?.costM ?? 0) +
      (ground?.costM ?? 0) +
      trajectory.costM
  );
  const dataGB = round(instrumentData);
  const bandwidthKbps = ground.bandwidthKbps;

  return {
    massKg,
    powerW,
    costM,
    dataGB,
    bandwidthKbps,
    instrumentMass,
    instrumentPower,
    instrumentData,
    instrumentCost,
    risk: (concept?.risk ?? 0) + trajectory.risk,
    vehicle,
    concept,
    ground,
    trajectory,
    instruments,
  };
}

/** Tres alternativas de arquitectura para la mesa de trade studies. */
export function tradeAlternatives(state) {
  const goal = goalById(state.goalId);
  const base = conceptById(state.conceptId);
  if (!goal || !base) return [];

  const variants = [
    { id: 'minimal', name: 'Mínima', mass: 0.78, power: 0.82, cost: 0.8, risk: -1 },
    { id: 'balanced', name: 'Equilibrada', mass: 1, power: 1, cost: 1, risk: 0 },
    { id: 'capable', name: 'Capacidad ampliada', mass: 1.28, power: 1.22, cost: 1.32, risk: 1 },
  ];

  return variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    massKg: round(base.baseMassKg * variant.mass),
    powerW: round(base.basePowerW * variant.power),
    costM: round(base.baseCostM * variant.cost),
    risk: clamp(base.risk + variant.risk, 1, 5),
    meetsScience:
      variant.id === 'minimal'
        ? base.basePowerW >= goal.minPowerW * 0.7
        : variant.id === 'balanced'
          ? base.basePowerW >= goal.minPowerW * 0.9
          : true,
    note:
      variant.id === 'minimal'
        ? 'Menor coste, menos margen científico.'
        : variant.id === 'balanced'
          ? 'Compromiso entre coste, masa y capacidad.'
          : 'Más capacidad y margen, mayor coste y masa.',
  }));
}

/** CML educativo inspirado en JPL; no es una certificación oficial. */
export function cmlFor(state) {
  if (state.verified?.ok) return 4;
  if (
    state.goalId &&
    state.conceptId &&
    state.requirements &&
    (state.compared?.length ?? 0) >= 2
  ) {
    return 3;
  }
  if (state.goalId && state.conceptId) return 2;
  return 1;
}

export function verifyDesign(state) {
  const goal = goalById(state.goalId);
  const concept = conceptById(state.conceptId);
  const vehicle = vehicleById(state.vehicleId);
  const totals = computeTotals(state);
  const req = state.requirements;
  const checks = [];
  const errors = [];

  const add = (id, label, ok, detail) => {
    checks.push({ id, label, ok, detail });
    if (!ok) errors.push(detail);
  };

  add('goal', 'Objetivo científico definido', !!goal, 'Falta el objetivo científico (fase 1).');
  add('concept', 'Concepto de misión definido', !!concept, 'Falta el concepto de misión (fase 2).');
  add(
    'destination',
    'Concepto compatible con el destino',
    !!concept && !!goal && concept.destinations.includes(goal.destination),
    'El concepto elegido no es compatible con el destino científico.'
  );
  add(
    'instruments',
    'Instrumentos suficientes y compatibles',
    !!goal && totals.instruments.length >= 2 &&
      goal.tags.every((tag) => totals.instruments.some((item) => item.tags.includes(tag))),
    'Faltan instrumentos para cubrir las capacidades científicas del objetivo (mínimo 2).'
  );
  add(
    'vehicle',
    'Lanzador seleccionado y capaz',
    !!vehicle && totals.massKg <= vehicle.maxMassKg,
    'El lanzador no existe o no puede con la masa calculada.'
  );
  add(
    'mass',
    'Masa dentro del requisito',
    totals.massKg <= req.massKg,
    `Masa ${totals.massKg} kg supera el requisito de ${req.massKg} kg.`
  );
  add(
    'power',
    'Potencia dentro del requisito',
    totals.powerW <= req.powerW,
    `Potencia ${totals.powerW} W supera el requisito de ${req.powerW} W.`
  );
  add(
    'cost',
    'Coste dentro del presupuesto',
    totals.costM <= req.costM,
    `Coste ${totals.costM} M$ supera el presupuesto de ${req.costM} M$.`
  );
  add(
    'data',
    'Volumen de datos suficiente',
    totals.dataGB >= (goal?.minDataGB ?? 0),
    'Los instrumentos generan menos datos de los necesarios para responder a la pregunta.'
  );
  add(
    'bandwidth',
    'Enlace compatible con los datos',
    totals.bandwidthKbps >= req.bandwidthKbps,
    'La estación de tierra no alcanza el ancho de banda requerido.'
  );
  add(
    'trade',
    'Alternativas comparadas',
    (state.compared?.length ?? 0) >= 2,
    'Compara al menos dos alternativas en la mesa de diseño (Trade Studies).'
  );

  const ok = errors.length === 0;
  const cml = ok ? 4 : cmlFor(state);

  return {
    ok,
    checks,
    errors,
    totals,
    cml,
    cmlName: CML_LEVELS.find((level) => level.id === cml)?.name ?? CML_LEVELS[0].name,
  };
}

export function implementationCost(state) {
  const totals = computeTotals(state);
  return {
    fuel: Math.round(10 + totals.costM / 12),
    integrity: 2,
    industrial: Math.max(1, Math.round(totals.costM / 45)),
    electronics: Math.max(1, Math.round(totals.costM / 35)),
    metals: Math.max(1, Math.round(totals.costM / 30)),
  };
}

/** Convierte el diseño verificado en una misión del MissionManager real. */
export function buildMissionDefinition(state) {
  const goal = goalById(state.goalId);
  if (!goal) return null;
  const totals = computeTotals(state);
  const concept = conceptById(state.conceptId);
  const stamp = Date.now().toString(36);
  return {
    id: `design_${stamp}`,
    name: `Misión diseñada · ${goal.name}`,
    category: goal.destination === 'station' ? 'science' : 'exploration',
    scope: goal.destination === 'station' ? 'interior' : 'exterior',
    location: goal.destination,
    difficulty: totals.risk >= 5 ? 'Difícil' : totals.risk >= 3 ? 'Normal' : 'Fácil',
    description:
      `Campaña diseñada en la mesa de misión: ${goal.question} ` +
      `Arquitectura ${concept?.name ?? 'personalizada'}, ${totals.instruments.length} instrumentos, ` +
      `${totals.massKg} kg y ${totals.powerW} W.`,
    reward: { o2: 30, rcs: 26, hull: 10 },
    objectives: [
      {
        id: 'science',
        label: goal.objectiveLabel,
        type: goal.objectiveType,
        target: goal.target,
        targetId: null,
        progress: 0,
      },
    ],
    state: 'accepted',
  };
}

/** Informe educativo que se muestra al implementar. */
export function buildReport(state, { fuelSpent = 0, missionName = '' } = {}) {
  const goal = goalById(state.goalId);
  const concept = conceptById(state.conceptId);
  const totals = computeTotals(state);
  const cml = cmlFor(state);
  return {
    learned: [
      'Convertir una pregunta científica en requisitos medibles.',
      'Comparar alternativas antes de comprometer masa, energía y presupuesto.',
      'Verificar la compatibilidad entre instrumentos, lanzador, enlace y destino.',
    ],
    decisions: [
      `Objetivo: ${goal?.name ?? 'sin definir'}.`,
      `Concepto: ${concept?.name ?? 'sin definir'} (${state.modality}).`,
      `Instrumentos: ${totals.instruments.map((item) => item.name).join(', ') || 'ninguno'}.`,
      `Lanzador: ${totals.vehicle?.name ?? 'sin seleccionar'}.`,
    ],
    consequences: [
      `Masa calculada: ${totals.massKg} kg · potencia: ${totals.powerW} W.`,
      `Coste estimado: ${totals.costM} M$ · datos: ${totals.dataGB} GB.`,
      `Combustible consumido al implementar: ${fuelSpent}%.`,
      missionName ? `Misión añadida al sistema real: ${missionName}.` : '',
    ].filter(Boolean),
    concepts: ['masa', 'potencia', 'enlace', 'CML', 'segmentos de misión'],
    improve:
      totals.massKg > state.requirements.massKg
        ? 'Reduce masa: usa un lanzador mayor o elimina instrumentos secundarios.'
        : totals.costM > state.requirements.costM
          ? 'Reduce coste: revisa la estación de tierra o la trayectoria.'
          : 'Añade un trade study con una alternativa más capaz para subir la madurez del concepto.',
    cml,
    cmlName: CML_LEVELS.find((level) => level.id === cml)?.name ?? CML_LEVELS[0].name,
  };
}
