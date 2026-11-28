const { BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { finalFen } = require('./position');

let win = null;

// Los canales IPC son del proceso, no de la ventana: se registran una sola vez.
let ipcReady = false;
function setupIpc() {
  if (ipcReady) return;
  ipcReady = true;
  ipcMain.handle('carousel:position', async (_e, text) => {
    try {
      return { ok: true, fen: finalFen(text) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('carousel:save', async (e, files) => {
    // Datos del renderer: se valida todo antes de abrir el selector para no dejar archivos a medias.
    const valid = Array.isArray(files) && files.length > 0 && files.length <= 8 &&
      files.every((f) => f && /^carrusel-[1-8]\.png$/.test(f.name) && f.data instanceof ArrayBuffer && f.data.byteLength > 0) &&
      new Set(files.map((f) => f.name)).size === files.length;
    if (!valid) return { ok: false, error: 'Las imágenes no son válidas. Vuelve a exportar.' };
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'Carpeta para las imágenes', properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
    const dir = filePaths[0];
    const written = [];
    try {
      for (const f of files) {
        const file = path.join(dir, f.name);
        await fs.writeFile(file, Buffer.from(f.data));
        written.push(file);
      }
      return { ok: true, dir };
    } catch {
      await Promise.all(written.map((file) => fs.unlink(file).catch(() => {})));
      return { ok: false, error: 'No se pudieron guardar las imágenes en esa carpeta. Elige otra.' };
    }
  });
}

function open() {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  setupIpc();

  win = new BrowserWindow({
    width: 1200, height: 860, minWidth: 900, minHeight: 640,
    backgroundColor: '#0a0a0b', title: 'Chedex · Carrusel', icon: path.join(__dirname, '..', '..', '..', 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}

module.exports = { open };
