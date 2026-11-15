/**
 * Smoke test con Chrome real (headless) usando puppeteer-core.
 * Requiere Chrome instalado. Uso: npm run smoke
 */
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const SHOTS = '.smoke';
mkdirSync(SHOTS, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!executablePath) {
  console.error('No se encontró Chrome. Define CHROME_PATH.');
  process.exit(1);
}

const PORT = 5199;
const server = spawn(process.execPath, ['scripts/dev.mjs'], {
  env: { ...process.env, PORT: String(PORT), LIVE_RELOAD: '0' },
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser;
let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

try {
  await sleep(900);

  browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1280,800',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  const requests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('request', (request) => requests.push(request.url()));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => !!window.__orbital, { timeout: 15000 });

  await page.screenshot({ path: `${SHOTS}/entry.png` });

  /* ------------------------------------------------ Prompt 3.7: entrada */

  const entry = await page.evaluate(() => {
    const game = window.__orbital;
    const screen = document.querySelector('#screen-entry');
    return {
      state: game.state,
      visible: screen && !screen.classList.contains('hidden'),
      title: document.querySelector('#screen-entry .entry-title')?.textContent ?? '',
      enter: !!document.querySelector('#btn-enter'),
      qualityButtons: document.querySelectorAll('[data-quality]').length,
      // El aviso legal menciona NASA; el requisito prohíbe logotipos e imágenes.
      nasaLogo:
        !!document.querySelector('#screen-entry img') ||
        !!document.querySelector('#screen-entry [class*="logo"]'),
    };
  });
  check('pantalla de entrada visible', entry.visible);
  check('estado inicial "entry"', entry.state === 'entry', entry.state);
  check('título SPACE-TECH', entry.title.includes('SPACE-TECH'));
  check('subtítulo del simulador', entry.title.includes('SIMULADOR INTERACTIVO DE MISIONES ESPACIALES'));
  check('botón ENTRAR', entry.enter);
  check('sin selector de calidad visible', entry.qualityButtons === 0);
  check('sin logotipo NASA en la entrada', entry.nasaLogo === false);

  await page.click('#btn-enter');
  await sleep(500);

  const menu = await page.evaluate(() => {
    const game = window.__orbital;
    const screen = document.querySelector('#screen-menu');
    const ids = [
      'btn-menu-new',
      'btn-menu-continue',
      'btn-menu-design',
      'btn-menu-academy',
      'btn-menu-data',
      'btn-menu-manual',
      'btn-menu-settings',
    ];
    return {
      state: game.state,
      visible: screen && !screen.classList.contains('hidden'),
      options: ids.filter((id) => document.querySelector(`#${id}`)).length,
      continueHidden: document.querySelector('#btn-menu-continue')?.classList.contains('hidden'),
    };
  });
  check('botón ENTRAR abre el menú', menu.state === 'menu' && menu.visible, menu.state);
  check('menú principal con 7 opciones reales', menu.options === 7, String(menu.options));
  check('CONTINUAR oculto sin partida guardada', menu.continueHidden === true);

  // Manual desde el menú.
  await page.click('#btn-menu-manual');
  await sleep(350);
  const menuManual = await page.evaluate(() => {
    const overlay = document.querySelector('#overlay-manual');
    return {
      open: overlay && !overlay.classList.contains('hidden'),
      sections: overlay?.querySelectorAll('[data-manual-section]').length ?? 0,
      hasControls: /W/.test(overlay?.textContent ?? '') && /ESC/i.test(overlay?.textContent ?? ''),
    };
  });
  check('manual accesible desde el menú', menuManual.open);
  check('manual con secciones', menuManual.sections >= 8, String(menuManual.sections));
  check('manual documenta controles reales', menuManual.hasControls);

  await page.keyboard.press('Escape');
  await sleep(300);
  const manualClosed = await page.evaluate(() => {
    const overlay = document.querySelector('#overlay-manual');
    return {
      closed: overlay.classList.contains('hidden'),
      state: window.__orbital.state,
      menuVisible: !document.querySelector('#screen-menu').classList.contains('hidden'),
    };
  });
  check('cerrar manual vuelve al menú', manualClosed.closed && manualClosed.state === 'menu' && manualClosed.menuVisible);

  // Academia desde el menú.
  await page.click('#btn-menu-academy');
  await sleep(350);
  const academyMenu = await page.evaluate(() => {
    const overlay = document.querySelector('#overlay-academy');
    return {
      open: overlay && !overlay.classList.contains('hidden'),
      lessons: overlay?.querySelectorAll('[data-lesson]').length ?? 0,
      modes: overlay?.querySelectorAll('[data-academy-mode]').length ?? 0,
    };
  });
  check('Academia abre desde el menú', academyMenu.open);
  check('Academia con 10 lecciones', academyMenu.lessons === 10, String(academyMenu.lessons));
  check('Academia con modos principiante y avanzado', academyMenu.modes === 2, String(academyMenu.modes));
  await page.keyboard.press('Escape');
  await sleep(250);

  // Centro de datos.
  await page.click('#btn-menu-data');
  await sleep(350);
  const dataMenu = await page.evaluate(() => {
    const overlay = document.querySelector('#overlay-data');
    const text = overlay?.textContent ?? '';
    return {
      open: overlay && !overlay.classList.contains('hidden'),
      tabs: overlay?.querySelectorAll('[data-data-tab]').length ?? 0,
      disclaimer: text.includes('No está patrocinado, aprobado ni respaldado por NASA'),
      sources: text.includes('nssdc.gsfc.nasa.gov') || text.includes('NASA NSSDCA'),
    };
  });
  check('Centro de datos abre desde el menú', dataMenu.open);
  check('Centro de datos con pestañas', dataMenu.tabs >= 5, String(dataMenu.tabs));
  check('aviso de independencia visible', dataMenu.disclaimer);
  check('fuentes científicas citadas', dataMenu.sources);
  await page.keyboard.press('Escape');
  await sleep(250);

  // Mesa de diseño.
  await page.click('#btn-menu-design');
  await sleep(350);
  const designMenu = await page.evaluate(() => {
    const overlay = document.querySelector('#overlay-design');
    return {
      open: overlay && !overlay.classList.contains('hidden'),
      phases: overlay?.querySelectorAll('[data-design-phase]').length ?? 0,
      segments: overlay?.textContent.includes('Launch Segment') && overlay?.textContent.includes('User Segment'),
    };
  });
  check('mesa de diseño abre desde el menú', designMenu.open);
  check('diseño con seis fases', designMenu.phases === 6, String(designMenu.phases));
  check('diseño explica los cuatro segmentos', designMenu.segments === true);
  await page.keyboard.press('Escape');
  await sleep(250);

  await page.click('#btn-menu-new');
  await sleep(1400);

  const initial = await page.evaluate(() => {
    const game = window.__orbital;
    return {
      state: game.state,
      o2: game.player.o2,
      energy: game.player.energy,
      active: game.station.active.length,
      mission: game.missions.activeId,
      guided: game.guided,
      guideVisible: !document.querySelector('#guide')?.classList.contains('hidden'),
      position: game.player.group.position.toArray(),
      camera: game.camera.position.toArray(),
      calls: game.renderer.info.render.calls,
      triangles: game.renderer.info.render.triangles,
      hudVisible: !document.querySelector('#hud').classList.contains('hidden'),
    };
  });

  check('estado "playing"', initial.state === 'playing', initial.state);
  check('3 fugas activas', initial.active === 3, String(initial.active));
  check('nueva partida sin misión automática', initial.mission === null, String(initial.mission));
  check('experiencia guiada activa', initial.guided === true && initial.guideVisible === true);
  check('HUD visible', initial.hudVisible);
  check('jugador en escena', initial.position.some((v) => Math.abs(v) > 1), JSON.stringify(initial.position));
  check('render activo', initial.calls > 0, `${initial.calls} draw calls`);

  console.log(`  info draw calls: ${initial.calls} · triángulos: ${initial.triangles}`);

  /* --------------------------------------------------- interior habitable */

  await page.evaluate(async () => {
    await window.__orbital.interior.ready;
  });

  const interior = await page.evaluate(() => {
    const game = window.__orbital;
    return {
      loaded: game.interior.loaded,
      modules: game.interior.stats.modules,
      colliders: game.interior.stats.colliders,
      doors: game.interior.stats.doors,
    };
  });

  check('interior GLB cargado', interior.loaded);
  check('17 módulos transitables', interior.modules === 17, String(interior.modules));
  check('colisionadores creados', interior.colliders > 200, String(interior.colliders));
  check('19 compuertas', interior.doors === 19, String(interior.doors));

  // La tecla E real llega al sistema de entrada (mismo flag que consume Game).
  const keyWiring = await page.evaluate(() => {
    const game = window.__orbital;
    game.controls.interactPressed = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    const pressed = game.controls.interactPressed;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    game.controls.interactPressed = false;
    return pressed;
  });
  check('la tecla E llega a Controls', keyWiring === true);

  // Cambio de dificultad en caliente y vuelta a Exploración.
  const difficulty = await page.evaluate(() => {
    const game = window.__orbital;
    const before = game.balance.id;
    game.balance.set('challenge');
    const drain = game.balance.values.o2Drain;
    const tether = game.tether.max;
    game.balance.set('exploration');
    return { before, drain, tether, after: game.balance.id, restored: game.tether.max };
  });
  check(
    'la dificultad cambia consumos y cable',
    difficulty.before === 'exploration' &&
      difficulty.drain > 0.8 &&
      difficulty.tether === 24 &&
      difficulty.after === 'exploration' &&
      difficulty.restored === 32,
    JSON.stringify(difficulty)
  );

  // Entrada: la compuerta exterior sólo se abre con E.
  const approach = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 6.9);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);

    const action = game.interior.getAirlockAction(game.player.group.position);
    game.controls.interactPressed = true;
    game.update(1 / 60);
    for (let i = 0; i < 60; i++) game.update(1 / 60);

    const outer = game.interior.doors.find((door) => door.id === 'airlock_outer');
    return {
      action,
      outer: outer.progress,
      phase: game.interior.airlock.phase,
      prompt: document.querySelector('#prompt-label').textContent,
    };
  });
  check(
    'esclusa: E abre la compuerta exterior',
    approach.action?.type === 'enter' && approach.outer > 0.8,
    JSON.stringify(approach)
  );

  // Dentro de la esclusa: cierra exterior, presuriza y abre interior.
  const cycle = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 4.1);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 150; i++) game.update(1 / 60);

    const outer = game.interior.doors.find((door) => door.id === 'airlock_outer');
    const inner = game.interior.doors.find((door) => door.id === 'airlock_inner');
    return {
      outer: outer.progress,
      inner: inner.progress,
      phase: game.interior.airlock.phase,
      pressure: game.interior.airlock.pressure,
    };
  });
  check('esclusa: exterior cierra', cycle.outer < 0.2, String(cycle.outer));
  check(
    'esclusa: presuriza y abre interior',
    cycle.inner > 0.8 && cycle.pressure > 0.9,
    JSON.stringify(cycle)
  );

  // Al pasillo: se cierra la interior y el jugador queda dentro.
  const inside = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 0);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 90; i++) game.update(1 / 60);

    const inner = game.interior.doors.find((door) => door.id === 'airlock_inner');
    return {
      inner: inner.progress,
      phase: game.interior.airlock.phase,
      inside: game.player.inside,
      safe: game.player.safe,
      state: game.state,
      position: game.player.group.position.toArray(),
    };
  });
  check('esclusa: interior cierra tras entrar', inside.inner < 0.2, String(inside.inner));
  check('jugador dentro, a salvo y misión intacta', inside.inside && inside.safe && inside.state === 'playing');
  check('posición conservada (sin teleport)', Math.abs(inside.position[2]) < 0.4, JSON.stringify(inside.position));

  // Traje obligatorio: sin traje la esclusa bloquea la salida.
  const suitGate = await page.evaluate(() => {
    const game = window.__orbital;
    game.suit.equipped = false;
    game.player.body.position.set(0, -8.8, 1.9);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.updateHUD();
    const hudState = document.querySelector('#suit-state').textContent;
    const action = game.interior.getAirlockAction(game.player.group.position);
    game.controls.interactPressed = true;
    game.update(1 / 60);
    const toast = document.querySelector('#toast').textContent;
    const phase = game.interior.airlock.phase;
    game.suit.equipped = true;
    game.updateHUD();
    return { hudState, action: action?.type ?? null, toast, phase };
  });
  check('HUD muestra el traje guardado', suitGate.hudState === 'GUARDADO', suitGate.hudState);
  check(
    'sin traje la esclusa bloquea la salida',
    suitGate.action === 'exit' &&
      suitGate.phase === 'sealed' &&
      suitGate.toast.includes('NO PUEDES SALIR SIN TRAJE ESPACIAL.'),
    JSON.stringify(suitGate)
  );

  // Salida: E en la compuerta interior, despresurizar y abrir exterior.
  const exitStart = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 1.9);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    const action = game.interior.getAirlockAction(game.player.group.position);
    game.controls.interactPressed = true;
    game.update(1 / 60);
    for (let i = 0; i < 45; i++) game.update(1 / 60);
    return { action, phase: game.interior.airlock.phase };
  });
  check(
    'esclusa: E abre la compuerta interior',
    exitStart.action?.type === 'exit' && exitStart.phase === 'innerOpen',
    JSON.stringify(exitStart)
  );

  const exitCycle = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 3.4);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 180; i++) game.update(1 / 60);
    const outer = game.interior.doors.find((door) => door.id === 'airlock_outer');
    return {
      outer: outer.progress,
      phase: game.interior.airlock.phase,
      pressure: game.interior.airlock.pressure,
    };
  });
  check(
    'esclusa: despresuriza y abre al exterior',
    exitCycle.outer > 0.8 && exitCycle.pressure < 0.1,
    JSON.stringify(exitCycle)
  );

  const exited = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 6.9);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 120; i++) game.update(1 / 60);
    return {
      phase: game.interior.airlock.phase,
      pressure: game.interior.airlock.pressure,
      tether: game.tether.status,
      safe: game.player.safe,
    };
  });
  check('esclusa: queda en vacío tras salir', exited.phase === 'vacuum' && exited.pressure < 0.1, JSON.stringify(exited));
  check('cable EVA conectado automáticamente', exited.tether.active && exited.tether.distance > 0, JSON.stringify(exited.tether));
  await page.screenshot({ path: `${SHOTS}/eva.png` });

  // Puerta automática del centro de operaciones.
  const autoDoor = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0.7, -8.8, -1.5);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 45; i++) game.update(1 / 60);
    const door = game.interior.doors.find((item) => item.id === 'ops');
    return door.progress;
  });
  check('puerta de operaciones automática', autoDoor > 0.6, String(autoDoor));

  // Colisión: empuje lateral contra la pared este del pasillo.
  const wall = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, 0);
    game.player.body.velocity.set(8, 0, 0);
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    return game.player.group.position.toArray();
  });
  check('pared del pasillo bloquea al jugador', wall[0] < 1.25, JSON.stringify(wall));

  // Salas nuevas: transitables, con modo a pie y altura de cámara correcta.
  const expansion = await page.evaluate(() => {
    const game = window.__orbital;
    const rooms = {
      hangar_link: [9.5, 0],
      hangar: [20, -3],
      medbay: [-11.75, -1.5],
      dorms: [-11.75, 4.5],
      mess: [-18, 1.5],
      evaprep: [-5.15, 4.2],
      northlink: [6, -11.5],
      engineering: [4.5, -18.5],
      power: [-4.5, -18.5],
      life: [12.5, -18.5],
      workshop: [20, -18.5],
    };
    const results = {};
    for (const [id, [x, z]] of Object.entries(rooms)) {
      game.player.body.position.set(x, -9.95, z);
      game.player.body.velocity.setZero();
      game.player.sync(0.016, game.camera);
      game.update(1 / 60);
      const module = game.interior.getModuleAt(game.player.group.position);
      results[id] = {
        contains: game.interior.contains(game.player.group.position),
        module: module?.id ?? null,
        mode: game.player.mode,
        floor: game.cameraRig.floor,
        ceil: game.cameraRig.ceil,
      };
    }
    return results;
  });
  const badRooms = Object.entries(expansion).filter(
    ([id, room]) => !room.contains || room.module !== id || room.mode !== 'walk' || room.floor !== -10.4
  );
  check('11 salas nuevas transitables a pie', badRooms.length === 0, JSON.stringify(badRooms));
  check(
    'el hangar usa su techo alto y las salas el normal',
    expansion.hangar.ceil === -5.6 && expansion.medbay.ceil === -7.6,
    JSON.stringify({ hangar: expansion.hangar.ceil, medbay: expansion.medbay.ceil })
  );

  // Locomoción a pie: gravedad, apoyo en el suelo y salto.
  const walk = await page.evaluate(() => {
    const game = window.__orbital;
    // Punto libre del hangar, lejos de la nave aparcada en (20, -3).
    game.player.body.position.set(25, -9.0, -8);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    const landedY = game.player.body.position.y;
    const grounded = game.player.grounded;
    game.player.body.position.y = -9.95;
    game.player.grounded = true;
    game.player.jumpCooldown = 0;
    game.player.update(1 / 60, { x: 0, y: 1, z: 0 }, game.camera, false);
    return {
      mode: game.player.mode,
      landedY,
      grounded,
      jumpVy: game.player.body.velocity.y,
    };
  });
  check(
    'modo a pie con gravedad y salto',
    walk.mode === 'walk' &&
      Math.abs(walk.landedY + 9.6) < 0.06 &&
      walk.grounded &&
      walk.jumpVy > 2,
    JSON.stringify(walk)
  );

  // Colisión real contra las paredes este y oeste del hangar.
  const hangarWall = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(29.3, -9.95, -3);
    game.player.body.velocity.set(9, 0, 0);
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    const east = game.player.body.position.x;

    game.player.body.position.set(11.2, -9.95, -3);
    game.player.body.velocity.set(-9, 0, 0);
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    const west = game.player.body.position.x;
    return { east, west };
  });
  check(
    'paredes del hangar bloquean sin atravesar',
    hangarWall.east < 29.6 && hangarWall.west > 10.85,
    JSON.stringify(hangarWall)
  );

  // Captura del interior (cabina, ventanas y consola).
  await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, -11.2);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.cameraRig.yaw = 0;
    game.cameraRig.pitch = 0.12;
    game.cameraRig.distance = 4.6;
    game.cameraRig.targetDistance = 4.6;
    game.cameraRig.snap(game.player.group.position);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
  });
  await page.screenshot({ path: `${SHOTS}/interior.png` });
  console.log('  Captura del interior guardada.');

  // Captura del pasillo (puertas automáticas, tiras de luz y escala).
  await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, -3.2);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.cameraRig.yaw = 0;
    game.cameraRig.pitch = 0.1;
    game.cameraRig.distance = 4.2;
    game.cameraRig.targetDistance = 4.2;
    game.cameraRig.snap(game.player.group.position);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
  });
  await page.screenshot({ path: `${SHOTS}/interior-corridor.png` });
  console.log('  Captura del pasillo guardada.');

  /* ------------------------------------------------------ reparación EVA */

  // Colocar al jugador junto a la primera fuga, apuntar la cámara y reparar.
  const target = await page.evaluate(() => {
    const game = window.__orbital;
    const breach = game.station.active[0];
    const normal = breach.normal;

    const position = breach.position.clone().addScaledVector(normal, 2.5);
    game.player.body.position.set(position.x, position.y, position.z);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);

    game.selectTool(breach.type === 'hull' ? 0 : 1);

    // Congelar la cámara y mirar directamente a la fuga desde un ángulo
    // lateral: el rayo central debe entrar en su esfera de impacto.
    game.cameraRig.update = () => {};

    const tangent = breach.normal.clone().set(1, 0, 0);
    if (Math.abs(tangent.dot(normal)) > 0.9) tangent.set(0, 0, 1);
    tangent.cross(normal).normalize();

    const camPos = breach.position.clone()
      .addScaledVector(normal, 1.6)
      .addScaledVector(tangent, 2.2);

    game.camera.position.copy(camPos);
    game.camera.lookAt(breach.position);
    game.camera.updateMatrixWorld(true);

    game.controls.mouse.left = true;

    return {
      id: breach.id,
      type: breach.type,
      progress: breach.progress,
      camera: camPos.toArray(),
      breach: breach.position.toArray(),
      found: game.findTarget()?.id ?? null,
    };
  });

  console.log('  info objetivo:', JSON.stringify(target));

  // Avance determinista: 2 s de simulación sin depender del framerate.
  await page.evaluate(() => {
    const game = window.__orbital;
    for (let i = 0; i < 120; i++) game.update(1 / 60);
  });
  const aimed = await page.evaluate(() => {
    const game = window.__orbital;
    const breach = game.station.active[0];
    return {
      found: !!game.findTarget(),
      progress: breach ? breach.progress : 1,
      prompt: document.querySelector('#prompt-label').textContent,
    };
  });

  check('objetivo apuntado con el raycast', aimed.found, aimed.prompt);
  check('progreso de reparación avanza', aimed.progress > 0.05, String(aimed.progress));

  // El renderizado por software del CI va lento: acelerar el último tramo
  // para validar la finalización sin depender del framerate.
  await page.evaluate((id) => {
    const game = window.__orbital;
    const breach = game.station.points.find((point) => point.id === id);
    if (breach) breach.progress = 0.97;
    // 0.5 s de simulación: suficiente para cerrar el 3 % restante.
    for (let i = 0; i < 30; i++) game.update(1 / 60);
  }, target.id);

  const repaired = await page.evaluate(() => {
    const game = window.__orbital;
    game.controls.mouse.left = false;
    return {
      repaired: game.station.repairedCount,
      active: game.station.active.length,
      integrity: game.integrity,
      toast: document.querySelector('#toast').textContent,
    };
  });

  check('fuga reparada', repaired.repaired >= 1, String(repaired.repaired));
  check('integridad recompensada', repaired.integrity > 95, String(repaired.integrity));
  check('nueva fuga generada', repaired.active >= 2, String(repaired.active));

  // Escáner
  const scan = await page.evaluate(() => {
    const game = window.__orbital;
    game.selectTool(2);
    game.scanCooldown = 0;
    game.scan();
    return { reveal: game.revealUntil > game.time, cooldown: game.scanCooldown };
  });
  check('escáner activa la revelación', scan.reveal && scan.cooldown > 0);

  // Puerto de oxígeno
  await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(
      game.station.o2Port.x,
      game.station.o2Port.y,
      game.station.o2Port.z + 1.2
    );
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.player.o2 = 40;
    // 3 s de simulación: 20 %/s de recarga.
    for (let i = 0; i < 180; i++) game.update(1 / 60);
  });
  const refilled = await page.evaluate(() => window.__orbital.player.o2);
  check('el puerto recarga oxígeno', refilled > 50, `40 → ${refilled.toFixed(1)}`);

  // Movimiento con propulsores en espacio libre (dentro del radio del cable)
  const before = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, 6, 30);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.cameraRig.yaw = Math.PI;
    game.cameraRig.pitch = 0.12;
    game.cameraRig.distance = 6.2;
    game.cameraRig.targetDistance = 6.2;
    game.cameraRig.snap(game.player.group.position);
    return game.player.group.position.toArray();
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.evaluate(() => {
    const game = window.__orbital;
    // 1 s de simulación con los propulsores activos.
    for (let i = 0; i < 60; i++) game.update(1 / 60);
  });
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  const after = await page.evaluate(() => ({
    position: window.__orbital.player.group.position.toArray(),
    energy: window.__orbital.player.energy,
    o2: window.__orbital.player.o2,
  }));

  const moved = Math.hypot(
    after.position[0] - before[0],
    after.position[1] - before[1],
    after.position[2] - before[2]
  );
  check('los propulsores mueven al jugador', moved > 0.5, `Δ=${moved.toFixed(2)}m`);
  check('el propulsor consume energía', after.energy < 100, String(after.energy));

  // Recursos: O2 lento, casco sin desgaste por tiempo y RCS quieto.
  const resources = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, 6, 30);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.player.o2 = 100;
    game.player.hull = 100;
    game.player.energy = 50;
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    return {
      o2: game.player.o2,
      hull: game.player.hull,
      energy: game.player.energy,
      safe: game.player.safe,
      difficulty: game.balance.id,
    };
  });
  check(
    'O2 se consume lentamente (Exploración)',
    !resources.safe && resources.o2 < 100 && resources.o2 > 99.5,
    JSON.stringify(resources)
  );
  check('el casco no pierde integridad por tiempo', resources.hull === 100, String(resources.hull));
  check('RCS no consume si no se propulsa', resources.energy === 50, String(resources.energy));

  // Cable: se tensa al superar la distancia máxima y frena al jugador.
  const tetherLimit = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, 0, 45);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    for (let i = 0; i < 300; i++) game.update(1 / 60);
    return {
      ...game.tether.status,
      position: game.player.group.position.toArray(),
    };
  });
  check(
    'el cable limita la distancia máxima',
    tetherLimit.active && tetherLimit.distance <= tetherLimit.max + 2,
    JSON.stringify(tetherLimit)
  );

  // Vista de EVA con el cable desplegado (captura de validación).
  await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, 0, 22);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.cameraRig.yaw = 0;
    game.cameraRig.pitch = 0.12;
    game.cameraRig.snap(game.player.group.position);
    for (let i = 0; i < 20; i++) game.update(1 / 60);
  });
  await page.screenshot({ path: `${SHOTS}/tether.png` });

  // Consola del puente: E abre el panel y permite activar una misión.
  const cockpit = await page.evaluate(() => {
    const game = window.__orbital;
    game.player.body.position.set(0, -8.8, -12.5);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.controls.interactPressed = true;
    game.update(1 / 60);
    return {
      panel: game.panelOpen,
      title: document.querySelector('#panel-title').textContent,
      mission: game.missions.active?.id ?? null,
    };
  });
  check('E abre la consola del puente', cockpit.panel === 'navigation', JSON.stringify(cockpit));
  await page.screenshot({ path: `${SHOTS}/panel.png` });

  const missionTest = await page.evaluate(() => {
    const game = window.__orbital;
    game.handlePanelAction('activate', 'engineering_power');
    game.closePanel();
    game.player.body.position.set(6.8, -8.8, -1.5);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.openPanel('engineering', 'engineering');

    for (let circuit = 0; circuit < 3; circuit++) {
      game.handlePanelAction('circuit', String(circuit));
      for (let i = 0; i < 190; i++) game.update(1 / 60);
    }

    const mission = game.missions.getById('engineering_power');
    return {
      circuits: game.engineering.circuits,
      power: game.interior.powerLevel,
      mission: mission.state,
      active: game.missions.activeId,
    };
  });
  check(
    'misión interior de ingeniería completable',
    missionTest.circuits.every(Boolean) && missionTest.mission === 'completed',
    JSON.stringify(missionTest)
  );
  check('los circuitos devuelven potencia al hábitat', missionTest.power > 0.99, String(missionTest.power));

  await page.evaluate(() => window.__orbital.closePanel());

  // Tarea exterior real: activar la misión de herramientas y recoger una.
  const exteriorTask = await page.evaluate(() => {
    const game = window.__orbital;
    game.missions.activate('tool_recovery');
    game.player.body.position.set(0, 4.8, 10.6);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.controls.interactPressed = true;
    game.update(1 / 60);
    for (let i = 0; i < 10; i++) game.update(1 / 60);

    const mission = game.missions.getById('tool_recovery');
    const task = game.exteriorTasks.tasks.find((item) => item.id === 'tool_1');
    return {
      done: task.done,
      progress: mission.objectives[0].progress,
      target: mission.objectives[0].target,
      tools: game.inventory.tools,
    };
  });
  check(
    'tarea EVA real completa y progresa la misión',
    exteriorTask.done && exteriorTask.progress === 1 && exteriorTask.tools === 1,
    JSON.stringify(exteriorTask)
  );

  /* ------------------------- universo: nave, Luna, Marte y persistencia */

  const shipBoarding = await page.evaluate(() => {
    const game = window.__orbital;
    game.missions.activate('moon_landing');
    game._boardShip();
    return {
      panel: game.panelOpen,
      inside: game.ship.contains(game.player.group.position),
      seated: game.seated,
      points: game.ship.points.length,
      colliders: game.ship.colliders.length,
    };
  });
  check(
    'nave: embarque, cabina y colisiones',
    shipBoarding.panel === 'ship' &&
      shipBoarding.inside &&
      shipBoarding.seated &&
      shipBoarding.points >= 4 &&
      shipBoarding.colliders >= 8,
    JSON.stringify(shipBoarding)
  );

  const moonArrival = await page.evaluate(() => {
    const game = window.__orbital;
    game.travelTo('moon');
    let guard = 0;
    while (game.state === 'travel' && guard++ < 2000) game._updateTravel(1 / 60);
    game.update(1 / 60);
    const mission = game.missions.getById('moon_landing');
    const moon = game.moon;
    const ground = moon.groundHeightAt(
      game.player.group.position.x,
      game.player.group.position.z
    );
    return {
      state: game.state,
      destination: game.destination,
      moonVisible: moon.group.visible,
      stationVisible: game.station.group.visible,
      moonColliders: moon.colliders.every((body) => body.collisionResponse),
      stationColliders: game.station.bodies.some((body) => body.collisionResponse),
      mode: game.player.mode,
      playerY: game.player.group.position.y,
      bodyY: game.player.body.position.y,
      ground,
      travelProgress: mission.objectives[0].progress,
      shipParked: game.ship.group.position.toArray(),
      earth: !!game.environment.earth,
    };
  });
  check(
    'Luna: viaje, aterrizaje y gravedad a pie',
    moonArrival.state === 'playing' &&
      moonArrival.destination === 'moon' &&
      moonArrival.moonVisible &&
      !moonArrival.stationVisible &&
      moonArrival.moonColliders &&
      !moonArrival.stationColliders &&
      moonArrival.mode === 'walk' &&
      Math.abs(moonArrival.bodyY - (moonArrival.ground + 0.8)) < 0.1 &&
      moonArrival.travelProgress === 1,
    JSON.stringify(moonArrival)
  );

  const moonWorld = await page.evaluate(() => {
    const moon = window.__orbital.moon;
    return {
      built: [...moon.modules.values()].filter((m) => m.built).map((m) => m.id),
      pending: [...moon.modules.values()].filter((m) => !m.built).map((m) => m.id),
      resources: moon.config.resources.length,
      rover: !!moon.rover,
      craters: moon.config.craters.length,
      dust: !!moon.dust,
      cave: !!moon.caveBounds,
    };
  });
  check(
    'Luna: base modular, recursos y rover',
    moonWorld.built.includes('habitat') &&
      moonWorld.built.includes('control') &&
      moonWorld.pending.includes('lab') &&
      moonWorld.resources >= 3 &&
      moonWorld.rover &&
      moonWorld.craters >= 3 &&
      moonWorld.dust &&
      !moonWorld.cave,
    JSON.stringify(moonWorld)
  );

  const moonMining = await page.evaluate(() => {
    const game = window.__orbital;
    const moon = game.moon;
    const point = moon.points.find((item) => item.node === 'moon_regolith_1');
    game.openPlanetPoint(point);
    const before = game.cargo.regolith;
    game.handlePanelAction('mine');
    const mission = game.missions.getById('moon_landing');

    // Construcción lunar real con recursos.
    game.resources = {
      regolith: 0,
      waterIce: 0,
      minerals: 0,
      metals: 30,
      electronics: 10,
      industrial: 30,
    };
    game.panelOpen = 'base';
    game.panelPoint = null;
    game.handlePanelAction('build-module', 'workshop');
    const workshop = moon.modules.get('workshop');

    return {
      before,
      after: game.cargo.regolith,
      state: mission.state,
      pending: game.missions.pendingFor('moon').some((m) => m.id === 'moon_landing'),
      history: game.missions.historyFor('moon').some((entry) => entry.id === 'moon_landing'),
      overlay: !document.querySelector('#mission-complete').classList.contains('hidden'),
      workshopBuilt: workshop.built,
      workshopMeshes: workshop.meshes.length,
      metals: game.resources.metals,
    };
  });
  check(
    'Luna: minería, misión completada y fuera de pendientes',
    moonMining.after > moonMining.before &&
      moonMining.state === 'completed' &&
      !moonMining.pending &&
      moonMining.history &&
      moonMining.overlay,
    JSON.stringify(moonMining)
  );
  check(
    'Luna: construcción modular real',
    moonMining.workshopBuilt && moonMining.workshopMeshes > 0 && moonMining.metals === 22,
    JSON.stringify(moonMining)
  );
  await page.evaluate(() => window.__orbital.hud.hideMissionComplete());

  const marsArrival = await page.evaluate(() => {
    const game = window.__orbital;
    game._boardShip();
    game.travelTo('mars');
    let guard = 0;
    while (game.state === 'travel' && guard++ < 2000) game._updateTravel(1 / 60);
    const mars = game.mars;
    return {
      state: game.state,
      destination: game.destination,
      visible: mars.group.visible,
      moonVisible: game.moon.group.visible,
      colliders: mars.colliders.every((body) => body.collisionResponse),
      mode: game.player.mode,
      cave: !!mars.caveBounds,
      dust: !!mars.dust,
      shipParked: game.ship.group.position.toArray(),
    };
  });
  check(
    'Marte: viaje, atmósfera, cueva y polvo',
    marsArrival.state === 'playing' &&
      marsArrival.destination === 'mars' &&
      marsArrival.visible &&
      !marsArrival.moonVisible &&
      marsArrival.colliders &&
      marsArrival.mode === 'walk' &&
      marsArrival.cave &&
      marsArrival.dust,
    JSON.stringify(marsArrival)
  );

  const marsExploration = await page.evaluate(() => {
    const game = window.__orbital;
    const mars = game.mars;
    const center = mars.config.mountain;
    let spot = null;
    for (let radius = 70; radius < 130 && !spot; radius += 5) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.15) {
        const x = center[0] + Math.cos(angle) * radius;
        const z = center[1] + Math.sin(angle) * radius;
        const y = mars.heightAt(x, z);
        if (y > 3) {
          spot = { x, y, z };
          break;
        }
      }
    }

    game.missions.activate('mars_mountain');
    game.player.body.position.set(spot.x, spot.y + game.player.radius, spot.z);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.update(1 / 60);
    const mountainMission = game.missions.getById('mars_mountain');

    game.hud.hideMissionComplete();
    game.missions.activate('mars_cave');
    const [minX, minY, minZ] = mars.caveBounds.min;
    const [maxX, , maxZ] = mars.caveBounds.max;
    game.player.body.position.set((minX + maxX) / 2, minY + 1.1, (minZ + maxZ) / 2);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.update(1 / 60);
    const caveMission = game.missions.getById('mars_cave');

    const ice = mars.points.find((item) => item.node === 'mars_cave_ice');
    game.openPlanetPoint(ice);
    game.handlePanelAction('mine');

    return {
      spot: { x: spot.x, y: spot.y, z: spot.z },
      mountainExplored: mars.mountainExplored,
      mountainState: mountainMission.state,
      caveExplored: mars.caveExplored,
      caveProgress: caveMission.objectives[0].progress,
      caveState: caveMission.state,
      cargoIce: game.cargo.waterIce,
    };
  });
  check(
    'Marte: cordillera explorada y misión única',
    marsExploration.mountainExplored &&
      marsExploration.mountainState === 'completed',
    JSON.stringify(marsExploration)
  );
  check(
    'Marte: cueva, hielo subsuperficial y misión',
    marsExploration.caveExplored &&
      marsExploration.caveProgress === 1 &&
      marsExploration.caveState === 'completed' &&
      marsExploration.cargoIce >= 3,
    JSON.stringify(marsExploration)
  );
  await page.evaluate(() => window.__orbital.hud.hideMissionComplete());

  const roverTest = await page.evaluate(() => {
    const game = window.__orbital;
    const mars = game.mars;
    const start = mars.rover.position.clone();
    game._enterRover();
    const entered = {
      vehicle: !!game.vehicle,
      occupied: mars.rover.occupied,
      hidden: !game.player.group.visible,
    };
    for (let i = 0; i < 120; i++) mars.updateRover(1 / 60, { x: 0, z: 1 });
    const moved = mars.rover.position.distanceTo(start);
    game._exitRover();
    return {
      entered,
      moved,
      exited: !game.vehicle,
      visible: game.player.group.visible,
      occupied: mars.rover.occupied,
    };
  });
  check(
    'rover: conducir, avanzar y bajar',
    roverTest.entered.vehicle &&
      roverTest.entered.occupied &&
      roverTest.entered.hidden &&
      roverTest.moved > 1 &&
      roverTest.exited &&
      roverTest.visible &&
      !roverTest.occupied,
    JSON.stringify(roverTest)
  );

  const construction = await page.evaluate(() => {
    const game = window.__orbital;
    const mars = game.mars;
    game.resources = {
      regolith: 40,
      waterIce: 40,
      minerals: 40,
      metals: 40,
      electronics: 40,
      industrial: 40,
    };
    game.panelOpen = 'base';
    game.panelPoint = null;
    game.handlePanelAction('build-module', 'lab');
    const lab = mars.modules.get('lab');
    const built = {
      built: lab.built,
      meshes: lab.meshes.length,
      colliders: lab.colliders.length,
      metals: game.resources.metals,
      industrial: game.resources.industrial,
    };

    game.cargo.minerals = 7;
    game.resources.minerals = 0;
    game.handlePanelAction('unload-cargo');

    return {
      ...built,
      cargoAfter: game.cargo.minerals,
      stockAfter: game.resources.minerals,
    };
  });
  check(
    'construcción modular con coste real',
    construction.built &&
      construction.meshes > 0 &&
      construction.colliders > 0 &&
      construction.metals === 34 &&
      construction.industrial === 36,
    JSON.stringify(construction)
  );
  check(
    'carga transportada y descargada en la base',
    construction.cargoAfter === 0 && construction.stockAfter === 7,
    JSON.stringify(construction)
  );

  const uniqueMissions = await page.evaluate(() => {
    const game = window.__orbital;
    const first = game.missions.generateMaintenance(3).map((m) => m.id);
    const second = game.missions.generateMaintenance(3).map((m) => m.id);
    const all = [...first, ...second];
    return {
      ids: all,
      unique: new Set(all).size === all.length,
      count: all.length,
      completedExcluded: !game.missions.pendingFor('mars').some((m) => m.id === 'mars_cave'),
    };
  });
  check(
    'misiones: IDs únicos y completadas no reaparecen',
    uniqueMissions.unique && uniqueMissions.count === 6 && uniqueMissions.completedExcluded,
    JSON.stringify(uniqueMissions)
  );

  const persistence = await page.evaluate(() => {
    const game = window.__orbital;
    const x = 4;
    const z = 20;
    const y = game.mars.groundHeightAt(x, z) + game.player.radius;
    game.player.body.position.set(x, y, z);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game.saveGame(true);

    const raw = localStorage.getItem('orbital.universe.save');
    const snapshot = JSON.parse(raw);
    const before = {
      destination: game.destination,
      cargo: game.cargo.waterIce,
      built: game.mars.modules.get('lab').built,
      completed: game.missions.completedIds.size,
      position: game.player.body.position.toArray(),
    };

    game.reset();
    game.restoreState(snapshot);

    return {
      saved: !!raw,
      version: snapshot.version,
      before,
      after: {
        destination: game.destination,
        cargo: game.cargo.waterIce,
        built: game.mars.modules.get('lab').built,
        completed: game.missions.completedIds.size,
        position: game.player.body.position.toArray(),
        cavePending: game.missions.pendingFor('mars').some((m) => m.id === 'mars_cave'),
        moonLabBuilt: game.moon.modules.get('lab').built,
        moonWorkshopBuilt: game.moon.modules.get('workshop').built,
        mode: game.player.mode,
      },
    };
  });
  check(
    'guardado y carga: destino, base, carga y misiones',
    persistence.saved &&
      persistence.version === 3 &&
      persistence.after.destination === 'mars' &&
      persistence.after.cargo === persistence.before.cargo &&
      persistence.after.built &&
      persistence.after.completed >= persistence.before.completed &&
      !persistence.after.cavePending &&
      !persistence.after.moonLabBuilt &&
      persistence.after.moonWorkshopBuilt &&
      persistence.after.mode === 'walk' &&
      Math.abs(persistence.after.position[0] - persistence.before.position[0]) < 0.01 &&
      Math.abs(persistence.after.position[2] - persistence.before.position[2]) < 0.01,
    JSON.stringify(persistence)
  );

  /* =================== AUDITORÍA DE EXPANSIÓN (FASE H) =================== */

  const audit = await page.evaluate(() => {
    const game = window.__orbital;
    game.start();
    const interior = game.interior;

    // 1. Los 17 módulos son transitables: el jugador cabe y se asienta.
    const moduleFailures = [];
    for (const [id, module] of Object.entries(interior.modules)) {
      const x = (module.min[0] + module.max[0]) / 2;
      const z = (module.min[2] + module.max[2]) / 2;
      const y = module.min[1] + 0.9;
      game.player.body.position.set(x, y, z);
      game.player.body.velocity.setZero();
      game.player.sync(0.016, game.camera);
      game._refreshZone(false);
      const inside = interior.contains(game.player.group.position);
      const at = interior.getModuleAt(game.player.group.position);
      for (let i = 0; i < 6; i++) game.update(1 / 60);
      const settled = interior.getModuleAt(game.player.group.position);
      if (!inside || at?.id !== id || !settled) {
        moduleFailures.push(`${id}>${at?.id ?? 'none'}>${settled?.id ?? 'none'}`);
      }
    }

    // 2. Las 19 compuertas abren, dejan de bloquear y vuelven a cerrar.
    const doorFailures = [];
    for (const door of interior.doors) {
      door.progress = 0;
      door.target = 0;
      interior._syncDoorState(door);
      door.body.collisionResponse = true;
      const near =
        door.axis === 'z'
          ? { x: door.position[0], y: door.position[1] + 0.55, z: door.position[2] - 1.4 }
          : { x: door.position[0] - 1.4, y: door.position[1] + 0.55, z: door.position[2] };
      interior.openDoor(door.id);
      for (let i = 0; i < 45; i++) interior.update(1 / 60, near);
      const opened = door.state === 'open' && door.solid === false;
      const away = { x: 0, y: -9.3, z: 40 };
      if (!door.auto) interior.closeDoor(door.id);
      for (let i = 0; i < 80; i++) interior.update(1 / 60, away);
      const closed = door.state === 'closed' && door.solid === true;
      if (!opened || !closed) {
        doorFailures.push(`${door.id}:${door.state}:solid=${door.solid}`);
      }
    }

    // 3. Cada consola de la estación expone acciones reales y registro.
    const panels = [
      'navigation', 'cockpit', 'engineering', 'lab', 'storage', 'life', 'suit',
      'medbay', 'dorms', 'mess', 'power', 'workshop', 'hangar',
    ];
    const panelFailures = [];
    const panelActions = {};
    for (const kind of panels) {
      game.openPanel(kind);
      const body = document.querySelector('#panel-body');
      const buttons = body ? body.querySelectorAll('button[data-action]') : [];
      panelActions[kind] = [...new Set([...buttons].map((b) => b.dataset.action))];
      const hasLog = !!body?.querySelector('.action-log');
      if (!buttons.length || !hasLog) {
        panelFailures.push(`${kind}:${buttons.length}:log=${hasLog}`);
      }
    }
    game.closePanel();

    // 4. Hangar: repostar y reparar consumen recursos y cambian el estado.
    game.resources.industrial = 5;
    game.resources.metals = 5;
    game.resources.electronics = 5;
    game.shipFuel = 40;
    game.shipIntegrity = 60;
    game.openPanel('hangar');
    game.handlePanelAction('refuel-ship');
    const fuelAfter = game.shipFuel;
    const industrialAfter = game.resources.industrial;
    game.handlePanelAction('repair-ship');
    const hullAfter = game.shipIntegrity;
    const metalsAfter = game.resources.metals;
    const hangarOk =
      fuelAfter === 100 && industrialAfter === 4 && hullAfter === 100 && metalsAfter === 3;
    game.closePanel();

    // 5. Sin combustible el viaje queda bloqueado.
    game.shipFuel = 0;
    game.travelTo('mars');
    const travelBlocked = game.travel === null && game.destination === 'station';
    game.shipFuel = 100;

    // 6. Las 7 actividades de mantenimiento se ejecutan y cambian el estado.
    const maintenance = [];
    for (const task of game.maintenance.tasks) {
      const point = game.interiorSystems.points.find((item) => item.id === task.location);
      game.player.body.position.copy(point.group.position);
      game.player.body.velocity.setZero();
      game.player.sync(0.016, game.camera);
      game.inventory.filter = 5;
      game.inventory.component = 5;
      game.resources.metals = 20;
      game.resources.electronics = 20;
      game.job = null;
      game._runMaintenance(task.id);
      const started = !!game.job;
      if (game.job) {
        game.job.elapsed = game.job.duration;
        game.updateJobs(0.02);
      }
      maintenance.push({
        id: task.id,
        started,
        done: task.state === 'done',
        result: task.result,
      });
    }
    const maintenanceOk =
      maintenance.length === 7 &&
      maintenance.every((item) => item.started && item.done && item.result);

    // 7. Registro de acciones: estado anterior, posterior y consumos.
    const last = game.lastActionResult;
    const logOk =
      !!last &&
      Array.isArray(last.changes) &&
      last.changes.length > 0 &&
      Array.isArray(last.consumed) &&
      typeof last.result === 'string' &&
      game.actionLog.length > 0;

    // 8. Entrada, menú principal de siete opciones y configuración.
    const menu = {
      entry: !!document.querySelector('#screen-entry'),
      menuScreen: !!document.querySelector('#screen-menu'),
      newGame: !!document.querySelector('#btn-menu-new'),
      continueGame: !!document.querySelector('#btn-menu-continue'),
      design: !!document.querySelector('#btn-menu-design'),
      academy: !!document.querySelector('#btn-menu-academy'),
      data: !!document.querySelector('#btn-menu-data'),
      manual: !!document.querySelector('#btn-menu-manual'),
      settings: !!document.querySelector('#btn-menu-settings'),
      settingsScreen: !!document.querySelector('#screen-settings'),
    };
    const menuOk = Object.values(menu).every(Boolean);

    // 9. Cámara orbital responde al ratón.
    const yaw0 = game.cameraRig.yaw;
    game.cameraRig.rotate(0.5, 0.2);
    const cameraOk = game.cameraRig.yaw !== yaw0;
    game.cameraRig.rotate(-0.5, -0.2);

    // 10. Perfil gráfico estándar único y coste de render del frame.
    const qualityIds = Object.keys(game.quality.presets);
    const qualityPreset = game.quality.describe();
    game.frame();
    const perf = {
      calls: game.renderer.info.render.calls,
      triangles: game.renderer.info.render.triangles,
    };
    const standardOk = game.quality.current === 'standard' && qualityPreset.id === 'standard';

    // Deja la partida lista para las pruebas de pausa.
    game.state = 'playing';
    game.closePanel();
    game.player.body.position.set(12.8, game.interior.floor + game.player.halfHeight, -3);
    game.player.body.velocity.setZero();
    game.player.sync(0.016, game.camera);
    game._refreshZone(false);

    return {
      modules: Object.keys(interior.modules).length,
      moduleFailures,
      doors: interior.doors.length,
      doorFailures,
      panels: panels.length,
      panelFailures,
      panelActions,
      hangarOk,
      fuelAfter,
      industrialAfter,
      hullAfter,
      metalsAfter,
      travelBlocked,
      maintenance,
      maintenanceOk,
      logOk,
      menu,
      menuOk,
      cameraOk,
      qualityIds,
      standardOk,
      perf,
    };
  });

  check(
    'auditoría: 17 módulos transitables',
    audit.modules === 17 && audit.moduleFailures.length === 0,
    JSON.stringify(audit.moduleFailures)
  );
  check(
    'auditoría: 19 compuertas abren, desbloquean y cierran',
    audit.doors === 19 && audit.doorFailures.length === 0,
    JSON.stringify(audit.doorFailures)
  );
  check(
    'auditoría: consolas con acciones reales y registro',
    audit.panels === 13 && audit.panelFailures.length === 0,
    JSON.stringify(audit.panelFailures)
  );
  check(
    'auditoría: hangar reposta y repara con recursos',
    audit.hangarOk,
    JSON.stringify({
      fuel: audit.fuelAfter,
      industrial: audit.industrialAfter,
      hull: audit.hullAfter,
      metals: audit.metalsAfter,
    })
  );
  check('auditoría: sin combustible no hay viaje', audit.travelBlocked);
  check(
    'auditoría: 7 mantenimientos con resultado',
    audit.maintenanceOk,
    JSON.stringify(audit.maintenance)
  );
  check('auditoría: registro anterior → acción → posterior', audit.logOk);
  check('auditoría: menú principal de siete opciones', audit.menuOk, JSON.stringify(audit.menu));
  check('auditoría: cámara orbital', audit.cameraOk);
  check(
    'auditoría: perfil gráfico estándar único',
    audit.qualityIds.length === 1 && audit.qualityIds[0] === 'standard' && audit.standardOk,
    JSON.stringify(audit.qualityIds)
  );
  console.log(
    `  info auditoría: ${audit.perf.calls} draw calls · ${audit.perf.triangles} triángulos · ` +
      `${audit.doors} compuertas · ${audit.panels} consolas`
  );

  // Pausa y reanudación (Prompt 3.7: 8 opciones reales)
  await page.evaluate(() => window.__orbital.pause());
  const paused = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#screen-pause .pause-grid button')].map((b) => b.id);
    return {
      state: window.__orbital.state,
      screen: !document.querySelector('#screen-pause').classList.contains('hidden'),
      ids,
      count: ids.length,
    };
  });
  check('pausa muestra su pantalla', paused.state === 'paused' && paused.screen);
  check('pausa con 8 opciones', paused.count === 8, JSON.stringify(paused.ids));

  // El manual no debe perder el estado ni apilar ventanas.
  const pauseManual = await page.evaluate(() => {
    const game = window.__orbital;
    const before = game.player.body.position.toArray();
    game.openManual({ from: 'pause' });
    const overlay = document.querySelector('#overlay-manual');
    const after = game.player.body.position.toArray();
    return {
      open: overlay && !overlay.classList.contains('hidden'),
      openCount: document.querySelectorAll('.overlay:not(.hidden)').length,
      preserved:
        Math.abs(before[0] - after[0]) < 1e-6 && Math.abs(before[2] - after[2]) < 1e-6,
      state: game.state,
    };
  });
  check(
    'manual desde pausa conserva el estado',
    pauseManual.open && pauseManual.preserved && pauseManual.state === 'paused',
    JSON.stringify(pauseManual)
  );
  check('una sola ventana educativa abierta', pauseManual.openCount === 1, String(pauseManual.openCount));

  await page.keyboard.press('Escape');
  await sleep(250);
  const backToPause = await page.evaluate(() => ({
    state: window.__orbital.state,
    pause: !document.querySelector('#screen-pause').classList.contains('hidden'),
  }));
  check('cerrar manual devuelve a la pausa', backToPause.state === 'paused' && backToPause.pause);

  await page.click('#btn-pause-objectives');
  await sleep(250);
  const objectives = await page.evaluate(() => {
    const el = document.querySelector('#overlay-objectives');
    return {
      open: el && !el.classList.contains('hidden'),
      text: el?.textContent ?? '',
      openCount: document.querySelectorAll('.overlay:not(.hidden)').length,
    };
  });
  check('objetivos accesibles desde la pausa', objectives.open && objectives.text.length > 40);
  check('objetivos sin apilar ventanas', objectives.openCount === 1, String(objectives.openCount));
  await page.keyboard.press('Escape');
  await sleep(250);

  await page.evaluate(() => window.__orbital.resume());
  await sleep(300);
  check('reanudar vuelve a jugar', (await page.evaluate(() => window.__orbital.state)) === 'playing');

  /* -------------------- Prompt 3.7: diseño verificado e implementación */

  const design = await page.evaluate(async () => {
    const mod = await import('/js/core/MissionDesign.js');
    const game = window.__orbital;
    game.startNewGame({ requestLock: false });

    const state = {
      ...mod.newDesignState(),
      goalId: 'lunar_ice',
      conceptId: 'orbiter',
      modality: 'trade',
      instrumentIds: ['camera', 'spectrometer', 'drill'],
      vehicleId: 'vector_s',
      trajectoryId: 'direct',
      groundId: 'station_array',
      compared: ['minimal', 'balanced'],
    };
    state.requirements = mod.requirementsFor(mod.goalById('lunar_ice'));

    const verification = mod.verifyDesign(state);
    game._saveDesignState(state);
    const beforeMissions = game.missions.list.length;
    const fuelBefore = game.shipFuel;
    const result = game._implementDesign(state);

    return {
      verified: verification.ok,
      errors: verification.errors,
      cml: verification.cml,
      resultOk: result.ok,
      message: result.message ?? '',
      added: game.missions.list.length - beforeMissions,
      active: game.missions.active?.name ?? null,
      fuelSpent: fuelBefore - game.shipFuel,
      guided: game.guided,
      missionLocation: game.missions.active?.location ?? null,
    };
  });
  check('diseño de seis fases verifica', design.verified, JSON.stringify(design.errors));
  check('diseño alcanza CML 4 educativo', design.cml === 4, String(design.cml));
  check(
    'diseño implementado como misión real',
    design.resultOk && design.added === 1 && !!design.active,
    JSON.stringify(design)
  );
  check(
    'implementar consume combustible y desactiva la guía',
    design.fuelSpent > 0 && design.guided === false,
    JSON.stringify({ fuel: design.fuelSpent, guided: design.guided })
  );

  const designSave = await page.evaluate(() => {
    const game = window.__orbital;
    game.saveGame(true);
    const raw = JSON.parse(localStorage.getItem('orbital.universe.save'));
    return {
      version: raw.version,
      design: !!raw.design && raw.design.implemented === true,
      academy: !!raw.academy,
      guided: raw.guided === false,
      missionSaved: (raw.missions?.missions ?? []).some((m) => m.id.startsWith('design_')),
    };
  });
  check(
    'guardado incluye diseño, academia y guía',
    designSave.version === 3 &&
      designSave.design &&
      designSave.academy &&
      designSave.guided &&
      designSave.missionSaved,
    JSON.stringify(designSave)
  );

  /* ------------------ Prompt 3.7: sin red por frame y modo offline */

  const requestsBefore = requests.length;
  await sleep(1500);
  const frameRequests = requests.slice(requestsBefore);
  check(
    'sin consultas externas por frame',
    frameRequests.length === 0,
    frameRequests.slice(0, 3).join(' | ')
  );

  await page.setOfflineMode(true);
  const offline = await page.evaluate(async () => {
    const game = window.__orbital;
    await new Promise((resolve) => setTimeout(resolve, 700));
    game.frame();
    return {
      state: game.state,
      calls: game.renderer.info.render.calls,
      hasHud: !document.querySelector('#hud').classList.contains('hidden'),
    };
  });
  await page.setOfflineMode(false);
  check(
    'el simulador sigue funcionando sin conexión',
    offline.state === 'playing' && offline.calls > 0 && offline.hasHud,
    JSON.stringify(offline)
  );

  // Victoria forzada (flujo de pantalla final)
  await page.evaluate(() => {
    const game = window.__orbital;
    game.station.repairedCount = game.station.totalBreaches;
    game.win();
  });
  await sleep(400);
  const won = await page.evaluate(() => ({
    state: window.__orbital.state,
    screen: !document.querySelector('#screen-win').classList.contains('hidden'),
    time: document.querySelector('#win-time').textContent,
  }));
  check('pantalla de victoria', won.state === 'won' && won.screen, won.time);

  await page.screenshot({ path: `${SHOTS}/win.png` });

  // Derrota por integridad del casco
  await page.evaluate(() => {
    const game = window.__orbital;
    game.start();
    game.player.hull = 0;
    game.update(1 / 60);
  });
  const lost = await page.evaluate(() => ({
    state: window.__orbital.state,
    screen: !document.querySelector('#screen-lose').classList.contains('hidden'),
    title: document.querySelector('#lose-title').textContent,
  }));
  check('pantalla de derrota', lost.state === 'lost' && lost.screen, lost.title);

  check('sin errores de consola', errors.length === 0, errors.join(' | '));

  console.log(`\n${failures === 0 ? 'Smoke test OK' : `${failures} fallo(s)`}`);
} catch (error) {
  failures++;
  console.error('Error en el smoke test:', error);
} finally {
  await browser?.close();
  server.kill();
  process.exit(failures === 0 ? 0 : 1);
}
