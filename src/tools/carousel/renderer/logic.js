(function (root) {
  const ROLES = ['Portada que crea ganas', 'Slide 2 que las paga', 'Cada slide abre la siguiente', 'Un giro', 'Un final que pide'];
  const HINTS = [
    'Promete algo que quieran ver.',
    'Cumple la promesa de la portada.',
    'Deja una pregunta para pasar.',
    'Cambia lo que creían saber.',
    'Pide guardar, comentar o seguir.',
  ];
  const COLORS = { white: '#f2f1ec', black: '#0a0a0b', red: '#e11d2e', orange: '#ee7b30' };

  // Reparte el texto en líneas de ancho <= width; una palabra más ancha se parte por caracteres.
  function wrap(str, fits) {
    const lines = [];
    let line = '';
    for (const word of String(str || '').trim().split(/\s+/).filter(Boolean)) {
      const next = line ? line + ' ' + word : word;
      if (fits(next)) { line = next; continue; }
      if (line) lines.push(line);
      line = '';
      for (const ch of word) {
        if (line && !fits(line + ch)) { lines.push(line); line = ''; }
        line += ch;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Prueba los tamaños de mayor a menor; con el último, recorta con «…» lo que no quepa.
  function fitText(str, measure, width, sizes) {
    let size = 0, lines = [];
    for (const [s, maxLines] of sizes) {
      const fits = (t) => measure(t, s) <= width;
      size = s;
      lines = wrap(str, fits);
      if (lines.length <= maxLines) return { size, lines };
      if (s === sizes[sizes.length - 1][0]) {
        lines = lines.slice(0, maxLines);
        let last = lines[maxLines - 1];
        while (last && !fits(last + '…')) last = last.slice(0, -1);
        lines[maxLines - 1] = last.trimEnd() + '…';
      }
    }
    return { size, lines };
  }

  // Recorte centrado de la imagen que cubre w×h sin deformar.
  function coverRect(imgW, imgH, w, h) {
    const scale = Math.min(imgW / w, imgH / h);
    const sw = w * scale, sh = h * scale;
    return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh };
  }

  // ---- edición libre de la vista previa (1.4.1) ----
  // Rects {x, y, w, h} en espacio de la diapositiva; el texto y la frase llevan además su factor `scale`.
  const ORDER = ['board', 'accent', 'text', 'photo']; // de arriba a abajo
  const TEXTS = ['text', 'accent'];
  const MIN_W = { text: 200, accent: 200, photo: 120, board: 160 };
  const SCALE = [0.5, 3]; // límites del factor de letra: nada ilegible
  const KEEP = 60; // px que deben quedar dentro de la diapositiva
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---- rotación (1.4.2): r.rot en grados, en torno al centro del rect; sin rot = 0° ----
  const OPP = { nw: 'se', se: 'nw', ne: 'sw', sw: 'ne', w: 'e', e: 'w' };
  function spinPoint(r, x, y, sign) { // gira (x, y) en torno al centro de r; sign -1 = deshace el giro
    const a = sign * r.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, ux = x - cx, uy = y - cy;
    return [cx + ux * c - uy * s, cy + ux * s + uy * c];
  }
  // Caja envolvente del rect girado (sin giro, el propio rect).
  function bounds(r) {
    if (!r.rot) return { x: r.x, y: r.y, w: r.w, h: r.h };
    const a = r.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const w = r.w * c + r.h * s, h = r.w * s + r.h * c;
    return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
  }
  const inside = (p, W, H) => p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H;

  // Tiradores en coordenadas de la diapositiva (girados con el elemento). Con `off`, añade el
  // de giro a esa distancia sobre el borde superior; si cae fuera de W×H, bajo el inferior o dentro.
  function handlesOf(kind, r, off, W, H) {
    const pts = { nw: [r.x, r.y], ne: [r.x + r.w, r.y], sw: [r.x, r.y + r.h], se: [r.x + r.w, r.y + r.h] };
    if (TEXTS.includes(kind)) { pts.w = [r.x, r.y + r.h / 2]; pts.e = [r.x + r.w, r.y + r.h / 2]; }
    const spin = (p) => (r.rot ? spinPoint(r, p[0], p[1], 1) : p);
    if (off) {
      const cands = [r.y - off, r.y + r.h + off, r.y + off].map((y) => spin([r.x + r.w / 2, y]));
      pts.rot = cands.find((p) => inside(p, W, H)) || cands[2];
      for (const k in pts) if (k !== 'rot') pts[k] = spin(pts[k]);
    } else for (const k in pts) pts[k] = spin(pts[k]);
    return pts;
  }

  // Primero los tiradores del elemento seleccionado; después los cuerpos de arriba a abajo.
  function hitTest(rects, px, py, selected, tol, off, W, H) {
    const sel = selected && rects[selected];
    if (sel) {
      for (const [handle, [hx, hy]] of Object.entries(handlesOf(selected, sel, off, W, H))) {
        if (Math.abs(px - hx) <= tol && Math.abs(py - hy) <= tol) return { kind: selected, handle };
      }
    }
    for (const kind of ORDER) {
      const r = rects[kind];
      if (!r) continue;
      const [x, y] = r.rot ? spinPoint(r, px, py, -1) : [px, py];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { kind, handle: 'move' };
    }
    return null;
  }

  // Ángulos en grados, normalizados a -180..180 (sin -0).
  const norm = (a) => (((a + 180) % 360 + 360) % 360 - 180) || 0;
  // Ángulo del puntero respecto al centro de r (arriba = 0°).
  const angleAt = (r, px, py) => norm(Math.atan2(py - (r.y + r.h / 2), px - (r.x + r.w / 2)) * 180 / Math.PI + 90);
  // Con imán, se pega a múltiplos de 15° a menos de 3°.
  function snapAngle(a, snap) {
    a = norm(a);
    const n = Math.round(a / 15) * 15;
    return snap && Math.abs(a - n) <= 3 ? norm(n) : a;
  }

  // Aplica un arrastre al rect de partida y devuelve el override de la diapositiva:
  // texto/frase {x, y, w, scale}, foto {x, y, w, h}, tablero {x, y, size}; más `rot` si está girado.
  // Girado: redimensiona en los ejes del elemento (el puntero se proyecta) con el tirador opuesto fijo.
  function dragBox(kind, rect, handle, dx, dy, W, H) {
    let { x, y, w, h } = rect, k = 1;
    const rot = rect.rot || 0;
    const corner = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] }[handle];
    if (rot && handle !== 'move') {
      const a = rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      [dx, dy] = [dx * c + dy * s, -dx * s + dy * c];
    }
    if (handle === 'move') { x += dx; y += dy; } else if (corner) {
      const [sx, sy] = corner;
      let lo = MIN_W[kind] / w, hi = Infinity;
      if (TEXTS.includes(kind)) { lo = Math.max(lo, SCALE[0] / rect.scale); hi = SCALE[1] / rect.scale; }
      k = clamp(((w + sx * dx) / w + (h + sy * dy) / h) / 2, lo, hi); // proporcional, ancla en la esquina opuesta
      if (sx < 0) x += w - w * k;
      if (sy < 0) y += h - h * k;
      w *= k; h *= k;
    } else if (handle === 'w' || handle === 'e') {
      const nw = Math.max(MIN_W[kind], w + (handle === 'e' ? dx : -dx));
      if (handle === 'w') x += w - nw;
      w = nw;
    }
    if (rot && OPP[handle]) { // el punto opuesto al tirador no se mueve en pantalla
      const a0 = handlesOf(kind, rect)[OPP[handle]], a1 = handlesOf(kind, { x, y, w, h, rot })[OPP[handle]];
      x += a0[0] - a1[0]; y += a0[1] - a1[1];
    }
    if (rot) { // el mínimo visible se mide sobre la caja envolvente
      const b = bounds({ x, y, w, h, rot });
      x += clamp(b.x, KEEP - b.w, W - KEEP) - b.x;
      y += clamp(b.y, KEEP - b.h, H - KEEP) - b.y;
    } else {
      x = clamp(x, KEEP - w, W - KEEP);
      y = clamp(y, KEEP - h, H - KEEP);
    }
    const out = kind === 'photo' ? { x, y, w, h } : kind === 'board' ? { x, y, size: w } : { x, y, w, scale: rect.scale * k };
    if (rot) out.rot = rot;
    return out;
  }

  // Guías con imán: devuelve { box, guides } con el override ajustado a la línea más cercana
  // (a menos de `tol`) de lines = { x: [...], y: [...] }. Al mover se alinean bordes y centro
  // de la caja envolvente; al redimensionar (solo sin giro), el borde que se mueve.
  function snapDrag(kind, rect, handle, dx, dy, W, H, lines, tol) {
    const best = (vals, targets) => {
      let r = null;
      for (const v of vals) for (const t of targets) if (Math.abs(t - v) <= tol && (!r || Math.abs(t - v) < Math.abs(r.d))) r = { d: t - v, v: t };
      return r;
    };
    const guides = [];
    if (handle === 'move') {
      const b = bounds({ ...rect, x: rect.x + dx, y: rect.y + dy });
      const sx = best([b.x, b.x + b.w / 2, b.x + b.w], lines.x), sy = best([b.y, b.y + b.h / 2, b.y + b.h], lines.y);
      if (sx) { dx += sx.d; guides.push({ x: sx.v }); }
      if (sy) { dy += sy.d; guides.push({ y: sy.v }); }
    } else if (!rect.rot) {
      const o = dragBox(kind, rect, handle, dx, dy, W, H), nw = o.size || o.w;
      const corner = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] }[handle];
      const nh = o.h || o.size || (corner ? rect.h * nw / rect.w : rect.h);
      if (corner) {
        const [cx, cy] = corner;
        const sx = best([cx > 0 ? o.x + nw : o.x], lines.x), sy = best([cy > 0 ? o.y + nh : o.y], lines.y);
        let k = 0;
        if (sx && (!sy || Math.abs(sx.d) <= Math.abs(sy.d))) { k = (nw + cx * sx.d) / rect.w; guides.push({ x: sx.v }); }
        else if (sy) { k = (nh + cy * sy.d) / rect.h; guides.push({ y: sy.v }); }
        if (k) { dx = cx * (rect.w * k - rect.w); dy = cy * (rect.h * k - rect.h); }
      } else {
        const sx = best([handle === 'e' ? o.x + nw : o.x], lines.x);
        if (sx) { dx += sx.d; guides.push({ x: sx.v }); }
      }
    }
    return { box: dragBox(kind, rect, handle, dx, dy, W, H), guides };
  }

  // Historial de disposición de una diapositiva: h = { undo: [], redo: [] } con copias de slide.layout.
  const history = () => ({ undo: [], redo: [] });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function record(h, before, after, limit = 100) { // false si el gesto no cambió nada
    if (same(before, after)) return false;
    h.undo.push({ ...before });
    if (h.undo.length > limit) h.undo.shift();
    h.redo.length = 0;
    return true;
  }
  function undo(h, current) {
    if (!h.undo.length) return null;
    h.redo.push({ ...current });
    return h.undo.pop();
  }
  function redo(h, current) {
    if (!h.redo.length) return null;
    h.undo.push({ ...current });
    return h.redo.pop();
  }

  // ---- número de diapositivas (1.4.2): el rol depende de la posición ----
  const MIN_SLIDES = 1, MAX_SLIDES = 8;
  const roleOf = (i) => ROLES[i] || `Diapositiva ${i + 1}`;
  const hintOf = (i) => HINTS[i] || 'Una idea por diapositiva.';
  // Vacía = se puede quitar sin preguntar.
  const isBlank = (s) => !s.text.trim() && !s.accent.trim() && !s.positionText.trim() && !s.photo &&
    !Object.values(s.layout).some(Boolean);

  const fileName = (i) => `carrusel-${i + 1}.png`;

  const isImageFile = (name, type) => /^image\/(png|jpeg|webp)$/.test(String(type || ''));

  const api = { ROLES, HINTS, COLORS, fitText, coverRect, fileName, isImageFile, handlesOf, hitTest, dragBox,
    bounds, angleAt, snapAngle, snapDrag, history, record, undo, redo, MIN_SLIDES, MAX_SLIDES, roleOf, hintOf, isBlank };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CarouselLogic = api;
})(this);
