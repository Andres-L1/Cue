const { BrowserWindow, globalShortcut, Notification, ipcMain } = require('electron');
const path = require('path');

const SHORTCUT = 'CommandOrControl+Shift+T';
let win = null;

function applyOnTop(value) {
  win.setAlwaysOnTop(value, 'screen-saver'); // por encima incluso de apps a pantalla completa
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(value, { visibleOnFullScreen: true });
  win.webContents.send('on-top-changed', value);
}

// Los canales IPC son del proceso, no de la ventana: se registran una sola vez.
let ipcReady = false;
function setupIpc() {
  if (ipcReady) return;
  ipcReady = true;
  ipcMain.on('teleprompter:script-ready', () => {
    if (!Notification.isSupported()) return;
    new Notification({
      title: 'Teleprompter · Guion listo',
      body: 'Pulsa Espacio para empezar. Ctrl+Mayús+T pausa desde cualquier ventana.',
    }).show();
  });
  ipcMain.on('teleprompter:set-on-top', (_e, v) => { if (win) applyOnTop(Boolean(v)); });
  ipcMain.on('teleprompter:set-opacity', (_e, v) => {
    if (win) win.setOpacity(Math.min(1, Math.max(0.3, Number(v) || 1)));
  });
}

function open() {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  setupIpc();

  win = new BrowserWindow({
    width: 960, height: 680, minWidth: 520, minHeight: 420,
    backgroundColor: '#0a0a0b', title: 'Chedex · Teleprompter', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => applyOnTop(true));

  // El atajo global solo existe mientras el teleprompter está abierto.
  const ok = globalShortcut.register(SHORTCUT, () => {
    if (win && !win.isDestroyed()) win.webContents.send('toggle-pause');
  });
  if (!ok) console.warn(`No se pudo registrar ${SHORTCUT} (¿lo usa otra app?)`);

  win.on('closed', () => { globalShortcut.unregister(SHORTCUT); win = null; });
}

module.exports = { open };
