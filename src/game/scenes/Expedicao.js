import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../coop/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { corDaVaga } from '../vagas.js'
import { irCarregando } from '../carregando.js'
import { canal, emRede, souHostDaRede, irParaCena, meuLado, meuIndice, participantesDaPartida } from '../rede.js'
import { nomesDaPartida } from '../pvp/nomesDaPartida.js'
import { semLigaduras } from '../campanha/texto.js'
import { RELIQUIAS } from '../coop/reliquias.js'
import { desenharMapaExpedicao } from '../coop/expedicaoCena.js'
import { ETAPAS, NOME_ETAPA, VOTO_MS, dadosDaLuta, escolherReliquia, resolverVotos, votoDaCpu, curaEntreLutas, expedicaoValida } from '../coop/expedicao.js'

// EXPEDIÇÃO (docs/coop-cartas.md "Expedição"; regras em coop/expedicao.js): a tela ENTRE as lutas.
//   inicio    antes da 1ª luta: o mapa das 3 lutas e, só na primeira vez neste PC, o cartão COMO FUNCIONA
//   escolha   depois de uma vitória: o mapa, 3 cartas de melhoria, os votos (←/→ + A), o relógio e a cura
// Depois a próxima luta abre (CoopArena; com 3 ou 4 em rede, CoopArenaN) com o HP e as melhorias.
//   scene.start('Expedicao', { expedicao })   (expedicao: o estado de coop/expedicao.js)
// Votos: cada jogador vota uma vez (A trava). Maioria leva; empate: o voto de quem tem MENOS HP; o relógio
// acabou sem voto: a sugestão da CPU. Sozinho, a CPU aliada (P2) vota com bom senso.
// EM REDE: todos veem a mesma oferta (da semente). Cada PC manda o voto da sua vaga ao host (`expVoto`); o
// host junta, manda o placar (`expVotos`), decide (`expEscolha`) e abre a próxima luta em todos (irParaCena).
const MAPA_Y = 56
const CARTA = { y: 256, largura: 214, altura: 150, passo: 236 }
const HP_Y = 386
const CHAVE_VISTO = 'dodge:expedicaoVista'
const INICIO_MS = 6000 // a 1ª luta começa sozinha (o cartão de 1ª vez segura)
const RESULTADO_MS = 3400 // a escolha e a cura na tela antes da próxima luta

const jaViu = () => {
  try {
    return localStorage.getItem(CHAVE_VISTO) === '1'
  } catch {
    return true
  }
}
const marcarVisto = () => {
  try {
    localStorage.setItem(CHAVE_VISTO, '1')
  } catch {
    // sem armazenamento: o cartão aparece de novo da próxima vez
  }
}

// a instância da cena é REAPROVEITADA pelo Phaser (cenasReaproveitadas.test.js)
const estadoInicial = () => ({
  exp: null,
  n: 2,
  rede: false,
  host: true,
  minhaVaga: 0,
  cpu: null,
  locais: [],
  nomes: [],
  fundo: null,
  controles: null,
  cartas: [],
  cursores: [],
  marcas: [],
  votos: [],
  cursor: [],
  decidido: null,
  saindo: false,
  relogio: null,
  barraRelogio: null,
  textoRelogio: null,
  textoResultado: null,
  hpVisual: [],
  cartao: null,
  fecharCartao: null,
  dica: null,
  inicioEm: 0,
  log: [],
})

export default class Expedicao extends Phaser.Scene {
  constructor() {
    super('Expedicao')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.exp = expedicaoValida(dados?.expedicao) ? dados.expedicao : null
  }

  create() {
    if (!this.exp) return this.scene.start('Menu')
    this.rede = emRede()
    this.host = !this.rede || souHostDaRede()
    this.n = Math.max(2, Math.min(4, this.exp.party.length))
    this.controles = new Controles(this)
    // as vagas que votam neste PC: sozinho o P1 (o P2 é a CPU), dois no mesmo PC os dois; em rede, a minha
    if (this.rede) this.minhaVaga = this.n > 2 ? meuIndice() : meuLado()
    this.locais = this.rede ? [this.minhaVaga] : this.controles.numJogadores >= 2 ? [0, 1] : [0]
    this.cpu = !this.rede && this.controles.numJogadores < 2 ? 1 : null
    this.nomes = this.nomesDasVagas()
    this.votos = Array(this.n).fill(null)
    this.cursor = Array(this.n).fill(1)
    this.inicioEm = this.time.now
    const proxima = this.exp.fase === 'escolha' ? this.exp.no + 1 : this.exp.no
    this.fundo = criarFundo(this, CHEFES[this.exp.lutas[proxima]]?.fundo ?? 'king')
    this.fundo.escurecer()
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.35).setOrigin(0)
    this.desenharMapa()
    this.controles.onBotao((j, botao) => this.aoBotao(j, botao))
    if (this.exp.fase === 'escolha') this.montarEscolha()
    else this.montarInicio()
    if (import.meta.env.DEV) window.expedicao = this
    this.events.once('shutdown', () => {
      this.saindo = true
      if (window.expedicao === this) delete window.expedicao
    })
    musica('selecao')
    this.cameras.main.fadeIn(300)
  }

  nomesDasVagas() {
    if (this.rede && this.n > 2) return Array.from({ length: this.n }, (_, j) => participantesDaPartida().find((p) => p.indice === j)?.nome ?? `P${j + 1}`)
    return nomesDaPartida({ rede: this.rede, cpu: this.cpu, max: 10 })
  }

  texto(x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) {
    return this.add
      .text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center', ...extra })
      .setOrigin(0.5)
  }

  // ---------- o mapa (3 nós) ----------

  desenharMapa() {
    desenharMapaExpedicao(this, this.exp, { y: MAPA_Y, atual: this.exp.fase === 'escolha' ? this.exp.no + 1 : this.exp.no })
  }

  // ---------- antes da 1ª luta ----------

  montarInicio() {
    const id = this.exp.lutas[this.exp.no]
    const def = CHEFES[id]
    this.texto(LARGURA / 2, 140, this.exp.no === 0 ? '1ª LUTA: OS LACAIOS' : `${this.exp.no + 1}ª LUTA: ${NOME_ETAPA[ETAPAS[this.exp.no]]}`, 24, '#ffc070')
    this.add.image(LARGURA / 2, 236, def.sprite).setScale(ESCALA.chefe * 0.85)
    this.texto(LARGURA / 2, 318, def.nome.toUpperCase(), 18)
    this.desenharHp(this.exp.hp, false)
    this.dica = this.texto(LARGURA / 2, ALTURA - 20, this.host ? 'A: começar agora' : 'a luta começa em instantes...', 13, TEXTO.desabilitado, { strokeThickness: 2 })
    if (!jaViu()) this.abrirCartao()
    else this.time.delayedCall(INICIO_MS, () => this.comecarLuta())
  }

  // o cartão COMO FUNCIONA (3 linhas, só na primeira vez neste PC; A fecha)
  abrirCartao() {
    const c = this.add.container(LARGURA / 2, 246).setDepth(50)
    const fundo = this.add.rectangle(0, 0, 560, 178, 0x101020, 0.96).setStrokeStyle(3, 0xffa040)
    const titulo = this.texto(0, -62, 'COMO FUNCIONA A EXPEDIÇÃO', 18, '#ffc070')
    const linhas = this.texto(
      0,
      2,
      ['3 lutas seguidas: LACAIOS, TENENTE e CHEFÃO.', 'O HP passa de uma luta para a outra (cura um pouco).', 'Entre as lutas, votem 1 de 3 melhorias.'].join('\n'),
      14,
      TEXTO.normal,
      { lineSpacing: 8, strokeThickness: 3 },
    )
    const dica = this.texto(0, 66, 'A: entendi', 12, TEXTO.desabilitado, { strokeThickness: 2 })
    c.add([fundo, titulo, linhas, dica])
    c.setScale(0.6).setAlpha(0)
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' })
    this.cartao = c
    this.registrar('comoFunciona')
    const fechar = () => {
      if (!this.cartao) return
      this.cartao = null
      this.fecharCartao = null
      marcarVisto()
      tocar(this, 'confirmar')
      this.tweens.add({ targets: c, alpha: 0, scale: 0.8, duration: 160, onComplete: () => c.destroy() })
      this.time.delayedCall(INICIO_MS / 2, () => this.comecarLuta())
    }
    this.fecharCartao = fechar
    this.time.delayedCall(this.rede ? 9000 : 20000, fechar)
  }

  // ---------- a escolha entre as lutas ----------

  montarEscolha() {
    const exp = this.exp
    const proxima = exp.no + 1
    this.texto(LARGURA / 2, 125, `LUTA ${exp.no + 1} VENCIDA!  ESCOLHAM UMA MELHORIA`, 18, '#ffc070')
    this.cartas = exp.oferta.map((id, k) => this.desenharCarta(id, LARGURA / 2 + (k - 1) * CARTA.passo, CARTA.y))
    // o cursor de cada vaga local (e o da CPU, que anda sozinho)
    this.cursores = Array.from({ length: this.n }, (_, j) => {
      if (!this.locais.includes(j) && j !== this.cpu) return null
      return this.add.image(0, 0, 'coracao').setTint(corDaVaga(j)).setScale(1.3).setDepth(20)
    })
    this.marcas = Array.from({ length: this.n }, () => null)
    // o relógio
    this.barraRelogio = this.add.graphics()
    this.textoRelogio = this.texto(LARGURA / 2 + 160, 157, '', 11, TEXTO.desabilitado, { strokeThickness: 2 }).setOrigin(0, 0.5)
    this.relogio = { passou: 0, ms: VOTO_MS }
    this.textoResultado = this.texto(LARGURA / 2, 366, '', 14, '#ffe9a0', { strokeThickness: 3 }).setDepth(30)
    this.desenharHp(exp.hp, true)
    const proximoNome = exp.sorteada && proxima === 2 ? '???' : CHEFES[exp.lutas[proxima]]?.nome ?? ''
    this.texto(LARGURA / 2, 142, `depois: ${NOME_ETAPA[ETAPAS[proxima]]} (${proximoNome})`, 11, TEXTO.desabilitado, { strokeThickness: 2 }).setOrigin(0.5)
    this.dica = this.texto(LARGURA / 2, ALTURA - 12, '← → escolher     A: votar     (empate: vale o voto de quem tem menos HP)', 12, TEXTO.desabilitado, { strokeThickness: 2 })
    this.posicionarCursores()
    if (this.rede) this.ligarRede()
    if (this.cpu !== null) this.time.delayedCall(1600, () => this.votar(this.cpu, votoDaCpu(exp.oferta, { hp: exp.hp, hpMax: exp.hpMax })))
  }

  desenharCarta(id, x, y) {
    const r = RELIQUIAS[id]
    const cor = r?.cor ?? 0xffffff
    const hex = `#${cor.toString(16).padStart(6, '0')}`
    const moldura = this.add.rectangle(x, y, CARTA.largura, CARTA.altura, CORES.painel, 0.95).setStrokeStyle(3, 0x505050)
    const faixa = this.add.rectangle(x, y - CARTA.altura / 2 + 22, CARTA.largura - 6, 40, cor, 0.18)
    const icone = this.texto(x, y - CARTA.altura / 2 + 22, r?.icone ?? '?', 22, hex, { strokeThickness: 4 })
    const nome = this.texto(x, y - 12, r?.nome ?? id, 14, hex, { strokeThickness: 3 })
    const desc = this.texto(x, y + 28, r?.descricao ?? '', 12, TEXTO.normal, { strokeThickness: 3, wordWrap: { width: CARTA.largura - 26 } })
    return { id, x, y, moldura, faixa, icone, nome, desc }
  }

  // o HP de cada um embaixo: agora -> depois da cura (+35%)
  desenharHp(hp, comCura) {
    const exp = this.exp
    const max = exp.hpMax ?? Array(this.n).fill(null)
    const depois = comCura ? curaEntreLutas(hp, exp.hpMax) : hp
    const largura = 130
    const passo = this.n > 2 ? 200 : 260
    this.hpVisual = Array.from({ length: this.n }, (_, j) => {
      const x = LARGURA / 2 + (j - (this.n - 1) / 2) * passo
      const cor = corDaVaga(j)
      const nome = this.texto(x, HP_Y, `${this.nomes[j] ?? `P${j + 1}`}  (${exp.party[j] ?? ''})`.toUpperCase(), 11, `#${cor.toString(16).padStart(6, '0')}`, { strokeThickness: 3 })
      const g = this.add.graphics()
      const a = hp?.[j]
      const m = max[j]
      const fr = (v) => (m ? Math.max(0, Math.min(1, v / m)) : 1)
      const desenhar = (v) => {
        g.clear()
        g.fillStyle(0x000000, 0.8).fillRect(x - largura / 2 - 2, HP_Y + 12, largura + 4, 14)
        g.fillStyle(0x3a1a20, 1).fillRect(x - largura / 2, HP_Y + 14, largura, 10)
        if (comCura && depois?.[j] != null) g.fillStyle(0x3cff6a, 0.35).fillRect(x - largura / 2, HP_Y + 14, largura * fr(depois[j]), 10)
        g.fillStyle(v != null && m && v / m < 0.3 ? 0xff5050 : 0xffd23a, 1).fillRect(x - largura / 2, HP_Y + 14, largura * (v == null ? 1 : fr(v)), 10)
      }
      desenhar(a)
      const valor = a == null ? 'HP cheio' : `HP ${a}/${m}`
      const texto = this.texto(x, HP_Y + 38, valor, 11, TEXTO.normal, { strokeThickness: 3 })
      const ganho = depois?.[j] != null && a != null ? depois[j] - Math.max(0, a) : 0
      const cura = comCura && a != null ? this.texto(x, HP_Y + 54, ganho > 0 ? `+${ganho} de HP na próxima luta${a <= 0 ? ' (volta!)' : ''}` : 'HP cheio', 10, '#7dff9a', { strokeThickness: 3 }) : null
      return { nome, g, texto, cura, desenhar, antes: a, depois: depois?.[j] ?? null, max: m }
    })
  }

  posicionarCursores() {
    this.cursores.forEach((c, j) => {
      if (!c) return
      const k = this.votos[j] ?? this.cursor[j]
      const carta = this.cartas[k]
      if (!carta) return
      const ordem = [...this.locais, this.cpu].filter((x) => x != null).indexOf(j)
      c.setPosition(carta.x - 16 + ordem * 32, carta.y - CARTA.altura / 2 - 14)
      c.setAlpha(this.votos[j] == null ? 1 : 0.35)
    })
    this.cartas.forEach((carta, k) => {
      const alguem = this.locais.some((j) => this.votos[j] == null && this.cursor[j] === k)
      carta.moldura.setStrokeStyle(alguem ? 4 : 3, alguem ? CORES.selecionado : 0x505050)
    })
  }

  // os votos de todos embaixo de cada carta (corações cheios na cor de quem votou)
  desenharVotos() {
    this.marcas.forEach((m) => m?.destroy())
    this.marcas = this.votos.map((v, j) => {
      if (v == null) return null
      const carta = this.cartas[v]
      const mesmos = this.votos.slice(0, j).filter((x) => x === v).length
      const total = this.votos.filter((x) => x === v).length
      return this.add
        .image(carta.x + (mesmos - (total - 1) / 2) * 26, carta.y + CARTA.altura / 2 + 16, 'coracao')
        .setTint(corDaVaga(j))
        .setScale(1.4)
        .setDepth(20)
    })
  }

  votar(j, k) {
    if (this.decidido || this.votos[j] != null || !this.cartas[k]) return
    if (this.rede && !this.host) {
      // o convidado manda ao host (o placar volta com expVotos)
      if (j !== this.minhaVaga) return
      this.votos[j] = k
      canal.enviar('expVoto', null, { s: this.exp.semente, no: this.exp.no, j, voto: k })
    } else this.votos[j] = k
    tocar(this, 'confirmar')
    this.registrar(`voto:${j}>${k}`)
    this.desenharVotos()
    this.posicionarCursores()
    if (this.rede && this.host) this.mandarVotos()
    if (this.host && this.votos.every((v) => v != null)) this.time.delayedCall(450, () => this.decidir())
  }

  // o host decide (todos votaram ou o relógio acabou)
  decidir() {
    if (!this.host || this.decidido) return
    const exp = this.exp
    const sugestao = votoDaCpu(exp.oferta, { hp: exp.hp, hpMax: exp.hpMax })
    const r = resolverVotos(this.votos, { hp: exp.hp ?? exp.hpMax, hpMax: exp.hpMax, sugestao })
    if (this.rede) canal.enviar('expEscolha', null, { s: exp.semente, no: exp.no, escolha: r.escolha, motivo: r.motivo, desempate: r.desempate ?? null, votos: [...this.votos] })
    this.mostrarEscolha(r)
  }

  mostrarEscolha({ escolha, motivo, desempate = null }) {
    if (this.decidido) return
    const exp = this.exp
    const id = exp.oferta[escolha]
    this.decidido = { escolha, motivo, id }
    this.registrar(`escolha:${id}:${motivo}`)
    this.cursores.forEach((c) => c?.setVisible(false))
    this.barraRelogio?.clear()
    this.textoRelogio?.setText('')
    tocar(this, 'rodada')
    this.cartas.forEach((c, k) => {
      if (k === escolha) {
        c.moldura.setStrokeStyle(5, 0xffd23a)
        this.tweens.add({ targets: [c.moldura, c.faixa, c.icone, c.nome, c.desc], scale: 1.08, duration: 220, ease: 'Back.easeOut' })
      } else [c.moldura, c.faixa, c.icone, c.nome, c.desc].forEach((o) => o.setAlpha(0.3))
    })
    const nome = RELIQUIAS[id]?.nome ?? id
    const porque = motivo === 'empate' ? `EMPATE: vale o voto de ${this.nomes[desempate] ?? `P${desempate + 1}`} (menos HP)` : motivo === 'tempo' ? 'O TEMPO ACABOU: a sugestão da CPU' : 'A MAIORIA ESCOLHEU'
    this.textoResultado.setText(semLigaduras(`${porque}: ${nome}`))
    // a cura: as barras sobem até o "depois"
    this.time.delayedCall(700, () => {
      tocar(this, 'cura')
      this.hpVisual.forEach((h) => {
        if (h.antes == null || h.depois == null) return
        this.tweens.addCounter({ from: h.antes, to: h.depois, duration: 900, ease: 'Quad.easeOut', onUpdate: (tw) => h.desenhar(Math.round(tw.getValue())), onComplete: () => h.texto.setText(semLigaduras(`HP ${h.depois}/${h.max}`)) })
      })
    })
    this.exp = escolherReliquia(exp, id)
    if (this.host) this.time.delayedCall(RESULTADO_MS, () => this.comecarLuta())
  }

  // ---------- rede ----------

  ligarRede() {
    const minha = (d) => d?.s === this.exp.semente && d?.no === this.exp.no
    const desligar = this.host
      ? [
          canal.ao('expVoto', (d) => {
            if (!minha(d) || !Number.isInteger(d.j) || d.j <= 0 || d.j >= this.n || d.j === this.minhaVaga) return
            this.votar(d.j, d.voto)
          }),
        ]
      : [
          canal.ao('expVotos', (d) => {
            if (!minha(d) || this.decidido || !Array.isArray(d.votos)) return
            d.votos.forEach((v, j) => {
              if (j !== this.minhaVaga || this.votos[j] == null) this.votos[j] = Number.isInteger(v) ? v : null
            })
            this.desenharVotos()
            this.posicionarCursores()
          }),
          canal.ao('expEscolha', (d) => {
            if (!minha(d) || !Number.isInteger(d.escolha)) return
            if (Array.isArray(d.votos)) this.votos = d.votos.map((v) => (Number.isInteger(v) ? v : null))
            this.desenharVotos()
            this.mostrarEscolha(d)
          }),
        ]
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
  }

  mandarVotos() {
    canal.enviar('expVotos', null, { s: this.exp.semente, no: this.exp.no, votos: [...this.votos] })
  }

  // ---------- a próxima luta ----------

  comecarLuta() {
    if (this.saindo || !this.host) return
    this.saindo = true
    const exp = { ...this.exp, inicio: this.exp.inicio ?? Date.now() }
    const dados = dadosDaLuta(exp)
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(300, 0, 0, 0)
    const arena = this.n > 2 ? 'CoopArenaN' : 'CoopArena'
    this.time.delayedCall(320, () => (this.rede ? irParaCena(this, arena, dados) : irCarregando(this, arena, dados)))
  }

  aoBotao(j, botao) {
    if (this.saindo) return
    if (this.fecharCartao) return botao === 'A' && this.fecharCartao()
    if (this.exp.fase !== 'escolha' && !this.decidido) {
      if (botao === 'A' && this.host && this.exp.no === 0) this.comecarLuta()
      return
    }
    if (botao !== 'A' || this.decidido) return
    const vaga = this.rede ? this.minhaVaga : j
    if (!this.locais.includes(vaga)) return
    this.votar(vaga, this.cursor[vaga])
  }

  registrar(tipo) {
    this.log.push(tipo)
  }

  update(_, delta) {
    this.controles?.atualizar()
    this.fundo?.atualizar(delta)
    if (!this.exp || this.exp.fase !== 'escolha' || this.decidido) return
    // as setas de cada vaga local
    const lados = this.rede ? [meuLado()] : this.locais
    lados.forEach((lado, k) => {
      const vaga = this.rede ? this.minhaVaga : this.locais[k]
      const d = this.controles.toque(lado)
      if (!d || this.votos[vaga] != null) return
      if (d === 'esquerda' || d === 'cima') this.cursor[vaga] = (this.cursor[vaga] + 2) % 3
      if (d === 'direita' || d === 'baixo') this.cursor[vaga] = (this.cursor[vaga] + 1) % 3
      tocar(this, 'mover')
      this.posicionarCursores()
    })
    // o relógio (o host decide quando acaba; nos outros PCs só mostra)
    this.relogio.passou += delta
    const resto = Math.max(0, this.relogio.ms - this.relogio.passou)
    const g = this.barraRelogio
    g.clear()
    g.fillStyle(0x000000, 0.7).fillRect(LARGURA / 2 - 152, 153, 304, 8)
    g.fillStyle(resto < 5000 ? 0xff5050 : 0xffa040, 1).fillRect(LARGURA / 2 - 150, 155, 300 * (resto / this.relogio.ms), 4)
    this.textoRelogio.setText(`${Math.ceil(resto / 1000)} s`)
    if (resto <= 0 && this.host) this.decidir()
  }

  // (dev) o que a tela mostra, para os testes no navegador
  estadoDebug() {
    return { fase: this.exp?.fase, no: this.exp?.no, oferta: this.exp?.oferta ?? [], votos: [...this.votos], cursor: [...this.cursor], decidido: this.decidido, hp: this.exp?.hp, reliquias: this.exp?.reliquias, log: [...this.log] }
  }
}
