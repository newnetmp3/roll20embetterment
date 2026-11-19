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
  <rect x="6.4" y="9.25" width="0.13" height="2.35" fill="#2c5f99" stroke="#e8f1ff" stroke-width="1" vector-effect="non-scaling-stroke"/>
  <path class="line" d="M0.55 7.2 L0.75 13.0 L0.85 16.9"/>
  <path class="line" d="M0.4 13.6 L1.38 13.6"/>
  <path class="fin" d="M1.08 12.55 L1.98 15.15 L2.12 16.35 L1.0 16.7 Z"/>
  <path class="line" d="M1.55 15.7 L2.06 15.55"/>
  <rect class="fin" x="0.12" y="17.55" width="0.86" height="0.76" rx="0.05"/>
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
        k = "st2" if kind == "atflir" and cls == "st" else cls
        out.append(f'<path class="{k}" transform="translate({x} {y*KY:.3f})" d="{STORES[kind]}"/>')
        if kind == "atflir" and cls == "st":
            out.append(f'<circle cx="{x}" cy="{y*KY+0.17:.3f}" r="0.11" fill="#3a6ea8" stroke="#0f2a49" stroke-width="1" vector-effect="non-scaling-stroke"/>')
    out.append("</g>")
    return "\n".join(out)

def px(x, y):
    return CX + S * x, NY + S * y

def build(loaded, two_seat=True):
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
    p.append(f'<style>{STYLE}</style>')
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
    p.append(f'<g class="layer" data-name="Background"><rect width="{W}" height="{H}" fill="#163a63"/></g>')
    p.append(f'<g class="layer" data-name="Grid (1 m)"><rect width="{W}" height="{H}" fill="url(#grid)"/></g>')

    title = f"BOEING F/A-18{V} SUPER HORNET" + (" — FULL LOADOUT" if loaded else "")
    seats = "Two-seat variant" if two_seat else "Single-seat variant"
    sub = (f"{seats} · plan view (top-down) · 11 stations loaded · stores beneath the airframe shown as hidden lines"
           if loaded else f"{seats} · plan view (top-down) · grid = 1 m")
    p.append('<g class="layer" data-name="Title">')
    p.append(f'<text x="24" y="40" fill="#e8f1ff" font-size="20" font-weight="bold">{title}</text>')
    p.append(f'<text x="24" y="60" class="sm">{sub}</text></g>')

    p.append(f'<g transform="translate({CX} {NY}) scale({S})">')
    if loaded:
        p.append('<g class="layer" data-name="Stores (visible)">' + stores_svg("st") + '</g>')
    p.append(f'<g class="layer" data-name="Airframe"><g transform="scale(1 {KY:.5f})"><use xlink:href="#half"/><use xlink:href="#half" transform="scale(-1 1)"/></g></g>')
    if loaded:
        p.append('<g class="layer" data-name="Stores (hidden lines)">' + stores_svg("hid", clip="airframe") + '</g>')
    p.append('<g class="layer" data-name="Canopy">')
    if two_seat:
        p.append('<path class="glass" d="M0 2.55 C0.3 2.65 0.44 3.1 0.46 3.7 L0.46 5.6 C0.44 6.1 0.3 6.35 0 6.45 '
                 'C-0.3 6.35 -0.44 6.1 -0.46 5.6 L-0.46 3.7 C-0.44 3.1 -0.3 2.65 0 2.55 Z"/>')
        p.append('<path class="line" d="M-0.42 3.2 L0.42 3.2 M-0.46 4.75 L0.46 4.75"/>')
        p.append('<rect x="-0.17" y="3.5" width="0.34" height="0.6" rx="0.08" fill="#163a63" opacity="0.7"/>')
        p.append('<rect x="-0.17" y="5.1" width="0.34" height="0.6" rx="0.08" fill="#163a63" opacity="0.7"/></g>')
    else:
        # single-seat: shorter bubble canopy, dorsal spine continues aft of it
        p.append('<path class="line" d="M-0.3 5.0 C-0.32 6.0 -0.34 6.8 -0.36 7.4 M0.3 5.0 C0.32 6.0 0.34 6.8 0.36 7.4"/>')
        p.append('<path class="glass" d="M0 2.55 C0.3 2.65 0.44 3.1 0.46 3.7 L0.46 4.4 C0.44 4.85 0.3 5.15 0 5.25 '
                 'C-0.3 5.15 -0.44 4.85 -0.46 4.4 L-0.46 3.7 C-0.44 3.1 -0.3 2.65 0 2.55 Z"/>')
        p.append('<path class="line" d="M-0.42 3.2 L0.42 3.2"/>')
        p.append('<rect x="-0.17" y="3.6" width="0.34" height="0.6" rx="0.08" fill="#163a63" opacity="0.7"/></g>')
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
            p.append(f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="9" fill="#e9b44c" stroke="#0f2a49"/>'
                     f'<text x="{tx:.1f}" y="{ty+4:.1f}" text-anchor="middle" font-size="10" '
                     f'font-weight="bold" fill="#0f2a49">{n}</text>')
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
                p.append(f'<circle cx="{cx+9}" cy="{yy-4}" r="8" fill="#e9b44c"/>'
                         f'<text x="{cx+9}" y="{yy}" text-anchor="middle" font-size="10" font-weight="bold" fill="#0f2a49">{n}</text>'
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
    open(os.path.join(OUT, f"fa18{v}_top_view.svg"), "w").write(build(False, two))
    open(os.path.join(OUT, f"fa18{v}_top_view_loaded.svg"), "w").write(build(True, two))
print("ok")
