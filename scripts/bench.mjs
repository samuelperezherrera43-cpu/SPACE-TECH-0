/**
 * Benchmark reproducible del render.
 *
 * Uso:
 *   node scripts/bench.mjs --label baseline
 *   node scripts/bench.mjs --label p37-after-exterior --view exterior
 *   node scripts/bench.mjs --label p37-after-interior --view interior
 *
 * Desde SPACE-TECH 3.7 sólo existe un perfil gráfico estándar, así que no hay
 * argumento de calidad. Mide FPS y frame time con requestAnimationFrame durante
 * 5 s, además de draw calls, triángulos y memoria de Three.js. Guarda el
 * resultado en docs/benchmarks/<label>.json.
 */
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const label = getArg('label', 'run');
const duration = Number(getArg('duration', '5000'));
const port = Number(getArg('port', '5201'));
const view = getArg('view', 'exterior');
const world = getArg('world', 'station');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!executablePath) {
  console.error('No se encontró Chrome/Chromium. Define CHROME_PATH.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const server = spawn(process.execPath, ['scripts/dev.mjs'], {
  env: { ...process.env, PORT: String(port), LIVE_RELOAD: '0' },
  stdio: 'ignore',
});

let browser;
let failures = 0;

try {
  // Esperar al servidor.
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) { ready = true; break; }
    } catch {
      // reintentar
    }
    await sleep(250);
  }
  if (!ready) throw new Error(`El servidor no respondió en el puerto ${port}`);

  browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1280,800',
      '--hide-scrollbars',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => !!window.__orbital, { timeout: 15000 });

  // Entrar al menú y comenzar una partida nueva mediante gestos reales.
  await page.click('#btn-enter');
  await sleep(350);
  await page.click('#btn-menu-new');
  await sleep(1500);

  // El perfil gráfico es único (estándar) desde 3.7; no se aplica ningún preset.

  // Fijar una vista comparable: exterior desde 18 m, interior del pasillo o
  // una base planetaria (Luna / Marte) desde la explanada.
  await page.evaluate((viewName, worldName) => {
    const game = window.__orbital;
    if (worldName !== 'station') {
      game._applyDestination(worldName, { spawn: false, announce: false });
      game.state = 'playing';
    }
    if (viewName === 'hangar') {
      game.player.body.position.set(20, game.interior.floor + game.player.halfHeight, -3);
    } else if (viewName === 'interior') {
      game.player.body.position.set(0, game.interior.floor + game.player.halfHeight, -3);
    } else if (worldName !== 'station') {
      const x = 0;
      const z = 16;
      const ground = game.planet.groundHeightAt(x, z);
      game.player.body.position.set(x, ground + game.player.halfHeight + 0.1, z);
    } else {
      game.player.body.position.set(0, 2, 18);
    }
    game.player.body.velocity.setZero();
    game.player.body.angularVelocity.setZero();
    game.player.sync(0.016, game.camera);
    game._refreshZone(false);

    game.cameraRig.yaw = 0;
    game.cameraRig.pitch = 0.16;
    game.cameraRig.distance = worldName === 'station' ? 6.2 : 11;
    game.cameraRig.targetDistance = game.cameraRig.distance;
    game.cameraRig.snap(game.player.group.position);

    // No mover al jugador durante la medición.
    game.controls.keys.clear();
    game.controls.pad.moveX = 0;
    game.controls.pad.moveY = 0;
    game.controls.pad.moveZ = 0;
    game.controls.pad.boost = false;
    game.controls.pad.repair = false;
    game.controls.mouse.left = false;
  }, view, world);
  await sleep(600);

  const result = await page.evaluate(async (ms) => {
    const game = window.__orbital;
    const frames = [];
    const start = performance.now();
    let last = start;

    await new Promise((resolvePromise) => {
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        if (now - start < ms) requestAnimationFrame(tick);
        else resolvePromise();
      };
      requestAnimationFrame(tick);
    });

    const durationMs = performance.now() - start;
    const sorted = frames.slice().sort((a, b) => a - b);
    const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    const mean = frames.reduce((sum, value) => sum + value, 0) / Math.max(1, frames.length);

    const gl = game.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const info = game.renderer.info;

    return {
      frames: frames.length,
      durationMs,
      fps: (frames.length / durationMs) * 1000,
      frameMsMean: mean,
      frameMsP50: percentile(0.5),
      frameMsP95: percentile(0.95),
      frameMsP99: percentile(0.99),
      frameMsMin: sorted[0] ?? 0,
      frameMsMax: sorted[sorted.length - 1] ?? 0,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs ? info.programs.length : null,
      pixelRatio: game.renderer.getPixelRatio(),
      canvas: [game.renderer.domElement.width, game.renderer.domElement.height],
      state: game.state,
      activeBreaches: game.station.active.length,
      quality: game.quality ? game.quality.current : null,
      glRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      glVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  }, duration);

  result.label = label;
  result.view = view;
  result.world = world;
  result.timestamp = new Date().toISOString();
  result.errors = errors;
  if (errors.length) failures++;

  mkdirSync('docs/benchmarks', { recursive: true });
  const outPath = resolve('docs/benchmarks', `${label}.json`);
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  await page.screenshot({ path: resolve('docs/benchmarks', `${label}.png`) });

  console.log(`\nBenchmark: ${label} · vista ${view} · mundo ${world}`);
  console.log(`  FPS medio:      ${result.fps.toFixed(1)}`);
  console.log(`  Frame time:     ${result.frameMsMean.toFixed(2)} ms (p95 ${result.frameMsP95.toFixed(2)} ms)`);
  console.log(`  Draw calls:     ${result.drawCalls}`);
  console.log(`  Triángulos:     ${result.triangles}`);
  console.log(`  Memoria:        ${result.geometries} geometrías · ${result.textures} texturas`);
  console.log(`  GPU:            ${result.glRenderer}`);
  console.log(`  Guardado en:    ${outPath}`);

  if (errors.length) {
    console.error('\nErrores de consola:');
    for (const error of errors) console.error(`  - ${error}`);
  }
} catch (error) {
  failures++;
  console.error('Error en el benchmark:', error);
} finally {
  await browser?.close();
  server.kill();
  process.exit(failures === 0 ? 0 : 1);
}
