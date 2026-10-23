# -*- coding: utf-8 -*-
"""
Unifor (Universidade de Fortaleza) em miniatura: gera as peças estáticas do marco no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/unifor.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/unifor.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o Unifor.tsx carrega as três):
    unifor-campus.glb    chão, avenida, Reitoria, Biblioteca, Centro de Convivência, blocos, jardim (sem compressão,
                         com a oclusão de ambiente assada nas cores de vértice dos prédios)
    unifor-ao-chao.jpg   oclusão de ambiente do chão, assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    unifor-layout.json   posições das árvores, palmeiras e carros (o .tsx instancia), já em coordenadas do three

Medidas: planta do OpenStreetMap (pesquisa/unifor/ficha.md) em metros reais em volta do ponto do tour
(−3,7687; −38,4777), encolhida a K ≈ 0,15; os protagonistas crescem 1,4–1,55×; alturas exageradas como nos outros marcos.
Coordenadas do Blender: x = leste, y = norte, z = cima (o exportador converte para y-cima com o norte em −z).
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
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do gramado: tudo pousa aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
GIRO_FRENTE = 6.0    # a Washington Soares corre a 354° (6° para oeste do norte): a frente inteira gira junto
RUMO_BLOCOS = 65.0   # eixo maior das barras de aula (malha do campus a 65°/155°)
RUMO_BIBLIOTECA = -23.5

# ———————————————————————————————————————————————— utilidades de plano

def girar(p, graus, c=(0.0, 0.0)):
    a = math.radians(graus)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))


def frente(p):
    """Leva um ponto do referencial da frente (avenida ao longo de y) para a planta, girando 6° em volta da origem"""
    return girar(p, GIRO_FRENTE)


def dir_rumo(graus):
    """Vetor unitário (x, y) de um rumo em graus a partir do norte, no sentido horário"""
    a = math.radians(graus)
    return (math.sin(a), math.cos(a))


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


def retangulo(c, comp, larg, rumo):
    """Retângulo de centro c, eixo maior `comp` no rumo dado (graus do norte) e largura `larg`"""
    u = dir_rumo(rumo)
    v = (u[1], -u[0])
    h, w = comp / 2, larg / 2
    return [(c[0] + su * h * u[0] + sv * w * v[0], c[1] + su * h * u[1] + sv * w * v[1]) for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1))]


def faixa(pontos, larg):
    """Polígonos (um por trecho) de uma faixa de largura `larg` ao longo de uma polilinha"""
    out = []
    for a, b in zip(pontos, pontos[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy)
        nx, ny = -dy / l * larg / 2, dx / l * larg / 2
        out.append([(a[0] - nx, a[1] - ny), (b[0] - nx, b[1] - ny), (b[0] + nx, b[1] + ny), (a[0] + nx, a[1] + ny)])
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
    """Distância de p à borda do polígono (0 se dentro)"""
    if ponto_no_poligono(p, poli):
        return 0.0
    m = 1e9
    for a, b in zip(poli, poli[1:] + poli[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        m = min(m, math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    return m


# zonas onde não nasce árvore (planta, com folga): os prédios e pisos se registram aqui
LIVRE_POLIS = []   # (polígono, folga)
LIVRE_CIRCS = []   # (cx, cy, raio)


def reservar(poli, folga=0.6):
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

    def juntar(self, bm2, m, M=None, liso=None, uvf=None):
        """Copia um bmesh temporário; `m` é um material ou uma lista indexada pelo material_index da face"""
        if M is not None:
            bm2.transform(M)
        uv2 = bm2.loops.layers.uv.active
        mp = {v: self.bm.verts.new(v.co) for v in bm2.verts}
        for f in bm2.faces:
            nf = self.bm.faces.new([mp[v] for v in f.verts])
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
    if chanfro > 0 and min(sx, sy, sz) >= 0.35:      # em peças finas o chanfro não aparece e só multiplica vértices
        c = min(chanfro, sx / 4, sy / 4, sz / 4)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=c, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_prisma(pts, z0, z1, chanfro=0.0, mat_lados=1):
    """Prisma vertical da planta `pts`; face de cima e de baixo com material 0, lados com `mat_lados`"""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    novos = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    for v in novos:
        v.co.z = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        fc.material_index = 0 if abs(fc.normal.z) > 0.5 else mat_lados
    if chanfro > 0:
        borda = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=borda, offset=chanfro, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
        for fc in bm.faces:
            fc.material_index = 0 if fc.normal.z > 0.5 or fc.normal.z < -0.5 else mat_lados
    return bm


def bm_cilindro(r, h, n=16, r2=None, tampa=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tampa, cap_tris=False, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=Vector((0, 0, h / 2)), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_torno(perfil, n=32, a0=0.0, a1=2 * math.pi, fechar=True):
    """Superfície de revolução de um perfil [(r, z), ...] em volta do eixo z (normais para fora)"""
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


def bm_cupula(r, h, n=40, aneis=10, z0=0.0):
    """Calota achatada: meia esfera de raio r com altura h (sem fundo)"""
    perfil = []
    for k in range(aneis + 1):
        t = (math.pi / 2) * k / aneis
        perfil.append((r * math.cos(t), z0 + h * math.sin(t)))
    perfil[-1] = (0.0, z0 + h)
    return bm_torno(perfil, n)


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


def giro_de_rumo(rumo):
    """Giro (anti-horário a partir do eixo x) que alinha o eixo x local com o rumo dado"""
    return 90.0 - rumo


# ———————————————————————————————————————————————— texturas geradas aqui

def atlas_esquadrias(n=256):
    """
    Atlas 256 × 256 de esquadrias (quatro quadrantes, V para cima como no Blender):
      A (0–0,5 × 0,5–1)  janela do 2º pavimento da Reitoria: 4 colunas × 3 linhas, caixilho branco, vidro claro
      B (0,5–1 × 0,5–1)  fita do térreo da Reitoria: 6 folhas, algumas com painel vinho (as fotos mostram)
      C (0–0,5 × 0–0,5)  pele de vidro azul das torres do Convivência: grade 6 × 10
      D (0,5–1 × 0–0,5)  fita de janelas genérica (blocos, Biblioteca, tambor): vidro escuro, montante branco a cada 1/6
    """
    px = [0.0] * (n * n * 4)

    def ret(x0, y0, x1, y1, cor):
        c = srgb_lin(cor)
        for y in range(max(0, int(y0)), min(n, int(y1))):
            for x in range(max(0, int(x0)), min(n, int(x1))):
                i = (y * n + x) * 4
                px[i:i + 4] = [c[0], c[1], c[2], 1.0]

    h = n // 2
    # A: vidro claro que reflete o céu, com caixilhos brancos
    ret(0, h, h, n, "#f2f1ec")
    for ci in range(4):
        for li in range(3):
            x0, x1 = ci * h / 4 + 3, (ci + 1) * h / 4 - 2
            y0, y1 = h + li * h / 3 + 3, h + (li + 1) * h / 3 - 2
            ret(x0, y0, x1, y1, "#97adbf" if (ci + li) % 3 else "#adc0cf")
            ret(x0, y1 - (y1 - y0) * 0.35, x1, y1, "#c4d2dc")
    # B: térreo — caixilho branco, vidro escuro e painéis vinho
    ret(h, h, n, n, "#efeee9")
    for ci in range(6):
        x0, x1 = h + ci * h / 6 + 3, h + (ci + 1) * h / 6 - 2
        y0, y1 = h + 10, n - 10
        ret(x0, y0, x1, y1, "#7a3b36" if ci in (1, 4) else "#4c5c6a")
        ret(x0, y1 - 14, x1, y1, "#8fa3b3" if ci not in (1, 4) else "#8c4a43")
    # C: pele de vidro azul, montantes azul-acinzentados
    ret(0, 0, h, h, "#9db0cf")
    for ci in range(6):
        for li in range(10):
            x0, x1 = ci * h / 6 + 1.5, (ci + 1) * h / 6 - 1
            y0, y1 = li * h / 10 + 1.5, (li + 1) * h / 10 - 1
            ret(x0, y0, x1, y1, ["#21468e", "#2a55a3", "#1c3c7c"][(ci * 7 + li * 3) % 3])
    # D: fita genérica — vidro escuro com reflexo no alto, montante branco a cada sexto
    ret(h, 0, n, h, "#f0efea")
    for ci in range(6):
        x0, x1 = h + ci * h / 6 + 2, h + (ci + 1) * h / 6 - 1
        ret(x0, 6, x1, h - 6, "#3d4c5c")
        ret(x0, h - 22, x1, h - 6, "#5d6f80")
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
    "universidade": (0, 0, 512, 64),
    "fundacao": (0, 64, 256, 128),
    "totem": (256, 64, 320, 256),
    "mural": (320, 64, 512, 256),
}


def uv_letreiro(reg, a, b):
    x0, y0, x1, y1 = LETREIROS[reg]
    return ((x0 + (x1 - x0) * a) / 512, 1 - (y0 + (y1 - y0) * (1 - b)) / 256)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["grama"] = mat("Mat_Chao_Grama", "#6f9a47", 0.95)
    M["grama_canteiro"] = M["grama"]
    M["praca"] = mat("Mat_Chao_Piso", "#d6cab2", 0.9)
    M["caminho"] = M["praca"]
    M["calcada"] = mat("Mat_Chao_Calcada", "#bdbab2", 0.9)
    M["asfalto"] = mat("Mat_Chao_Asfalto", "#55595d", 0.95)
    M["faixa"] = mat("Mat_Chao_Faixa", "#efeee6", 0.8)
    M["verde"] = mat("Mat_Verde_Reitoria", "#80a548", 0.7)
    M["pastilha"] = mat("Mat_Pastilha_Bege", "#d8cfb5", 0.85)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.35, 0.0, atlas)
    M["cobertura"] = mat("Mat_Cobertura_Clara", "#c6c8c2", 0.7)
    M["concreto"] = mat("Mat_Concreto_Claro", "#c4beb0", 0.85)
    M["meiofio"] = M["concreto"]
    M["branco"] = mat("Mat_Branco_Fachada", "#f1f0ea", 0.6)
    M["cupula"] = mat("Mat_Cupula_Branca", "#f7f6f1", 0.45)
    M["azul"] = mat("Mat_Azul_Unifor", "#1f3f8c", 0.55)
    M["petroleo"] = mat("Mat_Parede_Petroleo", "#2f6f8c", 0.7)
    M["letreiros"] = mat("Mat_Letreiros", "#ffffff", 0.6)
    M["telha"] = mat("Mat_Telha_Metalica", "#b4b9bc", 0.5, 0.3)
    M["reboco"] = mat("Mat_Reboco_Branco", "#e2dfd6", 0.85)
    M["gradil"] = mat("Mat_Gradil_Verde", "#2e5a3a", 0.55, 0.35)
    M["granito"] = mat("Mat_Granito", "#a39d93", 0.6)
    M["marmore"] = mat("Mat_Marmore", "#f5f3ee", 0.4)
    M["bronze"] = mat("Mat_Bronze", "#6b5640", 0.45, 0.5)
    M["pedra"] = M["concreto"]
    M["arbusto"] = mat("Mat_Arbusto", "#3f6d33", 0.9)
    M["flores"] = mat("Mat_Flores_Ixora", "#c4493c", 0.85)
    M["agua"] = mat("Mat_Agua", "#41b1dc", 0.08, 0.05)
    M["poste"] = mat("Mat_Poste_Metal", "#9aa0a3", 0.45, 0.4)
    return M


# ———————————————————————————————————————————————— chão e avenida

def chao(M):
    """Gramado em disco, avenida de duas pistas com canteiro, calçada, caminhos, praça e estacionamento"""
    g = Peca("Chao_Gramado")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=0), M["grama"])
    g.criar()

    # ——— Washington Soares (referencial da frente: a avenida corre ao longo de y)
    av = Peca("Av_Washington_Soares")
    def faixa_x(x0, x1, z0, z1, mtopo, mlado, chanfro=0.0, r=RAIO - 0.05):
        poli = recortar_no_disco([frente(p) for p in [(x0, -40), (x1, -40), (x1, 40), (x0, 40)]], r)
        av.juntar(bm_prisma(poli, z0, z1, chanfro, mat_lados=1), [mtopo, mlado])
        return poli
    faixa_x(-29.0, -25.6, Z0 - 0.02, Z0 + 0.012, M["asfalto"], M["asfalto"])          # pista leste (sentido norte)
    faixa_x(-34.0, -30.4, Z0 - 0.02, Z0 + 0.012, M["asfalto"], M["asfalto"])          # pista oeste (sentido sul)
    faixa_x(-30.4, -29.0, Z0 - 0.02, Z0 + 0.15, M["grama_canteiro"], M["meiofio"], 0.03)  # canteiro central
    cal = faixa_x(-25.6, -24.2, Z0 - 0.02, Z0 + 0.14, M["calcada"], M["meiofio"], 0.03)   # calçada do campus
    reservar(cal, 0.3)
    # faixas pintadas: tracejado entre as faixas de rolamento e linhas de bordo contínuas
    for xc in (-26.73, -27.87, -31.53, -32.67):
        y = -40.0
        while y < 40:
            q = [frente(p) for p in [(xc - 0.06, y), (xc + 0.06, y), (xc + 0.06, y + 1.1), (xc - 0.06, y + 1.1)]]
            if all(math.hypot(*p) < RAIO - 0.3 for p in q):
                av.poli([(x, yy, Z0 + 0.014) for x, yy in q], M["faixa"])
            y += 2.6
    for xc in (-25.78, -28.82, -30.58, -33.7):
        q = recortar_no_disco([frente(p) for p in [(xc - 0.05, -40), (xc + 0.05, -40), (xc + 0.05, 40), (xc - 0.05, 40)]], RAIO - 0.2)
        if len(q) >= 3:
            av.poli([(x, yy, Z0 + 0.014) for x, yy in q], M["faixa"])
    av.criar()
    reservar(recortar_no_disco([frente(p) for p in [(-40, -40), (-24.2, -40), (-24.2, 40), (-40, 40)]]), 0.3)

    # ——— pisos do campus (caminhos de ladrilho, praça, jardim da Reitoria)
    pisos = Peca("Chao_Pisos")
    def piso(poli, m, z=0.012, reserva=0.4):
        pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=0), m)
        if reserva is not None:
            reservar(poli, reserva)
    # jardim da Reitoria: acesso do portão até a porta e o largo redondo da fonte
    piso([frente(p) for p in [(-24.2, -0.55), (-18.9, -0.55), (-18.9, 1.75), (-24.2, 1.75)]], M["caminho"])
    piso([frente((-21.4 + 2.5 * math.cos(a), 0.6 + 2.5 * math.sin(a))) for a in [2 * math.pi * i / 40 for i in range(40)]], M["caminho"], 0.014)
    # calçada colada à fachada curva (raio da frente 12,7 m, centro do arco em (−31,5; 0,6))
    arco = [(-31.5 + 11.8 * math.cos(math.radians(a)), 0.6 + 11.8 * math.sin(math.radians(a))) for a in range(-33, 34, 3)]
    arco += [(-31.5 + 12.75 * math.cos(math.radians(a)), 0.6 + 12.75 * math.sin(math.radians(a))) for a in range(33, -34, -3)]
    piso([frente(p) for p in arco], M["caminho"], 0.013, None)
    # eixo de pedestres: fundos da Reitoria → Biblioteca → Praça Central → pórtico do Convivência
    for q in faixa([frente((-8.4, -0.7)), (-5.4, -3.4), (0.5, -5.6), (5.0, -6.4)], 1.5):
        piso(q, M["caminho"], 0.012, 0.3)
    for q in faixa([(7.0, -10.0), (9.6, -15.2), (12.6, -17.6)], 1.3):
        piso(q, M["caminho"], 0.012, 0.3)
    for q in faixa([(-3.2, 8.4), (-1.8, 13.0), (0.4, 17.0)], 1.2):
        piso(q, M["caminho"], 0.012, 0.3)
    for q in faixa([(-6.2, -4.4), (-9.6, -9.6), (-10.4, -16.0)], 1.2):
        piso(q, M["caminho"], 0.012, 0.3)
    # Praça Central: largo pavimentado na frente do pórtico do Convivência (OSO do tambor)
    praca = [(3.0, -3.8), (5.2, -2.2), (7.8, -2.4), (9.6, -4.4), (10.0, -7.6), (8.8, -10.4), (5.9, -11.3), (3.2, -10.2), (2.2, -7.2)]
    piso(praca, M["praca"], 0.014, 0.0)
    # estacionamento do Bloco H (OSM), sob as árvores, no rumo da malha do campus
    est = retangulo((-7.4, 12.2), 7.6, 4.8, RUMO_BLOCOS)
    pisos.juntar(bm_prisma(est, Z0 - 0.01, Z0 + 0.012, 0.0, mat_lados=0), M["asfalto"])
    reservar(est, 0.2)
    u, v = dir_rumo(RUMO_BLOCOS), dir_rumo(RUMO_BLOCOS + 90)
    for k in range(-3, 4):
        for lado in (-1, 1):
            cx, cy = -7.4 + u[0] * k * 1.05 + v[0] * lado * 1.3, 12.2 + u[1] * k * 1.05 + v[1] * lado * 1.3
            q = retangulo((cx, cy), 2.0, 0.06, RUMO_BLOCOS + 90)
            pisos.poli([(x, y, Z0 + 0.014) for x, y in q], M["faixa"])
    pisos.criar()
    return est


# ———————————————————————————————————————————————— Reitoria

class Arco:
    """Ala curva da Reitoria: anel de centro c, frente côncava (raio r1, para a avenida) e fundos convexos (r2)"""

    def __init__(self, c, r1, r2, a0, a1):
        self.c, self.r1, self.r2, self.a0, self.a1 = c, r1, r2, a0, a1

    def p(self, r, a, z):
        x, y = frente((self.c[0] + r * math.cos(a), self.c[1] + r * math.sin(a)))
        return (x, y, z)


def reitoria(M):
    """
    Reitoria (fotos ref-2 e ref-4; planta do OSM): ala curva de 2 pavimentos voltada para a Washington Soares, com
    pilastras verdes, faixa verde com um arco abatido por vão, janelas de caixilho branco e pastilha bege; ala leste–oeste
    mais alta saindo do meio pelos fundos (o volume cinza com antenas que aparece atrás nas fotos).
    """
    P = Peca("Reitoria")
    A = Arco((-31.5, 0.6), 12.7, 16.3, math.radians(-31), math.radians(31))
    NB = 9
    H1, H2, HP = 2.4, 4.75, 5.35      # topo do térreo, topo da parede, topo da platibanda verde
    seg = NB * 2
    ang = [A.a0 + (A.a1 - A.a0) * i / seg for i in range(seg + 1)]

    # corpo: setor anular em pastilha, cobertura clara recuada atrás da platibanda
    def anel(r_in, r_out, z0, z1, mfr, mfu, mtopo, mlado, a_lista):
        for a, b in zip(a_lista, a_lista[1:]):
            P.poli([A.p(r_in, b, z0), A.p(r_in, a, z0), A.p(r_in, a, z1), A.p(r_in, b, z1)], mfr)    # frente (para o centro)
            P.poli([A.p(r_out, a, z0), A.p(r_out, b, z0), A.p(r_out, b, z1), A.p(r_out, a, z1)], mfu)  # fundos
            P.poli([A.p(r_in, a, z1), A.p(r_out, a, z1), A.p(r_out, b, z1), A.p(r_in, b, z1)], mtopo)
        a, b = a_lista[0], a_lista[-1]
        P.poli([A.p(r_in, a, z0), A.p(r_out, a, z0), A.p(r_out, a, z1), A.p(r_in, a, z1)], mlado)
        P.poli([A.p(r_out, b, z0), A.p(r_in, b, z0), A.p(r_in, b, z1), A.p(r_out, b, z1)], mlado)
    anel(A.r1, A.r2, Z0, Z0 + H2, M["pastilha"], M["pastilha"], M["cobertura"], M["pastilha"], ang)
    # platibanda: mureta verde na frente e nas pontas, concreto claro nos fundos
    anel(A.r1 - 0.02, A.r1 + 0.2, Z0 + H2, Z0 + HP, M["verde"], M["verde"], M["verde"], M["verde"], ang)
    anel(A.r2 - 0.18, A.r2, Z0 + H2, Z0 + HP - 0.12, M["concreto"], M["concreto"], M["concreto"], M["concreto"], ang)
    for a in (A.a0, A.a1):
        x, y, _ = A.p((A.r1 + A.r2) / 2, a, 0)
        P.juntar(bm_caixa(A.r2 - A.r1, 0.2, HP - H2, 0.03), M["verde"], M_em(x, y, Z0 + H2, math.degrees(a) + GIRO_FRENTE))

    for a, s in ((A.a0, -1), (A.a1, 1)):
        x0, y0, _ = A.p(A.r1, a, 0)
        x1, y1, _ = A.p(A.r2, a, 0)
        o = Vector((x0, y0, Z0))
        u_ = (Vector((x1, y1, Z0)) - o)
        lw = u_.length
        u_.normalize()
        n_ = Vector((u_.y, -u_.x, 0)) * (-s)          # para fora da ponta
        E = lambda u, v, w: tuple(o + u_ * u + Vector((0, 0, v)) + n_ * w)
        ordem = (lambda q: q) if s < 0 else (lambda q: [q[1], q[0], q[3], q[2]])
        for (v0, v1, reg) in ((2.85, 4.25, "A"), (0.85, 1.95, "B")):
            q = ordem([(0.45, v0), (lw - 0.45, v0), (lw - 0.45, v1), (0.45, v1)])
            uvq = ordem([(0, 0), (1, 0), (1, 1), (0, 1)])
            P.poli([E(u, v, 0.025) for u, v in q], M["esquadrias"], [uv_reg(reg, a_, b_ * (0.82 if reg == "A" else 1)) for a_, b_ in uvq])
        P.juntar(bm_poli_extrudado([E(u, v, 0) for u, v in ((0.0, 4.4), (lw, 4.4), (lw, HP), (0.0, HP))], tuple(n_ * 0.1)), M["verde"])

    # vãos da fachada da frente: quadro local (u ao longo da fachada, v para cima, w para fora)
    def quadro(a_meio, r):
        x, y, _ = A.p(r, a_meio, 0)
        cx, cy = frente(A.c)
        n = Vector((cx - x, cy - y, 0)).normalized()          # para fora da frente côncava = para o centro do arco
        t = Vector((-n.y, n.x, 0))                             # da esquerda para a direita de quem olha a fachada
        o = Vector((x, y, Z0))
        return lambda u, v, w: tuple(o + t * u + Vector((0, 0, v)) + n * w)

    larg_vao = 2 * A.r1 * math.sin((A.a1 - A.a0) / NB / 2)
    for i in range(NB):
        am = A.a0 + (A.a1 - A.a0) * (i + 0.5) / NB
        Q = quadro(am, A.r1)
        hw = larg_vao / 2 - 0.15                       # meia largura livre entre pilastras
        # janela do 2º pavimento com o topo acompanhando o arco abatido (caixilho do atlas A)
        nseg = 10
        v_base, v_mola, v_topo = 2.85, 3.95, 4.5
        arco_pts = []
        for k in range(nseg + 1):
            t = k / nseg
            u = -hw + 2 * hw * t
            arco_pts.append((u, v_mola + (v_topo - v_mola) * math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2))))
        contorno = [(-hw, v_base), (hw, v_base)] + list(reversed(arco_pts))
        P.poli([Q(u, v, 0.025) for u, v in contorno], M["esquadrias"],
               [uv_reg("A", (u + hw) / (2 * hw), (v - v_base) / (v_topo - v_base)) for u, v in contorno])
        # peitoril branco sob a janela
        P.juntar(bm_caixa(2 * hw + 0.1, 0.12, 0.08, 0.02), M["concreto"], Matrix.Translation(Q(0, v_base - 0.08, 0.04)) @ Matrix.Rotation(math.atan2(*(Vector(Q(1, 0, 0)) - Vector(Q(0, 0, 0))).yx), 4, "Z"))
        # faixa verde em arco: do arco até a platibanda, saliente 0,12 m
        faixa_arco = [(-larg_vao / 2, v_mola - 0.12), (-hw, v_mola - 0.12)] + [(u, v + 0.0) for u, v in arco_pts] + [(hw, v_mola - 0.12), (larg_vao / 2, v_mola - 0.12), (larg_vao / 2, HP), (-larg_vao / 2, HP)]
        P.juntar(bm_poli_extrudado([Q(u, v, 0.0) for u, v in faixa_arco], tuple(Vector(Q(0, 0, 0.12)) - Vector(Q(0, 0, 0)))), M["verde"])
        # térreo: fita de janelas com caixilho branco e painéis vinho (atlas B); o vão do meio é a entrada
        if i == NB // 2:
            P.poli([Q(u, v, 0.03) for u, v in [(-hw, 0.0), (hw, 0.0), (hw, 2.15), (-hw, 2.15)]], M["esquadrias"],
                   [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
            # marquise branca da entrada sobre dois pilaretes
            o = Vector(Q(0, 2.25, 0.75))
            giro = math.atan2(*(Vector(Q(1, 0, 0)) - Vector(Q(0, 0, 0))).yx)
            P.juntar(bm_caixa(2 * hw + 0.3, 1.1, 0.12, 0.04), M["branco"], Matrix.Translation(Vector(Q(0, 2.25, 0.55))) @ Matrix.Rotation(giro, 4, "Z"))
            for s in (-1, 1):
                P.juntar(bm_cilindro(0.06, 2.25, 8), M["branco"], Matrix.Translation(Q(s * (hw + 0.0), 0.0, 0.95)))
        else:
            P.poli([Q(u, v, 0.025) for u, v in [(-hw, 0.85), (hw, 0.85), (hw, 1.95), (-hw, 1.95)]], M["esquadrias"],
                   [uv_reg("B", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
        # fundos: duas fitas de janela (atlas D)
        Qf = quadro(am, A.r2)
        for v0 in (0.8, 3.1):
            pts = [Qf(u, v, -0.025) for u, v in [(hw * 1.2, v0), (-hw * 1.2, v0), (-hw * 1.2, v0 + 0.95), (hw * 1.2, v0 + 0.95)]]
            P.poli(pts, M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    # pilastras verdes nos limites dos vãos, frente e fundos
    for i in range(NB + 1):
        a = A.a0 + (A.a1 - A.a0) * i / NB
        for r, w, hh in ((A.r1 - 0.08, 0.32, HP + 0.02), (A.r2 + 0.06, 0.26, HP - 0.1)):
            x, y, _ = A.p(r, a, 0)
            giro = math.degrees(a) + GIRO_FRENTE
            P.juntar(bm_caixa(0.2, w, hh, 0.03), M["verde"], M_em(x, y, Z0, giro))

    # ala leste–oeste (fundos, 3 pavimentos, concreto claro com pilastras verdes e fitas de janela)
    ax0, ax1, ay0, ay1, AH = -15.9, -8.4, -2.6, 1.2, 6.2
    corpo = [frente(p) for p in [(ax0, ay0), (ax1, ay0), (ax1, ay1), (ax0, ay1)]]
    P.juntar(bm_prisma(corpo, Z0, Z0 + AH, 0.06, mat_lados=1), [M["cobertura"], M["concreto"]])
    reservar(corpo, 0.8)
    for x in [ax0 + 0.7 + k * 1.35 for k in range(6)] + [ax1]:
        for y, s in ((ay0, -1), (ay1, 1)):
            px_, py_ = frente((x, y + s * 0.05))
            P.juntar(bm_caixa(0.24, 0.16, AH + 0.04, 0.03), M["verde"], M_em(px_, py_, Z0, GIRO_FRENTE))
    for y, s in ((ay0, -1), (ay1, 1)):
        for v0 in (0.75, 2.75, 4.75):
            pts = [(ax0 + 0.5, y + s * 0.03), (ax1 - 0.3, y + s * 0.03)]
            if s > 0:
                pts = pts[::-1]
            q = [(*frente(p), Z0 + v0) for p in pts] + [(*frente(p), Z0 + v0 + 0.9) for p in reversed(pts)]
            P.poli(q, M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    # testeira leste: faixa vertical verde
    px_, py_ = frente((ax1 + 0.04, (ay0 + ay1) / 2))
    P.juntar(bm_caixa(0.12, 1.2, AH + 0.06, 0.03), M["verde"], M_em(px_, py_, Z0, GIRO_FRENTE))
    # cobertura: caixa d'água, casas de máquinas e antenas
    cx, cy = frente((ax0 + 2.4, -0.7))
    P.juntar(bm_caixa(1.5, 1.5, 1.1, 0.05), M["concreto"], M_em(cx, cy, Z0 + AH, GIRO_FRENTE))
    cx, cy = frente((ax1 - 1.6, -0.2))
    P.juntar(bm_caixa(1.1, 0.9, 0.55, 0.04), M["cobertura"], M_em(cx, cy, Z0 + AH, GIRO_FRENTE))
    for (x, y, h) in ((ax0 + 1.3, 0.6, 2.4), (ax0 + 3.6, -1.9, 1.6)):
        px_, py_ = frente((x, y))
        P.juntar(bm_cilindro(0.04, h, 6), M["poste"], Matrix.Translation((px_, py_, Z0 + AH)))
        P.juntar(bm_cilindro(0.22, 0.08, 10, r2=0.05), M["branco"], Matrix.Translation((px_ + 0.1, py_, Z0 + AH + h * 0.75)) @ Matrix.Rotation(math.radians(70), 4, "Y"))
    # aparelhos na cobertura da ala curva
    for a, r in ((-18, 14.4), (2, 14.6), (20, 14.3)):
        x, y, _ = A.p(r, math.radians(a), 0)
        P.juntar(bm_caixa(0.7, 0.9, 0.4, 0.04), M["concreto"], M_em(x, y, Z0 + H2, a + GIRO_FRENTE))
    # pegada da Reitoria para a mata não invadir
    pegada = [A.p(A.r1 - 0.5, a, 0)[:2] for a in ang] + [A.p(A.r2 + 0.3, a, 0)[:2] for a in reversed(ang)]
    reservar(pegada, 1.6)
    return P.criar()


# ———————————————————————————————————————————————— Biblioteca

def biblioteca(M):
    """
    Biblioteca Central (OSM: 40 × 67 m, eixo a −23,5°, 3 pavimentos; aérea: caixa branca com lanternim no meio).
    Fachadas não aparecem nas fotos: fitas de janela e brises verticais neutros (dúvida anotada na ficha).
    """
    P = Peca("Biblioteca_Central")
    c, L, W, H = (-0.8, 2.6), 10.2, 6.4, 3.75
    giro = giro_de_rumo(RUMO_BIBLIOTECA)
    T = M_em(c[0], c[1], Z0, giro)          # x local = eixo maior
    P.juntar(bm_caixa(L, W, H, 0.08), [M["branco"]], T)
    # cobertura recuada (platibanda de 0,25 m) e lanternim com vidro
    P.juntar(bm_caixa(L - 0.36, W - 0.36, 0.02, 0.0), M["cobertura"], T @ Matrix.Translation((0, 0, H)))
    for s in (-1, 1):
        P.juntar(bm_caixa(L, 0.18, 0.28, 0.03), M["branco"], T @ Matrix.Translation((0, s * (W / 2 - 0.09), H)))
        P.juntar(bm_caixa(0.18, W, 0.28, 0.03), M["branco"], T @ Matrix.Translation((s * (L / 2 - 0.09), 0, H)))
    lw, ll, lh = 2.4, 6.2, 0.75
    P.juntar(bm_caixa(ll - 0.1, lw - 0.1, lh, 0.0), M["branco"], T @ Matrix.Translation((0, 0, H)))
    P.juntar(bm_caixa(ll + 0.3, lw + 0.4, 0.12, 0.03), M["cobertura"], T @ Matrix.Translation((0, 0, H + lh)))
    for s in (-1, 1):
        q = [(-ll / 2 + 0.2, s * (lw / 2 - 0.03), H + 0.08), (ll / 2 - 0.2, s * (lw / 2 - 0.03), H + 0.08), (ll / 2 - 0.2, s * (lw / 2 - 0.03), H + lh - 0.05), (-ll / 2 + 0.2, s * (lw / 2 - 0.03), H + lh - 0.05)]
        if s > 0:
            q = [q[1], q[0], q[3], q[2]]
        P.poli([tuple(T @ Vector(p)) for p in q], M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    for k in range(3):
        P.juntar(bm_caixa(0.9, 0.9, 0.12, 0.02), M["esquadrias"], T @ Matrix.Translation((-L / 2 + 1.2 + k * 0.0, -W / 2 + 1.1 + k * 1.5, H)), uvf=lambda co, n: (0.6, 0.3))
    # fitas de janela nos quatro lados (três pavimentos) e brises verticais nas fachadas compridas
    for v0 in (0.4, 1.5, 2.6):
        for s in (-1, 1):
            q = [(-L / 2 + 0.4, s * (W / 2 + 0.02), v0), (L / 2 - 0.4, s * (W / 2 + 0.02), v0), (L / 2 - 0.4, s * (W / 2 + 0.02), v0 + 0.72), (-L / 2 + 0.4, s * (W / 2 + 0.02), v0 + 0.72)]
            if s > 0:
                q = [q[1], q[0], q[3], q[2]]
            P.poli([tuple(T @ Vector(p)) for p in q], M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
            q = [(s * (L / 2 + 0.02), -W / 2 + 0.4, v0), (s * (L / 2 + 0.02), W / 2 - 0.4, v0), (s * (L / 2 + 0.02), W / 2 - 0.4, v0 + 0.72), (s * (L / 2 + 0.02), -W / 2 + 0.4, v0 + 0.72)]
            if s < 0:
                q = [q[1], q[0], q[3], q[2]]
            P.poli([tuple(T @ Vector(p)) for p in q], M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    for k in range(11):
        x = -L / 2 + 0.45 + k * (L - 0.9) / 10
        for s in (-1, 1):
            P.juntar(bm_caixa(0.1, 0.32, H - 0.25, 0.02), M["branco"], T @ Matrix.Translation((x, s * (W / 2 + 0.14), 0.12)))
    # entrada voltada para a Praça Central (lado leste) com marquise
    P.juntar(bm_caixa(2.6, 1.6, 0.14, 0.04), M["branco"], T @ Matrix.Translation((-1.0, -W / 2 - 0.7, 1.3)))
    reservar([tuple(T @ Vector((x, y, 0)))[:2] for x, y in ((-L / 2, -W / 2), (L / 2, -W / 2), (L / 2, W / 2), (-L / 2, W / 2))], 1.7)
    return P.criar()


# ———————————————————————————————————————————————— Centro de Convivência

def convivencia(M):
    """
    Centro de Convivência (ref-3 e aérea ref-1; OSM: redondo de Ø 55 m, frente para OSO): tambor branco de dois
    pavimentos, cúpula branca baixa sobre um anel de janelas, pórtico branco com a faixa azul "UNIVERSIDADE DE FORTALEZA",
    duas torres de vidro azul bilobadas ladeando o pórtico, parede azul-petróleo à esquerda e mural colorido à direita.
    """
    P = Peca("Centro_Convivencia")
    C = Vector((17.0, -3.2, 0))
    rumo_frente = 252.0
    f = Vector((*dir_rumo(rumo_frente), 0))
    t = Vector((-f.y, f.x, 0))               # à direita de quem olha o pórtico de frente
    giro_f = math.degrees(math.atan2(f.y, f.x))   # eixo x local = para a frente (OSO)
    L = lambda u, s, z=0.0: Matrix.Translation(C + f * u + t * s + Vector((0, 0, Z0 + z))) @ Matrix.Rotation(math.radians(giro_f), 4, "Z")
    R = 7.0
    H1, H2 = 1.8, 3.7

    # tambor: térreo envidraçado recuado com pilares brancos, pavimento superior branco com fita de janelas
    def anel_uv(r, z0, z1, mreg, n=48, a0=0.0, a1=2 * math.pi, rep=8):
        for i in range(n):
            a, b = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
            pa = [(C.x + r * math.cos(a), C.y + r * math.sin(a)), (C.x + r * math.cos(b), C.y + r * math.sin(b))]
            fa = (i % (n // rep)) / (n // rep)
            fb = fa + 1 / (n // rep)
            P.poli([(pa[0][0], pa[0][1], Z0 + z0), (pa[1][0], pa[1][1], Z0 + z0), (pa[1][0], pa[1][1], Z0 + z1), (pa[0][0], pa[0][1], Z0 + z1)],
                   M["esquadrias"], [uv_reg(mreg, fa, 0), uv_reg(mreg, fb, 0), uv_reg(mreg, fb, 1), uv_reg(mreg, fa, 1)])
    P.juntar(bm_cilindro(R - 0.4, H1, 48, tampa=False), M["branco"], Matrix.Translation(C + Vector((0, 0, Z0))))
    anel_uv(R - 0.38, 0.05, H1 - 0.1, "D", rep=16)
    for k in range(24):
        a = 2 * math.pi * (k + 0.5) / 24
        d = Vector((math.cos(a), math.sin(a), 0))
        if d.dot(f) > 0.8:
            continue
        P.juntar(bm_cilindro(0.13, H1, 8), M["branco"], Matrix.Translation(C + d * (R - 0.15) + Vector((0, 0, Z0))))
    P.juntar(bm_torno([(R + 0.08, Z0 + H1 - 0.02), (R + 0.08, Z0 + H1 + 0.18), (R, Z0 + H1 + 0.18), (R, Z0 + H2), (R + 0.16, Z0 + H2), (R + 0.16, Z0 + H2 + 0.18), (5.4, Z0 + H2 + 0.18)], 48), M["branco"], Matrix.Translation(C))
    P.juntar(bm_torno([(R - 0.4, Z0 + H1 - 0.02), (R + 0.08, Z0 + H1 - 0.02)], 48), M["branco"], Matrix.Translation(C))
    anel_uv(R + 0.015, 2.45, 3.0, "D", rep=28)
    # anel de janelas (lanternim) e a cúpula branca baixa, com mastros no topo
    rc, zc = 5.35, H2 + 0.18
    P.juntar(bm_cilindro(rc - 0.05, 0.7, 40, tampa=False), M["branco"], Matrix.Translation(C - f * 0.3 + Vector((0, 0, Z0 + zc))))
    for i in range(40):
        a, b = 2 * math.pi * i / 40, 2 * math.pi * (i + 1) / 40
        o = C - f * 0.3
        fa, fb = (i % 5) / 5, (i % 5 + 1) / 5
        P.poli([(o.x + rc * math.cos(a), o.y + rc * math.sin(a), Z0 + zc + 0.06), (o.x + rc * math.cos(b), o.y + rc * math.sin(b), Z0 + zc + 0.06),
                (o.x + rc * math.cos(b), o.y + rc * math.sin(b), Z0 + zc + 0.62), (o.x + rc * math.cos(a), o.y + rc * math.sin(a), Z0 + zc + 0.62)],
               M["esquadrias"], [uv_reg("D", fa, 0.1), uv_reg("D", fb, 0.1), uv_reg("D", fb, 0.9), uv_reg("D", fa, 0.9)])
    P.juntar(bm_torno([(rc + 0.12, Z0 + zc + 0.66), (rc + 0.12, Z0 + zc + 0.78), (rc, Z0 + zc + 0.78)], 40), M["cupula"], Matrix.Translation(C - f * 0.3))
    P.juntar(bm_cupula(rc, 2.9, 48, 10, Z0 + zc + 0.74), M["cupula"], Matrix.Translation(C - f * 0.3), liso=True)
    topo = C - f * 0.3 + Vector((0, 0, Z0 + zc + 0.74 + 2.9))
    P.juntar(bm_cilindro(0.45, 0.22, 16), M["cupula"], Matrix.Translation(topo - Vector((0, 0, 0.05))))
    for k, (du, ds, h) in enumerate(((0.2, -0.9, 0.9), (-0.4, 0.7, 0.75), (1.2, 0.3, 0.6), (-1.3, -0.4, 0.55))):
        p = topo + f * du + t * ds
        zz = Z0 + zc + 0.74 + 2.9 * math.sqrt(max(0, 1 - ((p - (C - f * 0.3)).xy.length / rc) ** 2))
        P.juntar(bm_cilindro(0.035, h + 0.1, 6), M["poste"], Matrix.Translation((p.x, p.y, zz - 0.1)))

    # pórtico: pilares laterais, mezanino com guarda-corpo, forro e a faixa azul do letreiro
    pu0, pu1, ps = R - 0.9, R + 1.9, 3.3
    for s in (-1, 1):
        P.juntar(bm_caixa(pu1 - pu0, 0.55, H2 + 0.1, 0.05), M["branco"], L((pu0 + pu1) / 2, s * (ps - 0.27)))
    P.juntar(bm_caixa(pu1 - 0.6 - pu0, 2 * ps - 1.1, 0.45, 0.04), M["branco"], L((pu0 + pu1 - 0.6) / 2, 0, 1.95))
    for k in range(13):
        P.juntar(bm_cilindro(0.025, 0.45, 6), M["poste"], L(pu1 - 0.68, -ps + 0.6 + k * (2 * ps - 1.2) / 12, 2.4))
    P.juntar(bm_caixa(0.06, 2 * ps - 1.1, 0.05, 0.0), M["poste"], L(pu1 - 0.68, 0, 2.85))
    P.juntar(bm_caixa(pu1 - pu0, 2 * ps, 0.14, 0.03), M["branco"], L((pu0 + pu1) / 2, 0, H2 - 0.04))
    # fundo do pórtico: portas de vidro no térreo e vidraça no mezanino
    for z0, z1 in ((0.0, 1.95), (2.4, H2 - 0.05)):
        q = [L(pu0 + 0.02, s, 0) @ Vector((0, 0, z)) for s, z in ((-ps + 0.6, z0), (ps - 0.6, z0), (ps - 0.6, z1), (-ps + 0.6, z1))]
        P.poli([tuple(v) for v in q], M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    # faixa azul com o letreiro na frente (o .tsx pinta o texto no atlas de letreiros)
    lu0, lu1, lz0, lz1, lsx = pu1 - 0.75, pu1 + 0.15, H2 + 0.08, H2 + 1.3, ps + 0.12
    P.juntar(bm_caixa(lu1 - lu0, 2 * lsx, lz1 - lz0, 0.04), M["azul"], L((lu0 + lu1) / 2, 0, lz0))
    P.juntar(bm_caixa(lu0 - pu0, 2 * ps, 0.5, 0.04), M["branco"], L((lu0 + pu0) / 2, 0, H2 + 0.08))
    q = [L(lu1 + 0.012, s, 0) @ Vector((0, 0, z)) for s, z in ((-lsx + 0.08, lz0 + 0.08), (lsx - 0.08, lz0 + 0.08), (lsx - 0.08, lz1 - 0.08), (-lsx + 0.08, lz1 - 0.08))]
    P.poli([tuple(v) for v in q], M["letreiros"], [uv_letreiro("universidade", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])

    # torres de vidro azul bilobadas (dois cilindros colados), mais altas que a cúpula
    HT = 8.4
    for s in (-1, 1):
        base = C + f * (R * 0.73) + t * (s * R * 0.69)
        for lob in (-1, 1):
            cl = base + t * (lob * 0.58)
            rl = 0.95
            n = 20
            for i in range(n):
                a, b = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
                pa = (cl.x + rl * math.cos(a), cl.y + rl * math.sin(a))
                pb = (cl.x + rl * math.cos(b), cl.y + rl * math.sin(b))
                if (Vector((pa[0], pa[1], 0)) - (base + t * (-lob * 0.58))).length < rl - 0.01 and (Vector((pb[0], pb[1], 0)) - (base + t * (-lob * 0.58))).length < rl - 0.01:
                    continue
                P.poli([(pa[0], pa[1], Z0), (pb[0], pb[1], Z0), (pb[0], pb[1], Z0 + HT), (pa[0], pa[1], Z0 + HT)], M["esquadrias"],
                       [uv_reg("C", i / n, 0), uv_reg("C", (i + 1) / n, 0), uv_reg("C", (i + 1) / n, 1), uv_reg("C", i / n, 1)])
            P.juntar(bm_cilindro(rl + 0.07, 0.22, 20), M["branco"], Matrix.Translation(cl + Vector((0, 0, Z0 + HT))))
            P.juntar(bm_cilindro(rl + 0.04, 0.12, 20), M["branco"], Matrix.Translation(cl + Vector((0, 0, Z0 + 0.0))))
        reservar([tuple((base + Vector((math.cos(a), math.sin(a), 0)) * 1.5).xy) for a in [i * math.pi / 6 for i in range(12)]], 0.3)

    # parede azul-petróleo (à esquerda de quem olha) e parede do mural (à direita), na frente da base das torres
    for s, m in ((-1, M["petroleo"]), (1, M["branco"])):
        u0, sa, sb, hw = R + 0.35, s * (ps + 0.05), s * (ps + 2.7), 3.9
        P.juntar(bm_caixa(0.3, abs(sb - sa), hw, 0.05), m, L(u0, (sa + sb) / 2))
        if s > 0:
            q = [L(u0 + 0.165, x, 0) @ Vector((0, 0, z)) for x, z in ((sa + 0.12, 0.25), (sb - 0.12, 0.25), (sb - 0.12, hw - 0.2), (sa + 0.12, hw - 0.2))]
            P.poli([tuple(v) for v in q], M["letreiros"], [uv_letreiro("mural", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
        else:
            # relevo em ondas na parede azul-petróleo (ref-3)
            for k in range(5):
                P.juntar(bm_caixa(0.08, 0.28, hw - 0.7, 0.03), m, L(u0 + 0.17, sa + s * (0.45 + k * 0.45), 0.35 + 0.15 * (k % 2)))
    reservar([tuple((C + Vector((math.cos(a), math.sin(a), 0)) * R).xy) for a in [i * math.pi / 12 for i in range(24)]], 2.0)
    reservar([tuple((C + f * u + t * s).xy) for u, s in ((R - 1.5, -6.6), (R + 2.4, -6.6), (R + 2.4, 6.6), (R - 1.5, 6.6))], 1.0)
    return P.criar(), (C, f, t)


# ———————————————————————————————————————————————— blocos de aula (sugeridos na mata)

def barra(P, M, c, comp, larg, rumo, H=2.55, pav=2):
    """Barra de aulas: reboco branco, fitas de janela nos lados compridos e telhado metálico de duas águas baixo"""
    giro = giro_de_rumo(rumo)
    T = M_em(c[0], c[1], Z0, giro)
    P.juntar(bm_caixa(comp, larg, H, 0.06), M["reboco"], T)
    for k in range(pav):
        v0 = 0.35 + k * (H - 0.2) / pav
        for s in (-1, 1):
            q = [(-comp / 2 + 0.3, s * (larg / 2 + 0.02), v0), (comp / 2 - 0.3, s * (larg / 2 + 0.02), v0), (comp / 2 - 0.3, s * (larg / 2 + 0.02), v0 + 0.62), (-comp / 2 + 0.3, s * (larg / 2 + 0.02), v0 + 0.62)]
            if s > 0:
                q = [q[1], q[0], q[3], q[2]]
            P.poli([tuple(T @ Vector(p)) for p in q], M["esquadrias"], [uv_reg("D", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    # telhado: duas águas a ~12°, beiral de 0,25 m
    b = 0.25
    hw, hc, hr = larg / 2 + b, comp / 2 + b, 0.32
    for s in (-1, 1):
        q = [(-hc, s * hw, H - 0.04), (hc, s * hw, H - 0.04), (hc, 0, H + hr), (-hc, 0, H + hr)]
        if s < 0:
            q = [q[1], q[0], q[3], q[2]]
        P.juntar(bm_poli_extrudado([tuple(T @ Vector(p)) for p in q], (0, 0, 0.06)), M["telha"])
    for s in (-1, 1):
        q = [(s * comp / 2, -larg / 2, H), (s * comp / 2, larg / 2, H), (s * comp / 2, 0, H + hr - 0.02)]
        if s < 0:
            q = [q[1], q[0], q[2]]
        P.poli([tuple(T @ Vector(p)) for p in q], M["reboco"])
    reservar([tuple(T @ Vector((x, y, 0)))[:2] for x, y in ((-comp / 2, -larg / 2), (comp / 2, -larg / 2), (comp / 2, larg / 2), (-comp / 2, larg / 2))], 0.25)


def blocos(M):
    """Blocos de aula do OSM em volta da frente do campus, só sugeridos na mata: C (barra dupla), D e T (em H)"""
    P = Peca("Blocos_Aula")
    u = dir_rumo(RUMO_BLOCOS)
    v = dir_rumo(RUMO_BLOCOS + 90)
    def par(c, comp, gap=2.6, **k):
        for s in (-0.5, 0.5):
            barra(P, M, (c[0] + v[0] * s * gap, c[1] + v[1] * s * gap), comp, 1.7, RUMO_BLOCOS, **k)
    par((-11.2, -13.2), 8.6)                                     # Bloco C (barra dupla)
    # Bloco D (em H, 4 pavimentos) ao sul e Bloco T (em H) ao norte
    for c, comp, H, pav in (((1.2, -24.0), 7.2, 3.4, 3), ((4.6, 22.6), 6.4, 3.4, 3)):
        for s in (-1, 1):
            barra(P, M, (c[0] + u[0] * s * 1.9, c[1] + u[1] * s * 1.9), comp, 1.6, RUMO_BLOCOS + 90, H=H, pav=pav)
        barra(P, M, c, 2.4, 1.4, RUMO_BLOCOS, H=H - 0.4, pav=pav)
    return P.criar()


# ———————————————————————————————————————————————— jardim da Reitoria, gradil, postes, praça

def jardim(M):
    """
    Jardim entre a calçada e a Reitoria (fotos ref-2 e ref-4): fonte circular de granito com grupo escultórico, estátuas
    brancas em pedestais, totem azul "Reitoria", letreiro baixo da Fundação Edson Queiroz, canteiros de ixora e a
    escultura de bronze de Bruno Giorgi junto à entrada (Wikipédia: "na parte externa do Espaço Cultural").
    """
    P = Peca("Jardim_Reitoria")
    agua = Peca("Fontes_Agua")
    fx, fy = frente((-21.4, 0.6))
    P.juntar(bm_torno([(1.5, Z0), (1.5, Z0 + 0.38), (1.22, Z0 + 0.38), (1.22, Z0 + 0.2)], 40), M["granito"], Matrix.Translation((fx, fy, 0)))
    agua.juntar(bm_cilindro(1.24, 0.2, 40), M["agua"], Matrix.Translation((fx, fy, Z0 + 0.06)))
    P.juntar(bm_torno([(0.46, Z0 + 0.25), (0.46, Z0 + 0.62), (0.36, Z0 + 0.7), (0.36, Z0 + 0.95), (0.0, Z0 + 0.95)], 20), M["granito"], Matrix.Translation((fx, fy, 0)))
    # grupo escultórico: três figuras alongadas em pedra clara, abraçadas
    for k, (dx, dy, h, inc) in enumerate(((0.12, 0.0, 1.05, 8), (-0.1, 0.12, 0.92, -10), (-0.06, -0.14, 0.8, 14))):
        bm = bm_esfera(1.0, 2)
        bm.transform(Matrix.Diagonal((0.16, 0.13, h / 2, 1)))
        P.juntar(bm, M["pedra"], Matrix.Translation((fx + dx, fy + dy, Z0 + 0.95 + h / 2 - 0.05)) @ Matrix.Rotation(math.radians(inc), 4, "X" if k % 2 else "Y"))
        P.juntar(bm_esfera(0.09, 1), M["pedra"], Matrix.Translation((fx + dx * 1.2, fy + dy * 1.2, Z0 + 0.95 + h)))
    # estátuas brancas (mármore) em pedestais junto ao gradil
    for (x, y, g) in ((-23.3, -2.3, 10), (-23.1, 4.9, -15), (-19.9, 6.4, 30)):
        px_, py_ = frente((x, y))
        P.juntar(bm_caixa(0.55, 0.55, 0.62, 0.04), M["marmore"], M_em(px_, py_, Z0, g))
        P.juntar(bm_cilindro(0.2, 0.75, 10, r2=0.13), M["marmore"], M_em(px_, py_, Z0 + 0.62, g))
        P.juntar(bm_cilindro(0.11, 0.3, 8, r2=0.14), M["marmore"], M_em(px_, py_, Z0 + 1.37, g))
        P.juntar(bm_esfera(0.11, 1), M["marmore"], Matrix.Translation((px_, py_, Z0 + 1.78)))
        P.juntar(bm_cilindro(0.05, 0.45, 6), M["marmore"], M_em(px_, py_, Z0 + 1.3, g) @ Matrix.Translation((0.17, 0, 0)) @ Matrix.Rotation(math.radians(-30), 4, "Y"))
    # escultura de Bruno Giorgi: figura delgada de bronze com o braço erguido, perto da entrada
    gx, gy = frente((-19.5, -1.7))
    P.juntar(bm_caixa(0.5, 0.5, 0.12, 0.02), M["granito"], M_em(gx, gy, Z0, GIRO_FRENTE))
    P.juntar(bm_cilindro(0.06, 1.25, 6, r2=0.035), M["bronze"], Matrix.Translation((gx, gy, Z0 + 0.12)))
    P.juntar(bm_cilindro(0.12, 0.55, 6, r2=0.05), M["bronze"], Matrix.Translation((gx, gy, Z0 + 0.65)))
    P.juntar(bm_cilindro(0.03, 0.7, 6), M["bronze"], Matrix.Translation((gx, gy, Z0 + 1.15)) @ Matrix.Rotation(math.radians(25), 4, "X"))
    P.juntar(bm_esfera(0.07, 1), M["bronze"], Matrix.Translation((gx, gy, Z0 + 1.45)))
    # totem azul "Reitoria" na calçada, de frente para a avenida (face oeste no atlas de letreiros)
    tx, ty = frente((-24.65, -1.6))
    T = M_em(tx, ty, Z0 + 0.14, GIRO_FRENTE)
    P.juntar(bm_caixa(0.16, 0.5, 1.65, 0.02), M["azul"], T)
    q = [(-0.085, 0.24, 0.03), (-0.085, -0.24, 0.03), (-0.085, -0.24, 1.62), (-0.085, 0.24, 1.62)]
    P.poli([tuple(T @ Vector(p)) for p in q], M["letreiros"], [uv_letreiro("totem", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    # letreiro baixo da Fundação Edson Queiroz (mureta branca com placa)
    lx, ly = frente((-22.4, 6.4))
    T = M_em(lx, ly, Z0, GIRO_FRENTE)
    P.juntar(bm_caixa(0.3, 2.3, 0.85, 0.04), M["branco"], T)
    P.juntar(bm_caixa(0.3, 0.42, 1.25, 0.04), M["branco"], T @ Matrix.Translation((0, -1.3, 0)))
    q = [(-0.152, 1.05, 0.15), (-0.152, -1.05, 0.15), (-0.152, -1.05, 0.72), (-0.152, 1.05, 0.72)]
    P.poli([tuple(T @ Vector(p)) for p in q], M["letreiros"], [uv_letreiro("fundacao", a, b) for a, b in [(0, 0), (1, 0), (1, 1), (0, 1)]])
    # canteiros de ixora ao longo do gradil e na frente da fachada (caixas de arbusto com o topo florido)
    canteiros = [(-23.55, -7.4, 1.5), (-23.55, -4.2, 1.2), (-23.55, 4.4, 1.2), (-23.55, 9.0, 1.6), (-20.4, -4.6, 1.1), (-20.9, 5.6, 1.0)]
    for x, y, comp in canteiros:
        px_, py_ = frente((x, y))
        T = M_em(px_, py_, Z0, GIRO_FRENTE + 90)
        bm = bm_caixa(comp, 0.6, 0.38, 0.16)
        for fc in bm.faces:
            fc.material_index = 1 if fc.normal.z > 0.6 else 0
        P.juntar(bm, [M["arbusto"], M["flores"]], T)
    # portão: pilares brancos no acesso
    for y in (-0.7, 1.9):
        px_, py_ = frente((-24.3, y))
        P.juntar(bm_caixa(0.36, 0.36, 1.55, 0.04), M["branco"], M_em(px_, py_, Z0, GIRO_FRENTE))
    reservar([frente(p) for p in [(-24.2, -9.6), (-17.8, -9.6), (-17.8, 10.6), (-24.2, 10.6)]], 0.4)

    # Praça Central: fonte redonda, floreiras circulares com árvore, bancos
    px_, py_ = 5.4, -7.4
    P.juntar(bm_torno([(1.0, Z0), (1.0, Z0 + 0.32), (0.8, Z0 + 0.32), (0.8, Z0 + 0.18)], 32), M["granito"], Matrix.Translation((px_, py_, 0)))
    agua.juntar(bm_cilindro(0.82, 0.16, 32), M["agua"], Matrix.Translation((px_, py_, Z0 + 0.06)))
    P.juntar(bm_cilindro(0.12, 0.7, 10), M["granito"], Matrix.Translation((px_, py_, Z0)))
    for (x, y) in PLANTEIRAS:
        P.juntar(bm_torno([(0.75, Z0), (0.75, Z0 + 0.32), (0.6, Z0 + 0.32), (0.6, Z0 + 0.25)], 20), M["granito"], Matrix.Translation((x, y, 0)))
        P.juntar(bm_cilindro(0.62, 0.3, 20), M["arbusto"], Matrix.Translation((x, y, Z0)))
    for (x, y, g) in ((5.6, -3.0, 0), (9.0, -8.9, -70), (2.9, -6.3, 95), (5.4, -10.6, 10)):
        P.juntar(bm_caixa(1.3, 0.42, 0.38, 0.05), M["concreto"], M_em(x, y, Z0, g))
    agua.criar()
    return P.criar()


PLANTEIRAS = [(3.8, -3.6), (7.6, -2.9), (7.6, -10.1), (3.1, -9.6)]


def gradil(M):
    """Gradil verde de tela soldada ao longo da calçada (ref-2): montantes a cada 1,25 m e cinco travessas sugerindo a tela"""
    P = Peca("Gradil_Verde")
    x = -24.3
    lim = math.sqrt((RAIO - 0.6) ** 2 - x ** 2)
    y = -lim
    trechos = [(-lim, -0.85), (2.05, lim)]
    for y0, y1 in trechos:
        n = max(1, int((y1 - y0) / 1.25))
        for k in range(n + 1):
            yy = y0 + (y1 - y0) * k / n
            px_, py_ = frente((x, yy))
            P.juntar(bm_caixa(0.07, 0.07, 1.2, 0.0), M["gradil"], M_em(px_, py_, Z0, GIRO_FRENTE))
        for z in (0.12, 0.4, 0.67, 0.94, 1.14):
            a, b = frente((x, y0)), frente((x, y1))
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            P.juntar(bm_caixa(0.035, y1 - y0, 0.04, 0.0), M["gradil"], M_em(mx, my, Z0 + z, GIRO_FRENTE))
    # portões abertos
    for y, s in ((-0.7, 1), (1.9, -1)):
        px_, py_ = frente((x + 0.55, y + s * 0.05))
        P.juntar(bm_caixa(1.1, 0.04, 1.05, 0.0), M["gradil"], M_em(px_, py_, Z0 + 0.1, GIRO_FRENTE + s * 70))
    return P.criar()


def postes(M):
    """Postes de braço duplo no canteiro central da avenida, a cada ~8 m"""
    P = Peca("Postes_Avenida")
    for y in (-16.0, -8.0, 0.0, 8.0, 16.0):
        px_, py_ = frente((-29.7, y))
        if math.hypot(px_, py_) > RAIO - 1.5:
            continue
        P.juntar(bm_cilindro(0.07, 4.6, 8, r2=0.05), M["poste"], Matrix.Translation((px_, py_, Z0 + 0.15)))
        for s in (-1, 1):
            T = M_em(px_, py_, Z0 + 0.15 + 4.5, GIRO_FRENTE + (0 if s > 0 else 180))
            P.juntar(bm_caixa(1.3, 0.05, 0.05, 0.0), M["poste"], T @ Matrix.Translation((0.65, 0, 0)))
            P.juntar(bm_caixa(0.42, 0.18, 0.1, 0.02), M["poste"], T @ Matrix.Translation((1.3, 0, -0.06)))
    return P.criar()


# ———————————————————————————————————————————————— vegetação e carros (layout para o .tsx)

def layout(conv):
    """
    Posições determinísticas (semente fixa) da vegetação e dos carros. A mata enche o que sobra do disco, longe dos
    prédios e pisos; palmeiras imperiais no jardim da Reitoria, coqueiros na Praça Central. Volta em coordenadas do Blender.
    """
    rnd = random.Random(1973)   # ano da aula inaugural
    arvores = []
    # árvores fixas: as floreiras da Praça Central
    for (x, y) in PLANTEIRAS:
        arvores.append((x, y, 1.0, 1.05))
    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.4 - r * 0.85:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.55:
                return False
        for cx, cy, cr in LIVRE_CIRCS:
            if math.hypot(x - cx, y - cy) < cr + r * 0.6:
                return False
        return True
    LIVRE_CIRCS.append((-11.0, 4.4, 2.6))
    LIVRE_CIRCS.append((-10.5, -5.8, 2.2))
    LIVRE_CIRCS.append((6.4, -6.8, 5.6))      # Praça Central aberta
    LIVRE_CIRCS.append((5.6, 1.6, 2.4))       # gramado entre a Biblioteca e o Convivência
    LIVRE_CIRCS.append((-3.0, -6.6, 2.0))     # gramado na frente da Biblioteca
    tentativas = 0
    while tentativas < 30000 and len(arvores) < 155:
        tentativas += 1
        x, y = rnd.uniform(-RAIO, RAIO), rnd.uniform(-RAIO, RAIO)
        borda = math.hypot(x, y) > 23
        r = rnd.uniform(1.2, 2.0) if borda else rnd.uniform(0.95, 1.5)
        if not livre(x, y, r):
            continue
        if any(math.hypot(x - a[0], y - a[1]) < 0.78 * (r + a[3]) for a in arvores):
            continue
        h = rnd.uniform(0.75, 1.05)
        arvores.append((x, y, h, r))
    imperiais = []
    for y in (3.6, 6.2, 8.8, 11.6):
        imperiais.append((*frente((-23.3 + rnd.uniform(-0.12, 0.12), y)), rnd.uniform(7.4, 8.8)))
    for y in (5.0, 8.4):
        x = -31.5 + math.sqrt(11.6 ** 2 - (y - 0.6) ** 2)    # 1,1 m na frente da fachada curva
        imperiais.append((*frente((x, y)), rnd.uniform(7.0, 8.4)))
    imperiais.append((*frente((-22.0, 2.9)), 7.9))
    coqueiros = []
    for (x, y) in ((-21.6, 11.4),):
        coqueiros.append((*frente((x, y)), rnd.uniform(4.6, 5.6), rnd.uniform(0, 360)))
    for (x, y) in ((2.0, -3.6), (9.9, -10.0), (5.6, -1.6), (3.6, -11.2), (1.4, -9.0)):
        coqueiros.append((x, y, rnd.uniform(4.4, 5.4), rnd.uniform(0, 360)))
    carros = []
    for xc, sentido in ((-26.17, 1), (-27.3, 1), (-28.43, 1), (-30.97, -1), (-32.1, -1)):
        y = rnd.uniform(-22, -14)
        while y < 24:
            p = frente((xc, y))
            if math.hypot(*p) < RAIO - 1.4:
                carros.append((p[0], p[1], GIRO_FRENTE + (90 if sentido > 0 else -90), rnd.randrange(8)))
            y += rnd.uniform(4.0, 9.5)
    u, v = dir_rumo(RUMO_BLOCOS), dir_rumo(RUMO_BLOCOS + 90)
    for k in (-3, -2, 0, 1, 3):
        for lado in (-1, 1):
            if (k + lado) % 3 == 0:
                continue
            cx = -7.4 + u[0] * (k + 0.5) * 1.05 + v[0] * lado * 1.35
            cy = 12.2 + u[1] * (k + 0.5) * 1.05 + v[1] * lado * 1.35
            carros.append((cx, cy, 90 - (RUMO_BLOCOS + 90), rnd.randrange(8)))
    pessoas = []
    zonas = [((-21.4, 0.6), 2.3, 4, True), ((-22.6, -1.8), 0.9, 2, True), ((6.2, -6.6), 3.6, 9, False), ((9.0, -5.6), 1.4, 3, False),
             ((1.6, -5.2), 0.9, 2, False), ((-2.6, -4.2), 0.8, 1, False), ((8.4, -13.0), 0.8, 2, False)]
    for (cx, cy), raio, n, na_frente in zonas:
        k = 0
        while k < n:
            a, d = rnd.uniform(0, 2 * math.pi), raio * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            if na_frente:
                x, y = frente((x, y))
            if math.hypot(x - 5.4, y + 7.4) < 1.3 or (na_frente and math.hypot(x - frente((-21.4, 0.6))[0], y - frente((-21.4, 0.6))[1]) < 1.8):
                continue
            pessoas.append((x, y, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    return arvores, imperiais, coqueiros, carros, pessoas


def proxies(arvores, imperiais, coqueiros, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.85, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, Z0 + h + r * 0.85)))
        P.juntar(bm_cilindro(0.16, h + 0.3, 6), m, Matrix.Translation((x, y, Z0)))
    for x, y, h in imperiais:
        P.juntar(bm_cilindro(0.17, h, 6), m, Matrix.Translation((x, y, Z0)))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((1.9, 1.9, 0.9, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, Z0 + h + 0.2)))
    for x, y, h, g in coqueiros:
        P.juntar(bm_cilindro(0.15, h, 6), m, Matrix.Translation((x, y, Z0)))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((1.7, 1.7, 0.6, 1)))
        P.juntar(bm, m, Matrix.Translation((x, y, Z0 + h)))
    for x, y, g, _ in carros:
        P.juntar(bm_caixa(1.9, 0.85, 0.7, 0.1), m, M_em(x, y, Z0 + 0.12, g))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada

def assar(objs_vertice, objs_chao, proxy):
    """
    Oclusão de ambiente no Cycles (CPU): nas cores de vértice dos prédios e numa imagem 256 × 256 do chão, vista de cima.
    Os valores vão para a faixa 0,5–1 (prédios) para escurecer sem sujar.
    """
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 96
    if cena.world is None:
        cena.world = bpy.data.worlds.new("Mundo")
    cena.world.light_settings.distance = 2.6
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs_vertice:
        me = ob.data
        at = me.color_attributes.new("AO", "BYTE_COLOR", "POINT")
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
    # chão: placa plana logo acima do gramado, com UV planar; os pisos ficam fora do render durante o bake
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
    placa.location.z = Z0 + 0.03
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
    img.filepath_raw = os.path.join(SAIDA, "unifor-ao-chao.jpg")
    img.file_format = "JPEG"
    cena.render.image_settings.quality = 88
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
    r = reitoria(M)
    b = biblioteca(M)
    c, (C, f, t) = convivencia(M)
    bl = blocos(M)
    j = jardim(M)
    g = gradil(M)
    ps = postes(M)
    arvores, imperiais, coqueiros, carros, pessoas = layout((C, f, t))
    print(f"árvores {len(arvores)}, imperiais {len(imperiais)}, coqueiros {len(coqueiros)}, carros {len(carros)}")
    prox = proxies(arvores, imperiais, coqueiros, carros)
    chao_objs = [bpy.data.objects[n] for n in ("Chao_Gramado", "Av_Washington_Soares", "Chao_Pisos", "Fontes_Agua")]
    # UV planar do chão (a mesma do mapa de oclusão): u = x/67 + 0,5; v = y/67 + 0,5
    for ob in chao_objs:
        me = ob.data
        uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
        for lp in me.loops:
            co = me.vertices[lp.vertex_index].co
            uv.data[lp.index].uv = (co.x / LADO_AO + 0.5, co.y / LADO_AO + 0.5)
    if not SEM_BAKE:
        assar([r, b, c, bl, j, g, ps], chao_objs, prox)
    else:
        bpy.data.objects.remove(prox)
    # suavização: curvas lisas (cúpula, torres, tambor) e arestas vivas no resto
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
    arq = os.path.join(SAIDA, "unifor-campus.glb")
    bpy.ops.export_scene.gltf(filepath=arq, export_format="GLB", export_yup=True, export_apply=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT",
                              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    # layout em coordenadas do three: x = x, y = cima, z = −y do Blender
    dados = {
        "arvores": [[round(x, 3), round(Z0 + h, 3), round(-y, 3), round(r, 3)] for x, y, h, r in arvores],
        "imperiais": [[round(x, 3), round(-y, 3), round(h, 3)] for x, y, h in imperiais],
        "coqueiros": [[round(x, 3), round(-y, 3), round(h, 3), round(math.radians(g), 3)] for x, y, h, g in coqueiros],
        "carros": [[round(x, 3), round(-y, 3), round(math.radians(g), 4), k] for x, y, g, k in carros],
        "pessoas": [[round(x, 3), round(-y, 3), round(math.radians(g), 3), k] for x, y, g, k in pessoas],
        "chao": {"lado": LADO_AO, "z0": Z0},
    }
    with open(os.path.join(SAIDA, "unifor-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
