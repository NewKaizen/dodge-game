#!/usr/bin/env python3
"""Gera os sprites do SUPER de Noelle (SNOWGRAVE) em
public/assets/sprites/super/noelle/ e os sons em public/assets/audio/super/noelle/.

Uso (na raiz do projeto):  python3 scripts/super/noelle.py
Precisa do Pillow e do numpy. Saída determinística (sementes fixas).

Sprites (chaves em src/game/pvp/super/sprites/noelle.js):
  carta.png      132x141  arte da carta: o pilar de nevasca girando sobre o chão congelado, com o floco gigante no alto
  pilar.png      24x120   pilar de gelo (ponta para cima): brota do chão/teto/paredes no ato III
  flocao.png     34x34    floco de neve gigante (atravessa a caixa e estoura em estilhaços)
  estilhaco.png  18x8     estilhaço de gelo deitado (ponta para a direita): rajadas, estouros e o túmulo final
  pingente.png   16x46    pingente de gelo (cinemática e efeito no chefe do CO-OP)
  impacto.png    32x32    estouro de gelo (efeito no chefe do CO-OP)

Sons (super-noelle-<nome>):
  tique, quebra, vento, estilhaco   estalo fino, vidro quebrando, vento, explosão de gelo
  nevasca      uivo longo da nevasca (ato II)
  redemoinho   o vento começa a girar (ato III)
  pilar        pilar de gelo brotando (estalo + baque + cristal subindo)
  cristal      floco gigante estourando
  implosao     o frio sendo sugado para um ponto (antes do golpe final)
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
NOITE = (12, 30, 64)
NOITE_CLARA = (20, 46, 92)
AZUL_ESCURO = (26, 72, 142)
AZUL = (68, 150, 224)
CIANO = (150, 222, 255)
GELO = (214, 246, 255)
BRANCO = (255, 255, 255)
FROST = (226, 250, 255)


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




# ---------- pilar de gelo ----------


def gerar_pilar():
    """Coluna de cristal com a ponta para cima (o jogo gira/inverte para os outros lados).

    Faces: esquerda escura, miolo branco com veios, direita ciano; a ponta tem
    duas lascas menores saindo dos lados (cristal lascado, não um retângulo).
    """
    L, A = 24, 120
    img = nova(L, A)
    cx = L / 2 - 0.5
    rng = random.Random(53)
    ponta = 30  # altura da ponta
    for y in range(A):
        if y < ponta:
            meia = 1 + (L / 2 - 2) * (y / ponta) ** 0.9
        else:
            meia = L / 2 - 2 + (1 if (y // 9) % 2 == 0 else 0)  # facetas irregulares nas bordas
        for x in range(L):
            dx = x - cx
            if abs(dx) > meia:
                continue
            k = dx / max(1, meia)
            if k < -0.55:
                cor = AZUL_ESCURO
            elif k < -0.1:
                cor = AZUL
            elif k < 0.25:
                cor = BRANCO if y < ponta + 4 or (y // 3) % 4 else GELO
            elif k < 0.7:
                cor = CIANO
            else:
                cor = AZUL
            por(img, x, y, cor)
    # lascas laterais perto da ponta
    for lado in (-1, 1):
        base_y = ponta + 6 + (4 if lado > 0 else 0)
        for i in range(8):
            x = cx + lado * (L / 2 - 2 + i * 0.5)
            y = base_y - i * 1.6
            por(img, x, y, GELO if lado > 0 else CIANO)
            por(img, x, y + 1, AZUL if lado > 0 else AZUL_ESCURO)
    # veios diagonais (trincas internas)
    for _ in range(7):
        y0 = rng.randint(ponta, A - 12)
        x0 = rng.randint(4, L - 6)
        linha(img, x0, y0, x0 + rng.choice([-3, 3]), y0 + rng.randint(5, 10), FROST, 170)
    # brilho vertical no miolo
    for y in range(4, A, 2):
        por(img, cx + 1, y, BRANCO, 230)
    contornar(img)
    return img


# ---------- floco gigante ----------


def gerar_flocao():
    """Floco de neve de 6 braços com galhos (contorno escuro, miolo hexagonal)."""
    img = nova(34, 34)
    cx = cy = 16.5
    for b in range(6):
        ang = b * math.pi / 3 - math.pi / 2
        ux, uy = math.cos(ang), math.sin(ang)
        # braço grosso (2 px)
        for s in np.arange(0, 14.5, 0.5):
            x, y = cx + ux * s, cy + uy * s
            por(img, x, y, BRANCO)
            por(img, x - uy * 0.8, y + ux * 0.8, GELO)
        # dois pares de galhos
        for base, comp in [(6, 5), (10, 3.5)]:
            bx, by = cx + ux * base, cy + uy * base
            for lado in (-1, 1):
                ga = ang + lado * 0.85
                for s in np.arange(0, comp, 0.5):
                    por(img, bx + math.cos(ga) * s, by + math.sin(ga) * s, CIANO if s > comp * 0.6 else GELO)
        # ponta em losango
        px, py = cx + ux * 15, cy + uy * 15
        por(img, px, py, BRANCO)
    # miolo hexagonal
    for y in range(34):
        for x in range(34):
            if math.hypot(x - cx, y - cy) < 3.2:
                por(img, x, y, CIANO if math.hypot(x - cx, y - cy) > 1.8 else BRANCO)
    contornar(img, (10, 34, 74))
    return img


# ---------- estilhaço ----------


def gerar_estilhaco():
    """Lasca de gelo deitada, ponta para a direita (o jogo gira para a direção do voo)."""
    img = nova(18, 8)
    for x in range(18):
        t = x / 17
        meia = 3.4 * (1 - t) ** 1.1 if t > 0.3 else 2.0 + 1.4 * (t / 0.3) - (0.8 if x % 3 == 0 else 0)  # traseira lascada
        for y in range(8):
            d = y - 3.5
            if abs(d) > meia:
                continue
            cor = BRANCO if abs(d) < meia * 0.35 else (CIANO if d < 0 else AZUL)
            por(img, x, y, cor)
    contornar(img, (10, 34, 74))
    return img


# ---------- arte da carta ----------


def gerar_carta():
    """66x71 em pixels lógicos, ampliado 2x e cortado para 132x141.

    O SNOWGRAVE visto de longe: um pilar de nevasca (luz branca no miolo e
    faixas de neve girando em volta) sobe do chão congelado até o céu; no alto,
    o floco gigante; na base, cristais de gelo brotando e trincas no chão.
    """
    rng = random.Random(61)
    L, A = 66, 71
    img = nova(L, A)
    cx = 33
    hz = 48  # horizonte

    # céu: noite gelada, mais claro perto do pilar
    for y in range(A):
        for x in range(L):
            d = abs(x - cx) / 33
            base = 0.12 + 0.35 * max(0, 1 - d * 1.6) + 0.08 * (y / A)
            cor = (int(8 + 70 * base), int(22 + 120 * base), int(48 + 180 * base))
            por(img, x, y, cor)

    # chão congelado em perspectiva (placas de gelo)
    for y in range(hz + 1, A):
        dy = y - hz
        z = 48 / dy
        for x in range(L):
            wx = (x - cx) * z / 10
            clara = (math.floor(wx + 0.5) + math.floor(z * 1.5)) % 2 == 0
            cor = (70, 146, 210) if clara else (30, 70, 124)
            brilho = max(0, 1 - abs(x - cx) / 26) * max(0, 1 - dy / 18)
            cor = tuple(min(255, int(cor[i] + (220 - cor[i]) * brilho)) for i in range(3))
            por(img, x, y, cor)
    for x in range(L):
        por(img, x, hz, GELO if abs(x - cx) < 14 else CIANO)

    # o pilar: miolo de luz (largura cresce um pouco para cima)
    for y in range(4, hz + 4):
        meia = 4.5 + (hz - y) * 0.06
        for x in range(L):
            d = abs(x - cx) / meia
            if d < 1:
                misturar(img, x, y, BRANCO if d < 0.45 else FROST, 0.95 if d < 0.45 else 0.7)
            elif d < 2.2:
                misturar(img, x, y, CIANO, 0.45 * (2.2 - d) / 1.2)

    # faixas de neve girando em volta do pilar: traços contínuos (as da frente
    # claras e por cima, as de trás escuras e por baixo)
    for frente_vez in (False, True):
        for faixa in range(3):
            fase = faixa * (2 * math.pi / 3)
            ant = None
            for y in np.arange(hz + 1, 22, -0.25):
                meia = 8 + (hz - y) * 0.22
                ang = y * 0.21 + fase
                x = cx + math.sin(ang) * meia
                frente = math.cos(ang) > 0
                if frente == frente_vez and ant and ant[2] == frente:
                    linha(img, ant[0], ant[1], x, y, BRANCO if frente else (70, 128, 196))
                    if frente:
                        por(img, x, y + 1, GELO, 200)
                ant = (x, y, frente)

    # cristais de gelo brotando na base, em leque
    for i, (dx, alt, larg) in enumerate([(-15, 10, 3), (-9, 16, 4), (-4, 12, 3), (5, 13, 3), (10, 17, 4), (16, 9, 3)]):
        bx = cx + dx
        for k in range(alt):
            meia = larg * (1 - k / alt)
            for x in range(int(bx - meia), int(bx + meia) + 1):
                cor = GELO if x >= bx else AZUL
                if abs(x - bx) < 0.8:
                    cor = BRANCO
                por(img, x, hz + 6 - k, cor)

    # trincas no chão saindo da base
    for k in range(8):
        ang = math.pi * (0.05 + 0.9 * k / 7)
        x, y = float(cx), float(hz + 5)
        for _ in range(rng.randint(8, 16)):
            ang += rng.uniform(-0.25, 0.25)
            nx, ny = x + math.cos(ang) * 1.8, y + abs(math.sin(ang)) * 1.0
            if not (0 <= nx < L and hz < ny < A):
                break
            misturar(img, nx, ny, FROST, 0.8)
            x, y = nx, ny

    # o floco gigante no alto do pilar
    for y in range(0, 34):
        for x in range(cx - 18, cx + 18):
            d = math.hypot(x - cx, y - 17)
            if d < 17:
                misturar(img, x, y, (150, 222, 255), 0.35 * (1 - d / 17))
    floco = gerar_flocao().resize((30, 30), Image.NEAREST)
    img.alpha_composite(floco, (cx - 15, 2))

    # flocos e faíscas voando em volta (puxados pelo redemoinho)
    for _ in range(26):
        ang = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(14, 30)
        x = cx + math.cos(ang) * r
        y = rng.uniform(4, hz)
        cor = rng.choice([BRANCO, GELO, CIANO])
        por(img, x, y, cor)
        if rng.random() < 0.35:
            por(img, x + 1, y, cor, 160)
            por(img, x, y + 1, cor, 160)

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

    def varrer(f0, f1, t):
        """Seno com a frequência indo de f0 a f1 (fase integrada, sem estalos)."""
        f = f0 + (f1 - f0) * (t / t[-1])
        return np.sin(2 * np.pi * np.cumsum(f) / taxa)

    # tique: estalo de gelo fino
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

    # estilhaco: a explosão de gelo (grave + cristais + ruído)
    t = tempo(0.8)
    grave = np.sin(2 * np.pi * (80 * np.exp(-t * 6) + 40) * t) * np.exp(-t * 7)
    cristais = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(2000, 7), (2700, 9), (3600, 11), (1500, 6)]) * 0.28
    ruido = rng.standard_normal(len(t)) * np.exp(-t * 16) * 0.5
    salvar_som('estilhaco.wav', grave * 1.1 + cristais + ruido)

    # nevasca: uivo longo (ruído grave com rajadas) e dois assovios que sobem e descem
    t = tempo(2.4)
    base = passa_baixa(rng.standard_normal(len(t)), 24) * 5
    rajadas = 0.45 + 0.55 * np.abs(np.sin(2 * np.pi * 0.7 * t + np.sin(2 * np.pi * 0.23 * t) * 2))
    uivo = varrer(420, 620, t) * 0.10 + np.sin(2 * np.pi * (700 + 160 * np.sin(2 * np.pi * 0.45 * t)) * t) * 0.06
    env = np.clip(t / 0.5, 0, 1) * np.clip((2.4 - t) / 0.6, 0, 1)
    salvar_som('nevasca.wav', (base * rajadas + uivo * rajadas) * env)

    # redemoinho: o vento começa a girar (tremolo cada vez mais rápido e assovio subindo)
    t = tempo(1.7)
    giro = np.sin(2 * np.pi * np.cumsum(2 + 9 * (t / t[-1]) ** 1.5) / taxa)
    ruido = passa_baixa(rng.standard_normal(len(t)), 12) * 4
    assovio = varrer(260, 980, t) * 0.14
    env = np.clip(t / 0.4, 0, 1) * np.clip((1.7 - t) / 0.35, 0, 1)
    salvar_som('redemoinho.wav', (ruido * (0.55 + 0.45 * giro) + assovio * (0.6 + 0.4 * giro)) * env)

    # pilar: estalo seco, baque grave e um cristal subindo rápido
    t = tempo(0.65)
    estalo = (passa_baixa(rng.standard_normal(len(t)), 2) - passa_baixa(rng.standard_normal(len(t)), 8)) * np.exp(-t * 40) * 1.4
    baque = np.sin(2 * np.pi * (110 * np.exp(-t * 9) + 45) * t) * np.exp(-t * 9) * 1.1
    cristal = varrer(900, 3200, t) * np.exp(-t * 6) * 0.25
    salvar_som('pilar.wav', estalo + baque + cristal)

    # cristal: floco gigante estourando (sinos agudos + vidro)
    t = tempo(0.6)
    sinos = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(1976, 6), (2637, 7), (3136, 8), (3951, 10)]) * 0.3
    vidro = (passa_baixa(rng.standard_normal(len(t)), 2) - passa_baixa(rng.standard_normal(len(t)), 6)) * np.exp(-t * 14)
    salvar_som('cristal.wav', sinos + vidro)

    # implosao: tudo sendo sugado (ruído e tom crescendo ao contrário, corte seco no fim)
    t = tempo(1.15)
    sobe = (t / t[-1]) ** 2.5
    ruido = passa_baixa(rng.standard_normal(len(t)), 6) * 3 * sobe
    tom = varrer(120, 900, t) * 0.35 * sobe + varrer(60, 240, t) * 0.4 * sobe
    corte = np.clip((t[-1] - t) / 0.03, 0, 1)
    salvar_som('implosao.wav', (ruido + tom) * corte)


def main():
    salvar(gerar_carta(), 'carta.png')
    salvar(gerar_pilar(), 'pilar.png')
    salvar(gerar_flocao(), 'flocao.png')
    salvar(gerar_estilhaco(), 'estilhaco.png')
    salvar(gerar_pingente(), 'pingente.png')
    salvar(gerar_impacto(), 'impacto.png')
    sons()


if __name__ == '__main__':
    main()
