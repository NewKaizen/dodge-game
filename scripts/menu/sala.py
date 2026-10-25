#!/usr/bin/env python3
"""Gera a arte da SALA do menu inicial em public/assets/sprites/menu/sala/.

Uso (na raiz do projeto):  python3 scripts/menu/sala.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

A sala é um quarto aconchegante de noite: paredes roxas, varal de luzinhas,
violão, plantas, o gato no criado-mudo ao lado do abajur de estrela, o rack
com a TV, sofá com almofada xadrez e um tapete quadriculado no chão, onde a
turma senta para assistir. É pintada em 427x240 (um pixel de arte = 2x2 na
tela) e ampliada para 854x480 (16:9).

A iluminação é de verdade: pinto o "albedo" (a cor das coisas) e um mapa de
quanto cada ponto recebe da luz do telão; daí saem as camadas:

  fundo.png        854x480  a sala acesa pela luz ambiente quente (abajur,
                            luzinhas) e um restinho do telão
  luz-parede.png   854x480  o que a luz do telão revela na parede e nos móveis
                            (cinza; o jogo pinta com a cor do telão e soma
                            por cima, blend ADD)
  luz-chao.png     854x480  o cone de luz do telão no chão (idem)
  vinheta.png      854x480  preto com transparência: escurece os cantos, o
                            canto do logo e a faixa das opções
  poeira.png       2x2      um grão de poeira (branco) que flutua na luz
  luzinhas.png     854x480  brilho das lâmpadas do varal e do abajur (soma
                            por cima, o jogo faz cintilar)
  frente.png       854x480  primeiro plano, na frente da turma: almofadas,
                            controle e as folhas no canto (já com a luz da sala)

As posições batem com src/game/menu/layout.js (TELA, PES) e com telao.py.
"""

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'menu', 'sala')

L, A = 427, 240  # arte em meia resolução
# TELA de layout.js (404, 52, 410x200) em coordenadas de arte (÷2): área de dentro
TV = (202, 26, 407, 126)  # x0, y0, x1, y1
TV_CX = (TV[0] + TV[2]) / 2
TAMPO = 146  # topo do rack: onde a TV (com a barra de som) está apoiada
# a turma sentada no tapete (TURMA de layout.js ÷ 2): x do centro e base do sprite
TURMA = [(216, 226), (246, 221), (276, 226), (306, 221), (336, 226), (366, 221), (396, 226)]
CHAO = 172
SEED = 7

# ---------- paleta (albedo) ----------
PAREDE_CIMA = (66, 42, 92)
PAREDE_BAIXO = (104, 64, 112)
PAREDE_LISTRA = -7
RODAPE = (112, 70, 58)
RODAPE_LUZ = (150, 100, 78)
RODAPE_ESCURO = (62, 38, 40)
MADEIRA = (128, 82, 60)
MADEIRA_CLARA = (172, 118, 82)
MADEIRA_ESCURA = (70, 42, 44)
MADEIRA_FUNDO = (44, 28, 38)
TABUA = (94, 62, 64)
FRESTA = (48, 30, 40)
METAL = (170, 170, 186)
METAL_ESCURO = (92, 90, 110)
PRETO = (24, 18, 30)
CORDA = (40, 30, 44)
FOLHA = (52, 150, 84)
FOLHA_ESCURA = (28, 98, 66)
FOLHA_CLARA = (110, 200, 112)
VASO = (170, 98, 70)
VASO_ESCURO = (112, 60, 52)
ROXO = (140, 108, 204)
ROXO_ESCURO = (98, 70, 168)
ROXO_LINHA = (196, 168, 240)
LARANJA = (232, 126, 52)
ROSA = (232, 96, 150)
AMARELO = (255, 214, 96)

LAMPADAS = [(255, 214, 120), (255, 170, 90), (255, 232, 160), (255, 140, 120), (255, 200, 110), (170, 230, 255)]

# luz ambiente (multiplica o albedo no fundo): noite quente, mais viva no centro
AMBIENTE = np.array([0.96, 0.84, 0.94])

BRILHO = np.zeros((A, L, 3), np.float32)  # luz própria (abajur, lâmpadas): soma no fundo
LUZINHAS = np.zeros((A, L, 3), np.float32)  # só as lâmpadas do varal (camada que cintila)


def misturar(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def mais(cor, d):
    return tuple(max(0, min(255, c + d)) for c in cor)


def brilho(alvo, cx, cy, raio, cor, forca):
    """Luz redonda que decai suave, somada em `alvo` (em degraus, é pixel art)."""
    x0, x1 = max(0, int(cx - raio)), min(L, int(cx + raio) + 1)
    y0, y1 = max(0, int(cy - raio)), min(A, int(cy + raio) + 1)
    if x0 >= x1 or y0 >= y1:
        return
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / raio
    v = np.clip(1 - d, 0, 1) ** 2 * forca
    v = np.floor(v * 10) / 10  # degraus
    for i in range(3):
        alvo[y0:y1, x0:x1, i] += v * (cor[i] / 255.0)


class Quadro:
    """Albedo (RGB) + receptividade à luz do telão (R: 0 = de costas para a luz,
    1 = normal, >1 = quina virada para a tela que brilha mais)."""

    def __init__(self, modo='RGB'):
        self.img = Image.new(modo, (L, A), PAREDE_BAIXO if modo == 'RGB' else (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.r = Image.new('F', (L, A), 1.0)
        self.dr = ImageDraw.Draw(self.r)

    def ret(self, x0, y0, x1, y1, cor, r=None):
        """Retângulo com x1/y1 inclusivos."""
        if x1 < x0 or y1 < y0:
            return
        self.d.rectangle([x0, y0, x1, y1], fill=cor)
        if r is not None:
            self.dr.rectangle([x0, y0, x1, y1], fill=r)

    def px(self, x, y, cor, r=None):
        x, y = int(x), int(y)
        if 0 <= x < L and 0 <= y < A:
            self.img.putpixel((x, y), cor)
            if r is not None:
                self.r.putpixel((x, y), r)

    def pega(self, x, y):
        return self.img.getpixel((int(x), int(y)))

    def poli(self, pts, cor, r=None):
        self.d.polygon(pts, fill=cor)
        if r is not None:
            self.dr.polygon(pts, fill=r)

    def elipse(self, x0, y0, x1, y1, cor, r=None):
        self.d.ellipse([x0, y0, x1, y1], fill=cor)
        if r is not None:
            self.dr.ellipse([x0, y0, x1, y1], fill=r)

    def linha(self, pts, cor, r=None, largura=1):
        self.d.line(pts, fill=cor, width=largura)
        if r is not None:
            self.dr.line(pts, fill=r, width=largura)


def sombra(q, x0, y0, x1, y1, d=-34):
    """Escurece uma região (sombra projetada) sem apagar o desenho de baixo."""
    for y in range(max(0, y0), min(A, y1 + 1)):
        for x in range(max(0, x0), min(L, x1 + 1)):
            q.img.putpixel((x, y), mais(q.img.getpixel((x, y)), d))


# ---------- parede ----------


def parede(q, rnd):
    for y in range(CHAO):
        t = y / CHAO
        base = misturar(PAREDE_CIMA, PAREDE_BAIXO, t ** 0.8)
        for x in range(L):
            q.img.putpixel((x, y), mais(base, PAREDE_LISTRA if (x // 12) % 2 else 0))
    # granulado (reboco)
    for _ in range(1800):
        x, y = rnd.randrange(L), rnd.randrange(CHAO - 8)
        q.px(x, y, mais(q.pega(x, y), rnd.choice((-7, -4, 4, 6))))
    # moldura do teto
    q.ret(0, 0, L - 1, 1, mais(PAREDE_CIMA, -22))
    q.ret(0, 2, L - 1, 2, mais(PAREDE_CIMA, 10), r=0.7)
    # rodapé de madeira
    q.ret(0, CHAO - 7, L - 1, CHAO - 7, RODAPE_LUZ, r=1.4)
    q.ret(0, CHAO - 6, L - 1, CHAO - 2, RODAPE)
    q.ret(0, CHAO - 6, L - 1, CHAO - 6, mais(RODAPE, 14))
    q.ret(0, CHAO - 1, L - 1, CHAO - 1, RODAPE_ESCURO, r=0.3)


def janela(q, rnd):
    """Janela no canto de cima à direita: o céu da noite com estrelas."""
    x0, y0, x1, y1 = 398, 0, L - 1, 66
    q.ret(x0 - 2, y0, x1, y1 + 2, (74, 46, 60))
    q.ret(x0, y0, x1, y1, (24, 26, 78), r=0.8)
    for y in range(y0, y1 + 1):  # céu: mais claro perto do horizonte
        t = y / y1
        q.ret(x0, y, x1, y, misturar((20, 22, 70), (52, 44, 118), t * t))
    for _ in range(16):
        x, y = rnd.randrange(x0 + 1, x1), rnd.randrange(2, y1 - 6)
        q.px(x, y, rnd.choice(((230, 230, 255), (255, 240, 170), (190, 200, 255))))
    q.px(x0 + 12, 14, (255, 250, 210))
    q.ret(x0 + 11, 13, x0 + 13, 15, (255, 245, 190))
    q.ret(x0 + 12, 12, x0 + 12, 16, (255, 250, 220))
    q.ret(x0 - 2, y1 + 1, x1, y1 + 3, (126, 80, 70), r=1.4)  # peitoril
    # cortina roxa
    q.poli([(x0 - 2, 0), (x0 + 9, 0), (x0 + 6, 70), (x0 - 2, 74)], (118, 70, 140))
    q.poli([(x0 + 2, 0), (x0 + 4, 0), (x0 + 3, 72), (x0 + 1, 72)], (86, 50, 112))
    # prédio longe
    for bx, bh in ((x0 + 14, 14), (x0 + 20, 9), (x0 + 24, 12)):
        q.ret(bx, y1 - bh, bx + 4, y1, (14, 14, 46))
        for wy in range(y1 - bh + 2, y1, 3):
            q.px(bx + 1, wy, (255, 220, 120))


def varal(q, rnd):
    """Varal de lâmpadas quentes no alto da parede (acesas: soma brilho)."""
    vao = 71
    pts = []
    for x in range(0, L + 2, 1):
        seg = x % vao
        y = 4 + 8 * math.sin(math.pi * seg / vao)
        pts.append((x, y))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        q.linha([(x0, y0), (x1, y1)], CORDA, r=0.5)
    for x in range(0, L + vao, vao):  # pregos
        q.ret(x - 1, 2, x + 1, 4, METAL_ESCURO)
    n = 0
    for x in range(6, L, 14):
        seg = x % vao
        y = int(4 + 8 * math.sin(math.pi * seg / vao))
        cor = LAMPADAS[(n * 7) % len(LAMPADAS)]
        n += 1
        q.ret(x - 1, y + 1, x + 1, y + 2, (70, 60, 56))  # soquete
        q.ret(x - 1, y + 3, x + 1, y + 7, mais(cor, -30), r=1.0)
        q.ret(x, y + 3, x, y + 6, cor, r=2.4)
        q.px(x - 1, y + 4, mais(cor, 50), r=3.0)
        q.px(x, y + 8, mais(cor, -60))
        brilho(BRILHO, x, y + 5, 13, cor, 0.6)
        brilho(LUZINHAS, x, y + 5, 17, cor, 0.85)


def quadros(q):
    """Quadros no alto da parede da esquerda: o coração, a águia e fotos."""

    def moldura(x0, y0, x1, y1, fundo, borda=(48, 30, 52)):
        sombra(q, x0 + 2, y0 + 2, x1 + 2, y1 + 2, -26)
        q.ret(x0, y0, x1, y1, borda, r=1.0)
        q.ret(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fundo, r=0.9)
        q.ret(x0, y0, x1, y0, mais(borda, 30), r=1.8)

    # coração
    moldura(8, 12, 32, 44, (150, 60, 120))
    alma = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
    for j, fila in enumerate(alma):
        for i, c in enumerate(fila):
            if c == 'X':
                q.ret(14 + i * 2 - 1, 20 + j * 2, 14 + i * 2, 21 + j * 2, (232, 54, 84), r=1.5)
    q.px(17, 21, (255, 170, 190), r=2.4)
    # águia (rune azul)
    moldura(2, 58, 30, 92, (50, 66, 150))
    asa = [(6, 80), (10, 68), (16, 74), (16, 66), (22, 74), (26, 68), (26, 82), (20, 86), (16, 90), (12, 86)]
    q.poli(asa, (110, 140, 238), r=1.4)
    q.poli([(11, 72), (16, 78), (21, 72), (16, 70)], (150, 176, 255), r=1.8)
    q.px(16, 76, (255, 240, 200), r=2.0)
    # fotinhas
    moldura(38, 70, 56, 92, (220, 188, 132))
    q.poli([(40, 90), (47, 80), (54, 90)], (84, 140, 96))
    q.elipse(48, 73, 53, 78, (255, 238, 150))
    moldura(60, 78, 74, 100, (96, 150, 190))
    q.ret(61, 92, 73, 99, (70, 120, 80))
    q.elipse(64, 82, 70, 88, (255, 255, 255))
    moldura(42, 100, 62, 118, (176, 120, 180))
    q.poli([(44, 116), (52, 105), (60, 116)], (110, 70, 130))


def prateleira(q):
    """Prateleira no alto, à esquerda, com planta pendurada e livros."""
    x0, x1, y = 34, 98, 40
    sombra(q, x0 + 2, y + 2, x1 + 2, y + 6, -28)
    q.ret(x0, y, x1, y + 2, MADEIRA, r=1.0)
    q.ret(x0, y, x1, y, MADEIRA_CLARA, r=1.8)
    q.ret(x0 + 6, y + 3, x0 + 8, y + 5, MADEIRA_ESCURA)
    q.ret(x1 - 8, y + 3, x1 - 6, y + 5, MADEIRA_ESCURA)
    # livros
    for i, (cor, alt) in enumerate(((ROSA, 14), ((70, 110, 190), 12), (AMARELO, 15), ((100, 200, 160), 11))):
        q.ret(x0 + 4 + i * 4, y - alt, x0 + 6 + i * 4, y - 1, cor, r=1.2)
        q.px(x0 + 4 + i * 4, y - alt, mais(cor, 40), r=2.0)
    # vaso com planta caindo
    q.ret(66, y - 9, 80, y - 1, VASO, r=1.0)
    q.ret(66, y - 9, 80, y - 8, mais(VASO, 30), r=1.6)
    q.ret(66, y - 2, 80, y - 1, VASO_ESCURO)
    for fx, fy in ((64, 6), (70, 4), (76, 5), (82, 7)):
        folha_g(q, fx, y - 9 - fy, 4)
    for cx, comp in ((66, 24), (72, 30), (78, 20), (83, 26), (62, 16)):
        for k in range(comp):
            fy = y - 1 + k
            q.px(cx + int(math.sin(k * 0.6) * 1.5), fy, FOLHA_ESCURA)
            if k % 3 == 1:
                q.ret(cx - 1 + int(math.sin(k * 0.6) * 1.5), fy, cx + 1 + int(math.sin(k * 0.6) * 1.5), fy + 1, FOLHA if k % 2 else FOLHA_CLARA, r=1.2)


def folha_g(q, cx, cy, raio):
    q.elipse(cx - raio, cy - raio // 2 - 1, cx + raio, cy + raio // 2 + 1, FOLHA, r=1.1)
    q.px(cx - 1, cy - 1, FOLHA_CLARA, r=2.0)
    q.px(cx + 1, cy, FOLHA_ESCURA)


# ---------- plantas ----------


def folha_larga(q, hx, hy, w, h, ang, cor):
    """Folha de costela-de-adão: gota larga com contorno, nervura e veios."""
    pts, borda = [], []
    for k in range(20):
        a = k / 20 * 2 * math.pi
        px_ = math.cos(a) * w
        py_ = math.sin(a) * h * (1 - 0.3 * math.cos(a))  # mais gorda perto do talo
        for lista, f in ((pts, 1.0), (borda, 1.18)):
            lista.append((hx + (px_ * math.cos(ang) - py_ * math.sin(ang)) * f, hy + (px_ * math.sin(ang) + py_ * math.cos(ang)) * f))
    q.poli(borda, FOLHA_ESCURA, r=0.8)
    q.poli(pts, cor, r=1.1)
    ca, sa = math.cos(ang), math.sin(ang)
    q.linha([(hx - w * 0.9 * ca, hy - w * 0.9 * sa), (hx + w * 0.8 * ca, hy + w * 0.8 * sa)], FOLHA_ESCURA, r=0.7)  # nervura
    for k in (-0.45, 0.0, 0.45):  # veios (os recortes da folha)
        bx, by = hx + w * k * ca, hy + w * k * sa
        for lado in (-1, 1):
            q.linha([(bx, by), (bx - lado * h * 0.8 * sa + w * 0.18 * ca, by + lado * h * 0.8 * ca + w * 0.18 * sa)], mais(cor, -34), r=0.8)
    # brilho do lado de cima
    q.linha([(hx - w * 0.5 * ca - h * 0.45 * sa, hy - w * 0.5 * sa + h * 0.45 * ca * -1), (hx + w * 0.2 * ca - h * 0.5 * sa, hy + w * 0.2 * sa - h * 0.5 * ca)], FOLHA_CLARA, r=2.2)


def monstera(q, cx, base, altura, espalho, vaso=True, flip=1, n=8):
    """Planta cheia de folhas largas saindo de um vaso (ou do canto da tela)."""
    rnd = random.Random(int(cx * 7 + base))
    folhas = []
    for i in range(n):
        t = i / (n - 1)
        ang = (-1.1 + 2.2 * t) * flip
        comp = altura * (0.55 + 0.45 * math.cos((t - 0.5) * 2.0)) * rnd.uniform(0.85, 1.05)
        hx = cx + math.sin(ang) * espalho * rnd.uniform(0.75, 1.0)
        hy = base - 4 - math.cos(ang) * comp
        folhas.append((comp, hx, hy, ang, i))
    for comp, hx, hy, ang, i in sorted(folhas, key=lambda f: f[0]):  # as mais altas atrás
        q.linha([(cx, base - 4), ((cx + hx) / 2, hy + comp * 0.35), (hx, hy + 5)], FOLHA_ESCURA, r=0.9, largura=2)
        w, h = 12 + (i % 3) * 2, 8 + (i % 2) * 2
        folha_larga(q, hx, hy, w, h, ang * 0.8 + (0.5 if ang > 0 else -0.5), FOLHA if i % 2 else mais(FOLHA, -12))
    if vaso:
        q.poli([(cx - 10, base - 6), (cx + 10, base - 6), (cx + 8, base + 7), (cx - 8, base + 7)], VASO, r=1.0)
        q.ret(cx - 11, base - 8, cx + 11, base - 5, mais(VASO, 26), r=1.7)
        q.ret(cx - 8, base + 5, cx + 8, base + 7, VASO_ESCURO)
        q.ret(cx + 5, base - 4, cx + 7, base + 4, mais(VASO, -22))


def planta_direita(q):
    monstera(q, 420, 148, 62, 40, vaso=False, flip=-1)


def planta_esquerda(q):
    monstera(q, 188, 160, 54, 38, vaso=True)


# ---------- móveis ----------


def criado_mudo(q):
    """Mesinha com o gato, o abajur de estrela, livros e uma caneca com coração."""
    x0, x1, topo = 94, 168, 128
    sombra(q, x0 - 3, topo, x1 + 3, CHAO, -30)
    q.ret(x0 - 2, topo - 2, x1 + 2, topo, MADEIRA_CLARA, r=1.8)
    q.ret(x0 - 2, topo + 1, x1 + 2, topo + 1, MADEIRA_ESCURA, r=0.4)
    q.ret(x0, topo + 2, x1, CHAO - 5, MADEIRA)
    q.ret(x0, topo + 2, x0 + 1, CHAO - 5, mais(MADEIRA, -16))
    for gy in (topo + 5, topo + 22):  # gavetas
        q.ret(x0 + 4, gy, x1 - 4, gy + 14, MADEIRA_ESCURA, r=0.5)
        q.ret(x0 + 5, gy + 1, x1 - 5, gy + 13, mais(MADEIRA, 6), r=0.9)
        q.ret(x0 + 5, gy + 1, x1 - 5, gy + 1, MADEIRA_CLARA, r=1.2)
        q.ret((x0 + x1) // 2 - 3, gy + 7, (x0 + x1) // 2 + 3, gy + 8, AMARELO, r=1.8)
    for x in (x0 + 1, x1 - 3):  # pés
        q.ret(x, CHAO - 5, x + 2, CHAO - 1, MADEIRA_ESCURA)

    # livros empilhados
    for i, (cor, larg) in enumerate(((ROSA, 14), ((70, 110, 190), 12), (AMARELO, 13))):
        y = topo - 3 - i * 4
        q.ret(x0 + 3, y - 3, x0 + 3 + larg, y, cor, r=1.2)
        q.ret(x0 + 3, y - 3, x0 + 3 + larg, y - 3, mais(cor, 40), r=2.0)
        q.ret(x0 + 3, y - 1, x0 + 3 + larg, y - 1, mais(cor, -50))
    # gato branco sentado, de frente
    gx, gy = 122, topo - 1
    cor, esc, rosa = (240, 232, 244), (190, 178, 202), (244, 150, 180)
    q.elipse(gx - 8, gy - 16, gx + 8, gy, esc, r=1.0)  # corpo
    q.elipse(gx - 7, gy - 16, gx + 7, gy - 1, cor, r=1.1)
    q.elipse(gx - 7, gy - 24, gx + 7, gy - 10, esc, r=1.0)  # cabeça
    q.elipse(gx - 6, gy - 24, gx + 6, gy - 11, cor, r=1.4)
    q.poli([(gx - 7, gy - 19), (gx - 6, gy - 28), (gx - 2, gy - 23)], cor, r=1.4)  # orelhas
    q.poli([(gx + 7, gy - 19), (gx + 6, gy - 28), (gx + 2, gy - 23)], cor, r=1.4)
    q.px(gx - 6, gy - 25, rosa, r=1.6)
    q.px(gx + 6, gy - 25, rosa, r=1.6)
    q.ret(gx - 4, gy - 18, gx - 3, gy - 16, (30, 24, 40), r=0.8)  # olhos
    q.ret(gx + 3, gy - 18, gx + 4, gy - 16, (30, 24, 40), r=0.8)
    q.px(gx, gy - 15, rosa, r=1.2)  # nariz
    q.px(gx - 1, gy - 14, (120, 90, 110))
    q.px(gx + 1, gy - 14, (120, 90, 110))
    q.ret(gx - 5, gy - 2, gx - 3, gy, esc)  # patinhas
    q.ret(gx + 3, gy - 2, gx + 5, gy, esc)
    q.linha([(gx + 8, gy - 4), (gx + 13, gy - 8), (gx + 12, gy - 14)], esc, r=1.0, largura=2)  # rabo
    q.px(gx - 7, gy - 8, (210, 170, 150))  # mancha caramelo
    q.ret(gx - 6, gy - 9, gx - 4, gy - 7, (222, 178, 140), r=1.0)

    # abajur de estrela
    ax = 148
    q.ret(ax - 6, topo - 3, ax + 6, topo - 1, (120, 76, 70), r=1.0)
    q.ret(ax - 1, topo - 14, ax + 1, topo - 4, (190, 140, 80), r=1.4)
    q.poli([(ax - 7, topo - 14), (ax + 7, topo - 14), (ax + 11, topo - 28), (ax - 11, topo - 28)], (255, 200, 96), r=1.2)
    q.poli([(ax - 7, topo - 14), (ax - 3, topo - 14), (ax - 5, topo - 28), (ax - 11, topo - 28)], (232, 160, 70), r=1.0)
    q.ret(ax - 11, topo - 29, ax + 11, topo - 28, (255, 232, 150), r=2.0)
    # estrela acesa na frente da cúpula (é o que dá a luz quente do canto)
    estrela = ['....X....', '...XXX...', '...XXX...', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '..XXXXX..', '.XXX.XXX.', '.XX...XX.']
    for j, fila in enumerate(estrela):
        for i, c in enumerate(fila):
            if c == 'X':
                borda = j in (0, 3, 8) or i in (0, 8) or (fila[i - 1] if i else '.') == '.' or (fila[i + 1] if i < 8 else '.') == '.'
                q.px(ax - 4 + i, topo - 38 + j, (255, 196, 80) if borda else (255, 250, 200), r=2.4)
    brilho(BRILHO, ax, topo - 26, 46, (255, 170, 70), 0.5)
    brilho(BRILHO, ax, topo - 34, 14, (255, 225, 150), 0.35)
    brilho(LUZINHAS, ax, topo - 30, 24, (255, 200, 110), 0.5)
    # caneca com coração
    mx = 162
    q.ret(mx - 5, topo - 11, mx + 4, topo - 1, (246, 240, 248), r=1.3)
    q.ret(mx - 5, topo - 11, mx - 4, topo - 1, (206, 198, 214))
    q.ret(mx + 4, topo - 9, mx + 7, topo - 4, (246, 240, 248), r=1.2)  # alça
    q.ret(mx + 5, topo - 8, mx + 5, topo - 5, MADEIRA_FUNDO)
    q.px(mx - 3, topo - 8, (230, 54, 84), r=1.6)
    q.px(mx - 1, topo - 8, (230, 54, 84), r=1.6)
    q.ret(mx - 3, topo - 7, mx - 1, topo - 7, (230, 54, 84), r=1.6)
    q.px(mx - 2, topo - 6, (230, 54, 84), r=1.6)
    q.ret(mx - 5, topo - 11, mx + 4, topo - 11, (255, 255, 255), r=2.4)


def rack(q, rnd):
    """Móvel baixo onde a TV está apoiada: prateleiras com livros e o videogame."""
    x0, x1 = 176, L - 1
    sombra(q, x0 - 3, TAMPO - 2, x1, CHAO, -30)
    q.ret(x0 - 3, TAMPO - 1, x1, TAMPO + 1, MADEIRA_CLARA, r=1.8)
    q.ret(x0 - 3, TAMPO + 2, x1, TAMPO + 2, MADEIRA_ESCURA, r=0.4)
    q.ret(x0, TAMPO + 3, x1, CHAO - 5, MADEIRA)
    for x in (x0 + 1, x1 - 3):
        q.ret(x, CHAO - 5, x + 2, CHAO - 1, MADEIRA_ESCURA)
    # três vãos separados por montantes
    vaos = [(x0 + 4, 230), (236, 326), (332, x1 - 4)]
    for i, (a, b) in enumerate(vaos):
        q.ret(a, TAMPO + 6, b, CHAO - 8, MADEIRA_FUNDO, r=0.5)
        q.ret(a, TAMPO + 6, b, TAMPO + 7, mais(MADEIRA_FUNDO, -12), r=0.4)  # sombra do tampo
        q.ret(a, CHAO - 9, b, CHAO - 8, MADEIRA_CLARA, r=1.4)
    # vão 1: livros em pé
    a, b = vaos[0]
    cores = [ROSA, (80, 120, 200), AMARELO, (110, 200, 150), LARANJA, ROXO, (230, 230, 240)]
    x = a + 3
    for k in range(10):
        alt = 13 + (k * 5) % 6
        cor = cores[k % len(cores)]
        q.ret(x, CHAO - 9 - alt, x + 2, CHAO - 10, cor, r=1.2)
        q.ret(x, CHAO - 9 - alt, x, CHAO - 10, mais(cor, 36), r=1.8)
        q.px(x + 1, CHAO - 9 - alt + 3, mais(cor, -50))
        x += 3 + (k % 2)
        if x > b - 8:
            break
    # vão 2: gavetas fechadas (frente de madeira por cima do vão)
    a, b = vaos[1]
    q.ret(a, TAMPO + 6, b, CHAO - 8, MADEIRA, r=1.0)
    q.ret(a, TAMPO + 6, b, TAMPO + 6, MADEIRA_CLARA, r=1.4)
    q.ret(a, (TAMPO + CHAO) // 2 - 1, b, (TAMPO + CHAO) // 2 - 1, MADEIRA_ESCURA, r=0.5)
    for cx in ((a + b) // 2,):
        q.ret(cx - 4, TAMPO + 13, cx + 4, TAMPO + 14, AMARELO, r=1.8)
    # vão 3: videogame com a luzinha acesa e controles
    a, b = vaos[2]
    q.ret(a + 8, CHAO - 17, a + 52, CHAO - 10, (214, 210, 220), r=1.2)
    q.ret(a + 8, CHAO - 17, a + 52, CHAO - 17, (255, 255, 255), r=2.2)
    q.ret(a + 10, CHAO - 14, a + 34, CHAO - 13, (80, 76, 96))
    q.ret(a + 44, CHAO - 15, a + 48, CHAO - 14, (60, 220, 130), r=2.4)
    brilho(BRILHO, a + 46, CHAO - 14, 6, (60, 220, 130), 0.5)
    q.ret(a + 60, CHAO - 16, a + 70, CHAO - 10, (90, 84, 110), r=1.2)
    q.ret(a + 74, CHAO - 15, a + 80, CHAO - 10, (190, 90, 110), r=1.2)


def tv_apoio(q):
    """Sombra do pé da TV no rack e o fio descendo para trás."""
    q.ret(TV_CX - 60, TAMPO - 2, TV_CX + 60, TAMPO - 1, mais(MADEIRA_CLARA, -50))


def violao(q):
    """Violão encostado na parede, no canto de baixo à esquerda."""
    sombra(q, 6, 84, 52, CHAO, -22)
    cor, esc, clr = (212, 124, 56), (118, 62, 40), (250, 176, 100)
    q.elipse(4, 138, 40, 178, esc)
    q.elipse(5, 139, 39, 177, cor, r=1.0)
    q.elipse(10, 118, 36, 148, esc)
    q.elipse(11, 119, 35, 147, cor, r=1.0)
    q.elipse(17, 138, 28, 150, PRETO, r=0.2)  # boca
    q.elipse(18, 139, 27, 149, (60, 34, 40), r=0.3)
    q.ret(15, 164, 29, 166, esc)  # cavalete
    for y in range(120, 176):  # borda de luz
        for x in range(40, 4, -1):
            if q.pega(x, y) == cor:
                q.px(x, y, clr, r=2.0)
                break
    # braço
    for y in range(70, 122):
        x = 23 - (122 - y) * 0.03
        q.ret(int(x) - 2, y, int(x) + 2, y, (96, 56, 44), r=1.0)
        q.px(int(x) + 2, y, (140, 90, 70), r=2.0)
        if y % 6 == 0:
            q.ret(int(x) - 2, y, int(x) + 2, y, METAL, r=1.4)  # trastes
    q.ret(19, 56, 27, 70, (70, 40, 40), r=1.0)  # mão
    for y in (58, 62, 66):
        q.px(17, y, METAL, r=1.2)
        q.px(29, y, METAL, r=1.8)
    q.linha([(22, 72), (22, 164)], (230, 224, 220), r=0.8)
    # adesivos: coração rosa, bolinha azul, estrela amarela
    q.ret(14, 124, 18, 125, ROSA, r=1.6)
    q.ret(13, 125, 19, 127, ROSA, r=1.6)
    q.ret(14, 128, 18, 128, ROSA, r=1.6)
    q.px(16, 129, ROSA, r=1.6)
    q.elipse(26, 130, 31, 135, (70, 110, 220), r=1.5)
    q.ret(11, 150, 13, 156, AMARELO, r=1.8)
    q.ret(9, 152, 15, 154, AMARELO, r=1.8)
    q.elipse(24, 150, 30, 156, (70, 110, 220), r=1.5)
    q.elipse(30, 160, 36, 166, ROSA, r=1.5)
    q.px(32, 162, (255, 220, 230), r=2.2)


# ---------- chão ----------

PF = (TV_CX, 60)  # ponto de fuga das tábuas


def no_chao(x0, y):
    """x da linha de tábua que nasce em x0 no rodapé, na altura y (perspectiva)."""
    return PF[0] + (x0 - PF[0]) * (y - PF[1]) / (CHAO - PF[1])


def chao(q, rnd):
    larg = 13
    for y in range(CHAO, A):
        for x in range(L):
            u = PF[0] + (x - PF[0]) * (CHAO - PF[1]) / (y - PF[1])
            i = int((u + 900) // larg)
            c = mais(TABUA, ((i * 37) % 5 - 2) * 3)
            fu = (u + 900) % larg
            if int(fu * 3) % 7 == 0 and (y + i) % 4 != 0:
                c = mais(c, -6)
            q.img.putpixel((x, y), c)
    for b in range(-900, 1400, larg):
        for y in range(CHAO, A):
            x = no_chao(b, y)
            if -1 <= x <= L:
                q.px(round(x), y, FRESTA, r=0.4)
    # sombra que o rack faz no chão
    for y in range(CHAO, CHAO + 8):
        t = (y - CHAO) / 8
        for x in range(L):
            q.px(x, y, mais(q.pega(x, y), int(-26 * (1 - t))))


def tapete(q):
    """Tapete xadrez grande (vinho, roxo e laranja) na frente da TV."""
    ya = CHAO + 5
    K = 2200

    def limites(y):
        return no_chao(TV_CX - 330, y), no_chao(TV_CX + 330, y)

    for y in range(ya, A):
        xa, xb = limites(y)
        v = K / (y - PF[1])
        for x in range(max(0, int(math.ceil(xa))), min(L, int(xb) + 1)):
            u = (x - PF[0]) * (CHAO - PF[1]) / (y - PF[1])
            i, j = int(math.floor((u + 600) / 22)), int(math.floor(v / 2.4))
            fu, fv = ((u + 600) % 22) / 22, (v / 2.4) % 1
            c = (126, 54, 112) if (i + j) % 2 else (88, 42, 100)
            faixa_u = i % 2 == 0 and 0.36 < fu < 0.64
            faixa_v = j % 2 == 0 and 0.36 < fv < 0.64
            if faixa_u and faixa_v:
                c = (246, 150, 70)  # cruzamento das faixas: mais claro
            elif faixa_u or faixa_v:
                c = misturar(c, LARANJA, 0.7)
            if 0.48 < fu < 0.52 or 0.47 < fv < 0.53:
                c = misturar(c, (255, 206, 120), 0.6)  # fio amarelo no meio
            elif fu < 0.05 or fv < 0.05:
                c = mais(c, -16)
            q.img.putpixel((x, y), c)
            q.r.putpixel((x, y), 1.15)
        for x in (int(xa), int(xa) + 1, int(xb) - 1, int(xb)):  # borda
            q.px(x, y, (60, 30, 66), r=0.9)
    xa, xb = limites(ya)
    q.linha([(xa, ya), (xb, ya)], (60, 30, 66), r=1.2)


def almofada(q, cx, cy, rx, ry, cor, estrela=False):
    """Almofada redonda e fofa vista de cima, com sombra no chão."""
    q.elipse(cx - rx - 2, cy - ry + 3, cx + rx + 2, cy + ry + 3, (30, 16, 34))  # sombra
    q.elipse(cx - rx, cy - ry, cx + rx, cy + ry, mais(cor, -46), r=1.0)
    q.elipse(cx - rx + 1, cy - ry, cx + rx - 1, cy + ry - 3, cor, r=1.3)
    q.elipse(cx - rx + rx // 3, cy - ry + 2, cx + rx - rx // 3, cy + ry - ry, mais(cor, 24), r=1.8)
    q.linha([(cx - rx + 3, cy - 1), (cx + rx - 3, cy - 1)], mais(cor, -24), r=0.8)  # costura
    if estrela:
        for j, fila in enumerate(['..X..', 'XXXXX', '.XXX.', '.X.X.']):
            for i, c in enumerate(fila):
                if c == 'X':
                    q.px(cx - 2 + i, cy - 5 + j, (255, 240, 170), r=2.0)


ASSENTOS = [(120, 86, 200), (214, 70, 120), LARANJA, (92, 160, 200), (214, 70, 120), (120, 86, 200), (232, 160, 70)]


def assentos(q):
    """A almofada em que cada um da turma está sentado (aparece dos lados)."""
    for (x, y), cor in zip(TURMA, ASSENTOS):
        almofada(q, x, y - 1, 16, 5, cor)


def sofa(q):
    """Sofá roxo no canto de baixo, à esquerda do tapete, com almofada xadrez gigante."""
    dx, dy = 44, 8
    q.elipse(dx - 20, 214 + dy, dx + 104, 250 + dy, (34, 20, 44))  # sombra
    corpo = [(dx - 10, 248), (dx - 8, 176 + dy), (dx + 2, 166 + dy), (dx + 34, 160 + dy), (dx + 74, 164 + dy), (dx + 92, 176 + dy), (dx + 100, 248)]
    q.poli(corpo, (82, 56, 128), r=0.9)
    q.poli([(dx - 4, 180 + dy), (dx + 4, 170 + dy), (dx + 36, 164 + dy), (dx + 72, 168 + dy), (dx + 86, 178 + dy), (dx + 50, 186 + dy), (dx + 14, 186 + dy)], (120, 88, 176), r=1.2)
    q.linha([(dx + 4, 170 + dy), (dx + 36, 164 + dy), (dx + 72, 168 + dy), (dx + 86, 178 + dy)], (170, 140, 224), r=2.4)
    for bx in (dx + 16, dx + 40, dx + 64):  # botões do capitonê
        q.px(bx, 176 + dy, (62, 40, 100))
    # almofada xadrez (tartan) inclinada, estufada no meio
    cx, cy, lado, giro = dx + 56, 194 + dy, 22, 0.32
    ca, sa = math.cos(giro), math.sin(giro)
    for y in range(int(cy - lado * 1.5), int(cy + lado * 1.5)):
        for x in range(int(cx - lado * 1.5), int(cx + lado * 1.5)):
            u = (x - cx) * ca + (y - cy) * sa
            v = -(x - cx) * sa + (y - cy) * ca
            r4 = (abs(u) / lado) ** 3 + (abs(v) / lado) ** 3
            if r4 > 1.12:
                continue
            if r4 > 1.0:
                q.px(x, y, (52, 32, 92), r=0.6)  # contorno
                continue
            bu, bv = int((u + 60) // 7), int((v + 60) // 7)
            c = (124, 68, 168)
            if bu % 2 == 0:
                c = mais(c, 16)
            if bv % 2 == 0:
                c = mais(c, 16)
            fu, fv = (u + 60) % 14, (v + 60) % 14
            if fu < 1 or fv < 1:
                c = (236, 120, 176)  # fio rosa
            elif 6.5 < fu < 7.5 or 6.5 < fv < 7.5:
                c = (150, 130, 236)  # fio lilás
            c = mais(c, int(-30 * r4 + 18 * max(0.0, -(u + v) / lado)))  # estufada: borda escura, quina de cima clara
            q.px(x, y, c, r=1.2)


def copo_boba(q):
    """Copo de chá de bolha com canudo, no chão ao lado do sofá."""
    x, y = 188, 207
    q.elipse(x - 8, y + 20, x + 10, y + 26, (30, 18, 36))
    q.poli([(x - 8, y), (x + 8, y), (x + 6, y + 22), (x - 6, y + 22)], (255, 210, 120), r=1.2)  # chá
    q.poli([(x - 8, y), (x - 3, y), (x - 3, y + 22), (x - 6, y + 22)], (255, 238, 190), r=1.8)
    q.ret(x - 9, y - 2, x + 9, y, (246, 240, 250), r=1.8)  # tampa
    q.linha([(x + 2, y - 2), (x + 6, y - 16)], (255, 120, 170), r=1.8, largura=2)  # canudo
    for bx, by in ((x - 4, y + 18), (x - 1, y + 19), (x + 2, y + 18), (x + 4, y + 20), (x - 3, y + 15), (x, y + 16)):
        q.ret(bx, by, bx + 1, by + 1, (60, 38, 40), r=0.6)
    q.px(x - 2, y + 4, (255, 255, 255), r=2.4)


def controle(q, x=286, y=229):
    """Controle de videogame no chão, com o fio enrolado indo até o rack."""
    q.elipse(x - 12, y + 6, x + 14, y + 12, (34, 22, 40))
    q.ret(x - 11, y - 1, x + 11, y + 6, (232, 228, 244), r=1.4)
    q.ret(x - 11, y - 1, x + 11, y - 1, (255, 255, 255), r=2.4)
    q.ret(x - 14, y + 1, x - 11, y + 8, (214, 210, 230), r=1.3)
    q.ret(x + 11, y + 1, x + 14, y + 8, (214, 210, 230), r=1.3)
    q.ret(x - 8, y + 1, x - 4, y + 2, (70, 64, 90))
    q.px(x - 6, y, (70, 64, 90))
    q.px(x - 6, y + 3, (70, 64, 90))
    q.px(x + 5, y + 1, (232, 80, 110), r=1.8)
    q.px(x + 7, y + 3, (90, 130, 240), r=1.8)
    pts = [(x - 11, y + 3)]  # fio sinuoso, sai pela esquerda
    for k in range(1, 22):
        pts.append((x - 11 - k * 2.2, y + 3 + math.sin(k * 0.6) * 2.5 + k * 0.3))
    q.linha(pts, (60, 54, 80), r=0.6)


def primeiro_plano(q):
    """O que fica na frente da turma: almofadas, o controle e folhas no canto."""
    almofada(q, 232, 236, 24, 7, (196, 92, 176))
    almofada(q, 326, 238, 22, 7, LARANJA, estrela=True)
    almofada(q, 392, 239, 20, 6, (222, 74, 116))
    controle(q, 280, 229)
    # folhagem no canto de baixo à direita (bem perto da câmera, meio escura)
    for hx, hy, w, h, ang in ((428, 204, 15, 9, -2.0), (424, 222, 14, 8, -2.6), (430, 232, 13, 7, -1.9)):
        folha_larga(q, hx, hy, w, h, ang, mais(FOLHA, -26))
    # e um ramo no canto de baixo à esquerda
    for hx, hy, w, h, ang in ((6, 228, 13, 7, -0.4), (18, 238, 12, 6, -0.2)):
        folha_larga(q, hx, hy, w, h, ang, mais(FOLHA, -30))


# ---------- luz do telão ----------


def campo_de_luz():
    """Quanto da luz do telão chega a cada pixel (0..~1), antes da receptividade."""
    ys, xs = np.mgrid[0:A, 0:L].astype(np.float32)
    x0, y0, x1, y1 = TV[0] - 4, TV[1] - 4, TV[2] + 4, TV[3] + 4  # com a moldura
    dx = np.maximum(np.maximum(x0 - xs, 0), xs - x1)
    dy = np.maximum(np.maximum(y0 - ys, 0), ys - y1)
    d = np.sqrt(dx * dx + dy * dy)
    parede = 0.95 * np.exp(-d / 18) + 0.28 * np.exp(-d / 80)
    t = (ys - CHAO) / (A - CHAO)
    abre = 1 + 0.9 * t
    meia = (TV[2] - TV[0]) / 2
    rel = np.abs(xs - TV_CX) / (meia * abre)
    cone = np.where(rel < 1.0, 0.62, 0.0) + np.where(rel < 0.78, 0.16, 0.0)
    cone *= 1.0 - 0.38 * t
    esp = 0.2 * np.exp(-np.maximum(rel - 1, 0) * 2.2) * (1 - 0.4 * t)
    chao = np.maximum(cone, esp)
    return np.where(ys < CHAO, parede, chao).astype(np.float32)


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16.0 - 0.47


def quantizar(v, passos, pontilhar=True):
    """Reduz a degraus; com pontilhado ordenado (Bayer 4x4) nas transições."""
    if pontilhar:
        h, w = v.shape
        b = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
        return np.clip(np.round(v * passos + b), 0, passos) / passos
    return np.round(v * passos) / passos


def ampliar(arr):
    return np.repeat(np.repeat(arr, 2, axis=0), 2, axis=1)


def salvar(arr, nome, modo):
    img = Image.fromarray(ampliar(arr).astype(np.uint8), modo)
    img.save(os.path.join(SAIDA, nome), optimize=True)


def vinheta():
    ys, xs = np.mgrid[0:A, 0:L].astype(np.float32)
    nx, ny = xs / L, ys / A
    # cantos (elipse) + canto do logo + faixa das opções (esquerda)
    borda = np.clip((np.sqrt(((nx - 0.55) / 0.8) ** 2 + ((ny - 0.5) / 0.78) ** 2) - 0.66) / 0.5, 0, 1)
    logo = np.exp(-(((xs - 78) / 85) ** 2 + ((ys - 52) / 62) ** 2))
    opcoes = np.exp(-(((xs - 78) / 90) ** 2 + ((ys - 172) / 38) ** 2))
    a = np.clip(0.62 * borda + 0.3 * logo + 0.32 * opcoes, 0, 0.7)
    a = np.clip(quantizar(a, 12), 0, 0.7)
    out = np.zeros((A, L, 4), np.float32)
    out[..., 3] = a * 255
    return out


def main():
    os.makedirs(SAIDA, exist_ok=True)
    rnd = random.Random(SEED)
    q = Quadro()
    parede(q, rnd)
    janela(q, rnd)
    chao(q, rnd)
    tapete(q)
    quadros(q)
    prateleira(q)
    planta_direita(q)
    rack(q, rnd)
    tv_apoio(q)
    planta_esquerda(q)
    criado_mudo(q)
    violao(q)
    varal(q, rnd)
    assentos(q)
    sofa(q)
    copo_boba(q)

    alb = np.asarray(q.img, np.float32)
    rec = np.asarray(q.r, np.float32)
    campo = campo_de_luz()

    # fundo: albedo na luz ambiente quente (+ o telão, sempre ligado) + luz própria
    amb = AMBIENTE[None, None, :] * (0.78 + 0.3 * campo[..., None])
    # brilho quente no chão, na frente da TV
    ys, xs = np.mgrid[0:A, 0:L].astype(np.float32)
    quente = np.exp(-(((xs - TV_CX) / 120) ** 2 + ((ys - 205) / 40) ** 2))
    fundo = alb * amb + BRILHO * 255 * 0.9
    fundo += quente[..., None] * np.array([70, 34, 14], np.float32)
    fundo = np.clip(fundo, 0, 255)
    salvar(fundo, 'fundo.png', 'RGB')

    # primeiro plano: mesma luz da sala (ambiente + o calor da frente da TV), com transparência
    f = Quadro('RGBA')
    primeiro_plano(f)
    fa = np.asarray(f.img, np.float32)
    frente = np.zeros_like(fa)
    frente[..., :3] = np.clip(fa[..., :3] * amb * 0.92 + quente[..., None] * np.array([40, 20, 8], np.float32), 0, 255)
    frente[..., 3] = fa[..., 3]
    salvar(frente, 'frente.png', 'RGBA')

    # luz do telão: luminância do albedo x campo x receptividade, em degraus
    lum = alb @ np.array([0.3, 0.5, 0.2], np.float32) / 255.0
    ganho = np.where(ys < CHAO, 0.8, 0.55)
    luz = np.clip(lum * campo * rec * ganho, 0, 1)
    luz = quantizar(luz, 16)
    for nome, mascara in (('luz-parede.png', ys < CHAO), ('luz-chao.png', ys >= CHAO)):
        v = np.where(mascara, luz, 0) * 255
        rgba = np.zeros((A, L, 4), np.float32)
        rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = v
        rgba[..., 3] = np.where(v > 0, 255, 0)
        salvar(rgba, nome, 'RGBA')

    # lâmpadas do varal: cor própria, soma por cima (o jogo cintila)
    lz = np.clip(LUZINHAS * 255, 0, 255)
    rgba = np.zeros((A, L, 4), np.float32)
    rgba[..., :3] = lz
    rgba[..., 3] = 255
    salvar(rgba, 'luzinhas.png', 'RGBA')

    salvar(vinheta(), 'vinheta.png', 'RGBA')

    grao = np.zeros((1, 1, 4), np.float32) + 255
    Image.fromarray(ampliar(grao).astype(np.uint8), 'RGBA').save(os.path.join(SAIDA, 'poeira.png'))
    print('ok:', SAIDA)


if __name__ == '__main__':
    main()
