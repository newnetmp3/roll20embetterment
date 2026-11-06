// The Roll20 -> Foundry importer: conversions (convert.js) and the server-side
// prep script (r20prep.py) against a small export in R20Exporter's format.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cv from '../importer/module/scripts/convert.js';
import { zip } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const A = (name, current, max = '') => ({ name, current, max, id: 'x' });
const ROW = '-Mabcdefghijklmnopq1';
const ROW2 = '-Mabcdefghijklmnopq2';

export const npc = {
  id: '-Cnpc', name: 'TstW - Ogre', controlledby: [], inplayerjournals: [], bio: '<p>Big.</p>', gmnotes: 'Weak to fire',
  defaulttoken: { imgsrc: 'https://s3.amazonaws.com/files.d20.io/images/1/a/thumb.png', width: 140, height: 140, name: 'Ogre', emits_bright_light: true, bright_light_distance: 10, emits_low_light: true, low_light_distance: 10 },
  attributes: [
    A('npc', '1'), A('npc_name', 'Ogre'), A('npc_type', 'Large giant, chaotic evil'), A('npc_challenge', '2'),
    A('npc_ac', '11'), A('hp', '59', '59'), A('npc_hpformula', '7d10+21'), A('npc_speed', '40 ft., climb 20 ft.'),
    A('npc_senses', 'darkvision 60 ft., passive Perception 8'), A('npc_languages', 'Common, Giant'),
    A('strength', '19'), A('dexterity', '8'), A('constitution', '16'), A('intelligence', '5'), A('wisdom', '7'), A('charisma', '7'),
    A('npc_legendary_actions', ''),
    A(`repeating_npcaction_${ROW}_name`, 'Greatclub'), A(`repeating_npcaction_${ROW}_attack_flag`, 'on'),
    A(`repeating_npcaction_${ROW}_attack_type`, 'Melee'), A(`repeating_npcaction_${ROW}_attack_range`, 'Reach 5 ft.'),
    A(`repeating_npcaction_${ROW}_attack_tohit`, '6'), A(`repeating_npcaction_${ROW}_attack_damage`, '2d8+4'),
    A(`repeating_npcaction_${ROW}_attack_damagetype`, 'Bludgeoning'),
    A(`repeating_npcaction_${ROW2}_name`, 'Stomp (Recharge 5-6)'), A(`repeating_npcaction_${ROW2}_description`, 'Each creature must make a DC 14 Dexterity saving throw.'),
    A(`repeating_npctrait_${ROW}_name`, 'Brute'), A(`repeating_npctrait_${ROW}_description`, 'Hits hard.'),
    A('_reporder_repeating_npcaction', `${ROW2.toLowerCase()},${ROW}`),
  ],
  abilities: [{ name: 'Smash', action: '&{template:default}' }],
};
export const pc = {
  id: '-Cpc', name: 'Salven', controlledby: ['-Pplayer'], inplayerjournals: ['all'], bio: '<p>See <a href="http://journal.roll20.net/handout/-Hbag">the bag</a>.</p>',
  defaulttoken: { width: 70, height: 70, has_bright_light_vision: true, has_night_vision: true, night_vision_distance: 60 },
  attributes: [
    A('strength', '16'), A('dexterity', '14'), A('constitution', '14'), A('intelligence', '10'), A('wisdom', '12'), A('charisma', '8'),
    A('hp', '30', '44'), A('ac', '16'), A('speed', '30'), A('class', 'Fighter'), A('base_level', '5'), A('race', 'Human'), A('background', 'Soldier'),
    A('athletics_prof', '(@{pb}*@{athletics_type})'), A('strength_save_prof', '(@{pb})'), A('gp', '25'),
    A('class_resource_name', 'Second Wind'), A('class_resource', '0', '1'), A('lvl1_slots_total', '2'), A('lvl1_slots_expended', '1'),
    A(`repeating_inventory_${ROW}_itemname`, 'Longsword'), A(`repeating_inventory_${ROW}_itemcount`, '1'), A(`repeating_inventory_${ROW}_equipped`, '1'),
    A(`repeating_inventory_${ROW}_itemmodifiers`, 'Item Type: Melee Weapon, Damage: 1d8, Damage Type: slashing'),
    A(`repeating_attack_${ROW}_atkname`, 'Longsword'), A(`repeating_attack_${ROW2}_atkname`, 'Javelin'),
    A(`repeating_attack_${ROW2}_atkbonus`, '+5'), A(`repeating_attack_${ROW2}_dmgbase`, '1d6'), A(`repeating_attack_${ROW2}_dmgattr`, '@{strength_mod}'),
    A(`repeating_attack_${ROW2}_dmgtype`, 'piercing'), A(`repeating_attack_${ROW2}_atkrange`, '30/120'),
    A(`repeating_spell-1_${ROW}_spellname`, 'Shield'), A(`repeating_spell-1_${ROW}_spellprepared`, '1'),
    A(`repeating_spell-1_${ROW}_spellcastingtime`, '1 reaction'), A(`repeating_spell-1_${ROW}_spellschool`, 'abjuration'),
    A(`repeating_traits_${ROW}_name`, 'Action Surge'), A(`repeating_traits_${ROW}_source`, 'Class'),
  ],
};
export const page = {
  id: '-Pg1', name: 'Bridge Encounter', width: 10, height: 8, snapping_increment: 1, grid_type: 'square', scale_number: 5, scale_units: 'ft',
  dynamic_lighting_enabled: true, explorer_mode: 'basic', zorder: ['-Gmap', '-Gogre', '-Gprop'],
  graphics: [
    { id: '-Gmap', layer: 'map', left: 350, top: 280, width: 700, height: 560, imgsrc: 'https://x/max.png' },
    { id: '-Gogre', layer: 'objects', left: 140, top: 140, width: 140, height: 140, represents: '-Cnpc', name: 'Ogre', bar1_value: '40', bar1_max: '59', imgsrc: 'https://x/o.png' },
    { id: '-Gprop', layer: 'gmlayer', left: 35, top: 35, width: 70, height: 70, imgsrc: 'https://x/p.png' },
  ],
  paths: [
    { id: '-Wall', layer: 'walls', left: 350, top: 100, width: 200, height: 0, scaleX: 1, scaleY: 1, path: [['M', 0, 0], ['L', 200, 0]] },
    { id: '-Draw', layer: 'map', left: 100, top: 100, width: 100, height: 100, stroke: '#ff0000', fill: 'transparent', stroke_width: 5, path: [['M', 0, 0], ['L', 100, 0], ['L', 100, 100], ['Z']] },
  ],
  texts: [{ id: '-Txt', layer: 'objects', left: 300, top: 300, width: 100, height: 20, text: 'Bridge', font_size: 18, color: 'rgb(0,0,0)' }],
};

test('Roll20 sheet attributes: repeating rows in their saved order', () => {
  const s = cv.readSheet(npc);
  assert.deepEqual(s.rows('npcaction').map((r) => r.name), ['Stomp (Recharge 5-6)', 'Greatclub']);
  assert.equal(s.get('npc_ac'), '11');
});

test('Classic NPC -> dnd5e NPC with working attacks', () => {
  const c = cv.convertCharacter(npc);
  assert.equal(c.actor.type, 'npc');
  const sys = c.actor.system;
  assert.equal(sys.attributes.hp.max, 59);
  assert.equal(sys.attributes.ac.flat, 11);
  assert.deepEqual(sys.attributes.movement.speeds, { walk: 40, climb: 20 });
  assert.deepEqual(sys.attributes.senses.ranges, { darkvision: 60 });
  assert.equal(sys.details.cr, 2);
  assert.equal(sys.details.type.value, 'giant');
  assert.equal(sys.traits.size, 'lg');
  assert.match(sys.details.biography.value, /secret/);
  const club = c.items.find((i) => i.name === 'Greatclub');
  assert.equal(club.system.actionType, 'mwak');
  assert.deepEqual(club.system.attack, { bonus: '6', flat: true });
  assert.deepEqual(club.system.damage.parts, [['2d8+4', 'bludgeoning']]);
  assert.equal(club._stats.systemVersion, '3.3.1'); // dnd5e migrates this into an attack activity
  const stomp = c.items.find((i) => i.name.startsWith('Stomp'));
  assert.deepEqual(stomp.system.save, { ability: 'dex', dc: 14, scaling: 'flat' });
  assert.deepEqual(stomp.system.recharge, { value: 5, charged: true });
  assert.ok(c.items.some((i) => i.name === 'Brute'));
});

test('Classic PC -> character, with compendium lookups for class, gear and spells', () => {
  const c = cv.convertCharacter(pc);
  assert.equal(c.actor.type, 'character');
  const sys = c.actor.system;
  assert.deepEqual([sys.attributes.hp.value, sys.attributes.hp.max], [30, 44]);
  assert.equal(sys.skills.ath.value, 1);
  assert.equal(sys.abilities.str.proficient, 1);
  assert.equal(sys.currency.gp, 25);
  assert.deepEqual(sys.spells.spell1, { value: 1, override: 2 });
  const kinds = c.lookups.map((l) => l.kind + ':' + l.name);
  assert.deepEqual(kinds, ['class:Fighter', 'race:Human', 'background:Soldier', 'gear:Longsword', 'spell:Shield']);
  assert.equal(c.lookups[0].patch.system.levels, 5);
  assert.equal(c.lookups.find((l) => l.kind === 'spell').fallback.system.activation.type, 'reaction');
  const jav = c.items.find((i) => i.name === 'Javelin');
  assert.deepEqual(jav.system.damage.parts, [['1d6 + 3', 'piercing']]);
  assert.equal(jav.system.actionType, 'rwak');
  assert.equal(c.items.some((i) => i.name === 'Longsword' && i.type === 'feat'), false, 'attack row covered by the inventory weapon');
  assert.equal(c.items.find((i) => i.name === 'Second Wind').system.uses.spent, 1);
});

test('Roll20 page -> scene: map image, token, hidden prop, wall, drawing, text', () => {
  const actorFor = (id) => (id === '-Cnpc' ? { id: 'A1', prototype: { name: 'Ogre', actorLink: false, texture: { src: 'tok.png' }, light: {}, sight: {} } } : null);
  const { scene, stats } = cv.convertPage(page, { imageFor: (p, g) => 'r20import/x/' + g.id + '.png', actorFor });
  assert.deepEqual([scene.width, scene.height, scene.grid.size, scene.grid.distance, scene.padding], [700, 560, 70, 5, 0]);
  assert.equal(scene.tokenVision, true);
  assert.deepEqual(stats, { tokens: 1, tiles: 2, walls: 1, drawings: 2, missingImages: 0 });
  const tok = scene.tokens[0];
  assert.deepEqual([tok.x, tok.y, tok.width, tok.height, tok.actorId], [70, 70, 2, 2, 'A1']);
  assert.equal(tok.delta.system.attributes.hp.value, 40);
  const map = scene.tiles.find((t) => t.flags.r20import.layer === 'map');
  assert.deepEqual([map.x, map.y, map.width, map.height, map.hidden], [350, 280, 700, 560, false], 'tiles are placed by their centre in v14');
  assert.equal(scene.tiles.find((t) => t.flags.r20import.layer === 'gmlayer').hidden, true);
  assert.deepEqual(scene.walls[0].c, [250, 100, 450, 100]);
  const rect = scene.drawings.find((d) => d.shape.type === 'p');
  assert.deepEqual([rect.x, rect.y, rect.strokeColor, rect.fillAlpha], [50, 50, '#ff0000', 0]);
  assert.equal(scene.drawings.find((d) => d.text === 'Bridge').fontSize, 18);
});

test('lights and vision on tokens', () => {
  assert.deepEqual(cv.tokenSettings(npc.defaulttoken, 70).light, { bright: 10, dim: 20 });
  assert.deepEqual(cv.tokenSettings(pc.defaulttoken, 70).sight, { enabled: true, range: 60, visionMode: 'darkvision' });
  assert.deepEqual(cv.tokenSettings({ light_radius: 40, light_dimradius: 20 }, 70).light, { dim: 40, bright: 20 });
});

test('handouts, roll tables and journal links', () => {
  const j = cv.convertHandout({ name: 'Bag', notes: '<p>hi</p>', gmnotes: '<p>secret</p>' }, 'img.png');
  assert.deepEqual(j.pages.map((p) => p.type + ':' + (p.ownership ? 'gm' : '')), ['image:', 'text:', 'text:gm']);
  const t = cv.convertTable({ name: 'Loot', items: [{ name: 'Gold', weight: 3 }, { name: 'Gem', weight: 1 }] });
  assert.equal(t.formula, '1d4');
  assert.deepEqual(t.results.map((r) => r.range), [[1, 3], [4, 4]]);
  const html = cv.relinkHTML(pc.bio, (id) => (id === '-Hbag' ? 'JournalEntry.abc' : null));
  assert.equal(html, '<p>See @UUID[JournalEntry.abc]{the bag}.</p>');
});

test('r20prep.py: unpacks, fixes image types, indexes ids, installs the module', () => {
  try { execFileSync('python3', ['--version']); } catch { return; }
  const tmp = mkdtempSync(join(tmpdir(), 'r20prep-'));
  const data = join(tmp, 'Data');
  mkdirSync(join(data, 'modules'), { recursive: true });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
  const campaign = {
    campaign_title: 'The Shattered Lands', characters: [npc], handouts: [{ id: '-Hbag', name: 'Bag' }], pages: [page],
    players: [{ id: '-Pplayer', displayname: 'Scott' }], jukebox: [{ id: '-T1', title: 'Battle' }], jukeboxfolder: [{ n: 'Combat', i: ['-T1'] }],
    journalfolder: [], tables: [], macros: [],
  };
  const files = [
    ['campaign.json', Buffer.from(JSON.stringify(campaign))],
    ['chat_archive.json', Buffer.from('[]')],
    ['characters/000 - TstW - Ogre/character.json', Buffer.from(JSON.stringify(npc))],
    ['characters/000 - TstW - Ogre/avatar.png', jpg],
    ['journal/000 - TstW - Ogre/character.json', Buffer.from(JSON.stringify(npc))],
    ['journal/001 - Bag/handout.json', Buffer.from(JSON.stringify({ id: '-Hbag', name: 'Bag' }))],
    ['journal/001 - Bag/avatar.png', png],
    ['pages/000 - Bridge Encounter/page.json', Buffer.from(JSON.stringify(page))],
    ['pages/000 - Bridge Encounter/graphics/-Gmap.png', jpg],
    ['jukebox/000 - Combat/000 - Battle.mp3', Buffer.from('ID3....')],
  ];
  const z = join(tmp, 'export.zip');
  writeFileSync(z, zip(files));
  const out = execFileSync('python3', [join(root, 'importer/r20prep.py'), z, '--data', data, '--user', process.env.USER || 'root'], { encoding: 'utf8' });
  assert.match(out, /Indexed 1 characters, 1 handouts, 1 pages, 1 audio tracks/);
  const dir = join(data, 'r20import', 'the-shattered-lands');
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  assert.equal(index.characters['-Cnpc'], 'characters/000 - TstW - Ogre');
  assert.equal(index.files['characters/000 - TstW - Ogre/avatar.png'], 'characters/000 - TstW - Ogre/avatar.jpg');
  assert.equal(index.files['journal/001 - Bag/avatar.png'], 'journal/001 - Bag/avatar.png');
  assert.equal(index.tracks['-T1'], 'jukebox/000 - Combat/000 - Battle.mp3');
  assert.ok(existsSync(join(dir, 'pages/000 - Bridge Encounter/graphics/-Gmap.jpg')));
  assert.ok(!existsSync(join(dir, 'journal/000 - TstW - Ogre')), 'duplicate character copies are skipped');
  assert.ok(!existsSync(join(dir, 'chat_archive.json')));
  assert.ok(existsSync(join(data, 'modules/r20import/module.json')));
});

test('2024-sheet characters: the exporter\'s sheet reading becomes a dnd5e actor', () => {
  const snap = {
    type: 'pc', name: 'Nier', stats: { hp: 30, maxHp: 44, ac: 17, speed: 30, level: 5, hitDice: [{ cur: 3, max: 5 }] },
    hitDice: [{ ref: 'hitdie:0:x', name: 'Roll a d10 hit die', label: 'D10 (Fighter)' }],
    abilities: [{ name: 'STR', score: 16, mod: '+3', save: '+6' }, { name: 'DEX', score: 14, mod: '+2', save: '+2' }],
    checks: [{ name: 'Stealth', bonus: '+5', prof: 'proficient' }, { name: 'Athletics', bonus: '+9', prof: 'expertise' }],
    attacks: [{ name: 'Dagger', hit: '+5 Attack', dmg: [{ text: '1d4+3', type: 'Piercing' }], range: '20/60' }, { name: 'Dagger (Off-Hand)', hit: '+5 Attack', dmg: [{ text: '1d4', type: 'Piercing' }] },
      { name: 'Throw Handaxe', hit: '+6 Attack', dmg: [{ text: '1d6+4', type: 'Slashing' }], range: '20/60' }, { name: 'Longsword', hit: '+6 Attack', dmg: [{ text: '1d8+3', type: 'Slashing' }] }],
    actions: [{ name: 'Second Wind', section: 'Bonus Actions', desc: 'Heal.', res: [{ i: 0, name: 'Second Wind', cur: 1, max: 2 }] },
      { name: 'Actions in Combat', section: 'Actions' }, { name: 'Use Healer\'s Kit', section: 'Actions', res: [{ i: 0, cur: 9, max: 10 }] }],
    features: [{ name: 'Second Wind', section: 'Class Features', desc: 'dup' }, { name: 'Weapon Mastery', section: 'Class Features', desc: 'Masteries.' }],
    items: [{ name: 'Longsword', qty: 1, equipped: true }, { name: 'Healer\'s Kit', qty: 1 }],
    spells: [{ name: 'Shield', level: '1ST', tags: [], prepared: true }],
  };
  const c = cv.convertCharacter({ id: '-C', name: 'Nier', attributes: [{ name: 'beacon', current: 1 }], r20e_snapshot: snap });
  assert.equal(c.sheetKind, '2024');
  const sys = c.actor.system;
  assert.deepEqual([sys.abilities.str.value, sys.abilities.str.proficient, sys.abilities.dex.proficient], [16, 1, undefined]);
  assert.deepEqual([sys.skills.ste.value, sys.skills.ath.value], [1, 2]);
  assert.deepEqual([sys.skills.ste.ability, sys.skills.ath.ability], ['dex', 'str'], 'skills keep their ability');
  assert.deepEqual([sys.attributes.hp.value, sys.attributes.hp.max, sys.attributes.ac.flat], [30, 44, 17]);
  const names = c.items.map((i) => i.name);
  assert.deepEqual(names, ['Dagger', 'Handaxe', 'Second Wind', 'Weapon Mastery'], 'one weapon per base; Longsword from the inventory; no rules lists or item actions; Second Wind once');
  assert.deepEqual(c.items.slice(0, 2).map((i) => i.type), ['weapon', 'weapon']);
  assert.equal(c.items[0].system.equipped, true);
  assert.deepEqual(c.items[0].system.attack, { bonus: '5', flat: true });
  assert.deepEqual(c.items[0].system.damage.parts, [['1d4', 'piercing']], 'dnd5e adds the modifier to weapon damage');
  assert.equal(c.items[2].system.activation.type, 'bonus');
  assert.equal(c.items[2].system.uses.spent, 1);
  assert.deepEqual(c.lookups.map((l) => l.kind + ':' + l.name), ['class:Fighter', 'gear:Longsword', 'gear:Healer\'s Kit', 'spell:Shield']);
  assert.equal(c.lookups[0].patch.system.levels, 5);
  assert.equal(c.lookups[0].fallback.system.hd.denomination, 'd10');
});

test('r20prep.py: a multi-part Roll20embetterment export (shared assets/)', () => {
  try { execFileSync('python3', ['--version']); } catch { return; }
  const tmp = mkdtempSync(join(tmpdir(), 'r20prep2-'));
  const data = join(tmp, 'Data');
  mkdirSync(join(data, 'modules'), { recursive: true });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
  const camp = { campaign_title: 'Two Parts', pages: [page], characters: [npc], handouts: [], players: [], jukebox: [{ id: '-T1', title: 'x' }, { id: '-T2', title: 'Tavern' }], jukeboxfolder: ['-T1', '-T2'],
    r20e: { format: 1, assets: { 'https://x/max.png': 'assets/00001.png', 'https://x/o.png': 'assets/00002.jpg' }, tracks: { '-T1': 'assets/00003.mp3' }, audioFolder: 'Two Parts - audio', audioFiles: { '-T2': '-T2.audio' } } };
  mkdirSync(join(tmp, 'Two Parts - audio'));
  writeFileSync(join(tmp, 'Two Parts - audio', '-T2.audio'), Buffer.from('OggS\0\x02rest'));
  writeFileSync(join(tmp, 'Two Parts - Foundry export part 1.zip'), zip([['assets/00001.png', jpg], ['assets/00002.jpg', jpg]]));
  writeFileSync(join(tmp, 'Two Parts - Foundry export part 2.zip'), zip([['assets/00003.mp3', Buffer.from('ID3x')], ['campaign.json', Buffer.from(JSON.stringify(camp))]]));
  const out = execFileSync('python3', [join(root, 'importer/r20prep.py'), join(tmp, 'Two Parts - Foundry export part 1.zip'), '--data', data, '--user', process.env.USER || 'root', '--skip-module', '--no-download'], { encoding: 'utf8' });
  assert.match(out, /part 2\.zip/);
  const index = JSON.parse(readFileSync(join(data, 'r20import', 'two-parts', 'index.json'), 'utf8'));
  assert.equal(index.files['assets/00001.png'], 'assets/00001.jpg', 'real file type');
  assert.equal(index.assets['https://x/max.png'], 'assets/00001.png');
  assert.equal(index.tracks['-T1'], 'assets/00003.mp3');
  assert.ok(existsSync(join(data, 'r20import', 'two-parts', 'assets', '00003.mp3')));
  assert.equal(index.tracks['-T2'], 'audio/-T2.ogg', 'uploaded audio from the folder beside the zips');
  assert.ok(existsSync(join(data, 'r20import', 'two-parts', 'audio', '-T2.ogg')));
});

test('custom species, subclass and background from the 2024 sheet', () => {
  const F = (section, source, name, desc) => ({ section, source, name, desc, timing: '' });
  const snap = {
    type: 'pc', name: 'Nier', stats: { hp: 84, maxHp: 84, ac: 17, speed: 55, level: 5, hitDice: [{ cur: 5, max: 5 }] },
    hitDice: [{ ref: 'hitdie:0:x', label: 'D10 (Fighter)' }],
    features: [
      F('Class Features', 'Fighter', 'Second Wind', 'Heal.'),
      F('Class Features', 'Echo Knight', 'Manifest Echo', 'An echo.'),
      F('Species Traits', 'Elves of R’Ley', 'Keen Senses', 'Perception.'),
      F('Species Traits', 'Elves of R’Ley', 'Landborn Magic', 'Druidcraft.'),
      F('Species Traits', 'Elves of R’Ley', 'Landborn Magic', 'Detect Magic at 3rd level.'),
      F('Species Traits', 'Species', 'Size', '5 by 5 ft'),
      F('Feats', 'Fighter', 'Mobile', 'Fast.'),
      F('Other', 'Far Traveler', 'All Eyes on You', 'Accent.'),
    ],
  };
  const c = cv.convertCharacter({ id: '-C', name: 'Nier', attributes: [{ name: 'x', current: 1 }], r20e_snapshot: snap });
  const look = Object.fromEntries(c.lookups.map((l) => [l.kind, l]));
  assert.equal(look.race.name, 'Elves of R’Ley');
  assert.equal(look.race.fallback.type, 'race');
  assert.match(look.race.fallback.system.description.value, /Keen Senses[\s\S]*Druidcraft[\s\S]*Detect Magic/);
  assert.deepEqual(look.race.fallback.flags.r20import.traits, ['Keen Senses', 'Landborn Magic', 'Size']);
  assert.equal(look.subclass.name, 'Echo Knight');
  assert.equal(look.subclass.fallback.system.classIdentifier, 'fighter');
  assert.equal(look.background.name, 'Far Traveler');
  const feat = (n) => c.items.find((i) => i.name === n);
  assert.equal(c.items.filter((i) => i.name === 'Landborn Magic').length, 1, 'repeated traits merge');
  assert.match(feat('Landborn Magic').system.description.value, /Druidcraft[\s\S]*Detect Magic/);
  assert.deepEqual(['Keen Senses', 'Mobile', 'All Eyes on You', 'Second Wind'].map((n) => feat(n).system.type.value), ['race', 'feat', 'background', 'class']);
  assert.equal(feat('Manifest Echo').system.requirements, 'Echo Knight');
});

test('character check: missing items, DM-changed spells, numbers, cut text', async () => {
  const { auditCharacter, textDiffers } = await import('../importer/module/scripts/audit.js');
  const ch = structuredClone(pc);
  const R = '-Mabcdefghijklmnopq1';
  ch.attributes.push(A(`repeating_spell-1_${R}_spelldescription`, 'An invisible barrier of magical force appears. You gain +7 to AC until the start of your next turn and resist fire damage.'));
  const conv = cv.convertCharacter(ch);
  const compendium = (l) => ({ name: l.name, type: { gear: 'weapon', spell: 'spell' }[l.kind] || l.kind, _stats: { compendiumSource: 'Compendium.dnd5e.x.' + l.name }, system: { levels: l.patch?.system?.levels, description: { value: l.kind === 'spell' ? '<p>An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.</p>' : '' } } });
  const resolved = conv.lookups.map(compendium);
  const items = [
    { id: 'i1', name: 'Fighter', type: 'class', desc: '', levels: 4 },
    { id: 'i2', name: 'Shield', type: 'spell', desc: resolved.find((r) => r.type === 'spell').system.description.value },
    { id: 'i3', name: 'Javelin', type: 'weapon', desc: '' },
    { id: 'i4', name: 'Homemade Hat', type: 'equipment', desc: '' },
  ];
  const system = structuredClone(conv.actor.system);
  system.abilities.str.value = 15;
  const { findings } = auditCharacter(ch, resolved, { system, items }, conv);
  const by = (k) => findings.filter((f) => f.kind === k).map((f) => f.name);
  assert.ok(by('missing').includes('Action Surge'));
  assert.ok(by('missing').includes('Longsword'));
  assert.deepEqual(by('changed'), ['Shield']);
  assert.match(findings.find((f) => f.kind === 'changed').fix.html, /\+7 to AC[\s\S]*compendium text/);
  assert.ok(by('stat').includes('Fighter'), 'class level');
  assert.ok(by('stat').includes('STR'));
  assert.equal(findings.find((f) => f.name === 'STR').fix.value, 16);
  assert.deepEqual(by('extra'), ['Homemade Hat']);
  assert.equal(textDiffers('Same words here in the description of a spell.', '<p>Same words here in the description of a spell.</p>'), false);

  const snap = { type: 'pc', name: 'N', stats: { hp: 10, maxHp: 10, ac: 12 }, features: [{ section: 'Other', source: '', name: 'Long One', desc: 'x'.repeat(600) }] };
  const c2 = cv.convertCharacter({ id: '-C', name: 'N', attributes: [{ name: 'x', current: 1 }], r20e_snapshot: snap });
  const f2 = auditCharacter({ r20e_snapshot: snap }, [], { system: c2.actor.system, items: [{ id: 'a', name: 'Long One', type: 'feat', desc: c2.items[0].system.description.value }] }, c2).findings;
  assert.deepEqual(f2.map((f) => f.kind), ['cut']);
});

test('2024 sheet: items, spells and features from the sheet\'s saved data', async () => {
  const { auditCharacter } = await import('../importer/module/scripts/audit.js');
  const store = { integrants: { integrants: {
    a1: { _id: 'a1', _enabled: true, type: 'Item', name: 'Obsidian Dagger', recordName: 'Dagger', description: 'A black blade.\n\n**Cursed.** It *hums*.', cost: '2 GP', weight: 1, quantity: 1, properties: '["Finesse","Light","Thrown"]', weaponData: { category: 'Melee', training: 'Simple', type: 'Dagger' }, equipData: { equippable: true, equipped: true }, childIDs: '["a2"]' },
    a2: { _id: 'a2', _enabled: true, type: 'Attack', name: 'Obsidian Dagger', parentID: 'a1', source: 'Item', childIDs: '["a3"]' },
    a3: { _id: 'a3', _enabled: true, type: 'Damage', name: 'Dagger Damage', _diceCount: 1, diceSize: 'd4', damageType: 'Force' },
    b1: { _id: 'b1', _enabled: true, type: 'Item', name: 'Gloves of the Great Wolf', description: 'Claws of the pack. Once per day the wearer may howl to call 1d4 wolves for an hour.', weight: 1, quantity: 1, equipData: { equippable: true, equipped: true } },
    s1: { _id: 's1', _enabled: true, type: 'Spells', name: 'Force Buckler', description: 'A shield of force.', castingTime: '1 Bonus Action', school: 'Abjuration', concentration: true, components: { verbal: true, somatic: true }, duration: '1 Minute', range: 'Self', level: 1 },
    f1: { _id: 'f1', _enabled: true, type: 'Features', name: 'Manifest Echo', description: 'x'.repeat(900) },
  } } };
  const snap = { type: 'pc', name: 'Nier', stats: { hp: 10, maxHp: 10, ac: 12 },
    items: [{ name: 'Obsidian Dagger', qty: 1, equipped: true, sub: 'Weapon' }, { name: 'Gloves of the Great Wolf', qty: 1 }],
    attacks: [{ name: 'Obsidian Dagger', hit: '+5', dmg: [{ text: '1d4+3', type: 'Force' }] }, { name: 'Force Buckler', hit: '+5', dmg: [] }],
    spells: [{ name: 'Force Buckler', level: '1st Level', tags: ['C'] }],
    features: [{ section: 'Class Features', source: 'Echo Knight', name: 'Manifest Echo', desc: 'x'.repeat(600) }] };
  const ch = { id: '-C', name: 'Nier', attributes: [{ name: 'store', current: JSON.stringify(store) }], r20e_snapshot: snap };
  const c = cv.convertCharacter(ch);
  const dag = c.lookups.find((l) => l.kind === 'gear' && l.name === 'Obsidian Dagger');
  assert.equal(dag.roll20, true, 'a weapon with saved damage keeps Roll20\'s numbers');
  assert.equal(dag.fallback.type, 'weapon');
  assert.equal(dag.fallback.system.type.value, 'simpleM');
  assert.deepEqual(dag.fallback.system.damage.parts, [['1d4', 'force']]);
  assert.equal(c.items.some((i) => i.type === 'weapon' && /Obsidian/.test(i.name)), false, 'its attack row is not a second weapon');
  assert.deepEqual(dag.fallback.system.properties, ['fin', 'lgt', 'thr']);
  assert.match(dag.fallback.system.description.value, /<strong>Cursed\.<\/strong> It <em>hums<\/em>/);
  assert.deepEqual(dag.fallback.system.price, { value: 2, denomination: 'gp' });
  const gloves = c.lookups.find((l) => l.name === 'Gloves of the Great Wolf').fallback;
  assert.match(gloves.system.description.value, /^<p>Claws of the pack\./);
  const spell = c.lookups.find((l) => l.kind === 'spell').fallback;
  assert.equal(spell.system.activation.type, 'bonus');
  assert.equal(spell.system.school, 'abj');
  assert.deepEqual(spell.system.properties, ['concentration', 'vocal', 'somatic']);
  assert.match(spell.system.description.value, /shield of force/);
  assert.equal(c.items.find((i) => i.name === 'Manifest Echo').system.description.value.length, 900 + 7);

  // An earlier import left plain loot with only a subtitle: the fix rebuilds it.
  const resolved = c.lookups.map((l) => l.fallback);
  const items = [{ id: 'o', name: 'Gloves of the Great Wolf', type: 'loot', desc: '' }, { id: 'p', name: 'Obsidian Dagger', type: 'loot', desc: 'Weapon' }];
  const f = auditCharacter(ch, resolved, { system: c.actor.system, items }, c).findings;
  assert.equal(f.find((x) => x.name === 'Obsidian Dagger').fix.op, 'replace');
  assert.equal(f.find((x) => x.name === 'Gloves of the Great Wolf' && x.fix).fix.op, 'desc');
  assert.ok(!f.some((x) => x.kind === 'cut'), 'the saved data has the full text');
  assert.ok(f.some((x) => x.kind === 'custom' && x.name === 'Obsidian Dagger'));
});

test('Classic sheet: species and subrace, proficiencies, counters, spell attacks, HP formula', () => {
  const R1 = '-Mabcdefghijklmnopq7';
  const R2 = '-Mabcdefghijklmnopq8';
  const ch = structuredClone(pc);
  ch.attributes = ch.attributes.filter((a) => a.name !== 'race');
  ch.attributes.push(A('race', 'Bree'), A('subrace', 'Bone-Dredger'),
    A(`repeating_proficiencies_${R1}_name`, 'Martial Weapons'), A(`repeating_proficiencies_${R1}_prof_type`, 'WEAPON'),
    A(`repeating_proficiencies_${R2}_name`, 'Old Breenic'),
    A(`repeating_tool_${R1}_toolname`, "Alchemist's supplies"),
    A(`repeating_traits_${R2}_name`, 'Bombs'), A(`repeating_traits_${R2}_description`, 'Throw a bomb.'),
    A('other_resource_name', 'Bombs 30/60'), A('other_resource', '3', '5'),
    A(`repeating_attack_${R1}_atkname`, 'Shield'), A(`repeating_attack_${R1}_dmgbase`, '1d4'));
  const c = cv.convertCharacter(ch);
  assert.equal(c.lookups.find((l) => l.kind === 'race').name, 'Bree');
  assert.ok(c.actor.system.traits.weaponProf.value.includes('mar'));
  assert.match(c.actor.system.traits.languages.custom, /Old Breenic/);
  assert.equal(c.actor.system.tools.alchemist.value, 1);
  const bombs = c.items.filter((i) => /^Bombs/.test(i.name));
  assert.equal(bombs.length, 1, 'the counter joins its feature');
  assert.deepEqual(bombs[0].system.uses, { max: '5', spent: 2 });
  assert.equal(c.items.some((i) => i.name === 'Shield' && i.type === 'feat'), false, 'a spell\'s attack row is not a feature');
  const ogre = structuredClone(npc);
  ogre.attributes = ogre.attributes.filter((a) => a.name !== 'hp');
  assert.equal(cv.convertCharacter(ogre).actor.system.attributes.hp.max, 59, '7d10+21 averages 59');
});

test('species, background and class are linked; a subclass goes to its own class', () => {
  const store = { integrants: { integrants: {
    c1: { _id: 'c1', _enabled: true, type: 'Class', name: 'Smug Bitch', childIDs: '["l1"]' },
    l1: { _id: 'l1', _enabled: true, type: 'Class Level', classID: 'c1', level: 1 },
    c2: { _id: 'c2', _enabled: true, type: 'Class', name: 'Fighter', compendiumPageID: 'F', childIDs: '[]' },
    l2: { _id: 'l2', _enabled: true, type: 'Class Level', classID: 'F', level: 7 },
    h2: { _id: 'h2', _enabled: true, type: 'Hit Dice', classID: 'F', dieSize: 10 },
    s1: { _id: 's1', _enabled: true, type: 'Subclass', name: 'Echo Knight', parentID: 'F' },
    sp: { _id: 'sp', _enabled: true, type: 'Subspecies', name: 'Deepwood Elves' },
  } } };
  const F = (section, source, name) => ({ section, source, name, desc: 'x', timing: '' });
  const snap = { type: 'pc', name: 'Nier', stats: { hp: 84, maxHp: 84, ac: 17, level: 8 },
    features: [F('Class Features', 'Echo Knight', 'Manifest Echo'), F('Species Traits', 'Elves of R’Ley', 'Trance'), F('Other', 'Far Traveler', 'All Eyes on You')] };
  const c = cv.convertCharacter({ id: '-C', name: 'Nier', attributes: [{ name: 'store', current: store }], r20e_snapshot: snap });
  const sub = c.lookups.find((l) => l.kind === 'subclass');
  assert.equal(sub.fallback.system.classIdentifier, 'fighter');
  assert.equal(sub.patch.system.classIdentifier, 'fighter', 'also on a compendium copy');
  assert.equal(c.lookups.find((l) => l.kind === 'class' && l.name === 'Fighter').fallback.system.hd.denomination, 'd10');
  assert.equal(c.lookups.find((l) => l.kind === 'race').fallback.name, 'Elves of R’Ley (Deepwood Elves)');
  const items = [...c.items, ...c.lookups.map((l) => structuredClone(l.fallback))];
  items.forEach((i) => { if (i.type === 'class') delete i._id; });
  const sys = cv.linkDetails(structuredClone(c.actor.system), items);
  assert.equal(sys.details.race, items.find((i) => i.type === 'race')._id);
  assert.equal(sys.details.background, items.find((i) => i.type === 'background')._id);
  assert.equal(sys.details.originalClass, items.find((i) => i.name === 'Fighter')._id, 'the highest-level class, given an id');
});
