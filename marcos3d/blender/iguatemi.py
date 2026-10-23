"""
Shopping Iguatemi Bosque (Fortaleza): peças da miniatura geradas no Blender. Este script é a fonte; não há .blend.

Rodar (de qualquer pasta):
    <python com o módulo bpy> marcos3d/blender/iguatemi.py
Saída (sem compressão, só o exportador glTF do Blender):
    marcos3d/blender/saida/iguatemi-shopping.glb   arquitetura, chão e detalhes, com oclusão de ambiente em vertex color (COLOR_0)
    marcos3d/blender/saida/iguatemi-dados.json     posições de árvores, palmeiras, carros e postes (o Iguatemi.tsx instancia)

Convenções da oficina: metros, y para cima, norte em −z, base em y = 0, tudo dentro do raio de 33,5 m.
A planta vem do OSM (iguatemi_planta.py). O que não está no OSM (a gota do Garden Court, a proa de vidro, a lente,
a pirâmide, a cúpula e o bloco norte) foi traçado da vista aérea Esri, só olhando; veja pesquisa/iguatemi/ficha.md.
"""
import bpy
import bmesh
import json
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from iguatemi_planta import CONTORNO, ENTRADAS, ESTACIONAMENTOS, JARDIM, PARTES, VIAS, VIZINHOS  # noqa: E402

SAIDA = os.path.join(AQUI, "saida")
ARQ_GLB = os.path.join(SAIDA, "iguatemi-shopping.glb")
ARQ_JSON = os.path.join(SAIDA, "iguatemi-dados.json")

# ——— Escala da miniatura ———
# K = 0,135 até 170 m do ponto real (0, 35); dali para fora o excesso de raio entra a 55 %, para o miolo icônico
# ficar grande e o cinema, o bloco norte e as pontas da espinha caberem até ~30 m.
CENTRO = (0.0, 35.0)
K, R0, BETA = 0.135, 170.0, 0.55
RAIO_UTIL = 33.3


def mini(p):
    """Ponto real (x leste, z sul, metros) -> miniatura (x, z)"""
    dx, dz = p[0] - CENTRO[0], p[1] - CENTRO[1]
    r = math.hypot(dx, dz)
    f = K if r <= R0 else K * (R0 + (r - R0) * BETA) / r
    return (dx * f, dz * f)


def H(h):
    """Altura real -> miniatura: 0,297 por metro até 16 m e 0,2 por metro acima (os blocos altos da borda não
    roubam a cena do Garden Court)"""
    return 0.297 * h if h <= 16 else 0.297 * 16 + 0.2 * (h - 16)


# ——— Geometria 2D (planta em [x, z]) ———

def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def lerp2(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def area(p):
    """Área com sinal em (x, −z): positiva = anti-horário visto de cima"""
    s = 0.0
    for i in range(len(p)):
        x1, z1 = p[i]
        x2, z2 = p[(i + 1) % len(p)]
        s += x1 * (-z2) - x2 * (-z1)
    return s / 2


def ccw(p):
    return list(p) if area(p) > 0 else list(p)[::-1]


def limpar(p, tol=0.025, fechado=True):
    """Tira pontos repetidos e quase colineares"""
    out = []
    for q in p:
        if not out or dist(out[-1], q) > tol:
            out.append(q)
    if fechado and len(out) > 2 and dist(out[0], out[-1]) <= tol:
        out.pop()
    mudou = True
    while mudou and len(out) > 3:
        mudou = False
        n = len(out)
        for i in range(n if fechado else n - 2):
            a, b, c = out[i - 1] if fechado else out[i], out[i] if fechado else out[i + 1], out[(i + 1) % n] if fechado else out[i + 2]
            ab, bc = (b[0] - a[0], b[1] - a[1]), (c[0] - b[0], c[1] - b[1])
            cr = ab[0] * bc[1] - ab[1] * bc[0]
            if abs(cr) < 1e-4 * max(1e-9, math.hypot(*ab) * math.hypot(*bc)) * 50 and ab[0] * bc[0] + ab[1] * bc[1] > 0:
                out.pop(i if fechado else i + 1)
                mudou = True
                break
    return out


def _segmento(a, b, tol, prof=0):
    ma, mb = mini(a), mini(b)
    m = lerp2(a, b, 0.5)
    mm = mini(m)
    if prof < 6 and math.hypot(mm[0] - (ma[0] + mb[0]) / 2, mm[1] - (ma[1] + mb[1]) / 2) > tol:
        return _segmento(a, m, tol, prof + 1) + _segmento(m, b, tol, prof + 1)
    return [ma]


def planta(poly, tol=0.03):
    """Polígono real -> miniatura, subdividindo as arestas que a compressão da borda curvaria"""
    out = []
    n = len(poly)
    for i in range(n):
        out.extend(_segmento(poly[i], poly[(i + 1) % n], tol))
    return ccw(limpar(out))


def linha(pts, tol=0.03):
    out = []
    for i in range(len(pts) - 1):
        out.extend(_segmento(pts[i], pts[i + 1], tol))
    out.append(mini(pts[-1]))
    return limpar(out, fechado=False)


def chaikin(p, n=2, fechado=True):
    for _ in range(n):
        q = []
        m = len(p)
        for i in range(m if fechado else m - 1):
            a, b = p[i], p[(i + 1) % m]
            q += [lerp2(a, b, 0.25), lerp2(a, b, 0.75)]
        p = q if fechado else [p[0]] + q + [p[-1]]
    return p


def deslocar(p, d):
    """Desloca um polígono anti-horário: d > 0 para fora, d < 0 para dentro (meia-esquadria limitada)"""
    n = len(p)
    out = []
    for i in range(n):
        a, b, c = p[i - 1], p[i], p[(i + 1) % n]
        e1 = (b[0] - a[0], b[1] - a[1])
        e2 = (c[0] - b[0], c[1] - b[1])
        l1, l2 = math.hypot(*e1) or 1e-9, math.hypot(*e2) or 1e-9
        n1 = (-e1[1] / l1, e1[0] / l1)
        n2 = (-e2[1] / l2, e2[0] / l2)
        sx, sz = n1[0] + n2[0], n1[1] + n2[1]
        dot = n1[0] * n2[0] + n1[1] * n2[1]
        k = d / max(0.35, 1 + dot)
        out.append((b[0] + sx * k, b[1] + sz * k))
    return out


def chanfrar_cantos(p, c=0.08, angulo=25):
    """Corta as quinas (giro maior que `angulo`) com um chanfro de c metros: é o que pega a luz nas arestas"""
    n = len(p)
    out = []
    for i in range(n):
        a, b, cc = p[i - 1], p[i], p[(i + 1) % n]
        e1 = (b[0] - a[0], b[1] - a[1])
        e2 = (cc[0] - b[0], cc[1] - b[1])
        l1, l2 = math.hypot(*e1), math.hypot(*e2)
        if l1 < 1e-6 or l2 < 1e-6:
            continue
        cosang = (e1[0] * e2[0] + e1[1] * e2[1]) / (l1 * l2)
        giro = math.degrees(math.acos(max(-1, min(1, cosang))))
        if giro > angulo and l1 > 3 * c and l2 > 3 * c:
            out.append((b[0] - e1[0] / l1 * c, b[1] - e1[1] / l1 * c))
            out.append((b[0] + e2[0] / l2 * c, b[1] + e2[1] / l2 * c))
        else:
            out.append(b)
    return out


def dentro(pt, p):
    x, z = pt
    d = False
    n = len(p)
    for i in range(n):
        x1, z1 = p[i]
        x2, z2 = p[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            d = not d
    return d


def dist_poligono(pt, p):
    best = 1e9
    n = len(p)
    for i in range(n):
        a, b = p[i], p[(i + 1) % n]
        ex, ez = b[0] - a[0], b[1] - a[1]
        L2 = ex * ex + ez * ez or 1e-12
        t = max(0, min(1, ((pt[0] - a[0]) * ex + (pt[1] - a[1]) * ez) / L2))
        best = min(best, math.hypot(pt[0] - a[0] - ex * t, pt[1] - a[1] - ez * t))
    return best


def recortar_semiplano(p, a, nrm):
    """Mantém a parte do polígono com (pt − a)·nrm >= 0"""
    out = []
    n = len(p)
    for i in range(n):
        P, Q = p[i], p[(i + 1) % n]
        dp = (P[0] - a[0]) * nrm[0] + (P[1] - a[1]) * nrm[1]
        dq = (Q[0] - a[0]) * nrm[0] + (Q[1] - a[1]) * nrm[1]
        if dp >= 0:
            out.append(P)
        if (dp >= 0) != (dq >= 0):
            out.append(lerp2(P, Q, dp / (dp - dq)))
    return out


DISCO = [(RAIO_UTIL * math.cos(2 * math.pi * i / 128), RAIO_UTIL * math.sin(2 * math.pi * i / 128)) for i in range(128)]


def no_disco(p, raio=RAIO_UTIL):
    """Recorta o polígono pelo disco útil (Sutherland–Hodgman contra um 128-gono convexo)"""
    out = ccw(p)
    disco = ccw([(x * raio / RAIO_UTIL, z * raio / RAIO_UTIL) for x, z in DISCO])
    for i in range(len(disco)):
        a, b = disco[i], disco[(i + 1) % len(disco)]
        e = (b[0] - a[0], b[1] - a[1])
        nrm = (e[1], -e[0])  # interior do anti-horário em (x, −z)
        nrm = (-nrm[0], -nrm[1]) if (0 - a[0]) * nrm[0] + (0 - a[1]) * nrm[1] < 0 else nrm
        out = recortar_semiplano(out, a, nrm)
        if len(out) < 3:
            return []
    return limpar(out)


def aparar_linha(pts, raio=RAIO_UTIL):
    """Corta uma polilinha na borda do disco (fica só o trecho de dentro mais longo)"""
    trechos, atual = [], []
    for i, q in enumerate(pts):
        if math.hypot(*q) <= raio:
            if not atual and i > 0:
                atual.append(_corte(pts[i - 1], q, raio))
            atual.append(q)
        elif atual:
            atual.append(_corte(atual[-1], q, raio))
            trechos.append(atual)
            atual = []
    if atual:
        trechos.append(atual)
    return trechos


def _corte(a, b, raio):
    lo, hi = 0.0, 1.0
    fora_b = math.hypot(*b) > raio
    for _ in range(30):
        m = (lo + hi) / 2
        q = lerp2(a, b, m)
        if (math.hypot(*q) > raio) == fora_b:
            hi = m
        else:
            lo = m
    return lerp2(a, b, lo)


def amostrar_linha(pts, passo):
    """Pontos a cada `passo` metros ao longo da polilinha, com a direção local"""
    out = []
    resto = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        L = dist(a, b)
        if L < 1e-9:
            continue
        d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        s = resto
        while s <= L:
            out.append((lerp2(a, b, s / L), d))
            s += passo
        resto = s - L
    return out


def comprimento(pts):
    return sum(dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def aleatorio(semente):
    """Mulberry32, o mesmo gerador do src/util/geometria.ts: a miniatura sai igual em toda execução"""
    s = [semente & 0xFFFFFFFF]

    def r():
        s[0] = (s[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = s[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return r


# ——— Materiais (nomes em português; cores tiradas da vista aérea e das descrições) ———

MATERIAIS = {
    "Mat_Chao_Calcada": ("#d6d0c3", 0.95, 0.0),
    "Mat_Chao_Mata": ("#55703f", 1.0, 0.0),
    "Mat_Grama_Jardim": ("#7da653", 0.95, 0.0),
    "Mat_Caminho_Jardim": ("#d9bf9f", 0.9, 0.0),
    "Mat_Asfalto": ("#4b4e53", 0.9, 0.0),
    "Mat_Asfalto_Estacionamento": ("#606368", 0.92, 0.0),
    "Mat_Faixa_Branca": ("#f1f1ec", 0.6, 0.0),
    "Mat_Canteiro": ("#c9c3b5", 0.9, 0.0),
    "Mat_Fachada_Galerias": ("#f5ecdc", 0.85, 0.0),
    "Mat_Platibanda_Branca": ("#f7f5ef", 0.7, 0.0),
    "Mat_Telhado_Branco": ("#efede7", 0.75, 0.0),
    "Mat_Telhado_Bege": ("#ddd5c6", 0.85, 0.0),
    "Mat_Laje_Tecnica": ("#bab3a5", 0.95, 0.0),
    "Mat_Telhado_Metalico_Cinza": ("#9da3a8", 0.55, 0.25),
    "Mat_Vidro_Verde_Fachada": ("#4f8e7d", 0.12, 0.1),
    "Mat_Vidro_Escuro": ("#2d4257", 0.1, 0.2),
    "Mat_Estrutura_Branca": ("#f6f7f4", 0.45, 0.1),
    "Mat_Policarbonato_Madeira": ("#efe4cc", 0.5, 0.0),
    "Mat_Cobertura_Anel": ("#eeeeea", 0.5, 0.15),
    "Mat_Madeira_MLC": ("#c08a52", 0.65, 0.0),
    "Mat_Aco_Tubular": ("#c3c9cf", 0.35, 0.5),
    "Mat_Garagem_Concreto": ("#d0ccc3", 0.9, 0.0),
    "Mat_Garagem_Interior": ("#3a3d43", 0.95, 0.0),
    "Mat_Maquinas_Telhado": ("#bfc3c6", 0.6, 0.2),
    "Mat_Vizinhos_Paredes": ("#e4ddd0", 0.9, 0.0),
    "Mat_Vizinhos_Telhado_Ceramico": ("#b9673f", 0.85, 0.0),
    "Mat_Vizinhos_Laje": ("#d4cec2", 0.9, 0.0),
}


def hex_linear(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def criar_material(nome):
    cor, rug, met = MATERIAIS[nome]
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = hex_linear(cor)
    bsdf.inputs["Roughness"].default_value = rug
    bsdf.inputs["Metallic"].default_value = met
    # face única (como os outros marcos), menos nas peças finas que aparecem dos dois lados
    m.use_backface_culling = nome not in ("Mat_Estrutura_Branca", "Mat_Aco_Tubular", "Mat_Madeira_MLC")
    return m


# ——— Malhas: um objeto por nome, um material por objeto ———

class Malha:
    def __init__(self, nome, mat, grade=None, suave=False):
        self.nome, self.mat, self.grade, self.suave = nome, mat, grade, suave
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")

    def v(self, x, y, z):
        # three (x, y, z) -> Blender (x, −z, y); o exportador glTF desfaz isso (+Y para cima)
        return self.bm.verts.new((x, -z, y))

    def f(self, vs, uvs=None):
        if len(set(vs)) < 3:
            return None
        try:
            face = self.bm.faces.new(vs)
        except ValueError:
            return None
        if uvs:
            for lp, uv in zip(face.loops, uvs):
                lp[self.uv].uv = uv
        return face

    def placa(self, p, y, giro=0.0):
        """Face horizontal (anti-horário = normal para cima), UV em metros girado de `giro` rad"""
        p = ccw(p)
        if len(p) < 3:
            return
        c, s = math.cos(giro), math.sin(giro)
        self.f([self.v(x, y, z) for x, z in p], [(x * c - z * s, -(x * s + z * c)) for x, z in p])

    def paredes(self, p, y0, y1, para_dentro=False, u0=0.0):
        """Paredes verticais ao longo do contorno (normal para fora; para dentro se pedido); u = metros corridos"""
        p = ccw(p)
        n = len(p)
        b = [self.v(x, y0, z) for x, z in p]
        t = [self.v(x, y1, z) for x, z in p]
        s = u0
        for i in range(n):
            j = (i + 1) % n
            L = dist(p[i], p[j])
            if para_dentro:
                self.f([b[j], b[i], t[i], t[j]], [(s + L, y0), (s, y0), (s, y1), (s + L, y1)])
            else:
                self.f([b[i], b[j], t[j], t[i]], [(s, y0), (s + L, y0), (s + L, y1), (s, y1)])
            s += L

    def prisma(self, p, y0, y1, topo=True, giro=0.0):
        self.paredes(p, y0, y1)
        if topo:
            self.placa(p, y1, giro)

    def anel(self, ext, inn, y_ext, y_inn):
        """Faixa entre dois contornos com o mesmo número de pontos (os dois anti-horários)"""
        n = len(ext)
        a = [self.v(x, y_ext, z) for x, z in ext]
        b = [self.v(x, y_inn, z) for x, z in inn]
        for i in range(n):
            j = (i + 1) % n
            self.f([a[i], a[j], b[j], b[i]], [ext[i], ext[j], inn[j], inn[i]])

    def quad(self, pts3, uvs=None):
        return self.f([self.v(*q) for q in pts3], uvs)

    def quad_para(self, pts3, desejada, uvs=None):
        """Face com a normal virada para `desejada` (vetor 3D em coordenadas three)"""
        n = normal3(pts3)
        if n[0] * desejada[0] + n[1] * desejada[1] + n[2] * desejada[2] < 0:
            pts3 = pts3[::-1]
            uvs = uvs[::-1] if uvs else None
        return self.quad(pts3, uvs)

    def caixa(self, cx, cz, larg, prof, y0, y1, giro=0.0, topo=True):
        c, s = math.cos(giro), math.sin(giro)
        p = [(cx + dx * c - dz * s, cz + dx * s + dz * c) for dx, dz in ((-larg / 2, -prof / 2), (larg / 2, -prof / 2), (larg / 2, prof / 2), (-larg / 2, prof / 2))]
        self.prisma(p, y0, y1, topo, giro)
        return p

    def fita(self, pts, larg, y, giro_uv=True):
        """Faixa horizontal de largura constante ao longo de uma polilinha (ruas, faixas pintadas)"""
        if len(pts) < 2:
            return
        esq, dir_ = [], []
        n = len(pts)
        for i in range(n):
            if i == 0:
                d = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
            elif i == n - 1:
                d = (pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1])
            else:
                d1 = (pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
                d2 = (pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
                l1, l2 = math.hypot(*d1) or 1e-9, math.hypot(*d2) or 1e-9
                d = (d1[0] / l1 + d2[0] / l2, d1[1] / l1 + d2[1] / l2)
            L = math.hypot(*d) or 1e-9
            nrm = (-d[1] / L, d[0] / L)
            esq.append((pts[i][0] + nrm[0] * larg / 2, pts[i][1] + nrm[1] * larg / 2))
            dir_.append((pts[i][0] - nrm[0] * larg / 2, pts[i][1] - nrm[1] * larg / 2))
        s = 0.0
        for i in range(n - 1):
            L = dist(pts[i], pts[i + 1])
            quad = [dir_[i], dir_[i + 1], esq[i + 1], esq[i]]
            uvs = [(s, 0), (s + L, 0), (s + L, larg), (s, larg)]
            if area(quad) < 0:
                quad, uvs = quad[::-1], uvs[::-1]
            self.f([self.v(x, y, z) for x, z in quad], uvs)
            s += L

    def tubo(self, a, b, r, lados=6):
        """Cilindro entre dois pontos 3D (perfis tubulares, postes)"""
        ax, ay, az = a
        bx, by, bz = b
        d = (bx - ax, by - ay, bz - az)
        L = math.sqrt(sum(x * x for x in d)) or 1e-9
        d = (d[0] / L, d[1] / L, d[2] / L)
        up = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
        u = (up[1] * d[2] - up[2] * d[1], up[2] * d[0] - up[0] * d[2], up[0] * d[1] - up[1] * d[0])
        lu = math.sqrt(sum(x * x for x in u))
        u = tuple(x / lu for x in u)
        w = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])
        anel_a, anel_b = [], []
        for k in range(lados):
            t = 2 * math.pi * k / lados
            o = tuple(r * (math.cos(t) * u[i] + math.sin(t) * w[i]) for i in range(3))
            anel_a.append(self.v(ax + o[0], ay + o[1], az + o[2]))
            anel_b.append(self.v(bx + o[0], by + o[1], bz + o[2]))
        for k in range(lados):
            j = (k + 1) % lados
            self.f([anel_a[k], anel_a[j], anel_b[j], anel_b[k]], [(k / lados, 0), ((k + 1) / lados, 0), ((k + 1) / lados, L), (k / lados, L)])


def normal3(p):
    """Normal de Newell de um polígono 3D (coordenadas three)"""
    nx = ny = nz = 0.0
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return (nx, ny, nz)


MALHAS = {}


def malha(nome, mat, grade=None, suave=True):
    if nome not in MALHAS:
        MALHAS[nome] = Malha(nome, mat, grade, suave)
    return MALHAS[nome]


DADOS = {"arvores": [], "palmeiras": [], "carros": [], "postes": []}
CORES_CARROS = 7


def ocupado(pt, margem=0.0):
    """True se o ponto cai sobre o shopping (para não plantar árvore nem estacionar carro no telhado)"""
    if dentro(pt, CONTORNO_M):
        return True
    return margem > 0 and dist_poligono(pt, CONTORNO_M) < margem


CONTORNO_M = planta(CONTORNO)


# ============================================================ CHÃO

Y_CHAO = 0.05


def chao():
    """Disco de calçada clara com borda chanfrada; o resto do chão são placas finas por cima"""
    m = malha("Chao_Calcada", "Mat_Chao_Calcada", grade=2.0)
    borda = [(x, z) for x, z in DISCO]
    m.paredes(borda, 0.0, Y_CHAO - 0.015)
    m.anel(ccw(borda), ccw([(x * (RAIO_UTIL - 0.015) / RAIO_UTIL, z * (RAIO_UTIL - 0.015) / RAIO_UTIL) for x, z in DISCO]), Y_CHAO - 0.015, Y_CHAO)
    m.placa([(x * (RAIO_UTIL - 0.015) / RAIO_UTIL, z * (RAIO_UTIL - 0.015) / RAIO_UTIL) for x, z in DISCO], Y_CHAO)


# Mata do Cocó: tudo além da via anelar norte e da borda nordeste do estacionamento (polígono real, generoso para fora)
MATA_REAL = [
    (-400, -120), (-240, -122), (-205, -150), (-172, -153), (-140, -150), (-127, -152), (-113, -170), (-96, -188),
    (-78, -200), (-58, -207), (-25, -210), (2, -206), (28, -197), (48, -185), (88, -149), (130, -116), (156, -96),
    (176, -76), (204, -38), (222, -10), (234, 18), (246, 30), (262, 22), (330, 40), (400, 40), (400, -400), (-400, -400),
]


def mata():
    global MATA_M
    p = no_disco(planta(MATA_REAL, 0.05))
    MATA_M = p
    m = malha("Chao_Mata_Coco", "Mat_Chao_Mata", grade=1.6)
    m.placa(p, Y_CHAO + 0.012)
    # árvores: amostragem com distância mínima (Poisson simples), copas grandes e juntas, como a mata vista de cima
    r = aleatorio(11)
    pts = []
    tentativas = 0
    while tentativas < 9000:
        tentativas += 1
        x, z = (r() * 2 - 1) * 33.5, (r() * 2 - 1) * 33.5
        if math.hypot(x, z) > 32.6 or not dentro((x, z), p):
            continue
        if dist_poligono((x, z), p) < 0.45 and math.hypot(x, z) < 32.0:
            continue
        esc = 0.95 + r() * 0.55
        if any(math.hypot(x - a, z - b) < (esc + e) * 0.78 for a, b, e, _ in pts):
            continue
        pts.append((x, z, esc, 0))
    DADOS["arvores"] += [[round(x, 3), round(z, 3), round(e, 3), t] for x, z, e, t in pts]


RUAS = []  # (polilinha na miniatura, meia largura): para não pôr árvore nem casa no asfalto


def na_rua(q, folga=0.25):
    for pts, ml in RUAS:
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            ex, ez = b[0] - a[0], b[1] - a[1]
            L2 = ex * ex + ez * ez or 1e-12
            t = max(0, min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ez) / L2))
            if math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ez * t) < ml + folga:
                return True
    return False


def arborizar(pts, off, passo, esc=0.6, semente=5):
    """Árvores de rua ao longo de uma polilinha, deslocadas `off` metros para um lado"""
    r = aleatorio(semente)
    for t2 in aparar_linha(paralela(pts, off), 32.4):
        for (q, d) in amostrar_linha(t2, passo):
            if not ocupado(q, 0.35) and not na_rua(q, 0.15) and not dentro_mata(q):
                DADOS["arvores"].append([round(q[0], 3), round(q[1], 3), round(esc + r() * 0.15, 3), 1])


def dentro_mata(q):
    return MATA_M is not None and dentro(q, MATA_M)


MATA_M = None


def ruas():
    asf = malha("Ruas_Asfalto", "Mat_Asfalto", grade=1.6)
    fx = malha("Ruas_Faixas", "Mat_Faixa_Branca", suave=False)
    can = malha("Ruas_Canteiro", "Mat_Canteiro")
    y = Y_CHAO + 0.02
    # Washington Soares: eixo médio entre as duas pistas do OSM; na miniatura, duas pistas de 1,6 m (três faixas)
    # e canteiro central de 0,36 m, desenhados a partir do eixo (a compressão da borda espremeria as larguras)
    norte = linha(VIAS["washington_oeste_a"][::-1] + VIAS["washington_norte"][1:])
    sul = linha(VIAS["washington_oeste_b"] + VIAS["washington_sul"][1:])
    meio = [lerp2(a, b, 0.5) for a, b in zip(reamostrar(norte, 160), reamostrar(sul, 160))]
    RUAS.append((meio, 2.0))
    for trecho in aparar_linha(meio, RAIO_UTIL + 2):
        for lado in (-1, 1):
            pista = [q for q in paralela(trecho, lado * 0.98)]
            for t2 in aparar_linha(pista, RAIO_UTIL - 0.05):
                asf.fita(t2, 1.6, y)
            for off in (-0.27, 0.27):
                for t2 in aparar_linha(paralela(pista, off), RAIO_UTIL - 0.3):
                    for (q, d) in amostrar_linha(t2, 0.85):
                        fx.fita([q, (q[0] + d[0] * 0.4, q[1] + d[1] * 0.4)], 0.05, y + 0.006)
            for off in (-0.72, 0.72):
                for t2 in aparar_linha(paralela(pista, off), RAIO_UTIL - 0.15):
                    fx.fita(t2, 0.04, y + 0.006)
    for trecho in aparar_linha(meio, RAIO_UTIL - 0.3):
        can.fita(trecho, 0.36, y + 0.012)
        for (q, d) in amostrar_linha(trecho, 2.2)[1:]:
            if math.hypot(*q) < 32.4:
                DADOS["arvores"].append([round(q[0], 3), round(q[1], 3), 0.55, 1])
        for (q, d) in amostrar_linha(trecho, 4.4)[1:]:
            if math.hypot(*q) < 32.6:
                DADOS["postes"].append([round(q[0], 3), round(q[1], 3), round(math.atan2(d[0], d[1]), 3)])
    # vias de serviço e a anelar norte (mão dupla, 0,95 m), com eixo tracejado
    for chave, larg in (("servico_sul", 0.95), ("anel_norte", 0.95), ("acesso_nordeste", 0.85), ("servico_oeste", 0.85), ("servico_leste", 0.8), ("servico_sudeste", 0.8), ("servico_jardim", 0.7)):
        for trecho in aparar_linha(linha(VIAS[chave]), RAIO_UTIL - 0.2):
            if comprimento(trecho) < 0.8:
                continue
            asf.fita(trecho, larg, y - 0.002)
            RUAS.append((trecho, larg / 2))
            if larg >= 0.85:
                for (q, d) in amostrar_linha(trecho, 0.9):
                    fx.fita([q, (q[0] + d[0] * 0.4, q[1] + d[1] * 0.4)], 0.035, y + 0.002)


def paralela(pts, off):
    out = []
    n = len(pts)
    for i in range(n):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        d = (b[0] - a[0], b[1] - a[1])
        L = math.hypot(*d) or 1e-9
        out.append((pts[i][0] - d[1] / L * off, pts[i][1] + d[0] / L * off))
    return out


def reamostrar(pts, n):
    L = comprimento(pts)
    out = []
    for k in range(n):
        alvo = L * k / (n - 1)
        s = 0.0
        for i in range(len(pts) - 1):
            l = dist(pts[i], pts[i + 1])
            if s + l >= alvo or i == len(pts) - 2:
                out.append(lerp2(pts[i], pts[i + 1], min(1, (alvo - s) / (l or 1e-9))))
                break
            s += l
    return out


def estacionamentos():
    """Estacionamentos de superfície (OSM), com vagas pintadas, ilhas de árvores e carros"""
    asf = malha("Estacionamento_Piso", "Mat_Asfalto_Estacionamento", grade=1.6)
    fx = malha("Estacionamento_Vagas", "Mat_Faixa_Branca", suave=False)
    r = aleatorio(23)
    y = Y_CHAO + 0.014
    eixo = (0.776, 0.630)  # as fileiras correm paralelas à espinha (rumo ~124°)
    for nome, real in ESTACIONAMENTOS.items():
        p = no_disco(planta(real, 0.05), RAIO_UTIL - 0.1)
        if len(p) < 3:
            continue
        asf.placa(p, y, giro=math.atan2(eixo[1], eixo[0]))
        nrm = (-eixo[1], eixo[0])
        # fileiras duplas de vagas a cada 2,5 m: linhas de 0,62 m a cada 0,36 m
        proj = [q[0] * nrm[0] + q[1] * nrm[1] for q in p]
        projL = [q[0] * eixo[0] + q[1] * eixo[1] for q in p]
        k = 0
        o = min(proj) + 1.2
        while o < max(proj) - 0.5:
            s = min(projL)
            while s < max(projL):
                for lado in (-1, 1):
                    base = (eixo[0] * s + nrm[0] * o, eixo[1] * s + nrm[1] * o)
                    a = base
                    b = (base[0] + nrm[0] * 0.62 * lado, base[1] + nrm[1] * 0.62 * lado)
                    if dentro(a, p) and dentro(b, p) and dist_poligono(a, p) > 0.25 and dist_poligono(b, p) > 0.15 and math.hypot(*b) < 32.8:
                        fx.fita([a, b], 0.035, y + 0.006)
                        # carro na vaga ao lado (65 % ocupadas)
                        c = (base[0] + nrm[0] * 0.33 * lado + eixo[0] * 0.18, base[1] + nrm[1] * 0.33 * lado + eixo[1] * 0.18)
                        if r() < 0.24 and dentro(c, p) and dist_poligono(c, p) > 0.3:
                            giro = math.atan2(nrm[0], nrm[1])
                            DADOS["carros"].append([round(c[0], 3), round(y, 3), round(c[1], 3), round(giro + (math.pi if r() < 0.5 else 0), 3), int(r() * CORES_CARROS)])
                s += 0.36
            # ilha de árvores no meio da fileira dupla, a cada ~3,2 m
            s = min(projL) + 1.0
            while s < max(projL):
                q = (eixo[0] * s + nrm[0] * o, eixo[1] * s + nrm[1] * o)
                if dentro(q, p) and dist_poligono(q, p) > 0.7 and math.hypot(*q) < 32.3 and r() < 0.75:
                    DADOS["arvores"].append([round(q[0], 3), round(q[1], 3), round(0.6 + r() * 0.2, 3), 1])
                s += 3.2 + r() * 0.8
            o += 2.5
            k += 1


def jardim():
    """Praça-jardim a sudoeste (entre a rotunda e a proa): piso claro, canteiros de grama do OSM e palmeiras"""
    g = malha("Jardim_Grama", "Mat_Grama_Jardim", grade=1.6)
    cam = malha("Jardim_Caminhos", "Mat_Caminho_Jardim", grade=1.6)
    r = aleatorio(41)
    y = Y_CHAO + 0.022
    # a praça inteira (vista aérea): piso de caminhos avermelhados, com os canteiros de grama do OSM por cima
    praca = no_disco(planta(chaikin([(-205, 72), (-186, 56), (-152, 68), (-112, 70), (-104, 100), (-104, 138), (-113, 152), (-140, 152),
                                      (-166, 140), (-184, 122), (-200, 96)], 2), 0.03))
    cam.placa(praca, Y_CHAO + 0.017)
    for nome, real in JARDIM.items():
        p = no_disco(planta(chaikin(real, 1), 0.03))
        if len(p) < 3:
            continue
        g.placa(p, y)
        g.paredes(p, Y_CHAO, y)
        # palmeiras espalhadas nos canteiros
        n = max(1, int(abs(area(p)) / 0.9))
        for _ in range(n * 3):
            if n <= 0:
                break
            xs = [q[0] for q in p]
            zs = [q[1] for q in p]
            q = (min(xs) + r() * (max(xs) - min(xs)), min(zs) + r() * (max(zs) - min(zs)))
            if dentro(q, p) and dist_poligono(q, p) > 0.2:
                DADOS["palmeiras"].append([round(q[0], 3), round(q[1], 3), round(0.8 + r() * 0.35, 3)])
                n -= 1
    # árvores de rua: calçada sul da avenida, frente do shopping e via oeste
    for chave, off, passo in (("servico_sul", -0.85, 1.7), ("servico_oeste", 0.8, 1.6), ("anel_norte", -0.75, 1.9)):
        arborizar(linha(VIAS[chave]), off, passo, 0.62, len(chave))
    norte = linha(VIAS["washington_oeste_a"][::-1] + VIAS["washington_norte"][1:])
    sul = linha(VIAS["washington_oeste_b"] + VIAS["washington_sul"][1:])
    meio = [lerp2(a, b, 0.5) for a, b in zip(reamostrar(norte, 160), reamostrar(sul, 160))]
    arborizar(meio, 2.45, 1.8, 0.6, 3)
    arborizar(meio, -2.45, 2.1, 0.6, 4)


def vizinhos():
    """Casas e prédios baixos do OSM em volta (Guararapes ao sul, a oeste): só sugeridos, sem os prédios altos"""
    par = malha("Vizinhos_Paredes", "Mat_Vizinhos_Paredes")
    cer = malha("Vizinhos_Telhados_Ceramicos", "Mat_Vizinhos_Telhado_Ceramico")
    laj = malha("Vizinhos_Lajes", "Mat_Vizinhos_Laje")
    r = aleatorio(91)
    for h, real in VIZINHOS:
        if h > 15:
            continue  # torres residenciais e o Iguatemi Empresarial ficam de fora: tirariam a atenção do shopping
        p = planta(real, 0.03)
        c = centro_de(p)
        if math.hypot(*c) > 32.4 or abs(area(p)) < 0.05:
            continue
        p = no_disco(p, RAIO_UTIL - 0.25)
        if len(p) < 3 or ocupado(c, 0.5) or na_rua(c, 0.1) or dentro_mata(c):
            continue
        if any(na_rua(q, 0.0) for q in p):
            continue
        yt = max(0.55, H(h) * 0.9)
        p = ccw(p)
        par.paredes(p, 0.0, yt)
        (cer if r() < 0.65 else laj).placa(p, yt)


# ============================================================ SHOPPING

FACHADA, PLATIBANDA = "Mat_Fachada_Galerias", "Mat_Platibanda_Branca"
EXTRAS_PLANTA = []  # gota, proa, garagem, peças de vidro: as máquinas do embasamento desviam delas
Y_EMBASAMENTO = H(7.6)


VOLUMES_PLANTA = []


def volume(nome, p, y_topo, telhado="Mat_Telhado_Branco", y0=0.0, parapeito=0.16, esp=0.09, chanfro=0.07, giro_uv=0.0, fachada=FACHADA, grade=1.5):
    """Volume de galeria: paredes, platibanda chanfrada (pega a luz no contorno) e laje de cobertura recuada.
    Devolve o contorno interno do telhado (para pôr máquinas e claraboias em cima)."""
    p = ccw(chanfrar_cantos(ccw(p), 0.07))
    if nome != "Embasamento":
        VOLUMES_PLANTA.append(p)
    paredes = malha(nome + "_Fachadas", fachada)
    plat = malha(nome + "_Platibanda", PLATIBANDA)
    tel = malha(nome + "_Telhado", telhado, grade=grade)
    yp = y_topo + parapeito
    paredes.paredes(p, y0, yp - chanfro)
    c1 = deslocar(p, -chanfro)
    plat.anel(p, c1, yp - chanfro, yp)
    c2 = deslocar(p, -esp)
    plat.anel(c1, c2, yp, yp)
    plat.paredes(c2, y_topo, yp, para_dentro=True)
    tel.placa(c2, y_topo, giro_uv)
    if not nome.startswith(("Embasamento", "Miolo")) and y_topo > Y_EMBASAMENTO + 0.8:
        # friso branco na linha da laje do embasamento: amarra os volumes altos ao corpo do shopping
        fr = deslocar(p, 0.05)
        plat.paredes(fr, Y_EMBASAMENTO - 0.12, Y_EMBASAMENTO)
        plat.anel(fr, p, Y_EMBASAMENTO, Y_EMBASAMENTO)
        plat.anel(p, fr, Y_EMBASAMENTO - 0.12, Y_EMBASAMENTO - 0.12)
    return c2


def embasamento():
    """Corpo de 7,6 m que liga tudo (relação 15800223 do OSM): laje técnica escura entre os volumes brancos"""
    p = deslocar(ccw(CONTORNO_M), -0.04)
    volume("Embasamento", p, Y_EMBASAMENTO, telhado="Mat_Laje_Tecnica", parapeito=0.12, grade=1.5)


def espinha():
    """Galeria original (OSM 1168115753, 13,5 m), com a claraboia longa do corredor (1992) no eixo"""
    p = planta(PARTES["5753"]["planta"])
    yt = H(13.5)
    giro = math.atan2(0.630, 0.776)
    volume("Espinha", p, yt, telhado="Mat_Telhado_Bege", giro_uv=giro)
    # eixo da claraboia: s ao longo do rumo da espinha, a 43 m do alinhamento nordeste
    u, n = (0.776, 0.630), (0.630, -0.776)
    pts = [mini((s * u[0] + 43 * n[0], s * u[1] + 43 * n[1])) for s in range(-95, 131, 5)]
    claraboia_longa(pts, yt, larg=0.95, alt=0.5)
    return p


def claraboia_longa(pts, y, larg, alt):
    """Claraboia em duas águas: mureta branca, dois planos de vidro com nervuras e a cumeeira"""
    vid = malha("Claraboia_Corredor_Vidro", "Mat_Vidro_Escuro")
    est = malha("Claraboia_Corredor_Estrutura", "Mat_Estrutura_Branca", suave=False)
    L = comprimento(pts)
    a, b = pts[0], pts[-1]
    d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
    nrm = (-d[1], d[0])
    yb = y + 0.12
    # mureta (caixa contínua)
    ce = [(a[0] + nrm[0] * larg / 2 - d[0] * 0.05, a[1] + nrm[1] * larg / 2 - d[1] * 0.05), (b[0] + nrm[0] * larg / 2 + d[0] * 0.05, b[1] + nrm[1] * larg / 2 + d[1] * 0.05),
          (b[0] - nrm[0] * larg / 2 + d[0] * 0.05, b[1] - nrm[1] * larg / 2 + d[1] * 0.05), (a[0] - nrm[0] * larg / 2 - d[0] * 0.05, a[1] - nrm[1] * larg / 2 - d[1] * 0.05)]
    est.prisma(ce, y, yb)
    # águas de vidro (UV: u ao longo, v na inclinação) e oitões
    for lado in (1, -1):
        e0 = (a[0] + nrm[0] * lado * (larg / 2 - 0.04), a[1] + nrm[1] * lado * (larg / 2 - 0.04))
        e1 = (b[0] + nrm[0] * lado * (larg / 2 - 0.04), b[1] + nrm[1] * lado * (larg / 2 - 0.04))
        q = [(e0[0], yb, e0[1]), (e1[0], yb, e1[1]), (b[0], yb + alt, b[1]), (a[0], yb + alt, a[1])]
        uvs = [(0, 0), (L, 0), (L, 0.55), (0, 0.55)]
        if lado < 0:
            q, uvs = q[::-1], uvs[::-1]
        vid.quad(q, uvs)
    for ponta, s in ((a, -1), (b, 1)):
        q = [(ponta[0] - nrm[0] * (larg / 2 - 0.04), yb, ponta[1] - nrm[1] * (larg / 2 - 0.04)), (ponta[0] + nrm[0] * (larg / 2 - 0.04), yb, ponta[1] + nrm[1] * (larg / 2 - 0.04)), (ponta[0], yb + alt, ponta[1])]
        vid.quad_para(q, (d[0] * s, 0, d[1] * s), [(0, 0), (1, 0), (0.5, 0.5)])
    # cumeeira e nervuras transversais (arcos brancos a cada ~0,9 m)
    est.tubo((a[0], yb + alt, a[1]), (b[0], yb + alt, b[1]), 0.045, 4)
    k = 0.0
    while k <= L + 1e-6:
        c = (a[0] + d[0] * k, a[1] + d[1] * k)
        for lado in (1, -1):
            e = (c[0] + nrm[0] * lado * (larg / 2 - 0.04), c[1] + nrm[1] * lado * (larg / 2 - 0.04))
            est.tubo((e[0], yb, e[1]), (c[0], yb + alt, c[1]), 0.025, 4)
        k += 1.4


def bloco_lente():
    """Bloco de 16,5 m (OSM 1168115848) com a claraboia de vidro em forma de lente (traçada da vista aérea)"""
    p = planta(PARTES["5848"]["planta"])
    yt = H(16.5)
    inn = volume("Bloco_Lente", p, yt)
    A, B = mini((-16.4, -5.3)), mini((4.4, 22.1))
    vesica(A, B, larg=13 * K, y=yt, alt=0.55, nome="Claraboia_Lente")
    return inn


def vesica(A, B, larg, y, alt, nome, nu=16, nv=6):
    """Abóbada de vidro em lente (pontuda nas duas pontas) com aro e nervuras brancas"""
    vid = malha(nome + "_Vidro", "Mat_Vidro_Escuro")
    est = malha(nome + "_Aro", "Mat_Estrutura_Branca", suave=False)
    L = dist(A, B)
    d = ((B[0] - A[0]) / L, (B[1] - A[1]) / L)
    nrm = (-d[1], d[0])
    yb = y + 0.1
    grid = []
    for i in range(nu + 1):
        t = i / nu
        w = larg / 2 * math.sin(math.pi * t) ** 0.85
        lin = []
        for j in range(nv + 1):
            v = -1 + 2 * j / nv
            c = (A[0] + d[0] * L * t + nrm[0] * w * v, A[1] + d[1] * L * t + nrm[1] * w * v)
            h = yb + alt * math.sin(math.pi * t) ** 0.6 * (1 - v * v) ** 0.7
            lin.append(vid.v(c[0], h, c[1]))
        grid.append(lin)
    for i in range(nu):
        for j in range(nv):
            uvs = [(i * L / nu / 0.3, j * 0.6), ((i + 1) * L / nu / 0.3, j * 0.6), ((i + 1) * L / nu / 0.3, (j + 1) * 0.6), (i * L / nu / 0.3, (j + 1) * 0.6)]
            f = vid.f([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]], uvs)
            if f is not None:
                f.normal_update()
                if f.normal.z < 0:
                    f.normal_flip()
    # aro: mureta branca no contorno da lente
    cont = []
    for i in range(nu + 1):
        t = i / nu
        w = larg / 2 * math.sin(math.pi * t) ** 0.85 + 0.06
        cont.append((A[0] + d[0] * L * t + nrm[0] * w, A[1] + d[1] * L * t + nrm[1] * w))
    for i in range(nu - 1, 0, -1):
        t = i / nu
        w = larg / 2 * math.sin(math.pi * t) ** 0.85 + 0.06
        cont.append((A[0] + d[0] * L * t - nrm[0] * w, A[1] + d[1] * L * t - nrm[1] * w))
    est.prisma(limpar(cont), y, yb)
    # nervura central (cumeeira)
    prev = None
    for i in range(nu + 1):
        t = i / nu
        c = (A[0] + d[0] * L * t, A[1] + d[1] * L * t)
        q = (c[0], yb + alt * math.sin(math.pi * t) ** 0.6 + 0.01, c[1])
        if prev:
            est.tubo(prev, q, 0.03, 4)
        prev = q


# ——— Garden Court: a cobertura de madeira laminada colada (2015) ———

# Contorno externo da gota (anel branco) e borda do campo translúcido, traçados da vista aérea (metros reais)
GOTA_EXT = [(-88.9, -1.7), (-83.0, 29.6), (-75.5, 59.4), (-65.0, 78.8), (-51.7, 87.7), (-33.8, 90.7), (-15.9, 87.7), (-2.5, 80.3),
            (2.0, 69.8), (-4.0, 59.4), (-24.9, 41.5), (-45.7, 23.6), (-69.5, 5.8), (-83.0, -0.8)]
GOTA_INT = [(-78.5, 17.7), (-77.0, 34.0), (-71.0, 56.4), (-60.6, 69.8), (-45.7, 77.3), (-30.8, 78.8), (-18.9, 75.8), (-14.4, 69.8),
            (-21.6, 59.4), (-36.5, 44.5), (-54.3, 32.6), (-69.5, 22.1)]


def garden_court():
    ext = ccw(chaikin(planta(GOTA_EXT), 2))
    EXTRAS_PLANTA.append(ext)
    inn = ccw(chaikin(planta(GOTA_INT), 2))
    y_gal = H(14.5)          # galerias em volta do pátio
    y_anel = y_gal + 0.42    # borda interna do anel branco (o anel sobe para dentro)
    y_cler = y_anel + 0.38   # topo do clerestório de vidro contínuo
    flecha = 1.8            # altura da abóbada acima da borda (curvilínea, "pérgola" sobre o pátio)
    # galerias em volta: paredes e platibanda no contorno externo
    par = malha("Garden_Court_Fachadas", FACHADA)
    par.paredes(ext, 0.0, y_gal)
    # casca: parâmetro u ao longo do eixo (da ponta até a parte redonda) e v de um lado ao outro
    T = max(inn, key=lambda q: dist(q, centro_de(inn)))  # a ponta é o ponto mais longe do centro
    E = max(inn, key=lambda q: dist(q, T))
    L = dist(T, E)
    d = ((E[0] - T[0]) / L, (E[1] - T[1]) / L)
    nrm = (-d[1], d[0])
    NU, NV = 34, 14
    secoes = []
    us = []
    for i in range(NU + 1):
        u = 0.5 - 0.5 * math.cos(math.pi * i / NU)
        us.append(u)
        c = (T[0] + d[0] * L * u, T[1] + d[1] * L * u)
        a, b = cortar(inn, c, nrm) if 0 < i < NU else (c, c)
        secoes.append((a, b))
    wmax = max(dist(a, b) for a, b in secoes)
    casca = malha("Garden_Court_Cobertura", "Mat_Policarbonato_Madeira")
    grid = []
    for i, (a, b) in enumerate(secoes):
        w = dist(a, b)
        perfil = (w / wmax) ** 0.85
        lin = []
        for j in range(NV + 1):
            v = -1 + 2 * j / NV
            q = lerp2(a, b, (v + 1) / 2)
            h = y_cler + flecha * perfil * (1 - v * v) ** 0.75
            lin.append((q[0], h, q[1]))
        grid.append(lin)
    # UV: uma célula da grelha de madeira = 1 x 1 (arcos transversais em u, terças em v)
    vs = [[casca.v(*q) for q in lin] for lin in grid]
    for i in range(NU):
        for j in range(NV):
            u0, u1 = us[i] * L / 0.62, us[i + 1] * L / 0.62  # um arco de madeira a cada 0,62 m (~4,6 m reais)
            uvs = [(u0, j / 1.4), (u1, j / 1.4), (u1, (j + 1) / 1.4), (u0, (j + 1) / 1.4)]
            quad = [vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]]
            # normal para cima
            f = casca.f(quad, uvs)
            if f is not None:
                f.normal_update()
                if f.normal.z < 0:
                    f.normal_flip()
                    # mantém os UV coerentes com a ordem nova
    # borda da casca: lado "a" de ponta a ponta e lado "b" de volta
    borda = [grid[i][0] for i in range(NU + 1)] + [grid[i][NV] for i in range(NU - 1, 0, -1)]
    borda2 = [(q[0], q[2]) for q in borda]
    if area(borda2) < 0:
        borda = borda[::-1]
        borda2 = borda2[::-1]
    # clerestório de vidro contínuo logo abaixo da borda da casca
    cler = malha("Garden_Court_Clerestorio", "Mat_Vidro_Escuro")
    viga = malha("Garden_Court_Viga_Madeira", "Mat_Madeira_MLC")
    n = len(borda2)
    for i in range(n):
        j = (i + 1) % n
        a, b = borda2[i], borda2[j]
        ha, hb = borda[i][1], borda[j][1]
        cler.quad([(a[0], y_anel, a[1]), (b[0], y_anel, b[1]), (b[0], ha - 0.01, b[1]), (a[0], ha - 0.01, a[1])], [(0, 0), (1, 0), (1, 1), (0, 1)])
    # viga de borda em madeira (frechal), acompanhando a casca por fora
    fora = deslocar(borda2, 0.07)
    for i in range(n):
        j = (i + 1) % n
        a, b, fa, fb = borda2[i], borda2[j], fora[i], fora[j]
        ha, hb = borda[i][1], borda[j][1]
        viga.quad([(fa[0], ha - 0.13, fa[1]), (fb[0], hb - 0.13, fb[1]), (fb[0], hb + 0.03, fb[1]), (fa[0], ha + 0.03, fa[1])], [(0, 0), (1, 0), (1, 1), (0, 1)])
        viga.quad([(fa[0], ha + 0.03, fa[1]), (fb[0], hb + 0.03, fb[1]), (b[0], hb + 0.03, b[1]), (a[0], ha + 0.03, a[1])], [(0, 0), (1, 0), (1, 1), (0, 1)])
    # anel branco (telha metálica) entre o contorno externo e o clerestório: cada ponto da borda acha o seu par
    # no contorno externo pelo raio que sai do centro da gota
    C = centro_de(inn)
    ext_par = [raio_ate(ext, C, q) for q in borda2]
    anel = malha("Garden_Court_Anel_Metalico", "Mat_Cobertura_Anel", grade=None)
    plat = malha("Garden_Court_Platibanda", PLATIBANDA)
    ext_c = deslocar(ext_par, -0.05)
    plat.anel(ext_par, ext_c, y_gal, y_gal + 0.06)
    plat.paredes(ext_par, y_gal - 0.02, y_gal, u0=0)
    anel.anel(ext_c, borda2, y_gal + 0.06, y_anel)
    # arcos de madeira aparentes na ponta (entrada do pátio) e frechal: dão a leitura de madeira de perto
    return ext


def centro_de(p):
    xs = sum(q[0] for q in p) / len(p)
    zs = sum(q[1] for q in p) / len(p)
    return (xs, zs)


def cortar(p, c, nrm):
    """Interseções da reta (c + t·nrm) com o polígono: as duas mais externas"""
    ts = []
    n = len(p)
    for i in range(n):
        a, b = p[i], p[(i + 1) % n]
        e = (b[0] - a[0], b[1] - a[1])
        den = nrm[0] * e[1] - nrm[1] * e[0]
        if abs(den) < 1e-12:
            continue
        w = (a[0] - c[0], a[1] - c[1])
        t = (w[0] * e[1] - w[1] * e[0]) / den
        s = (w[0] * nrm[1] - w[1] * nrm[0]) / den
        if 0 <= s <= 1:
            ts.append(t)
    if len(ts) < 2:
        return c, c
    return (c[0] + nrm[0] * min(ts), c[1] + nrm[1] * min(ts)), (c[0] + nrm[0] * max(ts), c[1] + nrm[1] * max(ts))


def raio_ate(p, C, q):
    d = (q[0] - C[0], q[1] - C[1])
    L = math.hypot(*d) or 1e-9
    d = (d[0] / L, d[1] / L)
    best = None
    n = len(p)
    for i in range(n):
        a, b = p[i], p[(i + 1) % n]
        e = (b[0] - a[0], b[1] - a[1])
        den = d[0] * e[1] - d[1] * e[0]
        if abs(den) < 1e-12:
            continue
        w = (a[0] - C[0], a[1] - C[1])
        t = (w[0] * e[1] - w[1] * e[0]) / den
        s = (w[0] * d[1] - w[1] * d[0]) / den
        if 0 <= s <= 1 and t > 0 and (best is None or t > best):
            best = t
    return (C[0] + d[0] * best, C[1] + d[1] * best) if best else q


# ——— Ala curva, proa de vidro e rotunda ———

def ala_curva():
    """Ala curva de 19,4 m (OSM 1168115654), telhado metálico cinza, colada ao oeste do Garden Court"""
    p = planta(PARTES["5654"]["planta"])
    return volume("Ala_Curva", p, H(19.4), telhado="Mat_Telhado_Metalico_Cinza")


# Proa: triângulo com grelha metálica branca sobre vidro, apontado para o sul (traçado da vista aérea)
PROA = [(-100.5, 112.0), (-62.0, 107.5), (-95.0, 171.0)]


def proa():
    p = ccw(planta(PROA))
    EXTRAS_PLANTA.append(p)
    yt = H(19.4) - 0.25
    vid = malha("Proa_Vidro_Verde", "Mat_Vidro_Verde_Fachada")
    est = malha("Proa_Estrutura_Branca", "Mat_Estrutura_Branca", suave=False)
    # fachadas de vidro verde (pé-direito triplo) com grelha na textura; quadro branco nas arestas
    vid.paredes(deslocar(p, -0.05), 0.0, yt)
    vid.placa(deslocar(p, -0.05), yt - 0.02)
    for i in range(3):
        a = p[i]
        est.tubo((a[0], 0.0, a[1]), (a[0], yt + 0.02, a[1]), 0.07, 6)
        b = p[(i + 1) % 3]
        est.tubo((a[0], yt + 0.02, a[1]), (b[0], yt + 0.02, b[1]), 0.07, 6)
        est.tubo((a[0], 0.06, a[1]), (b[0], 0.06, b[1]), 0.05, 4)
    # grelha da cobertura: vigas brancas nas duas direções (N–S e L–O), recortadas pelo triângulo
    passo = 0.5
    xs = [q[0] for q in p]
    zs = [q[1] for q in p]
    for eixo in (0, 1):
        lo, hi = (min(xs), max(xs)) if eixo == 0 else (min(zs), max(zs))
        k = lo + passo / 2
        while k < hi:
            a, b = cortar(p, (k, 0) if eixo == 0 else (0, k), (0, 1) if eixo == 0 else (1, 0))
            if dist(a, b) > 0.2:
                est.tubo((a[0], yt + 0.02, a[1]), (b[0], yt + 0.02, b[1]), 0.03, 4)
            k += passo
    # montantes da fachada a cada ~1 m (perfis brancos verticais)
    for i in range(3):
        a, b = p[i], p[(i + 1) % 3]
        L = dist(a, b)
        n = max(2, int(L / 1.0))
        for k in range(1, n):
            q = lerp2(a, b, k / n)
            est.tubo((q[0], 0.06, q[1]), (q[0], yt, q[1]), 0.022, 4)
    return p


def rotunda():
    """Bloco em leque a oeste (contorno do OSM): fachada curva lisa e telhado com o degrau concêntrico da vista aérea"""
    pts = [p for p in CONTORNO]
    i0 = pts.index((-122.6, -19.3))
    i1 = pts.index((-134.3, 67.7))
    arco = pts[i0:i1 + 1] + [(-114.3, 66.1), (-121.0, -2.0)]
    reta = arco[:2]
    curva = chaikin(arco[1:-3], 3, fechado=False)
    real = reta[:1] + curva + arco[-3:]
    p = planta(real, 0.02)
    yt = H(15)
    inn = volume("Rotunda_Oeste", p, yt)
    # degrau concêntrico (~12 m para dentro da borda curva): laje elevada branca
    degrau = deslocar(inn, -1.45)
    tel = malha("Rotunda_Oeste_Telhado", "Mat_Telhado_Branco", grade=1.5)
    tel.prisma(degrau, yt, yt + 0.14)
    # base sombreada: faixa de vidro escuro rente ao chão na fachada curva (o térreo recuado)
    return inn


def bloco_norte():
    """Lojas âncora antigas entre a espinha e a mata (OSM 8,8–12,3 m): telhados longos em sheds paralelos à espinha"""
    real = [(-175.1, -63.2), (-161.1, -98.9), (-167.1, -103.6), (-152.2, -132.2), (-131.8, -129.1), (-90.8, -179.6), (-70.3, -187.9),
            (-26.5, -152.5), (-23.2, -156.5), (-2.8, -140.0), (-5.3, -137.0), (-48.0, -110.0), (-62.8, -100.4), (-118.0, -40.0), (-134.1, -30.7)]
    p = planta(real)
    yt = H(11)
    inn = volume("Bloco_Norte", p, yt, telhado="Mat_Telhado_Branco")
    # sheds: cumeeiras paralelas à espinha a cada 1,05 m
    u = (0.776, 0.630)
    n = (-u[1], u[0])
    sh = malha("Bloco_Norte_Sheds", "Mat_Telhado_Branco", suave=False)
    proj = [q[0] * n[0] + q[1] * n[1] for q in inn]
    o = min(proj) + 0.6
    while o < max(proj) - 0.4:
        c = (n[0] * o, n[1] * o)
        segs = segmentos_dentro(inn, c, u)
        for a, b in segs:
            if dist(a, b) < 1.0:
                continue
            a = lerp2(a, b, 0.25 / dist(a, b))
            b = lerp2(b, a, 0.25 / dist(a, b))
            for lado in (1, -1):
                e0 = (a[0] + n[0] * 0.45 * lado, a[1] + n[1] * 0.45 * lado)
                e1 = (b[0] + n[0] * 0.45 * lado, b[1] + n[1] * 0.45 * lado)
                q = [(e0[0], yt, e0[1]), (e1[0], yt, e1[1]), (b[0], yt + 0.2, b[1]), (a[0], yt + 0.2, a[1])]
                sh.quad_para(q, (n[0] * lado, 1, n[1] * lado), [(0, 0), (1, 0), (1, 1), (0, 1)])
            dd = ((b[0] - a[0]) / dist(a, b), (b[1] - a[1]) / dist(a, b))
            for ponta, s in ((a, -1), (b, 1)):
                q = [(ponta[0] - n[0] * 0.45, yt, ponta[1] - n[1] * 0.45), (ponta[0] + n[0] * 0.45, yt, ponta[1] + n[1] * 0.45), (ponta[0], yt + 0.2, ponta[1])]
                sh.quad_para(q, (dd[0] * s, 0, dd[1] * s), [(0, 0), (1, 0), (0.5, 1)])
        o += 1.05
    return inn


def segmentos_dentro(p, c, d):
    """Trechos da reta c + t·d que caem dentro do polígono"""
    ts = []
    n = len(p)
    for i in range(n):
        a, b = p[i], p[(i + 1) % n]
        e = (b[0] - a[0], b[1] - a[1])
        den = d[0] * e[1] - d[1] * e[0]
        if abs(den) < 1e-12:
            continue
        w = (a[0] - c[0], a[1] - c[1])
        t = (w[0] * e[1] - w[1] * e[0]) / den
        s = (w[0] * d[1] - w[1] * d[0]) / den
        if 0 <= s < 1:
            ts.append(t)
    ts.sort()
    return [((c[0] + d[0] * ts[k], c[1] + d[1] * ts[k]), (c[0] + d[0] * ts[k + 1], c[1] + d[1] * ts[k + 1])) for k in range(0, len(ts) - 1, 2)]


# ——— Bloco de vidro sudeste, cone e marquise ———

def bloco_vidro_sudeste():
    """OSM 1168115755 (21 m): face sudoeste em grande plano de vidro inclinado com aletas brancas (vista aérea).
    Na frente, a marquise sobre o cone de tubos de aço (anos 1990; posição exata não confirmada)."""
    p = planta(PARTES["5755"]["planta"])
    yt = H(21)
    A, B = mini((-15.9, 193.2)), mini((27.6, 228.1))   # aresta sudoeste
    L = dist(A, B)
    d = ((B[0] - A[0]) / L, (B[1] - A[1]) / L)
    fora = (d[1], -d[0])
    # garante que `fora` aponta para fora (para longe do centro do bloco)
    c = centro_de(p)
    if (A[0] - c[0]) * fora[0] + (A[1] - c[1]) * fora[1] < 0:
        fora = (-fora[0], -fora[1])
    prof = 2.9  # largura do plano inclinado na miniatura
    linha_int = (A[0] - fora[0] * prof, A[1] - fora[1] * prof)
    traseira = recortar_semiplano(p, linha_int, (-fora[0], -fora[1]))
    frente = recortar_semiplano(p, linha_int, fora)
    volume("Bloco_Vidro_Sudeste", traseira, yt)
    # cunha: vidro inclinado de yt (linha interna) até y_baixo na aresta sudoeste
    y_baixo = 1.15
    vid = malha("Bloco_Vidro_Sudeste_Plano_Inclinado", "Mat_Vidro_Escuro")
    est = malha("Bloco_Vidro_Sudeste_Aletas", "Mat_Estrutura_Branca", suave=False)
    frente = ccw(frente)

    def altura(q):
        s = (q[0] - linha_int[0]) * fora[0] + (q[1] - linha_int[1]) * fora[1]
        return yt - (yt - y_baixo) * max(0, min(1, s / prof))
    n = len(frente)
    for i in range(n):
        a, b = frente[i], frente[(i + 1) % n]
        ha, hb = altura(a), altura(b)
        if ha > 0.01 or hb > 0.01:
            # parede lateral (fachada) até a altura do plano
            sa = (a[0] - linha_int[0]) * fora[0] + (a[1] - linha_int[1]) * fora[1]
            sb = (b[0] - linha_int[0]) * fora[0] + (b[1] - linha_int[1]) * fora[1]
            if abs(sa) < 1e-3 and abs(sb) < 1e-3:
                continue  # aresta interna, encostada na parte de trás
            mat = vid if (sa > prof - 0.05 and sb > prof - 0.05) else malha("Bloco_Vidro_Sudeste_Fachadas", FACHADA)
            e = (b[0] - a[0], b[1] - a[1])
            mat.quad_para([(a[0], 0.0, a[1]), (b[0], 0.0, b[1]), (b[0], hb, b[1]), (a[0], ha, a[1])], (-e[1], 0, e[0]), [(0, 0), (dist(a, b), 0), (dist(a, b), hb), (0, ha)])
    vid.f([vid.v(q[0], altura(q), q[1]) for q in frente], [((q[0] - A[0]) * d[0] + (q[1] - A[1]) * d[1], -((q[0] - A[0]) * fora[0] + (q[1] - A[1]) * fora[1]) * 1.6) for q in frente])
    # aletas triangulares brancas, perpendiculares à fachada, saindo 0,45 m para fora na base
    na = 9
    for k in range(na):
        t = (k + 0.5) / na
        q = lerp2(A, B, t)
        qi = (q[0] - fora[0] * prof, q[1] - fora[1] * prof)
        qo = (q[0] + fora[0] * 0.45, q[1] + fora[1] * 0.45)
        tri = [(qi[0], yt + 0.08, qi[1]), (qo[0], y_baixo - 0.35, qo[1]), (q[0], y_baixo - 0.35, q[1])]
        for lado in (1, -1):
            off = (d[0] * 0.04 * lado, d[1] * 0.04 * lado)
            t3 = [(x + off[0], y, z + off[1]) for x, y, z in tri]
            est.quad_para(t3, (d[0] * lado, 0, d[1] * lado), [(0, 0), (1, 0), (0, 1)])
        # espessura da aleta: tampa na aresta inclinada externa
        a0, b0 = tri[0], tri[1]
        est.quad_para([(a0[0] - d[0] * 0.04, a0[1], a0[2] - d[1] * 0.04), (b0[0] - d[0] * 0.04, b0[1], b0[2] - d[1] * 0.04), (b0[0] + d[0] * 0.04, b0[1], b0[2] + d[1] * 0.04), (a0[0] + d[0] * 0.04, a0[1], a0[2] + d[1] * 0.04)], (fora[0], 1, fora[1]), [(0, 0), (1, 0), (1, 1), (0, 1)])
        # pé da aleta (pilarete até o chão)
        est.tubo((qo[0], 0.0, qo[1]), (qo[0], y_baixo - 0.35, qo[1]), 0.04, 4)
    # marquise sobre o cone de tubos de aço, no meio da face sudoeste, de frente para a via de serviço
    meio = lerp2(A, B, 0.5)
    cone_marquise(meio, d, fora)


def cone_marquise(meio, d, fora):
    aco = malha("Marquise_Cone_Tubos_Aco", "Mat_Aco_Tubular", suave=False)
    laje = malha("Marquise_Laje", "Mat_Estrutura_Branca", suave=False)
    y_m = H(10)  # cone de ~10 m
    base = (meio[0] + fora[0] * 1.6, meio[1] + fora[1] * 1.6)
    # cone invertido: 12 tubos do pé até um anel de 0,62 m, com dois anéis horizontais
    n = 12
    topo = []
    for k in range(n):
        a = 2 * math.pi * k / n
        topo.append((base[0] + math.cos(a) * 0.85, y_m - 0.06, base[1] + math.sin(a) * 0.85))
    for k in range(n):
        aco.tubo((base[0], 0.05, base[1]), topo[k], 0.03, 5)
        aco.tubo(topo[k], topo[(k + 1) % n], 0.035, 5)
    meio_anel = [(base[0] + (q[0] - base[0]) * 0.5, 0.05 + (q[1] - 0.05) * 0.5, base[1] + (q[2] - base[1]) * 0.5) for q in topo]
    for k in range(n):
        aco.tubo(meio_anel[k], meio_anel[(k + 1) % n], 0.018, 4)
    aco.tubo((base[0], 0.0, base[1]), (base[0], 0.12, base[1]), 0.09, 8)
    # marquise triangular (~346 m² reais): dois vértices na fachada e a ponta para fora, sobre o cone
    v1 = (meio[0] - d[0] * 2.0, meio[1] - d[1] * 2.0)
    v2 = (meio[0] + d[0] * 2.0, meio[1] + d[1] * 2.0)
    v3 = (meio[0] + fora[0] * 3.0, meio[1] + fora[1] * 3.0)
    tri = ccw(chanfrar_cantos([v1, v2, v3], 0.08, 10))
    laje.prisma(tri, y_m, y_m + 0.1)
    laje.placa(tri, y_m)  # face de baixo também (vista de perto)


# ——— Cinema, garagem e miolo sudeste ———

def cinema():
    p = planta(PARTES["5849"]["planta"])
    return volume("Bloco_Cinema", p, H(26.2), telhado="Mat_Telhado_Branco")


def garagem():
    """Edifício-garagem (OSM 1168115918, 4 níveis, 12,1 m): lajes abertas com o vão escuro entre elas"""
    p = ccw(chanfrar_cantos(planta(PARTES["5918"]["planta"]), 0.06))
    EXTRAS_PLANTA.append(p)
    yt = H(12.1)
    niveis = 4
    hn = yt / niveis
    conc = malha("Garagem_Lajes", "Mat_Garagem_Concreto")
    cob = malha("Garagem_Cobertura", "Mat_Garagem_Concreto", grade=1.6)
    vao = malha("Garagem_Interior", "Mat_Garagem_Interior")
    nucleo = deslocar(p, -0.35)
    vao.paredes(nucleo, 0.0, yt)
    for k in range(1, niveis + 1):
        y = k * hn
        # laje + peitoril (faixa de concreto de 0,3 m) no contorno
        conc.paredes(p, y - 0.3, y + 0.04)
        conc.anel(p, deslocar(p, -0.36), y + 0.04, y + 0.04)
        conc.paredes(deslocar(p, -0.36), y - 0.3, y + 0.04, para_dentro=True) if k < niveis else None
        conc.anel(deslocar(p, -0.36), p, y - 0.3, y - 0.3) if k < niveis else None
    conc.paredes(p, 0.0, 0.12)
    # pilares no contorno a cada ~1,4 m
    n = len(p)
    for i in range(n):
        a, b = p[i], p[(i + 1) % n]
        L = dist(a, b)
        m = max(1, int(L / 2.1))
        for k in range(m):
            q = lerp2(a, b, k / m)
            qi = lerp2(q, centro_de(p), 0.12 / max(0.12, dist(q, centro_de(p))))
            conc.caixa(qi[0], qi[1], 0.14, 0.14, 0.0, yt - 0.3, giro=math.atan2(b[1] - a[1], b[0] - a[0]))
    # cobertura: estacionamento descoberto com vagas, e uma cobertura branca sobre parte (vista aérea)
    topo = deslocar(p, -0.36)
    cob.placa(topo, yt + 0.04)
    fx = malha("Garagem_Vagas", "Mat_Faixa_Branca", suave=False)
    u = (0.776, 0.630)
    nrm = (-u[1], u[0])
    r = aleatorio(57)
    proj = [q[0] * nrm[0] + q[1] * nrm[1] for q in topo]
    projL = [q[0] * u[0] + q[1] * u[1] for q in topo]
    o = min(proj) + 0.7
    while o < max(proj) - 0.3:
        s = min(projL)
        while s < max(projL):
            for lado in (-1, 1):
                a = (u[0] * s + nrm[0] * o, u[1] * s + nrm[1] * o)
                b = (a[0] + nrm[0] * 0.55 * lado, a[1] + nrm[1] * 0.55 * lado)
                if dentro(a, topo) and dentro(b, topo) and dist_poligono(b, topo) > 0.1:
                    fx.fita([a, b], 0.03, yt + 0.05)
                    c = (a[0] + nrm[0] * 0.3 * lado + u[0] * 0.17, a[1] + nrm[1] * 0.3 * lado + u[1] * 0.17)
                    if r() < 0.3 and dentro(c, topo) and dist_poligono(c, topo) > 0.25:
                        DADOS["carros"].append([round(c[0], 3), round(yt + 0.04, 3), round(c[1], 3), round(math.atan2(nrm[0], nrm[1]) + (math.pi if r() < 0.5 else 0), 3), int(r() * CORES_CARROS)])
            s += 0.34
        o += 1.9
    return p


# Volumes do miolo sudeste (OSM, 15–20 m) e casas de máquinas pequenas
MIOLO = ["5845", "5939", "5725", "5740", "5801", "5680", "5818", "5860", "5942", "5884", "5815"]
CASAS = ["5606", "5870", "5980", "5776", "5734", "5902", "5962", "5707", "5651", "5914", "5929", "5876"]


def miolo():
    tops = []
    for k in MIOLO:
        p = planta(PARTES[k]["planta"])
        if abs(area(p)) < 0.6:
            continue
        tops.append((volume("Miolo_" + k, p, H(PARTES[k]["altura"]), grade=1.5), H(PARTES[k]["altura"])))
    maq = malha("Telhado_Maquinas", "Mat_Maquinas_Telhado", suave=False)
    for k in CASAS:
        p = ccw(chanfrar_cantos(planta(PARTES[k]["planta"]), 0.05))
        maq.prisma(p, 0.0, H(PARTES[k]["altura"]))
    # junta os volumes do miolo num nome só por material (menos malhas)
    return tops


def pecas_de_vidro():
    """Pirâmide de vidro, cúpula sobre base octogonal e claraboias em grelha do miolo sudeste (vista aérea)"""
    giro = math.atan2(0.630, 0.776)
    vid = malha("Miolo_Claraboias_Vidro", "Mat_Vidro_Escuro")
    est = malha("Miolo_Claraboias_Estrutura", "Mat_Estrutura_Branca", suave=False)
    # pirâmide (~16 m de base) sobre um pódio branco (~27 m)
    c = mini((91.7, 88.3))
    y = H(15.9)
    est.caixa(c[0], c[1], 27 * K, 27 * K, 0.0, y + 0.12, giro)
    b = 16 * K / 2
    cs, sn = math.cos(giro), math.sin(giro)
    cant = [(c[0] + dx * cs - dz * sn, c[1] + dx * sn + dz * cs) for dx, dz in ((-b, -b), (b, -b), (b, b), (-b, b))]
    cant = ccw(cant)
    apice = (c[0], y + 0.12 + 1.15, c[1])
    for i in range(4):
        a, bb = cant[i], cant[(i + 1) % 4]
        vid.f([vid.v(a[0], y + 0.12, a[1]), vid.v(bb[0], y + 0.12, bb[1]), vid.v(*apice)], [(0, 0), (2 * b, 0), (b, 1.3)])
        est.tubo((a[0], y + 0.12, a[1]), apice, 0.03, 4)
        est.tubo((a[0], y + 0.13, a[1]), (bb[0], y + 0.13, bb[1]), 0.035, 4)
    # cúpula de vidro sobre tambor octogonal branco (~22 m), em cima da laje técnica
    c = mini((48.5, 142.0))
    oct_ = ccw(chanfrar_cantos([(c[0] + 1.55 * math.cos(math.pi / 8 + k * math.pi / 4), c[1] + 1.55 * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)], 0.05, 20))
    y0 = Y_EMBASAMENTO
    yt = H(16.5)
    est.prisma(oct_, y0, yt)
    anel_cup = [(c[0] + 1.0 * math.cos(2 * math.pi * k / 24), c[1] + 1.0 * math.sin(2 * math.pi * k / 24)) for k in range(24)]
    est.prisma(ccw(anel_cup), yt, yt + 0.1)
    # meia esfera achatada de vidro, com 8 meridianos brancos
    NA, NB = 24, 6
    linhas = []
    for j in range(NB + 1):
        fi = (math.pi / 2) * j / NB
        rr = 0.95 * math.cos(fi)
        hh = yt + 0.1 + 0.75 * math.sin(fi)
        linhas.append([(c[0] + rr * math.cos(2 * math.pi * k / NA), hh, c[1] + rr * math.sin(2 * math.pi * k / NA)) for k in range(NA)])
    vs = [[vid.v(*q) for q in lin] for lin in linhas]
    for j in range(NB):
        for k in range(NA):
            k2 = (k + 1) % NA
            quad = [vs[j][k], vs[j][k2], vs[j + 1][k2], vs[j + 1][k]]
            f = vid.f(quad, [(k / 4, j / 4), ((k + 1) / 4, j / 4), ((k + 1) / 4, (j + 1) / 4), (k / 4, (j + 1) / 4)])
            if f is not None:
                f.normal_update()
                cen = sum((v.co for v in f.verts), f.verts[0].co * 0) / 4
                if (f.normal.x * (cen.x - c[0]) + f.normal.y * (cen.y + c[1])) < 0:
                    f.normal_flip()
    for k in range(0, NA, 3):
        for j in range(NB):
            est.tubo(linhas[j][k], linhas[j + 1][k], 0.022, 4)
    # claraboia em grelha (~30 x 20 m) e o pente de sheds de vidro (OSM 1168115941)
    c = mini((70.5, 118.0))
    y = H(16.5)
    q = est.caixa(c[0], c[1], 30 * K, 20 * K, y, y + 0.08, giro)
    vid.placa(deslocar(ccw(q), -0.08), y + 0.13, giro)
    for k in range(-3, 4):
        a = (c[0] + cs * k * 0.55 - sn * (-10 * K + 0.08), c[1] + sn * k * 0.55 + cs * (-10 * K + 0.08))
        bb = (c[0] + cs * k * 0.55 - sn * (10 * K - 0.08), c[1] + sn * k * 0.55 + cs * (10 * K - 0.08))
        est.tubo((a[0], y + 0.15, a[1]), (bb[0], y + 0.15, bb[1]), 0.025, 4)
    for k in range(3):
        s = mini((8.0 + k * 8.0, 92.0 + k * 9.0))
        q = est.caixa(s[0], s[1], 0.9, 0.32, Y_EMBASAMENTO, Y_EMBASAMENTO + 0.06, giro + math.pi / 2)
        # água de vidro inclinada (shed)
        p4 = ccw(q)
        vid.quad([(p4[0][0], Y_EMBASAMENTO + 0.06, p4[0][1]), (p4[1][0], Y_EMBASAMENTO + 0.06, p4[1][1]), (p4[2][0], Y_EMBASAMENTO + 0.42, p4[2][1]), (p4[3][0], Y_EMBASAMENTO + 0.42, p4[3][1])], [(0, 0), (1, 0), (1, 1), (0, 1)])


def maquinas(tetos):
    """Condensadoras em fileiras e casas de máquinas: quase todas na laje técnica, como na vista aérea"""
    maq = malha("Telhado_Maquinas", "Mat_Maquinas_Telhado", suave=False)
    r = aleatorio(77)
    giro = math.atan2(0.630, 0.776)
    cs, sn = math.cos(giro), math.sin(giro)
    for poly, y, n in tetos:
        xs = [q[0] for q in poly]
        zs = [q[1] for q in poly]
        feitas = 0
        for _ in range(n * 40):
            if feitas >= n:
                break
            q = (min(xs) + r() * (max(xs) - min(xs)), min(zs) + r() * (max(zs) - min(zs)))
            k = 2 + int(r() * 3)
            comp = k * 0.34
            fim = (q[0] + cs * comp, q[1] + sn * comp)
            if not (dentro(q, poly) and dentro(fim, poly)) or min(dist_poligono(q, poly), dist_poligono(fim, poly)) < 0.4:
                continue
            if y <= Y_EMBASAMENTO + 0.01 and any(dentro(x, v) or dist_poligono(x, v) < 0.45 for v in VOLUMES_PLANTA + EXTRAS_PLANTA for x in (q, fim)):
                continue
            # base de concreto e as unidades em fila
            meio = lerp2(q, fim, 0.5)
            for j in range(k):
                c = (q[0] + cs * (0.17 + j * 0.34), q[1] + sn * (0.17 + j * 0.34))
                maq.caixa(c[0], c[1], 0.28, 0.3, y, y + 0.22, giro)
            feitas += 1


def entradas_osm():
    """Entradas marcadas no OSM: vão de vidro escuro com uma pequena marquise branca"""
    vid = malha("Entradas_Vidro", "Mat_Vidro_Escuro")
    est = malha("Entradas_Marquises", "Mat_Estrutura_Branca", suave=False)
    for real in ENTRADAS:
        q = mini(real)
        # direção para fora: do ponto do contorno mais próximo para o ponto
        n = len(CONTORNO_M)
        best, nrm = 1e9, (0, 1)
        for i in range(n):
            a, b = CONTORNO_M[i], CONTORNO_M[(i + 1) % n]
            ex, ez = b[0] - a[0], b[1] - a[1]
            L2 = ex * ex + ez * ez or 1e-12
            t = max(0, min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ez) / L2))
            dd = math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ez * t)
            if dd < best:
                L = math.sqrt(L2)
                best, nrm, pe, tan = dd, (-ez / L, ex / L), (a[0] + ex * t, a[1] + ez * t), (ex / L, ez / L)
        # nrm (anti-horário) aponta para fora
        g = math.atan2(tan[1], tan[0])
        c = (pe[0] + nrm[0] * 0.05, pe[1] + nrm[1] * 0.05)
        vid.caixa(c[0], c[1], 1.2, 0.12, 0.0, 0.85, g)
        m = (pe[0] + nrm[0] * 0.45, pe[1] + nrm[1] * 0.45)
        est.caixa(m[0], m[1], 1.6, 0.9, 0.95, 1.03, g)


# ============================================================ MONTAGEM

def montar():
    chao()
    mata()
    ruas()
    estacionamentos()
    jardim()
    embasamento()
    tetos = []
    tetos.append((espinha_telhado(), H(13.5), 3))
    tetos.append((bloco_lente(), H(16.5), 1))
    garden_court()
    tetos.append((ala_curva(), H(19.4), 0))
    proa()
    tetos.append((rotunda(), H(15), 2))
    bloco_norte()
    bloco_vidro_sudeste()
    tetos.append((cinema(), H(26.2), 3))
    garagem()
    for poly, y in miolo():
        tetos.append((poly, y, 1 if abs(area(poly)) > 6 else 0))
    pecas_de_vidro()
    entradas_osm()
    tetos.append((deslocar(ccw(CONTORNO_M), -0.2), Y_EMBASAMENTO, 16))
    maquinas(tetos)
    vizinhos()


def espinha_telhado():
    return espinha()


# materiais que recebem textura de canvas no Iguatemi.tsx (só esses precisam de UV)
COM_TEXTURA = {"Mat_Fachada_Galerias", "Mat_Vidro_Verde_Fachada", "Mat_Vidro_Escuro", "Mat_Policarbonato_Madeira"}


def para_objetos():
    """Cada Malha vira um objeto com um material; os volumes do miolo são juntados por material"""
    mats = {}
    objs = []
    juntar = {}
    for nome, m in MALHAS.items():
        chave = nome
        if nome.startswith("Miolo_") and not nome.startswith("Miolo_Claraboias"):
            chave = "Miolo_" + nome.split("_", 2)[2]  # Miolo_5845_Fachadas -> Miolo_Fachadas
        juntar.setdefault(chave, []).append(m)
    for nome, lista in juntar.items():
        base = lista[0]
        for outra in lista[1:]:
            me_tmp = bpy.data.meshes.new("tmp")
            outra.bm.to_mesh(me_tmp)
            base.bm.from_mesh(me_tmp)
            bpy.data.meshes.remove(me_tmp)
        if base.mat not in mats:
            mats[base.mat] = criar_material(base.mat)
        bm = base.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.normal_update()
        if base.grade:
            subdividir_grade(bm, base.grade)
        if base.mat not in COM_TEXTURA:
            bm.loops.layers.uv.remove(bm.loops.layers.uv["UVMap"])
        me = bpy.data.meshes.new(nome)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mats[base.mat])
        ob = bpy.data.objects.new(nome, me)
        bpy.context.scene.collection.objects.link(ob)
        # sombreamento: liso nas curvas, quinas vivas acima de 32°
        me.shade_smooth() if hasattr(me, "shade_smooth") else None
        try:
            me.set_sharp_from_angle(angle=math.radians(32))
        except Exception:
            pass
        objs.append(ob)
    return objs


def subdividir_grade(bm, passo):
    """Corta as faces quase horizontais numa grade (só para a oclusão de ambiente ter vértices onde precisa)"""
    horiz = [f for f in bm.faces if abs(f.normal.z) > 0.7]
    if not horiz:
        return
    xs = [v.co.x for f in horiz for v in f.verts]
    ys = [v.co.y for f in horiz for v in f.verts]
    for eixo, lo, hi in ((0, min(xs), max(xs)), (1, min(ys), max(ys))):
        k = math.floor(lo / passo) * passo + passo
        while k < hi:
            faces = [f for f in bm.faces if abs(f.normal.z) > 0.7]
            geom = list({e for f in faces for e in f.edges}) + faces + list({v for f in faces for v in f.verts})
            co = (k, 0, 0) if eixo == 0 else (0, k, 0)
            no = (1, 0, 0) if eixo == 0 else (0, 1, 0)
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
            k += passo
    bm.normal_update()


def assar_oclusao(objs):
    """Bake de oclusão de ambiente (Cycles, CPU) em vertex color por canto; depois suaviza o contraste"""
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 160
    if cena.world is None:
        cena.world = bpy.data.worlds.new("Mundo")
    cena.world.light_settings.distance = 1.3
    cena.render.bake.target = "VERTEX_COLORS"
    for ob in objs:
        me = ob.data
        attr = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
        me.color_attributes.active_color = attr
        try:
            me.color_attributes.render_color_index = me.color_attributes.active_color_index
        except Exception:
            pass
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    for ob in objs:
        attr = ob.data.color_attributes["AO"]
        forca = 0.55 if ob.name.startswith(("Chao", "Ruas", "Estacionamento", "Jardim")) else 0.38
        dados = [0.0] * (len(attr.data) * 4)
        attr.data.foreach_get("color", dados)
        # média por vértice (tira o ruído do bake entre os cantos que se encontram) e degraus de 1/40:
        # fica limpo à vista e comprime muito melhor no meshopt
        me = ob.data
        soma, cont = {}, {}
        for lp in me.loops:
            soma[lp.vertex_index] = soma.get(lp.vertex_index, 0.0) + dados[lp.index * 4]
            cont[lp.vertex_index] = cont.get(lp.vertex_index, 0) + 1
        for lp in me.loops:
            ao = soma[lp.vertex_index] / cont[lp.vertex_index]
            v = 1.0 - forca * (1.0 - ao) ** 1.15
            v = round(v * 40) / 40
            dados[lp.index * 4:lp.index * 4 + 4] = [v, v, v, 1.0]
        attr.data.foreach_set("color", dados)


def exportar(objs):
    os.makedirs(SAIDA, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=ARQ_GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_normals=True, export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_materials="EXPORT", export_image_format="NONE",
    )
    with open(ARQ_JSON, "w", encoding="utf-8") as f:
        json.dump(DADOS, f, separators=(",", ":"))


def principal():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    montar()
    objs = para_objetos()
    tri = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in objs)
    print(f"objetos: {len(objs)}, triângulos: {tri}, materiais: {len(bpy.data.materials)}")
    if "--sem-bake" not in sys.argv:
        assar_oclusao(objs)
    exportar(objs)
    print("árvores", len(DADOS["arvores"]), "palmeiras", len(DADOS["palmeiras"]), "carros", len(DADOS["carros"]), "postes", len(DADOS["postes"]))
    print("ok:", ARQ_GLB)


principal()
