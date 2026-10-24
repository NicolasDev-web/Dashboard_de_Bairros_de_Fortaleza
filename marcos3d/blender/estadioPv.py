# -*- coding: utf-8 -*-
"""
Estádio Presidente Vargas (o "PV", Benfica) em miniatura: gera as peças estáticas no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/estadioPv.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/estadioPv.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o EstadioPv.tsx carrega as três):
    estadioPv-pecas.glb     chão e ruas, campo, arquibancadas, fachada, tribuna coberta, rampas, torres de iluminação e
                            casario (sem compressão, oclusão assada nas cores de vértice)
    estadioPv-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    estadioPv-layout.json   árvores, pessoas, carros e barras do gradil (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-estadioPv.md): o quarteirão inteiro do estádio, com as quatro ruas em volta, a
Rua Marechal Deodoro a oeste (tribuna, portal e rampas) e o casario baixo do Benfica nas duas laterais. Tudo é modelado
num referencial do estádio: x = eixo curto (leste para +x), y = eixo longo (norte para +y), z = cima. No fim o
referencial gira GIRO = 13° (anti-horário visto de cima): o eixo longo real corre 13° a oeste do norte (OSM
way/179073475). Nesse rumo as câmeras da oficina, que vêm do sul, já pegam a fachada oeste e a cabeceira sul a ~45°
(perspectiva) e a tribuna coberta de frente por cima do anel leste (close), então não foi preciso girar a composição.

Escala: planta K ≈ 0,20 no campo (lote real ~142 × 228 m, campo ~93 × 124 m). As arquibancadas foram engrossadas ~1,5×
e as alturas exageradas ~2,5× (anel a 8,2 m, cobertura a ~11 m, torres a ~18 m), como nos marcos aprovados.
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
PREFIXO = "estadioPv"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do asfalto das ruas
ZE = 0.24            # topo das calçadas e da esplanada: o estádio e as casas pousam aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
GIRO = 13.0          # graus, anti-horário visto de cima: referencial do estádio → Blender (rumo real)
MUNDO = Matrix.Rotation(math.radians(GIRO), 4, "Z")

# ——— anel das arquibancadas: retângulo de cantos arredondados (frente do anel inferior) deslocado para fora
HX0, HY0, RC0 = 9.7, 13.0, 3.6        # meia largura, meio comprimento e raio do canto na borda do campo
NY, NX, NA = 10, 6, 8                 # segmentos nos lados longos, nas cabeceiras e em cada canto (64 no anel)
CX, CY = HX0 - RC0, HY0 - RC0
H_FRENTE = 0.75                       # muro da frente (com o vidro em cima)
INF = dict(n=8, prof=0.45, alt=0.37)  # anel inferior: 8 degraus
D_CORREDOR = 3.6                      # corredor de circulação com os vomitórios (o "nível do meio")
H_CORREDOR = H_FRENTE + 8 * 0.37      # 3,71
D_SUP = 4.5
H_SUP = H_CORREDOR + 0.9              # 4,61
SUP = dict(n=7, prof=0.42, alt=0.44)  # anel superior: 7 degraus, mais em pé
D_PARAPEITO = D_SUP + 7 * 0.42        # 7,44
H_TOPO = 8.15
D_FACHADA = D_PARAPEITO + 0.30        # 7,74: face externa do anel
Y_TRIBUNA = 8.6                       # meio comprimento das cadeiras azuis e das cabines (14 cabines de 1,23 m)
Y_COBERTURA = CY                      # a cobertura vai de −9,4 a 9,4 m (o lado reto da tribuna)

# ——— entorno (referencial do estádio)
X_RUA_O = (-28.6, -22.6)    # Rua Marechal Deodoro (oeste): meio-fio externo, meio-fio da esplanada
X_RUA_L = (19.8, 25.8)      # rua lateral leste (nome a confirmar)
Y_RUA_T = (26.6, 31.6)      # ruas transversais nas cabeceiras (|y|; nomes a confirmar)
Y_GRADIL = 25.3             # gradil do lote nas cabeceiras


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


def simplificar(poli, tol=0.06):
    out = []
    for p in poli:
        if out and math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) < tol:
            continue
        out.append(p)
    if len(out) > 3 and math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < tol:
        out.pop()
    return out


def ret(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


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


def contorno():
    """
    Retângulo de cantos arredondados da borda do campo, anti-horário a partir do lado leste: [(base, normal)].
    Deslocar todos os pontos de d ao longo da normal dá o anel d metros para fora com a mesma contagem de vértices,
    então dois anéis quaisquer se costuram em quadriláteros (degraus, corredor, fachada).
    """
    pts = []
    arco = lambda cx, cy, a0: [((cx + RC0 * math.cos(a0 + math.pi / 2 * i / NA), cy + RC0 * math.sin(a0 + math.pi / 2 * i / NA)),
                                (math.cos(a0 + math.pi / 2 * i / NA), math.sin(a0 + math.pi / 2 * i / NA))) for i in range(NA)]
    pts += [((CX + RC0, -CY + 2 * CY * i / NY), (1.0, 0.0)) for i in range(NY)]
    pts += arco(CX, CY, 0.0)
    pts += [((CX - 2 * CX * i / NX, CY + RC0), (0.0, 1.0)) for i in range(NX)]
    pts += arco(-CX, CY, math.pi / 2)
    pts += [((-CX - RC0, CY - 2 * CY * i / NY), (-1.0, 0.0)) for i in range(NY)]
    pts += arco(-CX, -CY, math.pi)
    pts += [((-CX + 2 * CX * i / NX, -CY - RC0), (0.0, -1.0)) for i in range(NX)]
    pts += arco(CX, -CY, 1.5 * math.pi)
    return pts


ANEL = contorno()
N_ANEL = len(ANEL)


def p_anel(i, d, h=None):
    (bx, by), (nx, ny) = ANEL[i % N_ANEL]
    x, y = bx + nx * d, by + ny * d
    return (x, y) if h is None else (x, y, ZE + h)


def normal_seg(i):
    (ax, ay), (bx, by) = ANEL[i % N_ANEL][1], ANEL[(i + 1) % N_ANEL][1]
    v = Vector((ax + bx, ay + by, 0)).normalized()
    return v


def meio_seg(i, d):
    a, b = Vector((*p_anel(i, d), 0.0)), Vector((*p_anel(i + 1, d), 0.0))
    return (a + b) / 2


def lado_oeste(i, ylim):
    """Segmento do lado reto oeste (a tribuna) com o meio dentro de |y| < ylim"""
    n = normal_seg(i)
    return n.x < -0.99 and abs(meio_seg(i, 0).y) < ylim


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

    def poli(self, pts, m, uvs=None, normal=None):
        """Polígono; com `normal`, a ordem dos vértices é acertada para a face olhar para esse lado"""
        if normal is not None:
            nv = Vector((0, 0, 0))
            for k in range(len(pts)):
                a, b = Vector(pts[k]), Vector(pts[(k + 1) % len(pts)])
                nv += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
            if nv.dot(Vector(normal)) < 0:
                pts = pts[::-1]
                uvs = uvs[::-1] if uvs else uvs
        vs = [self.bm.verts.new(p) for p in pts]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = self.mi(m)
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
            if uv2 is not None:
                for l, l2 in zip(nf.loops, f.loops):
                    l[self.uv].uv = l2[uv2].uv
        bm2.free()

    def criar(self):
        me = bpy.data.meshes.new(self.nome)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
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


def barra(P, a, b, esp, m, esp2=None):
    """Perfil retangular de a até b (barras de treliça, pilares inclinados, corrimãos)"""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    if L < 1e-4:
        return
    bm = bm_caixa(L, esp, esp2 or esp)
    bmesh.ops.translate(bm, vec=Vector((L / 2, 0, -(esp2 or esp) / 2)), verts=bm.verts)
    q = Vector((1, 0, 0)).rotation_difference(d.normalized())
    P.juntar(bm, m, Matrix.Translation(a) @ q.to_matrix().to_4x4())


# ———————————————————————————————————————————————— atlas de esquadrias (256 px, gerado aqui)

REGIOES = {
    "portao": (0.0, 0.75, 0.25, 1.0),          # portão de grade grafite com bandeira
    "cabines": (0.25, 0.75, 0.5, 1.0),         # uma cabine de rádio: vidro escuro com caixilho branco
    "refletores": (0.5, 0.75, 0.75, 1.0),      # painel de refletores 4 × 3
    "elevador": (0.75, 0.75, 1.0, 1.0),        # faixa de vidro do poço do elevador
    "porta_casa": (0.0, 0.5, 0.25, 0.75),      # porta de madeira com bandeira
    "janela_casa": (0.25, 0.5, 0.5, 0.75),     # janela de venezianas com moldura
    "bilheteria": (0.5, 0.5, 0.75, 0.75),      # dois guichês com grade
    "janela_fachada": (0.75, 0.5, 1.0, 0.75),  # abertura da circulação, com grade
    "telha": (0.0, 0.25, 0.5, 0.5),            # fiadas de telha (a cor vem do .tsx)
    "aluminio": (0.5, 0.25, 1.0, 0.5),         # telha de alumínio trapezoidal (a cor vem do .tsx)
    "portoes_lote": (0.0, 0.0, 0.5, 0.25),     # portão do gradil do lote
    "costas_refletores": (0.5, 0.0, 0.75, 0.25),  # costas do painel: quadro grafite e carcaças dos refletores
}

COR_BRANCO = "#f2f0ea"
COR_VIDRO = "#33475a"
COR_GRAFITE = "#2f3438"


def atlas_esquadrias(n=256):
    px = [1.0] * (n * n * 4)

    def r(u0, v0, u1, v1, cor):
        c = srgb_lin(cor)
        for y in range(max(0, int(round(v0 * n))), min(n, int(round(v1 * n)))):
            for x in range(max(0, int(round(u0 * n))), min(n, int(round(u1 * n)))):
                i = (y * n + x) * 4
                px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    def faixa(reg, a0, a1, b0, b1, cor):
        u0, v0, u1, v1 = REGIOES[reg]
        r(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * b0, u0 + (u1 - u0) * a1, v0 + (v1 - v0) * b1, cor)

    # portão: moldura branca, folhas de grade grafite sobre o escuro do túnel, bandeira em barras
    faixa("portao", 0, 1, 0, 1, COR_BRANCO)
    faixa("portao", 0.08, 0.92, 0.0, 0.9, "#1e2124")
    for k in range(11):
        a = 0.1 + k * 0.075
        faixa("portao", a, a + 0.025, 0.0, 0.9, "#4b5258")
    for b in (0.04, 0.42, 0.7, 0.86):
        faixa("portao", 0.08, 0.92, b, b + 0.03, "#4b5258")
    faixa("portao", 0.49, 0.51, 0.0, 0.9, COR_BRANCO)

    # cabine de rádio: vidro escuro com reflexo no alto, montantes e peitoril brancos
    faixa("cabines", 0, 1, 0, 1, COR_BRANCO)
    faixa("cabines", 0.06, 0.94, 0.12, 0.88, COR_VIDRO)
    faixa("cabines", 0.06, 0.94, 0.62, 0.88, "#566e82")
    faixa("cabines", 0.06, 0.94, 0.55, 0.58, COR_BRANCO)
    faixa("cabines", 0.48, 0.52, 0.12, 0.88, "#d9dde0")

    # refletores: caixa grafite com 4 × 3 lâmpadas claras
    faixa("refletores", 0, 1, 0, 1, "#3a3f44")
    for i in range(4):
        for j in range(3):
            a0, b0 = 0.05 + i * 0.235, 0.07 + j * 0.31
            faixa("refletores", a0, a0 + 0.2, b0, b0 + 0.26, "#9aa3a8")
            faixa("refletores", a0 + 0.03, a0 + 0.17, b0 + 0.04, b0 + 0.22, "#fbf8ec")

    # elevador: vidro com montantes
    faixa("elevador", 0, 1, 0, 1, COR_BRANCO)
    faixa("elevador", 0.12, 0.88, 0.02, 0.98, "#3d5468")
    for b in (0.25, 0.5, 0.75):
        faixa("elevador", 0.12, 0.88, b, b + 0.02, "#c8d0d4")
    faixa("elevador", 0.12, 0.88, 0.8, 0.98, "#5f7a8e")

    # porta de casa: moldura branca, madeira, bandeira de vidro
    faixa("porta_casa", 0, 1, 0, 1, COR_BRANCO)
    faixa("porta_casa", 0.16, 0.84, 0.0, 0.92, "#6a4a32")
    faixa("porta_casa", 0.16, 0.84, 0.74, 0.92, COR_VIDRO)
    faixa("porta_casa", 0.49, 0.51, 0.0, 0.74, "#4f3624")

    # janela de casa: moldura branca, venezianas verdes, peitoril
    faixa("janela_casa", 0, 1, 0, 1, COR_BRANCO)
    faixa("janela_casa", 0.14, 0.86, 0.12, 0.88, "#2f6b5a")
    for k in range(9):
        b = 0.16 + k * 0.08
        faixa("janela_casa", 0.14, 0.86, b, b + 0.025, "#24564a")
    faixa("janela_casa", 0.49, 0.51, 0.12, 0.88, COR_BRANCO)

    # bilheteria: parede clara com dois guichês de grade
    faixa("bilheteria", 0, 1, 0, 1, "#e6e2d8")
    for a0 in (0.1, 0.56):
        faixa("bilheteria", a0, a0 + 0.34, 0.38, 0.78, "#22262a")
        for k in range(5):
            a = a0 + 0.03 + k * 0.07
            faixa("bilheteria", a, a + 0.015, 0.38, 0.78, "#7c858b")
        faixa("bilheteria", a0 - 0.02, a0 + 0.36, 0.34, 0.38, COR_BRANCO)
    faixa("bilheteria", 0, 1, 0.86, 1.0, "#2f5fa8")

    # abertura da circulação: vão escuro com grade
    faixa("janela_fachada", 0, 1, 0, 1, "#f1e9d8")
    faixa("janela_fachada", 0.08, 0.92, 0.1, 0.9, "#3a3f45")
    for k in range(7):
        a = 0.12 + k * 0.115
        faixa("janela_fachada", a, a + 0.03, 0.1, 0.9, "#59616a")

    # telha: fiadas horizontais com sombra embaixo e juntas desencontradas (a cor vem do .tsx)
    u0, v0, u1, v1 = REGIOES["telha"]
    for k in range(8):
        b0 = k / 8
        faixa("telha", 0, 1, b0, b0 + 1 / 8, "#f2f2f2")
        faixa("telha", 0, 1, b0, b0 + 0.022, "#9a9a9a")
        for j in range(10):
            a = (j + (0.5 if k % 2 else 0)) / 10
            faixa("telha", a, a + 0.012, b0, b0 + 1 / 8, "#c8c8c8")

    # alumínio trapezoidal: nervuras claras e vales em sombra (a cor vem do .tsx)
    for k in range(8):
        a0 = k / 8
        faixa("aluminio", a0, a0 + 1 / 8, 0, 1, "#ebebeb")
        faixa("aluminio", a0, a0 + 0.02, 0, 1, "#bdbdbd")
        faixa("aluminio", a0 + 0.02, a0 + 0.04, 0, 1, "#ffffff")

    # portão do gradil do lote: barras verticais grafite sobre o claro (só a moldura recebe cor)
    faixa("portoes_lote", 0, 1, 0, 1, "#d8d4ca")
    faixa("portoes_lote", 0.02, 0.98, 0.05, 0.95, "#c3c9cc")
    for k in range(24):
        a = 0.03 + k * 0.04
        faixa("portoes_lote", a, a + 0.012, 0.05, 0.95, COR_GRAFITE)

    # costas do painel de refletores: quadro grafite com as carcaças 4 × 3 e as travessas do suporte
    faixa("costas_refletores", 0, 1, 0, 1, "#2c3034")
    for i in range(4):
        for j in range(3):
            a0, b0 = 0.06 + i * 0.235, 0.08 + j * 0.31
            faixa("costas_refletores", a0, a0 + 0.19, b0, b0 + 0.24, "#555c62")
            faixa("costas_refletores", a0 + 0.05, a0 + 0.14, b0 + 0.06, b0 + 0.18, "#6c747a")
    for b in (0.36, 0.67):
        faixa("costas_refletores", 0, 1, b, b + 0.03, "#7d868c")

    img = bpy.data.images.new("Tex_Esquadrias", n, n, alpha=False)
    img.pixels.foreach_set(px)
    img.pack()
    return img


def uv_reg(reg, a, b):
    """UV dentro de uma região do atlas (a, b de 0 a 1), com 1,5 px de margem"""
    u0, v0, u1, v1 = REGIOES[reg]
    m = 1.5 / 256
    a, b = min(max(a, 0.0), 1.0), min(max(b, 0.0), 1.0)
    return (u0 + m + (u1 - u0 - 2 * m) * a, v0 + m + (v1 - v0 - 2 * m) * b)


def quad_reg(P, M, a, b, z0, z1, normal, reg, m=None):
    """Retângulo vertical de a (esquerda de quem olha) até b, entre z0 e z1, com uma região do atlas"""
    pts = [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)]
    uvs = [uv_reg(reg, u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))]
    return P.poli(pts, m or M["esquadrias"], uvs, normal=normal)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["rua"] = mat("Mat_Chao_Rua", "#6b6a67", 0.95)
    M["piso"] = mat("Mat_Chao_Piso", "#d3cec3", 0.92)
    M["calcada"] = mat("Mat_Chao_Calcada", "#c3bdb1", 0.92)
    M["grama"] = mat("Mat_Chao_Grama", "#6e9e48", 0.95)
    M["meiofio"] = mat("Mat_Meio_Fio", "#e2ded5", 0.85)
    M["faixa"] = mat("Mat_Faixa_Viaria", "#f1efe6", 0.8)
    M["campo"] = mat("Mat_Gramado_Campo", "#4f9a45", 0.95)
    M["concreto"] = mat("Mat_Arquibancada_Concreto", "#cfc9bd", 0.92)
    M["cadeiras"] = mat("Mat_Cadeiras_Azuis", "#2f5fa8", 0.6)
    M["escuro"] = mat("Mat_Vao_Escuro", "#26292d", 0.9)
    M["vidro"] = mat("Mat_Vidro_Divisa", "#b9d3dc", 0.15)
    M["fachada"] = mat("Mat_Fachada_Creme", "#f1e9d8", 0.85)
    M["pilar"] = mat("Mat_Pilares_Brancos", "#f7f4ec", 0.75)
    M["soco"] = mat("Mat_Soco", "#77736b", 0.9)
    M["estrutura"] = mat("Mat_Estrutura_Branca", "#f3f2ee", 0.55, 0.15)
    M["aluminio"] = mat("Mat_Cobertura_Aluminio", "#d9dcdc", 0.45, 0.0, atlas)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.5, 0.0, atlas)
    M["torre"] = mat("Mat_Metal_Torres", "#a3a9ad", 0.45, 0.4)
    M["telha"] = mat("Mat_Telha_Barro", "#b9603c", 0.8, 0.0, atlas)
    M["parede"] = mat("Mat_Parede_Casas", "#ffffff", 0.88)
    M["ferro"] = mat("Mat_Ferro_Grafite", COR_GRAFITE, 0.5, 0.35)
    M["poste"] = mat("Mat_Metal_Poste", "#4a5055", 0.45, 0.4)
    M["globo"] = mat("Mat_Luminaria", "#fbfaf4", 0.3)
    M["acrilico"] = mat("Mat_Acrilico_Bancos", "#cfe0e6", 0.2)
    return M


# ———————————————————————————————————————————————— campo

def campo(M):
    """
    Gramado (o desenho das linhas vem em canvas no .tsx; UV u = x/19,4 + 0,5, v = y/26 + 0,5), gols, bancos de reservas
    cobertos do lado oeste e o vidro na divisa com a arquibancada (a reforma da Copa trocou o alambrado alto por vidro).
    O piso é feito de anéis concêntricos para a oclusão assada nas cores de vértice ter onde variar.
    """
    P = Peca("Campo")
    escalas = [1.0, 0.94, 0.82, 0.62, 0.36]
    zc = ZE + 0.02
    uv = lambda x, y: (x / (2 * HX0) + 0.5, y / (2 * HY0) + 0.5)
    for k in range(len(escalas)):
        s0 = escalas[k]
        s1 = escalas[k + 1] if k + 1 < len(escalas) else 0.0
        for i in range(N_ANEL):
            a, b = Vector(p_anel(i, 0)), Vector(p_anel(i + 1, 0))
            pts = [(a.x * s0, a.y * s0, zc), (b.x * s0, b.y * s0, zc)]
            if s1 > 0:
                pts += [(b.x * s1, b.y * s1, zc), (a.x * s1, a.y * s1, zc)]
            else:
                pts += [(0.0, 0.0, zc)]
            P.poli(pts, M["campo"], [uv(p[0], p[1]) for p in pts], normal=(0, 0, 1))
    # gols nas linhas de fundo (7,32 × 2,44 m reais, exagerados para ler de longe)
    B = M["estrutura"]
    for s in (-1, 1):
        y = s * 10.5
        for x in (-0.9, 0.9):
            P.juntar(bm_caixa(0.09, 0.09, 0.62), B, T(x, y, zc))
            barra(P, (x, y + s * 0.5, zc + 0.02), (x, y + s * 0.5, zc + 0.35), 0.05, B)
            barra(P, (x, y, zc + 0.6), (x, y + s * 0.5, zc + 0.35), 0.05, B)
        P.juntar(bm_caixa(1.89, 0.09, 0.09), B, T(0, y, zc + 0.6))
        barra(P, (-0.9, y + s * 0.5, zc + 0.35), (0.9, y + s * 0.5, zc + 0.35), 0.04, B)
        # rede: plano claro inclinado atrás do gol
        P.poli([(-0.9, y, zc + 0.6), (0.9, y, zc + 0.6), (0.9, y + s * 0.5, zc + 0.35), (-0.9, y + s * 0.5, zc + 0.35)], M["acrilico"], normal=(0, 0, 1))
    # bancos de reservas do lado oeste: abrigo com fundo escuro e cobertura de acrílico
    for s in (-1, 1):
        y = s * 2.7
        x0 = -(HX0 - 0.08)
        P.juntar(bm_caixa(0.75, 2.2, 0.55), M["escuro"], T(x0 + 0.38, y, zc))
        P.juntar(bm_caixa(0.9, 2.3, 0.07), M["acrilico"], T(x0 + 0.45, y, zc + 0.55))
        for yy in (y - 1.12, y + 1.12):
            P.juntar(bm_caixa(0.8, 0.06, 0.55), M["estrutura"], T(x0 + 0.4, yy, zc))
    # vidro da divisa (dupla face) sobre o muro da frente
    for i in range(N_ANEL):
        n = normal_seg(i)
        for lado, dd in ((-1, 0.04), (1, 0.08)):
            a, b = p_anel(i, dd), p_anel(i + 1, dd)
            P.poli([(a[0], a[1], ZE + H_FRENTE), (b[0], b[1], ZE + H_FRENTE), (b[0], b[1], ZE + H_FRENTE + 0.55), (a[0], a[1], ZE + H_FRENTE + 0.55)],
                   M["vidro"], normal=(n.x * lado, n.y * lado, 0))
    return P.criar()


# ———————————————————————————————————————————————— arquibancadas

def arquibancadas(M):
    """
    Anel contínuo de degraus em volta do campo, em dois lances (inferior com 8 degraus, superior com 7) separados pelo
    corredor de circulação com os vomitórios: é a leitura possível dos "três níveis" do projeto da reforma, sem foto.
    As cadeiras azuis (ficha) ficam no setor coberto da tribuna, no lado oeste; o resto é concreto pintado claro.
    """
    P = Peca("Arquibancadas")
    C = M["concreto"]

    def piso(i, d0, d1, h, m):
        a0, b0 = p_anel(i, d0, h), p_anel(i + 1, d0, h)
        a1, b1 = p_anel(i, d1, h), p_anel(i + 1, d1, h)
        P.poli([a0, b0, b1, a1], m, normal=(0, 0, 1))

    def espelho(i, d, h0, h1, m, fora=False):
        n = normal_seg(i)
        a0, b0 = p_anel(i, d, h0), p_anel(i + 1, d, h0)
        a1, b1 = p_anel(i, d, h1), p_anel(i + 1, d, h1)
        s = 1 if fora else -1
        P.poli([a0, b0, b1, a1], m, normal=(n.x * s, n.y * s, 0))

    for i in range(N_ANEL):
        tribuna = lado_oeste(i, Y_TRIBUNA)
        assento = M["cadeiras"] if tribuna else C
        espelho(i, 0.0, 0.02, H_FRENTE, C)
        # anel inferior
        h = H_FRENTE
        for k in range(INF["n"]):
            d0, d1 = k * INF["prof"], (k + 1) * INF["prof"]
            piso(i, d0, d1, h, assento)
            h1 = h + INF["alt"]
            espelho(i, d1, h, h1, C)
            h = h1
        # corredor e muro dos vomitórios
        piso(i, D_CORREDOR, D_SUP, H_CORREDOR, C)
        espelho(i, D_SUP, H_CORREDOR, H_SUP, C)
        if i % 4 == 2:
            n = normal_seg(i)
            c = meio_seg(i, D_SUP - 0.015)
            t = Vector((-n.y, n.x, 0))
            a, b = c - t * 0.45, c + t * 0.45
            P.poli([(a.x, a.y, ZE + H_CORREDOR), (b.x, b.y, ZE + H_CORREDOR), (b.x, b.y, ZE + H_CORREDOR + 0.72), (a.x, a.y, ZE + H_CORREDOR + 0.72)],
                   M["escuro"], normal=(-n.x, -n.y, 0))
        # anel superior
        h = H_SUP
        for k in range(SUP["n"]):
            d0, d1 = D_SUP + k * SUP["prof"], D_SUP + (k + 1) * SUP["prof"]
            piso(i, d0, d1, h, assento)
            h1 = h + SUP["alt"] if k < SUP["n"] - 1 else H_TOPO
            espelho(i, d1, h, h1, C)
            h = h1
        # topo do parapeito
        piso(i, D_PARAPEITO, D_FACHADA, H_TOPO, M["pilar"])
    # escadas: faixas claras subindo nos dois lances, a cada 8 segmentos (fora da tribuna)
    for i in range(N_ANEL):
        if i % 8 != 5 or lado_oeste(i, Y_TRIBUNA + 2):
            continue
        n = normal_seg(i)
        t = Vector((-n.y, n.x, 0))
        for k in range(INF["n"] + SUP["n"]):
            if k < INF["n"]:
                d0, d1, h = k * INF["prof"], (k + 1) * INF["prof"], H_FRENTE + k * INF["alt"]
            else:
                j = k - INF["n"]
                d0, d1, h = D_SUP + j * SUP["prof"], D_SUP + (j + 1) * SUP["prof"], H_SUP + j * SUP["alt"]
            c0, c1 = meio_seg(i, d0), meio_seg(i, d1)
            pts = [c0 - t * 0.28, c0 + t * 0.28, c1 + t * 0.28, c1 - t * 0.28]
            P.poli([(p.x, p.y, ZE + h + 0.012) for p in pts], M["meiofio"], normal=(0, 0, 1))
    return P.criar()


# ———————————————————————————————————————————————— fachada externa, portal, rampas e elevadores

def fachada(M):
    """
    Face externa do anel (forma neutra, sem foto): concreto pintado de branco-gelo sobre soco escuro, pilares em todos os
    vértices do anel, cinta na altura da circulação, cornija no topo, aberturas gradeadas da circulação e os portões
    dos 4 setores (ficha: 4 bilheterias e 4 setores).
    """
    P = Peca("Fachada_Externa")
    F, S = M["fachada"], M["soco"]
    D = D_FACHADA
    for i in range(N_ANEL):
        n = normal_seg(i)
        nn = (n.x, n.y, 0)
        for h0, h1, m in ((0.0, 0.55, S), (0.55, H_CORREDOR, F), (H_CORREDOR, H_TOPO, F)):
            a0, b0 = p_anel(i, D, h0), p_anel(i + 1, D, h0)
            a1, b1 = p_anel(i, D, h1), p_anel(i + 1, D, h1)
            P.poli([a0, b0, b1, a1], m, normal=nn)
        # cintas: circulação e cornija do topo
        for h0, h1, sai in ((H_CORREDOR - 0.1, H_CORREDOR + 0.18, 0.12), (H_TOPO - 0.32, H_TOPO + 0.02, 0.2)):
            a0, b0 = p_anel(i, D + sai, h0), p_anel(i + 1, D + sai, h0)
            a1, b1 = p_anel(i, D + sai, h1), p_anel(i + 1, D + sai, h1)
            P.poli([a0, b0, b1, a1], M["pilar"], normal=nn)
            for h in (h0, h1):
                P.poli([p_anel(i, D, h), p_anel(i + 1, D, h), p_anel(i + 1, D + sai, h), p_anel(i, D + sai, h)], M["pilar"], normal=(0, 0, 1 if h == h1 else -1))
        # pilar no vértice i
        (bx, by), (nx_, ny_) = ANEL[i]
        c = Vector(p_anel(i, D + 0.1))
        ang = math.degrees(math.atan2(ny_, nx_))
        P.juntar(bm_caixa(0.24, 0.46, H_TOPO - 0.9), M["pilar"], T(c.x, c.y, ZE + 0.55, ang))
    # aberturas da circulação (um vão por segmento, fora do portal e das rampas)
    portoes = set()
    for i in range(N_ANEL):
        n = normal_seg(i)
        m = meio_seg(i, 0)
        if n.y > 0.99 and abs(m.x) < 1.2 or n.y < -0.99 and abs(m.x) < 1.2 or n.x > 0.99 and abs(abs(m.y) - 3.8) < 0.95:
            portoes.add(i)
    for i in range(N_ANEL):
        n = normal_seg(i)
        c = meio_seg(i, D + 0.02)
        t = Vector((-n.y, n.x, 0))
        oeste = n.x < -0.9 and abs(c.y) < 10.2
        if not oeste:
            quad_reg(P, M, c - t * 0.6, c + t * 0.6, ZE + 4.5, ZE + 5.3, (n.x, n.y, 0), "janela_fachada")
        if i in portoes:
            quad_reg(P, M, c - t * 0.75, c + t * 0.75, ZE + 0.0, ZE + 2.5, (n.x, n.y, 0), "portao")
            # marquise do portão
            P.juntar(bm_caixa(1.2, 2.2, 0.12), M["estrutura"], T(c.x + n.x * 0.55, c.y + n.y * 0.55, ZE + 2.65, math.degrees(math.atan2(n.y, n.x))))
    return P.criar()


def portal(M):
    """
    Setor do portal e das cabines no lado oeste (O Povo, 2020: acesso por rampas e dois elevadores): bloco de entrada com
    três portões e marquise, as duas torres de elevador e as rampas em ziguezague até o corredor de circulação (o projeto
    da reforma fala em "rampas monumentais").
    """
    P = Peca("Portal_Rampas")
    F, B = M["fachada"], M["estrutura"]
    x = lambda d: -(HX0 + d)          # lado reto oeste: d metros para fora da borda do campo
    D = D_FACHADA
    # bloco do portal
    P.juntar(bm_prisma(ret(x(D + 2.6), -3.0, x(D - 0.1), 3.0), ZE, ZE + 5.0, 0.04), [B, F])
    P.juntar(bm_prisma(ret(x(D + 2.75), -3.15, x(D - 0.1), 3.15), ZE + 5.0, ZE + 5.35, 0.0), [B, F])
    P.juntar(bm_prisma(ret(x(D + 2.65), -3.05, x(D - 0.1), 3.05), ZE, ZE + 0.5, 0.0), [M["soco"], M["soco"]])
    for y0 in (-2.55, -0.75, 1.05):
        quad_reg(P, M, (x(D + 2.62), y0), (x(D + 2.62), y0 + 1.5), ZE + 0.0, ZE + 2.6, (-1, 0, 0), "portao")
    for y0 in (-2.6, -0.6, 1.4):
        quad_reg(P, M, (x(D + 2.62), y0), (x(D + 2.62), y0 + 1.2), ZE + 3.6, ZE + 4.6, (-1, 0, 0), "cabines")
    P.juntar(bm_prisma(ret(x(D + 3.4), -3.1, x(D + 2.6), 3.1), ZE + 2.95, ZE + 3.13, 0.0), [B, B])
    for y in (-2.9, 2.9):
        P.juntar(bm_cilindro(0.08, 2.95, 8), M["ferro"], T(x(D + 3.25), y, ZE))
    # torres dos elevadores
    for s in (-1, 1):
        y0, y1 = sorted((s * 3.25, s * 4.45))
        P.juntar(bm_prisma(ret(x(D + 1.7), y0, x(D - 0.1), y1), ZE, ZE + 9.6, 0.04), [B, F])
        P.juntar(bm_prisma(ret(x(D + 1.8), y0 - 0.1, x(D - 0.1), y1 + 0.1), ZE + 9.6, ZE + 9.85, 0.0), [B, F])
        quad_reg(P, M, (x(D + 1.72), (y0 + y1) / 2 - 0.36), (x(D + 1.72), (y0 + y1) / 2 + 0.36), ZE + 0.6, ZE + 9.3, (-1, 0, 0), "elevador")
    # rampas em ziguezague: duas pistas paralelas à fachada, três lances até o corredor (h 3,71)
    inner, outer = (D + 0.2, D + 1.7), (D + 1.85, D + 3.35)
    perto, longe = 5.2, 9.4
    lances = [(outer, longe, perto, 0.0, 1.25), (inner, perto, longe, 1.25, 2.5), (outer, longe, perto, 2.5, H_CORREDOR)]
    patamares = [(perto - 0.6, perto, 1.25), (longe, longe + 0.6, 2.5), (perto - 0.6, perto, H_CORREDOR)]
    E = 0.18
    for s in (-1, 1):
        for (d0, d1), ya, yb, h0, h1 in lances:
            pa, pb = s * ya, s * yb
            topo = [(x(d0), pa, ZE + h0 + 0.02), (x(d1), pa, ZE + h0 + 0.02), (x(d1), pb, ZE + h1), (x(d0), pb, ZE + h1)]
            P.juntar(bm_poli_extrudado(topo, (0, 0, -E)), F)
            for d in (d0, d1):
                guarda = [(x(d), pa, ZE + h0), (x(d), pb, ZE + h1), (x(d), pb, ZE + h1 + 0.8), (x(d), pa, ZE + h0 + 0.8)]
                P.juntar(bm_poli_extrudado(guarda, (-0.12 if d == d0 else 0.12, 0, 0)), B)
        for y0, y1, h in patamares:
            ya, yb = sorted((s * y0, s * y1))
            P.juntar(bm_prisma(ret(x(outer[1]), ya, x(inner[0] - 0.2), yb), ZE + h - E, ZE + h + 0.02, 0.0), [F, F])
            # guarda-corpo do patamar (lado de fora e topo)
            P.juntar(bm_prisma(ret(x(outer[1]), ya, x(outer[1] - 0.12), yb), ZE + h, ZE + h + 0.8, 0.0), [B, B])
            yext = s * (longe + 0.6) if y0 >= longe else s * (perto - 0.6)
            ya2, yb2 = sorted((yext, yext - s * 0.12 * (1 if y0 >= longe else -1)))
            P.juntar(bm_prisma(ret(x(outer[1]), ya2, x(inner[0]), yb2), ZE + h, ZE + h + 0.8, 0.0), [B, B])
        # pilares das rampas e dos patamares
        for d in (inner[0] + 0.12, inner[1] - 0.12, outer[0] + 0.12, outer[1] - 0.12):
            for yy in (perto - 0.45, (perto + longe) / 2, longe + 0.45):
                if perto < yy < longe and d > inner[1]:
                    continue    # o meio da pista de fora é o 1º lance, que já sai do chão
                topo_h = H_CORREDOR - E if yy < perto else (2.5 - E if yy > longe else 1.875 - E)
                P.juntar(bm_caixa(0.2, 0.2, topo_h), B, T(x(d), s * yy, ZE))
    return P.criar()


# ———————————————————————————————————————————————— tribuna coberta e cabines

def cobertura_z(t):
    """Altura do topo da cobertura em arco: 10,15 m atrás, 9,5 m na frente, com a barriga curva no meio"""
    return ZE + 10.15 + (9.5 - 10.15) * t + 0.38 * math.sin(math.pi * t)


def d_frente(y):
    """Borda da frente da cobertura em planta: arco que avança mais no meio da tribuna (d = 1,2 m) que nas pontas"""
    return 1.2 + 1.7 * (y / Y_COBERTURA) ** 2


def tribuna(M):
    """
    Tribuna coberta do lado oeste (ficha): cobertura metálica em arco com telha de alumínio sobre vigas brancas que
    saem de pilares atrás da fachada, cobrindo o trecho reto do lado (~20% dos lugares), e a faixa das 14 cabines de
    rádio no alto da arquibancada.
    """
    P = Peca("Tribuna_Coberta")
    B, A = M["estrutura"], M["aluminio"]
    x = lambda d: -(HX0 + d)
    nu, nv = 12, 8
    d_tras = D_FACHADA + 0.6
    E = 0.22

    def ponto(u, v, baixo=False):
        y = -Y_COBERTURA + 2 * Y_COBERTURA * u / nu
        t = v / nv
        d = d_tras + (d_frente(y) - d_tras) * t
        return (x(d), y, cobertura_z(t) - (E if baixo else 0.0))

    for iu in range(nu):
        for iv in range(nv):
            q = [ponto(iu, iv), ponto(iu + 1, iv), ponto(iu + 1, iv + 1), ponto(iu, iv + 1)]
            uvs = [uv_reg("aluminio", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))]
            P.poli(q, A, uvs, normal=(0, 0, 1))
            P.poli([ponto(iu, iv, True), ponto(iu + 1, iv, True), ponto(iu + 1, iv + 1, True), ponto(iu, iv + 1, True)], B, normal=(0, 0, -1))
    # bordas: frente (testeira um pouco mais alta), fundos e pontas
    for iu in range(nu):
        a, b = ponto(iu, nv), ponto(iu + 1, nv)
        a2, b2 = ponto(iu, nv, True), ponto(iu + 1, nv, True)
        P.poli([a2, b2, (b[0], b[1], b[2] + 0.08), (a[0], a[1], a[2] + 0.08)], B, normal=(1, 0, 0))
        P.poli([(a[0], a[1], a[2] + 0.08), (b[0], b[1], b[2] + 0.08), b, a], B, normal=(0, 0, 1))
        a, b = ponto(iu, 0), ponto(iu + 1, 0)
        a2, b2 = ponto(iu, 0, True), ponto(iu + 1, 0, True)
        P.poli([a2, b2, b, a], B, normal=(-1, 0, 0))
    for iu, sy in ((0, -1), (nu, 1)):
        for iv in range(nv):
            a, b = ponto(iu, iv), ponto(iu, iv + 1)
            a2, b2 = ponto(iu, iv, True), ponto(iu, iv + 1, True)
            P.poli([a2, b2, b, a], B, normal=(0, sy, 0))
    # pilares atrás da fachada e vigas em balanço (perfil afinando para a frente)
    for k in range(7):
        y = -Y_COBERTURA + 2 * Y_COBERTURA * k / 6
        yv = max(-Y_COBERTURA + 0.15, min(Y_COBERTURA - 0.15, y))
        u = (yv + Y_COBERTURA) / (2 * Y_COBERTURA) * nu
        P.juntar(bm_caixa(0.42, 0.42, cobertura_z(0) - E - ZE), B, T(x(D_FACHADA + 0.25), yv, ZE))
        topo = []
        for iv in range(nv + 1):
            t = iv / nv
            d = d_tras + (d_frente(yv) - d_tras) * t
            topo.append((x(d), yv - 0.09, cobertura_z(t) - E))
        df = d_frente(yv) + 0.25
        base = [(x(df), yv - 0.09, cobertura_z(0.97) - E - 0.12), (x(D_FACHADA + 0.25), yv - 0.09, ZE + 9.0)]
        P.juntar(bm_poli_extrudado(topo + base, (0, 0.18, 0)), B)
        # tirante do topo do pilar até o meio da viga
        barra(P, (x(D_FACHADA + 0.25), yv, ZE + 9.05), (x(d_tras + (d_frente(yv) - d_tras) * 0.55), yv, cobertura_z(0.55) - E - 0.05), 0.07, M["ferro"])
    # cabines de rádio (14 × 1,23 m) no alto da arquibancada
    d0, d1 = D_PARAPEITO - 0.42, D_FACHADA + 0.1
    P.juntar(bm_prisma(ret(x(d1), -Y_TRIBUNA, x(d0), Y_TRIBUNA), ZE + 7.25, ZE + 9.2, 0.03), [B, M["fachada"]])
    P.juntar(bm_prisma(ret(x(d1) - 0.1, -Y_TRIBUNA - 0.1, x(d0) + 0.15, Y_TRIBUNA + 0.1), ZE + 9.2, ZE + 9.38, 0.0), [B, B])
    for k in range(14):
        y0 = -Y_TRIBUNA + 2 * Y_TRIBUNA * k / 14
        y1 = -Y_TRIBUNA + 2 * Y_TRIBUNA * (k + 1) / 14
        quad_reg(P, M, (x(d0) + 0.02, y1), (x(d0) + 0.02, y0), ZE + 7.6, ZE + 9.05, (1, 0, 0), "cabines")
    return P.criar()


# ———————————————————————————————————————————————— torres de iluminação

def torres(M):
    """
    Quatro torres de iluminação nos cantos (mantidas na reforma; o desenho real não foi confirmado): mastro treliçado
    de seção quadrada afinando para cima, plataforma e painel de refletores inclinado para o campo.
    """
    P = Peca("Torres_Iluminacao")
    Mt = M["torre"]
    H = 17.2
    pos = []
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        cx, cy = (CX if math.cos(a) > 0 else -CX), (CY if math.sin(a) > 0 else -CY)
        r = RC0 + D_FACHADA + 1.7
        pos.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    for tx, ty in pos:
        dirc = Vector((-tx, -ty, 0)).normalized()
        giro = math.degrees(math.atan2(dirc.y, dirc.x))
        R = Matrix.Rotation(math.radians(giro), 3, "Z")
        meia = lambda h: 0.85 + (0.32 - 0.85) * h / H
        canto = lambda h, sx, sy: Vector((tx, ty, ZE + h)) + R @ Vector((sx * meia(h), sy * meia(h), 0))
        cantos = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
        for sx, sy in cantos:
            barra(P, canto(0, sx, sy), canto(H, sx, sy), 0.15, Mt)
        niveis = 10
        for k in range(niveis + 1):
            h = H * k / niveis
            for j in range(4):
                a, b = cantos[j], cantos[(j + 1) % 4]
                barra(P, canto(h, *a), canto(h, *b), 0.07, Mt)
                if k < niveis:
                    h2 = H * (k + 1) / niveis
                    if (k + j) % 2:
                        barra(P, canto(h, *a), canto(h2, *b), 0.06, Mt)
                    else:
                        barra(P, canto(h, *b), canto(h2, *a), 0.06, Mt)
        # base de concreto
        P.juntar(bm_caixa(2.3, 2.3, 0.4, 0.06), M["soco"], T(tx, ty, ZE, giro))
        # plataforma e painel de refletores (4,6 × 2,7 m), inclinado 28° para baixo, de frente para o campo
        P.juntar(bm_caixa(1.7, 1.7, 0.12), Mt, T(tx, ty, ZE + H - 0.1, giro))
        centro = Vector((tx, ty, ZE + H + 1.3)) + dirc * 0.35
        incl = math.radians(28)
        frente = Vector((dirc.x * math.cos(incl), dirc.y * math.cos(incl), -math.sin(incl)))
        lateral = Vector((-dirc.y, dirc.x, 0))
        cima = frente.cross(lateral).normalized()
        if cima.z < 0:
            cima = -cima
        W, Hh, prof = 3.9, 2.3, 0.3
        # caixa do painel
        cx_ = [centro + lateral * (sx * W / 2) + cima * (sy * Hh / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        P.juntar(bm_poli_extrudado([tuple(p - frente * prof) for p in cx_], tuple(frente * prof)), M["ferro"])
        costas = [tuple(p - frente * (prof + 0.01)) for p in cx_]
        P.poli(costas, M["esquadrias"], [uv_reg("costas_refletores", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))], normal=tuple(-frente))
        for metade in (-1, 1):
            q = [centro + frente * 0.01 + lateral * (metade * W / 2 if metade < 0 else 0) + cima * (-Hh / 2 + 0.08),
                 centro + frente * 0.01 + lateral * (0 if metade < 0 else W / 2) + cima * (-Hh / 2 + 0.08),
                 centro + frente * 0.01 + lateral * (0 if metade < 0 else W / 2) + cima * (Hh / 2 - 0.08),
                 centro + frente * 0.01 + lateral * (metade * W / 2 if metade < 0 else 0) + cima * (Hh / 2 - 0.08)]
            P.poli([tuple(p) for p in q], M["esquadrias"], [uv_reg("refletores", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))], normal=tuple(frente))
        # braços que prendem o painel ao topo do mastro
        for sx in (-1, 1):
            barra(P, canto(H, sx, 0), centro - frente * prof + lateral * (sx * 1.2) - cima * 0.5, 0.1, Mt)
    return P.criar(), pos


# ———————————————————————————————————————————————— chão, ruas e calçadas

def chao(M):
    """
    Disco de asfalto (as quatro ruas) com as placas elevadas da esplanada do estádio e das calçadas do casario, meios-fios,
    faixas de rolamento, faixas de pedestres em frente aos portões e o gradil do lote nas cabeceiras.
    """
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["rua"], M["meiofio"]])
    g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, m, z=ZE):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.12))
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, z, 0.0, mat_lados=1), [m, M["meiofio"]])
        return poli

    (xo0, xo1), (xl0, xl1), (yt0, yt1) = X_RUA_O, X_RUA_L, Y_RUA_T
    esplanada = placa(ret(xo1, -yt0, xl0, yt0), M["piso"])
    for s in (-1, 1):
        ya, yb = sorted((s * yt0, s * 0.0))
        placa(ret(-40, -yt0, xo0, yt0), M["calcada"]) if s < 0 else placa(ret(xl1, -yt0, 40, yt0), M["calcada"])
        ya, yb = sorted((s * yt1, s * 40))
        placa(ret(-40, ya, 40, yb), M["calcada"])
    # canteiros de grama nas cabeceiras da esplanada (onde ficam as árvores)
    for s in (-1, 1):
        for x0, x1 in ((-20.8, -12.5), (11.0, 18.5)):
            ya, yb = sorted((s * 22.3, s * 24.6))
            placa(ret(x0, ya, x1, yb), M["grama"], ZE + 0.03)
    # faixas: tracejado no eixo das ruas e faixas de pedestres
    F = M["faixa"]

    def faixa(x0, y0, x1, y1):
        poli = simplificar(recortar_no_disco(ret(x0, y0, x1, y1), RAIO - 0.3))
        if len(poli) >= 3:
            pisos.poli([(p[0], p[1], Z0 + 0.006) for p in poli], F, normal=(0, 0, 1))

    for xr in ((xo0 + xo1) / 2, (xl0 + xl1) / 2):
        y = -34.0
        while y < 34:
            if not (yt0 - 0.5 < abs(y) < yt1 + 0.5 or yt0 - 0.5 < abs(y + 1.4) < yt1 + 0.5):
                faixa(xr - 0.07, y, xr + 0.07, y + 1.4)
            y += 2.6
    yr = (yt0 + yt1) / 2
    for s in (-1, 1):
        x = -34.0
        while x < 34:
            if not (xo0 - 0.5 < x < xo1 + 0.5 or xl0 - 0.5 < x < xl1 + 0.5 or xo0 - 0.5 < x + 1.4 < xo1 + 0.5 or xl0 - 0.5 < x + 1.4 < xl1 + 0.5):
                faixa(x, s * yr - 0.07, x + 1.4, s * yr + 0.07)
            x += 2.6
    # faixas de pedestres: do portal para a calçada oeste, e nas cabeceiras
    for k in range(9):
        y = -2.4 + 0.6 * k
        faixa(xo0 + 0.3, y, xo1 - 0.3, y + 0.32)
    for s in (-1, 1):
        for k in range(8):
            x = -2.1 + 0.6 * k
            ya, yb = sorted((s * (yt0 + 0.3), s * (yt1 - 0.3)))
            faixa(x, ya, x + 0.32, yb)
    pisos.criar()
    return esplanada


def gradil(M):
    """Gradil do lote nas cabeceiras: mureta, pilaretes e barras grafite (o .tsx instancia as barras), com portão no eixo"""
    P = Peca("Gradil_Lote")
    barras = []
    for s in (-1, 1):
        y = s * Y_GRADIL
        lim = math.sqrt((RAIO - 0.7) ** 2 - Y_GRADIL ** 2)    # o gradil para antes da borda do disco
        for x0, x1 in ((max(X_RUA_O[1] + 0.3, -lim), -2.6), (2.6, min(X_RUA_L[0] - 0.3, lim))):
            L = x1 - x0
            P.juntar(bm_caixa(L, 0.25, 0.35), M["soco"], T((x0 + x1) / 2, y, ZE))
            P.juntar(bm_caixa(L, 0.08, 0.06), M["ferro"], T((x0 + x1) / 2, y, ZE + 1.25))
            nb = int(L / 0.2)
            for k in range(nb + 1):
                barras.append((x0 + L * k / nb, y, ZE + 0.35, 0.92))
            npil = max(1, round(L / 3.0))
            for k in range(npil + 1):
                P.juntar(bm_caixa(0.3, 0.3, 1.45, 0.03), M["fachada"], T(x0 + L * k / npil, y, ZE))
        # portão de correr aberto, encostado no gradil
        quad_reg(P, M, (2.7, y + s * 0.2), (6.5, y + s * 0.2), ZE, ZE + 1.4, (0, s, 0), "portoes_lote")
        quad_reg(P, M, (6.5, y + s * 0.2), (2.7, y + s * 0.2), ZE, ZE + 1.4, (0, -s, 0), "portoes_lote")
    return P.criar(), barras


def bilheterias(M):
    """Bilheterias dos setores: quiosques com dois guichês e laje fina (posições neutras; a ficha só dá o número, 4)"""
    P = Peca("Bilheterias")
    for x, y, giro in ((-7.5, 22.6, -90), (7.5, -22.6, 90), (18.9, -6.5, 180)):
        P.juntar(bm_caixa(1.1, 2.2, 1.6, 0.04), M["fachada"], T(x, y, ZE, giro))
        P.juntar(bm_caixa(1.5, 2.6, 0.12), M["estrutura"], T(x, y, ZE + 1.6, giro))
        r = Matrix.Rotation(math.radians(giro), 3, "Z")
        n = r @ Vector((-1, 0, 0))
        c = Vector((x, y, 0)) + n * 0.57
        t = r @ Vector((0, -1, 0))
        quad_reg(P, M, c - t * 1.0, c + t * 1.0, ZE + 0.05, ZE + 1.5, (n.x, n.y, 0), "bilheteria")
    return P.criar()


def postes(M):
    """Postes de iluminação pública nas calçadas e na esplanada (braço simples, luminária clara)"""
    P = Peca("Postes")
    lista = []
    for y in (-18.0, -6.0, 6.0, 18.0):
        lista.append((X_RUA_O[1] + 0.4, y, 0))
        lista.append((X_RUA_L[0] - 0.4, y, 180))
    for x in (-14.0, 14.0):
        for s in (-1, 1):
            lista.append((x, s * (Y_RUA_T[0] - 0.4), -90 * s))
    for x, y, g in lista:
        if math.hypot(x, y) > RAIO - 0.8:
            continue
        P.juntar(bm_cilindro(0.09, 4.2, 8, r2=0.06), M["poste"], T(x, y, ZE))
        a = math.radians(g)
        barra(P, (x, y, ZE + 4.0), (x + 1.0 * math.cos(a), y + 1.0 * math.sin(a), ZE + 4.25), 0.06, M["poste"])
        P.juntar(bm_caixa(0.5, 0.22, 0.1), M["globo"], T(x + 1.05 * math.cos(a), y + 1.05 * math.sin(a), ZE + 4.12, g))
    return P.criar()


# ———————————————————————————————————————————————— casario do Benfica

CORES_CASAS = ["#e8c872", "#9cc6c4", "#e49a7a", "#f1ece0", "#b9cfe6", "#d8a0b6", "#c9d98f", "#efe0b8"]


def casario(M):
    """
    Casario baixo dos dois lados (StadiumDB: "low-density housing"): casas térreas e sobrados geminados de frente para
    a rua, paredes em tons pastel, platibanda em parte delas e telha de barro. Genérico do Benfica, sem casa específica.
    """
    P = Peca("Casario")
    rnd = random.Random(1941)   # ano da inauguração
    livres = []
    for lado in (-1, 1):
        xf = X_RUA_O[0] - 1.8 if lado < 0 else X_RUA_L[1] + 1.8       # frente (alinhamento das casas)
        y = -Y_RUA_T[0] + 0.6
        while y < Y_RUA_T[0] - 2.0:
            w = rnd.uniform(2.6, 3.8)
            y1 = min(y + w, Y_RUA_T[0] - 0.6)
            ymax = max(abs(y), abs(y1))
            if ymax >= RAIO:
                y = y1 + 0.15
                continue
            xr = math.sqrt(RAIO ** 2 - ymax ** 2) - 0.35
            prof = min(rnd.uniform(5.5, 8.0), xr - abs(xf))
            if prof < 1.6 or y1 - y < 2.0:
                y = y1 + 0.15
                continue
            sobrado = rnd.random() < 0.35
            h = rnd.uniform(3.2, 3.8) if sobrado else rnd.uniform(2.1, 2.5)
            cor = CORES_CASAS[rnd.randrange(len(CORES_CASAS))]
            xa, xb = sorted((xf, xf + lado * prof))
            casa(P, M, xa, y, xb, y1, h, cor, -lado, rnd.random() < 0.5, sobrado)
            livres.append(ret(xa, y, xb, y1))
            y = y1 + rnd.choice((0.0, 0.0, 0.15))
    return P.criar(), livres


def casa(P, M, x0, y0, x1, y1, h, cor, frente, platibanda, sobrado):
    """Uma casa: paredes tingidas, telhado de duas águas com a cumeeira paralela à rua, porta e janelas na frente"""
    W = tinta(M["parede"], cor)
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), ZE, ZE + h, 0.0), [M["parede"], W])
    P.juntar(bm_prisma(ret(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04), ZE, ZE + 0.35, 0.0), [M["soco"], M["soco"]])
    # telhado de duas águas: cumeeira paralela à rua (eixo y)
    b = 0.25
    zc, zt = ZE + h, ZE + h + min(1.1, (x1 - x0) * 0.22)
    xm = (x0 + x1) / 2
    for xa, xb in ((x0 - b, xm), (x1 + b, xm)):
        q = [(xa, y0 - b, zc - 0.06), (xa, y1 + b, zc - 0.06), (xb, y1 + b, zt), (xb, y0 - b, zt)]
        P.poli(q, M["telha"], [uv_reg("telha", a, c) for a, c in ((0, 0), (1, 0), (1, 1), (0, 1))], normal=(xa - xb, 0, 1))
    for yy, sy in ((y0, -1), (y1, 1)):
        P.poli([(x0, yy, zc), (x1, yy, zc), (xm, yy, zt)], W, normal=(0, sy, 0))
    xfrente = x1 if frente > 0 else x0
    if platibanda:
        P.juntar(bm_prisma(ret(xfrente - 0.12, y0, xfrente + 0.12, y1), zc, zc + 0.75, 0.0), [M["fachada"], W])
        P.juntar(bm_prisma(ret(xfrente - 0.16, y0 - 0.02, xfrente + 0.16, y1 + 0.02), zc + 0.75, zc + 0.85, 0.0), [M["fachada"], M["fachada"]])
    # frente: porta e janelas (térreo) e janelas no sobrado
    xq = xfrente + frente * (0.13 if platibanda else 0.02)
    L = y1 - y0
    yp = y0 + 0.35 if frente > 0 else y1 - 1.05
    porta = ((xq, yp + 0.7), (xq, yp)) if frente < 0 else ((xq, yp), (xq, yp + 0.7))
    quad_reg(P, M, porta[0], porta[1], ZE + 0.05, ZE + 1.75, (frente, 0, 0), "porta_casa")
    nj = 1 if L < 3.0 else 2
    for k in range(nj):
        yc = y0 + 1.35 + (L - 1.6) * (k + 0.5) / nj if frente > 0 else y1 - 1.35 - (L - 1.6) * (k + 0.5) / nj
        a, c = (xq, yc - 0.38), (xq, yc + 0.38)
        if frente < 0:
            a, c = c, a
        quad_reg(P, M, a, c, ZE + 0.8, ZE + 1.85, (frente, 0, 0), "janela_casa")
        if sobrado:
            quad_reg(P, M, a, c, ZE + 2.45, ZE + 3.25, (frente, 0, 0), "janela_casa")
    if sobrado:
        yc = yp + 0.35
        a, c = (xq, yc - 0.38), (xq, yc + 0.38)
        if frente < 0:
            a, c = c, a
        quad_reg(P, M, a, c, ZE + 2.45, ZE + 3.25, (frente, 0, 0), "janela_casa")


# ———————————————————————————————————————————————— vegetação, gente e carros (layout para o .tsx)

def layout(livres, torres_pos):
    """Posições determinísticas (referencial do estádio; viram coordenadas do three no fim)"""
    rnd = random.Random(1948)   # ano dos refletores
    arvores = []   # (x, y, altura do tronco, raio da copa)

    def ok(x, y, r):
        if math.hypot(x, y) > RAIO - 0.4 - r * 0.7:
            return False
        if any(ponto_no_poligono((x, y), p) for p in livres):
            return False
        if any(math.hypot(x - a[0], y - a[1]) < 0.8 * (r + a[3]) for a in arvores):
            return False
        return all(math.hypot(x - tx, y - ty) > r + 1.6 for tx, ty in torres_pos)

    # oitis nas calçadas do casario
    for xr in (X_RUA_O[0] - 0.9, X_RUA_L[1] + 0.9):
        y = -24.0 + rnd.uniform(0, 1.5)
        while y < 24:
            r = rnd.uniform(1.3, 1.8)
            if ok(xr, y, r):
                arvores.append((xr, y, rnd.uniform(1.5, 2.0), r))
            y += rnd.uniform(4.2, 6.0)
    # canteiros das cabeceiras da esplanada
    for s in (-1, 1):
        for x0, x1 in ((-20.8, -12.5), (11.0, 18.5)):
            x = x0 + 1.4
            while x < x1 - 0.8:
                r = rnd.uniform(1.25, 1.65)
                y = s * (23.45 + rnd.uniform(-0.2, 0.2))
                if ok(x, y, r):
                    arvores.append((x, y, rnd.uniform(1.6, 2.1), r))
                x += rnd.uniform(2.6, 3.4)
    # calçadas além das ruas transversais e quintais atrás do casario
    for _ in range(400):
        if len(arvores) > 60:
            break
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(RAIO - 3.0, RAIO - 1.0)
        x, y = d * math.cos(a), d * math.sin(a)
        alem = abs(y) > Y_RUA_T[1] + 0.6 and not (X_RUA_O[0] - 0.3 < x < X_RUA_O[1] + 0.3 or X_RUA_L[0] - 0.3 < x < X_RUA_L[1] + 0.3)
        quintal = abs(y) < Y_RUA_T[0] - 0.6 and (x < X_RUA_O[0] - 2.4 or x > X_RUA_L[1] + 2.4)
        if not (alem or quintal):
            continue
        r = rnd.uniform(1.2, 1.7)
        if ok(x, y, r):
            arvores.append((x, y, rnd.uniform(1.4, 2.0), r))
    # pessoas: portal, portões, cabeceiras e calçadas (1,4 m na escala do estádio: exagero para ler)
    pessoas = []
    zonas = [((X_RUA_O[1] + 0.9, 0.0), (0.5, 9.0), 12), ((0.0, 21.8), (4.0, 0.6), 6), ((0.0, -21.8), (4.0, 0.6), 7),
             ((18.6, 3.8), (0.5, 2.0), 3), ((18.6, -3.8), (0.5, 2.0), 3), ((X_RUA_O[0] - 0.9, 0.0), (0.4, 14.0), 5),
             ((X_RUA_L[1] + 0.9, 0.0), (0.4, 14.0), 4), ((0.0, -Y_RUA_T[1] - 1.0), (8.0, 0.4), 3), ((-7.5, 23.9), (0.8, 0.4), 3),
             ((7.5, -23.9), (0.8, 0.4), 3)]
    for (cx, cy), (ax, ay), n in zonas:
        k = tent = 0
        while k < n and tent < 500:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.55 for p in pessoas):
                continue
            if any(math.hypot(x - a[0], y - a[1]) < 0.35 for a in arvores):
                continue
            pessoas.append((x, y, rnd.uniform(0, 360), rnd.randrange(7)))
            k += 1
    # carros: estacionados junto aos meios-fios e alguns passando
    carros = []   # (x, y, giro, cor)
    for xr, sentido in ((X_RUA_O[0] + 0.85, 90), (X_RUA_L[1] - 0.85, -90)):
        y = -24.0
        while y < 24:
            if rnd.random() < 0.72 and not abs(y) < 3.2:
                carros.append((xr, y, sentido + rnd.uniform(-2, 2), rnd.randrange(8)))
            y += rnd.uniform(2.6, 3.4)
    carros += [(sum(X_RUA_O) / 2 - 0.9, -11.0, 90, 2), (sum(X_RUA_O) / 2 + 0.9, 13.5, -90, 4), (sum(X_RUA_L) / 2 + 0.9, 6.0, 90, 6),
               (sum(X_RUA_L) / 2 - 0.9, -16.0, -90, 1), (-6.0, -(sum(Y_RUA_T) / 2) - 0.9, 0, 5), (9.0, -(sum(Y_RUA_T) / 2) + 0.9, 180, 3),
               (-4.0, sum(Y_RUA_T) / 2 + 0.9, 180, 0), (12.0, -(sum(Y_RUA_T) / 2) - 0.9, 0, 7)]
    carros = [c for c in carros if math.hypot(c[0], c[1]) < RAIO - 1.4]
    return arvores, pessoas, carros


def proxies(arvores, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.82, 1)))
        P.juntar(bm, m, T(x, y, ZE + h + r * 0.8))
        P.juntar(bm_cilindro(0.15, h + 0.3, 6), m, T(x, y, ZE))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(2.2, 1.0, 0.8), m, T(x, y, Z0, g))
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
    placa.location.z = ZE + 0.05
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
    tor, torres_pos = torres(M)
    grd, barras = gradil(M)
    cas, livres = casario(M)
    obs = [campo(M), arquibancadas(M), fachada(M), portal(M), tribuna(M), tor, grd, bilheterias(M), postes(M), cas]
    arvores, pessoas, carros = layout(livres, torres_pos)
    print(f"árvores {len(arvores)}, pessoas {len(pessoas)}, carros {len(carros)}, barras {len(barras)}")
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
    dados = {
        "arvores": [[tres(x, y)[0], round(ZE + h, 3), tres(x, y)[1], round(r, 3)] for x, y, h, r in arvores],
        "pessoas": [[tres(x, y)[0], ZE, tres(x, y)[1], round(math.radians(g), 3), k] for x, y, g, k in pessoas],
        "carros": [[*tres(x, y), round(math.radians(g + GIRO), 3), k] for x, y, g, k in carros],
        "barras": [[*tres(x, y), round(z, 3), round(h, 3)] for x, y, z, h in barras],
        "chao": {"lado": LADO_AO, "z0": Z0, "ze": ZE},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
