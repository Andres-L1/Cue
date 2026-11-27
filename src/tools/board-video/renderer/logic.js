(function (root) {
  // Id de 8 caracteres de un enlace de Lichess (con sufijo de color /black o id de 12 de jugador).
  function gameIdFromLink(text) {
    const m = /lichess\.org\/([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?![A-Za-z0-9])/.exec(String(text || ''));
    return m ? m[1] : null;
  }

  // Capítulo de un estudio: lichess.org/study/<estudio 8>/<capítulo 8>. Sin capítulo, chapterId = null.
  function studyFromLink(text) {
    const m = /lichess\.org\/study\/([A-Za-z0-9]{8})(?:\/([A-Za-z0-9]{8}))?(?![A-Za-z0-9])/.exec(String(text || ''));
    return m ? { studyId: m[1], chapterId: m[2] || null } : null;
  }

  // Segundos extra para leer un comentario (~3 palabras/s, máximo 12 s).
  function readSec(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return words ? Math.min(12, 1.5 + words / 3) : 0;
  }

  // Jugadas de ficha 1-based → medias jugadas. Cualquier rango inválido = partida entera.
  function clampRange(totalPlies, fromMove, toMove) {
    const whole = { startPly: 0, endPly: totalPlies };
    const isNum = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isInteger(Number(v));
    if (!isNum(fromMove) || !isNum(toMove)) return whole;
    const from = Number(fromMove), to = Number(toMove);
    const startPly = (from - 1) * 2;
    if (from < 1 || to < from || startPly >= totalPlies) return whole;
    return { startPly, endPly: Math.min(totalPlies, to * 2) };
  }

  // Duración de la jugada i del tramo: o.durations[i] si existe (jugadas con comentario), si no perMove.
  const dur = (o, i) => (o.durations && o.durations[i] != null ? o.durations[i] : o.perMove);

  function durationOf(o) {
    let sum = o.holdSec;
    for (let i = 0; i < o.endPly - o.startPly; i++) sum += dur(o, i);
    return sum + o.outroSec;
  }

  // Qué posición se ve en el instante t y cuánto lleva deslizada la pieza de la jugada en curso.
  function frameAt(t, o) {
    const n = o.endPly - o.startPly;
    if (t < o.holdSec) return { phase: 'hold', ply: o.startPly, progress: 0 };
    let dt = t - o.holdSec;
    for (let k = 0; k < n; k++) {
      const d = dur(o, k);
      if (dt < d) return { phase: 'moves', ply: o.startPly + k + 1, progress: Math.min(1, dt / o.slideSec) };
      dt -= d;
    }
    return { phase: 'outro', ply: o.endPly, progress: 1 };
  }

  const api = { gameIdFromLink, studyFromLink, readSec, clampRange, durationOf, frameAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardLogic = api;
})(this);
