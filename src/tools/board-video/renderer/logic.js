(function (root) {
  // Id de 8 caracteres de un enlace de Lichess (con sufijo de color /black o id de 12 de jugador).
  function gameIdFromLink(text) {
    const m = /lichess\.org\/([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?![A-Za-z0-9])/.exec(String(text || ''));
    return m ? m[1] : null;
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

  function durationOf(o) {
    return o.holdSec + (o.endPly - o.startPly) * o.perMove + o.outroSec;
  }

  // Qué posición se ve en el instante t y cuánto lleva deslizada la pieza de la jugada en curso.
  function frameAt(t, o) {
    const n = o.endPly - o.startPly;
    if (t < o.holdSec) return { phase: 'hold', ply: o.startPly, progress: 0 };
    const dt = t - o.holdSec;
    if (dt >= n * o.perMove) return { phase: 'outro', ply: o.endPly, progress: 1 };
    const k = Math.floor(dt / o.perMove);
    return { phase: 'moves', ply: o.startPly + k + 1, progress: Math.min(1, (dt - k * o.perMove) / o.slideSec) };
  }

  const api = { gameIdFromLink, clampRange, durationOf, frameAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardLogic = api;
})(this);
