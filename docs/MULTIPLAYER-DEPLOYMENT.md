# SPACE-TECH — Despliegue del multijugador

**Estado:** implementado y probado en localhost con varios clientes reales.
**Servidor público:** **no desplegado todavía**. Por tanto, **no se afirma** que
la conexión entre redes distintas esté verificada. Este documento explica cómo
desplegarlo y cómo comprobarlo.

---

## 1. Arquitectura de red

```
Navegador A ─┐
Navegador B ─┼─ WSS/HTTPS ─► Servidor Node.js + Colyseus 0.18 ─► Sala "space" (máx. 4)
Navegador C ─┤                /health · /rooms · matchmaking
Navegador D ─┘
```

- **Cliente:** el juego Three.js existente. Un único renderer y un único bucle.
- **Servidor:** autoritativo para identidad, capacidad, estado compartido,
  destino y confirmación de acciones. No confía en los valores del cliente.
- **Transporte:** WebSocket de Colyseus. En producción debe ir sobre **WSS**.
- **Salas:** instancias aisladas con código de invitación de 6 caracteres.

| Componente | Versión |
|---|---|
| `colyseus` | `0.18.12` |
| `@colyseus/core` | `0.18.28` (dependencia transitiva) |
| `@colyseus/schema` | `5.0.48` |
| `@colyseus/ws-transport` | `0.18.5` |
| `@colyseus/sdk` (cliente) | `0.18.10` |
| `express` | `5.3.0` |
| Node.js | `>= 22` (probado con `24.15.0`) |

---

## 2. Estructura del servidor

```
server/
├─ index.js                 # entrada, HTTP, /health, /rooms, CORS, apagado
├─ package.json             # proyecto Node independiente
├─ .env.example             # variables de entorno documentadas
├─ schema/
│  └─ SpaceState.js         # estado sincronizado (sala + jugadores)
├─ rooms/
│  └─ SpaceRoom.js          # sala autoritativa, validación, reconexión
├─ scripts/
│  ├─ health.mjs            # comprobación de /health
│  └─ build-sdk.mjs         # empaqueta @colyseus/sdk para el navegador
└─ tests/
   └─ multiplayer.test.mjs  # pruebas con clientes reales
```

El cliente carga el SDK empaquetado en `public/vendor/colyseus-sdk.mjs`
(importmap de `public/index.html`). Para regenerarlo:

```bash
npm run server:build-sdk
```

---

## 3. Salas y ciclo de vida

| Propiedad | Valor |
|---|---|
| Nombre de sala | `space` |
| Capacidad | 4 jugadores |
| Identificador | Código de 6 caracteres (`A-Z`, `2-9`) |
| Salas privadas | No aparecen en `/rooms`; se entra por código |
| Salas públicas | Visibles en `/rooms` y por matchmaking |
| Anfitrión | Primer jugador; se reasigna si sale |
| Fases | `lobby` → `exploring` |
| Vacío | La sala se destruye y libera el código |

El código se genera en `onCreate()` consultando el registro de Presence para
evitar colisiones y se libera en `onDispose()`.

---

## 4. Mensajes

### Cliente → servidor

| Tipo | Payload | Validación del servidor |
|---|---|---|
| `move` | `{x,y,z,qx,qy,qz,qw,mode,anim,location,interior}` | Números finitos; posición acotada a ±500; cuaternión normalizado; `mode` ∈ {`walk`,`zero`}; `location` ∈ {`station`,`moon`,`mars`}; máximo 25 paquetes/s por cliente |
| `ready` | `{ready:boolean}` | Sólo en fase `lobby` |
| `start` | `{}` | Sólo anfitrión; todos los invitados preparados |
| `destination` | `{destination}` | Sólo anfitrión; destino válido |
| `profile` | `{name?,appearance?}` | Nombre saneado (1–18, sin control ni `<>`); apariencia 0–3 |
| `ping` | `{t}` | Eco del timestamp |

### Servidor → cliente

| Tipo | Payload |
|---|---|
| `welcome` | `{code,sessionId,host,maxClients}` |
| `resumed` | `{code,sessionId,host}` |
| `pong` | `{t}` |
| `notice` | `{level,message}` |
| `started` | `{destination,revision}` |
| `destinationChanged` | `{destination,revision}` |
| `error` | `{message}` |

### Estado sincronizado

`SpaceState`: `code`, `roomName`, `isPrivate`, `phase`, `hostId`,
`maxClients`, `destination`, `revision`, `createdAt`, `players`.

`PlayerState`: `id`, `name`, `appearance`, `x/y/z`, `qx/qy/qz/qw`, `mode`,
`anim`, `location`, `interior`, `ready`, `host`, `connected`, `lastSeen`.

---

## 5. Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `2567` | Puerto HTTP/WS. **El proveedor lo inyecta.** |
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `NODE_ENV` | `development` | `production` desactiva el modo dev. |
| `CORS_ORIGIN` | vacío (todos) | Orígenes permitidos, separados por coma. **Obligatorio en producción.** |
| `PUBLIC_URL` | vacío | URL pública anunciada en `/health`. Se usa para generar enlaces de invitación `${PUBLIC_URL}?invite=${token}`. |
| `INVITE_TTL_MS` | `3600000` | TTL de la invitación en milisegundos (0 = sin caducidad). |
| `INVITE_MAX_USES` | `1` | Número máximo de usos por invitación (0 = ilimitado). |
| `INVITE_MAX_ATTEMPTS` | `3` | Intentos fallidos máximos antes de bloquear. |
| `INVITE_ATTEMPT_WINDOW_MS` | `60000` | Ventana de tiempo (ms) para contar los intentos fallidos. |
| `INVITE_BLOCK_MS` | `900000` | Tiempo de bloqueo en ms después de agotar los intentos. |

Copia `server/.env.example` a `server/.env` y ajusta los valores.

### URL del servidor en el cliente

El cliente resuelve la URL en este orden (`public/js/net/MultiplayerClient.js`):

1. `window.SPACE_TECH_CONFIG.multiplayerUrl`
2. `<meta name="multiplayer-url" content="...">`
3. `localhost`/`127.0.0.1` → `http://<host>:2567`
4. Cualquier otro host → **mismo origen** (proxy inverso)

**No hay `localhost` fijo en la ruta de producción.**

Para un servidor en otro dominio, añade antes de `main.js`:

```html
<script>
  window.SPACE_TECH_CONFIG = {
    multiplayerUrl: 'https://mp.tu-dominio.com'
  };
</script>
```

---

## 6. Ejecución local

```bash
# 1) Dependencias del servidor
npm run server:install

# 2) Servidor multijugador (terminal 1)
npm run server:dev

# 3) Juego (terminal 2)
npm run dev

# 4) Comprobaciones
npm run server:health
npm run server:test
```

Abre `http://localhost:5173` en dos navegadores (o ventanas privadas), entra en
**MULTIJUGADOR**, crea una sala en uno y únete con el código en el otro.

> `npm run server:test` levanta un servidor en un puerto de prueba y conecta
> clientes reales. No sustituye a una prueba entre redes distintas.

---

## 7. Despliegue público

Cualquier proveedor que ejecute Node.js y permita WebSockets sirve. Ejemplos:
Render, Railway, Fly.io, Koyeb, VPS con Nginx.

### 7.1 Proveedor tipo Render/Railway

1. Sube el repositorio a GitHub.
2. Crea un **Web Service** apuntando a la carpeta `server/`.
3. Build: `npm install`. Start: `npm start`.
4. Variables:
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://tu-juego.example.com`
   - `PUBLIC_URL=https://tu-servidor.example.com`
5. Health check: `/health`.
6. El proveedor inyecta `PORT`; no lo fijes.

### 7.2 VPS con Nginx (WSS/HTTPS)

```nginx
server {
  listen 443 ssl http2;
  server_name mp.tu-dominio.com;

  ssl_certificate     /etc/letsencrypt/live/mp.tu-dominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/mp.tu-dominio.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:2567;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
  }
}
```

Arranca el servidor con un gestor de procesos (systemd, pm2):

```bash
NODE_ENV=production PORT=2567 CORS_ORIGIN=https://tu-juego.example.com \
  PUBLIC_URL=https://mp.tu-dominio.com node server/index.js
```

### 7.3 Frontend

- Publica `public/` donde ya se despliega el juego (Cloudflare Pages, etc.).
- Define `window.SPACE_TECH_CONFIG.multiplayerUrl` con la URL **HTTPS** del servidor.
- Si el juego y el servidor comparten dominio, publica el servidor bajo el mismo
  origen y no necesitas configurar nada.

### 7.4 Lista de comprobación

- [ ] `https://…/health` responde `{ "ok": true }`.
- [ ] El certificado TLS es válido (WSS sin advertencias).
- [ ] `CORS_ORIGIN` contiene **solo** el dominio real del juego.
- [ ] El puerto del proveedor se respeta (`process.env.PORT`).
- [ ] `npm run server:health https://…` devuelve `SALUD OK`.
- [ ] Dos dispositivos en **redes diferentes** crean y unen una sala.
- [ ] La desconexión de un jugador no detiene a los demás.
- [ ] Un quinto jugador recibe un rechazo claro.

---

## 8. Pruebas realizadas

Ejecutadas el 15/11/2026 con `npm run server:test` (clientes reales de
`@colyseus/sdk` contra un servidor Node real):

| # | Prueba | Resultado |
|---|---|---|
| 1 | Iniciar servidor y `/health` | ✅ |
| 2 | Conectar el primer cliente | ✅ |
| 3 | Crear sala privada con código | ✅ |
| 4 | Segundo cliente por código | ✅ |
| 5 | Tercer y cuarto cliente | ✅ |
| 6 | Los cuatro astronautas aparecen | ✅ |
| 7 | Movimiento sincronizado | ✅ |
| 8 | Desconexión detectada y limpieza | ✅ |
| 9 | Reconexión automática | ✅ |
| 10 | Quinto jugador rechazado | ✅ |
| 11 | Un jugador inactivo no detiene a los demás | ✅ |
| 12 | Modo individual intacto (`npm run smoke`) | ✅ |

Además se comprobó:

- Posiciones imposibles (`NaN`, `Infinity`, ±999999) acotadas o descartadas.
- Modos inválidos rechazados.
- Ráfagas por encima del límite de frecuencia descartadas.
- Salas privadas ausentes de `/rooms`; públicas presentes.
- Cambio de destino sólo por el anfitrión; los invitados reciben error.
- Reasignación de anfitrión al salir.

### Limitación importante

Estas pruebas son **locales**. No demuestran conectividad entre redes distintas.
Esa prueba requiere un servidor público desplegado y dos dispositivos en redes
diferentes (por ejemplo, una red doméstica y datos móviles).

---

## 9. Comportamiento en el juego

- El menú principal conserva sus opciones y añade **MULTIJUGADOR**.
- La pantalla permite crear sala (pública/privada), unirse por código, buscar
  salas públicas, ver latencia, prepararse, iniciar y salir.
- Al iniciar, el cliente entra al mundo compartido **sin borrar ni sobrescribir
  el guardado individual**.
- Cada jugador conserva su propio perfil y su propia partida individual.
- Los avatares remotos se interpolan; no tienen física propia.
- La pausa (ESC) sólo detiene el control local. El servidor y los demás
  jugadores continúan.
- Si se pierde la conexión, aparece el indicador «Reconectando…»; el SDK
  reintenta y, al volver, el estado se reconcilia.
- Al salir o al agotarse la reconexión, el avatar remoto se elimina.

### Lo que **no** está sincronizado todavía

- Recursos, inventario, construcción y misiones compartidas.
- Vehículos y rover compartidos.
- Estado de las brechas y reparaciones.
- Cuentas persistentes (el MVP usa identidad de sesión).

---

## 10. Rendimiento

- Un único renderer y un único `setAnimationLoop`.
- Los avatares remotos son mallas simples (sin física, sin sombras).
- Envío de movimiento limitado a ~15 Hz; el servidor corta a 25 Hz.
- Interpolación por fotograma con `lerp`/`slerp`.
- Máximo 4 avatares remotos por sala.
- Pensado para Intel UHD 620 y equipos modestos.

---

## 11. Limitaciones y estado de despliegue

- **No hay servidor público desplegado en este repositorio.**
- Por tanto, **no se afirma** que cuatro jugadores en redes distintas puedan
  conectarse todavía.
- El MVP usa identidad de sesión temporal; no hay autenticación persistente.
- Sin Redis, el despliegue es de **una sola instancia**. Para varias instancias
  hay que configurar `RedisDriver` y `RedisPresence` en `server/index.js`.
- La reconexión tras recargar la página depende de `sessionStorage` y de la
  ventana de 30 s del servidor.
