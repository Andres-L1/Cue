const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const tools = require('./src/tools');
const { setupUpdater } = require('./src/updater');
const { createAccess, SITE_URL } = require('./src/access');

let launcherWin = null;
let access = null;

function createLauncher() {
  const win = launcherWin = new BrowserWindow({
    width: 1080, height: 680, minWidth: 780, minHeight: 520,
    backgroundColor: '#0a0a0b', title: 'Chedex Launcher', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'launcher', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.on('focus', () => access && access.onFocus());
  win.loadFile(path.join(__dirname, 'src', 'launcher', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('tools:list', () => tools.list());
  access = createAccess({
    file: path.join(app.getPath('userData'), 'access.json'),
    safeStorage,
    send: (s) => { if (launcherWin && !launcherWin.isDestroyed()) launcherWin.webContents.send('access:status', s); },
  });
  // Sin acceso verificado no se abre ninguna herramienta.
  ipcMain.handle('tools:launch', (_e, id) => access.status().state === 'ok' && tools.launch(String(id)));
  ipcMain.handle('access:status', () => access.status());
  ipcMain.handle('access:link', (_e, code) => access.link(code));
  ipcMain.handle('access:unlink', () => access.unlink());
  ipcMain.handle('access:site', () => shell.openExternal(SITE_URL));
  createLauncher();
  access.init();
  setupUpdater(() => launcherWin);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createLauncher(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
