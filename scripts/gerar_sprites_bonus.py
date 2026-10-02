#!/usr/bin/env python3
"""Gera as texturas dos bonus rounds do PvP (pixel art) em
public/assets/sprites/bonus/<chave>.png.

Uso (na raiz do projeto):  python3 scripts/gerar_sprites_bonus.py
Precisa do Pillow. Saída determinística (sementes fixas): rodar de novo gera
os mesmos arquivos. As chaves e o que cada uma é estão em
src/game/pvp/bonus/LEIA-ME.md; o registro fica em src/game/assets.js.

Texturas "pintáveis" (alvo, balão, tiro, espada, bumerangue, seta, holofote)
são brancas/cinza: o jogo pinta com setTint. As outras são coloridas e têm
contorno escuro de 1 px.
"""

import math
import os
import random

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'bonus')

VAZIO = (0, 0, 0, 0)


# ---------- utilitários ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor))


def opaco(img, x, y, limite=0):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((x, y))[3] > limite
    return False


def contornar(img, cor, diagonais=False, limite=0):
    """Contorno de 1 px por fora dos pixels opacos."""
    viz = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    if diagonais:
        viz += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    marcar = []
    for y in range(img.height):
        for x in range(img.width):
            if opaco(img, x, y, limite):
                continue
            if any(opaco(img, x + dx, y + dy, limite) for dx, dy in viz):
                marcar.append((x, y))
    for x, y in marcar:
        por(img, x, y, cor)
    return img


def faixa(valor, cores, limites):
    """Escolhe a cor da faixa (pixel art: sem degradê contínuo)."""
    for cor, lim in zip(cores, limites):
        if valor < lim:
            return cor
    return cores[-1]


def misturar(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ampliar_salvar(img, chave):
    caminho = os.path.join(SAIDA, chave + '.png')
    img.save(caminho, optimize=True)
    return caminho


# ---------- explosão (8 quadros, 48x48) ----------

FOGO_CORES = [(255, 255, 255), (255, 247, 168), (255, 214, 64), (255, 148, 32), (232, 72, 28), (150, 30, 30)]
FOGO_CONTORNO = (48, 14, 20)
FUMACA_CORES = [(236, 232, 240), (196, 190, 204), (150, 142, 160), (104, 96, 116)]
FUMACA_CONTORNO = (40, 34, 50)


def blob(img, nuvens, cores, limites, luz=(-0.35, -0.4), so_vazio=False):
    """nuvens: lista de (cx, cy, r, bolhas, fase). Pinta a união dos círculos
    (com borda ondulada) sombreando a partir de um ponto de luz deslocado."""
    for y in range(img.height):
        for x in range(img.width):
            melhor = None
            for cx, cy, r, bolhas, fase in nuvens:
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                ang = math.atan2(dy, dx)
                rr = r * (1 + bolhas * math.sin(ang * 7 + fase) + bolhas * 0.6 * math.sin(ang * 11 - fase * 2))
                if math.hypot(dx, dy) > rr:
                    continue
                lx, ly = cx + luz[0] * r, cy + luz[1] * r
                v = math.hypot(x + 0.5 - lx, y + 0.5 - ly) / (rr * (1 + math.hypot(*luz)))
                melhor = v if melhor is None else min(melhor, v)
            if melhor is None:
                continue
            if so_vazio and img.getpixel((x, y))[3]:
                continue
            por(img, x, y, faixa(melhor, cores, limites))


def raios(img, cx, cy, n, r0, r1, cor, rng, grossura=1):
    for i in range(n):
        ang = (i / n) * math.tau + rng.uniform(-0.15, 0.15)
        comp = rng.uniform(r0, r1)
        for k in range(int(comp)):
            if k < r0 * 0.55:
                continue
            x = cx + math.cos(ang) * k
            y = cy + math.sin(ang) * k
            por(img, int(x), int(y), cor)
            if grossura > 1 and k < comp * 0.7:
                por(img, int(x + 0.5), int(y + 0.5), cor)


def explosao():
    rng = random.Random(7)
    quadros = []
    C = 24  # centro
    T = 48

    # 0: clarão branco pequeno com raios
    img = nova(T, T)
    raios(img, C, C, 12, 8, 15, (255, 247, 168), rng, 2)
    blob(img, [(C, C, 7, 0.08, 0.3)], FOGO_CORES, [0.45, 0.75, 1.1])
    contornar(img, (255, 214, 64))
    quadros.append(img)

    # 1: bola branca/amarela crescendo, contorno escuro
    img = nova(T, T)
    raios(img, C, C, 10, 13, 20, (255, 214, 64), rng, 2)
    blob(img, [(C, C, 12, 0.1, 1.1)], FOGO_CORES, [0.4, 0.62, 0.85, 1.1])
    contornar(img, FOGO_CONTORNO)
    quadros.append(img)

    # 2: bola de fogo grande e ondulada
    img = nova(T, T)
    blob(img, [(C, C, 17, 0.09, 2.0), (C - 9, C - 6, 8, 0.1, 0.4), (C + 10, C - 4, 7, 0.1, 1.7), (C + 2, C + 11, 8, 0.1, 2.9)],
         FOGO_CORES, [0.22, 0.42, 0.62, 0.82, 1.1])
    contornar(img, FOGO_CONTORNO)
    quadros.append(img)

    # 3: no máximo; miolo já laranja, bordas vermelhas
    img = nova(T, T)
    blob(img, [(C, C - 1, 19, 0.08, 0.9), (C - 11, C - 8, 9, 0.12, 2.2), (C + 12, C - 6, 8, 0.12, 0.2),
               (C - 9, C + 10, 8, 0.12, 1.4), (C + 9, C + 11, 8, 0.12, 3.3)],
         FOGO_CORES[1:], [0.25, 0.48, 0.72, 0.92, 1.2])
    contornar(img, FOGO_CONTORNO)
    quadros.append(img)

    # 4: fogo apagando por dentro da fumaça que aparece por cima
    img = nova(T, T)
    blob(img, [(C - 12, C - 12, 8, 0.1, 0.5), (C + 13, C - 10, 7, 0.1, 1.2), (C + 12, C + 12, 7, 0.1, 2.0),
               (C - 13, C + 11, 7, 0.1, 2.6), (C, C - 16, 6, 0.1, 0.7)],
         FUMACA_CORES, [0.4, 0.68, 0.9, 1.2])
    blob(img, [(C, C, 17, 0.1, 1.9), (C - 7, C + 6, 9, 0.12, 0.8), (C + 7, C - 5, 9, 0.12, 2.4)],
         FOGO_CORES[2:], [0.3, 0.6, 0.85, 1.2])
    contornar(img, FUMACA_CONTORNO)
    quadros.append(img)

    # 5: fumaça tomou conta, brasas no meio
    img = nova(T, T)
    blob(img, [(C, C, 9, 0.12, 0.3), (C - 4, C + 3, 5, 0.1, 1.0)], FOGO_CORES[3:], [0.5, 0.85, 1.2])
    blob(img, [(C - 10, C - 9, 10, 0.08, 0.5), (C + 10, C - 8, 9, 0.08, 1.2), (C + 11, C + 9, 9, 0.08, 2.0),
               (C - 10, C + 10, 9, 0.08, 2.6), (C, C - 14, 8, 0.08, 0.7), (C, C + 14, 7, 0.08, 1.6),
               (C - 15, C, 7, 0.08, 0.1), (C + 15, C, 7, 0.08, 2.2)],
         FUMACA_CORES, [0.38, 0.64, 0.88, 1.2], so_vazio=True)
    contornar(img, FUMACA_CONTORNO)
    quadros.append(img)

    # 6: tufos de fumaça se afastando, buraco no meio
    img = nova(T, T)
    tufos = []
    for i in range(7):
        ang = i / 7 * math.tau + 0.3
        tufos.append((C + math.cos(ang) * 15, C + math.sin(ang) * 15 - 2, 6.5 - (i % 3) * 0.8, 0.08, i))
    blob(img, tufos, FUMACA_CORES, [0.42, 0.7, 0.95, 1.2])
    contornar(img, FUMACA_CONTORNO)
    for x, y in [(C - 2, C), (C + 3, C - 3), (C + 1, C + 4)]:  # últimas brasas
        por(img, x, y, (255, 148, 32))
    quadros.append(img)

    # 7: poucos tufos pequenos e claros sumindo
    img = nova(T, T)
    tufos = []
    for i in range(6):
        ang = i / 6 * math.tau + 0.8
        tufos.append((C + math.cos(ang) * 17, C + math.sin(ang) * 17 - 2, 3.6 - (i % 2) * 0.9, 0.05, i))
    blob(img, tufos, FUMACA_CORES[:3], [0.5, 0.9, 1.2])
    contornar(img, FUMACA_CORES[3])
    quadros.append(img)

    return quadros


# ---------- alvo (32x32, branco) ----------


def alvo():
    img = nova(32, 32)
    c = 15.5
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
            if 10.2 <= d <= 12.6:
                por(img, x, y, (255, 255, 255))
            elif 4.6 <= d <= 5.8:
                por(img, x, y, (255, 255, 255, 200))
    # quatro marcas atravessando o anel, com vão no meio
    for k in list(range(2, 10)) + list(range(22, 30)):
        for w in (15, 16):
            por(img, k, w, (255, 255, 255))
            por(img, w, k, (255, 255, 255))
    # pontinho central
    for x, y in [(15, 15), (16, 15), (15, 16), (16, 16)]:
        por(img, x, y, (255, 255, 255))
    # sombra cinza clara por dentro do anel externo (dá volume ao pintar)
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
            if 9.4 <= d < 10.2 and img.getpixel((x, y))[3] == 0:
                por(img, x, y, (170, 170, 170, 160))
    del c
    return img


# ---------- bomba (20x20) ----------


def bomba():
    img = nova(20, 20)
    cx, cy, r = 9, 12, 6.8
    corpo = [(64, 64, 84), (40, 40, 56), (26, 26, 36)]
    for y in range(20):
        for x in range(20):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > r:
                continue
            v = math.hypot(x + 0.5 - (cx - 2.5), y + 0.5 - (cy - 2.5)) / (r * 1.5)
            por(img, x, y, faixa(v, corpo, [0.45, 0.85, 9]))
    # brilho
    for x, y in [(6, 8), (7, 8), (6, 9), (5, 10)]:
        por(img, x, y, (150, 160, 190))
    por(img, 7, 7, (230, 236, 255))
    por(img, 6, 7, (200, 210, 240))
    # gargalo
    for x in range(10, 14):
        for y in range(4, 7):
            por(img, x, y, (120, 120, 140) if y == 4 else (84, 84, 104))
    contornar(img, (12, 10, 18))
    # pavio (corda) e faísca
    for x, y in [(13, 3), (14, 2), (15, 2)]:
        por(img, x, y, (196, 150, 96))
    por(img, 14, 3, (140, 96, 60))
    faisca = {(16, 1): (255, 255, 255), (17, 1): (255, 214, 64), (16, 0): (255, 214, 64), (15, 1): (255, 148, 32),
              (16, 2): (255, 148, 32), (18, 0): (255, 247, 168), (18, 2): (255, 148, 32), (17, 3): (232, 72, 28),
              (14, 0): (255, 214, 64)}
    for (x, y), cor in faisca.items():
        por(img, x, y, cor)
    return img


# ---------- bola de discoteca (32x32) ----------


def bola_disco():
    img = nova(32, 32)
    cx, cy, r = 16, 17.5, 12.5
    rng = random.Random(3)
    claros = [(255, 255, 255), (214, 232, 255), (170, 200, 240), (120, 150, 210), (78, 96, 160), (50, 58, 110)]
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            # coordenadas "esféricas" para os azulejos (curvam nas bordas)
            lat = math.asin(max(-1, min(1, dy / r)))
            lon = math.asin(max(-1, min(1, dx / max(0.01, math.sqrt(max(0.01, r * r - dy * dy))))))
            tu, tv = lon / (math.pi / 9), lat / (math.pi / 10)
            linha = abs(tu - round(tu)) < 0.13 * (1 + abs(dx) / r) or abs(tv - round(tv)) < 0.14 * (1 + abs(dy) / r)
            luz = math.hypot(dx + r * 0.42, dy + r * 0.45) / (r * 1.8)
            if linha:
                cor = misturar(claros[min(5, int(luz * 6) + 2)], (30, 34, 70), 0.35)
            else:
                semente = int(math.floor(tu)) * 31 + int(math.floor(tv)) * 17
                ruido = random.Random(semente + 99).uniform(-0.18, 0.18)
                cor = claros[max(0, min(5, int((luz + ruido) * 6)))]
            por(img, x, y, cor)
    del rng
    contornar(img, (26, 24, 52))
    # suporte em cima
    for y in range(1, 5):
        por(img, 16, y, (150, 150, 170))
    for x in range(14, 19):
        por(img, x, 4, (190, 190, 210))
    por(img, 16, 0, (100, 100, 120))
    # brilhos de 4 pontas
    for bx, by, t in [(10, 11, 3), (22, 21, 2), (20, 12, 1), (6, 22, 1)]:
        por(img, bx, by, (255, 255, 255))
        for k in range(1, t + 1):
            cor = (255, 255, 255) if k < t else (200, 230, 255)
            for x, y in [(bx + k, by), (bx - k, by), (bx, by + k), (bx, by - k)]:
                por(img, x, y, cor)
    return img


# ---------- balão (16x22, branco) ----------


def balao():
    img = nova(16, 22)
    cx, cy, rx, ry = 8, 8, 6.6, 7.6
    tons = [(255, 255, 255), (236, 236, 236), (206, 206, 206)]
    for y in range(22):
        for x in range(16):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            # um pouco mais estreito embaixo (formato de gota)
            if dy > 0:
                dx *= 1 + dy * 0.25
            if dx * dx + dy * dy > 1:
                continue
            v = math.hypot(dx + 0.4, dy + 0.45) / 1.9
            por(img, x, y, faixa(v, tons, [0.5, 0.78, 9]))
    # brilho
    for x, y in [(5, 4), (5, 5), (4, 6), (6, 3)]:
        por(img, x, y, (255, 255, 255))
    contornar(img, (150, 150, 150))
    # nózinho
    for x, y in [(7, 16), (8, 16), (9, 16), (8, 17)]:
        por(img, x, y, (190, 190, 190))
    # barbante ondulado
    for y in range(18, 22):
        x = 8 + (1 if y in (19, 20) else 0)
        por(img, x, y, (200, 200, 200))
    return img


# ---------- tiro (8x8, branco com brilho) ----------


def tiro():
    img = nova(8, 8)
    for y in range(8):
        for x in range(8):
            d = math.hypot(x + 0.5 - 4, y + 0.5 - 4)
            if d <= 1.6:
                por(img, x, y, (255, 255, 255))
            elif d <= 2.6:
                por(img, x, y, (255, 255, 255, 230))
            elif d <= 3.7:
                por(img, x, y, (255, 255, 255, 90))
    return img


# ---------- espada (32x10, ponta para a direita, branca) ----------


def espada():
    img = nova(32, 10)
    branco, claro, medio, escuro = (255, 255, 255), (226, 226, 226), (180, 180, 180), (120, 120, 120)
    # lâmina: x 10..29, linhas 3..6; ponta afinando em 27..31
    for x in range(10, 32):
        for y in range(3, 7):
            if x >= 27:
                k = x - 27  # 0..4
                topo, base = 3 + (k + 1) // 2, 6 - k // 2
                if not (topo <= y <= base):
                    continue
            cor = branco if y == 3 else claro if y in (4, 5) else medio
            if y in (4, 5) and 12 <= x <= 25 and y == 5:
                cor = medio  # sulco (fuller)
            por(img, x, y, cor)
    # guarda
    for y in range(0, 10):
        for x in (8, 9):
            por(img, x, y, claro if x == 8 else medio)
    por(img, 8, 0, branco)
    # cabo enrolado
    for x in range(3, 8):
        for y in (4, 5):
            por(img, x, y, medio if (x + y) % 2 else escuro)
    # pomo
    for x, y in [(1, 4), (2, 4), (1, 5), (2, 5), (2, 3), (2, 6)]:
        por(img, x, y, claro)
    contornar(img, (96, 96, 96))
    return img


# ---------- bumerangue (16x16, branco) ----------


def bumerangue():
    img = nova(16, 16)
    # dois braços saindo do cotovelo (em cima, no meio) para baixo, formando um V
    braco = [((8, 3.5), (2.5, 12.5)), ((8, 3.5), (13.5, 12.5))]
    for y in range(16):
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            melhor = 99
            for (ax, ay), (bx, by) in braco:
                vx, vy = bx - ax, by - ay
                t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
                larg = 2.2 - t * 0.7
                d = math.hypot(px - (ax + vx * t), py - (ay + vy * t)) / larg
                melhor = min(melhor, d)
            if melhor <= 1:
                por(img, x, y, (255, 255, 255) if melhor < 0.45 or py < 6 else (222, 222, 222))
    contornar(img, (130, 130, 130))
    return img


# ---------- seta (16x16, apontando para a direita, branca) ----------


def seta():
    img = nova(16, 16)
    for y in range(16):
        for x in range(16):
            haste = 1 <= x <= 8 and 6 <= y <= 9
            cabeca = 8 <= x <= 14 and abs(y + 0.5 - 8) <= (14.5 - x) * 0.95
            if haste or cabeca:
                por(img, x, y, (255, 255, 255) if y < 8 else (222, 222, 222))
    contornar(img, (130, 130, 130))
    return img


# ---------- holofote (64x64, círculo branco suave) ----------


def holofote():
    img = nova(64, 64)
    R = 32
    for y in range(64):
        for x in range(64):
            d = math.hypot(x + 0.5 - 32, y + 0.5 - 32) / R
            if d >= 1:
                continue
            a = (1 - d * d) ** 2  # cai suave até 0 na borda
            img.putpixel((x, y), (255, 255, 255, round(255 * a)))
    return img


# ---------- selo "BONUS ROUND!" (160x48) ----------

FONTE = {
    'B': ['1111.', '11.11', '11.11', '1111.', '11.11', '11.11', '1111.'],
    'O': ['.111.', '11.11', '11.11', '11.11', '11.11', '11.11', '.111.'],
    'N': ['11..11', '111.11', '111111', '11.111', '11..11', '11..11', '11..11'],
    'U': ['11.11', '11.11', '11.11', '11.11', '11.11', '11.11', '.111.'],
    'S': ['.1111', '11...', '111..', '.111.', '..111', '...11', '1111.'],
    'R': ['1111.', '11.11', '11.11', '1111.', '111..', '11.1.', '11.11'],
    'D': ['1111.', '11.11', '11.11', '11.11', '11.11', '11.11', '1111.'],
    '!': ['11', '11', '11', '11', '11', '..', '11'],
    ' ': ['..', '..', '..', '..', '..', '..', '..'],
}


def selo():
    L, A = 160, 48
    img = nova(L, A)
    cx, cy = L / 2, A / 2

    # estrela de pontas (starburst) atrás, achatada para caber
    pontas = 18
    for y in range(A):
        for x in range(L):
            dx, dy = (x + 0.5 - cx) / 79, (y + 0.5 - cy) / 23.5
            ang = math.atan2(dy, dx)
            d = math.hypot(dx, dy)
            onda = (math.cos(ang * pontas) + 1) / 2
            raio = 0.7 + 0.3 * onda ** 1.5
            if d > raio:
                continue
            fatia = int(((ang + math.pi) / math.tau) * pontas * 2 + 0.5) % 2
            cor = (255, 200, 40) if fatia else (255, 150, 40)
            if d < 0.62:
                cor = (255, 226, 92) if fatia else (255, 184, 60)
            por(img, x, y, cor)
    contornar(img, (90, 28, 30))

    # texto: fonte 5x7 ampliada 3x na vertical e 2x na horizontal (letra gorda)
    texto = 'BONUS ROUND!'
    ex, ey = 2, 3
    larguras = [len(FONTE[ch][0]) * ex + 2 for ch in texto]
    total = sum(larguras) - 2
    x0 = round(cx - total / 2)
    y0 = round(cy - 7 * ey / 2)
    arco = [(255, 80, 80), (255, 160, 40), (255, 230, 60), (90, 220, 90), (70, 190, 255), (180, 110, 255)]
    letras = nova(L, A)
    i_cor = 0
    x = x0
    for i, ch in enumerate(texto):
        mapa = FONTE[ch]
        if ch != ' ':
            base = arco[i_cor % len(arco)]
            i_cor += 1
            sobe = -1 if i % 2 else 0  # letras pulando
            for ly, linha in enumerate(mapa):
                for lx, b in enumerate(linha):
                    if b != '1':
                        continue
                    for sy in range(ey):
                        for sx in range(ex):
                            py = y0 + ly * ey + sy + sobe
                            t = (ly * ey + sy) / (7 * ey)
                            if t < 0.12:
                                cor = misturar(base, (255, 255, 255), 0.75)
                            elif t < 0.55:
                                cor = misturar(base, (255, 255, 255), 0.25)
                            elif t < 0.85:
                                cor = base
                            else:
                                cor = misturar(base, (0, 0, 0), 0.3)
                            por(letras, x + lx * ex + sx, py, cor)
        x += larguras[i]
    # contorno grosso escuro (2 px) e sombra
    contornar(letras, (24, 10, 34))
    contornar(letras, (24, 10, 34), diagonais=True)
    sombra = nova(L, A)
    for y in range(A):
        for xx in range(L):
            if letras.getpixel((xx, y))[3]:
                por(sombra, xx + 1, y + 2, (60, 16, 40))
    img.alpha_composite(sombra)
    img.alpha_composite(letras)
    return img


# ---------- tudo ----------


def main():
    os.makedirs(SAIDA, exist_ok=True)
    texturas = {f'bonus-explosao-{i}': q for i, q in enumerate(explosao())}
    texturas.update({
        'bonus-alvo': alvo(),
        'bonus-bomba': bomba(),
        'bonus-bola-disco': bola_disco(),
        'bonus-balao': balao(),
        'bonus-tiro': tiro(),
        'bonus-espada': espada(),
        'bonus-bumerangue': bumerangue(),
        'bonus-seta': seta(),
        'bonus-selo': selo(),
        'bonus-holofote': holofote(),
    })
    for chave, img in texturas.items():
        ampliar_salvar(img, chave)
        print(f'{chave}.png  {img.width}x{img.height}')


if __name__ == '__main__':
    main()
