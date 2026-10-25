#!/usr/bin/env python3
"""Gera a arte da MESA DE CARTAS (o menu inicial alternativo) em
public/assets/sprites/menu/mesa/ e as posições em src/game/menu/sprites/mesa.js.

Uso (na raiz do projeto):  python3 scripts/menu/mesa.py
Precisa do Pillow, do numpy e do OpenCV (pip install opencv-python-headless).
Saída determinística (sementes fixas).

Parte da ilustração scripts/menu/arte/mesa-original.webp (1672x941): a turma
jogando cartas numa mesa, com o telão ao fundo. O script:

  1. apaga o que a ilustração traz pintado e o jogo desenha ao vivo: o logo,
     as opções, as dicas, o nome da música e o que passa no telão;
  2. corrige a Noelle (na ilustração ela segura as cartas E põe as mãos no
     rosto: quatro braços); as mãos no rosto saem;
  3. separa a cabeça de cada um (GrabCut) para ela balançar no ritmo;
  4. reduz tudo para a grade de pixel art do jogo (427x240, um pixel de arte =
     2x2 na tela, como a sala do outro menu) com uma paleta só de 96 cores;
     o chapéu e a capa do Ralsei voltam ao verde do sprite dele.

Saída (854x480 e pedaços):
  fundo.png             a sala sem as cabeças (o que fica atrás delas é preenchido)
  cabeca-<id>.png       a cabeça de cada um (desenhada por cima, no lugar)
  olhos-<id>.png        os olhos fechados de quem pisca (por cima da cabeça)
  exclamacao.png        o "!!" da Susie (pulsa na batida)
  src/game/menu/sprites/mesa.js   manifesto + DADOS_MESA (posições em px de jogo)
"""

import json
import os

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ORIGINAL = os.path.join(RAIZ, 'scripts', 'menu', 'arte', 'mesa-original.webp')
SAIDA = os.path.join(RAIZ, 'public', 'assets', 'sprites', 'menu', 'mesa')
MANIFESTO = os.path.join(RAIZ, 'src', 'game', 'menu', 'sprites', 'mesa.js')

L, A = 427, 240  # grade da arte (ampliada 2x no jogo)
CORES = 96
SEED = 7

# ---------- regiões na ilustração original (px de 1672x941) ----------

# cabeças: retângulo do GrabCut (o de baixo é o corte do pescoço) e o jeito de curtir a música
CABECAS = {
    'kris': {'caixa': (370, 430, 610, 600), 'jeito': 'cabeca'},
    'ralsei': {'caixa': (640, 345, 815, 505), 'jeito': 'balanco'},
    'susie': {'caixa': (785, 255, 1115, 455), 'jeito': 'headbang'},
    'noelle': {'caixa': (1110, 335, 1335, 505), 'jeito': 'timida'},
    'berdly': {'caixa': (1405, 380, 1600, 545), 'jeito': 'pulo'},
    'asriel': {'caixa': (1355, 575, 1570, 715), 'jeito': 'saltinho'},
    'dess': {'caixa': (620, 600, 915, 830), 'jeito': 'roqueira'},
}
# pupilas de quem pisca (as outras estão de olhos fechados, de costas ou bravas)
OLHOS = {
    'ralsei': [(723, 452, 736, 478), (753, 447, 765, 473)],
    'asriel': [(1410, 655, 1424, 684), (1431, 658, 1441, 678)],
}
# o que o jogo desenha ao vivo
OPCOES = [  # (caixa, faixa de matiz em graus, saturação mínima) de cada linha
    ((96, 498, 254, 548), (165, 200), 0.35),  # CO-OP (ciano)
    ((282, 498, 332, 548), (165, 200), 0.35),  # seta
    ((96, 563, 194, 614), (320, 360), 0.35),  # PVP (rosa)
    ((96, 628, 278, 680), (150, 185), 0.35),  # ONLINE (verde-água)
    ((96, 693, 214, 744), (235, 285), 0.15),  # GUIA (lilás)
    ((96, 756, 478, 810), (35, 62), 0.4),  # CONFIGURAÇÕES (amarelo)
]
DICA = (96, 824, 492, 862)  # "cartas juntos contra um chefe" (branco)
LOGO = (98, 143, 682, 320)
SUBTITULO = (348, 320, 678, 368)
RADAR = ((300, 232), 190)  # o disco atrás do logo (anéis verde-água)
MUSICA = (1440, 18, 1662, 76)  # "CATSWING" e as barrinhas
DICAS = (1310, 860, 1640, 918)  # "↑↓ MOVER  (A) ESCOLHER"
TELA = (974, 41, 1419, 317)  # a tela do telão (onde passa a luta ao vivo)
EXCLAMACAO = (1068, 278, 1122, 352)  # o "!!" da Susie
RAIVA = (1528, 443, 1582, 497)  # o "💢" do Berdly (pulsa por cima da cabeça)
CARTA_SUPER = (952, 578, 1028, 632)  # a carta SUPER que a Susie bate na mesa
# as mãos da Noelle no rosto (o par a mais) e o contorno do queixo que fica no lugar
MAOS_NOELLE = [
    [(1180, 446), (1203, 444), (1212, 468), (1214, 496), (1196, 503), (1180, 492)],
    [(1250, 444), (1274, 446), (1280, 490), (1268, 503), (1248, 497), (1247, 468)],
]
QUEIXO_NOELLE = [(1203, 446), (1205, 468), (1213, 486), (1230, 497), (1247, 486), (1255, 468), (1257, 446)]
BRILHOS = [(1142, 420), (1124, 447), (1327, 413), (1322, 455), (1112, 487), (1338, 380)]  # ✦ em volta da Noelle


def para_arte(x, y):
    return x * L / 1672, y * A / 941


def para_jogo(x, y):
    ax, ay = para_arte(x, y)
    return round(ax * 2), round(ay * 2)


def hsv(img):
    h = cv2.cvtColor(img, cv2.COLOR_BGR2HSV_FULL).astype(np.float32)
    return h[..., 0] * 360 / 256, h[..., 1] / 255, h[..., 2] / 255


def caixa_mascara(forma, caixa):
    m = np.zeros(forma, bool)
    x0, y0, x1, y1 = caixa
    m[y0:y1, x0:x1] = True
    return m


def dilatar(m, px):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(m.astype(np.uint8), k) > 0


def preencher(img, m, raio=6):
    return cv2.inpaint(img, m.astype(np.uint8) * 255, raio, cv2.INPAINT_TELEA)


# ---------- 1-2. limpeza e correção na resolução original ----------


def corrigir_noelle(img):
    m = np.zeros(img.shape[:2], np.uint8)
    for mao in MAOS_NOELLE:
        cv2.fillPoly(m, [np.array(mao, np.int32)], 255)
    img = cv2.inpaint(img, m, 7, cv2.INPAINT_TELEA)
    # o queixo: contorno escuro no lugar onde as mãos tapavam
    cv2.polylines(img, [np.array(QUEIXO_NOELLE, np.int32)], False, (38, 46, 92), 3, cv2.LINE_8)
    return img


def mascara_interface(img):
    H, S, V = hsv(img)
    forma = img.shape[:2]
    m = np.zeros(forma, bool)
    for caixa, (h0, h1), smin in OPCOES:
        dentro = caixa_mascara(forma, caixa)
        letra = (H >= h0) & (H <= h1) & (S >= smin) & (V > 0.5)
        m |= dilatar(dentro & letra, 4) & dentro
    dentro = caixa_mascara(forma, DICA)
    m |= dilatar(dentro & (S < 0.25) & (V > 0.7), 3) & dentro
    m |= caixa_mascara(forma, LOGO) | caixa_mascara(forma, SUBTITULO)
    (cx, cy), r = RADAR
    ys, xs = np.mgrid[0:forma[0], 0:forma[1]]
    disco = (xs - cx) ** 2 + (ys - cy) ** 2 <= r * r
    m |= dilatar(disco & (H >= 165) & (H <= 205) & (S > 0.35) & (V > 0.3), 2)
    for caixa in (MUSICA, DICAS):
        dentro = caixa_mascara(forma, caixa)
        m |= dilatar(dentro & (V > 0.45) & ((S < 0.3) | ((H > 165) & (H < 205))), 3) & dentro
    return m


def mascara_cor(img, caixa, cond, folga=2):
    H, S, V = hsv(img)
    dentro = caixa_mascara(img.shape[:2], caixa)
    return dilatar(dentro & cond(H, S, V), folga) & dentro


def cabecas(img):
    cv2.setRNGSeed(SEED)
    out = {}
    for nome, d in CABECAS.items():
        x0, y0, x1, y1 = d['caixa']
        m = np.zeros(img.shape[:2], np.uint8)
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(img, m, (x0, y0, x1 - x0, y1 - y0), bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
        fg = ((m == 1) | (m == 3)).astype(np.uint8)
        # só o pedaço principal (sem ilhas soltas) e sem buracos
        n, rot, stats, _ = cv2.connectedComponentsWithStats(fg)
        if n > 1:
            maior = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            fg = (rot == maior).astype(np.uint8)
        cont, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cheio = np.zeros_like(fg)
        cv2.drawContours(cheio, cont, -1, 1, -1)
        out[nome] = cheio > 0
    return out


# ---------- 3-4. grade de pixel art ----------


def reduzir(img_bgr):
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return np.asarray(Image.fromarray(rgb).resize((L, A), Image.BOX), np.float32)


def reduzir_mascara(m):
    v = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((L, A), Image.BOX), np.float32) / 255
    return v >= 0.5


def ralsei_verde(arte, m):
    """O chapéu e a capa do Ralsei saem verde-azulados na ilustração: puxa para o verde do sprite."""
    bgr = cv2.cvtColor(np.clip(arte, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    h = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV_FULL).astype(np.int32)
    graus = h[..., 0] * 360 / 256
    alvo = m & (graus > 150) & (graus < 205) & (h[..., 1] > 70)
    h[..., 0] = np.where(alvo, h[..., 0] - int(28 * 256 / 360), h[..., 0]) % 256
    h[..., 1] = np.where(alvo, np.minimum(255, h[..., 1] * 1.05), h[..., 1])
    rgb = cv2.cvtColor(cv2.cvtColor(h.astype(np.uint8), cv2.COLOR_HSV2BGR_FULL), cv2.COLOR_BGR2RGB)
    return np.where(alvo[..., None], rgb.astype(np.float32), arte)


def paletizar(arte, paleta=None):
    img = Image.fromarray(np.clip(arte, 0, 255).astype(np.uint8))
    if paleta is None:
        paleta = img.quantize(colors=CORES, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        return np.asarray(paleta.convert('RGB')), paleta
    return np.asarray(img.quantize(palette=paleta, dither=Image.Dither.NONE).convert('RGB')), paleta


def ampliar(arr):
    return np.repeat(np.repeat(arr, 2, axis=0), 2, axis=1)


def salvar(arr, nome):
    modo = 'RGBA' if arr.shape[-1] == 4 else 'RGB'
    Image.fromarray(ampliar(arr).astype(np.uint8), modo).save(os.path.join(SAIDA, nome), optimize=True)


def recorte(q, m, nome, folga=0):
    """Camada RGBA só com os pixels de m, cortada no menor retângulo. Devolve a posição em px de jogo."""
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min() - folga, ys.max() + 1 + folga, xs.min() - folga, xs.max() + 1 + folga
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = q[y0:y1, x0:x1]
    rgba[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
    salvar(rgba, nome)
    return {'x': int(x0 * 2), 'y': int(y0 * 2), 'largura': int((x1 - x0) * 2), 'altura': int((y1 - y0) * 2)}


def olhos_fechados(q, mcab, caixas):
    """Pálpebras: a pupila vira a cor da pele em volta e ganha um tracinho escuro no meio."""
    out = q.copy()
    m = np.zeros(mcab.shape, bool)
    for caixa in caixas:
        x0, y0 = (int(v) for v in para_arte(caixa[0], caixa[1]))
        x1, y1 = (int(np.ceil(v)) for v in para_arte(caixa[2], caixa[3]))
        reg = out[y0:y1 + 1, x0:x1 + 1].astype(np.float32)
        lum = reg @ np.array([0.3, 0.55, 0.15])
        escuro = lum < 95
        if not escuro.any() or escuro.all():
            continue
        pele = np.median(reg[~escuro], axis=0)
        traco = reg[escuro].min(axis=0)
        reg[escuro] = pele
        ys, xs = np.nonzero(escuro)
        meio = int(round(ys.mean()))
        reg[meio, max(0, xs.min() - 1):xs.max() + 2] = traco
        out[y0:y1 + 1, x0:x1 + 1] = reg
        m[y0:y1 + 1, x0:x1 + 1] = True
    return out, m & mcab


def luzes(q, livre):
    """Lâmpadas, velas e o abajur: os pontos de luz quente acima da mesa (para cintilar no jogo)."""
    r, g, b = q[..., 0].astype(int), q[..., 1].astype(int), q[..., 2].astype(int)
    quente = (r > 235) & (g > 170) & (b < 170) & (r - b > 80) & livre
    quente[125:] = False  # da mesa para baixo é carta, pipoca e pizza, não lâmpada
    n, _, stats, cent = cv2.connectedComponentsWithStats(quente.astype(np.uint8))
    pontos = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area > 16:
            continue
        x, y = cent[i]
        pontos.append({'x': round(float(x) * 2), 'y': round(float(y) * 2), 'tamanho': min(4, area)})
    return pontos


def main():
    os.makedirs(SAIDA, exist_ok=True)
    img = cv2.imread(ORIGINAL)  # BGR
    assert img is not None and img.shape[:2] == (941, 1672), 'mesa-original.webp tem que ter 1672x941'

    img = corrigir_noelle(img)
    mcab = cabecas(img)
    amarelo = lambda H, S, V: (H > 40) & (H < 70) & (S > 0.5) & (V > 0.7)
    mexcl = mascara_cor(img, EXCLAMACAO, amarelo, 2)
    vermelho = lambda H, S, V: ((H < 15) | (H > 345)) & (S > 0.5) & (V > 0.55)
    mraiva = mascara_cor(img, RAIVA, vermelho, 1)

    # a tela do telão: escura (a luta ao vivo cobre), menos o que está na frente dela
    frente = dilatar(mcab['susie'], 4) | dilatar(mexcl, 2)
    tela = caixa_mascara(img.shape[:2], TELA) & ~frente
    img[tela] = (14, 8, 10)
    img = preencher(img, mascara_interface(img) & ~frente)

    arte = reduzir(img)
    mcab_a = {k: reduzir_mascara(m) for k, m in mcab.items()}
    mexcl_a = reduzir_mascara(dilatar(mexcl, 2))
    mraiva_a = reduzir_mascara(mraiva)
    ralsei = mcab_a['ralsei'] | reduzir_mascara(caixa_mascara(img.shape[:2], (640, 470, 830, 640)))
    arte = ralsei_verde(arte, ralsei)

    q, paleta = paletizar(arte)

    # camadas por cima (cada uma com a cor da paleta já aplicada)
    dados = {'cabecas': [], 'brilhos': [], 'luzes': []}
    for nome, m in mcab_a.items():
        pos = recorte(q, m, f'cabeca-{nome}.png')
        cab = {'id': nome, 'chave': f'menu-mesa-cabeca-{nome}', **pos, 'jeito': CABECAS[nome]['jeito']}
        if nome in OLHOS:
            fechado, mo = olhos_fechados(q, m, OLHOS[nome])
            if mo.any():
                po = recorte(fechado, mo, f'olhos-{nome}.png')
                cab['olhos'] = {'chave': f'menu-mesa-olhos-{nome}', 'dx': po['x'] - pos['x'], 'dy': po['y'] - pos['y']}
        if nome == 'berdly' and (mraiva_a & m).any():
            pr = recorte(q, mraiva_a & m, 'raiva.png')
            cab['raiva'] = {'chave': 'menu-mesa-raiva', 'dx': pr['x'] - pos['x'], 'dy': pr['y'] - pos['y'], 'largura': pr['largura'], 'altura': pr['altura']}
        dados['cabecas'].append(cab)
    dados['exclamacao'] = {'chave': 'menu-mesa-exclamacao', **recorte(q, mexcl_a, 'exclamacao.png')}

    # o fundo: sem as cabeças nem o "!!" (o buraco é preenchido; só aparece 1 px dele quando a cabeça balança)
    buraco = dilatar(np.logical_or.reduce(list(mcab_a.values())) | mexcl_a, 1)
    limpa = cv2.inpaint(np.clip(arte, 0, 255).astype(np.uint8), buraco.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    fundo, _ = paletizar(limpa.astype(np.float32), paleta)
    salvar(fundo, 'fundo.png')

    # posições (px de jogo)
    x0, y0 = para_jogo(TELA[0], TELA[1])
    x1, y1 = para_jogo(TELA[2], TELA[3])
    dados['tela'] = {'x': x0, 'y': y0, 'largura': x1 - x0, 'altura': y1 - y0}
    cx, cy = para_jogo((CARTA_SUPER[0] + CARTA_SUPER[2]) / 2, (CARTA_SUPER[1] + CARTA_SUPER[3]) / 2)
    dados['cartaSuper'] = {'x': cx, 'y': cy}
    dados['brilhos'] = [dict(zip(('x', 'y'), para_jogo(x, y))) for x, y in BRILHOS]
    livre = ~reduzir_mascara(caixa_mascara(img.shape[:2], TELA)) & ~reduzir_mascara(caixa_mascara(img.shape[:2], LOGO))
    livre &= ~dilatar(np.logical_or.reduce(list(mcab_a.values())), 2)
    dados['luzes'] = luzes(fundo, livre)

    imagens = ['fundo'] + [f'cabeca-{k}' for k in CABECAS] + ['exclamacao']
    imagens += [f'olhos-{c["id"]}' for c in dados['cabecas'] if 'olhos' in c]
    imagens += ['raiva'] if any('raiva' in c for c in dados['cabecas']) else []
    linhas = ',\n'.join(f"    {{ chave: 'menu-mesa-{n}', arquivo: `${{PASTA}}/{n}.png` }}" for n in imagens)
    js = f"""// GERADO por scripts/menu/mesa.py (não edite à mão: rode o script de novo)
// Sprites e posições da MESA DE CARTAS (menu inicial alternativo), carregados pela Boot.
//   imagens: [{{ chave, arquivo }}]
//   DADOS_MESA: posições em px de jogo (854x480)
//     tela        a tela do telão na ilustração (onde a luta passa ao vivo)
//     cabecas     [{{ id, chave, x, y, largura, altura, jeito, olhos?: {{ chave, dx, dy }}, raiva?: {{ ... }} }}]
//     exclamacao  o "!!" da Susie · cartaSuper: a carta que ela bate na mesa
//     brilhos     os ✦ em volta da Noelle · luzes: lâmpadas e velas (cintilam)
const PASTA = 'assets/sprites/menu/mesa'

export default {{
  imagens: [
{linhas},
  ],
  sons: [],
}}

export const DADOS_MESA = {json.dumps(dados, ensure_ascii=False)}
"""
    with open(MANIFESTO, 'w') as f:
        f.write(js)
    print('ok:', SAIDA, '|', len(dados['luzes']), 'luzes')


if __name__ == '__main__':
    main()
