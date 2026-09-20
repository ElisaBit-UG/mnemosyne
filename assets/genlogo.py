#!/usr/bin/env python3
"""Erzeugt assets/logo.svg fuer MNEMOSYNE: neuronales Netz, Giftgruen-Neon. Deterministisch (fester Seed)."""
import math, random, sys

W, H = 1200, 420
rnd = random.Random(7)
ACID, LIME, CYAN, MAG = "#39FF14", "#B6FF00", "#00F0FF", "#FF2BD6"

# --- Neuronen: dichte Cluster links/rechts, duenn in der Mitte (Platz fuer die Wortmarke) ---
def density(x, y):
    dx = (x - 600) / 430.0; dy = (y - 222) / 120.0
    return min(1.0, dx * dx + dy * dy)          # 0 im Textfeld, 1 aussen

nodes = []
tries = 0
while len(nodes) < 74 and tries < 20000:
    tries += 1
    x = rnd.uniform(-20, W + 20); y = rnd.uniform(-10, H + 10)
    if rnd.random() > density(x, y) ** 1.6: continue
    if any((x - a) ** 2 + (y - b) ** 2 < 46 ** 2 for a, b, *_ in nodes): continue
    r = rnd.choice([2.2, 2.6, 3.0, 3.4, 4.2, 5.2])
    col = rnd.choices([ACID, LIME, CYAN, MAG], weights=[52, 20, 16, 12])[0]
    nodes.append((x, y, r, col))

# --- Axone/Dendriten: jedes Neuron zu seinen 2-3 naechsten Nachbarn, organisch gebogen ---
edges = set()
for i, (x, y, *_ ) in enumerate(nodes):
    near = sorted(range(len(nodes)), key=lambda j: (nodes[j][0] - x) ** 2 + (nodes[j][1] - y) ** 2)[1:4]
    for j in near[: rnd.choice([2, 2, 3])]:
        d = math.hypot(nodes[j][0] - x, nodes[j][1] - y)
        if d < 190: edges.add((min(i, j), max(i, j)))

def curve(i, j):
    x1, y1 = nodes[i][:2]; x2, y2 = nodes[j][:2]
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    nx, ny = -(y2 - y1), (x2 - x1)
    k = rnd.uniform(-0.28, 0.28)
    return f"M{x1:.1f} {y1:.1f} Q{mx + nx * k:.1f} {my + ny * k:.1f} {x2:.1f} {y2:.1f}"

paths = {e: curve(*e) for e in sorted(edges)}

out = []
A = out.append
A(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="MNEMOSYNE — memory for Claude Code">')
A('''  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#020806"/><stop offset="0.55" stop-color="#04140E"/><stop offset="1" stop-color="#020A09"/>
    </linearGradient>
    <radialGradient id="nebAcid" cx="0.16" cy="0.42" r="0.55"><stop offset="0" stop-color="#39FF14" stop-opacity="0.34"/><stop offset="1" stop-color="#39FF14" stop-opacity="0"/></radialGradient>
    <radialGradient id="nebCyan" cx="0.86" cy="0.62" r="0.5"><stop offset="0" stop-color="#00F0FF" stop-opacity="0.26"/><stop offset="1" stop-color="#00F0FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="nebMag" cx="0.74" cy="0.1" r="0.42"><stop offset="0" stop-color="#FF2BD6" stop-opacity="0.24"/><stop offset="1" stop-color="#FF2BD6" stop-opacity="0"/></radialGradient>
    <radialGradient id="nebLime" cx="0.4" cy="1.05" r="0.5"><stop offset="0" stop-color="#B6FF00" stop-opacity="0.16"/><stop offset="1" stop-color="#B6FF00" stop-opacity="0"/></radialGradient>
    <radialGradient id="stage" cx="0.5" cy="0.53" r="0.5"><stop offset="0" stop-color="#010504" stop-opacity="0.9"/><stop offset="0.6" stop-color="#010504" stop-opacity="0.55"/><stop offset="1" stop-color="#010504" stop-opacity="0"/></radialGradient>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.3" stop-color="#EAFFD6"/><stop offset="0.5" stop-color="#B6FF00"/>
      <stop offset="0.52" stop-color="#0FA81F"/><stop offset="0.78" stop-color="#39FF14"/><stop offset="1" stop-color="#00F0A8"/>
    </linearGradient>
    <linearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#39FF14" stop-opacity="0"/><stop offset="0.5" stop-color="#B6FF00" stop-opacity="0.9"/><stop offset="1" stop-color="#00F0FF" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="bigGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="textGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
''')
A(f'  <rect width="{W}" height="{H}" fill="url(#bg)"/>')
for n in ("nebAcid", "nebCyan", "nebMag", "nebLime"):
    A(f'  <rect width="{W}" height="{H}" fill="url(#{n})"/>')

# feines Hex-/Punktraster wie ein Gewebeschnitt
A('  <g fill="#39FF14" opacity="0.10">')
for gy in range(0, H + 1, 28):
    off = 14 if (gy // 28) % 2 else 0
    A("    " + "".join(f'<circle cx="{gx + off}" cy="{gy}" r="0.9"/>' for gx in range(0, W + 1, 28)))
A('  </g>')

# Axone: breite weiche Leuchtspur + feine helle Faser
A('  <g fill="none" stroke-linecap="round">')
A('    <g stroke="#39FF14" stroke-width="5" opacity="0.13" filter="url(#bigGlow)">')
for e, d in paths.items(): A(f'      <path d="{d}"/>')
A('    </g>')
A('    <g filter="url(#glow)">')
for (i, j), d in paths.items():
    col = nodes[i][3]
    fade = 0.25 + 0.6 * min(density(*nodes[i][:2]), density(*nodes[j][:2]))
    A(f'      <path id="a{i}_{j}" d="{d}" stroke="{col}" stroke-width="{rnd.choice([0.9, 1.1, 1.4])}" opacity="{fade:.2f}"/>')
A('    </g>')
A('  </g>')

# Neuronen: Halo, Zellkoerper, heller Kern
A('  <g>')
for (x, y, r, col) in nodes:
    o = 0.3 + 0.7 * density(x, y)
    A(f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 3.2:.1f}" fill="{col}" opacity="{0.22 * o:.2f}" filter="url(#bigGlow)"/>')
A('  </g>')
A('  <g filter="url(#glow)">')
for k, (x, y, r, col) in enumerate(nodes):
    o = 0.35 + 0.65 * density(x, y)
    pulse = ""
    if k % 5 == 0:
        dur = rnd.uniform(2.4, 4.6)
        pulse = f'<animate attributeName="r" values="{r:.1f};{r * 1.7:.1f};{r:.1f}" dur="{dur:.1f}s" repeatCount="indefinite"/>'
    A(f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" opacity="{o:.2f}">{pulse}</circle>')
    A(f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 0.42:.1f}" fill="#FFFFFF" opacity="{0.9 * o:.2f}"/>')
A('  </g>')

# Aktionspotenziale: Lichtpunkte wandern ueber einige Axone
A('  <g filter="url(#glow)">')
for (i, j) in rnd.sample(sorted(paths), 16):
    dur = rnd.uniform(1.8, 3.6); beg = rnd.uniform(0, 3)
    col = rnd.choice(["#EAFFD6", LIME, CYAN, "#FFFFFF"])
    A(f'    <circle r="2.3" fill="{col}"><animateMotion dur="{dur:.1f}s" begin="{beg:.1f}s" repeatCount="indefinite" rotate="auto"><mpath href="#a{i}_{j}"/></animateMotion>'
      f'<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="{dur:.1f}s" begin="{beg:.1f}s" repeatCount="indefinite"/></circle>')
A('  </g>')

# Buehne fuer die Wortmarke
A(f'  <ellipse cx="600" cy="224" rx="520" ry="150" fill="url(#stage)"/>')

# EEG-/Gedaechtnisspur unter der Wortmarke
pts = []
for k in range(0, 121):
    x = 300 + k * 5
    t = k / 120.0
    env = math.exp(-((t - 0.5) / 0.23) ** 2)
    y = 292 - env * (9 * math.sin(k * 0.9) + 6 * math.sin(k * 2.3 + 1) + (16 if k % 17 == 8 else 0))
    pts.append(f"{x},{y:.1f}")
A(f'  <polyline points="{" ".join(pts)}" fill="none" stroke="url(#scan)" stroke-width="1.6" filter="url(#glow)" opacity="0.9"/>')

# Wortmarke: 3D-Extrusion -> Chrom-Front
A('''  <g font-family="'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="900" text-anchor="middle" letter-spacing="3">
    <text x="600" y="250" font-size="96" fill="#39FF14" filter="url(#glow)" opacity="0.75">MNEMOSYNE</text>
    <text x="606" y="256" font-size="96" fill="#021A0A">MNEMOSYNE</text>
    <text x="605" y="255" font-size="96" fill="#03260E">MNEMOSYNE</text>
    <text x="604" y="254" font-size="96" fill="#053313">MNEMOSYNE</text>
    <text x="603" y="253" font-size="96" fill="#074218">MNEMOSYNE</text>
    <text x="602" y="252" font-size="96" fill="#0A551E">MNEMOSYNE</text>
    <text x="601" y="251" font-size="96" fill="#0D6A25">MNEMOSYNE</text>
    <text x="600" y="250" font-size="96" fill="url(#chrome)" stroke="#B6FF00" stroke-width="1.3" filter="url(#textGlow)">MNEMOSYNE</text>
  </g>''')

# Vier Synapsen = vier Tools (save / search / read / doctor)
A('  <g filter="url(#glow)">')
for k, col in enumerate([ACID, CYAN, MAG, LIME]):
    A(f'    <circle cx="{556 + k * 29.3:.1f}" cy="312" r="3.4" fill="{col}"/>')
A('  </g>')

A('''  <text x="600" y="346" text-anchor="middle" font-family="'Courier New',Courier,monospace" font-size="20" font-weight="bold" fill="#39FF14" letter-spacing="2" filter="url(#textGlow)">memory for Claude Code</text>
  <text x="600" y="372" text-anchor="middle" font-family="'Courier New',Courier,monospace" font-size="15" fill="#9CFFF4" letter-spacing="2.5">lokales, repo-übergreifendes arbeitsgedächtnis</text>
</svg>''')

open(sys.argv[1], "w", encoding="utf-8").write("\n".join(out) + "\n")
print(len(nodes), "Neuronen,", len(paths), "Axone")
