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

browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'r20x-fetch' || typeof msg.url !== 'string') return undefined;
  return (async () => {
    try {
      const r = await fetch(msg.url, { credentials: 'include', redirect: 'follow', cache: 'no-store' });
      if (!r.ok) return { ok: false, status: r.status };
      const buf = await r.arrayBuffer();
      return { ok: true, buf, type: r.headers.get('content-type') || '' };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  })();
});
