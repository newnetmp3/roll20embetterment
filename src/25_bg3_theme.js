// A self-contained, original BG3-inspired theme; no external images, fonts or network requests.
const BG3_STYLE = String.raw`
/* Original, asset-free dark-fantasy treatment inspired by tabletop RPG interfaces.
   Scoped exclusively to the BG3-inspired theme inside Embetterment's ShadowRoot. */
:host([data-theme="bg3"]) {
  --bg:#171212; --panel:#27201d; --raised:#392c25; --border:#7b6549;
  --text:#f4ead6; --muted:#c4b59b; --accent:#e5c587; --green:#9ac8a0;
  --red:#d87368; --shadow:0 24px 72px #050303e8,0 0 0 1px #090806;
  --gold-dim:#95744b; --wine:#612f36; --inner:#17110f;
  font-family:"Segoe UI",Arial,sans-serif;
  color-scheme:dark;
}
:host([data-theme="bg3"]) #rbe-panel,
:host([data-theme="bg3"]) #rbe-hud,
:host([data-theme="bg3"]) #rbe-bar,
:host([data-theme="bg3"]) #rbe-fab,
:host([data-theme="bg3"]) #rbe-palette .dialog,
:host([data-theme="bg3"]) #rbe-copy-modal .dialog {
  background:radial-gradient(ellipse at 50% -5%,#49352b 0%,transparent 70%),linear-gradient(155deg,#302722,#1a1515 67%,#100e10);
  border:1px solid #a1865f;
  box-shadow:inset 0 0 0 1px #160f0b,inset 0 0 0 4px #a3834740,0 20px 55px #090406df,0 0 25px #ebbb6333;
  color:var(--text);
}
:host([data-theme="bg3"]) #rbe-panel {
  border-radius:9px;
  min-height:340px;
  max-height:min(83vh,850px);
  isolation:isolate;
}
:host([data-theme="bg3"]) #rbe-panel::before,
:host([data-theme="bg3"]) #rbe-panel::after {
  content:"✦";pointer-events:none;position:absolute;z-index:5;color:#f5d69a;
  text-shadow:0 1px 4px #000,0 0 12px #cf944f;font-size:13px;line-height:1;
}
:host([data-theme="bg3"]) #rbe-panel::before{top:3px;left:5px}
:host([data-theme="bg3"]) #rbe-panel::after{top:3px;right:5px}
:host([data-theme="bg3"]) #rbe-header{
  background:linear-gradient(180deg,#533a30 0%,#302322 60%,#241b1b);
  border-bottom:1px solid #ab8b59;
  padding:14px 19px 13px;
  min-height:74px;
  box-shadow:inset 0 -3px 0 #100d0b,0 3px 14px #09060588;
}
:host([data-theme="bg3"]) .rbe-header-crest{
  width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;
  font-family:Georgia,serif;font-size:26px;color:#f4d79c;
  background:radial-gradient(circle,#6d483b,#291d1b 72%);
  border:2px double #bf945c;border-radius:50%;
  box-shadow:inset 0 0 0 3px #2d1a16,0 2px 8px #0c0909;
}
:host([data-theme="bg3"]) .rbe-header-copy{display:flex;flex:1;flex-direction:column;min-width:0;gap:1px}
:host([data-theme="bg3"]) #rbe-header strong{
  font:small-caps 700 1.37em/1.08 Georgia,"Times New Roman",serif;
  letter-spacing:.045em;color:#ffe5ab;
  text-shadow:0 2px 4px #080505;
}
:host([data-theme="bg3"]) #rbe-header strong em{font-style:normal;color:#f2c77a}
:host([data-theme="bg3"]) .rbe-header-sub{font-size:.67em;letter-spacing:.2em;text-transform:uppercase;color:#c2ad88}
:host([data-theme="bg3"]) #rbe-header button{
  min-width:32px;min-height:31px;
  background:linear-gradient(#4b3a2d,#2b221f);
  border:1px solid #957a51;
}
:host([data-theme="bg3"]) #rbe-tabs{
  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;
  padding:11px 12px 10px;overflow:visible;
  border-bottom:1px solid #886942;
  background:linear-gradient(180deg,#1c1717,#29201d);
  box-shadow:inset 0 -3px 0 #110d0c;
}
:host([data-theme="bg3"]) #rbe-tabs button{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
  min-width:0;min-height:45px;padding:5px 2px;
  border:1px solid #594431;border-bottom:2px solid #4f3c2b;border-radius:3px;
  background:linear-gradient(#342923,#241c19);color:#cbbca3;
  font-family:Georgia,serif;font-size:.81em;letter-spacing:.01em;
  white-space:normal;overflow-wrap:anywhere;line-height:1.1;
}
:host([data-theme="bg3"]) #rbe-tabs .rbe-nav-glyph{
  display:block;font-family:Georgia,serif;font-size:1.4em;
  color:#bca17b;line-height:1.05;
}
:host([data-theme="bg3"]) #rbe-tabs button:is(:hover,:focus-visible),
:host([data-theme="bg3"]) #rbe-tabs button.active{
  color:#ffe9c2;border-color:#ccaa6a;border-bottom-color:#eec583;
  background:radial-gradient(ellipse at top,#6d4835,#34231f 90%);
  box-shadow:inset 0 0 11px #d9a56338,0 0 8px #e9bc6533;
}
:host([data-theme="bg3"]) #rbe-tabs button.active .rbe-nav-glyph{color:#f6d38c}
:host([data-theme="bg3"]) #rbe-body{
  position:relative;flex:1;min-height:155px;
  background:repeating-linear-gradient(112deg,#4b34270a 0,#4b34270a 2px,transparent 2px,transparent 8px),
    radial-gradient(ellipse at 50% 0,#46322755,transparent 65%);
  padding:17px 18px 20px;scrollbar-width:thin;scrollbar-color:#8b704b #211a17;
}
:host([data-theme="bg3"]) #rbe-body::before{
  content:"";position:sticky;display:block;top:-17px;margin:-17px -8px 12px;height:4px;
  background:linear-gradient(90deg,transparent,#b38f5788,transparent);pointer-events:none;
}
:host([data-theme="bg3"]) .rbe-section-heading{
  display:flex;justify-content:space-between;align-items:end;gap:10px;
  border-bottom:1px solid #7a6142;
  padding:4px 0 13px;margin-bottom:14px;position:relative;
}
:host([data-theme="bg3"]) .rbe-section-heading::after{
  content:"✦";position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);
  background:#261d1a;padding:0 7px;color:#e1bb7d;font-size:12px;
}
:host([data-theme="bg3"]) .rbe-section-heading h2{
  color:#f3d49b;font:small-caps 700 1.35em/1.2 Georgia,serif;
  letter-spacing:.085em;margin:0;
}
:host([data-theme="bg3"]) .rbe-section-heading small{
  display:block;margin-top:2px;font-size:.76em;color:#c0af98;letter-spacing:.04em;
}
:host([data-theme="bg3"]) .rbe-section-heading .rbe-section-mark{font:23px/1 Georgia,serif;color:#c8a66d}
:host([data-theme="bg3"]) h2,
:host([data-theme="bg3"]) h3{font-family:Georgia,"Times New Roman",serif;font-variant:small-caps;letter-spacing:.05em}
:host([data-theme="bg3"]) h2{color:#f9dca3;font-size:1.28em}
:host([data-theme="bg3"]) h3{color:#edcb90;font-size:1.05em;margin-bottom:10px}
:host([data-theme="bg3"]) .card{
  position:relative;
  background:linear-gradient(135deg,#392920ad,#281e1cee 48%,#1b1616ec);
  border:1px solid #765b3d;border-radius:5px;padding:15px 14px;
  box-shadow:inset 0 0 0 1px #0c0a09,inset 0 0 18px #2a120622,0 3px 10px #0a07064f;
}
:host([data-theme="bg3"]) .card::before{
  content:"";position:absolute;left:8px;right:8px;top:3px;height:1px;
  background:linear-gradient(90deg,transparent,#d9aa645b,transparent);
  pointer-events:none;
}
:host([data-theme="bg3"]) .stack{gap:11px}
:host([data-theme="bg3"]) .grid{gap:9px}
:host([data-theme="bg3"]) .list-entry{
  padding:10px 9px;border-top:1px solid #69533e;
  background:linear-gradient(90deg,#9d724d0c,transparent);
}
:host([data-theme="bg3"]) .list-entry:first-child{border-top:0}
:host([data-theme="bg3"]) .hint,
:host([data-theme="bg3"]) .muted,
:host([data-theme="bg3"]) label{color:#c5b8a0}
:host([data-theme="bg3"]) .stat,
:host([data-theme="bg3"]) .key{color:#f3cd8c}
:host([data-theme="bg3"]) .pill{
  display:inline-flex;align-items:center;gap:4px;
  border-radius:4px;border:1px solid #967647;background:linear-gradient(#493626,#30241e);
  color:#ead7af;font-size:.78em;padding:3px 8px;letter-spacing:.035em;
}
:host([data-theme="bg3"]) button{
  background:linear-gradient(#534031,#30251f);
  border:1px solid #997d54;border-radius:4px;
  color:#f3e5c9;box-shadow:inset 0 1px #f7d5a21b,0 2px 3px #08070666;
  text-shadow:0 1px #140e0b;
  transition:background-color .16s,border-color .16s,box-shadow .16s,transform .16s;
}
:host([data-theme="bg3"]) button:hover{
  background:linear-gradient(#725139,#42302a);border-color:#edc17d;
  box-shadow:inset 0 1px #ffe3a53d,0 0 8px #d19a4844;filter:none;
}
:host([data-theme="bg3"]) button:active{transform:translateY(1px)}
:host([data-theme="bg3"]) button.primary{
  background:linear-gradient(#efd49a,#b58a4b);
  border-color:#f9e1a7;color:#291a12;text-shadow:none;font-weight:700;
}
:host([data-theme="bg3"]) button.primary:hover{background:linear-gradient(#ffe7b0,#ce9b51)}
:host([data-theme="bg3"]) button.on{
  background:linear-gradient(#305d4c,#243b35);border-color:#87c6a1;
}
:host([data-theme="bg3"]) button.warn{color:#f2aea4}
:host([data-theme="bg3"]) :is(input,textarea,select){
  background:linear-gradient(180deg,#171210,#251b18);border:1px solid #826849;
  color:#fff0d3;border-radius:4px;accent-color:#cda266;
}
:host([data-theme="bg3"]) :is(input,textarea,select)::placeholder{color:#aa997f}
:host([data-theme="bg3"]) :is(input,textarea,select,button):focus-visible{
  outline:2px solid #ffe0a1;outline-offset:2px;
}
:host([data-theme="bg3"]) select option{background:#241c19;color:#f4e8d1}
:host([data-theme="bg3"]) :is(input,textarea)[readonly]{opacity:.9}
:host([data-theme="bg3"]) .table-scroll{border:1px solid #684f35;border-radius:4px}
:host([data-theme="bg3"]) .table-scroll th{
  background:#392a23;color:#f2d09a;font-family:Georgia,serif;font-variant:small-caps;
  letter-spacing:.05em;padding:10px 8px;
}
:host([data-theme="bg3"]) .table-scroll td{
  padding:9px 7px;background:#221a19aa;border-color:#624e3b;
}
:host([data-theme="bg3"]) .table-scroll tbody tr:nth-child(even) td{background:#33251f9a}
:host([data-theme="bg3"]) .note{
  border:1px solid #715538;border-left:3px solid #b68a51;
  background:linear-gradient(90deg,#473122,#231c18);border-radius:3px;
  color:#e6d7bb;
}
:host([data-theme="bg3"]) .rbe-hero{
  display:flex;align-items:center;gap:15px;padding:17px;
  border:1px solid #bd925c;border-radius:6px;
  background:radial-gradient(circle at 15% 50%,#75483b64,transparent 50%),linear-gradient(135deg,#45332b,#1c1717);
  box-shadow:inset 0 0 0 2px #221813,0 3px 15px #070506aa;
}
:host([data-theme="bg3"]) .rbe-hero-seal{
  flex:0 0 62px;width:62px;height:62px;display:grid;place-items:center;
  border:2px solid #caa26c;border-radius:50%;
  background:radial-gradient(#6f4a34,#251a19 75%);
  color:#ffe1a3;font:35px Georgia,serif;
  box-shadow:inset 0 0 0 4px #493120,0 0 12px #9b64394d;
}
:host([data-theme="bg3"]) .rbe-hero-copy{min-width:0;flex:1}
:host([data-theme="bg3"]) .rbe-eyebrow{
  color:#d1ae77;letter-spacing:.23em;text-transform:uppercase;font-size:.72em;font-weight:650;
}
:host([data-theme="bg3"]) .rbe-hero-name{
  color:#ffe1ae;font:small-caps 700 1.58em Georgia,serif;
  letter-spacing:.035em;margin:1px 0 4px;overflow-wrap:anywhere;
}
:host([data-theme="bg3"]) .rbe-hero-meta{font-size:.82em;color:#decaa6;line-height:1.4}
:host([data-theme="bg3"]) .rbe-hero .pill{margin-top:4px}
:host([data-theme="bg3"]) #rbe-hud{
  border-radius:7px;max-width:min(340px,calc(100vw - 24px));min-width:230px;padding:11px 13px;
}
:host([data-theme="bg3"]) #rbe-hud .rbe-hud-name{font:small-caps 700 1.15em Georgia,serif;color:#f9d798}
:host([data-theme="bg3"]) #rbe-hud .hpbar{
  height:11px;background:#170e12;border:1px solid #8b5a49;border-radius:3px;overflow:hidden;
}
:host([data-theme="bg3"]) #rbe-hud .hpbar>span{
  background:linear-gradient(180deg,#ee9788,#aa343e);
  box-shadow:inset 0 2px 2px #ffb5a766,0 0 8px #9d343688;
}
:host([data-theme="bg3"]) #rbe-bar{
  border-radius:8px;align-items:stretch;gap:5px;padding:8px 10px;
  max-width:calc(100vw - 115px);
}
:host([data-theme="bg3"]) #rbe-bar .rbe-hotbar-label{
  width:61px;min-width:61px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font:small-caps 700 .79em Georgia,serif;letter-spacing:.07em;color:#e0bd80;
  border-right:1px solid #9c7950;padding-right:8px;margin-right:3px;
}
:host([data-theme="bg3"]) #rbe-bar .rbe-hotbar-label span{font-size:2em;line-height:1.2}
:host([data-theme="bg3"]) #rbe-bar .barslot{
  min-width:59px;max-width:102px;display:flex;align-items:center;
  flex-direction:column;justify-content:center;gap:2px;
  border:1px solid #bd925e;border-bottom:3px solid #7a5034;border-radius:4px;
  padding:6px 5px 4px;background:radial-gradient(ellipse at top,#534031,#241c1b);
}
:host([data-theme="bg3"]) #rbe-bar .barslot.is-empty{opacity:.62}
:host([data-theme="bg3"]) #rbe-bar .rbe-slot-glyph{font:25px/1 Georgia,serif;color:#efd39e;text-shadow:0 0 7px #e4b77d52}
:host([data-theme="bg3"]) #rbe-bar .rbe-slot-title{font-size:.75em;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
:host([data-theme="bg3"]) #rbe-bar .barslot .index{
  border-radius:3px;background:#190f12;padding:0 4px;font:700 .7em monospace;color:#e8c389;
}
:host([data-theme="bg3"]) #rbe-fab{
  font:small-caps 700 1.07em Georgia,serif;letter-spacing:.04em;border-radius:50%;
  width:58px;height:58px;padding:5px;display:grid;place-items:center;
}
:host([data-theme="bg3"]) #rbe-palette,
:host([data-theme="bg3"]) #rbe-copy-modal{background:#080609c9;backdrop-filter:blur(3px)}
:host([data-theme="bg3"]) :is(#rbe-palette,#rbe-copy-modal) .dialog{
  border-radius:7px;padding:18px 20px;
}
:host([data-theme="bg3"]) #rbe-toast{
  border:1px solid #d6ad77;border-radius:6px;background:#33241f;
  color:#ffe5b8;box-shadow:0 8px 25px #080405;
}
@media(max-width:680px){
  :host([data-theme="bg3"]) #rbe-panel{max-height:79vh;min-height:220px}
  :host([data-theme="bg3"]) #rbe-header{padding:11px 13px;min-height:62px}
  :host([data-theme="bg3"]) #rbe-header strong{font-size:1.05em}
  :host([data-theme="bg3"]) .rbe-header-crest{width:34px;height:34px;flex-basis:34px;font-size:20px}
  :host([data-theme="bg3"]) #rbe-tabs{padding:7px 6px;gap:3px}
  :host([data-theme="bg3"]) #rbe-tabs button{font-size:.71em;min-height:39px;padding:3px 1px}
  :host([data-theme="bg3"]) #rbe-body{padding:12px 10px}
  :host([data-theme="bg3"]) .rbe-hero{gap:9px;padding:11px}
  :host([data-theme="bg3"]) .rbe-hero-seal{width:43px;height:43px;flex-basis:43px;font-size:24px}
  :host([data-theme="bg3"]) .rbe-hero-name{font-size:1.2em}
  :host([data-theme="bg3"]) #rbe-bar{max-width:calc(100vw - 75px)}
  :host([data-theme="bg3"]) #rbe-bar .rbe-hotbar-label{display:none}
  :host([data-theme="bg3"]) #rbe-bar .barslot{min-width:54px}
}
@media(prefers-reduced-motion:reduce){
  :host([data-theme="bg3"]) *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}

/* Distinctive panel treatments keep spellbooks, inventory and journals legible. */
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] #rbe-spell-results .list-entry{
  position:relative;padding:12px 10px 12px 35px;
  border:1px solid #5d4d62;margin:7px 0;border-radius:4px;
  background:linear-gradient(110deg,#352c43aa,#251c25dd);
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] #rbe-spell-results .list-entry::before{
  content:"✧";position:absolute;left:10px;top:12px;color:#b9a7f7;
  font:21px Georgia,serif;text-shadow:0 0 7px #9278f7;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] #rbe-spell-results .pill{
  border-color:#807098;background:#322b46;color:#e5d8fc;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] [data-slot-max],
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] [data-slot-used]{
  background:radial-gradient(#3b2c49,#221b25);border-color:#8d759d;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .table-scroll{
  border:2px ridge #a17f4b;background:#241c16;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .table-scroll tbody tr:hover td{
  background:#50372a;color:#fff1cc;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .table-scroll td:first-child{
  color:#f5d69d;font-family:Georgia,serif;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .card:last-child .field{
  position:relative;padding:4px 6px;border:1px solid #715630;
  background:#30231ac9;border-radius:3px;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Journal"] #rbe-notes{
  color:#30251e;
  background:repeating-linear-gradient(transparent 0,transparent 27px,#806b4933 28px),
    linear-gradient(110deg,#bca98c,#ecdebe 15%,#e2d3ae 96%);
  border:2px solid #b69866;
  line-height:28px;padding:13px 17px;min-height:190px;
  box-shadow:inset 6px 0 8px #94795655,inset 0 0 17px #806f5433;
  font-family:Georgia,"Times New Roman",serif;font-size:1.02em;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Journal"] #rbe-notes::placeholder{
  color:#78664e;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Journal"] .list-entry{
  border-left:2px solid #bb9667;
  padding-left:12px;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] .card:first-of-type{
  border-color:#c09a5f;box-shadow:inset 0 0 0 1px #1a100c,0 0 13px #b58d4d24;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="scanSheets"],
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="syncSheet"]{
  min-height:34px;font-family:Georgia,serif;letter-spacing:.02em;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Rolls"] [data-action="adv"].on{
  background:linear-gradient(#58734b,#2d4735);border-color:#afc38b;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Rolls"] .table-scroll th:first-child,
:host([data-theme="bg3"]) #rbe-body[data-panel="Macros"] #rbe-macro-results strong{
  color:#eed19a;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Chat"] #rbe-chat-message{
  border-left:3px solid #be9a63;min-height:95px;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Settings"] .card label{
  line-height:1.6;
}
:host([data-theme="bg3"]) :is(#rbe-palette,#rbe-copy-modal) .dialog h3,
:host([data-theme="bg3"]) #rbe-palette strong{
  color:#f6d69e;font:small-caps 700 1.25em Georgia,serif;
}
:host([data-theme="bg3"]) #rbe-palette .palette-choice.on{
  border-color:#ead099;background:#534132;
}

/* Screenshot-driven readability adjustment, especially beside a 2024 character sheet. */
:host([data-theme="bg3"]) #rbe-panel{
  font-size:calc(15px * var(--scale,1));line-height:1.5;
}
:host([data-theme="bg3"]) #rbe-body .hint{
  font-size:.94em;line-height:1.53;color:#d0c2aa;
}
:host([data-theme="bg3"]) #rbe-body .card p{line-height:1.56}
:host([data-theme="bg3"]) #rbe-body .card{padding:16px 15px}
:host([data-theme="bg3"]) #rbe-body .card button{white-space:normal}
:host([data-theme="bg3"]) #rbe-body select,
:host([data-theme="bg3"]) #rbe-body input,
:host([data-theme="bg3"]) #rbe-body textarea{font-size:1em}
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="scanSheets"],
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="syncSheet"]{
  min-height:39px;
}
`;
