#!/usr/bin/env python3
"""Gera os sprites das cartas normais (habilidades) de Ralsei em
public/assets/sprites/habilidades/ralsei/ e os sons em
public/assets/audio/habilidades/ralsei/.

Uso (na raiz do projeto):  python3 scripts/habilidades/ralsei.py
Precisa do Pillow e do numpy. Saída determinística (sem sorteio fora de sementes fixas).

Sprites (chaves em src/game/pvp/habilidades/sprites/ralsei.js):
  estrela.png    2 quadros 18x18  estrela cadente dourada (Estrela Gentil)
  faisca.png     3 quadros 9x9    brilho de 4 pontas do rastro (verde, dourado, rosa)
  coro.png       2 quadros 20x20  estrela do coro, olhos fechados (boca fechada / cantando)
  voz.png        2 quadros 10x10  estrelinha que o coro canta (menta / rosa)
  nota.png       2 quadros 14x16  notas da canção de ninar (colcheia / duas colcheias)
  zzz.png        1 quadro  14x14  letra Z do feitiço de sono
  bolinho.png    4 quadros 22x26  cupcake com vela (vela inteira, metade, toco, estourando)
  granulado.png  4 quadros 10x4   granulado do bolinho (rosa, amarelo, menta, branco)
  cereja.png     1 quadro  10x12  cereja do topo do bolinho
  novelo.png     2 quadros 16x16  novelo de lã (verde / rosa)
  fio.png        2 quadros 12x4   pedaço do fio de lã (verde / rosa)
  fita.png       1 quadro  16x6   pedaço da fita do laço
  laco.png       1 quadro  24x16  laço (o nó da fita)
"""

import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'ralsei')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'ralsei')

VAZIO = (0, 0, 0, 0)

# ---------- paleta (verde do Ralsei 0x4dd68a, rosa do cachecol, dourado das estrelas) ----------
CONTORNO = (10, 24, 18)
VERDE_ESCURO = (30, 110, 70)
VERDE = (52, 168, 104)
RALSEI = (77, 214, 138)  # 0x4dd68a
VERDE_CLARO = (168, 240, 192)  # 0xa8f0c0
MENTA = (143, 232, 176)  # 0x8fe8b0
BRANCO = (255, 255, 255)
CREME = (255, 246, 220)
DOURADO_ESCURO = (176, 120, 30)
DOURADO = (246, 196, 70)
DOURADO_CLARO = (255, 236, 150)
ROSA_ESCURO = (178, 58, 112)
ROSA = (236, 112, 166)
ROSA_CLARO = (255, 186, 214)
LILAS_ESCURO = (92, 80, 170)
LILAS = (150, 140, 236)
LILAS_CLARO = (214, 210, 255)
MARROM = (120, 70, 40)
VERMELHO = (220, 40, 60)
VERMELHO_ESCURO = (130, 16, 36)
AMARELO = (255, 226, 80)


# ---------- utilitários ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor, alfa=255):
    x, y = int(x), int(y)
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


def opaco(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((x, y))[3] > 0
    return False


def contornar(img, cor=CONTORNO, diagonais=False):
    viz = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    if diagonais:
        viz += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    marcar = []
    for y in range(img.height):
        for x in range(img.width):
            if not opaco(img, x, y) and any(opaco(img, x + dx, y + dy) for dx, dy in viz):
                marcar.append((x, y))
    for x, y in marcar:
        por(img, x, y, cor)


def tira(quadros):
    """Junta quadros do mesmo tamanho lado a lado (spritesheet horizontal)."""
    l, a = quadros[0].size
    folha = nova(l * len(quadros), a)
    for i, q in enumerate(quadros):
        folha.paste(q, (i * l, 0))
    return folha


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


def pontos_estrela(cx, cy, r_ext, r_int, pontas=5, giro=-math.pi / 2):
    pts = []
    for i in range(pontas * 2):
        r = r_ext if i % 2 == 0 else r_int
        ang = giro + i * math.pi / pontas
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    return pts


def sombrear(img, escura, media, clara, luz=(-1, -1)):
    """Pinta os pixels opacos em 3 tons pela posição (luz vinda de cima/esquerda)."""
    px = [(x, y) for y in range(img.height) for x in range(img.width) if opaco(img, x, y)]
    if not px:
        return
    xs = [p[0] for p in px]
    ys = [p[1] for p in px]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    esc = max(1, max(max(xs) - min(xs), max(ys) - min(ys)) / 2)
    for x, y in px:
        d = ((x - cx) * luz[0] + (y - cy) * luz[1]) / esc
        cor = clara if d > 0.35 else escura if d < -0.45 else media
        por(img, x, y, cor)


# ---------- estrela cadente (Estrela Gentil) ----------


def gerar_estrela():
    quadros = []
    for q in range(2):
        img = nova(18, 18)
        d = ImageDraw.Draw(img)
        d.polygon(pontos_estrela(8.5, 9.2, 8.0, 3.6), fill=rgba(DOURADO))
        sombrear(img, DOURADO_ESCURO, DOURADO, DOURADO_CLARO)
        # miolo claro e brilho
        for x, y in [(8, 8), (9, 8), (8, 9), (9, 9), (7, 9)]:
            por(img, x, y, CREME)
        por(img, 6, 6, BRANCO)
        if q == 1:  # cintilando: miolo branco maior e pontas acesas
            for x, y in [(8, 7), (10, 9), (8, 10), (7, 8), (10, 8)]:
                por(img, x, y, BRANCO)
            for x, y in pontos_estrela(8.5, 9.2, 6.2, 3.6)[::2]:
                por(img, round(x), round(y), CREME)
        contornar(img)
        quadros.append(img)
    return tira(quadros)


def gerar_faisca():
    quadros = []
    for cor, clara in [(RALSEI, VERDE_CLARO), (DOURADO, DOURADO_CLARO), (ROSA, ROSA_CLARO)]:
        img = nova(9, 9)
        for i in range(-3, 4):
            por(img, 4 + i, 4, cor)
            por(img, 4, 4 + i, cor)
        for x, y in [(3, 3), (5, 3), (3, 5), (5, 5)]:
            por(img, x, y, cor)
        for x, y in [(4, 3), (3, 4), (5, 4), (4, 5)]:
            por(img, x, y, clara)
        por(img, 4, 4, BRANCO)
        contornar(img)
        quadros.append(img)
    return tira(quadros)


# ---------- coro de estrelas ----------


def gerar_coro():
    quadros = []
    for cantando in (False, True):
        img = nova(20, 20)
        d = ImageDraw.Draw(img)
        d.polygon(pontos_estrela(9.5, 10.6, 9.2, 4.4), fill=rgba(MENTA))
        sombrear(img, VERDE, MENTA, VERDE_CLARO)
        # olhinhos fechados (^ ^), felizes
        for ox in (7, 12):
            por(img, ox - 1, 10, CONTORNO)
            por(img, ox, 9, CONTORNO)
            por(img, ox + 1, 10, CONTORNO)
        # bochechas rosadas
        por(img, 5, 12, ROSA_CLARO)
        por(img, 14, 12, ROSA_CLARO)
        if cantando:  # boquinha aberta em "o"
            for x, y in [(9, 12), (10, 12), (8, 13), (11, 13), (9, 14), (10, 14)]:
                por(img, x, y, CONTORNO)
            por(img, 9, 13, ROSA_ESCURO)
            por(img, 10, 13, ROSA)
        else:  # sorrisinho
            por(img, 9, 13, CONTORNO)
            por(img, 10, 13, CONTORNO)
            por(img, 8, 12, CONTORNO)
            por(img, 11, 12, CONTORNO)
        por(img, 6, 6, BRANCO)
        contornar(img)
        quadros.append(img)
    return tira(quadros)


def gerar_voz():
    quadros = []
    for escura, media, clara in [(VERDE, MENTA, VERDE_CLARO), (ROSA_ESCURO, ROSA, ROSA_CLARO)]:
        img = nova(10, 10)
        d = ImageDraw.Draw(img)
        d.polygon(pontos_estrela(4.6, 5.2, 4.4, 2.0), fill=rgba(media))
        sombrear(img, escura, media, clara)
        por(img, 4, 5, BRANCO)
        contornar(img)
        quadros.append(img)
    return tira(quadros)


# ---------- canção de ninar ----------


def cabeca_nota(img, cx, cy, cor, clara):
    for dy in range(-2, 3):
        for dx in range(-3, 3):
            if (dx + 0.5) ** 2 / 9 + dy ** 2 / 5 <= 1.0:
                por(img, cx + dx, cy + dy, cor)
    por(img, cx - 2, cy - 1, clara)
    por(img, cx - 1, cy - 1, clara)


def gerar_nota():
    # colcheia (♪)
    a = nova(14, 16)
    cabeca_nota(a, 5, 12, LILAS, LILAS_CLARO)
    for y in range(2, 12):
        por(a, 7, y, LILAS)
        por(a, 8, y, LILAS_ESCURO)
    # bandeirinha curvada
    for x, y in [(9, 2), (9, 3), (10, 3), (10, 4), (11, 4), (11, 5), (12, 5), (12, 6), (12, 7), (11, 8), (12, 8)]:
        por(a, x, y, LILAS)
    por(a, 9, 2, LILAS_CLARO)
    por(a, 10, 3, LILAS_CLARO)
    contornar(a)
    # duas colcheias ligadas (♫)
    b = nova(14, 16)
    cabeca_nota(b, 3, 12, ROSA, ROSA_CLARO)
    cabeca_nota(b, 10, 11, ROSA, ROSA_CLARO)
    for y in range(3, 12):
        por(b, 5, y, ROSA_ESCURO)
    for y in range(2, 11):
        por(b, 12, y, ROSA_ESCURO)
    for x in range(5, 13):
        yb = 3 - (x - 5) / 7
        por(b, x, round(yb), ROSA)
        por(b, x, round(yb) + 1, ROSA)
    contornar(b)
    return tira([a, b])


# ---------- feitiço de sono ----------


def gerar_zzz():
    img = nova(14, 14)
    for x in range(2, 12):
        por(img, x, 2, LILAS_CLARO)
        por(img, x, 3, LILAS)
        por(img, x, 10, LILAS)
        por(img, x, 11, LILAS_ESCURO)
    for i in range(7):
        x = 10 - i * 1.15
        y = 4 + i
        por(img, round(x), y, LILAS)
        por(img, round(x) + 1, y, LILAS_CLARO if i < 3 else LILAS)
        por(img, round(x) - 1, y, LILAS_ESCURO if i > 3 else LILAS)
    por(img, 3, 2, BRANCO)
    contornar(img)
    return img


# ---------- bolinho explosivo ----------


def gerar_bolinho():
    quadros = []
    granulos = [(6, 11, AMARELO), (9, 9, VERDE_CLARO), (13, 10, AMARELO), (15, 12, VERDE_CLARO), (8, 13, BRANCO), (12, 13, AMARELO)]
    for q in range(4):
        img = nova(22, 26)
        estourando = q == 3
        inch = 1 if estourando else 0
        # forminha listrada (verde do Ralsei)
        for y in range(16, 25):
            t = (y - 16) / 8
            meia = 7 - t * 2 + inch
            for x in range(round(11 - meia), round(11 + meia)):
                cor = RALSEI if (x // 2) % 2 == 0 else VERDE
                if x <= 11 - meia + 1:
                    cor = VERDE_ESCURO
                por(img, x, y, cor)
        # cobertura rosa (nuvem em camadas)
        for cx, cy, r in [(11, 14, 8.2 + inch), (7, 12, 4.4 + inch), (15, 12, 4.4 + inch), (11, 10, 5.0 + inch)]:
            for y in range(26):
                for x in range(22):
                    if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and y <= 16:
                        cor = ROSA if not estourando else ROSA_CLARO
                        if y > 14:
                            cor = ROSA_ESCURO if not estourando else ROSA
                        por(img, x, y, cor)
        for x, y in [(8, 9), (9, 8), (7, 10)]:
            por(img, x, y, ROSA_CLARO if not estourando else BRANCO)
        for x, y, cor in granulos:
            por(img, x, y, cor)
        # vela (encurta com o tempo) e chama
        alturas = [5, 3, 2, 1]
        h = alturas[q]
        topo_vela = 9 - h
        for y in range(topo_vela, 9):
            por(img, 11, y, CREME)
            por(img, 12, y, ROSA_CLARO)
        chama_y = topo_vela - 1
        if not estourando:
            por(img, 11, chama_y, AMARELO)
            por(img, 12, chama_y, DOURADO)
            por(img, 11, chama_y - 1, DOURADO_CLARO)
            por(img, 12, chama_y - 1, AMARELO)
            por(img, 11, chama_y - 2, BRANCO)
        else:
            for dx, dy in [(-2, -1), (2, -1), (0, -3), (-3, 1), (3, 1)]:
                por(img, 11 + dx, chama_y + dy, BRANCO)
        contornar(img)
        if estourando:  # faíscas soltas em volta (sem contorno)
            for x, y in [(2, 4), (19, 5), (1, 14), (20, 15), (4, 1), (17, 1)]:
                por(img, x, y, DOURADO_CLARO)
        quadros.append(img)
    return tira(quadros)


def gerar_granulado():
    quadros = []
    for cor, clara in [(ROSA, ROSA_CLARO), (DOURADO, AMARELO), (RALSEI, VERDE_CLARO), (CREME, BRANCO)]:
        img = nova(10, 4)
        for x in range(1, 9):
            por(img, x, 1, clara)
            por(img, x, 2, cor)
        contornar(img)
        quadros.append(img)
    return tira(quadros)


def gerar_cereja():
    img = nova(10, 12)
    for y in range(12):
        for x in range(10):
            if (x - 4.5) ** 2 + (y - 7.5) ** 2 <= 11:
                por(img, x, y, VERMELHO)
    for x, y in [(6, 9), (5, 10), (6, 10), (4, 10)]:
        por(img, x, y, VERMELHO_ESCURO)
    por(img, 3, 6, ROSA_CLARO)
    por(img, 3, 5, BRANCO)
    for i, (x, y) in enumerate([(5, 4), (5, 3), (6, 2), (7, 1)]):
        por(img, x, y, VERDE_ESCURO)
    por(img, 8, 1, RALSEI)
    contornar(img)
    return img


# ---------- fios de lã ----------


def gerar_novelo():
    quadros = []
    for escura, media, clara in [(VERDE_ESCURO, RALSEI, VERDE_CLARO), (ROSA_ESCURO, ROSA, ROSA_CLARO)]:
        img = nova(16, 16)
        for y in range(16):
            for x in range(16):
                if (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 46:
                    por(img, x, y, media)
        sombrear(img, escura, media, clara)
        # voltas de lã (fios cruzando o novelo)
        for k in range(-2, 3):
            for x in range(16):
                y = 7.5 + k * 2.6 + (x - 7.5) * 0.55
                if (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 36:
                    por(img, x, round(y), escura)
        for k in (-1, 1):
            for y in range(16):
                x = 7.5 + k * 3.0 - (y - 7.5) * 0.35
                if (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 30:
                    por(img, round(x), y, clara)
        por(img, 5, 4, BRANCO)
        contornar(img)
        quadros.append(img)
    return tira(quadros)


def gerar_fio():
    quadros = []
    for escura, media in [(VERDE_ESCURO, RALSEI), (ROSA_ESCURO, ROSA)]:
        img = nova(12, 4)
        for x in range(12):
            y = 1.5 + math.sin(x / 12 * math.pi * 2) * 0.9
            por(img, x, round(y), media)
            por(img, x, round(y) + 1, escura)
        quadros.append(img)
    return tira(quadros)


# ---------- laço de fita ----------


def gerar_fita():
    img = nova(16, 6)
    for x in range(16):
        por(img, x, 1, ROSA_CLARO)
        por(img, x, 2, ROSA)
        por(img, x, 3, ROSA)
        por(img, x, 4, ROSA_ESCURO)
    for x in (3, 11):  # dobrinhas de cetim
        por(img, x, 2, ROSA_CLARO)
        por(img, x + 1, 3, ROSA_ESCURO)
    for x in range(16):
        por(img, x, 0, CONTORNO)
        por(img, x, 5, CONTORNO)
    return img


def gerar_laco():
    img = nova(24, 16)
    d = ImageDraw.Draw(img)
    # duas alças
    d.polygon([(12, 8), (2, 2), (1, 8), (2, 14)], fill=rgba(ROSA))
    d.polygon([(12, 8), (22, 2), (23, 8), (22, 14)], fill=rgba(ROSA))
    # pontas soltas
    d.polygon([(11, 9), (7, 15), (10, 15), (12, 11)], fill=rgba(ROSA_ESCURO))
    d.polygon([(13, 9), (17, 15), (14, 15), (12, 11)], fill=rgba(ROSA_ESCURO))
    for y in range(16):
        for x in range(24):
            if opaco(img, x, y) and y < 6 and img.getpixel((x, y))[:3] == ROSA:
                por(img, x, y, ROSA_CLARO)
    # dobras internas das alças
    for i in range(4):
        por(img, 4 + i, 7 + (i % 2), ROSA_ESCURO)
        por(img, 19 - i, 7 + (i % 2), ROSA_ESCURO)
    # nó verde no meio
    for y in range(6, 11):
        for x in range(10, 14):
            por(img, x, y, RALSEI if y < 9 else VERDE)
    por(img, 11, 7, VERDE_CLARO)
    contornar(img)
    return img


# ---------- sons ----------


def salvar_som(nome, amostras, taxa=22050):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    pico = np.max(np.abs(amostras)) or 1
    s = (amostras / pico * 0.6 * 32767).astype(np.int16)
    with wave.open(os.path.join(SAIDA_SOM, nome), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(taxa)
        w.writeframes(s.tobytes())


def passa_baixa(s, k):
    janela = np.ones(k) / k
    return np.convolve(s, janela, mode='same')


def sons():
    taxa = 22050
    rng = np.random.default_rng(7)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # estrela: brilho cristalino (dois sinos agudos)
    t = tempo(0.45)
    sino = np.sin(2 * np.pi * 1568 * t) * np.exp(-t * 9) + 0.6 * np.sin(2 * np.pi * 2349 * t) * np.exp(-t * 12)
    salvar_som('estrela.wav', sino * np.minimum(1, t * 200))

    # coro: "aah" curtinho (vogal com três harmônicos e vibrato)
    t = tempo(0.32)
    f = 660 * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    fase = 2 * np.pi * np.cumsum(f) / taxa
    voz = np.sin(fase) + 0.5 * np.sin(2 * fase) + 0.25 * np.sin(3 * fase)
    env = np.minimum(1, t * 30) * np.exp(-np.clip(t - 0.12, 0, None) * 9)
    salvar_som('coro.wav', voz * env)

    # bolinho: "pof" fofo (estouro grave + chiado curto)
    t = tempo(0.3)
    pof = np.sin(2 * np.pi * (180 * np.exp(-t * 12) + 70) * t) * np.exp(-t * 14)
    chiado = passa_baixa(rng.standard_normal(len(t)), 3) * np.exp(-t * 30) * 0.6
    salvar_som('bolinho.wav', pof + chiado)

    # fita: "zip" de fita sendo puxada (ruído com corte subindo)
    t = tempo(0.28)
    ruido = rng.standard_normal(len(t))
    zip_ = (ruido - passa_baixa(ruido, 6)) * np.sin(np.pi * t / t[-1]) ** 0.7
    tom = np.sin(2 * np.pi * np.cumsum(500 + 1500 * t / t[-1]) / taxa) * 0.25 * np.sin(np.pi * t / t[-1])
    salvar_som('fita.wav', zip_ + tom)


def main():
    salvar(gerar_estrela(), 'estrela.png')
    salvar(gerar_faisca(), 'faisca.png')
    salvar(gerar_coro(), 'coro.png')
    salvar(gerar_voz(), 'voz.png')
    salvar(gerar_nota(), 'nota.png')
    salvar(gerar_zzz(), 'zzz.png')
    salvar(gerar_bolinho(), 'bolinho.png')
    salvar(gerar_granulado(), 'granulado.png')
    salvar(gerar_cereja(), 'cereja.png')
    salvar(gerar_novelo(), 'novelo.png')
    salvar(gerar_fio(), 'fio.png')
    salvar(gerar_fita(), 'fita.png')
    salvar(gerar_laco(), 'laco.png')
    sons()


if __name__ == '__main__':
    main()
