import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Empaqueta el SDK oficial de Colyseus (@colyseus/sdk) como un único módulo
 * ESM para el navegador, sin build step en el cliente.
 *
 * Salida: public/vendor/colyseus-sdk.mjs (consumido por el importmap).
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const entry = resolve(root, 'node_modules/@colyseus/sdk/build/index.mjs');
const outfile = resolve(root, '../public/vendor/colyseus-sdk.mjs');

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"',
    global: 'globalThis',
  },
  logLevel: 'info',
});

console.log(`SDK empaquetado en ${outfile}`);
