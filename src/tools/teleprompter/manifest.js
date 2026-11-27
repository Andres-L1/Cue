// Datos que muestra el launcher. Sin funciones: se envían tal cual a la interfaz.
module.exports = {
  id: 'teleprompter',
  name: 'Teleprompter',
  tagline: 'Lee tu guion mirando a cámara.',
  description:
    'Pega tu guion y léelo en una ventana flotante que se queda encima de todo mientras grabas. ' +
    'El texto sube solo a tu ritmo y una línea naranja marca por dónde vas.',
  features: [
    'Siempre encima de las demás ventanas',
    'Velocidad y tamaño de letra a tu medida',
    'Pausa con un atajo, aunque estés en otra app',
    'Aviso de escritorio cuando el guion está listo',
  ],
  shortcuts: [
    { keys: ['Espacio'], label: 'Pausar / seguir' },
    { keys: ['↑', '↓'], label: 'Velocidad' },
    { keys: ['Ctrl', 'Mayús', 'T'], label: 'Pausa global' },
  ],
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<path d="M5 6h14M5 12h14M5 18h9" opacity=".5"/><path d="M3 12h2" stroke="#ee7b30"/></svg>',
  preview:
    '<div class="pv-tp"><p class="dim">Hola, soy tu guion</p><p>y sigo por donde vas.</p>' +
    '<span class="pv-line"></span><p class="dim">Siguiente línea</p></div>',
};
