#!/usr/bin/env node
/**
 * Comprobación de salud del servidor multijugador.
 *
 * Uso:
 *   node scripts/health.mjs                      # http://localhost:2567
 *   node scripts/health.mjs https://mi-servidor  # servidor público
 */
const base = (process.argv[2] || process.env.SERVER_URL || 'http://localhost:2567').replace(/\/$/, '');

try {
  const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok || body.ok !== true) {
    console.error(`FALLO · ${response.status}`, body);
    process.exit(1);
  }
  console.log('SALUD OK');
  console.log(JSON.stringify(body, null, 2));
} catch (error) {
  console.error(`No se pudo alcanzar ${base}/health:`, error.message);
  process.exit(1);
}
