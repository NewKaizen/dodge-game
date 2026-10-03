#!/usr/bin/env python3
"""Sprites e sons do SUPER de Susie ("Demolição Total").

Uso (na raiz do projeto):  python3 scripts/super/susie.py
Precisa de Pillow e numpy. Saída determinística (sementes fixas).

Imagens em public/assets/sprites/super/susie/:
  carta.png     132x141  arte da carta (machado cravado no chão rachado + Rude Buster)
  machado.png   60x104   machado visto de CIMA (cai na caixa)
  laje.png      28x28    lajota do chão da caixa
  racha.png     28x28    rachadura por cima da lajota (aviso)
  buraco.png    28x28    buraco onde a lajota desabou
  pedra.png     4x 12x12 entulho (spritesheet)
  buster.png    3x 40x112  meia-lua de energia do Rude Buster (spritesheet)
  impacto.png   48x48    estouro da pancada
  tijolo.png    3x 32x16 tijolos do muro da cinemática (spritesheet)
Sons em public/assets/audio/super/susie/: pancada, desaba, buster, muro (.wav)
"""

import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'susie')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'susie')

# ---------- paleta ----------
CONTORNO = (28, 10, 42)
ROXO = [(52, 18, 82), (96, 38, 150), (150, 70, 220), (200, 140, 255), (240, 220, 255)]
MAGENTA = [(140, 20, 110), (220, 50, 170), (255, 110, 220), (255, 200, 245)]
AMARELO = [(170, 110, 10), (240, 190, 40), (255, 230, 80), (255, 250, 200)]
MADEIRA = [(58, 34, 20), (96, 60, 34), (140, 92, 52), (180, 130, 80)]
ACO = [(70, 62, 96), (120, 110, 160), (175, 168, 210), (225, 222, 245)]
PEDRA = [(34, 22, 48), (62, 44, 84), (88, 66, 116), (120, 96, 150), (160, 138, 190)]


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
    for dy, dx in passos:  # sem dar a volta nas bordas
        viz |= pad[1 - dy:1 - dy + h, 1 - dx:1 - dx + w]
    borda = viz & ~op
    a[borda] = cor(c)
    return Image.fromarray(a)


def girar_pts(pts, ang, ox=0, oy=0, esc=1.0, cx=0, cy=0):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + ((x - ox) * c - (y - oy) * s) * esc, cy + ((x - ox) * s + (y - oy) * c) * esc) for x, y in pts]


def salvar(img, nome):
    os.makedirs(SAIDA, exist_ok=True)
    img.save(os.path.join(SAIDA, nome + '.png'), optimize=True)


# ---------- machado (visto de cima) ----------
# Forma base num sistema local: cabo em pé (x=0), cabeça em cima. Usada no
# machado de cima (sprite 40x96) e, girada/ampliada, na arte da carta.
def desenhar_machado(d, T, esc=1.0):
    """d: ImageDraw, T: função (x, y) -> (x, y) na imagem"""
    P = lambda pts: [T(x, y) for x, y in pts]
    # cabo
    d.polygon(P([(-3.5, 18), (3.5, 18), (3.5, 92), (-3.5, 92)]), fill=cor(MADEIRA[1]))
    d.polygon(P([(-3.5, 18), (-1, 18), (-1, 92), (-3.5, 92)]), fill=cor(MADEIRA[2]))
    for y in range(26, 90, 9):  # faixas de couro
        d.polygon(P([(-3.5, y), (3.5, y + 3), (3.5, y + 5), (-3.5, y + 2)]), fill=cor(MADEIRA[0]))
    d.polygon(P([(-5, 88), (5, 88), (5, 95), (-5, 95)]), fill=cor(ACO[1]))  # ponteira
    # lâmina grande (direita), em meia-lua
    lam = [(3, 6)]
    for i in range(13):
        t = -1.05 + 2.1 * i / 12
        lam.append((10 + math.cos(t) * 26, 16 + math.sin(t) * 22))
    lam += [(3, 30)]
    d.polygon(P(lam), fill=cor(ACO[1]))
    inner = [(6, 9)] + [(10 + math.cos(-1.05 + 2.1 * i / 12) * 20, 16 + math.sin(-1.05 + 2.1 * i / 12) * 17) for i in range(13)] + [(6, 27)]
    d.polygon(P(inner), fill=cor(ACO[2]))
    # fio da lâmina (magenta brilhante)
    fio = [(10 + math.cos(-1.0 + 2.0 * i / 12) * 26, 16 + math.sin(-1.0 + 2.0 * i / 12) * 22) for i in range(13)]
    fio2 = [(10 + math.cos(-1.0 + 2.0 * i / 12) * 22.5, 16 + math.sin(-1.0 + 2.0 * i / 12) * 19) for i in range(13)]
    d.polygon(P(fio + fio2[::-1]), fill=cor(MAGENTA[1]))
    fio3 = [(10 + math.cos(-0.7 + 1.4 * i / 8) * 24.5, 16 + math.sin(-0.7 + 1.4 * i / 8) * 20.7) for i in range(9)]
    d.line(P(fio3), fill=cor(MAGENTA[3]), width=max(1, round(esc)))
    # esporão de trás (esquerda)
    d.polygon(P([(-3, 10), (-14, 6), (-11, 16), (-14, 26), (-3, 22)]), fill=cor(ACO[0]))
    d.polygon(P([(-4, 12), (-11, 9), (-9, 16), (-4, 16)]), fill=cor(ACO[1]))
    # olho do cabo + joia amarela
    d.polygon(P([(-5, 4), (5, 4), (5, 32), (-5, 32)]), fill=cor(ROXO[1]))
    d.polygon(P([(-5, 4), (-2, 4), (-2, 32), (-5, 32)]), fill=cor(ROXO[2]))
    d.polygon(P([(0, 13), (3.5, 17), (0, 21), (-3.5, 17)]), fill=cor(AMARELO[2]))
    d.polygon(P([(0, 14), (1.5, 16), (0, 17), (-1.5, 16)]), fill=cor(AMARELO[3]))
    d.polygon(P([(-2, -2), (2, -2), (2, 4), (-2, 4)]), fill=cor(ROXO[2]))  # ponta de cima


def machado():
    img = nova(60, 104)
    d = ImageDraw.Draw(img)
    desenhar_machado(d, lambda x, y: (x + 21, y + 4))
    return contornar(img)


# ---------- chão ----------
def laje():
    rng = random.Random(11)
    img = nova(28, 28)
    a = np.zeros((28, 28, 4), np.uint8)
    for y in range(28):
        for x in range(28):
            c = PEDRA[2]
            if x <= 1 or y <= 1:
                c = PEDRA[3]
            if x >= 26 or y >= 26:
                c = PEDRA[1]
            a[y, x] = cor(c)
    # rejunte
    a[0, :] = a[:, 0] = cor(PEDRA[0])
    for _ in range(26):
        x, y = rng.randint(3, 24), rng.randint(3, 24)
        a[y, x] = cor(rng.choice([PEDRA[1], PEDRA[3]]))
    # runa de Susie: um "x" de arranhão discreto
    for i in range(5):
        a[8 + i, 18 + i] = cor(PEDRA[1])
        a[12 - i, 18 + i] = cor(PEDRA[1])
    return Image.fromarray(a)


def racha():
    rng = random.Random(23)
    img = nova(28, 28)
    a = np.array(img)
    cx, cy = 14, 14
    pontos = []
    for k in range(5):
        ang = k * 2 * math.pi / 5 + rng.uniform(-0.3, 0.3)
        x, y = float(cx), float(cy)
        for _ in range(22):
            ang += rng.uniform(-0.28, 0.28)
            x += math.cos(ang)
            y += math.sin(ang)
            if not (0 <= x < 28 and 0 <= y < 28):
                break
            pontos.append((int(x), int(y)))
    for x, y in pontos:  # brilho magenta em volta
        for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            if 0 <= x + dx < 28 and 0 <= y + dy < 28 and a[y + dy, x + dx, 3] == 0:
                a[y + dy, x + dx] = cor(MAGENTA[2], 200)
    for x, y in pontos:
        a[y, x] = cor((16, 4, 24))
    a[cy - 1:cy + 2, cx - 1:cx + 2] = cor((16, 4, 24))
    return Image.fromarray(a)


def buraco():
    rng = random.Random(37)
    a = np.zeros((28, 28, 4), np.uint8)
    raios = [rng.uniform(10.5, 13.2) for _ in range(16)]
    for y in range(28):
        for x in range(28):
            dx, dy = x - 13.5, y - 13.5
            ang = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * 16
            i = int(ang) % 16
            f = ang - int(ang)
            r = raios[i] * (1 - f) + raios[(i + 1) % 16] * f
            # quadrado arredondado (a lajota inteira desaba)
            dist = max(abs(dx), abs(dy)) * 0.75 + math.hypot(dx, dy) * 0.25
            if dist < r - 3.5:
                prof = dist / (r - 3.5)
                a[y, x] = cor((8, 2, 14)) if prof < 0.55 else cor((22, 6, 36)) if prof < 0.85 else cor(ROXO[1])
                if prof >= 0.85 and dy < 0:
                    a[y, x] = cor(ROXO[2])  # brilho roxo do abismo na borda de cima
            elif dist < r - 1.5:
                a[y, x] = cor(PEDRA[1])
            elif dist < r:
                a[y, x] = cor(PEDRA[3] if dy < 0 else PEDRA[0])
    # brasas roxas lá no fundo
    for _ in range(5):
        x, y = rng.randint(9, 18), rng.randint(9, 18)
        a[y, x] = cor(MAGENTA[1])
    return Image.fromarray(a)


def pedras():
    rng = random.Random(41)
    folha = nova(48, 12)
    for k in range(4):
        img = nova(12, 12)
        d = ImageDraw.Draw(img)
        n = rng.randint(5, 7)
        pts = []
        for i in range(n):
            t = i * 2 * math.pi / n + rng.uniform(-0.3, 0.3)
            r = rng.uniform(3.2, 4.8)
            pts.append((5.5 + math.cos(t) * r, 5.5 + math.sin(t) * r))
        d.polygon(pts, fill=cor(PEDRA[2]))
        d.polygon([(p[0] * 0.6 + 1.6, p[1] * 0.6 + 1.2) for p in pts[: n // 2 + 1]], fill=cor(PEDRA[4]))
        img = contornar(img)
        if k % 2:
            img.putpixel((6, 7), cor(MAGENTA[2]))
        folha.paste(img, (k * 12, 0))
    return folha


# ---------- Rude Buster: meia-lua de energia (vai para a DIREITA) ----------
def buster():
    rng = random.Random(53)
    folha = nova(120, 112)
    for q in range(3):
        a = np.zeros((112, 40, 4), np.uint8)
        for y in range(112):
            u = (y - 55.5) / 56
            base = max(0.0, 1 - u * u)
            frente = 6 + 30 * base ** 0.8
            esp = 2 + 16 * base ** 0.9
            for x in range(40):
                t = (frente - x) / max(esp, 0.5)  # 0 = frente, 1 = trás
                if t < -0.08 or t > 1.0:
                    continue
                if t < 0.12:
                    c = (255, 255, 255)
                elif t < 0.3:
                    c = MAGENTA[3]
                elif t < 0.55:
                    c = MAGENTA[2]
                elif t < 0.8:
                    c = ROXO[3] if (x + y + q) % 2 else MAGENTA[1]
                else:
                    c = ROXO[2]
                alfa = 255 if t < 0.8 else 200
                a[y, x] = cor(c, alfa)
        # rastros (linhas de velocidade atrás da meia-lua), mudam por quadro
        for _ in range(9):
            y = rng.randint(14, 97)
            u = (y - 55.5) / 56
            base = max(0.0, 1 - u * u)
            atras = int(6 + 30 * base ** 0.8 - 2 - 16 * base ** 0.9)
            comp = rng.randint(4, 12)
            for x in range(max(0, atras - comp), max(0, atras)):
                if a[y, x, 3] == 0:
                    a[y, x] = cor(ROXO[3] if rng.random() < 0.6 else MAGENTA[2], 220)
        # faíscas amarelas na frente
        for _ in range(4):
            y = rng.randint(20, 91)
            u = (y - 55.5) / 56
            x = int(6 + 30 * max(0, 1 - u * u) ** 0.8) + 1
            if 0 <= x < 40:
                a[y, x] = cor(AMARELO[2])
        folha.paste(Image.fromarray(a), (q * 40, 0))
    return folha


def impacto():
    rng = random.Random(61)
    img = nova(48, 48)
    d = ImageDraw.Draw(img)
    for camada, (escala, c) in enumerate([(1.0, MAGENTA[1]), (0.72, AMARELO[2]), (0.42, (255, 255, 255))]):
        pts = []
        for i in range(20):
            t = i * math.pi / 10 + (camada * 0.15)
            r = (23 if i % 2 == 0 else rng.uniform(9, 13)) * escala
            pts.append((23.5 + math.cos(t) * r, 23.5 + math.sin(t) * r))
        d.polygon(pts, fill=cor(c))
    return contornar(img, MAGENTA[0])


def tijolos():
    rng = random.Random(71)
    folha = nova(96, 16)
    tons = [ROXO[1], (120, 46, 140), (84, 34, 120)]
    for k in range(3):
        a = np.zeros((16, 32, 4), np.uint8)
        a[:, :] = cor(tons[k])
        a[1:3, 1:31] = cor(misturar(tons[k], (255, 255, 255), 0.25))
        a[13:15, 1:31] = cor(misturar(tons[k], (0, 0, 0), 0.3))
        for _ in range(12):
            a[rng.randint(3, 12), rng.randint(2, 29)] = cor(misturar(tons[k], (0, 0, 0), 0.25))
        a[0, :] = a[15, :] = a[:, 0] = a[:, 31] = cor((30, 12, 40))
        folha.paste(Image.fromarray(a), (k * 32, 0))
    return folha


def misturar(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ---------- arte da carta (132x141) ----------
def carta():
    rng = random.Random(89)
    W, H = 132, 141
    a = np.zeros((H, W, 4), np.uint8)
    ix, iy = 70, 84  # ponto do impacto
    # fundo: raios roxos/magenta saindo do impacto
    for y in range(H):
        for x in range(W):
            ang = math.atan2(y - iy, x - ix)
            dist = math.hypot(x - ix, y - iy)
            raio = int((ang + math.pi) / (2 * math.pi) * 18) % 2
            c = (34, 12, 56) if raio else (58, 18, 92)
            if dist < 46:
                c = misturar(c, MAGENTA[1], 0.35 * (1 - dist / 46))
            a[y, x] = cor(c)
    img = Image.fromarray(a)
    d = ImageDraw.Draw(img)
    # meia-lua do Rude Buster passando atrás (grande, de cima para baixo)
    arco = nova(W, H)
    da = ImageDraw.Draw(arco)
    for r0, r1, c in [(96, 112, ROXO[2]), (99, 109, MAGENTA[2]), (102, 106, MAGENTA[3]), (104, 105, (255, 255, 255))]:
        for rr in range(r0, r1):
            da.arc([-30 - rr, -40 - rr, -30 + rr, -40 + rr], 5, 85, fill=cor(c), width=1)
    img.alpha_composite(arco)
    # chão rachado (perspectiva): faixa de lajotas embaixo
    for y in range(94, H):
        for x in range(W):
            base = PEDRA[1] if ((x // 22 + (y - 94) // 10) % 2) else PEDRA[2]
            if (y - 94) % 10 == 0 or x % 22 == 0:
                base = PEDRA[0]
            img.putpixel((x, y), cor(misturar(base, (10, 4, 16), min(1, (y - 94) / 60))))
    # rachaduras saindo do impacto
    for k in range(7):
        ang = math.pi * (0.05 + 0.9 * k / 6) + rng.uniform(-0.1, 0.1)
        x, y = float(ix), float(iy + 10)
        for _ in range(40):
            ang += rng.uniform(-0.35, 0.35)
            x += math.cos(ang) * 1.4
            y += abs(math.sin(ang)) * 0.6 + 0.15
            if not (0 <= x < W and 94 <= y < H):
                break
            img.putpixel((int(x), int(y)), cor(MAGENTA[2]))
            if int(y) + 1 < H:
                img.putpixel((int(x), int(y) + 1), cor((12, 4, 20)))
    # machado gigante cravado: cabeça no impacto, cabo subindo para a direita (espelhado)
    mach = nova(W, H)
    dm = ImageDraw.Draw(mach)
    ang = -2.2
    esc = 1.5
    T = lambda x, y: girar_pts([(-x, y)], ang, 0, 17, esc, ix - 10, iy - 8)[0]
    desenhar_machado(dm, T, esc)
    mach = contornar(contornar(mach), (0, 0, 0))
    img.alpha_composite(mach)
    # estouro amarelo no fio da lâmina
    fx, fy = T(34, 17)
    est = impacto().resize((44, 44), Image.NEAREST)
    img.alpha_composite(est, (int(fx) - 22, int(fy) - 22))
    # entulho voando
    folha = pedras()
    for k, (x, y) in enumerate([(14, 70), (108, 58), (24, 44), (116, 88), (96, 30)]):
        p = folha.crop((k % 4 * 12, 0, k % 4 * 12 + 12, 12))
        if k < 2:
            p = p.resize((18, 18), Image.NEAREST)
        img.alpha_composite(p, (x - 6, y - 6))
    # faíscas amarelas (olhos ferozes da pancada)
    for _ in range(18):
        x, y = rng.randint(4, 127), rng.randint(4, 110)
        c = rng.choice([AMARELO[2], AMARELO[3], MAGENTA[3]])
        img.putpixel((x, y), cor(c))
        if rng.random() < 0.4:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                img.putpixel((x + dx, y + dy), cor(c, 160))
    # base mais escura (a palavra SUPER fica por cima)
    a = np.array(img).astype(np.float32)
    for y in range(H - 24, H):
        f = (y - (H - 24)) / 24 * 0.55
        a[y, :, :3] *= 1 - f
    return Image.fromarray(a.astype(np.uint8))


# ---------- sons ----------
TAXA = 22050


def salvar_som(nome, s):
    os.makedirs(SAIDA_SOM, exist_ok=True)
    s = s / (np.max(np.abs(s)) + 1e-9) * 0.7  # pico ~ -3 dBFS
    dados = (s * 32767).astype(np.int16)
    with wave.open(os.path.join(SAIDA_SOM, nome + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(dados.tobytes())


def passa_baixa(s, k):
    janela = np.ones(k) / k
    return np.convolve(s, janela, mode='same')


def sons():
    rng = np.random.default_rng(7)
    # pancada: grave caindo + estalo de ruído
    t = np.arange(int(TAXA * 0.7)) / TAXA
    f = 110 * np.exp(-t * 5) + 38
    grave = np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.exp(-t * 5)
    estalo = passa_baixa(rng.standard_normal(len(t)), 6) * np.exp(-t * 28)
    salvar_som('pancada', grave * 1.0 + estalo * 0.8)
    # desaba: pedregulho rolando (ruído grave com estalinhos)
    t = np.arange(int(TAXA * 0.8)) / TAXA
    ronco = passa_baixa(rng.standard_normal(len(t)), 40) * 6 * np.exp(-t * 3.5)
    cliques = np.zeros(len(t))
    for _ in range(22):
        i = rng.integers(0, len(t) - 300)
        cliques[i:i + 300] += rng.standard_normal(300) * np.exp(-np.arange(300) / 40) * rng.uniform(0.2, 0.6)
    salvar_som('desaba', ronco + cliques * np.exp(-t * 2))
    # buster: zap subindo + vento
    t = np.arange(int(TAXA * 0.55)) / TAXA
    f = 180 + 900 * (t / t[-1]) ** 1.5
    fase = 2 * np.pi * np.cumsum(f) / TAXA
    serra = 2 * ((fase / (2 * np.pi)) % 1) - 1
    env = np.minimum(1, t * 30) * np.exp(-t * 3)
    vento = passa_baixa(rng.standard_normal(len(t)), 3) * 0.35
    salvar_som('buster', (serra * 0.6 + np.sin(fase * 0.5) * 0.5 + vento) * env)
    # muro: estrondo do muro quebrando (cinemática)
    t = np.arange(int(TAXA * 1.1)) / TAXA
    boom = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 3) + 30) / TAXA) * np.exp(-t * 3)
    quebra = passa_baixa(rng.standard_normal(len(t)), 3) * np.exp(-t * 6)
    salvar_som('muro', boom + quebra * 0.9)


def main():
    salvar(carta(), 'carta')
    salvar(machado(), 'machado')
    salvar(laje(), 'laje')
    salvar(racha(), 'racha')
    salvar(buraco(), 'buraco')
    salvar(pedras(), 'pedra')
    salvar(buster(), 'buster')
    salvar(impacto(), 'impacto')
    salvar(tijolos(), 'tijolo')
    sons()


if __name__ == '__main__':
    main()
