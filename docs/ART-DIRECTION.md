# SPACE-TECH — Dirección artística

**Documento:** identidad visual, puesta en escena y criterios estéticos  
**Fecha:** 15 de noviembre de 2026  
**Base:** paleta, materiales, iluminación y capturas existentes en el repositorio.  
**Criterio:** lo marcado como **[V]** está en el código o en capturas actuales. Lo marcado como **[P]** es una propuesta de dirección artística para la cinemática o para el menú de pausa; **no** describe algo ya implementado.

---

## 1. Idea visual

SPACE-TECH debe sentirse como un **centro de operaciones aeroespacial realista y legible**, no como una fantasía espacial genérica. La estética actual combina:

- **Precisión industrial:** paneles, juntas, rejillas, luces de estado y tipografía técnica.
- **Frialdad orbital:** azul profundo, cian de instrumentación y superficies metálicas.
- **Acentos cálidos de alerta:** ámbar para advertencias, rojo para fallos, verde para sistemas correctos.
- **Escala humana:** el astronauta y la nave deben leerse como objetos físicos dentro de un entorno comprensible.

La referencia interna es el propio simulador: la estación EVA-07, la base lunar Selene y el puesto marciano Ares ya tienen una identidad visual coherente. La cinemática y los menús deben **extenderla**, no sustituirla.

---

## 2. Paleta verificada

### 2.1 Interfaz

Definida en `public/css/styles.css` **[V]**:

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#04060d` | Fondo espacial profundo |
| `--panel` | `rgba(7, 13, 24, 0.72)` | Paneles translúcidos |
| `--panel-solid` | `#070d18` | Paneles opacos |
| `--line` | `rgba(120, 190, 230, 0.22)` | Bordes y separadores |
| `--text` | `#dff3ff` | Texto principal |
| `--muted` | `#7f9bb3` | Texto secundario |
| `--cyan` | `#5ff0ff` | Acento principal, instrumentación, foco |
| `--green` | `#6dffa8` | Estado correcto |
| `--amber` | `#ffb45f` | Advertencia |
| `--red` | `#ff5c6c` | Fallo o peligro |

La tipografía de interfaz es `Segoe UI`/system-ui; la tipografía técnica es monoespaciada (`ui-monospace`, `Cascadia Mono`, `Consolas`) **[V]**.

### 2.2 Materiales 3D

Definidos en `public/js/engine/Materials.js` **[V]**:

| Material | Color / rasgo |
|---|---|
| `hull` | Blanco con textura procedural de casco |
| `hullDark` | `0xb9c4d4` |
| `dark` | `0x8d99aa` |
| `visor` | `0x06121e`, emisivo `0x0b2f40` |
| `accent` | Cian `0x5ff0ff`, emisivo |
| `green` | `0x6dffa8`, emisivo |
| `red` | `0xff5c6c`, emisivo |
| `suit` | Blanco con textura procedural de traje |
| `suitDark` | `0x566273` |

### 2.3 Destinos

| Destino | Paleta verificada |
|---|---|
| **Luna** | Terreno `0x62666d` → `0xb9bdc4`, roca `0x7d828a`, acento cian `0x5ff0ff`, mineral `0xffb45f`. |
| **Marte** | Terreno `0x7a3a22` → `0xd08a5a`, roca `0x8f4a2e`, acento naranja `0xff8a3c`, mineral `0x8ff0ff`. |

Los valores están en `public/js/core/Universe.js` **[V]**.

---

## 3. Iluminación y renderizado

Configuración actual **[V]** (`Game.js` y `Environment.js`):

- Renderer con `ACESFilmicToneMapping` y exposición `1.02`.
- Sombras `PCFSoftShadowMap` cuando el preset lo permite.
- Pixel ratio limitado por `QualityManager`.
- Postproceso (`PostFX`) sobre la escena.
- Luz solar direccional cálida (`0xfff1dd`, intensidad `2.7`) con sombras.
- Cielo con estrellas procedurales y colores fríos.
- Tierra esférica de radio `115` con textura procedural, nubes y atmósfera Fresnel aditiva (`0x3d8fe0`).
- Halo solar y sprite de sol con blending aditivo.

### Criterios para la cinemática **[P]**

1. **Una sola fuente solar clara** para que la nave y la plataforma tengan volúmenes legibles.
2. **Contraste frío/cálido:** cian de instrumentación contra ámbar de motores y polvo de lanzamiento.
3. **Niebla atmosférica** cerca del suelo durante el despegue; espacio negro y estrellas al salir.
4. **Nada de imágenes estáticas:** toda la secuencia debe verse en 3D con el renderer existente.
5. **Legibilidad por encima de espectáculo:** evitar lens flares excesivos y humo que oculte la nave.

---

## 4. Cinemática inicial — lenguaje visual propuesto

> **Estado:** propuesta de dirección artística. La cinemática **no está implementada**; ver `PROJECT-STATUS.md`.

### Escena A — Plataforma terrestre

- **Set:** plataforma de hormigón oscuro, torre de acceso, brazos de servicio, luces de balizamiento ámbar y grúa.
- **Nave:** `TransportShip` en posición vertical o inclinada, con el casco blanco y detalles oscuros ya existentes.
- **Cámara:** plano general bajo y lento, con la nave dominando el encuadre; luego descenso suave hacia el astronauta.
- **Luz:** amanecer o atardecer, sol bajo, sombras largas; cielo con nubes y polvo.
- **Recurso pendiente:** la plataforma, la torre y los brazos no existen como modelos dedicados. Deben construirse con geometría 3D provisional coherente (cajas, cilindros, vigas, luces) y documentarse como recurso provisional.

### Escena B — Caminata y embarque

- **Acción:** el astronauta camina desde la plataforma hasta la compuerta.
- **Animación:** caminata procedural existente; no basta con deslizar el grupo.
- **Cámara:** seguimiento lateral y luego sobre el hombro al llegar a la compuerta.
- **Detalle:** la compuerta debe abrirse y cerrarse con animación visible.
- **Riesgo:** `boardPosition()` y `contains()` existen, pero la cinemática actual no los usa correctamente.

### Escena C — Cabina

- **Set:** interior de la nave, asientos, paneles, pantallas y luces de estado.
- **Acción:** el astronauta se sienta; las compuertas se cierran; los paneles se encienden en secuencia.
- **Cámara:** plano interior fijo, luego travelling mínimo hacia el panel frontal.
- **Animación:** usar `setSeated(true)`; no `setAction('sit')`, que no activa el asiento.
- **Luz:** cian de pantallas, ámbar de advertencias, poca luz ambiental.

### Escena D — Despegue

- **Acción:** ignición, vibración, separación de la plataforma y ascenso vertical real.
- **Efectos:** partículas de propulsor, polvo, destellos; la nave debe moverse en el espacio 3D, no solo la cámara.
- **Cámara:** contrapicado desde la plataforma, luego cámara de persecución.
- **Luz:** el motor ilumina la parte inferior del casco; el cielo cambia de azul a negro.
- **Nota:** el `TransportShip` actual es una nave de transporte horizontal; para el lanzamiento se puede usar una pose vertical provisional o una variante visual, siempre documentada.

### Escena E — Espacio y aproximación

- **Acción:** la Tierra se aleja; la nave se desplaza; EVA-07 aparece a lo lejos.
- **Cámara:** plano amplio con la Tierra en el tercio inferior y la estación creciendo.
- **Luz:** sol duro, sombras negras, rebote azul de la Tierra.
- **Detalle:** la estación debe verse como una estructura reconocible, no como una caja genérica.

### Escena F — Acoplamiento

- **Acción:** alineación, aproximación lenta, contacto y transición.
- **Cámara:** plano exterior de la compuerta, luego interior de EVA-07.
- **Detalle:** el acoplamiento debe terminar con el jugador dentro de la estación y el HUD restaurado.
- **Nota:** `Station` no expone un método `onDock()` **[V]**; la secuencia no puede depender de él sin implementarlo o sustituirlo por una transición propia.

### Ritmo propuesto **[P]**

| Escena | Duración orientativa |
|---|---|
| A. Plataforma | 6-8 s |
| B. Caminata y embarque | 8-10 s |
| C. Cabina | 6-8 s |
| D. Despegue | 8-10 s |
| E. Espacio | 8-10 s |
| F. Acoplamiento | 6-8 s |

La duración total razonable está entre **45 y 60 segundos**, con opción de omitir en cualquier momento.

---

## 5. Interiores

### Hábitat EVA-07

- Modelos GLB: `habitat.glb`, `door.glb`; colisiones en `colliders.json` **[V]**.
- Iluminación por capas: los módulos interiores viven en la capa 1 para que el sol no atraviese paredes **[V]**.
- Compuertas animadas, pantallas y esclusa con presión **[V]**.

**Criterios visuales:**

- Suelo y paredes con paneles modulares, juntas y tornillería visible.
- Luces de techo frías y tiras de acento cian en consolas.
- Zonas de peligro con ámbar; zonas seguras con verde.
- La esclusa debe leerse como un espacio físico con dos compuertas, no como un fundido.

### Cabina de la nave

- Asientos, arneses, paneles inclinados y pantallas.
- Paleta coherente con el HUD: cian para datos, ámbar para advertencias.
- Evitar interiores vacíos o cajas sin detalle.

---

## 6. Exteriores

### Estación EVA-07

- Módulos cilíndricos y rectangulares, paneles solares, antenas, radiadores y luces de navegación.
- Blanco/gris industrial con acentos cian.
- Las brechas deben ser visibles como daño físico: bordes irregulares, chispas y fuga de aire.

### Luna

- Regolito gris, cráteres, rocas, sombras duras y cielo negro.
- Base Selene con módulos presurizados y rover.
- Polvo fino y huellas; evitar un aspecto de "arena de playa".

### Marte

- Terreno rojizo, cañón, montaña y polvo atmosférico.
- Puesto Ares con módulos, antena y equipos de minería.
- El hielo subsuperficial debe tener un contraste frío frente al suelo cálido.

---

## 7. Astronauta

El astronauta es un rig procedural, no un modelo externo **[V]**:

- cápsula física + malla construida con cápsulas, esferas y cilindros;
- traje blanco con textura procedural, detalles oscuros y visor azul oscuro;
- casco con visor, recorte y antena;
- mochila con tanques y mangueras;
- animaciones de caminata, EVA e idle generadas por código.

**Criterios:**

- Debe leerse a distancia: silueta clara, casco reconocible, mochila visible.
- El visor nunca debe ser un agujero negro plano; usar el material `visor` con emisión fría.
- En la cinemática, la caminata debe ser procedural y coherente con la velocidad; no deslizar el grupo.
- En EVA, la postura debe ser más relajada y flotante que en gravedad.

---

## 8. Nave de transporte

`TransportShip.js` define una nave de **11 m de largo**, casco principal, morro, quilla, patas, motores y detalles **[V]**.

**Criterios:**

- Función antes que forma: debe entenderse como nave de transporte con compuerta, cabina y bodega.
- Materiales blancos/grises con juntas oscuras y acentos cian.
- Motores con toberas metálicas y luz interior.
- En la cinemática, la nave debe ser el objeto protagonista, no un decorado.

**Recursos provisionales necesarios si se construye la secuencia:**

- plataforma de lanzamiento;
- torre de acceso y brazos de servicio;
- efectos de ignición y polvo;
- adaptador visual para el despegue vertical.

Deben documentarse como provisionales y no sustituir los modelos funcionales del juego.

---

## 9. Menús e interfaz

### Pantalla de entrada

- Fondo 3D con la estación y la Tierra **[V]**.
- Título SPACE-TECH con anillo orbital y arco ámbar **[V]**.
- Botón único `INICIAR OPERACIONES` **[V]**.
- Estética de centro de operaciones: oscuro, cian, tipografía técnica.

### Menú principal

- Rail lateral con marca, tagline y siete opciones **[V]**.
- Filas con icono, etiqueta y descripción **[V]**.
- Dos columnas en escritorio; una en pantallas pequeñas **[V]**.

### Menú de pausa

**Estado actual:** funcional, pero visualmente defectuoso **[V]**.

Defectos concretos:

- ancho efectivo de 480 px por la regla `.card.compact`;
- botones con `letter-spacing: 0.24em`, mayúsculas y texto que se parte;
- `<strong>` y `<span>` sin separación visual;
- barra de desplazamiento dentro de la tarjeta;
- jerarquía inexistente entre Continuar y las acciones secundarias.

**Objetivo de diseño:**

- tarjeta de 760-900 px en escritorio, adaptable;
- dos columnas equilibradas y una sola en móvil;
- Continuar como acción principal destacada;
- título del botón y descripción en dos niveles tipográficos claros;
- espaciado normal, sin palabras separadas letra por letra;
- barra de desplazamiento discreta;
- ocho botones funcionales.

### HUD

- Debe ser legible sobre fondos claros y oscuros.
- O₂, CO₂, RCS, integridad, filtros, cable, traje y navegación siempre visibles **[V]**.
- Avisos y guía con contraste suficiente; no tapar el centro de la acción.

---

## 10. Recursos visuales existentes

Capturas y referencias dentro del repositorio:

- `docs/capturas-menu/00-entrada-1920.png` — pantalla de entrada.
- `docs/capturas-menu/01-menu-sin-guardado-1920.png` — menú sin guardado.
- `docs/capturas-menu/02-menu-1366x768.png` — menú en 1366×768.
- `docs/capturas-menu/03-menu-1280x720.png` — menú en 1280×720.
- `docs/capturas-menu/04-menu-1024x600.png` — menú en 1024×600.
- `docs/capturas-menu/05-pausa-1920.png` — menú de pausa actual.
- `docs/capturas-menu/06-menu-con-guardado-1920.png` — menú con partida guardada.
- `docs/capturas-arte/` — iteraciones visuales de la base lunar.
- `docs/benchmarks/` — capturas comparativas de rendimiento.

Estas capturas son evidencia del estado visual; no deben presentarse como evidencia de la cinemática.

---

## 11. Recursos pendientes de crear

| Recurso | Uso | Prioridad |
|---|---|---|
| Plataforma de lanzamiento | Escena A | Alta |
| Torre de acceso y brazos | Escenas A-B | Alta |
| Efecto de ignición y polvo | Escena D | Alta |
| Cielo atmosférico de despegue | Escena D | Media |
| Adaptador de despegue vertical | Escena D | Media |
| Puerto de acoplamiento visible | Escena F | Media |
| Animación de compuerta de la nave | Escenas B-C | Alta |
| Animación de asiento/arnés | Escena C | Media |
| Botón OMITIR y estilo asociado | Toda la cinemática | Alta |

---

## 12. Reglas de coherencia

1. **No usar imágenes estáticas** para simular una cinemática 3D.
2. **No crear un segundo renderer ni un segundo `Game`.**
3. **Reutilizar** `Player`, `TransportShip`, `Station`, `Environment`, `Materials` y `PostFX`.
4. **Mantener la paleta** cian/ámbar y la tipografía técnica.
5. **Documentar** cualquier geometría provisional y su motivo.
6. **No sustituir** modelos funcionales del juego por sustitutos de la cinemática.
7. **Priorizar legibilidad** sobre complejidad: una escena clara vale más que diez efectos.
8. **Validar visualmente** cada escena en el navegador antes de declararla terminada.

---

**Nota:** este documento no modifica el juego. Describe la dirección artística existente y la que debe guiar la cinemática y el menú de pausa.
