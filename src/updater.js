const { app, ipcMain } = require('electron');

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
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (i) => send({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => send({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => console.warn('Updater:', e && e.message));

  ipcMain.on('update:install', () => autoUpdater.quitAndInstall());

  const check = () => autoUpdater.checkForUpdates().catch((e) => console.warn('Updater:', e.message));
  check();
  setInterval(check, CHECK_EVERY);
}

module.exports = { setupUpdater };
