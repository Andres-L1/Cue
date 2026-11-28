const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cue', {
  position: (text) => ipcRenderer.invoke('carousel:position', text),
  save: (files) => ipcRenderer.invoke('carousel:save', files),
});
