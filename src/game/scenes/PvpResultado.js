import Phaser from 'phaser'
import { irCarregando } from '../carregando.js'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarFundo } from '../backgrounds/index.js'
import Carta from '../entities/Carta.js'
import { tocar, musica } from '../audio.js'
import { fogoArtificio, canhoesConfete, chuvaConfete, raiosDeLuz, CORES_FESTA } from '../effects/festa.js'
import { shake } from '../effects/shake.js'
import { TEXTO_JOGADOR } from '../pvp/perfil.js'
import { nomesDaPartida } from '../pvp/nomesDaPartida.js'
import { tamanhoQueCabe } from '../pvp/nomes.js'
import { CORES, FONTE, LARGURA, ALTURA, CENTRO_X, TEXTO, corTexto } from '../constants.js'
import { claraoCamera } from '../effects/flash.js'
import { partidaOnline, voltarAoLobbyOnline } from '../online.js'
import { canal, emRede, souHostDaRede, irParaCena, encerrarRede, meuLado } from '../rede.js'
import { lan, salaCasual, pedirRevanche, limparRevanche, sairSala, entrarFila, fecharLobby, enviarResultado, iniciarPartida, encerrarPartida } from '../../lib/lan/rede.js'
import { opcoesDoFim, novoAceite, registrar, decidir, expirou, linhasDoAceite, dicaDoAceite, ROTULO } from '../pvp/fimDePartidaRede.js'
import { progressoDoXp, proximaRecompensa, itemDoCatalogo, textoMotivo, NOME_TIPO } from '../../lib/progresso.js'
import { estadoInicialDaTela, deveDestravar } from '../pvp/telaResultado.js'

// Tela de fim da partida PvP, em etapas (como a Vitoria):
//   ENTRADA DO VENCEDOR (não tem no empate; ver entradaVencedor: faixa na cor
//   dele, o sprite grande, o nome enorme com clarão, tremor, confete, fogos)
//   -> luz crescendo -> ESTOURO + "JOGADOR 1 VENCE!" (ou 2, ou EMPATE) na cor do
//   vencedor -> vencedor comemorando e perdedor caído -> estatísticas dos dois
//   lado a lado, rolando com contador.
// A ou B durante a animação pula para o fim. Depois:
//   A: REVANCHE (mesmos personagens) · B: TROCAR PERSONAGENS (PvpEscolha)
// EM REDE (sala de amigos, LAN ou partida rápida; pvp/fimDePartidaRede.js): os
// dois veem esta tela, cada um no seu PC, com um menu (←→ escolher, A confirmar,
// B = última opção): REVANCHE (mesmos personagens e arena), TROCAR PERSONAGEM (os
// dois voltam à PvpEscolha e votam a arena de novo) e VOLTAR AO LOBBY. Cada um
// escolhe, o outro vê na hora quem escolheu o quê ('escolhaFim') com a contagem
// de ESPERA_MS; quando os dois escolheram, o HOST leva os dois (irParaCena). Um
// REVANCHE e um TROCAR vira TROCAR. Voltar ao lobby vale na hora: o do host
// leva os dois (irParaCena); o do convidado pede ao host ('voltarLobby').
// PARTIDA RÁPIDA (sala casual, JOGAR RÁPIDO; docs/online.md): quatro opções
// (←→/↑↓ escolher, A confirmar, B = VOLTAR):
//   REVANCHE          pede ao servidor (partida nova, XP novo); os dois aceitando
//                     (15 s), o host leva os dois de novo para a arena, com os
//                     mesmos personagens
//   TROCAR PERSONAGEM como na sala de amigos (pelo canal); o host também abre
//                     a partida nova no servidor
//   JOGAR NOVAMENTE   sai da sala e volta para a fila (cena Lan)
//   VOLTAR            sai da sala e vai para o menu
// O oponente saindo fecha a sala: game/rede.js leva quem ficou para a tela
// ONLINE com o aviso (dali dá para entrar na fila de novo ou voltar).
// XP (Fase 1D; docs/online.md): em rede, a tela manda o resultado ao servidor
// UMA vez por partida (enviarResultado guarda o partidaId) e, antes das opções,
// mostra o painel de XP por cima das estatísticas: XP ganho, a barra enchendo,
// subiu de nível, itens novos e a próxima recompensa (A/B pula). Sem resposta
// em XP_ESPERA_MS, o motivo (convidado, CPU, …) e as opções.
// Rede de segurança (pvp/telaResultado.js): sem as opções em LIMITE_MS, a tela
// libera os botões com um aviso. A instância da cena é reaproveitada: o create
// zera tudo da partida anterior (estadoInicialDaTela).
//
// Recebe de PvpArena:
//   { vencedor: 1 | 2 | 0 (empate), p1, p2, rodadas,
//     estatisticas: { p1: {...}, p2: {...} } }  (também aceita { 1, 2 })  por jogador: danoCausado,
//     danoRecebido, cartasJogadas, maiorCarta ({ naipe, valor, nome } ou null), grazes, ases

const TEMPO = {
  subida: 120,
  estouro: 650,
  musica: 1150,
  lutadores: 900,
  painel: 1500,
  linha: 280, // intervalo entre as linhas de estatística
  rolar: 420, // quanto tempo cada número leva rolando
  opcoes: 500, // depois da última linha
}

// entrada do vencedor (antes da tela de sempre; não tem no empate)
const ENTRADA = { golpe: 330, saida: 1750, duracao: 1950, y: 228, altura: 180, angulo: 0.16, escala: 9, tamanhoNome: 76, profundidade: 50 }

const PAINEL = { x: CENTRO_X - 230, y: 118, largura: 460, altura: 290, linhaY: 176, espaco: 40 } // centrado em 854
const COLUNA = [PAINEL.x + 76, PAINEL.x + PAINEL.largura - 76] // centro dos valores do P1 e do P2
const LUTADOR = { x: [100, LARGURA - 100], chao: 318, escala: 4 }
const COR_EMPATE = '#c8c8d8'

const XP_ESPERA_MS = 5000 // esperando a recompensa do servidor
const XP_BARRA_MS = 1100
const COR_XP = '#6dffb0'
const COR_ACEITO = '#6dffb0' // quem já escolheu (o texto também diz, não só a cor)


const VAZIO = { danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0 }

const estilo = (tamanho, cor = TEXTO.normal, extra = {}) => ({
  fontFamily: FONTE,
  fontSize: `${tamanho}px`,
  color: cor,
  stroke: '#000000',
  strokeThickness: Math.max(3, Math.round(tamanho / 6)),
  ...extra,
})

// Linhas de estatística; `menor`: o menor valor é o melhor (dano recebido)
const LINHAS = [
  { chave: 'danoCausado', rotulo: 'Dano causado' },
  { chave: 'danoRecebido', rotulo: 'Dano recebido', menor: true },
  { chave: 'cartasJogadas', rotulo: 'Cartas jogadas' },
  { chave: 'maiorCarta', rotulo: 'Maior carta', carta: true },
  { chave: 'grazes', rotulo: 'Grazes' },
  { chave: 'ases', rotulo: 'Ases jogados' },
]

export default class PvpResultado extends Phaser.Scene {
  constructor() {
    super('PvpResultado')
  }

  create(dados = {}) {
    const salvo = this.registry.get('pvp') ?? {}
    this.p1 = PERSONAGENS[dados.p1] ? dados.p1 : salvo.p1 ?? 'kris'
    this.p2 = PERSONAGENS[dados.p2] ? dados.p2 : salvo.p2 ?? 'susie'
    this.arena = dados.arena ?? salvo.arena ?? null // revanche: mesma arena
    this.vencedor = [1, 2].includes(dados.vencedor) ? dados.vencedor : 0
    this.empate = this.vencedor === 0
    this.rodadas = dados.rodadas ?? 0
    this.contraCpu = Boolean(dados.cpu) // partida contra a CPU: o P2 aparece como CPU
    this.nomesJog = nomesDaPartida({ rede: emRede(), cpu: this.contraCpu ? 1 : null }) // quem é cada lado (pvp/nomes.js)
    this.stats = [1, 2].map((j) => ({ ...VAZIO, ...(dados.estatisticas?.[`p${j}`] ?? dados.estatisticas?.[j]) })) // a arena manda { p1, p2 }
    this.corTitulo = this.empate ? COR_EMPATE : TEXTO_JOGADOR[this.vencedor - 1]
    this.corNumero = this.empate ? 0xc8c8d8 : CORES.almas[this.vencedor - 1]

    // a instância da cena é a mesma da partida anterior: tudo daquela vez sai daqui
    Object.assign(this, estadoInicialDaTela())

    this.criarCenario()
    this.etapas = this.montarEtapas()

    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))
    this.rede = emRede()
    this.naSala = this.rede || partidaOnline() // sem revanche: só voltar ao lobby
    // partida rápida: revanche com o aceite dos dois, fila ou menu
    this.casual = this.rede && salaCasual()
    this.opcoesFim = opcoesDoFim({ rede: this.rede, casual: this.casual }) // [] = mesmo PC (A revanche, B troca)
    this.aceite = novoAceite()
    this.opcao = 0
    this.revanche = null
    if (this.rede) {
      const parar = canal.ao('escolhaFim', (d) => this.aoEscolhaDoOutro(d?.escolha))
      this.events.once('shutdown', parar)
      // a escolha dele pode ter chegado antes desta tela abrir (ficou no correio do canal)
      canal.receber('escolhaFim', null, { timeoutMs: 80 }).then((d) => d && this.sys?.isActive() && this.aoEscolhaDoOutro(d.escolha))
    }
    if (this.casual) {
      limparRevanche()
      const parar = lan.subscribe((s) => this.aoRevanche(s.revanche))
      this.events.once('shutdown', parar)
    }
    // em rede, o host volta com os dois quando o convidado pede (mesmo no meio da animação)
    if (this.rede && souHostDaRede()) {
      const parar = canal.ao('voltarLobby', () => this.voltarAoLobby())
      this.events.once('shutdown', parar)
    }
    this.xp = this.prepararXp(dados)
    this.cameras.main.fadeIn(300)
  }

  // ---------- XP (Fase 1D) ----------

  // manda o resultado (uma vez por partida) e fica ouvindo a recompensa.
  // null = sem painel (PVP local de dois no mesmo PC)
  prepararXp(dados) {
    if (this.contraCpu) return { motivo: 'cpu', recompensa: null }
    if (!this.rede) return null
    const s = get(lan)
    const partidaId = s.sala?.partidaId ?? null
    if (!partidaId) return { motivo: 'nao_registrada', recompensa: null }
    enviarResultado({ partidaId, vencedorLado: this.empate ? null : this.vencedor - 1, rodadas: this.rodadas, duracao: dados.duracao, personagem: meuLado() === 0 ? this.p1 : this.p2 })
    const xp = { partidaId, motivo: s.eu.conta ? null : 'convidado', recompensa: null }
    const parar = lan.subscribe((estado) => {
      const r = estado.recompensa
      if (r?.partidaId !== partidaId || r === xp.recompensa) return
      xp.recompensa = r
      if (this.painelXp) this.mostrarRecompensa(false)
    })
    this.events.once('shutdown', parar)
    return xp
  }

  // a etapa antes das opções
  etapaXp(rapido) {
    if (!this.xp) return this.liberar(rapido)
    this.montarPainelXp(rapido)
    if (this.xp.recompensa) return this.mostrarRecompensa(rapido)
    if (this.xp.motivo) {
      this.textoMotivoXp(this.xp.motivo)
      return this.liberar(rapido)
    }
    this.xpTitulo.setText('contando o XP…')
    // pulando, não espera: a recompensa ainda entra no painel quando chegar
    if (rapido) return this.liberar(true)
    this.xpEsperaAte = this.relogio + XP_ESPERA_MS
  }

  montarPainelXp(rapido) {
    const { x, y, largura, altura } = PAINEL
    const P = 20
    const g = this.add.graphics().setDepth(P)
    g.fillStyle(0x0b0914, 0.97).fillRoundedRect(x, y, largura, altura, 8)
    g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(x, y, largura, altura, 8)
    g.lineStyle(1, 0x6dffb0, 0.6).strokeRoundedRect(x + 5, y + 5, largura - 10, altura - 10, 6)
    const cx = x + largura / 2
    const t = (yy, tamanho, cor) => this.add.text(cx, y + yy, '', estilo(tamanho, cor)).setOrigin(0.5).setDepth(P + 1)
    this.barraXp = { x: x + 112, y: y + 140, largura: 300, altura: 14 }
    const fundoBarra = this.add.graphics().setDepth(P + 1)
    fundoBarra.fillStyle(0x16182a, 1).fillRect(this.barraXp.x, this.barraXp.y - 7, this.barraXp.largura, this.barraXp.altura)
    fundoBarra.lineStyle(1, 0x6dffb0, 1).strokeRect(this.barraXp.x, this.barraXp.y - 7, this.barraXp.largura, this.barraXp.altura)
    this.painelXp = [
      g,
      fundoBarra,
      this.add.text(cx, y + 24, 'PROGRESSO', estilo(16, TEXTO.selecionado)).setOrigin(0.5).setDepth(P + 1),
      (this.xpTitulo = t(70, 34, COR_XP)),
      (this.xpMotivo = t(104, 12, '#b0b0c8').setWordWrapWidth(largura - 40).setAlign('center')),
      (this.xpNivel = this.add.text(x + 30, y + 140, '', estilo(16, TEXTO.selecionado)).setOrigin(0, 0.5).setDepth(P + 1)),
      (this.xpCheio = this.add.graphics().setDepth(P + 2)),
      (this.xpNumeros = this.add.text(this.barraXp.x + this.barraXp.largura, y + 162, '', estilo(11, '#9a9aae')).setOrigin(1, 0.5).setDepth(P + 1)),
      (this.xpSubiu = t(192, 22, TEXTO.selecionado)),
      (this.xpItens = t(228, 14, '#c9a2ff').setAlign('center')),
      (this.xpProxima = t(268, 12, '#9a9aae')),
    ]
    const perfil = get(lan).eu.conta
    if (perfil) this.desenharBarraXp(Number(perfil.xp) || 0)
    if (rapido) return
    this.painelXp.forEach((o) => {
      o.setAlpha(0)
      this.tweens.add({ targets: o, alpha: 1, duration: 220 })
    })
    tocar(this, 'voo')
  }

  desenharBarraXp(total) {
    const { nivel, noNivel, paraProximo } = progressoDoXp(total)
    const b = this.barraXp
    this.xpCheio.clear().fillStyle(0x6dffb0, 1).fillRect(b.x + 1, b.y - 6, Math.round((b.largura - 2) * Math.min(1, noNivel / paraProximo)), b.altura - 2)
    this.xpNivel.setText(`NÍVEL ${nivel}`)
    this.xpNumeros.setText(`${noNivel} / ${paraProximo} XP`)
    if (this.xpNivelVisto != null && nivel > this.xpNivelVisto) this.subiuDeNivel(nivel)
    this.xpNivelVisto = nivel
  }

  subiuDeNivel(nivel) {
    this.xpSubiu.setText(`SUBIU PARA O NÍVEL ${nivel}!`).setScale(1.4)
    this.tweens.add({ targets: this.xpSubiu, scale: 1, duration: 260, ease: 'Back.easeOut' })
    if (!this.pulandoXp) tocar(this, 'superAtivar')
  }

  textoMotivoXp(codigo) {
    this.xpTitulo.setText(codigo === 'convidado' ? 'SEM XP' : '+0 XP').setColor('#9a9aae')
    this.xpMotivo.setText(textoMotivo(codigo))
  }

  mostrarRecompensa(rapido) {
    const r = this.xp.recompensa
    this.xpEsperaAte = null
    this.xpAnimacao?.complete()
    const parcial = ['repeticao_metade', 'contestada', 'participacao'].includes(r.motivo)
    if (!r.xpGanho || r.xpTotal == null) {
      this.textoMotivoXp(r.motivo || 'sem_relato')
      if (r.xpTotal != null) this.desenharBarraXp(r.xpTotal)
      return this.fimXp(rapido)
    }
    this.xpTitulo.setText(`+${r.xpGanho} XP`).setColor(COR_XP)
    this.xpMotivo.setText(parcial ? textoMotivo(r.motivo) : r.motivo === 'vitoria' ? 'participação + bônus de vitória' : 'participação')
    const antes = Math.max(0, r.xpTotal - r.xpGanho)
    this.xpNivelVisto = null
    this.desenharBarraXp(antes)
    const fim = () => {
      this.xpAnimacao = null
      this.desenharBarraXp(r.xpTotal)
      const itens = r.itensNovos.map(itemDoCatalogo).filter(Boolean)
      this.xpItens.setText(itens.slice(0, 3).map((i) => `NOVO: ${i.nome} (${NOME_TIPO[i.tipo]})`).join('\n'))
      const prox = proximaRecompensa(r.nivelDepois ?? progressoDoXp(r.xpTotal).nivel)
      this.xpProxima.setText(prox ? `próxima recompensa no nível ${prox.nivel}: ${prox.nome} (${NOME_TIPO[prox.tipo]})` : 'você já tem toda a trilha!')
      this.fimXp(rapido)
    }
    if (rapido) {
      this.pulandoXp = true
      fim()
      this.pulandoXp = false
      return
    }
    tocar(this, 'energia')
    this.xpAnimacao = this.tweens.addCounter({
      from: antes,
      to: r.xpTotal,
      duration: XP_BARRA_MS,
      ease: 'Quad.easeOut',
      onUpdate: (tw) => this.desenharBarraXp(Math.round(tw.getValue())),
      onComplete: fim,
    })
  }

  fimXp(rapido) {
    if (!this.liberou) this.liberar(rapido)
  }

  // A/B no meio da barra: vai para o fim
  pularXp() {
    this.pulandoXp = true
    if (this.xpAnimacao) this.xpAnimacao.complete()
    else if (this.xpEsperaAte != null) {
      this.xpEsperaAte = null
      this.liberar(true)
    }
    this.pulandoXp = false
  }

  // ---------- cenário fixo ----------

  criarCenario() {
    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer()
    this.veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-4).setAlpha(0.9)
    this.raios = raiosDeLuz(this, LARGURA / 2, 52, { cor: this.corNumero, alpha: this.empate ? 0.08 : 0.2, profundidade: -3 })
    this.halo = this.add.image(LARGURA / 2, 52, 'brilho').setScale(0).setTint(this.corNumero).setBlendMode(Phaser.BlendModes.ADD).setDepth(-1)
  }

  // ---------- linha do tempo ----------

  montarEtapas() {
    const e = []
    // com vencedor, a entrada dele vem antes de tudo (o resto anda junto)
    const d = this.empate ? 0 : ENTRADA.duracao
    const em = (t, f) => e.push({ t: t + d, f })
    if (d) {
      e.push({ t: 0, f: (r) => this.entradaVencedor(r) })
      e.push({ t: ENTRADA.golpe, f: (r) => this.golpeEntrada(r) })
      e.push({ t: ENTRADA.saida, f: (r) => this.sairEntrada(r) })
    }
    em(TEMPO.subida, (r) => this.subida(r))
    em(TEMPO.estouro, (r) => this.estouro(r))
    // a música da vitória entra no golpe da entrada (sem entrada, no tempo de sempre)
    if (!d) em(TEMPO.musica, () => musica('pvpResultado', 'vitoria'))
    em(TEMPO.lutadores, (r) => this.entrarLutadores(r))
    em(TEMPO.painel, (r) => this.abrirPainel(r))
    LINHAS.forEach((linha, i) => em(TEMPO.painel + 300 + i * TEMPO.linha, (r) => this.mostrarLinha(linha, i, r)))
    em(TEMPO.painel + 300 + LINHAS.length * TEMPO.linha + TEMPO.rolar + TEMPO.opcoes, (r) => this.etapaXp(r))
    return e.sort((a, b) => a.t - b.t)
  }

  pular() {
    this.pulando = true
    this.contadores.forEach((c) => c.isPlaying() && c.complete())
    while (this.etapas.length) this.etapas.shift().f(true)
    this.pulando = false
  }

  aoBotao(botao) {
    if (this.saindo) return
    if (!this.liberado) {
      if (this.etapas.length) this.pular()
      else if (this.painelXp && !this.liberou) this.pularXp()
      else if (!this.liberou) this.liberar(true) // nada mais para pular: as opções
      return
    }
    if (this.opcoesFim.length) return this.escolherFim(botao === 'B' ? this.opcoesFim[this.opcoesFim.length - 1] : this.opcoesFim[this.opcao])
    if (this.naSala) return this.voltarAoLobby() // na sala não tem revanche: os dois voltam ao lobby
    this.saindo = true
    tocar(this, botao === 'A' ? 'confirmar' : 'cancelar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    const { p1, p2, arena } = this
    this.time.delayedCall(260, () => (botao === 'A' ? irCarregando(this, 'PvpArena', { p1, p2, arena }) : this.scene.start('PvpEscolha')))
  }

  // ---------- fim em rede: revanche, troca de personagem, lobby ----------

  escolherFim(id) {
    if (this.saindo) return
    if (id === 'revanche' || id === 'trocar') {
      if (this.aceite.minha === id) return tocar(this, 'cancelar') // já escolheu isto: esperando o outro
      tocar(this, 'confirmar')
      canal.enviar('escolhaFim', null, { escolha: id })
      if (id === 'revanche' && this.casual) pedirRevanche(true) // partida rápida: o servidor abre a partida nova
      return this.registrarEscolha('minha', id)
    }
    if (id === 'lobby') return this.voltarAoLobby()
    this.saindo = true
    tocar(this, id === 'voltar' ? 'cancelar' : 'confirmar')
    // sair da sala casual fecha ela para o outro (ele vai para a tela ONLINE com o aviso)
    encerrarRede()
    if (id === 'fila') {
      sairSala()
      entrarFila()
    } else fecharLobby()
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(260, () => this.scene.start(id === 'fila' ? 'Lan' : 'Menu'))
  }

  aoEscolhaDoOutro(escolha) {
    if (this.saindo) return
    this.registrarEscolha('outra', escolha)
    if (this.liberado) tocar(this, 'mover')
  }

  registrarEscolha(quem, escolha) {
    this.aceite = registrar(this.aceite, quem, escolha, Date.now())
    this.verificarAceite()
    this.atualizarCasual()
  }

  // os dois escolheram: o host leva os dois (o convidado vai junto pelo canal)
  verificarAceite() {
    const acao = decidir(this.aceite)
    if (!acao || this.saindo || !souHostDaRede()) return
    if (this.casual && acao === 'revanche') return // na rápida a revanche vem do servidor (partida nova, XP)
    this.sair(acao)
  }

  sair(acao) {
    this.saindo = true
    tocar(this, 'superAtivar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    const { p1, p2, arena } = this
    this.time.delayedCall(260, () => {
      // partida nova no servidor (XP, partidaId): a rápida já abriu a da revanche
      if (!(this.casual && acao === 'revanche')) {
        encerrarPartida()
        iniciarPartida()
      }
      if (acao === 'trocar') irParaCena(this, 'PvpEscolha')
      else irParaCena(this, 'PvpArena', { p1, p2, arena, semente: `rede:${Date.now()}` })
    })
  }

  aoRevanche(r) {
    this.revanche = r
    // os dois toparam no servidor: o host recomeça (mesmos personagens; a troca já passou pelo canal)
    if (r?.estado === 'aceita' && !this.saindo && souHostDaRede() && this.aceite.outra !== 'trocar' && this.aceite.minha !== 'trocar') this.sair('revanche')
    this.atualizarCasual()
  }

  textoRevanche() {
    const r = this.revanche
    if (!r) return ''
    const resta = r.expira ? Math.max(0, Math.ceil((r.expira - Date.now()) / 1000)) : 0
    if (r.estado === 'pedida') return r.minha ? `esperando o oponente aceitar a revanche… ${resta}s` : `o oponente quer revanche (${resta}s): aceite em REVANCHE`
    if (r.estado === 'aceita') return 'REVANCHE! começando…'
    if (r.estado === 'recusada') return r.minha ? 'você recusou a revanche' : 'o oponente recusou a revanche: jogar de novo ou voltar?'
    if (r.estado === 'expirada') return 'a revanche expirou: jogar de novo ou voltar?'
    return 'o oponente já saiu: jogar de novo ou voltar'
  }

  // o menu de baixo (em rede): as opções, o cursor e as duas linhas de "quem escolheu o quê"
  montarCasual() {
    const y = ALTURA - 26
    this.linhasCasual = this.opcoesFim.map((id) => this.add.text(0, y, ROTULO[id], estilo(15)).setOrigin(0.5).setDepth(10))
    // distribui pelo tamanho de cada texto (TROCAR PERSONAGEM é bem mais longo que VOLTAR)
    const folga = 46
    const total = this.linhasCasual.reduce((t, l) => t + l.width, 0) + folga * (this.linhasCasual.length - 1)
    let x = LARGURA / 2 - total / 2
    for (const l of this.linhasCasual) {
      l.setX(x + l.width / 2)
      x += l.width + folga
    }
    this.cursorCasual = this.add.image(0, y, 'coracao').setTint(CORES.almas[0]).setDepth(10)
    // quem escolheu o quê: VOCÊ à esquerda do centro, o oponente à direita
    this.avisoCasual = [
      this.add.text(LARGURA / 2 - 14, ALTURA - 54, '', estilo(13)).setOrigin(1, 0.5).setDepth(10),
      this.add.text(LARGURA / 2 + 14, ALTURA - 54, '', estilo(13)).setOrigin(0, 0.5).setDepth(10),
    ]
    this.atualizarCasual()
  }

  atualizarCasual() {
    if (!this.linhasCasual) return
    const agora = Date.now()
    // a espera acabou sem acordo: cancela e deixa escolher de novo
    if (expirou(this.aceite, agora) && !this.saindo) {
      this.aceite = novoAceite()
      this.avisoExpirou = agora + 3000
    }
    this.linhasCasual.forEach((l, k) => {
      const id = this.opcoesFim[k]
      const minha = this.aceite.minha === id
      l.setColor(minha ? COR_ACEITO : k === this.opcao ? TEXTO.selecionado : '#9a9ab0').setAlpha(minha || k === this.opcao ? 1 : 0.75)
    })
    const l = this.linhasCasual[this.opcao]
    this.cursorCasual.setX(l.x - l.width / 2 - 16)
    const [eu, ele] = this.avisoCasual
    const { linhas, resta, esperando } = linhasDoAceite(this.aceite, agora)
    if (esperando) {
      const sufixo = esperando ? `  ${resta}s` : ''
      eu.setText(`${linhas[0].quem}: ${linhas[0].texto}`).setColor(linhas[0].pronto ? COR_ACEITO : '#8a8aa0')
      ele.setText(`${linhas[1].quem}: ${linhas[1].texto}${sufixo}`).setColor(linhas[1].pronto ? COR_ACEITO : '#8a8aa0')
      // o outro quer algo e eu ainda não respondi: destaca a pergunta
      if (this.aceite.outra && !this.aceite.minha) ele.setColor(TEXTO.selecionado)
      return
    }
    if (this.avisoExpirou && agora < this.avisoExpirou) {
      eu.setText('')
      return ele.setText('o oponente não respondeu: escolha de novo').setColor('#9a9ab0')
    }
    eu.setText('')
    ele.setText(this.textoRevanche()).setColor(TEXTO.selecionado)
  }

  voltarAoLobby() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    // convidado em rede: pede ao host, que traz os dois (a cena Lan chega pelo canal)
    if (this.rede && !souHostDaRede()) return canal.enviar('voltarLobby', null, {})
    this.time.delayedCall(260, () => (this.rede ? irParaCena(this, 'Lan') : voltarAoLobbyOnline(this)))
  }

  // ---------- entrada do vencedor ----------
  // A tela escurece e uma faixa diagonal na cor do personagem rasga a tela
  // vindo do lado dele (P1 da esquerda, P2 da direita), com linhas de
  // velocidade; o sprite dele entra GRANDE deixando rastro. No golpe: clarão,
  // tremor forte, o nome ENORME batendo, "VENCEU!", confete, fogos e a
  // música da vitória. Depois tudo sai voando e começa a tela de sempre.
  // Pulando (A/B), nada disso aparece (ou some na hora).

  entradaVencedor(rapido) {
    if (rapido) return
    const id = this.vencedor === 1 ? this.p1 : this.p2
    const def = PERSONAGENS[id]
    const cor = def.cor ?? this.corNumero
    const lado = this.vencedor === 1 ? -1 : 1 // de onde ele vem
    const P = ENTRADA.profundidade
    const objetos = (this.entrada = [])
    const novo = (o) => (objetos.push(o), o)
    this.ladoEntrada = lado

    novo(this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(P))
    // a faixa e as linhas de velocidade correndo dentro dela
    const faixa = novo(this.add.container(LARGURA / 2 + lado * 900, ENTRADA.y).setDepth(P + 1).setRotation(ENTRADA.angulo * -lado))
    const g = this.add.graphics()
    g.fillStyle(cor, 1).fillRect(-560, -ENTRADA.altura / 2, 1120, ENTRADA.altura)
    g.fillStyle(0xffffff, 0.9).fillRect(-560, -ENTRADA.altura / 2 - 6, 1120, 4).fillRect(-560, ENTRADA.altura / 2 + 2, 1120, 4)
    g.fillStyle(0x000000, 0.25).fillRect(-560, -ENTRADA.altura / 2, 1120, ENTRADA.altura * 0.18)
    faixa.add(g)
    for (let i = 0; i < 16; i++) {
      const y = Phaser.Math.Between(-ENTRADA.altura / 2 + 8, ENTRADA.altura / 2 - 8)
      const linha = this.add.rectangle(0, y, Phaser.Math.Between(60, 220), Phaser.Math.Between(1, 3), 0xffffff, Phaser.Math.FloatBetween(0.25, 0.6))
      faixa.add(linha)
      this.tweens.add({ targets: linha, x: { from: lado * 640, to: -lado * 640 }, duration: Phaser.Math.Between(260, 520), delay: Phaser.Math.Between(0, 400), repeat: -1 })
    }
    this.faixaEntrada = faixa
    tocar(this, 'superCorte')
    this.tweens.add({ targets: faixa, x: LARGURA / 2, duration: 200, ease: 'Cubic.easeOut' })

    // o vencedor GRANDE, do lado de onde veio, com rastro
    const x = LARGURA / 2 + lado * 160
    const chao = ENTRADA.y + ENTRADA.altura / 2 + 26
    const brilho = novo(this.add.image(x, chao - 120, 'brilho').setTint(cor).setBlendMode(Phaser.BlendModes.ADD).setDepth(P + 2).setScale(0).setAlpha(0.9))
    this.tweens.add({ targets: brilho, scale: 5, duration: 300, delay: 120, ease: 'Quad.easeOut' })
    const rastros = [0.35, 0.22, 0.12].map((alpha, i) =>
      novo(this.add.image(x + lado * 700, chao, id).setOrigin(0.5, 1).setScale(ENTRADA.escala).setDepth(P + 2).setFlipX(lado > 0).setTint(cor).setAlpha(alpha)),
    )
    const sprite = novo(this.add.image(x + lado * 700, chao, id).setOrigin(0.5, 1).setScale(ENTRADA.escala).setDepth(P + 3).setFlipX(lado > 0))
    this.spriteEntrada = sprite
    this.tweens.add({ targets: sprite, x, duration: 240, delay: 90, ease: 'Back.easeOut' })
    rastros.forEach((r, i) =>
      this.tweens.add({ targets: r, x: x + lado * (12 + i * 14), alpha: 0, duration: 340 + i * 90, delay: 90 + i * 40, ease: 'Cubic.easeOut' }),
    )

    // o nome (aparece no golpe)
    const nx = LARGURA / 2 - lado * 120
    this.nomeEntrada = novo(
      this.add
        .text(nx, ENTRADA.y - 18, this.nomesJog[this.vencedor - 1], estilo(tamanhoQueCabe(this.nomesJog[this.vencedor - 1], { max: ENTRADA.tamanhoNome, larguraPx: 470 }), '#ffffff', { strokeThickness: 10 }))
        .setOrigin(0.5)
        .setDepth(P + 4)
        .setShadow(0, 0, corTexto(cor), 18, true, true)
        .setAlpha(0),
    )
    const cpu = this.contraCpu && this.vencedor === 2
    this.legendaEntrada = novo(
      this.add
        .text(nx, ENTRADA.y + 46, cpu ? 'A CPU VENCEU!' : `VENCEU! (${def.nome.toUpperCase()})`, estilo(30, TEXTO.selecionado, { strokeThickness: 7 }))
        .setOrigin(0.5)
        .setDepth(P + 4)
        .setAlpha(0),
    )
  }

  golpeEntrada(rapido) {
    if (rapido || !this.entrada) return
    const cor = PERSONAGENS[this.vencedor === 1 ? this.p1 : this.p2].cor ?? this.corNumero
    const P = ENTRADA.profundidade
    musica('pvpResultado', 'vitoria')
    tocar(this, 'vitoriaEntrada')
    tocar(this, 'superAtivar')
    claraoCamera(this.cameras.main, 260, 255, 255, 255)
    shake(this, 380, 0.022)
    const nome = this.nomeEntrada
    nome.setScale(3.4).setAlpha(0)
    this.tweens.add({ targets: nome, scale: 1, alpha: 1, duration: 130, ease: 'Quad.easeIn' })
    this.tweens.add({ targets: nome, scale: 1.06, delay: 300, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const leg = this.legendaEntrada
    leg.setX(leg.x + this.ladoEntrada * 300)
    this.tweens.add({ targets: leg, x: leg.x - this.ladoEntrada * 300, alpha: 1, delay: 120, duration: 220, ease: 'Back.easeOut' })
    // o vencedor pula de alegria
    const s = this.spriteEntrada
    this.tweens.add({ targets: s, y: s.y - 26, scaleY: ENTRADA.escala * 1.05, duration: 210, yoyo: true, repeat: -1, repeatDelay: 80, ease: 'Quad.easeOut' })
    canhoesConfete(this, 60, P + 5)
    fogoArtificio(this, nome.x - 120, ENTRADA.y - 90, cor, { quantidade: 44, profundidade: P + 5 })
    this.time.delayedCall(180, () => this.entrada && fogoArtificio(this, nome.x + 130, ENTRADA.y - 70, undefined, { quantidade: 40, profundidade: P + 5 }))
    this.time.delayedCall(420, () => this.entrada && fogoArtificio(this, this.spriteEntrada.x, ENTRADA.y - 130, cor, { quantidade: 36, profundidade: P + 5 }))
    // anel de luz saindo do golpe
    const anel = this.add.circle(nome.x, nome.y, 20).setStrokeStyle(6, 0xffffff, 1).setDepth(P + 4)
    this.entrada.push(anel)
    this.tweens.add({ targets: anel, scale: 14, alpha: 0, duration: 600, ease: 'Quad.easeOut' })
  }

  // tudo sai voando (ou some na hora, pulando) e a tela de sempre começa
  sairEntrada(rapido) {
    const objetos = this.entrada
    if (!objetos) return
    this.entrada = null
    const fim = () =>
      objetos.forEach((o) => {
        this.tweens.killTweensOf(o)
        if (o.list) o.list.forEach((c) => this.tweens.killTweensOf(c))
        o.destroy()
      })
    if (rapido) {
      if (!this.relogio || this.relogio < ENTRADA.golpe) musica('pvpResultado', 'vitoria') // pulou antes do golpe: a música ainda não tinha entrado
      return fim()
    }
    tocar(this, 'voo')
    const lado = this.ladoEntrada
    for (const o of objetos) {
      this.tweens.killTweensOf(o)
      this.tweens.add({ targets: o, x: o.x - lado * 700, alpha: 0, duration: 220, ease: 'Cubic.easeIn' })
    }
    this.time.delayedCall(240, fim)
  }

  // ---------- etapas ----------

  subida(rapido) {
    if (rapido) return
    tocar(this, 'subida')
    this.tweens.add({ targets: this.halo, scale: 1.5, duration: TEMPO.estouro - TEMPO.subida, ease: 'Quad.easeIn' })
  }

  estouro(rapido) {
    if (!rapido) {
      tocar(this, this.empate ? 'impacto' : 'estouroFesta')
      claraoCamera(this.cameras.main, 240, 255, 255, 240)
      shake(this, 220, 0.012)
    }
    this.tweens.add({ targets: this.veu, alpha: 0.55, duration: rapido ? 1 : 500 })
    this.tweens.add({ targets: this.raios, alpha: this.raios.getData('alpha'), duration: rapido ? 1 : 600 })
    this.tweens.killTweensOf(this.halo)
    this.halo.setScale(3).setAlpha(1)
    this.tweens.add({ targets: this.halo, scale: 2.2, alpha: 0.45, duration: 700, ease: 'Quad.easeOut' })

    if (this.empate) {
      // empate: sem festa, só faíscas nas duas cores subindo devagar
      this.add
        .particles(0, ALTURA + 10, 'faisca', {
          x: { min: 0, max: LARGURA },
          speedY: { min: -70, max: -30 },
          lifespan: 3600,
          scale: { start: 1.1, end: 0 },
          tint: CORES.almas,
          frequency: 120,
          blendMode: 'ADD',
        })
        .setDepth(-2)
    } else {
      canhoesConfete(this)
      chuvaConfete(this, 1)
      const cor = this.corNumero
      // fogos de tempos em tempos, do lado do vencedor (e alguns do outro)
      const ladoVencedor = this.vencedor === 1 ? 0 : 1
      if (!rapido) for (let i = 0; i < 3; i++) this.time.delayedCall(i * 140, () => fogoArtificio(this, CENTRO_X - 180 + i * 180, Phaser.Math.Between(50, 120), i === 1 ? cor : undefined))
      this.time.addEvent({
        delay: 850,
        loop: true,
        callback: () => {
          const lado = Math.random() < 0.7 ? ladoVencedor : 1 - ladoVencedor
          const x = lado === 0 ? Phaser.Math.Between(30, 190) : Phaser.Math.Between(LARGURA - 190, LARGURA - 30)
          fogoArtificio(this, x, Phaser.Math.Between(40, 170), Math.random() < 0.5 ? cor : undefined, { quantidade: 28, profundidade: -1 })
          tocar(this, 'fogo')
        },
      })
      this.add
        .particles(0, ALTURA + 10, 'estrela', {
          x: { min: 0, max: LARGURA },
          speedY: { min: -70, max: -30 },
          lifespan: 5000,
          rotate: { start: 0, end: 360 },
          scale: { start: 0.7, end: 0.1 },
          alpha: { start: 0.8, end: 0 },
          tint: CORES_FESTA,
          frequency: 380,
          blendMode: 'ADD',
        })
        .setDepth(-2)
    }
    this.criarTitulo(rapido)
  }

  criarTitulo(rapido) {
    const vencedor = this.contraCpu ? (this.vencedor === 1 ? 'VOCÊ VENCEU!' : 'A CPU VENCEU!') : `${this.nomesJog[this.vencedor - 1]} VENCE!`
    const texto = this.empate ? 'EMPATE!' : vencedor
    this.titulo = this.add
      .text(LARGURA / 2, 52, texto, estilo(this.empate ? 54 : 44, this.corTitulo, { strokeThickness: 8 }))
      .setOrigin(0.5)
      .setDepth(10)
      .setShadow(0, 4, '#000000', 0, true, false)
    if (!this.empate) this.titulo.setTint(0xffffff, 0xffffff, 0xffe0c0, 0xffe0c0)

    const nome = (j) => PERSONAGENS[j === 1 ? this.p1 : this.p2].nome
    const r = this.rodadas
    const emRodadas = r ? ` em ${r} rodada${r === 1 ? '' : 's'}` : ''
    const sub = this.empate ? `Os dois caíram juntos${emRodadas}!` : `${nome(this.vencedor)} venceu${emRodadas}!`
    const legenda = this.add.text(LARGURA / 2, 94, sub, estilo(17, TEXTO.normal)).setOrigin(0.5).setDepth(10)

    const pulsar = () => this.tweens.add({ targets: this.titulo, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    if (rapido) return pulsar()
    legenda.setAlpha(0)
    this.tweens.add({ targets: legenda, alpha: 1, delay: 300, duration: 300 })
    this.titulo.setScale(4).setAlpha(0).setAngle(-6)
    this.tweens.add({
      targets: this.titulo,
      scale: 1,
      alpha: 1,
      angle: 0,
      duration: 190,
      ease: 'Quad.easeIn',
      onComplete: () => {
        shake(this, 260, 0.018)
        tocar(this, this.empate ? 'letraPesada' : 'fanfarra')
        if (!this.empate) fogoArtificio(this, LARGURA / 2, 52, this.corNumero, { quantidade: 50, profundidade: 8 })
        pulsar()
      },
    })
  }

  // Vencedor comemorando (pulos + coroa); perdedor caído e acinzentado.
  // Empate: os dois de joelhos, meio apagados.
  entrarLutadores(rapido) {
    const { chao, escala } = LUTADOR
    ;[this.p1, this.p2].forEach((id, k) => {
      const j = k + 1
      const def = PERSONAGENS[id]
      const x = LUTADOR.x[k]
      const lado = k === 0 ? -1 : 1
      const venceu = this.vencedor === j
      const sombra = this.add.ellipse(x, chao + 2, 58, 12, 0x000000, 0.5).setDepth(4)
      const s = this.add.image(x, chao, id).setOrigin(0.5, 1).setScale(escala).setDepth(5).setFlipX(k === 1)
      this.add.text(x, chao + 22, this.nomesJog[k], estilo(15, TEXTO_JOGADOR[k])).setOrigin(0.5).setDepth(5)
      this.add.text(x, chao + 44, def.nome.toUpperCase(), estilo(18, venceu || this.empate ? corTexto(def.cor) : '#8a8a8a')).setOrigin(0.5).setDepth(5)

      if (!rapido) {
        s.x += lado * 160
        sombra.x += lado * 160
        this.tweens.add({ targets: [s, sombra], x: `-=${lado * 160}`, duration: 380, delay: k * 120, ease: 'Back.easeOut' })
      }

      if (this.empate) {
        // empate: os dois exaustos, meio apagados, ofegando
        s.setTint(0x9a9a9a).setAngle(-lado * 4)
        this.tweens.add({ targets: s, scaleY: escala * 0.94, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        return
      }
      if (!venceu) {
        // caído: deitado de lado (a cabeça para o meio da tela), cinza.
        // Gira pelo pé, então anda meio corpo para fora para ficar centrado.
        s.setTint(0x5a5a5a).setAlpha(0.8)
        const deitado = { angle: -lado * 84, x: x + lado * (s.displayHeight / 2) }
        const cair = () => {
          tocar(this, 'cartaImpacto')
          this.tweens.add({ targets: s, ...deitado, duration: 260, ease: 'Bounce.easeOut' })
          this.tweens.add({ targets: sombra, scaleX: 1.8, duration: 260 })
        }
        if (rapido) {
          s.setAngle(deitado.angle).setX(deitado.x)
          sombra.setScale(1.8, 1)
        } else this.time.delayedCall(560, cair)
        return
      }
      // venceu: coroa flutuando e pulinhos com esmagada
      const coroa = this.add.image(x, chao - s.displayHeight - 16, 'bala-coroa').setTint(0xffe040).setScale(1.4).setDepth(6)
      this.tweens.add({ targets: coroa, y: coroa.y - 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      const brilho = this.add.image(x, chao - 40, 'brilho').setTint(this.corNumero).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setScale(1.6).setAlpha(0.35)
      this.tweens.add({ targets: brilho, alpha: 0.15, scale: 1.9, duration: 700, yoyo: true, repeat: -1 })
      if (!rapido) {
        coroa.setAlpha(0).setScale(3)
        this.tweens.add({ targets: coroa, alpha: 1, scale: 1.4, delay: 500, duration: 200, ease: 'Quad.easeIn' })
      }
      const pulo = () => {
        this.tweens.chain({
          targets: s,
          loop: -1,
          loopDelay: 160,
          tweens: [
            { scaleY: escala * 0.85, scaleX: escala * 1.1, duration: 90, ease: 'Quad.easeOut' },
            { y: chao - 34, scaleY: escala * 1.08, scaleX: escala * 0.95, angle: lado * -8, duration: 230, ease: 'Quad.easeOut' },
            { y: chao, scaleY: escala, scaleX: escala, angle: 0, duration: 200, ease: 'Quad.easeIn' },
          ],
        })
        this.tweens.add({ targets: sombra, scaleX: 0.6, alpha: 0.2, duration: 320, yoyo: true, repeat: -1, repeatDelay: 200, delay: 90 })
      }
      this.time.delayedCall(rapido ? 0 : 520, pulo)
    })
  }

  abrirPainel(rapido) {
    const { x, y, largura, altura } = PAINEL
    const g = this.add.graphics().setDepth(6)
    g.fillStyle(0x0b0914, 0.9).fillRoundedRect(0, 0, largura, altura, 8)
    g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(0, 0, largura, altura, 8)
    g.lineStyle(1, this.corNumero, 0.6).strokeRoundedRect(5, 5, largura - 10, altura - 10, 6)
    // cabeçalho: P1 | rodadas | P2
    g.lineStyle(1, 0xffffff, 0.15).lineBetween(14, 44, largura - 14, 44)
    g.setPosition(x, y)
    const cabecalho = [
      this.add.text(COLUNA[0], y + 23, this.nomesJog[0], estilo(tamanhoQueCabe(this.nomesJog[0], { max: 20, larguraPx: 130 }), TEXTO_JOGADOR[0])).setOrigin(0.5),
      this.add.text(COLUNA[1], y + 23, this.nomesJog[1], estilo(tamanhoQueCabe(this.nomesJog[1], { max: 20, larguraPx: 130 }), TEXTO_JOGADOR[1])).setOrigin(0.5),
      this.add.text(x + largura / 2, y + 16, 'RODADAS', estilo(11, '#9a9aae')).setOrigin(0.5),
      this.add.text(x + largura / 2, y + 32, String(this.rodadas), estilo(17, TEXTO.selecionado)).setOrigin(0.5),
    ]
    cabecalho.forEach((t) => t.setDepth(7))
    if (rapido) return
    g.setScale(1, 0).setY(y + altura / 2)
    this.tweens.add({ targets: g, scaleY: 1, y, duration: 260, ease: 'Back.easeOut' })
    cabecalho.forEach((t) => {
      t.setAlpha(0)
      this.tweens.add({ targets: t, alpha: 1, delay: 180, duration: 200 })
    })
    tocar(this, 'voo')
  }

  // quem foi melhor nesta linha (0 = P1, 1 = P2, -1 = empate)
  melhor(linha) {
    if (linha.carta) {
      const [a, b] = this.stats.map((s) => s.maiorCarta?.valor ?? 0)
      // Ás é especial, mas para "maior carta" vale como o mais fraco (1)
      return a === b ? -1 : a > b ? 0 : 1
    }
    const [a, b] = this.stats.map((s) => Number(s[linha.chave]) || 0)
    if (a === b) return -1
    return (linha.menor ? a < b : a > b) ? 0 : 1
  }

  mostrarLinha(linha, i, rapido) {
    const y = PAINEL.linhaY + i * PAINEL.espaco
    const rotulo = this.add.text(LARGURA / 2, y, linha.rotulo, estilo(13, '#c8c8d8', { strokeThickness: 3 })).setOrigin(0.5).setDepth(7)
    if (!rapido) {
      rotulo.setAlpha(0).setY(y + 8)
      this.tweens.add({ targets: rotulo, alpha: 1, y, duration: 160, ease: 'Quad.easeOut' })
    }
    const melhor = this.melhor(linha)
    ;[0, 1].forEach((k) => {
      const cor = melhor === k ? TEXTO_JOGADOR[k] : '#ffffff'
      if (linha.carta) return this.mostrarCarta(this.stats[k].maiorCarta, k, y, cor, rapido)
      const alvo = Math.max(0, Math.round(Number(this.stats[k][linha.chave]) || 0))
      const valor = this.add.text(COLUNA[k], y, rapido ? String(alvo) : '0', estilo(19, cor)).setOrigin(0.5).setDepth(7)
      if (melhor === k) this.marcarMelhor(COLUNA[k], y, k, rapido)
      if (rapido) return
      if (!alvo) {
        this.time.delayedCall(80, () => tocar(this, 'contadorFim'))
        return
      }
      const contador = this.tweens.addCounter({
        from: 0,
        to: alvo,
        duration: TEMPO.rolar,
        ease: 'Quad.easeOut',
        onUpdate: (tw) => {
          valor.setText(String(Math.round(tw.getValue())))
          if (this.time.now - this.ultimoTic > 38) {
            this.ultimoTic = this.time.now
            tocar(this, 'contador')
          }
        },
        onComplete: () => {
          valor.setText(String(alvo))
          if (this.pulando) return
          if (k === 1) tocar(this, 'contadorFim')
          valor.setScale(1.35)
          this.tweens.add({ targets: valor, scale: 1, duration: 150, ease: 'Quad.easeOut' })
        },
      })
      this.contadores.push(contador)
    })
  }

  // estrelinha ao lado do melhor valor da linha
  marcarMelhor(x, y, k, rapido) {
    const lado = k === 0 ? -1 : 1
    const estrela = this.add.image(x + lado * 34, y, 'estrela').setTint(CORES.almas[k]).setScale(0.7).setDepth(7)
    if (rapido) return
    estrela.setScale(0)
    this.tweens.add({ targets: estrela, scale: 0.7, delay: TEMPO.rolar, duration: 160, ease: 'Back.easeOut' })
  }

  // Maior carta: mini carta + nome embaixo do rótulo (ou um traço se não jogou nenhuma)
  mostrarCarta(carta, k, y, cor, rapido) {
    const x = COLUNA[k]
    if (!carta) {
      this.add.text(x, y, '—', estilo(19, '#8a8a8a')).setOrigin(0.5).setDepth(7)
      return
    }
    // espelhado: P1 com a carta por fora e o nome para dentro; P2 ao contrário
    const fora = lado(k)
    const personagem = carta.personagem ?? (k === 0 ? this.p1 : this.p2)
    const mini = new Carta(this, x + fora * 40, y + 2, { id: `resultado-${k}`, custo: 0, descricao: '', ...carta, personagem }, { largura: 24 }).setDepth(7)
    const nome = this.add
      .text(x + fora * 24, y + 2, carta.nome ?? '', estilo(12, cor, { strokeThickness: 3, wordWrap: { width: 80 }, lineSpacing: -2, align: k === 0 ? 'left' : 'right' }))
      .setOrigin(k === 0 ? 0 : 1, 0.5)
      .setDepth(7)
    if (rapido) return
    mini.setScale(2.2).setAlpha(0).setAngle(lado(k) * 20)
    nome.setAlpha(0)
    this.tweens.add({
      targets: mini,
      scale: 1,
      alpha: 1,
      angle: 0,
      duration: 200,
      delay: k * 120,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.pulando) tocar(this, 'cartaImpacto')
      },
    })
    this.tweens.add({ targets: nome, alpha: 1, delay: 200 + k * 120, duration: 200 })
  }

  liberar(rapido) {
    if (this.liberou) return
    this.liberou = true
    if (rapido) this.time.delayedCall(400, () => (this.liberado = true))
    else this.liberado = true
    this.dicaPular?.destroy()
    if (this.opcoesFim.length) return this.montarCasual()
    const opcoes = this.add
      .text(LARGURA / 2, ALTURA - 26, this.naSala ? 'A: VOLTAR AO LOBBY' : 'A: REVANCHE (mesmos personagens)     B: TROCAR PERSONAGEM', estilo(16))
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0)
    this.tweens.add({
      targets: opcoes,
      alpha: 1,
      duration: 300,
      onComplete: () => this.tweens.add({ targets: opcoes, alpha: 0.5, duration: 550, yoyo: true, repeat: -1 }),
    })
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    this.raios.rotation += delta * 0.00018

    this.relogio += delta
    while (this.etapas.length && this.relogio >= this.etapas[0].t) this.etapas.shift().f(false)
    // a recompensa não veio a tempo: o motivo e as opções (ela ainda entra se chegar)
    if (this.xpEsperaAte != null && this.relogio >= this.xpEsperaAte) {
      this.xpEsperaAte = null
      this.textoMotivoXp('espera')
      this.xpTitulo.setText('XP a caminho')
      this.liberar(false)
    }
    // rede de segurança: as opções não vieram (alguma etapa estourou): libera com um aviso
    if (deveDestravar(this)) {
      console.warn('[res] opções não apareceram a tempo: liberando', { etapas: this.etapas.length, xp: this.xp })
      this.etapas = []
      this.xpEsperaAte = null
      this.liberar(false)
      this.add.text(LARGURA / 2, ALTURA - 76, 'a tela demorou: escolha uma opção', estilo(12, '#9a9aae')).setOrigin(0.5).setDepth(10)
    }

    // partida rápida: escolher entre as três opções (e a contagem da revanche)
    if (this.linhasCasual && !this.saindo) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        const passo = d === 'esquerda' || d === 'cima' ? -1 : d === 'direita' || d === 'baixo' ? 1 : 0
        if (!passo) continue
        this.opcao = (this.opcao + passo + this.opcoesFim.length) % this.opcoesFim.length
        tocar(this, 'mover')
      }
      this.atualizarCasual()
      this.cursorCasual.setAlpha(0.6 + 0.4 * Math.abs(Math.sin(time / 260)))
      if (this.liberado && this.aceite.ate != null) this.atualizarCasual() // a contagem
    }

    if (!this.dicaPular && !this.liberado && this.relogio > TEMPO.estouro) {
      this.dicaPular = this.add.text(LARGURA - 10, ALTURA - 10, 'A: pular', estilo(12, '#9090a0')).setOrigin(1, 1).setDepth(10)
    }
  }
}

const lado = (k) => (k === 0 ? -1 : 1)
