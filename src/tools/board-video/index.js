const { BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { parsePgn, fetchLichessPgn, fetchStudyPgn } = require('./pgn');
const { gameIdFromLink, studyFromLink } = require('./renderer/logic');

let win = null;

// Los canales IPC son del proceso, no de la ventana: se registran una sola vez.
let ipcReady = false;
function setupIpc() {
  if (ipcReady) return;
  ipcReady = true;
  ipcMain.handle('board-video:load', async (_e, req) => {
    try {
      let text = String((req && req.text) || '');
      if (req && req.source === 'link') {
        const study = studyFromLink(text);
        if (study) {
          if (!study.chapterId) throw new Error('Abre un capítulo del estudio y copia su enlace (termina en /idCapítulo).');
          text = await fetchStudyPgn(study.studyId, study.chapterId);
        } else {
          const id = gameIdFromLink(text);
          if (!id) throw new Error('Ese enlace de Lichess no es válido.');
          text = await fetchLichessPgn(id);
        }
      }
      return { ok: true, game: parsePgn(text) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('board-video:save', async (e, buf) => {
    if (!(buf instanceof ArrayBuffer) || !buf.byteLength) return { ok: false, error: 'El vídeo está vacío.' };
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
      defaultPath: 'chedex-clip.mp4', filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
      await fs.writeFile(filePath, Buffer.from(buf));
      return { ok: true, path: filePath };
    } catch {
      return { ok: false, error: 'No se pudo guardar el vídeo en esa carpeta.' };
    }
  });
}

function open() {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  setupIpc();

  win = new BrowserWindow({
    width: 1120, height: 800, minWidth: 860, minHeight: 620,
    backgroundColor: '#0a0a0b', title: 'Chedex · Tablero a vídeo', icon: path.join(__dirname, '..', '..', '..', 'build', 'icon.png'), autoHideMenuBar: true,
    // Sin throttling: la grabación va en tiempo real y no debe frenarse en segundo plano.
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}

module.exports = { open };
