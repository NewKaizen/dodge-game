#!/usr/bin/env python3
"""Sprites e sons do SUPER de Dess ("Último Bis"): um jogo de ritmo de
verdade, trastes de guitarra piscando no PULSO fixo do show e, no fim, a
guitarra mergulha e explode em ondas de choque.

Uso (na raiz do projeto):  python3 scripts/super/dess.py
Precisa de Pillow e numpy. Saída determinística (sementes fixas).

Imagens em public/assets/sprites/super/dess/:
  carta.png     132x141  arte da carta: a guitarra cravada no palco, explodindo em ondas de som
  guitarra.png  30x96    a guitarra-arma, cabeça no topo e ponta afiada embaixo (o golpe mergulha com ela)
  traste.png    2x 16x32 faixa do braço da guitarra (2 tons, trastes acesos)
  nota.png      14x16    a "palheta" que cai em cada traste (tingida por cor a cada acorde)
  impacto.png   32x32    estouro de um acorde batido (usado nos trastes e na onda de choque final)
Sons em public/assets/audio/super/dess/: tique, acorde, mergulho, estouro (.wav)
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'dess')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'dess')

VAZIO = (0, 0, 0, 0)

# ---------- paleta (vermelho/laranja neon de palco; cor da Dess 0xff5070) ----------
CONTORNO = (16, 4, 12)
VERMELHO = (255, 58, 94)
VERMELHO_ESCURO = (140, 14, 38)
VERMELHO_CLARO = (255, 150, 170)
LARANJA = (255, 150, 58)
LARANJA_ESCURO = (150, 66, 18)
AMARELO = (255, 221, 74)
AMARELO_CLARO = (255, 245, 190)
BRANCO = (255, 255, 255)
ACO = (92, 86, 112)
ACO_CLARO = (196, 194, 218)
ACO_ESCURO = (52, 48, 68)
MADEIRA = (42, 16, 24)


# ---------- utilitários ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor, alfa=255):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


def misturar(img, x, y, cor, alfa):
    x, y = int(round(x)), int(round(y))
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
    return img


def escurecer_base(img, altura_faixa, forca=0.55):
    """Escurece as últimas `altura_faixa` linhas (onde a palavra SUPER entra)."""
    h = img.height
    for y in range(h - altura_faixa, h):
        f = (y - (h - altura_faixa)) / altura_faixa * forca
        for x in range(img.width):
            r, g, b, a = img.getpixel((x, y))
            if a:
                img.putpixel((x, y), (int(r * (1 - f)), int(g * (1 - f)), int(b * (1 - f)), a))


def ampliar(img, fator):
    return img.resize((img.width * fator, img.height * fator), Image.NEAREST)


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome))


# ---------- a guitarra-arma (cabeça no topo, ponta afiada embaixo) ----------


def guitarra_vertical(largura=30, altura=96):
    img = nova(largura, altura)
    cx = largura / 2
    cabeca_fim = 18
    pescoco_fim = 78

    def meia_largura(y):
        if y < cabeca_fim:
            t = y / cabeca_fim
            return 13 - 2.5 * t
        if y < pescoco_fim:
            return 5
        t = (y - pescoco_fim) / max(1, altura - 1 - pescoco_fim)
        return max(0.6, 5 * (1 - t))

    for y in range(altura):
        m = meia_largura(y)
        mi = int(round(m))
        for dx in range(-mi, mi + 1):
            x = cx + dx
            borda = abs(dx) >= mi - 0.6
            if y < cabeca_fim:
                cor = VERMELHO_ESCURO if borda else (VERMELHO_CLARO if dx in (-1, 0) and 6 < y < 12 else VERMELHO)
            elif y < pescoco_fim:
                cor = VERMELHO_ESCURO if borda else MADEIRA
            else:
                cor = ACO_ESCURO if borda else (ACO_CLARO if y > altura - 7 else ACO)
            por(img, x, y, cor)

    # rastilho (nut)
    for dx in range(-6, 7):
        por(img, cx + dx, cabeca_fim, BRANCO)
    # cordas
    for y in range(cabeca_fim + 1, pescoco_fim):
        por(img, cx - 1, y, ACO_CLARO)
        por(img, cx + 1, y, ACO)
    # trastes (linhas claras cruzando o braço)
    for fy in range(cabeca_fim + 8, pescoco_fim, 10):
        for dx in range(-4, 5):
            por(img, cx + dx, fy, ACO_CLARO)
    # incrustações (losangos amarelos em dois trastes)
    for fy in (cabeca_fim + 18, cabeca_fim + 38):
        for dx, dy in [(0, -2), (0, 2), (-2, 0), (2, 0), (0, 0)]:
            por(img, cx + dx, fy + dy, AMARELO)
    # tarraxas (tuning pegs) dos dois lados da cabeça
    for y in (3, 8, 13):
        base = int(meia_largura(y))
        for lado in (-1, 1):
            px = cx + lado * (base + 2)
            por(img, px, y, ACO_CLARO)
            por(img, px + lado, y, ACO_ESCURO)
    # losango da Dess no meio da cabeça
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            if abs(dx) + abs(dy) <= 2:
                por(img, cx + dx, 9 + dy, AMARELO if abs(dx) + abs(dy) < 2 else LARANJA)

    return contornar(img)


# ---------- trastes do braço (fundo do palco) ----------


def traste(cor_base, cor_fio):
    img = nova(16, 32)
    for y in range(32):
        for x in range(16):
            borda = x <= 1 or x >= 14
            centro = 6 <= x <= 9
            if borda:
                cor = tuple(int(c * 0.45) for c in cor_base)
            elif centro:
                cor = cor_fio if (y % 8 < 2) else tuple(int(c * 0.85 + 40) for c in cor_base)
            else:
                cor = cor_base
            por(img, x, y, cor)
    # tique de traste (linha fina) a cada 8px
    for y in range(0, 32, 8):
        for x in range(2, 14):
            misturar(img, x, y, (0, 0, 0), 0.3)
    return img


def gerar_trastes():
    folha = nova(32, 32)
    folha.alpha_composite(traste(VERMELHO_ESCURO, VERMELHO_CLARO), (0, 0))
    folha.alpha_composite(traste(LARANJA_ESCURO, AMARELO_CLARO), (16, 0))
    return folha


# ---------- a nota (palheta que cai) ----------


def nota_img():
    """Uma colcheia (nota musical): cabeça + haste + bandeirola."""
    img = nova(16, 20)
    d = ImageDraw.Draw(img)
    d.ellipse([1, 12, 12, 19], fill=rgba(AMARELO))
    d.rectangle([9, 1, 11, 15], fill=rgba(BRANCO))
    d.polygon([(11, 1), (15, 6), (14, 10), (11, 7)], fill=rgba(AMARELO))
    for x in range(2, 10):
        for y in range(13, 19):
            dx, dy = x - 6, (y - 15.5) * 1.5
            if dx * dx + dy * dy <= 20 and (x + y) % 3 == 0:
                por(img, x, y, LARANJA)
    return contornar(img, (40, 28, 10))


# ---------- o estouro de um acorde (usado no traste e na onda de choque) ----------


def impacto_img():
    rng = random.Random(9)
    img = nova(32, 32)
    for y in range(32):
        for x in range(32):
            borda = min(x, y, 31 - x, 31 - y)
            if borda == 0:
                cor = AMARELO_CLARO
            elif borda == 1:
                cor = AMARELO
            else:
                d = math.hypot(x - 15.5, y - 15.5) / 22
                cor = tuple(int(VERMELHO[i] * (1 - d) + VERMELHO_ESCURO[i] * d) for i in range(3))
            por(img, x, y, cor)
    # raios de som em zigue-zague saindo do centro (em vez de rachaduras)
    for k in range(8):
        ang = k * (math.pi * 2 / 8) + rng.uniform(-0.2, 0.2)
        x, y = 15.5, 15.5
        for passo in range(8):
            ang += rng.uniform(-0.5, 0.5)
            nx, ny = x + math.cos(ang) * 2.3, y + math.sin(ang) * 2.3
            cor = AMARELO if passo % 2 == 0 else BRANCO
            por(img, nx, ny, cor)
            x, y = nx, ny
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if abs(dx) + abs(dy) <= 2:
                por(img, 15 + dx, 15 + dy, BRANCO if abs(dx) + abs(dy) <= 1 else AMARELO_CLARO)
    return img


# ---------- arte da carta ----------


def bezier(p0, p1, p2, t):
    return tuple((1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i] for i in range(2))


def gerar_carta():
    rng = random.Random(21)
    L, A = 66, 71
    img = nova(L, A)
    ix, iy = 37, 54  # ponto onde a ponta da guitarra crava no chão

    # fundo: raios quentes saindo do impacto
    for y in range(A):
        for x in range(L):
            ang = math.atan2(y - iy, x - ix)
            d = math.hypot(x - ix, y - iy)
            raio = int((ang + math.pi) / (math.pi * 2) * 16) % 2 == 0
            base = 0.2 + max(0, 0.55 - d / 60)
            if raio:
                base += 0.1 * max(0, 1 - d / 55)
            cor = (int(26 + 80 * base), int(10 + 40 * base), int(18 + 48 * base))
            por(img, x, y, cor)

    # dois holofotes cruzando o fundo em diagonal, vindos de cima
    for feixe in (-0.55, 0.62):
        for y in range(0, 40):
            largura = 2 + y * 0.2
            cx = L * 0.42 + feixe * y
            for dx in range(-int(largura), int(largura) + 1):
                misturar(img, cx + dx, y, (255, 210, 150), 0.06)

    # onda de choque atrás: anéis concêntricos saindo do impacto (finos, sem preencher)
    d = ImageDraw.Draw(img)
    for rr, c, alfa in [(26, LARANJA, 150), (19, AMARELO, 170)]:
        bbox = [ix - rr, iy - rr * 0.72, ix + rr, iy + rr * 0.72]
        d.ellipse(bbox, outline=rgba(c, alfa), width=1)

    # chão do palco em perspectiva (lajotas claras/escuras)
    hz = 48
    for y in range(hz, A):
        dy = y - hz
        z = 40 / max(1, dy)
        for x in range(L):
            wx = (x - ix) * z / 10
            clara = (math.floor(wx + 0.5) + math.floor(z)) % 2 == 0
            base = LARANJA_ESCURO if clara else (48, 16, 22)
            nevoa = max(0, 1 - (dy / (A - hz)) * 2.0)
            cor = tuple(int(base[i] * (1 - nevoa) + (150, 70, 50)[i] * nevoa) for i in range(3))
            por(img, x, y, cor)
    for x in range(L):
        por(img, x, hz, AMARELO if abs(x - ix) < 20 else LARANJA)

    # rastro de notas vindo de cima (o "verso" que leva até o acorde final)
    p0, p1, p2 = (6, 2), (14, 18), (ix - 10, iy - 24)
    for k in range(60):
        x, y = bezier(p0, p1, p2, k / 59)
        misturar(img, x, y, (255, 120, 150), 0.55)
        misturar(img, x + 1, y, (255, 120, 150), 0.25)

    # a guitarra cravada, quase vertical (leve inclinação), ponta no impacto
    g = guitarra_vertical(20, 62)
    g = g.rotate(-9, expand=True, resample=Image.NEAREST, fillcolor=VAZIO)
    img.alpha_composite(g, (ix - g.width // 2 - 2, iy - g.height + 4))

    # estouro no ponto de impacto: núcleo brilhante + raios de som (glow redondo, sem bloco quadrado)
    for raio_r, cor, alfa in [(17, VERMELHO_ESCURO, 0.45), (11, LARANJA, 0.6), (6, AMARELO, 0.85), (3, BRANCO, 1.0)]:
        for yy in range(max(0, iy - raio_r), min(A, iy + raio_r + 1)):
            for xx in range(max(0, ix - raio_r), min(L, ix + raio_r + 1)):
                dd = math.hypot(xx - ix, yy - iy)
                if dd <= raio_r:
                    misturar(img, xx, yy, cor, alfa * max(0, 1 - dd / raio_r))
    rng2 = random.Random(5)
    for k in range(10):
        ang = k * (2 * math.pi / 10) + rng2.uniform(-0.2, 0.2)
        x, y = float(ix), float(iy)
        for passo in range(7):
            ang += rng2.uniform(-0.4, 0.4)
            x, y = x + math.cos(ang) * 2.2, y + math.sin(ang) * 1.6
            misturar(img, x, y, AMARELO if passo % 2 == 0 else BRANCO, 0.8)

    # notas pequenas espalhadas
    nt = nota_img()
    for x, y, ang, esc in [(10, 14, 14, 0.8), (54, 10, -10, 0.7), (55, 44, 22, 0.85)]:
        n = nt.rotate(ang, expand=True, resample=Image.NEAREST)
        if esc != 1:
            n = n.resize((max(1, int(n.width * esc)), max(1, int(n.height * esc))), Image.NEAREST)
        img.alpha_composite(n, (int(x - n.width / 2), int(y - n.height / 2)))

    # faíscas soltas
    for _ in range(14):
        x, y = rng.randint(2, L - 3), rng.randint(2, A - 3)
        if abs(x - ix) < 8 and abs(y - iy) < 8:
            continue
        cor = rng.choice([BRANCO, AMARELO, LARANJA])
        por(img, x, y, cor)

    escurecer_base(img, 20, 0.4)
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


def sons():
    taxa = 22050
    rng = np.random.default_rng(21)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # tique do metrônomo: clique seco e agudo
    t = tempo(0.07)
    salvar_som('tique.wav', (np.sin(2 * np.pi * 2200 * t) + 0.4 * np.sin(2 * np.pi * 3300 * t)) * np.exp(-t * 70))

    # acorde: "pancada" de power chord (dois tons graves distorcidos + palheta de ruído)
    t = tempo(0.5)
    f1, f2 = 110, 165  # quinta justa (power chord)
    onda = lambda f: np.sign(np.sin(2 * np.pi * f * t))  # quadrada = distorção simples
    corpo = (onda(f1) * 0.6 + onda(f2) * 0.4) * np.exp(-t * 9)
    palhetada = rng.standard_normal(len(t)) * np.exp(-t * 55) * 0.5
    salvar_som('acorde.wav', corpo + palhetada)

    # mergulho: whammy bar descendo (tom caindo) + sopro
    t = tempo(0.5)
    f = 420 * np.exp(-t * 3.6) + 60
    fase = 2 * np.pi * np.cumsum(f) / taxa
    tom = np.sign(np.sin(fase)) * np.exp(-t * 2.2)
    sopro = (lambda r: np.convolve(r, np.ones(8) / 8, mode='same'))(rng.standard_normal(len(t))) * np.exp(-t * 4) * 0.4
    salvar_som('mergulho.wav', tom * 0.7 + sopro)

    # estouro: o acorde final, grande e distorcido, com platinado de ruído
    t = tempo(0.9)
    graves = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (55, 82.5, 110)) * np.exp(-t * 3.2) / 3
    estalo = rng.standard_normal(len(t)) * np.exp(-t * 16) * 0.6
    cauda = np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 6) * 0.2
    salvar_som('estouro.wav', graves * 1.1 + estalo + cauda)


def main():
    salvar(gerar_carta(), 'carta.png')
    salvar(guitarra_vertical(), 'guitarra.png')
    salvar(gerar_trastes(), 'traste.png')
    salvar(nota_img(), 'nota.png')
    salvar(impacto_img(), 'impacto.png')
    sons()


if __name__ == '__main__':
    main()
