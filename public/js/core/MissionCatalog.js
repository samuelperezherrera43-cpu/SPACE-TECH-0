/**
 * Catálogo y auditoría de las misiones existentes (Prompt 3.7, sección 7).
 *
 * No elimina ni modifica misiones: clasifica las 20 misiones actuales por fase
 * del proceso, señala solapamientos y propone conservar, transformar, convertir
 * en secundaria o retirar. El sistema MissionManager sigue siendo la única
 * fuente de verdad del progreso guardado.
 */

export const MISSION_PHASES = {
  design: 'Diseño de misión',
  preparation: 'Preparación y verificación',
  launch: 'Lanzamiento',
  operations: 'Operaciones espaciales',
  comms: 'Comunicaciones terrestres',
  science: 'Investigación científica',
  exploration: 'Exploración planetaria',
  maintenance: 'Reparación y mantenimiento',
};

export const RECOMMENDATIONS = {
  keep: 'Conservar',
  transform: 'Transformar',
  secondary: 'Convertir en secundaria',
  retire: 'Propuesta de retirada',
};

/**
 * `educational` es una estimación 1-5 de carga educativa; `notes` explica la
 * decisión y `dependency` documenta por qué no puede borrarse sin migración.
 */
export const MISSION_CATALOG = [
  {
    id: 'leak_repair',
    phase: 'maintenance',
    recommendation: 'keep',
    educational: 4,
    notes: 'Núcleo de la fantasía EVA. Enseña diagnóstico, herramienta correcta y sellado.',
    dependency: 'Misión inicial histórica; su progreso vive en saves existentes.',
  },
  {
    id: 'solar_repair',
    phase: 'maintenance',
    recommendation: 'keep',
    educational: 4,
    notes: 'Introduce energía solar y reparación de conectores. Buena progresión tras fugas.',
    dependency: 'Comparte eventos de reparación exterior con leak_repair.',
  },
  {
    id: 'antenna_repair',
    phase: 'comms',
    recommendation: 'keep',
    educational: 5,
    notes: 'Conecta reparación con enlace Tierra-estación; base para lecciones de comunicaciones.',
    dependency: 'Su evento antenna se reutiliza en misiones de antena.',
  },
  {
    id: 'component_swap',
    phase: 'preparation',
    recommendation: 'secondary',
    educational: 3,
    notes: 'Bucle recoger-instalar correcto, pero muy parecido a tool_recovery. Secundaria.',
    dependency: 'Usa inventario.component y la toma del módulo.',
  },
  {
    id: 'module_inspection',
    phase: 'maintenance',
    recommendation: 'secondary',
    educational: 2,
    notes: 'Tres inspecciones con escáner; se solapa con las rondas de mantenimiento generadas.',
    dependency: 'Comparte el evento inspection con el mantenimiento procedural.',
  },
  {
    id: 'tool_recovery',
    phase: 'operations',
    recommendation: 'secondary',
    educational: 2,
    notes: 'Recogida simple de objetos. Útil como tutorial, no como misión principal.',
    dependency: 'Sus objetos flotantes usan el mismo sistema de tareas exteriores.',
  },
  {
    id: 'engineering_power',
    phase: 'maintenance',
    recommendation: 'keep',
    educational: 5,
    notes: 'Circuitos, potencia y consola real. Encaja con la lección de energía.',
    dependency: 'Modifica engineering.circuits y la potencia del hábitat.',
  },
  {
    id: 'life_support',
    phase: 'maintenance',
    recommendation: 'keep',
    educational: 5,
    notes: 'Filtros, O2 y soporte vital. Consecuencias directas sobre la regeneración.',
    dependency: 'Modifica lifeSupport.filters y o2RegenScale.',
  },
  {
    id: 'lab_analysis',
    phase: 'science',
    recommendation: 'keep',
    educational: 4,
    notes: 'Muestras y calibración; puente entre exploración y análisis de datos.',
    dependency: 'Modifica lab.samples y lab.calibrated.',
  },
  {
    id: 'navigation_survey',
    phase: 'design',
    recommendation: 'transform',
    educational: 3,
    notes: 'Revisar puntos de interés es demasiado simple. Transformar en un ejercicio de selección de destino y ventana orbital.',
    dependency: 'Usa visitedPois y el mapa del puente.',
  },
  {
    id: 'moon_landing',
    phase: 'exploration',
    recommendation: 'keep',
    educational: 4,
    notes: 'Primer contacto lunar; enseña viaje, aterrizaje y recogida de regolito.',
    dependency: 'Depende de travel_moon y del estado de la Luna.',
  },
  {
    id: 'moon_ice',
    phase: 'science',
    recommendation: 'keep',
    educational: 5,
    notes: 'Hielo lunar como recurso científico y de supervivencia. Núcleo educativo.',
    dependency: 'Comparte collect_ice con la misión marciana de hielo.',
  },
  {
    id: 'moon_build',
    phase: 'operations',
    recommendation: 'keep',
    educational: 4,
    notes: 'Construcción con recursos; demuestra consecuencias de la logística.',
    dependency: 'Modifica módulos construidos en la Luna.',
  },
  {
    id: 'mars_mountain',
    phase: 'exploration',
    recommendation: 'keep',
    educational: 3,
    notes: 'Exploración de terreno difícil; buena para orientación y geología.',
    dependency: 'Usa mountainExplored persistente.',
  },
  {
    id: 'mars_cave',
    phase: 'exploration',
    recommendation: 'keep',
    educational: 4,
    notes: 'Cueva, hielo subsuperficial y navegación; aporta variedad.',
    dependency: 'Usa caveExplored y el sistema de cueva de Marte.',
  },
  {
    id: 'mars_mining',
    phase: 'science',
    recommendation: 'keep',
    educational: 4,
    notes: 'Minerales y metales; conecta recursos con construcción.',
    dependency: 'Comparte collect_minerals con la Luna.',
  },
  {
    id: 'mars_outpost',
    phase: 'operations',
    recommendation: 'secondary',
    educational: 3,
    notes: 'Espejo de moon_build. Se conserva como secundaria para no duplicar el núcleo.',
    dependency: 'Modifica módulos construidos en Marte.',
  },
  {
    id: 'mars_geology',
    phase: 'science',
    recommendation: 'transform',
    educational: 3,
    notes: 'Un solo clic en consola. Transformar en cadena: medir, comparar y transmitir.',
    dependency: 'Usa marsSystems.geology.',
  },
  {
    id: 'mars_equipment',
    phase: 'maintenance',
    recommendation: 'keep',
    educational: 4,
    notes: 'Reparación de rover y equipo tras tormenta; buena aplicación práctica.',
    dependency: 'Usa marsSystems.equipment y el rover.',
  },
  {
    id: 'mars_antenna',
    phase: 'comms',
    recommendation: 'secondary',
    educational: 4,
    notes: 'Duplica el tema de antenna_repair en otro destino. Secundaria con contexto marciano.',
    dependency: 'Usa marsSystems.antenna.',
  },
];

export const AUDIT_GROUPS = [
  {
    id: 'power',
    title: 'Energía y reparación',
    missions: ['solar_repair', 'engineering_power'],
    finding:
      'Dos misiones restauran potencia en ámbitos distintos (exterior/interior). No son duplicadas, pero conviene explicar la diferencia en el catálogo.',
    action: 'Conservar ambas y enlazarlas en la lección de energía.',
  },
  {
    id: 'pickup',
    title: 'Recoger e instalar',
    missions: ['component_swap', 'tool_recovery'],
    finding: 'Mismo bucle de recogida; tool_recovery es la versión más simple.',
    action: 'tool_recovery queda como secundaria/tutorial.',
  },
  {
    id: 'inspection',
    title: 'Inspección',
    missions: ['module_inspection', 'maint_generated'],
    finding: 'Las rondas de mantenimiento generadas repiten la inspección de módulos.',
    action: 'module_inspection pasa a secundaria; las rondas cubren el bucle infinito.',
  },
  {
    id: 'construction',
    title: 'Construcción',
    missions: ['moon_build', 'mars_outpost'],
    finding: 'La mecánica es idéntica; sólo cambia el destino.',
    action: 'moon_build se conserva como principal; mars_outpost pasa a secundaria.',
  },
  {
    id: 'comms',
    title: 'Comunicaciones',
    missions: ['antenna_repair', 'mars_antenna'],
    finding: 'Dos antenas con la misma lección. La marciana añade contexto pero no mecánica nueva.',
    action: 'antenna_repair principal; mars_antenna secundaria.',
  },
  {
    id: 'science',
    title: 'Ciencia de campo',
    missions: ['moon_ice', 'mars_mining', 'mars_geology'],
    finding: 'Recogida de recursos y análisis de terreno. mars_geology es demasiado directa.',
    action: 'Transformar mars_geology en una cadena de tres pasos.',
  },
];

export const CATALOG_STATS = (() => {
  const byPhase = {};
  const byRecommendation = {};
  for (const mission of MISSION_CATALOG) {
    byPhase[mission.phase] = (byPhase[mission.phase] ?? 0) + 1;
    byRecommendation[mission.recommendation] =
      (byRecommendation[mission.recommendation] ?? 0) + 1;
  }
  return { total: MISSION_CATALOG.length, byPhase, byRecommendation };
})();

export function catalogFor(id) {
  return MISSION_CATALOG.find((item) => item.id === id) ?? null;
}

export function phaseLabel(id) {
  return MISSION_PHASES[id] ?? id;
}

export function recommendationLabel(id) {
  return RECOMMENDATIONS[id] ?? id;
}
