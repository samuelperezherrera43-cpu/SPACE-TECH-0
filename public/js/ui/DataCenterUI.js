import {
  SOURCES,
  SCIENCE_DATA,
  GAME_PARAMETERS,
  DATA_SOURCES,
  DISCLAIMER,
  DISCLAIMER_NOTE,
  dataKindLabel,
  sourceFor,
  ACCESS_DATE,
} from '../core/ScienceData.js';
import {
  MISSION_CATALOG,
  AUDIT_GROUPS,
  CATALOG_STATS,
  phaseLabel,
  recommendationLabel,
} from '../core/MissionCatalog.js';

/**
 * Centro de Datos Científicos. Muestra fuentes, datos, parámetros del juego,
 * catálogo de misiones y créditos. No realiza peticiones de red.
 */
export class DataCenterUI {
  constructor(root) {
    this.root = root;
    this.el = null;
    this.tab = 'data';
    this.recommendation = 'all';
    this.onClose = null;
  }

  get isOpen() {
    return !!this.el && !this.el.classList.contains('hidden');
  }

  open({ tab = 'data', onClose = null } = {}) {
    this.tab = tab;
    this.onClose = onClose;
    this._ensure();
    this.render();
    this.el.classList.remove('hidden');
    this.el.setAttribute('aria-hidden', 'false');
    this.el.querySelector('.data-close')?.focus();
  }

  close() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.el.setAttribute('aria-hidden', 'true');
    const callback = this.onClose;
    this.onClose = null;
    callback?.();
  }

  _ensure() {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'overlay-data';
    el.className = 'overlay hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Centro de Datos Científicos');
    el.innerHTML = `
      <div class="overlay-card data-card">
        <header class="overlay-head">
          <div>
            <p class="eyebrow">Centro de Datos Científicos</p>
            <h2 class="title small">Fuentes, datos y catálogo</h2>
            <p class="panel-sub">Contenido estático y cacheado. Sin consultas externas durante el juego.</p>
          </div>
          <button class="btn ghost small data-close" type="button">Cerrar · ESC</button>
        </header>
        <div class="data-tabs" role="tablist"></div>
        <div class="data-body"></div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;

    el.querySelector('.data-close').addEventListener('click', () => this.close());
    el.addEventListener('click', (event) => {
      if (event.target === el) this.close();
    });
    el.querySelector('.data-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-data-tab]');
      if (!button) return;
      this.tab = button.dataset.dataTab;
      this.render();
    });
    el.querySelector('.data-body').addEventListener('click', (event) => {
      const filter = event.target.closest('[data-recommendation]');
      if (!filter) return;
      this.recommendation = filter.dataset.recommendation;
      this.render();
    });
  }

  render() {
    if (!this.el) return;
    const tabs = [
      ['data', 'Datos reales'],
      ['parameters', 'Parámetros del juego'],
      ['sources', 'Fuentes NASA/JPL/CSA'],
      ['missions', 'Catálogo de misiones'],
      ['credits', 'Créditos y aviso'],
    ];
    this.el.querySelector('.data-tabs').innerHTML = tabs
      .map(
        ([id, name]) =>
          `<button type="button" class="quality-btn ${
            this.tab === id ? 'is-active' : ''
          }" data-data-tab="${id}" role="tab" aria-selected="${this.tab === id}">${name}</button>`
      )
      .join('');

    const body = this.el.querySelector('.data-body');
    if (this.tab === 'data') body.innerHTML = this._dataHtml();
    else if (this.tab === 'parameters') body.innerHTML = this._parametersHtml();
    else if (this.tab === 'sources') body.innerHTML = this._sourcesHtml();
    else if (this.tab === 'missions') body.innerHTML = this._missionsHtml();
    else body.innerHTML = this._creditsHtml();
  }

  _dataHtml() {
    return `
      <p class="data-intro">Datos oficiales con fuente, unidad y fecha de consulta. Los valores del simulador se muestran en otra pestaña para no confundirlos.</p>
      <div class="data-grid">
        ${SCIENCE_DATA.map((item) => {
          const source = sourceFor(item.sourceId);
          return `<article class="data-item">
            <span class="data-kind">${dataKindLabel(item.kind)}</span>
            <h3>${item.label}</h3>
            <b>${item.value} ${item.unit}</b>
            <p>${item.description}</p>
            <small>${source ? `${source.organization} · ${source.title}` : 'Fuente pendiente'} · consultado ${ACCESS_DATE}</small>
            ${source ? `<a href="${source.url}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ''}
          </article>`;
        }).join('')}
      </div>
      <p class="data-note">${DISCLAIMER}</p>
    `;
  }

  _parametersHtml() {
    return `
      <p class="data-intro">Parámetros simplificados del simulador. No representan cálculos orbitales reales ni magnitudes físicas del mundo real.</p>
      <div class="data-grid">
        ${GAME_PARAMETERS.map(
          (item) => `<article class="data-item game">
            <span class="data-kind">${dataKindLabel(item.kind)}</span>
            <h3>${item.label}</h3>
            <b>${item.value} ${item.unit}</b>
            <p>${item.description}</p>
          </article>`
        ).join('')}
      </div>
      <p class="data-note">Los resultados de la mesa de diseño (masa, potencia, coste y CML) son resultados calculados por la simulación educativa, no certificaciones de NASA.</p>
    `;
  }

  _sourcesHtml() {
    return `
      <p class="data-intro">Referencias utilizadas para el diseño educativo. Se citan; no se copia su código ni su arte.</p>
      <div class="source-list">
        ${[...SOURCES, ...DATA_SOURCES]
          .map(
            (source) => `<article class="source-item">
              <div class="source-head">
                <span class="data-kind">${source.organization}</span>
                <span class="source-date">${source.date ?? source.accessed ?? ''}</span>
              </div>
              <h3>${source.title}</h3>
              <p>${source.use ?? source.credit ?? ''}</p>
              <small>${source.license ?? ''}</small>
              <a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.url}</a>
            </article>`
          )
          .join('')}
      </div>
    `;
  }

  _missionsHtml() {
    const filters = [
      ['all', 'Todas'],
      ['keep', 'Conservar'],
      ['transform', 'Transformar'],
      ['secondary', 'Secundarias'],
      ['retire', 'Retirada propuesta'],
    ];
    const list =
      this.recommendation === 'all'
        ? MISSION_CATALOG
        : MISSION_CATALOG.filter((item) => item.recommendation === this.recommendation);

    return `
      <p class="data-intro">${CATALOG_STATS.total} misiones existentes catalogadas. Ninguna se elimina: las propuestas de retirada quedan documentadas y el progreso guardado se conserva.</p>
      <div class="catalog-stats">
        <div><span>Total</span><b>${CATALOG_STATS.total}</b></div>
        <div><span>Conservar</span><b>${CATALOG_STATS.byRecommendation.keep ?? 0}</b></div>
        <div><span>Transformar</span><b>${CATALOG_STATS.byRecommendation.transform ?? 0}</b></div>
        <div><span>Secundarias</span><b>${CATALOG_STATS.byRecommendation.secondary ?? 0}</b></div>
      </div>
      <div class="catalog-filters">${filters
        .map(
          ([id, name]) =>
            `<button type="button" class="quality-btn ${
              this.recommendation === id ? 'is-active' : ''
            }" data-recommendation="${id}">${name}</button>`
        )
        .join('')}</div>
      <div class="catalog-list">
        ${list
          .map(
            (item) => `<article class="catalog-item">
              <div class="catalog-head">
                <h3>${item.id}</h3>
                <span class="catalog-rec rec-${item.recommendation}">${recommendationLabel(item.recommendation)}</span>
              </div>
              <p><strong>${phaseLabel(item.phase)}</strong> · carga educativa ${item.educational}/5</p>
              <p>${item.notes}</p>
              <small>Dependencia: ${item.dependency}</small>
            </article>`
          )
          .join('')}
      </div>
      <h3>Solapamientos detectados</h3>
      <div class="audit-list">
        ${AUDIT_GROUPS.map(
          (group) => `<article class="audit-item">
            <h4>${group.title}</h4>
            <p>${group.finding}</p>
            <small>${group.action}</small>
          </article>`
        ).join('')}
      </div>
    `;
  }

  _creditsHtml() {
    return `
      <div class="credits-block">
        <h3>Aviso importante</h3>
        <p class="credits-disclaimer">${DISCLAIMER}</p>
        <p>${DISCLAIMER_NOTE}</p>
        <h3>Créditos de datos</h3>
        <ul>
          <li>Datos planetarios: NASA NSSDCA, Planetary Fact Sheets. Consultado ${ACCESS_DATE}.</li>
          <li>Proceso de diseño y segmentos: NASA, <em>Design and Develop Science Missions</em> (26/03/2025).</li>
          <li>Madurez de concepto: marco CML de NASA JPL, usado como inspiración educativa.</li>
          <li>Modalidades de mesa de diseño: inspiradas en NASA GSFC Mission Design Lab.</li>
          <li>Visualización: idea adaptada de NASA Mission VIZ con Three.js; no se reutiliza su código.</li>
          <li>Diseño de satélites: inspiración de NASA Webb Build It Yourself y CubeSat 101.</li>
          <li>Actividades: referencia complementaria de la Agencia Espacial Canadiense (CSA), no de NASA.</li>
        </ul>
        <h3>Qué es del juego y qué no</h3>
        <p>Los modelos 3D, textos, interfaz y parámetros de simulación son propios de SPACE-TECH. Los datos oficiales se citan con su fuente. Los resultados de diseño son cálculos educativos del simulador.</p>
        <p>SPACE-TECH no utiliza el logotipo oficial de NASA ni sugiere afiliación alguna.</p>
      </div>
    `;
  }
}
