#!/usr/bin/env python3
"""Sprites e sons das cartas normais de Susie (as que ganharam ataque próprio).

Uso (na raiz do projeto):  python3 scripts/habilidades/susie.py
Precisa de Pillow e numpy. Saída determinística (sementes fixas).

Imagens em public/assets/sprites/habilidades/susie/ (chaves em
src/game/pvp/habilidades/sprites/susie.js):
  calombo.png   48x40      a parede da caixa amassando para dentro (Cabeçada)
  bonk.png      32x32      estouro da pancada da cabeçada
  estrela.png   2x 14x14   estrelinhas de tontura (spritesheet)
  pilar.png     3x 18x64   pilares de pedra que sobem do chão (Pisão)
  cascalho.png  4x 12x12   cascalho que cai do teto com o tremor (Pisão)
  marca.png     44x14      pegada rachada no chão (Pisão)
  giro.png      84x24      machado de cabo longo, girando pela ponta (Giro do Machado)
  redemoinho.png 24x24     redemoinho no eixo do giro
  raiva.png     18x18      marca de raiva (Encarar)
  olhar.png     18x8       raio do olhar fulminante (Encarar)
  som.png       2x 10x18   pedaços da onda sonora do rugido (Rugido)
  boca.png      28x28      estouro do grito na parede (Rugido)
  bomba.png     2x 22x22   bomba de giz: três gizes amarrados com pavio (Bomba de Giz)
  giz.png       3x 10x8    pedaços de giz (Bomba de Giz)
  poeira.png    48x48      nuvem de pó de giz (Bomba de Giz)
Sons em public/assets/audio/habilidades/susie/: bonk, pisao, giro, rugido, giz (.wav)
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'habilidades', 'susie')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'habilidades', 'susie')

# ---------- paleta (roxo do tema 0xb05cff) ----------
CONTORNO = (28, 10, 42)
ROXO = [(52, 18, 82), (96, 38, 150), (150, 70, 220), (176, 92, 255), (214, 160, 255), (240, 222, 255)]
MAGENTA = [(140, 20, 110), (220, 50, 170), (255, 110, 220), (255, 200, 245)]
AMARELO = [(170, 110, 10), (240, 190, 40), (255, 230, 80), (255, 250, 200)]
MADEIRA = [(58, 34, 20), (96, 60, 34), (140, 92, 52), (180, 130, 80)]
ACO = [(70, 62, 96), (120, 110, 160), (175, 168, 210), (225, 222, 245)]
ROCHA = [(44, 28, 46), (78, 52, 74), (112, 80, 100), (150, 116, 132), (190, 160, 170)]
GIZ = [(150, 140, 175), (200, 194, 220), (236, 232, 248), (255, 255, 255)]
BRANCO = (255, 255, 255)


def nova(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def cor(c, a=255):
    return (c[0], c[1], c[2], a)


def contornar(img, c=CONTORNO, diagonais=False):
    a = np.array(img)
    op = a[:, :, 3] > 0
    viz = np.zeros_like(op)
    passos = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    if diagonais:
        passos += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    pad = np.pad(op, 1)
    h, w = op.shape
    for dy, dx in passos:
        viz |= pad[1 - dy:1 - dy + h, 1 - dx:1 - dx + w]
    borda = viz & ~op
    a[borda] = cor(c)
    return Image.fromarray(a)


def folha(quadros):
    """junta quadros do mesmo tamanho lado a lado (spritesheet)"""
    w, h = quadros[0].size
    img = nova(w * len(quadros), h)
    for i, q in enumerate(quadros):
        img.paste(q, (i * w, 0))
    return img


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome + '.png'), optimize=True)


def estrela_pts(cx, cy, r1, r2, pontas=5, giro=-math.pi / 2):
    pts = []
    for i in range(pontas * 2):
        r = r1 if i % 2 == 0 else r2
        ang = giro + i * math.pi / pontas
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    return pts


# ---------- Cabeçada ----------
def calombo():
    """a parede (branca, como a borda da caixa) cedendo para dentro: um domo
    que aponta para +x (a base fica colada na parede, à esquerda)"""
    w, h = 48, 40
    img = nova(w, h)
    a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            v = (y - (h - 1) / 2) / ((h - 1) / 2)  # -1..1
            alcance = (w - 3) * max(0.0, 1 - v * v) ** 0.55
            if x <= alcance:
                f = x / max(1.0, alcance)
                if f > 0.86:
                    c = ROXO[5]
                elif f > 0.6:
                    c = ROXO[4]
                elif f > 0.3:
                    c = ROXO[3]
                else:
                    c = ROXO[2]
                if v < -0.45 and f > 0.35:
                    c = ROXO[5] if f > 0.6 else ROXO[4]  # brilho de cima
                if v > 0.55:
                    c = ROXO[1] if f < 0.7 else ROXO[2]  # sombra de baixo
                a[y, x] = cor(c)
    img = Image.fromarray(a)
    d = ImageDraw.Draw(img)
    # base: a faixa branca da borda da caixa que foi empurrada
    d.rectangle([0, 0, 3, h - 1], fill=cor(BRANCO))
    # rachaduras que saem do ponto da pancada (a ponta do domo)
    for pts in ([(44, 20), (37, 15), (31, 17), (24, 10)], [(44, 20), (36, 25), (29, 23), (22, 30)], [(44, 20), (33, 20), (27, 19)]):
        d.line(pts, fill=cor(ROXO[0]), width=1)
    return contornar(img)


def bonk():
    img = nova(32, 32)
    d = ImageDraw.Draw(img)
    d.polygon(estrela_pts(16, 16, 15, 7, 8, 0.2), fill=cor(AMARELO[1]))
    d.polygon(estrela_pts(16, 16, 11, 5, 8, 0.2), fill=cor(AMARELO[2]))
    d.polygon(estrela_pts(16, 16, 6, 3, 8, 0.6), fill=cor(AMARELO[3]))
    img = contornar(img)
    d = ImageDraw.Draw(img)
    d.point([(16, 16), (15, 16), (16, 15)], fill=cor(BRANCO))
    return img


def estrela(q):
    img = nova(14, 14)
    d = ImageDraw.Draw(img)
    giro = -math.pi / 2 + (0 if q == 0 else math.pi / 5)
    d.polygon(estrela_pts(7, 7, 6.2, 2.7, 5, giro), fill=cor(AMARELO[2]))
    d.polygon(estrela_pts(7, 7, 3.4, 1.5, 5, giro), fill=cor(AMARELO[3]))
    img = contornar(img)
    d = ImageDraw.Draw(img)
    d.point((7, 7), fill=cor(BRANCO))
    if q == 1:  # brilho piscando
        d.point([(2, 2), (12, 11)], fill=cor(MAGENTA[3]))
    return img


# ---------- Pisão ----------
def pilar(q):
    rng = random.Random(30 + q)
    w, h = 18, 64
    img = nova(w, h)
    d = ImageDraw.Draw(img)
    ponta = [5, 9, 7][q]
    topo = [(1, 14), (ponta, 1), (16, 10 + q * 2), (16, h - 1), (1, h - 1)]
    d.polygon(topo, fill=cor(ROCHA[2]))
    # luz à esquerda, sombra à direita
    d.polygon([(1, 14), (ponta, 1), (ponta + 1, 6), (5, h - 1), (1, h - 1)], fill=cor(ROCHA[3]))
    d.polygon([(12, 12 + q), (16, 10 + q * 2), (16, h - 1), (12, h - 1)], fill=cor(ROCHA[1]))
    # estratos e pedrinhas
    for y in range(20, h - 2, 9):
        d.line([(2, y + rng.randint(-1, 1)), (15, y + rng.randint(-1, 1))], fill=cor(ROCHA[1]))
    for _ in range(10):
        x, y = rng.randint(3, 13), rng.randint(16, h - 3)
        d.point((x, y), fill=cor(rng.choice([ROCHA[4], ROCHA[0]])))
    # brilho roxo da força da pisada na ponta
    d.line([(ponta, 3), (ponta - 2, 9)], fill=cor(ROXO[4]))
    return contornar(img)


def cascalho(q):
    rng = random.Random(50 + q)
    img = nova(12, 12)
    d = ImageDraw.Draw(img)
    n = 6 + q % 2
    pts = []
    for i in range(n):
        ang = i * 2 * math.pi / n + rng.uniform(-0.3, 0.3)
        r = rng.uniform(3.4, 4.8)
        pts.append((6 + math.cos(ang) * r, 6 + math.sin(ang) * r))
    d.polygon(pts, fill=cor(ROCHA[2]))
    d.polygon([(p[0] - 1, p[1] - 1) for p in pts[: n // 2 + 1]] + [(6, 6)], fill=cor(ROCHA[3]))
    d.point((5, 5), fill=cor(ROCHA[4]))
    d.point((7, 8), fill=cor(ROCHA[1]))
    return contornar(img)


def marca():
    """pegada rachada no chão (vista de lado: uma fenda larga com lascas)"""
    img = nova(44, 14)
    d = ImageDraw.Draw(img)
    d.polygon([(2, 13), (8, 6), (14, 9), (22, 3), (30, 9), (36, 6), (42, 13)], fill=cor(ROCHA[1]))
    d.polygon([(8, 13), (14, 10), (22, 6), (30, 10), (36, 13)], fill=cor(ROCHA[0]))
    d.line([(22, 6), (22, 1)], fill=cor(ROXO[4]))
    d.line([(14, 9), (11, 3)], fill=cor(ROXO[3]))
    d.line([(30, 9), (34, 2)], fill=cor(ROXO[3]))
    return contornar(img)


# ---------- Giro do Machado ----------
def giro():
    """machado de cabo longo, horizontal: a empunhadura (eixo do giro) à
    esquerda e a cabeça de duas lâminas na ponta direita"""
    w, h = 84, 24
    img = nova(w, h)
    d = ImageDraw.Draw(img)
    cy = h // 2
    # cabo
    d.rectangle([2, cy - 2, 66, cy + 1], fill=cor(MADEIRA[1]))
    d.line([(2, cy - 2), (66, cy - 2)], fill=cor(MADEIRA[3]))
    for x in range(8, 62, 9):  # tiras de couro
        d.line([(x, cy - 2), (x + 2, cy + 1)], fill=cor(MADEIRA[0]))
    d.rectangle([0, cy - 3, 4, cy + 2], fill=cor(ROXO[1]))  # pomo
    # cabeça: duas lâminas em meia-lua, uma para cada lado do cabo
    for s in (-1, 1):
        lam = [(64, cy + s * 2)]
        for i in range(11):
            t = i / 10
            ang = -1.15 + 2.3 * t
            lam.append((72 + math.sin(ang) * 10, cy + s * (3 + math.cos(ang) * 8.5)))
        lam.append((80, cy + s * 2))
        d.polygon(lam, fill=cor(ACO[1]))
        inner = [(66, cy + s * 2)] + [(72 + math.sin(-1.0 + 2.0 * i / 8) * 7, cy + s * (3 + math.cos(-1.0 + 2.0 * i / 8) * 6)) for i in range(9)] + [(78, cy + s * 2)]
        d.polygon(inner, fill=cor(ACO[2]))
        fio = [(72 + math.sin(-1.05 + 2.1 * i / 8) * 10, cy + s * (3 + math.cos(-1.05 + 2.1 * i / 8) * 8.5)) for i in range(9)]
        d.line(fio, fill=cor(MAGENTA[2]), width=1)
    d.rectangle([68, cy - 3, 76, cy + 2], fill=cor(ROXO[2]))  # olho da cabeça
    d.rectangle([71, cy - 1, 73, cy], fill=cor(AMARELO[2]))  # joia
    d.rectangle([77, cy - 2, 82, cy + 1], fill=cor(ACO[2]))  # ponta
    return contornar(img)


def redemoinho():
    img = nova(24, 24)
    a = np.zeros((24, 24, 4), np.uint8)
    for y in range(24):
        for x in range(24):
            dx, dy = x - 11.5, y - 11.5
            r = math.hypot(dx, dy)
            if r > 11 or r < 2:
                continue
            ang = math.atan2(dy, dx)
            braco = (ang * 3 / (2 * math.pi) * 2 + r / 4.2) % 2  # 3 braços em espiral
            if braco < 0.8:
                c = ROXO[4] if r < 6 else ROXO[3]
                al = int(255 * (1 - r / 12) ** 0.5)
                a[y, x] = cor(c, max(90, al))
    return Image.fromarray(a)


# ---------- Encarar ----------
def raiva():
    """marca de raiva (quatro cantos curvos, o 'veio saltado' dos desenhos)"""
    img = nova(18, 18)
    d = ImageDraw.Draw(img)
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        cx, cy = 9 + sx * 4.5, 9 + sy * 4.5
        # cada canto: um "L" grosso arredondado virado para o centro
        d.line([(cx + sx * 3, cy - sy * 1.5), (cx - sx * 0.5, cy - sy * 1.5), (cx - sx * 1.5, cy + sy * 3)], fill=cor(MAGENTA[1]), width=3)
        d.point((round(cx - sx * 0.5), round(cy - sy * 1.5)), fill=cor(MAGENTA[3]))
    return contornar(img)


def olhar():
    """raio do olhar fulminante: uma fenda amarela afiada"""
    img = nova(18, 8)
    d = ImageDraw.Draw(img)
    d.polygon([(1, 4), (6, 1), (14, 2), (17, 4), (14, 6), (6, 7)], fill=cor(AMARELO[1]))
    d.polygon([(4, 4), (8, 2), (14, 3), (16, 4), (14, 5), (8, 6)], fill=cor(AMARELO[2]))
    d.line([(9, 4), (15, 4)], fill=cor(AMARELO[3]))
    return contornar(img)


# ---------- Rugido ----------
def som(q):
    """pedaço da onda sonora: um arco ')' grosso"""
    img = nova(10, 18)
    d = ImageDraw.Draw(img)
    cores = [MAGENTA[1], ROXO[3]] if q == 0 else [ROXO[3], MAGENTA[2]]
    d.arc([-10, 0, 8, 17], -62, 62, fill=cor(cores[0]), width=4)
    d.arc([-9, 2, 6, 15], -50, 50, fill=cor(cores[1]), width=1)
    return contornar(img)


def boca():
    """estouro do grito: raios saindo de um ponto na parede (para +x)"""
    img = nova(28, 28)
    d = ImageDraw.Draw(img)
    for i in range(7):
        ang = -1.1 + 2.2 * i / 6
        comp = 24 if i % 2 == 0 else 16
        d.line([(2, 14), (2 + math.cos(ang) * comp, 14 + math.sin(ang) * comp)], fill=cor(MAGENTA[2] if i % 2 == 0 else ROXO[4]), width=3)
    d.ellipse([0, 9, 9, 19], fill=cor(MAGENTA[3]))
    return contornar(img)


# ---------- Bomba de Giz ----------
def bomba(q):
    """três gizes amarrados com fita roxa e um pavio aceso"""
    img = nova(22, 22)
    d = ImageDraw.Draw(img)
    for i, x in enumerate((4, 9, 14)):
        y0 = 7 + (1 if i == 1 else 0) - (1 if i == 1 else 0) * 2
        d.rectangle([x, y0, x + 4, 19], fill=cor(GIZ[2]))
        d.line([(x, y0), (x, 19)], fill=cor(GIZ[3]))
        d.line([(x + 4, y0 + 1), (x + 4, 19)], fill=cor(GIZ[1]))
        d.rectangle([x, y0, x + 4, y0 + 1], fill=cor(GIZ[3]))  # ponta gasta
    d.rectangle([3, 12, 19, 15], fill=cor(ROXO[2]))  # fita
    d.line([(3, 12), (19, 12)], fill=cor(ROXO[4]))
    # pavio
    d.line([(11, 5), (12, 3), (14, 2)], fill=cor(MADEIRA[2]), width=1)
    img = contornar(img)
    d = ImageDraw.Draw(img)
    # faísca do pavio (pisca entre os quadros)
    if q == 0:
        d.point([(15, 1), (16, 1), (15, 0), (15, 2), (14, 1)], fill=cor(AMARELO[2]))
        d.point((15, 1), fill=cor(BRANCO))
    else:
        d.point([(15, 2), (16, 1), (17, 0), (14, 0), (17, 3)], fill=cor(AMARELO[1]))
        d.point((15, 1), fill=cor(AMARELO[3]))
    return img


def giz(q):
    img = nova(10, 8)
    d = ImageDraw.Draw(img)
    formas = [
        [(1, 2), (8, 1), (9, 5), (2, 6)],
        [(1, 1), (6, 1), (8, 4), (5, 7), (1, 6)],
        [(2, 1), (9, 3), (7, 6), (1, 5)],
    ]
    d.polygon(formas[q], fill=cor(GIZ[2]))
    d.line(formas[q][:2], fill=cor(GIZ[3]))
    d.point((4, 4), fill=cor(GIZ[1]))
    if q == 1:
        d.point((3, 3), fill=cor(ROXO[4]))  # giz colorido (lilás)
    return contornar(img, ROXO[0])


def poeira():
    rng = random.Random(77)
    w = 48
    a = np.zeros((w, w, 4), np.uint8)
    bolhas = [(24, 24, 15)] + [(24 + math.cos(i * 1.05 + 0.3) * 12, 24 + math.sin(i * 1.05 + 0.3) * 11, rng.uniform(8, 11)) for i in range(6)]
    for y in range(w):
        for x in range(w):
            dentro = max((1 - math.hypot(x - bx, y - by) / br) for bx, by, br in bolhas)
            if dentro <= 0:
                continue
            luz = (x + y) / (2 * w)
            if dentro < 0.18:
                c, al = GIZ[0], 200
            elif luz < 0.42:
                c, al = GIZ[3], 235
            elif luz < 0.58:
                c, al = GIZ[2], 230
            else:
                c, al = GIZ[1], 225
            a[y, x] = cor(c, al)
    img = Image.fromarray(a)
    d = ImageDraw.Draw(img)
    for _ in range(14):  # grãos lilás
        x, y = rng.randint(10, 38), rng.randint(10, 38)
        d.point((x, y), fill=cor(ROXO[4]))
    return contornar(img, ROXO[1])


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


def tom(f, t):
    return np.sin(2 * np.pi * np.cumsum(f) / TAXA)


def sons():
    rng = np.random.default_rng(11)
    # bonk: "tóim" de desenho (tom subindo e caindo rápido + estalo seco)
    t = np.arange(int(TAXA * 0.35)) / TAXA
    f = 520 + 380 * np.exp(-t * 30) - 180 * t
    s = tom(f, t) * np.exp(-t * 11) + passa_baixa(rng.standard_normal(len(t)), 3) * np.exp(-t * 60) * 0.7
    salvar_som('bonk', s)
    # pisao: baque grave e longo com chacoalhar de pedras
    t = np.arange(int(TAXA * 0.6)) / TAXA
    f = 70 * np.exp(-t * 4) + 32
    grave = tom(f, t) * np.exp(-t * 6)
    pedras = passa_baixa(rng.standard_normal(len(t)), 9) * np.exp(-t * 7) * (0.6 + 0.4 * np.sin(t * 90) ** 2)
    salvar_som('pisao', grave + pedras * 0.7)
    # giro: zunido que sobe e desce (ruído filtrado com vibrato)
    t = np.arange(int(TAXA * 0.5)) / TAXA
    ruido = passa_baixa(rng.standard_normal(len(t)), 4)
    env = np.sin(np.pi * t / t[-1]) * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * t))
    salvar_som('giro', ruido * env + tom(300 + 200 * np.sin(np.pi * t / t[-1]), t) * env * 0.25)
    # rugido: grave rosnado (dente de serra com tremolo) + ruído
    t = np.arange(int(TAXA * 0.7)) / TAXA
    f = 95 + 25 * np.sin(2 * np.pi * 3 * t)
    fase = np.cumsum(f) / TAXA
    serra = 2 * (fase % 1) - 1
    env = np.minimum(1, t * 18) * np.exp(-t * 2.2) * (0.75 + 0.25 * np.sin(2 * np.pi * 28 * t))
    salvar_som('rugido', passa_baixa(serra, 3) * env + passa_baixa(rng.standard_normal(len(t)), 5) * env * 0.5)
    # giz: "puf" de pó (ruído abafado curto)
    t = np.arange(int(TAXA * 0.4)) / TAXA
    salvar_som('giz', passa_baixa(rng.standard_normal(len(t)), 14) * np.exp(-t * 12) + tom(180 * np.exp(-t * 6) + 60, t) * np.exp(-t * 14) * 0.6)


def main():
    salvar(calombo(), 'calombo')
    salvar(bonk(), 'bonk')
    salvar(folha([estrela(0), estrela(1)]), 'estrela')
    salvar(folha([pilar(q) for q in range(3)]), 'pilar')
    salvar(folha([cascalho(q) for q in range(4)]), 'cascalho')
    salvar(marca(), 'marca')
    salvar(giro(), 'giro')
    salvar(redemoinho(), 'redemoinho')
    salvar(raiva(), 'raiva')
    salvar(olhar(), 'olhar')
    salvar(folha([som(0), som(1)]), 'som')
    salvar(boca(), 'boca')
    salvar(folha([bomba(0), bomba(1)]), 'bomba')
    salvar(folha([giz(q) for q in range(3)]), 'giz')
    salvar(poeira(), 'poeira')
    sons()
    print('sprites em', SAIDA)
    print('sons em', SAIDA_SOM)


if __name__ == '__main__':
    main()
