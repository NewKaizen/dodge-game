#!/usr/bin/env python3
"""Gera os sprites e sons das cartas normais de Berdly em
public/assets/sprites/habilidades/berdly/ e public/assets/audio/habilidades/berdly/.

Uso (na raiz do projeto):  python3 scripts/habilidades/berdly.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves 'hab-berdly-*' em src/game/pvp/habilidades/sprites/berdly.js):
  bico.png          24x12   bico em cone, apontando para a direita (Bicada)
  marca.png         12x12   estalo da bicada (decoração)
  pena.png          2 quadros 20x10: penas macias voando (Penas Voadoras)
  plumas.png        8x8     penugem que cai do rastro do mergulho (decoração)
  mergulho.png      36x16   flecha de vento do mergulho, ponta à direita (Mergulho Aéreo)
  caneta.png        22x22   caneta vermelha, ponta embaixo à esquerda (Correção, decoração)
  tinta.png         14x6    traço de tinta vermelha (Correção)
  rajada.png        32x8    lufada de vento, cabeça à direita (Rajada de Vento)
  simbolos.png      6 quadros 14x14: + x ÷ = π √ em giz (Cálculo Genial)
  tornado.png       2 quadros 28x56: funil do tornado girando (Tornado)
  detrito.png       3 quadros 10x10: papel, folha e toco de lápis (Tornado)
  barra.png         28x64   coluna de gráfico (QI Elevado)
  material.png      4 quadros 16x16: livro, folha, lápis e óculos voando (Vendaval Supremo)
  vento.png         40x3    risco de vento do fundo (decoração)
  seta.png          24x16   seta da direção do vento (decoração)
  pena-armada.png   24x8    pena-dardo com ponta de metal (Pena Armada)
  ciclone.png       2 quadros 28x28: olho do ciclone (decoração)
  folha.png         2 quadros 12x12: folhas sugadas pelo ciclone (Ciclone)
Sons:
  bicada.wav  vento.wav  caneta.wav  calculo.wav
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'berdly')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'berdly')

VAZIO = (0, 0, 0, 0)

# ---------- paleta (amarelo-esverdeado do Berdly, ciano do vento, vermelho da caneta) ----------
CONTORNO = (8, 20, 14)
CONTORNO_VENTO = (14, 48, 66)
VERDE_ESCURO = (70, 128, 42)
VERDE = (122, 188, 58)
AMARELO = (216, 240, 90)  # 0xd8f05a, a cor do Berdly
AMARELO_CLARO = (244, 252, 196)
LARANJA_ESCURO = (178, 104, 26)
LARANJA = (236, 164, 40)
LARANJA_CLARO = (255, 214, 96)
CIANO_ESCURO = (62, 150, 200)
CIANO = (150, 228, 255)
CIANO_CLARO = (226, 250, 255)
BRANCO = (255, 255, 255)
VERMELHO_ESCURO = (128, 18, 22)
VERMELHO = (220, 40, 40)
VERMELHO_CLARO = (255, 120, 104)
PAPEL = (236, 238, 220)
PAPEL_SOMBRA = (168, 174, 150)
TINTA = (60, 70, 56)
GIZ = (246, 250, 236)
METAL_ESCURO = (104, 114, 130)
METAL = (186, 198, 210)
METAL_CLARO = (236, 242, 248)
AZUL = (70, 110, 200)
AZUL_CLARO = (130, 170, 240)
CINZA_VENTO = (120, 160, 150)


def nova(w, h):
    return Image.new('RGBA', (w, h), VAZIO)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def por(img, x, y, cor, alfa=255):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


def contornar(img, cor=CONTORNO):
    """Contorno de 1 px em volta de tudo que é opaco (vizinhança de 4)."""
    a = np.array(img)
    opaco = a[:, :, 3] > 40
    viz = np.zeros_like(opaco)
    viz[1:, :] |= opaco[:-1, :]
    viz[:-1, :] |= opaco[1:, :]
    viz[:, 1:] |= opaco[:, :-1]
    viz[:, :-1] |= opaco[:, 1:]
    borda = viz & ~opaco
    a[borda] = rgba(cor)
    return Image.fromarray(a)


def folha_de_quadros(quadros):
    w, h = quadros[0].size
    folha = nova(w * len(quadros), h)
    for i, q in enumerate(quadros):
        folha.paste(q, (i * w, 0))
    return folha


def salvar(img, nome):
    img.save(os.path.join(SAIDA, nome))


# ---------- sprites ----------

def bico():
    img = nova(24, 12)
    d = ImageDraw.Draw(img)
    d.polygon([(1, 1), (22, 6), (1, 6)], fill=rgba(LARANJA_CLARO))
    d.polygon([(1, 6), (22, 6), (1, 10)], fill=rgba(LARANJA))
    d.line([(1, 6), (21, 6)], fill=rgba(LARANJA_ESCURO))
    d.line([(1, 9), (12, 7)], fill=rgba(LARANJA_ESCURO))
    d.line([(2, 2), (14, 4)], fill=rgba(AMARELO_CLARO))
    por(img, 5, 4, LARANJA_ESCURO)
    return contornar(img)


def marca():
    img = nova(12, 12)
    for k in range(8):
        ang = k * math.pi / 4
        comprimento = 5 if k % 2 == 0 else 3
        for r in range(1, comprimento + 1):
            por(img, 6 + math.cos(ang) * r, 6 + math.sin(ang) * r, AMARELO_CLARO if r < 3 else AMARELO)
    por(img, 6, 6, BRANCO)
    return contornar(img)


def pena(claro, medio, escuro, haste):
    img = nova(20, 10)
    for x in range(3, 18):
        f = (x - 3) / 14
        meia = 3.6 * math.sin(math.pi * min(1, f * 1.1)) + 0.4
        for y in range(10):
            dy = y - 5
            if abs(dy) <= meia:
                cor = claro if dy < 0 else medio
                if abs(dy) > meia - 1:
                    cor = escuro if dy > 0 else medio
                por(img, x, y, cor)
    # cortes na pluma (dá cara de pena)
    for x, y in ((7, 2), (8, 3), (12, 7), (13, 6), (10, 2)):
        img.putpixel((x, y), VAZIO)
    for x in range(1, 19):
        por(img, x, 5, haste)
    return contornar(img)


def plumas():
    img = nova(8, 8)
    for x, y in ((3, 2), (4, 2), (2, 3), (3, 3), (4, 3), (5, 3), (3, 4), (4, 4), (5, 4), (4, 5)):
        por(img, x, y, AMARELO_CLARO if y < 4 else AMARELO)
    return contornar(img)


def mergulho():
    img = nova(36, 16)
    d = ImageDraw.Draw(img)
    # rastro de vento atrás da ponta
    for y, x0, cor in ((3, 2, CIANO), (8, 0, CIANO_CLARO), (12, 3, CIANO)):
        d.line([(x0, y), (x0 + 12, y)], fill=rgba(cor))
    # a flecha (ponta à direita, entalhe atrás)
    d.polygon([(12, 2), (34, 8), (12, 14), (17, 8)], fill=rgba(AMARELO))
    d.polygon([(12, 2), (34, 8), (17, 8)], fill=rgba(AMARELO_CLARO))
    d.line([(18, 8), (33, 8)], fill=rgba(VERDE))
    d.line([(14, 12), (28, 9)], fill=rgba(VERDE_ESCURO))
    return contornar(img)


def caneta():
    img = nova(22, 22)
    d = ImageDraw.Draw(img)
    d.line([(5, 16), (19, 2)], fill=rgba(VERMELHO), width=5)
    d.line([(6, 14), (18, 2)], fill=rgba(VERMELHO_CLARO), width=1)
    d.line([(15, 4), (19, 8)], fill=rgba(VERMELHO_ESCURO), width=2)  # anel da tampa
    d.polygon([(2, 15), (6, 19), (1, 20)], fill=rgba(METAL))  # ponta
    por(img, 1, 20, VERMELHO_ESCURO)
    por(img, 2, 19, VERMELHO)
    return contornar(img)


def tinta():
    img = nova(14, 6)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([1, 1, 12, 4], radius=2, fill=rgba(VERMELHO))
    d.line([(3, 2), (10, 2)], fill=rgba(VERMELHO_CLARO))
    return contornar(img, VERMELHO_ESCURO)


def rajada():
    img = nova(32, 8)
    for x in range(1, 31):
        f = (x - 1) / 29
        meia = 0.4 + 2.6 * f ** 1.5
        for y in range(8):
            dy = abs(y - 3.5)
            if dy <= meia:
                cor = CIANO_CLARO if dy < meia * 0.5 else CIANO
                if x > 27:
                    cor = BRANCO
                por(img, x, y, cor)
    return contornar(img, CONTORNO_VENTO)


def simbolo(nome):
    img = nova(14, 14)
    d = ImageDraw.Draw(img)
    g = rgba(GIZ)
    if nome == 'mais':
        d.line([(7, 2), (7, 11)], fill=g, width=2)
        d.line([(2, 7), (11, 7)], fill=g, width=2)
    elif nome == 'vezes':
        d.line([(3, 3), (10, 10)], fill=g, width=2)
        d.line([(10, 3), (3, 10)], fill=g, width=2)
    elif nome == 'divisao':
        d.line([(2, 7), (11, 7)], fill=g, width=2)
        d.rectangle([6, 2, 7, 3], fill=g)
        d.rectangle([6, 10, 7, 11], fill=g)
    elif nome == 'igual':
        d.line([(2, 5), (11, 5)], fill=g, width=2)
        d.line([(2, 9), (11, 9)], fill=g, width=2)
    elif nome == 'pi':
        d.line([(2, 3), (11, 3)], fill=g, width=2)
        d.line([(4, 3), (4, 11)], fill=g, width=2)
        d.line([(9, 3), (9, 10)], fill=g, width=2)
        por(img, 10, 11, GIZ)
    elif nome == 'raiz':
        d.line([(1, 8), (3, 7)], fill=g, width=1)
        d.line([(3, 7), (5, 11)], fill=g, width=2)
        d.line([(5, 11), (8, 2)], fill=g, width=2)
        d.line([(8, 2), (12, 2)], fill=g, width=2)
    # um toque do amarelo do Berdly no giz
    a = np.array(img)
    sombra = (a[:, :, 3] > 0) & (np.arange(14)[:, None] >= 8)
    a[sombra] = rgba(AMARELO_CLARO)
    return contornar(Image.fromarray(a), VERDE_ESCURO)


def tornado(fase):
    img = nova(28, 56)
    for y in range(1, 55):
        f = (y - 1) / 53
        meia = 12.5 * (1 - f) ** 1.2 + 2
        cx = 14 + math.sin(f * 5.5 + fase * 1.4) * 2.2 * f
        faixa = int((y + fase * 3) // 4) % 3
        for x in range(28):
            dx = x - cx
            if abs(dx) <= meia:
                lado = dx / meia
                if faixa == 0:
                    cor = CIANO_CLARO
                elif faixa == 1:
                    cor = CIANO
                else:
                    cor = CINZA_VENTO
                if lado > 0.55:
                    cor = CIANO_ESCURO
                elif lado < -0.6:
                    cor = BRANCO if faixa == 0 else CIANO_CLARO
                por(img, x, y, cor)
    # um fiapo amarelo-esverdeado girando (o ego dentro do vento)
    for k in range(10):
        f = 0.15 + k * 0.07
        y = 1 + f * 53
        meia = 12.5 * (1 - f) ** 1.2 + 2
        x = 14 + math.cos(k * 1.3 + fase * 2.1) * meia * 0.7
        por(img, x, y, AMARELO)
    return contornar(img, CONTORNO_VENTO)


def detrito(tipo):
    img = nova(10, 10)
    d = ImageDraw.Draw(img)
    if tipo == 'papel':
        d.polygon([(2, 3), (7, 1), (8, 7), (3, 8)], fill=rgba(PAPEL))
        d.line([(3, 4), (7, 3)], fill=rgba(PAPEL_SOMBRA))
        d.line([(3, 6), (7, 5)], fill=rgba(PAPEL_SOMBRA))
    elif tipo == 'folha':
        d.ellipse([2, 2, 8, 7], fill=rgba(VERDE))
        d.line([(2, 7), (7, 3)], fill=rgba(VERDE_ESCURO))
        por(img, 4, 3, AMARELO)
    else:
        d.line([(2, 7), (7, 2)], fill=rgba(LARANJA_CLARO), width=3)
        por(img, 8, 1, TINTA)
        por(img, 1, 8, VERMELHO_CLARO)
    return contornar(img)


def barra():
    img = nova(28, 64)
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, 26, 62], fill=rgba(VERDE))
    d.rectangle([1, 1, 5, 62], fill=rgba(AMARELO))
    d.rectangle([22, 1, 26, 62], fill=rgba(VERDE_ESCURO))
    d.rectangle([1, 1, 26, 4], fill=rgba(AMARELO_CLARO))
    for y in range(12, 62, 10):
        d.line([(6, y), (21, y)], fill=rgba(VERDE_ESCURO))
    # seta subindo no topo da coluna (QI subindo)
    d.polygon([(13, 6), (18, 11), (8, 11)], fill=rgba(AMARELO_CLARO))
    d.rectangle([12, 11, 14, 15], fill=rgba(AMARELO_CLARO))
    return contornar(img)


def material(tipo):
    img = nova(16, 16)
    d = ImageDraw.Draw(img)
    if tipo == 'livro':
        d.rectangle([2, 3, 13, 12], fill=rgba(VERDE))
        d.rectangle([2, 3, 4, 12], fill=rgba(VERDE_ESCURO))  # lombada
        d.rectangle([5, 11, 13, 12], fill=rgba(PAPEL))  # páginas
        d.line([(7, 6), (11, 6)], fill=rgba(AMARELO))
        d.line([(7, 8), (10, 8)], fill=rgba(AMARELO))
    elif tipo == 'folha':
        d.polygon([(3, 2), (12, 3), (13, 13), (4, 13)], fill=rgba(PAPEL))
        for y in (5, 7, 9, 11):
            d.line([(5, y), (11, y)], fill=rgba(AZUL_CLARO))
        d.line([(10, 9), (12, 12)], fill=rgba(VERMELHO))
        d.line([(12, 9), (10, 12)], fill=rgba(VERMELHO))
    elif tipo == 'lapis':
        d.line([(3, 12), (11, 4)], fill=rgba(LARANJA_CLARO), width=4)
        d.line([(10, 5), (12, 3)], fill=rgba(VERMELHO_CLARO), width=3)  # borracha
        d.polygon([(1, 14), (2, 11), (4, 13)], fill=rgba(PAPEL))
        por(img, 1, 14, TINTA)
    else:  # óculos
        d.ellipse([1, 5, 7, 11], outline=rgba(TINTA), width=2, fill=rgba(CIANO_CLARO))
        d.ellipse([8, 5, 14, 11], outline=rgba(TINTA), width=2, fill=rgba(CIANO_CLARO))
        d.line([(7, 7), (8, 7)], fill=rgba(TINTA))
        por(img, 3, 7, BRANCO)
        por(img, 10, 7, BRANCO)
    return contornar(img)


def vento():
    img = nova(40, 3)
    for x in range(40):
        alfa = int(200 * math.sin(math.pi * x / 39) ** 0.8)
        por(img, x, 1, CIANO_CLARO, alfa)
        if 10 < x < 30:
            por(img, x, 0, CIANO, alfa // 3)
            por(img, x, 2, CIANO, alfa // 3)
    return img


def seta():
    img = nova(24, 16)
    d = ImageDraw.Draw(img)
    d.rectangle([2, 6, 14, 9], fill=rgba(CIANO))
    d.polygon([(14, 2), (22, 8), (14, 13)], fill=rgba(CIANO_CLARO))
    d.line([(3, 7), (14, 7)], fill=rgba(CIANO_CLARO))
    return contornar(img, CONTORNO_VENTO)


def pena_armada():
    img = nova(24, 8)
    d = ImageDraw.Draw(img)
    # pluma (rabo) à esquerda
    d.polygon([(1, 1), (10, 3), (10, 5), (1, 7), (3, 4)], fill=rgba(AMARELO))
    d.polygon([(1, 1), (10, 3), (3, 4)], fill=rgba(AMARELO_CLARO))
    d.line([(4, 6), (9, 5)], fill=rgba(VERDE))
    # faixa vermelha e haste
    d.rectangle([10, 3, 11, 4], fill=rgba(VERMELHO))
    d.line([(12, 3), (17, 3)], fill=rgba(METAL_CLARO))
    d.line([(12, 4), (17, 4)], fill=rgba(METAL_ESCURO))
    # ponta de metal
    d.polygon([(17, 1), (22, 3), (22, 4), (17, 6)], fill=rgba(METAL))
    d.line([(17, 2), (21, 3)], fill=rgba(METAL_CLARO))
    return contornar(img)


def ciclone(fase):
    img = nova(28, 28)
    for braco in range(3):
        for k in range(60):
            th = k * 0.12
            r = 1.2 + th * 1.55
            if r > 12.5:
                break
            ang = th + braco * 2 * math.pi / 3 + fase * math.pi / 3
            cor = CIANO_CLARO if k < 20 else (CIANO if k < 40 else AMARELO)
            por(img, 14 + math.cos(ang) * r, 14 + math.sin(ang) * r, cor)
            por(img, 14 + math.cos(ang) * (r + 0.6), 14 + math.sin(ang) * (r + 0.6), cor)
    por(img, 14, 14, BRANCO)
    return contornar(img, CONTORNO_VENTO)


def folha(fase):
    img = nova(12, 12)
    d = ImageDraw.Draw(img)
    if fase == 0:
        d.ellipse([2, 3, 9, 8], fill=rgba(VERDE))
        d.line([(2, 8), (9, 3)], fill=rgba(VERDE_ESCURO))
        por(img, 4, 4, AMARELO)
        por(img, 1, 9, VERDE_ESCURO)
    else:
        d.ellipse([3, 2, 8, 9], fill=rgba(AMARELO))
        d.line([(5, 9), (6, 2)], fill=rgba(VERDE))
        por(img, 4, 4, AMARELO_CLARO)
        por(img, 5, 10, VERDE_ESCURO)
    return contornar(img)


# ---------- sons ----------

TAXA = 22050


def salvar_som(nome, amostras):
    amostras = np.clip(amostras, -1, 1)
    dados = (amostras * 32767 * 0.8).astype('<i2').tobytes()
    with wave.open(os.path.join(SAIDA_SOM, nome), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(dados)


def envelope(n, ataque, queda):
    t = np.arange(n) / TAXA
    return np.minimum(1, t / max(ataque, 1e-4)) * np.exp(-t / queda)


def som_bicada(rng):
    n = int(TAXA * 0.07)
    t = np.arange(n) / TAXA
    tom = np.sin(2 * np.pi * (1300 - 6000 * t) * t)
    ruido = rng.uniform(-1, 1, n)
    return (0.7 * tom + 0.4 * ruido) * envelope(n, 0.001, 0.012)


def som_vento(rng):
    n = int(TAXA * 0.38)
    ruido = rng.uniform(-1, 1, n)
    # passa-baixa móvel: um "fuuu" que sobe e desce
    saida = np.zeros(n)
    y = 0.0
    for i in range(n):
        f = i / n
        k = 0.04 + 0.22 * math.sin(math.pi * f)
        y += k * (ruido[i] - y)
        saida[i] = y
    env = np.sin(np.pi * np.arange(n) / n) ** 1.5
    return saida * env * 3.2


def som_caneta(rng):
    n = int(TAXA * 0.26)
    t = np.arange(n) / TAXA
    ruido = rng.uniform(-1, 1, n)
    rabisco = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t))
    alto = ruido - np.concatenate(([0], ruido[:-1]))  # passa-alta simples (arranhado)
    env = np.minimum(1, t / 0.01) * np.minimum(1, (0.26 - t) / 0.04)
    return 0.45 * alto * rabisco * env


def som_calculo(rng):
    partes = []
    for freq in (1180, 1580):
        n = int(TAXA * 0.06)
        t = np.arange(n) / TAXA
        partes.append(np.sign(np.sin(2 * np.pi * freq * t)) * 0.35 * envelope(n, 0.002, 0.03))
        partes.append(np.zeros(int(TAXA * 0.02)))
    return np.concatenate(partes)


def main():
    random.seed(1997)
    rng = np.random.default_rng(1997)
    os.makedirs(SAIDA, exist_ok=True)
    os.makedirs(SAIDA_SOM, exist_ok=True)

    salvar(bico(), 'bico.png')
    salvar(marca(), 'marca.png')
    salvar(folha_de_quadros([pena(AMARELO_CLARO, AMARELO, VERDE, VERDE_ESCURO), pena(CIANO_CLARO, CIANO, CIANO_ESCURO, VERDE_ESCURO)]), 'pena.png')
    salvar(plumas(), 'plumas.png')
    salvar(mergulho(), 'mergulho.png')
    salvar(caneta(), 'caneta.png')
    salvar(tinta(), 'tinta.png')
    salvar(rajada(), 'rajada.png')
    salvar(folha_de_quadros([simbolo(s) for s in ('mais', 'vezes', 'divisao', 'igual', 'pi', 'raiz')]), 'simbolos.png')
    salvar(folha_de_quadros([tornado(0), tornado(1)]), 'tornado.png')
    salvar(folha_de_quadros([detrito(s) for s in ('papel', 'folha', 'lapis')]), 'detrito.png')
    salvar(barra(), 'barra.png')
    salvar(folha_de_quadros([material(s) for s in ('livro', 'folha', 'lapis', 'oculos')]), 'material.png')
    salvar(vento(), 'vento.png')
    salvar(seta(), 'seta.png')
    salvar(pena_armada(), 'pena-armada.png')
    salvar(folha_de_quadros([ciclone(0), ciclone(1)]), 'ciclone.png')
    salvar(folha_de_quadros([folha(0), folha(1)]), 'folha.png')

    salvar_som('bicada.wav', som_bicada(rng))
    salvar_som('vento.wav', som_vento(rng))
    salvar_som('caneta.wav', som_caneta(rng))
    salvar_som('calculo.wav', som_calculo(rng))
    print('ok:', SAIDA)


if __name__ == '__main__':
    main()
