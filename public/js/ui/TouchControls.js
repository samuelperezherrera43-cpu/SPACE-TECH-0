/**
 * Controles táctiles para móvil y tableta.
 *
 * No duplica la simulación ni el bucle del juego: sólo escribe en el estado
 * `controls.touch` (movimiento, propulsores, reparación e interacción) y en
 * `controls.mouse` (delta de cámara), que ya consumen Player y Camera.
 *
 * En escritorio el módulo queda desactivado: `enabled === false` y el overlay
 * permanece oculto, por lo que no altera la entrada de teclado/ratón.
 */

const TOUCH_QUERY = '(pointer: coarse)';
const STICK_DEADZONE = 0.14;
const LOOK_SCALE = 1.45;

export class TouchControls {
  constructor(root, controls) {
    this.root = root;
    this.controls = controls;
    this.el = root.querySelector('#touch-controls');

    // `pointer: coarse` cubre móviles/tabletas. El respaldo por maxTouchPoints
    // exige que no exista un puntero fino, para no desactivar el ratón en
    // portátiles con pantalla táctil.
    const media = window.matchMedia ? window.matchMedia.bind(window) : null;
    const coarsePointer = media ? media(TOUCH_QUERY).matches : false;
    const finePointer = media ? media('(any-pointer: fine)').matches : false;
    const touchOnly = !finePointer && (navigator.maxTouchPoints || 0) > 0;

    this.coarse = window.SPACE_TECH_TOUCH === true || coarsePointer || touchOnly;
    this.enabled = this.coarse && !!this.el;

    this.visible = false;
    this.toolIndex = 0;
    this.onPause = null;
    this.onTool = null;

    this.stick = this.el ? this.el.querySelector('#touch-stick') : null;
    this.knob = this.el ? this.el.querySelector('#touch-knob') : null;
    this.lookZone = this.el ? this.el.querySelector('#touch-look') : null;
    this.toolLabel = this.el ? this.el.querySelector('#touch-tool-label') : null;

    this.stickPointer = null;
    this.lookPointer = null;
    this.stickCenter = { x: 0, y: 0 };
    this.lookLast = { x: 0, y: 0 };
    this.radius = 56;

    if (!this.enabled) {
      this.el?.classList.add('hidden');
      return;
    }

    this.controls.coarsePointer = true;
    document.body.classList.add('touch-input');
    this.el.classList.add('hidden');
    this.el.setAttribute('aria-hidden', 'true');

    this._bindStick();
    this._bindLook();
    this._bindButtons();
  }

  /** Muestra u oculta el overlay según el estado real de la partida. */
  sync(visible, toolIndex = null) {
    if (!this.enabled) return;

    const show = !!visible;
    if (show !== this.visible) {
      this.visible = show;
      this.el.classList.toggle('hidden', !show);
      this.el.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (!show) this.releaseAll();
    }

    if (toolIndex != null && toolIndex !== this.toolIndex) {
      this.toolIndex = toolIndex;
      if (this.toolLabel) this.toolLabel.textContent = `HERRAMIENTA ${toolIndex + 1}`;
    }
  }

  /** Suelta todos los dedos activos (pausa, cambio de pantalla, blur). */
  releaseAll() {
    if (!this.enabled) return;

    this.stickPointer = null;
    this.lookPointer = null;

    const touch = this.controls.touch;
    touch.moveX = 0;
    touch.moveY = 0;
    touch.moveZ = 0;
    touch.boost = false;
    touch.repair = false;
    touch.interact = false;

    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
    for (const button of this.el.querySelectorAll('.touch-btn')) {
      button.classList.remove('is-pressed');
    }
  }

  dispose() {
    if (!this.enabled) return;
    this.releaseAll();
    document.body.classList.remove('touch-input');
  }

  /* ------------------------------------------------------------------ stick */

  _bindStick() {
    const stick = this.stick;
    if (!stick) return;

    stick.addEventListener('pointerdown', (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      this.stickPointer = event.pointerId;
      try { stick.setPointerCapture(event.pointerId); } catch { /* opcional */ }

      const rect = stick.getBoundingClientRect();
      this.stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.radius = Math.max(36, rect.width * 0.42);
      this._moveStick(event.clientX, event.clientY);
    });

    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.stickPointer) return;
      event.preventDefault();
      this._moveStick(event.clientX, event.clientY);
    });

    const end = (event) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.controls.touch.moveX = 0;
      this.controls.touch.moveZ = 0;
      if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
    };

    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    stick.addEventListener('lostpointercapture', end);
  }

  _moveStick(clientX, clientY) {
    const dx = clientX - this.stickCenter.x;
    const dy = clientY - this.stickCenter.y;
    const length = Math.hypot(dx, dy);

    let nx = 0;
    let ny = 0;
    if (length > 0.001) {
      const clamped = Math.min(length, this.radius) / this.radius;
      nx = (dx / length) * clamped;
      ny = (dy / length) * clamped;
    }

    const apply = (value) => {
      const magnitude = Math.abs(value);
      if (magnitude < STICK_DEADZONE) return 0;
      return (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE) * Math.sign(value);
    };

    this.controls.touch.moveX = apply(nx);
    this.controls.touch.moveZ = -apply(ny);

    if (this.knob) {
      this.knob.style.transform =
        `translate(calc(-50% + ${(nx * this.radius).toFixed(1)}px), ` +
        `calc(-50% + ${(ny * this.radius).toFixed(1)}px))`;
    }
  }

  /* ------------------------------------------------------------------- look */

  _bindLook() {
    const zone = this.lookZone;
    if (!zone) return;

    zone.addEventListener('pointerdown', (event) => {
      if (this.lookPointer !== null) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      try { zone.setPointerCapture(event.pointerId); } catch { /* opcional */ }
      this.lookLast = { x: event.clientX, y: event.clientY };
    });

    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer) return;
      event.preventDefault();

      const dx = event.clientX - this.lookLast.x;
      const dy = event.clientY - this.lookLast.y;
      this.lookLast = { x: event.clientX, y: event.clientY };

      // Mismo acumulador que el ratón: Camera.rotate aplica la sensibilidad.
      this.controls.mouse.dx += dx * LOOK_SCALE;
      this.controls.mouse.dy += dy * LOOK_SCALE;
    });

    const end = (event) => {
      if (event.pointerId !== this.lookPointer) return;
      this.lookPointer = null;
    };

    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  /* ---------------------------------------------------------------- botones */

  _bindButtons() {
    if (!this.el) return;

    for (const button of this.el.querySelectorAll('[data-touch]')) {
      const action = button.dataset.touch;

      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.classList.add('is-pressed');
        try { button.setPointerCapture(event.pointerId); } catch { /* opcional */ }
        this._press(action);
      });

      const release = (event) => {
        if (event) event.preventDefault();
        button.classList.remove('is-pressed');
        this._release(action);
      };

      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    window.addEventListener('blur', () => this.releaseAll());
  }

  _press(action) {
    const touch = this.controls.touch;

    switch (action) {
      case 'jump':
        touch.moveY = 1;
        break;
      case 'boost':
        touch.boost = true;
        break;
      case 'repair':
        touch.repair = true;
        // Un toque también dispara la herramienta (escaneo, soldadura, etc.).
        this.controls.clicked = true;
        break;
      case 'interact':
        touch.interact = true;
        this.controls.interactPressed = true;
        break;
      case 'tool':
        this.onTool?.();
        break;
      case 'pause':
        this.onPause?.();
        break;
      default:
        break;
    }
  }

  _release(action) {
    const touch = this.controls.touch;

    switch (action) {
      case 'jump':
        touch.moveY = 0;
        break;
      case 'boost':
        touch.boost = false;
        break;
      case 'repair':
        touch.repair = false;
        break;
      case 'interact':
        touch.interact = false;
        break;
      default:
        break;
    }
  }
}
