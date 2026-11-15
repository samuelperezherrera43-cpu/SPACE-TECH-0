/**
 * Academia SPACE-TECH.
 *
 * Diez lecciones con explicación, visualización, datos citados, actividad
 * interactiva y pregunta explicada. El progreso se guarda en localStorage y
 * se puede consultar desde el menú principal, la pausa y el centro de datos.
 */

export const ACADEMY_MODES = {
  beginner: 'Principiante',
  advanced: 'Avanzado',
};

const option = (id, text, correct = false, feedback = '') => ({
  id,
  text,
  correct,
  feedback,
});

export const ACADEMY_LESSONS = [
  {
    id: 'solar-system',
    number: 1,
    title: 'Sistema solar y cuerpos celestes',
    level: 'both',
    summary:
      'Una misión espacial empieza por saber dónde ocurre. La gravedad, el radio y la distancia de un cuerpo condicionan la energía, el tiempo de viaje y las comunicaciones.',
    concepts: ['gravedad', 'escala', 'órbita', 'cuerpo celeste'],
    illustration: 'solar-system',
    data: [
      { label: 'Gravedad lunar', value: 1.624, unit: 'm/s²', sourceId: 'nasa-factsheet-moon' },
      { label: 'Gravedad marciana', value: 3.73, unit: 'm/s²', sourceId: 'nasa-factsheet-mars' },
      { label: 'Distancia Tierra-Luna', value: 384400, unit: 'km', sourceId: 'nasa-factsheet-moon' },
    ],
    activity: {
      prompt:
        'Quieres posar un rover en un cuerpo con gravedad superficial menor que la terrestre pero mayor que la lunar. ¿Qué destino del simulador eliges?',
      options: [
        option('moon', 'La Luna, porque su gravedad es aún menor.', false, 'La Luna tiene 1,62 m/s²: menos que Marte.'),
        option('mars', 'Marte, con 3,71 m/s² frente a 1,62 m/s² de la Luna.', true, 'Correcto: Marte está entre la Luna y la Tierra.'),
        option('earth', 'La Tierra, porque es el único cuerpo con gravedad.', false, 'La Tierra tiene 9,81 m/s²; no cumple el criterio.'),
      ],
      explanation:
        'La gravedad superficial de Marte (3,71 m/s²) es mayor que la lunar (1,62 m/s²) y menor que la terrestre (9,81 m/s²).',
    },
    question: {
      prompt: '¿Qué magnitud cambia más directamente el coste de despegar de un cuerpo?',
      options: [
        option('gravity', 'Su gravedad superficial y su radio.'),
        option('color', 'Su color observado.'),
        option('name', 'El nombre que le da la misión.'),
      ],
      correct: 'gravity',
      explanation:
        'La velocidad de escape depende de la masa y el radio del cuerpo; la gravedad superficial resume parte de esa dificultad.',
    },
    advancedQuestion: {
      prompt: 'Si un cuerpo tiene la misma masa que la Tierra pero la mitad de radio, ¿qué ocurre con la gravedad superficial?',
      options: [
        option('half', 'Se reduce a la mitad.'),
        option('quadruple', 'Aumenta aproximadamente cuatro veces.'),
        option('same', 'No cambia.'),
      ],
      correct: 'quadruple',
      explanation:
        'g = GM/r². Si r se reduce a la mitad, el denominador cae a la cuarta parte y g se multiplica por cuatro.',
    },
  },
  {
    id: 'spacecraft',
    number: 2,
    title: 'Cómo funciona una nave espacial',
    level: 'both',
    summary:
      'Una nave es un conjunto de subsistemas que comparten masa, energía y volumen: estructura, potencia, control térmico, propulsión, guiado, comunicaciones y carga útil.',
    concepts: ['subsistemas', 'masa', 'potencia', 'carga útil'],
    illustration: 'spacecraft',
    data: [
      { label: 'Velocidad de la luz', value: 299792.458, unit: 'km/s', sourceId: 'nasa-factsheet-earth' },
    ],
    activity: {
      prompt:
        'Tu nave viaja más allá de Marte y necesita energía durante años. ¿Qué combinación es más razonable?',
      options: [
        option('solar', 'Paneles solares grandes y baterías pequeñas.', false, 'A esa distancia la irradiancia solar cae mucho.'),
        option('rtg', 'Generador radioisotópico con respaldo de baterías.', true, 'Correcto: un RTG funciona lejos del Sol y las baterías cubren picos.'),
        option('fuel', 'Sólo combustible químico para generar electricidad.', false, 'Es pesado e ineficiente para energía continua.'),
      ],
      explanation:
        'La energía solar decae con el cuadrado de la distancia. Un RTG es la solución clásica para misiones exteriores, con baterías para cargas puntuales.',
    },
    question: {
      prompt: '¿Qué subsistema protege la electrónica de las temperaturas extremas?',
      options: [
        option('thermal', 'El control térmico.'),
        option('comms', 'Las comunicaciones.'),
        option('structure', 'La estructura primaria.'),
      ],
      correct: 'thermal',
      explanation:
        'El control térmico gestiona radiación, aislamiento, calentadores y radiadores para mantener los rangos operativos.',
    },
    advancedQuestion: {
      prompt: '¿Por qué la masa es una restricción transversal en el diseño?',
      options: [
        option('launch', 'Porque afecta al lanzador, al presupuesto de energía y a la propulsión.'),
        option('aesthetic', 'Porque sólo cambia el aspecto exterior.'),
        option('software', 'Porque sólo afecta al software de a bordo.'),
      ],
      correct: 'launch',
      explanation:
        'Cada kilogramo cuenta para el lanzador y arrastra más combustible, estructura y coste. La masa conecta todos los segmentos.',
    },
  },
  {
    id: 'instruments',
    number: 3,
    title: 'Instrumentos científicos',
    level: 'both',
    summary:
      'Un instrumento convierte una magnitud física en una señal medible. Elegirlo exige preguntar qué dato necesitas, con qué resolución y en qué rango espectral.',
    concepts: ['espectro', 'resolución', 'muestreo', 'calibración'],
    illustration: 'instruments',
    data: [
      { label: 'Composición de CO₂ en Marte', value: 95.3, unit: '%', sourceId: 'nasa-factsheet-mars' },
    ],
    activity: {
      prompt: 'Quieres identificar minerales por sus firmas de absorción. ¿Qué instrumento eliges?',
      options: [
        option('camera', 'Cámara pancromática de alta resolución.', false, 'Da forma, no composición espectral.'),
        option('spectrometer', 'Espectrómetro de reflectancia.', true, 'Correcto: mide bandas de absorción asociadas a minerales.'),
        option('thermometer', 'Termómetro de contacto.', false, 'Mide temperatura, no composición.'),
      ],
      explanation:
        'La espectroscopía de reflectancia detecta transiciones electrónicas y vibracionales que identifican minerales.',
    },
    question: {
      prompt: '¿Qué significa calibrar un instrumento?',
      options: [
        option('cal', 'Relacionar su señal con un patrón conocido para que la medida sea trazable.'),
        option('clean', 'Limpiar la lente una vez.'),
        option('paint', 'Pintarlo para protegerlo del Sol.'),
      ],
      correct: 'cal',
      explanation:
        'La calibración compara la respuesta del instrumento con referencias conocidas; sin ella, el dato no es interpretable.',
    },
    advancedQuestion: {
      prompt: 'Un instrumento tiene mucha resolución espacial pero poco ancho de banda de downlink. ¿Qué compromiso aparece?',
      options: [
        option('trade', 'Reducir compresión, cobertura o frecuencia de captura para caber en el enlace.'),
        option('none', 'No hay compromiso: la resolución no afecta a los datos.'),
        option('more', 'Aumentar la masa resuelve el enlace automáticamente.'),
      ],
      correct: 'trade',
      explanation:
        'Más píxeles implican más datos. El diseño debe equilibrar resolución, cobertura, compresión y capacidad del segmento de tierra.',
    },
  },
  {
    id: 'gravity-orbits',
    number: 4,
    title: 'Gravedad y órbitas',
    level: 'both',
    summary:
      'Una órbita es una caída libre continua alrededor de un cuerpo. La altura, la inclinación y la excentricidad determinan qué se observa y cuánto se tarda.',
    concepts: ['órbita baja', 'órbita polar', 'excentricidad', 'periodo'],
    illustration: 'orbits',
    data: [
      { label: 'Gravedad terrestre', value: 9.81, unit: 'm/s²', sourceId: 'nasa-factsheet-earth' },
      { label: 'Radio terrestre', value: 6378.1, unit: 'km', sourceId: 'nasa-factsheet-earth' },
    ],
    activity: {
      prompt: 'Necesitas cartografiar toda la superficie terrestre con pasadas repetidas. ¿Qué órbita eliges?',
      options: [
        option('geo', 'Geoestacionaria, siempre sobre el mismo punto.', false, 'Cubre siempre la misma región.'),
        option('polar', 'Órbita polar baja de cobertura global.', true, 'Correcto: la rotación terrestre barre distintas franjas.'),
        option('escape', 'Trayectoria de escape del sistema Tierra-Luna.', false, 'No ofrece observación repetida de la superficie.'),
      ],
      explanation:
        'Una órbita polar baja permite que el satélite pase sobre latitudes distintas mientras la Tierra gira bajo él.',
    },
    question: {
      prompt: '¿Qué describe la excentricidad de una órbita?',
      options: [
        option('shape', 'Cuánto se aleja de una circunferencia.'),
        option('tilt', 'La inclinación respecto al ecuador.'),
        option('speed', 'La velocidad de la luz en el vacío.'),
      ],
      correct: 'shape',
      explanation:
        'La excentricidad mide la forma: 0 es circular y valores altos indican elipses más alargadas.',
    },
    advancedQuestion: {
      prompt: 'Para observar los polos, ¿qué parámetro orbital es más importante?',
      options: [
        option('inclination', 'Una inclinación cercana a 90°.'),
        option('eccentricity', 'Una excentricidad cercana a 0.'),
        option('period', 'Un periodo de exactamente 24 horas.'),
      ],
      correct: 'inclination',
      explanation:
        'La inclinación define el plano orbital respecto al ecuador; cerca de 90° la órbita pasa sobre los polos.',
    },
  },
  {
    id: 'power-comms',
    number: 5,
    title: 'Energía y comunicaciones',
    level: 'both',
    summary:
      'La energía disponible limita los instrumentos y el enlace. La comunicación impone ventanas, antenas y retardos que cambian la operación de la misión.',
    concepts: ['potencia', 'enlace', 'latencia', 'ventana de comunicación'],
    illustration: 'power',
    data: [
      { label: 'Velocidad de la luz', value: 299792.458, unit: 'km/s', sourceId: 'nasa-factsheet-earth' },
      { label: 'Distancia Tierra-Luna', value: 384400, unit: 'km', sourceId: 'nasa-factsheet-moon' },
    ],
    activity: {
      prompt: '¿Cuánto tarda como mínimo una señal de ida y vuelta Tierra-Luna?',
      options: [
        option('instant', 'Es instantánea.'),
        option('seconds', 'Alrededor de 2,6 segundos.'),
        option('minutes', 'Alrededor de 20 minutos.'),
      ],
      correct: 'seconds',
      explanation:
        '384.400 km × 2 / 299.792,458 km/s ≈ 2,56 s. Marte, según la posición, puede tardar entre unos 6 y 44 minutos de ida y vuelta.',
    },
    question: {
      prompt: '¿Por qué una misión no transmite datos continuamente?',
      options: [
        option('windows', 'Porque la antena, la órbita y la energía imponen ventanas y prioridades.'),
        option('impossible', 'Porque las ondas de radio no existen en el espacio.'),
        option('storage', 'Porque los ordenadores no pueden guardar datos.'),
      ],
      correct: 'windows',
      explanation:
        'El enlace depende de la geometría, la potencia y la disponibilidad de estaciones. Los datos se almacenan y se transmiten por prioridad.',
    },
    advancedQuestion: {
      prompt: 'Si duplicas la distancia a la antena, ¿qué ocurre aproximadamente con la potencia recibida?',
      options: [
        option('half', 'Se reduce a la mitad.'),
        option('quarter', 'Se reduce a la cuarta parte.'),
        option('double', 'Se duplica.'),
      ],
      correct: 'quarter',
      explanation:
        'La propagación en espacio libre reduce la densidad de potencia con 1/r²; al duplicar r, la potencia recibida cae a 1/4.',
    },
  },
  {
    id: 'mission-design',
    number: 6,
    title: 'Diseño de misiones',
    level: 'both',
    summary:
      'Diseñar no es elegir primero un cohete: es identificar una necesidad, definir un concepto, fijar requisitos, diseñar, verificar e implementar.',
    concepts: ['necesidad', 'requisito', 'concepto', 'verificación'],
    illustration: 'design-flow',
    data: [],
    activity: {
      prompt: '¿Cuál es el primer paso del proceso de diseño de una misión científica?',
      options: [
        option('rocket', 'Elegir el vehículo de lanzamiento.'),
        option('need', 'Identificar la necesidad y los objetivos científicos.'),
        option('logo', 'Diseñar el logotipo de la misión.'),
      ],
      correct: 'need',
      explanation:
        'Sin una pregunta científica y unos objetivos medibles no se pueden derivar requisitos ni comparar arquitecturas.',
    },
    question: {
      prompt: '¿Qué es un requisito verificable?',
      options: [
        option('vague', '“La nave debe ser moderna”.'),
        option('measurable', '“La masa seca no superará 1.200 kg”.'),
        option('wish', '“Queremos hacer algo interesante”.'),
      ],
      correct: 'measurable',
      explanation:
        'Un requisito verificable tiene magnitud, condición y criterio de aceptación; así puede comprobarse en la fase de verificación.',
    },
    advancedQuestion: {
      prompt: 'Los cuatro segmentos de una misión (launch, space, ground, user) son…',
      options: [
        option('phases', 'Cuatro pasos cronológicos obligatorios.'),
        option('parts', 'Partes interrelacionadas que deben diseñarse en conjunto.'),
        option('rockets', 'Cuatro tipos de cohete.'),
      ],
      correct: 'parts',
      explanation:
        'No son una secuencia rígida: son segmentos de la arquitectura que comparten requisitos, interfaces y presupuesto.',
    },
  },
  {
    id: 'launch-vehicles',
    number: 7,
    title: 'Vehículos de lanzamiento',
    level: 'both',
    summary:
      'El lanzador define el volumen, la masa y el entorno que soportará la nave. Elegirlo tarde obliga a rediseñar la misión.',
    concepts: ['empuje', 'etapas', 'carga útil', 'entorno de lanzamiento'],
    illustration: 'launch',
    data: [],
    activity: {
      prompt:
        'Tu nave pesa 1.100 kg y necesita una órbita baja. ¿Qué lanzador del simulador es el más razonable?',
      options: [
        option('light', 'Vector-S, clase ligera (hasta 1.500 kg).', true, 'Correcto: cubre la masa con margen sin pagar un lanzador pesado.'),
        option('heavy', 'Atlas-Pesado, clase pesada (hasta 8.000 kg).', false, 'Sobredimensionado: más coste y más combustible.'),
        option('none', 'Ninguno; la nave puede despegar sola.', false, 'La nave no incluye un lanzador orbital completo.'),
      ],
      explanation:
        'El lanzador se elige por masa, volumen y destino. Un vehículo sobredimensionado encarece la misión sin mejorar la ciencia.',
    },
    question: {
      prompt: '¿Qué significa que un lanzador tenga etapas?',
      options: [
        option('stages', 'Partes que se separan al agotar su combustible para reducir masa.'),
        option('phases', 'Fases del proyecto administrativo.'),
        option('engines', 'Motores que nunca se encienden.'),
      ],
      correct: 'stages',
      explanation:
        'Al separar masa inútil, las etapas siguientes aceleran menos masa y pueden alcanzar la órbita con más eficiencia.',
    },
    advancedQuestion: {
      prompt: '¿Por qué la latitud del sitio de lanzamiento importa?',
      options: [
        option('rotation', 'Porque la rotación terrestre aporta velocidad y condiciona la inclinación.'),
        option('weather', 'Porque sólo cambia el clima.'),
        option('gravity', 'Porque la gravedad desaparece en el ecuador.'),
      ],
      correct: 'rotation',
      explanation:
        'Lanzar cerca del ecuador aprovecha mejor la velocidad de rotación terrestre y facilita ciertas inclinaciones orbitales.',
    },
  },
  {
    id: 'operations',
    number: 8,
    title: 'Operaciones espaciales',
    level: 'both',
    summary:
      'Una misión operativa es un ciclo de planificación, ejecución, telemetría y respuesta. Los procedimientos y la prioridad de fallos importan tanto como el diseño.',
    concepts: ['telemetría', 'procedimiento', 'anomalía', 'prioridad'],
    illustration: 'operations',
    data: [],
    activity: {
      prompt:
        'Durante una EVA se detecta una caída de presión. ¿Cuál es la primera acción?',
      options: [
        option('ignore', 'Continuar la tarea y revisarlo al final.', false, 'La presión es crítica; ignorarla puede comprometer la misión.'),
        option('safe', 'Interrumpir la tarea, asegurar el traje y volver a la esclusa.', true, 'Correcto: primero se protege la vida y se estabiliza el sistema.'),
        option('photo', 'Hacer una foto para el informe.', false, 'No es una prioridad de seguridad.'),
      ],
      explanation:
        'Los procedimientos de emergencia priorizan seguridad, estabilización y comunicación antes que la ciencia.',
    },
    question: {
      prompt: '¿Qué es la telemetría?',
      options: [
        option('telemetry', 'Datos medidos a bordo y enviados a tierra sobre el estado del vehículo.'),
        option('movie', 'Una película de la misión.'),
        option('fuel', 'El combustible sólido del lanzador.'),
      ],
      correct: 'telemetry',
      explanation:
        'La telemetría permite reconstruir el estado del sistema y detectar anomalías en tiempo casi real.',
    },
    advancedQuestion: {
      prompt: 'Si dos fallos compiten por atención, ¿qué criterio debe guiar la respuesta?',
      options: [
        option('risk', 'El riesgo para la tripulación, la nave y la misión.'),
        option('order', 'El orden alfabético de los códigos.'),
        option('loud', 'El fallo que suene más fuerte.'),
      ],
      correct: 'risk',
      explanation:
        'La priorización se basa en criticidad y probabilidad; no en la visibilidad del síntoma.',
    },
  },
  {
    id: 'ground-control',
    number: 9,
    title: 'Centro de control terrestre',
    level: 'both',
    summary:
      'El segmento de tierra planifica, comanda, recibe y distribuye los datos. Sin él, la nave no tiene contexto ni decisiones informadas.',
    concepts: ['estación', 'comando', 'recepción', 'distribución'],
    illustration: 'ground',
    data: [
      { label: 'Velocidad de la luz', value: 299792.458, unit: 'km/s', sourceId: 'nasa-factsheet-earth' },
    ],
    activity: {
      prompt: 'Se pierde la señal de una nave en Marte. ¿Qué secuencia es más sensata?',
      options: [
        option('panic', 'Declarar la misión perdida inmediatamente.', false, 'Hay que comprobar la geometría, la antena y la telemetría.'),
        option('check', 'Revisar la ventana de enlace, apuntar antenas y esperar telemetría.', true, 'Correcto: la pérdida puede ser geométrica o de apuntamiento.'),
        option('restart', 'Reiniciar el ordenador de la nave sin diagnóstico.', false, 'Sin diagnóstico se pueden perder datos y agravar el fallo.'),
      ],
      explanation:
        'El control de misión comprueba enlaces, ventanas y telemetría antes de enviar comandos irreversibles.',
    },
    question: {
      prompt: '¿Qué hace una estación de tierra con los datos recibidos?',
      options: [
        option('process', 'Los calibra, archiva y distribuye a los equipos científicos.'),
        option('delete', 'Los borra para ahorrar espacio.'),
        option('sell', 'Los vende sin procesar.'),
      ],
      correct: 'process',
      explanation:
        'El segmento de tierra convierte señales en productos de datos trazables para el segmento de usuario.',
    },
    advancedQuestion: {
      prompt: '¿Por qué se planifican varias estaciones en red?',
      options: [
        option('coverage', 'Para aumentar cobertura, redundancia y continuidad del enlace.'),
        option('decor', 'Para decorar el centro de control.'),
        option('speed', 'Para hacer la luz más rápida.'),
      ],
      correct: 'coverage',
      explanation:
        'Una red de estaciones reduce huecos de cobertura y ofrece respaldo ante fallos locales.',
    },
  },
  {
    id: 'data-analysis',
    number: 10,
    title: 'Análisis científico de datos',
    level: 'both',
    summary:
      'Un dato no es una conclusión. El análisis exige calibrar, estimar incertidumbre, comparar con modelos y distinguir correlación de causalidad.',
    concepts: ['incertidumbre', 'calibración', 'modelo', 'conclusión'],
    illustration: 'data',
    data: [
      { label: 'CO₂ en Marte', value: 95.3, unit: '%', sourceId: 'nasa-factsheet-mars' },
    ],
    activity: {
      prompt:
        'Un espectrómetro detecta una banda débil en una zona. ¿Qué conclusión es defendible?',
      options: [
        option('certain', 'Hay vida extraterrestre confirmada.', false, 'Una banda débil no confirma vida.'),
        option('hypothesis', 'Existe una señal compatible con cierto mineral; hay que repetir y calibrar.', true, 'Correcto: se plantea una hipótesis y se busca evidencia adicional.'),
        option('ignore', 'La señal no importa porque es débil.', false, 'Las señales débiles pueden ser relevantes si son significativas.'),
      ],
      explanation:
        'La interpretación requiere repetibilidad, calibración y comparación con bibliotecas de referencia.',
    },
    question: {
      prompt: '¿Qué añade la incertidumbre a una medida?',
      options: [
        option('range', 'Un rango dentro del cual es razonable el valor.'),
        option('noise', 'Ruido que siempre se elimina.'),
        option('color', 'Un color para la gráfica.'),
      ],
      correct: 'range',
      explanation:
        'La incertidumbre cuantifica la confianza en la medida; sin ella no se puede comparar con un modelo.',
    },
    advancedQuestion: {
      prompt: 'Dos variables suben juntas en todos los datos. ¿Qué puedes concluir?',
      options: [
        option('corr', 'Que están correlacionadas; la causalidad requiere más evidencia.'),
        option('cause', 'Que una causa necesariamente la otra.'),
        option('nothing', 'Que no hay relación de ningún tipo.'),
      ],
      correct: 'corr',
      explanation:
        'La correlación describe asociación. Para inferir causalidad hacen falta mecanismos, controles y experimentos.',
    },
  },
];

export const LESSON_BY_ID = new Map(ACADEMY_LESSONS.map((lesson) => [lesson.id, lesson]));

const STORAGE_KEY = 'spacetech.academy.v1';

const emptyProgress = () => ({
  mode: 'beginner',
  completed: {},
  attempts: 0,
});

function readProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyProgress();
    return {
      mode: parsed.mode === 'advanced' ? 'advanced' : 'beginner',
      completed: parsed.completed && typeof parsed.completed === 'object' ? parsed.completed : {},
      attempts: Number(parsed.attempts) || 0,
    };
  } catch {
    return emptyProgress();
  }
}

export class Academy {
  constructor() {
    this.state = readProgress();
    this.onChange = null;
  }

  get mode() {
    return this.state.mode;
  }

  setMode(mode) {
    if (!ACADEMY_MODES[mode] || mode === this.state.mode) return;
    this.state.mode = mode;
    this.save();
    this.onChange?.();
  }

  isComplete(lessonId, mode = this.state.mode) {
    return !!this.state.completed?.[lessonId]?.[mode];
  }

  complete(lessonId, mode = this.state.mode) {
    if (!LESSON_BY_ID.has(lessonId)) return false;
    if (!this.state.completed[lessonId]) this.state.completed[lessonId] = {};
    this.state.completed[lessonId][mode] = true;
    this.state.attempts += 1;
    this.save();
    this.onChange?.();
    return true;
  }

  count(mode = this.state.mode) {
    return ACADEMY_LESSONS.filter((lesson) => this.isComplete(lesson.id, mode)).length;
  }

  total() {
    return ACADEMY_LESSONS.length;
  }

  reset() {
    this.state = emptyProgress();
    this.save();
    this.onChange?.();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      return true;
    } catch {
      return false;
    }
  }

  serialize() {
    return {
      mode: this.state.mode,
      completed: JSON.parse(JSON.stringify(this.state.completed)),
      attempts: this.state.attempts,
    };
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    this.state = {
      mode: snapshot.mode === 'advanced' ? 'advanced' : 'beginner',
      completed: snapshot.completed && typeof snapshot.completed === 'object' ? snapshot.completed : {},
      attempts: Number(snapshot.attempts) || 0,
    };
    this.save();
    return true;
  }
}

/** Pregunta que corresponde al modo activo. */
export function questionFor(lesson, mode) {
  return mode === 'advanced' && lesson.advancedQuestion
    ? lesson.advancedQuestion
    : lesson.question;
}

/**
 * Visualizaciones vectoriales propias (sin recursos externos). Cada lección
 * tiene una figura distinta para que el concepto no sea sólo texto.
 */
export function illustrationSvg(kind) {
  const stroke = 'rgba(95,240,255,0.75)';
  const muted = 'rgba(127,155,179,0.55)';
  const amber = 'rgba(255,180,95,0.8)';
  const green = 'rgba(109,255,168,0.8)';

  switch (kind) {
    case 'solar-system':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Esquema del sistema solar interior">
        <circle cx="40" cy="90" r="14" fill="${amber}"/>
        <ellipse cx="40" cy="90" rx="62" ry="40" fill="none" stroke="${muted}" stroke-dasharray="3 4"/>
        <circle cx="102" cy="90" r="4" fill="${stroke}"/>
        <ellipse cx="40" cy="90" rx="118" ry="66" fill="none" stroke="${muted}" stroke-dasharray="3 4"/>
        <circle cx="158" cy="90" r="6" fill="#6fb6ff"/>
        <ellipse cx="40" cy="90" rx="178" ry="82" fill="none" stroke="${muted}" stroke-dasharray="3 4"/>
        <circle cx="218" cy="90" r="5" fill="#c77a55"/>
        <circle cx="276" cy="90" r="3" fill="${muted}"/>
        <text x="150" y="168" fill="${muted}" font-size="8">Tierra</text>
        <text x="206" y="168" fill="${muted}" font-size="8">Marte</text>
      </svg>`;
    case 'spacecraft':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Subsistemas de una nave">
        <rect x="120" y="54" width="80" height="72" rx="6" fill="none" stroke="${stroke}"/>
        <rect x="132" y="66" width="24" height="18" fill="${muted}"/>
        <rect x="164" y="66" width="24" height="18" fill="${muted}"/>
        <path d="M96 70 L120 62 L120 118 L96 110 Z" fill="none" stroke="${amber}"/>
        <path d="M224 70 L200 62 L200 118 L224 110 Z" fill="none" stroke="${amber}"/>
        <path d="M140 126 L160 150 L180 126" fill="none" stroke="${green}"/>
        <text x="128" y="44" fill="${muted}" font-size="8">BUS</text>
        <text x="70" y="98" fill="${muted}" font-size="8">SOLAR</text>
        <text x="214" y="98" fill="${muted}" font-size="8">RADIADOR</text>
        <text x="142" y="166" fill="${muted}" font-size="8">ANTENA</text>
      </svg>`;
    case 'instruments':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Espectro de absorción">
        <path d="M24 140 L296 140" stroke="${muted}"/>
        <path d="M24 30 L24 140" stroke="${muted}"/>
        <path d="M28 60 L60 62 L78 58 L96 96 L110 60 L150 62 L166 110 L180 58 L230 60 L246 88 L262 58 L296 60" fill="none" stroke="${stroke}" stroke-width="2"/>
        <path d="M96 140 L96 96 M166 140 L166 110 M246 140 L246 88" stroke="${amber}" stroke-dasharray="3 3"/>
        <text x="86" y="158" fill="${muted}" font-size="8">banda A</text>
        <text x="152" y="158" fill="${muted}" font-size="8">banda B</text>
        <text x="232" y="158" fill="${muted}" font-size="8">banda C</text>
      </svg>`;
    case 'orbits':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Órbitas polares y geoestacionaria">
        <circle cx="160" cy="90" r="40" fill="none" stroke="${muted}"/>
        <ellipse cx="160" cy="90" rx="120" ry="48" fill="none" stroke="${stroke}"/>
        <ellipse cx="160" cy="90" rx="54" ry="84" fill="none" stroke="${amber}" stroke-dasharray="4 4"/>
        <circle cx="160" cy="90" r="14" fill="#2f6f9e"/>
        <circle cx="280" cy="90" r="4" fill="${stroke}"/>
        <circle cx="160" cy="6" r="3" fill="${amber}"/>
        <text x="196" y="40" fill="${muted}" font-size="8">polar</text>
        <text x="236" y="132" fill="${muted}" font-size="8">geo</text>
      </svg>`;
    case 'power':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Potencia y enlace de comunicaciones">
        <rect x="36" y="60" width="62" height="46" rx="4" fill="none" stroke="${amber}"/>
        <text x="44" y="88" fill="${muted}" font-size="8">ENERGÍA</text>
        <path d="M98 83 L140 83" stroke="${stroke}" stroke-width="2"/>
        <rect x="140" y="60" width="62" height="46" rx="4" fill="none" stroke="${stroke}"/>
        <text x="150" y="88" fill="${muted}" font-size="8">CARGA</text>
        <path d="M202 83 L242 83" stroke="${stroke}" stroke-width="2"/>
        <path d="M242 68 Q264 83 242 98" fill="none" stroke="${green}"/>
        <path d="M254 56 Q288 83 254 110" fill="none" stroke="${green}"/>
        <circle cx="286" cy="83" r="4" fill="${green}"/>
        <text x="228" y="132" fill="${muted}" font-size="8">ENLACE</text>
      </svg>`;
    case 'design-flow':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Fases del diseño de misión">
        ${['Necesidad', 'Concepto', 'Requisitos', 'Diseño', 'Verificar', 'Implementar']
          .map((label, index) => {
            const x = 18 + index * 50;
            const y = index % 2 === 0 ? 54 : 92;
            return `<rect x="${x}" y="${y}" width="42" height="28" rx="4" fill="none" stroke="${index < 3 ? stroke : amber}"/>
              <text x="${x + 4}" y="${y + 18}" fill="${muted}" font-size="6">${label}</text>`;
          })
          .join('')}
        <path d="M60 68 L68 68 M110 68 L118 68 M160 106 L168 106 M210 106 L218 106 M260 68 L268 68" stroke="${muted}"/>
      </svg>`;
    case 'launch':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Etapas de un vehículo de lanzamiento">
        <path d="M160 22 Q176 44 176 76 L176 118 L144 118 L144 76 Q144 44 160 22 Z" fill="none" stroke="${stroke}" stroke-width="2"/>
        <path d="M144 90 L120 118 L144 112 Z" fill="none" stroke="${amber}"/>
        <path d="M176 90 L200 118 L176 112 Z" fill="none" stroke="${amber}"/>
        <path d="M150 118 L170 118 L166 140 L154 140 Z" fill="none" stroke="${green}"/>
        <path d="M158 142 L162 142 L160 160 Z" fill="${amber}"/>
        <text x="186" y="60" fill="${muted}" font-size="8">etapa 1</text>
        <text x="186" y="106" fill="${muted}" font-size="8">etapa 2</text>
      </svg>`;
    case 'operations':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Ciclo de operaciones y telemetría">
        <circle cx="160" cy="90" r="52" fill="none" stroke="${muted}" stroke-dasharray="4 4"/>
        ${['PLAN', 'EJECUTAR', 'TELEMETRÍA', 'RESPONDER']
          .map((label, index) => {
            const angle = -Math.PI / 2 + (index * Math.PI) / 2;
            const x = 160 + Math.cos(angle) * 52;
            const y = 90 + Math.sin(angle) * 52;
            return `<circle cx="${x}" cy="${y}" r="5" fill="${index === 0 ? green : stroke}"/>
              <text x="${x - 18}" y="${y + 18}" fill="${muted}" font-size="7">${label}</text>`;
          })
          .join('')}
        <text x="130" y="94" fill="${stroke}" font-size="8">MISIÓN</text>
      </svg>`;
    case 'ground':
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Segmento de tierra y estaciones">
        <path d="M40 140 L280 140" stroke="${muted}"/>
        <path d="M90 140 L90 92 M90 92 Q72 92 72 76" fill="none" stroke="${stroke}" stroke-width="2"/>
        <circle cx="72" cy="72" r="9" fill="none" stroke="${stroke}"/>
        <path d="M210 140 L210 96 M210 96 Q232 96 232 78" fill="none" stroke="${amber}" stroke-width="2"/>
        <circle cx="232" cy="74" r="9" fill="none" stroke="${amber}"/>
        <circle cx="160" cy="34" r="10" fill="none" stroke="${green}"/>
        <path d="M160 44 L160 68 M144 54 L176 54" stroke="${green}"/>
        <path d="M152 68 Q120 92 82 80" fill="none" stroke="${muted}" stroke-dasharray="3 3"/>
        <path d="M168 68 Q200 92 224 82" fill="none" stroke="${muted}" stroke-dasharray="3 3"/>
        <text x="56" y="160" fill="${muted}" font-size="8">estación 1</text>
        <text x="198" y="160" fill="${muted}" font-size="8">estación 2</text>
      </svg>`;
    case 'data':
    default:
      return `<svg viewBox="0 0 320 180" role="img" aria-label="Gráfica de datos con incertidumbre">
        <path d="M28 142 L296 142 M28 142 L28 26" stroke="${muted}"/>
        ${[0, 1, 2, 3, 4, 5, 6]
          .map((index) => {
            const x = 50 + index * 34;
            const height = [28, 42, 56, 74, 62, 88, 96][index];
            return `<rect x="${x}" y="${142 - height}" width="14" height="${height}" fill="rgba(95,240,255,0.18)" stroke="${stroke}"/>
              <path d="M${x + 7} ${132 - height} L${x + 7} ${142 - height - 8}" stroke="${amber}"/>`;
          })
          .join('')}
        <path d="M50 112 L84 98 L118 84 L152 66 L186 78 L220 52 L254 44" fill="none" stroke="${green}" stroke-dasharray="4 3"/>
        <text x="228" y="160" fill="${muted}" font-size="8">señal + incertidumbre</text>
      </svg>`;
  }
}
