// Foundryembetterment: the Roll20embetterment action bar inside Foundry VTT.
// Shares the menu model (model.js) and the bar (ui.js) with the Roll20 add-on;
// adapter.js turns dnd5e actors into menus and runs actions through dnd5e.
(function (G) {
  'use strict';
  const C = G.R20C;
  const MOD = 'foundryembetterment';
  C.TEXT = {
    product: 'Foundryembetterment', anchor: 'scene-controls',
    openHeader: 'On this scene', listHeader: 'Characters',
    emptyPeople: 'No characters you can control yet.',
  };

  Hooks.once('init', () => {
    game.settings.register(MOD, 'prefs', { scope: 'client', config: false, type: Object, default: {} });
    game.settings.register(MOD, 'barPos', { scope: 'client', config: false, type: Object, default: {} });
    game.settings.register(MOD, 'advantage', { scope: 'client', config: false, type: String, default: 'Ask each time' });
    game.settings.register(MOD, 'bigDamage', {
      name: 'Roll Damage button under hits', scope: 'client', config: true, type: Boolean, default: true,
      hint: 'Adds a large Roll Damage button under an attack roll that hit a target (or crit).',
      onChange: () => { try { ui.chat.render(); } catch { /* chat not ready */ } },
    });
    chatCards();
  });

  // ---- chat: a large Roll Damage button under a hit ---------------------------
  // dnd5e 6 shows a card's Damage button as a small icon. Under an attack roll
  // that hit, add our own large button that rolls damage the way the card's
  // button does (ability, ammunition and attack mode from that attack; critical
  // after a crit). The system's own card is left as it is.
  function chatCards() {
    const css = document.createElement('style');
    css.id = 'foundryembetterment-chat';
    css.textContent = `
      .fe-roll-damage { margin: 6px 0 2px; }
      .fe-roll-damage button { width: 100%; min-height: 36px; display: flex; align-items: center; justify-content: center; gap: 8px;
        font-size: 15px; font-weight: 700; letter-spacing: .02em; line-height: 1.2; cursor: pointer; border-radius: 5px;
        background: linear-gradient(180deg, #a3262a, #761b1e); color: #fff; border: 1px solid #e0605f;
        box-shadow: 0 0 0 1px rgba(255,120,110,.35), 0 0 8px rgba(220,60,60,.5); }
      .fe-roll-damage button:hover { filter: brightness(1.12); }
      .fe-roll-damage button.crit { background: linear-gradient(180deg, #c27a12, #8a5208); border-color: #f0b44a; box-shadow: 0 0 0 1px rgba(255,200,110,.4), 0 0 10px rgba(240,170,60,.6); }
      .fe-roll-damage button:disabled { opacity: .6; cursor: default; }`;
    document.head.appendChild(css);

    // Did this attack roll hit? true / false / null (no targets to tell).
    function hitOf(message) {
      const roll = message.rolls && message.rolls[0];
      if (!roll) return null;
      if (roll.isCritical) return true;
      if (roll.isFumble) return false;
      const acs = ((message.system && message.system.targets) || []).map((t) => t && t.ac).filter((ac) => ac !== null && ac !== undefined);
      if (!acs.length) return null;
      return acs.some((ac) => roll.total >= ac);
    }
    const isAttack = (m) => m && (m.type === 'attack' || (m.flags && m.flags.dnd5e && m.flags.dnd5e.roll && m.flags.dnd5e.roll.type === 'attack'));

    Hooks.on('dnd5e.renderChatMessage', (message, html) => {
      try {
        if (!game.settings.get(MOD, 'bigDamage') || !isAttack(message)) return;
        const root = html instanceof HTMLElement ? html : html && html[0];
        if (!root || root.querySelector('.fe-roll-damage')) return;
        if (hitOf(message) !== true) return;
        const activity = message.getAssociatedActivity && message.getAssociatedActivity();
        if (!activity || typeof activity.rollDamage !== 'function') return;
        if (!(game.user.isGM || (activity.actor && activity.actor.isOwner))) return;
        const roll = message.rolls[0];
        const crit = !!roll.isCritical;
        const box = document.createElement('div');
        box.className = 'fe-roll-damage';
        const btn = document.createElement('button');
        btn.type = 'button';
        if (crit) btn.classList.add('crit');
        btn.innerHTML = '<i class="fa-solid fa-burst"></i>';
        btn.append(document.createTextNode(crit ? 'Roll Critical Damage' : 'Roll Damage'));
        btn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          btn.disabled = true;
          try {
            const sys = message.system || {};
            const o = sys.origin;
            const origin = typeof o === 'string' ? o : o && o.id;
            await activity.rollDamage(
              { event, ability: sys.ability, ammunition: sys.ammunitionItem, attackMode: sys.mode, isCritical: crit },
              crit ? { options: { defaultButton: 'critical' } } : {},
              origin ? { data: { system: { origin } } } : {},
            );
          } catch (e) { console.error('[Foundryembetterment] damage roll', e); ui.notifications.warn('Could not roll damage: ' + (e.message || e)); }
          finally { btn.disabled = false; }
        });
        box.appendChild(btn);
        // Directly under the roll's total (the dice row), else at the end of the message.
        const rolls = root.querySelectorAll('.dice-roll');
        // dnd5e 6: <section class="icon-row"><i fa-dice> <button class="dice-roll">…total…</button></section>
        const last = rolls.length ? rolls[rolls.length - 1] : null;
        const anchor = last ? (last.closest('.icon-row') || last) : null;
        if (anchor) anchor.after(box);
        else (root.querySelector('.message-content') || root).appendChild(box);
      } catch (e) { console.warn('[Foundryembetterment] chat card', e); }
    });
  }


  Hooks.once('ready', () => {
    if (game.system.id !== 'dnd5e') { console.warn('[Foundryembetterment] needs the dnd5e system; bar not shown.'); return; }
    try { start(); } catch (e) { console.error('[Foundryembetterment] could not start', e); }
  });

  function start() {
    const errors = [];
    const note = (label, e) => {
      errors.push(label + ': ' + String((e && e.message) || e));
      if (errors.length > 10) errors.shift();
      console.error('[Foundryembetterment]', label, e);
    };
    let prefs = { follow: true, turnCue: true, ...(game.settings.get(MOD, 'prefs') || {}) };
    let active = null; // actor uuid
    let myTurn = false;

    // ---- this turn ------------------------------------------------------------
    // Actions used are kept per "turn key": combat, combatant and how many
    // turns that combatant has started, so they clear when its turn comes up.
    const used = new Map(); // turn key -> { action, bonus, reaction }
    const dashing = new Set();
    const turnsStarted = new Map(); // combatant id -> count
    const ownSeq = new Map(); // actor uuid -> count, outside combat
    const lastDc = new Map(); // actor uuid -> concentration DC after damage
    const ECON_NAMES = { action: 'Action', bonus: 'Bonus action', reaction: 'Reaction' };

    const actorOf = (id) => { try { return id ? fromUuidSync(id) : null; } catch { return null; } };
    const combatantOf = (actor) => {
      const combat = game.combat;
      if (!combat || !actor) return null;
      const tok = actor.token || (actor.getActiveTokens ? actor.getActiveTokens(false, true)[0] : null);
      return combat.combatants.find((c) => (tok && c.tokenId === tok.id) || (!actor.token && c.actorId === actor.id)) || null;
    };
    function turnKey(actor) {
      const c = combatantOf(actor);
      if (c) return game.combat.id + ':' + c.id + ':' + (turnsStarted.get(c.id) || 0);
      return 'own:' + actor.uuid + ':' + (ownSeq.get(actor.uuid) || 0);
    }
    function markUsed(actor, kind, on = true) {
      const k = turnKey(actor);
      used.set(k, { ...(used.get(k) || {}), [kind]: on });
    }
    // The token this bar measures: the controlled one for this actor, else its first on the scene.
    function tokenOf(actor) {
      if (actor.token) return actor.token;
      const controlled = (canvas.tokens && canvas.tokens.controlled || []).find((t) => t.actor === actor);
      if (controlled) return controlled.document;
      const all = actor.getActiveTokens ? actor.getActiveTokens(false, true) : [];
      return all[0] || null;
    }
    function movedSoFar(doc) {
      const history = doc.movementHistory || [];
      if (!history.length) return 0;
      try {
        const m = doc.measureMovementPath(history);
        const v = Number(m && (m.cost ?? m.distance));
        if (Number.isFinite(v)) return Math.round(v * 10) / 10;
      } catch (e) { note('measure', e); }
      return 0;
    }
    function turnFor(actor, snap) {
      const key = turnKey(actor);
      const c = combatantOf(actor);
      const canEnd = !!(c && game.combat && game.combat.started && game.combat.combatant && game.combat.combatant.id === c.id && (c.isOwner || game.user.isGM));
      const out = { used: used.get(key) || {}, inOrder: !!c, canEnd, move: null };
      const doc = tokenOf(actor);
      if (!doc) return out;
      const speeds = (snap.stats && snap.stats.speeds) || {};
      const mode = doc.movementAction && speeds[doc.movementAction] ? doc.movementAction : 'walk';
      out.move = {
        feet: movedSoFar(doc), speed: speeds[mode] || snap.stats.speed || null, speeds, mode,
        units: (canvas.scene && canvas.scene.grid && canvas.scene.grid.units) || snap.stats.units || 'ft',
        dash: dashing.has(key), difficult: null, // Foundry measures terrain itself (scene regions)
      };
      return out;
    }

    // ---- the bar --------------------------------------------------------------
    const ui = C.createUI({
      run: (act) => run(act).catch((e) => { note('action', e); return { ok: false, msg: String(e && e.message || e) }; }),
      select: (id) => select(id),
      pref: (k, v) => { prefs = { ...prefs, [k]: v }; game.settings.set(MOD, 'prefs', prefs); if (k === 'turnCue') myTurn = myTurn && v; refresh(); },
      toggleHidden: () => {},
      // Right-click an entry: pin it to (or unpin it from) Favorites.
      pin: (key) => {
        const actor = actorOf(active);
        if (!actor || !key) return;
        const pins = { ...(prefs.pins || {}) };
        const list = (pins[actor.uuid] || []).slice();
        const i = list.indexOf(key);
        if (i >= 0) list.splice(i, 1); else list.push(key);
        pins[actor.uuid] = list;
        prefs = { ...prefs, pins };
        game.settings.set(MOD, 'prefs', prefs);
        ui.toast(i >= 0 ? 'Removed from Favorites.' : 'Pinned to Favorites.');
        refresh();
      },
      savePos: (pos) => game.settings.set(MOD, 'barPos', pos || {}),
      diag: async () => {
        const actor = actorOf(active);
        const snap = actor ? C.foundrySnap(actor) : null;
        const info = {
          module: game.modules.get(MOD)?.version, foundry: game.version, system: game.system.version,
          gm: game.user.isGM, active, errors, snapErrors: snap && snap.errors,
          counts: snap && Object.fromEntries(['attacks', 'actions', 'features', 'items', 'spells', 'abilities', 'checks', 'hitDice', 'rests'].map((k) => [k, snap[k].length])),
          combat: !!game.combat, window: { w: innerWidth, h: innerHeight },
        };
        try { await navigator.clipboard.writeText(JSON.stringify(info, null, 2)); return true; } catch { return false; }
      },
    });
    // Keys typed into the bar must not reach Foundry's shortcuts (1-0 are hotbar macros).
    const host = document.getElementById('r20-companion');
    if (host) for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, (e) => e.stopPropagation());

    async function run(act) {
      const actor = actorOf(active);
      if (!actor) return { ok: false, msg: 'Choose a character first.' };
      const local = await localAction(actor, act);
      if (local) { refresh(); return local; }
      const res = await C.foundryPerform(actor, act);
      if (res && res.ok) {
        const extra = [];
        if (act.econ) {
          const was = (used.get(turnKey(actor)) || {})[act.econ];
          markUsed(actor, act.econ);
          if (!was) extra.push(ECON_NAMES[act.econ] + ' used.');
        }
        if (act.clearsDc) lastDc.delete(actor.uuid);
        refresh();
        if (extra.length) return { ...res, msg: [res.msg, ...extra].filter(Boolean).join(' ') };
      }
      return res;
    }
    async function localAction(actor, act) {
      const key = turnKey(actor);
      if (act.op === 'econ') {
        const now = !(used.get(key) || {})[act.arg];
        markUsed(actor, act.arg, now);
        return { ok: true, msg: ECON_NAMES[act.arg] + (now ? ' used.' : ' available.') };
      }
      if (act.op === 'move-dash') {
        if (dashing.has(key)) dashing.delete(key); else { dashing.add(key); markUsed(actor, 'action'); }
        return { ok: true, msg: dashing.has(key) ? 'Action used.' : '' };
      }
      if (act.op === 'move-mode') {
        const doc = tokenOf(actor);
        if (!doc) return { ok: false, msg: 'No token for this character on the scene.' };
        await doc.update({ movementAction: act.arg });
        return { ok: true, msg: '' };
      }
      if (act.op === 'end-turn') {
        const combat = game.combat;
        const c = combatantOf(actor);
        if (!combat || !c || !combat.combatant || combat.combatant.id !== c.id) return { ok: false, msg: 'It isn\'t this character\'s turn.' };
        await combat.nextTurn();
        return { ok: true, msg: 'Turn ended.' };
      }
      if (act.op === 'turn-reset') {
        const c = combatantOf(actor);
        if (c) turnsStarted.set(c.id, (turnsStarted.get(c.id) || 0) + 1);
        else ownSeq.set(actor.uuid, (ownSeq.get(actor.uuid) || 0) + 1);
        const doc = tokenOf(actor);
        if (doc && doc.isOwner && doc.clearMovementHistory) await doc.clearMovementHistory();
        return { ok: true, msg: 'Actions and movement cleared.' };
      }
      return null;
    }

    function people() {
      const out = new Map();
      for (const t of (canvas.tokens && canvas.tokens.placeables) || []) {
        const a = t.actor;
        if (!a || !a.isOwner || out.has(a.uuid)) continue;
        out.set(a.uuid, { id: a.uuid, name: t.document.name || a.name, img: a.img, open: true, hidden: false, cached: false });
      }
      for (const a of game.actors) {
        if (!a.isOwner || out.has(a.uuid)) continue;
        if (game.user.isGM && a.type !== 'character') continue; // GMs: NPCs come from the scene
        if (a.type !== 'character' && a.type !== 'npc') continue;
        out.set(a.uuid, { id: a.uuid, name: a.name, img: a.img, open: false, hidden: false, cached: false });
      }
      return [...out.values()].sort((x, y) => x.name.localeCompare(y.name));
    }

    let pending = 0;
    function refresh() {
      if (pending) return;
      pending = setTimeout(() => { pending = 0; render(); }, 30);
    }
    function render() {
      const actor = actorOf(active);
      let cats = [];
      let snap = null;
      if (actor && actor.system) {
        try { snap = C.foundrySnap(actor); } catch (e) { note('read', e); }
        // Favorites: the sheet's own, then anything pinned from the bar.
        if (snap) snap.favorites = [...new Set([...(snap.favorites || []), ...((prefs.pins && prefs.pins[actor.uuid]) || [])])];
      }
      try {
        const conc = actor && actor.system ? C.foundryConcentration(actor, lastDc.get(actor.uuid)) : null;
        cats = C.buildMenus(snap, prefs, { conc, foundry: true });
        if (snap) { const i = cats.findIndex((c) => c.key === 'hp'); cats.splice(i + 1, 0, C.turnMenu(turnFor(actor, snap))); }
      } catch (e) { note('menus', e); }
      ui.update({
        character: actor ? { id: actor.uuid, name: actor.name, img: actor.img, stats: snap && snap.stats } : null,
        live: !!actor, cats, people: people(), myTurn,
      });
    }
    function select(id) {
      active = id;
      refresh();
    }

    // ---- follow Foundry ---------------------------------------------------------
    Hooks.on('controlToken', (token, controlled) => {
      if (!controlled || !prefs.follow || !token.actor || !token.actor.isOwner) return;
      if (token.actor.uuid !== active) select(token.actor.uuid);
    });
    for (const h of ['updateActor', 'createItem', 'updateItem', 'deleteItem', 'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect',
      'updateToken', 'moveToken', 'createToken', 'deleteToken', 'canvasReady', 'createCombatant', 'deleteCombatant', 'deleteCombat']) {
      Hooks.on(h, () => refresh());
    }
    // Anything used through dnd5e (bar, sheet or hotbar) marks its part of the turn.
    Hooks.on('dnd5e.postUseActivity', (activity) => {
      try {
        const type = activity && activity.activation && activity.activation.type;
        const actor = activity && activity.actor;
        if (actor && ECON_NAMES[type]) { markUsed(actor, type); refresh(); }
      } catch (e) { note('use', e); }
    });
    // Damage while concentrating: remember the save DC for the Hit points menu.
    Hooks.on('dnd5e.damageActor', (actor, changes) => {
      try {
        if (!actor.concentration || !actor.concentration.effects.size || !(changes.total < 0)) return;
        lastDc.set(actor.uuid, actor.getConcentrationDC ? actor.getConcentrationDC(-changes.total) : Math.max(10, Math.floor(-changes.total / 2)));
        refresh();
      } catch (e) { note('damage', e); }
    });
    Hooks.on('deleteActiveEffect', (effect) => {
      const actor = effect.parent;
      if (actor && actor.uuid && !(actor.concentration && actor.concentration.effects.size)) lastDc.delete(actor.uuid);
    });

    // A new turn: clear that combatant's turn, glow the bar if it's yours.
    let lastTurn = null;
    function onTurn(combat) {
      const c = combat && combat.started ? combat.combatant : null;
      const key = c ? combat.id + ':' + combat.round + ':' + combat.turn : null;
      if (key === lastTurn) return;
      lastTurn = key;
      if (c) turnsStarted.set(c.id, (turnsStarted.get(c.id) || 0) + 1);
      const actor = c && c.actor;
      const mine = !!actor && (game.user.isGM ? actor.uuid === active : actor.isOwner);
      myTurn = mine && prefs.turnCue !== false;
      if (myTurn) {
        ui.toast('Your turn: ' + (c.name || actor.name) + '.');
        if (!game.user.isGM && prefs.follow && actor.uuid !== active) select(actor.uuid);
      }
      refresh();
    }
    Hooks.on('updateCombat', (combat) => onTurn(combat));
    Hooks.on('combatStart', (combat) => onTurn(combat));
    Hooks.on('deleteCombat', () => { lastTurn = null; myTurn = false; refresh(); });

    // ---- first character ---------------------------------------------------------
    const pos = game.settings.get(MOD, 'barPos');
    ui.update({ pos: pos && Number.isFinite(pos.x) ? pos : null });
    const first = (canvas.tokens && canvas.tokens.controlled || []).find((t) => t.actor && t.actor.isOwner);
    active = first ? first.actor.uuid : game.user.character ? game.user.character.uuid : null;
    if (game.combat) { onTurn(game.combat); myTurn = false; } // don't announce a turn already under way
    render();
    ui.place();
  }
})(globalThis);
