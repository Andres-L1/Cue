# Notas para desarrolladores

App de escritorio hecha con Electron.

```bash
npm install
npm start      # abrir en modo desarrollo
npm test       # pruebas
npm run dist   # instalador para tu sistema, en la carpeta dist/
```

## Estructura

- `main.js`: ventana del launcher.
- `src/launcher/`: pantalla del launcher (lista a la izquierda, presentación a la derecha).
- `src/tools/`: una carpeta por herramienta, registradas en `src/tools/index.js`.
- `src/updater.js`: actualizaciones automáticas.
- `src/shared/`: logo, fuentes y estilos comunes.

## Añadir una herramienta

1. Crea `src/tools/<id>/manifest.js` (nombre, descripción, funciones, atajos, icono, maqueta) e `index.js` que exporte `open()`.
2. Regístrala en `src/tools/index.js`. Aparece sola en el launcher.

## Instaladores y versiones

GitHub Actions (`.github/workflows/release.yml`) compila Windows, Mac y Linux:

- Al subir a la rama de trabajo, o al lanzarlo a mano desde la pestaña Actions: deja los instaladores como archivos descargables de esa ejecución.
- Al subir una etiqueta `v*`: además los publica en Releases.

Para publicar una versión nueva: sube `version` en `package.json`, y luego `git tag v1.0.1 && git push origin v1.0.1`.

## Actualizaciones automáticas

La app instalada busca versiones en las Releases de GitHub al abrirse y cada 4 horas, las descarga sola y avisa en el launcher.

- El repositorio debe ser público.
- Se actualizan solos Windows y Linux (`.AppImage`). El `.deb` no.
- En Mac exige app firmada y notarizada; los instaladores aún no van firmados, y Windows/macOS muestran un aviso la primera vez.
