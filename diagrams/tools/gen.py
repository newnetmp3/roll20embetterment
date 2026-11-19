#!/usr/bin/env python3
"""Generate F/A-18F top-view SVGs: clean and fully loaded."""
import sys, os

OUT = sys.argv[1]
S = 40          # px per metre
LEN = 60.3 * 0.3048   # 18.38 m, US Navy fact file
HSPAN = 44.9 * 0.3048 / 2  # 6.84 m half-span incl. wingtip AIM-9X
KY = LEN / 18.31  # airframe drawn on an 18.31 m grid -> stretch to official length
CX, NY = 400, 110  # centreline x, nose y

SKIN = ("M0 0 C0.2 0.25 0.38 0.8 0.48 1.4 L0.58 2.4 L0.64 3.1 "
        "C0.85 3.9 1.15 5.0 1.55 6.2 C1.85 7.0 2.1 7.7 2.4 8.3 "
        "L4.3 8.98 L4.32 8.86 L6.4 9.72 L6.4 11.45 L2.05 12.6 "
        "L1.5 13.0 L1.38 14.5 L1.3 16.0 L1.18 17.1 L1.02 17.65")
STAB = "M1.15 15.0 L3.32 16.85 L3.32 17.85 L1.15 17.6"

STYLE = """
.skin{fill:#1d4a7d;stroke:none}
.out{fill:none;stroke:#e8f1ff;stroke-width:1.8;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.line{fill:none;stroke:#cfe0f7;stroke-width:.9;vector-effect:non-scaling-stroke}
.dash{fill:none;stroke:#9fc0e8;stroke-width:.9;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}
.glass{fill:#5f93c9;fill-opacity:.55;stroke:#e8f1ff;stroke-width:1.4;vector-effect:non-scaling-stroke}
.fin{fill:#255790;stroke:#e8f1ff;stroke-width:1.4;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.st{fill:#b9cde4;stroke:#0f2a49;stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.st2{fill:#e9b44c;stroke:#0f2a49;stroke-width:1;vector-effect:non-scaling-stroke}
.hid{fill:none;stroke:#e9b44c;stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.lbl{fill:#e8f1ff;font-size:12px}
.sm{fill:#9fc0e8;font-size:11px}
.ldr{stroke:#e8f1ff;stroke-width:.8;fill:none}
.dim{stroke:#ffd27a;stroke-width:1;fill:none}
.dimt{fill:#ffd27a;font-size:12px}
.hd{fill:#e8f1ff;font-size:12px;font-weight:bold}
.panel,.rivet,.band,.grit,.gonly{display:none}
.tag{fill:#e9b44c;stroke:#0f2a49}.ttag{stroke:none}.tagt{fill:#0f2a49}.ttl{fill:#e8f1ff}
.rail{fill:#2c5f99;stroke:#e8f1ff;stroke-width:1;vector-effect:non-scaling-stroke}
"""

# Weathered-metal look: same geometry, different paint.
STYLE_GRITTY = """
.skin{fill:url(#metal);stroke:none}
.out{fill:none;stroke:#101215;stroke-width:1.6;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.line{fill:none;stroke:#24282d;stroke-width:1.1;opacity:.95;vector-effect:non-scaling-stroke}
.dash{fill:none;stroke:#30353b;stroke-width:.9;stroke-dasharray:5 4;opacity:.8;vector-effect:non-scaling-stroke}
.panel{display:inline;fill:none;stroke:#2c3136;stroke-width:.9;opacity:.9;vector-effect:non-scaling-stroke}
.rivet{display:inline;fill:none;stroke:#2a2e33;stroke-width:.028;stroke-linecap:round;stroke-dasharray:0 .16;opacity:.75}
.glass{fill:url(#glassg);fill-opacity:.96;stroke:#0c0d0f;stroke-width:1.6;vector-effect:non-scaling-stroke}
.fin{fill:url(#metal2);stroke:#101215;stroke-width:1.4;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.noz{fill:url(#nozg)}
.rail{fill:#7d848b;stroke:#101215;stroke-width:1;vector-effect:non-scaling-stroke}
.st{stroke:#121417;stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.st-aim9,.st-aim120{fill:url(#g-white)}.st-jdam{fill:url(#g-olive)}.st-tank{fill:url(#g-tank)}.st-atflir{fill:url(#g-pod)}
.band{display:inline;stroke:none}.b-y{fill:#d9a521}.b-b{fill:#7a4a22}.b-k{fill:url(#g-kit)}
.hid{fill:none;stroke:#ff4b3e;stroke-width:1;stroke-dasharray:4 3;opacity:.85;vector-effect:non-scaling-stroke}
.grit,.gonly{display:inline}
.seat{fill:#3a3530;opacity:.9}
text{font-family:"Inter Display","Inter",sans-serif}
.ttl{fill:#f2f2f2;font-weight:900;letter-spacing:.5px}
.lbl{fill:#e9e9e9;font-size:12px;font-weight:500}
.sm{fill:#b9b9b9;font-size:11px}
.ldr{stroke:#d3212c;stroke-width:1;fill:none}
.dim{stroke:#d3212c;stroke-width:1.2;fill:none}
.dimt{fill:#f0f0f0;font-size:12px;font-weight:600;letter-spacing:.4px}
.hd{fill:#e3242f;font-size:13px;font-weight:800;letter-spacing:.6px}
.tag{fill:#c81e28;stroke:#0d0d0d}.tagt{fill:#fff}
"""

GRITTY_DEFS = """
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#cfd3d7"/><stop offset=".12" stop-color="#b2b8be"/>
  <stop offset=".35" stop-color="#a5abb2"/><stop offset=".7" stop-color="#9aa0a7"/><stop offset="1" stop-color="#868c93"/></linearGradient>
<linearGradient id="metal2" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#8b9198"/><stop offset=".5" stop-color="#b3b9bf"/><stop offset="1" stop-color="#7a8087"/></linearGradient>
<linearGradient id="glassg" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#0d1114"/><stop offset=".3" stop-color="#2a343b"/><stop offset=".42" stop-color="#55646e"/>
  <stop offset=".55" stop-color="#26313a"/><stop offset="1" stop-color="#0b0e11"/></linearGradient>
<linearGradient id="nozg" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#2b2a28"/><stop offset=".45" stop-color="#6c675f"/><stop offset=".6" stop-color="#4a4640"/><stop offset="1" stop-color="#1f1e1c"/></linearGradient>
<linearGradient id="g-white" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#7c7c78"/><stop offset=".35" stop-color="#ecebe6"/><stop offset=".6" stop-color="#d6d5cf"/><stop offset="1" stop-color="#6e6e6a"/></linearGradient>
<linearGradient id="g-olive" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#2f3322"/><stop offset=".38" stop-color="#6a7148"/><stop offset=".62" stop-color="#565c3a"/><stop offset="1" stop-color="#262a1b"/></linearGradient>
<linearGradient id="g-tank" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#6d7379"/><stop offset=".35" stop-color="#c9ced3"/><stop offset=".6" stop-color="#b3b9be"/><stop offset="1" stop-color="#5f656b"/></linearGradient>
<linearGradient id="g-pod" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#4b5056"/><stop offset=".4" stop-color="#9aa0a6"/><stop offset="1" stop-color="#43484d"/></linearGradient>
<linearGradient id="g-kit" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#3f4448"/><stop offset=".4" stop-color="#8e949a"/><stop offset="1" stop-color="#383c40"/></linearGradient>
<radialGradient id="vign" cx=".5" cy=".45" r=".75">
  <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
<filter id="grime" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.7 2.0" numOctaves="4" seed="7" result="big"/>
  <feColorMatrix in="big" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.12  0 0 0 0 0.13  1.5 0 0 0 -0.72" result="stain"/>
  <feTurbulence type="fractalNoise" baseFrequency="30" numOctaves="2" seed="2" result="fine"/>
  <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  0.9 0 0 0 -0.38" result="grain"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.16 3.6" numOctaves="3" seed="11" result="streak"/>
  <feColorMatrix in="streak" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.1 0 0 0 -0.52" result="hi"/>
  <feMerge><feMergeNode in="stain"/><feMergeNode in="grain"/><feMergeNode in="hi"/></feMerge>
</filter>
<filter id="bggrunge" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="5" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0 0 0 -0.38"/>
</filter>
<filter id="brush" x="-10%" y="-60%" width="120%" height="220%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.12" numOctaves="4" seed="9" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="38" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.01 0.5" numOctaves="3" seed="4" result="t2"/>
  <feColorMatrix in="t2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.8 0 0 0 -0.9" result="m"/>
  <feComposite in="d" in2="m" operator="in"/>
</filter>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="0.18" stdDeviation="0.22" flood-color="#000" flood-opacity=".85"/>
</filter>
"""


HALF = f"""
<g id="half">
  <path class="skin" d="{STAB} Z"/><path class="out" d="{STAB}"/>
  <path class="skin" d="{SKIN} L0 17.65 Z"/><path class="out" d="{SKIN}"/>
  <path class="line" d="M0 1.75 Q0.3 1.72 0.52 1.8"/>
  <path class="line" d="M0.64 3.1 C0.7 5 0.85 7 1.15 8.6 L1.5 13.0"/>
  <path class="dash" d="M0.95 5.9 L1.55 6.15 L1.55 7.3 L1.05 7.3"/>
  <path class="line" d="M2.4 8.75 L4.3 9.42 M4.32 9.3 L6.4 10.1"/>
  <path class="line" d="M2.2 11.95 L6.4 10.85"/>
  <path class="line" d="M4.55 11.32 L4.55 11.93"/>
  <path class="dash" d="M4.55 9.05 L4.55 11.32"/>
  <path class="dash" d="M2.7 8.9 L2.7 11.3 M3.8 9.25 L3.8 11.4 M5.1 9.5 L5.1 11.1"/>
  <path class="panel" d="M0 2.5 L0.6 2.5 M0 7.0 L1.75 7.0 M0 9.3 L2.45 9.3 M0 11.0 L2.2 11.0 M0 13.0 L1.5 13.0 M0 14.8 L1.36 14.8 M0 16.3 L1.28 16.3"/>
  <path class="panel" d="M0.3 2.5 L0.3 7.0 M1.05 5.2 L1.2 9.3 M2.0 8.6 L2.0 12.4 M3.0 9.05 L3.0 11.95 M3.55 9.25 L3.55 11.82 M5.2 9.2 L5.2 11.2 M5.8 9.45 L5.8 11.05"/>
  <path class="panel" d="M2.4 9.6 L6.4 10.55 M2.3 10.9 L6.4 10.4 M1.6 14.7 L3.3 17.3 M1.15 16.2 L3.32 17.35"/>
  <path class="rivet" d="M0.04 2.56 L0.56 2.56 M0.04 7.06 L1.7 7.06 M0.04 9.36 L2.4 9.36 M0.04 11.06 L2.15 11.06 M0.04 13.06 L1.45 13.06 M0.04 14.86 L1.33 14.86"/>
  <path class="rivet" d="M2.06 8.7 L2.06 12.3 M3.06 9.1 L3.06 11.9 M5.26 9.3 L5.26 11.15 M2.5 8.42 L4.28 9.06 M4.4 8.98 L6.35 9.78 M2.3 12.52 L6.35 11.38"/>
  <rect class="rail" x="6.4" y="9.25" width="0.13" height="2.35"/>
  <path class="line" d="M0.55 7.2 L0.75 13.0 L0.85 16.9"/>
  <path class="line" d="M0.4 13.6 L1.38 13.6"/>
  <path class="fin" d="M1.08 12.55 L1.98 15.15 L2.12 16.35 L1.0 16.7 Z"/>
  <path class="line" d="M1.55 15.7 L2.06 15.55"/>
  <rect class="fin" x="0.12" y="17.55" width="0.86" height="0.76" rx="0.05"/>
  <rect class="noz gonly" x="0.12" y="17.55" width="0.86" height="0.76" rx="0.05" stroke="#101215" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
  <path class="line" d="M0.33 17.6 V18.28 M0.55 17.6 V18.28 M0.77 17.6 V18.28"/>
</g>"""

# ---- stores, drawn about their own axis: x = lateral, y = 0 at nose -------------
def body(r, L, nose):
    """Symmetric body outline, ogive nose of length `nose`, blunt tail."""
    return (f"M0 0 C{r*.55:.3f} {nose*.15:.3f} {r:.3f} {nose*.55:.3f} {r:.3f} {nose:.3f} "
            f"L{r:.3f} {L-0.02:.3f} L{-r:.3f} {L-0.02:.3f} L{-r:.3f} {nose:.3f} "
            f"C{-r:.3f} {nose*.55:.3f} {-r*.55:.3f} {nose*.15:.3f} 0 0 Z")

def fins(r, y0, y1, span, root):
    """Pair of fins (X-config projected) from body radius r out to `span`."""
    return (f"M{r} {y0} L{span} {y1-root*.25} L{span} {y1} L{r} {y1} Z "
            f"M{-r} {y0} L{-span} {y1-root*.25} L{-span} {y1} L{-r} {y1} Z")

STORES = {
 # 480-gal external fuel tank
 "tank": ("M0 0 C0.223 0.24 0.405 0.88 0.405 1.6 L0.405 4.3 C0.405 4.95 0.2 5.44 0.06 5.46 "
          "L-0.06 5.46 C-0.2 5.44 -0.405 4.95 -0.405 4.3 L-0.405 1.6 C-0.405 0.88 -0.223 0.24 0 0 Z"),
 # GBU-31 JDAM (2,000 lb)
 "jdam": body(0.229, 3.879, 0.7) + fins(0.229, 3.27, 3.86, 0.3175, 0.59)
         + " M0.23 1.2 L0.3 1.25 L0.3 2.3 L0.23 2.35 Z M-0.23 1.2 L-0.3 1.25 L-0.3 2.3 L-0.23 2.35 Z",
 # AIM-120 AMRAAM
 "aim120": body(0.089, 3.655, 0.45) + fins(0.089, 1.45, 1.9, 0.241, 0.45) + fins(0.09, 3.2, 3.64, 0.27, 0.44),
 # AIM-9X Sidewinder
 "aim9": body(0.0635, 3.02, 0.3) + fins(0.0635, 2.72, 3.0, 0.2, 0.28),
 # AN/ASQ-228 ATFLIR targeting pod
 "atflir": body(0.165, 1.829, 0.25),
}

# coloured bands drawn on the bodies (gritty style only): (class, from, to, radius)
BANDS = {
 "aim9":   [("b-y", 0.55, 0.62, 0.0635), ("b-b", 1.25, 1.32, 0.0635)],
 "aim120": [("b-y", 0.7, 0.78, 0.089), ("b-b", 2.0, 2.08, 0.089)],
 "jdam":   [("b-y", 0.45, 0.55, 0.229), ("b-k", 2.9, 3.86, 0.229)],
}

# (store, lateral position m, station of store nose m, station number, label)
LOADOUT = [
 ("aim9",   -6.643, 8.6,  1,  "AIM-9X Sidewinder"),
 ("aim120", -5.10, 8.5,  2,  "AIM-120C AMRAAM"),
 ("jdam",   -3.80, 8.4,  3,  "GBU-31 JDAM (2,000 lb)"),
 ("tank",   -2.70, 6.7,  4,  "480 gal external tank"),
 ("atflir", -1.05, 7.3,  5,  "AN/ASQ-228 ATFLIR pod"),
 ("tank",    0.00, 7.4,  6,  "480 gal external tank"),
 ("aim120",  1.05, 8.2,  7,  "AIM-120C AMRAAM"),
 ("tank",    2.70, 6.7,  8,  "480 gal external tank"),
 ("jdam",    3.80, 8.4,  9,  "GBU-31 JDAM (2,000 lb)"),
 ("aim120",  5.10, 8.5,  10, "AIM-120C AMRAAM"),
 ("aim9",    6.643, 8.6,  11, "AIM-9X Sidewinder"),
]

def stores_svg(cls, clip=None):
    c = f' clip-path="url(#{clip})"' if clip else ""
    out = [f'<g{c}>']
    for kind, x, y, *_ in LOADOUT:
        k = f"st st-{kind}" if cls == "st" else cls
        out.append(f'<path class="{k}" transform="translate({x} {y*KY:.3f})" d="{STORES[kind]}"/>')
        if cls == "st":
            Y = y * KY
            for c, a, b, r in BANDS.get(kind, []):
                out.append(f'<rect class="band {c}" x="{x-r:.3f}" y="{Y+a:.3f}" width="{2*r:.3f}" height="{b-a:.3f}"/>')
        if kind == "atflir" and cls == "st":
            out.append(f'<circle cx="{x}" cy="{y*KY+0.17:.3f}" r="0.11" fill="#3a6ea8" stroke="#0f2a49" stroke-width="1" vector-effect="non-scaling-stroke"/>')
    out.append("</g>")
    return "\n".join(out)

def px(x, y):
    return CX + S * x, NY + S * y

def build(loaded, two_seat=True, gritty=False):
    V = 'F' if two_seat else 'E'
    W = 800
    H = 1200 if loaded else 1020
    p = []
    p.append(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
             f'viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">')
    p.append(f'<title>F/A-18{V} Super Hornet — top view{" with full loadout" if loaded else ""}</title>')
    p.append('<defs>')
    p.append('<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" x="0" y="30">'
             '<path d="M40 0H0V40" fill="none" stroke="#2c5a8f" stroke-width="0.6"/></pattern>')
    p.append(f'<style>{STYLE}{STYLE_GRITTY if gritty else ""}</style>')
    if gritty: p.append(GRITTY_DEFS)
    p.append('<marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" '
             'orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ffd27a"/></marker>')
    p.append(HALF)
    p.append(f'<path id="sil" d="{SKIN} L0 17.65 L0 0 Z"/>')
    # explicit left/right silhouettes (no <use>/mirror transforms, which clip unreliably)
    import re
    def side(d, sx):
        toks = re.findall(r"[A-Za-z]|-?\d*\.?\d+", d + " L0 17.65 L0 0 Z")
        out, i = [], 0
        for t in toks:
            if t.isalpha():
                out.append(t); i = 0
            else:
                v = float(t)
                out.append(f"{v*sx:.4f}" if i % 2 == 0 else f"{v*KY:.4f}"); i += 1
        return " ".join(out)
    p.append(f'<clipPath id="airframe" clipPathUnits="userSpaceOnUse">'
             f'<path d="{side(SKIN, 1)}"/><path d="{side(SKIN, -1)}"/></clipPath>')
    p.append('</defs>')
    if gritty:
        strokes = "".join(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#8e1218" opacity="{o}" filter="url(#brush)"/>'
                          for x0, y0, w, h, o in [(-40, 300, 520, 26, .55), (420, 330, 460, 18, .45), (-30, 760, 380, 22, .5),
                                                  (500, 790, 360, 30, .5), (60, 140, 300, 12, .35), (380, 610, 440, 14, .35)])
        p.append(f'<g class="layer" data-name="Background"><rect width="{W}" height="{H}" fill="#0f0f11"/>{strokes}'
                 f'<rect width="{W}" height="{H}" filter="url(#bggrunge)" opacity=".08"/>'
                 f'<rect width="{W}" height="{H}" fill="url(#vign)"/></g>')
    else:
        p.append(f'<g class="layer" data-name="Background"><rect width="{W}" height="{H}" fill="#163a63"/></g>')
    p.append(f'<g class="layer" data-name="Grid (1 m)"><rect width="{W}" height="{H}" fill="url(#grid)"{' opacity=".12"' if gritty else ''}/></g>')

    title = f"BOEING F/A-18{V} SUPER HORNET" + (" — FULL LOADOUT" if loaded else "")
    seats = "Two-seat variant" if two_seat else "Single-seat variant"
    sub = (f"{seats} · plan view (top-down) · 11 stations loaded · stores beneath the airframe shown as hidden lines"
           if loaded else f"{seats} · plan view (top-down) · grid = 1 m")
    p.append('<g class="layer" data-name="Title">')
    p.append(f'<text class="ttl" x="24" y="40" font-size="{24 if gritty else 20}" font-weight="bold">{title}</text>')
    p.append(f'<text x="24" y="60" class="sm">{sub}</text></g>')

    p.append(f'<g transform="translate({CX} {NY}) scale({S})">')
    if loaded:
        p.append('<g class="layer" data-name="Stores (visible)">' + stores_svg("st") + '</g>')
    p.append(f'<g class="layer" data-name="Airframe"><g transform="scale(1 {KY:.5f})"{' filter="url(#shadow)"' if gritty else ''}><use xlink:href="#half"/><use xlink:href="#half" transform="scale(-1 1)"/></g>'
             + (f'<rect x="-7" y="-0.5" width="14" height="19.5" filter="url(#grime)" clip-path="url(#airframe)" opacity=".75"/>' if gritty else '')
             + '</g>')
    if loaded:
        p.append('<g class="layer" data-name="Stores (hidden lines)">' + stores_svg("hid", clip="airframe") + '</g>')
    p.append('<g class="layer" data-name="Canopy">')
    if two_seat:
        p.append('<path class="glass" d="M0 2.55 C0.3 2.65 0.44 3.1 0.46 3.7 L0.46 5.6 C0.44 6.1 0.3 6.35 0 6.45 '
                 'C-0.3 6.35 -0.44 6.1 -0.46 5.6 L-0.46 3.7 C-0.44 3.1 -0.3 2.65 0 2.55 Z"/>')
        p.append('<path class="line" d="M-0.42 3.2 L0.42 3.2 M-0.46 4.75 L0.46 4.75"/>')
        p.append('<rect x="-0.17" y="3.5" width="0.34" height="0.6" rx="0.08" class="seat" fill="#163a63" opacity="0.7"/>')
        p.append('<rect x="-0.17" y="5.1" width="0.34" height="0.6" rx="0.08" class="seat" fill="#163a63" opacity="0.7"/></g>')
    else:
        # single-seat: shorter bubble canopy, dorsal spine continues aft of it
        p.append('<path class="line" d="M-0.3 5.0 C-0.32 6.0 -0.34 6.8 -0.36 7.4 M0.3 5.0 C0.32 6.0 0.34 6.8 0.36 7.4"/>')
        p.append('<path class="glass" d="M0 2.55 C0.3 2.65 0.44 3.1 0.46 3.7 L0.46 4.4 C0.44 4.85 0.3 5.15 0 5.25 '
                 'C-0.3 5.15 -0.44 4.85 -0.46 4.4 L-0.46 3.7 C-0.44 3.1 -0.3 2.65 0 2.55 Z"/>')
        p.append('<path class="line" d="M-0.42 3.2 L0.42 3.2"/>')
        p.append('<rect x="-0.17" y="3.6" width="0.34" height="0.6" rx="0.08" class="seat" fill="#163a63" opacity="0.7"/></g>')
    p.append('<g class="layer" data-name="Centreline"><path class="dash" d="M0 -0.8 V18.9" opacity="0.6"/></g>')
    p.append('</g>')

    p.append('<g class="layer" data-name="Station numbers">' if loaded else '<g class="layer" data-name="Part labels">')
    if loaded:
        # station number tags just aft of each store
        tails = {"tank": 5.46, "jdam": 3.88, "aim120": 3.66, "aim9": 3.02, "atflir": 1.83}
        for kind, x, y, n, _ in LOADOUT:
            if n == 6:
                tx, ty = px(0, 3.1)            # centreline tank is hidden under the nose area; tag ahead
                ty = NY + S * 6.95
            elif n in (5, 7):
                tx, ty = px(x, y * KY - 0.45)
            else:
                tx, ty = px(x, y * KY + tails[kind] + 0.55)
            p.append(f'<circle class="tag" cx="{tx:.1f}" cy="{ty:.1f}" r="9"/>'
                     f'<text x="{tx:.1f}" y="{ty+4:.1f}" text-anchor="middle" font-size="10" '
                     f'font-weight="bold" class="tagt">{n}</text>')
    else:
        labels = [
            ((405,180),(560,160),"Radome"),
            ((418,270) if two_seat else (418,240),(560,220),"Tandem cockpit (pilot / WSO)" if two_seat else "Single-seat cockpit"),
            ((455,350),(560,280),"Leading-edge extension (LERX)"),
            ((460,372),(560,330),"Intake (under LERX)"),
            ((580,472),(668,440),"Leading-edge flap"),
            ((662,560),(690,575),"Wingtip rail"),
            ((570,515),(690,540),"Aileron"),
            ((582,490),(690,490),"Wing fold"),
            ((520,582),(640,610),"Trailing-edge flap"),
            ((508,500),(560,410),"Pylons (hidden)"),
            ((478,720),(600,690),"Canted vertical tail"),
            ((500,798),(600,760),"All-moving stabilator"),
            ((425,835),(600,820),"F414 engine nozzles (×2)"),
        ]
        for (ax, ay), (bx, by), t in labels:
            p.append(f'<path class="ldr" d="M{ax} {ay} L{bx} {by}"/>'
                     f'<text class="lbl" x="{bx+4}" y="{by+4}">{t}</text>')

    p.append('</g>')
    # dimensions
    p.append('<g class="layer" data-name="Dimensions">')
    tail = NY + S * LEN
    p.append(f'<path class="dim" d="M60 {NY} V{tail:.1f}" marker-start="url(#arr)" marker-end="url(#arr)"/>')
    p.append(f'<path class="dim" d="M52 {NY} H390 M52 {tail:.1f} H380" stroke-dasharray="2 4" opacity="0.6"/>')
    p.append(f'<text class="dimt" transform="translate(52 {(NY+tail)/2:.0f}) rotate(-90)" text-anchor="middle">'
             'Length 60.3 ft (18.38 m)</text>')
    l, r = CX - S * HSPAN, CX + S * HSPAN
    dy = tail + 50
    p.append(f'<path class="dim" d="M{l:.1f} {dy:.0f} H{r:.1f}" marker-start="url(#arr)" marker-end="url(#arr)"/>')
    p.append(f'<path class="dim" d="M{l:.1f} {NY+S*10.5:.0f} V{dy+8:.0f} M{r:.1f} {NY+S*10.5:.0f} V{dy+8:.0f}" '
             'stroke-dasharray="2 4" opacity="0.6"/>')
    p.append(f'<text class="dimt" x="{CX}" y="{dy+20:.0f}" text-anchor="middle">'
             'Span 44.9 ft (13.69 m) incl. wingtip AIM-9X</text>')

    p.append('</g>')
    if loaded:
        p.append('<g class="layer" data-name="Loadout table">')
        ty = dy + 52
        p.append(f'<text class="hd" x="24" y="{ty}">STATION LOADOUT (representative multirole configuration)</text>')
        col = [(24, LOADOUT[:6]), (420, LOADOUT[6:])]
        for cx, rows in col:
            for i, (_, _, _, n, name) in enumerate(rows):
                yy = ty + 24 + i * 20
                where = {1:"L wingtip",2:"L outboard",3:"L midboard",4:"L inboard",5:"L nacelle",6:"Centreline",
                         7:"R nacelle",8:"R inboard",9:"R midboard",10:"R outboard",11:"R wingtip"}[n]
                p.append(f'<circle class="tag ttag" cx="{cx+9}" cy="{yy-4}" r="8"/>'
                         f'<text x="{cx+9}" y="{yy}" text-anchor="middle" font-size="10" font-weight="bold" class="tagt">{n}</text>'
                         f'<text class="sm" x="{cx+24}" y="{yy}">{where}</text>'
                         f'<text class="lbl" x="{cx+110}" y="{yy}">{name}</text>')
        p.append(f'<text class="sm" x="420" y="{ty+24+5*20}">Totals: 2× AIM-9X · 3× AIM-120 · 2× GBU-31 · 3× tanks · ATFLIR</text>')
        p.append('</g>')

    lines = ["Sources: overall length and span from the US Navy F/A-18E/F fact file (60.3 ft, 44.9 ft incl. wingtip missiles).",
             "Stores: USAF fact sheets (AIM-120 143.9 x 7 in; GBU-31 152.7 in, 25 in fin span), Raytheon (AIM-9X 3.02 m x 5 in; ATFLIR 72 x 13 in),",
             "DTIC report via NavWeaps (480 gal tank 215 x 31.9 in). Overall envelope and stores are to these figures; interior planform detail is approximate."]
    p.append('<g class="layer" data-name="Sources">')
    for i, t in enumerate(lines):
        p.append(f'<text class="sm" x="24" y="{H-52+i*14}" font-size="10">{t}</text>')
    p.append('</g>')
    # scale bar
    p.append('<g class="layer" data-name="Scale bar">')
    sy = H - 90
    p.append(f'<g transform="translate({W-184} {sy})">'
             '<rect width="40" height="6" fill="#e8f1ff"/><rect x="40" width="40" height="6" fill="none" stroke="#e8f1ff"/>'
             '<rect x="80" width="40" height="6" fill="#e8f1ff"/><rect x="120" width="40" height="6" fill="none" stroke="#e8f1ff"/>'
             '<text class="sm" y="20">0</text><text class="sm" x="148" y="20">4 m</text></g></g>')
    p.append('</svg>')
    return "\n".join(p)

os.makedirs(OUT, exist_ok=True)
for two, v in ((True, "f"), (False, "e")):
    for g, suf in ((False, ""), (True, "_gritty")):
        open(os.path.join(OUT, f"fa18{v}_top_view{suf}.svg"), "w").write(build(False, two, g))
        open(os.path.join(OUT, f"fa18{v}_top_view_loaded{suf}.svg"), "w").write(build(True, two, g))
print("ok")
