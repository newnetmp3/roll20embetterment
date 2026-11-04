// Turns a sheet snapshot into the sidebar's cascading menus. Pure data in,
// pure data out: no DOM, so it is unit-tested directly.
//
// Node: { key, label, hint?, desc?, header?, checked?, disabled?,
//         run?: Act, controls?: [{label, title?, run: Act}], children?: [Node],
//         input?: {placeholder, run: (value) => Act} }
// Act:  { ref, op, arg?, say? }  — performed on the sheet by the frame.
(function (G) {
  'use strict';
  const C = (G.R20C = G.R20C || {});
  const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const signed = (s) => (String(s || '').match(/[+-]\d+/) || [''])[0];
  const counter = (r) => (r.max ? r.cur + '/' + r.max : String(r.cur ?? ''));

  // "Dagger (Off-Hand)" -> Dagger / Off-Hand; "Throw Spear" -> Spear / Thrown.
  function weaponOf(name) {
    let base = name;
    let variant = '';
    const paren = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(base);
    if (paren) { base = paren[1]; variant = paren[2]; }
    const thrown = /^Throw\s+(.+)$/i.exec(base);
    if (thrown) { base = thrown[1]; variant = variant || 'Thrown'; }
    return { base: base || name, variant: variant || 'Standard' };
  }
  C.weaponOf = weaponOf;

  // The sheet titles healing rows "Cure Wounds Healing"; drop the echo.
  // A one-word remainder ("Mass Healing" -> "Mass") keeps the full name.
  function tidyName(name) {
    const m = /^(.*\S)\s+Healing$/i.exec(String(name || ''));
    return m && m[1].trim().split(/\s+/).length >= 2 ? m[1] : name;
  }
  C.tidyName = tidyName;

  function attackNode(a, label) {
    label = tidyName(label);
    const name = tidyName(a.name);
    const controls = [];
    if (a.hit) controls.push({ label: a.hit.replace(/\s*Attack$/i, ''), title: a.hit, run: { ref: a.ref, op: 'hit', say: name + ' attack' } });
    a.dmg.forEach((d, i) => {
      const heal = /heal/i.test(d.type);
      controls.push({
        label: d.text, title: heal ? 'Healing' : 'Damage' + (d.type ? ' (' + d.type + ')' : ''),
        run: { ref: a.ref, op: 'dmg', arg: i, say: name + (heal ? ' healing' : ' damage') },
      });
    });
    controls.push({ label: '💬', title: 'Show in chat', run: { ref: a.ref, op: 'chat', say: name } });
    const heals = a.dmg.length && a.dmg.every((d) => /heal/i.test(d.type));
    return {
      key: a.ref, label, hint: a.range,
      desc: [name !== label ? name : '', a.sub, a.range, ...(a.chips || [])].filter(Boolean).join(' · '),
      run: a.hit ? { ref: a.ref, op: 'hit', say: name + ' attack' }
        : heals ? { ref: a.ref, op: 'dmg', arg: 0, say: name + ' healing' } : { ref: a.ref, op: 'chat', say: name },
      controls,
    };
  }

  function attacks(snap) {
    const groups = new Map();
    for (const a of snap.attacks) {
      const w = weaponOf(tidyName(a.name));
      if (!groups.has(norm(w.base))) groups.set(norm(w.base), { base: w.base, list: [] });
      groups.get(norm(w.base)).list.push({ a, variant: w.variant });
    }
    return [...groups.values()].map((g) => {
      if (g.list.length === 1) return attackNode(g.list[0].a, g.list[0].a.name);
      const best = g.list.map((x) => signed(x.a.hit)).filter(Boolean).sort((x, y) => Number(y) - Number(x))[0] || '';
      return {
        key: 'w:' + norm(g.base), label: g.base,
        hint: g.list.length + ' attacks · best ' + best,
        children: g.list.map((x) => attackNode(x.a, x.variant)),
      };
    });
  }

  function resControls(ref, res) {
    return res.flatMap((r) => [
      { label: '−', title: 'Spend one ' + r.name, run: { ref, op: 'res', arg: { i: r.i, delta: -1 }, say: r.name + ' −1' } },
      { label: '+', title: 'Restore one ' + r.name, run: { ref, op: 'res', arg: { i: r.i, delta: 1 }, say: r.name + ' +1' } },
    ]);
  }

  function actionNode(x) {
    const res = x.res || [];
    const controls = [];
    if (x.roll) controls.push({ label: x.roll, title: 'Roll', run: { ref: x.ref, op: 'roll', say: x.name } });
    controls.push(...resControls(x.ref, res));
    controls.push({ label: '💬', title: 'Show in chat', run: { ref: x.ref, op: 'chat', say: x.name } });
    const empty = res.length && res[0].cur === 0;
    return {
      key: x.ref, label: x.name, desc: x.desc,
      hint: res.length ? res.map(counter).join(' ') : x.roll,
      disabled: !!empty,
      run: { ref: x.ref, op: 'use', say: x.name },
      controls,
    };
  }

  function bySection(list, make, order) {
    const sections = new Map();
    for (const x of list) {
      const s = x.section || 'Other';
      if (!sections.has(s)) sections.set(s, []);
      sections.get(s).push(make(x));
    }
    const keys = [...sections.keys()];
    if (order) keys.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    return keys.map((s) => ({ key: 's:' + norm(s), label: s, hint: String(sections.get(s).length), children: sections.get(s) }));
  }

  const ACTION_ORDER = ['Actions', 'Bonus Actions', 'Reactions', 'Free Actions'];

  // Items that are used up: linked to an action/attack of the same name
  // ("Healer's Kit" -> "Use Healer's Kit") or named like a consumable.
  const CONSUMABLE = /\b(potion|elixir|scroll|ammunition|arrows?|bolts?|bullets?|darts?|oil|holy water|antitoxin|ration|kit|bomb|cocktail|flask|vial|poison)\b/i;
  function linkFor(item, snap) {
    const n = norm(item.name);
    if (n.length < 3) return null;
    const pool = [...snap.actions.map((a) => ({ x: a, kind: 'action' })), ...snap.attacks.map((a) => ({ x: a, kind: 'attack' }))];
    return pool.find((p) => norm(p.x.name) === n) || pool.find((p) => n.length >= 4 && norm(p.x.name).includes(n)) || null;
  }
  C.linkFor = linkFor;
  // Weapons link to attacks too, so only a link to an action (or a
  // consumable-sounding name) marks an item as used up.
  const isConsumable = (item, snap) => CONSUMABLE.test(item.name) || (linkFor(item, snap) || {}).kind === 'action';
  C.isConsumable = isConsumable;

  function itemNode(item, snap) {
    const link = linkFor(item, snap);
    const children = [];
    if (link) {
      const x = link.x;
      children.push(link.kind === 'attack'
        ? { ...attackNode(x, 'Use: ' + x.name), key: 'use:' + x.ref }
        : { ...actionNode(x), key: 'use:' + x.ref, label: 'Use: ' + x.name });
    }
    if (item.qty !== null) {
      children.push({
        key: 'qty', label: 'Quantity', hint: String(item.qty),
        controls: [
          { label: '−', title: 'One fewer', run: { ref: item.ref, op: 'qty', arg: -1, say: item.name + ' −1' } },
          { label: '+', title: 'One more', run: { ref: item.ref, op: 'qty', arg: 1, say: item.name + ' +1' } },
        ],
      });
    }
    if (item.equipped !== null) {
      children.push({ key: 'equip', label: 'Equipped', checked: item.equipped, run: { ref: item.ref, op: 'equip', say: item.name } });
    }
    children.push({ key: 'chat', label: 'Show in chat', run: { ref: item.ref, op: 'chat', say: item.name } });
    return {
      key: item.ref, label: item.name,
      hint: (item.qty !== null && item.qty !== 1 ? '×' + item.qty : '') + (item.equipped ? ' ●' : ''),
      desc: [item.sub, item.weight !== '--' ? item.weight : ''].filter(Boolean).join(' · '),
      children,
    };
  }

  function inventory(snap) {
    const consumables = snap.items.filter((i) => isConsumable(i, snap));
    const out = [];
    if (consumables.length) {
      out.push({ key: 's:consumables', label: 'Consumables', hint: String(consumables.length), children: consumables.map((i) => itemNode(i, snap)) });
    }
    return out.concat(bySection(snap.items, (i) => itemNode(i, snap)));
  }

  function featureNode(f) {
    const res = f.res || [];
    const controls = [...resControls(f.ref, res), { label: '💬', title: 'Show in chat', run: { ref: f.ref, op: 'chat', say: f.name } }];
    return {
      key: f.ref, label: f.name, desc: [f.source, f.timing].filter(Boolean).join(' · ') + (f.desc ? '\n' + f.desc : ''),
      hint: res.length ? res.map(counter).join(' ') : f.timing,
      disabled: !!(res.length && res[0].cur === 0),
      run: res.length ? { ref: f.ref, op: 'use', say: f.name } : { ref: f.ref, op: 'chat', say: f.name },
      controls,
    };
  }

  function spells(snap) {
    const label = (l) => ({ CANTRIPS: 'Cantrips' }[l] || (/^\d/.test(l) ? l.toLowerCase() + ' level' : l || 'Spells'));
    return bySection(snap.spells.map((s) => ({ ...s, section: label(s.level) })), (s) => {
      const controls = [];
      if (s.hit) controls.push({ label: s.hit.replace(/\s*Attack$/i, ''), title: s.hit, run: { ref: s.ref, op: 'hit', say: s.name } });
      s.dmg.forEach((d, i) => controls.push({ label: d.text, title: 'Damage', run: { ref: s.ref, op: 'dmg', arg: i, say: s.name + ' damage' } }));
      return {
        key: s.ref, label: s.name,
        hint: [s.tags.join(''), s.prepared === false ? 'unprepared' : ''].filter(Boolean).join(' '),
        desc: s.range,
        run: { ref: s.ref, op: 'chat', say: 'Cast ' + s.name },
        controls,
      };
    });
  }

  // All tracked counters in one place. A feature and its action twin share
  // one counter on the sheet; list it once.
  function resources(snap) {
    const out = [];
    const seen = new Set();
    for (const x of [...snap.features, ...snap.actions]) {
      for (const r of x.res || []) {
        const k = norm(r.name);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ key: x.ref + '#' + r.i, label: r.name, hint: counter(r), disabled: r.cur === 0, controls: resControls(x.ref, [r]) });
      }
    }
    const items = snap.items.filter((i) => i.qty !== null && isConsumable(i, snap));
    for (const i of items) {
      if (seen.has(norm(i.name))) continue;
      out.push({
        key: i.ref + '#qty', label: i.name, hint: '×' + i.qty, disabled: i.qty === 0,
        controls: [
          { label: '−', title: 'One fewer', run: { ref: i.ref, op: 'qty', arg: -1, say: i.name + ' −1' } },
          { label: '+', title: 'One more', run: { ref: i.ref, op: 'qty', arg: 1, say: i.name + ' +1' } },
        ],
      });
    }
    return out;
  }

  function checks(snap) {
    const out = [];
    if (snap.initiative) out.push({ key: 'init', label: 'Initiative', hint: snap.initiative.text, run: { ref: snap.initiative.ref, op: 'press', say: 'Initiative' } });
    if (snap.abilities.length) {
      out.push({
        key: 'abilities', label: 'Abilities & saves', children: snap.abilities.map((a) => ({
          key: a.ref, label: a.name + (a.score ? ' ' + a.score : ''), hint: a.mod,
          run: { ref: a.ref, op: 'check', say: a.name + ' check' },
          controls: [
            { label: a.mod || 'Check', title: 'Ability check', run: { ref: a.ref, op: 'check', say: a.name + ' check' } },
            { label: 'Save ' + a.save, title: 'Saving throw', run: { ref: a.ref, op: 'save', say: a.name + ' save' } },
          ],
        })),
      });
    }
    const skillNode = (c) => ({
      key: c.ref, label: c.name, hint: c.bonus, desc: [c.ability, c.prof].filter(Boolean).join(' · '),
      run: { ref: c.ref, op: c.ref.startsWith('npcskill:') ? 'press' : 'check', say: c.name },
    });
    const SKILLS = new Set(['acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation',
      'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival']);
    const skills = snap.checks.filter((c) => SKILLS.has(norm(c.name)));
    const tools = snap.checks.filter((c) => !SKILLS.has(norm(c.name)));
    if (skills.length) out.push({ key: 'skills', label: 'Skills', hint: String(skills.length), children: skills.map(skillNode) });
    if (tools.length) out.push({ key: 'tools', label: snap.classic ? 'Saves & other rolls' : 'Tools', hint: String(tools.length), children: tools.map(skillNode) });
    for (const h of snap.hitDice) out.push({ key: h.ref, label: 'Hit die ' + h.label, run: { ref: h.ref, op: 'press', say: h.label } });
    return out;
  }

  function health(snap) {
    const s = snap.stats || {};
    const out = [];
    if (snap.type === 'pc') {
      out.push({ key: 'hp', header: true, label: 'HP ' + (s.hp ?? '—') + ' / ' + (s.maxHp ?? '—') + (s.tempHp ? '  (+' + s.tempHp + ' temp)' : '') });
      out.push({ key: 'dmg', label: 'Take damage', input: { placeholder: 'amount', op: 'damage' } });
      out.push({ key: 'heal', label: 'Heal', input: { placeholder: 'amount', op: 'heal' } });
      out.push({ key: 'temp', label: 'Set temp HP', input: { placeholder: String(s.tempHp ?? 0), op: 'temp' } });
    } else {
      out.push({ key: 'hp', header: true, label: 'HP ' + (s.maxHp ?? '—') + ' (average)  ·  AC ' + (s.ac ?? '—') });
    }
    for (const r of snap.rests) out.push({ key: r.ref, label: r.name, reveal: true, run: { ref: r.ref, op: 'press', say: r.name } });
    for (const h of snap.hitDice) out.push({ key: 'hd' + h.ref, label: 'Roll hit die ' + h.label, run: { ref: h.ref, op: 'press', say: h.label } });
    return out;
  }

  function rollSettings(snap, prefs) {
    const out = [];
    const radio = (group, op, title) => {
      if (!group) return;
      out.push({ key: op + ':h', header: true, label: title });
      for (const o of group.options) out.push({ key: op + ':' + o, label: o, checked: group.value === o, run: { op, arg: o, say: title + ': ' + o } });
    };
    radio(snap.privacy, 'privacy', 'Roll visibility');
    radio(snap.mode, 'mode', 'Roll mode');
    out.push({ key: 'prefs:h', header: true, label: 'Companion' });
    out.push({ key: 'pref:autoHide', label: 'Hide sheets opened for an action', checked: !!prefs.autoHide, pref: 'autoHide' });
    out.push({ key: 'pref:spend', label: 'Spend a use when using a feature', checked: !!prefs.spend, pref: 'spend' });
    out.push({ key: 'pref:follow', label: 'Follow the selected token', checked: !!prefs.follow, pref: 'follow' });
    out.push({ key: 'pref:background', label: 'Keep my character sheet loaded (players)', checked: !!prefs.background, pref: 'background' });
    out.push({ key: 'dock', label: 'Dock bar beside the toolbar', dock: true });
    out.push({ key: 'diag', label: 'Copy diagnostics', diag: true });
    return out;
  }

  const LISTS = ['attacks', 'actions', 'features', 'items', 'spells', 'abilities', 'checks', 'hitDice', 'rests'];
  C.buildMenus = function buildMenus(raw, prefs = {}) {
    // No character yet: still offer the companion settings and diagnostics.
    if (!raw) return [{ key: 'settings', icon: 'gear', label: 'Settings', items: rollSettings({}, prefs) }];
    // Tolerate snapshots with missing parts (older saves, unusual sheets).
    const snap = { ...raw, stats: raw.stats || {} };
    for (const k of LISTS) if (!Array.isArray(snap[k])) snap[k] = [];
    // Each menu is built on its own: one odd row only empties that menu.
    const errors = [];
    const safe = (key, fn) => { try { return fn(); } catch (e) { errors.push(key + ': ' + (e && e.message || e)); return []; } };
    const cats = [
      { key: 'hp', icon: 'heart', label: 'Hit points & rests', items: safe('hp', () => health(snap)) },
      { key: 'attacks', icon: 'sword', label: 'Attacks', items: safe('attacks', () => attacks(snap)) },
      {
        key: 'actions', icon: 'bolt', label: 'Actions',
        items: safe('actions', () => bySection(snap.actions.concat(snap.type === 'npc' ? snap.attacks.map((a) => ({ ...a, npcAttack: true })) : []),
          (x) => (x.npcAttack ? attackNode(x, x.name) : actionNode(x)), ACTION_ORDER)),
      },
      { key: 'spells', icon: 'spark', label: 'Spells', items: safe('spells', () => spells(snap)) },
      { key: 'items', icon: 'bag', label: 'Inventory', items: safe('items', () => inventory(snap)) },
      { key: 'features', icon: 'star', label: 'Features & traits', items: safe('features', () => bySection(snap.features, featureNode)) },
      { key: 'resources', icon: 'hourglass', label: 'Resources', items: safe('resources', () => resources(snap)) },
      { key: 'checks', icon: 'd20', label: 'Checks & saves', items: safe('checks', () => checks(snap)) },
      { key: 'settings', icon: 'gear', label: 'Roll settings', items: safe('settings', () => rollSettings(snap, prefs)) },
    ];
    C.lastMenuErrors = errors;
    return cats.filter((c) => c.items.length);
  };
})(globalThis);
