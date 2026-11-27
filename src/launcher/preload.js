const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  list: () => ipcRenderer.invoke('tools:list'),
  launch: (id) => ipcRenderer.invoke('tools:launch', id),
  version: () => ipcRenderer.invoke('app:version'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, s) => cb(s)),
  installUpdate: () => ipcRenderer.send('update:install'),
  access: {
    status: () => ipcRenderer.invoke('access:status'),
    link: (code) => ipcRenderer.invoke('access:link', code),
    unlink: () => ipcRenderer.invoke('access:unlink'),
    openSite: () => ipcRenderer.invoke('access:site'),
    onChange: (cb) => ipcRenderer.on('access:status', (_e, s) => cb(s)),
  },
});
