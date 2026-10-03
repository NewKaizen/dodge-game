#!/usr/bin/env python3
"""Gera os sprites do SUPER de Berdly ("Prova Irrefutável") em
public/assets/sprites/super/berdly/ e os sons em public/assets/audio/super/berdly/.

Uso (na raiz do projeto):  python3 scripts/super/berdly.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/super/sprites/berdly.js):
  carta.png     132x141  arte da carta: o redemoinho de ventania e páginas com o corte final
  lamina.png    96x22    lâmina de vento/papel do redemoinho (pivô à esquerda, ponta à direita)
  pagina.png    3 quadros 14x14: páginas/folhas voando (a rajada de cada volta)
  impacto.png   32x32    estouro de energia (cada volta completa / o golpe final)
  orbita.png    2 quadros 16x16: livrinho/página decorativos que rodopiam (sem colisão)
  feixe.png     160x20   o feixe reto do corte final ("a resposta certa")
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'berdly')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'berdly')

VAZIO = (0, 0, 0, 0)

# ---------- paleta (amarelo-esverdeado do Berdly + ciano de giz + dourado do golpe final) ----------
CONTORNO = (8, 20, 14)
NOITE = (14, 30, 24)
VERDE_SOMBRA = (40, 80, 30)
VERDE_ESCURO = (70, 128, 42)
VERDE = (122, 188, 58)
VERDE_CLARO = (216, 240, 90)  # 0xd8f05a, a cor do Berdly
CIANO = (150, 228, 255)
CIANO_CLARO = (224, 250, 255)
BRANCO = (255, 255, 255)
DOURADO_ESCURO = (196, 150, 40)
DOURADO = (255, 206, 90)
DOURADO_CLARO = (255, 238, 170)
PAPEL = (236, 238, 220)
PAPEL_SOMBRA = (168, 174, 150)
TINTA = (60, 70, 56)


def nova(w, h):
    return Image.new('RGBA', (w, h), VAZIO)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a) if len(c) == 3 else c


def por(img, x, y, cor, alfa=255):
    x, y = int(x), int(y)
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


def misturar_cor(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def misturar(img, x, y, cor, alfa):
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


def contornar(img, cor=CONTORNO, diagonais=True):
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


def ampliar(img, fator):
    return img.resize((img.width * fator, img.height * fator), Image.NEAREST)


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


# ---------- a lâmina de vento/papel (pivô à esquerda, ponta à direita) ----------
# Como uma foice/hélice: a borda de cima é convexa (o fio que corta, mais
# clara) e a de baixo é mais reta (o dorso, mais escuro) -- dá a sensação de
# giro mesmo parada. Usada três vezes no redemoinho (verde) e, maior e
# tingida de dourado, no giro final ("a resposta certa" antes do corte).
def gerar_lamina(largura=96, altura=26, rng_seed=5, dourada=False):
    rng = random.Random(rng_seed)
    img = nova(largura, altura)
    meio = altura * 0.42
    base = VERDE_CLARO if not dourada else DOURADO_CLARO
    corpo = VERDE if not dourada else DOURADO
    escuro = VERDE_ESCURO if not dourada else DOURADO_ESCURO
    sombra = VERDE_SOMBRA if not dourada else (120, 86, 30)
    entalhes = sorted(rng.uniform(0.2, 0.8) for _ in range(3))
    for x in range(largura):
        t = x / (largura - 1)
        afinar = math.sin(math.pi * t) ** 0.55
        cima = (meio * 1.55) * afinar  # fio: bulge forte (convexo)
        baixo = (meio * 0.68) * afinar  # dorso: mais perto do centro (côncavo)
        # a borda de cima é "rasgada" feito página
        for e in entalhes:
            d = abs(t - e)
            if d < 0.045:
                cima -= (0.045 - d) * 26
        for y in range(altura):
            dy = y - meio
            if -cima <= dy <= 0:
                k = -dy / max(1, cima)
            elif 0 < dy <= baixo:
                k = dy / max(1, baixo)
            else:
                continue
            if dy <= 0:  # fio (cima): claro, quase branco perto da borda
                cor = BRANCO if k < 0.2 else (base if k < 0.55 else corpo)
            else:  # dorso (baixo): mais escuro, sem brilho
                cor = corpo if k < 0.5 else escuro
            if t > 0.78:
                cor = misturar_cor(cor, BRANCO, (t - 0.78) / 0.22 * 0.65)
            por(img, x, y, cor)
    for x in range(largura):
        t = x / (largura - 1)
        afinar = math.sin(math.pi * t) ** 0.55
        y = int(meio + (meio * 0.68) * afinar)
        if opaco(img, x, y - 1):
            por(img, x, y - 1, sombra)
    contornar(img)
    return img


# Desenha uma lâmina diretamente girada em torno de um pivô (cx, cy), sem
# usar Image.rotate (fica nítida, sem borrão de interpolação). Usada na carta
# para montar o redemoinho com 3 lâminas em qualquer ângulo + rastro de giro.
def pintar_lamina_girada(img, cx, cy, ang_graus, comprimento, altura, dourada=False, alfa=1.0):
    ang = math.radians(ang_graus)
    c, s = math.cos(ang), math.sin(ang)
    meio = altura * 0.42
    base = VERDE_CLARO if not dourada else DOURADO_CLARO
    corpo = VERDE if not dourada else DOURADO
    escuro = VERDE_ESCURO if not dourada else DOURADO_ESCURO
    raio = math.hypot(comprimento, altura)
    for Y in range(int(cy - raio - 1), int(cy + raio + 2)):
        for X in range(int(cx - raio - 1), int(cx + raio + 2)):
            dx, dy = X - cx, Y - cy
            lx = dx * c + dy * s  # coordenada local ao longo da lâmina
            ly = -dx * s + dy * c  # coordenada local através da lâmina
            if lx < 0 or lx > comprimento:
                continue
            t = lx / comprimento
            afinar = math.sin(math.pi * t) ** 0.55
            cima = (meio * 1.55) * afinar
            baixo = (meio * 0.68) * afinar
            if -cima <= ly <= 0:
                k = -ly / max(1, cima)
                cor = BRANCO if k < 0.2 else (base if k < 0.55 else corpo)
            elif 0 < ly <= baixo:
                k = ly / max(1, baixo)
                cor = corpo if k < 0.5 else escuro
            else:
                continue
            if t > 0.78:
                cor = misturar_cor(cor, BRANCO, (t - 0.78) / 0.22 * 0.65)
            misturar(img, X, Y, cor, alfa)


# ---------- páginas voando (a rajada de cada volta) ----------
def gerar_pagina(variacao):
    img = nova(14, 14)
    rng = random.Random(31 + variacao)
    angulos = [-18, 10, 34]
    ang = math.radians(angulos[variacao % len(angulos)])
    c, s = math.cos(ang), math.sin(ang)
    cx, cy = 7, 7

    def T(x, y):
        x, y = x - 5, y - 6
        return (cx + x * c - y * s, cy + x * s + y * c)

    pts = [T(1, 1), T(9, 1), T(9, 11), T(1, 11)]
    d = ImageDraw.Draw(img)
    d.polygon(pts, fill=rgba(PAPEL))
    # dobra no canto
    dobra = [T(9, 1), T(9, 4), T(6, 1)]
    d.polygon(dobra, fill=rgba(PAPEL_SOMBRA))
    # linhas de "escrita"
    for ly in (4, 6.5, 9):
        p0 = T(2.5, ly)
        p1 = T(7.5 if ly != 9 else 5.5, ly)
        linha(img, p0[0], p0[1], p1[0], p1[1], TINTA)
    contornar(img, (30, 46, 30))
    # uma pontinha verde (o vento que a carrega)
    por(img, int(T(1, 11)[0]), int(T(1, 11)[1]), VERDE)
    return img


def gerar_paginas():
    folha = nova(42, 14)
    for k in range(3):
        folha.alpha_composite(gerar_pagina(k), (k * 14, 0))
    return folha


# ---------- estouro de energia (cada volta completa / início do golpe final) ----------
def gerar_impacto():
    rng = random.Random(17)
    img = nova(32, 32)
    cx, cy = 15.5, 15.5
    d = ImageDraw.Draw(img)
    for escala, cor in [(1.0, VERDE_ESCURO), (0.72, VERDE_CLARO), (0.42, CIANO_CLARO)]:
        pts = []
        for i in range(18):
            t = i * math.pi / 9
            r = (14 if i % 2 == 0 else rng.uniform(5, 8)) * escala
            pts.append((cx + math.cos(t) * r, cy + math.sin(t) * r))
        d.polygon(pts, fill=rgba(cor))
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            por(img, cx + dx, cy + dy, BRANCO)
    return contornar(img, VERDE_SOMBRA)


# ---------- livrinho/página que rodopia ao redor (decoração, sem colisão) ----------
def gerar_orbita(frame):
    img = nova(16, 16)
    if frame == 0:
        # livro fechado, visto de lado
        for y in range(3, 13):
            for x in range(2, 13):
                cor = VERDE if x < 11 else VERDE_ESCURO
                por(img, x, y, cor)
        for y in range(3, 13):
            por(img, 2, y, VERDE_CLARO)
        for y in (3, 12):
            for x in range(2, 13):
                por(img, x, y, VERDE_SOMBRA)
        for y in range(5, 11, 2):
            por(img, 12, y, CIANO_CLARO)
    else:
        # página solta, tombando (losango), com uma dobra e linhas de escrita
        pts = [(8, 2), (14, 8), (8, 14), (2, 8)]
        d = ImageDraw.Draw(img)
        d.polygon(pts, fill=rgba(PAPEL))
        d.polygon([(8, 2), (12, 6), (8, 8)], fill=rgba(PAPEL_SOMBRA))
        for k, ly in enumerate((6, 8, 10)):
            largura = 5 - abs(k - 1)
            linha(img, 8 - largura, ly, 8 + largura, ly, TINTA)
        por(img, 2, 8, VERDE_CLARO)
    return contornar(img, (20, 40, 26))


def gerar_orbitas():
    folha = nova(32, 16)
    folha.alpha_composite(gerar_orbita(0), (0, 0))
    folha.alpha_composite(gerar_orbita(1), (16, 0))
    return folha


# ---------- o feixe reto do corte final ("a resposta certa") ----------
def gerar_feixe():
    img = nova(160, 20)
    for x in range(160):
        t = x / 159
        meia = 8 * math.sin(math.pi * t) ** 0.75
        for y in range(20):
            dy = abs(y - 10)
            if dy > meia:
                continue
            k = dy / max(0.6, meia)
            if k < 0.3:
                cor = BRANCO
            elif k < 0.58:
                cor = DOURADO_CLARO
            elif k < 0.85:
                cor = VERDE_CLARO
            else:
                cor = VERDE_ESCURO
            alfa = 255 if k < 0.85 else 190
            por(img, x, y, cor, alfa)
    # fagulhas de giz ao longo do feixe
    rng = random.Random(9)
    for _ in range(14):
        x = rng.randint(10, 150)
        y = 10 + rng.randint(-2, 2)
        if opaco(img, x, y):
            por(img, x, y - rng.randint(2, 5), CIANO_CLARO, 160)
    return img


# ---------- arte da carta (132x141): o redemoinho de vento e páginas, acelerando ----------
def gerar_carta():
    rng = random.Random(45)
    L, A = 66, 71  # pixels lógicos; ampliado 2x no fim
    cx, cy = 33, 30
    img = nova(L, A)
    # fundo: noite esverdeada com raios saindo do olho do redemoinho
    for y in range(A):
        for x in range(L):
            ang = math.atan2(y - cy, x - cx)
            d = math.hypot(x - cx, y - cy)
            raio = (int((ang + math.pi) / (math.pi * 2) * 22)) % 2 == 0
            base = 0.16 + max(0, 0.62 - d / 44)
            if raio:
                base += 0.1 * max(0, 1 - d / 38)
            cor = (int(NOITE[0] + 60 * base), int(NOITE[1] + 92 * base), int(NOITE[2] + 52 * base))
            por(img, x, y, cor)
    # anéis de velocidade (o redemoinho girando bem rápido)
    for raio, alfa in [(37, 0.26), (30, 0.18)]:
        for passo in range(0, 360, 3):
            if passo % 11 < 6:
                continue
            ang = math.radians(passo)
            x, y = cx + math.cos(ang) * raio, cy + math.sin(ang) * raio * 0.92
            misturar(img, x, y, CIANO_CLARO, alfa)
    # três lâminas do redemoinho (120° entre si), cada uma com um rastro de
    # giro atrás (cópias mais fracas e um pouco atrasadas no ângulo)
    for ang_base in (-24, 96, 216):
        for off, alfa, comp in [(16, 0.16, 31), (9, 0.32, 33), (0, 1.0, 34)]:
            pintar_lamina_girada(img, cx, cy, ang_base - off, comp, 11, alfa=alfa)
    # páginas levadas pelo vento, para as bordas
    folha_pag = gerar_paginas()
    for k, (x, y) in enumerate([(4, 10), (56, 8), (3, 58), (58, 56), (30, 4), (60, 32)]):
        p = folha_pag.crop((k % 3 * 14, 0, k % 3 * 14 + 14, 14))
        img.alpha_composite(p, (x, y))
    # olho do redemoinho: brilho central
    for y in range(A):
        for x in range(L):
            d = math.hypot(x - cx, y - cy)
            if d < 10:
                misturar(img, x, y, CIANO_CLARO, 0.5 * (1 - d / 10))
            elif d < 15:
                misturar(img, x, y, BRANCO, 0.18 * (1 - (d - 10) / 5))
    # faíscas e migalhas de giz
    for k in range(20):
        x = rng.randint(2, L - 3)
        y = rng.randint(2, A - 3)
        if math.hypot(x - cx, y - cy) < 8:
            continue
        cor = rng.choice([BRANCO, CIANO_CLARO, VERDE_CLARO])
        por(img, x, y, cor)
        if k % 3 == 0:
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                por(img, x + dx, y + dy, cor, 140)
    grande = ampliar(img, 2)
    # base escurecida (onde entra a palavra SUPER)
    a = np.array(grande).astype(np.float32)
    H = a.shape[0]
    for y in range(H - 46, H):
        f = (y - (H - 46)) / 46 * 0.55
        a[y, :, :3] *= 1 - f
    grande = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return grande.crop((0, 0, 132, 141))


# ---------- sons ----------

def salvar_som(nome, amostras, taxa=22050):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    pico = np.max(np.abs(amostras)) or 1
    s = (amostras / pico * 0.7 * 32767).astype(np.int16)
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
    rng = np.random.default_rng(21)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # vento: rajada que sobe e some (o redemoinho acelerando)
    t = tempo(0.6)
    ruido = rng.standard_normal(len(t))
    vento = passa_baixa(ruido, 10) * 2.2
    env = np.clip(t / 0.08, 0, 1) * np.exp(-np.clip(t - 0.08, 0, None) * 5)
    assobio = np.sin(2 * np.pi * (500 + 700 * t / t[-1]) * t) * 0.18
    salvar_som('vento.wav', (vento + assobio) * env)

    # tique: "ding" de acerto/volta completa (cristalino, como um quadro certo)
    t = tempo(0.22)
    f = [1760, 2637, 3520]
    s = sum(np.sin(2 * np.pi * fi * t) * (1 / (i + 1)) for i, fi in enumerate(f))
    salvar_som('tique.wav', s * np.exp(-t * 9))

    # estalo: crac seco de giz/página (o golpe acertando)
    t = tempo(0.35)
    ruido = rng.standard_normal(len(t))
    estalo = passa_baixa(ruido, 2) * np.exp(-t * 26)
    grave = np.sin(2 * np.pi * (140 * np.exp(-t * 14) + 60) * t) * np.exp(-t * 16)
    salvar_som('estalo.wav', estalo * 1.3 + grave * 0.8)

    # giro: zumbido que sobe rápido (o giro final acelerando ao máximo)
    t = tempo(0.9)
    f = 180 + 1400 * (t / t[-1]) ** 1.6
    fase = 2 * np.pi * np.cumsum(f) / taxa
    onda = np.sin(fase) * 0.55 + np.sin(fase * 2.01) * 0.25
    vento2 = passa_baixa(rng.standard_normal(len(t)), 5) * 0.3
    env = np.minimum(1, t * 10) * np.exp(-np.clip(t - 0.6, 0, None) * 8)
    salvar_som('giro.wav', (onda + vento2) * env)


def main():
    salvar(gerar_carta(), 'carta.png')
    salvar(gerar_lamina(), 'lamina.png')
    salvar(gerar_paginas(), 'pagina.png')
    salvar(gerar_impacto(), 'impacto.png')
    salvar(gerar_orbitas(), 'orbita.png')
    salvar(gerar_feixe(), 'feixe.png')
    sons()


if __name__ == '__main__':
    main()
