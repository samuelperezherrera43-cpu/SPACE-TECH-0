/**
 * Entrada unificada: teclado, ratón con Pointer Lock y gamepad estándar.
 * No toca el DOM del HUD; sólo expone estado y callbacks.
 */
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.locked = false;
    this.sensitivity = 0.0024;

    this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false };
    this.clicked = false;
    this.interactPressed = false;
    this.interactPrev = false;

    this.pad = {
      moveX: 0, moveY: 0, moveZ: 0,
      lookX: 0, lookY: 0,
      boost: false, repair: false, interact: false,
    };
    this.padRepairPrev = false;
    this.padInteractPrev = false;
    this.padConnected = false;

    this.onTool = null;
    this.onLockChange = null;

    this._bind();
  }

  /* ---------------------------------------------------------------- teclado */

  down(code) {
    return this.keys.has(code);
  }

  _bind() {
    const canvas = this.canvas;

    window.addEventListener('keydown', (event) => {
      const code = event.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        event.preventDefault();
      }
      if (event.repeat) return;

      this.keys.add(code);

      if (code === 'KeyE') this.interactPressed = true;

      if (code === 'Digit1' || code === 'Numpad1') this.onTool?.(0);
      if (code === 'Digit2' || code === 'Numpad2') this.onTool?.(1);
      if (code === 'Digit3' || code === 'Numpad3') this.onTool?.(2);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (event) => {
      if (!this.locked) {
        this.requestLock();
        return;
      }
      if (event.button === 0) {
        this.mouse.left = true;
        this.clicked = true;
      }
      if (event.button === 2) this.mouse.right = true;
    });

    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.left = false;
      if (event.button === 2) this.mouse.right = false;
    });

    window.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.mouse.dx += event.movementX || 0;
      this.mouse.dy += event.movementY || 0;
    });

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.mouse.wheel += event.deltaY;
    }, { passive: false });

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouse.left = false;
      this.onLockChange?.(this.locked);
    });

    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      this.onLockChange?.(false);
    });
  }

  requestLock() {
    if (this.locked) return;
    const promise = this.canvas.requestPointerLock?.();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  /* ---------------------------------------------------------------- lectura */

  get move() {
    let x = 0;
    let y = 0;
    let z = 0;

    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('Space')) y += 1;
    if (this.down('ControlLeft') || this.down('ControlRight') || this.down('KeyC')) y -= 1;

    x += this.pad.moveX;
    y += this.pad.moveY;
    z += this.pad.moveZ;

    return {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
      z: Math.max(-1, Math.min(1, z)),
    };
  }

  get boost() {
    return this.down('ShiftLeft') || this.down('ShiftRight') || this.pad.boost;
  }

  get repairHeld() {
    return this.mouse.left || this.pad.repair;
  }

  get interactHeld() {
    return this.down('KeyE') || this.pad.interact;
  }

  consumeInteract() {
    const value = this.interactPressed;
    this.interactPressed = false;
    return value;
  }

  consumeClick() {
    const value = this.clicked;
    this.clicked = false;
    return value;
  }

  consumeMouse() {
    const dx = this.mouse.dx;
    const dy = this.mouse.dy;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return { dx, dy };
  }

  consumeWheel() {
    const wheel = this.mouse.wheel;
    this.mouse.wheel = 0;
    return wheel;
  }

  /* ---------------------------------------------------------------- gamepad */

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;

    let gp = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    }

    if (!gp) {
      this.padConnected = false;
      this.pad.moveX = this.pad.moveY = this.pad.moveZ = 0;
      this.pad.lookX = this.pad.lookY = 0;
      this.pad.boost = false;
      this.pad.repair = false;
      this.pad.interact = false;
      return;
    }

    this.padConnected = true;
    const dead = (value) => {
      const v = value || 0;
      return Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84;
    };

    this.pad.moveX = dead(gp.axes[0]);
    this.pad.moveZ = -dead(gp.axes[1]);
    this.pad.lookX = dead(gp.axes[2]);
    this.pad.lookY = dead(gp.axes[3]);

    const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
    const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
    this.pad.moveY = (rt || 0) - (lt || 0);

    this.pad.boost = !!gp.buttons[10]?.pressed;

    const repair = !!gp.buttons[0]?.pressed;
    if (repair && !this.padRepairPrev) this.clicked = true;
    this.padRepairPrev = repair;
    this.pad.repair = repair;

    const interact = !!gp.buttons[2]?.pressed;
    if (interact && !this.padInteractPrev) this.interactPressed = true;
    this.padInteractPrev = interact;
    this.pad.interact = interact;

    // El stick derecho alimenta el mismo delta que el ratón.
    if (this.pad.lookX) this.mouse.dx += this.pad.lookX * 15;
    if (this.pad.lookY) this.mouse.dy += this.pad.lookY * 11;
  }
}
