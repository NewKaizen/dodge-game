#!/usr/bin/env python3
"""Gera os sprites das cartas normais de Noelle em
public/assets/sprites/habilidades/noelle/ e os sons em
public/assets/audio/habilidades/noelle/.

Uso (na raiz do projeto):  python3 scripts/habilidades/noelle.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/habilidades/sprites/noelle.js):
  floco.png        20x20   floco de neve de lâminas curvas (estrela ninja de gelo)  -> Floco Afiado
  granizo.png      16x16   pedra de granizo pesada, em camadas                      -> Granizo
  lasca.png         8x8    lasquinha de gelo do granizo que estoura no chão          -> Granizo
  pingente.png     12x30   pingente pendurado (ponta para baixo, gelo + neve no topo) -> Pingentes
  estalactite.png 132x22   estalactite comprida (base à esquerda, ponta à direita)   -> Estalactites
  bola.png         24x24   bola de neve rolando (com pedrinhas e gelo)               -> Avalanche
  monte.png        22x9    montinho de neve que a bola deixa no chão                 -> Avalanche
  rajada.png       18x8    estilhaço de geada levado pelo vento (horizontal)         -> Vento Gélido
  vento.png        40x9    risco de vento (decoração, aviso da rajada)               -> Vento Gélido
  cristal.png      12x12   orbe de cristal que dispara o raio                        -> Raio de Gelo
  feixe.png        48x14   feixe do raio de gelo (esticado no comprimento)           -> Raio de Gelo
  geada.png        12x12   cristal que o raio deixa congelado na linha               -> Raio de Gelo
  eterno.png       2 quadros 14x14: hexágono de gelo voando (0) e congelado no ar (1) -> Inverno Eterno
  canto.png        40x40   geada do canto da caixa (decoração que cresce)            -> Inverno Eterno
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'noelle')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'noelle')

VAZIO = (0, 0, 0, 0)

# paleta: azul-gelo/branco (cor da Noelle: 0xa8eaff)
CONTORNO = (8, 18, 38)
NOITE = (14, 34, 70)
AZUL_ESCURO = (28, 74, 146)
AZUL = (70, 150, 224)
CIANO = (150, 222, 255)
NOELLE = (168, 234, 255)  # 0xa8eaff
GELO = (214, 246, 255)
BRANCO = (255, 255, 255)
CINZA_NEVE = (186, 206, 226)
PEDRA = (92, 104, 128)
PEDRA_ESCURA = (58, 66, 88)


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
    """Contorno de 1 px por fora do desenho (precisa de 1 px livre em volta)."""
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


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


# ---------- Floco Afiado: floco de lâminas curvas ----------


def gerar_floco():
    """Seis lâminas curvas (como uma estrela ninja) saindo de um miolo hexagonal."""
    img = nova(20, 20)
    c = 9.5
    for y in range(20):
        for x in range(20):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            if r > 8.6:
                continue
            ang = math.atan2(dy, dx)
            # lâmina: um setor que se curva com o raio (gancho), afinando na ponta
            for k in range(6):
                base = k * math.pi / 3
                curva = base + r * 0.11  # a lâmina entorta para o lado (efeito de giro)
                d = (ang - curva + math.pi) % (2 * math.pi) - math.pi
                largura = 0.95 * (1 - r / 9.4) + 0.1
                if -largura * 0.35 < d < largura:
                    if d < 0:
                        cor = BRANCO  # gume afiado (lado da frente)
                    elif d < largura * 0.45:
                        cor = GELO if r < 6 else CIANO
                    else:
                        cor = AZUL if r > 3 else CIANO
                    por(img, x, y, cor)
                    break
            if r < 2.6:
                por(img, x, y, NOELLE if r > 1.3 else BRANCO)
    # anel interno do floco
    for k in range(6):
        ang = k * math.pi / 3 + math.pi / 6
        por(img, c + math.cos(ang) * 3.2, c + math.sin(ang) * 3.2, AZUL_ESCURO)
    contornar(img)
    return img


# ---------- Granizo: pedra de gelo pesada ----------


def gerar_granizo():
    """Bola de gelo irregular (granizo grande), opaca, com camadas e um brilho."""
    rng = random.Random(5)
    img = nova(16, 16)
    raios = [rng.uniform(5.0, 7.0) for _ in range(9)]
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            ang = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * 9
            i = int(ang) % 9
            f = ang - int(ang)
            rr = raios[i] * (1 - f) + raios[(i + 1) % 9] * f
            d = math.hypot(dx, dy)
            if d > rr:
                continue
            luz = (-dx - dy) / 10  # luz de cima-esquerda
            k = d / rr
            if k > 0.8:
                cor = (96, 124, 168) if luz < 0 else CINZA_NEVE
            elif luz > 0.3:
                cor = BRANCO
            elif luz > -0.15:
                cor = GELO
            elif luz > -0.45:
                cor = CINZA_NEVE
            else:
                cor = (120, 148, 190)
            por(img, x, y, cor)
    # caroço de gelo opaco por dentro e bolhas de ar presas (granizo de verdade)
    for x, y in [(8, 9), (9, 8), (9, 9), (8, 8)]:
        por(img, x, y, (190, 214, 236))
    for _ in range(5):
        por(img, rng.randint(4, 11), rng.randint(5, 11), (120, 148, 190))
    por(img, 5, 4, BRANCO)
    por(img, 4, 5, BRANCO)
    contornar(img)
    return img


def gerar_lasca():
    img = nova(8, 8)
    pts = [(1, 4), (3, 1), (6, 2), (5, 6), (2, 6)]
    d = ImageDraw.Draw(img)
    d.polygon(pts, fill=rgba(CIANO))
    por(img, 3, 3, BRANCO)
    por(img, 3, 2, BRANCO)
    por(img, 4, 3, GELO)
    contornar(img)
    return img


# ---------- Pingentes: pingente pendurado ----------


def gerar_pingente():
    """Pingente de gelo apontando para baixo, com um tufo de neve no topo (preso no teto)."""
    img = nova(12, 30)
    cx = 5.5
    for y in range(4, 29):
        t = (y - 4) / 24
        meia = max(0.5, 4.6 * (1 - t) ** 0.9)
        for x in range(12):
            dx = x - cx
            if abs(dx) > meia:
                continue
            if dx < -meia * 0.35:
                cor = AZUL
            elif dx < 0.6:
                cor = BRANCO if t < 0.75 else GELO
            else:
                cor = CIANO if dx < meia * 0.7 else AZUL_ESCURO
            por(img, x, y, cor)
    # gotinha/brilho no meio
    for y in range(7, 24, 4):
        por(img, cx - 1, y, BRANCO)
    # tufo de neve no topo (onde ele está preso)
    for y in range(1, 6):
        for x in range(12):
            dx = x - cx
            if (dx / 5.4) ** 2 + ((y - 3.5) / 2.4) ** 2 <= 1:
                por(img, x, y, BRANCO if y < 4 else CINZA_NEVE)
    contornar(img)
    return img


# ---------- Estalactites: estalactite comprida que cresce do teto ----------


def gerar_estalactite():
    """Horizontal: base larga e rochosa à esquerda (presa no teto), ponta à direita.
    O jogo gira 90° (angulo = pi/2) e a desliza para fora do teto."""
    rng = random.Random(11)
    L, A = 132, 22
    img = nova(L, A)
    cy = 10.5
    ondas = [rng.uniform(-0.7, 0.7) for _ in range(L)]
    for x in range(1, L - 1):
        t = x / (L - 2)
        meia = max(0.6, 9.4 * (1 - t) ** 0.75 + (ondas[x] if t < 0.85 else 0))
        for y in range(A):
            dy = y - cy
            if abs(dy) > meia:
                continue
            k = dy / max(0.6, meia)
            # faixas de mineral/gelo (estrias ao longo do comprimento)
            faixa = int((x + 3 * math.sin(x * 0.21)) / 9) % 3
            if t < 0.12:
                cor = PEDRA_ESCURA if k > 0.2 else PEDRA  # raiz de rocha congelada
                if k < -0.5:
                    cor = CINZA_NEVE
            elif k < -0.55:
                cor = GELO
            elif k < -0.1:
                cor = CIANO if faixa != 1 else NOELLE
            elif k < 0.45:
                cor = AZUL if faixa != 2 else (88, 170, 236)
            else:
                cor = AZUL_ESCURO
            por(img, x, y, cor)
    # brilho ao longo do lado iluminado
    for x in range(18, L - 14, 3):
        t = x / (L - 2)
        meia = 9.4 * (1 - t) ** 0.75
        por(img, x, cy - meia * 0.6, BRANCO)
    # gota pendurada na ponta
    por(img, L - 3, int(cy), BRANCO)
    contornar(img)
    return img


# ---------- Avalanche: bola de neve rolando ----------


def gerar_bola():
    rng = random.Random(13)
    img = nova(24, 24)
    c = 11.5
    for y in range(24):
        for x in range(24):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            if d > 10.6 + 0.5 * math.sin(math.atan2(dy, dx) * 7):
                continue
            luz = (-dx - dy * 1.2) / 14
            if luz > 0.35:
                cor = BRANCO
            elif luz > -0.1:
                cor = GELO
            elif luz > -0.5:
                cor = CINZA_NEVE
            else:
                cor = (140, 170, 204)
            por(img, x, y, cor)
    # torrões de neve e pedrinhas presas (dão a sensação de rolar quando gira)
    for _ in range(7):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(2, 8)
        x, y = c + math.cos(ang) * r, c + math.sin(ang) * r
        if rng.random() < 0.45:
            por(img, x, y, PEDRA)
            por(img, x + 1, y, PEDRA_ESCURA)
        else:
            por(img, x, y, CINZA_NEVE)
            por(img, x, y + 1, (140, 170, 204))
    # espiral de neve (rolando)
    for i in range(20):
        a = i * 0.45
        r = 1 + i * 0.38
        por(img, c + math.cos(a) * r, c + math.sin(a) * r, (160, 190, 220))
    contornar(img)
    return img


def gerar_monte():
    """Montinho de neve (a bola de neve se esborrachou no chão)."""
    rng = random.Random(17)
    img = nova(22, 9)
    for x in range(1, 21):
        t = (x - 10.5) / 9.5
        topo = 7.6 - 6.2 * (1 - t * t) ** 0.8 + rng.uniform(-0.4, 0.4)
        for y in range(int(math.ceil(topo)), 8):
            luz = (y - topo) / 6 + t * 0.25
            cor = BRANCO if luz < 0.35 else (GELO if luz < 0.7 else CINZA_NEVE)
            por(img, x, y, cor)
    for x, y in [(6, 6), (14, 5), (10, 7)]:
        por(img, x, y, (140, 170, 204))
    contornar(img)
    return img


# ---------- Vento Gélido: estilhaço de geada e risco de vento ----------


def gerar_rajada():
    """Estilhaço de geada alongado (aponta para a direita), com rastro de neve."""
    img = nova(18, 8)
    for x in range(1, 17):
        t = x / 16
        meia = 2.8 * math.sin(math.pi * min(1, t * 1.25)) ** 0.7 if t < 0.8 else 2.8 * (1 - t) / 0.2
        for y in range(8):
            dy = y - 3.5
            if abs(dy) > meia:
                continue
            k = dy / max(0.5, meia)
            cor = BRANCO if k < -0.2 else (CIANO if k < 0.5 else AZUL)
            por(img, x, y, cor)
    for x in (2, 4):
        por(img, x, 3, GELO)
    contornar(img)
    return img


def gerar_vento():
    """Risco de vento: duas linhas onduladas brancas, transparentes nas pontas."""
    img = nova(40, 9)
    for x in range(40):
        t = x / 39
        alfa = int(255 * math.sin(math.pi * t) ** 0.6)
        y1 = 2.5 + 1.2 * math.sin(t * 7)
        y2 = 6 + 1.0 * math.sin(t * 7 + 2.4)
        por(img, x, y1, BRANCO, alfa)
        if 0.25 < t < 0.95:
            por(img, x, y2, NOELLE, int(alfa * 0.8))
    # gancho do redemoinho na ponta
    for i in range(6):
        a = i * 0.9
        por(img, 33 + math.cos(a) * 2, 3.5 + math.sin(a) * 2, BRANCO, 220)
    return img


# ---------- Raio de Gelo: orbe, feixe e cristal congelado ----------


def gerar_cristal():
    """Orbe de cristal facetado (de onde o raio sai)."""
    img = nova(12, 12)
    d = ImageDraw.Draw(img)
    d.polygon([(5.5, 1), (10, 5.5), (5.5, 10), (1, 5.5)], fill=rgba(AZUL))
    d.polygon([(5.5, 1), (10, 5.5), (5.5, 5.5)], fill=rgba(CIANO))
    d.polygon([(5.5, 1), (1, 5.5), (5.5, 5.5)], fill=rgba(GELO))
    d.polygon([(1, 5.5), (5.5, 10), (5.5, 5.5)], fill=rgba(AZUL_ESCURO))
    por(img, 4, 4, BRANCO)
    por(img, 5, 3, BRANCO)
    contornar(img)
    return img


def gerar_feixe():
    """Feixe horizontal com miolo branco e borda ciano (é esticado no comprimento)."""
    img = nova(48, 14)
    for x in range(48):
        for y in range(14):
            dy = abs(y - 6.5)
            onda = 0.6 * math.sin(x * 0.8)
            if dy > 6.2 + onda * 0.5:
                continue
            if dy < 1.8:
                cor, alfa = BRANCO, 255
            elif dy < 3.4 + onda * 0.4:
                cor, alfa = GELO, 255
            elif dy < 5.2:
                cor, alfa = CIANO, 230
            else:
                cor, alfa = AZUL, 170
            por(img, x, y, cor, alfa)
    # faíscas de gelo no miolo
    for x in range(3, 48, 7):
        por(img, x, 6, NOELLE)
    return img


def gerar_geada():
    """Cristal de gelo espetado (o rastro congelado que o raio deixa)."""
    img = nova(12, 12)
    d = ImageDraw.Draw(img)
    c = 5.5
    for ang, r, cor in [(-90, 5, GELO), (-30, 4.2, CIANO), (30, 4, AZUL), (90, 4.5, AZUL), (150, 4, CIANO), (210, 4.2, GELO)]:
        a = math.radians(ang)
        p = (c + math.cos(a) * r, c + math.sin(a) * r)
        b1 = (c + math.cos(a + 0.5) * 1.6, c + math.sin(a + 0.5) * 1.6)
        b2 = (c + math.cos(a - 0.5) * 1.6, c + math.sin(a - 0.5) * 1.6)
        d.polygon([p, b1, b2], fill=rgba(cor))
    d.ellipse((c - 1.6, c - 1.6, c + 1.6, c + 1.6), fill=rgba(BRANCO))
    contornar(img)
    return img


# ---------- Inverno Eterno: hexágono de gelo (voando / congelado) e geada do canto ----------


def hexagono(congelado):
    img = nova(14, 14)
    d = ImageDraw.Draw(img)
    c = 6.5
    pts = [(c + math.cos(math.radians(60 * k + 30)) * 5.6, c + math.sin(math.radians(60 * k + 30)) * 5.6) for k in range(6)]
    if congelado:
        d.polygon(pts, fill=rgba(GELO))
        interno = [(c + (x - c) * 0.55, c + (y - c) * 0.55) for x, y in pts]
        d.polygon(interno, fill=rgba(CINZA_NEVE))
        # geada branca grossa por cima (congelou no ar)
        for k in range(6):
            a = math.radians(60 * k + 30)
            linha(img, c, c, c + math.cos(a) * 5, c + math.sin(a) * 5, BRANCO)
        contornar(img)
        return img
    d.polygon(pts, fill=rgba(AZUL))
    interno = [(c + (x - c) * 0.62, c + (y - c) * 0.62) for x, y in pts]
    d.polygon(interno, fill=rgba(CIANO))
    nucleo = [(c + (x - c) * 0.3, c + (y - c) * 0.3) for x, y in pts]
    d.polygon(nucleo, fill=rgba(BRANCO))
    por(img, 4, 3, BRANCO)
    contornar(img)
    return img


def gerar_eterno():
    folha = nova(28, 14)
    folha.paste(hexagono(False), (0, 0))
    folha.paste(hexagono(True), (14, 0))
    return folha


def gerar_canto():
    """Geada do canto superior esquerdo: galhos de cristal saindo do canto."""
    rng = random.Random(29)
    img = nova(40, 40)

    def galho(x, y, ang, comp, nivel):
        if comp < 2 or nivel > 4:
            return
        x2, y2 = x + math.cos(ang) * comp, y + math.sin(ang) * comp
        cor = BRANCO if nivel < 2 else (GELO if nivel < 3 else NOELLE)
        linha(img, x, y, x2, y2, cor, 230 - nivel * 30)
        for lado in (-1, 1):
            galho(x + (x2 - x) * 0.5, y + (y2 - y) * 0.5, ang + lado * rng.uniform(0.6, 0.9), comp * 0.5, nivel + 1)
        galho(x2, y2, ang + rng.uniform(-0.2, 0.2), comp * 0.6, nivel + 1)

    for ang in (0.12, 0.45, 0.78, 1.1, 1.45):
        galho(0, 0, ang, rng.uniform(14, 20), 0)
    # canto bem coberto
    for y in range(6):
        for x in range(6 - y):
            por(img, x, y, BRANCO, 200)
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
    rng = np.random.default_rng(47)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # floco: "shing" de lâmina de gelo (agudo que sobe, com chiado)
    t = tempo(0.22)
    f = 2600 + 2200 * t / 0.22
    s = np.sin(2 * np.pi * np.cumsum(f) / taxa) * np.exp(-t * 14)
    ruido = rng.standard_normal(len(t))
    s += (ruido - passa_baixa(ruido, 4)) * 0.35 * np.exp(-t * 30)
    salvar_som('floco.wav', s)

    # granizo: pancada pesada + estalo de gelo
    t = tempo(0.3)
    grave = np.sin(2 * np.pi * (140 * np.exp(-t * 18) + 55) * t) * np.exp(-t * 16)
    ruido = rng.standard_normal(len(t))
    estalo = (ruido - passa_baixa(ruido, 3)) * np.exp(-t * 40) * 0.6
    salvar_som('granizo.wav', grave * 1.2 + estalo)

    # vento: rajada (ruído filtrado que cresce e some)
    t = tempo(0.9)
    base = passa_baixa(rng.standard_normal(len(t)), 18) * 4
    env = np.sin(np.pi * np.clip(t / 0.9, 0, 1)) ** 1.5
    assovio = np.sin(2 * np.pi * (700 + 260 * t) * t) * 0.1
    salvar_som('vento.wav', (base + assovio) * env)

    # raio: zumbido gelado + cristais (o raio congela a linha)
    t = tempo(0.45)
    zumbido = np.sign(np.sin(2 * np.pi * 330 * t)) * 0.25 * np.exp(-t * 6)
    cristais = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t * d) for fr, d in [(1900, 8), (2850, 10), (3800, 12)]) * 0.35
    salvar_som('raio.wav', zumbido + cristais)

    # congelar: tudo para no ar (acorde agudo descendo + estalo)
    t = tempo(0.6)
    acorde = sum(np.sin(2 * np.pi * fr * (1 - 0.25 * t) * t) for fr in (1320, 1760, 2640)) * np.exp(-t * 5) * 0.3
    ruido = rng.standard_normal(len(t))
    estalo = (ruido - passa_baixa(ruido, 5)) * np.exp(-t * 25) * 0.4
    salvar_som('congelar.wav', acorde + estalo)

    # estalactite: rangido de gelo crescendo (ruído grave pulsante)
    t = tempo(0.45)
    rangido = passa_baixa(rng.standard_normal(len(t)), 6) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * t)))
    tom = np.sin(2 * np.pi * (220 - 90 * t) * t) * 0.3
    salvar_som('estalactite.wav', (rangido * 1.6 + tom) * np.exp(-t * 3.5))

    # avalanche: estrondo grave rolando
    t = tempo(1.0)
    estrondo = passa_baixa(rng.standard_normal(len(t)), 60) * 9
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 7 * t)
    salvar_som('avalanche.wav', estrondo * lfo * np.clip(t / 0.15, 0, 1) * np.exp(-t * 2.2))


def main():
    salvar(gerar_floco(), 'floco.png')
    salvar(gerar_granizo(), 'granizo.png')
    salvar(gerar_lasca(), 'lasca.png')
    salvar(gerar_pingente(), 'pingente.png')
    salvar(gerar_estalactite(), 'estalactite.png')
    salvar(gerar_bola(), 'bola.png')
    salvar(gerar_monte(), 'monte.png')
    salvar(gerar_rajada(), 'rajada.png')
    salvar(gerar_vento(), 'vento.png')
    salvar(gerar_cristal(), 'cristal.png')
    salvar(gerar_feixe(), 'feixe.png')
    salvar(gerar_geada(), 'geada.png')
    salvar(gerar_eterno(), 'eterno.png')
    salvar(gerar_canto(), 'canto.png')
    sons()


if __name__ == '__main__':
    main()
