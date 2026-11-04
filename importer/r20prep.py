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


def main():
    ap = argparse.ArgumentParser(description="Prepare a Roll20 export for Foundry VTT.")
    ap.add_argument("zip", help="the export .zip (contains campaign.json)")
    ap.add_argument("--data", default=DEFAULT_DATA, help=f"Foundry Data folder (default {DEFAULT_DATA})")
    ap.add_argument("--user", default=DEFAULT_USER, help=f"user Foundry runs as (default {DEFAULT_USER})")
    ap.add_argument("--name", help="folder name under r20import/ (default: from the campaign)")
    ap.add_argument("--skip-module", action="store_true", help="don't install the Foundry module")
    args = ap.parse_args()

    if not os.path.isdir(args.data):
        sys.exit(f"Foundry Data folder not found: {args.data}")
    try:
        pw = pwd.getpwnam(args.user)
    except KeyError:
        sys.exit(f"No such user: {args.user}")
    if os.geteuid() != 0 and os.geteuid() != pw.pw_uid:
        sys.exit(f"Run with sudo (files must end up owned by {args.user}).")

    zf = zipfile.ZipFile(args.zip)
    names = zf.namelist()
    if "campaign.json" not in names:
        sys.exit("campaign.json is not at the top of this zip: is it an R20Exporter export?")

    print("Reading campaign.json ...")
    campaign = json.loads(zf.read("campaign.json"))
    title = campaign.get("campaign_title") or campaign.get("name") or os.path.splitext(os.path.basename(args.zip))[0]
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

    members = [i for i in zf.infolist() if wanted(i.filename)]
    need = sum(i.file_size for i in members)
    free = shutil.disk_usage(args.data).free
    print(f"Campaign: {title}\nUnpacking {len(members)} files ({human(need)}) to {dest}\nFree space: {human(free)}")
    if need > free - 512 * 1024 * 1024:
        sys.exit("Not enough free disk space (keeping 512 MB spare).")

    if os.path.isdir(dest):
        print("Replacing the earlier unpacked copy ...")
        shutil.rmtree(dest)
    os.makedirs(dest)

    files = {}  # path inside the zip -> path relative to the campaign folder
    for n, info in enumerate(members, 1):
        rel = info.filename
        with zf.open(info) as src:
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
        with zf.open(rel) as f:
            return json.load(f)

    index = {
        "format": "r20prep-1", "title": title, "root": root_rel,
        "characters": {}, "handouts": {}, "pages": {}, "tracks": {}, "files": files,
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
