// Use only after Mozilla returns a genuinely signed Firefox XPI.
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createFirefoxUpdates,FIREFOX_ADDON_ID} from './lib/firefox-updates.mjs';
const root=resolve(import.meta.dirname,'..'),file=process.argv[2];
if(!file||!/\.xpi$/i.test(file))throw Error('Pass Mozilla-signed XPI path');
const data=readFileSync(file);
if(data.length<1024||data.readUInt32LE(0)!==0x04034b50)
  throw Error('Not a valid signed XPI archive');
const end=data.length-22;
if(data.readUInt32LE(end)!==0x06054b50)throw Error('Invalid XPI ZIP end record');
let index=data.readUInt32LE(end+16);
const count=data.readUInt16LE(end+10),entries=[];
for(let i=0;i<count;i++){
  if(data.readUInt32LE(index)!==0x02014b50)
    throw Error('Invalid XPI central directory');
  const length=data.readUInt16LE(index+28),extra=data.readUInt16LE(index+30),
    comment=data.readUInt16LE(index+32);
  entries.push(data.subarray(index+46,index+46+length).toString());
  index+=46+length+extra+comment;
}
if(!entries.some(x=>/^META-INF\/[^/]+\.rsa$/i.test(x))||
   !entries.some(x=>/^META-INF\/[^/]+\.sf$/i.test(x)))
  throw Error('XPI lacks Mozilla signature; refusing unsigned update');
const version=JSON.parse(readFileSync(join(root,'extension/firefox/package.json'),'utf8')).version;
const manifest=JSON.parse(readFileSync(join(root,'dist/firefox/extension/manifest.json'),'utf8'));
if(manifest.version!==version||manifest.browser_specific_settings?.gecko?.id!==FIREFOX_ADDON_ID)
  throw Error('Release does not match Firefox extension version or ID');
const digest=createHash('sha256').update(data).digest('hex');
writeFileSync(join(root,'extension/firefox/updates.json'),
  JSON.stringify(createFirefoxUpdates({version,sha256:digest}),null,2)+'\n');
console.log('Prepared Firefox signed release update metadata v'+version);
