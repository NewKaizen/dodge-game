import Phaser from 'phaser'
import Controles from '../controles.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { semLigaduras } from '../campanha/texto.js'
import { CATALOGO_COSMETICOS, previa } from '../cosmeticos/registro.js'
import Carta from '../entities/Carta.js'

// GALERIA DE COSMÉTICOS (só para desenvolvimento): todos os cosméticos de cada tipo, com a prévia
// animada de cada um (cosmeticos/registro.js previa). No console do navegador (npm run dev):
//   window.debugGaleria()              abre a galeria
//   window.debugGaleria('efeito', 1)   abre no tipo e na página (0-based)
//
//   ESTILOS DE CARTA: 2 estilos por página, cada um com 7 cartas de amostra (naipes, Ás, figuras, ★ SUPER, nome
//   comprido e uma bloqueada); VERSOS ILUSTRADOS: 6 cartas viradas por página (0016)
//
//   ←/→ página · ↑/↓ tipo (som, efeito, lançamento, moldura, estilo, verso) · Z / A toca o próximo som ou repete os
//   lançamentos · X troca o fundo (escuro/claro/verde) para conferir a visibilidade · B / Esc sai
//   clique num som para ouvi-lo
const TIPOS = [
  { chave: 'som', titulo: 'SONS DE DANO', colunas: 6, tamanho: 64, y: 230 },
  { chave: 'efeito', titulo: 'EFEITOS DE CARTA', colunas: 4, tamanho: 150, y: 235 },
  { chave: 'lancamento', titulo: 'LANÇAMENTOS', colunas: 3, tamanho: 120, y: 235 },
  { chave: 'moldura', titulo: 'MOLDURAS ANIMADAS', colunas: 5, tamanho: 112, y: 235 },
  { chave: 'frente', titulo: 'ESTILOS DE CARTA', colunas: 2, tamanho: 70, y: 150 },
  { chave: 'verso', titulo: 'VERSOS ILUSTRADOS', colunas: 6, tamanho: 96, y: 210 },
]
// as cartas de amostra de cada estilo (todos os naipes, Ás, figuras, SUPER, nome comprido e uma bloqueada)
const AMOSTRAS = [
  { personagem: 'kris', naipe: 'copas', valor: 1, nome: 'Golpe Firme', custo: 2 },
  { personagem: 'susie', naipe: 'espadas', valor: 7, nome: 'Corte Duplo', custo: 1 },
  { personagem: 'ralsei', naipe: 'ouros', valor: 10, nome: 'Escudo de Fumaça Espessa', custo: 3 },
  { personagem: 'noelle', naipe: 'paus', valor: 4, nome: 'Armadilha de Gelo', custo: 2 },
  { personagem: 'dess', naipe: 'copas', valor: 12, nome: 'Cura Suave', custo: 2 },
  { personagem: 'berdly', naipe: 'paus', valor: 13, nome: 'Fluxo Final', custo: 4, bloqueada: true },
  { personagem: 'asriel', naipe: 'espadas', valor: 14, nome: 'Estrela Caótica', custo: 5 },
]
const FUNDOS = [0x14101f, 0xd8d4e6, 0x2f7a46]
const COR_RARIDADE = { comum: '#bdb8d0', raro: '#4fa8ff', epico: '#c86bff', lendario: '#ffd34d' }

// A instância da cena é REAPROVEITADA pelo Phaser: o que a abertura anterior deixou aqui volta ao
// inicial no começo do init() (testado em __tests__/cenasReaproveitadas.test.js).
const estadoInicial = () => ({
  aba: 0,
  pagina: 0,
  fundoIdx: 0,
  proximoSom: 0,
  fundo: null,
  titulo: null,
  rodape: null,
  conteudo: null,
  previas: null,
  controles: null,
  aoTeclar: null,
})

export default class GaleriaCosmeticos extends Phaser.Scene {
  constructor() {
    super('GaleriaCosmeticos')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.aba = Math.max(0, TIPOS.findIndex((t) => t.chave === dados?.tipo))
    this.pagina = Math.max(0, dados?.pagina ?? 0)
  }

  create() {
    this.previas = []
    this.fundo = this.add.rectangle(0, 0, LARGURA, ALTURA, FUNDOS[0]).setOrigin(0, 0).setDepth(-10)
    this.titulo = this.add.text(LARGURA / 2, 14, '', { fontFamily: FONTE, fontSize: '22px', color: '#e8e4f4', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(900)
    this.rodape = this.add.text(LARGURA / 2, ALTURA - 8, semLigaduras('←→ PÁGINA   ↑↓ TIPO   Z: TOCAR/REPETIR   X: FUNDO   B: SAIR'), { fontFamily: FONTE, fontSize: '11px', color: '#9a96b0', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(900)
    this.conteudo = this.add.container(0, 0).setDepth(800)

    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.acao() : this.sair()))
    this.controles.onPausa(() => this.sair())
    this.aoTeclar = (ev) => {
      const k = ev.code
      if (k === 'ArrowRight') this.mudarPagina(1)
      else if (k === 'ArrowLeft') this.mudarPagina(-1)
      else if (k === 'ArrowUp') this.mudarAba(-1)
      else if (k === 'ArrowDown') this.mudarAba(1)
      else if (k === 'KeyZ') this.acao()
      else if (k === 'KeyX') this.trocarFundo()
      else if (k === 'Escape') this.sair()
    }
    this.input.keyboard?.on('keydown', this.aoTeclar)
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', this.aoTeclar)
      this.limpar()
    })
    this.montar()
  }

  update() {
    this.controles?.atualizar()
    const d = this.controles?.toque(0)
    if (d === 'direita') this.mudarPagina(1)
    else if (d === 'esquerda') this.mudarPagina(-1)
    else if (d === 'cima') this.mudarAba(-1)
    else if (d === 'baixo') this.mudarAba(1)
  }

  tipo() {
    return TIPOS[this.aba]
  }

  itens() {
    return CATALOGO_COSMETICOS[this.tipo().chave]
  }

  paginas() {
    return Math.max(1, Math.ceil(this.itens().length / this.tipo().colunas))
  }

  mudarPagina(d) {
    const n = this.paginas()
    this.pagina = (((this.pagina + d) % n) + n) % n
    this.montar()
  }

  mudarAba(d) {
    this.aba = (this.aba + d + TIPOS.length) % TIPOS.length
    this.pagina = 0
    this.proximoSom = 0
    this.montar()
  }

  trocarFundo() {
    this.fundoIdx = (this.fundoIdx + 1) % FUNDOS.length
    this.fundo.setFillStyle(FUNDOS[this.fundoIdx])
    this.montar()
  }

  sair() {
    this.scene.start('Menu')
  }

  // Z: no tipo "som" toca o próximo da página; nos lançamentos repete todos
  acao() {
    if (this.tipo().chave === 'som') {
      const com = this.previas.filter((p) => p.tocar)
      if (!com.length) return
      com[this.proximoSom % com.length].tocar()
      this.proximoSom++
    } else if (this.tipo().chave === 'lancamento') {
      this.previas.forEach((p) => p.repetir?.())
    }
  }

  limpar() {
    for (const p of this.previas ?? []) p.destroy()
    this.previas = []
    this.conteudo?.removeAll(true)
  }

  // ESTILOS DE CARTA: cada linha um estilo com as cartas de amostra
  montarFrentes(pagina, t) {
    const cor = this.fundoIdx === 1 ? '#201a38' : '#e8e4f4'
    pagina.forEach((item, linha) => {
      const y = t.y + linha * 175
      const nome = this.add.text(16, y - 62, semLigaduras(`${item.nome.toUpperCase()}  ·  ${item.raridade.toUpperCase()}`), { fontFamily: FONTE, fontSize: '13px', color: COR_RARIDADE[item.raridade], stroke: '#000000', strokeThickness: 3 })
      const id = this.add.text(LARGURA - 16, y - 60, item.id, { fontFamily: 'monospace', fontSize: '9px', color: cor }).setOrigin(1, 0)
      this.conteudo.add([nome, id])
      AMOSTRAS.forEach((d, k) => {
        const carta = new Carta(this, 70 + k * 119, y + 18, { id: `galeria-${k}`, descricao: '', ...d }, { largura: t.tamanho * 1.2, frente: item.id })
        if (d.bloqueada) carta.setIndisponivel(true)
        this.previas.push({ destroy: () => carta.active && carta.destroy() })
      })
    })
  }

  // VERSOS ILUSTRADOS: cartas viradas de verdade
  montarVersos(pagina, t) {
    const larg = (LARGURA - 40) / t.colunas
    pagina.forEach((item, i) => {
      const x = 20 + larg * (i + 0.5)
      const carta = new Carta(this, x, t.y, { id: `galeria-verso-${i}`, personagem: 'kris', naipe: 'espadas', valor: 2, nome: '', custo: 0 }, { largura: t.tamanho, virada: true, arteVerso: item.id })
      this.previas.push({ destroy: () => carta.active && carta.destroy() })
      const nome = this.add.text(x, t.y + t.tamanho * 0.75 + 12, semLigaduras(item.nome.toUpperCase()), { fontFamily: FONTE, fontSize: '12px', color: this.fundoIdx === 1 ? '#201a38' : '#e8e4f4', stroke: this.fundoIdx === 1 ? '#ffffff' : '#000000', strokeThickness: 3, align: 'center', wordWrap: { width: larg - 10 } }).setOrigin(0.5, 0)
      const raridade = this.add.text(x, nome.y + nome.height + 3, semLigaduras(item.raridade.toUpperCase()), { fontFamily: FONTE, fontSize: '10px', color: COR_RARIDADE[item.raridade], stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0)
      this.conteudo.add([nome, raridade])
    })
  }

  montar() {
    this.limpar()
    const t = this.tipo()
    const lista = this.itens()
    const ini = this.pagina * t.colunas
    const pagina = lista.slice(ini, ini + t.colunas)
    this.titulo.setText(semLigaduras(`${t.titulo}   ${this.pagina + 1}/${this.paginas()}`))
    this.titulo.setColor(this.fundoIdx === 1 ? '#201a38' : '#e8e4f4')
    if (t.chave === 'frente') return this.montarFrentes(pagina, t)
    if (t.chave === 'verso') return this.montarVersos(pagina, t)
    const larg = (LARGURA - 40) / t.colunas
    pagina.forEach((item, i) => {
      const x = 20 + larg * (i + 0.5)
      const p = previa(this, t.chave, item.id, x, t.y, t.tamanho)
      this.previas.push(p)
      if (t.chave === 'som') {
        const zona = this.add.zone(x, t.y, larg - 8, 120).setInteractive({ useHandCursor: true })
        zona.on('pointerdown', () => p.tocar?.())
        this.conteudo.add(zona)
      }
      const nome = this.add.text(x, t.y + t.tamanho * 0.78 + 26, semLigaduras(item.nome.toUpperCase()), { fontFamily: FONTE, fontSize: '12px', color: this.fundoIdx === 1 ? '#201a38' : '#e8e4f4', stroke: this.fundoIdx === 1 ? '#ffffff' : '#000000', strokeThickness: 3, align: 'center', wordWrap: { width: larg - 10 } }).setOrigin(0.5, 0)
      const raridade = this.add.text(x, nome.y + nome.height + 3, semLigaduras(item.raridade.toUpperCase()), { fontFamily: FONTE, fontSize: '10px', color: COR_RARIDADE[item.raridade], stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0)
      const id = this.add.text(x, raridade.y + 14, item.id, { fontFamily: 'monospace', fontSize: '8px', color: this.fundoIdx === 1 ? '#4a4660' : '#6a6680' }).setOrigin(0.5, 0)
      this.conteudo.add([nome, raridade, id])
    })
  }
}

// só no dev: window.debugGaleria() abre a galeria a partir de qualquer tela
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.debugGaleria = (tipo, pagina) => {
    const jogo = window.debugJogo?.jogo
    const atual = jogo?.scene.getScenes(true)[0]
    if (atual) atual.scene.start('GaleriaCosmeticos', { tipo, pagina })
    else jogo?.scene.start('GaleriaCosmeticos', { tipo, pagina })
  }
}
