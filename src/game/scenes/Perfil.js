import { get } from 'svelte/store'
import CenaConta from '../conta/Base.js'
import { tocar } from '../audio.js'
import { barraXp, caber, criarAvatar, COR } from '../conta/ui.js'
import { moverNaGrade } from '../conta/lista.js'
import { conta, entrarComGoogle, sairDaConta, mudarNomeExibicao, escolherAvatar, removerFoto, recarregarPerfil } from '../../lib/conta.js'
import { amigos } from '../../lib/amigos.js'
import { pedirFoto } from '../../lib/fotoModal.js'
import { AVATARES_JOGO, avatarDoPerfil, NOME_MAX } from '../../lib/contaRegras.js'
import { AVATARES_TRILHA, corDaMoldura, nomeDoItem, progressoDoXp, proximaRecompensa, NOME_TIPO } from '../../lib/progresso.js'
import { siteNaInternet } from '../../lib/lan/rede.js'

// PERFIL, dentro do jogo (antes era o painel Svelte por cima dele): o cartão da
// conta (avatar com a moldura equipada, nome, tag, título, nível e barra de XP,
// estatísticas) e as ações: mudar nome (digitando), escolher avatar (grade),
// enviar ou tirar a foto, COLEÇÃO, AMIGOS e sair da conta.
// Sem login: a explicação do convidado e ENTRAR COM GOOGLE. Sem contas no
// servidor (LAN sem internet): o aviso de "contas indisponíveis".
//
// A foto precisa do seletor de arquivo e do recorte do navegador: continua em
// Svelte (ui/FotoModal.svelte, lib/fotoModal.js), aberta daqui e devolvendo o
// resultado para esta cena.
//
//   scene.start('Perfil', { pilha: [{ cena: 'Menu' }] })
//   ↑↓ escolher · A confirmar · B/C voltar (na grade de avatares: ←→↑↓)
const NOMES = { kris: 'Kris', susie: 'Susie', ralsei: 'Ralsei', noelle: 'Noelle', berdly: 'Berdly', dess: 'Dess', asriel: 'Asriel', king: 'King', queen: 'Queen', jevil: 'Jevil' }
const CAIXA_ESQ = { x: 24, y: 78, largura: 300, altura: 358 }
const CAIXA_DIR = { x: 334, y: 78, largura: 496, altura: 358 }
const LINHA = { y: 36, passo: 38 } // primeira linha das ações (relativa à caixa)
const COLUNAS_AVATAR = 5
const PERMITIDO_NOME = /^[\p{L}\p{N} _.-]$/u

export default class Perfil extends CenaConta {
  constructor() {
    super('Perfil')
  }

  create() {
    this.iniciarBase({ titulo: 'PERFIL' })
    this.ouvir(conta)
    this.ouvir(amigos)
    this.modo = 'menu' // 'menu' | 'avatares' | 'sair'
    this.indice = 0
    this.grade = 0
    this.mensagem = null // { texto, cor }
    this.ocupado = false
    this.modal = false
    recarregarPerfil() // o XP pode ter chegado enquanto estava em outra tela
  }

  travado() {
    return this.modal || this.ocupado
  }

  get perfil() {
    const c = get(conta)
    return c.estado === 'logado' ? c.perfil : null
  }

  // ---------- o que dá para fazer ----------

  itens() {
    const c = get(conta)
    const p = this.perfil
    if (!p) {
      const entrar = c.estado === 'deslogado'
      return [...(entrar ? [{ id: 'google', rotulo: 'ENTRAR COM GOOGLE', cor: COR.gold, acao: () => entrarComGoogle() }] : []), { id: 'voltar', rotulo: 'VOLTAR', acao: () => this.voltar() }]
    }
    if (this.modo === 'sair')
      return [
        { id: 'confirmar', rotulo: 'SAIR DA CONTA', cor: '#ff8090', acao: () => this.sairDaConta() },
        { id: 'cancelar', rotulo: 'CANCELAR', acao: () => this.mudarModo('menu') },
      ]
    const pedidos = get(amigos).recebidos.length
    return [
      { id: 'nome', rotulo: 'MUDAR NOME', valor: p.nome_exibicao, acao: () => this.mudarNome() },
      { id: 'avatar', rotulo: 'ESCOLHER AVATAR', acao: () => this.mudarModo('avatares') },
      { id: 'foto', rotulo: 'ENVIAR FOTO…', acao: () => this.enviarFoto() },
      ...(p.avatar_url ? [{ id: 'tirar', rotulo: 'REMOVER FOTO', acao: () => this.executar(removerFoto, 'foto removida') }] : []),
      { id: 'colecao', rotulo: 'COLEÇÃO', acao: () => this.irPara('Colecao') },
      { id: 'amigos', rotulo: 'AMIGOS', valor: pedidos ? `${pedidos} pedido${pedidos > 1 ? 's' : ''}` : '', corValor: COR.aviso, acao: () => this.irPara('Amigos') },
      { id: 'sair', rotulo: 'SAIR DA CONTA', cor: '#ff8090', acao: () => this.mudarModo('sair') },
    ]
  }

  // os avatares da grade: o coração padrão, os personagens, os da trilha que a conta ganhou e a foto
  avataresDaGrade() {
    const c = get(conta)
    const p = this.perfil
    const lista = [{ avatar: { tipo: 'padrao' }, nome: 'Padrão', escolher: () => escolherAvatar('padrao') }]
    for (const id of AVATARES_JOGO) lista.push({ avatar: { tipo: 'jogo', id }, nome: NOMES[id], escolher: () => escolherAvatar('jogo', id) })
    for (const id of AVATARES_TRILHA) if (c.inventario?.has(`avatar.${id}`)) lista.push({ avatar: { tipo: 'jogo', id }, nome: NOMES[id] ?? id, escolher: () => escolherAvatar('jogo', id) })
    if (p?.avatar_url) lista.push({ avatar: { tipo: 'enviado', url: p.avatar_url }, nome: 'Sua foto', escolher: () => escolherAvatar('enviado') })
    return lista
  }

  emUso(av) {
    const atual = avatarDoPerfil(this.perfil)
    return atual.tipo === av.tipo && (av.tipo !== 'jogo' || atual.id === av.id)
  }

  mudarModo(modo) {
    this.modo = modo
    this.indice = 0
    this.mensagem = null
    if (modo === 'avatares') this.grade = Math.max(0, this.avataresDaGrade().findIndex((a) => this.emUso(a.avatar)))
    tocar(this, 'mover')
    this.sujo = true
  }

  async executar(acao, sucesso) {
    this.ocupado = true
    this.mensagem = null
    this.sujo = true
    const r = await acao()
    this.ocupado = false
    this.mensagem = r.ok ? { texto: sucesso, cor: COR.ok } : { texto: r.erro, cor: COR.erro }
    this.sujo = true
    return r.ok
  }

  mudarNome() {
    this.mensagem = null
    this.digitar({
      inicial: this.perfil.nome_exibicao,
      max: NOME_MAX,
      permitido: PERMITIDO_NOME,
      aoConfirmar: (texto) => this.executar(() => mudarNomeExibicao(texto), 'nome salvo'),
    })
  }

  async enviarFoto() {
    this.modal = true
    this.mensagem = null
    const r = await pedirFoto()
    this.modal = false
    if (r.ok) this.mensagem = { texto: r.aviso ?? 'foto atualizada', cor: COR.ok }
    else if (r.erro) this.mensagem = { texto: r.erro, cor: COR.erro }
    this.sujo = true
  }

  async sairDaConta() {
    this.ocupado = true
    this.sujo = true
    await sairDaConta()
    this.ocupado = false
    this.modo = 'menu'
    this.indice = 0
    this.sujo = true
  }

  // ---------- entrada ----------

  aoDirecao(d) {
    if (this.modo === 'avatares') {
      const r = moverNaGrade(this.grade, this.avataresDaGrade().length, COLUNAS_AVATAR, d)
      if (r.indice !== this.grade) {
        this.grade = r.indice
        tocar(this, 'mover')
        this.sujo = true
      }
      return
    }
    const n = this.itens().length
    if (d !== 'cima' && d !== 'baixo') return
    this.indice = (this.indice + (d === 'cima' ? -1 : 1) + n) % n
    tocar(this, 'mover')
    this.sujo = true
  }

  aoBotao(botao) {
    if (botao === 'B') {
      tocar(this, 'cancelar')
      if (this.modo !== 'menu') return this.mudarModo('menu')
      return this.voltar()
    }
    if (botao !== 'A') return
    if (this.modo === 'avatares') {
      const a = this.avataresDaGrade()[this.grade]
      if (!a) return
      tocar(this, 'confirmar')
      return void this.executar(a.escolher, 'avatar trocado')
    }
    const it = this.itens()[this.indice]
    if (!it) return
    tocar(this, 'confirmar')
    it.acao()
  }

  // ---------- desenho ----------

  desenhar() {
    const c = get(conta)
    const p = this.perfil
    this.subTexto.setText(p?.tag ?? '')
    if (!p) return this.desenharSemConta(c)
    this.desenharCartao(p)
    this.desenharAcoes(p)
    this.rodape(this.digitando ? [['Enter', 'Salvar'], ['Esc', 'Cancelar']] : this.modo === 'avatares' ? [['esqDir', 'Escolher'], ['cimaBaixo', 'Linha'], ['A', 'Usar'], ['B', 'Voltar']] : [['cimaBaixo', 'Escolher'], ['A', 'Confirmar'], ['B', 'Voltar']])
  }

  desenharCartao(p) {
    const e = CAIXA_ESQ
    this.caixa(e.x, e.y, e.largura, e.altura)
    const cx = e.x + e.largura / 2
    const prog = progressoDoXp(p.xp)
    this.view.add(criarAvatar(this, cx, e.y + 70, avatarDoPerfil(p), 96, corDaMoldura(p.moldura_equipada)))
    caber(this.t(cx, e.y + 140, p.nome_exibicao, 20, COR.texto, { strokeThickness: 4 }).setOrigin(0.5), p.nome_exibicao, e.largura - 24)
    this.t(cx, e.y + 162, p.tag, 12, COR.dica).setOrigin(0.5)
    this.t(cx, e.y + 182, nomeDoItem(p.titulo_equipado) ?? 'sem título', 13, COR.titulo).setOrigin(0.5)
    this.t(cx, e.y + 208, `NÍVEL ${prog.nivel}`, 16, COR.gold).setOrigin(0.5)
    barraXp(this.grafico(), cx - 110, e.y + 224, 220, 12, prog)
    this.t(cx, e.y + 248, `${prog.noNivel} / ${prog.paraProximo} XP`, 11, COR.descricao).setOrigin(0.5)
    const prox = proximaRecompensa(prog.nivel)
    const textoProx = prox ? `no nível ${prox.nivel}: ${prox.nome} (${NOME_TIPO[prox.tipo]})` : 'você já tem toda a trilha!'
    caber(this.t(cx, e.y + 266, textoProx, 10, COR.dica).setOrigin(0.5), textoProx, e.largura - 24)

    const est = get(conta).estatisticas ?? { partidas: 0, vitorias: 0, personagem_favorito: null }
    const linhas = [['partidas', String(est.partidas)], ['vitórias', String(est.vitorias)], ['favorito', NOMES[est.personagem_favorito] ?? '—']]
    this.grafico().lineStyle(1, 0xffffff, 0.15).lineBetween(e.x + 18, e.y + 284, e.x + e.largura - 18, e.y + 284)
    linhas.forEach(([rotulo, valor], i) => {
      const y = e.y + 302 + i * 18
      this.t(e.x + 24, y, rotulo, 12, COR.dica).setOrigin(0, 0.5)
      this.t(e.x + e.largura - 24, y, valor, 12, COR.texto).setOrigin(1, 0.5)
    })
  }

  desenharAcoes(p) {
    const d = CAIXA_DIR
    this.caixa(d.x, d.y, d.largura, d.altura)
    if (this.modo === 'avatares') this.desenharGrade(p)
    else this.desenharLista()
    this.desenharMensagem()
  }

  desenharLista() {
    const d = CAIXA_DIR
    const itens = this.itens()
    if (this.modo === 'sair') this.t(d.x + 22, d.y + 22, 'Sair da conta? Você volta a jogar como convidado (sem XP).', 12, COR.descricao, { wordWrap: { width: d.largura - 44 } })
    itens.forEach((it, i) => {
      const y = d.y + (this.modo === 'sair' ? 84 : LINHA.y) + i * LINHA.passo
      const sel = i === this.indice
      if (sel) {
        this.grafico().fillStyle(0xffe040, 0.12).fillRect(d.x + 12, y - 16, d.largura - 24, 32)
        this.cursorEm(d.x + 30, y)
      }
      const editando = this.digitando && it.id === 'nome'
      if (editando) {
        this.t(d.x + 54, y, `NOME: ${this.campoTexto()}`, 16, '#ffe040').setOrigin(0, 0.5)
        this.t(d.x + d.largura - 24, y, `3 a ${NOME_MAX} letras`, 11, COR.apagado).setOrigin(1, 0.5)
        return
      }
      this.t(d.x + 54, y, it.rotulo, 16, it.cor ?? COR.texto).setOrigin(0, 0.5)
      if (it.valor) caber(this.t(d.x + d.largura - 24, y, it.valor, 12, it.corValor ?? COR.dica).setOrigin(1, 0.5), it.valor, 200)
    })
  }

  desenharGrade(p) {
    const d = CAIXA_DIR
    const lista = this.avataresDaGrade()
    this.t(d.x + 22, d.y + 20, 'ESCOLHA O SEU AVATAR', 13, COR.gold)
    const celula = { l: 92, a: 84 }
    const x0 = d.x + (d.largura - celula.l * COLUNAS_AVATAR) / 2
    lista.forEach((a, i) => {
      const x = x0 + (i % COLUNAS_AVATAR) * celula.l + celula.l / 2
      const y = d.y + 78 + Math.floor(i / COLUNAS_AVATAR) * celula.a
      const sel = i === this.grade
      if (sel) {
        this.grafico().lineStyle(3, 0xffe040, 1).strokeRect(x - celula.l / 2 + 6, y - 34, celula.l - 12, celula.a - 6)
      }
      this.view.add(criarAvatar(this, x, y - 8, a.avatar, 44, corDaMoldura(p.moldura_equipada)))
      this.t(x, y + 24, this.emUso(a.avatar) ? `${a.nome} ✔` : a.nome, 11, this.emUso(a.avatar) ? COR.ok : COR.descricao).setOrigin(0.5)
    })
    if (get(conta).inventario === null) this.t(d.x + 22, d.y + d.altura - 62, 'os avatares da trilha aparecem quando o inventário carregar', 10, COR.apagado)
  }

  desenharMensagem() {
    const d = CAIXA_DIR
    const m = this.ocupado ? { texto: 'salvando…', cor: COR.aviso } : this.mensagem ?? (get(conta).erro ? { texto: get(conta).erro, cor: COR.erro } : null)
    if (!m) return
    this.t(d.x + 22, d.y + d.altura - 44, m.texto, 12, m.cor, { wordWrap: { width: d.largura - 44 } })
  }

  // sem login / carregando / contas indisponíveis
  desenharSemConta(c) {
    let titulo = 'JOGANDO COMO CONVIDADO'
    let linhas = [
      'Entrando com o Google você salva o seu progresso:',
      '',
      '•  nome, avatar e foto de perfil',
      '•  XP, níveis e a COLEÇÃO de cosméticos',
      '•  lista de AMIGOS e convites para jogar',
      '',
      'Convidado joga normalmente, mas sem XP, amigos nem coleção.',
    ]
    if (c.estado === 'carregando') {
      titulo = 'CARREGANDO A CONTA…'
      linhas = ['só um instante']
    } else if (c.estado === 'indisponivel') {
      titulo = 'CONTAS INDISPONÍVEIS'
      linhas = [siteNaInternet() ? 'O serviço de contas não respondeu agora.' : 'Este servidor não tem contas (modo LAN, sem internet).', '', 'Você joga como convidado: tudo funciona,', 'só não há XP, amigos nem coleção.']
    }
    this.telaCentral({ titulo, linhas, erro: c.erro, itens: this.itens(), indice: this.indice, esquerda: c.estado === 'deslogado' })
  }
}
