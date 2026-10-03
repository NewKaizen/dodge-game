#!/usr/bin/env python3
"""Sprites e sons do SUPER do Asriel ("Singularidade Radiante"), em pixel art.

Uso (na raiz do projeto):  python3 scripts/super/asriel.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites em public/assets/sprites/super/asriel/:
  estrelas.png   spritesheet 6 quadros 16x16: estrela de 5 pontas em cada cor do arco-íris
                 (a chuva que cai para dentro do vazio e os raios da supernova)
  no.png         spritesheet 4 quadros 16x16: glint branco piscando (pinta-se da cor do raio
                 no jogo) -- marca os pontos da constelação que disparam a supernova
  buraco.png     spritesheet 6 quadros 64x64: buraco negro com o disco arco-íris girando
                 (cresce em volta do coração ao longo do 1º ato)
  nova.png       64x64: o clarão da supernova (núcleo branco com raios coloridos)
  carta.png      132x141: arte da carta (galáxia, constelação e a supernova)

Sons em public/assets/audio/super/asriel/:
  pulso.wav      o vazio pulsa e cresce (grave abafado, como um coração colapsando)
  colapso.wav    o vazio implode num ponto só (sucção que termina num estalo seco)
  estoura.wav    um raio da supernova dispara (zap cristalino, cintilante)
"""
import math, os, random, wave
import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'super', 'asriel')
SAIDA_SOM = os.path.join(RAIZ, 'public', 'assets', 'audio', 'super', 'asriel')
os.makedirs(SAIDA, exist_ok=True)

ARCO = [(255, 74, 90), (255, 162, 58), (255, 225, 74), (90, 224, 106), (74, 184, 255), (166, 107, 255)]
CONTORNO = (24, 10, 40, 255)


def clareia(c, k):
    return tuple(min(255, int(v + (255 - v) * k)) for v in c[:3])


def escurece(c, k):
    return tuple(int(v * (1 - k)) for v in c[:3])


def dentro_estrela(x, y, cx, cy, r, interno=0.45, pontas=5, rot=-math.pi / 2):
    """Ponto (x, y) dentro da estrela de `pontas` pontas (polígono côncavo)."""
    pts = []
    for i in range(pontas * 2):
        rr = r if i % 2 == 0 else r * interno
        a = rot + i * math.pi / pontas
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    dentro = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            dentro = not dentro
        j = i
    return dentro


def contornar(img):
    """Contorno escuro de 1 px em volta dos pixels opacos."""
    w, h = img.size
    px = img.load()
    novos = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 200:
                        novos.append((x, y))
                        break
    for x, y in novos:
        px[x, y] = CONTORNO


def estrela(cor, n=16):
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    px = img.load()
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            if dentro_estrela(x + 0.5, y + 0.5, c + 0.5, c + 1.0, n * 0.46):
                # luz de cima-esquerda
                d = ((x - c + 3) ** 2 + (y - c + 3) ** 2) ** 0.5 / n
                if d < 0.28:
                    px[x, y] = (*clareia(cor, 0.75), 255)
                elif d < 0.55:
                    px[x, y] = (*cor, 255)
                else:
                    px[x, y] = (*escurece(cor, 0.25), 255)
    contornar(img)
    px[int(c) - 1, int(c) - 1] = (255, 255, 255, 255)  # brilho
    return img


def folha_estrelas():
    folha = Image.new('RGBA', (16 * len(ARCO), 16), (0, 0, 0, 0))
    for i, cor in enumerate(ARCO):
        folha.paste(estrela(cor), (i * 16, 0))
    folha.save(os.path.join(SAIDA, 'estrelas.png'))


def folha_nos():
    """Glint de 4 pontas (nó da constelação): núcleo branco sólido + raios finos
    + halo suave. Pintável (setTint) com a cor do raio da supernova no jogo."""
    n = 16
    c = (n - 1) / 2
    folha = Image.new('RGBA', (n * 4, n), (0, 0, 0, 0))
    for q, tam in enumerate([7.5, 6, 7.5, 5]):  # pulsa: grande, médio, grande, pequeno
        img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        px = img.load()
        for y in range(n):
            for x in range(n):
                dx, dy = x - c, y - c
                ortogonal = (abs(dy) < 0.8 and abs(dx) <= tam) or (abs(dx) < 0.8 and abs(dy) <= tam)
                diagonal = abs(abs(dx) - abs(dy)) < 0.8 and max(abs(dx), abs(dy)) <= tam * 0.55
                nucleo = math.hypot(dx, dy) <= 1.6
                if nucleo:
                    px[x, y] = (255, 255, 255, 255)
                elif ortogonal:
                    d = math.hypot(dx, dy) / tam
                    a = int(255 * max(0, 1 - d) ** 0.6)
                    px[x, y] = (255, 255, 255, a) if a > 40 else (200, 220, 255, a)
                elif diagonal:
                    d = max(abs(dx), abs(dy)) / (tam * 0.55)
                    px[x, y] = (210, 225, 255, int(150 * max(0, 1 - d)))
        folha.paste(img, (q * n, 0))
    folha.save(os.path.join(SAIDA, 'no.png'))


def folha_buraco():
    n = 64
    quadros = 6
    folha = Image.new('RGBA', (n * quadros, n), (0, 0, 0, 0))
    for q in range(quadros):
        img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        px = img.load()
        c = (n - 1) / 2
        giro = q / quadros * (2 * math.pi / len(ARCO))
        for y in range(n):
            for x in range(n):
                dx, dy = x - c, (y - c) * 3.2  # disco bem inclinado: uma faixa fina cruzando o buraco
                r = math.hypot(dx, dy)
                rr = math.hypot(x - c, y - c)
                ang = math.atan2(dy, dx) + giro
                if rr <= 9:  # o buraco em si
                    px[x, y] = (6, 0, 14, 255)
                elif rr <= 11:  # anel de fótons
                    px[x, y] = (255, 250, 230, 255)
                elif 14 <= rr <= 16:  # halo (a luz do disco de trás, curvada por cima e por baixo)
                    cor = ARCO[int(((math.atan2(y - c, x - c) + giro * 3) % (2 * math.pi)) / (2 * math.pi) * 6) % 6]
                    px[x, y] = (*clareia(cor, 0.4), 200)
                elif 15 <= r <= 31:
                    # disco de acreção: faixas do arco-íris girando, mais forte perto do centro
                    faixa = int(((ang % (2 * math.pi)) / (2 * math.pi)) * len(ARCO) * 2) % len(ARCO)
                    cor = ARCO[faixa]
                    k = 1 - (r - 15) / 16
                    if (x + y + q) % 7 == 0 and k > 0.3:
                        cor = clareia(cor, 0.6)
                    alfa = int(90 + 165 * k)
                    # parte de trás do disco (em cima) fica atrás do buraco: mais escura
                    if y < c and rr < 13:
                        continue
                    px[x, y] = (*cor, alfa)
        folha.paste(img, (q * n, 0))
    folha.save(os.path.join(SAIDA, 'buraco.png'))


def nova():
    n = 64
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    px = img.load()
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            raio = 10 + 18 * max(0, math.cos(ang * 6)) ** 6 + 6 * max(0, math.cos(ang * 6 + math.pi)) ** 8
            if r <= 8:
                px[x, y] = (255, 255, 255, 255)
            elif r <= 12:
                px[x, y] = (255, 246, 200, 255)
            elif r <= raio:
                cor = ARCO[int(((ang + math.pi) / (2 * math.pi)) * 12) % 6]
                px[x, y] = (*clareia(cor, 0.35), int(255 * (1 - (r - 12) / 24)))
    img.save(os.path.join(SAIDA, 'nova.png'))


def carta():
    W, H = 132, 141
    rnd = random.Random(7)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    px = img.load()
    cx, cy = W / 2, 60
    # céu: degradê violeta -> azul-noite com névoa colorida
    for y in range(H):
        for x in range(W):
            t = y / H
            base = (int(22 + 30 * (1 - t)), int(8 + 6 * t), int(48 + 30 * t))
            neb = math.sin(x * 0.07 + y * 0.03) * math.cos(y * 0.05 - x * 0.02)
            base = clareia(base, max(0, neb) * 0.08)
            px[x, y] = (*base, 255)
    # galáxia espiral arco-íris (dois braços)
    for braco in range(2):
        for i in range(1800):
            s = i / 1800
            a = braco * math.pi + s * 4.4 * math.pi
            r = 6 + s * 62
            x = cx + math.cos(a) * r + rnd.uniform(-3, 3) * s * 2
            y = cy + math.sin(a) * r * 0.62 + rnd.uniform(-3, 3) * s * 2
            if 0 <= x < W and 0 <= y < H - 18:
                cor = ARCO[int(s * 6 * 2 + braco * 3) % 6]
                x, y = int(x), int(y)
                atual = px[x, y]
                px[x, y] = (*[min(255, int(atual[k] * 0.35 + cor[k] * 0.75)) for k in range(3)], 255)
    # estrelas de fundo
    for _ in range(70):
        x, y = rnd.randrange(W), rnd.randrange(H - 18)
        v = rnd.choice([150, 200, 255])
        px[x, y] = (v, v, v, 255)
    # constelação: pontos ligados por linhas finas brancas (uma coroa de 5 pontas em volta)
    nos = []
    for i in range(5):
        a = -math.pi / 2 + i * 2 * math.pi / 5
        nos.append((cx + math.cos(a) * 48, cy + math.sin(a) * 40))
    ordem = [0, 2, 4, 1, 3, 0]
    for a, b in zip(ordem, ordem[1:]):
        (x1, y1), (x2, y2) = nos[a], nos[b]
        passos = int(max(abs(x2 - x1), abs(y2 - y1)))
        for k in range(0, passos, 2):
            x = int(x1 + (x2 - x1) * k / passos)
            y = int(y1 + (y2 - y1) * k / passos)
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = (220, 230, 255, 255)
    est = Image.open(os.path.join(SAIDA, 'estrelas.png'))
    for i, (x, y) in enumerate(nos):
        q = est.crop((i % 6 * 16, 0, i % 6 * 16 + 16, 16))
        img.alpha_composite(q, (int(x) - 8, int(y) - 8))
    # supernova no centro
    nv = Image.open(os.path.join(SAIDA, 'nova.png'))
    img.alpha_composite(nv, (int(cx) - 32, int(cy) - 32))
    # buraco negro pequeno no coração da explosão
    bur = Image.open(os.path.join(SAIDA, 'buraco.png')).crop((0, 0, 64, 64)).resize((40, 40), Image.NEAREST)
    img.alpha_composite(bur, (int(cx) - 20, int(cy) - 20))
    img.save(os.path.join(SAIDA, 'carta.png'))


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
    rng = np.random.default_rng(23)

    # pulso: o vazio cresce -- baque grave e abafado, como uma batida de coração estranha
    t = np.arange(int(TAXA * 0.55)) / TAXA
    f = 55 * np.exp(-t * 7) + 32
    grave = np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.exp(-t * 6.5)
    sopro = passa_baixa(rng.standard_normal(len(t)), 30) * np.exp(-t * 10) * 0.5
    salvar_som('pulso', grave * 1.1 + sopro)

    # colapso: sucção que sobe de tom (sendo puxada para dentro) e termina num estalo seco
    t = np.arange(int(TAXA * 0.75)) / TAXA
    suga = passa_baixa(rng.standard_normal(len(t)), 24) * np.exp(t * 1.5) * np.clip(1 - t / 0.6, 0, 1)
    f = 180 + 500 * np.clip(t / 0.55, 0, 1) ** 2
    zumbido = np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.clip(t / 0.3, 0, 1) * 0.35
    estalo = np.zeros(len(t))
    i0 = int(TAXA * 0.55)
    janela = min(900, len(t) - i0)
    if janela > 0:
        estalo[i0:i0 + janela] = rng.standard_normal(janela) * np.exp(-np.arange(janela) / 40)
    salvar_som('colapso', suga * 0.8 + zumbido + estalo * 1.3)

    # estoura: zap cristalino e cintilante (um raio da supernova disparando)
    t = np.arange(int(TAXA * 0.4)) / TAXA
    f = 2400 * np.exp(-t * 3) + 500
    zap = np.sin(2 * np.pi * np.cumsum(f) / TAXA) * np.exp(-t * 9)
    brilho = sum(np.sin(2 * np.pi * h * 1400 * t) for h in (1, 1.5, 2.3)) / 3 * np.exp(-t * 14) * 0.4
    salvar_som('estoura', zap * 0.9 + brilho)


def main():
    folha_estrelas()
    folha_nos()
    folha_buraco()
    nova()
    carta()
    sons()
    print('ok:', sorted(os.listdir(SAIDA)), sorted(os.listdir(SAIDA_SOM)))


if __name__ == '__main__':
    main()
