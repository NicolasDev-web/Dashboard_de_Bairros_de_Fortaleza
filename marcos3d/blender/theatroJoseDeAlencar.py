# -*- coding: utf-8 -*-
"""
Theatro José de Alencar em miniatura: gera as peças estáticas do marco no Blender e exporta para a oficina.

Uso (o Python do Blender 5.x com o módulo bpy; nada de .blend: o modelo sai sempre daqui):
    <python-com-bpy> marcos3d/blender/theatroJoseDeAlencar.py              # modela, assa a oclusão e exporta
    <python-com-bpy> marcos3d/blender/theatroJoseDeAlencar.py --sem-bake   # rápido, sem oclusão (para conferir forma)

Saídas em marcos3d/blender/saida/ (o TheatroJoseDeAlencar.tsx carrega as três):
    theatroJoseDeAlencar-pecas.glb     chão, fachada eclética, galerias, fachada de ferro, sala e caixa cênica, jardim de
                                       Burle Marx e praça (sem compressão, oclusão assada nas cores de vértice)
    theatroJoseDeAlencar-ao-chao.jpg   oclusão do chão assada de cima (UV planar: u = x/67 + 0,5; v = y/67 + 0,5)
    theatroJoseDeAlencar-layout.json   árvores, palmeiras, pessoas e carros (o .tsx instancia), em coordenadas do three

Composição (ver relatorios/especialista-theatroJoseDeAlencar.md): o prédio inteiro, com a praça na frente e o jardim de
Burle Marx ao lado. Tudo é modelado num referencial do prédio: x = à direita de quem olha a fachada da praça (oeste
real), y = da fachada para o palco (sul real), z = cima. A planta do OSM (pesquisa/theatroJoseDeAlencar/osm.xml, eixo a
18°) entra por medidas: largura × 0,86; bloco da fachada × 0,85; pátio × 0,73; sala e palco comprimidos (~0,5). Alturas
× 0,8 (térreo 5,3 m, cornija 10,2 m, sala 9,9 m, caixa cênica 14 m).

GIRO: no fim, o referencial é girado para a fachada olhar para as câmeras da oficina, que vêm todas do sul
(perspectiva −32°, frente 0°, close +24°). No rumo real a fachada olha para o norte e as vistas só mostram os fundos,
que foi o defeito principal da versão anterior. Com GIRO = -6 a fachada fica a ~6° da vista "frente"; para voltar ao
rumo real (fachada a 18°, norte em −z do three), use GIRO = 162.
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
PREFIXO = "theatroJoseDeAlencar"
SEM_BAKE = "--sem-bake" in sys.argv
RAIO = 33.4          # borda útil do disco (o pedestal tem 34 m)
Z0 = 0.10            # topo do piso: tudo pousa aqui
LADO_AO = 67.0       # o mapa de oclusão do chão cobre um quadrado de 67 m centrado na origem
GIRO = -6.0          # graus, anti-horário visto de cima: referencial do prédio → Blender (ver docstring)
MUNDO = Matrix.Rotation(math.radians(GIRO), 4, "Z")

# ——— medidas da miniatura (referencial do prédio; ver docstring)
Y_FRENTE = -10.0          # face do corpo central (Sala Izaíra Silvino)
Y_ALAS = -9.7             # face das alas térreas (um pouco recuadas)
Y_FUNDO_FACHADA = -3.6    # fundo do bloco da fachada = frente do pátio
Y_FERRO = 8.6             # fachada de ferro da sala (fundo do pátio)
Y_TORRE0, Y_TORRE1 = 19.5, 28.3   # caixa cênica
Y_FUNDO = 31.0            # fundo do palco
X_SALA = 11.0             # meia largura do prédio (25,7 m × 0,86)
X_CENTRO = 7.4            # meia largura do corpo central de 2 pavimentos (66% da frente, foto)
X_PORTICO = 4.0           # meia largura da entrada de 3 arcos (36% da frente, foto)
X_PATIO = 8.9             # face interna das galerias do pátio
X_FERRO = 7.2             # meia largura da fachada de ferro visível entre os braços das galerias
X_TORRE = 5.7             # meia largura da caixa cênica
H_TERREO = 5.3
H_CORNIJA = 10.2
H_ALA = 5.6
H_GALERIA = 6.5
H_SALA = 9.9
H_TORRE = 14.0
H_FUNDO = 10.2
Y_CALCADA = -13.6         # meio-fio do lado do teatro (Rua Liberato Barroso, paralelepípedo)
Y_RUA = -18.6             # meio-fio do lado da praça
X_JARDIM = -11.6          # gradil do jardim de Burle Marx (à esquerda de quem olha a fachada = leste real)
Y_JARDIM = -13.2          # gradil da frente do jardim, junto à calçada


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


def catmull(pts, passos=6):
    """Curva Catmull-Rom pelos pontos (para o caminho sinuoso do jardim)"""
    out = []
    P = [pts[0]] + list(pts) + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = (Vector(P[i - 1]), Vector(P[i]), Vector(P[i + 1]), Vector(P[i + 2]))
        for k in range(passos):
            t = k / passos
            t2, t3 = t * t, t * t * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append((v.x, v.y))
    out.append(tuple(pts[-1]))
    return out


LIVRE_POLIS = []   # (polígono, folga): onde não nasce árvore nem gente
BARRAS = []        # barras verticais de ferro dos gradis e guarda-corpos (x, y, z da base, altura): o .tsx instancia


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
    """Superfície de revolução fechada de um perfil [(r, z), ...] em volta do eixo z (pinhas, balaústres, bacias)"""
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
    """Caixa alinhada aos eixos de (x0, y0, z0) a (x1, y1, z1)"""
    P.juntar(bm_caixa(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), chanfro), m, T((x0 + x1) / 2, (y0 + y1) / 2, min(z0, z1)))


def barra(P, a, b, esp, m):
    """Perfil quadrado de a até b (barras de gradil e guarda-corpo)"""
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

COR_REBOCO = "#dce8a0"     # verde-claro amarelado das paredes (ficha: #d3dcae/#cfd9a6; um tom mais vivo para a sombra)
COR_BRANCO = "#f4f2ea"
COR_PORTA = "#3f5a3c"      # madeira verde-escura das portas
COR_GRADE = "#3b3f3a"
VITRAL = ["#2d6fb8", "#e0a63a", "#c0392b", "#3c9a5a", "#f2d06b", "#7a4fa0"]

REGIOES = {
    "porta": (0.0, 0.75, 0.25, 1.0),          # porta central em arco: madeira verde, bandeira de vitral em leque
    "janela_arco": (0.25, 0.75, 0.5, 1.0),    # janela do térreo em arco com venezianas verdes
    "janela_sup": (0.5, 0.75, 0.75, 1.0),     # porta-janela/janela do pavimento superior (vidro, caixilho branco)
    "porta_grade": (0.75, 0.75, 1.0, 1.0),    # porta das alas com grade escura
    "janela_sala": (0.0, 0.5, 0.25, 0.75),    # janela alta em arco das laterais da sala e da caixa cênica
    "arcada": (0.25, 0.5, 0.5, 0.75),         # vão de arcada das galerias do pátio
    "balaus": (0.5, 0.5, 1.0, 0.625),         # balaustrada: 4 balaústres brancos por ladrilho (1,2 m)
    "telha": (0.5, 0.625, 1.0, 0.75),         # chapa metálica com junta (a cor vem do .tsx)
    "janela_peq": (0.0, 0.25, 0.25, 0.5),     # janela retangular pequena (fundos, empenas)
}
# proporção (largura/altura, em metros) do quadro em que cada região é usada: os arcos do atlas saem redondos
ASPECTO = {"porta": 1.7 / 4.0, "janela_arco": 1.5 / 3.2, "janela_sup": 1.0 / 2.6, "porta_grade": 1.7 / 3.9,
           "janela_sala": 1.3 / 6.8, "arcada": 2.3 / 3.0, "janela_peq": 1.0 / 1.4}


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
        ra = (a1 - a0) / 2                 # raio em fração da largura
        rb = ra * asp                      # mesmo raio em fração da altura
        bm_ = b1 - rb                      # nascença do arco
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

    # fundo de todas as regiões: reboco verde-claro
    r(0, 0, 1, 1, COR_REBOCO)

    # porta central: moldura branca, folhas de madeira verde com almofadas, bandeira em leque com vitral colorido
    def leque(a, b, ac, bm_, ra, rb):
        if b < bm_:
            return COR_PORTA
        ang = math.atan2((b - bm_) / rb, (a - ac) / ra)
        k = int(ang / math.pi * 7)
        borda = abs(ang / math.pi * 7 - round(ang / math.pi * 7)) < 0.12
        return "#2b2f2c" if borda else VITRAL[k % 4]
    arco("porta", 0.04, 0.96, 0.0, 0.99, COR_BRANCO)
    bm_p = arco("porta", 0.14, 0.86, 0.0, 0.93, COR_PORTA, leque)
    faixa("porta", 0.14, 0.86, bm_p - 0.025, bm_p, "#2b2f2c")
    faixa("porta", 0.485, 0.515, 0.0, bm_p - 0.02, "#2c4029")
    for b0 in (0.08, 0.36):
        for a0 in (0.2, 0.56):
            faixa("porta", a0, a0 + 0.24, b0, b0 + 0.22, "#34502f")
    faixa("porta", 0.46, 0.54, 0.955, 0.995, COR_BRANCO)  # aduela de fecho

    # janela do térreo: venezianas verdes em arco
    arco("janela_arco", 0.06, 0.94, 0.0, 0.99, COR_BRANCO)
    bm_j = arco("janela_arco", 0.16, 0.84, 0.05, 0.93, "#3d5d40")
    for k in range(14):
        b = 0.08 + k * 0.055
        if b < bm_j:
            faixa("janela_arco", 0.16, 0.84, b, b + 0.012, "#2e4831")
    faixa("janela_arco", 0.49, 0.51, 0.05, bm_j, "#2e4831")
    faixa("janela_arco", 0.0, 1.0, 0.0, 0.05, COR_BRANCO)  # peitoril

    # janela do pavimento superior: vidro escuro com caixilho branco e bandeira em arco
    arco("janela_sup", 0.05, 0.95, 0.0, 0.99, COR_BRANCO)
    bm_s = arco("janela_sup", 0.15, 0.85, 0.06, 0.93, "#34475a")
    faixa("janela_sup", 0.15, 0.85, bm_s - 0.02, bm_s, COR_BRANCO)
    faixa("janela_sup", 0.48, 0.52, 0.06, 0.93, COR_BRANCO)
    for b in (0.3, 0.55):
        faixa("janela_sup", 0.15, 0.85, b, b + 0.015, COR_BRANCO)
    faixa("janela_sup", 0.15, 0.85, 0.1, 0.28, "#4c6478")
    faixa("janela_sup", 0.0, 1.0, 0.0, 0.06, COR_BRANCO)

    # porta das alas: grade escura em arco sobre o vão
    arco("porta_grade", 0.05, 0.95, 0.0, 0.99, COR_BRANCO)
    bm_g = arco("porta_grade", 0.15, 0.85, 0.0, 0.93, "#1f2321")
    for k in range(9):
        a = 0.17 + k * 0.08
        faixa("porta_grade", a, a + 0.022, 0.0, 0.93, COR_GRADE)
    for b in (0.3, 0.6, bm_g - 0.01):
        faixa("porta_grade", 0.15, 0.85, b, b + 0.02, COR_GRADE)

    # janela alta da sala: vidro escuro, caixilho branco, travessas
    arco("janela_sala", 0.08, 0.92, 0.0, 0.995, COR_BRANCO)
    bm_l = arco("janela_sala", 0.2, 0.8, 0.03, 0.97, "#34475a")
    for b in (0.3, 0.6, bm_l - 0.01):
        faixa("janela_sala", 0.2, 0.8, b, b + 0.008, COR_BRANCO)
    faixa("janela_sala", 0.48, 0.52, 0.03, 0.97, COR_BRANCO)
    faixa("janela_sala", 0.0, 1.0, 0.0, 0.03, COR_BRANCO)

    # arcada das galerias: vão em sombra com arquivolta branca e pilares brancos
    faixa("arcada", 0.0, 0.1, 0.0, 1.0, COR_BRANCO)
    faixa("arcada", 0.9, 1.0, 0.0, 1.0, COR_BRANCO)
    arco("arcada", 0.1, 0.9, 0.0, 0.94, COR_BRANCO)
    arco("arcada", 0.16, 0.84, 0.0, 0.9, "#4a5047")
    faixa("arcada", 0.0, 1.0, 0.96, 1.0, COR_BRANCO)

    # balaustrada: fundo em sombra, 4 balaústres brancos, corrimão e base
    u0, v0, u1, v1 = REGIOES["balaus"]
    r(u0, v0, u1, v1, "#56604f")
    for k in range(4):
        uc = u0 + (u1 - u0) * (k + 0.5) / 4
        for y in range(int(v0 * n), int(v1 * n)):
            b = ((y + 0.5) / n - v0) / (v1 - v0)
            larg = 0.06 + 0.05 * math.sin(math.pi * min(1, max(0, (b - 0.15) / 0.7))) ** 0.7
            r(uc - larg * (u1 - u0) / 4 * 2, (y) / n, uc + larg * (u1 - u0) / 4 * 2, (y + 1) / n, COR_BRANCO)
    r(u0, v0, u1, v0 + (v1 - v0) * 0.14, COR_BRANCO)
    r(u0, v1 - (v1 - v0) * 0.16, u1, v1, COR_BRANCO)

    # chapa metálica: fundo claro, junta em pé nas bordas e um leve degradê (a cor vem do .tsx)
    u0, v0, u1, v1 = REGIOES["telha"]
    for x in range(int(u0 * n), int(u1 * n)):
        a = ((x + 0.5) / n - u0) / (u1 - u0)
        tom = "#d9d9d9" if (a < 0.06 or a > 0.94) else ("#f4f4f4" if a < 0.5 else "#eaeaea")
        r(x / n, v0, (x + 1) / n, v1, tom)

    # janela pequena retangular
    faixa("janela_peq", 0.1, 0.9, 0.0, 1.0, COR_BRANCO)
    faixa("janela_peq", 0.2, 0.8, 0.1, 0.9, "#34475a")
    faixa("janela_peq", 0.48, 0.52, 0.1, 0.9, COR_BRANCO)

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


# atlas dos vitrais (desenhado em canvas no .tsx, 512 × 256): regiões em pixels, y para baixo
VITRAIS = {
    "ferro": (0, 0, 376, 256),     # elevação da fachada de ferro: 14,4 × 9,8 m
    "leque": (376, 0, 512, 68),    # leque (meia-lua) do coroamento: 4,2 × 2,1 m
    "brasao": (376, 68, 512, 256), # brasão do coroamento da fachada principal
}


def uv_vitral(reg, a, b):
    x0, y0, x1, y1 = VITRAIS[reg]
    return ((x0 + (x1 - x0) * a) / 512, 1 - (y0 + (y1 - y0) * (1 - b)) / 256)


# ———————————————————————————————————————————————— materiais do marco

def criar_materiais():
    atlas = atlas_esquadrias()
    M = {}
    M["piso"] = mat("Mat_Chao_Piso", "#d6d1c6", 0.92)
    M["rua"] = mat("Mat_Chao_Rua", "#8a857b", 0.95)
    M["grama"] = mat("Mat_Chao_Grama", "#6e9e48", 0.95)
    M["caminho"] = mat("Mat_Chao_Caminho", "#e6d9b8", 0.9)
    M["patio"] = mat("Mat_Chao_Patio", "#c9bfae", 0.9)
    M["lote"] = mat("Mat_Chao_Lote", "#bdb8ad", 0.92)
    M["desenho"] = mat("Mat_Chao_Desenho", "#7f7a71", 0.9)
    M["meiofio"] = mat("Mat_Meio_Fio", "#e2ded5", 0.85)
    M["reboco"] = mat("Mat_Reboco_Verde", COR_REBOCO, 0.85)
    M["branco"] = mat("Mat_Frisos_Brancos", COR_BRANCO, 0.7)
    M["soco"] = mat("Mat_Soco", "#dcd6c6", 0.85)
    M["laje"] = mat("Mat_Cobertura_Laje", "#c9c3b5", 0.9)
    M["esquadrias"] = mat("Mat_Esquadrias", "#ffffff", 0.5, 0.0, atlas)
    M["vitrais"] = mat("Mat_Vitrais", "#ffffff", 0.35)
    M["ferro"] = mat("Mat_Ferro_Verde", "#2f5a45", 0.5, 0.3)
    M["ouro"] = mat("Mat_Ouro", "#d8b04e", 0.38, 0.3)
    M["telha"] = mat("Mat_Telha_Metalica", "#8e9296", 0.55, 0.0, atlas)
    M["canteiros"] = mat("Mat_Canteiros", "#ffffff", 0.9)
    M["arbusto"] = mat("Mat_Arbusto", "#3f6d33", 0.9)
    M["poste"] = mat("Mat_Metal_Poste", "#3a3f43", 0.45, 0.4)
    M["globo"] = mat("Mat_Globo_Luminaria", "#fbfaf4", 0.3)
    M["granito"] = mat("Mat_Granito_Branco", "#e9e6df", 0.5)
    M["bronze"] = mat("Mat_Bronze", "#6a5636", 0.5, 0.4)
    M["balizador"] = mat("Mat_Balizador_Preto", "#26282a", 0.6)
    M["madeira"] = mat("Mat_Madeira_Banco", "#7a5638", 0.75)
    M["vizinha"] = mat("Mat_Parede_Vizinha", "#ebe1c8", 0.85)
    M["barro"] = mat("Mat_Telha_Barro", "#b9603c", 0.8, 0.0, atlas)
    return M


# ———————————————————————————————————————————————— peças de fachada

def nrm_de(face):
    return {"-y": (0.0, -1.0), "+y": (0.0, 1.0), "-x": (-1.0, 0.0), "+x": (1.0, 0.0)}[face]


def vao(P, M, cx, cy, face, larg, z0, z1, reg, saliente=0.025, recorte=(0.0, 1.0)):
    """
    Esquadria do atlas num plano de parede: centro (cx, cy) na face, `face` = lado para onde a parede olha. `recorte`
    usa só a faixa horizontal (a0, a1) da região (sem o reboco verde das bordas, em paredes de outra cor).
    """
    nx, ny = nrm_de(face)
    rx, ry = -ny, nx                     # direita de quem olha a parede de frente
    ox, oy = cx + nx * saliente, cy + ny * saliente
    a = (ox - rx * larg / 2, oy - ry * larg / 2)
    b = (ox + rx * larg / 2, oy + ry * larg / 2)
    a0, a1 = recorte
    P.poli([(a[0], a[1], Z0 + z0), (b[0], b[1], Z0 + z0), (b[0], b[1], Z0 + z1), (a[0], a[1], Z0 + z1)], M["esquadrias"],
           [uv_reg(reg, u, v) for u, v in ((a0, 0), (a1, 0), (a1, 1), (a0, 1))])


def fileira(P, M, p0, p1, face, n, larg, z0, z1, reg):
    """`n` vãos iguais ao longo de uma parede reta de p0 a p1"""
    for k in range(n):
        t = (k + 0.5) / n
        vao(P, M, p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, face, larg, z0, z1, reg)


def pilastra(P, M, x, y, face, larg, z0, z1, prof=0.16, m=None):
    nx, ny = nrm_de(face)
    sx, sy = (larg, prof) if ny else (prof, larg)
    P.juntar(bm_caixa(sx, sy, z1 - z0), m or M["branco"], T(x + nx * prof / 2, y + ny * prof / 2, Z0 + z0))


def cinta(P, m, x0, y0, x1, y1, z0, z1, proj, topo=None):
    """Cornija/friso em volta de um volume retangular: prisma um pouco maior que a planta"""
    P.juntar(bm_prisma(ret(x0 - proj, y0 - proj, x1 + proj, y1 + proj), Z0 + z0, Z0 + z1, 0.0, mat_lados=1), [topo or m, m])


def balaustrada(P, M, p0, p1, z0, alt=0.85, esp=0.14, passo=1.2):
    """Balaustrada de p0 a p1: placa com os balaústres do atlas (nas duas faces), base e corrimão brancos"""
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
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
    P.juntar(bm_caixa(L + 0.04, esp + 0.12, 0.1), M["branco"], T(c.x, c.y, zt, ang))


def pedestal(P, M, x, y, z0, lado=0.5, alt=0.95):
    """Pedestal branco do coroamento (base, dado e capa)"""
    P.juntar(bm_caixa(lado + 0.1, lado + 0.1, 0.15), M["branco"], T(x, y, Z0 + z0))
    P.juntar(bm_caixa(lado, lado, alt - 0.27), M["branco"], T(x, y, Z0 + z0 + 0.15))
    P.juntar(bm_caixa(lado + 0.14, lado + 0.14, 0.12), M["branco"], T(x, y, Z0 + z0 + alt - 0.12))
    return Z0 + z0 + alt


def pinha(P, M, x, y, z, esc=1.0):
    """Pinha (urna com remate) dourada do coroamento"""
    perfil = [(0, 0), (0.17, 0), (0.17, 0.07), (0.09, 0.12), (0.2, 0.28), (0.23, 0.42), (0.17, 0.58), (0.07, 0.72), (0.04, 0.82), (0, 0.9)]
    P.juntar(bm_torno([(r * esc, h * esc) for r, h in perfil], 10), M["ouro"], T(x, y, z), liso=True)


def estatua(P, M, x, y, z, giro=0.0, espelho=1, esc=1.3):
    """
    Estátua alegórica dourada das quinas do coroamento (ficha: duas estátuas douradas): figura de pé com túnica, um braço
    erguido segurando uma coroa e o outro junto ao corpo. Interpretação: as fotos pequenas não mostram o atributo.
    """
    bm = bmesh.new()
    partes = [
        (bm_cilindro(0.34, 1.0, 10, r2=0.2), (0, 0, 0)),          # túnica
        (bm_cilindro(0.2, 0.55, 10, r2=0.16), (0, 0, 1.0)),       # tronco
        (bm_esfera(0.14, 1), (0, 0, 1.72)),                       # cabeça
        (bm_cilindro(0.15, 0.12, 8, r2=0.12), (0, 0, 1.52)),      # pescoço/ombros
    ]
    for b2, (dx, dy, dz) in partes:
        b2.transform(Matrix.Diagonal((esc, esc, esc, 1)) @ Matrix.Translation((dx, dy, dz)))
        me = bpy.data.meshes.new("tmp")
        b2.to_mesh(me)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        b2.free()
    P.juntar(bm, M["ouro"], T(x, y, z, giro), liso=True)
    # braço erguido com a coroa e braço baixo
    s = espelho
    ca = Vector((x, y, z))
    rot = Matrix.Rotation(math.radians(giro), 3, "Z")
    ombro = ca + rot @ (Vector((0.2 * s, 0, 1.5)) * esc)
    mao = ca + rot @ (Vector((0.42 * s, -0.08, 2.15)) * esc)
    barra(P, ombro, mao, 0.09 * esc, M["ouro"])
    coroa = bm_torno([(0.16, -0.02), (0.18, 0.0), (0.16, 0.02), (0.12, 0.0), (0.16, -0.02)], 10)
    coroa.transform(Matrix.Diagonal((esc, esc, esc, 1)))
    P.juntar(coroa, M["ouro"], Matrix.Translation(mao + Vector((0, 0, 0.08 * esc))))
    barra(P, ca + rot @ (Vector((-0.2 * s, 0, 1.5)) * esc), ca + rot @ (Vector((-0.3 * s, -0.05, 0.95)) * esc), 0.08 * esc, M["ouro"])


def arco_extrudado(cx, y, z0, raio, alt, prof, n=12, larg=None):
    """Meia-lua (segmento de círculo) no plano y, de largura 2·larg, flecha `alt`, extrudada em +y por `prof`"""
    larg = larg or raio
    pts = []
    for k in range(n + 1):
        a = math.pi * k / n
        pts.append((cx - larg * math.cos(a), y, z0 + alt * math.sin(a)))
    return bm_poli_extrudado(pts, (0, prof, 0))


# ———————————————————————————————————————————————— bloco da fachada

def fachada(M):
    """
    Fachada eclética (ficha, foto frontal ref-3): corpo central de 2 pavimentos (66% da frente) com a entrada de 3 arcos
    entre 4 colunas brancas e o balcão de balaústres em cima, janelas pareadas com frontões curvos no pavimento superior,
    cornija branca e coroamento com brasão, pinhas e duas estátuas douradas nas quinas; alas térreas com terraço de
    balaustrada e portas com grade. Reboco verde-claro e frisos brancos.
    """
    P = Peca("Fachada_Principal")
    W, B = M["reboco"], M["branco"]
    yb = Y_FUNDO_FACHADA
    # volumes
    P.juntar(bm_prisma(ret(-X_CENTRO, Y_FRENTE, X_CENTRO, yb), Z0, Z0 + H_CORNIJA, 0.04), [M["laje"], W])
    for s in (-1, 1):
        x0, x1 = sorted((s * X_CENTRO, s * X_SALA))
        P.juntar(bm_prisma(ret(x0, Y_ALAS, x1, yb), Z0, Z0 + H_ALA - 0.4, 0.04), [M["laje"], W])
        # soco, cornija e terraço da ala
        cinta(P, M["soco"], x0, Y_ALAS, x1, yb, 0.0, 0.6, 0.07)
        cinta(P, B, x0, Y_ALAS, x1, yb, H_ALA - 0.6, H_ALA - 0.4, 0.12)
        cinta(P, B, x0, Y_ALAS, x1, yb, H_ALA - 0.4, H_ALA, 0.24, topo=M["laje"])
        xe = s * (X_SALA - 0.12)
        balaustrada(P, M, (s * (X_CENTRO + 0.25), Y_ALAS - 0.1), (xe, Y_ALAS - 0.1), H_ALA)
        balaustrada(P, M, (xe, Y_ALAS - 0.1), (xe, yb + 0.1), H_ALA)
        zt = pedestal(P, M, xe, Y_ALAS - 0.1, H_ALA, 0.45, 1.0)
        pinha(P, M, xe, Y_ALAS - 0.1, zt, 0.9)
        pedestal(P, M, xe, yb + 0.1, H_ALA, 0.4, 0.95)
        # portas com grade e pilastras da ala (frente) e janelas na lateral
        xc = s * (X_CENTRO + X_SALA) / 2
        vao(P, M, xc, Y_ALAS, "-y", 1.8, 0.15, 4.2, "porta_grade")
        pilastra(P, M, s * (X_SALA - 0.3), Y_ALAS, "-y", 0.55, 0.6, H_ALA - 0.6)
        pilastra(P, M, s * (X_CENTRO + 0.32), Y_ALAS, "-y", 0.45, 0.6, H_ALA - 0.6)
        fileira(P, M, (s * X_SALA, Y_ALAS + 0.6), (s * X_SALA, yb - 0.4), "+x" if s > 0 else "-x", 2, 1.4, 1.1, 4.2, "janela_arco")
    # soco, frisos e cornija do corpo central
    cinta(P, M["soco"], -X_CENTRO, Y_FRENTE, X_CENTRO, yb, 0.0, 0.6, 0.08)
    cinta(P, B, -X_CENTRO, Y_FRENTE, X_CENTRO, yb, H_TERREO - 0.35, H_TERREO + 0.05, 0.14)
    cinta(P, B, -X_CENTRO, Y_FRENTE, X_CENTRO, yb, H_CORNIJA - 0.75, H_CORNIJA - 0.45, 0.08)
    cinta(P, B, -X_CENTRO, Y_FRENTE, X_CENTRO, yb, H_CORNIJA - 0.45, H_CORNIJA, 0.34, topo=M["laje"])
    # pilastras do corpo central: quinas e limites da entrada, nos dois pavimentos
    for x in (-X_CENTRO + 0.3, X_CENTRO - 0.3):
        pilastra(P, M, x, Y_FRENTE, "-y", 0.6, 0.6, H_CORNIJA - 0.75, 0.2)
    for x in (-X_PORTICO, X_PORTICO):
        pilastra(P, M, x, Y_FRENTE, "-y", 0.45, H_TERREO + 0.05, H_CORNIJA - 0.75)
    for s in (-1, 1):
        for y in (Y_FRENTE + 0.3, yb - 0.3):
            pilastra(P, M, s * X_CENTRO, y, "+x" if s > 0 else "-x", 0.5, H_ALA, H_CORNIJA - 0.75)
    # entrada: três portas em arco entre quatro colunas, entablamento e balcão
    yc = Y_FRENTE - 0.42
    for x in (-3.45, -1.15, 1.15, 3.45):
        P.juntar(bm_caixa(0.72, 0.72, 0.55), B, T(x, yc, Z0))
        P.juntar(bm_cilindro(0.26, 3.85, 12, r2=0.22), B, T(x, yc, Z0 + 0.55), liso=True)
        P.juntar(bm_torno([(0.22, 0), (0.34, 0.12), (0.4, 0.22), (0, 0.22)], 12), B, T(x, yc, Z0 + 4.4), liso=True)
        P.juntar(bm_caixa(0.66, 0.66, 0.12), B, T(x, yc, Z0 + 4.6))
    for x in (-2.3, 0.0, 2.3):
        vao(P, M, x, Y_FRENTE, "-y", 1.75, 0.12, 4.25, "porta")
    caixa(P, B, -X_PORTICO - 0.2, Y_FRENTE - 0.82, H_TERREO - 0.6 + Z0, X_PORTICO + 0.2, Y_FRENTE, H_TERREO + Z0)
    caixa(P, M["laje"], -X_PORTICO - 0.25, Y_FRENTE - 0.9, H_TERREO + Z0, X_PORTICO + 0.25, Y_FRENTE, H_TERREO + 0.12 + Z0)
    yb_b = Y_FRENTE - 0.8
    balaustrada(P, M, (-X_PORTICO, yb_b), (X_PORTICO, yb_b), H_TERREO + 0.12, 0.85)
    for s in (-1, 1):
        balaustrada(P, M, (s * X_PORTICO, yb_b), (s * X_PORTICO, Y_FRENTE - 0.05), H_TERREO + 0.12, 0.85)
        pedestal(P, M, s * X_PORTICO, yb_b, H_TERREO + 0.12, 0.42, 0.95)
    # pavimento superior da entrada: três portas-janela em arco sobre o balcão, pilastras finas entre elas
    for x in (-2.3, 0.0, 2.3):
        vao(P, M, x, Y_FRENTE, "-y", 1.25, H_TERREO + 0.2, H_TERREO + 3.55, "janela_sup")
        P.juntar(arco_extrudado(x, Y_FRENTE - 0.2, Z0 + H_TERREO + 3.65, 0.8, 0.35, 0.2, 8), B)
    for x in (-1.15, 1.15):
        pilastra(P, M, x, Y_FRENTE, "-y", 0.3, H_TERREO + 0.1, H_CORNIJA - 0.75)
    # alas do corpo central (entre a entrada e as quinas): janela em arco embaixo, janelas pareadas com frontão curvo em cima
    for s in (-1, 1):
        xc = s * (X_PORTICO + X_CENTRO) / 2
        vao(P, M, xc, Y_FRENTE, "-y", 1.55, 0.9, 4.3, "janela_arco")
        P.juntar(bm_caixa(1.9, 0.18, 0.18), B, T(xc, Y_FRENTE - 0.09, Z0 + 4.38))
        for dx in (-0.58, 0.58):
            vao(P, M, xc + dx, Y_FRENTE, "-y", 0.95, H_TERREO + 0.65, H_TERREO + 3.15, "janela_sup")
        P.juntar(arco_extrudado(xc, Y_FRENTE - 0.24, Z0 + H_TERREO + 3.3, 1.3, 0.5, 0.24, 10), B)
        P.juntar(bm_caixa(2.7, 0.24, 0.1), B, T(xc, Y_FRENTE - 0.12, Z0 + H_TERREO + 3.2))
        # laterais do corpo central acima das alas e fundos para o pátio
        fileira(P, M, (s * X_CENTRO, Y_FRENTE + 0.8), (s * X_CENTRO, yb - 0.8), "+x" if s > 0 else "-x", 2, 0.95, H_TERREO + 0.65, H_TERREO + 3.15, "janela_sup")
    fileira(P, M, (X_CENTRO - 0.6, yb), (-X_CENTRO + 0.6, yb), "+y", 5, 0.95, H_TERREO + 0.65, H_TERREO + 3.15, "janela_sup")
    fileira(P, M, (X_PORTICO + 0.6, yb), (-X_PORTICO - 0.6, yb), "+y", 3, 2.2, 0.1, 3.4, "arcada")
    # coroamento: balaustrada sobre a cornija, pedestais, frontispício curvo com o brasão, pinhas e estátuas
    zc = H_CORNIJA
    yt = Y_FRENTE + 0.12
    for s in (-1, 1):
        balaustrada(P, M, (s * 2.75, yt), (s * (X_CENTRO - 0.3), yt), zc, 0.8)
        balaustrada(P, M, (s * (X_CENTRO - 0.3), yt), (s * (X_CENTRO - 0.3), yb - 0.15), zc, 0.8)
        zq = pedestal(P, M, s * (X_CENTRO - 0.3), yt, zc, 0.62, 1.05)
        estatua(P, M, s * (X_CENTRO - 0.3), yt, zq, s * 8, -s)
        zp = pedestal(P, M, s * X_PORTICO, yt, zc, 0.48, 0.95)
        pinha(P, M, s * X_PORTICO, yt, zp)
        zp = pedestal(P, M, s * 2.75, yt, zc, 0.5, 1.15)
        pinha(P, M, s * 2.75, yt, zp, 1.05)
        pedestal(P, M, s * (X_CENTRO - 0.3), yb - 0.15, zc, 0.45, 0.9)
    caixa(P, W, -X_CENTRO + 0.3, yb - 0.3, Z0 + zc, X_CENTRO - 0.3, yb - 0.1, Z0 + zc + 0.7)
    # telhado de chapa de quatro águas escondido atrás da platibanda (forma simplificada)
    telhado(P, M, -X_CENTRO + 0.55, Y_FRENTE + 0.6, X_CENTRO - 0.55, yb - 0.5, Z0 + zc - 0.1, 1.35, 0.0)
    # frontispício: placa de reboco com topo em arco abatido, moldura branca e o brasão
    yf = Y_FRENTE + 0.05
    P.juntar(bm_caixa(5.3, 0.4, 1.05), W, T(0, yf + 0.15, Z0 + zc))
    P.juntar(arco_extrudado(0, yf - 0.05, Z0 + zc + 1.05, 2.65, 0.95, 0.4, 14), W)
    P.juntar(arco_extrudado(0, yf - 0.12, Z0 + zc + 1.0, 2.82, 1.1, 0.12, 14), B)
    P.juntar(bm_caixa(5.65, 0.5, 0.14), B, T(0, yf + 0.12, Z0 + zc + 0.95))
    pinha(P, M, 0, yf + 0.1, Z0 + zc + 2.08, 0.8)
    # brasão: cartela branca com o escudo do atlas dos vitrais (cores do brasão do Ceará, interpretação)
    yb_r = Y_FRENTE - 0.22
    P.juntar(bm_caixa(1.5, 0.18, 1.55, 0.04), B, T(0, yb_r + 0.12, Z0 + zc + 0.35))
    q = [(-0.6, yb_r, Z0 + zc + 0.45), (0.6, yb_r, Z0 + zc + 0.45), (0.6, yb_r, Z0 + zc + 1.8), (-0.6, yb_r, Z0 + zc + 1.8)]
    P.poli(q, M["vitrais"], [uv_vitral("brasao", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
    reservar(ret(-X_SALA - 0.4, Y_FRENTE - 1.0, X_SALA + 0.4, yb), 0.4)
    return P.criar()


# ———————————————————————————————————————————————— galerias do pátio

def galerias(M):
    """Galerias de 2 pavimentos (OSM h 8,1 m) dos dois lados do pátio, com arcada no térreo, e os braços junto à sala"""
    P = Peca("Galerias_Patio")
    W, B = M["reboco"], M["branco"]
    y0, y1 = Y_FUNDO_FACHADA, Y_FERRO
    for s in (-1, 1):
        xi, xe = s * X_PATIO, s * X_SALA
        x0, x1 = sorted((xi, xe))
        P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0, Z0 + H_GALERIA, 0.04), [M["laje"], W])
        cinta(P, M["soco"], x0, y0, x1, y1, 0.0, 0.5, 0.06)
        cinta(P, B, x0, y0, x1, y1, 3.15, 3.4, 0.1)
        cinta(P, B, x0, y0, x1, y1, H_GALERIA - 0.4, H_GALERIA, 0.22, topo=M["laje"])
        face_in = "-x" if s > 0 else "+x"
        face_out = "+x" if s > 0 else "-x"
        fileira(P, M, (xi, y0 + 0.2), (xi, 6.6), face_in, 4, 2.3, 0.1, 3.0, "arcada")
        fileira(P, M, (xi, y0 + 0.2), (xi, 6.6), face_in, 4, 0.9, 3.7, 5.75, "janela_sup")
        fileira(P, M, (xe, y0 + 0.3), (xe, y1 - 0.3), face_out, 4, 1.25, 0.9, 2.95, "janela_arco")
        fileira(P, M, (xe, y0 + 0.3), (xe, y1 - 0.3), face_out, 4, 0.9, 3.7, 5.75, "janela_sup")
        for k in range(5):
            pilastra(P, M, xe, y0 + 0.25 + (y1 - y0 - 0.5) * k / 4, face_out, 0.4, 0.5, H_GALERIA - 0.4, 0.12)
        # parapeito baixo em volta do terraço
        caixa(P, W, x0 + 0.05, y0 + 0.05, Z0 + H_GALERIA, x1 - 0.05, y0 + 0.25, Z0 + H_GALERIA + 0.55)
        balaustrada(P, M, (xi + s * -0.05, y0 + 0.4), (xi + s * -0.05, 6.4), H_GALERIA, 0.75)
        # braço junto à fachada de ferro
        xa0, xa1 = sorted((s * X_FERRO, xi))
        P.juntar(bm_prisma(ret(xa0, 6.6, xa1, y1), Z0, Z0 + H_GALERIA, 0.04), [M["laje"], W])
        cinta(P, B, xa0, 6.6, xa1, y1, H_GALERIA - 0.4, H_GALERIA, 0.18, topo=M["laje"])
        cinta(P, B, xa0, 6.6, xa1, y1, 3.15, 3.4, 0.08)
        vao(P, M, (xa0 + xa1) / 2, 6.6, "-y", 1.3, 0.1, 3.0, "arcada")
        vao(P, M, (xa0 + xa1) / 2, 6.6, "-y", 0.9, 3.7, 5.75, "janela_sup")
    return P.criar()


# ———————————————————————————————————————————————— fachada de ferro (pátio)

def fachada_ferro(M):
    """
    Fachada de ferro art nouveau da sala (Walter MacFarlane & Co., Glasgow), vista do pátio: a elevação colorida dos vitrais
    vem do canvas do .tsx (região "ferro"); por cima, a estrutura em 3D de ferro verde: colunas, vigas, dois balcões com
    guarda-corpo e o coroamento em leque com remates dourados. O desenho exato dos vitrais é interpretação (ficha).
    """
    P = Peca("Fachada_de_Ferro")
    F, O = M["ferro"], M["ouro"]
    y = Y_FERRO - 0.02
    z_topo = 9.8
    q = [(-X_FERRO, y, Z0 + 0.04), (X_FERRO, y, Z0 + 0.04), (X_FERRO, y, Z0 + z_topo), (-X_FERRO, y, Z0 + z_topo)]
    P.poli(q, M["vitrais"], [uv_vitral("ferro", a, b) for a, b in ((0, 0), (1, 0), (1, 1), (0, 1))])
    # colunas nas divisas dos 5 vãos (2,6 + 2,6 + 4,0 + 2,6 + 2,6 m), com capitéis dourados em cada nível
    xs = [-X_FERRO + 0.11, -4.6, -2.0, 2.0, 4.6, X_FERRO - 0.11]
    for x in xs:
        P.juntar(bm_caixa(0.22, 0.24, z_topo), F, T(x, y - 0.12, Z0))
        for zc in (3.3, 6.2, 9.35):
            P.juntar(bm_caixa(0.34, 0.34, 0.14), O, T(x, y - 0.14, Z0 + zc))
    # vigas de cada nível e cornija de ferro no alto
    for z0_, z1_, prof in ((3.42, 3.62, 0.3), (6.32, 6.52, 0.3), (9.5, 9.85, 0.42)):
        caixa(P, F, -X_FERRO, y - prof, Z0 + z0_, X_FERRO, y, Z0 + z1_)
    caixa(P, O, -X_FERRO, y - 0.44, Z0 + 9.85, X_FERRO, y - 0.02, Z0 + 9.9)
    # dois balcões corridos (piso, mãos-francesas, guarda-corpo de barras finas)
    for zb in (3.42, 6.32):
        caixa(P, F, -X_FERRO + 0.05, y - 0.95, Z0 + zb - 0.12, X_FERRO - 0.05, y, Z0 + zb)
        for x in xs:
            barra(P, (x, y - 0.12, Z0 + zb - 0.75), (x, y - 0.9, Z0 + zb - 0.12), 0.08, F)
        yg = y - 0.9
        caixa(P, F, -X_FERRO + 0.05, yg - 0.05, Z0 + zb + 0.86, X_FERRO - 0.05, yg + 0.05, Z0 + zb + 0.94)
        caixa(P, F, -X_FERRO + 0.05, yg - 0.04, Z0 + zb + 0.1, X_FERRO - 0.05, yg + 0.04, Z0 + zb + 0.16)
        n = int(2 * X_FERRO / 0.24)
        for k in range(n + 1):
            x = -X_FERRO + 0.1 + (2 * X_FERRO - 0.2) * k / n
            BARRAS.append((x, yg, Z0 + zb + 0.12, 0.76))
        for x in xs:
            P.juntar(bm_caixa(0.09, 0.09, 0.86), F, T(x, yg, Z0 + zb + 0.06))
    # coroamento: leque (meia-lua) de vitral no meio, aro de ferro, remates dourados
    zl = Z0 + z_topo + 0.05
    R = 2.1
    pts, uvs = [], []
    for k in range(17):
        a = math.pi * k / 16
        px_, pz = R * math.cos(a), R * math.sin(a)   # da direita para a esquerda: face para −y (o pátio)
        pts.append((px_, y - 0.04, zl + pz))
        uvs.append(uv_vitral("leque", (px_ + R) / (2 * R), pz / R))
    P.poli(pts, M["vitrais"], uvs)
    P.juntar(arco_extrudado(0, y - 0.02, zl - 0.01, R, R, 0.3, 16), F)
    aro = []
    for k in range(17):
        a = math.pi * k / 16
        aro.append((-(R + 0.22) * math.cos(a), y - 0.1, zl + (R + 0.22) * math.sin(a)))
    for k in range(16, -1, -1):
        a = math.pi * k / 16
        aro.append((-R * math.cos(a), y - 0.1, zl + R * math.sin(a)))
    P.juntar(bm_poli_extrudado(aro, (0, 0.12, 0)), F)
    pinha(P, M, 0, y - 0.1, zl + R + 0.15, 0.7)
    for x in (-X_FERRO + 0.11, -2.4, 2.4, X_FERRO - 0.11):
        pinha(P, M, x, y - 0.15, Z0 + 9.9, 0.55)
    # crista baixa de ferro dos lados do leque
    for s in (-1, 1):
        for k in range(9):
            x = s * (R + 0.45 + k * 0.5)
            if abs(x) > X_FERRO - 0.2:
                break
            P.juntar(bm_cilindro(0.04, 0.42, 6), F, T(x, y - 0.25, Z0 + 9.9))
            P.juntar(bm_caixa(0.12, 0.12, 0.12), O, T(x, y - 0.25, Z0 + 10.32))
    return P.criar()


# ———————————————————————————————————————————————— sala de espetáculos e caixa cênica

def agua(P, m, pts3, larg=0.9):
    """
    Água de telhado (polígono plano convexo, anti-horário visto de fora, 1º lado = beiral) cortada em faixas
    perpendiculares ao beiral: cada faixa leva a chapa com junta do atlas.
    """
    a, b, c = Vector(pts3[0]), Vector(pts3[1]), Vector(pts3[2])
    sdir = (b - a).normalized()
    n = (b - a).cross(c - a).normalized()
    tdir = n.cross(sdir)
    p2 = [((Vector(p) - a).dot(sdir), (Vector(p) - a).dot(tdir)) for p in pts3]
    smin, smax = min(p[0] for p in p2), max(p[0] for p in p2)
    tmax = max(p[1] for p in p2) or 1.0
    k0 = math.floor(smin / larg)
    k1 = math.ceil(smax / larg)
    for k in range(k0, k1):
        peca = cortar_faixa(p2, k * larg, (k + 1) * larg)
        if len(peca) < 3:
            continue
        pts = [tuple(a + sdir * s + tdir * t) for s, t in peca]
        uvs = [uv_reg("telha", (s - k * larg) / larg, t / tmax) for s, t in peca]
        try:
            P.poli(pts, m, uvs)
        except ValueError:
            pass


def telhado(P, M, x0, y0, x1, y1, z, h, beiral=0.3, cumeeira=True, m=None):
    """Telhado de quatro águas em chapa metálica com beiral, testeira e cumeeira"""
    b = beiral
    X0, Y0, X1, Y1 = x0 - b, y0 - b, x1 + b, y1 + b
    w, d = X1 - X0, Y1 - Y0
    zc = z + 0.1
    if w >= d:
        t0, t1 = (X0 + d / 2, (Y0 + Y1) / 2), (X1 - d / 2, (Y0 + Y1) / 2)
    else:
        t0, t1 = ((X0 + X1) / 2, Y0 + w / 2), ((X0 + X1) / 2, Y1 - w / 2)
    zt = zc + h
    c0, c1, c2, c3 = (X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)
    P.juntar(bm_prisma([c0, c1, c2, c3], z, zc, 0.0, mat_lados=1), [M["laje"], M["branco"]])
    m = m or M["telha"]
    A = lambda p, zz: (p[0], p[1], zz)
    if w >= d:
        aguas = [[A(c0, zc), A(c1, zc), A(t1, zt), A(t0, zt)], [A(c1, zc), A(c2, zc), A(t1, zt)],
                 [A(c2, zc), A(c3, zc), A(t0, zt), A(t1, zt)], [A(c3, zc), A(c0, zc), A(t0, zt)]]
    else:
        aguas = [[A(c0, zc), A(c1, zc), A(t0, zt)], [A(c1, zc), A(c2, zc), A(t1, zt), A(t0, zt)],
                 [A(c2, zc), A(c3, zc), A(t1, zt)], [A(c3, zc), A(c0, zc), A(t0, zt), A(t1, zt)]]
    for ag in aguas:
        if len(ag) == 4 and math.hypot(ag[2][0] - ag[3][0], ag[2][1] - ag[3][1]) < 1e-3:
            ag = ag[:3]
        agua(P, m, ag)
    if cumeeira and math.hypot(t1[0] - t0[0], t1[1] - t0[1]) > 0.1:
        barra(P, (t0[0], t0[1], zt + 0.05), (t1[0], t1[1], zt + 0.05), 0.16, M["poste"])


def sala(M):
    """
    Sala de espetáculos (OSM h 12,4 m), caixa cênica (h 17,5 m) e fundo do palco (h 12,8 m): paredes de reboco verde com
    pilastras brancas e janelas altas em arco nas laterais, coberturas metálicas de quatro águas (forma simplificada,
    dúvida na ficha).
    """
    P = Peca("Sala_de_Espetaculos")
    W, B = M["reboco"], M["branco"]
    P.juntar(bm_prisma(ret(-X_SALA, Y_FERRO, X_SALA, Y_TORRE1), Z0, Z0 + H_SALA, 0.04), [M["laje"], W])
    cinta(P, M["soco"], -X_SALA, Y_FERRO, X_SALA, Y_TORRE1, 0.0, 0.6, 0.06)
    cinta(P, B, -X_SALA, Y_FERRO, X_SALA, Y_TORRE1, H_SALA - 0.7, H_SALA - 0.45, 0.1)
    cinta(P, B, -X_SALA, Y_FERRO, X_SALA, Y_TORRE1, H_SALA - 0.45, H_SALA, 0.26)
    nb = 6
    for s in (-1, 1):
        face = "+x" if s > 0 else "-x"
        xe = s * X_SALA
        for k in range(nb + 1):
            y = Y_FERRO + 0.25 + (Y_TORRE1 - Y_FERRO - 0.5) * k / nb
            pilastra(P, M, xe, y, face, 0.5, 0.6, H_SALA - 0.7, 0.14)
        fileira(P, M, (xe, Y_FERRO + 0.25), (xe, Y_TORRE1 - 0.25), face, nb, 1.35, 1.5, 8.3, "janela_sala")
        # fundos da sala dos lados do palco
        vao(P, M, s * (X_TORRE + X_SALA) / 2, Y_TORRE1, "+y", 1.3, 1.5, 8.3, "janela_sala")
    # coberturas: plateia em quatro águas, faixas dos lados da caixa cênica
    telhado(P, M, -X_SALA, Y_FERRO, X_SALA, Y_TORRE0 + 0.05, Z0 + H_SALA, 2.3, 0.28)
    for s in (-1, 1):
        x0, x1 = sorted((s * X_TORRE, s * X_SALA))
        telhado(P, M, x0, Y_TORRE0, x1, Y_TORRE1, Z0 + H_SALA, 1.3, 0.28, cumeeira=False)
    # caixa cênica
    P.juntar(bm_prisma(ret(-X_TORRE, Y_TORRE0, X_TORRE, Y_TORRE1), Z0 + H_SALA - 0.5, Z0 + H_TORRE, 0.04), [M["laje"], W])
    cinta(P, B, -X_TORRE, Y_TORRE0, X_TORRE, Y_TORRE1, H_TORRE - 0.65, H_TORRE - 0.4, 0.08)
    cinta(P, B, -X_TORRE, Y_TORRE0, X_TORRE, Y_TORRE1, H_TORRE - 0.4, H_TORRE, 0.22)
    for s in (-1, 1):
        for y in (Y_TORRE0, Y_TORRE1):
            pilastra(P, M, s * (X_TORRE - 0.3), y, "-y" if y == Y_TORRE0 else "+y", 0.55, H_SALA + 0.2, H_TORRE - 0.65, 0.14)
        fileira(P, M, (s * X_TORRE, Y_TORRE0 + 1.0), (s * X_TORRE, Y_TORRE1 - 1.0), "+x" if s > 0 else "-x", 3, 0.9, 11.2, 13.0, "janela_peq")
    fileira(P, M, (-X_TORRE + 1.2, Y_TORRE0), (X_TORRE - 1.2, Y_TORRE0), "-y", 3, 1.0, 11.2, 13.0, "janela_peq")
    fileira(P, M, (X_TORRE - 1.2, Y_TORRE1), (-X_TORRE + 1.2, Y_TORRE1), "+y", 3, 1.0, 11.4, 13.1, "janela_peq")
    telhado(P, M, -X_TORRE, Y_TORRE0, X_TORRE, Y_TORRE1, Z0 + H_TORRE, 1.5, 0.25)
    # fundo do palco
    P.juntar(bm_prisma(ret(-X_TORRE, Y_TORRE1, X_TORRE, Y_FUNDO), Z0, Z0 + H_FUNDO, 0.04), [M["laje"], W])
    cinta(P, M["soco"], -X_TORRE, Y_TORRE1, X_TORRE, Y_FUNDO, 0.0, 0.6, 0.06)
    cinta(P, B, -X_TORRE, Y_TORRE1, X_TORRE, Y_FUNDO, H_FUNDO - 0.4, H_FUNDO, 0.2, topo=M["laje"])
    vao(P, M, 0, Y_FUNDO, "+y", 2.4, 0.1, 4.0, "porta_grade")
    fileira(P, M, (X_TORRE - 0.5, Y_FUNDO), (-X_TORRE + 0.5, Y_FUNDO), "+y", 4, 0.9, 5.6, 7.4, "janela_peq")
    reservar(ret(-X_SALA - 0.5, Y_FUNDO_FACHADA, X_SALA + 0.5, Y_FUNDO), 0.3)
    return P.criar()


# ———————————————————————————————————————————————— chão, rua e calçadas

def chao(M):
    """Disco de piso, Rua Liberato Barroso em paralelepípedo, pátio, jardim, lote vizinho e caminho de Burle Marx"""
    g = Peca("Chao_Base")
    g.juntar(bm_prisma(circulo(96, RAIO), 0.0, Z0, 0.03, mat_lados=1), [M["piso"], M["meiofio"]])
    g.criar()
    pisos = Peca("Chao_Pisos")

    def placa(poli, m, z=0.012):
        poli = simplificar(recortar_no_disco(poli, RAIO - 0.15), 0.06)
        if len(poli) >= 3:
            pisos.juntar(bm_prisma(poli, Z0 - 0.01, Z0 + z, 0.0, mat_lados=0), m)
        return poli

    placa(ret(-40, Y_RUA, 40, Y_CALCADA), M["rua"], 0.006)
    placa(ret(-X_PATIO, Y_FUNDO_FACHADA, X_PATIO, Y_FERRO), M["patio"], 0.02)
    grama = placa(ret(-40, Y_JARDIM + 0.2, X_JARDIM, 40), M["grama"], 0.03)
    placa(ret(X_SALA + 0.6, Y_FRENTE + 0.1, 40, 40), M["lote"], 0.015)
    placa(ret(X_SALA + 0.9, 4.2, 40, 40), M["grama"], 0.03)
    # caminho sinuoso do jardim (Burle Marx: curvas largas), do portão da frente até os fundos
    eixo = catmull([(-14.6, Y_JARDIM - 0.3), (-15.6, -7.0), (-20.5, -2.0), (-17.5, 5.0), (-22.0, 11.5), (-18.0, 18.0), (-21.5, 24.5)], 7)
    eixo = [p for p in eixo if math.hypot(*p) < RAIO - 1.2]
    for i in range(len(eixo) - 1):
        a, b = Vector(eixo[i]), Vector(eixo[i + 1])
        d = (b - a).normalized()
        nl = Vector((-d.y, d.x)) * 0.75
        d0 = (Vector(eixo[i]) - Vector(eixo[i - 1])).normalized() if i > 0 else d
        n0 = Vector((-d0.y, d0.x)) * 0.75
        pts = [(a.x - n0.x, a.y - n0.y, Z0 + 0.045), (b.x - nl.x, b.y - nl.y, Z0 + 0.045), (b.x + nl.x, b.y + nl.y, Z0 + 0.045), (a.x + n0.x, a.y + n0.y, Z0 + 0.045)]
        pisos.poli(pts, M["caminho"])
    # desenho de círculos entrelaçados no piso da praça (ficha), no eixo da entrada
    for k in range(5):
        cx = -6.0 + 3.0 * k
        for i in range(32):
            a0_, a1_ = 2 * math.pi * i / 32, 2 * math.pi * (i + 1) / 32
            zz = Z0 + 0.016
            pisos.poli([(cx + 1.95 * math.cos(a0_), -24.0 + 1.95 * math.sin(a0_), zz), (cx + 2.2 * math.cos(a0_), -24.0 + 2.2 * math.sin(a0_), zz),
                        (cx + 2.2 * math.cos(a1_), -24.0 + 2.2 * math.sin(a1_), zz), (cx + 1.95 * math.cos(a1_), -24.0 + 1.95 * math.sin(a1_), zz)], M["desenho"])
    # faixa de pedestres no eixo
    for k in range(7):
        x = -1.8 + 0.6 * k
        pisos.juntar(bm_caixa(0.36, 4.4, 0.012), M["meiofio"], T(x, (Y_RUA + Y_CALCADA) / 2, Z0 + 0.006))
    # meios-fios dos dois lados da rua
    for y in (Y_CALCADA, Y_RUA):
        meia = math.sqrt(max(0.0, (RAIO - 0.3) ** 2 - y * y))
        pisos.juntar(bm_caixa(2 * meia, 0.22, 0.15), M["meiofio"], T(0, y, Z0 - 0.01))
    reservar(ret(-40, Y_RUA - 0.3, 40, Y_CALCADA + 0.4), 0.0)
    pisos.criar()
    return grama, eixo


# ———————————————————————————————————————————————— jardim de Burle Marx

def blob(cx, cy, rx, ry, giro, seed, n=16):
    rnd = random.Random(seed)
    f1, f2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
    ca, sa = math.cos(math.radians(giro)), math.sin(math.radians(giro))
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        r = 1 + 0.18 * math.sin(2 * a + f1) + 0.1 * math.sin(3 * a + f2)
        x, y = rx * r * math.cos(a), ry * r * math.sin(a)
        pts.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return pts


def jardim(M, eixo):
    """
    Jardim de Roberto Burle Marx (1975) no lote a leste do teatro: gramado, caminho sinuoso, canteiros orgânicos em
    massas de cor (vermelho, roxo, amarelo, verde-limão, como no estilo do paisagista; o desenho atual não foi confirmado),
    arbustos junto às paredes, bancos e o gradil da frente e da lateral (pilares claros, grade verde-escura).
    """
    P = Peca("Jardim_Burle_Marx")
    cores = ["#ad3f2c", "#5f3a78", "#cfa634", "#93ae42", "#b2557a", "#3f6d33"]
    canteiros = [(-14.2, -2.5, 1.6, 3.0, 20), (-23.5, -8.5, 2.6, 1.4, -15), (-25.5, 3.0, 2.4, 1.5, 35), (-14.4, 9.5, 1.4, 3.2, -10),
                 (-25.0, 16.0, 2.2, 1.3, 10), (-14.6, 21.5, 1.5, 2.6, 15), (-20.0, -10.0, 1.4, 0.9, 0), (-27.5, -1.5, 1.2, 1.0, 0),
                 (-19.5, 29.0, 1.6, 0.9, 30), (-24.5, 21.5, 1.0, 1.4, 60)]
    for i, (cx, cy, rx, ry, g) in enumerate(canteiros):
        pts = [p for p in blob(cx, cy, rx, ry, g, 31 + i) if math.hypot(*p) < RAIO - 0.6]
        if len(pts) < 5:
            continue
        if any(dist_poligono(q, pts) < 0.9 for q in eixo[::2]):
            pts = blob(cx, cy, rx * 0.75, ry * 0.75, g, 31 + i)
        cor = cores[i % len(cores)]
        P.juntar(bm_prisma(pts, Z0, Z0 + 0.22 + 0.06 * (i % 3), 0.0, mat_lados=0), tinta(M["canteiros"], cor))
        reservar(pts, 0.2)
    # arbustos em massa junto à parede da sala e da galeria (bordadura)
    rnd = random.Random(1975)
    for k in range(16):
        y = Y_ALAS + 0.8 + k * 2.4
        if y > Y_TORRE1 + 1.0:
            break
        x = X_JARDIM - 0.4 - rnd.uniform(0, 0.4)
        bm = bm_esfera(1.0, 1)
        r = rnd.uniform(0.55, 0.85)
        bm.transform(Matrix.Diagonal((r, r * 1.3, r * 0.75, 1)))
        P.juntar(bm, M["arbusto"], T(x, y, Z0 + r * 0.45))
    # bancos ao longo do caminho
    for (x, y, g) in ((-17.6, -4.5, 60), (-19.8, 7.5, 120), (-20.2, 14.6, 60)):
        P.juntar(bm_caixa(1.6, 0.5, 0.08), M["madeira"], T(x, y, Z0 + 0.42, g))
        for s in (-0.65, 0.65):
            P.juntar(bm_caixa(0.1, 0.42, 0.42), M["poste"], T(x + s * math.cos(math.radians(g)), y + s * math.sin(math.radians(g)), Z0, g))
    # gradil: mureta, pilares e grade (frente do jardim e lateral até a ala)
    gradil(P, M, (X_JARDIM, Y_ALAS + 0.3), (X_JARDIM, Y_JARDIM))
    xfim = -math.sqrt((RAIO - 0.5) ** 2 - Y_JARDIM ** 2)
    gradil(P, M, (-13.4, Y_JARDIM), (xfim, Y_JARDIM))
    for x in (X_JARDIM, -13.4):
        P.juntar(bm_caixa(0.5, 0.5, 2.0, 0.04), M["branco"], T(x, Y_JARDIM, Z0))
        pinha(P, M, x, Y_JARDIM, Z0 + 2.0, 0.6)
    return P.criar()


def gradil(P, M, p0, p1, passo_pilar=2.8, alt=1.55):
    """Gradil de ferro sobre mureta, com pilares claros (os do Theatro: cor e desenho a confirmar)"""
    a, b = Vector((*p0, 0)), Vector((*p1, 0))
    L = (b - a).length
    t = (b - a).normalized()
    ang = math.degrees(math.atan2(t.y, t.x))
    c = (a + b) / 2
    P.juntar(bm_caixa(L, 0.3, 0.45), M["soco"], T(c.x, c.y, Z0, ang))
    P.juntar(bm_caixa(L, 0.08, 0.06), M["ferro"], T(c.x, c.y, Z0 + alt - 0.06, ang))
    P.juntar(bm_caixa(L, 0.06, 0.05), M["ferro"], T(c.x, c.y, Z0 + 0.55, ang))
    nb = int(L / 0.17)
    for k in range(nb + 1):
        p = a + t * (L * k / nb)
        BARRAS.append((p.x, p.y, Z0 + 0.45, alt - 0.45))
    npil = max(1, round(L / passo_pilar))
    for k in range(npil + 1):
        p = a + t * (L * k / npil)
        P.juntar(bm_caixa(0.38, 0.38, alt + 0.2, 0.03), M["branco"], T(p.x, p.y, Z0, ang))


# ———————————————————————————————————————————————— praça José de Alencar e calçada

def praca(M):
    """
    Praça José de Alencar do outro lado da rua: monumento a José de Alencar (bronze sentado com livro sobre base de
    granito branco, 1929; a posição na praça não foi confirmada), canteiros redondos das árvores, bancos, postes, e os
    balizadores pretos e brancos na calçada do teatro. Gradil do lote vizinho (oeste real) alinhado com a fachada.
    """
    P = Peca("Praca_Jose_de_Alencar")
    # monumento
    mx, my = -10.5, -26.0
    G, Bz = M["granito"], M["bronze"]
    P.juntar(bm_caixa(4.0, 4.0, 0.3, 0.04), G, T(mx, my, Z0))
    P.juntar(bm_caixa(3.2, 3.2, 0.3, 0.04), G, T(mx, my, Z0 + 0.3))
    P.juntar(bm_caixa(2.0, 2.0, 2.3, 0.05), G, T(mx, my, Z0 + 0.6))
    P.juntar(bm_caixa(2.4, 2.4, 0.25, 0.04), G, T(mx, my, Z0 + 2.9))
    zs = Z0 + 3.15
    # figura sentada (de frente para a praça; a orientação real não foi confirmada): cadeira, corpo, pernas, cabeça, livro
    giro = 0.0
    P.juntar(bm_caixa(1.1, 1.0, 0.75), Bz, T(mx, my + 0.05, zs, giro))
    P.juntar(bm_caixa(1.1, 0.22, 1.5), Bz, T(mx, my + 0.5, zs, giro))
    P.juntar(bm_cilindro(0.33, 0.85, 10, r2=0.27), Bz, T(mx, my + 0.15, zs + 0.75), liso=True)
    P.juntar(bm_esfera(0.22, 2), Bz, T(mx, my + 0.1, zs + 1.82), liso=True)
    for s in (-0.22, 0.22):
        P.juntar(bm_caixa(0.24, 0.85, 0.24), Bz, T(mx + s, my - 0.35, zs + 0.55))
        P.juntar(bm_caixa(0.22, 0.24, 0.7), Bz, T(mx + s, my - 0.75, zs - 0.1))
    P.juntar(bm_caixa(0.42, 0.3, 0.08), Bz, T(mx + 0.15, my - 0.35, zs + 1.0, 15))
    reservar(ret(mx - 2.4, my - 2.4, mx + 2.4, my + 2.4), 0.4)
    # canteiros redondos das árvores da praça (as copas vêm do .tsx)
    covas = [(-22.5, -21.0), (-16.0, -21.2), (-15.6, -25.6), (14.5, -21.2), (21.5, -21.0), (16.0, -26.2), (11.0, -30.0), (-19.6, -24.4)]
    for x, y in covas:
        if math.hypot(x, y) > RAIO - 1.4:
            continue
        P.juntar(bm_torno([(1.0, 0.2), (1.0, 0.32), (1.2, 0.32), (1.2, 0.0)], 12), M["meiofio"], T(x, y, Z0))
        P.juntar(bm_cilindro(1.0, 0.22, 12), M["arbusto"], T(x, y, Z0))
    # bancos e postes da praça
    for x, y, g in ((-4.5, -20.4, 0), (4.5, -20.4, 0), (-4.5, -28.2, 0), (4.5, -28.2, 0), (9.6, -25.0, 90)):
        P.juntar(bm_caixa(2.0, 0.55, 0.45, 0.04), M["granito"], T(x, y, Z0, g))
    postes = [(-7.5, -20.0), (7.5, -20.0), (-12.0, -12.6), (12.0, -12.6), (0.0, -30.0), (-14.0, -31.0), (19.0, -25.0)]
    for x, y in postes:
        if math.hypot(x, y) > RAIO - 0.6:
            continue
        P.juntar(bm_cilindro(0.22, 0.5, 8, r2=0.14), M["poste"], T(x, y, Z0))
        P.juntar(bm_cilindro(0.08, 3.6, 8, r2=0.06), M["poste"], T(x, y, Z0 + 0.5))
        P.juntar(bm_esfera(0.3, 2), M["globo"], T(x, y, Z0 + 4.3), liso=True)
        P.juntar(bm_cilindro(0.16, 0.12, 8), M["poste"], T(x, y, Z0 + 4.0))
    # balizadores pretos e brancos na calçada do teatro (ficha)
    for k in range(17):
        x = -12.0 + 1.5 * k
        if abs(x) < 2.2:
            continue
        P.juntar(bm_cilindro(0.1, 0.85, 8), M["balizador"], T(x, Y_CALCADA + 0.35, Z0))
        P.juntar(bm_cilindro(0.105, 0.14, 8), M["branco"], T(x, Y_CALCADA + 0.35, Z0 + 0.52))
    # gradil do lote vizinho (OSM: cerca alinhada com a fachada, do lado oeste real)
    xfim = math.sqrt((RAIO - 0.6) ** 2 - Y_FRENTE ** 2)
    gradil(P, M, (X_SALA + 0.6, Y_FRENTE + 0.1), (xfim, Y_FRENTE + 0.1))
    reservar(ret(-40, Y_RUA - 0.3, 40, Y_CALCADA + 0.6), 0.0)
    return P.criar(), covas, postes


def vizinha(M):
    """
    Casa vizinha a oeste do teatro (no OSM, o prédio do IPHAN, h 10,8 m, a ~13 m da lateral): só o volume, de 2 pavimentos,
    com telhado de barro, para situar. Cor e fachada neutras (sem foto: dúvida na ficha).
    """
    P = Peca("Casa_Vizinha_IPHAN")
    x0, y0, x1, y1, h = 17.6, -6.4, 25.0, 3.4, 6.6
    P.juntar(bm_prisma(ret(x0, y0, x1, y1), Z0, Z0 + h, 0.04), [M["laje"], M["vizinha"]])
    cinta(P, M["soco"], x0, y0, x1, y1, 0.0, 0.5, 0.05)
    cinta(P, M["branco"], x0, y0, x1, y1, 3.25, 3.5, 0.08)
    cinta(P, M["branco"], x0, y0, x1, y1, h - 0.35, h, 0.2)
    rc = (0.1, 0.9)
    for k, x in enumerate((x0 + 1.4, x0 + 3.3, x1 - 3.3, x1 - 1.4)):
        vao(P, M, x, y0, "-y", 0.95, 0.9, 2.7, "janela_peq", recorte=rc)
        vao(P, M, x, y0, "-y", 0.95, 4.1, 5.8, "janela_peq", recorte=rc)
    for k in range(5):
        y = y0 + 1.2 + (y1 - y0 - 2.4) * k / 4
        vao(P, M, x0, y, "-x", 0.95, 0.9, 2.7, "janela_peq", recorte=rc)
        vao(P, M, x0, y, "-x", 0.95, 4.1, 5.8, "janela_peq", recorte=rc)
    telhado(P, M, x0, y0, x1, y1, Z0 + h, 1.7, 0.35, cumeeira=False, m=M["barro"])
    reservar(ret(x0, y0, x1, y1), 0.6)
    return P.criar()


# ———————————————————————————————————————————————— vegetação, gente e carros (layout para o .tsx)

def layout(covas, eixo):
    """Posições determinísticas (referencial do prédio; viram coordenadas do three no fim)"""
    rnd = random.Random(1910)   # ano da inauguração

    def livre(x, y, r):
        if math.hypot(x, y) > RAIO - 0.5 - r * 0.8:
            return False
        for poli, folga in LIVRE_POLIS:
            if dist_poligono((x, y), poli) < folga + r * 0.5:
                return False
        return True

    arvores = []   # (x, y, altura do tronco, raio da copa)
    for x, y in covas:
        if math.hypot(x, y) <= RAIO - 1.4:
            arvores.append((x, y, rnd.uniform(1.6, 2.2), rnd.uniform(1.9, 2.4)))
    # oitis e pau-brasil do jardim (OSM), mais copas no fundo do jardim, no lote vizinho e atrás do palco
    zonas = [((-27.5, 9.0), 3.0, 3), ((-25.0, 24.0), 3.0, 3), ((-28.0, -6.0), 2.0, 2), ((-15.5, 27.0), 2.5, 2),
             ((26.0, -4.0), 2.5, 2), ((19.0, 9.5), 4.0, 3), ((24.0, 15.0), 3.0, 2), ((15.5, 25.0), 3.0, 2), ((14.0, 6.5), 1.0, 1), ((4.5, 32.0), 1.0, 1), ((-8.0, 31.5), 1.0, 1),
             ((27.0, -15.5), 1.5, 1), ((-28.0, -15.8), 1.0, 1)]
    for (cx, cy), raio, n in zonas:
        k = tent = 0
        while k < n and tent < 400:
            tent += 1
            a, d = rnd.uniform(0, 2 * math.pi), raio * math.sqrt(rnd.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
            r = rnd.uniform(1.5, 2.2)
            if not livre(x, y, r) or any(math.hypot(x - q[0], y - q[1]) < 0.85 * (r + q[3]) for q in arvores):
                continue
            if any(math.hypot(x - p[0], y - p[1]) < r * 0.6 for p in eixo):
                continue
            arvores.append((x, y, rnd.uniform(1.5, 2.3), r))
            k += 1
    palmeiras = []   # (x, y, altura, giro)
    for x, y in ((-13.6, -9.0), (-13.4, 2.0), (-13.4, 14.5), (-24.5, -3.5), (-22.0, 7.0), (-26.0, 13.0), (-16.5, 24.0), (-20.0, -12.0)):
        if livre(x, y, 0.3):
            palmeiras.append((x, y, rnd.uniform(6.5, 8.2), rnd.uniform(0, 360)))
    pessoas = []
    zonas_p = [((0.0, -12.0), (6.5, 1.0), 9), ((0.0, -24.5), (9.0, 4.0), 10), ((0.0, 1.5), (6.0, 3.5), 7), ((-18.5, 3.0), (2.5, 9.0), 4), ((15.0, -11.8), (3.0, 0.6), 2)]
    for (cx, cy), (ax, ay), n in zonas_p:
        k = tent = 0
        while k < n and tent < 600:
            tent += 1
            x, y = cx + rnd.uniform(-ax, ax), cy + rnd.uniform(-ay, ay)
            if math.hypot(x, y) > RAIO - 1:
                continue
            if any(dist_poligono((x, y), poli) < 0.25 for poli, _ in LIVRE_POLIS if not (poli[0][1] <= Y_RUA and poli[2][1] >= Y_CALCADA)):
                if not (cx == -18.5 and min(math.hypot(x - p[0], y - p[1]) for p in eixo) < 0.6):
                    continue
            if any(math.hypot(x - p[0], y - p[1]) < 0.6 for p in pessoas):
                continue
            pessoas.append((x, y, rnd.uniform(0, 360), rnd.randrange(6)))
            k += 1
    carros = []   # (x, y, giro, cor) — estacionados do lado da praça e um passando
    for x, k in ((-25.0, 0), (-20.4, 3), (-15.8, 5), (14.5, 1), (19.1, 6), (23.7, 2)):
        carros.append((x, Y_RUA + 1.15, 0.0, k))
    carros.append((-7.0, Y_CALCADA - 1.6, 180.0, 4))
    return arvores, palmeiras, pessoas, carros


def proxies(arvores, palmeiras, carros):
    """Volumes provisórios da vegetação e dos carros: só fazem sombra na oclusão assada e depois são apagados"""
    P = Peca("Proxy_Vegetacao")
    m = mat("Mat_Proxy", "#808080")
    for x, y, h, r in arvores:
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((r, r, r * 0.8, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h + r * 0.8))
        P.juntar(bm_cilindro(0.2, h + 0.3, 6), m, T(x, y, Z0))
    for x, y, h, g in palmeiras:
        P.juntar(bm_cilindro(0.14, h, 6), m, T(x, y, Z0))
        bm = bm_esfera(1.0, 1)
        bm.transform(Matrix.Diagonal((2.0, 2.0, 0.6, 1)))
        P.juntar(bm, m, T(x, y, Z0 + h))
    for x, y, g, k in carros:
        P.juntar(bm_caixa(3.6, 1.6, 1.3), m, T(x, y, Z0, g))
    return P.criar()


# ———————————————————————————————————————————————— oclusão assada e tintas

def assar(objs_vertice, objs_chao, proxy):
    """Oclusão de ambiente no Cycles (CPU): nas cores de vértice das peças (faixa 0,5–1) e numa imagem 256 do chão"""
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
    grama, eixo = chao(M)
    obs = [fachada(M), galerias(M), fachada_ferro(M), sala(M), jardim(M, eixo), vizinha(M)]
    pr, covas, postes = praca(M)
    obs.append(pr)
    arvores, palmeiras, pessoas, carros = layout(covas, eixo)
    print(f"árvores {len(arvores)}, palmeiras {len(palmeiras)}, pessoas {len(pessoas)}, carros {len(carros)}")
    # proxies no mundo: a Peca já gira; as posições do layout ficam no referencial do prédio até aqui
    prox = proxies(arvores, palmeiras, carros)
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
        "arvores": [[tres(x, y)[0], round(Z0 + h, 3), tres(x, y)[1], round(r, 3)] for x, y, h, r in arvores],
        "palmeiras": [[*tres(x, y), round(h, 3), round(math.radians(g), 3)] for x, y, h, g in palmeiras],
        "pessoas": [[tres(x, y)[0], Z0 + (0.02 if Y_FUNDO_FACHADA < y < Y_FERRO and abs(x) < X_PATIO else 0.0), tres(x, y)[1], round(math.radians(g), 3), k] for x, y, g, k in pessoas],
        "carros": [[*tres(x, y), round(math.radians(g + GIRO), 3), k] for x, y, g, k in carros],
        "barras": [[*tres(x, y), round(z, 3), round(h, 3)] for x, y, z, h in BARRAS],
        "chao": {"lado": LADO_AO, "z0": Z0},
    }
    with open(os.path.join(SAIDA, f"{PREFIXO}-layout.json"), "w", encoding="utf-8") as fh:
        json.dump(dados, fh, ensure_ascii=False, separators=(",", ":"))
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"exportado {arq}: {os.path.getsize(arq) // 1024} KB, ~{tri} triângulos, {len(bpy.data.materials)} materiais")


principal()
