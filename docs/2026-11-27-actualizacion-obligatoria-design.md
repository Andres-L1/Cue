# Actualización obligatoria al abrir (diseño corto, aprobado 2026-11-27)

## Intención
Que todos los clientes usen siempre la última versión del Launcher, sin pasos manuales: abrir → aviso → actualizar → reinicio.

## Objetivos / no objetivos
- Sí: comprobar al abrir; pantalla bloqueante con un solo botón; descarga con progreso; reinicio automático.
- No: «más tarde», canal beta, notas de versión, cambios en el control de acceso.
- Antiobjetivo: dejar atrapado al cliente si falla la descarga.

## Enfoques
1. Ampliar `src/updater.js` y la UI actual (elegido): ya usa electron-updater, eventos `update:status` y `update:install`.
2. Reescribir con otro mecanismo: descartado, no aporta nada.

## Diseño
1. Al abrir, `checkForUpdates()`. Sin versión nueva: la app entra normal.
2. Con versión nueva: pantalla que bloquea el uso («Hay una versión nueva (vX)»), un solo botón «Actualizar ahora». Decisión de diseño: sin «más tarde».
3. Al pulsar: progreso, descarga y `quitAndInstall()` (reinicio con la versión nueva).
4. Si falla la comprobación o la descarga: aviso y se puede usar la app.
5. Se mantiene la comprobación cada 4 h con la app abierta.
6. Test de la lógica de estados. Publicar = subir versión a 1.2.0 (`package.json` y `package-lock.json`).

## Riesgos no verificados
- macOS exige app firmada para auto-actualizar; no se ha comprobado.
- Las instalaciones 1.1.0 no tienen la pantalla hasta recibir 1.2.0.

## Fuera de esta pieza
Herramienta «tablero a vídeo» (canvas + MediaRecorder, con prueba previa de MP4): diseño aparte.
