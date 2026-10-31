import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname);
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const shared=readFileSync(join(root,'src/common.js'),'utf8');
const editor=shared+'\n'+readFileSync(join(root,'src/ui.js'),'utf8')+'\n'+
  readFileSync(join(root,'src/editor.js'),'utf8');
const reader=shared+'\n'+readFileSync(join(root,'src/reader.js'),'utf8');
for(const browser of ['firefox','chrome']){
  const dir=join(root,'dist',browser);
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  const manifest={
    manifest_version:3,
    name:'R20eb Clean Rebuild (Preview)',
    version:'4.0.0.1',version_name:pkg.version,
    description:'D&D 2024 Roll20 native sheet taskbar; verified player actions and read-only DM previews',
    content_scripts:[
      {matches:['https://app.roll20.net/editor*'],
        js:['editor.js'],run_at:'document_start',all_frames:false,world:'MAIN'},
      {matches:['https://advanced-sheets.production.roll20preflight.net/*'],
        js:['reader.js'],run_at:'document_start',all_frames:true,world:'MAIN'}
    ],
    action:{default_title:'R20eb preview'}
  };
  if(browser==='firefox')manifest.browser_specific_settings={
    gecko:{id:'roll20eb-clean-preview@newnetmp3.github.io',strict_min_version:'128.0',
      data_collection_permissions:{required:['none']}}
  };
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(join(dir,'editor.js'),editor+'\n');
  writeFileSync(join(dir,'reader.js'),reader+'\n');
  const archive=join(root,'dist','r20eb-v4-'+browser+'-unsigned.zip');
  execFileSync('zip',['-q','-r',archive,'manifest.json','editor.js','reader.js'],{cwd:dir});
}
console.log('Built independent Firefox/Chrome preview packages in rebuild/dist');
