import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CHEFES } from '../coop/chefes/index.js'
import { ESCALA } from '../arte/texturas.js'
import { desenharCenario } from '../campanha/desenharCenario.js'
import { semLigaduras } from '../campanha/texto.js'
import { montarAvisos } from '../conta/avisos.js'
import { conta } from '../../lib/conta.js'
import { lan } from '../../lib/lan/rede.js'
import { desafioDiario, entrarNoDesafio, sairDoDesafio, conectadoAoLobby, pedirDesafio, aoCampanha } from '../../lib/campanha.js'
import { descreverDesafio } from '../../lib/desafio.js'
import { progressoDoXp, itemDoCatalogo, NOME_TIPO } from '../../lib/progresso.js'
import { textoRestante } from '../../lib/semanal.js'

// DESAFIO DIÁRIO (Fase 4A, docs/desafio-diario.md): a tela do dia. À esquerda, o desafio de hoje (o
// mesmo para todo mundo: quem você joga, o chefe, a aliada, a regra e o modificador); à direita, o seu
// recorde de hoje, a recompensa do dia, a semana (o cosmético raro com N dias vencidos, sem sequência)
// e os recordes dos amigos hoje. JOGAR abre a luta (CampanhaArena { desafio }), que o SERVIDOR roda; o
// fim volta para cá com o resultado por cima. Convidado joga, mas não ganha nada (aviso embaixo).
// O dia e a definição vêm do servidor (desafioEstado); daqui só a contagem até a virada.
//
//   ←→/↑↓ escolher · A confirmar · B voltar
//   scene.start('DesafioDiario')                   a tela
//   scene.start('DesafioDiario', { fim })          voltando da luta (campanhaFim com `desafio`)
const TINTA = '#e8e4f4'
const COR_TEXTO = { titulo: '#e8e4f4', claro: '#bdb8d0', apagado: '#6a6680', ouro: '#e0b84a', aviso: '#d0485a', ok: '#7fe08a', tema: '#8fb8c0' }
const TINTA_ECO = 0xc8b8f0
const CAIXA_ESQ = { x: 28, y: 80, largura: 396, altura: 296 }
const CAIXA_DIR = { x: 440, y: 80, largura: 386, altura: 296 }
const OPCOES = ['JOGAR', 'VOLTAR']
const SEM_SERVIDOR_MS = 6000
const DIAS = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO']
const NIVEIS = { facil: 'FÁCIL', medio: 'MÉDIO', dificil: 'DIFÍCIL' }

const MOTIVOS = {
  desafio: 'a recompensa de hoje é sua!',
  repeticao: 'a recompensa de hoje já foi: o recorde continua valendo',
  derrota: 'sem XP: vença o desafio para levar a recompensa do dia',
  convidado: 'convidado: entre com a sua conta para ganhar XP e recorde',
  suspeita: 'o servidor não confirmou esta partida: sem recompensa e sem recorde',
  abandono: 'a partida foi abandonada: sem recompensa',
  indisponivel: 'recompensas indisponíveis neste servidor (sem contas)',
  erro: 'não deu para salvar agora: o recorde pode não ter entrado',
}

const formatar = (n) => Number(n ?? 0).toLocaleString('pt-BR')

const estadoInicial = () => ({
  controles: null,
  cenario: null,
  view: null,
  relogio: null,
  retratos: null,
  fim: null,
  opcao: 0,
  sujo: true,
  saindo: false,
  pedido: false,
  abertoEm: 0,
  semServidor: false,
  pararLojas: null,
  pararCampanha: null,
  pedidoVirada: false,
})

export default class DesafioDiario extends Phaser.Scene {
  constructor() {
    super('DesafioDiario')
  }

  create(dados = {}) {
    Object.assign(this, estadoInicial())
    this.fim = dados.fim?.desafio ? dados.fim : null
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.botao(botao))
    this.controles.onPausa(() => this.botao('B'))
    this.cenario = desenharCenario(this, 'rua', { profundidade: -10, brilho: 0.75, veu: 0.35 })
    this.add.text(32, 16, 'DESAFIO DIÁRIO', { fontFamily: FONTE, fontSize: '26px', color: COR_TEXTO.titulo }).setDepth(30)
    this.relogio = this.add.text(LARGURA - 32, 22, '', { fontFamily: FONTE, fontSize: '12px', color: COR_TEXTO.ouro }).setOrigin(1, 0).setDepth(30)
    this.add.text(LARGURA - 18, ALTURA - 8, '←→ ESCOLHER   A: CONFIRMAR   B: VOLTAR', { fontFamily: FONTE, fontSize: '10px', color: COR_TEXTO.apagado }).setOrigin(1, 1).setDepth(31)
    this.view = this.add.container(0, 0).setDepth(20)
    this.retratos = this.add.container(0, 0).setDepth(21)
    montarAvisos(this)
    this.abertoEm = this.time.now
    const pararDesafio = desafioDiario.subscribe(() => (this.sujo = true))
    const pararLan = lan.subscribe(() => this.talvezPedir())
    const pararConta = conta.subscribe(() => this.talvezPedir())
    this.pararLojas = () => [pararDesafio, pararLan, pararConta].forEach((f) => f())
    // a virada recusada pelo servidor (o dia mudou): o estado novo já vem junto
    this.pararCampanha = aoCampanha((m) => {
      if (m.t === 'campanhaErro' && m.motivo === 'virou') this.sujo = true
    })
    this.events.once('shutdown', () => {
      this.pararLojas?.()
      this.pararCampanha?.()
    })
    entrarNoDesafio()
    this.pedido = conectadoAoLobby()
    musica('campanha', 'menu')
    this.cameras.main.fadeIn(menosMovimento() ? 120 : 400)
    if (this.fim) tocar(this, this.fim.resultado === 'vitoria' ? 'brilhoRank' : 'cancelar')
  }

  talvezPedir() {
    this.sujo = true
    if (this.pedido || !conectadoAoLobby()) return
    this.pedido = true
    pedirDesafio()
  }

  // ---------- desenho ----------

  t(x, y, s, tamanho, cor = TINTA, extra = {}) {
    const o = this.add.text(x, y, semLigaduras(s), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
    this.view.add(o)
    return o
  }

  caixa({ x, y, largura, altura }, borda = 0x4a4466) {
    const g = this.add.graphics()
    g.fillStyle(0x07060f, 0.9).fillRect(x, y, largura, altura)
    g.lineStyle(2, borda, 1).strokeRect(x + 1, y + 1, largura - 2, altura - 2)
    this.view.add(g)
    return g
  }

  desenhar() {
    this.sujo = false
    this.view.removeAll(true)
    this.retratos.removeAll(true)
    const e = get(desafioDiario)
    const c = get(conta)
    const pronto = e.carregado && e.desafio
    if (!pronto) {
      const msg = this.semServidor ? 'sem conexão com o servidor do jogo:\no desafio diário roda nele (online ou na LAN)' : 'conectando ao servidor…'
      this.t(LARGURA / 2, ALTURA / 2 - 20, msg, 14, this.semServidor ? COR_TEXTO.aviso : COR_TEXTO.claro, { align: 'center' }).setOrigin(0.5)
      this.desenharOpcoes(false)
      return
    }
    const def = e.desafio
    const data = new Date(`${def.id}T12:00:00Z`)
    this.t(34, 50, `${DIAS[data.getUTCDay()]}, ${String(data.getUTCDate()).padStart(2, '0')}/${String(data.getUTCMonth() + 1).padStart(2, '0')}  ·  o mesmo desafio para todo mundo hoje`, 11, COR_TEXTO.apagado)
    this.desenharDesafio(def)
    this.desenharPlacar(e, c)
    this.desenharOpcoes(true)
    // o aviso de baixo: convidado, erro do servidor
    const aviso = e.convidado ? 'Você está como convidado: dá para jogar, mas sem XP, recorde ou cosmético. Entre com a sua conta para valer.' : e.erro || (!e.disponivel ? 'Este servidor não tem contas: o desafio vale só como treino.' : '')
    if (aviso) this.t(LARGURA / 2, 446, aviso, 11, COR_TEXTO.aviso, { align: 'center', wordWrap: { width: 700 } }).setOrigin(0.5, 0)
    this.retratos.setVisible(!this.fim)
    if (this.fim) this.desenharResultado(this.fim)
  }

  desenharDesafio(def) {
    const b = CAIXA_ESQ
    this.caixa(b)
    const chefe = CHEFES[def.chefe]
    this.t(b.x + 16, b.y + 12, 'O DESAFIO DE HOJE', 13, COR_TEXTO.ouro)
    this.t(b.x + 16, b.y + 34, def.nome, 18, COR_TEXTO.titulo)
    const linhas = [
      ['VOCÊ JOGA', PERSONAGENS[def.personagem]?.nome ?? def.personagem],
      ['CONTRA', chefe?.nome ?? def.chefe],
      ['ALIADA', def.aliado ? `${PERSONAGENS[def.aliado]?.nome} (CPU)` : 'ninguém: você luta sozinho(a)'],
      ['NÍVEL', NIVEIS[def.nivel] ?? def.nivel],
    ]
    linhas.forEach(([k, v], i) => {
      this.t(b.x + 16, b.y + 70 + i * 22, k, 10, COR_TEXTO.apagado)
      this.t(b.x + 100, b.y + 68 + i * 22, v, 13, COR_TEXTO.claro)
    })
    this.t(b.x + 16, b.y + 168, descreverDesafio(def).join('\n') || 'sem regra especial hoje', 11, COR_TEXTO.tema, { wordWrap: { width: 230 }, lineSpacing: 4 })
    // os retratos: você e o eco do chefe (violeta, como na campanha)
    const voce = this.add.image(b.x + b.largura - 116, b.y + b.altura - 14, def.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem * 0.8)
    const eco = chefe ? this.add.image(b.x + b.largura - 46, b.y + b.altura - 14, chefe.sprite).setOrigin(0.5, 1).setScale(ESCALA.personagem * 0.8).setTint(TINTA_ECO).setAlpha(0.8).setFlipX(true) : null
    this.retratos.add([voce, eco].filter(Boolean))
  }

  desenharPlacar(e, c) {
    const b = CAIXA_DIR
    this.caixa(b)
    let y = b.y + 12
    const x = b.x + 16
    this.t(x, y, 'SEU RECORDE HOJE', 11, COR_TEXTO.apagado)
    this.t(b.x + b.largura - 16, y - 4, e.recorde ? formatar(e.recorde.pontos) : '—', 22, e.recorde ? COR_TEXTO.ouro : COR_TEXTO.apagado).setOrigin(1, 0)
    y += 32
    this.t(x, y, 'RECOMPENSA DO DIA', 11, COR_TEXTO.apagado)
    this.t(b.x + b.largura - 16, y, e.convidado ? 'só com conta' : e.concluido ? 'RECEBIDA' : `+${e.xp} XP ao vencer`, 13, e.concluido ? COR_TEXTO.ok : COR_TEXTO.claro).setOrigin(1, 0)
    y += 26
    // a semana: N dias vencidos (quaisquer dias de seg a dom) dão o cosmético raro
    const item = e.cosmetico
    this.t(x, y, 'COSMÉTICO DA SEMANA', 11, COR_TEXTO.apagado)
    const g = this.add.graphics()
    this.view.add(g)
    const feitos = Math.min(e.diasSemana, e.meta)
    for (let k = 0; k < e.meta; k++) {
      const cx = b.x + b.largura - 16 - (e.meta - 1 - k) * 18 - 6
      if (k < feitos) g.fillStyle(0xe0b84a, 1).fillCircle(cx, y + 7, 6)
      else g.lineStyle(2, 0x6a6680, 1).strokeCircle(cx, y + 7, 6)
    }
    y += 20
    if (item) this.t(x, y, `${e.cosmeticoGanho ? 'GANHO: ' : ''}${NOME_TIPO[item.tipo]} "${item.nome}"${e.cosmeticoGanho ? '' : `  ·  vença em ${e.meta} dias desta semana (${feitos}/${e.meta})`}`, 10, e.cosmeticoGanho ? COR_TEXTO.ok : COR_TEXTO.claro, { wordWrap: { width: b.largura - 32 } })
    y += 38
    this.t(x, y, 'AMIGOS HOJE', 11, COR_TEXTO.apagado)
    y += 18
    if (e.convidado || c.estado !== 'logado') this.t(x, y, 'entre com a sua conta para ver os amigos', 11, COR_TEXTO.apagado)
    else if (!e.amigos.length) this.t(x, y, 'nenhum amigo jogou hoje (ainda)', 11, COR_TEXTO.apagado)
    else
      e.amigos.slice(0, 6).forEach((a, i) => {
        this.t(x, y + i * 18, `${i + 1}. ${a.nome}`, 12, COR_TEXTO.claro)
        this.t(b.x + b.largura - 16, y + i * 18, formatar(a.pontos), 12, COR_TEXTO.ouro).setOrigin(1, 0)
      })
  }

  desenharOpcoes(ativo) {
    OPCOES.forEach((rotulo, i) => {
      const x = LARGURA / 2 + (i - 0.5) * 200
      const sel = i === this.opcao
      const g = this.add.graphics()
      this.view.add(g)
      const apagada = rotulo === 'JOGAR' && !ativo
      g.fillStyle(sel ? 0x1a1630 : 0x07060f, 0.95).fillRect(x - 80, 392, 160, 36)
      g.lineStyle(2, sel ? 0xe0b84a : 0x4a4466, 1).strokeRect(x - 79, 393, 158, 34)
      this.t(x, 410, rotulo, 16, apagada ? COR_TEXTO.apagado : sel ? COR_TEXTO.ouro : COR_TEXTO.claro).setOrigin(0.5)
    })
  }

  // o resultado da luta que acabou de voltar (por cima de tudo; A ou B fecha)
  desenharResultado(f) {
    const d = f.desafio
    const w = 540
    const h = 250
    const x = (LARGURA - w) / 2
    const y = 96
    const g = this.add.graphics()
    this.view.add(g)
    g.fillStyle(0x000000, 0.6).fillRect(0, 0, LARGURA, ALTURA)
    g.fillStyle(0x07060f, 0.98).fillRect(x, y, w, h)
    g.lineStyle(2, f.resultado === 'vitoria' ? 0xe0b84a : 0x6a6680, 1).strokeRect(x + 1, y + 1, w - 2, h - 2)
    const cx = LARGURA / 2
    const titulo = { vitoria: 'DESAFIO VENCIDO!', derrota: 'NÃO FOI DESSA VEZ', suspeita: 'PARTIDA NÃO CONFIRMADA', abandono: 'PARTIDA ABANDONADA' }[f.resultado] ?? 'FIM'
    this.t(cx, y + 18, titulo, 22, f.resultado === 'vitoria' ? COR_TEXTO.ouro : COR_TEXTO.aviso).setOrigin(0.5, 0)
    let yy = y + 58
    if (f.resultado === 'vitoria' || f.resultado === 'derrota') {
      this.t(cx, yy, `${formatar(d.pontos)} PONTOS`, 20, COR_TEXTO.titulo).setOrigin(0.5, 0)
      yy += 28
      this.t(cx, yy, `${d.rodadas} rodada${d.rodadas === 1 ? '' : 's'}  ·  ${d.acertos} acerto${d.acertos === 1 ? '' : 's'} levado${d.acertos === 1 ? '' : 's'}  ·  ${d.grazes} raspão${d.grazes === 1 ? '' : 'ões'}`, 11, COR_TEXTO.claro).setOrigin(0.5, 0)
      yy += 22
      if (d.novoRecorde) this.t(cx, yy, 'NOVO RECORDE DE HOJE!', 14, COR_TEXTO.ok).setOrigin(0.5, 0)
      else if (d.recorde != null) this.t(cx, yy, `o seu recorde de hoje: ${formatar(d.recorde)}`, 12, COR_TEXTO.apagado).setOrigin(0.5, 0)
      yy += 26
    }
    if (f.xpGanho > 0) {
      const p = f.xpTotal != null ? progressoDoXp(f.xpTotal) : null
      this.t(cx, yy, `+${f.xpGanho} XP${p ? `  ·  nível ${p.nivel}${f.nivelDepois > f.nivelAntes ? ' (SUBIU!)' : ''}` : ''}`, 16, COR_TEXTO.ouro).setOrigin(0.5, 0)
      yy += 24
    }
    const motivo = MOTIVOS[f.motivo] ?? MOTIVOS[f.resultado] ?? ''
    if (motivo) this.t(cx, yy, motivo, 11, f.resultado === 'suspeita' ? COR_TEXTO.aviso : COR_TEXTO.claro, { align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5, 0)
    yy += 22
    const novo = d.cosmeticoNovo ? itemDoCatalogo(d.cosmeticoNovo) : null
    if (novo) this.t(cx, yy, `COSMÉTICO DA SEMANA: ${NOME_TIPO[novo.tipo]} "${novo.nome}"!`, 13, COR_TEXTO.ok).setOrigin(0.5, 0)
    this.t(cx, y + h - 24, 'A: continuar', 11, COR_TEXTO.apagado).setOrigin(0.5, 0)
  }

  // ---------- entrada ----------

  botao(botao) {
    if (this.saindo) return
    if (this.fim) {
      this.fim = null
      this.sujo = true
      // o estado do dia mudou (recorde, semana): pede de novo
      if (conectadoAoLobby()) pedirDesafio()
      return tocar(this, 'confirmar')
    }
    if (botao === 'B') return this.voltar()
    if (botao !== 'A') return
    if (OPCOES[this.opcao] === 'VOLTAR') return this.voltar()
    const e = get(desafioDiario)
    if (!e.carregado || !e.desafio || !conectadoAoLobby()) return tocar(this, 'erro')
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(260, 0, 0, 0)
    this.time.delayedCall(280, () => this.scene.start('CampanhaArena', { desafio: e.desafio }))
  }

  voltar() {
    this.saindo = true
    tocar(this, 'cancelar')
    sairDoDesafio()
    this.cameras.main.fadeOut(240, 0, 0, 0)
    this.time.delayedCall(260, () => this.scene.start('Menu'))
  }

  update(tempo, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    this.cenario?.atualizar(delta)
    if (!this.saindo && !this.fim)
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d) {
          this.opcao = (this.opcao + 1) % OPCOES.length
          tocar(this, 'mover')
          this.sujo = true
        }
      }
    const e = get(desafioDiario)
    if (!e.carregado && !this.semServidor && tempo - this.abertoEm > SEM_SERVIDOR_MS) {
      this.semServidor = true
      this.sujo = true
    }
    // a contagem até a virada (o relógio daqui); virou: pede o dia novo ao servidor
    if (e.carregado && e.ate) {
      const falta = e.ate - Date.now()
      this.relogio.setText(semLigaduras(falta > 0 ? `novo desafio em ${textoRestante(falta)}` : 'virando o dia…'))
      if (falta <= -2000 && !this.pedidoVirada && conectadoAoLobby()) {
        this.pedidoVirada = true
        pedirDesafio()
      }
      if (falta > 0) this.pedidoVirada = false
    } else this.relogio.setText('')
    if (this.sujo) this.desenhar()
  }
}
