#!/usr/bin/env python3
"""Gera os sprites do TELÃO do menu inicial em public/assets/sprites/menu/telao/
e o som de ligar em public/assets/audio/menu/telao/.

Uso (na raiz do projeto):  python3 scripts/menu/telao.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/menu/sprites/telao.js), medidas casadas com TELA
de src/game/menu/layout.js (310x196):
  moldura.png   342x250  a TV: bisel grosso e escuro em volta da tela (buraco
                         transparente de 310x196 em (16,14)), placa "DODGE",
                         suportes na parede e a barra de som embaixo
  reflexo.png   342x250  a luz da tela batendo no bisel (branco + alfa; o jogo
                         pinta com a cor do telão e soma)
  vidro.png     310x196  cara de tela: scanlines, vinheta e o reflexo do vidro
  chiado.png    4 quadros 155x98  estática (mostrada em escala 2)
  grade.png     20x20    ladrilho da grade de fundo da batalha (branco)
  brilho.png    64x64    brilho redondo e suave (halo e a explosão de luz)
"""

import math
import os
import wave

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'menu', 'telao')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'menu', 'telao')

# geometria (tem que bater com TELA de layout.js e com telao.js)
TELA_L, TELA_A = 310, 196
BORDA_X, BORDA_TOPO, BORDA_BAIXO = 16, 14, 22
MOLDURA_L = TELA_L + 2 * BORDA_X  # 342
CORPO_A = TELA_A + BORDA_TOPO + BORDA_BAIXO  # 232
MOLDURA_A = 250  # corpo + barra de som

# paleta (azul-marinho escuro, dessaturada, como o quarto)
CONTORNO = (4, 5, 10)
CORPO = (20, 23, 36)
CORPO_CLARO = (30, 35, 54)
LUZ = (48, 56, 84)
SOMBRA = (12, 14, 23)
LABIO = (8, 9, 15)
LABIO_LUZ = (26, 30, 46)
PLACA = (38, 44, 66)
PLACA_LETRA = (74, 84, 118)
GRADE_SOM = (9, 10, 17)


def nova(largura, altura):
    return np.zeros((altura, largura, 4), np.uint8)


def ret(img, x0, y0, x1, y1, cor, alfa=255):
    """Retângulo cheio, x1/y1 exclusivos."""
    img[y0:y1, x0:x1, :3] = cor
    img[y0:y1, x0:x1, 3] = alfa


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    Image.fromarray(img, 'RGBA').save(os.path.join(SAIDA, nome))


# fonte 3x5 para a plaquinha
LETRAS = {
    'D': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
    'O': ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
    'G': ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
    'E': ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
}


def texto(img, x, y, palavra, cor):
    for i, ch in enumerate(palavra):
        for dy, linha in enumerate(LETRAS[ch]):
            for dx, c in enumerate(linha):
                if c == 'X':
                    img[y + dy, x + i * 4 + dx, :3] = cor
                    img[y + dy, x + i * 4 + dx, 3] = 255


# ---------- moldura ----------


def gerar_moldura():
    rng = np.random.default_rng(31)
    img = nova(MOLDURA_L, MOLDURA_A)
    L, A = MOLDURA_L, CORPO_A
    tx0, ty0 = BORDA_X, BORDA_TOPO
    tx1, ty1 = tx0 + TELA_L, ty0 + TELA_A

    # suportes na parede (aparecem atrás, saindo por cima e por baixo)
    for sx in (60, L - 66):
        ret(img, sx, 0, sx + 6, A + 2, CONTORNO)
        ret(img, sx + 1, 0, sx + 5, A + 1, SOMBRA)
        ret(img, sx + 1, 0, sx + 2, A + 1, CORPO)

    # corpo: contorno escuro, cantos arredondados de 2 px
    ret(img, 0, 0, L, A, CONTORNO)
    ret(img, 1, 1, L - 1, A - 1, CORPO)
    for (cx, cy) in ((0, 0), (L - 1, 0), (0, A - 1), (L - 1, A - 1)):
        img[cy, cx, 3] = 0
    for (cx, cy) in ((1, 1), (L - 2, 1), (1, A - 2), (L - 2, A - 2)):
        img[cy, cx, :3] = CONTORNO
    # bisel: luz em cima/esquerda, sombra embaixo/direita
    ret(img, 2, 1, L - 2, 2, LUZ)
    ret(img, 1, 2, 2, A - 2, CORPO_CLARO)
    ret(img, 2, 2, L - 2, 3, CORPO_CLARO)
    ret(img, 2, A - 2, L - 2, A - 1, SOMBRA)
    ret(img, L - 2, 2, L - 1, A - 2, SOMBRA)
    ret(img, 2, A - 3, L - 2, A - 2, (16, 18, 29))
    # textura leve (plástico fosco)
    ruido = rng.integers(-2, 3, (A, L, 1))
    m = (img[:A, :, 3] > 0)[..., None]
    img[:A, :, :3] = np.where(m, np.clip(img[:A, :, :3].astype(int) + ruido, 0, 255), img[:A, :, :3]).astype(np.uint8)

    # lábio fundo em volta da tela (degrau para dentro)
    ret(img, tx0 - 4, ty0 - 4, tx1 + 4, ty1 + 4, SOMBRA)
    ret(img, tx0 - 3, ty0 - 3, tx1 + 3, ty1 + 3, LABIO)
    ret(img, tx0 - 4, ty1 + 3, tx1 + 4, ty1 + 4, LABIO_LUZ)  # aresta de baixo pega luz
    ret(img, tx1 + 3, ty0 - 4, tx1 + 4, ty1 + 4, LABIO_LUZ)
    ret(img, tx0 - 4, ty0 - 4, tx1 + 4, ty0 - 3, CONTORNO)
    ret(img, tx0 - 4, ty0 - 4, tx0 - 3, ty1 + 4, CONTORNO)
    # buraco da tela
    img[ty0:ty1, tx0:tx1] = 0

    # plaquinha "DODGE" no meio de baixo
    px = L // 2 - 12
    py = ty1 + 7
    ret(img, px - 1, py - 1, px + 25, py + 8, CONTORNO)
    ret(img, px, py, px + 24, py + 7, PLACA)
    ret(img, px, py, px + 24, py + 1, (52, 60, 88))
    texto(img, px + 2, py + 1, 'DODGE', PLACA_LETRA)
    # botõezinhos à direita (o LED fica no jogo, em telao.js, em x = L - 26)
    for i, bx in enumerate((L - 46, L - 40, L - 34)):
        ret(img, bx, py + 2, bx + 4, py + 5, CONTORNO)
        ret(img, bx, py + 2, bx + 4, py + 3, (40, 46, 68))
    ret(img, L - 28, py + 1, L - 23, py + 6, CONTORNO)  # cavidade do LED
    # parafusos nos cantos
    for (sx, sy) in ((6, 5), (L - 8, 5), (6, A - 8), (L - 8, A - 8)):
        ret(img, sx, sy, sx + 2, sy + 2, SOMBRA)
        img[sy, sx, :3] = LUZ

    # barra de som embaixo da TV
    bx0, bx1 = 70, L - 70
    by0, by1 = A + 4, MOLDURA_A - 1
    ret(img, bx0, by0, bx1, by1, CONTORNO)
    ret(img, bx0 + 1, by0 + 1, bx1 - 1, by1 - 1, CORPO)
    ret(img, bx0 + 1, by0 + 1, bx1 - 1, by0 + 2, LUZ)
    ret(img, bx0 + 1, by1 - 2, bx1 - 1, by1 - 1, SOMBRA)
    for x in range(bx0 + 6, bx1 - 6, 3):
        for y in range(by0 + 4, by1 - 3, 3):
            img[y, x, :3] = GRADE_SOM
            img[y, x, 3] = 255
    ret(img, bx0, by1, bx1, by1 + 1, (0, 0, 0), 0)
    return img


def gerar_reflexo():
    """Luz da tela no bisel: forte na borda da tela, apagando para fora."""
    img = nova(MOLDURA_L, MOLDURA_A)
    tx0, ty0 = BORDA_X, BORDA_TOPO
    tx1, ty1 = tx0 + TELA_L, ty0 + TELA_A
    ys, xs = np.mgrid[0:MOLDURA_A, 0:MOLDURA_L]
    dx = np.maximum(np.maximum(tx0 - xs, xs - (tx1 - 1)), 0)
    dy = np.maximum(np.maximum(ty0 - ys, ys - (ty1 - 1)), 0)
    d = np.sqrt(dx ** 2 + dy ** 2)
    a = np.where(d > 0, 120 * np.exp(-d / 6.5), 0)
    # degraus em 4 níveis (pixel art, nada de degradê liso)
    a = np.floor(a / 22) * 22
    # o lábio de baixo e o de dentro acendem mais (aresta virada para a luz)
    a[ty1 + 3, tx0 - 4:tx1 + 4] = np.maximum(a[ty1 + 3, tx0 - 4:tx1 + 4], 110)
    a[ty0 - 3:ty1 + 4, tx1 + 3] = np.maximum(a[ty0 - 3:ty1 + 4, tx1 + 3], 90)
    # barra de som: a aresta de cima pega um pouco
    a[CORPO_A + 5, 71:MOLDURA_L - 71] = 70
    # cantos de fora do corpo não brilham
    a[CORPO_A:CORPO_A + 4, :] = 0
    a[:, :1] = 0
    a[:, -1:] = 0
    img[..., :3] = 255
    img[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    img[ty0:ty1, tx0:tx1] = 0
    return img


# ---------- tela ----------


def gerar_vidro():
    img = nova(TELA_L, TELA_A)
    ys, xs = np.mgrid[0:TELA_A, 0:TELA_L].astype(float)
    # vinheta (cantos de CRT): distância normalizada "arredondada"
    nx = (xs + 0.5 - TELA_L / 2) / (TELA_L / 2)
    ny = (ys + 0.5 - TELA_A / 2) / (TELA_A / 2)
    r = (np.abs(nx) ** 4 + np.abs(ny) ** 4) ** 0.25
    vinheta = np.clip((r - 0.8) / 0.2, 0, 1) ** 1.8 * 170
    vinheta = np.floor(vinheta / 34) * 34
    # scanlines: uma linha escura a cada 2
    scan = np.where(ys.astype(int) % 2 == 1, 46, 0)
    alfa_escuro = np.clip(vinheta + scan * (1 - vinheta / 255), 0, 255)
    # reflexo do vidro: faixa diagonal suave no alto à esquerda
    faixa = (xs * 0.55 + ys)  # constante ao longo da diagonal
    brilho = np.where((faixa > 70) & (faixa < 100), 20, 0) + np.where((faixa > 108) & (faixa < 114), 16, 0)
    brilho = brilho * np.clip(1.2 - ys / 90, 0, 1)
    brilho = np.floor(brilho / 6) * 6
    # cor final: preto com alfa; onde há reflexo vira branco translúcido
    branco = brilho > alfa_escuro * 0.5
    img[..., :3] = np.where(branco[..., None], 255, 0)
    img[..., 3] = np.where(branco, brilho, alfa_escuro).astype(np.uint8)
    return img


def gerar_chiado():
    rng = np.random.default_rng(77)
    l, a = 155, 98
    folha = nova(l * 4, a)
    for q in range(4):
        v = rng.random((a, l))
        # faixas horizontais mais claras/escuras (sinal ruim)
        faixa = rng.random(a)[:, None] * 0.5 + 0.5
        for _ in range(3):
            y0 = rng.integers(0, a - 6)
            faixa[y0:y0 + rng.integers(2, 6)] *= 1.6
        v = np.clip(v * faixa, 0, 1)
        cinza = (np.floor(v * 4) / 3 * 255).astype(np.uint8)
        q0 = q * l
        folha[:, q0:q0 + l, 0] = cinza
        folha[:, q0:q0 + l, 1] = cinza
        folha[:, q0:q0 + l, 2] = np.clip(cinza.astype(int) + 12, 0, 255)
        folha[:, q0:q0 + l, 3] = 255
    return folha


def gerar_grade():
    img = nova(20, 20)
    img[0, :, :] = (255, 255, 255, 255)
    img[:, 0, :] = (255, 255, 255, 255)
    img[10, 10, :] = (255, 255, 255, 160)
    return img


def gerar_brilho():
    img = nova(64, 64)
    ys, xs = np.mgrid[0:64, 0:64].astype(float)
    d = np.sqrt((xs - 31.5) ** 2 + (ys - 31.5) ** 2) / 32
    a = np.clip(1 - d, 0, 1) ** 2 * 255
    img[..., :3] = 255
    img[..., 3] = a.astype(np.uint8)
    return img


# ---------- som ----------


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
    rng = np.random.default_rng(5)
    t = np.arange(int(taxa * 0.75)) / taxa
    # TV de tubo ligando: estalo do relé, "tunc" grave da desmagnetização,
    # um chiado curto e o apito agudo que some
    estalo = rng.normal(0, 1, len(t)) * np.exp(-t * 90)
    tunc = np.sin(2 * np.pi * (70 * np.exp(-t * 6) + 40) * t) * np.exp(-t * 7) * 0.9
    chiado = rng.normal(0, 1, len(t)) * np.clip((t - 0.05) / 0.03, 0, 1) * np.exp(-np.clip(t - 0.08, 0, None) * 14) * 0.25
    apito = np.sin(2 * np.pi * 7800 * t) * np.clip((t - 0.06) / 0.02, 0, 1) * np.exp(-np.clip(t - 0.08, 0, None) * 6) * 0.06
    salvar_som('ligar.wav', estalo * 0.8 + tunc + chiado + apito)


def main():
    salvar(gerar_moldura(), 'moldura.png')
    salvar(gerar_reflexo(), 'reflexo.png')
    salvar(gerar_vidro(), 'vidro.png')
    salvar(gerar_chiado(), 'chiado.png')
    salvar(gerar_grade(), 'grade.png')
    salvar(gerar_brilho(), 'brilho.png')
    sons()


if __name__ == '__main__':
    main()
