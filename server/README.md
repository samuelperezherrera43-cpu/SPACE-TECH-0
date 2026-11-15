# SPACE-TECH · servidor multijugador

Servidor autoritativo [Colyseus 0.18](https://docs.colyseus.io/) para el
multijugador cooperativo de SPACE-TECH. Es un proyecto Node.js **independiente**
del cliente Three.js: se instala, arranca y prueba por separado.

## Requisitos

- Node.js >= 22 (probado con 24.15.0)
- npm 10+

## Instalación y arranque

```bash
cd server
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # recarga automática
# o
npm start                 # producción
```

Por defecto escucha en `http://localhost:2567` y el WebSocket en
`ws://localhost:2567`. Comprueba la salud con:

```bash
npm run health
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio (JSON) |
| GET | `/` | Información mínima del servidor |
| GET | `/__healthcheck` | Health check interno de Colyseus |
| WS | `/` | Transporte WebSocket de Colyseus |

## Sala `space`

| Propiedad | Valor |
|-----------|-------|
| Máximo de jugadores | 4 |
| Identificador | Código de 6 caracteres (`A-Z`, `2-9`, sin ambigüedad) |
| Salas privadas | No aparecen en la búsqueda pública; se entra por código |
| Salas públicas | Visibles vía `getAvailableRooms('space')` |
| Anfitrión | Primer jugador; se reasigna al salir |
| Reconexión | Asiento reservado 30 s |

### Mensajes cliente → servidor

| Tipo | Payload | Validación |
|------|---------|------------|
| `move` | `{x,y,z,qx,qy,qz,qw,mode,anim,location,interior}` | Números finitos, posición ±500, cuaternión normalizado, `mode`/`location` en listas blancas, máximo 25 paquetes/s |
| `ready` | `{ready:boolean}` | Sólo en fase `lobby` |
| `start` | `{}` | Sólo anfitrión; todos preparados |
| `destination` | `{destination}` | Sólo anfitrión; `station`/`moon`/`mars` |
| `profile` | `{name?,appearance?}` | Nombre saneado 1–18 caracteres; apariencia 0–3 |
| `ping` | `{t}` | Eco del timestamp |

### Mensajes servidor → cliente

| Tipo | Payload |
|------|---------|
| `welcome` | `{code,sessionId,host,maxClients}` |
| `resumed` | `{code,sessionId,host}` |
| `pong` | `{t}` |
| `notice` | `{level,message}` |
| `started` | `{destination,revision}` |
| `destinationChanged` | `{destination,revision}` |
| `error` | `{message}` |

### Estado sincronizado (`SpaceState`)

`code`, `roomName`, `isPrivate`, `phase`, `hostId`, `maxClients`,
`destination`, `revision`, `createdAt` y el mapa `players` con
`id`, `name`, `appearance`, `x/y/z`, `qx/qy/qz/qw`, `mode`, `anim`,
`location`, `interior`, `ready`, `host`, `connected`, `lastSeen`.

## Pruebas

```bash
npm test          # tests headless con varios clientes reales
```

Las pruebas levantan el servidor en un puerto efímero y conectan clientes con
`@colyseus/sdk`. Ver `docs/MULTIPLAYER-DEPLOYMENT.md` para el despliegue
público y la comprobación entre redes distintas.
