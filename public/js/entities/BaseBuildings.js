import * as THREE from 'three';

/**
 * Arquitectura de las bases planetarias.
 *
 * Cada módulo recibe el mismo volumen, centro y altura de terreno que tenía en
 * la versión anterior: la simulación (colliders, puntos de interacción,
 * `heightAt`) no cambia. Lo que cambia es la piel: casco con aristas
 * redondeadas, costillas, remates, esclusas, equipos exteriores, señalización,
 * ventanas iluminadas y luces. Todo se acumula en un `Kit` y se fusiona por
 * material.
 *
 * Convención del mundo: la plataforma de aterrizaje está al sur (-z) y las
 * puertas de los módulos al norte (+z). La fachada sur es la que se ve al
 * llegar, así que allí van ventanas y rótulos; la norte lleva la esclusa.
 */

const PI = Math.PI;
const T = 0.16; // grosor de muro
const DOOR = 1.8; // hueco de puerta, idéntico al colisionador

const round3 = (value) => Math.round(value * 1000) / 1000;
const uniq = (values) => [...new Set(values.map(round3))].sort((a, b) => a - b);

/* ============================================================== estructura */

/**
 * Muro con huecos. Divide la cara en bandas horizontales y, dentro de cada
 * banda, en segmentos entre huecos. Así la puerta y las ventanas son huecos
 * reales del casco y no calcomanías sobre una pared opaca.
 */
function wall(kit, m, side, holes, key) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  const zc = z + side * (d / 2 - T / 2);

  const xs = [-w / 2, w / 2];
  const ys = [0, h];
  for (const hole of holes) {
    xs.push(hole.x - hole.w / 2, hole.x + hole.w / 2);
    ys.push(hole.y - hole.h / 2, hole.y + hole.h / 2);
  }
  const ux = uniq(xs);
  const uy = uniq(ys);

  for (let j = 0; j < uy.length - 1; j++) {
    const y0 = uy[j];
    const y1 = uy[j + 1];
    if (y1 - y0 < 0.004) continue;
    const mid = (y0 + y1) / 2;
    const active = holes
      .filter((hole) => mid > hole.y - hole.h / 2 && mid < hole.y + hole.h / 2)
      .sort((a, b) => a.x - a.w / 2 - (b.x - b.w / 2));

    let cursor = -w / 2;
    for (const hole of active) {
      const a = hole.x - hole.w / 2;
      const b = hole.x + hole.w / 2;
      if (a > cursor + 0.004) {
        kit.box([a - cursor, y1 - y0, T], key, [x + (cursor + a) / 2, y + (y0 + y1) / 2, zc]);
      }
      cursor = Math.max(cursor, b);
    }
    if (cursor < w / 2 - 0.004) {
      kit.box([w / 2 - cursor, y1 - y0, T], key, [x + (cursor + w / 2) / 2, y + (y0 + y1) / 2, zc]);
    }
  }
}

/** Ventana iluminada: cristal emisivo en el hueco y marco metálico. */
function windowUnit(kit, m, hole) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  const zf = z - d / 2;
  const cx = x + hole.x;
  const cy = y + hole.y;

  kit.box([hole.w, hole.h, 0.04], 'window', [cx, cy, zf - 0.02]);

  const fw = 0.07;
  kit.box([hole.w + 0.2, fw, 0.1], 'metal', [cx, cy + hole.h / 2 + 0.05, zf - 0.06]);
  kit.box([hole.w + 0.2, fw, 0.1], 'metal', [cx, cy - hole.h / 2 - 0.05, zf - 0.06]);
  kit.box([fw, hole.h + 0.2, 0.1], 'metal', [cx - hole.w / 2 - 0.05, cy, zf - 0.06]);
  kit.box([fw, hole.h + 0.2, 0.1], 'metal', [cx + hole.w / 2 + 0.05, cy, zf - 0.06]);

  // Repisa inferior: remate que evita el borde "pegatina".
  kit.box([hole.w + 0.34, 0.06, 0.16], 'metal', [cx, cy - hole.h / 2 - 0.11, zf - 0.02]);
}

/**
 * Casco habitable: suelo, techo, dos muros laterales, fachada sur con ventanas
 * y fachada norte con hueco de puerta.
 */
function shell(kit, m, { windows = [], door = true, wallKey = 'hull' } = {}) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  kit.box([w - 0.26, 0.12, d - 0.26], 'dark', [x, y + 0.06, z]);
  kit.rbox([w + 0.18, 0.18, d + 0.18], wallKey, [x, y + h - 0.02, z], null, 0.06, 2);

  wall(kit, m, -1, windows, wallKey);
  wall(
    kit,
    m,
    1,
    door ? [{ x: 0, y: (h - 0.9) / 2, w: DOOR, h: h - 0.9 }] : [],
    wallKey
  );

  kit.box([T, h, d - 0.2], wallKey, [x - w / 2 + T / 2, y + h / 2, z]);
  kit.box([T, h, d - 0.2], wallKey, [x + w / 2 - T / 2, y + h / 2, z]);

  for (const hole of windows) windowUnit(kit, m, hole);
}

/** Cuerpo macizo para instalaciones que no se recorren por dentro. */
function solidBody(kit, m, key = 'hull') {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  kit.rbox([w, h, d], key, [x, y + h / 2, z], null, 0.08, 2);
  kit.box([w + 0.1, 0.1, d + 0.1], 'metal', [x, y + 0.2, z]);
}

/* ================================================================ detalles */

function belt(kit, m, height, thickness = 0.07, key = 'metal') {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  kit.box([w + 0.08, thickness, 0.1], key, [x, y + height, z - d / 2 - 0.1]);
  kit.box([w + 0.08, thickness, 0.1], key, [x, y + height, z + d / 2 + 0.1]);
  kit.box([0.1, thickness, d + 0.08], key, [x - w / 2 - 0.1, y + height, z]);
  kit.box([0.1, thickness, d + 0.08], key, [x + w / 2 + 0.1, y + height, z]);
}

function cornerLights(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.box([0.34, 0.08, 0.18], 'accent', [
        x + sx * (w / 2 - 0.22),
        y + h + 0.03,
        z + sz * (d / 2 + 0.02),
      ]);
    }
  }
}

/** Rótulo sobre placa: nunca queda flotando en el aire. */
function signPlate(kit, m, key, { w = 2, h = 0.48, y, x = 0, side = -1 }) {
  const [mw, mh, md] = m.size;
  const { x: mx, y: my, z: mz } = m;
  const zf = mz + side * (md / 2 + 0.04);
  kit.rbox([w + 0.16, h + 0.16, 0.07], 'panel', [mx + x, my + y, zf], null, 0.02, 1);
  kit.sign(key, [w, h], [mx + x, my + y, zf + side * 0.05], [0, side > 0 ? 0 : PI, 0]);
}

/** Esclusa de acceso al norte: pórtico, marquesina, rampa y barandilla. */
function doorPortal(kit, m, key) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  const zn = z + d / 2;
  const opening = h - 0.9;

  for (const s of [-1, 1]) {
    kit.rbox([0.3, opening, 0.26], 'panel', [x + s * (DOOR / 2 + 0.16), y + opening / 2, zn + 0.11], null, 0.04, 1);
  }
  // Dintel del pórtico.
  kit.rbox([DOOR + 0.92, 0.26, 0.3], 'panel', [x, y + opening - 0.02, zn + 0.11], null, 0.04, 1);

  // Marquesina de acceso.
  kit.rbox([DOOR + 1.7, 0.12, 1.3], 'panel', [x, y + h + 0.02, zn + 0.58], null, 0.03, 1);
  for (const s of [-1, 1]) {
    kit.beam(
      [x + s * (DOOR / 2 + 0.52), y + h, zn + 0.12],
      [x + s * (DOOR / 2 + 0.52), y + h - 0.62, zn + 1.0],
      0.06,
      'metal'
    );
  }
  kit.box([DOOR + 1.5, 0.05, 0.08], 'warm', [x, y + h - 0.02, zn + 1.16]);

  // Placa sobre el dintel, atornillada al muro.
  kit.sign(key, [1.5, 0.38], [x, y + h - 0.46, zn + 0.075]);
  kit.rbox([1.66, 0.54, 0.06], 'panel', [x, y + h - 0.46, zn + 0.03], null, 0.02, 1);

  // Rampa y barandillas.
  kit.rbox([DOOR + 1.1, 0.12, 1.45], 'grip', [x, y + 0.06, zn + 0.82], null, 0.03, 1);
  for (const s of [-1, 1]) {
    const px = x + s * (DOOR / 2 + 0.5);
    for (let i = 0; i < 3; i++) {
      kit.box([0.05, 0.9, 0.05], 'metal', [px, y + 0.48, zn + 0.34 + i * 0.5]);
    }
    kit.pipe([px, y + 0.92, zn + 0.3], [px, y + 0.92, zn + 1.5], 0.035, 'metal');
  }

  // Umbral luminoso y baliza de esclusa.
  kit.box([DOOR + 0.2, 0.05, 0.1], 'warm', [x, y + 0.14, zn + 0.05]);
  kit.box([0.14, 0.14, 0.14], 'accent', [x + DOOR / 2 + 0.34, y + 1.55, zn + 0.18]);
}

function roofVents(kit, m, count = 2) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  for (let i = 0; i < count; i++) {
    const px = count === 1 ? x : x - w / 3.2 + (i * (w * 0.64)) / (count - 1);
    kit.rbox([0.5, 0.3, 0.5], 'dark', [px, y + h + 0.16, z + d * 0.24], null, 0.04, 1);
    kit.cyl(0.16, 0.16, 0.12, 'metal', [px, y + h + 0.34, z + d * 0.24], null, 10);
  }
}

function radiator(kit, m, offsetX) {
  const { x, y, z } = m;
  const [w, h, d] = m.size;
  const px = x + offsetX;
  const pz = z + d * 0.22;
  kit.rbox([2.0, 0.07, 1.15], 'dark', [px, y + h + 0.32, pz], [-0.3, 0, 0], 0.03, 1);
  for (let i = 1; i < 4; i++) {
    kit.box([1.9, 0.03, 0.05], 'metal', [
      px,
      y + h + 0.34,
      pz - 0.5 + (i * 1.0) / 4,
    ], [-0.3, 0, 0]);
  }
}

function interior(kit, m, kind) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  kit.box([w - 0.7, 0.06, d - 0.7], 'dark', [x, y + 0.12, z]);
  kit.box([w - 1.0, 0.05, 0.12], 'warm', [x, y + h - 0.16, z]);

  // Vestíbulo de la esclusa: luz cálida justo dentro de la puerta norte para
  // que el hueco no se lea como un agujero negro desde fuera.
  kit.box([1.5, 0.05, 0.55], 'warm', [x, y + h - 0.18, z + d / 2 - 1.0]);
  kit.box([1.7, 0.04, 0.1], 'warm', [x, y + h - 0.5, z + d / 2 - 0.35]);
  kit.box([1.3, 0.03, 0.5], 'grip', [x, y + 0.15, z + d / 2 - 1.0]);

  if (kind === 'habitat') {
    for (const s of [-1, 1]) {
      kit.rbox([1.9, 0.5, 0.72], 'panel', [x, y + 0.4, z + s * (d / 2 - 1.1)], null, 0.04, 1);
      kit.box([1.6, 0.04, 0.12], 'warm', [x, y + h - 0.2, z + s * (d / 2 - 0.8)]);
    }
    kit.rbox([1.6, 0.8, 0.62], 'dark', [x - w / 2 + 0.75, y + 0.48, z + 0.4], null, 0.04, 1);
    kit.box([1.2, 0.38, 0.03], 'screen', [x - w / 2 + 0.75, y + 0.68, z + 0.73]);
    kit.rbox([0.7, 1.6, 0.5], 'grip', [x + w / 2 - 0.75, y + 0.8, z - d / 2 + 0.7], null, 0.04, 1);
  } else {
    kit.rbox([w - 1.1, 0.86, 0.62], 'panel', [x, y + 0.48, z - d / 2 + 0.72], null, 0.04, 1);
    kit.box([w - 1.3, 0.32, 0.03], 'screen', [x, y + 0.68, z - d / 2 + 1.04]);
    for (const s of [-1, 1]) {
      kit.rbox([0.5, 1.65, 0.5], 'grip', [x + s * (w / 2 - 0.6), y + 0.82, z + d / 2 - 0.65], null, 0.04, 1);
    }
    kit.cyl(0.22, 0.22, 1.5, 'gold', [x + w / 2 - 0.8, y + 0.75, z - 0.2], null, 12);
  }
}

/* ================================================================= módulos */

function habitat(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  shell(kit, m, {
    windows: [
      { x: -2.5, y: 1.92, w: 1.7, h: 0.95 },
      { x: 0, y: 1.92, w: 1.7, h: 0.95 },
      { x: 2.5, y: 1.92, w: 1.7, h: 0.95 },
    ],
  });
  belt(kit, m, 0.36);
  belt(kit, m, h - 0.26);
  cornerLights(kit, m);
  doorPortal(kit, m, 'hab');
  signPlate(kit, m, 'hab', { w: 2.3, h: 0.52, y: h - 0.44 });

  // Cúpula de observación.
  kit.cyl(0.95, 0.95, 0.26, 'metal', [x, y + h + 0.24, z - d * 0.2], null, 18);
  kit.sphere(0.95, 'glass', [x, y + h + 0.36, z - d * 0.2], null, 20, 10, PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    kit.beam(
      [x + Math.cos(a) * 0.95, y + h + 0.36, z - d * 0.2 + Math.sin(a) * 0.95],
      [x, y + h + 1.28, z - d * 0.2],
      0.045,
      'metal'
    );
  }

  radiator(kit, m, -2.3);
  radiator(kit, m, 2.3);
  roofVents(kit, m, 2);

  // Mástil de datos.
  kit.cyl(0.05, 0.05, 1.15, 'metal', [x + 3.15, y + h + 0.6, z - 1.95], null, 6);
  kit.dish(0.36, 0.1, 'dish', [x + 3.15, y + h + 1.2, z - 1.95], [PI, 0, 0], 14);

  interior(kit, m, 'habitat');
}

function control(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  shell(kit, m, {
    windows: [{ x: 0, y: 1.82, w: w * 0.72, h: 1.08 }],
  });
  belt(kit, m, 0.34);
  cornerLights(kit, m);
  doorPortal(kit, m, 'ctrl');
  signPlate(kit, m, 'ctrl', { w: 2.05, h: 0.48, y: h - 0.34 });

  // Torre de comunicaciones.
  const tx = x + w * 0.28;
  const tz = z - d * 0.2;
  const top = y + h + 2.7;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.beam(
        [tx + sx * 0.34, y + h + 0.1, tz + sz * 0.34],
        [tx + sx * 0.14, top, tz + sz * 0.14],
        0.05,
        'metal'
      );
    }
  }
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const r = 0.34 - 0.2 * t;
    const yy = y + h + 0.1 + (top - y - h - 0.1) * t;
    for (const s of [-1, 1]) {
      kit.beam([tx - r, yy, tz + s * r], [tx + r, yy, tz + s * r], 0.03, 'metal');
      kit.beam([tx + s * r, yy, tz - r], [tx + s * r, yy, tz + r], 0.03, 'metal');
    }
  }
  kit.dish(0.55, 0.16, 'dish', [tx, top + 0.28, tz], [PI - 0.5, 0.5, 0], 16);
  kit.cyl(0.05, 0.05, 0.4, 'metal', [tx, top + 0.2, tz], null, 6);
  kit.sphere(0.09, 'red', [tx, top + 0.46, tz], null, 8, 6);

  roofVents(kit, m, 1);
  kit.rbox([0.9, 0.55, 0.7], 'panel', [x - w * 0.26, y + h + 0.36, z + d * 0.22], null, 0.05, 1);
  kit.box([0.7, 0.3, 0.03], 'screen', [x - w * 0.26, y + h + 0.36, z + d * 0.22 + 0.36]);

  interior(kit, m, 'control');
}

function lab(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  shell(kit, m, {
    windows: [{ x: 0, y: 1.85, w: w * 0.64, h: 1.05 }],
  });
  belt(kit, m, 0.34);
  belt(kit, m, h - 0.24, 0.05, 'panel');
  cornerLights(kit, m);
  doorPortal(kit, m, 'lab');
  signPlate(kit, m, 'lab', { w: 2.05, h: 0.48, y: h - 0.34 });

  // Esclusa de muestras.
  kit.cyl(0.42, 0.42, 0.8, 'metal', [x + w / 2 + 0.34, y + 1.15, z - 0.45], [0, 0, PI / 2], 16);
  kit.cyl(0.46, 0.46, 0.08, 'dark', [x + w / 2 + 0.74, y + 1.15, z - 0.45], [0, 0, PI / 2], 16);
  kit.torus(0.16, 0.03, 'accent', [x + w / 2 + 0.79, y + 1.15, z - 0.45], [0, PI / 2, 0], 12, 5);

  // Botellas de gas y rack exterior.
  for (let i = 0; i < 3; i++) {
    kit.cyl(0.16, 0.16, 1.15, 'gold', [x + w / 2 + 0.34, y + 0.62, z + 0.85 + i * 0.42], null, 10);
    kit.cyl(0.17, 0.17, 0.06, 'metal', [x + w / 2 + 0.34, y + 1.22, z + 0.85 + i * 0.42], null, 10);
  }
  kit.rbox([0.5, 0.8, 1.2], 'dark', [x - w / 2 - 0.32, y + 0.55, z + 0.5], null, 0.04, 1);
  kit.box([0.04, 0.5, 1.0], 'screen', [x - w / 2 - 0.58, y + 0.62, z + 0.5]);

  roofVents(kit, m, 1);
  interior(kit, m, 'lab');
}

function greenhouse(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;
  const radius = Math.max(w, d) * 0.5;

  // Muro de regolito: protección contra radiación, como en los conceptos NASA.
  kit.cyl(radius + 0.26, radius + 0.42, 0.9, 'regolith', [x, y + 0.44, z], null, 30);
  kit.cyl(radius + 0.3, radius + 0.3, 0.1, 'metal', [x, y + 0.9, z], null, 30);

  kit.sphere(radius, 'glass', [x, y + 0.9, z], null, 30, 14, PI / 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI;
    kit.torus(radius, 0.05, 'metal', [x, y + 0.9, z], [0, a, 0], 22, 5, PI);
  }
  kit.torus(radius, 0.07, 'metal', [x, y + 0.92, z], [PI / 2, 0, 0], 30, 5);

  // Bancales y fitolámparas.
  for (const s of [-1, 1]) {
    kit.rbox([w * 0.6, 0.42, 0.85], 'dark', [x, y + 0.34, z + s * 1.1], null, 0.04, 1);
    kit.box([w * 0.56, 0.1, 0.75], 'green', [x, y + 0.55, z + s * 1.1]);
    kit.box([w * 0.48, 0.05, 0.08], 'warm', [x, y + 1.95, z + s * 1.05]);
  }

  // Pilar de rótulo al sur, delante del invernadero.
  const pz = z - radius - 0.55;
  kit.cyl(0.06, 0.06, 1.5, 'metal', [x, y + 0.75, pz], null, 6);
  kit.rbox([1.8, 0.56, 0.08], 'panel', [x, y + 1.45, pz], null, 0.02, 1);
  kit.sign('bio', [1.65, 0.42], [x, y + 1.45, pz - 0.06], [0, PI, 0]);
}

function power(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  solidBody(kit, m);
  belt(kit, m, 0.32);
  cornerLights(kit, m);
  roofVents(kit, m, 1);

  // Armario de conversión y baterías en la fachada sur.
  const cz = z - d / 2 - 0.36;
  kit.rbox([w * 0.54, 1.7, 0.66], 'dark', [x - w * 0.18, y + 0.92, cz], null, 0.05, 2);
  for (let i = 0; i < 4; i++) {
    kit.box([w * 0.48, 0.05, 0.03], 'grip', [x - w * 0.18, y + 0.5 + i * 0.32, cz - 0.35]);
  }
  kit.box([0.5, 0.34, 0.03], 'screen', [x - w * 0.18, y + 1.36, cz - 0.35]);
  kit.rbox([1.66, 0.52, 0.06], 'panel', [x - w * 0.18, y + 1.86, cz - 0.36], null, 0.02, 1);
  kit.sign('pwr', [1.5, 0.36], [x - w * 0.18, y + 1.86, cz - 0.4], [0, PI, 0]);

  // Seguidores solares delante, sobre la explanada.
  for (let i = 0; i < 3; i++) {
    const px = x - w * 0.3 + i * w * 0.3;
    const pz = z - d / 2 - 1.55;
    kit.cyl(0.07, 0.07, 1.0, 'metal', [px, y + 0.5, pz], null, 8);
    kit.rbox([1.5, 0.07, 1.15], 'solar', [px, y + 1.06, pz], [-0.55, 0, 0], 0.03, 1);
    kit.box([1.56, 0.05, 0.06], 'metal', [px, y + 1.06, pz - 0.55], [-0.55, 0, 0]);
    kit.box([1.56, 0.05, 0.06], 'metal', [px, y + 1.06, pz + 0.55], [-0.55, 0, 0]);
    kit.rbox([0.36, 0.22, 0.36], 'dark', [px, y + 0.11, pz], null, 0.03, 1);
  }

  // Conducto de potencia hacia el hábitat.
  kit.pipe([x - w / 2, y + 0.8, z + 0.9], [x - w / 2 - 1.8, y + 0.8, z + 0.9], 0.09, 'metal');
  kit.pipe([x - w / 2 - 1.8, y + 0.8, z + 0.9], [x - w / 2 - 1.8, y + 0.35, z + 0.9], 0.09, 'metal');
}

function storage(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  shell(kit, m, { windows: [] });
  belt(kit, m, 0.32);
  cornerLights(kit, m);
  doorPortal(kit, m, 'log');
  signPlate(kit, m, 'log', { w: 2.0, h: 0.46, y: h - 0.34 });

  // Contenedores apilados contra la fachada sur.
  const container = (cx, cy, cz, size, key, rot = 0) => {
    kit.rbox(size, key, [cx, cy, cz], [0, rot, 0], 0.05, 2);
    const [cw, ch, cd] = size;
    for (let i = 1; i < 5; i++) {
      kit.box([cw + 0.02, 0.05, cd + 0.02], 'metal', [cx, cy - ch / 2 + (i * ch) / 5, cz], [0, rot, 0]);
    }
    kit.box([0.06, ch * 0.92, cd * 0.06], 'dark', [cx + cw / 2 + 0.02, cy, cz], [0, rot, 0]);
  };

  const cz = z - d / 2 - 0.95;
  container(x - 1.05, y + 0.78, cz, [2.0, 1.5, 1.8], 'hull', 0.04);
  container(x + 1.05, y + 0.78, cz, [1.75, 1.5, 1.8], 'gold', -0.03);
  container(x, y + 2.3, cz, [2.1, 1.45, 1.8], 'panel', 0.02);

  for (const s of [-1, 1]) {
    kit.rbox([0.62, 0.55, 0.62], 'grip', [x + s * 2.05, y + 0.34, z + d / 2 + 0.95], [0, s * 0.3, 0], 0.04, 1);
  }

  // Puente grúa sobre el techo.
  kit.beam([x - w / 2, y + h + 0.4, z + 0.4], [x + w / 2, y + h + 0.4, z + 0.4], 0.1, 'metal');
  kit.box([0.34, 0.3, 0.4], 'accent', [x + w * 0.2, y + h + 0.2, z + 0.4]);
  interior(kit, m, 'storage');
}

function workshop(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  shell(kit, m, { windows: [{ x: -1.1, y: 2.05, w: 1.3, h: 0.7 }] });
  belt(kit, m, 0.32);
  belt(kit, m, h - 0.24, 0.05, 'grip');
  cornerLights(kit, m);
  doorPortal(kit, m, 'ws');
  signPlate(kit, m, 'ws', { w: 1.95, h: 0.46, y: h - 0.34 });

  // Chimeneas de extracción.
  for (let i = 0; i < 2; i++) {
    const px = x + w * 0.22 + i * 0.5;
    kit.cyl(0.13, 0.15, 1.5, 'metal', [px, y + h + 0.75, z - d * 0.2], null, 10);
    kit.cyl(0.19, 0.19, 0.1, 'dark', [px, y + h + 1.52, z - d * 0.2], null, 10);
  }
  kit.rbox([1.2, 0.6, 0.9], 'dark', [x - w * 0.24, y + h + 0.4, z + d * 0.2], null, 0.05, 1);

  // Rack de herramientas y botellas.
  kit.rbox([0.24, 1.3, 2.2], 'grip', [x + w / 2 + 0.24, y + 1.0, z + 0.2], null, 0.03, 1);
  for (let i = 0; i < 5; i++) {
    kit.box([0.06, 0.5, 0.05], 'metal', [x + w / 2 + 0.38, y + 1.15, z - 0.7 + i * 0.42]);
  }
  for (let i = 0; i < 2; i++) {
    kit.cyl(0.2, 0.2, 1.25, 'gold', [x - w / 2 - 0.36, y + 0.66, z + 1.1 + i * 0.5], null, 12);
  }
  kit.box([1.6, 0.08, 0.9], 'dark', [x - w / 2 - 0.95, y + 0.06, z - 0.9]);
  interior(kit, m, 'workshop');
}

function oxygen(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  // Cuerpo al fondo del volumen y depósitos delante, dentro del colisionador.
  kit.rbox([w * 0.62, h, d * 0.62], 'hull', [x, y + h / 2, z + d * 0.16], null, 0.07, 2);
  belt(kit, m, 0.28);

  // Poste de identificación delante de la planta.
  const spz = z - d / 2 - 1.15;
  kit.cyl(0.05, 0.05, 1.35, 'metal', [x, y + 0.68, spz], null, 6);
  kit.rbox([1.45, 0.5, 0.07], 'panel', [x, y + 1.32, spz], null, 0.02, 1);
  kit.sign('o2', [1.3, 0.36], [x, y + 1.32, spz - 0.06], [0, PI, 0]);

  for (let i = 0; i < 2; i++) {
    const px = x - 0.72 + i * 1.44;
    const pz = z - d * 0.16;
    kit.cyl(0.52, 0.52, h * 0.92, 'gold', [px, y + h * 0.46, pz], null, 18);
    kit.sphere(0.52, 'gold', [px, y + h * 0.92, pz], null, 18, 8);
    kit.cyl(0.56, 0.56, 0.12, 'metal', [px, y + 0.08, pz], null, 18);
    kit.torus(0.16, 0.04, 'accent', [px, y + h * 0.4, pz - 0.52], [PI / 2, 0, 0], 12, 5);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.beam(
        [x + sx * 1.5, y + 0.1, z + d * 0.16 + sz * 0.7],
        [x + sx * 1.5, y + h * 0.95, z + d * 0.16 + sz * 0.7],
        0.06,
        'metal'
      );
    }
  }
  kit.pipe([x - 0.72, y + 0.55, z - d * 0.16], [x - 0.72, y + 0.55, z + d * 0.42], 0.1, 'metal');
  kit.pipe([x - 0.72, y + 0.55, z + d * 0.42], [x + 0.72, y + 0.55, z + d * 0.42], 0.1, 'metal');
}

function water(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  kit.rbox([w * 0.6, h, d * 0.6], 'panel', [x, y + h / 2, z + d * 0.17], null, 0.06, 2);
  belt(kit, m, 0.26);

  const spz = z - d / 2 - 1.15;
  kit.cyl(0.05, 0.05, 1.3, 'metal', [x, y + 0.65, spz], null, 6);
  kit.rbox([1.35, 0.48, 0.07], 'panel', [x, y + 1.28, spz], null, 0.02, 1);
  kit.sign('h2o', [1.2, 0.34], [x, y + 1.28, spz - 0.06], [0, PI, 0]);

  const px = x + w * 0.14;
  const pz = z - d * 0.14;
  kit.cyl(0.46, 0.46, h * 0.86, 'metal', [px, y + h * 0.44, pz], null, 16);
  kit.sphere(0.46, 'metal', [px, y + h * 0.86, pz], null, 16, 8);
  kit.pipe([px, y + 0.3, pz], [x, y + 0.3, z + d * 0.4], 0.08, 'ice');
  kit.torus(0.15, 0.04, 'accent', [px, y + h * 0.4, pz - 0.46], [PI / 2, 0, 0], 12, 5);
}

function antenna(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  kit.rbox([w + 0.9, 0.34, d + 0.9], 'dark', [x, y + 0.1, z], null, 0.05, 1);
  const top = y + h;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.beam([x + sx * 0.78, y + 0.24, z + sz * 0.78], [x + sx * 0.3, top, z + sz * 0.3], 0.09, 'metal');
    }
  }
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const r = 0.78 - 0.48 * t;
    const yy = y + 0.24 + (top - y - 0.24) * t;
    for (const s of [-1, 1]) {
      kit.beam([x - r, yy, z + s * r], [x + r, yy, z + s * r], 0.035, 'metal');
      kit.beam([x + s * r, yy, z - r], [x + s * r, yy, z + r], 0.035, 'metal');
      kit.beam([x - r, yy, z + s * r], [x + r, yy + 0.5, z + s * r], 0.03, 'metal');
    }
  }
  kit.dish(1.35, 0.42, 'dish', [x, top + 1.05, z], [PI - 0.42, 0, 0], 24);
  kit.cyl(0.06, 0.06, 0.9, 'metal', [x, top + 0.95, z], null, 8);
  kit.cyl(0.11, 0.06, 0.26, 'metal', [x, top + 1.55, z], null, 10);
  kit.sphere(0.1, 'red', [x, top + 1.72, z], null, 8, 6);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + 0.4;
    kit.beam([x, top - 0.4, z], [x + Math.cos(a) * 3.4, y + 0.2, z + Math.sin(a) * 3.4], 0.025, 'grip');
    kit.rbox([0.4, 0.3, 0.4], 'dark', [x + Math.cos(a) * 3.4, y + 0.15, z + Math.sin(a) * 3.4], null, 0.04, 1);
  }

  kit.rbox([1.8, 0.56, 0.08], 'panel', [x, y + 1.35, z - 1.0], null, 0.02, 1);
  kit.sign('com', [1.65, 0.42], [x, y + 1.35, z - 1.06], [0, PI, 0]);
  kit.cyl(0.05, 0.05, 1.35, 'metal', [x, y + 0.68, z - 1.02], null, 6);
}

function garage(kit, m) {
  const [w, h, d] = m.size;
  const { x, y, z } = m;

  shell(kit, m, { windows: [] });
  belt(kit, m, 0.36);
  cornerLights(kit, m);
  doorPortal(kit, m, 'gar');
  signPlate(kit, m, 'gar', { w: 2.2, h: 0.5, y: h - 0.44 });

  // Costillas industriales en la fachada sur.
  for (let i = 1; i < 6; i++) {
    const px = x - w / 2 + (i * w) / 6;
    kit.box([0.12, h - 0.2, 0.1], 'metal', [px, y + h / 2, z - d / 2 - 0.1]);
  }

  // Estación de carga orientada al rover.
  const cz = z - d / 2 - 0.3;
  kit.rbox([0.55, 1.15, 0.75], 'dark', [x - 1.8, y + 0.72, cz], null, 0.04, 1);
  kit.box([0.36, 0.3, 0.03], 'screen', [x - 1.8, y + 0.85, cz - 0.4]);
  kit.box([0.3, 0.06, 0.2], 'accent', [x - 1.8, y + 1.34, cz]);
  kit.pipe([x - 1.8, y + 1.3, cz], [x - 1.8, y + 2.2, cz], 0.05, 'grip');
  kit.pipe([x - 1.8, y + 2.2, cz], [x - 1.8, y + 2.2, z - d / 2 + 0.4], 0.05, 'grip');
  kit.rbox([0.5, 0.42, 0.5], 'metal', [x + 1.9, y + 0.3, cz - 0.2], null, 0.04, 1);

  // Plataforma de trabajo delante de la puerta: chapa metálica con canto
  // pintado, no una losa oscura que lea como un agujero en el suelo.
  kit.rbox([3.8, 0.08, 2.4], 'metal', [x, y + 0.05, z + d / 2 + 1.5], null, 0.04, 1);
  for (const s of [-1, 1]) {
    kit.box([0.1, 0.02, 2.2], 'paint', [x + s * 1.72, y + 0.1, z + d / 2 + 1.5]);
  }
  kit.box([3.8, 0.02, 0.1], 'paint', [x, y + 0.1, z + d / 2 + 2.62]);

  roofVents(kit, m, 2);
}

const BUILDERS = {
  habitat,
  control,
  lab,
  greenhouse,
  power,
  storage,
  workshop,
  o2: oxygen,
  water,
  antenna,
  garage,
};

/** Construye la piel de un módulo. No crea colliders. */
export function buildModule(kit, module) {
  const builder = BUILDERS[module.id];
  if (builder) {
    builder(kit, module);
    return;
  }
  // Módulo desconocido: volumen simple para no romper la base.
  const [w, h, d] = module.size;
  kit.rbox([w, h, d], 'panel', [module.x, module.y + h / 2, module.z], null, 0.06, 2);
}

/* ======================================================== plataforma y base */

export function buildLandingPad(kit, { x, y, z }) {
  // Losa de aterrizaje con textura de regolito compactado.
  kit.cyl(6.5, 6.5, 0.2, 'dark', [x, y + 0.1, z], null, 44);
  kit.cyl(5.9, 5.9, 0.07, 'pad', [x, y + 0.22, z], null, 44);
  kit.torus(5.5, 0.1, 'metal', [x, y + 0.26, z], [PI / 2, 0, 0], 46, 6);

  // Marcas de aproximación pintadas.
  kit.torus(2.4, 0.06, 'paint', [x, y + 0.26, z], [PI / 2, 0, 0], 34, 5);
  kit.torus(0.75, 0.07, 'paint', [x, y + 0.26, z], [PI / 2, 0, 0], 22, 5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    kit.box([0.34, 0.02, 1.15], 'paint', [
      x + Math.cos(a) * 4.0,
      y + 0.27,
      z + Math.sin(a) * 4.0,
    ], [0, -a + PI / 2, 0]);
  }

  // Balizas de borde.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2 + 0.13;
    const px = x + Math.cos(a) * 6.15;
    const pz = z + Math.sin(a) * 6.15;
    kit.rbox([0.3, 0.24, 0.3], 'metal', [px, y + 0.32, pz], null, 0.04, 1);
    kit.box([0.16, 0.07, 0.16], i % 2 === 0 ? 'accent' : 'warm', [px, y + 0.46, pz]);
  }

  // Mástiles de iluminación de la plataforma.
  for (const s of [-1, 1]) {
    const px = x + s * 7.0;
    const pz = z + 3.6;
    kit.cyl(0.09, 0.12, 3.4, 'metal', [px, y + 1.7, pz], null, 8);
    kit.rbox([0.66, 0.3, 0.44], 'dark', [px, y + 3.45, pz], [0, s * 0.4, 0], 0.03, 1);
    kit.box([0.5, 0.2, 0.03], 'warm', [px - s * 0.12, y + 3.42, pz - 0.22], [0, s * 0.4, 0]);
    kit.rbox([0.5, 0.24, 0.5], 'dark', [px, y + 0.12, pz], null, 0.03, 1);
  }

  kit.sign('pad', [1.9, 0.48], [x + 4.4, y + 0.9, z + 4.9]);
  kit.rbox([2.05, 0.62, 0.07], 'panel', [x + 4.4, y + 0.9, z + 4.86], null, 0.02, 1);
  kit.cyl(0.05, 0.05, 0.6, 'metal', [x + 4.4, y + 0.3, z + 4.88], null, 6);
}

export function buildBaseExtras(kit, { center, ground }) {
  const [cx, cz] = center;
  const gy = ground(cx, cz);

  // Explanada compactada: textura de regolito, borde biselado y sin brillo.
  kit.rbox([38, 0.09, 24], 'pad', [cx, gy + 0.01, cz], null, 0.5, 2);
  kit.box([38.4, 0.05, 0.16], 'paint', [cx, gy + 0.07, cz - 12.05]);
  kit.box([38.4, 0.05, 0.16], 'paint', [cx, gy + 0.07, cz + 12.05]);
  kit.box([0.16, 0.05, 24.2], 'paint', [cx - 19.05, gy + 0.07, cz]);
  kit.box([0.16, 0.05, 24.2], 'paint', [cx + 19.05, gy + 0.07, cz]);

  // Pista desde la plataforma de aterrizaje.
  const roadLength = cz - 12 - 11;
  kit.rbox([5.4, 0.08, roadLength], 'grip', [cx, gy + 0.04, 11 + roadLength / 2], null, 0.2, 2);
  for (let i = 0; i < 6; i++) {
    kit.box([0.2, 0.02, 0.9], 'paint', [cx, gy + 0.085, 13 + i * 2.6]);
  }

  // Caballones de regolito al norte: apantallamiento contra radiación.
  kit.rbox([36, 0.5, 0.9], 'regolith', [cx, gy + 0.16, cz + 12.9], null, 0.24, 2);
  for (let i = 0; i < 14; i++) {
    const px = cx - 17 + i * 2.6;
    const jitter = ((i * 41) % 7) / 7;
    kit.rbox([1.5 + jitter * 0.5, 0.34, 0.7], 'regolith', [px, gy + 0.5, cz + 12.9 + (jitter - 0.5) * 0.2], [0, i * 0.21, 0], 0.14, 1);
  }

  // Balizas perimetrales.
  const posts = [
    [-17, -9.5], [17, -9.5], [-17, 9.5], [17, 9.5],
    [-17, 0], [17, 0],
  ];
  for (const [ox, oz] of posts) {
    const px = cx + ox;
    const pz = cz + oz;
    kit.cyl(0.06, 0.08, 1.5, 'metal', [px, gy + 0.75, pz], null, 8);
    kit.rbox([0.24, 0.16, 0.24], 'dark', [px, gy + 1.55, pz], null, 0.03, 1);
    kit.box([0.14, 0.07, 0.14], 'accent', [px, gy + 1.66, pz]);
  }

  // Torres de iluminación de la explanada.
  for (const [ox, oz] of [[-18, -10.5], [18, -10.5], [-18, 10.5], [18, 10.5]]) {
    const px = cx + ox;
    const pz = cz + oz;
    kit.cyl(0.1, 0.14, 3.8, 'metal', [px, gy + 1.9, pz], null, 8);
    kit.rbox([0.7, 0.26, 0.5], 'dark', [px, gy + 3.82, pz], [0, ox > 0 ? -0.6 : 0.6, 0], 0.03, 1);
    kit.box([0.52, 0.16, 0.03], 'warm', [px, gy + 3.78, pz + (oz > 0 ? -0.24 : 0.24)]);
    kit.rbox([0.6, 0.3, 0.6], 'dark', [px, gy + 0.14, pz], null, 0.04, 1);
  }

  // Piedras sueltas en el borde: rompen el rectángulo perfecto de la losa.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * PI * 2;
    const rx = cx + Math.cos(a) * (20.5 + ((i * 13) % 5) * 0.9);
    const rz = cz + Math.sin(a) * (13.5 + ((i * 7) % 4) * 0.8);
    const s = 0.22 + ((i * 29) % 10) / 22;
    kit.rbox([s * 1.4, s, s * 1.1], 'rock', [rx, gy + s * 0.4, rz], [i * 0.4, i * 0.7, i * 0.2], s * 0.3, 1);
  }
}

/** Crea los materiales propios de la base a partir de la biblioteca común. */
export function createBaseMaterials(library, config, signsAtlas, world) {
  const mars = config.id === 'mars';
  const hull = library.hull.clone();
  hull.color = new THREE.Color(mars ? 0xd9c3ae : 0xf4f7fb);
  hull.roughness = mars ? 0.78 : 0.6;
  hull.metalness = mars ? 0.26 : 0.36;

  const panel = library.hullDark.clone();
  panel.color = new THREE.Color(mars ? 0xb08a74 : 0xa4b4c6);
  panel.roughness = mars ? 0.74 : 0.5;

  const gold = library.hull.clone();
  gold.color = new THREE.Color(mars ? 0xc89a5c : 0xe3c084);
  gold.metalness = 0.95;
  gold.roughness = 0.34;

  const regolith = new THREE.MeshStandardMaterial({
    color: new THREE.Color(mars ? 0x9a5233 : 0x9aa0a7),
    roughness: 1,
    metalness: 0.02,
  });

  const padTexture = world?.regolithTextures;
  const pad = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0.02,
  });
  if (padTexture) {
    const map = padTexture.map.clone();
    map.repeat.set(9, 6);
    map.needsUpdate = true;
    const normalMap = padTexture.normalMap.clone();
    normalMap.repeat.set(9, 6);
    normalMap.needsUpdate = true;
    pad.map = map;
    pad.normalMap = normalMap;
    pad.normalScale = new THREE.Vector2(0.7, 0.7);
    pad.color = new THREE.Color(mars ? 0xc98d6a : 0xcfd3d8);
  } else {
    pad.color = new THREE.Color(mars ? 0x9a5233 : 0x9aa0a7);
  }

  const strip = library.accent.clone();
  strip.emissiveIntensity = 0.9;

  const warm = library.accent.clone();
  warm.color = new THREE.Color(mars ? 0xffb070 : 0xffd9a0);
  warm.emissive = new THREE.Color(mars ? 0xff8a3c : 0xffc873);
  warm.emissiveIntensity = 1.05;

  const paint = new THREE.MeshStandardMaterial({
    color: new THREE.Color(mars ? 0xe8b98e : 0xd9d1b8),
    roughness: 0.86,
    metalness: 0.04,
    emissive: new THREE.Color(mars ? 0x3a1c08 : 0x2a2414),
    emissiveIntensity: 0.05,
  });

  const screen = library.green.clone();
  screen.emissiveIntensity = 0.85;

  const dish = library.metal.clone();
  dish.side = THREE.DoubleSide;
  dish.roughness = 0.4;

  const window = new THREE.MeshStandardMaterial({
    map: world?.windowTexture ?? null,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: world?.windowTexture ?? null,
    emissiveIntensity: 0.75,
    roughness: 0.28,
    metalness: 0.12,
    color: 0xffffff,
  });

  const sign = new THREE.MeshStandardMaterial({
    map: signsAtlas.texture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: signsAtlas.texture,
    emissiveIntensity: 0.7,
    roughness: 0.55,
    metalness: 0.1,
    transparent: false,
  });

  return {
    hull,
    panel,
    metal: library.metal,
    dark: library.dark,
    grip: library.grip,
    solar: library.solar,
    accent: strip,
    warm,
    green: library.green,
    red: library.red,
    gold,
    regolith,
    pad,
    paint,
    rock: world?.mats?.rock ?? regolith,
    glass: null, // se rellena en PlanetWorld con el cristal del mundo
    ice: null,
    screen,
    dish,
    window,
    sign,
  };
}
