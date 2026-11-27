(function () {
  const L = window.BoardLogic;
  const $ = (id) => document.getElementById(id);
  const W = 1080, H = 1920;
  const C = {
    bg: '#0a0a0b', text: '#f2f1ec', muted: '#9a9ca3', accent: '#ee7b30',
    light: '#454c58', dark: '#1f242d', frame: '#2a303a', edge: '#4a525e',
    last: 'rgba(241,139,66,.4)', arrow: '#ffc36b',
  };
  const BOARD = { x: 72, y: 470, size: 936 };
  const SQ = BOARD.size / 8;
  const TIMING = { holdSec: 0.6, slideSec: 0.3, outroSec: 2 };
  const MIME = 'video/mp4;codecs=avc1';
  const FONT = '"DM Sans", system-ui, sans-serif';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const pieces = {};
  let game = { headers: {}, moves: [], intro: '' }, fens = [START], loaded = false, recording = false, raf = 0, previewStart = 0;

  $('signature').value = store.get('boardVideo.signature', '');

  // ---- utilidades de dibujo ----
  function placement(fen) {
    const map = {};
    fen.split(' ')[0].split('/').forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += Number(ch); continue; }
        map['abcdefgh'[f] + (8 - i)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        f++;
      }
    });
    return map;
  }
  function xy(sq) {
    const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1, flip = $('orient').value === 'b';
    return [BOARD.x + (flip ? 7 - f : f) * SQ, BOARD.y + (flip ? r : 7 - r) * SQ];
  }
  function text(str, x, y, font, color, align = 'center') {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y, W - 120);
  }
  function brand(y, size) { // «chedex» + «.app» en naranja, centrado
    ctx.font = `700 ${size}px ${FONT}`;
    const a = ctx.measureText('chedex').width, b = ctx.measureText('.app').width, x = (W - a - b) / 2;
    text('chedex', x, y, ctx.font, C.text, 'left');
    text('.app', x + a, y, ctx.font, C.accent, 'left');
  }
  function arrow(from, to) {
    const [x0, y0] = xy(from).map((v) => v + SQ / 2), [x1, y1] = xy(to).map((v) => v + SQ / 2);
    const ang = Math.atan2(y1 - y0, x1 - x0), head = SQ * 0.42, w = SQ * 0.16;
    const ex = x1 - Math.cos(ang) * head * 0.9, ey = y1 - Math.sin(ang) * head * 0.9;
    ctx.save();
    ctx.globalAlpha = 0.85; ctx.strokeStyle = ctx.fillStyle = C.arrow; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(ang - 0.5), y1 - head * Math.sin(ang - 0.5));
    ctx.lineTo(x1 - head * Math.cos(ang + 0.5), y1 - head * Math.sin(ang + 0.5));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function players() {
    const h = game.headers, side = (n, e) => (n || '') + (e ? ` (${e})` : '');
    return h.white || h.black ? `${side(h.white, h.whiteElo)} – ${side(h.black, h.blackElo)}` : '';
  }
  function moveLabel(i) { // número de jugada según la posición previa (sirve también con FEN inicial)
    const [, turn, , , , num] = fens[i].split(' ');
    return `${num}${turn === 'w' ? '.' : '…'} ${game.moves[i].san}`;
  }
  function opts() {
    const r = L.clampRange(game.moves.length, $('from').value, $('to').value);
    const perMove = Number($('pace').value);
    // Más tiempo en las jugadas con comentario (y en la portada si el capítulo tiene introducción).
    const durations = game.moves.slice(r.startPly, r.endPly).map((m) => perMove + L.readSec(m.comment));
    const holdSec = TIMING.holdSec + (r.startPly === 0 ? L.readSec(game.intro) : 0);
    return { ...r, perMove, durations, ...TIMING, holdSec };
  }
  // Texto en varias líneas; baja el cuerpo hasta que cabe y, si no, recorta con «…».
  function wrap(str, width, sizes) {
    for (let i = 0; i < sizes.length; i++) {
      const [size, max] = sizes[i];
      ctx.font = `500 ${size}px ${FONT}`;
      const lines = []; let line = '';
      for (const w of str.split(' ')) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > width && line) { lines.push(line); line = w; } else line = next;
      }
      lines.push(line);
      if (lines.length <= max || i === sizes.length - 1) {
        if (lines.length > max) { lines.length = max; lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…'; }
        return { size, lines };
      }
    }
  }
  function comment(str) {
    if (!str) return;
    const { size, lines } = wrap(str, W - 160, [[42, 3], [36, 3], [30, 4]]);
    lines.forEach((l, i) => text(l, W / 2, BOARD.y + BOARD.size + 218 + i * size * 1.3, `500 ${size}px ${FONT}`, C.text));
  }

  function draw(t) {
    const o = opts(), fr = L.frameAt(t, o);
    const sig = $('signature').value.trim(), who = players();
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // cabecera
    if (sig) text(sig, W / 2, 230, `800 76px ${FONT}`, C.text);
    if (who) text(who, W / 2, sig ? 320 : 280, `500 38px ${FONT}`, C.muted);

    // tablero
    const move = fr.phase === 'moves' ? game.moves[fr.ply - 1] : null;
    const sliding = move && fr.progress < 1;
    const pos = placement(fens[sliding ? fr.ply - 1 : fr.ply]);
    ctx.beginPath(); ctx.roundRect(BOARD.x - 24, BOARD.y - 24, BOARD.size + 48, BOARD.size + 48, 28);
    ctx.fillStyle = C.frame; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.edge; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(BOARD.x, BOARD.y, BOARD.size, BOARD.size, 14); ctx.clip();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const [x, y] = xy('abcdefgh'[f] + (r + 1));
        ctx.fillStyle = (f + r) % 2 ? C.light : C.dark;
        ctx.fillRect(x, y, SQ, SQ);
      }
    }
    if (move) {
      ctx.fillStyle = C.last;
      for (const s of [move.from, move.to]) { const [x, y] = xy(s); ctx.fillRect(x, y, SQ, SQ); }
    }
    ctx.restore();
    const moving = sliding ? pos[move.from] : null;
    if (sliding) delete pos[move.from];
    for (const sq in pos) { const [x, y] = xy(sq); ctx.drawImage(pieces[pos[sq]], x, y, SQ, SQ); }
    if (move) arrow(move.from, move.to);
    if (moving) {
      const [x0, y0] = xy(move.from), [x1, y1] = xy(move.to);
      const e = 1 - Math.pow(1 - fr.progress, 3); // ease-out
      ctx.drawImage(pieces[moving], x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, SQ, SQ);
    }

    // jugada en curso y marca
    if (move) text(moveLabel(fr.ply - 1), W / 2, BOARD.y + BOARD.size + 120, `700 56px ${FONT}`, C.text);
    comment(move ? move.comment : fr.phase === 'hold' && o.startPly === 0 ? game.intro : '');
    brand(1800, 54);

    // tarjeta final
    if (fr.phase === 'outro') {
      const a = Math.min(1, (t - (L.durationOf(o) - o.outroSec)) / 0.3);
      ctx.fillStyle = `rgba(10,10,11,${0.92 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = a;
      if (sig) text(sig, W / 2, H / 2 - 40, `800 104px ${FONT}`, C.text);
      brand(sig ? H / 2 + 80 : H / 2 + 30, sig ? 64 : 96);
      ctx.restore();
    }
  }

  // ---- vista previa en bucle ----
  function loop(now) {
    if (recording) return;
    const d = L.durationOf(opts());
    draw(loaded ? ((now - previewStart) / 1000) % d : 0);
    raf = requestAnimationFrame(loop);
  }
  function restartPreview() {
    cancelAnimationFrame(raf);
    previewStart = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function msg(str, error) { $('msg').textContent = str; $('msg').classList.toggle('error', Boolean(error)); }

  async function load() {
    const src = $('source').value.trim();
    // Un PGN de Lichess lleva el enlace en la cabecera [Site]: solo es enlace si no parece PGN.
    const isLink = !src.includes('[') && !/\b1\./.test(src) && (L.studyFromLink(src) || L.gameIdFromLink(src));
    $('load').disabled = true;
    msg(isLink ? 'Descargando de Lichess…' : 'Leyendo el PGN…');
    try {
      const res = await window.cue.load({ source: isLink ? 'link' : 'pgn', text: src });
      if (!res.ok) { msg(res.error, true); return; }
      game = res.game;
      fens = [game.startFen, ...game.moves.map((m) => m.fen)];
      loaded = true;
      $('generate').disabled = false;
      msg(`Partida cargada: ${game.moves.length} medias jugadas.`);
      restartPreview();
    } catch {
      msg('No se pudo cargar la partida.', true);
    } finally {
      $('load').disabled = false;
    }
  }

  async function generate() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(MIME)) {
      msg('Este equipo no puede grabar vídeo MP4 (H.264). No se ha generado el clip.', true);
      return;
    }
    recording = true;
    cancelAnimationFrame(raf);
    $('controls').disabled = $('generate').disabled = true;
    $('progress').hidden = false; $('progress').value = 0;
    msg('Grabando…');
    let stream;
    try {
      const dur = L.durationOf(opts());
      stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: MIME, videoBitsPerSecond: 6e6 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise((resolve, reject) => { rec.onstop = resolve; rec.onerror = (e) => reject(e.error); });
      draw(0);
      rec.start(1000);
      const t0 = performance.now();
      // setInterval y no requestAnimationFrame: sigue dibujando aunque la ventana pierda el foco.
      await new Promise((resolve) => {
        const id = setInterval(() => {
          const t = (performance.now() - t0) / 1000;
          draw(Math.min(t, dur));
          $('progress').value = Math.min(1, t / dur);
          // Margen tras el final: el codificador descarta los últimos ~0,4 s al parar.
          if (t >= dur + 0.5) { clearInterval(id); resolve(); }
        }, 1000 / 60);
      });
      rec.stop();
      await stopped;
      msg('Guardando…');
      const buf = await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer();
      const res = await window.cue.save(buf);
      if (res.ok) msg('Vídeo guardado.');
      else msg(res.canceled ? 'Guardado cancelado.' : res.error, !res.canceled);
    } catch (e) {
      console.error(e);
      msg('No se pudo grabar el vídeo.', true);
    } finally {
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      recording = false;
      $('controls').disabled = $('generate').disabled = false;
      $('progress').hidden = true;
      restartPreview();
    }
  }

  // ---- eventos ----
  $('load').addEventListener('click', load);
  $('generate').addEventListener('click', generate);
  $('signature').addEventListener('input', () => store.set('boardVideo.signature', $('signature').value));
  for (const id of ['from', 'to', 'pace']) $(id).addEventListener('change', restartPreview);

  // Fuentes y piezas precargadas antes del primer dibujo.
  const codes = ['w', 'b'].flatMap((c) => ['K', 'Q', 'R', 'B', 'N', 'P'].map((p) => c + p));
  Promise.all([
    document.fonts.load(`800 76px ${FONT}`), document.fonts.load(`700 64px ${FONT}`), document.fonts.load(`500 38px ${FONT}`),
    ...codes.map((code) => { const img = new Image(); img.src = `pieces/${code}.svg`; pieces[code] = img; return img.decode(); }),
  ]).then(restartPreview, (e) => { console.error(e); msg('No se pudieron cargar las piezas.', true); });
})();
