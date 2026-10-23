# -*- coding: utf-8 -*-
"""
Fortaleza de Nossa Senhora da Assunção (sede do Comando da 10ª Região Militar) em miniatura: gera as peças estáticas no
Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/forteAssuncao.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/forteAssuncao.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o ForteAssuncao.tsx carrega as duas):
    forteAssuncao-forte.glb     terreno em níveis, muralhas, quartel, pátio murado, guaritas, ruas e casario (sem
                                compressão, com a oclusão de ambiente assada nas cores de vértice)
    forteAssuncao-layout.json   árvores, coqueiros, carros e pessoas (o .tsx instancia), já em coordenadas do three

Medidas: planta do OpenStreetMap (pesquisa/forteAssuncao/ficha.md e osm.xml) em metros reais em volta do ponto do tour
(−3,7227618; −38,525034), encolhida em volta de C = (−2, −22) a K = 0,37 até 70 m e, daí para fora, com 55% do excesso
de raio (compressão radial suave). Só os vértices são transformados, então as fachadas continuam retas.
Coordenadas do Blender: x = leste, y = norte, z = cima (o exportador converte para y-cima com o norte em −z).
"""
import json
import math
import os
import random
import sys
import xml.etree.ElementTree as ET

import bpy  # noqa: E402  (o bmesh só existe depois do bpy)
import bmesh
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")
OSM = os.path.join(AQUI, "..", "pesquisa", "forteAssuncao", "osm.xml")
SEM_BAKE = "--sem-bake" in sys.argv
LAT0, LNG0 = -3.7227618, -38.525034

# ——— escala e recorte
K, CX, CY, R0, FC = 0.37, -2.0, -22.0, 70.0, 0.55
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
R_PLATO = 31.4       # até aqui o chão da cidade é plano; daí cai num talude gramado até a borda

# ——— níveis (m, já na miniatura): o forte fica no alto da colina, sobre a Leste-Oeste
Z_BAIXO = 0.10       # Av. Pres. Castelo Branco (Leste-Oeste), ao pé das muralhas
Z_RUA = 1.50         # ruas do Centro (Dr. João Moreira, Floriano Peixoto, Alberto Nepomuceno) e o Passeio Público
Z_MEIO = 2.00        # bateria inferior do baluarte (gramado com coqueiros)
Z_ESP = 2.45         # esplanada de fora, no alto da rampa, junto ao portão
Z_ALTO = 2.70        # platô do forte: pátio de estacionamento, pátio interno, terraço do espelho d'água

# ——— quartel
H_PAV = 2.95         # pé-direito de cada um dos dois pavimentos (os altos pés-direitos das fotos, exagerados)
H_PAREDE = 6.30      # topo da cimalha acima do platô
SUBIDA = 1.55        # cumeeira acima do beiral (telhado cerâmico a ~30°)
BEIRAL = 0.28


def T(p):
    """Planta real (m em volta do ponto do tour) → miniatura: K linear até R0 e compressão radial suave depois"""
    dx, dy = p[0] - CX, p[1] - CY
    r = math.hypot(dx, dy)
    if r < 1e-9:
        return (0.0, 0.0)
    rr = K * r if r <= R0 else K * R0 + FC * K * (r - R0)
    return (dx / r * rr, dy / r * rr)


def TT(pts):
    return [T(p) for p in pts]


# ———————————————————————————————————————————————— geometria plana

def area2(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2


def ccw(p):
    return list(p) if area2(p) > 0 else list(p)[::-1]


def direita(a, b):
    """Normal unitária à direita de a→b (num polígono anti-horário, é o lado de fora)"""
    dx, dy = b[0] - a[0], b[1] - a[1]
    l = math.hypot(dx, dy) or 1.0
    return (dy / l, -dx / l)


def offset_poli(p, d):
    """Desloca um polígono anti-horário fechado d para fora (d < 0: para dentro), com esquadria nas quinas"""
    n = len(p)
    out = []
    for i in range(n):
        a, b, c = p[i - 1], p[i], p[(i + 1) % n]
        n1, n2 = direita(a, b), direita(b, c)
        bx, by = n1[0] + n2[0], n1[1] + n2[1]
        l = math.hypot(bx, by) or 1.0
        bx, by = bx / l, by / l
        s = d / max(0.25, bx * n1[0] + by * n1[1])
        out.append((b[0] + bx * s, b[1] + by * s))
    return out


def offset_linha(p, d):
    """Desloca uma polilinha aberta d para a direita, com esquadria"""
    out = []
    for i in range(len(p)):
        if i == 0:
            n1 = n2 = direita(p[0], p[1])
        elif i == len(p) - 1:
            n1 = n2 = direita(p[-2], p[-1])
        else:
            n1, n2 = direita(p[i - 1], p[i]), direita(p[i], p[i + 1])
        bx, by = n1[0] + n2[0], n1[1] + n2[1]
        l = math.hypot(bx, by) or 1.0
        bx, by = bx / l, by / l
        s = d / max(0.3, bx * n1[0] + by * n1[1])
        out.append((p[i][0] + bx * s, p[i][1] + by * s))
    return out


def circulo(n=96, r=RAIO):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def recortar_no_disco(poli, r=RAIO, n=96):
    """Sutherland–Hodgman de um polígono contra o disco (aproximado por um 96-gono convexo)"""
    c = circulo(n, r)
    saida = list(poli)
    for i in range(n):
        a, b = c[i], c[(i + 1) % n]
        entrada, saida = saida, []
        if not entrada:
            break
        dentro = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0
        for j in range(len(entrada)):
            p, q = entrada[j], entrada[(j + 1) % len(entrada)]
            dp, dq = dentro(p), dentro(q)
            if dp:
                saida.append(p)
            if dp != dq:
                ex, ey = q[0] - p[0], q[1] - p[1]
                fx, fy = b[0] - a[0], b[1] - a[1]
                den = ex * fy - ey * fx
                t = ((a[0] - p[0]) * fy - (a[1] - p[1]) * fx) / den
                saida.append((p[0] + t * ex, p[1] + t * ey))
    # tira vértices repetidos
    limpo = []
    for q in saida:
        if not limpo or math.hypot(q[0] - limpo[-1][0], q[1] - limpo[-1][1]) > 1e-4:
            limpo.append(q)
    if len(limpo) > 1 and math.hypot(limpo[0][0] - limpo[-1][0], limpo[0][1] - limpo[-1][1]) < 1e-4:
        limpo.pop()
    return limpo


def recortar_linha(pts, r=RAIO):
    """Trechos de uma polilinha que ficam dentro do círculo de raio r"""
    trechos, atual = [], []
    for a, b in zip(pts, pts[1:]):
        ax, ay, bx, by = a[0], a[1], b[0], b[1]
        dx, dy = bx - ax, by - ay
        A = dx * dx + dy * dy
        B = 2 * (ax * dx + ay * dy)
        Cc = ax * ax + ay * ay - r * r
        disc = B * B - 4 * A * Cc
        if A < 1e-12:
            continue
        if disc <= 0:
            if atual:
                trechos.append(atual)
                atual = []
            continue
        t0, t1 = (-B - math.sqrt(disc)) / (2 * A), (-B + math.sqrt(disc)) / (2 * A)
        s0, s1 = max(0.0, t0), min(1.0, t1)
        if s0 >= s1:
            if atual:
                trechos.append(atual)
                atual = []
            continue
        p0 = (ax + dx * s0, ay + dy * s0)
        p1 = (ax + dx * s1, ay + dy * s1)
        if not atual:
            atual = [p0]
        atual.append(p1)
        if s1 < 1.0:
            trechos.append(atual)
            atual = []
    if atual:
        trechos.append(atual)
    return [t for t in trechos if len(t) >= 2]


def ponto_no_poligono(p, poli):
    x, y = p
    d = False
    j = len(poli) - 1
    for i in range(len(poli)):
        xi, yi = poli[i]
        xj, yj = poli[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            d = not d
        j = i
    return d


def dist_poligono(p, poli):
    """Distância de p à borda do polígono (0 se dentro)"""
    if ponto_no_poligono(p, poli):
        return 0.0
    return dist_borda(p, poli)


def dist_borda(p, poli, fechado=True):
    m = 1e9
    pares = list(zip(poli, poli[1:] + poli[:1])) if fechado else list(zip(poli, poli[1:]))
    for a, b in pares:
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1)))
        m = min(m, math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    return m


def intersecao(a, b, c, d):
    """Interseção das retas a–b e c–d"""
    x1, y1, x2, y2, x3, y3, x4, y4 = *a, *b, *c, *d
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def comprimento(pts):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))


def amostrar(pts, passo, inicio=0.0):
    """Pontos (x, y, ângulo) a cada `passo` ao longo de uma polilinha"""
    out = []
    s = inicio
    acum = 0.0
    for a, b in zip(pts, pts[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        while s <= acum + l:
            t = (s - acum) / l if l else 0
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ang))
            s += passo
        acum += l
    return out


# zonas onde não nasce árvore nem carro (miniatura)
OCUPADO = []   # (polígono, folga)


def reservar(poli, folga=0.4):
    OCUPADO.append((poli, folga))


# ———————————————————————————————————————————————— planta real (OSM, ver ficha)

# quartel (relação 15829081): a quadra, com o canto sudoeste chanfrado, e a ala noroeste que sobe junto ao Passeio
Q_SE, Q_NE = (1.0, -79.0), (19.3, -30.2)
Q_P = (-46.9, -3.9)                         # canto reentrante onde a ala noroeste encosta na fachada norte
ALA_NE, ALA_NO = (-40.3, 16.5), (-51.6, 20.6)
Q_SO1, Q_SO2 = (-73.4, -45.9), (-70.6, -51.8)
Q_NO = intersecao(Q_NE, Q_P, ALA_NO, Q_SO1)  # quina noroeste da quadra (prolongando a fachada norte até a oeste)
PATIO = [(-8.7, -60.4), (-0.5, -37.7), (-49.6, -18.8), (-57.2, -41.6)]
ENTRADA = (11.0, -55.0)                      # porta principal (nó 5958129785), no meio da fachada leste
PORTAO = (25.0, -60.0)                       # portão das guaritas (nó 5958040923)
ANEXO_A = [(-31.4, 2.4), (-17.2, -3.1), (-13.4, 6.9), (-27.6, 12.4)]
ANEXO_B = [(-45.1, -3.1), (-35.1, -7.0), (-27.7, 12.3), (-37.7, 16.2)]
# muralha norte: face de fora (via 630998534) e de dentro (via 630998521)
L_FORA = [(-96.0, 84.0), (-47.0, 49.0), (-50.0, 41.0), (8.0, 19.0), (15.0, 33.0), (77.0, 26.0)]
L_DENTRO = [(-97.0, 66.0), (-58.0, 45.0), (-52.0, 31.0), (14.0, 5.0), (22.0, 22.0), (71.0, 16.0)]
FIM_BATERIA = [(77.0, 26.0), (73.0, 19.0), (71.0, 16.0)]
# muro do pátio murado (estacionamento, relação 8778621), do canto do quartel até a muralha
MURO_LESTE = [(1.0, -79.0), (2.0, -80.0), (16.0, -85.0), (25.0, -60.0), (33.0, -41.0), (39.0, -24.0), (46.0, -16.0), (71.0, 16.0)]
# muro oeste do forte, entre o platô e o Passeio Público
MURO_OESTE = [(-120.0, 44.0), (-98.0, 36.0), (-64.0, 24.0), (-55.0, 22.0), (-51.6, 20.6)]
TERRACO = [(15.4, 0.9), (49.1, -9.7), (67.6, 15.5), (64.7, 16.3), (63.7, 14.6), (22.6, 19.4)]
ESPELHO = (27.5, 6.9)                        # espelho d'água redondo (via 630998508, Ø ≈ 9 m) e o monumento no centro
ESTATUA = (59.0, 10.0)
PRACA_VELAS = [(36, -61), (39, -53), (41, -46), (62, -57), (65, -59), (61, -66), (46, -91), (43, -96), (41, -97), (35, -95), (27, -92), (26, -89), (26, -87), (28, -82)]
VELAS = (37.0, -82.0)
ESPLANADA = [(25.0, -60.0), (33.0, -41.0), (39.0, -24.0), (46.0, -16.0), (71.0, 16.0), (73.0, 19.0), (81.0, 20.0), (105.0, 17.0), (62.0, -57.0), (41.0, -46.0), (39.0, -53.0), (31.0, -64.0)]
RAMPA = [(14.0, -90.0), (16.0, -85.0), (25.0, -60.0), (31.0, -64.0), (22.0, -93.0)]
PASSEIO = [(-218.0, 3.0), (-145.0, -23.0), (-87.0, -45.0), (-77.0, -16.0), (-64.0, 24.0), (-98.0, 36.0), (-198.0, 68.0)]
GRADIL_PASSEIO = [(-87.0, -45.0), (-77.0, -16.0), (-64.0, 24.0)]
# ruas (eixos)
R_JOAO_MOREIRA = [(43, -108), (32, -102), (18, -95), (3, -88), (-83, -54), (-147, -31)]
R_BEZERRIL = [(3, -88), (-1, -95), (-22, -134)]
R_FLORIANO = [(-90, -75), (-83, -54), (-80, -45), (-70, -18), (-57, 18)]
AV_NEPOMUCENO = [(118, 25), (107, 4), (80, -43), (50, -94), (47, -101), (43, -108)]
PISTA_ESPLANADA = [(30, -62), (35, -51), (41, -37), (45, -26), (47, -23), (57, -11), (65, 0), (73, 11), (77, 14), (83, 15), (102, 13)]
AV_CASTELO = [(-120, 100), (-82, 87), (-76, 85), (-31, 60), (-5, 48), (24, 40), (48, 37), (76, 34), (108, 24), (116, 19)]


# ———————————————————————————————————————————————— materiais

def srgb_lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


MATS = {}


def mat(nome, cor, rug=0.85, metal=0.0, imagem=None):
    """Material PBR nomeado (Principled → glTF metallicRoughness); `imagem` vira o mapa de cor"""
    if nome in MATS:
        return MATS[nome]
    m = bpy.data.materials.new(nome)
    if m.node_tree is None:
        m.use_nodes = True
    nos = m.node_tree.nodes
    b = nos.get("Principled BSDF") or nos.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*srgb_lin(cor), 1.0)
    b.inputs["Roughness"].default_value = rug
    b.inputs["Metallic"].default_value = metal
    if imagem is not None:
        t = nos.new("ShaderNodeTexImage")
        t.image = imagem
        t.interpolation = "Linear"
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    MATS[nome] = m
    return m


# ———————————————————————————————————————————————— construtor de malhas

class Peca:
    """Acumula geometria num bmesh com vários materiais e vira um objeto só (uma malha por peça do marco)"""

    def __init__(self, nome):
        self.nome = nome
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def poli(self, pts, m, uvs=None, liso=False, para=None):
        """Face com os pontos dados; com `para` (vetor), a ordem é invertida se a normal apontar para o outro lado"""
        pts = [tuple(p) for p in pts]
        if para is not None:
            n = Vector((0, 0, 0))
            for i in range(len(pts)):
                a, b = Vector(pts[i]), Vector(pts[(i + 1) % len(pts)])
                n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
            if n.dot(Vector(para)) < 0:
                pts = pts[::-1]
                uvs = uvs[::-1] if uvs else uvs
        vs = [self.bm.verts.new(p) for p in pts]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = self.mi(m)
        f.smooth = liso
        if uvs:
            for l, uv in zip(f.loops, uvs):
                l[self.uv].uv = uv
        return f

    def juntar(self, bm2, m, M=None, liso=None, uvf=None):
        """Copia um bmesh temporário; `m` é um material ou uma lista indexada pelo material_index da face"""
        if M is not None:
            bm2.transform(M)
        uv2 = bm2.loops.layers.uv.active
        mp = {v: self.bm.verts.new(v.co) for v in bm2.verts}
        for f in bm2.faces:
            try:
                nf = self.bm.faces.new([mp[v] for v in f.verts])
            except ValueError:
                continue
            mm = m[min(f.material_index, len(m) - 1)] if isinstance(m, (list, tuple)) else m
            nf.material_index = self.mi(mm)
            nf.smooth = f.smooth if liso is None else liso
            if uvf is not None:
                for l in nf.loops:
                    l[self.uv].uv = uvf(l.vert.co, f.normal)
            elif uv2 is not None:
                for l, l2 in zip(nf.loops, f.loops):
                    l[self.uv].uv = l2[uv2].uv
        bm2.free()

    def criar(self, grade=None):
        me = bpy.data.meshes.new(self.nome)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
        if grade:
            subdividir_grade(self.bm, *grade)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.nome, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def subdividir_grade(bm, passo, so_horizontais=True):
    """Corta as faces numa grade (só para a oclusão de ambiente ter vértices onde precisa)"""
    filtro = (lambda f: abs(f.normal.z) > 0.7) if so_horizontais else (lambda f: f.calc_area() > passo * passo * 0.8)
    alvo = [f for f in bm.faces if filtro(f)]
    if not alvo:
        return
    xs = [v.co.x for f in alvo for v in f.verts]
    ys = [v.co.y for f in alvo for v in f.verts]
    for eixo, lo, hi in ((0, min(xs), max(xs)), (1, min(ys), max(ys))):
        k = math.floor(lo / passo) * passo + passo
        while k < hi:
            faces = [f for f in bm.faces if filtro(f)]
            geom = list({e for f in faces for e in f.edges}) + faces + list({v for f in faces for v in f.verts})
            co = (k, 0, 0) if eixo == 0 else (0, k, 0)
            no = (1, 0, 0) if eixo == 0 else (0, 1, 0)
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
            k += passo
    bm.normal_update()


def bm_caixa(sx, sy, sz, chanfro=0.0):
    """Caixa com base em z = 0, centrada em x/y, com as arestas chanfradas"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, (v.co.z + 0.5) * sz))
    if chanfro > 0 and min(sx, sy, sz) >= 0.35:      # em peças finas o chanfro não aparece e só multiplica vértices
        c = min(chanfro, sx / 4, sy / 4, sz / 4)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=c, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_cilindro(r, h, n=16, r2=None, tampa=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tampa, cap_tris=False, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=Vector((0, 0, h / 2)), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_torno(perfil, n=32):
    """Superfície de revolução de um perfil [(r, z), ...] em volta do eixo z"""
    bm = bmesh.new()
    aneis = []
    for i in range(n):
        a = 2 * math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        aneis.append([bm.verts.new((r * ca, r * sa, z)) if r > 1e-6 else None for r, z in perfil])
    topo = {}
    for j, (r, z) in enumerate(perfil):
        if r <= 1e-6:
            topo[j] = bm.verts.new((0, 0, z))
    for i in range(n):
        A, B = aneis[i], aneis[(i + 1) % n]
        for j in range(len(perfil) - 1):
            a0v, a1v, b0v, b1v = A[j], A[j + 1], B[j], B[j + 1]
            if a0v is None:
                bm.faces.new([topo[j], b1v, a1v])
            elif a1v is None:
                bm.faces.new([a0v, b0v, topo[j + 1]])
            else:
                bm.faces.new([a0v, b0v, b1v, a1v])
    return bm


def bm_esfera(r, seg=8, aneis=5):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=aneis, radius=r)
    return bm


def bm_poli_extrudado(pts3, d):
    """Placa: polígono plano (pontos 3D em ordem) extrudado pelo vetor d"""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts3]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for e in r["geom"]:
        if isinstance(e, bmesh.types.BMVert):
            e.co += Vector(d)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_barra(a, b, r):
    """Barra de seção quadrada (lado 2r) de a até b, sem tampas (treliças, grades)"""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)))
    if u.length < 1e-3:
        u = Vector((1, 0, 0))
    u.normalize()
    w = d.cross(u).normalized()
    bm = bmesh.new()
    # barras finas (gradis) em seção triangular: 6 triângulos em vez de 8
    cs = [(-1, -1), (1, -1), (1, 1), (-1, 1)] if r > 0.02 else [(0, 1.3), (-1.1, -0.7), (1.1, -0.7)]
    k = len(cs)
    va = [bm.verts.new(a + (u * x + w * y) * r) for x, y in cs]
    vb = [bm.verts.new(b + (u * x + w * y) * r) for x, y in cs]
    for i in range(k):
        bm.faces.new([va[i], va[(i + 1) % k], vb[(i + 1) % k], vb[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:   # recalc em malha aberta pode errar: confere contra o eixo
        c = f.calc_center_median()
        eixo = a + d * (c - a).dot(d)
        if f.normal.dot(c - eixo) < 0:
            f.normal_flip()
    return bm


def M_em(x, y, z=0.0, giro=0.0):
    """Matriz: gira em volta de z (radianos, anti-horário visto de cima) e leva para (x, y, z)"""
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(giro, 4, "Z")


# ———————————————————————————————————————————————— texturas geradas aqui

def atlas_esquadrias(n=256):
    """
    Atlas 256 × 256 de esquadrias (quatro quadrantes, V para cima como no Blender):
      A (0–0,5 × 0,5–1)  porta-janela do pavimento de cima: folhas verdes almofadadas e bandeira em arco de vidro escuro
      B (0,5–1 × 0,5–1)  janela do térreo: folhas verdes com grade de ferro na bandeira
      C (0–0,5 × 0–0,5)  porta principal: bandeira em leque sobre o vão escuro com as folhas de madeira abertas
      D (0,5–1 × 0–0,5)  fita genérica (anexo e casario): vidro escuro, caixilho claro a cada terço
    """
    px = [0.0] * (n * n * 4)

    def ret(x0, y0, x1, y1, cor):
        c = srgb_lin(cor)
        for y in range(max(0, int(y0)), min(n, int(y1))):
            for x in range(max(0, int(x0)), min(n, int(x1))):
                i = (y * n + x) * 4
                px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    h = n // 2
    verde, verde2, verde3 = "#2f5e45", "#3b7354", "#24493a"
    # A: porta-janela, 2 folhas, 3 almofadas cada; bandeira (25% de cima) escura com baguetes claras
    ret(0, h, h, n, "#e9dfc6")
    ret(4, h + 3, h - 4, n - 4, verde)
    for xa, xb in ((6, h // 2 - 2), (h // 2 + 2, h - 6)):
        for k in range(3):
            y0 = h + 6 + k * 24
            ret(xa + 3, y0, xb - 3, y0 + 18, verde2)
            ret(xa + 3, y0 + 15, xb - 3, y0 + 18, verde3)
    ret(h // 2 - 1, h + 3, h // 2 + 1, n - 34, "#1b3328")
    ret(4, n - 32, h - 4, n - 4, "#2c3b44")
    for k in range(5):
        x = 8 + k * (h - 16) / 4
        ret(x - 1, n - 32, x + 1, n - 4, "#d9d2bd")
    ret(4, n - 34, h - 4, n - 31, "#d9d2bd")
    # B: janela do térreo, folhas verdes e grade na bandeira
    ret(h, h, n, n, "#e9dfc6")
    ret(h + 4, h + 3, n - 4, n - 4, verde)
    for xa, xb in ((h + 6, h + h // 2 - 2), (h + h // 2 + 2, n - 6)):
        for k in range(2):
            y0 = h + 8 + k * 34
            ret(xa + 3, y0, xb - 3, y0 + 26, verde2)
            ret(xa + 3, y0 + 23, xb - 3, y0 + 26, verde3)
    ret(h + h // 2 - 1, h + 3, h + h // 2 + 1, n - 40, "#1b3328")
    ret(h + 4, n - 38, n - 4, n - 4, "#222a2e")
    for k in range(7):
        x = h + 8 + k * (h - 16) / 6
        ret(x - 1, n - 38, x + 1, n - 4, "#111416")
    # C: porta principal: vão escuro, folhas de madeira abertas nas laterais, bandeira em leque
    ret(0, 0, h, h, "#e9dfc6")
    ret(4, 3, h - 4, h - 4, "#2a2622")
    ret(4, 3, 16, h - 36, "#5a3b28")
    ret(h - 16, 3, h - 4, h - 36, "#5a3b28")
    ret(20, 3, h - 20, h - 40, "#3a3a38")
    ret(4, h - 36, h - 4, h - 33, "#d9d2bd")
    cx, cy = h / 2, h - 34
    for k in range(9):
        a = math.pi * k / 8
        for t in range(2, 30):
            x, y = cx + math.cos(a) * t * 1.95, cy + math.sin(a) * t
            ret(x - 1, y - 1, x + 1, y + 1, "#d9d2bd")
    # D: fita genérica
    ret(h, 0, n, h, "#ece6d8")
    for ci in range(3):
        x0, x1 = h + ci * h / 3 + 4, h + (ci + 1) * h / 3 - 3
        ret(x0, 8, x1, h - 8, "#3d4a55")
        ret(x0, h - 26, x1, h - 8, "#5f707e")
    img = bpy.data.images.new("Tex_Esquadrias", n, n, alpha=False)
    img.pixels.foreach_set(px)
    img.pack()
    return img


def uv_reg(reg, a, b):
    """UV dentro de um quadrante do atlas (a, b de 0 a 1), com 2 px de margem"""
    m = 2 / 256
    x0, y0 = {"A": (0.0, 0.5), "B": (0.5, 0.5), "C": (0.0, 0.0), "D": (0.5, 0.0)}[reg]
    return (x0 + m + (0.5 - 2 * m) * a, y0 + m + (0.5 - 2 * m) * b)


# atlas dos letreiros (desenhado em canvas no .tsx, 512 × 256): regiões em pixels, y para baixo
LETREIROS = {
    "brasao": (0, 0, 256, 256),
    "regiao": (256, 0, 512, 48),
    "bandeira": (256, 64, 384, 154),
}


def uv_letreiro(reg, a, b):
    x0, y0, x1, y1 = LETREIROS[reg]
    return ((x0 + (x1 - x0) * a) / 512, 1 - (y0 + (y1 - y0) * (1 - b)) / 256)


def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["grama"] = mat("Mat_Chao_Grama", "#6f9a47", 0.95)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#55595d", 0.95)
    M["faixa"] = mat("Mat_Chao_Faixa", "#efeee6", 0.8)
    M["amarela"] = mat("Mat_Chao_Faixa_Amarela", "#e2b63a", 0.8)
    M["calcada"] = mat("Mat_Chao_Calcada", "#c9c4b8", 0.9)
    M["pedra"] = mat("Mat_Chao_Paralelepipedo", "#9a948a", 0.95)
    M["lajota"] = mat("Mat_Chao_Lajota", "#dcd3c2", 0.85)
    M["rosa"] = mat("Mat_Parede_Rosa", "#b07f80", 0.85)
    M["creme"] = mat("Mat_Frisos_Creme", "#ebdfc4", 0.7)
    M["base"] = mat("Mat_Embasamento_Cinza", "#9c9a94", 0.9)
    M["telha"] = mat("Mat_Telha_Ceramica", "#b8634a", 0.8)
    M["cumeeira"] = mat("Mat_Telha_Cumeeira", "#c98a6c", 0.8)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.45, 0.0, atlas)
    M["muralha"] = mat("Mat_Muralha_Caiada", "#efeee8", 0.75)
    M["cordao"] = mat("Mat_Cordao_Pedra", "#d6d2c6", 0.8)
    M["grade"] = mat("Mat_Grade_Ferro", "#24282a", 0.5, 0.3)
    M["letreiros"] = mat("Mat_Letreiros", "#ffffff", 0.6)
    M["agua"] = mat("Mat_Agua", "#41b1dc", 0.08, 0.05)
    M["vao"] = M["grade"]       # vãos escuros e ferro dos canhões usam o mesmo ferro escuro do gradil
    M["ferro"] = M["grade"]
    M["madeira"] = mat("Mat_Madeira", "#6b4a33", 0.85)
    M["inox"] = mat("Mat_Aco_Inox", "#c9ced2", 0.35, 0.4)
    M["torre"] = mat("Mat_Torre_Vermelha", "#c0392b", 0.6)
    M["casario"] = mat("Mat_Casario", "#ffffff", 0.85)
    M["laje"] = M["cordao"]
    M["arbusto"] = mat("Mat_Arbusto", "#3f6d33", 0.9)
    M["corte"] = mat("Mat_Corte_Terreno", "#b59a74", 0.95)
    return M


# ———————————————————————————————————————————————— terreno em níveis

def regiao_cidade():
    """Tudo o que fica ao sul da face de fora da muralha norte (prolongada até fora do disco): o alto da colina"""
    norte = [(-300.0, 190.0)] + L_FORA + [(95.0, 23.0), (300.0, -10.0)]
    return ccw(TT(norte + [(300.0, -320.0), (-300.0, -320.0)]))


def regiao_alto():
    """Platô do forte: quadra do quartel, pátio murado, terraço e a faixa até a muralha de dentro"""
    pts = [Q_SE, (2.0, -80.0), (16.0, -85.0), (25.0, -60.0), (33.0, -41.0), (39.0, -24.0), (46.0, -16.0), (71.0, 16.0)]
    pts += L_DENTRO[::-1][1:]
    pts += [(-160.0, 90.0), (-140.0, 52.0)] + MURO_OESTE[1:] + [Q_SO1, Q_SO2]
    return ccw(TT(pts))


def regiao_meio():
    """Bateria inferior: entre a face de dentro e a de fora da muralha norte"""
    pts = L_DENTRO + [FIM_BATERIA[1]] + L_FORA[::-1] + [(-150.0, 120.0)]
    return ccw(TT([(-150.0, 100.0)] + pts))


def chao(M):
    """Disco da Leste-Oeste (embaixo), a colina da cidade com talude gramado na borda, a bateria, o platô e a esplanada"""
    base = Peca("Chao_Base")
    base.poli([(x, y, Z_BAIXO) for x, y in circulo(96, RAIO)], M["grama"], para=(0, 0, 1))
    c = circulo(96, RAIO)
    for i in range(96):
        a, b = c[i], c[(i + 1) % 96]
        base.poli([(a[0], a[1], 0.0), (b[0], b[1], 0.0), (b[0], b[1], Z_BAIXO), (a[0], a[1], Z_BAIXO)], M["corte"], para=(a[0] + b[0], a[1] + b[1], 0))
    base.criar(grade=(3.2,))

    cid = regiao_cidade()
    P = Peca("Chao_Colina")
    topo = recortar_no_disco(cid, R_PLATO)
    P.poli([(x, y, Z_RUA) for x, y in topo], M["calcada"], para=(0, 0, 1))
    # talude gramado da borda: só onde o alto da colina chega até o disco
    n = 96
    ci, ce = circulo(n, R_PLATO), circulo(n, RAIO - 0.02)
    dentro = [ponto_no_poligono((0.99 * (ci[i][0] + ci[(i + 1) % n][0]) / 2, 0.99 * (ci[i][1] + ci[(i + 1) % n][1]) / 2), cid) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        if not dentro[i]:
            continue
        P.poli([(ci[i][0], ci[i][1], Z_RUA), (ce[i][0], ce[i][1], Z_BAIXO), (ce[j][0], ce[j][1], Z_BAIXO), (ci[j][0], ci[j][1], Z_RUA)], M["grama"], para=(ci[i][0], ci[i][1], 3))
        for k, viz in ((i, dentro[i - 1]), (j, dentro[j])):
            if not viz:   # ponta do talude: fecha com um triângulo de terra
                P.poli([(ci[k][0], ci[k][1], Z_RUA), (ce[k][0], ce[k][1], Z_BAIXO), (ci[k][0], ci[k][1], Z_BAIXO)], M["corte"])
    P.criar(grade=(2.2,))

    def placa_nivel(nome, poli, z, m, z_corte):
        """Topo de um nível recortado no disco; onde o recorte encontra a borda, a face de corte desce até z_corte"""
        Q = Peca(nome)
        p = recortar_no_disco(poli, R_PLATO)
        if len(p) < 3:
            return None
        Q.poli([(x, y, z) for x, y in p], m, para=(0, 0, 1))
        for a, b in zip(p, p[1:] + p[:1]):
            if abs(math.hypot(*a) - R_PLATO) < 0.05 and abs(math.hypot(*b) - R_PLATO) < 0.05:
                Q.poli([(a[0], a[1], z_corte), (b[0], b[1], z_corte), (b[0], b[1], z), (a[0], a[1], z)], M["muralha"], para=(a[0] + b[0], a[1] + b[1], 0))
        return Q

    alto = placa_nivel("Chao_Plato_Forte", regiao_alto(), Z_ALTO, M["pedra"], Z_RUA)
    alto.criar(grade=(1.2,))
    meio = placa_nivel("Chao_Bateria", regiao_meio(), Z_MEIO, M["grama"], Z_RUA)
    meio.criar(grade=(1.2,))
    esp = placa_nivel("Chao_Esplanada", ccw(TT(ESPLANADA)), Z_ESP, M["calcada"], Z_RUA)
    # borda da esplanada para a praça e a Alberto Nepomuceno: arrimo caiado
    for tr in recortar_linha(TT(ESPLANADA)[7:11], R_PLATO):
        for a, b in zip(tr, tr[1:]):
            n_ = direita(a, b)      # o contorno da esplanada é horário: fora fica à esquerda
            esp.poli([(a[0], a[1], Z_RUA), (b[0], b[1], Z_RUA), (b[0], b[1], Z_ESP), (a[0], a[1], Z_ESP)], M["muralha"], para=(-n_[0], -n_[1], 0))
    esp.criar(grade=(1.2,))
    reservar(regiao_alto(), 0.0)
    return cid


def sobreposicoes(M):
    """Pisos desenhados por cima dos níveis: terraço do espelho d'água, Passeio Público, praça das velas"""
    P = Peca("Chao_Pisos")

    def piso(poli, z, m, r=R_PLATO - 0.05):
        p = recortar_no_disco(ccw(poli), r)
        if len(p) >= 3:
            P.poli([(x, y, z) for x, y in p], m, para=(0, 0, 1))
    piso(TT(TERRACO), Z_ALTO + 0.012, M["lajota"])
    piso(TT(PASSEIO), Z_RUA + 0.012, M["lajota"])
    piso(TT(PRACA_VELAS), Z_RUA + 0.012, M["grama"])
    P.criar(grade=(1.2,))


def faixa_poligono(eixo, larg):
    """Polígono de uma faixa de largura `larg` ao longo de uma polilinha (miniatura)"""
    e = offset_linha(eixo, larg / 2)
    d = offset_linha(eixo, -larg / 2)
    return ccw(e + d[::-1])


def ruas(M):
    """Ruas do entorno com calçadas, faixas pintadas e a rampa que sobe ao portão"""
    P = Peca("Ruas_Entorno")
    traj = {}

    def rua(nome, eixo_real, larg, z, m=M["asfalto"], calcada=0.0, tracejado=True, raio=R_PLATO - 0.05):
        eixo = TT(eixo_real)
        if calcada:
            p = recortar_no_disco(faixa_poligono(eixo, larg + 2 * calcada), raio)
            if len(p) >= 3:
                P.poli([(x, y, z + 0.006) for x, y in p], M["calcada"], para=(0, 0, 1))
        p = recortar_no_disco(faixa_poligono(eixo, larg), raio)
        if len(p) >= 3:
            P.poli([(x, y, z + 0.014) for x, y in p], m, para=(0, 0, 1))
        for tr in recortar_linha(eixo, raio - 0.4):
            if tracejado:
                for x, y, a in amostrar(tr, 1.1, 0.3):
                    u = (math.cos(a), math.sin(a))
                    v = (-u[1], u[0])
                    q = [(x - u[0] * 0.25 - v[0] * 0.05, y - u[1] * 0.25 - v[1] * 0.05), (x + u[0] * 0.25 - v[0] * 0.05, y + u[1] * 0.25 - v[1] * 0.05),
                         (x + u[0] * 0.25 + v[0] * 0.05, y + u[1] * 0.25 + v[1] * 0.05), (x - u[0] * 0.25 + v[0] * 0.05, y - u[1] * 0.25 + v[1] * 0.05)]
                    P.poli([(qx, qy, z + 0.02) for qx, qy in q], M["faixa"], para=(0, 0, 1))
        traj[nome] = eixo
        reservar(faixa_poligono(eixo, larg + 2 * calcada), 0.1)

    rua("joao_moreira", R_JOAO_MOREIRA, 2.5, Z_RUA, calcada=0.75)
    rua("bezerril", R_BEZERRIL, 2.0, Z_RUA, calcada=0.6)
    rua("floriano", R_FLORIANO, 2.0, Z_RUA, m=M["pedra"], tracejado=False)
    rua("nepomuceno", AV_NEPOMUCENO, 3.1, Z_RUA, calcada=0.6)
    rua("castelo", AV_CASTELO, 2.6, Z_BAIXO, calcada=0.7, raio=RAIO - 0.15)

    # pista da esplanada, ao longo do muro (via 276754773), sobre a calçada
    pista = recortar_no_disco(faixa_poligono(TT(PISTA_ESPLANADA), 1.7), R_PLATO - 0.05)
    if len(pista) >= 3:
        P.poli([(x, y, Z_ESP + 0.014) for x, y in pista], M["asfalto"], para=(0, 0, 1))
    traj["esplanada"] = TT(PISTA_ESPLANADA)
    # rampa: sobe da Dr. João Moreira ao portão, encostada ao muro do pátio
    r = TT(RAMPA)
    zs = [Z_RUA, Z_RUA + 0.08, Z_ESP, Z_ESP, Z_RUA]
    P.poli([(x, y, z + 0.014) for (x, y), z in zip(r, zs)], M["asfalto"], para=(0, 0, 1))
    # lado de fora da rampa: arrimo caiado até a altura do piso
    for i, j in ((3, 4),):
        a, b = r[i], r[j]
        n_ = direita(a, b)          # o contorno da rampa é horário: fora fica à esquerda
        P.poli([(a[0], a[1], Z_RUA), (b[0], b[1], Z_RUA), (b[0], b[1], zs[j] + 0.014), (a[0], a[1], zs[i] + 0.014)], M["muralha"], para=(-n_[0], -n_[1], 0))
    reservar(r, 0.1)
    P.criar(grade=(1.8,))
    return traj


# ———————————————————————————————————————————————— muralhas e muros

def muro_talude(P, linha, z0, z1, esp, talude, m, lado, parapeito=0.0, m_par=None, cordao=None):
    """
    Muro ao longo de uma polilinha (miniatura): a face de fora (lado = +1 direita, −1 esquerda) cai em talude de z1 a z0,
    avançando `talude` m na base; por cima, um parapeito vertical opcional. `cordao`: (z, avanço) do cordão de pedra.
    """
    if len(linha) < 2:
        return
    fora_topo = offset_linha(linha, lado * 0.0)
    fora_base = offset_linha(linha, lado * talude)
    dentro = offset_linha(linha, -lado * esp)
    for i in range(len(linha) - 1):
        a, b = fora_topo[i], fora_topo[i + 1]
        n_ = direita(a, b)
        n_ = (n_[0] * lado, n_[1] * lado)
        ab, bb = fora_base[i], fora_base[i + 1]
        P.poli([(ab[0], ab[1], z0), (bb[0], bb[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], m, para=(n_[0], n_[1], 0.2))
        di, dj = dentro[i], dentro[i + 1]
        ztopo = z1 + parapeito
        if parapeito > 0:
            P.poli([(a[0], a[1], z1), (b[0], b[1], z1), (b[0], b[1], ztopo), (a[0], a[1], ztopo)], m_par or m, para=(n_[0], n_[1], 0))
            P.poli([(di[0], di[1], z1), (dj[0], dj[1], z1), (dj[0], dj[1], ztopo), (di[0], di[1], ztopo)], m_par or m, para=(-n_[0], -n_[1], 0))
        # coroamento
        P.poli([(a[0], a[1], ztopo), (b[0], b[1], ztopo), (dj[0], dj[1], ztopo), (di[0], di[1], ztopo)], M_GLOBAL["cordao"] if parapeito > 0 else m, para=(0, 0, 1))
        if cordao:
            zc, av = cordao
            ca, cb = offset_linha(linha, lado * (av + talude * (z1 - zc) / max(z1 - z0, 1e-3))), None
            ta = offset_linha(linha, lado * (talude * (z1 - zc) / max(z1 - z0, 1e-3)))
            pa, pb = ca[i], ca[i + 1]
            qa, qb = ta[i], ta[i + 1]
            P.poli([(pa[0], pa[1], zc - 0.09), (pb[0], pb[1], zc - 0.09), (pb[0], pb[1], zc + 0.06), (pa[0], pa[1], zc + 0.06)], M_GLOBAL["cordao"], para=(n_[0], n_[1], 0))
            P.poli([(qa[0], qa[1], zc + 0.06), (qb[0], qb[1], zc + 0.06), (pb[0], pb[1], zc + 0.06), (pa[0], pa[1], zc + 0.06)], M_GLOBAL["cordao"], para=(0, 0, 1))
    # testeiras nas pontas
    for k, s in ((0, 1), (len(linha) - 1, -1)):
        a, d, b = fora_topo[k], dentro[k], fora_base[k]
        if math.hypot(*a) < RAIO - 0.3:
            t = (linha[k + s][0] - linha[k][0], linha[k + s][1] - linha[k][1]) if 0 <= k + s < len(linha) else (1, 0)
            P.poli([(b[0], b[1], z0), (a[0], a[1], z1 + parapeito), (d[0], d[1], z1 + parapeito), (d[0], d[1], z0)], m, para=(-t[0], -t[1], 0))


M_GLOBAL = {}


def muralhas(M):
    """
    Muralhas do forte (ref-3, vista da Leste-Oeste): face de fora caiada em talude, com cordão e parapeito, da avenida
    até a bateria; face de dentro, da bateria até o terrapleno; fim da bateria junto à esplanada; muro oeste do Passeio.
    """
    P = Peca("Muralhas_Forte")
    for tr in recortar_linha(TT(L_FORA + [(95.0, 23.0), (140.0, 15.0)]), RAIO - 0.1):
        # a face de fora fica à esquerda do sentido oeste → leste (para o norte, a avenida)
        muro_talude(P, tr, Z_BAIXO, Z_MEIO, 0.4, 0.45, M["muralha"], -1, parapeito=0.5, cordao=(Z_MEIO - 0.05, 0.08))
    for tr in recortar_linha(TT(L_DENTRO), RAIO - 0.1):
        muro_talude(P, tr, Z_MEIO, Z_ALTO, 0.35, 0.22, M["muralha"], -1, parapeito=0.5, cordao=(Z_ALTO - 0.04, 0.06))
    muro_talude(P, TT(FIM_BATERIA), Z_MEIO, Z_ALTO, 0.35, 0.0, M["muralha"], 1, parapeito=0.45)
    for tr in recortar_linha(TT(MURO_OESTE), RAIO - 0.1):
        muro_talude(P, tr, Z_RUA, Z_ALTO, 0.3, 0.18, M["muralha"], 1, parapeito=0.45)
    return P.criar(grade=(1.6, False))


def pilarete(P, M, x, y, z, giro, alto=0.72):
    """Pilarete branco do muro do pátio (ref-4): fuste quadrado, capitel e bola no remate"""
    P.juntar(bm_caixa(0.26, 0.26, alto), M["muralha"], M_em(x, y, z, giro))
    P.juntar(bm_caixa(0.34, 0.34, 0.07), M["muralha"], M_em(x, y, z + alto, giro))
    P.juntar(bm_caixa(0.18, 0.18, 0.08), M["muralha"], M_em(x, y, z + alto + 0.07, giro))
    P.juntar(bm_esfera(0.1, 6, 4), M["muralha"], Matrix.Translation((x, y, z + alto + 0.24)))


def grade_entre(P, M, a, b, z, alto=0.6):
    """Gradil preto entre dois pilaretes: três travessas e montantes finos"""
    for zz in (0.08, alto):
        P.juntar(bm_barra((a[0], a[1], z + zz), (b[0], b[1], z + zz), 0.018), M["grade"])
    l = math.hypot(b[0] - a[0], b[1] - a[1])
    k = max(1, int(l / 0.55))
    for i in range(1, k):
        p = lerp(a, b, i / k)
        P.juntar(bm_barra((p[0], p[1], z + 0.08), (p[0], p[1], z + alto), 0.012), M["grade"])


def guarita(P, M, x, y, z, giro):
    """Guarita do portão (ref-5): torrinha quadrada caiada, nicho em arco em cada face, cimalha e remate escalonado"""
    T_ = M_em(x, y, z, giro)
    P.juntar(bm_caixa(1.02, 1.02, 0.16, 0.03), M["muralha"], T_)
    P.juntar(bm_caixa(0.86, 0.86, 1.95, 0.04), M["muralha"], T_)
    P.juntar(bm_caixa(1.08, 1.08, 0.13, 0.03), M["muralha"], T_ @ Matrix.Translation((0, 0, 1.95)))
    P.juntar(bm_caixa(0.8, 0.8, 0.22, 0.03), M["muralha"], T_ @ Matrix.Translation((0, 0, 2.08)))
    P.juntar(bm_caixa(0.92, 0.92, 0.06, 0.0), M["cordao"], T_ @ Matrix.Translation((0, 0, 2.3)))
    for k in range(4):
        R = T_ @ Matrix.Rotation(k * math.pi / 2, 4, "Z")
        arco = [(-0.17, 0.75), (0.17, 0.75)] + [(0.17 * math.cos(math.pi * i / 6), 1.3 + 0.17 * math.sin(math.pi * i / 6)) for i in range(7)]
        pts = [tuple(R @ Vector((u, -0.435, v))) for u, v in arco]
        n = R.to_3x3() @ Vector((0, -1, 0))
        P.poli(pts, M["vao"], para=tuple(n))


def muro_patio(M):
    """
    Muro do pátio de estacionamento (ref-2, ref-4): talude caiado da rua até o platô, com pilaretes e gradil por cima;
    abre no portão, entre as duas guaritas. Também a mureta de pilaretes na beira de fora da rampa e da esplanada.
    """
    P = Peca("Muro_Patio")
    linha = TT(MURO_LESTE)
    g = T(PORTAO)
    # divide no portão
    ia = 2  # o portão fica no trecho (16,−85)→(25,−60)→(33,−41): é o vértice 3
    antes = linha[:4]
    depois = linha[3:]
    # recua 1,1 m de cada lado do portão
    def encurtar_fim(l, d):
        a, b = l[-2], l[-1]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        return l[:-1] + [lerp(a, b, 1 - d / L)]
    antes = encurtar_fim(antes, 1.1)
    depois = encurtar_fim(depois[::-1], 1.1)[::-1]
    for tr in (antes, depois):
        muro_talude(P, tr, Z_RUA, Z_ALTO, 0.3, 0.2, M["muralha"], 1, parapeito=0.18)
        L = comprimento(tr)
        n = max(1, round(L / 1.55))
        pts = [p for p in amostrar(tr, L / n)]
        if len(pts) < n + 1:
            pts.append((tr[-1][0], tr[-1][1], 0))
        for i, (x, y, a) in enumerate(pts):
            pilarete(P, M, x, y, Z_ALTO + 0.18, a)
            if i:
                grade_entre(P, M, pts[i - 1][:2], (x, y), Z_ALTO + 0.18)
    # guaritas nos dois lados do portão, voltadas para a rampa
    for tr, k in ((antes, -1), (depois, 0)):
        x, y = tr[k]
        a = math.atan2(depois[1][1] - antes[-2][1], depois[1][0] - antes[-2][0])
        x2, y2 = x - math.sin(a) * 0.05, y + math.cos(a) * 0.05
        guarita(P, M, x2, y2, Z_ESP if k == 0 else Z_ESP - 0.05, a)
    # piso do portão (da esplanada ao platô)
    q = [antes[-1], depois[0]]
    n_ = direita(antes[-1], depois[0])
    q3 = [(q[0][0], q[0][1], Z_ALTO + 0.01), (q[1][0], q[1][1], Z_ALTO + 0.01), (q[1][0] + n_[0] * 0.5, q[1][1] + n_[1] * 0.5, Z_ESP + 0.02), (q[0][0] + n_[0] * 0.5, q[0][1] + n_[1] * 0.5, Z_ESP + 0.02)]
    P.poli(q3, M["pedra"], para=(0, 0, 1))
    # mureta de pilaretes na beira de fora da rampa e na beira da esplanada sobre a praça
    r = TT(RAMPA)
    zs = [Z_RUA, Z_RUA + 0.08, Z_ESP, Z_ESP, Z_RUA]
    for i, j in ((3, 4),):
        L = math.hypot(r[j][0] - r[i][0], r[j][1] - r[i][1])
        n = max(1, round(L / 1.55))
        ant = None
        for k in range(n + 1):
            t = k / n
            x, y = lerp(r[i], r[j], t)
            z = zs[i] + (zs[j] - zs[i]) * t
            a = math.atan2(r[j][1] - r[i][1], r[j][0] - r[i][0])
            pilarete(P, M, x, y, z, a, 0.55)
            if ant:
                grade_entre(P, M, ant[:2], (x, y), min(z, ant[2]), 0.45)
            ant = (x, y, z)
    e = TT(ESPLANADA)
    for a, b in zip(e[8:10], e[9:11]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, round(L / 1.55))
        for k in range(n + 1):
            x, y = lerp(a, b, k / n)
            if math.hypot(x, y) < R_PLATO - 0.4:
                pilarete(P, M, x, y, Z_ESP, math.atan2(b[1] - a[1], b[0] - a[0]), 0.55)
    return P.criar(grade=(1.6, False))


# ———————————————————————————————————————————————— quartel do Comando

class Fachada:
    """Quadro local de uma fachada reta: u ao longo (da esquerda para a direita de quem olha de fora), v para cima, w para fora"""

    def __init__(self, a, b, fora_e_direita=True, z0=Z_ALTO):
        if not fora_e_direita:
            a, b = b, a
        # olhando de fora, a direita é a → b quando o lado de fora fica à direita de a → b
        self.a, self.b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
        d = self.b - self.a
        self.L = d.length
        self.t = d.normalized()
        self.n = Vector((self.t.y, -self.t.x, 0))
        # na convenção de quem olha de fora (de frente para −n), a direita é −(n girado): troca para ficar a → b
        if self.t.cross(Vector((0, 0, 1))).dot(self.n) < 0:
            self.n = -self.n
        self.z0 = z0
        # quem olha de fora vê a direita em t' = (−n.y, n.x)
        self.direita = Vector((-self.n.y, self.n.x, 0))
        if self.direita.dot(self.t) < 0:
            # o u cresce para a direita de quem olha: começa em b
            self.o = self.b
        else:
            self.o = self.a

    def p(self, u, v, w=0.0):
        return tuple(self.o + self.direita * u + Vector((0, 0, self.z0 + v)) + self.n * w)

    def M(self, u, v, w=0.0):
        giro = math.atan2(self.direita.y, self.direita.x)
        return Matrix.Translation(self.p(u, v, w)) @ Matrix.Rotation(giro, 4, "Z")


def arco_contorno(hw, v0, vm, n=7):
    """Contorno de um vão em arco pleno: largura 2·hw, peitoril em v0, nascença do arco em vm"""
    pts = [(-hw, v0), (hw, v0)]
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((hw * math.cos(a), vm + hw * math.sin(a)))
    return pts


def janela(P, M, F, u, v0, vm, hw, reg, sacada=False, moldura=0.075):
    """Vão em arco com moldura creme e esquadria do atlas; no pavimento de cima, sacada de ferro"""
    cont = arco_contorno(hw + moldura, v0 - moldura * 0.6, vm, 7)
    P.poli([F.p(u + x, y, 0.014) for x, y in cont], M["creme"], para=tuple(F.n))
    cont = arco_contorno(hw, v0, vm, 7)
    topo = vm + hw
    P.poli([F.p(u + x, y, 0.028) for x, y in cont], M["esquadrias"], [uv_reg(reg, (x + hw) / (2 * hw), (y - v0) / (topo - v0)) for x, y in cont], para=tuple(F.n))
    if sacada:
        P.juntar(bm_caixa(2 * hw + 0.34, 0.36, 0.07), M["creme"], F.M(u, v0 - 0.07, 0.18))
        for s in (-1, 1):
            P.juntar(bm_barra(F.p(u + s * (hw + 0.15), v0, 0.34), F.p(u + s * (hw + 0.15), v0 + 0.44, 0.34), 0.016), M["grade"])
            P.juntar(bm_barra(F.p(u + s * (hw + 0.15), v0 + 0.44, 0.02), F.p(u + s * (hw + 0.15), v0 + 0.44, 0.34), 0.016), M["grade"])
        P.juntar(bm_barra(F.p(u - hw - 0.15, v0 + 0.44, 0.34), F.p(u + hw + 0.15, v0 + 0.44, 0.34), 0.018), M["grade"])
        P.juntar(bm_barra(F.p(u - hw - 0.15, v0 + 0.1, 0.34), F.p(u + hw + 0.15, v0 + 0.1, 0.34), 0.014), M["grade"])
        k = 3
        for i in range(1, k):
            uu = u - hw - 0.15 + (2 * hw + 0.3) * i / k
            P.juntar(bm_barra(F.p(uu, v0, 0.34), F.p(uu, v0 + 0.44, 0.34), 0.012), M["grade"])


def anel_friso(P, poli, z0, z1, avanco, m, fora=True):
    """Friso em volta de um polígono anti-horário (cimalha, cordão, embasamento): face de frente, topo e fundo"""
    o = offset_poli(poli, avanco if fora else -avanco)
    for i in range(len(poli)):
        j = (i + 1) % len(poli)
        a, b, oa, ob = poli[i], poli[j], o[i], o[j]
        n_ = direita(a, b) if fora else tuple(-c for c in direita(a, b))
        P.poli([(oa[0], oa[1], z0), (ob[0], ob[1], z0), (ob[0], ob[1], z1), (oa[0], oa[1], z1)], m, para=(n_[0], n_[1], 0))
        P.poli([(a[0], a[1], z1), (b[0], b[1], z1), (ob[0], ob[1], z1), (oa[0], oa[1], z1)], m, para=(0, 0, 1))
        P.poli([(a[0], a[1], z0), (b[0], b[1], z0), (ob[0], ob[1], z0), (oa[0], oa[1], z0)], m, para=(0, 0, -1))


def quartel(M):
    """
    Quartel do Comando da 10ª Região Militar (ref-1, ref-2, ref-4, ref-5): quadra fechada de dois pavimentos em volta de
    um pátio, com a ala noroeste junto ao Passeio; paredes rosa-antigo, cordão, cimalha e pilastras creme, janelas em
    arco com folhas verdes e sacadas de ferro em cima, embasamento cinza que vira talude nas ruas do sul e do oeste;
    telhado cerâmico em quatro águas contínuas. Na fachada leste, o corpo central com o frontão escalonado "COMANDO".
    """
    P = Peca("Quartel_Comando")
    Z = Z_ALTO
    B = ccw(TT([Q_SE, Q_NE, Q_P, ALA_NE, ALA_NO, Q_SO1, Q_SO2]))      # contorno inteiro
    O = ccw(TT([Q_SE, Q_NE, Q_NO, Q_SO1, Q_SO2]))                      # quadra
    I = ccw(TT(PATIO))
    # ——— paredes de fora (rosa), com embasamento em talude até a rua no sul e no oeste
    for i in range(len(B)):
        a, b = B[i], B[(i + 1) % len(B)]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], Z), (b[0], b[1], Z), (b[0], b[1], Z + H_PAREDE), (a[0], a[1], Z + H_PAREDE)], M["rosa"], para=(n_[0], n_[1], 0))
    for i in range(len(I)):
        a, b = I[i], I[(i + 1) % len(I)]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], Z), (b[0], b[1], Z), (b[0], b[1], Z + H_PAREDE), (a[0], a[1], Z + H_PAREDE)], M["rosa"], para=(-n_[0], -n_[1], 0))
    # talude cinza do embasamento, da rua (sul, chanfro, oeste) até o platô
    sul_oeste = TT([ALA_NO, Q_SO1, Q_SO2, Q_SE])
    tal = offset_linha(sul_oeste, 0.3)         # ALA_NO→SO1→SO2→SE segue o contorno anti-horário: fora é à direita
    for i in range(len(sul_oeste) - 1):
        a, b, ta, tb = sul_oeste[i], sul_oeste[i + 1], tal[i], tal[i + 1]
        n_ = direita(a, b)
        P.poli([(ta[0], ta[1], Z_RUA), (tb[0], tb[1], Z_RUA), (b[0], b[1], Z + 0.05), (a[0], a[1], Z + 0.05)], M["base"], para=(n_[0], n_[1], 0.3))
    # frisos: embasamento, cordão entre pavimentos e cimalha
    anel_friso(P, B, Z, Z + 0.42, 0.05, M["base"])
    anel_friso(P, B, Z + H_PAV - 0.02, Z + H_PAV + 0.16, 0.07, M["creme"])
    anel_friso(P, B, Z + H_PAREDE - 0.36, Z + H_PAREDE, 0.13, M["creme"])
    anel_friso(P, I, Z + H_PAREDE - 0.3, Z + H_PAREDE, 0.1, M["creme"], fora=False)
    anel_friso(P, I, Z, Z + 0.3, 0.04, M["base"], fora=False)

    # ——— vãos de fora
    leste = None
    for i in range(len(B)):
        a, b = B[i], B[(i + 1) % len(B)]
        F = Fachada(a, b)
        L = F.L
        e_leste = math.hypot(a[0] - T(Q_SE)[0], a[1] - T(Q_SE)[1]) < 0.01
        e_sul = math.hypot(a[0] - T(Q_SO2)[0], a[1] - T(Q_SO2)[1]) < 0.01
        e_chanfro = math.hypot(a[0] - T(Q_SO1)[0], a[1] - T(Q_SO1)[1]) < 0.01
        if L < 1.0:
            continue
        if e_leste:
            leste = F
            centro, meia = L / 2, 1.45
            lado = (L - 2 * meia) / 2
            nb = 6
            us = [(k + 0.5) * lado / nb for k in range(nb)] + [L - (k + 0.5) * lado / nb for k in range(nb)]
        else:
            nb = max(1, round(L / 1.42))
            us = [(k + 0.5) * L / nb for k in range(nb)]
        sacada = e_leste or e_sul or e_chanfro
        for u in us:
            janela(P, M, F, u, 0.62, 1.78, 0.3, "B")
            janela(P, M, F, u, H_PAV + 0.32, H_PAV + 1.98, 0.3, "A", sacada=sacada)
        # pilastras creme nas quinas
        for u in (0.0, L):
            P.juntar(bm_caixa(0.5, 0.5, H_PAREDE - 0.05), M["creme"], F.M(u, 0.0, 0.0))
    # ——— corpo central da fachada leste (ref-5): avança, pilastras que passam da cimalha e o frontão escalonado
    F = leste
    c = F.L / 2
    P.juntar(bm_caixa(2.9, 0.3, H_PAREDE - 0.02), M["rosa"], F.M(c, 0.0, 0.0))
    for s in (-1, 1):
        P.juntar(bm_caixa(0.42, 0.44, H_PAREDE + 1.0), M["creme"], F.M(c + s * 1.24, 0.0, 0.05))
        P.juntar(bm_caixa(0.3, 0.34, 0.3), M["creme"], F.M(c + s * 1.24, H_PAREDE + 1.0, 0.05))
    # pilastras de canto também passam da cimalha (ref-4)
    for u in (0.0, F.L):
        P.juntar(bm_caixa(0.56, 0.56, H_PAREDE + 0.55), M["creme"], F.M(u, 0.0, 0.0))
        P.juntar(bm_caixa(0.4, 0.4, 0.3), M["creme"], F.M(u, H_PAREDE + 0.55, 0.0))
    # frontão escalonado com o brasão e "COMANDO" (o .tsx pinta no atlas de letreiros)
    v0, hw = H_PAREDE - 0.36, 1.03
    degraus = [(0.0, 1.03), (0.42, 0.86), (0.8, 0.69), (1.14, 0.52), (1.44, 0.36), (1.7, 0.2), (1.9, 0.0)]
    cont = [(-hw, 0.0), (hw, 0.0)]
    for k in range(len(degraus) - 1):
        z1, w1 = degraus[k + 1][0], degraus[k][1]
        cont += [(w1, z1)]
        if degraus[k + 1][1] > 0:
            cont += [(degraus[k + 1][1], z1)]
    esq = [(-x, z) for x, z in reversed(cont[2:])]
    cont = cont + esq
    limpo = []
    for q in cont:
        if not limpo or (abs(q[0] - limpo[-1][0]) > 1e-6 or abs(q[1] - limpo[-1][1]) > 1e-6):
            limpo.append(q)
    cont = limpo
    alto = degraus[-1][0]
    P.juntar(bm_poli_extrudado([F.p(c + x, v0 + z, 0.06) for x, z in cont], tuple(F.n * 0.2)), M["rosa"])
    P.poli([F.p(c + x, v0 + z, 0.275) for x, z in cont], M["letreiros"], [uv_letreiro("brasao", (x + hw) / (2 * hw), z / alto) for x, z in cont], para=tuple(F.n))
    # porta principal em arco com bandeira em leque, letreiro "10ª REGIÃO MILITAR" e escadaria
    cont = arco_contorno(0.62 + 0.1, 0.0, 2.05, 9)
    P.poli([F.p(c + x, y, 0.165) for x, y in cont], M["creme"], para=tuple(F.n))
    cont = arco_contorno(0.62, 0.0, 2.05, 9)
    P.poli([F.p(c + x, y, 0.18) for x, y in cont], M["esquadrias"], [uv_reg("C", (x + 0.62) / 1.24, y / 2.67) for x, y in cont], para=tuple(F.n))
    q = [(-1.0, H_PAV + 0.55), (1.0, H_PAV + 0.55), (1.0, H_PAV + 0.95), (-1.0, H_PAV + 0.95)]
    P.poli([F.p(c + x, y, 0.165) for x, y in q], M["letreiros"], [uv_letreiro("regiao", (x + 1) / 2, (y - H_PAV - 0.55) / 0.4) for x, y in q], para=tuple(F.n))
    for k in range(3):
        P.juntar(bm_caixa(3.3 - k * 0.2, 1.0 - k * 0.28, 0.13), M["cordao"], F.M(c, k * 0.12, 0.15 + (1.0 - k * 0.28) / 2))

    # ——— vãos do pátio interno (sem sacada, mais espaçados)
    for i in range(len(I)):
        a, b = I[i], I[(i + 1) % len(I)]
        F2 = Fachada(b, a)     # o lado de "fora" desta parede é o pátio
        nb = max(1, round(F2.L / 1.7))
        for k in range(nb):
            u = (k + 0.5) * F2.L / nb
            janela(P, M, F2, u, 0.62, 1.7, 0.27, "B")
            janela(P, M, F2, u, H_PAV + 0.45, H_PAV + 1.85, 0.27, "A")
        for u in (0.0, F2.L):
            P.juntar(bm_caixa(0.4, 0.4, H_PAREDE - 0.05), M["creme"], F2.M(u, 0.0, 0.0))

    # ——— telhado cerâmico: anel em quatro águas sobre a quadra e as águas da ala noroeste
    R = Peca("Quartel_Telhado")
    zb, zc = Z + H_PAREDE, Z + H_PAREDE + SUBIDA
    Oe = offset_poli(O, BEIRAL)
    Ie = offset_poli(I, -BEIRAL)
    mapa = [0, 1, 2, 3, 3]          # a quina chanfrada da quadra usa a mesma quina do pátio
    # O = [SE, NE, NO, SO1, SO2] e I = [SE, NE, NO, SO]: confere a ordem (as duas listas são anti-horárias a partir do SE)
    def mais_perto(p, lst):
        return min(range(len(lst)), key=lambda k: math.hypot(lst[k][0] - p[0], lst[k][1] - p[1]))
    io = [mais_perto(o, I) for o in O]
    Rg = [((O[k][0] + I[io[k]][0]) / 2, (O[k][1] + I[io[k]][1]) / 2) for k in range(len(O))]

    def uv_telha(p3, base_a, base_b):
        a, b = Vector((*base_a, 0)), Vector((*base_b, 0))
        t = (b - a).normalized()
        q = Vector((p3[0], p3[1], 0)) - a
        n = Vector((t.y, -t.x, 0))
        return (q.dot(t) / 1.6, (abs(q.dot(n)) ** 2 + (p3[2] - zb) ** 2) ** 0.5 / 1.2)

    for k in range(len(O)):
        j = (k + 1) % len(O)
        pts = [(Oe[k][0], Oe[k][1], zb), (Oe[j][0], Oe[j][1], zb), (Rg[j][0], Rg[j][1], zc), (Rg[k][0], Rg[k][1], zc)]
        R.poli(pts, M["telha"], [uv_telha(p, Oe[k], Oe[j]) for p in pts], para=(0, 0, 1))
        ik, ij = io[k], io[j]
        if ik != ij:
            pts = [(Rg[k][0], Rg[k][1], zc), (Rg[j][0], Rg[j][1], zc), (Ie[ij][0], Ie[ij][1], zb), (Ie[ik][0], Ie[ik][1], zb)]
        else:
            pts = [(Rg[k][0], Rg[k][1], zc), (Rg[j][0], Rg[j][1], zc), (Ie[ik][0], Ie[ik][1], zb)]
        R.poli(pts, M["telha"], [uv_telha(p, Ie[ik], Ie[ij] if ik != ij else Ie[(ik + 1) % 4]) for p in pts], para=(0, 0, 1))
        # testeira do beiral
        R.poli([(Oe[k][0], Oe[k][1], zb - 0.12), (Oe[j][0], Oe[j][1], zb - 0.12), (Oe[j][0], Oe[j][1], zb + 0.01), (Oe[k][0], Oe[k][1], zb + 0.01)], M["telha"], para=(*direita(O[k], O[j]), 0))
        R.poli([(O[k][0], O[k][1], zb - 0.12), (O[j][0], O[j][1], zb - 0.12), (Oe[j][0], Oe[j][1], zb - 0.12), (Oe[k][0], Oe[k][1], zb - 0.12)], M["creme"], para=(0, 0, -1))
        # cumeeira, espigões e rincões em telha mais clara
        R.juntar(bm_barra((Rg[k][0], Rg[k][1], zc + 0.03), (Rg[j][0], Rg[j][1], zc + 0.03), 0.07), M["cumeeira"])
        R.juntar(bm_barra((Oe[k][0], Oe[k][1], zb + 0.03), (Rg[k][0], Rg[k][1], zc + 0.03), 0.06), M["cumeeira"])
        R.juntar(bm_barra((Ie[io[k]][0], Ie[io[k]][1], zb + 0.03), (Rg[k][0], Rg[k][1], zc + 0.03), 0.06), M["cumeeira"])
    for k in range(len(I)):
        j = (k + 1) % len(I)
        R.poli([(Ie[k][0], Ie[k][1], zb - 0.12), (Ie[j][0], Ie[j][1], zb - 0.12), (Ie[j][0], Ie[j][1], zb + 0.01), (Ie[k][0], Ie[k][1], zb + 0.01)], M["telha"], para=(*[-c for c in direita(I[k], I[j])], 0))
    # ala noroeste: água oeste continua a da quadra, espigão ao norte, água leste com rincão até a quina reentrante
    Be = offset_poli(B, BEIRAL)
    def idx(p):
        return mais_perto(T(p), B)
    pP, pANE, pANO = Be[idx(Q_P)], Be[idx(ALA_NE)], Be[idx(ALA_NO)]
    oNO = Oe[2]
    rNO = Rg[2]
    meio_norte = ((T(ALA_NE)[0] + T(ALA_NO)[0]) / 2, (T(ALA_NE)[1] + T(ALA_NO)[1]) / 2)
    larg = math.hypot(T(ALA_NE)[0] - T(ALA_NO)[0], T(ALA_NE)[1] - T(ALA_NO)[1])
    ax = Vector((rNO[0] - meio_norte[0], rNO[1] - meio_norte[1], 0)).normalized()
    N0 = (meio_norte[0] + ax.x * larg / 2, meio_norte[1] + ax.y * larg / 2)
    for pts in ([(oNO[0], oNO[1], zb), (pANO[0], pANO[1], zb), (N0[0], N0[1], zc), (rNO[0], rNO[1], zc)],
                [(pANO[0], pANO[1], zb), (pANE[0], pANE[1], zb), (N0[0], N0[1], zc)],
                [(pANE[0], pANE[1], zb), (pP[0], pP[1], zb), (rNO[0], rNO[1], zc), (N0[0], N0[1], zc)]):
        R.poli(pts, M["telha"], [uv_telha(p, pts[0][:2], pts[1][:2]) for p in pts], para=(0, 0, 1))
    for a, b in ((pANO, pANE), (oNO, pANO), (pANE, pP)):
        n_ = direita(a, b)
        R.poli([(a[0], a[1], zb - 0.12), (b[0], b[1], zb - 0.12), (b[0], b[1], zb + 0.01), (a[0], a[1], zb + 0.01)], M["telha"], para=(n_[0], n_[1], 0))
    R.juntar(bm_barra((N0[0], N0[1], zc + 0.03), (rNO[0], rNO[1], zc + 0.03), 0.07), M["cumeeira"])
    for p in (pANO, pANE):
        R.juntar(bm_barra((p[0], p[1], zb + 0.03), (N0[0], N0[1], zc + 0.03), 0.06), M["cumeeira"])
    R.juntar(bm_barra((pP[0], pP[1], zb + 0.03), (rNO[0], rNO[1], zc + 0.03), 0.06), M["cumeeira"])
    reservar(B, 0.5)
    return P.criar(grade=(1.5, False)), R.criar(), leste


def torre_trelicada(M):
    """Torre treliçada de rádio no pátio interno, em faixas vermelhas e brancas (aparece nas aéreas ref-1 e ref-2)"""
    P = Peca("Torre_Radio")
    x, y = T((-9.0, -47.0))
    z0, H = Z_ALTO, 10.6
    nseg = 8
    def lado(z):
        return 0.5 - 0.34 * (z - z0) / H
    cantos = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for s in range(nseg):
        za, zb = z0 + H * s / nseg, z0 + H * (s + 1) / nseg
        m = M["torre"] if s % 2 == 0 else M["muralha"]
        la, lb = lado(za), lado(zb)
        pa = [(x + cx * la, y + cy * la, za) for cx, cy in cantos]
        pb = [(x + cx * lb, y + cy * lb, zb) for cx, cy in cantos]
        for i in range(4):
            j = (i + 1) % 4
            P.juntar(bm_barra(pa[i], pb[i], 0.035), m)
            P.juntar(bm_barra(pa[i], pb[j], 0.014), m)
            P.juntar(bm_barra(pa[j], pb[i], 0.014), m)
    P.juntar(bm_cilindro(0.025, 1.3, 6), M["inox"], Matrix.Translation((x, y, z0 + H)))
    P.juntar(bm_cilindro(0.16, 0.14, 10, r2=0.03), M["muralha"], Matrix.Translation((x + 0.18, y, z0 + H * 0.72)) @ Matrix.Rotation(math.radians(80), 4, "Y"))
    P.juntar(bm_caixa(1.4, 1.4, 0.1), M["laje"], Matrix.Translation((x, y, z0)))
    return P.criar(), (x, y)


def telhado_quatro_aguas(P, M, ret, zb, sub, m_parede, H, z0):
    """Volume retangular (ret: 4 cantos anti-horários) com paredes, fitas de janela e telhado de quatro águas"""
    for i in range(4):
        a, b = ret[i], ret[(i + 1) % 4]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], zb), (a[0], a[1], zb)], m_parede, para=(n_[0], n_[1], 0))
        F = Fachada(a, b, z0=z0)
        nb = max(1, round(F.L / 1.3))
        for k in range(nb):
            u = (k + 0.5) * F.L / nb
            for v0 in (0.35, H / 2 + 0.25):
                q = [(u - 0.28, v0), (u + 0.28, v0), (u + 0.28, v0 + 0.85), (u - 0.28, v0 + 0.85)]
                P.poli([F.p(x, y, 0.02) for x, y in q], M["esquadrias"], [uv_reg("D", (x - u + 0.28) / 0.56 / 3, (y - v0) / 0.85) for x, y in q], para=tuple(F.n))
    e = offset_poli(ret, 0.22)
    l01 = math.hypot(ret[1][0] - ret[0][0], ret[1][1] - ret[0][1])
    l12 = math.hypot(ret[2][0] - ret[1][0], ret[2][1] - ret[1][1])
    c = ((ret[0][0] + ret[2][0]) / 2, (ret[0][1] + ret[2][1]) / 2)
    if l01 >= l12:
        ax = Vector((ret[1][0] - ret[0][0], ret[1][1] - ret[0][1], 0)).normalized() * (l01 - l12) / 2
    else:
        ax = Vector((ret[2][0] - ret[1][0], ret[2][1] - ret[1][1], 0)).normalized() * (l12 - l01) / 2
    r1, r2 = (c[0] - ax.x, c[1] - ax.y), (c[0] + ax.x, c[1] + ax.y)
    for i in range(4):
        j = (i + 1) % 4
        mi = ((e[i][0] + e[j][0]) / 2, (e[i][1] + e[j][1]) / 2)
        # cada água sobe até o ponto da cumeeira mais perto do seu meio
        ra = min((r1, r2), key=lambda r: math.hypot(r[0] - e[i][0], r[1] - e[i][1]))
        rb = min((r1, r2), key=lambda r: math.hypot(r[0] - e[j][0], r[1] - e[j][1]))
        if ra == rb:
            pts = [(e[i][0], e[i][1], zb), (e[j][0], e[j][1], zb), (ra[0], ra[1], zb + sub)]
        else:
            pts = [(e[i][0], e[i][1], zb), (e[j][0], e[j][1], zb), (rb[0], rb[1], zb + sub), (ra[0], ra[1], zb + sub)]
        P.poli(pts, M["telha"], [((p[0] - e[i][0]) / 1.6 + (p[1] - e[i][1]) * 0.0, (p[2] - zb) / 0.6) for p in pts], para=(0, 0, 1))
        n_ = direita(e[i], e[j])
        P.poli([(e[i][0], e[i][1], zb - 0.1), (e[j][0], e[j][1], zb - 0.1), (e[j][0], e[j][1], zb + 0.01), (e[i][0], e[i][1], zb + 0.01)], M["telha"], para=(n_[0], n_[1], 0))
    P.juntar(bm_barra((r1[0], r1[1], zb + sub + 0.03), (r2[0], r2[1], zb + sub + 0.03), 0.06), M["cumeeira"])


def anexo(M):
    """Anexo de dois pavimentos ao norte do quartel (via 630998516; ref-3: casa caiada com telhado de quatro águas)"""
    P = Peca("Anexo_Norte")
    H = 3.7
    for r in (ANEXO_A, ANEXO_B):
        ret = ccw(TT(r))
        telhado_quatro_aguas(P, M, ret, Z_ALTO + H, 1.0, M["muralha"], H, Z_ALTO)
        anel_friso(P, ret, Z_ALTO + H - 0.22, Z_ALTO + H, 0.08, M["cordao"])
        reservar(ret, 0.4)
    return P.criar(grade=(1.5, False))


# ———————————————————————————————————————————————— terraço, canhões, praça das velas, mastros

def terraco(M):
    """
    Terrapleno do baluarte (ref-3): espelho d'água redondo com borda caiada e um pedestal no meio, estátua no pedestal
    (figura neutra: não achei foto de perto), canhões antigos apontando para o mar (o Commons tem a categoria dos canhões
    do forte; a posição é suposição) e bancos.
    """
    P = Peca("Terraco_Baluarte")
    agua = Peca("Espelho_Agua")
    x, y = T(ESPELHO)
    r = 4.6 * K
    P.juntar(bm_torno([(r + 0.18, Z_ALTO), (r + 0.18, Z_ALTO + 0.3), (r, Z_ALTO + 0.3), (r, Z_ALTO + 0.12)], 32), M["muralha"], Matrix.Translation((x, y, 0)))
    agua.juntar(bm_cilindro(r + 0.01, 0.2, 32), M["agua"], Matrix.Translation((x, y, Z_ALTO + 0.02)))
    P.juntar(bm_cilindro(0.22, 0.75, 10), M["muralha"], Matrix.Translation((x, y, Z_ALTO)))
    P.juntar(bm_caixa(0.36, 0.36, 0.1), M["cordao"], Matrix.Translation((x, y, Z_ALTO + 0.75)))
    reservar([(x + (r + 0.6) * math.cos(a), y + (r + 0.6) * math.sin(a)) for a in [i * math.pi / 6 for i in range(12)]], 0.0)
    sx, sy = T(ESTATUA)
    P.juntar(bm_caixa(0.55, 0.55, 0.8, 0.04), M["muralha"], Matrix.Translation((sx, sy, Z_ALTO)))
    P.juntar(bm_caixa(0.65, 0.65, 0.08), M["cordao"], Matrix.Translation((sx, sy, Z_ALTO + 0.8)))
    P.juntar(bm_cilindro(0.11, 0.62, 8, r2=0.08), M["ferro"], Matrix.Translation((sx, sy, Z_ALTO + 0.88)))
    P.juntar(bm_esfera(0.08, 8, 5), M["ferro"], Matrix.Translation((sx, sy, Z_ALTO + 1.58)))
    reservar([(sx - 0.6, sy - 0.6), (sx + 0.6, sy - 0.6), (sx + 0.6, sy + 0.6), (sx - 0.6, sy + 0.6)], 0.2)
    # canhões junto ao parapeito da muralha de dentro, apontando para o norte (o mar)
    lin = TT(L_DENTRO[-2:])
    for t in (0.3, 0.52, 0.74):
        px_, py_ = lerp(lin[0], lin[1], t)
        a, b = lin
        n_ = direita(a, b)       # à direita de oeste→leste é o sul (para dentro): o canhão fica 0,9 m para dentro
        cx, cy = px_ + n_[0] * 0.95, py_ + n_[1] * 0.95
        giro = math.atan2(-n_[1], -n_[0])
        Tc = M_em(cx, cy, Z_ALTO, giro)
        P.juntar(bm_caixa(0.75, 0.42, 0.26, 0.0), M["madeira"], Tc @ Matrix.Translation((0, 0, 0.12)))
        for s in (-1, 1):
            P.juntar(bm_cilindro(0.2, 0.07, 10), M["madeira"], Tc @ Matrix.Translation((0.1, s * 0.25, 0.2)) @ Matrix.Rotation(math.pi / 2, 4, "X") @ Matrix.Translation((0, 0, -0.035)))
        P.juntar(bm_cilindro(0.12, 1.15, 10, r2=0.085), M["ferro"], Tc @ Matrix.Translation((-0.25, 0, 0.42)) @ Matrix.Rotation(math.pi / 2 - 0.08, 4, "Y"))
        P.juntar(bm_esfera(0.075, 8, 5), M["ferro"], Tc @ Matrix.Translation((-0.32, 0, 0.42)))
    # bancos de alvenaria em volta do espelho
    for a in (0.6, 2.2, 3.8, 5.3):
        bx, by = x + (r + 1.1) * math.cos(a), y + (r + 1.1) * math.sin(a)
        P.juntar(bm_caixa(0.9, 0.3, 0.32, 0.0), M["cordao"], M_em(bx, by, Z_ALTO, a + math.pi / 2))
    agua.criar()
    return P.criar()


def praca_velas(M):
    """Praça a sudeste com a escultura de cones de aço (ref: Cmdo_10ª_Região_Militar.jpg): canteiro redondo com gradil"""
    P = Peca("Praca_Velas")
    x, y = T(VELAS)
    P.juntar(bm_torno([(1.3, Z_RUA), (1.3, Z_RUA + 0.18), (1.18, Z_RUA + 0.18), (1.18, Z_RUA + 0.1)], 24), M["cordao"], Matrix.Translation((x, y, 0)))
    P.juntar(bm_cilindro(1.19, 0.12, 24), M["arbusto"], Matrix.Translation((x, y, Z_RUA)))
    for k in range(16):
        a = 2 * math.pi * k / 16
        P.juntar(bm_barra((x + 1.42 * math.cos(a), y + 1.42 * math.sin(a), Z_RUA), (x + 1.42 * math.cos(a), y + 1.42 * math.sin(a), Z_RUA + 0.42), 0.015), M["grade"])
    for zz in (0.18, 0.42):
        P.juntar(bm_torno([(1.43, Z_RUA + zz - 0.02), (1.43, Z_RUA + zz + 0.02), (1.41, Z_RUA + zz + 0.02), (1.41, Z_RUA + zz - 0.02)], 24), M["grade"], Matrix.Translation((x, y, 0)))
    for dx, dy, h, inc in ((0.0, 0.25, 2.5, 0.05), (-0.4, -0.25, 2.0, -0.08), (0.42, -0.2, 1.7, 0.1)):
        P.juntar(bm_cilindro(0.34, h, 12, r2=0.0), M["inox"], Matrix.Translation((x + dx, y + dy, Z_RUA + 0.1)) @ Matrix.Rotation(inc, 4, "X"))
    reservar([(x + 1.6 * math.cos(a), y + 1.6 * math.sin(a)) for a in [i * math.pi / 6 for i in range(12)]], 0.1)
    return P.criar()


def mastros(M, F_leste):
    """Mastro branco de base redonda na frente da porta (ref-5) e mastro com a bandeira do Brasil junto ao portão"""
    P = Peca("Mastros_Bandeira")
    c = F_leste.L / 2
    bx, by, _ = F_leste.p(c, 0, 3.0)
    P.juntar(bm_cilindro(0.4, 0.5, 16), M["muralha"], Matrix.Translation((bx, by, Z_ALTO)))
    P.juntar(bm_cilindro(0.06, 5.6, 8, r2=0.035), M["muralha"], Matrix.Translation((bx, by, Z_ALTO + 0.5)))
    g = T(PORTAO)
    ext = direita(T((16.0, -85.0)), T((25.0, -60.0)))          # para fora do muro (leste)
    ao_longo = Vector((*T((33.0, -41.0)), 0)) - Vector((*g, 0))
    ao_longo.normalize()
    fx, fy = g[0] + ext[0] * 1.5 + ao_longo.x * 1.7, g[1] + ext[1] * 1.5 + ao_longo.y * 1.7
    P.juntar(bm_cilindro(0.18, 0.25, 10), M["cordao"], Matrix.Translation((fx, fy, Z_ESP)))
    P.juntar(bm_cilindro(0.045, 5.2, 8, r2=0.03), M["inox"], Matrix.Translation((fx, fy, Z_ESP + 0.25)))
    # bandeira dos dois lados (cada face com a imagem certa)
    w, h, z1 = 1.3, 0.91, Z_ESP + 5.35
    ang = math.radians(35)
    d = Vector((math.cos(ang), math.sin(ang), 0))
    o = Vector((fx, fy, 0)) + d * 0.05
    q = [o, o + d * w, o + d * w, o]
    pts = [(q[0].x, q[0].y, z1 - h), (q[1].x, q[1].y, z1 - h), (q[2].x, q[2].y, z1), (q[3].x, q[3].y, z1)]
    nrm = Vector((d.y, -d.x, 0))
    P.poli([tuple(Vector(p) + nrm * 0.005) for p in pts], M["letreiros"], [uv_letreiro("bandeira", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))], para=tuple(nrm))
    P.poli([tuple(Vector(p) - nrm * 0.005) for p in pts], M["letreiros"], [uv_letreiro("bandeira", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))], para=tuple(-nrm))
    return P.criar()


# ———————————————————————————————————————————————— casario e Passeio

def casario(M):
    """
    Casario da Rua Dr. João Moreira e da General Bezerril (OSM, com altura do cadastro): volumes baixos de platibanda,
    alturas bem comprimidas para não roubar a cena; cores pastel neutras (só sugeridas) postas nas cores de vértice.
    """
    P = Peca("Casario_Vizinho")
    tree = ET.parse(OSM).getroot()
    nos = {n.get("id"): n for n in tree.iter("node")}

    def m(n):
        return ((float(n.get("lon")) - LNG0) * math.cos(math.radians(LAT0)) * 111320, (float(n.get("lat")) - LAT0) * 110540)
    tons = ["#e9c98f", "#bfd3c8", "#e3b39e", "#d8cbb0", "#b7c8de", "#ead98c"]
    CORES.clear()
    k = 0
    for w in tree.iter("way"):
        tags = {x.get("k"): x.get("v") for x in w.iter("tag")}
        if "building" not in tags or w.get("id") in ("630998516",):
            continue
        pts = [m(nos[nd.get("ref")]) for nd in w.iter("nd") if nd.get("ref") in nos]
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts = pts[:-1]
        mp = ccw(TT(pts))
        if min(math.hypot(*q) for q in mp) > 28.0:
            continue
        p = recortar_no_disco(mp, R_PLATO - 0.3)
        if len(p) < 3 or abs(area2(p)) < 1.0:
            continue
        h = float(tags.get("height", 6.0))
        H = min(2.2, 0.8 + 0.1 * h)
        tom = tons[k % len(tons)]
        k += 1
        ini = len(P.bm.faces)
        P.poli([(x, y, Z_RUA + H) for x, y in p], M["laje"], para=(0, 0, 1))
        for i in range(len(p)):
            a, b = p[i], p[(i + 1) % len(p)]
            n_ = direita(a, b)
            P.poli([(a[0], a[1], Z_RUA), (b[0], b[1], Z_RUA), (b[0], b[1], Z_RUA + H + 0.2), (a[0], a[1], Z_RUA + H + 0.2)], M["casario"], para=(n_[0], n_[1], 0))
            F = Fachada(a, b, z0=Z_RUA)
            if F.L > 1.2 and math.hypot(*a) < R_PLATO - 0.5:
                nb = max(1, round(F.L / 1.1))
                for kk in range(nb):
                    u = (kk + 0.5) * F.L / nb
                    for v0 in [0.4 + 1.1 * j for j in range(int(H / 1.1))]:
                        q = [(u - 0.25, v0), (u + 0.25, v0), (u + 0.25, v0 + 0.6), (u - 0.25, v0 + 0.6)]
                        P.poli([F.p(x, y, 0.015) for x, y in q], M["esquadrias"], [uv_reg("D", (x - u + 0.25) / 0.5 / 3, (y - v0) / 0.6) for x, y in q], para=tuple(F.n))
        po = offset_poli(p, -0.15)
        for i in range(len(p)):
            j = (i + 1) % len(p)
            P.poli([(p[i][0], p[i][1], Z_RUA + H + 0.2), (p[j][0], p[j][1], Z_RUA + H + 0.2), (po[j][0], po[j][1], Z_RUA + H + 0.2), (po[i][0], po[i][1], Z_RUA + H + 0.2)], M["casario"], para=(0, 0, 1))
        CORES.append((ini, len(P.bm.faces), tom))
        reservar(p, 0.3)
    return P.criar()


CORES = []


def passeio(M):
    """Beira do Passeio Público (oeste): o gradil verde da praça e os bancos (as árvores vêm no layout)"""
    P = Peca("Passeio_Publico")
    for tr in recortar_linha(TT(GRADIL_PASSEIO), R_PLATO - 0.3):
        L = comprimento(tr)
        n = max(1, round(L / 1.2))
        pts = amostrar(tr, L / n)
        if len(pts) < n + 1:
            pts.append((tr[-1][0], tr[-1][1], 0))
        for i, (x, y, a) in enumerate(pts):
            P.juntar(bm_caixa(0.12, 0.12, 0.95), M["grade"], M_em(x, y, Z_RUA, a))
            if i:
                for zz in (0.12, 0.85):
                    P.juntar(bm_barra((pts[i - 1][0], pts[i - 1][1], Z_RUA + zz), (x, y, Z_RUA + zz), 0.02), M["grade"])
                for k in range(1, 3):
                    p = lerp(pts[i - 1][:2], (x, y), k / 3)
                    P.juntar(bm_barra((p[0], p[1], Z_RUA + 0.12), (p[0], p[1], Z_RUA + 0.85), 0.011), M["grade"])
    return P.criar()


# ———————————————————————————————————————————————— vegetação, carros e pessoas (layout para o .tsx)

ARVORES_OSM = {
    "patio": [(-13, -56), (-18, -53), (-26, -50), (-33, -47), (-39, -45), (-45, -43), (-50, -40), (-6, -41), (-12, -39), (-20, -36), (-27, -33), (-33, -30), (-39, -28), (-44, -26)],
    "norte": [(9, -19), (-6, -14), (-16, -10), (-25, -6), (37, -3), (40, 11)],
    "bateria": [(62, 21), (48, 22), (33, 25), (1, 16), (-8, 20), (-22, 26), (-40, 32), (-54, 49), (-61, 56)],
    "passeio": [(-79, 13), (-83, -9), (-89, 18), (-90, 10), (-87, -24), (-90, -38), (-71, 19), (-102, -16)],
    "praca": [(42, -63), (43, -41), (47, -51), (54, -55), (63, -58), (70, -45), (63, -24)],
}


def livre(x, y, r=0.0):
    if math.hypot(x, y) > RAIO - 0.5 - r * 0.6:
        return False
    for poli, folga in OCUPADO:
        if dist_poligono((x, y), poli) < folga + r * 0.5:
            return False
    return True


def nivel(x, y):
    """Altura do chão num ponto da miniatura"""
    if ponto_no_poligono((x, y), regiao_meio()):
        return Z_MEIO
    if ponto_no_poligono((x, y), regiao_alto()):
        return Z_ALTO
    if ponto_no_poligono((x, y), ccw(TT(ESPLANADA))):
        return Z_ESP
    if ponto_no_poligono((x, y), regiao_cidade()):
        return Z_RUA if math.hypot(x, y) <= R_PLATO else Z_RUA - (math.hypot(x, y) - R_PLATO) / (RAIO - R_PLATO) * (Z_RUA - Z_BAIXO)
    return Z_BAIXO


def layout(traj, leste, torre_xy):
    """Posições determinísticas (semente fixa) de árvores, coqueiros, carros e pessoas, em coordenadas do Blender"""
    rnd = random.Random(1812)    # ano dos alicerces do forte de pedra e cal
    arvores, coqueiros = [], []
    for x, y in ARVORES_OSM["patio"]:
        q = T((x, y))
        arvores.append((q[0], q[1], Z_ALTO, rnd.uniform(0.8, 0.95), rnd.uniform(1.5, 1.9)))
    for x, y in ARVORES_OSM["norte"]:
        q = T((x, y))
        arvores.append((q[0], q[1], Z_ALTO, rnd.uniform(0.9, 1.1), rnd.uniform(1.4, 1.8)))
    for i, (x, y) in enumerate(ARVORES_OSM["bateria"]):
        q = T((x, y))
        if math.hypot(*q) > RAIO - 1.0:
            continue
        if x > 20 or i % 2 == 0:
            coqueiros.append((q[0], q[1], nivel(*q), rnd.uniform(4.6, 5.6), rnd.uniform(0, 2 * math.pi)))
        else:
            arvores.append((q[0], q[1], nivel(*q), rnd.uniform(1.0, 1.3), rnd.uniform(1.2, 1.6)))
    # mais coqueiros na bateria do baluarte, como na ref-3
    for x, y in ((24, 26), (40, 24), (55, 22.5), (69, 22), (8, 14), (-14, 23)):
        q = T((x, y))
        if math.hypot(*q) < RAIO - 1.0:
            coqueiros.append((q[0], q[1], Z_MEIO, rnd.uniform(4.4, 5.4), rnd.uniform(0, 2 * math.pi)))
    for i, (x, y) in enumerate(ARVORES_OSM["passeio"]):
        q = T((x, y))
        if math.hypot(*q) > RAIO - 1.0:
            continue
        big = 2.3 if i == 0 else rnd.uniform(1.6, 2.0)   # o Benjamin (fícus) tombado é a copa maior
        arvores.append((q[0], q[1], Z_RUA, big, rnd.uniform(1.6, 2.2)))
    for x, y in ARVORES_OSM["praca"]:
        q = T((x, y))
        if math.hypot(*q) > RAIO - 1.0:
            continue
        arvores.append((q[0], q[1], nivel(*q), rnd.uniform(0.9, 1.2), rnd.uniform(1.2, 1.6)))
    # árvores de rua na Leste-Oeste (lado da praça, ao norte) e no Passeio, preenchendo
    tent = 0
    while tent < 4000:
        tent += 1
        x, y = rnd.uniform(-RAIO, RAIO), rnd.uniform(-RAIO, RAIO)
        r = rnd.uniform(1.1, 1.6)
        no_passeio = ponto_no_poligono((x, y), ccw(TT(PASSEIO)))
        no_norte = nivel(x, y) == Z_BAIXO and math.hypot(x, y) > 27.0
        if not (no_passeio or no_norte):
            continue
        if not livre(x, y, r):
            continue
        if any(math.hypot(x - a[0], y - a[1]) < 0.8 * (r + a[3]) for a in arvores):
            continue
        arvores.append((x, y, nivel(x, y), r, rnd.uniform(1.2, 1.8)))
        if sum(1 for a in arvores if a[2] == Z_BAIXO) > 9 and sum(1 for a in arvores if ponto_no_poligono(a[:2], ccw(TT(PASSEIO)))) > 12:
            break

    carros = []
    ESTAC = ccw(TT([(2, -80), (11, -55), (21, -30), (8, -25), (-21, -14), (-17, -3), (-13, 7), (46, -16), (39, -24), (33, -41), (25, -60), (16, -85)]))
    # pátio murado: vagas a 45–90° ao longo do muro leste e da fachada norte (ref-2)
    corredor = TT([(-10, -6), (26, -19), (28, -20), (30, -22), (30, -25), (29, -30), (18, -58), (9, -80)])
    porta = leste.p(leste.L / 2, 0, 1.5)
    for lado in (1, -1):
        for x, y, a in amostrar(corredor, 0.95, 0.4):
            n_ = (math.sin(a) * lado, -math.cos(a) * lado)
            cx, cy = x + n_[0] * 1.55, y + n_[1] * 1.55
            if math.hypot(cx - porta[0], cy - porta[1]) < 2.6 or rnd.random() < 0.28:
                continue
            if not ponto_no_poligono((cx, cy), ESTAC) or dist_borda((cx, cy), ccw(TT([Q_SE, Q_NE, Q_P, ALA_NE, ALA_NO, Q_SO1, Q_SO2]))) < 1.2:
                continue
            if dist_borda((cx, cy), TT(MURO_LESTE), False) < 0.6 or any(math.hypot(cx - c[0], cy - c[1]) < 0.9 for c in carros):
                continue
            carros.append((cx, cy, Z_ALTO, math.atan2(n_[1], n_[0]), rnd.randrange(8)))
    # vagas da esplanada de fora (relação 8778671), à direita da pista
    espl = ccw(TT(ESPLANADA))
    for x, y, a in amostrar(traj["esplanada"], 0.95, 0.5):
        n_ = (math.sin(a), -math.cos(a))
        cx, cy = x + n_[0] * 1.75, y + n_[1] * 1.75
        if rnd.random() < 0.35 or not ponto_no_poligono((cx, cy), espl) or math.hypot(cx, cy) > R_PLATO - 1.0:
            continue
        if any(math.hypot(cx - c[0], cy - c[1]) < 0.9 for c in carros):
            continue
        carros.append((cx, cy, Z_ESP, math.atan2(n_[1], n_[0]), rnd.randrange(8)))
    # faixas amarelas das vagas
    # ruas: Dr. João Moreira (para oeste), Alberto Nepomuceno (para o sul), Castelo Branco (para leste)
    for nome, sentido, z, passo in (("joao_moreira", 1, Z_RUA, (3.5, 7.0)), ("nepomuceno", 1, Z_RUA, (3.0, 6.0)), ("castelo", 1, Z_BAIXO, (3.0, 6.5))):
        eixo = traj[nome]
        for desl in ((-0.6, 0.6) if nome != "nepomuceno" else (-1.0, 0.0, 1.0)):
            linha = offset_linha(eixo, desl)
            s = rnd.uniform(0.5, 3.0)
            L = comprimento(linha)
            while s < L:
                pts = amostrar(linha, 1e9, s)
                if not pts:
                    break
                x, y, a = pts[0]
                lim = (RAIO - 1.2) if z == Z_BAIXO else (R_PLATO - 1.0)
                if math.hypot(x, y) < lim:
                    carros.append((x, y, z + 0.02, a, rnd.randrange(8)))
                s += rnd.uniform(*passo)
    pessoas = []
    gx, gy = T(PORTAO)
    for dx, dy in ((0.5, -1.4), (0.3, 1.2)):
        pessoas.append((gx + dx, gy + dy, Z_ESP, rnd.uniform(0, 2 * math.pi), 6))   # soldados de guarda (farda verde-oliva)
    zonas = [(T(ESPELHO), 2.6, 5, Z_ALTO), (porta[:2], 1.6, 3, Z_ALTO), (T((-80, 0)), 2.5, 4, Z_RUA), (T((40, -70)), 1.5, 2, Z_RUA), (T((-30, -66)), 3.0, 3, Z_RUA)]
    for (cx, cy), raio, n, z in zonas:
        k, tent = 0, 0
        while k < n and tent < 200:
            tent += 1
            a, d = rnd.uniform(0, 2 * math.pi), raio * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if math.hypot(x - T(ESPELHO)[0], y - T(ESPELHO)[1]) < 4.6 * K + 0.5:
                continue
            pessoas.append((x, y, nivel(x, y), rnd.uniform(0, 2 * math.pi), rnd.randrange(6)))
            k += 1
    return arvores, coqueiros, carros, pessoas


def faixas_vagas(M, carros):
    """Faixas amarelas das vagas do pátio murado (ref-2), uma de cada lado de cada carro"""
    P = Peca("Patio_Faixas")
    for x, y, z, g, _ in carros:
        if abs(z - Z_ALTO) > 0.01 and abs(z - Z_ESP) > 0.01:
            continue
        u = (math.cos(g), math.sin(g))
        v = (-u[1], u[0])
        for s in (-1, 1):
            cx, cy = x + v[0] * s * 0.5, y + v[1] * s * 0.5
            q = [(cx - u[0] * 0.9 - v[0] * 0.03, cy - u[1] * 0.9 - v[1] * 0.03), (cx + u[0] * 0.9 - v[0] * 0.03, cy + u[1] * 0.9 - v[1] * 0.03),
                 (cx + u[0] * 0.9 + v[0] * 0.03, cy + u[1] * 0.9 + v[1] * 0.03), (cx - u[0] * 0.9 + v[0] * 0.03, cy - u[1] * 0.9 + v[1] * 0.03)]
            P.poli([(a, b, z + (0.012 if z > Z_ESP + 0.01 else 0.02)) for a, b in q], M["amarela" if z > Z_ESP + 0.01 else "faixa"], para=(0, 0, 1))
    return P.criar()


def proxies(arvores, coqueiros, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, z, r, h in arvores:
        bm = bm_esfera(1.0, 8, 5)
        bm.transform(Matrix.Diagonal((r, r, r * 0.8, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, z + h + r * 0.8)))
        P.juntar(bm_cilindro(0.14, h + 0.3, 6), m, Matrix.Translation((x, y, z)))
    for x, y, z, h, g in coqueiros:
        P.juntar(bm_cilindro(0.13, h, 6), m, Matrix.Translation((x, y, z)))
        bm = bm_esfera(1.0, 8, 5)
        bm.transform(Matrix.Diagonal((1.5, 1.5, 0.5, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, z + h)))
    for x, y, z, g, _ in carros:
        P.juntar(bm_caixa(1.75, 0.8, 0.65, 0.1), m, M_em(x, y, z + 0.1, g))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada

def assar(objs, proxy):
    """Oclusão de ambiente (Cycles, CPU) em cor de vértice por canto; média por vértice, degraus de 1/40 e tinta do casario"""
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 96
    if cena.world is None:
        cena.world = bpy.data.worlds.new("Mundo")
    cena.world.light_settings.distance = 2.4
    cena.render.bake.target = "VERTEX_COLORS"
    for ob in objs:
        me = ob.data
        at = me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = at
        try:
            me.color_attributes.render_color_index = me.color_attributes.find("AO")
        except AttributeError:
            pass
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
    bpy.data.objects.remove(proxy)
    for ob in objs:
        me = ob.data
        at = me.color_attributes["AO"]
        forca = 0.55 if ob.name.startswith(("Chao", "Ruas")) else 0.45
        dados = [0.0] * (len(at.data) * 4)
        at.data.foreach_get("color", dados)
        soma, cont = {}, {}
        for lp in me.loops:
            soma[lp.vertex_index] = soma.get(lp.vertex_index, 0.0) + dados[lp.index * 4]
            cont[lp.vertex_index] = cont.get(lp.vertex_index, 0) + 1
        tinta = {}
        if ob.name == "Casario_Vizinho":
            for ini, fim, tom in CORES:
                c = [x ** (1 / 2.2) for x in srgb_lin(tom)]   # cor de vértice do byte é sRGB
                for fi in range(ini, min(fim, len(me.polygons))):
                    tinta[fi] = c
        for poly in me.polygons:
            tt = tinta.get(poly.index, (1.0, 1.0, 1.0))
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                ao = soma[vi] / cont[vi]
                v = 1.0 - forca * (1.0 - ao) ** 1.1
                v = round(v * 40) / 40
                dados[li * 4:li * 4 + 4] = [v * tt[0], v * tt[1], v * tt[2], 1.0]
        at.data.foreach_set("color", dados)


# ———————————————————————————————————————————————— principal

def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    M_GLOBAL.update(M)
    chao(M)
    sobreposicoes(M)
    traj = ruas(M)
    muralhas(M)
    muro_patio(M)
    q, telhado, leste = quartel(M)
    torre, txy = torre_trelicada(M)
    reservar([(txy[0] - 0.8, txy[1] - 0.8), (txy[0] + 0.8, txy[1] - 0.8), (txy[0] + 0.8, txy[1] + 0.8), (txy[0] - 0.8, txy[1] + 0.8)], 0.2)
    anexo(M)
    terraco(M)
    praca_velas(M)
    mastros(M, leste)
    casario(M)
    passeio(M)
    arvores, coqueiros, carros, pessoas = layout(traj, leste, txy)
    faixas_vagas(M, carros)
    print(f"árvores {len(arvores)}, coqueiros {len(coqueiros)}, carros {len(carros)}, pessoas {len(pessoas)}")
    prox = proxies(arvores, coqueiros, carros)
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name != prox.name]
    # UV planar dos pisos (para a textura manchada do .tsx): u = x/67 + 0,5; v = y/67 + 0,5
    for ob in objs:
        if not ob.name.startswith(("Chao", "Ruas")):
            continue
        me = ob.data
        uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
        for lp in me.loops:
            co = me.vertices[lp.vertex_index].co
            uv.data[lp.index].uv = (co.x / 67 + 0.5, co.y / 67 + 0.5)
    if not SEM_BAKE:
        assar(objs, prox)
    else:
        bpy.data.objects.remove(prox)
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32), keep_sharp_edges=True)
    for nome in list(bpy.data.materials.keys()):
        if nome.startswith("Mat_Proxy"):
            bpy.data.materials.remove(bpy.data.materials[nome])
    arq = os.path.join(SAIDA, "forteAssuncao-forte.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    dados = {
        "arvores": [[round(x, 3), round(z, 3), round(-y, 3), round(r, 3), round(h, 3)] for x, y, z, r, h in arvores],
        "coqueiros": [[round(x, 3), round(z, 3), round(-y, 3), round(h, 3), round(g, 3)] for x, y, z, h, g in coqueiros],
        "carros": [[round(x, 3), round(z, 3), round(-y, 3), round(g, 4), k] for x, y, z, g, k in carros],
        "pessoas": [[round(x, 3), round(z, 3), round(-y, 3), round(g, 3), k] for x, y, z, g, k in pessoas],
    }
    with open(os.path.join(SAIDA, "forteAssuncao-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    nobj = sum(1 for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, {nobj} objetos, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
