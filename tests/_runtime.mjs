// Shared full-runtime loader mirrors the production build's module order.
import {readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const src=join(root,'src');
export function fullRuntimeSource(){
  const files=readdirSync(src).filter(name=>/^\d{2}_.*\.js$/.test(name)).sort();
  if(files.length<4)throw Error('Missing R20eb source modules');
  return files.map(name=>readFileSync(join(src,name),'utf8').trim()).join('\n\n');
}
export function runtimeModuleNames(){
  return readdirSync(src).filter(name=>/^\d{2}_.*\.js$/.test(name)).sort();
}
