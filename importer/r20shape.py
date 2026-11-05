#!/usr/bin/env python3
"""Shows how a 2024-sheet character's saved data is laid out, without its text.

  python3 r20shape.py <campaign folder or campaign.json> "<character name>" [item name ...]

Prints the structure of the sheet's `store` and `builder` fields (key names,
types, text lengths), then, for each item name given, where it is stored and
the fields next to it (short values shown, long text only as a length).
"""
import json
import os
import sys


def load(path):
    if os.path.isdir(path):
        path = os.path.join(path, "campaign.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def parse(v):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except ValueError:
            return v
    return v


def looks_like_ids(d):
    return len(d) > 6 and all(len(k) >= 12 or k.startswith("-") for k in list(d)[:10])


def merge(a, b):
    if a is None:
        return b
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for k, v in b.items():
            out[k] = merge(out.get(k), v)
        return out
    return a


def shape(v, depth=0):
    if depth > 7:
        return "…"
    if isinstance(v, dict):
        if looks_like_ids(v):
            m = None
            for x in v.values():
                m = merge(m, shape(x, depth + 1))
            return {"<%d entries keyed by id>" % len(v): m}
        return {k: shape(x, depth + 1) for k, x in v.items()}
    if isinstance(v, list):
        m = None
        for x in v[:50]:
            m = merge(m, shape(x, depth + 1))
        return ["<list of %d>" % len(v), m]
    if isinstance(v, str):
        return "text(%d)" % len(v)
    return type(v).__name__


def find(v, name, path=""):
    if isinstance(v, dict):
        for k, x in v.items():
            if isinstance(x, str) and x.strip().lower() == name.lower():
                yield path, v
            yield from find(x, name, path + "/" + str(k))
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield from find(x, name, path + "[%d]" % i)


def brief(v):
    if isinstance(v, str):
        return v if len(v) <= 40 else "text(%d)" % len(v)
    if isinstance(v, (dict, list)):
        return json.dumps(shape(v))[:300]
    return v


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    c = load(sys.argv[1])
    ch = next((x for x in c.get("characters", []) if x.get("name") == sys.argv[2]), None)
    if not ch:
        sys.exit("No character named %r" % sys.argv[2])
    attrs = {a.get("name"): parse(a.get("current")) for a in ch.get("attributes") or ch.get("attribs") or []}
    for field in ("store", "builder"):
        if field in attrs:
            print("==== %s ====" % field)
            print(json.dumps(shape(attrs[field]), indent=1)[:12000])
    for name in sys.argv[3:]:
        print("==== where is %r ====" % name)
        hits = 0
        for field in ("store", "builder"):
            for path, obj in find(attrs.get(field), name):
                hits += 1
                if hits > 4:
                    break
                print("%s%s" % (field, path))
                for k, x in obj.items():
                    print("   %s: %s" % (k, brief(x)))
        if not hits:
            print("   not found")


if __name__ == "__main__":
    main()
