import { get } from 'svelte/store'
import CenaConta from '../conta/Base.js'
import { tocar } from '../audio.js'
import { LARGURA } from '../constants.js'
import { caber, criarAvatar, seta, verso, COR } from '../conta/ui.js'
import { abaVizinha, escondidas, janela, moverNaGrade } from '../conta/lista.js'
import { conta, carregarInventario, equipar, entrarComGoogle } from '../../lib/conta.js'
import { avatarDoPerfil } from '../../lib/contaRegras.js'
import { CATALOGO, corDaMoldura, progressoDoXp } from '../../lib/progresso.js'
import { ITENS_CAMPANHA, mundoDe } from '../campanha/mundos/index.js'
import { trofeuDoId, ehTrofeuSemanal, SEMANAIS } from '../../lib/semanal.js'
import { cosmeticoDoId, cosmeticoDaSemana, ehCosmeticoDiario, DIAS_COSMETICO_SEMANA } from '../../lib/desafio.js'
import { CONQUISTAS, ITENS_MAESTRIA, PERSONAGENS_MAESTRIA, progressoDaMaestria, MAESTRIA_MAXIMA } from '../../lib/conquistas.js'
import { conquistasConta, pedirConquistas } from '../../lib/conquistasConta.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ESCALA } from '../arte/texturas.js'
import { semLigaduras } from '../campanha/texto.js'
import { lan } from '../../lib/lan/rede.js'

const corDoMundo = (id) => `#${(mundoDe(id)?.cor ?? 0x7fc46b).toString(16).padStart(6, '0')}`

// COLEÇÃO, dentro do jogo (antes era o painel Svelte por cima dele): os
// cosméticos da trilha de níveis, o que a conta já tem e o que falta (com o
// nível que libera), e equipar. Uma aba por tipo (AVATARES / TÍTULOS /
// MOLDURAS / VERSOS); a grade à esquerda e, à direita, o item em foco grande.
// O banco confere se a conta tem o item (equipar, 0003_progresso.sql);
// cosmético nunca muda nada na partida.
//
// TROFÉUS SEMANAIS (BOSS SEMANAL, docs/boss-semanal.md): os troféus exclusivos que a conta já ganhou
// (um por semana, título/moldura/verso; equipam como os outros) e o da semana de agora, com cadeado
// enquanto não ganhou (a semana vem do servidor: lan.semanal).
//
// DESAFIO DIÁRIO (4A): o cosmético raro de cada semana entra na mesma aba dos semanais.
// CONQUISTAS e MAESTRIA (4B, docs/desafio-diario.md): duas abas a mais. CONQUISTAS mostra todas (as
// ocultas aparecem como "???" até ganhar); MAESTRIA, uma barra por personagem com o nível e os
// cosméticos do nível 5 e 10 (que também aparecem nas abas de títulos e molduras). Os dados vêm do
// servidor pelo lobby (lib/conquistasConta.js). Todo texto passa por semLigaduras (a fonte junta fi/fl).
//
//   ↑↓←→ escolhe na grade (↑ no topo vai para as abas, ←→ troca de aba) · A equipa · B volta
//   scene.start('Colecao', { pilha: [{ cena: 'Perfil' }] })
const ABAS = [
  { tipo: 'avatar', rotulo: 'AVATARES' },
  { tipo: 'titulo', rotulo: 'TÍTULOS' },
  { tipo: 'moldura', rotulo: 'MOLDURAS' },
  { tipo: 'verso', rotulo: 'VERSOS' },
  { tipo: 'semanal', rotulo: 'SEMANAIS' },
  { tipo: 'conquistas', rotulo: 'CONQUISTAS' },
  { tipo: 'maestria', rotulo: 'MAESTRIA' },
]
// as abas que não equipam nada (só mostram)
const SO_VER = new Set(['conquistas', 'maestria'])
const COR_MEDALHA = 0xe0b84a

const estadoInicial = () => ({
  aba: 0,
  foco: 'grade', // 'abas' | 'grade'
  indice: 0,
  mensagem: null,
  ocupado: false,
})
const GRADE = { x: 24, y: 78, largura: 510, altura: 358, colunas: 4, linhas: 3, cel: { l: 120, a: 100 } }
const DETALHE = { x: 544, y: 78, largura: 286, altura: 358 }
const ABAS_UI = { y: 54, altura: 26, esquerda: 44, direita: LARGURA - 44, folga: 6 }

export default class Colecao extends CenaConta {
  constructor() {
    super('Colecao')
  }

  create() {
    Object.assign(this, estadoInicial())
    this.iniciarBase({ titulo: 'COLEÇÃO' })
    this.ouvir(conta)
    this.ouvir(conquistasConta)
    carregarInventario()
    if (get(conta).estado === 'logado') pedirConquistas()
  }

  // todo texto da Coleção sem a ligadura fi/fl (nomes de cosméticos e conquistas)
  t(x, y, conteudo, ...resto) {
    return super.t(x, y, semLigaduras(conteudo), ...resto)
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
    return this.itensDe(ABAS[this.aba].tipo)
  }

  itensDe(tipo) {
    if (tipo === 'conquistas') return CONQUISTAS.map((c) => ({ ...c, tipo: 'conquista' }))
    if (tipo === 'maestria') return PERSONAGENS_MAESTRIA.map((p) => ({ id: `maestria.${p}`, tipo: 'maestria', personagem: p, nome: PERSONAGENS[p].nome }))
    // os da CAMPANHA (docs/campanha.md) e os da MAESTRIA entram no fim da aba do tipo deles
    if (tipo !== 'semanal') return [...CATALOGO.filter((i) => i.tipo === tipo), ...ITENS_CAMPANHA.filter((i) => i.tipo === tipo), ...ITENS_MAESTRIA.filter((i) => i.tipo === tipo)]
    // os ganhos (a semana mais nova primeiro) e os desta semana (boss semanal e desafio diário), se ainda não tem
    const inv = [...(get(conta).inventario ?? [])]
    const ganhos = [...inv.filter(ehTrofeuSemanal).map(trofeuDoId), ...inv.filter(ehCosmeticoDiario).map(cosmeticoDoId)].filter(Boolean)
    const semana = get(lan).semanal?.semana
    const atuais = [get(lan).semanal?.trofeu, semana ? cosmeticoDaSemana(semana) : null].filter((t) => t && !ganhos.some((g) => g.id === t.id))
    return [...atuais, ...ganhos].sort((a, b) => (a.semana < b.semana ? 1 : a.semana > b.semana ? -1 : a.diario ? 1 : -1))
  }

  possui(item) {
    if (item.tipo === 'conquista') return get(conquistasConta).conquistas.has(item.id)
    if (item.tipo === 'maestria') return (get(conquistasConta).maestria[item.personagem]?.pontos ?? 0) > 0
    return Boolean(item.padrao || get(conta).inventario?.has(item.id))
  }

  // o que está equipado de cada tipo (sem título/moldura/verso equipado = o padrão)
  equipado(item) {
    const p = this.perfil
    if (!p || SO_VER.has(item.tipo.replace('conquista', 'conquistas'))) return false
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
    if (item.tipo === 'conquista' || item.tipo === 'maestria') return tocar(this, 'mover')
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
    const soVer = SO_VER.has(ABAS[this.aba].tipo)
    this.rodape(this.foco === 'abas' ? [['esqDir', 'Aba'], ['cimaBaixo', 'Entrar'], ['B', 'Voltar']] : soVer ? [['cimaBaixo', 'Escolher'], ['esqDir', 'Escolher'], ['B', 'Voltar']] : [['cimaBaixo', 'Escolher'], ['esqDir', 'Escolher'], ['A', 'Equipar'], ['B', 'Voltar']])
  }

  desenharAbas() {
    const g = this.grafico()
    const largura = (ABAS_UI.direita - ABAS_UI.esquerda - ABAS_UI.folga * (ABAS.length - 1)) / ABAS.length
    ABAS.forEach((aba, i) => {
      const x = ABAS_UI.esquerda + i * (largura + ABAS_UI.folga)
      const ativa = i === this.aba
      const doTipo = this.itensDe(aba.tipo)
      g.fillStyle(0x0b0914, 0.94).fillRect(x, ABAS_UI.y - ABAS_UI.altura / 2, largura, ABAS_UI.altura)
      g.lineStyle(3, ativa ? 0xffe040 : 0x4a4a5c, 1).strokeRect(x + 1.5, ABAS_UI.y - ABAS_UI.altura / 2 + 1.5, largura - 3, ABAS_UI.altura - 3)
      const rotulo = `${aba.rotulo} ${doTipo.filter((c) => this.possui(c)).length}/${doTipo.length}`
      this.t(x + largura / 2, ABAS_UI.y, rotulo, rotulo.length > 13 ? 10 : rotulo.length > 10 ? 12 : 14, ativa ? (aba.tipo === 'semanal' ? '#ffb060' : '#ffe040') : COR.apagado).setOrigin(0.5)
      if (ativa && this.foco === 'abas') this.cursorEm(x + 16, ABAS_UI.y, 0.85)
    })
    seta(g, 24, ABAS_UI.y, 'esquerda', 6, 0xffe040)
    seta(g, LARGURA - 24, ABAS_UI.y, 'direita', 6, 0xffe040)
  }

  // um item pequeno (na grade) ou grande (no detalhe)
  amostra(item, p, x, y, escala) {
    if (item.tipo === 'conquista') return this.medalha(item, x, y, escala)
    if (item.tipo === 'maestria') return this.retratoMaestria(item, x, y, escala)
    const moldura = corDaMoldura(p.moldura_equipada)
    if (item.tipo === 'avatar') this.view.add(criarAvatar(this, x, y, { tipo: 'jogo', id: item.id.split('.')[1] }, 36 * escala, moldura))
    else if (item.tipo === 'moldura') this.view.add(criarAvatar(this, x, y, avatarDoPerfil(p), 36 * escala, item.cor))
    else if (item.tipo === 'verso') verso(this.grafico(), x - 14 * escala, y - 20 * escala, 28 * escala, 40 * escala, item.cor)
    else this.t(x, y, item.nome, escala > 1 ? 20 : 13, COR.titulo, { wordWrap: { width: escala > 1 ? 250 : GRADE.cel.l - 18 }, align: 'center' }).setOrigin(0.5)
  }

  // a medalha de uma conquista (apagada sem ela; "?" nas ocultas que faltam)
  medalha(item, x, y, escala) {
    const tem = this.possui(item)
    const g = this.grafico()
    const r = 16 * escala
    g.fillStyle(tem ? COR_MEDALHA : 0x2a2838, 1).fillCircle(x, y, r)
    g.lineStyle(2 * escala, tem ? 0xfff0b0 : 0x4a4a5c, 1).strokeCircle(x, y, r - 3 * escala)
    g.fillStyle(tem ? 0xb03040 : 0x3a3848, 1).fillTriangle(x - r * 0.7, y - r * 0.6, x - r * 0.15, y - r * 1.6, x - r * 0.05, y - r * 0.8)
    g.fillStyle(tem ? 0x3050b0 : 0x3a3848, 1).fillTriangle(x + r * 0.7, y - r * 0.6, x + r * 0.15, y - r * 1.6, x + r * 0.05, y - r * 0.8)
    this.t(x, y, tem ? '★' : item.oculta ? '?' : '', 14 * escala, tem ? '#5a3a08' : COR.apagado).setOrigin(0.5)
  }

  // o personagem e a barra da maestria dele
  retratoMaestria(item, x, y, escala) {
    const m = get(conquistasConta).maestria[item.personagem]
    const pr = progressoDaMaestria(m?.pontos ?? 0)
    const img = this.add.image(x, y + 14 * escala, item.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem * 0.55 * escala)
    if (!m) img.setTint(0x55556a).setAlpha(0.7)
    this.view.add(img)
    const g = this.grafico()
    const w = 64 * escala
    const yb = y + 20 * escala
    g.fillStyle(0x14121e, 1).fillRect(x - w / 2, yb, w, 5 * escala)
    g.fillStyle(PERSONAGENS[item.personagem].cor, 1).fillRect(x - w / 2, yb, w * pr.fracao, 5 * escala)
    g.lineStyle(1, 0xffffff, 0.4).strokeRect(x - w / 2, yb, w, 5 * escala)
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
      if (item.tipo === 'conquista' || item.tipo === 'maestria') {
        const nome = item.tipo === 'conquista' && item.oculta && !tem ? '???' : item.nome
        caber(this.t(x, y + 22, nome, 11, tem ? COR.texto : COR.apagado).setOrigin(0.5), nome, cel.l - 14)
        const m = get(conquistasConta).maestria[item.personagem]
        const estado = item.tipo === 'conquista' ? (tem ? 'conquistada' : 'bloqueada') : `nível ${progressoDaMaestria(m?.pontos ?? 0).nivel}`
        this.t(x, y + 36, estado, 10, tem ? COR.ok : COR.dica).setOrigin(0.5)
        if (sel) this.cursorEm(x - cel.l / 2 + 16, y - cel.a / 2 + 16, 0.7)
        return
      }
      if (!tem) {
        // bloqueado: véu e o nível que libera
        g.fillStyle(0x000000, 0.62).fillRect(x - cel.l / 2 + 4, y - cel.a / 2 + 2, cel.l - 8, cel.a - 6)
        // o cadeado (nos títulos, no canto de baixo: o meio é o texto)
        const [lx, ly] = item.tipo === 'titulo' ? [x + cel.l / 2 - 20, y + 14] : [x, y - 14]
        g.fillStyle(0x9a9ab0, 1).fillRect(lx - 8, ly, 16, 12)
        g.lineStyle(3, 0x9a9ab0, 1).strokeRect(lx - 5, ly - 10, 10, 10)
      }
      if (item.tipo !== 'titulo') caber(this.t(x, y + 22, item.nome, 12, tem ? COR.texto : COR.apagado).setOrigin(0.5), item.nome, cel.l - 14)
      const estado = tem ? (this.equipado(item) ? 'EQUIPADO' : item.padrao ? 'padrão' : 'seu') : item.exclusivo || item.diario ? 'esta semana' : item.maestria ? `maestria ${item.maestria}` : item.campanha ? 'campanha' : `nível ${item.nivel}`
      this.t(x, y + (item.tipo === 'titulo' ? 22 : 36), estado, 10, tem ? (this.equipado(item) ? COR.ok : COR.dica) : COR.aviso).setOrigin(0.5)
      if (sel) this.cursorEm(x - cel.l / 2 + 16, y - cel.a / 2 + 16, 0.7)
    })
    const { acima, abaixo } = escondidas(totalLinhas, inicio, linhas)
    if (acima) this.t(GRADE.x + GRADE.largura - 14, GRADE.y + 6, `▲ ${acima}`, 10, COR.dica).setOrigin(1, 0)
    if (abaixo) this.t(GRADE.x + GRADE.largura - 14, GRADE.y + GRADE.altura - 20, `▼ ${abaixo}`, 10, COR.dica).setOrigin(1, 0)
    if (!itens.length) this.t(GRADE.x + 24, GRADE.y + 24, 'nada por aqui', 12, COR.apagado)
    if (SO_VER.has(ABAS[this.aba].tipo) && !get(conquistasConta).carregado) this.t(GRADE.x + GRADE.largura / 2, GRADE.y + GRADE.altura - 16, get(conquistasConta).erro || 'carregando do servidor…', 10, COR.dica).setOrigin(0.5)
  }

  // o detalhe de uma conquista: a medalha grande, o nome (??? se oculta), o que pede e quando ganhou
  detalheConquista(item, cx, d) {
    const tem = this.possui(item)
    this.medalha(item, cx, d.y + 96, 2.4)
    const segredo = item.oculta && !tem
    caber(this.t(cx, d.y + 176, segredo ? '???' : item.nome, 20, tem ? COR.texto : COR.apagado, { strokeThickness: 4 }).setOrigin(0.5), segredo ? '???' : item.nome, d.largura - 24)
    this.t(cx, d.y + 200, segredo ? 'CONQUISTA SECRETA' : 'CONQUISTA', 11, segredo ? '#b48cff' : COR.dica).setOrigin(0.5)
    this.t(cx, d.y + 224, segredo ? 'continue jogando: ela aparece quando acontecer' : item.descricao, 12, COR.descricao, { align: 'center', wordWrap: { width: d.largura - 40 } }).setOrigin(0.5, 0)
    const em = get(conquistasConta).conquistas.get(item.id)
    const quando = em ? new Date(em) : null
    this.t(cx, d.y + 290, tem ? `conquistada${quando && !Number.isNaN(quando.getTime()) ? ` em ${String(quando.getDate()).padStart(2, '0')}/${String(quando.getMonth() + 1).padStart(2, '0')}/${quando.getFullYear()}` : ''}` : 'ainda não', 13, tem ? COR.ok : COR.aviso).setOrigin(0.5)
    this.t(cx, d.y + d.altura - 24, 'só o servidor desbloqueia (com conta, online)', 10, COR.apagado).setOrigin(0.5)
  }

  // o detalhe da maestria: o personagem, o nível, a barra e os cosméticos de cada nível
  detalheMaestria(item, cx, d) {
    const m = get(conquistasConta).maestria[item.personagem]
    const pr = progressoDaMaestria(m?.pontos ?? 0)
    const img = this.add.image(cx, d.y + 120, item.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem * 1.1)
    if (!m) img.setTint(0x55556a)
    this.view.add(img)
    this.t(cx, d.y + 132, `${item.nome.toUpperCase()}  ·  MAESTRIA ${pr.nivel}${pr.nivel >= MAESTRIA_MAXIMA ? ' (MÁXIMA)' : ''}`, 15, COR.titulo).setOrigin(0.5, 0)
    const g = this.grafico()
    const w = d.largura - 60
    g.fillStyle(0x14121e, 1).fillRect(cx - w / 2, d.y + 158, w, 10)
    g.fillStyle(PERSONAGENS[item.personagem].cor, 1).fillRect(cx - w / 2, d.y + 158, w * pr.fracao, 10)
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(cx - w / 2, d.y + 158, w, 10)
    this.t(cx, d.y + 174, pr.proximo ? `${pr.atual}/${pr.proximo} para o nível ${pr.nivel + 1}` : 'nível máximo', 11, COR.dica).setOrigin(0.5, 0)
    this.t(cx, d.y + 192, `${m?.partidas ?? 0} partida${m?.partidas === 1 ? '' : 's'}  ·  ${m?.vitorias ?? 0} vitória${m?.vitorias === 1 ? '' : 's'}`, 11, COR.descricao).setOrigin(0.5, 0)
    ITENS_MAESTRIA.filter((i) => i.personagem === item.personagem).forEach((i, k) => {
      const tem = Boolean(get(conta).inventario?.has(i.id))
      this.t(cx, d.y + 222 + k * 22, `nível ${i.maestria}: ${i.tipo === 'titulo' ? 'título' : 'moldura'} "${i.nome}"${tem ? '  ✓' : ''}`, 11, tem ? COR.ok : COR.apagado).setOrigin(0.5, 0)
    })
    this.t(cx, d.y + 274, 'vitória +3 · derrota +1 · até 30 por dia', 10, COR.dica).setOrigin(0.5, 0)
    this.t(cx, d.y + 290, 'maestria é só cosmética: não muda nada no jogo', 10, COR.apagado).setOrigin(0.5)
  }

  desenharDetalhe(p, nivel) {
    const item = this.foco === 'grade' ? this.itens()[this.indice] : null
    const d = DETALHE
    const cx = d.x + d.largura / 2
    if (!item) {
      this.t(cx, d.y + d.altura / 2, 'escolha um item\nna grade', 13, COR.apagado, { align: 'center' }).setOrigin(0.5)
      return
    }
    if (item.tipo === 'conquista') return this.detalheConquista(item, cx, d)
    if (item.tipo === 'maestria') return this.detalheMaestria(item, cx, d)
    const tem = this.possui(item)
    this.amostra(item, p, cx, d.y + (item.tipo === 'titulo' ? 140 : 96), 2.2)
    if (item.tipo !== 'titulo') caber(this.t(cx, d.y + 176, item.nome, 20, COR.texto, { strokeThickness: 4 }).setOrigin(0.5), item.nome, d.largura - 24)
    const tipo = { avatar: 'AVATAR', titulo: 'TÍTULO', moldura: 'MOLDURA', verso: 'VERSO DE CARTA' }[item.tipo]
    const origem = item.campanha ? `${tipo} · CAMPANHA, MUNDO ${item.mundo}` : item.diario ? `${tipo} · DESAFIO DIÁRIO ${item.semana}` : item.exclusivo ? `${tipo} · TROFÉU SEMANAL ${item.semana}` : item.maestria ? `${tipo} · MAESTRIA ${PERSONAGENS[item.personagem].nome.toUpperCase()}` : tipo
    this.t(cx, d.y + 200, origem, 11, item.campanha ? corDoMundo(item.mundo) : item.exclusivo || item.diario ? '#ffb060' : COR.dica).setOrigin(0.5)
    let estado
    if (this.equipado(item)) estado = { texto: item.tipo === 'titulo' ? 'EQUIPADO  ·  A tira o título' : 'EQUIPADO', cor: COR.ok }
    else if (tem) estado = { texto: 'A: EQUIPAR', cor: COR.gold }
    else if (item.campanha) estado = { texto: item.quando === 'mundo' ? `vença o chefe de ${mundoDe(item.mundo)?.nome}` : `3 estrelas em todas as fases de ${mundoDe(item.mundo)?.nome}`, cor: COR.aviso }
    else if (item.diario) estado = { texto: `vença o desafio diário em ${DIAS_COSMETICO_SEMANA} dias da semana`, cor: COR.aviso }
    else if (item.maestria) estado = { texto: `maestria ${item.maestria} com ${PERSONAGENS[item.personagem].nome}`, cor: COR.aviso }
    else if (item.exclusivo) estado = { texto: `vença: ${SEMANAIS[item.chefe]?.nome ?? 'o boss semanal'}`, cor: COR.aviso }
    else estado = { texto: `libera no nível ${item.nivel}`, cor: COR.aviso }
    this.t(cx, d.y + 232, estado.texto, 14, estado.cor).setOrigin(0.5)
    if (!tem && item.campanha) this.t(cx, d.y + 254, 'menu → CAMPANHA (com conta)', 11, COR.dica).setOrigin(0.5)
    else if (!tem && item.diario) this.t(cx, d.y + 254, 'menu → DESAFIO DIÁRIO · só até domingo, nunca volta', 11, COR.dica).setOrigin(0.5)
    else if (!tem && item.maestria) this.t(cx, d.y + 254, 'jogue com o personagem (aba MAESTRIA)', 11, COR.dica).setOrigin(0.5)
    else if (!tem && item.exclusivo) this.t(cx, d.y + 254, 'ONLINE · BOSS SEMANAL · só até domingo, nunca volta', 11, COR.dica).setOrigin(0.5)
    else if (!tem) this.t(cx, d.y + 254, nivel >= item.nivel ? 'jogue uma partida para receber' : `faltam ${item.nivel - nivel} nível${item.nivel - nivel > 1 ? 'is' : ''}`, 11, COR.dica).setOrigin(0.5)
    if (item.tipo === 'verso') this.t(cx, d.y + 282, 'equipado, este verso aparece nas suas\ncartas nas partidas (online, o\noutro jogador também vê)', 10, COR.apagado, { align: 'center' }).setOrigin(0.5, 0)
    else this.t(cx, d.y + 290, 'cosméticos não mudam nada no jogo', 10, COR.apagado).setOrigin(0.5)
    // os da campanha têm um texto (o catálogo do banco não tem descrição: fica em mundos/mundoN.js)
    if (item.descricao) this.t(cx, d.y + 306, item.descricao, 10, COR.dica, { align: 'center', wordWrap: { width: d.largura - 40 } }).setOrigin(0.5, 0)
    const m = this.ocupado ? { texto: 'equipando…', cor: COR.aviso } : this.mensagem ?? (get(conta).inventario === null ? { texto: 'carregando o inventário…', cor: COR.dica } : null)
    if (m) this.t(cx, d.y + d.altura - 24, m.texto, 12, m.cor, { wordWrap: { width: d.largura - 28 }, align: 'center' }).setOrigin(0.5)
  }
}
