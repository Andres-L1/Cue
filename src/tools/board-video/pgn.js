// Lectura del PGN y descarga de Lichess. Solo en el proceso principal.
const { Chess } = require('chess.js');

// Quita las órdenes de Lichess ([%cal ...], [%clk ...]) y los espacios sobrantes.
const clean = (c) => String(c || '').replace(/\[%[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

// Quita las variantes (...) respetando los comentarios {...}.
function withoutVariations(pgn) {
  let out = '', depth = 0, inBrace = false;
  for (const ch of pgn) {
    if (inBrace) { if (depth === 0) out += ch; if (ch === '}') inBrace = false; continue; }
    if (ch === '{') { inBrace = true; if (depth === 0) out += ch; } else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

function parsePgn(text) {
  // Pegar desde la web mete espacios raros; algunos PGN ponen el comentario tras el número de jugada y Lichess a veces deja dos comentarios seguidos.
  const src = String(text || '').replace(/[\u00a0\u200b\u2007\u202f\ufeff]/g, ' ').replace(/(\d+\.+)\s*(\{[^}]*\})/g, '$2 $1').replace(/\}\s*\{/g, ' ').trim();
  if (!src) throw new Error('Pega un PGN o un enlace de Lichess.');
  const chess = new Chess();
  // Si el PGN completo falla, se reintenta sin variantes y, por último, sin comentarios.
  const noVars = withoutVariations(src);
  let err;
  for (const attempt of [src, noVars, noVars.replace(/\{[^}]*\}/g, ' ')]) {
    try { chess.loadPgn(attempt); err = null; break; } catch (e) { err = err || e; }
  }
  if (err) throw new Error(`El PGN no es válido o tiene jugadas imposibles. (${String(err.message).replace(/\s+/g, ' ').slice(0, 120)})`);
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
