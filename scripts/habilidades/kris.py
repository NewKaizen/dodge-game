#!/usr/bin/env python3
"""Gera os sprites das cartas normais de Kris em
public/assets/sprites/habilidades/kris/ e os sons em public/assets/audio/habilidades/kris/.

Uso (na raiz do projeto):  python3 scripts/habilidades/kris.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/habilidades/sprites/kris.js, prefixo hab-kris-):
  espada.png    64x14   espada larga, ponta para a direita (Corte Firme: gira presa na parede)
  florete.png   84x12   florete de guarda em concha, ponta para a direita (Estocada Dupla)
  olho.png      2 quadros 26x16: olho vazio (contorno sem pupila) e olho fixo (anel vermelho) (Olhar Vazio)
  clarao.png    32x32   clarão da piscada do olho
  brilho.png    11x11   faísca de quatro pontas (cílios que o clarão solta)
  pegada.png    11x18   pegada de bota, bico para cima (Passo Calculado)
  pisada.png    24x24   impacto da pisada no chão
  peao.png      12x14   peão de xadrez (Plano Tático: as tropas que marcham)
  seta.png      14x14   ponta de seta do plano, para a direita
  alma.png      2 quadros 24x22: a alma vermelha (normal e pulsando) (Controle da Alma)
  caco.png      10x10   caco da alma (os anéis que ela solta)
  placa.png     3 quadros 24x24: placa armada, clique (furos vermelhos), espinhos para cima
                (Armadilha de Espinhos)
"""

import math
import os
import wave

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'kris')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'kris')

VAZIO = (0, 0, 0, 0)

# paleta (a mesma família do SUPER: azul 0x4aa8ff, alma vermelha)
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
CABO_CLARO = (90, 66, 120)
ACO = (150, 170, 205)
ACO_ESCURO = (78, 92, 130)

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


def folha(quadros):
    """Junta quadros do mesmo tamanho lado a lado (spritesheet)."""
    w, h = quadros[0].size
    img = nova(w * len(quadros), h)
    for i, q in enumerate(quadros):
        img.paste(q, (i * w, 0))
    return img


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


# ---------- Corte Firme: espada larga ----------


def gerar_espada():
    w, h = 64, 14
    img = nova(w, h)
    cy = h // 2  # 7
    # pomo: gema vermelha
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if abs(dx) + abs(dy) <= 2:
                por(img, 3 + dx, cy + dy, VERMELHO if dx + dy > 0 else (255, 90, 100))
    por(img, 2, cy - 1, BRANCO)
    # cabo
    for x in range(5, 13):
        for dy in (-1, 0, 1):
            por(img, x, cy + dy, CABO if (x + dy) % 3 else CABO_CLARO)
    # guarda vertical com a alma no meio
    for y in range(1, h - 1):
        for x in (13, 14, 15):
            cor = GUARDA_CLARA if x == 13 else (GUARDA if x == 14 else NAVY)
            por(img, x, y, cor)
    por(img, 14, cy, VERMELHO)
    por(img, 14, cy - 1, VERMELHO)
    por(img, 13, cy - 1, ROSA)
    # lâmina larga (meia altura 3), afinando na ponta
    ini, ponta = 16, w - 2
    for x in range(ini, ponta + 1):
        k = (x - ini) / (ponta - ini)
        m = 3 if k < 0.84 else max(0, round(3 * (1 - k) / 0.16))
        for dy in range(-m, m + 1):
            if dy == -m:
                cor = GELO
            elif dy < 0:
                cor = CIANO
            elif dy == 0:
                cor = BRANCO
            elif dy < m:
                cor = AZUL
            else:
                cor = AZUL_ESCURO
            por(img, x, cy + dy, cor)
    # sulco (fuller) no meio da lâmina
    for x in range(ini + 2, ini + 30):
        por(img, x, cy, GELO)
        por(img, x, cy + 1, CIANO)
    contornar(img)
    return img


# ---------- Estocada Dupla: florete ----------


def gerar_florete():
    w, h = 84, 12
    img = nova(w, h)
    cy = 6
    # pomo
    for dy in range(-1, 2):
        for dx in range(-1, 2):
            if abs(dx) + abs(dy) <= 1:
                por(img, 2 + dx, cy + dy, VERMELHO)
    por(img, 1, cy, ROSA)
    # cabo
    for x in range(4, 11):
        por(img, x, cy, CABO_CLARO if x % 2 else CABO)
        por(img, x, cy + 1, CABO)
    # arco da mão (knuckle bow) do pomo até a concha
    for x in range(3, 13):
        y = cy - 3 if 4 <= x <= 11 else cy - 2
        por(img, x, y, GUARDA_CLARA)
    # concha (bell guard): meia-lua aberta para a esquerda
    for y in range(0, h):
        d = abs(y - cy - 0.5)
        if d <= 5.5:
            larg = 3 if d < 4 else 2
            for k in range(larg):
                x = 12 + k + int(d * 0.4)
                por(img, x, y, GUARDA_CLARA if k == 0 else (GUARDA if k == 1 else NAVY))
    por(img, 13, cy, VERMELHO)
    por(img, 13, cy + 1, VERMELHO_ESCURO)
    # lâmina fina e longa (3 px), ponta aguda
    ini, ponta = 16, w - 2
    for x in range(ini, ponta + 1):
        k = (x - ini) / (ponta - ini)
        por(img, x, cy - 1, GELO if k < 0.95 else CIANO)
        if k < 0.97:
            por(img, x, cy, BRANCO if x % 7 else GELO)
        if k < 0.9:
            por(img, x, cy + 1, AZUL)
    contornar(img)
    return img


# ---------- Olhar Vazio ----------


def olho(quadro):
    w, h = 26, 16
    img = nova(w, h)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    meia_l, meia_a = 11.5, 6.2

    def dentro(x, y, folga=0.0):
        # amêndoa: duas parábolas
        u = (x - cx) / (meia_l - folga)
        if abs(u) > 1:
            return False
        lim = (meia_a - folga) * (1 - u * u)
        return abs(y - cy) <= lim

    for y in range(h):
        for x in range(w):
            if dentro(x, y):
                borda = not dentro(x, y, 1.6)
                if borda:
                    por(img, x, y, CIANO if y < cy else AZUL)
                else:
                    por(img, x, y, NAVY)
    # cílios de cima (três tracinhos)
    for dx in (-6, 0, 6):
        por(img, cx + dx, 0, AZUL)
    # anel da "pupila": vazio (quadro 0) ou vermelho fixo (quadro 1)
    anel = AZUL_ESCURO if quadro == 0 else VERMELHO
    raio = 3.2 if quadro == 0 else 2.6
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - cx, y - cy)
            if abs(d - raio) < 0.7 and dentro(x, y, 1.6):
                por(img, x, y, anel)
    if quadro == 1:
        por(img, round(cx), round(cy), VERMELHO_ESCURO)
        por(img, round(cx) - 2, round(cy) - 2, ROSA)
    else:
        por(img, round(cx) - 3, round(cy) - 2, GUARDA_CLARA)
    contornar(img)
    return img


def gerar_olho():
    return folha([olho(0), olho(1)])


def gerar_clarao():
    n = 32
    img = nova(n, n)
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            raio = 9 + 6 * max(0, math.cos(ang * 4)) ** 6  # oito raios curtos
            if d <= 5:
                por(img, x, y, BRANCO)
            elif d <= 8:
                por(img, x, y, GELO)
            elif d <= raio:
                por(img, x, y, CIANO if d < raio - 2 else AZUL)
            elif d <= 12.5 and abs(d - 12) < 0.8:
                por(img, x, y, AZUL, 200)
    contornar(img, AZUL_ESCURO)
    return img


def gerar_brilho():
    n = 11
    img = nova(n, n)
    c = 5
    for y in range(n):
        for x in range(n):
            dx, dy = abs(x - c), abs(y - c)
            if (dx == 0 and dy <= 4) or (dy == 0 and dx <= 4) or (dx <= 1 and dy <= 1):
                por(img, x, y, BRANCO if dx + dy <= 1 else CIANO)
    contornar(img, AZUL_ESCURO)
    return img


# ---------- Passo Calculado ----------

PEGADA = [
    '..XXXX...',
    '.XXXXXX..',
    'XXXXXXXX.',
    'XXXXXXXX.',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '.........',
    '..XXXXX..',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '..XXXXX..',
]
CRAVOS = [(3, 2), (5, 3), (2, 4), (4, 5), (6, 5), (3, 7), (5, 7), (3, 12), (5, 13), (4, 14)]


def gerar_pegada():
    """Pegada de bota (pé direito), bico para cima: sola, arco vazio e salto."""
    img = nova(11, 18)
    for y, fila in enumerate(PEGADA):
        for x, ch in enumerate(fila):
            if ch == 'X':
                vizinho_esq = x == 0 or fila[x - 1] != 'X'
                por(img, 1 + x, 1 + y, CIANO if vizinho_esq else AZUL)
    for x, y in CRAVOS:
        por(img, 1 + x, 1 + y, AZUL_ESCURO)
    contornar(img)
    return img


def gerar_pisada():
    n = 24
    img = nova(n, n)
    c = (n - 1) / 2
    rng = np.random.default_rng(5)
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if d <= 10.5:
                if d > 8.5:
                    por(img, x, y, CIANO)
                elif d > 6.5:
                    por(img, x, y, AZUL)
                else:
                    por(img, x, y, AZUL_ESCURO)
    # rachaduras saindo do centro
    for k in range(6):
        ang = k * math.pi / 3 + rng.uniform(-0.25, 0.25)
        for r in np.arange(1.5, 10, 0.5):
            por(img, c + math.cos(ang) * r, c + math.sin(ang) * r, GELO if r > 7 else NAVY)
    # poeira em volta
    for k in range(8):
        ang = k * math.pi / 4 + 0.4
        por(img, c + math.cos(ang) * 11.5, c + math.sin(ang) * 11.5, GELO)
    contornar(img)
    return img


# ---------- Plano Tático ----------

PEAO = [
    '....XX....',
    '...XXXX...',
    '...XXXX...',
    '....XX....',
    '...XXXX...',
    '....XX....',
    '....XX....',
    '...XXXX...',
    '..XXXXXX..',
    '.XXXXXXXX.',
    '.XXXXXXXX.',
]


def gerar_peao():
    img = nova(12, 14)
    for y, fila in enumerate(PEAO):
        for x, ch in enumerate(fila):
            if ch == 'X':
                cor = AZUL
                if x <= 4:
                    cor = CIANO
                if x <= 3 and y < 4:
                    cor = GELO
                if y >= 9:
                    cor = AZUL_ESCURO if x >= 5 else AZUL
                por(img, 1 + x, 1 + y, cor)
    # faixa vermelha na base (a cor da alma)
    for x in range(3, 9):
        por(img, x, 10, VERMELHO if x < 7 else VERMELHO_ESCURO)
    contornar(img)
    return img


def gerar_seta():
    n = 14
    img = nova(n, n)
    for y in range(n):
        for x in range(n):
            # triângulo apontando para a direita
            fx = x - 1
            lim = (12 - fx) * 0.5
            if 0 <= fx <= 12 and abs(y - 6.5) <= lim:
                por(img, x, y, GELO if y < 6.5 else CIANO)
    contornar(img, AZUL_ESCURO)
    return img


# ---------- Controle da Alma ----------


def alma_quadro(quadro):
    img = nova(22, 20)
    for y, fila in enumerate(ALMA):
        for x, ch in enumerate(fila):
            if ch != 'X':
                continue
            sombra = (x >= 7 and y >= 4) or y >= 7
            cor = VERMELHO_ESCURO if sombra else VERMELHO
            if quadro == 1 and not sombra:
                cor = (255, 80, 96)
            for sy in range(2):
                for sx in range(2):
                    por(img, x * 2 + sx, y * 2 + sy, cor)
    for p in [(3, 2), (4, 2), (2, 3), (2, 4), (3, 3)]:
        por(img, *p, ROSA)
    por(img, 4, 3, BRANCO)
    if quadro == 1:
        por(img, 5, 2, BRANCO)
        por(img, 3, 5, ROSA)
    img2 = nova(24, 22)
    img2.paste(img, (1, 1))
    contornar(img2)
    return img2


def gerar_alma():
    return folha([alma_quadro(0), alma_quadro(1)])


def gerar_caco():
    n = 10
    img = nova(n, n)
    c = 4.5
    for y in range(n):
        for x in range(n):
            d = abs(x - c) + abs(y - c) * 1.2
            if d <= 4.2:
                por(img, x, y, ROSA if d <= 1.3 else (VERMELHO if x <= c else VERMELHO_ESCURO))
    contornar(img, NAVY)
    return img


# ---------- Armadilha de Espinhos ----------

FUROS = [(7, 7), (16, 7), (11.5, 11.5), (7, 16), (16, 16)]


def placa(quadro):
    n = 24
    img = nova(n, n)
    # chapa de metal com bisel
    for y in range(2, 22):
        for x in range(2, 22):
            cor = GUARDA
            if x == 2 or y == 2:
                cor = GUARDA_CLARA
            elif x == 21 or y == 21:
                cor = NAVY
            por(img, x, y, cor)
    # rebites nos cantos
    for p in [(4, 4), (19, 4), (4, 19), (19, 19)]:
        por(img, *p, ACO)
    # borda vermelha quando clicou
    if quadro == 1:
        for k in range(2, 22):
            for p in [(k, 2), (k, 21), (2, k), (21, k)]:
                por(img, *p, VERMELHO if (k // 2) % 2 else VERMELHO_ESCURO)
    for fx, fy in FUROS:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if abs(dx) + abs(dy) <= 1 or quadro == 2:
                    cor = NAVY
                    if quadro == 1:
                        cor = VERMELHO if dx == 0 and dy == 0 else VERMELHO_ESCURO
                    por(img, fx + dx, fy + dy, cor)
    if quadro == 2:
        # espinhos subindo de cada furo (cones vistos meio de cima)
        for fx, fy in FUROS:
            alto = 8
            for k in range(alto):
                meia = (alto - k) * 0.38
                yy = fy - k
                for dx in np.arange(-meia, meia + 0.01, 0.5):
                    x = fx + dx
                    cor = GELO if dx < -0.4 else (ACO if dx < 0.6 else ACO_ESCURO)
                    if k >= alto - 2:
                        cor = BRANCO
                    por(img, round(x), yy, cor)
    contornar(img)
    return img


def gerar_placa():
    return folha([placa(0), placa(1), placa(2)])


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


def sons():
    taxa = 22050
    rng = np.random.default_rng(21)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    def media(x, n):
        return np.convolve(x, np.ones(n) / n, mode='same')

    # corte: zuuum grave de espada pesada girando
    t = tempo(0.42)
    ruido = rng.normal(0, 1, len(t))
    ch = media(ruido, 4) - media(ruido, 30)
    env = np.sin(np.pi * np.clip(t / 0.42, 0, 1)) ** 1.5
    zum = np.sin(2 * np.pi * (180 + 520 * t) * t) * 0.35
    salvar_som('corte.wav', (ch * 1.2 + zum) * env)

    # estoque: "shing" metálico curto
    t = tempo(0.3)
    ruido = rng.normal(0, 1, len(t)) * np.exp(-t * 60) * 0.6
    tinido = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2350, 14), (3120, 18), (4410, 22)]) * 0.4
    salvar_som('estoque.wav', ruido + tinido)

    # passo: pisada surda
    t = tempo(0.16)
    baque = np.sin(2 * np.pi * (110 * np.exp(-t * 30) + 55) * t) * np.exp(-t * 28)
    poeira = media(rng.normal(0, 1, len(t)), 6) * np.exp(-t * 40) * 0.7
    salvar_som('passo.wav', baque + poeira)

    # olhar: piscada aguda ("pling" descendo)
    t = tempo(0.25)
    f = 1500 * np.exp(-t * 6) + 500
    fase = 2 * np.pi * np.cumsum(f) / taxa
    salvar_som('olhar.wav', np.sin(fase) * np.exp(-t * 14))

    # pulso: a alma bate e solta o anel
    t = tempo(0.5)
    s = np.zeros_like(t)
    for ini, forca in [(0.0, 0.6), (0.14, 1.0)]:
        tt = t - ini
        m = tt >= 0
        f = 90 * np.exp(-tt[m] * 10) + 60
        fase = 2 * np.pi * np.cumsum(f) / taxa
        s[m] += forca * np.sin(fase) * np.exp(-tt[m] * 16)
    salvar_som('pulso.wav', s)

    # clique: mecanismo da placa armando
    t = tempo(0.08)
    clique = (np.sin(2 * np.pi * 2900 * t) + 0.6 * np.sin(2 * np.pi * 1700 * t)) * np.exp(-t * 90)
    clique += rng.normal(0, 1, len(t)) * np.exp(-t * 200) * 0.6
    salvar_som('clique.wav', clique)

    # espinhos: estalo metálico subindo
    t = tempo(0.28)
    ruido = (rng.normal(0, 1, len(t)) - media(rng.normal(0, 1, len(t)), 8)) * np.exp(-t * 25)
    sobe = np.sin(2 * np.pi * (700 + 2600 * t) * t) * np.exp(-t * 12) * 0.5
    salvar_som('espinhos.wav', ruido + sobe)


def main():
    salvar(gerar_espada(), 'espada.png')
    salvar(gerar_florete(), 'florete.png')
    salvar(gerar_olho(), 'olho.png')
    salvar(gerar_clarao(), 'clarao.png')
    salvar(gerar_brilho(), 'brilho.png')
    salvar(gerar_pegada(), 'pegada.png')
    salvar(gerar_pisada(), 'pisada.png')
    salvar(gerar_peao(), 'peao.png')
    salvar(gerar_seta(), 'seta.png')
    salvar(gerar_alma(), 'alma.png')
    salvar(gerar_caco(), 'caco.png')
    salvar(gerar_placa(), 'placa.png')
    sons()


if __name__ == '__main__':
    main()
