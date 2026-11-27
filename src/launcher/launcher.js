(function () {
  const $ = (id) => document.getElementById(id);
  const nav = $('tools');
  let tools = [];
  let current = 0;
  let locked = true;

  function show(i) {
    current = i;
    const t = tools[i];
    [...nav.children].forEach((b, k) => b.classList.toggle('active', k === i));
    $('profileBtn').classList.remove('active');
    $('profile').hidden = true;
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

  function showProfile() {
    [...nav.children].forEach((b) => b.classList.remove('active'));
    $('profileBtn').classList.add('active');
    $('detail').hidden = true;
    $('profile').hidden = false;
    if (locked) $('pCode').focus();
  }

  function launch() { if (!locked && tools[current]) window.launcher.launch(tools[current].id); }

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
    if (tools.length && $('profile').hidden) show(0);
  }

  $('launch').addEventListener('click', launch);
  window.addEventListener('keydown', (e) => {
    if (!tools.length || locked || !$('profile').hidden || !$('upgate').hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); show(Math.min(tools.length - 1, current + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); show(Math.max(0, current - 1)); }
    else if (e.key === 'Enter' && document.activeElement.id !== 'launch') launch();
  });

  $('updBtn').addEventListener('click', () => window.launcher.installUpdate());
  // Actualización obligatoria: capa sin «más tarde»; si falla, la app vuelve a ser usable.
  const foot = document.querySelector('.foot').firstChild, footText = foot.textContent;
  window.launcher.onUpdate((s) => {
    const gate = $('upgate'), btn = $('updBtn');
    gate.hidden = s.state !== 'available' && s.state !== 'downloading';
    foot.textContent = s.state === 'error' ? 'No se pudo actualizar. Se reintentará más tarde.' : footText;
    if (s.state === 'available') {
      $('upTitle').textContent = `Hay una versión nueva (v${s.version})`;
      $('upText').textContent = 'Actualiza para seguir usando el Launcher. Se reiniciará solo.';
      btn.hidden = false;
      btn.focus();
    } else if (s.state === 'downloading') {
      btn.hidden = true;
      $('upText').textContent = `Descargando… ${s.percent}%`;
    }
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
    locked = s.state !== 'ok';
    const user = s.username ? `@${s.username}` : '';
    $('profileUser').textContent = user || 'Sin vincular';
    $('pTitle').textContent = locked ? 'Vincula tu Launcher' : user || 'Cuenta vinculada';
    $('pHint').textContent = '••••••••' + (s.codeHint || '');
    $('pLinked').hidden = locked;
    $('pForm').hidden = !locked;
    $('launch').disabled = locked;
    $('lockNote').hidden = !locked;
    $('keysHint').hidden = locked;
    if (locked) {
      $('pText').textContent = REASONS[s.reason] || REASONS.none;
      $('pError').hidden = true;
      showProfile();
    }
  }
  $('pForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('pLink').disabled = true;
    const r = await window.launcher.access.link($('pCode').value);
    $('pLink').disabled = false;
    if (r.ok) { $('pCode').value = ''; render(await window.launcher.access.status()); return; }
    $('pError').textContent = r.error; $('pError').hidden = false;
  });
  $('pSite').addEventListener('click', () => window.launcher.access.openSite());
  $('pUnlink').addEventListener('click', () => window.launcher.access.unlink());
  $('profileBtn').addEventListener('click', showProfile);
  window.launcher.access.onChange(render);
  window.launcher.access.status().then(render);
})();
