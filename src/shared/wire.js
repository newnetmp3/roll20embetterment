// Messages between the editor page and sheet frames travel as tagged JSON
// strings. Strings cross Firefox's content-script boundary cleanly, and the
// tag keeps them apart from Roll20's own postMessage traffic.
(function (G) {
  'use strict';
  const C = (G.R20C = G.R20C || {});
  const TAG = 'r20-companion:v5:';
  C.wire = {
    encode: (msg) => TAG + JSON.stringify(msg),
    decode: (data) => {
      if (typeof data !== 'string' || !data.startsWith(TAG)) return null;
      try { const v = JSON.parse(data.slice(TAG.length)); return v && typeof v === 'object' ? v : null; }
      catch { return null; }
    },
  };
})(globalThis);
