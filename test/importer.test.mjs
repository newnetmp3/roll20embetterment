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
    type: 'pc', name: 'Nier', stats: { hp: 30, maxHp: 44, ac: 17, speed: 30, level: 5 },
    abilities: [{ name: 'STR', score: 16, mod: '+3', save: '+6' }, { name: 'DEX', score: 14, mod: '+2', save: '+2' }],
    checks: [{ name: 'Stealth', bonus: '+5', prof: 'proficient' }, { name: 'Athletics', bonus: '+9', prof: 'expertise' }],
    attacks: [{ name: 'Dagger', hit: '+5 Attack', dmg: [{ text: '1d4+3', type: 'Piercing' }], range: '20/60' }, { name: 'Longsword', hit: '+6 Attack', dmg: [{ text: '1d8+3', type: 'Slashing' }] }],
    actions: [{ name: 'Second Wind', section: 'Bonus Actions', desc: 'Heal.', res: [{ i: 0, name: 'Second Wind', cur: 1, max: 2 }] }],
    features: [{ name: 'Second Wind', section: 'Class Features', desc: 'dup' }, { name: 'Weapon Mastery', section: 'Class Features', desc: 'Masteries.' }],
    items: [{ name: 'Longsword', qty: 1, equipped: true }],
    spells: [{ name: 'Shield', level: '1ST', tags: [], prepared: true }],
  };
  const c = cv.convertCharacter({ id: '-C', name: 'Nier', attributes: [{ name: 'beacon', current: 1 }], r20e_snapshot: snap });
  assert.equal(c.sheetKind, '2024');
  const sys = c.actor.system;
  assert.deepEqual([sys.abilities.str.value, sys.abilities.str.proficient, sys.abilities.dex.proficient], [16, 1, undefined]);
  assert.deepEqual([sys.skills.ste.value, sys.skills.ath.value], [1, 2]);
  assert.deepEqual([sys.attributes.hp.value, sys.attributes.hp.max, sys.attributes.ac.flat], [30, 44, 17]);
  const names = c.items.map((i) => i.name);
  assert.deepEqual(names, ['Dagger', 'Second Wind', 'Weapon Mastery'], 'Longsword comes from the inventory; Second Wind once');
  assert.deepEqual(c.items[0].system.attack, { bonus: '5', flat: true });
  assert.deepEqual(c.items[0].system.damage.parts, [['1d4+3', 'piercing']]);
  assert.equal(c.items[1].system.activation.type, 'bonus');
  assert.equal(c.items[1].system.uses.spent, 1);
  assert.deepEqual(c.lookups.map((l) => l.kind + ':' + l.name), ['gear:Longsword', 'spell:Shield']);
});

test('r20prep.py: a multi-part Roll20embetterment export (shared assets/)', () => {
  try { execFileSync('python3', ['--version']); } catch { return; }
  const tmp = mkdtempSync(join(tmpdir(), 'r20prep2-'));
  const data = join(tmp, 'Data');
  mkdirSync(join(data, 'modules'), { recursive: true });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
  const camp = { campaign_title: 'Two Parts', pages: [page], characters: [npc], handouts: [], players: [], jukebox: [{ id: '-T1', title: 'x' }], jukeboxfolder: ['-T1'],
    r20e: { format: 1, assets: { 'https://x/max.png': 'assets/00001.png', 'https://x/o.png': 'assets/00002.jpg' }, tracks: { '-T1': 'assets/00003.mp3' } } };
  writeFileSync(join(tmp, 'Two Parts - Foundry export part 1.zip'), zip([['assets/00001.png', jpg], ['assets/00002.jpg', jpg]]));
  writeFileSync(join(tmp, 'Two Parts - Foundry export part 2.zip'), zip([['assets/00003.mp3', Buffer.from('ID3x')], ['campaign.json', Buffer.from(JSON.stringify(camp))]]));
  const out = execFileSync('python3', [join(root, 'importer/r20prep.py'), join(tmp, 'Two Parts - Foundry export part 1.zip'), '--data', data, '--user', process.env.USER || 'root', '--skip-module', '--no-download'], { encoding: 'utf8' });
  assert.match(out, /part 2\.zip/);
  const index = JSON.parse(readFileSync(join(data, 'r20import', 'two-parts', 'index.json'), 'utf8'));
  assert.equal(index.files['assets/00001.png'], 'assets/00001.jpg', 'real file type');
  assert.equal(index.assets['https://x/max.png'], 'assets/00001.png');
  assert.equal(index.tracks['-T1'], 'assets/00003.mp3');
  assert.ok(existsSync(join(data, 'r20import', 'two-parts', 'assets', '00003.mp3')));
});
