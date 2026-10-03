#!/usr/bin/env python3
"""Sprites e sons das cartas normais de Dess (roqueira de guitarra e taco).

Uso (na raiz do projeto):  python3 scripts/habilidades/dess.py
Precisa de Pillow e numpy. Saída determinística (sementes fixas).

Imagens em public/assets/sprites/habilidades/dess/:
  nota.png       12x16  colcheia solta (Nota Solta, Show de Rock)
  notas.png      14x16  duas colcheias ligadas, clara (tingida) - notas do Solo de Guitarra
  guitarra.png   40x16  guitarra deitada (o Solo sai dela)
  taco.png       60x10  taco de beisebol deitado (cabo na esquerda)
  bola.png       15x15  bola de beisebol com costura vermelha (Home Run)
  impacto.png    20x20  estalo da tacada
  microfone.png  12x26  microfone em pé (Microfonia)
  chiado.png     10x10  faísca serrilhada do agudo
  palheta.png    14x16  palheta de guitarra, ponta para baixo
  caixasom.png   20x26  caixa de som com cone (Feedback)
  pulso.png      10x40  pulso de som vertical, ondulado
  lata.png       10x16  lata de fumaça com pino
  fumaca.png     32x32  nuvem de fumaça
  brasa.png      8x8    brasa acesa
  amp.png        30x22  amplificador de palco
  arco.png       40x10  frente de onda curva do amplificador
  cabo.png       8x8    elo do cabo de guitarra
  plugue.png     16x8   plugue P10 (ponta para a direita)
Sons em public/assets/audio/habilidades/dess/: tacada, rebatida, microfonia, palheta, fumaca, grave (.wav)
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'dess')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'dess')

VAZIO = (0, 0, 0, 0)

# ---------- paleta (vermelho-rosa da Dess 0xff5070, laranja de palco) ----------
CONTORNO = (20, 6, 14)
ROSA = (255, 80, 112)
ROSA_ESCURO = (150, 24, 52)
ROSA_CLARO = (255, 170, 186)
LARANJA = (255, 150, 58)
LARANJA_ESCURO = (160, 70, 20)
AMARELO = (255, 224, 80)
AMARELO_CLARO = (255, 246, 196)
BRANCO = (255, 255, 255)
CREME = (238, 230, 214)
CREME_ESCURO = (180, 168, 150)
MADEIRA = (214, 160, 96)
MADEIRA_CLARA = (240, 200, 140)
MADEIRA_ESCURA = (140, 90, 48)
ACO = (110, 104, 128)
ACO_CLARO = (200, 198, 220)
ACO_ESCURO = (56, 50, 72)
PRETO = (34, 28, 40)
CINZA = (150, 140, 160)
CINZA_CLARO = (205, 198, 212)


# ---------- utilitários ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor, alfa=255):
    x, y = int(round(x)), int(round(y))
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
    return img


def retangulo(img, x0, y0, x1, y1, cor):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            por(img, x, y, cor)


def elipse(img, cx, cy, rx, ry, cor):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                por(img, x, y, cor)


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


# ---------- notas musicais ----------


def nota():
    img = nova(12, 16)
    # cabeça inclinada (elipse) embaixo à esquerda
    elipse(img, 4, 12, 3.2, 2.4, ROSA)
    por(img, 3, 11, ROSA_CLARO)
    por(img, 4, 11, ROSA_CLARO)
    # haste
    for y in range(1, 12):
        por(img, 7, y, ROSA_ESCURO if y > 9 else ROSA)
    # bandeirola
    for i, (x, y) in enumerate([(8, 1), (8, 2), (9, 2), (9, 3), (10, 4), (10, 5), (10, 6), (9, 7)]):
        por(img, x, y, ROSA)
    por(img, 8, 3, ROSA_CLARO)
    return contornar(img)


def notas_ligadas():
    # clara para ser tingida a cada frase do solo
    img = nova(14, 16)
    elipse(img, 3, 12, 2.8, 2.2, BRANCO)
    elipse(img, 10, 11, 2.8, 2.2, BRANCO)
    for y in range(2, 12):
        por(img, 5, y, CINZA_CLARO)
    for y in range(1, 11):
        por(img, 12, y, CINZA_CLARO)
    # barra que liga as duas
    for x in range(5, 13):
        yb = 2 - (x - 5) / 7
        por(img, x, round(yb), BRANCO)
        por(img, x, round(yb) + 1, BRANCO)
    por(img, 2, 11, CINZA_CLARO)
    por(img, 9, 10, CINZA_CLARO)
    return contornar(img)


def guitarra():
    img = nova(40, 16)
    # corpo (duas curvas) à esquerda
    elipse(img, 7, 8, 6.5, 6.8, ROSA)
    elipse(img, 13, 8, 4.5, 5.0, ROSA)
    elipse(img, 6, 6, 3, 2.5, ROSA_CLARO)
    # captadores e ponte
    retangulo(img, 9, 6, 10, 10, PRETO)
    retangulo(img, 13, 6, 13, 10, PRETO)
    retangulo(img, 5, 7, 6, 9, ACO_CLARO)
    # braço
    retangulo(img, 17, 7, 33, 9, MADEIRA_ESCURA)
    for x in range(19, 33, 3):
        por(img, x, 7, ACO_CLARO)
        por(img, x, 9, ACO_CLARO)
    for x in range(5, 35):
        por(img, x, 8, ACO_CLARO)  # corda
    # cabeça
    retangulo(img, 34, 5, 38, 11, ROSA_ESCURO)
    for y in (5, 8, 11):
        por(img, 37, y, ACO_CLARO)
    # losango amarelo da Dess no corpo
    for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0), (0, 0)]:
        por(img, 4 + dx, 11 + dy, AMARELO)
    return contornar(img)


# ---------- beisebol ----------


def taco():
    img = nova(60, 10)
    cy = 4.5
    for x in range(60):
        # cabo fino (com fita) -> barril grosso, ponta arredondada
        if x < 3:
            m = 2.6  # castão (knob)
        elif x < 18:
            m = 1.6
        else:
            m = 1.6 + min(1, (x - 18) / 26) * 2.6
        if x > 56:
            m = m * math.sqrt(max(0, 1 - ((x - 56) / 4) ** 2))
        for y in range(10):
            d = y - cy
            if abs(d) <= m:
                if x < 3:
                    cor = PRETO
                elif x < 16:
                    cor = ROSA if (x // 2) % 2 == 0 else ROSA_ESCURO  # fita de grip
                else:
                    cor = MADEIRA_CLARA if d < -m * 0.35 else (MADEIRA_ESCURA if d > m * 0.5 else MADEIRA)
                por(img, x, y, cor)
    # veio da madeira
    for x in range(22, 54, 7):
        por(img, x, 5, MADEIRA_ESCURA)
        por(img, x + 1, 5, MADEIRA_ESCURA)
    return contornar(img)


def bola():
    img = nova(15, 15)
    elipse(img, 7, 7, 6.6, 6.6, CREME)
    elipse(img, 6, 5, 3.6, 3.2, BRANCO)
    # sombra
    for y in range(15):
        for x in range(15):
            if opaco(img, x, y) and (x - 7) ** 2 + (y - 7) ** 2 > 30 and x + y > 15:
                por(img, x, y, CREME_ESCURO)
    # duas costuras curvas com pontos
    for i in range(-5, 6):
        y = 7 + i
        xa = 3.0 + 0.09 * i * i
        xb = 11.0 - 0.09 * i * i
        if 0 <= y < 15:
            por(img, xa, y, ROSA)
            por(img, xb, y, ROSA)
            if i % 2 == 0:
                por(img, xa + 1, y, ROSA_ESCURO)
                por(img, xb - 1, y, ROSA_ESCURO)
    return contornar(img)


def impacto():
    img = nova(20, 20)
    c = 9.5
    for ang in range(0, 360, 2):
        a = math.radians(ang)
        # estrela de 8 pontas (forma serrilhada)
        frac = (ang % 45) / 45
        r = 9 - 5 * (1 - abs(frac * 2 - 1))
        for k in range(int(r * 2)):
            rr = k / 2
            cor = BRANCO if rr < 3 else (AMARELO if rr < 5.5 else LARANJA)
            por(img, c + math.cos(a) * rr, c + math.sin(a) * rr, cor)
    return contornar(img)


# ---------- microfone e agudo ----------


def microfone():
    img = nova(12, 26)
    # cabeça (globo com grade)
    elipse(img, 5.5, 5, 4.6, 4.8, ACO)
    for y in range(1, 10):
        for x in range(1, 11):
            if opaco(img, x, y) and (x + y) % 2 == 0:
                por(img, x, y, ACO_CLARO)
    por(img, 3, 3, BRANCO)
    # anel rosa
    retangulo(img, 2, 10, 9, 11, ROSA)
    # corpo afinando
    for y in range(12, 25):
        m = 3 - (y - 12) / 13 * 1.5
        for x in range(12):
            if abs(x - 5.5) <= m:
                por(img, x, y, PRETO if x > 5 else ACO_ESCURO)
    por(img, 5, 16, ROSA)
    por(img, 6, 16, ROSA)
    return contornar(img)


def chiado():
    img = nova(10, 10)
    pts = [(1, 5), (3, 1), (5, 7), (7, 2), (9, 5)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2
        for k in range(n + 1):
            x = x0 + (x1 - x0) * k / n
            y = y0 + (y1 - y0) * k / n
            por(img, x, y, BRANCO)
            por(img, x, y + 1, AMARELO)
    por(img, 5, 6, AMARELO_CLARO)
    return contornar(img, diagonais=True)


# ---------- palheta ----------


def palheta():
    img = nova(14, 16)
    # triângulo arredondado: largo em cima, ponta embaixo
    for y in range(16):
        for x in range(14):
            cx = 6.5
            # topo arredondado
            topo = ((x - cx) / 6.4) ** 2 + ((y - 5) / 4.6) ** 2 <= 1
            corpo = y >= 5 and abs(x - cx) <= 6.4 * (1 - (y - 5) / 10.5) ** 1.1
            if topo or corpo:
                cor = ROSA
                if x - cx < -2 and y < 9:
                    cor = ROSA_CLARO
                if y > 11:
                    cor = ROSA_ESCURO
                por(img, x, y, cor)
    # losango amarelo da Dess
    for dx, dy in [(0, -2), (0, 2), (-2, 0), (2, 0), (0, -1), (0, 1), (-1, 0), (1, 0), (0, 0)]:
        por(img, 6.5 + dx, 6 + dy, AMARELO if abs(dx) + abs(dy) < 2 else LARANJA)
    return contornar(img)


# ---------- caixa de som e pulso ----------


def caixasom():
    img = nova(20, 26)
    retangulo(img, 0, 0, 19, 25, PRETO)
    retangulo(img, 1, 1, 18, 1, ACO)
    # cone grande
    elipse(img, 9.5, 16, 7.5, 7.5, ACO_ESCURO)
    elipse(img, 9.5, 16, 5.5, 5.5, ACO)
    elipse(img, 9.5, 16, 2.5, 2.5, ROSA)
    por(img, 9, 15, ROSA_CLARO)
    # tweeter
    elipse(img, 9.5, 5, 2.6, 2.6, ACO)
    por(img, 9, 5, ACO_CLARO)
    # cantos rosa
    for x, y in [(1, 24), (18, 24), (1, 2), (18, 2)]:
        por(img, x, y, ROSA)
    return contornar(img)


def pulso():
    img = nova(10, 40)
    for y in range(40):
        x = 4.5 + 2.6 * math.sin(y / 40 * math.pi * 4)
        borda = y < 2 or y > 37
        for dx in (-1.5, -0.5, 0.5, 1.5):
            por(img, x + dx, y, ROSA_CLARO if abs(dx) < 1 else ROSA)
        if not borda:
            por(img, x, y, BRANCO)
    return contornar(img)


# ---------- fumaça ----------


def lata():
    img = nova(10, 16)
    retangulo(img, 1, 4, 8, 15, ACO)
    retangulo(img, 1, 4, 2, 15, ACO_CLARO)
    retangulo(img, 7, 4, 8, 15, ACO_ESCURO)
    retangulo(img, 1, 8, 8, 10, ROSA)  # faixa
    retangulo(img, 3, 2, 6, 3, ACO_ESCURO)  # tampa
    # pino e argola
    por(img, 7, 1, AMARELO)
    por(img, 8, 0, AMARELO)
    por(img, 9, 1, AMARELO)
    por(img, 8, 2, AMARELO)
    return contornar(img)


def fumaca():
    rng = random.Random(7)
    img = nova(32, 32)
    bolas = [(16, 17, 10), (10, 18, 7), (22, 18, 7), (13, 11, 6), (20, 12, 6), (16, 23, 6)]
    for y in range(32):
        for x in range(32):
            dentro = [r - math.hypot(x - bx, y - by) for bx, by, r in bolas]
            m = max(dentro)
            if m >= 0:
                luz = (16 - y) * 0.06 + (16 - x) * 0.03 + rng.uniform(-0.15, 0.15)
                cor = CINZA_CLARO if luz > 0.35 else (CINZA if luz > -0.35 else (110, 100, 124))
                alfa = 255 if m > 1.5 else 200
                por(img, x, y, cor, alfa)
    return img


def brasa():
    img = nova(8, 8)
    elipse(img, 3.5, 3.5, 3.2, 3.2, LARANJA)
    elipse(img, 3.5, 3.5, 2.0, 2.0, AMARELO)
    por(img, 3, 3, AMARELO_CLARO)
    por(img, 4, 3, BRANCO)
    return contornar(img)


# ---------- amplificador ----------


def amp():
    img = nova(30, 22)
    retangulo(img, 0, 0, 29, 21, PRETO)
    # painel de cima com knobs
    retangulo(img, 1, 1, 28, 5, ROSA_ESCURO)
    for x in range(4, 27, 4):
        por(img, x, 3, AMARELO)
    # grade
    retangulo(img, 2, 7, 27, 20, ACO_ESCURO)
    for y in range(8, 20):
        for x in range(3, 27):
            if (x + y) % 3 == 0:
                por(img, x, y, ACO)
    # logo (losango)
    for dx, dy in [(0, -2), (0, 2), (-2, 0), (2, 0), (0, -1), (0, 1), (-1, 0), (1, 0), (0, 0)]:
        por(img, 15 + dx, 14 + dy, ROSA if abs(dx) + abs(dy) < 2 else ROSA_CLARO)
    return contornar(img)


def arco():
    # frente de onda que bojuda para baixo (+y): o ataque gira para a direção do tiro
    img = nova(40, 10)
    for x in range(40):
        u = (x - 19.5) / 19.5
        y = 2 + 5 * (1 - u * u)
        for dy in (-1, 0, 1):
            cor = BRANCO if dy == 0 else (ROSA_CLARO if dy < 0 else ROSA)
            por(img, x, y + dy, cor)
    return contornar(img)


# ---------- cabo ----------


def cabo():
    img = nova(8, 8)
    elipse(img, 3.5, 3.5, 3.4, 3.4, PRETO)
    elipse(img, 3.0, 3.0, 1.6, 1.6, (70, 56, 84))
    por(img, 2, 2, ROSA)
    por(img, 3, 2, ROSA_CLARO)
    return contornar(img, cor=(8, 2, 6))


def plugue():
    img = nova(16, 8)
    retangulo(img, 0, 2, 7, 5, PRETO)  # capa
    retangulo(img, 1, 2, 6, 2, ROSA)
    retangulo(img, 8, 3, 13, 4, ACO_CLARO)  # ponta metálica
    por(img, 11, 3, ACO_ESCURO)
    por(img, 11, 4, ACO_ESCURO)
    por(img, 14, 3, ACO)
    por(img, 14, 4, ACO)
    return contornar(img)


# ---------- sons ----------

TAXA = 22050


def gravar(nome, amostras):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    dados = np.clip(amostras, -1, 1)
    dados = (dados * 32000).astype(np.int16)
    with wave.open(os.path.join(SAIDA_SOM, nome), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(dados.tobytes())


def envelope(n, ataque=0.005, queda=4.0):
    t = np.arange(n) / TAXA
    env = np.minimum(1, t / ataque) * np.exp(-t * queda)
    return env


def sons():
    rng = np.random.default_rng(11)
    # tacada: assobio (ruído filtrado subindo) + estalo seco
    n = int(TAXA * 0.28)
    t = np.arange(n) / TAXA
    ruido = rng.uniform(-1, 1, n)
    passa = np.convolve(ruido, np.ones(6) / 6, mode='same')
    assobio = passa * np.sin(np.pi * t / t[-1]) * 0.6
    estalo = np.zeros(n)
    k = int(TAXA * 0.16)
    m = int(TAXA * 0.05)
    estalo[k:k + m] = rng.uniform(-1, 1, m) * np.exp(-np.arange(m) / (TAXA * 0.008))
    gravar('tacada.wav', (assobio + estalo * 0.9) * 0.8)

    # rebatida (home run): "toc" de madeira bem forte
    n = int(TAXA * 0.3)
    t = np.arange(n) / TAXA
    toc = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 40) + np.sin(2 * np.pi * 1450 * t) * np.exp(-t * 60) * 0.6
    ruido = rng.uniform(-1, 1, n) * np.exp(-t * 90)
    gravar('rebatida.wav', (toc + ruido * 0.8) * 0.7)

    # microfonia: agudo que sobe e treme
    n = int(TAXA * 0.5)
    t = np.arange(n) / TAXA
    f = 2200 + 900 * t / t[-1] + 60 * np.sin(2 * np.pi * 14 * t)
    fase = 2 * np.pi * np.cumsum(f) / TAXA
    env = np.minimum(1, t / 0.08) * np.minimum(1, (t[-1] - t) / 0.06)
    gravar('microfonia.wav', np.sin(fase) * env * 0.35)

    # palheta: corda beliscada (Karplus-Strong)
    n = int(TAXA * 0.35)
    periodo = int(TAXA / 330)
    buf = rng.uniform(-1, 1, periodo)
    saida = np.zeros(n)
    for i in range(n):
        saida[i] = buf[i % periodo]
        buf[i % periodo] = 0.5 * (buf[i % periodo] + buf[(i + 1) % periodo]) * 0.996
    gravar('palheta.wav', saida * 0.6)

    # fumaça: "puf" + chiado
    n = int(TAXA * 0.6)
    t = np.arange(n) / TAXA
    ruido = rng.uniform(-1, 1, n)
    grave = np.convolve(ruido, np.ones(30) / 30, mode='same') * np.exp(-t * 12) * 3
    chiado = ruido * np.minimum(1, t / 0.05) * np.exp(-t * 5) * 0.25
    gravar('fumaca.wav', (grave + chiado) * 0.7)

    # grave: batida de amplificador
    n = int(TAXA * 0.3)
    t = np.arange(n) / TAXA
    f = 120 * np.exp(-t * 6) + 50
    fase = 2 * np.pi * np.cumsum(f) / TAXA
    gravar('grave.wav', np.tanh(np.sin(fase) * 2.5) * np.exp(-t * 9) * 0.8)


def main():
    random.seed(1)
    salvar(nota(), 'nota.png')
    salvar(notas_ligadas(), 'notas.png')
    salvar(guitarra(), 'guitarra.png')
    salvar(taco(), 'taco.png')
    salvar(bola(), 'bola.png')
    salvar(impacto(), 'impacto.png')
    salvar(microfone(), 'microfone.png')
    salvar(chiado(), 'chiado.png')
    salvar(palheta(), 'palheta.png')
    salvar(caixasom(), 'caixasom.png')
    salvar(pulso(), 'pulso.png')
    salvar(lata(), 'lata.png')
    salvar(fumaca(), 'fumaca.png')
    salvar(brasa(), 'brasa.png')
    salvar(amp(), 'amp.png')
    salvar(arco(), 'arco.png')
    salvar(cabo(), 'cabo.png')
    salvar(plugue(), 'plugue.png')
    sons()


if __name__ == '__main__':
    main()
