# AGENTS.md — SPACE-TECH

> **Decisión del proyecto:** la cinemática de introducción del Prompt 4 está
> **CANCELADA**. No crear, reparar ni reintegrar escenas de embarque/despegue,
> ni llamar a `_runIntro()`. Toda partida nueva entra directamente al juego.
> No proponerla de nuevo salvo petición expresa.

## Comandos esenciales

| Comando | Qué hace |
|---------|----------|
| `npm run check` | Valida sintaxis de los **43** archivos `.js` con `node --check`. **Siempre ejecuta esto antes que nada.** |
| `npm run smoke` | Test automatizado completo del cliente (Puppeteer). Se ejecuta en background. |
| `npm run touch:test` | Test del modo táctil en Chrome con viewport de iPhone. |
| `npm run dev` | Servidor estático `scripts/dev.mjs` + juego en `localhost:5173`. |
| `npm run server:install` | Instala las dependencias del servidor Colyseus (`server/`). |
| `npm run server:dev` | Arranca el servidor multijugador con recarga automática. |
| `npm run server` | Arranca el servidor multijugador en modo normal. |
| `npm run server:test` | Pruebas headless del servidor con varios clientes reales. |
| `npm run server:health` | Consulta `/health` del servidor. |
| `npm run server:build-sdk` | Reempaqueta `@colyseus/sdk` en `public/vendor/colyseus-sdk.mjs`. |

## Arquitectura y flujo

| Elemento | Ubicación | Observación |
|----------|-----------|-------------|
| **Entrada** | `public/js/main.js` | `import { Game } from './core/Game.js'` → `new Game(root)` → `game.run()` |
| **Motor principal** | `public/js/core/Game.js` | Clase `export class Game` — estado, renderizado, física, HUD, menús, integración multijugador |
| **Persistencia** | `public/js/core/Save.js` | `localStorage.key 'orbital.universe.save'` — versión 3, migrate v1→v2→v3 |
| **HUD** | `public/js/ui/HUD.js` | Referencias `this.dom` — IDs deben existir en `index.html` |
| **Jugador** | `public/js/entities/Player.js` | Cápsula física + rig procedural con animaciones walk/EVA/Idle |
| **Nave** | `public/js/entities/TransportShip.js` | 11m de largo, interior caminable, compuertas, asientos |
| **Estación** | `public/js/entities/Station.js` | Módulos, compuertas, brechas, sistemas de apoyo |
| **Luna/Marte** | `public/js/entities/PlanetWorld.js` | Mundos con módulos, recursos, cuevas, rover |
| **Cliente de red** | `public/js/net/MultiplayerClient.js` | Colyseus SDK: salas, estado, reconexión, envío limitado a ~15 Hz |
| **Avatar remoto** | `public/js/net/RemoteAvatar.js` | Malla visual ligera + interpolación. **Sin física ni bucle propio** |
| **UI multijugador** | `public/js/ui/MultiplayerUI.js` | Pantalla MULTIJUGADOR: crear/unirse, lista, sala de espera, preparado |
| **Servidor** | `server/` | Node.js + Colyseus 0.18, autoritativo, independiente del cliente |

## Sistema de módulos (ES Modules)

- **Nunca uses `require()`** — el proyecto usa JavaScript ES Modules puros.
- Importaciones desde `./ruta`, `'three'`, `'cannon-es'` o `'@colyseus/sdk'` (importmap de `index.html`).
- `@colyseus/sdk` se sirve empaquetado en `public/vendor/colyseus-sdk.mjs`; no se carga desde `node_modules` en el navegador.
- El check usa `node --check` en cada archivo — **sintaxis inválida rompe el pipeline**.

## Multiplataforma (táctil y PWA)

| Elemento | Ubicación | Observación |
|----------|-----------|-------------|
| **Controles táctiles** | `public/js/ui/TouchControls.js` | Joystick, zona de cámara y botones. Escribe en `controls.touch` y `controls.mouse`; no crea bucles ni física |
| **Estado táctil** | `public/js/engine/Controls.js` | `this.touch` separado de `pad` (poll lo sobrescribe); `coarsePointer` evita Pointer Lock y mousedown sintético |
| **Reacomodo del HUD** | `public/css/styles.css` | `body.touch-input` mueve stats arriba, oculta la barra de herramientas y usa `env(safe-area-inset-*)` |
| **Calidad adaptativa** | `Game._adaptQuality()` | Sólo en táctil: pixel ratio 0.56–1.0; el perfil gráfico sigue siendo único (`standard`) |
| **PWA** | `public/manifest.webmanifest` + `public/assets/icon-*.png` | Iconos con `node scripts/make-icons.mjs`; no hay service worker |
| **URLs de despliegue** | `public/config.js` | `multiplayerUrl` y `publicUrl`; nunca `localhost` en enlaces compartidos |

Reglas:

- No duplicar la simulación: el táctil sólo escribe estado que Player/Camera ya consumen.
- No añadir presets de calidad: el smoke exige un único perfil `standard`.
- En puntero grueso no se pide Pointer Lock.
- `window.SPACE_TECH_TOUCH = true` fuerza el modo táctil (pruebas y equipos híbridos).

## Estados de la partida (Game.state)

| Estado | Significado |
|--------|-------------|
| `'entry'` | Pantalla de bienvenida / menú principal |
| `'playing'` | Jugando (EVA, interior, planetas, sesión cooperativa) |
| `'travel'` | Viaje interplanetario (Luna/Marte) |
| `'menu'` | Menús abiertos (configuración, diseño, academia, multijugador) |
| `'paused'` | Menú de pausa activo (sólo pausa el control local) |
| `'won'` | Victoria (todas las brechas reparadas) |
| `'lost'` | Derrota (integridad del casco a 0) |

## Multijugador cooperativo

| Elemento | Valor |
|----------|-------|
| Framework | Colyseus `0.18.12` (servidor) + `@colyseus/sdk` `0.18.10` (cliente) |
| Sala | `space`, máximo **4** jugadores, código de invitación de 6 caracteres |
| Transporte | WebSocket (WSS en producción) |
| Autoridad | Servidor: identidad, capacidad, estado, destino, acciones compartidas |
| Sincronización | id, nombre, apariencia, posición, rotación, modo, animación, ubicación, conexión |
| Frecuencia | ~15 Hz por jugador (servidor limita a 25 paquetes/s) |
| Reconexión | Automática del SDK + asiento reservado 30 s + reanudación por token |
| Guardado | La sesión en línea **no** escribe en el perfil individual |

Flujo: menú → **MULTIJUGADOR** → crear/unirse → sala de espera → prepararse →
el anfitrión inicia → `Game.enterMultiplayerWorld()` → avatares remotos.

Reglas que un agente debe respetar:

- No duplicar renderers, bucles de juego ni simulaciones físicas por avatar.
- No pausar la sala entera por la pausa de un jugador.
- No hardcodear `localhost` en producción: usar `SPACE_TECH_CONFIG.multiplayerUrl`,
  `<meta name="multiplayer-url">` o el mismo origen.
- No afirmar conectividad por Internet sin un servidor público desplegado y probado.
- Mantener compatibilidad con Intel UHD 620 (4 avatares visuales como máximo).

## Sistema de invitaciones (Prompt 5.2)

**Estado real:** el lado servidor está implementado; **la interfaz de invitación
en el cliente todavía no existe**. No afirmar lo contrario.

- **Implementado en servidor** (`server/invites.js`):
  - `generateToken()` crea un token de alta entropía (`crypto.randomBytes(24)`
    en base64url) al crear una sala privada.
  - `setCode(token, code)` asocia el código de 6 caracteres al token.
  - `GET /invite/:token` devuelve `{ ok, roomName, code, usesLeft, expiresAt }`.
  - Mensajes de sala `invite:get` (cualquier jugador) e `invite:rotate`
    (sólo el anfitrión).
  - Seguridad: TTL (`INVITE_TTL_MS`), usos (`INVITE_MAX_USES`), intentos
    fallidos (`INVITE_MAX_ATTEMPTS`), ventana (`INVITE_ATTEMPT_WINDOW_MS`) y
    bloqueo (`INVITE_BLOCK_MS`).
- **Validación en `onAuth`:** si el cliente envía `inviteToken`, se valida y
  consume un uso. Si **no** envía token, la entrada por código sigue permitida
  (compatibilidad con el flujo actual). Endurecerlo exige antes crear la UI de
  invitación en el cliente.
- **Pendiente en cliente:** pantalla "INVITAR A TU TRIPULACIÓN" con código,
  enlace, QR, copiar/compartir y plazas libres; lectura de `?invite=` al abrir
  la página. No existe todavía.
- **Compatibilidad:** computadoras, Android, iPhone, tablets. URLs con dominio
  público configurado; nunca `localhost` en enlaces compartidos.
- **Pruebas:** primero dos clientes independientes; después dos dispositivos en
  redes distintas. No declarar funcionamiento por Internet hasta prueba pública
  real.

### Variables de entorno (server/.env.example)

- `INVITE_TTL_MS` — TTL en ms (0 = sin caducidad).
- `INVITE_MAX_USES` — usos máximos por invitación.
- `INVITE_MAX_ATTEMPTS` — intentos fallidos antes de bloquear.
- `INVITE_ATTEMPT_WINDOW_MS` — ventana para contar intentos.
- `INVITE_BLOCK_MS` — tiempo de bloqueo después de agotar intentos.
- `PUBLIC_URL` — URL base para generar enlaces `${publicBase}?invite=${token}`.

## Puntos críticos que un agente debe evitar

| Riesgo | Causa | Solución |
|--------|-------|----------|
| `Cannot set properties of undefined (setting 'co2')` | `player.co2 = 0` antes de crear `this.player = new Player(...)` | Asignar después de crear al jugador |
| `Cannot set properties of undefined (setting 'textContent')` | Referencias DOM en HUD.js que no existen en `index.html` | Verificar que los IDs existan antes de usarlos |
| `setStats()` con parámetros incorrectos | Llamadas con 3 en vez de 5 parámetros | Pasar `(o2, energy, integrity, co2, filterLife)` |
| Sobrescribir el perfil en multijugador | `saveGame()` durante una sesión en línea | `saveGame()` sale antes si `multiplayerActive` |
| Cinemática rota al iniciar | `_runIntro()` inexistente | Cancelada: `startNewGame()` entra directo a `'playing'` |
| Congelar el mundo al pausar | Detener `game.update(dt)` globalmente | La pausa es local; el servidor y los demás clientes siguen |
| Avatares fantasma | No limpiar al salir | `RemoteAvatar.dispose()` + borrado del mapa al salir |
| Quinto jugador | Sala llena | El servidor rechaza con `room is full/locked` |

## Flujo de trabajo verificado

1. **`npm run check`** - 43/43 archivos válidos (siempre primero)
2. **`npm run smoke`** — test automatizado del cliente (background)
3. **`npm run dev`** + **`npm run server:dev`** — juego y servidor en paralelo
4. **Clic en "NUEVA PARTIDA"** → entra directo al juego (sin cinemática)
5. **Clic en "MULTIJUGADOR"** → crear sala, compartir código, prepararse e iniciar
6. **`npm run server:test`** — pruebas de servidor con 4 clientes + quinto rechazado
7. **Validar visualmente** — O₂, CO₂, filtros, EVA, avatares remotos, pausa local

## Flujos de operación

### Nueva partida

```bash
npm run check
npm run dev
# Clic "NUEVA PARTIDA" → entra directo al juego
```

### Multijugador local (dos o más clientes)

```bash
npm run server:install      # una sola vez
npm run server:dev          # terminal 1
npm run dev                 # terminal 2
# Abrir dos navegadores en http://localhost:5173
# MULTIJUGADOR → Crear sala → copiar código → Unirse en el otro cliente
```

### Pausa

- **ESC** alterna `#screen-pause`
- `game.pause()` / `game.resume()` — pausan **sólo** el control local
- En multijugador, los demás clientes y el servidor continúan

### Viajes Luna/Marte

- `game.travelTo('moon')` / `game.travelTo('mars')`
- `game._updateTravel(dt)` — actualiza la escena de viaje
- `game._boardShip()`, `game._enterRover()` / `game._exitRover()`
- En multijugador, el anfitrión cambia el destino compartido con `destination`

## Recuperación y respaldo

- **Backup confirmado**: `C:\Users\Usuario01\Desktop\juegodemo_backup_20261114`
- **Backup prompt4**: `C:\Users\Usuario01\Desktop\juegodemo_backup_prompt4`
- **Backup prompt5**: `C:\Users\Usuario01\Desktop\juegodemo_backup_prompt5`
- **Siempre verifica** con `npm run check` después de cualquier modificación
- **Nunca sobrescribir Game.js completo** — aplicar cambios incrementales
- **Nunca restaurar el proyecto entero** desde un backup

## Referencias rápidas

- `npm run check` → valida todos los `.js`
- `npm run smoke` → test automatizado del cliente
- `npm run server:test` → pruebas del servidor multijugador
- `index.html` → importmap (Three.js, Cannon-es, `@colyseus/sdk`) y pantallas
- `public/js/core/Game.js` → `startNewGame()`, `frame()`, `pause()`/`resume()`,
  `openMultiplayer()`, `enterMultiplayerWorld()`, `_syncMultiplayer()`
- `public/js/core/Save.js` → `readSave()`, `writeSave()`, `hasSave()`
- `public/js/ui/HUD.js` → `this.dom`, pantallas registradas en `screens`
- `public/js/entities/Player.js` → `setMode('walk'/'zero')`, `setInterior()`, animaciones
- `server/index.js` → entrada, `/health`, `/rooms`, CORS, apagado ordenado
- `server/rooms/SpaceRoom.js` → sala autoritativa, validación, reconexión
- `server/schema/SpaceState.js` → estado sincronizado
- `docs/MULTIPLAYER-DEPLOYMENT.md` → despliegue público, WSS/HTTPS, variables
