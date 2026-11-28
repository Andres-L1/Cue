// Desplegable con el diseño de Chedex. Sustituye visualmente cada <select> de la página y lo
// conserva oculto: app.js sigue leyendo .value y escuchando 'change' sin cambios.
// shortcut: no observa cambios de .value hechos por código; si una herramienta los necesita, llamar a sync().
(() => {
  let uid = 0;

  function enhance(select) {
    if (select.dataset.cs) return;
    select.dataset.cs = '1';
    const id = 'cs' + (++uid);
    const wrap = document.createElement('div');
    wrap.className = 'cs';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cs-button';
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id + '-list');
    const label = select.labels && select.labels[0];
    if (label) {
      const copy = label.cloneNode(true);
      copy.querySelectorAll('select, .cs').forEach((n) => n.remove());
      btn.setAttribute('aria-label', copy.textContent.trim());
    }
    const list = document.createElement('ul');
    list.className = 'cs-list';
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    list.addEventListener('mousedown', (e) => e.preventDefault()); // el foco se queda en el botón
    const items = [...select.options].map((o, i) => {
      const li = document.createElement('li');
      li.id = id + '-' + i;
      li.className = 'cs-option';
      li.setAttribute('role', 'option');
      li.textContent = o.textContent;
      li.addEventListener('click', () => { choose(i); close(); });
      li.addEventListener('mousemove', () => setActive(i));
      list.appendChild(li);
      return li;
    });
    let active = -1;

    function sync() {
      const i = select.selectedIndex;
      btn.textContent = i >= 0 ? select.options[i].textContent : '';
      items.forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    }
    function setActive(i) {
      active = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((li, j) => li.classList.toggle('active', j === active));
      btn.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }
    function choose(i) {
      if (i === select.selectedIndex) return;
      select.selectedIndex = i;
      sync();
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function open() {
      if (!list.hidden) return;
      // fixed: no lo recortan los paneles con overflow
      const r = btn.getBoundingClientRect();
      list.style.left = r.left + 'px';
      list.style.width = r.width + 'px';
      list.hidden = false;
      const below = innerHeight - r.bottom - 8;
      list.style.top = (below >= list.offsetHeight || below >= r.top ? r.bottom + 6 : r.top - 6 - list.offsetHeight) + 'px';
      btn.setAttribute('aria-expanded', 'true');
      wrap.classList.add('open');
      setActive(Math.max(0, select.selectedIndex));
    }
    function close() {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      wrap.classList.remove('open');
    }

    btn.addEventListener('click', () => (list.hidden ? open() : close()));
    btn.addEventListener('blur', close);
    btn.addEventListener('keydown', (e) => {
      const isOpen = !list.hidden;
      const k = e.key;
      if (!isOpen) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(k)) {
          e.preventDefault();
          open();
          if (k === 'Home') setActive(0);
          if (k === 'End') setActive(items.length - 1);
        }
        return;
      }
      if (k === 'ArrowDown') setActive(active + 1);
      else if (k === 'ArrowUp') setActive(active - 1);
      else if (k === 'Home' || k === 'PageUp') setActive(0);
      else if (k === 'End' || k === 'PageDown') setActive(items.length - 1);
      else if (k === 'Enter' || k === ' ') { choose(active); close(); }
      else if (k === 'Escape') close();
      else if (k === 'Tab') { close(); return; }
      else return;
      e.preventDefault();
    });
    document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) close(); });
    addEventListener('resize', close);
    addEventListener('scroll', (e) => { if (e.target !== list) close(); }, true);

    select.hidden = true;
    select.tabIndex = -1;
    select.after(wrap);
    wrap.append(btn, list);
    sync();
    return { sync };
  }

  window.chedexSelect = enhance;
  document.querySelectorAll('select').forEach(enhance);
})();
