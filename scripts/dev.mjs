import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve('public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

// Script que se inyecta solo cuando sirve este dev server (nunca en producción).
const RELOAD_SNIPPET = `<script>
(() => {
  if (window.__orbitalLive) return;
  window.__orbitalLive = true;
  const source = new EventSource('/__dev/events');
  source.addEventListener('reload', () => location.reload());
})();
</script>`;

/** IPv4 de la máquina, con las virtuales (VirtualBox/Docker/Hyper-V) al final. */
export function lanUrls() {
  const found = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      found.push({ name, address: address.address });
    }
  }

  const virtual = (ip) =>
    /^192\.168\.56\./.test(ip) || // VirtualBox host-only
    /^192\.168\.99\./.test(ip) || // Docker
    /^10\.0\.(75|2|3)\./.test(ip); // Hyper-V / WSL

  return found.sort((a, b) => Number(virtual(a.address)) - Number(virtual(b.address)));
}

function printBanner(port, host, liveReload) {
  const lines = [`\nORBITAL listo en http://localhost:${port}`];

  if (host === '0.0.0.0' || host === '::') {
    const lan = lanUrls();
    if (lan.length) {
      lines.push('  Companeros en la misma red:');
      for (const { name, address } of lan) {
        lines.push(`    http://${address}:${port}  (${name})`);
      }
    } else {
      lines.push('  Sin interfaces de red detectadas (solo local).');
    }
  }

  lines.push(liveReload ? '  Live reload activo: al guardar un archivo se recargan los navegadores.' : '  Live reload desactivado.');
  lines.push('  Para compartir por internet: npm run share\n');
  console.log(lines.join('\n'));
}

/**
 * Servidor estático de desarrollo con live reload por Server-Sent Events.
 * Sólo expone `public/` en modo lectura.
 */
export function startDevServer({
  port = Number(process.env.PORT || 5173),
  host = process.env.HOST || '0.0.0.0',
  liveReload = process.env.LIVE_RELOAD !== '0',
} = {}) {
  const clients = new Set();
  let watcher = null;
  let heartbeat = null;
  let debounce = null;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/__dev/events') {
      if (!liveReload) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.write('retry: 1000\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }

    try {
      if (pathname.endsWith('/')) pathname += 'index.html';

      const file = resolve(join(root, normalize(pathname)));
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      let data = await readFile(file);
      const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';

      if (liveReload && type.startsWith('text/html')) {
        data = Buffer.from(data.toString('utf8').replace('</body>', `${RELOAD_SNIPPET}\n</body>`));
      }

      response.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Orbital-Dev': '1',
      });
      response.end(data);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — Not found');
    }
  });

  if (liveReload) {
    try {
      watcher = watch(root, { recursive: true }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          for (const client of clients) client.write('event: reload\ndata: now\n\n');
        }, 120);
      });
    } catch (error) {
      console.warn(`No se pudo vigilar ${root} para live reload: ${error.message}`);
    }

    heartbeat = setInterval(() => {
      for (const client of clients) client.write(': ping\n\n');
    }, 20_000);
    heartbeat.unref();
  }

  server.on('close', () => {
    clearTimeout(debounce);
    if (heartbeat) clearInterval(heartbeat);
    if (watcher) watcher.close();
    for (const client of clients) client.end();
    clients.clear();
  });

  server.listen(port, host, () => printBanner(port, host, liveReload));
  return server;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  const server = startDevServer();
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
