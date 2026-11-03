// Editor entry point: ties the sheet bridge, saved data and the sidebar UI.
(function (G) {
  'use strict';
  const C = G.R20C;
  if (window.top !== window || window.__r20Companion) return;
  window.__r20Companion = true;

  const store = (G.browser && browser.storage && browser.storage.local) || null;
  const get = async (k, d) => { try { const v = store ? (await store.get(k))[k] : undefined; return v === undefined ? d : v; } catch { return d; } };
  const set = (k, v) => { try { if (store) store.set({ [k]: v }); } catch { /* storage unavailable */ } };

  const snaps = new Map(); // charId -> snapshot (live or saved)
  let prefs = { autoHide: true, spend: true };
  let active = null;

  const ui = C.createUI({
    run: (act) => (active ? C.sheets.invoke(active, act, prefs) : { ok: false, msg: 'Choose a character first.' }),
    select: (id) => select(id, true),
    pref: (k, v) => { prefs = { ...prefs, [k]: v }; set('prefs', prefs); refresh(); },
    toggleHidden: (id) => { C.sheets.setHidden(id, !C.sheets.isHidden(id)); refresh(); },
    diag: async () => {
      const snap = active ? snaps.get(active) : null;
      const count = (k) => (snap && snap[k] ? snap[k].length : 0);
      const info = {
        companion: (G.browser && browser.runtime && browser.runtime.getManifest().version) || 'dev',
        userAgent: navigator.userAgent,
        active, live: !!(active && C.sheets.isLive(active)), open: C.sheets.isOpen(active),
        dialogs: document.querySelectorAll('.characterdialog[data-characterid]').length,
        sheetFrames: document.querySelectorAll('iframe[name^="iframe_"]').length,
        journal: C.sheets.journal().length,
        toolbar: !!document.getElementById('master-toolbar'),
        sheet: snap ? {
          type: snap.type, name: snap.name, stats: snap.stats,
          counts: Object.fromEntries(['attacks', 'actions', 'features', 'items', 'spells', 'abilities', 'checks', 'hitDice', 'rests'].map((k) => [k, count(k)])),
          privacy: snap.privacy, mode: snap.mode,
        } : null,
      };
      try { await navigator.clipboard.writeText(JSON.stringify(info, null, 2)); return true; } catch { return false; }
    },
  });

  function people() {
    const seen = new Set();
    const list = [];
    for (const j of C.sheets.journal()) {
      seen.add(j.id);
      list.push({ ...j, open: C.sheets.isOpen(j.id), hidden: C.sheets.isHidden(j.id), cached: snaps.has(j.id) });
    }
    // Open sheets the Journal does not list (rare) still appear.
    for (const [id, s] of snaps) {
      if (!seen.has(id) && C.sheets.isOpen(id)) list.push({ id, name: s.name, img: '', open: true, hidden: C.sheets.isHidden(id), cached: true });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  function refresh() {
    const snap = active ? snaps.get(active) : null;
    const j = active ? C.sheets.journal().find((x) => x.id === active) : null;
    ui.update({
      character: active ? { id: active, name: (snap && snap.name) || (j && j.name) || 'Character', img: (j && j.img) || '', stats: snap && snap.stats } : null,
      live: !!(active && C.sheets.isLive(active)),
      cats: C.buildMenus(snap, prefs),
      people: people(),
    });
  }

  async function select(id, openIfNeeded) {
    active = id;
    set('active', id);
    if (!snaps.has(id)) {
      const saved = await get('snap:' + id, null);
      if (saved) snaps.set(id, saved);
    }
    refresh();
    if (openIfNeeded && !snaps.has(id) && !C.sheets.isLive(id)) {
      ui.toast('Opening sheet…');
      const ok = await C.sheets.open(id);
      if (!ok) ui.toast('Could not open that sheet.', true);
      refresh();
    }
  }

  C.sheets.on('snapshot', (id, snap) => {
    snaps.set(id, snap);
    set('snap:' + id, snap);
    if (!active) select(id); else if (id === active) refresh();
  });
  C.sheets.on('dialogs', (ids, opened) => {
    // A sheet the user just opened becomes the active character.
    const fresh = opened.filter((id) => !C.sheets.isHidden(id));
    if (fresh.length) select(fresh[fresh.length - 1]); else refresh();
  });

  (async () => {
    prefs = { ...prefs, ...(await get('prefs', {})) };
    const last = await get('active', null);
    if (last) await select(last); else refresh();
    C.sheets.greetAll();
    ui.place();
  })();
})(globalThis);
