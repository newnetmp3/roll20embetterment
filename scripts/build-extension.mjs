// Build Firefox and Chromium extensions from the exact production v3 modules.
// No userscript APIs, dynamic injection, npm dependencies or external scripts.
import {readFileSync,readdirSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const {version}=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const names=readdirSync(join(root,'v3')).filter(s=>/^\d{2}_.*\.js$/.test(s)).sort();
if(names.length!==8)throw Error('Expected all eight v3 modules');
const code='// R20 Embetterment '+version+' page-world runtime\n(()=>{\n'+
  names.map(n=>'// ===== v3/'+n+' =====\n'+readFileSync(join(root,'v3',n),'utf8').trim()).join('\n\n')+'\n})();\n';
const patterns=[
  'https://app.roll20.net/editor*',
  'https://advanced-sheets.production.roll20preflight.net/*dnd2024byroll20/*'
];
const popup=readFileSync(join(root,'extension','popup.html'),'utf8').replaceAll('@@VERSION@@',version);
const base={
  manifest_version:3,name:'Roll20 Embetterment',version,
  description:'Player-focused D&D 5e Roll20 combat HUD and official D&D 2024 sheet integration.',
  action:{default_title:'Roll20 Embetterment',default_popup:'popup.html'},
  content_scripts:[{matches:patterns,js:['content.js'],run_at:'document_start',
    all_frames:true,world:'MAIN'}]
};
function crc32(buf){
  let c=0xffffffff;
  for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
  return (c^0xffffffff)>>>0;
}
// Portable standards-compliant ZIP files, using STORE and a deterministic
// 1980-01-01 timestamp. The manifest lives at the root of each archive.
function zip(files){
  const local=[],central=[];let pos=0;
  for(const [filename,data] of files){
    const name=Buffer.from(filename),crc=crc32(data),h=Buffer.alloc(30),c=Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);
    h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);
    h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);
    h.writeUInt16LE(name.length,26);
    local.push(h,name,data);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
    c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);
    c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);
    c.writeUInt16LE(name.length,28);c.writeUInt32LE(pos,42);
    central.push(c,name);
    pos+=h.length+name.length+data.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0),footer=Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50,0);
  footer.writeUInt16LE(files.length,8);footer.writeUInt16LE(files.length,10);
  footer.writeUInt32LE(centralSize,12);footer.writeUInt32LE(pos,16);
  return Buffer.concat([...local,...central,footer]);
}
const out=join(root,'dist');
mkdirSync(out,{recursive:true});
for(const browser of ['firefox','chrome']){
  const manifest={...base};
  if(browser==='firefox')manifest.browser_specific_settings={
    gecko:{id:'roll20-embetterment@newnetmp3.github.io',
      strict_min_version:'128.0',data_collection_permissions:{required:['none']}}
  };
  else manifest.minimum_chrome_version='120';
  const files=[
    ['manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')],
    ['content.js',Buffer.from(code)],
    ['popup.html',Buffer.from(popup)]
  ];
  const dir=join(out,'extension',browser);
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  for(const [filename,bytes] of files){
    const path=join(dir,filename);
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);
  }
  const file='roll20-embetterment-'+browser+'-'+version+(browser==='firefox'?'-unsigned':'')+'.zip';
  writeFileSync(join(out,file),zip(files));
  console.log('Built '+browser+' extension '+file);
}
