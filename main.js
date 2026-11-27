const { app, BrowserWindow, globalShortcut, ipcMain, Notification } = require('electron');
const path = require('path');

const SHORTCUT = 'CommandOrControl+Shift+T';
let win;
let onTop = true;

function applyOnTop(value) {
  onTop = value;
  // 'screen-saver' lo mantiene por encima incluso de apps a pantalla completa.
  win.setAlwaysOnTop(onTop, 'screen-saver');
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(onTop, { visibleOnFullScreen: true });
  win.webContents.send('on-top-changed', onTop);
}

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 520,
    minHeight: 420,
    backgroundColor: '#0a0a0b',
    title: 'Cue',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => applyOnTop(true));
}

app.whenReady().then(() => {
  createWindow();

  const ok = globalShortcut.register(SHORTCUT, () => {
    if (win && !win.isDestroyed()) win.webContents.send('toggle-pause');
  });
  if (!ok) console.warn(`No se pudo registrar el atajo global ${SHORTCUT} (¿lo usa otra app?)`);

  ipcMain.on('script-ready', () => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Cue · Guion listo',
        body: 'Pulsa Espacio para empezar. Ctrl+Mayús+T pausa desde cualquier ventana.',
        silent: false,
      }).show();
    }
  });
  ipcMain.on('set-on-top', (_e, value) => applyOnTop(Boolean(value)));
  ipcMain.on('set-opacity', (_e, value) => {
    const v = Math.min(1, Math.max(0.3, Number(value) || 1));
    win.setOpacity(v);
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
