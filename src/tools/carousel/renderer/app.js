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

  const newSlide = () => ({
    text: '', textColor: 'white', accent: '', accentColor: 'red',
    position: '', positionText: '', positionError: '', photo: null, photoName: '', layout: autoLayout(),
    history: L.history(), timer: 0,
  });
  const slides = L.ROLES.map(newSlide);
  let active = 0, ready = false;
  let boxes = {}, selected = null, drag = null; // rects de la diapositiva activa, elemento elegido, arrastre en curso
  function autoLayout() { return { text: null, accent: null, photo: null, board: null }; }

  // Gira el dibujo de fn en torno al centro de r; sin giro no toca el contexto (PNG idéntico a 1.4.1).
  function turned(ctx, r, fn) {
    if (!r || !r.rot) return fn();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(r.rot * Math.PI / 180); ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  }

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
  function underline(ctx, cx, y, width, color, k) { // k: factor de tamaño de la frase
    const x0 = cx - width / 2, w = width;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 9 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y + 2 * k);
    ctx.quadraticCurveTo(x0 + w * 0.25, y - 9 * k, x0 + w * 0.5, y + 1 * k);
    ctx.quadraticCurveTo(x0 + w * 0.78, y + 11 * k, x0 + w, y - 5 * k);
    ctx.stroke();
    ctx.restore();
  }

  function shade(ctx, y0, y1) { // banda oscura con bordes suaves, de y0 a y1
    const fade = 220, g = ctx.createLinearGradient(0, y0 - fade, 0, y1 + fade);
    const k = fade / (y1 - y0 + 2 * fade), dark = 'rgba(10,10,11,.78)', clear = 'rgba(10,10,11,0)';
    g.addColorStop(0, clear); g.addColorStop(k, dark); g.addColorStop(1 - k, dark); g.addColorStop(1, clear);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // Dibuja la diapositiva y devuelve los rects de sus elementos editables (para la vista previa).
  // slide.layout[kind] = null → posición automática; si no, el override que devuelve L.dragBox.
  function drawSlide(ctx, slide, theme) {
    const { colors, fonts } = theme;
    const lay = slide.layout, rects = {};
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.black; ctx.fillRect(0, 0, W, H);
    if (!slide.photo || lay.photo) { // la viñeta se ve detrás de una foto movida
      const g = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, 950);
      g.addColorStop(0, 'rgba(242,241,236,.07)'); g.addColorStop(1, 'rgba(242,241,236,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (slide.photo) {
      const { sx, sy, sw, sh } = L.coverRect(slide.photo.naturalWidth, slide.photo.naturalHeight, W, H);
      const p = rects.photo = lay.photo || { x: 0, y: 0, w: W, h: H };
      turned(ctx, p, () => ctx.drawImage(slide.photo, sx, sy, sw, sh, p.x, p.y, p.w, p.h));
    }

    // Medidas del texto (la maqueta automática no depende de los overrides: mover uno no desplaza a los demás)
    const mainFont = (s) => `700 ${s}px ${fonts.main}`;
    const accentFont = (s) => `italic 400 ${s}px ${fonts.accent}`;
    const measure = (font) => (str, s) => { ctx.font = font(s); return ctx.measureText(str).width; };
    const none = { size: 0, lines: [] };
    const fit = (str, font, sizes, box) => (str.trim() ? L.fitText(str, measure(font), box.w, sizes.map(([s, n]) => [s * box.scale, n])) : none);
    const AUTO = { w: TEXT_W, scale: 1 };
    const main = fit(slide.text, mainFont, MAIN_SIZES, AUTO);
    const acc = fit(slide.accent, accentFont, ACCENT_SIZES, AUTO);
    const mainLH = main.size * 1.1, accLH = acc.size * 1.15;
    const red = acc.lines.length > 0 && slide.accentColor === 'red';
    const gap = main.lines.length && acc.lines.length ? 40 : 0;
    const textH = main.lines.length * mainLH + gap + acc.lines.length * accLH + (red ? 30 : 0);

    // Con tablero: texto arriba y tablero debajo; el tablero encoge si el texto ocupa mucho.
    const boardGap = textH ? 70 : 0;
    const size = slide.position ? Math.floor(Math.min(BOARD.max, (BOTTOM - TOP - textH - boardGap) / 1.052)) : 0;
    const boardH = size ? size * 1.052 : 0;
    const y0 = TOP + (BOTTOM - TOP - textH - (size ? boardGap + boardH : 0)) / 2;

    // Cajas efectivas: el override o la posición automática.
    const tb = lay.text || { x: (W - TEXT_W) / 2, y: y0, ...AUTO };
    let ay = y0; // sumado línea a línea, como antes, para que el PNG automático sea idéntico al bit
    for (let n = 0; n < main.lines.length; n++) ay += mainLH;
    const ab = lay.accent || { x: (W - TEXT_W) / 2, y: ay + gap, ...AUTO };
    const mainE = lay.text ? fit(slide.text, mainFont, MAIN_SIZES, tb) : main;
    const accE = lay.accent ? fit(slide.accent, accentFont, ACCENT_SIZES, ab) : acc;
    const mainLHE = mainE.size * 1.1, accLHE = accE.size * 1.15;
    if (mainE.lines.length) rects.text = { ...tb, h: mainE.lines.length * mainLHE };
    if (accE.lines.length) rects.accent = { ...ab, h: accE.lines.length * accLHE + (red ? 30 * ab.scale : 0) };
    const bb = !slide.position ? null : lay.board || (size ? { x: (W - size) / 2, y: y0 + textH + boardGap + size * 0.026, size } : null);
    if (bb) rects.board = { x: bb.x, y: bb.y, w: bb.size, h: bb.size, rot: bb.rot };

    if (slide.photo) {
      if (lay.text || lay.accent) {
        for (const r of [rects.text, rects.accent]) if (r) { const b = L.bounds(r); shade(ctx, b.y, b.y + b.h); }
      } else if (textH) shade(ctx, y0, y0 + textH);
      const g = ctx.createLinearGradient(0, H - 200, 0, H); // legibilidad del pie
      g.addColorStop(0, 'rgba(10,10,11,0)'); g.addColorStop(1, 'rgba(10,10,11,.7)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 200, W, 200);
    }

    turned(ctx, rects.text, () => {
      let y = tb.y;
      ctx.font = mainFont(mainE.size); ctx.fillStyle = colors[slide.textColor];
      for (const line of mainE.lines) { ctx.fillText(line, tb.x + tb.w / 2, y + mainLHE / 2, tb.w); y += mainLHE; }
    });
    turned(ctx, rects.accent, () => { // el trazo rojo gira con la frase
      let y = ab.y;
      ctx.font = accentFont(accE.size); ctx.fillStyle = colors[slide.accentColor];
      for (const line of accE.lines) { ctx.fillText(line, ab.x + ab.w / 2, y + accLHE / 2, ab.w); y += accLHE; }
      if (red) {
        const last = accE.lines[accE.lines.length - 1];
        underline(ctx, ab.x + ab.w / 2, y + 8 * ab.scale, Math.min(ab.w, ctx.measureText(last).width + 20 * ab.scale), colors.red, ab.scale);
      }
    });

    if (bb) turned(ctx, rects.board, () => drawBoard(ctx, slide.position, bb.x, bb.y, bb.size));

    // Pie «chedex.app»
    ctx.font = `700 28px ${fonts.main}`;
    const a = ctx.measureText('chedex').width, b = ctx.measureText('.app').width, x = (W - a - b) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.white; ctx.fillText('chedex', x, 1380);
    ctx.fillStyle = colors.orange; ctx.fillText('.app', x + a, 1380);
    ctx.restore();
    return rects;
  }

  // ---- interfaz ----
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  let tabs = [], thumbs = [];

  // Pestañas y miniaturas según el número de diapositivas (el rol va con la posición).
  function buildTabs() {
    $('tabs').replaceChildren(); $('thumbs').replaceChildren();
    tabs = []; thumbs = [];
    slides.forEach((_, i) => {
      const tab = document.createElement('button');
      tab.type = 'button'; tab.className = 'tab'; tab.setAttribute('role', 'tab');
      tab.innerHTML = `<b>${i + 1}</b>`; tab.append(L.ROLES[i] || 'Extra'); // «Diapositiva N» no cabe con 8 pestañas
      tab.title = L.roleOf(i);
      tab.addEventListener('click', () => select(i));
      $('tabs').append(tab); tabs.push(tab);

      const th = document.createElement('button');
      th.type = 'button'; th.className = 'thumb'; th.setAttribute('aria-label', `Diapositiva ${i + 1}`);
      const c = document.createElement('canvas'); c.width = 216; c.height = 288;
      th.append(c); th.addEventListener('click', () => select(i));
      $('thumbs').append(th); thumbs.push(c);
    });
    $('addSlide').disabled = slides.length >= L.MAX_SLIDES;
    $('removeSlide').disabled = slides.length <= L.MIN_SLIDES;
    const n = slides.length;
    $('export').firstChild.textContent = `Exportar ${n} ${n === 1 ? 'imagen' : 'imágenes'} `;
    msg('msg', ''); // un aviso de export ya no corresponde a las diapositivas de ahora
  }
  buildTabs();

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

  // La selección y las guías se pintan después de copiar la miniatura: nunca llegan a miniaturas ni al PNG.
  function render(i) {
    if (!ready || i < 0 || i >= slides.length) return;
    boxes = drawSlide(ctx, slides[i], THEME);
    thumbs[i].getContext('2d').drawImage(canvas, 0, 0, thumbs[i].width, thumbs[i].height);
    if (i !== active) boxes = drawSlide(ctx, slides[active], THEME);
    drawSelection();
    const s = slides[active];
    $('resetLayout').disabled = !Object.values(s.layout).some(Boolean);
    $('undo').disabled = !s.history.undo.length;
    $('redo').disabled = !s.history.redo.length;
  }

  const px = () => W / canvas.clientWidth; // px de diapositiva por px de pantalla
  const ROT_OFF = 34, SNAP = 8; // tirador de giro a 34 px de pantalla; imán a 8 px de diapositiva
  function drawSelection() {
    const r = selected && boxes[selected];
    if (!r) return;
    const k = px(), s = 12 * k, hs = L.handlesOf(selected, r, ROT_OFF * k, W, H);
    ctx.save();
    ctx.lineWidth = 2 * k; ctx.strokeStyle = THEME.colors.orange; ctx.fillStyle = THEME.colors.white;
    turned(ctx, r, () => ctx.strokeRect(r.x, r.y, r.w, r.h));
    for (const [name, [hx, hy]] of Object.entries(hs)) {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate((r.rot || 0) * Math.PI / 180);
      ctx.beginPath();
      if (name === 'rot') ctx.arc(0, 0, 8 * k, 0, 2 * Math.PI); else ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (drag && drag.guides) { // guías del imán, solo mientras dura el gesto
      ctx.lineWidth = 1.5 * k; ctx.beginPath();
      for (const g of drag.guides) {
        if ('x' in g) { ctx.moveTo(g.x, 0); ctx.lineTo(g.x, H); } else { ctx.moveTo(0, g.y); ctx.lineTo(W, g.y); }
      }
      ctx.stroke();
    }
    ctx.restore();
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
    active = i; selected = null; drag = null; arrowRun = null;
    const s = slides[i];
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
    thumbs.forEach((c, k) => c.parentElement.setAttribute('aria-current', String(k === i)));
    $('hint').textContent = `${L.roleOf(i)}: ${L.hintOf(i)}`;
    $('text').value = s.text; $('accent').value = s.accent; $('position').value = s.positionText;
    syncSwatches(); syncErrors(); syncPhoto();
    render(i);
  }

  // Valida la posición en el proceso principal; ignora respuestas de un texto ya cambiado.
  async function validate(s) {
    const src = s.positionText;
    let fen = '', error = '';
    if (src.trim()) {
      const res = await window.cue.position(src);
      if (s.positionText !== src) return;
      if (res.ok) fen = res.fen; else error = res.error;
    }
    s.position = fen; s.positionError = error;
    if (!slides.includes(s)) return; // quitada mientras validaba
    syncErrors(); render(slides.indexOf(s));
  }

  $('text').addEventListener('input', () => { slides[active].text = $('text').value; render(active); });
  $('accent').addEventListener('input', () => { slides[active].accent = $('accent').value; render(active); });
  $('position').addEventListener('input', () => {
    const s = slides[active];
    s.positionText = $('position').value;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => validate(s), 300);
  });

  $('photoBtn').addEventListener('click', () => $('photo').click());
  $('removePhoto').addEventListener('click', () => {
    const s = slides[active];
    s.photo = null; s.photoName = ''; s.layout.photo = null;
    for (const l of [...s.history.undo, ...s.history.redo]) l.photo = null; // la foto quitada no vuelve con deshacer
    syncPhoto(); render(active);
  });
  $('photo').addEventListener('change', () => {
    const file = $('photo').files[0], s = slides[active];
    $('photo').value = '';
    if (!file) return;
    if (!L.isImageFile(file.name, file.type)) { msg('photoMsg', 'Ese archivo no es una imagen PNG, JPG o WebP.', true); return; }
    const fail = () => { if (s === slides[active]) msg('photoMsg', 'No se pudo abrir esa imagen.', true); };
    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      try { await img.decode(); } catch { fail(); return; }
      if (!img.naturalWidth || !img.naturalHeight) { fail(); return; }
      s.photo = img; s.photoName = file.name;
      if (s === slides[active]) syncPhoto();
      render(slides.indexOf(s));
    };
    reader.readAsDataURL(file);
  });

  // ---- número de diapositivas ----
  $('addSlide').addEventListener('click', () => {
    if (slides.length >= L.MAX_SLIDES) return;
    slides.push(newSlide());
    buildTabs(); select(slides.length - 1); renderAll();
  });
  function removeActive() {
    if (slides.length <= L.MIN_SLIDES) return;
    clearTimeout(slides[active].timer);
    slides.splice(active, 1);
    buildTabs(); select(Math.min(active, slides.length - 1)); renderAll();
  }
  $('removeSlide').addEventListener('click', () => {
    if (slides.length <= L.MIN_SLIDES) return;
    if (L.isBlank(slides[active])) { removeActive(); return; }
    $('confirmText').textContent = `Se quitará la diapositiva ${active + 1} con todo su contenido. No se puede deshacer.`;
    $('confirm').returnValue = ''; // Esc no lo cambia: que no se quede el «remove» anterior
    $('confirm').showModal();
  });
  $('confirm').addEventListener('close', () => {
    if ($('confirm').returnValue === 'remove') removeActive();
    $('removeSlide').focus();
  });

  async function exportAll() {
    $('export').disabled = true;
    msg('msg', 'Preparando las imágenes…');
    try {
      slides.forEach((s) => clearTimeout(s.timer));
      await Promise.all(slides.map(validate));
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

  // ---- deshacer / rehacer (disposición, por diapositiva) ----
  let arrowRun = null; // flechas seguidas sobre el mismo elemento = un solo paso
  function commit(before) { arrowRun = null; return L.record(slides[active].history, before, slides[active].layout); }
  function step(dir) {
    if (drag) return;
    const s = slides[active], l = (dir < 0 ? L.undo : L.redo)(s.history, s.layout);
    if (!l) return;
    s.layout = l; arrowRun = null;
    render(active);
  }
  $('undo').addEventListener('click', () => step(-1));
  $('redo').addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.target.closest('textarea, input, dialog')) return; // en los campos, el deshacer nativo
    const key = e.key.toLowerCase();
    if (key === 'z') step(e.shiftKey ? 1 : -1);
    else if (key === 'y' && !e.shiftKey) step(1);
    else return;
    e.preventDefault();
  });

  // ---- edición libre en la vista previa ----
  const CURSORS = { move: 'move', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', w: 'ew-resize', e: 'ew-resize', rot: 'grab' };
  function point(e) {
    const r = canvas.getBoundingClientRect(), k = px();
    return [(e.clientX - r.left - canvas.clientLeft) * k, (e.clientY - r.top - canvas.clientTop) * k];
  }
  const hit = (e) => { const [x, y] = point(e); return L.hitTest(boxes, x, y, selected, 10 * px(), ROT_OFF * px(), W, H); };
  function lines(kind) { // centro, márgenes de seguridad y bordes/centros de los demás elementos
    const x = [W / 2, 90, W - 90], y = [H / 2, TOP, BOTTOM];
    for (const k in boxes) {
      if (k === kind) continue;
      const b = L.bounds(boxes[k]);
      x.push(b.x, b.x + b.w / 2, b.x + b.w); y.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!ready || e.button !== 0) return;
    const h = hit(e);
    selected = h ? h.kind : null;
    if (h) {
      drag = { ...h, start: point(e), rect: { ...boxes[h.kind] }, moved: false, before: { ...slides[active].layout }, guides: [] };
      canvas.setPointerCapture(e.pointerId);
      if (h.handle === 'rot') canvas.style.cursor = 'grabbing';
    }
    render(active);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag && !(e.buttons & 1)) endDrag(); // se soltó sin que llegara pointerup (p. ej. fuera de la ventana)
    if (!drag) { const h = ready && hit(e); canvas.style.cursor = h ? CURSORS[h.handle] : ''; return; }
    const [x, y] = point(e), dx = x - drag.start[0], dy = y - drag.start[1];
    if (!drag.moved && Math.hypot(dx, dy) < 2) return; // un clic solo selecciona: no crea override
    drag.moved = true;
    const { kind, rect, handle } = drag, lay = slides[active].layout;
    drag.guides = [];
    if (handle === 'rot') { // giro relativo al punto de agarre: el tirador puede estar arriba, abajo o dentro
      const rot = L.snapAngle((rect.rot || 0) + L.angleAt(rect, x, y) - L.angleAt(rect, ...drag.start), !e.altKey);
      lay[kind] = L.dragBox(kind, { ...rect, rot }, 'move', 0, 0, W, H);
    }
    else if (e.altKey) lay[kind] = L.dragBox(kind, rect, handle, dx, dy, W, H); // Alt: sin imán
    else ({ box: lay[kind], guides: drag.guides } = L.snapDrag(kind, rect, handle, dx, dy, W, H, lines(kind), SNAP));
    render(active);
  });
  function endDrag() {
    if (!drag) return;
    if (drag.moved) commit(drag.before);
    drag = null; canvas.style.cursor = '';
    render(active);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  // Alt suelto no debe abrir la barra de menú oculta de la ventana mientras se edita.
  for (const type of ['keydown', 'keyup']) canvas.addEventListener(type, (e) => { if (e.key === 'Alt') e.preventDefault(); });

  const STEP = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  canvas.addEventListener('keydown', (e) => {
    if (!selected || drag) return;
    const lay = slides[active].layout, before = { ...lay };
    if (STEP[e.key] && boxes[selected]) { // sin imán
      const d = e.shiftKey ? 20 : 4;
      lay[selected] = L.dragBox(selected, boxes[selected], 'move', STEP[e.key][0] * d, STEP[e.key][1] * d, W, H);
      const now = Date.now();
      if (arrowRun && arrowRun.kind === selected && now - arrowRun.t < 1000) arrowRun.t = now;
      else if (commit(before)) arrowRun = { kind: selected, t: now };
    } else if (e.key === 'Delete' || e.key === 'Backspace') { lay[selected] = null; commit(before); } // vuelve a automático: no borra contenido
    else if (e.key === 'Escape') selected = null;
    else return;
    e.preventDefault();
    render(active);
  });

  $('resetLayout').addEventListener('click', () => {
    const before = slides[active].layout;
    slides[active].layout = autoLayout(); commit(before); render(active);
  });

  // Fuentes y piezas cargadas antes del primer dibujo.
  select(0);
  const codes = ['w', 'b'].flatMap((c) => ['K', 'Q', 'R', 'B', 'N', 'P'].map((p) => c + p));
  Promise.all([
    document.fonts.load(`700 88px ${THEME.fonts.main}`), document.fonts.load(`italic 400 96px ${THEME.fonts.accent}`),
    ...codes.map((code) => { const img = new Image(); img.src = `../../board-video/renderer/pieces/${code}.svg`; pieces[code] = img; return img.decode(); }),
  ]).catch((e) => { console.error(e); msg('msg', 'No se pudieron cargar las fuentes o las piezas.', true); })
    .finally(() => { ready = true; $('export').disabled = false; renderAll(); });
})();
