/**
 * Centro de Datos Científicos de SPACE-TECH.
 *
 * Todo el contenido es estático: no se consulta ninguna API durante el juego.
 * Cada dato declara su fuente, unidad, fecha de consulta y si es oficial, de
 * terceros, un parámetro simplificado del juego o un resultado de simulación.
 */

export const ACCESS_DATE = '2026-11-13';

export const DISCLAIMER =
  'SPACE-TECH es un proyecto educativo independiente. No está patrocinado, aprobado ni respaldado por NASA ni por ninguna de las organizaciones citadas.';

export const DISCLAIMER_NOTE =
  'La NASA no respalda entidades no gubernamentales por el mero hecho de que utilicen sus recursos.';

export const DATA_KINDS = {
  official: 'Dato oficial',
  thirdParty: 'Dato de terceros',
  gameParameter: 'Parámetro del juego',
  simulation: 'Resultado de la simulación',
};

/**
 * Recursos de referencia utilizados para diseñar la experiencia educativa.
 * `license` resume la condición de uso; no se copia código ni arte de estos
 * recursos dentro de SPACE-TECH.
 */
export const SOURCES = [
  {
    id: 'nasa-design',
    organization: 'NASA',
    title: 'Design and Develop Science Missions',
    url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf',
    date: '26 de marzo de 2025',
    kind: 'official',
    use:
      'Referencia del proceso de seis fases y de los cuatro segmentos de una misión (launch, space, ground, user).',
    license: 'Documento público de NASA. Se cita como referencia educativa; no se reproduce su contenido.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'gmat',
    organization: 'NASA',
    title: 'General Mission Analysis Tool (GMAT)',
    url: 'https://software.nasa.gov/software/GSC-19468-1',
    date: 'Consultado en 2026',
    kind: 'official',
    use:
      'Referencia conceptual para navegación, análisis orbital, optimización y comparación de trayectorias.',
    license:
      'GMAT es un proyecto de código abierto de NASA. SPACE-TECH no incluye GMAT ni afirma calcular trayectorias con él.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'cml',
    organization: 'NASA JPL',
    title: 'Concept Maturity Levels (CML)',
    url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299',
    date: 'Consultado en 2026',
    kind: 'official',
    use:
      'Marco educativo CML 1-4 para valorar la madurez de un concepto de misión. No es una certificación oficial.',
    license: 'Recurso de JPL/Caltech. Se usa como inspiración metodológica, sin reproducir sus documentos.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'mdl',
    organization: 'NASA GSFC',
    title: 'Mission Design Lab',
    url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/',
    date: 'Consultado en 2026',
    kind: 'official',
    use:
      'Inspiración para las modalidades Concept Development, Trade Studies y Point Design de la mesa de diseño.',
    license: 'Página institucional de NASA. Se cita como referencia; el juego no replica el laboratorio real.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'mission-viz',
    organization: 'NASA',
    title: 'NASA Mission VIZ',
    url: 'https://nasa.github.io/mission-viz/',
    date: 'Consultado en 2026',
    kind: 'official',
    use:
      'Referencia para visualizar trayectorias, parámetros orbitales, planetas y viajes Tierra-Luna en 3D.',
    license:
      'Repositorio de NASA con su propia licencia. SPACE-TECH adapta sólo la idea de visualización con Three.js.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'build-satellite',
    organization: 'NASA',
    title: 'Build It Yourself: Satellite',
    url: 'https://science.nasa.gov/mission/webb/game-build-it-yourself/',
    date: 'Consultado en 2026',
    kind: 'official',
    use:
      'Inspiración para elegir objetivo científico, instrumentos, restricciones, lanzamiento y comparación con misiones reales.',
    license: 'Juego educativo de NASA. No se copian gráficos ni recursos.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'cubesat101',
    organization: 'NASA CSLI',
    title: 'CubeSat 101',
    url: 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf',
    date: 'Revisión de 2017',
    kind: 'official',
    use:
      'Material complementario sobre conceptos, diseño, pruebas, preparación de lanzamiento y operaciones de pequeños satélites.',
    license:
      'Documento público de NASA. Sus cronogramas y requisitos históricos no se presentan como normas vigentes.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'spaceapps-vr',
    organization: 'NASA Space Apps Challenge',
    title: 'Visualize a Space Mission using Virtual Reality',
    url: 'https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/',
    date: '2023',
    kind: 'official',
    use:
      'Idea de visualizar trayectoria, posición de vehículos, planetas, eventos y cronología conectados al estado de la simulación.',
    license: 'Reto público de Space Apps. Se adapta la idea, no los recursos de los equipos participantes.',
    accessed: ACCESS_DATE,
  },
  {
    id: 'csa',
    organization: 'Agencia Espacial Canadiense (CSA)',
    title: 'Digital games and activities',
    url: 'https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp',
    date: 'Consultado en 2026',
    kind: 'thirdParty',
    use:
      'Referencia complementaria para diseñar ejercicios educativos atractivos. Es un recurso de CSA, no de NASA.',
    license:
      'Recurso de la Agencia Espacial Canadiense. Se respetan sus condiciones de utilización; no se copia contenido.',
    accessed: ACCESS_DATE,
  },
];

/**
 * Datos científicos reales. `value` se muestra tal cual; `unit` y `sourceId`
 * permiten auditar cada cifra. No se inventan valores.
 */
export const SCIENCE_DATA = [
  {
    id: 'moon-gravity',
    label: 'Gravedad superficial lunar',
    value: 1.624,
    unit: 'm/s²',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'Aceleración gravitatoria media en la superficie de la Luna.',
  },
  {
    id: 'mars-gravity',
    label: 'Gravedad superficial marciana',
    value: 3.73,
    unit: 'm/s²',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Aceleración gravitatoria media en la superficie de Marte.',
  },
  {
    id: 'earth-gravity',
    label: 'Gravedad superficial terrestre',
    value: 9.80665,
    unit: 'm/s²',
    kind: 'official',
    sourceId: 'nasa-factsheet-earth',
    description: 'Aceleración gravitatoria media al nivel del mar.',
  },
  {
    id: 'moon-radius',
    label: 'Radio ecuatorial lunar',
    value: 1737.4,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'Radio medio del ecuador lunar.',
  },
  {
    id: 'mars-radius',
    label: 'Radio ecuatorial marciano',
    value: 3389.5,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Radio medio del ecuador de Marte.',
  },
  {
    id: 'earth-radius',
    label: 'Radio ecuatorial terrestre',
    value: 6378.1,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-earth',
    description: 'Radio medio del ecuador terrestre.',
  },
  {
    id: 'moon-distance',
    label: 'Distancia media Tierra-Luna',
    value: 384400,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'Distancia media entre los centros de la Tierra y la Luna.',
  },
  {
    id: 'au',
    label: 'Unidad astronómica',
    value: 149597870.7,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-earth',
    description: 'Distancia media Tierra-Sol, definida como 1 au.',
  },
  {
    id: 'light-speed',
    label: 'Velocidad de la luz en el vacío',
    value: 299792.458,
    unit: 'km/s',
    kind: 'official',
    sourceId: 'nasa-factsheet-earth',
    description: 'Constante física usada para estimar retardos de comunicación.',
  },
  {
    id: 'mars-day',
    label: 'Día solar marciano (sol)',
    value: 24.66,
    unit: 'h',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Duración del día solar medio en Marte.',
  },
  {
    id: 'moon-day',
    label: 'Rotación sidérea lunar',
    value: 27.32,
    unit: 'días terrestres',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'Periodo de rotación sidérea de la Luna.',
  },
  {
    id: 'mars-co2',
    label: 'CO₂ en la atmósfera marciana',
    value: 95.3,
    unit: '%',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Composición dominante de la atmósfera de Marte.',
  },
  {
    id: 'earth-moon-distance',
    label: 'Distancia media Tierra-Luna',
    value: 384400,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'Distancia media entre la Tierra y la Luna (NSSDC).',
  },
  {
    id: 'earth-mars-distance-min',
    label: 'Distancia mínima Tierra-Marte',
    value: 54600000,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Distancia mínima aproximada entre la Tierra y Marte (54,6 M km).',
  },
  {
    id: 'earth-mars-distance-max',
    label: 'Distancia máxima Tierra-Marte',
    value: 400200000,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Distancia máxima aproximada entre la Tierra y Marte (400,2 M km).',
  },
  {
    id: 'iss-altitude',
    label: 'Altitud de referencia LEO (ISS)',
    value: 400,
    unit: 'km',
    kind: 'official',
    sourceId: 'nasa-factsheet-earth',
    description: 'Altitud típica de la ISS: 370–460 km (referencia 400 km).',
  },
  {
    id: 'earth-angular-diameter-from-moon',
    label: 'Diámetro angular de la Tierra desde la Luna',
    value: 1.9,
    unit: 'grados',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'La Tierra ocupa ~1,8–2,0° vistos desde la Luna.',
  },
  {
    id: 'moon-angular-diameter-from-earth',
    label: 'Diámetro angular de la Luna desde la Tierra',
    value: 0.5,
    unit: 'grados',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'La Luna ocupa ~0,5° vistos desde la Tierra.',
  },
  {
    id: 'mars-transfer-window',
    label: 'Ventana de transferencia a Marte',
    value: 26,
    unit: 'meses',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Oportunidades de transferencia eficiente a Marte cada ~26 meses.',
  },
  {
    id: 'moon-transit-days',
    label: 'Duración típica del viaje Tierra-Luna',
    value: 3,
    unit: 'días',
    kind: 'official',
    sourceId: 'nasa-factsheet-moon',
    description: 'Misiones Apollo: ~3 días de tránsito.',
  },
  {
    id: 'mars-transit-months',
    label: 'Duración típica del viaje Tierra-Marte',
    value: 9,
    unit: 'meses',
    kind: 'official',
    sourceId: 'nasa-factsheet-mars',
    description: 'Trayectorias directas: 7–10 meses.',
  },
];

/**
 * Fuentes de los datos anteriores. Se mantienen separadas de los recursos
 * educativos para que el centro pueda mostrar la trazabilidad exacta.
 */
export const DATA_SOURCES = [
  {
    id: 'nasa-factsheet-moon',
    organization: 'NASA NSSDCA',
    title: 'Moon Fact Sheet',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    kind: 'official',
    accessed: ACCESS_DATE,
    credit: 'NASA Goddard Space Flight Center, NSSDCA.',
  },
  {
    id: 'nasa-factsheet-mars',
    organization: 'NASA NSSDCA',
    title: 'Mars Fact Sheet',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    kind: 'official',
    accessed: ACCESS_DATE,
    credit: 'NASA Goddard Space Flight Center, NSSDCA.',
  },
  {
    id: 'nasa-factsheet-earth',
    organization: 'NASA NSSDCA',
    title: 'Earth Fact Sheet',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
    kind: 'official',
    accessed: ACCESS_DATE,
    credit: 'NASA Goddard Space Flight Center, NSSDCA.',
  },
];

/**
 * Parámetros simplificados del simulador. Se muestran aparte para no
 * confundirlos con datos reales.
 */
export const GAME_PARAMETERS = [
  {
    id: 'game-moon-gravity',
    label: 'Gravedad lunar en el simulador',
    value: 1.624,
    unit: 'm/s²',
    kind: 'gameParameter',
    description: 'Valor usado por el motor de física; coincide con el dato oficial.',
  },
  {
    id: 'game-mars-gravity',
    label: 'Gravedad marciana en el simulador',
    value: 3.73,
    unit: 'm/s²',
    kind: 'gameParameter',
    description: 'Valor usado por el motor de física; coincide con el dato oficial.',
  },
  {
    id: 'game-travel-moon',
    label: 'Coste de combustible a la Luna',
    value: 10,
    unit: '% del depósito',
    kind: 'gameParameter',
    description: 'Consumo simplificado del viaje orbital. No es un cálculo orbital real.',
  },
  {
    id: 'game-travel-mars',
    label: 'Coste de combustible a Marte',
    value: 16,
    unit: '% del depósito',
    kind: 'gameParameter',
    description: 'Consumo simplificado del viaje interplanetario. No es un cálculo orbital real.',
  },
  {
    id: 'game-eva-o2',
    label: 'Reserva de O2 en EVA',
    value: 100,
    unit: 'puntos',
    kind: 'gameParameter',
    description: 'Recurso de juego de 0 a 100; no representa litros ni minutos reales.',
  },
];

export const SOURCE_BY_ID = new Map([...SOURCES, ...DATA_SOURCES].map((item) => [item.id, item]));

export function sourceFor(id) {
  return SOURCE_BY_ID.get(id) ?? null;
}

export function dataKindLabel(kind) {
  return DATA_KINDS[kind] ?? kind;
}
