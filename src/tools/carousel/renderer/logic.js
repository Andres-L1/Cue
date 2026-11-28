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

  function handlesOf(kind, r) {
    const pts = { nw: [r.x, r.y], ne: [r.x + r.w, r.y], sw: [r.x, r.y + r.h], se: [r.x + r.w, r.y + r.h] };
    if (TEXTS.includes(kind)) { pts.w = [r.x, r.y + r.h / 2]; pts.e = [r.x + r.w, r.y + r.h / 2]; }
    return pts;
  }

  // Primero los tiradores del elemento seleccionado; después los cuerpos de arriba a abajo.
  function hitTest(rects, px, py, selected, tol) {
    const sel = selected && rects[selected];
    if (sel) {
      for (const [handle, [hx, hy]] of Object.entries(handlesOf(selected, sel))) {
        if (Math.abs(px - hx) <= tol && Math.abs(py - hy) <= tol) return { kind: selected, handle };
      }
    }
    for (const kind of ORDER) {
      const r = rects[kind];
      if (r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { kind, handle: 'move' };
    }
    return null;
  }

  // Aplica un arrastre al rect de partida y devuelve el override de la diapositiva:
  // texto/frase {x, y, w, scale}, foto {x, y, w, h}, tablero {x, y, size}.
  function dragBox(kind, rect, handle, dx, dy, W, H) {
    let { x, y, w, h } = rect, k = 1;
    const corner = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] }[handle];
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
    x = clamp(x, KEEP - w, W - KEEP);
    y = clamp(y, KEEP - h, H - KEEP);
    if (kind === 'photo') return { x, y, w, h };
    if (kind === 'board') return { x, y, size: w };
    return { x, y, w, scale: rect.scale * k };
  }

  const fileName = (i) => `carrusel-${i + 1}.png`;

  const isImageFile = (name, type) => /^image\/(png|jpeg|webp)$/.test(String(type || ''));

  const api = { ROLES, HINTS, COLORS, fitText, coverRect, fileName, isImageFile, handlesOf, hitTest, dragBox };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CarouselLogic = api;
})(this);
