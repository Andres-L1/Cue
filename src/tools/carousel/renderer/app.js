(function () {
  const L = window.CarouselLogic;
  const $ = (id) => document.getElementById(id);
  const W = 1080, H = 1440, TEXT_W = W - 180;
  const TOP = 90, BOTTOM = 1320; // zona útil; el pie va en y=1380
  const THEME = {
    colors: L.COLORS,
    fonts: { main: '"Inter Tight", sans-serif', accent: '"Playfair Display", serif' },
  };
  const NAMES = { white: 'Blanco', black: 'Negro', red: 'Rojo', orange: 'Naranja' };
  const BOARD = { light: '#454c58', dark: '#1f242d', frame: '#2a303a', edge: '#4a525e', max: 760 }; // tablero «noche» de board-video
  const MAIN_SIZES = [[88, 4], [76, 4], [64, 4], [52, 4]];
  const ACCENT_SIZES = [[96, 2], [80, 2], [64, 2]];
  const pieces = {};

  const slides = L.ROLES.map(() => ({
    text: '', textColor: 'white', accent: '', accentColor: 'red',
    position: '', positionText: '', positionError: '', photo: null, photoName: '',
  }));
  let active = 0, ready = false;

  // ---- dibujo ----
  function placement(fen) {
    const map = {};
    fen.split(' ')[0].split('/').forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += Number(ch); continue; }
        map[f + ',' + i] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        f++;
      }
    });
    return map;
  }

  function drawBoard(ctx, fen, x, y, size) {
    const sq = size / 8, pad = Math.round(size * 0.026);
    ctx.beginPath(); ctx.roundRect(x - pad, y - pad, size + 2 * pad, size + 2 * pad, pad * 1.15);
    ctx.fillStyle = BOARD.frame; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BOARD.edge; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, size, size, pad * 0.6); ctx.clip();
    for (let row = 0; row < 8; row++) {
      for (let f = 0; f < 8; f++) {
        ctx.fillStyle = (f + 7 - row) % 2 ? BOARD.light : BOARD.dark; // a1 oscura, blancas abajo
        ctx.fillRect(x + f * sq, y + row * sq, sq, sq);
      }
    }
    ctx.restore();
    const pos = placement(fen);
    for (const key in pos) {
      const img = pieces[pos[key]], [f, row] = key.split(',').map(Number);
      if (img && img.naturalWidth) ctx.drawImage(img, x + f * sq, y + row * sq, sq, sq);
    }
  }

  // Trazo rojo irregular bajo la frase destacada.
  function underline(ctx, cx, y, width, color) {
    const x0 = cx - width / 2, w = width;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y + 2);
    ctx.quadraticCurveTo(x0 + w * 0.25, y - 9, x0 + w * 0.5, y + 1);
    ctx.quadraticCurveTo(x0 + w * 0.78, y + 11, x0 + w, y - 5);
    ctx.stroke();
    ctx.restore();
  }

  function shade(ctx, y0, y1) { // banda oscura con bordes suaves, de y0 a y1
    const fade = 220, g = ctx.createLinearGradient(0, y0 - fade, 0, y1 + fade);
    const k = fade / (y1 - y0 + 2 * fade), dark = 'rgba(10,10,11,.78)', clear = 'rgba(10,10,11,0)';
    g.addColorStop(0, clear); g.addColorStop(k, dark); g.addColorStop(1 - k, dark); g.addColorStop(1, clear);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawSlide(ctx, slide, theme) {
    const { colors, fonts } = theme;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.black; ctx.fillRect(0, 0, W, H);
    if (slide.photo) {
      const { sx, sy, sw, sh } = L.coverRect(slide.photo.naturalWidth, slide.photo.naturalHeight, W, H);
      ctx.drawImage(slide.photo, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      const g = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, 950);
      g.addColorStop(0, 'rgba(242,241,236,.07)'); g.addColorStop(1, 'rgba(242,241,236,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // Medidas del texto
    const mainFont = (s) => `700 ${s}px ${fonts.main}`;
    const accentFont = (s) => `italic 400 ${s}px ${fonts.accent}`;
    const measure = (font) => (str, s) => { ctx.font = font(s); return ctx.measureText(str).width; };
    const none = { size: 0, lines: [] };
    const main = slide.text.trim() ? L.fitText(slide.text, measure(mainFont), TEXT_W, MAIN_SIZES) : none;
    const acc = slide.accent.trim() ? L.fitText(slide.accent, measure(accentFont), TEXT_W, ACCENT_SIZES) : none;
    const mainLH = main.size * 1.1, accLH = acc.size * 1.15;
    const red = acc.lines.length > 0 && slide.accentColor === 'red';
    const gap = main.lines.length && acc.lines.length ? 40 : 0;
    const textH = main.lines.length * mainLH + gap + acc.lines.length * accLH + (red ? 30 : 0);

    // Con tablero: texto arriba y tablero debajo; el tablero encoge si el texto ocupa mucho.
    const boardGap = textH ? 70 : 0;
    const size = slide.position ? Math.floor(Math.min(BOARD.max, (BOTTOM - TOP - textH - boardGap) / 1.052)) : 0;
    const boardH = size ? size * 1.052 : 0;
    const y0 = TOP + (BOTTOM - TOP - textH - (size ? boardGap + boardH : 0)) / 2;

    if (slide.photo) {
      if (textH) shade(ctx, y0, y0 + textH);
      const g = ctx.createLinearGradient(0, H - 200, 0, H); // legibilidad del pie
      g.addColorStop(0, 'rgba(10,10,11,0)'); g.addColorStop(1, 'rgba(10,10,11,.7)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 200, W, 200);
    }

    let y = y0;
    ctx.font = mainFont(main.size); ctx.fillStyle = colors[slide.textColor];
    for (const line of main.lines) { ctx.fillText(line, W / 2, y + mainLH / 2, TEXT_W); y += mainLH; }
    y += gap;
    ctx.font = accentFont(acc.size); ctx.fillStyle = colors[slide.accentColor];
    for (const line of acc.lines) { ctx.fillText(line, W / 2, y + accLH / 2, TEXT_W); y += accLH; }
    if (red) {
      const last = acc.lines[acc.lines.length - 1];
      underline(ctx, W / 2, y + 8, Math.min(TEXT_W, ctx.measureText(last).width + 20), colors.red);
    }

    if (size) drawBoard(ctx, slide.position, (W - size) / 2, y0 + textH + boardGap + size * 0.026, size);

    // Pie «chedex.app»
    ctx.font = `700 28px ${fonts.main}`;
    const a = ctx.measureText('chedex').width, b = ctx.measureText('.app').width, x = (W - a - b) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.white; ctx.fillText('chedex', x, 1380);
    ctx.fillStyle = colors.orange; ctx.fillText('.app', x + a, 1380);
    ctx.restore();
  }

  // ---- interfaz ----
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const tabs = [], thumbs = [];

  L.ROLES.forEach((role, i) => {
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'tab'; tab.setAttribute('role', 'tab');
    tab.innerHTML = `<b>${i + 1}</b>`; tab.append(role);
    tab.addEventListener('click', () => select(i));
    $('tabs').append(tab); tabs.push(tab);

    const th = document.createElement('button');
    th.type = 'button'; th.className = 'thumb'; th.setAttribute('aria-label', `Diapositiva ${i + 1}`);
    const c = document.createElement('canvas'); c.width = 216; c.height = 288;
    th.append(c); th.addEventListener('click', () => select(i));
    $('thumbs').append(th); thumbs.push(c);
  });

  function swatches(groupId, prop) {
    for (const key of Object.keys(L.COLORS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.dataset.color = key;
      b.style.background = L.COLORS[key]; b.title = NAMES[key]; b.setAttribute('aria-label', NAMES[key]);
      b.addEventListener('click', () => { slides[active][prop] = key; syncSwatches(); render(active); });
      $(groupId).append(b);
    }
  }
  swatches('textColor', 'textColor');
  swatches('accentColor', 'accentColor');

  function syncSwatches() {
    for (const [groupId, prop] of [['textColor', 'textColor'], ['accentColor', 'accentColor']]) {
      for (const b of $(groupId).children) b.setAttribute('aria-pressed', String(b.dataset.color === slides[active][prop]));
    }
  }

  function render(i) {
    if (!ready) return;
    drawSlide(ctx, slides[i], THEME);
    thumbs[i].getContext('2d').drawImage(canvas, 0, 0, thumbs[i].width, thumbs[i].height);
    if (i !== active) drawSlide(ctx, slides[active], THEME);
  }
  function renderAll() { slides.forEach((_, i) => render(i)); }

  function msg(id, str, error) { $(id).textContent = str; $(id).classList.toggle('error', Boolean(error)); }

  function syncErrors() {
    slides.forEach((s, i) => {
      tabs[i].classList.toggle('error', Boolean(s.positionError));
      thumbs[i].parentElement.classList.toggle('error', Boolean(s.positionError));
    });
    const s = slides[active];
    $('posMsg').textContent = s.positionError;
    $('position').setAttribute('aria-invalid', String(Boolean(s.positionError)));
  }

  function syncPhoto() {
    const s = slides[active];
    $('removePhoto').hidden = !s.photo;
    msg('photoMsg', s.photo ? s.photoName : '');
  }

  function select(i) {
    active = i;
    const s = slides[i];
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
    thumbs.forEach((c, k) => c.parentElement.setAttribute('aria-current', String(k === i)));
    $('hint').textContent = `${L.ROLES[i]}: ${L.HINTS[i]}`;
    $('text').value = s.text; $('accent').value = s.accent; $('position').value = s.positionText;
    syncSwatches(); syncErrors(); syncPhoto();
    render(i);
  }

  // Valida la posición en el proceso principal; ignora respuestas de un texto ya cambiado.
  async function validate(i) {
    const s = slides[i], src = s.positionText;
    let fen = '', error = '';
    if (src.trim()) {
      const res = await window.cue.position(src);
      if (s.positionText !== src) return;
      if (res.ok) fen = res.fen; else error = res.error;
    }
    s.position = fen; s.positionError = error;
    syncErrors(); render(i);
  }

  const timers = [];
  $('text').addEventListener('input', () => { slides[active].text = $('text').value; render(active); });
  $('accent').addEventListener('input', () => { slides[active].accent = $('accent').value; render(active); });
  $('position').addEventListener('input', () => {
    const i = active;
    slides[i].positionText = $('position').value;
    clearTimeout(timers[i]);
    timers[i] = setTimeout(() => validate(i), 300);
  });

  $('photoBtn').addEventListener('click', () => $('photo').click());
  $('removePhoto').addEventListener('click', () => {
    slides[active].photo = null; slides[active].photoName = '';
    syncPhoto(); render(active);
  });
  $('photo').addEventListener('change', () => {
    const file = $('photo').files[0], i = active;
    $('photo').value = '';
    if (!file) return;
    if (!L.isImageFile(file.name, file.type)) { msg('photoMsg', 'Ese archivo no es una imagen PNG, JPG o WebP.', true); return; }
    const fail = () => { if (i === active) msg('photoMsg', 'No se pudo abrir esa imagen.', true); };
    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      try { await img.decode(); } catch { fail(); return; }
      if (!img.naturalWidth || !img.naturalHeight) { fail(); return; }
      slides[i].photo = img; slides[i].photoName = file.name;
      if (i === active) syncPhoto();
      render(i);
    };
    reader.readAsDataURL(file);
  });

  async function exportAll() {
    $('export').disabled = true;
    msg('msg', 'Preparando las imágenes…');
    try {
      timers.forEach(clearTimeout);
      await Promise.all(slides.map((_, i) => validate(i)));
      const bad = slides.findIndex((s) => s.positionError);
      if (bad >= 0) {
        select(bad);
        msg('msg', `La posición de la diapositiva ${bad + 1} no es válida. No se ha exportado nada.`, true);
        return;
      }
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const octx = off.getContext('2d'), files = [];
      for (let i = 0; i < slides.length; i++) {
        drawSlide(octx, slides[i], THEME);
        const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('toBlob');
        files.push({ name: L.fileName(i), data: await blob.arrayBuffer() });
      }
      const res = await window.cue.save(files);
      if (res.ok) msg('msg', `Guardadas en ${res.dir}`);
      else msg('msg', res.canceled ? 'Exportación cancelada.' : res.error, !res.canceled);
    } catch (e) {
      console.error(e);
      msg('msg', 'No se pudieron preparar las imágenes.', true);
    } finally {
      $('export').disabled = false;
    }
  }
  $('export').addEventListener('click', exportAll);

  // Fuentes y piezas cargadas antes del primer dibujo.
  select(0);
  const codes = ['w', 'b'].flatMap((c) => ['K', 'Q', 'R', 'B', 'N', 'P'].map((p) => c + p));
  Promise.all([
    document.fonts.load(`700 88px ${THEME.fonts.main}`), document.fonts.load(`italic 400 96px ${THEME.fonts.accent}`),
    ...codes.map((code) => { const img = new Image(); img.src = `../../board-video/renderer/pieces/${code}.svg`; pieces[code] = img; return img.decode(); }),
  ]).catch((e) => { console.error(e); msg('msg', 'No se pudieron cargar las fuentes o las piezas.', true); })
    .finally(() => { ready = true; $('export').disabled = false; renderAll(); });
})();
