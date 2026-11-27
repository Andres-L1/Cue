(function (root) {
  const MIN_SPEED = 10;   // px/s
  const MAX_SPEED = 400;
  const STEP = 10;

  function clampSpeed(v) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(v)));
  }
  function stepSpeed(v, dir) { return clampSpeed(v + dir * STEP); }

  // Avanza la posición de scroll; devuelve {pos, done}.
  function advance(pos, speed, dtSeconds, maxPos) {
    const next = pos + speed * dtSeconds;
    return next >= maxPos ? { pos: maxPos, done: true } : { pos: next, done: false };
  }

  const api = { MIN_SPEED, MAX_SPEED, STEP, clampSpeed, stepSpeed, advance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CueLogic = api;
})(this);
