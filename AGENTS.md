# AGENTS.md — SPACE-TECH

> **Decisión del proyecto:** la cinemática de introducción del Prompt 4 está
> **CANCELADA**. No crear, reparar ni reintegrar escenas de embarque/despegue,
> ni llamar a `_runIntro()`. Toda partida nueva entra directamente al juego.
> No proponerla de nuevo salvo petición expresa.

## Comandos esenciales

| Comando | Qué hace |
|---------|----------|
| `npm run check` | Valida sintaxis de los **42** archivos `.js` con `node --check`. **Siempre ejecuta esto antes que nada.** |
| `npm run smoke` | Test automatizado completo del cliente (Puppeteer). Se ejecuta en background. |
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

- **Métodos de invitación:** enlace público (`?invite=`), código corto manual, y código QR.
- **Anfitrión:** al crear una sala privada, se genera un token de alta entropía y se muestra una ventana "INVITAR A TU TRIPULACIÓN" con código, copiar enlace, QR y plazas disponibles.
- **Validación en servidor:** el token se verifica exclusivamente en `onAuth`; el código por sí solo no autoriza el acceso a salas privadas.
- **Seguridad:** tokens aleatorios (`crypto.randomBytes(24).toString('base64url')), TTL configurable (`INVITE_TTL_MS`), usos máximos (`INVITE_MAX_USES`), rate limiting (`INVITE_MAX_ATTEMPTS`, `INVITE_BLOCK_MS`). Revocables y con caducidad.
- **Experiencia del invitado:** abrir página → recuperar código → nombre de sala → solicitar nombre → validar → admitir → mostrar astronauta.
- **Compatibilidad:** computadoras, Android, iPhone, tablets. URLs con dominio público configurado; nunca `localhost` en enlaces compartidos.
- **Compartir:** Web Share API cuando esté disponible; copia al portapapeles para WhatsApp, Discord, Mensajes y correo.
- **No integrar APIs privadas** de plataformas externas.
- **Pruebas:** primero con dos clientes independientes; después dos dispositivos en redes diferentes. No declarar funcionamiento por Internet hasta prueba pública real.

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

1. **`npm run check`** — 42/42 archivos válidos (siempre primero)
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
