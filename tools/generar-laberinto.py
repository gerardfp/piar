#!/usr/bin/env python3
"""Generador de materiales del Proyecto 3: El Laberinto Mágico.

Uso (desde la raíz del portal):  python3 tools/generar-laberinto.py

Produce, a partir de los mismos datos de nivel que usa el simulador:
  - Fondos SVG (nivel-1..3, victoria) y disfraces (mago, fantasma)
  - Sonidos WAV sintetizados (hechizo, golpe, fantasma)
  - Diagramas didácticos SVG (sensor de color, mensajes, fondos-niveles)
  - Proyectos Scratch .sb3: plantilla (sin código) y solución completa
"""
import hashlib, io, json, math, os, random, struct, subprocess, wave, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets/scratch/laberinto')
IMG = os.path.join(ROOT, 'assets/img')
os.makedirs(OUT, exist_ok=True)

# Los niveles se leen del mismo archivo que usa el simulador (requiere Node.js)
_JS = os.path.join(ROOT, 'js', 'laberinto-niveles.js')
L = json.loads(subprocess.check_output([
    'node', '-e',
    'const L=require(process.argv[1]);'
    'L.niveles.forEach(n=>Object.assign(n,L.mapaARectangulos(n.mapa)));'
    'process.stdout.write(JSON.stringify(L))', _JS]))
PARED = L['colores']['pared']
META = L['colores']['meta']
SUELO = L['colores']['suelo']
FONT = "Sans Serif, Helvetica, Arial, sans-serif"
UI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

# --------------------------------------------------------------------------
# 1. Disfraces
# --------------------------------------------------------------------------
MAGO_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">
  <!-- Varita mágica -->
  <line x1="35" y1="33" x2="44" y2="23" stroke="#92400e" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M44 18.5 L45.4 21.6 L48 22 L46 24.2 L46.6 27 L44 25.6 L41.4 27 L42 24.2 L40 22 L42.6 21.6 Z" fill="#fde047" stroke="#ca8a04" stroke-width="0.8"/>
  <!-- Túnica -->
  <path d="M15 27 L33 27 L38 45 L10 45 Z" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="19" cy="38" r="1.4" fill="#facc15"/>
  <circle cx="29" cy="35" r="1.2" fill="#facc15"/>
  <circle cx="26" cy="41" r="1.1" fill="#facc15"/>
  <!-- Cara y barba -->
  <circle cx="24" cy="23" r="7" fill="#fde2c4" stroke="#e7b98f" stroke-width="1"/>
  <path d="M17.5 24.5 Q24 39 30.5 24.5 Q24 28 17.5 24.5 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
  <circle cx="21.4" cy="21.8" r="1.25" fill="#1e293b"/>
  <circle cx="26.6" cy="21.8" r="1.25" fill="#1e293b"/>
  <!-- Sombrero -->
  <path d="M12.5 18 L24 1.5 L35.5 18 Z" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="1.6" stroke-linejoin="round"/>
  <ellipse cx="24" cy="18" rx="13" ry="3" fill="#1e40af" stroke="#1e3a8a" stroke-width="1.2"/>
  <path d="M24 7.5 L25.1 10 L27.8 10.2 L25.7 11.9 L26.4 14.5 L24 13.1 L21.6 14.5 L22.3 11.9 L20.2 10.2 L22.9 10 Z" fill="#facc15"/>
</svg>
'''

FANTASMA_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">
  <path d="M8 44 V22 A16 16 0 0 1 40 22 V44 L35 39.5 L29.5 44 L24 39.5 L18.5 44 L13 39.5 Z" fill="#e0e7ff" stroke="#818cf8" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="18" cy="22" rx="3.2" ry="4.2" fill="#1e1b4b"/>
  <ellipse cx="30" cy="22" rx="3.2" ry="4.2" fill="#1e1b4b"/>
  <circle cx="19" cy="20.5" r="1.1" fill="#ffffff"/>
  <circle cx="31" cy="20.5" r="1.1" fill="#ffffff"/>
  <ellipse cx="24" cy="31" rx="3.2" ry="2.6" fill="#1e1b4b"/>
  <ellipse cx="13.5" cy="28" rx="2.4" ry="1.4" fill="#fda4af" opacity="0.8"/>
  <ellipse cx="34.5" cy="28" rx="2.4" ry="1.4" fill="#fda4af" opacity="0.8"/>
</svg>
'''

# --------------------------------------------------------------------------
# 2. Fondos (generados desde los datos de nivel)
# --------------------------------------------------------------------------
def estrellas(seed, n=38, w=480, h=360):
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x, y = rnd.uniform(4, w - 4), rnd.uniform(4, h - 4)
        r = rnd.choice([0.8, 1.0, 1.2, 1.6])
        op = rnd.choice([0.35, 0.5, 0.7])
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#e0e7ff" opacity="{op}"/>')
    return '\n    '.join(out)


def estrella_path(cx, cy, r_out, r_in, puntas=5):
    pts = []
    for i in range(puntas * 2):
        ang = -math.pi / 2 + i * math.pi / puntas
        r = r_out if i % 2 == 0 else r_in
        pts.append(f'{cx + r * math.cos(ang):.1f},{cy + r * math.sin(ang):.1f}')
    return 'M' + ' L'.join(pts) + ' Z'


def fondo_nivel(idx, nv):
    paredes = '\n    '.join(
        f'<rect x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}"/>' for r in nv['paredes'])
    metas = []
    for r in nv['metas']:
        cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
        metas.append(f'<rect x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}" fill="{META}"/>')
        metas.append(f'<path d="{estrella_path(cx, cy, 11, 4.6)}" fill="#fef9c3"/>')
    metas = '\n  '.join(metas)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360">
  <!-- {nv["nombre"]}: {nv["titulo"]} | Paredes {PARED} · Meta {META} -->
  <rect x="0" y="0" width="480" height="360" fill="{SUELO}"/>
  <g>
    {estrellas(idx * 17 + 3)}
  </g>
  <g fill="{PARED}" shape-rendering="crispEdges">
    {paredes}
  </g>
  {metas}
  <text x="240" y="26" font-family="{FONT}" font-size="15" font-weight="bold" fill="#ede9fe" text-anchor="middle">{nv["nombre"]} · {nv["titulo"]}</text>
</svg>
'''


def fondo_victoria():
    rnd = random.Random(99)
    rayos = []
    for i in range(16):
        a1 = i * math.pi / 8
        a2 = a1 + math.pi / 16
        rayos.append(f'<path d="M240,175 L{240 + 420 * math.cos(a1):.1f},{175 + 420 * math.sin(a1):.1f} '
                     f'L{240 + 420 * math.cos(a2):.1f},{175 + 420 * math.sin(a2):.1f} Z" fill="#4c1d95" opacity="0.45"/>')
    confeti = []
    colores = ['#facc15', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa']
    for _ in range(40):
        x, y = rnd.uniform(10, 470), rnd.uniform(10, 350)
        confeti.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="6" height="3" rx="1" fill="{rnd.choice(colores)}" '
                       f'transform="rotate({rnd.randint(0, 180)} {x:.0f} {y:.0f})"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360">
  <rect x="0" y="0" width="480" height="360" fill="{SUELO}"/>
  {''.join(rayos)}
  {estrellas(7, 50)}
  {''.join(confeti)}
  <path d="{estrella_path(240, 120, 62, 26)}" fill="#facc15" stroke="#ca8a04" stroke-width="4" stroke-linejoin="round"/>
  <path d="{estrella_path(240, 120, 40, 17)}" fill="#fef08a"/>
  <text x="240" y="232" font-family="{FONT}" font-size="46" font-weight="bold" fill="#ffffff" stroke="#6d28d9" stroke-width="2" text-anchor="middle">¡VICTORIA!</text>
  <text x="240" y="262" font-family="{FONT}" font-size="16" fill="#ddd6fe" text-anchor="middle">Has escapado del Laberinto Mágico</text>
</svg>
'''

# --------------------------------------------------------------------------
# 3. Sonidos WAV (síntesis simple)
# --------------------------------------------------------------------------
RATE = 22050


def wav_bytes(samples):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 30000)) for s in samples))
    return buf.getvalue(), len(samples)


def snd_golpe():
    n = int(RATE * 0.2)
    rnd = random.Random(1)
    out, ph = [], 0.0
    for i in range(n):
        t = i / RATE
        f = 150 * math.exp(-t * 9) + 45
        ph += 2 * math.pi * f / RATE
        env = math.exp(-t * 22)
        out.append(0.9 * env * math.sin(ph) + 0.15 * env * (rnd.random() * 2 - 1) * math.exp(-t * 60))
    return wav_bytes(out)


def snd_hechizo():
    notas = [1046.5, 1318.5, 1568.0, 2093.0]  # Do6 Mi6 Sol6 Do7
    n = int(RATE * 0.85)
    out = [0.0] * n
    for k, f in enumerate(notas):
        ini = int(k * 0.1 * RATE)
        for i in range(ini, n):
            t = (i - ini) / RATE
            env = math.exp(-t * 5.5) * min(1, t * 200)
            out[i] += 0.22 * env * (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2.01 * t))
    rnd = random.Random(5)  # destellos
    for _ in range(14):
        ini = rnd.randint(int(0.3 * RATE), n - 800)
        f = rnd.uniform(2500, 4200)
        for i in range(ini, min(n, ini + 1500)):
            t = (i - ini) / RATE
            out[i] += 0.07 * math.exp(-t * 40) * math.sin(2 * math.pi * f * t)
    return wav_bytes(out)


def snd_fantasma():
    n = int(RATE * 0.65)
    out, ph = [], 0.0
    for i in range(n):
        t = i / RATE
        f = 520 - 300 * (t / 0.65) + 35 * math.sin(2 * math.pi * 7 * t)
        ph += 2 * math.pi * f / RATE
        env = min(1, t * 25) * math.exp(-t * 3)
        out.append(0.55 * env * (math.sin(ph) + 0.25 * math.sin(2 * ph)))
    return wav_bytes(out)

# --------------------------------------------------------------------------
# 4. Diagramas didácticos
# --------------------------------------------------------------------------
SVG_STYLE = ''

def tarjeta(h):
    return f'<rect x="0.75" y="0.75" width="598.5" height="{h - 1.5}" rx="12" fill="#ffffff" stroke="#cbd8e6" stroke-width="1.5"/>'


def mago_g(x, y, s=1.0):
    inner = MAGO_SVG.split('\n', 1)[1].rsplit('</svg>', 1)[0]
    return f'<g transform="translate({x},{y}) scale({s})">{inner}</g>'


def diagrama_sensor():
    def panel(ox, toca):
        mx = 120 if toca else 78
        out = [f'<g transform="translate({ox}, 46)">',
               '<rect x="0" y="0" width="255" height="132" rx="10" fill="#f8fafc" stroke="#cbd8e6" stroke-width="1.5"/>',
               f'<rect x="14" y="14" width="227" height="78" rx="4" fill="{SUELO}"/>',
               f'<rect x="150" y="14" width="91" height="78" fill="{PARED}"/>',
               f'<text x="195" y="58" font-family="{UI_FONT}" font-size="10" font-weight="700" fill="#ede9fe" text-anchor="middle">PARED</text>',
               mago_g(mx, 29, 1.0)]
        if toca:
            out.append('<rect x="148" y="30" width="22" height="46" fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="4,3"/>')
            out.append(f'<text x="128" y="106" font-family="{UI_FONT}" font-size="10.5" fill="#3a4d63" text-anchor="middle">Los píxeles del mago se superponen al morado</text>')
            out.append('<rect x="37" y="113" width="182" height="15" rx="7.5" fill="#fff1f2" stroke="#fecdd3"/>')
            out.append(f'<text x="128" y="124" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#9f1239" text-anchor="middle">verdadero ➜ volver a la salida</text>')
        else:
            out.append(f'<text x="128" y="106" font-family="{UI_FONT}" font-size="10.5" fill="#3a4d63" text-anchor="middle">Alrededor del mago solo hay suelo</text>')
            out.append('<rect x="47" y="113" width="162" height="15" rx="7.5" fill="#f0fdf4" stroke="#86efac"/>')
            out.append(f'<text x="128" y="124" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#166534" text-anchor="middle">falso ➜ sigue caminando</text>')
        out.append('</g>')
        return '\n  '.join(out)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 220" width="600" height="220">
  {tarjeta(220)}
  <text x="300" y="26" font-family="{UI_FONT}" font-size="13" font-weight="700" fill="#0f1d2e" text-anchor="middle">EL SENSOR DE COLOR: ¿TOCANDO EL COLOR <tspan fill="{PARED}">■</tspan>?</text>
  {panel(30, False)}
  {panel(315, True)}
  <text x="300" y="204" font-family="{UI_FONT}" font-size="10.5" fill="#62778f" text-anchor="middle">Scratch comprueba, en cada vuelta del bucle, si algún píxel del disfraz está encima del color elegido.</text>
</svg>
'''


def caja(x, y, w, h, titulo, linea1, linea2, color):
    return (f'<g transform="translate({x},{y})">'
            f'<rect x="0" y="0" width="{w}" height="{h}" rx="8" fill="#f8fafc" stroke="#cbd8e6" stroke-width="1.5"/>'
            f'<rect x="0" y="0" width="5" height="{h}" rx="2" fill="{color}"/>'
            f'<text x="14" y="19" font-family="{UI_FONT}" font-size="11.5" font-weight="700" fill="#0f1d2e">{titulo}</text>'
            f'<text x="14" y="36" font-family="ui-monospace, monospace" font-size="9" fill="#3a4d63">{linea1}</text>'
            f'<text x="14" y="50" font-family="ui-monospace, monospace" font-size="9" fill="#3a4d63">{linea2}</text>'
            '</g>')


def flecha(x1, y1, x2, y2, color='#d97706', dash=''):
    ang = math.atan2(y2 - y1, x2 - x1)
    p1 = (x2 - 8 * math.cos(ang - 0.45), y2 - 8 * math.sin(ang - 0.45))
    p2 = (x2 - 8 * math.cos(ang + 0.45), y2 - 8 * math.sin(ang + 0.45))
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="2" fill="none"{d}/>'
            f'<polygon points="{x2},{y2} {p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}" fill="{color}"/>')


def diagrama_mensajes():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 250" width="600" height="250">
  {tarjeta(250)}
  <text x="300" y="26" font-family="{UI_FONT}" font-size="13" font-weight="700" fill="#0f1d2e" text-anchor="middle">DIFUSIÓN DE MENSAJES: UN EMISOR, MUCHOS RECEPTORES</text>
  <!-- Emisor -->
  <g transform="translate(22, 78)">
    <rect x="0" y="0" width="150" height="96" rx="10" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.5"/>
    {mago_g(8, 6, 0.95)}
    <text x="58" y="24" font-family="{UI_FONT}" font-size="12" font-weight="700" fill="#78350f">Mago</text>
    <text x="58" y="40" font-family="{UI_FONT}" font-size="9.5" fill="#92400e">toca la meta</text>
    <rect x="10" y="58" width="130" height="24" rx="5" fill="#ffbf00" stroke="#cc9900"/>
    <text x="75" y="74" font-family="{UI_FONT}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">enviar [nivel superado]</text>
  </g>
  {flecha(176, 126, 226, 126)}
  <!-- Mensaje -->
  <g transform="translate(232, 96)">
    <rect x="0" y="0" width="76" height="60" rx="8" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M10 14 L66 14 L66 46 L10 46 Z" fill="#ffffff" stroke="#d97706" stroke-width="1.5"/>
    <path d="M10 14 L38 34 L66 14" fill="none" stroke="#d97706" stroke-width="1.5"/>
    <text x="38" y="74" font-family="ui-monospace, monospace" font-size="9" font-weight="700" fill="#b45309" text-anchor="middle">«nivel superado»</text>
  </g>
  {flecha(312, 112, 368, 72)}
  {flecha(312, 140, 368, 168)}
  {caja(372, 44, 208, 58, "🎭 Escenario", "al recibir [nivel superado]", "→ sonido + siguiente fondo", "#ffbf00")}
  {caja(372, 142, 208, 58, "🧙 Mago", "al recibir [nivel superado]", "→ decir ¡Abracadabra!", "#ffbf00")}
  {flecha(476, 104, 476, 138, '#9966ff', '4,3')}
  <text x="468" y="125" font-family="{UI_FONT}" font-size="8.5" fill="#6d28d9" text-anchor="end">el fondo cambia ➜ los fantasmas reaccionan</text>
  <text x="300" y="232" font-family="{UI_FONT}" font-size="10.5" fill="#62778f" text-anchor="middle">El emisor no sabe quién escucha: todos los scripts «al recibir» de ese mensaje arrancan a la vez.</text>
</svg>
'''


def miniatura(nv, ox, oy, s=0.25):
    out = [f'<g transform="translate({ox},{oy}) scale({s})">',
           f'<rect x="0" y="0" width="480" height="360" fill="{SUELO}"/>']
    for r in nv['paredes']:
        out.append(f'<rect x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}" fill="{PARED}"/>')
    for r in nv['metas']:
        out.append(f'<rect x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}" fill="{META}"/>')
    out.append('<circle cx="60" cy="60" r="12" fill="#60a5fa"/>')
    out.append('</g>')
    return ''.join(out)


def diagrama_fondos():
    xs = [22, 167, 312, 457]
    partes = []
    for i, nv in enumerate(L['niveles']):
        partes.append(miniatura(nv, xs[i], 52))
        partes.append(f'<rect x="{xs[i]}" y="52" width="120" height="90" fill="none" stroke="#cbd8e6" stroke-width="1.5"/>')
        partes.append(f'<text x="{xs[i] + 60}" y="160" font-family="{UI_FONT}" font-size="11" font-weight="700" fill="#0f1d2e" text-anchor="middle">Fondo {i + 1}: {nv["nombre"]}</text>')
        partes.append(f'<text x="{xs[i] + 60}" y="174" font-family="{UI_FONT}" font-size="9" fill="#62778f" text-anchor="middle">{nv["titulo"]}</text>')
    # Victoria
    partes.append(f'<rect x="{xs[3]}" y="52" width="120" height="90" fill="{SUELO}" stroke="#cbd8e6" stroke-width="1.5"/>')
    partes.append(f'<path d="{estrella_path(xs[3] + 60, 88, 22, 9)}" fill="#facc15"/>')
    partes.append(f'<text x="{xs[3] + 60}" y="130" font-family="{UI_FONT}" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">¡VICTORIA!</text>')
    partes.append(f'<text x="{xs[3] + 60}" y="160" font-family="{UI_FONT}" font-size="11" font-weight="700" fill="#0f1d2e" text-anchor="middle">Fondo 4: Victoria</text>')
    partes.append(f'<text x="{xs[3] + 60}" y="174" font-family="{UI_FONT}" font-size="9" fill="#62778f" text-anchor="middle">Fin del juego</text>')
    for i in range(3):
        x1 = xs[i] + 122
        partes.append(flecha(x1, 97, x1 + 21, 97, '#9966ff'))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 220" width="600" height="220">
  {tarjeta(220)}
  <text x="300" y="26" font-family="{UI_FONT}" font-size="13" font-weight="700" fill="#0f1d2e" text-anchor="middle">CADA FONDO ES UN NIVEL: «SIGUIENTE FONDO» AVANZA EN EL JUEGO</text>
  {''.join(partes)}
  <rect x="120" y="186" width="360" height="22" rx="6" fill="#f5f3ff" stroke="#c4b5fd"/>
  <text x="300" y="201" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#6d28d9" text-anchor="middle">cuando el fondo cambie a [Nivel 2] ➜ el Fantasma aparece y patrulla</text>
</svg>
'''

# --------------------------------------------------------------------------
# 5. Proyectos Scratch .sb3
# --------------------------------------------------------------------------
class Blocks:
    """Pequeño constructor de bloques Scratch 3 (project.json)."""

    def __init__(self, prefix):
        self.blocks = {}
        self.prefix = prefix
        self.n = 0

    def nid(self):
        self.n += 1
        return f'{self.prefix}{self.n:03d}'

    def build(self, spec, parent=None, top=False, x=0, y=0):
        bid = self.nid()
        b = {'opcode': spec['op'], 'next': None, 'parent': parent, 'inputs': {}, 'fields': {},
             'shadow': spec.get('shadow', False), 'topLevel': top}
        if top:
            b['x'], b['y'] = x, y
        if 'mutation' in spec:
            b['mutation'] = spec['mutation']
        for k, v in spec.get('fields', {}).items():
            b['fields'][k] = v
        self.blocks[bid] = b
        for name, (kind, val) in spec.get('inputs', {}).items():
            if kind == 'num':
                b['inputs'][name] = [1, [4, str(val)]]
            elif kind == 'ang':
                b['inputs'][name] = [1, [8, str(val)]]
            elif kind == 'text':
                b['inputs'][name] = [1, [10, str(val)]]
            elif kind == 'color':
                b['inputs'][name] = [1, [9, val]]
            elif kind == 'broadcast':
                b['inputs'][name] = [1, [11, val[0], val[1]]]
            elif kind == 'var_in_text':
                b['inputs'][name] = [3, [12, val[0], val[1]], [10, '']]
            elif kind == 'menu':
                sid = self.build(dict(val, shadow=True), parent=bid)
                b['inputs'][name] = [1, sid]
            elif kind == 'bool':
                b['inputs'][name] = [2, self.build(val, parent=bid)]
            elif kind == 'substack':
                b['inputs'][name] = [2, self.chain(val, parent=bid)]
        return bid

    def chain(self, specs, parent=None, top=False, x=0, y=0):
        first = prev = None
        for i, spec in enumerate(specs):
            bid = self.build(spec, parent=prev if prev else parent, top=(top and i == 0), x=x, y=y)
            if prev:
                self.blocks[prev]['next'] = bid
            else:
                first = bid
            prev = bid
        return first


# Atajos para describir scripts
def op(o, **kw):
    d = {'op': o}
    d.update(kw)
    return d

VAR_VIDAS = ('Vidas', 'varVidasLaberinto')
MSG = ('nivel superado', 'msgNivelSuperado')

flag = lambda: op('event_whenflagclicked')
gotoxy = lambda x, y: op('motion_gotoxy', inputs={'X': ('num', x), 'Y': ('num', y)})
point = lambda d: op('motion_pointindirection', inputs={'DIRECTION': ('ang', d)})
move = lambda s: op('motion_movesteps', inputs={'STEPS': ('num', s)})
turn = lambda d: op('motion_turnright', inputs={'DEGREES': ('num', d)})
rotstyle = lambda s: op('motion_setrotationstyle', fields={'STYLE': [s, None]})
show = lambda: op('looks_show')
hide = lambda: op('looks_hide')
say = lambda t, s: op('looks_sayforsecs', inputs={'MESSAGE': ('text', t), 'SECS': ('num', s)})
forever = lambda body: op('control_forever', inputs={'SUBSTACK': ('substack', body)})
if_ = lambda cond, body: op('control_if', inputs={'CONDITION': ('bool', cond), 'SUBSTACK': ('substack', body)})
key = lambda k: op('sensing_keypressed', inputs={'KEY_OPTION': ('menu', op('sensing_keyoptions', fields={'KEY_OPTION': [k, None]}))})
tcolor = lambda c: op('sensing_touchingcolor', inputs={'COLOR': ('color', c)})
tobj = lambda o: op('sensing_touchingobject', inputs={'TOUCHINGOBJECTMENU': ('menu', op('sensing_touchingobjectmenu', fields={'TOUCHINGOBJECTMENU': [o, None]}))})
or_ = lambda a, b: op('operator_or', inputs={'OPERAND1': ('bool', a), 'OPERAND2': ('bool', b)})
eq_vidas = lambda v: op('operator_equals', inputs={'OPERAND1': ('var_in_text', VAR_VIDAS), 'OPERAND2': ('text', v)})
play = lambda s: op('sound_play', inputs={'SOUND_MENU': ('menu', op('sound_sounds_menu', fields={'SOUND_MENU': [s, None]}))})
broadcast = lambda: op('event_broadcast', inputs={'BROADCAST_INPUT': ('broadcast', MSG)})
when_msg = lambda: op('event_whenbroadcastreceived', fields={'BROADCAST_OPTION': [MSG[0], MSG[1]]})
when_bd = lambda n: op('event_whenbackdropswitchesto', fields={'BACKDROP': [n, None]})
switch_bd = lambda n: op('looks_switchbackdropto', inputs={'BACKDROP': ('menu', op('looks_backdrops', fields={'BACKDROP': [n, None]}))})
next_bd = lambda: op('looks_nextbackdrop')
set_vidas = lambda v: op('data_setvariableto', fields={'VARIABLE': [VAR_VIDAS[0], VAR_VIDAS[1]]}, inputs={'VALUE': ('text', v)})
change_vidas = lambda v: op('data_changevariableby', fields={'VARIABLE': [VAR_VIDAS[0], VAR_VIDAS[1]]}, inputs={'VALUE': ('num', v)})
stop_all = lambda: op('control_stop', fields={'STOP_OPTION': ['all', None]},
                      mutation={'tagName': 'mutation', 'children': [], 'hasnext': 'false'})
reset_timer = lambda: op('sensing_resettimer')

SX, SY = L['salida']['x'], L['salida']['y']


def scripts_escenario(B):
    B.chain([flag(), switch_bd('Nivel 1'), set_vidas(3), reset_timer()], top=True, x=40, y=40)
    B.chain([when_msg(), play('hechizo'), next_bd()], top=True, x=40, y=260)


def scripts_mago(B):
    B.chain([
        flag(), rotstyle("don't rotate"), gotoxy(SX, SY), show(),
        forever([
            if_(key('up arrow'), [point(0), move(4)]),
            if_(key('down arrow'), [point(180), move(4)]),
            if_(key('left arrow'), [point(-90), move(4)]),
            if_(key('right arrow'), [point(90), move(4)]),
            if_(tcolor(PARED), [play('golpe'), gotoxy(SX, SY)]),
            if_(tcolor(META), [gotoxy(SX, SY), broadcast()]),
            if_(or_(tobj('Fantasma'), tobj('Fantasma2')), [
                play('fantasma'), change_vidas(-1), gotoxy(SX, SY),
                if_(eq_vidas(0), [say('¡Oh, no! Fin del juego', 2), stop_all()])
            ])
        ])
    ], top=True, x=40, y=40)
    B.chain([when_msg(), say('¡Abracadabra!', 1)], top=True, x=560, y=40)
    B.chain([when_bd('Victoria'), gotoxy(0, -110), say('¡Lo he conseguido!', 2), stop_all()], top=True, x=560, y=200)


def scripts_fantasma(B, apariciones, pasos):
    B.chain([flag(), rotstyle('left-right'), hide(),
             forever([move(pasos), if_(tcolor(PARED), [move(-pasos), turn(180)])])],
            top=True, x=40, y=40)
    y = 40
    for nombre, (x0, y0, d) in apariciones.items():
        B.chain([when_bd(nombre), gotoxy(x0, y0), point(d), show()], top=True, x=520, y=y)
        y += 200
    B.chain([when_bd('Victoria'), hide()], top=True, x=520, y=y)


def md5(b):
    return hashlib.md5(b).hexdigest()


def construir_sb3(con_codigo):
    assets = {}

    def costume(name, data, cx, cy):
        h = md5(data)
        assets[h + '.svg'] = data
        return {'name': name, 'bitmapResolution': 1, 'dataFormat': 'svg', 'assetId': h,
                'md5ext': h + '.svg', 'rotationCenterX': cx, 'rotationCenterY': cy}

    def sound(name, data_count):
        data, count = data_count
        h = md5(data)
        assets[h + '.wav'] = data
        return {'name': name, 'assetId': h, 'dataFormat': 'wav', 'format': '', 'rate': RATE,
                'sampleCount': count, 'md5ext': h + '.wav'}

    fondos = [costume(nv['nombre'], fondo_nivel(i + 1, nv).encode(), 240, 180) for i, nv in enumerate(L['niveles'])]
    fondos.append(costume('Victoria', fondo_victoria().encode(), 240, 180))
    s_hechizo, s_golpe, s_fantasma = snd_hechizo(), snd_golpe(), snd_fantasma()

    Bs, Bm, Bf, Bf2 = Blocks('esc'), Blocks('mag'), Blocks('fan'), Blocks('fdos')
    if con_codigo:
        scripts_escenario(Bs)
        scripts_mago(Bm)
        n2, n3 = L['niveles'][1]['fantasmas'][0], L['niveles'][2]['fantasmas']
        scripts_fantasma(Bf, {'Nivel 2': (n2['x'], n2['y'], n2['direccion']),
                              'Nivel 3': (n3[0]['x'], n3[0]['y'], n3[0]['direccion'])}, n2['pasos'])
        scripts_fantasma(Bf2, {'Nivel 3': (n3[1]['x'], n3[1]['y'], n3[1]['direccion'])}, n3[1]['pasos'])

    stage = {
        'isStage': True, 'name': 'Stage',
        'variables': {VAR_VIDAS[1]: [VAR_VIDAS[0], 3]}, 'lists': {},
        'broadcasts': {MSG[1]: MSG[0]}, 'blocks': Bs.blocks, 'comments': {},
        'currentCostume': 0, 'costumes': fondos, 'sounds': [sound('hechizo', s_hechizo)],
        'volume': 100, 'layerOrder': 0, 'tempo': 60, 'videoTransparency': 50,
        'videoState': 'on', 'textToSpeechLanguage': None
    }

    def sprite(name, svg, sounds, blocks, x, y, d, style, visible, layer):
        return {'isStage': False, 'name': name, 'variables': {}, 'lists': {}, 'broadcasts': {},
                'blocks': blocks, 'comments': {}, 'currentCostume': 0,
                'costumes': [costume(name.lower(), svg.encode(), 12, 12)], 'sounds': sounds,
                'volume': 100, 'layerOrder': layer, 'visible': visible, 'x': x, 'y': y, 'size': 100,
                'direction': d, 'draggable': False, 'rotationStyle': style}

    mago = sprite('Mago', MAGO_SVG, [sound('golpe', s_golpe), sound('fantasma', s_fantasma)], Bm.blocks,
                  SX, SY, 90, "don't rotate", True, 3)
    f1 = sprite('Fantasma', FANTASMA_SVG, [], Bf.blocks, 0, 0, 90, 'left-right', not con_codigo, 1)
    f2 = sprite('Fantasma2', FANTASMA_SVG, [], Bf2.blocks, -180, 0, 180, 'left-right', not con_codigo, 2)

    project = {
        'targets': [stage, f1, f2, mago],
        'monitors': [{
            'id': VAR_VIDAS[1], 'mode': 'default', 'opcode': 'data_variable',
            'params': {'VARIABLE': VAR_VIDAS[0]}, 'spriteName': None, 'value': 3,
            'width': 0, 'height': 0, 'x': 5, 'y': 5, 'visible': True,
            'sliderMin': 0, 'sliderMax': 100, 'isDiscrete': True
        }],
        'extensions': [],
        'meta': {'semver': '3.0.0', 'vm': '2.3.0', 'agent': 'PIAR generador laberinto'}
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('project.json', json.dumps(project, ensure_ascii=False))
        for name, data in assets.items():
            z.writestr(name, data)
    return buf.getvalue(), project


def main():
    def w(path, data):
        mode = 'wb' if isinstance(data, bytes) else 'w'
        with open(path, mode, **({} if mode == 'wb' else {'encoding': 'utf-8'})) as f:
            f.write(data)
        print('  ✓', os.path.relpath(path, ROOT))

    w(os.path.join(OUT, 'mago.svg'), MAGO_SVG)
    w(os.path.join(OUT, 'fantasma.svg'), FANTASMA_SVG)
    for i, nv in enumerate(L['niveles']):
        w(os.path.join(OUT, f'nivel-{i + 1}.svg'), fondo_nivel(i + 1, nv))
    w(os.path.join(OUT, 'victoria.svg'), fondo_victoria())
    w(os.path.join(OUT, 'hechizo.wav'), snd_hechizo()[0])
    w(os.path.join(OUT, 'golpe.wav'), snd_golpe()[0])
    w(os.path.join(OUT, 'fantasma.wav'), snd_fantasma()[0])
    w(os.path.join(IMG, 'sensor-color.svg'), diagrama_sensor())
    w(os.path.join(IMG, 'mensajes-broadcast.svg'), diagrama_mensajes())
    w(os.path.join(IMG, 'fondos-niveles.svg'), diagrama_fondos())
    plantilla, _ = construir_sb3(False)
    w(os.path.join(OUT, 'laberinto-plantilla.sb3'), plantilla)
    solucion, _ = construir_sb3(True)
    w(os.path.join(OUT, 'laberinto-solucion.sb3'), solucion)


if __name__ == '__main__':
    main()
