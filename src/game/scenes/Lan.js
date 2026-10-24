import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar, musica, pararMusica } from '../audio.js'
import { ASSETS } from '../assets.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { capturarTexto } from '../../lib/simulador.js'
import {
  lan,
  abrirLobby,
  fecharLobby,
  criarSala,
  entrarSala,
  entrarCodigo,
  conectarIp,
  sairSala,
  alternarPronto,
  mudarModo,
  enviarChat,
  expulsar,
  mudarNome,
  iniciarPartida,
  encerrarPartida,
} from '../../lib/lan/rede.js'
import { tela } from '../../lib/lan/transmissao.js'

// Lobby do modo LAN e do ONLINE (Menu -> ONLINE; docs/lan.md, docs/online.md).
// Quem decide é o servidor que serviu a página: `npm run lan` é LAN, o site na
// internet (`npm start`) é ONLINE. Três telas, conforme o estado da rede
// (lib/lan/rede.js):
//   SALAS       seu nome, criar sala, as salas achadas na rede, conectar por IP
//               (ONLINE: seu nome, criar sala e entrar com o código do amigo;
//               na primeira vez o jogo já pede o nome)
//   SALA        os dois jogadores (nome, ping, pronto), o modo (PVP/CO-OP),
//               o chat e as ações; o host começa quando o convidado está pronto
//   ASSISTINDO  (convidado, com a partida rolando) a imagem do host cobre esta
//               tela (Game.svelte); enquanto ela não chega, um aviso
// O host joga a partida normal (PvpEscolha / EscolhaParty) com 2 jogadores; o
// Menu manda o host de volta para cá enquanto ele estiver numa sala.
//
// Música: public/assets/musicas/lobby.mid (sem ele, a do menu). O nome no
// canto vem de ASSETS.tituloMusicaLobby.
//   cima/baixo escolher · esquerda/direita mudar o modo · A confirmar · B voltar
const COR = { tema: '#3fd6c8', temaNum: 0x3fd6c8, ok: '#6dffb0', okNum: 0x6dffb0, painel: 0x0b0914, apagado: '#5a5a6a' }
const MODOS = { pvp: { rotulo: 'PVP', cor: '#ff3d6e', cena: 'PvpEscolha' }, coop: { rotulo: 'CO-OP', cor: '#6dd0ff', cena: 'EscolhaParty' } }
const LINHAS_SALAS = 5 // salas visíveis na lista
const LINHAS_CHAT = 9

export default class Lan extends Phaser.Scene {
  constructor() {
    super('Lan')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))
    this.controles.onPausa(() => {}) // no lobby o C não faz nada
    this.selId = null
    this.digitando = null // { campo: 'nome' | 'ip' | 'chat', texto }
    this.cancelarTexto = null
    this.assinatura = ''
    this.saindo = false
    this.comecando = false
    this.musicaTocando = false
    this.pediuNome = false // online: já abriu o campo do nome sozinho
    this.view = this.add.container(0, 0).setDepth(10)
    this.dinamicos = [] // objetos animados no update() (cursor, pontinhos)

    this.montarFundo()
    this.montarCabecalho()

    abrirLobby()
    this.s = null
    this.tela = null
    const pararLan = lan.subscribe((s) => (this.s = s))
    const pararTela = tela.subscribe((t) => (this.tela = t))
    // voltou de uma partida (o Menu mandou para cá): avisa que acabou
    if (this.s.papel === 'host' && this.s.sala?.emPartida) encerrarPartida()

    this.events.once('shutdown', () => {
      pararLan()
      pararTela()
      this.cancelarTexto?.()
    })
    this.cameras.main.fadeIn(300)
  }

  // ---------- fundo: uma rede de pontos com pacotes indo e voltando ----------

  montarFundo() {
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x05040b).setOrigin(0).setDepth(-20)
    const rnd = new Phaser.Math.RandomDataGenerator(['lan'])
    this.nos = Array.from({ length: 22 }, () => ({ x: rnd.between(20, LARGURA - 20), y: rnd.between(60, ALTURA - 30), fase: rnd.frac() * Math.PI * 2 }))
    this.ligacoes = []
    this.nos.forEach((a, i) => {
      const perto = this.nos
        .map((b, j) => ({ j, d: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 2)
      for (const { j } of perto) if (!this.ligacoes.some(([p, q]) => (p === j && q === i) || (p === i && q === j))) this.ligacoes.push([i, j])
    })
    this.pacotes = Array.from({ length: 10 }, () => ({ ligacao: rnd.between(0, this.ligacoes.length - 1), t: rnd.frac(), v: rnd.realInRange(0.25, 0.6), ida: rnd.frac() < 0.5 }))
    this.redeGfx = this.add.graphics().setDepth(-15)
    const linhas = this.add.graphics().setDepth(-14)
    linhas.fillStyle(0x000000, 0.18)
    for (let y = 0; y < ALTURA; y += 3) linhas.fillRect(0, y, LARGURA, 1)
  }

  desenharRede(time, delta) {
    const g = this.redeGfx
    g.clear()
    g.lineStyle(1, COR.temaNum, 0.12)
    for (const [i, j] of this.ligacoes) g.lineBetween(this.nos[i].x, this.nos[i].y, this.nos[j].x, this.nos[j].y)
    for (const n of this.nos) {
      const brilho = 0.25 + 0.2 * Math.sin(time / 700 + n.fase)
      g.fillStyle(COR.temaNum, brilho)
      g.fillRect(n.x - 2, n.y - 2, 4, 4)
    }
    for (const p of this.pacotes) {
      p.t += (p.v * delta) / 1000
      if (p.t >= 1) {
        p.t = 0
        p.ligacao = Phaser.Math.Between(0, this.ligacoes.length - 1)
        p.ida = Math.random() < 0.5
      }
      const [i, j] = this.ligacoes[p.ligacao]
      const [a, b] = p.ida ? [this.nos[i], this.nos[j]] : [this.nos[j], this.nos[i]]
      g.fillStyle(p.ida ? COR.okNum : 0xffd23a, 0.7)
      g.fillRect(Phaser.Math.Linear(a.x, b.x, p.t) - 1.5, Phaser.Math.Linear(a.y, b.y, p.t) - 1.5, 3, 3)
    }
  }

  montarCabecalho() {
    const t = this.texto.bind(this)
    this.titulo = t(24, 26, 'LAN', 34, COR.tema, { strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(20)
    this.subtitulo = t(92, 30, 'JOGUE COM OUTRO PC DA REDE', 12, '#9a9ab0').setOrigin(0, 0.5).setDepth(20)
    // música tocando (canto de cima, como no menu)
    const y = 22
    const nome = t(LARGURA - 14, y, ASSETS.tituloMusicaLobby, 11, '#c8c8d8', { strokeThickness: 0 }).setOrigin(1, 0.5).setDepth(20)
    const xBarras = nome.x - nome.width - 26
    this.add.rectangle(xBarras - 8, y - 11, LARGURA - xBarras - 6 + 8, 22, 0x000000, 0.45).setOrigin(0).setDepth(19)
    this.barras = [0, 1, 2, 3].map((i) => this.add.rectangle(xBarras + i * 5, y + 7, 3, 14, COR.temaNum).setOrigin(0.5, 1).setDepth(20))
  }

  texto(x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
  }

  // ---------- estado -> tela ----------

  get modoTela() {
    const s = this.s
    if (s.fase === 'sala' && s.papel === 'convidado' && s.sala?.emPartida) return 'assistindo'
    if (s.fase === 'sala') return 'sala'
    return 'salas'
  }

  // o servidor diz se é ONLINE só nas boas-vindas: o título acompanha
  atualizarTitulo() {
    const { online, fase } = this.s
    if (fase === 'conectando' && !online) {
      // ainda não sabe: nem LAN nem ONLINE
      this.titulo.setText('')
      this.subtitulo.setText('')
      return
    }
    this.titulo.setText(online ? 'ONLINE' : 'LAN')
    this.subtitulo.setX(this.titulo.x + this.titulo.width + 14).setText(online ? 'JOGUE COM SEUS AMIGOS PELA INTERNET' : 'JOGUE COM OUTRO PC DA REDE')
  }

  itens() {
    const s = this.s
    if (this.modoTela === 'salas' && s.online)
      return [
        { id: 'nome', tipo: 'nome', acao: () => this.digitar('nome') },
        { id: 'criar', rotulo: '+ CRIAR SALA', ativo: s.fase === 'navegando', acao: () => criarSala() },
        { id: 'codigo', rotulo: 'ENTRAR COM CÓDIGO…', ativo: s.fase === 'navegando', acao: () => this.digitar('codigo') },
      ]
    if (this.modoTela === 'salas') {
      const lista = [
        { id: 'nome', tipo: 'nome', acao: () => this.digitar('nome') },
        { id: 'criar', rotulo: '+ CRIAR SALA', ativo: s.fase === 'navegando', acao: () => criarSala() },
      ]
      for (const sala of s.salas) {
        const livre = !sala.emPartida && sala.jogadores < sala.max
        lista.push({ id: `sala-${sala.id}`, tipo: 'sala', sala, ativo: livre && s.fase === 'navegando', acao: () => entrarSala(sala) })
      }
      lista.push({ id: 'ip', rotulo: 'CONECTAR POR IP…', acao: () => this.digitar('ip') })
      return lista
    }
    if (this.modoTela === 'sala') {
      const host = s.papel === 'host'
      const outro = s.sala.membros.find((m) => m.id !== s.eu.id)
      const eu = s.sala.membros.find((m) => m.id === s.eu.id)
      if (host)
        return [
          { id: 'modo', tipo: 'modo', acao: () => this.trocarModo(1) },
          { id: 'comecar', rotulo: 'COMEÇAR PARTIDA', ativo: Boolean(outro?.pronto), acao: () => this.comecar() },
          { id: 'chat', rotulo: 'CONVERSAR', acao: () => this.digitar('chat') },
          ...(outro ? [{ id: 'expulsar', rotulo: `TIRAR ${outro.nome}`, acao: () => expulsar() }] : []),
          { id: 'sair', rotulo: 'FECHAR SALA', acao: () => this.sairDaSala() },
        ]
      return [
        { id: 'pronto', rotulo: eu?.pronto ? 'NÃO ESTOU PRONTO' : 'ESTOU PRONTO!', acao: () => alternarPronto() },
        { id: 'chat', rotulo: 'CONVERSAR', acao: () => this.digitar('chat') },
        { id: 'sair', rotulo: 'SAIR DA SALA', acao: () => this.sairDaSala() },
      ]
    }
    return []
  }

  indiceSelecionado(itens) {
    let i = itens.findIndex((it) => it.id === this.selId)
    if (i < 0) {
      // padrão: a primeira ação útil (criar sala / começar / pronto)
      i = Math.max(0, itens.findIndex((it) => ['criar', 'comecar', 'pronto'].includes(it.id)))
      this.selId = itens[i]?.id ?? null
    }
    return i
  }

  // Remonta a tela quando algo que aparece nela mudou
  redesenhar() {
    const s = this.s
    const itens = this.itens()
    const i = this.indiceSelecionado(itens)
    const assinatura = JSON.stringify([this.modoTela, s.fase, s.online, s.eu.nome, s.salas, s.sala, s.chat.length, s.erro, s.enderecos, this.selId, this.digitando, this.tela?.estado, this.tela?.modo])
    if (assinatura === this.assinatura) return
    this.assinatura = assinatura
    this.view.removeAll(true)
    this.dinamicos = []
    this.atualizarTitulo()
    if (this.modoTela === 'salas' && s.online) this.telaOnline(itens, i)
    else if (this.modoTela === 'salas') this.telaSalas(itens, i)
    else if (this.modoTela === 'sala') this.telaSala(itens, i)
    else this.telaAssistindo()
    this.atualizarMusica()
  }

  add2(obj) {
    this.view.add(obj)
    return obj
  }

  // a linha do cursor (coração) que pisca no update()
  cursor(x, y) {
    const c = this.add2(this.add.image(x, y, 'coracao').setTint(CORES.almas[0]).setScale(1.1))
    this.dinamicos.push({ tipo: 'cursor', obj: c, x })
  }

  campoTexto(campo, valor) {
    if (this.digitando?.campo !== campo) return valor
    return `${this.digitando.texto}${Math.floor(this.time.now / 400) % 2 ? '_' : ' '}`
  }

  telaSalas(itens, sel) {
    const s = this.s
    const t = (...a) => this.add2(this.texto(...a))
    // nome
    const selNome = sel === 0
    t(40, 76, 'SEU NOME:', 14, '#9a9ab0').setOrigin(0, 0.5)
    const nome = t(130, 76, this.campoTexto('nome', s.eu.nome), 16, this.digitando?.campo === 'nome' ? TEXTO.selecionado : TEXTO.normal).setOrigin(0, 0.5)
    if (this.digitando?.campo === 'nome') this.dinamicos.push({ tipo: 'campo', obj: nome, campo: 'nome' })
    else t(nome.x + nome.width + 10, 76, selNome ? '(A: mudar)' : '', 11, COR.apagado).setOrigin(0, 0.5)
    if (selNome) this.cursor(24, 76)

    // painel com criar / salas / IP
    const topo = 100
    const passo = 34
    this.add2(this.add.rectangle(20, topo - 6, LARGURA - 40, passo * (LINHAS_SALAS + 2) + 34, COR.painel, 0.82).setOrigin(0).setStrokeStyle(2, COR.temaNum, 0.6))
    t(36, topo + 6, 'SALAS NA REDE', 12, COR.tema).setOrigin(0, 0.5)
    t(LARGURA - 36, topo + 6, s.fase === 'conectando' ? 'conectando…' : `${s.salas.length} encontrada${s.salas.length === 1 ? '' : 's'}`, 11, '#9a9ab0').setOrigin(1, 0.5)

    const salas = itens.filter((it) => it.tipo === 'sala')
    const iSala = salas.findIndex((it) => it.id === this.selId)
    const inicio = Phaser.Math.Clamp(iSala - Math.floor(LINHAS_SALAS / 2), 0, Math.max(0, salas.length - LINHAS_SALAS))
    const visiveis = [itens[1], ...salas.slice(inicio, inicio + LINHAS_SALAS), itens.at(-1)]
    visiveis.forEach((it, k) => {
      const y = topo + 34 + k * passo
      const ativo = it.ativo !== false
      const selecionado = it.id === this.selId
      if (selecionado) {
        this.add2(this.add.rectangle(30, y - passo / 2 + 3, LARGURA - 60, passo - 6, COR.temaNum, 0.12).setOrigin(0))
        this.cursor(44, y)
      }
      if (it.tipo === 'sala') {
        const sala = it.sala
        const modo = MODOS[sala.modo] ?? MODOS.pvp
        t(60, y - 6, sala.nome, 15, ativo ? TEXTO.normal : COR.apagado).setOrigin(0, 0.5)
        t(60, y + 9, `de ${sala.host}${sala.ip ? `  ·  ${sala.ip}` : ''}`, 10, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0, 0.5)
        t(LARGURA - 150, y, modo.rotulo, 13, ativo ? modo.cor : COR.apagado).setOrigin(0.5)
        const situacao = sala.emPartida ? 'JOGANDO' : sala.jogadores >= sala.max ? 'CHEIA' : `${sala.jogadores}/${sala.max}`
        t(LARGURA - 44, y, situacao, 13, ativo ? COR.ok : COR.apagado).setOrigin(1, 0.5)
        return
      }
      if (it.id === 'ip' && this.digitando?.campo === 'ip') {
        const campo = t(60, y, `IP: ${this.campoTexto('ip', '')}`, 16, TEXTO.selecionado).setOrigin(0, 0.5)
        this.dinamicos.push({ tipo: 'campo', obj: campo, campo: 'ip', prefixo: 'IP: ' })
        t(LARGURA - 44, y, 'ex.: 192.168.0.10', 11, COR.apagado).setOrigin(1, 0.5)
        return
      }
      t(60, y, it.rotulo, 16, ativo ? (it.id === 'criar' ? COR.ok : TEXTO.normal) : COR.apagado).setOrigin(0, 0.5)
    })
    if (!salas.length && s.fase === 'navegando') {
      const vazio = t(LARGURA / 2, topo + 34 + 1.5 * passo + 8, 'procurando salas', 13, COR.apagado).setOrigin(0.5)
      this.dinamicos.push({ tipo: 'pontos', obj: vazio, base: 'procurando salas' })
    }

    // dicas
    const yInfo = topo + passo * (LINHAS_SALAS + 2) + 46
    if (s.erro) t(LARGURA / 2, yInfo, s.erro, 13, '#ff6070', { wordWrap: { width: LARGURA - 60 }, align: 'center' }).setOrigin(0.5)
    const endereco = s.enderecos?.[0]
    t(LARGURA / 2, yInfo + 30, endereco ? `no outro PC, abra  ${endereco}  no Chrome/Edge` : 'o outro PC precisa estar na mesma rede (Wi-Fi ou cabo)', 12, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0.5)
    this.rodape(this.digitando ? 'digite  ·  Enter: confirmar  ·  Esc: cancelar' : '↑↓ escolher     A: confirmar     B: voltar ao menu')
  }

  // ONLINE: sem lista de salas (são privadas); cria a sua ou entra com o código
  telaOnline(itens, sel) {
    const s = this.s
    const t = (...a) => this.add2(this.texto(...a))
    const escolhendo = this.digitando?.campo === 'nome'

    // nome de usuário
    const yNome = 92
    this.add2(this.add.rectangle(20, yNome - 26, LARGURA - 40, 52, COR.painel, 0.82).setOrigin(0).setStrokeStyle(2, escolhendo ? COR.okNum : COR.temaNum, 0.6))
    t(40, yNome, escolhendo && !s.eu.escolheuNome ? 'ESCOLHA SEU NOME:' : 'SEU NOME:', 14, escolhendo ? COR.ok : '#9a9ab0').setOrigin(0, 0.5)
    const xNome = escolhendo && !s.eu.escolheuNome ? 196 : 130
    const nome = t(xNome, yNome, this.campoTexto('nome', s.eu.nome), 16, escolhendo ? TEXTO.selecionado : TEXTO.normal).setOrigin(0, 0.5)
    if (escolhendo) this.dinamicos.push({ tipo: 'campo', obj: nome, campo: 'nome' })
    else t(nome.x + nome.width + 10, yNome, sel === 0 ? '(A: mudar)' : '', 11, COR.apagado).setOrigin(0, 0.5)
    if (sel === 0) this.cursor(24, yNome)

    // criar / entrar com código
    const topo = 150
    const passo = 46
    this.add2(this.add.rectangle(20, topo - 6, LARGURA - 40, passo * 2 + 50, COR.painel, 0.82).setOrigin(0).setStrokeStyle(2, COR.temaNum, 0.6))
    t(36, topo + 8, 'JOGAR COM UM AMIGO', 12, COR.tema).setOrigin(0, 0.5)
    t(LARGURA - 36, topo + 8, s.fase === 'conectando' ? 'conectando…' : s.fase === 'navegando' ? 'conectado' : '', 11, '#9a9ab0').setOrigin(1, 0.5)
    const explica = { criar: 'você vira o host e recebe um código para passar', codigo: 'digite o código que o seu amigo passou' }
    itens.slice(1).forEach((it, k) => {
      const y = topo + 44 + k * passo
      const ativo = it.ativo !== false
      if (it.id === this.selId) {
        this.add2(this.add.rectangle(30, y - passo / 2 + 4, LARGURA - 60, passo - 8, COR.temaNum, 0.12).setOrigin(0))
        this.cursor(44, y)
      }
      if (it.id === 'codigo' && this.digitando?.campo === 'codigo') {
        const campo = t(60, y - 6, `CÓDIGO: ${this.campoTexto('codigo', '')}`, 16, TEXTO.selecionado).setOrigin(0, 0.5)
        this.dinamicos.push({ tipo: 'campo', obj: campo, campo: 'codigo', prefixo: 'CÓDIGO: ' })
      } else t(60, y - 6, it.rotulo, 16, ativo ? (it.id === 'criar' ? COR.ok : TEXTO.normal) : COR.apagado).setOrigin(0, 0.5)
      t(60, y + 11, explica[it.id], 10, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0, 0.5)
    })

    const yInfo = topo + passo * 2 + 74
    if (s.erro) t(LARGURA / 2, yInfo, s.erro, 13, '#ff6070', { wordWrap: { width: LARGURA - 60 }, align: 'center' }).setOrigin(0.5)
    t(LARGURA / 2, yInfo + 34, `o amigo abre  ${location.host}  no Chrome/Edge`, 12, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0.5)
    t(LARGURA / 2, yInfo + 54, 'o jogo roda no PC do host; o convidado recebe a imagem e manda os controles', 10, COR.apagado, { strokeThickness: 0 }).setOrigin(0.5)
    this.rodape(this.digitando ? 'digite  ·  Enter: confirmar  ·  Esc: cancelar' : '↑↓ escolher     A: confirmar     B: voltar ao menu')
  }

  telaSala(itens, sel) {
    const s = this.s
    const sala = s.sala
    const t = (...a) => this.add2(this.texto(...a))
    const host = s.papel === 'host'
    const modo = MODOS[sala.modo] ?? MODOS.pvp

    if (s.online && sala.codigo) {
      t(LARGURA / 2, 62, sala.nome, 16, TEXTO.normal, { strokeThickness: 4 }).setOrigin(0.5)
      t(LARGURA / 2, 80, `CÓDIGO: ${sala.codigo}`, 14, COR.ok).setOrigin(0.5)
    } else t(LARGURA / 2, 70, sala.nome, 20, TEXTO.normal, { strokeThickness: 4 }).setOrigin(0.5)

    // os dois jogadores
    const vagas = [sala.membros.find((m) => m.papel === 'host'), sala.membros.find((m) => m.papel === 'convidado')]
    vagas.forEach((m, j) => {
      const x = j === 0 ? 40 : LARGURA / 2 + 10
      const largura = LARGURA / 2 - 50
      const y = 92
      const cor = CORES.almas[j]
      this.add2(this.add.rectangle(x, y, largura, 112, COR.painel, 0.88).setOrigin(0).setStrokeStyle(2, m ? cor : 0x3a3a4a))
      const coracao = this.add2(this.add.image(x + 26, y + 30, 'coracao').setTint(m ? cor : 0x3a3a4a).setScale(1.6))
      if (m) this.dinamicos.push({ tipo: 'pulso', obj: coracao, fase: j })
      t(x + 46, y + 22, `P${j + 1} · ${j === 0 ? 'HOST' : 'CONVIDADO'}`, 11, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0, 0.5)
      if (!m) {
        const espera = t(x + 46, y + 44, 'vaga livre', 16, COR.apagado).setOrigin(0, 0.5)
        this.dinamicos.push({ tipo: 'pontos', obj: espera, base: 'esperando alguém' })
        const endereco = s.online ? null : s.enderecos?.[0]
        if (host && s.online) t(x + 14, y + 80, `passe o código ${sala.codigo}\npara o seu amigo`, 11, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0, 0.5)
        if (host && endereco) t(x + 14, y + 84, `outro PC: ${endereco}`, 11, '#9a9ab0', { strokeThickness: 0, wordWrap: { width: largura - 24 } }).setOrigin(0, 0.5)
        return
      }
      const voce = m.id === s.eu.id ? '  (você)' : ''
      t(x + 46, y + 44, `${m.nome}${voce}`, 16, TEXTO.normal).setOrigin(0, 0.5)
      const ping = m.papel === 'host' && s.papel === 'host' ? 'neste PC' : m.ping != null ? `ping ${m.ping} ms` : 'ping …'
      const pingAlto = s.online ? 150 : 60
      t(x + 14, y + 84, ping, 11, m.ping != null && m.ping > pingAlto ? '#ffb040' : '#9a9ab0', { strokeThickness: 0 }).setOrigin(0, 0.5)
      const pronto = m.papel === 'host' || m.pronto
      t(x + largura - 14, y + 84, m.papel === 'host' ? 'ESCOLHE O MODO' : pronto ? 'PRONTO!' : 'ESPERANDO…', 12, pronto ? COR.ok : '#ffb040').setOrigin(1, 0.5)
    })

    // ações (esquerda)
    const xOp = 40
    const yOp = 236
    itens.forEach((it, k) => {
      const y = yOp + k * 30
      const ativo = it.ativo !== false
      if (k === sel) this.cursor(xOp - 14, y)
      if (it.tipo === 'modo') {
        t(xOp + 6, y, 'MODO', 15, ativo ? TEXTO.normal : COR.apagado).setOrigin(0, 0.5)
        t(xOp + 140, y, `◀ ${modo.rotulo} ▶`, 15, modo.cor).setOrigin(0.5)
        return
      }
      if (it.id === 'chat' && this.digitando?.campo === 'chat') {
        const campo = t(xOp + 6, y, `> ${this.campoTexto('chat', '')}`, 13, TEXTO.selecionado, { fixedWidth: 236 }).setOrigin(0, 0.5)
        this.dinamicos.push({ tipo: 'campo', obj: campo, campo: 'chat', prefixo: '> ' })
        return
      }
      const cor = it.id === 'comecar' || it.id === 'pronto' ? (ativo ? COR.ok : COR.apagado) : ativo ? TEXTO.normal : COR.apagado
      t(xOp + 6, y, it.rotulo, 15, cor).setOrigin(0, 0.5)
    })
    if (!host) t(xOp + 6, yOp + itens.length * 30 + 4, `MODO: ${modo.rotulo}  (o host escolhe)`, 12, modo.cor).setOrigin(0, 0.5)
    else if (!itens.find((it) => it.id === 'comecar').ativo)
      t(xOp + 6, yOp + itens.length * 30 + 4, sala.membros.length < 2 ? 'falta o convidado' : 'esperando o convidado ficar pronto', 11, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0, 0.5)

    // chat (direita)
    const xc = 300
    const yc = 222
    this.add2(this.add.rectangle(xc, yc, LARGURA - xc - 40, 196, 0x000000, 0.55).setOrigin(0).setStrokeStyle(1, COR.temaNum, 0.4))
    t(xc + 10, yc + 12, 'CHAT', 11, COR.tema, { strokeThickness: 0 }).setOrigin(0, 0.5)
    const linhas = s.chat.slice(-LINHAS_CHAT)
    linhas.forEach((m, k) => {
      const y = yc + 32 + k * 18
      const conteudo = m.sistema ? `· ${m.texto}` : `${m.nome}: ${m.texto}`
      const cor = m.sistema ? '#9a9ab0' : m.meu ? TEXTO.selecionado : TEXTO.normal
      const linha = t(xc + 10, y, conteudo, 12, cor, { strokeThickness: 0 }).setOrigin(0, 0.5)
      if (linha.width > LARGURA - xc - 60) caber(linha, conteudo, LARGURA - xc - 60)
    })

    if (s.erro) t(LARGURA / 2, 432, s.erro, 12, '#ff6070').setOrigin(0.5)
    this.rodape(this.digitando ? 'digite  ·  Enter: mandar  ·  Esc: cancelar' : host ? '↑↓ escolher   ←→ modo   A: confirmar   B: fechar sala' : '↑↓ escolher     A: confirmar     B: sair da sala')
  }

  telaAssistindo() {
    const s = this.s
    const t = (...a) => this.add2(this.texto(...a))
    const host = s.sala.membros.find((m) => m.papel === 'host')
    const modo = MODOS[s.sala.modo] ?? MODOS.pvp
    this.add2(this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.75).setOrigin(0))
    t(LARGURA / 2, ALTURA / 2 - 40, `PARTIDA ${modo.rotulo}`, 26, modo.cor, { strokeThickness: 5 }).setOrigin(0.5)
    t(LARGURA / 2, ALTURA / 2, `no PC de ${host?.nome ?? '?'}`, 16).setOrigin(0.5)
    const estado = { parada: 'pedindo a imagem', conectando: 'ligando a imagem', 'ao-vivo': 'imagem chegando', reserva: 'imagem reserva' }[this.tela?.estado] ?? 'ligando a imagem'
    const aviso = t(LARGURA / 2, ALTURA / 2 + 36, estado, 13, '#9a9ab0').setOrigin(0.5)
    this.dinamicos.push({ tipo: 'pontos', obj: aviso, base: estado })
    t(LARGURA / 2, ALTURA - 40, 'você é o P2 (coração amarelo): seus controles vão para o PC do host', 11, '#9a9ab0', { strokeThickness: 0 }).setOrigin(0.5)
  }

  rodape(texto) {
    this.add2(this.texto(LARGURA / 2, ALTURA - 14, texto, 12, TEXTO.desabilitado, { strokeThickness: 0 }).setOrigin(0.5))
  }

  // a música do lobby toca fora da partida; assistindo, quem toca é o host
  atualizarMusica() {
    const tocarAgora = this.modoTela !== 'assistindo'
    if (tocarAgora === this.musicaTocando) return
    this.musicaTocando = tocarAgora
    if (tocarAgora) musica('lobby', 'menu')
    else pararMusica()
  }

  // ---------- ações ----------

  aoBotao(botao) {
    if (this.saindo || this.comecando || this.digitando || !this.s) return
    if (this.modoTela === 'assistindo') return
    if (botao === 'A') {
      const itens = this.itens()
      const it = itens[this.indiceSelecionado(itens)]
      if (!it) return
      if (it.ativo === false) return tocar(this, 'cancelar')
      tocar(this, 'confirmar')
      it.acao()
      return
    }
    if (botao === 'B') {
      tocar(this, 'cancelar')
      if (this.modoTela === 'sala') this.sairDaSala()
      else this.voltarAoMenu()
    }
  }

  mover(passo) {
    const itens = this.itens()
    if (!itens.length) return
    const i = this.indiceSelecionado(itens)
    this.selId = itens[(i + passo + itens.length) % itens.length].id
    tocar(this, 'mover')
  }

  trocarModo(passo) {
    if (this.s.papel !== 'host') return
    const ids = Object.keys(MODOS)
    const i = ids.indexOf(this.s.sala.modo)
    mudarModo(ids[(i + passo + ids.length) % ids.length])
    tocar(this, 'mover')
  }

  digitar(campo) {
    // o nome que o jogo sorteou (JOGADOR 123) não serve de ponto de partida
    const inicial = campo === 'nome' && (this.s.eu.escolheuNome || !this.s.online) ? this.s.eu.nome : ''
    const max = { chat: 80, ip: 40, codigo: 8 }[campo] ?? 16
    const ajustar = (texto) => (campo === 'codigo' ? texto.toUpperCase() : texto)
    this.digitando = { campo, texto: inicial }
    this.cancelarTexto = capturarTexto({
      inicial,
      max,
      ...(campo === 'codigo' && { permitido: /^[a-z0-9]$/i }),
      aoMudar: (texto) => (this.digitando = { campo, texto: ajustar(texto) }),
      aoConfirmar: (texto) => {
        this.digitando = null
        this.cancelarTexto = null
        tocar(this, 'confirmar')
        if (campo === 'nome') mudarNome(texto)
        if (campo === 'ip') conectarIp(texto)
        if (campo === 'codigo') {
          this.selId = null // na sala, o cursor volta para a ação principal
          entrarCodigo(texto)
        }
        if (campo === 'chat') enviarChat(texto)
      },
      aoCancelar: () => {
        this.digitando = null
        this.cancelarTexto = null
        tocar(this, 'cancelar')
      },
    })
  }

  sairDaSala() {
    this.selId = null
    sairSala()
  }

  voltarAoMenu() {
    this.saindo = true
    fecharLobby()
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('Menu'))
  }

  comecar() {
    const modo = MODOS[this.s.sala.modo] ?? MODOS.pvp
    this.comecando = true
    iniciarPartida()
    this.registry.set('modo', this.s.sala.modo)
    tocar(this, 'superAtivar')
    const flash = this.add.text(LARGURA / 2, ALTURA / 2, 'VALENDO!', { fontFamily: FONTE, fontSize: '44px', color: modo.cor, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(50).setScale(0.4)
    this.tweens.add({ targets: flash, scale: 1, duration: 260, ease: 'Back.easeOut' })
    this.cameras.main.fadeOut(520, 0, 0, 0)
    this.time.delayedCall(560, () => this.scene.start(modo.cena))
  }

  // ---------- quadro a quadro ----------

  update(time, delta) {
    if (!this.s) return
    this.desenharRede(time, delta)
    this.barras.forEach((b, i) => b.setScale(1, this.musicaTocando ? 0.35 + 0.65 * Math.abs(Math.sin(time / 230 + i * 1.3)) : 0.2))

    this.controles.atualizar()
    if (!this.saindo && !this.comecando && !this.digitando && this.modoTela !== 'assistindo') {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima') this.mover(-1)
        if (d === 'baixo') this.mover(1)
        if ((d === 'esquerda' || d === 'direita') && this.selId === 'modo') this.trocarModo(d === 'direita' ? 1 : -1)
      }
    }

    // online, na primeira vez: o jogo já pede o nome de usuário
    if (this.s.online && !this.s.eu.escolheuNome && !this.pediuNome && this.s.fase === 'navegando' && !this.digitando && !this.saindo) {
      this.pediuNome = true
      this.selId = 'nome'
      this.digitar('nome')
    }

    this.redesenhar()
    for (const d of this.dinamicos) {
      if (d.tipo === 'cursor') d.obj.setX(d.x + Math.sin(time / 160) * 2)
      if (d.tipo === 'pulso') d.obj.setScale(1.6 + 0.12 * Math.max(0, Math.sin(time / 260 + d.fase * 1.7)))
      if (d.tipo === 'pontos') d.obj.setText(`${d.base}${'.'.repeat(Math.floor(time / 400) % 4)}`)
      if (d.tipo === 'campo') d.obj.setText(`${d.prefixo ?? ''}${this.campoTexto(d.campo, '')}`)
    }
  }
}

// corta o texto com reticências até caber na largura
function caber(texto, conteudo, largura) {
  let corte = conteudo.length
  while (corte > 1 && texto.width > largura) texto.setText(`${conteudo.slice(0, --corte).trimEnd()}…`)
}
