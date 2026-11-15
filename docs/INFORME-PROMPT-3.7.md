# SPACE-TECH · Informe de entrega del Prompt 3.7

**Proyecto:** SPACE-TECH — simulador interactivo de misiones espaciales  
**Base técnica:** Three.js r170, ES Modules, cannon-es, modelos y simulación existentes  
**Fecha de cierre:** 13 de noviembre de 2026  
**Estado:** implementado y verificado con `npm run check` y `npm run smoke` sin fallos

---

## 1. Resumen

Se ha añadido una capa educativa y de presentación completa sobre el simulador existente, sin reconstruirlo, sin cambiar el motor ni añadir planetas nuevos:

- pantalla de entrada propia;
- menú principal de siete opciones con función real;
- manual de usuario independiente y contextual;
- menú de pausa de ocho opciones;
- Academia SPACE-TECH de diez lecciones con progreso;
- Centro de Datos Científicos con fuentes auditables;
- catálogo y auditoría de las 20 misiones existentes;
- mesa de diseño de misiones de seis fases basada en el proceso NASA y en los cuatro segmentos;
- resultados de misión con aprendizaje, decisiones, consecuencias y conceptos;
- perfil gráfico estándar único, sin selectores de calidad visibles.

No se ha eliminado ninguna misión ni se ha invalidado ningún guardado anterior. El guardado sube a la versión 3 y migra automáticamente los datos v1/v2.

---

## 2. Pantalla de entrada

**Archivos:** `public/index.html`, `public/css/styles.css`, `public/js/core/Game.js`, `public/js/ui/HUD.js`

Diseño:

- fondo 3D con la estación orbital, la Tierra lejana, estrellas y luz ambiental ya existentes;
- cámara orbital suave sobre el menú, sin cinemática de lanzamiento;
- título **SPACE-TECH**;
- subtítulo **SIMULADOR INTERACTIVO DE MISIONES ESPACIALES**;
- un único botón **ENTRAR**;
- aviso de independencia respecto a NASA;
- sin logotipo de NASA y sin imágenes de NASA.

Comportamiento:

- el estado inicial del juego es `entry`;
- **ENTRAR** pasa a `menu`;
- la partida no empieza hasta elegir una acción del menú;
- `Enter` también entra al menú desde la pantalla de entrada.

---

## 3. Menú principal

**Archivo:** `public/index.html` y manejadores en `public/js/core/Game.js`

| Opción | Función real |
|---|---|
| **NUEVA PARTIDA** | Borra el guardado anterior, inicia una partida guiada dentro de la estación y **no activa ninguna misión**. |
| **CONTINUAR PARTIDA** | Carga la última partida guardada; se oculta si no hay guardado. |
| **DISEÑAR UNA MISIÓN** | Abre la mesa de diseño de seis fases; puede implementar una misión real. |
| **ACADEMIA SPACE-TECH** | Abre las diez lecciones con actividad y progreso persistente. |
| **CENTRO DE DATOS CIENTÍFICOS** | Abre fuentes, datos, catálogo de misiones y créditos. |
| **MANUAL DE USUARIO** | Abre el manual independiente con controles reales y ayuda por zona. |
| **CONFIGURACIÓN** | Ajusta dificultad y sensibilidad del ratón. No hay selector de calidad. |

La nueva partida concede un kit inicial mínimo (metales 40, electrónica 20, industrial 30) para que la mesa de diseño pueda implementarse sin obligar a recolectar antes de empezar.

---

## 4. Manual de usuario

**Archivo nuevo:** `public/js/ui/UserManual.js`  
**Acceso:** menú principal, pausa y tecla `H` durante la partida.

Secciones:

1. Primeros pasos.
2. Movimiento.
3. Interacciones.
4. Exploración EVA.
5. Vehículos.
6. Misiones.
7. Diseño de misiones.
8. Controles reales.
9. Información de zona (contextual).

Información contextual disponible para:

- Hangar · nave y carga útil.
- Ingeniería · potencia y propulsión.
- Generación eléctrica.
- Laboratorio · instrumentos y datos.
- Puente · órbitas y control de misión.
- Operaciones · comunicaciones.
- Luna · gravedad y regolito.
- Marte · terreno y geología.
- Estación orbital EVA-07.

### Controles documentados (comprobados en `Controls.js`)

| Acción | Teclado / ratón | Mando | Ámbito |
|---|---|---|---|
| Moverse | `W` `A` `S` `D` o flechas | Stick izquierdo | Interior, superficie y EVA |
| Mirar | Ratón | Stick derecho | Siempre |
| Zoom de cámara | Rueda | — | Siempre |
| Subir / saltar | `Espacio` | `RT` | EVA y superficie |
| Bajar | `Ctrl` o `C` | `LT` | EVA |
| Empuje máximo | `Shift` | `L3` | EVA |
| Interactuar | `E` | `X` | Puertas, consolas, esclusa, nave y rover |
| Reparar / escanear | Clic izquierdo | `A` | Exterior |
| Herramientas | `1` soldador · `2` llave · `3` escáner | — | Exterior |
| Pausa / cerrar panel | `Esc` | — | Siempre |
| Información de zona | `H` | — | Durante la partida |
| Colliders de depuración | `F3` | — | Durante la partida |

### Controles no asignados (declarados como tales)

- Guardado rápido: no existe tecla; se guarda desde la pausa o por autoguardado.
- Consultar objetivos: no hay tecla dedicada; se usa **Pausa → Objetivos**.
- Linterna o visión nocturna: no existe en esta versión.
- Cambiar calidad gráfica: no existe selector; el perfil es único.

No se documenta ningún control que no exista realmente.

---

## 5. Pausa

**Archivos:** `public/index.html`, `public/css/styles.css`, `public/js/core/Game.js`

`Esc` abre la pausa. El mundo queda detenido y no hay movimiento mientras está abierta.

Opciones:

1. **CONTINUAR** — vuelve a la partida.
2. **MANUAL Y CONTROLES** — abre el manual sin perder el estado.
3. **OBJETIVOS** — muestra la misión activa y su progreso.
4. **DISEÑO DE MISIÓN** — abre la mesa de diseño.
5. **ACADEMIA SPACE-TECH** — abre las lecciones.
6. **CONFIGURACIÓN** — dificultad y sensibilidad.
7. **GUARDAR PARTIDA** — guarda el estado actual.
8. **SALIR AL MENÚ PRINCIPAL** — guarda y vuelve al menú.

Reglas aplicadas:

- sólo puede haber una ventana educativa abierta a la vez;
- cerrar una ventana devuelve a la pausa, no a la partida;
- abrir el manual desde la pausa no altera la posición ni el estado del jugador;
- `Esc` cierra primero la ventana abierta y después la pausa.

---

## 6. Academia SPACE-TECH

**Archivos nuevos:** `public/js/core/Academy.js`, `public/js/ui/AcademyUI.js`

Diez lecciones:

1. Sistema solar y cuerpos celestes.
2. Cómo funciona una nave espacial.
3. Instrumentos científicos.
4. Gravedad y órbitas.
5. Energía y comunicaciones.
6. Diseño de misiones.
7. Vehículos de lanzamiento.
8. Operaciones espaciales.
9. Centro de control terrestre.
10. Análisis científico de datos.

Cada lección incluye:

- explicación breve;
- ilustración SVG propia;
- datos científicos con unidad y fuente;
- actividad interactiva;
- reto o pregunta;
- respuesta explicada;
- dificultad progresiva.

Modos:

- **Principiante**;
- **Avanzado**.

El progreso se guarda en el guardado del juego (`academy`) y sobrevive a nueva partida, recarga y cierre del navegador.

---

## 7. Centro de Datos Científicos

**Archivos nuevos:** `public/js/core/ScienceData.js`, `public/js/ui/DataCenterUI.js`

Pestañas:

- datos científicos;
- fuentes;
- catálogo de misiones;
- auditoría;
- créditos y aviso legal.

Cada dato real declara:

- valor;
- unidad;
- tipo (`official`, `thirdParty`, `gameParameter` o `simulation`);
- fuente;
- URL;
- fecha de acceso (`2026-11-13`);
- descripción;
- crédito u organización.

No hay consultas externas por frame ni en tiempo de ejecución: todas las fuentes están embebidas como datos estáticos.

### Aviso exacto incluido

> SPACE-TECH es un proyecto educativo independiente. No está patrocinado, aprobado ni respaldado por NASA ni por ninguna de las organizaciones citadas.

Además se indica que la NASA no respalda entidades no gubernamentales por el mero hecho de utilizar sus recursos.

---

## 8. Catálogo y auditoría de misiones

**Archivo nuevo:** `public/js/core/MissionCatalog.js`

Las 20 misiones existentes se clasifican en ocho fases:

- diseño de misión;
- preparación y verificación;
- lanzamiento;
- operaciones espaciales;
- comunicaciones terrestres;
- investigación científica;
- exploración planetaria;
- reparación y mantenimiento.

Resultado de la auditoría:

| Recomendación | Cantidad | Misiones |
|---|---:|---|
| **Conservar** | 13 | `leak_repair`, `solar_repair`, `antenna_repair`, `engineering_power`, `life_support`, `lab_analysis`, `moon_landing`, `moon_ice`, `moon_build`, `mars_mountain`, `mars_cave`, `mars_mining`, `mars_equipment` |
| **Transformar** | 2 | `navigation_survey` (selección de destino y ventana orbital), `mars_geology` (cadena medir → comparar → transmitir) |
| **Convertir en secundaria** | 5 | `component_swap`, `module_inspection`, `tool_recovery`, `mars_outpost`, `mars_antenna` |
| **Propuesta de retirada** | 0 | — |

Solapamientos detectados:

- `component_swap` y `tool_recovery` comparten el bucle de recogida;
- `module_inspection` repite las rondas de mantenimiento generadas;
- `moon_build` y `mars_outpost` usan la misma mecánica de construcción;
- `antenna_repair` y `mars_antenna` repiten la lección de comunicaciones;
- `moon_ice`, `mars_mining` y `mars_geology` comparten ciencia de campo.

**No se ha borrado, renombrado ni modificado ninguna misión.** El catálogo es una capa de análisis y UI; el progreso guardado sigue viviendo en `MissionManager`.

---

## 9. Campaña de diseño de misiones

**Archivos nuevos:** `public/js/core/MissionDesign.js`, `public/js/ui/MissionDesignUI.js`

### Seis fases

1. Identificar la necesidad.
2. Definir el concepto.
3. Establecer los requisitos.
4. Diseñar.
5. Construir y verificar.
6. Implementar.

### Cuatro segmentos interrelacionados

- **Launch Segment**: lanzador, integración y servicios.
- **Space Segment**: nave, instrumentos, orbitador, aterrizador o rover.
- **Ground Segment**: estaciones de tierra, recepción y control.
- **User Segment**: equipo científico que interpreta los datos.

Cambiar un segmento afecta a los demás: el lanzador condiciona la masa; la estación de tierra condiciona el enlace; los instrumentos condicionan datos y potencia.

### Verificación e implementación

- La verificación comprueba objetivo, concepto, compatibilidad con destino, instrumentos, lanzador, masa, potencia, coste, datos, enlace y comparación de alternativas.
- Un diseño no verificado no se implementa.
- Un diseño verificado:
  - consume combustible, integridad y recursos reales del simulador;
  - añade una misión al `MissionManager` existente;
  - puede ejecutarse como una misión normal;
  - genera un informe educativo.

### Referencias incorporadas

- **NASA Design and Develop Science Missions**: proceso de seis fases y cuatro segmentos.
- **GMAT**: referencia conceptual de navegación y análisis orbital; **no** se integra ni se afirma calcular trayectorias con él.
- **JPL CML 1-4**: marco educativo de madurez; **no** es una certificación oficial.
- **NASA Mission Design Lab**: modalidades Concept Development, Trade Studies y Point Design.
- **Mission VIZ**: idea de visualización de misiones.
- **Build It Yourself: Satellite**: inspiración para construir una arquitectura con piezas.
- **CubeSat 101 (2017)**: referencia educativa histórica; no se presenta como normativa vigente.
- **Space Apps VR**: idea de visualización inmersiva.
- **CSA**: identificada como Agencia Espacial Canadiense, no como NASA.

---

## 10. Flujo de aprendizaje y resultados

1. La persona entra y elige **NUEVA PARTIDA**.
2. La partida comienza con una guía breve y sin misión automática.
3. Explora la estación y abre una consola con `E`.
4. Acepta una misión real.
5. Puede consultar el manual con `H` o desde la pausa.
6. Puede aprender en la Academia y volver a la partida sin perder estado.
7. Puede diseñar una misión y verla convertirse en misión ejecutable.
8. Al completar una misión, el resultado muestra:
   - qué se ha aprendido;
   - qué decisiones se tomaron;
   - qué consecuencias tuvieron;
   - qué conceptos se aplicaron;
   - qué se puede mejorar.
9. Después vuelve a la exploración libre: **no se reinicia la partida** y las misiones únicas no se repiten.

---

## 11. Rendimiento

Perfil único **Estándar**:

- `pixelRatio` 1.0;
- sombras de 1024;
- bloom suave;
- SMAA;
- anisotropía 8;
- 2000 estrellas;
- luces puntuales;
- presupuesto de 7 luces en interior;
- ambiente 0.3.

Medición secuencial en el mismo equipo (Intel UHD Graphics 620, 1280×800, Chrome headless, perfil estándar):

| Vista | Antes (Prompt 3.7, balanced) | Después (estándar) | Draw calls | Triángulos |
|---|---:|---:|---:|---:|
| Exterior | 22,9 FPS | **36,1 FPS** | 239 | 24.853 |
| Interior | 7,3 FPS | **20,7 FPS** | 256 | 34.613 |

Lectura honesta:

- la mejora medida es clara, pero el interior sigue por debajo de 60 FPS en esta GPU integrada;
- las cifras son de un equipo concreto y de una ejecución headless, no una garantía universal;
- el perfil estándar no elimina el coste de la escena: sólo evita selectores y mantiene una configuración única.

Archivos de medición:

- `docs/benchmarks/p37-before-exterior.json`
- `docs/benchmarks/p37-before-interior.json`
- `docs/benchmarks/p37-after-exterior.json`
- `docs/benchmarks/p37-after-interior.json`

---

## 12. Archivos nuevos y modificados

### Nuevos

- `public/js/engine/Quality.js` (perfil estándar único; reescrito)
- `public/js/core/ScienceData.js`
- `public/js/core/MissionCatalog.js`
- `public/js/core/Academy.js`
- `public/js/core/MissionDesign.js`
- `public/js/ui/UserManual.js`
- `public/js/ui/AcademyUI.js`
- `public/js/ui/DataCenterUI.js`
- `public/js/ui/MissionDesignUI.js`
- `docs/INFORME-PROMPT-3.7.md`
- `docs/benchmarks/p37-after-exterior.json` / `.png`
- `docs/benchmarks/p37-after-interior.json` / `.png`

### Modificados

- `public/index.html` — entrada, menú, configuración, pausa, informe de misión, guía.
- `public/css/styles.css` — estilos de entrada, menú, overlays, Academia, datos, diseño y resultados.
- `public/js/core/Game.js` — estados `entry`/`menu`, menús, pausa, overlays, guardado, diseño, guía, resultados.
- `public/js/core/Missions.js` — `addMission`, `reset({ autoActivate })`.
- `public/js/core/Save.js` — versión 3 y migración de `design`, `academy`, `guided`.
- `public/js/ui/HUD.js` — pantallas `entry`/`menu`, guía, informe de misión.
- `public/js/engine/Interior.js` — presupuesto de luces del perfil estándar.
- `public/js/engine/Environment.js` — iluminación del perfil estándar.
- `scripts/smoke.mjs` — pruebas actualizadas y auditoría del Prompt 3.7.
- `scripts/bench.mjs` — flujo entrada → menú → nueva partida, sin presets de calidad.

---

## 13. Pruebas realizadas

### Validación estática

```text
npm run check
35/35 archivos válidos
```

### Smoke test

```text
npm run smoke
113 comprobaciones OK · 0 fallos
```

Cubre, entre otras:

- pantalla de entrada, título, subtítulo, botón y ausencia de logotipo;
- menú de siete opciones y CONTINUAR oculto sin guardado;
- manual desde menú y desde pausa, sin perder estado ni apilar ventanas;
- Academia con 10 lecciones y 2 modos;
- Centro de datos con pestañas, fuentes y aviso legal;
- mesa de diseño con 6 fases y 4 segmentos;
- nueva partida guiada sin misión automática;
- pausa con 8 opciones;
- objetivos desde la pausa;
- diseño verificado, CML 4 educativo e implementación como misión real;
- consumo de combustible y desactivación de la guía;
- guardado v3 con `design`, `academy` y `guided`;
- ausencia de consultas externas por frame;
- funcionamiento sin conexión;
- victoria, derrota y ausencia de errores de consola.

### Pruebas manuales / de integración

Se comprobaron además:

- los 17 módulos transitables;
- las 19 compuertas;
- las 13 consolas con acciones reales;
- el hangar con repostaje y reparación;
- la Luna y Marte con viaje, base, rover y misiones;
- la migración de guardados v2 a v3.

---

## 14. Errores pendientes y limitaciones declaradas

1. **Rendimiento en GPU integrada.** El interior mide 20,7 FPS en Intel UHD 620; no se alcanzan 60 FPS estables en ese hardware. No se oculta esta limitación.
2. **Diseño de misión simplificado.** La mesa usa parámetros del juego; no propaga trayectorias reales ni sustituye a GMAT.
3. **CML y Mission Design Lab son educativos.** No son certificaciones ni reproducen documentos oficiales.
4. **CubeSat 101 es de 2017.** Se cita como referencia histórica, no como normativa vigente.
5. **Catálogo sin retiradas.** No se propone retirar ninguna misión y no se ha borrado ninguna; las recomendaciones son advisory.
6. **Controles no asignados.** Guardado rápido, objetivos, linterna y cambio de calidad no tienen tecla y así se documenta.
7. **Dependencia de datos estáticos.** Las fuentes no se consultan en vivo; si cambian las URLs o los valores oficiales, hay que actualizar `ScienceData.js`.
8. **Medición headless.** Los benchmarks se tomaron en Chrome headless con la GPU indicada; otros equipos pueden variar.

---

## 15. Conclusión

El Prompt 3.7 queda implementado sobre la base existente, sin reconstruir el juego y sin romper el progreso guardado. La experiencia añade entrada, menú, pausa, manual, Academia, centro de datos, catálogo y diseño de misiones, y lo hace con funciones reales, datos citados y límites declarados.

La entrega no afirma que todo sea visual: las opciones del menú ejecutan acciones, el manual documenta controles comprobados, la Academia guarda progreso, el diseño verificado crea misiones reales y el simulador sigue funcionando sin conexión.
