import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const {version}=JSON.parse(readFileSync(join(root,'extension','firefox','package.json'),'utf8'));
const modules=readdirSync(join(root,'v3')).filter(s=>/^\d{2}_.*\.js$/.test(s)).sort();
function pack(browser){
  const dir=join(root,'dist',browser,'extension');
  const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  const source=readFileSync(join(dir,'content.js'),'utf8');
  const popup=readFileSync(join(dir,'popup.html'),'utf8');
  const suffix=browser==='firefox'?'-unsigned':'';
  const zip=readFileSync(join(root,'dist',browser,'roll20-embetterment-'+browser+'-'+version+suffix+'.zip'));
  return {manifest,source,popup,zip};
}
test('Firefox MV3 use MAIN world and match only Roll20 editor/official 2024 sheet',()=>{
  const expected=[
    'https://app.roll20.net/editor*',
    'https://advanced-sheets.production.roll20preflight.net/*dnd2024byroll20/*'
  ];
  for(const browser of ['firefox']){
    const {manifest:m,popup}=pack(browser);
    assert.equal(m.manifest_version,3);
    assert.equal(m.version,version);
    assert.equal(m.browser_specific_settings.gecko.update_url,
      'https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/extension/firefox/updates.json');
    assert.equal(m.background,undefined);
    assert.equal(m.permissions,undefined);
    assert.equal(m.host_permissions,undefined);
    assert.equal(m.content_scripts.length,1);
    assert.deepEqual(m.content_scripts[0].matches,expected);
    assert.equal(m.content_scripts[0].world,'MAIN');
    assert.equal(m.content_scripts[0].all_frames,true);
    assert.equal(m.content_scripts[0].run_at,'document_start');
    assert.deepEqual(m.content_scripts[0].js,['content.js']);
    assert.equal(m.action.default_popup,'popup.html');
    assert.equal(m.icons[128],'icons/icon-128.png');
    assert.ok(popup.includes('extension v'+version));
    assert.ok(popup.includes('Disable the original R20eb Tampermonkey userscript'));
  }
  // Chrome is deliberately excluded from Firefox's default test gate.
  const gecko=pack('firefox').manifest.browser_specific_settings.gecko;
  assert.equal(gecko.strict_min_version,'128.0');
  assert.deepEqual(gecko.data_collection_permissions.required,['none']);
});
test('the real v3 source is bundled in order, without legacy or Tampermonkey dependency',()=>{
  const text=modules.map(n=>'// ===== v3/'+n+' =====\n'+
    readFileSync(join(root,'v3',n),'utf8').trim()).join('\n\n');
  for(const browser of ['firefox']){
    const {source}=pack(browser);
    const ordered=modules.map(n=>source.indexOf('// ===== v3/'+n+' ====='));
    assert.ok(ordered.every(x=>x>=0)&&ordered.every((x,i)=>i===0||x>ordered[i-1]));
    for(const n of modules)assert.ok(source.includes(readFileSync(join(root,'v3',n),'utf8').trim()));
    assert.match(source,/extension\/firefox\/turn-economy\.js/);
    assert.match(source,/function r3TurnStart\(/);
    assert.match(source,/extension\/firefox\/battlefield-layout\.js/);
    assert.match(source,/function r3BattlefieldMarkup\(/);
    assert.match(source,/extension\/firefox\/panel-drag\.js/);
    assert.match(source,/function r3BattlefieldEnableDragging\(/);
    assert.ok(source.indexOf('extension/firefox/panel-drag.js')<source.indexOf('// ===== v3/30_boot.js ====='));

    assert.ok(source.indexOf('extension/firefox/battlefield-layout.js')<source.indexOf('// ===== v3/30_boot.js ====='));
    assert.ok(source.indexOf('extension/firefox/turn-economy.js')<source.indexOf('// ===== v3/30_boot.js ====='),
      'Firefox state must initialize before boot on already loaded documents');
    assert.match(source,/function r3Boot\(/);
    assert.match(source,/function r3NativeWaitReader\(/);
    assert.doesNotMatch(source,/\/\/ ==UserScript==/);
    assert.doesNotMatch(source,/function autoRefreshCharacterStats\(/);
  }
});
test('Firefox ZIP are valid root-manifest packages',()=>{
  for(const browser of ['firefox']){
    const {zip}=pack(browser);
    assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
    const count=zip.readUInt16LE(zip.length-14);
    assert.equal(count,7);
    let offset=zip.readUInt32LE(zip.length-6);
    const names=[];
    for(let i=0;i<count;i++){
      assert.equal(zip.readUInt32LE(offset),0x02014b50);
      const n=zip.readUInt16LE(offset+28),extra=zip.readUInt16LE(offset+30),
        comment=zip.readUInt16LE(offset+32);
      names.push(zip.subarray(offset+46,offset+46+n).toString());
      offset+=46+n+extra+comment;
    }
    assert.deepEqual(names,['manifest.json','content.js','popup.html',
      'icons/icon-16.png','icons/icon-32.png','icons/icon-48.png','icons/icon-128.png']);
    for(const size of [16,32,48,128]){
      const png=readFileSync(join(root,'dist',browser,'extension','icons','icon-'+size+'.png'));
      assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16),size);
      assert.equal(png.readUInt32BE(20),size);
    }
  }
});
