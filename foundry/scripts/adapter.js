// Foundry VTT (dnd5e system): reads an actor into the same snapshot shape the
// Roll20 sheet readers produce, so the shared menu model (model.js) builds the
// menus, and performs the bar's actions through the dnd5e system's own API.
(function (G) {
  'use strict';
  const C = (G.R20C = G.R20C || {});

  const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const signed = (v) => { const n = num(v); return n === null ? '' : (n >= 0 ? '+' : '') + n; };
  const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  const cfg = () => (G.CONFIG && G.CONFIG.DND5E) || {};
  const loc = (s) => { try { return G.game && G.game.i18n ? G.game.i18n.localize(String(s)) : String(s); } catch { return String(s); } };
  const list = (c) => (!c ? [] : Array.isArray(c) ? c : Array.from(typeof c.values === 'function' ? c.values() : c));
  const activities = (item) => list(item.system && item.system.activities);
  const has = (set, k) => !!set && (typeof set.has === 'function' ? set.has(k) : Array.isArray(set) && set.includes(k));

  const ACTIVATION = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', legendary: 'Legendary Action', lair: 'Lair Action', mythic: 'Mythic Action', minute: 'Minute', hour: 'Hour', special: 'Special' };
  function activationLabel(type) {
    if (!type) return '';
    const c = cfg().activityActivationTypes && cfg().activityActivationTypes[type];
    const l = c && c.label ? loc(c.label) : '';
    return l && !/^DND5E\./.test(l) ? l : ACTIVATION[type] || type[0].toUpperCase() + type.slice(1);
  }
  function itemActivation(item) {
    const s = item.system || {};
    const own = s.activation && s.activation.type;
    const first = activities(item).find((a) => a.activation && a.activation.type);
    return activationLabel(own || (first && first.activation.type));
  }
  const SECTION_OF_TIMING = (t) => {
    const e = C.econOf ? C.econOf(t) : null;
    if (e === 'bonus') return 'Bonus Actions';
    if (e === 'reaction') return 'Reactions';
    if (e === 'action') return 'Actions';
    if (/legendary/i.test(t)) return 'Legendary Actions';
    if (/lair/i.test(t)) return 'Lair Actions';
    return 'Other';
  };
  const FEAT_SECTIONS = { class: 'Class Features', subclass: 'Class Features', race: 'Species Traits', species: 'Species Traits', feat: 'Feats', background: 'Background', monster: 'Features', supernaturalGift: 'Supernatural Gifts', enchantment: 'Enchantments' };
  const GEAR = { weapon: 'Weapons', equipment: 'Equipment', consumable: 'Consumables', tool: 'Tools', loot: 'Loot', container: 'Containers' };
  const dmgOf = (a) => ((a && a.labels && a.labels.damage) || []).map((d) => ({ text: d.formula || d.label || 'Damage', type: d.damageType || '' }));
  const usesOf = (item) => {
    const u = item.system && item.system.uses;
    return u && num(u.max) > 0 ? [{ i: 0, name: item.name, kind: 'count', cur: num(u.value) ?? 0, max: num(u.max) }] : [];
  };
  function toolLabel(key) {
    try {
      const T = G.dnd5e && G.dnd5e.documents && G.dnd5e.documents.Trait;
      const l = T && T.keyLabel && T.keyLabel(key, { trait: 'tool' });
      if (l) return l;
    } catch { /* fall back to the key */ }
    return key;
  }

  // A dnd5e description (HTML with enrichers) as readable plain text for the
  // bar's tooltip. Parsed with DOMParser, which never runs scripts or loads
  // anything; only its text is kept.
  function plainText(html, max = 8000) {
    let t = String(html || '');
    if (!t.trim() || /^\s*(null|undefined)\s*$/i.test(t)) return '';
    t = t.replace(/<(script|style|template)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
      .replace(/@(\w+)\[([^\]]*)\]/g, (m, k, v) => String(v).split(/[.|]/).pop())
      .replace(/\[\[\/\w+\s+([^\]]*?)\]\](?:\{([^}]*)\})?/g, (m, f, l) => l || f)
      .replace(/\[\[([^\]]*)\]\]/g, '$1')
      .replace(/&Reference\[([^\]]*)\](?:\{([^}]*)\})?/g, (m, r, l) => l || String(r).split(/[ =]/)[0])
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr|section|blockquote)>/gi, '\n').replace(/<li[^>]*>/gi, '• ');
    let text = t;
    try {
      const P = G.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
      if (P) text = new P().parseFromString('<body>' + t + '</body>', 'text/html').body.textContent || '';
      else text = t.replace(/<[^>]+>/g, '');
    } catch { text = t.replace(/<[^>]+>/g, ''); }
    text = text.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (/^(null|undefined)$/i.test(text)) return '';
    return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
  }
  // "1st-level Evocation · V, S, M · Concentration, up to 1 minute"
  function spellLine(item, level) {
    const L = item.labels || {};
    const comp = L.components && (L.components.vsm || (Array.isArray(L.components.all) ? L.components.all.map((c) => c.abbr || c.label).join(', ') : ''));
    const school = L.school || '';
    return [level === 0 ? (school ? school + ' cantrip' : 'Cantrip') : ORD(level) + '-level' + (school ? ' ' + school : ''), comp, L.duration, L.materials].filter(Boolean).join(' · ');
  }
  // Players see an unidentified item's own description, not the real one.
  function infoOf(item) {
    const s = item.system || {};
    const gm = !!(G.game && G.game.user && G.game.user.isGM);
    if (s.identified === false && !gm) return plainText(s.unidentified && s.unidentified.description);
    return plainText(s.description && s.description.value);
  }

  function addItem(snap, item) {
    const s = item.system || {};
    const ref = 'item:' + item.id;
    const info = infoOf(item);
    const acts = activities(item);
    const timing = itemActivation(item);
    const range = (item.labels && item.labels.range) || '';
    if (item.type === 'spell') {
      const atk = acts.find((a) => a.type === 'attack');
      const save = acts.find((a) => a.type === 'save');
      const level = num(s.level) || 0;
      const prepares = !!(cfg().spellcasting && cfg().spellcasting[s.method] && cfg().spellcasting[s.method].prepares);
      snap.spells.push({
        ref, name: item.name, level: level === 0 ? 'CANTRIPS' : ORD(level), range, time: timing,
        hit: atk && atk.labels && atk.labels.toHit ? atk.labels.toHit + ' Attack' : (save && save.labels && save.labels.save) || '',
        dmg: dmgOf(acts.find((a) => dmgOf(a).length)),
        tags: [has(s.properties, 'concentration') ? 'C' : '', has(s.properties, 'ritual') ? 'R' : ''].filter(Boolean),
        prepared: prepares ? num(s.prepared) > 0 : null,
        info: [spellLine(item, level), info].filter(Boolean).join('\n\n'),
      });
      return;
    }
    const attacks = acts.filter((a) => a.type === 'attack');
    attacks.forEach((a, i) => {
      const generic = !a.name || /^attack$/i.test(a.name);
      snap.attacks.push({
        ref: 'act:' + item.id + ':' + a.id,
        name: attacks.length > 1 ? item.name + ' (' + (generic ? 'Attack ' + (i + 1) : a.name) + ')' : item.name,
        section: timing || 'Action', sub: '', range: (a.labels && a.labels.range) || range,
        hit: a.labels && a.labels.toHit ? a.labels.toHit + ' Attack' : 'Attack', dmg: dmgOf(a), chips: [], info,
      });
    });
    if (GEAR[item.type]) {
      const w = s.weight;
      snap.items.push({
        ref, name: item.name, section: GEAR[item.type], sub: '',
        qty: num(s.quantity), weight: w && num(w.value) ? w.value + ' ' + (w.units || 'lb') : '',
        equipped: 'equipped' in s && (item.type === 'weapon' || item.type === 'equipment') ? !!s.equipped : null,
        consumable: item.type === 'consumable', usable: acts.length > 0 && !attacks.length, timing, info,
      });
      return;
    }
    if (item.type === 'feat') {
      const res = usesOf(item);
      const kind = s.type && s.type.value;
      if (acts.length && !attacks.length && timing) {
        snap.actions.push({ ref, name: item.name, section: SECTION_OF_TIMING(timing), desc: '', roll: '', res, info });
      }
      snap.features.push({ ref, name: item.name, section: FEAT_SECTIONS[kind] || 'Features', source: '', timing, desc: '', res, usable: acts.length > 0, info });
    }
  }

  C.foundrySnap = function foundrySnap(actor) {
    const sys = actor.system || {};
    const attr = sys.attributes || {};
    const hp = attr.hp || {};
    const isPc = actor.type === 'character';
    const mv = attr.movement || {};
    const speeds = {};
    for (const k of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
      const v = num((mv.speeds && mv.speeds[k]) ?? mv[k]);
      if (v > 0) speeds[k] = v;
    }
    const death = attr.death || {};
    const snap = {
      v: 1, foundry: true, hpEditable: true, type: isPc ? 'pc' : 'npc', name: actor.name, at: Date.now(),
      stats: {
        hp: num(hp.value), maxHp: num(hp.max), tempHp: num(hp.temp) || 0, ac: num(attr.ac && attr.ac.value),
        speed: speeds.walk || null, speeds, units: mv.units || '',
        deathSaves: isPc ? { ok: num(death.success) || 0, fail: num(death.failure) || 0 } : null,
        initiative: signed(attr.init && (attr.init.total ?? attr.init.mod)),
      },
      privacy: { options: ROLL_MODES.map((m) => m[0]), value: (ROLL_MODES.find((m) => m[1] === coreRollMode()) || ROLL_MODES[0])[0] },
      mode: { options: ADV_MODES, value: advMode() },
      attacks: [], actions: [], features: [], items: [], spells: [],
      abilities: [], checks: [], hitDice: [], rests: [], initiative: null, errors: [],
    };
    for (const item of list(actor.items)) {
      try { addItem(snap, item); } catch (e) { snap.errors.push(item.name + ': ' + (e && e.message || e)); }
    }
    const abilities = sys.abilities || {};
    for (const k of Object.keys(abilities)) {
      const a = abilities[k] || {};
      snap.abilities.push({ ref: 'ability:' + k, name: k.toUpperCase(), score: num(a.value), mod: signed(a.mod), save: signed(a.save && typeof a.save === 'object' ? a.save.value : a.save) });
    }
    for (const [k, sk] of Object.entries(sys.skills || {})) {
      const label = cfg().skills && cfg().skills[k] ? loc(cfg().skills[k].label) : k;
      snap.checks.push({ ref: 'skill:' + k, name: label, ability: String(sk.ability || '').toUpperCase(), bonus: signed(sk.total ?? sk.mod),
        prof: sk.value >= 2 ? 'Expertise' : sk.value >= 1 ? 'Proficient' : sk.value > 0 ? 'Half proficient' : '' });
    }
    for (const [k, t] of Object.entries(sys.tools || {})) {
      snap.checks.push({ ref: 'tool:' + k, name: toolLabel(k), ability: String(t.ability || '').toUpperCase(), bonus: signed(t.total ?? t.mod), prof: '' });
    }
    snap.initiative = { ref: 'init', text: snap.stats.initiative };
    if (isPc) {
      for (const cls of list(actor.items).filter((i) => i.type === 'class')) {
        const hd = (cls.system && cls.system.hd) || {};
        if (!hd.denomination) continue;
        snap.hitDice.push({ ref: 'hd:' + hd.denomination, name: cls.name, label: hd.denomination + ' (' + cls.name + ')' + (num(hd.value) !== null ? ' · ' + hd.value + ' left' : '') });
      }
      snap.deathSave = { ref: 'death' };
    }
    snap.rests.push({ ref: 'rest:short', name: 'Short Rest' }, { ref: 'rest:long', name: 'Long Rest' });

    // Spell slots left, by level, then pact slots.
    snap.slots = [];
    const sp = sys.spells || {};
    for (let l = 1; l <= 9; l++) {
      const x = sp['spell' + l];
      if (x && num(x.max) > 0) snap.slots.push({ ref: 'slot:spell' + l, label: ORD(l) + ' level', cur: num(x.value) ?? 0, max: num(x.max) });
    }
    if (sp.pact && num(sp.pact.max) > 0) snap.slots.push({ ref: 'slot:pact', label: 'Pact (' + ORD(num(sp.pact.level) || 1) + ')', cur: num(sp.pact.value) ?? 0, max: num(sp.pact.max) });

    // Conditions the token can have, and the other effects on the character.
    const statusList = list(G.CONFIG && G.CONFIG.statusEffects).filter((e) => e && e.id && e.hud !== false && !['concentrating', 'exhaustion', 'dead'].includes(e.id));
    const on = actor.statuses || new Set();
    snap.conditions = statusList.map((e) => ({ ref: 'status:' + e.id, name: loc(e.name || e.label || e.id), active: on.has(e.id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const statusIds = new Set(statusList.map((e) => e.id).concat(['concentrating', 'exhaustion', 'dead']));
    snap.effects = [];
    const all = typeof actor.allApplicableEffects === 'function' ? [...actor.allApplicableEffects()] : list(actor.effects);
    for (const e of all) {
      if (!e || (e.statuses && [...e.statuses].some((x) => statusIds.has(x)))) continue;
      const from = e.parent && e.parent !== actor ? e.parent.name : '';
      snap.effects.push({ ref: 'effect:' + e.id, name: e.name || 'Effect', active: !e.disabled, source: from, info: plainText(e.description) });
    }

    // The sheet's favorites, as the bar names the same things.
    snap.favorites = [];
    for (const f of list(sys.favorites)) {
      const id = String(f && f.id || '');
      if (f.type === 'item') snap.favorites.push(id.split('.').pop());
      else if (f.type === 'activity') snap.favorites.push(id.split('.').filter(Boolean).slice(-3)[0] || id);
      else if (f.type === 'skill') snap.favorites.push('skill:' + id);
      else if (f.type === 'tool') snap.favorites.push('tool:' + id);
      else if (f.type === 'slots') snap.favorites.push('slot:' + id);
      else if (f.type === 'effect') snap.favorites.push('effect:' + id.split('.').pop());
    }
    return snap;
  };

  // The actor's concentration, for the Hit points menu.
  C.foundryConcentration = function (actor, dc) {
    const c = actor.concentration;
    if (!c || !c.effects || !c.effects.size) return null;
    const names = list(c.items).map((i) => i.name).filter(Boolean);
    return { spell: names.join(', '), dc: dc || null };
  };

  const hpText = (actor) => {
    const hp = (actor.system && actor.system.attributes && actor.system.attributes.hp) || {};
    return 'HP ' + hp.value + (hp.temp ? ' (+' + hp.temp + ' temp)' : '');
  };
  // Roll settings, as on Roll20: who sees the roll (Foundry's roll mode) and
  // advantage for the bar's d20 rolls.
  const ROLL_MODES = [['Public', 'publicroll'], ['Private GM', 'gmroll'], ['Blind GM', 'blindroll'], ['Self', 'selfroll']];
  const ADV_MODES = ['Ask each time', 'Normal', 'Advantage', 'Disadvantage'];
  function coreRollMode() { try { return game.settings.get('core', 'rollMode'); } catch { return 'publicroll'; } }
  function advMode() { try { return game.settings.get('foundryembetterment', 'advantage') || ADV_MODES[0]; } catch { return ADV_MODES[0]; } }
  // [config, dialog] for a dnd5e d20 roll: advantage / disadvantage / no dialog.
  function d20(extra = {}) {
    const m = advMode();
    const config = { ...extra };
    const dialog = {};
    if (m === 'Advantage') { config.advantage = true; dialog.configure = false; }
    else if (m === 'Disadvantage') { config.disadvantage = true; dialog.configure = false; }
    else if (m === 'Normal') dialog.configure = false;
    return [config, dialog];
  }
  C.foundryAdvMode = advMode;
  // The chat card each attack last posted, so rolls made from the bar attach
  // to it (dnd5e then offers Apply Damage on it, as from the card's buttons).
  const lastCard = new Map();
  const keyOf = (a) => a.uuid || a.id;
  function originOf(a) {
    const id = lastCard.get(keyOf(a));
    const msgs = G.game && G.game.messages;
    return id && (!msgs || msgs.get(id)) ? { data: { system: { origin: id } } } : {};
  }

  // A roll returns null when its dialog is closed without rolling.
  // (dnd5e returns null or nothing when a roll or use dialog is closed.)
  const rolled = (r, msg) => (r === null || r === undefined ? { ok: false, msg: 'Cancelled.' } : { ok: true, msg: msg || 'Rolled.' });

  C.foundryPerform = async function foundryPerform(actor, act) {
    const ref = String(act.ref || '');
    const [kind, a1, a2] = ref.split(':');
    const n = Math.max(0, Math.floor(Number(act.arg) || 0));
    switch (act.op) {
      case 'damage':
      case 'heal':
        if (!n) return { ok: false, msg: 'Enter an amount.' };
        await actor.applyDamage(act.op === 'damage' ? n : -n);
        return { ok: true, msg: hpText(actor) };
      case 'temp':
        await actor.update({ 'system.attributes.hp.temp': n });
        return { ok: true, msg: 'Temp HP ' + n };
      case 'conc-start': {
        const id = (G.CONFIG && G.CONFIG.specialStatusEffects && G.CONFIG.specialStatusEffects.CONCENTRATING) || 'concentrating';
        await actor.toggleStatusEffect(id, { active: true });
        return { ok: true, msg: 'Concentrating.' };
      }
      case 'conc-end':
        await actor.endConcentration();
        return { ok: true, msg: 'Concentration ended.' };
      case 'privacy': {
        const m = ROLL_MODES.find((x) => x[0] === act.arg);
        if (m) await game.settings.set('core', 'rollMode', m[1]);
        return { ok: !!m, msg: 'Rolls: ' + act.arg };
      }
      case 'mode':
        if (!ADV_MODES.includes(act.arg)) return { ok: false, msg: 'Unknown roll mode.' };
        await game.settings.set('foundryembetterment', 'advantage', act.arg);
        return { ok: true, msg: 'Roll mode: ' + act.arg };
      default: break;
    }
    if (act.clearsDc) return rolled(await actor.rollConcentration(...d20({ target: Number(act.dc) || 10 })));
    if (kind === 'ability') return rolled(act.op === 'save' ? await actor.rollSavingThrow(...d20({ ability: a1 })) : await actor.rollAbilityCheck(...d20({ ability: a1 })));
    if (kind === 'skill') return rolled(await actor.rollSkill(...d20({ skill: a1 })));
    if (kind === 'tool') return rolled(await actor.rollToolCheck(...d20({ tool: a1 })));
    if (kind === 'init') { await actor.rollInitiativeDialog(); return { ok: true, msg: '' }; }
    if (kind === 'death') return rolled(await actor.rollDeathSave(...d20()));
    if (kind === 'hd') return rolled(await actor.rollHitDie({ denomination: a1 }));
    if (kind === 'rest') {
      const r = a1 === 'long' ? await actor.longRest() : await actor.shortRest();
      return r === false || r === null ? { ok: false, msg: 'Cancelled.' } : { ok: true, msg: 'Rested.' };
    }
    if (kind === 'slot' && act.op === 'res') {
      const x = ((actor.system && actor.system.spells) || {})[a1] || {};
      const max = num(x.max) || 0;
      const v = Math.min(max, Math.max(0, (num(x.value) || 0) + (Number(act.arg && act.arg.delta) || 0)));
      await actor.update({ ['system.spells.' + a1 + '.value']: v });
      return { ok: true, msg: v + '/' + max };
    }
    if (kind === 'status') {
      const active = await actor.toggleStatusEffect(a1);
      return { ok: true, msg: (active ? 'On: ' : 'Off: ') + a1 };
    }
    if (kind === 'effect') {
      const all = typeof actor.allApplicableEffects === 'function' ? [...actor.allApplicableEffects()] : list(actor.effects);
      const e = all.find((x) => x.id === a1);
      if (!e) return { ok: false, msg: 'That effect is gone.' };
      await e.update({ disabled: !e.disabled });
      return { ok: true, msg: e.name + (e.disabled ? ' off' : ' on') };
    }
    if (kind !== 'item' && kind !== 'act') return { ok: false, msg: 'Unknown action.' };
    const item = actor.items.get(a1);
    if (!item) return { ok: false, msg: 'That item is no longer on the character.' };
    const acts = activities(item);
    const activity = kind === 'act' ? acts.find((a) => a.id === a2) : null;
    const s = item.system || {};
    switch (act.op) {
      case 'hit': {
        const a = activity || acts.find((x) => x.type === 'attack');
        if (!a) return rolled(await item.use(), 'Used.');
        // A spell's attack: the spell was cast already (Cast posts its card).
        if (item.type === 'spell' || typeof a.use !== 'function') return rolled(await a.rollAttack(...d20(), originOf(a)));
        // As the sheet does it: the item's card (with its Damage button and
        // Apply Damage), ammunition and uses spent, then the attack roll tied
        // to that card. A set roll mode rolls the attack here with it.
        const ask = advMode() === ADV_MODES[0];
        const res = await a.use({ subsequentActions: ask });
        if (!res) return { ok: false, msg: 'Cancelled.' };
        if (res.message && res.message.id) lastCard.set(keyOf(a), res.message.id);
        if (ask) return { ok: true, msg: 'Attack.' };
        return rolled(await a.rollAttack(...d20(), originOf(a)));
      }
      case 'dmg': {
        const a = activity && dmgOf(activity).length ? activity : acts.find((x) => dmgOf(x).length);
        // Tied to the item's card from the last attack, like its Damage button.
        return a ? rolled(await a.rollDamage({}, {}, originOf(a))) : { ok: false, msg: 'Nothing to roll.' };
      }
      case 'chat':
        if (item.type === 'spell') return rolled(await item.use(), 'Cast.');
        await item.displayCard();
        return { ok: true, msg: 'Posted to chat.' };
      case 'use':
      case 'roll':
        return rolled(activity ? await activity.use() : await item.use(), 'Used.');
      case 'res': {
        const u = s.uses || {};
        const max = num(u.max) || 0;
        const spent = Math.min(max, Math.max(0, (num(u.spent) || 0) - (Number(act.arg && act.arg.delta) || 0)));
        await item.update({ 'system.uses.spent': spent });
        return { ok: true, msg: (max - spent) + '/' + max };
      }
      case 'qty': {
        const q = Math.max(0, (num(s.quantity) || 0) + (Number(act.arg) || 0));
        await item.update({ 'system.quantity': q });
        return { ok: true, msg: 'Quantity ' + q };
      }
      case 'equip':
        await item.update({ 'system.equipped': !s.equipped });
        return { ok: true, msg: s.equipped ? 'Unequipped' : 'Equipped' };
      default:
        return { ok: false, msg: 'Not available in Foundry.' };
    }
  };
})(globalThis);
