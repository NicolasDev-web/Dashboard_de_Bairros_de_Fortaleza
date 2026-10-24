# -*- coding: utf-8 -*-
"""
Passeio Público (Praça dos Mártires), a praça mais antiga de Fortaleza, em miniatura: gera as peças estáticas no Blender
e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/passeioPublico.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/passeioPublico.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o PasseioPublico.tsx carrega as duas):
    passeioPublico-praca.glb     terreno nos três planos, praça (pisos, gradil, mureta da Caio Prado, fonte, estátuas,
                                 bustos, baobá, Café Passeio), 2º plano do Exército, Leste-Oeste, a beira do quartel do
                                 Forte, a Santa Casa e o casario (sem compressão, com a oclusão assada nas cores de vértice)
    passeioPublico-layout.json   árvores, palmeiras, postes, bancos, mesas do café, carros e pessoas (o .tsx instancia),
                                 já em coordenadas do three

Recorte (pesquisa/passeioPublico/ficha.md): a praça é um retângulo de ~140 × 70 m com o lado maior a 108°; a borda
norte (a Avenida Caio Prado) olha para o mar, e o terreno desce em dois degraus até a Leste-Oeste: o 2º plano (hoje do
Exército) e o 3º, onde passa a avenida. Para caber no disco, a planta real é encolhida em eixos alinhados com a praça
(u ao longo do lado maior, v para o mar): a praça fica com K ≈ 0,34 × 0,41 e ocupa o meio do disco; as ruas e os
vizinhos (Santa Casa a oeste, quartel do Forte a leste, casario ao sul) entram mais comprimidos; o 2º plano e a avenida
ficam numa faixa ao norte. Tudo é modelado nesse quadro local e girado −18° no fim (norte real em −z no three).
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
OSM = os.path.join(AQUI, "..", "pesquisa", "passeioPublico", "osm.xml")
SEM_BAKE = "--sem-bake" in sys.argv
LAT0, LNG0 = -3.7226365, -38.5263038

RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
R_PLATO = 31.4       # até aqui o chão da cidade é plano; daí cai num talude gramado até a borda
GIRO = math.radians(-18.0)   # quadro local (u ao longo da praça) → mundo: o lado maior real está a 108°

# ——— níveis (m, já na miniatura): os três planos descem para o mar
Z_AV = 0.10          # 3º plano: Leste-Oeste (Av. Pres. Castelo Branco)
Z_2P = 1.05          # 2º plano: hoje área do Exército
Z_RUA = 2.00         # ruas do Centro (Dr. João Moreira, Barão do Rio Branco, Floriano Peixoto), no alto da colina
Z_PRACA = 2.14       # 1º plano: o chão da praça, um degrau acima da calçada, dentro da mureta do gradil
Z_FORTE = 3.20       # platô do forte (o mesmo desnível de 1,2 m do modelo do Forte)

# ——— eixos alinhados com a praça: u (rumo 108°) e v (rumo 18°, para o mar)
EU = (math.sin(math.radians(108)), math.cos(math.radians(108)))
EV = (math.sin(math.radians(18)), math.cos(math.radians(18)))
# compressão por faixas (m reais → m na miniatura); entre os nós é linear
FU = [(-260.0, -44.0), (-85.0, -28.3), (-70.5, -24.0), (70.0, 24.0), (83.0, 27.6), (97.0, 31.7), (260.0, 44.0)]
FV = [(-260.0, -44.0), (-52.0, -24.0), (-34.0, -18.0), (34.0, 10.0), (86.0, 19.3), (122.0, 28.6), (260.0, 44.0)]


def faixas(tab, x):
    for (a, fa), (b, fb) in zip(tab, tab[1:]):
        if x <= b:
            return fa + (fb - fa) * (x - a) / (b - a)
    (a, fa), (b, fb) = tab[-2], tab[-1]
    return fa + (fb - fa) * (x - a) / (b - a)


def T(p):
    """Planta real (m em volta do ponto do tour) → miniatura no quadro local da praça"""
    u = p[0] * EU[0] + p[1] * EU[1]
    v = p[0] * EV[0] + p[1] * EV[1]
    return (faixas(FU, u), faixas(FV, v))


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


def circulo(n=96, r=RAIO, c=(0.0, 0.0)):
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def recortar_convexo(poli, janela):
    """Sutherland–Hodgman de um polígono contra uma janela convexa anti-horária"""
    saida = list(poli)
    n = len(janela)
    for i in range(n):
        a, b = janela[i], janela[(i + 1) % n]
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
    limpo = []
    for q in saida:
        if not limpo or math.hypot(q[0] - limpo[-1][0], q[1] - limpo[-1][1]) > 1e-4:
            limpo.append(q)
    if len(limpo) > 1 and math.hypot(limpo[0][0] - limpo[-1][0], limpo[0][1] - limpo[-1][1]) < 1e-4:
        limpo.pop()
    return limpo


def recortar_no_disco(poli, r=RAIO, n=96):
    return recortar_convexo(poli, circulo(n, r))


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


def dist_borda(p, poli, fechado=True):
    m = 1e9
    pares = list(zip(poli, poli[1:] + poli[:1])) if fechado else list(zip(poli, poli[1:]))
    for a, b in pares:
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1)))
        m = min(m, math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    return m


def dist_poligono(p, poli):
    """Distância de p à borda do polígono (0 se dentro)"""
    if ponto_no_poligono(p, poli):
        return 0.0
    return dist_borda(p, poli)


def ponto_mais_perto(p, linha):
    """Ponto mais perto de p numa polilinha, com a distância"""
    melhor = (1e9, None)
    for a, b in zip(linha, linha[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1)))
        q = (a[0] + t * dx, a[1] + t * dy)
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if d < melhor[0]:
            melhor = (d, q)
    return melhor


def casco(pts):
    """Fecho convexo anti-horário (monotone chain)"""
    p = sorted(set((round(x, 6), round(y, 6)) for x, y in pts))
    if len(p) < 3:
        return p
    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    baixo, cima = [], []
    for q in p:
        while len(baixo) >= 2 and cruz(baixo[-2], baixo[-1], q) <= 0:
            baixo.pop()
        baixo.append(q)
    for q in reversed(p):
        while len(cima) >= 2 and cruz(cima[-2], cima[-1], q) <= 0:
            cima.pop()
        cima.append(q)
    return baixo[:-1] + cima[:-1]


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


def no_comprimento(pts, s):
    """Ponto (x, y, ângulo) a uma distância s do começo da polilinha"""
    acum = 0.0
    for a, b in zip(pts, pts[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        if s <= acum + l or b is pts[-1]:
            t = max(0.0, min(1.0, (s - acum) / l if l else 0))
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, math.atan2(b[1] - a[1], b[0] - a[0]))
        acum += l
    a, b = pts[-2], pts[-1]
    return (b[0], b[1], math.atan2(b[1] - a[1], b[0] - a[0]))


def faixa_poligono(eixo, larg):
    """Polígono de uma faixa de largura `larg` ao longo de uma polilinha (miniatura)"""
    e = offset_linha(eixo, larg / 2)
    d = offset_linha(eixo, -larg / 2)
    return ccw(e + d[::-1])


# zonas onde não nasce árvore nem carro (miniatura)
OCUPADO = []   # (polígono, folga)


def reservar(poli, folga=0.4):
    OCUPADO.append((poli, folga))


def reservar_circulo(c, r, folga=0.2):
    reservar(circulo(12, r, c), folga)


# ———————————————————————————————————————————————— planta real (OSM, ver ficha)

def ler_osm():
    tree = ET.parse(OSM).getroot()
    nos = {}
    for n in tree.iter("node"):
        nos[n.get("id")] = ((float(n.get("lon")) - LNG0) * math.cos(math.radians(LAT0)) * 111320,
                            (float(n.get("lat")) - LAT0) * 110540,
                            {t.get("k"): t.get("v") for t in n.iter("tag")})
    vias = {}
    for w in tree.iter("way"):
        pts = [nos[nd.get("ref")][:2] for nd in w.iter("nd") if nd.get("ref") in nos]
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts = pts[:-1]        # vias fechadas: sem o ponto repetido
        vias[w.get("id")] = (pts, {t.get("k"): t.get("v") for t in w.iter("tag")})
    return nos, vias


NOS, VIAS = ler_osm()


def via(i):
    return VIAS[i][0]


# gradil (via 24439917) e borda norte (muro 630998537 e linha 630998535): a praça
GRADIL_REAL = via("24439917")                               # NO → O → SO → S → SE → L → NE
PRACA_REAL = GRADIL_REAL + [(43.5, 22.2)]
PORTOES_REAL = [(-68.7, 15.2), (-4.4, -36.8), (63.6, -29.8)]   # oeste, sul, leste (nós barrier=gate)
FONTE_REAL = (3.0, -17.2)                                   # via 630998502, Ø ≈ 6,9 m
# baobá: três nós a ≤ 15 m (o de espécie e data, o "Baobá" nomeado e o tombado); usa o centro dos três
BAOBA_REAL = ((-0.2 - 7.0 - 21.3) / 3, (-26.3 - 16.1 - 27.9) / 3)
CAFE_REAL = via("630998504")
QUIOSQUE_REAL = via("630998506")
PISO_CAFE_REAL = via("630998479")
TOMBADAS = {   # nós denotation=natural_monument (Decreto 12.227/97): espécie → tipo de copa no .tsx
    "Benjamin": 2, "Jucazeiro": 0, "Mungubeira": 1, "Oiticica": 0, "Oitizeiro": 0, "Pau d'Arco Roxo": 1, "Timbaúba": 1,
}
# caminhos: (via, largura na miniatura, material)
CAMINHOS = [
    ("630998495", 2.1, "caminho"),    # corredor principal, do portão oeste ao leste
    ("630998487", 1.5, "caminho"),    # alameda norte
    ("937444724", 1.9, "concreto"),   # Avenida Caio Prado (nome comemorativo, placa no local)
    ("630998489", 1.25, "concreto"),  # contorno sul e oeste
    ("937444723", 1.25, "concreto"),  # contorno leste e sudeste
    ("630998485", 1.15, "caminho"),   # transversal oeste
    ("630998491", 1.15, "caminho"),   # transversais da fonte para o norte
    ("630998493", 1.15, "caminho"),
    ("630998500", 1.4, "caminho"),    # do portão sul à fonte
    ("630998481", 1.1, "caminho"),    # caminhos do café
    ("630998483", 1.1, "caminho"),
]
# vizinhos
QUARTEL_OESTE_REAL = [(67.7, -59.7), (89.5, 6.7)]           # fachada oeste do quartel (relação 15829081)
SANTA_CASA_REAL = [(-91.6, -7.6), (-82.6, 21.1), (-70.2, 58.8)]   # fachada leste (relação 15829054)
R_JOAO_MOREIRA = via("707848841")
R_BARAO = via("1328552982")
R_FLORIANO = via("630998507")
EXERCITO = ["630998527", "630998529", "630998523", "630998525", "630998514"]
QUADRA = via("630998531")


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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_esfera(r, seg=8, aneis=5):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=aneis, radius=r)
    return bm


def bm_icosfera(r, sub=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return bm


def bm_barra(a, b, r):
    """Barra de seção quadrada (lado 2r) de a até b, sem tampas (grades); abaixo de 2 cm, seção triangular"""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)))
    if u.length < 1e-3:
        u = Vector((1, 0, 0))
    u.normalize()
    w = d.cross(u).normalized()
    bm = bmesh.new()
    cs = [(-1, -1), (1, -1), (1, 1), (-1, 1)] if r > 0.02 else [(0, 1.3), (-1.1, -0.7), (1.1, -0.7)]
    k = len(cs)
    va = [bm.verts.new(a + (u * x + w * y) * r) for x, y in cs]
    vb = [bm.verts.new(b + (u * x + w * y) * r) for x, y in cs]
    for i in range(k):
        bm.faces.new([va[i], va[(i + 1) % k], vb[(i + 1) % k], vb[i]])
    for f in bm.faces:   # confere a orientação contra o eixo
        c = f.calc_center_median()
        eixo = a + d * (c - a).dot(d)
        f.normal_update()
        if f.normal.dot(c - eixo) < 0:
            f.normal_flip()
    return bm


def bm_cone_entre(a, b, ra, rb, n=6, tampa=False):
    """Tronco de cone de a até b (galhos, braços, pernas): raio ra na base e rb na ponta"""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    bm = bm_cilindro(ra, L, n, r2=rb, tampa=tampa)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bm.transform(Matrix.Translation(a) @ q.to_matrix().to_4x4())
    return bm


def M_em(x, y, z=0.0, giro=0.0):
    """Matriz: gira em volta de z (radianos, anti-horário visto de cima) e leva para (x, y, z)"""
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(giro, 4, "Z")


# ———————————————————————————————————————————————— textura gerada aqui (esquadrias)

def atlas_esquadrias(n=256):
    """
    Atlas 256 × 256 de esquadrias (o mesmo do Forte, para o quartel ficar igual nos dois marcos; V para cima):
      A (0–0,5 × 0,5–1)  porta-janela do pavimento de cima: folhas verdes almofadadas e bandeira em arco de vidro escuro
      B (0,5–1 × 0,5–1)  janela do térreo: folhas verdes com grade de ferro na bandeira
      C (0–0,5 × 0–0,5)  porta do café: folhas de madeira e bandeira clara
      D (0,5–1 × 0–0,5)  fita genérica (casario, Santa Casa, Exército): vidro escuro, caixilho claro a cada terço
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
    # C: porta envidraçada do café (madeira escura, vidro, bandeira clara)
    ret(0, 0, h, h, "#ece6d8")
    ret(5, 3, h - 5, h - 5, "#5a3b28")
    ret(11, 10, h // 2 - 4, h - 34, "#36424b")
    ret(h // 2 + 4, 10, h - 11, h - 34, "#36424b")
    ret(5, h - 30, h - 5, h - 26, "#d9d2bd")
    ret(9, h - 24, h - 9, h - 9, "#5f707e")
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


def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["grama"] = mat("Mat_Chao_Grama", "#6f9a47", 0.95)
    M["canteiro"] = mat("Mat_Chao_Canteiro", "#5d8a3c", 0.95)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#55595d", 0.95)
    M["faixa"] = mat("Mat_Chao_Faixa", "#efeee6", 0.8)
    M["calcada"] = mat("Mat_Chao_Calcada", "#c9c4b8", 0.9)
    M["pedra"] = mat("Mat_Chao_Paralelepipedo", "#9a948a", 0.95)
    M["caminho"] = mat("Mat_Chao_Caminho", "#ffffff", 0.9)       # piso das alamedas: cor e blocos vêm do .tsx
    M["concreto"] = mat("Mat_Chao_Concreto", "#d6d0c3", 0.9)
    M["lajota"] = mat("Mat_Chao_Lajota", "#ddd2bf", 0.85)
    M["quadra"] = mat("Mat_Chao_Quadra", "#8d9a8c", 0.9)
    M["corte"] = mat("Mat_Corte_Terreno", "#b59a74", 0.95)
    M["caiado"] = mat("Mat_Muro_Caiado", "#efeee8", 0.75)
    M["cordao"] = mat("Mat_Cordao_Pedra", "#d6d2c6", 0.8)
    M["pedra_clara"] = mat("Mat_Pedra_Clara", "#d3ccbb", 0.8)
    M["marmore"] = mat("Mat_Marmore", "#f1eee6", 0.45)
    M["bronze"] = mat("Mat_Bronze", "#5e5440", 0.5, 0.35)
    M["grade"] = mat("Mat_Grade_Ferro", "#24282a", 0.5, 0.3)
    M["agua"] = mat("Mat_Agua", "#41b1dc", 0.08, 0.05)
    M["tronco_baoba"] = mat("Mat_Tronco_Baoba", "#9a8a7b", 0.85)
    M["copa_baoba"] = mat("Mat_Copa_Baoba", "#6f9a45", 0.85)
    M["rosa"] = mat("Mat_Parede_Rosa", "#b07f80", 0.85)
    M["creme"] = mat("Mat_Frisos_Creme", "#ebdfc4", 0.7)
    M["base"] = mat("Mat_Embasamento_Cinza", "#9c9a94", 0.9)
    M["telha"] = mat("Mat_Telha_Ceramica", "#b8634a", 0.8)
    M["cumeeira"] = mat("Mat_Telha_Cumeeira", "#c98a6c", 0.8)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.45, 0.0, atlas)
    M["casario"] = mat("Mat_Casario", "#ffffff", 0.85)
    M["telhado_cinza"] = mat("Mat_Telhado_Cinza", "#8e918c", 0.75)
    M["laje"] = mat("Mat_Laje_Cinza", "#b9b7af", 0.9)
    M["madeira"] = mat("Mat_Madeira", "#6b4a33", 0.85)
    M["vao"] = M["grade"]
    return M


M_GLOBAL = {}


# ———————————————————————————————————————————————— regiões (quadro local da miniatura)

def regioes():
    """Polígonos dos três planos, da rampa da Barão do Rio Branco e do platô do forte, já na miniatura"""
    pr = TT(PRACA_REAL)
    no, ne = pr[0], pr[6]                 # quinas norte da praça
    meio_n = pr[7]                        # (43,5; 22,2): onde o muro vira linha do Exército
    R = {}
    R["praca"] = ccw(pr)
    # borda norte da praça (o muro da Caio Prado), de oeste para leste, até a face do forte
    R["borda_norte"] = [(-25.0, no[1]), no, meio_n, ne, (27.0, ne[1])]
    # 2º plano: entre a borda norte, a rampa da Barão (oeste), o forte (leste) e o muro sobre a avenida
    lim = TT([(45.1, 70.15), (-34.8, 96.8)])        # limite norte da área militar (via 316474476)
    R["segundo"] = ccw([(-25.0, no[1]), no, meio_n, ne, (27.0, ne[1]), (27.0, 15.4), lim[0], (lim[1][0], lim[1][1]), (-25.0, 18.0)])
    R["norte_2p"] = [(-25.0, 18.0), (lim[1][0], lim[1][1]), lim[0], (27.0, 15.4), (40.0, 13.0)]
    # alto da colina (ruas do Centro): tudo ao sul da borda norte, menos a rampa; a oeste da rampa sobe até v = 15,5
    R["cidade"] = ccw([(-45.0, -45.0), (45.0, -45.0), (45.0, ne[1]), (27.0, ne[1]), ne, meio_n, no, (-25.0, no[1]),
                       (-25.0, 9.0), (-27.6, 9.0), (-27.6, 15.5), (-45.0, 15.5)])
    R["rampa"] = [(-27.6, 9.0), (-25.0, 9.0), (-25.0, 19.9), (-27.6, 19.9)]
    # platô do forte: a leste da Floriano Peixoto, da Dr. João Moreira até a muralha sobre a avenida
    q = TT(QUARTEL_OESTE_REAL)
    R["quartel_oeste"] = q
    R["forte"] = ccw([(27.0, -45.0), (45.0, -45.0), (45.0, 13.0), (27.0, 15.4)])
    return R


def nivel(x, y):
    """Altura do chão num ponto da miniatura"""
    R = REG
    if ponto_no_poligono((x, y), R["praca"]):
        return Z_PRACA
    if ponto_no_poligono((x, y), R["rampa"]):
        return Z_RUA - (y - 9.0) / (19.9 - 9.0) * (Z_RUA - Z_AV)
    if ponto_no_poligono((x, y), R["forte"]):
        return Z_FORTE
    if ponto_no_poligono((x, y), R["segundo"]):
        return Z_2P
    if ponto_no_poligono((x, y), R["cidade"]):
        r = math.hypot(x, y)
        return Z_RUA if r <= R_PLATO else Z_RUA - (r - R_PLATO) / (RAIO - R_PLATO) * (Z_RUA - Z_AV)
    return Z_AV


REG = {}


# ———————————————————————————————————————————————— terreno nos três planos

def placa(P, poli, z, m, z_corte, m_corte, r=R_PLATO):
    """Topo de um nível recortado no disco; onde o recorte encontra a borda, a face de corte desce até z_corte"""
    p = recortar_no_disco(ccw(poli), r)
    if len(p) < 3:
        return p
    P.poli([(x, y, z) for x, y in p], m, para=(0, 0, 1))
    for a, b in zip(p, p[1:] + p[:1]):
        if abs(math.hypot(*a) - r) < 0.05 and abs(math.hypot(*b) - r) < 0.05:
            P.poli([(a[0], a[1], z_corte), (b[0], b[1], z_corte), (b[0], b[1], z), (a[0], a[1], z)], m_corte, para=(a[0] + b[0], a[1] + b[1], 0))
    return p


def parede_linha(P, linha, z0, z1, m, lado, recuo=0.0):
    """Face vertical ao longo de uma polilinha, de z0 a z1, virada para a direita (lado=+1) ou a esquerda (−1)"""
    base = offset_linha(linha, lado * recuo) if recuo else linha
    for i in range(len(linha) - 1):
        a, b = linha[i], linha[i + 1]
        ab, bb = base[i], base[i + 1]
        n_ = direita(a, b)
        P.poli([(ab[0], ab[1], z0), (bb[0], bb[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], m, para=(n_[0] * lado, n_[1] * lado, 0.1))


def chao(M):
    """Disco da avenida (3º plano), alto da colina com talude na borda, 2º plano, rampa e platô do forte"""
    base = Peca("Chao_Base")
    base.poli([(x, y, Z_AV) for x, y in circulo(96, RAIO)], M["grama"], para=(0, 0, 1))
    c = circulo(96, RAIO)
    for i in range(96):
        a, b = c[i], c[(i + 1) % 96]
        base.poli([(a[0], a[1], 0.0), (b[0], b[1], 0.0), (b[0], b[1], Z_AV), (a[0], a[1], Z_AV)], M["corte"], para=(a[0] + b[0], a[1] + b[1], 0))
    base.criar(grade=(3.2,))

    R = REG
    P = Peca("Chao_Colina")
    topo = recortar_no_disco(R["cidade"], R_PLATO)
    P.poli([(x, y, Z_RUA) for x, y in topo], M["calcada"], para=(0, 0, 1))
    # talude gramado da borda, só onde o alto da colina chega ao disco
    n = 96
    ci, ce = circulo(n, R_PLATO), circulo(n, RAIO - 0.02)
    dentro = [ponto_no_poligono((0.99 * (ci[i][0] + ci[(i + 1) % n][0]) / 2, 0.99 * (ci[i][1] + ci[(i + 1) % n][1]) / 2), R["cidade"])
              and not ponto_no_poligono((0.99 * (ci[i][0] + ci[(i + 1) % n][0]) / 2, 0.99 * (ci[i][1] + ci[(i + 1) % n][1]) / 2), R["forte"]) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        if not dentro[i]:
            continue
        P.poli([(ci[i][0], ci[i][1], Z_RUA), (ce[i][0], ce[i][1], Z_AV), (ce[j][0], ce[j][1], Z_AV), (ci[j][0], ci[j][1], Z_RUA)], M["grama"], para=(ci[i][0], ci[i][1], 3))
        for k, viz in ((i, dentro[i - 1]), (j, dentro[j])):
            if not viz:
                P.poli([(ci[k][0], ci[k][1], Z_RUA), (ce[k][0], ce[k][1], Z_AV), (ci[k][0], ci[k][1], Z_AV)], M["corte"])
    # muro de arrimo a oeste da rampa (v = 15,5): do alto da colina até a avenida
    for tr in recortar_linha([(-27.6, 15.5), (-45.0, 15.5)], R_PLATO):
        parede_linha(P, tr, Z_AV, Z_RUA, M["caiado"], -1)
    P.criar(grade=(2.2,))

    # 2º plano (área do Exército): gramado num degrau ~1 m abaixo da praça
    S = Peca("Chao_Segundo_Plano")
    placa(S, R["segundo"], Z_2P, M["grama"], Z_AV, M["corte"])
    S.criar(grade=(1.6,))

    # rampa da Barão do Rio Branco, que desce do alto da colina até a Leste-Oeste (paralelepípedo), com os arrimos
    Rm = Peca("Chao_Rampa_Barao")
    x0, x1 = -27.6, -25.0
    zs = lambda y: Z_RUA - (y - 9.0) / (19.9 - 9.0) * (Z_RUA - Z_AV)
    ys = [9.0 + (19.9 - 9.0) * k / 10 for k in range(11)]
    for ya, yb in zip(ys, ys[1:]):
        quad = [(x0, ya, zs(ya) + 0.012), (x1, ya, zs(ya) + 0.012), (x1, yb, zs(yb) + 0.012), (x0, yb, zs(yb) + 0.012)]
        if max(math.hypot(q_[0], q_[1]) for q_ in quad) > RAIO - 0.1:
            quad = recortar_3d(quad, RAIO - 0.1)
            if len(quad) < 3:
                continue
            Rm.poli(quad, M["pedra"], para=(0, 0, 1))
            continue
        Rm.poli(quad, M["pedra"], para=(0, 0, 1))
        # leste: 2º plano (até v = 18) e avenida depois; oeste: alto da colina (até 15,5) e avenida depois
        for x, lado in ((x1, 1), (x0, -1)):
            if lado == 1:
                viz = Z_2P if yb <= 18.0 + 1e-6 else Z_AV
            else:
                viz = Z_RUA if yb <= 15.5 + 1e-6 else Z_AV
            za, zb = zs(ya), zs(yb)
            lo_a, hi_a = min(za, viz), max(za, viz)
            lo_b, hi_b = min(zb, viz), max(zb, viz)
            if hi_a - lo_a < 0.01 and hi_b - lo_b < 0.01:
                continue
            Rm.poli([(x, ya, lo_a), (x, yb, lo_b), (x, yb, hi_b), (x, ya, hi_a)], M["caiado"], para=(lado if za > viz else -lado, 0, 0))
    Rm.criar()

    # platô do forte (a leste da Floriano Peixoto), com o embasamento cinza para a rua e a muralha caiada sobre a avenida
    F = Peca("Chao_Plato_Forte")
    LIM = RAIO - 0.15           # o platô vai até a borda: o quartel é cortado como numa maquete
    p = placa(F, R["forte"], Z_FORTE, M["calcada"], Z_AV, M["corte"], r=LIM)
    ny = REG["borda_norte"][-1][1]
    for tr in recortar_linha([(27.0, -45.0), (27.0, ny)], LIM):
        parede_linha(F, tr, Z_RUA, Z_FORTE, M["base"], -1)          # embasamento cinza para a Floriano (oeste)
    for tr in recortar_linha([(27.0, ny), (27.0, 15.4)], LIM):
        parede_linha(F, tr, Z_2P, Z_FORTE, M["caiado"], -1)
    for tr in recortar_linha([(27.0, 15.4), (45.0, 13.0)], LIM):
        parede_linha(F, tr, Z_AV, Z_FORTE, M["caiado"], -1)         # muralha caiada sobre a avenida (norte)
        # parapeito da muralha (como no modelo do Forte): face de fora na linha, de dentro 0,35 m ao sul
        for a, b in zip(tr, tr[1:]):
            n_ = direita(a, b)                 # sul (dentro)
            o = (n_[0] * 0.35, n_[1] * 0.35)
            F.poli([(a[0], a[1], Z_FORTE), (b[0], b[1], Z_FORTE), (b[0], b[1], Z_FORTE + 0.5), (a[0], a[1], Z_FORTE + 0.5)], M["caiado"], para=(-n_[0], -n_[1], 0))
            F.poli([(a[0] + o[0], a[1] + o[1], Z_FORTE), (b[0] + o[0], b[1] + o[1], Z_FORTE), (b[0] + o[0], b[1] + o[1], Z_FORTE + 0.5), (a[0] + o[0], a[1] + o[1], Z_FORTE + 0.5)], M["caiado"], para=(n_[0], n_[1], 0))
            F.poli([(a[0], a[1], Z_FORTE + 0.5), (b[0], b[1], Z_FORTE + 0.5), (b[0] + o[0], b[1] + o[1], Z_FORTE + 0.5), (a[0] + o[0], a[1] + o[1], Z_FORTE + 0.5)], M["cordao"], para=(0, 0, 1))
    F.criar(grade=(1.6,))
    reservar(R["forte"], 0.2)


def muro_norte(M):
    """
    Borda norte da praça (a Avenida Caio Prado, "de frente para o mar"): muro de arrimo caiado que cai ~1 m até o 2º plano,
    com cordão de pedra e, por cima, a mureta com pilaretes; e o muro do 2º plano sobre a Leste-Oeste.
    """
    P = Peca("Muro_Caio_Prado")
    linha = REG["borda_norte"]
    # face de fora (norte = esquerda do sentido oeste → leste)
    for i in range(len(linha) - 1):
        a, b = linha[i], linha[i + 1]
        n_ = direita(a, b)
        n_ = (-n_[0], -n_[1])
        ta = (a[0] + n_[0] * 0.12, a[1] + n_[1] * 0.12)
        tb = (b[0] + n_[0] * 0.12, b[1] + n_[1] * 0.12)
        P.poli([(ta[0], ta[1], Z_2P), (tb[0], tb[1], Z_2P), (b[0], b[1], Z_PRACA), (a[0], a[1], Z_PRACA)], M["caiado"], para=(n_[0], n_[1], 0.1))
        # cordão de pedra no topo do arrimo
        ca = (a[0] + n_[0] * 0.08, a[1] + n_[1] * 0.08)
        cb = (b[0] + n_[0] * 0.08, b[1] + n_[1] * 0.08)
        P.poli([(ca[0], ca[1], Z_PRACA - 0.1), (cb[0], cb[1], Z_PRACA - 0.1), (cb[0], cb[1], Z_PRACA + 0.02), (ca[0], ca[1], Z_PRACA + 0.02)], M["cordao"], para=(n_[0], n_[1], 0))
    # mureta da Caio Prado (só ao longo da praça): parede lisa com pilaretes a cada ~2,4 m e capeamento
    trecho = linha[1:4]
    alto = 0.62
    dentro = offset_linha(trecho, 0.24)        # o lado da praça fica à direita (sul)
    for i in range(len(trecho) - 1):
        a, b, da, db = trecho[i], trecho[i + 1], dentro[i], dentro[i + 1]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], Z_PRACA), (b[0], b[1], Z_PRACA), (b[0], b[1], Z_PRACA + alto), (a[0], a[1], Z_PRACA + alto)], M["caiado"], para=(-n_[0], -n_[1], 0))
        P.poli([(da[0], da[1], Z_PRACA), (db[0], db[1], Z_PRACA), (db[0], db[1], Z_PRACA + alto), (da[0], da[1], Z_PRACA + alto)], M["caiado"], para=(n_[0], n_[1], 0))
        ea, eb = offset_linha([a, b], -0.04), offset_linha([da, db], 0.04)
        P.poli([(ea[0][0], ea[0][1], Z_PRACA + alto), (ea[1][0], ea[1][1], Z_PRACA + alto), (eb[1][0], eb[1][1], Z_PRACA + alto), (eb[0][0], eb[0][1], Z_PRACA + alto)], M["cordao"], para=(0, 0, 1))
    for (a, b) in ((trecho[0], dentro[0]), (trecho[-1], dentro[-1])):
        P.poli([(a[0], a[1], Z_PRACA), (b[0], b[1], Z_PRACA), (b[0], b[1], Z_PRACA + alto), (a[0], a[1], Z_PRACA + alto)], M["caiado"])
    mid = offset_linha(trecho, 0.12)
    L = comprimento(mid)
    nseg = max(1, round(L / 2.4))
    for x, y, a in amostrar(mid, L / nseg):
        P.juntar(bm_caixa(0.38, 0.38, alto + 0.1), M["caiado"], M_em(x, y, Z_PRACA, a))
        P.juntar(bm_caixa(0.46, 0.46, 0.06), M["cordao"], M_em(x, y, Z_PRACA + alto + 0.1, a))
        P.juntar(bm_esfera(0.11, 6, 4), M["pedra_clara"], Matrix.Translation((x, y, Z_PRACA + alto + 0.27)))
    # muro do 2º plano sobre a Leste-Oeste (limite da área militar), caiado, com parapeito
    for tr in recortar_linha(REG["norte_2p"][:-1], RAIO - 0.1):
        for i in range(len(tr) - 1):
            a, b = tr[i], tr[i + 1]
            n_ = direita(a, b)
            n_ = (-n_[0], -n_[1])                 # o lado da avenida (norte)
            P.poli([(a[0], a[1], Z_AV), (b[0], b[1], Z_AV), (b[0], b[1], Z_2P + 0.45), (a[0], a[1], Z_2P + 0.45)], M["caiado"], para=(n_[0], n_[1], 0))
            o = (-n_[0] * 0.25, -n_[1] * 0.25)
            P.poli([(a[0] + o[0], a[1] + o[1], Z_2P), (b[0] + o[0], b[1] + o[1], Z_2P), (b[0] + o[0], b[1] + o[1], Z_2P + 0.45), (a[0] + o[0], a[1] + o[1], Z_2P + 0.45)], M["caiado"], para=(-n_[0], -n_[1], 0))
            P.poli([(a[0], a[1], Z_2P + 0.45), (b[0], b[1], Z_2P + 0.45), (b[0] + o[0], b[1] + o[1], Z_2P + 0.45), (a[0] + o[0], a[1] + o[1], Z_2P + 0.45)], M["cordao"], para=(0, 0, 1))
    return P.criar(grade=(1.6, False))


# ———————————————————————————————————————————————— praça: pisos

TRAJ = {}


def pisos(M):
    """Gramado da praça, alamedas (OSM), o anel da fonte e o piso do Café Passeio"""
    P = Peca("Chao_Praca")
    pr = REG["praca"]
    dentro = offset_poli(pr, -0.3)
    P.poli([(x, y, Z_PRACA) for x, y in dentro], M["grama"], para=(0, 0, 1))
    # faixa entre a mureta do gradil e o gramado
    janela = casco(offset_poli(pr, -0.32))
    k = 0
    for vid, larg, mm in CAMINHOS:
        eixo = TT(via(vid))
        TRAJ[vid] = eixo
        # estende as pontas 0,6 m para encostar no gradil ou no outro caminho
        if len(eixo) >= 2:
            a, b = eixo[0], eixo[1]
            l = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
            eixo = [(a[0] - (b[0] - a[0]) / l * 0.6, a[1] - (b[1] - a[1]) / l * 0.6)] + eixo[1:]
            a, b = eixo[-1], eixo[-2]
            l = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
            eixo = eixo[:-1] + [(a[0] - (b[0] - a[0]) / l * 0.6, a[1] - (b[1] - a[1]) / l * 0.6)]
        z = Z_PRACA + 0.010 + 0.0025 * k
        k += 1
        for i in range(len(eixo) - 1):
            # cada trecho é um quadrilátero com as pontas em esquadria (sem n-gono côncavo)
            seg = eixo[max(0, i - 1):i + 3]
            off = i - max(0, i - 1)
            e = offset_linha(seg, larg / 2)
            d = offset_linha(seg, -larg / 2)
            q = [e[off], e[off + 1], d[off + 1], d[off]]
            q = recortar_convexo(ccw(q), janela)
            if len(q) >= 3:
                P.poli([(x, y, z) for x, y in q], M[mm], [(x / 1.5, y / 1.5) for x, y in q], para=(0, 0, 1))
        reservar(faixa_poligono(eixo, larg), 0.15)
    # anel em volta da fonte (via 630998497)
    cx, cy = FONTE
    z = Z_PRACA + 0.010 + 0.0025 * k
    n = 32
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        pts = [(cx + R_FONTE_ANEL[0] * math.cos(a0), cy + R_FONTE_ANEL[0] * math.sin(a0)), (cx + R_FONTE_ANEL[1] * math.cos(a0), cy + R_FONTE_ANEL[1] * math.sin(a0)),
               (cx + R_FONTE_ANEL[1] * math.cos(a1), cy + R_FONTE_ANEL[1] * math.sin(a1)), (cx + R_FONTE_ANEL[0] * math.cos(a1), cy + R_FONTE_ANEL[0] * math.sin(a1))]
        P.poli([(x, y, z) for x, y in pts], M["caminho"], [(x / 1.5, y / 1.5) for x, y in pts], para=(0, 0, 1))
    # piso do café (área 630998479)
    pc = recortar_convexo(piso_cafe(), janela)
    P.poli([(x, y, z + 0.003) for x, y in pc], M["lajota"], para=(0, 0, 1))
    reservar(pc, 0.1)
    return P.criar(grade=(1.2,))


# ———————————————————————————————————————————————— gradil com colunas, portões

def gradil(M):
    """
    Gradil histórico (retirado em 1932, refeito nos anos 1990 "com as colunas"): mureta de pedra clara, colunas com
    capitel e pinha, ferro escuro com lanças entre elas; portões oeste, sul e leste (nós do OSM) com colunas mais altas.
    """
    P = Peca("Gradil_Passeio")
    pr = TT(GRADIL_REAL)              # NO → O → SO → S → SE → L → NE (aberto ao norte)
    portoes = TT(PORTOES_REAL)
    # quebra a linha nos portões (vão de 2,6 m)
    trechos = []
    atual = [pr[0]]
    for i in range(1, len(pr)):
        p = pr[i]
        if any(math.hypot(p[0] - g[0], p[1] - g[1]) < 0.3 for g in portoes):
            a = atual[-1]
            l = math.hypot(p[0] - a[0], p[1] - a[1])
            atual.append(lerp(a, p, 1 - 1.3 / l))
            trechos.append(atual)
            b = pr[i + 1]
            l2 = math.hypot(b[0] - p[0], b[1] - p[1])
            atual = [lerp(p, b, 1.3 / l2)]
        else:
            atual.append(p)
    trechos.append(atual)
    z0 = Z_RUA
    zm = Z_PRACA + 0.2               # topo da mureta
    for tr in trechos:
        # mureta (o lado de fora fica à direita no sentido NO → O → S → L → NE)
        fora = offset_linha(tr, 0.16)
        dent = offset_linha(tr, -0.16)
        for i in range(len(tr) - 1):
            a, b, fa, fb, da, db = tr[i], tr[i + 1], fora[i], fora[i + 1], dent[i], dent[i + 1]
            n_ = direita(a, b)
            P.poli([(fa[0], fa[1], z0), (fb[0], fb[1], z0), (fb[0], fb[1], zm), (fa[0], fa[1], zm)], M["pedra_clara"], para=(n_[0], n_[1], 0))
            P.poli([(da[0], da[1], Z_PRACA), (db[0], db[1], Z_PRACA), (db[0], db[1], zm), (da[0], da[1], zm)], M["pedra_clara"], para=(-n_[0], -n_[1], 0))
            P.poli([(fa[0], fa[1], zm), (fb[0], fb[1], zm), (db[0], db[1], zm), (da[0], da[1], zm)], M["cordao"], para=(0, 0, 1))
        for k in (0, -1):
            P.poli([(fora[k][0], fora[k][1], z0), (dent[k][0], dent[k][1], z0), (dent[k][0], dent[k][1], zm), (fora[k][0], fora[k][1], zm)], M["pedra_clara"])
        # colunas a cada ~2,3 m e ferro entre elas
        L = comprimento(tr)
        n = max(1, round(L / 2.3))
        pts = amostrar(tr, L / n)
        if len(pts) < n + 1:
            pts.append((tr[-1][0], tr[-1][1], math.atan2(tr[-1][1] - tr[-2][1], tr[-1][0] - tr[-2][0])))
        for i, (x, y, a) in enumerate(pts):
            P.juntar(bm_caixa(0.3, 0.3, 1.12), M["pedra_clara"], M_em(x, y, zm, a))
            P.juntar(bm_caixa(0.38, 0.38, 0.07), M["cordao"], M_em(x, y, zm + 1.12, a))
            P.juntar(bm_cilindro(0.09, 0.16, 6, r2=0.0), M["pedra_clara"], Matrix.Translation((x, y, zm + 1.19)))
            if i:
                xa, ya = pts[i - 1][:2]
                l = math.hypot(x - xa, y - ya)
                ux, uy = (x - xa) / l, (y - ya) / l
                pa = (xa + ux * 0.16, ya + uy * 0.16)
                pb = (x - ux * 0.16, y - uy * 0.16)
                for zz in (0.1, 0.82):
                    P.juntar(bm_barra((pa[0], pa[1], zm + zz), (pb[0], pb[1], zm + zz), 0.022), M["grade"])
                nb = max(2, int((l - 0.32) / 0.19))
                for kk in range(1, nb):
                    q = lerp(pa, pb, kk / nb)
                    P.juntar(bm_barra((q[0], q[1], zm + 0.02), (q[0], q[1], zm + 0.98), 0.012), M["grade"])
        reservar(faixa_poligono(tr, 0.5), 0.1)
    # portões: colunas altas com pinha e as duas folhas de ferro abertas para dentro
    for gi, g in enumerate(portoes):
        # direção do gradil no portão
        i = min(range(len(pr)), key=lambda k: math.hypot(pr[k][0] - g[0], pr[k][1] - g[1]))
        a, b = pr[i - 1], pr[i + 1]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        ux, uy = math.cos(ang), math.sin(ang)
        nx, ny = -uy, ux                    # para dentro da praça (esquerda do sentido do gradil)
        for s in (-1, 1):
            x, y = g[0] + ux * s * 1.3, g[1] + uy * s * 1.3
            P.juntar(bm_caixa(0.48, 0.48, 0.25), M["pedra_clara"], M_em(x, y, z0, ang))
            P.juntar(bm_caixa(0.4, 0.4, 1.8), M["pedra_clara"], M_em(x, y, z0 + 0.25, ang))
            P.juntar(bm_caixa(0.5, 0.5, 0.09), M["cordao"], M_em(x, y, z0 + 2.05, ang))
            P.juntar(bm_torno([(0.0, 0.0), (0.12, 0.02), (0.15, 0.12), (0.1, 0.24), (0.04, 0.3), (0.0, 0.36)], 8), M["pedra_clara"], Matrix.Translation((x, y, z0 + 2.14)))
            # folha aberta (1,2 m), girada para dentro
            fx, fy = x - ux * s * 0.2, y - uy * s * 0.2
            ex, ey = fx + nx * 1.15, fy + ny * 1.15
            for zz in (0.12, 0.6, 1.25):
                P.juntar(bm_barra((fx, fy, Z_PRACA + zz), (ex, ey, Z_PRACA + zz), 0.02), M["grade"])
            for kk in range(7):
                q = lerp((fx, fy), (ex, ey), kk / 6)
                P.juntar(bm_barra((q[0], q[1], Z_PRACA + 0.05), (q[0], q[1], Z_PRACA + 1.38), 0.012), M["grade"])
        # soleira de pedra no vão
        q = [(g[0] - ux * 1.3 - nx * 0.25, g[1] - uy * 1.3 - ny * 0.25), (g[0] + ux * 1.3 - nx * 0.25, g[1] + uy * 1.3 - ny * 0.25),
             (g[0] + ux * 1.3 + nx * 0.25, g[1] + uy * 1.3 + ny * 0.25), (g[0] - ux * 1.3 + nx * 0.25, g[1] - uy * 1.3 + ny * 0.25)]
        P.poli([(x, y, Z_PRACA + 0.02) for x, y in q], M["cordao"], para=(0, 0, 1))
        P.poli([(q[0][0], q[0][1], Z_RUA), (q[1][0], q[1][1], Z_RUA), (q[1][0], q[1][1], Z_PRACA + 0.02), (q[0][0], q[0][1], Z_PRACA + 0.02)], M["cordao"], para=(-nx, -ny, 0))
    return P.criar()


# ———————————————————————————————————————————————— fonte, baobá, estátuas, bustos

FONTE = (0.0, 0.0)
R_FONTE = 1.75               # bacia (Ø real 6,9 m; exagerada para ler de longe)
R_FONTE_ANEL = (2.05, 3.05)  # caminho em anel (via 630998497)
BAOBA = (0.0, 0.0)


def fonte(M):
    """Fonte redonda (via 630998502): bacia de borda moldurada, repuxo em duas taças e quatro peixes de pedra na borda"""
    P = Peca("Fonte_Passeio")
    cx, cy = FONTE
    z = Z_PRACA
    # borda da bacia: perfil de pedra com moldura (por fora) e a lâmina d'água
    borda = [(R_FONTE + 0.08, 0.0), (R_FONTE + 0.08, 0.08), (R_FONTE, 0.12), (R_FONTE, 0.42), (R_FONTE + 0.06, 0.45), (R_FONTE + 0.06, 0.52),
             (R_FONTE - 0.24, 0.52), (R_FONTE - 0.24, 0.3)]
    P.juntar(bm_torno(borda, 40), M["pedra_clara"], Matrix.Translation((cx, cy, z)), liso=False)
    P.juntar(bm_cilindro(R_FONTE - 0.24, 0.02, 40), M["agua"], Matrix.Translation((cx, cy, z + 0.34)))
    # repuxo central: pé, taça grande, fuste, taça pequena e pinha
    rep = [(0.0, 0.3), (0.42, 0.3), (0.42, 0.42), (0.26, 0.5), (0.18, 0.62), (0.2, 1.05), (0.16, 1.12), (0.3, 1.18), (0.78, 1.3),
           (0.8, 1.4), (0.66, 1.42), (0.14, 1.36), (0.12, 1.75), (0.1, 1.82), (0.2, 1.88), (0.4, 1.96), (0.4, 2.02), (0.1, 2.0),
           (0.08, 2.2), (0.12, 2.32), (0.05, 2.46), (0.0, 2.52)]
    P.juntar(bm_torno(rep, 16), M["marmore"], Matrix.Translation((cx, cy, z)))
    P.juntar(bm_cilindro(0.66, 0.02, 16), M["agua"], Matrix.Translation((cx, cy, z + 1.38)))
    P.juntar(bm_cilindro(0.33, 0.02, 12), M["agua"], Matrix.Translation((cx, cy, z + 1.99)))
    # "chafarizes com peixes" (O Povo): quatro peixes de pedra sobre a borda, jorrando para o centro
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        x, y = cx + math.cos(a) * (R_FONTE - 0.08), cy + math.sin(a) * (R_FONTE - 0.08)
        corpo = [(0.0, 0.0), (0.09, 0.05), (0.12, 0.18), (0.09, 0.32), (0.04, 0.4), (0.0, 0.42)]
        bm = bm_torno(corpo, 6)
        # deita o peixe: cabeça para o centro, inclinada para baixo
        Mx = M_em(x, y, z + 0.6, a + math.pi) @ Matrix.Rotation(math.radians(70), 4, "Y")
        P.juntar(bm, M["marmore"], Mx)
        P.juntar(bm_cilindro(0.12, 0.04, 6, r2=0.02), M["marmore"], M_em(x, y, z + 0.5, a) @ Matrix.Rotation(math.radians(-90), 4, "Y"))
    reservar_circulo(FONTE, R_FONTE + 0.3, 0.2)
    return P.criar()


def baoba(M):
    """
    O baobá de 1910 (Adansonia digitata, tombado): tronco em garrafa, liso e cinza-rosado, com galhos grossos e curtos que
    se abrem quase na horizontal e tufos de folhas ralos nas pontas — a silhueta que nenhuma outra árvore da praça tem.
    """
    P = Peca("Baoba")
    cx, cy = BAOBA
    z = Z_PRACA
    # tronco: base larga com raízes, barriga, afina até a forquilha
    perfil = [(0.0, -0.05), (1.55, -0.05), (1.5, 0.15), (1.38, 0.4), (1.36, 1.0), (1.4, 1.8), (1.33, 2.6), (1.17, 3.4),
              (0.96, 4.1), (0.8, 4.6), (0.7, 4.9), (0.0, 5.1)]
    bm = bm_torno(perfil, 18)
    # irregularidade: gomos verticais leves (casca do baobá) e achatamento
    rnd = random.Random(1910)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        k = 1.0 + 0.05 * math.sin(a * 5 + 0.7) + 0.03 * math.sin(a * 3 + v.co.z * 0.8)
        v.co.x *= k * 1.04
        v.co.y *= k * 0.96
    P.juntar(bm, M["tronco_baoba"], Matrix.Translation((cx, cy, z)), liso=True)
    # galhos principais: 6 grossos, abrindo em leque; cada um com 2 secundários
    pontas = []
    for i in range(6):
        a = i * math.pi / 3 + rnd.uniform(-0.25, 0.25)
        inc = rnd.uniform(0.3, 0.55)                    # elevação do galho
        L = rnd.uniform(2.7, 3.4)
        o = (cx + math.cos(a) * 0.4, cy + math.sin(a) * 0.4, z + 4.5 + rnd.uniform(-0.15, 0.2))
        f = (o[0] + math.cos(a) * L * math.cos(inc), o[1] + math.sin(a) * L * math.cos(inc), o[2] + L * math.sin(inc))
        P.juntar(bm_cone_entre(o, f, 0.42, 0.2, 7), M["tronco_baoba"], liso=True)
        for s in (-1, 1):
            a2 = a + s * rnd.uniform(0.35, 0.7)
            L2 = rnd.uniform(1.0, 1.5)
            inc2 = inc + rnd.uniform(0.1, 0.45)
            g = (f[0] + math.cos(a2) * L2 * math.cos(inc2), f[1] + math.sin(a2) * L2 * math.cos(inc2), f[2] + L2 * math.sin(inc2))
            P.juntar(bm_cone_entre(f, g, 0.16, 0.07, 5), M["tronco_baoba"], liso=True)
            pontas.append(g)
        pontas.append(f)
    # tufos ralos de folhas (copa aberta, deixa ver os galhos)
    for i, p in enumerate(pontas):
        r = 0.55 if i % 3 == 2 else rnd.uniform(0.62, 0.85)
        bm = bm_icosfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r * 1.2, r, r * 0.55, 1)))
        P.juntar(bm, M["copa_baoba"], M_em(p[0], p[1], p[2] + 0.25, rnd.uniform(0, 6.28)))
    reservar_circulo(BAOBA, 1.6, 0.4)
    return P.criar(), pontas


def figura(P, m, x, y, z, giro, variante, escala=1.0):
    """
    Estátua greco-romana de ~1,25 m (réplicas claras do Passeio: Apolo, Prometeu, Vênus com Cupido nos títulos do
    Commons; a forma de cada uma não foi confirmada, então as figuras são genéricas): 0 drapeada de braço erguido,
    1 de pé com o manto no ombro, 2 com a tocha erguida, 3 drapeada com uma criança ao lado.
    """
    T_ = M_em(x, y, z, giro) @ Matrix.Scale(escala, 4)
    if variante in (0, 3):
        corpo = [(0.0, 0.0), (0.22, 0.0), (0.24, 0.08), (0.19, 0.45), (0.15, 0.62), (0.17, 0.8), (0.15, 0.9), (0.07, 0.97), (0.0, 0.99)]
        bm = bm_torno(corpo, 9)
        bm.transform(Matrix.Diagonal((1.0, 0.78, 1.0, 1)))
        P.juntar(bm, m, T_, liso=True)
    else:
        for s in (-1, 1):   # pernas em contrapposto
            P.juntar(bm_cone_entre((0.07 * s, 0.0, 0.0), (0.05 * s, 0.02 if s > 0 else -0.03, 0.5), 0.075, 0.09, 6), m, T_)
        tronco = [(0.0, 0.46), (0.13, 0.46), (0.15, 0.6), (0.13, 0.72), (0.17, 0.86), (0.15, 0.92), (0.07, 0.97), (0.0, 0.99)]
        bm = bm_torno(tronco, 8)
        bm.transform(Matrix.Diagonal((1.0, 0.7, 1.0, 1)))
        P.juntar(bm, m, T_, liso=True)
        # manto caindo do ombro
        P.juntar(bm_cone_entre((-0.14, -0.04, 0.92), (-0.2, -0.06, 0.2), 0.08, 0.13, 6), m, T_)
    P.juntar(bm_esfera(0.085, 8, 6), m, T_ @ Matrix.Translation((0, 0.01, 1.07)), liso=True)
    P.juntar(bm_cilindro(0.03, 0.07, 6), m, T_ @ Matrix.Translation((0, 0, 0.97)))
    # braços
    if variante == 0:
        P.juntar(bm_cone_entre((0.15, 0, 0.9), (0.24, 0.02, 1.32), 0.04, 0.03, 5), m, T_)
        P.juntar(bm_cone_entre((-0.15, 0, 0.9), (-0.2, 0.08, 0.58), 0.04, 0.03, 5), m, T_)
    elif variante == 1:
        P.juntar(bm_cone_entre((0.15, 0, 0.9), (0.38, 0.12, 0.98), 0.04, 0.03, 5), m, T_)
        P.juntar(bm_cone_entre((-0.15, 0, 0.9), (-0.17, 0.02, 0.56), 0.04, 0.03, 5), m, T_)
    elif variante == 2:
        P.juntar(bm_cone_entre((0.15, 0, 0.9), (0.2, 0.04, 1.36), 0.04, 0.03, 5), m, T_)
        P.juntar(bm_cone_entre((0.2, 0.04, 1.3), (0.21, 0.05, 1.52), 0.035, 0.05, 6), m, T_)
        P.juntar(bm_cilindro(0.06, 0.12, 6, r2=0.0), m, T_ @ Matrix.Translation((0.21, 0.05, 1.52)))
        P.juntar(bm_cone_entre((-0.15, 0, 0.9), (-0.22, 0.06, 0.6), 0.04, 0.03, 5), m, T_)
    else:
        P.juntar(bm_cone_entre((0.15, 0, 0.9), (0.24, 0.1, 0.66), 0.04, 0.03, 5), m, T_)
        P.juntar(bm_cone_entre((-0.15, 0, 0.9), (-0.16, 0.1, 0.62), 0.04, 0.03, 5), m, T_)
        # Cupido ao lado (criança pequena com asas)
        C = T_ @ Matrix.Translation((0.3, 0.06, 0.0)) @ Matrix.Scale(0.42, 4)
        P.juntar(bm_torno([(0.0, 0.0), (0.18, 0.0), (0.2, 0.3), (0.2, 0.7), (0.14, 0.9), (0.0, 0.95)], 7), m, C, liso=True)
        P.juntar(bm_esfera(0.15, 7, 5), m, C @ Matrix.Translation((0, 0, 1.08)), liso=True)
        for s in (-1, 1):
            P.juntar(bm_caixa(0.05, 0.3, 0.35), m, C @ Matrix.Translation((0, -0.18, 0.55)) @ Matrix.Rotation(s * 0.5, 4, "Z"))


def pedestal(P, M, x, y, z, giro):
    """Pedestal de pedra clara: plinto, dado, cornija e soco da estátua (1,25 m)"""
    T_ = M_em(x, y, z, giro)
    P.juntar(bm_caixa(0.92, 0.92, 0.16, 0.03), M["pedra_clara"], T_)
    P.juntar(bm_caixa(0.7, 0.7, 0.84, 0.03), M["pedra_clara"], T_ @ Matrix.Translation((0, 0, 0.16)))
    P.juntar(bm_caixa(0.86, 0.86, 0.1, 0.02), M["cordao"], T_ @ Matrix.Translation((0, 0, 1.0)))
    P.juntar(bm_caixa(0.6, 0.6, 0.15), M["pedra_clara"], T_ @ Matrix.Translation((0, 0, 1.1)))
    return z + 1.25


def estatuas(M, pos):
    """Estátuas brancas sobre pedestais ao longo do corredor principal e junto à fonte"""
    P = Peca("Estatuas_Marmore")
    for x, y, giro, var in pos:
        zt = pedestal(P, M, x, y, Z_PRACA, giro)
        figura(P, M["marmore"], x, y, zt, giro, var, 1.3)
        reservar_circulo((x, y), 0.55, 0.25)
    return P.criar()


def bustos(M, pos):
    """Bustos (citados pelos guias; quem são e onde ficam não foi confirmado): estela de pedra e busto de bronze"""
    P = Peca("Bustos")
    for x, y, giro in pos:
        T_ = M_em(x, y, Z_PRACA, giro)
        P.juntar(bm_caixa(0.62, 0.62, 0.14, 0.03), M["pedra_clara"], T_)
        P.juntar(bm_cilindro(0.2, 1.05, 4, r2=0.16), M["pedra_clara"], T_ @ Matrix.Translation((0, 0, 0.14)) @ Matrix.Rotation(math.pi / 4, 4, "Z"))
        P.juntar(bm_caixa(0.36, 0.36, 0.06), M["cordao"], T_ @ Matrix.Translation((0, 0, 1.19)))
        ombros = [(0.0, 0.0), (0.2, 0.0), (0.21, 0.12), (0.15, 0.22), (0.06, 0.26), (0.0, 0.27)]
        bm = bm_torno(ombros, 8)
        bm.transform(Matrix.Diagonal((1.0, 0.6, 1.0, 1)))
        P.juntar(bm, M["bronze"], T_ @ Matrix.Translation((0, 0, 1.25)), liso=True)
        P.juntar(bm_cilindro(0.045, 0.08, 6), M["bronze"], T_ @ Matrix.Translation((0, 0, 1.5)))
        P.juntar(bm_esfera(0.1, 8, 6), M["bronze"], T_ @ Matrix.Translation((0, 0.01, 1.66)), liso=True)
        reservar_circulo((x, y), 0.45, 0.2)
    return P.criar()


# ———————————————————————————————————————————————— Café Passeio e o quiosque redondo

def escalar_poli(p, k):
    cx = sum(q[0] for q in p) / len(p)
    cy = sum(q[1] for q in p) / len(p)
    return [(cx + (q[0] - cx) * k, cy + (q[1] - cy) * k) for q in p], (cx, cy)


def piso_cafe():
    """Piso do café: a área 630998479 do OSM alargada 2,2 m para os lados, onde ficam as mesas ao ar livre"""
    p = ccw(TT(PISO_CAFE_REAL))
    return offset_poli(p, 2.2)


def cafe(M):
    """
    Café Passeio (prédio 630998504, num antigo quiosque adaptado): planta de cantos arredondados do OSM, exagerada 1,25×;
    paredes claras com portas envidraçadas, cimalha e telhado de quatro águas cinza (cor não confirmada: neutra).
    Ao lado, o pavilhão redondo (630998506), neutro: pode ser a caixa d'água restaurada em 2020.
    """
    P = Peca("Cafe_Passeio")
    base, c = escalar_poli(ccw(TT(CAFE_REAL)), 1.25)
    z = Z_PRACA + 0.02
    H = 2.35
    P.juntar(bm_poli_ext(base, z, z + 0.18), M["pedra_clara"])
    for i in range(len(base)):
        a, b = base[i], base[(i + 1) % len(base)]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], z + 0.18), (b[0], b[1], z + 0.18), (b[0], b[1], z + H), (a[0], a[1], z + H)], M["caiado"], para=(n_[0], n_[1], 0))
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        nb = int(L / 0.95)
        for k in range(nb):
            t0 = (k + 0.5) / nb
            m_ = lerp(a, b, t0)
            ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
            w = 0.32
            q = [(m_[0] - ux * w + n_[0] * 0.02, m_[1] - uy * w + n_[1] * 0.02, z + 0.25), (m_[0] + ux * w + n_[0] * 0.02, m_[1] + uy * w + n_[1] * 0.02, z + 0.25),
                 (m_[0] + ux * w + n_[0] * 0.02, m_[1] + uy * w + n_[1] * 0.02, z + 1.95), (m_[0] - ux * w + n_[0] * 0.02, m_[1] - uy * w + n_[1] * 0.02, z + 1.95)]
            P.poli(q, M["esquadrias"], [uv_reg("C", 0, 0), uv_reg("C", 1, 0), uv_reg("C", 1, 1), uv_reg("C", 0, 1)], para=(n_[0], n_[1], 0))
    anel_friso(P, base, z + H - 0.2, z + H, 0.08, M["creme"])
    # telhado: anel do beiral subindo até o polígono encolhido (quatro águas truncadas) e lanternim
    e = offset_poli(base, 0.42)
    topo, _ = escalar_poli(base, 0.32)
    zb, zt = z + H, z + H + 1.0
    for i in range(len(base)):
        j = (i + 1) % len(base)
        P.poli([(e[i][0], e[i][1], zb), (e[j][0], e[j][1], zb), (topo[j][0], topo[j][1], zt), (topo[i][0], topo[i][1], zt)], M["telhado_cinza"], para=(0, 0, 1))
        P.poli([(e[i][0], e[i][1], zb - 0.08), (e[j][0], e[j][1], zb - 0.08), (e[j][0], e[j][1], zb), (e[i][0], e[i][1], zb)], M["creme"], para=(*direita(e[i], e[j]), 0))
        P.poli([(base[i][0], base[i][1], zb - 0.08), (base[j][0], base[j][1], zb - 0.08), (e[j][0], e[j][1], zb - 0.08), (e[i][0], e[i][1], zb - 0.08)], M["creme"], para=(0, 0, -1))
    P.poli([(x, y, zt) for x, y in topo], M["telhado_cinza"], para=(0, 0, 1))
    lt, _ = escalar_poli(base, 0.2)
    P.juntar(bm_poli_ext(lt, zt, zt + 0.35), M["caiado"])
    lt2, _ = escalar_poli(base, 0.26)
    P.juntar(bm_poli_ext(lt2, zt + 0.35, zt + 0.45), M["telhado_cinza"])
    reservar(base, 0.6)
    # pavilhão redondo
    q, cq = escalar_poli(TT(QUIOSQUE_REAL), 1.0)
    r = max(math.hypot(p[0] - cq[0], p[1] - cq[1]) for p in q) * 1.2
    cq = (cq[0], cq[1] - 0.35)
    P.juntar(bm_cilindro(r + 0.1, 0.18, 20), M["pedra_clara"], Matrix.Translation((cq[0], cq[1], z)))
    P.juntar(bm_cilindro(r, 2.2, 20), M["caiado"], Matrix.Translation((cq[0], cq[1], z + 0.18)))
    P.juntar(bm_cilindro(r + 0.12, 0.16, 20), M["creme"], Matrix.Translation((cq[0], cq[1], z + 2.22)))
    P.juntar(bm_cilindro(r + 0.3, 0.7, 20, r2=0.15), M["telhado_cinza"], Matrix.Translation((cq[0], cq[1], z + 2.38)))
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        x, y = cq[0] + math.cos(a) * (r + 0.015), cq[1] + math.sin(a) * (r + 0.015)
        t = (-math.sin(a), math.cos(a))
        w = 0.28
        quad = [(x - t[0] * w, y - t[1] * w, z + 0.3), (x + t[0] * w, y + t[1] * w, z + 0.3), (x + t[0] * w, y + t[1] * w, z + 1.85), (x - t[0] * w, y - t[1] * w, z + 1.85)]
        P.poli(quad, M["esquadrias"], [uv_reg("C", 0, 0), uv_reg("C", 1, 0), uv_reg("C", 1, 1), uv_reg("C", 0, 1)], para=(math.cos(a), math.sin(a), 0))
    reservar_circulo(cq, r + 0.1, 0.5)
    return P.criar(), base, (cq, r)


def bm_poli_ext(poli, z0, z1):
    """Prisma de um polígono anti-horário de z0 a z1 (laterais e tampa)"""
    bm = bmesh.new()
    vb = [bm.verts.new((x, y, z0)) for x, y in poli]
    vt = [bm.verts.new((x, y, z1)) for x, y in poli]
    bm.faces.new(vt)
    n = len(poli)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vb[i], vb[j], vt[j], vt[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


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


# ———————————————————————————————————————————————— vizinhos: quartel do Forte, Santa Casa, casario, Exército

class Fachada:
    """Quadro local de uma fachada reta: u ao longo (da esquerda para a direita de quem olha de fora), v para cima, w para fora"""

    def __init__(self, a, b, z0):
        # a → b com o lado de fora à direita (polígono anti-horário)
        self.a, self.b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
        d = self.b - self.a
        self.L = d.length
        self.t = d.normalized()
        self.n = Vector((self.t.y, -self.t.x, 0))       # fora
        self.z0 = z0
        # quem olha de fora (de frente para −n) tem a direita em +t: u cresce de a para b
        self.o = self.a
        self.direita = self.t

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


def janela(P, M, F, u, v0, vm, hw, reg, moldura=0.075):
    """Vão em arco com moldura creme e esquadria do atlas (as janelas do quartel no modelo do Forte)"""
    cont = arco_contorno(hw + moldura, v0 - moldura * 0.6, vm, 7)
    P.poli([F.p(u + x, y, 0.014) for x, y in cont], M["creme"], para=tuple(F.n))
    cont = arco_contorno(hw, v0, vm, 7)
    topo = vm + hw
    P.poli([F.p(u + x, y, 0.028) for x, y in cont], M["esquadrias"], [uv_reg(reg, (x + hw) / (2 * hw), (y - v0) / (topo - v0)) for x, y in cont], para=tuple(F.n))


def recortar_3d(pts3, r):
    """Recorta um polígono plano 3D (não vertical) no cilindro de raio r; z interpolado no plano"""
    p2 = [(p[0], p[1]) for p in pts3]
    a, b, c = Vector(pts3[0]), Vector(pts3[1]), Vector(pts3[2])
    n = (b - a).cross(c - a)
    if abs(n.z) < 1e-9:
        return pts3
    rc = recortar_no_disco(ccw(p2), r)
    out = []
    for x, y in rc:
        z = a.z - (n.x * (x - a.x) + n.y * (y - a.y)) / n.z
        out.append((x, y, z))
    return out


def quartel(M):
    """
    A beira do quartel do Comando da 10ª Região Militar (Forte de N. S. da Assunção), do outro lado da Floriano Peixoto:
    a ala que encosta no Passeio, com as mesmas cores e janelas em arco do modelo do Forte (rosa-antigo, cordão e cimalha
    creme, folhas verdes, telhado cerâmico). Para caber inteira no disco, a ala vai do canto noroeste real (v = 10) até
    v = −12,4 e fecha em quatro águas; a face leste é a do pátio interno.
    """
    P = Peca("Quartel_Forte")
    Rt = Peca("Quartel_Forte_Telhado")
    q = REG["quartel_oeste"]
    W, E = q[0][0] + 0.05, 30.7
    S, N = -12.4, q[1][1]
    H_PAV, H = 2.45, 5.0
    zb = Z_FORTE
    caixa = [(W, S), (E, S), (E, N), (W, N)]          # anti-horário
    for i in range(4):
        a, b = caixa[i], caixa[(i + 1) % 4]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], zb), (b[0], b[1], zb), (b[0], b[1], zb + H), (a[0], a[1], zb + H)], M["rosa"], para=(n_[0], n_[1], 0))
        F = Fachada(a, b, zb)
        nb = max(1, round(F.L / 1.42))
        for k in range(nb):
            u = (k + 0.5) * F.L / nb
            janela(P, M, F, u, 0.55, 1.6, 0.27, "B")
            janela(P, M, F, u, H_PAV + 0.3, H_PAV + 1.75, 0.27, "A")
        P.juntar(bm_caixa(0.5, 0.5, H - 0.05), M["creme"], F.M(0.0, 0.0, 0.0))
    anel_friso(P, caixa, zb, zb + 0.38, 0.05, M["base"])
    anel_friso(P, caixa, zb + H_PAV - 0.02, zb + H_PAV + 0.14, 0.07, M["creme"])
    anel_friso(P, caixa, zb + H - 0.32, zb + H, 0.13, M["creme"])
    # telhado de quatro águas com beiral, cumeeira e espigões em telha clara
    B = 0.28
    e = offset_poli(caixa, B)
    zt, zr = zb + H, zb + H + 1.45
    meia = (E - W) / 2 + B
    xr = (W + E) / 2
    r1, r2 = (xr, e[0][1] + meia), (xr, e[2][1] - meia)
    for i in range(4):
        k = (i + 1) % 4
        ra = r1 if e[i][1] < (S + N) / 2 else r2
        rb = r1 if e[k][1] < (S + N) / 2 else r2
        if ra == rb:
            pts = [(e[i][0], e[i][1], zt), (e[k][0], e[k][1], zt), (ra[0], ra[1], zr)]
        else:
            pts = [(e[i][0], e[i][1], zt), (e[k][0], e[k][1], zt), (rb[0], rb[1], zr), (ra[0], ra[1], zr)]
        Rt.poli(pts, M["telha"], [(p_[1] / 1.6 if abs(e[k][0] - e[i][0]) < 0.01 else p_[0] / 1.6, p_[2] / 0.75) for p_ in pts], para=(0, 0, 1))
        n_ = direita(e[i], e[k])
        Rt.poli([(e[i][0], e[i][1], zt - 0.12), (e[k][0], e[k][1], zt - 0.12), (e[k][0], e[k][1], zt + 0.01), (e[i][0], e[i][1], zt + 0.01)], M["telha"], para=(n_[0], n_[1], 0))
        Rt.poli([(caixa[i][0], caixa[i][1], zt - 0.12), (caixa[k][0], caixa[k][1], zt - 0.12), (e[k][0], e[k][1], zt - 0.12), (e[i][0], e[i][1], zt - 0.12)], M["creme"], para=(0, 0, -1))
        rr = r1 if e[i][1] < (S + N) / 2 else r2
        Rt.juntar(bm_barra((e[i][0], e[i][1], zt + 0.03), (rr[0], rr[1], zr + 0.03), 0.06), M["cumeeira"])
    Rt.juntar(bm_barra((r1[0], r1[1], zr + 0.03), (r2[0], r2[1], zr + 0.03), 0.07), M["cumeeira"])
    reservar(caixa, 0.5)
    return P.criar(grade=(1.5, False)), Rt.criar()


def santa_casa(M):
    """
    Santa Casa de Misericórdia (relação 15829054), do outro lado da Barão do Rio Branco: sem foto, fica um volume claro
    neutro de dois pavimentos, com janelas e platibanda, recortado no comprimento para caber inteiro no disco.
    """
    P = Peca("Santa_Casa")
    f = TT(SANTA_CASA_REAL)
    x0 = min(p[0] for p in f) - 0.1
    x1 = x0 - 2.1
    y0 = math.sqrt((R_PLATO - 0.15) ** 2 - x1 * x1)
    p = [(x0, -y0), (x0, y0), (x1, y0), (x1, -y0)]
    H = 3.5
    z = Z_RUA
    P.poli([(a, b, z + H) for a, b in p], M["laje"], para=(0, 0, 1))
    for i in range(4):
        a, b = p[i], p[(i + 1) % 4]
        n_ = direita(a, b)
        P.poli([(a[0], a[1], z), (b[0], b[1], z), (b[0], b[1], z + H + 0.3), (a[0], a[1], z + H + 0.3)], M["casario"], para=(n_[0], n_[1], 0))
        F = Fachada(a, b, z)
        nb = max(1, round(F.L / 1.15))
        for k in range(nb):
            u = (k + 0.5) * F.L / nb
            for v0 in (0.45, 2.05):
                q = [(u - 0.24, v0), (u + 0.24, v0), (u + 0.24, v0 + 1.0), (u - 0.24, v0 + 1.0)]
                P.poli([F.p(xx, yy, 0.015) for xx, yy in q], M["esquadrias"], [uv_reg("B", (xx - u + 0.24) / 0.48, (yy - v0) / 1.0) for xx, yy in q], para=tuple(F.n))
    anel_friso(P, p, z, z + 0.3, 0.04, M["base"])
    anel_friso(P, p, z + 1.78, z + 1.9, 0.05, M["creme"])
    anel_friso(P, p, z + H - 0.1, z + H + 0.3, 0.1, M["creme"])
    po = offset_poli(p, -0.15)
    for i in range(4):
        j = (i + 1) % 4
        P.poli([(p[i][0], p[i][1], z + H + 0.3), (p[j][0], p[j][1], z + H + 0.3), (po[j][0], po[j][1], z + H + 0.3), (po[i][0], po[i][1], z + H + 0.3)], M["casario"], para=(0, 0, 1))
    CORES.append((0, len(P.bm.faces), "#ece4d2"))
    reservar(p, 0.3)
    return P.criar()


CORES = []
CORES_POR_PECA = {}


def predios_osm(M, nome, ids, regiao, z, hmax, tons, recorte=R_PLATO - 0.3, minimo=28.5):
    """Volumes baixos de platibanda a partir das plantas do OSM (casario e Exército), com cor pastel por prédio"""
    P = Peca(nome)
    cores = []
    k = 0
    for wid, (pts, tags) in VIAS.items():
        if "building" not in tags or (ids and wid not in ids):
            continue
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) < 3:
            continue
        mp = ccw(TT(pts))
        if min(math.hypot(*q) for q in mp) > minimo:
            continue
        cx = sum(q[0] for q in mp) / len(mp)
        cy = sum(q[1] for q in mp) / len(mp)
        if regiao is not None and not ponto_no_poligono((cx, cy), regiao):
            continue
        p = recortar_no_disco(mp, recorte)
        if len(p) < 3 or abs(area2(p)) < 1.0:
            continue
        if any(dist_poligono(q, REG["praca"]) < 0.3 for q in p):
            continue
        h = float(tags.get("height", 6.0))
        H = min(hmax, 0.8 + 0.1 * h)
        tom = tons[k % len(tons)]
        k += 1
        ini = len(P.bm.faces)
        P.poli([(x, y, z + H) for x, y in p], M["laje"], para=(0, 0, 1))
        for i in range(len(p)):
            a, b = p[i], p[(i + 1) % len(p)]
            n_ = direita(a, b)
            P.poli([(a[0], a[1], z), (b[0], b[1], z), (b[0], b[1], z + H + 0.2), (a[0], a[1], z + H + 0.2)], M["casario"], para=(n_[0], n_[1], 0))
            F = Fachada(a, b, z)
            if F.L > 1.2 and math.hypot(*a) < recorte - 0.2:
                nb = max(1, round(F.L / 1.1))
                for kk in range(nb):
                    u = (kk + 0.5) * F.L / nb
                    for v0 in [0.4 + 1.1 * j for j in range(max(1, int(H / 1.1)))]:
                        q = [(u - 0.25, v0), (u + 0.25, v0), (u + 0.25, v0 + 0.6), (u - 0.25, v0 + 0.6)]
                        P.poli([F.p(x, y, 0.015) for x, y in q], M["esquadrias"], [uv_reg("D", (x - u + 0.25) / 0.5 / 3, (y - v0) / 0.6) for x, y in q], para=tuple(F.n))
        po = offset_poli(p, -0.15)
        for i in range(len(p)):
            j = (i + 1) % len(p)
            P.poli([(p[i][0], p[i][1], z + H + 0.2), (p[j][0], p[j][1], z + H + 0.2), (po[j][0], po[j][1], z + H + 0.2), (po[i][0], po[i][1], z + H + 0.2)], M["casario"], para=(0, 0, 1))
        cores.append((ini, len(P.bm.faces), tom))
        reservar(p, 0.3)
    if not P.bm.faces:
        P.bm.free()
        return None
    CORES_POR_PECA[nome] = cores
    return P.criar()


def quadra_esportes(M):
    """Quadra poliesportiva do 2º plano (via 630998531): piso, linhas e alambrado baixo"""
    P = Peca("Quadra_Exercito")
    q = ccw(TT(QUADRA))
    p = recortar_no_disco(q, R_PLATO - 0.3)
    if len(p) < 3:
        P.bm.free()
        return None
    z = Z_2P + 0.012
    P.poli([(x, y, z) for x, y in p], M["quadra"], para=(0, 0, 1))
    pi = offset_poli(p, -0.35)
    for i in range(len(pi)):
        a, b = pi[i], pi[(i + 1) % len(pi)]
        e = offset_linha([a, b], 0.04)
        d = offset_linha([a, b], -0.04)
        P.poli([(e[0][0], e[0][1], z + 0.004), (e[1][0], e[1][1], z + 0.004), (d[1][0], d[1][1], z + 0.004), (d[0][0], d[0][1], z + 0.004)], M["faixa"], para=(0, 0, 1))
    reservar(p, 0.2)
    return P.criar()


# ———————————————————————————————————————————————— ruas

def ruas(M):
    """Dr. João Moreira (sul), Barão do Rio Branco (oeste, desce até a avenida), Floriano Peixoto (leste) e a Leste-Oeste"""
    P = Peca("Ruas_Entorno")
    traj = {}

    def rua(nome, eixo, larg, z, m=M["asfalto"], calcada=0.0, tracejado=True, raio=R_PLATO - 0.05):
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

    # Dr. João Moreira: mão única para oeste, 2 faixas
    jm = TT(R_JOAO_MOREIRA)
    rua("joao_moreira", jm, 2.3, Z_RUA, calcada=0.0)
    # Floriano Peixoto: paralelepípedo, entre o gradil leste e o quartel, termina no muro norte
    fl = [(25.6, -30.0), (25.6, REG["borda_norte"][-1][1] - 0.3)]
    rua("floriano", fl, 1.6, Z_RUA, m=M["pedra"], tracejado=False)
    # Leste-Oeste: ligação (para oeste), pista principal (para leste) e pista norte (para oeste), com canteiros
    for nome, v, sent in (("ligacao", 20.0, -1), ("principal", 23.9, 1), ("norte", 27.6, -1)):
        eixo = [(-40.0 * sent, v), (40.0 * sent, v)]
        rua(nome, eixo, 2.25, Z_AV, calcada=0.0, raio=RAIO - 0.15)
    for v0, v1 in ((18.0, 18.9), (28.75, 29.5)):
        p = recortar_no_disco([(-40, v0), (40, v0), (40, v1), (-40, v1)], RAIO - 0.15)
        if len(p) >= 3:
            P.poli([(x, y, Z_AV + 0.006) for x, y in p], M["calcada"], para=(0, 0, 1))
    # ciclovia no canteiro entre a pista principal e a norte
    p = recortar_no_disco([(-40, 25.45), (40, 25.45), (40, 25.95), (-40, 25.95)], RAIO - 0.15)
    if len(p) >= 3:
        P.poli([(x, y, Z_AV + 0.008) for x, y in p], M["corte"], para=(0, 0, 1))
    traj["barao"] = [(-26.3, -30.0), (-26.3, 9.0), (-26.3, 19.9)]
    P.criar(grade=(1.8,))
    # Barão do Rio Branco no alto (paralelepípedo) até a rampa
    B = Peca("Ruas_Barao")
    p = recortar_no_disco([(-27.6, -40), (-25.0, -40), (-25.0, 9.0), (-27.6, 9.0)], R_PLATO - 0.05)
    B.poli([(x, y, Z_RUA + 0.014) for x, y in p], M["pedra"], para=(0, 0, 1))
    B.criar(grade=(1.8,))
    reservar([(-27.6, -40), (-25.0, -40), (-25.0, 19.9), (-27.6, 19.9)], 0.1)
    return traj


# ———————————————————————————————————————————————— vegetação, mobiliário, carros e pessoas (layout para o .tsx)

def layout(traj, cafe_base, quiosque, pos_estatuas, pos_bustos, pontas_baoba):
    """Posições determinísticas (semente fixa) de tudo o que o .tsx instancia, no quadro local"""
    rnd = random.Random(1864)    # ano do início das obras do Passeio
    pr = REG["praca"]
    dentro = ccw(offset_poli(pr, -0.9))
    caminhos = [(TRAJ[v], l) for v, l, _ in CAMINHOS]

    def longe_dos_caminhos(x, y, folga):
        return all(ponto_mais_perto((x, y), e)[0] > l / 2 + folga for e, l in caminhos)

    def empurrar(x, y, folga):
        """Tira um ponto de cima dos caminhos (as árvores do OSM caem às vezes no eixo da alameda)"""
        for _ in range(6):
            mexeu = False
            for e, l in caminhos:
                d, q = ponto_mais_perto((x, y), e)
                if d < l / 2 + folga:
                    if d < 1e-3:
                        x += l / 2 + folga
                    else:
                        x, y = q[0] + (x - q[0]) / d * (l / 2 + folga), q[1] + (y - q[1]) / d * (l / 2 + folga)
                    mexeu = True
            if not mexeu:
                break
        return x, y

    def livre(x, y, r=0.0):
        if math.hypot(x, y) > RAIO - 0.5 - r * 0.6:
            return False
        for poli, folga in OCUPADO:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    arvores = []    # x, y, z, raio da copa, altura do tronco, tipo (0 redonda, 1 larga, 2 Benjamin)
    palmeiras = []  # x, y, z, altura, giro, tipo (0 carnaúba, 1 macaúba)
    # protagonistas não recebem árvore em cima
    protegidos = [(FONTE, R_FONTE_ANEL[1] + 0.6), (BAOBA, 5.0)] + [((x, y), 0.9) for x, y, _, _ in pos_estatuas] + [((x, y), 0.7) for x, y, _ in pos_bustos]
    protegidos += [(quiosque[0], quiosque[1] + 0.9)]

    def perto_protegido(x, y, r):
        return any(math.hypot(x - c[0], y - c[1]) < rr + r * 0.45 for c, rr in protegidos) or dist_poligono((x, y), cafe_base) < 0.6 + r * 0.4

    for nid, (x, y, tags) in NOS.items():
        if tags.get("natural") != "tree":
            continue
        q = T((x, y))
        esp = tags.get("species:pt", "")
        if esp == "Baobá" or tags.get("name") == "Baobá" or tags.get("species") == "Adansonia digitata":
            continue
        if esp == "Macaúba":
            q = empurrar(*q, 0.4)
            palmeiras.append((q[0], q[1], nivel(*q), 5.2, rnd.uniform(0, 6.28), 1))
            continue
        na_praca = ponto_no_poligono(q, pr)
        if na_praca:
            if not ponto_no_poligono(q, dentro):
                # puxa para dentro do gradil
                cx, cy = sum(p[0] for p in dentro) / len(dentro), sum(p[1] for p in dentro) / len(dentro)
                d = math.hypot(cx - q[0], cy - q[1])
                q = (q[0] + (cx - q[0]) / d * 1.2, q[1] + (cy - q[1]) / d * 1.2)
            tipo = TOMBADAS.get(esp, 0)
            r = {0: rnd.uniform(2.0, 2.5), 1: rnd.uniform(2.5, 2.9), 2: 3.3}[tipo] if esp else rnd.uniform(1.75, 2.35)
            h = rnd.uniform(3.2, 4.0) if tipo != 2 else 3.0
            q = empurrar(*q, 0.35)
            if perto_protegido(q[0], q[1], r):
                continue
            arvores.append((q[0], q[1], Z_PRACA, r, h, tipo if esp else rnd.choice((0, 0, 1))))
        else:
            if math.hypot(*q) > RAIO - 1.2 or not livre(q[0], q[1], 0.6):
                continue
            arvores.append((q[0], q[1], nivel(*q), rnd.uniform(1.1, 1.5), rnd.uniform(1.4, 1.9), 0))
    # completa o bosque onde a planta do OSM deixa clareiras grandes (a praça real é fechada de copas)
    tent = 0
    while tent < 3000:
        tent += 1
        x, y = rnd.uniform(-24, 24), rnd.uniform(-19, 10)
        if not ponto_no_poligono((x, y), dentro):
            continue
        r = rnd.uniform(1.7, 2.3)
        if not longe_dos_caminhos(x, y, 0.35) or perto_protegido(x, y, r):
            continue
        if any(math.hypot(x - a[0], y - a[1]) < 0.95 * (r + a[3]) for a in arvores if a[2] == Z_PRACA):
            continue
        if dist_borda((x, y), REG["borda_norte"][1:4], False) < 1.6:
            continue        # deixa a Caio Prado aberta para a vista
        arvores.append((x, y, Z_PRACA, r, rnd.uniform(3.2, 4.0), rnd.choice((0, 0, 1))))
        if sum(1 for a in arvores if a[2] == Z_PRACA) >= 33:
            break
    # carnaúbas (obra de 2020: placas e carnaúbas em homenagem aos revolucionários): fileira junto ao gradil sul
    sul = TT(GRADIL_REAL)[2:5]
    linha = offset_linha(sul, -2.5)
    for s in (30.0, 32.6, 35.2, 37.8):
        x, y, a = no_comprimento(linha, s)
        if longe_dos_caminhos(x, y, 0.3) and not perto_protegido(x, y, 0.6):
            palmeiras.append((x, y, Z_PRACA, rnd.uniform(5.2, 6.0), rnd.uniform(0, 6.28), 0))
    # 2º plano e canteiros da avenida: poucas árvores
    for x, y in ((-18.5, 14.5), (-8.0, 16.6), (2.0, 16.8), (12.5, 15.3), (20.0, 13.8)):
        if livre(x, y, 0.8):
            arvores.append((x, y, Z_2P, rnd.uniform(1.2, 1.6), rnd.uniform(1.4, 1.8), 0))
    for x in (-14.0, -4.0, 6.0, 15.0):
        y = 22.0 + rnd.uniform(-0.2, 0.2)
        if math.hypot(x, y) < RAIO - 1.5:
            arvores.append((x, y, Z_AV, rnd.uniform(1.0, 1.3), rnd.uniform(1.3, 1.7), 0))

    # postes de ferro (iluminação das alamedas, `lit=yes`): ao longo do corredor, da alameda norte e da Caio Prado
    postes = []
    for vid, passo in (("630998495", 4.6), ("630998487", 5.2), ("937444724", 4.4), ("630998489", 6.5), ("937444723", 6.5)):
        e = TRAJ[vid]
        l = dict((v, w) for v, w, _ in CAMINHOS)[vid]
        for k, (x, y, a) in enumerate(amostrar(e, passo, passo / 2)):
            s = 1 if k % 2 == 0 else -1
            if vid == "937444724":
                s = 1     # na beira sul, entre os bancos (do lado norte a mureta encosta no caminho)
            px, py = x + math.sin(a) * s * (l / 2 + 0.3), y - math.cos(a) * s * (l / 2 + 0.3)
            if not ponto_no_poligono((px, py), dentro if vid != "937444724" else pr) or perto_protegido(px, py, 0.0):
                continue
            if any(math.hypot(px - q[0], py - q[1]) < 1.2 for q in postes):
                continue
            postes.append((px, py, Z_PRACA))
    # bancos de madeira (OSM: bench, backrest, wood): na Caio Prado olhando o mar e ao longo do corredor
    bancos = []
    cp = TRAJ["937444724"]
    for x, y, a in amostrar(cp, 2.2, 1.1):
        bx, by = x + math.sin(a) * (0.95 + 0.3), y - math.cos(a) * (0.95 + 0.3)      # na beira sul da Caio Prado
        if any(math.hypot(bx - p[0], by - p[1]) < 0.7 for p in postes):
            continue
        if ponto_no_poligono((bx, by), pr):
            bancos.append((bx, by, Z_PRACA, a + math.pi))       # de costas para a praça, olhando o norte
    for vid in ("630998495", "630998487"):
        e = TRAJ[vid]
        l = dict((v, w) for v, w, _ in CAMINHOS)[vid]
        for k, (x, y, a) in enumerate(amostrar(e, 3.1, 1.9)):
            s = 1 if k % 2 else -1
            bx, by = x + math.sin(a) * s * (l / 2 + 0.35), y - math.cos(a) * s * (l / 2 + 0.35)
            if not ponto_no_poligono((bx, by), dentro) or perto_protegido(bx, by, 0.2):
                continue
            if any(math.hypot(bx - p[0], by - p[1]) < 0.8 for p in postes) or dist_poligono((bx, by), cafe_base) < 1.0:
                continue
            bancos.append((bx, by, Z_PRACA, a + (math.pi if s > 0 else 0.0)))
    # mesas do café, com guarda-sol, no piso do café
    mesas = []
    piso = piso_cafe()
    for k in range(600):
        x, y = rnd.uniform(-30, 30), rnd.uniform(-30, 30)
        if not ponto_no_poligono((x, y), offset_poli(piso, -0.45)):
            continue
        if dist_poligono((x, y), cafe_base) < 0.75 or math.hypot(x - quiosque[0][0], y - quiosque[0][1]) < quiosque[1] + 0.75:
            continue
        if any(math.hypot(x - m_[0], y - m_[1]) < 1.3 for m_ in mesas) or not longe_dos_caminhos(x, y, 0.2):
            continue
        mesas.append((x, y, Z_PRACA + 0.02))
        if len(mesas) >= 10:
            break

    carros = []
    for nome, z, passo, desl in (("joao_moreira", Z_RUA, (3.0, 6.0), (-0.55, 0.55)), ("ligacao", Z_AV, (4.5, 9.0), (-0.55, 0.55)),
                                 ("principal", Z_AV, (4.0, 8.5), (-0.55, 0.55)), ("norte", Z_AV, (4.5, 9.5), (-0.55, 0.55)),
                                 ("barao", None, (3.5, 6.5), (-0.5, 0.5))):
        eixo = traj[nome]
        for d_ in desl:
            linha = offset_linha(eixo, d_)
            s = rnd.uniform(0.5, 3.0)
            L = comprimento(linha)
            while s < L:
                x, y, a = no_comprimento(linha, s)
                lim = (RAIO - 1.2) if z == Z_AV else (R_PLATO - 1.0)
                if math.hypot(x, y) < lim:
                    zz = nivel(x, y) if z is None else z
                    carros.append((x, y, zz + 0.02, a, rnd.randrange(8)))
                s += rnd.uniform(*passo)
    # dois carros parados na Floriano Peixoto, junto ao quartel
    for y in (-12.5, -3.0):
        carros.append((26.2, y, Z_RUA + 0.02, math.pi / 2, rnd.randrange(8)))

    pessoas = []
    zonas = [
        (FONTE, 4.2, 6), ((-14.0, -4.6), 4.0, 4), ((12.0, -6.5), 3.0, 3), ((0.0, 9.0), 6.0, 5), ((-15.0, 8.8), 4.0, 3),
        ((14.0, 8.6), 4.0, 3), (BAOBA, 3.6, 3), ((2.4, -19.6), 1.6, 2), ((-10.0, -21.6), 3.0, 2), ((8.0, -22.0), 3.0, 2),
    ]
    for (cx, cy), raio, n in zonas:
        k, tent = 0, 0
        while k < n and tent < 300:
            tent += 1
            a, d = rnd.uniform(0, 2 * math.pi), raio * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if math.hypot(x - FONTE[0], y - FONTE[1]) < R_FONTE + 0.35 or math.hypot(x - BAOBA[0], y - BAOBA[1]) < 1.6:
                continue
            if dist_poligono((x, y), cafe_base) < 0.3 or any(math.hypot(x - c[0], y - c[1]) < 0.55 for c in [(e[0], e[1]) for e in pos_estatuas]):
                continue
            if ponto_no_poligono((x, y), pr) and longe_dos_caminhos(x, y, -0.15) and rnd.random() < 0.8:
                continue     # na praça, gente anda nos caminhos
            pessoas.append((x, y, nivel(x, y), rnd.uniform(0, 2 * math.pi), rnd.randrange(7)))
            k += 1
    # clientes nas mesas do café
    for x, y, z in mesas[:7]:
        for s in (-1, 1):
            if rnd.random() < 0.7:
                pessoas.append((x + 0.42 * s, y + 0.1 * s, z, rnd.uniform(0, 6.28), rnd.randrange(7)))
    return arvores, palmeiras, postes, bancos, mesas, carros, pessoas


def proxies(arvores, palmeiras, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, z, r, h, t in arvores:
        bm = bm_esfera(1.0, 8, 5)
        bm.transform(Matrix.Diagonal((r, r, r * 0.75, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, z + h + r * 0.6)))
        P.juntar(bm_cilindro(0.16, h + 0.3, 6), m, Matrix.Translation((x, y, z)))
    for x, y, z, h, g, t in palmeiras:
        P.juntar(bm_cilindro(0.13, h, 6), m, Matrix.Translation((x, y, z)))
    for x, y, z, g, _ in carros:
        P.juntar(bm_caixa(1.75, 0.8, 0.65, 0.1), m, M_em(x, y, z + 0.1, g))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada

def assar(objs, proxy):
    """Oclusão de ambiente (Cycles, CPU) em cor de vértice por canto; média por vértice, degraus de 1/40 e tinta dos prédios"""
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 96
    if cena.world is None:
        cena.world = bpy.data.worlds.new("Mundo")
    cena.world.light_settings.distance = 2.6
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
        tingir(ob, forca=0.55 if ob.name.startswith(("Chao", "Ruas")) else 0.45)


def tingir(ob, forca=0.45, sem_ao=False):
    """Converte a oclusão em cor de vértice (degraus de 1/40) e multiplica a cor pastel de cada prédio"""
    me = ob.data
    if sem_ao:
        at = me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = at
    at = me.color_attributes["AO"]
    dados = [1.0] * (len(at.data) * 4)
    if not sem_ao:
        at.data.foreach_get("color", dados)
    soma, cont = {}, {}
    for lp in me.loops:
        soma[lp.vertex_index] = soma.get(lp.vertex_index, 0.0) + dados[lp.index * 4]
        cont[lp.vertex_index] = cont.get(lp.vertex_index, 0) + 1
    tinta = {}
    for ini, fim, tom in CORES_POR_PECA.get(ob.name, []):
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


# ———————————————————————————————————————————————— composição dos protagonistas

def posicoes_estatuas():
    """Estátuas ao longo do corredor principal ("réplica greco-romana no corredor principal"), viradas para ele"""
    e = TRAJ["630998495"]
    L = comprimento(e)
    out = []
    var = 0
    for frac, lado in ((0.08, 1), (0.17, -1), (0.27, 1), (0.36, -1), (0.62, -1), (0.72, 1), (0.83, -1), (0.93, 1)):
        x, y, a = no_comprimento(e, L * frac)
        d = 2.1 / 2 + 0.8
        px, py = x + math.sin(a) * lado * d, y - math.cos(a) * lado * d
        giro = a + (math.pi if lado > 0 else 0.0)     # frente (−y local da figura) para o corredor
        out.append((px, py, giro, var % 4))
        var += 1
    # Vênus com Cupido e mais uma, junto ao anel da fonte, viradas para ela
    for ang, v in ((math.radians(150), 3), (math.radians(30), 0)):
        px, py = FONTE[0] + math.cos(ang) * (R_FONTE_ANEL[1] + 0.75), FONTE[1] + math.sin(ang) * (R_FONTE_ANEL[1] + 0.75)
        out.append((px, py, ang - math.pi / 2, v))
    return out


def posicoes_bustos():
    e = TRAJ["630998487"]
    L = comprimento(e)
    out = []
    for frac in (0.18, 0.4, 0.7):
        x, y, a = no_comprimento(e, L * frac)
        d = 1.5 / 2 + 0.6
        px, py = x + math.sin(a) * d, y - math.cos(a) * d
        out.append((px, py, a + math.pi))
    return out


# ———————————————————————————————————————————————— principal

def girar_mundo(objs):
    """Do quadro local da praça para o mundo: gira −18° em volta de z (o lado maior real está a 108°)"""
    R = Matrix.Rotation(GIRO, 4, "Z")
    for ob in objs:
        ob.data.transform(R)
        ob.data.update()


def gxy(x, y):
    c, s = math.cos(GIRO), math.sin(GIRO)
    return (x * c - y * s, x * s + y * c)


def principal():
    global FONTE, BAOBA
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    M_GLOBAL.update(M)
    REG.update(regioes())
    FONTE = T(FONTE_REAL)
    BAOBA = T(BAOBA_REAL)
    print("fonte", FONTE, "baobá", BAOBA, "praça", [tuple(round(c, 2) for c in p) for p in REG["praca"]])
    chao(M)
    pisos(M)
    muro_norte(M)
    gradil(M)
    fonte(M)
    _, pontas = baoba(M)
    pe = posicoes_estatuas()
    estatuas(M, pe)
    pb = posicoes_bustos()
    bustos(M, pb)
    _, cafe_base, quiosque = cafe(M)
    quartel(M)
    santa_casa(M)
    CORES_POR_PECA["Santa_Casa"] = list(CORES)
    traj = ruas(M)
    tons = ["#e9c98f", "#bfd3c8", "#e3b39e", "#d8cbb0", "#b7c8de", "#ead98c"]
    sul = ccw([(-45, -45), (45, -45), (45, -21.5), (-45, -21.5)])
    predios_osm(M, "Casario_Vizinho", None, sul, Z_RUA, 2.4, tons)
    predios_osm(M, "Predios_Exercito", set(EXERCITO), REG["segundo"], Z_2P, 1.5, ["#eeece4", "#e6e3d8"], minimo=31.0)
    quadra_esportes(M)
    arvores, palmeiras, postes, bancos, mesas, carros, pessoas = layout(traj, cafe_base, quiosque, pe, pb, pontas)
    print(f"árvores {len(arvores)}, palmeiras {len(palmeiras)}, postes {len(postes)}, bancos {len(bancos)}, mesas {len(mesas)}, carros {len(carros)}, pessoas {len(pessoas)}")
    if "--planta" in sys.argv:      # depuração: planta do quadro local em JSON (fora do repositório)
        dbg = {"reg": REG, "caminhos": {v: TRAJ[v] for v, _, _ in CAMINHOS}, "cafe": cafe_base, "quiosque": quiosque,
               "piso_cafe": ccw(TT(PISO_CAFE_REAL)), "estatuas": pe, "bustos": pb, "arvores": arvores, "palmeiras": palmeiras,
               "postes": postes, "bancos": bancos, "mesas": mesas, "fonte": FONTE, "baoba": BAOBA, "carros": carros, "pessoas": pessoas}
        with open(sys.argv[sys.argv.index("--planta") + 1], "w") as fh:
            json.dump(dbg, fh)
    prox = proxies(arvores, palmeiras, carros)
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name != prox.name]
    # UV planar dos pisos (textura manchada do .tsx): u = x/67 + 0,5; v = y/67 + 0,5 (menos as alamedas, em metros)
    for ob in objs:
        if not ob.name.startswith(("Chao", "Ruas")):
            continue
        me = ob.data
        uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            nome_m = me.materials[poly.material_index].name if me.materials else ""
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                if nome_m == "Mat_Chao_Caminho":
                    uv.data[li].uv = (co.x / 1.5, co.y / 1.5)
                else:
                    uv.data[li].uv = (co.x / 67 + 0.5, co.y / 67 + 0.5)
    if not SEM_BAKE:
        assar(objs, prox)
    else:
        bpy.data.objects.remove(prox)
        for ob in objs:
            tingir(ob, sem_ao=True)
    girar_mundo(objs)
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
    arq = os.path.join(SAIDA, "passeioPublico-praca.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)

    def p3(x, y, z):
        gx, gy = gxy(x, y)
        return [round(gx, 3), round(z, 3), round(-gy, 3)]

    dados = {
        "arvores": [p3(x, y, z) + [round(r, 3), round(h, 3), t] for x, y, z, r, h, t in arvores],
        "palmeiras": [p3(x, y, z) + [round(h, 3), round(g + GIRO, 3), t] for x, y, z, h, g, t in palmeiras],
        "postes": [p3(x, y, z) for x, y, z in postes],
        "bancos": [p3(x, y, z) + [round(g + GIRO, 4)] for x, y, z, g in bancos],
        "mesas": [p3(x, y, z) for x, y, z in mesas],
        "carros": [p3(x, y, z) + [round(g + GIRO, 4), k] for x, y, z, g, k in carros],
        "pessoas": [p3(x, y, z) + [round(g + GIRO, 3), k] for x, y, z, g, k in pessoas],
    }
    with open(os.path.join(SAIDA, "passeioPublico-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    print("ok", arq)


principal()
