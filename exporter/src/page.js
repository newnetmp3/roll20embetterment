// Campaign exporter, page side. Runs in Roll20's own page (MAIN world) because
// the campaign lives in Roll20's window.Campaign models. It only reads: it
// asks Roll20 to load archived pages and the text "blobs" (bios, notes,
// default tokens) the same way Roll20's own editor does, then hands the
// whole campaign to the extension as JSON over DOM events.
(function () {
  'use strict';
  if (window.top !== window || window.__r20xCollector) return;
  window.__r20xCollector = true;

  const send = (type, data) => document.dispatchEvent(new CustomEvent('r20x-' + type, { detail: JSON.stringify(data) }));
  const progress = (text, done, total) => send('progress', { text, done, total });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const parse = (s, fallback) => { try { return typeof s === 'string' ? (s ? JSON.parse(s) : fallback) : s ?? fallback; } catch { return fallback; } };
  const split = (s) => (Array.isArray(s) ? s : String(s || '').split(',')).map((x) => x.trim()).filter(Boolean);
  const sides = (s) => (Array.isArray(s) ? s : String(s || '').split('|')).map((x) => { try { return decodeURIComponent(x); } catch { return x; } }).filter(Boolean);
  const json = (m) => { try { return m && typeof m.toJSON === 'function' ? m.toJSON() : {}; } catch { return {}; } };
  const list = (c) => { try { return c && typeof c.toJSON === 'function' ? c.toJSON() : []; } catch { return []; } };

  // Roll20 keeps long texts out of the models; fetch them like the editor does.
  function blob(model, key) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      try { model._getLatestBlob(key, (v) => finish(v == null ? '' : v)); } catch { finish(''); }
      setTimeout(() => finish(''), 20000);
    });
  }
  const unescapeText = (s) => { try { return unescape(String(s || '')); } catch { return String(s || ''); } };

  async function loadEverything(C) {
    const pages = C.pages.models;
    const archived = pages.filter((p) => !p.fullyLoaded);
    for (const [i, p] of archived.entries()) {
      progress('Loading archived pages', i, archived.length);
      try { p.fullyLoadPage(); } catch { /* keep going */ }
      for (let t = 0; t < 50 && !p.fullyLoaded; t++) await wait(100);
    }
    // Character attributes arrive in the background; wait until they settle.
    let last = -1;
    let still = 0;
    for (let t = 0; t < 60 && still < 3; t++) {
      const n = C.characters.models.reduce((s, c) => s + (c.attribs ? c.attribs.length : 0), 0);
      progress('Loading character sheets', C.characters.models.filter((c) => c.attribs && c.attribs.length).length, C.characters.models.length);
      still = n === last ? still + 1 : 0;
      last = n;
      await wait(1000);
    }
  }

  async function collect() {
    const C = window.Campaign;
    if (!C || !C.pages) throw new Error('The Roll20 campaign has not finished loading.');
    await loadEverything(C);
    const out = json(C);
    out.R20Exporter_format = '1.0';
    out.r20e = { format: 1, exported: new Date().toISOString(), exporter: 'Roll20embetterment' };
    out.campaign_title = String(document.title || '').split('|')[0].trim();
    out.campaign_id = window.campaign_id;

    out.pages = C.pages.models.map((p, i) => {
      progress('Reading pages', i, C.pages.models.length);
      const d = json(p);
      d.zorder = String(d.zorder || '').split(',').filter(Boolean);
      d.graphics = list(p.thegraphics).map((g) => (g.sides ? { ...g, sides: sides(g.sides) } : g));
      d.texts = list(p.thetexts);
      d.paths = list(p.thepaths).map((x) => ({ ...x, path: parse(x.path, x.path) }));
      // Anything else Roll20 keeps on a page (doors, windows, newer paths...).
      for (const k of Object.keys(p)) {
        if (!/^the/.test(k) || ['thegraphics', 'thetexts', 'thepaths'].includes(k)) continue;
        if (p[k] && typeof p[k].toJSON === 'function' && Array.isArray(p[k].models)) d[k.slice(3)] = list(p[k]);
      }
      return d;
    });

    const chars = C.characters.models;
    out.characters = [];
    for (const [i, c] of chars.entries()) {
      progress('Reading characters', i, chars.length);
      const d = json(c);
      d.attributes = list(c.attribs);
      d.abilities = list(c.abilities);
      d.controlledby = split(d.controlledby);
      d.inplayerjournals = split(d.inplayerjournals);
      if (d.bio) d.bio = unescapeText(await blob(c, 'bio'));
      if (d.gmnotes) d.gmnotes = unescapeText(await blob(c, 'gmnotes'));
      if (d.defaulttoken) {
        d.defaulttoken = parse(await blob(c, 'defaulttoken'), {});
        if (d.defaulttoken && d.defaulttoken.sides) d.defaulttoken.sides = sides(d.defaulttoken.sides);
      }
      out.characters.push(d);
    }

    const handouts = C.handouts.models;
    out.handouts = [];
    for (const [i, h] of handouts.entries()) {
      progress('Reading handouts', i, handouts.length);
      const d = json(h);
      d.inplayerjournals = split(d.inplayerjournals);
      d.controlledby = split(d.controlledby);
      if (d.notes) d.notes = unescapeText(await blob(h, 'notes'));
      if (d.gmnotes) d.gmnotes = unescapeText(await blob(h, 'gmnotes'));
      out.handouts.push(d);
    }

    out.players = C.players.models.map(json);
    out.macros = [];
    for (const p of C.players.models) for (const m of list(p.macros)) out.macros.push({ ...m, player_id: p.id });
    out.decks = (C.decks ? C.decks.models : []).map((d) => ({ ...json(d), cards: list(d.cards) }));
    out.tables = (C.rollabletables ? C.rollabletables.models : []).map((t) => ({ ...json(t), items: list(t.tableitems) }));
    out.jukebox = window.Jukebox && window.Jukebox.playlist ? list(window.Jukebox.playlist) : [];
    out.jukeboxfolder = parse(out.jukeboxfolder, []);
    out.journalfolder = parse(out.journalfolder, []);
    out.turnorder = parse(out.turnorder, []);
    // Things not filed in a folder still belong in the tree.
    const ids = (tree, acc = new Set()) => { for (const e of tree || []) { if (typeof e === 'string') acc.add(e); else ids(e.i, acc); } return acc; };
    const inJournal = ids(out.journalfolder);
    for (const x of [...out.handouts, ...out.characters]) if (!inJournal.has(x.id)) out.journalfolder.push(x.id);
    const inJukebox = ids(out.jukeboxfolder);
    for (const t of out.jukebox) if (!inJukebox.has(t.id)) out.jukeboxfolder.push(t.id);

    progress('Packing campaign data', 1, 1);
    const text = JSON.stringify(out);
    const size = 4 * 1024 * 1024;
    const n = Math.ceil(text.length / size);
    for (let i = 0; i < n; i++) send('chunk', { i, n, s: text.slice(i * size, (i + 1) * size) });
  }

  document.addEventListener('r20x-collect', () => {
    collect().catch((e) => send('error', { message: String((e && e.message) || e) }));
  });
})();
