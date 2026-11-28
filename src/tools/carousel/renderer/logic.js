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

  const fileName = (i) => `carrusel-${i + 1}.png`;

  const isImageFile = (name, type) => /^image\/(png|jpeg|webp)$/.test(String(type || ''));

  const api = { ROLES, HINTS, COLORS, fitText, coverRect, fileName, isImageFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CarouselLogic = api;
})(this);
