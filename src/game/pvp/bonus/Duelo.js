import { CORES, CORACAO, FONTE, TEXTO, ACELERACAO, parteDoFator, corTexto } from '../../constants.js'
import { tocar } from '../../audio.js'
import { ESCALA } from '../../arte/texturas.js'
import { SIMBOLOS } from '../cartas.js'
import { rotuloValor } from '../../entities/Carta.js'
import { criarRng, aleatorio } from '../baralho.js'
import { shake } from '../../effects/shake.js'
import { flashTela } from '../../effects/flash.js'
import { particulas } from '../../effects/particulas.js'
import { BotDuelo, difAngulo } from './botDuelo.js'

// DUELO (bonus round): as duas pistas fecham e abre UMA caixa grande no meio
// com os dois corações dentro. Cada um luta com a arma do naipe da carta que
// escolheu (pvp/bonus.js armaDaCarta: ♥ tiro, ♠ espada, ♦ bumerangue,
// ♣ explosão; passou = arma sorteada na força mínima). A força da carta
// aumenta o dano e um pouco o alcance/velocidade.
//
//   import Duelo from '../pvp/bonus/Duelo.js'
//   const duelo = new Duelo(arena, { armas, cpu: arena.cpu, nivelBot: arena.nivelBot, semente, aceleracao: arena.aceleracao })
//     armas  resolverDuelo(...).armas -> [{ arma, forca, dano, carta }, {...}]
//     cpu    lado da CPU (ou null); `cpus: [0, 1]` põe a CPU nos dois (testes)
//   await duelo.rodar()     o duelo inteiro (abre, apresenta, 3-2-1, luta, fecha);
//                           resolve com { motivo: 'tempo' | 'ko' | 'parado', ko, acertos, dano }
//   duelo.atualizar(delta)  todo frame (a arena chama enquanto fase === 'duelo')
//   duelo.atacar(j)         o humano do lado j apertou A
//   duelo.nocaute(j)        o HP do lado j zerou (a arena avisa; o próprio duelo
//                           também confere o HP depois de cada acerto)
//   duelo.parar()           saída da cena: para na hora, destrói tudo, resolve rodar()
//   duelo.estadoDebug()     posições, recargas, acertos (testes)
//
// Dano: cada acerto chama arena.acertou(j, dano) (HUD, placar, estatísticas).
// O duelo cuida dos i-frames de cada coração (DUELO.invencivelMs, piscando).
// Mira AUTOMÁTICA: toda arma sai na direção do outro coração (a setinha
// mostra); o jogador só se mexe e aperta A. O tiro ainda adianta um pouco
// para onde o outro está indo; a bomba cai em cima dele.
// Tudo é desenhado na câmera principal (sem câmera de recorte): os objetos
// ficam presos dentro da caixa à mão.

const DUELO = {
  duracaoMs: 15000, // tempo de luta (encurta com a morte súbita, até duracaoMinMs)
  duracaoMinMs: 9000,
  caixa: { x: 320, y: 200, largura: 430, altura: 228 }, // dentro de y 74..334
  borda: 4,
  invencivelMs: 700,
  fimMs: 900, // depois de um K.O. a luta ainda corre isso (dá para os dois caírem)
  hitbox: 6, // raio do coração para os golpes do duelo
  bufferMs: 160, // A apertado um pouco antes da recarga acabar ainda sai
  contagemMs: 520,
}

// Cada arma. `*Extra` é o que a força 1 (carta mais forte) soma.
//   tiro        projétil reto e rápido; recarga curta; dano pequeno; mira com
//               `antecipa` do movimento do outro (0 = no ponto onde ele está)
//   espada      arco de `arco` graus na frente; preparo curto (telegrafa), depois o golpe;
//               o golpe também DESTRÓI tiros do inimigo e rebate o bumerangue;
//               quem golpeia anda a `lentidao` da velocidade durante o golpe e o
//               acerto empurra o outro `empurrao` px (dá tempo de fugir)
//   bumerangue  vai até o outro (no máximo `distancia`), desacelerando, e volta
//               perseguindo o dono; acerta uma vez na ida e uma na volta;
//               recarga = até voltar (mín. recargaMs)
//   explosao    `bombas` em leque (a do meio cai onde o outro vai estar, com
//               `antecipa` do movimento dele, até `distancia`;
//               as outras a `leque` px dos lados); pavio piscando; cada uma
//               explode em `raio` e solta `estilhacos` em volta (cada um causa
//               `fatorEstilhaco` do dano; a espada quebra). Não machuca o dono.
const ARMAS_DUELO = {
  tiro: { nome: 'TIRO', recargaMs: 260, velocidade: 300, velocidadeExtra: 90, raio: 5, antecipa: 0.6 },
  espada: { nome: 'ESPADA', recargaMs: 650, alcance: 36, alcanceExtra: 12, arco: 120, preparoMs: 90, golpeMs: 150, lentidao: 0.45, empurrao: 26 },
  bumerangue: { nome: 'BUMERANGUE', recargaMs: 500, distancia: 200, distanciaExtra: 60, velocidade: 400, raio: 8, vidaMaxMs: 3500 },
  explosao: { nome: 'EXPLOSÃO', recargaMs: 900, distancia: 260, vooMs: 280, pavioMs: 600, raio: 50, raioExtra: 10, explosaoMs: 420, bombas: 3, leque: 52, antecipa: 0.7, estilhacos: 5, velocidadeEstilhaco: 190, fatorEstilhaco: 0.6 },
}

const MEIO = CORACAO.tamanho / 2
// ícone (textura) de cada arma
const ARMA_ICONE = { tiro: 'tiro', espada: 'espada', bumerangue: 'bumerangue', explosao: 'bomba' }
const PROFUNDIDADE = { fundo: 2, aviso: 3, borda: 4, rotulo: 5, bomba: 6, tiro: 7, seta: 9, golpe: 10, coracao: 11, explosao: 13, texto: 40, contagem: 96 }

const limitar = (v, a, b) => Math.max(a, Math.min(b, v))
const outro = (j) => 1 - j

export default class Duelo {
  constructor(arena, { armas, cpu = null, cpus = null, nivelBot = 'normal', semente = 'duelo', aceleracao = 1 } = {}) {
    this.arena = arena
    this.armas = [0, 1].map((j) => armas?.[j] ?? { arma: 'tiro', forca: 0, dano: 3, carta: null })
    this.aceleracao = aceleracao
    this.fatorCoracao = parteDoFator(aceleracao, ACELERACAO.coracao)
    this.velocidade = (arena.registry?.get('velocidade') ?? CORACAO.velocidadePadrao) * this.fatorCoracao
    this.duracao = Math.max(DUELO.duracaoMinMs, Math.round(DUELO.duracaoMs / aceleracao / 500) * 500)
    this.params = this.armas.map((a) => this.parametros(a))
    const ladosCpu = cpus ?? (cpu === null || cpu === undefined ? [] : [cpu])
    const rng = criarRng(`${semente}:duelo`)
    const sorte = () => aleatorio(rng)
    this.bots = [0, 1].map((j) => (ladosCpu.includes(j) ? new BotDuelo({ nivel: nivelBot, rng: sorte }) : null))

    const { x, y, largura, altura } = DUELO.caixa
    this.caixa = { x, y, largura, altura }
    const m = DUELO.borda / 2 + MEIO
    this.limites = { left: x - largura / 2 + m, right: x + largura / 2 - m, top: y - altura / 2 + m, bottom: y + altura / 2 - m }
    // área dos projéteis (morrem ao sair)
    this.area = { left: x - largura / 2, right: x + largura / 2, top: y - altura / 2, bottom: y + altura / 2 }

    this.estagio = null // 'abrindo' | 'apresentando' | 'contagem' | 'luta' | 'final' | 'fim' | 'fechando' | 'parado'
    this.parado = false
    this.tempo = this.duracao
    this.finalMs = 0
    this.motivo = null
    this.coracoes = []
    this.tiros = []
    this.bumerangues = []
    this.bombas = []
    this.explosoes = []
    this.objetos = new Set() // tudo o que precisa ser destruído no fim
    this.pendentes = new Set() // promessas de espera (parar() resolve todas)
    this.ultimoSegundo = null
  }

  // ---------- utilidades ----------

  parametros({ arma, forca: f = 0 }) {
    const c = ARMAS_DUELO[arma] ?? ARMAS_DUELO.tiro
    const fp = parteDoFator(this.aceleracao, ACELERACAO.coracao)
    switch (arma) {
      case 'espada':
        return { ...c, alcance: c.alcance + c.alcanceExtra * f }
      case 'bumerangue':
        return { ...c, distancia: c.distancia + c.distanciaExtra * f, velocidade: c.velocidade * fp, alcance: c.distancia + c.distanciaExtra * f }
      case 'explosao':
        return { ...c, raio: c.raio + c.raioExtra * f, alcance: c.distancia }
      default:
        return { ...c, velocidade: (c.velocidade + c.velocidadeExtra * f) * fp, alcance: 320 }
    }
  }

  registrar(obj) {
    this.objetos.add(obj)
    return obj
  }

  soltar(obj) {
    if (!obj) return
    this.objetos.delete(obj)
    this.arena.tweens.killTweensOf(obj)
    obj.destroy()
  }

  // sprite do PNG bonus-<nome> (assets.js)
  imagem(nome, x, y, { cor = null, tamanho = null, profundidade = PROFUNDIDADE.tiro } = {}) {
    const img = this.registrar(this.arena.add.image(x, y, `bonus-${nome}`).setDepth(profundidade))
    if (cor !== null) img.setTint(cor)
    if (tamanho) img.setScale(tamanho / Math.max(img.width, img.height))
    return img
  }

  texto(x, y, conteudo, tamanho, cor, extra = {}) {
    return this.registrar(
      this.arena.add
        .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center', ...extra })
        .setOrigin(0.5)
        .setDepth(PROFUNDIDADE.texto),
    )
  }

  esperar(ms) {
    if (this.parado) return Promise.resolve()
    return new Promise((resolver) => {
      const fim = () => {
        if (!this.pendentes.has(fim)) return
        this.pendentes.delete(fim)
        resolver()
      }
      this.pendentes.add(fim)
      this.arena.time.delayedCall(ms, fim)
    })
  }

  tween(config) {
    if (this.parado) return Promise.resolve()
    return new Promise((resolver) => {
      const fim = () => {
        if (!this.pendentes.has(fim)) return
        this.pendentes.delete(fim)
        resolver()
      }
      this.pendentes.add(fim)
      this.arena.tweens.add({ ...config, onComplete: fim })
    })
  }

  rotulo(j) {
    return this.arena.rotulo?.(j) ?? `P${j + 1}`
  }

  // "ESPADA (7♠)" / "TIRO (passou)"
  nomeDaArma(j) {
    const a = this.armas[j]
    const nome = ARMAS_DUELO[a.arma]?.nome ?? a.arma
    const carta = a.carta ? `${rotuloValor(a.carta.valor)}${SIMBOLOS[a.carta.naipe] ?? ''}` : 'passou'
    return `${nome} (${carta})`
  }

  pronto(j) {
    const c = this.coracoes[j]
    if (!c || c.ko || c.recargaMs > 0) return false
    const arma = this.armas[j].arma
    if (arma === 'bumerangue' && this.bumerangues.some((b) => b.dono === j)) return false
    if (arma === 'espada' && c.golpe) return false
    return true
  }

  // ---------- fluxo ----------

  rodar() {
    if (!this.promessa) this.promessa = this.sequencia()
    return this.promessa
  }

  async sequencia() {
    try {
      if (this.arena.ko) this.arena.ko = [false, false]
      await this.abrir()
      if (this.parado) return this.resultado()
      await this.apresentar()
      if (this.parado) return this.resultado()
      this.estagio = 'luta'
      await new Promise((resolver) => {
        const fim = () => {
          if (!this.pendentes.has(fim)) return
          this.pendentes.delete(fim)
          resolver()
        }
        this.pendentes.add(fim)
        this.aoAcabar = fim
      })
      if (this.parado) return this.resultado()
      await this.encerrar()
      return this.resultado()
    } finally {
      this.limpar()
    }
  }

  resultado() {
    return {
      motivo: this.parado && !this.motivo ? 'parado' : this.motivo,
      ko: this.coracoes.map((c) => c.ko),
      acertos: this.coracoes.map((c) => c.levou),
      dano: this.coracoes.map((c) => c.danoLevado),
    }
  }

  // a caixa abre do centro (largura primeiro, depois altura)
  async abrir() {
    this.estagio = 'abrindo'
    const a = this.arena
    this.fundo = this.registrar(a.add.graphics().setDepth(PROFUNDIDADE.fundo))
    this.borda = this.registrar(a.add.graphics().setDepth(PROFUNDIDADE.borda))
    this.corBorda = 0xffffff
    this.abertura = { l: 0.04, a: 0.04 }
    this.desenharCaixa()
    tocar(a, 'caixaAbrir')
    await this.tween({ targets: this.abertura, l: 1, duration: 200, ease: 'Cubic.easeOut', onUpdate: () => this.desenharCaixa() })
    await this.tween({ targets: this.abertura, a: 1, duration: 180, ease: 'Back.easeOut', onUpdate: () => this.desenharCaixa() })
    this.desenharCaixa()
  }

  desenharCaixa() {
    if (!this.fundo?.scene) return
    const { x, y, largura, altura } = this.caixa
    const l = largura * this.abertura.l
    const h = altura * this.abertura.a
    this.fundo.clear()
    this.fundo.fillStyle(0x000000, 1)
    this.fundo.fillRect(x - l / 2, y - h / 2, l, h)
    this.borda.clear()
    this.borda.lineStyle(DUELO.borda, this.corBorda, 1)
    this.borda.strokeRect(x - l / 2, y - h / 2, l, h)
  }

  piscarBorda(cor, ms = 120) {
    this.corBorda = cor
    this.desenharCaixa()
    this.arena.time.delayedCall(ms, () => {
      if (this.parado) return
      this.corBorda = 0xffffff
      this.desenharCaixa()
    })
  }

  // corações, "DUELO!", a arma de cada um e o 3-2-1-JÁ
  async apresentar() {
    this.estagio = 'apresentando'
    const a = this.arena
    const cy = this.caixa.y
    this.coracoes = [0, 1].map((j) => this.criarCoracao(j))
    this.criarRotulosFixos()
    tocar(a, 'duelo')
    if (a.mostrarBanner) a.mostrarBanner('DUELO!', '#ff3048', { y: cy - 62, tamanho: 30 })
    else this.texto(this.caixa.x, cy - 62, 'DUELO!', 30, '#ff3048')
    shake(a, 160, 0.008)

    // a arma de cada um em cima do coração
    const cartazes = [0, 1].map((j) => {
      const c = this.coracoes[j]
      const cor = CORES.almas[j]
      const icone = this.imagem(ARMA_ICONE[this.armas[j].arma], c.x, cy + 34, { cor: ARMA_ICONE[this.armas[j].arma] === 'bomba' ? null : cor, tamanho: 22, profundidade: PROFUNDIDADE.texto })
      const t1 = this.texto(c.x, cy + 56, `${this.rotulo(j)}: ${this.nomeDaArma(j)}`, 11, corTexto(cor))
      const t2 = this.texto(c.x, cy + 72, `${this.armas[j].dano} por acerto`, 9, TEXTO.normal, { strokeThickness: 3 })
      const lista = [icone, t1, t2]
      for (const o of lista) {
        o.setAlpha(0)
        this.arena.tweens.add({ targets: o, alpha: 1, duration: 200, delay: 150 + j * 120 })
      }
      return lista
    })
    await this.esperar(1100)
    if (this.parado) return
    a.esconderBanner?.()

    // na contagem já dá para andar e mirar (atacar só no JÁ)
    this.estagio = 'contagem'
    const numero = this.texto(this.caixa.x, cy - 30, '', 34, TEXTO.selecionado).setDepth(PROFUNDIDADE.contagem)
    for (const n of ['3', '2', '1']) {
      numero.setText(n).setScale(1.8).setAlpha(1)
      this.arena.tweens.add({ targets: numero, scale: 1, duration: 200, ease: 'Back.easeOut' })
      tocar(a, 'contador')
      await this.esperar(DUELO.contagemMs)
      if (this.parado) return
    }
    numero.setText('JÁ!').setColor('#ff3048').setScale(2)
    tocar(a, 'contadorFim')
    shake(a, 120, 0.006)
    this.arena.tweens.add({ targets: numero, scale: 1.2, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => this.soltar(numero) })
    for (const o of cartazes.flat()) this.arena.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => this.soltar(o) })
    this.atualizarRelogio(true)
  }

  // canto de cima da caixa: "P1 · ESPADA" com o ícone (fica a luta toda)
  criarRotulosFixos() {
    const { left, right, top } = this.area
    this.rotulosFixos = [0, 1].map((j) => {
      const cor = CORES.almas[j]
      const x = j ? right - 10 : left + 10
      const arma = this.armas[j].arma
      const icone = this.imagem(ARMA_ICONE[arma], x + (j ? -6 : 6), top + 12, { cor: ARMA_ICONE[arma] === 'bomba' ? null : cor, tamanho: 12, profundidade: PROFUNDIDADE.rotulo })
      const t = this.registrar(
        this.arena.add
          .text(x + (j ? -16 : 16), top + 12, `${this.rotulo(j)} · ${ARMAS_DUELO[arma].nome}`, { fontFamily: FONTE, fontSize: '9px', color: corTexto(cor), stroke: '#000000', strokeThickness: 2 })
          .setOrigin(j ? 1 : 0, 0.5)
          .setDepth(PROFUNDIDADE.rotulo)
          .setAlpha(0.85),
      )
      return [icone, t]
    })
  }

  criarCoracao(j) {
    const a = this.arena
    const cor = CORES.almas[j]
    const x = j ? this.limites.right - 70 : this.limites.left + 70
    const y = this.caixa.y
    const sprite = this.registrar(a.add.image(x, y, 'coracao').setTint(cor).setScale(ESCALA.coracao).setDepth(PROFUNDIDADE.coracao))
    const seta = this.imagem('seta', x, y, { cor, tamanho: 9, profundidade: PROFUNDIDADE.seta })
    const barra = this.registrar(a.add.graphics().setDepth(PROFUNDIDADE.seta))
    sprite.setScale(0)
    a.tweens.add({ targets: sprite, scale: ESCALA.coracao, duration: 260, ease: 'Back.easeOut' })
    particulas(a, x, y, { cor, quantidade: 10, velocidade: 90 })
    const dir = { x: j ? -1 : 1, y: 0 }
    return { j, x, y, dir, angulo: Math.atan2(dir.y, dir.x), cor, sprite, seta, barra, ko: false, invencivelMs: 0, recargaMs: 0, recargaTotal: 1, pedidoMs: 0, golpe: null, ladoGolpe: 1, vx: 0, vy: 0, levou: 0, danoLevado: 0, deu: 0 }
  }

  // fim: "FIM DO DUELO!", tudo some e a caixa fecha
  async encerrar() {
    this.estagio = 'fim'
    const a = this.arena
    const kos = this.coracoes.filter((c) => c.ko).length
    const texto = kos === 2 ? 'DUPLO K.O.!' : 'FIM DO DUELO!'
    tocar(a, kos ? 'sino' : 'contadorFim')
    if (a.mostrarBanner) a.mostrarBanner(texto, TEXTO.selecionado, { y: this.caixa.y, tamanho: 24 })
    else this.texto(this.caixa.x, this.caixa.y, texto, 24, TEXTO.selecionado)
    if (a.textoRelogio) a.textoRelogio.setText('')
    await this.esperar(1200)
    if (this.parado) return
    a.esconderBanner?.()
    // projéteis e bombas somem (bomba no chão não explode mais)
    for (const o of [...this.tiros, ...this.bumerangues, ...this.bombas]) {
      particulas(a, o.x, o.y, { cor: 0xffffff, quantidade: 4, velocidade: 60 })
      this.soltarProjetil(o)
    }
    this.tiros = []
    this.bumerangues = []
    this.bombas = []
    const vivos = this.coracoes.flatMap((c) => [c.sprite, c.seta, c.barra, c.golpe?.sprite, c.golpe?.rastro].filter(Boolean))
    const rotulos = (this.rotulosFixos ?? []).flat()
    await this.tween({ targets: [...vivos, ...rotulos], alpha: 0, duration: 220 })
    if (this.parado) return
    this.estagio = 'fechando'
    tocar(a, 'caixaFechar')
    await this.tween({ targets: this.abertura, a: 0.04, duration: 160, ease: 'Cubic.easeIn', onUpdate: () => this.desenharCaixa() })
    await this.tween({ targets: this.abertura, l: 0.02, duration: 160, ease: 'Cubic.easeIn', onUpdate: () => this.desenharCaixa() })
  }

  acabar(motivo) {
    if (this.estagio === 'fim' || this.estagio === 'fechando' || this.motivo) return
    this.motivo = motivo
    this.estagio = 'fim'
    this.aoAcabar?.()
  }

  // saída da cena: para na hora
  parar() {
    if (this.parado) return
    this.parado = true
    if (!this.motivo) this.motivo = 'parado'
    this.estagio = 'parado'
    for (const fim of [...this.pendentes]) fim()
    this.limpar()
  }

  limpar() {
    if (this.limpo) return
    this.limpo = true
    this.estagio = this.parado ? 'parado' : 'acabou'
    const a = this.arena
    if (a.textoRelogio?.scene) a.textoRelogio.setText('')
    for (const o of this.objetos) {
      if (!o.scene) continue
      a.tweens?.killTweensOf(o)
      o.destroy()
    }
    this.objetos.clear()
    this.tiros = []
    this.bumerangues = []
    this.bombas = []
    this.explosoes = []
  }

  // ---------- entrada ----------

  // humano apertou A no lado j
  atacar(j) {
    if (this.bots[j] || !this.coracoes[j]) return
    if (this.estagio !== 'luta' && this.estagio !== 'final') return
    if (!this.tentarAtacar(j)) this.coracoes[j].pedidoMs = DUELO.bufferMs
  }

  tentarAtacar(j) {
    if (!this.pronto(j)) return false
    const c = this.coracoes[j]
    const p = this.params[j]
    switch (this.armas[j].arma) {
      case 'espada':
        this.golpear(j)
        break
      case 'bumerangue':
        this.lancarBumerangue(j)
        break
      case 'explosao':
        this.jogarBomba(j)
        break
      default:
        this.atirar(j)
    }
    c.recargaMs = c.recargaTotal = p.recargaMs
    c.pedidoMs = 0
    return true
  }

  // ---------- armas ----------

  atirar(j) {
    const c = this.coracoes[j]
    const p = this.params[j]
    // mira adiantada: onde o outro vai estar quando o tiro chegar (uma parte disso)
    const alvo = this.coracoes[outro(j)]
    let ang = c.angulo
    if (alvo && !alvo.ko) {
      const voo = Math.hypot(alvo.x - c.x, alvo.y - c.y) / p.velocidade
      ang = Math.atan2(alvo.y + alvo.vy * voo * p.antecipa - c.y, alvo.x + alvo.vx * voo * p.antecipa - c.x)
    }
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const x = c.x + dx * 10
    const y = c.y + dy * 10
    const sprite = this.imagem('tiro', x, y, { cor: c.cor, tamanho: p.raio * 2.6, profundidade: PROFUNDIDADE.tiro }).setRotation(ang)
    this.tiros.push({ tipo: 'tiro', dono: j, x, y, vx: dx * p.velocidade, vy: dy * p.velocidade, raio: p.raio, sprite })
    tocar(this.arena, 'tiro')
    // coice: o coração "pula" para trás no visual
    c.sprite.setScale(ESCALA.coracao * 1.25)
    this.arena.tweens.add({ targets: c.sprite, scale: ESCALA.coracao, duration: 120 })
  }

  golpear(j) {
    const c = this.coracoes[j]
    const p = this.params[j]
    c.ladoGolpe *= -1
    const sprite = this.imagem('espada', c.x, c.y, { cor: 0xffffff, profundidade: PROFUNDIDADE.golpe }).setOrigin(0.12, 0.5)
    sprite.setScale((p.alcance + 6) / sprite.width)
    const rastro = this.registrar(this.arena.add.graphics().setDepth(PROFUNDIDADE.golpe - 1))
    c.golpe = { idade: 0, angulo: c.angulo, lado: c.ladoGolpe, sprite, rastro, acertou: false, somou: false }
    this.posicionarGolpe(c)
  }

  // ângulo atual da lâmina: preparo (puxa para trás) e o arco do golpe
  anguloDaLamina(c) {
    const g = c.golpe
    const p = this.params[c.j]
    const meio = ((p.arco / 2) * Math.PI) / 180
    if (g.idade < p.preparoMs) return g.angulo - g.lado * meio * (1 + 0.15 * (g.idade / p.preparoMs))
    const t = Math.min(1, (g.idade - p.preparoMs) / p.golpeMs)
    const suave = 1 - (1 - t) * (1 - t)
    return g.angulo - g.lado * meio * 1.15 + g.lado * 2 * meio * 1.15 * suave
  }

  posicionarGolpe(c) {
    const g = c.golpe
    const p = this.params[c.j]
    const ang = this.anguloDaLamina(c)
    g.sprite.setPosition(c.x, c.y).setRotation(ang)
    const ativo = g.idade >= p.preparoMs
    g.sprite.setAlpha(ativo ? 1 : 0.55)
    g.rastro.clear()
    if (ativo) {
      const meio = ((p.arco / 2) * Math.PI) / 180
      const inicio = g.angulo - g.lado * meio * 1.15
      g.rastro.lineStyle(6, c.cor, 0.45)
      g.rastro.beginPath()
      g.rastro.arc(c.x, c.y, p.alcance * 0.85, Math.min(inicio, ang), Math.max(inicio, ang))
      g.rastro.strokePath()
    }
  }

  atualizarGolpe(c, dt) {
    const g = c.golpe
    const p = this.params[c.j]
    g.idade += dt
    this.posicionarGolpe(c)
    const ativo = g.idade >= p.preparoMs && g.idade <= p.preparoMs + p.golpeMs
    if (ativo && !g.somou) {
      g.somou = true
      tocar(this.arena, 'espadada')
    }
    if (ativo) {
      const meio = ((p.arco / 2) * Math.PI) / 180 + 0.15
      const naLamina = (x, y, raio) => {
        const d = Math.hypot(x - c.x, y - c.y)
        return d <= p.alcance + raio && Math.abs(difAngulo(Math.atan2(y - c.y, x - c.x), g.angulo)) <= meio
      }
      const alvo = this.coracoes[outro(c.j)]
      if (!g.acertou && alvo && !alvo.ko && naLamina(alvo.x, alvo.y, DUELO.hitbox + 2)) {
        g.acertou = this.ferir(alvo.j, c.j, alvo.x, alvo.y)
      }
      // aparar: tiros do inimigo quebram, o bumerangue dele volta
      for (const t of this.tiros) {
        if (t.dono === c.j || t.morto || !naLamina(t.x, t.y, t.raio)) continue
        t.morto = true
        particulas(this.arena, t.x, t.y, { cor: 0xffffff, quantidade: 6, velocidade: 90 })
        tocar(this.arena, 'estalo')
      }
      for (const b of this.bumerangues) {
        if (b.dono === c.j || b.fase !== 'ida' || !naLamina(b.x, b.y, b.raio)) continue
        this.virarBumerangue(b)
        particulas(this.arena, b.x, b.y, { cor: 0xffffff, quantidade: 6, velocidade: 90 })
        tocar(this.arena, 'estalo')
      }
    }
    if (g.idade > p.preparoMs + p.golpeMs + 70) {
      this.soltar(g.sprite)
      this.soltar(g.rastro)
      c.golpe = null
    }
  }

  lancarBumerangue(j) {
    const c = this.coracoes[j]
    const p = this.params[j]
    const x = c.x + c.dir.x * 10
    const y = c.y + c.dir.y * 10
    const sprite = this.imagem('bumerangue', x, y, { cor: c.cor, tamanho: p.raio * 2.6, profundidade: PROFUNDIDADE.tiro })
    // vai até um pouco depois do outro (no máximo `distancia`), desacelerando: v² = 2·a·d
    const alvo = this.coracoes[outro(j)]
    const ate = alvo && !alvo.ko ? limitar(Math.hypot(alvo.x - c.x, alvo.y - c.y) + 30, 70, p.distancia) : p.distancia
    const desaceleracao = (p.velocidade * p.velocidade) / (2 * ate)
    this.bumerangues.push({ tipo: 'bumerangue', dono: j, x, y, vx: c.dir.x * p.velocidade, vy: c.dir.y * p.velocidade, v: p.velocidade, a: desaceleracao, raio: p.raio, fase: 'ida', acertou: false, idade: 0, sprite })
    tocar(this.arena, 'bumerangue')
  }

  virarBumerangue(b) {
    b.fase = 'volta'
    b.acertou = false
    b.v = Math.min(b.v, 40)
  }

  atualizarBumerangue(b, dt) {
    const s = dt / 1000
    const p = this.params[b.dono]
    const dono = this.coracoes[b.dono]
    b.idade += dt
    if (b.fase === 'ida') {
      const dir = Math.hypot(b.vx, b.vy) || 1
      b.v = Math.max(0, b.v - b.a * s)
      b.vx = (b.vx / dir) * b.v
      b.vy = (b.vy / dir) * b.v
      b.x += b.vx * s
      b.y += b.vy * s
      const fora = b.x < this.area.left + b.raio || b.x > this.area.right - b.raio || b.y < this.area.top + b.raio || b.y > this.area.bottom - b.raio
      if (fora) {
        b.x = limitar(b.x, this.area.left + b.raio, this.area.right - b.raio)
        b.y = limitar(b.y, this.area.top + b.raio, this.area.bottom - b.raio)
      }
      if (b.v <= 25 || fora) this.virarBumerangue(b)
    } else {
      // volta perseguindo o dono, acelerando
      b.v = Math.min(p.velocidade * 1.1, b.v + b.a * s)
      const dx = dono.x - b.x
      const dy = dono.y - b.y
      const d = Math.hypot(dx, dy) || 1
      b.vx = (dx / d) * b.v
      b.vy = (dy / d) * b.v
      b.x += b.vx * s
      b.y += b.vy * s
      if (d < 12 || dono.ko || b.idade > p.vidaMaxMs) {
        b.morto = true
        if (!dono.ko) {
          particulas(this.arena, b.x, b.y, { cor: dono.cor, quantidade: 5, velocidade: 60 })
          tocar(this.arena, 'cartaSelecionar')
        }
        return
      }
    }
    b.sprite.setPosition(b.x, b.y).setRotation(b.sprite.rotation + 0.024 * dt)
    const alvo = this.coracoes[outro(b.dono)]
    if (!b.acertou && alvo && !alvo.ko && Math.hypot(alvo.x - b.x, alvo.y - b.y) < b.raio + DUELO.hitbox) {
      b.acertou = this.ferir(alvo.j, b.dono, b.x, b.y)
    }
  }

  jogarBomba(j) {
    const c = this.coracoes[j]
    const p = this.params[j]
    const m = 12
    // mira adiantada: onde o outro vai estar quando a bomba explodir (uma parte disso)
    const outroC = this.coracoes[outro(j)]
    let dir = c.dir
    let dist = p.distancia
    if (outroC && !outroC.ko) {
      const t = ((p.vooMs + p.pavioMs) / 1000) * p.antecipa
      const fx = outroC.x + outroC.vx * t - c.x
      const fy = outroC.y + outroC.vy * t - c.y
      const d = Math.hypot(fx, fy) || 1
      dir = { x: fx / d, y: fy / d }
      dist = Math.min(p.distancia, d)
    }
    // leque: uma bomba em cima do outro e as outras dos lados (perpendicular ao arremesso)
    for (let k = 0; k < p.bombas; k++) {
      const lado = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * p.leque
      const alvo = {
        x: limitar(c.x + dir.x * dist - dir.y * lado, this.area.left + m, this.area.right - m),
        y: limitar(c.y + dir.y * dist + dir.x * lado, this.area.top + m, this.area.bottom - m),
      }
      const sprite = this.imagem('bomba', c.x, c.y, { tamanho: k ? 16 : 20, profundidade: PROFUNDIDADE.bomba })
      const aviso = this.registrar(this.arena.add.graphics().setDepth(PROFUNDIDADE.aviso))
      this.bombas.push({ tipo: 'bomba', dono: j, x0: c.x, y0: c.y, alvo, x: c.x, y: c.y, raio: p.raio, estado: 'voo', idade: 0, sprite, aviso, escala: sprite.scale })
    }
    tocar(this.arena, 'voo')
  }

  // ms até a bomba explodir
  restanteBomba(b) {
    const p = this.params[b.dono]
    return b.estado === 'voo' ? p.vooMs - b.idade + p.pavioMs : p.pavioMs - b.idade
  }

  atualizarBomba(b, dt) {
    const p = this.params[b.dono]
    b.idade += dt
    if (b.estado === 'voo') {
      const t = Math.min(1, b.idade / p.vooMs)
      b.x = b.x0 + (b.alvo.x - b.x0) * t
      b.y = b.y0 + (b.alvo.y - b.y0) * t
      const altura = Math.sin(Math.PI * t) * 22
      b.sprite.setPosition(b.x, b.y - altura).setScale(b.escala * (1 + Math.sin(Math.PI * t) * 0.35)).setRotation(t * Math.PI * 2)
      if (t >= 1) {
        b.estado = 'pavio'
        b.idade = 0
        b.sprite.setRotation(0).setScale(b.escala)
        tocar(this.arena, 'pavio')
      }
      return
    }
    // pavio: pisca cada vez mais rápido; o raio da explosão aparece no chão
    const t = Math.min(1, b.idade / p.pavioMs)
    const periodo = 160 - 110 * t
    const aceso = Math.floor(b.idade / periodo) % 2 === 0
    b.sprite.setTint(aceso ? 0xffffff : 0xff4040).setScale(b.escala * (1 + 0.15 * t + (aceso ? 0 : 0.08)))
    b.aviso.clear()
    b.aviso.fillStyle(0xff3048, 0.08 + 0.22 * t)
    b.aviso.fillCircle(b.x, b.y, b.raio * t)
    b.aviso.lineStyle(2, 0xff3048, aceso ? 0.9 : 0.45)
    b.aviso.strokeCircle(b.x, b.y, b.raio)
    if (b.idade >= p.pavioMs) this.explodir(b)
  }

  explodir(b) {
    const a = this.arena
    b.morto = true
    tocar(a, 'explosaoGrande')
    shake(a, 220, 0.012)
    particulas(a, b.x, b.y, { cor: 0xffa040, quantidade: 22, velocidade: 200, vida: 500 })
    // visual: os 8 quadros do PNG (bonus-explosao-0..7)
    const sprite = this.registrar(a.add.image(b.x, b.y, 'bonus-explosao-0').setDepth(PROFUNDIDADE.explosao))
    const tamanho = b.raio * 2.4
    sprite.setScale(tamanho / Math.max(sprite.width, sprite.height))
    this.explosoes.push({ x: b.x, y: b.y, idade: 0, sprite })
    // machuca o outro coração no raio (o dono não)
    for (const c of this.coracoes) {
      if (c.ko || c.j === b.dono) continue
      if (Math.hypot(c.x - b.x, c.y - b.y) <= b.raio + DUELO.hitbox) this.ferir(c.j, b.dono, b.x, b.y)
    }
    // e apaga os tiros que estavam no raio
    for (const t of this.tiros) if (Math.hypot(t.x - b.x, t.y - b.y) <= b.raio) t.morto = true
    // estilhaços em volta (giram um pouco a cada bomba)
    const p = this.params[b.dono]
    const giro = Math.random() * Math.PI
    for (let k = 0; k < p.estilhacos; k++) {
      const ang = giro + (k * Math.PI * 2) / p.estilhacos
      const x = b.x + Math.cos(ang) * b.raio * 0.5
      const y = b.y + Math.sin(ang) * b.raio * 0.5
      const sprite = this.imagem('tiro', x, y, { cor: 0xffa040, tamanho: 10, profundidade: PROFUNDIDADE.tiro }).setRotation(ang)
      this.tiros.push({ tipo: 'estilhaco', dono: b.dono, x, y, vx: Math.cos(ang) * p.velocidadeEstilhaco, vy: Math.sin(ang) * p.velocidadeEstilhaco, raio: 4, fator: p.fatorEstilhaco, sprite })
    }
  }

  atualizarExplosao(e, dt) {
    const dur = ARMAS_DUELO.explosao.explosaoMs
    e.idade += dt
    const t = Math.min(1, e.idade / dur)
    const chave = `bonus-explosao-${Math.min(7, Math.floor(t * 8))}`
    if (e.sprite.texture.key !== chave) e.sprite.setTexture(chave)
    if (t >= 1) {
      e.morto = true
      this.soltar(e.sprite)
    }
  }

  soltarProjetil(o) {
    o.morto = true
    this.soltar(o.sprite)
    if (o.aviso) this.soltar(o.aviso)
  }

  // ---------- dano ----------

  // o lado `j` levou um golpe do lado `de` (de === j: a própria bomba)
  // fator: fração do dano da arma (estilhaço da bomba)
  ferir(j, de, x, y, fator = 1) {
    const c = this.coracoes[j]
    if (!c || c.ko || c.invencivelMs > 0) return false
    if (this.estagio !== 'luta' && this.estagio !== 'final') return false
    const dano = Math.max(1, Math.round(this.armas[de].dano * fator))
    const ok = this.arena.acertou?.(j, dano)
    if (ok === false) return false
    c.invencivelMs = DUELO.invencivelMs
    c.levou++
    c.danoLevado += dano
    if (de !== j) this.coracoes[de].deu++
    tocar(this.arena, 'dano')
    particulas(this.arena, c.x, c.y, { cor: c.cor, quantidade: 10, velocidade: 110 })
    this.piscarBorda(0xff3048)
    // empurrão para longe do golpe (a espada empurra mais)
    const dx = c.x - x
    const dy = c.y - y
    const d = Math.hypot(dx, dy) || 1
    const empurrao = this.params[de].empurrao ?? 10
    c.x = limitar(c.x + (dx / d) * empurrao, this.limites.left, this.limites.right)
    c.y = limitar(c.y + (dy / d) * empurrao, this.limites.top, this.limites.bottom)
    c.sprite.setScale(ESCALA.coracao * 1.8)
    this.arena.tweens.add({ targets: c.sprite, scale: ESCALA.coracao, duration: 180, ease: 'Back.easeOut' })
    // a arena avisa o K.O. (nocaute); confere aqui também, caso não avise
    const hp = this.arena.estado?.jogadores?.[j]?.hp
    if (hp !== undefined && hp <= 0) this.nocaute(j)
    return true
  }

  nocaute(j) {
    const c = this.coracoes[j]
    if (!c || c.ko) return
    c.ko = true
    const a = this.arena
    tocar(a, 'quebrar')
    flashTela(a, c.cor, 0.3, 220)
    shake(a, 260, 0.014)
    particulas(a, c.x, c.y, { cor: c.cor, quantidade: 30, velocidade: 220, vida: 700 })
    a.tweens.killTweensOf(c.sprite)
    c.sprite.setVisible(false)
    c.seta.setVisible(false)
    c.barra.clear()
    if (c.golpe) {
      this.soltar(c.golpe.sprite)
      this.soltar(c.golpe.rastro)
      c.golpe = null
    }
    const t = this.texto(c.x, c.y - 4, 'K.O.!', 18, TEXTO.caido)
    t.setScale(2)
    a.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' })
    if (this.estagio === 'luta') {
      this.estagio = 'final'
      this.finalMs = DUELO.fimMs
    }
  }

  // ---------- frame ----------

  atualizar(deltaBruto) {
    if (this.parado || this.limpo) return
    const lutando = this.estagio === 'luta' || this.estagio === 'final'
    if (!lutando && !['apresentando', 'contagem', 'fim'].includes(this.estagio)) return
    const dt = Math.min(deltaBruto, 50)
    const mexe = lutando || this.estagio === 'contagem'

    for (const c of this.coracoes) {
      if (c.ko) continue
      const j = c.j
      let joy
      let atacar = false
      if (this.bots[j]) {
        const r = mexe ? this.bots[j].atualizar(dt, this.estadoBot(j)) : { joy: { x: 0, y: 0 }, atacar: false }
        joy = r.joy
        atacar = r.atacar
      } else joy = this.arena.controles?.joy(j) ?? { x: 0, y: 0 }
      if (mexe) this.mover(c, joy, dt)
      this.mirar(c)
      c.invencivelMs = Math.max(0, c.invencivelMs - dt)
      if (!lutando) continue
      c.recargaMs = Math.max(0, c.recargaMs - dt)
      if (atacar) this.tentarAtacar(j)
      if (c.pedidoMs > 0) {
        c.pedidoMs -= dt
        if (this.pronto(j)) this.tentarAtacar(j)
      }
      if (c.golpe) this.atualizarGolpe(c, dt)
    }

    if (this.estagio !== 'fim') {
      this.atualizarTiros(dt)
      for (const b of this.bumerangues) this.atualizarBumerangue(b, dt)
      for (const b of this.bombas) this.atualizarBomba(b, dt)
    }
    for (const e of this.explosoes) this.atualizarExplosao(e, dt)
    this.recolher()
    this.desenharCoracoes()

    if (this.estagio === 'luta') {
      this.tempo = Math.max(0, this.tempo - dt)
      this.atualizarRelogio()
      if (this.tempo <= 0) this.acabar('tempo')
    } else if (this.estagio === 'final') {
      this.finalMs -= dt
      if (this.finalMs <= 0) this.acabar('ko')
    }
  }

  mover(c, joy, dt) {
    let jx = (joy?.x ?? 0) / 100
    let jy = (joy?.y ?? 0) / 100
    const n = Math.hypot(jx, jy)
    if (n > 1) {
      jx /= n
      jy /= n
    }
    const passo = this.velocidade * (c.golpe ? this.params[c.j].lentidao : 1) * (dt / 1000)
    const x0 = c.x
    const y0 = c.y
    c.x = limitar(c.x + jx * passo, this.limites.left, this.limites.right)
    c.y = limitar(c.y + jy * passo, this.limites.top, this.limites.bottom)
    // velocidade (px/s), para a mira adiantada do tiro
    c.vx = dt > 0 ? ((c.x - x0) * 1000) / dt : 0
    c.vy = dt > 0 ? ((c.y - y0) * 1000) / dt : 0
  }

  // mira automática: sempre virado para o outro coração (a espada no meio do
  // golpe mantém a direção em que começou)
  mirar(c) {
    const alvo = this.coracoes[outro(c.j)]
    if (!alvo || alvo.ko || c.golpe) return
    c.angulo = Math.atan2(alvo.y - c.y, alvo.x - c.x)
    c.dir = { x: Math.cos(c.angulo), y: Math.sin(c.angulo) }
  }

  atualizarTiros(dt) {
    const s = dt / 1000
    for (const t of this.tiros) {
      if (t.morto) continue
      t.x += t.vx * s
      t.y += t.vy * s
      t.sprite.setPosition(t.x, t.y)
      if (t.x < this.area.left || t.x > this.area.right || t.y < this.area.top || t.y > this.area.bottom) {
        t.morto = true
        continue
      }
      const alvo = this.coracoes[outro(t.dono)]
      if (alvo && !alvo.ko && Math.hypot(alvo.x - t.x, alvo.y - t.y) < t.raio + DUELO.hitbox) {
        if (this.ferir(alvo.j, t.dono, t.x, t.y, t.fator)) t.morto = true
      }
    }
  }

  // tira da lista (e da tela) o que morreu neste frame
  recolher() {
    const vivos = (lista) =>
      lista.filter((o) => {
        if (!o.morto) return true
        this.soltarProjetil(o)
        return false
      })
    this.tiros = vivos(this.tiros)
    this.bumerangues = vivos(this.bumerangues)
    this.bombas = vivos(this.bombas)
    this.explosoes = this.explosoes.filter((e) => !e.morto)
  }

  desenharCoracoes() {
    for (const c of this.coracoes) {
      if (c.ko) continue
      c.sprite.setPosition(c.x, c.y)
      c.sprite.setAlpha(c.invencivelMs > 0 && Math.floor(c.invencivelMs / 80) % 2 ? 0.25 : 1)
      c.seta.setPosition(c.x + c.dir.x * 15, c.y + c.dir.y * 15).setRotation(c.angulo)
      // barrinha de recarga embaixo do coração
      const g = c.barra
      g.clear()
      const largura = 18
      const x = c.x - largura / 2
      const y = c.y + 12
      const bumerangueFora = this.armas[c.j].arma === 'bumerangue' && this.bumerangues.some((b) => b.dono === c.j)
      const cheio = bumerangueFora ? 0 : 1 - c.recargaMs / Math.max(1, c.recargaTotal)
      g.fillStyle(0x000000, 0.7)
      g.fillRect(x - 1, y - 1, largura + 2, 4)
      g.fillStyle(cheio >= 1 && !c.golpe ? c.cor : 0xffffff, cheio >= 1 ? 1 : 0.7)
      g.fillRect(x, y, largura * cheio, 2)
    }
  }

  atualizarRelogio(forcar = false) {
    const t = this.arena.textoRelogio
    if (!t?.scene) return
    const s = Math.ceil(this.tempo / 1000)
    if (s === this.ultimoSegundo && !forcar) return
    this.ultimoSegundo = s
    t.setText(String(s)).setColor(s <= 3 ? TEXTO.caido : TEXTO.selecionado)
    if (s <= 3 && s > 0 && !forcar) {
      tocar(this.arena, 'contador')
      this.arena.tweens.add({ targets: t, scale: { from: 1.4, to: 1 }, duration: 200 })
    }
  }

  // ---------- CPU ----------

  // o que o bot do lado j enxerga (formato de botDuelo.js)
  estadoBot(j) {
    const eu = this.coracoes[j]
    const ini = this.coracoes[outro(j)]
    const perigos = []
    for (const t of this.tiros) if (t.dono !== j && !t.morto) perigos.push({ x: t.x, y: t.y, vx: t.vx, vy: t.vy, raio: t.raio })
    for (const b of this.bumerangues) if (b.dono !== j && !b.morto) perigos.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, raio: b.raio })
    for (const b of this.bombas) {
      if (b.morto) continue
      const resta = this.restanteBomba(b)
      perigos.push({ x: b.alvo.x, y: b.alvo.y, raio: b.raio + 4, desdeMs: Math.max(0, resta - 150), ateMs: resta + 120, bomba: true, minha: b.dono === j, peso: 1.5 })
    }
    // a lâmina do inimigo: quem não tem espada foge dela; espada contra espada
    // só respeita o golpe já saindo (senão os dois ficam se estudando)
    if (ini && !ini.ko && this.armas[ini.j].arma === 'espada') {
      const euEspada = this.armas[j].arma === 'espada'
      if (ini.golpe || (!euEspada && this.pronto(ini.j))) perigos.push({ x: ini.x, y: ini.y, raio: this.params[ini.j].alcance + (euEspada ? 6 : 20), peso: euEspada ? 0.3 : 0.8 })
    }
    return {
      eu: { x: eu.x, y: eu.y, arma: this.armas[j].arma, pronto: this.pronto(j), velocidade: this.velocidade, alcance: this.params[j].alcance },
      inimigo: ini ? { x: ini.x, y: ini.y, ko: ini.ko, arma: this.armas[ini.j].arma, pronto: this.pronto(ini.j), alcance: this.params[ini.j].alcance } : null,
      limites: this.limites,
      perigos,
      hitbox: DUELO.hitbox,
    }
  }

  // ---------- testes ----------

  estadoDebug() {
    return {
      estagio: this.estagio,
      tempo: Math.round(this.tempo),
      duracao: this.duracao,
      motivo: this.motivo,
      caixa: { ...this.area },
      coracoes: this.coracoes.map((c) => ({
        lado: c.j,
        cpu: Boolean(this.bots[c.j]),
        arma: this.armas[c.j].arma,
        forca: this.armas[c.j].forca,
        dano: this.armas[c.j].dano,
        x: Math.round(c.x),
        y: Math.round(c.y),
        dir: { ...c.dir },
        ko: c.ko,
        invencivelMs: Math.round(c.invencivelMs),
        recargaMs: Math.round(c.recargaMs),
        pronto: this.pronto(c.j),
        levou: c.levou,
        danoLevado: c.danoLevado,
        deu: c.deu,
      })),
      tiros: this.tiros.length,
      bumerangues: this.bumerangues.map((b) => ({ dono: b.dono, fase: b.fase, x: Math.round(b.x), y: Math.round(b.y) })),
      bombas: this.bombas.map((b) => ({ dono: b.dono, estado: b.estado, x: Math.round(b.alvo.x), y: Math.round(b.alvo.y), restanteMs: Math.round(this.restanteBomba(b)) })),
      explosoes: this.explosoes.length,
      objetos: this.objetos.size,
    }
  }
}
