# Actualización obligatoria al abrir · Plan de implementación

> **Para agentes:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Pasos con casillas `- [ ]`.

**Meta:** al abrir (y cada 4 h) el Launcher detecta versión nueva, bloquea el uso con un solo botón «Actualizar ahora», descarga con progreso y reinicia solo.

**Arquitectura:** lógica de estados pura en `src/update-flow.js` (sin importar `electron`, para poder probarla con `node`); `src/updater.js` solo la conecta a `electron-updater`; la UI es una capa a pantalla completa que reutiliza `.gate`.

**Stack:** Electron 33, electron-updater 6.8, tests con `assert` en `test/logic.test.js` (`npm test`).

**Spec:** `docs/2026-11-27-actualizacion-obligatoria-design.md`

## Restricciones globales
- Sin botón «más tarde». Si falla la descarga o la instalación, la app vuelve a ser usable.
- Un fallo de comprobación (sin red) nunca muestra la capa: la app entra normal.
- CSP existente: sin scripts inline; estilos solo en `launcher.css`.
- Textos en español. No tocar `src/access.js` ni el control de acceso.
- Commits solo con autorización del usuario; publicar (push → release) también.

## Review Focus (cada línea tiene su test en la tarea 1)
1. Falla la descarga o `quitAndInstall` (`error` estando ocupado) → estado `error`, app usable.
2. Sin red al comprobar → no se envía `available` ni `error`.
3. Doble clic en «Actualizar ahora» → `downloadUpdate` se llama una sola vez.
4. Comprobación de 4 h mientras descarga → se ignora el `update-available` duplicado.
5. Un `update-not-available` posterior a un `error` oculta la capa (`none`).

---

### Tarea 1: Lógica de estados de actualización

**Archivos:**
- Crear: `src/update-flow.js`
- Modificar: `test/logic.test.js` (añadir bloque antes del `console.log('logic OK')`)

**Interfaces:**
- Produce: `createUpdateFlow({ autoUpdater, send }) → { check(): Promise<void>, install(): void }` exportada con `module.exports = { createUpdateFlow }`.
- `send` recibe uno de: `{ state: 'available', version }`, `{ state: 'downloading', percent }`, `{ state: 'error' }`, `{ state: 'none' }`.
- `autoUpdater` es un `EventEmitter` con `checkForUpdates()`, `downloadUpdate()` (ambos devuelven promesa) y `quitAndInstall()`.

- [ ] **Paso 1: tests que fallan** en `test/logic.test.js`, con un `autoUpdater` falso (`EventEmitter` + contadores) y `send` que acumula estados. Tests, cada uno con una instancia nueva:
  - `update-available` con `{version:'1.2.0'}` → `send` recibe `{state:'available', version:'1.2.0'}`.
  - `install()` → `downloadUpdate` llamado 1 vez y se envía `{state:'downloading', percent:0}`; `download-progress` `{percent:41.6}` → `{state:'downloading', percent:42}`; `update-downloaded` → `quitAndInstall` llamado 1 vez.
  - Review 3: `install(); install();` → `downloadUpdate` llamado 1 vez.
  - Review 4: tras `install()`, otro `update-available` no envía `available`.
  - Review 1: tras `install()`, `emit('error', new Error('x'))` → último estado `{state:'error'}`; después `install()` vuelve a llamar a `downloadUpdate` (reintento posible).
  - Review 1 bis: `downloadUpdate` rechaza → `{state:'error'}`.
  - Review 2: `checkForUpdates` rechaza o emite `error` sin haber pulsado instalar → `send` no recibe nada.
  - Review 5: `update-not-available` → `{state:'none'}`.
- [ ] **Paso 2:** `npm test` → falla con «Cannot find module '../src/update-flow'».
- [ ] **Paso 3:** implementar `createUpdateFlow` en `src/update-flow.js`: bandera interna `busy` (true desde `install()` hasta `error`); `error` y rechazo de `downloadUpdate` ponen `busy=false` y envían `error` solo si estaba ocupado; fuera de `busy` los errores se registran con `console.warn` y no se envían.
- [ ] **Paso 4:** `npm test` → imprime `logic OK` sin errores.
- [ ] **Paso 5: Commit** (con autorización): `git add src/update-flow.js test/logic.test.js`.

### Tarea 2: Conectar el updater y la capa de UI

**Archivos:**
- Modificar: `src/updater.js` (usar `createUpdateFlow`; `autoUpdater.autoDownload = false`; `ipcMain.on('update:install', () => flow.install())`; comprobar al abrir y cada `CHECK_EVERY` con `flow.check()`; mantener `app:version` y el `return` si `!app.isPackaged`).
- Modificar: `src/launcher/index.html` (quitar el bloque `#update`; añadir `<section id="upgate" class="gate" hidden>` con logo, `<p class="eyebrow"><i></i>Actualización</p>`, `<h2 id="upTitle">`, `<p id="upText" class="desc">`, `<button id="updBtn" class="btn" type="button">Actualizar ahora</button>`).
- Modificar: `src/launcher/launcher.css` (quitar `.update`, `.updbtn` y la regla `.update:not([hidden]) + .foot`; añadir `#upgate { z-index: 20; }` y `#upgate[hidden] { display: none; }`).
- Modificar: `src/launcher/launcher.js` (sustituir el bloque `onUpdate`).
- `src/launcher/preload.js` no cambia (`onUpdate`, `installUpdate` ya existen).

**Interfaces:**
- Consume: los estados de `send` de la tarea 1 por el canal existente `update:status`.

- [ ] **Paso 1:** en `launcher.js`, `window.launcher.onUpdate(s)`: `available` → capa visible, título «Hay una versión nueva (v{version})», botón activo; `downloading` → botón oculto, texto «Descargando… {percent}%»; `error` → capa oculta y mensaje breve en el pie («No se pudo actualizar. Se reintentará más tarde.») para no atrapar al cliente; `none` → capa oculta. El botón envía `installUpdate()`.
- [ ] **Paso 2:** `npm test` → `logic OK` (la UI no tiene test automático).
- [ ] **Paso 3: verificación manual** (Electron no está instalado en este PC; hacerlo en un equipo con la app instalada tras publicar): con 1.1.0 instalada y 1.2.0 publicada, abrir → capa → botón → progreso → reinicio en 1.2.0. Cortar la red a mitad → vuelve la app usable.
- [ ] **Paso 4: Commit** (con autorización).

### Tarea 3: Versión 1.2.0

**Archivos:** `package.json` y `package-lock.json` (campo `version`, raíz y `packages[""]`).

- [ ] **Paso 1:** subir `version` a `1.2.0` en ambos.
- [ ] **Paso 2:** `npm test` → `logic OK`.
- [ ] **Paso 3: Publicar** (push a `main` crea el Release `v1.2.0` por `release.yml`): solo con autorización explícita del usuario. La web ya está desplegada, así que no hay orden previo que respetar.

## Autorrevisión
- Cobertura del spec: puntos 1–5 en tareas 1–2, punto 6 en tarea 3 (el test de estados es la tarea 1).
- Riesgos del spec sin resolver aquí: firma de macOS (si no está firmada, `quitAndInstall` falla y la app vuelve a ser usable por el estado `error`) y las instalaciones 1.1.0, que no reciben la capa hasta tener 1.2.0.
