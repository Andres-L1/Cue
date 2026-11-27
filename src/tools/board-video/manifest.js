// Datos que muestra el launcher. Sin funciones: se envían tal cual a la interfaz.
let squares = '';
for (let r = 0; r < 8; r++) {
  for (let f = 0; f < 8; f++) {
    squares += `<rect x="${11 + f * 8.5}" y="${46 + r * 8.5}" width="8.5" height="8.5" fill="${(f + r) % 2 ? '#1f242d' : '#454c58'}"/>`;
  }
}

module.exports = {
  id: 'board-video',
  name: 'Tablero a vídeo',
  tagline: 'Tu partida, lista para Shorts, Reels y TikTok.',
  description:
    'Pega un PGN o un enlace de Lichess, elige el tramo y genera un clip vertical en MP4 ' +
    'con el tablero de Chedex, tu firma arriba y chedex.app abajo.',
  features: [
    'Vídeo vertical 1080×1920 en MP4',
    'Partida entera o de la jugada que elijas a otra',
    'Tu firma en la cabecera y en la tarjeta final',
    'Tres ritmos y tablero desde blancas o negras',
  ],
  shortcuts: [],
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="6" y="2" width="12" height="20" rx="2.5" opacity=".5"/><path d="M10 9.5v5l4-2.5z" stroke="#ee7b30"/></svg>',
  preview:
    '<svg viewBox="0 0 90 160" width="200" height="356" aria-hidden="true" font-family="DM Sans, sans-serif">' +
    '<rect x="1" y="1" width="88" height="158" rx="9" fill="#060607" stroke="#22252b"/>' +
    '<text x="45" y="26" text-anchor="middle" font-size="8" font-weight="800" fill="#f2f1ec">@tucanal</text>' +
    '<text x="45" y="35" text-anchor="middle" font-size="4.5" fill="#9a9ca3">Blancas (1800) – Negras (1750)</text>' +
    '<rect x="8" y="43" width="74" height="74" rx="3" fill="#2a303a" stroke="#4a525e"/>' + squares +
    '<path d="M49 101.5V80" stroke="#ffc36b" stroke-width="2.4" stroke-linecap="round"/><path d="M45 82l4-6 4 6z" fill="#ffc36b"/>' +
    '<text x="45" y="148" text-anchor="middle" font-size="7" font-weight="700" fill="#f2f1ec">chedex<tspan fill="#ee7b30">.app</tspan></text>' +
    '</svg>',
};
