import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(n=>/^\d{2}_.*\.js$/.test(n)).sort();
if(files.length!==6)throw new Error('Missing v3 modules (expected capture, reader, UI, HUD, auto and boot)');
const header=[
'// ==UserScript==',
'// @name         roll20 Embetterment',
'// @namespace    https://github.com/newnetmp3/roll20embetterment',
'// @version      3.2.4',
'// @description  Player-first combat HUD backed by authenticated D&D 2024 sheet data.',
'// @author       roll20 Embetterment contributors',
'// @match        https://app.roll20.net/editor/*',
'// @match        https://app.roll20.net/editor',
'// @match        https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/*',
'// @match        https://advanced-sheets.production.roll20preflight.net/*dnd2024byroll20/*',
'// @grant        none',
'// @run-at       document-idle',
'// @updateURL    https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js',
'// @downloadURL  https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js',
'// ==/UserScript=='].join('\n');
const code=files.map(n=>'// ===== v3/'+n+' =====\n'+readFileSync(join(root,'v3',n),'utf8').trim()).join('\n\n');
writeFileSync(join(root,'roll20-embetterment.user.js'),header+'\n\n(()=>{\n'+code+'\n})();');
console.log('Built independent v3 userscript from '+files.join(', '));
