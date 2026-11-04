// The action bar: a slim strip docked beside Roll20's left toolbar, with
// click-to-open cascading menus that open to the right.
// Lives in a shadow root so Roll20's CSS and ours never collide.
(function (G) {
  'use strict';
  const C = G.R20C;

  const ICONS = {
    heart: '<path d="M12 20s-7-4.4-9.2-8.7A5 5 0 0 1 12 6.3a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/>',
    sword: '<path d="M14.5 17.5 4 7V4h3l10.5 10.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    hourglass: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    d20: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m12 7 5 8H7z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    chevron: '<path d="m15 6-6 6 6 6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.3 4M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.2-1"/>',
  };
  const icon = (name, size = 18) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
    '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

  const CSS_TEXT = `
:host { all: initial; }
* { box-sizing: border-box; }
.r { --bg:#1d1f26; --bg2:#272a33; --bg3:#323642; --line:#3d4250; --fg:#e8e9ee; --mute:#9aa0ae;
     --acc:#d9a441; --ok:#5fb87a; --bad:#e0645f; --focus:#7aa7ff;
     font: 13px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); }
.strip { position: fixed; z-index: 2147483000; width: 44px; display: flex; flex-direction: column; gap: 2px; padding: 4px;
     background: var(--bg); border: 1px solid var(--line); border-radius: 8px;
     box-shadow: 2px 2px 10px rgba(0,0,0,.35); touch-action: none; user-select: none; cursor: grab; }
.strip.dragging { cursor: grabbing; opacity: .92; box-shadow: 4px 6px 18px rgba(0,0,0,.5); }
.strip.dragging .sb { cursor: grabbing; }
.sb { position: relative; width: 36px; height: 36px; border: 0; border-radius: 6px; background: transparent; color: var(--fg);
     display: grid; place-items: center; cursor: pointer; padding: 0; }
.sb:hover { background: var(--bg3); }
.sb.on { background: var(--bg3); color: var(--acc); box-shadow: inset -2px 0 0 var(--acc); }
.sb:focus-visible, .row:focus-visible, .ctl:focus-visible, input:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.sb .badge { position: absolute; bottom: 1px; right: 1px; font-size: 9px; font-weight: 700; background: var(--bg2);
     border-radius: 4px; padding: 0 2px; color: var(--fg); pointer-events: none; }
.who { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: var(--bg3); display: grid; place-items: center;
     font-weight: 700; font-size: 13px; color: var(--acc); }
.who img { width: 100%; height: 100%; object-fit: cover; }
.dot { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--bg); background: var(--mute); }
.dot.live { background: var(--ok); }
.sep { height: 1px; background: var(--line); margin: 2px 4px; }
.hpbar { height: 4px; border-radius: 2px; background: var(--bg3); margin: 0 3px 2px; overflow: hidden; }
.hpbar i { display: block; height: 100%; background: var(--ok); }
.menu { position: fixed; z-index: 2147483010; min-width: 220px; max-width: 320px; max-height: 72vh; overflow-y: auto;
     background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px; box-shadow: 4px 4px 16px rgba(0,0,0,.45); }
/* Menu header: the menu's name stands apart from its items. */
.title { position: sticky; top: -4px; z-index: 1; margin: -4px -4px 4px; padding: 9px 12px 8px;
     background: linear-gradient(180deg, var(--bg3), var(--bg2)); border-bottom: 1px solid var(--line);
     border-radius: 8px 8px 0 0; box-shadow: inset 0 -2px 0 rgba(217,164,65,.35);
     display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.title .tname { font-size: 14px; font-weight: 700; letter-spacing: .02em; color: var(--acc); white-space: nowrap; }
.title .tsub { font-size: 11px; color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Health bar */
.meter { padding: 4px 6px 8px; }
.meter .bar { position: relative; height: 20px; border-radius: 5px; background: #3a2226; border: 1px solid var(--line); overflow: hidden; }
.meter .fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #6fcf8a, #3f9a5c); transition: width .25s; }
.meter .tmp { position: absolute; inset: 0 auto 0 0; background: repeating-linear-gradient(135deg, rgba(122,167,255,.75) 0 6px, rgba(122,167,255,.5) 6px 12px); }
.meter .val { position: absolute; inset: 0; display: grid; place-items: center; font: 700 12px/1 inherit; color: #fff;
     text-shadow: 0 1px 2px rgba(0,0,0,.8); letter-spacing: .02em; }
.meter .sub { display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: var(--mute); }
.row { display: flex; align-items: center; gap: 6px; min-height: 30px; padding: 3px 6px 3px 8px; border-radius: 5px; cursor: pointer;
     outline: none; }
.row:hover, .row.open { background: var(--bg2); }
.row.open { box-shadow: inset -2px 0 0 var(--acc); }
.row.dis { opacity: .5; }
.row.hdr { cursor: default; min-height: 24px; padding-top: 8px; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); }
.row.hdr:hover { background: none; }
.row.busy { opacity: .6; pointer-events: none; }
.lab { flex: 1 1 auto; min-width: 5em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Long range text ("120 feet 60 ft long, 20 ft high") yields to the name and buttons. */
.hint { flex: 0 1 auto; min-width: 0; max-width: 9em; overflow: hidden; text-overflow: ellipsis; color: var(--mute); font-size: 12px; white-space: nowrap; }
.chk { width: 14px; color: var(--acc); flex: none; text-align: center; }
.ctls { display: flex; gap: 3px; flex: none; }
.ctl { border: 1px solid var(--line); background: var(--bg2); color: var(--fg); border-radius: 4px; padding: 2px 6px;
     font: 600 12px/18px inherit; cursor: pointer; white-space: nowrap; }
.ctl:hover { border-color: var(--acc); color: var(--acc); }
.ctl.sm { padding: 2px 5px; min-width: 22px; }
.arrow { color: var(--mute); flex: none; transform: rotate(180deg); display: grid; }
input.num, input.txt { width: 70px; background: var(--bg2); border: 1px solid var(--line); color: var(--fg); border-radius: 4px;
     padding: 3px 6px; font: inherit; }
input.txt { width: 100%; margin: 2px 0 4px; }
.empty { padding: 8px; color: var(--mute); }
.toast { position: fixed; z-index: 2147483020; max-width: 320px; padding: 8px 10px; border-radius: 6px; background: var(--bg);
     border: 1px solid var(--line); border-left: 3px solid var(--ok); box-shadow: 2px 2px 10px rgba(0,0,0,.4); font-size: 12px; }
.toast.bad { border-left-color: var(--bad); }
`;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // Health bar: green is current HP; striped blue on top is temp HP.
  function meterFor(m) {
    const box = el('div', 'meter');
    const max = Number(m.max) || 0;
    const cur = m.cur == null ? null : Number(m.cur);
    const pct = (v) => (max ? Math.max(0, Math.min(100, (v / max) * 100)) : v ? 100 : 0);
    const bar = el('div', 'bar');
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', 'Hit points');
    if (cur != null) { bar.setAttribute('aria-valuenow', String(cur)); bar.setAttribute('aria-valuemin', '0'); if (max) bar.setAttribute('aria-valuemax', String(max)); }
    const fill = el('div', 'fill'); fill.style.width = pct(cur || 0) + '%';
    bar.appendChild(fill);
    if (m.temp > 0) { const t = el('div', 'tmp'); t.style.width = pct(m.temp) + '%'; bar.appendChild(t); }
    bar.appendChild(el('div', 'val', escHtml((cur ?? '—') + (max && !m.note ? ' / ' + max : '') + (m.temp > 0 ? '  +' + m.temp : ''))));
    box.appendChild(bar);
    const left = m.temp > 0 ? m.temp + ' temp HP' : m.note ? m.note + ' HP' : 'Hit points';
    box.appendChild(el('div', 'sub', '<span>' + escHtml(left) + '</span>' + (m.ac != null ? '<span>AC ' + escHtml(m.ac) + '</span>' : '')));
    return box;
  }

  C.createUI = function createUI(handlers) {
    const host = document.createElement('div');
    host.id = 'r20-companion';
    const root = host.attachShadow({ mode: 'open' });
    const wrap = el('div', 'r');
    const style = el('style'); style.textContent = CSS_TEXT;
    root.append(style, wrap);
    document.documentElement.appendChild(host);

    const strip = el('div', 'strip');
    strip.setAttribute('role', 'toolbar');
    strip.setAttribute('aria-label', 'Character actions');
    strip.setAttribute('aria-orientation', 'vertical');
    wrap.appendChild(strip);

    let model = { character: null, live: false, cats: [], people: [], hidden: false };
    let path = []; // open menu keys: [categoryKey, nodeKey, ...]
    let filter = '';
    let toastTimer = null;
    let custom = null; // {x, y} once the bar has been dragged; null = docked
    let drag = null;
    let swallowClick = false;
    const busy = new Set();

    // ---- placement beside Roll20's left toolbar -----------------------------
    const clampPos = (x, y) => ({
      x: Math.round(Math.max(0, Math.min(x, innerWidth - strip.offsetWidth))),
      y: Math.round(Math.max(0, Math.min(y, innerHeight - Math.min(strip.offsetHeight, innerHeight)))),
    });
    function place() {
      if (custom) {
        const p = clampPos(custom.x, custom.y);
        strip.style.left = p.x + 'px';
        strip.style.top = p.y + 'px';
        positionMenus();
        return;
      }
      const bar = document.getElementById('master-toolbar');
      const r = bar && bar.getBoundingClientRect();
      const visible = r && r.width > 10 && r.height > 40 && r.right > 0;
      // Use the toolbar only if it looks like the slim left toolbar; always
      // keep the bar inside the window.
      const sane = visible && r.right < Math.min(400, innerWidth / 2);
      const p = clampPos(sane ? r.right + 4 : 8, sane ? Math.max(4, r.top + 4) : 60);
      strip.style.left = p.x + 'px';
      strip.style.top = p.y + 'px';
      positionMenus();
    }
    addEventListener('resize', place);
    setInterval(place, 1000);

    // ---- strip ---------------------------------------------------------------
    function renderStrip() {
      strip.textContent = '';
      const ch = model.character;
      const who = el('button', 'sb');
      who.dataset.cat = 'people';
      who.title = ch ? ch.name + (model.live ? '' : ' (sheet closed)') : 'Choose a character';
      who.setAttribute('aria-label', who.title);
      who.innerHTML = '<span class="who">' + (ch ? escHtml(initials(ch.name)) : icon('user')) + '</span>' +
        (ch ? '<span class="dot' + (model.live ? ' live' : '') + '"></span>' : '');
      if (ch && ch.img) {
        // Portrait from the Journal; keep the initials if it fails to load.
        const img = el('img');
        img.alt = '';
        img.addEventListener('load', () => { const w = who.querySelector('.who'); w.textContent = ''; w.appendChild(img); });
        img.src = ch.img;
      }
      if (path[0] === 'people') who.classList.add('on');
      strip.appendChild(who);
      const hp = ch && ch.stats;
      if (hp && hp.maxHp && hp.hp !== undefined && hp.hp !== null) {
        const bar = el('div', 'hpbar');
        bar.title = 'HP ' + hp.hp + '/' + hp.maxHp;
        bar.innerHTML = '<i style="width:' + Math.max(0, Math.min(100, (hp.hp / hp.maxHp) * 100)) + '%"></i>';
        strip.appendChild(bar);
      }
      if (model.cats.length) strip.appendChild(el('div', 'sep'));
      for (const cat of model.cats) {
        const b = el('button', 'sb' + (path[0] === cat.key ? ' on' : ''), icon(cat.icon));
        b.dataset.cat = cat.key;
        b.title = cat.label;
        b.setAttribute('aria-label', cat.label);
        b.setAttribute('aria-haspopup', 'menu');
        b.setAttribute('aria-expanded', String(path[0] === cat.key));
        if (cat.key === 'hp' && hp && hp.hp !== undefined && hp.hp !== null) b.insertAdjacentHTML('beforeend', '<span class="badge">' + hp.hp + '</span>');
        strip.appendChild(b);
      }
    }
    // Drag the whole bar: no handle. A press that moves more than a few
    // pixels becomes a drag; a press that doesn't is an ordinary click.
    strip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = strip.getBoundingClientRect();
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, moved: false };
    });
    // Track the pointer on the whole window while pressed, so a fast drag
    // never leaves the bar behind.
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        try { strip.setPointerCapture(e.pointerId); } catch { /* window listeners cover it */ }
        strip.classList.add('dragging');
        if (path.length) { path = []; renderMenus(); renderStrip(); }
      }
      custom = clampPos(drag.left + dx, drag.top + dy);
      strip.style.left = custom.x + 'px';
      strip.style.top = custom.y + 'px';
    }, true);
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        swallowClick = true;
        setTimeout(() => { swallowClick = false; }, 0);
        strip.classList.remove('dragging');
        handlers.savePos(custom);
      }
      drag = null;
    };
    addEventListener('pointerup', endDrag, true);
    addEventListener('pointercancel', endDrag, true);
    strip.addEventListener('click', (e) => {
      if (swallowClick) { swallowClick = false; e.stopPropagation(); return; }
      const b = e.target.closest('.sb');
      if (!b) return;
      const key = b.dataset.cat;
      path = path[0] === key ? [] : [key];
      filter = '';
      render();
      const first = root.querySelector('.menu .row:not(.hdr)');
      if (first && e.detail === 0) first.focus();
    });

    // ---- menus ----------------------------------------------------------------
    function peopleTree() {
      const out = [];
      out.push({ key: 'search', search: true });
      const q = filter.toLowerCase();
      const list = model.people.filter((p) => !q || p.name.toLowerCase().includes(q));
      const open = list.filter((p) => p.open);
      const rest = list.filter((p) => !p.open);
      const row = (p) => ({
        key: 'p:' + p.id, label: p.name, checked: model.character && model.character.id === p.id,
        hint: p.open ? (p.hidden ? 'hidden' : 'open') : p.cached ? 'saved' : '',
        person: p,
        controls: p.open ? [{ label: p.hidden ? icon('eye', 14) : icon('eyeOff', 14), html: true, title: p.hidden ? 'Show sheet window' : 'Hide sheet window', toggle: p.id }] : [],
      });
      if (open.length) { out.push({ key: 'h:open', header: true, label: 'Open sheets' }); out.push(...open.map(row)); }
      if (rest.length) { out.push({ key: 'h:journal', header: true, label: 'Journal' }); out.push(...rest.slice(0, 80).map(row)); }
      if (!list.length) out.push({ key: 'none', header: true, label: model.people.length ? 'No matches' : 'Open a character sheet, or open the Journal tab once' });
      return out;
    }
    function nodesAt(level) {
      if (!path[0]) return null;
      let nodes = path[0] === 'people' ? peopleTree() : (model.cats.find((c) => c.key === path[0]) || {}).items;
      for (let i = 1; i <= level; i++) {
        const n = (nodes || []).find((x) => x.key === path[i]);
        if (!n || !n.children) return null;
        nodes = n.children;
      }
      return nodes || null;
    }
    function titleAt(level) {
      if (level === 0) {
        if (path[0] === 'people') return 'Characters';
        const c = model.cats.find((x) => x.key === path[0]);
        return c ? c.label : '';
      }
      const parent = (nodesAt(level - 1) || []).find((x) => x.key === path[level]);
      return parent ? parent.label : '';
    }

    function rowFor(n, level) {
      if (n.search) {
        const box = el('div');
        const input = el('input', 'txt');
        input.placeholder = 'Search characters…';
        input.value = filter;
        input.addEventListener('input', () => { filter = input.value; render(); const again = root.querySelector('input.txt'); if (again) { again.focus(); again.setSelectionRange(filter.length, filter.length); } });
        box.appendChild(input);
        return box;
      }
      if (n.meter) return meterFor(n.meter);
      const row = el('div', 'row' + (n.header ? ' hdr' : '') + (n.disabled ? ' dis' : '') + (path[level + 1] === n.key ? ' open' : '') + (busy.has(n.key) ? ' busy' : ''));
      row.dataset.key = n.key;
      if (!n.header) { row.tabIndex = -1; row.setAttribute('role', 'menuitem'); }
      if (n.desc) row.title = n.desc;
      if (n.checked !== undefined && !n.header) row.appendChild(el('span', 'chk', n.checked ? '✓' : ''));
      row.appendChild(el('span', 'lab', escHtml(n.label)));
      if (n.hint) { const h = el('span', 'hint', escHtml(n.hint)); h.title = n.hint; row.appendChild(h); }
      if (n.input) {
        const input = el('input', 'num');
        input.type = 'number'; input.min = '0'; input.placeholder = n.input.placeholder || '';
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); go(); } });
        const btn = el('button', 'ctl', 'Apply');
        const go = () => { if (input.value !== '') act(n, { op: n.input.op, arg: Number(input.value), say: n.label + ' ' + input.value }); };
        btn.addEventListener('click', (e) => { e.stopPropagation(); go(); });
        row.append(input, btn);
      }
      if (n.controls && n.controls.length) {
        const box = el('span', 'ctls');
        n.controls.forEach((c, i) => {
          const b = el('button', 'ctl' + (c.label.length <= 2 || c.html ? ' sm' : ''), c.html ? c.label : escHtml(c.label));
          b.title = c.title || '';
          b.setAttribute('aria-label', (c.title || c.label) + ' — ' + n.label);
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (c.toggle) { handlers.toggleHidden(c.toggle); return; }
            act(n, c.run);
          });
          box.appendChild(b);
          void i;
        });
        row.appendChild(box);
      }
      if (n.children) row.appendChild(el('span', 'arrow', icon('chevron', 14)));
      return row;
    }

    function act(node, run) {
      if (!run) return;
      busy.add(node.key);
      render();
      Promise.resolve(handlers.run(run, node)).then((res) => {
        busy.delete(node.key);
        toast((run.say ? run.say + ' — ' : '') + (res && res.msg ? res.msg : ''), !res || !res.ok);
        render();
      });
    }

    function onRowClick(level, n) {
      if (n.header || n.search) return;
      if (n.person) { handlers.select(n.person.id); path = []; render(); return; }
      if (n.pref) { handlers.pref(n.pref, !n.checked); return; }
      if (n.dock) { custom = null; handlers.savePos(null); path = []; render(); place(); toast('Bar docked beside the toolbar.'); return; }
      if (n.diag) { Promise.resolve(handlers.diag()).then((ok) => toast(ok ? 'Diagnostics copied. Paste them into your bug report.' : 'Could not copy diagnostics.', !ok)); return; }
      if (n.children) {
        path = path.slice(0, level + 1);
        if (path[level + 1] !== n.key) path[level + 1] = n.key; else path.length = level + 1;
        render();
        const next = root.querySelectorAll('.menu')[level + 1];
        const first = next && next.querySelector('.row:not(.hdr)');
        if (first) first.focus();
        return;
      }
      if (n.input) { const i = root.querySelector('.menu .row[data-key="' + CSS.escape(n.key) + '"] input'); if (i) i.focus(); return; }
      if (n.disabled) { toast(n.label + ' — none left.', true); return; }
      act(n, n.run);
    }

    let menus = [];
    function renderMenus() {
      const scrolls = menus.map((m) => m.scrollTop);
      menus.forEach((m) => m.remove());
      menus = [];
      for (let level = 0; ; level++) {
        const nodes = nodesAt(level);
        if (!nodes) break;
        const m = el('div', 'menu');
        m.setAttribute('role', 'menu');
        m.dataset.level = String(level);
        const t = el('div', 'title', '<span class="tname">' + escHtml(titleAt(level)) + '</span>' +
          (level === 0 && model.character && path[0] !== 'people' ? '<span class="tsub">' + escHtml(model.character.name) + '</span>' : ''));
        m.appendChild(t);
        if (!nodes.length) m.appendChild(el('div', 'empty', 'Nothing here.'));
        for (const n of nodes) {
          const r = rowFor(n, level);
          if (!n.search) r.addEventListener('click', () => onRowClick(level, n));
          m.appendChild(r);
        }
        wrap.appendChild(m);
        if (scrolls[level]) m.scrollTop = scrolls[level];
        menus.push(m);
      }
      positionMenus();
    }
    function positionMenus() {
      const sr = strip.getBoundingClientRect();
      // Open toward the side of the screen with more room.
      const toLeft = sr.left + sr.width / 2 > innerWidth / 2;
      let anchorLeft = sr.right + 4;
      let anchorRight = sr.left - 4;
      menus.forEach((m, level) => {
        let top;
        if (level === 0) {
          const b = strip.querySelector('.sb[data-cat="' + CSS.escape(path[0]) + '"]');
          top = b ? b.getBoundingClientRect().top - 4 : strip.getBoundingClientRect().top;
        } else {
          const prev = menus[level - 1].querySelector('.row[data-key="' + CSS.escape(path[level]) + '"]');
          top = prev ? prev.getBoundingClientRect().top - 30 : 60;
        }
        const w = m.offsetWidth;
        const h = m.offsetHeight;
        const left = toLeft ? Math.max(4, anchorRight - w) : Math.max(4, Math.min(anchorLeft, innerWidth - w - 4));
        m.style.left = Math.round(left) + 'px';
        m.style.top = Math.round(Math.max(4, Math.min(top, innerHeight - h - 4))) + 'px';
        anchorLeft = left + w + 2;
        anchorRight = left - 2;
      });
    }

    function render() { renderStrip(); renderMenus(); }

    function toast(text, bad) {
      let t = root.querySelector('.toast');
      if (!t) { t = el('div', 'toast'); t.setAttribute('role', 'status'); wrap.appendChild(t); }
      t.className = 'toast' + (bad ? ' bad' : '');
      t.textContent = text;
      const s = strip.getBoundingClientRect();
      t.style.top = Math.round(Math.min(s.bottom + 6, innerHeight - 60)) + 'px';
      t.style.left = Math.round(Math.max(4, Math.min(s.left, innerWidth - 330))) + 'px';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.remove(), bad ? 6000 : 3000);
    }

    // Alt+Shift+C: bring the bar back beside the toolbar if it ever goes missing.
    document.addEventListener('keydown', (e) => {
      if (!(e.altKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.code === 'KeyC'))) return;
      e.preventDefault();
      custom = null;
      handlers.savePos(null);
      if (!host.isConnected) document.documentElement.appendChild(host);
      path = [];
      render();
      place();
      toast('Roll20embetterment bar is here.');
    }, true);

    // ---- closing & keyboard ---------------------------------------------------
    document.addEventListener('mousedown', (e) => {
      if (path.length && !e.composedPath().includes(host)) { path = []; render(); }
    }, true);
    root.addEventListener('keydown', (e) => {
      const level = Number(e.target.closest && e.target.closest('.menu')?.dataset.level);
      if (e.key === 'Escape') {
        if (path.length > 1) { path.length = path.length - 1; render(); const r = root.querySelector('.row.open'); if (r) r.focus(); }
        else { const key = path[0]; path = []; render(); const b = strip.querySelector('.sb[data-cat="' + CSS.escape(key || '') + '"]'); if (b) b.focus(); }
        e.preventDefault();
        return;
      }
      if (Number.isNaN(level) || e.target.tagName === 'INPUT') return;
      const rows = [...menus[level].querySelectorAll('.row:not(.hdr)')];
      const i = rows.indexOf(e.target.closest('.row'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
        if (next) next.focus();
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        const n = (nodesAt(level) || []).find((x) => x.key === rows[i]?.dataset.key);
        if (n && (e.key !== 'ArrowRight' || n.children)) onRowClick(level, n);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && level > 0) {
        path.length = level; render();
        const r = menus[level - 1] && menus[level - 1].querySelector('.row.open, .row[data-key="' + CSS.escape(path[level - 1] || '') + '"]');
        if (r) r.focus();
        e.preventDefault();
      }
    });

    return {
      update(next) {
        if ('pos' in next) { custom = next.pos || null; delete next.pos; place(); }
        model = { ...model, ...next };
        // Keep open menus open across updates; drop levels that vanished.
        for (let level = 1; level < path.length; level++) {
          if (!(nodesAt(level - 1) || []).some((n) => n.key === path[level] && n.children)) { path.length = level; break; }
        }
        if (path[0] && path[0] !== 'people' && !model.cats.some((c) => c.key === path[0])) path = [];
        render();
      },
      toast,
      place,
    };
  };
})(globalThis);
