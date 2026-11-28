# Carrusel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Herramienta «Carrusel» del Launcher: 5 diapositivas CTH de 1080×1440 con texto, frase destacada, tablero y foto opcionales, exportadas como 5 PNG.

**Architecture:** Nueva carpeta `src/tools/carousel/` con el mismo patrón que `board-video` (manifest + index con IPC + preload + renderer en canvas). Cada diapositiva es un objeto; un único `drawSlide(ctx, slide, theme)` lo dibuja. Lógica pura en `renderer/logic.js` (testeable con `node test/logic.test.js`); validación de posiciones con `chess.js` en el proceso principal.

**Tech Stack:** Electron 33, canvas 2D, `chess.js` ^1.4.0, fuentes woff2 locales (Inter Tight 700, Playfair Display italic 400, OFL).

**Spec:** `docs/2026-11-28-carrusel-design.md`

## Global Constraints

- Imagen exacta de 1080×1440 px, PNG, nombres `carrusel-1.png` … `carrusel-5.png`.
- Exactamente 5 diapositivas con roles, en este orden: «Portada que crea ganas», «Slide 2 que las paga», «Cada slide abre la siguiente», «Un giro», «Un final que pide».
- Colores permitidos y solo estos: blanco `#f2f1ec`, negro `#0a0a0b`, rojo `#e11d2e`, naranja Chedex `#ee7b30`.
- Dos tipografías: texto principal `"Inter Tight"` 700; frase destacada `"Playfair Display"` italic. Pie `chedex.app` pequeño y centrado en todas las diapositivas.
- Texto en español. CSP del renderer como en `board-video` (`default-src 'self'`): sin recursos remotos.
- No tocar versiones de dependencias. Versión del paquete al publicar: 1.4.0 (solo raíz y `packages[""]` del lock). No publicar sin que el usuario diga «publica».
- Ficheros fuente con CRLF: conservar los finales de línea al editar los existentes.

## Review Focus

- Texto principal o frase muy largos (300+ caracteres, una palabra sin espacios de 60 letras): debe encogerse y recortar con «…», nunca salirse de la imagen.
- Texto negro sobre fondo negro (o foto oscura): permitido por el usuario, pero el degradado de legibilidad debe aplicarse solo con foto y no ocultar la elección.
- Foto con proporción extrema o muy pequeña (panorámica, 50×50): recorte «cover» sin deformar ni dejar huecos.
- Posición inválida o PGN con jugadas imposibles: aviso en el campo y esa diapositiva no se exporta (las demás sí se pueden ver).
- Carpeta de destino sin permisos o cancelar el selector: mensaje claro, sin archivos a medias.
- Archivo que no es imagen elegido como foto: se rechaza con aviso.

---

### Task 1: Lógica pura del carrusel

**Files:**
- Create: `src/tools/carousel/renderer/logic.js`
- Create: `src/tools/carousel/position.js`
- Modify: `test/logic.test.js` (añadir al final)

**Interfaces:**
- Produces (`renderer/logic.js`, UMD como `board-video/renderer/logic.js`, global `CarouselLogic`):
  - `ROLES: string[5]` con los títulos de los roles; `HINTS: string[5]` con una pista corta de cada uno.
  - `COLORS: { white, black, red, orange }` con los hex de Global Constraints.
  - `fitText(str: string, measure: (s: string, size: number) => number, width: number, sizes: Array<[size: number, maxLines: number]>) => { size: number, lines: string[] }` — prueba tamaños de mayor a menor; el último tamaño recorta con «…» si no cabe; una palabra más ancha que `width` se parte por caracteres.
  - `coverRect(imgW: number, imgH: number, w: number, h: number) => { sx, sy, sw, sh }` — recorte centrado que cubre `w×h` sin deformar.
  - `fileName(i: number) => string` (`i` 0-based → `carrusel-<i+1>.png`).
  - `isImageFile(name: string, type: string) => boolean` — acepta `image/png|jpeg|webp`.
- Produces (`position.js`, solo proceso principal): `finalFen(text: string) => string` — acepta FEN o PGN (devuelve la FEN de la última posición); lanza `Error` con mensaje en español si no es válido; texto vacío lanza.

- [ ] **Step 1: Tests que fallan** en `test/logic.test.js`: `fitText('hola mundo', (s,z)=>s.length*z/2, 200, [[40,2],[30,2]])` devuelve `size 40`, 1 línea; texto de 400 caracteres con un solo tamaño y 3 líneas máx. devuelve 3 líneas, la última termina en `…`; palabra de 80 letras se parte y ninguna línea supera `width`; `coverRect(2000,1000,1080,1440)` → `sh===1000` y `sw/sh===1080/1440`, centrado; `coverRect(100,100,1080,1440)` sigue cubriendo (misma proporción); `fileName(0)==='carrusel-1.png'`; `isImageFile('a.gif','image/gif')===false`, `isImageFile('a.png','image/png')===true`; `finalFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')` devuelve esa FEN; `finalFen('1. e4 e5')` devuelve la FEN tras 1…e5; `finalFen('zzz')` y `finalFen('')` lanzan; `ROLES.length===5`, `HINTS.length===5`.
- [ ] **Step 2: Ejecutar** `node test/logic.test.js` → falla por módulos inexistentes.
- [ ] **Step 3: Implementar** los dos archivos con las firmas de arriba. `finalFen`: intenta `new Chess(text.trim())` y, si falla, `loadPgn` (como `parsePgn` en `board-video/pgn.js`, que normaliza espacios raros: reutilizar `parsePgn(text)` y devolver `moves[last].fen`, o `startFen` si no hay jugadas no es válido).
- [ ] **Step 4: Ejecutar** `npm test` → todo pasa.
- [ ] **Step 5: Commit** `git add src/tools/carousel test/logic.test.js && git commit -m "Carrusel: lógica pura y validación de posiciones"`

### Task 2: Esqueleto de la herramienta, fuentes e IPC

**Files:**
- Create: `src/tools/carousel/manifest.js`, `index.js`, `preload.js`
- Create: `src/tools/carousel/renderer/fonts/inter-tight-700.woff2`, `playfair-display-italic-400.woff2`, `LICENCIA.md` (OFL de ambas)
- Modify: `src/tools/index.js:5` (registrar la herramienta)

**Interfaces:**
- Consumes: `finalFen` (Task 1).
- Produces:
  - `manifest` con `id: 'carousel'`, `name: 'Carrusel'`, `tagline`, `description`, `features` (4), `shortcuts: []`, `icon`, `preview` (SVG) — misma forma que `board-video/manifest.js`.
  - IPC `carousel:position` (`text: string`) → `{ ok: true, fen } | { ok: false, error }`.
  - IPC `carousel:save` (`files: Array<{ name: string, data: ArrayBuffer }>`) → `{ ok: true, dir } | { ok: false, canceled?: true, error? }`: abre `dialog.showOpenDialog` (`openDirectory`, `createDirectory`), valida cada `name` con la regex `^carrusel-[1-5]\.png$` y `data` no vacío, y escribe los archivos. Cualquier fallo de escritura devuelve error claro.
  - `window.cue` en el renderer: `{ position(text), save(files) }`.
  - `open()` abre ventana 1200×860 con título `Chedex · Carrusel`, como `board-video/index.js`.

- [ ] **Step 1: Test que falla** en `test/logic.test.js`: `require('../src/tools/index.js')` no puede cargarse sin Electron; en su lugar comprobar que `require('../src/tools/carousel/manifest')` tiene `id==='carousel'`, `features.length===4` y que `preview` y `icon` empiezan por `<svg`.
- [ ] **Step 2: Ejecutar** `npm test` → falla.
- [ ] **Step 3: Implementar** manifest, index, preload y registrar en `src/tools/index.js` (segunda línea tras `board-video`). Fuentes: obtener los woff2 latin de los paquetes `@fontsource/inter-tight` (peso 700) y `@fontsource/playfair-display` (italic 400) con `npm pack` en una carpeta temporal, copiar solo los dos archivos y su licencia; no añadir las dependencias a `package.json`.
- [ ] **Step 4: Ejecutar** `npm test` → pasa; `npm start` abre el Launcher y muestra la tarjeta «Carrusel».
- [ ] **Step 5: Commit** `git commit -m "Carrusel: herramienta registrada, fuentes e IPC"`

### Task 3: Interfaz, dibujo de diapositivas y exportación

**Files:**
- Create: `src/tools/carousel/renderer/index.html`, `style.css`, `app.js`
- Modify: `src/tools/carousel/preload.js` si falta algo

**Interfaces:**
- Consumes: `CarouselLogic` (`ROLES`, `HINTS`, `COLORS`, `fitText`, `coverRect`, `fileName`, `isImageFile`), `window.cue.position`, `window.cue.save`. Piezas desde `../../board-video/renderer/pieces/<wP|…>.svg`.
- Produces: `drawSlide(ctx, slide, theme)` en `app.js` con `slide = { text, textColor, accent, accentColor, position, photo }` (`position`: FEN ya validada o `''`; `photo`: `HTMLImageElement|null`) y `theme = { fonts, colors }`. Dibuja siempre sobre 1080×1440.

- [ ] **Step 1: HTML/CSS**: panel izquierdo con 5 pestañas (rol + pista), campos *Texto principal*, selector de color, *Frase destacada*, selector de color, *Posición (FEN o PGN, opcional)* con aviso de error en el campo, botón *Foto* (+ quitar) y botón *Exportar 5 imágenes*. Panel derecho: canvas de la diapositiva activa y una tira de 5 miniaturas clicables. Estilo como `board-video/renderer/style.css`; los 4 colores como botones redondos.
- [ ] **Step 2: `drawSlide`**: fondo negro con viñeta suave; si hay foto, `coverRect` + degradado oscuro bajo el texto; texto principal y frase con `fitText` (medida con `ctx.measureText`, tamaños `[[88,4],[76,4],[64,4],[52,4]]` para el principal, `[[96,2],[80,2],[64,2]]` para la frase), centrados, en tipografías de Global Constraints; trazo rojo irregular bajo la frase solo si `accentColor` es rojo; tablero «noche» centrado debajo del texto con las piezas Chedex (mismos colores que `board-video`, tamaño 760 px, orientación blancas abajo); pie `chedex.app` 28 px centrado a y=1380.
- [ ] **Step 3: Estado y eventos**: array de 5 slides; cada cambio vuelve a dibujar el canvas y la miniatura; esperar `document.fonts.load` de las dos fuentes antes del primer dibujo; la posición se valida con `cue.position` (con retardo de 300 ms al escribir) y guarda `slide.position` solo si es válida; la foto se lee con `FileReader` tras comprobar `isImageFile` y se decodifica con `Image.decode()`.
- [ ] **Step 4: Exportar**: renderizar cada slide en un canvas oculto de 1080×1440, `toBlob('image/png')` → `arrayBuffer`, enviar `[{name: fileName(i), data}]` a `cue.save`. Si alguna posición escrita es inválida, no exportar y señalar la diapositiva. Mostrar «Guardadas en <carpeta>» o el error.
- [ ] **Step 5: Verificación manual con captura**: `npm start`, abrir Carrusel, rellenar las 5 (una con foto, una con tablero, una con texto de 400 caracteres), exportar y comprobar que salen 5 PNG de 1080×1440 (`node -e` leyendo el ancho/alto del encabezado PNG) y que ninguna se sale del marco.
- [ ] **Step 6: Commit** `git commit -m "Carrusel: editor, dibujo de diapositivas y exportación PNG"`

### Task 4: Versión 1.4.0 y página web (esperar el «publica»)

**Files:**
- Modify: `package.json` y `package-lock.json` (versión 1.4.0, solo raíz y `packages[""]`)
- Modify (repo Chedex): `public/launcher.html` — nueva tarjeta «03 / DISPONIBLE · Carrusel», renumerar «04 / PRÓXIMAMENTE» y «05 / ACCESO»

- [ ] **Step 1: Preparar los cambios** sin hacer push ni desplegar; ejecutar `npm test`.
- [ ] **Step 2: Pedir al usuario el «publica»** indicando lo no verificado (Mac/Linux, Instagram con las imágenes reales).
- [ ] **Step 3: Con el «publica»**: commit y push a `main` en Cue (el release se genera solo), esperar `latest.yml` con `version: 1.4.0`; en Chedex, commit de `launcher.html` y `npm run deploy` manual.
