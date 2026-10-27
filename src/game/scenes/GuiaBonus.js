import Phaser from 'phaser'
import Controles from '../controles.js'
import Pista from '../pvp/Pista.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { ARENA } from '../pvp/arenas.js'
import { hpInicial } from '../pvp/regras.js'
import { criarRng, aleatorio, inteiro } from '../pvp/baralho.js'
import { EFEITOS } from '../pvp/bonus/eventos/index.js'
import { ataques } from '../attacks/index.js'
import { fichaDaArena, cartasDaPreviaBonus, PAGINAS_GUIA } from '../grimorio/arenas.js'
import { previaDaCarta } from '../grimorio/fichas.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica, velocidadeMusica, tomMusica, cortarMusica, reforcarGrave } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'

// Prévia ao vivo de uma rodada bônus (Guia -> página da arena -> A).
// A tela da arena do PvP sem as cartas: o fundo animado da arena, as duas
// caixas no lugar de sempre, um ataque sorteado em cada (cartasDaPreviaBonus)
// e o efeito do evento (pvp/bonus/eventos/) rodando por cima, em loop, com a
// CPU desviando nas duas. Embaixo, como se virar no evento (grimorio/arenas.js).
//
//   ←/→ outro evento da arena · A: você desvia na caixa da esquerda (A ou B
//   devolve para a CPU) · B: volta ao Guia (na página e no evento de onde veio)
//
// Para o efeito, esta cena faz o papel da PvpArena (o que pvp/bonus/LEIA-ME.md
// diz que o evento pode usar): pistas, ko, cpu, acertou, donoDaPista/pistaDe,
// coracoesTrocados, estado.jogadores[j].hpMax, rotulo(j), aceleracao, saindo.
// Ninguém perde HP de verdade: os acertos só vão para o placar de cada caixa.
// Se um efeito der erro aqui, a prévia dele para e a tela avisa (o resto segue).
//
// No dev: scene.start('GuiaBonus', { arena: 'jardim', evento: 'aquario' }) e window.guiaBonus.

const PISTA = { largura: 220, altura: 170, y: 198 } // o mesmo tabuleiro da PvpArena
const CENTROS = [LARGURA / 4, (LARGURA * 3) / 4]
const CAMPOS = [
  { esquerda: 8, direita: LARGURA / 2 - 8, topo: 74, base: 334 },
  { esquerda: LARGURA / 2 + 8, direita: LARGURA - 8, topo: 74, base: 334 },
]
const PLACAR_Y = 344 // placar de cada caixa (abaixo do maior tamanho que a caixa pode ter)
const DICA = { x: 20, y: 366, largura: LARGURA - 40, altura: 84 } // painel do "como se virar"
const PROF_HUD = 70 // como o HUD da PvpArena: por baixo dos avisos grandes dos eventos (95+)
const PAUSA_ENTRE_VOLTAS = 550 // ms com as caixas fechadas entre uma volta e a próxima
const ESPERA_TROCA = 420 // ms entre trocar de evento e a volta nova (o efeito anterior termina de sair)
const CPU = 1 // a caixa da direita é sempre da CPU (os eventos ajudam a CPU nela)

// A instância da cena é REAPROVEITADA pelo Phaser: o que a partida/abertura anterior
// deixou aqui (objetos já destruídos, flags) volta ao inicial no começo do init().
// Testado em src/game/__tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  pistas: null,
  contador: null,
  nome: null,
  descricao: null,
  placarTextos: null,
  painelDica: null,
  tituloDica: null,
  corpoDica: null,
  aviso: null,
  ajuda: null,
})

export default class GuiaBonus extends Phaser.Scene {
  constructor() {
    super('GuiaBonus')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.arenaId = ARENA[dados?.arena] ? dados.arena : 'castelo'
    this.eventoInicial = dados?.evento ?? null
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA(j) : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())
    this.arena = ARENA[this.arenaId]
    this.ficha = fichaDaArena(this.arenaId, { efeitos: EFEITOS })
    this.eventos = this.ficha.eventos.filter((e) => e.previa)
    this.indice = Math.max(0, this.eventos.findIndex((e) => e.id === this.eventoInicial))
    this.cartas = cartasDaPreviaBonus()
    this.rng = criarRng(`guia:${this.arenaId}:${Date.now()}`)

    // o que a PvpArena oferece aos efeitos dos eventos (ver o comentário do topo)
    this.saindo = false
    this.ko = [false, false]
    this.cpu = CPU
    this.aceleracao = 1
    this.coracoesTrocados = false
    const hp = hpInicial('kris')
    this.estado = { rodada: 3, jogadores: [0, 1].map(() => ({ hp, hpMax: hp })) }

    this.controlador = null // jogador que está desviando na caixa da esquerda (null = CPU)
    // só cresce: a cena é reaproveitada (scene.start de novo) e uma volta da
    // visita anterior ainda esperando não pode achar que é a da vez
    this.geracao = (this.geracao ?? 0) + 1
    this.efeito = null
    this.falhou = null
    this.efeitosIniciados = 0 // para os testes (estadoDebug)
    this.bots = [0, 1].map(() => new EsquivaBot({ nivel: 'dificil' }))
    this.placares = [0, 1].map(() => ({ acertos: 0, dano: 0, grazes: 0 }))

    this.fundo = criarFundo(this, `arena-${this.arenaId}`)
    this.desenharMoldura()
    this.criarPistas()
    this.criarHud()

    this.events.on('postupdate', this.filtrarCaixas, this)
    this.events.once('shutdown', () => {
      this.saindo = true
      this.geracao++
      this.events.off('postupdate', this.filtrarCaixas, this)
      // saída normal (B) já encerrou o efeito com a cena viva; aqui é a reserva
      // (os objetos da cena já foram destruídos e o terminar() pode falhar no meio)
      this.encerrarEfeito()
      this.pistas.forEach((p) => p.destruir())
      this.fundo.destruir()
      this.desfazerMusica()
      if (window.guiaBonus === this) delete window.guiaBonus
    })
    if (import.meta.env.DEV) window.guiaBonus = this

    musica(this.arena.musica, 'pvp')
    this.cameras.main.fadeIn(260)
    this.mostrarEvento()
    if (this.eventos.length) this.time.delayedCall(320, () => this.rodar(this.geracao))
  }

  get evento() {
    return this.eventos[this.indice] ?? null
  }

  texto(x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) {
    return this.add
      .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
      .setDepth(PROF_HUD)
  }

  // ---------- montagem ----------

  // o tabuleiro da PvpArena: faixa escura do HUD, véu da arena, borda e a costura do meio
  desenharMoldura() {
    const { cor, alpha } = this.arena.moldura ?? { cor: 0xffffff, alpha: 0 }
    const g = this.add.graphics().setDepth(-4)
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.78, 0.78, 0.3, 0.3)
    g.fillRect(0, 0, LARGURA, 70)
    if (alpha > 0) {
      g.fillStyle(0x000000, alpha)
      g.fillRoundedRect(6, 66, LARGURA - 12, ALTURA - 72, 16)
    }
    g.lineStyle(2, this.arena.cor ?? cor, 1)
    g.strokeRoundedRect(6, 66, LARGURA - 12, ALTURA - 72, 16)
    for (const j of [0, 1]) {
      g.fillStyle(CORES.almas[j], 0.05)
      g.fillRect(j ? LARGURA / 2 + 2 : 8, 68, LARGURA / 2 - 10, ALTURA - 76)
    }
    g.lineStyle(1, this.arena.cor ?? cor, 0.9)
    for (let y = 76; y < 340; y += 12) g.lineBetween(LARGURA / 2, y, LARGURA / 2, y + 6)
  }

  criarPistas() {
    this.pistas = [0, 1].map((j) => {
      const pista = new Pista(this, {
        x: CENTROS[j],
        y: PISTA.y,
        largura: PISTA.largura,
        altura: PISTA.altura,
        jogador: j,
        cor: CORES.almas[j],
        velocidadeMax: 300,
        dinamica: { campo: CAMPOS[j] },
      })
      pista.aoAcertar = (dano) => this.acertou(this.donoDaPista(j), dano)
      pista.aoGraze = () => this.placares[this.donoDaPista(j)].grazes++
      return pista
    })
  }

  criarHud() {
    const corArena = corTexto(this.arena.cor ?? 0xffffff)
    this.texto(12, 6, `GUIA · ${this.arena.nome}`, 10, corArena, { strokeThickness: 2 })
    this.texto(LARGURA - 12, 6, 'PRÉVIA AO VIVO', 10, '#c8c8d8', { strokeThickness: 2 }).setOrigin(1, 0)
    this.contador = this.texto(LARGURA - 12, 20, '', 10, '#9a9ab0', { strokeThickness: 2 }).setOrigin(1, 0)
    this.nome = this.texto(LARGURA / 2, 24, '', 20, TEXTO.normal, { strokeThickness: 4 }).setOrigin(0.5)
    this.descricao = this.texto(LARGURA / 2, 50, '', 11, '#e0e0ea', { strokeThickness: 3, align: 'center', wordWrap: { width: LARGURA - 60, useAdvancedWrap: true } }).setOrigin(0.5)

    this.placarTextos = [0, 1].map((j) => this.texto(CENTROS[j], PLACAR_Y, '', 10, '#c8c8d8', { strokeThickness: 3 }).setOrigin(0.5))

    // como se virar: painel escuro embaixo (onde ficariam as mãos de cartas)
    const d = DICA
    this.painelDica = this.add.graphics().setDepth(PROF_HUD - 1)
    this.tituloDica = this.texto(d.x + 12, d.y + 8, 'COMO SE VIRAR', 10, TEXTO.normal, { strokeThickness: 2 })
    this.corpoDica = this.texto(d.x + 12, d.y + 24, '', 12, TEXTO.normal, { strokeThickness: 0, wordWrap: { width: d.largura - 24, useAdvancedWrap: true }, lineSpacing: 3 })
    this.aviso = this.texto(LARGURA / 2, PISTA.y, '', 14, '#ffd0d0', { align: 'center', wordWrap: { width: LARGURA - 120, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0.5)
    this.ajuda = this.texto(LARGURA / 2, ALTURA - 13, '', 11, '#b0b0c0', { strokeThickness: 3 }).setOrigin(0.5) // contorno: o fundo da arena pode ser claro
  }

  // nome, descrição e dica do evento em foco
  mostrarEvento() {
    const ev = this.evento
    this.aviso.setText('')
    if (!ev) {
      this.nome.setText('SEM PRÉVIA').setColor(TEXTO.normal)
      this.descricao.setText('')
      this.aviso.setText('Nenhuma rodada bônus desta arena tem prévia ao vivo.')
      this.desenharDica(0xffffff)
      this.corpoDica.setText('')
      return
    }
    const cor = corTexto(ev.cor)
    this.nome.setText(`★ ${ev.nome} ★`).setColor(cor)
    this.caber(this.nome, 20, LARGURA - 200)
    this.descricao.setText(ev.descricao)
    this.contador.setText(this.eventos.length > 1 ? `${this.indice + 1} / ${this.eventos.length}` : '')
    this.tituloDica.setColor(cor)
    this.corpoDica.setText(ev.dica ?? ev.descricao)
    for (let t = 12; t >= 9; t--) {
      this.corpoDica.setFontSize(t)
      if (this.corpoDica.y + this.corpoDica.height <= DICA.y + DICA.altura - 6) break
    }
    this.desenharDica(ev.cor)
    this.tweens.killTweensOf(this.nome)
    this.nome.setScale(1.35)
    this.tweens.add({ targets: this.nome, scale: 1, duration: 240, ease: 'Back.easeOut' })
  }

  desenharDica(cor) {
    const d = DICA
    this.painelDica.clear().fillStyle(CORES.painel, 0.86).fillRoundedRect(d.x, d.y, d.largura, d.altura, 10).lineStyle(2, cor, 0.7).strokeRoundedRect(d.x, d.y, d.largura, d.altura, 10)
  }

  // diminui a fonte até o texto caber na largura
  caber(texto, tamanho, largura) {
    for (let t = tamanho; t >= tamanho - 6; t--) {
      texto.setFontSize(t)
      if (texto.width <= largura) return
    }
  }

  // ---------- o papel da PvpArena para os efeitos ----------

  // coração do jogador p está na pista donoDaPista(p) (CORAÇÃO TROCADO: troca)
  donoDaPista(j) {
    return this.coracoesTrocados ? 1 - j : j
  }

  pistaDe(p) {
    return this.donoDaPista(p)
  }

  // nome do jogador j (o evento CORAÇÃO TROCADO escreve "P1 ⇄ CPU")
  rotulo(j) {
    return j === CPU ? 'CPU' : 'P1'
  }

  // acerto no jogador j (das balas ou direto do evento): só conta no placar
  acertou(j, dano) {
    if (this.saindo || !this.pistas[this.pistaDe(j)]?.rodando) return false
    const placar = this.placares[j]
    placar.acertos++
    placar.dano += dano
    const borda = this.pistas[this.pistaDe(j)].caixa.retangulo
    borda.setStrokeStyle(4, CORES.acerto)
    const k = this.pistaDe(j)
    this.time.delayedCall(140, () => borda.scene && borda.setStrokeStyle(4, CORES.almas[k]))
    return true
  }

  // ---------- efeito do evento (protegido: um erro desliga só a prévia dele) ----------

  protegido(fn, padrao) {
    if (!this.efeito) return padrao
    try {
      return fn(this.efeito)
    } catch (erro) {
      this.falhar(erro)
      return padrao
    }
  }

  iniciarEfeito() {
    const criar = this.evento && EFEITOS[this.evento.id]
    if (!criar) return
    try {
      this.efeito = criar(this, { rng: () => aleatorio(this.rng), rodada: this.estado.rodada, aceleracao: this.aceleracao })
      this.efeito.comecar?.()
      this.efeitosIniciados++
    } catch (erro) {
      this.falhar(erro)
    }
  }

  encerrarEfeito() {
    const efeito = this.efeito
    this.efeito = null
    try {
      efeito?.terminar?.()
    } catch (erro) {
      console.warn(`[guia] o efeito '${this.evento?.id}' falhou ao terminar`, erro)
    }
  }

  // o que os efeitos mexem na música (pvp/bonus/LEIA-ME.md) volta ao normal,
  // mesmo que um terminar() tenha falhado no meio
  desfazerMusica() {
    velocidadeMusica(1)
    tomMusica(0)
    cortarMusica(false)
    reforcarGrave(0)
  }

  falhar(erro) {
    console.warn(`[guia] a prévia do evento '${this.evento?.id}' falhou`, erro)
    this.falhou = this.evento?.id ?? true
    this.encerrarEfeito()
    this.geracao++
    this.coracoesTrocados = false
    this.pistas.forEach((p) => p.esconder())
    this.aviso.setText('Esta rodada bônus não roda na prévia.\nVeja numa partida do PvP!')
  }

  // ---------- o loop da prévia ----------

  esperar(ms) {
    return new Promise((resolver) => this.time.delayedCall(ms, resolver))
  }

  sortearCarta() {
    return this.cartas[inteiro(this.rng, 0, this.cartas.length - 1)]
  }

  // Uma volta = uma esquiva da rodada bônus: um ataque em cada caixa e o
  // efeito do evento junto; depois as caixas fecham e começa outra
  async rodar(geracao) {
    let volta = 0
    while (!this.saindo && geracao === this.geracao) {
      this.placares = [0, 1].map(() => ({ acertos: 0, dano: 0, grazes: 0 }))
      await Promise.all(this.pistas.map((p) => p.mostrar()))
      if (this.saindo || geracao !== this.geracao) return
      this.bots.forEach((b) => b.reiniciar())
      const promessas = this.pistas.map((pista, j) => {
        const previa = previaDaCarta(this.sortearCarta(), ataques)
        pista.tema = previa.tema
        pista.velocidadeMaxBase = previa.velocidadeMax
        return pista.rodar(previa.criar(), { dano: previa.dano, ritmo: previa.ritmo, semente: `guia:${this.evento?.id}:${volta}:${j}:${aleatorio(this.rng)}` })
      })
      volta++
      this.iniciarEfeito()
      await Promise.all(promessas)
      if (this.saindo || geracao !== this.geracao) return
      this.encerrarEfeito()
      await this.esperar(250)
      if (this.saindo || geracao !== this.geracao) return
      tocar(this, 'caixaFechar')
      await Promise.all(this.pistas.map((p) => p.esconder()))
      await this.esperar(PAUSA_ENTRE_VOLTAS)
    }
  }

  trocarEvento(passo) {
    if (this.eventos.length < 2) return
    tocar(this, 'mover')
    this.indice = (this.indice + passo + this.eventos.length) % this.eventos.length
    const geracao = ++this.geracao
    this.encerrarEfeito()
    this.coracoesTrocados = false
    this.falhou = null
    this.pistas.forEach((p) => p.esconder())
    this.mostrarEvento()
    this.time.delayedCall(ESPERA_TROCA, () => geracao === this.geracao && !this.saindo && this.rodar(geracao))
  }

  // para os testes (Playwright): o que está rodando
  estadoDebug() {
    return {
      arena: this.arenaId,
      evento: this.evento?.id ?? null,
      efeito: Boolean(this.efeito),
      efeitosIniciados: this.efeitosIniciados,
      falhou: this.falhou,
      atacando: this.pistas.map((p) => p.atacando),
      placares: this.placares,
    }
  }

  // ---------- entrada ----------

  apertarA(jogador) {
    if (this.saindo) return
    if (this.controlador !== null) return this.devolverParaCpu()
    if (!this.evento || this.falhou) return tocar(this, 'erro')
    this.controlador = jogador
    tocar(this, 'confirmar')
  }

  apertarB() {
    if (this.saindo) return
    if (this.controlador !== null) return this.devolverParaCpu()
    this.saindo = true
    this.geracao++
    this.encerrarEfeito() // com a cena ainda viva (o terminar() mexe nos corações, na música...)
    this.desfazerMusica()
    tocar(this, 'cancelar')
    // o Guia volta na página da arena, com o evento que estava aqui em foco
    const salvo = this.registry.get('grimorio') ?? {}
    const k = this.ficha.eventos.findIndex((e) => e.id === this.evento?.id)
    const pagina = PAGINAS_GUIA.findIndex((p) => p.tipo === 'arena' && p.id === this.arenaId)
    const indices = { ...(salvo.indices ?? {}) }
    if (k >= 0) indices[this.arenaId] = k
    this.registry.set('grimorio', { ...salvo, pagina: pagina >= 0 ? pagina : salvo.pagina, indices })
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => {
      musica('menu', 'jevil') // o Guia toca a música do menu
      this.scene.start('Grimorio')
    })
  }

  devolverParaCpu() {
    this.controlador = null
    this.bots[0].reiniciar()
    tocar(this, 'cancelar')
  }

  // joystick do coração que está na pista j: o do jogador (pista da esquerda,
  // se ele pegou o controle) ou o da CPU daquela pista
  joyDaPista(j, delta) {
    const dono = this.donoDaPista(j)
    if (dono === 0 && this.controlador !== null) return this.controles.joy(this.controlador)
    const pista = this.pistas[j]
    const coracao = pista.coracoes[0]
    if (!pista.rodando || !coracao?.ativo) return { x: 0, y: 0 }
    return this.bots[dono].joy(delta, {
      coracao,
      limites: pista.caixa.limites,
      balas: pista.balas.lista,
      velocidade: pista.velocidadeCoracao,
      fatorVelocidade: pista.balas.fatorVelocidade,
      velocidadeMax: pista.balas.velocidadeMax,
      invertido: false,
    })
  }

  // objetos de fora das caixas não aparecem nas câmeras de recorte (como na PvpArena)
  filtrarCaixas() {
    const caixas = this.caixasDeRecorte
    if (!caixas?.length) return
    const principal = this.cameras.main.id
    let mascara = 0
    for (const caixa of caixas) mascara |= caixa.camera.id
    for (const o of this.children.list) {
      if (o.cameraFilter & principal) continue
      if ((o.cameraFilter & mascara) !== mascara) o.cameraFilter |= mascara
    }
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    if (this.saindo) return

    if (this.controlador === null) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'esquerda' || d === 'direita') this.trocarEvento(d === 'direita' ? 1 : -1)
      }
    }

    // a mesma ordem da PvpArena: joy -> passo -> pista; depois atualizar do efeito
    this.pistas.forEach((pista, j) => {
      let joy = this.joyDaPista(j, delta)
      if (this.efeito?.joy) joy = this.protegido((e) => e.joy(j, joy), joy) ?? joy
      const passo = this.efeito?.passo ? this.protegido((e) => e.passo(j, delta, joy), delta) : delta
      if (passo > 0) pista.atualizar(passo, joy)
    })
    if (this.efeito?.atualizar) this.protegido((e) => e.atualizar(delta))

    this.atualizarTextos()
  }

  atualizarTextos() {
    this.placares.forEach((p, j) => {
      const quem = j === CPU ? 'CPU' : this.controlador !== null ? 'VOCÊ' : 'P1 (CPU)'
      this.placarTextos[j].setText(`${quem} · ${p.acertos} acerto${p.acertos === 1 ? '' : 's'}${p.dano ? ` (-${p.dano} HP)` : ''} · ${p.grazes} graze${p.grazes === 1 ? '' : 's'}`)
      this.placarTextos[j].setColor(j === 0 && this.controlador !== null ? TEXTO.selecionado : '#c8c8d8')
    })
    const quem = this.controles.numJogadores > 1 && this.controlador !== null ? ` (P${this.controlador + 1})` : ''
    const ajuda =
      this.controlador !== null
        ? `você desvia na caixa da esquerda${quem}      A ou B: devolver para a CPU`
        : `${this.eventos.length > 1 ? '←→ outro evento      ' : ''}A: você desvia      B: voltar ao guia`
    if (this.ajuda.text !== ajuda) this.ajuda.setText(ajuda)
  }
}
