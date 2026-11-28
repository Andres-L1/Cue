// Validación de la posición de una diapositiva. Solo en el proceso principal.
const { Chess } = require('chess.js');
const { parsePgn } = require('../board-video/pgn');

// FEN o PGN → FEN de la última posición. Lanza un Error en español si no es válido.
function finalFen(text) {
  const src = String(text || '').trim();
  if (!src) throw new Error('Escribe una FEN o un PGN.');
  try { return new Chess(src).fen(); } catch { /* no es una FEN: se prueba como PGN */ }
  let game;
  try { game = parsePgn(src); } catch { throw new Error('La posición no es una FEN ni un PGN válido.'); }
  return game.moves[game.moves.length - 1].fen;
}

module.exports = { finalFen };
