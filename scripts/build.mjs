import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const sourceFiles = readdirSync(join(root,'src')).filter(n=>/^\d{2}_.*\.js$/.test(n)).sort();
if(sourceFiles.length<4) throw new Error('Missing source modules');
const header = `// ==UserScript==
// @name         roll20 Embetterment
// @namespace    https://github.com/newnetmp3/roll20embetterment
// @version      1.1.0
// @description  Player-first D&D 5E HUD, action bar, macros, spells, quick rolls, inventory, notes, chat filters, and command palette.
// @author       roll20 Embetterment contributors
// @match        https://app.roll20.net/editor/*
// @match        https://app.roll20.net/editor
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// @downloadURL  https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// ==/UserScript==`;
const code=sourceFiles.map(n=>'// ===== '+n+' =====\n'+readFileSync(join(root,'src',n),'utf8').trim()).join('\n\n');
writeFileSync(join(root,'roll20-embetterment.user.js'),header+'\n\n(()=>{\n'+code+'\n})();');
console.log('Built roll20-embetterment.user.js from',sourceFiles.join(', '));