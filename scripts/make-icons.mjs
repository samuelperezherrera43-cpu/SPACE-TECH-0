/**
 * Genera los iconos PNG de la PWA (sin dependencias externas).
 * Uso: node scripts/make-icons.mjs
 *
 * Dibuja el emblema de SPACE-TECH (anillo orbital + núcleo) con supersampling
 * para obtener bordes suaves, y escribe:
 *   public/assets/icon-192.png
 *   public/assets/icon-512.png
 *   public/assets/icon-maskable-512.png
 *   public/assets/apple-touch-icon.png (180x180)
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');

const BG = [4, 6, 13];
const CYAN = [95, 240, 255];
const CYAN_SOFT = [38, 120, 148];
const SS = 3; // supersampling

/* ------------------------------------------------------------- PNG encoder */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ dibujo */

function renderIcon(size, { maskable = false } = {}) {
  const big = size * SS;
  const pixels = Buffer.alloc(big * big * 4);

  const cx = big / 2;
  const cy = big / 2;
  // Zona segura para iconos maskable: el emblema se reduce un 22 %.
  const scale = maskable ? 0.78 : 1;
  const ringOuter = big * 0.315 * scale;
  const ringInner = big * 0.255 * scale;
  const core = big * 0.105 * scale;
  const tick = big * 0.045 * scale;

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);

      let color = BG;

      // Halo interior del disco.
      if (dist < ringOuter * 1.12) {
        const t = Math.max(0, 1 - dist / (ringOuter * 1.12));
        color = mix(BG, CYAN_SOFT, t * 0.35);
      }

      // Anillo orbital.
      if (dist <= ringOuter && dist >= ringInner) color = CYAN;

      // Núcleo.
      if (dist <= core) color = CYAN;

      // Cuatro marcas cardinales.
      const nearAxis = Math.abs(dx) < tick * 0.5 || Math.abs(dy) < tick * 0.5;
      if (nearAxis && dist > ringOuter * 1.18 && dist < ringOuter * 1.52) color = CYAN_SOFT;

      const offset = (y * big + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }

  // Reducción por caja (supersampling).
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const offset = (((y * SS + sy) * big) + (x * SS + sx)) * 4;
          r += pixels[offset];
          g += pixels[offset + 1];
          b += pixels[offset + 2];
        }
      }
      const count = SS * SS;
      const offset = (y * size + x) * 4;
      out[offset] = Math.round(r / count);
      out[offset + 1] = Math.round(g / count);
      out[offset + 2] = Math.round(b / count);
      out[offset + 3] = 255;
    }
  }

  return out;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/* -------------------------------------------------------------------- main */

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];

for (const [name, size, options] of targets) {
  const rgba = renderIcon(size, options);
  writeFileSync(join(OUT, name), encodePng(size, size, rgba));
  console.log(`icono: public/assets/${name} (${size}x${size})`);
}
