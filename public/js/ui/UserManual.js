/**
 * Manual interactivo de usuario.
 *
 * Las teclas y botones documentados aquí salen del sistema real
 * (Controls.js, Game.js y las consolas). No se inventan atajos. Cuando una
 * función no tiene tecla asignada se indica explícitamente.
 */

export const CONTROLS = [
  {
    action: 'Caminar / propulsores RCS',
    keys: ['W', 'A', 'S', 'D'],
    alt: ['↑', '←', '↓', '→'],
    scope: 'Interior, superficie y EVA',
    note: 'En gravedad cero mueve al astronauta con los propulsores.',
  },
  {
    action: 'Mirar / orbitar cámara',
    keys: ['Ratón'],
    alt: ['Stick derecho'],
    scope: 'Siempre',
    note: 'Con Pointer Lock activo. La rueda acerca o aleja la cámara.',
  },
  {
    action: 'Subir / saltar',
    keys: ['Espacio'],
    alt: ['RT'],
    scope: 'EVA y superficie',
    note: 'En el interior se usa para saltar.',
  },
  {
    action: 'Bajar / agacharse',
    keys: ['Ctrl', 'C'],
    alt: ['LT'],
    scope: 'EVA y superficie',
    note: 'Ctrl izquierdo o derecho; C es la alternativa.',
  },
  {
    action: 'Empuje máximo',
    keys: ['Shift'],
    alt: ['L3'],
    scope: 'EVA',
    note: 'Consume más RCS.',
  },
  {
    action: 'Interactuar',
    keys: ['E'],
    alt: ['X'],
    scope: 'Puertas, consolas, esclusa, nave y rover',
    note: 'También acepta misiones desde las consolas.',
  },
  {
    action: 'Reparar / escanear',
    keys: ['Clic izquierdo'],
    alt: ['A'],
    scope: 'Exterior',
    note: 'Mantener pulsado para reparar; el escáner se activa con un clic.',
  },
  {
    action: 'Herramienta 1 · 2 · 3',
    keys: ['1', '2', '3'],
    alt: [],
    scope: 'Exterior',
    note: 'Soldador, llave y escáner.',
  },
  {
    action: 'Pausa / cerrar panel',
    keys: ['Esc'],
    alt: [],
    scope: 'Siempre',
    note: 'Libera el cursor y abre el menú de pausa.',
  },
  {
    action: 'Información de la zona',
    keys: ['H'],
    alt: [],
    scope: 'Durante la partida',
    note: 'Abre el manual en la sección contextual de la sala o planeta.',
  },
  {
    action: 'Colliders de depuración',
    keys: ['F3'],
    alt: [],
    scope: 'Durante la partida',
    note: 'Muestra u oculta las cajas de colisión del interior.',
  },
];

export const UNASSIGNED = [
  'Guardar partida: no hay tecla rápida; se guarda desde la pausa o con el autoguardado.',
  'Consultar objetivos: no hay tecla dedicada; se usa Pausa → Objetivos.',
  'Linterna o visión nocturna: no existe en esta versión.',
  'Cambiar de calidad gráfica: no existe selector; el perfil es único.',
];

export const MANUAL_SECTIONS = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    html: `
      <h3>Cómo iniciar una partida</h3>
      <ol>
        <li>Pulsa <strong>ENTRAR</strong> en la pantalla de bienvenida.</li>
        <li>Elige <strong>NUEVA PARTIDA</strong> para empezar la experiencia guiada sin misión automática, o <strong>CONTINUAR PARTIDA</strong> si ya hay progreso guardado.</li>
        <li>La partida comienza dentro de la estación, junto al hangar. El HUD muestra oxígeno, RCS, casco, cable y traje.</li>
      </ol>
      <h3>Cómo recorrer la estación</h3>
      <p>Usa <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para caminar y el ratón para mirar. Las puertas se abren solas al acercarte o con <kbd>E</kbd> cuando el prompt lo indique.</p>
      <h3>Cómo iniciar una misión</h3>
      <p>Acércate a una consola (puente, navegación, laboratorio, hangar…) y pulsa <kbd>E</kbd>. En el panel busca <strong>Aceptar misión</strong>. No se activa ninguna misión automáticamente al empezar.</p>
      <h3>Cómo consultar los objetivos</h3>
      <p>El objetivo activo aparece arriba en el HUD. Para ver el detalle, pulsa <kbd>Esc</kbd> y abre <strong>OBJETIVOS</strong>.</p>
    `,
  },
  {
    id: 'movimiento',
    title: 'Movimiento',
    html: `
      <h3>Caminar</h3>
      <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o las flechas. En el interior hay gravedad artificial; en la superficie lunar o marciana el salto cambia según la gravedad.</p>
      <h3>Girar y mover la cámara</h3>
      <p>Mueve el ratón con el cursor capturado. La rueda ajusta la distancia de la cámara entre 3,2 y 12 m. <kbd>Esc</kbd> libera el cursor.</p>
      <h3>Movimiento exterior y propulsores</h3>
      <p>En EVA, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> encienden los propulsores RCS; <kbd>Espacio</kbd> sube, <kbd>Ctrl</kbd> o <kbd>C</kbd> baja y <kbd>Shift</kbd> da empuje máximo. El RCS se agota y se recarga en el puerto de oxígeno o al volver a la estación.</p>
      <h3>Mando</h3>
      <p>Stick izquierdo para moverte, stick derecho para mirar, RT/LT para subir/bajar, <strong>A</strong> para reparar, <strong>X</strong> para interactuar y <strong>L3</strong> para empuje máximo.</p>
    `,
  },
  {
    id: 'interacciones',
    title: 'Interacciones',
    html: `
      <h3>Abrir puertas</h3>
      <p>Las compuertas automáticas se abren al detectar al jugador. Si una puerta requiere confirmación, el prompt muestra <kbd>E</kbd>. El estado de la puerta y su colisión son el mismo dato: sólo bloquea cuando está cerrada.</p>
      <h3>Utilizar consolas y paneles</h3>
      <p>Acércate hasta que aparezca el nombre de la consola y pulsa <kbd>E</kbd>. Cada botón ejecuta una acción real: muestra estado anterior, acción, estado posterior, recursos consumidos y resultado.</p>
      <h3>Recoger objetos y usar herramientas</h3>
      <p>Los kits, filtros y muestras se recogen desde las consolas de almacén y laboratorio. En el exterior, <kbd>1</kbd> soldador, <kbd>2</kbd> llave y <kbd>3</kbd> escáner. Mantén el clic izquierdo para reparar con la herramienta correcta.</p>
      <h3>Reparar componentes</h3>
      <p>El escáner revela fugas y válvulas. El soldador sella fisuras; la llave ajusta válvulas y antenas. Una herramienta incorrecta no progresa y el HUD lo indica.</p>
    `,
  },
  {
    id: 'eva',
    title: 'Exploración EVA',
    html: `
      <h3>Equipar traje</h3>
      <p>La partida empieza con el traje equipado. Puedes guardarlo o repararlo desde el armario EVA y la consola de ingeniería. Sin traje no se puede salir: el juego muestra <strong>NO PUEDES SALIR SIN TRAJE ESPACIAL.</strong></p>
      <h3>Oxígeno, integridad y cable</h3>
      <p>El HUD muestra O2, RCS, integridad del casco y estado del cable. El cable de seguridad se conecta automáticamente al salir por la esclusa y limita la distancia; si se tensa demasiado, avisa.</p>
      <h3>Salir y regresar</h3>
      <p>Pulsa <kbd>E</kbd> en la esclusa. El ciclo despresuriza, abre la compuerta exterior y te suelta al vacío. Para volver, repite <kbd>E</kbd> en la esclusa exterior: la compuerta se cierra, presuriza y recuperas O2.</p>
    `,
  },
  {
    id: 'vehiculos',
    title: 'Vehículos',
    html: `
      <h3>Nave de transporte</h3>
      <p>En el hangar, acércate a la escotilla y pulsa <kbd>E</kbd>. La cabina abre la consola de navegación con destinos, combustible, integridad, repostaje y reparación.</p>
      <h3>Seleccionar destinos y viajar</h3>
      <p>Desde la consola del hangar o la cabina elige Estación, Luna o Marte. El viaje consume combustible real del depósito; sin margen suficiente se bloquea y se indica cuánto falta.</p>
      <h3>Aterrizar y desembarcar</h3>
      <p>Al llegar, la nave queda en la plataforma. Pulsa <kbd>E</kbd> para bajar. En la superficie puedes usar el rover: <kbd>E</kbd> para entrar y <kbd>E</kbd> para salir; se conduce con <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>.</p>
    `,
  },
  {
    id: 'misiones',
    title: 'Misiones',
    html: `
      <h3>Aceptar y seguir una misión</h3>
      <p>Abre una consola y pulsa <strong>Aceptar misión</strong>. Sólo hay una misión activa; las completadas no vuelven a la lista y las abandonadas pueden reintentarse.</p>
      <h3>Progreso y resultados</h3>
      <p>El HUD superior muestra nombre y progreso. Al completar, aparece <strong>MISIÓN COMPLETADA</strong> con objetivos y recompensa. Después vuelves a exploración libre: no se reinicia la partida ni se repite la misión única.</p>
      <h3>Continuar después de terminar</h3>
      <p>Puedes seguir recorriendo la estación, aceptar otra misión o viajar. El autoguardado se ejecuta cada 25 s y al pausar.</p>
    `,
  },
  {
    id: 'diseno',
    title: 'Diseño de misiones',
    html: `
      <h3>Flujo de seis fases</h3>
      <ol>
        <li>Identificar la necesidad y el objetivo científico.</li>
        <li>Definir el concepto y la modalidad de diseño.</li>
        <li>Establecer requisitos de masa, potencia, coste, datos y enlace.</li>
        <li>Diseñar: lanzador, instrumentos, trayectoria y estación de tierra.</li>
        <li>Construir y verificar contra los requisitos.</li>
        <li>Implementar la misión en el simulador.</li>
      </ol>
      <h3>Segmentos, no pasos</h3>
      <p>Launch, Space, Ground y User son partes interrelacionadas. Cambiar la estación de tierra afecta al enlace; cambiar el lanzador afecta a la masa y al coste.</p>
      <h3>Mesa de diseño</h3>
      <p>En <strong>Diseñar una misión</strong> compara alternativas (Trade Studies), revisa la madurez CML 1-4 y ejecuta la verificación. Si el diseño cumple, se añade una misión real al sistema existente y consume combustible del simulador.</p>
    `,
  },
  {
    id: 'controles',
    title: 'Controles reales',
    html: '',
  },
];

/** Información contextual por zona del hábitat o destino. */
export const ZONE_INFO = {
  hangar: {
    title: 'Hangar · nave y carga útil',
    body:
      'La nave de transporte es el vehículo que te lleva entre la estación, la Luna y Marte. La carga útil es todo lo que la misión transporta para cumplir su objetivo científico; el vehículo de lanzamiento es el que pone la nave en órbita desde la Tierra. En el juego el lanzador se elige en la mesa de diseño.',
    lesson: 'spacecraft',
  },
  engineering: {
    title: 'Ingeniería · potencia y propulsión',
    body:
      'Los circuitos alimentan el hábitat; las baterías cubren picos y el control térmico evita que la electrónica se congele o se sobrecaliente. Los propulsores RCS del traje son un sistema aparte del reactor de la estación.',
    lesson: 'power-comms',
  },
  power: {
    title: 'Generación eléctrica',
    body:
      'La energía disponible limita los instrumentos y las comunicaciones. Un diseño debe comparar generación, almacenamiento y consumo; no basta con añadir paneles.',
    lesson: 'power-comms',
  },
  lab: {
    title: 'Laboratorio · instrumentos y datos',
    body:
      'Un instrumento convierte una magnitud física en una señal. Calibrar, muestrear y comparar con modelos convierte esa señal en un dato científico defendible.',
    lesson: 'instruments',
  },
  cockpit: {
    title: 'Puente · órbitas y control de misión',
    body:
      'La navegación orbital decide qué se observa y cuándo. El control de misión planifica comandos, recibe telemetría y responde a anomalías; no todo se resuelve desde la nave.',
    lesson: 'gravity-orbits',
  },
  ops: {
    title: 'Operaciones · comunicaciones',
    body:
      'Las ventanas de comunicación dependen de la geometría y de la red de estaciones. Los datos se almacenan y se transmiten por prioridad.',
    lesson: 'ground-control',
  },
  moon: {
    title: 'Luna · gravedad y regolito',
    body:
      'La gravedad lunar es 1,62 m/s², aproximadamente una sexta parte de la terrestre. El regolito es la capa de material suelto que cubre la superficie; el hielo de los cráteres es un recurso clave para agua y oxígeno.',
    lesson: 'solar-system',
  },
  mars: {
    title: 'Marte · terreno y geología',
    body:
      'Marte tiene 3,71 m/s² de gravedad superficial y una atmósfera dominada por CO₂. El terreno, los cañones y las capas sedimentarias registran una historia climática que los rovers ayudan a leer.',
    lesson: 'solar-system',
  },
  general: {
    title: 'Estación orbital EVA-07',
    body:
      'Recorre el hábitat, abre consolas y consulta el manual contextual con H. Cada sala tiene sistemas reales que puedes reparar o configurar.',
    lesson: 'mission-design',
  },
};

const MODULE_ZONE = {
  hangar: 'hangar',
  hangar_link: 'hangar',
  engineering: 'engineering',
  workshop: 'engineering',
  power: 'power',
  lab: 'lab',
  medbay: 'lab',
  cockpit: 'cockpit',
  ops: 'ops',
  airlock: 'eva',
  evaprep: 'eva',
};

export function zoneFor(moduleId, destination = 'station') {
  if (destination === 'moon') return 'moon';
  if (destination === 'mars') return 'mars';
  return MODULE_ZONE[moduleId] ?? 'general';
}

export function zoneInfo(id) {
  return ZONE_INFO[id] ?? ZONE_INFO.general;
}

export class UserManual {
  constructor(root) {
    this.root = root;
    this.el = null;
    this.section = 'primeros-pasos';
    this.zone = null;
    this.onClose = null;
    this.returnFocus = null;
  }

  get isOpen() {
    return !!this.el && !this.el.classList.contains('hidden');
  }

  open({ section = 'primeros-pasos', zone = null, onClose = null } = {}) {
    this.section = section;
    this.zone = zone;
    this.onClose = onClose;
    this._ensure();
    this.render();
    this.el.classList.remove('hidden');
    this.el.setAttribute('aria-hidden', 'false');
    this.el.querySelector('.manual-close')?.focus();
  }

  close() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.el.setAttribute('aria-hidden', 'true');
    const callback = this.onClose;
    this.onClose = null;
    callback?.();
  }

  toggle(options) {
    if (this.isOpen) this.close();
    else this.open(options);
  }

  _ensure() {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'overlay-manual';
    el.className = 'overlay hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Manual de usuario');
    el.innerHTML = `
      <div class="overlay-card manual-card">
        <header class="overlay-head">
          <div>
            <p class="eyebrow">Manual de usuario</p>
            <h2 class="title small">SPACE-TECH · Controles y sistemas</h2>
          </div>
          <button class="btn ghost small manual-close" type="button">Cerrar · ESC</button>
        </header>
        <div class="manual-layout">
          <nav class="manual-nav" aria-label="Secciones del manual"></nav>
          <article class="manual-body"></article>
        </div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;

    el.querySelector('.manual-close').addEventListener('click', () => this.close());
    el.querySelector('.manual-nav').addEventListener('click', (event) => {
      const button = event.target.closest('[data-manual-section]');
      if (!button) return;
      this.section = button.dataset.manualSection;
      this.render();
    });
    el.addEventListener('click', (event) => {
      if (event.target === el) this.close();
    });
  }

  render() {
    if (!this.el) return;
    const nav = this.el.querySelector('.manual-nav');
    const body = this.el.querySelector('.manual-body');

    const zone = this.zone ? zoneInfo(this.zone) : null;
    nav.innerHTML = `
      ${MANUAL_SECTIONS.map(
        (item) => `<button type="button" class="manual-tab ${
          item.id === this.section ? 'is-active' : ''
        }" data-manual-section="${item.id}">${item.title}</button>`
      ).join('')}
      ${
        zone
          ? `<button type="button" class="manual-tab manual-zone ${
              this.section === 'zona' ? 'is-active' : ''
            }" data-manual-section="zona">Info de zona</button>`
          : ''
      }
    `;

    if (this.section === 'zona' && zone) {
      body.innerHTML = `
        <p class="eyebrow">Información contextual</p>
        <h3>${zone.title}</h3>
        <p>${zone.body}</p>
        <p class="manual-note">Lección relacionada en la Academia: <strong>${zone.lesson}</strong>.</p>
      `;
      return;
    }

    const section = MANUAL_SECTIONS.find((item) => item.id === this.section) ?? MANUAL_SECTIONS[0];
    if (section.id === 'controles') {
      body.innerHTML = `
        <h3>Asignaciones reales</h3>
        <div class="manual-table-wrap">
          <table class="manual-table">
            <thead><tr><th>Acción</th><th>Teclado</th><th>Mando</th><th>Ámbito</th></tr></thead>
            <tbody>
              ${CONTROLS.map(
                (item) => `<tr>
                  <td><strong>${item.action}</strong><br><span>${item.note}</span></td>
                  <td>${item.keys.map((key) => `<kbd>${key}</kbd>`).join(' ')}</td>
                  <td>${item.alt.length ? item.alt.map((key) => `<kbd>${key}</kbd>`).join(' ') : '—'}</td>
                  <td>${item.scope}</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>
        <h3>Sin asignación</h3>
        <ul>${UNASSIGNED.map((item) => `<li>${item}</li>`).join('')}</ul>
      `;
      return;
    }

    body.innerHTML = section.html;
  }
}
