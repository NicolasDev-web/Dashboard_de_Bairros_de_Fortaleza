# -*- coding: utf-8 -*-
"""
Monumento a Iracema, Martim, Moacir e Japi (orla do Mucuripe, Av. Beira-Mar) em miniatura: gera as peças estáticas do
marco no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/iracemaMartim.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/iracemaMartim.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o IracemaMartim.tsx carrega as três):
    iracemaMartim-pecas.glb     chão (avenida, calçadão, canteiro, areia, mar), o pedestal, a jangada e as quatro figuras
                                da escultura, postes, bancos e as jangadas da praia (oclusão assada nas cores de vértice)
    iracemaMartim-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    iracemaMartim-layout.json   coqueiros, pessoas e carros (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-iracemaMartim.md): norte real para cima (−z do three). De sul para norte: a
calçada do lado dos prédios, a Av. Beira-Mar (com a faixa de pedestres do OSM), a praça do calçadão com o canteiro de
grama (OSM, eixo a ~79°) e, nele, o monumento; depois a areia da Praia do Mucuripe com jangadas e o mar. As distâncias
reais (avenida a ~18 m, areia a ~40 m) foram comprimidas para a areia caber no disco.

A escultura (concreto armado pintado, Corbiniano Lins, 1965): a família partindo numa jangada. A jangada fica ao longo
do eixo do canteiro, proa para és-nordeste (interpretação), e as figuras ficam de perfil para as câmeras do sul.
Escala exagerada de propósito: Martim tem 9,4 m (≈ 5,9 vezes as pessoas de 1,6 m da cena).
Referencial: x = leste, y = norte, z = cima (Blender); o three recebe (x, z, −y).
"""
import json
import math
import os
import random
import sys

import bpy  # noqa: E402
import bmesh
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")
PREFIXO = "iracemaMartim"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal da oficina tem 34 m)
Z0 = 0.10            # topo do piso: tudo pousa aqui
LADO_AO = 67.0

# ——— avenida (OSM: Av. Beira-Mar, primary, eixo a ~84°, ~18 m ao sul da estátua; aqui ~19 m)
AV_Y0 = -20.0
AV_INC = 0.085       # dy/dx (a avenida sobe um pouco para leste, como no OSM)
AV_MEIA = 4.4        # 2 faixas por sentido
X_ZEBRA = 12.0       # travessia de pedestres com zebra (OSM, a leste da estátua)


def av_y(x):
    return AV_Y0 + AV_INC * x


Y_PRAIA = 13.2       # fim do calçadão (degrau para a areia); real ~40 m
Y_MAR = 23.0         # linha d'água média
EIXO = 4.0           # graus a partir do leste: eixo do canteiro e da jangada (rumo 86°; OSM: canteiro 79°, avenida 84°)
CANTEIRO_C = (0.0, -0.6)
CANTEIRO = (24.0, 10.5)
H_PED = 1.6          # pedestal (forma e altura não confirmadas)
ESC = 1.15           # crescimento do conjunto escultórico inteiro (pedestal, jangada e figuras)


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


def ret_girado(cx, cy, w, d, ang):
    """Retângulo w × d centrado em (cx, cy), girado `ang` graus"""
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    return [(cx + c * u - s * v, cy + s * u + c * v) for u, v in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


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


def mat(nome, cor, rug=0.85, metal=0.0):
    """Material PBR nomeado (Principled → glTF metallicRoughness)"""
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
    MATS[nome] = mm
    return mm


COR_TINTA = "#fdeccc"       # tinta branco-gelo quente sobre o concreto (cor real não confirmada: dúvida na ficha)
COR_TINTA_JANGADA = "#e6d3ae"


def criar_materiais():
    M = {}
    M["piso"] = mat("Mat_Chao_Calcadao", "#ddd6c8", 0.9)
    M["faixa_calc"] = mat("Mat_Chao_Calcadao_Faixa", "#c9b9a2", 0.9)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#4b4f56", 0.95)
    M["calcada"] = mat("Mat_Chao_Calcada", "#cfcabf", 0.92)
    M["grama"] = mat("Mat_Chao_Grama", "#6fa046", 0.95)
    M["areia"] = mat("Mat_Chao_Areia", "#ecdcae", 0.95)
    M["molhada"] = mat("Mat_Chao_Areia_Molhada", "#cfbb8c", 0.7)
    M["mar"] = mat("Mat_Agua_Mar", "#2d8a84", 0.22)        # trocado por fab.agua() no .tsx
    M["espuma"] = mat("Mat_Espuma", "#f6f8f6", 0.6)
    M["faixa"] = mat("Mat_Faixa_Branca", "#f2f0e8", 0.7)
    M["meiofio"] = mat("Mat_Meio_Fio", "#e4e0d6", 0.85)
    M["pedestal"] = mat("Mat_Concreto_Pedestal", "#7d776d", 0.88)
    M["pedestal_claro"] = mat("Mat_Concreto_Friso", "#a8a195", 0.85)
    M["tinta"] = mat("Mat_Tinta_Escultura", COR_TINTA, 0.62)
    M["tinta_jangada"] = mat("Mat_Tinta_Jangada", COR_TINTA_JANGADA, 0.7)
    M["poste"] = mat("Mat_Metal_Poste", "#4a5056", 0.45, 0.4)
    M["globo"] = mat("Mat_Luminaria", "#fbfaf4", 0.3)
    M["banco"] = mat("Mat_Concreto_Banco", "#c8c3b8", 0.8)
    M["madeira"] = mat("Mat_Madeira_Jangada", "#9a7650", 0.8)
    M["madeira_esc"] = mat("Mat_Madeira_Escura", "#6b4f35", 0.8)
    M["vela"] = mat("Mat_Vela_Jangada", "#f4efe2", 0.85)
    M["mureta"] = mat("Mat_Mureta", "#e9e3d6", 0.85)
    M["arbusto"] = mat("Mat_Arbusto", "#4a7a36", 0.9)
    M["cobertura"] = mat("Mat_Cobertura_Quiosque", "#6f7a80", 0.6, 0.2)
    M["sol_a"] = mat("Mat_Guarda_Sol_Vermelho", "#d8443a", 0.75)
    M["sol_b"] = mat("Mat_Guarda_Sol_Amarelo", "#f2c230", 0.75)
    return M


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

    def poli(self, pts, mm, liso=False):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(mm)
        f.smooth = liso
        return f

    def juntar(self, bm2, mm, M=None, liso=None):
        """Copia um bmesh temporário; `mm` é um material ou uma lista indexada pelo material_index da face"""
        if M is not None:
            bm2.transform(M)
        mp = {v: self.bm.verts.new(v.co) for v in bm2.verts}
        for f in bm2.faces:
            try:
                nf = self.bm.faces.new([mp[v] for v in f.verts])
            except ValueError:
                continue
            m_ = mm[min(f.material_index, len(mm) - 1)] if isinstance(mm, (list, tuple)) else mm
            nf.material_index = self.mi(m_)
            nf.smooth = f.smooth if liso is None else liso
        bm2.free()

    def criar(self):
        me = bpy.data.meshes.new(self.nome)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
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
    """Superfície de revolução fechada de um perfil [(r, z), ...] em volta do eixo z"""
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


def T(x, y, z=0.0, giro=0.0):
    """Matriz: gira em volta de z (graus) e leva para (x, y, z)"""
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(giro), 4, "Z")


def caixa(P, mm, x0, y0, z0, x1, y1, z1, chanfro=0.0):
    P.juntar(bm_caixa(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), chanfro), mm, T((x0 + x1) / 2, (y0 + y1) / 2, min(z0, z1)))


def alinhar(a, b):
    """Matriz que leva o eixo z (de 0 a |b − a|) para o segmento a → b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation(a) @ q.to_matrix().to_4x4()


def barra(P, a, b, esp, mm):
    """Perfil quadrado de a até b"""
    a, b = Vector(a), Vector(b)
    L = (b - a).length
    if L < 1e-4:
        return
    bm = bm_caixa(esp, esp, L)
    P.juntar(bm, mm, alinhar(a, b))


# ———————————————————————————————————————————————— figuras (volumes simples, silhueta legível)

def membro(ra, rb, L, n=10):
    """Cápsula cônica ao longo de z, de 0 a L: raio ra embaixo e rb em cima, pontas arredondadas"""
    perfil = [(0.0, -ra * 0.85), (ra * 0.62, -ra * 0.68), (ra * 0.95, -ra * 0.25), (ra, 0.0),
              (rb, L), (rb * 0.95, L + rb * 0.25), (rb * 0.62, L + rb * 0.68), (0.0, L + rb * 0.85)]
    return bm_torno(perfil, n)


def osso(P, mm, a, b, ra, rb, n=10):
    """Cápsula cônica de a até b (pontos do mundo)"""
    a, b = Vector(a), Vector(b)
    L = (b - a).length
    if L < 1e-4:
        return
    P.juntar(membro(ra, rb, L, n), mm, alinhar(a, b), liso=True)


def ik(S, Tg, l1, l2, polo):
    """Cotovelo/joelho de uma cadeia de dois ossos de S ao alvo Tg, dobrando para o lado do vetor `polo`"""
    S, Tg, polo = Vector(S), Vector(Tg), Vector(polo)
    d = Tg - S
    dist = min(d.length, (l1 + l2) * 0.995)
    dr = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    p = (polo - dr * polo.dot(dr))
    p = p.normalized() if p.length > 1e-6 else Vector((0, 0, 1))
    return S + dr * a + p * h, S + dr * dist


class Figura:
    """
    Figura humana estilizada no referencial próprio (frente em +x, esquerda em +y, pés em z = 0), já transformada pela
    matriz `M` (posição na jangada). Proporções modernistas: pernas longas e grossas (a crítica cita "a desproporção das
    longas pernas"). Tudo em frações da altura H.
    """

    def __init__(self, P, mm, M, H, ombro=0.11, quadril=0.058, crianca=False):
        self.P, self.mm, self.M, self.H = P, mm, M, H
        self.c = crianca
        k = 1.12 if crianca else 1.0
        self.z_quadril = (0.47 if crianca else 0.53) * H
        self.z_ombro = (0.78 if crianca else 0.815) * H
        self.ombro = ombro * H * k
        self.quadril = quadril * H
        self.r_cabeca = (0.088 if crianca else 0.066) * H
        self.l_braco = (0.15 if crianca else 0.165) * H
        self.l_ante = (0.14 if crianca else 0.16) * H

    def w(self, x, y, z):
        """Ponto do referencial da figura (em frações de H) para o mundo"""
        H = self.H
        return self.M @ Vector((x * H, y * H, z * H))

    def wa(self, v):
        """Ponto do referencial da figura (em metros) para o mundo"""
        return self.M @ Vector(v)

    def local(self, p):
        return self.M.inverted() @ Vector(p)

    def ombro_pt(self, lado):
        return Vector((0.0, lado * self.ombro, self.z_ombro - 0.02 * self.H))

    def tronco(self, peito=0.1, cintura=0.078, ancas=0.09, prof=0.64, busto=False):
        """Tronco de revolução achatado na profundidade: ancas, cintura, peito, ombros e pescoço"""
        H = self.H
        zq, zo = self.z_quadril, self.z_ombro
        s = self.ombro / (0.11 * H)
        perfil = [(0.0, zq - 0.05 * H), (ancas * 0.75 * H, zq - 0.04 * H), (ancas * H, zq + 0.02 * H),
                  (cintura * H, zq + 0.1 * H * (zo - zq) / (0.285 * H)), (peito * H, zo - 0.07 * H),
                  (peito * H * 1.02 * s, zo - 0.02 * H), (peito * 0.8 * H * s, zo + 0.012 * H),
                  (0.042 * H, zo + 0.03 * H), (0.034 * H, zo + 0.065 * H), (0.0, zo + 0.07 * H)]
        bm = bm_torno(perfil, 14)
        bm.transform(Matrix.Diagonal((prof, 1.0, 1.0, 1.0)))
        self.P.juntar(bm, self.mm, self.M, liso=True)
        if busto:
            for lado in (-1, 1):
                b = bm_esfera(0.036 * H, 2)
                self.P.juntar(b, self.mm, self.M @ Matrix.Translation((0.045 * H, lado * 0.045 * H, zo - 0.1 * H)), liso=True)

    def cabeca(self, inclina=0.0, giro=0.0, cabelo=False):
        H = self.H
        r = self.r_cabeca
        zc = self.z_ombro + 0.065 * H + r * 0.95
        bm = bm_esfera(r, 2)
        bm.transform(Matrix.Diagonal((0.92, 0.86, 1.1, 1.0)))
        M = self.M @ Matrix.Translation((0.004 * H, 0, zc)) @ Matrix.Rotation(math.radians(giro), 4, "Z") @ Matrix.Rotation(math.radians(inclina), 4, "Y")
        self.P.juntar(bm, self.mm, M, liso=True)
        # nariz/queixo: um bico discreto para a cabeça ter frente
        self.P.juntar(bm_esfera(r * 0.3, 1), self.mm, M @ Matrix.Translation((r * 0.88, 0, -r * 0.15)), liso=True)
        if cabelo:
            # cabelo longo e liso caindo pelas costas ("mais negros que a asa da graúna", mas a escultura é de uma cor só)
            a = self.M @ Vector((-0.02 * H, 0, zc + r * 0.35))
            b = self.M @ Vector((-0.07 * H, 0, self.z_ombro - 0.17 * H))
            bm = membro(0.035 * H, r * 1.0, (b - a).length, 12)
            bm.transform(Matrix.Diagonal((0.55, 1.0, 1.0, 1.0)))
            self.P.juntar(bm, self.mm, alinhar(b, a), liso=True)
        return M

    def perna(self, lado, pe, joelho_polo=(1, 0, 0), r_coxa=0.066, r_canela=0.046):
        """Perna do quadril até o pé `pe` (frações de H, referencial da figura), com o pé apontando para a frente"""
        H = self.H
        q = Vector((0.0, lado * self.quadril, self.z_quadril))
        alvo = Vector((pe[0] * H, pe[1] * H, (self.r_cabeca * 0 + 0.05 * H)))
        lc = (self.z_quadril - 0.05 * H) * 0.52
        lp = (self.z_quadril - 0.05 * H) * 0.5
        jo, tn = ik(q, alvo, lc, lp, Vector(joelho_polo))
        osso(self.P, self.mm, self.wa(q), self.wa(jo), r_coxa * H, r_coxa * 0.68 * H)
        osso(self.P, self.mm, self.wa(jo), self.wa(tn), r_canela * H, r_canela * 0.55 * H)
        # pé: cunha arredondada do tornozelo até a ponta
        dz = pe[2] if len(pe) > 2 else 0.0
        pt = Vector((tn.x + 0.1 * H, tn.y + lado * 0.008 * H, 0.016 * H + dz * H))
        osso(self.P, self.mm, self.wa(Vector((tn.x - 0.012 * H, tn.y, 0.024 * H + dz * H))), self.wa(pt), 0.03 * H, 0.022 * H, 8)

    def braco(self, lado, mao_mundo, polo=(0, 0, -1), r=0.036):
        """Braço do ombro até a mão (ponto do mundo), com o cotovelo para o lado `polo` (referencial da figura)"""
        H = self.H
        s = self.ombro_pt(lado)
        alvo = self.local(mao_mundo)
        co, mao = ik(s, alvo, self.l_braco, self.l_ante, Vector(polo))
        osso(self.P, self.mm, self.wa(s), self.wa(co), r * H, r * 0.78 * H)
        osso(self.P, self.mm, self.wa(co), self.wa(mao), r * 0.8 * H, r * 0.6 * H)
        # mão: bolinha no fim do antebraço
        self.P.juntar(bm_esfera(r * 0.85 * H, 1), self.mm, Matrix.Translation(self.wa(mao)), liso=True)
        return self.wa(mao)


def escultura(M):
    """
    O conjunto de Corbiniano Lins (1965): a jangada de concreto pintado e, sobre ela, Martim no remo de governo da popa,
    Iracema com a lança erguida, o filho Moacir ao lado dela e o cão Japi na proa. Pose, rumo e pedestal são
    interpretação (só a cena da partida, a lança, o remo e as quatro figuras são confirmados: ficha).
    """
    Ped = Peca("Pedestal_Escultura")
    Jan = Peca("Escultura_Jangada")
    Fig = Peca("Escultura_Figuras")
    cx, cy = 0.0, 0.3
    # tudo da escultura é modelado em z a partir do piso e crescido ESC vezes em volta do centro (leitura a ~200 px)
    R = T(cx, cy, Z0, EIXO) @ Matrix.Scale(ESC, 4)
    # ——— pedestal: soco largo, corpo com chanfro, capa saliente (forma neutra)
    Ped.juntar(bm_caixa(17.4, 7.6, 0.42, 0.08), M["pedestal_claro"], R)
    Ped.juntar(bm_caixa(16.0, 6.2, H_PED - 0.42 - 0.18, 0.14), M["pedestal"], R @ T(0, 0, 0.42))
    Ped.juntar(bm_caixa(16.5, 6.7, 0.18, 0.05), M["pedestal_claro"], R @ T(0, 0, H_PED - 0.18))
    reservar(ret_girado(cx, cy, 17.4 * ESC, 7.6 * ESC, EIXO), 0.6)
    zt = H_PED
    # ——— jangada: seis paus roliços (piúba), os do meio mais compridos, proa levantada, dois tornos, banco e espeques
    tinta = M["tinta_jangada"]
    rr = 0.3
    for k, v in enumerate((-1.55, -0.93, -0.31, 0.31, 0.93, 1.55)):
        meio = abs(v) < 0.5
        u0 = -6.2 + (0.25 if abs(v) > 1.2 else 0.0)
        u1 = 3.6 if meio else (3.2 if abs(v) < 1.2 else 2.6)
        u2 = 6.6 if meio else (5.9 if abs(v) < 1.2 else 5.0)
        osso(Jan, tinta, R @ Vector((u0, v, zt + rr)), R @ Vector((u1, v, zt + rr)), rr, rr * 0.96, 9)
        osso(Jan, tinta, R @ Vector((u1, v, zt + rr)), R @ Vector((u2, v * 0.82, zt + rr + 0.75)), rr * 0.96, rr * 0.55, 9)
    zd = zt + 2 * rr - 0.06          # convés (topo dos paus)
    for u in (-4.6, -1.2, 2.4):
        osso(Jan, tinta, R @ Vector((u, -1.85, zd - 0.05)), R @ Vector((u, 1.85, zd - 0.05)), 0.14, 0.14, 7)
    # banco de vela (onde iria o mastro) e banco do mestre na popa
    Jan.juntar(bm_caixa(0.55, 2.6, 0.5, 0.06), tinta, R @ T(2.6, 0, zd - 0.05))
    Jan.juntar(bm_caixa(0.7, 1.6, 0.35, 0.06), tinta, R @ T(-5.6, 0, zd - 0.05))
    # ——— Martim: de pé na popa, segurando o remo de governo pelo lado de bombordo (lado das câmeras, ao sul)
    Hm = 9.4
    Mm = R @ T(-3.9, 0.15, zd - 0.05, 4.0)
    mart = Figura(Fig, M["tinta"], Mm, Hm, ombro=0.118, quadril=0.06)
    # remo: cabo em diagonal da frente-alto (acima do ombro) até a pá, atrás da popa, junto ao pedestal
    topo = mart.w(0.16, -0.23, 1.08)
    pa = R @ Vector((-7.7, -2.35, zt + 0.12))
    d = (pa - topo).normalized()
    m1 = topo + d * (0.22 * Hm)            # mão de cima
    m2 = topo + d * (0.42 * Hm)            # mão de baixo
    osso(Fig, M["tinta"], topo, pa - d * 2.0, 0.11, 0.13, 8)
    # pá larga do remo, no plano vertical do cabo (o remo é citado nas reportagens de 2025)
    blade = bm_torno([(0.0, -0.05), (0.62, 0.15), (0.66, 1.6), (0.3, 2.6), (0.13, 3.0)], 8)
    blade.transform(Matrix.Diagonal((0.16, 1.0, 1.0, 1.0)))
    q = Vector((0, 0, 1)).rotation_difference(-d)
    Fig.juntar(blade, M["tinta"], Matrix.Translation(pa) @ q.to_matrix().to_4x4(), liso=False)
    mart.tronco(peito=0.1, cintura=0.08, ancas=0.088, prof=0.66)
    mart.cabeca(inclina=-6.0, giro=-6.0)
    mart.perna(1, (0.09, 0.075), joelho_polo=(1, 0.2, 0))
    mart.perna(-1, (-0.07, -0.085), joelho_polo=(1, -0.2, 0))
    mart.braco(-1, m1, polo=(-0.3, -0.4, -1), r=0.037)
    mart.braco(1, m2, polo=(-0.2, 0.6, -0.6), r=0.037)
    # ——— Iracema: de pé no meio, a lança erguida na mão esquerda, a direita no ombro do filho; cabelo longo
    Hi = 8.4
    Mi = R @ T(-0.4, 0.25, zd - 0.05, -16.0)
    ira = Figura(Fig, M["tinta"], Mi, Hi, ombro=0.1, quadril=0.062)
    ira.tronco(peito=0.088, cintura=0.066, ancas=0.098, prof=0.62, busto=True)
    ira.cabeca(inclina=-8.0, giro=8.0, cabelo=True)
    ira.perna(1, (0.03, 0.06), joelho_polo=(1, 0.1, 0))
    ira.perna(-1, (0.1, -0.055), joelho_polo=(1, -0.1, 0))
    lx, ly = 0.075, 0.235
    mao_lanca = ira.w(lx, ly, 0.99)
    ira.braco(1, mao_lanca, polo=(-0.2, 0.6, -0.9), r=0.033)
    a = ira.w(lx, ly, 0.0)
    b = ira.w(lx, ly, 1.36)
    osso(Fig, M["tinta"], a, b, 0.085, 0.07, 8)
    # ponta da lança: folha alongada
    bm = bm_torno([(0.0, 0.0), (0.2, 0.25), (0.24, 0.55), (0.0, 1.5)], 6)
    bm.transform(Matrix.Diagonal((0.45, 1.0, 1.0, 1.0)))
    Fig.juntar(bm, M["tinta"], Mi @ Matrix.Translation((lx * Hi, ly * Hi, 1.36 * Hi)) @ Matrix.Rotation(math.radians(90), 4, "Z"), liso=False)
    # ——— Moacir: menino de pé à frente e à direita da mãe, do lado das câmeras (pernas e braços: danos de 2022)
    Hc = 4.9
    Mc = R @ T(1.0, -0.8, zd - 0.05, -8.0)
    moa = Figura(Fig, M["tinta"], Mc, Hc, ombro=0.11, quadril=0.06, crianca=True)
    moa.tronco(peito=0.1, cintura=0.09, ancas=0.095, prof=0.7)
    moa.cabeca(inclina=-12.0, giro=-10.0)
    moa.perna(1, (0.02, 0.07), joelho_polo=(1, 0, 0))
    moa.perna(-1, (0.06, -0.07), joelho_polo=(1, 0, 0))
    ombro_moa = moa.wa(moa.ombro_pt(1) + Vector((0, 0, 0.07 * Hc)))
    ira.braco(-1, ombro_moa, polo=(0.2, -0.7, -0.6), r=0.033)
    moa.braco(-1, moa.w(0.08, -0.2, 0.42), polo=(-0.3, -0.3, -1), r=0.04)
    moa.braco(1, moa.w(0.03, 0.2, 0.36), polo=(-0.3, 0.3, -1), r=0.04)
    # ——— Japi: o cão na proa, de pé, focinho para o mar
    Mj = R @ T(4.6, 0.0, zd - 0.05, 0.0)
    J = lambda x, y, z: Mj @ Vector((x, y, z))
    osso(Fig, M["tinta"], J(-0.85, 0, 1.15), J(0.75, 0, 1.3), 0.44 * ESC, 0.5 * ESC, 12)          # corpo (peito mais alto)
    osso(Fig, M["tinta"], J(0.85, 0, 1.4), J(1.2, 0, 2.0), 0.28 * ESC, 0.22 * ESC, 10)            # pescoço
    Fig.juntar(bm_esfera(0.34 * ESC, 2), M["tinta"], Matrix.Translation(J(1.3, 0, 2.15)), liso=True)
    osso(Fig, M["tinta"], J(1.4, 0, 2.08), J(1.85, 0, 1.98), 0.2 * ESC, 0.13 * ESC, 8)            # focinho
    for s in (-1, 1):
        bm = bm_cilindro(0.13 * ESC, 0.42 * ESC, 6, r2=0.0)
        Fig.juntar(bm, M["tinta"], Matrix.Translation(J(1.22, s * 0.2, 2.38)) @ Matrix.Rotation(math.radians(-s * 18), 4, "X"), liso=False)
        osso(Fig, M["tinta"], J(0.65, s * 0.24, 1.0), J(0.78, s * 0.24, 0.05), 0.15 * ESC, 0.12 * ESC, 8)     # patas da frente
        osso(Fig, M["tinta"], J(-0.7, s * 0.24, 1.0), J(-0.92, s * 0.24, 0.45), 0.2 * ESC, 0.14 * ESC, 8)     # coxa de trás
        osso(Fig, M["tinta"], J(-0.92, s * 0.24, 0.45), J(-0.78, s * 0.24, 0.05), 0.13 * ESC, 0.11 * ESC, 8)
    osso(Fig, M["tinta"], J(-1.05, 0, 1.3), J(-1.55, 0, 1.95), 0.12 * ESC, 0.07 * ESC, 8)            # rabo erguido
    objs = [Ped.criar(), Jan.criar(), Fig.criar()]
    topo_lanca = max(b.z + 1.5 * ESC, topo.z)
    return objs, topo_lanca, mart


# ———————————————————————————————————————————————— chão: calçada, avenida, calçadão, canteiro, areia e mar

def faixa_av(y_fn, meia, x0=-40, x1=40, n=20):
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
    return Y_MAR + 0.8 * math.sin(x * 0.15 + 0.4) + 0.35 * math.sin(x * 0.41)


def chao(M):
    """Disco de piso, a Av. Beira-Mar com faixas e a zebra, a praça do calçadão, o canteiro, a areia e o mar"""
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["piso"], M["meiofio"]])
    g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, mm, z=0.012, lados=None):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.06)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=1), [mm, lados or mm])
        return poli

    # calçada do lado dos prédios (sul) e a avenida
    placa(faixa_av(lambda x: av_y(x) - AV_MEIA - 8, 8), M["calcada"], 0.14, M["meiofio"])
    placa(faixa_av(av_y, AV_MEIA), M["asfalto"], 0.006)
    # meio-fio do lado do calçadão
    placa(faixa_av(lambda x: av_y(x) + AV_MEIA + 0.15, 0.15), M["meiofio"], 0.15)
    # faixas: tracejado entre os sentidos (amarelo seria o certo em via de mão dupla; ver dúvidas) e bordas
    for i in range(-20, 20):
        x0, x1 = i * 3.6, i * 3.6 + 2.0
        if x0 < X_ZEBRA + 2.5 and x1 > X_ZEBRA - 2.5:
            continue
        placa([(x0, av_y(x0) - 0.07), (x1, av_y(x1) - 0.07), (x1, av_y(x1) + 0.07), (x0, av_y(x0) + 0.07)], M["faixa"], 0.012)
    # zebra da travessia (OSM: crossing=uncontrolled, crossing:markings=zebra)
    for k in range(-5, 6):
        xa = X_ZEBRA + k * 0.85
        ya0, ya1 = av_y(xa) - AV_MEIA + 0.3, av_y(xa) + AV_MEIA - 0.3
        placa([(xa - 0.22, ya0), (xa + 0.22, ya0), (xa + 0.22, ya1), (xa - 0.22, ya1)], M["faixa"], 0.014)
    # faixa de piso mais escuro no calçadão (passeio de pedestres ao longo da praia)
    placa(faixa_av(lambda x: 9.6 + 0.05 * x, 1.6), M["faixa_calc"], 0.016)
    placa(faixa_av(lambda x: av_y(x) + AV_MEIA + 1.6, 1.1), M["faixa_calc"], 0.016)
    # canteiro de grama em volta do monumento (OSM landuse=grass, eixo 79°), com meio-fio
    can = ret_girado(*CANTEIRO_C, *CANTEIRO, EIXO)
    pisos.juntar(bm_prisma(can, Z0 - 0.01, Z0 + 0.16, 0.06, mat_lados=1), [M["meiofio"], M["meiofio"]])
    pisos.juntar(bm_prisma(ret_girado(*CANTEIRO_C, CANTEIRO[0] - 0.5, CANTEIRO[1] - 0.5, EIXO), Z0 + 0.1, Z0 + 0.19, 0.0, mat_lados=1), [M["grama"], M["grama"]])
    reservar(can, 0.4)
    # degrau do calçadão para a areia
    meia = math.sqrt(max(0.0, (RAIO - 0.3) ** 2 - Y_PRAIA ** 2))
    pisos.juntar(bm_caixa(2 * meia, 0.4, 0.3), M["mureta"], T(0, Y_PRAIA - 0.15, Z0 - 0.01))
    # areia (seca e molhada) e mar até a borda norte
    n = 40
    xs = [-36 + 72 * i / n for i in range(n + 1)]
    placa([(x, Y_PRAIA) for x in xs] + [(x, linha_mar(x) - 1.5) for x in reversed(xs)], M["areia"], 0.03)
    placa([(x, linha_mar(x) - 1.5) for x in xs] + [(x, linha_mar(x)) for x in reversed(xs)], M["molhada"], 0.026)
    placa([(x, linha_mar(x)) for x in xs] + [(x, 40) for x in reversed(xs)], M["mar"], 0.016)
    reservar(faixa_av(av_y, AV_MEIA + 0.4), 0.0)
    reservar([(x, Y_PRAIA - 0.4) for x in xs] + [(x, 40) for x in reversed(xs)], 0.0)
    pisos.criar()


def orla(M):
    """Espuma da arrebentação, postes e bancos do calçadão, mureta e cerca-viva da calçada sul, jangadas da praia"""
    P = Peca("Orla_Calcadao")
    for k, (dy, larg) in enumerate(((0.05, 0.45), (2.3, 0.35), (4.8, 0.3))):
        pts_a, pts_b = [], []
        for i in range(61):
            x = -34 + 68 * i / 60
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
    postes = [(x, 11.9) for x in (-26.0, -13.0, 13.0, 26.0)] + [(x, av_y(x) + AV_MEIA + 0.8) for x in (-22.0, -7.0, 7.0, 22.0)]
    for x, y in postes:
        if math.hypot(x, y) > RAIO - 1.0:
            continue
        P.juntar(bm_cilindro(0.16, 0.45, 8, r2=0.12), M["poste"], T(x, y, Z0))
        P.juntar(bm_cilindro(0.07, 5.2, 8, r2=0.05), M["poste"], T(x, y, Z0 + 0.45))
        P.juntar(bm_cilindro(0.2, 0.12, 8, r2=0.12), M["poste"], T(x, y, Z0 + 5.6))
        P.juntar(bm_torno([(0.0, 0.0), (0.18, 0.05), (0.26, 0.3), (0.2, 0.55), (0.0, 0.62)], 10), M["globo"], T(x, y, Z0 + 5.65), liso=True)
        reservar(ret(x - 0.3, y - 0.3, x + 0.3, y + 0.3), 0.3)
    # bancos de concreto virados para o monumento, dos dois lados do canteiro
    cx, cy = CANTEIRO_C
    for u, v, giro in ((-7.5, -7.4, 0), (0.0, -7.4, 0), (7.5, -7.4, 0), (-8.0, 7.0, 180), (8.0, 7.0, 180)):
        c, s = math.cos(math.radians(EIXO)), math.sin(math.radians(EIXO))
        x, y = cx + c * u - s * v, cy + s * u + c * v
        P.juntar(bm_caixa(2.4, 0.6, 0.46, 0.05), M["banco"], T(x, y, Z0, EIXO + giro))
        reservar(ret(x - 1.3, y - 0.5, x + 1.3, y + 0.5), 0.3)
    # calçada sul: mureta baixa e cerca-viva dos jardins dos prédios (OSM landuse=residential)
    ys = lambda x: av_y(x) - AV_MEIA - 4.6
    for i in range(-14, 14):
        x0, x1 = i * 2.4, (i + 1) * 2.4
        xm = (x0 + x1) / 2
        if math.hypot(xm, ys(xm)) > RAIO - 2.4:
            continue
        ang = math.degrees(math.atan(AV_INC))
        P.juntar(bm_caixa(2.42, 0.35, 0.7), M["mureta"], T(xm, ys(xm), Z0 + 0.13, ang))
        P.juntar(bm_caixa(2.42, 1.1, 0.95 + 0.12 * (i % 3), 0.22), M["arbusto"], T(xm, ys(xm) - 0.85, Z0 + 0.1, ang))
    reservar(faixa_av(lambda x: ys(x) - 2.5, 2.8), 0.0)
    # quiosque do calçadão junto da areia (OSM: "Thomas Bar", amenity=bar no Calçadão da Beira Mar; forma neutra) com
    # mesas e guarda-sóis
    qx, qy = -10.5, 10.2
    P.juntar(bm_caixa(3.4, 2.8, 2.6, 0.08), M["mureta"], T(qx, qy, Z0))
    P.juntar(bm_caixa(3.6, 0.5, 1.1, 0.05), M["madeira_esc"], T(qx, qy - 1.55, Z0))          # balcão
    P.juntar(bm_caixa(4.6, 4.0, 0.22, 0.06), M["cobertura"], T(qx, qy - 0.2, Z0 + 2.75))
    for dx in (-2.0, 2.0):
        for dy in (-2.05, 1.65):
            P.juntar(bm_cilindro(0.07, 2.75, 6), M["poste"], T(qx + dx, qy + dy, Z0))
    reservar(ret(qx - 2.4, qy - 2.4, qx + 2.4, qy + 2.0), 0.3)
    for k, (mx_, my_) in enumerate(((-14.6, 8.4), (-6.6, 8.6), (-13.2, 5.6), (-7.6, 5.4))):
        P.juntar(bm_cilindro(0.45, 0.75, 10), M["banco"], T(mx_, my_, Z0))
        P.juntar(bm_cilindro(0.04, 2.3, 5), M["poste"], T(mx_, my_, Z0 + 0.75))
        P.juntar(bm_cilindro(1.35, 0.5, 8, r2=0.06), M["sol_a" if k % 2 == 0 else "sol_b"], T(mx_, my_, Z0 + 2.45))
        reservar(ret(mx_ - 1.0, my_ - 1.0, mx_ + 1.0, my_ + 1.0), 0.2)
    # jangadas da praia (ambientação: as jangadas do Mucuripe, sem posição real) e uma no mar, de vela aberta
    for x, y, giro, vela in ((-21.0, 17.0, 78.0, True), (-12.5, 18.6, 96.0, False), (16.0, 17.6, 84.0, True),
                             (24.0, 15.6, 100.0, False), (4.5, 28.0, 30.0, True)):
        R_ = T(x, y, Z0 + (0.0 if y < 22 else -0.12), giro)
        casco = [(-2.9, -0.8), (1.9, -0.8), (3.0, 0.0), (1.9, 0.8), (-2.9, 0.8)]
        P.juntar(bm_prisma(casco, 0.04, 0.42, 0.0, mat_lados=1), [M["madeira"], M["madeira_esc"]], R_)
        P.juntar(bm_caixa(0.7, 1.5, 0.35), M["madeira"], R_ @ T(-1.3, 0, 0.42))
        P.juntar(bm_caixa(0.45, 1.65, 0.12), M["madeira_esc"], R_ @ T(0.9, 0, 0.42))
        if vela:
            barra(P, R_ @ Vector((0.9, 0, 0.42)), R_ @ Vector((0.9, 0, 6.6)), 0.13, M["madeira"])
            barra(P, R_ @ Vector((0.9, 0, 1.3)), R_ @ Vector((-2.5, 0, 1.55)), 0.1, M["madeira"])
            vel = [R_ @ Vector((0.94, 0.0, 1.35)), R_ @ Vector((0.94, 0.0, 6.4)), R_ @ Vector((-2.45, 0.0, 1.6))]
            P.poli([tuple(v) for v in vel], M["vela"])
            atras = (R_ @ Vector((0, 0.04, 0))) - (R_ @ Vector((0, 0, 0)))
            P.poli([tuple(v + atras) for v in reversed(vel)], M["vela"])
        else:
            # mastro deitado sobre os bancos com a vela enrolada
            barra(P, R_ @ Vector((2.0, 0.35, 0.85)), R_ @ Vector((-2.6, 0.35, 0.85)), 0.13, M["madeira"])
            P.juntar(membro(0.22, 0.18, 3.6, 8), M["vela"], alinhar(R_ @ Vector((1.6, 0.35, 1.0)), R_ @ Vector((-2.2, 0.35, 1.0))), liso=True)
        reservar(ret(x - 3.2, y - 2.2, x + 3.2, y + 2.2), 0.2)
    return P.criar()


# ———————————————————————————————————————————————— coqueiros, gente e carros (layout para o .tsx)

def layout():
    rnd = random.Random(1965)   # ano da inauguração

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.5 - r * 0.8:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    coqueiros = []   # calçadão (fileira junto da areia), canto da praça e calçada sul
    for x, y in ((-26.5, 8.2), (-19.5, 10.4), (19.5, 10.6), (26.5, 7.6), (-16.0, -8.6), (16.5, -7.4),
                 (-22.0, -10.5), (22.5, -9.0), (-24.0, 11.6), (24.0, 11.0)):
        if livre(x, y, 0.3) and math.hypot(x, y) + 3.8 < RAIO:   # a coroa (folhas de 3 m) também fica no disco
            coqueiros.append((x, y, rnd.uniform(6.6, 8.4), rnd.uniform(0, 360), rnd.uniform(0.05, 0.17)))
    pessoas = []
    zonas_p = [((0.0, 2.0), (22.0, 10.0), 26), ((0.0, 17.5), (24.0, 3.5), 9), ((0.0, av_y(0) - AV_MEIA - 1.6), (20.0, 0.9), 5)]
    for (cx, cy), (ax, ay), n in zonas_p:
        k = tent = 0
        while k < n and tent < 900:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            na_praia = y > Y_PRAIA
            if na_praia:
                if y > linha_mar(x) - 0.4:
                    continue
                if any(dist_poligono((x, y), poli) < 0.2 for poli, folga in LIVRE_POLIS if folga == 0.2):
                    continue
            elif any(dist_poligono((x, y), poli) < 0.25 for poli, _ in LIVRE_POLIS):
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.8 for p in pessoas):
                continue
            pessoas.append((x, y, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    carros = []
    ang = math.degrees(math.atan(AV_INC))
    for x, faixa, k in ((-21.0, -3.0, 0), (-9.0, -1.0, 3), (3.5, -3.0, 2), (-15.0, 1.0, 5), (20.0, 3.0, 1), (25.0, -1.0, 4)):
        y = av_y(x) + faixa
        if math.hypot(x, y) < RAIO - 2.2 and abs(x - X_ZEBRA) > 3.5:
            carros.append((x, y, ang + (180.0 if faixa > 0 else 0.0), k))
    return coqueiros, pessoas, carros


def proxies(coqueiros, carros):
    """Volumes provisórios dos coqueiros e carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    mm = mat("Mat_Proxy", "#808080")
    for x, y, h, g, inc in coqueiros:
        P.juntar(bm_cilindro(0.14, h, 6), mm, T(x, y, Z0))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((2.2, 2.2, 0.6, 1)))
        P.juntar(bm, mm, T(x, y, Z0 + h))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(3.6, 1.6, 1.3), mm, T(x, y, Z0, g))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada

def assar(objs_vertice, objs_chao, proxy):
    """Oclusão de ambiente no Cycles (CPU): nas cores de vértice das peças (faixa 0,58–1) e numa imagem 256 do chão"""
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
            k = 0.6 + 0.4 * (a ** 0.85)
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

def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    chao(M)
    esc, z_topo, _ = escultura(M)
    obs = esc + [orla(M)]
    coqueiros, pessoas, carros = layout()
    print(f"coqueiros {len(coqueiros)}, pessoas {len(pessoas)}, carros {len(carros)}; topo da lança {z_topo:.2f} m")
    prox = proxies(coqueiros, carros)
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
        ang = 62 if ob.name.startswith("Escultura") else 32
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(ang), keep_sharp_edges=True)
    for nome in list(bpy.data.materials.keys()):
        if nome.startswith("Mat_Proxy"):
            bpy.data.materials.remove(bpy.data.materials[nome])
    for ob in obs:
        ob.data.color_attributes.active_color = ob.data.color_attributes["AO"]
    arq = os.path.join(SAIDA, f"{PREFIXO}-pecas.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    tres = lambda x, y: (round(x, 3), round(-y, 3))
    dados = {
        # coqueiro: x, z, altura, giro da coroa (rad), inclinação (rad), rumo da inclinação (rad)
        "coqueiros": [[*tres(x, y), round(h, 3), round(math.radians(g), 3), round(inc, 3), round(math.radians(g * 1.7), 3)] for x, y, h, g, inc in coqueiros],
        "pessoas": [[tres(x, y)[0], round(Z0 + (0.03 if y > Y_PRAIA else (0.14 if y < av_y(x) - AV_MEIA else 0.0)), 3), tres(x, y)[1], round(math.radians(g), 3), k] for x, y, g, k in pessoas],
        "carros": [[*tres(x, y), round(math.radians(g), 3), k] for x, y, g, k in carros],
        "chao": {"lado": LADO_AO, "z0": Z0},
        "alturas": {"topo": round(z_topo, 2)},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
