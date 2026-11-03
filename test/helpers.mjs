// Loads the extension's content scripts into a simulated page (linkedom),
// the same way Firefox runs them: plain scripts sharing one global.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const root = fileURLToPath(new URL('..', import.meta.url));
export const fixture = (name) => readFileSync(root + 'test/fixtures/' + name, 'utf8');

export function load(html, scripts) {
  const win = parseHTML(html);
  const ctx = vm.createContext({
    window: win, document: win.document, console, setTimeout, clearTimeout,
    Event: win.Event, KeyboardEvent: win.KeyboardEvent || win.Event, HTMLInputElement: win.HTMLInputElement,
  });
  for (const f of scripts) vm.runInContext(readFileSync(root + f, 'utf8'), ctx, { filename: f });
  return { C: ctx.R20C, document: win.document };
}

export const SHEET = ['src/shared/wire.js', 'src/sheet/parse.js', 'src/sheet/act.js'];
export const MODEL = ['src/shared/wire.js', 'src/editor/model.js'];

// Record which sheet controls get pressed.
export function recordPresses(document) {
  const presses = [];
  document.addEventListener('click', (e) => {
    const t = e.target;
    presses.push((t.getAttribute('aria-label') || t.textContent || '').trim() || t.parentNode.getAttribute('class') || t.getAttribute('class') || t.tagName);
  });
  return presses;
}
// Plain copy, so deepStrictEqual works across the vm boundary.
export const plain = (x) => JSON.parse(JSON.stringify(x));
