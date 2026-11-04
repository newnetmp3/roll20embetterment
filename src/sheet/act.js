// Performs an action on the official sheet by pressing the sheet's own
// controls, so Roll20 produces its normal chat card (including the chat
// "Damage" button after an attack). Runs inside the sheet frame.
(function (G) {
  'use strict';
  const C = (G.R20C = G.R20C || {});
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const numOf = (el) => {
    if (!el) return null;
    const raw = el.getAttribute('aria-valuenow') ?? el.value;
    const n = Number(String(raw ?? '').trim());
    return Number.isFinite(n) ? n : null;
  };

  // Ref format: "kind:occurrence:name" (name may itself contain colons).
  function parseRef(ref) {
    const m = /^([a-z]+):(\d+):(.*)$/.exec(String(ref || ''));
    return m ? { kind: m[1], occ: Number(m[2]), name: m[3] } : null;
  }
  function findRow(doc, ref) {
    const r = parseRef(ref);
    const sc = C.scopes(doc);
    if (!r || !sc) return null;
    const match = C.rows(sc, r.kind).filter((x) => x.name === r.name)[r.occ];
    return match ? { ...match, kind: r.kind, sc } : null;
  }
  C.findRow = findRow;

  function press(el) {
    if (!el) return false;
    const target = el.matches && el.matches('button, [role="radio"], [role="switch"]') ? el : el.querySelector('button') || el;
    if (target.disabled) return false;
    target.click();
    return true;
  }

  // Vue tracks input values itself, so set through the native setter and
  // announce it with input/change events.
  function setInput(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
      Object.getOwnPropertyDescriptor(G.HTMLInputElement ? G.HTMLInputElement.prototype : proto, 'value');
    if (desc && desc.set) desc.set.call(el, String(value)); else el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function commitInput(el, value) {
    el.focus && el.focus();
    setInput(el, value);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    el.blur && el.blur();
  }

  const q = (row, sel) => row.querySelector(sel);
  function chatButton(row, kind) {
    const scoped = {
      feature: '.feature-item__title-chat .poly-button--item-row-chat button',
      item: '.item-item__chat--desktop button',
      spell: '.spell-item__chat button',
      npcfeature: '.npc-feature__chat button',
    }[kind];
    return (scoped && q(row, scoped)) || q(row, '.poly-button--item-row-chat button');
  }
  function rollButton(row) {
    return q(row, '.poly-button--healing button, .poly-button--hit-dc button, .poly-button--damage button');
  }

  // Counter attached to a row (see parse.js resources()).
  function resourceAt(row, i) {
    const item = [...row.querySelectorAll('.view-resource .draggable-list__item')]
      .filter((x) => x.querySelector('input.range-counter__input, .poly-incrementer__input'))[i];
    if (!item) return null;
    const range = item.querySelector('input.range-counter__input');
    if (range) return { item, kind: 'range', input: range, max: Number(range.getAttribute('max')) };
    return {
      item, kind: 'count', input: item.querySelector('.poly-incrementer__input'),
      dec: item.querySelector('.view-resource__decrement button'),
      inc: item.querySelector('.view-resource__increment button'),
    };
  }
  async function adjustResource(row, i, delta) {
    const res = resourceAt(row, i);
    if (!res) return { ok: false, msg: 'That counter is no longer on the sheet.' };
    const before = numOf(res.input);
    if (res.kind === 'count') {
      const btn = delta < 0 ? res.dec : res.inc;
      for (let n = 0; n < Math.abs(delta); n++) { press(btn); await wait(120); }
    } else {
      const max = Number.isFinite(res.max) ? res.max : 99;
      const target = Math.max(0, Math.min(max, (before ?? 0) + delta));
      setInput(res.input, target);
      await wait(250);
      if (numOf(res.input) === before && target !== before) {
        // Fall back to the sheet's own checkbox pips.
        const pip = res.item.querySelector('[data-testid="option-' + Math.max(1, delta < 0 ? before : target) + '"]');
        press(pip);
        await wait(250);
      }
    }
    const after = numOf(resourceAt(row, i)?.input);
    return after !== before
      ? { ok: true, msg: 'Now ' + after + (res.max ? '/' + res.max : '') }
      : { ok: false, msg: 'The sheet did not accept the change.' };
  }

  async function adjustQty(row, delta) {
    const input = q(row, '.item-item__quantity-incrementer .poly-incrementer__input');
    const before = numOf(input);
    const btn = q(row, delta < 0 ? '.poly-incrementer__button--decrement' : '.poly-incrementer__button--increment');
    for (let n = 0; n < Math.abs(delta); n++) { press(btn); await wait(120); }
    await wait(150);
    const after = numOf(q(row, '.item-item__quantity-incrementer .poly-incrementer__input'));
    return after !== before ? { ok: true, msg: 'Quantity ' + after } : { ok: false, msg: 'Quantity did not change.' };
  }

  // "Use": roll the feature/action (or post it to chat when it has no roll),
  // then spend one use unless Roll20 already spent it.
  async function use(doc, found, spend) {
    let row = found.el;
    let roller = rollButton(row);
    if (!roller && found.kind === 'feature') {
      // A feature with a roll usually also exists as an action row.
      const twin = C.rows(found.sc, 'action').find((x) => x.name === found.name);
      if (twin) roller = rollButton(twin.el);
    }
    const before = resourceAt(row, 0) ? numOf(resourceAt(row, 0).input) : null;
    if (before === 0) return { ok: false, msg: 'No uses left.' };
    if (!press(roller || chatButton(row, found.kind))) return { ok: false, msg: 'No roll or chat button on this row.' };
    if (!spend || before === null) return { ok: true, msg: roller ? 'Rolled.' : 'Posted to chat.' };
    await wait(700);
    row = findRow(doc, found.ref)?.el || row;
    const now = numOf(resourceAt(row, 0)?.input);
    if (now !== null && now < before) return { ok: true, msg: 'Used. ' + now + ' left.' };
    const r = await adjustResource(row, 0, -1);
    return { ok: r.ok, msg: r.ok ? 'Used. ' + r.msg.replace(/^Now /, '') + ' left.' : (roller ? 'Rolled' : 'Posted to chat') + ', but ' + r.msg.toLowerCase() };
  }

  async function sheetWide(doc, op, arg) {
    const sc = C.scopes(doc);
    if (!sc) return { ok: false, msg: 'Sheet not loaded.' };
    if (op === 'privacy' || op === 'mode') {
      const group = sc.sheet.querySelector(op === 'privacy' ? '.manage__roll-privacy--radio' : '.manage__roll-mode--radio');
      const opt = group && [...group.querySelectorAll('[role="radio"]')].find((r) => r.textContent.trim() === arg);
      return press(opt) ? { ok: true, msg: arg } : { ok: false, msg: 'Option not found.' };
    }
    if (op === 'damage' || op === 'heal') {
      const amount = Math.max(0, Math.floor(Number(arg) || 0));
      if (!amount) return { ok: false, msg: 'Enter an amount.' };
      const root = sc.list[0];
      const input = root.querySelector('input[title="Heal or Damage"]');
      const btn = root.querySelector(op === 'damage' ? '.utility-button--harm' : '.utility-button--heal');
      const hp = root.querySelector('input[title="Current Hitpoints"]');
      if (!input || !btn) return { ok: false, msg: 'This sheet has no heal/damage control.' };
      const cur = () => numOf(root.querySelector('input[title="Current Hitpoints"]')) || 0;
      const temp = () => numOf(root.querySelector('input[title="Temp"]')) || 0;
      // Damage takes temp HP first, so measure current + temp for damage.
      const level = () => (op === 'damage' ? cur() + temp() : cur());
      // The amount box is a locked spinner that starts at 1; a typed value
      // does not always stick. Enter the amount, then press until the full
      // amount has landed (each press is the sheet's own button).
      try { input.click(); } catch { /* ignore */ }
      commitInput(input, amount);
      await wait(150);
      let applied = 0;
      for (let presses = 0; applied < amount && presses < amount; presses++) {
        const step = numOf(input) || 1;
        if (step > amount - applied) { commitInput(input, amount - applied); await wait(120); if ((numOf(input) || 1) > amount - applied) break; }
        const b = level();
        press(btn);
        await wait(presses ? 150 : 350);
        const d = Math.abs(level() - b);
        if (!d) break; // capped (0 HP or full health)
        applied += d;
      }
      const after = cur();
      if (!applied) return { ok: false, msg: 'HP did not change.' };
      return { ok: true, msg: 'HP ' + after + (applied < amount ? ' (' + applied + ' applied)' : '') };
    }
    if (op === 'temp') {
      const input = sc.list[0].querySelector('input[title="Temp"]');
      if (!input) return { ok: false, msg: 'No temp HP field.' };
      commitInput(input, Math.max(0, Math.floor(Number(arg) || 0)));
      return { ok: true, msg: 'Temp HP ' + arg };
    }
    return null;
  }

  C.perform = async function perform(doc, ref, op, arg, opts = {}) {
    // A sheet window that was just (re)opened may still be rendering.
    for (let i = 0; !C.scopes(doc) && i < 40; i++) await wait(200);
    if (!C.scopes(doc)) return { ok: false, gone: true, msg: 'Sheet not loaded.' };
    const wide = await sheetWide(doc, op, arg);
    if (wide) return wide;
    const found = findRow(doc, ref);
    if (!found) return { ok: false, msg: 'Could not find "' + (parseRef(ref)?.name || ref) + '" on the sheet.' };
    const row = found.el;
    const k = found.kind;
    switch (op) {
      case 'hit': return press(q(row, k === 'spell' ? '.spell-item__hit-dc button' : '.poly-button--hit-dc button'))
        ? { ok: true, msg: 'Attack rolled.' } : { ok: false, msg: 'No attack button.' };
      case 'dmg': {
        const list = row.querySelectorAll(k === 'spell' ? '.spell-item__damage button' : (C.DMG_BUTTONS || '.poly-button--damage button'));
        const b = list[Number(arg) || 0];
        const heal = !!(b && b.closest('.poly-button--healing'));
        return press(b) ? { ok: true, msg: heal ? 'Healing rolled.' : 'Damage rolled.' } : { ok: false, msg: 'No damage button.' };
      }
      case 'chat': return press(chatButton(row, k)) ? { ok: true, msg: 'Posted to chat.' } : { ok: false, msg: 'No chat button.' };
      case 'roll': return press(rollButton(row)) ? { ok: true, msg: 'Rolled.' } : { ok: false, msg: 'Nothing to roll.' };
      case 'use': return use(doc, found, opts.spend !== false);
      case 'res': return adjustResource(row, Number(arg?.i) || 0, Number(arg?.delta) || 0);
      case 'qty': return adjustQty(row, Number(arg) || 0);
      case 'equip': return press(q(row, '.item-item__equip-switch [role="switch"]'))
        ? { ok: true, msg: 'Toggled equipped.' } : { ok: false, msg: 'This item has no equip switch.' };
      case 'prepare': return press(q(row, '.utility-switch--prepared [role="switch"]'))
        ? { ok: true, msg: 'Toggled prepared.' } : { ok: false, msg: 'This spell has no prepared switch.' };
      case 'check': return press(k === 'ability' ? q(row, '.poly-button--ability button') : row)
        ? { ok: true, msg: 'Rolled.' } : { ok: false, msg: 'No check button.' };
      case 'save': return press(q(row, '.poly-button--compact-saving-throw button'))
        ? { ok: true, msg: 'Save rolled.' } : { ok: false, msg: 'No save button.' };
      case 'press': return press(row) ? { ok: true, msg: 'Done.' } : { ok: false, msg: 'Button unavailable.' };
      default: return { ok: false, msg: 'Unknown action.' };
    }
  };
})(globalThis);
