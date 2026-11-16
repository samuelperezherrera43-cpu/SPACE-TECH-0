/**
 * Prueba del modo táctil con Chrome real (headless) y viewport de móvil.
 * Requiere Chrome instalado. Uso: npm run touch:test
 *
 * Comprueba que el overlay táctil aparece durante la partida, que el joystick
 * mueve al jugador, que la zona derecha gira la cámara y que los botones
 * (reparar, usar, herramienta, pausa) llegan al estado de Controls.
 */
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const SHOTS = '.smoke/touch';
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

const PORT = 5197;
const server = spawn(process.execPath, ['scripts/dev.mjs'], {
  env: { ...process.env, PORT: String(PORT), LIVE_RELOAD: '0' },
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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

async function waitFor(page, fn, label, timeout = 4000, ...args) {
  try {
    await page.waitForFunction(fn, { timeout, polling: 60 }, ...args);
    return true;
  } catch {
    console.error(`  (tiempo agotado esperando: ${label})`);
    return false;
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
    ],
  });

  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: IPHONE_UA,
  });
  // Fuerza el modo táctil aunque el emulador no anuncie `pointer: coarse`.
  await page.evaluateOnNewDocument(() => { window.SPACE_TECH_TOUCH = true; });

  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__orbital, { timeout: 20000 });

  check('overlay táctil en el DOM', await page.evaluate(() => !!document.querySelector('#touch-controls')));
  check('modo táctil detectado', await page.evaluate(() => window.__orbital.touch.enabled === true));
  check('body.touch-input', await page.evaluate(() => document.body.classList.contains('touch-input')));
  check('pointer lock desactivado', await page.evaluate(() => window.__orbital.controls.coarsePointer === true));
  await page.screenshot({ path: `${SHOTS}/01-entry.png` });

  await page.click('#btn-enter');
  await waitFor(page, () => window.__orbital.state === 'menu', 'menú principal');
  await page.screenshot({ path: `${SHOTS}/02-menu.png` });

  await page.click('#btn-menu-new');
  await waitFor(page, () => window.__orbital.state === 'playing', 'estado playing');
  const overlayVisible = await waitFor(
    page,
    () => !document.querySelector('#touch-controls').classList.contains('hidden'),
    'overlay visible'
  );
  check('overlay visible al jugar', overlayVisible);
  await page.screenshot({ path: `${SHOTS}/03-playing.png` });

  /* ------------------------------------------------------------- joystick */

  const stick = await page.evaluate(() => {
    const r = document.querySelector('#touch-stick').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  await page.touchscreen.touchStart(stick.x, stick.y);
  await sleep(120);
  await page.touchscreen.touchMove(stick.x, stick.y - 46);
  check('joystick adelante', await waitFor(page, () => window.__orbital.controls.touch.moveZ > 0.4, 'moveZ'));

  await page.touchscreen.touchMove(stick.x + 46, stick.y);
  check('joystick derecha', await waitFor(page, () => window.__orbital.controls.touch.moveX > 0.4, 'moveX'));

  await page.touchscreen.touchEnd();
  check(
    'joystick se suelta',
    await waitFor(
      page,
      () => window.__orbital.controls.touch.moveX === 0 && window.__orbital.controls.touch.moveZ === 0,
      'move a cero'
    )
  );

  /* --------------------------------------------------------------- cámara */

  const look = await page.evaluate(() => {
    const r = document.querySelector('#touch-look').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const yawBefore = await page.evaluate(() => window.__orbital.cameraRig.yaw);
  await page.touchscreen.touchStart(look.x, look.y);
  await sleep(100);
  await page.touchscreen.touchMove(look.x + 70, look.y);
  const turned = await waitFor(
    page,
    (before) => Math.abs(window.__orbital.cameraRig.yaw - before) > 0.05,
    'giro de cámara',
    4000,
    yawBefore
  );
  await page.touchscreen.touchEnd();
  check('cámara gira con el gesto', turned);

  /* --------------------------------------------------------------- botones */

  const center = (selector) => page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);

  const repair = await center('.touch-repair');
  await page.touchscreen.touchStart(repair.x, repair.y);
  check(
    'reparar mantenido',
    await waitFor(
      page,
      () => window.__orbital.controls.repairHeld === true && window.__orbital.controls.touch.repair === true,
      'repairHeld'
    )
  );
  await page.touchscreen.touchEnd();
  check(
    'reparar se suelta',
    await waitFor(page, () => window.__orbital.controls.repairHeld === false, 'repairHeld false')
  );

  const interact = await center('.touch-interact');
  await page.touchscreen.touchStart(interact.x, interact.y);
  check(
    'usar mantenido',
    await waitFor(page, () => window.__orbital.controls.interactHeld === true, 'interactHeld')
  );
  await page.touchscreen.touchEnd();
  check(
    'usar se suelta',
    await waitFor(page, () => window.__orbital.controls.interactHeld === false, 'interactHeld false')
  );

  const boost = await center('.touch-boost');
  await page.touchscreen.touchStart(boost.x, boost.y);
  check('RCS mantenido', await waitFor(page, () => window.__orbital.controls.boost === true, 'boost'));
  await page.touchscreen.touchEnd();
  check('RCS se suelta', await waitFor(page, () => window.__orbital.controls.boost === false, 'boost false'));

  const jump = await center('.touch-jump');
  await page.touchscreen.touchStart(jump.x, jump.y);
  check(
    'ascender mantenido',
    await waitFor(page, () => window.__orbital.controls.touch.moveY === 1, 'moveY')
  );
  await page.touchscreen.touchEnd();

  const toolBefore = await page.evaluate(() => window.__orbital.toolIndex);
  await page.tap('.touch-tool');
  const toolChanged = await waitFor(
    page,
    (before) => window.__orbital.toolIndex !== before,
    'cambio de herramienta',
    4000,
    toolBefore
  );
  const toolAfter = await page.evaluate(() => window.__orbital.toolIndex);
  check('botón herramienta cambia', toolChanged, `${toolBefore} → ${toolAfter}`);
  const label = await page.evaluate(() => document.querySelector('#touch-tool-label').textContent);
  check('etiqueta de herramienta', label === `HERRAMIENTA ${toolAfter + 1}`, label);

  /* ---------------------------------------------------------------- pausa */

  await page.tap('#touch-pause');
  check('pausa táctil', await waitFor(page, () => window.__orbital.state === 'paused', 'paused'));
  check(
    'overlay oculto en pausa',
    await waitFor(
      page,
      () => document.querySelector('#touch-controls').classList.contains('hidden'),
      'overlay oculto'
    )
  );
  await page.screenshot({ path: `${SHOTS}/04-pause.png` });

  await page.tap('#btn-resume');
  check('reanudar táctil', await waitFor(page, () => window.__orbital.state === 'playing', 'playing'));
  check(
    'overlay vuelve al reanudar',
    await waitFor(
      page,
      () => !document.querySelector('#touch-controls').classList.contains('hidden'),
      'overlay visible'
    )
  );
  await page.screenshot({ path: `${SHOTS}/05-resumed.png` });

  // Orientación horizontal (móvil girado).
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(500);
  check(
    'overlay visible en horizontal',
    await waitFor(
      page,
      () => !document.querySelector('#touch-controls').classList.contains('hidden'),
      'overlay horizontal'
    )
  );
  await page.screenshot({ path: `${SHOTS}/06-landscape.png` });

  check('sin errores de consola', errors.length === 0, errors.join(' | '));
} catch (error) {
  failures++;
  console.error('ERROR:', error);
} finally {
  if (browser) await browser.close();
  server.kill();
}

console.log(failures === 0 ? '\nTouch test OK' : `\nTouch test: ${failures} fallo(s)`);
process.exit(failures === 0 ? 0 : 1);
