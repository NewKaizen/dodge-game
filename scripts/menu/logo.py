#!/usr/bin/env python3
"""Gera os sprites e sons do LOGO do menu inicial (src/game/menu/logo.js) em
public/assets/sprites/menu/logo/ e public/assets/audio/menu/logo/.

Uso (na raiz do projeto):  python3 scripts/menu/logo.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

As letras são tubos de neon desenhados por caminhos (retas e arcos "quadrados")
numa grade de células de 2x2 px: o centro do tubo é quase branco, as bordas
rosa/magenta, a parte de baixo puxa para o roxo, há um degrau escuro embaixo
(a lateral da letra-caixa) e um contorno escuro grosso em volta.

Sprites (chaves em src/game/menu/sprites/logo.js):
  letras.png     quadros 92x100, um por letra de GLIFOS: a letra acesa
  apagadas.png   quadros 92x100: a mesma letra com o neon apagado (mau contato)
  brilho.png     quadros 92x100: o halo da letra (desenhado com blend ADD)
  alma.png       13x12   a alma vermelha que mora dentro do O
  alma-brilho.png 40x40  halo vermelho da alma
  disco.png      156x156 o disco do radar (fundo, anéis fixos)
  anel.png       156x156 anel pontilhado + arcos (gira devagar)
  varredura.png  156x156 a varredura do radar (blend ADD, gira)
  ping.png       156x156 anel fino que se expande no compasso

Sons:
  acender.wav  estalo + zumbido do neon acendendo
  falha.wav    chiado curtinho do mau contato (bem baixo)
  glitch.wav   gaguejo digital (baixo)
  alma.wav     a alma aparecendo dentro do O
"""

import json
import math
import os
import wave

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'menu', 'logo')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'menu', 'logo')

GLIFOS = 'DOGE'  # letras desenhadas (o JS cai no texto para as outras)

# ---------- paleta ----------
CONTORNO = (16, 6, 28)
# neon aceso: centro -> borda (rosa) e a parte de baixo (roxo)
ROSA = [(255, 238, 248), (255, 156, 208), (255, 61, 139), (204, 28, 118)]
ROXO = [(246, 226, 255), (226, 140, 255), (178, 66, 226), (124, 36, 168)]
# neon apagado
ROSA_OFF = [(118, 68, 108), (88, 44, 84), (70, 32, 70), (56, 24, 58)]
ROXO_OFF = [(100, 64, 118), (76, 44, 96), (60, 32, 82), (48, 24, 68)]
# degrau (lateral da letra)
DEGRAU = [(118, 22, 98), (78, 14, 76), (52, 10, 58)]
DEGRAU_OFF = [(56, 22, 56), (42, 16, 46), (32, 12, 38)]
BRILHO = (255, 64, 172)

CIANO = (63, 214, 200)
CIANO_CLARO = (170, 255, 244)
CIANO_ESCURO = (28, 92, 104)

VERMELHO = (255, 36, 56)
VERMELHO_ESCURO = (150, 10, 36)
ROSA_ALMA = (255, 176, 186)

# ---------- grade das letras ----------
S = 2  # px por célula
R = 3.2  # meia espessura do tubo (células)
H = 23  # altura do caminho (células)
P = 5  # margem esquerda/topo (células) dentro do quadro
G = 14  # margem do halo (px)
QW, QH = 92, 100  # quadro (px)
CW, CH = (QW - 2 * G) // S, (QH - 2 * G) // S  # quadro em células (28 x 36)
DEGRAU_N = 3  # altura do degrau (células)


def squircle(cx, cy, a, b, t0, t1, n=3.4, passos=900):
    """Pontos de um arco de superelipse (cantos quadrados) de t0 a t1 (graus, y para cima)."""
    pts = []
    for i in range(passos + 1):
        t = math.radians(t0 + (t1 - t0) * i / passos)
        c, s = math.cos(t), math.sin(t)
        x = cx + a * math.copysign(abs(c) ** (2 / n), c)
        y = cy - b * math.copysign(abs(s) ** (2 / n), s)
        pts.append((x, y))
    return pts


def reta(x0, y0, x1, y1, passo=0.05):
    n = max(1, int(math.hypot(x1 - x0, y1 - y0) / passo))
    return [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) for i in range(n + 1)]


def caminho(letra):
    """Centro do tubo de cada letra (coordenadas em células, topo-esquerda = 0,0)."""
    m = H / 2
    if letra == 'D':
        return reta(0, 0, 0, H) + reta(0, 0, 4, 0) + reta(0, H, 4, H) + squircle(4, m, 10, m, 90, -90)
    if letra == 'O':
        return squircle(9, m, 9, m, 0, 360)
    if letra == 'G':
        return squircle(8, m, 8, m, 40, 360) + reta(16, m, 9, m) + reta(16, m, 16, m + 1)
    if letra == 'E':
        return reta(0, 0, 0, H) + reta(0, 0, 12, 0) + reta(0, m, 9, m) + reta(0, H, 12, H)
    raise ValueError(letra)


def distancia(pts):
    """Distância (em células) de cada célula do quadro ao caminho."""
    p = np.array(pts)
    ys, xs = np.mgrid[0:CH, 0:CW]
    px = (xs - P).reshape(-1, 1)
    py = (ys - P).reshape(-1, 1)
    d = np.sqrt((px - p[:, 0]) ** 2 + (py - p[:, 1]) ** 2).min(axis=1)
    return d.reshape(CH, CW)


def dilatar(m, viz8=True):
    out = m.copy()
    out[1:, :] |= m[:-1, :]
    out[:-1, :] |= m[1:, :]
    out[:, 1:] |= m[:, :-1]
    out[:, :-1] |= m[:, 1:]
    if viz8:
        out[1:, 1:] |= m[:-1, :-1]
        out[1:, :-1] |= m[:-1, 1:]
        out[:-1, 1:] |= m[1:, :-1]
        out[:-1, :-1] |= m[1:, 1:]
    return out


def celulas_para_px(cel):
    """Matriz de células RGBA -> imagem do quadro (com a margem do halo)."""
    img = np.zeros((QH, QW, 4), np.uint8)
    grande = np.repeat(np.repeat(cel, S, axis=0), S, axis=1)
    img[G:G + CH * S, G:G + CW * S] = grande
    return img


def letra_celulas(letra, aceso=True):
    d = distancia(caminho(letra))
    corpo = d <= R
    degrau = np.zeros_like(corpo)
    for k in range(1, DEGRAU_N + 1):
        degrau[k:, :] |= corpo[:-k, :]
    degrau &= ~corpo
    tudo = corpo | degrau
    contorno = dilatar(dilatar(tudo, True), False) & ~tudo

    cel = np.zeros((CH, CW, 4), np.uint8)
    rosa, roxo = (ROSA, ROXO) if aceso else (ROSA_OFF, ROXO_OFF)
    deg = DEGRAU if aceso else DEGRAU_OFF
    for y in range(CH):
        for x in range(CW):
            if corpo[y, x]:
                fy = (y - P) / H  # 0 em cima, 1 embaixo
                # rosa em cima, roxo embaixo, com uma fileira pontilhada na troca
                roxa = fy > 0.75 or (fy > 0.70 and (x + y) % 2 == 0)
                pal = roxo if roxa else rosa
                dd = d[y, x]
                i = 0 if dd <= 0.6 else 1 if dd <= 1.6 else 2 if dd <= 2.6 else 3
                cor = pal[i]
                cel[y, x] = (*cor, 255)
            elif degrau[y, x]:
                # quão abaixo do corpo: 1 = logo embaixo (mais claro)
                k = next(k for k in range(1, DEGRAU_N + 1) if y - k >= 0 and corpo[y - k, x])
                cel[y, x] = (*deg[min(k - 1, 2)], 255)
            elif contorno[y, x]:
                cel[y, x] = (*CONTORNO, 255)
    # reflexo no tubo aceso: um risquinho branco na borda de cima, perto da quina esquerda
    if aceso:
        topo = min(y for y in range(CH) if corpo[y].any())
        xs = [x for x in range(CW) if corpo[topo, x]]
        for x in xs[1:4]:
            cel[topo + 1, x] = (255, 255, 255, 255)
    return cel, corpo


def blur(a, sigma):
    r = int(sigma * 3)
    k = np.exp(-(np.arange(-r, r + 1) ** 2) / (2 * sigma * sigma))
    k /= k.sum()
    a = np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), 0, a)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), 1, a)


def halo(corpo, cor, sigma=4.2, forca=1.5, niveis=7):
    m = np.zeros((QH, QW), float)
    grande = np.repeat(np.repeat(corpo.astype(float), S, axis=0), S, axis=1)
    m[G:G + CH * S, G:G + CW * S] = grande
    b = np.clip(blur(m, sigma) * forca, 0, 1)
    b = np.round(b * niveis) / niveis  # degraus: halo "pixelado"
    img = np.zeros((QH, QW, 4), np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = cor
    img[..., 3] = (b * 230).astype(np.uint8)
    return img


def medir(img):
    """Primeira e última coluna opaca (px) do quadro."""
    cols = np.where(img[..., 3].max(axis=0) > 0)[0]
    return int(cols[0]), int(cols[-1]) + 1


def gerar_letras():
    acesas, apagadas, brilhos, medidas = [], [], [], {}
    for letra in GLIFOS:
        cel, corpo = letra_celulas(letra, True)
        cel_off, _ = letra_celulas(letra, False)
        a = celulas_para_px(cel)
        acesas.append(a)
        apagadas.append(celulas_para_px(cel_off))
        brilhos.append(halo(corpo, BRILHO))
        medidas[letra] = medir(a)
    tira = lambda lst: Image.fromarray(np.concatenate(lst, axis=1), 'RGBA')
    tira(acesas).save(os.path.join(SAIDA, 'letras.png'))
    tira(apagadas).save(os.path.join(SAIDA, 'apagadas.png'))
    tira(brilhos).save(os.path.join(SAIDA, 'brilho.png'))
    # onde fica o miolo do O (para a alma): centro do caminho, um pouco abaixo por causa do degrau
    miolo = (G + (P + 9) * S, G + (P + 13.2) * S)
    return medidas, miolo


# ---------- a alma (coração) ----------
# a mesma alma 11x10 do jogo, em 1 px (cabe no miolo do O)
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


def gerar_alma():
    cel = np.zeros((12, 13, 4), np.uint8)
    corpo = np.zeros((12, 13), bool)
    for y, fila in enumerate(ALMA):
        for x, c in enumerate(fila):
            if c == 'X':
                corpo[y + 1, x + 1] = True
                sombra = (x >= 7 and y >= 4) or y >= 7
                cel[y + 1, x + 1] = (*(VERMELHO_ESCURO if sombra else VERMELHO), 255)
    cel[2, 3] = (*ROSA_ALMA, 255)
    cel[3, 2] = (*ROSA_ALMA, 255)
    cel[2, 2] = (255, 255, 255, 255)
    cont = dilatar(corpo, False) & ~corpo
    cel[cont] = (*CONTORNO, 255)
    Image.fromarray(cel, 'RGBA').save(os.path.join(SAIDA, 'alma.png'))

    # halo vermelho
    m = np.zeros((40, 40), float)
    m[14:26, 13:26] = corpo.astype(float)
    b = np.round(np.clip(blur(m, 3.5) * 2.2, 0, 1) * 6) / 6
    h = np.zeros((40, 40, 4), np.uint8)
    h[..., 0], h[..., 1], h[..., 2] = (255, 40, 60)
    h[..., 3] = (b * 220).astype(np.uint8)
    Image.fromarray(h, 'RGBA').save(os.path.join(SAIDA, 'alma-brilho.png'))


# ---------- o disco do radar ----------
D = 156
C = (D - 1) / 2
RD = 74  # raio do disco (até o contorno)


def grade_polar():
    ys, xs = np.mgrid[0:D, 0:D]
    dx, dy = xs - C, ys - C
    return np.hypot(dx, dy), (np.degrees(np.arctan2(-dy, dx)) + 360) % 360


def pintar(img, mascara, cor, alfa=255):
    img[mascara] = (*cor, alfa)


def no_raio(img, rr, t, cor, alfa=255):
    a = math.radians(t)
    img[int(round(C - rr * math.sin(a))), int(round(C + rr * math.cos(a)))] = (*cor, alfa)


def gerar_disco():
    r, ang = grade_polar()
    img = np.zeros((D, D, 4), np.uint8)
    # fundo: azul-marinho, um pouco mais claro no meio (degraus)
    for lim, cor in [(RD - 1.5, (10, 16, 32)), (58, (12, 21, 40)), (44, (14, 25, 46)), (29, (17, 30, 54))]:
        pintar(img, r <= lim, cor, 230)
    # aro de fora grosso
    pintar(img, (r > RD - 6) & (r <= RD - 1.5), (20, 38, 60), 245)
    pintar(img, (r > RD - 1.5) & (r <= RD), CONTORNO, 255)
    pintar(img, (r > RD - 7) & (r <= RD - 6), CIANO_ESCURO, 255)
    pintar(img, (r > RD - 2.5) & (r <= RD - 1.5), (40, 84, 108), 255)
    # anéis finos
    for rr, cor in [(52, CIANO_ESCURO), (37, (26, 72, 88)), (22, (22, 58, 74))]:
        pintar(img, (r > rr - 0.5) & (r <= rr + 0.5), cor, 255)
    # mira: tracejado nas quatro direções
    ys, xs = np.mgrid[0:D, 0:D]
    for eixo in (np.abs(xs - C) < 0.6, np.abs(ys - C) < 0.6):
        traco = eixo & (r > 8) & (r < RD - 8) & ((r.astype(int) // 3) % 2 == 0)
        pintar(img, traco, (26, 62, 80), 255)
    Image.fromarray(img, 'RGBA').save(os.path.join(SAIDA, 'disco.png'))


def gerar_anel():
    r, ang = grade_polar()
    img = np.zeros((D, D, 4), np.uint8)
    # pontinhos no anel de 61 (a cada 7.5 graus), quatro maiores e mais claros
    for i in range(48):
        a = math.radians(i * 7.5)
        xi, yi = int(round(C + 61 * math.cos(a))), int(round(C - 61 * math.sin(a)))
        if i % 12 == 0:
            img[yi - 1:yi + 1, xi - 1:xi + 1] = (*CIANO_CLARO, 255)
        else:
            img[yi, xi] = (*CIANO, 255 if i % 2 == 0 else 150)
    # arcos quebrados no raio 45
    for ini, fim in [(10, 70), (130, 175), (220, 300)]:
        m = (r > 44.5) & (r <= 45.5) & (ang >= ini) & (ang <= fim)
        pintar(img, m, CIANO, 210)
        for t in (ini, fim):  # pontas mais claras
            no_raio(img, 45, t, CIANO_CLARO)
    # risquinhos no aro (a cada 30 graus)
    for i in range(12):
        for rr in (RD - 5.5, RD - 4.5, RD - 3.5):
            no_raio(img, rr, i * 30 + 15, CIANO, 235)
    # pontinhos soltos no anel de 30
    for t in (40, 160, 250, 330):
        no_raio(img, 30, t, CIANO_CLARO, 220)
    Image.fromarray(img, 'RGBA').save(os.path.join(SAIDA, 'anel.png'))


def gerar_varredura():
    r, ang = grade_polar()
    img = np.zeros((D, D, 4), np.uint8)
    # a frente da varredura em 0 graus; o rastro fica atrás (gira no sentido horário)
    m = (r <= RD - 8) & (ang <= 70)
    a = np.round((1 - ang / 70) * 5) / 5 * 120
    img[..., 0], img[..., 1], img[..., 2] = CIANO
    img[..., 3] = np.where(m, a, 0).astype(np.uint8)
    pintar(img, (r <= RD - 8) & (r > 4) & (ang <= 2.2), CIANO_CLARO, 200)
    Image.fromarray(img, 'RGBA').save(os.path.join(SAIDA, 'varredura.png'))


def gerar_ping():
    r, _ = grade_polar()
    img = np.zeros((D, D, 4), np.uint8)
    pintar(img, (r > RD - 1.5) & (r <= RD - 0.5), CIANO_CLARO, 255)
    pintar(img, (r > RD - 2.5) & (r <= RD - 1.5), CIANO, 140)
    Image.fromarray(img, 'RGBA').save(os.path.join(SAIDA, 'ping.png'))


# ---------- sons ----------
TAXA = 22050


def salvar_som(nome, amostras, pico_final):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    pico = np.max(np.abs(amostras)) or 1
    s = (amostras / pico * pico_final * 32767).astype(np.int16)
    with wave.open(os.path.join(SAIDA_SOM, nome), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(s.tobytes())


def tempo(seg):
    return np.arange(int(TAXA * seg)) / TAXA


def zumbido(t, f=120):
    """Zumbido de reator de neon: harmônicos ímpares de 120 Hz."""
    return sum(np.sign(np.sin(2 * np.pi * f * h * t)) / h for h in (1, 3, 5)) * 0.4 + np.sin(2 * np.pi * f * 2 * t) * 0.3


def sons():
    rng = np.random.default_rng(31)

    # acender: tique seco + estalos + zumbido que liga e assenta
    t = tempo(0.32)
    tique = rng.normal(0, 1, len(t)) * np.exp(-t * 260)
    estalos = np.zeros_like(t)
    for ini in (0.0, 0.025, 0.06):
        i = int(ini * TAXA)
        n = int(0.006 * TAXA)
        estalos[i:i + n] += rng.normal(0, 1, n) * 0.8
    env = np.clip(t / 0.01, 0, 1) * np.exp(-t * 9)
    corta = np.where((t > 0.03) & (t < 0.05), 0.2, 1.0)  # a falhinha no meio
    s = tique * 0.9 + estalos + zumbido(t) * env * corta * 0.7
    salvar_som('acender.wav', s, 0.5)

    # falha: chiadinho curto
    t = tempo(0.12)
    picote = (rng.random(len(t)) < 0.5).astype(float)
    picote = np.repeat(picote[::90], 90)[: len(t)]
    s = (zumbido(t, 118) * 0.6 + rng.normal(0, 1, len(t)) * 0.3) * picote * np.exp(-t * 18)
    salvar_som('falha.wav', s, 0.16)

    # glitch: três pedaços de varredura digital esmagada (bitcrush)
    t = tempo(0.2)
    s = np.zeros_like(t)
    for k, (ini, f0, f1) in enumerate([(0.0, 1800, 600), (0.06, 300, 2400), (0.12, 900, 400)]):
        tt = t - ini
        m = (tt >= 0) & (tt < 0.05)
        f = f0 + (f1 - f0) * tt[m] / 0.05
        s[m] += np.sign(np.sin(2 * np.pi * np.cumsum(f) / TAXA))
    s = np.round(s * 3) / 3
    s = np.repeat(s[::6], 6)[: len(t)]
    salvar_som('glitch.wav', s * np.exp(-t * 6), 0.2)

    # alma: "tum" grave + brilhinho subindo
    t = tempo(0.6)
    f = 90 * np.exp(-t * 10) + 55
    tum = np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.exp(-t * 12)
    brilho = sum(np.sin(2 * np.pi * fr * t) * np.exp(-np.clip(t - atraso, 0, None) * 9) * (t >= atraso)
                 for fr, atraso in [(1318, 0.03), (1760, 0.08), (2637, 0.13)]) * 0.18
    salvar_som('alma.wav', tum + brilho, 0.55)


def main():
    os.makedirs(SAIDA, exist_ok=True)
    medidas, miolo = gerar_letras()
    gerar_alma()
    gerar_disco()
    gerar_anel()
    gerar_varredura()
    gerar_ping()
    sons()
    print(json.dumps({'glifos': GLIFOS, 'quadro': [QW, QH], 'medidas': medidas, 'miolo': miolo}))


if __name__ == '__main__':
    main()
