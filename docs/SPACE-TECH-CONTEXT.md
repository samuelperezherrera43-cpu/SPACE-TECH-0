# SPACE-TECH — Contexto técnico del proyecto

**Documento:** contexto de arquitectura y sistemas  
**Fecha de verificación:** 15 de noviembre de 2026  
**Fuentes:** `package.json`, `public/index.html`, `public/js/**/*.js`, `public/css/styles.css`, `server/**/*.js`, `AGENTS.md` y los informes existentes en `docs/`.  
**Criterio:** cada afirmación marcada con **[V]** se comprobó en el código actual. Lo marcado como **[P]** es una propuesta o una funcionalidad pendiente; no debe leerse como implementada.

> **Decisión vigente:** la cinemática de introducción del Prompt 4 está **cancelada**. Toda partida nueva entra directamente a `'playing'`.

> Este documento describe el proyecto **tal como está**, no como debería estar. No sustituye a `PROJECT-STATUS.md`, que separa lo implementado de lo pendiente.

---

## 1. Qué es SPACE-TECH

SPACE-TECH es un simulador interactivo de misiones espaciales en 3D, en tercera persona. El jugador opera la estación orbital **EVA-07**, realiza tareas de reparación y mantenimiento, sale al exterior en EVA, diseña misiones, consulta la Academia y viaja a la **Luna (Base Selene)** y a **Marte (Puesto Ares)**.

El título y la descripción visibles en la interfaz son:

- `SPACE-TECH — Simulador interactivo de misiones espaciales` **[V]** (`public/index.html`, `<title>` y `<meta name="description">`).
- Identificador interno del paquete: `orbital-eva` **[V]** (`package.json`).

El proyecto se presenta como una experiencia educativa independiente, no patrocinada por NASA **[V]** (`public/index.html`, aviso legal de la pantalla de entrada).

---

## 2. Tecnologías verificadas

| Tecnología | Versión / uso | Evidencia |
|---|---|---|
| **Three.js** | `^0.170.0`, renderizado WebGL, escena, cámara, materiales PBR, postproceso | `package.json`, `public/index.html` (importmap) |
| **cannon-es** | `^0.20.0`, física de cuerpos rígidos | `package.json`, `public/js/engine/Physics.js` |
| **JavaScript ES Modules** | Módulos nativos; `"type": "module"` | `package.json`, todos los archivos de `public/js/` |
| **HTML + CSS plano** | HUD y pantallas sobre el canvas; sin framework CSS | `public/index.html`, `public/css/styles.css` |
| **localStorage** | Persistencia de la partida | `public/js/core/Save.js` |
| **Node.js** | Servidor de desarrollo, scripts de validación y servidor de juego | `scripts/dev.mjs`, `scripts/check.mjs`, `scripts/smoke.mjs`, `server/` |
| **puppeteer-core** | Navegador automatizado para el smoke test | `package.json`, `scripts/smoke.mjs` |
| **Colyseus** | `0.18.12` (servidor) y `@colyseus/sdk` `0.18.10` (cliente); multijugador autoritativo | `server/package.json`, `public/js/net/` |
| **WebSocket** | Transporte de la sala `space` (WSS en producción) | `server/index.js`, `server/rooms/SpaceRoom.js` |
| **Cloudflare Pages** | Script de despliegue de `public/` | `package.json` (`deploy`) |

No hay paso de build para el juego: el navegador carga `public/index.html` y sus módulos directamente **[V]**. La única excepción es el SDK de Colyseus, que se empaqueta una vez en `public/vendor/colyseus-sdk.mjs` con `npm run server:build-sdk` **[V]**.

### Comandos del proyecto

| Comando | Efecto real |
|---|---|
| `npm run check` | Recorre `public/js/**/*.js` y ejecuta `node --check` en cada archivo (**42** archivos). |
| `npm run smoke` | Suite automatizada con `puppeteer-core`; valida el cliente en navegador real. |
| `npm run dev` | Arranca `scripts/dev.mjs` y sirve el juego en `localhost:5173`. |
| `npm run bench` | Ejecuta `scripts/bench.mjs` (medición de rendimiento). |
| `npm run build:interior` | Ejecuta `scripts/build-interior.mjs` (herramienta de construcción del interior). |
| `npm run deploy` | Despliega `public/` con Wrangler en Cloudflare Pages. |
| `npm run server:install` | Instala las dependencias del servidor Colyseus (`server/`). |
| `npm run server:dev` | Arranca el servidor multijugador con recarga automática. |
| `npm run server` | Arranca el servidor multijugador en modo normal. |
| `npm run server:test` | Pruebas headless del servidor con clientes reales de `@colyseus/sdk`. |
| `npm run server:health` | Consulta `/health` del servidor. |
| `npm run server:build-sdk` | Reempaqueta `@colyseus/sdk` en `public/vendor/colyseus-sdk.mjs`. |

---

## 3. Arranque y ciclo de ejecución

### Cadena de entrada

1. `public/index.html` carga `<script type="module" src="./js/main.js">` **[V]**.
2. `public/js/main.js` importa `Game`, obtiene `#app`, crea `new Game(root)` y llama a `game.run()` **[V]**.
3. `Game.run()` registra el bucle con `renderer.setAnimationLoop(() => this.frame())` **[V]** (`Game.js`, ~línea 1039).
4. `Game.frame()` calcula `dt`, actualiza el entorno y despacha según `this.state` **[V]**.

La instancia queda expuesta como `window.__orbital` para depuración y para el smoke test **[V]** (`main.js`).

### Estados reales de `Game.state`

| Estado | Uso comprobado |
|---|---|
| `'entry'` | Pantalla de entrada; el botón `INICIAR OPERACIONES` llama a `enterMenu()`. |
| `'menu'` | Menú principal; cámara orbital de menú y actualización de la estación. |
| `'playing'` | Simulación normal: jugador, física, HUD, misiones. |
| `'paused'` | Menú de pausa; se congela la simulación y se conserva el último render. |
| `'overlay'` | Paneles educativos o de consola abiertos sobre la partida. |
| `'travel'` | Escena de viaje interplanetario. |
| `'won'` | Victoria. |
| `'lost'` | Derrota. |

> El antiguo estado `'intro'` de la cinemática del Prompt 4 **ya no existe**: `startNewGame()` entra directamente a `'playing'` y `frame()` no tiene rama para una cinemática. Decisión de proyecto: cinemática cancelada.

### Flujo de menús

- `INICIAR OPERACIONES` (`#btn-enter`) → `enterMenu()` → `state = 'menu'` **[V]**.
- `NUEVA PARTIDA` (`#btn-menu-new`) → `startNewGame()` → entra directo a `'playing'` (sin cinemática) **[V]**.
- `MULTIJUGADOR` (`#btn-menu-multiplayer`) → `openMultiplayer()` → pantalla `multiplayer` **[V]**.
- `CONTINUAR EXPLORACIÓN` (`#btn-menu-continue`) → `continueGame()` **[V]**.
- `DISEÑAR MISIÓN`, `ACADEMIA`, `CENTRO DE DATOS`, `MANUAL` y `CONFIGURACIÓN` abren sus paneles correspondientes **[V]** (`Game.js`, ~líneas 473-477).
- `ESC` pausa durante `'playing'`; el menú de pausa ofrece ocho acciones **[V]**.

---

## 4. Mapa de módulos

### Núcleo (`public/js/core/`)

| Archivo | Responsabilidad |
|---|---|
| `Game.js` | Orquestador principal: renderer, escena, cámara, física, estados, misiones, HUD, guardado, viajes, paneles. |
| `Save.js` | Persistencia versionada en `localStorage`; migración v1 → v2 → v3. |
| `Universe.js` | Configuración de destinos: `MOON_CONFIG`, `MARS_CONFIG`, `SOLAR_SYSTEM`. |
| `Missions.js` | Definición de las 20 misiones y `MissionManager`. |
| `MissionDesign.js` | Mesa de diseño de misión en seis fases, segmentos, modalidades, conceptos e instrumentos. |
| `MissionCatalog.js` | Catálogo y auditoría de las misiones existentes. |
| `Academy.js` | Diez lecciones de la Academia con actividades y progreso. |
| `ScienceData.js` | Datos científicos y fuentes del Centro de Datos. |
| `Maintenance.js` | Mantenimiento y tareas de reparación. |
| `Balance.js` | Valores de dificultad y balance. |
| `Cinematic.js` | Archivo heredado de la cinemática **cancelada**; no está integrado ni debe reactivarse. |

### Motor (`public/js/engine/`)

| Archivo | Responsabilidad |
|---|---|
| `Physics.js` | Mundo cannon-es, grupos de colisión y cuerpos. |
| `Controls.js` | Entrada de teclado/ratón y pointer lock. |
| `Camera.js` | Cámara en tercera persona, cámara de menú y sacudida. |
| `Environment.js` | Cielo, estrellas, Tierra, atmósfera, sol, niebla e iluminación. |
| `Materials.js` | Biblioteca de materiales PBR y texturas procedurales. |
| `Textures.js` | Generación procedural de texturas (casco, traje, Tierra, resplandores). |
| `Interior.js` | Carga de GLB del hábitat, colisionadores, compuertas, esclusa e iluminación interior. |
| `InteriorInteractions.js` | Consolas y puntos interactivos del interior. |
| `Particles.js` | Partículas de propulsores, chispas y fugas. |
| `PostFX.js` | Postproceso y composición. |
| `Quality.js` | Preset gráfico y límites de resolución/sombras. |
| `Audio.js` | Sonido, bucles y respiración. |

### Entidades (`public/js/entities/`)

| Archivo | Responsabilidad |
|---|---|
| `Player.js` | Cápsula física y rig procedural del astronauta; modos `walk`/`zero`; animaciones; soporte vital. |
| `Station.js` | EVA-07: módulos, brechas, fugas y reparación. |
| `TransportShip.js` | Nave de transporte: casco de 11 m, interior caminable, compuertas, asientos y puntos de embarque. |
| `PlanetWorld.js` | Luna y Marte: terreno, bases, recursos, cuevas y rover. |
| `TravelScene.js` | Escena visual del viaje interplanetario. |
| `ExteriorTasks.js` | Tareas y puntos de interacción del exterior. |
| `Tool.js` | Herramientas y rig de herramientas. |
| `Tether.js` | Cable de seguridad EVA. |
| `BaseKit.js`, `BaseBuildings.js` | Piezas y edificios de las bases planetarias. |

### Interfaz (`public/js/ui/`)

| Archivo | Responsabilidad |
|---|---|
| `HUD.js` | Referencias centralizadas en `this.dom`, barras, pantallas, avisos y ayudas. |
| `UserManual.js` | Manual de usuario y ayuda contextual. |
| `AcademyUI.js` | Interfaz de la Academia. |
| `DataCenterUI.js` | Interfaz del Centro de Datos. |
| `MissionDesignUI.js` | Interfaz de la mesa de diseño. |
| `MultiplayerUI.js` | Pantalla MULTIJUGADOR: crear/unirse, salas públicas, sala de espera, preparado, inicio y salida. |

### Red (`public/js/net/`)

| Archivo | Responsabilidad |
|---|---|
| `MultiplayerClient.js` | Cliente Colyseus: crear/unirse/reanudar salas, estado compartido, latencia, reconexión y envío de movimiento limitado a ~15 Hz. |
| `RemoteAvatar.js` | Avatar remoto visual: malla procedural, etiqueta de nombre, interpolación y animación de extremidades. **Sin física ni bucle propio.** |

### Servidor (`server/`)

| Archivo | Responsabilidad |
|---|---|
| `index.js` | Entrada Node independiente: HTTP, `/health`, `/rooms`, CORS restringido, apagado ordenado. |
| `rooms/SpaceRoom.js` | Sala autoritativa `space`: capacidad 4, código de invitación, anfitrión, validación, reconexión 30 s. |
| `schema/SpaceState.js` | Esquema sincronizado `SpaceState` + `PlayerState`. |
| `scripts/health.mjs` | Comprobación de `/health`. |
| `scripts/build-sdk.mjs` | Empaqueta `@colyseus/sdk` para el navegador. |
| `tests/multiplayer.test.mjs` | 11 pruebas con clientes reales contra un servidor Node real. |

---

## 5. Jugador y astronauta

El jugador es una cápsula física de cannon-es con un rig procedural de Three.js **[V]** (`Player.js`).

Capacidades verificadas:

- `setMode('walk')` y `setMode('zero')` para gravedad normal o ingravidez **[V]**.
- `setInterior(true/false)` para alternar la lógica de interior **[V]**.
- `setSeated(true/false)` y `setAction(...)` para animaciones puntuales **[V]**.
- Animaciones de caminata, EVA e idle construidas por código, sin modelos externos del astronauta **[V]**.
- `applyDamage()` y `repairHull()` para integridad del traje/casco **[V]**.
- El jugador se sincroniza con la cámara y la física en `update()` y `sync()` **[V]**.

### Supervivencia y recursos

| Recurso | Comportamiento comprobado |
|---|---|
| **Oxígeno (`o2`)** | Se consume fuera de zona segura; se regenera dentro del hábitat o esclusa presurizada. |
| **CO₂ (`player.co2`)** | Aumenta en EVA y disminuye en zona segura; se muestra en el HUD. |
| **Filtros (`player.filterLife`)** | Se degradan en EVA y se recuperan en zona segura; afectan a la regeneración de O₂. |
| **Energía RCS (`energy`)** | Se consume al propulsar; se regenera en zona segura. |
| **Integridad (`hull`)** | Baja por impactos; a cero, el jugador muere. |
| **Traje (`suit`)** | Estado de equipo y casco; se muestra en el HUD. |
| **Cable EVA (`tether`)** | Distancia, tensión y anclaje; obligatorio para algunas salidas. |

La lógica de CO₂ y filtros está en `Game.js` (~líneas 1124-1140), no en `Player.js` **[V]**. El HUD recibe los cinco valores mediante `setStats(o2, energy, integrity, co2, filterLife)` **[V]**.

---

## 6. Estación EVA-07

`Station.js` construye la estación orbital y su capa de juego **[V]**:

- módulos y estructuras exteriores;
- puntos de fuga/brecha con estado `active`, `repaired` y `progress`;
- métodos `spawnBreach()`, `repair(breach)` y serialización del estado;
- integración con partículas de fuga y con las tareas exteriores.

El interior habitable se carga aparte, desde GLB optimizados **[V]** (`Interior.js`):

- `public/assets/interior/habitat.glb`;
- `public/assets/interior/door.glb`;
- `public/assets/interior/colliders.json`.

`Interior.js` gestiona colisionadores estáticos, compuertas animadas, pantallas, iluminación por capas y la secuencia de esclusa **[V]**. La esclusa tiene fases y presión **[V]**. El smoke test comprueba que la posición del jugador se conserva al entrar y que la esclusa opera correctamente **[V]**.

---

## 7. Nave de transporte

`TransportShip.js` define una nave reutilizable para el hangar y los viajes **[V]**:

- casco principal de `11.0 × 3.0 × 4.2` unidades, con morro, quilla, patas, motores y detalles;
- materiales `hull`, `hullDark`, `dark`, `visor`, `accent`, `green`, `red` y `metal`;
- `setPosition(x, y, z)`, `setVisible()`, `setInteriorActive()`;
- `hatchPosition()`, `boardPosition()`, `seatPosition()`, `contains(position)`;
- `groundHeightAt()` y `getModuleAt()`;
- `update(dt)` para animaciones internas.

La nave tiene interior caminable y puntos de embarque/asiento **[V]**. La cinemática del Prompt 4, que los invocaba, está **cancelada**; la nave se usa para viajes y para el interior, no para una secuencia de introducción.

---

## 8. Luna y Marte

Ambos mundos usan `PlanetWorld.js` y se configuran en `Universe.js` **[V]**.

### Luna — Base Selene

- `id: 'moon'`, gravedad `1.624 m/s²`.
- Cráteres, zonas planas, montaña y recursos: hielo lunar, minerales, metales y regolito.
- Rover en la zona de aterrizaje.
- Paleta de terreno gris (`groundLow 0x62666d`, `groundHigh 0xb9bdc4`), acento cian (`0x5ff0ff`).

### Marte — Puesto Ares

- `id: 'mars'`, gravedad `3.73 m/s²`.
- Cráteres, cañón, montaña, zonas planas y recursos: minerales, hielo subsuperficial, metales y regolito.
- Cueva configurada en `{ x: -40, z: -26 }`.
- Paleta de terreno rojizo (`groundLow 0x7a3a22`, `groundHigh 0xd08a5a`), acento naranja (`0xff8a3c`).

`PlanetWorld` ofrece terreno, bases, recursos, cuevas, rover y serialización/restauración **[V]**. Los informes existentes documentan la remodelación artística de la base lunar sin cambiar la simulación.

---

## 9. Navegación y viaje interplanetario

- Destinos declarados: `station`, `moon`, `mars` **[V]** (`Game.js`, ~líneas 232-236).
- `travelTo(id)` inicia el viaje; `_updateTravel(dt)` actualiza la escena **[V]**.
- `TravelScene.js` gestiona la puesta en escena y la cámara del viaje **[V]**.
- `_boardShip()` sube al jugador a la nave; `_enterRover()` y `_exitRover()` controlan el rover **[V]**.
- El estado `'travel'` tiene su propia rama en `frame()` **[V]**.
- La nave y el destino se guardan (`shipLocation`, `destination`) **[V]**.

---

## 10. Misiones, Academia, Datos y Diseño

### Misiones

- `Missions.js` define **20 misiones** en `MISSIONS` y las gestiona con `MissionManager` **[V]**.
- Incluyen reparación de fugas, solar, antena, componentes, inspección de módulos, recuperación de herramientas, energía, soporte vital, laboratorio, navegación, Luna y Marte.
- Cada misión tiene categoría, dificultad, objetivos, recompensas y estado **[V]**.
- El progreso se serializa y se conserva en el guardado **[V]**.

### Academia

- `Academy.js` contiene **10 lecciones** (`ACADEMY_LESSONS`) **[V]**:
  1. Sistema solar
  2. Naves espaciales
  3. Instrumentos
  4. Gravedad y órbitas
  5. Energía y comunicaciones
  6. Diseño de misión
  7. Vehículos de lanzamiento
  8. Operaciones
  9. Control de tierra
  10. Análisis de datos

### Centro de Datos

- `ScienceData.js` reúne datos con fuente, unidad y fecha de consulta **[V]**.
- `DataCenterUI.js` muestra datos oficiales y parámetros del simulador en pestañas separadas **[V]**.

### Mesa de diseño

- `MissionDesign.js` define **seis fases**: necesidad, concepto, requisitos, diseño, verificar e implementar **[V]**.
- Incluye segmentos, modalidades, conceptos, instrumentos y objetivos científicos **[V]**.
- `MissionDesignUI.js` implementa la interfaz **[V]**.

---

## 11. Recursos, inventario y construcción

- Recursos del universo: `regolith`, `waterIce`, `minerals`, `metals`, `electronics`, `industrial` **[V]**.
- Carga de la nave (`cargo`) separada de los recursos de la base **[V]**.
- Inventario del jugador: componentes, filtros, muestras y herramientas **[V]**.
- Sistemas de ingeniería, soporte vital y laboratorio con estados parciales **[V]**.
- La mesa de diseño consume recursos al implementar una misión **[V]**.
- Las bases planetarias y el interior se construyen con módulos y costes; el estado se serializa **[V]**.

---

## 12. Persistencia

`Save.js` **[V]**:

- Clave: `orbital.universe.save`.
- Versión actual: `3`.
- Migración v1 → v2 → v3; los saves de versión superior se descartan.
- `readSave()` devuelve `{ version, savedAt, data }`.
- `writeSave(data)` guarda `{ version, savedAt, ...data }`.
- `clearSave()`, `hasSave()`.
- `hasViewedIntro()` y `setIntroViewed()` siguen exportados como código heredado, pero **ya no se usan** (cinemática cancelada).

El estado serializado incluye destino, nave, jugador, traje, inventario, ingeniería, soporte vital, laboratorio, recursos, carga, sistemas de Marte, estación, misiones, mantenimiento, Luna, Marte, vehículo, rover, diseño, Academia y modo guiado **[V]** (`serializeState()`).

---

## 13. Interfaz y pantallas

- El HUD centraliza sus referencias en `HUD.dom` **[V]**.
- Indicadores visibles: O₂, CO₂, RCS, integridad, filtros, cable EVA, traje, navegación, objetivo, reloj, avisos, guía y herramientas **[V]** (`public/index.html`, HUD).
- Pantallas registradas en `HUD.dom.screens`: `entry`, `menu`, `settings`, `pause`, `win`, `lose`, `multiplayer` **[V]**.
- El menú principal conserva sus siete opciones y añade **MULTIJUGADOR**; mantiene su diseño de dos columnas/rail lateral **[V]**.
- El HUD incluye un chip de sesión `#mp-hud` (código, jugadores, latencia) visible sólo en sesión en línea **[V]**.
- El menú de pausa tiene ocho botones con handlers reales **[V]**, pero su maquetación CSS presenta defectos (ver `PROJECT-STATUS.md` y `ART-DIRECTION.md`).

---

## 14. Multijugador cooperativo

Arquitectura cliente-servidor con **Colyseus 0.18** **[V]**:

- **Servidor independiente** en `server/` (Node.js + Express + `@colyseus/ws-transport`), con entrada, `/health`, `/rooms`, CORS restringido y apagado ordenado **[V]**.
- **Sala `space`**: máximo **4** jugadores, código de invitación de 6 caracteres (`A-Z`, `2-9`), salas públicas/privadas, anfitrión y fases `lobby`/`exploring` **[V]**.
- **Autoridad del servidor**: identidad, capacidad, movimiento, destino y acciones compartidas; todo dato del cliente se valida (números finitos, ±500, cuaternión normalizado, listas blancas, límite de frecuencia) **[V]**.
- **Estado sincronizado** (`SpaceState`/`PlayerState`): id, nombre, apariencia, posición, rotación, modo, animación, ubicación, interior, preparado, anfitrión, conexión y último contacto **[V]**.
- **Reconexión**: `onDrop` reserva el asiento 30 s; `onReconnect` restaura el estado; el SDK reintenta automáticamente **[V]**.
- **Cliente**: `MultiplayerClient.js` gestiona salas, estado y envío ~15 Hz; `RemoteAvatar.js` interpola avatares remotos sin física propia **[V]**.
- **Un solo renderer y un solo bucle**: los avatares se actualizan dentro de `Game.frame()`; no hay simulación ni bucle adicional **[V]**.
- **Guardado**: una sesión en línea **no** escribe en el perfil individual; `saveGame()` sale antes si `multiplayerActive` **[V]**.
- **URL del servidor**: `window.SPACE_TECH_CONFIG.multiplayerUrl` → `<meta name="multiplayer-url">` → localhost:2567 → mismo origen; sin `localhost` fijo en producción **[V]**.

**Estado de despliegue:** probado en localhost con clientes reales; **no hay servidor público desplegado**, por lo que no se afirma conectividad entre redes distintas **[V]**. Ver `docs/MULTIPLAYER-DEPLOYMENT.md`.

---

## 15. Cinemática inicial: CANCELADA

La cinemática de introducción del Prompt 4 está **cancelada de forma definitiva** por decisión del proyecto **[V]**:

- `startNewGame()` **no** usa el estado `'intro'` ni llama a `_runIntro()`; entra directamente a `'playing'` **[V]**.
- `Game.js` ya **no** importa `hasViewedIntro`/`setIntroViewed` **[V]**.
- `public/js/core/Cinematic.js` permanece como archivo heredado, **sin integrar**; no debe reactivarse sin petición expresa **[V]**.

---

## 16. Sistemas que deben protegerse

Cualquier cambio futuro debe conservar:

1. La persistencia y la migración de saves (`Save.js`).
2. Los controles y modos del jugador (`walk`/`zero`, EVA, cable).
3. La física y la gravedad de cada destino.
4. La estación EVA-07, sus brechas y su esclusa.
5. La Luna, Marte, el rover y las cuevas.
6. Las 20 misiones y su progreso.
7. La Academia, el Centro de Datos y la mesa de diseño.
8. El HUD y sus indicadores de soporte vital.
9. El menú de pausa y sus ocho acciones.
10. El flujo `entry → menu → playing` y la ausencia de misiones automáticas al iniciar.
11. El multijugador: un solo renderer/bucle, pausa local, sin sobrescribir el perfil individual y sin `localhost` fijo en producción.
12. La decisión de **cinemática cancelada**.

---

## 17. Referencias internas

- `AGENTS.md` — instrucciones permanentes para agentes.
- `docs/MULTIPLAYER-DEPLOYMENT.md` — despliegue público y comprobación entre redes.
- `docs/INFORME-PROMPT-3.7.md` — cierre de la capa educativa y de menús.
- `docs/INFORME-FASE1-BASE-LUNAR.md` — remodelación de la base lunar.
- `docs/capturas-menu/` — capturas de entrada, menú y pausa.
- `docs/capturas-arte/` — iteraciones visuales de la base lunar.
- `docs/benchmarks/` — mediciones de rendimiento y capturas comparativas.

---

**Nota:** este documento no modifica el juego. Su única finalidad es dejar un contexto fiable para las siguientes sesiones de trabajo.
