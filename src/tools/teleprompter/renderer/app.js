(function () {
  const L = window.CueLogic;
  const $ = (id) => document.getElementById(id);
  const el = {
    editor: $('editor'), reader: $('reader'), viewport: $('viewport'), text: $('text'),
    script: $('script'), speed: $('speed'), speedOut: $('speedOut'), size: $('size'), sizeOut: $('sizeOut'),
    prepare: $('prepare'), start: $('start'), back: $('back'), state: $('state'), speedHud: $('speedHud'),
    opacity: $('opacity'), pin: $('pin'),
  };

  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let mode = 'editor';       // 'editor' | 'ready' | 'running' | 'paused' | 'done'
  let speed = L.clampSpeed(Number(store.get('cue.speed', 60)));
  let pos = 0, maxPos = 0, last = 0, raf = 0;

  // ---- ajustes ----
  el.script.value = store.get('cue.script', '');
  el.speed.value = speed; el.speedOut.textContent = speed;
  const size = Number(store.get('cue.size', 64));
  el.size.value = size; el.sizeOut.textContent = size;
  document.documentElement.style.setProperty('--size', size + 'px');

  el.speed.addEventListener('input', () => setSpeed(Number(el.speed.value)));
  el.size.addEventListener('input', () => {
    const v = Number(el.size.value);
    el.sizeOut.textContent = v; store.set('cue.size', v);
    document.documentElement.style.setProperty('--size', v + 'px');
  });
  el.script.addEventListener('input', () => store.set('cue.script', el.script.value));

  function setSpeed(v) {
    speed = L.clampSpeed(v);
    el.speed.value = speed; el.speedOut.textContent = speed;
    el.speedHud.textContent = speed + ' px/s';
    store.set('cue.speed', speed);
  }

  // ---- estados ----
  function setState(s) {
    mode = s;
    const labels = { ready: 'Listo', running: '▶ En marcha', paused: '❚❚ Pausa', done: 'Fin' };
    el.state.textContent = labels[s] || '';
    el.state.classList.toggle('running', s === 'running');
    el.reader.classList.toggle('paused', s !== 'running');
    el.start.classList.toggle('hidden', s !== 'ready');
  }

  function measure() { maxPos = Math.max(0, el.text.offsetHeight - el.viewport.clientHeight); }
  function render() { el.text.style.transform = `translate3d(0, ${-pos}px, 0)`; }

  function tick(now) {
    if (mode !== 'running') return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const r = L.advance(pos, speed, dt, maxPos);
    pos = r.pos; render();
    if (r.done) { setState('done'); return; }
    raf = requestAnimationFrame(tick);
  }

  function run() {
    if (mode === 'done') { pos = 0; render(); }
    if (!['ready', 'paused', 'done'].includes(mode)) return;
    measure(); setState('running');
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function pause() { if (mode === 'running') { cancelAnimationFrame(raf); setState('paused'); } }
  function toggle() {
    if (mode === 'running') pause();
    else if (['ready', 'paused', 'done'].includes(mode)) run();
  }

  function prepare() {
    const txt = el.script.value.trim();
    if (!txt) { el.script.focus(); return; }
    el.text.textContent = txt;
    el.editor.classList.add('hidden'); el.reader.classList.remove('hidden');
    pos = 0; render(); measure(); setState('ready');
    setSpeed(speed);
    window.cue.scriptReady();   // notificación del sistema: "Guion listo"
  }
  function backToEditor() {
    cancelAnimationFrame(raf); mode = 'editor';
    el.reader.classList.add('hidden'); el.editor.classList.remove('hidden');
    el.script.focus();
  }

  el.prepare.addEventListener('click', prepare);
  el.start.addEventListener('click', run);
  el.back.addEventListener('click', backToEditor);
  el.viewport.addEventListener('click', toggle);
  window.addEventListener('resize', () => { if (mode !== 'editor') measure(); });

  window.addEventListener('keydown', (e) => {
    if (mode === 'editor') return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); setSpeed(L.stepSpeed(speed, 1)); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); setSpeed(L.stepSpeed(speed, -1)); }
    else if (e.code === 'Escape') backToEditor();
  });

  // ---- puente con Electron ----
  window.cue.onTogglePause(() => { if (mode !== 'editor') toggle(); });
  window.cue.onOnTopChanged((v) => el.pin.classList.toggle('on', v));
  el.pin.addEventListener('click', () => window.cue.setOnTop(!el.pin.classList.contains('on')));
  el.opacity.addEventListener('input', () => window.cue.setOpacity(Number(el.opacity.value) / 100));
})();
