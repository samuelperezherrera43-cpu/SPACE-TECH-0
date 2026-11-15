/**
 * Arnés de capturas de referencia — herramienta de desarrollo.
 *
 * No se sirve al juego ni forma parte del producto. Sirve para el método
 * obligatorio de la guía de dirección artística: antes y después de cada
 * escena, capturar el estado real y compararlo con la lámina.
 *
 * Uso:
 *   node scripts/capture.mjs                        -> todas las escenas
 *   CAPTURE_ONLY=01,02,07 node scripts/capture.mjs  -> solo esas escenas
 *   node scripts/capture.mjs --out docs/capturas-arte/e1
 *
 * Escribe _reporte.json con draw calls, triángulos y errores de consola.
 */
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? process.argv[argOut + 1] : 'docs/capturas-arte';
mkdirSync(OUT, { recursive: true });

const ONLY = (process.env.CAPTURE_ONLY || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const want = (name) => ONLY.length === 0 || ONLY.some((prefix) => name.startsWith(prefix));

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
  .filter(Boolean)
  .find((path) => existsSync(path));

if (!CHROME) {
  console.error('No se encontró Chrome. Define CHROME_PATH.');
  process.exit(1);
}

const PORT = Number(process.env.CAPTURE_PORT || 5204);
const server = spawn(process.execPath, ['scripts/dev.mjs'], {
  env: { ...process.env, PORT: String(PORT), LIVE_RELOAD: '0' },
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { startedAt: new Date().toISOString(), scenes: [], errors: [] };

let browser;
try {
  await sleep(1200);
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text());
  });
  page.on('pageerror', (error) => report.errors.push(String(error)));

  const viewport = async (width, height) => {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await sleep(700);
  };

  /**
   * Fuerza un render antes de leer: en pausa o con un overlay abierto el
   * bucle no dibuja y `renderer.info` se reinicia a cero cada frame.
   */
  const metrics = async () => {
    return page.evaluate(() => {
      const game = window.__orbital;
      // El juego desactiva el auto-reset de info: hay que reiniciarlo a mano
      // o el render forzado se suma al frame anterior y duplica las cifras.
      game?.renderer?.info?.reset?.();
      game?.postFX?.render?.(0.016);
      const info = game?.renderer?.info?.render ?? {};
      return { calls: info.calls ?? 0, triangles: info.triangles ?? 0 };
    });
  };

  const shot = async (name, { size = [1920, 1080], settle = 500 } = {}) => {
    await viewport(size[0], size[1]);
    await sleep(settle);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const m = await metrics();
    report.scenes.push({ name, size, ...m });
    console.log(`  ${name.padEnd(34)} ${size[0]}x${size[1]}  ${m.calls} calls · ${m.triangles} tris`);
  };

  const evaluate = (fn, arg) => page.evaluate(fn, arg);

  await viewport(1920, 1080);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await sleep(2600);

  // ------------------------------------------------------------ 01 entrada
  if (want('01')) {
    await shot('01-entrada-1920');
    for (const size of [[1366, 768], [1280, 720], [1024, 600]]) {
      await shot(`01-entrada-${size[0]}x${size[1]}`, { size });
    }
  }

  // --------------------------------------------------------------- 02 menú
  const needMenu =
    want('02') || want('03') || want('04') || want('05') || want('06') || want('18');
  if (needMenu) {
    await evaluate(() => window.__orbital.enterMenu());
    await sleep(900);
  }

  if (want('02')) {
    await shot('02-menu-sin-guardado-1920');
    for (const size of [[1366, 768], [1280, 720]]) {
      await shot(`02-menu-${size[0]}x${size[1]}`, { size });
    }
  }

  // -------------------------------------------------------- 03 interfaces
  const overlays = [
    ['03-diseno-mision', () => window.__orbital.openDesign()],
    ['04-academia', () => window.__orbital.openAcademy()],
    ['05-centro-datos', () => window.__orbital.openDataCenter()],
    ['06-manual', () => window.__orbital.openManual()],
  ];
  for (const [name, open] of overlays) {
    if (!want(name.slice(0, 2))) continue;
    await viewport(1920, 1080);
    await evaluate(open);
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const m = await metrics();
    report.scenes.push({ name, size: [1920, 1080], ...m });
    console.log(`  ${name.padEnd(34)} overlay`);
    await evaluate(() => window.__orbital.closeOverlays());
    await sleep(500);
  }

  // ---------------------------------------------------------------- partida
  const gameScenes = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
  if (gameScenes.some(want)) {
    await evaluate(() => window.__orbital.startNewGame());
    await sleep(1400);

    const teleport = async ({ x, y, z, yaw = 0, pitch = 0.14, planet = false }) => {
      await evaluate(
        ({ x, y, z, yaw, pitch, planet }) => {
          const game = window.__orbital;
          const body = game.player.body;
          const ground = planet ? game.planet.groundHeightAt(x, z) : y;
          body.position.set(x, ground + game.player.halfHeight, z);
          body.velocity.setZero();
          game.player.group.position.copy(body.position);
          game.player.sync(0.016, game.camera);
          game._refreshZone(true);
          game.cameraRig.yaw = yaw;
          game.cameraRig.pitch = pitch;
          game.cameraRig.distance = game.cameraRig.targetDistance;
          game.cameraRig.snap(game.player.group.position);
        },
        { x, y, z, yaw, pitch, planet }
      );
      await sleep(900);
    };

    if (want('07')) {
      await evaluate(() => window.__orbital.pause());
      await sleep(700);
      await shot('07-pausa-1920');
      await evaluate(() => window.__orbital.resume());
      await sleep(600);
    }

    if (want('08')) {
      await teleport({ x: 0, y: -10.4, z: 0.4, yaw: 0, pitch: 0.12 });
      await shot('08-interior-pasillo');
    }
    if (want('09')) {
      await teleport({ x: 0, y: -10.4, z: -11.2, yaw: 0, pitch: 0.1 });
      await shot('09-puente');
    }
    if (want('10')) {
      await teleport({ x: 4.5, y: -10.4, z: -17.0, yaw: 0, pitch: 0.1 });
      await shot('10-ingenieria');
    }
    if (want('11')) {
      await teleport({ x: 16.5, y: -10.4, z: -7.0, yaw: Math.PI / 2, pitch: 0.16 });
      await shot('11-hangar');
    }

    if (want('12')) {
      await teleport({ x: 20, y: -10.4, z: -3, yaw: Math.PI / 2, pitch: 0.1 });
      await evaluate(() => window.__orbital._boardShip());
      await sleep(1000);
      await evaluate(() => window.__orbital.closePanel());
      await sleep(700);
      await shot('12-cabina-nave');
      await evaluate(() => window.__orbital._exitShip());
      await sleep(700);
    }

    if (want('13')) {
      await evaluate(() => {
        const game = window.__orbital;
        game.state = 'paused';
        game.hud.hide();
        game.hud.screen(null);
        document.querySelectorAll('.screen').forEach((screen) => screen.classList.add('hidden'));
        game.camera.position.set(21, 9, 24);
        game.camera.lookAt(0, 0.5, 0);
        game.postFX.render(0.016);
        game.needsRender = true;
      });
      await sleep(800);
      await shot('13-estacion-exterior', { settle: 300 });
    }

    if (want('14') || want('15')) {
      await evaluate(() => {
        const game = window.__orbital;
        game.state = 'playing';
        game.hud.show();
        game._applyDestination('moon', { spawn: true, announce: false });
      });
      await sleep(1400);
      if (want('14')) {
        await teleport({ x: 0, y: 0, z: 15, yaw: 0, pitch: 0.1, planet: true });
        await shot('14-luna-superficie');
      }
      if (want('15')) {
        await teleport({ x: 0, y: 0, z: 24, yaw: 0, pitch: 0.18, planet: true });
        await shot('15-base-lunar');
      }
    }

    if (want('16') || want('17')) {
      await evaluate(() => {
        const game = window.__orbital;
        game.state = 'playing';
        game.hud.show();
        game._applyDestination('mars', { spawn: true, announce: false });
      });
      await sleep(1400);
      if (want('16')) {
        await teleport({ x: 0, y: 0, z: 15, yaw: 0, pitch: 0.1, planet: true });
        await shot('16-marte-superficie');
      }
      if (want('17')) {
        await teleport({ x: 0, y: 0, z: 24, yaw: 0, pitch: 0.18, planet: true });
        await shot('17-base-marciana');
      }
    }
  }

  // 18 menú con guardado (jerarquía dinámica).
  if (want('18')) {
    await evaluate(() => {
      const game = window.__orbital;
      game._applyDestination('station', { spawn: false, announce: false });
      game.saveGame(true);
      game.exitToMenu();
    });
    await sleep(1200);
    await shot('18-menu-con-guardado-1920');
  }

  report.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/_reporte.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n  Capturas: ${report.scenes.length} · errores de consola: ${report.errors.length}`);
  if (report.errors.length) console.log(report.errors.join('\n'));
} finally {
  if (browser) await browser.close();
  server.kill();
}
