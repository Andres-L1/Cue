# Chedex Launcher

Launcher de escritorio (Electron) con herramientas para creadores de contenido.
Las herramientas salen a la izquierda; al elegir una se muestra su presentación y el botón **Iniciar**.

```bash
npm install
npm start
```

## Herramientas

- **Teleprompter**: ventana flotante siempre encima, con línea de lectura.
  Pega tu guion, pulsa **Preparar guion** (aviso "Guion listo") y luego **Empezar**.

## Añadir una herramienta

1. Crea `src/tools/<id>/manifest.js` (nombre, descripción, funciones, atajos, icono, maqueta) e `index.js` que exporte `open()`.
2. Regístrala en `src/tools/index.js`.

Aparece sola en el launcher.

## Atajos del teleprompter

| Tecla | Acción |
|---|---|
| Espacio / clic | Pausar y seguir |
| ↑ / ↓ | Subir / bajar velocidad |
| Ctrl+Mayús+T | Pausar y seguir desde cualquier ventana (global, activo mientras el teleprompter está abierto) |
| Esc | Volver al editor |

Se abre en su propia ventana; empieza siempre encima; el botón "Siempre encima" la suelta o la fija. La opacidad se ajusta en la barra superior (aparece al pasar el ratón o en pausa).

## Tests

```bash
npm test
```
