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

GitHub Actions (`.github/workflows/release.yml`) compila Windows, Mac y Linux cada vez que se sube algo a `main`
(y también se puede lanzar a mano desde la pestaña Actions). Los instaladores quedan como archivos descargables de esa ejecución.

**Publicar una versión nueva:** sube `version` en `package.json` (por ejemplo `1.0.1`) y sube el cambio a `main`.
Si esa versión aún no tiene Release, se crea sola con la etiqueta `v1.0.1` y los instaladores adjuntos. Si ya existe, no se toca.

## Actualizaciones automáticas

La app instalada busca versiones en las Releases de GitHub al abrirse y cada 4 horas, las descarga sola y avisa en el launcher.

- El repositorio debe ser público.
- Se actualizan solos Windows y Linux (`.AppImage`). El `.deb` no.
- En Mac exige app firmada y notarizada; los instaladores aún no van firmados, y Windows/macOS muestran un aviso la primera vez.

## Nombres de los archivos

Los instaladores tienen nombre fijo (sin versión) para que los enlaces del README, del tipo `releases/latest/download/<archivo>`, no cambien nunca:
`Chedex-Launcher-Windows.exe`, `Chedex-Launcher-Mac-arm64.dmg`, `Chedex-Launcher-Mac-x64.dmg`, `Chedex-Launcher-Linux.AppImage`, `Chedex-Launcher-Linux.deb`.
Los enlaces solo funcionan cuando existe al menos una Release publicada. Si cambias algún nombre en `package.json`, actualiza el README.
