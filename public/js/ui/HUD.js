import * as THREE from 'three';
import { TOOLS } from '../entities/Tool.js';

const _v = new THREE.Vector3();
const _camDir = new THREE.Vector3();

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * HUD en HTML/CSS sobre el canvas. Sin texto dentro de WebGL.
 * Los marcadores de fuga se proyectan de 3D a 2D una vez por frame.
 */
export class HUD {
  constructor(root) {
    this.root = root;

    const $ = (selector) => root.querySelector(selector);
    this.dom = {
      hud: $('#hud'),
      o2Fill: $('#o2-fill'),
      o2Value: $('#o2-value'),
      energyFill: $('#energy-fill'),
      energyValue: $('#energy-value'),
      integrityFill: $('#integrity-fill'),
      integrityValue: $('#integrity-value'),
      co2Value: $('#co2-value'),
      co2State: $('#co2-state'),
      filtersValue: $('#filters-value'),
      filtersState: $('#filters-state'),
      objective: $('#objective'),
      guide: $('#guide'),
      clock: $('#clock'),
      warnings: $('#warnings'),
      tetherState: $('#tether-state'),
      tetherFill: $('#tether-fill'),
      tetherDistance: $('#tether-distance'),
      pressureState: $('#pressure-state'),
      suitState: $('#suit-state'),
      suitHelmet: $('#suit-helmet'),
      suitZone: $('#suit-zone'),
      navTarget: $('#nav-target'),
      crosshair: $('#crosshair'),
      prompt: $('#prompt'),
      promptLabel: $('#prompt-label'),
      promptKey: $('#prompt-key'),
      promptFill: $('#prompt-fill'),
      toast: $('#toast'),
      tools: $('#tools'),
      markers: $('#markers'),
      screens: {
        entry: $('#screen-entry'),
        menu: $('#screen-menu'),
        settings: $('#screen-settings'),
        pause: $('#screen-pause'),
        win: $('#screen-win'),
        lose: $('#screen-lose'),
        multiplayer: $('#screen-multiplayer'),
      },
      winRepairs: $('#win-repairs'),
      winTime: $('#win-time'),
      winIntegrity: $('#win-integrity'),
      winO2: $('#win-o2'),
      loseTitle: $('#lose-title'),
      loseReason: $('#lose-reason'),
      loseRepairs: $('#lose-repairs'),
      loseTime: $('#lose-time'),
      panel: $('#panel'),
      panelEyebrow: $('#panel-eyebrow'),
      panelTitle: $('#panel-title'),
      panelSub: $('#panel-sub'),
      panelBody: $('#panel-body'),
      travel: $('#travel'),
      travelTitle: $('#travel-title'),
      travelSub: $('#travel-sub'),
      travelFill: $('#travel-fill'),
      travelStats: $('#travel-stats'),
      travelDistance: $('#travel-distance'),
      travelVelocity: $('#travel-velocity'),
      travelFuel: $('#travel-fuel'),
      travelEnergy: $('#travel-energy'),
      travelPhase: $('#travel-phase'),
      travelCorrection: $('#travel-correction'),
      travelSimulated: $('#travel-simulated'),
      travelEta: $('#travel-eta'),
      travelRef: $('#travel-ref'),
      travelDebug: $('#travel-debug'),
      missionComplete: $('#mission-complete'),
      missionCompleteTitle: $('#mission-complete-title'),
      missionCompleteSub: $('#mission-complete-sub'),
      missionCompleteReport: $('#mission-complete-report'),
      missionCompleteClose: $('#mission-complete-close'),
      destinationState: $('#destination-state'),
    };

    this.markers = [];
    this.toolChips = [];
    this._lastObjective = '';
    this._lastClock = '';
    this._lastWarnings = '';
    this._toastTimer = 0;
    this._missionTimer = 0;
    this._promptVisible = false;

    this._buildTools();
    this._buildMarkers(12);
    this.dom.missionCompleteClose?.addEventListener('click', () => this.hideMissionComplete());
  }

  /* --------------------------------------------------------------- estructura */

  _buildTools() {
    for (let i = 0; i < TOOLS.length; i++) {
      const tool = TOOLS[i];
      const chip = document.createElement('div');
      chip.className = 'tool';
      chip.innerHTML = `<span class="key">${i + 1}</span><span class="name">${tool.name}</span><span class="dot"></span>`;
      this.dom.tools.appendChild(chip);
      this.toolChips.push(chip);
    }
  }

  _buildMarkers(count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = '<span class="marker-ring"></span><span class="marker-label"></span>';
      this.dom.markers.appendChild(el);
      this.markers.push({ el, label: el.querySelector('.marker-label') });
    }
  }

  /* ------------------------------------------------------------------ estado */

  show() {
    this.dom.hud.classList.remove('hidden');
    this.dom.hud.setAttribute('aria-hidden', 'false');
  }

  hide() {
    this.dom.hud.classList.add('hidden');
    this.dom.hud.setAttribute('aria-hidden', 'true');
  }

  screen(name) {
    for (const [key, element] of Object.entries(this.dom.screens)) {
      element.classList.toggle('hidden', key !== name);
    }
  }

  setStats(o2, energy, integrity, co2, filterLife) {
    this._setBar(this.dom.o2Fill, o2);
    this._setBar(this.dom.energyFill, energy);
    this._setBar(this.dom.integrityFill, integrity);

    this.dom.o2Value.textContent = `${Math.round(o2)}%`;
    this.dom.energyValue.textContent = `${Math.round(energy)}%`;
    this.dom.integrityValue.textContent = `${Math.round(integrity)}%`;

    // Nuevos indicadores Módulo 1: CO₂ y filtros
    const co2Clamped = Math.max(0, Math.min(100, co2));
    this.dom.co2Value.textContent = `${Math.round(co2Clamped)}%`;
    this.dom.co2State.textContent = co2Clamped > 70 ? 'ALTO' : co2Clamped > 40 ? 'ACEPTABLE' : 'OK';

    const filterClamped = Math.max(0.3, Math.min(1.0, filterLife));
    const filterPercent = Math.round(filterClamped * 100);
    this.dom.filtersValue.textContent = `${filterPercent}%`;
    this.dom.filtersState.textContent = filterClamped > 0.7 ? 'NUEVO' : filterClamped > 0.4 ? 'USADO' : 'AGOTADO';
  }

  _setBar(fill, value) {
    const clamped = Math.max(0, Math.min(100, value));
    fill.style.transform = `scaleX(${clamped / 100})`;
    fill.classList.toggle('low', clamped > 20 && clamped <= 45);
    fill.classList.toggle('critical', clamped <= 20);
  }

  setObjective(done, total) {
    const text = `Fugas selladas <b>${done} / ${total}</b>`;
    if (text === this._lastObjective) return;
    this._lastObjective = text;
    this.dom.objective.innerHTML = text;
  }

  /** Objetivo principal: misión activa y progreso de sus objetivos. */
  setMission(mission) {
    let text;
    if (!mission) {
      text = 'Sin misión activa · <b>consola del puente</b>';
    } else {
      const done = mission.objectives.reduce(
        (sum, item) => sum + Math.min(item.target, item.progress),
        0
      );
      const total = mission.objectives.reduce((sum, item) => sum + item.target, 0);
      text = `${mission.name} <b>${done} / ${total}</b>`;
    }
    if (text === this._lastObjective) return;
    this._lastObjective = text;
    this.dom.objective.innerHTML = text;
  }

  /** Guía breve de la experiencia guiada; se oculta al aceptar una misión. */
  setGuide(text) {
    if (!this.dom.guide) return;
    if (!text) {
      this.dom.guide.classList.add('hidden');
      this.dom.guide.innerHTML = '';
      return;
    }
    this.dom.guide.innerHTML = text;
    this.dom.guide.classList.remove('hidden');
  }

  setTether({ active, distance, max, tension }) {    if (!this.dom.tetherState) return;

    const high = tension > 0.75;
    const state = !active ? 'RECOGIDO' : high ? 'TENSIÓN ALTA' : 'CONECTADO';
    if (this.dom.tetherState.textContent !== state) this.dom.tetherState.textContent = state;
    this.dom.tetherState.classList.toggle('warn', high);

    const text = active ? `${distance.toFixed(1)} / ${max.toFixed(0)} m` : '—';
    if (this.dom.tetherDistance.textContent !== text) this.dom.tetherDistance.textContent = text;

    const fill = this.dom.tetherFill;
    if (fill) {
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, tension)).toFixed(3)})`;
      fill.classList.toggle('low', tension > 0.55 && tension <= 0.8);
      fill.classList.toggle('critical', tension > 0.8);
    }
  }

  setPressure(status) {
    if (!this.dom.pressureState) return;
    const text = status?.label ?? 'PRESURIZADA';
    if (this.dom.pressureState.textContent !== text) this.dom.pressureState.textContent = text;
    this.dom.pressureState.classList.toggle('warn', !status?.pressurized);
  }

  /** Estado del traje: equipado, integridad del casco y zona de presión. */
  setSuit({ equipped, helmet, zone, damaged }) {
    if (!this.dom.suitState) return;

    const state = equipped ? 'EQUIPADO' : 'GUARDADO';
    if (this.dom.suitState.textContent !== state) this.dom.suitState.textContent = state;
    this.dom.suitState.classList.toggle('warn', !equipped);

    const helmetText = `Casco ${Math.round(helmet)}%`;
    if (this.dom.suitHelmet.textContent !== helmetText) this.dom.suitHelmet.textContent = helmetText;
    this.dom.suitHelmet.classList.toggle('warn', damaged || helmet < 50);

    const zoneText = zone === 'outside' ? 'EXTERIOR' : 'PRESURIZADO';
    if (this.dom.suitZone.textContent !== zoneText) this.dom.suitZone.textContent = zoneText;
    this.dom.suitZone.classList.toggle('warn', zone === 'outside');
  }

  setNavigation(target) {
    if (!this.dom.navTarget) return;
    const text = target ? `${target.name} · ${target.distance.toFixed(0)} m` : 'SIN DESTINO';
    if (this.dom.navTarget.textContent !== text) this.dom.navTarget.textContent = text;
  }

  setDestination(name) {
    if (!this.dom.destinationState) return;
    if (this.dom.destinationState.textContent !== name) {
      this.dom.destinationState.textContent = name;
    }
  }

  /** Aviso grande y no bloqueante al completar una misión única. */
  showMissionComplete(mission, report = null) {
    if (!this.dom.missionComplete) return;
    this.dom.missionComplete.classList.remove('hidden');
    this.dom.missionComplete.setAttribute('aria-hidden', 'false');
    this.dom.missionCompleteTitle.textContent = mission.name;
    const objectives = mission.objectives
      .map((item) => `${item.label} ${item.progress}/${item.target}`)
      .join(' · ');
    const reward = mission.reward ?? {};
    const rewardText = `Recompensa: O2 +${reward.o2 ?? 0} · RCS +${reward.rcs ?? 0} · Casco +${reward.hull ?? 0}`;
    this.dom.missionCompleteSub.textContent = `${objectives} · ${rewardText}`;
    if (this.dom.missionCompleteReport) {
      this.dom.missionCompleteReport.innerHTML = report
        ? `
          <div><strong>Qué has aprendido</strong><ul>${report.learned
            .map((item) => `<li>${item}</li>`)
            .join('')}</ul></div>
          <div><strong>Decisiones y consecuencias</strong><ul>${report.consequences
            .map((item) => `<li>${item}</li>`)
            .join('')}</ul></div>
          <div><strong>Conceptos</strong><p>${report.concepts.join(' · ')}</p>
          <small>${report.improve}</small></div>
        `
        : '';
    }
    clearTimeout(this._missionTimer);
    this._missionTimer = setTimeout(() => this.hideMissionComplete(), report ? 12000 : 5200);
  }

  hideMissionComplete() {
    if (!this.dom.missionComplete) return;
    this.dom.missionComplete.classList.add('hidden');
    this.dom.missionComplete.setAttribute('aria-hidden', 'true');
  }

  setWarnings(list) {
    if (!this.dom.warnings) return;
    const key = list.join('|');
    if (key === this._lastWarnings) return;
    this._lastWarnings = key;

    this.dom.warnings.innerHTML = '';
    for (const warning of list) {
      const chip = document.createElement('span');
      chip.className = 'warning';
      chip.textContent = warning;
      this.dom.warnings.appendChild(chip);
    }
    this.dom.warnings.classList.toggle('hidden', list.length === 0);
  }

  /* ------------------------------------------------------------------ panel */

  showPanel({ eyebrow, title, subtitle, html, footer }) {
    if (!this.dom.panel) return;
    this.dom.panel.classList.remove('hidden');
    this.dom.panel.setAttribute('aria-hidden', 'false');
    this.dom.panelEyebrow.textContent = eyebrow ?? '';
    this.dom.panelTitle.textContent = title ?? '';
    this.dom.panelSub.textContent = subtitle ?? '';
    this.dom.panelBody.innerHTML = (html ?? '') + (footer ?? '');
  }

  hidePanel() {
    if (!this.dom.panel) return;
    this.dom.panel.classList.add('hidden');
    this.dom.panel.setAttribute('aria-hidden', 'true');
    this.dom.panelBody.innerHTML = '';
  }

  setJobProgress(progress, label) {
    const fill = this.dom.panelBody?.querySelector('#job-fill');
    const text = this.dom.panelBody?.querySelector('#job-label');
    if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress)).toFixed(3)})`;
    if (text && label) text.textContent = label;
  }

  showTravel(title, subtitle) {
    if (!this.dom.travel) return;
    this.dom.travel.classList.remove('hidden');
    this.dom.travel.setAttribute('aria-hidden', 'false');
    this.dom.travelTitle.textContent = title;
    this.dom.travelSub.textContent = subtitle;
    this.dom.travelFill.style.transform = 'scaleX(0)';
  }

  setTravelProgress(progress) {
    if (!this.dom.travelFill) return;
    this.dom.travelFill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress)).toFixed(3)})`;
  }

  setTravelStats(stats) {
    const dom = this.dom;
    if (!dom.travelStats) return;
    const s = stats || {};
    const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)} mil` : (n ?? 0).toFixed(0));
    if (dom.travelDistance) dom.travelDistance.textContent = `${Math.round(s.distanceKm ?? 0).toLocaleString('es-ES')} km`;
    if (dom.travelVelocity) dom.travelVelocity.textContent = `${(s.velocityKms ?? 0).toFixed(2)} km/s`;
    if (dom.travelFuel) dom.travelFuel.textContent = `${Math.round(s.fuel ?? 0)}%`;
    if (dom.travelEnergy) dom.travelEnergy.textContent = `${Math.round(s.energy ?? 0)}%`;
    if (dom.travelPhase) dom.travelPhase.textContent = s.phase ?? '—';
    if (dom.travelCorrection) dom.travelCorrection.textContent = s.correction ? 'Corrección de trayectoria' : '';
    if (dom.travelSimulated) {
      const days = (s.elapsed ?? 0) / 86400;
      dom.travelSimulated.textContent = days >= 30 ? `${(days / 30).toFixed(1)} meses` : `${days.toFixed(1)} días`;
    }
    if (dom.travelEta) {
      const days = (s.remaining ?? 0) / 86400;
      dom.travelEta.textContent = days >= 30 ? `${(days / 30).toFixed(1)} meses` : `${days.toFixed(1)} días`;
    }
    if (dom.travelRef) dom.travelRef.textContent = `${s.refDays ?? 0} días`;
  }

  hideTravel() {
    if (!this.dom.travel) return;
    this.dom.travel.classList.add('hidden');
    this.dom.travel.setAttribute('aria-hidden', 'true');
  }

  setClock(seconds) {
    const text = formatTime(seconds);
    if (text === this._lastClock) return;
    this._lastClock = text;
    this.dom.clock.textContent = text;
  }

  setTool(index) {
    this.toolChips.forEach((chip, i) => chip.classList.toggle('active', i === index));
  }

  setCrosshair(state) {
    const crosshair = this.dom.crosshair;
    crosshair.classList.toggle('target', state === 'target');
    crosshair.classList.toggle('wrong', state === 'wrong');
  }

  showPrompt(label, key, progress = 1) {
    this.dom.prompt.classList.remove('hidden');
    this._promptVisible = true;

    if (this.dom.promptLabel.textContent !== label) this.dom.promptLabel.textContent = label;
    if (this.dom.promptKey.textContent !== key) this.dom.promptKey.textContent = key;

    this.dom.promptFill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
  }

  hidePrompt() {
    if (!this._promptVisible) return;
    this.dom.prompt.classList.add('hidden');
    this._promptVisible = false;
  }

  toast(text, kind = '', duration = 2.4) {
    const toast = this.dom.toast;
    toast.textContent = text;
    toast.className = `toast show ${kind}`.trim();

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration * 1000);
  }

  /* -------------------------------------------------------------- marcadores */

  updateMarkers(breaches, camera, playerPosition, revealAll) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.getWorldDirection(_camDir);

    let used = 0;

    for (const breach of breaches) {
      if (!breach.active) continue;
      if (used >= this.markers.length) break;

      const distance = breach.position.distanceTo(playerPosition);
      if (!revealAll && distance > 28) continue;

      _v.copy(breach.position).sub(camera.position);
      if (_v.dot(_camDir) <= 0) continue;

      _v.copy(breach.position).project(camera);
      if (_v.z < -1 || _v.z > 1) continue;

      const x = (_v.x * 0.5 + 0.5) * width;
      const y = (-_v.y * 0.5 + 0.5) * height;

      if (x < 8 || x > width - 8 || y < 8 || y > height - 8) continue;

      const marker = this.markers[used];
      used++;

      marker.el.className = `marker visible ${breach.type}`;
      marker.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;

      const text = `${breach.type === 'hull' ? 'FISURA' : 'VÁLVULA'} · ${Math.round(distance)} m`;
      if (marker.label.textContent !== text) marker.label.textContent = text;
    }

    for (let i = used; i < this.markers.length; i++) {
      const marker = this.markers[i];
      if (marker.el.classList.contains('visible')) {
        marker.el.className = 'marker';
      }
    }
  }

  /* ------------------------------------------------------------------ finales */

  setWinStats({ repairs, time, integrity, o2 }) {
    this.dom.winRepairs.textContent = String(repairs);
    this.dom.winTime.textContent = formatTime(time);
    this.dom.winIntegrity.textContent = `${Math.round(integrity)}%`;
    this.dom.winO2.textContent = `${Math.round(o2)}%`;
  }

  setLoseStats({ title, reason, repairs, time }) {
    this.dom.loseTitle.textContent = title;
    this.dom.loseReason.textContent = reason;
    this.dom.loseRepairs.textContent = String(repairs);
    this.dom.loseTime.textContent = formatTime(time);
  }
}
