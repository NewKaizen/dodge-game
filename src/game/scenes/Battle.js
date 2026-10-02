import Phaser from 'phaser'
import Ator from '../entities/Ator.js'
import Inimigo from '../entities/Inimigo.js'
import BattleBox from '../entities/BattleBox.js'
import Balas from '../entities/Bullets.js'
import Heart from '../entities/Heart.js'
import Hud, { IndicadorVelocidade } from '../entities/Hud.js'
import TextBox from '../entities/TextBox.js'
import Balao from '../entities/Balao.js'
import Controles from '../controles.js'
import MenuComandos from '../battle/MenuComandos.js'
import Fight from '../battle/Fight.js'
import Inventario from '../battle/Inventario.js'
import ContextoAtaque from '../attacks/contexto.js'
import { ataques, PADROES } from '../attacks/index.js'
import { encurtar, preparoCaixa } from '../attacks/definir.js'
import { novaRodada, validarEspacoLivre, estatisticas } from '../attacks/validacao.js'
import { criarFundo } from '../backgrounds/index.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { etiqueta, descreverModificador } from '../effects/etiqueta.js'
import { particulas } from '../effects/particulas.js'
import { impactoDerrota, fimSuave, depoisDoSilencio } from '../effects/fimDeLuta.js'
import { derrota } from '../effects/derrota.js'
import { tocar, musica, pausarMusica, retomarMusica, velocidadeMusica } from '../audio.js'
import { debug } from '../debug.js'
import { nivelDe, sortearCaos, comCaos, abrirTurno, criarEtiquetaNivel } from '../battle/nivel.js'
import { iniciarEstatisticas, contar, anotarDano, resumoEstatisticas } from '../battle/estatisticas.js'
import { ESCALA } from '../arte/texturas.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ITENS } from '../data/itens.js'
import { CHEFES } from '../data/chefes/index.js'
import { BATALHA, partyDe } from '../data/batalha.js'
import { FIGHT, DESAFIO, ATAQUE, CORES, TEXTO, LAYOUT, TP, DEFEND, TEMPOS, COMANDOS, MERCY_MAX, DIFICULDADES, RITMO, IMPACTO, FONTE, LARGURA, CORACAO } from '../constants.js'
import { ACELERACAO, fatorAceleracao, nivelAceleracao, parteDoFator } from '../constants.js' // morte súbita
import { ignorarNasCaixas } from '../recorte.js'

// Batalha no estilo Deltarune. Fases de cada turno:
//   'intro'     entrada (só no começo)
//   'menu'      cada jogador escolhe FIGHT/ACT/ITEM/SPARE/DEFEND para seus personagens
//   'fight'     barras do FIGHT (todos que escolheram FIGHT, ao mesmo tempo)
//   'mensagens' ACTs, itens, SPARE e textos (A avança)
//   'fala'      balão de fala do chefe
//   'inimigo'   corações na caixa desviando do ataque
//   'fim'       saindo para a vitória ou o game over
//
// Morte súbita (ACELERACAO em constants.js): cada turno do chefe é uma rodada;
// a cada 5 (começo do 6º, 11º...) tudo acelera: balas (velocidade, densidade e
// teto, POR CIMA dos limites de RITMO), o coração (metade do bônus) e a música.
export default class Battle extends Phaser.Scene {
  constructor() {
    super('Battle')
  }

  init(dados) {
    this.idChefe = dados?.chefe ?? this.registry.get('chefe') ?? BATALHA.chefePadrao
    this.nivel = nivelDe(this.registry, dados?.nivel) // FÁCIL / MÉDIO / DIFÍCIL (battle/nivel.js)
  }

  create() {
    this.registry.set('chefe', this.idChefe)
    this.defChefe = CHEFES[this.idChefe]
    this.dificuldade = DIFICULDADES[this.defChefe.dificuldade]
    this.numJogadores = this.registry.get('numJogadores') ?? 1
    this.rng = new Phaser.Math.RandomDataGenerator([`${ATAQUE.semente}:${this.idChefe}`])
    this.controles = new Controles(this)
    this.controles.onBotao((jogador, botao) => this.aoBotao(jogador, botao))
    this.controles.onPausa(() => this.pausar())
    this.pausado = false

    this.fundo = criarFundo(this, this.defChefe.fundo, this.nivel.fundo)
    this.party = partyDe(this.registry).map((id, i) => this.criarMembro(id, i))
    this.chefe = this.criarChefe(this.defChefe)
    this.inimigos = [this.chefe]
    this.inventario = new Inventario(this.defChefe.inventario)
    this.tp = 0
    this.tpCheioAntes = false
    this.turno = 0
    iniciarEstatisticas(this) // números da luta para a tela de vitória
    this.fila = []
    this.falas = []
    this.menus = []
    this.fight = null
    this.ataque = null
    this.vezesAtaque = {}
    this.ultimoGraze = 0
    this.saindo = false
    this.textoFlavor = this.defChefe.textoInicial

    this.caixa = new BattleBox(this)
    this.balas = new Balas(this, this.caixa)
    this.velocidadeMaxBase = this.dificuldade.velocidadeMaxBala * DESAFIO.velocidadeMax * this.nivel.velocidadeMax
    this.balas.velocidadeMax = this.velocidadeMaxBase
    this.aceleracao = 1 // fator da morte súbita (ver aplicarAceleracao)
    this.nivelAceleracao = 0
    this.coracoes = Array.from({ length: this.numJogadores }, (_, j) => new Heart(this, this.caixa, CORES.almas[j], j))
    this.caixa.aoMudar = () => this.coracoes.forEach((c) => c.ativo && c.ajustar()) // a caixa empurra os corações
    this.hud = new Hud(this, this.party, this.numJogadores)
    this.textbox = new TextBox(this)
    this.balao = new Balao(this)
    criarEtiquetaNivel(this, this.nivel)
    // selo da morte súbita no canto de cima à esquerda (escondido enquanto for x1)
    this.indicadorVelocidade = new IndicadorVelocidade(this, 8, 6, { origem: [0, 0], tamanho: 12, profundidade: 30 })
    this.events.once('shutdown', () => velocidadeMusica(1)) // a próxima tela não herda a música acelerada

    if (import.meta.env.DEV) {
      window.ataques = ataques
      window.testarAtaque = (ataque) => this.testarAtaque(ataque)
      window.listarAtaques = () => PADROES
      // ataques configurados do chefe atual, por fase (usado pelos testes)
      window.ataquesDoChefe = () => this.defChefe.fases.flatMap((f, fase) => f.ataques.map((ataque, i) => ({ fase, i, ataque })))
      this.events.once('shutdown', () => delete window.testarAtaque)
    }

    velocidadeMusica(1) // recomeçar a luta volta ao andamento normal
    musica(this, this.defChefe.musica)
    this.intro()
  }

  update(time, deltaReal) {
    const delta = deltaReal * debug.acelerar
    this.tweens.timeScale = debug.acelerar
    this.fundo.atualizar(delta)
    this.hud.tick(delta)
    this.textbox.atualizar(delta)
    this.balao.atualizar(delta)
    this.controles.atualizar()
    this.coracoes.forEach((c) => c.tick(delta))

    if (this.fase === 'menu') {
      for (const menu of this.menus) {
        const direcao = this.controles.toque(menu.jogador)
        if (direcao) menu.navegar(direcao)
      }
    } else if (this.fase === 'fight') {
      this.fight.atualizar(delta)
    } else if (this.fase === 'fala') {
      if (this.balao.terminou) this.proximaFala()
    } else if (this.fase === 'inimigo') {
      // passos pequenos para as balas rápidas não atravessarem o coração
      const passos = Math.max(1, Math.ceil(delta / 20))
      for (let k = 0; k < passos && this.fase === 'inimigo'; k++) this.atualizarTurnoInimigo(delta / passos)
    }
  }

  aoBotao(jogador, botao) {
    if (this.pausado) return
    if (this.fase === 'menu') {
      const menu = this.menus.find((m) => m.jogador === jogador)
      if (!menu) return
      if (botao === 'A') menu.confirmar()
      else menu.cancelar()
    } else if (this.fase === 'fight') {
      if (botao === 'A') this.fight.apertar(jogador)
    } else if (this.fase === 'fala') {
      if (botao === 'A') this.balao.avancar()
    } else if (this.fase === 'mensagens') {
      if (botao !== 'A') return
      if (this.textbox.digitandoAinda) this.textbox.completar()
      else this.avancar()
    }
  }

  // Espera que respeita o debug.acelerar (usa o relógio dos tweens)
  esperar(ms, fn) {
    this.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: fn })
  }

  // ---------- criação ----------

  criarMembro(id, i) {
    const def = PERSONAGENS[id]
    const { x, y, espacamento } = LAYOUT.party
    return {
      id,
      def,
      indice: i,
      nome: def.nome,
      cor: def.cor,
      hp: def.hp,
      max: def.hp,
      defesa: def.defesa ?? 0,
      jogador: i % this.numJogadores,
      comandos: (def.comandos ?? COMANDOS).map((tipo) => ({
        tipo,
        rotulo: tipo === 'ACT' ? (def.act?.rotulo ?? 'ACT') : tipo,
      })),
      acao: null,
      defendendo: false,
      ator: new Ator(this, x, y + i * espacamento, id),
      get caido() {
        return this.hp <= 0
      },
    }
  }

  criarChefe(def) {
    const { x, y } = LAYOUT.inimigo
    return {
      id: def.id,
      def,
      nome: def.nome,
      hp: Math.round(def.hp * this.nivel.hp),
      max: Math.round(def.hp * this.nivel.hp),
      defesa: def.defesa ?? 0,
      mercy: 0,
      poupado: false,
      fase: 0,
      turnosNaFase: 0,
      revelado: false,
      ritmo: { velocidade: 1, densidade: 1 }, // agressividade (muda com ACTs)
      proximo: null, // modificador só do próximo ataque
      flags: {},
      visual: new Inimigo(this, x, y, def),
      get ativo() {
        return this.hp > 0 && !this.poupado
      },
    }
  }

  // ---------- consultas ----------

  inimigosAtivos() {
    return this.inimigos.filter((e) => e.ativo)
  }

  membrosVivos(jogador) {
    return this.party.filter((m) => m.jogador === jogador && !m.caido)
  }

  alvoValido(alvo) {
    return alvo?.ativo ? alvo : this.inimigosAtivos()[0]
  }

  faseAtual() {
    return this.defChefe.fases[this.chefe.fase]
  }

  // TP menos o que já foi reservado por ACTs escolhidos neste turno
  tpDisponivel() {
    return this.tp - this.party.reduce((soma, m) => soma + (m.acao?.tipo === 'ACT' ? (m.acao.item.custoTP ?? 0) : 0), 0)
  }

  // Quantidade menos o que já foi reservado por outros personagens neste turno
  itemDisponivel(id) {
    return this.inventario.quantidade(id) - this.party.filter((m) => m.acao?.tipo === 'ITEM' && m.acao.item === id).length
  }

  comandoBloqueado(membro, tipo) {
    if (tipo === 'ITEM') return !this.inventario.lista().some((e) => this.itemDisponivel(e.id) > 0)
    return false
  }

  atualizarUI() {
    const escolhendo = new Map()
    const desabilitados = new Map()
    let previa = 0
    if (this.fase === 'menu') {
      for (const menu of this.menus) {
        if (menu.etapa === 'comando') escolhendo.set(menu.membro, { cursor: menu.cursor, cor: menu.corCursor })
        previa = Math.max(previa, menu.previaTP())
      }
      for (const m of this.party) {
        desabilitados.set(m, new Set(m.comandos.filter((c) => this.comandoBloqueado(m, c.tipo)).map((c) => c.tipo)))
      }
      this.textbox.colunas(this.menus.map((menu) => menu.coluna()))
    }
    this.hud.atualizar(this.party, this.fase === 'menu' ? this.tpDisponivel() : this.tp, { escolhendo, desabilitados, previa })
    this.chefe.visual.atualizar(this.chefe)

    const cheio = this.tp >= TP.max
    this.fundo.pulsar(cheio)
    if (cheio && !this.tpCheioAntes) tocar(this, 'tpMax')
    this.tpCheioAntes = cheio
  }

  // ---------- entrada ----------

  intro() {
    this.fase = 'intro'
    this.cameras.main.flash(300, 255, 255, 255)
    this.party.forEach((m, i) => m.ator.entrar(i * 120))
    this.chefe.visual.sprite.setAlpha(0)
    this.tweens.add({ targets: this.chefe.visual.sprite, alpha: 1, delay: 250, duration: 500 })
    this.atualizarUI()

    // o coração de cada jogador sai do seu personagem e voa até o menu
    this.esperar(TEMPOS.introMs, () => {
      for (let j = 0; j < this.numJogadores; j++) {
        const membro = this.membrosVivos(j)[0]
        if (!membro) continue
        const botao = this.hud.paineis[membro.indice].botoes[0].icone
        this.voarCoracao(membro.ator, botao, CORES.almas[j])
      }
      this.esperar(TEMPOS.vooMs, () => this.iniciarMenu())
    })
  }

  voarCoracao(de, para, cor, aoChegar) {
    const c = this.add.image(de.x, de.y, 'coracao').setTint(cor).setScale(ESCALA.coracao).setDepth(40)
    this.caixa.camera.ignore(c)
    tocar(this, 'voo')
    this.tweens.add({
      targets: c,
      x: para.x,
      y: para.y,
      duration: TEMPOS.vooMs,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        c.destroy()
        aoChegar?.()
      },
    })
  }

  // ---------- fase: menu ----------

  iniciarMenu() {
    this.fase = 'menu'
    for (const m of this.party) {
      m.acao = null
      m.defendendo = false
    }
    const flavor = this.faseAtual().flavor
    if (this.turno > 0 && flavor?.length) this.textoFlavor = flavor[this.turno % flavor.length]
    this.menus = Array.from({ length: this.numJogadores }, (_, j) => new MenuComandos(this, j, this.membrosVivos(j)))
    this.verificarMenus()
  }

  // Chamado pelos menus a cada escolha; quando todos estão prontos, executa o turno
  verificarMenus() {
    if (this.fase === 'menu' && this.menus.every((m) => m.pronto)) this.executarAcoes()
    else this.atualizarUI()
  }

  // ---------- fases: fight e mensagens ----------

  executarAcoes() {
    this.menus = []
    this.fila = []
    this.textbox.limpar()

    for (const m of this.party) {
      if (m.acao?.tipo === 'ACT') this.tp -= m.acao.item.custoTP ?? 0
      if (m.acao?.tipo === 'ACT') contar(this, 'tpGasto', m.acao.item.custoTP ?? 0)
      if (m.acao?.tipo === 'DEFEND') {
        m.defendendo = true
        this.tp = Math.min(TP.max, this.tp + DEFEND.ganhoTP)
        this.modificarProximoAtaque(DEFEND.proximoAtaque)
        numero(this, m.ator.x + 34, m.ator.y - 30, 'GUARDA', TEXTO.guarda)
      }
    }

    const lutadores = this.party.filter((m) => m.acao?.tipo === 'FIGHT').map((m) => ({ membro: m, alvo: m.acao.alvo }))
    if (lutadores.length) {
      this.fase = 'fight'
      this.fight = new Fight(
        this,
        lutadores,
        (membro, alvo, dano, critico, combo) => this.golpe(membro, alvo, this.aplicarForca(membro, dano), critico, combo),
        () => this.resolverAcoes(),
      )
    } else {
      this.resolverAcoes()
    }
    this.atualizarUI()
  }

  resolverAcoes() {
    this.fight = null
    for (const m of this.party) {
      if (!m.forcaUsada) continue
      m.forca = null
      m.forcaUsada = false
    }
    const passos = []
    for (const m of this.party) {
      const acao = m.acao
      if (!acao || m.caido) continue
      if (acao.tipo === 'ACT') {
        passos.push(() => {
          m.ator.pular()
          acao.item.executar(this.contextoAcao(m, this.alvoValido(acao.alvo)))
        })
      }
      if (acao.tipo === 'ITEM') passos.push(() => this.usarItem(m, acao))
      if (acao.tipo === 'SPARE') passos.push(() => this.poupar(m, this.alvoValido(acao.alvo)))
    }
    this.executarPassos(passos, () => this.fimDasAcoes())
  }

  // Roda os passos em ordem. Cada passo pode enfileirar mensagens (this.fila),
  // que são mostradas (A avança) antes do próximo passo.
  executarPassos(passos, aoTerminar) {
    this.fase = 'mensagens'
    this.avancar = () => {
      if (this.fila.length) return this.textbox.mensagem(this.fila.shift())
      if (!passos.length || !this.inimigosAtivos().length) return aoTerminar()
      passos.shift()()
      this.avancar()
    }
    this.avancar()
  }

  fimDasAcoes() {
    if (this.verificarFim()) return
    this.atualizarFaseChefe()
    this.iniciarFalas()
  }

  // Troca de fase por limiar de HP (só avança)
  atualizarFaseChefe() {
    const fases = this.defChefe.fases
    const fracao = this.chefe.hp / this.chefe.max
    let nova = 0
    fases.forEach((f, i) => {
      if (fracao <= f.hp) nova = i
    })
    if (nova <= this.chefe.fase) return
    this.chefe.fase = nova
    this.chefe.turnosNaFase = 0
    const fase = fases[nova]
    this.fundo.setFase(nova, fase.velocidadeFundo ?? 1)
    if (fase.entrada) this.falas.push(fase.entrada)
    this.cameras.main.flash(200, 255, 255, 255)
    shake(this, 200, 0.01)
  }

  // ---------- fase: fala do chefe ----------

  iniciarFalas() {
    const fase = this.faseAtual()
    if (fase.falas?.length) this.falas.push(fase.falas[this.chefe.turnosNaFase % fase.falas.length])
    this.textbox.limpar()
    this.proximaFala()
  }

  proximaFala() {
    const fala = this.falas.shift()
    if (fala === undefined) {
      this.balao.esconder()
      return this.iniciarTurnoInimigo()
    }
    this.fase = 'fala'
    const { x, y } = this.chefe.visual.boca
    this.balao.mostrar(fala, x, y)
  }

  // ---------- fase: turno inimigo ----------

  iniciarTurnoInimigo(lista) {
    const chefe = this.chefe
    lista = (lista ?? [this.escolherAtaque()]).filter(Boolean)
    if (!lista.length) return this.fimTurnoInimigo()
    let ataque = lista.length === 1 ? lista[0] : ataques.juntos(...lista)

    this.fase = 'inimigo'
    this.inimigoPronto = false
    this.textbox.limpar()
    this.fundo.escurecer(true)
    novaRodada()

    // morte súbita: este turno é a rodada this.turno + 1
    const acelerou = this.aplicarAceleracao(this.turno + 1)
    // agressividade (ACTs) e modificador do próximo ataque; a aceleração entra
    // depois dos limites de RITMO (que só valem para ACTs/DEFEND), então soma
    const ritmo = {
      velocidade:
        chefe.ritmo.velocidade * (chefe.proximo?.velocidade ?? 1) * DESAFIO.velocidade * (this.defChefe.desafio?.velocidade ?? 1) * this.nivel.velocidade * this.aceleracao,
      densidade:
        chefe.ritmo.densidade * (chefe.proximo?.densidade ?? 1) * DESAFIO.densidade * (this.defChefe.desafio?.densidade ?? 1) * this.nivel.densidade * this.aceleracao,
    }
    // "reduz uma onda": o ataque perde a última onda (sequência) ou parte do tempo
    ataque = encurtar(ataque, chefe.proximo?.duracao ?? 1)
    // nível MÉDIO/DIFÍCIL: às vezes (ou sempre) vem uma camada extra de caos junto
    const caos = sortearCaos(this, this.nivel)
    if (caos) ataque = comCaos(ataque, this.nivel.caos)
    abrirTurno(this, this.nivel, caos)
    const aviso = descreverModificador(chefe.proximo)
    if (aviso) etiqueta(this, aviso.texto, aviso.cor, acelerou ? { y: 76 } : undefined) // mais embaixo: o aviso da aceleração está no alto
    chefe.proximo = null
    this.balas.fatorVelocidade = ritmo.velocidade

    const vez = (this.vezesAtaque[ataque.nome] = (this.vezesAtaque[ataque.nome] ?? 0) + 1)
    const ctx = new ContextoAtaque({
      cena: this,
      balas: this.balas,
      caixa: this.caixa,
      coracoes: this.coracoes,
      tema: this.defChefe.tema,
      dano: Math.round(this.defChefe.danoBala * DESAFIO.dano * this.nivel.dano),
      ritmo,
      semente: `${ATAQUE.semente}:${ataque.nome}:${vez}`,
      nome: ataque.nome,
    })
    // se o ataque pede outra caixa, o aviso e a mudança acontecem logo que o coração pousa
    // (durante o respiro do turno) e o ataque só começa depois
    const preparo = preparoCaixa(null, ataque.caixa)
    const inicio = Math.max(ATAQUE.respiroMs, preparo)
    this.ataque = { ctx, nome: ataque.nome, restante: inicio + ataque.duracao + ATAQUE.respiroMs, duracao: ataque.duracao, ritmo, proximaValidacao: 0, desarmado: false }

    // caixa abre -> corações voam dos personagens até a caixa -> respiro -> ataque -> respiro
    const l = this.caixa.limites
    const ativos = this.coracoes.filter((c) => this.membrosVivos(c.jogador).length)
    this.caixa.mostrar(() => {
      const destinos = ativos.map((c, k) => ({ x: l.x + (l.width * (k + 1)) / (ativos.length + 1), y: l.bottom - 30 }))
      ativos.forEach((c, k) => this.voarCoracao(this.membrosVivos(c.jogador)[0].ator, destinos[k], c.cor))
      this.esperar(TEMPOS.vooMs, () => {
        ativos.forEach((c, k) => c.mostrar(destinos[k].x, destinos[k].y))
        if (preparo) ctx.caixaPara(ataque.caixa)
        ctx.depois(inicio, () => ataque.iniciar(ctx.limitar(ataque.duracao)))
        ctx.depois(inicio + ataque.duracao, () => {
          this.balas.desarmar(ATAQUE.respiroMs)
          this.ataque.desarmado = true
        })
        this.inimigoPronto = true
      })
    })
    this.atualizarUI()
  }

  // Fator da morte súbita na rodada (turno do chefe) `rodada`: teto das balas,
  // coração, música e selo. Quando o nível sobe, aviso grande + som.
  // Desligada no co-op (ACELERACAO.coop = false): o fator fica sempre 1.
  aplicarAceleracao(rodada) {
    const ligada = ACELERACAO.coop
    const nivel = ligada ? nivelAceleracao(rodada) : 0
    this.aceleracao = ligada ? fatorAceleracao(rodada) : 1
    this.balas.velocidadeMax = this.velocidadeMaxBase * this.aceleracao
    const subiu = nivel > this.nivelAceleracao
    this.nivelAceleracao = nivel
    this.indicadorVelocidade.set(this.aceleracao, subiu)
    if (!subiu) return false
    velocidadeMusica(parteDoFator(this.aceleracao, ACELERACAO.musica))
    this.avisarAceleracao()
    return true
  }

  avisarAceleracao() {
    const maximo = this.aceleracao >= ACELERACAO.maximo
    tocar(this, 'acelerar')
    flashTela(this, 0xff8a1a, 0.18, 260)
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
    const titulo = this.add.text(LARGURA / 2, 24, `VELOCIDADE x${this.aceleracao.toFixed(2)}!`, estilo(24, '#ff9a3a')).setOrigin(0.5).setDepth(31)
    const sub = this.add
      .text(LARGURA / 2, 44, maximo ? 'VELOCIDADE MÁXIMA!' : 'a luta está demorando: tudo acelera!', estilo(11, maximo ? TEXTO.caido : TEXTO.normal))
      .setOrigin(0.5)
      .setDepth(31)
      .setAlpha(0)
    ignorarNasCaixas(this, titulo, sub)
    titulo.setScale(1.8)
    this.tweens.add({ targets: titulo, scale: 1, duration: 260, ease: 'Back.easeOut' })
    this.tweens.add({ targets: sub, alpha: 1, delay: 150, duration: 180 })
    this.tweens.add({ targets: [titulo, sub], alpha: 0, delay: 1700, duration: 300, onComplete: () => [titulo, sub].forEach((t) => t.destroy()) })
  }

  escolherAtaque() {
    const chefe = this.chefe
    const fase = this.faseAtual()
    if (this.defChefe.escolherAtaque) return this.defChefe.escolherAtaque(chefe, fase)
    return fase.ataques[chefe.turnosNaFase % fase.ataques.length]
  }

  atualizarTurnoInimigo(delta) {
    if (!this.inimigoPronto) return
    const velocidade = (this.registry.get('velocidade') ?? CORACAO.velocidadePadrao) * parteDoFator(this.aceleracao, ACELERACAO.coracao)
    for (const c of this.coracoes) if (c.ativo) c.update(this.controles.joy(c.jogador), velocidade, delta)

    const at = this.ataque
    this.caixa.atualizar(delta) // aviso/transição da caixa no mesmo relógio do ataque
    at.ctx.atualizar(delta)
    this.balas.atualizar(
      delta,
      this.coracoes,
      (coracao, bala) => this.acertou(coracao, bala),
      (coracao) => this.grazeou(coracao),
    )

    if (import.meta.env.DEV && !at.desarmado) {
      at.proximaValidacao -= delta
      if (at.proximaValidacao <= 0) {
        at.proximaValidacao = ATAQUE.validarACadaMs
        validarEspacoLivre({ padrao: at.nome, limites: this.caixa.limites, balas: this.balas, tempo: at.ctx.tempo })
      }
    }

    at.restante -= delta
    if (at.restante <= 0 || this.party.every((m) => m.caido)) this.fimTurnoInimigo()
  }

  acertou(coracao, bala) {
    if (coracao.invencivel || debug.invencivel) return false
    const alvos = this.membrosVivos(coracao.jogador)
    if (!alvos.length) return false

    const membro = this.escolherAlvo(alvos)
    let dano = Math.max(1, bala.dano - membro.defesa)
    if (membro.defendendo) dano = Math.ceil(dano * DEFEND.multiplicadorDano)
    if (membro.protecao) dano = Math.max(1, Math.ceil(dano * membro.protecao))
    membro.hp -= dano
    contar(this, 'danoRecebido', dano)
    membro.ator.tremer()
    numero(this, membro.ator.x + 34, membro.ator.y - 30, String(dano), TEXTO.dano)
    particulas(this, coracao.x, coracao.y, { cor: coracao.cor, quantidade: 10, velocidade: 110 })
    tocar(this, 'dano')

    if (membro.caido) {
      // como no Deltarune: quem cai fica com HP negativo e recupera aos poucos
      membro.hp = -Math.floor(membro.max / 2)
      membro.ator.setCaido(true)
      numero(this, membro.ator.x + 34, membro.ator.y, 'CAÍDO', TEXTO.caido)
    }

    coracao.tomarDano(TEMPOS.invencivelMs)
    // tremor + flash vermelho, proporcionais ao dano (balas fortes pesam mais)
    const forca = Phaser.Math.Clamp(dano / IMPACTO.danoReferencia, 0.7, 1.6)
    shake(this, IMPACTO.tremorMs, IMPACTO.tremorForca * forca)
    flashTela(this, IMPACTO.flashCor, Math.min(0.5, IMPACTO.flashAlpha * forca), IMPACTO.flashMs)
    if (!this.membrosVivos(coracao.jogador).length) coracao.esconder()
    this.atualizarUI()
    return true
  }

  // Quem leva o dano. Com 1 jogador o coração representa a party toda, então
  // o dano se espalha: sorteio com peso, que evita repetir quem acabou de
  // apanhar e puxa para quem está com mais HP (ninguém é focado até cair).
  escolherAlvo(alvos) {
    if (alvos.length === 1) return alvos[0]
    const pesos = alvos.map((m) => (0.4 + Math.max(0, m.hp) / m.max) * (m === this.ultimoAlvo ? 0.45 : 1))
    let r = Math.random() * pesos.reduce((a, b) => a + b, 0)
    const escolhido = alvos.find((_, i) => (r -= pesos[i]) <= 0) ?? alvos[alvos.length - 1]
    this.ultimoAlvo = escolhido
    return escolhido
  }

  grazeou(coracao) {
    if (coracao.invencivel) return
    coracao.piscarGraze()
    contar(this, 'grazes')
    particulas(this, coracao.x, coracao.y, { cor: 0xffffff, quantidade: 3, velocidade: 60, vida: 250, escala: 0.6 })
    if (this.time.now - this.ultimoGraze > 70) tocar(this, 'graze')
    this.ultimoGraze = this.time.now
    this.ganharTP(TP.porGraze)
  }

  fimTurnoInimigo() {
    this.ataque?.ctx.limpar()
    this.ataque = null
    this.inimigoPronto = false
    this.balas.limpar()
    this.balas.fatorVelocidade = 1
    this.coracoes.forEach((c) => c.esconder())
    this.caixa.esconder()
    this.fundo.escurecer(false)
    this.turno++
    this.chefe.turnosNaFase++
    this.fila = []
    this.encerrarProtecao()

    if (this.verificarFim()) return
    this.defChefe.aoFimDoTurno?.(this.chefe, this.contextoAcao(null, this.chefe))

    for (const m of this.party) {
      if (!m.caido) continue
      m.hp = Math.min(m.max, m.hp + Math.ceil(m.max / 8))
      if (!m.caido) {
        m.ator.setCaido(false)
        this.fila.push(`* ${m.nome} se levantou!`)
      }
    }
    this.atualizarUI()
    this.executarPassos([], () => this.iniciarMenu())
  }

  // ---------- fim da batalha ----------

  verificarFim() {
    const venceu = !this.inimigosAtivos().length
    const perdeu = this.party.every((m) => m.caido)
    if (!venceu && !perdeu) return false

    if (venceu) {
      const modo = this.chefe.poupado ? 'spare' : 'hp'
      this.fase = 'mensagens'
      this.textbox.mensagem(modo === 'spare' ? `* Vocês pouparam ${this.chefe.nome}!` : `* Vocês derrotaram ${this.chefe.nome}!`)
      this.avancar = () => depoisDoSilencio(this, () => this.sair('Vitoria', { modo, estatisticas: resumoEstatisticas(this) }))
    } else {
      this.fase = 'fim'
      // números da luta perdida para a tela de game over (quanto faltava do chefe etc.)
      const dados = { estatisticas: resumoEstatisticas(this), hpChefe: Math.max(0, this.chefe.hp), hpMaxChefe: this.chefe.max, mercy: this.chefe.mercy }
      derrota(this, () => this.sair('GameOver', dados))
    }
    return true
  }

  // ---------- pause (botão C) ----------

  // Só pausa com a luta rolando: não na abertura, não depois que o chefe caiu
  // (a distorção da música e a ida para a vitória estão em andamento) e não saindo
  podePausar() {
    const fases = ['menu', 'fight', 'fala', 'inimigo', 'mensagens']
    return fases.includes(this.fase) && !this.saindo && this.chefe.ativo && !this.scene.isActive('Entrada')
  }

  pausar() {
    if (this.pausado || !this.podePausar()) return
    this.pausado = true
    pausarMusica()
    this.scene.pause()
    this.scene.launch('Pausa', { chefe: this.idChefe, nome: this.defChefe.nome })
  }

  retomarDaPausa() {
    if (!this.pausado) return
    this.pausado = false
    this.scene.resume()
    retomarMusica()
  }

  sair(cena, dados) {
    if (this.saindo) return
    this.saindo = true
    this.fase = 'fim'
    this.cameras.main.fadeOut(350, 0, 0, 0)
    this.esperar(380, () => {
      this.saindo = false
      this.scene.start(cena, { chefe: this.idChefe, turnos: this.turno, ...dados })
    })
  }

  // ---------- efeitos (FIGHT, ACTs, itens) ----------

  // Contexto passado para executar(ctx) dos ACTs/magias e usar(ctx) dos itens:
  //   ctx.ator, ctx.alvo, ctx.aliado     quem usou, o chefe escolhido, quem recebe o item
  //   ctx.party, ctx.inimigos, ctx.fase  (fase atual do chefe, 0, 1, 2...)
  //   ctx.texto(msg)                     mostra uma mensagem
  //   ctx.dano(inimigo, n)   ctx.curar(membro, n)   ctx.mercy(inimigo, n)   ctx.tp(n)
  //   ctx.revelar()                      mostra a barra de HP do chefe
  //   ctx.proximoAtaque({ velocidade, densidade, duracao })   só o próximo ataque (ex.: 0.7 = 30% mais lento;
  //                                      duracao < 1 encurta a onda). Vários se acumulam, até RITMO.proximoMinimo
  //   ctx.agressividade({ velocidade, densidade })   permanente, multiplica (limites em RITMO)
  //   ctx.maisFerido()                   membro da party com menor % de HP
  //   ctx.fortalecer(membro, fator)      o próximo FIGHT desse membro causa dano * fator (ex.: 1.5)
  //   ctx.proteger(membro, fator)        no próximo turno do chefe, o dano que ele leva é * fator (ex.: 0.5)
  //   ctx.sortear(min, max)              inteiro aleatório entre min e max (inclusive)
  contextoAcao(ator, alvo, aliado = null) {
    const chefe = this.chefe
    return {
      ator,
      alvo,
      aliado,
      party: this.party,
      inimigos: this.inimigosAtivos(),
      fase: chefe.fase,
      texto: (msg) => this.fila.push(msg),
      dano: (inimigo, n) => this.danoInimigo(inimigo, n),
      curar: (membro, n) => this.curar(membro, n),
      mercy: (inimigo, n) => this.mercy(inimigo, n),
      tp: (n) => this.ganharTP(n),
      revelar: () => {
        chefe.revelado = true
        this.atualizarUI()
      },
      proximoAtaque: (mod) => this.modificarProximoAtaque(mod),
      agressividade: ({ velocidade = 1, densidade = 1 }) => {
        chefe.ritmo.velocidade = Phaser.Math.Clamp(chefe.ritmo.velocidade * velocidade, RITMO.minimo, RITMO.maximo)
        chefe.ritmo.densidade = Phaser.Math.Clamp(chefe.ritmo.densidade * densidade, RITMO.minimo, RITMO.maximo)
      },
      maisFerido: () => [...this.party].sort((a, b) => a.hp / a.max - b.hp / b.max)[0],
      fortalecer: (membro, fator) => this.fortalecer(membro, fator),
      proteger: (membro, fator) => this.proteger(membro, fator),
      sortear: (min, max) => Phaser.Math.Between(min, max),
    }
  }

  // Buff do próximo FIGHT (ctx.fortalecer): não acumula, fica o maior fator.
  // É gasto no primeiro golpe que acerta (MISS não gasta).
  fortalecer(membro, fator) {
    membro.forca = Math.max(membro.forca ?? 1, fator)
    numero(this, membro.ator.x + 34, membro.ator.y - 30, `FORÇA +${Math.round((membro.forca - 1) * 100)}%`, TEXTO.selecionado, { tamanho: 14 })
  }

  // Vale para TODOS os golpes do combo do FIGHT; é gasto no fim do FIGHT
  // (resolverAcoes), só se algum golpe acertou
  aplicarForca(membro, dano) {
    if (!membro.forca || dano <= 0) return dano
    if (!membro.forcaUsada) {
      membro.forcaUsada = true
      numero(this, membro.ator.x + 34, membro.ator.y - 50, `FORÇA x${membro.forca}`, TEXTO.selecionado, { tamanho: 14 })
    }
    return Math.round(dano * membro.forca)
  }

  // Redução de dano no próximo turno do chefe (ctx.proteger): fica o menor fator.
  // Acaba no fim do turno do chefe (encerrarProtecao).
  proteger(membro, fator) {
    membro.protecao = Math.min(membro.protecao ?? 1, fator)
    numero(this, membro.ator.x + 34, membro.ator.y - 30, `ESCUDO -${Math.round((1 - membro.protecao) * 100)}%`, TEXTO.guarda, { tamanho: 14 })
  }

  encerrarProtecao() {
    const protegidos = this.party.filter((m) => m.protecao)
    if (!protegidos.length) return
    protegidos.forEach((m) => (m.protecao = null))
    etiqueta(this, 'O ESCUDO SE DESFEZ', TEXTO.desabilitado)
  }

  // Modificador só do próximo ataque do chefe: { velocidade, densidade, duracao }
  // (fatores; < 1 enfraquece). DEFEND e ACTs chegam aqui e se acumulam
  // (multiplicam) dentro de [RITMO.proximoMinimo, RITMO.maximo].
  modificarProximoAtaque(mod) {
    const atual = this.chefe.proximo ?? {}
    const novo = { ...atual }
    for (const [chave, fator] of Object.entries(mod)) {
      novo[chave] = Phaser.Math.Clamp((atual[chave] ?? 1) * fator, RITMO.proximoMinimo, RITMO.maximo)
    }
    this.chefe.proximo = novo
  }

  // Um acerto do combo do FIGHT (combo = último golpe com todas as barras acertadas)
  golpe(membro, alvo, dano, critico, combo = false) {
    alvo = this.alvoValido(alvo)
    if (!alvo) return
    membro.ator.pular()
    if (dano <= 0) return numero(this, alvo.visual.x, alvo.visual.y - 50, 'MISS', TEXTO.desabilitado)
    // cada acerto é só uma fração do golpe cheio, então a defesa também conta nessa fração
    const cfg = { ...FIGHT, ...membro.def.fight }
    this.danoInimigo(alvo, Math.max(1, dano - Math.round(alvo.defesa * cfg.fatorGolpe)), critico)
    // atacar também carrega o TP: golpe bom enche mais, combo completo ganha extra
    const base = cfg.dano * cfg.fatorGolpe
    let ganho = critico ? TP.porGolpe + TP.critico : dano >= base * 0.75 ? TP.porGolpe : Math.ceil(TP.porGolpe / 2)
    if (combo) ganho += TP.combo
    if (combo) contar(this, 'combos')
    this.ganharTP(ganho)
    numero(this, membro.ator.x + 34, membro.ator.y - 30, `+${ganho} TP`, TEXTO.guarda, { tamanho: 14, desvio: 6 })
  }

  danoInimigo(inimigo, n, critico = false) {
    if (!inimigo?.ativo) return
    anotarDano(this, inimigo, n, critico)
    inimigo.hp = Math.max(0, inimigo.hp - n)
    inimigo.revelado = true
    const forca = Phaser.Math.Clamp(n / 40, 0.15, 1) // golpe fraco = 0.15, golpe pesado (>= 40) = 1
    inimigo.visual.dano(forca)
    numero(this, inimigo.visual.x, inimigo.visual.y - 50, String(n), critico ? TEXTO.selecionado : TEXTO.dano, {
      tamanho: Math.round(20 + 12 * forca + (critico ? 6 : 0)),
      pop: critico ? 1.5 : 1.25,
      desvio: 14,
    })
    particulas(this, inimigo.visual.x, inimigo.visual.y, { cor: 0xffffff, quantidade: critico ? 18 : 10, velocidade: 170 })
    shake(this, critico ? 160 : 90, critico ? 0.012 : 0.006)
    if (!inimigo.ativo) {
      inimigo.visual.sumir(false)
      if (!this.inimigosAtivos().length) impactoDerrota(this)
      this.fila.push(`* ${inimigo.nome} foi derrotado!`)
    }
    this.atualizarUI()
  }

  curar(membro, n) {
    const antes = membro.hp
    const estavaCaido = membro.caido
    membro.hp = Math.min(membro.max, membro.hp + Math.max(0, n))
    const ganho = membro.hp - antes
    numero(this, membro.ator.x + 34, membro.ator.y - 30, `+${ganho}`, TEXTO.cura)
    particulas(this, membro.ator.x, membro.ator.y, { cor: 0x3cff6a, quantidade: 10, velocidade: 70 })
    tocar(this, 'cura')
    this.fila.push(ganho > 0 ? `* ${membro.nome} recuperou ${ganho} HP!` : `* O HP de ${membro.nome} já estava cheio.`)
    if (estavaCaido && !membro.caido) {
      membro.ator.setCaido(false)
      this.fila.push(`* ${membro.nome} se levantou!`)
    }
    this.atualizarUI()
  }

  mercy(inimigo, n) {
    if (!inimigo?.ativo || !n) return
    const antes = inimigo.mercy
    inimigo.mercy = Phaser.Math.Clamp(inimigo.mercy + n, 0, MERCY_MAX)
    const diferenca = inimigo.mercy - antes
    if (!diferenca) return
    numero(this, inimigo.visual.x + 40, inimigo.visual.y - 30, `${diferenca > 0 ? '+' : ''}${diferenca}%`, TEXTO.mercy)
    this.atualizarUI()
  }

  usarItem(membro, acao) {
    const def = ITENS[acao.item]
    if (!this.inventario.consumir(acao.item)) {
      this.fila.push(`* ${membro.nome} procurou ${def.nome}, mas não tinha mais.`)
      return
    }
    membro.ator.pular()
    const aliado = def.alvo === 'aliado' ? acao.aliado : null
    this.fila.push(aliado ? `* ${membro.nome} usou ${def.nome} em ${aliado.nome}!` : `* ${membro.nome} usou ${def.nome}!`)
    def.usar(this.contextoAcao(membro, this.chefe, aliado))
    this.atualizarUI()
  }

  poupar(membro, inimigo) {
    if (!inimigo) return
    membro.ator.pular()
    const pode = inimigo.def.podePoupar ? inimigo.def.podePoupar(inimigo) : inimigo.mercy >= MERCY_MAX
    if (pode) {
      inimigo.poupado = true
      inimigo.visual.sumir(true)
      if (!this.inimigosAtivos().length) fimSuave(this)
      tocar(this, 'cura')
      this.fila.push(`* ${membro.nome} poupou ${inimigo.nome}!`)
      return
    }
    this.fila.push(
      `* ${membro.nome} tentou poupar ${inimigo.nome}...`,
      inimigo.def.textoNaoPoupa?.(inimigo) ?? `* Mas a ${inimigo.def.rotuloMercy ?? 'MERCY'} ainda está em ${inimigo.mercy}%.`,
    )
  }

  ganharTP(n) {
    this.tp = Phaser.Math.Clamp(this.tp + n, 0, TP.max)
    this.atualizarUI()
  }

  // ---------- dev ----------

  // No console do navegador: testarAtaque(ataques.rain({ velocidade: 400 }))
  testarAtaque(ataque) {
    if (this.fase !== 'menu') {
      console.warn('testarAtaque: espere a fase de menu')
      return false
    }
    this.menus = []
    this.party.forEach((m) => (m.acao = null))
    this.iniciarTurnoInimigo([ataque])
    return true
  }

  estadoDebug() {
    const nomeDe = (o) => o.rotulo ?? o.def?.nome ?? o.nome ?? String(o)
    return {
      fase: this.fase,
      turno: this.turno,
      tp: this.tp,
      aceleracao: { nivel: this.nivelAceleracao, fator: this.aceleracao, velocidadeMax: this.balas.velocidadeMax },
      chefe: {
        id: this.chefe.id,
        hp: this.chefe.hp,
        max: this.chefe.max,
        mercy: this.chefe.mercy,
        fase: this.chefe.fase,
        ativo: this.chefe.ativo,
        ritmo: { ...this.chefe.ritmo },
        proximo: this.chefe.proximo ? { ...this.chefe.proximo } : null,
        poupavel: this.defChefe.podePoupar ? this.defChefe.podePoupar(this.chefe) : this.chefe.mercy >= MERCY_MAX,
      },
      party: this.party.map((m) => ({ nome: m.nome, hp: m.hp, max: m.max, caido: m.caido, jogador: m.jogador })),
      inventario: { ...this.inventario.quantidades },
      menus: this.menus.map((m) => ({
        jogador: m.jogador,
        etapa: m.etapa,
        cursor: m.cursor,
        membro: m.membro?.nome ?? null,
        opcoes: m.opcoes().map(nomeDe),
      })),
      fight: this.fight?.estado() ?? null,
      digitando: this.textbox.digitandoAinda,
      caixa: { ...this.caixa.limites, emTransicao: this.caixa.emTransicao },
      ataque: this.ataque
        ? { nome: this.ataque.nome, tempo: this.ataque.ctx.tempo, balas: this.balas.lista.length, duracao: this.ataque.duracao, ritmo: { ...this.ataque.ritmo } }
        : null,
      validacao: { ...estatisticas },
    }
  }
}
