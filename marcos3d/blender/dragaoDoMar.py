# -*- coding: utf-8 -*-
"""
Centro Dragão do Mar de Arte e Cultura em miniatura: gera as peças estáticas do marco no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/dragaoDoMar.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/dragaoDoMar.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o DragaoDoMar.tsx carrega as três):
    dragaoDoMar-pecas.glb      chão, museu, planetário, torres, passarelas, rampa, casarões, anfiteatro (sem compressão,
                               com a oclusão de ambiente assada nas cores de vértice)
    dragaoDoMar-ao-chao.jpg    oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    dragaoDoMar-layout.json    árvores, palmeiras e pessoas (o .tsx instancia), já em coordenadas do three

Recorte: o miolo do complexo entre o museu (oeste), o Planetário, a rampa curva e o Anfiteatro (norte), a Praça Almirante
Saldanha (leste) e, do outro lado do calçadão da Rua Dragão do Mar, os casarões, a Torre do Café, o Espaço Rogaciano Leite
Filho e a torre sul com a Passarela Vermelha (sul, de frente para a câmera). A planta do OSM (pesquisa/dragaoDoMar/osm.xml)
é levada para a miniatura por `mapa()`: centro em (−12; −7) m reais, escala K = 0,56 até 44 m e compressão radial suave
(0,38) além disso. Planetário e torres crescem 1,3–1,45×; alturas ~0,62 da real (exagero de ~1,1× sobre K).
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
OSM = os.path.join(AQUI, "..", "pesquisa", "dragaoDoMar", "osm.xml")
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do piso: tudo pousa aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
LAT, LNG = -3.7216677, -38.5201742
CX, CY, K, R1, K2 = -12.0, -7.0, 0.56, 44.0, 0.38   # recorte e escala (ver docstring)
HF = 0.62            # fator das alturas

# medidas da miniatura usadas em várias peças
Y_FRENTE_CASAROES = -11.5    # alinhamento das fachadas dos casarões (lado sul do calçadão)
Y_FRENTE_MUSEU = -0.9        # testada do braço do museu onde pousa a passarela
H_TERRACO = 3.9              # piso do terraço do museu, das passarelas e do início da rampa
PLAN_C = Vector((2.9, 12.5, 0.0))   # centro do Planetário (OSM)
TORRE_CAFE = Vector((-7.6, -12.7, 0.0))
TORRE_SUL = Vector((-8.0, -28.2, 0.0))
LADO_TORRE = 3.0


def mapa(p):
    """Planta real (m em volta do ponto do tour, x leste, y norte) → miniatura (centro, escala e compressão radial)"""
    x, y = p[0] - CX, p[1] - CY
    r = math.hypot(x, y)
    if r < 1e-9:
        return (0.0, 0.0)
    rm = K * r if r < R1 else K * R1 + (r - R1) * K2
    return (x / r * rm, y / r * rm)


# ———————————————————————————————————————————————— OSM

def carregar_osm():
    raiz = ET.parse(OSM).getroot()
    cl = math.cos(math.radians(LAT))
    nos = {n.get("id"): ((float(n.get("lon")) - LNG) * cl * 111320, (float(n.get("lat")) - LAT) * 110540) for n in raiz.findall("node")}
    vias = {}
    for w in raiz.findall("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        vias[w.get("id")] = (tags, [nos[nd.get("ref")] for nd in w.findall("nd") if nd.get("ref") in nos])
    arvores = []
    for n in raiz.findall("node"):
        tags = {t.get("k"): t.get("v") for t in n.findall("tag")}
        if tags.get("natural") == "tree":
            arvores.append(nos[n.get("id")])
    return vias, arvores


def anel(vias, ids):
    """Encadeia as vias de um multipolígono (pelas pontas) num anel fechado"""
    pedacos = [list(vias[i][1]) for i in ids if i in vias]
    anel_ = pedacos.pop(0)
    while pedacos:
        fim = anel_[-1]
        melhor, inv, dmin = None, False, 1e9
        for k, p in enumerate(pedacos):
            for invertido, ponta in ((False, p[0]), (True, p[-1])):
                d = math.hypot(ponta[0] - fim[0], ponta[1] - fim[1])
                if d < dmin:
                    melhor, inv, dmin = k, invertido, d
        p = pedacos.pop(melhor)
        anel_ += (p[::-1] if inv else p)[1:]
    if math.hypot(anel_[0][0] - anel_[-1][0], anel_[0][1] - anel_[-1][1]) < 0.05:
        anel_.pop()
    return anel_


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
    """Tira vértices quase colineares ou muito próximos (planta do OSM depois da escala)"""
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


def reservar(poli, folga=0.5):
    LIVRE_POLIS.append((poli, folga))


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


TINTAS = {}   # nome do material provisório → (material de base, cor)


def tinta(base, cor):
    """
    Material provisório que marca as faces a pintar com `cor` por cima do material `base` (branco). Depois do bake, a cor
    entra nas cores de vértice (junto com a oclusão) e a face volta para o material de base: muitas cores, um material só.
    """
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

    def quad_uv(self, pts, m, reg, rep=(1.0, 1.0)):
        """Quadrilátero (ordem: base esq., base dir., topo dir., topo esq.) com UV numa região do atlas"""
        return self.poli(pts, m, [uv_reg(reg, a * rep[0], b * rep[1]) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])

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

    def criar(self):
        me = bpy.data.meshes.new(self.nome)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
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


def bm_torno(perfil, n=32, a0=0.0, a1=2 * math.pi, fechar=True):
    """Superfície de revolução de um perfil [(r, z), ...] em volta do eixo z (normais para fora se o perfil sobe)"""
    bm = bmesh.new()
    passos = n if fechar else n + 1
    aneis = []
    for i in range(passos):
        a = a0 + (a1 - a0) * i / n
        ca, sa = math.cos(a), math.sin(a)
        aneis.append([bm.verts.new((r * ca, r * sa, z)) if r > 1e-6 else None for r, z in perfil])
    topo = {}
    for j, (r, z) in enumerate(perfil):
        if r <= 1e-6:
            topo[j] = bm.verts.new((0, 0, z))
    for i in range(n):
        A, B = aneis[i], aneis[(i + 1) % passos]
        for j in range(len(perfil) - 1):
            a0v, a1v, b0v, b1v = A[j], A[j + 1], B[j], B[j + 1]
            if a0v is None:
                bm.faces.new([topo[j], b1v, a1v])
            elif a1v is None:
                bm.faces.new([a0v, b0v, topo[j + 1]])
            else:
                bm.faces.new([a0v, b0v, b1v, a1v])
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


def M_em(x, y, z=0.0, giro_graus=0.0):
    """Matriz: gira em volta de z (graus, anti-horário visto de cima) e leva para (x, y, z)"""
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(giro_graus), 4, "Z")


def barra(P, a, b, esp, m, esp2=None):
    """Perfil de seção retangular (esp × esp2) de a até b: banzos, montantes e diagonais das treliças"""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    if L < 1e-4:
        return
    bm = bm_caixa(L, esp, esp2 or esp)
    bmesh.ops.translate(bm, vec=Vector((L / 2, 0, -(esp2 or esp) / 2)), verts=bm.verts)
    q = Vector((1, 0, 0)).rotation_difference(d.normalized())
    P.juntar(bm, m, Matrix.Translation(a) @ q.to_matrix().to_4x4())


# ———————————————————————————————————————————————— texturas geradas aqui

def atlas_esquadrias(n=256):
    """
    Atlas 256 × 256 (V para cima, como no Blender). Regiões (u0, v0, u1, v1):
      porta   (0,    0,75, 0,25, 1)    porta de casarão: verga em arco, folhas de madeira vermelha, moldura branca
      janela  (0,25, 0,75, 0,5,  1)    janela de casarão em arco com venezianas verdes e bandeira
      telha   (0,    0,5,  0,5,  0,75) fiadas de telha (base clara; a cor vem do material)
      vidro   (0,5,  0,5,  0,75, 1)    vão alto do museu: vidro escuro com caixilho branco
      furos   (0,75, 0,5,  1,    1)    parede branca com furos quadrados (alto das torres e empenas)
      grade   (0,    0,25, 0,5,  0,5)  guarda-corpo branco em X da rampa e dos terraços
      xadrez  (0,    0,    0,25, 0,25) piso xadrez preto e branco sob o Planetário
      balaus  (0,25, 0,    0,5,  0,25) platibanda com balaústres
      fita    (0,5,  0,    1,    0,5)  fita de janelas genérica (fundos)
    """
    px = [0.0] * (n * n * 4)

    def r(u0, v0, u1, v1, cor):
        c = srgb_lin(cor)
        for y in range(max(0, int(v0 * n)), min(n, int(v1 * n))):
            for x in range(max(0, int(u0 * n)), min(n, int(u1 * n))):
                i = (y * n + x) * 4
                px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    def arco(u0, v0, u1, v1, vm, cor):
        """Abertura com topo em arco pleno: retângulo até vm e meia elipse até v1"""
        c = srgb_lin(cor)
        cx, rx = (u0 + u1) / 2, (u1 - u0) / 2
        for y in range(int(v0 * n), int(v1 * n)):
            vv = (y + 0.5) / n
            for x in range(int(u0 * n), int(u1 * n)):
                uu = (x + 0.5) / n
                if vv <= vm or ((uu - cx) / rx) ** 2 + ((vv - vm) / (v1 - vm)) ** 2 <= 1:
                    i = (y * n + x) * 4
                    px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    # porta de casarão
    r(0, 0.75, 0.25, 1, "#f3f0e8")
    arco(0.03, 0.755, 0.22, 0.985, 0.92, "#f7f5ef")
    arco(0.045, 0.755, 0.205, 0.975, 0.92, "#b3302b")
    r(0.123, 0.755, 0.127, 0.91, "#7e211e")
    for v in (0.80, 0.86):
        r(0.06, v, 0.11, v + 0.035, "#9c2924")
        r(0.14, v, 0.19, v + 0.035, "#9c2924")
    arco(0.06, 0.925, 0.19, 0.97, 0.935, "#3b4148")
    # janela de casarão: venezianas verde-escuras, bandeira de vidro
    r(0.25, 0.75, 0.5, 1, "#f3f0e8")
    arco(0.285, 0.78, 0.465, 0.985, 0.93, "#f7f5ef")
    arco(0.3, 0.79, 0.45, 0.975, 0.93, "#2f5a4a")
    for k in range(9):
        v = 0.80 + k * 0.014
        r(0.3, v, 0.45, v + 0.004, "#244538")
    r(0.373, 0.79, 0.377, 0.93, "#f3f0e8")
    arco(0.3, 0.935, 0.45, 0.975, 0.945, "#3b4148")
    # telha: fiadas claras com sombra embaixo de cada uma e capas alternadas
    r(0, 0.5, 0.5, 0.75, "#f4ece6")
    for k in range(8):
        v = 0.5 + k * 0.03125
        r(0, v, 0.5, v + 0.006, "#b9aaa2")
        for j in range(16):
            u = j / 32 + (k % 2) / 64
            r(u, v + 0.006, u + 0.004, v + 0.03, "#d9cbc3")
    # vão do museu: vidro escuro, caixilho branco, bandeira
    r(0.5, 0.5, 0.75, 1, "#f1f0eb")
    r(0.515, 0.52, 0.735, 0.98, "#2c3742")
    r(0.515, 0.86, 0.735, 0.87, "#f1f0eb")
    r(0.623, 0.52, 0.627, 0.86, "#f1f0eb")
    r(0.52, 0.87, 0.73, 0.975, "#4f6273")
    # parede com furos quadrados (como as empenas e o alto das torres)
    r(0.75, 0.5, 1, 1, "#f1f0eb")
    for ci in range(4):
        for li in range(8):
            u = 0.765 + ci * 0.059
            v = 0.515 + li * 0.06
            r(u, v, u + 0.03, v + 0.032, "#2b2f35")
    # guarda-corpo em X: fundo cinza-azulado (o vazio) com montantes, corrimão e X brancos
    r(0, 0.25, 0.5, 0.5, "#c3cbd2")
    for k in range(5):
        u = k * 0.125
        r(max(0, u - 0.006), 0.25, u + 0.006, 0.5, "#f6f5f0")
    r(0, 0.47, 0.5, 0.5, "#f6f5f0")
    r(0, 0.25, 0.5, 0.265, "#f6f5f0")
    for y in range(int(0.265 * n), int(0.47 * n)):
        t = (y / n - 0.265) / (0.47 - 0.265)
        for k in range(4):
            for uu in (k * 0.125 + t * 0.125, (k + 1) * 0.125 - t * 0.125):
                x = int(uu * n)
                for xx in (x - 2, x - 1, x, x + 1, x + 2):
                    if 0 <= xx < n // 2:
                        i = (y * n + xx) * 4
                        c = srgb_lin("#f6f5f0")
                        px[i:i + 4] = [c[0], c[1], c[2], 1.0]
    # xadrez 4 × 4
    for ci in range(4):
        for li in range(4):
            r(ci / 16, li / 16, (ci + 1) / 16, (li + 1) / 16, "#1f2124" if (ci + li) % 2 else "#efeee9")
    # platibanda com balaústres
    r(0.25, 0, 0.5, 0.25, "#f3f0e8")
    for k in range(10):
        u = 0.255 + k * 0.024
        r(u + 0.004, 0.05, u + 0.016, 0.19, "#55504b")
    # fita de janelas genérica
    r(0.5, 0, 1, 0.5, "#efeee9")
    for ci in range(6):
        u0 = 0.5 + ci / 12 + 0.008
        r(u0, 0.03, u0 + 1 / 12 - 0.014, 0.47, "#3d4b59")
        r(u0, 0.38, u0 + 1 / 12 - 0.014, 0.47, "#62788b")
    img = bpy.data.images.new("Tex_Esquadrias", n, n, alpha=False)
    img.pixels.foreach_set(px)
    img.pack()
    return img


REGIOES = {
    "porta": (0.0, 0.75, 0.25, 1.0), "janela": (0.25, 0.75, 0.5, 1.0), "telha": (0.0, 0.5, 0.5, 0.75),
    "vidro": (0.5, 0.5, 0.75, 1.0), "furos": (0.75, 0.5, 1.0, 1.0), "grade": (0.0, 0.25, 0.5, 0.5),
    "xadrez": (0.0, 0.0, 0.25, 0.25), "balaus": (0.25, 0.0, 0.5, 0.25), "fita": (0.5, 0.0, 1.0, 0.5),
}


def uv_reg(reg, a, b):
    """UV dentro de uma região do atlas (a, b de 0 a 1), com 1,5 px de margem; a > 1 não repete (fica na borda)"""
    u0, v0, u1, v1 = REGIOES[reg]
    m = 1.5 / 256
    a, b = min(max(a, 0.0), 1.0), min(max(b, 0.0), 1.0)
    return (u0 + m + (u1 - u0 - 2 * m) * a, v0 + m + (v1 - v0 - 2 * m) * b)


# atlas dos murais e letreiros (desenhado em canvas no .tsx, 512 × 256): regiões em pixels, y para baixo
MURAIS = {
    "retrato": (0, 0, 256, 256),
    "peixes": (256, 0, 512, 128),
    "letreiro": (256, 128, 512, 176),
    "azul": (256, 176, 512, 256),
}


def uv_mural(reg, a, b):
    x0, y0, x1, y1 = MURAIS[reg]
    return ((x0 + (x1 - x0) * a) / 512, 1 - (y0 + (y1 - y0) * (1 - b)) / 256)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["piso"] = mat("Mat_Chao_Piso", "#cfcac0", 0.92)
    M["calcadao"] = mat("Mat_Chao_Calcadao", "#bdb6aa", 0.9)
    M["piso_alto"] = mat("Mat_Piso_Elevado", "#e4e0d8", 0.85)
    M["patio"] = mat("Mat_Chao_Patio", "#a9a39a", 0.9)
    M["grama"] = mat("Mat_Chao_Grama", "#6b9a45", 0.95)
    M["meiofio"] = mat("Mat_Meio_Fio", "#d9d5cc", 0.85)
    M["branco"] = mat("Mat_Branco_Parede", "#f2f0ea", 0.7)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.45, 0.0, atlas)
    M["telha_rosa"] = mat("Mat_Telha_Rosa", "#cf6a82", 0.65, 0.0, atlas)
    M["telha_pink"] = mat("Mat_Telha_Pink", "#d8336e", 0.6, 0.0, atlas)
    M["telha_barro"] = mat("Mat_Telha_Barro", "#c4643e", 0.8, 0.0, atlas)
    M["fibro"] = mat("Mat_Telha_Fibrocimento", "#80858a", 0.8)
    M["cobertura"] = mat("Mat_Cobertura_Laje", "#c9c6bf", 0.85)
    M["vermelho"] = mat("Mat_Trelica_Vermelha", "#c0272d", 0.5, 0.3)
    M["pedra"] = mat("Mat_Pedra_Granito", "#8c817c", 0.55)
    M["cupula"] = mat("Mat_Cupula_Vidro", "#bcd0e6", 0.2, 0.25)
    M["escuro"] = mat("Mat_Vazio_Escuro", "#2a2d33", 0.8)
    M["reboco"] = mat("Mat_Reboco_Casarao", "#ffffff", 0.85)
    M["frisos"] = mat("Mat_Frisos_Brancos", "#f6f3ea", 0.7)
    M["murais"] = mat("Mat_Murais", "#ffffff", 0.7)
    M["metal"] = mat("Mat_Metal_Poste", "#5d646b", 0.45, 0.4)
    M["globo"] = mat("Mat_Globo_Luminaria", "#fbfaf4", 0.3)
    M["lona"] = mat("Mat_Lona_Branca", "#f7f6f2", 0.6)
    M["assento"] = mat("Mat_Assentos", "#8796a6", 0.6)
    M["arbusto"] = mat("Mat_Arbusto", "#3f6d33", 0.9)
    M["mesa"] = mat("Mat_Mesas_Bar", "#2d6fb3", 0.6)
    M["madeira"] = mat("Mat_Madeira", "#7a5638", 0.75)
    return M


# ———————————————————————————————————————————————— chão

def chao(M, vias):
    """Disco de piso de pedra, calçadão da Rua Dragão do Mar, gramados do OSM e o pátio do Espaço Rogaciano Leite Filho"""
    g = Peca("Chao_Praca")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["piso"], M["meiofio"]])
    g.criar()

    pisos = Peca("Chao_Pisos")

    def placa(poli, m, z=0.012):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.08)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=0), m)
        return poli

    # calçadão da Rua Dragão do Mar, entre o museu e os casarões (sobe 2 cm, piso mais escuro)
    placa(ret(-40, Y_FRENTE_CASAROES, 40, Y_FRENTE_MUSEU - 0.4), M["calcadao"])
    # pátio do Espaço Rogaciano Leite Filho (OSM 8856639), sob a Passarela Vermelha
    patio = [mapa(p) for p in anel(vias, ["638574622", "638574507", "638574625", "638575803", "638574505", "638575801"])]
    placa(patio, M["patio"], 0.02)
    # gramados do OSM: jardim dentro da rampa, faixa de fora e o gramado ao sul do Planetário
    gramas = []
    for ids in (["638574533", "638574534"], ["638574538", "638574537", "638574531", "638574532"], ["638574536", "638574539"], ["638574530", "638574529", "638574528"]):
        poli = [mapa(p) for p in anel(vias, ids)]
        gramas.append(placa(poli, M["grama"], 0.03))
    pisos.criar()
    return gramas


# ———————————————————————————————————————————————— museu (MAC + Memorial da Cultura Cearense)

def piramide(P, M, x0, y0, x1, y1, z, h, m, beiral=0.3, ponteira=True):
    """
    Telhado piramidal (ou de quatro águas, se o vão não for quadrado) com beiral, testeira branca e ponteira no topo:
    o telhado de todos os volumes do Dragão do Mar. UV das águas: fiadas de telha do atlas.
    """
    b = beiral
    X0, Y0, X1, Y1 = x0 - b, y0 - b, x1 + b, y1 + b
    w, d = X1 - X0, Y1 - Y0
    zc = z + 0.12
    if abs(w - d) < 0.05:
        topo = [((X0 + X1) / 2, (Y0 + Y1) / 2)] * 2
    elif w > d:
        topo = [(X0 + d / 2, (Y0 + Y1) / 2), (X1 - d / 2, (Y0 + Y1) / 2)]
    else:
        topo = [((X0 + X1) / 2, Y0 + w / 2), ((X0 + X1) / 2, Y1 - w / 2)]
    zt = zc + h
    cantos = [(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)]
    # testeira branca (a borda do beiral)
    P.juntar(bm_prisma(cantos, z, zc, 0.0, mat_lados=1), [M["branco"], M["frisos"]])
    # águas: sul, leste, norte, oeste
    t0, t1 = topo
    if w >= d:
        aguas = [([cantos[0], cantos[1]], [t1, t0]), ([cantos[1], cantos[2]], [t1]), ([cantos[2], cantos[3]], [t0, t1]), ([cantos[3], cantos[0]], [t0])]
    else:
        aguas = [([cantos[0], cantos[1]], [t0]), ([cantos[1], cantos[2]], [t1, t0]), ([cantos[2], cantos[3]], [t1]), ([cantos[3], cantos[0]], [t0, t1])]
    for base, cume in aguas:
        if len(cume) == 2 and cume[0] == cume[1]:
            cume = cume[:1]
        a, bb = base
        L = math.hypot(bb[0] - a[0], bb[1] - a[1])
        pts = [(a[0], a[1], zc), (bb[0], bb[1], zc)] + [(c[0], c[1], zt) for c in cume]
        # UV: u ao longo do beiral, v sobe a água (fiadas paralelas ao beiral)
        ux, uy = (bb[0] - a[0]) / L, (bb[1] - a[1]) / L
        uvs = []
        for p in pts:
            u = ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / L
            uvs.append(uv_reg("telha", u, (p[2] - zc) / max(h, 0.01)))
        P.poli(pts, m, uvs)
    # forro sob o beiral
    P.poli([(X0, Y0, z), (X0, Y1, z), (X1, Y1, z), (X1, Y0, z)], M["branco"])
    if ponteira:
        for t in ([t0] if t0 == t1 else [t0, t1]):
            P.juntar(bm_cilindro(0.05, 0.75, 6), M["metal"], Matrix.Translation((t[0], t[1], zt - 0.05)))
            P.juntar(bm_esfera(0.1, 1), M["metal"], Matrix.Translation((t[0], t[1], zt + 0.72)))


def faixa_vaos(P, M, p0, p1, z0, z1, n, reg, w_frac=0.6, saliente=0.02):
    """`n` vãos iguais (região do atlas) numa fachada reta de p0 a p1 (face para a direita de quem anda de p0 a p1)"""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    d = p1 - p0
    L = d.length
    t = d.normalized()
    nrm = Vector((t.y, -t.x, 0))
    passo = L / n
    for k in range(n):
        c = p0 + t * (passo * (k + 0.5))
        hw = passo * w_frac / 2
        a, b = c - t * hw + nrm * saliente, c + t * hw + nrm * saliente
        P.quad_uv([(a.x, a.y, z0), (b.x, b.y, z0), (b.x, b.y, z1), (a.x, a.y, z1)], M["esquadrias"], reg)


def volume(P, M, x0, y0, x1, y1, h, base=None, chanfro=0.06):
    """Cubo branco do museu de (x0, y0) a (x1, y1), de Z0 + base até Z0 + h"""
    z0 = Z0 + (base or 0.0)
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), z0, Z0 + h, chanfro, mat_lados=1), [M["cobertura"], M["branco"]])
    reservar(ret(x0, y0, x1, y1), 0.6)


def triangulos(P, M, p0, p1, z, n, tam=0.45):
    """Aberturas triangulares escuras numa fachada reta (as do Planetário e dos pavilhões, ref-3)"""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    t = (p1 - p0).normalized()
    nrm = Vector((t.y, -t.x, 0))
    L = (p1 - p0).length
    for k in range(n):
        c = p0 + t * (L * (k + 0.5) / n) + nrm * 0.02
        a, b, cc = c - t * tam / 2, c + t * tam / 2, c
        P.poli([(a.x, a.y, z), (b.x, b.y, z), (cc.x, cc.y, z + tam * 0.85)], M["escuro"])


def museu(M):
    """
    Museu de Arte Contemporânea e Memorial da Cultura Cearense (OSM 1170435202/5449/5703/5019; aéreas ref-1 e ref-4):
    cubos brancos de alturas diferentes cobertos por pirâmides rosa, a parte mais alta a oeste (21,1 m), um volume com a
    pirâmide pink e mural voltado para o jardim do Planetário, e o braço baixo de terraços (7,3 m) onde pousa a passarela
    vermelha que cruza o calçadão. A posição de cada pirâmide é interpretação das aéreas pequenas (dúvida na ficha).
    """
    P = Peca("Museu_Dragao")
    rosa, pink = M["telha_rosa"], M["telha_pink"]
    # parte alta (oeste)
    volume(P, M, -26.2, 10.6, -19.2, 18.6, 9.4)
    piramide(P, M, -26.2, 10.6, -19.2, 18.6, Z0 + 9.4, 3.4, rosa, 0.35)
    faixa_vaos(P, M, (-26.2, 10.6), (-19.2, 10.6), Z0 + 6.6, Z0 + 8.8, 1, "furos", 0.5)
    faixa_vaos(P, M, (-19.2, 18.6), (-26.2, 18.6), Z0 + 6.6, Z0 + 8.8, 1, "furos", 0.5)
    # volume sul, de frente para o calçadão: térreo com vãos, mural do retrato na empena sul
    volume(P, M, -23.4, 3.6, -13.4, 10.6, 6.0)
    piramide(P, M, -23.4, 3.6, -13.4, 10.6, Z0 + 6.0, 2.6, rosa)
    faixa_vaos(P, M, (-23.4, 3.6), (-21.2, 3.6), Z0 + 1.6, Z0 + 3.5, 1, "vidro", 0.7)
    q = [(-21.0, 3.58, Z0 + 1.9), (-13.8, 3.58, Z0 + 1.9), (-13.8, 3.58, Z0 + 5.6), (-21.0, 3.58, Z0 + 5.6)]
    P.poli(q, M["murais"], [uv_mural("retrato", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
    # dois pavilhões no meio, com arcadas no térreo
    for y0, y1 in ((10.6, 16.0), (16.0, 21.6)):
        volume(P, M, -19.2, y0, -12.8, y1, 6.4)
        piramide(P, M, -19.2, y0, -12.8, y1, Z0 + 6.4, 2.6, rosa)
    faixa_vaos(P, M, (-12.8, 21.6), (-19.2, 21.6), Z0 + 0.1, Z0 + 2.3, 3, "vidro")
    faixa_vaos(P, M, (-26.2, 18.6), (-26.2, 10.6), Z0 + 0.1, Z0 + 2.4, 3, "vidro", 0.55)
    faixa_vaos(P, M, (-26.2, 18.6), (-26.2, 10.6), Z0 + 6.4, Z0 + 8.6, 1, "furos", 0.55)
    triangulos(P, M, (-26.2, 18.6), (-26.2, 10.6), Z0 + 4.2, 5, 0.5)
    faixa_vaos(P, M, (-23.4, 10.6), (-23.4, 3.6), Z0 + 1.7, Z0 + 3.6, 3, "vidro", 0.55)
    triangulos(P, M, (-23.4, 10.6), (-23.4, 3.6), Z0 + 4.6, 4, 0.45)
    # pavilhão noroeste, mais baixo
    volume(P, M, -23.4, 18.6, -19.2, 23.0, 5.4)
    piramide(P, M, -23.4, 18.6, -19.2, 23.0, Z0 + 5.4, 2.3, rosa)
    faixa_vaos(P, M, (-19.2, 23.0), (-23.4, 23.0), Z0 + 0.1, Z0 + 2.3, 2, "vidro")
    faixa_vaos(P, M, (-23.4, 23.0), (-23.4, 18.6), Z0 + 3.0, Z0 + 4.4, 2, "fita")
    # volume da pirâmide pink com o grafite colorido voltado para o jardim do Planetário (leste)
    volume(P, M, -12.8, 10.6, -7.4, 20.8, 5.2)
    piramide(P, M, -12.8, 10.6, -7.4, 20.8, Z0 + 5.2, 2.4, pink)
    q = [(-7.38, 11.4, Z0 + 0.5), (-7.38, 20.0, Z0 + 0.5), (-7.38, 20.0, Z0 + 4.8), (-7.38, 11.4, Z0 + 4.8)]
    P.poli(q, M["murais"], [uv_mural("peixes", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
    # bloco baixo entre o volume sul e o braço (térreo de lojas) com terraço
    volume(P, M, -13.4, 3.6, -9.2, 10.6, H_TERRACO)
    faixa_vaos(P, M, (-13.4, 3.6), (-9.2, 3.6), Z0 + 1.6, Z0 + 3.4, 2, "vidro")
    # braço sul (terraço onde pousa a passarela) e braço norte, ambos a 3,9 m
    volume(P, M, -9.2, Y_FRENTE_MUSEU, -6.0, 10.6, H_TERRACO)
    volume(P, M, -12.8, 20.8, -6.4, 27.4, H_TERRACO)
    faixa_vaos(P, M, (-9.2, Y_FRENTE_MUSEU), (-6.0, Y_FRENTE_MUSEU), Z0 + 0.1, Z0 + 2.3, 1, "vidro", 0.55)
    faixa_vaos(P, M, (-6.0, Y_FRENTE_MUSEU), (-6.0, 10.6), Z0 + 0.5, Z0 + 2.6, 4, "vidro", 0.5)
    faixa_vaos(P, M, (-6.4, 20.8), (-6.4, 27.4), Z0 + 0.5, Z0 + 2.6, 3, "vidro", 0.5)
    # letreiro "Centro Dragão do Mar" na testada do braço, sobre a porta
    q = [(-9.0, Y_FRENTE_MUSEU - 0.03, Z0 + 2.6), (-6.2, Y_FRENTE_MUSEU - 0.03, Z0 + 2.6), (-6.2, Y_FRENTE_MUSEU - 0.03, Z0 + 3.4), (-9.0, Y_FRENTE_MUSEU - 0.03, Z0 + 3.4)]
    P.poli(q, M["murais"], [uv_mural("letreiro", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
    # aberturas triangulares no alto dos pavilhões (como no Planetário, foto da praça)
    triangulos(P, M, (-23.4, 3.6), (-21.2, 3.6), Z0 + 4.4, 2, 0.5)
    triangulos(P, M, (-12.8, 21.6), (-19.2, 21.6), Z0 + 4.6, 4, 0.5)
    # pódio com escadaria do calçadão até o terraço baixo (fotos "Dragão do Mar 10/11")
    pod = ret(-23.4, 0.6, -9.2, 3.6)
    P.juntar(bm_prisma(pod, Z0, Z0 + 1.5, 0.04, mat_lados=1), [M["piso_alto"], M["branco"]])
    reservar(pod, 0.4)
    for k in range(6):
        y0 = Y_FRENTE_MUSEU - 0.4 + k * 0.25
        P.juntar(bm_prisma(ret(-21.0, y0, -12.0, 0.6), Z0, Z0 + 0.25 * (k + 1), 0.0, mat_lados=1), [M["piso_alto"], M["branco"]])
    # guarda-corpos dos terraços (atlas "grade")
    def grade(p0, p1, z, h=0.55):
        a, b = p0, p1
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        P.quad_uv([(a[0], a[1], z), (b[0], b[1], z), (b[0], b[1], z + h), (a[0], a[1], z + h)], M["esquadrias"], "grade", (L / 3.0, 1))
        P.quad_uv([(b[0], b[1], z), (a[0], a[1], z), (a[0], a[1], z + h), (b[0], b[1], z + h)], M["esquadrias"], "grade", (L / 3.0, 1))
    grade((-23.2, 0.65), (-21.1, 0.65), Z0 + 1.5)
    grade((-11.9, 0.65), (-9.3, 0.65), Z0 + 1.5)
    zt = Z0 + H_TERRACO
    grade((-9.1, 10.5), (-9.1, Y_FRENTE_MUSEU + 0.1), zt)
    grade((-6.1, Y_FRENTE_MUSEU + 0.1), (-6.1, 2.4), zt)
    grade((-13.3, 3.7), (-9.3, 3.7), zt)
    grade((-6.5, 27.3), (-12.7, 27.3), zt)
    reservar(ret(-26.2, 0.0, -6.0, 27.4), 0.4)
    reservar(ret(-26.2, 18.6, -19.2, 24.0), 0.6)
    return P.criar()


# ———————————————————————————————————————————————— Planetário Rubens de Azevedo

def planetario(M):
    """
    Planetário Rubens de Azevedo (ref-3; OSM 1170436270/6548): tambor sobre pilotis com colunas de base de pedra,
    laje branca saliente, faixas de granito com uma faixa branca de aberturas triangulares, tambor branco mais estreito,
    anel fino e a cúpula geodésica de vidro espelhado. Sob ele, o piso xadrez preto e branco.
    """
    P = Peca("Planetario")
    C = PLAN_C
    R_BAIXO, R_ALTO, R_CUP = 5.05, 4.2, 3.95
    Z_LAJE, Z_B1, Z_TRI, Z_B2, Z_TOPO_B, Z_TOPO_A = 2.4, 2.6, 3.45, 4.3, 5.2, 6.85
    T = Matrix.Translation((C.x, C.y, 0))
    # piso xadrez (atlas: 4 × 4 casas; o disco repete por setores)
    n = 32
    for i in range(n):
        a, b = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        for r0, r1 in ((0.0, R_BAIXO * 0.55), (R_BAIXO * 0.55, R_BAIXO + 0.4)):
            pts = [(C.x + r0 * math.cos(a), C.y + r0 * math.sin(a), Z0 + 0.015), (C.x + r1 * math.cos(a), C.y + r1 * math.sin(a), Z0 + 0.015),
                   (C.x + r1 * math.cos(b), C.y + r1 * math.sin(b), Z0 + 0.015), (C.x + r0 * math.cos(b), C.y + r0 * math.sin(b), Z0 + 0.015)]
            uvs = [uv_reg("xadrez", (i % 4) / 4 + 0, r0 / R_BAIXO), uv_reg("xadrez", (i % 4) / 4 + 0, r1 / R_BAIXO), uv_reg("xadrez", (i % 4 + 1) / 4, r1 / R_BAIXO), uv_reg("xadrez", (i % 4 + 1) / 4, r0 / R_BAIXO)]
            if r0 < 1e-6:
                P.poli([pts[0], pts[1], pts[2]], M["esquadrias"], [uvs[0], uvs[1], uvs[2]])
            else:
                P.poli(pts, M["esquadrias"], uvs)
    # pilotis: 12 colunas, metade de baixo de pedra
    for k in range(12):
        a = 2 * math.pi * (k + 0.5) / 12
        x, y = C.x + (R_BAIXO - 0.75) * math.cos(a), C.y + (R_BAIXO - 0.75) * math.sin(a)
        P.juntar(bm_cilindro(0.24, 1.15, 12), M["pedra"], Matrix.Translation((x, y, Z0)))
        P.juntar(bm_cilindro(0.2, Z_LAJE - 1.15, 12), M["branco"], Matrix.Translation((x, y, Z0 + 1.15)))
    # núcleo (escada e elevador) com porta
    P.juntar(bm_cilindro(1.1, Z_LAJE, 16), M["branco"], T @ Matrix.Translation((0, 0, Z0)))
    # tambor de baixo: laje saliente, granito, faixa branca com triângulos, granito, topo (terraço)
    perfil = [(R_BAIXO - 0.3, Z0 + Z_LAJE - 0.05), (R_BAIXO + 0.12, Z0 + Z_LAJE - 0.05), (R_BAIXO + 0.12, Z0 + Z_B1)]
    P.juntar(bm_torno(perfil, 48), M["branco"], T, liso=True)
    P.juntar(bm_torno([(R_BAIXO, Z0 + Z_B1), (R_BAIXO, Z0 + Z_TRI)], 48), M["pedra"], T, liso=True)
    P.juntar(bm_torno([(R_BAIXO - 0.03, Z0 + Z_TRI), (R_BAIXO - 0.03, Z0 + Z_B2)], 48), M["branco"], T, liso=True)
    P.juntar(bm_torno([(R_BAIXO, Z0 + Z_B2), (R_BAIXO, Z0 + Z_TOPO_B - 0.1), (R_BAIXO + 0.08, Z0 + Z_TOPO_B - 0.1), (R_BAIXO + 0.08, Z0 + Z_TOPO_B), (R_ALTO, Z0 + Z_TOPO_B)], 48), [M["pedra"]], T, liso=True)
    P.juntar(bm_torno([(0.0, Z0 + Z_LAJE - 0.05), (R_BAIXO - 0.3, Z0 + Z_LAJE - 0.05)], 48), M["branco"], T)
    # aberturas triangulares na faixa branca
    for k in range(18):
        a = 2 * math.pi * k / 18
        d = Vector((math.cos(a), math.sin(a), 0))
        t = Vector((-d.y, d.x, 0))
        c = C + d * (R_BAIXO + 0.005)
        tam = 0.5
        zb = Z0 + Z_TRI + 0.15
        P.poli([tuple(c - t * tam / 2 + Vector((0, 0, zb))), tuple(c + t * tam / 2 + Vector((0, 0, zb))), tuple(c + Vector((0, 0, zb + 0.5)))], M["escuro"])
    # tambor de cima, anel e cúpula
    P.juntar(bm_torno([(R_ALTO, Z0 + Z_TOPO_B), (R_ALTO, Z0 + Z_TOPO_A), (R_ALTO + 0.12, Z0 + Z_TOPO_A), (R_ALTO + 0.12, Z0 + Z_TOPO_A + 0.16), (R_CUP, Z0 + Z_TOPO_A + 0.16)], 48), M["branco"], T, liso=True)
    # cúpula geodésica: icosfera (2 subdivisões) cortada abaixo do equador, facetas com tons diferentes
    bm = bm_esfera(1.0, 3)
    corte = [f for f in bm.faces if f.calc_center_median().z < -0.02]
    bmesh.ops.delete(bm, geom=corte, context="FACES")
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z = 0.0
    P.juntar(bm, M["cupula"], T @ Matrix.Translation((0, 0, Z0 + Z_TOPO_A + 0.12)) @ Matrix.Diagonal((R_CUP, R_CUP, R_CUP * 0.97, 1)), liso=False)
    # varanda do terraço do tambor de baixo (atlas "grade")
    n = 40
    for i in range(n):
        a, b = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        r = R_BAIXO + 0.02
        pa, pb = (C.x + r * math.cos(a), C.y + r * math.sin(a)), (C.x + r * math.cos(b), C.y + r * math.sin(b))
        z = Z0 + Z_TOPO_B
        P.poli([(pa[0], pa[1], z), (pb[0], pb[1], z), (pb[0], pb[1], z + 0.5), (pa[0], pa[1], z + 0.5)], M["esquadrias"],
               [uv_reg("grade", (i % 4) / 4, 0), uv_reg("grade", (i % 4 + 1) / 4, 0), uv_reg("grade", (i % 4 + 1) / 4, 1), uv_reg("grade", (i % 4) / 4, 1)])
    # pontezinha de vigas vermelhas do braço norte do museu até o terraço do tambor (ref-3)
    a = Vector((-6.4, 16.6, 0))
    b = C + (a - C).normalized() * (R_BAIXO - 0.1)
    d = (b - a)
    giro = math.degrees(math.atan2(d.y, d.x))
    L = d.length
    for s in (-1, 1):
        o = a + Vector((-d.y, d.x, 0)).normalized() * s * 0.75
        barra(P, (o.x, o.y, Z0 + Z_TOPO_B - 0.05), (o.x + d.x, o.y + d.y, Z0 + Z_TOPO_B - 0.05), 0.18, M["vermelho"], 0.35)
    m_ = (a + b) / 2
    P.juntar(bm_caixa(L, 1.6, 0.12), M["piso_alto"], M_em(m_.x, m_.y, Z0 + Z_TOPO_B - 0.05, giro))
    for s in (-1, 1):
        o = m_ + Vector((-d.y, d.x, 0)).normalized() * s * 0.8
        P.juntar(bm_caixa(L, 0.05, 0.5), M["frisos"], M_em(o.x, o.y, Z0 + Z_TOPO_B + 0.07, giro))
    reservar([(C.x + (R_BAIXO + 0.6) * math.cos(2 * math.pi * i / 16), C.y + (R_BAIXO + 0.6) * math.sin(2 * math.pi * i / 16)) for i in range(16)], 0.3)
    return P.criar()


# ———————————————————————————————————————————————— torres, passarelas vermelhas e pavilhão

def torre(P, M, c, h, nome_lados=None, portas=()):
    """
    Torre branca quadrada (Torre do Café: 4 × 4 m e 18,5 m; torre sul: 19,2 m; ref-2): arcos de passagem na base,
    cornija, furos quadrados no alto, telhado piramidal rosa com ponteira. `portas`: lados ('N', 'S', 'L', 'O') onde
    entra uma passarela (vão escuro na altura do piso).
    """
    s = LADO_TORRE / 2
    x0, y0, x1, y1 = c.x - s, c.y - s, c.x + s, c.y + s
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0, Z0 + h, 0.05, mat_lados=1), [M["cobertura"], M["branco"]])
    P.juntar(bm_prisma(ret(x0 - 0.12, y0 - 0.12, x1 + 0.12, y1 + 0.12), Z0 + h - 0.35, Z0 + h, 0.03, mat_lados=1), [M["branco"], M["frisos"]])
    piramide(P, M, x0, y0, x1, y1, Z0 + h, 2.3, M["telha_rosa"], 0.32)
    lados = {"S": ((x0, y0), (x1, y0)), "L": ((x1, y0), (x1, y1)), "N": ((x1, y1), (x0, y1)), "O": ((x0, y1), (x0, y0))}
    for nome, (a, b) in lados.items():
        a, b = Vector((*a, 0)), Vector((*b, 0))
        t = (b - a).normalized()
        nrm = Vector((t.y, -t.x, 0))
        m_ = (a + b) / 2 + nrm * 0.015
        # arco de passagem na base (meia elipse sobre retângulo)
        hw, hr, ht = 0.75, 1.5, 2.35
        pts = [m_ - t * hw, m_ + t * hw]
        contorno = [(tuple(pts[0]), 0.0), (tuple(pts[1]), 0.0)]
        arco = []
        for k in range(9):
            ang = math.pi * k / 8
            q = m_ + t * (hw * math.cos(ang))
            arco.append((q, hr + (ht - hr) * math.sin(ang)))
        poly = [(pts[0].x, pts[0].y, Z0), (pts[1].x, pts[1].y, Z0)] + [(q.x, q.y, Z0 + z) for q, z in arco]
        P.poli(poly, M["escuro"])
        # furos quadrados no alto
        q0, q1 = m_ - t * 0.9, m_ + t * 0.9
        P.quad_uv([(q0.x, q0.y, Z0 + h - 2.5), (q1.x, q1.y, Z0 + h - 2.5), (q1.x, q1.y, Z0 + h - 0.6), (q0.x, q0.y, Z0 + h - 0.6)], M["esquadrias"], "furos")
        if nome in portas:
            q0, q1 = m_ - t * 0.8, m_ + t * 0.8
            P.poli([(q0.x, q0.y, Z0 + H_TERRACO), (q1.x, q1.y, Z0 + H_TERRACO), (q1.x, q1.y, Z0 + H_TERRACO + 1.9), (q0.x, q0.y, Z0 + H_TERRACO + 1.9)], M["escuro"])
    reservar(ret(x0, y0, x1, y1), 0.6)


def trelica(P, M, a, b, z, larg=2.2, alt=2.0, painel=1.5, deck=True):
    """
    Passarela de treliça vermelha (fotos da categoria "Passarela vermelha"): banzos de cima e de baixo, montantes, X nas
    laterais e no teto, piso de pedra com faixa e guarda-corpo vermelho. De a a b (planta), piso na cota z.
    """
    a, b = Vector((*a, 0)), Vector((*b, 0))
    d = b - a
    L = d.length
    t = d.normalized()
    nrm = Vector((-t.y, t.x, 0))
    n = max(2, round(L / painel))
    e = 0.13
    vm = M["vermelho"]
    for s in (-1, 1):
        o = nrm * s * larg / 2
        for zz in (z, z + alt):
            barra(P, a + o + Vector((0, 0, zz)), b + o + Vector((0, 0, zz)), e, vm, e * 1.3)
        for k in range(n + 1):
            p = a + t * (L * k / n) + o
            barra(P, p + Vector((0, 0, z - e * 1.3)), p + Vector((0, 0, z + alt)), e, vm)
        for k in range(n):
            p0, p1 = a + t * (L * k / n) + o, a + t * (L * (k + 1) / n) + o
            barra(P, p0 + Vector((0, 0, z)), p1 + Vector((0, 0, z + alt)), e * 0.8, vm)
            barra(P, p1 + Vector((0, 0, z)), p0 + Vector((0, 0, z + alt)), e * 0.8, vm)
        # guarda-corpo (corrimão a 1 m)
        barra(P, a + o * 0.93 + Vector((0, 0, z + 0.7)), b + o * 0.93 + Vector((0, 0, z + 0.7)), 0.05, vm)
    for k in range(n + 1):
        p = a + t * (L * k / n)
        barra(P, p - nrm * larg / 2 + Vector((0, 0, z + alt)), p + nrm * larg / 2 + Vector((0, 0, z + alt)), e * 0.8, vm)
    for k in range(n):
        p0, p1 = a + t * (L * k / n), a + t * (L * (k + 1) / n)
        barra(P, p0 - nrm * larg / 2 + Vector((0, 0, z + alt)), p1 + nrm * larg / 2 + Vector((0, 0, z + alt)), e * 0.6, vm)
    if deck:
        m_ = (a + b) / 2
        giro = math.degrees(math.atan2(t.y, t.x))
        P.juntar(bm_caixa(L, larg - 0.05, 0.16), M["piso_alto"], M_em(m_.x, m_.y, z - 0.16, giro))
        # vigas transversais sob o piso
        for k in range(n + 1):
            p = a + t * (L * k / n)
            barra(P, p - nrm * larg / 2 + Vector((0, 0, z - 0.2)), p + nrm * larg / 2 + Vector((0, 0, z - 0.2)), e, vm)


def pavilhao(P, M):
    """
    Pavilhão girado ao lado da Torre do Café (OSM 1170436271, 4 pavimentos, 11,4 m; ref-1 e ref-2): base branca de dois
    pavimentos, mirante de pórticos de treliça vermelha e telhado piramidal rosa. Daqui sai a Passarela Vermelha.
    """
    cantos = [mapa(p) for p in ((-44.9, -25.7), (-33.8, -20.6), (-28.5, -31.9), (-39.6, -37.1))]
    c = Vector((sum(p[0] for p in cantos) / 4, sum(p[1] for p in cantos) / 4, 0))
    u = (Vector((*cantos[1], 0)) - Vector((*cantos[0], 0)))
    giro = math.degrees(math.atan2(u.y, u.x))
    w = u.length * 0.92
    dd = (Vector((*cantos[3], 0)) - Vector((*cantos[0], 0))).length * 0.92
    T = M_em(c.x, c.y, Z0, giro)
    base = bm_caixa(w, dd, H_TERRACO, 0.06)
    P.juntar(base, M["branco"], T)
    hw, hd = w / 2, dd / 2
    def loc(x, y, z=0.0):
        return tuple(T @ Vector((x, y, z)))
    # vãos de vidro no térreo e fita no 2º pavimento (os quatro lados)
    for (x0, y0), (x1, y1) in (((-hw, -hd), (hw, -hd)), ((hw, -hd), (hw, hd)), ((hw, hd), (-hw, hd)), ((-hw, hd), (-hw, -hd))):
        a, b = Vector((x0, y0, 0)), Vector((x1, y1, 0))
        t = (b - a).normalized()
        n_ = Vector((t.y, -t.x, 0)) * 0.02
        L = (b - a).length
        for k in range(3):
            c0 = a + t * (L * (k + 0.5) / 3)
            p0, p1 = c0 - t * L * 0.11 + n_, c0 + t * L * 0.11 + n_
            P.quad_uv([loc(p0.x, p0.y, 0.1), loc(p1.x, p1.y, 0.1), loc(p1.x, p1.y, 2.0), loc(p0.x, p0.y, 2.0)], M["esquadrias"], "vidro")
        p0, p1 = a + t * 0.4 + n_, b - t * 0.4 + n_
        P.quad_uv([loc(p0.x, p0.y, 2.5), loc(p1.x, p1.y, 2.5), loc(p1.x, p1.y, 3.4), loc(p0.x, p0.y, 3.4)], M["esquadrias"], "fita")
    # laje do mirante e pórticos vermelhos com X
    P.juntar(bm_caixa(w + 0.2, dd + 0.2, 0.18, 0.04), M["branco"], T @ Matrix.Translation((0, 0, H_TERRACO)))
    zt = H_TERRACO + 0.18
    hm = 2.0
    cantos_l = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
    for i in range(4):
        x0, y0 = cantos_l[i]
        x1, y1 = cantos_l[(i + 1) % 4]
        a, b = Vector(loc(x0, y0, zt)), Vector(loc(x1, y1, zt))
        up = Vector((0, 0, hm))
        barra(P, a, a + up, 0.16, M["vermelho"])
        barra(P, a + up, b + up, 0.16, M["vermelho"], 0.2)
        m_ = (a + b) / 2
        barra(P, a, m_ + up, 0.11, M["vermelho"])
        barra(P, b, m_ + up, 0.11, M["vermelho"])
        barra(P, a + up * 0.45, b + up * 0.45, 0.07, M["vermelho"])
    # caixa fechada no meio do mirante (escada) e telhado
    P.juntar(bm_caixa(w * 0.45, dd * 0.45, hm, 0.04), M["branco"], T @ Matrix.Translation((0, 0, zt)))
    # telhado piramidal girado: monta em coordenadas locais e transforma
    Ploc = Peca("_tmp_telhado")
    piramide(Ploc, M, -hw, -hd, hw, hd, 0.0, 2.3, M["telha_rosa"], 0.3)
    P.juntar(Ploc.bm, Ploc.mats, T @ Matrix.Translation((0, 0, zt + hm)))
    pegada = [loc(x, y)[:2] for x, y in cantos_l]
    reservar(pegada, 0.6)
    return pegada


def torres_passarelas(M):
    """Torre do Café, torre sul, pavilhão e as três treliças vermelhas (OSM 598985206, 638574526 e o pouso no museu)"""
    P = Peca("Torres_Passarelas")
    torre(P, M, TORRE_CAFE, 10.2, portas=("N", "O"))
    torre(P, M, TORRE_SUL, 10.6, portas=("N", "S"))
    pavilhao(P, M)
    zp = Z0 + H_TERRACO
    s = LADO_TORRE / 2
    # sobre a Rua Dragão do Mar: do terraço do museu até a Torre do Café
    trelica(P, M, (-7.65, Y_FRENTE_MUSEU), (TORRE_CAFE.x, TORRE_CAFE.y + s), zp)
    # Passarela Vermelha: do pavilhão (canto sul) até a torre sul, sobre o Espaço Rogaciano Leite Filho
    pa = Vector((*mapa((-38.0, -35.0)), 0))
    pb = TORRE_SUL + Vector((0, s, 0))
    trelica(P, M, (pa.x, pa.y), (pb.x - 0.2, pb.y), zp)
    # pilares das passarelas (pares de colunas brancas sob a treliça longa)
    for t_ in (0.5,):
        q = pa.lerp(pb, t_)
        d = (pb - pa).normalized()
        nrm = Vector((-d.y, d.x, 0))
        for sgn in (-1, 1):
            o = q + nrm * sgn * 0.95
            P.juntar(bm_cilindro(0.17, zp - 0.2 - Z0, 10), M["branco"], Matrix.Translation((o.x, o.y, Z0)))
    # toco da passarela sul, que segue sobre a Rua José Avelino (corta na borda do disco)
    fim = TORRE_SUL + Vector((1.3, -3.3, 0))
    trelica(P, M, (TORRE_SUL.x + 0.3, TORRE_SUL.y - s), (fim.x, fim.y), zp, painel=1.4)
    for sgn in (-1, 1):
        d = (fim - TORRE_SUL).normalized()
        nrm = Vector((-d.y, d.x, 0))
        o = fim + nrm * sgn * 0.95 - d * 0.3
        P.juntar(bm_cilindro(0.17, zp - 0.2 - Z0, 10), M["branco"], Matrix.Translation((o.x, o.y, Z0)))
    return P.criar()


# ———————————————————————————————————————————————— rampa curva

def caminho_rampa(vias):
    """Eixo da rampa (OSM 638574565, layer 3), levado para a miniatura, suavizado e cortado na borda do disco"""
    pts = [mapa(p) for p in vias["638574565"][1]][::-1]      # do museu para o norte
    pts[0] = (-6.1, 0.6)
    # Catmull-Rom com passo ~0,8 m
    out = []
    P_ = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = (Vector(P_[j]) for j in (i - 1, i, i + 1, i + 2))
        L = (p2 - p1).length
        n = max(1, int(L / 0.8))
        for k in range(n):
            t = k / n
            q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
            out.append((q.x, q.y))
    out.append(pts[-1])
    # afasta do Planetário (que cresceu) e corta antes da borda
    res = []
    for x, y in out:
        v = Vector((x, y)) - PLAN_C.xy
        if v.length < 7.6:
            v = v.normalized() * 7.6
            x, y = PLAN_C.x + v.x, PLAN_C.y + v.y
        if math.hypot(x, y) > RAIO - 2.0:
            break
        res.append((x, y))
    return res


def rampa(M, vias):
    """
    Rampa curva branca (ref-1, ref-4): passarela elevada larga que sai do terraço do museu, contorna o Planetário pelo
    sudeste e desce para o norte, com guarda-corpo branco em X dos dois lados e colunas redondas.
    """
    P = Peca("Rampa_Curva")
    eixo = caminho_rampa(vias)
    larg = 2.7
    # cota do piso: 3,9 m no museu, 4,3 m junto ao Planetário, descendo para o norte
    s_acum = [0.0]
    for a, b in zip(eixo, eixo[1:]):
        s_acum.append(s_acum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    S = s_acum[-1]
    def cota(s):
        if s < 12:
            return H_TERRACO + 0.4 * s / 12
        return H_TERRACO + 0.4 - (H_TERRACO + 0.4 - 1.6) * min(1.0, (s - 12) / max(1.0, S - 12))
    normais = []
    for i, p in enumerate(eixo):
        a = eixo[max(0, i - 1)]
        b = eixo[min(len(eixo) - 1, i + 1)]
        t = Vector((b[0] - a[0], b[1] - a[1])).normalized()
        normais.append(Vector((-t.y, t.x)))
    esq = [Vector(p) + n * larg / 2 for p, n in zip(eixo, normais)]
    dir_ = [Vector(p) - n * larg / 2 for p, n in zip(eixo, normais)]
    esp = 0.35
    for i in range(len(eixo) - 1):
        z0, z1 = Z0 + cota(s_acum[i]), Z0 + cota(s_acum[i + 1])
        a0, a1, b0, b1 = esq[i], esq[i + 1], dir_[i], dir_[i + 1]
        P.poli([(b0.x, b0.y, z0), (b1.x, b1.y, z1), (a1.x, a1.y, z1), (a0.x, a0.y, z0)], M["piso_alto"])
        P.poli([(a0.x, a0.y, z0 - esp), (a1.x, a1.y, z1 - esp), (b1.x, b1.y, z1 - esp), (b0.x, b0.y, z0 - esp)], M["branco"])
        # bordas (testeiras brancas) e guarda-corpos
        for (p0, p1, zz0, zz1) in ((a1, a0, z1, z0), (b0, b1, z0, z1)):
            P.poli([(p0.x, p0.y, zz0 - esp), (p1.x, p1.y, zz1 - esp), (p1.x, p1.y, zz1 + 0.12), (p0.x, p0.y, zz0 + 0.12)], M["branco"])
            L = (p1 - p0).length
            u0 = (s_acum[i] / 3.0) % 1.0
            P.poli([(p0.x, p0.y, zz0 + 0.12), (p1.x, p1.y, zz1 + 0.12), (p1.x, p1.y, zz1 + 0.75), (p0.x, p0.y, zz0 + 0.75)], M["esquadrias"],
                   [uv_reg("grade", 0, 0), uv_reg("grade", L / 3, 0), uv_reg("grade", L / 3, 1), uv_reg("grade", 0, 1)])
            P.poli([(p1.x, p1.y, zz1 + 0.12), (p0.x, p0.y, zz0 + 0.12), (p0.x, p0.y, zz0 + 0.75), (p1.x, p1.y, zz1 + 0.75)], M["esquadrias"],
                   [uv_reg("grade", 0, 0), uv_reg("grade", L / 3, 0), uv_reg("grade", L / 3, 1), uv_reg("grade", 0, 1)])
    # corrimão branco por cima dos dois guarda-corpos
    for lado in (esq, dir_):
        for i in range(len(eixo) - 1):
            z0, z1 = Z0 + cota(s_acum[i]) + 0.75, Z0 + cota(s_acum[i + 1]) + 0.75
            barra(P, (lado[i].x, lado[i].y, z0 + 0.04), (lado[i + 1].x, lado[i + 1].y, z1 + 0.04), 0.09, M["frisos"])
    # colunas a cada ~3,2 m
    prox = 1.5
    for i, s in enumerate(s_acum):
        if s >= prox and s < S - 0.5:
            prox += 3.2
            for lado in (esq, dir_):
                c = Vector(eixo[i]) * 0.35 + lado[i] * 0.65
                P.juntar(bm_cilindro(0.2, cota(s) - esp, 12), M["branco"], Matrix.Translation((c.x, c.y, Z0)))
    # fim da rampa: escadaria descendo até o chão
    fim = Vector(eixo[-1])
    t = (Vector(eixo[-1]) - Vector(eixo[-2])).normalized()
    n_ = Vector((-t.y, t.x))
    zf = cota(S)
    for k in range(6):
        c = fim + t * (0.3 + k * 0.32)
        P.juntar(bm_caixa(0.32, larg, zf * (1 - (k + 1) / 7)), M["branco"], M_em(c.x, c.y, Z0, math.degrees(math.atan2(t.y, t.x))))
    pegada = [tuple(p) for p in esq] + [tuple(p) for p in reversed(dir_)]
    reservar(pegada, 0.3)
    return P.criar(), eixo, [cota(s) for s in s_acum]


# ———————————————————————————————————————————————— casarões

CASAROES_LESTE = [   # da esquerda para a direita de quem olha a fachada (do oeste para o leste), cores das fotos
    ("#8e9196", "#c0302a"),   # cinza com portas vermelhas, junto à Torre do Café
    ("#f2eee6", "#c0302a"),   # branco com frisos vermelhos
    ("#c6a2cf", "#f6f3ea"),   # lilás
    ("#e0a238", "#f6f3ea"),   # ocre
    ("#e7a2b4", "#f6f3ea"),   # rosa com varanda
    ("#e6bf4e", "#f6f3ea"),   # amarelo
]
CASAROES_OESTE = [("#eaa58d", "#f6f3ea"), ("#8cc7d9", "#e88aa6"), ("#e9c766", "#f6f3ea")]


def casarao(P, M, x0, x1, y, h, cor, friso, prof=4.2, seed=0):
    """
    Casarão eclético de dois pavimentos (ref-5): fachada pintada virada para o norte (o calçadão), portas de madeira
    vermelha em arco no térreo, janelas com venezianas no 1º andar, pilastras, cornija entre os pavimentos, platibanda
    com balaústres e frontão no meio; atrás, o telhado de quatro águas de telha cerâmica.
    """
    rnd = random.Random(seed)
    w = x1 - x0
    parede = tinta(M["reboco"], cor)
    trim = M["frisos"] if friso.lower() in ("#f6f3ea",) else tinta(M["reboco"], friso)
    yb = y - prof
    P.juntar(bm_prisma(ret(x0, yb, x1, y), Z0, Z0 + h, 0.0, mat_lados=1), [M["cobertura"], parede])
    # fachada: vãos (2 a 3 por pavimento)
    nv = 3 if w > 3.6 else 2
    for k in range(nv):
        cx = x0 + w * (k + 0.5) / nv
        P.quad_uv([(cx + 0.42, y + 0.02, Z0 + 0.05), (cx - 0.42, y + 0.02, Z0 + 0.05), (cx - 0.42, y + 0.02, Z0 + 2.1), (cx + 0.42, y + 0.02, Z0 + 2.1)], M["esquadrias"], "porta")
        P.quad_uv([(cx + 0.36, y + 0.02, Z0 + 2.75), (cx - 0.36, y + 0.02, Z0 + 2.75), (cx - 0.36, y + 0.02, Z0 + 4.05), (cx + 0.36, y + 0.02, Z0 + 4.05)], M["esquadrias"], "janela")
    # pilastras nas pontas, cornija do meio e cornija de cima
    for xp in (x0 + 0.12, x1 - 0.12):
        P.juntar(bm_caixa(0.24, 0.12, h + 0.55), trim, Matrix.Translation((xp, y + 0.05, Z0)))
    P.juntar(bm_caixa(w, 0.16, 0.16), trim, Matrix.Translation(((x0 + x1) / 2, y + 0.06, Z0 + 2.45)))
    P.juntar(bm_caixa(w + 0.1, 0.24, 0.2), trim, Matrix.Translation(((x0 + x1) / 2, y + 0.08, Z0 + h - 0.05)))
    # platibanda com balaústres e frontão
    P.juntar(bm_caixa(w, 0.18, 0.55), parede, Matrix.Translation(((x0 + x1) / 2, y - 0.05, Z0 + h + 0.15)))
    P.quad_uv([(x1 - 0.3, y + 0.05, Z0 + h + 0.2), (x0 + 0.3, y + 0.05, Z0 + h + 0.2), (x0 + 0.3, y + 0.05, Z0 + h + 0.62), (x1 - 0.3, y + 0.05, Z0 + h + 0.62)], M["esquadrias"], "balaus", (w / 2.4, 1))
    P.juntar(bm_caixa(w + 0.06, 0.22, 0.08), trim, Matrix.Translation(((x0 + x1) / 2, y - 0.03, Z0 + h + 0.7)))
    if rnd.random() < 0.7:
        cx = (x0 + x1) / 2
        q = [(cx + 0.9, y - 0.02, Z0 + h + 0.78), (cx - 0.9, y - 0.02, Z0 + h + 0.78), (cx, y - 0.02, Z0 + h + 1.35)]
        P.juntar(bm_poli_extrudado([q[1], q[0], q[2]], (0, 0.16, 0)), trim)
    # varanda de ferro no casarão rosa (fotos da praça)
    if cor == "#e7a2b4":
        P.juntar(bm_caixa(w * 0.7, 0.55, 0.1), trim, Matrix.Translation(((x0 + x1) / 2, y + 0.3, Z0 + 2.6)))
        P.quad_uv([(x1 - w * 0.15, y + 0.57, Z0 + 2.7), (x0 + w * 0.15, y + 0.57, Z0 + 2.7), (x0 + w * 0.15, y + 0.57, Z0 + 3.25), (x1 - w * 0.15, y + 0.57, Z0 + 3.25)], M["esquadrias"], "grade", (w / 2.5, 1))
    # telhado de quatro águas atrás da platibanda
    piramide(P, M, x0 + 0.15, yb + 0.1, x1 - 0.15, y - 0.25, Z0 + h - 0.1, 1.5, M["telha_barro"], 0.1, ponteira=False)
    reservar(ret(x0, yb, x1, y), 0.5)


def retangulo_minimo(poli):
    """Retângulo de menor área que contém o polígono: (centro, giro em graus, largura, profundidade)"""
    melhor = None
    for a, b in zip(poli, poli[1:] + poli[:1]):
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        ca, sa = math.cos(-ang), math.sin(-ang)
        rx = [p[0] * ca - p[1] * sa for p in poli]
        ry = [p[0] * sa + p[1] * ca for p in poli]
        ar = (max(rx) - min(rx)) * (max(ry) - min(ry))
        if melhor is None or ar < melhor[0]:
            cxr, cyr = (max(rx) + min(rx)) / 2, (max(ry) + min(ry)) / 2
            c = (cxr * math.cos(ang) - cyr * math.sin(ang), cxr * math.sin(ang) + cyr * math.cos(ang))
            melhor = (ar, c, math.degrees(ang), max(rx) - min(rx), max(ry) - min(ry))
    return melhor[1:]


def caber_no_disco(c, giro, w, d, folga=0.5):
    """Encolhe o retângulo (pelos lados que saem) até caber no disco; None se ficar pequeno demais"""
    u0, u1, v0, v1 = -w / 2, w / 2, -d / 2, d / 2
    ca, sa = math.cos(math.radians(giro)), math.sin(math.radians(giro))
    for _ in range(200):
        fora = False
        for su in (-1, 1):
            for sv in (-1, 1):
                u, v = (u1 if su > 0 else u0), (v1 if sv > 0 else v0)
                x, y = c[0] + u * ca - v * sa, c[1] + u * sa + v * ca
                if math.hypot(x, y) > RAIO - folga:
                    fora = True
                    if su > 0:
                        u1 -= 0.2
                    else:
                        u0 += 0.2
                    if sv > 0:
                        v1 -= 0.2
                    else:
                        v0 += 0.2
        if not fora:
            break
        if u1 - u0 < 1.6 or v1 - v0 < 1.6:
            return None
    um, vm = (u0 + u1) / 2, (v0 + v1) / 2
    return (c[0] + um * ca - vm * sa, c[1] + um * sa + vm * ca), u1 - u0, v1 - v0


def telhado_girado(P, M, c, giro, w, d, z, h, m, beiral=0.2):
    """Telhado de quatro águas (com beiral e testeira) sobre um retângulo girado: monta no lugar e transforma"""
    Ploc = Peca("_tmp_telhado")
    piramide(Ploc, M, -w / 2, -d / 2, w / 2, d / 2, 0.0, h, m, beiral, ponteira=False)
    P.juntar(Ploc.bm, Ploc.mats, M_em(c[0], c[1], z, giro))


def fundos(P, M, poli, h, telhado, seed):
    """
    Corpo de fundos de um lote (planta do OSM levada à miniatura): o retângulo mínimo do lote, paredes caiadas, uma fita
    de janelas e o telhado de quatro águas de telha ou de fibrocimento (o mar de telhados atrás dos casarões, ref-2).
    """
    if len(poli) < 3 or abs(area(poli)) < 1.0:
        return
    c, giro, w, d = retangulo_minimo(poli)
    r = caber_no_disco(c, giro, w * 0.97, d * 0.97)
    if r is None:
        return
    c, w, d = r
    cor = ["#eee9df", "#e6e0d3", "#f0e6d8", "#e9e2e8"][seed % 4]
    T = M_em(c[0], c[1], Z0, giro)
    bm = bm_caixa(w, d, h, 0.04)
    for f in bm.faces:
        f.material_index = 0 if f.normal.z > 0.5 else 1
    P.juntar(bm, [M["cobertura"], tinta(M["reboco"], cor)], T)
    # fitas de janelas nos lados compridos
    for s in (-1, 1):
        if w >= d:
            a, b = Vector((-w / 2 + 0.4, s * (d / 2 + 0.02), 0)), Vector((w / 2 - 0.4, s * (d / 2 + 0.02), 0))
        else:
            a, b = Vector((s * (w / 2 + 0.02), -d / 2 + 0.4, 0)), Vector((s * (w / 2 + 0.02), d / 2 - 0.4, 0))
        q = [a + Vector((0, 0, h * 0.42)), b + Vector((0, 0, h * 0.42)), b + Vector((0, 0, h * 0.75)), a + Vector((0, 0, h * 0.75))]
        q = [tuple(T @ v) for v in q]
        nrm = (Vector(q[1]) - Vector(q[0])).cross(Vector(q[3]) - Vector(q[0]))
        centro = Vector((c[0], c[1], 0))
        if nrm.dot(Vector(q[0]) - centro) < 0:
            q = [q[1], q[0], q[3], q[2]]
        L = (Vector(q[1]) - Vector(q[0])).length
        P.quad_uv(q, M["esquadrias"], "fita", (min(1.0, L / 6.0), 1))
    curto = min(w, d)
    telhado_girado(P, M, c, giro, w, d, Z0 + h, min(1.6, curto * 0.32), telhado, 0.18)
    # caixa d'água em alguns
    if seed % 3 == 0:
        P.juntar(bm_caixa(0.9, 0.9, 0.7, 0.04), M["branco"], T @ Matrix.Translation((w * 0.2, 0, h + curto * 0.2)))
    reservar([tuple(T @ Vector((x, y, 0)))[:2] for x, y in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))], 0.3)


def casaroes(M, vias):
    """Casarões do lado sul do calçadão (fachadas) e os corpos de fundos dos lotes do OSM até a borda do disco"""
    P = Peca("Casaroes")
    # fileira leste: da Torre do Café (x ≈ −5) até o fim do quarteirão (x ≈ 19,3)
    xs = [-5.4, -1.4, 2.4, 6.4, 10.6, 15.0, 19.0]
    for k, (cor, friso) in enumerate(CASAROES_LESTE):
        casarao(P, M, xs[k] + 0.03, xs[k + 1] - 0.03, Y_FRENTE_CASAROES, 4.6 + 0.35 * (k % 3 == 1), cor, friso, seed=k)
    # fileira oeste, depois do pavilhão
    xo = [-29.6, -26.4, -23.2, -20.0]
    for k, (cor, friso) in enumerate(CASAROES_OESTE):
        y = Y_FRENTE_CASAROES + 0.6
        casarao(P, M, xo[k] + 0.03, xo[k + 1] - 0.03, y, 4.4, cor, friso, prof=3.6, seed=10 + k)
    # fundos: lotes do OSM ao sul das fachadas
    ids = ["1170435076", "1170435877", "243219269", "638574620", "1170435141", "1170435006", "1170435336", "1170435411", "1170435756", "1170435988",
           "1170435811", "1170435611", "1170434958", "1170436501", "1170435698", "1170435920", "1170435394", "1170435648", "638574624"]
    telhas = [M["telha_barro"], M["fibro"], M["telha_barro"], M["fibro"], M["telha_barro"]]
    for k, i in enumerate(ids):
        if i not in vias:
            continue
        tags, pts = vias[i]
        poli = [mapa(p) for p in pts]
        poli = simplificar(poli, 0.2)
        if len(poli) < 3:
            continue
        # recua dos alinhamentos das fachadas (os casarões ocupam a frente)
        poli = [(x, min(y, Y_FRENTE_CASAROES - 4.3 if x > -5.6 else Y_FRENTE_CASAROES - 3.1)) for x, y in poli]
        if abs(area(poli)) < 1.5:
            continue
        h = max(2.4, min(3.8, float(tags.get("height", "6")) * 0.33))
        fundos(P, M, poli, h, telhas[k % len(telhas)], k)
    return P.criar()


# ———————————————————————————————————————————————— anfiteatro, postes, bares

def anfiteatro(M, vias):
    """
    Anfiteatro Sérgio Motta (OSM 638574576 e cobertura 8856656; fotos do Commons): arquibancada branca em degraus com
    assentos cinza-azulados descendo para o palco a nordeste, e o palco sob a cobertura branca abaulada.
    """
    P = Peca("Anfiteatro")
    real = [(8.5, 38.5), (-3.0, 30.8), (-16.3, 50.9), (-4.8, 58.6)]
    cantos = [Vector((*mapa(p), 0)) for p in real]
    # encolhe para caber no disco: fixa o lado sudoeste (alto) e encurta o fundo
    alto0, alto1 = cantos[1], cantos[2]      # lado sudoeste (topo da arquibancada)
    dir_palco = ((cantos[0] - cantos[1]).normalized())
    prof = 5.2
    largura = (alto1 - alto0).length
    t = (alto1 - alto0).normalized()
    nd = 7
    for k in range(nd):
        z = 2.6 * (1 - k / nd)
        d0, d1 = prof * k / nd, prof * (k + 1) / nd
        a0, a1 = alto0 + dir_palco * d0, alto1 + dir_palco * d0
        b0, b1 = alto0 + dir_palco * d1, alto1 + dir_palco * d1
        poli = [(a0.x, a0.y), (a1.x, a1.y), (b1.x, b1.y), (b0.x, b0.y)]
        P.juntar(bm_prisma(poli, Z0, Z0 + z, 0.0, mat_lados=1), [M["assento"] if k % 1 == 0 else M["branco"], M["branco"]])
    # muro de trás (sudoeste) e laterais brancas
    for a, b in ((alto0, alto1),):
        q = [(a.x, a.y), (b.x, b.y), (b.x - dir_palco.x * 0.3, b.y - dir_palco.y * 0.3), (a.x - dir_palco.x * 0.3, a.y - dir_palco.y * 0.3)]
        P.juntar(bm_prisma(q, Z0, Z0 + 3.4, 0.03, mat_lados=1), [M["branco"], M["branco"]])
        o = -dir_palco * 0.32
        a2, b2 = a + t * 0.6 + o, b - t * 0.6 + o
        P.poli([(b2.x, b2.y, Z0 + 0.4), (a2.x, a2.y, Z0 + 0.4), (a2.x, a2.y, Z0 + 3.1), (b2.x, b2.y, Z0 + 3.1)], M["murais"],
               [uv_mural("azul", u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))])
    for a in (alto0, alto1):
        q = [(a.x, a.y), (a.x + dir_palco.x * prof, a.y + dir_palco.y * prof)]
        o = t * (0.25 if a is alto0 else -0.25)
        poli = [q[0], q[1], (q[1][0] - o.x, q[1][1] - o.y), (q[0][0] - o.x, q[0][1] - o.y)]
        P.juntar(bm_prisma(poli, Z0, Z0 + 0.5, 0.0, mat_lados=1), [M["branco"], M["branco"]])
        P.juntar(bm_prisma(poli[:1] + poli[3:] + [(a.x - o.x + dir_palco.x * 0.6, a.y - o.y + dir_palco.y * 0.6), (a.x + dir_palco.x * 0.6, a.y + dir_palco.y * 0.6)], Z0, Z0 + 3.4, 0.0, mat_lados=1), [M["branco"], M["branco"]])
    # palco e cobertura abaulada branca (puxados para dentro do disco)
    meio = (alto0 + alto1) / 2 + dir_palco * (prof + 2.2)
    if meio.length > RAIO - 4.1:
        meio = meio.normalized() * (RAIO - 4.1)
    giro = math.degrees(math.atan2(t.y, t.x))
    P.juntar(bm_caixa(largura * 0.6, 3.0, 0.7, 0.05), M["madeira"], M_em(meio.x, meio.y, Z0, giro))
    P.juntar(bm_caixa(largura * 0.62, 0.3, 3.4, 0.04), M["escuro"], M_em(meio.x + dir_palco.x * 1.4, meio.y + dir_palco.y * 1.4, Z0, giro))
    for s in (-1, 1):
        for u in (-1, 1):
            c = meio + t * s * largura * 0.3 + dir_palco * u * 1.3
            P.juntar(bm_cilindro(0.1, 3.3, 8), M["metal"], Matrix.Translation((c.x, c.y, Z0)))
    # cobertura: calota achatada sobre os pilares (lona branca)
    perfil = []
    for k in range(13):
        ang = math.pi * k / 12
        perfil.append((math.cos(ang), math.sin(ang)))
    bm = bmesh.new()
    nseg = 10
    aneis = []
    for j in range(nseg + 1):
        u = -1 + 2 * j / nseg
        aba = 1 - 0.18 * u * u            # a lona baixa nas pontas
        aneis.append([bm.verts.new((u * largura * 0.36, py * 2.2 * aba, pz * 1.25 * aba)) for py, pz in perfil])
    for j in range(nseg):
        for k in range(12):
            bm.faces.new([aneis[j][k], aneis[j + 1][k], aneis[j + 1][k + 1], aneis[j][k + 1]])
    # dois lados: a face de baixo é a mesma lona com a ordem invertida, 4 cm abaixo
    for j in range(nseg):
        for k in range(12):
            vs = [aneis[j][k], aneis[j][k + 1], aneis[j + 1][k + 1], aneis[j + 1][k]]
            bm.faces.new([bm.verts.new(v.co - Vector((0, 0, 0.04))) for v in vs])
    P.juntar(bm, M["lona"], M_em(meio.x, meio.y, Z0 + 3.2, giro), liso=True)
    # treliça de luz sob a lona
    a, b = meio - t * largura * 0.32, meio + t * largura * 0.32
    barra(P, (a.x, a.y, Z0 + 3.2), (b.x, b.y, Z0 + 3.2), 0.18, M["metal"])
    pegada = [(alto0.x, alto0.y), (alto1.x, alto1.y), tuple((alto1 + dir_palco * (prof + 3.6)).xy), tuple((alto0 + dir_palco * (prof + 3.6)).xy)]
    reservar(pegada, 0.4)
    return P.criar()


def mobiliario(M):
    """Postes com globo branco (fotos da praça), mesas com guarda-sóis dos bares em frente aos casarões, bancos e floreiras"""
    P = Peca("Mobiliario_Praca")
    postes = [(-2.0, -8.8), (6.2, -8.8), (14.2, -8.8), (-12.5, -6.8), (-21.0, -6.8), (18.0, -2.0), (24.0, 6.0), (10.0, -3.0), (17.0, 12.5), (-27.0, -3.0)]
    for x, y in postes:
        P.juntar(bm_cilindro(0.08, 3.4, 8, r2=0.05), M["metal"], Matrix.Translation((x, y, Z0)))
        P.juntar(bm_cilindro(0.16, 0.25, 8), M["metal"], Matrix.Translation((x, y, Z0)))
        P.juntar(bm_esfera(0.3, 2), M["globo"], Matrix.Translation((x, y, Z0 + 3.6)), liso=True)
    # mesas dos bares (azuis) com guarda-sol branco
    rnd = random.Random(99)
    for k, x in enumerate((-3.6, 0.0, 3.6, 7.2, 10.8, 14.4, 17.6)):
        y = Y_FRENTE_CASAROES + 2.2 + rnd.uniform(-0.3, 0.4)
        P.juntar(bm_cilindro(0.04, 2.1, 6), M["metal"], Matrix.Translation((x, y, Z0)))
        P.juntar(bm_cilindro(1.0, 0.45, 10, r2=0.05, tampa=False), M["lona"], Matrix.Translation((x, y, Z0 + 1.75)))
        for s in (-1, 1):
            P.juntar(bm_cilindro(0.35, 0.06, 10), M["mesa"], Matrix.Translation((x + s * 0.55, y + 0.15 * s, Z0 + 0.7)))
            P.juntar(bm_cilindro(0.04, 0.7, 6), M["mesa"], Matrix.Translation((x + s * 0.55, y + 0.15 * s, Z0)))
    # bancos de pedra na praça
    for x, y, g in ((12.0, 1.5, 20), (20.5, 3.0, 60), (16.0, 8.0, -30), (24.0, -4.5, 0), (8.0, -6.0, 0)):
        P.juntar(bm_caixa(1.4, 0.45, 0.42, 0.05), M["meiofio"], M_em(x, y, Z0, g))
    # floreiras redondas no calçadão
    for x, y in ((-15.5, -6.0), (2.0, -5.4), (12.5, -5.8)):
        P.juntar(bm_torno([(0.7, Z0), (0.7, Z0 + 0.4), (0.55, Z0 + 0.4), (0.55, Z0 + 0.3)], 20), M["meiofio"], Matrix.Translation((0, 0, 0)) @ Matrix.Translation((x, y, 0)))
        P.juntar(bm_cilindro(0.56, 0.42, 16), M["arbusto"], Matrix.Translation((x, y, Z0)))
    return P.criar(), postes


# ———————————————————————————————————————————————— vegetação e gente (layout para o .tsx)

def layout(arvores_osm, gramas, eixo, cotas):
    """
    Posições determinísticas da vegetação e das pessoas: árvores nos pontos do OSM (levados à miniatura) e mais algumas na
    praça e no oeste, coqueiros nos jardins de dentro da rampa e na praça, gente no calçadão, na praça, sob o Planetário
    e na rampa. Volta em coordenadas do Blender.
    """
    rnd = random.Random(1999)   # ano da inauguração

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.5 - r * 0.8:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    arvores = []
    for p in arvores_osm:
        x, y = mapa(p)
        r = rnd.uniform(1.0, 1.5)
        if not livre(x, y, r):
            continue
        if any(math.hypot(x - a[0], y - a[1]) < 0.8 * (r + a[3]) for a in arvores):
            continue
        arvores.append((x, y, rnd.uniform(1.0, 1.6), r))
    # mais árvores onde a aérea mostra copa (oeste do museu, praça a leste)
    zonas = [((-29.0, 4.0), 4.0, 5), ((-28.5, -6.0), 3.0, 3), ((26.0, 8.0), 5.0, 5), ((22.0, -6.0), 4.0, 3), ((-18.0, 29.0), 3.0, 3), ((24.5, 18.0), 3.0, 2)]
    for (cx, cy), raio, n in zonas:
        k = 0
        tent = 0
        while k < n and tent < 400:
            tent += 1
            a, d = rnd.uniform(0, 2 * math.pi), raio * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            r = rnd.uniform(1.1, 1.7)
            if not livre(x, y, r) or any(math.hypot(x - q[0], y - q[1]) < 0.8 * (r + q[3]) for q in arvores):
                continue
            arvores.append((x, y, rnd.uniform(1.0, 1.7), r))
            k += 1
    coqueiros = []
    # jardim dentro da rampa (aérea ref-4) e gramados
    for x, y in ((7.2, 13.5), (9.6, 18.0), (6.8, 20.5), (11.6, 23.5), (0.8, 4.6), (-3.2, 6.8), (16.8, 26.5), (-15.0, 28.0)):
        if livre(x, y, 0.4):
            coqueiros.append((x, y, rnd.uniform(4.0, 5.2), rnd.uniform(0, 360)))
    # coqueiros e palmeiras da Praça Almirante Saldanha
    for x, y in ((9.0, -1.0), (13.5, -4.0), (19.0, -0.5), (21.0, 10.0), (27.0, 1.5), (15.0, 4.5), (-24.5, -8.5), (-30.0, 0.0)):
        if livre(x, y, 0.4):
            coqueiros.append((x, y, rnd.uniform(3.6, 4.8), rnd.uniform(0, 360)))
    pessoas = []
    zonas_p = [((6.0, -7.5), 6.0, 12, 0.0), ((16.0, 2.0), 5.0, 7, 0.0), ((-14.0, -5.5), 4.0, 5, 0.0), ((PLAN_C.x, PLAN_C.y), 2.6, 4, 0.0),
               ((-17.0, 2.1), 1.2, 3, 1.5), ((24.0, -3.0), 3.0, 3, 0.0), ((-2.0, 2.0), 2.0, 2, 0.0)]
    for (cx, cy), raio, n, z in zonas_p:
        k = 0
        tent = 0
        while k < n and tent < 500:
            tent += 1
            a, d = rnd.uniform(0, 2 * math.pi), raio * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if math.hypot(x, y) > RAIO - 1:
                continue
            sob = (cx, cy) == (PLAN_C.x, PLAN_C.y)
            if not sob and z == 0.0:
                if any(dist_poligono((x, y), poli) < 0.25 for poli, _ in LIVRE_POLIS):
                    continue
            if sob and math.hypot(x - PLAN_C.x, y - PLAN_C.y) < 1.4:
                continue
            pessoas.append((x, y, z, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    # gente na rampa e nas passarelas
    for i in range(4, len(eixo) - 2, 7):
        x, y = eixo[i]
        pessoas.append((x + rnd.uniform(-0.5, 0.5), y + rnd.uniform(-0.5, 0.5), cotas[i], rnd.uniform(0, 360), rnd.randrange(6)))
    for t_ in (0.3, 0.7):
        p = Vector((-7.65, Y_FRENTE_MUSEU)).lerp(Vector((TORRE_CAFE.x, TORRE_CAFE.y + 1.5)), t_)
        pessoas.append((p.x + 0.3, p.y, H_TERRACO, rnd.uniform(0, 360), rnd.randrange(6)))
    return arvores, coqueiros, pessoas


def proxies(arvores, coqueiros):
    """Volumes provisórios da vegetação: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.85, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, Z0 + h + r * 0.85)))
        P.juntar(bm_cilindro(0.16, h + 0.3, 6), m, Matrix.Translation((x, y, Z0)))
    for x, y, h, g in coqueiros:
        P.juntar(bm_cilindro(0.14, h, 6), m, Matrix.Translation((x, y, Z0)))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((1.6, 1.6, 0.55, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, Z0 + h)))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada e tintas

def assar(objs_vertice, objs_chao, proxy):
    """
    Oclusão de ambiente no Cycles (CPU): nas cores de vértice (por canto de face) das peças e numa imagem 256 × 256 do
    chão, vista de cima. Os valores das peças vão para a faixa 0,5–1, para escurecer sem sujar.
    """
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
            k = 0.5 + 0.5 * (a ** 0.85)
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
    placa.location.z = Z0 + 0.04
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
    img.filepath_raw = os.path.join(SAIDA, "dragaoDoMar-ao-chao.jpg")
    img.file_format = "JPEG"
    img.save(filepath=img.filepath_raw, quality=88)
    for ob in objs_chao:
        ob.hide_render = False
    bpy.data.objects.remove(placa)
    bpy.data.objects.remove(proxy)


def aplicar_tintas(objs):
    """
    Pinta as faces marcadas com `tinta()`: multiplica a cor (linear) nas cores de vértice e devolve a face ao material de
    base. Na cúpula, cada faceta ganha um tom um pouco diferente (vidro espelhado em triângulos).
    """
    rnd = random.Random(7)
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
            fator = None
            if nome in TINTAS:
                fator = srgb_lin(TINTAS[nome][1])
                poly.material_index = base_idx[nome]
            elif nome == "Mat_Cupula_Vidro":
                k = rnd.uniform(0.72, 1.12)
                fator = (k * rnd.uniform(0.94, 1.04), k, k * rnd.uniform(0.98, 1.06))
            if fator is None:
                continue
            for li in poly.loop_indices:
                c = at.data[li].color
                at.data[li].color = (min(1.0, c[0] * fator[0]), min(1.0, c[1] * fator[1]), min(1.0, c[2] * fator[2]), 1.0)
        # tira os materiais provisórios que ficaram sem face
        usados = {p.material_index for p in me.polygons}
        for i in range(len(me.materials) - 1, -1, -1):
            if i not in usados and me.materials[i] and me.materials[i].name.startswith("Tinta__"):
                me.materials.pop(index=i)


# ———————————————————————————————————————————————— principal

def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    vias, arvores_osm = carregar_osm()
    M = criar_materiais()
    gramas = chao(M, vias)
    obs = []
    obs.append(museu(M))
    obs.append(planetario(M))
    obs.append(torres_passarelas(M))
    r, eixo, cotas = rampa(M, vias)
    obs.append(r)
    obs.append(casaroes(M, vias))
    obs.append(anfiteatro(M, vias))
    mob, postes = mobiliario(M)
    obs.append(mob)
    arvores, coqueiros, pessoas = layout(arvores_osm, gramas, eixo, cotas)
    print(f"árvores {len(arvores)}, coqueiros {len(coqueiros)}, pessoas {len(pessoas)}")
    prox = proxies(arvores, coqueiros)
    chao_objs = [bpy.data.objects[n] for n in ("Chao_Praca", "Chao_Pisos")]
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
    # suavização: curvas lisas (tambor, lona) e arestas vivas no resto; a cúpula fica facetada
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        me = ob.data
        nomes = [m.name if m else "" for m in me.materials]
        if "Mat_Cupula_Vidro" in nomes:
            idx = nomes.index("Mat_Cupula_Vidro")
            bm = bmesh.new()
            bm.from_mesh(me)
            for e in bm.edges:
                if any(f.material_index == idx for f in e.link_faces):
                    e.smooth = False
            bm.to_mesh(me)
            bm.free()
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32), keep_sharp_edges=True)
    for nome in list(bpy.data.materials.keys()):
        if nome.startswith("Mat_Proxy") or nome.startswith("Tinta__"):
            bpy.data.materials.remove(bpy.data.materials[nome])
    for ob in obs:
        ob.data.color_attributes.active_color = ob.data.color_attributes["AO"]
    arq = os.path.join(SAIDA, "dragaoDoMar-pecas.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    dados = {
        "arvores": [[round(x, 3), round(Z0 + h, 3), round(-y, 3), round(r, 3)] for x, y, h, r in arvores],
        "coqueiros": [[round(x, 3), round(-y, 3), round(h, 3), round(math.radians(g), 3)] for x, y, h, g in coqueiros],
        "pessoas": [[round(x, 3), round(Z0 + z, 3), round(-y, 3), round(math.radians(g), 3), k] for x, y, z, g, k in pessoas],
        "chao": {"lado": LADO_AO, "z0": Z0},
    }
    with open(os.path.join(SAIDA, "dragaoDoMar-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
