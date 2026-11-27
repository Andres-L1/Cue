# Tablero a vídeo · Plan de implementación

> **Para agentes:** superpowers:subagent-driven-development (recomendado) o executing-plans. Casillas `- [ ]`.

**Meta:** herramienta «Tablero a vídeo» del Launcher: PGN o enlace de Lichess → clip MP4 vertical 1080×1920 con tablero noche, piezas `contorno`, firma del cliente y `chedex.app`.

**Arquitectura:** el proceso principal analiza el PGN (`chess.js`) y descarga de Lichess; el renderer dibuja en un `<canvas>` y graba con `MediaRecorder` en MP4; la lógica pura (enlaces, rango, línea de tiempo) vive en `renderer/logic.js` y se prueba con `node`.

**Stack:** Electron 33, `chess.js` (nueva dependencia), canvas 2D, tests con `assert` en `test/logic.test.js` (`npm test`).

**Spec:** `docs/2026-11-27-tablero-video-design.md`

## Restricciones globales
- Aspecto fijo: tablero noche (casillas `#454c58` claras / `#1f242d` oscuras, marco `#2a303a`, borde `#4a525e`, esquinas redondeadas, última jugada `rgba(241,139,66,.4)`, flechas `#ffc36b`), piezas `contorno`, DM Sans (`src/shared/fonts`), acento `#ee7b30`. Abajo siempre el texto `chedex.app`.
- Cabecera del clip: firma del cliente (texto libre, guardada en `localStorage`) y nombres con rating del PGN en pequeño.
- Tarjeta final de 2 s con firma del cliente y `chedex.app`. Cada jugada dura 0,8 / 1,2 / 2 s (por defecto 1,2 s); deslizamiento de la pieza 300 ms; 0,6 s de pausa inicial con la posición de partida del tramo.
- Salida MP4: `video/mp4;codecs=avc1`, 30 fps, 6 Mb/s. Si `MediaRecorder.isTypeSupported` falla, mensaje claro y no grabar.
- CSP sin scripts inline. Textos en español. No tocar `src/access.js`, `src/updater.js`, `src/update-flow.js` ni los archivos del Perfil.
- Piezas: copiar los 12 SVG de `contorno` desde `https://github.com/Andres-L1/Repartos/tree/HEAD/web/public/pieces/contorno` a `src/tools/board-video/renderer/pieces/` y añadir `src/tools/board-video/renderer/pieces/LICENCIA.md` (GPL-3.0-or-later, material propio de Chedex, publicado en Repartos; el código de Cue sigue MIT).
- Commits y publicación solo con autorización del usuario.

## Review Focus (cada línea con su test en la tarea que la posee)
1. PGN vacío, ilegal o con jugadas imposibles → error legible, sin colgar (tarea 2).
2. Enlace de Lichess con sufijo de color, con 12 caracteres o con texto alrededor (tarea 1).
3. Rango invertido, fuera de partida, vacío o no numérico → partida entera (tarea 1).
4. Partida de 1 jugada o tramo de una sola jugada → clip válido de duración > 0 (tarea 1).
5. Lichess no responde, 404 o partida privada → mensaje, sin colgar (tarea 2).

---

### Tarea 1: Lógica pura

**Archivos:** crear `src/tools/board-video/renderer/logic.js`; modificar `test/logic.test.js` (copiar el estilo de exportación de `src/tools/teleprompter/renderer/logic.js`, que sirve en navegador y en `node`).

**Interfaces (produce):**
- `gameIdFromLink(text: string): string | null`
- `clampRange(totalPlies: number, fromMove: unknown, toMove: unknown): { startPly: number, endPly: number }` (jugadas de ficha 1-based; `startPly = (fromMove-1)*2`, `endPly = min(totalPlies, toMove*2)`; entradas inválidas → `{startPly:0, endPly:totalPlies}`)
- `durationOf(opts): number` y `frameAt(t: number, opts): { phase: 'hold'|'moves'|'outro', ply: number, progress: number }` con `opts = { startPly, endPly, perMove, holdSec: 0.6, slideSec: 0.3, outroSec: 2 }` (`ply` = posición mostrada tras esa jugada; `progress` 0..1 del deslizamiento de la jugada en curso).

- [ ] **Paso 1: tests que fallan.** `gameIdFromLink('https://lichess.org/AbCdEfGh')==='AbCdEfGh'`; con `/black` igual; `'https://lichess.org/AbCdEfGhIjKl'` → `'AbCdEfGh'`; `'mira esto https://lichess.org/AbCdEfGh!'` → `'AbCdEfGh'`; `'hola'` y `''` → `null`. `clampRange(40,3,5)` → `{startPly:4,endPly:10}`; `clampRange(40,5,3)`, `(40,'x',2)`, `(40,'','')`, `(40,0,3)` → `{0,40}`; `clampRange(40,3,999)` → `{4,40}`. `durationOf` con 1 jugada y `perMove=1.2` = 0,6+1,2+2 = 3,8. `frameAt(0)` → `phase:'hold'`; `frameAt(0.6+0.1)` → `phase:'moves'`, `ply=startPly+1`, `progress` ≈ 0.33; `frameAt(duration)` → `phase:'outro'`, `ply=endPly`.
- [ ] **Paso 2:** `npm test` falla con módulo no encontrado.
- [ ] **Paso 3:** implementar las tres funciones.
- [ ] **Paso 4:** `npm test` pasa.

### Tarea 2: Lectura del PGN y descarga (proceso principal)

**Archivos:** crear `src/tools/board-video/pgn.js`; modificar `test/logic.test.js`; `npm install chess.js` (dependencia, no dev).

**Interfaces (produce):**
- `parsePgn(text: string): { headers: { white, black, whiteElo, blackElo, result }, startFen: string, moves: Array<{ san, from, to, fen }> }` (lanza `Error` con mensaje en español si está vacío o es ilegal; `fen` es la posición tras la jugada).
- `fetchLichessPgn(id: string, fetchFn = fetch): Promise<string>` (lanza `Error` en español en 404, otros no-OK y fallo de red); GET `https://lichess.org/game/export/<id>` con `Accept: application/x-chess-pgn` y `User-Agent: chedex.app (Launcher)`.

- [ ] **Paso 1: tests que fallan.** Un PGN de 4 jugadas (`1. e4 e5 2. Nf3 Nc6`) → 4 jugadas con `from/to` correctos (`e2`→`e4`, …) y cabeceras; `''` y `'1. e4 e5 2. Ke4'` → lanza. `fetchLichessPgn('AbCdEfGh', fetchFalso)` con 404 → mensaje «Esa partida no existe o es privada.», con rechazo de red → «No se pudo conectar con Lichess.», con 200 → devuelve el texto.
- [ ] **Paso 2:** fallan. **Paso 3:** implementar. **Paso 4:** pasan.

### Tarea 3: Ventana, interfaz y grabación

**Archivos:** crear `src/tools/board-video/{manifest.js,index.js,preload.js}` y `renderer/{index.html,style.css,app.js}` con las piezas; modificar `src/tools/index.js` (registrar con el patrón de teleprompter).

**Interfaces:**
- Consume: `parsePgn`, `fetchLichessPgn` (IPC `board-video:load` con `{ source: 'pgn'|'link', text }` → `{ ok, game }` o `{ ok:false, error }`), `logic.js` del renderer.
- IPC `board-video:save` (`ArrayBuffer`, nombre sugerido `chedex-clip.mp4`) → `dialog.showSaveDialog` + escritura → `{ ok }`.
- `manifest.js`: `id: 'board-video'`, nombre «Tablero a vídeo», eslogan, descripción, features, icono y `preview` en el mismo formato que el de teleprompter (HTML propio con clases `pv-*` añadidas a `src/launcher/launcher.css` solo si hace falta una maqueta; si no, un tablero mínimo con SVG).

- [ ] **Paso 1:** ventana (`index.js`, `contextIsolation: true`, `backgroundThrottling: false`, mismo patrón que teleprompter); interfaz: caja de texto «PGN o enlace de Lichess», «Cargar», campos «Desde la jugada» / «Hasta la jugada», selector de ritmo, orientación (blancas/negras abajo), campo «Firma», vista previa del canvas, botón «Generar vídeo» con barra de progreso y aviso «No minimices la ventana mientras se graba».
- [ ] **Paso 2:** dibujo del canvas (1080×1920) con las restricciones globales; animar el deslizamiento con `frameAt`; dibujar flecha naranja de la jugada en curso.
- [ ] **Paso 3:** grabación con `canvas.captureStream(30)` + `MediaRecorder` en tiempo real, guardado por IPC.
- [ ] **Paso 4:** `npm test` (debe seguir pasando). **Verificación manual** con `npm start` (Electron está instalado): cargar un PGN, generar un clip, abrirlo en un reproductor, comprobar relación 9:16, duración y MP4.

## Autorrevisión
- Cobertura del spec: entrada PGN/enlace y rango (tareas 1–3), aspecto (restricciones globales y tarea 3), MP4 por `MediaRecorder` (tarea 3), licencia de piezas (restricciones globales), versión 1.3.0 (la sube el agente del Perfil).
- No verificado hasta la implementación: que el MP4 se abra en Instagram y TikTok y que muestre duración.
