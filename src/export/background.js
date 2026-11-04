// Campaign exporter, background side: downloads one image or audio file for
// the exporter. Extension requests to the hosts in host_permissions aren't
// blocked by cross-site rules, which is what stopped browser-page exporters
// from saving many Roll20 images. Nothing is sent anywhere; the file comes
// straight back to the Roll20 tab that asked.
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
