#!/usr/bin/env python3
"""Gera os sprites do SUPER de Ralsei ("Último Capítulo") em
public/assets/sprites/super/ralsei/ e os sons em public/assets/audio/super/ralsei/.

Uso (na raiz do projeto):  python3 scripts/super/ralsei.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/super/sprites/ralsei.js):
  carta.png        132x141  arte da carta: livro aberto com um vórtice de fogo verde
                   subindo e a sombra de um dragão (asas e olhos) por trás
  pagina.png       40x56    página de pergaminho arrancada (vira pelo ar)
  chama.png        3 quadros 16x16: brasa/chama verde do sopro (flicker)
  asa.png          140x104  silhueta de asa de dragão (sopro telegrafado)
  espinho.png      2 quadros 14x30: espinho da moldura (broto / florescido)
  lamina-fogo.png  150x18   lâmina de fogo giratória (sopro em espiral do clímax)
  sombra-dragao.png 176x132 sombra do dragão (asas + olhos), pano de fundo do clímax
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'ralsei')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'ralsei')

VAZIO = (0, 0, 0, 0)

# ---------- paleta (verde e dourado do Ralsei: a cor dele é 0x6be08a) ----------
CONTORNO = (8, 20, 14)
VERDE_NOITE = (16, 46, 32)
VERDE_ESCURO = (28, 92, 60)
VERDE = (62, 170, 106)
RALSEI = (107, 224, 138)  # 0x6be08a
VERDE_CLARO = (190, 255, 206)
BRANCO = (255, 255, 255)
DOURADO_ESCURO = (150, 108, 28)
DOURADO = (233, 178, 58)
DOURADO_CLARO = (255, 224, 138)
PERGAMINHO_ESCURA = (142, 112, 64)
PERGAMINHO = (222, 196, 140)
PERGAMINHO_CLARA = (248, 234, 198)
SOMBRA = (14, 36, 24)
SOMBRA_CLARA = (30, 72, 46)
OLHO = (255, 214, 92)
OLHO_CLARO = (255, 246, 196)


# ---------- utilitários (iguais em espírito aos outros scripts/super/*.py) ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor, alfa=255):
    x, y = int(x), int(y)
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


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


def ampliar(img, fator):
    return img.resize((img.width * fator, img.height * fator), Image.NEAREST)


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


def misturar_cor(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ---------- página ----------


def gerar_pagina():
    """Página de pergaminho arrancada: borda direita rasgada, canto dobrado
    (brilhando: é por ali que ela vai virar) e linhas de texto mágico verde."""
    rng = random.Random(5)
    L, A = 40, 56
    img = nova(L, A)
    for y in range(A):
        franja = rng.Random(y).randint(-2, 1) if False else 0  # placeholder (determinístico abaixo)
    rasgo = [rng.randint(-3, 2) for _ in range(A)]
    for y in range(A):
        borda = L - 4 + rasgo[y]
        for x in range(2, max(3, borda)):
            d = (x - 2) / max(1, borda - 2)
            cor = misturar_cor(PERGAMINHO_CLARA, PERGAMINHO_ESCURA, d * 0.6 + (y / A) * 0.25)
            por(img, x, y, cor)
        # fibra rasgada clara bem na beirada
        por(img, max(2, borda - 1), y, PERGAMINHO_CLARA)
    # dobra/sombra na lombada (esquerda)
    for y in range(A):
        por(img, 2, y, PERGAMINHO_ESCURA)
        por(img, 3, y, misturar_cor(PERGAMINHO, PERGAMINHO_ESCURA, 0.4))
    # canto superior direito dobrado (o canto por onde ela "vira")
    dobra = 11
    for y in range(dobra):
        for x in range(L - dobra + y - 2, L - 2):
            if 0 <= x < L:
                por(img, x, y, PERGAMINHO_CLARA)
    for k in range(dobra):
        linha(img, L - dobra + k - 2, 0, L - 2, k, PERGAMINHO_ESCURA)
    # linhas de "texto" (travessões), algumas em tinta verde (mágica)
    for i, y in enumerate(range(16, A - 6, 7)):
        cor_tinta = VERDE_ESCURO if i % 2 == 0 else PERGAMINHO_ESCURA
        comp = rng.randint(14, 22)
        linha(img, 6, y, 6 + comp, y, cor_tinta)
        if i % 2 == 0:
            linha(img, 6, y + 1, 6 + comp * 0.6, y + 1, cor_tinta)
    # pequeno coração de tinta verde brilhando (a "assinatura" mágica da página)
    cx, cy = 13, 10
    for dx, dy in [(-1, 0), (1, 0), (-2, 1), (0, 1), (2, 1), (-1, 2), (1, 2), (0, 3)]:
        por(img, cx + dx, cy + dy, RALSEI)
    por(img, cx, cy + 1, VERDE_CLARO)
    contornar(img, CONTORNO)
    return img


# ---------- chama (sopro) ----------


def gerar_chama():
    """Gotícula de chama verde com núcleo dourado, 3 quadros de flicker."""
    folha = nova(48, 16)
    for q in range(3):
        rng = random.Random(100 + q)
        img = nova(16, 16)
        topo = 1 + rng.uniform(-0.6, 0.6)
        for y in range(16):
            t = (y - topo) / (14 - topo)
            if t < 0 or t > 1:
                continue
            largura = (1 - (1 - t) ** 2) * 6.2 + 0.6
            largura += math.sin(t * 7 + q * 2) * 0.5
            for dx in range(-int(largura) - 1, int(largura) + 2):
                d = abs(dx) / max(0.6, largura)
                if d > 1:
                    continue
                if t < 0.35:
                    cor = DOURADO_CLARO if d < 0.4 else DOURADO
                elif t < 0.7:
                    cor = misturar_cor(DOURADO, RALSEI, (t - 0.35) / 0.35) if d < 0.5 else VERDE
                else:
                    cor = RALSEI if d < 0.55 else VERDE_ESCURO
                por(img, 8 + dx, y, cor)
        por(img, 8, int(topo) + 1, BRANCO)
        contornar(img, VERDE_NOITE)
        folha.alpha_composite(img, (q * 16, 0))
    return folha


# ---------- asa (silhueta, telegrafo do sopro) ----------


def desenhar_asa(L, A, alpha_min=0.48, cor=SOMBRA, cor_clara=SOMBRA_CLARA):
    """Desenha uma silhueta de asa de dragão (membrana) no tamanho pedido
    (sempre proporcional: aponta para a direita, dedos fracionários).
    Usada tanto para o sprite avulso quanto, em escalas diferentes, na carta
    e na sombra do clímax (desenhar direto no tamanho final evita perder
    nitidez num resize para baixo)."""
    img = nova(L, A)
    ox, oy = max(2, round(L * 0.045)), A - round(A * 0.08)
    dedos = [(-0.08, 0.98), (0.22, 1.0), (0.5, 0.94), (0.74, 0.8), (0.9, 0.56)]
    pontos_topo = [(ox, oy)]
    for f, k in dedos:
        pontos_topo.append((ox + f * (L - L * 0.1) + (L - L * 0.1) * 0.02, oy - k * (A - A * 0.1)))
    pontos_topo.append((L - L * 0.03, oy - A * 0.06))
    # membrana preenchida: a borda de cima liga os dedos direto (zigue-zague
    # raso, como um leque dobrado) -- x sempre crescente, então o polígono
    # nunca se cruza e a silhueta sai sólida, sem buracos
    membrana = nova(L, A)
    dm = ImageDraw.Draw(membrana)
    poligono = pontos_topo + [(L - L * 0.03, oy), (ox, oy)]
    dm.polygon(poligono, fill=rgba(cor, 255))
    img.alpha_composite(membrana)
    # nervuras (ossos da asa) mais claras
    for fx, fy in pontos_topo[1:-1]:
        linha(img, ox, oy, fx, fy, cor_clara, 220)
    linha(img, ox, oy, L - L * 0.04, oy - A * 0.1, cor_clara, 230)
    # brilho verde fino na borda de cima (luz passando pela membrana)
    for i in range(len(pontos_topo) - 1):
        x0, y0 = pontos_topo[i]
        x1, y1 = pontos_topo[i + 1]
        linha(img, x0, y0, x1, y1, VERDE, 190)
    # desvanece um pouco nas pontas, sem sumir (alpha mínimo alpha_min)
    arr = np.array(img).astype(np.float32)
    diag = math.hypot(L - ox, A)
    for y in range(A):
        for x in range(L):
            if arr[y, x, 3] == 0:
                continue
            d = math.hypot(x - ox, y - oy) / diag
            arr[y, x, 3] *= max(alpha_min, 1 - d * 0.5)
    return Image.fromarray(arr.astype(np.uint8))


def gerar_asa():
    return desenhar_asa(140, 104)


# ---------- espinho (moldura) ----------


def gerar_espinho():
    """Espinho da moldura de página: quadro 0 = broto (pequeno, fosco,
    seguro), quadro 1 = florescido (longo, pontudo, ponta dourada acesa:
    perigoso). Aponta para cima; o jogo gira conforme o lado da borda."""
    folha = nova(28, 30)
    base = 29
    cx = 7

    # quadro 0: broto curto e fosco (um nó com uma pontinha, nada ameaçador)
    img = nova(14, 30)
    for y in range(base - 7, base):
        largura = (base - y) * 0.55 + 1
        for dx in range(-int(largura) - 1, int(largura) + 1):
            if abs(dx) > largura:
                continue
            por(img, cx + dx, y, misturar_cor((36, 58, 42), VERDE_ESCURO, 0.4))
    por(img, cx, base - 8, (36, 58, 42))
    contornar(img, VERDE_NOITE)
    folha.alpha_composite(img, (0, 0))

    # quadro 1: espinho comprido, afiado, bem pontudo, ponta dourada acesa
    img = nova(14, 30)
    ponta = 1
    for y in range(ponta, base):
        t = (y - ponta) / (base - ponta)  # 0 na ponta, 1 na base
        largura = max(0.4, t ** 1.6 * 3.6)
        for dx in range(-int(largura) - 1, int(largura) + 2):
            d = abs(dx) / max(0.5, largura)
            if d > 1:
                continue
            if t < 0.16:
                cor = DOURADO_CLARO if d < 0.5 else DOURADO
            elif d < 0.3:
                cor = VERDE_CLARO
            elif d < 0.75:
                cor = RALSEI
            else:
                cor = VERDE_ESCURO
            por(img, cx + dx, y, cor)
    # dois espinhinhos laterais menores (como um galho de rosa)
    for y0, lado, comp in [(base - 9, -1, 6), (base - 16, 1, 6)]:
        linha(img, cx, y0, cx + lado * comp, y0 - comp * 0.55, VERDE)
        linha(img, cx + lado, y0, cx + lado * (comp - 1), y0 - comp * 0.55 + 1, VERDE_ESCURO)
    por(img, cx, ponta, BRANCO)
    contornar(img, CONTORNO)
    folha.alpha_composite(img, (14, 0))
    return folha


# ---------- lâmina de fogo (clímax: sopro em espiral) ----------


def gerar_lamina_fogo():
    """Lâmina giratória do sopro em espiral: crescente grossa no meio, fina
    nas pontas, núcleo dourado e bordas verdes (como o corte de uma espada,
    mas feita de fogo)."""
    L, A = 150, 18
    img = nova(L, A)
    rng = random.Random(21)
    for x in range(L):
        t = x / (L - 1)
        meia = 8.2 * math.sin(math.pi * t) ** 0.72
        curva = 1.6 * math.sin(math.pi * t * 1.3)
        for y in range(A):
            d = abs(y - A / 2 + curva)
            if d > meia:
                continue
            k = d / max(0.5, meia)
            if k < 0.3:
                cor = DOURADO_CLARO
            elif k < 0.55:
                cor = DOURADO
            elif k < 0.8:
                cor = RALSEI
            else:
                cor = VERDE_ESCURO
            alfa = 255 if k < 0.85 else 170
            por(img, x, y, cor, alfa)
    # fagulhas soltas acima/abaixo da lâmina
    for _ in range(14):
        x = rng.randint(10, L - 10)
        t = x / (L - 1)
        meia = 8.2 * math.sin(math.pi * t) ** 0.72
        y = int(A / 2 + rng.choice([-1, 1]) * (meia + rng.uniform(1, 3)))
        misturar(img, x, y, rng.choice([VERDE_CLARO, DOURADO_CLARO]), 0.6)
    return img


# ---------- sombra do dragão (pano de fundo do clímax) ----------


def gerar_sombra_dragao():
    """Silhueta do dragão: duas asas abertas e um vulto com dois olhos
    dourados brilhando. Propositalmente abstrato (sem rosto/corpo definido)."""
    L, A = 176, 132
    img = nova(L, A)
    cx, cy = L // 2, A - 18
    dir_ = desenhar_asa(108, 80, alpha_min=0.6)
    esq = dir_.transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(esq, (cx - 104, cy - 78))
    img.alpha_composite(dir_, (cx - 4, cy - 78))
    # corpo/cabeça: um vulto oval escuro atrás das asas
    corpo = nova(L, A)
    dc = ImageDraw.Draw(corpo)
    dc.ellipse([cx - 30, cy - 54, cx + 30, cy + 6], fill=rgba(SOMBRA, 255))
    dc.polygon([(cx - 14, cy - 50), (cx, cy - 74), (cx + 6, cy - 48)], fill=rgba(SOMBRA, 255))  # "chifre"/orelha
    dc.polygon([(cx + 10, cy - 50), (cx + 22, cy - 70), (cx + 20, cy - 44)], fill=rgba(SOMBRA, 255))
    img.alpha_composite(corpo)
    # contorno verde suave no vulto
    arr = np.array(img)
    op = arr[:, :, 3] > 0
    for y in range(1, A - 1):
        for x in range(1, L - 1):
            if not op[y, x] and (op[y - 1, x] or op[y + 1, x] or op[y, x - 1] or op[y, x + 1]):
                arr[y, x] = rgba(SOMBRA_CLARA, 160)
    img = Image.fromarray(arr)
    # olhos dourados
    for ex in (cx - 11, cx + 11):
        for dx in range(-3, 4):
            for dy in range(-2, 3):
                if abs(dx) + abs(dy) <= 3:
                    por(img, ex + dx, cy - 34 + dy, OLHO if abs(dx) + abs(dy) <= 2 else DOURADO_ESCURO)
        por(img, ex - 1, cy - 35, OLHO_CLARO)
    return img


# ---------- arte da carta ----------


def gerar_carta():
    """66x71 em pixels lógicos, ampliado 2x e cortado para 132x141: livro
    aberto, vórtice de fogo verde subindo e a sombra do dragão atrás."""
    rng = random.Random(33)
    L, A = 66, 71
    img = nova(L, A)
    cx = 33
    # fundo: noite esverdeada com um brilho vindo do livro
    fy = 58
    for y in range(A):
        for x in range(L):
            d = math.hypot(x - cx, y - fy) / 70
            ang = math.atan2(y - fy, x - cx)
            raio = (int((ang + math.pi) / (math.pi * 2) * 16)) % 2 == 0
            base = 0.12 + max(0, 0.6 - d)
            if raio:
                base += 0.08 * max(0, 1 - d * 1.3)
            cor = (int(10 + 30 * base), int(18 + 70 * base), int(14 + 48 * base))
            por(img, x, y, cor)
    # sombra do dragão ao fundo: asas bem abertas atrás do vórtice, dois
    # olhos dourados acesos no alto (nunca o rosto/corpo do Ralsei em si)
    dragao = nova(L, A)
    asa_r = desenhar_asa(34, 26, alpha_min=0.82)
    asa_l = asa_r.transpose(Image.FLIP_LEFT_RIGHT)
    dragao.alpha_composite(asa_l, (cx - 33, 4))
    dragao.alpha_composite(asa_r, (cx - 1, 4))
    dc = ImageDraw.Draw(dragao)
    dc.ellipse([cx - 9, 10, cx + 9, 24], fill=rgba(SOMBRA, 255))
    dc.polygon([(cx - 6, 11), (cx - 9, 2), (cx - 3, 9)], fill=rgba(SOMBRA, 255))
    dc.polygon([(cx + 4, 9), (cx + 9, 1), (cx + 7, 11)], fill=rgba(SOMBRA, 255))
    contornar(dragao, SOMBRA_CLARA)
    img.alpha_composite(dragao)
    for ex in (cx - 4, cx + 4):
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                por(img, ex + dx, 16 + dy, OLHO if abs(dx) + abs(dy) <= 1 else DOURADO_ESCURO)
        por(img, ex, 15, OLHO_CLARO)
    # vórtice de fogo: espiral logarítmica subindo do livro até quase o topo
    topo_espiral = 14
    base_espiral = 54
    voltas = 2.1
    for k in range(260):
        t = k / 259
        ang = t * voltas * 2 * math.pi
        raio = (1 - t) * 15 + 2
        y = base_espiral - t * (base_espiral - topo_espiral)
        x = cx + math.cos(ang) * raio * (0.55 + 0.45 * t)
        grossura = max(1, round(2.6 * (1 - t) + 0.6))
        for g in range(-grossura, grossura + 1):
            k2 = abs(g) / max(1, grossura)
            if t < 0.25:
                cor = DOURADO_CLARO if k2 < 0.4 else DOURADO
            elif t < 0.6:
                cor = misturar_cor(DOURADO, RALSEI, (t - 0.25) / 0.35) if k2 < 0.5 else VERDE
            else:
                cor = RALSEI if k2 < 0.6 else VERDE_ESCURO
            misturar(img, x + g * 0.6, y, cor, 0.85 - 0.3 * k2)
    # halo verde-claro na base do vórtice (de onde ele sai)
    for y in range(A):
        for x in range(L):
            d = math.hypot(x - cx, (y - base_espiral) * 1.2)
            if d < 14:
                misturar(img, x, y, VERDE_CLARO, 0.22 * (1 - d / 14))
    # livro aberto na base (duas páginas vistas de cima, abrindo em leque a
    # partir da lombada central -- igual a uma dupla de página de verdade)
    livro_topo = base_espiral - 4
    livro = nova(L, A)
    dl = ImageDraw.Draw(livro)
    for lado in (-1, 1):
        dl.polygon(
            [(cx, livro_topo), (cx + lado * 26, A - 1), (cx + lado * 2, A - 1)],
            fill=rgba(PERGAMINHO, 255),
        )
    img.alpha_composite(livro)
    # sombreado: mais escuro perto da lombada e nas bordas externas
    for lado in (-1, 1):
        for y in range(livro_topo, A):
            p = (y - livro_topo) / (A - livro_topo)
            largura = 2 + p * 24
            xo = cx + lado * 2
            for d in range(int(largura) + 1):
                x = round(xo + lado * d * (1 + p * 0.1))
                if not opaco(img, x, y):
                    continue
                k = d / max(1, largura)
                sombra_lombada = max(0, 1 - d / 5) * 0.5
                sombra_borda = max(0, k - 0.82) / 0.18 * 0.55
                cor = misturar_cor(PERGAMINHO_CLARA, PERGAMINHO_ESCURA, sombra_lombada + sombra_borda + p * 0.08)
                por(img, x, y, cor)
            # linha de texto (travessão) a cada poucas linhas
            if int(p * 40) % 5 == 0:
                linha(img, xo + lado * 3, y, xo + lado * largura * 0.8, y, PERGAMINHO_ESCURA)
    # brilho mágico verde tênue na dobra das páginas (é dali que o feitiço sai)
    for y in range(livro_topo, livro_topo + 6):
        misturar(img, cx, y, VERDE_CLARO, 0.5)
    # lombada do livro (capa, centro)
    for y in range(livro_topo - 1, A):
        por(img, cx - 1, y, (84, 60, 32))
        por(img, cx, y, (54, 38, 20))
        por(img, cx + 1, y, (84, 60, 32))
    # espinhos pequenos decorando a moldura inferior (cantos do card)
    for x0, lado in [(6, 1), (L - 6, -1)]:
        for i in range(3):
            y0 = A - 4 - i * 7
            linha(img, x0, y0, x0 + lado * 4, y0 - 6, VERDE)
            linha(img, x0 + lado * 1, y0, x0 + lado * 4, y0 - 6, VERDE_ESCURO)
    # faíscas/estrelinhas espalhadas
    for k in range(18):
        x = rng.randint(3, L - 4)
        y = rng.randint(2, 50)
        if abs(x - cx) < 6 and y > 40:
            continue
        cor = rng.choice([BRANCO, VERDE_CLARO, DOURADO_CLARO])
        por(img, x, y, cor)
        if k % 3 == 0:
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                por(img, x + dx, y + dy, cor, 140)
    grande = ampliar(img, 2)
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
    rng = np.random.default_rng(22)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # página virando: chiado curto de papel (ruído filtrado com um "flap")
    t = tempo(0.32)
    ruido = rng.standard_normal(len(t))
    chiado = passa_baixa(ruido, 2) - passa_baixa(ruido, 10)
    env = np.sin(np.pi * np.clip(t / 0.3, 0, 1)) ** 0.6
    flap = np.sin(2 * np.pi * 10 * t) * np.exp(-t * 14) * 0.3
    salvar_som('pagina.wav', (chiado * 1.3 + flap) * env)

    # sopro de fogo: whoosh grave subindo + chiado de chama
    t = tempo(0.75)
    f = 90 + 260 * (t / t[-1]) ** 1.4
    whoosh = np.sin(2 * np.pi * np.cumsum(f) / taxa) * np.exp(-((t - 0.18) ** 2) / 0.05)
    chama = passa_baixa(rng.standard_normal(len(t)), 5) * np.exp(-t * 2.2)
    env = np.minimum(1, t * 10) * np.exp(-np.clip(t - 0.3, 0, None) * 3)
    salvar_som('sopro.wav', whoosh * 0.9 * env + chama * 0.6)

    # espinho: estalo curto e seco (broto -> espinho)
    t = tempo(0.14)
    estalo = np.sin(2 * np.pi * (1800 * np.exp(-t * 30) + 260) * t) * np.exp(-t * 32)
    clique = passa_baixa(rng.standard_normal(len(t)), 2) * np.exp(-t * 60) * 0.5
    salvar_som('espinho.wav', estalo + clique)

    # dragão: rugido grave e longo, com vibrato lento e uma crista de ruído
    t = tempo(1.3)
    f = 55 + 16 * np.sin(2 * np.pi * 3.5 * t) + 20 * np.exp(-t * 2)
    rugido = np.sin(2 * np.pi * np.cumsum(f) / taxa)
    rugido += 0.5 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / taxa)
    cresta = passa_baixa(rng.standard_normal(len(t)), 8) * np.clip(np.sin(np.pi * t / t[-1]), 0, 1) * 0.5
    env = np.clip(t / 0.18, 0, 1) * np.exp(-np.clip(t - 0.75, 0, None) * 2.2)
    salvar_som('dragao.wav', (rugido * 0.8 + cresta) * env)


def main():
    salvar(gerar_carta(), 'carta.png')
    salvar(gerar_pagina(), 'pagina.png')
    salvar(gerar_chama(), 'chama.png')
    salvar(gerar_asa(), 'asa.png')
    salvar(gerar_espinho(), 'espinho.png')
    salvar(gerar_lamina_fogo(), 'lamina-fogo.png')
    salvar(gerar_sombra_dragao(), 'sombra-dragao.png')
    sons()


if __name__ == '__main__':
    main()
