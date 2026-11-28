# Carrusel · diseño

Herramienta nueva del Launcher (`src/tools/carousel/`), junto a `teleprompter` y `board-video`. Genera 5 imágenes PNG de 1080×1440 (3:4) para un carrusel de Instagram con la estructura CTH y el estilo Chedex.

## Intención

Que un cliente de Chedex escriba el texto de un carrusel y obtenga las 5 imágenes listas para publicar, sin diseñar. La herramienta debe poder personalizarse cada vez más: el diseño de la v1 tiene que dejar sitio para añadir opciones sin reescribirla.

## Objetivos

- 5 diapositivas fijas con roles CTH: portada que crea ganas · slide 2 que las paga · cada slide abre la siguiente · un giro · un final que pide. Cada una muestra su rol como pista.
- Por diapositiva: texto principal, frase destacada (campo aparte), posición de ajedrez opcional, foto opcional.
- Dos tipografías: sans gruesa y apretada (texto principal) y serif cursiva (frase destacada).
- Cuatro colores: blanco, negro, rojo, naranja Chedex. Texto principal y frase destacada eligen color por separado.
- Pie `chedex.app` pequeño y centrado en todas las diapositivas.
- Vista previa en vivo con miniaturas de las 5.
- Salida: 5 PNG numerados (`carrusel-1.png`…) en la carpeta elegida por el usuario.

## No objetivos (v1)

~~Número variable de diapositivas~~ (hecho en 1.4.2: de 1 a 8), más tipografías o colores, plantillas, guardar proyectos, animación, edición de la foto más allá de recortarla para cubrir la diapositiva, firma del cliente.

## Antiobjetivos

Texto ilegible sobre una foto clara; texto que se sale de la diapositiva; imágenes que no midan exactamente 1080×1440.

## Enfoque

Una sola opción sensata: herramienta nueva que reutiliza el patrón de `board-video` (canvas en el renderer, piezas Chedex `contorno`, tablero «noche», `chess.js` para validar FEN/PGN) y exporta con `canvas.toBlob('image/png')`. El proceso principal solo abre el selector de carpeta y escribe los archivos. Descartado: HTML→imagen en servidor o con HyperFrames (añade dependencias y no mejora la calidad frente al canvas).

## Decisiones tomadas con el usuario

- Campo aparte para la frase destacada (sin marcas tipo `*texto*`).
- Colores de texto y frase independientes.
- Foto opcional por diapositiva.
- Pie `chedex.app` abajo, pequeño.

## Decisiones mías (revisables)

- Fuentes incluidas en el paquete: *Inter Tight* bold y *Playfair Display* italic (licencia OFL), cargadas con `FontFace` antes de dibujar.
- Fondo negro con viñeta; con foto, la foto cubre la diapositiva (recorte tipo cover) con un degradado oscuro bajo el texto para mantener la legibilidad.
- El texto reduce su cuerpo hasta caber, con un máximo de ~4 líneas; si no cabe, recorta con «…» como en `board-video`.
- Con tablero: texto arriba, tablero centrado debajo. El trazo rojo bajo la frase destacada solo cuando la frase es roja.
- Posición válida = FEN o PGN (última posición); si no es válida, se avisa en el campo y no se exporta esa diapositiva.

## Extensibilidad

Cada diapositiva es un objeto `{ role, text, textColor, accent, accentColor, position, photo }`. Un único `drawSlide(ctx, slide, theme)` puro dibuja todo desde ese objeto, y las opciones (colores, fuentes) viven en un `theme` con listas. Personalizar más = añadir campos al objeto y ramas al dibujo, sin tocar la estructura.

## 1.4.1 · Edición libre en la vista previa

- Texto, frase, foto y tablero se seleccionan, arrastran y redimensionan en la vista previa; el pie `chedex.app` es fijo.
- `slide.layout = { text, accent, photo, board }`: `null` = automático. Override: texto/frase `{x, y, w, scale}`, foto `{x, y, w, h}` (el recorte 3:4 de siempre, a escala), tablero `{x, y, size}`. Sin overrides, el PNG es idéntico al de 1.4.0.
- La maqueta automática no depende de los overrides: mover un elemento no desplaza a los demás.
- Límites: letra entre ×0,5 y ×3, anchos mínimos, y siempre quedan 60 px dentro de la diapositiva. El recuadro de selección se pinta después de copiar la miniatura: nunca llega a miniaturas ni al PNG.
- Teclado (canvas enfocado): flechas 4 px (Mayús 20 px), Supr/Retroceso devuelve el elemento a automático (no borra contenido), Esc suelta. «Restablecer diseño» devuelve toda la diapositiva a automático.
- Lógica pura (`hitTest`, `handlesOf`, `dragBox`) en `renderer/logic.js` con tests. Pendiente (1.4.2): guías, deshacer, rotación, orden de capas.

## 1.4.2 · Guías, deshacer, rotación y número de diapositivas

- **Guías con imán** al arrastrar o redimensionar: bordes y centro (caja envolvente) se pegan a menos de 8 px al centro de la diapositiva, a los márgenes (x 90/990, y 90/1320) y a bordes/centros de los demás elementos. Al redimensionar solo se ajusta el borde que se mueve, y solo sin giro. Líneas naranjas solo en la vista previa durante el gesto. Alt desactiva el imán; las flechas no lo usan.
- **Deshacer/rehacer** de la disposición (`slide.layout`), con historial propio en cada diapositiva (`slide.history = { undo, redo }`, 100 pasos). Un paso por gesto: arrastre, redimensión, giro, Supr, «Restablecer diseño» y cada racha de flechas sobre el mismo elemento (< 1 s entre pulsaciones). Ctrl/Cmd+Z, Ctrl/Cmd+Mayús+Z y Ctrl+Y fuera de los campos de texto (en ellos sigue el deshacer nativo), y botones «Deshacer»/«Rehacer». Quitar una foto no se deshace: borra su override también del historial.
- **Rotación** con el círculo sobre el recuadro (si quedaría fuera de la diapositiva, va debajo o dentro). `rot` en grados en el override, solo si no es 0; imán cada 15° a menos de 3° (Alt lo quita). Girado, el recuadro y los tiradores giran con él, el hit-test usa los ejes del elemento, el redimensionado proyecta el puntero a esos ejes con la esquina o el lado opuesto fijo, y los 60 px mínimos se miden sobre la caja envolvente. El trazo rojo gira con la frase; el degradado de legibilidad cubre la caja envolvente. Sin giro el PNG es idéntico al de 1.4.1.
- **De 1 a 8 diapositivas** (antes un no objetivo). Arranca con las 5 de la estructura CTH. «Añadir» crea una vacía al final; «Quitar» elimina la activa, con un diálogo propio salvo que esté vacía. El rol y la pista van con la posición (`roleOf`/`hintOf`); de la 6 en adelante, «Diapositiva N» (pestaña «Extra»). Se exportan `carrusel-1.png` … `carrusel-N.png`; el proceso principal acepta de 1 a 8 con nombres `carrusel-[1-8].png`.
- Lógica pura nueva en `renderer/logic.js` con tests: `bounds`, `angleAt`, `snapAngle`, `snapDrag`, `history`/`record`/`undo`/`redo`, `roleOf`, `hintOf`, `isBlank`. Fuera de alcance: orden de capas, selección múltiple.

## Para el implementador

- Registrar la herramienta en `src/tools/index.js` con su `manifest.js`, como `board-video`.
- Lógica pura (ajuste de texto, recorte cover, validación de posición) en `renderer/logic.js` con tests en `test/`, como el resto.
- Subir versión a 1.4.0 al publicar; actualizar la tarjeta de herramientas en `public/launcher.html` del repo Chedex y desplegar a mano.
