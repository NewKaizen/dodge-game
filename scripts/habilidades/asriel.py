#!/usr/bin/env python3
"""Sprites e sons das cartas normais do Asriel (os golpes do God of Hyperdeath).

Uso (na raiz do projeto):  python3 scripts/habilidades/asriel.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites em public/assets/sprites/habilidades/asriel/ (chaves 'hab-asriel-*' em
src/game/pvp/habilidades/sprites/asriel.js):
  estrela-grande.png  24x24   Star Blazing: a estrela grande que cai na diagonal
  estrelinhas.png     6 quadros 12x12: estrelinhas arco-íris (o estouro do Star Blazing, o Tempo Parado)
  sabre.png           128x20  Chaos Saber: espada do caos deitada (cabo à esquerda, ponta à direita)
  canhao.png          34x20   Chaos Buster: o canhão (cano para a direita)
  tiro.png            16x10   Chaos Buster: rajada de plasma (para a direita)
  feixe.png           32x16   Chaos Buster: o tiro carregado (feixe esticado na horizontal)
  caveira.png         2 quadros 64x56: Hyper Goner: caveira de bode (boca fechada / aberta)
  diamantes.png       6 quadros 10x14: Hyper Goner: losangos arco-íris sugados pela boca
  raio.png            2 quadros 16x128: Shocker Breaker: o relâmpago (vertical)
  faisca.png          2 quadros 12x12: Shocker Breaker: faísca que corre pelo chão
  relogio.png         56x56   Tempo Parado: mostrador do relógio (sem ponteiros)
  ponteiro.png        24x8    Tempo Parado: ponteiro (bala, ponta para a direita)
  cadente.png         40x14   Estrela Cadente: estrela com cauda (cabeça à direita)
  poeira.png          2 quadros 8x8: Estrela Cadente: poeira de estrela que fica no rastro
  meteoro.png         2 quadros 22x16: Chuva de Meteoros: rocha em chamas (cabeça à direita)
  rochas.png          3 quadros 8x8: Chuva de Meteoros: lascas de rocha
  cratera.png         2 quadros 26x26: Chuva de Meteoros: cratera em brasa
  gigante.png         3 quadros 32x32: Supernova: a estrela gigante vermelha inchando
  clarao.png          64x64   Supernova: o clarão da explosão
  nebulosa.png        3 quadros 14x14: Supernova: nuvens de gás que sobram

Sons em public/assets/audio/habilidades/asriel/:
  corte.wav    o sabre corta o ar
  tiro.wav     disparo do canhão
  carga.wav    o canhão carregando o tiro grande
  trovao.wav   o relâmpago cai
  tique.wav    o relógio para (tique seco e grave)
  retomar.wav  o tempo volta a correr
  cadente.wav  a estrela cadente risca a caixa
  nova.wav     a supernova explode
"""
import math
import os
import random
import wave

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'asriel')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'asriel')

CONTORNO = (24, 10, 40, 255)
ARCO = [(255, 74, 90), (255, 162, 58), (255, 225, 74), (90, 224, 106), (74, 184, 255), (166, 107, 255)]
BRANCO = (255, 255, 255)
AMARELO = (255, 240, 122)  # cor do tema (0xfff07a)
ROSA = (255, 138, 216)
CEU = (154, 216, 255)


def clareia(c, k):
    return tuple(min(255, int(v + (255 - v) * k)) for v in c[:3])


def escurece(c, k):
    return tuple(int(v * (1 - k)) for v in c[:3])


def pintar(w, h, fn):
    """Imagem w x h onde fn(x, y) devolve (r, g, b[, a]) ou None (transparente)."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        for x in range(w):
            c = fn(x, y)
            if c is not None:
                px[x, y] = c if len(c) == 4 else (*c, 255)
    return img


def contornar(img, so_opacos=200):
    """Contorno escuro de 1 px em volta dos pixels opacos."""
    w, h = img.size
    px = img.load()
    novos = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > so_opacos:
                        novos.append((x, y))
                        break
    for x, y in novos:
        px[x, y] = CONTORNO
    return img


def folha(quadros):
    w, h = quadros[0].size
    f = Image.new('RGBA', (w * len(quadros), h), (0, 0, 0, 0))
    for i, q in enumerate(quadros):
        f.paste(q, (i * w, 0))
    return f


def salvar(img, nome):
    img.save(os.path.join(SAIDA, nome))


def dentro_poligono(x, y, pts):
    dentro = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            dentro = not dentro
        j = i
    return dentro


def pontas_estrela(cx, cy, r, interno=0.45, pontas=5, rot=-math.pi / 2):
    pts = []
    for i in range(pontas * 2):
        rr = r if i % 2 == 0 else r * interno
        a = rot + i * math.pi / pontas
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts


def estrela(n, cor, interno=0.45, brilho=True):
    c = (n - 1) / 2
    pts = pontas_estrela(c + 0.5, c + 1.0, n * 0.47, interno)

    def fn(x, y):
        if not dentro_poligono(x + 0.5, y + 0.5, pts):
            return None
        d = math.hypot(x - c + n * 0.18, y - c + n * 0.18) / n  # luz de cima-esquerda
        if d < 0.26:
            return clareia(cor, 0.75)
        if d < 0.55:
            return cor
        return escurece(cor, 0.25)

    img = contornar(pintar(n, n, fn))
    if brilho:
        img.putpixel((int(c) - 1, int(c) - 1), (255, 255, 255, 255))
    return img


# ---------- Star Blazing ----------


def estrela_grande():
    n = 24
    c = (n - 1) / 2
    pts = pontas_estrela(c + 0.5, c + 1.2, 11.3, 0.47)
    pts_in = pontas_estrela(c + 0.5, c + 1.2, 7.0, 0.47)

    def fn(x, y):
        p = (x + 0.5, y + 0.5)
        if not dentro_poligono(*p, pts):
            return None
        if dentro_poligono(*p, pts_in):
            d = math.hypot(x - c + 3, y - c + 3)
            return BRANCO if d < 3.2 else clareia(AMARELO, 0.45)
        # borda arco-íris (cada ponta de uma cor)
        ang = (math.atan2(y - c, x - c) + math.pi / 2) % (2 * math.pi)
        return ARCO[int(ang / (2 * math.pi) * 5 + 0.5) % 5]

    salvar(contornar(pintar(n, n, fn)), 'estrela-grande.png')


def estrelinhas():
    salvar(folha([estrela(12, cor) for cor in ARCO]), 'estrelinhas.png')


# ---------- Chaos Saber ----------


def sabre():
    w, h = 128, 20
    cy = (h - 1) / 2

    def fn(x, y):
        dy = y - cy
        # cabo (0..13) com pomo
        if x <= 3 and abs(dy) <= 3:
            return (166, 107, 255) if abs(dy) <= 1 else (110, 60, 190)
        if 4 <= x <= 13 and abs(dy) <= 2:
            return (70, 40, 110) if (x // 2) % 2 else (120, 80, 170)
        # guarda (14..18): asas arco-íris
        if 14 <= x <= 18 and abs(dy) <= 8 - abs(x - 16):
            return ARCO[int(abs(dy) / 9 * 6) % 6] if abs(dy) > 2 else AMARELO
        # lâmina (19..127) afinando até a ponta
        if x >= 19:
            meia = 4.6 if x < 108 else 4.6 * (127 - x) / 19
            if abs(dy) <= meia:
                if abs(dy) <= meia * 0.35:
                    return BRANCO
                # fio colorido correndo pela lâmina
                return clareia(ARCO[((x - 19) // 12) % 6], 0.35 if dy < 0 else 0.1)
        return None

    salvar(contornar(pintar(w, h, fn)), 'sabre.png')


# ---------- Chaos Buster ----------


def canhao():
    w, h = 34, 20
    cy = (h - 1) / 2

    def fn(x, y):
        dy = y - cy
        if 2 <= x <= 16 and abs(dy) <= 6.5:  # corpo
            if abs(dy) <= 1:
                return ARCO[(x // 3) % 6]
            return (92, 58, 150) if dy < 0 else (60, 34, 104)
        if 17 <= x <= 29 and abs(dy) <= 3.5:  # cano
            return (210, 200, 255) if dy < -1 else (140, 120, 210)
        if 30 <= x <= 32 and abs(dy) <= 5:  # boca
            return clareia(ROSA, 0.4)
        if 5 <= x <= 9 and 6 < dy <= 9:  # empunhadura
            return (60, 34, 104)
        return None

    img = contornar(pintar(w, h, fn))
    img.putpixel((31, int(cy)), (255, 255, 255, 255))
    salvar(img, 'canhao.png')


def tiro():
    w, h = 16, 10
    cy = (h - 1) / 2

    def fn(x, y):
        dy = abs(y - cy)
        # gota deitada: ponta redonda à direita, cauda fina à esquerda
        meia = 4.4 * math.sqrt(max(0, 1 - ((x - 10) / 5.2) ** 2)) if x >= 5 else 1.4 * (x / 5)
        if dy > meia:
            return None
        if dy <= meia * 0.45:
            return BRANCO
        return ROSA if x > 6 else (200, 120, 255)

    salvar(contornar(pintar(w, h, fn)), 'tiro.png')


def feixe():
    w, h = 32, 16
    cy = (h - 1) / 2

    def fn(x, y):
        dy = abs(y - cy)
        if dy <= 2.5:
            return BRANCO
        if dy <= 4.5:
            return clareia(ROSA, 0.5)
        if dy <= 6.5:
            return (*ARCO[(x // 4 + int(y < cy) * 3) % 6], 230)
        if dy <= 7.5:
            return (*ARCO[(x // 4 + 3) % 6], 120)
        return None

    salvar(pintar(w, h, fn), 'feixe.png')


# ---------- Hyper Goner ----------


def caveira(aberta):
    w, h = 64, 56
    cx = (w - 1) / 2
    OSSO = (244, 240, 255)
    SOMBRA = (190, 180, 220)
    FUNDO = (40, 14, 60)

    def fn(x, y):
        dx = x - cx
        # chifres curvos (arco grosso de cada lado)
        for lado in (-1, 1):
            hx, hy = cx + lado * 20, 16
            r = math.hypot(x - hx, y - hy)
            ang = math.atan2(y - hy, (x - hx) * lado)
            if 9 <= r <= 15 and -math.pi * 0.95 <= ang <= 0.25 and not (abs(dx) < 15 and y > 12):
                faixa = int(r) % 3 == 0
                return SOMBRA if faixa else (226, 218, 245)
        # crânio (elipse) e focinho (trapézio)
        cranio = (dx / 17) ** 2 + ((y - 20) / 15) ** 2 <= 1
        focinho = 22 <= y <= 42 and abs(dx) <= 12 - (y - 22) * 0.22
        mandibula = False
        if aberta:
            mandibula = 46 <= y <= 54 and abs(dx) <= 10 - (y - 46) * 0.3
        else:
            mandibula = 42 <= y <= 47 and abs(dx) <= 7.5
        if not (cranio or focinho or mandibula):
            # boca aberta: o vazio entre o focinho e a mandíbula
            if aberta and 42 < y < 46 and abs(dx) <= 9:
                return FUNDO
            return None
        # olhos (órbitas com brilho arco-íris)
        for lado in (-1, 1):
            ex, ey = cx + lado * 8, 21
            d = math.hypot(x - ex, (y - ey) * 1.2)
            if d <= 4.6:
                if d <= 1.6:
                    return BRANCO
                return ARCO[(int(math.atan2(y - ey, x - ex) / (2 * math.pi) * 6) + 6) % 6] if d <= 2.8 else FUNDO
        # narinas
        if 34 <= y <= 37 and 2 <= abs(dx) <= 4:
            return FUNDO
        # dentes da boca aberta
        if aberta and 40 <= y <= 42 and abs(dx) <= 9 and x % 3 == 0:
            return FUNDO
        if aberta and 46 <= y <= 47 and abs(dx) <= 9 and x % 3 == 1:
            return FUNDO
        return SOMBRA if (dx > 6 and y > 26) or y > 40 else OSSO

    return contornar(pintar(w, h, fn))


def diamantes():
    w, h = 10, 14
    c = ((w - 1) / 2, (h - 1) / 2)
    quadros = []
    for cor in ARCO:
        def fn(x, y, cor=cor):
            d = abs(x - c[0]) / 4.6 + abs(y - c[1]) / 6.6
            if d > 1:
                return None
            if x < c[0] and y < c[1]:
                return clareia(cor, 0.6)
            return cor if x <= c[0] or y <= c[1] else escurece(cor, 0.3)
        quadros.append(contornar(pintar(w, h, fn)))
    salvar(folha(quadros), 'diamantes.png')


# ---------- Shocker Breaker ----------


def raio(semente):
    w, h = 16, 128
    rnd = random.Random(semente)
    # caminho em zigue-zague de cima a baixo
    xs = []
    x = 8.0
    for y in range(h):
        if y % 9 == 0:
            alvo = rnd.uniform(4, 11)
        x += (alvo - x) * 0.35
        xs.append(x)

    def fn(px, py):
        d = abs(px - xs[py])
        if d <= 1.2:
            return BRANCO
        if d <= 2.6:
            return (255, 250, 170)
        if d <= 4.0:
            return (*AMARELO, 220)
        if d <= 5.5:
            return (*CEU, 110)
        return None

    return pintar(w, h, fn)


def faisca(q):
    n = 12
    c = (n - 1) / 2

    def fn(x, y):
        dx, dy = x - c, y - c
        ang = math.atan2(dy, dx) + q * math.pi / 4
        r = math.hypot(dx, dy)
        lim = 3 + 2.5 * max(0, math.cos(ang * 4)) ** 3
        if r <= 1.6:
            return BRANCO
        if r <= lim:
            return (255, 250, 150) if r < lim - 1 else CEU
        return None

    return contornar(pintar(n, n, fn))


# ---------- Tempo Parado ----------


def relogio():
    n = 56
    c = (n - 1) / 2

    def fn(x, y):
        r = math.hypot(x - c, y - c)
        ang = math.atan2(y - c, x - c)
        if r > 27:
            return None
        if r > 24.5:  # aro dourado
            return (255, 210, 90) if y < c else (200, 150, 60)
        # marcas das horas
        hora = (ang / (2 * math.pi / 12)) % 1
        if 19 <= r <= 23 and (hora < 0.12 or hora > 0.88):
            return (60, 34, 104)
        if r < 2.4:
            return (60, 34, 104)
        return (*clareia(CEU, 0.55), 170)  # mostrador translúcido

    salvar(contornar(pintar(n, n, fn), so_opacos=160), 'relogio.png')


def ponteiro():
    w, h = 24, 8
    cy = (h - 1) / 2

    def fn(x, y):
        dy = abs(y - cy)
        if x <= 2 and dy <= 2.5:  # anel do eixo
            return (255, 210, 90)
        if 3 <= x <= 16 and dy <= 1.0:  # haste
            return (60, 34, 104) if dy > 0.6 else (130, 90, 190)
        if x >= 16 and dy <= (23 - x) * 0.55:  # ponta de flecha
            return (255, 210, 90) if dy < 1.5 else (200, 150, 60)
        return None

    salvar(contornar(pintar(w, h, fn)), 'ponteiro.png')


# ---------- Estrela Cadente ----------


def cadente():
    w, h = 40, 14
    cy = (h - 1) / 2
    cab = estrela(14, AMARELO, interno=0.5)

    def fn(x, y):
        dy = abs(y - cy)
        if x >= 30:
            return None
        meia = 0.5 + 4.5 * (x / 30) ** 1.4
        if dy > meia:
            return None
        k = x / 30
        cor = ARCO[int((1 - k) * 5.99)] if dy > meia * 0.4 else clareia(AMARELO, 0.6)
        return (*cor, int(80 + 175 * k))

    img = pintar(w, h, fn)
    img.alpha_composite(cab, (w - 14, 0))
    salvar(img, 'cadente.png')


def poeira(q):
    n = 8
    c = (n - 1) / 2

    def fn(x, y):
        dx, dy = abs(x - c), abs(y - c)
        tam = 3.6 if q == 0 else 2.6
        if dx + dy <= 1.2:
            return BRANCO
        if (dx < 0.8 and dy <= tam) or (dy < 0.8 and dx <= tam):
            return (255, 250, 190) if q == 0 else CEU
        return None

    return contornar(pintar(n, n, fn))


# ---------- Chuva de Meteoros ----------


def meteoro(q):
    w, h = 22, 16
    cy = (h - 1) / 2
    rnd = random.Random(31 + q)
    falhas = {(rnd.randrange(14, 21), rnd.randrange(4, 12)) for _ in range(5)}

    def fn(x, y):
        dy = y - cy
        # rocha: círculo à direita
        r = math.hypot(x - 15.5, dy)
        if r <= 5.6:
            if (x, y) in falhas and r < 4.5:
                return (70, 40, 40)
            return (150, 96, 80) if (x - 15.5) + dy < -1 else (100, 62, 56)
        # chamas para trás (esquerda), tremulando entre os quadros
        meia = 5.2 * (x / 12) ** 0.8 + (1 if (x + q) % 3 == 0 else 0) * 0.8
        if x <= 12 and abs(dy) <= meia:
            k = abs(dy) / (meia + 1e-9)
            return (255, 245, 180) if k < 0.3 else (255, 162, 58) if k < 0.7 else (255, 74, 90)
        return None

    return contornar(pintar(w, h, fn))


def rocha(q):
    n = 8
    rnd = random.Random(70 + q)
    pts = [(4 + math.cos(a) * rnd.uniform(2.2, 3.6), 4 + math.sin(a) * rnd.uniform(2.2, 3.6)) for a in np.linspace(0, 2 * math.pi, 7)[:-1]]

    def fn(x, y):
        if not dentro_poligono(x + 0.5, y + 0.5, pts):
            return None
        return (255, 162, 58) if x + y < 6 else (130, 84, 70)

    return contornar(pintar(n, n, fn))


def cratera(q):
    n = 26
    c = (n - 1) / 2
    rnd = random.Random(90 + q)
    brasas = {(rnd.randrange(6, 20), rnd.randrange(6, 20)) for _ in range(9)}

    def fn(x, y):
        r = math.hypot(x - c, (y - c) * 1.1)
        if r > 12:
            return None
        if r > 9.5:  # borda de rocha
            return (120, 76, 64) if y < c else (86, 52, 48)
        if (x, y) in brasas:
            return (255, 245, 180)
        k = r / 9.5
        base = (255, 162, 58) if k < 0.45 else (255, 74, 90) if k < 0.8 else (150, 30, 50)
        return clareia(base, 0.25) if q == 1 and k < 0.6 else base

    return contornar(pintar(n, n, fn))


# ---------- Supernova ----------


def gigante(q):
    n = 32
    c = (n - 1) / 2
    raio_q = [11.0, 12.5, 14.0][q]

    def fn(x, y):
        r = math.hypot(x - c, y - c)
        ang = math.atan2(y - c, x - c)
        coroa = raio_q + 1.6 + 1.2 * math.sin(ang * 7 + q * 1.3)
        if r <= raio_q:
            d = math.hypot(x - c + 3.5, y - c + 3.5) / raio_q
            if d < 0.35:
                return (255, 236, 170)
            if d < 0.8:
                return (255, 140, 60)
            return (220, 50, 50)
        if r <= coroa:
            return (255, 74, 90, 150)
        return None

    return contornar(pintar(n, n, fn))


def clarao():
    n = 64
    c = (n - 1) / 2

    def fn(x, y):
        r = math.hypot(x - c, y - c)
        if r > 31:
            return None
        if r > 28:  # frente de choque
            ang = math.atan2(y - c, x - c)
            return (*ARCO[int((ang + math.pi) / (2 * math.pi) * 12) % 6], 230)
        if r < 10:
            return (255, 255, 255, 255)
        k = (r - 10) / 18
        return (*clareia((255, 220, 140), 0.6 * (1 - k)), int(250 - 120 * k))

    salvar(pintar(n, n, fn), 'clarao.png')


def nebulosa(cor, semente):
    n = 14
    rnd = random.Random(semente)
    bolhas = [(rnd.uniform(4, 10), rnd.uniform(4, 10), rnd.uniform(2.8, 4.6)) for _ in range(4)]

    def fn(x, y):
        m = max(1 - math.hypot(x - bx, y - by) / br for bx, by, br in bolhas)
        if m <= 0:
            return None
        if m > 0.55:
            return clareia(cor, 0.55)
        return cor

    return contornar(pintar(n, n, fn))


# ---------- sons ----------

TAXA = 22050


def salvar_som(nome, s):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    s = s / (np.max(np.abs(s)) + 1e-9) * 0.7
    dados = (s * 32767).astype(np.int16)
    with wave.open(os.path.join(SAIDA_SOM, nome + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(dados.tobytes())


def passa_baixa(s, k):
    return np.convolve(s, np.ones(k) / k, mode='same')


def tempo(seg):
    return np.arange(int(TAXA * seg)) / TAXA


def sons():
    rng = np.random.default_rng(41)

    # corte: sopro rápido que sobe e desce de tom (lâmina cortando o ar) + brilho metálico
    t = tempo(0.32)
    env = np.sin(np.pi * np.clip(t / 0.3, 0, 1)) ** 2
    sopro = passa_baixa(rng.standard_normal(len(t)), 6) * env
    brilho = np.sin(2 * np.pi * np.cumsum(2600 + 1800 * np.sin(np.pi * t / 0.3)) / TAXA) * env * 0.25
    salvar_som('corte', sopro + brilho)

    # tiro: zap curto que cai de tom
    t = tempo(0.18)
    f = 1500 * np.exp(-t * 18) + 280
    salvar_som('tiro', np.sign(np.sin(2 * np.pi * np.cumsum(f) / TAXA)) * np.exp(-t * 16) * 0.6)

    # carga: zumbido que sobe (o canhão juntando energia)
    t = tempo(0.5)
    f = 200 + 900 * (t / 0.5) ** 2
    salvar_som('carga', np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.clip(t / 0.4, 0, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t)))

    # trovão: estalo seco + ronco grave
    t = tempo(0.7)
    estalo = rng.standard_normal(len(t)) * np.exp(-t * 40)
    ronco = passa_baixa(rng.standard_normal(len(t)), 60) * np.exp(-t * 4) * 3
    salvar_som('trovao', estalo + ronco)

    # tique: o relógio para (tique-taque grave com eco)
    t = tempo(0.45)
    tique = np.zeros(len(t))
    for i0, f in ((0, 1800), (int(TAXA * 0.18), 1200)):
        n = min(700, len(t) - i0)
        tt = np.arange(n) / TAXA
        tique[i0:i0 + n] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 60)
    grave = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 6) * 0.5
    salvar_som('tique', tique + grave)

    # retomar: o tempo volta (varredura que acelera)
    t = tempo(0.4)
    f = 300 + 1600 * (t / 0.4) ** 1.5
    salvar_som('retomar', np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.sin(np.pi * t / 0.4) + passa_baixa(rng.standard_normal(len(t)), 4) * 0.15)

    # cadente: assobio que desce, cintilante
    t = tempo(0.5)
    f = 2400 - 1400 * (t / 0.5)
    cint = 1 + 0.3 * np.sin(2 * np.pi * 40 * t)
    salvar_som('cadente', np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.exp(-t * 3) * cint)

    # nova: estrondo largo com brilho por cima
    t = tempo(0.9)
    estrondo = passa_baixa(rng.standard_normal(len(t)), 30) * np.exp(-t * 3.5) * 2
    brilho = sum(np.sin(2 * np.pi * h * 900 * t) for h in (1, 1.5, 2.25)) / 3 * np.exp(-t * 7) * 0.5
    salvar_som('nova', estrondo + brilho)


def main():
    os.makedirs(SAIDA, exist_ok=True)
    estrela_grande()
    estrelinhas()
    sabre()
    canhao()
    tiro()
    feixe()
    salvar(folha([caveira(False), caveira(True)]), 'caveira.png')
    diamantes()
    salvar(folha([raio(5), raio(9)]), 'raio.png')
    salvar(folha([faisca(0), faisca(1)]), 'faisca.png')
    relogio()
    ponteiro()
    cadente()
    salvar(folha([poeira(0), poeira(1)]), 'poeira.png')
    salvar(folha([meteoro(0), meteoro(1)]), 'meteoro.png')
    salvar(folha([rocha(q) for q in range(3)]), 'rochas.png')
    salvar(folha([cratera(0), cratera(1)]), 'cratera.png')
    salvar(folha([gigante(q) for q in range(3)]), 'gigante.png')
    clarao()
    salvar(folha([nebulosa(ROSA, 3), nebulosa(CEU, 4), nebulosa((166, 107, 255), 5)]), 'nebulosa.png')
    sons()
    print('ok:', sorted(os.listdir(SAIDA)), sorted(os.listdir(SAIDA_SOM)))


if __name__ == '__main__':
    main()
