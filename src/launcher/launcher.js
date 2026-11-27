(function () {
  const $ = (id) => document.getElementById(id);
  const nav = $('tools');
  let tools = [];
  let current = 0;

  function show(i) {
    current = i;
    const t = tools[i];
    [...nav.children].forEach((b, k) => b.classList.toggle('active', k === i));
    $('detail').hidden = false;
    $('dKicker').textContent = `Herramienta ${String(i + 1).padStart(2, '0')}`;
    $('dName').textContent = t.name;
    $('dTagline').textContent = t.tagline;
    $('dDesc').textContent = t.description;
    $('dFeatures').replaceChildren(...t.features.map((f) => {
      const li = document.createElement('li'); li.textContent = f; return li;
    }));
    $('dKeys').replaceChildren(...t.shortcuts.map((s) => {
      const w = document.createElement('span');
      s.keys.forEach((k, n) => {
        if (n) w.append('+');
        const kb = document.createElement('kbd'); kb.textContent = k; w.append(kb);
      });
      const em = document.createElement('em'); em.textContent = s.label; w.append(em);
      return w;
    }));
    $('dPreview').innerHTML = t.preview; // HTML propio de cada herramienta (manifest.js)
    const d = $('detail'); d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
  }

  function launch() { if (tools[current]) window.launcher.launch(tools[current].id); }

  function build() {
    nav.replaceChildren(...tools.map((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tool';
      b.innerHTML = '<span class="ico"></span><span><b></b><small></small></span>';
      b.querySelector('.ico').innerHTML = t.icon;
      b.querySelector('b').textContent = t.name;
      b.querySelector('small').textContent = t.tagline;
      b.addEventListener('click', () => show(i));
      b.addEventListener('dblclick', launch);
      return b;
    }));
    if (tools.length) show(0);
  }

  $('launch').addEventListener('click', launch);
  window.addEventListener('keydown', (e) => {
    if (!tools.length || !$('gate').hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); show(Math.min(tools.length - 1, current + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); show(Math.max(0, current - 1)); }
    else if (e.key === 'Enter' && document.activeElement.id !== 'launch') launch();
  });

  $('updBtn').addEventListener('click', () => window.launcher.installUpdate());
  window.launcher.onUpdate((s) => {
    const box = $('update'), txt = $('updText'), btn = $('updBtn');
    box.hidden = false;
    btn.hidden = s.state !== 'ready';
    txt.textContent = s.state === 'ready'
      ? `Versión ${s.version} lista para instalar`
      : `Descargando actualización… ${s.percent || 0}%`;
  });
  window.launcher.version().then((v) => { $('ver').textContent = 'v' + v; });

  window.launcher.list().then((l) => { tools = l; build(); });

  // Acceso privado: sin código verificado de Chedex no se puede usar el launcher.
  const REASONS = {
    none: 'Esta app es solo para clientes de Chedex. Genera tu código en chedex.app/launcher (con tu usuario de Lichess) y pégalo aquí.',
    revoked: 'Tu acceso ya no está activo. Si crees que es un error, escríbenos. Si vuelves a ser cliente, genera un código nuevo en chedex.app/launcher.',
    offline: 'No se puede comprobar tu acceso desde hace tiempo. Conéctate a internet y vuelve a intentarlo.',
  };
  function render(s) {
    const locked = s.state !== 'ok';
    $('gate').hidden = !locked;
    $('unlink').hidden = locked;
    $('unlink').textContent = s.username ? `@${s.username} · Desvincular` : 'Desvincular';
    if (locked) {
      $('gText').textContent = REASONS[s.reason] || REASONS.none;
      $('gError').hidden = true;
      $('gCode').focus();
    }
  }
  $('gForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('gLink').disabled = true;
    const r = await window.launcher.access.link($('gCode').value);
    $('gLink').disabled = false;
    if (r.ok) { $('gCode').value = ''; render(await window.launcher.access.status()); return; }
    $('gError').textContent = r.error; $('gError').hidden = false;
  });
  $('gSite').addEventListener('click', () => window.launcher.access.openSite());
  $('unlink').addEventListener('click', () => window.launcher.access.unlink());
  window.launcher.access.onChange(render);
  window.launcher.access.status().then(render);
})();
