const { app, ipcMain } = require('electron');
const { createUpdateFlow } = require('./update-flow');

const CHECK_EVERY = 4 * 60 * 60 * 1000;

// Actualizaciones automáticas desde las releases de GitHub (solo en la app instalada).
function setupUpdater(getWindow) {
  const send = (payload) => {
    const w = getWindow();
    if (w && !w.isDestroyed()) w.webContents.send('update:status', payload);
  };

  ipcMain.handle('app:version', () => app.getVersion());
  if (!app.isPackaged) return; // en desarrollo no hay nada que actualizar

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false; // se descarga al pulsar «Actualizar ahora»
  autoUpdater.autoInstallOnAppQuit = true;

  const flow = createUpdateFlow({ autoUpdater, send });
  ipcMain.on('update:install', () => flow.install());

  // Comprobar cuando la ventana ya escucha `update:status`; si no, la capa no llegaría a mostrarse.
  const w = getWindow();
  if (w && w.webContents.isLoading()) w.webContents.once('did-finish-load', () => flow.check());
  else flow.check();
  setInterval(() => flow.check(), CHECK_EVERY);
}

module.exports = { setupUpdater };
