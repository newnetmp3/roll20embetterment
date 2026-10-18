// Build Firefox and Chromium extensions from the exact production v3 modules.
// No userscript APIs, dynamic injection, npm dependencies or external scripts.
import {readFileSync,readdirSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {deflateSync} from 'node:zlib';

export function buildExtension(browser){
if(!['firefox','chrome'].includes(browser))throw new Error('Specify firefox or chrome explicitly');
const root=resolve(import.meta.dirname,'../..');
const {version}=JSON.parse(readFileSync(join(root,'extension',browser,'package.json'),'utf8'));
const names=readdirSync(join(root,'v3')).filter(s=>/^\d{2}_.*\.js$/.test(s)).sort();
if(names.length!==8)throw Error('Expected all eight v3 modules');
const files=browser==='firefox'?names.flatMap(n=>n==='30_boot.js'?['firefox-turn','firefox-battlefield','firefox-drag',n]:[n]):names;
const code='// R20 Embetterment '+version+' page-world runtime\n(()=>{\n'+
  files.map(n=>n==='firefox-turn'?
    '// ===== extension/firefox/turn-economy.js =====\n'+
    readFileSync(join(root,'extension/firefox/turn-economy.js'),'utf8').trim():
    n==='firefox-battlefield'?
    '// ===== extension/firefox/battlefield-layout.js =====\n'+
    readFileSync(join(root,'extension/firefox/battlefield-layout.js'),'utf8').trim():
    n==='firefox-drag'?
    '// ===== extension/firefox/panel-drag.js =====\n'+
    readFileSync(join(root,'extension/firefox/panel-drag.js'),'utf8').trim():
    '// ===== v3/'+n+' =====\n'+readFileSync(join(root,'v3',n),'utf8').trim()).join('\n\n')+'\n})();\n';
const patterns=[
  'https://app.roll20.net/editor*',
  'https://advanced-sheets.production.roll20preflight.net/*dnd2024byroll20/*'
];
const popup=readFileSync(join(root,'extension',browser,'popup.html'),'utf8').replaceAll('@@VERSION@@',version);
const base={
  manifest_version:3,name:'Roll20 Embetterment',version,
  description:'Player-focused D&D 5e Roll20 combat HUD and official D&D 2024 sheet integration.',
  action:{default_title:'Roll20 Embetterment',default_popup:'popup.html',
    default_icon:{16:'icons/icon-16.png',32:'icons/icon-32.png'}},
  icons:{16:'icons/icon-16.png',32:'icons/icon-32.png',
    48:'icons/icon-48.png',128:'icons/icon-128.png'},
  content_scripts:[{matches:patterns,js:['content.js'],run_at:'document_start',
    all_frames:true,world:'MAIN'}]
};
function crc32(buf){
  let c=0xffffffff;
  for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
  return (c^0xffffffff)>>>0;
}

function chunk(type,bytes){
  const label=Buffer.from(type,'ascii'),size=Buffer.alloc(4),end=Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  end.writeUInt32BE(crc32(Buffer.concat([label,bytes])));
  return Buffer.concat([size,label,bytes,end]);
}
// Simple original dark-blue/gold pixel logo. Pure Node PNG encoder.
function iconPng(size){
  const stride=size*4+1,raster=Buffer.alloc(stride*size);
  const color=(x,y,rgba)=>{
    if(x<0||y<0||x>=size||y>=size)return;
    const i=y*stride+1+x*4;
    for(let j=0;j<4;j++)raster[i+j]=rgba[j];
  };
  const navy=[19,35,57,255],blue=[48,90,132,255],gold=[244,194,83,255];
  const inset=Math.max(1,Math.round(size/12));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)
    color(x,y,x<inset||y<inset||x>=size-inset||y>=size-inset?blue:navy);
  const glyph={
    R:['11110','10001','10001','11110','10100','10010','10001'],
    2:['11111','00001','00001','11111','10000','10000','11111'],
    0:['01110','10001','10011','10101','11001','10001','01110']
  };
  const word=size<24?'R':'R20';
  const units=word.length*5+word.length-1;
  const scale=Math.max(1,Math.floor((size-3)/Math.max(units,7)));
  const startX=Math.floor((size-units*scale)/2),startY=Math.floor((size-7*scale)/2);
  for(let k=0;k<word.length;k++)for(let y=0;y<7;y++)for(let x=0;x<5;x++){
    if(glyph[word[k]][y][x]!=='1')continue;
    for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++)
      color(startX+(k*6+x)*scale+xx,startY+y*scale+yy,gold);
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);
  header[8]=8;header[9]=6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),
    chunk('IDAT',deflateSync(raster)),chunk('IEND',Buffer.alloc(0))
  ]);
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
const out=join(root,'dist',browser);
mkdirSync(out,{recursive:true});
{
  const manifest={...base};
  if(browser==='firefox')manifest.browser_specific_settings={
    gecko:{id:'roll20-embetterment@newnetmp3.github.io',
      strict_min_version:'128.0',
      update_url:'https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/extension/firefox/updates.json',
      data_collection_permissions:{required:['none']}}
  };
  else manifest.minimum_chrome_version='120';
  const files=[
    ['manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')],
    ['content.js',Buffer.from(code)],
    ['popup.html',Buffer.from(popup)],
    ...[16,32,48,128].map(size=>['icons/icon-'+size+'.png',iconPng(size)])
  ];
  const dir=join(out,'extension');
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  for(const [filename,bytes] of files){
    const path=join(dir,filename);
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);
  }
  const file='roll20-embetterment-'+browser+'-'+version+(browser==='firefox'?'-unsigned':'')+'.zip';
  writeFileSync(join(out,file),zip(files));
  console.log('Built '+browser+' extension '+file);
}
}
