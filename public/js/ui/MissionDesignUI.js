import {
  DESIGN_PHASES,
  DESIGN_SEGMENTS,
  DESIGN_MODALITIES,
  SCIENCE_GOALS,
  CONCEPTS,
  INSTRUMENTS,
  LAUNCH_VEHICLES,
  TRAJECTORIES,
  GROUND_STATIONS,
  CML_LEVELS,
  requirementsFor,
  computeTotals,
  tradeAlternatives,
  verifyDesign,
  cmlFor,
  implementationCost,
  goalById,
  conceptById,
  instrumentById,
  vehicleById,
  trajectoryById,
  groundById,
} from '../core/MissionDesign.js';

const money = (value) => `${Math.round(value)} M$`;
const watts = (value) => `${Math.round(value)} W`;
const kilos = (value) => `${Math.round(value)} kg`;

/**
 * Mesa de diseño de misiones. Modifica un objeto de estado propiedad de Game
 * y llama a onImplement para aplicar consecuencias reales al simulador.
 */
export class MissionDesignUI {
  constructor(root, { state, onChange = null, onImplement = null }) {
    this.root = root;
    this.state = state;
    this.onChange = onChange;
    this.onImplement = onImplement;
    this.el = null;
    this.phase = 1;
    this.result = null;
    this.onClose = null;
  }

  get isOpen() {
    return !!this.el && !this.el.classList.contains('hidden');
  }

  open({ phase = null, onClose = null } = {}) {
    if (phase) this.phase = phase;
    this.onClose = onClose;
    this.result = null;
    this._ensure();
    this.render();
    this.el.classList.remove('hidden');
    this.el.setAttribute('aria-hidden', 'false');
    this.el.querySelector('.design-close')?.focus();
  }

  close() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.el.setAttribute('aria-hidden', 'true');
    const callback = this.onClose;
    this.onClose = null;
    callback?.();
  }

  _changed() {
    this.onChange?.(this.state);
  }

  _ensure() {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'overlay-design';
    el.className = 'overlay hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Mesa de diseño de misiones');
    el.innerHTML = `
      <div class="overlay-card design-card">
        <header class="overlay-head">
          <div>
            <p class="eyebrow">Mesa de diseño · NASA Design Process</p>
            <h2 class="title small">Diseñar una misión</h2>
            <p class="panel-sub design-cml"></p>
          </div>
          <button class="btn ghost small design-close" type="button">Cerrar · ESC</button>
        </header>
        <div class="design-phases" role="tablist"></div>
        <div class="design-body"></div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;

    el.querySelector('.design-close').addEventListener('click', () => this.close());
    el.addEventListener('click', (event) => {
      if (event.target === el) this.close();
    });

    el.querySelector('.design-phases').addEventListener('click', (event) => {
      const button = event.target.closest('[data-design-phase]');
      if (!button) return;
      this.phase = Number(button.dataset.designPhase);
      this.result = null;
      this.render();
    });

    el.querySelector('.design-body').addEventListener('click', (event) => {
      const target = event.target.closest('[data-design-action]');
      if (!target) return;
      const action = target.dataset.designAction;
      const value = target.dataset.value;

      if (action === 'goal') {
        this.state.goalId = value;
        this.state.requirements = requirementsFor(goalById(value));
        this.state.verified = null;
        this.state.implemented = false;
        this.state.report = null;
        this.state.phase = 2;
        this.phase = 2;
        this._changed();
      } else if (action === 'concept') {
        this.state.conceptId = value;
        this.state.verified = null;
        this.state.implemented = false;
        this._changed();
      } else if (action === 'modality') {
        this.state.modality = value;
        this._changed();
      } else if (action === 'trade') {
        this.state.tradeChoice = value;
        if (!this.state.compared.includes(value)) this.state.compared.push(value);
        this.state.verified = null;
        this._changed();
      } else if (action === 'vehicle') {
        this.state.vehicleId = value;
        this.state.verified = null;
        this._changed();
      } else if (action === 'instrument') {
        const ids = this.state.instrumentIds;
        if (ids.includes(value)) {
          this.state.instrumentIds = ids.filter((id) => id !== value);
        } else if (ids.length < 3) {
          this.state.instrumentIds = [...ids, value];
        }
        this.state.verified = null;
        this._changed();
      } else if (action === 'trajectory') {
        this.state.trajectoryId = value;
        this.state.verified = null;
        this._changed();
      } else if (action === 'ground') {
        this.state.groundId = value;
        this.state.verified = null;
        this._changed();
      } else if (action === 'verify') {
        this.state.verified = verifyDesign(this.state);
        this.state.phase = 5;
        this.phase = 5;
        this._changed();
      } else if (action === 'implement') {
        if (!this.state.verified?.ok) {
          this.result = {
            ok: false,
            message: 'El diseño debe verificarse correctamente antes de implementarse.',
          };
        } else {
          this.result = this.onImplement?.(this.state) ?? {
            ok: false,
            message: 'No hay una partida activa para implementar la misión.',
          };
          if (this.result.ok) {
            this.state.implemented = true;
            this.state.phase = 6;
            this.phase = 6;
          }
          this._changed();
        }
      } else if (action === 'next-phase') {
        this.phase = Math.min(6, this.phase + 1);
        this.result = null;
      } else if (action === 'close') {
        this.close();
        return;
      } else if (action === 'prev-phase') {
        this.phase = Math.max(1, this.phase - 1);
        this.result = null;
      }
      this.render();
    });

    el.querySelector('.design-body').addEventListener('input', (event) => {
      const input = event.target.closest('[data-requirement]');
      if (!input) return;
      const key = input.dataset.requirement;
      this.state.requirements[key] = Number(input.value);
      this.state.verified = null;
      this._changed();
      const output = input.parentElement.querySelector('[data-requirement-value]');
      if (output) output.textContent = `${input.value} ${input.dataset.unit ?? ''}`;
    });
  }

  render() {
    if (!this.el) return;
    const cml = cmlFor(this.state);
    this.el.querySelector('.design-cml').textContent =
      `${CML_LEVELS.find((level) => level.id === cml)?.name ?? 'CML 1'} · ` +
      'marco educativo inspirado en JPL, no certificación oficial.';

    this.el.querySelector('.design-phases').innerHTML = DESIGN_PHASES.map((phase) => {
      const done =
        (phase.id === 1 && this.state.goalId) ||
        (phase.id === 2 && this.state.conceptId) ||
        (phase.id === 3 && this.state.requirements) ||
        (phase.id === 4 && this.state.instrumentIds.length > 0) ||
        (phase.id === 5 && this.state.verified?.ok) ||
        (phase.id === 6 && this.state.implemented);
      return `<button type="button" class="design-phase ${
        this.phase === phase.id ? 'is-active' : ''
      } ${done ? 'is-done' : ''}" data-design-phase="${phase.id}" role="tab" aria-selected="${
        this.phase === phase.id
      }"><span>${phase.id}</span>${phase.short}</button>`;
    }).join('');

    const body = this.el.querySelector('.design-body');
    if (this.phase === 1) body.innerHTML = this._phaseNeed();
    else if (this.phase === 2) body.innerHTML = this._phaseConcept();
    else if (this.phase === 3) body.innerHTML = this._phaseRequirements();
    else if (this.phase === 4) body.innerHTML = this._phaseDesign();
    else if (this.phase === 5) body.innerHTML = this._phaseVerify();
    else body.innerHTML = this._phaseImplement();
  }

  _segmentsHtml() {
    return `<div class="segment-grid">${DESIGN_SEGMENTS.map(
      (segment) => `<div class="segment-item">
        <strong>${segment.name}</strong>
        <span>${segment.description}</span>
      </div>`
    ).join('')}</div>`;
  }

  _phaseNeed() {
    return `
      <div class="design-section">
        <p class="eyebrow">Fase 1 · Identificar la necesidad</p>
        <h3>¿Qué pregunta científica quieres responder?</h3>
        <p>La misión empieza por la necesidad, no por el cohete. Elige un objetivo; los requisitos iniciales se ajustarán a su destino y capacidades.</p>
        <div class="choice-grid">
          ${SCIENCE_GOALS.map(
            (goal) => `<button type="button" class="choice-card ${
              this.state.goalId === goal.id ? 'is-active' : ''
            }" data-design-action="goal" data-value="${goal.id}">
              <strong>${goal.name}</strong>
              <span>${goal.question}</span>
              <small>${goal.destinationName} · ${goal.minPowerW} W mínimos · ${goal.minDataGB} GB</small>
            </button>`
          ).join('')}
        </div>
        <h4>Los cuatro segmentos</h4>
        <p>No son pasos cronológicos: son partes interrelacionadas de la arquitectura.</p>
        ${this._segmentsHtml()}
        <div class="actions"><button type="button" class="btn" data-design-action="next-phase">Continuar al concepto</button></div>
      </div>
    `;
  }

  _phaseConcept() {
    const goal = goalById(this.state.goalId);
    const alternatives = tradeAlternatives(this.state);
    return `
      <div class="design-section">
        <p class="eyebrow">Fase 2 · Definir el concepto</p>
        <h3>${goal ? goal.name : 'Elige primero un objetivo'}</h3>
        <p>Selecciona una arquitectura y una modalidad. Después compara alternativas: un trade study documentado sube la madurez del concepto.</p>
        <div class="choice-grid compact">
          ${CONCEPTS.map(
            (concept) => `<button type="button" class="choice-card ${
              this.state.conceptId === concept.id ? 'is-active' : ''
            }" data-design-action="concept" data-value="${concept.id}">
              <strong>${concept.name}</strong>
              <span>${concept.description}</span>
              <small>${kilos(concept.baseMassKg)} base · ${watts(concept.basePowerW)} · ${money(
                concept.baseCostM
              )} · riesgo ${concept.risk}/5</small>
            </button>`
          ).join('')}
        </div>
        <h4>Modalidad de diseño</h4>
        <div class="chip-row">
          ${DESIGN_MODALITIES.map(
            (modality) => `<button type="button" class="chip ${
              this.state.modality === modality.id ? 'is-active' : ''
            }" data-design-action="modality" data-value="${modality.id}" title="${modality.description}">${
              modality.name
            }</button>`
          ).join('')}
        </div>
        ${
          alternatives.length
            ? `<h4>Mesa de trade studies</h4>
               <p>Compara al menos dos alternativas antes de verificar. La elegida condiciona masa y coste.</p>
               <div class="trade-grid">${alternatives
                 .map(
                   (alt) => `<div class="trade-card ${
                     this.state.tradeChoice === alt.id ? 'is-active' : ''
                   }">
                     <strong>${alt.name}</strong>
                     <span>${kilos(alt.massKg)} · ${watts(alt.powerW)} · ${money(alt.costM)}</span>
                     <small>Riesgo ${alt.risk}/5 · ${alt.note}</small>
                     <button type="button" class="btn ghost small" data-design-action="trade" data-value="${alt.id}">${
                       this.state.compared.includes(alt.id) ? 'Comparada ✓' : 'Comparar'
                     }</button>
                   </div>`
                 )
                 .join('')}</div>`
            : '<p class="manual-note">Elige un concepto para generar las alternativas.</p>'
        }
        <div class="actions">
          <button type="button" class="btn ghost" data-design-action="prev-phase">Atrás</button>
          <button type="button" class="btn" data-design-action="next-phase">Definir requisitos</button>
        </div>
      </div>
    `;
  }

  _phaseRequirements() {
    const req = this.state.requirements;
    const slider = (key, label, min, max, step, unit) => `
      <label class="req-row">
        <span>${label}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${req[key]}" data-requirement="${key}" data-unit="${unit}" />
        <b data-requirement-value>${req[key]} ${unit}</b>
      </label>`;
    return `
      <div class="design-section">
        <p class="eyebrow">Fase 3 · Establecer los requisitos</p>
        <h3>Requisitos medibles</h3>
        <p>Un requisito debe poder verificarse. Ajusta los límites; el diseño se comprobará contra ellos.</p>
        <div class="req-grid">
          ${slider('massKg', 'Masa máxima', 600, 4000, 50, 'kg')}
          ${slider('powerW', 'Potencia máxima', 60, 600, 10, 'W')}
          ${slider('costM', 'Presupuesto máximo', 80, 420, 10, 'M$')}
          ${slider('dataGB', 'Datos requeridos', 4, 80, 2, 'GB')}
          ${slider('bandwidthKbps', 'Ancho de banda mínimo', 64, 1024, 32, 'kbps')}
        </div>
        <div class="req-summary">
          <span>Masa ${kilos(req.massKg)}</span>
          <span>Potencia ${watts(req.powerW)}</span>
          <span>Coste ${money(req.costM)}</span>
          <span>Datos ${req.dataGB} GB</span>
          <span>Enlace ${req.bandwidthKbps} kbps</span>
        </div>
        <div class="actions">
          <button type="button" class="btn ghost" data-design-action="prev-phase">Atrás</button>
          <button type="button" class="btn" data-design-action="next-phase">Pasar al diseño</button>
        </div>
      </div>
    `;
  }

  _phaseDesign() {
    const totals = computeTotals(this.state);
    return `
      <div class="design-section">
        <p class="eyebrow">Fase 4 · Diseñar</p>
        <h3>Lanzador, instrumentos, trayectoria y tierra</h3>
        <h4>Launch Segment</h4>
        <div class="choice-grid compact">
          ${LAUNCH_VEHICLES.map(
            (vehicle) => `<button type="button" class="choice-card ${
              this.state.vehicleId === vehicle.id ? 'is-active' : ''
            }" data-design-action="vehicle" data-value="${vehicle.id}">
              <strong>${vehicle.name}</strong>
              <span>${vehicle.description}</span>
              <small>Máx. ${kilos(vehicle.maxMassKg)} · ${money(vehicle.costM)}</small>
            </button>`
          ).join('')}
        </div>
        <h4>Space Segment · instrumentos (máximo 3)</h4>
        <div class="instrument-grid">
          ${INSTRUMENTS.map((instrument) => {
            const selected = this.state.instrumentIds.includes(instrument.id);
            return `<button type="button" class="instrument-card ${
              selected ? 'is-active' : ''
            }" data-design-action="instrument" data-value="${instrument.id}">
              <strong>${instrument.name}</strong>
              <span>${instrument.description}</span>
              <small>${kilos(instrument.massKg)} · ${watts(instrument.powerW)} · ${instrument.dataGB} GB · ${money(
                instrument.costM
              )}</small>
            </button>`;
          }).join('')}
        </div>
        <h4>Trayectoria</h4>
        <div class="chip-row">
          ${TRAJECTORIES.map(
            (trajectory) => `<button type="button" class="chip ${
              this.state.trajectoryId === trajectory.id ? 'is-active' : ''
            }" data-design-action="trajectory" data-value="${trajectory.id}" title="${trajectory.description}">${
              trajectory.name
            }</button>`
          ).join('')}
        </div>
        <h4>Ground Segment</h4>
        <div class="choice-grid compact">
          ${GROUND_STATIONS.map(
            (station) => `<button type="button" class="choice-card ${
              this.state.groundId === station.id ? 'is-active' : ''
            }" data-design-action="ground" data-value="${station.id}">
              <strong>${station.name}</strong>
              <span>${station.description}</span>
              <small>${station.bandwidthKbps} kbps · ${money(station.costM)}</small>
            </button>`
          ).join('')}
        </div>
        <div class="totals-row">
          <span>Masa <b>${kilos(totals.massKg)}</b></span>
          <span>Potencia <b>${watts(totals.powerW)}</b></span>
          <span>Coste <b>${money(totals.costM)}</b></span>
          <span>Datos <b>${totals.dataGB} GB</b></span>
          <span>Enlace <b>${totals.bandwidthKbps} kbps</b></span>
        </div>
        <div class="actions">
          <button type="button" class="btn ghost" data-design-action="prev-phase">Atrás</button>
          <button type="button" class="btn" data-design-action="verify">Verificar diseño</button>
        </div>
      </div>
    `;
  }

  _phaseVerify() {
    const verified = this.state.verified ?? verifyDesign(this.state);
    const totals = verified.totals;
    const goal = goalById(this.state.goalId);
    const concept = conceptById(this.state.conceptId);
    return `
      <div class="design-section">
        <p class="eyebrow">Fase 5 · Construir y verificar</p>
        <h3>${verified.ok ? 'Diseño verificado' : 'Diseño con incidencias'}</h3>
        <p>${goal?.question ?? ''} Arquitectura: ${concept?.name ?? 'sin definir'}.</p>
        <div class="verify-grid">
          ${verified.checks
            .map(
              (check) => `<div class="verify-item ${check.ok ? 'ok' : 'bad'}">
                <span>${check.ok ? '✓' : '✕'}</span>
                <div><strong>${check.label}</strong><small>${check.detail}</small></div>
              </div>`
            )
            .join('')}
        </div>
        <div class="totals-row">
          <span>Masa <b>${kilos(totals.massKg)}</b> / ${kilos(this.state.requirements.massKg)}</span>
          <span>Potencia <b>${watts(totals.powerW)}</b> / ${watts(this.state.requirements.powerW)}</span>
          <span>Coste <b>${money(totals.costM)}</b> / ${money(this.state.requirements.costM)}</span>
          <span>Datos <b>${totals.dataGB} GB</b></span>
          <span>Enlace <b>${totals.bandwidthKbps} kbps</b></span>
        </div>
        <p class="cml-line">Madurez educativa: <strong>${verified.cmlName}</strong>. No es una certificación oficial de NASA.</p>
        ${
          verified.ok
            ? '<p class="academy-done">✓ Todos los requisitos se cumplen. Puedes implementar la misión.</p>'
            : '<p class="academy-feedback bad">Corrige las incidencias antes de implementar.</p>'
        }
        <div class="actions">
          <button type="button" class="btn ghost" data-design-action="prev-phase">Volver al diseño</button>
          <button type="button" class="btn" data-design-action="implement" ${
            verified.ok ? '' : 'disabled'
          }>Implementar misión</button>
        </div>
      </div>
    `;
  }

  _phaseImplement() {
    const cost = implementationCost(this.state);
    const report = this.result?.report ?? this.state.report;
    if (this.result && !this.result.ok) {
      return `<div class="design-section">
        <p class="eyebrow">Fase 6 · Implementar</p>
        <h3>No se pudo implementar</h3>
        <p class="academy-feedback bad">${this.result.message}</p>
        <div class="actions"><button type="button" class="btn ghost" data-design-action="prev-phase">Volver</button></div>
      </div>`;
    }
    if (!report) {
      return `<div class="design-section">
        <p class="eyebrow">Fase 6 · Implementar</p>
        <h3>Listo para ejecutar</h3>
        <p>La implementación consume recursos reales del simulador y añade una misión al sistema existente.</p>
        <div class="totals-row">
          <span>Combustible <b>${cost.fuel}%</b></span>
          <span>Integridad de nave <b>-${cost.integrity}%</b></span>
          <span>Industrial <b>${cost.industrial}</b></span>
          <span>Electrónica <b>${cost.electronics}</b></span>
          <span>Metales <b>${cost.metals}</b></span>
        </div>
        <p class="manual-note">Si faltan recursos, la misión no se implementa. Reposta y recoge materiales en la estación.</p>
        <div class="actions">
          <button type="button" class="btn ghost" data-design-action="prev-phase">Atrás</button>
          <button type="button" class="btn" data-design-action="implement">Implementar ahora</button>
        </div>
      </div>`;
    }
    return `<div class="design-section">
      <p class="eyebrow">Resultado · ${report.cmlName}</p>
      <h3>Misión implementada</h3>
      <div class="report-grid">
        <div><h4>Qué has aprendido</h4><ul>${report.learned.map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div><h4>Decisiones tomadas</h4><ul>${report.decisions.map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div><h4>Consecuencias</h4><ul>${report.consequences.map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div><h4>Conceptos científicos</h4><ul>${report.concepts.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      </div>
      <p class="academy-feedback good">${report.improve}</p>
      <div class="actions">
        <button type="button" class="btn ghost" data-design-action="prev-phase">Revisar diseño</button>
        <button type="button" class="btn" data-design-action="close">Volver a la exploración</button>
      </div>
    </div>`;
  }
}
