import {
  ACADEMY_LESSONS,
  ACADEMY_MODES,
  questionFor,
  illustrationSvg,
} from '../core/Academy.js';
import { sourceFor } from '../core/ScienceData.js';

/**
 * Interfaz de la Academia SPACE-TECH. Toda la interacción es real: las
 * respuestas se evalúan, el progreso se guarda y el modo cambia las preguntas.
 */
export class AcademyUI {
  constructor(root, academy) {
    this.root = root;
    this.academy = academy;
    this.el = null;
    this.lessonId = ACADEMY_LESSONS[0].id;
    this.activityChoice = null;
    this.questionChoice = null;
    this.feedback = null;
    this.onClose = null;
  }

  get isOpen() {
    return !!this.el && !this.el.classList.contains('hidden');
  }

  open({ lessonId = null, onClose = null } = {}) {
    this.lessonId = lessonId && ACADEMY_LESSONS.some((item) => item.id === lessonId)
      ? lessonId
      : this.lessonId;
    this.onClose = onClose;
    this.activityChoice = null;
    this.questionChoice = null;
    this.feedback = null;
    this._ensure();
    this.render();
    this.el.classList.remove('hidden');
    this.el.setAttribute('aria-hidden', 'false');
    this.el.querySelector('.academy-close')?.focus();
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
    el.id = 'overlay-academy';
    el.className = 'overlay hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Academia SPACE-TECH');
    el.innerHTML = `
      <div class="overlay-card academy-card">
        <header class="overlay-head">
          <div>
            <p class="eyebrow">Academia SPACE-TECH</p>
            <h2 class="title small">Aprende a diseñar misiones</h2>
            <p class="panel-sub academy-progress"></p>
          </div>
          <button class="btn ghost small academy-close" type="button">Cerrar · ESC</button>
        </header>
        <div class="academy-modes" role="group" aria-label="Nivel"></div>
        <div class="academy-layout">
          <nav class="academy-nav" aria-label="Lecciones"></nav>
          <article class="academy-body"></article>
        </div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;

    el.querySelector('.academy-close').addEventListener('click', () => this.close());
    el.addEventListener('click', (event) => {
      if (event.target === el) this.close();
    });

    el.querySelector('.academy-modes').addEventListener('click', (event) => {
      const button = event.target.closest('[data-academy-mode]');
      if (!button) return;
      this.academy.setMode(button.dataset.academyMode);
      this.activityChoice = null;
      this.questionChoice = null;
      this.feedback = null;
      this.render();
    });

    el.querySelector('.academy-nav').addEventListener('click', (event) => {
      const button = event.target.closest('[data-lesson]');
      if (!button) return;
      this.lessonId = button.dataset.lesson;
      this.activityChoice = null;
      this.questionChoice = null;
      this.feedback = null;
      this.render();
    });

    el.addEventListener('click', (event) => {
      const activity = event.target.closest('[data-activity-option]');
      if (activity) {
        this.activityChoice = activity.dataset.activityOption;
        this.feedback = null;
        this.render();
        return;
      }
      const question = event.target.closest('[data-question-option]');
      if (question) {
        this.questionChoice = question.dataset.questionOption;
        this.feedback = null;
        this._evaluate();
        this.render();
        return;
      }
      const next = event.target.closest('[data-next-lesson]');
      if (next) {
        const index = ACADEMY_LESSONS.findIndex((item) => item.id === this.lessonId);
        this.lessonId = ACADEMY_LESSONS[(index + 1) % ACADEMY_LESSONS.length].id;
        this.activityChoice = null;
        this.questionChoice = null;
        this.feedback = null;
        this.render();
      }
    });
  }

  _evaluate() {
    const lesson = ACADEMY_LESSONS.find((item) => item.id === this.lessonId);
    if (!lesson) return;
    const mode = this.academy.mode;
    const question = questionFor(lesson, mode);
    const activityOption = lesson.activity.options.find((item) => item.id === this.activityChoice);
    const questionOption = question.options.find((item) => item.id === this.questionChoice);

    if (!activityOption || !questionOption) return;

    if (activityOption.correct && questionOption.correct) {
      this.academy.complete(lesson.id, mode);
      this.feedback = {
        kind: 'good',
        text: `Lección completada. ${question.explanation}`,
      };
    } else {
      this.feedback = {
        kind: 'bad',
        text: !activityOption.correct
          ? activityOption.feedback || lesson.activity.explanation
          : questionOption.feedback || question.explanation,
      };
    }
  }

  render() {
    if (!this.el) return;
    const mode = this.academy.mode;
    const lesson = ACADEMY_LESSONS.find((item) => item.id === this.lessonId) ?? ACADEMY_LESSONS[0];
    const question = questionFor(lesson, mode);
    const completed = this.academy.isComplete(lesson.id, mode);
    const count = this.academy.count(mode);

    this.el.querySelector('.academy-progress').textContent =
      `Nivel ${ACADEMY_MODES[mode]} · ${count} de ${this.academy.total()} lecciones completadas en este nivel.`;

    this.el.querySelector('.academy-modes').innerHTML = Object.entries(ACADEMY_MODES)
      .map(
        ([id, name]) =>
          `<button type="button" class="quality-btn ${
            mode === id ? 'is-active' : ''
          }" data-academy-mode="${id}" aria-pressed="${mode === id}">${name}</button>`
      )
      .join('');

    this.el.querySelector('.academy-nav').innerHTML = ACADEMY_LESSONS.map((item) => {
      const done = this.academy.isComplete(item.id, mode);
      return `<button type="button" class="academy-tab ${
        item.id === lesson.id ? 'is-active' : ''
      }" data-lesson="${item.id}">
        <span class="academy-num">${String(item.number).padStart(2, '0')}</span>
        <span>${item.title}</span>
        <span class="academy-check ${done ? 'done' : ''}">${done ? '✓' : ''}</span>
      </button>`;
    }).join('');

    const dataHtml = lesson.data.length
      ? `<div class="academy-data">${lesson.data
          .map((item) => {
            const source = sourceFor(item.sourceId);
            return `<div class="academy-datum">
              <span>${item.label}</span>
              <b>${item.value} ${item.unit}</b>
              <small>${source ? `${source.organization} · ${source.title}` : 'Fuente no disponible'}</small>
            </div>`;
          })
          .join('')}</div>`
      : '';

    const activityHtml = lesson.activity.options
      .map((item) => {
        const chosen = this.activityChoice === item.id;
        const stateClass = chosen ? (item.correct ? 'is-correct' : 'is-wrong') : '';
        return `<button type="button" class="quiz-option ${stateClass}" data-activity-option="${item.id}">
          <span>${item.text}</span>
          ${chosen ? `<small>${item.feedback}</small>` : ''}
        </button>`;
      })
      .join('');

    const questionHtml = question.options
      .map((item) => {
        const chosen = this.questionChoice === item.id;
        const correct = item.id === question.correct;
        const stateClass = chosen ? (correct ? 'is-correct' : 'is-wrong') : '';
        return `<button type="button" class="quiz-option ${stateClass}" data-question-option="${item.id}">
          <span>${item.text}</span>
        </button>`;
      })
      .join('');

    this.el.querySelector('.academy-body').innerHTML = `
      <p class="eyebrow">Lección ${String(lesson.number).padStart(2, '0')} · ${
        lesson.level === 'both' ? 'Todos los niveles' : lesson.level
      }</p>
      <h3>${lesson.title}</h3>
      <p class="academy-summary">${lesson.summary}</p>
      <div class="academy-figure">${illustrationSvg(lesson.illustration)}</div>
      ${dataHtml}
      <h4>Actividad interactiva</h4>
      <p>${lesson.activity.prompt}</p>
      <div class="quiz-options">${activityHtml}</div>
      <h4>Pregunta de comprobación</h4>
      <p>${question.prompt}</p>
      <div class="quiz-options">${questionHtml}</div>
      ${
        this.feedback
          ? `<div class="academy-feedback ${this.feedback.kind}">${this.feedback.text}</div>`
          : ''
      }
      ${
        completed
          ? `<p class="academy-done">✓ Lección completada en nivel ${ACADEMY_MODES[mode]}.</p>`
          : '<p class="manual-note">Responde correctamente la actividad y la pregunta para completar la lección.</p>'
      }
      <div class="actions">
        <button type="button" class="btn ghost" data-next-lesson>Siguiente lección</button>
      </div>
    `;
  }
}
