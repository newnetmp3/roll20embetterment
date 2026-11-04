// Reads and drives Roll20's older "D&D 5E (Classic)" character sheet.
//
// Unlike the 2024 sheet (its own site, reached by messages), Roll20 writes a
// Classic sheet straight into an iframe of the editor page itself, so the
// editor reads it and presses its buttons directly. Every roll is one of the
// sheet's own <button type="roll"> controls, so Roll20 produces its normal
// chat card.
(function (G) {
  'use strict';
  const C = (G.R20C = G.R20C || {});
  const SHEET_ORIGIN = 'https://advanced-sheets.production.roll20preflight.net';

  const clean = (s, max = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const spaced = (n) => (n.nodeType === 3 ? n.data : n.nodeType === 1 ? [...n.childNodes].map(spaced).join(' ') : '');
  const text = (el, max) => (el ? clean(el.matches && el.matches('input, textarea, select') ? el.value : spaced(el), max) : '');
  const num = (s) => { const m = String(s ?? '').replace(/[−–]/g, '-').match(/[+-]?\d+/); return m ? Number(m[0]) : null; };
  const shown = (el) => { try { return el.getClientRects().length > 0; } catch { return false; } };
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  // "roll_npc_strength_save" -> "Strength Save"
  const humanize = (s) => titleCase(clean(String(s || '').replace(/^(roll|act)_/, '').replace(/^npc_?/, '').replace(/[_-]+/g, ' ')));

  const SECTIONS = {
    npcaction: 'Actions', 'npcaction-l': 'Legendary Actions', npcbonusaction: 'Bonus Actions',
    npcreaction: 'Reactions', npctrait: 'Traits', attack: 'Attacks', inventory: 'Inventory',
    resource: 'Resources', traits: 'Features',
  };
  const sectionOf = (group) => {
    const g = String(group || '').replace(/^repeating_/, '');
    if (SECTIONS[g]) return SECTIONS[g];
    if (/^spell-/.test(g)) return 'Spells';
    return humanize(g) || 'Other';
  };
  const FEATURE_GROUPS = /^(npctrait|traits)$/;

  // A Classic sheet iframe: inside a character dialog, not the 2024 sheet site,
  // and its document is readable from the editor.
  function docOf(iframe) {
    if (!iframe) return null;
    const src = iframe.getAttribute('src') || '';
    if (src.startsWith(SHEET_ORIGIN)) return null;
    try {
      const d = iframe.contentDocument;
      return d && d.body && d.querySelector('button[type="roll"]') ? d : null;
    } catch { return null; }
  }

  const rollButtons = (root) => [...root.querySelectorAll('button[type="roll"]')];
  // Prefer what is on screen; fall back to everything (other sheet tabs).
  const preferShown = (list) => { const vis = list.filter(shown); return vis.length ? vis : list; };

  // Field value inside a row or the whole sheet: input value, checkbox state, or text.
  function field(root, names) {
    for (const n of [].concat(names)) {
      for (const el of root.querySelectorAll('[name="attr_' + n + '"]')) {
        if (el.type === 'checkbox' || el.type === 'radio') { if (el.type === 'checkbox') return el.checked ? '1' : '0'; if (el.checked) return el.value; continue; }
        const v = text(el, 200);
        if (v !== '') return v;
      }
    }
    return '';
  }
  const fieldEl = (root, n) => root.querySelector('input[name="attr_' + n + '"], textarea[name="attr_' + n + '"], select[name="attr_' + n + '"]');

  // Every repeating row (including rows on tabs that are not showing).
  function repRows(doc) {
    const out = [];
    for (const cont of doc.querySelectorAll('.repcontainer[data-groupname]')) {
      const group = cont.getAttribute('data-groupname') || '';
      for (const el of cont.querySelectorAll(':scope > .repitem')) {
        out.push({ group, g: group.replace(/^repeating_/, ''), id: el.getAttribute('data-reprowid') || '', el, buttons: preferShown(rollButtons(el)) });
      }
    }
    return out;
  }
  function scan(doc) {
    const rows = repRows(doc);
    const loose = preferShown(rollButtons(doc).filter((b) => !b.closest('.repitem') && !b.closest('fieldset')));
    return { rows, loose };
  }
  const rowRef = (r, tail) => 'rep:' + r.group + ':' + r.id + ':' + tail;
  const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  // "30 ft., fly 60 ft. (hover), swim 30 ft." -> { walk: 30, fly: 60, swim: 30 }
  function speedsFrom(s) {
    const t = String(s || '').toLowerCase();
    const out = {};
    const first = /^\s*(\d+)/.exec(t);
    if (first) out.walk = Number(first[1]);
    for (const m of t.matchAll(/\b(walk|fly|swim|climb|burrow)\w*\s*(\d+)/g)) out[m[1]] = Number(m[2]);
    return out;
  }
  C.speedsFrom = speedsFrom;
  const deathBoxes = (doc, kind) => [1, 2, 3].map((i) => doc.querySelector('input[type="checkbox"][name="attr_deathsave_' + kind + i + '"]')).filter(Boolean);
  function deathCount(doc) {
    const ok = deathBoxes(doc, 'succ');
    const fail = deathBoxes(doc, 'fail');
    if (!ok.length && !fail.length) return null;
    return { ok: ok.filter((b) => b.checked).length, fail: fail.filter((b) => b.checked).length };
  }

  function rowName(r) {
    return field(r.el, ['name', 'atkname', 'spellname', 'itemname', 'toolname', 'npc_name']) ||
      (r.buttons[0] && (text(r.buttons[0], 120) || humanize(r.buttons[0].getAttribute('name')))) || '';
  }

  C.classic = {
    docOf,

    parse(doc, fallbackName) {
      const { rows: allRows, loose: allLoose } = scan(doc);
      const npcFlag = doc.querySelector('input[name="attr_npc"]');
      const isNpc = npcFlag ? (npcFlag.type === 'checkbox' ? npcFlag.checked : npcFlag.value === '1')
        : allRows.some((r) => /^npc/.test(r.g) && r.buttons.some(shown));
      // The Classic sheet holds both a player and an NPC layout; read one.
      const rows = allRows.filter((r) => /^npc/.test(r.g) === isNpc);
      const loose = allLoose.filter((b) => /init/i.test(b.getAttribute('name') || '') || /npc/i.test(b.getAttribute('name') || '') === isNpc);
      const name = field(doc, isNpc ? ['npc_name', 'character_name'] : ['character_name']) || clean(fallbackName, 120);
      const snap = {
        v: 1, classic: true, type: isNpc ? 'npc' : 'pc', name, at: Date.now(),
        stats: {
          hp: num(field(doc, 'hp')), maxHp: num(field(doc, 'hp_max')), tempHp: num(field(doc, 'hp_temp')),
          ac: num(field(doc, isNpc ? ['npc_ac', 'ac'] : ['ac'])), speed: num(field(doc, isNpc ? ['npc_speed', 'speed'] : ['speed'])),
          speeds: speedsFrom(field(doc, isNpc ? ['npc_speed', 'speed'] : ['speed'])),
          deathSaves: isNpc ? null : deathCount(doc),
        },
        privacy: null, mode: null,
        attacks: [], actions: [], features: [], items: [], spells: [],
        abilities: [], checks: [], hitDice: [], rests: [], initiative: null,
      };
      for (const r of rows) {
        const nm = rowName(r);
        if (!nm && r.g !== 'resource') continue;
        const desc = field(r.el, ['description', 'desc', 'atk_desc', 'itemcontent', 'spelldescription']).slice(0, 600);
        if (r.g === 'attack') {
          const hitTxt = field(r.el, ['atkbonus', 'atkbonus_display']);
          const dmg = [field(r.el, ['dmgbase', 'dmg1']), field(r.el, ['dmg2base'])].filter(Boolean);
          snap.attacks.push({
            ref: rowRef(r, 'atk'), name: nm, section: 'Attacks', sub: field(r.el, 'dmgtype'),
            range: field(r.el, 'atkrange'), chips: [],
            hit: r.buttons.length ? (hitTxt ? hitTxt + ' Attack' : 'Attack') : '',
            dmg: r.buttons.length > 1 ? [{ text: dmg[0] || 'Damage', type: field(r.el, 'dmgtype') }] : [],
          });
        } else if (r.g === 'inventory') {
          const qtyEl = fieldEl(r.el, 'itemcount');
          const eq = r.el.querySelector('input[type="checkbox"][name="attr_equipped"]');
          snap.items.push({
            ref: rowRef(r, 'item'), name: nm, section: 'Equipment', sub: field(r.el, 'itemproperties'),
            qty: qtyEl ? num(qtyEl.value) : null, weight: field(r.el, 'itemweight'), equipped: eq ? eq.checked : null,
          });
        } else if (r.g === 'traits' || r.g === 'npctrait') {
          snap.features.push({
            ref: rowRef(r, 'trait'), name: nm, section: isNpc ? 'Traits' : (titleCase(field(r.el, 'source')) || 'Features & Traits'),
            source: field(r.el, 'source_type'), timing: '', desc, res: [],
          });
        } else if (r.g === 'resource') {
          const res = [];
          [['resource_left_name', 'resource_left'], ['resource_right_name', 'resource_right']].forEach(([n, v], i) => {
            const el = fieldEl(r.el, v);
            const label = field(r.el, n);
            if (el && label) res.push({ i, name: label, kind: 'count', cur: num(el.value), max: num(field(r.el, v + '_max')) });
          });
          if (res.length) snap.features.push({ ref: rowRef(r, 'res'), name: res.map((x) => x.name).join(' / '), section: 'Resources', source: '', timing: '', desc: '', res });
        } else if (/^spell-/.test(r.g)) {
          const lvl = r.g.slice(6);
          const prep = r.el.querySelector('input[type="checkbox"][name="attr_spellprepared"]');
          snap.spells.push({
            ref: rowRef(r, 'spell'), name: nm, level: lvl === 'cantrip' ? 'CANTRIPS' : /^\d$/.test(lvl) ? ORD(Number(lvl)) : titleCase(lvl),
            range: field(r.el, 'spellrange'), time: field(r.el, 'spellcastingtime'), hit: '', dmg: [], tags: [field(r.el, 'spellritual') === '1' ? 'R' : '', field(r.el, 'spellconcentration') === '1' ? 'C' : ''].filter(Boolean),
            prepared: prep ? prep.checked : null,
          });
        } else if (r.g === 'tool') {
          snap.checks.push({ ref: rowRef(r, 'press'), name: nm, ability: '', bonus: field(r.el, ['toolbonus_display', 'toolbonus']), prof: '' });
        } else if (r.g === 'proficiencies') {
          continue; // languages and armor: nothing to roll
        } else if (r.buttons.length) {
          r.buttons.forEach((btn, i) => snap.actions.push({
            ref: rowRef(r, 'b' + i), name: i === 0 ? nm : nm + ' (' + (text(btn, 30) || humanize(btn.getAttribute('name'))) + ')',
            section: sectionOf(r.group), desc, roll: '', res: [],
          }));
        }
      }
      // Sheet-level class/other resources on the player sheet.
      if (!isNpc) {
        for (const base of ['class_resource', 'other_resource']) {
          const el = fieldEl(doc, base);
          const label = field(doc, base + '_name');
          if (el && label) snap.features.push({ ref: 'attr:' + base, name: label, section: 'Resources', source: '', timing: '', desc: '', res: [{ i: 0, name: label, kind: 'count', cur: num(el.value), max: num(field(doc, base + '_max')) }] });
        }
      }
      const seen = new Map();
      for (const btn of loose) {
        const key = btn.getAttribute('name') || text(btn, 40);
        if (!key || seen.has(key)) continue;
        seen.set(key, 1);
        const ref = 'btn:0:' + key;
        const label = humanize(key) || text(btn, 40);
        if (/init/i.test(key)) { if (!snap.initiative) snap.initiative = { ref, text: field(doc, ['initiative_bonus', 'npc_init']) }; continue; }
        if (/death/i.test(key)) { if (!isNpc && !snap.deathSave) snap.deathSave = { ref }; continue; }
        if (/hit_?dic?e|hitdie|hd_/i.test(key)) { snap.hitDice.push({ ref, name: label, label: text(btn, 30) || label }); continue; }
        snap.checks.push({ ref, name: label, ability: '', bonus: text(btn, 8), prof: '' });
      }
      // The Classic sheet has no rest buttons; the bar offers its own Long Rest.
      if (!isNpc && fieldEl(doc, 'hp')) snap.rests.push({ ref: 'sheet:rest', name: 'Long Rest', op: 'longrest', desc: 'Restores HP, spell slots and half your hit dice; clears temp HP and death saves. Resources are left as they are.' });
      return snap;
    },

    find(doc, ref) {
      const rep = /^rep:([^:]*):([^:]*):(.*)$/.exec(String(ref || ''));
      if (rep) {
        const cont = [...doc.querySelectorAll('.repcontainer')].find((c) => c.getAttribute('data-groupname') === rep[1]);
        const el = cont && [...cont.querySelectorAll(':scope > .repitem')].find((x) => x.getAttribute('data-reprowid') === rep[2]);
        if (!el) return null;
        return { row: el, tail: rep[3], buttons: preferShown(rollButtons(el)) };
      }
      if (/^attr:/.test(String(ref))) return { row: doc, tail: 'attr', attr: String(ref).slice(5), buttons: [] };
      const btn = /^btn:(\d+):(.*)$/.exec(String(ref || ''));
      if (btn) {
        const list = preferShown(rollButtons(doc).filter((b) => !b.closest('.repitem') && (b.getAttribute('name') || text(b, 40)) === btn[2]));
        return list[0] ? { row: doc, tail: 'press', buttons: [list[0]] } : null;
      }
      return null;
    },

    // Every roll is one of the sheet's own buttons; counters and hit points
    // are its own fields.
    perform(doc, ref, op, arg) {
      const setField = (el, value) => {
        el.value = String(value);
        for (const t of ['input', 'change', 'blur']) el.dispatchEvent(new Event(t, { bubbles: true }));
      };
      if (op === 'damage' || op === 'heal' || op === 'temp') {
        const n = Math.max(0, Math.floor(Number(arg) || 0));
        const hp = fieldEl(doc, 'hp');
        const tmp = fieldEl(doc, 'hp_temp');
        if (!hp) return { ok: false, msg: 'This sheet has no hit point field.' };
        const cur = num(hp.value) || 0;
        const max = num(field(doc, 'hp_max'));
        if (op === 'temp') { if (!tmp) return { ok: false, msg: 'No temp HP field.' }; setField(tmp, n); return { ok: true, msg: 'Temp HP ' + n }; }
        if (op === 'damage') {
          let left = n;
          const t = tmp ? num(tmp.value) || 0 : 0;
          if (t > 0) { const used = Math.min(t, left); setField(tmp, t - used); left -= used; }
          setField(hp, Math.max(0, cur - left));
        } else setField(hp, max ? Math.min(max, cur + n) : cur + n);
        return { ok: true, msg: 'HP ' + hp.value };
      }
      if (op === 'longrest') {
        const hp = fieldEl(doc, 'hp');
        const max = num(field(doc, 'hp_max'));
        if (!hp || !max) return { ok: false, msg: 'This sheet has no maximum HP set.' };
        setField(hp, max);
        const tmp = fieldEl(doc, 'hp_temp');
        if (tmp) setField(tmp, 0);
        for (const b of [...deathBoxes(doc, 'succ'), ...deathBoxes(doc, 'fail')]) {
          if (b.checked) b.click();
          if (b.checked) { b.checked = false; b.dispatchEvent(new Event('change', { bubbles: true })); }
        }
        // Spell slots: on this sheet "expended" holds the slots remaining.
        let slots = 0;
        for (let l = 1; l <= 9; l++) {
          const left = fieldEl(doc, 'lvl' + l + '_slots_expended');
          const total = num(field(doc, 'lvl' + l + '_slots_total'));
          if (left && total) { setField(left, total); slots++; }
        }
        const hd = fieldEl(doc, 'hit_dice');
        const hdMax = num(field(doc, 'hit_dice_max'));
        if (hd && hdMax) setField(hd, Math.min(hdMax, (num(hd.value) || 0) + Math.max(1, Math.floor(hdMax / 2))));
        return { ok: true, msg: 'HP ' + max + (slots ? ', spell slots restored' : '') + (hd && hdMax ? ', hit dice ' + hd.value + '/' + hdMax : '') + '.' };
      }
      const f = this.find(doc, ref);
      if (!f) return { ok: false, msg: 'That entry is no longer on the sheet.' };
      if (op === 'qty') {
        const el = fieldEl(f.row, 'itemcount');
        if (!el) return { ok: false, msg: 'No quantity field.' };
        setField(el, Math.max(0, (num(el.value) || 0) + (Number(arg) || 0)));
        return { ok: true, msg: 'Quantity ' + el.value };
      }
      if (op === 'equip') {
        const box = f.row.querySelector('input[type="checkbox"][name="attr_equipped"]');
        if (!box) return { ok: false, msg: 'No equipped box.' };
        box.click();
        return { ok: true, msg: box.checked ? 'Equipped' : 'Unequipped' };
      }
      if (op === 'res' || (op === 'use' && f.tail === 'res')) {
        const i = op === 'res' ? Number(arg && arg.i) || 0 : 0;
        const delta = op === 'res' ? Number(arg && arg.delta) || 0 : -1;
        const name = f.attr || ['resource_left', 'resource_right'][i];
        const el = fieldEl(f.row, name);
        if (!el) return { ok: false, msg: 'No counter.' };
        const max = num(field(f.row, name + '_max'));
        const next = Math.max(0, (num(el.value) || 0) + delta);
        setField(el, max ? Math.min(max, next) : next);
        return { ok: true, msg: el.value + (max ? '/' + max : '') };
      }
      // Attack rows: first button attacks, second rolls damage.
      const b = op === 'dmg' ? f.buttons[1] || f.buttons[0] : f.buttons[0];
      if (!b) return { ok: false, msg: 'This entry has nothing to roll on the sheet.' };
      b.click();
      return { ok: true, msg: op === 'dmg' ? 'Damage rolled.' : 'Rolled' };
    },

    // For diagnostics: what the reader can see on a Classic sheet.
    describe(doc) {
      const { rows, loose } = scan(doc);
      const groups = {};
      for (const r of rows) {
        const g = groups[r.group] || (groups[r.group] = { rows: 0, buttons: 0, fields: new Set() });
        g.rows++; g.buttons += r.buttons.length;
        if (g.fields.size < 25) for (const el of r.el.querySelectorAll('[name^="attr_"]')) g.fields.add(el.getAttribute('name').slice(5));
      }
      for (const g of Object.values(groups)) g.fields = [...g.fields];
      return { groups, loose: loose.slice(0, 40).map((b) => b.getAttribute('name') || text(b, 30)) };
    },
  };
})(globalThis);
