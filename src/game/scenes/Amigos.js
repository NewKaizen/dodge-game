import { get } from 'svelte/store'
import CenaConta from '../conta/Base.js'
import { tocar } from '../audio.js'
import { LARGURA } from '../constants.js'
import { caber, criarAvatar, seta, COR } from '../conta/ui.js'
import { abaVizinha, escondidas, janela, motivoSemConvite, ordenarAmigos, segundosRestantes } from '../conta/lista.js'
import { conta, entrarComGoogle } from '../../lib/conta.js'
import { amigos, daSala, pedirAmizade, responderPedido, cancelarPedido, removerAmigo, bloquearJogador, desbloquearJogador, convidarAmigo, limparAviso, copiarTexto, recarregar } from '../../lib/amigos.js'
import { lan } from '../../lib/lan/rede.js'
import { linkDaSala } from '../../lib/salaLink.js'
import { MOTIVOS, denunciar } from '../../lib/moderacao.js'

// AMIGOS, dentro do jogo (antes era o painel Svelte por cima dele): três abas,
// AMIGOS / PEDIDOS / BLOQUEADOS (←→ troca), e uma lista que rola (↑↓). A numa
// linha abre as ações dela (convidar, remover, bloquear, denunciar...). Só os
// dados e as chamadas ficam em lib/amigos.js e lib/moderacao.js.
//   AMIGOS      + ADICIONAR PELA TAG (digitando) · o link da sua sala · quem está na sala
//               com você e ainda não é amigo ("adicionar") · os amigos (online primeiro)
//   PEDIDOS     os recebidos (aceitar, recusar, bloquear) e os enviados (cancelar)
//   BLOQUEADOS  desbloquear
// Os pedidos novos e os convites chegam como aviso por cima de qualquer menu
// (conta/avisos.js). Sem login: "entre com sua conta".
//
//   scene.start('Amigos', { pilha: [{ cena: 'Menu' }] })
const ABAS = ['AMIGOS', 'PEDIDOS', 'BLOQUEADOS']
const CAIXA = { x: 24, y: 78, largura: 806, altura: 358 }
const ABAS_UI = { y: 54, altura: 26, esquerda: 44, direita: LARGURA - 44, folga: 6 }
const LINHAS = 8
const PASSO = 38
const TOPO = CAIXA.y + 12
const STATUS = { disponivel: 'disponível', em_partida: 'em partida', offline: 'offline' }
const COR_STATUS = { disponivel: 0x6dffb0, em_partida: 0xf2c14e, offline: 0x555566 }
const COR_TEXTO_STATUS = { disponivel: COR.ok, em_partida: COR.aviso, offline: COR.apagado }

export default class Amigos extends CenaConta {
  constructor() {
    super('Amigos')
  }

  create() {
    this.iniciarBase({ titulo: 'AMIGOS' })
    for (const loja of [conta, amigos, lan, daSala]) this.ouvir(loja)
    this.aba = 0
    this.indice = 0
    this.popup = null // { titulo, avatar?, itens: [{ rotulo, acao, motivo?, cor?, confirma? }], indice }
    this.confirmando = ''
    this.mensagem = null
    this.ocupado = false
    this.agora = Date.now()
    limparAviso()
    recarregar()
  }

  travado() {
    return this.ocupado
  }

  get logado() {
    const c = get(conta)
    return c.estado === 'logado' && Boolean(c.perfil)
  }

  // ---------- dados ----------

  status = (id) => get(amigos).presenca[id] ?? 'offline'

  // as linhas da aba (cada uma é uma coisa que dá para escolher)
  linhas() {
    const a = get(amigos)
    const sala = get(lan).sala
    if (this.aba === 1) return [...a.recebidos.map((p) => ({ tipo: 'recebido', p })), ...a.enviados.map((p) => ({ tipo: 'enviado', p }))]
    if (this.aba === 2) return a.bloqueados.map((p) => ({ tipo: 'bloqueado', p }))
    return [
      { tipo: 'adicionar' },
      ...(sala?.codigo ? [{ tipo: 'link' }] : []),
      ...get(daSala)
        .filter((m) => m.situacao !== 'amigo')
        .map((m) => ({ tipo: 'sala', m })),
      ...ordenarAmigos(a.amigos, this.status).map((p) => ({ tipo: 'amigo', p })),
    ]
  }

  vazio() {
    const a = get(amigos)
    if (this.aba === 1 && !a.recebidos.length && !a.enviados.length) return 'nenhum pedido de amizade por enquanto'
    if (this.aba === 2 && !a.bloqueados.length) return 'ninguém bloqueado'
    if (this.aba === 0 && !a.amigos.length) return a.carregando ? 'carregando…' : 'nenhum amigo ainda: mande um pedido pela tag, ou adicione quem estiver na sua sala'
    return ''
  }

  // ---------- ações ----------

  async executar(acao, sucesso = '') {
    this.ocupado = true
    this.mensagem = null
    this.confirmando = ''
    this.popup = null
    this.sujo = true
    const r = await acao()
    this.ocupado = false
    this.mensagem = r.ok ? { texto: typeof sucesso === 'function' ? sucesso(r) : sucesso, cor: COR.ok } : { texto: r.erro, cor: COR.erro }
    this.sujo = true
    return r.ok
  }

  adicionarPelaTag() {
    this.mensagem = null
    this.digitar({
      max: 20,
      aoConfirmar: (tag) => {
        if (!tag.trim()) return
        this.executar(
          () => pedirAmizade(tag),
          (r) => (r.resultado === 'amigos' ? `agora você e ${r.nome ?? 'essa pessoa'} são amigos` : 'pedido enviado'),
        )
      },
    })
  }

  async copiar(texto, rotulo) {
    const ok = await copiarTexto(texto)
    this.mensagem = ok ? { texto: `${rotulo} copiado`, cor: COR.ok } : { texto: 'não deu para copiar: anote o código da sala', cor: COR.erro }
    this.sujo = true
  }

  // a ação de duas etapas (remover, bloquear): o primeiro A pede a confirmação
  comConfirmacao(chave, rotulo, acao, sucesso) {
    return { rotulo: this.confirmando === chave ? `CONFIRMAR: ${rotulo}?` : rotulo, cor: this.confirmando === chave ? '#ff8090' : undefined, confirma: chave, acao: () => (this.confirmando === chave ? this.executar(acao, sucesso) : ((this.confirmando = chave), (this.sujo = true))) }
  }

  itensDa(linha) {
    const s = get(lan)
    const a = get(amigos)
    const itemDenunciar = (p) => ({ rotulo: 'DENUNCIAR…', acao: () => this.abrirDenuncia(p) })
    if (linha.tipo === 'amigo') {
      const p = linha.p
      const motivo = motivoSemConvite({
        conectado: s.fase === 'navegando' || s.fase === 'sala',
        status: this.status(p.id),
        pendenteAte: a.pendentes[p.id]?.ate ?? 0,
        agora: this.agora,
        sala: s.sala,
        souHost: s.fase === 'sala' && s.papel === 'host',
      })
      const convidado = (a.pendentes[p.id]?.ate ?? 0) > this.agora
      return [
        { rotulo: convidado ? 'CONVIDADO' : 'CONVIDAR', motivo, acao: () => {
            convidarAmigo(p.id)
            this.fecharPopup() // o aviso ("convite enviado para...") ou o motivo da recusa chega pela loja
          },
        },
        this.comConfirmacao(`remover:${p.id}`, 'REMOVER AMIGO', () => removerAmigo(p.id), `${p.nome} saiu dos seus amigos`),
        this.comConfirmacao(`bloquear:${p.id}`, 'BLOQUEAR', () => bloquearJogador(p.id), `${p.nome} foi bloqueado`),
        itemDenunciar(p),
      ]
    }
    if (linha.tipo === 'recebido') {
      const p = linha.p
      return [
        { rotulo: 'ACEITAR', cor: COR.ok, acao: () => this.executar(() => responderPedido(p.id, true), `${p.nome} agora é seu amigo`) },
        { rotulo: 'RECUSAR', acao: () => this.executar(() => responderPedido(p.id, false), 'pedido recusado') },
        this.comConfirmacao(`bloquear:${p.id}`, 'BLOQUEAR', () => bloquearJogador(p.id), `${p.nome} foi bloqueado`),
        itemDenunciar(p),
      ]
    }
    if (linha.tipo === 'enviado') return [{ rotulo: 'CANCELAR PEDIDO', acao: () => this.executar(() => cancelarPedido(linha.p.id), 'pedido cancelado') }]
    if (linha.tipo === 'bloqueado') return [{ rotulo: 'DESBLOQUEAR', acao: () => this.executar(() => desbloquearJogador(linha.p.id), `${linha.p.nome} foi desbloqueado`) }]
    if (linha.tipo === 'sala') {
      const m = linha.m
      const situacoes = { enviado: 'pedido enviado', recebido: 'já te pediu: veja em PEDIDOS', bloqueado: 'você bloqueou essa pessoa' }
      return [
        { rotulo: 'ADICIONAR AMIGO', cor: COR.ok, motivo: situacoes[m.situacao] ?? '', acao: () => this.executar(() => pedirAmizade(m.tag), (r) => (r.resultado === 'amigos' ? `agora você e ${m.nome} são amigos` : `pedido enviado para ${m.nome}`)) },
        itemDenunciar({ tag: m.tag, nome: m.nome, avatar: m.avatar }),
      ]
    }
    return []
  }

  abrirPopup(linha) {
    const p = linha.p ?? linha.m
    this.popup = { linha, titulo: p.nome, avatar: p.avatar, sub: p.tag, indice: 0 }
    this.confirmando = ''
    this.mensagem = null
    tocar(this, 'confirmar')
    this.sujo = true
  }

  fecharPopup(aviso = '') {
    this.popup = null
    this.confirmando = ''
    if (aviso) this.mensagem = { texto: aviso, cor: COR.ok }
    this.sujo = true
  }

  // DENUNCIAR: (se tem foto) o que denunciar e depois o motivo
  abrirDenuncia(p) {
    const motivos = (tipo) =>
      MOTIVOS.map((m) => ({
        rotulo: m.rotulo.toUpperCase(),
        acao: () => this.executar(() => denunciar(p.tag, tipo, m.id), 'denúncia enviada: obrigado. A equipe analisa'),
      }))
    const temFoto = p.avatar?.tipo === 'enviado'
    this.popup = {
      titulo: `DENUNCIAR ${p.nome}`,
      sub: temFoto ? 'o que você quer denunciar?' : 'qual é o motivo?',
      avatar: p.avatar,
      indice: 0,
      itens: temFoto
        ? [
            { rotulo: 'O NOME', acao: () => this.escolherMotivo(p, 'nome', motivos('nome')) },
            { rotulo: 'A FOTO', acao: () => this.escolherMotivo(p, 'foto', motivos('foto')) },
          ]
        : motivos('nome'),
    }
    this.confirmando = ''
    this.sujo = true
  }

  escolherMotivo(p, tipo, itens) {
    this.popup = { titulo: `DENUNCIAR ${tipo === 'foto' ? 'A FOTO DE' : 'O NOME DE'} ${p.nome}`, sub: 'qual é o motivo?', avatar: p.avatar, indice: 0, itens }
    this.sujo = true
  }

  popupItens() {
    return this.popup.itens ?? this.itensDa(this.popup.linha)
  }

  // ---------- entrada ----------

  aoDirecao(d) {
    if (!this.logado) {
      const n = this.itensSemConta().length
      if (d === 'cima' || d === 'baixo') this.indice = (this.indice + (d === 'cima' ? -1 : 1) + n) % n
      this.sujo = true
      return
    }
    if (this.popup) {
      const n = this.popupItens().length
      if (d === 'cima' || d === 'baixo') {
        this.popup.indice = (this.popup.indice + (d === 'cima' ? -1 : 1) + n) % n
        this.confirmando = ''
        tocar(this, 'mover')
        this.sujo = true
      }
      return
    }
    if (d === 'esquerda' || d === 'direita') {
      this.aba = abaVizinha(ABAS.length, this.aba, d === 'direita' ? 1 : -1)
      this.indice = 0
      this.mensagem = null
      tocar(this, 'mover')
      this.sujo = true
      return
    }
    const n = this.linhas().length
    if (!n) return
    this.indice = (this.indice + (d === 'cima' ? -1 : 1) + n) % n
    tocar(this, 'mover')
    this.sujo = true
  }

  itensSemConta() {
    const c = get(conta)
    return [...(c.estado === 'deslogado' ? [{ rotulo: 'ENTRAR COM GOOGLE', cor: COR.gold, acao: () => entrarComGoogle() }] : []), { rotulo: 'VOLTAR', acao: () => this.voltar() }]
  }

  aoBotao(botao) {
    if (!this.logado) {
      if (botao === 'B') return this.voltar()
      if (botao === 'A') {
        tocar(this, 'confirmar')
        this.itensSemConta()[this.indice]?.acao()
      }
      return
    }
    if (botao === 'B') {
      tocar(this, 'cancelar')
      if (this.popup) return this.fecharPopup()
      return this.voltar()
    }
    if (botao !== 'A') return
    if (this.popup) {
      const it = this.popupItens()[this.popup.indice]
      if (!it) return
      if (it.motivo) return tocar(this, 'cancelar')
      tocar(this, 'confirmar')
      return it.acao()
    }
    const linha = this.linhas()[this.indice]
    if (!linha) return
    if (linha.tipo === 'adicionar') return this.adicionarPelaTag()
    if (linha.tipo === 'link') {
      tocar(this, 'confirmar')
      return void this.copiar(linkDaSala(get(lan).sala.codigo, location.origin), 'link da sala')
    }
    this.abrirPopup(linha)
  }

  // o relógio dos convites enviados ("convidado" volta a "convidar")
  tique() {
    const agora = Date.now()
    if (Math.floor(agora / 1000) === Math.floor(this.agora / 1000)) return
    this.agora = agora
    if (Object.keys(get(amigos).pendentes).length) this.sujo = true
  }

  // ---------- desenho ----------

  desenhar() {
    const c = get(conta)
    if (!this.logado) {
      this.subTexto.setText('')
      return this.telaCentral({
        titulo: c.estado === 'carregando' ? 'CARREGANDO A CONTA…' : 'ENTRE COM A SUA CONTA',
        linhas: c.estado === 'deslogado' ? ['Amigos, pedidos e convites precisam de uma conta.', '', 'Entre com o Google e use a tag (nome#1234)', 'para achar os seus amigos.'] : c.estado === 'indisponivel' ? ['Este servidor não tem contas: sem amigos por aqui.'] : ['só um instante'],
        erro: c.erro,
        itens: this.itensSemConta(),
        indice: this.indice,
      })
    }
    const a = get(amigos)
    const online = a.amigos.filter((x) => this.status(x.id) !== 'offline').length
    const s = get(lan)
    const conectado = s.fase === 'navegando' || s.fase === 'sala'
    this.subTexto.setText(`${online} online${conectado ? '' : '  ·  sem conexão com o servidor'}`)
    this.desenharAbas(a)
    this.caixa(CAIXA.x, CAIXA.y, CAIXA.largura, CAIXA.altura)
    this.desenharLista(a)
    this.desenharMensagem(a)
    if (this.popup) this.desenharPopup()
    this.rodape(this.digitando ? [['Enter', 'Enviar pedido'], ['Esc', 'Cancelar']] : this.popup ? [['cimaBaixo', 'Escolher'], ['A', 'Confirmar'], ['B', 'Fechar']] : [['cimaBaixo', 'Escolher'], ['esqDir', 'Aba'], ['A', 'Ações'], ['B', 'Voltar']])
  }

  desenharAbas(a) {
    const g = this.grafico()
    const largura = (ABAS_UI.direita - ABAS_UI.esquerda - ABAS_UI.folga * (ABAS.length - 1)) / ABAS.length
    const contagens = [a.amigos.length, a.recebidos.length + a.enviados.length, a.bloqueados.length]
    ABAS.forEach((nome, i) => {
      const x = ABAS_UI.esquerda + i * (largura + ABAS_UI.folga)
      const ativa = i === this.aba
      g.fillStyle(0x0b0914, 0.94).fillRect(x, ABAS_UI.y - ABAS_UI.altura / 2, largura, ABAS_UI.altura)
      g.lineStyle(3, ativa ? 0xffe040 : 0x4a4a5c, 1).strokeRect(x + 1.5, ABAS_UI.y - ABAS_UI.altura / 2 + 1.5, largura - 3, ABAS_UI.altura - 3)
      this.t(x + largura / 2, ABAS_UI.y, `${nome}  ${contagens[i]}`, 15, ativa ? '#ffe040' : COR.apagado).setOrigin(0.5)
      // pedidos esperando resposta: a bolinha vermelha
      if (i === 1 && a.recebidos.length) {
        g.fillStyle(0xff3d6e, 1).fillCircle(x + largura - 14, ABAS_UI.y - 6, 9)
        this.t(x + largura - 14, ABAS_UI.y - 6, String(a.recebidos.length), 11, '#ffffff').setOrigin(0.5)
      }
    })
    seta(g, 24, ABAS_UI.y, 'esquerda', 6, 0xffe040)
    seta(g, LARGURA - 24, ABAS_UI.y, 'direita', 6, 0xffe040)
  }

  desenharLista(a) {
    const linhas = this.linhas()
    this.indice = Math.min(this.indice, Math.max(0, linhas.length - 1)) // a lista pode ter encolhido (aceitou um pedido)
    const inicio = janela(linhas.length, this.indice, LINHAS)
    const visiveis = linhas.slice(inicio, inicio + LINHAS)
    visiveis.forEach((l, k) => this.desenharLinha(l, TOPO + k * PASSO + PASSO / 2, inicio + k === this.indice && !this.popup, a))
    const v = this.vazio()
    if (v) this.t(CAIXA.x + 28, TOPO + visiveis.length * PASSO + 14, v, 12, COR.apagado, { wordWrap: { width: CAIXA.largura - 80 } })
    // barra de rolagem e quantos itens ficaram escondidos
    const { acima, abaixo } = escondidas(linhas.length, inicio, LINHAS)
    if (linhas.length > LINHAS) {
      const trilho = { x: CAIXA.x + CAIXA.largura - 14, y: TOPO + 4, h: LINHAS * PASSO - 8 }
      const g = this.grafico()
      g.fillStyle(0xffffff, 0.12).fillRect(trilho.x, trilho.y, 4, trilho.h)
      const altura = Math.max(14, (LINHAS / linhas.length) * trilho.h)
      g.fillStyle(0xffe040, 1).fillRect(trilho.x, trilho.y + (inicio / (linhas.length - LINHAS)) * (trilho.h - altura), 4, altura)
      if (acima) this.t(CAIXA.x + CAIXA.largura - 24, CAIXA.y + 4, `▲ ${acima}`, 10, COR.dica).setOrigin(1, 0)
      if (abaixo) this.t(CAIXA.x + CAIXA.largura - 24, TOPO + LINHAS * PASSO - 12, `▼ ${abaixo}`, 10, COR.dica).setOrigin(1, 0)
    }
  }

  desenharLinha(l, y, sel, a) {
    const x0 = CAIXA.x + 20
    const direita = CAIXA.x + CAIXA.largura - 30
    if (sel) {
      this.grafico().fillStyle(0xffe040, 0.12).fillRect(CAIXA.x + 10, y - PASSO / 2 + 2, CAIXA.largura - 36, PASSO - 4)
      this.cursorEm(x0 + 6, y)
    }
    if (l.tipo === 'adicionar') {
      if (this.digitando) {
        this.t(x0 + 34, y, `TAG: ${this.campoTexto()}`, 15, '#ffe040').setOrigin(0, 0.5)
        this.t(direita, y, 'ex.: nome#1234', 11, COR.apagado).setOrigin(1, 0.5)
      } else {
        this.t(x0 + 34, y, '+  ADICIONAR PELA TAG', 15, COR.ok).setOrigin(0, 0.5)
        this.t(direita, y, `a sua: ${get(conta).perfil.tag}`, 11, COR.dica).setOrigin(1, 0.5)
      }
      return
    }
    if (l.tipo === 'link') {
      const codigo = get(lan).sala.codigo
      this.t(x0 + 34, y, `COPIAR LINK DA SUA SALA ${codigo}`, 15, COR.texto).setOrigin(0, 0.5)
      this.t(direita, y, 'o amigo abre o link e cai direto na sala', 11, COR.dica).setOrigin(1, 0.5)
      return
    }
    const p = l.p ?? { nome: l.m.nome, tag: l.m.tag, avatar: l.m.avatar }
    this.view.add(criarAvatar(this, x0 + 52, y, p.avatar, 26))
    const xTexto = x0 + 80
    const status = l.tipo === 'amigo' ? this.status(p.id) : null
    if (status) {
      this.grafico().fillStyle(COR_STATUS[status], 1).fillCircle(x0 + 82, y - 8, 4)
    }
    const xNome = status ? xTexto + 14 : xTexto
    caber(this.t(xNome, y - 7, p.nome, 15, COR.texto).setOrigin(0, 0.5), p.nome, 300)
    const sub = {
      amigo: `${p.tag}  ·  nível ${p.nivel}`,
      recebido: `${p.tag}  ·  nível ${p.nivel}  ·  quer ser seu amigo`,
      enviado: `${p.tag}  ·  esperando resposta`,
      bloqueado: p.tag,
      sala: `${p.tag}  ·  está na sua sala`,
    }[l.tipo]
    this.t(xNome, y + 9, sub, 10, COR.dica).setOrigin(0, 0.5)
    // à direita: a situação
    if (l.tipo === 'amigo') {
      const convidado = (a.pendentes[p.id]?.ate ?? 0) > this.agora
      const texto = convidado ? `convidado · ${segundosRestantes(a.pendentes[p.id].ate, this.agora)} s` : STATUS[status]
      this.t(direita, y, texto, 12, convidado ? COR.gold : COR_TEXTO_STATUS[status]).setOrigin(1, 0.5)
    } else if (l.tipo === 'sala') {
      const sit = { enviado: 'pedido enviado', recebido: 'já te pediu: veja PEDIDOS', bloqueado: 'bloqueado' }[l.m.situacao]
      this.t(direita, y, sit ?? 'A: adicionar', 12, sit ? COR.apagado : COR.ok).setOrigin(1, 0.5)
    } else if (sel) this.t(direita, y, 'A: ações', 11, COR.dica).setOrigin(1, 0.5)
  }

  desenharMensagem(a) {
    const m = this.ocupado ? { texto: 'um instante…', cor: COR.aviso } : this.mensagem ?? (a.erro ? { texto: a.erro, cor: COR.erro } : a.aviso ? { texto: a.aviso, cor: COR.ok } : null)
    if (!m) return
    this.t(CAIXA.x + 24, CAIXA.y + CAIXA.altura - 26, m.texto, 12, m.cor, { wordWrap: { width: CAIXA.largura - 60 } }).setOrigin(0, 0.5)
  }

  // as ações da linha (ou o seletor de motivo da denúncia) por cima da lista
  desenharPopup() {
    const p = this.popup
    const itens = this.popupItens()
    const largura = 440
    const altura = 64 + itens.length * 32
    const x = (LARGURA - largura) / 2
    const y = CAIXA.y + (CAIXA.altura - altura) / 2
    this.grafico().fillStyle(0x000000, 0.65).fillRect(CAIXA.x, CAIXA.y, CAIXA.largura, CAIXA.altura)
    this.caixa(x, y, largura, altura, 0xffe040, 0x0b0914, 0.98)
    if (p.avatar) this.view.add(criarAvatar(this, x + 36, y + 30, p.avatar, 30))
    const xT = p.avatar ? x + 64 : x + 20
    caber(this.t(xT, y + 22, p.titulo, 15, '#ffe040').setOrigin(0, 0.5), p.titulo, largura - (xT - x) - 16)
    this.t(xT, y + 42, p.sub ?? '', 10, COR.dica).setOrigin(0, 0.5)
    itens.forEach((it, i) => {
      const yi = y + 74 + i * 32
      const sel = i === p.indice
      if (sel) {
        this.grafico().fillStyle(0xffe040, 0.14).fillRect(x + 10, yi - 14, largura - 20, 28)
        this.cursorEm(x + 28, yi)
      }
      const apagado = Boolean(it.motivo)
      caber(this.t(x + 50, yi, it.rotulo, 14, apagado ? COR.apagado : it.cor ?? COR.texto).setOrigin(0, 0.5), it.rotulo, apagado ? 210 : largura - 70)
      if (apagado) this.t(x + largura - 18, yi, it.motivo, 10, COR.aviso).setOrigin(1, 0.5)
    })
  }
}
