// Registro de herramientas del launcher.
// Para añadir una: crea src/tools/<id>/ con manifest.js e index.js ({ open }) y regístrala aquí.
const tools = [
  { manifest: require('./teleprompter/manifest'), open: require('./teleprompter').open },
];

module.exports = {
  list: () => tools.map((t) => t.manifest),
  launch: (id) => {
    const t = tools.find((x) => x.manifest.id === id);
    if (!t) return false;
    t.open();
    return true;
  },
};
