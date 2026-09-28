import { CORES, corTexto } from '../constants.js'
import { tocar } from '../audio.js'

// Adicionado automaticamente aos ACTs de quem usa os ACTs do chefe
const CHECK = {
  nome: 'Check',
  executar: (ctx) => {
    ctx.revelar()
    ctx.texto(`* ${ctx.alvo.nome.toUpperCase()} - DEF ${ctx.alvo.defesa}. ${ctx.alvo.def.descricao ?? ''}`)
  },
}

// Menu de um jogador na fase de escolha: passa por cada personagem dele e
// guarda a escolha em membro.acao. Etapas:
//   'comando' -> FIGHT/ACT/ITEM/SPARE/DEFEND
//   'alvo'    -> inimigo (pulado se só houver um)
//   'act'     -> ACTs/magias
//   'item'    -> itens do inventário
//   'aliado'  -> quem recebe o item
//   'pronto'
export default class MenuComandos {
  constructor(batalha, jogador, membros) {
    this.b = batalha
    this.jogador = jogador
    this.membros = membros
    this.corCursor = CORES.almas[jogador]
    this.i = 0
    this.etapa = membros.length ? 'comando' : 'pronto'
    this.cursor = 0
    this.pendente = null // escolha em andamento: { tipo, alvo, item }
  }

  get membro() {
    return this.membros[this.i]
  }

  get pronto() {
    return this.etapa === 'pronto'
  }

  opcoes() {
    if (this.etapa === 'comando') return this.membro.comandos
    if (this.etapa === 'alvo') return this.b.inimigosAtivos()
    if (this.etapa === 'act') return this.acts()
    if (this.etapa === 'item') return this.b.inventario.lista()
    if (this.etapa === 'aliado') return this.b.party
    return []
  }

  acts() {
    const { act = {} } = this.membro.def
    const doChefe = act.usaActsDoInimigo ? [CHECK, ...(this.pendente.alvo.def.acts ?? [])] : []
    return [...doChefe, ...(act.lista ?? [])]
  }

  navegar(direcao) {
    if (this.pronto) return
    const passos = this.etapa === 'comando' ? { esquerda: -1, direita: 1 } : { cima: -1, baixo: 1 }
    const passo = passos[direcao]
    const total = this.opcoes().length
    if (!passo || !total) return
    this.cursor = (this.cursor + passo + total) % total
    tocar(this.b, 'mover')
    this.b.atualizarUI()
  }

  confirmar() {
    if (this.pronto) return
    const opcao = this.opcoes()[this.cursor]
    if (!opcao) return this.erro()

    if (this.etapa === 'comando') {
      const { tipo } = opcao
      if (this.b.comandoBloqueado(this.membro, tipo)) return this.erro()
      tocar(this.b, 'confirmar')
      if (tipo === 'DEFEND') return this.escolher({ tipo })
      if (tipo === 'ITEM') return this.irPara('item')
      this.pendente = { tipo }
      return this.irParaAlvo()
    }

    if (this.etapa === 'alvo') {
      tocar(this.b, 'confirmar')
      this.pendente.alvo = opcao
      return this.depoisDoAlvo()
    }

    if (this.etapa === 'act') {
      if ((opcao.custoTP ?? 0) > this.b.tpDisponivel()) return this.erro()
      tocar(this.b, 'confirmar')
      return this.escolher({ ...this.pendente, item: opcao })
    }

    if (this.etapa === 'item') {
      if (this.b.itemDisponivel(opcao.id) <= 0) return this.erro()
      tocar(this.b, 'confirmar')
      if (opcao.def.alvo !== 'aliado') return this.escolher({ tipo: 'ITEM', item: opcao.id })
      this.pendente = { tipo: 'ITEM', item: opcao.id }
      return this.irPara('aliado', this.b.party.indexOf(this.membro))
    }

    if (this.etapa === 'aliado') {
      tocar(this.b, 'confirmar')
      this.escolher({ ...this.pendente, aliado: opcao })
    }
  }

  cancelar() {
    if (this.etapa === 'act' && this.b.inimigosAtivos().length > 1) {
      this.irPara('alvo', this.b.inimigosAtivos().indexOf(this.pendente.alvo))
    } else if (this.etapa === 'act' || this.etapa === 'alvo' || this.etapa === 'item') {
      this.voltarAoComando(this.pendente?.tipo ?? 'ITEM')
    } else if (this.etapa === 'aliado') {
      const indice = this.b.inventario.lista().findIndex((e) => e.id === this.pendente.item)
      this.pendente = null
      this.irPara('item', indice)
    } else if (this.i > 0) {
      // volta para o personagem anterior (também desfaz o "pronto")
      this.i--
      const tipo = this.membro.acao?.tipo
      this.membro.acao = null
      this.voltarAoComando(tipo)
    } else {
      return
    }
    tocar(this.b, 'cancelar')
    this.b.atualizarUI()
  }

  irPara(etapa, cursor = 0) {
    this.etapa = etapa
    this.cursor = Math.max(0, cursor)
    this.b.atualizarUI()
  }

  irParaAlvo() {
    const inimigos = this.b.inimigosAtivos()
    if (inimigos.length === 1) {
      this.pendente.alvo = inimigos[0]
      return this.depoisDoAlvo()
    }
    this.irPara('alvo')
  }

  depoisDoAlvo() {
    if (this.pendente.tipo === 'ACT') return this.irPara('act')
    this.escolher(this.pendente)
  }

  voltarAoComando(tipo) {
    this.pendente = null
    this.etapa = 'comando'
    this.cursor = Math.max(0, this.membro.comandos.findIndex((c) => c.tipo === tipo))
  }

  escolher(acao) {
    this.membro.acao = acao
    this.pendente = null
    this.i++
    this.cursor = 0
    this.etapa = this.i < this.membros.length ? 'comando' : 'pronto'
    this.b.verificarMenus()
  }

  erro() {
    tocar(this.b, 'erro')
  }

  // Custo de TP do ACT/magia com o cursor em cima (pré-visualização na barra)
  previaTP() {
    if (this.etapa !== 'act') return 0
    return this.acts()[this.cursor]?.custoTP ?? 0
  }

  // O que este jogador vê na caixa de texto
  coluna() {
    const jogador = this.b.numJogadores > 1 ? `P${this.jogador + 1}` : ''
    const base = { corCursor: this.corCursor, cursor: this.cursor }
    if (this.pronto) {
      return { titulo: jogador, texto: this.membros.length ? 'Pronto! (B para voltar)' : '(caído)' }
    }

    const titulo = [jogador, this.membro.nome].filter(Boolean).join(' · ')
    const cor = corTexto(this.membro.cor)

    if (this.etapa === 'comando') return { titulo, cor, texto: this.b.textoFlavor }

    if (this.etapa === 'alvo') {
      const itens = this.b.inimigosAtivos().map((e) => ({
        texto: e.nome,
        direita: e.revelado ? `HP ${Math.ceil((e.hp / e.max) * 100)}%` : '',
      }))
      const alvo = this.b.inimigosAtivos()[this.cursor]
      return { ...base, titulo, cor, itens, rodape: alvo ? `${alvo.def.rotuloMercy ?? 'MERCY'} ${alvo.mercy}%` : '' }
    }

    if (this.etapa === 'act') {
      const tp = this.b.tpDisponivel()
      const acts = this.acts()
      const itens = acts.length
        ? acts.map((a) => ({
            texto: a.nome,
            direita: a.custoTP ? `${a.custoTP}% TP` : '',
            desabilitado: (a.custoTP ?? 0) > tp,
          }))
        : [{ texto: '(nada)', desabilitado: true }]
      return { ...base, titulo, cor, itens }
    }

    if (this.etapa === 'item') {
      const lista = this.b.inventario.lista()
      const itens = lista.map((e) => {
        const disponivel = this.b.itemDisponivel(e.id)
        return { texto: e.def.nome, direita: `x${disponivel}`, desabilitado: disponivel <= 0 }
      })
      return { ...base, titulo, cor, itens, rodape: lista[this.cursor]?.def.descricao ?? '' }
    }

    // aliado
    const item = this.b.inventario.lista().find((e) => e.id === this.pendente?.item)
    const itens = this.b.party.map((m) => ({ texto: m.nome, direita: `${m.hp}/${m.max}` }))
    return { ...base, titulo, cor, itens, rodape: item ? `${item.def.nome} em quem?` : '' }
  }
}
