# Herramienta «Tablero a vídeo» · Diseño (pendiente de aprobación, 2026-11-27)

## Intención
Los clientes de Chedex son creadores de contenido y marca personal. Esta herramienta del Launcher convierte una partida de ajedrez en un clip vertical (9:16) con la identidad de Chedex y la marca del cliente, listo para Shorts, Reels o TikTok. Ahorra el trabajo repetido de montar el tablero a mano y refuerza el valor de ser cliente (solo funciona con acceso válido).

## Objetivos / no objetivos
- Sí: entrada por PGN pegado o enlace de Lichess; tramo elegido por el cliente (partida entera o de la jugada X a la Y); exportar MP4.
- No (versión 1): sonido o música, barra de evaluación, comentarios, GIF, varias partidas a la vez, analizar la partida.
- Antiobjetivo: un clip que no se parezca a Chedex, o que no se abra en las redes.

## Aspecto (decidido por el usuario)
- Piezas **`contorno`** y tablero **noche** del proyecto Repartos (Chedex Pulse). Noche: casillas `#454c58` / `#1f242d`, marco `#2a303a` con borde `#4a525e`, esquinas redondeadas, última jugada `rgb(241 139 66 / 0.4)`, flechas `#ffc36b`.
- Abajo siempre **`chedex.app`** (en vez del logotipo).
- Arriba la **firma del cliente** (texto libre, recordado entre sesiones). Mi propuesta: nombres y rating de los jugadores de la cabecera del PGN, en pequeño.
- Tipografía DM Sans (ya en `src/shared/fonts`), acento naranja `#ee7b30` del Launcher.
- Termina con una tarjeta final de 2 s con ambas marcas (firma del cliente y `chedex.app`). Decisión mía.

## Enfoques (el usuario eligió el 1)
1. **Canvas + `MediaRecorder` de Electron** (elegido). Comprobado el 2026-11-27 en Electron 33 / Chromium 130: `video/mp4;codecs=avc1` está soportado y graba MP4 H.264 (`ftypisom`).
2. Fotogramas + ffmpeg incluido: descartado, suma mucho peso al instalador.
3. Herramienta web: descartada, tiene que vivir en el Launcher.

## Diseño técnico
- Carpeta `src/tools/board-video/` con el patrón existente: `manifest.js`, `index.js` (`open`), `preload.js`, `renderer/{index.html, style.css, app.js, logic.js}`; se registra en `src/tools/index.js`. Id `board-video`, nombre «Tablero a vídeo».
- **Proceso principal** (sin dependencias en el renderer): lee el PGN con `chess.js` (dependencia nueva, licencia BSD-2) y devuelve `{ headers, moves: [{ san, from, to, fen }] }`; descarga de Lichess `https://lichess.org/game/export/<id>` con `Accept: application/x-chess-pgn` y el User-Agent `chedex.app (Launcher)`; guarda el MP4 con `dialog.showSaveDialog`.
- **Renderer**: dibuja el lienzo de 1080×1920 con piezas SVG precargadas, anima el deslizamiento de la pieza (~300 ms) y cada jugada dura 0,8 / 1,2 / 2 s a elegir (por defecto 1,2 s). Graba con `canvas.captureStream(30)` + `MediaRecorder` (MP4; 6 Mb/s) y vuelca el blob al guardar.
- **`renderer/logic.js`** (puro, con tests en `test/logic.test.js`): extraer el id de partida de un enlace de Lichess (8 caracteres, con o sin sufijo de color), validar y recortar el tramo X–Y, y calcular qué jugada y qué progreso de animación corresponden a un instante `t`.
- Las piezas `contorno` (12 SVG) se copian a `src/tools/board-video/renderer/pieces/`.
- Acceso: reutiliza `tools:launch`, que ya exige acceso válido.

## Pendiente del constructor
Pantalla de la herramienta (campo PGN/enlace, rango, orientación, firma, botón «Generar»), tamaños y tipografías finos, mensajes de error, nombre del archivo por defecto.

## Riesgos
- **Licencia:** las piezas `contorno` son GPL-3.0-or-later (material propio de Repartos) y Cue es MIT. Como autor puedes licenciarlas aparte; hay que dejar una nota en el repo. A decidir por el usuario.
- La grabación va **en tiempo real** (un clip de 30 s tarda 30 s) y se degrada si la ventana se minimiza: se desactiva el throttling y se avisa de no minimizar.
- El MP4 de `MediaRecorder` puede ser fragmentado y sin duración en los metadatos; algunos editores o redes podrían tratarlo mal. **No verificado**: probar en Instagram y TikTok antes de anunciarlo.
- La interfaz solo se puede probar a mano (Electron ya está instalado en el PC de desarrollo).

## Versión
Va en la 1.3.0 junto con el apartado Perfil.
