import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar } from '../audio.js'
import { CORES, CORACAO, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import { pref, definirPref, aoMudarPref, menosMovimento, PREFERENCIAS_PADRAO, OPCOES } from '../preferencias.js'
import { ACOES, ROTULO_ACAO, atribuirTecla, ehSeta, nomeTecla, normalizarTeclas, resumoTeclas } from '../teclas.js'
import { jogo, CONFIG_PADRAO } from '../../lib/estado.js'
import { alternarTelaCheia } from '../../lib/telaCheia.js'
import { capturarTecla } from '../../lib/simulador.js'

// Configurações, no jeito dos menus de console (abas em cima, lista de opções
// à esquerda com o valor alinhado à direita "◀ VALOR ▶", painel à direita
// explicando a opção em foco, dicas de botão no rodapé), com a cara do jogo:
// caixas pretas de borda branca, fonte pixelada e o coração como cursor.
//   scene.start('Config', { voltar: 'Menu' })   tela própria; sai para `voltar`
//   scene.launch('Config', { sobre: 'Pausa' })  por cima de uma cena pausada
//                                               (no fim ela é retomada)
//
// Abas: ÁUDIO e JOGO (volumes, som e velocidade ficam em lib/estado.js),
// CONTROLES (teclas do simulador, game/teclas.js), ACESSIBILIDADE e GRÁFICOS
// (game/preferencias.js; quem aplica cada uma são os efeitos/fundos do jogo,
// aqui só se escolhe). Cada aba termina com "RESTAURAR PADRÃO".
//
//   na barra de abas: ←/→ troca de aba · ↓ ou A entra na lista · B sai
//   na lista: ↑/↓ escolhe (do topo, ↑ volta às abas) · ←/→ muda o valor
//   (segure nas barras) · A alterna / confirma · B volta às abas · C sai
//   CONTROLES: A numa ação espera a nova tecla (Esc, ou B/C do joystick, cancela)
//
// A paleta de daltonismo do painel vem de game/daltonismo.js (paletaDaltonismo),
// se o arquivo existir; sem ele o painel só descreve o modo.
const daltonismo = Object.values(import.meta.glob('../daltonismo.js', { eager: true }))[0] ?? null

const REPETIR = { espera: 320, intervalo: 55 } // segurar ←/→ numa barra
const TITULO = { x: 28, y: 6 }
const ABAS_UI = { y: 54, altura: 26, esquerda: 44, direita: LARGURA - 44, folga: 6, recuo: 22 } // recuo: lugar do coração
// lista (24..524) e painel (534..830) ocupam o 16:9 com 24 px de folga de cada lado
const LISTA = { x: 24, y: 78, largura: 500, altura: 358 }
const PAINEL = { x: 534, y: 78, largura: 296, altura: 358, margem: 14 }
const LINHA = { primeira: LISTA.y + 24, passo: 33, rotuloX: 36, direita: LISTA.x + LISTA.largura - 14 }
const RODAPE = { linha: 446, y: 463 }
const BARRA = { largura: 140, altura: 10, segmentos: 28 }
const COR = {
  borda: CORES.caixa,
  bordaApagada: 0x4a4a5c,
  texto: TEXTO.normal,
  apagado: TEXTO.desabilitado,
  descricao: '#d4d4e4',
  ligado: '#7fe08a',
  desligado: '#ff7a7a',
  barra: 0x6dd0ff,
  ok: '#7fe08a',
  erro: '#ff7a7a',
}

// ---------- o que cada opção lê e grava ----------

const estado = () => get(jogo)
const mudarJogo = (fn) => jogo.update((s) => ({ ...s, ...fn(s) }))
const LIGA = { valores: [true, false], nomes: (v) => (v ? 'LIGADO' : 'DESLIGADO'), cor: (v) => (v ? COR.ligado : COR.desligado) }
// opção ligada a uma chave de game/preferencias.js (lista de OPCOES, ou liga/desliga)
const opcaoPref = (chave) => ({
  tipo: 'opcoes',
  ...(OPCOES[chave] ? { valores: OPCOES[chave] } : LIGA),
  ler: () => pref(chave),
  escrever: (v) => definirPref(chave, v),
  padrao: () => PREFERENCIAS_PADRAO[chave],
})

const NOMES_TREMOR = { normal: 'NORMAL', reduzido: 'REDUZIDO', desligado: 'DESLIGADO' }
const NOMES_DALTONISMO = { nenhum: 'NENHUM', protanopia: 'PROTANOPIA', deuteranopia: 'DEUTERANOPIA', tritanopia: 'TRITANOPIA' }
const NOMES_GRAFICOS = { minimo: 'MÍNIMO', medio: 'MÉDIO', maximo: 'MÁXIMO' }

// o que muda em cada qualidade (painel da aba GRÁFICOS): 1 a 3 quadradinhos
const RECURSOS_GRAFICOS = [
  { rotulo: 'PARTÍCULAS', niveis: { minimo: 1, medio: 2, maximo: 3 } },
  { rotulo: 'FUNDOS ANIMADOS', niveis: { minimo: 1, medio: 2, maximo: 3 } },
  { rotulo: 'FILTROS E BRILHOS', niveis: { minimo: 0, medio: 2, maximo: 3 } },
]
const TEXTO_GRAFICOS = {
  minimo: 'Para computador fraco ou para jogar sem distração: poucas partículas, fundos parados e nenhum filtro pesado (brilho, desfoque, distorção). As balas e a caixa continuam iguais.',
  medio: 'Meio-termo: menos partículas, fundos com animação simples e só os filtros leves.',
  maximo: 'Tudo ligado: todas as partículas, fundos animados e filtros. O jeito que o jogo foi pensado.',
}
const TEXTO_DALTONISMO = {
  nenhum: 'Cores originais do jogo.',
  protanopia: 'Para quem quase não enxerga o vermelho: os avisos de perigo e o coração do P1 trocam para cores que continuam se destacando do fundo e do coração do P2.',
  deuteranopia: 'Para quem confunde verde e vermelho (o tipo mais comum): os avisos e os corações ganham cores que não se misturam.',
  tritanopia: 'Para quem confunde azul e amarelo: o coração do P2 e os avisos trocam para cores fáceis de separar.',
}

const restaurarJogo = (campos) => () => mudarJogo(() => structuredClone(campos))

const ABAS = [
  {
    id: 'audio',
    rotulo: 'ÁUDIO',
    itens: [
      {
        id: 'musica',
        rotulo: 'MÚSICA',
        tipo: 'barra',
        min: 0,
        max: 100,
        passo: 5,
        ler: () => estado().volume.musica,
        escrever: (v) => mudarJogo((s) => ({ volume: { ...s.volume, musica: v } })),
        padrao: () => CONFIG_PADRAO.volume.musica,
        formato: (v) => `${v}%`,
        mudo: () => !estado().som,
        descricao: 'Volume das músicas dos menus e das lutas.',
      },
      {
        id: 'efeitos',
        rotulo: 'EFEITOS',
        tipo: 'barra',
        min: 0,
        max: 100,
        passo: 5,
        som: 'cartaSelecionar',
        ler: () => estado().volume.efeitos,
        escrever: (v) => mudarJogo((s) => ({ volume: { ...s.volume, efeitos: v } })),
        padrao: () => CONFIG_PADRAO.volume.efeitos,
        formato: (v) => `${v}%`,
        mudo: () => !estado().som,
        descricao: 'Volume dos sons: tiros, golpes, cartas e menus. Ao mexer, você já ouve uma amostra.',
      },
      {
        id: 'som',
        rotulo: 'SOM',
        tipo: 'opcoes',
        ...LIGA,
        ler: () => estado().som,
        escrever: (v) => mudarJogo(() => ({ som: v })),
        padrao: () => CONFIG_PADRAO.som,
        descricao: 'Desligado, o jogo fica mudo (música e efeitos) sem esquecer os volumes escolhidos.',
      },
      {
        id: 'restaurar',
        rotulo: 'RESTAURAR PADRÃO',
        tipo: 'acao',
        fazer: restaurarJogo({ volume: CONFIG_PADRAO.volume, som: CONFIG_PADRAO.som }),
        descricao: `Volta a música para ${CONFIG_PADRAO.volume.musica}%, os efeitos para ${CONFIG_PADRAO.volume.efeitos}% e liga o som.`,
      },
    ],
  },
  {
    id: 'jogo',
    rotulo: 'JOGO',
    itens: [
      {
        id: 'velocidade',
        rotulo: 'VELOCIDADE',
        titulo: 'VELOCIDADE DO CORAÇÃO',
        tipo: 'barra',
        min: 60,
        max: 400,
        passo: 10,
        aVoltaAoPadrao: true,
        ler: () => estado().velocidade,
        escrever: (v) => mudarJogo(() => ({ velocidade: v })),
        padrao: () => CORACAO.velocidadePadrao,
        formato: (v) => (v === CORACAO.velocidadePadrao ? `${v} (padrão)` : `${v}`),
        unidade: 'px/s',
        descricao: `Quantos pixels por segundo o coração anda. Mais rápido desvia de longe, mas fica difícil de acertar os vãos apertados. A volta para o padrão (${CORACAO.velocidadePadrao}).`,
      },
      {
        id: 'telaCheia',
        rotulo: 'TELA CHEIA',
        tipo: 'opcoes',
        ...LIGA,
        nomes: (v) => (v ? 'LIGADA' : 'DESLIGADA'),
        ler: () => Boolean(document.fullscreenElement),
        escrever: () => alternarTelaCheia(),
        descricao: 'Só o jogo na tela inteira, sem as barras de cima da página. Atalho: tecla F (Esc sai).',
      },
      {
        id: 'restaurar',
        rotulo: 'RESTAURAR PADRÃO',
        tipo: 'acao',
        fazer: restaurarJogo({ velocidade: CORACAO.velocidadePadrao }),
        descricao: `Volta a velocidade do coração para ${CORACAO.velocidadePadrao}. A tela cheia não muda.`,
      },
    ],
  },
  {
    id: 'controles',
    rotulo: 'CONTROLES',
    itens: [
      {
        id: 'jogador',
        rotulo: 'JOGADOR',
        tipo: 'opcoes',
        valores: ['p1', 'p2'],
        nomes: (v) => (v === 'p1' ? 'JOGADOR 1' : 'JOGADOR 2'),
        cor: (v) => corTexto(CORES.almas[v === 'p1' ? 0 : 1]),
        ler: (cena) => cena.jogadorTeclas,
        escrever: (v, cena) => (cena.jogadorTeclas = v),
        semSalvar: true,
        descricao:
          'De quem são as teclas da lista. Com 1 jogador, os dois conjuntos de teclas controlam o mesmo coração.\n\nO joystick (porta serial) não muda aqui: só o teclado do simulador.',
      },
      ...ACOES.map((acao) => ({
        id: `tecla-${acao}`,
        rotulo: ROTULO_ACAO[acao],
        tipo: 'tecla',
        acao,
        descricao: 'A: escolher a nova tecla (Esc cancela). Se ela já for de outra ação, sai de lá; se aquela ação ficar sem nenhuma, fica com as teclas antigas desta.',
      })),
      {
        id: 'restaurar',
        rotulo: 'RESTAURAR TECLAS PADRÃO',
        tipo: 'acao',
        fazer: () => definirPref('teclas', null),
        descricao: 'Volta as teclas dos dois jogadores para as de fábrica:\nP1: WASD · A Espaço/Z/E · B Q/X/Shift esq. · pausa C/Esc\nP2: setas · A Enter · B Shift dir./Backspace · pausa P',
      },
    ],
  },
  {
    id: 'acessibilidade',
    rotulo: 'ACESSIBILIDADE',
    itens: [
      {
        id: 'reduzirMovimento',
        rotulo: 'REDUZIR ANIMAÇÕES',
        ...opcaoPref('reduzirMovimento'),
        descricao: 'Deixa bem mais suaves (ou tira) tremores, zooms, clarões e câmeras lentas. Bom para quem enjoa ou se distrai com a tela mexendo.',
      },
      {
        id: 'tremor',
        rotulo: 'TREMORES',
        ...opcaoPref('tremor'),
        nomes: (v) => NOMES_TREMOR[v],
        descricao: 'Força dos tremores da tela e da caixa quando alguém leva um golpe. REDUZIDO: bem mais fracos. DESLIGADO: nenhum.',
      },
      {
        id: 'flashes',
        rotulo: 'CLARÕES',
        ...opcaoPref('flashes'),
        descricao: 'Clarões de tela (brancos ou coloridos) em golpes, supers e explosões. DESLIGADO: nenhum clarão, para quem tem sensibilidade à luz.',
      },
      {
        id: 'daltonismo',
        rotulo: 'MODO DALTÔNICO',
        ...opcaoPref('daltonismo'),
        nomes: (v) => NOMES_DALTONISMO[v],
        descricao: (v) => `Troca as cores que importam no jogo (avisos de perigo, corações, balas do tema). ${TEXTO_DALTONISMO[v]}`,
      },
      {
        id: 'restaurar',
        rotulo: 'RESTAURAR PADRÃO',
        tipo: 'acao',
        fazer: () => ['reduzirMovimento', 'tremor', 'flashes', 'daltonismo'].forEach((k) => definirPref(k, PREFERENCIAS_PADRAO[k])),
        descricao: 'Animações e clarões normais, tremores normais e as cores originais.',
      },
    ],
  },
  {
    id: 'graficos',
    rotulo: 'GRÁFICOS',
    itens: [
      {
        id: 'graficos',
        rotulo: 'QUALIDADE',
        titulo: 'QUALIDADE DOS GRÁFICOS',
        ...opcaoPref('graficos'),
        nomes: (v) => NOMES_GRAFICOS[v],
        descricao: (v) => TEXTO_GRAFICOS[v],
      },
      {
        id: 'restaurar',
        rotulo: 'RESTAURAR PADRÃO',
        tipo: 'acao',
        fazer: () => definirPref('graficos', PREFERENCIAS_PADRAO.graficos),
        descricao: `Volta a qualidade para ${NOMES_GRAFICOS[PREFERENCIAS_PADRAO.graficos]}.`,
      },
    ],
  },
]

// cores da amostra do modo daltônico: { aviso, p1, p2 } (números), do que a
// paleta trouxer (aceita almas: [p1, p2] ou p1/p2, números ou '#rrggbb')
function coresDaPaleta(paleta) {
  const num = (c) => (typeof c === 'number' ? c : typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c) ? parseInt(c.replace('#', ''), 16) : null)
  if (!paleta || typeof paleta !== 'object') return null
  const cores = {
    aviso: num(paleta.aviso),
    p1: num(paleta.almas?.[0] ?? paleta.p1 ?? paleta.coracaoP1),
    p2: num(paleta.almas?.[1] ?? paleta.p2 ?? paleta.coracaoP2),
  }
  return Object.values(cores).some((c) => c !== null) ? cores : null
}

export default class Config extends Phaser.Scene {
  constructor() {
    super('Config')
  }

  init(dados) {
    this.sobre = dados?.sobre ?? null
    this.voltarPara = dados?.voltar ?? 'Menu'
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.apertar(botao))
    this.controles.onPausa(() => this.apertar('C'))
    this.aba = Phaser.Math.Clamp(this.registry.get('configAba') ?? 0, 0, ABAS.length - 1)
    this.foco = 'abas' // 'abas' | 'lista'
    this.indice = 0
    this.jogadorTeclas = 'p1'
    this.esperando = null // { acao, cancelar } enquanto espera a nova tecla
    this.aviso = null // { texto, cor } no pé do painel da direita
    this.saindo = false
    this.segurando = null
    this.layout = null // nomes das teclas do teclado de quem joga (Chrome)

    if (this.sobre) {
      this.scene.bringToTop() // por cima da cena de onde veio (a Pausa também foi trazida para frente)
      const veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setAlpha(0)
      this.tweens.add({ targets: veu, alpha: 0.88, duration: 140 })
    } else {
      this.fundo = criarFundo(this, 'queen')
      this.fundo.escurecer()
      this.cameras.main.fadeIn(220)
    }

    this.tela = this.add.container(0, 0)
    this.montarMoldura()
    this.montarAbas()
    this.montarLista()
    this.montarPainel()
    this.rodape = this.add.container(0, 0)
    this.tela.add(this.rodape)
    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0])
    this.tela.add(this.cursor)

    this.tela.setAlpha(0)
    this.tweens.add({ targets: this.tela, alpha: 1, duration: 160 })

    // fora daqui as coisas também mudam: tela cheia (F, Esc do navegador) e preferências
    const redesenhar = () => this.desenhar()
    document.addEventListener('fullscreenchange', redesenhar)
    const pararPref = aoMudarPref(redesenhar)
    this.events.once('shutdown', () => {
      document.removeEventListener('fullscreenchange', redesenhar)
      pararPref()
      this.esperando?.cancelar()
      this.esperando = null
    })
    navigator.keyboard
      ?.getLayoutMap?.()
      .then((mapa) => {
        this.layout = mapa
        if (this.sys.isActive()) this.desenhar()
      })
      .catch(() => {})

    this.desenhar()
  }

  // ---------- montagem ----------

  texto(x, y, conteudo, tamanho, cor = COR.texto, extra = {}) {
    const t = this.add.text(x, y, conteudo, {
      fontFamily: FONTE,
      fontSize: `${tamanho}px`,
      color: cor,
      stroke: '#000000',
      strokeThickness: tamanho >= 18 ? 4 : 0,
      ...extra,
    })
    return t
  }

  // diminui a fonte até o texto caber em `largura` (sem passar de `minimo`)
  encaixar(t, largura, minimo = 9) {
    let tamanho = parseInt(t.style.fontSize, 10)
    while (t.width > largura && tamanho > minimo) t.setFontSize(--tamanho)
    return t
  }

  caixa(g, x, y, largura, altura, borda = COR.borda, fundo = CORES.painel, alfa = 0.94) {
    g.fillStyle(fundo, alfa).fillRect(x, y, largura, altura)
    g.lineStyle(3, borda, 1).strokeRect(x + 1.5, y + 1.5, largura - 3, altura - 3)
  }

  montarMoldura() {
    const titulo = this.texto(TITULO.x, TITULO.y, 'CONFIGURAÇÕES', 24, TEXTO.selecionado)
    const sub = this.texto(LARGURA - TITULO.x, TITULO.y + 10, this.sobre ? 'JOGO PAUSADO' : '', 11, COR.apagado).setOrigin(1, 0)
    const g = this.add.graphics()
    this.caixa(g, LISTA.x, LISTA.y, LISTA.largura, LISTA.altura)
    this.caixa(g, PAINEL.x, PAINEL.y, PAINEL.largura, PAINEL.altura)
    g.lineStyle(1, 0xffffff, 0.15).lineBetween(LISTA.x, RODAPE.linha, PAINEL.x + PAINEL.largura, RODAPE.linha)
    this.tela.add([g, titulo, sub])
  }

  // abas lado a lado ocupando a largura toda; a fonte encolhe se não couber
  montarAbas() {
    this.gAbas = this.add.graphics()
    this.tela.add(this.gAbas)
    const disponivel = ABAS_UI.direita - ABAS_UI.esquerda - ABAS_UI.folga * (ABAS.length - 1)
    let tamanho = 15
    let textos
    for (;;) {
      textos?.forEach((t) => t.destroy())
      textos = ABAS.map((a) => this.texto(0, ABAS_UI.y, a.rotulo, tamanho).setOrigin(0, 0.5))
      const soma = textos.reduce((s, t) => s + t.width + ABAS_UI.recuo + 10, 0)
      if (soma <= disponivel || tamanho <= 10) break
      tamanho--
    }
    const sobra = disponivel - textos.reduce((s, t) => s + t.width + ABAS_UI.recuo + 10, 0)
    const extra = Math.max(0, sobra / ABAS.length)
    let x = ABAS_UI.esquerda
    this.abas = ABAS.map((a, i) => {
      const largura = Math.round(textos[i].width + ABAS_UI.recuo + 10 + extra)
      const t = textos[i].setX(Math.round(x + ABAS_UI.recuo + (largura - ABAS_UI.recuo - 10 - textos[i].width) / 2))
      const aba = { x, largura, texto: t }
      x += largura + ABAS_UI.folga
      return aba
    })
    this.tela.add(textos)
  }

  // as linhas da aba atual (recriadas a cada troca de aba)
  montarLista() {
    this.camadaLista?.destroy()
    this.camadaLista = this.add.container(0, 0)
    this.tela.add(this.camadaLista)
    this.realce = this.add.graphics()
    this.camadaLista.add(this.realce)
    let y = LINHA.primeira
    this.linhas = this.itens.map((item, i) => {
      if (item.tipo === 'acao' && i > 0) y += 8 // um respiro antes do "restaurar"
      const rotulo = this.texto(LISTA.x + LINHA.rotuloX, y, item.rotulo, 14).setOrigin(0, 0.5)
      const g = this.add.graphics()
      const valor = this.texto(LINHA.direita, y, '', 13).setOrigin(1, 0.5)
      this.camadaLista.add([rotulo, g, valor])
      const linha = { item, y, rotulo, g, valor, extras: [] }
      if (item.tipo === 'acao' && i > 0) {
        const sep = this.add.graphics().lineStyle(1, 0xffffff, 0.18).lineBetween(LISTA.x + 14, y - 20, LISTA.x + LISTA.largura - 14, y - 20)
        this.camadaLista.add(sep)
      }
      y += LINHA.passo
      return linha
    })
  }

  montarPainel() {
    const x = PAINEL.x + PAINEL.margem
    const largura = PAINEL.largura - PAINEL.margem * 2
    this.painel = {
      titulo: this.texto(x, PAINEL.y + 14, '', 15, TEXTO.selecionado, { wordWrap: { width: largura } }),
      linha: this.add.graphics(),
      corpo: this.texto(x, 0, '', 12, COR.descricao, { wordWrap: { width: largura }, lineSpacing: 4 }),
      extra: this.add.container(0, 0),
      aviso: this.texto(x, PAINEL.y + PAINEL.altura - 32, '', 12, COR.ok, { wordWrap: { width: largura }, lineSpacing: 3 }).setOrigin(0, 1),
      padrao: this.texto(x, PAINEL.y + PAINEL.altura - 12, '', 11, COR.apagado).setOrigin(0, 1),
      largura,
    }
    const p = this.painel
    this.tela.add([p.titulo, p.linha, p.corpo, p.extra, p.aviso, p.padrao])
  }

  get itens() {
    return ABAS[this.aba].itens
  }

  get item() {
    return this.foco === 'lista' ? this.itens[this.indice] : null
  }

  // ---------- valores ----------

  valoresDe(item) {
    return item.valores ?? LIGA.valores
  }

  nomeDe(item, v) {
    return item.nomes ? item.nomes(v) : LIGA.nomes(v)
  }

  teclasDe(acao) {
    return normalizarTeclas(pref('teclas'))[this.jogadorTeclas][acao]
  }

  // ←/→ (passo -1 / 1) no item em foco
  ajustar(passo) {
    const item = this.item
    if (!item) return
    if (item.tipo === 'barra') {
      const antes = item.ler(this)
      const v = Phaser.Math.Clamp(antes + passo * item.passo, item.min, item.max)
      if (v === antes) return
      item.escrever(v, this)
      tocar(this, item.som ?? 'mover')
      this.mexeu()
    } else if (item.tipo === 'opcoes') {
      this.mudarOpcao(item, passo)
    } else if (item.tipo === 'tecla') {
      // nas teclas, ←/→ troca o jogador sem sair da linha
      this.jogadorTeclas = this.jogadorTeclas === 'p1' ? 'p2' : 'p1'
      tocar(this, 'mover')
      this.mexeu()
    }
  }

  mudarOpcao(item, passo) {
    const valores = this.valoresDe(item)
    const i = valores.indexOf(item.ler(this))
    const v = valores[(i + passo + valores.length) % valores.length]
    item.escrever(v, this)
    tocar(this, 'confirmar')
    this.mexeu()
  }

  mexeu() {
    this.aviso = null
    this.desenhar()
    const linha = this.linhas[this.indice]
    if (linha && !menosMovimento()) {
      this.tweens.killTweensOf(linha.valor)
      linha.valor.setScale(1.12)
      this.tweens.add({ targets: linha.valor, scale: 1, duration: 110, ease: 'Quad.easeOut' })
    }
  }

  // ---------- botões ----------

  apertar(botao) {
    if (this.saindo) return
    if (this.esperando) {
      // no teclado, a espera engole tudo; aqui só chegam os botões do joystick
      if (botao === 'B' || botao === 'C') this.cancelarEspera()
      return
    }
    if (botao === 'C') return this.sair()
    if (botao === 'B') {
      if (this.foco === 'abas') return this.sair()
      this.foco = 'abas'
      this.aviso = null
      tocar(this, 'cancelar')
      return this.desenhar()
    }
    if (botao !== 'A') return
    if (this.foco === 'abas') return this.entrarNaLista(0)
    const item = this.item
    if (item.tipo === 'opcoes') return this.mudarOpcao(item, 1)
    if (item.tipo === 'barra') {
      if (!item.aVoltaAoPadrao || item.ler(this) === item.padrao()) return
      item.escrever(item.padrao(), this)
      tocar(this, 'confirmar')
      return this.mexeu()
    }
    if (item.tipo === 'tecla') return this.esperarTecla(item.acao)
    if (item.tipo === 'acao') {
      item.fazer(this)
      tocar(this, 'confirmar')
      this.mexeu()
      this.aviso = { texto: 'Pronto: padrão restaurado.', cor: COR.ok }
      this.desenhar()
    }
  }

  entrarNaLista(indice) {
    this.foco = 'lista'
    this.indice = indice
    this.aviso = null
    tocar(this, 'mover')
    this.desenhar()
  }

  trocarAba(passo) {
    this.aba = (this.aba + passo + ABAS.length) % ABAS.length
    this.registry.set('configAba', this.aba)
    this.indice = 0
    this.aviso = null
    tocar(this, 'mover')
    this.montarLista()
    if (!menosMovimento()) {
      this.camadaLista.setPosition(passo * 14, 0).setAlpha(0)
      this.tweens.add({ targets: this.camadaLista, x: 0, alpha: 1, duration: 150, ease: 'Quad.easeOut' })
    }
    this.desenhar()
  }

  esperarTecla(acao) {
    tocar(this, 'confirmar')
    const jogador = this.jogadorTeclas
    const cancelar = capturarTecla((code) => this.time.delayedCall(0, () => this.recebeuTecla(jogador, acao, code)))
    this.esperando = { acao, jogador, cancelar }
    this.aviso = null
    this.desenhar()
  }

  cancelarEspera() {
    this.esperando?.cancelar()
    this.esperando = null
    this.aviso = { texto: 'Cancelado: a tecla não mudou.', cor: COR.apagado }
    tocar(this, 'cancelar')
    this.desenhar()
  }

  recebeuTecla(jogador, acao, code) {
    if (!this.esperando || this.saindo) return
    if (code === 'Escape') return this.cancelarEspera()
    const atual = normalizarTeclas(pref('teclas'))
    const r = atribuirTecla(atual, jogador, acao, code)
    const quem = (j, a) => `${j.toUpperCase()} · ${ROTULO_ACAO[a]}`
    if (r.erro) {
      // continua esperando outra tecla
      tocar(this, 'erro')
      this.esperando.cancelar = capturarTecla((c) => this.time.delayedCall(0, () => this.recebeuTecla(jogador, acao, c)))
      this.aviso = { texto: `${r.erro[0].toUpperCase()}${r.erro.slice(1)}. Aperte outra.`, cor: COR.erro }
      return this.desenhar()
    }
    this.esperando = null
    definirPref('teclas', r.mapa)
    const ponto = (t) => (t.endsWith('.') ? t : `${t}.`)
    let texto = ponto(`${quem(jogador, acao)}: ${nomeTecla(code, this.layout)}`)
    if (r.tirada) {
      const outra = quem(r.tirada.jogador, r.tirada.acao)
      texto += r.tirada.trocou
        ? ` Trocou: ${ponto(`${outra} ficou com ${resumoTeclas(r.mapa[r.tirada.jogador][r.tirada.acao], this.layout)}`)}`
        : ` Ela saiu de ${outra}.`
    }
    tocar(this, 'confirmar')
    this.mexeu()
    this.aviso = { texto, cor: r.tirada ? TEXTO.selecionado : COR.ok }
    this.desenhar()
  }

  sair() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    if (this.sobre) {
      this.scene.stop()
      this.scene.resume(this.sobre)
      return
    }
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start(this.voltarPara))
  }

  // ---------- desenho ----------

  desenhar() {
    if (!this.linhas) return
    this.desenharAbas()
    this.linhas.forEach((l, i) => this.desenharLinha(l, this.foco === 'lista' && i === this.indice))
    this.desenharRealce()
    this.desenharPainel()
    this.desenharRodape()
  }

  desenharAbas() {
    const g = this.gAbas.clear()
    const naBarra = this.foco === 'abas'
    this.abas.forEach((a, i) => {
      const ativa = i === this.aba
      const y = ABAS_UI.y - ABAS_UI.altura / 2
      if (ativa) this.caixa(g, a.x, y, a.largura, ABAS_UI.altura, naBarra ? CORES.selecionado : COR.borda, CORES.painel, 0.96)
      else this.caixa(g, a.x, y, a.largura, ABAS_UI.altura, COR.bordaApagada, 0x000000, 0.6)
      a.texto.setColor(ativa ? (naBarra ? TEXTO.selecionado : COR.texto) : COR.apagado)
    })
    // ◀ ▶ nas pontas: ←/→ troca de aba
    const cor = naBarra ? CORES.selecionado : 0x707080
    this.seta(g, ABAS_UI.esquerda - 14, ABAS_UI.y, 'esquerda', 6, cor)
    this.seta(g, ABAS_UI.direita + 14, ABAS_UI.y, 'direita', 6, cor)
  }

  seta(g, x, y, direcao, t, cor, alfa = 1) {
    g.fillStyle(cor, alfa)
    const m = Math.round(t * 0.75)
    if (direcao === 'esquerda') g.fillTriangle(x - m, y, x + m, y - t, x + m, y + t)
    if (direcao === 'direita') g.fillTriangle(x + m, y, x - m, y - t, x - m, y + t)
    if (direcao === 'cima') g.fillTriangle(x, y - m, x - t, y + m, x + t, y + m)
    if (direcao === 'baixo') g.fillTriangle(x, y + m, x - t, y - m, x + t, y - m)
  }

  desenharRealce() {
    const g = this.realce.clear()
    if (this.foco !== 'lista') return
    const l = this.linhas[this.indice]
    g.fillStyle(0xffffff, 0.07).fillRect(LISTA.x + 8, l.y - 14, LISTA.largura - 16, 28)
  }

  desenharLinha(l, ativo) {
    const { item } = l
    l.extras.forEach((o) => o.destroy())
    l.extras = []
    const g = l.g.clear()
    const corRotulo = ativo ? TEXTO.selecionado : COR.texto
    l.rotulo.setColor(corRotulo).setFontSize(14)
    l.valor.setText('').setX(LINHA.direita).setColor(COR.texto)
    let esquerdaDoValor = LINHA.direita

    if (item.tipo === 'barra') {
      const v = item.ler(this)
      const mudo = item.mudo?.() ?? false
      // vaga fixa para o texto (o mais largo possível): a barra não pula quando o número muda
      const vaga = Math.max(...[item.min, item.max, item.padrao()].map((x) => l.valor.setText(item.formato(x)).width))
      l.valor.setText(item.formato(v)).setColor(mudo ? COR.apagado : COR.texto)
      const fim = LINHA.direita - vaga - 18
      const largura = BARRA.largura
      const x = fim - largura
      const frac = (v - item.min) / (item.max - item.min)
      const cheios = Math.round(frac * BARRA.segmentos)
      const seg = largura / BARRA.segmentos
      const cor = mudo ? 0x606070 : ativo ? CORES.selecionado : COR.barra
      for (let k = 0; k < BARRA.segmentos; k++) {
        g.fillStyle(k < cheios ? cor : 0xffffff, k < cheios ? 1 : 0.1)
        g.fillRect(Math.round(x + k * seg), l.y - BARRA.altura / 2, Math.max(1, Math.round(seg) - 1), BARRA.altura)
      }
      if (ativo) {
        this.seta(g, x - 9, l.y, 'esquerda', 5, v > item.min ? CORES.selecionado : 0x505060)
        this.seta(g, fim + 8, l.y, 'direita', 5, v < item.max ? CORES.selecionado : 0x505060)
      }
      esquerdaDoValor = x - 16
    } else if (item.tipo === 'opcoes') {
      const v = item.ler(this)
      const nomes = this.valoresDe(item).map((x) => this.nomeDe(item, x))
      // largura fixa (a do nome mais longo) para as setas ficarem paradas
      const vaga = Math.max(60, ...nomes.map((nome) => l.valor.setText(nome).width))
      const centro = LINHA.direita - 12 - vaga / 2
      l.valor.setText(this.nomeDe(item, v)).setOrigin(0.5, 0.5).setX(Math.round(centro))
      l.valor.setColor(item.cor ? item.cor(v) : COR.texto)
      const corSeta = ativo ? CORES.selecionado : 0x707080
      this.seta(g, centro - vaga / 2 - 10, l.y, 'esquerda', 5, corSeta)
      this.seta(g, centro + vaga / 2 + 10, l.y, 'direita', 5, corSeta)
      esquerdaDoValor = centro - vaga / 2 - 20
    } else if (item.tipo === 'tecla') {
      l.valor.setOrigin(1, 0.5)
      if (this.esperando && this.esperando.acao === item.acao && this.esperando.jogador === this.jogadorTeclas) {
        const piscando = Math.floor(this.time.now / 380) % 2 === 0
        l.valor.setText('aperte uma tecla…').setColor(piscando ? TEXTO.selecionado : COR.texto)
        esquerdaDoValor = LINHA.direita - l.valor.width - 8
      } else {
        esquerdaDoValor = this.desenharTeclas(l, this.teclasDe(item.acao), ativo)
      }
    }
    if (item.tipo !== 'opcoes') l.valor.setOrigin(1, 0.5)
    // o rótulo nunca encosta no valor
    this.encaixar(l.rotulo, esquerdaDoValor - (LISTA.x + LINHA.rotuloX) - 6)
  }

  // teclas como "teclinhas" alinhadas à direita; as que não cabem viram "+N"
  desenharTeclas(l, codes, ativo) {
    const g = l.g
    const maximo = 230
    const caps = []
    let total = 0
    for (const code of codes) {
      const t = ehSeta(code) ? null : this.texto(0, l.y, nomeTecla(code, this.layout), 11).setOrigin(0.5, 0.5)
      const largura = t ? Math.max(18, Math.ceil(t.width) + 10) : 18
      if (total + largura + (caps.length ? 4 : 0) > maximo - (code === codes[codes.length - 1] ? 0 : 22)) {
        t?.destroy()
        break
      }
      total += largura + (caps.length ? 4 : 0)
      caps.push({ code, t, largura })
    }
    let x = LINHA.direita
    const resto = codes.length - caps.length
    if (resto > 0) {
      const mais = this.texto(x, l.y, `+${resto}`, 11, COR.apagado).setOrigin(1, 0.5)
      l.extras.push(mais)
      this.camadaLista.add(mais)
      x -= mais.width + 6
    }
    for (let k = caps.length - 1; k >= 0; k--) {
      const { code, t, largura } = caps[k]
      const x0 = x - largura
      g.fillStyle(0x000000, 0.6).fillRoundedRect(x0, l.y - 9, largura, 18, 3)
      g.lineStyle(1.5, ativo ? CORES.selecionado : 0xc8c8d8, 1).strokeRoundedRect(x0, l.y - 9, largura, 18, 3)
      if (t) {
        t.setX(Math.round(x0 + largura / 2))
        l.extras.push(t)
        this.camadaLista.add(t)
      } else {
        const direcao = { ArrowUp: 'cima', ArrowDown: 'baixo', ArrowLeft: 'esquerda', ArrowRight: 'direita' }[code]
        this.seta(g, x0 + largura / 2, l.y, direcao, 4, 0xffffff)
      }
      x = x0 - 4
    }
    return x - 4
  }

  desenharPainel() {
    const p = this.painel
    p.extra.removeAll(true)
    p.linha.clear()
    const item = this.item
    const x = PAINEL.x + PAINEL.margem
    let titulo
    let corpo
    let padrao = ''
    if (this.esperando) {
      titulo = 'AGUARDANDO TECLA'
      corpo = `Aperte a nova tecla de ${this.esperando.jogador.toUpperCase()} · ${ROTULO_ACAO[this.esperando.acao]}.\n\nEsc (ou B / C no joystick) cancela.\nF, Tab, F5, F11 e F12 não servem.`
    } else if (!item) {
      const aba = ABAS[this.aba]
      titulo = aba.rotulo
      corpo = {
        audio: 'Volume da música e dos efeitos, e o som ligado ou desligado.',
        jogo: 'Velocidade do coração e tela cheia.',
        controles: 'Troque as teclas do teclado (simulador) de cada jogador. O joystick não muda.',
        acessibilidade: 'Menos tremores, clarões e animações, e cores para daltonismo.',
        graficos: 'Qualidade dos gráficos: partículas, fundos animados e filtros.',
      }[aba.id]
      corpo += '\n\nEsquerda/direita: troca de aba.\nBaixo ou A: entra na lista.'
    } else {
      titulo = item.titulo ?? item.rotulo
      const v = item.ler?.(this)
      corpo = typeof item.descricao === 'function' ? item.descricao(v) : item.descricao
      if (item.padrao && !item.semSalvar) {
        const vp = item.padrao()
        padrao = `PADRÃO: ${item.tipo === 'barra' ? item.formato(vp).replace(' (padrão)', '') : this.nomeDe(item, vp)}`
      }
    }
    p.titulo.setText(titulo).setFontSize(15)
    this.encaixar(p.titulo, p.largura, 11)
    const yLinha = p.titulo.y + p.titulo.height + 6
    p.linha.lineStyle(1, 0xffffff, 0.25).lineBetween(x, yLinha, x + p.largura, yLinha)
    p.corpo.setText(corpo).setY(yLinha + 8).setFontSize(12)
    p.padrao.setText(padrao)
    p.aviso.setText(this.aviso?.texto ?? '').setColor(this.aviso?.cor ?? COR.ok)
    p.aviso.setY(PAINEL.y + PAINEL.altura - (padrao ? 30 : 12))
    // espaço até o aviso: o corpo encolhe se precisar
    const limite = (p.aviso.text ? p.aviso.y - p.aviso.height : p.padrao.y - 16) - 10
    let tamanho = 12
    while (p.corpo.y + p.corpo.height > limite && tamanho > 9) p.corpo.setFontSize(--tamanho)
    if (item && !this.esperando) this.desenharExtra(item, p.corpo.y + p.corpo.height + 14, limite)
  }

  // o "mostruário" embaixo da descrição: valor grande, opções, teclas, cores...
  desenharExtra(item, y, limite) {
    const p = this.painel
    const x = PAINEL.x + PAINEL.margem
    const add = (...objs) => p.extra.add(objs)
    const cabe = (altura) => y + altura <= limite
    if (item.tipo === 'barra' && cabe(34)) {
      const v = item.ler(this)
      const t = this.texto(x, y, `${v}`, 28, item.mudo?.() ? COR.apagado : TEXTO.selecionado)
      const u = this.texto(x + t.width + 6, y + 12, item.unidade ?? '%', 13, COR.apagado)
      add(t, u)
      if (item.mudo?.()) add(this.texto(u.x + u.width + 10, y + 12, '(som desligado)', 11, COR.desligado))
      else if (v === item.padrao()) add(this.texto(u.x + u.width + 10, y + 12, 'PADRÃO', 11, COR.ligado))
    } else if (item.id === 'daltonismo') {
      this.desenharAmostraDaltonismo(item.ler(this), x, y, limite)
    } else if (item.id === 'graficos') {
      const v = item.ler(this)
      const g = this.add.graphics()
      add(g)
      RECURSOS_GRAFICOS.forEach((r, i) => {
        const yy = y + i * 22
        if (!cabe(i * 22 + 16)) return
        add(this.texto(x, yy, r.rotulo, 11, COR.descricao))
        for (let k = 0; k < 3; k++) {
          const cheio = k < r.niveis[v]
          g.fillStyle(cheio ? CORES.selecionado : 0xffffff, cheio ? 1 : 0.12).fillRect(x + p.largura - 42 + k * 14, yy + 2, 10, 10)
        }
      })
    } else if (item.tipo === 'opcoes' && item.valores && item.valores.length > 2) {
      // todas as opções, a atual marcada
      const v = item.ler(this)
      item.valores.forEach((op, i) => {
        if (!cabe(i * 18 + 14)) return
        const atual = op === v
        add(this.texto(x + 14, y + i * 18, this.nomeDe(item, op), 12, atual ? TEXTO.selecionado : COR.apagado))
        if (atual) add(this.add.image(x + 4, y + i * 18 + 7, 'coracao').setTint(CORES.almas[0]).setScale(0.6))
      })
    } else if (item.tipo === 'tecla') {
      const lista = resumoTeclas(this.teclasDe(item.acao), this.layout)
      const t = this.texto(x, y, `${this.jogadorTeclas.toUpperCase()} AGORA: ${lista}`, 12, TEXTO.selecionado, { wordWrap: { width: p.largura } })
      add(t)
      const notas = []
      notas.push('Esquerda/direita troca o jogador. O joystick (porta serial) não é remapeável.')
      if (estado().fonte !== 'simulador') notas.push('Simulador desligado: as teclas valem quando ele estiver ligado (botão lá em cima).')
      const n = this.texto(x, y + t.height + 8, notas.join('\n'), 11, COR.apagado, { wordWrap: { width: p.largura }, lineSpacing: 3 })
      if (n.y + n.height <= limite) add(n)
      else n.destroy()
    }
  }

  desenharAmostraDaltonismo(modo, x, y, limite) {
    const p = this.painel
    if (!daltonismo?.paletaDaltonismo) return
    let paleta = null
    try {
      paleta = coresDaPaleta(daltonismo.paletaDaltonismo(modo))
    } catch {}
    if (!paleta) return
    const g = this.add.graphics()
    p.extra.add(g)
    const amostra = [
      { rotulo: 'AVISO', cor: paleta.aviso, forma: 'aviso' },
      { rotulo: 'P1', cor: paleta.p1, forma: 'coracao' },
      { rotulo: 'P2', cor: paleta.p2, forma: 'coracao' },
    ].filter((a) => a.cor !== null)
    if (y + 46 > limite) return
    p.extra.add(this.texto(x, y, 'AMOSTRA', 11, COR.apagado))
    amostra.forEach((a, i) => {
      const cx = x + 24 + i * 66
      const cy = y + 28
      if (a.forma === 'aviso') {
        g.fillStyle(a.cor, 0.35).fillRect(cx - 18, cy - 9, 36, 18)
        g.lineStyle(2, a.cor, 1).strokeRect(cx - 18, cy - 9, 36, 18)
      } else {
        p.extra.add(this.add.image(cx, cy, 'coracao').setTint(a.cor))
      }
      p.extra.add(this.texto(cx, cy + 14, a.rotulo, 10, COR.descricao).setOrigin(0.5, 0))
    })
  }

  // dicas de botão do rodapé, conforme o foco
  desenharRodape() {
    this.rodape.removeAll(true)
    const item = this.item
    let dicas
    if (this.esperando) dicas = [['Esc', 'Cancelar'], ['B', 'Cancelar (joystick)']]
    else if (!item) dicas = [['esqDir', 'Aba'], ['baixo', 'Entrar'], ['A', 'Entrar'], ['B', 'Sair']]
    else {
      dicas = [['cimaBaixo', 'Escolher']]
      if (item.tipo === 'barra') dicas.push(['esqDir', 'Ajustar'], ...(item.aVoltaAoPadrao ? [['A', 'Padrão']] : []))
      if (item.tipo === 'opcoes') dicas.push(['esqDir', 'Mudar'], ['A', 'Alternar'])
      if (item.tipo === 'tecla') dicas.push(['esqDir', 'Jogador'], ['A', 'Mudar tecla'])
      if (item.tipo === 'acao') dicas.push(['A', 'Confirmar'])
      dicas.push(['B', 'Abas'], ['C', 'Sair'])
    }
    const g = this.add.graphics()
    this.rodape.add(g)
    const pecas = dicas.map(([icone, rotulo]) => {
      const t = this.texto(0, RODAPE.y, rotulo, 12, COR.descricao).setOrigin(0, 0.5)
      const letra = ['A', 'B', 'C', 'Esc'].includes(icone) ? this.texto(0, RODAPE.y, icone, icone === 'Esc' ? 11 : 13, '#0b0914').setOrigin(0.5, 0.5) : null
      const larguraIcone = icone === 'Esc' ? 28 : icone === 'esqDir' || icone === 'cimaBaixo' ? 24 : 18
      this.rodape.add([t, ...(letra ? [letra] : [])])
      return { icone, t, letra, larguraIcone, largura: larguraIcone + 6 + t.width }
    })
    const espaco = 16
    const total = pecas.reduce((s, p) => s + p.largura, 0) + espaco * (pecas.length - 1)
    let x = Math.round(LARGURA / 2 - total / 2)
    for (const p of pecas) {
      const cx = x + p.larguraIcone / 2
      if (p.icone === 'esqDir') {
        this.seta(g, cx - 6, RODAPE.y, 'esquerda', 5, 0xffffff)
        this.seta(g, cx + 6, RODAPE.y, 'direita', 5, 0xffffff)
      } else if (p.icone === 'cimaBaixo') {
        this.seta(g, cx - 5, RODAPE.y, 'cima', 5, 0xffffff)
        this.seta(g, cx + 6, RODAPE.y, 'baixo', 5, 0xffffff)
      } else if (p.icone === 'baixo') {
        this.seta(g, cx, RODAPE.y, 'baixo', 5, 0xffffff)
      } else if (p.icone === 'Esc') {
        g.fillStyle(0xffffff, 1).fillRoundedRect(x, RODAPE.y - 8, p.larguraIcone, 16, 3)
        p.letra.setX(cx)
      } else {
        g.fillStyle(0xffffff, 1).fillCircle(cx, RODAPE.y, 9)
        p.letra.setX(cx)
      }
      p.t.setX(x + p.larguraIcone + 6)
      x += p.largura + espaco
    }
  }

  // ---------- quadro a quadro ----------

  update(time, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.saindo) return
    if (this.esperando) {
      // pisca o "aperte uma tecla…"
      const l = this.linhas.find((x) => x.item.acao === this.esperando.acao)
      if (l) l.valor.setColor(Math.floor(time / 380) % 2 === 0 ? TEXTO.selecionado : COR.texto)
    } else {
      for (let j = 0; j < this.controles.numJogadores; j++) this.direcao(j, this.controles.toque(j), time)
      this.repetir(time)
    }
    this.posicionarCursor(time)
  }

  direcao(j, d, time) {
    if (!d) return
    const n = this.itens.length
    if (this.foco === 'abas') {
      if (d === 'esquerda' || d === 'direita') this.trocarAba(d === 'direita' ? 1 : -1)
      if (d === 'baixo') this.entrarNaLista(0)
      if (d === 'cima') this.entrarNaLista(n - 1)
      return
    }
    if (d === 'cima' || d === 'baixo') {
      const i = this.indice + (d === 'cima' ? -1 : 1)
      if (i < 0 || i >= n) {
        // passa pela barra de abas (é o "item" de cima da lista)
        this.foco = 'abas'
        tocar(this, 'mover')
        this.aviso = null
        return this.desenhar()
      }
      this.indice = i
      this.aviso = null
      tocar(this, 'mover')
      return this.desenhar()
    }
    const passo = d === 'direita' ? 1 : -1
    this.ajustar(passo)
    this.segurando = { j, passo, proximo: time + REPETIR.espera }
  }

  // segurando ←/→ numa barra: repete
  repetir(time) {
    const s = this.segurando
    if (!s) return
    const x = this.controles.joy(s.j).x
    if (Math.sign(x) !== s.passo || Math.abs(x) < 50 || this.item?.tipo !== 'barra') this.segurando = null
    else if (time >= s.proximo) {
      this.ajustar(s.passo)
      s.proximo = time + REPETIR.intervalo
    }
  }

  posicionarCursor(time) {
    const balanco = menosMovimento() ? 0 : Math.sin(time / 180) * 2
    if (this.foco === 'abas') {
      const a = this.abas[this.aba]
      this.cursor.setPosition(a.x + 13 + balanco, ABAS_UI.y).setScale(0.85)
    } else {
      const l = this.linhas[this.indice]
      this.cursor.setPosition(LISTA.x + 20 + balanco, l.y).setScale(1)
    }
  }
}
