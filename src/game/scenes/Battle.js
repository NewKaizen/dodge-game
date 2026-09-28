import Phaser from 'phaser'
import Ator from '../entities/Ator.js'
import Inimigo from '../entities/Inimigo.js'
import BattleBox from '../entities/BattleBox.js'
import Balas from '../entities/Bullets.js'
import Heart from '../entities/Heart.js'
import Hud from '../entities/Hud.js'
import TextBox from '../entities/TextBox.js'
import Balao from '../entities/Balao.js'
import Controles from '../controles.js'
import MenuComandos from '../battle/MenuComandos.js'
import Fight from '../battle/Fight.js'
import Inventario from '../battle/Inventario.js'
import ContextoAtaque from '../attacks/contexto.js'
import { ataques, PADROES } from '../attacks/index.js'
import { novaRodada, validarEspacoLivre, estatisticas } from '../attacks/validacao.js'
import { criarFundo } from '../backgrounds/index.js'
import { shake } from '../effects/shake.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'
import { tocar, musica } from '../audio.js'
import { debug } from '../debug.js'
import { ESCALA } from '../arte/texturas.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ITENS } from '../data/itens.js'
import { CHEFES } from '../data/chefes/index.js'
import { BATALHA } from '../data/batalha.js'
import { ATAQUE, CORES, TEXTO, LAYOUT, TP, DEFEND, TEMPOS, COMANDOS, MERCY_MAX, DIFICULDADES, RITMO } from '../constants.js'

// Batalha no estilo Deltarune. Fases de cada turno:
//   'intro'     entrada (só no começo)
//   'menu'      cada jogador escolhe FIGHT/ACT/ITEM/SPARE/DEFEND para seus personagens
//   'fight'     barras do FIGHT (todos que escolheram FIGHT, ao mesmo tempo)
//   'mensagens' ACTs, itens, SPARE e textos (A avança)
//   'fala'      balão de fala do chefe
//   'inimigo'   corações na caixa desviando do ataque
//   'fim'       saindo para a vitória ou o game over
export default class Battle extends Phaser.Scene {
  constructor() {
    super('Battle')
  }

  init(dados) {
    this.idChefe = dados?.chefe ?? this.registry.get('chefe') ?? BATALHA.chefePadrao
  }

  create() {
    this.registry.set('chefe', this.idChefe)
    this.defChefe = CHEFES[this.idChefe]
    this.dificuldade = DIFICULDADES[this.defChefe.dificuldade]
    this.numJogadores = this.registry.get('numJogadores') ?? 1
    this.rng = new Phaser.Math.RandomDataGenerator([`${ATAQUE.semente}:${this.idChefe}`])
    this.controles = new Controles(this)
    this.controles.onBotao((jogador, botao) => this.aoBotao(jogador, botao))

    this.fundo = criarFundo(this, this.defChefe.fundo)
    this.party = BATALHA.party.map((id, i) => this.criarMembro(id, i))
    this.chefe = this.criarChefe(this.defChefe)
    this.inimigos = [this.chefe]
    this.inventario = new Inventario(this.defChefe.inventario)
    this.tp = 0
    this.tpCheioAntes = false
    this.turno = 0
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
    this.balas.velocidadeMax = this.dificuldade.velocidadeMaxBala
    this.coracoes = Array.from({ length: this.numJogadores }, (_, j) => new Heart(this, this.caixa, CORES.almas[j], j))
    this.hud = new Hud(this, this.party, this.numJogadores)
    this.textbox = new TextBox(this)
    this.balao = new Balao(this)

    if (import.meta.env.DEV) {
      window.ataques = ataques
      window.testarAtaque = (ataque) => this.testarAtaque(ataque)
      window.listarAtaques = () => PADROES
      // ataques configurados do chefe atual, por fase (usado pelos testes)
      window.ataquesDoChefe = () => this.defChefe.fases.flatMap((f, fase) => f.ataques.map((ataque, i) => ({ fase, i, ataque })))
      this.events.once('shutdown', () => delete window.testarAtaque)
    }

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
      hp: def.hp,
      max: def.hp,
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
    this.cameraCaixa.ignore(c)
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
      if (m.acao?.tipo === 'DEFEND') {
        m.defendendo = true
        this.tp = Math.min(TP.max, this.tp + DEFEND.ganhoTP)
      }
    }

    const lutadores = this.party.filter((m) => m.acao?.tipo === 'FIGHT').map((m) => ({ membro: m, alvo: m.acao.alvo }))
    if (lutadores.length) {
      this.fase = 'fight'
      this.fight = new Fight(
        this,
        lutadores,
        (membro, alvo, dano, critico) => this.golpe(membro, alvo, dano, critico),
        () => this.resolverAcoes(),
      )
    } else {
      this.resolverAcoes()
    }
    this.atualizarUI()
  }

  resolverAcoes() {
    this.fight = null
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
    const ataque = lista.length === 1 ? lista[0] : ataques.juntos(...lista)

    this.fase = 'inimigo'
    this.inimigoPronto = false
    this.textbox.limpar()
    this.fundo.escurecer(true)
    novaRodada()

    // agressividade (ACTs) e modificador do próximo ataque
    const ritmo = {
      velocidade: chefe.ritmo.velocidade * (chefe.proximo?.velocidade ?? 1),
      densidade: chefe.ritmo.densidade * (chefe.proximo?.densidade ?? 1),
    }
    chefe.proximo = null
    this.balas.fatorVelocidade = ritmo.velocidade

    const vez = (this.vezesAtaque[ataque.nome] = (this.vezesAtaque[ataque.nome] ?? 0) + 1)
    const ctx = new ContextoAtaque({
      cena: this,
      balas: this.balas,
      caixa: this.caixa,
      coracoes: this.coracoes,
      tema: this.defChefe.tema,
      dano: this.defChefe.danoBala,
      ritmo,
      semente: `${ATAQUE.semente}:${ataque.nome}:${vez}`,
      nome: ataque.nome,
    })
    this.ataque = { ctx, nome: ataque.nome, restante: ATAQUE.respiroMs * 2 + ataque.duracao, proximaValidacao: 0, desarmado: false }

    // caixa abre -> corações voam dos personagens até a caixa -> respiro -> ataque -> respiro
    const l = this.caixa.limites
    const ativos = this.coracoes.filter((c) => this.membrosVivos(c.jogador).length)
    this.caixa.mostrar(() => {
      const destinos = ativos.map((c, k) => ({ x: l.x + (l.width * (k + 1)) / (ativos.length + 1), y: l.bottom - 30 }))
      ativos.forEach((c, k) => this.voarCoracao(this.membrosVivos(c.jogador)[0].ator, destinos[k], c.cor))
      this.esperar(TEMPOS.vooMs, () => {
        ativos.forEach((c, k) => c.mostrar(destinos[k].x, destinos[k].y))
        ctx.depois(ATAQUE.respiroMs, () => ataque.iniciar(ctx.limitar(ataque.duracao)))
        ctx.depois(ATAQUE.respiroMs + ataque.duracao, () => {
          this.balas.desarmar(ATAQUE.respiroMs)
          this.ataque.desarmado = true
        })
        this.inimigoPronto = true
      })
    })
    this.atualizarUI()
  }

  escolherAtaque() {
    const chefe = this.chefe
    const fase = this.faseAtual()
    if (this.defChefe.escolherAtaque) return this.defChefe.escolherAtaque(chefe, fase)
    return fase.ataques[chefe.turnosNaFase % fase.ataques.length]
  }

  atualizarTurnoInimigo(delta) {
    if (!this.inimigoPronto) return
    const velocidade = this.registry.get('velocidade')
    for (const c of this.coracoes) if (c.ativo) c.update(this.controles.joy(c.jogador), velocidade, delta)

    const at = this.ataque
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

    const membro = this.rng.pick(alvos)
    let dano = Math.max(1, bala.dano - membro.defesa)
    if (membro.defendendo) dano = Math.ceil(dano * DEFEND.multiplicadorDano)
    membro.hp -= dano
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
    shake(this, 120, 0.008)
    if (!this.membrosVivos(coracao.jogador).length) coracao.esconder()
    this.atualizarUI()
    return true
  }

  grazeou(coracao) {
    if (coracao.invencivel) return
    coracao.piscarGraze()
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
      this.avancar = () => this.sair('Vitoria', { modo })
    } else {
      this.fase = 'fim'
      this.esperar(700, () => this.sair('GameOver', {}))
    }
    return true
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
  //   ctx.proximoAtaque({ velocidade, densidade })   só o próximo ataque (ex.: 0.7 = 30% mais lento)
  //   ctx.agressividade({ velocidade, densidade })   permanente, multiplica (limites em RITMO)
  //   ctx.maisFerido()                   membro da party com menor % de HP
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
      proximoAtaque: (mod) => {
        chefe.proximo = { ...(chefe.proximo ?? {}), ...mod }
      },
      agressividade: ({ velocidade = 1, densidade = 1 }) => {
        chefe.ritmo.velocidade = Phaser.Math.Clamp(chefe.ritmo.velocidade * velocidade, RITMO.minimo, RITMO.maximo)
        chefe.ritmo.densidade = Phaser.Math.Clamp(chefe.ritmo.densidade * densidade, RITMO.minimo, RITMO.maximo)
      },
      maisFerido: () => [...this.party].sort((a, b) => a.hp / a.max - b.hp / b.max)[0],
    }
  }

  golpe(membro, alvo, dano, critico) {
    alvo = this.alvoValido(alvo)
    if (!alvo) return
    membro.ator.pular()
    if (dano <= 0) return numero(this, alvo.visual.x, alvo.visual.y - 50, 'MISS', TEXTO.desabilitado)
    this.danoInimigo(alvo, Math.max(1, dano - alvo.defesa), critico)
  }

  danoInimigo(inimigo, n, critico = false) {
    if (!inimigo?.ativo) return
    inimigo.hp = Math.max(0, inimigo.hp - n)
    inimigo.revelado = true
    inimigo.visual.dano()
    numero(this, inimigo.visual.x, inimigo.visual.y - 50, String(n), critico ? TEXTO.selecionado : TEXTO.dano)
    particulas(this, inimigo.visual.x, inimigo.visual.y, { cor: 0xffffff, quantidade: critico ? 18 : 10, velocidade: 170 })
    shake(this, critico ? 160 : 90, critico ? 0.012 : 0.006)
    if (!inimigo.ativo) {
      inimigo.visual.sumir(false)
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
      chefe: {
        id: this.chefe.id,
        hp: this.chefe.hp,
        max: this.chefe.max,
        mercy: this.chefe.mercy,
        fase: this.chefe.fase,
        ativo: this.chefe.ativo,
        ritmo: { ...this.chefe.ritmo },
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
      ataque: this.ataque ? { nome: this.ataque.nome, tempo: this.ataque.ctx.tempo, balas: this.balas.lista.length } : null,
      validacao: { ...estatisticas },
    }
  }
}
