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

  const rollButtons = (root) => [...root.querySelectorAll('button[type="roll"]')].filter(shown);

  function rowName(rep, btn) {
    const n = rep.querySelector('[name="attr_name"], [name="attr_atkname"], [name="attr_spellname"], [name="attr_itemname"], [name="attr_resource_name"]');
    return text(n, 120) || text(btn, 120) || humanize(btn.getAttribute('name'));
  }

  // Every visible roll button, grouped by repeating row where it has one.
  function scan(doc) {
    const rows = new Map(); // rowKey -> { group, id, el, buttons: [] }
    const loose = [];
    for (const btn of rollButtons(doc)) {
      const rep = btn.closest('.repitem');
      const cont = btn.closest('.repcontainer');
      if (rep && cont) {
        const group = cont.getAttribute('data-groupname') || '';
        const id = rep.getAttribute('data-reprowid') || '';
        const key = group + '|' + id;
        if (!rows.has(key)) rows.set(key, { group, id, el: rep, buttons: [] });
        rows.get(key).buttons.push(btn);
      } else {
        loose.push(btn);
      }
    }
    return { rows: [...rows.values()], loose };
  }

  function readValue(doc, names) {
    for (const n of names) {
      for (const el of doc.querySelectorAll('[name="attr_' + n + '"]')) {
        const v = text(el, 40);
        if (v !== '') return v;
      }
    }
    return '';
  }

  C.classic = {
    docOf,

    parse(doc, fallbackName) {
      const { rows, loose } = scan(doc);
      const npcFlag = doc.querySelector('input[name="attr_npc"]');
      const isNpc = (npcFlag && (npcFlag.type === 'checkbox' ? npcFlag.checked : npcFlag.value === '1')) ||
        rows.some((r) => /^repeating_npc/.test(r.group));
      const name = readValue(doc, isNpc ? ['npc_name', 'character_name'] : ['character_name']) || clean(fallbackName, 120);
      const snap = {
        v: 1, classic: true, type: isNpc ? 'npc' : 'pc', name, at: Date.now(),
        stats: {
          hp: num(readValue(doc, ['hp'])), maxHp: num(readValue(doc, ['hp_max'])), tempHp: num(readValue(doc, ['hp_temp'])),
          ac: num(readValue(doc, isNpc ? ['npc_ac', 'ac'] : ['ac'])),
        },
        privacy: null, mode: null,
        attacks: [], actions: [], features: [], items: [], spells: [],
        abilities: [], checks: [], hitDice: [], rests: [], initiative: null,
      };
      for (const r of rows) {
        const base = rowName(r.el, r.buttons[0]);
        const section = sectionOf(r.group);
        const desc = text(r.el.querySelector('[name="attr_description"], [name="attr_desc"], [name="attr_atk_desc"]'), 600);
        r.buttons.forEach((btn, i) => {
          const label = i === 0 ? base : base + ' (' + (text(btn, 30) || humanize(btn.getAttribute('name'))) + ')';
          const ref = 'rep:' + r.group + ':' + r.id + ':' + i;
          if (FEATURE_GROUPS.test(r.group.replace(/^repeating_/, ''))) {
            snap.features.push({ ref, name: label, section, source: '', timing: '', desc, res: [] });
          } else if (/^repeating_spell-/.test(r.group)) {
            snap.spells.push({ ref, name: label, level: r.group.replace(/^repeating_spell-/, ''), range: '', hit: '', dmg: [], tags: [], prepared: null });
          } else {
            snap.actions.push({ ref, name: label, section, desc, roll: '', res: [] });
          }
        });
      }
      const seen = new Map();
      for (const btn of loose) {
        const key = btn.getAttribute('name') || text(btn, 40);
        if (!key) continue;
        const occ = seen.get(key) || 0;
        seen.set(key, occ + 1);
        const ref = 'btn:' + occ + ':' + key;
        const label = humanize(key) || text(btn, 40);
        if (/init/i.test(key)) { if (!snap.initiative) snap.initiative = { ref, text: '' }; continue; }
        if (/death/i.test(key)) continue;
        if (/hit_?dice|hitdie|hd_/i.test(key)) { snap.hitDice.push({ ref, name: label, label: text(btn, 30) || label }); continue; }
        snap.checks.push({ ref, name: label, ability: '', bonus: text(btn, 8), prof: '' });
      }
      return snap;
    },

    find(doc, ref) {
      const rep = /^rep:([^:]*):([^:]*):(\d+)$/.exec(String(ref || ''));
      if (rep) {
        const cont = [...doc.querySelectorAll('.repcontainer')].find((c) => c.getAttribute('data-groupname') === rep[1]);
        const row = cont && [...cont.querySelectorAll('.repitem')].find((x) => x.getAttribute('data-reprowid') === rep[2]);
        return row ? rollButtons(row)[Number(rep[3])] || null : null;
      }
      const btn = /^btn:(\d+):(.*)$/.exec(String(ref || ''));
      if (btn) {
        const list = rollButtons(doc).filter((b) => !b.closest('.repitem') && (b.getAttribute('name') || text(b, 40)) === btn[2]);
        return list[Number(btn[1])] || null;
      }
      return null;
    },

    // Every menu action on a Classic sheet is one of its own roll buttons;
    // hit points are its own fields.
    perform(doc, ref, op, arg) {
      if (op === 'damage' || op === 'heal' || op === 'temp') {
        const field = (n) => doc.querySelector('input[name="attr_' + n + '"]');
        const n = Math.max(0, Math.floor(Number(arg) || 0));
        const hp = field('hp');
        const target = op === 'temp' ? field('hp_temp') : hp;
        if (!target) return { ok: false, msg: 'This sheet has no hit point field.' };
        const cur = num(hp && hp.value) || 0;
        const max = num(field('hp_max') && field('hp_max').value);
        const value = op === 'temp' ? n : op === 'damage' ? Math.max(0, cur - n) : (max ? Math.min(max, cur + n) : cur + n);
        target.value = String(value);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        target.dispatchEvent(new Event('blur', { bubbles: true }));
        return { ok: true, msg: op === 'temp' ? 'Temp HP ' + value : 'HP ' + value };
      }
      const btn = this.find(doc, ref);
      if (!btn) return { ok: false, msg: 'That roll is no longer on the sheet.' };
      btn.click();
      return { ok: true, msg: 'Rolled' };
    },

    // For diagnostics: what the reader can see on a Classic sheet.
    describe(doc) {
      const { rows, loose } = scan(doc);
      return {
        groups: [...new Set(rows.map((r) => r.group))],
        rows: rows.length,
        loose: loose.slice(0, 40).map((b) => b.getAttribute('name') || text(b, 30)),
      };
    },
  };
})(globalThis);
