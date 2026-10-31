# -*- coding: utf-8 -*-
"""
Marco Zero de Fortaleza (Praça do Santiago, Barra do Ceará) em miniatura: gera as peças estáticas do marco no Blender e
exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/marcoZero.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/marcoZero.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o MarcoZero.tsx carrega as três):
    marcoZero-pecas.glb     chão (praça, canteiro, areia, rio e mar, quadra, estacionamento e a Rua José Roberto Sales),
                            o cruzeiro com as quatro imagens, o enrocamento, os quiosques, a torre de salvamento, as
                            barracas, o mercado, a quadra, postes, barcos e a jangada (oclusão assada nas cores de vértice)
    marcoZero-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    marcoZero-layout.json   coqueiros, pessoas e carros (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-marcoZero.md): o cruzeiro de granito de 12 m no centro do canteiro de grama da
Praça do Santiago, no lugar onde o Rio Ceará encontra o mar. Norte real para cima (−z do three), como o contorno do
bairro no tour: a oeste o enrocamento e o estuário, com os quiosques hexagonais e a torre de salvamento na faixa entre a
praça e o rio; ao norte a areia e o mar; a nordeste as barracas; a leste a quadra poliesportiva; ao sul o Mercado Vila do
Mar, o estacionamento e a Rua José Roberto Sales. As distâncias do OSM foram comprimidas (~0,3 além de 8 m do cruzeiro:
o rio a 62 m vira 26,5 m), mas o cruzeiro e o canteiro ficam no tamanho real, e os prédios encolhem pouco (~0,6).

O cruzeiro (granito, presente do governo da Espanha nos 400 anos do Fortim de Santiago, 2004): sem foto, segue o tipo do
cruceiro galego (plataforma de três degraus, pedestal, fuste octogonal, capitel e cruz). O Cristo crucificado olha para o
sul (a praça e as câmeras), Nossa Senhora da Assunção para o mar; Santiago (peregrino, com chapéu e bordão) e São José
(com o Menino e a vara) ficam nas faces oeste e leste do capitel. Espessuras exageradas ~1,8 vez para ler de longe.
Referencial: x = leste, y = norte, z = cima (Blender); o three recebe (x, z, −y).
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
PREFIXO = "marcoZero"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal da oficina tem 34 m)
Z0 = 0.10            # topo do piso da praça: tudo pousa aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem

# ——— planta da miniatura (metros; o cruzeiro na origem)
R_CANTEIRO = 6.0     # canteiro de grama (OSM: 11,5 m de diâmetro)
X_RIO = -24.5        # margem do Rio Ceará com o enrocamento (OSM: x ≈ −62 m)
X_PRACA_O = -17.4    # borda oeste da praça (OSM: −39 m); entre ela e o rio, a faixa dos quiosques
# borda norte do piso (praça → areia): a ponta da praça ao norte e a diagonal da praia a nordeste (OSM: rumo ~115°)
BORDA_AREIA = [(-40.0, 17.6), (X_RIO, 17.6), (-8.0, 20.6), (0.0, 18.4), (12.0, 13.2), (24.0, 7.8), (36.0, 2.4), (44.0, -1.2)]
# linha d'água (praia → mar), do pé do enrocamento a leste
COSTA = [(X_RIO, 21.3), (-14.0, 25.4), (-4.0, 27.0), (6.0, 26.8), (14.0, 25.0), (21.0, 21.5), (27.0, 17.2), (32.0, 12.6), (38.0, 7.0), (44.0, 1.5)]
QUADRA = (13.4, -19.2, 24.6, -2.6)    # quadra poliesportiva (OSM: 18 × 32 m; aqui 11,2 × 16,6 m)
RUA_Y0, RUA_Y1 = -31.6, -25.6         # Rua José Roberto Sales (Av. Costa Oeste; OSM: y ≈ −58 m), 2 faixas
CALCADA_RUA = 1.6                     # calçada do lado da praça
ESTAC = (-21.6, -24.0, -13.4, -18.6)  # estacionamento da orla (OSM: x −37…−16, y −53…−45)
MERCADO = (-8.8, -20.6, 7.6, 4.6, 3.4)   # Mercado Vila do Mar: centro, largura, fundo, altura (OSM: 11 × 7 m)
QUIOSQUES = [(-21.0, 9.0), (-21.0, -1.6), (-21.0, -12.2)]   # três quiosques hexagonais (OSM: x ≈ −50, y +4, −13, −37)
R_QUIOSQUE = 2.4
TORRE = (-21.4, 16.6)                 # Torre de Salvamento Aquático, Posto 1 (OSM: (−44, +16))
BARRACAS = [(9.6, 18.7, 7.4, 6.0), (21.6, 13.3, 8.2, 6.4)]    # barracas da praia (OSM: 3,6–3,8 m de altura), x, y, l, f
GIRO_PRAIA = -24.3                    # rumo da diagonal da praia (graus a partir do leste)

# ——— alturas do cruzeiro (acima de Z0)
H_DEGRAU = 0.38
Z_PEDESTAL = 3 * H_DEGRAU             # 1,14
Z_FUSTE = Z_PEDESTAL + 1.62           # 2,76
Z_CAPITEL = 8.10
Z_CRUZ = 9.55
Z_TOPO = 12.50
Z_BRACOS = 11.25                      # eixo dos braços da cruz
ESC = 1.25                            # o cruzeiro inteiro cresce 25% (topo a ~16 m) para mandar na cena


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


def interp(linha, x):
    """y de uma polilinha [(x, y), ...] (x crescente) no ponto x"""
    for (xa, ya), (xb, yb) in zip(linha, linha[1:]):
        if xa <= x <= xb:
            return ya + (yb - ya) * (x - xa) / (xb - xa)
    return linha[0][1] if x < linha[0][0] else linha[-1][1]


def linha_mar(x):
    """Linha d'água levemente ondulada sobre a polilinha da costa"""
    return interp(COSTA, x) + 0.45 * math.sin(x * 0.31 + 0.4) + 0.2 * math.sin(x * 0.77)


# ———————————————————————————————————————————————— materiais

def srgb_lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


MATS = {}
PROJETAR_UV = {"Mat_Granito"}   # UV por projeção de caixa (metros / 40 + 0,5, dentro de [0, 1]): o .tsx põe o grão do granito


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


TINTAS = {}   # nome do material provisório → (material de base, cor)


def tinta(base, cor):
    """Material provisório: depois do bake a cor entra nas cores de vértice e a face volta para o material de base"""
    nome = f"Tinta__{base.name}__{cor.lstrip('#')}"
    if nome not in MATS:
        mm = bpy.data.materials.new(nome)
        MATS[nome] = mm
        TINTAS[nome] = (base, cor)
    return MATS[nome]


COR_GRANITO = "#b3aea4"     # granito cinza-claro (cor real não confirmada: dúvida na ficha)


def criar_materiais():
    M = {}
    M["praca"] = mat("Mat_Chao_Praca", "#d9cdab", 0.9)            # pedra cariri do calçadão da Vila do Mar
    M["calcadao"] = mat("Mat_Chao_Calcadao", "#cfc7b4", 0.9)       # faixa dos quiosques e calçada da rua
    M["grama"] = mat("Mat_Chao_Grama", "#6fa046", 0.95)
    M["areia"] = mat("Mat_Chao_Areia", "#ecdcae", 0.95)
    M["molhada"] = mat("Mat_Chao_Areia_Molhada", "#cdb98a", 0.7)
    M["agua"] = mat("Mat_Agua_Mar", "#2d8a84", 0.2)               # trocado por fab.agua() no .tsx
    M["espuma"] = mat("Mat_Espuma", "#f6f8f6", 0.6)
    M["rua"] = mat("Mat_Chao_Intertravado", "#8e8780", 0.92)       # OSM: surface=paving_stones
    M["quadra"] = mat("Mat_Chao_Quadra", "#3f7d63", 0.8)
    M["quadra_borda"] = mat("Mat_Chao_Quadra_Borda", "#b9b4aa", 0.88)
    M["faixa"] = mat("Mat_Faixa_Branca", "#f2f0e8", 0.7)
    M["meiofio"] = mat("Mat_Meio_Fio", "#e4e0d6", 0.85)
    M["granito"] = mat("Mat_Granito", COR_GRANITO, 0.72)
    M["pedra"] = mat("Mat_Pedra_Enrocamento", "#8a837a", 0.95)
    M["parede"] = mat("Mat_Parede_Branca", "#f1eee6", 0.85)
    M["cobertura"] = mat("Mat_Cobertura_Metal", "#8c8780", 0.55, 0.2)
    M["telha"] = mat("Mat_Cobertura_Fibrocimento", "#bdb9b0", 0.8)
    M["escuro"] = mat("Mat_Vao_Escuro", "#2f3438", 0.5)
    M["madeira"] = mat("Mat_Madeira", "#9a7650", 0.8)
    M["madeira_esc"] = mat("Mat_Madeira_Escura", "#6b4f35", 0.8)
    M["vela"] = mat("Mat_Vela", "#f4efe2", 0.85)
    M["barco"] = mat("Mat_Barco_Pintado", "#ffffff", 0.6)          # cores pelas tintas (cores de vértice)
    M["poste"] = mat("Mat_Metal_Poste", "#4a5056", 0.45, 0.4)
    M["globo"] = mat("Mat_Luminaria", "#fbfaf4", 0.3)
    M["trave"] = mat("Mat_Metal_Branco", "#f2f2ee", 0.5, 0.2)
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
        # UV por projeção de caixa nos materiais de PROJETAR_UV: metros / 40 + 0,5 (fica em [0, 1] e o meshopt quantiza;
        # o .tsx repete a textura 25 vezes, uma a cada 1,6 m)
        for f in self.bm.faces:
            mm = self.mats[f.material_index] if f.material_index < len(self.mats) else None
            if mm is None or mm.name not in PROJETAR_UV:
                continue
            n = f.normal
            for lp in f.loops:
                c = lp.vert.co
                if abs(n.z) > max(abs(n.x), abs(n.y)):
                    u, v = c.x, c.y
                elif abs(n.x) > abs(n.y):
                    u, v = c.y, c.z
                else:
                    u, v = c.x, c.z
                lp[self.uv].uv = (u / 40 + 0.5, v / 40 + 0.5)
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



def figura_vestida(P, mm, M, H, prof=0.72):
    """
    Figura de túnica longa até os pés (superfície de revolução achatada na profundidade) com a cabeça, no referencial
    da Figura (frente em +x, esquerda em +y, pés em z = 0) já levado ao mundo por `M`. Devolve a função que leva um ponto
    do referencial (em frações de H) para o mundo.
    """
    perfil = [(0.0, 0.0), (0.175, 0.0), (0.168, 0.06), (0.15, 0.3), (0.13, 0.55), (0.128, 0.66), (0.135, 0.74),
              (0.118, 0.8), (0.06, 0.825), (0.042, 0.85), (0.0, 0.86)]
    bm = bm_torno([(r * H, z * H) for r, z in perfil], 12)
    bm.transform(Matrix.Diagonal((prof, 1.0, 1.0, 1.0)))
    P.juntar(bm, mm, M, liso=True)
    cab = bm_esfera(0.072 * H, 2)
    cab.transform(Matrix.Diagonal((0.92, 0.86, 1.1, 1.0)))
    P.juntar(cab, mm, M @ Matrix.Translation((0.005 * H, 0, 0.925 * H)), liso=True)
    return lambda x, y, z: M @ Vector((x * H, y * H, z * H))


def manga(P, mm, w, ombro, mao, H, r=0.04):
    """Braço vestido (manga larga) do ombro à mão, com a mão no fim; pontos em frações de H"""
    a, b = w(*ombro), w(*mao)
    osso(P, mm, a, b, r * H, r * 0.8 * H, 8)
    P.juntar(bm_esfera(r * 0.75 * H, 1), mm, Matrix.Translation(b), liso=True)


# ———————————————————————————————————————————————— o cruzeiro

def remate(P, mm, M, r):
    """Pomo octogonal das pontas da cruz (o florão dos cruceiros, simplificado)"""
    P.juntar(bm_torno([(0.0, 0.0), (r * 0.7, 0.0), (r, r * 0.45), (r * 0.85, r * 1.0), (r * 0.35, r * 1.3), (0.0, r * 1.38)], 8), mm, M)


def cruzeiro(M):
    """
    O cruzeiro de granito (ficha: 12 m, mais de 10 t, presente do governo da Espanha em 2004), no tipo do cruceiro
    galego: plataforma de três degraus quadrados, pedestal com plinto, dado e cornija, fuste octogonal com colarinho e
    astrágalo, capitel alargado com o ábaco, e a cruz de braços rematados por pomos, com o título (INRI) no alto.
    """
    P = Peca("Cruzeiro")
    G = M["granito"]
    # plataforma: três degraus (lados de 5,8, 4,6 e 3,4 m)
    for k, lado in enumerate((5.8, 4.6, 3.4)):
        P.juntar(bm_caixa(lado, lado, H_DEGRAU + 0.02, 0.05), G, T(0, 0, Z0 + k * H_DEGRAU - 0.02))
    # pedestal: plinto, dado com molduras rebaixadas nas quatro faces, cornija
    z = Z0 + Z_PEDESTAL
    P.juntar(bm_caixa(2.2, 2.2, 0.22, 0.05), G, T(0, 0, z))
    P.juntar(bm_caixa(1.85, 1.85, 1.15, 0.07), G, T(0, 0, z + 0.22))
    for giro in (0, 90, 180, 270):
        R = T(0, 0, z + 0.22, giro)
        for a, b in (((-0.55, -0.95, 0.25), (0.55, -0.95, 0.31)), ((-0.55, -0.95, 0.84), (0.55, -0.95, 0.9))):
            caixa_m(P, G, R, a, b, 0.06)
        for xa in (-0.58, 0.52):
            caixa_m(P, G, R, (xa, -0.95, 0.25), (xa + 0.06, -0.95, 0.9), 0.06)
    P.juntar(bm_caixa(2.15, 2.15, 0.25, 0.06), G, T(0, 0, z + 1.37))
    # fuste octogonal (faces voltadas para os eixos), colarinho na base e astrágalo no alto
    oct_ = Matrix.Rotation(math.radians(22.5), 4, "Z")
    z = Z0 + Z_FUSTE
    P.juntar(bm_cilindro(0.66, 0.34, 8, r2=0.58), G, T(0, 0, z) @ oct_)
    P.juntar(bm_cilindro(0.56, Z_CAPITEL - Z_FUSTE - 0.34, 8, r2=0.49), G, T(0, 0, z + 0.34) @ oct_)
    P.juntar(bm_cilindro(0.56, 0.16, 8), G, T(0, 0, Z0 + Z_CAPITEL - 0.2) @ oct_)
    # capitel: tronco de pirâmide de 1,0 → 1,5 m, com o ábaco por cima
    bm = bm_caixa(1.0, 1.0, Z_CRUZ - Z_CAPITEL - 0.22, 0.04)
    topo = max(v.co.z for v in bm.verts)
    for v in bm.verts:
        k = 1.0 + 0.5 * (v.co.z / topo)
        v.co.x *= k
        v.co.y *= k
    P.juntar(bm, G, T(0, 0, Z0 + Z_CAPITEL))
    P.juntar(bm_caixa(1.7, 1.7, 0.22, 0.05), G, T(0, 0, Z0 + Z_CRUZ - 0.22))
    # ménsulas das imagens do capitel (oeste e leste) e da Virgem (norte)
    for s in (-1, 1):
        P.juntar(bm_caixa(0.42, 0.62, 0.2, 0.03), G, T(s * 0.74, 0, Z0 + Z_CAPITEL - 0.12))
    # a cruz: haste de 0,56 × 0,46 m, braços de 2,6 m, pomos nas três pontas, base chanfrada
    P.juntar(bm_caixa(0.86, 0.72, 0.2, 0.04), G, T(0, 0, Z0 + Z_CRUZ))
    P.juntar(bm_caixa(0.56, 0.46, Z_TOPO - Z_CRUZ - 0.2, 0.05), G, T(0, 0, Z0 + Z_CRUZ + 0.2))
    P.juntar(bm_caixa(2.6, 0.46, 0.5, 0.05), G, T(0, 0, Z0 + Z_BRACOS - 0.25))
    remate(P, G, T(0, 0, Z0 + Z_TOPO - 0.04) @ oct_, 0.32)
    for s in (-1, 1):
        remate(P, G, Matrix.Translation((s * 1.26, 0, Z0 + Z_BRACOS)) @ Matrix.Rotation(math.radians(s * 90), 4, "Y") @ oct_, 0.3)
    # título (INRI) e o apoio dos pés do Cristo, na face sul; ménsula da Virgem na face norte
    P.juntar(bm_caixa(0.62, 0.08, 0.3, 0.02), G, T(0, -0.26, Z0 + Z_BRACOS + 0.62))
    P.juntar(bm_caixa(0.4, 0.22, 0.14, 0.03), G, T(0, -0.32, Z0 + Z_CRUZ + 0.08))
    P.juntar(bm_caixa(0.5, 0.3, 0.16, 0.03), G, T(0, 0.36, Z0 + Z_CRUZ + 0.1))
    crescer(P)
    reservar(ret(-4.0, -4.0, 4.0, 4.0), 0.4)
    return P.criar()


def crescer(P):
    """Aplica ESC ao cruzeiro em volta do pé (0, 0, Z0)"""
    P.bm.transform(Matrix.Translation((0, 0, Z0)) @ Matrix.Scale(ESC, 4) @ Matrix.Translation((0, 0, -Z0)))


def caixa_m(P, mm, R, a, b, esp):
    """Barra de moldura de a até b (pontos no referencial R), de seção esp × esp, saliente da face"""
    a, b = Vector(a), Vector(b)
    c = (a + b) / 2
    d = b - a
    sx, sz = max(abs(d.x), esp), max(abs(d.z), esp)
    P.juntar(bm_caixa(sx, esp, sz), mm, R @ Matrix.Translation((c.x, c.y, c.z - sz / 2)))


def imagens(M):
    """
    As quatro imagens do cruzeiro (ficha), no mesmo granito: o Cristo crucificado na face sul da cruz, Nossa Senhora
    da Assunção na face norte, Santiago peregrino (chapéu de aba larga e bordão) no lado oeste do capitel e São José
    (com o Menino no braço e a vara florida) no lado leste. Volumes simples, silhueta legível de longe.
    """
    P = Peca("Cruzeiro_Imagens")
    G = M["granito"]
    # Cristo: braços abertos ao longo dos braços da cruz, cabeça pendida, pés sobre o apoio
    Hc = 1.86
    pes = Z0 + Z_CRUZ + 0.16
    Mc = T(0, -0.36, pes, -90.0)
    f = Figura(P, G, Mc, Hc, ombro=0.11, quadril=0.056)
    f.tronco(peito=0.098, cintura=0.074, ancas=0.088, prof=0.6)
    f.cabeca(inclina=24.0, giro=-14.0)
    for lado in (-1, 1):
        f.perna(lado, (0.03, lado * 0.022), joelho_polo=(1, 0, 0), r_coxa=0.06, r_canela=0.043)
        f.braco(lado, Vector((lado * 0.84, -0.3, Z0 + Z_BRACOS + 0.1)), polo=(0, 0, -1), r=0.034)
    # perizônio (pano da cintura)
    P.juntar(bm_torno([(0.0, -0.11 * Hc), (0.105 * Hc, -0.1 * Hc), (0.1 * Hc, 0.0), (0.0, 0.01 * Hc)], 10), G,
             Mc @ Matrix.Translation((0, 0, f.z_quadril + 0.02 * Hc)) @ Matrix.Diagonal((0.62, 1.0, 1.0, 1.0)), liso=True)
    # Nossa Senhora da Assunção: de frente para o norte, mãos postas, sobre a ménsula
    Hv = 1.5
    w = figura_vestida(P, G, T(0, 0.44, Z0 + Z_CRUZ + 0.26, 90.0), Hv)
    for lado in (-1, 1):
        manga(P, G, w, (0.0, lado * 0.105, 0.77), (0.15, lado * 0.02, 0.62), Hv)
    P.juntar(bm_esfera(0.085 * Hv, 2), G, Matrix.Translation(w(-0.02, 0, 0.935)) @ Matrix.Diagonal((1.0, 1.15, 1.1, 1.0)), liso=True)  # véu
    # Santiago peregrino (lado oeste do capitel): chapéu de aba larga e o bordão na mão direita
    Hs = 1.2
    w = figura_vestida(P, G, T(-0.8, 0, Z0 + Z_CAPITEL - 0.12 + 0.2, 180.0), Hs)
    P.juntar(bm_cilindro(0.15 * Hs, 0.018 * Hs, 12), G, Matrix.Translation(w(0.0, 0.0, 0.985)))
    P.juntar(bm_cilindro(0.07 * Hs, 0.06 * Hs, 10, r2=0.06 * Hs), G, Matrix.Translation(w(0.0, 0.0, 1.0)))
    barra(P, w(0.1, -0.2, 0.0), w(0.1, -0.2, 1.12), 0.07, G)
    manga(P, G, w, (0.0, -0.11, 0.77), (0.1, -0.19, 0.62), Hs)
    manga(P, G, w, (0.0, 0.11, 0.77), (0.13, 0.05, 0.6), Hs)
    # São José (lado leste do capitel): o Menino no braço esquerdo e a vara florida na direita
    w = figura_vestida(P, G, T(0.8, 0, Z0 + Z_CAPITEL - 0.12 + 0.2, 0.0), Hs)
    barra(P, w(0.1, -0.2, 0.0), w(0.1, -0.2, 1.04), 0.07, G)
    P.juntar(bm_esfera(0.07 * Hs, 1), G, Matrix.Translation(w(0.1, -0.2, 1.08)), liso=True)
    manga(P, G, w, (0.0, -0.11, 0.77), (0.1, -0.19, 0.6), Hs)
    manga(P, G, w, (0.0, 0.11, 0.77), (0.14, 0.02, 0.64), Hs)
    P.juntar(membro(0.06 * Hs, 0.045 * Hs, 0.16 * Hs, 8), G, alinhar(w(0.14, 0.07, 0.6), w(0.15, 0.05, 0.76)), liso=True)
    P.juntar(bm_esfera(0.05 * Hs, 1), G, Matrix.Translation(w(0.15, 0.05, 0.82)), liso=True)
    crescer(P)
    return P.criar()


# ———————————————————————————————————————————————— chão: praça, canteiro, faixa dos quiosques, areia, rio e mar, quadra, rua

def chao(M):
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["praca"], M["meiofio"]])
    g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, mm, z=0.012, lados=None):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.06)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=1), [mm, lados or mm])
        return poli

    # faixa dos quiosques entre a praça e o rio, com o meio-fio na divisa
    placa(ret(X_RIO, RUA_Y1 + CALCADA_RUA, X_PRACA_O, 18.6), M["calcadao"], 0.014)
    meia = (18.0 - (ESTAC[3] + 0.3)) / 2
    pisos.juntar(bm_caixa(0.24, 2 * meia, 0.12), M["meiofio"], T(X_PRACA_O, ESTAC[3] + 0.3 + meia, Z0 - 0.01))
    # Rua José Roberto Sales (piso intertravado), a calçada e o meio-fio, e o estacionamento da orla
    placa(ret(-40, RUA_Y0 - 9, 40, RUA_Y1), M["rua"], 0.006)
    placa(ret(-40, RUA_Y1, 40, RUA_Y1 + CALCADA_RUA), M["calcadao"], 0.15, M["meiofio"])
    for i in range(-12, 12):
        x0 = i * 3.4
        placa(ret(x0, (RUA_Y0 + RUA_Y1) / 2 - 0.07, x0 + 1.9, (RUA_Y0 + RUA_Y1) / 2 + 0.07), M["faixa"], 0.012)
    ex0, ey0, ex1, ey1 = ESTAC
    placa(ret(ex0, ey0, ex1, ey1), M["rua"], 0.02)
    for k in range(5):
        x = ex0 + 0.1 + k * (ex1 - ex0 - 0.2) / 4
        placa(ret(x - 0.06, ey0 + 1.4, x + 0.06, ey1 - 0.1), M["faixa"], 0.028)
    pisos.juntar(bm_caixa(ex1 - ex0 + 0.3, 0.2, 0.15), M["meiofio"], T((ex0 + ex1) / 2, ey1 + 0.1, Z0 - 0.01))
    reservar(ret(-40, RUA_Y0 - 9, 40, RUA_Y1 + 0.4), 0.0)
    reservar(ret(ex0, ey0, ex1, ey1 + 0.2), 0.3)
    # canteiro de grama com o meio-fio de granito e o caminho de piso até os degraus
    pisos.juntar(bm_prisma(circulo(64, R_CANTEIRO + 0.32), Z0 - 0.01, Z0 + 0.24, 0.04, mat_lados=1), [M["granito"], M["granito"]])
    pisos.juntar(bm_prisma(circulo(64, R_CANTEIRO), Z0 + 0.1, Z0 + 0.25, 0.0, mat_lados=1), [M["grama"], M["grama"]])
    pisos.juntar(bm_prisma(ret(-0.8, -R_CANTEIRO - 0.4, 0.8, -3.5), Z0 + 0.1, Z0 + 0.265, 0.0, mat_lados=1), [M["praca"], M["meiofio"]])
    reservar(circulo(32, R_CANTEIRO + 0.4), 0.3)
    # quadra poliesportiva: borda de concreto, piso pintado e as linhas (quadra de futsal, OSM sport=multi)
    qx0, qy0, qx1, qy1 = QUADRA
    placa(ret(qx0 - 0.7, qy0 - 0.7, qx1 + 0.7, qy1 + 0.7), M["quadra_borda"], 0.03)
    placa(ret(qx0, qy0, qx1, qy1), M["quadra"], 0.045)
    e, zl = 0.09, 0.055
    for a, b, c, d in ((qx0, qy0, qx1, qy0 + e), (qx0, qy1 - e, qx1, qy1), (qx0, qy0, qx0 + e, qy1), (qx1 - e, qy0, qx1, qy1)):
        placa(ret(a, b, c, d), M["faixa"], zl)
    cy = (qy0 + qy1) / 2
    cx = (qx0 + qx1) / 2
    placa(ret(qx0, cy - e / 2, qx1, cy + e / 2), M["faixa"], zl)
    anel = lambda r0, r1, a0, a1, cx_, cy_: [(cx_ + r1 * math.cos(math.radians(a0 + (a1 - a0) * i / 16)), cy_ + r1 * math.sin(math.radians(a0 + (a1 - a0) * i / 16))) for i in range(17)] + \
        [(cx_ + r0 * math.cos(math.radians(a1 - (a1 - a0) * i / 16)), cy_ + r0 * math.sin(math.radians(a1 - (a1 - a0) * i / 16))) for i in range(17)]
    for a0 in (0, 180):
        pisos.juntar(bm_prisma(anel(1.5, 1.5 + e, a0, a0 + 180, cx, cy), Z0, Z0 + zl, 0.0, mat_lados=1), M["faixa"])
    for s, yb in ((1, qy0), (-1, qy1)):
        pisos.juntar(bm_prisma(anel(2.9, 2.9 + e, 0 if s > 0 else 180, 180 if s > 0 else 360, cx, yb), Z0, Z0 + zl, 0.0, mat_lados=1), M["faixa"])
    reservar(ret(qx0 - 0.9, qy0 - 0.9, qx1 + 0.9, qy1 + 0.9), 0.0)
    # areia (seca e molhada), o mar e o rio até a borda
    n = 60
    xs = [X_RIO + (44 - X_RIO) * i / n for i in range(n + 1)]
    placa([(x, interp(BORDA_AREIA, x)) for x in xs] + [(x, linha_mar(x) - 1.4) for x in reversed(xs)], M["areia"], 0.03)
    placa([(x, linha_mar(x) - 1.4) for x in xs] + [(x, linha_mar(x)) for x in reversed(xs)], M["molhada"], 0.026)
    placa([(-40, -40), (X_RIO, -40)] + [(x, linha_mar(x)) for x in xs] + [(44, 40), (-40, 40)], M["agua"], 0.018)
    reservar([(x, linha_mar(x) - 0.4) for x in xs] + [(44, 40), (-40, 40)], 0.0)
    reservar(ret(-40, -40, X_RIO + 1.4, 40), 0.0)
    pisos.criar()


def espuma(M):
    """Espuma da arrebentação ao longo da linha d'água e das ondas mais longe"""
    P = Peca("Mar_Espuma")
    for k, (dy, larg) in enumerate(((0.05, 0.42), (1.9, 0.3), (4.2, 0.26))):
        pts_a, pts_b = [], []
        for i in range(70):
            x = X_RIO + 1.0 + (44 - X_RIO) * i / 69
            y = linha_mar(x) + dy + 0.25 * math.sin(x * 0.5 + k * 2.1)
            w = larg * (0.55 + 0.45 * abs(math.sin(x * 0.23 + k)))
            if math.hypot(x, y + w) > RAIO - 0.4:
                pts_a.append(None)
                pts_b.append(None)
                continue
            pts_a.append((x, y, Z0 + 0.03))
            pts_b.append((x, y + w, Z0 + 0.03))
        for i in range(len(pts_a) - 1):
            if pts_a[i] is None or pts_a[i + 1] is None or math.sin(pts_a[i][0] * 0.37 + k * 1.3) < -0.55:
                continue
            P.poli([pts_a[i], pts_a[i + 1], pts_b[i + 1], pts_b[i]], M["espuma"])
    return P.criar()


# ———————————————————————————————————————————————— enrocamento, barcos e jangada

def enrocamento(M):
    """
    Enrocamento da margem do rio (OSM man_made=breakwater, x ≈ −62 m): blocos de pedra irregulares ao longo da margem e
    o trecho que entra no mar na ponta noroeste; três tons de pedra pelas cores de vértice.
    """
    P = Peca("Enrocamento")
    rnd = random.Random(1604)
    tons = ["#9a938a", "#7d766e", "#8f8576"]
    pontos = []
    y = -RAIO
    while y < 26.0:
        x = X_RIO + (0.9 * (y - 19.5) * 0.25 if y > 19.5 else 0.0)
        pontos.append((x, y))
        y += 0.55
    for x0, y0 in pontos:
        for _ in range(3):
            x = x0 + rnd.uniform(-1.0, 0.9)
            yy = y0 + rnd.uniform(-0.3, 0.3)
            r = rnd.uniform(0.38, 0.62)
            if math.hypot(x, yy) > RAIO - 0.2 - r:
                continue
            bm = bm_esfera(1.0, 0)
            for v in bm.verts:
                v.co *= rnd.uniform(0.8, 1.15)
            bm.transform(Matrix.Diagonal((r * rnd.uniform(0.9, 1.4), r * rnd.uniform(0.9, 1.3), r * rnd.uniform(0.55, 0.8), 1)))
            alt = Z0 + rnd.uniform(-0.15, 0.25) - (0.25 if x < X_RIO - 0.4 else 0.0)
            P.juntar(bm, tinta(M["pedra"], tons[rnd.randrange(3)]), T(x, yy, alt, rnd.uniform(0, 360)))
    for v in P.bm.verts:                     # nada abaixo do pé do modelo (y = 0 no three)
        v.co.z = max(v.co.z, 0.0)
    return P.criar()


def barcos(M):
    """Dois barcos de passeio/pesca no rio (passeio de barco: ficha) e uma jangada na areia da ponta (ambientação)"""
    P = Peca("Barcos")
    casco = [(-2.1, -0.62), (1.3, -0.68), (2.25, 0.0), (1.3, 0.68), (-2.1, 0.62)]
    for (x, y, giro, cor) in ((-28.6, -6.4, 96.0, "#2f6db0"), (-29.4, 5.2, 84.0, "#c8463c")):
        R_ = T(x, y, Z0 - 0.06, giro)
        P.juntar(bm_prisma(casco, 0.0, 0.62, 0.04, mat_lados=1), [M["madeira_esc"], tinta(M["barco"], "#f2f0ea")], R_)
        P.juntar(bm_prisma([(a * 0.96, b * 1.04) for a, b in casco], 0.36, 0.5, 0.0, mat_lados=1), [tinta(M["barco"], cor), tinta(M["barco"], cor)], R_)
        P.juntar(bm_caixa(1.3, 1.1, 0.75, 0.04), M["parede"], R_ @ T(-0.5, 0, 0.5))
        P.juntar(bm_caixa(1.6, 1.4, 0.08), tinta(M["barco"], cor), R_ @ T(-0.5, 0, 1.25))
        reservar(ret(x - 2.4, y - 2.4, x + 2.4, y + 2.4), 0.2)
    # jangada na areia (mastro e vela enrolada)
    x, y, giro = -15.4, 22.0, 70.0
    R_ = T(x, y, Z0 + 0.03, giro)
    jg = [(-2.6, -0.75), (1.7, -0.75), (2.7, 0.0), (1.7, 0.75), (-2.6, 0.75)]
    P.juntar(bm_prisma(jg, 0.04, 0.4, 0.0, mat_lados=1), [M["madeira"], M["madeira_esc"]], R_)
    P.juntar(bm_caixa(0.65, 1.4, 0.32), M["madeira"], R_ @ T(-1.2, 0, 0.4))
    barra(P, R_ @ Vector((1.8, 0.32, 0.8)), R_ @ Vector((-2.4, 0.32, 0.8)), 0.12, M["madeira"])
    P.juntar(membro(0.2, 0.16, 3.3, 8), M["vela"], alinhar(R_ @ Vector((1.4, 0.32, 0.95)), R_ @ Vector((-2.0, 0.32, 0.95))), liso=True)
    reservar(ret(x - 3.0, y - 2.0, x + 3.0, y + 2.0), 0.2)
    return P.criar()


# ———————————————————————————————————————————————— quiosques, torre de salvamento, barracas, mercado

def hexagono(r, giro=0.0):
    return [(r * math.cos(math.radians(60 * i + giro)), r * math.sin(math.radians(60 * i + giro))) for i in range(6)]


def quiosques(M):
    """
    Os três quiosques hexagonais da faixa entre a praça e o rio (OSM shop=kiosk, ~9 m): piso elevado, paredes brancas,
    balcão com o vão de atendimento nas três faces voltadas para a praça, telhado piramidal de metal com testeira e
    pináculo (cores neutras: não confirmadas).
    """
    P = Peca("Quiosques")
    r = R_QUIOSQUE
    for qx, qy in QUIOSQUES:
        R_ = T(qx, qy, Z0)
        P.juntar(bm_prisma(hexagono(r + 0.35, 30), 0.0, 0.16, 0.04, mat_lados=1), [M["calcadao"], M["meiofio"]], R_)
        P.juntar(bm_prisma(hexagono(r, 30), 0.16, 2.5, 0.0, mat_lados=1), [M["parede"], M["parede"]], R_)
        # vãos de atendimento e balcões de madeira nas três faces voltadas para a praça (normais a −60°, 0° e 60°)
        ap = r * math.cos(math.radians(30))
        for fi in (-60, 0, 60):
            c, s_ = math.cos(math.radians(fi)), math.sin(math.radians(fi))
            pt = lambda t, z: tuple(R_ @ Vector(((ap + 0.02) * c - t * s_, (ap + 0.02) * s_ + t * c, z)))
            P.poli([pt(-0.38 * r, 1.05), pt(0.38 * r, 1.05), pt(0.38 * r, 2.15), pt(-0.38 * r, 2.15)], M["escuro"])
            P.juntar(bm_caixa(0.42, 0.85 * r, 0.08), M["madeira"], R_ @ T((ap + 0.2) * c, (ap + 0.2) * s_, 1.0, fi))
        # telhado piramidal com beiral, testeira e pináculo
        P.juntar(bm_prisma(hexagono(r + 0.6, 30), 2.5, 2.68, 0.0, mat_lados=1), [M["cobertura"], M["parede"]], R_)
        bm = bmesh.new()
        base = [bm.verts.new((x, y, 2.68)) for x, y in hexagono(r + 0.6, 30)]
        topo = bm.verts.new((0, 0, 3.95))
        for i in range(6):
            bm.faces.new([base[i], base[(i + 1) % 6], topo])
        bm.faces.new(list(reversed(base)))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        P.juntar(bm, M["cobertura"], R_)
        P.juntar(bm_cilindro(0.09, 0.5, 6, r2=0.03), M["poste"], R_ @ T(0, 0, 3.9))
        reservar([(qx + x, qy + y) for x, y in hexagono(r + 0.6, 30)], 0.5)
    return P.criar()


def torre_salvamento(M):
    """Torre de Salvamento Aquático, Posto 1 (OSM): cabine sobre quatro pernas, guarda-corpo, cobertura e escada"""
    P = Peca("Torre_Salvamento")
    tx, ty = TORRE
    R_ = T(tx, ty, Z0)
    for sx in (-0.8, 0.8):
        for sy in (-0.7, 0.7):
            barra(P, R_ @ Vector((sx, sy, 0.0)), R_ @ Vector((sx * 0.86, sy * 0.86, 2.3)), 0.14, M["poste"])
    P.juntar(bm_caixa(2.5, 2.2, 0.16, 0.03), M["madeira_esc"], R_ @ T(0, 0, 2.3))
    P.juntar(bm_caixa(1.7, 1.5, 1.7, 0.04), M["parede"], R_ @ T(0, 0, 2.46))
    # janelas em faixa nas quatro faces (vidro escuro) e guarda-corpo do lado do mar e do rio
    for giro in (0, 90, 180, 270):
        lado = 1.7 if giro % 180 == 0 else 1.5
        prof = 0.75 if giro % 180 == 0 else 0.85
        P.juntar(bm_caixa(lado * 0.8, 0.04, 0.6), M["escuro"], R_ @ T(0, 0, 0, giro) @ T(0, -prof - 0.01, 3.3))
    P.juntar(bm_caixa(2.5, 0.06, 0.9), M["parede"], R_ @ T(0, 1.07, 2.46))
    P.juntar(bm_caixa(0.06, 2.2, 0.9), M["parede"], R_ @ T(-1.22, 0, 2.46))
    P.juntar(bm_caixa(2.4, 2.2, 0.14, 0.03), M["cobertura"], R_ @ T(0, 0, 4.16))
    # escada pelo lado leste (da praça)
    a0, a1 = R_ @ Vector((2.3, -0.35, 0.0)), R_ @ Vector((1.2, -0.35, 2.36))
    b0, b1 = R_ @ Vector((2.3, 0.35, 0.0)), R_ @ Vector((1.2, 0.35, 2.36))
    barra(P, a0, a1, 0.07, M["poste"])
    barra(P, b0, b1, 0.07, M["poste"])
    for k in range(1, 6):
        t = k / 6
        barra(P, a0.lerp(a1, t), b0.lerp(b1, t), 0.05, M["poste"])
    reservar(ret(tx - 1.4, ty - 1.3, tx + 2.5, ty + 1.3), 0.3)
    return P.criar()


def barracas(M):
    """
    Barracas da praia a nordeste (OSM: construções de 1 pavimento, 3,6–3,8 m): salão de paredes brancas com o vão escuro
    para o mar, varanda de deque com pilares e o telhado de duas águas de fibrocimento cobrindo os dois (forma neutra).
    """
    P = Peca("Barracas")
    for bx, by, lw, fd in BARRACAS:
        R_ = T(bx, by, Z0, GIRO_PRAIA)
        fs = fd * 0.55                         # salão (lado da praça); a varanda fica do lado do mar (+y local)
        y_sal = -fd / 2 + fs / 2
        P.juntar(bm_caixa(lw, fd, 0.18, 0.03), M["madeira_esc"], R_)
        P.juntar(bm_caixa(lw, fs, 2.75, 0.04), M["parede"], R_ @ T(0, y_sal, 0.18))
        P.juntar(bm_caixa(lw - 1.6, 0.04, 1.6), M["escuro"], R_ @ T(0, y_sal + fs / 2 + 0.02, 0.8))
        for k in range(4):
            x = -lw / 2 + 0.3 + k * (lw - 0.6) / 3
            P.juntar(bm_caixa(0.18, 0.18, 2.6), M["madeira"], R_ @ T(x, fd / 2 - 0.3, 0.18))
        # telhado de duas águas, cumeeira ao longo do comprimento
        h0, h1 = 2.95, 3.65
        yb0, yb1 = -fd / 2 - 0.5, fd / 2 + 0.5
        ym = (yb0 + yb1) / 2
        for ya, za in ((yb0, h0), (yb1, h0)):
            vs = [R_ @ Vector((-lw / 2 - 0.4, ya, za)), R_ @ Vector((lw / 2 + 0.4, ya, za)), R_ @ Vector((lw / 2 + 0.4, ym, h1)), R_ @ Vector((-lw / 2 - 0.4, ym, h1))]
            bm = bmesh.new()
            vv = [bm.verts.new(v) for v in vs]
            bm.faces.new(vv)
            r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
            for v in [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]:
                v.co.z -= 0.1
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            P.juntar(bm, M["telha"])
        # oitões (empenas) fechando o triângulo entre a parede e o telhado, nas duas pontas
        for s in (-1, 1):
            vs = [R_ @ Vector((s * lw / 2, yb0 + 0.5, 2.93)), R_ @ Vector((s * lw / 2, yb1 - 0.5, 2.93)), R_ @ Vector((s * lw / 2, ym, h1 - 0.12))]
            P.poli([tuple(v) for v in (vs if s > 0 else vs[::-1])], M["parede"])
        reservar(ret_girado(bx, by, lw + 1.0, fd + 1.2, GIRO_PRAIA), 0.3)
    return P.criar()


def mercado(M):
    """Mercado Vila do Mar (OSM shop=craft, 11 × 7 m): bloco térreo branco, portas para a praça e laje com beiral"""
    P = Peca("Mercado_Vila_do_Mar")
    cx, cy, lw, fd, h = MERCADO
    R_ = T(cx, cy, Z0)
    P.juntar(bm_caixa(lw + 0.6, fd + 0.6, 0.16, 0.03), M["calcadao"], R_)
    P.juntar(bm_caixa(lw, fd, h - 0.3, 0.05), M["parede"], R_ @ T(0, 0, 0.16))
    for s in (-1, 1):
        for k in range(3):
            x = -lw / 2 + 1.3 + k * (lw - 2.6) / 2
            P.juntar(bm_caixa(1.4, 0.04, 2.1), M["escuro"], R_ @ T(x, s * (fd / 2 + 0.01), 0.16))
    P.juntar(bm_caixa(lw + 1.0, fd + 1.0, 0.22, 0.04), M["cobertura"], R_ @ T(0, 0, h - 0.14))
    P.juntar(bm_caixa(lw + 1.04, fd + 1.04, 0.1), M["parede"], R_ @ T(0, 0, h - 0.18))
    reservar(ret(cx - lw / 2 - 0.6, cy - fd / 2 - 0.6, cx + lw / 2 + 0.6, cy + fd / 2 + 0.6), 0.3)
    return P.criar()


# ———————————————————————————————————————————————— postes, bancos, traves e refletores

def mobiliario(M):
    """Postes de luz da praça e da orla, bancos de granito em volta do canteiro, traves e refletores da quadra"""
    P = Peca("Mobiliario")
    postes = [(X_PRACA_O - 0.6, y) for y in (3.7, -7.0, -17.5)]
    postes += [(-11.0, 18.9), (-1.0, 17.1), (6.0, 14.2), (15.5, 9.3), (27.0, 4.2)]
    postes += [(x, RUA_Y1 + 0.8) for x in (-16.0, 2.0, 16.0)]
    for x, y in postes:
        if math.hypot(x, y) > RAIO - 1.0:
            continue
        P.juntar(bm_cilindro(0.16, 0.45, 8, r2=0.12), M["poste"], T(x, y, Z0))
        P.juntar(bm_cilindro(0.07, 4.6, 8, r2=0.05), M["poste"], T(x, y, Z0 + 0.45))
        P.juntar(bm_cilindro(0.2, 0.12, 8, r2=0.12), M["poste"], T(x, y, Z0 + 5.0))
        P.juntar(bm_torno([(0.0, 0.0), (0.18, 0.05), (0.26, 0.3), (0.2, 0.55), (0.0, 0.62)], 10), M["globo"], T(x, y, Z0 + 5.05), liso=True)
        reservar(ret(x - 0.3, y - 0.3, x + 0.3, y + 0.3), 0.3)
    # bancos de granito virados para o cruzeiro (o lado sul fica livre para o caminho)
    for a in (0, 62, 118, 180):
        x, y = 8.0 * math.cos(math.radians(a)), 8.0 * math.sin(math.radians(a))
        R_ = T(x, y, Z0, a + 90)
        P.juntar(bm_caixa(2.4, 0.62, 0.44, 0.05), M["granito"], R_)
        reservar(ret(x - 1.3, y - 1.3, x + 1.3, y + 1.3), 0.2)
    # traves de futsal (3 × 2 m reais → 2,4 × 1,5 m) e os quatro refletores da quadra (OSM lit=yes)
    qx0, qy0, qx1, qy1 = QUADRA
    cx = (qx0 + qx1) / 2
    for yb, s in ((qy0, -1), (qy1, 1)):
        for dx in (-1.2, 1.2):
            barra(P, Vector((cx + dx, yb, Z0)), Vector((cx + dx, yb, Z0 + 1.55)), 0.1, M["trave"])
        barra(P, Vector((cx - 1.25, yb, Z0 + 1.55)), Vector((cx + 1.25, yb, Z0 + 1.55)), 0.1, M["trave"])
        for dx in (-1.2, 1.2):
            barra(P, Vector((cx + dx, yb, Z0 + 1.5)), Vector((cx + dx, yb + s * 0.8, Z0)), 0.05, M["poste"])
    for x in (qx0 - 0.75, qx1 + 0.75):
        for y in (qy0 + 2.8, qy1 - 2.8):
            P.juntar(bm_cilindro(0.13, 8.2, 8, r2=0.09), M["poste"], T(x, y, Z0))
            s = 1 if x < cx else -1
            P.juntar(bm_caixa(0.3, 1.2, 0.6, 0.03), M["poste"], T(x + s * 0.25, y, Z0 + 8.0))
            P.juntar(bm_caixa(0.05, 1.05, 0.45), M["globo"], T(x + s * 0.42, y, Z0 + 8.08))
    return P.criar()


# ———————————————————————————————————————————————— coqueiros, gente e carros (layout para o .tsx)

def layout():
    rnd = random.Random(2004)   # ano do cruzeiro

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.5 - r * 0.8:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    coqueiros = []
    for x, y in ((-12.6, 15.6), (14.2, 7.6), (27.6, 1.4), (-19.6, 4.2), (-19.4, -6.8), (-19.6, -17.0),
                 (-19.0, 19.6), (16.2, 18.8), (26.2, 12.8)):
        if math.hypot(x, y) + 3.6 < RAIO and livre(x, y, 0.2):
            coqueiros.append((x, y, rnd.uniform(6.4, 8.4), rnd.uniform(0, 360), rnd.uniform(0.05, 0.17)))
    pessoas = []   # (x, y, z, giro, cor)

    def semear(cx, cy, ax, ay, n, z, cond=None, olhar=None):
        k = tent = 0
        while k < n and tent < 1500:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1.0:
                continue
            if cond is not None and not cond(x, y):
                continue
            if cond is None and any(dist_poligono((x, y), poli) < 0.25 for poli, _ in LIVRE_POLIS):
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.8 for p in pessoas):
                continue
            g = math.degrees(math.atan2(-y, -x)) + rnd.uniform(-35, 35) if olhar else rnd.uniform(0, 360)
            pessoas.append((x, y, z, g, rnd.randrange(6)))
            k += 1

    praca_livre = lambda x, y: not any(dist_poligono((x, y), poli) < 0.25 for poli, _ in LIVRE_POLIS)
    # visitantes em volta do canteiro, olhando para o cruzeiro, e no caminho
    semear(0, 0, 11.0, 11.0, 12, Z0, lambda x, y: 6.9 < math.hypot(x, y) < 11.0 and praca_livre(x, y), olhar=True)
    semear(0, -5.0, 0.5, 0.8, 2, Z0 + 0.265, lambda x, y: True, olhar=True)
    # a praça, a faixa dos quiosques, a areia, a quadra e a calçada
    semear(-2, -6, 14, 12, 16, Z0)
    semear(-20.5, -2, 2.6, 16, 6, Z0 + 0.014, lambda x, y: X_RIO + 1.6 < x < X_PRACA_O - 0.4 and praca_livre(x, y))
    semear(6, 20, 26, 8, 10, Z0 + 0.03, lambda x, y: interp(BORDA_AREIA, x) + 0.6 < y < linha_mar(x) - 0.4 and x > X_RIO + 2
           and not any(dist_poligono((x, y), poli) < 0.2 for poli, f in LIVRE_POLIS if f in (0.2, 0.3)))
    qx0, qy0, qx1, qy1 = QUADRA
    semear((qx0 + qx1) / 2, (qy0 + qy1) / 2, 4.6, 7.2, 8, Z0 + 0.045, lambda x, y: True)
    semear(0, RUA_Y1 + 0.8, 18, 0.4, 3, Z0 + 0.15, lambda x, y: True)
    carros = []   # (x, y, giro, cor)
    for x, k in ((-20.5, 0), (-18.5, 3), (-14.5, 5)):
        carros.append((x, (ESTAC[1] + ESTAC[3]) / 2 + 0.5, 90.0, k))
    ym = (RUA_Y0 + RUA_Y1) / 2
    for x, faixa, k in ((-9.0, 1.5, 2), (6.5, -1.5, 1), (14.0, 1.5, 4)):
        y = ym + faixa
        if math.hypot(x, y) < RAIO - 2.2:
            carros.append((x, y, 180.0 if faixa > 0 else 0.0, k))
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


# ———————————————————————————————————————————————— oclusão assada e tintas

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

def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    chao(M)
    esp = espuma(M)
    obs = [cruzeiro(M), imagens(M), enrocamento(M), barcos(M), quiosques(M), torre_salvamento(M), barracas(M), mercado(M), mobiliario(M)]
    coqueiros, pessoas, carros = layout()
    print(f"coqueiros {len(coqueiros)}, pessoas {len(pessoas)}, carros {len(carros)}")
    prox = proxies(coqueiros, carros)
    chao_objs = [bpy.data.objects[n] for n in ("Chao_Base", "Chao_Pisos")] + [esp]
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
        ang = 62 if ob.name == "Cruzeiro_Imagens" else (20 if ob.name == "Enrocamento" else 32)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(ang), keep_sharp_edges=True)
    for nome in list(bpy.data.materials.keys()):
        if nome.startswith("Mat_Proxy") or nome.startswith("Tinta__"):
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
        "pessoas": [[tres(x, y)[0], round(z, 3), tres(x, y)[1], round(math.radians(g), 3), k] for x, y, z, g, k in pessoas],
        "carros": [[*tres(x, y), round(math.radians(g), 3), k] for x, y, g, k in carros],
        "chao": {"lado": LADO_AO, "z0": Z0},
        "alturas": {"topo": round(Z0 + (Z_TOPO + 0.44) * ESC, 2)},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
