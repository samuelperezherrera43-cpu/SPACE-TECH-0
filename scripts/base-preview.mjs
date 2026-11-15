/**
 * Capturas y auditoría de las bases planetarias — herramienta de desarrollo.
 *
 * No se sirve al juego. Permite comparar antes/después de cada pase artístico
 * con encuadres fijos y medir el coste real (draw calls) de cada módulo.
 *
 * Uso:
 *   node scripts/base-preview.mjs --world moon --out docs/capturas-arte/f1-lunar
 *   node scripts/base-preview.mjs --world mars --out docs/capturas-arte/f4-marte
 *   node scripts/base-preview.mjs --world moon --built all
 */
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const world = getArg('world', 'moon');
const built = getArg('built', 'all');
const outDir = getArg('out', `docs/capturas-arte/base-${world}`);
const PORT = Number(getArg('port', '5210'));
mkdirSync(outDir, { recursive: true });

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = spawn(process.execPath, ['scripts/dev.mjs'], {
  env: { ...process.env, PORT: String(PORT), LIVE_RELOAD: '0' },
  stdio: 'ignore',
});

const VIEWS = [
  { name: '01-aproximacion', pos: [0, 5.4, 16.5], look: [0, 2.0, 30] },
  { name: '02-tres-cuartos', pos: [27, 12, 5], look: [0, 1.6, 30] },
  { name: '03-aerea', pos: [24, 30, 66], look: [0, 0, 30] },
  { name: '04-habitat', pos: [0, 4.2, 16.5], look: [0, 1.8, 30] },
  { name: '05-control', pos: [8.6, 4.6, 23.6], look: [9.0, 1.7, 30.0] },
  { name: '06-energia', pos: [12.6, 4.4, 32.4], look: [8.6, 1.4, 38.0] },
  { name: '07-plataforma', pos: [15, 7.5, 15.5], look: [0, 1.8, 6] },
  { name: '08-esclusa', pos: [4.2, 2.6, 37.2], look: [-0.2, 1.5, 33.0] },
];

const report = { world, built, scenes: [], modules: [], errors: [] };
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

  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__orbital, { timeout: 20000 }).catch(() => {
    throw new Error(`La aplicación no arrancó. Errores:\n${report.errors.join('\n')}`);
  });
  await sleep(1200);

  await page.evaluate((target, mode) => {
    const game = window.__orbital;
    game.startNewGame();
    game._applyDestination(target, { spawn: true, announce: false });
    if (mode === 'all') {
      for (const module of game.planet.modules.values()) {
        if (!module.built) game.planet.completeModule(module.id);
      }
    }
    game.state = 'paused';
    game.hud.hide();
    game.hud.screen(null);
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.add('hidden'));
    game.needsRender = true;
  }, world, built);
  await sleep(1600);

  const metrics = () =>
    page.evaluate(() => {
      const game = window.__orbital;
      game.renderer.info.reset();
      game.postFX.render(0.016);
      const info = game.renderer.info.render;
      return { calls: info.calls, triangles: info.triangles };
    });

  for (const view of VIEWS) {
    await page.evaluate((v) => {
      const game = window.__orbital;
      game.camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
      game.camera.lookAt(v.look[0], v.look[1], v.look[2]);
      game.camera.updateMatrixWorld(true);
      game.needsRender = true;
      game.postFX.render(0.016);
    }, view);
    await sleep(500);
    await page.screenshot({ path: `${outDir}/${view.name}.png` });
    const m = await metrics();
    report.scenes.push({ name: view.name, ...m });
    console.log(`  ${view.name.padEnd(18)} ${String(m.calls).padStart(4)} calls · ${m.triangles} tris`);
  }

  // Coste por módulo: apaga sus mallas y mide la diferencia.
  const audit = await page.evaluate(() => {
    const game = window.__orbital;
    const planet = game.planet;
    const measure = () => {
      game.renderer.info.reset();
      game.postFX.render(0.016);
      return game.renderer.info.render.calls;
    };
    const total = measure();
    const rows = [];
    for (const module of planet.modules.values()) {
      const meshes = module.meshes ?? [];
      const visible = meshes.map((mesh) => mesh.visible);
      meshes.forEach((mesh) => (mesh.visible = false));
      const without = measure();
      meshes.forEach((mesh, i) => (mesh.visible = visible[i]));
      rows.push({ id: module.id, meshes: meshes.length, calls: total - without });
    }
    return { total, rows };
  });
  report.modules = audit.rows;

  console.log(`\n  Escena ${world}: ${audit.total} draw calls`);
  for (const row of audit.rows) {
    console.log(`    ${row.id.padEnd(12)} ${String(row.meshes).padStart(2)} mallas · ${row.calls} calls`);
  }

  writeFileSync(`${outDir}/_reporte.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n  Capturas: ${report.scenes.length} · errores de consola: ${report.errors.length}`);
  if (report.errors.length) console.log(report.errors.join('\n'));
} finally {
  if (browser) await browser.close();
  server.kill();
}
