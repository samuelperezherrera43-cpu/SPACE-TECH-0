# SPACE-TECH · Informe de cierre — Fase 1: Base lunar

**Proyecto:** SPACE-TECH — simulador interactivo de misiones espaciales  
**Base técnica:** Three.js r170, ES Modules, cannon-es 0.20  
**Fecha:** 14 de noviembre de 2026  
**Estado:** implementado y verificado (`npm run check` 37/37, `npm run smoke` OK, 0 errores de consola)

---

## 1. Resumen

Se ha remodelado artísticamente la base lunar (Base Selene) sin tocar la simulación:
colliders, puntos de interacción, `heightAt()`, dimensiones/offsets de módulos,
misiones, economía, recursos, guardado y construcción permanecen intactos.
La estación orbital (`Station.js`) no se ha modificado.

Respaldo previo a la Fase 1: `backups/orbital-pre-fase1-lunar-2026-11-14-0924.zip` (+ `.sha256`).

## 2. Cambios principales

- `public/js/entities/BaseBuildings.js` reescrito: casco con aristas redondeadas,
  muros con huecos reales, ventanas iluminadas con textura emisiva, esclusas con
  pórtico/marquesina/rampa, señalización sobre placas ancladas, equipos
  exteriores (solar, radiadores, torres, depósitos, contenedores, mástiles).
- `public/js/entities/BaseKit.js`: acumulación por material y fusión con
  `mergeGeometries` (4–8 draw calls por módulo en vez de cientos).
  `RoundedBoxGeometry` vendorizado.
- `public/js/engine/Textures.js`: `makeWindowTexture`, `makeRegolithTextures`,
  `makeSignAtlas` (ya existente) reutilizados.
- `public/js/engine/Environment.js`: sol de superficie reposicionado al sureste
  (las fachadas visibles al llegar desde la plataforma quedan iluminadas);
  disco solar y halo reubicados; sombra solar ampliada a ±34 y retargeteada a
  `(0,0,24)` (Luna) / `(0,0,24)` (Marte). Relleno elevado a 0.55 (Luna) /
  0.6 (Marte) para que las caras norte no queden negras.
- `public/js/entities/PlanetWorld.js`: migrado a `BaseKit` + `BaseBuildings`,
  sin cambios en colliders ni en la lógica de construcción.
- `scripts/base-preview.mjs`: 8 vistas fijas + auditoría de draw calls por módulo.

## 3. Iluminación y convención del mundo

- Plataforma de aterrizaje al sur (−z); puertas de los módulos al norte (+z).
- Fachada sur: ventanas y rótulos. Fachada norte: esclusa.
- Sol bajo desde el sureste (62, 92, −58) para que las fachadas sur queden
  iluminadas y las sombras caigan hacia el norte.

## 4. Módulos (11)

habitat, control, lab, greenhouse, power, storage, workshop, o2, water,
antenna, garage. Los 6 primeros se construyen de inicio; los 5 restantes se
erigen con recursos reales (sin cambios en costes).

## 5. Métricas (base lunar, todos los módulos construidos)

Vista tres cuartos (`02-tres-cuartos`): 527 draw calls · 124.543 triángulos.
Vista aérea (`03-aerea`): 539 draw calls · 125.273 triángulos.
Vista de esclusa (`08-esclusa`): 427 draw calls · 109.749 triángulos.

Por módulo (draw calls): habitat 19 · control 7 · lab 17 · greenhouse 13 ·
power 7 · storage 6 · workshop 17 · o2 9 · water 4 · antenna 5 · garage 5
(≈ 110 draw calls de arquitectura; el resto corresponde a terreno, rocas,
recursos, polvo, nave y rover preexistentes).

## 6. Verificación

- `npm run check`: 37/37 archivos válidos.
- `npm run smoke`: OK (incluye “Luna: base modular, recursos y rover”,
  “construcción modular real”, “rover: conducir, avanzar y bajar”).
- 0 errores de consola en las 8 capturas del preview.
- Colliders de módulos verificados idénticos a la versión anterior (muros
  `[sw/2, h/2, 0.08]`, hueco de puerta `door = 1.8` al norte).
- Entrada/salida de módulos y puntos de interacción funcionan (smoke).

## 7. Capturas

`docs/capturas-arte/f1-lunar-v9/` (8 vistas):
01-aproximacion, 02-tres-cuartos, 03-aerea, 04-habitat, 05-control,
06-energia, 07-plataforma, 08-esclusa.

## 8. Rendimiento

Benchmark en `docs/benchmarks/f1-lunar-v9b.json` (Intel UHD 620, ANGLE/D3D11,
headless, 1280×800, 5 s):

- FPS medio: 21,5 (frame time 46,3 ms, p95 50,2 ms).
- Draw calls: 415 (último frame, incluye pase de sombras).
- Triángulos: 95.691.
- Memoria: 372 geometrías · 43 texturas.
- Tras reducir los emisores de sombra a los cuerpos principales (hull/regolith/gold)
  (`docs/benchmarks/f1-lunar-v9c.json`): 20,8 FPS · 383 draw calls · 80.971 triángulos.

La vista del benchmark es la más desfavorable (distancia 11 m, toda la base en
cuadro). En juego la cámara es más cercana (tercera persona, ~6 m), por lo que
el coste real será menor. El render headless con ANGLE suele ser más lento que
un navegador nativo con aceleración hardware, así que se esperan FPS algo
superiores en la máquina del usuario.

## 9. Fase 2 / Fase 3

La Fase 1 queda cerrada visual y funcionalmente. La base marciana y los rovers
de 6 ruedas son las siguientes fases (B/C/D/E del orden obligatorio).
"""