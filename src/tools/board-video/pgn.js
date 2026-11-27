// Lectura del PGN y descarga de Lichess. Solo en el proceso principal.
const { Chess } = require('chess.js');

function parsePgn(text) {
  const src = String(text || '').trim();
  if (!src) throw new Error('Pega un PGN o un enlace de Lichess.');
  const chess = new Chess();
  try { chess.loadPgn(src); } catch { throw new Error('El PGN no es válido o tiene jugadas imposibles.'); }
  const history = chess.history({ verbose: true });
  if (!history.length) throw new Error('El PGN no tiene jugadas.');
  const h = chess.getHeaders();
  return {
    headers: { white: h.White || '', black: h.Black || '', whiteElo: h.WhiteElo || '', blackElo: h.BlackElo || '', result: h.Result || '' },
    startFen: history[0].before,
    moves: history.map((m) => ({ san: m.san, from: m.from, to: m.to, fen: m.after })),
  };
}

async function fetchLichessPgn(id, fetchFn = fetch) {
  let res;
  try {
    res = await fetchFn(`https://lichess.org/game/export/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/x-chess-pgn', 'User-Agent': 'chedex.app (Launcher)' },
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('No se pudo conectar con Lichess.'); }
  if (res.status === 404) throw new Error('Esa partida no existe o es privada.');
  if (!res.ok) throw new Error(`Lichess respondió con un error (${res.status}). Prueba más tarde.`);
  try { return await res.text(); } catch { throw new Error('No se pudo conectar con Lichess.'); }
}

module.exports = { parsePgn, fetchLichessPgn };
