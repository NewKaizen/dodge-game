import Phaser from 'phaser'
import { CORES, FONTE, LARGURA, TEXTO } from '../constants.js'
import { SPRITES, CORACAO_MAPA } from '../arte/sprites.js'

// Peças de desenho das telas de conta (Perfil, Amigos, Coleção) e dos avisos,
// no jeito da tela de Configurações: caixas pretas de borda branca, fonte
// pixelada, coração como cursor e as dicas de botão no rodapé.
//
//   COR                                paleta das telas
//   texto(cena, x, y, s, tam, cor, extra)   texto com a fonte do jogo
//   caixa(g, x, y, w, h, borda?, fundo?)    caixa preta de borda grossa (Graphics)
//   caber(texto, conteudo, largura)         reticências até caber
//   seta(g, x, y, direcao, t, cor)          triângulo
//   desenharDicas(cena, container, dicas)   rodapé: [['cimaBaixo', 'Escolher'], ['A', 'Confirmar'], ...]
//   criarAvatar(cena, x, y, avatar, tam, moldura?)
//                                      avatar de personagem (pixel art), coração padrão ou a
//                                      foto enviada (carregada na hora; se falhar, o padrão)
//   barraXp(cena, g, x, y, w, h, prog)      a barra do nível
//   verso(g, x, y, w, h, cor)               o verso de uma carta
export const COR = {
  borda: CORES.caixa,
  tema: 0xffe040,
  texto: TEXTO.normal,
  apagado: TEXTO.desabilitado,
  descricao: '#d4d4e4',
  dica: '#9a9ab0',
  ok: '#7fe08a',
  erro: '#ff7a7a',
  aviso: '#ffb040',
  titulo: '#c9a2ff',
  selecao: 0xffe040,
  gold: '#ffd23a',
}

export function texto(cena, x, y, conteudo, tamanho, cor = COR.texto, extra = {}) {
  return cena.add.text(x, y, conteudo, {
    fontFamily: FONTE,
    fontSize: `${tamanho}px`,
    color: cor,
    stroke: '#000000',
    strokeThickness: tamanho >= 18 ? 4 : 0,
    ...extra,
  })
}

export function caixa(g, x, y, largura, altura, borda = COR.borda, fundo = CORES.painel, alfa = 0.94) {
  g.fillStyle(fundo, alfa).fillRect(x, y, largura, altura)
  g.lineStyle(3, borda, 1).strokeRect(x + 1.5, y + 1.5, largura - 3, altura - 3)
}

// corta o texto com reticências até caber na largura (nomes longos, 16 letras, acentos)
export function caber(t, conteudo, largura) {
  let corte = [...conteudo].length
  const letras = [...conteudo]
  while (corte > 1 && t.width > largura) t.setText(`${letras.slice(0, --corte).join('').trimEnd()}…`)
  return t
}

export function seta(g, x, y, direcao, t, cor, alfa = 1) {
  g.fillStyle(cor, alfa)
  const m = Math.round(t * 0.75)
  if (direcao === 'esquerda') g.fillTriangle(x - m, y, x + m, y - t, x + m, y + t)
  if (direcao === 'direita') g.fillTriangle(x + m, y, x - m, y - t, x - m, y + t)
  if (direcao === 'cima') g.fillTriangle(x, y - m, x - t, y + m, x + t, y + m)
  if (direcao === 'baixo') g.fillTriangle(x, y + m, x - t, y - m, x + t, y - m)
}

// ---------- rodapé com as dicas de botão (o mesmo desenho da Config) ----------

const RODAPE_Y = 463
export function desenharDicas(cena, container, dicas) {
  const g = cena.add.graphics()
  container.add(g)
  const pecas = dicas.map(([icone, rotulo]) => {
    const t = texto(cena, 0, RODAPE_Y, rotulo, 12, COR.descricao).setOrigin(0, 0.5)
    const tecla = icone === 'Esc' || icone === 'Enter' // tecla do teclado (retângulo), não botão (círculo)
    const letra = ['A', 'B', 'C'].includes(icone) || tecla ? texto(cena, 0, RODAPE_Y, icone, tecla ? 11 : 13, '#0b0914').setOrigin(0.5) : null
    const larguraIcone = icone === 'Enter' ? 38 : icone === 'Esc' ? 28 : icone === 'esqDir' || icone === 'cimaBaixo' ? 24 : 18
    container.add([t, ...(letra ? [letra] : [])])
    return { icone, t, letra, larguraIcone, largura: larguraIcone + 6 + t.width }
  })
  const espaco = 16
  const total = pecas.reduce((s, p) => s + p.largura, 0) + espaco * (pecas.length - 1)
  let x = Math.round(LARGURA / 2 - total / 2)
  for (const p of pecas) {
    const cx = x + p.larguraIcone / 2
    if (p.icone === 'esqDir') {
      seta(g, cx - 6, RODAPE_Y, 'esquerda', 5, 0xffffff)
      seta(g, cx + 6, RODAPE_Y, 'direita', 5, 0xffffff)
    } else if (p.icone === 'cimaBaixo') {
      seta(g, cx - 5, RODAPE_Y, 'cima', 5, 0xffffff)
      seta(g, cx + 6, RODAPE_Y, 'baixo', 5, 0xffffff)
    } else if (p.icone === 'Esc' || p.icone === 'Enter') {
      g.fillStyle(0xffffff, 1).fillRoundedRect(x, RODAPE_Y - 8, p.larguraIcone, 16, 3)
      p.letra.setX(cx)
    } else {
      g.fillStyle(0xffffff, 1).fillCircle(cx, RODAPE_Y, 9)
      p.letra.setX(cx)
    }
    p.t.setX(x + p.larguraIcone + 6)
    x += p.largura + espaco
  }
}

// ---------- avatares ----------

const LADO = 16 // pixels da arte (quadrado), como o Avatar.svelte de antes

// a textura 16x16 do personagem (ou do coração padrão), pintada uma vez por jogo
export function texturaAvatar(cena, avatar) {
  const sprite = avatar?.tipo === 'jogo' ? SPRITES[avatar.id] : null
  const chave = `avatar-${sprite ? avatar.id : 'padrao'}`
  if (cena.textures.exists(chave)) return chave
  const tex = cena.textures.createCanvas(chave, LADO, LADO)
  const ctx = tex.getContext()
  ctx.fillStyle = '#16182a'
  ctx.fillRect(0, 0, LADO, LADO)
  const mapa = sprite ? sprite.mapa.slice(0, LADO) : CORACAO_MAPA
  const paleta = sprite ? sprite.paleta : { '#': '#ff3355' }
  const dx = Math.floor((LADO - mapa[0].length) / 2)
  const dy = sprite ? 1 : Math.floor((LADO - mapa.length) / 2)
  mapa.forEach((linha, y) => {
    ;[...linha].forEach((letra, x) => {
      const cor = paleta[letra]
      if (!cor) return
      ctx.fillStyle = cor
      ctx.fillRect(x + dx, y + dy, 1, 1)
    })
  })
  tex.refresh()
  return chave
}

// fotos já tentadas: url -> chave da textura | null (falhou)
const fotos = new Map()
const FOTO_TEMPO_MS = 8000

// Carrega a foto enviada pelo jogador (URL do Storage) numa textura do jogo.
// Imagem de outro domínio precisa de crossOrigin para o WebGL aceitar; se o
// servidor não mandar o CORS, a imagem não abre: devolve null e quem chamou usa o padrão.
export function carregarFoto(cena, url) {
  const chave = `foto:${url}`
  const feito = fotos.get(url)
  if (feito !== undefined) return feito instanceof Promise ? feito : Promise.resolve(feito)
  if (cena.textures.exists(chave)) return Promise.resolve(chave)
  const promessa = new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    const acabou = setTimeout(() => img.onerror?.(), FOTO_TEMPO_MS)
    img.onload = () => {
      clearTimeout(acabou)
      try {
        if (!cena.textures.exists(chave)) cena.textures.addImage(chave, img).setFilter(Phaser.Textures.FilterMode.LINEAR)
        resolve(chave)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      clearTimeout(acabou)
      img.onload = img.onerror = null
      resolve(null)
    }
    img.src = url
  }).then((r) => {
    fotos.set(url, r)
    return r
  })
  fotos.set(url, promessa)
  return promessa
}

const paraNumero = (css) => Phaser.Display.Color.HexStringToColor(css).color
const ARCOIRIS = [0xff3355, 0xffd34d, 0x6dffb0, 0x4da6ff]

// Avatar com moldura: container centrado em (x, y). `moldura` é a cor da borda (CSS) ou null (a verde de sempre).
export function criarAvatar(cena, x, y, avatar, tamanho, moldura = null) {
  const c = cena.add.container(x, y)
  const fundo = cena.add.rectangle(0, 0, tamanho, tamanho, 0x16182a)
  const img = cena.add.image(0, 0, texturaAvatar(cena, avatar?.tipo === 'enviado' ? { tipo: 'padrao' } : avatar))
  img.setDisplaySize(tamanho, tamanho)
  const borda = tamanho >= 48 ? 4 : 2
  const g = cena.add.graphics()
  const meio = tamanho / 2
  const arcoiris = moldura === '#ff5fd2'
  if (arcoiris) {
    const lados = [
      [-meio - borda, -meio - borda, tamanho + borda, borda],
      [meio, -meio - borda, borda, tamanho + borda],
      [-meio, meio, tamanho + borda, borda],
      [-meio - borda, -meio, borda, tamanho + borda],
    ]
    lados.forEach((l, i) => g.fillStyle(ARCOIRIS[i], 1).fillRect(...l))
  } else {
    g.lineStyle(borda, paraNumero(moldura ?? '#6dffb0'), 1).strokeRect(-meio - borda / 2, -meio - borda / 2, tamanho + borda, tamanho + borda)
  }
  c.add([fundo, img, g])
  if (avatar?.tipo === 'enviado' && avatar.url) {
    carregarFoto(cena, avatar.url).then((chave) => {
      if (!chave || !img.scene || !cena.textures.exists(chave)) return // falhou (ou a tela já mudou): fica o coração
      img.setTexture(chave).setDisplaySize(tamanho, tamanho)
    })
  }
  return c
}

// ---------- barra de XP e verso de carta ----------

export function barraXp(g, x, y, largura, altura, { noNivel, paraProximo }, cor = 0x6dffb0) {
  g.fillStyle(0x16182a, 1).fillRect(x, y, largura, altura)
  const cheio = Math.max(0, Math.min(1, noNivel / Math.max(1, paraProximo)))
  g.fillStyle(cor, 1).fillRect(x, y, Math.round(largura * cheio), altura)
  g.lineStyle(2, 0xffffff, 1).strokeRect(x, y, largura, altura)
}

// o verso da carta: cor de fundo, borda branca e um losango no meio
export function verso(g, x, y, largura, altura, cor) {
  g.fillStyle(paraNumero(cor), 1).fillRect(x, y, largura, altura)
  g.lineStyle(2, 0xffffff, 1).strokeRect(x, y, largura, altura)
  const cx = x + largura / 2
  const cy = y + altura / 2
  const r = Math.min(largura, altura) * 0.22
  g.fillStyle(0xffffff, 0.45).fillTriangle(cx, cy - r * 1.4, cx + r, cy, cx, cy + r * 1.4).fillTriangle(cx, cy - r * 1.4, cx - r, cy, cx, cy + r * 1.4)
}
