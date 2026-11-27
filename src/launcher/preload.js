const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  list: () => ipcRenderer.invoke('tools:list'),
  launch: (id) => ipcRenderer.invoke('tools:launch', id),
});
