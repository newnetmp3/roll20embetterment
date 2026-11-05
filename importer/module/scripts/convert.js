// Roll20 (R20Exporter format) -> Foundry VTT v14 / dnd5e 6 data.
// Pure functions: plain objects in, plain document data out. No Foundry
// globals, so this file is unit-tested in Node. app.js does the creating.

export const GRID_PX = 70; // Roll20's unit: 70 px per grid square at snapping 1

// ---- small helpers ---------------------------------------------------------
export const num = (v) => {
  const m = String(v ?? '').replace(/[−–]/g, '-').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const para = (s) => (s ? String(s).split(/\n{2,}/).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('') : '');
const on = (v) => ['1', 'on', 'true', 'yes'].includes(String(v ?? '').toLowerCase().trim());
export const listOf = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean);
let idCounter = 0;
// 16-character ids, the same shape as Foundry's own.
export function randomID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  idCounter++;
  return s;
}

// ---- reading a Roll20 sheet's attributes ------------------------------------
// Repeating rows look like repeating_<section>_<rowid>_<field>. Row ids are
// 20 characters starting with "-" (some API-made rows differ: fallback).
export function readSheet(ch) {
  const flat = new Map();
  const rep = new Map();
  for (const a of ch.attributes || ch.attribs || []) {
    const name = String(a.name || '');
    const m = /^repeating_(.+?)_(-[A-Za-z0-9_-]{19})_(.+)$/.exec(name) || /^repeating_([^_]+)_([^_]+)_(.+)$/.exec(name);
    if (m) {
      const sec = m[1].toLowerCase();
      if (!rep.has(sec)) rep.set(sec, new Map());
      const rows = rep.get(sec);
      const row = rows.get(m[2]) || { _id: m[2] };
      const f = m[3].toLowerCase();
      row[f] = a.current ?? '';
      if (a.max !== undefined && a.max !== '') row[f + '_max'] = a.max;
      rows.set(m[2], row);
    } else flat.set(name.toLowerCase(), a);
  }
  const get = (k) => { const a = flat.get(k); return a ? String(a.current ?? '') : ''; };
  const max = (k) => { const a = flat.get(k); return a ? String(a.max ?? '') : ''; };
  const rows = (sec) => {
    const map = rep.get(sec);
    if (!map) return [];
    const order = listOf(get('_reporder_repeating_' + sec)).map((x) => x.toLowerCase());
    const list = [...map.values()];
    const pos = (r) => { const i = order.indexOf(r._id.toLowerCase()); return i < 0 ? 1e6 : i; };
    return list.sort((a, b) => pos(a) - pos(b));
  };
  const sections = () => [...rep.keys()];
  const first = (...ks) => { for (const k of ks) { const v = get(k); if (v !== '') return v; } return ''; };
  return { get, max, rows, sections, first, has: (k) => flat.has(k) };
}

// ---- 5e vocabulary --------------------------------------------------------------
export const ABILITIES = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
export const SKILLS = {
  acr: 'acrobatics', ani: 'animal_handling', arc: 'arcana', ath: 'athletics', dec: 'deception', his: 'history',
  ins: 'insight', itm: 'intimidation', inv: 'investigation', med: 'medicine', nat: 'nature', prc: 'perception',
  prf: 'performance', per: 'persuasion', rel: 'religion', slt: 'sleight_of_hand', ste: 'stealth', sur: 'survival',
};
const SIZES = { tiny: 'tiny', small: 'sm', medium: 'med', large: 'lg', huge: 'huge', gargantuan: 'grg' };
const DAMAGE = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
const CREATURE_TYPES = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];
const SCHOOLS = { abjuration: 'abj', conjuration: 'con', divination: 'div', enchantment: 'enc', evocation: 'evo', illusion: 'ill', necromancy: 'nec', transmutation: 'trs' };

export function damageType(s) {
  const t = String(s || '').toLowerCase();
  if (/heal/.test(t)) return 'healing';
  if (/temp/.test(t)) return 'temphp';
  return DAMAGE.find((d) => t.includes(d)) || '';
}
export function parseCR(s) {
  const t = String(s || '').trim();
  const f = /^(\d+)\s*\/\s*(\d+)/.exec(t);
  if (f) return Number(f[1]) / Number(f[2]);
  return num(t);
}
// "Medium humanoid (elf), chaotic evil"
export function parseType(s) {
  const t = clean(s);
  const m = /^(tiny|small|medium|large|huge|gargantuan)?\s*([^,(]*?)\s*(?:\(([^)]*)\))?\s*(?:,\s*(.*))?$/i.exec(t) || [];
  const size = SIZES[String(m[1] || '').toLowerCase()] || 'med';
  const kind = String(m[2] || '').toLowerCase().replace(/^swarm of .*/, 'beast');
  const type = CREATURE_TYPES.find((c) => kind.includes(c));
  return { size, type: { value: type || (kind ? 'custom' : ''), subtype: clean(m[3]), custom: type ? '' : clean(m[2]) }, alignment: clean(m[4]) };
}
export function parseSpeeds(s) {
  const t = String(s || '').toLowerCase();
  const out = {};
  const first = /^\s*(\d+)/.exec(t);
  if (first) out.walk = Number(first[1]);
  for (const m of t.matchAll(/\b(walk|fly|swim|climb|burrow)\w*\s*(\d+)/g)) out[m[1]] = Number(m[2]);
  return { speeds: out, hover: /hover/.test(t) };
}
export function parseSenses(s) {
  const t = String(s || '');
  const ranges = {};
  const rest = [];
  for (const part of t.split(/[,;]/)) {
    const m = /(darkvision|blindsight|tremorsense|truesight)\s*(\d+)/i.exec(part);
    if (m) ranges[m[1].toLowerCase()] = Number(m[2]);
    else if (clean(part) && !/passive perception/i.test(part)) rest.push(clean(part));
  }
  return { ranges, special: rest.join(', ') };
}

// Roll20 formula -> plain dice formula. @{strength_mod} etc. become numbers.
export function resolveFormula(f, sheet, abilityMods = {}) {
  let s = String(f || '').replace(/\[\[|\]\]/g, '');
  s = s.replace(/@\{([^}]+)\}/g, (_, k) => {
    k = k.toLowerCase().replace(/^selected\||^target\|/, '');
    const am = /^(strength|dexterity|constitution|intelligence|wisdom|charisma)_mod$/.exec(k);
    if (am) return String(abilityMods[Object.keys(ABILITIES).find((x) => ABILITIES[x] === am[1])] ?? 0);
    const v = num(sheet ? sheet.get(k) : '');
    return v === null ? '0' : String(v);
  });
  s = s.replace(/\[[^\]]*\]/g, ''); // inline labels like 1d6[fire]
  s = s.replace(/\+\s*-/g, '- ').replace(/\s+/g, ' ').replace(/(^|[^\d)])\s*\+\s*0\b/g, '$1').trim();
  return /^[\d\sd+\-*/()kKhHlL]+$/.test(s) && /\d/.test(s) ? s : '';
}

// "(Recharge 5-6)", "(3/Day)", "(Costs 2 Actions)" in an action's name.
function usageOf(name, desc) {
  const t = name + ' ' + (desc || '').slice(0, 200);
  const out = {};
  const rech = /recharge\s*(\d)/i.exec(t);
  if (rech) out.recharge = { value: Number(rech[1]), charged: true };
  const perDay = /\((\d+)\s*\/\s*day/i.exec(name);
  if (perDay) out.uses = { value: Number(perDay[1]), max: perDay[1], per: 'day', recovery: '' };
  const cost = /costs?\s*(\d+)\s*actions?/i.exec(t);
  if (cost) out.cost = Number(cost[1]);
  return out;
}
function saveOf(desc) {
  const m = /DC\s*(\d+)\s*(strength|dexterity|constitution|intelligence|wisdom|charisma)/i.exec(desc || '');
  if (!m) return null;
  const ability = Object.keys(ABILITIES).find((k) => ABILITIES[k] === m[2].toLowerCase());
  return { ability, dc: Number(m[1]), scaling: 'flat' };
}
function rangeOf(text) {
  const t = String(text || '');
  const reach = /reach\s*(\d+)/i.exec(t);
  const r = /(\d+)\s*\/\s*(\d+)/.exec(t) || /range\s*(\d+)/i.exec(t) || /^(\d+)/.exec(t.trim());
  if (reach) return { value: Number(reach[1]), long: null, units: 'ft' };
  if (r) return { value: Number(r[1]), long: r[2] ? Number(r[2]) : null, units: 'ft' };
  if (/self/i.test(t)) return { value: null, long: null, units: 'self' };
  if (/touch/i.test(t)) return { value: null, long: null, units: 'touch' };
  return { value: null, long: null, units: '' };
}
// Items built in the pre-4.0 dnd5e shape; dnd5e's own migration turns
// actionType / attack / damage / save into proper activities on creation.
const LEGACY = { _stats: { systemVersion: '3.3.1' } };
function legacyItem(type, name, system, extra = {}) {
  return { _id: randomID(), name: clean(name).slice(0, 200) || 'Unnamed', type, effects: [], ...LEGACY, system, ...extra };
}

// ---- NPC (Classic "5th Edition OGL" sheet) ------------------------------------
function npcAction(row, activation, sheet, mods) {
  const name = clean(row.name) || 'Action';
  const desc = row.description || row.desc || '';
  const use = usageOf(name, desc);
  const system = {
    description: { value: para(desc) }, type: { value: 'monster' },
    activation: { type: activation, cost: use.cost || (activation ? 1 : null) },
  };
  if (use.recharge) system.recharge = use.recharge;
  if (use.uses) system.uses = use.uses;
  const parts = [];
  for (const [d, t] of [[row.attack_damage, row.attack_damagetype], [row.attack_damage2, row.attack_damagetype2]]) {
    const f = resolveFormula(d, sheet, mods);
    if (f) parts.push([f, damageType(t)]);
  }
  if (on(row.attack_flag) || num(row.attack_tohit) !== null && row.attack_tohit !== '') {
    const ranged = /ranged/i.test(row.attack_type || '');
    system.actionType = ranged ? 'rwak' : 'mwak';
    system.attack = { bonus: String(num(row.attack_tohit) ?? 0), flat: true };
    system.damage = { parts };
    system.range = rangeOf(row.attack_range);
  } else if (parts.length) {
    system.actionType = 'other';
    system.damage = { parts };
  }
  const save = saveOf(desc);
  if (save) { system.save = save; if (!system.actionType) system.actionType = 'save'; }
  return legacyItem('feat', name, system);
}

// ---- spells -----------------------------------------------------------------------
export function spellRows(sheet) {
  const out = [];
  for (const sec of sheet.sections()) {
    const m = /^spell-(cantrip|npc|\d)$/.exec(sec);
    if (!m) continue;
    for (const r of sheet.rows(sec)) {
      const name = clean(r.spellname);
      if (!name) continue;
      out.push({ ...r, name, level: m[1] === 'cantrip' ? 0 : m[1] === 'npc' ? (num(r.spelllevel) ?? 0) : Number(m[1]) });
    }
  }
  return out;
}
export function spellItem(r, sheet, mods) {
  const props = [];
  if (/1|on|concentration/i.test(r.spellconcentration || '')) props.push('concentration');
  if (/1|on|ritual/i.test(r.spellritual || '')) props.push('ritual');
  if (on(r.spellcomp_v)) props.push('vocal');
  if (on(r.spellcomp_s)) props.push('somatic');
  if (on(r.spellcomp_m)) props.push('material');
  const time = String(r.spellcastingtime || '').toLowerCase();
  const activation = /bonus/.test(time) ? 'bonus' : /reaction/.test(time) ? 'reaction' : /minute/.test(time) ? 'minute' : /hour/.test(time) ? 'hour' : 'action';
  const system = {
    level: r.level, school: SCHOOLS[String(r.spellschool || '').toLowerCase()] || '',
    description: { value: para(r.spelldescription) + (r.spellathigherlevels ? '<p><strong>At Higher Levels.</strong> ' + esc(r.spellathigherlevels) + '</p>' : '') },
    activation: { type: activation, cost: num(time) || 1 },
    range: rangeOf(r.spellrange), properties: props,
    materials: { value: clean(r.spellcomp_materials) },
    preparation: { mode: 'prepared', prepared: r.level === 0 || on(r.spellprepared) },
  };
  const parts = [];
  const dmg = resolveFormula(r.spelldamage, sheet, mods);
  if (dmg) parts.push([dmg, damageType(r.spelldamagetype)]);
  const dmg2 = resolveFormula(r.spelldamage2, sheet, mods);
  if (dmg2) parts.push([dmg2, damageType(r.spelldamagetype2)]);
  const heal = resolveFormula(r.spellhealing, sheet, mods);
  if (heal) parts.push([heal, 'healing']);
  const attack = String(r.spellattack || '').toLowerCase();
  if (/melee/.test(attack)) system.actionType = 'msak';
  else if (/ranged/.test(attack)) system.actionType = 'rsak';
  else if (r.spellsave) system.actionType = 'save';
  else if (heal) system.actionType = 'heal';
  else if (parts.length) system.actionType = 'other';
  if (parts.length) system.damage = { parts };
  if (r.spellsave) {
    const ab = Object.keys(ABILITIES).find((k) => ABILITIES[k].startsWith(String(r.spellsave).toLowerCase().slice(0, 3)));
    if (ab) system.save = { ability: ab, dc: null, scaling: 'spell' };
  }
  return legacyItem('spell', r.name, system);
}


// ---- 2024 sheet's saved data ----------------------------------------------------------
// The 2024 sheet keeps everything in one JSON attribute, "store". Its
// integrants are the sheet's items, spells, features, attacks and bonuses,
// each with the full description.
export function sheetStore(ch) {
  const a = (ch.attributes || ch.attribs || []).find((x) => x.name === 'store');
  if (!a) return null;
  try { return typeof a.current === 'string' ? JSON.parse(a.current) : a.current; } catch { return null; }
}
const keyName = (s) => clean(s).toLowerCase().replace(/[’']/g, "'");
export function storeIntegrants(store) {
  const all = Object.values(store?.integrants?.integrants || {}).filter((x) => x && typeof x === 'object' && x._enabled !== false);
  const byId = new Map(all.map((x) => [x._id, x]));
  const byName = new Map();
  for (const x of all) {
    for (const k of new Set([keyName(x.name), keyName(x.label)])) {
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(x);
    }
  }
  const children = (x) => {
    let ids = x.childIDs;
    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = ids.split(','); } }
    return (Array.isArray(ids) ? ids : []).map((id) => byId.get(String(id).trim())).filter(Boolean);
  };
  return { all, byId, byName, children, find: (name, test = () => true) => {
    // Prefer the entry with the most text (an item over its attack row).
    const list = (byName.get(keyName(name)) || []).filter(test);
    return list.sort((a, b) => String(b.description || '').length - String(a.description || '').length)[0] || null;
  } };
}
// Descriptions are HTML or Markdown-style text.
export function richText(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  if (/<\/?(p|br|div|span|strong|em|b|i|ul|ol|li|h\d|table)\b/i.test(t)) return t;
  return t.split(/\n{2,}/).map((p) => {
    const lines = p.split('\n');
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>';
    const h = /^#{1,6}\s+(.*)$/.exec(p);
    if (h && lines.length === 1) return '<h4>' + inline(h[1]) + '</h4>';
    return '<p>' + lines.map(inline).join('<br>') + '</p>';
  }).join('');
}
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
}
const isSpell = (x) => x && (/spell/i.test(x.type || '') || 'castingTime' in x || 'school' in x);
const isItem = (x) => x && (/^item/i.test(x.type || '') || 'equipData' in x || 'weaponData' in x || 'armorData' in x);
const WEAPON_PROPS = { finesse: 'fin', light: 'lgt', heavy: 'hvy', thrown: 'thr', 'two-handed': 'two', versatile: 'ver', reach: 'rch', ammunition: 'amm', loading: 'lod', special: 'spc', silvered: 'sil', magical: 'mgc' };
function storeDamage(x, kids) {
  const parts = [];
  for (const d of [x, ...kids]) {
    const count = num(d.diceCount ?? d._diceCount ?? d.dieCount);
    const size = num(d.diceSize ?? d.dieSize);
    if (count && size) parts.push([count + 'd' + size, damageType(d.damageType || d.damage || '')]);
  }
  return parts;
}
// An item from the sheet's saved data: weapon, armour or plain gear.
export function storeItem(x, kit, qty, equipped) {
  const kids = kit.children(x);
  const base = {
    description: { value: richText(x.description) }, quantity: qty ?? num(x.quantity) ?? 1,
    weight: { value: num(x.weight) || 0, units: 'lb' }, rarity: clean(x.rarity).toLowerCase(),
    price: (() => { const m = /([\d.,]+)\s*(cp|sp|ep|gp|pp)/i.exec(x.cost || ''); return m ? { value: Number(m[1].replace(/,/g, '')), denomination: m[2].toLowerCase() } : undefined; })(),
    equipped: equipped ?? !!x.equipData?.equipped, attuned: !!x._attuned,
  };
  if (!base.price) delete base.price;
  if (x.weaponData && (x.weaponData.type || x.weaponData.category)) {
    const ranged = /ranged/i.test(x.weaponData.type || '');
    const cat = /martial/i.test(x.weaponData.category || '') ? 'martial' : 'simple';
    const props = String(x.properties || '').split(/[,;]/).map((p) => WEAPON_PROPS[clean(p).toLowerCase().replace(/\s*\(.*\)$/, '')]).filter(Boolean);
    const range = /(\d+)\s*\/\s*(\d+)/.exec(x.properties || '');
    return legacyItem('weapon', x.name, {
      ...base, type: { value: cat + (ranged ? 'R' : 'M') }, properties: props,
      actionType: ranged ? 'rwak' : 'mwak', damage: { parts: storeDamage(x, kids) },
      range: range ? { value: Number(range[1]), long: Number(range[2]), units: 'ft' } : { value: props.includes('rch') ? 10 : 5, long: null, units: 'ft' },
    });
  }
  if (x.armorData && x.armorData.category) {
    const c = String(x.armorData.category).toLowerCase();
    const ac = kids.map((k) => num(k.bonusValue ?? k.flatValue ?? k.value)).find((v) => v) || null;
    return legacyItem('equipment', x.name, { ...base, type: { value: /shield/.test(c) ? 'shield' : /heavy/.test(c) ? 'heavy' : /medium/.test(c) ? 'medium' : 'light' }, armor: { value: ac } });
  }
  return legacyItem('loot', x.name, base);
}
// A spell from the sheet's saved data.
export function storeSpell(x, kit, level, prepared) {
  const kids = kit.children(x);
  const props = [];
  if (x.concentration) props.push('concentration');
  if (x.ritual) props.push('ritual');
  const comp = x.components || {};
  if (comp.verbal) props.push('vocal');
  if (comp.somatic) props.push('somatic');
  if (comp.material) props.push('material');
  const time = String(x.castingTime || '').toLowerCase();
  const lvl = level ?? num(x.level) ?? 0;
  const system = {
    level: lvl, school: SCHOOLS[String(x.school || '').toLowerCase()] || '',
    description: { value: richText(x.description) },
    activation: { type: /bonus/.test(time) ? 'bonus' : /reaction/.test(time) ? 'reaction' : /minute/.test(time) ? 'minute' : /hour/.test(time) ? 'hour' : 'action', cost: num(time) || 1 },
    duration: { value: num(x.duration), units: /hour/i.test(x.duration || '') ? 'hour' : /minute/i.test(x.duration || '') ? 'minute' : /round/i.test(x.duration || '') ? 'round' : /instant/i.test(x.duration || '') ? 'inst' : '' },
    range: rangeOf(x.range), properties: props,
    preparation: { mode: 'prepared', prepared: lvl === 0 || prepared !== false },
  };
  const parts = storeDamage(x, kids);
  if (parts.length) system.damage = { parts };
  const atk = x.attack?.type || '';
  const save = x.save?.saveAbility;
  if (/melee/i.test(atk)) system.actionType = 'msak';
  else if (/ranged|spell/i.test(atk)) system.actionType = 'rsak';
  else if (save) system.actionType = 'save';
  else if (parts.length) system.actionType = 'other';
  if (save) {
    const ab = Object.keys(ABILITIES).find((k) => ABILITIES[k].startsWith(String(save).toLowerCase().slice(0, 3)));
    if (ab) system.save = { ability: ab, dc: num(x.save.saveFlat) || null, scaling: num(x.save.saveFlat) ? 'flat' : 'spell' };
  }
  return legacyItem('spell', x.name, system);
}

// ---- characters ---------------------------------------------------------------------
// Returns { actor, items, spells: [names to look up], gear: [names], notes }.
// `itemsByName` lets app.js swap in compendium entries afterwards.
export function convertCharacter(ch, opts = {}) {
  const sheet = readSheet(ch);
  const classic = sheet.has('npc') || sheet.has('charactersheet_type') || sheet.sections().some((x) => /^(npc|attack|inventory|traits|spell-)/.test(x));
  if (ch.r20e_snapshot && !classic) return convertSnapshot(ch, ch.r20e_snapshot);
  return convertClassic(ch, sheet);
}

// 2024 sheet: the exporter saved what the add-on's sheet reader saw.
export function convertSnapshot(ch, snap) {
  const isNpc = snap.type === 'npc';
  const st = snap.stats || {};
  const abilities = {};
  const mods = {};
  for (const a of snap.abilities || []) {
    const k = String(a.name || '').toLowerCase().slice(0, 3);
    if (!ABILITIES[k]) continue;
    abilities[k] = { value: num(a.score) ?? 10 };
    mods[k] = num(a.mod) ?? Math.floor(((num(a.score) ?? 10) - 10) / 2);
    if (num(a.save) !== null && num(a.save) > mods[k]) abilities[k].proficient = 1;
  }
  const skills = {};
  for (const c of snap.checks || []) {
    const key = Object.keys(SKILLS).find((k) => SKILLS[k] === String(c.name || '').toLowerCase().replace(/\s+/g, '_'));
    if (!key) continue;
    const prof = String(c.prof || '').toLowerCase();
    // Each skill keeps its ability; a bare { value } would lose it.
    if (/expert/.test(prof)) skills[key] = { value: 2, ability: skillAbility(key) };
    else if (/half/.test(prof)) skills[key] = { value: 0.5, ability: skillAbility(key) };
    else if (/prof/.test(prof)) skills[key] = { value: 1, ability: skillAbility(key) };
  }
  const speeds = { ...(st.speeds || {}) };
  if (!speeds.walk && st.speed) speeds.walk = st.speed;
  const system = {
    abilities, skills,
    attributes: {
      hp: { value: st.hp ?? st.maxHp ?? 1, max: st.maxHp ?? st.hp ?? 1, temp: st.tempHp || 0 },
      ac: { calc: 'flat', flat: st.ac ?? 10 },
      movement: { speeds, units: 'ft' },
    },
    details: {},
  };
  if (isNpc && st.cr) system.details.cr = parseCR(st.cr);
  const items = [];
  const lookups = [];
  // Classes: the 2024 sheet shows one hit-die row per class, "D10 (Fighter)",
  // with as many dice as levels in that class.
  const hdRows = snap.hitDice || [];
  hdRows.forEach((h, i) => {
    const m = /d\s*(\d+)\s*\(([^)]+)\)/i.exec(h.label || h.name || '');
    if (!m) return;
    const cls = clean(m[2]);
    const levels = num((st.hitDice || [])[i] && st.hitDice[i].max) || (hdRows.length === 1 ? num(st.level) : null) || 1;
    lookups.push({ name: cls, kind: 'class', patch: { system: { levels } }, fallback: legacyItem('class', cls, { levels, hd: { denomination: 'd' + m[1] } }) });
  });
  const seen = new Set();
  const once = (name) => { const k = clean(name).toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; };
  // Full item, spell and feature data saved by the sheet itself.
  const kit = storeIntegrants(sheetStore(ch));
  for (const it of snap.items || []) {
    if (!once(it.name)) continue;
    const qty = num(it.qty) ?? 1;
    const x = kit.find(it.name, isItem);
    const fallback = x ? storeItem(x, kit, qty, it.equipped ?? undefined) : legacyItem('loot', it.name, { quantity: qty, description: { value: esc(it.sub || '') } });
    const patch = { system: { quantity: qty, ...(it.equipped ? { equipped: true } : {}) } };
    // "Obsidian Dagger" built on the sheet's Dagger: dnd5e's Dagger, renamed,
    // with the sheet's text.
    const record = x && clean(x.recordName);
    if (record && keyName(record) !== keyName(it.name)) {
      lookups.push({ name: record, kind: 'gear', fallback, patch: { ...patch, name: clean(it.name), system: { ...patch.system, description: { value: fallback.system.description.value } } } });
    } else lookups.push({ name: clean(it.name), kind: 'gear', patch, fallback });
  }
  for (const sp of snap.spells || []) {
    if (!once('spell:' + sp.name)) continue;
    const level = /cantrip/i.test(sp.level) ? 0 : num(sp.level) ?? 0;
    const props = (sp.tags || []).includes('C') ? ['concentration'] : [];
    if ((sp.tags || []).includes('R')) props.push('ritual');
    const x = kit.find(sp.name, isSpell);
    lookups.push({ name: clean(sp.name), kind: 'spell', patch: { system: { method: 'spell', prepared: level === 0 || sp.prepared !== false ? 1 : 0 } },
      fallback: x ? storeSpell(x, kit, level, sp.prepared) : legacyItem('spell', sp.name, { level, range: rangeOf(sp.range), properties: props, preparation: { mode: 'prepared', prepared: sp.prepared !== false }, description: { value: '' } }) });
  }
  const gearNames = new Set((snap.items || []).map((i) => clean(i.name).toLowerCase()));
  // "Dagger (Off-Hand)", "Throw Handaxe": other ways of using one weapon.
  // dnd5e weapons carry those modes themselves, so keep one weapon per base.
  const weaponBase = (n) => clean(String(n || '').replace(/\s*\(.*\)\s*$/, '').replace(/^throw\s+/i, '')).toLowerCase();
  const weaponsMade = new Set();
  for (const a of snap.attacks || []) {
    const base = weaponBase(a.name);
    if (gearNames.has(base) || weaponsMade.has(base) || !once(a.name)) continue;
    weaponsMade.add(base);
    const parts = (a.dmg || []).map((d) => [resolveFormula(String(d.text || '').replace(/[a-z]+$/i, '')), damageType(d.type || d.text)]).filter((x) => x[0]);
    const system = { description: { value: '' }, type: { value: isNpc ? 'monster' : 'feat' }, activation: { type: 'action', cost: 1 }, damage: { parts }, range: rangeOf(a.range) };
    const bonus = /([+-]\d+)/.exec(a.hit || '');
    if (bonus) { system.actionType = /ranged|\//i.test(a.range || '') ? 'rwak' : 'mwak'; system.attack = { bonus: String(Number(bonus[1])), flat: true }; }
    const dc = /DC\s*(\d+)\s*(\w+)?/i.exec(a.hit || '');
    if (dc) { const ab = Object.keys(ABILITIES).find((k) => dc[2] && ABILITIES[k].startsWith(dc[2].toLowerCase().slice(0, 3))); system.actionType = system.actionType || 'save'; system.save = { ability: ab || '', dc: Number(dc[1]), scaling: 'flat' }; }
    if (!system.actionType && parts.length) system.actionType = 'other';
    if (isNpc) items.push(legacyItem('feat', a.name, system));
    else {
      // A weapon in the inventory, named for the weapon rather than the mode.
      const named = /^throw\s+/i.test(a.name) || /\(.*\)\s*$/.test(a.name) ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : a.name;
      // dnd5e adds the ability modifier to weapon damage itself; keep only the dice.
      const dice = (system.damage.parts || []).map(([f, t], i) => [i === 0 ? String(f).replace(/\s*[+-]\s*\d+\s*$/, '') : f, t]);
      items.push(legacyItem('weapon', named, { ...system, damage: { parts: dice }, type: { value: /ranged|\//i.test(a.range || '') ? 'simpleR' : 'simpleM' }, quantity: 1, equipped: true }));
    }
  }
  // Sheet actions that only use an item you carry, and the sheet's rules lists.
  const itemAction = (n) => {
    const m = /^(use|drink|light|apply|read|eat|throw|activate)\s+(?:a |an |the )?(.+)$/i.exec(clean(n));
    return !!m && [...gearNames].some((g) => g && (g === m[2].toLowerCase() || g.includes(m[2].toLowerCase()) || m[2].toLowerCase().includes(g)));
  };
  const rulesList = (n) => /^(bonus )?(actions|reactions|bonus actions) in combat$/i.test(clean(n));
  const ACT = (t) => (/bonus/i.test(t) ? 'bonus' : /reaction/i.test(t) ? 'reaction' : /legendary/i.test(t) ? 'legendary' : /action/i.test(t) ? 'action' : '');
  // Same-named entries ("Landborn Magic" at levels 1, 3 and 5) become one
  // feature with all their text.
  const merged = new Map();
  for (const f of [...(snap.actions || []), ...(snap.features || [])]) {
    if (rulesList(f.name) || weaponsMade.has(weaponBase(f.name)) || (snap.actions || []).includes(f) && itemAction(f.name)) continue;
    const k = clean(f.name).toLowerCase();
    if (!k || seen.has(k)) continue;
    const m = merged.get(k);
    if (m) { if (f.desc && !m.descs.includes(f.desc)) m.descs.push(f.desc); if (!m.res.length && (f.res || []).length) m.res = f.res; if (!m.timing && f.timing) m.timing = f.timing; continue; }
    merged.set(k, { ...f, descs: f.desc ? [f.desc] : [], res: f.res || [] });
  }
  const feats = [...merged.values()];
  // Where each feature comes from, as the 2024 sheet labels it:
  // Species Traits / "Elves of R'Ley", Class Features / "Echo Knight", Other / "Far Traveler".
  const isSpecies = (f) => /species|race|racial|ancestry|lineage/i.test(f.section || '');
  const classNames = new Set(lookups.filter((l) => l.kind === 'class').map((l) => l.name.toLowerCase()));
  const mostCommon = (list) => { const c = new Map(); for (const x of list) if (x) c.set(x, (c.get(x) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || ''; };
  const speciesName = isNpc ? '' : mostCommon(feats.filter(isSpecies).map((f) => clean(f.source)).filter((x) => !/^(species|race)$/i.test(x)));
  const subclassNames = [...new Set(feats.filter((f) => /class/i.test(f.section || '') && f.source && !classNames.has(clean(f.source).toLowerCase())).map((f) => clean(f.source)))];
  const known = new Set([...classNames, ...subclassNames.map((x) => x.toLowerCase()), speciesName.toLowerCase()]);
  const backgroundName = isNpc ? '' : mostCommon(feats.filter((f) => !isSpecies(f) && !/class|\bfeats?\b/i.test(f.section || '') && f.source && !known.has(clean(f.source).toLowerCase())).map((f) => clean(f.source)));
  // The sheet's saved text when it is fuller than what was read off the page.
  const html = (f) => {
    const read = f.descs.map(para).join('');
    const x = kit.find(f.name, (y) => !isItem(y) && !isSpell(y) && y.description);
    return x && clean(x.description).length > f.descs.join(' ').length ? richText(x.description) : read;
  };
  const listHTML = (list) => list.map((f) => '<h4>' + esc(f.name) + '</h4>' + html(f)).join('');
  for (const f of feats) {
    const r = f.res[0];
    const src = clean(f.source);
    const kind = isNpc ? 'monster' : isSpecies(f) ? 'race' : /\bfeats?\b/i.test(f.section || '') ? 'feat'
      : backgroundName && src === backgroundName ? 'background' : /class/i.test(f.section || '') ? 'class' : '';
    const system = { description: { value: html(f) }, type: { value: kind }, requirements: src && !/^(species|race)$/i.test(src) ? src : '' };
    const act = ACT(f.timing || f.section || '');
    if (act) system.activation = { type: act, cost: 1 };
    if (r && r.max) system.uses = { max: String(r.max), spent: Math.max(0, r.max - (r.cur ?? r.max)) };
    items.push(legacyItem('feat', f.name, system, { flags: { r20import: { source: src, section: f.section || '' } } }));
  }
  // The species itself: dnd5e's when the name matches, else a custom species
  // item carrying its traits' text (the traits are on the actor as features).
  const speciesTraits = feats.filter(isSpecies);
  if (speciesName) {
    lookups.push({ name: speciesName, kind: 'race', fallback: legacyItem('race', speciesName, {
      description: { value: '<p><em>Custom species from Roll20.</em></p>' + listHTML(speciesTraits) },
      type: { value: 'humanoid' }, movement: { speeds: { walk: speeds.walk || 30 }, units: 'ft' },
    }, { flags: { r20import: { customSpecies: true, traits: speciesTraits.map((f) => f.name) } } }) });
  }
  for (const sc of subclassNames) {
    const cls = feats.find((f) => clean(f.source) === sc);
    const parent = lookups.find((l) => l.kind === 'class');
    lookups.push({ name: sc, kind: 'subclass', fallback: legacyItem('subclass', sc, {
      classIdentifier: parent ? parent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '',
      description: { value: '<p><em>Subclass from Roll20.</em></p>' + listHTML(feats.filter((f) => clean(f.source) === sc)) },
    }, { flags: { r20import: { custom: true, section: cls && cls.section } } }) });
  }
  if (backgroundName) {
    lookups.push({ name: backgroundName, kind: 'background', fallback: legacyItem('background', backgroundName, {
      description: { value: '<p><em>Background from Roll20.</em></p>' + listHTML(feats.filter((f) => clean(f.source) === backgroundName)) },
    }, { flags: { r20import: { custom: true } } }) });
  }
  const bio = (ch.bio || '') + (ch.gmnotes ? '<section class="secret"><h3>GM notes (Roll20)</h3>' + ch.gmnotes + '</section>' : '');
  const hasClass = lookups.some((l) => l.kind === 'class');
  system.details.biography = { value: (st.level && !hasClass ? '<p><em>Level ' + esc(st.level) + ' (2024 sheet: add the class from the compendium)</em></p>' : '') + bio };
  return { actor: { name: clean(ch.name) || 'Unnamed', type: isNpc ? 'npc' : 'character', system }, items, lookups, isNpc, empty: false, sheetKind: '2024' };
}

function convertClassic(ch, sheet) {
  const isNpc = on(sheet.get('npc')) || (!sheet.has('npc') && sheet.sections().some((s) => /^npc/.test(s)));
  const scores = {};
  const mods = {};
  for (const [k, full] of Object.entries(ABILITIES)) {
    const v = num(sheet.first(full, full + '_base'));
    scores[k] = v ?? 10;
    mods[k] = Math.floor((scores[k] - 10) / 2);
  }
  const abilities = {};
  for (const k of Object.keys(ABILITIES)) {
    abilities[k] = { value: scores[k] };
    const full = ABILITIES[k];
    if (isNpc) { if (sheet.get('npc_' + k + '_save') !== '' || sheet.get(full + '_save_prof') !== '' && on(sheet.get('npc_saving_flag'))) abilities[k].proficient = 1; }
    else if (sheet.get(full + '_save_prof') !== '' && !/^0?$/.test(sheet.get(full + '_save_prof'))) abilities[k].proficient = 1;
  }
  const skills = {};
  for (const [k, full] of Object.entries(SKILLS)) {
    if (isNpc) {
      const b = num(sheet.get('npc_' + full));
      const base = mods[Object.keys(ABILITIES).find((a) => a === skillAbility(k))] ?? 0;
      if (b !== null && sheet.get('npc_' + full) !== '' && b > base) skills[k] = { value: b - base >= 2 * profFromCR(parseCR(sheet.get('npc_challenge'))) ? 2 : 1, ability: skillAbility(k) };
    } else {
      const p = sheet.get(full + '_prof');
      if (p && p !== '0') skills[k] = { value: /\*\s*2|expertise/i.test(p) || sheet.get(full + '_type') === '2' ? 2 : 1, ability: skillAbility(k) };
    }
  }
  const hpMax = num(sheet.max('hp')) ?? num(sheet.first('hp_max', 'npc_hp')) ?? num(sheet.get('hp'));
  const hpVal = num(sheet.get('hp'));
  const speedText = isNpc ? sheet.first('npc_speed', 'speed') : sheet.first('speed');
  const { speeds, hover } = parseSpeeds(speedText || '30');
  const system = {
    abilities,
    skills,
    attributes: {
      hp: { value: hpVal ?? hpMax ?? 1, max: hpMax ?? hpVal ?? 1, temp: num(sheet.get('hp_temp')) || 0, ...(isNpc && sheet.get('npc_hpformula') ? { formula: clean(sheet.get('npc_hpformula')) } : {}) },
      ac: { calc: 'flat', flat: num(isNpc ? sheet.first('npc_ac', 'ac') : sheet.first('ac')) ?? 10 },
      movement: { speeds, units: 'ft', hover },
      senses: parseSenses(isNpc ? sheet.get('npc_senses') : sheet.first('senses')),
    },
    details: {},
    traits: {
      languages: { custom: clean(isNpc ? sheet.get('npc_languages') : sheet.first('languages')) },
      dr: { custom: clean(sheet.get('npc_resistances')) }, di: { custom: clean(sheet.get('npc_immunities')) },
      dv: { custom: clean(sheet.get('npc_vulnerabilities')) }, ci: { custom: clean(sheet.get('npc_condition_immunities')) },
    },
    currency: {},
  };
  const items = [];
  const lookups = []; // { name, kind: 'spell'|'gear'|'class'|'race'|'background', patch }
  let summary = '';

  if (isNpc) {
    const t = parseType(sheet.get('npc_type'));
    system.traits.size = t.size;
    system.details.type = t.type;
    system.details.alignment = t.alignment;
    const cr = parseCR(sheet.get('npc_challenge'));
    if (cr !== null) system.details.cr = cr;
    const leg = num(sheet.get('npc_legendary_actions'));
    if (leg) system.resources = { legact: { max: leg, spent: 0 } };
    for (const r of sheet.rows('npctrait')) if (clean(r.name)) items.push(legacyItem('feat', r.name, { description: { value: para(r.description || r.desc) }, type: { value: 'monster' } }));
    for (const [sec, act] of [['npcaction', 'action'], ['npcbonusaction', 'bonus'], ['npcreaction', 'reaction'], ['npcaction-l', 'legendary'], ['npcaction-m', 'mythic']]) {
      for (const r of sheet.rows(sec)) if (clean(r.name)) items.push(npcAction(r, act, sheet, mods));
    }
    summary = clean(sheet.get('npc_type'));
  } else {
    const level = num(sheet.first('base_level', 'level')) || 1;
    const cls = clean(sheet.get('class'));
    if (cls) lookups.push({ name: cls, kind: 'class', patch: { system: { levels: level } }, fallback: legacyItem('class', cls, { levels: level, hd: { denomination: 'd' + (num(sheet.get('hitdietype')) || 8) } }) });
    for (let i = 1; i <= 3; i++) {
      if (!on(sheet.get('multiclass' + i + '_flag'))) continue;
      const mc = clean(sheet.get('multiclass' + i));
      const lv = num(sheet.get('multiclass' + i + '_lvl')) || 1;
      if (mc) lookups.push({ name: mc, kind: 'class', patch: { system: { levels: lv } }, fallback: legacyItem('class', mc, { levels: lv, hd: { denomination: 'd8' } }) });
    }
    const race = clean(sheet.first('subrace', 'race'));
    // The race: dnd5e's when the name matches, else a custom species built from
    // the sheet's "Racial" traits (added after the traits are read, below).
    const raceLookup = race ? { name: race, kind: 'race' } : null;
    if (raceLookup) lookups.push(raceLookup);
    const bg = clean(sheet.get('background'));
    if (bg) lookups.push({ name: bg, kind: 'background' });
    system.details.alignment = clean(sheet.get('alignment'));
    system.details.xp = { value: num(sheet.get('experience')) || 0 };
    for (const c of ['cp', 'sp', 'ep', 'gp', 'pp']) { const v = num(sheet.get(c)); if (v) system.currency[c] = v; }
    // Inventory: compendium match first, else loot/weapon/equipment from the row.
    for (const r of sheet.rows('inventory')) {
      const name = clean(r.itemname);
      if (!name) continue;
      const qty = num(r.itemcount) ?? 1;
      const equipped = on(r.equipped);
      const mod = String(r.itemmodifiers || '');
      let fallback;
      if (/item type:\s*(melee|ranged)?\s*weapon/i.test(mod) || /damage:/i.test(mod)) {
        const dmg = (/damage:\s*([^,]+)/i.exec(mod) || [])[1];
        const dt = (/damage type:\s*([^,]+)/i.exec(mod) || [])[1];
        fallback = legacyItem('weapon', name, { quantity: qty, equipped, description: { value: para(r.itemcontent) }, damage: { parts: dmg ? [[resolveFormula(dmg) || dmg, damageType(dt)]] : [] }, weight: { value: num(r.itemweight) || 0, units: 'lb' } });
      } else if (/item type:\s*(light|medium|heavy)?\s*armor|shield/i.test(mod) || /\bac:\s*\d/i.test(mod)) {
        fallback = legacyItem('equipment', name, { quantity: qty, equipped, description: { value: para(r.itemcontent) }, armor: { value: num((/ac:\s*(\d+)/i.exec(mod) || [])[1]) }, weight: { value: num(r.itemweight) || 0, units: 'lb' } });
      } else {
        fallback = legacyItem('loot', name, { quantity: qty, description: { value: para(r.itemcontent) }, weight: { value: num(r.itemweight) || 0, units: 'lb' } });
      }
      lookups.push({ name, kind: 'gear', patch: { system: { quantity: qty, ...(equipped ? { equipped: true } : {}) } }, fallback });
    }
    // Attacks not already covered by an inventory weapon.
    const gearNames = new Set(sheet.rows('inventory').map((r) => clean(r.itemname).toLowerCase()));
    for (const r of sheet.rows('attack')) {
      const name = clean(r.atkname);
      if (!name || gearNames.has(name.toLowerCase())) continue;
      const parts = [];
      const base = resolveFormula(r.dmgbase, sheet, mods);
      const attr = resolveFormula(r.dmgattr, sheet, mods);
      if (base) parts.push([[base, attr && attr !== '0' ? attr : ''].filter(Boolean).join(' + '), damageType(r.dmgtype)]);
      const b2 = resolveFormula(r.dmg2base, sheet, mods);
      if (b2) parts.push([b2, damageType(r.dmg2type)]);
      const bonus = num(r.atkbonus);
      const system = { description: { value: para(r.atk_desc) }, type: { value: 'feat' }, activation: { type: 'action', cost: 1 }, damage: { parts }, range: rangeOf(r.atkrange) };
      if (bonus !== null) { system.actionType = /ranged|range|\d+\s*\/\s*\d+/i.test(r.atkrange || '') || (system.range.value || 0) > 10 ? 'rwak' : 'mwak'; system.attack = { bonus: String(bonus), flat: true }; }
      else if (parts.length) system.actionType = 'other';
      const save = r.saveattr ? { ability: Object.keys(ABILITIES).find((k) => ABILITIES[k].startsWith(String(r.saveattr).toLowerCase().slice(0, 3))), dc: num(r.savedc) || null, scaling: 'flat' } : null;
      if (save && save.ability) system.save = save;
      items.push(legacyItem('feat', name, system));
    }
    const racial = [];
    for (const r of sheet.rows('traits')) {
      if (!clean(r.name)) continue;
      const isRace = /racial|race|species/i.test(r.source || '');
      if (isRace) racial.push(r);
      items.push(legacyItem('feat', r.name, { description: { value: para(r.description) }, type: { value: /class/i.test(r.source || '') ? 'class' : isRace ? 'race' : /feat/i.test(r.source || '') ? 'feat' : '' }, requirements: clean(r.source_type), source: { custom: clean(r.source_type) } }));
    }
    if (raceLookup) {
      raceLookup.fallback = legacyItem('race', race, {
        description: { value: '<p><em>Custom species from Roll20.</em></p>' + racial.map((r) => '<h4>' + esc(clean(r.name)) + '</h4>' + para(r.description)).join('') },
        type: { value: 'humanoid' }, movement: { speeds: { walk: speeds.walk || 30 }, units: 'ft' },
      }, { flags: { r20import: { customSpecies: true, traits: racial.map((r) => clean(r.name)) } } });
    }
    // Class / other resources become features with uses.
    const res = [['class_resource', 'class_resource_name'], ['other_resource', 'other_resource_name']].map(([v, n]) => ({ name: sheet.get(n), cur: num(sheet.get(v)), max: num(sheet.max(v)) }));
    for (const r of sheet.rows('resource')) {
      res.push({ name: r.resource_left_name, cur: num(r.resource_left), max: num(r.resource_left_max) });
      res.push({ name: r.resource_right_name, cur: num(r.resource_right), max: num(r.resource_right_max) });
    }
    for (const r of res) {
      if (!clean(r.name) || !r.max) continue;
      items.push(legacyItem('feat', r.name, { type: { value: 'class' }, uses: { max: String(r.max), spent: Math.max(0, r.max - (r.cur ?? r.max)) }, description: { value: '' } }));
    }
    // Spell slots remaining.
    const spells = {};
    for (let l = 1; l <= 9; l++) {
      const total = num(sheet.get('lvl' + l + '_slots_total'));
      const left = num(sheet.get('lvl' + l + '_slots_expended'));
      if (total) spells['spell' + l] = { value: left ?? total, override: total };
    }
    if (Object.keys(spells).length) system.spells = spells;
    summary = [race, cls && cls + ' ' + level, bg].filter(Boolean).join(' · ');
  }
  // Spellcasting ability: "@{wisdom_mod}+" -> wis
  const sc = String(isNpc ? sheet.first('npcspellcastingflag') && sheet.first('spellcasting_ability') : sheet.get('spellcasting_ability')).toLowerCase();
  const scKey = Object.keys(ABILITIES).find((k) => sc.includes(ABILITIES[k]));
  if (scKey) system.attributes.spellcasting = scKey;
  for (const r of spellRows(sheet)) lookups.push({ name: r.name, kind: 'spell', patch: { system: { method: 'spell', prepared: r.level === 0 || on(r.spellprepared) ? 1 : 0 } }, fallback: spellItem(r, sheet, mods) });

  // Characters with no sheet data at all (lights, markers, placeholders).
  const empty = !sheet.sections().length && !sheet.get('hp') && !sheet.get('strength');
  const bio = (ch.bio || '') + (ch.gmnotes ? '<section class="secret"><h3>GM notes (Roll20)</h3>' + ch.gmnotes + '</section>' : '');
  if (summary) system.details.biography = { value: '<p><em>' + esc(summary) + '</em></p>' + bio };
  else system.details.biography = { value: bio };
  return {
    actor: { name: clean(ch.name) || 'Unnamed', type: isNpc || empty ? 'npc' : 'character', system },
    items, lookups, isNpc, empty,
    sheetKind: sheet.has('npc') || sheet.sections().some((s) => /^(npc|attack|inventory|traits|spell-)/.test(s)) ? 'classic' : (ch.attributes || []).length ? 'other' : 'none',
  };
}
function skillAbility(k) {
  return { acr: 'dex', ani: 'wis', arc: 'int', ath: 'str', dec: 'cha', his: 'int', ins: 'wis', itm: 'cha', inv: 'int', med: 'wis', nat: 'int', prc: 'wis', prf: 'cha', per: 'cha', rel: 'int', slt: 'dex', ste: 'dex', sur: 'wis' }[k];
}
const profFromCR = (cr) => (cr === null ? 2 : Math.max(2, Math.floor(((cr < 1 ? 1 : cr) - 1) / 4) + 2));

// Token settings from a Roll20 graphic / default token, sizes in grid squares.
export function tokenSettings(g, gridPx, opts = {}) {
  const out = {};
  if (g.name) out.name = clean(g.name);
  const w = num(g.width);
  const h = num(g.height);
  if (w) out.width = Math.max(0.25, Math.round((w / gridPx) * 100) / 100);
  if (h) out.height = Math.max(0.25, Math.round((h / gridPx) * 100) / 100);
  if (g.rotation) out.rotation = Number(g.rotation) || 0;
  const texture = {};
  if (g.fliph) texture.scaleX = -1;
  if (g.flipv) texture.scaleY = -1;
  if (Object.keys(texture).length) out.texture = texture;
  if (g.showname !== undefined) out.displayName = g.showname ? 50 : 0; // ALWAYS : NONE
  // Lights: Updated Dynamic Lighting first, then legacy.
  const light = {};
  if (g.emits_bright_light || g.emits_low_light) {
    const bright = g.emits_bright_light ? num(g.bright_light_distance) || 0 : 0;
    const dim = g.emits_low_light ? bright + (num(g.low_light_distance) || 0) : bright;
    Object.assign(light, { bright, dim });
    if (g.has_directional_bright_light) light.angle = num(g.directional_bright_light_total) || 360;
    if (g.lightColor && g.lightColor !== 'transparent') light.color = g.lightColor;
  } else if (num(g.light_radius)) {
    const dim = num(g.light_radius);
    const brightStart = num(g.light_dimradius);
    Object.assign(light, { dim, bright: brightStart !== null && brightStart < dim ? brightStart : dim });
    if (num(g.light_angle) && num(g.light_angle) < 360) light.angle = num(g.light_angle);
  }
  if (Object.keys(light).length) out.light = light;
  const sight = {};
  if (g.has_bright_light_vision) sight.enabled = true;
  if (g.has_night_vision) { sight.enabled = true; sight.range = num(g.night_vision_distance) || 60; sight.visionMode = 'darkvision'; }
  if (Object.keys(sight).length) out.sight = sight;
  return out;
}

// ---- pages -> scenes --------------------------------------------------------------------
const GRID_TYPES = { square: 1, hex: 4, hexr: 2 }; // Foundry: SQUARE, HEXODDQ, HEXODDR
const PALETTE = (c, fallback = '#000000') => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c) : /^#[0-9a-f]{3}$/i.test(String(c || '')) ? '#' + String(c).slice(1).split('').map((x) => x + x).join('') : fallback);
const transparent = (c) => !c || /transparent/i.test(c) || c === 'none';

// Absolute points of a Roll20 path. Points are drawn in the path's own box
// (width x height); left/top is the box centre, then scale and rotation.
export function pathPoints(p) {
  let cmds = p.path;
  if (typeof cmds === 'string') { try { cmds = JSON.parse(cmds); } catch { cmds = []; } }
  const pts = [];
  if (Array.isArray(cmds) && cmds.length) {
    for (const c of cmds) {
      if (!Array.isArray(c) || c.length < 3) continue;
      pts.push([Number(c[c.length - 2]), Number(c[c.length - 1])]);
    }
  } else if (p.points) { // newer polyline paths
    let raw = p.points;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
    for (const q of raw || []) pts.push([Number(q[0]), Number(q[1])]);
  }
  if (!pts.length) return [];
  const w = Number(p.width) || 0;
  const h = Number(p.height) || 0;
  const sx = Number(p.scaleX) || 1;
  const sy = Number(p.scaleY) || 1;
  const cx = Number(p.left ?? p.x) || 0;
  const cy = Number(p.top ?? p.y) || 0;
  const rad = ((Number(p.rotation) || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const relative = !p.points || p.path; // legacy paths are relative to their box
  return pts.map(([x, y]) => {
    const dx = relative ? (x - w / 2) * sx : x * sx;
    const dy = relative ? (y - h / 2) * sy : y * sy;
    return [Math.round(cx + dx * cos - dy * sin), Math.round(cy + dx * sin + dy * cos)];
  });
}

// imageFor(graphic) -> file path (relative to Data) or '' ; actorFor(characterId) -> { id, prototype } | null
export function convertPage(page, ctx) {
  const snap = Number(page.snapping_increment);
  const gridPx = Math.max(50, Math.round(GRID_PX * (snap > 0 ? snap : 1)));
  const k = gridPx / (GRID_PX * (snap > 0 ? snap : 1)); // grow tiny grids up to Foundry's 50 px minimum
  const W = Math.round((Number(page.width) || 25) * GRID_PX * k);
  const H = Math.round((Number(page.height) || 25) * GRID_PX * k);
  const order = (page.zorder || []).map(String);
  const z = (id) => { const i = order.indexOf(String(id)); return i < 0 ? 0 : i; };
  const scene = {
    name: clean(page.name) || 'Untitled', width: W, height: H, padding: 0,
    grid: { type: snap > 0 ? GRID_TYPES[page.grid_type] ?? 1 : 0, size: gridPx, distance: Number(page.scale_number) || 5, units: page.scale_units || 'ft', color: PALETTE(page.gridcolor, '#c0c0c0'), alpha: page.showgrid === false ? 0 : Math.min(1, Number(page.grid_opacity ?? 0.5)) },
    tokenVision: !!(page.dynamic_lighting_enabled || page.showlighting),
    fog: { exploration: !!(page.explorer_mode && page.explorer_mode !== 'off') || !!page.adv_fow_enabled },
    environment: { globalLight: { enabled: !!(page.daylight_mode_enabled || !(page.dynamic_lighting_enabled || page.showlighting)) } },
    navigation: false,
    tokens: [], tiles: [], walls: [], drawings: [],
    flags: { r20import: { id: page.id, background: PALETTE(page.background_color, '#000000') } },
  };
  const stats = { tokens: 0, tiles: 0, walls: 0, drawings: 0, missingImages: 0 };
  const box = (g) => {
    const w = (Number(g.width) || GRID_PX) * k;
    const h = (Number(g.height) || GRID_PX) * k;
    return { x: Math.round((Number(g.left) || 0) * k - w / 2), y: Math.round((Number(g.top) || 0) * k - h / 2), width: Math.round(w), height: Math.round(h) };
  };
  for (const g of page.graphics || []) {
    const src = ctx.imageFor(page, g);
    const layer = g.layer || 'objects';
    const actor = g.represents ? ctx.actorFor(g.represents) : null;
    const isToken = layer === 'objects' || (layer === 'gmlayer' && actor);
    if (!src && !actor) { stats.missingImages++; continue; }
    if (isToken && (actor || g.name || g.bar1_value || g.bar1_max)) {
      const t = tokenSettings({ ...g, width: (Number(g.width) || GRID_PX), height: (Number(g.height) || GRID_PX) }, GRID_PX * (snap > 0 ? snap : 1));
      const b = box(g);
      const token = {
        ...(actor ? actor.prototype : {}), ...t,
        texture: { ...((actor && actor.prototype.texture) || {}), ...(src ? { src } : {}), ...(t.texture || {}) },
        light: { ...((actor && actor.prototype.light) || {}), ...(t.light || {}) },
        sight: { ...((actor && actor.prototype.sight) || {}), ...(t.sight || {}) },
        x: b.x, y: b.y, hidden: layer === 'gmlayer', sort: z(g.id),
        actorId: actor ? actor.id : null, actorLink: actor ? !!actor.prototype.actorLink : false,
        flags: { r20import: { id: g.id } },
      };
      delete token._id;
      if (actor && !token.actorLink && g.bar1_value !== '' && num(g.bar1_value) !== null && !g.bar1_link) {
        token.delta = { system: { attributes: { hp: { value: num(g.bar1_value), ...(num(g.bar1_max) ? { max: num(g.bar1_max) } : {}) } } } };
      }
      scene.tokens.push(token);
      stats.tokens++;
    } else {
      const b = box(g);
      // Foundry v14 positions tiles by their centre (tokens stay top-left),
      // which is also how Roll20 stores every graphic.
      b.x += Math.round(b.width / 2);
      b.y += Math.round(b.height / 2);
      scene.tiles.push({
        texture: { src, ...(g.fliph ? { scaleX: -1 } : {}), ...(g.flipv ? { scaleY: -1 } : {}) },
        ...b, rotation: Number(g.rotation) || 0, hidden: layer === 'gmlayer',
        sort: (layer === 'map' ? 0 : layer === 'foreground' ? 200000 : 100000) + z(g.id),
        elevation: layer === 'foreground' ? 20 : 0, alpha: 1,
        flags: { r20import: { id: g.id, layer } },
      });
      stats.tiles++;
    }
  }
  const S = { NONE: 0, LIMITED: 10, NORMAL: 20 };
  for (const p of page.paths || []) {
    const pts = pathPoints(p).map(([x, y]) => [Math.round(x * k), Math.round(y * k)]);
    if (pts.length < 2) continue;
    if (p.layer === 'walls') {
      const bt = String(p.barrierType || p.barriertype || '').toLowerCase();
      const see = bt === 'transparent' ? S.NONE : S.NORMAL;
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]];
        if (a[0] === b[0] && a[1] === b[1]) continue;
        scene.walls.push({ c: [a[0], a[1], b[0], b[1]], move: 20, sight: see, light: see, sound: see, dir: bt === 'oneway' ? 1 : bt === 'onewayreversed' ? 2 : 0, door: 0, flags: { r20import: { id: p.id } } });
        stats.walls++;
      }
      continue;
    }
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const closed = Array.isArray(p.path) && p.path.some((c) => c && /z/i.test(c[0]));
    const fill = !transparent(p.fill);
    scene.drawings.push({
      x: x0, y: y0, hidden: p.layer === 'gmlayer', sort: z(p.id),
      shape: { type: 'p', width: Math.max(...xs) - x0 || 1, height: Math.max(...ys) - y0 || 1, points: pts.flatMap(([x, y]) => [x - x0, y - y0]).concat(closed ? [pts[0][0] - x0, pts[0][1] - y0] : []) },
      strokeColor: PALETTE(p.stroke, '#000000'), strokeWidth: Math.max(1, Number(p.stroke_width) || 2), strokeAlpha: transparent(p.stroke) ? 0 : 1,
      fillType: fill ? 1 : 0, fillColor: PALETTE(p.fill, '#ffffff'), fillAlpha: fill ? 0.5 : 0,
      flags: { r20import: { id: p.id } },
    });
    stats.drawings++;
  }
  for (const t of page.texts || []) {
    const text = String(t.text || '');
    if (!text.trim()) continue;
    const w = (Number(t.width) || 100) * k;
    const h = (Number(t.height) || 30) * k;
    scene.drawings.push({
      x: Math.round((Number(t.left) || 0) * k - w / 2), y: Math.round((Number(t.top) || 0) * k - h / 2),
      shape: { type: 'r', width: Math.round(w), height: Math.round(h) }, text, fontSize: Math.round((Number(t.font_size) || 16) * k),
      textColor: PALETTE(t.color, '#000000'), fontFamily: 'Signika', strokeWidth: 0, strokeAlpha: 0, fillType: 0, fillAlpha: 0,
      hidden: t.layer === 'gmlayer', rotation: Number(t.rotation) || 0, sort: z(t.id), flags: { r20import: { id: t.id } },
    });
    stats.drawings++;
  }
  return { scene, stats };
}

// ---- handouts -> journal pages -------------------------------------------------------
export function convertHandout(h, image) {
  const pages = [];
  if (image) pages.push({ name: clean(h.name) || 'Image', type: 'image', src: image, sort: 100 });
  if (h.notes && String(h.notes).trim()) pages.push({ name: clean(h.name) || 'Notes', type: 'text', text: { content: String(h.notes), format: 1 }, sort: 200 });
  if (h.gmnotes && String(h.gmnotes).trim()) pages.push({ name: 'GM notes', type: 'text', text: { content: String(h.gmnotes), format: 1 }, sort: 300, ownership: { default: 0 } });
  if (!pages.length) pages.push({ name: clean(h.name) || 'Notes', type: 'text', text: { content: '', format: 1 } });
  return { name: clean(h.name) || 'Untitled', pages };
}

// ---- roll tables ---------------------------------------------------------------------------
export function convertTable(t, imageFor) {
  let at = 1;
  const results = [];
  for (const it of t.items || t.tableItems || []) {
    const w = Math.max(1, Math.round(Number(it.weight) || 1));
    const img = imageFor ? imageFor(it) : '';
    results.push({ type: 'text', name: clean(it.name).slice(0, 200), description: esc(it.name || ''), weight: w, range: [at, at + w - 1], ...(img ? { img } : {}) });
    at += w;
  }
  return { name: clean(t.name) || 'Table', formula: results.length ? '1d' + (at - 1) : '1d1', replacement: true, displayRoll: true, results };
}

// Roll20 journal links -> Foundry UUID links.
export function relinkHTML(html, uuidFor) {
  return String(html || '')
    .replace(/<a\b[^>]*href="(?:https?:)?\/\/journal\.roll20\.net\/(?:handout|character)\/([^"]+)"[^>]*>(.*?)<\/a>/gi, (m, id, text) => {
      const uuid = uuidFor(id);
      return uuid ? '@UUID[' + uuid + ']{' + text.replace(/<[^>]+>/g, '').replace(/[{}]/g, '') + '}' : m;
    });
}
