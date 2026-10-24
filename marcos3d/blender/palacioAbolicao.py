# -*- coding: utf-8 -*-
"""
Palácio da Abolição (Meireles, Fortaleza) em miniatura: gera as peças estáticas do marco no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/palacioAbolicao.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/palacioAbolicao.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o PalacioAbolicao.tsx carrega as três):
    palacioAbolicao-pecas.glb     chão com o fosso escavado, palácio, passarela, anexo, capela, mausoléu, avenida
                                  (sem compressão, oclusão assada nas cores de vértice)
    palacioAbolicao-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    palacioAbolicao-layout.json   tubos dos pórticos, árvores, pessoas e carros (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-palacioAbolicao.md): o conjunto de Sérgio Bernardes visto do sul. Atrás, a barra
do palácio com os pórticos de tubos duplos pretos e as varandas; o fosso d'água contínuo que passa atrás dela, encosta na
ponta oeste e desce até o espelho do Mausoléu Castelo Branco, no primeiro plano à esquerda, em balanço sobre a água; o
anexo transversal ligado pela passarela, à direita da entrada; a capela de pirâmide dividida no canto nordeste; a
Av. Barão de Studart na borda oeste.

Referencial do conjunto: x = ao longo do palácio, para o leste real (rumo 108°); y = da fachada sul para a norte (rumo
18°); z = cima. Planta do OSM (pesquisa/palacioAbolicao/osm.xml; ficha) condensada: palácio × 0,5 no comprimento (84 m →
44 m, 20 módulos de 4,20 → 2,20 m) e × 0,62 na largura do corpo; anexo × 0,46 × 0,3; mausoléu × 0,48; distâncias entre os
prédios bem mais curtas (o conjunto real tem ~190 m de fundo). Alturas × ~0,8 (palácio 8,1 m na laje; OSM 10,4 m).

GIRO: as câmeras da oficina vêm todas do sul (perspectiva −32°, frente 0°, close +24°). No rumo real (GIRO = -18, norte
em −z do three) a fachada sul já olha para elas, mas o anexo cai bem no meio da frente do palácio e o mausoléu fica de
ponta para a perspectiva. Com GIRO = 12 (30° anti-horário a partir do real) o anexo passa para a direita, a fachada
fica a ~12° da vista "frente" e o mausoléu mostra o comprimento na perspectiva. O giro é rígido, sem espelho: a
avenida continua a oeste do fosso e o mausoléu a sudoeste do palácio. Para voltar ao rumo real, use GIRO = -18.
"""
import json
import math
import os
import random
import sys

import bpy  # noqa: E402  (o bmesh só existe depois do bpy)
import bmesh
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")
PREFIXO = "palacioAbolicao"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.60            # topo do terreno: alto o bastante para o fosso ter profundidade sem passar de y = 0
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
GIRO = 12.0          # graus, anti-horário visto de cima: referencial do conjunto → Blender (ver docstring)
MUNDO = Matrix.Rotation(math.radians(GIRO), 4, "Z")

# ——— medidas da miniatura (referencial do conjunto; ver docstring)
MOD = 2.2                 # módulo dos pórticos (4,20 m reais)
PX = 22.0                 # meio comprimento do palácio (20 módulos)
Y_SUL, Y_NORTE = 0.0, 8.0 # fachadas de vidro do corpo (13,64 m reais × 0,59)
VAR = 2.2                 # varandas (3,40 m reais)
BEIRAL = 0.35             # laje além da ponta das vigas
H_PISO = 0.55             # piso elevado do térreo ("acesso em piso mais elevado")
H_LAJE1 = 3.8             # fundo da laje do 2º pavimento
H_LAJE2 = 7.55            # fundo da laje de cobertura
E_LAJE = 0.28             # espessura das lajes
R_TUBO = 0.15             # tubo Mannesmann de 10" (0,25 m), engrossado para ler de longe
DX_TUBO = 0.20            # meia distância entre os dois tubos de cada pórtico
X_PASS0, X_PASS1 = 6.6, 8.8           # passarela: um módulo, entre os pórticos 13 e 14
AX0, AX1, AY0, AY1 = 2.5, 12.5, -18.5, -7.0   # anexo (26 × 47 m reais)
CAP = (20.6, 15.4, 3.0)   # capela: centro e meio lado (13 m reais)
# fosso e espelho d'água (retângulos que não se sobrepõem)
FOSSO = [
    (-25.2, 15.6, 17.6, 18.2),    # atrás do palácio (norte real), até a capela
    (-25.2, -5.0, -22.6, 15.6),   # ponta oeste do palácio, ao longo da avenida
    (-25.2, -7.6, -16.4, -5.0),   # dobra para o espelho do mausoléu
    (-16.4, -28.4, -8.6, -5.0),   # espelho do mausoléu
]
MAUS = (-14.7, -10.3, -26.8, -8.6)    # mausoléu: x0, x1, y0 (ponta do balanço), y1 (apoio)
Y_APOIO = -12.8                       # o apoio (contrapeso) vai de Y_APOIO a y1; o resto é balanço
X_CALCADA, X_PISTA = -27.0, -28.6     # Av. Barão de Studart: calçada e pista (borda oeste)
NIVEL_AGUA = Z0 - 0.38
FUNDO_FOSSO = Z0 - 0.42


# ———————————————————————————————————————————————— utilidades de plano

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
    return saida


def area(poli):
    return 0.5 * sum(poli[i][0] * poli[(i + 1) % len(poli)][1] - poli[(i + 1) % len(poli)][0] * poli[i][1] for i in range(len(poli)))


def anti_horario(poli):
    return poli if area(poli) > 0 else poli[::-1]


def simplificar(poli, tol=0.25):
    out = []
    for p in poli:
        if out and math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) < tol:
            continue
        out.append(p)
    if len(out) > 3 and math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < tol:
        out.pop()
    return out


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
    if ponto_no_poligono(p, poli):
        return 0.0
    m = 1e9
    for a, b in zip(poli, poli[1:] + poli[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        m = min(m, math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    return m


def ret(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


LIVRE_POLIS = []   # (polígono, folga): onde não nasce árvore nem gente
TUBOS = []         # tubos de aço pretos dos pórticos (ponto a, ponto b): o .tsx instancia


def reservar(poli, folga=0.5):
    LIVRE_POLIS.append((poli, folga))


def tubo(a, b):
    TUBOS.append((tuple(a), tuple(b)))


# ———————————————————————————————————————————————— materiais

def srgb_lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


MATS = {}
PROJETAR_UV = {"Mat_Cobertura_Laje", "Mat_Piso_Varanda"}


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


TINTAS = {}   # nome do material provisório → (material de base, cor)


def tinta(base, cor):
    """Material provisório: depois do bake a cor entra nas cores de vértice e a face volta para o material de base"""
    nome = f"Tinta__{base.name}__{cor.lstrip('#')}"
    if nome not in MATS:
        m = bpy.data.materials.new(nome)
        MATS[nome] = m
        TINTAS[nome] = (base, cor)
    return MATS[nome]


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

    def poli(self, pts, m, uvs=None, liso=False):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(m)
        f.smooth = liso
        if uvs:
            for l, uv in zip(f.loops, uvs):
                l[self.uv].uv = uv
        return f

    def juntar(self, bm2, m, M=None, liso=None):
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
            if uv2 is not None:
                for l, l2 in zip(nf.loops, f.loops):
                    l[self.uv].uv = l2[uv2].uv
        bm2.free()

    def criar(self):
        me = bpy.data.meshes.new(self.nome)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
        # UV em metros no referencial do conjunto (projeção pelo eixo dominante da normal) nas lajes e no piso das
        # varandas: o .tsx põe as juntas da laje, alinhadas com o módulo de 2,2 m dos pórticos (UV = metros / 4,4)
        self.bm.normal_update()
        for f in self.bm.faces:
            m = self.mats[f.material_index] if f.material_index < len(self.mats) else None
            if m is None or m.name not in PROJETAR_UV:
                continue
            n = f.normal
            for l in f.loops:
                c = l.vert.co
                if abs(n.z) > 0.6:
                    l[self.uv].uv = ((c.x + PX) / 4.4, c.y / 4.4)
                elif abs(n.x) > abs(n.y):
                    l[self.uv].uv = (c.y / 4.4, c.z / 4.4)
                else:
                    l[self.uv].uv = ((c.x + PX) / 4.4, c.z / 4.4)
        self.bm.transform(MUNDO)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.nome, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def bm_caixa(sx, sy, sz, chanfro=0.0):
    """Caixa com base em z = 0, centrada em x/y, com as arestas chanfradas"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, (v.co.z + 0.5) * sz))
    if chanfro > 0 and min(sx, sy, sz) >= 0.35:
        c = min(chanfro, sx / 4, sy / 4, sz / 4)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=c, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_prisma(pts, z0, z1, chanfro=0.0, mat_lados=1):
    """Prisma vertical da planta `pts`; topo e fundo com material 0, lados com `mat_lados`"""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in anti_horario(pts)]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if chanfro > 0:
        borda = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=borda, offset=chanfro, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    for fc in bm.faces:
        fc.material_index = 0 if abs(fc.normal.z) > 0.5 else mat_lados
    return bm


def bm_cilindro(r, h, n=16, r2=None, tampa=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tampa, cap_tris=False, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=Vector((0, 0, h / 2)), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_esfera(r, sub=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
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


def T(x, y, z=0.0, giro=0.0):
    """Matriz: gira em volta de z (graus) e leva para (x, y, z)"""
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(giro), 4, "Z")


def caixa(P, m, x0, y0, z0, x1, y1, z1, chanfro=0.0):
    """Caixa alinhada aos eixos de (x0, y0, z0) a (x1, y1, z1)"""
    P.juntar(bm_caixa(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), chanfro), m, T((x0 + x1) / 2, (y0 + y1) / 2, min(z0, z1)))


# ———————————————————————————————————————————————— atlas das fachadas (256 px, gerado aqui)

COR_VIDRO = "#58788b"      # vidro temperado (sem foto: azul-acinzentado médio, para os tubos pretos lerem na frente)
COR_CAIXILHO = "#e6e8e9"
COR_MADEIRA = "#9a6a43"
COR_CERAMICA = "#e4dccb"   # pastilha das empenas leste e oeste (cor não confirmada: bege-acinzentado neutro)
COR_CONCRETO = "#c6c2b8"   # concreto do mausoléu (tom não confirmado)

REGIOES = {
    "vidro": (0.0, 0.5, 0.25, 1.0),        # painel de vidro de um módulo × um pavimento (2,2 × 3,3 m)
    "porta": (0.25, 0.5, 0.5, 1.0),        # entrada: portas de vidro com caixilho escuro
    "basculante": (0.5, 0.5, 0.75, 1.0),   # anexo: basculantes de vidro com montantes de madeira
    "ceramica": (0.75, 0.75, 1.0, 1.0),    # pastilhas cerâmicas (um ladrilho de 1 × 1 m)
    "concreto": (0.75, 0.5, 1.0, 0.75),    # concreto com marca das tábuas da fôrma (1,6 × 1,6 m)
    "vidro_escuro": (0.0, 0.25, 0.25, 0.5),  # vidro escuro com montantes (capela, guarita)
}


def atlas_fachadas(n=256):
    px = [0.0] * (n * n * 4)
    rnd = random.Random(1970)

    def r(u0, v0, u1, v1, cor):
        c = srgb_lin(cor) if isinstance(cor, str) else cor
        for y in range(max(0, int(round(v0 * n))), min(n, int(round(v1 * n)))):
            for x in range(max(0, int(round(u0 * n))), min(n, int(round(u1 * n)))):
                i = (y * n + x) * 4
                px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    def faixa(reg, a0, a1, b0, b1, cor):
        u0, v0, u1, v1 = REGIOES[reg]
        r(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * b0, u0 + (u1 - u0) * a1, v0 + (v1 - v0) * b1, cor)

    def degrade(reg, a0, a1, b0, b1, c0, c1, passos=16):
        """Vidro com reflexo do céu: mais claro em cima"""
        k0, k1 = srgb_lin(c0), srgb_lin(c1)
        for i in range(passos):
            t = i / (passos - 1)
            c = [k0[j] + (k1[j] - k0[j]) * t for j in range(3)]
            faixa(reg, a0, a1, b0 + (b1 - b0) * i / passos, b0 + (b1 - b0) * (i + 1) / passos, c)

    # vidro: caixilho claro, dois vidros por módulo e bandeira no alto, reflexo diagonal
    faixa("vidro", 0, 1, 0, 1, COR_CAIXILHO)
    degrade("vidro", 0.04, 0.96, 0.05, 0.78, "#6f8fa3", "#a9c1ce")
    degrade("vidro", 0.04, 0.96, 0.82, 0.97, "#8aa6b6", "#b8cdd8")
    faixa("vidro", 0.485, 0.515, 0.05, 0.78, COR_CAIXILHO)
    for a in (0.12, 0.6):
        faixa("vidro", a, a + 0.06, 0.3, 0.7, "#8eaab8")

    # porta: duas folhas de vidro com caixilho escuro e bandeira
    faixa("porta", 0, 1, 0, 1, "#2b2e31")
    degrade("porta", 0.06, 0.47, 0.03, 0.74, "#5d7d90", "#93aebd")
    degrade("porta", 0.53, 0.94, 0.03, 0.74, "#5d7d90", "#93aebd")
    degrade("porta", 0.06, 0.94, 0.79, 0.96, "#7593a5", "#a3bccb")
    faixa("porta", 0.42, 0.45, 0.3, 0.45, "#c8c8c8")
    faixa("porta", 0.55, 0.58, 0.3, 0.45, "#c8c8c8")

    # basculantes: faixas horizontais de vidro com linhas escuras e montantes de madeira
    faixa("basculante", 0, 1, 0, 1, COR_MADEIRA)
    for k in range(14):
        b0 = 0.05 + k * 0.064
        cor = "#5d7b8c" if k % 2 else "#7591a0"
        for a0, a1 in ((0.06, 0.31), (0.37, 0.63), (0.69, 0.94)):
            faixa("basculante", a0, a1, b0, b0 + 0.052, cor)
            faixa("basculante", a0, a1, b0 + 0.052, b0 + 0.064, "#33424b")

    # cerâmica: 6 × 6 pastilhas com junta e leve variação de tom
    u0, v0, u1, v1 = REGIOES["ceramica"]
    base = srgb_lin(COR_CERAMICA)
    r(u0, v0, u1, v1, "#b3a892")
    q = (u1 - u0) / 6
    for i in range(6):
        for j in range(6):
            k = 0.94 + rnd.random() * 0.1
            r(u0 + i * q + 0.6 / n, v0 + j * q + 0.6 / n, u0 + (i + 1) * q - 0.6 / n, v0 + (j + 1) * q - 0.6 / n, [min(1, c * k) for c in base])

    # concreto: tábuas horizontais da fôrma com variação e juntas
    u0, v0, u1, v1 = REGIOES["concreto"]
    base = srgb_lin(COR_CONCRETO)
    tabuas = 8
    h = (v1 - v0) / tabuas
    for j in range(tabuas):
        k = 0.92 + rnd.random() * 0.14
        r(u0, v0 + j * h, u1, v0 + (j + 1) * h, [min(1, c * k) for c in base])
        r(u0, v0 + j * h, u1, v0 + j * h + 0.7 / n, [c * 0.8 for c in base])
    for i in (0.33, 0.71):
        r(u0 + (u1 - u0) * i, v0, u0 + (u1 - u0) * i + 0.7 / n, v1, [c * 0.86 for c in base])

    # vidro escuro com montantes finos
    faixa("vidro_escuro", 0, 1, 0, 1, "#2f3236")
    degrade("vidro_escuro", 0.05, 0.47, 0.04, 0.96, "#26343e", "#4a6474")
    degrade("vidro_escuro", 0.53, 0.95, 0.04, 0.96, "#26343e", "#4a6474")

    img = bpy.data.images.new("Tex_Fachadas", n, n, alpha=False)
    img.pixels.foreach_set(px)
    img.pack()
    return img


def uv_reg(reg, a, b):
    """UV dentro de uma região do atlas (a, b de 0 a 1), com 1,5 px de margem"""
    u0, v0, u1, v1 = REGIOES[reg]
    m = 1.5 / 256
    a, b = min(max(a, 0.0), 1.0), min(max(b, 0.0), 1.0)
    return (u0 + m + (u1 - u0 - 2 * m) * a, v0 + m + (v1 - v0 - 2 * m) * b)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_fachadas()
    M = {}
    M["grama"] = mat("Mat_Chao_Grama", "#7aa84f", 0.95)
    M["piso"] = mat("Mat_Chao_Piso", "#d9d3c5", 0.9)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#5d6064", 0.92)
    M["fosso"] = mat("Mat_Chao_Fosso", "#9f9b91", 0.9)
    M["meiofio"] = mat("Mat_Meio_Fio", "#e4e0d7", 0.85)
    M["faixa"] = mat("Mat_Faixa_Pintada", "#f3f2ec", 0.7)
    M["agua"] = mat("Mat_Agua", "#41b1dc", 0.1)
    M["branco"] = mat("Mat_Concreto_Branco", "#eeede8", 0.75)
    M["laje"] = mat("Mat_Cobertura_Laje", "#cdc8bd", 0.9)
    M["plinto"] = mat("Mat_Plinto", "#d8d4cb", 0.85)
    M["varanda"] = mat("Mat_Piso_Varanda", "#d6cfc1", 0.85)
    M["esquadrias"] = mat("Mat_Fachadas", "#ffffff", 0.35, 0.0, atlas)
    M["madeira"] = mat("Mat_Madeira", COR_MADEIRA, 0.7)
    M["aco"] = mat("Mat_Aco_Preto", "#1b1c1e", 0.45, 0.3)
    M["concreto"] = mat("Mat_Concreto_Aparente", COR_CONCRETO, 0.88)
    M["capela"] = mat("Mat_Concreto_Capela", "#dedad1", 0.85)
    M["arbusto"] = mat("Mat_Arbusto", "#3f6d33", 0.9)
    M["canteiros"] = mat("Mat_Canteiros", "#ffffff", 0.9)
    M["poste"] = mat("Mat_Metal_Poste", "#3a3f43", 0.45, 0.4)
    M["globo"] = mat("Mat_Globo_Luminaria", "#fbfaf4", 0.3)
    return M


# ———————————————————————————————————————————————— paredes ladrilhadas com o atlas

def direita(face):
    """Vetor normal e direita de quem olha a parede de frente, para uma face ±x/±y"""
    n = {"-y": (0.0, -1.0), "+y": (0.0, 1.0), "-x": (-1.0, 0.0), "+x": (1.0, 0.0)}[face]
    return n, (-n[1], n[0])


def ladrilhar(P, M, c0, c1, face, z0, z1, reg, passo_h, passo_v, sal=0.02):
    """
    Cobre o retângulo vertical de c0 a c1 (pontos 2D da esquerda para a direita de quem olha de fora) e de z0 a z1
    com quadros da região `reg` do atlas, cada um de ~passo_h × passo_v metros.
    """
    n, _ = direita(face)
    a, b = Vector(c0), Vector(c1)
    L = (b - a).length
    nh = max(1, round(L / passo_h))
    nv = max(1, round((z1 - z0) / passo_v))
    off = Vector(n) * sal
    for i in range(nh):
        p0 = a + (b - a) * (i / nh) + off
        p1 = a + (b - a) * ((i + 1) / nh) + off
        for j in range(nv):
            za = z0 + (z1 - z0) * j / nv
            zb = z0 + (z1 - z0) * (j + 1) / nv
            P.poli([(p0.x, p0.y, za), (p1.x, p1.y, za), (p1.x, p1.y, zb), (p0.x, p0.y, zb)], M["esquadrias"],
                   [uv_reg(reg, u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))])


def parede_lisa(P, m, c0, c1, z0, z1):
    """Quadrilátero vertical simples (fundo opaco atrás dos ladrilhos)"""
    P.poli([(c0[0], c0[1], z0), (c1[0], c1[1], z0), (c1[0], c1[1], z1), (c0[0], c0[1], z1)], m)


# ———————————————————————————————————————————————— palácio

def portico_palacio(x):
    """Pórtico de tubos duplos: pilares nas linhas das fachadas de vidro e vigas que avançam e formam as varandas"""
    zp, zt = Z0 + H_PISO, Z0 + H_LAJE2
    for d in (-DX_TUBO, DX_TUBO):
        for y in (Y_SUL - 0.24, Y_NORTE + 0.24):
            tubo((x + d, y, zp), (x + d, y, zt))
        # as vigas passam das lajes: as pontas dos pares de tubos marcam o ritmo dos pórticos nos beirais
        for z, sai in ((Z0 + H_LAJE1 - R_TUBO, 0.55), (Z0 + H_LAJE2 - R_TUBO, BEIRAL + 0.6)):
            tubo((x + d, Y_SUL - VAR - sai, z), (x + d, Y_NORTE + VAR + sai, z))


def palacio(M):
    """
    A barra do palácio (ficha: 84 × 13,64 m, módulo de 4,20 m, dois pavimentos, varandas de 3,40 m ao norte e ao sul):
    piso elevado, fachadas de vidro temperado, empenas leste e oeste cegas de cerâmica, laje do 2º pavimento que vira
    varanda com o banco de madeira na borda, laje de cobertura com beiral, e os 21 pórticos de tubos duplos pretos
    (no .tsx). Entrada no meio da fachada sul, entre dois pórticos, com escada.
    """
    P = Peca("Palacio")
    B = M["branco"]
    y0, y1 = Y_SUL - VAR, Y_NORTE + VAR
    # piso elevado (plinto) com o piso das varandas do térreo
    P.juntar(bm_prisma(ret(-PX - 0.6, y0 - 0.45, PX + 0.6, y1 + 0.45), Z0 - 0.02, Z0 + H_PISO, 0.04), [M["varanda"], M["plinto"]])
    # escada da entrada (sul) e da fachada norte
    for s, yb in ((-1, y0 - 0.45), (1, y1 + 0.45)):
        for k in range(3):
            dz = H_PISO * (k + 1) / 4
            yy = yb + s * (0.42 * (3 - k))
            caixa(P, M["plinto"], -MOD, min(yb, yy), Z0 - 0.02, MOD, max(yb, yy), Z0 + dz)
    # corpo: fundo opaco das fachadas e as empenas cegas
    XI = PX - 0.55
    caixa(P, M["laje"], -XI, Y_SUL + 0.05, Z0 + H_PISO, XI, Y_NORTE - 0.05, Z0 + H_LAJE2)
    for s in (-1, 1):
        x0, x1 = sorted((s * XI, s * (PX - 0.2)))
        caixa(P, M["laje"], x0, Y_SUL - 0.05, Z0 + H_PISO, x1, Y_NORTE + 0.05, Z0 + H_LAJE2)
        xe = s * (PX - 0.2)
        face = "+x" if s > 0 else "-x"
        c0, c1 = ((xe, Y_SUL - 0.05), (xe, Y_NORTE + 0.05)) if s > 0 else ((xe, Y_NORTE + 0.05), (xe, Y_SUL - 0.05))
        ladrilhar(P, M, c0, c1, face, Z0 + H_PISO, Z0 + H_LAJE2, "ceramica", 1.0, 1.0)
        # remate de concreto branco nas quinas da empena
        caixa(P, B, xe - 0.4, Y_SUL - 0.12, Z0 + H_PISO, xe + 0.07, Y_SUL + 0.06, Z0 + H_LAJE2)
        caixa(P, B, xe - 0.4, Y_NORTE - 0.06, Z0 + H_PISO, xe + 0.07, Y_NORTE + 0.12, Z0 + H_LAJE2)
    # fachadas de vidro (sul e norte), um quadro por módulo e por pavimento; portas no módulo do meio
    for face, y in (("-y", Y_SUL), ("+y", Y_NORTE)):
        for k in range(20):
            xa, xb = max(-XI, -PX + k * MOD), min(XI, -PX + (k + 1) * MOD)
            c0, c1 = ((xa, y), (xb, y)) if face == "-y" else ((xb, y), (xa, y))
            meio = abs((xa + xb) / 2) < MOD * 0.6
            ladrilhar(P, M, c0, c1, face, Z0 + H_PISO, Z0 + H_LAJE1, "porta" if meio else "vidro", MOD, 3.3)
            ladrilhar(P, M, c0, c1, face, Z0 + H_LAJE1 + E_LAJE, Z0 + H_LAJE2, "vidro", MOD, 3.3)
    # laje do 2º pavimento (vira varanda dos dois lados) e testeira branca
    caixa(P, B, -PX - 0.25, y0, Z0 + H_LAJE1, PX + 0.25, y1, Z0 + H_LAJE1 + E_LAJE)
    # bancos de madeira na borda das varandas de cima (ficha: "madeira em forma de bancos")
    zb = Z0 + H_LAJE1 + E_LAJE
    for yb, s in ((y0, 1), (y1, -1)):
        yi = yb + s * 0.12
        ye = yb + s * 0.62
        trechos = [(-PX, X_PASS0 - 0.1), (X_PASS1 + 0.1, PX)] if s > 0 else [(-PX, PX)]   # a passarela corta o banco
        for xa, xb in trechos:
            caixa(P, M["madeira"], xa, min(yi, ye), zb + 0.42, xb, max(yi, ye), zb + 0.5)          # assento
            caixa(P, M["madeira"], xa, min(yb, yi), zb, xb, max(yb, yi), zb + 0.9)                    # encosto/guarda
            n = max(1, round((xb - xa) / 1.1))
            for k in range(n + 1):
                x = xa + 0.2 + (xb - xa - 0.4) * k / n
                caixa(P, M["madeira"], x - 0.05, min(yi, ye), zb, x + 0.05, max(yi, ye), zb + 0.42)   # pés
    # laje de cobertura com beiral e testeira em duas faixas
    caixa(P, B, -PX - 0.55, y0 - BEIRAL - 0.25, Z0 + H_LAJE2, PX + 0.55, y1 + BEIRAL + 0.25, Z0 + H_LAJE2 + 0.42)
    caixa(P, M["laje"], -PX - 0.35, y0 - BEIRAL - 0.05, Z0 + H_LAJE2 + 0.42, PX + 0.35, y1 + BEIRAL + 0.05, Z0 + H_LAJE2 + 0.5)
    for k in range(21):
        portico_palacio(-PX + k * MOD)
    reservar(ret(-PX - 0.8, y0 - 1.9, PX + 0.8, y1 + 1.9), 0.0)
    return P.criar()


# ———————————————————————————————————————————————— passarela, anexo e a peça alta

def anexo(M):
    """
    Anexo administrativo (ficha): transversal ao palácio, mesmo sistema de pórticos de tubos duplos, sem varandas,
    fachadas longas (leste e oeste) de basculantes de vidro com montantes de madeira; pontas cegas (cerâmica, como as
    empenas do palácio: não confirmado). A passarela coberta liga o 2º pavimento do palácio ao anexo, e no pé dela fica
    a peça alta do OSM (h 20,2 m), aqui um volume neutro de concreto, mais baixo.
    """
    P = Peca("Anexo_Passarela")
    B = M["branco"]
    hp, h1, h2 = 0.3, 3.2, 6.1
    P.juntar(bm_prisma(ret(AX0 - 0.4, AY0 - 0.4, AX1 + 0.4, AY1 + 0.1), Z0 - 0.02, Z0 + hp, 0.04), [M["varanda"], M["plinto"]])
    caixa(P, M["laje"], AX0, AY0, Z0 + hp, AX1, AY1, Z0 + h2)
    nm = 6
    for face, x in (("-x", AX0), ("+x", AX1)):
        for k in range(nm):
            ya, yb = AY0 + (AY1 - AY0) * k / nm, AY0 + (AY1 - AY0) * (k + 1) / nm
            c0, c1 = ((x, yb), (x, ya)) if face == "-x" else ((x, ya), (x, yb))
            ladrilhar(P, M, c0, c1, face, Z0 + hp, Z0 + h1, "basculante", 2.0, 3.0)
            ladrilhar(P, M, c0, c1, face, Z0 + h1 + 0.25, Z0 + h2, "basculante", 2.0, 3.0)
    for face, y in (("-y", AY0), ("+y", AY1)):
        c0, c1 = ((AX0, y), (AX1, y)) if face == "-y" else ((AX1, y), (AX0, y))
        ladrilhar(P, M, c0, c1, face, Z0 + hp, Z0 + h2, "ceramica", 1.0, 1.0)
    caixa(P, B, AX0 - 0.3, AY0 - 0.3, Z0 + h1, AX1 + 0.3, AY1 + 0.3, Z0 + h1 + 0.25)
    caixa(P, B, AX0 - 0.6, AY0 - 0.6, Z0 + h2, AX1 + 0.6, AY1 + 0.6, Z0 + h2 + 0.4)
    caixa(P, M["laje"], AX0 - 0.45, AY0 - 0.45, Z0 + h2 + 0.4, AX1 + 0.45, AY1 + 0.45, Z0 + h2 + 0.47)
    # pórticos do anexo: pilares ao longo das fachadas longas, vigas atravessando
    for k in range(nm + 1):
        y = AY0 + 0.3 + (AY1 - AY0 - 0.6) * k / nm
        for d in (-DX_TUBO, DX_TUBO):
            for x in (AX0 - 0.22, AX1 + 0.22):
                tubo((x, y + d, Z0 + hp), (x, y + d, Z0 + h2))
            for z in (Z0 + h1 - R_TUBO, Z0 + h2 - R_TUBO):
                tubo((AX0 - 0.5, y + d, z), (AX1 + 0.5, y + d, z))
    # peça alta no pé da passarela (OSM way 1218912927, h 20,2 m): torre neutra de concreto
    tx0, tx1, ty0, ty1, th = X_PASS0 - 0.4, X_PASS1 + 0.4, AY1 - 2.8, AY1 + 0.05, 10.6
    caixa(P, M["concreto"], tx0, ty0, Z0, tx1, ty1, Z0 + th, 0.05)
    caixa(P, B, tx0 - 0.12, ty0 - 0.12, Z0 + th, tx1 + 0.12, ty1 + 0.12, Z0 + th + 0.3)
    for face, c0, c1 in (("-x", (tx0, ty1), (tx0, ty0)), ("+x", (tx1, ty0), (tx1, ty1)), ("-y", (tx0, ty0), (tx1, ty0)), ("+y", (tx1, ty1), (tx0, ty1))):
        ladrilhar(P, M, c0, c1, face, Z0 + h2 + 0.55, Z0 + th - 0.05, "concreto", 1.5, 1.6, 0.01)
    # passarela coberta no nível do 2º pavimento, do beiral do palácio até a torre
    ya, yb = Y_SUL - VAR, AY1 + 0.05
    caixa(P, B, X_PASS0, yb, Z0 + H_LAJE1, X_PASS1, ya, Z0 + H_LAJE1 + E_LAJE)
    caixa(P, B, X_PASS0 - 0.15, yb, Z0 + 6.3, X_PASS1 + 0.15, ya, Z0 + 6.6)
    for face, x in (("-x", X_PASS0), ("+x", X_PASS1)):
        c0, c1 = ((x, ya), (x, yb)) if face == "-x" else ((x, yb), (x, ya))
        ladrilhar(P, M, c0, c1, face, Z0 + H_LAJE1 + E_LAJE, Z0 + 6.3, "vidro", 2.2, 2.2, 0.0)
        ladrilhar(P, M, c1, c0, "+x" if face == "-x" else "-x", Z0 + H_LAJE1 + E_LAJE, Z0 + 6.3, "vidro", 2.2, 2.2, 0.0)
    ym = (ya + yb) / 2
    for d in (-DX_TUBO, DX_TUBO):
        for x in (X_PASS0 - 0.2, X_PASS1 + 0.2):
            tubo((x, ym + d, Z0), (x, ym + d, Z0 + 6.3))
        tubo((X_PASS0 - 0.4, ym + d, Z0 + H_LAJE1 - R_TUBO), (X_PASS1 + 0.4, ym + d, Z0 + H_LAJE1 - R_TUBO))
    reservar(ret(AX0 - 1.0, AY0 - 1.2, AX1 + 1.0, AY1 + 0.5), 0.0)
    reservar(ret(X_PASS0 - 0.8, AY1, X_PASS1 + 0.8, Y_SUL), 0.0)
    return P.criar()


# ———————————————————————————————————————————————— capela

def capela(M):
    """
    Capela do canto nordeste (ficha: cobertura da divisão de uma pirâmide de base quadrada; nave abaixo do nível do
    terreno): mureta baixa em volta do poço, quatro águas triangulares de concreto separadas por frestas de vidro escuro
    ao longo das arestas (interpretação de "divisão"), e uma escada descendo para a porta.
    """
    P = Peca("Capela")
    cx, cy, h = CAP
    C = M["capela"]
    caixa(P, C, cx - h - 0.35, cy - h - 0.35, Z0 - 0.02, cx + h + 0.35, cy + h + 0.35, Z0 + 0.7, 0.04)
    base_z = Z0 + 0.7
    topo = Vector((cx, cy, Z0 + 4.6))
    cantos = [Vector((cx - h, cy - h, base_z)), Vector((cx + h, cy - h, base_z)), Vector((cx + h, cy + h, base_z)), Vector((cx - h, cy + h, base_z))]
    # pirâmide interna de vidro escuro: aparece nas frestas entre as placas
    ti = topo - Vector((0, 0, 0.35))
    for i in range(4):
        a, b = cantos[i], cantos[(i + 1) % 4]
        P.poli([tuple(a), tuple(b), tuple(ti)], M["esquadrias"], [uv_reg("vidro_escuro", 0, 0), uv_reg("vidro_escuro", 1, 0), uv_reg("vidro_escuro", 0.5, 1)])
    # quatro placas triangulares de concreto, recuadas das arestas (as frestas da "divisão")
    fresta = 0.3
    for i in range(4):
        a, b = cantos[i], cantos[(i + 1) % 4]
        d_ab = (b - a).normalized()
        meio = (a + b) / 2
        a2 = a + d_ab * fresta * 1.4
        b2 = b - d_ab * fresta * 1.4
        t2 = topo + (meio - topo).normalized() * fresta * 1.4
        nrm = (b2 - a2).cross(t2 - a2).normalized()
        a2, b2, t2 = a2 + nrm * 0.06, b2 + nrm * 0.06, t2 + nrm * 0.06
        P.juntar(bm_poli_extrudado([tuple(a2), tuple(b2), tuple(t2)], tuple(-nrm * 0.16)), C)
    # remate de concreto no ápice
    P.juntar(bm_cilindro(0.3, 0.4, 8, r2=0.06), C, T(cx, cy, Z0 + 4.35))
    # escada que desce do caminho de trás do palácio até a porta (lado sul)
    for k in range(4):
        caixa(P, M["plinto"], cx - 0.9, cy - h - 1.9 + k * 0.4, Z0 - 0.02, cx + 0.9, cy - h - 1.5 + k * 0.4, Z0 + 0.12 + 0.12 * k)
    reservar(ret(cx - h - 0.6, cy - h - 2.2, cx + h + 0.6, cy + h + 0.6), 0.2)
    return P.criar()


# ———————————————————————————————————————————————— mausoléu

def mausoleu(M):
    """
    Mausoléu Castelo Branco (1972, Sérgio Bernardes; ficha): prisma alongado de concreto (38,4 × 8,4 × 4,2 m reais) em
    balanço de ~30 m sobre o espelho d'água, equilibrado por um contrapeso no apoio. Na miniatura: 18,2 m, 4,4 m de
    largura e 3,1 m de altura; apoio do lado do palácio (suposição: ficha) e o balanço apontado para o sul.
    Concreto com as tábuas da fôrma (atlas) e um rasgo de sombra baixo nas faces longas.
    """
    P = Peca("Mausoleu_Castelo_Branco")
    x0, x1, yp, ya = MAUS
    zb, zt = Z0 + 2.0, Z0 + 5.0
    Cn = M["concreto"]
    # contrapeso/apoio saindo da água, mais estreito que o prisma
    caixa(P, Cn, x0 + 1.25, Y_APOIO + 0.4, FUNDO_FOSSO, x1 - 1.25, ya - 0.7, zb, 0.05)
    caixa(P, Cn, x0 + 0.8, Y_APOIO, FUNDO_FOSSO, x1 - 0.8, ya - 0.3, NIVEL_AGUA + 0.22)
    # o prisma
    caixa(P, Cn, x0, yp, zb, x1, ya, zt, 0.06)
    # faces de concreto com as tábuas da fôrma (ladrilhos de 1,6 m)
    ladrilhar(P, M, (x0, ya), (x0, yp), "-x", zb + 0.06, zt - 0.06, "concreto", 1.6, 1.6, 0.012)
    ladrilhar(P, M, (x1, yp), (x1, ya), "+x", zb + 0.06, zt - 0.06, "concreto", 1.6, 1.6, 0.012)
    ladrilhar(P, M, (x0, yp), (x1, yp), "-y", zb + 0.06, zt - 0.06, "concreto", 1.5, 1.6, 0.012)
    # rasgo de sombra perto da base das faces longas (pingadeira)
    caixa(P, M["aco"], x0 - 0.02, yp + 0.3, zb + 0.32, x0 + 0.02, ya - 0.3, zb + 0.4)
    caixa(P, M["aco"], x1 - 0.02, yp + 0.3, zb + 0.32, x1 + 0.02, ya - 0.3, zb + 0.4)
    # cobertura: laje de concreto com borda
    caixa(P, Cn, x0 + 0.12, yp + 0.12, zt, x1 - 0.12, ya - 0.12, zt + 0.06)
    reservar(ret(x0 - 0.5, yp - 0.5, x1 + 0.5, ya + 0.5), 0.3)
    return P.criar()


# ———————————————————————————————————————————————— guarita (abrigo baixo a leste)

def guarita(M):
    """Abrigo térreo do OSM (way 1218914070, h 4,3 m) perto do acesso leste: laje branca, vidro escuro (neutro)"""
    P = Peca("Guarita")
    x0, x1, y0, y1 = 24.6, 27.4, -16.4, -9.4
    caixa(P, M["plinto"], x0, y0, Z0 - 0.02, x1, y1, Z0 + 0.2)
    caixa(P, M["laje"], x0 + 0.2, y0 + 0.2, Z0 + 0.2, x1 - 0.2, y1 - 0.2, Z0 + 2.8)
    ladrilhar(P, M, (x0 + 0.2, y1 - 0.2), (x0 + 0.2, y0 + 0.2), "-x", Z0 + 0.2, Z0 + 2.8, "vidro_escuro", 1.6, 2.6)
    ladrilhar(P, M, (x0 + 0.2, y0 + 0.2), (x1 - 0.2, y0 + 0.2), "-y", Z0 + 0.2, Z0 + 2.8, "vidro_escuro", 1.3, 2.6)
    caixa(P, M["branco"], x0 - 0.3, y0 - 0.3, Z0 + 2.8, x1 + 0.3, y1 + 0.3, Z0 + 3.15)
    reservar(ret(x0, y0, x1, y1), 0.6)
    return P.criar()


# ———————————————————————————————————————————————— chão, fosso, avenida

def cortar_fosso(ob):
    """Escava o fosso no objeto (um booleano exato por retângulo) e pinta de concreto as paredes e o fundo"""
    for i, (x0, y0, x1, y1) in enumerate(FOSSO):
        b2 = bm_caixa(x1 - x0 + 0.004, y1 - y0 + 0.004, 3.0)
        b2.transform(MUNDO @ T((x0 + x1) / 2, (y0 + y1) / 2, FUNDO_FOSSO))
        me = bpy.data.meshes.new("Cortador_Fosso")
        b2.to_mesh(me)
        b2.free()
        cort = bpy.data.objects.new("Cortador_Fosso", me)
        bpy.context.scene.collection.objects.link(cort)
        mod = ob.modifiers.new(f"fosso{i}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cort
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cort)
    me = ob.data
    for i, m in enumerate(me.materials):
        if m is None:                       # faces vindas do cortador (sem material)
            me.materials[i] = MATS["Mat_Chao_Fosso"]
    nomes = [m.name for m in me.materials]
    if "Mat_Chao_Fosso" not in nomes:
        me.materials.append(MATS["Mat_Chao_Fosso"])
        nomes.append("Mat_Chao_Fosso")
    ifosso = nomes.index("Mat_Chao_Fosso")
    for p in me.polygons:
        if max(me.vertices[v].co.z for v in p.vertices) < Z0 - 0.01:
            p.material_index = ifosso


def chao(M):
    """Disco de grama, pisos (pátio da entrada, calçadas, estacionamento), a avenida e as bordas do fosso"""
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["grama"], M["meiofio"]])
    base = g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, m, z=0.012):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.06)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=0), m)
        return poli

    # pátio da entrada (sul): da escada até a borda, entre o espelho do mausoléu e o anexo
    placa(ret(-7.4, -34.0, -1.6, -4.0), M["piso"])
    placa(ret(-PX - 0.6, -4.0, PX + 0.6, -2.6), M["piso"])
    # calçada em volta do anexo e caminho até o estacionamento e a guarita
    placa(ret(AX0 - 0.6, AY0 - 1.6, AX1 + 1.6, AY1), M["piso"])
    placa(ret(AX1 + 1.6, -12.4, 24.2, -9.8), M["piso"])
    placa(ret(14.4, -24.6, 22.4, -16.8), M["asfalto"], 0.01)
    # caminho de trás do palácio (norte) e até a capela
    placa(ret(-PX - 0.6, Y_NORTE + VAR + 0.45, PX + 0.6, Y_NORTE + VAR + 1.8), M["piso"])
    placa(ret(CAP[0] - 1.2, Y_NORTE + VAR + 1.8, CAP[0] + 1.2, CAP[1] - CAP[2] - 0.3), M["piso"])
    # Av. Barão de Studart: calçada, meio-fio e pista (só a borda do disco)
    placa(ret(X_PISTA, -40, X_CALCADA, 40), M["piso"], 0.03)
    placa(ret(-40, -40, X_PISTA, 40), M["asfalto"], 0.005)
    meia = math.sqrt(max(0.0, (RAIO - 0.3) ** 2 - X_PISTA ** 2))
    pisos.juntar(bm_caixa(0.2, 2 * meia, 0.16), M["meiofio"], T(X_PISTA, 0, Z0 - 0.01))
    reservar(ret(-40, -40, X_CALCADA + 0.3, 40), 0.0)
    # bordas (capeamento) do fosso: faixa de concreto claro só nos trechos de cada lado que dão para terra
    def agua_em(p):
        return any(r[0] - 0.01 <= p[0] <= r[2] + 0.01 and r[1] - 0.01 <= p[1] <= r[3] + 0.01 for r in FOSSO)
    for x0, y0, x1, y1 in FOSSO:
        for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            tx, ty = (b[0] - a[0]) / L, (b[1] - a[1]) / L
            nx, ny = ty, -tx                      # normal para fora (retângulo anti-horário)
            n = max(1, int(L / 0.25))
            terra = [not agua_em((a[0] + tx * L * (i + 0.5) / n + nx * 0.3, a[1] + ty * L * (i + 0.5) / n + ny * 0.3)) for i in range(n)]
            i = 0
            while i < n:
                if not terra[i]:
                    i += 1
                    continue
                j = i
                while j < n and terra[j]:
                    j += 1
                s0, s1 = L * i / n - (0.3 if i == 0 else 0), L * j / n + (0.3 if j == n else 0)
                cxm, cym = a[0] + tx * (s0 + s1) / 2 + nx * 0.15, a[1] + ty * (s0 + s1) / 2 + ny * 0.15
                if math.hypot(cxm, cym) < RAIO - 0.4:
                    pisos.juntar(bm_caixa(s1 - s0, 0.3, 0.08), M["meiofio"], T(cxm, cym, Z0 - 0.02, math.degrees(math.atan2(ty, tx))))
                i = j
        reservar(ret(x0, y0, x1, y1), 0.6)
    ob_pisos = pisos.criar()
    cortar_fosso(base)
    # água do fosso e do espelho
    agua = Peca("Agua_Fosso")
    for x0, y0, x1, y1 in FOSSO:
        poli = simplificar(recortar_no_disco(ret(x0, y0, x1, y1), RAIO - 0.2), 0.05)
        agua.poli([(x, y, NIVEL_AGUA) for x, y in anti_horario(poli)], M["agua"])
    agua.criar()


# ———————————————————————————————————————————————— jardim, postes

def jardim(M):
    """Canteiros baixos de arbustos junto ao palácio e à capela, e postes no pátio da entrada (desenho neutro)"""
    P = Peca("Jardim_Postes")
    rnd = random.Random(1972)
    # massas de arbustos em faixas ao longo do caminho de trás e da borda do fosso (vegetação nativa: genérica)
    for k in range(18):
        x = -21.0 + k * 2.3 + rnd.uniform(-0.3, 0.3)
        if x > 16.5:
            break
        y = 14.4 + rnd.uniform(-0.2, 0.25)
        r = rnd.uniform(0.6, 0.9)
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r * 1.3, r, r * 0.7, 1)))
        P.juntar(bm, M["arbusto"], T(x, y, Z0 + r * 0.3))
    for k in range(7):
        y = -3.0 + k * 2.5
        r = rnd.uniform(0.55, 0.8)
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r * 1.3, r * 0.7, 1)))
        P.juntar(bm, M["arbusto"], T(-26.2, y, Z0 + r * 0.3))
    # canteiros dos dois lados do pátio da entrada: massas baixas de arbustos com flores (desenho e espécies neutros)
    cores = ["#5d8f3e", "#d0a43a", "#4e7d36", "#b5503e", "#5d8f3e", "#a274b4", "#4e7d36"]
    for i, (x0, y0, x1, y1) in enumerate(((-7.0, -15.0, -6.0, -6.5), (-3.0, -31.0, -2.0, -22.0), (-7.0, -31.0, -6.0, -19.0))):
        n = int((y1 - y0) / 0.9)
        for k in range(n):
            y = y0 + (y1 - y0) * (k + 0.5) / n
            r = rnd.uniform(0.42, 0.55)
            bm = bm_esfera(1.0, 1)
            bm.transform(Matrix.Diagonal((r, r * 1.2, r * 0.75, 1)))
            P.juntar(bm, tinta(M["canteiros"], cores[(i + k) % len(cores)]), T((x0 + x1) / 2, y, Z0 + r * 0.35))
    # postes de luz no pátio e no caminho
    # postes altos da Av. Barão de Studart, na calçada, com o braço sobre a pista
    for y in (-6.0, 8.0):
        P.juntar(bm_cilindro(0.12, 7.0, 8, r2=0.08), M["poste"], T(X_PISTA + 0.45, y, Z0))
        P.juntar(bm_caixa(2.2, 0.12, 0.12), M["poste"], T(X_PISTA + 0.45 - 1.0, y, Z0 + 6.9))
        P.juntar(bm_caixa(0.6, 0.3, 0.14), M["globo"], T(X_PISTA + 0.45 - 2.0, y, Z0 + 6.8))
    postes = [(-7.0, -6.0), (-7.0, -16.0), (-7.0, -26.0), (-2.2, -30.5), (16.0, -11.0), (22.6, -11.0), (-12.0, 12.6), (4.0, 12.6), (14.0, 12.6)]
    for x, y in postes:
        P.juntar(bm_cilindro(0.16, 0.4, 8, r2=0.11), M["poste"], T(x, y, Z0))
        P.juntar(bm_cilindro(0.06, 3.3, 8, r2=0.05), M["poste"], T(x, y, Z0 + 0.4))
        P.juntar(bm_esfera(0.26, 2), M["globo"], T(x, y, Z0 + 3.95), liso=True)
    return P.criar(), postes


# ———————————————————————————————————————————————— vegetação, gente e carros (layout para o .tsx)

def layout(postes):
    """Posições determinísticas (referencial do conjunto; viram coordenadas do three no fim)"""
    rnd = random.Random(1970)

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.4 - r * 1.3:     # a copa (massas deslocadas) não passa da borda
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    arvores = []   # (x, y, altura do tronco, raio da copa, tipo)
    # vegetação densa de espécies nativas além do fosso (ficha), massas a leste e no fundo; poucas na frente
    zonas = [((-12.0, 25.5), (9.0, 5.0), 9), ((6.0, 25.0), (8.0, 4.0), 6), ((27.0, 5.0), (3.5, 8.0), 6),
             ((28.0, -4.5), (3.0, 3.0), 2), ((10.0, -28.5), (5.0, 2.5), 3),
             ((-23.0, -17.5), (2.0, 2.5), 2), ((19.0, -27.5), (3.0, 2.0), 1), ((-22.0, 22.5), (4.0, 3.0), 3)]
    for (cx, cy), (ax, ay), n in zonas:
        k = tent = 0
        while k < n and tent < 600:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            r = rnd.uniform(1.4, 2.2)
            if not livre(x, y, r) or any(math.hypot(x - q[0], y - q[1]) < 0.8 * (r + q[3]) for q in arvores):
                continue
            arvores.append((x, y, rnd.uniform(1.4, 2.4), r, rnd.randrange(3)))
            k += 1
    # árvores da calçada da Av. Barão de Studart (OSM: fileira no canteiro e na calçada), só atrás do palácio
    for y in (2.0, 9.0, 15.0):
        if math.hypot(-27.8, y) + 1.5 * 1.3 < RAIO - 0.3:
            arvores.append((-27.8, y, 2.2, 1.5, 1))
    pessoas = []   # (x, y, z, giro, cor)
    zp = Z0 + H_PISO
    zv = Z0 + H_LAJE1 + E_LAJE
    zonas_p = [((-4.5, -12.0), (2.3, 8.0), Z0, 7), ((0.0, -3.4), (8.0, 0.5), Z0, 5),
               ((-10.0, -1.2), (10.0, 0.6), zp, 5), ((9.0, -1.2), (11.0, 0.6), zp, 4),
               ((-6.0, -0.9), (12.0, 0.4), zv, 4), ((2.0, Y_NORTE + 1.0), (16.0, 0.3), zv, 3),
               ((0.0, 11.8), (18.0, 0.4), Z0, 4), ((-27.8, 0.0), (0.4, 12.0), Z0, 3), ((7.5, -20.2), (5.0, 0.6), Z0, 3)]
    for (cx, cy), (ax, ay), z, n in zonas_p:
        k = tent = 0
        while k < n and tent < 800:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            if z == Z0 and any(r[0] - 0.4 < x < r[2] + 0.4 and r[1] - 0.4 < y < r[3] + 0.4 for r in FOSSO):
                continue
            if z == Z0 and (AX0 - 0.3 < x < AX1 + 0.3 and AY0 - 0.3 < y < AY1 + 0.3):
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.7 for p in pessoas):
                continue
            pessoas.append((x, y, z, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    carros = []   # (x, y, giro, cor) — na avenida (mão para o sul, rumo 198°) e no estacionamento
    for y, k in ((-9.0, 0), (-1.0, 3), (7.5, 5)):
        carros.append((X_PISTA - 1.7, y, 90.0, k))
    for x, k in ((15.6, 1), (18.0, 4), (20.4, 2)):
        carros.append((x, -21.6, 90.0 if x < 19 else -90.0, k))
    return arvores, pessoas, carros


def proxies(arvores, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r, t in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.8, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h + r * 0.8))
        P.juntar(bm_cilindro(0.2, h + 0.3, 6), m, T(x, y, Z0))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(3.6, 1.6, 1.3), m, T(x, y, Z0, g))
    for a, b in TUBOS:
        a, b = Vector(a), Vector(b)
        d = b - a
        bm = bm_caixa(d.length, R_TUBO * 2, R_TUBO * 2)
        bmesh.ops.translate(bm, vec=Vector((d.length / 2, 0, -R_TUBO)), verts=bm.verts)
        q = Vector((1, 0, 0)).rotation_difference(d.normalized())
        P.juntar(bm, m, Matrix.Translation(a) @ q.to_matrix().to_4x4())
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada e tintas

def assar(objs_vertice, objs_chao, proxy):
    """Oclusão de ambiente no Cycles (CPU): nas cores de vértice das peças (faixa 0,55–1) e numa imagem 256 do chão"""
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 96
    if cena.world is None:
        cena.world = bpy.data.worlds.new("Mundo")
    cena.world.light_settings.distance = 2.4
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs_vertice:
        me = ob.data
        at = me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = at
        try:
            me.color_attributes.render_color_index = me.color_attributes.find("AO")
        except AttributeError:
            pass
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs_vertice[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
    for ob in objs_vertice:
        at = ob.data.color_attributes["AO"]
        for d in at.data:
            a = d.color[0]
            k = 0.55 + 0.45 * (a ** 0.85)
            d.color = (k, k, k, 1.0)
    for ob in objs_chao:
        ob.hide_render = True
    bm = bm_cilindro(RAIO, 0.0001, 96, tampa=True)
    for f in list(bm.faces):
        if f.normal.z < 0.5:
            bm.faces.remove(f)
    me = bpy.data.meshes.new("Proxy_Chao_AO")
    bm.to_mesh(me)
    bm.free()
    uv = me.uv_layers.new(name="UVMap")
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = (co.x / LADO_AO + 0.5, co.y / LADO_AO + 0.5)
    placa = bpy.data.objects.new("Proxy_Chao_AO", me)
    placa.location.z = Z0 + 0.05
    cena.collection.objects.link(placa)
    img = bpy.data.images.new("Tex_AO_Chao", 256, 256, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    m = bpy.data.materials.new("Mat_Proxy_AO")
    if m.node_tree is None:
        m.use_nodes = True
    no = m.node_tree.nodes.new("ShaderNodeTexImage")
    no.image = img
    m.node_tree.nodes.active = no
    me.materials.append(m)
    bpy.ops.object.select_all(action="DESELECT")
    placa.select_set(True)
    bpy.context.view_layer.objects.active = placa
    bpy.ops.object.bake(type="AO", target="IMAGE_TEXTURES", margin=4, use_clear=True)
    img.filepath_raw = os.path.join(SAIDA, f"{PREFIXO}-ao-chao.jpg")
    img.file_format = "JPEG"
    img.save(filepath=img.filepath_raw, quality=88)
    for ob in objs_chao:
        ob.hide_render = False
    bpy.data.objects.remove(placa)
    bpy.data.objects.remove(proxy)


def aplicar_tintas(objs):
    """Pinta as faces marcadas com `tinta()`: multiplica a cor nas cores de vértice e devolve a face ao material de base"""
    for ob in objs:
        me = ob.data
        if "AO" not in me.color_attributes:
            at = me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
            for d in at.data:
                d.color = (1.0, 1.0, 1.0, 1.0)
        at = me.color_attributes["AO"]
        me.color_attributes.active_color = at
        nomes = [m.name if m else "" for m in me.materials]
        base_idx = {}
        for nome in nomes:
            if nome in TINTAS:
                base = TINTAS[nome][0]
                if base.name not in [m.name for m in me.materials if m]:
                    me.materials.append(base)
                base_idx[nome] = [m.name if m else "" for m in me.materials].index(base.name)
        for poly in me.polygons:
            nome = nomes[poly.material_index] if poly.material_index < len(nomes) else ""
            if nome not in TINTAS:
                continue
            fator = srgb_lin(TINTAS[nome][1])
            poly.material_index = base_idx[nome]
            for li in poly.loop_indices:
                c = at.data[li].color
                at.data[li].color = (min(1.0, c[0] * fator[0]), min(1.0, c[1] * fator[1]), min(1.0, c[2] * fator[2]), 1.0)
        usados = {p.material_index for p in me.polygons}
        for i in range(len(me.materials) - 1, -1, -1):
            if i not in usados and me.materials[i] and me.materials[i].name.startswith("Tinta__"):
                me.materials.pop(index=i)


# ———————————————————————————————————————————————— principal

def no_mundo(x, y):
    v = MUNDO @ Vector((x, y, 0))
    return v.x, v.y


def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    chao(M)
    obs = [palacio(M), anexo(M), capela(M), mausoleu(M), guarita(M)]
    jd, postes = jardim(M)
    obs.append(jd)
    arvores, pessoas, carros = layout(postes)
    print(f"árvores {len(arvores)}, pessoas {len(pessoas)}, carros {len(carros)}, tubos {len(TUBOS)}")
    prox = proxies(arvores, carros)
    chao_objs = [bpy.data.objects[n] for n in ("Chao_Base", "Chao_Pisos")]
    for ob in chao_objs:
        me = ob.data
        uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
        for lp in me.loops:
            co = me.vertices[lp.vertex_index].co
            uv.data[lp.index].uv = (co.x / LADO_AO + 0.5, co.y / LADO_AO + 0.5)
    if not SEM_BAKE:
        assar(obs, chao_objs, prox)
    else:
        bpy.data.objects.remove(prox)
    aplicar_tintas(obs)
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32), keep_sharp_edges=True)
    for nome in list(bpy.data.materials.keys()):
        if nome.startswith("Mat_Proxy") or nome.startswith("Tinta__"):
            bpy.data.materials.remove(bpy.data.materials[nome])
    for ob in obs:
        ob.data.color_attributes.active_color = ob.data.color_attributes["AO"]
    arq = os.path.join(SAIDA, f"{PREFIXO}-pecas.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    tres = lambda x, y: (round(no_mundo(x, y)[0], 3), round(-no_mundo(x, y)[1], 3))
    rad = lambda g: round(math.radians(g + GIRO), 3)

    def ponto3(p):
        x, z = tres(p[0], p[1])
        return [x, round(p[2], 3), z]

    dados = {
        "tubos": [ponto3(a) + ponto3(b) for a, b in TUBOS],
        "arvores": [[tres(x, y)[0], round(Z0 + h, 3), tres(x, y)[1], round(r, 3), t] for x, y, h, r, t in arvores],
        "pessoas": [[tres(x, y)[0], round(z, 3), tres(x, y)[1], rad(g), k] for x, y, z, g, k in pessoas],
        "carros": [[*tres(x, y), rad(g), k] for x, y, g, k in carros],
        "chao": {"lado": LADO_AO, "z0": Z0},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
