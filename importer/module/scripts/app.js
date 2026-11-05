// Roll20 Campaign Import: the importer window and the steps that create
// Foundry documents from a campaign unpacked by r20prep.py.
import { auditCharacter, KIND_LABEL } from './audit.js';
import { convertCharacter, convertPage, convertHandout, convertTable, relinkHTML, tokenSettings, listOf } from './convert.js';

const MOD = 'r20import';
const BASE = 'r20import';
const OWN = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 };

Hooks.once('ready', () => {
  const mod = game.modules.get(MOD);
  const say = (m) => { console.log('[r20import]', m); };
  if (mod) mod.api = {
    open: () => new ImportApp().render(true),
    linkSpeciesTraits: () => linkSpeciesTraits((m) => { say(m); ui.notifications.info(m); }),
    // Compare player characters with Roll20; { fix: true } also applies the fixes.
    audit: (opts = {}) => runAudit(opts, say),
  };
});
Hooks.once('init', () => {
  game.settings.registerMenu(MOD, 'open', {
    name: 'Roll20 Campaign Import', label: 'Open importer', icon: 'fa-solid fa-file-import',
    hint: 'Import a Roll20 campaign that r20prep.py unpacked into Data/r20import.',
    type: ImportApp, restricted: true,
  });
});

// Path of an unpacked file as Foundry stores it (relative to Data, URL-encoded).
const enc = (p) => String(p).split('/').map(encodeURIComponent).join('/');

class ImportApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'r20import-app', tag: 'div', classes: ['r20import'],
    window: { title: 'Roll20 Campaign Import', resizable: true, icon: 'fa-solid fa-file-import' },
    position: { width: 620, height: 'auto' },
  };

  campaigns = null;
  chosen = null;
  index = null;
  running = false;

  async _renderHTML() {
    if (!this.campaigns) this.campaigns = await findCampaigns();
    if (!this.chosen && this.campaigns.length) await this.choose(this.campaigns[0]);
    const root = document.createElement('div');
    root.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:8px;';
    const h = (tag, text, css) => { const e = document.createElement(tag); if (text) e.textContent = text; if (css) e.style.cssText = css; return e; };
    if (!game.user.isGM) { root.append(h('p', 'Only a GM can import.')); return root; }
    if (!this.campaigns.length) {
      root.append(h('p', 'No unpacked campaigns found in Data/r20import. Run r20prep.py on the server first.'));
      return root;
    }
    // Campaign
    const sel = h('select'); for (const c of this.campaigns) { const o = h('option', c); o.value = c; o.selected = c === this.chosen; sel.append(o); }
    sel.addEventListener('change', async () => { await this.choose(sel.value); this.render(); });
    root.append(row(h('label', 'Campaign'), sel));
    if (this.index) {
      const c = this.index.counts || {};
      root.append(h('p', `${this.index.title}: ${c.characters || 0} characters, ${c.handouts || 0} handouts, ${c.pages || 0} pages, ${c.tables || 0} roll tables, ${c.macros || 0} macros, ${c.jukebox || 0} audio tracks.`, 'margin:0;color:var(--color-text-secondary, #777)'));
    }
    // Players -> users
    const players = (this.index && this.index.players) || [];
    if (players.length) {
      root.append(h('h3', 'Roll20 players → Foundry users', 'margin:6px 0 0'));
      for (const p of players) {
        const s = h('select'); s.dataset.player = p.id;
        const none = h('option', '(nobody)'); none.value = ''; s.append(none);
        for (const u of game.users) {
          const o = h('option', u.name + (u.isGM ? ' (GM)' : '')); o.value = u.id;
          if (u.name.toLowerCase() === String(p.name).toLowerCase()) o.selected = true;
          s.append(o);
        }
        root.append(row(h('label', p.name), s));
      }
    }
    // What to import
    root.append(h('h3', 'Import', 'margin:6px 0 0'));
    const opts = [
      ['actors', 'Characters & NPCs', true], ['journal', 'Handouts (journal)', true], ['scenes', 'Pages (scenes, tokens, walls, drawings)', true],
      ['tables', 'Roll tables', true], ['macros', 'Macros (kept as Roll20 text)', true], ['playlists', 'Jukebox (playlists)', true],
      ['compendium', 'Use dnd5e compendium spells, items, classes when names match', true],
      ['skipExisting', 'Skip things already imported (safe to run again)', true],
      ['replaceScenes', 'Replace scenes already imported (redo maps)', false],
    ];
    const box = h('div', '', 'display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;');
    for (const [k, label, def] of opts) {
      const l = h('label', '', 'display:flex;gap:6px;align-items:center;');
      const c = h('input'); c.type = 'checkbox'; c.checked = def; c.dataset.opt = k;
      l.append(c, document.createTextNode(label)); box.append(l);
    }
    root.append(box);
    const bar = h('progress', '', 'width:100%;'); bar.max = 100; bar.value = 0;
    const log = h('pre', '', 'height:180px;overflow:auto;margin:0;padding:6px;font-size:12px;white-space:pre-wrap;background:rgba(0,0,0,.08);border-radius:4px;');
    const go = h('button', 'Import'); go.type = 'button';
    go.addEventListener('click', async () => {
      if (this.running) return;
      this.running = true; go.disabled = true;
      const options = Object.fromEntries([...root.querySelectorAll('[data-opt]')].map((c) => [c.dataset.opt, c.checked]));
      const users = Object.fromEntries([...root.querySelectorAll('[data-player]')].map((s) => [s.dataset.player, s.value]).filter(([, v]) => v));
      const say = (t) => { log.textContent += t + '\n'; log.scrollTop = log.scrollHeight; console.log('[r20import]', t); };
      try {
        await runImport(this.chosen, this.index, options, users, say, (p) => { bar.value = p; });
        say('Done.'); ui.notifications.info('Roll20 import finished.');
      } catch (e) {
        console.error(e); say('Stopped: ' + (e && e.message || e)); ui.notifications.error('Roll20 import stopped: ' + (e && e.message || e));
      } finally { this.running = false; go.disabled = false; }
    });
    const check = h('button', 'Check characters against Roll20'); check.type = 'button';
    const fixAll = h('button', 'Fix characters to match Roll20'); fixAll.type = 'button';
    const audit = async (fix) => {
      if (this.running) return;
      if (fix && !(await foundry.applications.api.DialogV2.confirm({ window: { title: 'Fix characters' }, content: '<p>Add what is missing, use the Roll20 text where the DM changed it, and set ability scores, HP, AC, speeds and proficiencies to the Roll20 values, on every imported player character?</p><p>Things only in Foundry are left alone.</p>' }))) return;
      this.running = true; go.disabled = check.disabled = fixAll.disabled = true;
      const say = (t) => { log.textContent += t + '\n'; log.scrollTop = log.scrollHeight; console.log('[r20import]', t); };
      try { await runAudit({ fix, campaign: this.chosen }, say); }
      catch (e) { console.error(e); say('Stopped: ' + (e && e.message || e)); }
      finally { this.running = false; go.disabled = check.disabled = fixAll.disabled = false; }
    };
    check.addEventListener('click', () => audit(false));
    fixAll.addEventListener('click', () => audit(true));
    root.append(go, bar, row(check, fixAll), log);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  async choose(name) {
    this.chosen = name;
    this.index = await fetchJSON(BASE + '/' + enc(name) + '/index.json').catch(() => null);
  }
}

function row(a, b) {
  const d = document.createElement('div');
  d.style.cssText = 'display:grid;grid-template-columns:200px 1fr;gap:8px;align-items:center;';
  d.append(a, b);
  return d;
}
async function fetchJSON(path) {
  const r = await fetch(foundry.utils.getRoute(path));
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r.json();
}
async function findCampaigns() {
  try {
    const FP = foundry.applications.apps.FilePicker.implementation;
    const res = await FP.browse('data', BASE);
    return (res.dirs || []).map((d) => decodeURIComponent(d.split('/').pop())).sort();
  } catch { return []; }
}

// Custom species in the Items sidebar keep their trait items in the same folder.
// dnd5e only hands traits to a character through an Item Grant advancement, so
// add one listing those traits (dropping the species then adds them).
async function linkSpeciesTraits(say) {
  let n = 0;
  for (const race of game.items.filter((i) => i.type === 'race' && i.getFlag(MOD, 'libraryKey'))) {
    const adv = race.system.advancement;
    const list = Array.isArray(adv) ? adv : Object.values(adv?.contents ?? adv ?? {});
    if (list.some((a) => a.type === 'ItemGrant')) continue;
    const traits = game.items.filter((i) => i.type === 'feat' && i.folder && race.folder && i.folder.id === race.folder.id);
    if (!traits.length) continue;
    await race.createAdvancement('ItemGrant', {
      title: 'Species Traits', level: 0,
      configuration: { items: traits.map((t) => ({ uuid: t.uuid, optional: false })) },
    }, { showConfig: false });
    n++;
  }
  if (n) say(`  Linked traits to ${n} custom species (drop one on a character to add its traits).`);
}

// ---- audit: imported player characters vs their Roll20 data ---------------------
async function runAudit({ fix = false, campaign: name } = {}, say) {
  const pcs = game.actors.filter((a) => a.type === 'character' && a.getFlag(MOD, 'id'));
  if (!pcs.length) { say('No imported player characters found.'); return; }
  // The unpacked campaign these actors came from.
  const names = name ? [name, ...(await findCampaigns()).filter((c) => c !== name)] : await findCampaigns();
  let index = null;
  for (const n of names) {
    const idx = await fetchJSON(BASE + '/' + enc(n) + '/index.json').catch(() => null);
    if (idx && pcs.some((a) => idx.characters?.[a.getFlag(MOD, 'id')] !== undefined)) { index = idx; name = n; break; }
    if (idx && !index) { index = idx; name = n; }
  }
  if (!index) { say('No unpacked campaign found in Data/r20import.'); return; }
  say(`Reading ${name}/campaign.json…`);
  const campaign = await fetchJSON(BASE + '/' + enc(name) + '/campaign.json');
  const byId = new Map((campaign.characters || []).map((c) => [c.id, c]));
  const lookup = await compendiumLookup(true, say);
  const results = [];
  let fixed = 0;
  for (const actor of pcs) {
    const ch = byId.get(actor.getFlag(MOD, 'id'));
    if (!ch) continue;
    try {
      const conv = convertCharacter(ch);
      if (conv.isNpc || conv.empty) continue;
      const resolved = [];
      for (const l of conv.lookups) resolved.push(await lookup(l));
      const items = actor.items.map((i) => ({ id: i.id, name: i.name, type: i.type, desc: i.system.description?.value || '', levels: i.system.levels }));
      const { sheet, findings } = auditCharacter(ch, resolved, { system: actor.toObject().system, items }, conv);
      results.push({ actor, sheet, findings, attribs: (ch.attributes || ch.attribs || []).length });
      say(`${actor.name}: ${findings.filter((f) => f.fix).length} to fix, ${findings.filter((f) => !f.fix).length} notes.`);
      if (fix) fixed += await applyFixes(actor, findings, say);
    } catch (e) { console.error(e); say(`  ! ${actor.name}: ${e.message || e}`); }
  }
  // Report as a journal entry.
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const order = ['missing', 'changed', 'text', 'stat', 'custom', 'cut', 'extra'];
  let html = `<p>${results.length} player characters compared with <strong>${esc(name)}</strong> on ${new Date().toLocaleString()}.${fix ? ` ${fixed} fixes applied.` : ' Nothing was changed: use “Fix characters to match Roll20” to apply.'}</p>`;
  const cutAny = results.some((r) => r.findings.some((f) => f.kind === 'cut'));
  if (cutAny) html += '<p><strong>Some 2024-sheet descriptions were cut at 600 characters in this export.</strong> Export again with Roll20embetterment Campaign Exporter 1.0.5 or later for the full text, run r20prep.py, then run this check with fixes.</p>';
  for (const r of results) {
    html += `<h2>${esc(r.actor.name)}</h2><p><em>${r.sheet === '2024' ? '2024 sheet' : r.sheet === 'classic' ? 'Classic 5e sheet' : 'Sheet not read'}${r.sheet === '2024' ? `; Roll20 kept ${r.attribs} attributes for it` : ''}</em></p>`;
    if (!r.findings.length) { html += '<p>Matches Roll20.</p>'; continue; }
    for (const kind of order) {
      const list = r.findings.filter((f) => f.kind === kind);
      if (!list.length) continue;
      html += `<h3>${KIND_LABEL[kind]} (${list.length})</h3><ul>` + list.map((f) => `<li><strong>${esc(f.name)}</strong>: ${esc(f.detail)}${f.r20 ? `<br><small>Roll20: ${esc(f.r20)}…</small>` : ''}</li>`).join('') + '</ul>';
    }
  }
  const title = 'Roll20 character check' + (fix ? ' (fixed)' : '');
  const entry = await JournalEntry.create({ name: title + ' ' + new Date().toISOString().slice(0, 16).replace('T', ' '), pages: [{ name: 'Report', type: 'text', text: { content: html } }] });
  say(`Report saved to the Journal: “${entry.name}”.`);
  entry.sheet.render(true);
}

async function applyFixes(actor, findings, say) {
  const strip = (d) => { const c = foundry.utils.deepClone(d); delete c._id; return c; };
  const add = findings.filter((f) => f.fix?.op === 'add').map((f) => strip(f.fix.data));
  const itemUpdates = [];
  for (const f of findings) {
    if (f.fix?.op === 'desc') itemUpdates.push({ _id: f.fix.id, 'system.description.value': f.fix.html });
    if (f.fix?.op === 'item') itemUpdates.push({ _id: f.fix.id, ...f.fix.update });
  }
  const sets = Object.fromEntries(findings.filter((f) => f.fix?.op === 'set').map((f) => [f.fix.path, f.fix.value]));
  if (add.length) await actor.createEmbeddedDocuments('Item', add);
  if (itemUpdates.length) await actor.updateEmbeddedDocuments('Item', itemUpdates);
  if (Object.keys(sets).length) await actor.update(sets);
  const n = add.length + itemUpdates.length + Object.keys(sets).length;
  if (n) say(`  fixed ${n} on ${actor.name}`);
  return n;
}

// Finds dnd5e compendium items by kind and name; anything not found uses the
// lookup's Roll20 version.
async function compendiumLookup(enabled, say) {
  const packIndex = new Map(); // "kind|name" -> uuid
  const docCache = new Map();
  if (enabled) {
    say('Indexing dnd5e compendiums…');
    const kinds = { spell: ['spell'], gear: ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container'], class: ['class'], subclass: ['subclass'], race: ['race'], background: ['background'] };
    const packs = game.packs.filter((p) => p.documentName === 'Item');
    const rank = (p) => (p.collection.startsWith('dnd5e.') ? (/24$/.test(p.collection) ? 0 : 2) : 1);
    packs.sort((a, b) => rank(a) - rank(b));
    for (const p of packs) {
      const idx = await p.getIndex({ fields: ['type'] });
      for (const e of idx) {
        for (const [kind, types] of Object.entries(kinds)) {
          if (!types.includes(e.type)) continue;
          const key = kind + '|' + normName(e.name);
          if (!packIndex.has(key)) packIndex.set(key, e.uuid);
        }
      }
    }
    say(`  ${packIndex.size} compendium entries.`);
  }
  return async function lookup(l) {
    const uuid = packIndex.get(l.kind + '|' + normName(l.name));
    if (uuid) {
      if (!docCache.has(uuid)) docCache.set(uuid, (await fromUuid(uuid))?.toObject() || null);
      const base = docCache.get(uuid);
      if (base) {
        const data = foundry.utils.deepClone(base);
        delete data._id;
        foundry.utils.mergeObject(data, l.patch || {});
        foundry.utils.setProperty(data, '_stats.compendiumSource', uuid);
        return data;
      }
    }
    return l.fallback || null;
  };
}

// ---------------------------------------------------------------------------------
async function runImport(name, index, opt, userMap, say, progress) {
  const root = BASE + '/' + name;
  say('Loading campaign.json (this file is large)…');
  const campaign = await fetchJSON(enc(root) + '/campaign.json');
  const files = index.files || {};
  const local = (rel) => (files[rel] ? enc(root + '/' + files[rel]) : '');
  // Roll20embetterment exports keep one copy of each image, found by its URL.
  const assets = index.assets || {};
  const assetFor = (url) => { const r = url && assets[url]; return r ? enc(root + '/' + (files[r] || r)) : ''; };
  // Images inside handout and bio HTML: point them at the saved copies.
  // Foundry only accepts some file types: actor/journal pictures must be images,
  // token art may also be video. Anything else is dropped rather than failing.
  const extOK = (path, video) => {
    const ext = String(path || '').split(/[?#]/)[0].split('.').pop().toLowerCase();
    return ext in CONST.IMAGE_FILE_EXTENSIONS || (video && ext in CONST.VIDEO_FILE_EXTENSIONS);
  };
  const pic = (...paths) => paths.find((p) => p && extOK(p)) || '';
  const tex = (...paths) => paths.find((p) => p && extOK(p, true)) || '';
  const localHTML = (html) => String(html || '').replace(/(<img[^>]+src\s*=\s*["'])([^"']+)(["'])/gi, (m, a, url, b) => { const l = assetFor(url.replace(/&amp;/g, '&')); return l ? a + l + b : m; });
  const title = index.title || campaign.campaign_title || name;
  const found = (type) => new Map(game.collections.get(type).filter((d) => d.getFlag(MOD, 'id')).map((d) => [d.getFlag(MOD, 'id'), d]));

  // Ownership from Roll20's controlledby / inplayerjournals lists.
  const ownership = (ids, level) => {
    const own = { default: OWN.NONE };
    for (const id of listOf(ids)) {
      if (id === 'all') own.default = Math.max(own.default, level);
      else if (userMap[id]) own[userMap[id]] = Math.max(own[userMap[id]] || 0, level);
    }
    return own;
  };

  // ---- folders mirroring the Roll20 Journal ----------------------------------
  const kindOf = new Map();
  for (const c of campaign.characters || []) kindOf.set(c.id, 'Actor');
  for (const h of campaign.handouts || []) kindOf.set(h.id, 'JournalEntry');
  const folderOf = new Map(); // r20 id -> Foundry folder id
  const maxDepth = (CONST.FOLDER_MAX_DEPTH || 4);
  async function folder(type, name, parent, depth) {
    const existing = game.folders.find((f) => f.type === type && f.name === name && (f.folder?.id || null) === (parent || null));
    if (existing) return existing.id;
    const f = await Folder.create({ name, type, folder: parent || null, sorting: 'm' });
    return f.id;
  }
  async function walk(entries, parents, depth) {
    for (const e of entries || []) {
      if (typeof e === 'string') {
        const type = kindOf.get(e);
        if (type && parents[type]) folderOf.set(e, await parents[type]());
        continue;
      }
      const next = {};
      for (const type of ['Actor', 'JournalEntry']) {
        if (!subtreeHas(e, type)) continue;
        const parentGet = parents[type];
        let id = null;
        next[type] = async () => {
          if (id) return id;
          const p = await parentGet();
          id = depth + 1 < maxDepth ? await folder(type, e.n || 'Folder', p, depth + 1) : p;
          return id;
        };
      }
      await walk(e.i, next, depth + 1);
    }
  }
  const subtreeHas = (e, type) => (e.i || []).some((x) => (typeof x === 'string' ? kindOf.get(x) === type : subtreeHas(x, type)));
  const rootFolder = {};
  for (const type of ['Actor', 'JournalEntry', 'Scene', 'RollTable', 'Macro', 'Playlist', 'Item']) {
    let id = null;
    rootFolder[type] = async () => (id ||= await folder(type, title, null, 0));
  }
  if (opt.actors || opt.journal) {
    say('Creating folders…');
    await walk(campaign.journalfolder || [], { Actor: rootFolder.Actor, JournalEntry: rootFolder.JournalEntry }, 0);
  }
  progress(5);

  // ---- compendium index ---------------------------------------------------------
  const lookup = await compendiumLookup(opt.compendium && opt.actors, say);

  // ---- actors ----------------------------------------------------------------------
  const actorByR20 = new Map();
  const library = new Map(); // custom species / subclass / background -> shared Items
  const existingActors = found('Actor');
  if (opt.actors) {
    const chars = campaign.characters || [];
    say(`Characters: ${chars.length}`);
    const batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const docs = batch.splice(0);
      let made;
      try { made = await Actor.createDocuments(docs, { keepEmbeddedIds: true }); }
      catch {
        // One bad actor fails the whole batch: make them one at a time,
        // and if one still fails, try once more without its pictures.
        made = [];
        for (const d of docs) {
          try { made.push(...await Actor.createDocuments([d], { keepEmbeddedIds: true })); }
          catch (e) {
            try {
              const bare = { ...d, img: undefined, prototypeToken: { ...d.prototypeToken, texture: { ...d.prototypeToken.texture, src: undefined } } };
              made.push(...await Actor.createDocuments([bare], { keepEmbeddedIds: true }));
              say(`  ! ${d.name}: picture skipped (${e.message || e})`);
            } catch (e2) { say(`  ! ${d.name}: not imported (${e2.message || e2})`); console.error(e2); }
          }
        }
      }
      for (const a of made) actorByR20.set(a.getFlag(MOD, 'id'), a);
    };
    let matched = 0;
    let other = 0;
    for (const [i, ch] of chars.entries()) {
      if (opt.skipExisting && existingActors.has(ch.id)) { actorByR20.set(ch.id, existingActors.get(ch.id)); continue; }
      try {
        const dir = index.characters[ch.id];
        const conv = convertCharacter({ ...ch, bio: localHTML(ch.bio), gmnotes: localHTML(ch.gmnotes) });
        if (conv.sheetKind === 'other') other++;
        const items = [...conv.items];
        const before = items.length;
        for (const l of conv.lookups) {
          const it = await lookup(l);
          if (it) { items.push(it); if (it._stats?.compendiumSource) matched++; }
        }
        // Custom species, subclasses and backgrounds (not in any compendium)
        // also go to a shared Items folder, species with their traits.
        for (const it of items.slice(before)) {
          if (it._stats?.compendiumSource || !['race', 'subclass', 'background'].includes(it.type)) continue;
          const key = it.type + '|' + it.name.toLowerCase();
          if (library.has(key)) continue;
          const traitNames = new Set((it.flags?.r20import?.traits || []).map((n) => n.toLowerCase()));
          const extras = it.type === 'race' ? conv.items.filter((x) => x.type === 'feat' && traitNames.has(x.name.toLowerCase())) : [];
          library.set(key, { item: it, extras, from: conv.actor.name });
        }
        const dt = ch.defaulttoken && typeof ch.defaulttoken === 'object' ? ch.defaulttoken : {};
        const avatarAny = (dir && local(dir + '/avatar.png')) || assetFor(ch.avatar) || '';
        const tokenImg = tex((dir && local(dir + '/token.png')) || assetFor(dt.imgsrc), avatarAny);
        const avatar = pic(avatarAny, tokenImg);
        const controlled = listOf(ch.controlledby).length > 0;
        const proto = tokenSettings(dt, 70);
        delete proto.rotation;
        batch.push({
          ...conv.actor, img: avatar || undefined, items, folder: folderOf.get(ch.id) || (await rootFolder.Actor()),
          ownership: mergeOwn(ownership(ch.controlledby, OWN.OWNER), ownership(ch.inplayerjournals, OWN.LIMITED)),
          prototypeToken: {
            name: proto.name || conv.actor.name, width: proto.width || 1, height: proto.height || 1,
            texture: { src: tokenImg || undefined, ...(proto.texture || {}) },
            actorLink: controlled || !!dt.bar1_link, disposition: controlled ? 1 : -1,
            displayName: proto.displayName ?? 20, bar1: { attribute: 'attributes.hp' },
            ...(proto.light ? { light: proto.light } : {}), ...(proto.sight ? { sight: proto.sight } : {}),
          },
          flags: { [MOD]: { id: ch.id, tags: ch.tags || '', abilities: (ch.abilities || []).map((a) => ({ name: a.name, action: a.action })) } },
        });
        if (batch.length >= 10) await flush();
      } catch (e) { say(`  ! ${ch.name}: ${e.message || e}`); console.error(e); }
      progress(5 + (35 * (i + 1)) / chars.length);
    }
    await flush();
    if (library.size) {
      say(`Saving ${library.size} custom species, subclasses and backgrounds to the Items sidebar…`);
      const root = await rootFolder.Item();
      const groups = { race: 'Species', subclass: 'Subclasses', background: 'Backgrounds' };
      const existingItems = new Set(game.items.filter((i) => i.getFlag(MOD, 'libraryKey')).map((i) => i.getFlag(MOD, 'libraryKey')));
      const sub = {};
      for (const [key, { item, extras, from }] of library) {
        if (existingItems.has(key)) continue;
        sub[item.type] ||= await folder('Item', groups[item.type], root, 1);
        let target = sub[item.type];
        if (extras.length) target = await folder('Item', item.name, sub[item.type], 2);
        const strip = (d) => { const c = foundry.utils.deepClone(d); delete c._id; return c; };
        await Item.createDocuments([
          { ...strip(item), folder: target, flags: { ...(item.flags || {}), [MOD]: { ...(item.flags?.[MOD] || {}), libraryKey: key, from } } },
          ...extras.map((x) => ({ ...strip(x), folder: target })),
        ]);
      }
    }
    await linkSpeciesTraits(say);
    say(`  ${actorByR20.size} actors ready; ${matched} spells/items/classes taken from compendiums.`);
    if (other) say(`  ${other} sheets weren't the Classic 5e sheet (likely the 2024 sheet): only name, art, bio and basics came across for those.`);
  } else for (const [k, v] of existingActors) actorByR20.set(k, v);

  // ---- journal --------------------------------------------------------------------
  const journalByR20 = new Map();
  const existingJournal = found('JournalEntry');
  if (opt.journal) {
    const hs = campaign.handouts || [];
    say(`Handouts: ${hs.length}`);
    const batch = [];
    for (const h of hs) {
      if (opt.skipExisting && existingJournal.has(h.id)) { journalByR20.set(h.id, existingJournal.get(h.id)); continue; }
      const dir = index.handouts[h.id];
      const img = pic((dir && local(dir + '/avatar.png')) || assetFor(h.avatar));
      const j = convertHandout({ ...h, notes: localHTML(h.notes), gmnotes: localHTML(h.gmnotes) }, img);
      batch.push({ ...j, folder: folderOf.get(h.id) || (await rootFolder.JournalEntry()), ownership: ownership(h.inplayerjournals, OWN.OBSERVER), flags: { [MOD]: { id: h.id, archived: !!h.archived } } });
    }
    for (let i = 0; i < batch.length; i += 20) {
      for (const d of await JournalEntry.createDocuments(batch.slice(i, i + 20))) journalByR20.set(d.getFlag(MOD, 'id'), d);
    }
    say(`  ${journalByR20.size} journal entries.`);
  } else for (const [k, v] of existingJournal) journalByR20.set(k, v);
  progress(50);

  // ---- scenes ------------------------------------------------------------------------
  if (opt.scenes) {
    const pages = campaign.pages || [];
    const existingScenes = found('Scene');
    say(`Pages: ${pages.length}`);
    const protoCache = new Map();
    const actorFor = (id) => {
      const a = actorByR20.get(id);
      if (!a) return null;
      if (!protoCache.has(id)) {
        const p = a.prototypeToken.toObject();
        for (const k of ['randomImg', 'appendNumber', 'prependAdjective']) delete p[k];
        protoCache.set(id, { id: a.id, prototype: { ...p, name: p.name || a.name } });
      }
      return protoCache.get(id);
    };
    if (opt.replaceScenes) {
      const old = game.scenes.filter((s) => s.getFlag(MOD, 'id'));
      if (old.length) { say(`  Removing ${old.length} scenes from the earlier import…`); await Scene.deleteDocuments(old.map((s) => s.id)); }
      existingScenes.clear();
    }
    for (const [i, page] of pages.entries()) {
      if (opt.skipExisting && existingScenes.has(page.id)) continue;
      try {
        const dir = index.pages[page.id];
        // Local files only: Roll20's own image links can't be loaded from Foundry.
        const imageFor = (pg, g) => tex((dir && local(dir + '/graphics/' + g.id + '.png')) || assetFor(g.imgsrc)
          || (g.represents && index.characters[g.represents] && (local(index.characters[g.represents] + '/token.png') || local(index.characters[g.represents] + '/avatar.png'))));
        const { scene, stats } = convertPage(page, { imageFor, actorFor });
        scene.folder = await rootFolder.Scene();
        scene.navigation = page.id === campaign.playerpageid;
        scene.navOrder = i;
        scene.sort = i * 100;
        await Scene.create(scene);
        say(`  ${scene.name}: ${stats.tokens} tokens, ${stats.tiles} images, ${stats.walls} walls, ${stats.drawings} drawings${stats.missingImages ? `, ${stats.missingImages} missing images` : ''}`);
      } catch (e) { say(`  ! ${page.name}: ${e.message || e}`); console.error(e); }
      progress(50 + (35 * (i + 1)) / pages.length);
    }
  }

  // ---- roll tables ------------------------------------------------------------------
  if (opt.tables) {
    const tables = campaign.tables || campaign.rollabletables || [];
    const existing = found('RollTable');
    const data = tables.filter((t) => !(opt.skipExisting && existing.has(t.id))).map((t) => ({ ...convertTable(t, (it) => pic(local('tables/' + t.id + '/' + (t.items || []).indexOf(it) + '.png') || assetFor(it.avatar))), folder: null, flags: { [MOD]: { id: t.id } } }));
    if (data.length) { const f = await rootFolder.RollTable(); data.forEach((d) => (d.folder = f)); await RollTable.createDocuments(data); }
    say(`Roll tables: ${data.length}`);
  }
  progress(88);

  // ---- macros -----------------------------------------------------------------------------
  if (opt.macros) {
    const macros = campaign.macros || [];
    const existing = found('Macro');
    const data = macros.filter((m) => m && m.name && !(opt.skipExisting && existing.has(m.id))).map((m) => ({
      name: String(m.name).slice(0, 100), type: 'chat', command: String(m.action || ''), scope: 'global',
      flags: { [MOD]: { id: m.id, note: 'Roll20 macro text; Roll20 syntax does not run in Foundry.' } },
    }));
    if (data.length) { const f = await rootFolder.Macro(); data.forEach((d) => (d.folder = f)); await Macro.createDocuments(data); }
    say(`Macros: ${data.length} (Roll20 syntax kept for reference)`);
  }

  // ---- playlists -----------------------------------------------------------------------
  if (opt.playlists) {
    const tracks = new Map((campaign.jukebox || []).map((t) => [t.id, t]));
    const existing = found('Playlist');
    const lists = [];
    const sound = (id) => {
      const t = tracks.get(id);
      const path = index.tracks[id];
      if (!t || !path) return null;
      return { name: t.title || 'Track', path: enc(root + '/' + (files[path] || path)), volume: Math.min(1, (Number(t.volume) || 50) / 100), repeat: !!t.loop, flags: { [MOD]: { id } } };
    };
    const loose = [];
    const collect = (entries, out) => { for (const e of entries || []) { if (typeof e === 'string') { const s = sound(e); if (s) out.push(s); } else collect(e.i, out); } };
    for (const e of campaign.jukeboxfolder || []) {
      if (typeof e === 'string') { const s = sound(e); if (s) loose.push(s); continue; }
      const sounds = []; collect(e.i, sounds);
      if (sounds.length) lists.push({ name: e.n || 'Playlist', sounds, flags: { [MOD]: { id: 'folder:' + (e.id || e.n) } } });
    }
    if (loose.length) lists.push({ name: 'Jukebox', sounds: loose, flags: { [MOD]: { id: 'folder:loose' } } });
    const data = lists.filter((l) => !(opt.skipExisting && existing.has(l.flags[MOD].id)));
    if (data.length) { const f = await rootFolder.Playlist(); data.forEach((d) => (d.folder = f)); await Playlist.createDocuments(data); }
    say(`Playlists: ${data.length} (${data.reduce((n, l) => n + l.sounds.length, 0)} tracks)`);
  }
  progress(94);

  // ---- links between handouts and characters --------------------------------------------
  if (opt.journal || opt.actors) {
    say('Linking Roll20 journal links…');
    const uuidFor = (id) => (journalByR20.get(id) || actorByR20.get(id))?.uuid || null;
    for (const j of journalByR20.values()) {
      const updates = [];
      for (const p of j.pages) {
        if (p.type !== 'text') continue;
        const html = relinkHTML(p.text.content, uuidFor);
        if (html !== p.text.content) updates.push({ _id: p.id, 'text.content': html });
      }
      if (updates.length) await j.updateEmbeddedDocuments('JournalEntryPage', updates);
    }
    for (const a of actorByR20.values()) {
      const bio = a.system?.details?.biography?.value;
      if (!bio) continue;
      const html = relinkHTML(bio, uuidFor);
      if (html !== bio) await a.update({ 'system.details.biography.value': html });
    }
  }
  progress(100);
}

const normName = (s) => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const mergeOwn = (a, b) => { const out = { ...b }; for (const [k, v] of Object.entries(a)) out[k] = Math.max(out[k] || 0, v); return out; };

export { runImport }; // for tests
