// Developer tool: run the sheet reader over a saved sheet HTML dump.
// Usage: node scripts/inspect-dump.mjs <file.html> [--json]
// Dumps contain private character data; keep them out of the repository.
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
const file = process.argv[2];
let html = readFileSync(file, 'utf8');
const firstTab = html.split(/<!-- TAB: .*? -->\n/).filter(Boolean)[0];
const { document } = parseHTML('<!doctype html><html>' + firstTab + '</html>');
globalThis.R20C = {};
await import('../src/sheet/parse.js');
const snap = globalThis.R20C.parseSheet(document);
if (process.argv.includes('--json')) { console.log(JSON.stringify(snap, null, 1)); process.exit(0); }
const n = (k) => (snap[k] || []).length;
console.log(snap.type, JSON.stringify(snap.name), JSON.stringify(snap.stats));
console.log('privacy', JSON.stringify(snap.privacy), 'mode', JSON.stringify(snap.mode));
for (const k of ['attacks', 'actions', 'features', 'items', 'spells', 'abilities', 'checks', 'hitDice', 'rests']) console.log(k, n(k));
