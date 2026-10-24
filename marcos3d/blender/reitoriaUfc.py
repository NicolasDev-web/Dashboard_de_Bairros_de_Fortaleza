# -*- coding: utf-8 -*-
"""
Reitoria da UFC (antigo palacete da família Gentil, 1918, Benfica) em miniatura: gera as peças estáticas do marco no
Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/reitoriaUfc.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/reitoriaUfc.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o ReitoriaUfc.tsx carrega as três):
    reitoriaUfc-pecas.glb     chão, avenida, prédio em H com o palacete e o torreão, varandas, jardins e a Concha
                              Acústica (sem compressão, oclusão assada nas cores de vértice)
    reitoriaUfc-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    reitoriaUfc-layout.json   árvores, carnaúbas, colunas, balaústres, barras, pessoas e carros (o .tsx instancia),
                              em coordenadas do three

Composição (ver relatorios/especialista-reitoriaUfc.md): a Reitoria vista da Av. da Universidade. Avenida e gradil no
primeiro plano, jardim da frente com carnaúbas e a via interna, o prédio em H com o pátio da frente aberto para a
avenida, o palacete com o torreão na ponta da ala nordeste (à esquerda de quem olha da avenida), e atrás a Concha
Acústica entre mangueiras. Tudo é modelado num referencial do prédio: x = à direita de quem olha o pátio da frente da
avenida (sudoeste real), y = da avenida para os fundos (sudeste real), z = cima.

Planta do OSM (way/371206594 e partes; ficha): H de 77 × 44 m com alas de 17,6 m, pátio da frente de 42,7 × 13,5 m,
corpo central de 17,7 m e pátio de trás de 12,8 m; varandas de ~3 m. Na miniatura: largura × 0,66 (alas × 0,72, para o
palacete ganhar fachada), fundo × 0,55 (o pátio da frente × 0,63). Alturas × 0,85: térreo 4,0 m, cornija 7,5 m,
platibanda 8,5 m, torreão 13,4 m (com a balaustrada do mirante; 14,2 m nos pináculos).

GIRO: no fim, o referencial é girado para o pátio da frente olhar para as câmeras da oficina, que vêm todas do sul
(perspectiva −32°, frente 0°, close +24°). No rumo real o pátio olha para 311° (noroeste) e as vistas pegariam os
fundos e a ala sudoeste, que foi o defeito da versão anterior. Para voltar ao rumo real (norte em −z do three), use
GIRO = -131.
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
PREFIXO = "reitoriaUfc"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do piso: tudo pousa aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
GIRO = 62.0          # graus, anti-horário visto de cima: referencial do prédio → Blender (ver docstring)
MUNDO = Matrix.Rotation(math.radians(GIRO), 4, "Z")

# ——— planta da miniatura (referencial do prédio; ver docstring)
X_E = 25.5            # face externa das alas (contorno do H)
X_I = 12.8            # borda do pátio (contorno do H, linha das colunas)
VAR = 2.2             # fundo das varandas (3 m reais)
X_W = X_I + VAR       # parede das alas voltada para os pátios
X_NE = -X_E + VAR     # parede externa da ala nordeste (atrás da varanda externa)
Y_F = -9.0            # ponta das alas (frente, voltada para a avenida)
Y_PF = -0.5           # fundo do pátio da frente (linha das colunas do corpo central)
Y_CF = Y_PF + VAR     # parede da frente do corpo central
Y_PT = 8.5            # fundo do pátio de trás (linha das colunas)
Y_CT = Y_PT - VAR     # parede de trás do corpo central
Y_B = 15.0            # fundos das alas
Y_PAL = -1.0          # o palacete original ocupa a ponta da ala nordeste até aqui
# torreão de cantos chanfrados no canto norte do palacete (frente-esquerda)
TX, TY, TL, TC = -23.35, -6.85, 4.7, 1.0
TL2, TC2 = 3.7, 0.8   # estágio de cima do torreão (mais estreito)
PC = -18.0            # eixo do pórtico do palacete
# alturas
EMB = 0.55            # embasamento
H1 = 4.0              # piso do pavimento superior (laje das varandas = piso das sacadas)
HC = 7.5              # base da cornija
HCT = 7.85            # topo da cornija
HU = 12.0             # base da cornija do alto do torreão
# avenida e jardim da frente
Y_AV0, Y_AV1 = -28.6, -20.6     # meios-fios da Av. da Universidade (lado de lá, lado da Reitoria)
Y_GRADIL = -18.7                # gradil da Reitoria, junto à calçada
Y_VIA0, Y_VIA1 = -15.2, -12.4   # via interna asfaltada diante do prédio
# Concha Acústica (atrás da Reitoria)
CX, CY, CR = 0.0, 27.4, 4.9


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


def cortar_faixa(poli, lo, hi):
    """Corta um polígono convexo 2D [(s, t)] entre s = lo e s = hi"""
    def corte(pts, s0, maior):
        out = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            dp = (p[0] >= s0) if maior else (p[0] <= s0)
            dq = (q[0] >= s0) if maior else (q[0] <= s0)
            if dp:
                out.append(p)
            if dp != dq:
                t = (s0 - p[0]) / (q[0] - p[0])
                out.append((s0, p[1] + t * (q[1] - p[1])))
        return out
    r = corte(poli, lo, True)
    return corte(r, hi, False) if len(r) >= 3 else []


def octogono(cx, cy, lado, ch):
    """Quadrado de cantos chanfrados (planta do torreão)"""
    h = lado / 2
    return [(cx - h + ch, cy - h), (cx + h - ch, cy - h), (cx + h, cy - h + ch), (cx + h, cy + h - ch),
            (cx + h - ch, cy + h), (cx - h + ch, cy + h), (cx - h, cy + h - ch), (cx - h, cy - h + ch)]


LIVRE_POLIS = []   # (polígono, folga): onde não nasce árvore nem gente
BARRAS = []        # barras verticais de ferro do gradil (x, y, z da base, altura): o .tsx instancia
BALAUSTRES = []    # balaústres das sacadas, do palacete e do torreão (x, y, z da base, altura): o .tsx instancia
COLUNAS = []       # colunas jônicas (x, y, z da base, altura, escala, giro): o .tsx instancia


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
PROJETAR_UV = {"Mat_Reboco_Rosa", "Mat_Embasamento_Pedra", "Mat_Cobertura_Laje", "Mat_Arquibancada"}


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

    def quad_uv(self, pts, m, reg):
        """Quadrilátero (base esq., base dir., topo dir., topo esq.) com UV numa região do atlas"""
        return self.poli(pts, m, [uv_reg(reg, a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])

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
        # UV em metros (projeção pelo eixo dominante da normal) no reboco e nas pedras: o .tsx põe a mancha sutil
        self.bm.normal_update()
        for f in self.bm.faces:
            m = self.mats[f.material_index] if f.material_index < len(self.mats) else None
            if m is None or m.name not in PROJETAR_UV:
                continue
            n = f.normal
            for l in f.loops:
                c = l.vert.co
                if abs(n.z) > 0.6:
                    l[self.uv].uv = (c.x / 3, c.y / 3)
                elif abs(n.x) > abs(n.y):
                    l[self.uv].uv = (c.y / 3, c.z / 3)
                else:
                    l[self.uv].uv = (c.x / 3, c.z / 3)
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


def bm_torno(perfil, n=16):
    """Superfície de revolução fechada de um perfil [(r, z), ...] em volta do eixo z (pinhas, urnas, pináculos)"""
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


def caixa(P, m, x0, y0, z0, x1, y1, z1, chanfro=0.0):
    """Caixa alinhada aos eixos de (x0, y0, z0) a (x1, y1, z1) (z já com Z0)"""
    P.juntar(bm_caixa(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), chanfro), m, T((x0 + x1) / 2, (y0 + y1) / 2, min(z0, z1)))


def barra(P, a, b, esp, m):
    """Perfil quadrado de a até b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    if L < 1e-4:
        return
    bm = bm_caixa(L, esp, esp)
    bmesh.ops.translate(bm, vec=Vector((L / 2, 0, -esp / 2)), verts=bm.verts)
    q = Vector((1, 0, 0)).rotation_difference(d.normalized())
    P.juntar(bm, m, Matrix.Translation(a) @ q.to_matrix().to_4x4())


# ———————————————————————————————————————————————— atlas de esquadrias (256 px, gerado aqui)

COR_REBOCO = "#f2a283"     # rosa-salmão do reboco (ficha: #e8ac98 ao sol, #dd9c87 na sombra; mais vivo para a sombra)
COR_BRANCO = "#f6f2ea"     # estuque branco das molduras, cornijas, colunas e balaústres
COR_MADEIRA = "#cda97a"    # venezianas de madeira clara (ficha)
COR_RIPA = "#a8845a"
COR_VIDRO = "#3a4856"

REGIOES = {
    "porta": (0.0, 0.5, 0.25, 1.0),            # porta alta de venezianas com bandeira de vidro (varandas e sacadas)
    "janela": (0.25, 0.5, 0.5, 1.0),           # janela de venezianas com bandeira (fachadas sem varanda)
    "janela_arco": (0.5, 0.5, 0.75, 1.0),      # janela em arco pleno com venezianas (alto do torreão)
    "porta_principal": (0.75, 0.5, 1.0, 1.0),  # porta do palacete: madeira escura almofadada, bandeira em leque
    "arcada": (0.0, 0.25, 0.25, 0.5),          # arco aberto em sombra (pé do torreão, fim da varanda)
    "telha": (0.25, 0.25, 0.75, 0.5),          # telha de barro em canal (cinza; a cor vem do .tsx)
    "janela_peq": (0.75, 0.25, 1.0, 0.5),      # janela pequena de venezianas (fundos)
}
# proporção (largura/altura, em metros) do quadro em que cada região é usada: os arcos do atlas saem redondos
ASPECTO = {"porta": 1.15 / 3.0, "janela": 1.05 / 2.2, "janela_arco": 1.2 / 2.3, "porta_principal": 1.55 / 3.0,
           "arcada": 2.0 / 3.0, "janela_peq": 1.0 / 1.4}


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

    def arco(reg, a0, a1, b0, b1, cor, cor_fn=None):
        """Abertura com topo em arco pleno dentro da região (a, b de 0 a 1), redondo na proporção do quadro"""
        u0, v0, u1, v1 = REGIOES[reg]
        w, h = u1 - u0, v1 - v0
        asp = ASPECTO.get(reg, 1.0)
        ra = (a1 - a0) / 2
        rb = ra * asp
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

    def venezianas(reg, a0, a1, b0, b1, passo=0.045, folhas=2):
        """Folhas de veneziana de madeira clara: fundo, ripas mais escuras e o encontro das folhas"""
        faixa(reg, a0, a1, b0, b1, COR_MADEIRA)
        b = b0 + 0.02
        while b < b1 - 0.02:
            faixa(reg, a0 + 0.02, a1 - 0.02, b, b + passo * 0.4, COR_RIPA)
            b += passo
        for k in range(1, folhas):
            a = a0 + (a1 - a0) * k / folhas
            faixa(reg, a - 0.012, a + 0.012, b0, b1, "#8e6d46")
        faixa(reg, a0, a1, b0, b0 + 0.015, "#8e6d46")

    def bandeira(reg, a0, a1, b0, b1):
        """Bandeira de vidro com caixilho branco em grade"""
        faixa(reg, a0, a1, b0, b1, COR_VIDRO)
        faixa(reg, a0, a1, b0, b0 + 0.02, COR_BRANCO)
        for k in (1, 2):
            a = a0 + (a1 - a0) * k / 3
            faixa(reg, a - 0.012, a + 0.012, b0, b1, COR_BRANCO)
        faixa(reg, a0 + 0.04, a1 - 0.04, (b0 + b1) / 2 + 0.02, (b0 + b1) / 2 + 0.035, "#55667a")

    # fundo de todas as regiões: reboco rosa
    r(0, 0, 1, 1, COR_REBOCO)

    # porta alta das varandas: moldura branca, folhas de veneziana e bandeira de vidro
    faixa("porta", 0.02, 0.98, 0.0, 0.985, COR_BRANCO)
    venezianas("porta", 0.13, 0.87, 0.0, 0.76)
    bandeira("porta", 0.13, 0.87, 0.78, 0.94)

    # janela: moldura branca, peitoril, venezianas e bandeira
    faixa("janela", 0.02, 0.98, 0.0, 0.985, COR_BRANCO)
    venezianas("janela", 0.13, 0.87, 0.07, 0.72)
    bandeira("janela", 0.13, 0.87, 0.74, 0.93)

    # janela em arco do torreão: venezianas embaixo, leque de vidro no arco
    arco("janela_arco", 0.03, 0.97, 0.0, 0.99, COR_BRANCO)

    def leque(a, b, ac, bm_, ra, rb):
        if b < bm_:
            return COR_MADEIRA
        ang = math.atan2((b - bm_) / rb, (a - ac) / ra)
        borda = abs(ang / math.pi * 5 - round(ang / math.pi * 5)) < 0.1
        return COR_BRANCO if borda else COR_VIDRO
    bm_j = arco("janela_arco", 0.14, 0.86, 0.05, 0.93, COR_MADEIRA, leque)
    b = 0.08
    while b < bm_j - 0.03:
        faixa("janela_arco", 0.16, 0.84, b, b + 0.016, COR_RIPA)
        b += 0.04
    faixa("janela_arco", 0.49, 0.51, 0.05, bm_j, "#8e6d46")
    faixa("janela_arco", 0.14, 0.86, bm_j - 0.02, bm_j, COR_BRANCO)
    faixa("janela_arco", 0.0, 1.0, 0.0, 0.05, COR_BRANCO)

    # porta principal do palacete: moldura branca em arco, madeira escura almofadada, bandeira em leque
    arco("porta_principal", 0.03, 0.97, 0.0, 0.99, COR_BRANCO)

    def leque_p(a, b, ac, bm_, ra, rb):
        if b < bm_:
            return "#6a4a32"
        ang = math.atan2((b - bm_) / rb, (a - ac) / ra)
        borda = abs(ang / math.pi * 7 - round(ang / math.pi * 7)) < 0.12
        return COR_BRANCO if borda else COR_VIDRO
    bm_p = arco("porta_principal", 0.13, 0.87, 0.0, 0.93, "#6a4a32", leque_p)
    faixa("porta_principal", 0.13, 0.87, bm_p - 0.025, bm_p, COR_BRANCO)
    faixa("porta_principal", 0.49, 0.51, 0.0, bm_p - 0.02, "#4a3222")
    for b0 in (0.07, 0.36):
        for a0 in (0.19, 0.56):
            faixa("porta_principal", a0, a0 + 0.25, b0, b0 + 0.23, "#7c5a3e")
    faixa("porta_principal", 0.46, 0.54, 0.955, 0.995, COR_BRANCO)

    # arcada do torreão: arquivolta branca, vão em sombra e o piso da varanda ao fundo
    arco("arcada", 0.0, 1.0, 0.0, 1.0, COR_BRANCO)
    arco("arcada", 0.11, 0.89, 0.0, 0.93, "#4a3a36")
    faixa("arcada", 0.11, 0.89, 0.0, 0.1, "#8c7e70")
    faixa("arcada", 0.47, 0.53, 0.93, 1.0, "#e8e2d6")

    # telha de barro em canal: três canais por ladrilho, com sombra entre eles (a cor vem do .tsx)
    u0, v0, u1, v1 = REGIOES["telha"]
    for x in range(int(u0 * n), int(u1 * n)):
        a = ((x + 0.5) / n - u0) / (u1 - u0)
        k = (a * 3) % 1.0
        tom = 0.62 + 0.38 * math.sin(math.pi * k) ** 0.6
        for y in range(int(v0 * n), int(v1 * n)):
            b = ((y + 0.5) / n - v0) / (v1 - v0)
            fiada = 0.93 if (b * 9) % 1.0 < 0.12 else 1.0
            g = min(1.0, tom * fiada)
            pinta(x, y, (g, g, g))

    # janela pequena dos fundos
    faixa("janela_peq", 0.06, 0.94, 0.0, 1.0, COR_BRANCO)
    venezianas("janela_peq", 0.17, 0.83, 0.08, 0.92)

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


# atlas das bandeiras (desenhado em canvas no .tsx, 256 × 64): Brasil, Ceará e UFC
BANDEIRAS = {"brasil": (0, 85), "ceara": (85, 170), "ufc": (170, 256)}


def uv_bandeira(nome, a, b):
    x0, x1 = BANDEIRAS[nome]
    return ((x0 + (x1 - x0) * a) / 256, b)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["grama"] = mat("Mat_Chao_Grama", "#76a24c", 0.95)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#5d6064", 0.95)
    M["piso"] = mat("Mat_Chao_Piso", "#d8d2c6", 0.92)
    M["caminho"] = mat("Mat_Chao_Pedra", "#e4dbc6", 0.9)
    M["meiofio"] = mat("Mat_Meio_Fio", "#ece9e2", 0.85)
    M["amarela"] = mat("Mat_Faixa_Amarela", "#e8b923", 0.8)
    M["reboco"] = mat("Mat_Reboco_Rosa", COR_REBOCO, 0.88)
    M["branco"] = mat("Mat_Estuque_Branco", COR_BRANCO, 0.62)
    M["emb"] = mat("Mat_Embasamento_Pedra", "#ddd5c6", 0.9)
    M["laje"] = mat("Mat_Cobertura_Laje", "#bdb4a6", 0.92)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.6, 0.0, atlas)
    M["telha"] = mat("Mat_Telha_Barro", "#ad6247", 0.82, 0.0, atlas)
    M["sebe"] = mat("Mat_Sebe", "#3e6b30", 0.92)
    M["poste"] = mat("Mat_Metal_Poste", "#3b4045", 0.45, 0.4)
    M["globo"] = mat("Mat_Globo_Luminaria", "#fbfaf4", 0.3)
    M["concreto"] = mat("Mat_Concreto_Concha", "#e8e5dd", 0.7)
    M["arquib"] = mat("Mat_Arquibancada", "#cfcac0", 0.88)
    M["bandeiras"] = mat("Mat_Bandeiras", "#ffffff", 0.8)
    M["mastro"] = mat("Mat_Metal_Mastro", "#d6d9dc", 0.35, 0.4)
    return M


# ———————————————————————————————————————————————— peças de fachada

def nrm_de(face):
    return {"-y": (0.0, -1.0), "+y": (0.0, 1.0), "-x": (-1.0, 0.0), "+x": (1.0, 0.0)}[face]


def vao(P, M, cx, cy, face, larg, z0, z1, reg, saliente=0.025, molduras=True):
    """
    Esquadria do atlas num plano de parede: centro (cx, cy) na face, `face` = lado para onde a parede olha. Com
    `molduras`, ganha em relevo o peitoril (embaixo) e a cimalha (em cima) brancos.
    """
    nx, ny = nrm_de(face)
    rx, ry = -ny, nx                     # direita de quem olha a parede de frente
    ox, oy = cx + nx * saliente, cy + ny * saliente
    a = (ox - rx * larg / 2, oy - ry * larg / 2)
    b = (ox + rx * larg / 2, oy + ry * larg / 2)
    P.poli([(a[0], a[1], Z0 + z0), (b[0], b[1], Z0 + z0), (b[0], b[1], Z0 + z1), (a[0], a[1], Z0 + z1)], M["esquadrias"],
           [uv_reg(reg, u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))])
    if not molduras:
        return
    giro = 0.0 if ny else 90.0
    if reg in ("janela", "janela_peq"):
        P.juntar(bm_caixa(larg + 0.3, 0.2, 0.09), M["branco"], T(cx + nx * 0.08, cy + ny * 0.08, Z0 + z0 - 0.06, giro))
    if reg in ("porta", "janela", "janela_peq"):
        P.juntar(bm_caixa(larg + 0.36, 0.22, 0.13), M["branco"], T(cx + nx * 0.09, cy + ny * 0.09, Z0 + z1 + 0.02, giro))
        P.juntar(bm_caixa(larg + 0.2, 0.14, 0.12), M["branco"], T(cx + nx * 0.06, cy + ny * 0.06, Z0 + z1 + 0.15, giro))
    elif reg in ("janela_arco", "porta_principal", "arcada"):
        P.juntar(bm_caixa(0.24, 0.16, 0.34), M["branco"], T(cx + nx * 0.06, cy + ny * 0.06, Z0 + z1 - 0.26, giro))


def fileira(P, M, p0, p1, face, n, larg, z0, z1, reg, molduras=True):
    """`n` vãos iguais ao longo de uma parede reta de p0 a p1"""
    for k in range(n):
        t = (k + 0.5) / n
        vao(P, M, p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, face, larg, z0, z1, reg, molduras=molduras)


def pilastra(P, M, x, y, face, larg, z0, z1, prof=0.16, m=None):
    nx, ny = nrm_de(face)
    sx, sy = (larg, prof) if ny else (prof, larg)
    P.juntar(bm_caixa(sx, sy, z1 - z0), m or M["branco"], T(x + nx * prof / 2, y + ny * prof / 2, Z0 + z0))


def cinta(P, m, x0, y0, x1, y1, z0, z1, proj, topo=None, lados=None):
    """
    Cornija/friso em volta de um volume retangular: prisma um pouco maior que a planta. `lados` = projeções
    (esquerda, frente, direita, fundos) quando um lado encosta noutro volume.
    """
    pe, pf, pd, pt = lados if lados else (proj, proj, proj, proj)
    P.juntar(bm_prisma(ret(x0 - pe, y0 - pf, x1 + pd, y1 + pt), Z0 + z0, Z0 + z1, 0.0, mat_lados=1), [topo or m, m])


def balaustrada(P, M, p0, p1, z0, alt=0.92, passo=0.34, pedestais=True, esp=0.22):
    """
    Balaustrada de p0 a p1 sobre z0: base e corrimão brancos em relevo e os balaústres (torneados no .tsx, a cada
    `passo`), com dados nas pontas.
    """
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
    if L < 0.2:
        return
    t = (b - a).normalized()
    ang = math.degrees(math.atan2(t.y, t.x))
    c = (a + b) / 2
    P.juntar(bm_caixa(L, esp, 0.12), M["branco"], T(c.x, c.y, Z0 + z0, ang))
    P.juntar(bm_caixa(L + 0.04, esp + 0.06, 0.1), M["branco"], T(c.x, c.y, Z0 + z0 + alt - 0.1, ang))
    n = max(1, round(L / passo))
    for k in range(n):
        p = a + t * (L * (k + 0.5) / n)
        BALAUSTRES.append((p.x, p.y, Z0 + z0 + 0.12, alt - 0.22))
    if pedestais:
        for p in (a, b):
            P.juntar(bm_caixa(esp + 0.14, esp + 0.14, alt + 0.06), M["branco"], T(p.x, p.y, Z0 + z0, ang))


def pedestal(P, M, x, y, z0, lado=0.5, alt=0.95):
    """Pedestal branco (base, dado e capa); devolve o z do topo"""
    P.juntar(bm_caixa(lado + 0.1, lado + 0.1, 0.15), M["branco"], T(x, y, Z0 + z0))
    P.juntar(bm_caixa(lado, lado, alt - 0.27), M["branco"], T(x, y, Z0 + z0 + 0.15))
    P.juntar(bm_caixa(lado + 0.14, lado + 0.14, 0.12), M["branco"], T(x, y, Z0 + z0 + alt - 0.12))
    return Z0 + z0 + alt


def pinaculo(P, M, x, y, z, esc=1.0):
    """Pináculo branco do frontão e do torreão: urna com remate em ponta"""
    perfil = [(0, 0), (0.16, 0), (0.16, 0.06), (0.08, 0.12), (0.19, 0.27), (0.2, 0.38), (0.12, 0.5), (0.06, 0.58), (0.09, 0.64), (0.03, 0.9), (0, 1.0)]
    P.juntar(bm_torno([(r * esc, h * esc) for r, h in perfil], 10), M["branco"], T(x, y, z), liso=True)


def arco_extrudado(cx, y, z0, larg, alt, prof, n=12):
    """Meia-lua (segmento de elipse) no plano y, de largura 2·larg e flecha `alt`, extrudada em +y por `prof`"""
    pts = [(cx - larg * math.cos(math.pi * k / n), y, z0 + alt * math.sin(math.pi * k / n)) for k in range(n + 1)]
    return bm_poli_extrudado(pts, (0, prof, 0))


def flor_de_lis(P, m, cx, y, z0, alt=1.0, prof=0.14):
    """Flor-de-lis em placa (coroamento do frontão do palacete): pétala central em ponta, duas laterais e a cinta"""
    s = alt
    # contorno no plano xz (meia flor, espelhada), de baixo para cima
    meia = [(0.0, 0.0), (0.13, 0.0), (0.09, 0.12), (0.23, 0.13), (0.23, 0.22), (0.15, 0.24),   # pé e cinta
            (0.25, 0.26), (0.37, 0.24), (0.44, 0.17),                                              # pétala lateral: borda de baixo e a ponta caída
            (0.5, 0.26), (0.47, 0.38), (0.37, 0.44), (0.24, 0.43), (0.15, 0.37),                   # borda de cima, voltando
            (0.14, 0.5), (0.15, 0.62), (0.11, 0.77), (0.05, 0.9), (0.0, 1.0)]                      # pétala central em ponta
    pts = [(cx + x * s, y, z0 + z * s) for x, z in meia] + [(cx - x * s, y, z0 + z * s) for x, z in reversed(meia[1:-1])]
    pts = list(reversed(pts))   # face para −y (para a avenida)
    try:
        P.juntar(bm_poli_extrudado(pts, (0, prof, 0)), m)
    except ValueError:
        pass
    P.juntar(bm_caixa(0.5 * s, prof + 0.06, 0.08 * s), m, T(cx, y + prof / 2, z0 + 0.24 * s))


# ———————————————————————————————————————————————— telhados

def agua(P, m, pts3, larg=0.9):
    """Água de telhado (polígono convexo, 1º lado = beiral) cortada em faixas com a telha em canal do atlas"""
    a, b, c = Vector(pts3[0]), Vector(pts3[1]), Vector(pts3[2])
    sdir = (b - a).normalized()
    n = (b - a).cross(c - a).normalized()
    tdir = n.cross(sdir)
    p2 = [((Vector(p) - a).dot(sdir), (Vector(p) - a).dot(tdir)) for p in pts3]
    smin, smax = min(p[0] for p in p2), max(p[0] for p in p2)
    tmax = max(p[1] for p in p2) or 1.0
    for k in range(math.floor(smin / larg), math.ceil(smax / larg)):
        peca = cortar_faixa(p2, k * larg, (k + 1) * larg)
        if len(peca) < 3:
            continue
        pts = [tuple(a + sdir * s + tdir * t) for s, t in peca]
        uvs = [uv_reg("telha", (s - k * larg) / larg, t / tmax) for s, t in peca]
        try:
            P.poli(pts, m, uvs)
        except ValueError:
            pass


def telhado(P, M, x0, y0, x1, y1, z, h):
    """Telhado de quatro águas de telha de barro, escondido atrás da platibanda (forma é dúvida: ficha), com cumeeira"""
    w, d = x1 - x0, y1 - y0
    if w >= d:
        t0, t1 = (x0 + d / 2, (y0 + y1) / 2), (x1 - d / 2, (y0 + y1) / 2)
    else:
        t0, t1 = ((x0 + x1) / 2, y0 + w / 2), ((x0 + x1) / 2, y1 - w / 2)
    zt = z + h
    c0, c1, c2, c3 = (x0, y0), (x1, y0), (x1, y1), (x0, y1)
    A = lambda p, zz: (p[0], p[1], zz)
    if w >= d:
        aguas = [[A(c0, z), A(c1, z), A(t1, zt), A(t0, zt)], [A(c1, z), A(c2, z), A(t1, zt)],
                 [A(c2, z), A(c3, z), A(t0, zt), A(t1, zt)], [A(c3, z), A(c0, z), A(t0, zt)]]
    else:
        aguas = [[A(c0, z), A(c1, z), A(t0, zt)], [A(c1, z), A(c2, z), A(t1, zt), A(t0, zt)],
                 [A(c2, z), A(c3, z), A(t1, zt)], [A(c3, z), A(c0, z), A(t0, zt), A(t1, zt)]]
    for ag in aguas:
        if len(ag) == 4 and math.hypot(ag[2][0] - ag[3][0], ag[2][1] - ag[3][1]) < 1e-3:
            ag = ag[:3]
        agua(P, M["telha"], ag)
    if math.hypot(t1[0] - t0[0], t1[1] - t0[1]) > 0.1:
        barra(P, (t0[0], t0[1], zt + 0.03), (t1[0], t1[1], zt + 0.03), 0.2, M["telha"])
    # espigões
    for c, t in ((c0, t0), (c1, t1 if w >= d else t0), (c2, t1), (c3, t0 if w >= d else t1)):
        barra(P, (c[0], c[1], z + 0.03), (t[0], t[1], zt + 0.03), 0.14, M["telha"])


# ———————————————————————————————————————————————— o prédio em H

def bloco(P, M, x0, y0, x1, y1, lados=None):
    """Volume de 2 pavimentos: paredes de reboco até a cornija, friso entre pavimentos, rodapé, cornija branca"""
    W, B = M["reboco"], M["branco"]
    pe, pf, pd, pt = lados if lados else (1, 1, 1, 1)
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0, Z0 + HC, 0.03), [M["laje"], W])
    k = lambda p, v: p * v
    cinta(P, M["emb"], x0, y0, x1, y1, EMB - 0.05, EMB + 0.25, 0.05, lados=(k(pe, .05), k(pf, .05), k(pd, .05), k(pt, .05)))
    cinta(P, B, x0, y0, x1, y1, H1 - 0.22, H1 + 0.08, 0.1, lados=(k(pe, .1), k(pf, .1), k(pd, .1), k(pt, .1)))
    cinta(P, B, x0, y0, x1, y1, HC - 0.2, HC, 0.12, lados=(k(pe, .12), k(pf, .12), k(pd, .12), k(pt, .12)))
    cinta(P, B, x0, y0, x1, y1, HC, HCT, 0.32, topo=M["laje"], lados=(k(pe, .32), k(pf, .32), k(pd, .32), k(pt, .32)))


def platibanda(P, M, p0, p1, z0=HCT, alt=0.55, esp=0.26, dentro=(0.0, 0.0)):
    """Platibanda lisa de reboco com remate branco, de p0 a p1, encostada na face externa (deslocada `dentro`)"""
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
    t = (b - a).normalized()
    ang = math.degrees(math.atan2(t.y, t.x))
    c = (a + b) / 2 + Vector((*dentro, 0))
    P.juntar(bm_caixa(L, esp, alt - 0.1), M["reboco"], T(c.x, c.y, Z0 + z0, ang))
    P.juntar(bm_caixa(L + 0.08, esp + 0.12, 0.12), M["branco"], T(c.x, c.y, Z0 + z0 + alt - 0.12, ang))


def varanda(P, M, p0, p1, nrm, pilar0=True, pilar1=True, sacada=True, passo=2.3):
    """
    Varanda de colunas jônicas ao longo da borda p0 → p1 (a parede fica VAR para dentro, oposta à normal `nrm`): laje
    branca que vira a sacada do pavimento de cima, com piso de pedra e balaustrada; colunas no .tsx.
    """
    a, b = Vector(p0), Vector(p1)
    L = (b - a).length
    t = (b - a).normalized()
    n = Vector(nrm)
    dentro = -n * VAR
    poli = [tuple(a), tuple(b), tuple(b + dentro), tuple(a + dentro)]
    P.juntar(bm_prisma(poli, Z0 + H1 - 0.38, Z0 + H1, 0.0), [M["emb"], M["branco"]])
    # testeira com friso
    meio = (a + b) / 2
    ang = math.degrees(math.atan2(t.y, t.x))
    P.juntar(bm_caixa(L + 0.1, 0.12, 0.12), M["branco"], T(meio.x + n.x * 0.04, meio.y + n.y * 0.04, Z0 + H1 - 0.5, ang))
    nc = max(1, round(L / passo))
    giro = 0.0 if abs(n.y) > 0.5 else 90.0
    for k in range(nc + 1):
        if (k == 0 and not pilar0) or (k == nc and not pilar1):
            continue
        p = a + t * (L * k / nc) - n * 0.3 + (t * 0.3 if k == 0 else (-t * 0.3 if k == nc else Vector((0, 0))))
        COLUNAS.append((p.x, p.y, Z0 + EMB, H1 - 0.38 - EMB, 1.0, giro))
    if sacada:
        q0, q1 = a - n * 0.14, b - n * 0.14
        balaustrada(P, M, tuple(q0), tuple(q1), H1, pedestais=False)


def predio(M):
    """
    Prédio em H (planta do OSM; ver docstring): alas e corpo central de 2 pavimentos em reboco rosa-salmão, varandas de
    colunas jônicas com sacadas de balaústres em volta dos dois pátios e no lado externo da ala nordeste, portas e
    janelas de venezianas com moldura branca, cornija branca e platibanda com remate; telhado de barro escondido.
    """
    P = Peca("Predio_Alas")
    # embasamento em H (as varandas pousam nele)
    H = [(X_NE, Y_F), (-X_I, Y_F), (-X_I, Y_PF), (X_I, Y_PF), (X_I, Y_F), (X_E, Y_F), (X_E, Y_B), (X_I, Y_B), (X_I, Y_PT),
         (-X_I, Y_PT), (-X_I, Y_B), (-X_E, Y_B), (-X_E, TY + TL / 2), (X_NE, TY + TL / 2)]
    P.juntar(bm_prisma(H, Z0 - 0.05, Z0 + EMB, 0.03), [M["emb"], M["emb"]])
    # volumes: ala nordeste (com o palacete na ponta), corpo central, ala sudoeste
    bloco(P, M, X_NE, Y_F, -X_W, Y_B)
    bloco(P, M, -X_W, Y_CF, X_W, Y_CT, lados=(0, 1, 0, 1))
    bloco(P, M, X_W, Y_F, X_E, Y_B)
    # platibandas (o palacete tem balaustrada no lugar: ver palacete())
    e = 0.13
    platibanda(P, M, (X_NE, Y_PAL), (X_NE, Y_B), dentro=(e, 0))
    platibanda(P, M, (X_NE, Y_B), (-X_W, Y_B), dentro=(0, -e))
    platibanda(P, M, (-X_W, Y_B), (-X_W, Y_CT), dentro=(-e, 0))
    platibanda(P, M, (-X_W, Y_CF), (-X_W, Y_PAL), dentro=(-e, 0))
    platibanda(P, M, (-X_W, Y_CF), (X_W, Y_CF), dentro=(0, e))
    platibanda(P, M, (-X_W, Y_CT), (X_W, Y_CT), dentro=(0, -e))
    platibanda(P, M, (X_W, Y_F), (X_E, Y_F), dentro=(0, e))
    platibanda(P, M, (X_E, Y_F), (X_E, Y_B), dentro=(-e, 0))
    platibanda(P, M, (X_E, Y_B), (X_W, Y_B), dentro=(0, -e))
    platibanda(P, M, (X_W, Y_F), (X_W, Y_CF), dentro=(e, 0))
    platibanda(P, M, (X_W, Y_CT), (X_W, Y_B), dentro=(e, 0))
    # telhados de barro de quatro águas atrás das platibandas
    ins = 0.32
    zt = Z0 + HCT + 0.02
    telhado(P, M, X_NE + ins, Y_F + ins, -X_W - ins, Y_B - ins, zt, 1.7)
    telhado(P, M, -X_W + 0.2, Y_CF + ins, X_W - 0.2, Y_CT - ins, zt, 1.25)
    telhado(P, M, X_W + ins, Y_F + ins, X_E - ins, Y_B - ins, zt, 1.75)

    # varandas: pátio da frente (laterais das alas e fundo), pátio de trás, lado externo da ala nordeste
    varanda(P, M, (-X_I, Y_F), (-X_I, Y_PF), (1, 0), pilar1=False)
    varanda(P, M, (X_I, Y_PF), (X_I, Y_F), (-1, 0), pilar0=False)
    varanda(P, M, (-X_W, Y_PF), (X_W, Y_PF), (0, -1), passo=2.3)
    varanda(P, M, (-X_I, Y_PT), (-X_I, Y_B), (1, 0), pilar0=False)
    varanda(P, M, (X_I, Y_B), (X_I, Y_PT), (-1, 0), pilar1=False)
    varanda(P, M, (X_W, Y_PT), (-X_W, Y_PT), (0, 1), passo=2.3)
    varanda(P, M, (-X_E, Y_B), (-X_E, TY + TL / 2 + 0.05), (-1, 0), pilar1=False, passo=2.4)
    # cantos das varandas internas (as lajes se encontram sem se sobrepor): coluna do canto
    for sx in (-1, 1):
        for y in (Y_PF, Y_PT):
            COLUNAS.append((sx * (X_I + 0.3), y + (-0.3 if y == Y_PF else 0.3), Z0 + EMB, H1 - 0.38 - EMB, 1.0, 0.0))

    # portas e janelas
    zp0, zp1 = EMB + 0.05, EMB + 2.85        # portas do térreo nas varandas
    zs0, zs1 = H1 + 0.05, H1 + 2.75          # portas-balcão nas sacadas
    zj0, zj1 = EMB + 1.0, EMB + 3.0          # janelas do térreo (fachadas sem varanda)
    zk0, zk1 = H1 + 0.7, H1 + 2.75           # janelas do pavimento de cima
    # pátio da frente: corpo central e laterais das alas
    porta_central = 0.0
    for k in range(13):
        x = -X_W + 0.9 + (2 * X_W - 1.8) * (k + 0.5) / 13
        if abs(x - porta_central) < 0.5:
            vao(P, M, x, Y_CF, "-y", 1.55, EMB + 0.05, EMB + 3.1, "porta_principal")
        else:
            vao(P, M, x, Y_CF, "-y", 1.1, zp0, zp1, "porta")
        vao(P, M, x, Y_CF, "-y", 1.05, zs0, zs1, "porta")
    for sx in (-1, 1):
        face = "+x" if sx < 0 else "-x"
        fileira(P, M, (sx * X_W, Y_F + 0.5), (sx * X_W, Y_CF - 0.3), face, 4, 1.05, zp0, zp1, "porta")
        fileira(P, M, (sx * X_W, Y_F + 0.5), (sx * X_W, Y_CF - 0.3), face, 4, 1.0, zs0, zs1, "porta")
        # pátio de trás
        fileira(P, M, (sx * X_W, Y_CT + 0.3), (sx * X_W, Y_B - 0.5), face, 3, 1.05, zp0, zp1, "porta")
        fileira(P, M, (sx * X_W, Y_CT + 0.3), (sx * X_W, Y_B - 0.5), face, 3, 1.0, zs0, zs1, "porta")
    fileira(P, M, (X_W - 0.9, Y_CT), (-X_W + 0.9, Y_CT), "+y", 13, 1.05, zp0, zp1, "porta")
    fileira(P, M, (X_W - 0.9, Y_CT), (-X_W + 0.9, Y_CT), "+y", 13, 1.0, zs0, zs1, "porta")
    # lado externo da ala nordeste (varanda) até o palacete
    fileira(P, M, (X_NE, Y_B - 0.4), (X_NE, TY + TL / 2 + 0.2), "-x", 8, 1.05, zp0, zp1, "porta")
    fileira(P, M, (X_NE, Y_B - 0.4), (X_NE, TY + TL / 2 + 0.2), "-x", 8, 1.0, zs0, zs1, "porta")
    # lado externo da ala sudoeste: janelas e pilastras a cada dois vãos
    nj = 10
    fileira(P, M, (X_E, Y_F + 0.4), (X_E, Y_B - 0.4), "+x", nj, 1.0, zj0, zj1, "janela")
    fileira(P, M, (X_E, Y_F + 0.4), (X_E, Y_B - 0.4), "+x", nj, 1.0, zk0, zk1, "janela")
    for k in range(0, nj + 1, 2):
        y = Y_F + 0.4 + (Y_B - Y_F - 0.8) * k / nj
        y = min(max(y, Y_F + 0.25), Y_B - 0.25)
        pilastra(P, M, X_E, y, "+x", 0.5, EMB + 0.25, HC - 0.2, 0.14)
    # fundos das alas
    fileira(P, M, (X_NE + 0.3, Y_B), (-X_W - 0.3, Y_B), "+y", 3, 1.0, zj0, zj1, "janela")
    fileira(P, M, (X_NE + 0.3, Y_B), (-X_W - 0.3, Y_B), "+y", 3, 1.0, zk0, zk1, "janela")
    fileira(P, M, (X_E - 0.3, Y_B), (X_W + 0.3, Y_B), "+y", 4, 1.0, zj0, zj1, "janela")
    fileira(P, M, (X_E - 0.3, Y_B), (X_W + 0.3, Y_B), "+y", 4, 1.0, zk0, zk1, "janela")
    for x in (X_NE + 0.25, -X_W - 0.25, X_W + 0.25, X_E - 0.25):
        pilastra(P, M, x, Y_B, "+y", 0.5, EMB + 0.25, HC - 0.2, 0.14)
    # ponta da ala sudoeste (frente): três vãos, sacada no do meio, pilastras
    xs = [X_W + (X_E - X_W) * f for f in (0.2, 0.5, 0.8)]
    for i, x in enumerate(xs):
        vao(P, M, x, Y_F, "-y", 1.05, zj0, zj1, "janela")
        if i == 1:
            vao(P, M, x, Y_F, "-y", 1.1, zs0, zs1, "porta")
            caixa(P, M["branco"], x - 1.1, Y_F - 0.85, Z0 + H1 - 0.2, x + 1.1, Y_F, Z0 + H1 + 0.02)
            for dx in (-0.8, 0.8):
                P.juntar(bm_caixa(0.18, 0.6, 0.45), M["branco"], T(x + dx, Y_F - 0.3, Z0 + H1 - 0.62))
            balaustrada(P, M, (x - 1.0, Y_F - 0.75), (x + 1.0, Y_F - 0.75), H1 + 0.02, 0.85, pedestais=False, esp=0.16)
            balaustrada(P, M, (x - 1.0, Y_F - 0.75), (x - 1.0, Y_F - 0.05), H1 + 0.02, 0.85, pedestais=False, esp=0.16)
            balaustrada(P, M, (x + 1.0, Y_F - 0.75), (x + 1.0, Y_F - 0.05), H1 + 0.02, 0.85, pedestais=False, esp=0.16)
        else:
            vao(P, M, x, Y_F, "-y", 1.0, zk0, zk1, "janela")
    for x in (X_W + 0.25, (xs[0] + xs[1]) / 2, (xs[1] + xs[2]) / 2, X_E - 0.25):
        pilastra(P, M, x, Y_F, "-y", 0.5, EMB + 0.25, HC - 0.2, 0.16)
    # degraus do pátio para a varanda do corpo central
    for i, (y0, h) in enumerate(((Y_PF - 0.45, 0.37), (Y_PF - 0.9, 0.19))):
        caixa(P, M["emb"], -2.4 - 0.3 * i, y0, Z0, 2.4 + 0.3 * i, Y_PF + 0.02, Z0 + h)
    reservar(H, 0.6)
    reservar(ret(-X_E - 0.6, Y_F - 1.5, X_E + 0.6, Y_B + 0.6), 0.2)
    return P.criar()


# ———————————————————————————————————————————————— o palacete e o torreão

def palacete(M):
    """
    O palacete Gentil (1918) na ponta da ala nordeste (ficha, foto 05): pórtico com dois pares de colunas brancas no
    térreo, sacada de balaústres, loggia de quatro colunas no pavimento de cima com o arco no vão do meio, frontão (ático)
    com coroamento em volutas, flor-de-lis e dois pináculos, e balaustradas no alto no lugar da platibanda. No canto norte,
    o torreão de cantos chanfrados: arcada no térreo (fim da varanda), janela reta no segundo pavimento, cornija com
    balaustrada, terceiro nível mais estreito com janelas em arco e o mirante com balaustrada no topo.
    """
    P = Peca("Palacete_Torreao")
    W, B = M["reboco"], M["branco"]
    # ——— fachada da frente do palacete (entre o torreão e a varanda do pátio)
    xt = TX + TL / 2           # face direita do torreão
    pilastra(P, M, xt + 0.25, Y_F, "-y", 0.5, EMB + 0.25, HC - 0.2, 0.18)
    pilastra(P, M, -X_W - 0.25, Y_F, "-y", 0.5, EMB + 0.25, HC - 0.2, 0.18)
    # pórtico
    yc = Y_F - 1.45            # linha das colunas
    caixa(P, M["emb"], PC - 2.35, Y_F - 1.95, Z0 - 0.04, PC + 2.35, Y_F, Z0 + EMB)
    for i, (dy, h) in enumerate(((0.45, 0.37), (0.9, 0.19))):
        caixa(P, M["emb"], PC - 2.0 + 0.0 * i, Y_F - 1.95 - dy, Z0 - 0.04, PC + 2.0, Y_F - 1.9, Z0 + h)
    for dx in (-1.78, -1.18, 1.18, 1.78):
        P.juntar(bm_caixa(0.5, 0.5, 0.3), B, T(PC + dx, yc, Z0 + EMB))
        COLUNAS.append((PC + dx, yc, Z0 + EMB + 0.3, H1 - 0.42 - EMB - 0.3, 1.0, 0.0))
    # laje da sacada (entablamento do térreo) e balaustrada
    caixa(P, B, PC - 2.2, Y_F - 1.95, Z0 + H1 - 0.42, PC + 2.2, Y_F, Z0 + H1)
    caixa(P, M["emb"], PC - 2.15, Y_F - 1.9, Z0 + H1, PC + 2.15, Y_F, Z0 + H1 + 0.03)
    caixa(P, B, PC - 2.3, Y_F - 2.05, Z0 + H1 - 0.12, PC + 2.3, Y_F, Z0 + H1 - 0.02)
    yb = Y_F - 1.8
    balaustrada(P, M, (PC - 2.05, yb), (PC + 2.05, yb), H1 + 0.03)
    balaustrada(P, M, (PC - 2.05, yb), (PC - 2.05, Y_F - 0.1), H1 + 0.03, pedestais=False)
    balaustrada(P, M, (PC + 2.05, yb), (PC + 2.05, Y_F - 0.1), H1 + 0.03, pedestais=False)
    # loggia: quatro colunas no pavimento de cima, arco no vão do meio, entablamento e cornija salientes
    hl = HC - 0.5 - H1 - 0.03
    for dx in (-1.78, -0.62, 0.62, 1.78):
        COLUNAS.append((PC + dx, yc, Z0 + H1 + 0.03, hl, 0.85, 0.0))
    P.juntar(arco_extrudado(PC, yc - 0.18, Z0 + HC - 1.35, 0.62, 0.62, 0.3, 12), B)
    for s in (-1, 1):
        caixa(P, B, PC + s * 0.62 - 0.17, yc - 0.18, Z0 + HC - 1.35, PC + s * 0.62 + 0.17, yc + 0.12, Z0 + HC - 0.5)
        caixa(P, B, PC + s * 1.2 - 0.6, yc - 0.18, Z0 + HC - 0.95, PC + s * 1.2 + 0.6, yc + 0.12, Z0 + HC - 0.5)
    caixa(P, B, PC - 2.2, Y_F - 1.95, Z0 + HC - 0.5, PC + 2.2, Y_F, Z0 + HC)
    caixa(P, B, PC - 2.42, Y_F - 2.22, Z0 + HC, PC + 2.42, Y_F, Z0 + HCT)
    # portas: principal no térreo, porta-balcão na loggia, janelas dos lados do pórtico
    vao(P, M, PC, Y_F, "-y", 1.55, EMB + 0.05, EMB + 3.05, "porta_principal")
    vao(P, M, PC, Y_F, "-y", 1.15, H1 + 0.08, H1 + 2.8, "porta", molduras=False)
    # ático (frontão) sobre a cornija do pórtico: bloco com cimalha, coroamento curvo com volutas, flor-de-lis e pináculos
    za = Z0 + HCT
    ya0, ya1 = Y_F - 1.75, Y_F - 0.95
    caixa(P, W, PC - 1.7, ya0, za, PC + 1.7, ya1, za + 1.25, 0.03)
    caixa(P, B, PC - 1.85, ya0 - 0.12, za + 1.25, PC + 1.85, ya1 + 0.1, za + 1.42)
    caixa(P, B, PC - 1.8, ya0 - 0.06, za, PC + 1.8, ya1 + 0.06, za + 0.18)
    for s in (-1, 1):
        caixa(P, B, PC + s * 1.55 - 0.16, ya0 - 0.08, za + 0.18, PC + s * 1.55 + 0.16, ya1, za + 1.25)
    # cartela oval no ático
    cart = bm_cilindro(0.48, 0.1, 16)
    cart.transform(Matrix.Rotation(math.radians(90), 4, "X") @ Matrix.Diagonal((1.25, 0.75, 1.0, 1.0)))
    P.juntar(cart, B, T(PC, ya0 + 0.02, za + 0.66))
    # coroamento: segmento curvo de reboco com aro branco, volutas nas pontas
    zc = za + 1.42
    P.juntar(arco_extrudado(PC, ya0 + 0.08, zc, 1.15, 0.62, 0.55, 14), W)
    P.juntar(arco_extrudado(PC, ya0 - 0.02, zc, 1.28, 0.72, 0.12, 14), B)
    for s in (-1, 1):
        vol = bm_cilindro(0.24, 0.62, 12)
        vol.transform(Matrix.Rotation(math.radians(90), 4, "X"))
        P.juntar(vol, B, T(PC + s * 1.32, ya0 + 0.58, zc + 0.24), liso=True)
        zq = pedestal(P, M, PC + s * 1.78, ya0 + 0.3, HCT + 1.42 - 0.0, 0.42, 0.55)
        pinaculo(P, M, PC + s * 1.78, ya0 + 0.3, zq, 1.05)
    flor_de_lis(P, B, PC, ya0 - 0.08, zc + 0.42, 1.35, 0.18)

    # ——— balaustradas no alto do palacete (no lugar da platibanda), dos lados do ático e na lateral do pátio
    zb = HCT
    yf = Y_F + 0.12
    balaustrada(P, M, (xt + 0.1, yf), (PC - 2.3, yf), zb)
    balaustrada(P, M, (PC + 2.3, yf), (-X_W - 0.12, yf), zb)
    balaustrada(P, M, (-X_W - 0.12, yf), (-X_W - 0.12, Y_PAL), zb)
    balaustrada(P, M, (X_NE + 0.12, TY + TL / 2 + 0.1), (X_NE + 0.12, Y_PAL), zb)
    pedestal(P, M, -X_W - 0.12, Y_PAL, zb, 0.4, 1.0)
    pedestal(P, M, X_NE + 0.12, Y_PAL, zb, 0.4, 1.0)
    zq = pedestal(P, M, -X_W - 0.12, yf, zb, 0.46, 1.05)
    pinaculo(P, M, -X_W - 0.12, yf, zq, 0.8)

    # ——— torreão
    base = octogono(TX, TY, TL + 0.2, TC + 0.08)
    P.juntar(bm_prisma(base, Z0 - 0.04, Z0 + EMB + 0.05, 0.0), [M["emb"], M["emb"]])
    corpo = bm_prisma(octogono(TX, TY, TL, TC), Z0, Z0 + HC, 0.0)
    for f in corpo.faces:   # chanfros em branco (pilastras de canto), faces retas em reboco
        if abs(f.normal.z) < 0.5:
            f.material_index = 2 if abs(abs(f.normal.x) - abs(f.normal.y)) < 0.3 else 1
    P.juntar(corpo, [M["laje"], W, B])
    P.juntar(bm_prisma(octogono(TX, TY, TL + 0.2, TC + 0.08), Z0 + H1 - 0.22, Z0 + H1 + 0.08, 0.0), [B, B])
    P.juntar(bm_prisma(octogono(TX, TY, TL + 0.24, TC + 0.1), Z0 + HC - 0.2, Z0 + HC, 0.0), [B, B])
    P.juntar(bm_prisma(octogono(TX, TY, TL + 0.64, TC + 0.26), Z0 + HC, Z0 + HCT, 0.0), [M["laje"], B])
    h = TL / 2
    # arcada no térreo (frente e lado esquerdo) e janela reta no segundo pavimento
    for face, cx, cy in (("-y", TX, TY - h), ("-x", TX - h, TY)):
        vao(P, M, cx, cy, face, 2.0, EMB + 0.05, EMB + 3.05, "arcada")
        vao(P, M, cx, cy, face, 1.05, H1 + 0.7, H1 + 2.75, "janela")
    vao(P, M, TX, TY + h, "+y", 1.0, H1 + 0.7, H1 + 2.75, "janela")
    # balaustrada na cornija em volta do estágio de cima
    oc = octogono(TX, TY, TL + 0.36, TC + 0.15)
    for i in range(8):
        balaustrada(P, M, oc[i], oc[(i + 1) % 8], HCT, 0.85, pedestais=(i % 2 == 0), esp=0.18)
    # estágio de cima
    alto = bm_prisma(octogono(TX, TY, TL2, TC2), Z0 + HCT, Z0 + HU, 0.0)
    for f in alto.faces:
        if abs(f.normal.z) < 0.5:
            f.material_index = 2 if abs(abs(f.normal.x) - abs(f.normal.y)) < 0.3 else 1
    P.juntar(alto, [M["laje"], W, B])
    P.juntar(bm_prisma(octogono(TX, TY, TL2 + 0.14, TC2 + 0.06), Z0 + HCT, Z0 + HCT + 0.3, 0.0), [B, B])
    P.juntar(bm_prisma(octogono(TX, TY, TL2 + 0.2, TC2 + 0.08), Z0 + HU - 0.2, Z0 + HU, 0.0), [B, B])
    P.juntar(bm_prisma(octogono(TX, TY, TL2 + 0.66, TC2 + 0.27), Z0 + HU, Z0 + HU + 0.38, 0.0), [M["emb"], B])
    h2 = TL2 / 2
    for face, cx, cy in (("-y", TX, TY - h2), ("-x", TX - h2, TY), ("+y", TX, TY + h2), ("+x", TX + h2, TY)):
        vao(P, M, cx, cy, face, 1.25, HCT + 0.6, HCT + 3.15, "janela_arco")
    # mirante: balaustrada no topo com pinhas nos cantos chanfrados
    oc2 = octogono(TX, TY, TL2 + 0.5, TC2 + 0.2)
    for i in range(8):
        balaustrada(P, M, oc2[i], oc2[(i + 1) % 8], HU + 0.38, 0.85, pedestais=True, esp=0.18)
    for i in range(0, 8, 2):
        mx, my = (oc2[i][0] + oc2[(i + 7) % 8][0]) / 2, (oc2[i][1] + oc2[(i + 7) % 8][1]) / 2
        zq = pedestal(P, M, mx, my, HU + 0.38, 0.32, 1.0)
        pinaculo(P, M, mx, my, zq, 0.7)
    reservar(octogono(TX, TY, TL + 0.6, TC), 0.6)
    reservar(ret(PC - 2.6, Y_F - 3.0, PC + 2.6, Y_F), 0.3)
    return P.criar()


# ———————————————————————————————————————————————— chão, avenida, jardins

def chao(M):
    """Disco de gramado; Av. da Universidade, calçadas, via interna, calçada do prédio, caminhos e a área da Concha"""
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["grama"], M["meiofio"]])
    g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, m, z=0.012):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.06)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=0), m)
        return poli

    # avenida e calçadas
    placa(ret(-40, Y_AV0, 40, Y_AV1), M["asfalto"], 0.004)
    placa(ret(-40, Y_AV1, 40, Y_GRADIL), M["piso"], 0.13)
    placa(ret(-40, -40, 40, Y_AV0), M["piso"], 0.13)
    # via interna asfaltada diante do prédio, com as duas entradas pelo gradil
    placa(ret(-29, Y_VIA0, 29, Y_VIA1), M["asfalto"], 0.01)
    for x0 in (-25.2, 21.2):
        placa(ret(x0, Y_GRADIL, x0 + 4.0, Y_VIA0), M["asfalto"], 0.01)
        placa(ret(x0, Y_AV1, x0 + 4.0, Y_GRADIL), M["asfalto"], 0.02)
    # calçada de pedra clara em volta do prédio e diante das pontas das alas
    placa(ret(-29, Y_VIA1, 29, Y_F - 0.0), M["caminho"], 0.03)
    placa(ret(-X_E - 1.3, Y_F, -X_E, Y_B + 1.2), M["caminho"], 0.03)
    placa(ret(X_E, Y_F, X_E + 1.3, Y_B + 1.2), M["caminho"], 0.03)
    placa(ret(-X_E - 1.3, Y_B, X_E + 1.3, Y_B + 1.2), M["caminho"], 0.03)
    # pátio da frente: caminho do eixo e passeio ao longo das varandas; pátio de trás: passeio
    placa(ret(-1.5, Y_F, 1.5, Y_PF), M["caminho"], 0.035)
    placa(ret(-X_I, Y_PF - 1.4, X_I, Y_PF), M["caminho"], 0.035)
    for s in (-1, 1):
        placa(ret(min(s * X_I, s * (X_I - 1.2)), Y_F, max(s * X_I, s * (X_I - 1.2)), Y_PF), M["caminho"], 0.035)
    placa(ret(-X_I, Y_PT, X_I, Y_PT + 1.2), M["caminho"], 0.035)
    placa(ret(-1.2, Y_PT, 1.2, Y_B + 1.2), M["caminho"], 0.035)
    # caminho do portão de pedestres até a via interna
    placa(ret(-1.2, Y_GRADIL, 1.2, Y_VIA0), M["caminho"], 0.03)
    # área da Concha Acústica: piso em leque e terra batida na plateia
    leque = [(CX, CY)] + [(CX + 11.4 * math.cos(math.radians(a)), CY + 11.4 * math.sin(math.radians(a))) for a in range(198, 343, 9)]
    placa(leque, M["caminho"], 0.03)
    placa(ret(-1.2, Y_B + 1.2, 1.2, CY - 11.0), M["caminho"], 0.03)
    # meios-fios da avenida e da via interna, faixas da avenida
    for y in (Y_AV0, Y_AV1):
        meia = math.sqrt(max(0.0, (RAIO - 0.3) ** 2 - y * y))
        pisos.juntar(bm_caixa(2 * meia, 0.22, 0.16), M["meiofio"], T(0, y, Z0 - 0.01))
    meia = math.sqrt((RAIO - 0.3) ** 2 - Y_VIA0 ** 2)
    for x0, x1 in ((-meia, -25.2), (-21.2, 21.2), (25.2, meia)):   # lado do jardim, com as entradas
        if x1 - x0 > 0.3:
            pisos.juntar(bm_caixa(x1 - x0, 0.2, 0.12), M["meiofio"], T((x0 + x1) / 2, Y_VIA0, Z0 - 0.01))
    meia = math.sqrt((RAIO - 0.3) ** 2 - Y_VIA1 ** 2)
    pisos.juntar(bm_caixa(2 * meia, 0.2, 0.12), M["meiofio"], T(0, Y_VIA1, Z0 - 0.01))
    ym = (Y_AV0 + Y_AV1) / 2
    meia = math.sqrt((RAIO - 0.4) ** 2 - Y_AV0 ** 2)
    for s in (-0.14, 0.14):
        pisos.juntar(bm_caixa(2 * meia, 0.1, 0.012), M["amarela"], T(0, ym + s, Z0))
    for yl in (ym - 2.0, ym + 2.0):
        x = -meia + 0.5
        while x < meia - 1.5:
            pisos.juntar(bm_caixa(1.4, 0.12, 0.012), M["meiofio"], T(x + 0.7, yl, Z0))
            x += 3.2
    # faixa de pedestres diante do portão
    for k in range(9):
        pisos.juntar(bm_caixa(0.4, Y_AV1 - Y_AV0 - 0.6, 0.013), M["meiofio"], T(-2.4 + 0.6 * k, ym, Z0))
    reservar(ret(-40, -40, 40, Y_GRADIL + 0.2), 0.0)
    reservar(ret(-30, Y_VIA0 - 0.3, 30, Y_VIA1 + 0.3), 0.0)
    pisos.criar()


def gradil(P, M, p0, p1, passo_pilar=2.6, alt=1.6):
    """Gradil de ferro sobre mureta, com pilares de reboco rosa e capa branca (desenho e cor a confirmar)"""
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
    t = (b - a).normalized()
    ang = math.degrees(math.atan2(t.y, t.x))
    c = (a + b) / 2
    P.juntar(bm_caixa(L, 0.3, 0.5), M["reboco"], T(c.x, c.y, Z0 + 0.12, ang))
    P.juntar(bm_caixa(L + 0.04, 0.36, 0.08), M["branco"], T(c.x, c.y, Z0 + 0.62, ang))
    P.juntar(bm_caixa(L, 0.06, 0.06), M["poste"], T(c.x, c.y, Z0 + 0.12 + alt - 0.06, ang))
    nb = int(L / 0.16)
    for k in range(nb + 1):
        p = a + t * (L * k / nb)
        BARRAS.append((p.x, p.y, Z0 + 0.7, alt - 0.58))
    npil = max(1, round(L / passo_pilar))
    for k in range(npil + 1):
        p = a + t * (L * k / npil)
        P.juntar(bm_caixa(0.42, 0.42, alt + 0.2, 0.03), M["reboco"], T(p.x, p.y, Z0 + 0.12, ang))
        P.juntar(bm_caixa(0.52, 0.52, 0.1), M["branco"], T(p.x, p.y, Z0 + 0.32 + alt, ang))


def jardins(M):
    """
    Jardim da frente e pátios (ficha: sebes baixas aparadas em volta dos canteiros, carnaúbas no pátio da frente,
    mastros de bandeira na ponta sudoeste do pátio): canteiros de grama com bordadura de sebe, gradil com os portões,
    postes de globo na via interna, postes de braço na avenida, mastros com as bandeiras do Brasil, do Ceará e da UFC.
    """
    P = Peca("Jardins_Gradil")
    S = M["sebe"]

    def sebe(x0, y0, x1, y1, h=0.75):
        caixa(P, S, x0, y0, Z0, x1, y1, Z0 + h, 0.08)

    # pátio da frente: dois canteiros com bordadura de sebe
    for s in (-1, 1):
        xa, xb = sorted((s * 1.9, s * (X_I - 1.6)))
        y0, y1 = Y_F + 1.8, Y_PF - 1.9
        sebe(xa, y0, xb, y0 + 0.55)
        sebe(xa, y1 - 0.55, xb, y1)
        sebe(xa, y0 + 0.55, xa + 0.55, y1 - 0.55)
        sebe(xb - 0.55, y0 + 0.55, xb, y1 - 0.55)
        # arbustos aparados (topiaria) no gramado do canteiro, dos dois lados da carnaúba
        for f in (0.22, 0.78):
            cx = xa + (xb - xa) * f
            bm = bm_esfera(1.0, 1)
            bm.transform(Matrix.Diagonal((0.85, 0.85, 0.7, 1)))
            P.juntar(bm, S, T(cx, (y0 + y1) / 2, Z0 + 0.55))
    # pátio de trás: sebes em volta do gramado
    for s in (-1, 1):
        xa, xb = sorted((s * 1.6, s * (X_I - 0.4)))
        sebe(xa, Y_PT + 1.6, xb, Y_PT + 2.1, 0.6)
        for f in (0.3, 0.7):
            bm = bm_esfera(1.0, 1)
            bm.transform(Matrix.Diagonal((0.7, 0.7, 0.6, 1)))
            P.juntar(bm, S, T(xa + (xb - xa) * f, Y_PT + 4.0, Z0 + 0.45))
    # sebe junto ao gradil por dentro e em volta do prédio (bordadura)
    for x0, x1 in ((-21.0, -2.0), (2.0, 21.0)):
        sebe(x0, Y_GRADIL + 0.5, x1, Y_GRADIL + 1.05, 0.7)
    # lado nordeste: arbustos aparados na beira da calçada e bancos de frente para a varanda
    rnd = random.Random(56)
    for k in range(7):
        y = -2.5 + k * 2.6
        bm = bm_esfera(1.0, 1)
        r = rnd.uniform(0.55, 0.75)
        bm.transform(Matrix.Diagonal((r, r * 1.25, r * 0.8, 1)))
        P.juntar(bm, S, T(-27.55, y, Z0 + r * 0.5))
    for y in (0.1, 7.9):
        caixa(P, M["emb"], -28.3, y - 0.8, Z0 + 0.38, -27.8, y + 0.8, Z0 + 0.48)
        for dy in (-0.6, 0.6):
            caixa(P, M["poste"], -28.2, y + dy - 0.05, Z0, -27.9, y + dy + 0.05, Z0 + 0.38)
    # gradil da Reitoria com portões
    meia = math.sqrt((RAIO - 0.5) ** 2 - Y_GRADIL ** 2)
    for x0, x1 in ((-meia, -25.4), (-21.0, -1.6), (1.6, 21.0), (25.4, meia)):
        if x1 - x0 > 0.5:
            gradil(P, M, (x0, Y_GRADIL), (x1, Y_GRADIL))
    for x in (-25.4, -21.0, -1.6, 1.6, 21.0, 25.4):
        caixa(P, M["reboco"], x - 0.36, Y_GRADIL - 0.36, Z0 + 0.12, x + 0.36, Y_GRADIL + 0.36, Z0 + 2.3, 0.04)
        caixa(P, M["branco"], x - 0.45, Y_GRADIL - 0.45, Z0 + 2.3, x + 0.45, Y_GRADIL + 0.45, Z0 + 2.45)
        pinaculo(P, M, x, Y_GRADIL, Z0 + 2.45, 0.55)
    # postes de globo ao longo da via interna (lado do jardim)
    for x in (-17.0, -8.0, 8.0, 17.0):
        y = Y_VIA0 - 0.6
        P.juntar(bm_cilindro(0.2, 0.45, 8, r2=0.13), M["poste"], T(x, y, Z0))
        P.juntar(bm_cilindro(0.07, 3.3, 8, r2=0.055), M["poste"], T(x, y, Z0 + 0.45))
        P.juntar(bm_cilindro(0.15, 0.1, 8), M["poste"], T(x, y, Z0 + 3.72))
        P.juntar(bm_esfera(0.28, 2), M["globo"], T(x, y, Z0 + 4.0), liso=True)
    # postes de braço da avenida (calçada da Reitoria)
    for x in (-15.0, 7.0):
        y = Y_AV1 + 0.5
        P.juntar(bm_cilindro(0.13, 7.2, 8, r2=0.09), M["poste"], T(x, y, Z0 + 0.13))
        barra(P, (x, y, Z0 + 7.1), (x, y - 2.4, Z0 + 7.5), 0.09, M["poste"])
        caixa(P, M["globo"], x - 0.18, y - 2.75, Z0 + 7.32, x + 0.18, y - 2.2, Z0 + 7.46)
    # mastros e bandeiras na ponta sudoeste do pátio da frente
    for i, nome in enumerate(("brasil", "ceara", "ufc")):
        x, y = X_I - 3.4 + i * 1.1, Y_F + 0.9
        caixa(P, M["emb"], x - 0.3, y - 0.3, Z0, x + 0.3, y + 0.3, Z0 + 0.35)
        P.juntar(bm_cilindro(0.06, 8.4, 8, r2=0.045), M["mastro"], T(x, y, Z0 + 0.35))
        P.juntar(bm_esfera(0.1, 1), M["mastro"], T(x, y, Z0 + 8.8))
        # bandeira tremulando para a esquerda (vento leste), nas duas faces
        L, hb, zt = 1.5, 1.0, Z0 + 8.6
        ondas = [(0.0, 0.0), (0.33, 0.1), (0.66, -0.06), (1.0, 0.08)]
        for k in range(3):
            (a0, d0), (a1, d1) = ondas[k], ondas[k + 1]
            p0 = (x - 0.06 - L * a0, y + d0)
            p1 = (x - 0.06 - L * a1, y + d1)
            frente = [(p1[0], p1[1], zt - hb), (p0[0], p0[1], zt - hb), (p0[0], p0[1], zt), (p1[0], p1[1], zt)]
            uvs = [uv_bandeira(nome, a1, 1.0), uv_bandeira(nome, a0, 1.0), uv_bandeira(nome, a0, 0.0), uv_bandeira(nome, a1, 0.0)]
            P.poli(frente, M["bandeiras"], uvs)
            P.poli(frente[::-1], M["bandeiras"], uvs[::-1])
    reservar(ret(X_I - 4.0, Y_F + 0.3, X_I - 0.6, Y_F + 1.5), 0.3)
    return P.criar()


def concha(M):
    """
    Concha Acústica da UFC, atrás da Reitoria (ficha; o "pavilhão auricular" das obras de 2023): casca de concreto em
    quarto de esfera sobre o palco, aberta para a arquibancada em leque. Forma, tamanho e orientação são interpretação
    (dúvida aberta): serve para situar o campus atrás do palacete.
    """
    P = Peca("Concha_Acustica")
    C = M["concreto"]
    # palco: meio disco elevado
    palco = [(CX + 4.4 * math.cos(math.radians(a)), CY + 4.4 * math.sin(math.radians(a))) for a in range(0, 181, 12)]
    P.juntar(bm_prisma(palco, Z0, Z0 + 0.95, 0.03), [M["emb"], C])
    caixa(P, C, CX - 4.6, CY - 0.6, Z0, CX + 4.6, CY, Z0 + 0.95)
    # casca: duas superfícies (interna e externa) e a borda
    bm = bmesh.new()
    na, ne = 18, 7
    R0, R1 = CR, CR + 0.28
    def ponto(R, i, j):
        az = math.pi * i / na             # 0..180° (lado +y, atrás do palco)
        el = (math.pi / 2) * j / ne
        return Vector((CX + R * math.cos(az) * math.cos(el) * 1.08, CY + R * math.sin(az) * math.cos(el), Z0 + 0.95 + R * math.sin(el) * 0.92))
    polo_d = bm.verts.new(ponto(R0, 0, ne))
    polo_f = bm.verts.new(ponto(R1, 0, ne))
    dentro = [[bm.verts.new(ponto(R0, i, j)) for j in range(ne)] + [polo_d] for i in range(na + 1)]
    fora = [[bm.verts.new(ponto(R1, i, j)) for j in range(ne)] + [polo_f] for i in range(na + 1)]

    def face(vs):
        u = []
        for v in vs:
            if v not in u:
                u.append(v)
        if len(u) >= 3:
            bm.faces.new(u)
    for i in range(na):
        for j in range(ne):
            face([dentro[i][j], dentro[i][j + 1], dentro[i + 1][j + 1], dentro[i + 1][j]])
            face([fora[i][j], fora[i + 1][j], fora[i + 1][j + 1], fora[i][j + 1]])
    # borda da abertura (os dois meridianos no plano do palco) e pé da casca
    for i in (0, na):
        for j in range(ne):
            f = [dentro[i][j], fora[i][j], fora[i][j + 1], dentro[i][j + 1]]
            face(f if i == 0 else f[::-1])
    for i in range(na):
        face([dentro[i][0], dentro[i + 1][0], fora[i + 1][0], fora[i][0]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    P.juntar(bm, C, liso=True)
    # arquibancada em leque, de frente para o palco
    for k in range(6):
        r0, r1 = 6.0 + 0.85 * k, 6.0 + 0.85 * (k + 1)
        h = 0.3 * (k + 1)
        arco_pts = []
        for a in range(200, 341, 10):
            arco_pts.append((CX + r1 * math.cos(math.radians(a)), CY + r1 * math.sin(math.radians(a))))
        for a in range(340, 199, -10):
            arco_pts.append((CX + r0 * math.cos(math.radians(a)), CY + r0 * math.sin(math.radians(a))))
        P.juntar(bm_prisma(arco_pts, Z0, Z0 + h, 0.0), [M["arquib"], M["arquib"]])
    # escadas laterais
    reservar([(CX + 4.8 * math.cos(math.radians(a)), CY + 4.8 * math.sin(math.radians(a))) for a in range(0, 360, 20)], 0.4)
    leque = [(CX, CY)] + [(CX + 11.3 * math.cos(math.radians(a)), CY + 11.3 * math.sin(math.radians(a))) for a in range(198, 343, 9)]
    reservar(leque, 0.3)
    return P.criar()


# ———————————————————————————————————————————————— vegetação, gente e carros (layout para o .tsx)

def layout():
    """Posições determinísticas (referencial do prédio; viram coordenadas do three no fim)"""
    rnd = random.Random(1918)   # ano do palacete

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.6 - r * 0.7:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.45:
                return False
        return True

    arvores = []   # (x, y, altura do tronco, raio da copa, tipo: 0 mangueira, 1 oiti)
    # mangueiras (0) e oitis (1): dos lados e nos fundos, longe da fachada do palacete; nas calçadas, oitis menores
    fixas = [(-29.2, -5.5, 1), (-28.6, 9.0, 1), (-19.0, 21.5, 0), (-12.5, 26.5, 0), (19.0, 21.5, 0), (12.5, 26.5, 0),
             (24.0, 17.5, 1), (29.0, 3.0, 1), (28.5, -8.0, 0), (-18.5, -19.6, 1), (18.0, -19.6, 1), (1.5, -30.4, 1),
             (8.0, -29.9, 1), (-23.5, 18.8, 1)]
    for x, y, tipo in fixas:
        r = rnd.uniform(2.6, 3.1) if tipo == 0 else rnd.uniform(1.7, 2.1)
        h = rnd.uniform(1.8, 2.4) if tipo == 0 else rnd.uniform(1.6, 2.1)
        # a copa (com as massas de lado) não passa da borda útil do disco
        r = min(r, (RAIO - 0.2 - math.hypot(x, y)) / (1.25 if tipo == 0 else 1.1))
        arvores.append((x, y, h, r, tipo))
    carnaubas = []   # (x, y, altura, giro)
    for x, y in ((-9.5, -16.9), (8.6, -16.8), (15.2, -16.7), (-6.5, -6.2), (6.4, -6.0), (-17.0, 25.5)):
        carnaubas.append((x, y, rnd.uniform(8.2, 9.4), rnd.uniform(0, 360)))
    pessoas = []
    zonas = [((0.0, (Y_AV1 + Y_GRADIL) / 2), (18.0, 0.6), 6), ((0.0, Y_AV0 - 1.0), (12.0, 0.5), 3), ((0.0, Y_F - 1.0), (10.0, 0.6), 4),
             ((0.0, -3.0), (2.0, 4.0), 3), ((0.0, Y_PF - 0.8), (10.0, 0.4), 3), ((CX, CY - 8.0), (5.0, 2.0), 6),
             ((-26.2, 3.0), (0.3, 9.0), 3)]
    for (cx, cy), (ax, ay), n in zonas:
        k = tent = 0
        while k < n and tent < 600:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.7 for p in pessoas):
                continue
            if any(math.hypot(x - c[0], y - c[1]) < 0.6 for c in carnaubas):
                continue
            z = Z0 + 0.13 if y < Y_GRADIL else Z0 + 0.03
            if cy == CY - 8.0:
                rr = math.hypot(x - CX, y - CY)
                k_deg = int((rr - 6.0) / 0.85)
                z = Z0 + 0.3 * (k_deg + 1) if 0 <= k_deg < 6 else Z0 + 0.03
                giro = math.degrees(math.atan2(CX - x, CY - y))
            else:
                giro = rnd.uniform(0, 360)
            pessoas.append((x, y, z, giro, rnd.randrange(6)))
            k += 1
    carros = []   # (x, y, giro, cor): duas faixas em cada sentido e dois estacionados na via interna
    ym = (Y_AV0 + Y_AV1) / 2
    for x, y, g, k in ((-17.0, ym + 3.0, 180, 0), (-4.5, ym + 3.0, 180, 3), (12.5, ym + 1.0, 180, 5), (-10.0, ym + 1.0, 180, 1),
                       (6.5, ym - 1.0, 0, 6), (-13.0, ym - 1.0, 0, 2), (3.0, ym - 3.0, 0, 4),
                       (15.5, (Y_VIA0 + Y_VIA1) / 2, 0, 0), (-12.5, (Y_VIA0 + Y_VIA1) / 2, 180, 1)):
        if math.hypot(x, y) < RAIO - 2.2:
            carros.append((x, y, g, k))
    return arvores, carnaubas, pessoas, carros


def proxies(arvores, carnaubas, carros):
    """Volumes provisórios (copas, carnaúbas, carros, colunas): só fazem sombra na oclusão assada e depois somem"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r, tipo in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.72, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h + r * 0.7))
        P.juntar(bm_cilindro(0.28, h + 0.4, 6), m, T(x, y, Z0))
    for x, y, h, g in carnaubas:
        P.juntar(bm_cilindro(0.16, h, 6), m, T(x, y, Z0))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((1.7, 1.7, 1.3, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(3.7, 1.6, 1.3), m, T(x, y, Z0, g))
    for x, y, z, h, e, g in COLUNAS:
        P.juntar(bm_cilindro(0.2 * e, h, 6), m, T(x, y, z))
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
    obs = [predio(M), palacete(M), jardins(M), concha(M)]
    arvores, carnaubas, pessoas, carros = layout()
    print(f"árvores {len(arvores)}, carnaúbas {len(carnaubas)}, pessoas {len(pessoas)}, carros {len(carros)}, "
          f"colunas {len(COLUNAS)}, balaústres {len(BALAUSTRES)}, barras {len(BARRAS)}")
    prox = proxies(arvores, carnaubas, carros)
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
    dados = {
        "arvores": [[tres(x, y)[0], round(Z0 + h, 3), tres(x, y)[1], round(r, 3), t] for x, y, h, r, t in arvores],
        "carnaubas": [[*tres(x, y), round(h, 3), round(math.radians(g), 3)] for x, y, h, g in carnaubas],
        "pessoas": [[tres(x, y)[0], round(z, 3), tres(x, y)[1], rad(g), k] for x, y, z, g, k in pessoas],
        "carros": [[*tres(x, y), rad(g), k] for x, y, g, k in carros],
        "colunas": [[*tres(x, y), round(z, 3), round(h, 3), e, rad(g)] for x, y, z, h, e, g in COLUNAS],
        "balaustres": [[*tres(x, y), round(z, 3), round(h, 3)] for x, y, z, h in BALAUSTRES],
        "barras": [[*tres(x, y), round(z, 3), round(h, 3)] for x, y, z, h in BARRAS],
        "chao": {"lado": LADO_AO, "z0": Z0},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
