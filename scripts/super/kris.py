#!/usr/bin/env python3
"""Gera os sprites do SUPER de Kris ("Alma Sem Retorno") em
public/assets/sprites/super/kris/ e os sons em public/assets/audio/super/kris/.

Uso (na raiz do projeto):  python3 scripts/super/kris.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/super/sprites/kris.js):
  carta.png        132x141  arte da carta: espada cravada num tabuleiro, a alma e o rastro de lâminas
  lamina.png       12x22    lâmina pequena cravada no chão (o rastro do coração)
  espada.png       26x76    espada gigante apontando para baixo (cai nas casas do tabuleiro)
  impacto.png      32x32    casa rachada e brilhando (o golpe na casa)
  pecas.png        3 quadros 24x28: cavalo, bispo, torre (o movimento que a espada segue)
  casa.png         2 quadros 16x16: casa clara e casa escura do tabuleiro
  eco.png          2 quadros 16x16: o eco da alma (coração fantasma azul)
  espada-eco.png   56x12    a espada do eco (horizontal, ponta para a direita)
  corte.png        160x20   o corte final (rastro de luz)
"""

import math
import os
import random
import struct
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'kris')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'kris')

VAZIO = (0, 0, 0, 0)

# paleta
CONTORNO = (10, 14, 40)
NAVY = (20, 26, 64)
AZUL_ESCURO = (31, 72, 170)
AZUL = (74, 168, 255)
CIANO = (140, 220, 255)
GELO = (214, 244, 255)
BRANCO = (255, 255, 255)
VERMELHO = (255, 36, 56)
VERMELHO_ESCURO = (150, 10, 36)
ROSA = (255, 170, 180)
GUARDA = (44, 56, 120)
GUARDA_CLARA = (110, 130, 210)
CABO = (58, 40, 82)
OURO = (255, 210, 90)

# alma (coração) 11x10
ALMA = [
    '.XXX...XXX.',
    'XXXXX.XXXXX',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..XXXXXXX..',
    '...XXXXX...',
    '....XXX....',
    '.....X.....',
]


# ---------- utilitários ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor, alfa=255):
    x, y = int(x), int(y)
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


def misturar(img, x, y, cor, alfa):
    """Pinta por cima com transparência (alfa 0..1)."""
    x, y = int(x), int(y)
    if not (0 <= x < img.width and 0 <= y < img.height):
        return
    r, g, b, a = img.getpixel((x, y))
    if a == 0:
        img.putpixel((x, y), rgba(cor, int(255 * alfa)))
        return
    k = alfa
    img.putpixel((x, y), (int(r + (cor[0] - r) * k), int(g + (cor[1] - g) * k), int(b + (cor[2] - b) * k), max(a, int(255 * alfa))))


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


def linha(img, x0, y0, x1, y1, cor, alfa=255):
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    erro = dx + dy
    while True:
        por(img, x0, y0, cor, alfa)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * erro
        if e2 >= dy:
            erro += dy
            x0 += sx
        if e2 <= dx:
            erro += dx
            y0 += sy


def alma(img, ox, oy, cor=VERMELHO, escuro=VERMELHO_ESCURO, brilho=True):
    for y, fila in enumerate(ALMA):
        for x, c in enumerate(fila):
            if c == 'X':
                sombra = x >= 7 and y >= 4 or y >= 7
                por(img, ox + x, oy + y, escuro if sombra else cor)
    if brilho:
        por(img, ox + 2, oy + 1, ROSA)
        por(img, ox + 1, oy + 2, ROSA)
        por(img, ox + 2, oy + 2, BRANCO)


def ampliar(img, fator):
    return img.resize((img.width * fator, img.height * fator), Image.NEAREST)


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


# ---------- espadas ----------


def espada_vertical(largura, altura, lamina=None, guarda_y=None, cabo=6):
    """Espada apontando para baixo, centrada. lamina = meia largura da lâmina."""
    img = nova(largura, altura)
    cx = largura // 2
    meia = lamina or max(2, largura // 6)
    gy = guarda_y if guarda_y is not None else cabo + 3
    # pomo (gema vermelha)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if abs(dx) + abs(dy) <= 2:
                por(img, cx + dx, 2 + dy, VERMELHO if dx + dy > 0 else (255, 90, 100))
    por(img, cx - 1, 1, BRANCO)
    # cabo
    for y in range(4, gy):
        for dx in range(-1, 2):
            por(img, cx + dx, y, CABO if (y + dx) % 3 else (90, 66, 120))
    # guarda (larga, com alma no meio)
    ga = max(meia + 3, largura // 2 - 1)
    for dx in range(-ga, ga + 1):
        for dy in range(0, 3):
            cor = GUARDA_CLARA if dy == 0 else (GUARDA if dy == 1 else NAVY)
            if abs(dx) == ga and dy == 0:
                continue
            por(img, cx + dx, gy + dy, cor)
    por(img, cx, gy + 1, VERMELHO)
    por(img, cx - 1, gy + 1, VERMELHO)
    por(img, cx + 1, gy + 1, VERMELHO_ESCURO)
    por(img, cx, gy, ROSA)
    # lâmina
    topo = gy + 3
    ponta = altura - 2
    comp = ponta - topo
    for y in range(topo, ponta + 1):
        t = (y - topo) / max(1, comp)
        m = meia if t < 0.82 else max(0, round(meia * (1 - t) / 0.18))
        for dx in range(-m, m + 1):
            if dx == -m:
                cor = GELO
            elif dx < 0:
                cor = CIANO
            elif dx == 0:
                cor = BRANCO if t < 0.8 else GELO
            elif dx < m:
                cor = AZUL
            else:
                cor = AZUL_ESCURO
            por(img, cx + dx, y, cor)
    # sulco central (fuller)
    for y in range(topo + 1, topo + int(comp * 0.6)):
        por(img, cx, y, GELO if y % 5 else BRANCO)
    contornar(img)
    return img


def espada_horizontal(largura, altura):
    """Espada do eco: cabo à esquerda, ponta à direita."""
    v = espada_vertical(altura, largura, lamina=2, guarda_y=8, cabo=5)
    return v.rotate(90, expand=True)


# ---------- sprites ----------


def gerar_lamina():
    """Lâmina pequena cravada: espada curta de ponta para baixo + rachadura no chão."""
    img = nova(12, 22)
    e = espada_vertical(9, 19, lamina=1, guarda_y=6, cabo=4)
    img.alpha_composite(e, (1, 0))
    # rachadura / brilho no chão
    for x, cor in [(1, AZUL), (2, CIANO), (3, GELO), (8, GELO), (9, CIANO), (10, AZUL)]:
        por(img, x, 20, cor)
    por(img, 0, 21, AZUL_ESCURO)
    por(img, 11, 21, AZUL_ESCURO)
    for x in range(2, 10):
        por(img, x, 21, NAVY)
    return img


def gerar_espada():
    return espada_vertical(26, 76, lamina=5, guarda_y=12, cabo=8)


def gerar_impacto():
    """Casa golpeada: quadrado aceso com rachaduras saindo do centro."""
    rng = random.Random(7)
    img = nova(32, 32)
    for y in range(32):
        for x in range(32):
            borda = min(x, y, 31 - x, 31 - y)
            if borda == 0:
                cor = GELO
            elif borda == 1:
                cor = CIANO
            else:
                d = math.hypot(x - 15.5, y - 15.5) / 22
                cor = tuple(int(AZUL[i] * (1 - d) + AZUL_ESCURO[i] * d) for i in range(3))
            por(img, x, y, cor)
    # rachaduras
    for k in range(7):
        ang = k * (math.pi * 2 / 7) + rng.uniform(-0.3, 0.3)
        x, y = 15.5, 15.5
        for passo in range(9):
            ang += rng.uniform(-0.45, 0.45)
            nx, ny = x + math.cos(ang) * 2.4, y + math.sin(ang) * 2.4
            linha(img, x, y, nx, ny, NAVY)
            por(img, nx + 1, ny, GELO)
            x, y = nx, ny
    # centro brilhando
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if abs(dx) + abs(dy) <= 2:
                por(img, 15 + dx, 15 + dy, BRANCO if abs(dx) + abs(dy) <= 1 else GELO)
    return img


PECAS = {
    'cavalo': [
        '..........XX..........',
        '.........XXXX.........',
        '.......XXXXXXX........',
        '......XXXXXXXXX.......',
        '.....XXXXXOXXXXX......',
        '....XXXXXXXXXXXXX.....',
        '...XXXXXXXXXXXXXXX....',
        '..XXXXXXXXXXXXXXXXX...',
        '..XXXXXX..XXXXXXXXX...',
        '..XXXX.....XXXXXXXX...',
        '...XX......XXXXXXXX...',
        '..........XXXXXXXXX...',
        '.........XXXXXXXXXX...',
        '........XXXXXXXXXX....',
        '.......XXXXXXXXXXX....',
        '.......XXXXXXXXXXX....',
        '.......XXXXXXXXXXX....',
        '......XXXXXXXXXXXXX...',
        '.....XXXXXXXXXXXXXXX..',
        '....XXXXXXXXXXXXXXXXX.',
        '....XXXXXXXXXXXXXXXXX.',
        '....XXXXXXXXXXXXXXXXX.',
    ],
    'bispo': [
        '..........XX..........',
        '.........XXXX.........',
        '..........XX..........',
        '.........XXXX.........',
        '........XXXXXX........',
        '.......XXXX.XXX.......',
        '......XXXX.XXXXX......',
        '......XXX.XXXXXX......',
        '......XXXXXXXXXX......',
        '.......XXXXXXXX.......',
        '........XXXXXX........',
        '......XXXXXXXXXX......',
        '........XXXXXX........',
        '........XXXXXX........',
        '........XXXXXX........',
        '.......XXXXXXXX.......',
        '.......XXXXXXXX.......',
        '......XXXXXXXXXX......',
        '.....XXXXXXXXXXXX.....',
        '....XXXXXXXXXXXXXX....',
        '...XXXXXXXXXXXXXXXX...',
        '...XXXXXXXXXXXXXXXX...',
    ],
    'torre': [
        '...XXX..XXXX..XXX.....',
        '...XXX..XXXX..XXX.....',
        '...XXXXXXXXXXXXXX.....',
        '...XXXXXXXXXXXXXX.....',
        '....XXXXXXXXXXXX......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '.....XXXXXXXXXX.......',
        '....XXXXXXXXXXXX......',
        '....XXXXXXXXXXXX......',
        '...XXXXXXXXXXXXXX.....',
        '..XXXXXXXXXXXXXXXX....',
        '.XXXXXXXXXXXXXXXXXX...',
        '.XXXXXXXXXXXXXXXXXX...',
        '.XXXXXXXXXXXXXXXXXX...',
    ],
}


def peca(nome):
    img = nova(24, 28)
    mapa = PECAS[nome]
    larg = max(len(f.rstrip('.')) for f in mapa)
    ox = 1 + (22 - 22) // 2 + (2 if nome == 'torre' else 0)
    oy = 3
    for y, fila in enumerate(mapa):
        for x, c in enumerate(fila):
            if c == 'X':
                # luz da esquerda/cima, sombra à direita
                viz_d = x + 1 < len(fila) and fila[x + 1] == 'X'
                viz_e = x > 0 and fila[x - 1] == 'X'
                if not viz_e:
                    cor = BRANCO
                elif not viz_d:
                    cor = AZUL
                elif y > 17:
                    cor = CIANO
                else:
                    cor = GELO
                por(img, ox + x, oy + y, cor)
            elif c == 'O':
                por(img, ox + x, oy + y, VERMELHO)
    # faixa azul na base
    for x in range(24):
        for y in (oy + 18,):
            if opaco(img, x, y):
                por(img, x, y, AZUL_ESCURO)
    contornar(img, CONTORNO, diagonais=True)
    return img


def gerar_pecas():
    folha = nova(72, 28)
    for i, nome in enumerate(['cavalo', 'bispo', 'torre']):
        folha.alpha_composite(peca(nome), (i * 24, 0))
    return folha


def casa(clara):
    img = nova(16, 16)
    base = (46, 92, 196) if clara else (22, 34, 92)
    luz = (90, 150, 240) if clara else (40, 56, 132)
    sombra = (30, 62, 150) if clara else (14, 20, 60)
    for y in range(16):
        for x in range(16):
            cor = base
            if x == 0 or y == 0:
                cor = luz
            elif x == 15 or y == 15:
                cor = sombra
            por(img, x, y, cor)
    if clara:
        por(img, 3, 3, GELO)
        por(img, 4, 3, CIANO)
        por(img, 3, 4, CIANO)
    return img


def gerar_casas():
    folha = nova(32, 16)
    folha.alpha_composite(casa(True), (0, 0))
    folha.alpha_composite(casa(False), (16, 0))
    return folha


def eco(quadro):
    img = nova(16, 16)
    tmp = nova(16, 16)
    alma(tmp, 2, 3, cor=CIANO, escuro=AZUL, brilho=False)
    # oco: só a borda grossa, miolo translúcido
    for y in range(16):
        for x in range(16):
            if not opaco(tmp, x, y):
                continue
            borda = not all(opaco(tmp, x + dx, y + dy) for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)])
            if borda:
                por(img, x, y, GELO if quadro == 0 else CIANO)
            else:
                por(img, x, y, AZUL, 120 if quadro == 0 else 70)
    por(img, 4, 5, BRANCO)
    contornar(img, NAVY)
    return img


def gerar_eco():
    folha = nova(32, 16)
    folha.alpha_composite(eco(0), (0, 0))
    folha.alpha_composite(eco(1), (16, 0))
    return folha


def gerar_espada_eco():
    e = espada_vertical(12, 56, lamina=2, guarda_y=9, cabo=6)
    # ponta para a direita: gira 90 graus no sentido anti-horário
    return e.rotate(90, expand=True)


def gerar_corte():
    img = nova(160, 20)
    for x in range(160):
        t = x / 159
        # crescente: grosso no meio, fino nas pontas
        meia = 8 * math.sin(math.pi * t) ** 0.8
        curva = 3 * math.sin(math.pi * t)
        for y in range(20):
            d = abs(y - 10 + curva - 1.5)
            if d > meia:
                continue
            k = d / max(0.5, meia)
            cor = BRANCO if k < 0.35 else (GELO if k < 0.6 else (CIANO if k < 0.85 else AZUL))
            alfa = 255 if k < 0.85 else 200
            por(img, x, y, cor, alfa)
    return img


# ---------- arte da carta ----------


def mini_lamina(img, x, y, tam):
    """Lâmina minúscula cravada em (x, y) = ponto no chão. tam 1 ou 2."""
    alt = 4 + 3 * tam
    # brilho no chão
    for dx in range(-tam - 1, tam + 2):
        por(img, x + dx, y, CIANO if abs(dx) <= tam else AZUL)
    for k in range(1, alt):
        por(img, x, y - k, BRANCO if k < alt - 3 else GELO)
        if tam == 2:
            por(img, x + 1, y - k, AZUL)
            por(img, x - 1, y - k, CONTORNO)
            por(img, x + 2, y - k, CONTORNO)
        else:
            por(img, x - 1, y - k, CONTORNO)
            por(img, x + 1, y - k, CONTORNO)
    g = y - alt
    for dx in range(-tam - 1, tam + 2 + (1 if tam == 2 else 0)):
        por(img, x + dx, g, GUARDA_CLARA if dx < tam else GUARDA)
        por(img, x + dx, g - 1, CONTORNO)
        por(img, x + dx, g + 1, CONTORNO if abs(dx) > (tam - 1) else img.getpixel((x + dx, g + 1))[:3])
    por(img, x, g - 1, VERMELHO)
    por(img, x, g - 2, CONTORNO)


def gerar_carta():
    """66x71 em pixels lógicos, ampliado 2x e cortado para 132x141."""
    rng = random.Random(14)
    L, A = 66, 71
    img = nova(L, A)
    cx = 33
    # fundo: azul noite com raios saindo do brilho da alma
    fy = 18
    for y in range(A):
        for x in range(L):
            ang = math.atan2(y - fy, x - cx)
            d = math.hypot(x - cx, y - fy)
            raio = (int((ang + math.pi) / (math.pi * 2) * 20)) % 2 == 0
            base = 0.18 + max(0, 0.55 - d / 70)
            if raio:
                base += 0.12 * max(0, 1 - d / 60)
            cor = (int(18 + 40 * base), int(18 + 70 * base), int(52 + 150 * base))
            por(img, x, y, cor)
    # tabuleiro em perspectiva (horizonte em y=hz)
    hz = 36
    for y in range(hz + 1, A):
        dy = y - hz
        z = 64 / dy  # profundidade
        p = dy / (A - hz)
        for x in range(L):
            wx = (x - cx) * z / 13
            clara = (math.floor(wx + 0.5) + math.floor(z)) % 2 == 0
            cor = (52, 104, 214) if clara else (20, 32, 88)
            # névoa no horizonte e escurece embaixo (a palavra SUPER fica ali)
            nevoa = max(0, 1 - p * 2.6)
            escuro = max(0, (y - 56) / 15) * 0.65
            cor = tuple(int(cor[i] * (1 - nevoa) + (70, 120, 230)[i] * nevoa) for i in range(3))
            cor = tuple(int(cor[i] * (1 - escuro)) for i in range(3))
            por(img, x, y, cor)
    # linha do horizonte brilhante
    for x in range(L):
        por(img, x, hz, CIANO if abs(x - cx) < 22 else AZUL)
    # rastro de lâminas pequenas cravadas no tabuleiro: uma trilha em curva
    # que vem da frente e dá a volta na espada (o caminho sem volta)
    # rastro brilhante no chão (curva de Bézier vindo da frente até a espada)
    p0, p1, p2 = (6, 70), (6, 50), (cx - 7, 49)
    def bezier(t):
        return tuple((1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i] for i in range(2))
    for k in range(120):
        x, y = bezier(k / 119)
        misturar(img, x, y, (255, 60, 90), 0.7)
        misturar(img, x + 1, y, (255, 60, 90), 0.35)
    for t, tam in [(0.08, 2), (0.3, 2), (0.52, 1), (0.72, 1), (0.9, 1)]:
        x, y = bezier(t)
        mini_lamina(img, int(round(x)), int(round(y)), tam)
    # halo da alma
    for y in range(A):
        for x in range(L):
            d = math.hypot(x - cx, (y - 17) * 1.1)
            if d < 16:
                misturar(img, x, y, (255, 80, 110), 0.28 * (1 - d / 16))
    # espada gigante cravada
    chao = img.copy()
    esp = espada_vertical(24, 56, lamina=4, guarda_y=11, cabo=7)
    img.alpha_composite(esp, (cx - 12, 5))
    # a ponta fica enterrada no tabuleiro
    for y in range(50, A):
        for x in range(cx - 7, cx + 8):
            por(img, x, y, chao.getpixel((x, y))[:3])
    for x in range(cx - 6, cx + 7):
        por(img, x, 50, CONTORNO if abs(x - cx) == 6 else (CIANO if abs(x - cx) > 3 else BRANCO))
    # rachaduras no ponto onde a espada crava
    for k in range(6):
        ang = math.pi * (0.05 + k * 0.18) if k % 2 == 0 else math.pi * (1 - 0.05 - k * 0.15)
        ang = math.pi + rng.uniform(-1, 1) * 0.9 if k < 3 else rng.uniform(-0.5, 0.5)
        x, y = cx + (3 if k >= 3 else -3), 51
        for passo in range(rng.randint(4, 7)):
            nx = x + math.cos(ang) * 2.2
            ny = y + abs(math.sin(ang)) * 0.8 + rng.uniform(-0.5, 0.9)
            linha(img, x, y, nx, ny, GELO)
            x, y = nx, ny
            ang += rng.uniform(-0.4, 0.4)
    # alma na guarda (sobre a espada)
    tmp = nova(L, A)
    alma(tmp, cx - 5, 12)
    contornar(tmp, (60, 0, 20))
    img.alpha_composite(tmp)
    # faíscas
    for k in range(16):
        x = rng.randint(3, L - 4)
        y = rng.randint(2, 44)
        if abs(x - cx) < 8:
            continue
        cor = rng.choice([BRANCO, GELO, CIANO, ROSA])
        por(img, x, y, cor)
        if k % 3 == 0:
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                por(img, x + dx, y + dy, cor, 150)
    # moldura interna escura sutil (a moldura dourada vem por cima)
    grande = ampliar(img, 2)
    return grande.crop((0, 0, 132, 141))


# ---------- sons ----------


def salvar_som(nome, amostras, taxa=22050):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    pico = np.max(np.abs(amostras)) or 1
    s = (amostras / pico * 0.7 * 32767).astype(np.int16)  # ~ -3 dBFS
    with wave.open(os.path.join(SAIDA_SOM, nome), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(taxa)
        w.writeframes(s.tobytes())


def sons():
    taxa = 22050
    rng = np.random.default_rng(14)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # batida da alma: dois baques graves (tum-TUM)
    t = tempo(0.7)
    s = np.zeros_like(t)
    for ini, forca in [(0.0, 0.7), (0.2, 1.0)]:
        tt = t - ini
        m = tt >= 0
        f = 70 * np.exp(-tt[m] * 9) + 45
        fase = 2 * np.pi * np.cumsum(f) / taxa
        s[m] += forca * np.sin(fase) * np.exp(-tt[m] * 14)
    salvar_som('pulso.wav', s)

    # espada cravando: baque + tinido metálico
    t = tempo(0.9)
    baque = np.sin(2 * np.pi * (90 * np.exp(-t * 20) + 50) * t) * np.exp(-t * 18)
    tinido = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(1870, 6), (2630, 8), (3410, 11), (1190, 5)]) * 0.22
    ruido = rng.normal(0, 1, len(t)) * np.exp(-t * 40) * 0.5
    salvar_som('crava.wav', baque * 1.2 + tinido + ruido)

    # corte: chiado que sobe e corta
    t = tempo(0.45)
    ruido = rng.normal(0, 1, len(t))
    # passa-banda tosco: diferença de médias móveis
    def media(x, n):
        k = np.ones(n) / n
        return np.convolve(x, k, mode='same')
    ch = media(ruido, 3) - media(ruido, 12)
    env = np.clip(t / 0.06, 0, 1) * np.exp(-np.clip(t - 0.06, 0, None) * 12)
    zumbido = np.sin(2 * np.pi * (600 + 2400 * t) * t) * 0.25
    salvar_som('corte.wav', (ch * 1.4 + zumbido) * env)

    # tique: casa do tabuleiro virando / letra caindo
    t = tempo(0.09)
    salvar_som('tique.wav', (np.sin(2 * np.pi * 1320 * t) + 0.5 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 60))


def main():
    salvar(gerar_carta(), 'carta.png')
    salvar(gerar_lamina(), 'lamina.png')
    salvar(gerar_espada(), 'espada.png')
    salvar(gerar_impacto(), 'impacto.png')
    salvar(gerar_pecas(), 'pecas.png')
    salvar(gerar_casas(), 'casa.png')
    salvar(gerar_eco(), 'eco.png')
    salvar(gerar_espada_eco(), 'espada-eco.png')
    salvar(gerar_corte(), 'corte.png')
    sons()


if __name__ == '__main__':
    main()
