import Phaser from 'phaser'
import Controles from '../controles.js'
import Carta from '../entities/Carta.js'
import Pista from '../pvp/Pista.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { COR_NAIPE } from '../pvp/perfil.js'
import { EFEITOS } from '../pvp/bonus/eventos/index.js'
import { ataques } from '../attacks/index.js'
import { cartasDaPagina, gruposDaPagina, tituloDaPagina, fichaDaCarta, previaDaCarta } from '../grimorio/fichas.js'
import { PAGINAS_GUIA, fichaDaArena } from '../grimorio/arenas.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CHEFES } from '../coop/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'

// GUIA (Menu -> GUIA; a cena ainda se chama 'Grimorio'): tudo para estudar
// estratégia, em duas seções que o ↑/↓ percorre em sequência:
//
// CARTAS: os 7 personagens do PvP (o mesmo baralho vale no CO-OP) e os 4
// chefes do CO-OP. A fileira de baixo tem as cartas da página (por naipe, ou
// por fase no chefe); a carta em foco aparece grande, com os números, o texto
// do PvP e o do CO-OP (no chefe: o que faz e como responder), e a caixa da
// direita roda o ataque dela em loop, com a CPU (EsquivaBot) desviando.
// Textos e prévias vêm de grimorio/fichas.js (lógica pura, testada em Node).
//
// ARENAS: uma página por arena do PvP com as rodadas bônus dela (os "supers
// de cada mapa"). O fundo da tela vira o fundo animado da arena; a fileira de
// baixo tem uma ficha por evento (primeiro os que caem em todas as arenas);
// à esquerda, o evento em foco (o que faz, como se virar, onde mais cai); à
// direita, uma janela para a arena (nome, descrição, música). A abre a prévia
// ao vivo do evento (cena GuiaBonus). Dados de grimorio/arenas.js, lidos de
// pvp/arenas.js e pvp/bonus.js (evento novo aparece sozinho).
//
//   ←/→ carta / evento (segure para correr) · ↑/↓ página · A: você desvia
//   (cartas) ou prévia ao vivo (arenas) · B: volta ao Menu (desviando: devolve
//   para a CPU)
//
// Guarda a página e o item de cada página no registry 'grimorio'.

// as páginas (PAGINAS_GUIA), na ordem do ↑/↓: cartas (personagens, chefes) e depois as arenas
const SECOES = [
  { id: 'cartas', rotulo: 'CARTAS', tipos: ['personagem', 'chefe'] },
  { id: 'arenas', rotulo: 'ARENAS', tipos: ['arena'] },
]
const secaoDe = (pagina) => SECOES.find((s) => s.tipos.includes(pagina.tipo))
// rótulo de cada grupo de abas, por cima delas
const GRUPOS_ABAS = [
  { tipo: 'personagem', rotulo: 'PERSONAGENS' },
  { tipo: 'chefe', rotulo: 'CHEFES DO CO-OP' },
  { tipo: 'arena', rotulo: 'ARENAS DO PVP · RODADAS BÔNUS' },
]

const ABAS = { y: 32, tamanho: 34, passo: 46, x: 214, folga: 16, larguraArena: 84, passoArena: 92 } // abas das páginas
const INFO = { x: 24, y: 58, largura: 380, altura: 292 } // painel da carta / evento em foco (esquerda)
const PREVIA = { x: 414, y: 58, largura: 416, altura: 292 } // painel da prévia / janela da arena (direita)
const CAIXA = { largura: 220, altura: 170 } // a mesma caixa da arena PvP
const CAMPO = { esquerda: PREVIA.x + 2, direita: PREVIA.x + PREVIA.largura - 2, topo: PREVIA.y + 20, base: PREVIA.y + PREVIA.altura - 20 }
const CARTA_GRANDE = { x: INFO.x + 54, y: INFO.y + 74, escala: 1.3 }
const FICHA_GRANDE = { x: INFO.x + 54, y: INFO.y + 66, largura: 88, altura: 104 } // o "selo" do evento em foco
const FILEIRA = { y: 404, largura: 44, passoMax: 38, esquerda: 24, direita: LARGURA - 24, folgaGrupo: 8 }
const FICHA = { largura: 58, altura: 66, passoMax: 70 } // fichas dos eventos na fileira (arenas)
const REPETIR = { espera: 320, intervalo: 85 } // segurar ←/→
const PAUSA_ENTRE_VOLTAS = 650 // ms entre uma volta da prévia e a próxima
const ESPERA_PREVIA = 260 // ms parado numa carta até a prévia começar (passar rápido não liga caixas à toa)
const VEU_ARENA = 0.55 // véu por cima do fundo da arena (menos na janela da direita)

const COR_TITULO = { pvp: '#ff3d6e', coop: '#6dd0ff' }

// cor escurecida (fundo das fichas dos eventos)
const escurecer = (cor, f) => (Math.round(((cor >> 16) & 255) * f) << 16) | (Math.round(((cor >> 8) & 255) * f) << 8) | Math.round((cor & 255) * f)

// Por que o evento não tem prévia ao vivo (os que não bagunçam a esquiva)
const SEM_PREVIA = {
  duelo: 'O duelo troca a esquiva por uma luta numa caixa só: veja numa partida do PvP.',
  malucas: 'Acontece na revelação das cartas, não na esquiva: veja numa partida do PvP.',
}

// A instância da cena é REAPROVEITADA pelo Phaser: o que a partida/abertura anterior
// deixou aqui (objetos já destruídos, flags) volta ao inicial no começo do create().
// Testado em src/game/__tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  pista: null,
  nomePagina: null,
  rotulosSecao: null,
  abas: [],
  rotulosAbas: null,
  cursorAba: null,
  molduraInfo: null,
  molduraPrevia: null,
  nomeCarta: null,
  tipoCarta: null,
  numeros: null,
  larguraNumeros: null,
  blocos: null,
  separador: null,
  rotuloPrevia: null,
  statusPrevia: null,
  placarPrevia: null,
  semAtaque: null,
  objetosCartas: null,
  fichaGrande: null,
  faixasJanela: null,
  nomeArena: null,
  subArena: null,
  descArena: null,
  musicaArena: null,
  freqArena: null,
  convite: null,
  objetosArena: null,
  indice: -1,
  cartaGrande: null,
})

export default class Grimorio extends Phaser.Scene {
  constructor() {
    super('Grimorio')
  }

  create() {
    Object.assign(this, estadoInicial())
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA(j) : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())
    this.saindo = false
    this.segurando = null
    this.controlador = null // jogador que está desviando na prévia (null = CPU)
    this.geracaoPrevia = (this.geracaoPrevia ?? 0) + 1 // só cresce: a cena é reaproveitada ao voltar
    this.previa = null
    this.esquiva = new EsquivaBot({ nivel: 'dificil' })
    this.placar = { acertos: 0, dano: 0, grazes: 0 }
    this.fundo = null
    this.fundoId = null
    this.fichaArena = null

    const salvo = this.registry.get('grimorio') ?? {}
    this.indicePagina = Phaser.Math.Clamp(salvo.pagina ?? 0, 0, PAGINAS_GUIA.length - 1)
    this.indices = { ...(salvo.indices ?? {}) } // item em foco de cada página

    this.veu = this.add.graphics().setDepth(-4)
    this.montarTopo()
    this.montarPaineis()
    this.montarJanela()
    this.montarPista()
    this.ajuda = this.texto(LARGURA / 2, ALTURA - 11, '', 11, TEXTO.desabilitado, { strokeThickness: 2 }).setOrigin(0.5) // contorno: o fundo das arenas é claro

    this.itens = [] // cartas (Carta) ou fichas de evento da fileira de baixo
    this.rotulosGrupo = []
    this.abrirPagina(this.indicePagina, { animar: false })

    // objetos de fora da caixa não aparecem na câmera de recorte dela (como na PvpArena)
    this.events.on('postupdate', this.filtrarCaixas, this)
    const aoMudar = (_, valor, anterior) => valor !== anterior && !this.saindo && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => {
      this.saindo = true
      this.geracaoPrevia++ // a volta da prévia em andamento para de se repetir
      this.events.off('postupdate', this.filtrarCaixas, this)
      this.registry.events.off('changedata-numJogadores', aoMudar)
      this.pista?.destruir()
      this.pista = null
      this.fundo?.destruir()
      this.fundo = null
      if (window.grimorio === this) delete window.grimorio
    })
    if (import.meta.env.DEV) window.grimorio = this

    this.cameras.main.fadeIn(220)
  }

  texto(x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
  }

  get pagina() {
    return PAGINAS_GUIA[this.indicePagina]
  }

  get ehArena() {
    return this.pagina.tipo === 'arena'
  }

  get cartaAtual() {
    return this.ehArena ? null : (this.itens[this.indice]?.dados ?? null)
  }

  get eventoAtual() {
    return this.ehArena ? (this.itens[this.indice]?.dados ?? null) : null
  }

  // cor do personagem / do chefe / da arena da página
  corDaPagina(pagina = this.pagina) {
    if (pagina.tipo === 'arena') return fichaDaArena(pagina.id).cor
    return pagina.tipo === 'chefe' ? CHEFES[pagina.id].tema.cor : (PERSONAGENS[pagina.id]?.cor ?? 0xffffff)
  }

  // ---------- montagem ----------

  montarTopo() {
    const titulo = this.texto(24, 5, 'GUIA', 24, TEXTO.selecionado, { strokeThickness: 4 })
    this.nomePagina = this.texto(25, 34, '', 13, TEXTO.normal)
    // as seções ao lado do título: a da página atual acende
    const x = titulo.x + titulo.width + 12
    this.rotulosSecao = SECOES.map((s, i) => this.texto(x, 8 + i * 13, s.rotulo, 10, '#6a6a80', { strokeThickness: 2 }))

    // abas de cada seção (só as da seção atual aparecem): personagens, um
    // respiro e os chefes; as arenas são abas largas com o nome
    const t = ABAS.tamanho
    this.abas = []
    for (const secao of SECOES) {
      let x = ABAS.x
      const paginas = PAGINAS_GUIA.filter((p) => secao.tipos.includes(p.tipo))
      paginas.forEach((pagina, i) => {
        if (i > 0 && pagina.tipo !== paginas[i - 1].tipo) x += ABAS.folga
        const cor = this.corDaPagina(pagina)
        const largura = pagina.tipo === 'arena' ? ABAS.larguraArena : t
        const cx = x + largura / 2
        x += pagina.tipo === 'arena' ? ABAS.passoArena : ABAS.passo
        const moldura = this.add.rectangle(cx, ABAS.y, largura, t, CORES.painel, 0.9).setStrokeStyle(2, cor, 0.5)
        let sprite
        if (pagina.tipo === 'arena') {
          sprite = this.texto(cx, ABAS.y, fichaDaArena(pagina.id).curto, 10, corTexto(cor), { strokeThickness: 2 }).setOrigin(0.5)
          this.caber(sprite, sprite.text, 10, 1, largura - 6)
          sprite.escalaBase = 1
        } else {
          sprite = this.add.image(cx, ABAS.y, pagina.tipo === 'chefe' ? CHEFES[pagina.id].sprite : pagina.id)
          sprite.escalaBase = Math.min((t - 6) / sprite.width, (t - 6) / sprite.height)
          sprite.setScale(sprite.escalaBase)
        }
        this.abas.push({ pagina, secao: secao.id, cx, moldura, sprite, cor })
      })
    }
    this.rotulosAbas = GRUPOS_ABAS.map((g) => {
      const doGrupo = this.abas.filter((a) => a.pagina.tipo === g.tipo)
      if (!doGrupo.length) return null
      const meio = (doGrupo[0].cx + doGrupo[doGrupo.length - 1].cx) / 2
      const rotulo = this.texto(meio, ABAS.y - t / 2 - 2, g.rotulo, 9, '#9a9ab0', { strokeThickness: 2 }).setOrigin(0.5, 1)
      return { secao: secaoDe({ tipo: g.tipo }).id, rotulo }
    }).filter(Boolean)
    this.cursorAba = this.add.image(0, ABAS.y + t / 2 + 4, 'coracao').setTint(CORES.almas[0]).setScale(0.9).setAngle(180).setDepth(5)
  }

  montarPaineis() {
    const painel = (p, cor) => this.add.rectangle(p.x, p.y, p.largura, p.altura, CORES.painel, 0.9).setOrigin(0).setStrokeStyle(2, cor, 0.6)
    this.molduraInfo = painel(INFO, 0xffffff)
    this.molduraPrevia = painel(PREVIA, 0xffffff)

    // à direita da carta grande: nome, tipo e os números
    const x = INFO.x + 110
    const largura = INFO.x + INFO.largura - 8 - x
    this.nomeCarta = this.texto(x, INFO.y + 8, '', 16, TEXTO.normal, { wordWrap: { width: largura, useAdvancedWrap: true }, lineSpacing: -2 })
    this.tipoCarta = this.texto(x, 0, '', 12, TEXTO.normal)
    this.numeros = [0, 1, 2, 3].map(() => ({
      rotulo: this.texto(x, 0, '', 10, '#9a9ab0', { strokeThickness: 2 }),
      valor: this.texto(x + 50, 0, '', 11, TEXTO.normal, { strokeThickness: 2, wordWrap: { width: largura - 50, useAdvancedWrap: true } }),
    }))
    this.larguraNumeros = largura

    // embaixo: os dois textos (PvP e CO-OP; no chefe, o que faz e como responder;
    // no evento, o que acontece e como se virar)
    const larguraTexto = INFO.largura - 20
    this.blocos = [0, 1].map(() => ({
      titulo: this.texto(INFO.x + 10, 0, '', 10, TEXTO.normal, { strokeThickness: 2 }),
      corpo: this.texto(INFO.x + 10, 0, '', 11, TEXTO.normal, { strokeThickness: 0, wordWrap: { width: larguraTexto, useAdvancedWrap: true }, lineSpacing: 2 }),
    }))
    this.separador = this.add.graphics()

    // prévia: o que está rodando (em cima) e o placar da esquiva (embaixo)
    this.rotuloPrevia = this.texto(PREVIA.x + PREVIA.largura / 2, PREVIA.y + 10, '', 10, '#c8c8d8', { strokeThickness: 2 }).setOrigin(0.5)
    this.statusPrevia = this.texto(PREVIA.x + 10, PREVIA.y + PREVIA.altura - 10, '', 10, TEXTO.normal, { strokeThickness: 2 }).setOrigin(0, 0.5)
    this.placarPrevia = this.texto(PREVIA.x + PREVIA.largura - 10, PREVIA.y + PREVIA.altura - 10, '', 10, '#c8c8d8', { strokeThickness: 2 }).setOrigin(1, 0.5)
    this.semAtaque = this.texto(PREVIA.x + PREVIA.largura / 2, PREVIA.y + PREVIA.altura / 2, '', 13, '#c8c8d8', {
      align: 'center',
      wordWrap: { width: PREVIA.largura - 60, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setOrigin(0.5)
    this.objetosCartas = [this.rotuloPrevia, this.statusPrevia, this.placarPrevia, this.semAtaque]

    // evento em foco (arenas): o selo grande no lugar da carta grande
    const f = FICHA_GRANDE
    this.fichaGrande = this.add.container(f.x, f.y).setDepth(10)
    this.fichaGrande.fundo = this.add.graphics()
    this.fichaGrande.selo = this.add.image(0, -f.altura / 2 + 16, 'bonus-selo').setScale((f.largura - 8) / 160)
    this.fichaGrande.estrela = this.texto(0, 8, '★', 40, TEXTO.normal, { strokeThickness: 4 }).setOrigin(0.5)
    this.fichaGrande.numero = this.texto(0, f.altura / 2 - 12, '', 10, '#c8c8d8', { strokeThickness: 2 }).setOrigin(0.5)
    this.fichaGrande.add([this.fichaGrande.fundo, this.fichaGrande.selo, this.fichaGrande.estrela, this.fichaGrande.numero])
    this.tweens.add({ targets: this.fichaGrande.estrela, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // janela da arena (direita, nas páginas de arena): o fundo animado aparece
  // por ela; nome em cima, descrição e música embaixo e o convite da prévia
  montarJanela() {
    const p = PREVIA
    const cx = p.x + p.largura / 2
    this.faixasJanela = this.add.graphics()
    this.nomeArena = this.texto(cx, p.y + 22, '', 18, TEXTO.normal, { strokeThickness: 4 }).setOrigin(0.5)
    this.subArena = this.texto(cx, p.y + 42, 'ARENA DO PVP', 9, '#c8c8d8', { strokeThickness: 2 }).setOrigin(0.5)
    this.descArena = this.texto(p.x + 12, 0, '', 11, TEXTO.normal, { strokeThickness: 2, wordWrap: { width: p.largura - 24, useAdvancedWrap: true }, lineSpacing: 2 })
    this.musicaArena = this.texto(p.x + 12, 0, '', 10, '#9be7ff', { strokeThickness: 2 })
    this.freqArena = this.texto(p.x + 12, 0, '', 9, '#9a9ab0', { strokeThickness: 2, wordWrap: { width: p.largura - 24, useAdvancedWrap: true } })
    this.convite = this.add.container(cx, p.y + 128)
    this.convite.fundo = this.add.graphics()
    this.convite.texto = this.texto(0, 0, '', 13, TEXTO.normal, { strokeThickness: 3, align: 'center', wordWrap: { width: p.largura - 50, useAdvancedWrap: true }, lineSpacing: 3 }).setOrigin(0.5)
    this.convite.add([this.convite.fundo, this.convite.texto])
    this.objetosArena = [this.fichaGrande, this.faixasJanela, this.nomeArena, this.subArena, this.descArena, this.musicaArena, this.freqArena, this.convite]
  }

  montarPista() {
    this.pista = new Pista(this, {
      x: (CAMPO.esquerda + CAMPO.direita) / 2,
      y: (CAMPO.topo + CAMPO.base) / 2,
      largura: CAIXA.largura,
      altura: CAIXA.altura,
      jogador: 0, // coração vermelho, caixa branca (sem cor de dono)
      velocidadeMax: 300,
      dinamica: { campo: CAMPO },
    })
    this.pista.aoAcertar = (dano) => {
      this.placar.acertos++
      this.placar.dano += dano
    }
    this.pista.aoGraze = () => this.placar.grazes++
  }

  // ---------- páginas ----------

  // fundo da tela: o do Jevil (cartas) ou o da arena, com o véu de cada um
  trocarFundo(pagina) {
    const id = pagina.tipo === 'arena' ? `arena-${pagina.id}` : 'jevil'
    if (id === this.fundoId) return
    this.fundoId = id
    this.fundo?.destruir()
    this.fundo = criarFundo(this, id)
    this.veu.clear()
    if (pagina.tipo !== 'arena') return this.fundo.escurecer()
    // véu por toda a tela menos a janela da direita (lá o fundo aparece quase limpo)
    const p = PREVIA
    this.veu.fillStyle(0x000000, VEU_ARENA)
    this.veu.fillRect(0, 0, LARGURA, p.y)
    this.veu.fillRect(0, p.y + p.altura, LARGURA, ALTURA - p.y - p.altura)
    this.veu.fillRect(0, p.y, p.x, p.altura)
    this.veu.fillRect(p.x + p.largura, p.y, LARGURA - p.x - p.largura, p.altura)
    this.veu.fillStyle(0x000000, 0.12)
    this.veu.fillRect(p.x, p.y, p.largura, p.altura)
  }

  abrirPagina(indice, { animar = true, sentido = 1 } = {}) {
    this.indicePagina = (indice + PAGINAS_GUIA.length) % PAGINAS_GUIA.length
    const pagina = this.pagina
    const secao = secaoDe(pagina).id
    const arena = this.ehArena
    const cor = this.corDaPagina()
    this.fichaArena = arena ? fichaDaArena(pagina.id, { efeitos: EFEITOS }) : null
    const nome = arena ? this.fichaArena.nome : tituloDaPagina(pagina).nome.toUpperCase()
    this.nomePagina.setText(nome).setColor(corTexto(cor))
    this.caber(this.nomePagina, nome, 13, 1, ABAS.x - 22)
    this.molduraInfo.setStrokeStyle(2, arena ? 0xffffff : cor, 0.6)
    this.rotulosSecao.forEach((r, i) => {
      const sel = SECOES[i].id === secao
      r.setText(`${sel ? '▸' : ' '}${SECOES[i].rotulo}`).setColor(sel ? TEXTO.selecionado : '#6a6a80')
    })
    this.trocarFundo(pagina)
    this.mostrarModo(arena)

    this.abas.forEach((a, i) => {
      const sel = i === this.indicePagina
      const visivel = a.secao === secao
      a.moldura.setVisible(visivel).setStrokeStyle(sel ? 3 : 2, a.cor, sel ? 1 : 0.4).setFillStyle(sel ? 0x1c1830 : CORES.painel, 0.92)
      a.sprite.setVisible(visivel).setAlpha(sel ? 1 : 0.45)
      this.tweens.killTweensOf([a.moldura, a.sprite])
      this.tweens.add({ targets: a.sprite, scale: a.sprite.escalaBase * (sel ? 1.12 : 1), duration: 140, ease: 'Back.easeOut' })
    })
    this.rotulosAbas.forEach((r) => r.rotulo.setVisible(r.secao === secao))
    this.cursorAba.setX(this.abas[this.indicePagina].cx)

    // fileira nova (a velha some descendo)
    for (const c of this.itens) {
      this.tweens.killTweensOf(c)
      if (!animar) c.destroy()
      else this.tweens.add({ targets: c, y: c.y + 30, alpha: 0, duration: 140, onComplete: () => c.destroy() })
    }
    this.rotulosGrupo.forEach((r) => r.destroy())
    if (arena) this.montarFichas(animar, sentido)
    else this.montarCartas(pagina, cor, animar, sentido)

    const guardado = this.indices[pagina.id] ?? 0
    this.indice = -1
    this.focar(Phaser.Math.Clamp(guardado, 0, this.itens.length - 1), { som: false })
  }

  // liga as peças das cartas (prévia do ataque) ou as das arenas (janela)
  mostrarModo(arena) {
    this.objetosCartas.forEach((o) => o.setVisible(!arena))
    this.objetosArena.forEach((o) => o.setVisible(arena))
    this.cartaGrande?.setVisible(!arena)
    this.molduraPrevia.setFillStyle(CORES.painel, arena ? 0 : 0.9)
    if (arena) {
      this.geracaoPrevia++ // a prévia da carta para
      this.previa = null
      this.controlador = null
      this.pista.parar()
      this.pista.esconder()
      this.mostrarArena()
    }
  }

  montarCartas(pagina, cor, animar, sentido) {
    const lista = cartasDaPagina(pagina)
    const grupos = gruposDaPagina(pagina)
    const posicoes = this.posicoesDaFileira(lista.length, grupos, FILEIRA.largura, FILEIRA.passoMax)
    const corCarta = pagina.tipo === 'chefe' ? cor : undefined
    this.itens = lista.map((dados, i) => {
      const c = new Carta(this, posicoes[i], FILEIRA.y, dados, { largura: FILEIRA.largura, cor: corCarta, corFoco: CORES.selecionado }).setDepth(20 + i)
      if (animar) this.entrarNaFileira(c, i, sentido)
      return c
    })
    this.rotulosGrupo = grupos.map((g) => {
      const meio = (posicoes[g.inicio] + posicoes[g.fim]) / 2
      const naipe = lista[g.inicio].naipe
      const corGrupo = g.rotulo === '★' ? '#ffe14a' : pagina.tipo === 'chefe' ? '#c8c8d8' : corTexto(COR_NAIPE[naipe])
      return this.texto(meio, FILEIRA.y + FILEIRA.largura * 0.71 + 10, g.rotulo, 9, corGrupo, { strokeThickness: 2 }).setOrigin(0.5, 0)
    })
  }

  montarFichas(animar, sentido) {
    const { eventos, grupos } = this.fichaArena
    const posicoes = this.posicoesDaFileira(eventos.length, grupos, FICHA.largura, FICHA.passoMax)
    this.itens = eventos.map((ev, i) => {
      const f = this.criarFicha(posicoes[i], FILEIRA.y, ev).setDepth(20 + i)
      if (animar) this.entrarNaFileira(f, i, sentido)
      return f
    })
    this.rotulosGrupo = grupos.map((g) => {
      const meio = (posicoes[g.inicio] + posicoes[g.fim]) / 2
      return this.texto(meio, FILEIRA.y + FICHA.altura / 2 + 10, g.rotulo, 9, g.inicio === 0 && eventos[0].emTodas ? '#ffe14a' : '#c8c8d8', { strokeThickness: 2 }).setOrigin(0.5, 0)
    })
  }

  entrarNaFileira(obj, i, sentido) {
    obj.setAlpha(0).setY(FILEIRA.y + 26 * sentido)
    this.tweens.add({ targets: obj, y: FILEIRA.y, alpha: 1, duration: 200, delay: i * 12, ease: 'Cubic.easeOut' })
  }

  // Ficha de um evento na fileira: um cartão na cor dele com o nome. Como a
  // Carta, tem `dados` e focar(ligado)
  criarFicha(x, y, ev) {
    const { largura: l, altura: a } = FICHA
    const c = this.add.container(x, y)
    const corpo = this.add.container(0, 0)
    const g = this.add.graphics()
    const desenhar = (foco) => {
      g.clear()
      g.fillStyle(escurecer(ev.cor, foco ? 0.42 : 0.26), 1).fillRoundedRect(-l / 2, -a / 2, l, a, 6)
      g.fillStyle(ev.cor, foco ? 1 : 0.8).fillRect(-l / 2 + 4, -a / 2 + 4, l - 8, 3)
      g.lineStyle(foco ? 3 : 2, foco ? CORES.selecionado : ev.cor, foco ? 1 : 0.75).strokeRoundedRect(-l / 2, -a / 2, l, a, 6)
    }
    desenhar(false)
    const nome = this.texto(0, 3, ev.nome, 9, '#ffffff', { strokeThickness: 2, align: 'center', wordWrap: { width: l - 6 }, lineSpacing: -1 }).setOrigin(0.5)
    // nomes compridos: a fonte diminui até a palavra mais longa caber inteira (sem quebrar no meio)
    for (let t = 9; t > 6 && (nome.width > l - 4 || nome.height > a - 14); t--) nome.setFontSize(t)
    corpo.add([g, nome])
    c.add(corpo)
    c.dados = ev
    c.focar = (ligado) => {
      if (c.foco === ligado) return c
      c.foco = ligado
      desenhar(ligado)
      this.tweens.killTweensOf(corpo)
      this.tweens.add({ targets: corpo, y: ligado ? -10 : 0, scale: ligado ? 1.12 : 1, duration: 160, ease: 'Back.easeOut' })
      return c
    }
    return c
  }

  // x de cada item: um leque que cabe na tela, com um respiro entre os grupos
  posicoesDaFileira(n, grupos, largura, passoMax) {
    const larguraUtil = FILEIRA.direita - FILEIRA.esquerda - largura - FILEIRA.folgaGrupo * (grupos.length - 1)
    const passo = Math.min(passoMax, larguraUtil / Math.max(1, n - 1))
    const total = passo * (n - 1) + FILEIRA.folgaGrupo * (grupos.length - 1)
    let x = LARGURA / 2 - total / 2
    const xs = []
    grupos.forEach((g, k) => {
      if (k > 0) x += FILEIRA.folgaGrupo
      for (let i = g.inicio; i <= g.fim; i++) {
        xs[i] = x
        if (i < n - 1) x += passo
      }
    })
    return xs
  }

  focar(indice, { som = true } = {}) {
    const n = this.itens.length
    if (!n) return
    const novo = (indice + n) % n
    if (novo === this.indice) return
    const anterior = this.itens[this.indice]
    if (anterior) anterior.focar(false).setDepth(20 + this.indice)
    this.indice = novo
    this.indices[this.pagina.id] = novo
    this.registry.set('grimorio', { pagina: this.indicePagina, indices: { ...this.indices } })
    const item = this.itens[novo]
    item.focar(true).setDepth(60)
    if (som) tocar(this, 'mover')
    if (this.ehArena) {
      this.mostrarEvento(item.dados)
    } else {
      this.mostrarFicha(item.dados)
      this.prepararPrevia(item.dados)
    }
  }

  // ---------- ficha da carta em foco ----------

  mostrarFicha(dados) {
    const pagina = this.pagina
    const cor = this.corDaPagina()
    this.cartaGrande?.destroy()
    this.cartaGrande = new Carta(this, CARTA_GRANDE.x, CARTA_GRANDE.y, dados, { largura: 70, cor: pagina.tipo === 'chefe' ? cor : undefined }).setDepth(10)
    this.cartaGrande.setScale(CARTA_GRANDE.escala * 0.85)
    this.tweens.add({ targets: this.cartaGrande, scale: CARTA_GRANDE.escala, duration: 180, ease: 'Back.easeOut' })

    const ficha = fichaDaCarta(dados)
    const corTipo = dados.valor === 14 ? '#ffe14a' : corTexto(COR_NAIPE[dados.naipe])
    this.caber(this.nomeCarta, dados.nome.toUpperCase(), 16, 2)
    this.nomeCarta.setColor(corTexto(cor))
    this.tipoCarta.setText(ficha.tipo).setColor(corTipo)
    const y = this.escreverNumeros(ficha.numeros)
    this.escreverTextos(
      ficha.textos.map((t) => ({ ...t, cor: t.modo === 'chefe' ? corTexto(cor) : (COR_TITULO[t.modo] ?? TEXTO.normal) })),
      Math.max(CARTA_GRANDE.y + 50 * CARTA_GRANDE.escala + 10, y + 4),
    )
  }

  // tipo e números embaixo do nome; devolve o y onde terminaram
  escreverNumeros(numeros) {
    let y = this.nomeCarta.y + this.nomeCarta.height + 4
    this.tipoCarta.setY(y)
    y += this.tipoCarta.height + 8
    this.numeros.forEach((linha, i) => {
      const n = numeros[i]
      linha.rotulo.setText(n?.rotulo ?? '').setY(y + 1)
      linha.valor.setText(n?.valor ?? '').setY(y)
      if (n) y += linha.valor.height + 3
    })
    return y
  }

  // os textos de baixo (até dois blocos { titulo, texto, cor }), começando em `topo`
  escreverTextos(textos, topo) {
    this.separador.clear().lineStyle(1, 0xffffff, 0.15).lineBetween(INFO.x + 10, topo - 5, INFO.x + INFO.largura - 10, topo - 5)
    const base = INFO.y + INFO.altura - 6
    // a maior fonte que deixa os dois textos dentro do painel
    for (let tam = 12; tam >= 8; tam--) {
      let yy = topo
      this.blocos.forEach((b, k) => {
        const t = textos[k]
        b.titulo.setText(t?.titulo ?? '').setColor(t?.cor ?? TEXTO.normal).setFontSize(Math.max(9, tam - 1)).setY(yy)
        b.corpo.setText(t?.texto ?? '').setFontSize(tam)
        if (!t) return
        yy += b.titulo.height + 1
        b.corpo.setY(yy)
        yy += b.corpo.height + 6
      })
      if (yy - 6 <= base) break
    }
  }

  // Põe o texto em no máximo `linhas` linhas (ou na `largura`), diminuindo a fonte (até 4 px a menos)
  caber(texto, conteudo, tamanho, linhas, largura = Infinity) {
    texto.setText(conteudo)
    for (let t = tamanho; t >= tamanho - 4; t--) {
      texto.setFontSize(t)
      const alturaLinha = t * 1.25
      if (texto.height <= alturaLinha * linhas + 2 && texto.width <= largura) return
    }
  }

  // ---------- ficha do evento em foco (arenas) ----------

  mostrarEvento(ev) {
    const cor = corTexto(ev.cor)
    // o selo grande, na cor do evento
    const f = FICHA_GRANDE
    this.fichaGrande.fundo
      .clear()
      .fillStyle(escurecer(ev.cor, 0.3), 1)
      .fillRoundedRect(-f.largura / 2, -f.altura / 2, f.largura, f.altura, 10)
      .lineStyle(3, ev.cor, 1)
      .strokeRoundedRect(-f.largura / 2, -f.altura / 2, f.largura, f.altura, 10)
    this.fichaGrande.estrela.setColor(cor)
    this.fichaGrande.numero.setText(`${this.indice + 1} de ${this.itens.length}`)
    this.tweens.killTweensOf(this.fichaGrande)
    this.fichaGrande.setScale(0.88)
    this.tweens.add({ targets: this.fichaGrande, scale: 1, duration: 180, ease: 'Back.easeOut' })

    this.caber(this.nomeCarta, ev.nome, 16, 2)
    this.nomeCarta.setColor(cor)
    this.tipoCarta.setText('★ RODADA BÔNUS').setColor('#ffe14a')
    const y = this.escreverNumeros(ev.numeros)
    const textos = [{ titulo: 'O QUE ACONTECE', texto: ev.descricao, cor }]
    if (ev.dica) textos.push({ titulo: 'COMO SE VIRAR', texto: ev.dica, cor: '#9be7ff' })
    this.escreverTextos(textos, Math.max(f.y + f.altura / 2 + 12, y + 4))
    this.mostrarConvite(ev)
  }

  // a janela da direita: nome, descrição e música da arena
  mostrarArena() {
    const a = this.fichaArena
    const p = PREVIA
    const cor = corTexto(a.cor)
    this.molduraPrevia.setStrokeStyle(3, a.cor, 0.9)
    this.nomeArena.setText(a.nome).setColor(cor)
    this.caber(this.nomeArena, a.nome, 18, 1, p.largura - 20)
    // de baixo para cima: frequência, música, descrição
    let y = p.y + p.altura - 8
    this.freqArena.setText(a.frequencia)
    y -= this.freqArena.height
    this.freqArena.setY(y)
    this.musicaArena.setText(a.musica ? `♪ ${a.musica}` : '').setVisible(Boolean(a.musica))
    if (a.musica) {
      y -= this.musicaArena.height + 3
      this.musicaArena.setY(y)
    }
    this.descArena.setText(a.descricao)
    y -= this.descArena.height + 4
    this.descArena.setY(y)
    const topoBaixo = y - 8
    this.faixasJanela
      .clear()
      .fillStyle(0x000000, 0.72)
      .fillRect(p.x + 1, p.y + 1, p.largura - 2, 52)
      .fillRect(p.x + 1, topoBaixo, p.largura - 2, p.y + p.altura - 1 - topoBaixo)
      .lineStyle(1, a.cor, 0.5)
      .lineBetween(p.x + 1, p.y + 53, p.x + p.largura - 1, p.y + 53)
      .lineBetween(p.x + 1, topoBaixo, p.x + p.largura - 1, topoBaixo)
    // o convite fica no meio do que sobra da janela
    this.convite.setY((p.y + 53 + topoBaixo) / 2)
  }

  // A: VER AO VIVO (ou por que não tem prévia), no meio da janela
  mostrarConvite(ev) {
    const t = this.convite.texto
    if (ev.previa) t.setText(`A: VER AO VIVO\n${ev.nome}`).setColor(corTexto(ev.cor)).setFontSize(13)
    else t.setText(SEM_PREVIA[ev.id] ?? 'Sem prévia ao vivo: veja numa partida do PvP.').setColor('#c8c8d8').setFontSize(11)
    const l = Math.min(PREVIA.largura - 30, t.width + 28)
    const h = t.height + 16
    this.convite.fundo
      .clear()
      .fillStyle(0x000000, 0.78)
      .fillRoundedRect(-l / 2, -h / 2, l, h, 8)
      .lineStyle(2, ev.previa ? ev.cor : 0x6a6a80, 0.9)
      .strokeRoundedRect(-l / 2, -h / 2, l, h, 8)
    this.tweens.killTweensOf(this.convite)
    this.convite.setScale(1).setAlpha(1)
    if (ev.previa) this.tweens.add({ targets: this.convite, scale: 1.05, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // ---------- prévia do ataque ----------

  prepararPrevia(dados) {
    const geracao = ++this.geracaoPrevia
    this.pista.parar()
    this.previa = previaDaCarta(dados, ataques)
    this.placar = { acertos: 0, dano: 0, grazes: 0 }
    this.molduraPrevia.setStrokeStyle(2, 0xffffff, 0.6)
    if (this.previa.semAtaque) {
      this.pista.esconder()
      this.rotuloPrevia.setText('PRÉVIA DO ATAQUE')
      this.semAtaque.setText(this.previa.semAtaque).setVisible(true)
      return
    }
    this.semAtaque.setVisible(false)
    this.rotuloPrevia.setText(`PRÉVIA · ${this.previa.rotulo}`)
    this.time.delayedCall(ESPERA_PREVIA, () => this.rodarPrevia(geracao))
  }

  // Roda o ataque da carta em loop enquanto ela continuar em foco
  async rodarPrevia(geracao) {
    const previa = this.previa
    let volta = 0
    while (!this.saindo && geracao === this.geracaoPrevia) {
      this.pista.tema = previa.tema
      this.pista.velocidadeMaxBase = previa.velocidadeMax
      this.placar = { acertos: 0, dano: 0, grazes: 0 }
      this.esquiva.reiniciar()
      await this.pista.rodar(previa.criar(), { dano: previa.dano, ritmo: previa.ritmo, semente: `grimorio:${this.cartaAtual?.id}:${volta++}` })
      if (this.saindo || geracao !== this.geracaoPrevia) return
      await new Promise((resolver) => this.time.delayedCall(PAUSA_ENTRE_VOLTAS, resolver))
    }
  }

  // ---------- entrada ----------

  apertarA(jogador) {
    if (this.saindo) return
    if (this.ehArena) return this.abrirPreviaAoVivo()
    if (this.controlador !== null) return this.devolverParaCpu()
    if (this.previa?.semAtaque) return tocar(this, 'erro')
    this.controlador = jogador
    this.segurando = null
    tocar(this, 'confirmar')
  }

  // arenas: A abre a prévia ao vivo do evento em foco (cena GuiaBonus)
  abrirPreviaAoVivo() {
    const ev = this.eventoAtual
    if (!ev?.previa) return tocar(this, 'erro')
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('GuiaBonus', { arena: this.pagina.id, evento: ev.id }))
  }

  apertarB() {
    if (this.saindo) return
    if (this.controlador !== null) return this.devolverParaCpu()
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }

  devolverParaCpu() {
    this.controlador = null
    this.esquiva.reiniciar()
    tocar(this, 'cancelar')
  }

  navegar(direcao, j, time) {
    if (direcao === 'esquerda' || direcao === 'direita') {
      const passo = direcao === 'direita' ? 1 : -1
      this.focar(this.indice + passo)
      this.segurando = { j, passo, proximo: time + REPETIR.espera }
    } else if (direcao === 'cima' || direcao === 'baixo') {
      const passo = direcao === 'baixo' ? 1 : -1
      tocar(this, 'mover')
      this.abrirPagina(this.indicePagina + passo, { sentido: passo })
    }
  }

  // joystick do coração da prévia: o do jogador que pegou o controle ou o da CPU
  joyDaPrevia(delta, invertido) {
    if (this.controlador !== null) return this.controles.joy(this.controlador)
    const pista = this.pista
    const coracao = pista.coracoes[0]
    if (!pista.rodando || !coracao?.ativo) return { x: 0, y: 0 }
    return this.esquiva.joy(delta, {
      coracao,
      limites: pista.caixa.limites,
      balas: pista.balas.lista,
      zonas: pista.balas.zonas, // avisos de área (attacks/zonas.js): a CPU lê o vermelho
      velocidade: pista.velocidadeCoracao,
      fatorVelocidade: pista.balas.fatorVelocidade,
      velocidadeMax: pista.balas.velocidadeMax,
      invertido,
    })
  }

  // As câmeras de recorte das caixas desenham tudo o que não foi ignorado:
  // o que é de fora da caixa (fundo, painéis, cartas) fica só na principal
  filtrarCaixas() {
    const caixas = this.caixasDeRecorte
    if (!caixas?.length) return
    const principal = this.cameras.main.id
    let mascara = 0
    for (const caixa of caixas) mascara |= caixa.camera.id
    for (const o of this.children.list) {
      if (o.cameraFilter & principal) continue
      if ((o.cameraFilter & mascara) !== mascara) o.cameraFilter |= mascara
    }
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.saindo || !this.pista) return

    if (this.controlador === null) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d) this.navegar(d, j, time)
      }
      // segurando ←/→: corre pelas cartas
      const s = this.segurando
      if (s) {
        const x = this.controles.joy(s.j).x
        if (Math.sign(x) !== s.passo || Math.abs(x) < 50) this.segurando = null
        else if (time >= s.proximo) {
          this.focar(this.indice + s.passo)
          s.proximo = time + REPETIR.intervalo
        }
      }
    }
    this.cursorAba.setY(ABAS.y + ABAS.tamanho / 2 + 5 + Math.sin(time / 180) * 1.5)
    if (this.ehArena) return this.atualizarAjuda()

    // ♦ Q/K e cartas do chefe que invertem: valem enquanto o ataque roda (para a CPU também)
    const invertendo = Boolean(this.previa?.inverter) && this.pista.atacando
    let joy = this.joyDaPrevia(delta, invertendo)
    if (invertendo) joy = { x: -joy.x, y: -joy.y }
    this.pista.atualizar(delta, joy)

    this.atualizarTextosPrevia(time, invertendo)
  }

  atualizarTextosPrevia(time, invertendo) {
    const voce = this.controlador !== null
    const quem = this.controles.numJogadores > 1 ? ` (P${this.controlador + 1})` : ''
    if (this.previa?.semAtaque) {
      this.statusPrevia.setText('')
      this.placarPrevia.setText('')
    } else if (invertendo && Math.floor(time / 180) % 2) {
      this.statusPrevia.setText('CONTROLES INVERTIDOS!').setColor('#ff9a3a')
    } else {
      this.statusPrevia.setText(voce ? `VOCÊ DESVIA${quem}` : 'CPU DESVIANDO').setColor(voce ? TEXTO.selecionado : TEXTO.guarda)
    }
    if (!this.previa?.semAtaque) {
      const { acertos, dano, grazes } = this.placar
      this.placarPrevia.setText(`${acertos} acerto${acertos === 1 ? '' : 's'}${dano ? ` (-${dano} HP)` : ''} · ${grazes} graze${grazes === 1 ? '' : 's'}`)
    }
    this.atualizarAjuda()
  }

  atualizarAjuda() {
    let ajuda
    if (this.ehArena) ajuda = `←→ evento      ↑↓ página${this.eventoAtual?.previa ? '      A: ver ao vivo' : ''}      B: voltar`
    else if (this.controlador !== null) ajuda = 'direcional: mover o coração      A ou B: devolver para a CPU'
    else ajuda = '←→ carta      ↑↓ página      A: você desvia      B: voltar'
    if (this.ajuda.text !== ajuda) this.ajuda.setText(ajuda)
  }
}
