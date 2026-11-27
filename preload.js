const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cue', {
  scriptReady: () => ipcRenderer.send('script-ready'),
  setOnTop: (v) => ipcRenderer.send('set-on-top', v),
  setOpacity: (v) => ipcRenderer.send('set-opacity', v),
  onTogglePause: (cb) => ipcRenderer.on('toggle-pause', () => cb()),
  onOnTopChanged: (cb) => ipcRenderer.on('on-top-changed', (_e, v) => cb(v)),
});
