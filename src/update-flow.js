// Estados de la actualización obligatoria. Sin `electron` para poder probarla con node.
function createUpdateFlow({ autoUpdater, send }) {
  let busy = false; // desde «Actualizar ahora» hasta un error

  const fail = (e) => {
    console.warn('Updater:', e && e.message);
    if (!busy) return; // sin red al comprobar: la app entra normal
    busy = false;
    send({ state: 'error' });
  };

  autoUpdater.on('update-available', (i) => { if (!busy) send({ state: 'available', version: i.version }); });
  autoUpdater.on('update-not-available', () => { if (!busy) send({ state: 'none' }); });
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
  autoUpdater.on('error', fail);

  return {
    async check() {
      try { await autoUpdater.checkForUpdates(); } catch (e) { fail(e); }
    },
    install() {
      if (busy) return;
      busy = true;
      send({ state: 'downloading', percent: 0 });
      autoUpdater.downloadUpdate().catch(fail);
    },
  };
}

module.exports = { createUpdateFlow };
