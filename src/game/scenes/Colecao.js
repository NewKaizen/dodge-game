import { get } from 'svelte/store'
import CenaConta from '../conta/Base.js'
import { tocar } from '../audio.js'
import { LARGURA } from '../constants.js'
import { caber, criarAvatar, seta, verso, COR } from '../conta/ui.js'
import { abaVizinha, escondidas, janela, moverNaGrade } from '../conta/lista.js'
import { conta, carregarInventario, equipar, entrarComGoogle } from '../../lib/conta.js'
import { avatarDoPerfil } from '../../lib/contaRegras.js'
import { CATALOGO, TIPOS_ITEM, corDaMoldura, progressoDoXp } from '../../lib/progresso.js'

// COLEÇÃO, dentro do jogo (antes era o painel Svelte por cima dele): os
// cosméticos da trilha de níveis, o que a conta já tem e o que falta (com o
// nível que libera), e equipar. Uma aba por tipo (AVATARES / TÍTULOS /
// MOLDURAS / VERSOS); a grade à esquerda e, à direita, o item em foco grande.
// O banco confere se a conta tem o item (equipar, 0003_progresso.sql);
// cosmético nunca muda nada na partida.
//
//   ↑↓←→ escolhe na grade (↑ no topo vai para as abas, ←→ troca de aba) · A equipa · B volta
//   scene.start('Colecao', { pilha: [{ cena: 'Perfil' }] })
const ABAS = [
  { tipo: 'avatar', rotulo: 'AVATARES' },
  { tipo: 'titulo', rotulo: 'TÍTULOS' },
  { tipo: 'moldura', rotulo: 'MOLDURAS' },
  { tipo: 'verso', rotulo: 'VERSOS' },
]
const GRADE = { x: 24, y: 78, largura: 510, altura: 358, colunas: 4, linhas: 3, cel: { l: 120, a: 100 } }
const DETALHE = { x: 544, y: 78, largura: 286, altura: 358 }
const ABAS_UI = { y: 54, altura: 26, esquerda: 44, direita: LARGURA - 44, folga: 6 }

export default class Colecao extends CenaConta {
  constructor() {
    super('Colecao')
  }

  create() {
    this.iniciarBase({ titulo: 'COLEÇÃO' })
    this.ouvir(conta)
    this.aba = 0
    this.foco = 'grade' // 'abas' | 'grade'
    this.indice = 0
    this.mensagem = null
    this.ocupado = false
    carregarInventario()
  }

  travado() {
    return this.ocupado
  }

  get perfil() {
    const c = get(conta)
    return c.estado === 'logado' ? c.perfil : null
  }

  // ---------- dados ----------

  itens() {
    return CATALOGO.filter((i) => i.tipo === ABAS[this.aba].tipo)
  }

  possui(item) {
    return Boolean(item.padrao || get(conta).inventario?.has(item.id))
  }

  // o que está equipado de cada tipo (sem título/moldura/verso equipado = o padrão)
  equipado(item) {
    const p = this.perfil
    if (!p) return false
    if (item.tipo === 'titulo') return p.titulo_equipado === item.id
    if (item.tipo === 'moldura') return (p.moldura_equipada ?? 'moldura.simples') === item.id
    if (item.tipo === 'verso') return (p.verso_equipado ?? 'verso.classico') === item.id
    return p.avatar_tipo === 'jogo' && p.avatar_id === item.id.split('.')[1]
  }

  async usar(item) {
    if (this.ocupado || !this.possui(item)) return
    this.ocupado = true
    this.mensagem = null
    this.sujo = true
    // A no título já equipado tira o título
    const tirar = item.tipo === 'titulo' && this.equipado(item)
    const r = await equipar(item.tipo, tirar ? null : item.id)
    this.ocupado = false
    this.mensagem = r.ok ? { texto: tirar ? 'título removido' : `${item.nome} equipado`, cor: COR.ok } : { texto: r.erro, cor: COR.erro }
    this.sujo = true
  }

  // ---------- entrada ----------

  aoDirecao(d) {
    if (!this.perfil) {
      if (d === 'cima' || d === 'baixo') this.sujo = true
      return
    }
    if (this.foco === 'abas') {
      if (d === 'esquerda' || d === 'direita') this.trocarAba(d === 'direita' ? 1 : -1)
      if (d === 'baixo') {
        this.foco = 'grade'
        this.indice = 0
        tocar(this, 'mover')
        this.sujo = true
      }
      return
    }
    const r = moverNaGrade(this.indice, this.itens().length, GRADE.colunas, d)
    if (r.sair === 'cima') {
      this.foco = 'abas'
      tocar(this, 'mover')
    } else if (r.indice !== this.indice) {
      this.indice = r.indice
      this.mensagem = null
      tocar(this, 'mover')
    } else return
    this.sujo = true
  }

  trocarAba(passo) {
    this.aba = abaVizinha(ABAS.length, this.aba, passo)
    this.indice = 0
    this.mensagem = null
    tocar(this, 'mover')
    this.sujo = true
  }

  aoBotao(botao) {
    if (botao === 'B') {
      tocar(this, 'cancelar')
      if (this.perfil && this.foco === 'abas') {
        this.foco = 'grade'
        this.sujo = true
        return
      }
      return this.voltar()
    }
    if (botao !== 'A') return
    const c = get(conta)
    if (!this.perfil) {
      tocar(this, 'confirmar')
      if (c.estado === 'deslogado') return entrarComGoogle()
      return this.voltar()
    }
    if (this.foco === 'abas') {
      this.foco = 'grade'
      this.sujo = true
      return
    }
    const item = this.itens()[this.indice]
    if (!item) return
    if (!this.possui(item)) return tocar(this, 'cancelar')
    tocar(this, 'confirmar')
    this.usar(item)
  }

  // ---------- desenho ----------

  desenhar() {
    const p = this.perfil
    if (!p) {
      const c = get(conta)
      this.subTexto.setText('')
      return this.telaCentral({
        titulo: c.estado === 'carregando' ? 'CARREGANDO A CONTA…' : 'A COLEÇÃO É DA SUA CONTA',
        linhas: c.estado === 'deslogado' ? ['Subindo de nível você ganha títulos, molduras,', 'versos de carta e avatares.', '', 'Entre com o Google para começar a sua coleção.'] : c.estado === 'indisponivel' ? ['Este servidor não tem contas: sem coleção por aqui.'] : ['só um instante'],
        erro: c.erro,
        itens: c.estado === 'deslogado' ? [{ rotulo: 'ENTRAR COM GOOGLE', cor: COR.gold }, { rotulo: 'VOLTAR' }] : [{ rotulo: 'VOLTAR' }],
        indice: 0,
      })
    }
    const nivel = progressoDoXp(p.xp).nivel
    const tem = CATALOGO.filter((i) => this.possui(i)).length
    this.subTexto.setText(`nível ${nivel}  ·  ${tem}/${CATALOGO.length} itens`)
    this.desenharAbas()
    this.caixa(GRADE.x, GRADE.y, GRADE.largura, GRADE.altura)
    this.caixa(DETALHE.x, DETALHE.y, DETALHE.largura, DETALHE.altura)
    this.desenharGrade(p)
    this.desenharDetalhe(p, nivel)
    this.rodape(this.foco === 'abas' ? [['esqDir', 'Aba'], ['cimaBaixo', 'Entrar'], ['B', 'Voltar']] : [['cimaBaixo', 'Escolher'], ['esqDir', 'Escolher'], ['A', 'Equipar'], ['B', 'Voltar']])
  }

  desenharAbas() {
    const g = this.grafico()
    const largura = (ABAS_UI.direita - ABAS_UI.esquerda - ABAS_UI.folga * (ABAS.length - 1)) / ABAS.length
    ABAS.forEach((aba, i) => {
      const x = ABAS_UI.esquerda + i * (largura + ABAS_UI.folga)
      const ativa = i === this.aba
      const doTipo = CATALOGO.filter((c) => c.tipo === aba.tipo)
      g.fillStyle(0x0b0914, 0.94).fillRect(x, ABAS_UI.y - ABAS_UI.altura / 2, largura, ABAS_UI.altura)
      g.lineStyle(3, ativa ? 0xffe040 : 0x4a4a5c, 1).strokeRect(x + 1.5, ABAS_UI.y - ABAS_UI.altura / 2 + 1.5, largura - 3, ABAS_UI.altura - 3)
      this.t(x + largura / 2, ABAS_UI.y, `${aba.rotulo}  ${doTipo.filter((c) => this.possui(c)).length}/${doTipo.length}`, 15, ativa ? '#ffe040' : COR.apagado).setOrigin(0.5)
      if (ativa && this.foco === 'abas') this.cursorEm(x + 16, ABAS_UI.y, 0.85)
    })
    seta(g, 24, ABAS_UI.y, 'esquerda', 6, 0xffe040)
    seta(g, LARGURA - 24, ABAS_UI.y, 'direita', 6, 0xffe040)
  }

  // um item pequeno (na grade) ou grande (no detalhe)
  amostra(item, p, x, y, escala) {
    const moldura = corDaMoldura(p.moldura_equipada)
    if (item.tipo === 'avatar') this.view.add(criarAvatar(this, x, y, { tipo: 'jogo', id: item.id.split('.')[1] }, 36 * escala, moldura))
    else if (item.tipo === 'moldura') this.view.add(criarAvatar(this, x, y, avatarDoPerfil(p), 36 * escala, item.cor))
    else if (item.tipo === 'verso') verso(this.grafico(), x - 14 * escala, y - 20 * escala, 28 * escala, 40 * escala, item.cor)
    else this.t(x, y, item.nome, escala > 1 ? 20 : 13, COR.titulo, { wordWrap: { width: escala > 1 ? 250 : GRADE.cel.l - 18 }, align: 'center' }).setOrigin(0.5)
  }

  desenharGrade(p) {
    const itens = this.itens()
    const { colunas, linhas, cel } = GRADE
    const x0 = GRADE.x + (GRADE.largura - cel.l * colunas) / 2
    const linhaSel = Math.floor(this.indice / colunas)
    const totalLinhas = Math.ceil(itens.length / colunas)
    const inicio = janela(totalLinhas, linhaSel, linhas)
    itens.forEach((item, i) => {
      const linha = Math.floor(i / colunas) - inicio
      if (linha < 0 || linha >= linhas) return
      const x = x0 + (i % colunas) * cel.l + cel.l / 2
      const y = GRADE.y + 14 + linha * cel.a + cel.a / 2
      const sel = this.foco === 'grade' && i === this.indice
      const tem = this.possui(item)
      const g = this.grafico()
      g.fillStyle(0xffffff, sel ? 0.1 : 0.04).fillRect(x - cel.l / 2 + 4, y - cel.a / 2 + 2, cel.l - 8, cel.a - 6)
      if (sel) g.lineStyle(3, 0xffe040, 1).strokeRect(x - cel.l / 2 + 5.5, y - cel.a / 2 + 3.5, cel.l - 11, cel.a - 9)
      if (this.equipado(item)) g.lineStyle(2, 0x7fe08a, 1).strokeRect(x - cel.l / 2 + 9, y - cel.a / 2 + 7, cel.l - 18, cel.a - 17)
      this.amostra(item, p, x, y - 14, 1)
      if (!tem) {
        // bloqueado: véu e o nível que libera
        g.fillStyle(0x000000, 0.62).fillRect(x - cel.l / 2 + 4, y - cel.a / 2 + 2, cel.l - 8, cel.a - 6)
        // o cadeado (nos títulos, no canto de baixo: o meio é o texto)
        const [lx, ly] = item.tipo === 'titulo' ? [x + cel.l / 2 - 20, y + 14] : [x, y - 14]
        g.fillStyle(0x9a9ab0, 1).fillRect(lx - 8, ly, 16, 12)
        g.lineStyle(3, 0x9a9ab0, 1).strokeRect(lx - 5, ly - 10, 10, 10)
      }
      if (item.tipo !== 'titulo') caber(this.t(x, y + 22, item.nome, 12, tem ? COR.texto : COR.apagado).setOrigin(0.5), item.nome, cel.l - 14)
      const estado = tem ? (this.equipado(item) ? 'EQUIPADO' : item.padrao ? 'padrão' : 'seu') : `nível ${item.nivel}`
      this.t(x, y + (item.tipo === 'titulo' ? 22 : 36), estado, 10, tem ? (this.equipado(item) ? COR.ok : COR.dica) : COR.aviso).setOrigin(0.5)
      if (sel) this.cursorEm(x - cel.l / 2 + 16, y - cel.a / 2 + 16, 0.7)
    })
    const { acima, abaixo } = escondidas(totalLinhas, inicio, linhas)
    if (acima) this.t(GRADE.x + GRADE.largura - 14, GRADE.y + 6, `▲ ${acima}`, 10, COR.dica).setOrigin(1, 0)
    if (abaixo) this.t(GRADE.x + GRADE.largura - 14, GRADE.y + GRADE.altura - 20, `▼ ${abaixo}`, 10, COR.dica).setOrigin(1, 0)
    if (!itens.length) this.t(GRADE.x + 24, GRADE.y + 24, 'nada por aqui', 12, COR.apagado)
  }

  desenharDetalhe(p, nivel) {
    const item = this.foco === 'grade' ? this.itens()[this.indice] : null
    const d = DETALHE
    const cx = d.x + d.largura / 2
    if (!item) {
      this.t(cx, d.y + d.altura / 2, 'escolha um item\nna grade', 13, COR.apagado, { align: 'center' }).setOrigin(0.5)
      return
    }
    const tem = this.possui(item)
    this.amostra(item, p, cx, d.y + (item.tipo === 'titulo' ? 140 : 96), 2.2)
    if (item.tipo !== 'titulo') caber(this.t(cx, d.y + 176, item.nome, 20, COR.texto, { strokeThickness: 4 }).setOrigin(0.5), item.nome, d.largura - 24)
    const tipo = { avatar: 'AVATAR', titulo: 'TÍTULO', moldura: 'MOLDURA', verso: 'VERSO DE CARTA' }[item.tipo]
    this.t(cx, d.y + 200, tipo, 11, COR.dica).setOrigin(0.5)
    let estado
    if (this.equipado(item)) estado = { texto: item.tipo === 'titulo' ? 'EQUIPADO  ·  A tira o título' : 'EQUIPADO', cor: COR.ok }
    else if (tem) estado = { texto: 'A: EQUIPAR', cor: COR.gold }
    else estado = { texto: `libera no nível ${item.nivel}`, cor: COR.aviso }
    this.t(cx, d.y + 232, estado.texto, 14, estado.cor).setOrigin(0.5)
    if (!tem) this.t(cx, d.y + 254, nivel >= item.nivel ? 'jogue uma partida para receber' : `faltam ${item.nivel - nivel} nível${item.nivel - nivel > 1 ? 'is' : ''}`, 11, COR.dica).setOrigin(0.5)
    if (item.tipo === 'verso') this.t(cx, d.y + 282, 'o verso aparece aqui por enquanto;\nnas cartas da partida entra numa\npróxima versão', 10, COR.apagado, { align: 'center' }).setOrigin(0.5, 0)
    else this.t(cx, d.y + 290, 'cosméticos não mudam nada no jogo', 10, COR.apagado).setOrigin(0.5)
    const m = this.ocupado ? { texto: 'equipando…', cor: COR.aviso } : this.mensagem ?? (get(conta).inventario === null ? { texto: 'carregando o inventário…', cor: COR.dica } : null)
    if (m) this.t(cx, d.y + d.altura - 24, m.texto, 12, m.cor, { wordWrap: { width: d.largura - 28 }, align: 'center' }).setOrigin(0.5)
  }
}
