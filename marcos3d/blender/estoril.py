# -*- coding: utf-8 -*-
"""
Estoril (antiga Vila Morena, Praia de Iracema) em miniatura: gera as peças estáticas do marco no Blender e exporta para
a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/estoril.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/estoril.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o Estoril.tsx carrega as três):
    estoril-pecas.glb     chão, mar e areia, o palacete (sobrado, torre, varandas, anexos) e a orla
                          (sem compressão, oclusão assada nas cores de vértice)
    estoril-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    estoril-layout.json   árvores, coqueiros, pessoas e carros (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-estoril.md): o palacete inteiro no rumo real, com a fachada da torre para a
Rua dos Tabajaras (sul, de frente para as câmeras da oficina) e, atrás, o calçadão, a areia e o mar comprimidos na
faixa norte do disco. Tudo é modelado num referencial do prédio: x = ao longo do eixo (leste real, rumo 105,5°),
y = da Tabajaras para o mar, z = cima. A planta do OSM (pesquisa/estoril/osm.xml, building:part) entra por medidas em
(u, v) do eixo, × K = 1,15. Alturas: térreo 4,6 m, beiral do sobrado 9 m, mirante da torre até 12,9 m e telhado até
~14,9 m (OSM: 8,3 m e 11,1 m).

GIRO = -15.5: o referencial do prédio volta para o rumo real (eixo a 105,5°, norte em −z do three). A fachada sul fica
a ~15° da vista "frente", então não foi preciso girar a composição para as câmeras (diferente do Theatro).
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
PREFIXO = "estoril"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do piso: tudo pousa aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
GIRO = -15.5         # graus, anti-horário visto de cima: referencial do prédio → mundo (rumo real do eixo, 105,5°)
MUNDO = Matrix.Rotation(math.radians(GIRO), 4, "Z")

# ——— planta do OSM no referencial do eixo (u ao longo do eixo, v para o mar; ficha) → miniatura
K = 1.15
U0 = 1.6             # centro do contorno em u
YOFF = -2.9          # empurra o prédio um pouco para o sul: sobra a faixa do mar no norte


def m(u, v):
    """(u, v) do OSM no referencial do eixo → (x, y) da miniatura"""
    return (K * (u - U0), K * v + YOFF)


def mx(u):
    return K * (u - U0)


def my(v):
    return K * v + YOFF


Y_FRENTE = my(-4.0)          # fachada sul (corpo, torre, anexo leste)
X_C0, X_C1 = mx(-1.2), mx(8.5)   # corpo principal (2 pavimentos)
Y_C1 = my(1.3)               # fundo do corpo (começa a ala norte)
X_ALA0, Y_ALA1 = mx(2.5), my(10.4)
X_T1, Y_T1 = mx(11.3), my(-0.3)  # torre: X_C1..X_T1, Y_FRENTE..Y_T1
X_B0, X_B1, Y_B0, Y_B1 = mx(-7.6), mx(-3.9), my(-3.2), my(3.3)   # bloco oeste (2 pavimentos)
X_L0 = mx(-8.6)              # varanda em arcada da frente: X_L0..X_C0
Y_LF = my(-2.1)              # parede do fundo da varanda da frente (profundidade 2,2 m)
X_VL1 = mx(10.3)             # varanda leste da ala (X_C1..X_VL1, Y_T1..my(10))
Y_VL1 = my(10.0)
X_AN1, Y_AN1 = mx(22.0), my(3.6)  # anexo leste
H_T = 4.6            # térreo (piso do pavimento superior e dos terraços)
H_E = 9.0            # beiral do sobrado
H_ANEXO = 4.8
H_OESTE = 3.4
INCL = 0.5           # caimento dos telhados de telha marselha (~27°)

# Rua dos Tabajaras (rua compartilhada de bloquetes): eixo a ~6° do prédio, mais perto dele a leste
RUA_Y0 = -17.6       # eixo da rua em x = 0
RUA_INC = 0.105      # dy/dx
RUA_MEIA = 3.4       # meia largura do leito


def rua_y(x):
    return RUA_Y0 + RUA_INC * x


Y_CALCADAO = my(10.4) + 1.2      # começo do calçadão (logo atrás do prédio)
Y_AREIA = 19.0
Y_MAR = 25.2


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
    mm = 1e9
    for a, b in zip(poli, poli[1:] + poli[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        mm = min(mm, math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    return mm


def ret(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def corte(pts, eixo, s0, maior):
    """Corta um polígono convexo 2D no semiplano coord[eixo] >= s0 (maior) ou <= s0"""
    out = []
    for i in range(len(pts)):
        p, q = pts[i], pts[(i + 1) % len(pts)]
        dp = (p[eixo] >= s0) if maior else (p[eixo] <= s0)
        dq = (q[eixo] >= s0) if maior else (q[eixo] <= s0)
        if dp:
            out.append(p)
        if dp != dq:
            t = (s0 - p[eixo]) / (q[eixo] - p[eixo])
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def celula(poli, s0, s1, t0, t1):
    r = corte(poli, 0, s0, True)
    if len(r) >= 3:
        r = corte(r, 0, s1, False)
    if len(r) >= 3:
        r = corte(r, 1, t0, True)
    if len(r) >= 3:
        r = corte(r, 1, t1, False)
    return r if len(r) >= 3 else []


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
    mm = bpy.data.materials.new(nome)
    if mm.node_tree is None:
        mm.use_nodes = True
    nos = mm.node_tree.nodes
    b = nos.get("Principled BSDF") or nos.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*srgb_lin(cor), 1.0)
    b.inputs["Roughness"].default_value = rug
    b.inputs["Metallic"].default_value = metal
    if imagem is not None:
        t = nos.new("ShaderNodeTexImage")
        t.image = imagem
        t.interpolation = "Linear"
        mm.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    MATS[nome] = mm
    return mm


# ———————————————————————————————————————————————— construtor de malhas

class Peca:
    """Acumula geometria num bmesh com vários materiais e vira um objeto só (uma malha por peça do marco)"""

    def __init__(self, nome):
        self.nome = nome
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []

    def mi(self, mm):
        if mm not in self.mats:
            self.mats.append(mm)
        return self.mats.index(mm)

    def poli(self, pts, mm, uvs=None, liso=False):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(mm)
        f.smooth = liso
        if uvs:
            for lp, uv in zip(f.loops, uvs):
                lp[self.uv].uv = uv
        return f

    def quad_uv(self, pts, mm, reg, a0=0.0, a1=1.0):
        """Quadrilátero (base esq., base dir., topo dir., topo esq.) com UV numa região do atlas"""
        return self.poli(pts, mm, [uv_reg(reg, a, b) for a, b in ((a0, 0), (a1, 0), (a1, 1), (a0, 1))])

    def juntar(self, bm2, mm, M=None, liso=None):
        """Copia um bmesh temporário; `mm` é um material ou uma lista indexada pelo material_index da face"""
        if M is not None:
            bm2.transform(M)
        uv2 = bm2.loops.layers.uv.active
        mp = {v: self.bm.verts.new(v.co) for v in bm2.verts}
        for f in bm2.faces:
            try:
                nf = self.bm.faces.new([mp[v] for v in f.verts])
            except ValueError:
                continue
            m_ = mm[min(f.material_index, len(mm) - 1)] if isinstance(mm, (list, tuple)) else mm
            nf.material_index = self.mi(m_)
            nf.smooth = f.smooth if liso is None else liso
            if uv2 is not None:
                for lp, l2 in zip(nf.loops, f.loops):
                    lp[self.uv].uv = l2[uv2].uv
        bm2.free()

    def criar(self):
        me = bpy.data.meshes.new(self.nome)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
        self.bm.transform(MUNDO)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for mm in self.mats:
            me.materials.append(mm)
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


def bm_torno(perfil, n=16):
    """Superfície de revolução fechada de um perfil [(r, z), ...] em volta do eixo z (pináculos, balaústres)"""
    bm = bmesh.new()
    aneis = []
    for i in range(n):
        a = 2 * math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        aneis.append([bm.verts.new((r * ca, r * sa, z)) if r > 1e-6 else None for r, z in perfil])
    polos = {j: bm.verts.new((0, 0, z)) for j, (r, z) in enumerate(perfil) if r <= 1e-6}
    for i in range(n):
        A, B = aneis[i], aneis[(i + 1) % n]
        for j in range(len(perfil) - 1):
            a0v, a1v, b0v, b1v = A[j], A[j + 1], B[j], B[j + 1]
            if a0v is None and a1v is None:
                continue
            if a0v is None:
                bm.faces.new([polos[j], b1v, a1v])
            elif a1v is None:
                bm.faces.new([a0v, b0v, polos[j + 1]])
            else:
                bm.faces.new([a0v, b0v, b1v, a1v])
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


def caixa(P, mm, x0, y0, z0, x1, y1, z1, chanfro=0.0):
    """Caixa alinhada aos eixos de (x0, y0, z0) a (x1, y1, z1)"""
    P.juntar(bm_caixa(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), chanfro), mm, T((x0 + x1) / 2, (y0 + y1) / 2, min(z0, z1)))


def barra(P, a, b, esp, mm):
    """Perfil quadrado de a até b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    if L < 1e-4:
        return
    bm = bm_caixa(L, esp, esp)
    bmesh.ops.translate(bm, vec=Vector((L / 2, 0, -esp / 2)), verts=bm.verts)
    q = Vector((1, 0, 0)).rotation_difference(d.normalized())
    P.juntar(bm, mm, Matrix.Translation(a) @ q.to_matrix().to_4x4())


# ———————————————————————————————————————————————— atlas de esquadrias e telha (256 px, gerado aqui)

COR_PAREDE = "#fdebc4"     # branco quente neutro (na sombra do site sai branco; a cor real não foi confirmada) (a cor real não foi confirmada: dúvida na ficha)
COR_BRANCO = "#fff9ec"     # molduras, cunhais, frisos
COR_MADEIRA = "#6e4b33"    # venezianas e portas de madeira (neutro)
COR_MADEIRA_ESC = "#4f3423"
COR_VIDRO = "#33424f"

REGIOES = {
    "porta": (0.0, 0.75, 0.25, 1.0),          # porta principal de madeira almofadada com bandeira de vidro em arco
    "janela": (0.25, 0.75, 0.5, 1.0),         # janela de venezianas com bandeira e moldura branca (verga reta)
    "porta_janela": (0.5, 0.75, 0.75, 1.0),   # porta-janela de venezianas do pavimento superior, verga em arco abatido
    "porta_vidro": (0.75, 0.75, 1.0, 1.0),    # porta de vidro "francesa" em arco pleno (anexo e fundo da varanda)
    "janela_peq": (0.0, 0.5, 0.25, 0.75),     # janela pequena (torre, anexos, fundos)
    "venez_arco": (0.25, 0.5, 0.5, 0.75),     # janela do térreo em arco pleno com venezianas
    "telha": (0.5, 0.5, 1.0, 0.75),           # telha marselha: 4 × 4 telhas numa célula de 1,6 × 1,6 m (cor vem do .tsx)
    "balaus": (0.0, 0.375, 0.5, 0.5),         # balaustrada: 4 balaústres brancos por ladrilho (1,2 m)
}
# proporção (largura/altura, em metros) do quadro em que cada região é usada: os arcos do atlas saem redondos
ASPECTO = {"porta": 1.7 / 3.5, "janela": 1.3 / 2.3, "porta_janela": 1.15 / 3.0, "porta_vidro": 1.6 / 3.4,
           "janela_peq": 0.8 / 1.1, "venez_arco": 1.4 / 2.8}


def atlas_esquadrias(n=256):
    px = [0.0] * (n * n * 4)

    def pinta(x, y, cor):
        if 0 <= x < n and 0 <= y < n:
            i = (y * n + x) * 4
            px[i:i + 4] = [cor[0], cor[1], cor[2], 1.0]

    def r(u0, v0, u1, v1, cor):
        c = srgb_lin(cor)
        for y in range(max(0, int(round(v0 * n))), min(n, int(round(v1 * n)))):
            for x in range(max(0, int(round(u0 * n))), min(n, int(round(u1 * n)))):
                pinta(x, y, c)

    def arco(reg, a0, a1, b0, b1, cor, cor_fn=None, flecha=1.0):
        """Abertura com topo em arco (pleno com flecha 1; abatido com flecha < 1) na proporção do quadro"""
        u0, v0, u1, v1 = REGIOES[reg]
        w, h = u1 - u0, v1 - v0
        asp = ASPECTO.get(reg, 1.0)
        ra = (a1 - a0) / 2
        rb = ra * asp * flecha
        bm_ = b1 - rb
        c = srgb_lin(cor)
        for y in range(int(v0 * n), int(v1 * n)):
            b = ((y + 0.5) / n - v0) / h
            if b < b0 or b > b1:
                continue
            for x in range(int(u0 * n), int(u1 * n)):
                a = ((x + 0.5) / n - u0) / w
                if a < a0 or a > a1:
                    continue
                ac = (a0 + a1) / 2
                if b <= bm_ or ((a - ac) / ra) ** 2 + ((b - bm_) / rb) ** 2 <= 1:
                    pinta(x, y, srgb_lin(cor_fn(a, b, ac, bm_, ra, rb)) if cor_fn else c)
        return bm_

    def faixa(reg, a0, a1, b0, b1, cor):
        u0, v0, u1, v1 = REGIOES[reg]
        r(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * b0, u0 + (u1 - u0) * a1, v0 + (v1 - v0) * b1, cor)

    def venezianas(reg, a0, a1, b0, b1, passo=0.045):
        b = b0 + 0.02
        while b < b1 - 0.01:
            faixa(reg, a0, a1, b, b + passo * 0.3, COR_MADEIRA_ESC)
            b += passo

    r(0, 0, 1, 1, COR_PAREDE)

    # porta principal: moldura branca em arco, folhas de madeira almofadadas, bandeira de vidro com raios
    def leque(a, b, ac, bm_, ra, rb):
        if b < bm_:
            return COR_MADEIRA
        ang = math.atan2((b - bm_) / rb, (a - ac) / ra)
        borda = abs(ang / math.pi * 6 - round(ang / math.pi * 6)) < 0.1
        return COR_BRANCO if borda else COR_VIDRO
    arco("porta", 0.03, 0.97, 0.0, 0.99, COR_BRANCO)
    bm_p = arco("porta", 0.13, 0.87, 0.0, 0.94, COR_MADEIRA, leque)
    faixa("porta", 0.13, 0.87, bm_p - 0.03, bm_p, COR_BRANCO)
    faixa("porta", 0.49, 0.51, 0.0, bm_p - 0.03, COR_MADEIRA_ESC)
    for b0 in (0.07, 0.33):
        for a0 in (0.19, 0.57):
            faixa("porta", a0, a0 + 0.24, b0, b0 + 0.2, "#5b3c28")
            faixa("porta", a0, a0 + 0.24, b0, b0 + 0.02, "#8a6347")

    # janela de venezianas: moldura branca, bandeira de vidro, peitoril
    faixa("janela", 0.04, 0.96, 0.0, 1.0, COR_BRANCO)
    faixa("janela", 0.14, 0.86, 0.08, 0.92, COR_MADEIRA)
    venezianas("janela", 0.14, 0.86, 0.08, 0.68)
    faixa("janela", 0.14, 0.86, 0.7, 0.92, COR_VIDRO)
    faixa("janela", 0.14, 0.86, 0.68, 0.71, COR_BRANCO)
    faixa("janela", 0.49, 0.51, 0.08, 0.92, COR_BRANCO)
    faixa("janela", 0.0, 1.0, 0.0, 0.05, "#e6e0d3")

    # porta-janela do pavimento superior: venezianas, bandeira em arco abatido
    arco("porta_janela", 0.04, 0.96, 0.0, 0.995, COR_BRANCO, flecha=0.45)
    bm_s = arco("porta_janela", 0.15, 0.85, 0.02, 0.95, COR_MADEIRA, flecha=0.45)
    venezianas("porta_janela", 0.15, 0.85, 0.02, bm_s - 0.11, 0.035)
    arco("porta_janela", 0.15, 0.85, bm_s - 0.09, 0.95, COR_VIDRO, flecha=0.45)
    faixa("porta_janela", 0.15, 0.85, bm_s - 0.11, bm_s - 0.09, COR_BRANCO)
    faixa("porta_janela", 0.49, 0.51, 0.02, bm_s - 0.09, COR_MADEIRA_ESC)

    # porta de vidro em arco pleno: caixilho branco, vidro escuro, travessas
    arco("porta_vidro", 0.04, 0.96, 0.0, 0.995, COR_BRANCO)
    bm_v = arco("porta_vidro", 0.14, 0.86, 0.0, 0.95, COR_VIDRO)
    for b in (0.28, 0.52, bm_v - 0.01):
        faixa("porta_vidro", 0.14, 0.86, b, b + 0.012, COR_BRANCO)
    faixa("porta_vidro", 0.485, 0.515, 0.0, 0.95, COR_BRANCO)
    faixa("porta_vidro", 0.14, 0.86, 0.0, 0.1, COR_MADEIRA)

    # janela pequena: moldura branca, venezianas
    faixa("janela_peq", 0.08, 0.92, 0.0, 1.0, COR_BRANCO)
    faixa("janela_peq", 0.2, 0.8, 0.1, 0.9, COR_MADEIRA)
    venezianas("janela_peq", 0.2, 0.8, 0.1, 0.9, 0.06)

    # janela do térreo em arco pleno: venezianas e bandeira em leque
    arco("venez_arco", 0.05, 0.95, 0.0, 0.99, COR_BRANCO)
    bm_a = arco("venez_arco", 0.16, 0.84, 0.05, 0.94, COR_MADEIRA)
    venezianas("venez_arco", 0.16, 0.84, 0.05, bm_a - 0.02, 0.04)
    arco("venez_arco", 0.16, 0.84, bm_a, 0.94, COR_VIDRO)
    faixa("venez_arco", 0.49, 0.51, 0.05, bm_a, COR_MADEIRA_ESC)
    faixa("venez_arco", 0.0, 1.0, 0.0, 0.05, "#e6e0d3")

    # telha marselha: 4 telhas × 4 fiadas; cada telha com dois canais e a sombra da sobreposição embaixo (cinza-claro
    # quente: a cor terracota vem do .tsx)
    u0, v0, u1, v1 = REGIOES["telha"]
    W, H = (u1 - u0), (v1 - v0)
    for x in range(int(u0 * n), int(u1 * n)):
        a = ((x + 0.5) / n - u0) / W * 4
        fa = a - math.floor(a)
        for y in range(int(v0 * n), int(v1 * n)):
            b = ((y + 0.5) / n - v0) / H * 4
            fb = b - math.floor(b)
            canal = 0.5 + 0.5 * math.cos(fa * 4 * math.pi)        # dois relevos por telha
            k = 0.86 + 0.12 * canal
            if fa < 0.06 or fa > 0.94:
                k = 0.74                                          # junta entre telhas
            if fb < 0.16:
                k *= 0.62 + 0.38 * fb / 0.16                      # sombra da fiada de cima
            elif fb > 0.9:
                k *= 1.05
            pinta(x, y, [min(1.0, c * k) for c in srgb_lin("#fbf3ec")])

    # balaustrada: fundo em sombra, 4 balaústres brancos, corrimão e base
    u0, v0, u1, v1 = REGIOES["balaus"]
    r(u0, v0, u1, v1, "#8f8a80")
    for kk in range(4):
        uc = u0 + (u1 - u0) * (kk + 0.5) / 4
        for y in range(int(v0 * n), int(v1 * n)):
            b = ((y + 0.5) / n - v0) / (v1 - v0)
            larg = 0.06 + 0.05 * math.sin(math.pi * min(1, max(0, (b - 0.15) / 0.7))) ** 0.7
            r(uc - larg * (u1 - u0) / 2, y / n, uc + larg * (u1 - u0) / 2, (y + 1) / n, COR_BRANCO)
    r(u0, v0, u1, v0 + (v1 - v0) * 0.14, COR_BRANCO)
    r(u0, v1 - (v1 - v0) * 0.16, u1, v1, COR_BRANCO)

    img = bpy.data.images.new("Tex_Esquadrias", n, n, alpha=False)
    img.pixels.foreach_set(px)
    img.pack()
    return img


def uv_reg(reg, a, b):
    """UV dentro de uma região do atlas (a, b de 0 a 1), com 1,5 px de margem"""
    u0, v0, u1, v1 = REGIOES[reg]
    mg = 1.5 / 256
    a, b = min(max(a, 0.0), 1.0), min(max(b, 0.0), 1.0)
    return (u0 + mg + (u1 - u0 - 2 * mg) * a, v0 + mg + (v1 - v0 - 2 * mg) * b)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["piso"] = mat("Mat_Chao_Piso", "#d9d1c1", 0.92)
    M["rua"] = mat("Mat_Chao_Rua", "#9e968a", 0.95)
    M["calcadao"] = mat("Mat_Chao_Calcadao", "#e7e2d6", 0.9)
    M["areia"] = mat("Mat_Chao_Areia", "#ead9ac", 0.95)
    M["molhada"] = mat("Mat_Chao_Areia_Molhada", "#cdb98c", 0.7)
    M["mar"] = mat("Mat_Chao_Mar", "#2d8a84", 0.22)
    M["raso"] = mat("Mat_Chao_Mar_Raso", "#5fb3a8", 0.22)
    M["grama"] = mat("Mat_Chao_Grama", "#76a44c", 0.95)
    M["grama_canteiro"] = mat("Mat_Grama_Canteiro", "#6f9d45", 0.95)
    M["espuma"] = mat("Mat_Espuma", "#f6f8f6", 0.6)
    M["meiofio"] = mat("Mat_Meio_Fio", "#e2ded5", 0.85)
    M["parede"] = mat("Mat_Reboco_Branco", COR_PAREDE, 0.85)
    M["branco"] = mat("Mat_Frisos_Brancos", COR_BRANCO, 0.7)
    M["soco"] = mat("Mat_Soco", "#cfc8b9", 0.85)
    M["laje"] = mat("Mat_Piso_Terraco", "#c9a58c", 0.8)
    M["cobertura"] = mat("Mat_Cobertura_Laje", "#bdb7ab", 0.9)
    M["arbusto"] = mat("Mat_Arbusto", "#4a7a36", 0.9)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.5, 0.0, atlas)
    M["telha"] = mat("Mat_Telha_Marselha", "#b65a35", 0.75, 0.0, atlas)
    M["madeira"] = mat("Mat_Madeira_Beiral", "#7a5236", 0.75)
    M["escuro"] = mat("Mat_Vao_Escuro", "#3a3632", 0.9)
    M["ferro"] = mat("Mat_Ferro_Escuro", "#2e3236", 0.5, 0.3)
    M["poste"] = mat("Mat_Metal_Poste", "#4a5056", 0.45, 0.4)
    M["globo"] = mat("Mat_Luminaria", "#fbfaf4", 0.3)
    M["banco"] = mat("Mat_Concreto_Banco", "#c8c3b8", 0.8)
    return M


# ———————————————————————————————————————————————— peças de fachada

NORMAIS = {"-y": (0.0, -1.0), "+y": (0.0, 1.0), "-x": (-1.0, 0.0), "+x": (1.0, 0.0)}


def vao(P, M, cx, cy, face, larg, z0, z1, reg, saliente=0.03, peitoril=False):
    """Esquadria do atlas num plano de parede: centro (cx, cy) na face; `face` = lado para onde a parede olha"""
    nx, ny = NORMAIS[face]
    rx, ry = -ny, nx                     # direita de quem olha a parede de frente
    ox, oy = cx + nx * saliente, cy + ny * saliente
    a = (ox - rx * larg / 2, oy - ry * larg / 2)
    b = (ox + rx * larg / 2, oy + ry * larg / 2)
    P.quad_uv([(a[0], a[1], Z0 + z0), (b[0], b[1], Z0 + z0), (b[0], b[1], Z0 + z1), (a[0], a[1], Z0 + z1)], M["esquadrias"], reg)
    if peitoril:
        sx, sy = (larg + 0.3, 0.22) if ny else (0.22, larg + 0.3)
        P.juntar(bm_caixa(sx, sy, 0.1), M["branco"], T(cx + nx * 0.08, cy + ny * 0.08, Z0 + z0 - 0.1))


def fileira(P, M, p0, p1, face, n, larg, z0, z1, reg, peitoril=False):
    """`n` vãos iguais ao longo de uma parede reta de p0 a p1"""
    for k in range(n):
        t = (k + 0.5) / n
        vao(P, M, p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, face, larg, z0, z1, reg, peitoril=peitoril)


def pilastra(P, M, x, y, face, larg, z0, z1, prof=0.14, mm=None):
    nx, ny = NORMAIS[face]
    sx, sy = (larg, prof) if ny else (prof, larg)
    P.juntar(bm_caixa(sx, sy, z1 - z0), mm or M["branco"], T(x + nx * prof / 2, y + ny * prof / 2, Z0 + z0))


def cinta(P, mm, x0, y0, x1, y1, z0, z1, proj, topo=None):
    """Friso/cornija em volta de um volume retangular: prisma um pouco maior que a planta"""
    P.juntar(bm_prisma(ret(x0 - proj, y0 - proj, x1 + proj, y1 + proj), Z0 + z0, Z0 + z1, 0.0, mat_lados=1), [topo or mm, mm])


def cunhais(P, M, x0, y0, x1, y1, z0, z1, larg=0.45):
    """Cunhais brancos (pilastras de quina) nas quatro quinas de um volume retangular"""
    for (x, y, sx, sy) in ((x0, y0, -1, -1), (x1, y0, 1, -1), (x1, y1, 1, 1), (x0, y1, -1, 1)):
        P.juntar(bm_caixa(larg, larg, z1 - z0), M["branco"], T(x - sx * (larg / 2 - 0.08), y - sy * (larg / 2 - 0.08), Z0 + z0))


def balaustrada(P, M, p0, p1, z0, alt=0.9, esp=0.14, passo=1.2, pilares=True):
    """Balaustrada de p0 a p1: placa com os balaústres do atlas (nas duas faces), base, corrimão e pilaretes brancos"""
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
    if L < 0.3:
        return
    t = (b - a).normalized()
    nrm = Vector((t.y, -t.x, 0))
    n = max(1, round(L / passo))
    zb, zt = Z0 + z0 + 0.12, Z0 + z0 + alt - 0.1
    for lado in (1, -1):
        off = nrm * (esp / 2) * lado
        for k in range(n):
            s0, s1 = L * k / n, L * (k + 1) / n
            q0, q1 = a + t * s0 + off, a + t * s1 + off
            pts = [(q0.x, q0.y, zb), (q1.x, q1.y, zb), (q1.x, q1.y, zt), (q0.x, q0.y, zt)]
            if lado < 0:
                pts = [pts[1], pts[0], pts[3], pts[2]]
            P.quad_uv(pts, M["esquadrias"], "balaus")
    ang = math.degrees(math.atan2(t.y, t.x))
    c = (a + b) / 2
    P.juntar(bm_caixa(L, esp + 0.06, 0.12), M["branco"], T(c.x, c.y, Z0 + z0, ang))
    P.juntar(bm_caixa(L + 0.06, esp + 0.14, 0.1), M["branco"], T(c.x, c.y, zt, ang))
    if pilares:
        npil = max(1, round(L / 3.0))
        for k in range(npil + 1):
            p = a + t * (L * k / npil)
            P.juntar(bm_caixa(0.3, 0.3, alt + 0.08), M["branco"], T(p.x, p.y, Z0 + z0, ang))


def arco_extrudado(cx, y, z0, raio, alt, prof, n=12):
    """Meia-lua no plano y, de largura 2·raio e flecha `alt`, extrudada em +y por `prof`"""
    pts = [(cx - raio * math.cos(math.pi * k / n), y, z0 + alt * math.sin(math.pi * k / n)) for k in range(n + 1)]
    return bm_poli_extrudado(pts, (0, prof, 0))


def arcada(P, M, p0, p1, n, z0, z_nasc, z_topo, esp=0.4, pilar=0.42, mm=None):
    """
    Arcada reta de p0 a p1 com `n` arcos plenos: pilares quadrados, tímpanos (placa com o recorte do arco) e viga; a face
    de fora é a da direita de quem anda de p0 a p1. z_nasc = nascença dos arcos; z_topo = topo da viga.
    """
    mm = mm or M["parede"]
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
    t = (b - a).normalized()
    nrm = Vector((t.y, -t.x, 0))
    ang = math.degrees(math.atan2(t.y, t.x))
    vao_ = (L - pilar * (n + 1)) / n
    rr = vao_ / 2
    for k in range(n + 1):
        s = pilar / 2 + k * (vao_ + pilar)
        p = a + t * s - nrm * (esp / 2)
        P.juntar(bm_caixa(pilar, esp, z_nasc - z0), mm, T(p.x, p.y, Z0 + z0, ang))
        P.juntar(bm_caixa(pilar + 0.12, esp + 0.12, 0.14), M["branco"], T(p.x, p.y, Z0 + z_nasc - 0.14, ang))
        P.juntar(bm_caixa(pilar + 0.1, esp + 0.1, 0.35), M["soco"], T(p.x, p.y, Z0 + z0, ang))
    # tímpanos: polígono (pilar a pilar) com o arco embaixo, extrudado na espessura
    for k in range(n):
        s0 = pilar + k * (vao_ + pilar)
        loc = []
        for j in range(13):
            ang_ = math.pi - math.pi * j / 12
            loc.append((s0 + rr + rr * math.cos(ang_), z_nasc + rr * math.sin(ang_)))
        loc += [(s0 + vao_, z_topo), (s0, z_topo)]
        pts = []
        for s, z in loc:
            q = a + t * s
            pts.append((q.x, q.y, Z0 + z))
        bm = bm_poli_extrudado(pts, tuple(-nrm * esp))
        P.juntar(bm, mm)
        # arquivolta branca: faixa fina em volta do arco, saliente na face de fora
        anel = []
        for j in range(13):
            ang_ = math.pi - math.pi * j / 12
            q = a + t * (s0 + rr + (rr + 0.14) * math.cos(ang_))
            anel.append((q.x, q.y, Z0 + z_nasc + (rr + 0.14) * math.sin(ang_)))
        for j in range(12, -1, -1):
            ang_ = math.pi - math.pi * j / 12
            q = a + t * (s0 + rr + rr * math.cos(ang_))
            anel.append((q.x, q.y, Z0 + z_nasc + rr * math.sin(ang_)))
        anel = [(x + nrm.x * 0.05, y + nrm.y * 0.05, z) for x, y, z in anel]
        P.juntar(bm_poli_extrudado(anel, tuple(-nrm * 0.07)), M["branco"])
    return ang


def telhado(P, M, x0, y0, x1, y1, z, incl=INCL, beiral=0.6, cachorros=True, ponteira=False):
    """
    Telhado de quatro águas (piramidal se a planta for quase quadrada) em telha marselha, com beiral largo, testeira
    branca, forro e cachorros de madeira por baixo (a linguagem neocolonial). Cada água é cortada numa grade de 1,6 m
    para a telha do atlas manter o tamanho em qualquer água. Devolve a altura da cumeeira.
    """
    b = beiral
    X0, Y0, X1, Y1 = x0 - b, y0 - b, x1 + b, y1 + b
    w, d = X1 - X0, Y1 - Y0
    zc = z + 0.14
    if abs(w - d) < 0.05:
        t0 = t1 = ((X0 + X1) / 2, (Y0 + Y1) / 2)
    elif w > d:
        t0, t1 = (X0 + d / 2, (Y0 + Y1) / 2), (X1 - d / 2, (Y0 + Y1) / 2)
    else:
        t0, t1 = ((X0 + X1) / 2, Y0 + w / 2), ((X0 + X1) / 2, Y1 - w / 2)
    h = min(w, d) / 2 * incl
    zt = zc + h
    c0, c1, c2, c3 = (X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)
    # testeira (borda do beiral) e forro
    P.juntar(bm_prisma([c0, c1, c2, c3], z, zc, 0.0, mat_lados=1), [M["branco"], M["branco"]])
    if w >= d:
        aguas = [([c0, c1], [t1, t0]), ([c1, c2], [t1]), ([c2, c3], [t0, t1]), ([c3, c0], [t0])]
    else:
        aguas = [([c0, c1], [t0]), ([c1, c2], [t1, t0]), ([c2, c3], [t1]), ([c3, c0], [t0, t1])]
    for base, cume in aguas:
        if len(cume) == 2 and cume[0] == cume[1]:
            cume = cume[:1]
        a, bb = Vector((*base[0], zc)), Vector((*base[1], zc))
        pts3 = [a, bb] + [Vector((c[0], c[1], zt)) for c in cume]
        sdir = (bb - a).normalized()
        nn = (bb - a).cross(pts3[2] - a).normalized()
        tdir = nn.cross(sdir)
        p2 = [((p - a).dot(sdir), (p - a).dot(tdir)) for p in pts3]
        cel = 1.6
        smin, smax = min(p[0] for p in p2), max(p[0] for p in p2)
        tmax = max(p[1] for p in p2)
        for i in range(math.floor(smin / cel), math.ceil(smax / cel)):
            for j in range(0, math.ceil(tmax / cel) + 1):
                peca = celula(p2, i * cel, (i + 1) * cel, j * cel, (j + 1) * cel)
                if not peca:
                    continue
                pts = [tuple(a + sdir * s + tdir * tt) for s, tt in peca]
                uvs = [uv_reg("telha", (s - i * cel) / cel, (tt - j * cel) / cel) for s, tt in peca]
                try:
                    P.poli(pts, M["telha"], uvs)
                except ValueError:
                    pass
    # espigões e cumeeira (capa de telha)
    for c, t_ in ((c0, t0), (c1, t1), (c2, t1), (c3, t0)):
        barra(P, (c[0], c[1], zc + 0.06), (t_[0], t_[1], zt + 0.06), 0.16, M["telha"])
    if math.hypot(t1[0] - t0[0], t1[1] - t0[1]) > 0.1:
        barra(P, (t0[0], t0[1], zt + 0.07), (t1[0], t1[1], zt + 0.07), 0.2, M["telha"])
    if cachorros:
        for (pa, pb, nx, ny) in (((x0, y0), (x1, y0), 0, -1), ((x1, y0), (x1, y1), 1, 0), ((x1, y1), (x0, y1), 0, 1), ((x0, y1), (x0, y0), -1, 0)):
            L = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
            nk = max(2, int(L / 0.7))
            for k in range(nk + 1):
                s = k / nk
                x = pa[0] + (pb[0] - pa[0]) * s + nx * (b / 2 - 0.02)
                y = pa[1] + (pb[1] - pa[1]) * s + ny * (b / 2 - 0.02)
                sx, sy = (0.11, b) if ny else (b, 0.11)
                P.juntar(bm_caixa(sx, sy, 0.13), M["madeira"], T(x, y, z - 0.13))
    if ponteira:
        P.juntar(bm_torno([(0.16, 0), (0.16, 0.08), (0.06, 0.16), (0.1, 0.36), (0.04, 0.6), (0.015, 0.95), (0, 1.0)], 8), M["branco"], T(t0[0], t0[1], zt - 0.04), liso=True)
    return zt


# ———————————————————————————————————————————————— o palacete

def sobrado(M):
    """
    Corpo de dois pavimentos (OSM h 8,3 m): o bloco da frente para a Rua dos Tabajaras e a ala que segue para o mar (em L),
    mais o bloco oeste de dois pavimentos recuado. Paredes de reboco branco-gelo, soco, cunhais e frisos brancos, cornija
    sob o beiral, janelas de venezianas, porta-janelas no pavimento superior, a porta principal com escadinha e uma sacada
    de balaústres no eixo. Telhados de quatro águas em telha marselha com beiral e cachorros (forma: interpretação).
    """
    P = Peca("Sobrado_Estoril")
    W, B = M["parede"], M["branco"]
    corpos = [(X_C0, Y_FRENTE, X_C1, Y_C1, 0.0), (X_ALA0, Y_C1, X_C1, Y_ALA1, 0.0), (X_B0, Y_B0, X_B1, Y_B1, H_T)]
    for x0, y0, x1, y1, zb in corpos:
        P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0 + zb, Z0 + H_E, 0.03), [M["laje"], W])
        if zb == 0.0:
            cinta(P, M["soco"], x0, y0, x1, y1, 0.0, 0.55, 0.05)
        cinta(P, B, x0, y0, x1, y1, H_T - 0.05, H_T + 0.22, 0.09)            # friso entre os pavimentos
        cinta(P, B, x0, y0, x1, y1, H_E - 0.55, H_E - 0.38, 0.06)            # friso da cornija
        cinta(P, B, x0, y0, x1, y1, H_E - 0.38, H_E, 0.16)                   # cornija
        cunhais(P, M, x0, y0, x1, y1, zb + (0.55 if zb == 0 else 0.22), H_E - 0.55)
    # ——— fachada sul do corpo (Tabajaras): térreo janela–porta–janela, superior 3 porta-janelas e sacada no eixo
    xs = [X_C0 + (X_C1 - X_C0) * f for f in (0.2, 0.5, 0.8)]
    xm = xs[1]
    for x in (xs[0], xs[2]):
        vao(P, M, x, Y_FRENTE, "-y", 1.35, 0.95, 3.3, "janela", peitoril=True)
    vao(P, M, xm, Y_FRENTE, "-y", 1.75, 0.55, 3.95, "porta")
    # escadinha da entrada (3 degraus) e moldura saliente da porta
    for k in range(3):
        caixa(P, M["soco"], xm - 1.6 + k * 0.15, Y_FRENTE - 1.35 + k * 0.38, Z0, xm + 1.6 - k * 0.15, Y_FRENTE, Z0 + 0.19 * (k + 1))
    for s in (-1, 1):
        P.juntar(bm_caixa(0.28, 0.2, 3.6), B, T(xm + s * 1.06, Y_FRENTE - 0.1, Z0 + 0.55))
    P.juntar(bm_caixa(2.6, 0.3, 0.22), B, T(xm, Y_FRENTE - 0.15, Z0 + 4.05))
    for x in xs:
        vao(P, M, x, Y_FRENTE, "-y", 1.2, H_T + 0.45, H_T + 3.35, "porta_janela")
        P.juntar(bm_caixa(1.7, 0.2, 0.16), B, T(x, Y_FRENTE - 0.1, Z0 + H_T + 3.45))   # cimalha sobre o vão
    for x in (xs[0], xs[2]):
        # balcãozinho de ferro das janelas laterais (peitoril com grade baixa)
        caixa(P, B, x - 0.8, Y_FRENTE - 0.35, Z0 + H_T + 0.3, x + 0.8, Y_FRENTE, Z0 + H_T + 0.45)
        for k in range(7):
            barra(P, (x - 0.72 + k * 0.24, Y_FRENTE - 0.3, Z0 + H_T + 0.45), (x - 0.72 + k * 0.24, Y_FRENTE - 0.3, Z0 + H_T + 1.25), 0.04, M["ferro"])
        barra(P, (x - 0.76, Y_FRENTE - 0.3, Z0 + H_T + 1.27), (x + 0.76, Y_FRENTE - 0.3, Z0 + H_T + 1.27), 0.06, M["ferro"])
    # sacada do eixo: laje sobre mãos-francesas e balaustrada
    caixa(P, B, xm - 1.35, Y_FRENTE - 1.0, Z0 + H_T + 0.22, xm + 1.35, Y_FRENTE, Z0 + H_T + 0.42)
    for s in (-1, 1):
        barra(P, (xm + s * 1.0, Y_FRENTE - 0.05, Z0 + H_T - 0.55), (xm + s * 1.0, Y_FRENTE - 0.85, Z0 + H_T + 0.22), 0.14, B)
    balaustrada(P, M, (xm - 1.28, Y_FRENTE - 0.93), (xm + 1.28, Y_FRENTE - 0.93), H_T + 0.42, 0.85, 0.12, pilares=False)
    for s in (-1, 1):
        balaustrada(P, M, (xm + s * 1.28, Y_FRENTE - 0.93), (xm + s * 1.28, Y_FRENTE - 0.05), H_T + 0.42, 0.85, 0.12, pilares=False)
    # pilastras entre os vãos (os dois pavimentos)
    for f in (0.35, 0.65):
        pilastra(P, M, X_C0 + (X_C1 - X_C0) * f, Y_FRENTE, "-y", 0.32, 0.55, H_E - 0.55, 0.1)
    # ——— lado oeste do corpo (acima do terraço) e fundos
    fileira(P, M, (X_C0, Y_FRENTE + 0.8), (X_C0, Y_C1 - 0.6), "-x", 2, 1.1, H_T + 0.45, H_T + 3.3, "porta_janela")
    vao(P, M, (X_C0 + X_ALA0) / 2, Y_C1, "+y", 1.2, H_T + 0.9, H_T + 3.2, "janela", peitoril=True)
    # ——— ala norte (para o mar): leste sobre a varanda, oeste e a empena norte
    fileira(P, M, (X_C1, Y_C1 + 0.4), (X_C1, Y_ALA1 - 0.4), "+x", 3, 1.2, H_T + 0.45, H_T + 3.35, "porta_janela")
    fileira(P, M, (X_C1, Y_C1 + 0.4), (X_C1, Y_ALA1 - 0.4), "+x", 3, 1.4, 0.35, 3.75, "porta_vidro")
    fileira(P, M, (X_ALA0, Y_ALA1 - 0.4), (X_ALA0, Y_C1 + 0.4), "-x", 3, 1.2, H_T + 0.9, H_T + 3.2, "janela", peitoril=True)
    fileira(P, M, (X_C1 - 0.4, Y_ALA1), (X_ALA0 + 0.4, Y_ALA1), "+y", 2, 1.2, H_T + 0.45, H_T + 3.35, "porta_janela")
    fileira(P, M, (X_C1 - 0.4, Y_ALA1), (X_ALA0 + 0.4, Y_ALA1), "+y", 2, 1.4, 0.35, 3.75, "porta_vidro")
    # sacada para o mar
    xn = (X_ALA0 + X_C1) / 2
    caixa(P, B, X_ALA0 + 0.5, Y_ALA1, Z0 + H_T + 0.22, X_C1 - 0.5, Y_ALA1 + 1.0, Z0 + H_T + 0.42)
    balaustrada(P, M, (X_C1 - 0.55, Y_ALA1 + 0.93), (X_ALA0 + 0.55, Y_ALA1 + 0.93), H_T + 0.42, 0.85, 0.12, pilares=False)
    for xx in (X_ALA0 + 0.55, X_C1 - 0.55):
        balaustrada(P, M, (xx, Y_ALA1 + 0.05), (xx, Y_ALA1 + 0.93), H_T + 0.42, 0.85, 0.12, pilares=False)
        barra(P, (xx, Y_ALA1 + 0.05, Z0 + H_T - 0.55), (xx, Y_ALA1 + 0.85, Z0 + H_T + 0.22), 0.14, B)
    # ——— bloco oeste (pavimento superior sobre a varanda): porta-janela para o terraço da frente e janelas
    vao(P, M, (X_B0 + X_B1) / 2, Y_B0, "-y", 1.2, H_T + 0.45, H_T + 3.35, "porta_janela")
    fileira(P, M, (X_B0, Y_B0 + 0.5), (X_B0, Y_B1 - 0.5), "-x", 2, 1.1, H_T + 0.9, H_T + 3.2, "janela", peitoril=True)
    fileira(P, M, (X_B1, Y_B1 - 0.5), (X_B1, Y_B0 + 0.5), "+x", 2, 1.1, H_T + 0.9, H_T + 3.2, "janela", peitoril=True)
    vao(P, M, (X_B0 + X_B1) / 2, Y_B1, "+y", 1.1, H_T + 0.9, H_T + 3.2, "janela", peitoril=True)
    # ——— telhados
    zt = telhado(P, M, X_C0, Y_FRENTE, X_C1, Y_C1, Z0 + H_E)
    telhado(P, M, X_ALA0, Y_C1 + 0.01, X_C1, Y_ALA1, Z0 + H_E)
    telhado(P, M, X_B0, Y_B0, X_B1, Y_B1, Z0 + H_E)
    # canteiros de grama com arbustos baixos dos dois lados da escadinha e bancos no pátio (interpretação: ficha)
    for xa_, xb_ in ((X_C0 + 0.2, xm - 1.95), (xm + 1.95, X_C1 - 0.1)):
        caixa(P, M["meiofio"], xa_, Y_FRENTE - 2.3, Z0, xb_, Y_FRENTE - 0.25, Z0 + 0.22)
        caixa(P, M["grama_canteiro"], xa_ + 0.15, Y_FRENTE - 2.15, Z0 + 0.22, xb_ - 0.15, Y_FRENTE - 0.25, Z0 + 0.24)
        nk = max(2, int((xb_ - xa_) / 1.1))
        for k in range(nk):
            x = xa_ + 0.6 + (xb_ - xa_ - 1.2) * k / (nk - 1)
            bm = bm_esfera(1.0, 1)
            r = 0.42 + 0.12 * ((k * 7) % 3) / 2
            bm.transform(Matrix.Diagonal((r, r * 0.9, r * 0.8, 1)))
            P.juntar(bm, M["arbusto"], T(x, Y_FRENTE - 0.95, Z0 + 0.22 + r * 0.5))
    for x in (X_C0 - 1.5, X_C1 + 4.5, X_C1 + 10.5):
        P.juntar(bm_caixa(2.0, 0.55, 0.45, 0.04), M["banco"], T(x, Y_FRENTE - 5.0, Z0))
        reservar(ret(x - 1.1, Y_FRENTE - 5.4, x + 1.1, Y_FRENTE - 4.6), 0.3)
    reservar(ret(X_C0, Y_FRENTE - 2.4, X_C1, Y_C1), 0.5)
    reservar(ret(X_ALA0, Y_C1, X_C1, Y_ALA1 + 1.1), 0.5)
    return P.criar(), zt


def torre(M):
    """
    Torre (OSM h 11,1 m, 4 níveis) na quina sudeste do corpo, alinhada com a fachada da Tabajaras: fuste com cunhais e
    frisos dos pavimentos, janelas pequenas, e no alto o mirante aberto em arcos nos quatro lados, com balaústres entre
    os pilares, cornija e telhado piramidal de telha marselha com pináculo. Ela desabou em 1994 e foi refeita na réplica;
    a forma do mirante é interpretação neocolonial (dúvida na ficha).
    """
    P = Peca("Torre_Mirante")
    W, B = M["parede"], M["branco"]
    x0, y0, x1, y1 = X_C1, Y_FRENTE, X_T1, Y_T1
    Z_M0, Z_M1 = H_E + 1.5, 13.9       # mirante: piso (o fuste passa 1,5 m do beiral) e topo da cornija
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0, Z0 + Z_M0, 0.03), [M["laje"], W])
    cinta(P, M["soco"], x0, y0, x1, y1, 0.0, 0.55, 0.06)
    cinta(P, B, x0, y0, x1, y1, H_T - 0.05, H_T + 0.22, 0.1)
    cinta(P, B, x0, y0, x1, y1, H_E - 0.55, H_E - 0.38, 0.07)
    cinta(P, B, x0, y0, x1, y1, Z_M0 - 0.4, Z_M0, 0.2)                 # base do mirante (pouco acima do beiral)
    cunhais(P, M, x0, y0, x1, y1, 0.55, Z_M0 - 0.4, 0.5)
    xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
    # vãos do fuste: porta em arco no térreo, janela de venezianas no 2º pavimento, óculo pequeno no 3º
    vao(P, M, xc, y0, "-y", 1.35, 0.95, 3.6, "venez_arco", peitoril=True)
    vao(P, M, xc, y0, "-y", 1.1, H_T + 0.6, H_T + 2.9, "janela", peitoril=True)
    vao(P, M, x1, yc, "+x", 1.35, 0.95, 3.6, "venez_arco", peitoril=True)
    vao(P, M, x1, yc, "+x", 1.1, H_T + 0.6, H_T + 2.9, "janela", peitoril=True)
    # 3º nível do fuste, acima do telhado: friso e janelinha em cada face livre
    cinta(P, B, x0, y0, x1, y1, H_E - 0.05, H_E + 0.15, 0.08)
    vao(P, M, xc, y0, "-y", 0.75, H_E + 0.35, Z_M0 - 0.5, "janela_peq")
    vao(P, M, x1, yc, "+x", 0.75, H_E + 0.35, Z_M0 - 0.5, "janela_peq")
    vao(P, M, xc, y1, "+y", 0.75, H_E + 0.35, Z_M0 - 0.5, "janela_peq")
    vao(P, M, x0, yc, "-x", 0.75, H_E + 0.35, Z_M0 - 0.5, "janela_peq")
    # mirante: núcleo escuro recuado, quatro faces em arcada (2 arcos na frente e no fundo, 2 nas laterais)
    zb = Z_M0
    caixa(P, M["escuro"], x0 + 0.55, y0 + 0.55, Z0 + zb, x1 - 0.55, y1 - 0.55, Z0 + Z_M1 - 0.55)
    zn, ztopo = zb + 2.0, Z_M1 - 0.55
    e = 0.3
    arcada(P, M, (x0, y0 + e), (x1, y0 + e), 2, zb, zn, ztopo, esp=e, pilar=0.42)
    arcada(P, M, (x1 - e, y0), (x1 - e, y1), 2, zb, zn, ztopo, esp=e, pilar=0.42)
    arcada(P, M, (x1, y1 - e), (x0, y1 - e), 2, zb, zn, ztopo, esp=e, pilar=0.42)
    arcada(P, M, (x0 + e, y1), (x0 + e, y0), 2, zb, zn, ztopo, esp=e, pilar=0.42)
    # parapeito de balaústres em cada vão do mirante
    for (pa, pb) in (((x0 + 0.42, y0 + 0.15), (x1 - 0.42, y0 + 0.15)), ((x1 - 0.15, y0 + 0.42), (x1 - 0.15, y1 - 0.42)),
                     ((x1 - 0.42, y1 - 0.15), (x0 + 0.42, y1 - 0.15)), ((x0 + 0.15, y1 - 0.42), (x0 + 0.15, y0 + 0.42))):
        balaustrada(P, M, pa, pb, zb, 0.85, 0.1, 0.9, pilares=False)
    cinta(P, B, x0, y0, x1, y1, Z_M1 - 0.55, Z_M1 - 0.3, 0.06)
    cinta(P, B, x0, y0, x1, y1, Z_M1 - 0.3, Z_M1, 0.2)
    zt = telhado(P, M, x0, y0, x1, y1, Z0 + Z_M1, incl=0.95, beiral=0.55, ponteira=True)
    reservar(ret(x0, y0, x1, y1), 0.5)
    return P.criar(), zt + 1.0


def varandas(M):
    """
    Partes térreas do OSM (h 3,7 m) lidas como varandas com terraço por cima: na frente, a varanda em arcada sob o bloco
    oeste (4 arcos na Tabajaras, 1 na lateral); a leste da ala, a varanda em arcada voltada para o mar; os outros trechos
    térreos fechados com janelas. Terraços de piso cerâmico com balaustrada (a reforma cita a impermeabilização das
    varandas). A forma dos arcos e da balaustrada é interpretação (dúvida na ficha).
    """
    P = Peca("Varandas_Terraco")
    W, B = M["parede"], M["branco"]
    zl = H_T + 0.15
    # volume térreo fechado (planta do OSM com o fundo da varanda da frente recuado)
    poli_uv = [(2.7, 1.4), (-1.2, 1.3), (-1.2, -2.1), (-8.7, -2.1), (-8.7, -1.5), (-11.7, -1.5), (-11.8, 2.3), (-8.5, 2.3),
               (-8.4, 4.1), (-2.7, 4.2), (-2.8, 2.8), (1.5, 2.9), (1.4, 9.9), (2.5, 9.9), (2.5, 1.4)]
    poli = [m(u, v) for u, v in poli_uv]
    P.juntar(bm_prisma(poli, Z0, Z0 + H_T, 0.0), [M["laje"], W])
    P.juntar(bm_prisma(poli, Z0 + H_T, Z0 + zl, 0.0, mat_lados=1), [M["laje"], B])
    P.juntar(bm_prisma(poli, Z0, Z0 + 0.5, 0.0, mat_lados=1), [M["soco"], M["soco"]])
    # janelas do volume térreo nas faces de fora (lado oeste, norte e a faixa junto da ala)
    fileira(P, M, (m(-11.8, 2.3)[0], m(0, 2.3)[1]), (m(-11.7, -1.5)[0], m(0, -1.5)[1]), "-x", 1, 1.3, 0.9, 3.4, "venez_arco")
    fileira(P, M, (m(-2.7, 0)[0], m(0, 4.2)[1]), (m(-8.4, 0)[0], m(0, 4.1)[1]), "+y", 3, 1.3, 0.9, 3.4, "venez_arco", peitoril=True)
    fileira(P, M, (m(1.4, 0)[0], m(0, 9.4)[1]), (m(1.4, 0)[0], m(0, 3.4)[1]), "-x", 3, 1.0, 1.0, 3.0, "janela_peq")
    vao(P, M, m(-0.2, 0)[0], m(0, 2.9)[1], "+y", 1.4, 0.35, 3.75, "porta_vidro")
    # varanda da frente: arcada de 4 arcos na Tabajaras e 1 na lateral oeste, laje do terraço por cima
    xa, xb = X_L0, X_C0
    arcada(P, M, (xa, Y_FRENTE), (xb, Y_FRENTE), 4, 0.0, 2.55, H_T, esp=0.38, pilar=0.5)
    arcada(P, M, (xa, Y_LF), (xa, Y_FRENTE), 1, 0.0, 2.55, H_T, esp=0.38, pilar=0.5)
    caixa(P, M["laje"], xa - 0.12, Y_FRENTE - 0.12, Z0 + H_T, xb, Y_LF, Z0 + zl)
    caixa(P, B, xa - 0.18, Y_FRENTE - 0.18, Z0 + H_T - 0.02, xb, Y_FRENTE + 0.2, Z0 + zl)
    caixa(P, M["laje"], xa + 0.3, Y_FRENTE + 0.3, Z0, xb, Y_LF, Z0 + 0.06)
    fileira(P, M, (xa + 0.3, Y_LF), (xb, Y_LF), "-y", 3, 1.4, 0.06, 3.5, "porta_vidro")
    # varanda leste da ala (para o mar): arcada de 4 arcos na face leste e 1 na ponta norte
    xv0, xv1, yv0, yv1 = X_C1, X_VL1, Y_T1, Y_VL1
    arcada(P, M, (xv1, yv0), (xv1, yv1), 4, 0.0, 2.55, H_T, esp=0.36, pilar=0.46)
    arcada(P, M, (xv1, yv1), (xv0, yv1), 1, 0.0, 2.55, H_T, esp=0.36, pilar=0.46)
    caixa(P, M["laje"], xv0, yv0, Z0 + H_T, xv1 + 0.12, yv1 + 0.12, Z0 + zl)
    caixa(P, B, xv1 - 0.2, yv0, Z0 + H_T - 0.02, xv1 + 0.18, yv1 + 0.18, Z0 + zl)
    caixa(P, M["laje"], xv0, yv0, Z0, xv1 - 0.2, yv1 - 0.2, Z0 + 0.06)
    # balaustradas dos terraços: só nas bordas de fora (não encostam nos sobrados)
    balaustrada(P, M, (xa - 0.05, Y_FRENTE - 0.05), (xb - 0.05, Y_FRENTE - 0.05), zl)
    balaustrada(P, M, (xa - 0.05, Y_FRENTE - 0.05), (xa - 0.05, Y_LF), zl)
    # bordas do volume térreo que ficam de fora dos sobrados
    altos = [ret(X_C0, Y_FRENTE, X_C1, Y_C1), ret(X_ALA0, Y_C1, X_C1, Y_ALA1), ret(X_B0, Y_B0, X_B1, Y_B1), ret(xa, Y_FRENTE, xb, Y_LF)]
    pp = anti_horario(poli)
    for i in range(len(pp)):
        a, b = Vector((*pp[i], 0)), Vector((*pp[(i + 1) % len(pp)], 0))
        if (b - a).length < 0.6:
            continue
        t = (b - a).normalized()
        fora = Vector((t.y, -t.x, 0))
        meio = (a + b) / 2 + fora * 0.35
        if any(ponto_no_poligono((meio.x, meio.y), q) for q in altos):
            continue
        balaustrada(P, M, (a.x - fora.x * 0.1, a.y - fora.y * 0.1), (b.x - fora.x * 0.1, b.y - fora.y * 0.1), zl)
    balaustrada(P, M, (xv1, yv0 + 0.1), (xv1, yv1), zl)
    balaustrada(P, M, (xv1, yv1), (xv0 + 0.05, yv1), zl)
    reservar(poli, 0.5)
    reservar(ret(xa, Y_FRENTE, xb, Y_LF), 0.5)
    reservar(ret(xv0, yv0, xv1, yv1), 0.5)
    return P.criar()


def anexos(M):
    """
    Anexo leste (OSM h 4,0 m), pavilhão térreo alinhado com a fachada: portas de vidro em arco (a casa tinha portas com
    vidros franceses), cunhais, cornija e telhado baixo de quatro águas em telha marselha. Anexo oeste (OSM h 2,9 m, com a
    parede em diagonal): volume baixo de serviço com platibanda e janelas pequenas. Fachadas neutras (dúvida na ficha).
    """
    P = Peca("Anexos")
    W, B = M["parede"], M["branco"]
    x0, y0, x1, y1 = X_T1, Y_FRENTE, X_AN1, Y_AN1
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0, Z0 + H_ANEXO, 0.03), [M["laje"], W])
    cinta(P, M["soco"], x0, y0, x1, y1, 0.0, 0.5, 0.05)
    cinta(P, B, x0, y0, x1, y1, H_ANEXO - 0.45, H_ANEXO, 0.14)
    cunhais(P, M, x0, y0, x1, y1, 0.5, H_ANEXO - 0.45, 0.4)
    fileira(P, M, (x0 + 0.3, y0), (x1 - 0.3, y0), "-y", 4, 1.55, 0.5, 3.75, "porta_vidro")
    for k in range(1, 4):
        pilastra(P, M, x0 + 0.3 + (x1 - x0 - 0.6) * k / 4, y0, "-y", 0.3, 0.5, H_ANEXO - 0.45, 0.1)
    fileira(P, M, (x1, y0 + 0.4), (x1, y1 - 0.4), "+x", 3, 1.4, 0.5, 3.6, "porta_vidro")
    fileira(P, M, (x1 - 0.4, y1), (x0 + 2.4, y1), "+y", 3, 1.3, 0.9, 3.3, "venez_arco", peitoril=True)
    telhado(P, M, x0, y0, x1, y1, Z0 + H_ANEXO, incl=0.4, beiral=0.5)
    reservar(ret(x0, y0, x1, y1), 0.5)
    # anexo oeste
    poli = [m(u, v) for u, v in [(-11.7, -1.5), (-14.3, -1.6), (-14.4, 2.3), (-18.5, 2.3), (-18.7, -1.6), (-18.8, -6.6), (-17.1, -8.4), (-11.7, -2.8)]]
    P.juntar(bm_prisma(poli, Z0, Z0 + H_OESTE, 0.03), [M["cobertura"], W])
    P.juntar(bm_prisma(poli, Z0, Z0 + 0.45, 0.0, mat_lados=1), [M["soco"], M["soco"]])
    pp = anti_horario(poli)
    for i in range(len(pp)):
        a, b = Vector((*pp[i], 0)), Vector((*pp[(i + 1) % len(pp)], 0))
        L = (b - a).length
        if L < 0.6:
            continue
        t = (b - a).normalized()
        fora = Vector((t.y, -t.x, 0))
        # platibanda: mureta fina por cima da borda
        c = (a + b) / 2 - fora * 0.1
        P.juntar(bm_caixa(L + 0.2, 0.32, 0.55), B, T(c.x, c.y, Z0 + H_OESTE, math.degrees(math.atan2(t.y, t.x))))
        if L > 2.5:
            nn = max(1, int(L / 2.8))
            for k in range(nn):
                q = a + t * (L * (k + 0.5) / nn) + fora * 0.03
                h0, h1 = 1.0, 2.6
                pa, pb = q - t * 0.45, q + t * 0.45
                P.quad_uv([(pa.x, pa.y, Z0 + h0), (pb.x, pb.y, Z0 + h0), (pb.x, pb.y, Z0 + h1), (pa.x, pa.y, Z0 + h1)], M["esquadrias"], "janela_peq")
    reservar(poli, 0.5)
    return P.criar()


# ———————————————————————————————————————————————— chão: Tabajaras, pátio, calçadão, areia e mar

def faixa_rua(y_fn, meia, x0=-40, x1=40, n=20):
    pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        pts.append((x, y_fn(x) - meia))
    for i in range(n, -1, -1):
        x = x0 + (x1 - x0) * i / n
        pts.append((x, y_fn(x) + meia))
    return pts


def linha_mar(x):
    """Linha d'água levemente ondulada"""
    return Y_MAR + 0.7 * math.sin(x * 0.17 + 0.6) + 0.35 * math.sin(x * 0.43)


def chao(M):
    """Disco de piso, a Rua dos Tabajaras em bloquetes (rua compartilhada), gramado do Largo dos Tremembés, calçadão, areia e mar"""
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["piso"], M["meiofio"]])
    g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, mm, z=0.012):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.06)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=0), mm)
        return poli

    placa(faixa_rua(rua_y, RUA_MEIA), M["rua"], 0.006)
    # faixas de bloquete mais escuro que marcam o leito da rua compartilhada (sem meio-fio)
    for s in (-1, 1):
        placa(faixa_rua(lambda x: rua_y(x) + s * (RUA_MEIA + 0.2), 0.2), M["meiofio"], 0.009)
    # calçadão: do fundo do prédio até a areia, com a borda de concreto
    placa(ret(-40, Y_CALCADAO, 40, Y_AREIA), M["calcadao"], 0.02)
    meia = math.sqrt(max(0.0, (RAIO - 0.3) ** 2 - Y_AREIA ** 2))
    pisos.juntar(bm_caixa(2 * meia, 0.35, 0.25), M["meiofio"], T(0, Y_AREIA - 0.1, Z0 - 0.01))
    # areia (seca e molhada) e mar (raso e fundo) até a borda norte
    n = 40
    xs = [-36 + 72 * i / n for i in range(n + 1)]
    praia = [(x, Y_AREIA) for x in xs] + [(x, linha_mar(x)) for x in reversed(xs)]
    for poli_ in ([(x, Y_AREIA) for x in xs] + [(x, linha_mar(x) - 1.3) for x in reversed(xs)],):
        placa(poli_, M["areia"], 0.03)
    placa([(x, linha_mar(x) - 1.3) for x in xs] + [(x, linha_mar(x)) for x in reversed(xs)], M["molhada"], 0.026)
    placa([(x, linha_mar(x)) for x in xs] + [(x, linha_mar(x) + 3.0) for x in reversed(xs)], M["raso"], 0.018)
    placa([(x, linha_mar(x) + 3.0) for x in xs] + [(x, 40) for x in reversed(xs)], M["mar"], 0.016)
    # gramado do Largo dos Tremembés, a leste
    placa(ret(X_AN1 + 3.2, Y_FRENTE - 5.5, 40, Y_CALCADAO - 0.6), M["grama"], 0.03)
    reservar(faixa_rua(rua_y, RUA_MEIA + 0.6), 0.0)
    reservar(praia, 0.0)
    pisos.criar()


def orla(M):
    """
    Calçadão e mar: espuma da arrebentação (tiras onduladas), postes de luz e bancos do calçadão, postes da Tabajaras.
    """
    P = Peca("Orla_Calcadao")
    # espuma: tiras onduladas paralelas à linha d'água
    for k, (dy, larg) in enumerate(((0.05, 0.45), (2.2, 0.35), (4.6, 0.3))):
        pts_a, pts_b = [], []
        meia = 34
        for i in range(61):
            x = -meia + 2 * meia * i / 60
            y = linha_mar(x) + dy + 0.3 * math.sin(x * 0.5 + k * 2.1)
            w = larg * (0.55 + 0.45 * abs(math.sin(x * 0.23 + k)))
            if math.hypot(x, y + w) > RAIO - 0.4:
                continue
            pts_a.append((x, y, Z0 + 0.035))
            pts_b.append((x, y + w, Z0 + 0.035))
        for i in range(len(pts_a) - 1):
            if abs(pts_a[i + 1][0] - pts_a[i][0]) > 1.5 or math.sin(pts_a[i][0] * 0.37 + k * 1.3) < -0.55:
                continue
            P.poli([pts_a[i], pts_a[i + 1], pts_b[i + 1], pts_b[i]], M["espuma"])
    postes = []
    yp = Y_AREIA - 0.9
    for x in (-22.0, -11.0, 0.0, 11.0, 22.0):
        if math.hypot(x, yp) < RAIO - 1.0:
            postes.append((x, yp))
    for x in (-14.0, 2.0, 16.0):
        postes.append((x, rua_y(x) + RUA_MEIA + 1.1))
    for x, y in postes:
        P.juntar(bm_cilindro(0.16, 0.45, 8, r2=0.12), M["poste"], T(x, y, Z0))
        P.juntar(bm_cilindro(0.07, 4.4, 8, r2=0.05), M["poste"], T(x, y, Z0 + 0.45))
        P.juntar(bm_cilindro(0.2, 0.12, 8, r2=0.12), M["poste"], T(x, y, Z0 + 4.8))
        P.juntar(bm_torno([(0.0, 0.0), (0.18, 0.05), (0.26, 0.3), (0.2, 0.55), (0.0, 0.62)], 10), M["globo"], T(x, y, Z0 + 4.85), liso=True)
        reservar(ret(x - 0.3, y - 0.3, x + 0.3, y + 0.3), 0.3)
    # abrigo do ponto de táxi da Tabajaras (OSM amenity=taxi): pilares finos e cobertura de chapa
    xt = -11.2
    yt = rua_y(xt) - RUA_MEIA - 1.5
    for dx in (-1.3, 1.3):
        for dy in (-0.45, 0.45):
            P.juntar(bm_cilindro(0.06, 2.5, 6), M["poste"], T(xt + dx, yt + dy, Z0))
    caixa(P, M["cobertura"], xt - 1.6, yt - 0.75, Z0 + 2.5, xt + 1.6, yt + 0.75, Z0 + 2.65)
    P.juntar(bm_caixa(2.2, 0.45, 0.45, 0.04), M["banco"], T(xt, yt + 0.2, Z0))
    reservar(ret(xt - 1.7, yt - 0.8, xt + 1.7, yt + 0.8), 0.3)
    for x in (-16.5, -5.5, 5.5, 16.5):
        y = Y_AREIA - 1.0
        P.juntar(bm_caixa(2.0, 0.55, 0.45, 0.04), M["banco"], T(x, y, Z0))
        reservar(ret(x - 1.1, y - 0.4, x + 1.1, y + 0.4), 0.3)
    return P.criar()


# ———————————————————————————————————————————————— vegetação, gente e carros (layout para o .tsx)

def layout():
    """Posições determinísticas (referencial do prédio; viram coordenadas do three no fim)"""
    rnd = random.Random(1925)   # ano da Vila Morena

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.5 - r * 0.8:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    arvores = []   # (x, y, altura do tronco, raio da copa): castanholas/amendoeiras do gramado do Largo e do pátio oeste
    for x, y, r in ((29.0, -4.0, 2.1), (28.0, 4.0, 1.9), (-26.5, -2.0, 2.0), (-27.0, 7.0, 1.8), (-23.0, 9.0, 1.7)):
        if livre(x, y, r):
            arvores.append((x, y, rnd.uniform(1.6, 2.1), r))
    coqueiros = []   # (x, y, altura, giro, inclinação): calçadão e areia
    for x, y in ((-20.0, 13.5), (-8.5, 14.8), (14.5, 14.0), (24.0, 12.5), (-14.0, 22.0), (9.0, 23.0), (26.5, -11.0), (-18.5, -15.0)):
        if livre(x, y, 0.3):
            coqueiros.append((x, y, rnd.uniform(6.8, 8.6), rnd.uniform(0, 360), rnd.uniform(0.04, 0.16)))
    pessoas = []
    zonas_p = [((-2.0, -11.5), (12.0, 3.0), 8), ((0.0, rua_y(0)), (18.0, 2.4), 4), ((0.0, 15.0), (24.0, 3.0), 12),
               ((0.0, 22.0), (20.0, 2.5), 6), ((29.0, 0.0), (2.0, 5.0), 2),
               ((0.0, rua_y(0) - RUA_MEIA - 2.6), (16.0, 1.4), 6)]
    for (cx, cy), (ax, ay), n in zonas_p:
        k = tent = 0
        while k < n and tent < 600:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            na_rua = abs(y - rua_y(x)) < RUA_MEIA + 0.8
            na_praia = y > Y_AREIA
            if not (na_rua or na_praia) and any(dist_poligono((x, y), poli) < 0.25 for poli, _ in LIVRE_POLIS):
                continue
            if na_praia and y > linha_mar(x) - 0.3:
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.7 for p in pessoas):
                continue
            pessoas.append((x, y, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    sois = []   # guarda-sóis na areia (x, y, cor)
    for i, x in enumerate((-17.0, -11.5, -4.0, 3.5, 12.0, 18.5)):
        y = Y_AREIA + 2.4 + (i % 2) * 1.3
        if math.hypot(x, y) < RAIO - 2.0 and y < linha_mar(x) - 1.6:
            sois.append((x, y, i))
    pessoas = [p for p in pessoas if all(math.hypot(p[0] - x, p[1] - y) > 0.6 for x, y, _ in sois)]
    carros = []   # (x, y, giro, cor): ponto de táxi a oeste (OSM) e carros passando na rua compartilhada
    ang = math.degrees(math.atan(RUA_INC))
    for x, k in ((-19.5, 0), (-15.4, 0)):
        carros.append((x, rua_y(x) - RUA_MEIA + 1.15, ang, k))
    carros.append((9.5, rua_y(9.5) + 1.3, ang + 180, 4))
    carros.append((-8.0, rua_y(-8.0) - 1.3, ang, 2))
    return arvores, coqueiros, pessoas, carros, sois


def proxies(arvores, coqueiros, carros, sois):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    mm = mat("Mat_Proxy", "#808080")
    for x, y, h, r in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.8, 1)))
        P.juntar(bm, mm, T(x, y, Z0 + h + r * 0.8))
        P.juntar(bm_cilindro(0.2, h + 0.3, 6), mm, T(x, y, Z0))
    for x, y, h, g, inc in coqueiros:
        P.juntar(bm_cilindro(0.14, h, 6), mm, T(x, y, Z0))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((2.0, 2.0, 0.6, 1)))
        P.juntar(bm, mm, T(x, y, Z0 + h))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(3.6, 1.6, 1.3), mm, T(x, y, Z0, g))
    for x, y, k in sois:
        bm = bm_cilindro(1.3, 0.45, 8, r2=0.05)
        P.juntar(bm, mm, T(x, y, Z0 + 1.9))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada

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
            k = 0.58 + 0.42 * (a ** 0.85)
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
    mm = bpy.data.materials.new("Mat_Proxy_AO")
    if mm.node_tree is None:
        mm.use_nodes = True
    no = mm.node_tree.nodes.new("ShaderNodeTexImage")
    no.image = img
    mm.node_tree.nodes.active = no
    me.materials.append(mm)
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


# ———————————————————————————————————————————————— principal

def no_mundo(x, y):
    v = MUNDO @ Vector((x, y, 0))
    return v.x, v.y


def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    chao(M)
    sob, z_cumeeira = sobrado(M)
    tor, z_topo = torre(M)
    obs = [sob, tor, varandas(M), anexos(M), orla(M)]
    arvores, coqueiros, pessoas, carros, sois = layout()
    print(f"árvores {len(arvores)}, coqueiros {len(coqueiros)}, pessoas {len(pessoas)}, carros {len(carros)}")
    print(f"cumeeira do sobrado {z_cumeeira:.2f} m, topo da torre {z_topo:.2f} m")
    prox = proxies(arvores, coqueiros, carros, sois)
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
        for ob in obs:
            at = ob.data.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
            for d in at.data:
                d.color = (1.0, 1.0, 1.0, 1.0)
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
    for ob in obs:
        ob.data.color_attributes.active_color = ob.data.color_attributes["AO"]
    arq = os.path.join(SAIDA, f"{PREFIXO}-pecas.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    tres = lambda x, y: (round(no_mundo(x, y)[0], 3), round(-no_mundo(x, y)[1], 3))
    zl = H_T + 0.15
    terraco = lambda x, y: Z0 + zl if (X_L0 <= x <= X_C0 and Y_FRENTE <= y <= Y_LF) else 0.0
    dados = {
        "arvores": [[tres(x, y)[0], round(Z0 + h, 3), tres(x, y)[1], round(r, 3)] for x, y, h, r in arvores],
        # coqueiro: x, z, altura, giro da coroa, inclinação (rad) e rumo da inclinação (rad, no three)
        "palmeiras": [[*tres(x, y), round(h, 3), round(math.radians(g), 3), round(inc, 3), round(math.radians(g * 1.7 + GIRO), 3)] for x, y, h, g, inc in coqueiros],
        "pessoas": [[tres(x, y)[0], round(Z0 + terraco(x, y), 3), tres(x, y)[1], round(math.radians(g), 3), k] for x, y, g, k in pessoas],
        "carros": [[*tres(x, y), round(math.radians(g + GIRO), 3), k] for x, y, g, k in carros],
        "guardaSois": [[*tres(x, y), k] for x, y, k in sois],
        "chao": {"lado": LADO_AO, "z0": Z0},
        "alturas": {"cumeeira": round(z_cumeeira, 2), "torre": round(z_topo, 2)},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
