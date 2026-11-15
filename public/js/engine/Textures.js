import * as THREE from 'three';

/* ==========================================================================
   Texturas procedurales de ORBITAL.
   - Sin assets binarios: todo se dibuja en canvas al arrancar.
   - map (sRGB) + normalMap + roughnessMap para materiales PBR.
   - Las texturas de datos (normal/roughness) van en espacio lineal.
   ========================================================================== */

const cache = new Map();

function memo(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

function makeCanvas(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasTexture(canvas, { srgb = false, repeat = null } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (repeat) texture.repeat.set(repeat[0], repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

/* PRNG determinista: mismas texturas en cada carga. */
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------------------------------------------------
   Normal map desde un height map (Sobel + wrap).
   -------------------------------------------------------------------------- */

export function heightToNormal(source, strength = 1.2) {
  const width = source.width;
  const height = source.height;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  const data = sourceCtx.getImageData(0, 0, width, height).data;

  const normal = makeCanvas(width, height);
  const ctx = normal.getContext('2d');
  const image = ctx.createImageData(width, height);
  const out = image.data;

  const lum = (x, y) => {
    const ix = ((y + height) % height) * width + ((x + width) % width);
    const p = ix * 4;
    return (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx =
        (lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1)) -
        (lum(x - 1, y - 1) + 2 * lum(x - 1, y) + lum(x - 1, y + 1));
      const dy =
        (lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1)) -
        (lum(x - 1, y - 1) + 2 * lum(x, y - 1) + lum(x + 1, y - 1));

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;

      const i = (y * width + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return normal;
}

/* --------------------------------------------------------------------------
   Sprites suaves (glow, partículas, estrellas).
   -------------------------------------------------------------------------- */

export function makeGlowTexture() {
  return memo('glow', () => {
    const size = 128;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return canvasTexture(canvas, { srgb: true });
  });
}

/* --------------------------------------------------------------------------
   Atlas de señalización de las bases.
   Un único canvas con celdas de rótulo evita una textura y un draw call por
   cartel: todas las placas comparten material y se fusionan en una malla.
   -------------------------------------------------------------------------- */

const SIGN_COLS = 4;
const SIGN_ROWS = 8;
const SIGN_CELL_W = 256;
const SIGN_CELL_H = 64;

/**
 * @param {Array<{text: string, sub?: string}>} entries
 * @param {{color?: string, ink?: string}} [options]
 * @returns {{texture: THREE.Texture, cells: Array<{u0:number,v0:number,u1:number,v1:number}>}}
 */
export function makeSignAtlas(entries, options = {}) {
  const color = options.color ?? '#5ff0ff';
  const ink = options.ink ?? '#eaf6ff';
  const key = `signs-${color}-${ink}-${entries.map((e) => `${e.text}/${e.sub ?? ''}`).join(';')}`;

  return memo(key, () => {
    const canvas = makeCanvas(SIGN_COLS * SIGN_CELL_W, SIGN_ROWS * SIGN_CELL_H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#060b11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cells = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const col = i % SIGN_COLS;
      const row = Math.floor(i / SIGN_COLS);
      const x = col * SIGN_CELL_W;
      const y = row * SIGN_CELL_H;

      const gradient = ctx.createLinearGradient(x, y, x, y + SIGN_CELL_H);
      gradient.addColorStop(0, '#16232f');
      gradient.addColorStop(1, '#0a1119');
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 2, y + 2, SIGN_CELL_W - 4, SIGN_CELL_H - 4);

      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, SIGN_CELL_W - 8, SIGN_CELL_H - 8);
      ctx.globalAlpha = 1;

      ctx.fillStyle = color;
      ctx.fillRect(x + 12, y + 16, 4, SIGN_CELL_H - 32);

      ctx.textBaseline = 'middle';
      ctx.fillStyle = ink;
      ctx.font = '700 30px "Segoe UI", Arial, sans-serif';
      ctx.fillText(entry.text, x + 28, y + 26);

      if (entry.sub) {
        ctx.fillStyle = color;
        ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(entry.sub, x + 28, y + 46);
      }

      cells.push({
        u0: x / canvas.width,
        v0: 1 - (y + SIGN_CELL_H) / canvas.height,
        u1: (x + SIGN_CELL_W) / canvas.width,
        v1: 1 - y / canvas.height,
      });
    }

    const texture = canvasTexture(canvas, { srgb: true });
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { texture, cells };
  });
}

/**
 * Ventana iluminada vista desde fuera. Sustituye al cristal transparente sobre
 * un interior vacío, que de noche se leía como un agujero negro. Las siluetas
 * son mobiliario estático, no personajes.
 */
export function makeWindowTexture() {
  return memo('window-lit', () => {
    const width = 256;
    const height = 128;
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#08121c');
    gradient.addColorStop(0.5, '#1b2a36');
    gradient.addColorStop(1, '#3a2b1e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const lamp = ctx.createRadialGradient(width * 0.5, height * 0.95, 0, width * 0.5, height * 0.95, height * 0.8);
    lamp.addColorStop(0, 'rgba(255,196,128,0.9)');
    lamp.addColorStop(0.45, 'rgba(255,160,90,0.35)');
    lamp.addColorStop(1, 'rgba(255,140,70,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, width, height);

    // Mobiliario y equipos: manchas oscuras que dan profundidad.
    ctx.fillStyle = 'rgba(5,9,13,0.92)';
    ctx.fillRect(width * 0.08, height * 0.5, width * 0.17, height * 0.36);
    ctx.fillRect(width * 0.73, height * 0.44, width * 0.15, height * 0.42);
    ctx.fillRect(width * 0.4, height * 0.62, width * 0.18, height * 0.24);

    ctx.fillStyle = 'rgba(255,205,150,0.4)';
    ctx.fillRect(0, height * 0.63, width, 2);

    ctx.fillStyle = 'rgba(120,220,255,0.5)';
    ctx.fillRect(width * 0.1, height * 0.56, width * 0.12, 2);
    ctx.fillRect(width * 0.75, height * 0.5, width * 0.1, 2);

    // Montantes del ventanal.
    ctx.fillStyle = 'rgba(4,8,12,0.9)';
    for (let i = 1; i < 4; i++) ctx.fillRect((i * width) / 4 - 2, 0, 4, height);

    return canvasTexture(canvas, { srgb: true });
  });
}

/**
 * Regolito compactado: grano fino, guijarros y rodadas. Se usa en la
 * explanada de la base para que no lea como una losa de hormigón.
 */
export function makeRegolithTextures(size = 256) {
  return memo(`regolith-${size}`, () => {
    const random = mulberry32(0x9e3779b9);

    const base = makeCanvas(size);
    const ctx = base.getContext('2d');
    ctx.fillStyle = '#8d9299';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 9000; i++) {
      const value = 105 + Math.floor(random() * 95);
      ctx.fillStyle = `rgba(${value},${value},${value},0.5)`;
      ctx.fillRect(random() * size, random() * size, 1.4, 1.4);
    }

    for (let i = 0; i < 220; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 0.6 + random() * 2.6;
      const value = 90 + Math.floor(random() * 80);
      ctx.fillStyle = `rgba(${value},${value},${value},0.75)`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rodadas de rover: dos bandas tenues y continuas.
    ctx.strokeStyle = 'rgba(70,74,80,0.35)';
    ctx.lineWidth = size * 0.045;
    for (const offset of [0.34, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(0, size * offset);
      ctx.bezierCurveTo(size * 0.3, size * (offset - 0.03), size * 0.7, size * (offset + 0.03), size, size * offset);
      ctx.stroke();
    }

    const height = makeCanvas(size);
    const heightCtx = height.getContext('2d');
    heightCtx.drawImage(base, 0, 0);

    const rough = makeCanvas(size);
    const roughCtx = rough.getContext('2d');
    roughCtx.fillStyle = '#e8e8e8';
    roughCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 400; i++) {
      const value = 170 + Math.floor(random() * 60);
      roughCtx.fillStyle = `rgba(${value},${value},${value},0.5)`;
      roughCtx.fillRect(random() * size, random() * size, 3, 3);
    }

    return {
      map: canvasTexture(base, { srgb: true, repeat: [1, 1] }),
      normalMap: canvasTexture(heightToNormal(height, 0.55), { repeat: [1, 1] }),
      roughnessMap: canvasTexture(rough, { repeat: [1, 1] }),
    };
  });
}

export function makeParticleTexture() {
  return memo('particle', () => {
    const size = 64;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.16)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return canvasTexture(canvas, { srgb: true });
  });
}

/* --------------------------------------------------------------------------
   Grieta de fuga (plano aditivo sobre el casco).
   -------------------------------------------------------------------------- */

export function makeCrackTexture() {
  return memo('crack', () => {
    const size = 128;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const random = mulberry32(7);

    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.lineCap = 'round';

    const center = size / 2;
    const branches = 5;

    for (let b = 0; b < branches; b++) {
      const angle = (b / branches) * Math.PI * 2 + random() * 0.6;
      let x = center + Math.cos(angle) * 6;
      let y = center + Math.sin(angle) * 6;
      let a = angle;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = 2.6;

      const segments = 4 + Math.floor(random() * 3);
      for (let s = 0; s < segments; s++) {
        a += (random() - 0.5) * 0.7;
        x += Math.cos(a) * (size * 0.09);
        y += Math.sin(a) * (size * 0.09);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const gradient = ctx.createRadialGradient(center, center, 0, center, center, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, 16, 0, Math.PI * 2);
    ctx.fill();

    return canvasTexture(canvas, { srgb: true });
  });
}

/* --------------------------------------------------------------------------
   Casco: paneles, remaches, arañazos. Color + normal + roughness.
   -------------------------------------------------------------------------- */

function drawHullBase(size, random) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b9c4d2';
  ctx.fillRect(0, 0, size, size);

  // Paneles grandes.
  const cells = 4;
  const step = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const shade = 172 + Math.floor(random() * 26);
      ctx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 18})`;
      ctx.fillRect(x * step + 1, y * step + 1, step - 2, step - 2);

      // Subpanel interior.
      const inset = step * 0.16;
      ctx.fillStyle = `rgba(255,255,255,${0.03 + random() * 0.05})`;
      ctx.fillRect(x * step + inset, y * step + inset, step - inset * 2, step - inset * 2);
    }
  }

  // Líneas de unión.
  ctx.strokeStyle = 'rgba(44, 56, 72, 0.55)';
  ctx.lineWidth = Math.max(1, size / 256);
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  // Remaches.
  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j < 10; j++) {
      const x = i * step + (random() - 0.5) * step * 0.1;
      const y = (j + 0.5) * (size / 10);
      ctx.fillStyle = random() > 0.5 ? 'rgba(245,250,255,0.65)' : 'rgba(60,72,88,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, size / 220), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Arañazos y desgaste.
  for (let i = 0; i < 90; i++) {
    const x = random() * size;
    const y = random() * size;
    const length = 2 + random() * size * 0.09;
    const angle = random() * Math.PI * 2;
    ctx.strokeStyle = random() > 0.5
      ? `rgba(255,255,255,${0.08 + random() * 0.16})`
      : `rgba(45,55,70,${0.05 + random() * 0.12})`;
    ctx.lineWidth = random() > 0.85 ? 1.6 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  // Manchas suaves.
  for (let i = 0; i < 18; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.02 + random() * 0.08);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(35, 45, 60, ${0.04 + random() * 0.08})`);
    gradient.addColorStop(1, 'rgba(35, 45, 60, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  return canvas;
}

function drawHullHeight(size, random) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const cells = 4;
  const step = size / cells;

  // Uniones hundidas.
  ctx.strokeStyle = 'rgba(40,40,40,0.95)';
  ctx.lineWidth = Math.max(2, size / 128);
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  // Remaches elevados.
  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j < 10; j++) {
      const x = i * step + (random() - 0.5) * step * 0.1;
      const y = (j + 0.5) * (size / 10);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 150);
      gradient.addColorStop(0, 'rgba(230,230,230,1)');
      gradient.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size / 150, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Micro-relieve.
  for (let i = 0; i < 160; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillStyle = `rgba(${100 + Math.floor(random() * 80)},${100 + Math.floor(random() * 80)},${100 + Math.floor(random() * 80)},0.18)`;
    ctx.fillRect(x, y, 1 + random() * 3, 1 + random() * 3);
  }

  return canvas;
}

function drawHullRoughness(size, random) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, size, size);

  const cells = 4;
  const step = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const shade = 140 + Math.floor(random() * 40);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
    }
  }

  // Las juntas son más rugosas.
  ctx.strokeStyle = 'rgba(210,210,210,0.8)';
  ctx.lineWidth = Math.max(1, size / 256);
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  for (let i = 0; i < 60; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.01 + random() * 0.06);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const shade = 110 + Math.floor(random() * 90);
    gradient.addColorStop(0, `rgba(${shade},${shade},${shade},0.35)`);
    gradient.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  return canvas;
}

export function makeHullTextures(size = 256) {
  return memo(`hull-${size}`, () => {
    const random = mulberry32(101);
    const base = drawHullBase(size, random);
    const height = drawHullHeight(size, random);
    const rough = drawHullRoughness(size, random);
    return {
      map: canvasTexture(base, { srgb: true, repeat: [2, 2] }),
      normalMap: canvasTexture(heightToNormal(height, 1.35), { repeat: [2, 2] }),
      roughnessMap: canvasTexture(rough, { repeat: [2, 2] }),
    };
  });
}

/* --------------------------------------------------------------------------
   Metal oscuro: paneles de brazos, mochila, herramientas.
   -------------------------------------------------------------------------- */

export function makeDarkMetalTextures(size = 256) {
  return memo(`dark-${size}`, () => {
    const random = mulberry32(202);
    const base = makeCanvas(size);
    const ctx = base.getContext('2d');
    ctx.fillStyle = '#39424f';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 5; i++) {
      const y = (i / 5) * size;
      ctx.fillStyle = `rgba(255,255,255,${0.02 + random() * 0.04})`;
      ctx.fillRect(0, y + 2, size, size / 5 - 4);
    }

    for (let i = 0; i < 70; i++) {
      const x = random() * size;
      const y = random() * size;
      const length = 2 + random() * size * 0.12;
      const angle = random() * Math.PI * 2;
      ctx.strokeStyle = random() > 0.6
        ? `rgba(180,200,225,${0.05 + random() * 0.15})`
        : `rgba(15,20,28,${0.1 + random() * 0.2})`;
      ctx.lineWidth = random() > 0.8 ? 1.4 : 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }

    const height = makeCanvas(size);
    const hctx = height.getContext('2d');
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const x = random() * size;
      const y = random() * size;
      hctx.fillStyle = `rgba(${60 + Math.floor(random() * 120)},${60 + Math.floor(random() * 120)},${60 + Math.floor(random() * 120)},0.5)`;
      hctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    }

    const rough = makeCanvas(size);
    const rctx = rough.getContext('2d');
    rctx.fillStyle = '#8c8c8c';
    rctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = size * (0.02 + random() * 0.08);
      const gradient = rctx.createRadialGradient(x, y, 0, x, y, radius);
      const shade = 90 + Math.floor(random() * 100);
      gradient.addColorStop(0, `rgba(${shade},${shade},${shade},0.4)`);
      gradient.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
      rctx.fillStyle = gradient;
      rctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    return {
      map: canvasTexture(base, { srgb: true, repeat: [2, 2] }),
      normalMap: canvasTexture(heightToNormal(height, 0.8), { repeat: [2, 2] }),
      roughnessMap: canvasTexture(rough, { repeat: [2, 2] }),
    };
  });
}

/* --------------------------------------------------------------------------
   Traje: tejido técnico blanco con costuras y suciedad leve.
   -------------------------------------------------------------------------- */

export function makeSuitTextures(size = 256) {
  return memo(`suit-${size}`, () => {
    const random = mulberry32(303);
    const base = makeCanvas(size);
    const ctx = base.getContext('2d');
    ctx.fillStyle = '#e4ebf5';
    ctx.fillRect(0, 0, size, size);

    // Trama del tejido.
    ctx.strokeStyle = 'rgba(160,175,195,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Costuras y paneles.
    ctx.strokeStyle = 'rgba(120, 140, 165, 0.35)';
    ctx.lineWidth = Math.max(1, size / 160);
    for (const x of [size * 0.22, size * 0.5, size * 0.78]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    // Suciedad sutil.
    for (let i = 0; i < 30; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = size * (0.01 + random() * 0.05);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(120, 130, 145, ${0.03 + random() * 0.06})`);
      gradient.addColorStop(1, 'rgba(120, 130, 145, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    const height = makeCanvas(size);
    const hctx = height.getContext('2d');
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size; i += 4) {
      hctx.fillStyle = 'rgba(110,110,110,0.35)';
      hctx.fillRect(i, 0, 1, size);
      hctx.fillRect(0, i, size, 1);
    }

    const rough = makeCanvas(size);
    const rctx = rough.getContext('2d');
    rctx.fillStyle = '#c4c4c4';
    rctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = size * (0.02 + random() * 0.07);
      const gradient = rctx.createRadialGradient(x, y, 0, x, y, radius);
      const shade = 160 + Math.floor(random() * 60);
      gradient.addColorStop(0, `rgba(${shade},${shade},${shade},0.3)`);
      gradient.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
      rctx.fillStyle = gradient;
      rctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    return {
      map: canvasTexture(base, { srgb: true, repeat: [1, 1] }),
      normalMap: canvasTexture(heightToNormal(height, 0.55), { repeat: [1, 1] }),
      roughnessMap: canvasTexture(rough, { repeat: [1, 1] }),
    };
  });
}

/* --------------------------------------------------------------------------
   Panel solar: celdas azules, rejilla, normal y roughness.
   -------------------------------------------------------------------------- */

function drawSolarBase(size, random) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071426';
  ctx.fillRect(0, 0, size, size);

  const cells = 8;
  const step = size / cells;

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const shade = 16 + Math.floor(random() * 26);
      const gradient = ctx.createLinearGradient(x * step, y * step, (x + 1) * step, (y + 1) * step);
      gradient.addColorStop(0, `rgb(${shade + 6}, ${shade + 38}, ${shade + 96})`);
      gradient.addColorStop(1, `rgb(${shade}, ${shade + 24}, ${shade + 74})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x * step + 1.5, y * step + 1.5, step - 3, step - 3);
    }
  }

  ctx.strokeStyle = 'rgba(130, 205, 255, 0.24)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  return canvas;
}

function drawSolarHeight(size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6e6e6e';
  ctx.fillRect(0, 0, size, size);
  const cells = 8;
  const step = size / cells;
  ctx.strokeStyle = 'rgba(210,210,210,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  return canvas;
}

function drawSolarRoughness(size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, size, size);
  const cells = 8;
  const step = size / cells;
  ctx.strokeStyle = 'rgba(180,180,180,0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  return canvas;
}

export function makeSolarTextures(size = 256) {
  return memo(`solar-${size}`, () => {
    const random = mulberry32(404);
    return {
      map: canvasTexture(drawSolarBase(size, random), { srgb: true, repeat: [2, 1] }),
      normalMap: canvasTexture(heightToNormal(drawSolarHeight(size), 1.1), { repeat: [2, 1] }),
      roughnessMap: canvasTexture(drawSolarRoughness(size), { repeat: [2, 1] }),
    };
  });
}

/* --------------------------------------------------------------------------
   Tierra procedural: continentes, océanos, hielo, nubes y relieve.
   Usa ruido 3D sobre la esfera para evitar costuras.
   -------------------------------------------------------------------------- */

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smoothstep(x - xi);
  const yf = smoothstep(y - yi);
  const zf = smoothstep(z - zi);

  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = c000 + (c100 - c000) * xf;
  const x10 = c010 + (c110 - c010) * xf;
  const x01 = c001 + (c101 - c001) * xf;
  const x11 = c011 + (c111 - c011) * xf;
  const y0 = x00 + (x10 - x00) * yf;
  const y1 = x01 + (x11 - x01) * yf;
  return y0 + (y1 - y0) * zf;
}

function fbm3(x, y, z, seed, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise3(x * frequency, y * frequency, z * frequency, seed + i * 1013);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return value / total;
}

export function makeEarthTextures(width = 512, height = 256) {
  return memo(`earth-${width}x${height}`, () => {
    const base = makeCanvas(width, height);
    const ctx = base.getContext('2d');
    const image = ctx.createImageData(width, height);
    const data = image.data;

    const heightMap = makeCanvas(width, height);
    const hctx = heightMap.getContext('2d');
    const heightImage = hctx.createImageData(width, height);
    const hdata = heightImage.data;

    const clouds = makeCanvas(width, height);
    const cctx = clouds.getContext('2d');
    const cloudImage = cctx.createImageData(width, height);
    const cdata = cloudImage.data;

    const seed = 9001;

    for (let y = 0; y < height; y++) {
      const lat = (y / height) * Math.PI - Math.PI / 2;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      for (let x = 0; x < width; x++) {
        const lon = (x / width) * Math.PI * 2;
        const px = cosLat * Math.cos(lon);
        const py = sinLat;
        const pz = cosLat * Math.sin(lon);

        const continental = fbm3(px * 2.2, py * 2.2, pz * 2.2, seed, 5);
        const detail = fbm3(px * 7.0, py * 7.0, pz * 7.0, seed + 77, 3);
        const land = continental + detail * 0.18;
        const ice = Math.abs(sinLat) > 0.82 + detail * 0.08;

        let r;
        let g;
        let b;

        if (ice) {
          r = 226 + detail * 20;
          g = 235 + detail * 15;
          b = 245;
        } else if (land > 0.53) {
          // Tierra: verde, marrón y desierto según latitud/ruido.
          const dry = Math.max(0, Math.min(1, (detail - 0.35) * 2.2));
          const green = 70 + detail * 55;
          r = 88 + dry * 85 + detail * 30;
          g = green + dry * 30;
          b = 52 + dry * 20;
          if (Math.abs(sinLat) > 0.45 && detail > 0.52) {
            r += 35;
            g += 12;
          }
        } else {
          // Océano con profundidad variable.
          const depth = Math.max(0, Math.min(1, (0.53 - land) * 2.4));
          r = 10 + (1 - depth) * 18;
          g = 38 + (1 - depth) * 48;
          b = 82 + (1 - depth) * 72;
        }

        const i = (y * width + x) * 4;
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
        data[i + 3] = 255;

        // Relieve: océano casi plano, continentes con montañas.
        const elevation = ice ? 0.56 : land > 0.53 ? 0.52 + detail * 0.32 : 0.42 + detail * 0.03;
        hdata[i] = hdata[i + 1] = hdata[i + 2] = Math.round(elevation * 255);
        hdata[i + 3] = 255;

        // Nubes: bandas y remolinos.
        const cloudNoise = fbm3(px * 3.4 + 0.4, py * 3.4, pz * 3.4, seed + 555, 4);
        const bands = 0.5 + 0.5 * Math.sin(lat * 7.0 + cloudNoise * 5.0);
        const cloud = Math.max(0, (cloudNoise - 0.48) * 2.6) * (0.35 + bands * 0.65);
        cdata[i] = 255;
        cdata[i + 1] = 255;
        cdata[i + 2] = 255;
        cdata[i + 3] = Math.round(Math.min(1, cloud) * 210);
      }
    }

    ctx.putImageData(image, 0, 0);
    hctx.putImageData(heightImage, 0, 0);
    cctx.putImageData(cloudImage, 0, 0);

    return {
      map: canvasTexture(base, { srgb: true }),
      normalMap: canvasTexture(heightToNormal(heightMap, 0.9)),
      clouds: canvasTexture(clouds, { srgb: true }),
    };
  });
}

/* --------------------------------------------------------------------------
   Entorno equirectangular para PMREM (reflejos).
   -------------------------------------------------------------------------- */

export function makeSpaceEnvironmentTexture() {
  return memo('space-env', () => {
    const width = 512;
    const height = 256;
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const random = mulberry32(505);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#02040a');
    bg.addColorStop(0.5, '#050b16');
    bg.addColorStop(1, '#010206');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Sol.
    const sun = ctx.createRadialGradient(width * 0.78, height * 0.28, 0, width * 0.78, height * 0.28, width * 0.22);
    sun.addColorStop(0, 'rgba(255, 245, 220, 1)');
    sun.addColorStop(0.08, 'rgba(255, 235, 200, 0.9)');
    sun.addColorStop(0.35, 'rgba(255, 190, 120, 0.18)');
    sun.addColorStop(1, 'rgba(255, 180, 100, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    // Tierra.
    const earth = ctx.createRadialGradient(width * 0.18, height * 0.68, 0, width * 0.18, height * 0.68, width * 0.18);
    earth.addColorStop(0, 'rgba(60, 130, 210, 0.9)');
    earth.addColorStop(0.45, 'rgba(25, 70, 140, 0.45)');
    earth.addColorStop(1, 'rgba(10, 30, 70, 0)');
    ctx.fillStyle = earth;
    ctx.fillRect(0, 0, width, height);

    // Estrellas tenues.
    for (let i = 0; i < 220; i++) {
      const x = random() * width;
      const y = random() * height;
      const alpha = 0.15 + random() * 0.55;
      ctx.fillStyle = `rgba(210, 230, 255, ${alpha})`;
      ctx.fillRect(x, y, random() > 0.9 ? 1.6 : 1, random() > 0.9 ? 1.6 : 1);
    }

    const texture = canvasTexture(canvas, { srgb: true });
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  });
}
