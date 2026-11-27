// Lectura del PGN y descarga de Lichess. Solo en el proceso principal.
const { Chess } = require('chess.js');

// Quita las órdenes de Lichess ([%cal ...], [%clk ...]) y los espacios sobrantes.
const clean = (c) => String(c || '').replace(/\[%[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

function parsePgn(text) {
  const src = String(text || '').trim();
  if (!src) throw new Error('Pega un PGN o un enlace de Lichess.');
  const chess = new Chess();
  try { chess.loadPgn(src); } catch { throw new Error('El PGN no es válido o tiene jugadas imposibles.'); }
  const history = chess.history({ verbose: true });
  if (!history.length) throw new Error('El PGN no tiene jugadas.');
  const h = chess.getHeaders();
  // shortcut: comentarios por posición (FEN); si una posición se repite, gana el último. Basta para estudios.
  const byFen = new Map(chess.getComments().map((c) => [c.fen, clean(c.comment)]));
  return {
    headers: { white: h.White || '', black: h.Black || '', whiteElo: h.WhiteElo || '', blackElo: h.BlackElo || '', result: h.Result || '' },
    startFen: history[0].before,
    intro: byFen.get(history[0].before) || '',
    moves: history.map((m) => ({ san: m.san, from: m.from, to: m.to, fen: m.after, comment: byFen.get(m.after) || '' })),
  };
}

async function fetchLichessPgn(id, fetchFn = fetch) {
  return download(`https://lichess.org/game/export/${encodeURIComponent(id)}`, 'Esa partida no existe o es privada.', fetchFn);
}

// Capítulo de un estudio público, con comentarios y sin variantes.
async function fetchStudyPgn(studyId, chapterId, fetchFn = fetch) {
  const url = `https://lichess.org/api/study/${encodeURIComponent(studyId)}/${encodeURIComponent(chapterId)}.pgn?comments=true&variations=false&clocks=false`;
  return download(url, 'Ese estudio no existe o es privado.', fetchFn);
}

async function download(url, notFound, fetchFn) {
  let res;
  try {
    res = await fetchFn(url, {
      headers: { Accept: 'application/x-chess-pgn', 'User-Agent': 'chedex.app (Launcher)' },
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('No se pudo conectar con Lichess.'); }
  if (res.status === 404) throw new Error(notFound);
  if (!res.ok) throw new Error(`Lichess respondió con un error (${res.status}). Prueba más tarde.`);
  try { return await res.text(); } catch { throw new Error('No se pudo conectar con Lichess.'); }
}

module.exports = { parsePgn, fetchLichessPgn, fetchStudyPgn };
