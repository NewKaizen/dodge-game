#!/usr/bin/env python3
"""Gera a arte do QUARTO do menu inicial em public/assets/sprites/menu/sala/.

Uso (na raiz do projeto):  python3 scripts/menu/sala.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

O quarto é pintado em 320x240 (um pixel de arte = 2x2 na tela) e ampliado
para 640x480. A ideia é de iluminação de verdade: pinto o "albedo" (a cor das
coisas sob luz branca) e um mapa de quanto cada ponto recebe da luz do telão;
daí saem duas camadas:

  fundo.png        640x480  o quarto na penumbra (só a luz ambiente, azul-marinho)
  luz-parede.png   640x480  o que a luz do telão revela na parede e nos móveis
                            encostados nela (cinza; o jogo pinta com a cor do
                            telão e soma por cima, blend ADD)
  luz-chao.png     640x480  o cone de luz no chão (tapete, tábuas, pufe) (idem)
  vinheta.png      640x480  preto com transparência: escurece os cantos, o
                            canto do logo e a faixa das opções
  poeira.png       2x2      um grão de poeira (branco) que flutua na luz

As posições batem com src/game/menu/layout.js (TELA, CHAO, PES).
"""

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'menu', 'sala')

L, A = 320, 240  # arte em meia resolução
# layout.js em coordenadas de arte (÷2)
TV = (150, 23, 305, 121)  # x0, y0, x1, y1 (área de dentro do telão)
TV_CX = (TV[0] + TV[2]) / 2
CHAO = 165
SEED = 7

# ---------- paleta (albedo: como as coisas seriam sob luz branca) ----------
PAREDE = (74, 88, 104)
PAREDE_LISTRA = (66, 80, 96)
PAREDE_FLOR = (84, 98, 114)
LAMBRI = (58, 68, 84)
LAMBRI_CLARO = (92, 106, 122)
LAMBRI_ESCURO = (36, 44, 58)
RODAPE = (84, 96, 112)
RODAPE_ESCURO = (40, 48, 60)
TABUA = (80, 82, 92)
FRESTA = (34, 38, 48)
TAPETE = (82, 70, 96)
TAPETE_BORDA = (56, 48, 72)
TAPETE_DESENHO = (108, 92, 120)
TAPETE_FRANJA = (120, 112, 120)
MADEIRA = (66, 56, 62)
MADEIRA_CLARA = (104, 92, 96)
MADEIRA_ESCURA = (36, 30, 38)
METAL = (130, 136, 148)
METAL_ESCURO = (70, 74, 86)
CABO = (78, 56, 46)
CARTA = (168, 168, 172)
CARTA_VERSO = (110, 60, 80)
PRETO = (20, 22, 30)
TECIDO = (70, 60, 84)
TECIDO_CLARO = (96, 84, 110)
CORDA = (40, 40, 48)
LAMPADA = (150, 150, 140)
CAIXA = (42, 44, 54)
CAIXA_CONE = (26, 28, 36)

# luz ambiente (multiplica o albedo no fundo): penumbra azul-petróleo
AMBIENTE = np.array([0.24, 0.31, 0.40])


def misturar(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def mais(cor, d):
    return tuple(max(0, min(255, c + d)) for c in cor)


class Quadro:
    """Albedo (RGB) + receptividade à luz do telão (R: 0 = de costas para a luz,
    1 = normal, >1 = quina virada para a tela que brilha mais)."""

    def __init__(self):
        self.img = Image.new('RGB', (L, A), PAREDE)
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


# ---------- parede ----------


def parede(q, rnd):
    # papel de parede: listras verticais largas + um florzinha (losango) bem apagado
    for x in range(L):
        faixa = (x // 10) % 2
        for y in range(CHAO):
            q.img.putpixel((x, y), PAREDE_LISTRA if faixa else PAREDE)
    for cy in range(6, 128, 14):
        for cx in range(5 + (cy // 14 % 2) * 10, L, 20):
            for dx, dy in ((0, -2), (-1, -1), (1, -1), (-2, 0), (2, 0), (-1, 1), (1, 1), (0, 2), (0, 0)):
                if (dx, dy) == (0, 0):
                    q.px(cx, cy, mais(PAREDE_FLOR, 8))
                elif abs(dx) + abs(dy) == 2:
                    q.px(cx + dx, cy + dy, PAREDE_FLOR)
    # granulado (desgaste)
    for _ in range(900):
        x, y = rnd.randrange(L), rnd.randrange(CHAO - 30)
        c = q.img.getpixel((x, y))
        q.img.putpixel((x, y), mais(c, rnd.choice((-6, -4, 4))))
    # moldura do teto: uma faixa escura em cima
    q.ret(0, 0, L - 1, 2, mais(PAREDE, -30))
    q.ret(0, 3, L - 1, 3, mais(PAREDE, 6), r=0.6)
    # lambri (meia parede de painéis) e roda-meio
    topo = 134
    q.ret(0, topo - 2, L - 1, topo - 1, LAMBRI_CLARO, r=1.4)
    q.ret(0, topo, L - 1, topo, LAMBRI_ESCURO, r=0.3)
    q.ret(0, topo + 1, L - 1, CHAO - 7, LAMBRI)
    for x0 in range(-6, L, 30):
        x1 = x0 + 25
        q.ret(x0 + 1, topo + 4, x1, topo + 4, LAMBRI_ESCURO, r=0.4)  # sombra em cima do painel
        q.ret(x0 + 1, topo + 5, x0 + 1, CHAO - 11, LAMBRI_ESCURO, r=0.4)
        q.ret(x0 + 2, CHAO - 11, x1, CHAO - 11, LAMBRI_CLARO, r=1.3)  # quina de baixo pega luz
        q.ret(x1, topo + 5, x1, CHAO - 11, LAMBRI_CLARO, r=1.2)
    # rodapé
    q.ret(0, CHAO - 6, L - 1, CHAO - 6, RODAPE, r=1.5)
    q.ret(0, CHAO - 5, L - 1, CHAO - 2, mais(RODAPE, -14))
    q.ret(0, CHAO - 1, L - 1, CHAO - 1, RODAPE_ESCURO, r=0.3)


def varal(q, rnd):
    """Um varal de lampadinhas apagadas pendurado no alto da parede."""
    pts = []
    for x in range(0, L + 1, 2):
        # catenárias entre pregos a cada 80px
        seg = x % 80
        y = 5 + 7 * math.sin(math.pi * seg / 80)
        pts.append((x, y))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        q.linha([(x0, y0), (x1, y1)], CORDA, r=0.5)
    for x in range(10, L, 16):
        seg = x % 80
        y = int(5 + 7 * math.sin(math.pi * seg / 80))
        q.px(x, y + 1, CORDA)
        q.ret(x - 1, y + 2, x + 1, y + 4, LAMPADA, r=1.0)
        q.px(x - 1, y + 2, mais(LAMPADA, 40), r=2.2)  # o vidro pega a luz
        q.px(x, y + 5, mais(LAMPADA, -50))


def machado(q):
    """Machado deitado em dois pinos na parede, entre o pôster e o aparador."""
    # cabo (levemente inclinado), com a quina de cima virada para a luz
    x0, y0, x1, y1 = 78, 125, 114, 121
    n = 40
    for i in range(n + 1):
        t = i / n
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t)
        q.px(x, y - 1, mais(CABO, 30), r=1.8)
        q.px(x, y, CABO, r=1.0)
        q.px(x, y + 1, mais(CABO, -26), r=0.4)
    q.ret(76, 125, 78, 128, mais(CABO, -14), r=0.8)  # pomo
    for x, y in ((86, 127), (104, 125)):  # pinos
        q.ret(x - 1, y, x + 1, y + 1, METAL_ESCURO, r=0.8)
        q.px(x + 1, y, METAL, r=1.6)
    # cabeça: cunha que sai do cabo e abre para cima; o gume (em cima) é paralelo ao cabo
    lam = [(110, 119), (105, 108), (102, 103), (112, 101), (123, 102), (121, 108), (117, 119)]
    q.d.polygon(lam, fill=(46, 50, 62), outline=(20, 20, 28))
    q.dr.polygon(lam, fill=0.9)
    q.poli([(108, 109), (105, 104), (112, 103), (121, 104), (119, 109)], (64, 68, 82), r=1.2)
    q.linha([(102, 102), (112, 100), (123, 101)], (180, 186, 198), r=2.6)  # o gume pega a luz
    q.linha([(123, 101), (121, 108)], (150, 156, 168), r=2.8)
    q.px(122, 101, (226, 232, 242), r=3.2)
    q.ret(109, 118, 118, 124, (36, 38, 46), r=0.9)  # olho abraçando o cabo
    q.ret(109, 118, 118, 118, (90, 94, 108), r=2.0)
    q.ret(119, 120, 121, 122, CABO, r=1.2)  # ponta do cabo saindo do olho


def poster(q):
    """Pôster rasgado na parede: o coração da alma (bem apagado)."""
    x0, y0, x1, y1 = 44, 102, 74, 129
    q.ret(x0 + 1, y0 + 1, x1 + 1, y1 + 1, mais(PAREDE, -26))  # sombra
    q.ret(x0, y0, x1, y1, (60, 58, 72), r=1.0)
    q.ret(x0 + 2, y0 + 2, x1 - 2, y1 - 6, (40, 38, 52), r=0.9)
    alma = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
    for j, fila in enumerate(alma):
        for i, c in enumerate(fila):
            if c == 'X':
                q.px(x0 + 12 + i, y0 + 6 + j, (120, 48, 64), r=1.3)
    q.px(x0 + 13, y0 + 7, (170, 110, 120), r=2.0)
    for i in range(0, x1 - x0 - 5, 3):  # letreiro embaixo
        q.ret(x0 + 3 + i, y1 - 4, x0 + 4 + i, y1 - 3, (96, 96, 110), r=1.2)
    q.poli([(x1 - 6, y1), (x1, y1 - 7), (x1, y1)], mais(PAREDE_LISTRA, -4), r=1.0)  # canto rasgado
    q.px(x0 + 1, y0 + 1, METAL, r=2.0)  # tachinhas
    q.px(x1 - 1, y0 + 1, METAL, r=2.4)
    q.ret(x0, y0, x1, y0, (84, 82, 96), r=1.8)


def guitarra(q):
    """Violão encostado na parede, no canto esquerdo."""
    # sombra na parede
    q.poli([(16, 108), (24, 108), (28, 168), (8, 168)], mais(LAMBRI, -16))
    # corpo
    cor, esc, clr = (92, 62, 54), (54, 36, 36), (126, 92, 80)
    q.elipse(3, 141, 25, 165, esc)
    q.elipse(4, 141, 24, 164, cor, r=1.0)
    q.elipse(6, 128, 22, 147, esc)
    q.elipse(7, 128, 21, 146, cor, r=1.0)
    q.elipse(11, 145, 16, 150, PRETO, r=0.2)  # boca
    q.ret(10, 156, 17, 157, esc)  # cavalete
    # lado direito pega a luz
    for y in range(129, 164):
        for x in range(25, 2, -1):
            if q.img.getpixel((x, y)) == cor:
                q.px(x, y, clr, r=2.2)
                break
    # braço
    for y in range(98, 130):
        x = 13 + (130 - y) * 0.06
        q.ret(int(x) - 1, y, int(x) + 1, y, (60, 44, 40), r=1.0)
        q.px(int(x) + 1, y, (88, 70, 64), r=2.0)
        if y % 5 == 0:
            q.px(int(x), y, METAL, r=1.4)  # trastes
    q.ret(13, 91, 18, 98, (50, 36, 34), r=1.0)  # mão
    for y in (92, 94, 96):
        q.px(12, y, METAL, r=1.2)
        q.px(19, y, METAL, r=1.8)
    q.linha([(14, 99), (14, 157)], (150, 150, 150), r=0.8)  # cordas


def aparador(q, rnd):
    """Móvel baixo embaixo do telão, com as coisas em cima (na penumbra)."""
    x0, x1 = 116, 296
    tampo = 140
    # sombra na parede atrás
    q.ret(x0 - 2, tampo - 1, x1 + 3, CHAO - 1, mais(LAMBRI, -20))
    # tampo (vemos um pouquinho de cima) e frente
    q.ret(x0 - 3, tampo - 3, x1 + 3, tampo - 1, MADEIRA_CLARA, r=1.8)
    q.ret(x0 - 3, tampo, x1 + 3, tampo, MADEIRA_ESCURA, r=0.4)
    q.ret(x0, tampo + 1, x1, CHAO - 5, MADEIRA)
    # portas e gavetas
    larg = (x1 - x0) // 4
    for i in range(4):
        a, b = x0 + 3 + i * larg, x0 + (i + 1) * larg - 2
        q.ret(a, tampo + 4, b, CHAO - 9, MADEIRA_ESCURA, r=0.5)
        q.ret(a + 1, tampo + 5, b - 1, CHAO - 10, MADEIRA, r=0.9)
        q.ret(a + 1, tampo + 5, b - 1, tampo + 5, MADEIRA_CLARA, r=1.2)
        q.ret(a + 1, tampo + 9, b - 1, tampo + 9, MADEIRA_ESCURA, r=0.5)  # gaveta
        m = (a + b) // 2
        q.ret(m - 2, tampo + 7, m + 2, tampo + 7, METAL, r=1.8)  # puxador
    # pés e sombra no chão
    for x in (x0 + 2, x1 - 3):
        q.ret(x, CHAO - 5, x + 1, CHAO - 1, MADEIRA_ESCURA)
    q.ret(x0, CHAO - 4, x1, CHAO - 1, (22, 22, 30))

    # --- em cima ---
    # abajur apagado na ponta esquerda (a cúpula pega a luz do lado da tela)
    q.ret(120, tampo - 5, 127, tampo - 4, (48, 46, 56), r=1.0)
    q.ret(123, tampo - 12, 124, tampo - 6, (70, 66, 74), r=1.2)
    q.poli([(120, tampo - 20), (126, tampo - 20), (129, tampo - 12), (117, tampo - 12)], (96, 88, 80), r=1.0)
    q.linha([(126, tampo - 20), (129, tampo - 12)], (140, 130, 116), r=2.4)
    q.ret(117, tampo - 12, 129, tampo - 12, (70, 64, 60), r=0.8)
    # pilha de cartas (Jevil)
    for i in range(7):
        y = tampo - 4 - i
        dx = (i * 3) % 2
        q.ret(131 + dx, y, 141 + dx, y, CARTA if i % 2 == 0 else mais(CARTA, -30), r=1.3)
    q.ret(131, tampo - 11, 141, tampo - 11, mais(CARTA, 30), r=2.2)
    q.px(136, tampo - 11, (170, 40, 70), r=1.0)  # naipe
    # cartas espalhadas
    for cx, cor in ((144, CARTA_VERSO), (196, CARTA), (205, CARTA_VERSO)):
        q.poli([(cx, tampo - 4), (cx + 6, tampo - 6), (cx + 8, tampo - 4), (cx + 2, tampo - 3)], cor, r=1.6)
    # videogame + controle com o fio caindo
    q.ret(222, tampo - 7, 248, tampo - 4, (54, 56, 66), r=1.0)
    q.ret(222, tampo - 8, 248, tampo - 8, (92, 96, 108), r=2.0)
    q.ret(225, tampo - 6, 232, tampo - 6, PRETO)
    q.px(245, tampo - 6, (60, 140, 120))  # led apagado
    q.ret(252, tampo - 6, 260, tampo - 4, (60, 60, 72), r=1.3)
    q.ret(250, tampo - 5, 251, tampo - 4, (60, 60, 72), r=1.3)
    q.ret(261, tampo - 5, 262, tampo - 4, (60, 60, 72), r=1.3)
    for i, (x, y) in enumerate(((256, tampo - 3), (257, tampo + 1), (256, tampo + 5), (258, tampo + 9), (260, tampo + 12))):
        q.px(x, y, (30, 30, 36))
        q.px(x, y + 1, (30, 30, 36))
        q.px(x, y + 2, (30, 30, 36))
    # relógio digital (números apagados) à direita
    q.ret(268, tampo - 10, 286, tampo - 4, (40, 42, 50), r=1.0)
    q.ret(268, tampo - 10, 286, tampo - 10, (80, 84, 96), r=2.0)
    q.ret(270, tampo - 8, 284, tampo - 6, (22, 30, 34))
    for x in (271, 272, 274, 275, 278, 279, 281, 282):
        q.px(x, tampo - 7, (40, 66, 70))
    q.px(276, tampo - 8, (40, 66, 70))
    q.px(276, tampo - 6, (40, 66, 70))


def caixa_de_som(q):
    """Caixa de som alta no chão, à direita do telão (cortada pela borda)."""
    x0, y0 = 309, 126
    q.ret(x0 - 2, y0 + 2, L - 1, CHAO, mais(LAMBRI, -22))  # sombra
    q.ret(x0, y0, L - 1, CHAO - 1, CAIXA, r=1.0)
    q.ret(x0, y0, L - 1, y0, mais(CAIXA, 40), r=2.4)
    q.ret(x0, y0, x0, CHAO - 1, mais(CAIXA, 30), r=2.4)  # quina virada para a tela
    for cy, raio in ((y0 + 9, 4), (y0 + 25, 7)):
        cx = x0 + 9
        q.elipse(cx - raio, cy - raio, cx + raio, cy + raio, CAIXA_CONE, r=0.5)
        q.elipse(cx - raio + 1, cy - raio + 1, cx + raio - 1, cy + raio - 1, mais(CAIXA_CONE, 10), r=0.7)
        q.elipse(cx - 1, cy - 1, cx + 1, cy + 1, mais(CAIXA, 30), r=1.4)
        q.px(cx - raio + 1, cy - raio + 2, mais(CAIXA, 50), r=2.0)


# ---------- chão ----------

PF = (TV_CX, 52)  # ponto de fuga das tábuas


def no_chao(x0, y):
    """x da linha de tábua que nasce em x0 no rodapé, na altura y (perspectiva)."""
    return PF[0] + (x0 - PF[0]) * (y - PF[1]) / (CHAO - PF[1])


def chao(q, rnd):
    # tábuas que vão em direção à parede
    larg = 13
    bases = list(range(-900, 1400, larg))
    # profundidade: emendas mais espaçadas perto de nós
    emendas = []
    z = 1.0
    while True:
        y = PF[1] + (CHAO - PF[1]) / z
        if y > A + 20:
            break
        emendas.append(y)
        z *= 0.74
    cores = {}
    for y in range(CHAO, A):
        for x in range(L):
            # qual tábua?
            u = PF[0] + (x - PF[0]) * (CHAO - PF[1]) / (y - PF[1])
            i = int((u + 900) // larg)
            # qual "fileira" de emenda (desencontrada por tábua)
            k = 0
            for j, e in enumerate(emendas):
                if y + (i * 7 % 5) * 3 >= e:
                    k = j
            chave = (i, k)
            if chave not in cores:
                cores[chave] = mais(TABUA, rnd.choice((-8, -4, 0, 0, 4, 8)))
            c = cores[chave]
            # veio da madeira
            fu = (u + 900) % larg
            if int(fu * 3) % 7 == 0 and (y + i) % 4 != 0:
                c = mais(c, -6)
            q.img.putpixel((x, y), c)
    # frestas entre tábuas
    for b in bases:
        for y in range(CHAO, A):
            x = no_chao(b, y)
            if -1 <= x <= L:
                q.px(round(x), y, FRESTA, r=0.4)
                q.px(round(x) + 1, y, mais(TABUA, 10), r=1.15)
    # emendas desencontradas
    for i, b in enumerate(bases):
        for j, e in enumerate(emendas):
            y = int(round(e - (i * 7 % 5) * 3))
            if CHAO + 1 <= y < A:
                xa, xb = no_chao(b, y), no_chao(b + larg, y)
                if xb < -2 or xa > L + 2:
                    continue
                q.linha([(xa + 1, y), (xb - 1, y)], FRESTA, r=0.4)
    # sombra que o aparador faz no chão (ele tapa a luz logo à frente dele)
    for y in range(CHAO, CHAO + 9):
        t = (y - CHAO) / 9
        xa, xb = no_chao(118, y) + 2, no_chao(294, y) - 2
        q.dr.line([(xa, y), (xb, y)], fill=0.25 + 0.5 * t)


def tapete(q):
    """Tapete na frente do telão (losangos que só aparecem com a luz)."""
    ya, yb = 182, 232
    def borda(y):
        return no_chao(140, y), no_chao(318, y)
    for y in range(ya, yb + 1):
        xa, xb = borda(y)
        for x in range(int(math.ceil(xa)), int(xb) + 1):
            if not (0 <= x < L):
                continue
            # coordenadas no tapete (u na largura, v na profundidade)
            u = (x - xa) / (xb - xa)
            v = (y - ya) / (yb - ya)
            c = TAPETE
            na_borda = u < 0.06 or u > 0.94 or v < 0.1 or v > 0.9
            if na_borda:
                c = TAPETE_BORDA
                if (u < 0.03 or u > 0.97 or v < 0.04 or v > 0.96):
                    c = mais(TAPETE_BORDA, 14)
            else:
                # losangos (ouros)
                uu = (u - 0.06) / 0.88 * 7
                vv = (v - 0.1) / 0.8 * 3
                du, dv = abs(uu % 1 - 0.5), abs(vv % 1 - 0.5)
                s = du + dv
                if 0.3 < s < 0.42:
                    c = TAPETE_DESENHO
                elif s <= 0.12:
                    c = mais(TAPETE_DESENHO, 10)
            q.img.putpixel((x, y), c)
            q.r.putpixel((x, y), 1.1)
        if y == ya:
            q.linha([(xa, y), (xb, y)], mais(TAPETE_BORDA, 22), r=1.4)
    # franjas na frente
    xa, xb = borda(yb + 1)
    for x in range(int(xa) + 1, int(xb), 2):
        q.px(x, yb + 1, TAPETE_FRANJA, r=1.2)
        q.px(x, yb + 2, mais(TAPETE_FRANJA, -30), r=1.0)


def pufe(q):
    """Pufe no canto de baixo à esquerda, bem na frente (quase só silhueta)."""
    q.elipse(-16, 222, 66, 248, (16, 16, 22))  # sombra no chão
    corpo = [(-8, 244), (-12, 222), (-6, 206), (8, 197), (26, 195), (44, 200), (56, 212), (60, 230), (58, 244)]
    q.poli(corpo, TECIDO, r=0.7)
    q.poli([(-2, 210), (10, 201), (28, 199), (44, 204), (50, 212), (36, 216), (14, 216)], TECIDO_CLARO, r=1.3)
    q.linha([(14, 216), (36, 216), (50, 212)], mais(TECIDO, -24), r=0.4)  # o topo afundado
    q.linha([(26, 217), (30, 244)], mais(TECIDO, -20), r=0.4)  # costura
    q.linha([(48, 216), (52, 240)], mais(TECIDO, -20), r=0.4)
    # a borda de cima/direita pega o que sobra da luz
    q.linha([(8, 197), (26, 195), (44, 200), (56, 212), (60, 230)], mais(TECIDO_CLARO, 34), r=3.2)
    q.linha([(10, 198), (26, 196), (43, 201)], mais(TECIDO_CLARO, 16), r=2.2)


# ---------- luz do telão ----------


def campo_de_luz():
    """Quanto da luz do telão chega a cada pixel (0..~1), antes da receptividade."""
    ys, xs = np.mgrid[0:A, 0:L].astype(np.float32)
    x0, y0, x1, y1 = TV[0] - 4, TV[1] - 4, TV[2] + 4, TV[3] + 4  # com a moldura
    dx = np.maximum(np.maximum(x0 - xs, 0), xs - x1)
    dy = np.maximum(np.maximum(y0 - ys, 0), ys - y1)
    d = np.sqrt(dx * dx + dy * dy)
    parede = 0.95 * np.exp(-d / 16) + 0.28 * np.exp(-d / 70)
    # chão: o cone (trapézio) a partir da base da parede, com faixa interna
    t = (ys - CHAO) / (A - CHAO)
    abre = 1 + 0.55 * t
    meio = TV_CX
    meia = (TV[2] - TV[0]) / 2
    rel = np.abs(xs - meio) / (meia * abre)
    cone = np.where(rel < 1.0, 0.62, 0.0) + np.where(rel < 0.78, 0.16, 0.0)
    cone *= 1.0 - 0.38 * t  # vai perdendo força longe da parede
    # um pouquinho de luz espalhada fora do cone
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
    borda = np.clip((np.sqrt(((nx - 0.6) / 0.75) ** 2 + ((ny - 0.55) / 0.72) ** 2) - 0.62) / 0.45, 0, 1)
    logo = np.exp(-(((xs - 80) / 95) ** 2 + ((ys - 55) / 70) ** 2))
    opcoes = np.exp(-(((xs - 70) / 95) ** 2 + ((ys - 168) / 30) ** 2))
    a = np.clip(0.75 * borda + 0.42 * logo + 0.35 * opcoes, 0, 0.82)
    a = np.clip(quantizar(a, 12), 0, 0.82)
    out = np.zeros((A, L, 4), np.float32)
    out[..., 3] = a * 255
    return out


def main():
    os.makedirs(SAIDA, exist_ok=True)
    rnd = random.Random(SEED)
    q = Quadro()
    parede(q, rnd)
    varal(q, rnd)
    chao(q, rnd)
    tapete(q)
    aparador(q, rnd)
    caixa_de_som(q)
    guitarra(q)
    machado(q)
    poster(q)
    pufe(q)

    alb = np.asarray(q.img, np.float32)
    rec = np.asarray(q.r, np.float32)
    campo = campo_de_luz()

    # fundo: albedo na luz ambiente (+ um restinho frio do telão, sempre ligado)
    amb = AMBIENTE[None, None, :] * (0.8 + 0.35 * campo[..., None])
    fundo = np.clip(alb * amb, 0, 255)
    salvar(fundo, 'fundo.png', 'RGB')

    # luz: luminância do albedo x campo x receptividade, em degraus
    lum = alb @ np.array([0.3, 0.5, 0.2], np.float32) / 255.0
    ys = np.arange(A)[:, None]
    ganho = np.where(ys < CHAO, 1.25, 1.6)
    luz = np.clip(lum * campo * rec * ganho, 0, 1)
    luz = quantizar(luz, 16)
    for nome, mascara in (('luz-parede.png', ys < CHAO), ('luz-chao.png', ys >= CHAO)):
        v = np.where(mascara, luz, 0) * 255
        rgba = np.zeros((A, L, 4), np.float32)
        rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = v
        rgba[..., 3] = np.where(v > 0, 255, 0)
        salvar(rgba, nome, 'RGBA')

    salvar(vinheta(), 'vinheta.png', 'RGBA')

    grao = np.zeros((1, 1, 4), np.float32) + 255
    Image.fromarray(ampliar(grao).astype(np.uint8), 'RGBA').save(os.path.join(SAIDA, 'poeira.png'))
    print('ok:', SAIDA)


if __name__ == '__main__':
    main()
