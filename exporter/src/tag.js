// Loaded first in every frame: gives this add-on its own message tag, so its
// copy of the sheet reader never talks to Roll20embetterment's action bar.
globalThis.R20C_WIRE_TAG = 'r20-exporter:v1:';
// Keep whole feature and action descriptions (homebrew text) in exports.
globalThis.R20C_DESC_MAX = 20000;
