// Compares an imported Foundry character with its Roll20 data and lists what
// differs: missing features, items and spells; compendium items whose Roll20
// text the DM changed; ability scores, HP, AC, speed and proficiencies.
// Pure data in, findings out (each with the fix that would apply it).
import { convertCharacter, sheetStore, storeIntegrants } from './convert.js';

const normName = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const plain = (h) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').toLowerCase()
  .replace(/[^a-z0-9+-]+/g, ' ').replace(/\s+/g, ' ').trim();

// Does the Roll20 text say something the other text doesn't?
// Changed numbers (damage, DCs, ranges) count even when the wording matches.
export function textDiffers(r20, other) {
  const a = plain(r20);
  const b = plain(other);
  if (a.length < 40 || b.includes(a)) return false;
  const bw = new Set(b.split(' '));
  const aw = a.split(' ');
  const overlap = aw.filter((w) => bw.has(w)).length / aw.length;
  const newNumbers = [...new Set(aw.filter((w) => /\d/.test(w) && !bw.has(w)))];
  return overlap < 0.8 || newNumbers.length > 1;
}

// Paths on the actor that the Roll20 sheet sets.
function statPaths(system) {
  const out = [];
  for (const [k, a] of Object.entries(system.abilities || {})) {
    if (a.value !== undefined) out.push(['abilities.' + k + '.value', a.value, k.toUpperCase()]);
    out.push(['abilities.' + k + '.proficient', a.proficient || 0, k.toUpperCase() + ' save proficiency']);
  }
  for (const [k, s] of Object.entries(system.skills || {})) out.push(['skills.' + k + '.value', s.value, 'skill ' + k]);
  const at = system.attributes || {};
  if (at.hp?.max != null) out.push(['attributes.hp.max', at.hp.max, 'HP max']);
  if (at.ac?.flat != null) out.push(['attributes.ac.flat', at.ac.flat, 'AC']);
  for (const [k, v] of Object.entries(at.movement?.speeds || {})) if (v) out.push(['attributes.movement.speeds.' + k, v, k + ' speed']);
  return out;
}
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * ch: Roll20 character from campaign.json.
 * resolved: what each conv.lookups entry became (compendium copy or Roll20 fallback), same order.
 * actor: { system (source data), items: [{ id, name, type, desc, levels }] }.
 */
export function auditCharacter(ch, resolved, actor, conv = convertCharacter(ch)) {
  const findings = [];
  const add = (f) => findings.push(f);
  const onActor = new Map();
  for (const it of actor.items) {
    const k = normName(it.name);
    if (!onActor.has(k)) onActor.set(k, []);
    onActor.get(k).push(it);
  }
  const pick = (name, type) => { const l = onActor.get(normName(name)) || []; return l.find((x) => x.type === type) || l[0]; };
  const expected = new Set();

  // Features, traits, attacks and anything else built from the sheet itself.
  for (const it of conv.items) {
    expected.add(normName(it.name));
    const have = pick(it.name, it.type);
    const r20 = it.system?.description?.value || '';
    if (!have) { add({ kind: 'missing', name: it.name, detail: it.type, fix: { op: 'add', data: it } }); continue; }
    if (plain(r20).length > plain(have.desc).length + 20 && textDiffers(r20, have.desc)) {
      add({ kind: 'text', name: it.name, detail: 'Roll20 has more text', fix: { op: 'desc', id: have.id, html: r20 } });
    }
  }
  // Classes, species, gear and spells: compendium copies or Roll20 versions.
  conv.lookups.forEach((l, i) => {
    const data = resolved[i];
    if (!data) return;
    expected.add(normName(data.name));
    expected.add(normName(l.name));
    const have = pick(data.name, data.type) || pick(l.name, data.type);
    const fromPack = data._stats?.compendiumSource;
    if (!have) {
      add({ kind: 'missing', name: l.name, detail: data.type + (fromPack ? ' (compendium)' : ' (Roll20 version)'), fix: { op: 'add', data } });
      return;
    }
    if (l.kind === 'class' && data.system?.levels && have.levels !== data.system.levels) {
      add({ kind: 'stat', name: l.name, detail: `level ${have.levels ?? '?'} in Foundry, ${data.system.levels} in Roll20`, fix: { op: 'item', id: have.id, update: { 'system.levels': data.system.levels } } });
    }
    // A compendium copy stood in for something the DM may have rewritten.
    const r20 = l.fallback?.system?.description?.value || '';
    if (fromPack && textDiffers(r20, have.desc)) {
      add({
        kind: 'changed', name: l.name, detail: data.type + ': Roll20 text differs from the dnd5e compendium',
        r20: plain(r20).slice(0, 300),
        fix: { op: 'desc', id: have.id, html: '<p><em>Roll20 version (the DM\'s text). Check the item\'s numbers against it.</em></p>' + r20 + '<hr><details><summary>dnd5e compendium text</summary>' + (have.desc || '') + '</details>' },
      });
    }
    const mine = data.system?.description?.value || '';
    // Brought over earlier as a bare name (plain loot): rebuild it as what
    // Roll20's saved data says it is (weapon, armour…).
    if (have.type !== data.type && have.type === 'loot' && ['weapon', 'equipment', 'consumable', 'tool'].includes(data.type)) {
      add({ kind: 'text', name: data.name, detail: `rebuilt as ${data.type} from Roll20's saved data`, fix: { op: 'replace', id: have.id, data } });
    } else if (!fromPack && textDiffers(mine, have.desc)) {
      add({ kind: 'text', name: data.name, detail: 'Roll20 has the full text', fix: { op: 'desc', id: have.id, html: mine } });
    }
    if (!fromPack && !['race', 'subclass', 'background', 'class'].includes(data.type)) {
      add({ kind: 'custom', name: data.name, detail: data.type + (plain(mine).length > 40 ? ': homebrew, with Roll20\'s text' : ': not in any compendium, name only') });
    }
  });

  // Numbers on the sheet.
  const sys = conv.actor.system || {};
  for (const [path, want, label] of statPaths(sys)) {
    const have = get(actor.system, path);
    if (want === undefined || want === null) continue;
    if (/proficient$/.test(path) && !want && !have) continue;
    if (String(have ?? '') !== String(want)) add({ kind: 'stat', name: label, detail: `${have ?? '—'} in Foundry, ${want} in Roll20`, fix: { op: 'set', path: 'system.' + path, value: want } });
  }
  if (Object.keys(sys.skills || {}).length) {
    for (const [k, s] of Object.entries(actor.system.skills || {})) {
      if (s?.value && !sys.skills[k]) add({ kind: 'stat', name: 'skill ' + k, detail: `proficient in Foundry, not in Roll20`, fix: { op: 'set', path: 'system.skills.' + k + '.value', value: 0 } });
    }
  }

  // 2024-sheet text that an older exporter cut at exactly 600 characters
  // (newer exports keep the whole text, so longer is fine).
  const snap = conv.sheetKind === '2024' ? ch.r20e_snapshot : null;
  const all = snap ? [...(snap.features || []), ...(snap.actions || [])] : [];
  const full = all.some((f) => String(f.desc || '').length > 600);
  const kit = snap ? storeIntegrants(sheetStore(ch)) : null;
  const cut = full ? [] : all.filter((f) => String(f.desc || '').length === 600 && !(kit.find(f.name)?.description?.length > 600)).map((f) => f.name);
  if (cut.length) add({ kind: 'cut', name: [...new Set(cut)].join(', '), detail: 'descriptions cut off at 600 characters in this export' });

  // Things only Foundry has (added after the import, or renamed).
  for (const it of actor.items) {
    if (!expected.has(normName(it.name))) add({ kind: 'extra', name: it.name, detail: it.type + ': only in Foundry' });
  }
  return { sheet: conv.sheetKind, findings };
}

export const KIND_LABEL = {
  missing: 'Missing from Foundry', changed: 'DM-changed (compendium text replaced Roll20\'s)', text: 'Roll20 has more (text or details)',
  stat: 'Numbers that differ', custom: 'Homebrew from Roll20', cut: 'Cut short in the export', extra: 'Only in Foundry',
};
