# SPACE-TECH — Estado del proyecto

**Documento:** estado implementado, verificado y pendiente  
**Fecha de revisión:** 15 de noviembre de 2026  
**Método:** inspección directa del código actual + `npm run check` + `npm run smoke` + `npm run server:test`.  
**Importante:** este documento no declara terminada ninguna funcionalidad que solo exista como archivo, llamada o intención.

---

## 1. Resumen ejecutivo

| Área | Estado |
|---|---|
| Simulador base (estación, EVA, Luna, Marte, misiones, física, guardado) | **Implementado y en uso** |
| Capa educativa (Academia, Centro de Datos, mesa de diseño, manual) | **Implementada** |
| Soporte vital del Módulo 1 (O₂, CO₂, filtros) | **Implementado y conectado al HUD** |
| Persistencia versionada v3 | **Implementada** |
| Cinemática inicial del Prompt 4 | **CANCELADA por decisión del proyecto** |
| Multijugador cooperativo en línea (hasta 4) | **Implementado y probado en localhost** |
| Servidor público desplegado | **No desplegado**; no se afirma conectividad entre redes |
| Menú de pausa | **Funcional**, con defectos visuales conocidos (fuera del alcance de esta fase) |

**Conclusión:** el juego base está operativo. La cinemática del Prompt 4 quedó
cancelada de forma definitiva y toda partida nueva entra directamente al juego.
El multijugador cooperativo está implementado con un servidor Colyseus
independiente y verificado con clientes reales en localhost. **No hay servidor
público desplegado**, por lo que no se afirma que funcione entre redes distintas.

---

## 2. Verificación ejecutada en esta revisión

| Comprobación | Resultado |
|---|---|
| `npm run check` | **43/43 archivos válidos** |
| `npm run smoke` | **Superado** (todas las comprobaciones en `ok`, sin fallos) |
| `npm run server:test` | **11/11 pruebas del servidor superadas** |
| `npm run server:health` | **`SALUD OK`** contra el servidor local |
| Modo táctil (Chrome móvil emulado) | **Superado**: joystick, cámara, reparar, usar, herramienta y pausa |
| Prueba entre redes distintas | **No realizada**; requiere servidor público |

> `node --check` valida sintaxis, no comportamiento. El smoke test valida el
> cliente en un navegador real (Puppeteer) contra el servidor de desarrollo local.
> Las pruebas del servidor usan clientes reales de `@colyseus/sdk`.

---

## 3. Lo que está implementado

### 3.1 Núcleo del juego

- `Game.js` como motor principal y orquestador de estados **[V]**.
- Renderer Three.js con bucle único (`setAnimationLoop`) **[V]**.
- Física cannon-es, cámara en tercera persona, controles y pointer lock **[V]**.
- Estación EVA-07 con módulos, brechas, fugas y reparación **[V]**.
- Interior habitable con GLB, colisiones, compuertas y esclusa **[V]**.
- Jugador con modos `walk`/`zero`, animaciones procedurales, traje y herramientas **[V]**.
- Nave de transporte con interior caminable y puntos de embarque/asiento **[V]**.
- Luna y Marte con terreno, bases, recursos, cuevas y rover **[V]**.
- Viaje interplanetario con estado `'travel'` y `TravelScene` **[V]**.
- 20 misiones y `MissionManager` **[V]**.
- 10 lecciones de Academia, Centro de Datos y mesa de diseño de 6 fases **[V]**.
- Guardado v3 con migración v1 → v2 → v3 **[V]**.
- HUD con O₂, CO₂, RCS, integridad, filtros, cable, traje, navegación y objetivo **[V]**.
- Menú principal con opción **MULTIJUGADOR** añadida **[V]**.

### 3.2 Soporte vital del Módulo 1

- `player.co2` y `player.filterLife` se inicializan después de crear `this.player` **[V]**.
- CO₂ y filtros se actualizan en `Game.js` **[V]**.
- El HUD tiene `co2-value`, `co2-state`, `filters-value` y `filters-state` **[V]**.
- Las tres llamadas a `hud.setStats()` pasan cinco argumentos **[V]**.
- Los indicadores muestran porcentaje y estado cualitativo **[V]**.

### 3.3 Persistencia

- `SAVE_KEY = 'orbital.universe.save'`, `SAVE_VERSION = 3` **[V]**.
- `readSave`, `writeSave`, `clearSave`, `hasSave` **[V]**.
- El guardado de una sesión en línea **no** escribe en el perfil individual:
  `saveGame()` sale antes si `multiplayerActive` **[V]**.

---

## 4. Prompt 4 — cinemática CANCELADA

La cinemática de introducción quedó **cancelada de forma definitiva** por
decisión del proyecto. No se crea, repara ni reintegra ninguna escena de
embarque/despegue.

Estado actual del código **[V]**:

- `startNewGame()` **no** llama a `_runIntro()` ni usa el estado `'intro'`.
- Toda partida nueva pasa directamente a `state = 'playing'`.
- `Game.js` ya **no** importa `hasViewedIntro`/`setIntroViewed`.
- `Cinematic.js` sigue existiendo como archivo, pero **no está integrado** y no
  forma parte del flujo de juego. No debe reactivarse sin petición expresa.
- La marca `introViewed` en `Save.js` quedó como código heredado sin uso.

**Consecuencia:** la ruta de perfil nuevo funciona: `NUEVA PARTIDA` entra al
juego sin excepciones ni pantallas intermedias.

---

## 5. Multijugador cooperativo

### 5.1 Arquitectura

| Componente | Archivo | Función |
|---|---|---|
| Servidor | `server/index.js` | Entrada Node, `/health`, `/rooms`, CORS, apagado ordenado |
| Sala | `server/rooms/SpaceRoom.js` | Autoridad, validación, reconexión, anfitrión |
| Estado | `server/schema/SpaceState.js` | `SpaceState` + `PlayerState` sincronizados |
| Cliente de red | `public/js/net/MultiplayerClient.js` | Salas, estado, reconexión, envío ~15 Hz |
| Avatar remoto | `public/js/net/RemoteAvatar.js` | Malla visual + interpolación, sin física |
| Interfaz | `public/js/ui/MultiplayerUI.js` | Crear/unirse, lista, sala de espera, preparado |

- **Framework:** Colyseus `0.18.12` (servidor) + `@colyseus/sdk` `0.18.10` (cliente).
- **Sala:** `space`, máximo **4** jugadores, código de invitación de 6 caracteres.
- **Autoridad del servidor:** identidad, capacidad, estado compartido, destino y
  confirmación de acciones compartidas.
- **Sincronización:** id, nombre, apariencia, posición, rotación, modo,
  animación, ubicación e indicador de conexión.
- **Reconexión:** automática del SDK + asiento reservado 30 s + reanudación por token.
- **Un solo renderer y un solo bucle:** los avatares remotos se interpolan dentro
  del `frame()` existente; no tienen física ni simulación propia.

### 5.2 Pruebas del servidor (11/11)

Ejecutadas con `npm run server:test` sobre un servidor Node real y clientes
reales de `@colyseus/sdk`:

| # | Prueba | Resultado |
|---|---|---|
| 1 | El servidor responde y anuncia su estado (`/health`) | ✅ |
| 2 | Sala privada con código de invitación de 6 caracteres | ✅ |
| 3 | Segundo, tercer y cuarto cliente por código | ✅ |
| 4 | Quinto jugador rechazado con sala completa | ✅ |
| 5 | Movimiento de un astronauta sincronizado a los demás | ✅ |
| 6 | Posiciones imposibles descartadas y frecuencia limitada | ✅ |
| 7 | Un jugador inactivo no detiene a los demás | ✅ |
| 8 | Desconexión detectada y reconexión automática | ✅ |
| 9 | El anfitrión inicia la exploración y cambia el destino | ✅ |
| 10 | Sólo las salas públicas aparecen en el listado | ✅ |
| 11 | Salida limpia, limpieza de avatar y nuevo anfitrión | ✅ |

Además se comprobó:

- Posiciones `NaN`, `Infinity` y ±999999 acotadas o descartadas.
- Modos y ubicaciones inválidos rechazados por listas blancas.
- Ráfagas por encima del límite de frecuencia descartadas.
- Cambio de destino sólo por el anfitrión; los invitados reciben error.
- Reasignación de anfitrión al salir el titular.

### 5.3 Comportamiento en el juego

- El menú conserva sus opciones y añade **MULTIJUGADOR**.
- Se puede crear sala (pública/privada), unirse por código, buscar salas
  públicas, ver latencia, prepararse, iniciar y salir.
- Al iniciar, el cliente entra al mundo compartido **sin borrar ni sobrescribir
  el guardado individual**.
- La pausa (ESC) sólo detiene el control local; el servidor y los demás siguen.
- Si se pierde la conexión aparece «Reconectando…»; el SDK reintenta y el estado
  se reconcilia.
- Al salir o al agotarse la reconexión, el avatar remoto se elimina.

### 5.4 Lo que **no** está sincronizado todavía

- Recursos, inventario, construcción y misiones compartidas.
- Vehículos y rover compartidos.
- Estado de las brechas y reparaciones.
- Cuentas persistentes (el MVP usa identidad de sesión temporal).

---

## 6. Estado del despliegue

- **No hay servidor público desplegado en este repositorio.**
- Por tanto, **no se afirma** que cuatro jugadores en redes distintas puedan
  conectarse todavía. Las pruebas son **locales**.
- El MVP usa identidad de sesión temporal; no hay autenticación persistente.
- Sin Redis, el despliegue es de **una sola instancia**. Para escalar hay que
  configurar `RedisDriver` y `RedisPresence` en `server/index.js`.
- La reconexión tras recargar depende de `sessionStorage` y de la ventana de 30 s.
- Guía completa de despliegue: `docs/MULTIPLAYER-DEPLOYMENT.md`.

### 6.1 Despliegue híbrido (Vercel + servidor Colyseus)

- **Vercel** sirve sólo el cliente estático: `public/` como `outputDirectory`
  (`vercel.json`). No puede hospedar el servidor Node/Colyseus.
- El servidor multijugador se despliega aparte (Render, Railway, Fly.io o VPS)
  y su URL HTTPS se declara en `public/config.js` (`multiplayerUrl`).
- `render.yaml` en la raíz define el blueprint de Render para `server/`
  (Node 22, `npm start`, health check `/health`).
- `publicUrl` de `config.js` se usa para enlaces de invitación; nunca debe ser
  `localhost` en un despliegue público.
- Con `multiplayerUrl` vacío el cliente usa `localhost:2567` en desarrollo y el
  mismo origen en producción (requiere proxy inverso hacia Colyseus).
- **Pendiente de prueba real:** dos dispositivos en redes distintas contra el
  servidor público. No se declara funcionamiento por Internet hasta entonces.

### 6.2 Soporte móvil y multiplataforma

- `public/js/ui/TouchControls.js`: joystick izquierdo (movimiento), zona derecha
  (cámara) y botones **E/USAR**, **REPARAR**, **RCS**, **↑** y **HERRAMIENTA**.
- El estado táctil vive en `Controls.touch` (separado del gamepad, que se
  sobrescribe en `poll()`), y la cámara reutiliza el acumulador del ratón.
- En puntero grueso (`pointer: coarse`) no se pide Pointer Lock y se ignoran los
  eventos sintéticos de ratón sobre el canvas.
- HUD reacomodado con `body.touch-input` (stats arriba, sin barra de
  herramientas inferior) y `env(safe-area-inset-*)` para muescas.
- **Calidad adaptativa** (`Game._adaptQuality`): sólo en táctil, ajusta el pixel
  ratio entre 0.56 y el perfil estándar; el perfil gráfico sigue siendo único.
- PWA instalable: `public/manifest.webmanifest`, iconos en `public/assets/` e
  `apple-touch-icon`. El manifiesto no cachea el juego: sólo instalación.
- `window.SPACE_TECH_TOUCH = true` fuerza el modo táctil en equipos híbridos o
  en pruebas automatizadas.
- Prueba reproducible: `npm run touch:test` (Chrome headless, viewport iPhone,
  capturas en `.smoke/touch/`).
- **Pendiente:** probar en Android/iPhone reales, orientación vertical y
  multitáctil simultáneo (mover + mirar + reparar a la vez).

---

## 7. Menú de pausa — defectos conocidos

El menú de pausa tiene ocho botones con handler real **[V]**. Persisten defectos
de maquetación (ancho efectivo de 480 px por especificidad de `.card.compact`,
botones sin el estilo previsto, textos que se parten). Son **visuales**, no de
funcionalidad, y quedan **fuera del alcance** de la fase de multijugador.

---

## 8. Riesgos y notas para la siguiente sesión

| Riesgo | Detalle |
|---|---|
| **Afirmar Internet sin desplegar** | Las pruebas son locales; no hay servidor público probado. |
| **Sobrescribir el perfil en línea** | `saveGame()` debe seguir saliendo si `multiplayerActive`. |
| **Doble bucle / doble renderer** | Los avatares remotos se interpolan en `frame()`; no crear otro bucle. |
| **Pausar la sala entera** | La pausa es local; el servidor y los demás clientes siguen. |
| **Avatares fantasma** | Limpiar con `RemoteAvatar.dispose()` y borrar del mapa al salir. |
| **Cinemática reactivada** | Cancelada; no reintroducir `_runIntro()` ni `'intro'` sin petición. |
| **SDK desactualizado** | `public/vendor/colyseus-sdk.mjs` se regenera con `npm run server:build-sdk`. |

---

## 9. Documentos relacionados

- `docs/SPACE-TECH-CONTEXT.md` — arquitectura y sistemas.
- `docs/MULTIPLAYER-DEPLOYMENT.md` — despliegue público y comprobación entre redes.
- `docs/ART-DIRECTION.md` — dirección artística y diseño visual.
- `AGENTS.md` — instrucciones permanentes para agentes.
- `docs/INFORME-PROMPT-3.7.md` — cierre de la capa educativa y de menús.
- `docs/INFORME-FASE1-BASE-LUNAR.md` — remodelación de la base lunar.

---

**Nota:** este documento refleja el estado del código el 15/11/2026.
