// Datos que muestra el launcher. Sin funciones: se envían tal cual a la interfaz.
module.exports = {
  id: 'carousel',
  name: 'Carrusel',
  tagline: 'Cinco diapositivas para Instagram, sin diseñar.',
  description:
    'Escribe el texto de cada diapositiva, añade una frase destacada, una posición o una foto ' +
    'y exporta las 5 imágenes del carrusel con el estilo de Chedex.',
  features: [
    '5 imágenes PNG de 1080×1440',
    'Estructura de carrusel con una pista en cada diapositiva',
    'Frase destacada y colores de Chedex',
    'Tablero desde FEN o PGN y foto opcional',
  ],
  shortcuts: [],
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="7" y="3" width="10" height="14" rx="2"/><path d="M4 6v8M20 6v8" opacity=".5"/><path d="M9 21h6" stroke="#ee7b30"/></svg>',
  preview:
    '<svg viewBox="0 0 120 160" width="225" height="300" aria-hidden="true" font-family="DM Sans, sans-serif">' +
    '<rect x="4" y="10" width="20" height="140" rx="5" fill="#060607" stroke="#22252b" opacity=".6"/>' +
    '<rect x="96" y="10" width="20" height="140" rx="5" fill="#060607" stroke="#22252b" opacity=".6"/>' +
    '<rect x="15" y="4" width="90" height="120" rx="7" fill="#060607" stroke="#22252b"/>' +
    '<text x="60" y="40" text-anchor="middle" font-size="11" font-weight="800" fill="#f2f1ec">El error</text>' +
    '<text x="60" y="54" text-anchor="middle" font-size="11" font-weight="800" fill="#f2f1ec">que todos</text>' +
    '<text x="60" y="74" text-anchor="middle" font-size="12" font-style="italic" font-family="Georgia, serif" fill="#e11d2e">cometen</text>' +
    '<path d="M38 79q11 -3 22 0t22 -1" stroke="#e11d2e" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<text x="60" y="116" text-anchor="middle" font-size="5" font-weight="700" fill="#f2f1ec">chedex<tspan fill="#ee7b30">.app</tspan></text>' +
    '<g fill="#454c58"><circle cx="48" cy="140" r="2.5" fill="#ee7b30"/><circle cx="54" cy="140" r="2.5"/><circle cx="60" cy="140" r="2.5"/><circle cx="66" cy="140" r="2.5"/><circle cx="72" cy="140" r="2.5"/></g>' +
    '</svg>',
};
