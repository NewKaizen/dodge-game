// A VOTAÇÃO do CO-OP em rede, por cima de uma cena de escolha (ModoCoop, Selecao, Dificuldade). Regras em
// coop/votacao.js; aqui o que tem Phaser e canal (docs/coop-cartas.md "Votação do CO-OP").
//
// A cena segue sendo dona do visual (cartas, cursor, fundo); esta classe põe por cima:
//   - os votos de todos: a forma + cor de cada vaga que votou, embaixo (ou ao lado) da opção;
//   - "X/Y votaram", a barra e a contagem dos 3 últimos segundos (20 s);
//   - a apuração: o mais votado; empate (ou ninguém votou) = ROLETA entre as empatadas e a vencedora.
//
// O HOST da partida é a autoridade (como na PartyVoto e na escolha de melhoria da Expedição): conta o tempo,
// junta os votos, apura com o rng da semente da sala (o resultado vai pronto: ninguém sorteia por conta própria)
// e, depois da animação, a cena dele leva todos para a próxima tela (irParaCena).
//   convidado -> host   coopVoto {tela, opcao}
//   host -> todos       coopVotos {tela, votos: {vaga: opcao}, eleitores, restante}   (a cada voto e a cada 1 s)
//   host -> todos       coopResultado {tela, vencedora, contagem, empatadas, votos, voltas}
// Quem cai da sala perde o voto (coop/votacao.js sair). No dev: window.coopVoto (votar(opcao), estadoDebug()),
// window.coopVotoMs (relógio mais longo) e window.coopRoletaLenta (roleta mais lenta) para os testes de navegador.
//
//   new VotacaoCena(cena, { tela, opcoes, semente, caixa(i) -> {x,y,w,h}, posMarca(i, k, n) -> {x,y}, anuncioY, nomeDe(id),
//                           aoRevelar(), aoApurar(id, indice) })
//   .votar(id)  .meuVoto()  .apurando  .atualizar(delta)  .destruir()
import { canal, meuIndice, participantesDaPartida, souHostDaRede } from '../rede.js'
import { agendarFundo } from '../../lib/relogioFundo.js'
import { tocar } from '../audio.js'
import { estilhacos } from '../effects/entrada.js'
import { claraoCamera } from '../effects/flash.js'
import { fatores } from '../acessibilidade.js'
import { corDaVaga } from '../vagas.js'
import { FONTE, LARGURA, TEXTO } from '../constants.js'
import { semLigaduras } from '../campanha/texto.js'
import { desenharForma, formaDaVaga } from './marcadores.js'
import { VOTO_MS, novaVotacao, votar, sair, placar, votacaoAcabou, apurarVotacao, passosDaRoleta, restanteVoto } from './votacao.js'

const ESTADO_MS = 1000 // de quanto em quanto o host manda os votos (e o tempo) de novo
const VIGIA_MS = 250 // o host confere se acabou (tempo, todos votaram, alguém saiu) sem depender do desenho da tela
const PROFUNDIDADE = 60

export default class VotacaoCena {
  constructor(cena, cfg) {
    this.cena = cena
    this.cfg = cfg
    this.opcoes = cfg.opcoes
    this.meu = meuIndice()
    this.souHost = souHostDaRede()
    this.calmo = !fatores().piscar // "reduzir animações": sem giro na roleta
    this.apurando = false
    this.vivo = true
    this.ultimoTique = null
    this.restanteGuest = VOTO_MS
    this.votacao = novaVotacao({ tela: cfg.tela, opcoes: this.opcoes, eleitores: this.presentes(), agora: Date.now(), duracaoMs: (import.meta.env?.DEV && window.coopVotoMs) || VOTO_MS })

    this.fundoBarra = cena.add.graphics().setDepth(PROFUNDIDADE)
    this.marcas = cena.add.graphics().setDepth(PROFUNDIDADE + 1)
    this.realce = cena.add.rectangle(0, 0, 10, 10, 0xffffff, 0.12).setStrokeStyle(4, 0xffe040).setDepth(PROFUNDIDADE - 1).setVisible(false)
    // "X/Y votaram" no canto de cima (junto da barra do tempo) e o anúncio da apuração embaixo
    this.status = cena.add
      .text(LARGURA - 20, 26, '', { fontFamily: FONTE, fontSize: '13px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(1, 0.5)
      .setDepth(PROFUNDIDADE)
    this.anuncio = cena.add
      .text(LARGURA / 2, cfg.anuncioY, '', { fontFamily: FONTE, fontSize: '24px', color: '#ffe040', stroke: '#000000', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5)
      .setDepth(PROFUNDIDADE + 2)
    this.desenharTempo(VOTO_MS)
    this.desenhar()
    this.ligar()
    if (import.meta.env?.DEV) window.coopVoto = this
  }

  // as vagas que estão na sala (quem caiu e espera a volta não conta)
  presentes() {
    return participantesDaPartida()
      .filter((p) => !p.caiu)
      .map((p) => p.indice)
  }

  vagaDe(id) {
    return participantesDaPartida().find((p) => p.id === id)?.indice ?? -1
  }

  meuVoto() {
    return this.votacao.votos[this.meu] ?? null
  }

  // ---------- rede ----------

  ligar() {
    const { tela } = this.cfg
    const desligar = []
    if (this.souHost) {
      desligar.push(canal.ao('coopVoto', (d, _c, de) => d?.tela === tela && this.registrar(this.vagaDe(de), d.opcao)))
      const vigiar = () => {
        if (!this.vivo || this.apurando) return
        this.conferir()
        agendarFundo(vigiar, VIGIA_MS)
      }
      agendarFundo(vigiar, VIGIA_MS)
      const estado = () => {
        if (!this.vivo || this.apurando) return
        this.mandarVotos()
        agendarFundo(estado, ESTADO_MS)
      }
      agendarFundo(estado, ESTADO_MS)
    } else {
      desligar.push(
        canal.ao('coopVotos', (d) => {
          if (d?.tela !== tela || this.apurando) return
          // (o meu voto, que o host talvez ainda não tenha recebido, não some da tela)
          const meu = this.votacao.votos[this.meu]
          const votos = { ...(d.votos ?? {}), ...(meu != null ? { [this.meu]: meu } : {}) }
          this.votacao = { ...this.votacao, votos, eleitores: Array.isArray(d.eleitores) ? [...d.eleitores] : this.votacao.eleitores }
          if (Number.isFinite(d.restante)) this.restanteGuest = d.restante
          this.desenhar()
        }),
        canal.ao('coopResultado', (d) => d?.tela === tela && this.revelar(d)),
      )
    }
    this.desligar = () => desligar.forEach((fn) => fn())
  }

  mandarVotos() {
    if (this.apurando) return
    canal.enviar('coopVotos', null, { tela: this.cfg.tela, votos: { ...this.votacao.votos }, eleitores: [...this.votacao.eleitores], restante: restanteVoto(this.votacao, Date.now()) })
  }

  // host: o voto de uma vaga (o meu ou o que chegou)
  registrar(vaga, opcao) {
    if (this.apurando || vaga < 0) return
    const antes = this.votacao
    this.votacao = votar(this.votacao, vaga, opcao, Date.now())
    if (this.votacao === antes) return
    if (vaga !== this.meu) tocar(this.cena, 'mover')
    this.mandarVotos()
    this.desenhar()
    this.conferir()
  }

  // meu voto (A): dá para trocar até acabar o tempo
  votar(opcao) {
    if (this.apurando || !this.vivo || !this.opcoes.includes(opcao) || this.meuVoto() === opcao) return
    tocar(this.cena, 'confirmar')
    this.cfg.aoVotar?.(opcao)
    if (this.souHost) return this.registrar(this.meu, opcao)
    // (o convidado já mostra o próprio voto; o host confirma no próximo coopVotos)
    this.votacao = { ...this.votacao, votos: { ...this.votacao.votos, [this.meu]: opcao } }
    canal.enviar('coopVoto', null, { tela: this.cfg.tela, opcao })
    this.desenhar()
  }

  // host: quem saiu perde o voto; acabou (tempo ou todos votaram)? apura
  conferir() {
    if (!this.souHost || this.apurando || !this.vivo) return
    const presentes = this.presentes()
    const depois = sair(this.votacao, presentes)
    if (depois !== this.votacao) {
      this.votacao = depois
      this.mandarVotos()
      this.desenhar()
    }
    if (votacaoAcabou(this.votacao, presentes, Date.now())) this.apurarHost(presentes)
  }

  apurarHost(presentes) {
    if (this.apurando) return
    const r = apurarVotacao(this.votacao, presentes, this.cfg.semente)
    canal.enviar('coopResultado', null, { tela: this.cfg.tela, ...r })
    this.revelar(r)
  }

  // ---------- tela ----------

  desenhar() {
    const g = this.marcas
    g.clear()
    const presentes = this.presentes()
    const porOpcao = new Map(this.opcoes.map((o) => [o, []]))
    for (const [vaga, opcao] of Object.entries(this.votacao.votos)) {
      if (presentes.includes(Number(vaga)) && porOpcao.has(opcao)) porOpcao.get(opcao).push(Number(vaga))
    }
    this.opcoes.forEach((id, i) => {
      const vagas = porOpcao.get(id).sort((a, b) => a - b)
      vagas.forEach((v, k) => {
        const { x, y } = this.cfg.posMarca(i, k, vagas.length)
        g.fillStyle(0x000000, 0.7).fillCircle(x, y, 13)
        desenharForma(g, formaDaVaga(v), x, y, 9, corDaVaga(v))
        if (v === this.meu) g.lineStyle(2, 0xffffff, 1).strokeCircle(x, y, 14)
      })
    })
    if (this.apurando) return
    const { votaram, total } = placar(this.votacao, presentes)
    this.status.setText(`${votaram}/${total} votaram`).setColor(TEXTO.selecionado)
  }

  desenharTempo(restante) {
    const x = LARGURA / 2
    const y = 6
    const largura = LARGURA - 40
    const p = Math.max(0, Math.min(1, restante / VOTO_MS))
    const g = this.fundoBarra
    g.clear()
    g.fillStyle(0x000000, 0.6).fillRect(x - largura / 2 - 1, y - 1, largura + 2, 8)
    g.fillStyle(0xffffff, 0.15).fillRect(x - largura / 2, y, largura, 6)
    g.fillStyle(p < 0.3 ? 0xff5050 : 0xffe040, 1).fillRect(x - largura / 2, y, largura * p, 6)
  }

  // chamado pelo update da cena
  atualizar(delta) {
    if (this.apurando || !this.vivo) return
    // o tempo: o do host vale (o convidado acerta o dele a cada coopVotos)
    const restante = this.souHost ? restanteVoto(this.votacao, Date.now()) : (this.restanteGuest = Math.max(0, this.restanteGuest - delta))
    this.desenharTempo(restante)
    this.contagemFinal(restante)
  }

  // os 3 últimos segundos: o número grande, um tique por segundo (quem não votou corre)
  contagemFinal(restante) {
    const s = Math.ceil(restante / 1000)
    if (s > 3 || s < 1 || s === this.ultimoTique) return
    this.ultimoTique = s
    tocar(this.cena, 'contador')
    const faltou = this.meuVoto() == null
    const t = this.cena.add
      .text(LARGURA / 2, this.cfg.contagemY ?? 230, String(s), { fontFamily: FONTE, fontSize: '110px', color: faltou ? '#ff5a6e' : '#ffe14a', stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(PROFUNDIDADE + 5)
      .setAlpha(0.8)
    if (faltou) this.status.setText('VOTA LOGO!').setColor('#ff5a6e')
    if (this.calmo) return this.cena.time.delayedCall(700, () => t.destroy())
    this.cena.tweens.add({ targets: t, scale: { from: 1.6, to: 1 }, duration: 160, ease: 'Back.easeOut' })
    this.cena.tweens.add({ targets: t, alpha: 0, delay: 520, duration: 260, onComplete: () => t.destroy() })
  }

  // ---------- apuração ----------

  async revelar(r) {
    if (this.apurando || !this.vivo || !this.opcoes.includes(r?.vencedora)) return
    this.apurando = true
    this.votacao = { ...this.votacao, votos: { ...(r.votos ?? {}) } }
    this.cfg.aoRevelar?.()
    this.fundoBarra.clear()
    this.desenhar()
    const { cena } = this
    const esperar = (ms) => new Promise((ok) => cena.time.delayedCall(ms, ok))
    const empate = (r.empatadas?.length ?? 0) > 1
    this.status.setText('')
    this.anuncio.setText(semLigaduras(empate ? (Object.keys(r.votos ?? {}).length ? 'EMPATE! SORTEIO!' : 'NINGUÉM VOTOU: SORTEIO!') : 'APURAÇÃO!'))
    cena.tweens.add({ targets: this.anuncio, scale: { from: 1.4, to: 1 }, duration: 200, ease: 'Back.easeOut' })
    await esperar(350)
    if (!this.vivo) return
    if (empate && !this.calmo) await this.roleta(r, esperar)
    if (!this.vivo) return
    this.destacar(r.vencedora)
    await esperar(1100)
    if (!this.vivo) return
    this.cfg.aoApurar?.(r.vencedora, this.opcoes.indexOf(r.vencedora), r)
  }

  mostrarRealce(i) {
    const c = this.cfg.caixa(i)
    this.realce.setPosition(c.x, c.y).setSize(c.w, c.h).setVisible(true)
    this.realce.setDisplaySize(c.w, c.h)
  }

  async roleta(r, esperar) {
    tocar(this.cena, 'roletaGiro', { duracao: 1.2 })
    // (no dev, window.coopRoletaLenta = 5 alonga a roleta: os testes de navegador tiram a foto no meio dela)
    const lenta = (import.meta.env?.DEV && window.coopRoletaLenta) || 1
    let atraso = 80 * lenta
    for (const id of passosDaRoleta(r.empatadas, r.voltas)) {
      if (!this.vivo) return
      this.mostrarRealce(this.opcoes.indexOf(id))
      tocar(this.cena, 'roleta')
      await esperar(atraso)
      atraso = Math.min(300 * lenta, atraso * 1.18)
    }
    tocar(this.cena, 'roletaFim')
  }

  destacar(id) {
    const i = this.opcoes.indexOf(id)
    const c = this.cfg.caixa(i)
    this.mostrarRealce(i)
    this.realce.setStrokeStyle(5, 0xffffff).setFillStyle(0xffe040, 0.22)
    tocar(this.cena, 'impacto')
    tocar(this.cena, 'fanfarra')
    if (!this.calmo) {
      claraoCamera(this.cena.cameras.main, 120, 255, 255, 255)
      estilhacos(this.cena, c.x, c.y, { quantidade: 22, cores: [0xffe040, 0xffffff], profundidade: PROFUNDIDADE + 3, duracao: 600 })
    }
    this.anuncio.setText(semLigaduras(`VENCEU: ${this.cfg.nomeDe(id)}`)).setColor('#ffffff')
    this.cena.tweens.add({ targets: this.anuncio, scale: { from: 1.3, to: 1 }, duration: 220, ease: 'Back.easeOut' })
  }

  destruir() {
    this.vivo = false
    this.desligar?.()
    if (window.coopVoto === this) delete window.coopVoto
  }

  // testes/console
  estadoDebug() {
    return { tela: this.cfg.tela, opcoes: [...this.opcoes], votos: { ...this.votacao.votos }, eleitores: [...this.votacao.eleitores], apurando: this.apurando, host: this.souHost, meu: this.meu, restante: this.souHost ? restanteVoto(this.votacao, Date.now()) : this.restanteGuest }
  }
}
