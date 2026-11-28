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

Número variable de diapositivas, más tipografías o colores, plantillas, guardar proyectos, animación, edición de la foto más allá de recortarla para cubrir la diapositiva, firma del cliente.

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

## Para el implementador

- Registrar la herramienta en `src/tools/index.js` con su `manifest.js`, como `board-video`.
- Lógica pura (ajuste de texto, recorte cover, validación de posición) en `renderer/logic.js` con tests en `test/`, como el resto.
- Subir versión a 1.4.0 al publicar; actualizar la tarjeta de herramientas en `public/launcher.html` del repo Chedex y desplegar a mano.
