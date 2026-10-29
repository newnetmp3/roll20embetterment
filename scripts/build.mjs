import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(n=>/^\d{2}_.*\.js$/.test(n)).sort();
const required=['00_capture.js','10_reader.js','20_ui.js','21_native.js','22_hud.js','23_token.js','24_dm.js','24_player.js','25_auto.js','26_session.js','30_boot.js'];
if(files.join('|')!==required.sort().join('|'))
  throw new Error('v3 runtime source modules changed; review mode boundaries and update the explicit build list');
const header=[
'// ==UserScript==',
'// @name         roll20 Embetterment',
'// @namespace    https://github.com/newnetmp3/roll20embetterment',
'// @version      3.4.0',
'// @description  Player Character combat HUD and read-only DM sheet companion.',
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
