#!/usr/bin/env python3
"""Gera a arte da MESA DE CARTAS (o menu inicial) em public/assets/sprites/menu/mesa/
e as posições em src/game/menu/sprites/mesa.js.

Uso (na raiz do projeto):  python3 scripts/menu/mesa.py
Precisa do Pillow, do numpy e do OpenCV (pip install opencv-python-headless).
Saída determinística (sementes fixas).

Parte da ilustração scripts/menu/arte/mesa-original.webp (1672x941): a turma
jogando cartas numa mesa, com o telão ao fundo. Fica na resolução dela (o jogo
mostra reduzida para 854x480, com filtro suave). O script:

  1. apaga o que a ilustração traz pintado e o jogo desenha ao vivo: o logo,
     as opções, as dicas e o nome da música;
  2. corrige a Noelle (na ilustração ela segura as cartas E põe as mãos no
     rosto: quatro braços); as mãos no rosto saem e o rosto é repintado;
  3. devolve ao chapéu e à capa do Ralsei o verde do sprite dele;
  4. desenha os olhos fechados de quem pisca (Ralsei, Asriel e Berdly);
  5. separa o que fica NA FRENTE da tela do telão (o cabelo da Susie e o "!!"),
     porque a luta passa ao vivo por cima da tela.

Saída:
  fundo.webp            a sala inteira (1672x941)
  olhos-<id>.png        os olhos fechados de quem pisca (pedaço, no lugar)
  frente.png            o que fica na frente da tela do telão (pedaço, no lugar)
  raiva.png             o "💢" do Berdly (o jogo faz brilhar na batida)
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

L, A = 1672, 941
ESCALA = 854 / L  # px da ilustração -> px de jogo
SEED = 7

# ---------- regiões na ilustração (px de 1672x941) ----------

# GrabCut: o Ralsei (para o verde) e a Susie (o cabelo dela fica na frente da tela)
RALSEI = (640, 345, 815, 505)
RALSEI_CAPA = (640, 470, 830, 640)
SUSIE = (785, 255, 1115, 455)
# olhos de quem pisca. Atrás de óculos (Ralsei, Berdly): a lente (a parte clara
# da caixa) fica e só a pupila some. Sem óculos (Asriel): a elipse do olho
# inteira vira pelo (um degradê ajustado ao pelo em volta). Mais a cor e a curva do traço.
OLHOS = {
    'ralsei': [
        {'lente': (724, 455, 737, 478), 'traco': (24, 58, 44), 'curva': 2},
        {'lente': (754, 450, 766, 473), 'traco': (24, 58, 44), 'curva': 2},
    ],
    'asriel': [
        {'elipse': (1420, 671, 10, 17), 'traco': (52, 28, 46), 'curva': 3},
    ],
    'berdly': [
        {'lente': (1446, 473, 1472, 494), 'traco': (14, 20, 48), 'curva': 1},
        {'lente': (1485, 470, 1520, 494), 'traco': (14, 20, 48), 'curva': 1},
    ],
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
RAIVA = (1528, 443, 1582, 497)  # o "💢" do Berdly
CARTA_SUPER = (952, 578, 1028, 632)  # a carta SUPER que a Susie bate na mesa
# as mãos da Noelle no rosto (o par a mais) e o rosto repintado no lugar delas:
# pele dentro do maxilar (com blush) e, por fora, o cabelo copiado de um pouco
# mais para o lado (dx) e, da gola para baixo, a blusa copiada de logo abaixo
MAOS_NOELLE = [
    {'contorno': [(1180, 455), (1192, 451), (1204, 455), (1213, 470), (1214, 488), (1208, 506), (1184, 506), (1177, 490)], 'dx': -26},
    {'contorno': [(1247, 455), (1261, 451), (1276, 455), (1285, 470), (1285, 506), (1251, 506), (1245, 488), (1246, 470)], 'dx': 34},
]
ROSTO_NOELLE = [(1199, 446), (1199, 462), (1203, 472), (1209, 480), (1217, 486), (1230, 489), (1243, 486), (1251, 480), (1257, 472), (1261, 462), (1261, 446)]
MAXILAR_NOELLE = ROSTO_NOELLE[2:-2]  # o contorno escuro só embaixo (perto dos olhos o cabelo cobre)
COR_NOELLE = {'pele': (247, 136, 102), 'blush': (255, 112, 104), 'contorno': (74, 30, 34)}
GOLA_NOELLE = (488, 16)  # da linha 488 para baixo vem a blusa, de 16 px abaixo
BRILHOS = [(1142, 420), (1124, 447), (1327, 413), (1322, 455), (1112, 487), (1338, 380)]  # ✦ em volta da Noelle
# onde não procurar lâmpadas (cabelo loiro e brilhos da Noelle, a tela, o logo, a mesa)
SEM_LUZES = [TELA, LOGO, SUBTITULO, (1100, 330, 1345, 530), (0, 470, L, A)]


def para_jogo(x, y):
    return round(x * ESCALA, 1), round(y * ESCALA, 1)


def hsv(img):
    h = cv2.cvtColor(img, cv2.COLOR_BGR2HSV_FULL).astype(np.float32)
    return h[..., 0] * 360 / 256, h[..., 1] / 255, h[..., 2] / 255


def caixa_mascara(caixa):
    m = np.zeros((A, L), bool)
    x0, y0, x1, y1 = caixa
    m[y0:y1, x0:x1] = True
    return m


def dilatar(m, px):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(m.astype(np.uint8), k) > 0


# ---------- limpeza e correções ----------


def corrigir_noelle(img):
    """Tira as mãos do rosto da Noelle e repinta o lugar delas (pixel art, sem borrão)."""
    from PIL import ImageDraw

    rosto = Image.new('1', (L, A), 0)
    ImageDraw.Draw(rosto).polygon(ROSTO_NOELLE + [(1261, 436), (1199, 436)], fill=1)
    r = np.asarray(rosto, bool)
    original = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    arr = original.copy()
    ys, xs = np.mgrid[0:A, 0:L]
    pele_toda = np.zeros((A, L), bool)
    for mao in MAOS_NOELLE:
        im = Image.new('1', (L, A), 0)
        ImageDraw.Draw(im).polygon(mao['contorno'], fill=1)
        m = np.asarray(im, bool)
        fora = m & ~r
        yy, xx = np.nonzero(fora & (ys < GOLA_NOELLE[0]))
        arr[yy, xx] = original[yy, xx + mao['dx']]  # carimbo: o cabelo de ao lado
        yy, xx = np.nonzero(fora & (ys >= GOLA_NOELLE[0]))
        arr[yy, xx] = original[yy + GOLA_NOELLE[1], xx]  # e a blusa de logo abaixo
        pele_toda |= m & r
    arr[pele_toda] = COR_NOELLE['pele']
    for cx in (1206, 1254):  # blush
        arr[pele_toda & (((xs - cx) / 7) ** 2 + ((ys - 466) / 4) ** 2 <= 1)] = COR_NOELLE['blush']
    out = Image.fromarray(arr)
    ImageDraw.Draw(out).line(MAXILAR_NOELLE, fill=COR_NOELLE['contorno'], width=2)
    return cv2.cvtColor(np.asarray(out), cv2.COLOR_RGB2BGR)


def mascara_interface(img):
    H, S, V = hsv(img)
    m = np.zeros((A, L), bool)
    for caixa, (h0, h1), smin in OPCOES:
        dentro = caixa_mascara(caixa)
        letra = (H >= h0) & (H <= h1) & (S >= smin) & (V > 0.5)
        m |= dilatar(dentro & letra, 4) & dentro
    dentro = caixa_mascara(DICA)
    m |= dilatar(dentro & (S < 0.25) & (V > 0.7), 3) & dentro
    m |= caixa_mascara(LOGO) | caixa_mascara(SUBTITULO)
    (cx, cy), r = RADAR
    ys, xs = np.mgrid[0:A, 0:L]
    disco = (xs - cx) ** 2 + (ys - cy) ** 2 <= r * r
    m |= dilatar(disco & (H >= 165) & (H <= 205) & (S > 0.35) & (V > 0.3), 2)
    for caixa in (MUSICA, DICAS):
        dentro = caixa_mascara(caixa)
        m |= dilatar(dentro & (V > 0.45) & ((S < 0.3) | ((H > 165) & (H < 205))), 3) & dentro
    return m


def mascara_cor(img, caixa, cond, folga=2):
    H, S, V = hsv(img)
    dentro = caixa_mascara(caixa)
    return dilatar(dentro & cond(H, S, V), folga) & dentro


def recortar_figura(img, caixa):
    """GrabCut no retângulo (o de baixo é o corte), só o pedaço principal e sem buracos."""
    x0, y0, x1, y1 = caixa
    m = np.zeros((A, L), np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, m, (x0, y0, x1 - x0, y1 - y0), bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    fg = ((m == 1) | (m == 3)).astype(np.uint8)
    n, rot, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        fg = (rot == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    return fg > 0


def ralsei_verde(img, m):
    """O chapéu e a capa do Ralsei saem verde-azulados na ilustração: puxa para o verde do sprite."""
    h = cv2.cvtColor(img, cv2.COLOR_BGR2HSV_FULL).astype(np.int32)
    graus = h[..., 0] * 360 / 256
    alvo = m & (graus > 150) & (graus < 205) & (h[..., 1] > 70)
    h[..., 0] = np.where(alvo, h[..., 0] - int(28 * 256 / 360), h[..., 0]) % 256
    verde = cv2.cvtColor(h.astype(np.uint8), cv2.COLOR_HSV2BGR_FULL)
    return np.where(alvo[..., None], verde, img)


# ---------- camadas ----------


def salvar(bgr, alfa, nome):
    rgba = np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), alfa]) if alfa is not None else cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgba.astype(np.uint8))
    if nome.endswith('.webp'):  # o fundo inteiro: WebP (a ilustração já vem em WebP; PNG daria 2 MB)
        img.save(os.path.join(SAIDA, nome), quality=92, method=6)
    else:
        img.save(os.path.join(SAIDA, nome), optimize=True)


def pedaco(img, m, nome):
    """Camada só com os pixels de m, cortada no menor retângulo. Devolve a posição (px da ilustração)."""
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    alfa = np.where(m[y0:y1, x0:x1], 255, 0).astype(np.uint8)
    salvar(img[y0:y1, x0:x1], alfa, nome)
    return int(x0), int(y0)


def fechar_olhos(img, olhos):
    """Pálpebras: o olho vira a cor da pele (ou da lente) com um traço escuro no
    meio, curvo para baixo (olho fechado sorrindo)."""
    out = img.copy()
    m = np.zeros((A, L), bool)
    H, S, V = hsv(img)
    ys, xs = np.mgrid[0:A, 0:L]
    for o in olhos:
        if 'lente' in o:
            caixa = caixa_mascara(o['lente'])
            claro = caixa & (V > 0.7) & (S < 0.35)
            pts = np.argwhere(claro)[:, ::-1].astype(np.int32)
            olho = np.zeros((A, L), np.uint8)
            cv2.fillConvexPoly(olho, cv2.convexHull(pts), 1)
            olho = (olho > 0) & caixa & ~(caixa & (S > 0.35) & (V > 0.35) & ~claro)  # a armação colorida fica
            cor = np.median(img[claro], axis=0)
        else:
            cx, cy, rx, ry = o['elipse']
            d = ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2
            olho = d <= 1
            cor = None
        if cor is None:
            # um plano de cor (a + b·x + c·y, por canal) ajustado ao pelo do anel em volta
            anel = (d > 1.3) & (d < 2.6) & (V > 0.8) & (S < 0.35)  # o rosto claro (não o cabelo)
            yy, xx = np.nonzero(anel)
            base = np.column_stack([np.ones_like(xx), xx, yy]).astype(np.float64)
            coef, *_ = np.linalg.lstsq(base, img[anel].astype(np.float64), rcond=None)
            yo, xo = np.nonzero(olho)
            out[olho] = np.clip(np.column_stack([np.ones_like(xo), xo, yo]) @ coef, 0, 255).astype(np.uint8)
        else:
            out[olho] = cor.astype(np.uint8)
        yy, xx = np.nonzero(olho)
        xa, xb, cy = xx.min() + 1, xx.max() - 1, int(round(yy.mean())) + 1
        traco = [(int(x), int(round(cy + o['curva'] * np.sin(np.pi * (x - xa) / max(1, xb - xa))))) for x in range(xa, xb + 1)]
        cv2.polylines(out, [np.array(traco, np.int32)], False, o['traco'][::-1], 3, cv2.LINE_AA)  # traço em RGB; o OpenCV pinta em BGR
        m |= olho | caixa_mascara((xa - 1, cy - abs(o['curva']) - 2, xb + 2, cy + abs(o['curva']) + 3))
    return out, m


def luzes(img):
    """Lâmpadas, velas e o abajur: os pontos de luz quente (para cintilar no jogo)."""
    b, g, r = (img[..., i].astype(int) for i in range(3))
    quente = (r > 235) & (g > 165) & (b < 175) & (r - b > 80)
    for caixa in SEM_LUZES:
        quente &= ~caixa_mascara(caixa)
    n, _, stats, cent = cv2.connectedComponentsWithStats(quente.astype(np.uint8))
    pontos = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < 6 or area > 260:
            continue
        x, y = para_jogo(*cent[i])
        pontos.append({'x': x, 'y': y, 'tamanho': round(min(4.0, (area ** 0.5) / 4), 1)})
    return pontos


def main():
    os.makedirs(SAIDA, exist_ok=True)
    for velho in os.listdir(SAIDA):  # da versão anterior (cabeças separadas)
        os.remove(os.path.join(SAIDA, velho))
    cv2.setRNGSeed(SEED)
    img = cv2.imread(ORIGINAL)  # BGR
    assert img is not None and img.shape[:2] == (A, L), 'mesa-original.webp tem que ter 1672x941'

    img = corrigir_noelle(img)
    msusie = recortar_figura(img, SUSIE)
    mralsei = recortar_figura(img, RALSEI) | caixa_mascara(RALSEI_CAPA)
    amarelo = lambda H, S, V: (H > 40) & (H < 70) & (S > 0.5) & (V > 0.7)
    mexcl = mascara_cor(img, EXCLAMACAO, amarelo, 3)
    vermelho = lambda H, S, V: ((H < 15) | (H > 345)) & (S > 0.5) & (V > 0.55)
    mraiva = mascara_cor(img, RAIVA, vermelho, 1)

    img = cv2.inpaint(img, mascara_interface(img).astype(np.uint8) * 255, 6, cv2.INPAINT_TELEA)
    img = ralsei_verde(img, mralsei)
    salvar(img, None, 'fundo.webp')

    dados = {'arte': {'largura': L, 'altura': A, 'escala': ESCALA}, 'olhos': [], 'luzes': luzes(img)}
    for nome, olhos in OLHOS.items():
        fechado, m = fechar_olhos(img, olhos)
        x, y = pedaco(fechado, m, f'olhos-{nome}.png')
        dados['olhos'].append({'id': nome, 'chave': f'menu-mesa-olhos-{nome}', 'x': x, 'y': y})
    # na frente da tela: o cabelo da Susie e o "!!" (a luta ao vivo passa por baixo deles)
    frente = (dilatar(msusie, 1) | mexcl) & dilatar(caixa_mascara(TELA), 6)
    frente |= mexcl
    x, y = pedaco(img, frente, 'frente.png')
    dados['frente'] = {'chave': 'menu-mesa-frente', 'x': x, 'y': y}
    x, y = pedaco(img, mraiva, 'raiva.png')
    dados['raiva'] = {'chave': 'menu-mesa-raiva', 'x': x, 'y': y}
    ex, ey = pedaco(img, mexcl, 'exclamacao.png')
    dados['exclamacao'] = {'chave': 'menu-mesa-exclamacao', 'x': ex, 'y': ey}

    x0, y0 = para_jogo(TELA[0], TELA[1])
    x1, y1 = para_jogo(TELA[2], TELA[3])
    dados['tela'] = {'x': x0, 'y': y0, 'largura': round(x1 - x0, 1), 'altura': round(y1 - y0, 1)}
    cx, cy = para_jogo((CARTA_SUPER[0] + CARTA_SUPER[2]) / 2, (CARTA_SUPER[1] + CARTA_SUPER[3]) / 2)
    dados['cartaSuper'] = {'x': cx, 'y': cy}
    dados['brilhos'] = [dict(zip(('x', 'y'), para_jogo(x, y))) for x, y in BRILHOS]

    imagens = ['fundo.webp', 'frente.png', 'raiva.png', 'exclamacao.png'] + [f'olhos-{k}.png' for k in OLHOS]
    linhas = ',\n'.join(f"    {{ chave: 'menu-mesa-{n.split('.')[0]}', arquivo: `${{PASTA}}/{n}` }}" for n in imagens)
    js = f"""// GERADO por scripts/menu/mesa.py (não edite à mão: rode o script de novo)
// Sprites e posições da MESA DE CARTAS (menu inicial), carregados pela Boot.
//   imagens: [{{ chave, arquivo }}]
//   DADOS_MESA
//     arte        tamanho da ilustração e a escala dela no jogo (px da ilustração -> px de jogo)
//     olhos, frente, raiva, exclamacao   pedaços por cima do fundo: x, y em px DA ILUSTRAÇÃO
//     tela        a tela do telão (onde a luta passa ao vivo), em px de jogo
//     cartaSuper, brilhos (✦ em volta da Noelle), luzes (lâmpadas e velas): px de jogo
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
