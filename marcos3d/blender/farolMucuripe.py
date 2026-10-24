# -*- coding: utf-8 -*-
"""
Farol do Mucuripe (Farol Velho, 1840–1846) em miniatura: gera as peças estáticas do marco no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/farolMucuripe.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/farolMucuripe.py --sem-bake   # rápido, sem oclusão (para conferir forma)
    FAROL_DEPURAR=<arquivo.json> ...                                 # grava reservas, casas e frentes (planta de conferência)

Saídas em marcos3d/blender/saida/ (o FarolMucuripe.tsx carrega as três):
    farolMucuripe-pecas.glb     chão, platô murado com a escadaria, farol, casario do Serviluz, praia com pedras e
                                jangadas, mar e o muro do porto com contêineres (sem compressão, oclusão nas cores de vértice)
    farolMucuripe-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    farolMucuripe-layout.json   coqueiros, árvores, pessoas e carros (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-farolMucuripe.md): rumo real, sem giro (x = leste, y = norte no Blender; norte
em −z no three). As câmeras da oficina vêm do sul, então o farol aparece com o mar ao fundo, que fica a NNE.
- O farol é o protagonista e foi AMPLIADO: planta × 1,25 (octógono do OSM de ~10 m → 12,4 m entre faces) e alturas
  ~1,7× (OSM h 11,8 m → ~20 m acima do platô), para ler como farol a ~200 px.
- O entorno do OSM (pesquisa/farolMucuripe/osm.xml) entra por compressão radial a partir do farol: r' = 0,5·r até 36 m
  (o recinto murado de ~33 m vira ~17 m) e r' = 18 + 0,42·(r − 36) depois (casario até ~72 m). Casas do OSM viram
  retângulos orientados × 0,6; ruas do OSM seguem a mesma compressão.
- O mar (costa real a ~93 m na direção NNE) é condensado num segmento do disco: linha d'água a 24,5 m da origem na
  normal da costa real (rumo ~35°), com areia, pedras e jangadas antes dela.
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
from mathutils.geometry import delaunay_2d_cdt

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")
OSM = os.path.join(AQUI, "..", "pesquisa", "farolMucuripe", "osm.xml")
PREFIXO = "farolMucuripe"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do chão da rua: tudo fora do platô pousa aqui
H_PLATO = 1.6        # o platô do farol fica acima da rua (OSM: escadaria a oeste; o terreno é ~24 m acima do mar)
ZP = Z0 + H_PLATO    # topo do platô
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
LAT0, LNG0 = -3.7078217, -38.4704039

# ——— mar: normal da costa real (rumo ~35°, para o mar) e distância da linha d'água na miniatura
N_MAR = Vector((0.582, 0.813)).normalized()
T_MAR = Vector((-N_MAR.y, N_MAR.x))   # ao longo da costa, apontando para oés-noroeste
D_AREIA = 19.4                         # começo da faixa de areia
D_AGUA = 24.5                          # linha d'água

# ——— farol (medidas da miniatura, a partir do topo do platô)
R_CORPO = 6.7        # raio do octógono do corpo (circunscrito): 12,4 m entre faces (OSM ~10 m × 1,25)
H_SOCO = 0.8
H_CORPO = 6.55       # topo do corpo = piso do terraço com as ameias
R_TORRE0, R_TORRE1 = 2.706, 2.381   # torre octogonal afunilando: 5,0 → 4,4 m entre faces (OSM parte central ~3,2 m)
H_TORRE = 15.4
H_GALERIA = 15.92    # piso da varanda da lanterna
R_GALERIA = 3.15


def dist_mar(x, y):
    return x * N_MAR.x + y * N_MAR.y


# ———————————————————————————————————————————————— utilidades de plano

def circulo(n=96, r=RAIO):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def area(poli):
    return 0.5 * sum(poli[i][0] * poli[(i + 1) % len(poli)][1] - poli[(i + 1) % len(poli)][0] * poli[i][1] for i in range(len(poli)))


def anti_horario(poli):
    return poli if area(poli) > 0 else poli[::-1]


def cortar_semiplano(poli, n, d, maior=True):
    """Sutherland–Hodgman contra o semiplano n·p ≥ d (maior) ou n·p ≤ d"""
    def dentro(p):
        v = p[0] * n[0] + p[1] * n[1] - d
        return v >= 0 if maior else v <= 0
    out = []
    for i in range(len(poli)):
        p, q = poli[i], poli[(i + 1) % len(poli)]
        dp, dq = dentro(p), dentro(q)
        if dp:
            out.append(p)
        if dp != dq:
            vp = p[0] * n[0] + p[1] * n[1] - d
            vq = q[0] * n[0] + q[1] * n[1] - d
            t = vp / (vp - vq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def recortar_no_disco(poli, r=RAIO, n=96):
    c = circulo(n, r)
    out = list(poli)
    for i in range(n):
        if len(out) < 3:
            return []
        a, b = c[i], c[(i + 1) % n]
        nx, ny = -(b[1] - a[1]), b[0] - a[0]          # normal para dentro (círculo anti-horário)
        out = cortar_semiplano(out, (nx, ny), nx * a[0] + ny * a[1], True)
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
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy + 1e-12)))
        m = min(m, math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    return m


def ret(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def octogono(r, giro=22.5):
    """Octógono de raio circunscrito r; com giro 22,5° as faces olham para L, NE, N, NO, O, SO, S e SE"""
    return [(r * math.cos(math.radians(giro + 45 * k)), r * math.sin(math.radians(giro + 45 * k))) for k in range(8)]


def comprimir(x, y):
    """Compressão radial do entorno real (OSM, metros) para a miniatura (ver docstring)"""
    r = math.hypot(x, y)
    if r < 1e-6:
        return 0.0, 0.0
    rr = 0.5 * r if r <= 36 else 18.0 + 0.42 * (r - 36)
    return x * rr / r, y * rr / r


LIVRE = []   # (polígono, folga): onde não nasce casa, árvore nem gente


def reservar(poli, folga=0.3):
    LIVRE.append((poli, folga))


def livre(x, y, folga=0.0):
    if math.hypot(x, y) > RAIO - 0.6 - folga:
        return False
    for poli, f in LIVRE:
        if dist_poligono((x, y), poli) < f + folga:
            return False
    return True


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

    def criar(self, soldar=True):
        me = bpy.data.meshes.new(self.nome)
        if soldar:
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
    if chanfro > 0 and min(sx, sy, sz) >= 0.3:
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


def bm_tronco(p0, p1, z0, z1, mat_lados=1, fundo=True):
    """Tronco de prisma: planta p0 em z0 e p1 (mesma ordem e nº de pontos) em z1; topo/fundo material 0"""
    bm = bmesh.new()
    p0, p1 = (p0, p1) if area(p0) > 0 else (p0[::-1], p1[::-1])
    a = [bm.verts.new((x, y, z0)) for x, y in p0]
    b = [bm.verts.new((x, y, z1)) for x, y in p1]
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]]).material_index = mat_lados
    bm.faces.new(b).material_index = 0
    if fundo:
        bm.faces.new(a[::-1]).material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_anel(r_ext, r_int, z0, z1, n=8, giro=22.5):
    """Anel poligonal (parapeito, cornija vazada): coroa entre dois polígonos regulares, de z0 a z1"""
    bm = bmesh.new()
    E = octogono(r_ext, giro) if n == 8 else circulo(n, r_ext)
    I = octogono(r_int, giro) if n == 8 else circulo(n, r_int)
    e0 = [bm.verts.new((x, y, z0)) for x, y in E]
    e1 = [bm.verts.new((x, y, z1)) for x, y in E]
    i0 = [bm.verts.new((x, y, z0)) for x, y in I]
    i1 = [bm.verts.new((x, y, z1)) for x, y in I]
    for k in range(len(E)):
        j = (k + 1) % len(E)
        bm.faces.new([e0[k], e0[j], e1[j], e1[k]])
        bm.faces.new([i0[j], i0[k], i1[k], i1[j]])
        bm.faces.new([e1[k], e1[j], i1[j], i1[k]])
        bm.faces.new([e0[j], e0[k], i0[k], i0[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_cilindro(r, h, n=16, r2=None, tampa=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tampa, cap_tris=False, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=Vector((0, 0, h / 2)), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_torno(perfil, n=16, giro=0.0):
    """Superfície de revolução fechada de um perfil [(r, z), ...] em volta do eixo z"""
    bm = bmesh.new()
    aneis = []
    for i in range(n):
        a = 2 * math.pi * i / n + math.radians(giro)
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


def barra(P, a, b, esp, m, esp2=None):
    """Perfil retangular de a até b (montantes, guarda-corpos, mastros)"""
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

COR_AMARELO = "#ffd23f"    # reboco amarelo do farol restaurado (ficha: "amarelo e branco", legenda de foto de 2025);
#                            saturado de propósito: o chão azul da luz de hemisfério do site puxa as paredes para oliva
COR_BRANCO = "#f6f3ea"
COR_MADEIRA = "#8a3a2c"    # esquadrias de madeira vermelho-escura (não confirmado; ficha)
COR_VIDRO = "#2f3d48"

REGIOES = {
    "porta_farol": (0.0, 0.5, 0.25, 1.0),     # porta em arco pleno: duas folhas e bandeira envidraçada
    "arco_farol": (0.25, 0.5, 0.5, 1.0),      # janela em arco pleno com venezianas (térreo do corpo)
    "reta_farol": (0.5, 0.625, 0.75, 1.0),    # janela de verga reta com cornija (corpo de cima e torre)
    "casa_porta": (0.75, 0.5, 0.875, 1.0),    # porta de aço de casa (cinza claro: a cor vem da tinta)
    "casa_janela": (0.875, 0.75, 1.0, 1.0),   # janela de casa com grade
    "conteiner": (0.0, 0.0, 0.5, 0.25),       # chapa ondulada de contêiner (clara: a cor vem da tinta)
}
ASPECTO = {"porta_farol": 1.9 / 3.0, "arco_farol": 1.45 / 2.4, "reta_farol": 1.1 / 1.3}


def atlas_esquadrias(n=256):
    px = [0.0] * (n * n * 4)

    def pinta(x, y, c):
        if 0 <= x < n and 0 <= y < n:
            i = (y * n + x) * 4
            px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    def r(u0, v0, u1, v1, cor):
        c = srgb_lin(cor)
        for y in range(max(0, int(round(v0 * n))), min(n, int(round(v1 * n)))):
            for x in range(max(0, int(round(u0 * n))), min(n, int(round(u1 * n)))):
                pinta(x, y, c)

    def faixa(reg, a0, a1, b0, b1, cor):
        u0, v0, u1, v1 = REGIOES[reg]
        r(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * b0, u0 + (u1 - u0) * a1, v0 + (v1 - v0) * b1, cor)

    def arco(reg, a0, a1, b0, b1, cor, cor_fn=None):
        """Abertura com topo em arco pleno dentro da região (a, b de 0 a 1), redondo na proporção do quadro"""
        u0, v0, u1, v1 = REGIOES[reg]
        w, h = u1 - u0, v1 - v0
        asp = ASPECTO.get(reg, 1.0)
        ra = (a1 - a0) / 2
        rb = ra * asp * (w * n) / (h * n) * (h / w) if False else ra * asp
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
                    pinta(x, y, srgb_lin(cor_fn(a, b, ac, bm_)) if cor_fn else c)
        return bm_

    # fundo das regiões do farol: reboco amarelo
    r(0, 0.5, 0.75, 1.0, COR_AMARELO)

    # porta do farol: moldura branca em arco, duas folhas de madeira com almofadas e bandeira de vidro com raios
    arco("porta_farol", 0.03, 0.97, 0.0, 0.995, COR_BRANCO)
    def bandeira(a, b, ac, bm_):
        if b < bm_:
            return COR_MADEIRA
        ang = math.atan2(b - bm_, a - ac)
        return COR_BRANCO if abs(ang / math.pi * 5 - round(ang / math.pi * 5)) < 0.1 else COR_VIDRO
    bp = arco("porta_farol", 0.13, 0.87, 0.0, 0.94, COR_MADEIRA, bandeira)
    faixa("porta_farol", 0.13, 0.87, bp - 0.02, bp, COR_BRANCO)
    faixa("porta_farol", 0.49, 0.51, 0.0, bp - 0.02, "#5c241b")
    for b0 in (0.07, 0.38):
        for a0 in (0.19, 0.56):
            faixa("porta_farol", a0, a0 + 0.25, b0, b0 + 0.24, "#a24a38")
    faixa("porta_farol", 0.46, 0.54, 0.95, 0.995, COR_BRANCO)  # aduela de fecho

    # janela em arco: moldura branca, venezianas de madeira e bandeira em arco
    arco("arco_farol", 0.04, 0.96, 0.0, 0.995, COR_BRANCO)
    ba = arco("arco_farol", 0.16, 0.84, 0.06, 0.93, COR_MADEIRA)
    for k in range(16):
        b = 0.09 + k * 0.05
        if b < ba - 0.03:
            faixa("arco_farol", 0.16, 0.84, b, b + 0.014, "#5c241b")
    faixa("arco_farol", 0.49, 0.51, 0.06, ba, "#5c241b")
    faixa("arco_farol", 0.16, 0.84, ba - 0.03, ba, COR_BRANCO)
    faixa("arco_farol", 0.0, 1.0, 0.0, 0.06, COR_BRANCO)     # peitoril
    faixa("arco_farol", 0.45, 0.55, 0.95, 0.995, COR_BRANCO)

    # janela de verga reta: moldura branca, cornija em cima, venezianas
    faixa("reta_farol", 0.06, 0.94, 0.0, 0.84, COR_BRANCO)
    faixa("reta_farol", 0.0, 1.0, 0.86, 1.0, COR_BRANCO)      # cornija da verga
    faixa("reta_farol", 0.0, 1.0, 0.84, 0.86, "#c99a3c")     # sombra sob a cornija
    faixa("reta_farol", 0.18, 0.82, 0.08, 0.76, COR_MADEIRA)
    for k in range(12):
        b = 0.1 + k * 0.055
        if b < 0.74:
            faixa("reta_farol", 0.18, 0.82, b, b + 0.016, "#5c241b")
    faixa("reta_farol", 0.49, 0.51, 0.08, 0.76, "#5c241b")
    faixa("reta_farol", 0.02, 0.98, 0.0, 0.06, COR_BRANCO)

    # porta de aço de casa: chapa clara com frisos (a cor da casa vem da tinta)
    faixa("casa_porta", 0.0, 1.0, 0.0, 1.0, "#e6e6e6")
    for k in range(9):
        b = 0.06 + k * 0.105
        faixa("casa_porta", 0.08, 0.92, b, b + 0.02, "#b9b9b9")
    faixa("casa_porta", 0.0, 0.07, 0.0, 1.0, "#9e9e9e")
    faixa("casa_porta", 0.93, 1.0, 0.0, 1.0, "#9e9e9e")
    faixa("casa_porta", 0.0, 1.0, 0.95, 1.0, "#9e9e9e")

    # janela de casa: moldura clara, vidro escuro e grade
    faixa("casa_janela", 0.0, 1.0, 0.0, 1.0, "#ece9e2")
    faixa("casa_janela", 0.1, 0.9, 0.1, 0.9, "#34404a")
    for k in range(5):
        a = 0.14 + k * 0.18
        faixa("casa_janela", a, a + 0.05, 0.1, 0.9, "#d8d4ca")
    faixa("casa_janela", 0.1, 0.9, 0.48, 0.53, "#d8d4ca")

    # contêiner: nervuras verticais claras e escuras, porta com travas na ponta
    u0, v0, u1, v1 = REGIOES["conteiner"]
    for x in range(int(u0 * n), int(u1 * n)):
        a = ((x + 0.5) / n - u0) / (u1 - u0)
        tom = "#f2f2f2" if (x // 2) % 2 == 0 else "#c8c8c8"
        r(x / n, v0, (x + 1) / n, v1, tom)
    faixa("conteiner", 0.0, 1.0, 0.0, 0.07, "#8f8f8f")
    faixa("conteiner", 0.0, 1.0, 0.93, 1.0, "#8f8f8f")

    img = bpy.data.images.new("Tex_Esquadrias", n, n, alpha=False)
    img.pixels.foreach_set(px)
    img.pack()
    return img


def uv_reg(reg, a, b):
    """UV dentro de uma região do atlas (a, b de 0 a 1), com 1 px de margem"""
    u0, v0, u1, v1 = REGIOES[reg]
    m = 1.0 / 256
    a, b = min(max(a, 0.0), 1.0), min(max(b, 0.0), 1.0)
    return (u0 + m + (u1 - u0 - 2 * m) * a, v0 + m + (v1 - v0 - 2 * m) * b)


def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    # chão (oclusão do chão e texturas de piso no .tsx)
    M["terra"] = mat("Mat_Chao_Terra", "#d6c9a8", 0.95)
    M["rua"] = mat("Mat_Chao_Rua", "#aaa194", 0.95)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#64666a", 0.9)
    M["calcada"] = mat("Mat_Chao_Calcada", "#d3cdc1", 0.9)
    M["areia"] = mat("Mat_Chao_Areia", "#f0e1b6", 0.95)
    M["molhada"] = mat("Mat_Chao_Areia_Molhada", "#cdb98c", 0.6)
    M["grama"] = mat("Mat_Chao_Grama", "#86ab58", 0.95)
    M["piso"] = mat("Mat_Chao_Piso", "#e3d8c2", 0.9)
    M["agua"] = mat("Mat_Agua_Mar", "#41b1dc", 0.1)          # o .tsx troca por fab.agua()
    M["espuma"] = mat("Mat_Espuma", "#f4f7f6", 0.6)
    M["faixa"] = mat("Mat_Faixa_Branca", "#f2f0ea", 0.7)
    # farol
    M["amarelo"] = mat("Mat_Reboco_Amarelo", COR_AMARELO, 0.85)
    M["branco"] = mat("Mat_Frisos_Brancos", COR_BRANCO, 0.7)
    M["soco"] = mat("Mat_Soco_Pedra", "#bdb3a1", 0.9)
    M["terraco"] = mat("Mat_Piso_Terraco", "#ddd0bb", 0.9)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.6, 0.0, atlas)
    M["ferro"] = mat("Mat_Ferro_Grafite", "#2e3437", 0.5, 0.35)
    M["vidro"] = mat("Mat_Vidro_Lanterna", "#f3e7b8", 0.2)   # o .tsx põe o brilho da luz acesa
    # recinto, casario e porto
    M["muro"] = mat("Mat_Muro_Recinto", "#ece3cf", 0.88)
    M["parede"] = mat("Mat_Casas_Paredes", "#ffffff", 0.88)   # cor de cada casa pela tinta (cores de vértice)
    M["laje"] = mat("Mat_Casas_Laje", "#b8b2a7", 0.92)
    M["telha"] = mat("Mat_Telha_Barro", "#b4603f", 0.8)       # o .tsx põe a textura de telhas
    M["caixa"] = mat("Mat_Caixa_Dagua", "#2f6fb4", 0.5)
    M["concreto"] = mat("Mat_Concreto_Porto", "#a9a59d", 0.9)
    M["pedra"] = mat("Mat_Pedras_Costa", "#6f665c", 0.95)
    M["madeira"] = mat("Mat_Madeira_Jangada", "#9a7650", 0.8)
    M["vela"] = mat("Mat_Vela_Jangada", "#f4efe2", 0.85)
    return M


# ———————————————————————————————————————————————— OSM: casas e ruas

def ler_osm():
    raiz = ET.parse(OSM).getroot()
    nos = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in raiz.iter("node")}
    c = math.cos(math.radians(LAT0)) * 111320

    def xy(i):
        la, lo = nos[i]
        return ((lo - LNG0) * c, (la - LAT0) * 110540)

    casas, vias, recinto = [], [], None
    for w in raiz.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.iter("tag")}
        pts = [xy(nd.get("ref")) for nd in w.iter("nd") if nd.get("ref") in nos]
        if len(pts) < 2:
            continue
        if tags.get("landuse") == "grass" and tags.get("barrier") == "wall":
            recinto = pts[:-1] if pts[0] == pts[-1] else pts
        elif "building" in tags and tags.get("man_made") != "lighthouse":
            h = float(tags.get("height", "3.0"))
            niv = int(float(tags.get("building:levels", "1")))
            casas.append((pts[:-1] if pts[0] == pts[-1] else pts, h, niv, w.get("id")))
        elif tags.get("highway") in ("residential", "pedestrian", "footway"):
            vias.append((pts, tags.get("highway"), tags.get("name", ""), w.get("id")))
    return recinto, casas, vias


def retangulo(pts):
    """Retângulo de menor área que envolve a planta: centro, comprimento, largura e ângulo (graus) do lado maior"""
    melhor = None
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        ca, sa = math.cos(-ang), math.sin(-ang)
        us = [p[0] * ca - p[1] * sa for p in pts]
        vs = [p[0] * sa + p[1] * ca for p in pts]
        ar = (max(us) - min(us)) * (max(vs) - min(vs))
        if melhor is None or ar < melhor[0]:
            uc, vc = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            cx = uc * math.cos(ang) - vc * math.sin(ang)
            cy = uc * math.sin(ang) + vc * math.cos(ang)
            melhor = (ar, cx, cy, max(us) - min(us), max(vs) - min(vs), math.degrees(ang))
    _, cx, cy, L, W, ang = melhor
    if W > L:
        L, W, ang = W, L, ang + 90
    return cx, cy, L, W, ang


def cantos(cx, cy, L, W, ang):
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    return [(cx + u * ca - v * sa, cy + u * sa + v * ca) for u, v in ((-L / 2, -W / 2), (L / 2, -W / 2), (L / 2, W / 2), (-L / 2, W / 2))]


def subdividir(pts, passo=3.0):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / passo))
        for k in range(1, n + 1):
            out.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    return out


# ———————————————————————————————————————————————— chão: disco, ruas, avenida, praia e mar

def linha_dagua():
    """Linha d'água ondulada ao longo da costa (pontos de oeste-noroeste para leste-sudeste, fora do disco nas pontas)"""
    pts = []
    for k in range(41):
        s = -38 + 76 * k / 40
        d = D_AGUA + 0.35 * math.sin(s * 0.55) + 0.2 * math.sin(s * 1.3 + 1.0)
        pts.append((N_MAR.x * d + T_MAR.x * s, N_MAR.y * d + T_MAR.y * s))
    return pts


def chao(M, recinto_m, vias_m):
    """Disco de chão (terra e areia), ruas do OSM comprimidas, Av. Vicente de Castro, calçadas, praia e mar"""
    # terra e mar: o disco cortado pela linha d'água; cada lado fecha pelo arco do disco que fica do seu lado
    lin = [p for p in linha_dagua() if math.hypot(*p) < RAIO - 0.02]
    a_l, a_o = math.atan2(lin[0][1], lin[0][0]), math.atan2(lin[-1][1], lin[-1][0])

    def arco(a0, a1, mar_):
        """Arco do disco de a0 até a1 pelo lado do mar (mar_) ou da terra"""
        for sentido in (1, -1):
            passo = (a1 - a0) % (2 * math.pi) if sentido > 0 else -((a0 - a1) % (2 * math.pi))
            meio = a0 + passo / 2
            if (dist_mar(RAIO * math.cos(meio), RAIO * math.sin(meio)) > D_AGUA) == mar_:
                n = max(4, int(abs(passo) / (2 * math.pi) * 96))
                return [(RAIO * math.cos(a0 + passo * k / n), RAIO * math.sin(a0 + passo * k / n)) for k in range(1, n)]
        return []
    terra = lin + arco(a_o, a_l, False)
    mar = lin + arco(a_o, a_l, True)

    g = Peca("Chao_Base")
    g.juntar(bm_prisma(terra, 0.0, Z0, 0.0, mat_lados=1), [M["terra"], M["terra"]])
    g.criar()
    agua = Peca("Mar")
    agua.juntar(bm_prisma(mar, 0.0, Z0 - 0.04, 0.0, mat_lados=1), [M["agua"], M["agua"]])
    # espuma: cristas onduladas e a beira
    for d0, larg, fase in ((D_AGUA + 0.15, 0.45, 0.0), (D_AGUA + 2.1, 0.35, 1.7), (D_AGUA + 4.6, 0.3, 3.1)):
        crista = []
        for k in range(61):
            s = -38 + 76 * k / 60
            d = d0 + 0.4 * math.sin(s * 0.42 + fase) + 0.15 * math.sin(s * 1.1 + fase * 2)
            crista.append((N_MAR.x * d + T_MAR.x * s, N_MAR.y * d + T_MAR.y * s))
        for a, b in zip(crista, crista[1:]):
            if math.hypot(*a) > RAIO - 0.3 or math.hypot(*b) > RAIO - 0.3:
                continue
            w = larg * (0.6 + 0.4 * abs(math.sin(a[0] * 0.7 + fase)))
            q = [(a[0], a[1]), (b[0], b[1]), (b[0] + N_MAR.x * w, b[1] + N_MAR.y * w), (a[0] + N_MAR.x * w, a[1] + N_MAR.y * w)]
            agua.poli([(x, y, Z0 - 0.025) for x, y in q], M["espuma"])
    agua.criar()

    pisos = Peca("Chao_Pisos")

    def placa(poli, m, z=0.006, z0=None):
        poli = recortar_no_disco(poli, RAIO - 0.05)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, (Z0 - 0.02) if z0 is None else z0, Z0 + z, 0.0, mat_lados=0), m)
        return poli

    # praia: areia seca e molhada até a linha d'água
    areia = cortar_semiplano(terra, (N_MAR.x, N_MAR.y), D_AREIA, True)
    placa(areia, M["areia"], 0.004)
    molhada = []
    for k in range(41):
        s = -38 + 76 * k / 40
        d = D_AGUA - 1.1 + 0.35 * math.sin(s * 0.55) + 0.2 * math.sin(s * 1.3 + 1.0)
        molhada.append((N_MAR.x * d + T_MAR.x * s, N_MAR.y * d + T_MAR.y * s))
    for i in range(len(molhada) - 1):
        q = [molhada[i], molhada[i + 1], linha_dagua()[i + 1], linha_dagua()[i]]
        q = recortar_no_disco(q, RAIO - 0.05)
        if len(q) >= 3:
            pisos.poli([(x, y, Z0 + 0.006) for x, y in anti_horario(q)], M["molhada"])
    reservar(areia, 0.2)

    # Av. Vicente de Castro (3 faixas, OSM) a oeste, com calçada larga do lado do farol e o muro do porto do outro
    av = [comprimir(*p) for p in subdividir([(-74, -86), (-44, 1), (-43, 2), (-32, 31), (-30, 34), (-27, 44)], 4.0)]
    av = [p for p in av if math.hypot(*p) < RAIO + 6]
    eixo_av = av
    faixas_av = []
    for a, b in zip(av, av[1:]):
        d = Vector((b[0] - a[0], b[1] - a[1]))
        if d.length < 1e-3:
            continue
        d.normalize()
        nl = Vector((d.y, -d.x))   # para leste (lado do farol; a avenida corre de sul para norte)
        for (o0, o1, m, z) in ((-3.0, 3.0, M["asfalto"], 0.008), (3.0, 5.0, M["calcada"], 0.13), (-4.2, -3.0, M["calcada"], 0.13)):
            q = [(a[0] + nl.x * o0 - d.x * 0.05, a[1] + nl.y * o0 - d.y * 0.05), (b[0] + nl.x * o0 + d.x * 0.05, b[1] + nl.y * o0 + d.y * 0.05),
                 (b[0] + nl.x * o1 + d.x * 0.05, b[1] + nl.y * o1 + d.y * 0.05), (a[0] + nl.x * o1 - d.x * 0.05, a[1] + nl.y * o1 - d.y * 0.05)]
            placa(q, m, z)
            reservar(q, 0.15)
        porto_q = [(a[0] - nl.x * 4.2, a[1] - nl.y * 4.2), (b[0] - nl.x * 4.2, b[1] - nl.y * 4.2), (b[0] - nl.x * 16, b[1] - nl.y * 16), (a[0] - nl.x * 16, a[1] - nl.y * 16)]
        reservar(porto_q, 0.1)
        # faixas tracejadas entre as 3 pistas
        for off in (-1.0, 1.0):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            n = int(L / 2.0)
            for k in range(n):
                t0, t1 = k / max(n, 1), (k + 0.5) / max(n, 1)
                p0 = (a[0] + (b[0] - a[0]) * t0 + nl.x * off, a[1] + (b[1] - a[1]) * t0 + nl.y * off)
                p1 = (a[0] + (b[0] - a[0]) * t1 + nl.x * off, a[1] + (b[1] - a[1]) * t1 + nl.y * off)
                q = [(p0[0] - nl.x * 0.07, p0[1] - nl.y * 0.07), (p1[0] - nl.x * 0.07, p1[1] - nl.y * 0.07),
                     (p1[0] + nl.x * 0.07, p1[1] + nl.y * 0.07), (p0[0] + nl.x * 0.07, p0[1] + nl.y * 0.07)]
                if all(math.hypot(*p) < RAIO - 0.2 for p in q):
                    pisos.poli([(x, y, Z0 + 0.012) for x, y in anti_horario(q)], M["faixa"])

    # ruas do bairro (OSM comprimido): calçamento; a travessa de pedestres mais estreita
    ruas = []
    for pts, tipo, nome, wid in vias_m:
        if "Vicente de Castro" in nome:
            continue
        larg = {"residential": 3.4, "pedestrian": 2.0, "footway": 1.4}[tipo]
        ps = [comprimir(*p) for p in subdividir(pts, 3.0)]
        for a, b in zip(ps, ps[1:]):
            if math.hypot(*a) > RAIO + 2 and math.hypot(*b) > RAIO + 2:
                continue
            if ponto_no_poligono(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), recinto_m):
                continue
            d = Vector((b[0] - a[0], b[1] - a[1]))
            if d.length < 1e-3:
                continue
            d.normalize()
            nl = Vector((-d.y, d.x)) * (larg / 2)
            q = [(a[0] - nl.x - d.x * larg * 0.3, a[1] - nl.y - d.y * larg * 0.3), (b[0] - nl.x + d.x * larg * 0.3, b[1] - nl.y + d.y * larg * 0.3),
                 (b[0] + nl.x + d.x * larg * 0.3, b[1] + nl.y + d.y * larg * 0.3), (a[0] + nl.x - d.x * larg * 0.3, a[1] + nl.y - d.y * larg * 0.3)]
            if dist_mar(*a) > D_AREIA + 0.6 and dist_mar(*b) > D_AREIA + 0.6:
                continue
            q = cortar_semiplano(q, (N_MAR.x, N_MAR.y), D_AREIA + 0.4, False)
            if len(q) < 3:
                continue
            placa(q, M["rua"], 0.005 if tipo == "residential" else 0.007)
            reservar(q, 0.1)
            ruas.append((a, b, tipo))
    pisos.criar()
    return eixo_av, ruas


# ———————————————————————————————————————————————— platô murado, escadaria e caminhos

def plato(M, recinto_m):
    """
    Recinto gramado murado do farol (OSM way/361267803, comprimido): platô 1,6 m acima da rua, com muro de arrimo e mureta
    caiados, portão a oeste e a escadaria que sobe junto ao muro (OSM: escadaria a oeste, chegando da avenida). No topo,
    grama, um caminho do portão até a porta do farol e uma calçada em volta dele.
    """
    P = Peca("Recinto_Murado")
    poli = anti_horario(recinto_m)
    # muro de arrimo (lados do platô)
    P.juntar(bm_prisma(poli, Z0 - 0.02, ZP - 0.09, 0.0, mat_lados=1), [M["muro"], M["muro"]])   # topo abaixo da grama (sem briga de profundidade)
    # mureta em volta (0,9 m), com capa branca, aberta no portão oeste
    alvo = comprimir(-31.0, -1.0)
    portao = min(poli, key=lambda p: math.hypot(p[0] - alvo[0], p[1] - alvo[1]))
    x_portao = portao[0]
    for a, b in zip(poli, poli[1:] + poli[:1]):
        va, vb = Vector(a), Vector(b)
        L = (vb - va).length
        t = (vb - va).normalized()
        nrm = Vector((t.y, -t.x))   # para fora (polígono anti-horário)
        segs = [(0.0, L)]
        # portão: abre 2,2 m em volta do vértice oeste
        for i, p in enumerate((va, vb)):
            if abs(p.x - x_portao) < 1e-6:
                segs = [(1.1, L)] if i == 0 else [(0.0, L - 1.1)]
        for s0, s1 in segs:
            if s1 - s0 < 0.2:
                continue
            c = va + t * ((s0 + s1) / 2) - nrm * 0.15
            ang = math.degrees(math.atan2(t.y, t.x))
            P.juntar(bm_caixa(s1 - s0 + 0.3, 0.3, 0.8), M["muro"], T(c.x, c.y, ZP, ang))
            P.juntar(bm_caixa(s1 - s0 + 0.38, 0.4, 0.1), M["branco"], T(c.x, c.y, ZP + 0.8, ang))
        # pilares da mureta nos vértices; no portão, um de cada lado da abertura
        ang = math.degrees(math.atan2(t.y, t.x))
        if abs(va.x - x_portao) < 1e-6:
            p = va + t * 1.1 - nrm * 0.15
            P.juntar(bm_caixa(0.5, 0.5, 1.25, 0.03), M["branco"], T(p.x, p.y, ZP, ang))
        else:
            P.juntar(bm_caixa(0.45, 0.45, 1.05, 0.03), M["branco"], T(va.x - nrm.x * 0.15, va.y - nrm.y * 0.15, ZP, ang))
        if abs(vb.x - x_portao) < 1e-6:
            p = vb - t * 1.1 - nrm * 0.15
            P.juntar(bm_caixa(0.5, 0.5, 1.25, 0.03), M["branco"], T(p.x, p.y, ZP, ang))
    # rodapé do arrimo (faixa de pedra embaixo)
    P.juntar(bm_prisma([(x * 1.0 + (0.12 * x / math.hypot(x, y)), y + 0.12 * y / math.hypot(x, y)) for x, y in poli], Z0 - 0.02, Z0 + 0.35, 0.0, mat_lados=1), [M["soco"], M["soco"]])
    # escadaria: junto ao muro oeste, subindo de sul para norte até o patamar do portão
    xw, yw = portao
    x0, x1 = xw - 2.1, xw - 0.05
    n_deg = 9
    esp = H_PLATO / n_deg
    piso = 0.42
    y_patamar0 = yw - 1.2
    for k in range(n_deg):
        y1 = y_patamar0 - k * piso
        P.juntar(bm_caixa(x1 - x0, piso, H_PLATO - k * esp), M["muro"] if k % 2 else M["muro"], T((x0 + x1) / 2, y1 - piso / 2, Z0 - 0.01))
    # patamar e o piso dos degraus por cima (pedra clara)
    P.juntar(bm_caixa(x1 - x0, 2.5, H_PLATO), M["muro"], T((x0 + x1) / 2, yw, Z0 - 0.01))
    for k in range(n_deg):
        y1 = y_patamar0 - k * piso
        P.juntar(bm_caixa(x1 - x0 + 0.04, piso + 0.02, 0.04), M["piso_degrau"], T((x0 + x1) / 2, y1 - piso / 2, Z0 + H_PLATO - (k + 1) * esp + esp - 0.035 - 0.01 + 0.0))
    P.juntar(bm_caixa(x1 - x0 + 0.04, 2.5, 0.04), M["piso_degrau"], T((x0 + x1) / 2, yw, ZP - 0.03))
    # guarda-corpo de alvenaria do lado de fora da escada, rampando
    yb = y_patamar0 - n_deg * piso
    for k in range(n_deg):
        y1 = y_patamar0 - k * piso
        P.juntar(bm_caixa(0.28, piso, 0.9), M["muro"], T(x0 + 0.14, y1 - piso / 2, Z0 + H_PLATO - k * esp - 0.01))
    P.juntar(bm_caixa(0.28, 2.5, 0.9), M["muro"], T(x0 + 0.14, yw, ZP))
    P.juntar(bm_caixa(0.36, 2.5, 0.08), M["branco"], T(x0 + 0.14, yw, ZP + 0.9))
    barra(P, (x0 + 0.14, yb, Z0 + 0.95), (x0 + 0.14, y_patamar0, ZP + 0.95), 0.36, M["branco"], 0.08)
    # postes de ferro com globo em volta da calçada do farol e no portão (a restauração de 2025 trouxe iluminação
    # externa; o desenho dos postes não foi confirmado)
    postes = [octogono(R_CORPO + 1.75, 0.0)[k] for k in (0, 2, 3, 5, 6)] + [(xw + 1.0, yw + 1.5), (xw + 1.0, yw - 1.5)]
    for x, y in postes:
        P.juntar(bm_cilindro(0.13, 0.3, 8), M["ferro"], T(x, y, ZP - 0.02))
        P.juntar(bm_cilindro(0.05, 2.7, 6, r2=0.04), M["ferro"], T(x, y, ZP + 0.28))
        P.juntar(bm_cilindro(0.1, 0.1, 8), M["ferro"], T(x, y, ZP + 2.95))
        P.juntar(bm_esfera(0.2, 1), M["branco"], T(x, y, ZP + 3.2), liso=True)
    reservar(ret(x0 - 0.6, yb - 1.2, x1, yw + 1.3), 0.2)
    reservar(poli, 0.5)
    return P.criar(), (xw, yw), (x0, x1, yb, y_patamar0)


def topo_plato(M, recinto_m, portao):
    """Topo do platô: grama, caminho do portão até a porta oeste do farol e a calçada octogonal em volta dele"""
    P = Peca("Chao_Plato")
    poli = anti_horario(recinto_m)
    P.juntar(bm_prisma(poli, ZP - 0.1, ZP, 0.0, mat_lados=0), M["grama"])
    # calçada em volta do farol
    P.juntar(bm_prisma(octogono(R_CORPO + 1.9), ZP - 0.02, ZP + 0.02, 0.0, mat_lados=0), M["piso"])
    # caminho do portão (oeste) até a porta, e um caminho em cruz para leste, norte e sul (acessos ao gramado)
    xw, yw = portao
    P.juntar(bm_prisma([(xw - 0.2, yw - 1.1), (-R_CORPO, -1.1), (-R_CORPO, 1.1), (xw - 0.2, yw + 1.1)], ZP - 0.02, ZP + 0.021, 0.0, mat_lados=0), M["piso"])
    return P.criar()


# ———————————————————————————————————————————————— o farol

def vao_oct(P, M, k, r_base, r_topo, z_base, z_topo, larg, z0, z1, reg, saliente=0.03):
    """Esquadria do atlas na face k (normal a 45·k graus) de um prisma octogonal afunilado (raios circunscritos)"""
    ang = math.radians(45 * k)
    nx, ny = math.cos(ang), math.sin(ang)
    rx, ry = -ny, nx

    def apot(z):
        t = (z - z_base) / (z_topo - z_base)
        return (r_base + (r_topo - r_base) * t) * math.cos(math.radians(22.5)) + saliente

    pts = []
    for (s, z) in ((-1, z0), (1, z0), (1, z1), (-1, z1)):
        a = apot(z)
        pts.append((nx * a + rx * s * larg / 2, ny * a + ry * s * larg / 2, z))
    P.poli(pts, M["esquadrias"], [uv_reg(reg, u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))])


def farol(M):
    """
    Farol Velho (ficha): corpo octogonal largo de alvenaria (oito paredes iguais, a antiga casa dos faroleiros) com
    soco de pedra, pilastras brancas nas quinas, arcos plenos no térreo e janelas de verga reta em cima, cornija e
    coroamento de ameias em volta do terraço; do meio sobe a torre octogonal estreita (OSM: parte central de ~3,2 m) com
    janelas de verga reta em espiral (a escada helicoplanar de ferro por dentro), cornija, varanda com guarda-corpo de
    ferro sobre mãos-francesas, a lanterna envidraçada de montantes de ferro e a cúpula branca de oito gomos com o
    para-raios. Porta principal a oeste, onde chega o caminho da escadaria. Reboco amarelo e frisos brancos.
    """
    P = Peca("Farol_Velho")
    A, B = M["amarelo"], M["branco"]
    z = lambda h: ZP + h
    # soco de pedra levemente em talude
    P.juntar(bm_tronco(octogono(R_CORPO + 0.42), octogono(R_CORPO + 0.22), z(-0.04), z(H_SOCO)), [M["soco"], M["soco"]])
    P.juntar(bm_tronco(octogono(R_CORPO + 0.3), octogono(R_CORPO + 0.3), z(H_SOCO - 0.12), z(H_SOCO)), [B, B])
    # corpo octogonal
    P.juntar(bm_tronco(octogono(R_CORPO), octogono(R_CORPO), z(H_SOCO), z(H_CORPO)), [M["terraco"], A])
    # friso entre os dois níveis e cornija de duas etapas
    P.juntar(bm_anel(R_CORPO + 0.1, R_CORPO - 0.05, z(3.95), z(4.2)), B)
    P.juntar(bm_anel(R_CORPO + 0.16, R_CORPO - 0.05, z(5.95), z(6.2)), B)
    P.juntar(bm_anel(R_CORPO + 0.38, R_CORPO - 0.05, z(6.2), z(H_CORPO)), B)
    # parapeito do terraço (amarelo, capa branca) e as ameias brancas
    R_P = R_CORPO + 0.22
    P.juntar(bm_anel(R_P, R_P - 0.36, z(H_CORPO), z(H_CORPO + 0.5)), A)
    P.juntar(bm_anel(R_P + 0.05, R_P - 0.41, z(H_CORPO + 0.5), z(H_CORPO + 0.58)), B)
    oc = octogono(R_P - 0.18)
    for i in range(8):
        a, b = Vector(oc[i]), Vector(oc[(i + 1) % 8])
        ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
        for t in (0.0, 1 / 3, 2 / 3):
            p = a + (b - a) * t
            larg = 0.85 if t == 0 else 0.7
            P.juntar(bm_caixa(larg, 0.44, 0.62, 0.03), B, T(p.x, p.y, z(H_CORPO + 0.58), ang))
            P.juntar(bm_caixa(larg + 0.1, 0.52, 0.07), B, T(p.x, p.y, z(H_CORPO + 1.2), ang))
    # pilastras brancas nas quinas do corpo
    for i, (x, y) in enumerate(octogono(R_CORPO)):
        ang = 22.5 + 45 * i
        P.juntar(bm_caixa(0.24, 0.62, 3.75), B, T(x, y, z(H_SOCO), ang))
        P.juntar(bm_caixa(0.24, 0.55, 1.75), B, T(x, y, z(4.2), ang))
    # esquadrias do corpo: porta em arco a oeste (face 4), janelas em arco nas outras, verga reta em cima
    for k in range(8):
        if k == 4:
            vao_oct(P, M, k, R_CORPO, R_CORPO, 0, 1, 2.0, z(H_SOCO), z(3.75), "porta_farol")
        else:
            vao_oct(P, M, k, R_CORPO, R_CORPO, 0, 1, 1.5, z(1.25), z(3.7), "arco_farol")
        vao_oct(P, M, k, R_CORPO, R_CORPO, 0, 1, 1.15, z(4.45), z(5.8), "reta_farol")
    # degraus da porta oeste (do piso do platô ao soco)
    ap = R_CORPO * math.cos(math.radians(22.5))
    for i, (d, h) in enumerate(((ap + 1.15, 0.27), (ap + 0.8, 0.54), (ap + 0.45, 0.8))):
        P.juntar(bm_caixa(0.4 if i else 0.4, 2.6 - 0.15 * i, h), M["soco"], T(-d, 0, z(-0.02)))
    # torre octogonal afunilada
    P.juntar(bm_tronco(octogono(R_TORRE0), octogono(R_TORRE1), z(H_CORPO - 0.02), z(H_TORRE)), [B, A])
    rz = lambda h: R_TORRE0 + (R_TORRE1 - R_TORRE0) * (h - H_CORPO) / (H_TORRE - H_CORPO)
    # pilastras finas brancas nas quinas da torre
    for i in range(8):
        a0 = math.radians(22.5 + 45 * i)
        p0 = (math.cos(a0) * (R_TORRE0 + 0.02), math.sin(a0) * (R_TORRE0 + 0.02), z(H_CORPO))
        p1 = (math.cos(a0) * (R_TORRE1 + 0.02), math.sin(a0) * (R_TORRE1 + 0.02), z(H_TORRE))
        barra(P, p0, p1, 0.36, B, 0.14)
    # cintas brancas da torre (base, meio e alto)
    for h0, h1, sal in ((H_CORPO, H_CORPO + 0.35, 0.12), (10.95, 11.2, 0.08), (14.45, 14.7, 0.09)):
        P.juntar(bm_tronco(octogono(rz(h0) + sal), octogono(rz(h1) + sal), z(h0), z(h1)), [B, B])
    # porta da torre para o terraço (oeste) e janelas de verga reta em espiral
    vao_oct(P, M, 4, R_TORRE0, R_TORRE1, z(H_CORPO), z(H_TORRE), 1.25, z(H_CORPO + 0.35), z(H_CORPO + 2.5), "reta_farol")
    for k in range(8):
        # janelas em espiral (acompanham a escada helicoidal), abaixo e acima da cinta do meio
        h0 = 7.7 + 0.42 * ((k - 5) % 8) if k != 4 else 9.3
        vao_oct(P, M, k, R_TORRE0, R_TORRE1, z(H_CORPO), z(H_TORRE), 0.95, z(h0), z(h0 + 1.25), "reta_farol")
        h1 = 11.55 + 0.32 * ((k - 1) % 8)
        vao_oct(P, M, k, R_TORRE0, R_TORRE1, z(H_CORPO), z(H_TORRE), 0.9, z(h1), z(h1 + 1.15), "reta_farol")
    # cornija da torre e laje da varanda
    P.juntar(bm_tronco(octogono(R_TORRE1 + 0.12), octogono(R_TORRE1 + 0.42), z(H_TORRE), z(H_TORRE + 0.3)), [B, B])
    P.juntar(bm_tronco(octogono(R_GALERIA), octogono(R_GALERIA), z(H_TORRE + 0.3), z(H_GALERIA)), [M["terraco"], B])
    # mãos-francesas sob a varanda
    for i in range(8):
        a0 = math.radians(45 * i)
        ca, sa = math.cos(a0), math.sin(a0)
        barra(P, (ca * (R_TORRE1 * 0.92), sa * (R_TORRE1 * 0.92), z(H_TORRE - 0.9)), (ca * (R_GALERIA - 0.25), sa * (R_GALERIA - 0.25), z(H_TORRE + 0.3)), 0.16, B)
    # guarda-corpo de ferro da varanda: montantes, corrimão e travessa
    oc = octogono(R_GALERIA - 0.1)
    postes = []
    for i in range(8):
        a, b = Vector(oc[i]), Vector(oc[(i + 1) % 8])
        for t in (0.0, 0.5):
            postes.append(a + (b - a) * t)
    for p in postes:
        barra(P, (p.x, p.y, z(H_GALERIA)), (p.x, p.y, z(H_GALERIA + 1.0)), 0.07, M["ferro"])
    for i in range(len(postes)):
        a, b = postes[i], postes[(i + 1) % len(postes)]
        barra(P, (a.x, a.y, z(H_GALERIA + 1.0)), (b.x, b.y, z(H_GALERIA + 1.0)), 0.08, M["ferro"])
        barra(P, (a.x, a.y, z(H_GALERIA + 0.5)), (b.x, b.y, z(H_GALERIA + 0.5)), 0.045, M["ferro"])
        for t in (0.25, 0.5, 0.75):
            q = a + (b - a) * t
            barra(P, (q.x, q.y, z(H_GALERIA)), (q.x, q.y, z(H_GALERIA + 1.0)), 0.03, M["ferro"])
    # lanterna: base branca, vidraça com montantes de ferro, anel e cúpula branca de oito gomos com o para-raios
    H_L0, H_L1 = H_GALERIA + 0.6, H_GALERIA + 2.3
    P.juntar(bm_tronco(octogono(1.62), octogono(1.62), z(H_GALERIA), z(H_L0)), [B, B])
    P.juntar(bm_anel(1.72, 1.4, z(H_L0 - 0.08), z(H_L0)), M["ferro"])
    P.juntar(bm_tronco(octogono(1.45), octogono(1.45), z(H_L0), z(H_L1)), [M["ferro"], M["vidro"]])
    for i, (x, y) in enumerate(octogono(1.47)):
        barra(P, (x, y, z(H_L0)), (x, y, z(H_L1)), 0.11, M["ferro"])
    P.juntar(bm_anel(1.5, 1.38, z(H_L0 + 0.8), z(H_L0 + 0.87)), M["ferro"])
    P.juntar(bm_anel(1.74, 1.3, z(H_L1), z(H_L1 + 0.2)), M["ferro"])
    perfil = [(1.66, 0.0), (1.64, 0.22), (1.5, 0.55), (1.2, 0.88), (0.78, 1.12), (0.36, 1.27), (0.0, 1.32)]
    P.juntar(bm_torno([(r, z(H_L1 + 0.2) + h) for r, h in perfil], 8, giro=22.5), B, liso=False)
    zc = z(H_L1 + 0.2 + 1.32)
    P.juntar(bm_esfera(0.2, 1), M["ferro"], T(0, 0, zc + 0.12), liso=True)
    P.juntar(bm_cilindro(0.12, 0.18, 8, r2=0.08), M["ferro"], T(0, 0, zc - 0.03))
    barra(P, (0, 0, zc + 0.25), (0, 0, zc + 1.15), 0.05, M["ferro"])
    reservar(octogono(R_CORPO + 2.2), 0.0)
    return P.criar(), zc + 1.15


# ———————————————————————————————————————————————— casario do Serviluz

PALETA_CASAS = ["#f2efe6", "#e8d7b0", "#9fc7d8", "#e3a39a", "#b9d39b", "#f0d27a", "#d98c5f", "#cfc8bc", "#b3624a",
                "#f2efe6", "#a9b8d6", "#e8d7b0"]
PORTAS = ["#c8ccd0", "#3c5a8c", "#8a3a2c", "#3f6b4a", "#5a5f66", "#c9a23a"]


def sobrepoe(a, b, folga=0.06):
    """Dois retângulos (convexos) se sobrepõem além da folga? (eixos separadores; encostar é permitido)"""
    for poli in (a, b):
        for i in range(len(poli)):
            p, q = poli[i], poli[(i + 1) % len(poli)]
            nx, ny = -(q[1] - p[1]), q[0] - p[0]
            l = math.hypot(nx, ny)
            nx, ny = nx / l, ny / l
            pa = [x * nx + y * ny for x, y in a]
            pb = [x * nx + y * ny for x, y in b]
            if min(max(pa), max(pb)) - max(min(pa), min(pb)) < folga:
                return False
    return True


def casario(M, casas_osm, ruas, eixo_av, recinto_m):
    """
    Casas do Serviluz e do Titanzinho a partir do OSM: cada planta vira um retângulo orientado × 0,6, posto pela
    compressão radial; alturas do OSM × 0,9 (1 ou 2 pavimentos). Coberturas: laje com platibanda e caixa d'água azul ou
    telhado de barro de duas águas; reboco colorido ou tijolo aparente (cores genéricas do bairro, ficha). Portas e
    janelas nas faces livres, a porta na face que dá para a rua mais próxima.
    """
    rnd = random.Random(1846)
    escolhidas = []
    motivo = {}
    for pts, h, niv, wid in sorted(casas_osm, key=lambda c: math.hypot(*retangulo(c[0])[:2])):
        cx, cy, L, W, ang = retangulo(pts)
        mx, my = comprimir(cx, cy)
        L2, W2 = min(6.0, max(2.4, L * 0.6)), min(4.8, max(2.0, W * 0.6))
        cs = cantos(mx, my, L2, W2, ang)
        if any(math.hypot(*p) > RAIO - 0.5 for p in cs):
            motivo["disco"] = motivo.get("disco", 0) + 1
            continue
        if any(dist_mar(*p) > D_AREIA - 0.2 for p in cs):
            motivo["praia"] = motivo.get("praia", 0) + 1
            continue
        if not all(livre(p[0], p[1]) for p in cs + [(mx, my)]):
            motivo["reservado"] = motivo.get("reservado", 0) + 1
            continue
        # sobreposição com casa já posta (casas geminadas podem encostar)
        if any(sobrepoe(cs, c["cantos"], 0.4) for c in escolhidas):
            motivo["vizinha"] = motivo.get("vizinha", 0) + 1
            continue
        alt = max(2.5, h * 0.9)
        if niv >= 2:
            alt = max(alt, 4.7)
        escolhidas.append({"c": (mx, my), "L": L2, "W": W2, "ang": ang, "h": alt, "cantos": cs})
    n_osm = len(escolhidas)

    # quadras completadas: fileiras de casas geminadas de frente para as ruas do OSM, a avenida e o muro do recinto
    def tenta(mx, my, w, d, ang, alt):
        cs = cantos(mx, my, w, d, ang)
        if any(math.hypot(*p) > RAIO - 0.5 for p in cs) or any(dist_mar(*p) > D_AREIA - 0.2 for p in cs):
            motivo["f_disco"] = motivo.get("f_disco", 0) + 1
            return False
        if not all(livre(p[0], p[1]) for p in cs + [(mx, my)]):
            motivo["f_res"] = motivo.get("f_res", 0) + 1
            return False
        if any(sobrepoe(cs, c["cantos"]) for c in escolhidas):
            motivo["f_viz"] = motivo.get("f_viz", 0) + 1
            return False
        escolhidas.append({"c": (mx, my), "L": w, "W": d, "ang": ang, "h": alt, "cantos": cs})
        return True

    frentes = [(a, b, {"residential": 1.7, "pedestrian": 1.0, "footway": 0.7}[tipo] + 0.25) for a, b, tipo in ruas]
    frentes += [(a, b, 5.3) for a, b in zip(eixo_av, eixo_av[1:])]
    rec = anti_horario(recinto_m)
    frentes += [(a, b, 0.75) for a, b in zip(rec, rec[1:] + rec[:1])]
    for fileira in range(4):
        for a, b, hw in frentes:
            va, vb = Vector(a), Vector(b)
            L = (vb - va).length
            if L < 1.0:
                continue
            t = (vb - va) / L
            nl = Vector((-t.y, t.x))
            ang = math.degrees(math.atan2(t.y, t.x))
            for lado in (1, -1):
                s = rnd.uniform(0, 1.0)
                while s < L:
                    w, d = rnd.uniform(2.6, 4.0), rnd.uniform(3.0, 4.6)
                    alt = rnd.choice((2.6, 2.7, 2.9, 3.1, 3.3, 5.0, 2.8, 5.3))
                    off = hw + 0.15 + fileira * 4.9 + d / 2
                    c = va + t * (s + w / 2) + nl * (lado * off)
                    tenta(c.x, c.y, w, d, ang, alt)
                    s += w + rnd.choice((0.0, 0.0, 0.05, 0.6))
    # miolo das quadras: casas soltas onde ainda couber, no rumo da frente mais próxima (becos de ~1 m entre elas)
    n_fil = len(escolhidas)
    grade = [(x * 0.8, y * 0.8) for x in range(-42, 43) for y in range(-42, 43) if 16.5 < math.hypot(x * 0.8, y * 0.8) < 33]
    grade.sort(key=lambda p: (math.hypot(*p), p))
    for x, y in grade:
        if not livre(x, y, 1.0) or any(ponto_no_poligono((x, y), c["cantos"]) for c in escolhidas):
            continue
        melhor = min(frentes, key=lambda f: dist_poligono((x, y), [f[0], f[1], (f[1][0] + 1e-4, f[1][1] + 1e-4)]))
        ang0 = math.degrees(math.atan2(melhor[1][1] - melhor[0][1], melhor[1][0] - melhor[0][0]))
        alt = rnd.choice((2.6, 2.8, 3.0, 3.2, 2.7, 5.0, 2.9))
        for w, d in ((rnd.uniform(3.0, 3.8), rnd.uniform(3.4, 4.2)), (rnd.uniform(2.4, 3.0), rnd.uniform(2.8, 3.4))):
            if tenta(x, y, w, d, ang0 + rnd.choice((0, 0, 90)), alt):
                break
    print(f"casas: {n_osm} do OSM, {n_fil - n_osm} em fileiras e {len(escolhidas) - n_fil} no miolo das quadras")
    if os.environ.get("FAROL_DEPURAR"):
        with open(os.environ["FAROL_DEPURAR"], "w") as fh:
            json.dump({"livre": [[p, f] for p, f in LIVRE], "casas": [c["cantos"] for c in escolhidas], "frentes": [[a, b] for a, b, _ in frentes], "ocupado": [(x, y) for x in range(-33, 34) for y in range(-33, 34) if not livre(x, y)]}, fh)

    P = Peca("Casario_Serviluz")
    for i, c in enumerate(escolhidas):
        mx, my = c["c"]
        L, W, ang, h = c["L"], c["W"], c["ang"], c["h"]
        cor = PALETA_CASAS[rnd.randrange(len(PALETA_CASAS))]
        parede = tinta(M["parede"], cor)
        laje = rnd.random() < 0.5 or h > 4.4
        cs = c["cantos"]
        topo = tinta(M["laje"], rnd.choice(("#ffffff", "#f0ece4", "#e2ddd3", "#d6d2ca", "#f4e9dc")))
        P.juntar(bm_prisma(cs, Z0 - 0.02, Z0 + h, 0.0, mat_lados=1), [topo if laje else parede, parede])
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        if laje:
            # platibanda e caixa d'água
            pl = cantos(mx, my, L, W, ang)
            pi = cantos(mx, my, L - 0.3, W - 0.3, ang)
            for k in range(4):
                a, b, ai, bi = pl[k], pl[(k + 1) % 4], pi[k], pi[(k + 1) % 4]
                zt = Z0 + h + 0.28
                P.poli([(a[0], a[1], Z0 + h), (b[0], b[1], Z0 + h), (b[0], b[1], zt), (a[0], a[1], zt)], parede)
                P.poli([(a[0], a[1], zt), (b[0], b[1], zt), (bi[0], bi[1], zt), (ai[0], ai[1], zt)], parede)
                P.poli([(bi[0], bi[1], Z0 + h), (ai[0], ai[1], Z0 + h), (ai[0], ai[1], zt), (bi[0], bi[1], zt)], parede)
            if rnd.random() < 0.6:
                u = rnd.uniform(-L / 4, L / 4)
                v = rnd.uniform(-W / 5, W / 5)
                P.juntar(bm_cilindro(0.42, 0.55, 10, r2=0.46), M["caixa"], T(mx + u * ca - v * sa, my + u * sa + v * ca, Z0 + h))
                P.juntar(bm_cilindro(0.47, 0.06, 10), M["caixa"], T(mx + u * ca - v * sa, my + u * sa + v * ca, Z0 + h + 0.55))
        else:
            # duas águas ao longo do lado maior, beiral de 0,2 m, oitões na cor da casa
            sob = 0.2
            zc, zt = Z0 + h, Z0 + h + min(1.1, 0.32 * W)
            def pt(u, v, zz):
                return (mx + u * ca - v * sa, my + u * sa + v * ca, zz)
            hl, hw = L / 2 + sob, W / 2 + sob
            q1 = [pt(-hl, -hw, zc - 0.06), pt(hl, -hw, zc - 0.06), pt(hl, 0, zt), pt(-hl, 0, zt)]
            q2 = [pt(hl, hw, zc - 0.06), pt(-hl, hw, zc - 0.06), pt(-hl, 0, zt), pt(hl, 0, zt)]
            larg_agua = math.hypot(hw, zt - zc)
            for q in (q1, q2):
                P.poli(q, M["telha"], [(0, 0), (L + 2 * sob, 0), (L + 2 * sob, larg_agua), (0, larg_agua)])
            for s in (-1, 1):
                tri = [pt(s * L / 2, -W / 2, zc), pt(s * L / 2, W / 2, zc), pt(s * L / 2, 0, zt - 0.05)]
                P.poli(tri if s > 0 else tri[::-1], parede)
        # esquadrias: faces livres (o lado de fora não cai dentro de outra casa)
        faces = []
        for k in range(4):
            a, b = cs[k], cs[(k + 1) % 4]
            fx, fy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            t = Vector((b[0] - a[0], b[1] - a[1]))
            comp = t.length
            t.normalize()
            nrm = Vector((t.y, -t.x))
            if (fx - mx) * nrm.x + (fy - my) * nrm.y < 0:
                nrm = -nrm
            sonda = (fx + nrm.x * 0.6, fy + nrm.y * 0.6)
            ocupada = any(j != i and ponto_no_poligono(sonda, o["cantos"]) for j, o in enumerate(escolhidas))
            if ocupada:
                continue
            # distância da sonda à rua mais próxima (para escolher a frente)
            dmin = 1e9
            for (ra, rb, tipo) in ruas:
                dmin = min(dmin, dist_poligono(sonda, [ra, rb, (rb[0] + 1e-3, rb[1] + 1e-3)]))
            for p in eixo_av:
                dmin = min(dmin, math.hypot(sonda[0] - p[0], sonda[1] - p[1]) - 3)
            faces.append((dmin, a, b, comp, nrm))
        faces.sort(key=lambda f: f[0])
        cor_porta = tinta(M["esquadrias"], PORTAS[rnd.randrange(len(PORTAS))])
        for j, (dmin, a, b, comp, nrm) in enumerate(faces):
            t = Vector((b[0] - a[0], b[1] - a[1])).normalized()
            off = nrm * 0.025

            def quad(s, larg, z0, z1, reg, m):
                c0 = Vector(a) + t * (s - larg / 2) + off
                c1 = Vector(a) + t * (s + larg / 2) + off
                # a face tem de olhar para fora: ordem (base esq., base dir., topo dir., topo esq.) vista de fora
                if (t.x * nrm.y - t.y * nrm.x) > 0:
                    c0, c1 = c1, c0
                P.poli([(c0.x, c0.y, Z0 + z0), (c1.x, c1.y, Z0 + z0), (c1.x, c1.y, Z0 + z1), (c0.x, c0.y, Z0 + z1)], m,
                       [uv_reg(reg, u, v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))])
            if j == 0:
                if comp >= 3.0:
                    quad(comp * 0.3, 0.85, 0.0, 1.85, "casa_porta", cor_porta)
                    quad(comp * 0.7, 0.95, 0.85, 1.7, "casa_janela", M["esquadrias"])
                else:
                    quad(comp * 0.5, 0.85, 0.0, 1.85, "casa_porta", cor_porta)
            elif comp >= 2.2:
                quad(comp * 0.5, 0.9, 0.85, 1.7, "casa_janela", M["esquadrias"])
            if h > 4.4 and (j == 0 or comp >= 3.0):
                for s in ((0.3, 0.7) if comp >= 3.0 else (0.5,)):
                    quad(comp * s, 0.9, 3.0, 3.85, "casa_janela", M["esquadrias"])
    print(f"casas do OSM descartadas: {motivo}")
    return P.criar(), escolhidas


# ———————————————————————————————————————————————— praia: pedras, jangadas; porto

def praia(M):
    """
    Pedras da costa a oés-noroeste (OSM `natural=bare_rock` junto ao Titanzinho), entrando um pouco no mar, e duas
    jangadas na areia (ambientação: as jangadas do Mucuripe, sem posição real).
    """
    P = Peca("Praia_Pedras_Jangadas")
    rnd = random.Random(1872)
    for k in range(26):
        s = rnd.uniform(9.0, 19.5)
        d = D_AGUA + rnd.uniform(-1.4, 1.6) + (s - 9) * 0.05
        x, y = N_MAR.x * d + T_MAR.x * s, N_MAR.y * d + T_MAR.y * s
        if math.hypot(x, y) > RAIO - 0.9:
            continue
        r = rnd.uniform(0.45, 1.05)
        bm = bm_esfera(1.0, 1)
        for v in bm.verts:
            v.co *= 1 + rnd.uniform(-0.18, 0.18)
        bm.transform(Matrix.Diagonal((r * rnd.uniform(1.0, 1.5), r, r * rnd.uniform(0.5, 0.75), 1)))
        for v in bm.verts:
            v.co.z = max(v.co.z, 0.17 - Z0)       # fundo achatado: nada abaixo de y = 0
        P.juntar(bm, M["pedra"], T(x, y, Z0 - 0.15, rnd.uniform(0, 180)))
    for s, dd, giro in ((-6.5, D_AGUA - 2.6, 8.0), (-10.2, D_AGUA - 3.4, -6.0)):
        x, y = N_MAR.x * dd + T_MAR.x * s, N_MAR.y * dd + T_MAR.y * s
        ang = math.degrees(math.atan2(N_MAR.y, N_MAR.x)) + giro   # proa para o mar
        R_ = T(x, y, Z0, ang)
        # casco (pranchas) com proa afilada
        casco = [(-1.9, -0.55), (1.3, -0.55), (2.0, 0.0), (1.3, 0.55), (-1.9, 0.55)]
        P.juntar(bm_prisma(casco, 0.02, 0.3, 0.0, mat_lados=1), [M["madeira"], M["madeira"]], R_)
        P.juntar(bm_caixa(0.5, 1.0, 0.25), M["madeira"], R_ @ T(-0.8, 0, 0.3))      # banco do mestre
        barra(P, (R_ @ Vector((0.6, 0, 0.3))), (R_ @ Vector((0.6, 0, 4.2))), 0.09, M["madeira"])
        barra(P, (R_ @ Vector((0.6, 0, 0.9))), (R_ @ Vector((-1.6, 0, 1.1))), 0.07, M["madeira"])
        vela = [R_ @ Vector((0.62, 0.0, 1.0)), R_ @ Vector((0.62, 0.0, 4.1)), R_ @ Vector((-1.55, 0.0, 1.15))]
        P.poli([tuple(v) for v in vela], M["vela"])
        atras = (R_ @ Vector((0, 0.03, 0))) - (R_ @ Vector((0, 0, 0)))
        P.poli([tuple(v + atras) for v in reversed(vela)], M["vela"])
        reservar(ret(x - 2.2, y - 2.2, x + 2.2, y + 2.2), 0.2)
    return P.criar()


def porto(M, eixo_av):
    """
    Porto do Mucuripe (OSM `landuse=industrial`, "Cais do Porto"), do outro lado da Av. Vicente de Castro: o muro de
    concreto do cais e pilhas de contêineres atrás (ambientação: o pátio real não foi levantado).
    """
    P = Peca("Porto_Mucuripe")
    rnd = random.Random(1950)
    cores = ["#b8432f", "#2f5d8c", "#3f7a4f", "#d98a2b", "#7a7f86", "#b8432f", "#2f5d8c"]
    pts = []
    for a, b in zip(eixo_av, eixo_av[1:]):
        d = Vector((b[0] - a[0], b[1] - a[1]))
        if d.length < 1e-3:
            continue
        d.normalize()
        nl = Vector((d.y, -d.x))   # leste
        p0 = Vector(a) - nl * 4.5
        p1 = Vector(b) - nl * 4.5
        if math.hypot(*p0) > RAIO - 0.3 or math.hypot(*p1) > RAIO - 0.3:
            continue
        c = (p0 + p1) / 2
        ang = math.degrees(math.atan2(d.y, d.x))
        P.juntar(bm_caixa((p1 - p0).length + 0.02, 0.35, 2.1), M["concreto"], T(c.x, c.y, Z0 - 0.02, ang))
        P.juntar(bm_caixa((p1 - p0).length + 0.04, 0.45, 0.12), M["concreto"], T(c.x, c.y, Z0 + 2.08, ang))
        pts.append((c, d, nl, ang))
    # contêineres (12 × 2,4 × 2,6 m × 0,5) em pilhas, além do muro
    for (c, d, nl, ang) in pts[::2]:
        for fila in (1.6, 3.2):
            base = c - nl * fila
            if math.hypot(base.x, base.y) > RAIO - 3.3:
                continue
            n = rnd.choice((1, 2, 2, 3))
            for k in range(n):
                cor = cores[rnd.randrange(len(cores))]
                bm = bm_caixa(5.9, 1.2, 1.28)
                uvl = bm.loops.layers.uv.new("UVMap")
                for f in bm.faces:
                    for l in f.loops:
                        co = l.vert.co
                        if abs(f.normal.y) > 0.5:
                            l[uvl].uv = uv_reg("conteiner", co.x / 5.9 + 0.5, co.z / 1.28)
                        elif abs(f.normal.x) > 0.5:
                            l[uvl].uv = uv_reg("conteiner", co.y / 1.2 * 0.2 + 0.5, co.z / 1.28)
                        else:
                            l[uvl].uv = uv_reg("conteiner", 0.5, 0.5)
                P.juntar(bm, tinta(M["esquadrias"], cor), T(base.x, base.y, Z0 + k * 1.3, ang + rnd.uniform(-2, 2)))
    return P.criar()


# ———————————————————————————————————————————————— vegetação, gente e carros (layout para o .tsx)

def layout(eixo_av, ruas, portao, escada, casas):
    rnd = random.Random(1957)
    coqueiros = []   # (x, y, altura, giro, inclinação)
    for s in (-15.5, -3.0, 2.5, 7.5, 12.5, 17.5):
        d = D_AREIA + rnd.uniform(0.3, 1.2)
        x, y = N_MAR.x * d + T_MAR.x * s, N_MAR.y * d + T_MAR.y * s
        if math.hypot(x, y) < RAIO - 1.5:
            coqueiros.append((x, y, rnd.uniform(6.0, 7.6), rnd.uniform(0, 360), rnd.uniform(0.04, 0.14)))
    arvores = []
    tent = 0
    while len(arvores) < 7 and tent < 3000:
        tent += 1
        a, r = rnd.uniform(0, 2 * math.pi), rnd.uniform(18.5, 31.5)
        x, y = r * math.cos(a), r * math.sin(a)
        if dist_mar(x, y) > D_AREIA - 1.5:
            continue
        rr = rnd.uniform(1.3, 1.9)
        if not livre(x, y, rr * 0.5) or any(ponto_no_poligono((x, y), c["cantos"]) for c in casas):
            continue
        if any(dist_poligono((x, y), c["cantos"]) < rr * 0.4 for c in casas):
            continue
        if any(math.hypot(x - q[0], y - q[1]) < 6 for q in arvores):
            continue
        arvores.append((x, y, rnd.uniform(1.4, 2.0), rr))
    pessoas = []   # (x, y, z, giro, cor)
    xw, yw = portao
    x0, x1, yb, yp = escada
    lugares = [
        # no platô, em volta do farol e no caminho do portão
        ((-9.0, 0.0), (2.0, 0.8), ZP, 3), ((0.0, -8.4), (3.5, 0.6), ZP, 3), ((7.5, 3.0), (1.2, 3.0), ZP, 2), ((-3.0, 8.4), (3.0, 0.6), ZP, 2),
        # na praia
        (tuple(N_MAR * (D_AREIA + 2.2) + T_MAR * 2.0), (6.0, 1.2), Z0, 6),
        # na calçada da avenida, perto da escadaria
        ((x0 - 1.2, yb - 1.0), (0.4, 1.0), Z0 + 0.13, 2),
    ]
    for (cx, cy), (ax, ay), zz, n in lugares:
        k = t = 0
        while k < n and t < 500:
            t += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            if zz == ZP and math.hypot(x, y) < R_CORPO + 0.9:
                continue
            if zz == Z0 and not livre(x, y, 0.1):
                continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.7 for p in pessoas):
                continue
            pessoas.append((x, y, zz, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    # na escadaria, subindo
    for k, fr in ((2, 0.3), (6, 0.7)):
        y = yp - k * 0.42 - 0.2
        pessoas.append(((x0 + x1) / 2 + 0.2, y, Z0 + H_PLATO - k * (H_PLATO / 9), 90.0, k % 6))
    # nas ruas do bairro
    for (ra, rb, tipo) in rnd.sample(ruas, min(7, len(ruas))):
        x, y = (ra[0] + rb[0]) / 2 + rnd.uniform(-0.4, 0.4), (ra[1] + rb[1]) / 2 + rnd.uniform(-0.4, 0.4)
        if math.hypot(x, y) < RAIO - 1 and not any(ponto_no_poligono((x, y), c["cantos"]) for c in casas):
            pessoas.append((x, y, Z0, rnd.uniform(0, 360), rnd.randrange(6)))
    carros = []   # (x, y, giro, cor) na avenida
    for i in (1, 2, 3, 5, 6, 8, 9, 10):
        if i + 1 >= len(eixo_av):
            continue
        a, b = eixo_av[i], eixo_av[i + 1]
        d = Vector((b[0] - a[0], b[1] - a[1])).normalized()
        nl = Vector((-d.y, d.x))
        pista = (-2.0, 0.0, 2.0)[i % 3]
        p = Vector(a) + nl * pista
        if math.hypot(p.x, p.y) > RAIO - 2.2:
            continue
        g = math.degrees(math.atan2(d.y, d.x)) + (180 if pista > 0 else 0)
        carros.append((p.x, p.y, g, i % 7))
    return coqueiros, arvores, pessoas, carros


def proxies(coqueiros, arvores, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.8, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h + r * 0.8))
    for x, y, h, g, inc in coqueiros:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((2.2, 2.2, 0.6, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(3.0, 1.35, 1.1), m, T(x, y, Z0, g))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada e tintas

def proxy_chao(recinto_m):
    """Superfície de chão para assar a oclusão de cima: o disco na altura da rua e o recinto na altura do platô"""
    contorno = circulo(96, RAIO)
    rec = anti_horario(recinto_m)
    verts = [Vector((x, y)) for x, y in contorno + rec]
    n0 = len(contorno)
    edges = [(i, (i + 1) % n0) for i in range(n0)] + [(n0 + i, n0 + (i + 1) % len(rec)) for i in range(len(rec))]
    # pontos internos para a malha ter densidade
    for gx in range(-33, 34, 3):
        for gy in range(-33, 34, 3):
            if math.hypot(gx, gy) < RAIO - 1 and dist_poligono((gx, gy), rec) > 0.6:
                verts.append(Vector((gx, gy)))
    out = delaunay_2d_cdt(verts, edges, [], 0, 1e-5)
    vs, fs = out[0], out[2]
    bm = bmesh.new()
    cache = {}

    def v(i, alto):
        k = (i, alto)
        if k not in cache:
            cache[k] = bm.verts.new((vs[i].x, vs[i].y, (ZP if alto else Z0) + 0.05))
        return cache[k]
    for f in fs:
        cx = sum(vs[i].x for i in f) / len(f)
        cy = sum(vs[i].y for i in f) / len(f)
        if math.hypot(cx, cy) > RAIO:
            continue
        alto = ponto_no_poligono((cx, cy), rec)
        try:
            bm.faces.new([v(i, alto) for i in f])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    me = bpy.data.meshes.new("Proxy_Chao_AO")
    bm.to_mesh(me)
    bm.free()
    return me


def assar(objs_vertice, objs_chao, proxy, recinto_m):
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
    me = proxy_chao(recinto_m)
    uv = me.uv_layers.new(name="UVMap")
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = (co.x / LADO_AO + 0.5, co.y / LADO_AO + 0.5)
    placa = bpy.data.objects.new("Proxy_Chao_AO", me)
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

def tres(x, y):
    """Blender (x leste, y norte) → three (x, −y)"""
    return round(x, 3), round(-y, 3)


def principal():
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = criar_materiais()
    M["piso_degrau"] = mat("Mat_Pedra_Degraus", "#d9d2c3", 0.85)
    recinto, casas_osm, vias = ler_osm()
    recinto_m = [comprimir(*p) for p in recinto]
    eixo_av, ruas = chao(M, recinto_m, vias)
    rec_ob, portao, escada = plato(M, recinto_m)
    topo = topo_plato(M, recinto_m, portao)
    far, z_topo = farol(M)
    praia_ob = praia(M)
    porto_ob = porto(M, eixo_av)
    casas_ob, casas = casario(M, casas_osm, ruas, eixo_av, recinto_m)
    obs = [rec_ob, far, praia_ob, porto_ob, casas_ob]
    coqueiros, arvores, pessoas, carros = layout(eixo_av, ruas, portao, escada, casas)
    print(f"coqueiros {len(coqueiros)}, árvores {len(arvores)}, pessoas {len(pessoas)}, carros {len(carros)}; topo do farol {z_topo:.2f} m")
    prox = proxies(coqueiros, arvores, carros)
    chao_objs = [bpy.data.objects[n] for n in ("Chao_Base", "Chao_Pisos", "Chao_Plato")]
    for ob in chao_objs:
        me = ob.data
        uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
        for lp in me.loops:
            co = me.vertices[lp.vertex_index].co
            uv.data[lp.index].uv = (co.x / LADO_AO + 0.5, co.y / LADO_AO + 0.5)
    if not SEM_BAKE:
        assar(obs, chao_objs, prox, recinto_m)
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
    dados = {
        "coqueiros": [[*tres(x, y), round(h, 3), round(math.radians(g), 3), round(inc, 3)] for x, y, h, g, inc in coqueiros],
        "arvores": [[tres(x, y)[0], round(Z0 + h, 3), tres(x, y)[1], round(r, 3)] for x, y, h, r in arvores],
        "pessoas": [[tres(x, y)[0], round(z, 3), tres(x, y)[1], round(math.radians(g), 3), k] for x, y, z, g, k in pessoas],
        "carros": [[*tres(x, y), round(math.radians(g), 3), k] for x, y, g, k in carros],
        "chao": {"lado": LADO_AO, "z0": Z0, "zp": ZP},
        "topo": round(z_topo, 2),
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
