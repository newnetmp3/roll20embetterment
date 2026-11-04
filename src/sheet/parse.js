// Reads an official Roll20 D&D 2024 sheet (PC or NPC) into plain data.
// Runs inside the sheet frame. Pure DOM reads; nothing here clicks or edits.
//
// Every tab of the PC sheet is mounted at once (inactive tabs are only
// display:none), so one pass reads the whole sheet without switching tabs.
// The sheet also renders a second copy of itself for small screens; we read
// exactly one copy so nothing is listed twice.
(function (G) {
  'use strict';
  const C = (G.R20C = G.R20C || {});

  const clean = (s, max = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  // textContent glues neighbouring labels together ("Self30 ft"); join the
  // text of separate elements with spaces instead.
  const spaced = (node) => (node.nodeType === 3 ? node.data
    : node.nodeType === 1 ? [...node.childNodes].map(spaced).join(' ') : '');
  const text = (el, max) => (el ? clean(spaced(el), max) : '');
  const num = (s) => {
    const m = String(s ?? '').replace(/[−–]/g, '-').match(/[+-]?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  const rendered = (el) => {
    try { return !!el && el.getClientRects().length > 0; } catch { return false; }
  };
  const attr = (el, name) => (el && el.getAttribute ? el.getAttribute(name) : null);

  // Which copy of the sheet to read. Prefer the one the browser is actually
  // showing; fall back to the desktop / large layout.
  function scopes(doc) {
    const sheet = doc.querySelector('.dnd-sheet');
    if (!sheet) return null;
    if (sheet.classList.contains('npc-sheet')) {
      const large = [...sheet.querySelectorAll('.npc__large')];
      const small = [...sheet.querySelectorAll('.npc__small')];
      const useSmall = !large.length || (small.some(rendered) && !large.some(rendered));
      return { type: 'npc', sheet, list: useSmall && small.length ? small : large.length ? large : [sheet] };
    }
    const desk = sheet.querySelector('.wrapper--desktop');
    const mob = sheet.querySelector('.wrapper--mobile');
    const useMob = mob && desk && rendered(mob) && !rendered(desk);
    return { type: 'pc', sheet, list: [useMob ? mob : desk || sheet] };
  }
  function all(sc, sel) {
    const out = [];
    for (const root of sc.list) for (const el of root.querySelectorAll(sel)) out.push(el);
    return out;
  }

  // Row kinds the companion understands. `name` finds the row title.
  const KINDS = {
    attack: { sel: '.attack-item', name: (r) => text(r.querySelector('.span--item-row-title'), 120) },
    action: { sel: '.action-item', name: (r) => text(r.querySelector('.span--item-row-title'), 120) },
    feature: {
      sel: '.feature-item',
      name: (r) => text(r.querySelector('.feature-item__title-chat .span--item-row-title') || r.querySelector('.span--item-row-title'), 120),
    },
    npcfeature: {
      sel: '.npc-feature',
      name: (r) => text(r.querySelector('.poly-value__label'), 120).replace(/:\s*$/, ''),
    },
    item: { sel: '.item-item', name: (r) => text(r.querySelector('.item-item__title'), 120) },
    spell: { sel: '.spell-item', name: (r) => text(r.querySelector('.spell-item__name'), 120) },
    ability: { sel: '.inline-ability', name: (r) => text(r.querySelector('.utility-incrementer__label'), 10).toUpperCase() },
    check: {
      // PC skills and tools: <button aria-label="Roll a Stealth check">
      sel: 'button[aria-label^="Roll a "][aria-label$=" check"]',
      name: (r) => clean(attr(r, 'aria-label')).replace(/^Roll a /, '').replace(/ check$/, ''),
    },
    npcskill: { sel: '.npc-abilities__skill-button', name: (r) => text(r.querySelector('.npc-skill__name'), 60) },
    hitdie: { sel: 'button[aria-label^="Roll a d"][aria-label*="hit die"]', name: (r) => clean(attr(r, 'aria-label')) },
    rest: { sel: 'button[aria-label="Short Rest"],button[aria-label="Long Rest"]', name: (r) => clean(attr(r, 'aria-label')) },
    initiative: { sel: '.initiative-btn, .npc-info__initiative .poly-button.initiative', name: () => 'Initiative' },
  };

  // Rows of one kind, each tagged with its occurrence among same-named rows.
  // A reference is kind + name + occurrence, which survives Vue re-rendering
  // (element objects do not).
  function rows(sc, kind) {
    const k = KINDS[kind];
    const seen = new Map();
    const out = [];
    for (const el of all(sc, k.sel)) {
      const name = k.name(el);
      if (!name) continue;
      // Same check button can appear in two skill panels; keep the first.
      if ((kind === 'check' || kind === 'rest') && seen.has(name)) continue;
      const occ = seen.get(name) || 0;
      seen.set(name, occ + 1);
      out.push({ el, name, ref: kind + ':' + occ + ':' + name });
    }
    return out;
  }
  C.rows = rows;
  C.scopes = scopes;

  // Nearest section heading above a row ("Bonus Actions", "Equipment", ...).
  function section(row) {
    const sticky = row.closest('.sticky-section');
    if (sticky) {
      const h = sticky.querySelector('.section-header__main-header, .full-screen-spells__sticky-header-level');
      if (h) return text(h, 60);
    }
    // NPC: the heading is a previous sibling of the section container.
    for (let node = row; node && node.parentElement; node = node.parentElement) {
      for (let p = node.previousElementSibling; p; p = p.previousElementSibling) {
        const h = p.matches('.npc-actions__header, .npc-special-actions__header, .npc-features__header')
          ? p
          : p.querySelector && [...p.querySelectorAll('.npc-actions__header')].pop();
        if (h) return text(h, 60);
      }
      if (node.matches && node.matches('.npc-actions--wrapper, .npc-features--wrapper, .npc-special-actions--wrapper')) break;
    }
    return '';
  }

  // Counters attached to a row: "Healer's Kit 9/10" (+/- incrementer) or
  // "Second Wind [x]" (checkbox range).
  function resources(row) {
    const out = [];
    let i = 0;
    for (const item of row.querySelectorAll('.view-resource .draggable-list__item')) {
      const name = text(item.querySelector('.view-resource__name'), 80);
      const range = item.querySelector('input.range-counter__input');
      const inc = item.querySelector('.poly-incrementer__input');
      if (range) {
        out.push({ i: i++, name, kind: 'range', cur: num(attr(range, 'aria-valuenow') ?? range.value), max: num(attr(range, 'max')) });
      } else if (inc) {
        out.push({
          i: i++, name, kind: 'count',
          cur: num(attr(inc, 'aria-valuenow') ?? inc.value),
          max: num(text(item.querySelector('.view-resource__max'))),
        });
      }
    }
    return out;
  }

  const buttonText = (sel) => (row) => text(row.querySelector(sel), 40);
  const hitText = buttonText('.poly-button--hit-dc button');
  // Damage and healing buttons, in sheet order (act.js presses by index).
  const DMG_BUTTONS = '.poly-button--damage button, .poly-button--healing button';
  C.DMG_BUTTONS = DMG_BUTTONS;
  const dmgList = (row) => [...row.querySelectorAll(DMG_BUTTONS)].map((b) => ({
    text: text(b, 40),
    type: clean(attr(b.querySelector('.poly-icon--damage-icon'), 'aria-label'), 30),
  }));
  const desc = (row, sel) => text(row.querySelector(sel), 600);

  function readStats(sc) {
    const s = {};
    const byTitle = (t) => all(sc, 'input[title="' + t + '"]')[0];
    const val = (el) => (el ? num(attr(el, 'aria-valuenow') ?? el.value) : null);
    if (sc.type === 'pc') {
      s.hp = val(byTitle('Current Hitpoints'));
      s.maxHp = val(byTitle('Max Hitpoints'));
      s.tempHp = val(byTitle('Temp'));
      const acSpeed = all(sc, '.ac-speed input');
      s.ac = val(acSpeed[0]);
      s.speed = val(acSpeed[1]);
      s.level = num(text(all(sc, '.level')[0]));
      s.initiative = text(all(sc, '.initiative-btn')[0], 30).replace(/^Initiative\s*/i, '');
      s.hitDice = all(sc, '.inline-hit-dice__entry').map((e) => {
        const v = [...e.querySelectorAll('input')].map(val);
        return { cur: v[0], max: v[1] };
      });
    } else {
      const pv = (sel) => num(attr(all(sc, sel)[0], 'value'));
      s.maxHp = pv('.npc-info__hp-average');
      s.ac = pv('.armor__total');
      s.speed = pv('.speed__walk');
      s.cr = text(all(sc, '.npc-info__challenge-rating-box')[0], 10);
      s.initiative = clean(attr(all(sc, '.npc-info__initiative .poly-value--npc-button-text')[0], 'value'), 10).replace(/[()]/g, '');
    }
    return s;
  }

  function radios(sheet, sel) {
    const group = sheet.querySelector(sel);
    if (!group) return null;
    const options = [...group.querySelectorAll('[role="radio"]')].map((r) => ({
      label: text(r, 30), on: attr(r, 'aria-checked') === 'true',
    }));
    return { value: (options.find((o) => o.on) || {}).label || '', options: options.map((o) => o.label) };
  }

  // Run one part of the read; a failure skips only that part.
  function part(snap, name, fn) {
    try { fn(); } catch (e) { (snap.errors = snap.errors || []).push(name + ': ' + String(e && e.message || e)); }
  }

  C.parseSheet = function parseSheet(doc) {
    const sc = scopes(doc);
    if (!sc) return null;
    const name = sc.type === 'pc'
      ? text(all(sc, '.profile__name')[0], 120)
      : text(all(sc, '.npc-info__name')[0], 120);

    const snap = {
      v: 1, type: sc.type, name, at: Date.now(),
      stats: (() => { try { return readStats(sc); } catch { return {}; } })(),
      privacy: radios(sc.sheet, '.manage__roll-privacy--radio'),
      mode: radios(sc.sheet, '.manage__roll-mode--radio'),
      attacks: [], actions: [], features: [], items: [], spells: [],
      abilities: [], checks: [], hitDice: [], rests: [], initiative: null,
    };

    part(snap, 'attack', () => {
      for (const r of rows(sc, 'attack')) {
        snap.attacks.push({
          ref: r.ref, name: r.name, section: section(r.el),
          sub: text(r.el.querySelector('.span--item-row-subtitle'), 40),
          range: text(r.el.querySelector('.attack-item__range'), 40),
          hit: hitText(r.el), dmg: dmgList(r.el),
          chips: [...r.el.querySelectorAll('.attack-item__type-range .poly-chip__label')].map((c) => text(c, 60)),
        });
      }
    });
    part(snap, 'action', () => {
      for (const r of rows(sc, 'action')) {
        const roll = r.el.querySelector('.poly-button--healing button, .poly-button--hit-dc button, .poly-button--damage button');
        snap.actions.push({
          ref: r.ref, name: r.name, section: section(r.el),
          desc: desc(r.el, '.action-item__description'),
          roll: roll ? text(roll, 40) : '',
          res: resources(r.el),
        });
      }
    });
    part(snap, 'feature', () => {
      for (const r of rows(sc, 'feature')) {
        snap.features.push({
          ref: r.ref, name: r.name, section: section(r.el),
          source: text(r.el.querySelector('.feature-item__source'), 60),
          timing: text(r.el.querySelector('.feature-item__action'), 30),
          desc: desc(r.el, '.feature-item__description'),
          res: resources(r.el),
        });
      }
    });
    part(snap, 'npcfeature', () => {
      for (const r of rows(sc, 'npcfeature')) {
        snap.features.push({
          ref: r.ref, name: r.name, section: 'Features & Traits', source: '',
          timing: '', desc: clean(attr(r.el.querySelector('.npc-feature__combined-name-desc'), 'value'), 600), res: [],
        });
      }
    });
    part(snap, 'item', () => {
      for (const r of rows(sc, 'item')) {
        const qty = r.el.querySelector('.item-item__quantity-incrementer .poly-incrementer__input');
        const sw = r.el.querySelector('.item-item__equip-switch [role="switch"]');
        snap.items.push({
          ref: r.ref, name: r.name, section: section(r.el),
          sub: [...r.el.querySelectorAll('.item-item__subtitle li')].map((li) => text(li, 40)).join(', '),
          qty: qty ? num(attr(qty, 'aria-valuenow') ?? qty.value) : null,
          weight: text(r.el.querySelector('.item-item__weight'), 20),
          equipped: sw ? attr(sw, 'aria-checked') === 'true' : null,
        });
      }
    });
    part(snap, 'spell', () => {
      for (const r of rows(sc, 'spell')) {
        const prep = r.el.querySelector('.utility-switch--prepared [role="switch"]');
        snap.spells.push({
          ref: r.ref, name: r.name, level: section(r.el) || '',
          range: text(r.el.querySelector('.spell-item__range'), 50),
          hit: text(r.el.querySelector('.spell-item__hit-dc button'), 40),
          dmg: [...r.el.querySelectorAll('.spell-item__damage button')].map((b) => ({ text: text(b, 40), type: '' })),
          tags: [...r.el.querySelectorAll('.spell-item__rit-con .poly-chip__label')].map((c) => text(c, 4)),
          prepared: prep ? attr(prep, 'aria-checked') === 'true' : null,
        });
      }
    });
    part(snap, 'ability', () => {
      for (const r of rows(sc, 'ability')) {
        snap.abilities.push({
          ref: r.ref, name: r.name,
          score: num(attr(r.el.querySelector('.utility-incrementer__input'), 'aria-valuenow')),
          mod: text(r.el.querySelector('.poly-button--ability button'), 6),
          save: text(r.el.querySelector('.poly-button--compact-saving-throw button'), 6),
        });
      }
    });
    part(snap, 'check', () => {
      for (const r of rows(sc, 'check')) {
        const row = r.el.closest('.skill');
        snap.checks.push({
          ref: r.ref, name: r.name,
          ability: row ? text(row.querySelector('.skill__ability'), 4) : '',
          bonus: row ? text(row.querySelector('.skill__bonus'), 6) : '',
          prof: row ? clean(attr(row.querySelector('.skill__bonus'), 'data-prof'), 20) : '',
        });
      }
    });
    part(snap, 'npcskill', () => {
      for (const r of rows(sc, 'npcskill')) {
        snap.checks.push({ ref: r.ref, name: r.name, ability: '', bonus: text(r.el.querySelector('.npc-skill__value'), 6), prof: '' });
      }
    });
    part(snap, 'hitdie', () => { for (const r of rows(sc, 'hitdie')) snap.hitDice.push({ ref: r.ref, name: r.name, label: text(r.el, 30) }); });
    part(snap, 'rest', () => { for (const r of rows(sc, 'rest')) snap.rests.push({ ref: r.ref, name: r.name }); });
    const init = rows(sc, 'initiative')[0];
    if (init) snap.initiative = { ref: init.ref, text: snap.stats.initiative };
    return snap;
  };
})(globalThis);
