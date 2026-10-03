#!/usr/bin/env python3
"""Gera os sprites do SUPER de Noelle ("Zero Absoluto") em
public/assets/sprites/super/noelle/ e os sons em public/assets/audio/super/noelle/.

Uso (na raiz do projeto):  python3 scripts/super/noelle.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/super/sprites/noelle.js):
  carta.png      132x141  arte da carta: grade de gelo rachando sob um pingente gigante
  placa.png      2 quadros 28x28: placa de gelo inteira (clara/escura, tabuleiro)
  rachadura.png  28x28    trinca luminosa por cima da placa (aviso de que vai quebrar)
  buraco.png     28x28    placa já quebrada (abismo com lascas de gelo nas bordas)
  pingente.png   16x46    o pingente/estalactite gigante que cai do teto
  impacto.png    32x32    estouro de gelo (pingente atingindo o chão / lasca final)
  feixe.png      160x20   lança de gelo do estilhaçamento final (raios saindo do centro)
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'noelle')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'noelle')

VAZIO = (0, 0, 0, 0)

# paleta: azul-gelo/branco (cor da Noelle: 0xa8eaff)
CONTORNO = (8, 18, 38)
ABISMO = (5, 11, 24)
ABISMO_CLARO = (13, 26, 50)
NOITE = (12, 30, 64)
NOITE_CLARA = (20, 46, 92)
AZUL_ESCURO = (26, 72, 142)
AZUL = (68, 150, 224)
CIANO = (150, 222, 255)
GELO = (214, 246, 255)
BRANCO = (255, 255, 255)
NOELLE = (168, 234, 255)  # 0xa8eaff
SOMBRA = (32, 86, 146)
FROST = (226, 250, 255)
MAGENTA_GELO = (210, 235, 255)


# ---------- utilitários ----------


def nova(largura, altura):
    return Image.new('RGBA', (largura, altura), VAZIO)


def rgba(cor, alfa=255):
    return (cor[0], cor[1], cor[2], alfa) if len(cor) == 3 else cor


def por(img, x, y, cor, alfa=255):
    x, y = int(x), int(y)
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(cor, alfa))


def misturar(img, x, y, cor, alfa):
    """Pinta por cima com transparência (alfa 0..1)."""
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


# ---------- pingente (estalactite de gelo) ----------


def pingente_vertical(largura, altura, topo=None, quebrado=True):
    """Pingente apontando para baixo. `topo` = largura do topo (onde quebrou do teto)."""
    img = nova(largura, altura)
    cx = largura / 2
    topo = topo or largura * 0.8
    rng = random.Random(3)
    for y in range(altura):
        t = y / max(1, altura - 1)
        meia = max(0.5, (topo / 2) * (1 - t) ** 0.78)
        for dx in range(-math.ceil(meia) - 1, math.ceil(meia) + 2):
            if abs(dx) > meia:
                continue
            borda = abs(dx) > meia - 1.1
            if dx <= -meia * 0.3:
                cor = AZUL_ESCURO if not borda else NOITE_CLARA
            elif dx < 0:
                cor = AZUL
            elif dx <= 1:
                cor = BRANCO if t < 0.8 else GELO
            elif dx < meia * 0.55:
                cor = CIANO
            else:
                cor = AZUL if not borda else AZUL_ESCURO
            por(img, cx + dx, y, cor)
    # topo quebrado (irregular, arrancado do teto)
    if quebrado:
        for x in range(int(cx - topo / 2) - 1, int(cx + topo / 2) + 2):
            corte = rng.randint(0, 2)
            for y in range(corte):
                por(img, x, y, VAZIO)
    # brilho interno vertical
    for y in range(2, altura - 2, 3):
        por(img, cx, y, BRANCO, 200)
    contornar(img)
    return img


def gerar_pingente():
    return pingente_vertical(16, 46, topo=13)


# ---------- placas de gelo (tabuleiro que racha) ----------


def placa(clara):
    rng = random.Random(17 if clara else 19)
    img = nova(28, 28)
    base = (58, 130, 196) if clara else (28, 68, 118)
    luz = (120, 190, 240) if clara else (48, 96, 150)
    sombra = (38, 96, 156) if clara else (16, 40, 76)
    for y in range(28):
        for x in range(28):
            cor = base
            if x <= 1 or y <= 1:
                cor = luz
            elif x >= 26 or y >= 26:
                cor = sombra
            por(img, x, y, cor)
    # veios de gelo (linhas finas e claras, textura de superfície congelada)
    for _ in range(5 if clara else 4):
        x0, y0 = rng.randint(3, 24), rng.randint(3, 10)
        x1, y1 = x0 + rng.randint(-6, 6), y0 + rng.randint(8, 16)
        linha(img, x0, y0, x1, y1, luz, 90)
    # fagulhas de brilho
    for _ in range(3):
        por(img, rng.randint(3, 24), rng.randint(3, 24), FROST, 140)
    if clara:
        por(img, 3, 3, GELO)
        por(img, 4, 3, CIANO)
        por(img, 3, 4, CIANO)
    return img


def gerar_placas():
    folha = nova(56, 28)
    folha.alpha_composite(placa(True), (0, 0))
    folha.alpha_composite(placa(False), (28, 0))
    return folha


def gerar_rachadura():
    """Trincas luminosas crescendo a partir do centro (aviso: a placa vai quebrar)."""
    rng = random.Random(29)
    img = nova(28, 28)
    cx, cy = 14, 14
    for k in range(6):
        ang = k * (2 * math.pi / 6) + rng.uniform(-0.25, 0.25)
        x, y = float(cx), float(cy)
        for _ in range(9):
            ang += rng.uniform(-0.4, 0.4)
            nx, ny = x + math.cos(ang) * 2.1, y + math.sin(ang) * 2.1
            if not (1 <= nx < 27 and 1 <= ny < 27):
                break
            linha(img, x, y, nx, ny, CIANO, 235)
            por(img, nx, ny, BRANCO, 180)
            x, y = nx, ny
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            por(img, cx + dx, cy + dy, BRANCO if abs(dx) + abs(dy) < 2 else GELO)
    return img


def gerar_buraco():
    """Placa já quebrada: abismo escuro com lascas de gelo espetadas nas bordas."""
    rng = random.Random(31)
    a = np.zeros((28, 28, 4), np.uint8)
    raios = [rng.uniform(9.0, 12.2) for _ in range(14)]
    for y in range(28):
        for x in range(28):
            dx, dy = x - 13.5, y - 13.5
            ang = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * 14
            i = int(ang) % 14
            f = ang - int(ang)
            r = raios[i] * (1 - f) + raios[(i + 1) % 14] * f
            dist = max(abs(dx), abs(dy)) * 0.7 + math.hypot(dx, dy) * 0.3
            if dist < r - 3.2:
                prof = dist / (r - 3.2)
                a[y, x] = rgba(ABISMO if prof < 0.6 else ABISMO_CLARO if prof < 0.88 else AZUL_ESCURO)
                if prof >= 0.88 and dy < 1:
                    a[y, x] = rgba(CIANO, 160)  # brilho gélido na borda de cima do abismo
            elif dist < r - 1.2:
                a[y, x] = rgba((70, 140, 196))
            elif dist < r:
                a[y, x] = rgba(GELO if dy < 0 else SOMBRA)
    img = Image.fromarray(a)
    # lascas de gelo espetadas ao redor da borda (perigo visível)
    for k in range(6):
        ang = k * (2 * math.pi / 6) + rng.uniform(-0.2, 0.2)
        bx, by = 13.5 + math.cos(ang) * 10.5, 13.5 + math.sin(ang) * 10.5
        for s in range(4):
            px = bx - math.cos(ang) * s * 0.9
            py = by - math.sin(ang) * s * 0.9 - s * 0.6
            por(img, px, py, BRANCO if s == 0 else CIANO)
    return img


def gerar_impacto():
    """Estouro de gelo: núcleo branco com pontas de cristal saindo em todas as direções."""
    rng = random.Random(37)
    img = nova(32, 32)
    d = ImageDraw.Draw(img)
    for escala, c in [(1.0, AZUL), (0.72, CIANO), (0.4, BRANCO)]:
        pts = []
        for i in range(16):
            t = i * math.pi / 8
            r = (15 if i % 2 == 0 else rng.uniform(5, 8)) * escala
            pts.append((16 + math.cos(t) * r, 16 + math.sin(t) * r))
        d.polygon(pts, fill=rgba(c))
    contornar(img, AZUL_ESCURO)
    return img


def gerar_feixe():
    """Lança de gelo do estilhaçamento final (igual formato do corte do Kris, paleta de gelo)."""
    img = nova(160, 20)
    for x in range(160):
        t = x / 159
        meia = 8 * math.sin(math.pi * t) ** 0.8
        curva = 2 * math.sin(math.pi * t)
        for y in range(20):
            d = abs(y - 10 + curva - 1.5)
            if d > meia:
                continue
            k = d / max(0.5, meia)
            cor = BRANCO if k < 0.35 else (GELO if k < 0.6 else (CIANO if k < 0.85 else AZUL))
            alfa = 255 if k < 0.85 else 200
            por(img, x, y, cor, alfa)
    return img


# ---------- arte da carta ----------


def gerar_carta():
    """66x71 em pixels lógicos, ampliado 2x e cortado para 132x141.

    Grade de placas de gelo vista de cima/perspectiva; uma placa rachou e um
    pingente gigante acabou de atingi-la; trincas se espalham pelo chão e a
    nevasca começa a tomar o topo da tela. Sem a Noelle: só o golpe.
    """
    rng = random.Random(41)
    L, A = 66, 71
    img = nova(L, A)
    cx = 33
    impacto_x, impacto_y = 35, 50  # onde o pingente crava

    # fundo: noite gelada com brilho frio ao redor do impacto
    for y in range(A):
        for x in range(L):
            d = math.hypot(x - impacto_x, y - impacto_y)
            base = 0.16 + max(0, 0.5 - d / 60)
            cor = (int(10 + 60 * base), int(26 + 110 * base), int(50 + 170 * base))
            por(img, x, y, cor)

    # grade de placas de gelo em perspectiva (horizonte em y=hz)
    hz = 30
    for y in range(hz + 1, A):
        dy = y - hz
        z = 60 / dy
        p = dy / (A - hz)
        for x in range(L):
            wx = (x - cx) * z / 12
            clara = (math.floor(wx + 0.5) + math.floor(z)) % 2 == 0
            cor = (62, 138, 206) if clara else (24, 58, 104)
            nevoa = max(0, 1 - p * 2.2)
            cor = tuple(int(cor[i] * (1 - nevoa) + (150, 205, 245)[i] * nevoa) for i in range(3))
            por(img, x, y, cor)
    for x in range(L):
        por(img, x, hz, CIANO if abs(x - cx) < 20 else AZUL)

    # trincas radiais saindo do ponto de impacto, cortando a grade
    for k in range(9):
        ang = k * (2 * math.pi / 9) + rng.uniform(-0.12, 0.12)
        x, y = float(impacto_x), float(impacto_y)
        comp = rng.randint(14, 24)
        for _ in range(comp):
            ang += rng.uniform(-0.3, 0.3)
            nx = x + math.cos(ang) * 1.6
            ny = y + math.sin(ang) * 1.1
            if not (0 <= nx < L and hz < ny < A):
                break
            misturar(img, nx, ny, FROST, 0.85)
            misturar(img, nx + 1, ny, CIANO, 0.4)
            x, y = nx, ny

    # a placa do impacto: buraco escuro com lascas (reaproveita o gerador pequeno)
    buraco_img = gerar_buraco().resize((22, 22), Image.NEAREST)
    img.alpha_composite(buraco_img, (impacto_x - 11, impacto_y - 10))

    # o pingente gigante, ainda cravado, vindo de cima
    ping = pingente_vertical(20, 58, topo=16)
    img.alpha_composite(ping, (impacto_x - 10, impacto_y - 52))

    # estouro de gelo no ponto de impacto
    est = gerar_impacto().resize((30, 30), Image.NEAREST)
    img.alpha_composite(est, (impacto_x - 15, impacto_y - 15))

    # lascas de gelo espalhadas pelo ar
    for x, y, tam in [(14, 20, 3), (52, 16, 2), (10, 46, 2), (56, 44, 3), (44, 12, 2), (20, 8, 2)]:
        for i in range(tam):
            por(img, x + i, y - i, GELO)
            por(img, x + i + 1, y - i, CIANO)

    # névoa da nevasca tomando o topo da tela
    for y in range(0, 16):
        f = max(0, 1 - y / 16) * 0.55
        for x in range(L):
            misturar(img, x, y, FROST, f * rng.uniform(0.7, 1.0))

    # faíscas de gelo soltas
    for _ in range(14):
        x = rng.randint(2, L - 3)
        y = rng.randint(2, A - 3)
        if math.hypot(x - impacto_x, y - impacto_y) < 9:
            continue
        cor = rng.choice([BRANCO, GELO, CIANO])
        por(img, x, y, cor)

    # base um pouco mais escura embaixo (a palavra SUPER entra por cima)
    a = np.array(img).astype(np.float32)
    for y in range(A - 20, A):
        f = (y - (A - 20)) / 20 * 0.5
        a[y, :, :3] *= 1 - f
    img = Image.fromarray(a.astype(np.uint8))

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
    rng = np.random.default_rng(23)

    def tempo(seg):
        return np.arange(int(taxa * seg)) / taxa

    # tique: estalo de gelo fino (telegrafo do pingente)
    t = tempo(0.08)
    s = (np.sin(2 * np.pi * 2300 * t) + 0.5 * np.sin(2 * np.pi * 3200 * t)) * np.exp(-t * 70)
    salvar_som('tique.wav', s)

    # quebra: estilhaço de vidro/gelo (ruído brilhante + cristais agudos)
    t = tempo(0.5)
    ruido = rng.standard_normal(len(t))
    agudo = passa_baixa(ruido, 2) - passa_baixa(ruido, 10)
    cristais = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2400, 14), (3100, 16), (4200, 20), (1800, 10)]) * 0.22
    env = np.exp(-t * 11)
    salvar_som('quebra.wav', (agudo * 1.3 + cristais) * env)

    # vento: a nevasca se levanta (ruído grave modulado, crescendo)
    t = tempo(1.3)
    base = passa_baixa(rng.standard_normal(len(t)), 30) * 5
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t)
    subida = np.clip(t / 0.9, 0, 1)
    assovio = np.sin(2 * np.pi * (500 + 180 * np.sin(2 * np.pi * 0.6 * t)) * t) * 0.12
    salvar_som('vento.wav', base * lfo * subida + assovio * subida)

    # estilhaco: a explosão final de gelo (grave + cristais + ruído)
    t = tempo(0.8)
    grave = np.sin(2 * np.pi * (80 * np.exp(-t * 6) + 40) * t) * np.exp(-t * 7)
    cristais = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2000, 7), (2700, 9), (3600, 11), (1500, 6)]) * 0.28
    ruido = rng.standard_normal(len(t)) * np.exp(-t * 16) * 0.5
    salvar_som('estilhaco.wav', grave * 1.1 + cristais + ruido)


def main():
    salvar(gerar_carta(), 'carta.png')
    salvar(gerar_placas(), 'placa.png')
    salvar(gerar_rachadura(), 'rachadura.png')
    salvar(gerar_buraco(), 'buraco.png')
    salvar(gerar_pingente(), 'pingente.png')
    salvar(gerar_impacto(), 'impacto.png')
    salvar(gerar_feixe(), 'feixe.png')
    sons()


if __name__ == '__main__':
    main()
