#!/usr/bin/env python3
"""Prepare a Roll20 campaign export (R20Exporter format, as made by
ooshhub/r20Exporter) for import into Foundry VTT.

  sudo python3 r20prep.py "/path/to/Campaign export.zip"

What it does:
  1. Unpacks the zip into <Foundry Data>/r20import/<campaign>/ (skipping the
     duplicate copies of characters under journal/ and the chat archive).
  2. Gives every image its real extension (the exporter names everything .png,
     even JPEGs and WebPs), so Foundry loads them correctly.
  3. Writes index.json: which folder and files belong to each Roll20
     character, handout, page and jukebox track.
  4. Installs the "Roll20 Campaign Import" Foundry module into Data/modules.
  5. Hands everything to the Foundry user (default komovtt).

Then, in Foundry: create a world with the dnd5e system, enable the module,
and use Game Settings -> Configure Settings -> Roll20 Campaign Import.

Standard library only. Safe to run again: it replaces the unpacked copy.
"""
import argparse
import json
import os
import pwd
import re
import shutil
import sys
import zipfile

DEFAULT_DATA = "/home/komovtt/.local/share/FoundryVTT/Data"
DEFAULT_USER = "komovtt"
HERE = os.path.dirname(os.path.abspath(__file__))

MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
]


def sniff(head):
    for sig, ext in MAGIC:
        if head.startswith(sig):
            return ext
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if b"<svg" in head[:256].lower():
        return "svg"
    if head[4:8] == b"ftyp":
        return "mp4"
    if head[:4] == b"\x1aE\xdf\xa3":
        return "webm"
    if head[:3] == b"ID3" or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    if head[:4] == b"OggS":
        return "ogg"
    return None


def slugify(name):
    s = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
    return s or "campaign"


def human(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


def unique_names(entries, label):
    """Mirror R20Exporter's naming: '000 - Name', numbered among siblings."""
    out = []
    for i, e in enumerate(entries):
        out.append((f"{i:03d} - {label(e)}", e))
    return out


SIZES = ["original", "max", "med", "thumb"]


def url_variants(url, big):
    """Roll20 image URLs end in original/max/med/thumb; try the useful sizes."""
    url = re.sub(r"^http:", "https:", url.strip())
    # Roll20's old S3 addresses now answer 403; the same files live on files.d20.io.
    url = re.sub(r"^https://s3\.amazonaws\.com/files\.d20\.io/", "https://files.d20.io/", url)
    m = re.search(r"/(original|max|med|thumb)\.([a-z0-9]+)(\?.*)?$", url, re.I)
    if not m:
        return [url]
    order = SIZES if big else ["max", "original", "med", "thumb"]
    return [url[:m.start(1)] + s + url[m.end(1):] for s in order]


def download(url):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (r20prep)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fetch_missing(campaign, index, files, dest):
    from concurrent.futures import ThreadPoolExecutor
    wanted = []  # (key in files, url, big, label)

    def want(rel, url, big=False, label=""):
        if url and isinstance(url, str) and url.startswith("http") and rel not in files:
            wanted.append((rel, url, big, label))

    for p in campaign.get("pages", []):
        d = index["pages"].get(p.get("id"))
        if not d:
            continue
        for g in p.get("graphics", []):
            want(f"{d}/graphics/{g.get('id')}.png", g.get("imgsrc"), g.get("layer") == "map", p.get("name", ""))
    for c in campaign.get("characters", []):
        d = index["characters"].get(c.get("id"))
        if not d:
            continue
        want(f"{d}/avatar.png", c.get("avatar"))
        tok = c.get("defaulttoken")
        if isinstance(tok, dict):
            want(f"{d}/token.png", tok.get("imgsrc"))
    for h in campaign.get("handouts", []):
        d = index["handouts"].get(h.get("id"))
        if d:
            want(f"{d}/avatar.png", h.get("avatar"), True)
    for t in campaign.get("tables", []) or []:
        for i, it in enumerate(t.get("items", []) or []):
            want(f"tables/{t.get('id')}/{i}.png", it.get("avatar"))
    if not wanted:
        print("All images are in the export.")
        return

    print(f"Downloading {len(wanted)} images the export is missing (Roll20 refused them to the exporter) ...")
    by_url = {}  # first variant URL -> saved relative path
    failed = {}

    def get(item):
        rel, url, big, label = item
        for u in url_variants(url, big):
            try:
                data = download(u)
            except Exception:
                continue
            ext = sniff(data[:64])
            if not ext:
                continue
            return item, data, ext
        return item, None, None

    # One download per distinct image; later copies are hard links.
    unique = {}
    for item in wanted:
        unique.setdefault(item[1], item)
    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for item, data, ext in pool.map(get, unique.values()):
            done += 1
            if data:
                rel = item[0].rsplit(".", 1)[0] + "." + ext
                out = os.path.join(dest, rel)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, "wb") as f:
                    f.write(data)
                by_url[item[1]] = rel
            if done % 100 == 0 or done == len(unique):
                print(f"  {done}/{len(unique)}")
    got = 0
    for rel, url, big, label in wanted:
        src = by_url.get(url)
        if not src:
            failed[label or "characters & handouts"] = failed.get(label or "characters & handouts", 0) + 1
            continue
        target = rel.rsplit(".", 1)[0] + "." + src.rsplit(".", 1)[1]
        if target != src:
            out = os.path.join(dest, target)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            if os.path.exists(out):
                os.remove(out)
            try:
                os.link(os.path.join(dest, src), out)
            except OSError:
                shutil.copyfile(os.path.join(dest, src), out)
        files[rel] = target
        got += 1
    print(f"Downloaded {got} of {len(wanted)} missing images.")
    for label, n in sorted(failed.items()):
        print(f"  still missing on '{label}': {n}")


def find_parts(given):
    """All parts of a multi-part export: "... part 1.zip" finds "... part 2.zip" etc."""
    out = []
    for g in given:
        out.append(os.path.abspath(g))
        m = re.match(r"^(.*part )\d+(\.zip)$", os.path.basename(g), re.I)
        if m:
            d = os.path.dirname(os.path.abspath(g))
            for f in sorted(os.listdir(d)):
                if re.match(re.escape(m.group(1)) + r"\d+" + re.escape(m.group(2)) + "$", f, re.I):
                    out.append(os.path.join(d, f))
    seen = set()
    return [p for p in out if not (p in seen or seen.add(p))]


def asset_urls(c):
    """Every image a Roll20embetterment export refers to (mirrors exporter.js)."""
    want = {}

    def add(u, big=False):
        if isinstance(u, str) and re.match(r"^https?://", u):
            want[u] = want.get(u, False) or big

    def html(s):
        for m in re.finditer(r"""<img[^>]+src\s*=\s*["']([^"']+)["']""", s or "", re.I):
            add(m.group(1).replace("&amp;", "&"), True)

    for p in c.get("pages", []):
        for g in p.get("graphics", []):
            add(g.get("imgsrc"), g.get("layer") == "map")
            for x in g.get("sides") or []:
                add(x)
    for ch in c.get("characters", []):
        add(ch.get("avatar"), True)
        t = ch.get("defaulttoken") if isinstance(ch.get("defaulttoken"), dict) else {}
        add(t.get("imgsrc"))
        html(ch.get("bio")); html(ch.get("gmnotes"))
    for h in c.get("handouts", []):
        add(h.get("avatar"), True); html(h.get("notes")); html(h.get("gmnotes"))
    for t in c.get("tables") or []:
        for it in t.get("items") or []:
            add(it.get("avatar"))
    return want


def fetch_missing_assets(campaign, index, files, dest):
    """Download any image the exporter couldn't save, into assets/dl/."""
    from concurrent.futures import ThreadPoolExecutor
    assets = index["assets"]
    for url, rel in list(assets.items()):  # follow extension fixes
        assets[url] = files.get(rel, rel)
    todo = [(u, big) for u, big in asset_urls(campaign).items() if u not in assets]
    if not todo:
        print("All images are in the export.")
        return
    print(f"Downloading {len(todo)} images the export is missing ...")

    def get(item):
        url, big = item
        for u in url_variants(url, big):
            try:
                data = download(u)
            except Exception:
                continue
            ext = sniff(data[:64])
            if ext:
                return url, data, ext
        return url, None, None

    got = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for n, (url, data, ext) in enumerate(pool.map(get, todo), 1):
            if data:
                rel = f"assets/dl/{n:05d}.{ext}"
                os.makedirs(os.path.join(dest, "assets", "dl"), exist_ok=True)
                with open(os.path.join(dest, rel), "wb") as f:
                    f.write(data)
                assets[url] = rel
                got += 1
            if n % 100 == 0 or n == len(todo):
                print(f"  {n}/{len(todo)}")
    print(f"Downloaded {got} of {len(todo)}; {len(todo) - got} could not be fetched (those show as blank).")


def main():
    ap = argparse.ArgumentParser(description="Prepare a Roll20 export for Foundry VTT.")
    ap.add_argument("zip", nargs="+", help="the export .zip file(s); for a multi-part export, part 1 is enough (the rest are found next to it)")
    ap.add_argument("--data", default=DEFAULT_DATA, help=f"Foundry Data folder (default {DEFAULT_DATA})")
    ap.add_argument("--user", default=DEFAULT_USER, help=f"user Foundry runs as (default {DEFAULT_USER})")
    ap.add_argument("--name", help="folder name under r20import/ (default: from the campaign)")
    ap.add_argument("--skip-module", action="store_true", help="don't install the Foundry module")
    ap.add_argument("--no-download", action="store_true", help="don't download images missing from the export")
    args = ap.parse_args()

    if not os.path.isdir(args.data):
        sys.exit(f"Foundry Data folder not found: {args.data}")
    try:
        pw = pwd.getpwnam(args.user)
    except KeyError:
        sys.exit(f"No such user: {args.user}")
    if os.geteuid() != 0 and os.geteuid() != pw.pw_uid:
        sys.exit(f"Run with sudo (files must end up owned by {args.user}).")

    paths = find_parts(args.zip)
    zips = [zipfile.ZipFile(p) for p in paths]
    owner = {}  # name inside the export -> the zip holding it
    for z in zips:
        for i in z.infolist():
            owner.setdefault(i.filename, (z, i))
    names = list(owner)
    if "campaign.json" not in owner:
        sys.exit("No campaign.json in " + ", ".join(paths) + ": is every part of the export here?")
    if len(paths) > 1:
        print("Export parts:\n  " + "\n  ".join(paths))

    print("Reading campaign.json ...")
    zf = owner["campaign.json"][0]
    campaign = json.loads(zf.read("campaign.json"))
    r20e = campaign.get("r20e") or {}
    title = campaign.get("campaign_title") or campaign.get("name") or os.path.splitext(os.path.basename(paths[0]))[0]
    slug = args.name or slugify(re.sub(r"\s*copy$", "", title, flags=re.I))
    root_rel = f"r20import/{slug}"
    dest = os.path.join(args.data, "r20import", slug)

    # Journal: keep only handout folders (characters are already under characters/).
    handout_dirs = {n.rsplit("/", 1)[0] + "/" for n in names if n.startswith("journal/") and n.endswith("/handout.json")}

    def wanted(n):
        if n.endswith("/") or n == "chat_archive.json":
            return False
        if n.startswith("journal/"):
            return any(n.startswith(d) for d in handout_dirs)
        return True

    members = [owner[n] for n in names if wanted(n)]
    need = sum(i.file_size for _, i in members)
    free = shutil.disk_usage(args.data).free
    print(f"Campaign: {title}\nUnpacking {len(members)} files ({human(need)}) to {dest}\nFree space: {human(free)}")
    if need > free - 512 * 1024 * 1024:
        sys.exit("Not enough free disk space (keeping 512 MB spare).")

    if os.path.isdir(dest):
        print("Replacing the earlier unpacked copy ...")
        shutil.rmtree(dest)
    os.makedirs(dest)

    files = {}  # path inside the zip -> path relative to the campaign folder
    for n, (z, info) in enumerate(members, 1):
        rel = info.filename
        with z.open(info) as src:
            head = src.read(64)
            ext = sniff(head)
            out_rel = rel
            base, cur = os.path.splitext(rel)
            if ext and cur.lower().lstrip(".") != ext and cur.lower() in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp3", ".ogg", ""):
                out_rel = base + "." + ext
            out = os.path.join(dest, out_rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "wb") as f:
                f.write(head)
                shutil.copyfileobj(src, f, 1024 * 1024)
        files[rel] = out_rel
        if n % 500 == 0 or n == len(members):
            print(f"  {n}/{len(members)}")

    # ---- index: Roll20 id -> folder ----------------------------------------
    def load(rel):
        with owner[rel][0].open(rel) as f:
            return json.load(f)

    index = {
        "format": "r20prep-1", "title": title, "root": root_rel,
        "characters": {}, "handouts": {}, "pages": {}, "tracks": {}, "files": files,
        # Roll20embetterment exports: one copy of each image, by its Roll20 URL.
        "assets": dict(r20e.get("assets") or {}),
        "players": [{"id": p.get("id"), "name": p.get("displayname") or p.get("d20userid") or p.get("id")} for p in campaign.get("players", [])],
        "counts": {k: len(campaign.get(k) or []) for k in ("characters", "handouts", "pages", "tables", "macros", "jukebox", "players")},
    }
    for n in names:
        try:
            if n.startswith("characters/") and n.endswith("/character.json"):
                index["characters"][load(n)["id"]] = n.rsplit("/", 1)[0]
            elif n.startswith("journal/") and n.endswith("/handout.json"):
                index["handouts"][load(n)["id"]] = n.rsplit("/", 1)[0]
            elif n.startswith("pages/") and n.endswith("/page.json"):
                index["pages"][load(n)["id"]] = n.rsplit("/", 1)[0]
        except Exception as e:  # one odd entry should not stop the import
            print(f"  skipped {n}: {e}")

    # Jukebox: rebuild the exporter's folder names to find each track's file.
    tracks = {t.get("id"): t for t in campaign.get("jukebox", [])}

    def walk(entries, prefix):
        # The exporter skips (and doesn't number) ids it can't find.
        entries = [e for e in entries if not isinstance(e, str) or e in tracks]
        for name, e in unique_names(entries, lambda e: (tracks.get(e, {}).get("title", "") if isinstance(e, str) else e.get("n", ""))):
            if isinstance(e, str):
                fn = name if name.endswith(".mp3") else name + ".mp3"
                rel = f"{prefix}/{fn}"
                if rel in files:
                    index["tracks"][e] = rel
            else:
                walk(e.get("i", []), f"{prefix}/{name}")

    walk(campaign.get("jukeboxfolder") or [], "jukebox")
    index["tracks"].update(r20e.get("tracks") or {})

    # ---- images the exporter couldn't download ------------------------------------
    # Roll20 often refused the exporter's browser downloads, so those images are
    # missing from the zip. The browser can't fetch them later either, but the
    # server can: download them here, straight into the campaign folder.
    if not args.no_download:
        if r20e:
            fetch_missing_assets(campaign, index, files, dest)
        else:
            fetch_missing(campaign, index, files, dest)

    with open(os.path.join(dest, "index.json"), "w") as f:
        json.dump(index, f)
    print(f"Indexed {len(index['characters'])} characters, {len(index['handouts'])} handouts, "
          f"{len(index['pages'])} pages, {len(index['tracks'])} audio tracks.")

    # ---- the Foundry module ----------------------------------------------------
    if not args.skip_module:
        src = os.path.join(HERE, "module")
        mod = os.path.join(args.data, "modules", "r20import")
        if os.path.isdir(mod):
            shutil.rmtree(mod)
        shutil.copytree(src, mod)
        print(f"Installed the Foundry module to {mod}")

    # ---- ownership -----------------------------------------------------------------
    targets = [os.path.join(args.data, "r20import")] + ([] if args.skip_module else [os.path.join(args.data, "modules", "r20import")])
    for t in targets:
        for d, dirs, fs in os.walk(t):
            os.chown(d, pw.pw_uid, pw.pw_gid)
            for x in fs:
                os.chown(os.path.join(d, x), pw.pw_uid, pw.pw_gid)
    print(f"Owner set to {args.user}.")
    print("\nNext, in Foundry:\n"
          "  1. Return to Setup (or restart Foundry) so it sees the new module.\n"
          "  2. Create a world with the D&D Fifth Edition system and open it.\n"
          "  3. Game Settings > Manage Modules: enable 'Roll20 Campaign Import'.\n"
          "  4. Game Settings > Configure Settings > Roll20 Campaign Import > Open importer.\n"
          f"     Choose '{slug}' and press Import.")


if __name__ == "__main__":
    main()
