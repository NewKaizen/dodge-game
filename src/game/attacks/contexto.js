import Phaser from 'phaser'
import { ATAQUE, CORES, CORACAO, tetoDeFuga } from '../constants.js'
import { LACUNA_MINIMA, avisar, validarParede, validarLacuna } from './validacao.js'
import { registrarZona, envelhecerZonas, limparZonas } from './zonas.js'

// O que um ataque pode usar (o parâmetro `a` em iniciar(a, cfg)):
//
//   a.bala(opcoes)            cria uma bala (opções em entities/Bullets.js)
//   a.aviso(forma, depois)    telegrafa uma área e roda depois() quando o aviso acaba
//                             forma: { tipo: 'linha', x1, y1, x2, y2, espessura }
//                                    { tipo: 'area', x, y, largura, altura }
//                                    { tipo: 'circulo', x, y, raio }
//                                    + ms (padrão ATAQUE.telegrafoMs)
//                                    + estilo: 'fino'   (linha) só um traço fino, sem a faixa larga
//                                              'pontas' (linha) só as duas pontas, na borda: o
//                                                       "emissor" (lasers), sem riscar a caixa
//                             Registra a área como zona de perigo (a CPU desvia dela; ver attacks/zonas.js)
//                             Prefira não usar: projéteis que nascem fora e entram já são o aviso
//   a.deFora(lado, fracao?, recuo?)   ponto `recuo` px FORA da borda `lado` ('top' | 'bottom' |
//                             'left' | 'right'), a `fracao` (0..1, padrão sorteada) ao longo dela,
//                             mais a direção para dentro: { x, y, dx, dy }. Para balas que entram.
//   a.zonaPerigo(forma, { ms, dura })   só registra a zona, sem desenhar (aviso desenhado à mão);
//                             forma como a do aviso (ou { tipo: 'leque', x, y, raio, angulo, abertura })
//   a.parede({ eixo, lacunas | ocupados })   valida a rota de fuga de uma parede
//   a.lacuna(px, descricao)   valida uma abertura isolada
//   a.aCada(ms, fn, vezes?, atraso?)   repete fn(i) a cada ms (i = 0, 1, 2...); atraso = ms até o 1º
//   a.depois(ms, fn)          roda fn uma vez depois de ms
//   a.aoAtualizar(fn)         roda fn(dt, tempo) todo frame
//   a.decoracao(objeto)       objeto visual que só aparece na caixa e some no fim
//   a.caixa                   retângulo da caixa (left, right, top, bottom, centerX, centerY, width, height);
//                             é o mesmo objeto o turno todo, então leia a.caixa na hora de usar (ela pode ter mudado)
//   a.caixaPara(forma)        muda a caixa ({ largura, altura, x?, y? }; null = padrão), com aviso antes.
//                             Normalmente não chame direto: use a opção `caixa` do ataque (attacks/definir.js)
//   a.alvo()                  posição {x, y} de um coração (alterna entre os jogadores)
//   a.pontoLonge(distancia)   ponto da caixa longe de todos os corações
//   a.aleatorio(min, max)     número com semente fixa (padrões repetíveis)
//   a.inteiro(min, max), a.escolher(lista)
//   a.forma(i), a.cor(forma)  formas/cores de bala do tema do chefe
//   a.lacunaMinima            tamanho mínimo de uma rota de fuga (px)
//   a.tempo                   ms desde o início do turno (relógio: inclui os respiros)
//   a.respiro                 pausas da onda atual (ver attacks/definir.js); nelas os timers ficam parados
//   a.velocidadeCoracao       px/s do coração desta caixa agora (o do painel, com a morte súbita e os eventos)
//   a.tetoPerseguidor(fracao?)   px/s REAIS (já com o ritmo) que pode ter o que persegue o coração
//                             ou varre a caixa inteira sem vão: `fracao` (padrão FUGA.perseguidor,
//                             constants.js) da velocidade do coração. Para movimento feito à mão SEM
//                             o fator do ritmo (ex.: um pivô que passeia a px/s fixos)
//   a.limitarPerseguidor(v, fracao?)   v em px/s ANTES do ritmo (o vx de a.bala, ou o passo à mão que
//                             depois é multiplicado por a.balas.fatorVelocidade), limitado para que,
//                             com o ritmo, ande no máximo a.tetoPerseguidor(): só correndo dá para fugir
//
// Tudo que foi agendado para automaticamente quando o ataque acaba.
export default class ContextoAtaque {
  // velocidadeCoracao: px/s do coração (número ou função lida na hora; a Pista passa a dela)
  constructor({ cena, balas, caixa, coracoes, tema = {}, dano = 5, ritmo = {}, semente, nome = 'ataque', velocidadeCoracao }) {
    this.cena = cena
    this.balas = balas
    this.caixaDeBatalha = caixa
    this.caixa = caixa.limites
    this.coracoes = coracoes
    this.tema = { formas: ['bola'], cores: {}, cor: CORES.bala, ...tema }
    this.dano = dano
    this.ritmo = { velocidade: 1, densidade: 1, ...ritmo }
    this.rng = new Phaser.Math.RandomDataGenerator([String(semente ?? ATAQUE.semente)])
    this.nome = nome
    this.lacunaMinima = LACUNA_MINIMA
    this.timers = []
    this.objetos = []
    this.tempo = 0
    this.fim = Infinity
    this.proximoAlvo = { i: 0 }
    this.fonteVelocidadeCoracao = velocidadeCoracao
  }

  // ---------- balas e avisos ----------

  bala(opcoes) {
    const forma = opcoes.forma ?? this.forma(0)
    // com textura própria (sprites dos SUPERs) a cor do tema não pinta a bala
    const cor = opcoes.textura ? undefined : this.cor(forma)
    return this.balas.criar({ dano: this.dano, cor, origem: this.nome, ...opcoes, forma })
  }

  aviso(forma, depois) {
    const ms = forma.ms ?? ATAQUE.telegrafoMs
    if (ms < ATAQUE.telegrafoMs) {
      avisar(`telegrafo:${this.nome}`, `[telegrafo] ${this.nome}: aviso de ${ms}ms (mínimo ${ATAQUE.telegrafoMs}ms)`)
    }
    this.zonaPerigo(forma, { ms })
    const g = this.cena.add.graphics().setDepth(4)
    const cor = forma.cor ?? CORES.aviso
    g.fillStyle(cor, 0.22)
    g.lineStyle(2, cor, 0.9)
    if (forma.tipo === 'linha' && forma.estilo === 'pontas') {
      // só os "emissores" nas duas pontas: um toco curto na direção da linha
      const e = Math.max(4, forma.espessura ?? 2)
      const dx = forma.x2 - forma.x1
      const dy = forma.y2 - forma.y1
      const d = Math.hypot(dx, dy) || 1
      const toco = Math.min(10, d / 4)
      const ux = (dx / d) * toco
      const uy = (dy / d) * toco
      g.lineStyle(e, cor, 0.85)
      g.lineBetween(forma.x1, forma.y1, forma.x1 + ux, forma.y1 + uy)
      g.lineBetween(forma.x2, forma.y2, forma.x2 - ux, forma.y2 - uy)
    } else if (forma.tipo === 'linha' && forma.estilo === 'fino') {
      g.lineStyle(2, cor, 0.7)
      g.lineBetween(forma.x1, forma.y1, forma.x2, forma.y2)
    } else if (forma.tipo === 'linha') {
      const e = forma.espessura ?? 2
      g.lineStyle(Math.max(2, e * 0.35), cor, 0.9)
      g.lineBetween(forma.x1, forma.y1, forma.x2, forma.y2)
      if (e > 4) {
        g.lineStyle(e, cor, 0.18)
        g.lineBetween(forma.x1, forma.y1, forma.x2, forma.y2)
      }
    } else if (forma.tipo === 'area') {
      g.fillRect(forma.x, forma.y, forma.largura, forma.altura)
      g.strokeRect(forma.x, forma.y, forma.largura, forma.altura)
    } else if (forma.tipo === 'circulo') {
      g.fillCircle(forma.x, forma.y, forma.raio)
      g.strokeCircle(forma.x, forma.y, forma.raio)
    }
    this.decoracao(g)
    this.cena.tweens.add({ targets: g, alpha: 0.35, duration: 90, yoyo: true, repeat: -1 })
    this.depois(ms, () => {
      this.cena.tweens.killTweensOf(g)
      g.destroy()
      depois?.()
    })
    return g
  }

  // Ponto logo fora da borda `lado` (para uma bala nascer fora e entrar)
  deFora(lado, fracao = this.aleatorio(0.1, 0.9), recuo = 12) {
    const l = this.caixa
    const x = l.left + fracao * l.width
    const y = l.top + fracao * l.height
    if (lado === 'top') return { x, y: l.top - recuo, dx: 0, dy: 1 }
    if (lado === 'bottom') return { x, y: l.bottom + recuo, dx: 0, dy: -1 }
    if (lado === 'left') return { x: l.left - recuo, y, dx: 1, dy: 0 }
    return { x: l.right + recuo, y, dx: -1, dy: 0 }
  }

  // Área que vai machucar daqui a `ms` (por `dura` ms): só para a CPU enxergar.
  // O relógio dela para nos respiros desta onda, como os timers
  zonaPerigo(forma, { ms = forma.ms ?? ATAQUE.telegrafoMs, dura } = {}) {
    const z = registrarZona(this.balas, forma, { ms, dura })
    if (z) Object.assign(z, { respiro: this.respiro, fim: this.fim })
    return z
  }

  parede({ eixo, lacunas, ocupados }) {
    return validarParede({ padrao: this.nome, eixo, limites: this.caixa, lacunas, ocupados })
  }

  lacuna(tamanho, descricao) {
    return validarLacuna(this.nome, tamanho, descricao)
  }

  decoracao(objeto) {
    this.caixaDeBatalha.recortar(objeto)
    this.objetos.push(objeto)
    return objeto
  }

  // Muda a forma da caixa com pré-visualização (CAIXA_DINAMICA.avisoMs) e
  // transição. O ataque só começa depois: veja preparoCaixa() em definir.js
  caixaPara(forma) {
    return this.caixaDeBatalha.mudarPara(forma)
  }

  // ---------- tempo ----------

  // atraso: ms até o primeiro disparo (padrão: o próprio intervalo)
  aCada(ms, fn, vezes = Infinity, atraso = null) {
    const intervalo = Math.max(1, ms / this.ritmo.densidade)
    this.timers.push({ intervalo, restante: atraso ?? intervalo, fn, vezes, contador: 0, fim: this.fim, respiro: this.respiro })
  }

  depois(ms, fn) {
    this.timers.push({ intervalo: 1, restante: ms, fn, vezes: 1, contador: 0, fim: this.fim, respiro: this.respiro })
  }

  aoAtualizar(fn) {
    this.timers.push({ cadaFrame: true, fn, fim: this.fim, respiro: this.respiro })
  }

  // Contexto filho cujos timers param depois de `ms` (usado por juntos/sequencia).
  // Herda tudo deste contexto, inclusive a lista de timers, o tempo e a semente.
  limitar(ms) {
    const filho = Object.create(this)
    filho.fim = Math.min(this.fim, this.tempo + ms)
    return filho
  }

  atualizar(dt) {
    this.tempo += dt
    for (const t of [...this.timers]) {
      if (this.tempo > t.fim) continue
      if (t.respiro && this.emRespiro(t.respiro)) continue // calmaria: o relógio do ataque para
      if (t.cadaFrame) {
        t.fn(dt, this.tempo)
        continue
      }
      t.restante -= dt
      while (t.restante <= 0 && t.vezes > 0) {
        t.fn(t.contador++)
        t.vezes--
        t.restante += t.intervalo
      }
    }
    this.timers = this.timers.filter((t) => this.tempo <= t.fim && (t.cadaFrame || t.vezes > 0))
    envelhecerZonas(this.balas, dt, { tempo: this.tempo, parada: (z) => z.respiro && this.emRespiro(z.respiro) })
  }

  // A onda que criou o timer está numa pausa (respiro de início ou do meio)?
  emRespiro(respiro) {
    const rel = this.tempo - respiro.origem
    return respiro.pausas.some(([ini, fim]) => rel >= ini && rel < fim)
  }

  limpar() {
    this.timers = []
    limparZonas(this.balas)
    this.objetos.forEach((o) => {
      this.cena.tweens.killTweensOf(o)
      o.destroy()
    })
    this.objetos = []
  }

  // ---------- alvos e sorteios (com semente) ----------

  alvo() {
    const ativos = this.coracoes.filter((c) => c.ativo)
    if (!ativos.length) return { x: this.caixa.centerX, y: this.caixa.bottom - 30 }
    const c = ativos[this.proximoAlvo.i++ % ativos.length]
    return { x: c.x, y: c.y }
  }

  pontoLonge(distancia, margem = 16) {
    const ativos = this.coracoes.filter((c) => c.ativo)
    let melhor = null
    let melhorDist = -1
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const x = this.aleatorio(this.caixa.left + margem, this.caixa.right - margem)
      const y = this.aleatorio(this.caixa.top + margem, this.caixa.bottom - margem)
      const d = Math.min(Infinity, ...ativos.map((c) => Math.hypot(c.x - x, c.y - y)))
      if (d >= distancia) return { x, y }
      if (d > melhorDist) {
        melhor = { x, y }
        melhorDist = d
      }
    }
    return melhor
  }

  // ---------- fuga correndo (FUGA em constants.js) ----------

  get velocidadeCoracao() {
    const f = this.fonteVelocidadeCoracao
    const v = typeof f === 'function' ? f() : f
    return v ?? this.cena?.registry?.get?.('velocidade') ?? CORACAO.velocidadePadrao
  }

  tetoPerseguidor(fracao) {
    return tetoDeFuga(this.velocidadeCoracao, fracao)
  }

  limitarPerseguidor(v, fracao) {
    const teto = this.tetoPerseguidor(fracao) / (this.balas?.fatorVelocidade || 1)
    return Math.sign(v) * Math.min(Math.abs(v), teto)
  }

  aleatorio(min, max) {
    return this.rng.realInRange(min, max)
  }

  inteiro(min, max) {
    return this.rng.between(min, max)
  }

  escolher(lista) {
    return this.rng.pick(lista)
  }

  forma(i = 0) {
    const formas = this.tema.formas
    return formas[((i % formas.length) + formas.length) % formas.length]
  }

  cor(forma) {
    return this.tema.cores?.[forma] ?? this.tema.cor
  }
}
