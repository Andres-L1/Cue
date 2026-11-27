const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const tools = require('./src/tools');
const { setupUpdater } = require('./src/updater');

let launcherWin = null;

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
  win.loadFile(path.join(__dirname, 'src', 'launcher', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('tools:list', () => tools.list());
  ipcMain.handle('tools:launch', (_e, id) => tools.launch(String(id)));
  createLauncher();
  setupUpdater(() => launcherWin);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createLauncher(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
