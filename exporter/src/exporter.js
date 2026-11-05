// Roll20embetterment Campaign Exporter: saves a whole Roll20 campaign as zip
// files for the Foundry importer (importer/r20prep.py + the Roll20 Campaign
// Import module). Opened from the add-on's toolbar button.
//
// 1. page.js (in Roll20's page) reads the campaign: pages, characters,
//    handouts, tables, decks, macros, jukebox, folders.
// 2. Characters on the 2024 sheet are opened hidden, one at a time, and read
//    with the add-on's sheet reader (their data isn't in Roll20's attributes).
// 3. Every image and audio file is downloaded once through background.js and
//    stored under assets/; campaign.json maps each URL to its file.
// 4. Output: "<campaign> - Foundry export part N.zip", each at most ~1 GB.
//    campaign.json is in the last part.
(function (G) {
  'use strict';
  const C = G.R20C;
  if (!C || window.top !== window) return;

  const PART_LIMIT = 1000 * 1024 * 1024;
  const PART_FILES = 60000;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- zip (stored, no compression: images and audio are compressed already) --
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  class ZipParts {
    constructor(base, onPart) { this.base = base; this.onPart = onPart; this.n = 0; this.reset(); }
    reset() { this.blobs = []; this.entries = []; this.pos = 0; }
    add(name, bytes) {
      if (this.entries.length && (this.pos + bytes.length > PART_LIMIT || this.entries.length >= PART_FILES)) this.flush();
      const nm = new TextEncoder().encode(name);
      const crc = crc32(bytes);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 33, true);
      h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, nm.length, true);
      this.blobs.push(new Blob([h.buffer, nm, bytes]));
      this.entries.push({ nm, crc, size: bytes.length, offset: this.pos });
      this.pos += 30 + nm.length + bytes.length;
    }
    flush() {
      if (!this.entries.length) return;
      const central = [];
      let csize = 0;
      for (const e of this.entries) {
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 33, true);
        c.setUint32(16, e.crc, true); c.setUint32(20, e.size, true); c.setUint32(24, e.size, true); c.setUint16(28, e.nm.length, true); c.setUint32(42, e.offset, true);
        central.push(c.buffer, e.nm);
        csize += 46 + e.nm.length;
      }
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, this.entries.length, true); end.setUint16(10, this.entries.length, true);
      end.setUint32(12, csize, true); end.setUint32(16, this.pos, true);
      this.n++;
      this.onPart(new Blob([...this.blobs, ...central, end.buffer], { type: 'application/zip' }), this.base + ' - Foundry export part ' + this.n + '.zip');
      this.reset();
    }
  }
  // Firefox saves through the add-on: no dialogs, into Downloads/Roll20 export/.
  // If that's refused, fall back to a normal page download.
  async function save(blob, name) {
    const r = await browser.runtime.sendMessage({ type: 'r20x-save', blob, name }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (r && r.ok) return r.path || name;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 120000);
    return name + ' (save dialog: ' + ((r && r.error) || 'download refused') + ')';
  }

  // ---- file types ------------------------------------------------------------------
  function sniff(b) {
    const s = (i, str) => [...str].every((ch, j) => b[i + j] === ch.charCodeAt(0));
    if (b[0] === 0x89 && s(1, 'PNG')) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (s(0, 'GIF8')) return 'gif';
    if (s(0, 'RIFF') && s(8, 'WEBP')) return 'webp';
    if (s(4, 'ftyp')) return 'mp4';
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
    if (s(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'mp3';
    if (s(0, 'OggS')) return 'ogg';
    const head = new TextDecoder().decode(b.slice(0, 256)).toLowerCase();
    if (head.includes('<svg')) return 'svg';
    return null;
  }
  // Roll20 image URLs end in original/max/med/thumb: try the most useful sizes.
  function variants(url, big) {
    // Roll20's old S3 addresses now answer 403; the same files live on files.d20.io.
    const u = url.replace(/^http:/, 'https:').replace(/^https:\/\/s3\.amazonaws\.com\/files\.d20\.io\//, 'https://files.d20.io/');
    const m = /\/(original|max|med|thumb)\.([a-z0-9]+)(\?.*)?$/i.exec(u);
    if (!m) return [u];
    const order = big ? ['original', 'max', 'med', 'thumb'] : ['max', 'original', 'med', 'thumb'];
    const at = u.length - m[0].length + 1;
    return order.map((sz) => u.slice(0, at) + sz + u.slice(at + m[1].length));
  }
  const fetchBytes = (url) => browser.runtime.sendMessage({ type: 'r20x-fetch', url });

  // ---- what to download ------------------------------------------------------------
  function assetsOf(c) {
    const want = new Map(); // url -> big?
    const add = (u, big = false) => { if (typeof u === 'string' && /^https?:\/\//.test(u)) want.set(u, want.get(u) || big); };
    const html = (s) => { for (const m of String(s || '').matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["']/gi)) add(m[1].replace(/&amp;/g, '&'), true); };
    for (const p of c.pages || []) for (const g of p.graphics || []) { add(g.imgsrc, g.layer === 'map'); for (const s of g.sides || []) add(s); }
    for (const ch of c.characters || []) {
      add(ch.avatar, true);
      const t = ch.defaulttoken || {};
      add(t.imgsrc);
      for (const s of t.sides || []) add(s);
      html(ch.bio); html(ch.gmnotes);
    }
    for (const h of c.handouts || []) { add(h.avatar, true); html(h.notes); html(h.gmnotes); }
    for (const t of c.tables || []) for (const it of t.items || []) add(it.avatar);
    for (const d of c.decks || []) { add(d.avatar); for (const card of d.cards || []) add(card.avatar); }
    return want;
  }
  function trackUrl(t, campaignId) {
    const id = String(t.track_id || '');
    if (!id) return '';
    if (t.source === 'My Audio') return 'https://app.roll20.net/audio_library/play/' + campaignId + '/' + id;
    if (t.source === 'Tabletop Audio') return 'https://s3.amazonaws.com/cdn.roll20.net/ttaudio/' + id.split('-')[0];
    if (t.source === 'Incompetech') return 'https://s3.amazonaws.com/cdn.roll20.net/incompetech/' + id.split('-')[0];
    return '';
  }
  const isClassic = (ch) => (ch.attributes || []).some((a) => /^(npc|charactersheet_type)$/.test(a.name) || /^repeating_(npcaction|inventory|attack|traits)_/.test(a.name));

  // ---- the panel ----------------------------------------------------------------------
  let panel = null;
  let running = false;
  let cancelled = false;
  function open() {
    if (panel) { panel.host.style.display = ''; return; }
    const host = document.createElement('div');
    host.id = 'r20x-panel';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      .p { position: fixed; z-index: 2147483030; left: 50%; top: 12vh; transform: translateX(-50%); width: min(520px, calc(100vw - 32px));
           background: #1d1f26; color: #e8e9ee; border: 1px solid #3d4250; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.5);
           font: 13px/1.4 system-ui, sans-serif; padding: 14px 16px; }
      h2 { margin: 0 0 6px; font-size: 15px; color: #d9a441; }
      p { margin: 4px 0 8px; color: #9aa0ae; }
      label { display: flex; gap: 8px; align-items: center; margin: 3px 0; }
      .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
      button { background: #272a33; color: #e8e9ee; border: 1px solid #3d4250; border-radius: 6px; padding: 5px 12px; cursor: pointer; font: inherit; }
      button.go { border-color: #d9a441; color: #d9a441; }
      button:disabled { opacity: .5; cursor: default; }
      progress { width: 100%; margin-top: 8px; }
      pre { height: 150px; overflow: auto; background: #272a33; border-radius: 6px; padding: 6px; margin: 8px 0 0; font-size: 12px; white-space: pre-wrap; }`;
    const p = document.createElement('div');
    p.className = 'p';
    const h = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
    const opt = (key, text, on) => { const l = h('label'); const c = h('input'); c.type = 'checkbox'; c.checked = on; c.dataset.k = key; l.append(c, document.createTextNode(text)); return l; };
    const go = h('button', 'Export');
    go.className = 'go';
    const close = h('button', 'Close');
    const bar = h('progress');
    bar.max = 1; bar.value = 0;
    const status = h('p', 'Ready.');
    const log = h('pre');
    p.append(h('h2', 'Export campaign for Foundry'),
      h('p', 'Saves this whole campaign as zip files for the Foundry importer. Large campaigns take a while; keep this tab open. Firefox may ask where to save each part.'),
      opt('assets', 'Images and audio', true),
      opt('sheets', 'Read 2024-sheet characters (opens each sheet hidden; slower)', true),
      bar, status, log, (() => { const r = h('div'); r.className = 'row'; r.append(close, go); return r; })());
    root.append(style, p);
    document.documentElement.appendChild(host);
    for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, (e) => e.stopPropagation());
    const say = (t) => { log.textContent += t + '\n'; log.scrollTop = log.scrollHeight; };
    const set = (text, done, total) => { status.textContent = text + (total ? ` (${done}/${total})` : ''); bar.max = total || 1; bar.value = total ? done : 0; };
    close.addEventListener('click', () => { if (running) { cancelled = true; say('Stopping…'); } else host.style.display = 'none'; });
    go.addEventListener('click', async () => {
      if (running) return;
      running = true; cancelled = false; go.disabled = true; close.textContent = 'Stop';
      const opts = Object.fromEntries([...root.querySelectorAll('[data-k]')].map((c) => [c.dataset.k, c.checked]));
      try { await run(opts, say, set); } catch (e) { say('Stopped: ' + ((e && e.message) || e)); set('Stopped.'); console.error('[Roll20embetterment export]', e); }
      running = false; go.disabled = false; close.textContent = 'Close';
    });
    panel = { host };
  }

  // ---- steps ------------------------------------------------------------------------------
  function collect(set) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const off = () => { for (const [t, f] of handlers) document.removeEventListener(t, f); };
      const handlers = [
        ['r20x-progress', (e) => { const d = JSON.parse(e.detail); set(d.text, d.done, d.total); }],
        ['r20x-error', (e) => { off(); reject(new Error(JSON.parse(e.detail).message)); }],
        ['r20x-chunk', (e) => {
          const d = JSON.parse(e.detail);
          chunks[d.i] = d.s;
          if (chunks.filter((x) => x !== undefined).length === d.n) { off(); try { resolve(JSON.parse(chunks.join(''))); } catch (err) { reject(err); } }
        }],
      ];
      for (const [t, f] of handlers) document.addEventListener(t, f);
      document.dispatchEvent(new CustomEvent('r20x-collect'));
    });
  }

  const pendingSnaps = new Map();
  const pendingInfo = new Map();
  if (C.sheets) C.sheets.on('description', (id, info) => { const r = pendingInfo.get(id); if (r) { pendingInfo.delete(id); r(info); } });
  // Ask a sheet frame to describe itself (for the log when it can't be read).
  function describeSheet(id) {
    return new Promise((resolve) => {
      pendingInfo.set(id, resolve);
      try { C.sheets.describe(id); } catch { /* frame gone */ }
      setTimeout(() => { if (pendingInfo.get(id) === resolve) { pendingInfo.delete(id); resolve(null); } }, 4000);
    });
  }
  if (C.sheets) C.sheets.on('snapshot', (id, snap) => { const r = pendingSnaps.get(id); if (r) { pendingSnaps.delete(id); r(snap); } });
  // Returns { snap } or { reason } saying which step failed.
  async function readSheet(ch) {
    const id = ch.id;
    if (ch.archived) return { reason: 'archived in Roll20 (unarchive it to have its sheet read)' };
    const inJournal = !!document.querySelector('#journalfolderroot li.journalitem[data-itemid="' + CSS.escape(id) + '"]');
    const wasOpen = C.sheets.isOpen(id);
    if (!inJournal && !wasOpen) return { reason: 'not in the Journal, so its sheet can\'t be opened' };
    const got = new Promise((resolve) => { pendingSnaps.set(id, resolve); setTimeout(() => { if (pendingSnaps.get(id) === resolve) { pendingSnaps.delete(id); resolve(null); } }, 30000); });
    const opened = await C.sheets.open(id, { hidden: true });
    if (!opened) {
      pendingSnaps.delete(id);
      const open = C.sheets.isOpen(id);
      C.sheets.closeOwned(id);
      return { reason: !open ? 'its sheet window didn\'t open from the Journal'
        : wasOpen ? 'its sheet was already open in a way the exporter can\'t read: close that sheet window and export again'
          : 'its sheet window opened, but the sheet inside never finished loading' };
    }
    // An already-open sheet won't send a new reading by itself: ask for one.
    for (let t = 0; t < 12 && pendingSnaps.has(id); t++) { try { C.sheets.refresh(id); } catch { /* not ready yet */ } await wait(2000); }
    const snap = await got;
    let info = null;
    if (!snap) info = await describeSheet(id);
    C.sheets.closeOwned(id);
    if (snap) return { snap: { ...snap, name: snap.name || ch.name } };
    return { reason: 'its sheet loaded, but the exporter couldn\'t read it. Sheet details: ' + (info ? JSON.stringify(info) : 'no answer') };
  }

  // Ask the page for one character's attributes and abilities.
  let reqN = 0;
  function sheetData(id) {
    return new Promise((resolve) => {
      const req = ++reqN;
      const on = (e) => { const d = JSON.parse(e.detail); if (d.req !== req) return; document.removeEventListener('r20x-sheetdata', on); resolve(d); };
      document.addEventListener('r20x-sheetdata', on);
      document.dispatchEvent(new CustomEvent('r20x-sheetdata', { detail: JSON.stringify({ id, req }) }));
      setTimeout(() => { document.removeEventListener('r20x-sheetdata', on); resolve({ attributes: [], abilities: [] }); }, 5000);
    });
  }
  // Roll20 loads a character's attributes only when its sheet opens: open
  // each sheet that came back empty (hidden), wait for them, close it.
  async function loadBlankSheets(camp, say, set) {
    const blank = camp.characters.filter((ch) => !(ch.attributes || []).length);
    if (!blank.length) return;
    say(`Opening ${blank.length} sheets Roll20 hasn't loaded yet (a few seconds each)…`);
    const empty = [];
    const skipped = [];
    for (const [i, ch] of blank.entries()) {
      if (cancelled) throw new Error('Stopped.');
      set('Loading sheet: ' + ch.name, i, blank.length);
      const inJournal = !!document.querySelector('#journalfolderroot li.journalitem[data-itemid="' + CSS.escape(ch.id) + '"]');
      if (ch.archived || !inJournal) { skipped.push(ch.name + (ch.archived ? ' (archived)' : ' (not in the Journal)')); continue; }
      const wasOpen = C.sheets.isOpen(ch.id);
      // Don't wait for the whole sheet to draw: only for its attributes.
      C.sheets.open(ch.id, { hidden: true }).catch(() => {});
      let d = { attributes: [], abilities: [] };
      let last = -1;
      // Wait until the attributes stop arriving (or 15 s with none).
      for (let t = 0; t < 30; t++) {
        d = await sheetData(ch.id);
        const n = d.attributes.length;
        if (n && n === last) break;
        last = n;
        await wait(500);
      }
      if (!wasOpen) {
        // The window may still be appearing: close it once it has.
        for (let t = 0; t < 10 && !C.sheets.closeOwned(ch.id); t++) await wait(300);
      }
      if (d.attributes.length) { ch.attributes = d.attributes; ch.abilities = d.abilities.length ? d.abilities : ch.abilities; } else empty.push(ch.name);
      await wait(300);
    }
    say(`  loaded ${blank.length - empty.length - skipped.length} of ${blank.length}.`);
    if (empty.length) say(`  empty sheets in Roll20 (nothing to export): ${empty.join(', ')}.`);
    if (skipped.length) say(`  not opened: ${skipped.join(', ')}. Unarchive them or put them in the Journal to include their sheets.`);
  }

  async function run(opts, say, set) {
    const isGM = !!document.getElementById('layers-label') || !!(G.wrappedJSObject && G.wrappedJSObject.is_gm);
    if (!isGM) say('Note: you are not the GM here, so GM-only things (GM layer, GM notes, hidden handouts) will be missing.');
    say('Reading the campaign…');
    const camp = await collect(set);
    const title = (camp.campaign_title || 'Roll20 campaign').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Roll20 campaign';
    say(`${camp.pages.length} pages, ${camp.characters.length} characters, ${camp.handouts.length} handouts, ${(camp.tables || []).length} tables, ${(camp.jukebox || []).length} tracks.`);
    const blank = camp.characters.filter((ch) => !(ch.attributes || []).length);
    say(`  sheet data for ${camp.characters.length - blank.length} of ${camp.characters.length} characters` + (blank.length ? ` (no sheet data saved in Roll20 for: ${blank.slice(0, 12).map((ch) => ch.name).join(', ')}${blank.length > 12 ? ', …' : ''})` : '') + '.');

    if (opts.sheets && C.sheets) await loadBlankSheets(camp, say, set);
    if (opts.sheets && C.sheets) {
      const todo = camp.characters.filter((ch) => !isClassic(ch) && (ch.attributes || []).length >= 5);
      say(`Reading ${todo.length} characters on the 2024 sheet…`);
      let got = 0;
      for (const [i, ch] of todo.entries()) {
        if (cancelled) throw new Error('Stopped.');
        set('Reading 2024 sheets: ' + ch.name, i, todo.length);
        try {
          const r = await readSheet(ch);
          if (r.snap) { ch.r20e_snapshot = r.snap; got++; } else say('  could not read ' + ch.name + ': ' + r.reason);
        } catch (e) { say('  could not read ' + ch.name + ': ' + ((e && e.message) || e)); }
        await wait(1000); // let Roll20 finish closing the window before the next
      }
      say(`  read ${got} of ${todo.length}. The rest still export their saved data (name, art, bio, attributes).`);
    }

    let parts = 0;
    // Each export gets its own date and time, so two exports never mix.
    const d = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`;
    const base = title + ' ' + stamp;
    const saving = [];
    const zip = new ZipParts(base, (blob, name) => {
      parts++;
      say('Saving ' + name + ' (' + Math.round(blob.size / 1048576) + ' MB)…');
      // One at a time: wait for the previous part before handing over the next.
      const prev = saving[saving.length - 1] || Promise.resolve();
      saving.push(prev.then(() => save(blob, name)).then((where) => say('  saved ' + where)));
    });
    camp.r20e.assets = {};
    camp.r20e.tracks = {};
    camp.r20e.failed = [];
    // Audio saved by Firefox itself, in a folder beside the zips.
    const audioFolder = base + ' - audio';
    camp.r20e.audioFolder = audioFolder;
    camp.r20e.audioFiles = {};
    let audioSaved = 0;
    if (opts.assets) {
      const want = [...assetsOf(camp)].map(([url, big]) => ({ url, big }));
      for (const t of camp.jukebox || []) { const u = trackUrl(t, camp.campaign_id); if (u) want.push({ url: u, track: t.id }); }
      say(`Downloading ${want.length} images and audio files…`);
      let n = 0;
      let done = 0;
      const byVariant = new Map(); // a URL actually downloaded -> its saved file
      const busy = new Map(); // the same, while still downloading
      const next = () => want.shift();
      const worker = async () => {
        for (let item = next(); item; item = next()) {
          if (cancelled) return;
          let saved = '';
          let why = '';
          for (const u of variants(item.url, item.big)) {
            if (busy.has(u)) await busy.get(u);
            if (byVariant.has(u)) { saved = byVariant.get(u); if (saved) break; continue; }
            let release;
            busy.set(u, new Promise((r) => { release = r; }));
            const r = await fetchBytes(u).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
            if (r && !r.ok) why = r.status ? 'HTTP ' + r.status : r.error || 'failed';
            const bytes = r && r.ok && r.buf ? new Uint8Array(r.buf) : null;
            const ext = bytes && (sniff(bytes) || (item.track ? 'mp3' : null));
            if (ext) {
              saved = 'assets/' + String(++n).padStart(5, '0') + '.' + ext;
              zip.add(saved, bytes);
            }
            byVariant.set(u, saved);
            busy.delete(u);
            release();
            if (saved) break;
          }
          // Uploaded audio the add-on can't fetch: let Firefox download it.
          if (!saved && item.track && /^https:\/\/app\.roll20\.net\//.test(item.url)) {
            const file = item.track.replace(/[^A-Za-z0-9_-]+/g, '_') + '.audio';
            const r = await browser.runtime.sendMessage({ type: 'r20x-download', url: item.url.replace(/#.*$/, ''), filename: audioFolder + '/' + file }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
            if (r && r.ok) { camp.r20e.audioFiles[item.track] = file; audioSaved++; done++; set('Downloading files', done, done + want.length); continue; }
            why = (r && r.error) || why;
          }
          if (saved) { if (item.track) camp.r20e.tracks[item.track] = saved; else camp.r20e.assets[item.url] = saved; }
          else {
            camp.r20e.failed.push(item.url);
            if (camp.r20e.failed.length <= 5) say('  could not download ' + item.url.slice(0, 120) + ' (' + (why || 'not an image') + ')');
          }
          done++;
          set('Downloading files', done, done + want.length);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      if (cancelled) throw new Error('Stopped.');
      if (audioSaved) say(`  saved ${audioSaved} uploaded audio tracks to the folder "Roll20 export/${audioFolder}".`);
      say(`  saved ${n} files${camp.r20e.failed.length ? `, ${camp.r20e.failed.length} could not be downloaded (the prep script will retry them)` : ''}.`);
    }
    set('Writing campaign.json', 1, 1);
    zip.add('campaign.json', new TextEncoder().encode(JSON.stringify(camp)));
    zip.flush();
    set('Saving zip files', 1, 1);
    await Promise.all(saving);
    set(`Done: ${parts} zip file${parts === 1 ? '' : 's'}.`, 1, 1);
    say(`Done: ${parts} file${parts === 1 ? '' : 's'} named "${base} - Foundry export part N.zip", in Downloads/Roll20 export.\nCopy all ${parts === 1 ? 'of it' : parts + ' together'}${Object.keys(camp.r20e.audioFiles || {}).length ? ` and the folder "${audioFolder}"` : ''} to the same place on the Foundry server and run:\n  sudo python3 r20prep.py "${base} - Foundry export part 1.zip"\n(it finds the other parts next to it).`);
  }

  C.exporter = { open };
  // The toolbar button (background.js) asks this tab to open the window.
  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'r20x-open') { open(); return Promise.resolve(true); }
    return undefined;
  });
})(globalThis);
