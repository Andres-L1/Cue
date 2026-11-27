# Cue · Teleprompter flotante

Teleprompter de escritorio (Electron) que flota encima de las demás ventanas mientras grabas.

## Uso

```bash
npm install
npm start
```

1. Pega tu guion y pulsa **Preparar guion** (sale una notificación "Guion listo").
2. Pulsa **Empezar** o la barra espaciadora.

## Atajos

| Tecla | Acción |
|---|---|
| Espacio / clic | Pausar y seguir |
| ↑ / ↓ | Subir / bajar velocidad |
| Ctrl+Mayús+T | Pausar y seguir desde cualquier ventana (global) |
| Esc | Volver al editor |

La ventana empieza siempre encima; el botón "Siempre encima" la suelta o la fija. La opacidad se ajusta en la barra superior (aparece al pasar el ratón o en pausa).

## Tests

```bash
npm test
```
