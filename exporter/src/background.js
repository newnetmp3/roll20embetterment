// Campaign exporter, background side. The toolbar button opens the export
// window in the Roll20 tab; and it downloads one image or audio file at a time
// for the exporter. Extension requests to the hosts in host_permissions aren't
// blocked by cross-site rules, which is what stopped browser-page exporters
// from saving many Roll20 images. Nothing is sent anywhere; the file comes
// straight back to the Roll20 tab that asked.
browser.action.onClicked.addListener(async (tab) => {
  const ok = /^https:\/\/app\.roll20\.net\/editor/.test(tab.url || '')
    && (await browser.tabs.sendMessage(tab.id, { type: 'r20x-open' }).catch(() => false));
  if (!ok) {
    await browser.action.setBadgeText({ tabId: tab.id, text: '!' });
    await browser.action.setTitle({ tabId: tab.id, title: 'Open your Roll20 campaign (the game, not the campaign page), then click again.' });
  }
});

// Save a URL into Downloads/Roll20 export/ and wait until it's done.
async function saveDownload(url, filename) {
  const id = await browser.downloads.download({ url, filename: 'Roll20 export/' + filename, saveAs: false, conflictAction: 'overwrite' });
  await new Promise((resolve) => {
    const finish = () => { browser.downloads.onChanged.removeListener(done); resolve(); };
    const done = (d) => { if (d.id === id && d.state && d.state.current !== 'in_progress') finish(); };
    browser.downloads.onChanged.addListener(done);
    // It may already have finished before the listener was added.
    browser.downloads.search({ id }).then(([it]) => { if (it && it.state !== 'in_progress') finish(); });
  });
  const [item] = await browser.downloads.search({ id });
  return { ok: !!item && item.state === 'complete', path: item && item.filename, finalUrl: item && item.finalUrl, error: item && item.error };
}

// Zip parts go straight into Downloads/Roll20 export/, one after another,
// with no save dialogs.
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'r20x-save' || !(msg.blob instanceof Blob)) return undefined;
  return (async () => {
    const url = URL.createObjectURL(msg.blob);
    try { return await saveDownload(url, msg.name); }
    catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
  })();
});

// Uploaded jukebox audio: Roll20 hands it to a normal browser download (with
// your login) but refuses the add-on's own request. Save it next to the zips.
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'r20x-download' || !/^https:\/\/app\.roll20\.net\//.test(String(msg.url))) return undefined;
  return saveDownload(msg.url, msg.filename).catch((e) => ({ ok: false, error: String((e && e.message) || e) }));
});

browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'r20x-fetch' || typeof msg.url !== 'string') return undefined;
  return (async () => {
    try {
      // Only Roll20 itself needs the login (uploaded audio). Image servers
      // answer anyone, and some refuse requests that carry cookies.
      const own = /^https:\/\/app\.roll20\.net\//.test(msg.url);
      const r = await fetch(msg.url, { credentials: own ? 'include' : 'omit', redirect: 'follow', cache: 'no-store' });
      if (!r.ok) return { ok: false, status: r.status };
      const buf = await r.arrayBuffer();
      return { ok: true, buf, type: r.headers.get('content-type') || '' };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  })();
});
