const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cue', {
  load: (req) => ipcRenderer.invoke('board-video:load', req),
  save: (buf) => ipcRenderer.invoke('board-video:save', buf),
});
