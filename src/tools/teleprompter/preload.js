const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cue', {
  scriptReady: () => ipcRenderer.send('teleprompter:script-ready'),
  setOnTop: (v) => ipcRenderer.send('teleprompter:set-on-top', v),
  setOpacity: (v) => ipcRenderer.send('teleprompter:set-opacity', v),
  onTogglePause: (cb) => ipcRenderer.on('toggle-pause', () => cb()),
  onOnTopChanged: (cb) => ipcRenderer.on('on-top-changed', (_e, v) => cb(v)),
});
