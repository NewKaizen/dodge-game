import Phaser from 'phaser'
import { UI } from '../tema.js'
import { get } from 'svelte/store'
import { irCarregando } from '../carregando.js'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { ASSETS } from '../assets.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { BATIDA, TELA } from '../menu/layout.js'
import { criarSala } from '../menu/sala.js'
import { criarTelao } from '../menu/telao.js'
import { criarLogo } from '../menu/logo.js'
import { criarMesa } from '../menu/mesa.js'
import { pref, definirPref, menosMovimento } from '../preferencias.js'
import { souHost, salaDoLink, siteNaInternet } from '../../lib/lan/rede.js'
import { conta } from '../../lib/conta.js'
import { bausConta, pedirBaus } from '../../lib/bausConta.js'
import { serialSuportado, listarJoysticks } from '../../lib/serial.js'
import { avatarDoPerfil } from '../../lib/contaRegras.js'
import { corDaMoldura, progressoDoXp } from '../../lib/progresso.js'
import { criarAvatar } from '../conta/ui.js'
import { montarAvisos } from '../conta/avisos.js'
import { semLigaduras } from '../campanha/texto.js'

// Tela inicial: a turma jogando cartas na mesa, com o caos preso no telão ao
// fundo (uma luta de balas rolando) (menu/mesa.js). Ou, com MENU INICIAL = SALA
// DE TV (Config > Gráficos), uma sala aconchegante com a turma sentada no tapete
// assistindo e a luz do telão iluminando tudo (menu/sala.js). Logo no canto de cima à esquerda, opções alinhadas à
// esquerda. CO-OP (-> EscolhaParty) e PVP (-> PvpEscolha): a luz do telão engole
// a sala. ONLINE (-> Lan: lobby para jogar com amigos, pela internet ou pela rede), GUIA (-> GuiaEntrada: MANUAL DO RALSEI ou Grimorio:
// todas as cartas com a prévia do ataque e as rodadas bônus de cada arena) e
// CONFIGURAÇÕES (-> Config), JOGAR RÁPIDO (-> Lan, já entrando na fila) e PERFIL (-> Perfil, a conta
// dentro do jogo) só escurecem a tela. JOGAR RÁPIDO e PERFIL só existem onde há conta ou internet
// (LAN sem internet não tem nenhum dos dois). CAMPANHA (-> Campanha, o modo história) aparece junto deles. O host de uma sala LAN que
// volta ao menu (fim da partida, SAIR da pausa) cai direto no lobby. Embaixo da lista, uma linha diz o que a
// opção escolhida faz; até alguém apertar uma tecla ou um botão do controle (ou o
// joystick serial já autorizado abrir), as opções ficam apagadas e a linha pede isso.
//
// Música: public/assets/musicas/menu.mid; sem o arquivo, toca a do Jevil. O
// nome no canto de cima vem de ASSETS.tituloMusicaMenu.
//
// As peças ficam em game/menu/ (layout.js, sala.js, telao.js, logo.js).
//   cima/baixo escolher · A confirmar
const TITULO = 'DODGE'
const SUBTITULO = 'DESVIE OU CAIA'
// Para onde vai o PVP: a escolha de personagem (PvpEscolha -> PvpArena -> PvpResultado)
const CENA_PVP = 'PvpEscolha'
const CO_OP = { id: 'coop', rotulo: 'CO-OP', cor: '#6dd0ff', cena: 'EscolhaParty', dica: 'cartas juntos contra um chefe' }
const PVP = { id: 'pvp', rotulo: 'PVP', cor: '#ff3d6e', cena: CENA_PVP, dica: 'duelo de cartas: quem desvia, vence' }
const ONLINE = { id: 'lan', rotulo: 'ONLINE', cor: '#3fd6c8', cena: 'Lan', dica: 'jogar com amigos (internet ou rede local)' }
const GUIA = { id: 'cartas', rotulo: 'GUIA', cor: '#b48cff', cena: 'GuiaEntrada', dica: 'manual do Ralsei, cartas e rodadas bônus das arenas' }
const CONFIG = { id: 'config', rotulo: 'CONFIGURAÇÕES', cor: '#f2c14e', cena: 'Config', dica: 'som, controles, acessibilidade e gráficos' }
const RAPIDO = { id: 'rapido', rotulo: 'JOGAR RÁPIDO', cor: '#ffd23a', cena: 'Lan', dados: { rapido: true }, dica: 'PVP 1x1 contra alguém da fila, já!' }
const PERFIL = { id: 'perfil', rotulo: 'PERFIL', cor: '#6dffb0', cena: 'Perfil', dica: '' }
// CAMPANHA (docs/campanha.md): o modo história, com conta e online (a cena avisa quem não está logado)
const CAMPANHA = { id: 'campanha', rotulo: 'CAMPANHA', cor: '#5fb8b0', cena: 'Campanha', dica: 'história com a Kris: A Casa Silenciosa' }
// DESAFIO DIÁRIO (docs/desafio-diario.md): um por dia, igual para todos; convidado joga sem recompensa
const DESAFIO = { id: 'desafio', rotulo: 'DESAFIO DIÁRIO', cor: '#ffb060', cena: 'DesafioDiario', dica: semLigaduras('um desafio por dia, o mesmo para todos: recorde e recompensa') }
// cenas que não explodem a sala: só escurecem a tela e abrem
const SO_ESCURECEM = ['config', 'cartas', 'lan', 'rapido', 'perfil', 'campanha', 'desafio']

// Joystick USB: o caminho do pareamento (CONFIGURAÇÕES → GAMEPAD) não aparece em lugar nenhum, então uma
// linha discreta no canto avisa. Só com Web Serial, sem joystick pareado nunca, e até o jogador abrir
// CONFIGURAÇÕES daqui uma vez (aí ele já sabe onde fica).
const dicaJoystickUsbVisivel = () =>
  serialSuportado() && !pref('dicaJoystickUsb') && Object.keys(pref('joysticksSerial') ?? {}).length === 0 && listarJoysticks().length === 0

// JOGAR RÁPIDO e PERFIL: onde há conta (ou o site está na internet, mesmo que as contas estejam fora do ar)
const comConta = () => siteNaInternet() || get(conta).estado !== 'indisponivel'
// (o DESAFIO DIÁRIO aparece também sem contas: o convidado joga, sem recompensa, em qualquer servidor)
const montarLista = (comContas) => (comContas ? [RAPIDO, CAMPANHA, DESAFIO, CO_OP, PVP, ONLINE, GUIA, PERFIL, CONFIG] : [CO_OP, PVP, ONLINE, DESAFIO, GUIA, CONFIG])

// A instância da cena é REAPROVEITADA pelo Phaser: o que a partida/abertura anterior
// deixou aqui (objetos já destruídos, flags) volta ao inicial no começo do create().
// Testado em src/game/__tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  realceMenu: null,
  modoTitulo: null,
  modoDescricao: null,
  sala: null,
  telao: null,
  painel: null,
  linhas: null,
  seta: null,
  aviso: null,
  miniatura: null,
  chaveMiniatura: null,
  barras: null,
  dicaUsb: null,
  ultimaDicaUsb: 0,
})

export default class Menu extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    Object.assign(this, estadoInicial())
    // host de uma sala LAN: o "menu" dele é o lobby. Aberto por um link
    // ?sala=CODIGO: vai direto para a tela ONLINE, que entra na sala
    if (souHost() || salaDoLink()) {
      this.scene.start('Lan')
      return
    }
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => botao === 'A' && this.confirmar())
    this.saindo = false
    this.pronto = false
    this.batidas = 0
    this.comContas = comConta()
    this.opcoes = montarLista(this.comContas)
    this.indice = Math.max(0, this.opcoes.findIndex((o) => o.id === this.registry.get('menuOpcao'))) // volta na opção de onde saiu
    const rapido = Boolean(this.registry.get('menuVisto'))
    this.registry.set('menuVisto', true)

    // o cenário: a MESA DE CARTAS (padrão) ou a SALA DE TV (Config > Gráficos > MENU INICIAL)
    const mesa = pref('menu') === 'mesa'
    this.pos = { x: 48, y: 216, passo: this.opcoes.length > 8 ? 23 : this.opcoes.length > 6 ? 25 : 34 }
    this.ponteiro = false
    if (mesa) {
      this.sala = criarMesa(this)
      this.telao = this.sala.telao
    } else {
      this.sala = criarSala(this, { tela: TELA })
      this.telao = criarTelao(this, TELA)
    }
    this.montarPortal()
    const area = { x: 32, y: 26, escala: 0.92 }
    this.logo = criarLogo(this, area, { titulo: TITULO, subtitulo: SUBTITULO, escala: area.escala ?? 1 })
    this.montarOpcoes()
    this.montarCantos()
    this.montarDicaUsb()
    montarAvisos(this)

    musica('menu', 'jevil')
    this.cameras.main.fadeIn(rapido ? 220 : 500)
    this.abrir(rapido)

    // a conta chegou (ou saiu): o PERFIL muda de cara; se o menu ganha ou perde JOGAR RÁPIDO e PERFIL, refaz
    const pararConta = conta.subscribe(() => {
      if (!this.pronto) return
      if (comConta() !== this.comContas && !this.saindo) return this.scene.restart()
      this.atualizarOpcoes()
    })
    // o selo de BAÚS fechados na linha do PERFIL (docs/baus.md): some e volta com a contagem
    const pararBaus = bausConta.subscribe(() => this.pronto && this.atualizarOpcoes())
    if (get(conta).estado === 'logado') pedirBaus()
    const aoConectar = () => this.atualizarOpcoes()
    this.registry.events.on('changedata-conectado', aoConectar)
    // o painel de cima pode mudar o número de jogadores: os controles mudam junto
    const aoMudar = (_, valor, anterior) => valor !== anterior && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => {
      pararConta()
      pararBaus()
      this.registry.events.off('changedata-conectado', aoConectar)
      this.registry.events.off('changedata-numJogadores', aoMudar)
    })
  }

  // a TV liga, o logo entra e as opções deslizam da esquerda
  async abrir(rapido) {
    await this.telao.ligar({ rapido })
    if (!this.scene.isActive()) return
    this.time.addEvent({ delay: BATIDA, loop: true, callback: () => this.batida() })
    await this.logo.entrar({ rapido })
    if (!this.scene.isActive()) return
    this.pronto = true
    if (comConta() !== this.comContas) return this.scene.restart() // a conta chegou enquanto o menu abria
    this.atualizarOpcoes()
    this.tweens.add({ targets: this.painel, x: 0, alpha: 1, duration: rapido ? 120 : 320, ease: 'Cubic.easeOut' })
  }

  batida() {
    if (this.saindo || menosMovimento()) return
    const n = ++this.batidas
    this.telao.batida(n)
    this.sala.batida(n)
    this.logo.batida(n)
    this.barras?.forEach((b, i) => this.tweens.add({ targets: b, scaleY: Phaser.Math.FloatBetween(0.3, 1), duration: BATIDA * 0.45, yoyo: true, delay: i * 25 }))
  }

  // ---------- opções (alinhadas à esquerda, cada uma com a sua cor) ----------

  montarPortal() {
    const g = this.add.graphics().setDepth(19)
    // Uma superfície própria mantém o menu legível sem apagar a ilustração.
    g.fillStyle(UI.fundo, 0.97).fillRect(0, 0, 304, ALTURA)
    for (let i = 0; i < 48; i++) g.fillStyle(UI.fundo, 0.65 * (1 - i / 48)).fillRect(304 + i, 0, 1, ALTURA)
    g.lineStyle(1, UI.linha, 0.9).lineBetween(24, 174, 276, 174)
    g.fillStyle(UI.ciano).fillRect(24, 174, 56, 2)
    g.fillStyle(UI.coral).fillRect(24, 24, 4, 12)
    const estilo = { fontFamily: FONTE, fontSize: '10px', color: UI.secundario }
    this.add.text(38, 25, 'CARTAS. CAOS. CORAGEM.', estilo).setDepth(30).setLetterSpacing(1)
    this.add.text(32, 188, 'ESCOLHA SEU PRÓXIMO DESAFIO', estilo).setDepth(30)
    g.fillStyle(UI.fundo, 0.9).fillRoundedRect(364, 359, 458, 82, 6)
    g.fillStyle(UI.ciano).fillRect(364, 371, 3, 58)
    this.modoTitulo = this.add.text(382, 372, '', { fontFamily: FONTE, fontSize: '23px', color: UI.texto }).setDepth(30)
    this.modoDescricao = this.add.text(382, 405, '', { ...estilo, fontSize: '13px', wordWrap: { width: 416 }, lineSpacing: 3 }).setDepth(30)
  }

  montarOpcoes() {
    this.painel = this.add.container(-16, 0).setDepth(30).setAlpha(0)
    this.realceMenu = this.add.graphics()
    this.painel.add(this.realceMenu)
    const tamanho = this.opcoes.length > 6 ? 18 : 22
    this.linhas = this.opcoes.map((o, i) => {
      const y = this.pos.y + i * this.pos.passo
      const zona = this.add.zone(24, y - this.pos.passo / 2, 258, this.pos.passo).setOrigin(0).setInteractive({ useHandCursor: true })
      zona.on('pointerover', () => {
        if (!this.pronto || this.saindo) return
        this.ponteiro = true
        if (this.indice !== i) this.selecionar(i)
        else this.atualizarOpcoes()
      })
      zona.on('pointerdown', () => {
        if (!this.pronto || this.saindo) return
        this.ponteiro = true
        this.indice = i
        this.atualizarOpcoes()
        this.confirmar()
      })
      this.painel.add(zona)
      return this.add.text(this.pos.x, y, o.rotulo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: UI.texto }).setOrigin(0, 0.5)
    })
    this.seta = this.add.text(260, 0, '›', { fontFamily: FONTE, fontSize: '24px', color: UI.destaque }).setOrigin(0.5)
    this.aviso = this.add.text(32, 425, '', { fontFamily: FONTE, fontSize: '11px', color: UI.secundario, wordWrap: { width: 248 }, lineSpacing: 3 })
    this.miniatura = null
    this.chaveMiniatura = null
    this.painel.add([...this.linhas, this.seta, this.aviso])
  }

  // o texto de baixo da lista: o que a opção faz (o PERFIL diz quem é você)
  dicaDe(opcao) {
    if (opcao.id !== 'perfil') return opcao.dica
    const c = get(conta)
    if (c.estado === 'logado' && c.perfil) {
      const baus = get(bausConta).fechados
      return `${c.perfil.nome_exibicao} · nível ${progressoDoXp(c.perfil.xp).nivel}${baus > 0 ? `\n${baus} BAÚ${baus > 1 ? 'S' : ''} PARA ABRIR (COLEÇÃO)` : ''}`
    }
    if (c.estado === 'deslogado') return 'entre com o Google: XP, amigos e coleção'
    if (c.estado === 'indisponivel') return 'contas fora do ar: você joga como convidado'
    return 'carregando a conta…'
  }

  // o avatar com a moldura fica na margem esquerda da linha do PERFIL
  atualizarMiniatura() {
    const i = this.opcoes.findIndex((o) => o.id === 'perfil')
    const c = get(conta)
    if (i < 0 || c.estado !== 'logado' || !c.perfil) {
      this.miniatura?.destroy()
      this.miniatura = null
      this.chaveMiniatura = null
      return
    }
    const sel = i === this.indice && this.conectado
    const x = this.pos.x - 16 + (sel ? 8 : 0)
    const y = this.linhas[i].y
    const avatar = avatarDoPerfil(c.perfil)
    // só recria quando o avatar ou a moldura mudam; a cada tecla, só move (recriar fazia a foto piscar)
    const chave = JSON.stringify([avatar, c.perfil.moldura_equipada])
    if (this.miniatura?.scene && this.chaveMiniatura === chave) {
      this.miniatura.setPosition(x, y)
      return
    }
    this.miniatura?.destroy()
    this.miniatura = criarAvatar(this, x, y, avatar, 20, corDaMoldura(c.perfil.moldura_equipada))
    this.chaveMiniatura = chave
    this.painel.add(this.miniatura)
  }

  get conectado() {
    return this.ponteiro || Boolean(this.registry.get('conectado'))
  }

  atualizarOpcoes() {
    const opcao = this.opcoes[this.indice]
    this.linhas.forEach((l, i) => {
      l.setColor(i === this.indice ? UI.destaque : UI.texto).setAlpha(i === this.indice ? 1 : 0.78)
      l.setX(this.pos.x)
    })
    const l = this.linhas[this.indice]
    this.realceMenu.clear().fillStyle(UI.elevado, 1).fillRoundedRect(24, l.y - this.pos.passo / 2 + 1, 258, this.pos.passo - 2, 3)
    this.realceMenu.fillStyle(UI.ciano).fillRect(24, l.y - this.pos.passo / 2 + 1, 3, this.pos.passo - 2)
    this.seta.setVisible(true).setPosition(266, l.y)
    this.aviso.setText(semLigaduras(this.conectado ? '↑↓ escolher · A confirmar  ou clique' : 'Clique para escolher ou conecte\num teclado / controle.')).setColor(UI.secundario)
    this.modoTitulo.setText(opcao.rotulo).setColor(opcao.cor)
    this.modoDescricao.setText(this.dicaDe(opcao))
    this.atualizarMiniatura()
  }

  selecionar(indice) {
    this.indice = (indice + this.opcoes.length) % this.opcoes.length
    tocar(this, 'mover')
    this.atualizarOpcoes()
  }

  // ---------- cantos: música tocando (cima, direita) e botões (baixo, direita) ----------

  montarCantos() {
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor })
    const y = 22
    const nome = this.add.text(LARGURA - 14, y, ASSETS.tituloMusicaMenu, estilo(11, '#c8c8d8')).setOrigin(1, 0.5).setDepth(30)
    const xBarras = nome.x - nome.width - 26
    this.add.rectangle(xBarras - 8, y - 11, LARGURA - xBarras - 6 + 8, 22, 0x000000, 0.45).setOrigin(0).setDepth(29)
    this.barras = [0, 1, 2, 3].map((i) =>
      this.add.rectangle(xBarras + i * 5, y + 7, 3, 14, 0x3fd6c8).setOrigin(0.5, 1).setDepth(30).setScale(1, 0.5),
    )
    this.add.rectangle(LARGURA - 196, ALTURA - 32, 190, 28, 0x000000, 0.5).setOrigin(0).setDepth(29)
    const dica = (x, letra, texto) => {
      this.add.circle(x, ALTURA - 18, 7).setStrokeStyle(1.5, 0xc8c8d8).setDepth(30)
      this.add.text(x, ALTURA - 18, letra, estilo(10, '#c8c8d8')).setOrigin(0.5).setDepth(30)
      return this.add.text(x + 12, ALTURA - 18, texto, estilo(11, '#c8c8d8')).setOrigin(0, 0.5).setDepth(30)
    }
    dica(LARGURA - 92, 'A', 'ESCOLHER')
    this.add.text(LARGURA - 108, ALTURA - 18, '↑↓ MOVER', estilo(11, '#c8c8d8')).setOrigin(1, 0.5).setDepth(30)
  }

  // o aviso do joystick USB, no canto de baixo à direita, acima da barra de botões
  montarDicaUsb() {
    if (!dicaJoystickUsbVisivel()) return
    this.dicaUsb = this.add
      .text(LARGURA - 14, ALTURA - 132, 'JOYSTICK USB · CONFIGURAÇÕES → GAMEPAD', { fontFamily: FONTE, fontSize: '11px', color: '#c8c8d8', backgroundColor: 'rgba(0,0,0,0.45)', padding: { x: 6, y: 3 } })
      .setOrigin(1, 0.5)
      .setDepth(30)
  }

  confirmar() {
    if (this.saindo || !this.pronto || !this.conectado) return
    this.saindo = true
    const opcao = this.opcoes[this.indice]
    this.registry.set('menuOpcao', opcao.id)
    if (opcao.id === 'config') definirPref('dicaJoystickUsb', true) // quem abriu CONFIGURAÇÕES já viu o caminho
    if (SO_ESCURECEM.includes(opcao.id)) {
      tocar(this, 'confirmar')
      this.cameras.main.fadeOut(220, 0, 0, 0)
      this.time.delayedCall(240, () => irCarregando(this, opcao.cena, { voltar: 'Menu', pilha: [{ cena: 'Menu' }], ...opcao.dados }))
      return
    }
    // CO-OP/PVP: o logo e as opções somem e a luz do telão engole a sala
    this.registry.set('modo', opcao.id)
    tocar(this, 'superAtivar')
    this.logo.sair()
    this.tweens.add({ targets: this.painel, x: -60, alpha: 0, duration: 220, ease: 'Cubic.easeIn' })
    this.telao.explodir().then(() => this.scene.isActive() && irCarregando(this, opcao.cena))
  }

  update(time, delta) {
    if (!this.controles) return // foi direto para o lobby LAN
    this.controles.atualizar()
    if (this.pronto && !this.saindo && this.conectado) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima' || d === 'esquerda') this.selecionar(this.indice - 1)
        if (d === 'baixo' || d === 'direita') this.selecionar(this.indice + 1)
      }
    }
    // pareou o joystick USB com o menu aberto (botão lá em cima): a dica some na hora
    if (this.dicaUsb && time - (this.ultimaDicaUsb ?? 0) > 500) {
      this.ultimaDicaUsb = time
      if (!dicaJoystickUsbVisivel()) {
        this.dicaUsb.destroy()
        this.dicaUsb = null
      }
    }
    this.sala.iluminar(this.telao.cor())
    this.sala.atualizar(delta)
    this.telao.atualizar(delta)
    this.logo.atualizar(delta)
    if (this.pronto && !this.saindo && this.seta.visible) this.seta.setX(266 + (menosMovimento() ? 0 : Math.sin(time / 250) * 2))
  }
}
