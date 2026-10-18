import { CORES, FONTE, TEXTO, corTexto } from '../../constants.js'
import { tocar } from '../../audio.js'
import { CORES_CARTA } from '../../entities/Carta.js'
import { criarRng, aleatorio } from '../baralho.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'
import { COPIA, quantiaCopiada, copiarEnergia } from '../bonus.js'
import { BotCopia } from './botCopia.js'
import { claraoCamera } from '../../effects/flash.js'

// CTRL+C CTRL+V (bonus round da SALA DE INFORMÁTICA): no lugar de arremesso +
// esquiva abre uma janela de "Copiando energia..." estilo Windows velho, com
// uma barra de progresso disputada em cabo de guerra. Cada aperto de A puxa o
// marcador para o seu lado (e uma gema voa da pasta do outro para a sua);
// quando o tempo acaba, quem está na frente COPIA energia do outro: mais
// longe o marcador, mais energia (pvp/bonus.js: COPIA, quantiaCopiada). A
// barra cheia (100%) acaba na hora. Empate: "erro ao copiar", ninguém leva nada.
// A energia passa pelas regras (copiarEnergia): ninguém fica negativo nem
// passa do máximo.
//
//   import Copia from '../pvp/bonus/Copia.js'
//   const copia = new Copia(arena, { cpu: arena.cpu, nivelBot: arena.nivelBot, semente })
//     cpu    lado da CPU (ou null); `cpus: [0, 1]` põe a CPU nos dois (testes)
//   await copia.rodar()     tudo (abre, explica, 3-2-1, disputa, resultado, fecha); resolve com
//                           { motivo: 'tempo' | 'cheio' | 'parado', apertos, vencedor, quantia, perdeu, ganhou }
//   copia.atualizar(delta)  todo frame (a arena chama enquanto fase === 'duelo')
//   copia.atacar(j)         o humano do lado j apertou A (mesmo nome do Duelo.js:
//                           a arena trata os dois do mesmo jeito)
//   copia.nocaute(j)        nada (ninguém leva dano aqui)
//   copia.parar()           saída da cena: para na hora, destrói tudo, resolve rodar()
//   copia.estadoDebug()     apertos, cabo, tempo (testes)
//
// Tudo fica num container no meio da tela (câmera principal), por cima da
// mesa vazia (as mãos já desceram, como no duelo).

const JANELA = { x: 320, y: 200, largura: 430, altura: 228, titulo: 18 }
const W = JANELA.largura / 2
const H = JANELA.altura / 2
// posições (relativas ao meio da janela)
const BARRA = { x: -190, y: 10, largura: 380, altura: 22, bloco: 10, folga: 2 }
const PASTA = { x: 150, y: -38 }
const TECLA = { x: 150, y: 86, largura: 46, altura: 26 }
const PROFUNDIDADE = { janela: 3, voo: 30, contagem: 96 }
const CONTAGEM_MS = 520
const RESULTADO_MS = 1700

// paleta do "Windows 98"
const WIN = { cinza: 0xc0c0c0, claro: 0xffffff, sombra: 0x808080, escuro: 0x000000, titulo: 0x000080, tituloFim: 0x1084d0 }

const outro = (j) => 1 - j
const misturar = (a, b, t) => {
  const c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

export default class Copia {
  constructor(arena, { cpu = null, cpus = null, nivelBot = 'normal', semente = 'copia', cfg = COPIA } = {}) {
    this.arena = arena
    this.cfg = cfg
    const ladosCpu = cpus ?? (cpu === null || cpu === undefined ? [] : [cpu])
    const rng = criarRng(`${semente}:copia`)
    const sorte = () => aleatorio(rng)
    this.bots = [0, 1].map((j) => (ladosCpu.includes(j) ? new BotCopia({ nivel: nivelBot, rng: sorte, duracaoMs: cfg.duracaoMs }) : null))
    this.estagio = null // 'abrindo' | 'explicando' | 'contagem' | 'luta' | 'fim' | 'fechando' | 'acabou' | 'parado'
    this.parado = false
    this.motivo = null
    this.tempo = cfg.duracaoMs
    this.relogio = 0 // ms de disputa (para o intervalo mínimo entre apertos)
    this.apertos = [0, 0]
    this.ultimoAperto = [-Infinity, -Infinity]
    this.cabo = 0 // vantagem em apertos: > 0 = P1 copiando, < 0 = P2 copiando (limite ±cfg.cheio)
    this.exibido = 0 // o marcador desenhado (anda atrás do cabo, suave)
    this.lider = null
    this.final = null // { vencedor, quantia, perdeu, ganhou }
    this.voando = 0
    this.objetos = new Set()
    this.pendentes = new Set()
    this.ultimoSegundo = null
  }

  // ---------- utilidades ----------

  registrar(obj) {
    this.objetos.add(obj)
    return obj
  }

  // objeto dentro da janela (coordenadas relativas ao meio dela)
  naJanela(obj) {
    this.janela.add(obj)
    return obj
  }

  texto(x, y, conteudo, tamanho, cor, extra = {}) {
    return this.arena.add
      .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, align: 'center', ...extra })
      .setOrigin(0.5)
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

  energia(j) {
    return this.arena.estado?.jogadores?.[j]?.energia ?? 0
  }

  // que teclas o lado j usa (teclado do simulador; no joystick é o botão A)
  teclas(j) {
    if (this.bots[j]) return 'CPU'
    if ((this.arena.numJogadores ?? 2) < 2) return 'Z / ESPAÇO / ENTER'
    return j ? 'ENTER' : 'Z / ESPAÇO'
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
      apertos: [...this.apertos],
      vencedor: this.final?.vencedor ?? null,
      quantia: this.final?.quantia ?? 0,
      perdeu: this.final?.perdeu ?? 0,
      ganhou: this.final?.ganhou ?? 0,
    }
  }

  // a janela "Copiando energia..." abre do meio
  async abrir() {
    this.estagio = 'abrindo'
    const a = this.arena
    this.janela = this.registrar(a.add.container(JANELA.x, JANELA.y).setDepth(PROFUNDIDADE.janela))
    this.montarJanela()
    this.janela.setScale(0.1, 0.05).setAlpha(0)
    tocar(a, 'popup')
    await this.tween({ targets: this.janela, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' })
  }

  montarJanela() {
    const a = this.arena
    // moldura e barra de título (degradê em faixas)
    const g = this.naJanela(a.add.graphics())
    g.fillStyle(WIN.cinza, 1).fillRect(-W, -H, JANELA.largura, JANELA.altura)
    this.relevo(g, -W, -H, JANELA.largura, JANELA.altura, false)
    const faixas = 24
    const larg = (JANELA.largura - 6) / faixas
    for (let k = 0; k < faixas; k++) g.fillStyle(misturar(WIN.titulo, WIN.tituloFim, k / (faixas - 1)), 1).fillRect(-W + 3 + k * larg, -H + 3, larg + 1, JANELA.titulo)
    // botões _ □ X
    for (let k = 0; k < 3; k++) {
      const bx = W - 3 - 16 * (3 - k) - (k === 2 ? 0 : 2)
      g.fillStyle(WIN.cinza, 1).fillRect(bx, -H + 5, 14, 13)
      this.relevo(g, bx, -H + 5, 14, 13, false)
    }
    g.fillStyle(WIN.escuro, 1)
    const by = -H + 5
    const b0 = W - 3 - 16 * 3 - 2
    g.fillRect(b0 + 4, by + 9, 6, 2) // _
    g.lineStyle(1, WIN.escuro, 1).strokeRect(W - 3 - 32 - 2 + 3.5, by + 3.5, 7, 6) // □
    g.lineStyle(2, WIN.escuro, 1).lineBetween(W - 19 + 4, by + 3, W - 19 + 10, by + 10).lineBetween(W - 19 + 10, by + 3, W - 19 + 4, by + 10) // X
    this.naJanela(this.texto(-W + 10, -H + 12, 'Copiando energia...', 10, '#ffffff').setOrigin(0, 0.5))

    // "de" / "para"
    this.subtitulo = this.naJanela(this.texto(0, -H + 36, 'quem vai copiar quem?', 9, '#000000'))

    // pastas dos dois lados (com a energia de cada um)
    this.pastas = [0, 1].map((j) => {
      const x = j ? PASTA.x : -PASTA.x
      const p = this.naJanela(a.add.graphics().setPosition(x, PASTA.y))
      this.desenharPasta(p, CORES.almas[j])
      // "P1  ◆ 3" (a gema desenhada: a fonte não tem o losango)
      const nome = this.naJanela(this.texto(x - 12, PASTA.y + 30, this.rotulo(j), 11, corTexto(CORES.almas[j]), { stroke: '#000000', strokeThickness: 3 }))
      this.naJanela(this.gema(x + 10, PASTA.y + 30, 0.75))
      const gemas = this.naJanela(this.texto(x + 18, PASTA.y + 30, '', 11, '#000000').setOrigin(0, 0.5))
      return { x, p, nome, gemas }
    })
    this.atualizarPastas()

    // porcentagem grande no meio
    this.porcento = this.naJanela(this.texto(0, PASTA.y - 4, '0%', 24, '#ffffff', { stroke: '#000000', strokeThickness: 5 }))

    // a barra de progresso e as faixas de quanto copia
    this.barra = this.naJanela(a.add.graphics())
    this.desenharFaixas()
    this.desenharBarra()

    this.textoTempo = this.naJanela(this.texto(0, BARRA.y + BARRA.altura + 30, '', 9, '#000000'))
    this.atualizarRelogio(true)

    // as teclas de cada um e o contador de apertos
    this.teclasJ = [0, 1].map((j) => {
      const x = j ? TECLA.x : -TECLA.x
      const g = this.naJanela(a.add.graphics().setPosition(x, TECLA.y))
      const letra = this.naJanela(this.texto(x, TECLA.y, 'A', 16, '#000000'))
      const dica = this.naJanela(this.texto(x, TECLA.y + 21, this.teclas(j), 7, '#202020'))
      const conta = this.naJanela(this.texto(x + (j ? -1 : 1) * 54, TECLA.y, '×0', 13, corTexto(CORES.almas[j]), { stroke: '#000000', strokeThickness: 3 }))
      const t = { j, x, g, letra, dica, conta, apertadaMs: 0 }
      this.desenharTecla(t, false)
      return t
    })
  }

  // borda em relevo (alto ou afundado)
  relevo(g, x, y, l, h, afundado) {
    const [luz, sombra] = afundado ? [WIN.sombra, WIN.claro] : [WIN.claro, WIN.sombra]
    g.fillStyle(luz, 1).fillRect(x, y, l, 1).fillRect(x, y, 1, h)
    g.fillStyle(sombra, 1).fillRect(x, y + h - 1, l, 1).fillRect(x + l - 1, y, 1, h)
    if (!afundado) g.fillStyle(WIN.escuro, 1).fillRect(x + 1, y + h, l, 1).fillRect(x + l, y + 1, 1, h)
  }

  desenharPasta(g, cor) {
    const escura = misturar(cor, 0x000000, 0.35)
    g.fillStyle(escura, 1).fillRect(-26, -21, 20, 6).fillRect(-26, -16, 52, 34)
    g.fillStyle(0xffffff, 1).fillRect(-21, -19, 42, 22) // papéis dentro
    g.fillStyle(0xd0d0d0, 1).fillRect(-17, -16, 30, 2).fillRect(-17, -11, 26, 2).fillRect(-17, -6, 30, 2)
    g.fillStyle(cor, 1).fillRect(-28, -8, 56, 27)
    g.fillStyle(0xffffff, 0.35).fillRect(-28, -8, 56, 3)
    g.lineStyle(1, WIN.escuro, 1).strokeRect(-28, -8, 56, 27)
  }

  desenharTecla(t, apertada) {
    const g = t.g
    const { largura: l, altura: h } = TECLA
    g.clear()
    g.fillStyle(apertada ? misturar(CORES.almas[t.j], WIN.cinza, 0.45) : WIN.cinza, 1).fillRect(-l / 2, -h / 2, l, h)
    this.relevo(g, -l / 2, -h / 2, l, h, apertada)
    t.letra.setY(TECLA.y + (apertada ? 1 : 0))
  }

  atualizarPastas() {
    for (const [j, p] of (this.pastas ?? []).entries()) p.gemas.setText(String(this.energia(j)))
  }

  // marcas embaixo da barra: até onde copia 1, 2, 3 (dos dois lados)
  desenharFaixas() {
    const a = this.arena
    const g = this.naJanela(a.add.graphics())
    const meio = BARRA.x + BARRA.largura / 2
    const y = BARRA.y + BARRA.altura + 2
    const limites = [0, ...this.cfg.faixas, 1]
    g.fillStyle(WIN.escuro, 1).fillRect(meio - 1, BARRA.y - 4, 2, BARRA.altura + 10)
    for (const lado of [1, -1]) {
      for (let k = 0; k < limites.length - 1; k++) {
        const x0 = meio + lado * limites[k] * (BARRA.largura / 2)
        const x1 = meio + lado * limites[k + 1] * (BARRA.largura / 2)
        if (k > 0) g.fillStyle(WIN.sombra, 1).fillRect(x0 - 0.5, y, 1, 6)
        // marcador para a direita = P1 copiando: as faixas da direita são do P1 (cor dele)
        const cor = corTexto(CORES.almas[lado > 0 ? 0 : 1])
        const cx = (x0 + x1) / 2
        this.naJanela(this.texto(cx - 5, y + 9, `+${k + 1}`, 9, cor, { stroke: '#000000', strokeThickness: 3 }))
        this.naJanela(this.gema(cx + 9, y + 9, 0.6))
      }
    }
  }

  desenharBarra() {
    const g = this.barra
    if (!g?.scene) return
    const { x, y, largura: l, altura: h, bloco, folga } = BARRA
    const meio = x + l / 2
    const frac = Math.max(-1, Math.min(1, this.exibido / this.cfg.cheio))
    const marcador = meio + frac * (l / 2)
    g.clear()
    g.fillStyle(0xffffff, 1).fillRect(x, y, l, h)
    this.relevo(g, x - 1, y - 1, l + 2, h + 2, true)
    // blocos do Windows: P1 enche da esquerda até o marcador, P2 da direita
    for (let bx = x + 2; bx < x + l - 2; bx += bloco + folga) {
      const fim = Math.min(bx + bloco, x + l - 2)
      const partes = [
        [bx, Math.min(fim, marcador), CORES.almas[0]],
        [Math.max(bx, marcador), fim, CORES.almas[1]],
      ]
      for (const [a0, a1, cor] of partes) if (a1 > a0) g.fillStyle(cor, 1).fillRect(a0, y + 3, a1 - a0, h - 6)
    }
    // o "nó" do cabo de guerra
    g.fillStyle(WIN.escuro, 1).fillRect(marcador - 3, y - 5, 6, h + 10)
    g.fillStyle(0xffffff, 1).fillRect(marcador - 1.5, y - 4, 3, h + 8)
    g.fillStyle(WIN.escuro, 1).fillTriangle(marcador - 6, y - 10, marcador + 6, y - 10, marcador, y - 4)
  }

  // "CTRL+C CTRL+V!", como funciona e o 3-2-1-COPIAR!
  async apresentar() {
    this.estagio = 'explicando'
    const a = this.arena
    tocar(a, 'clonar')
    if (a.mostrarBanner) a.mostrarBanner('CTRL+C CTRL+V!', corTexto(0x7affc8), { y: JANELA.y - H - 22, tamanho: 26 })
    shake(a, 140, 0.006)
    const ajuda = this.registrar(
      this.texto(JANELA.x, JANELA.y + H + 50, 'APERTE A SEM PARAR!\npuxe a barra para o seu lado:\nquem estiver na frente no fim COPIA energia do outro', 12, TEXTO.selecionado, {
        stroke: '#000000',
        strokeThickness: 4,
        lineSpacing: 4,
      }).setDepth(PROFUNDIDADE.contagem),
    )
    ajuda.setAlpha(0)
    a.tweens.add({ targets: ajuda, alpha: 1, duration: 200 })
    // as teclas piscam mostrando o que apertar
    for (const t of this.teclasJ) a.tweens.add({ targets: [t.letra], scale: 1.35, duration: 180, yoyo: true, repeat: 3 })
    await this.esperar(1900)
    if (this.parado) return
    a.esconderBanner?.()
    await this.tween({ targets: ajuda, alpha: 0, duration: 200 })
    if (this.parado) return

    this.estagio = 'contagem'
    const numero = this.registrar(this.texto(JANELA.x, JANELA.y - 4, '', 34, TEXTO.selecionado, { stroke: '#000000', strokeThickness: 6 }).setDepth(PROFUNDIDADE.contagem))
    for (const n of ['3', '2', '1']) {
      numero.setText(n).setScale(1.8).setAlpha(1)
      a.tweens.add({ targets: numero, scale: 1, duration: 200, ease: 'Back.easeOut' })
      tocar(a, 'contador')
      await this.esperar(CONTAGEM_MS)
      if (this.parado) return
    }
    numero.setText('COPIAR!').setColor(corTexto(0x7affc8)).setScale(2)
    tocar(a, 'contadorFim')
    shake(a, 120, 0.006)
    a.tweens.add({ targets: numero, scale: 1.2, alpha: 0, duration: 450, ease: 'Quad.easeOut' })
    this.atualizarRelogio(true)
  }

  // fim: quem copiou, as gemas voando de um HUD para o outro e a janela fecha
  async encerrar() {
    this.estagio = 'fim'
    const a = this.arena
    this.exibido = this.cabo
    this.desenharBarra()
    if (a.textoRelogio) a.textoRelogio.setText('')
    this.textoTempo.setText('Tempo restante: 0 segundos')
    const fracao = Math.abs(this.cabo) / this.cfg.cheio
    const vencedor = this.cabo > 0 ? 0 : this.cabo < 0 ? 1 : null
    const quantia = vencedor === null ? 0 : quantiaCopiada(fracao, this.cfg)
    this.final = { vencedor, quantia, perdeu: 0, ganhou: 0 }

    if (vencedor === null) {
      tocar(a, 'copiarErro')
      shake(a, 160, 0.008)
      this.mostrarErro()
      if (a.mostrarBanner) a.mostrarBanner('EMPATE!', TEXTO.selecionado, { y: JANELA.y - H - 22, tamanho: 24 })
      await this.esperar(RESULTADO_MS + 300)
    } else {
      const perdedor = outro(vencedor)
      const cor = corTexto(CORES.almas[vencedor])
      tocar(a, 'copiado')
      shake(a, fracao >= 1 ? 260 : 160, fracao >= 1 ? 0.012 : 0.007)
      if (fracao >= 1) claraoCamera(a.cameras?.main, 180, 255, 255, 255)
      if (a.mostrarBanner) a.mostrarBanner(`${this.rotulo(vencedor)} COPIOU!`, cor, { y: JANELA.y - H - 22, tamanho: 26 })
      this.porcento.setText(`${Math.round(fracao * 100)}%`).setColor(cor)
      a.tweens.add({ targets: this.porcento, scale: { from: 1.6, to: 1 }, duration: 300, ease: 'Back.easeOut' })
      const pasta = this.pastas[vencedor]
      particulas(a, JANELA.x + pasta.x, JANELA.y + PASTA.y, { cor: CORES.almas[vencedor], quantidade: 16, velocidade: 140 })

      const { perdeu, ganhou } = copiarEnergia(a.estado, perdedor, vencedor, quantia)
      this.final.perdeu = perdeu
      this.final.ganhou = ganhou
      let frase = `${this.rotulo(vencedor)} copiou ${ganhou} de energia de ${this.rotulo(perdedor)}!`
      if (!perdeu) frase = `...mas ${this.rotulo(perdedor)} estava sem energia!`
      else if (ganhou < perdeu) frase = `${this.rotulo(perdedor)} perdeu ${perdeu} (${this.rotulo(vencedor)} já estava cheio)`
      this.subtitulo.setText(frase).setColor('#000000')
      await this.esperar(350)
      if (this.parado) return
      await this.voarEnergia(perdedor, vencedor, perdeu, ganhou)
      if (this.parado) return
      this.atualizarPastas()
      await this.esperar(RESULTADO_MS - 500)
    }
    if (this.parado) return
    a.esconderBanner?.()
    this.estagio = 'fechando'
    tocar(a, 'fecharJanela')
    await this.tween({ targets: this.janela, scaleX: 0.1, scaleY: 0.05, alpha: 0, duration: 200, ease: 'Cubic.easeIn' })
  }

  // a caixinha de erro do empate
  mostrarErro() {
    const a = this.arena
    const c = this.naJanela(a.add.container(0, -6))
    const g = a.add.graphics()
    g.fillStyle(WIN.cinza, 1).fillRect(-120, -34, 240, 68)
    this.relevo(g, -120, -34, 240, 68, false)
    g.fillStyle(WIN.titulo, 1).fillRect(-117, -31, 234, 14)
    g.fillStyle(0xd02020, 1).fillCircle(-96, 6, 12)
    g.lineStyle(3, 0xffffff, 1).lineBetween(-101, 1, -91, 11).lineBetween(-91, 1, -101, 11)
    c.add([
      g,
      this.texto(-112, -24, 'Erro ao copiar', 8, '#ffffff').setOrigin(0, 0.5),
      this.texto(14, 0, 'Energia em uso pelos dois lados.', 8, '#000000'),
      this.texto(14, 14, 'Ninguém copiou nada.', 8, '#000000'),
    ])
    c.setScale(0.2)
    a.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' })
  }

  // as gemas saem do HUD de quem perdeu e entram no de quem copiou (uma por vez)
  async voarEnergia(de, para, perdeu, ganhou) {
    const a = this.arena
    const huds = a.huds
    if (!perdeu || !huds?.[de] || !huds?.[para]) {
      a.atualizarHuds?.()
      return
    }
    const origem = huds[de].pontoEnergia
    const destino = huds[para].pontoEnergia
    const energiaDe = this.energia(de) + perdeu
    const energiaPara = this.energia(para) - ganhou
    const voos = []
    for (let k = 0; k < perdeu; k++) {
      voos.push(
        this.esperar(k * 200).then(() => {
          if (this.parado) return
          huds[de].setEnergia(energiaDe - k - 1)
          tocar(a, 'roubo')
          const gema = this.registrar(this.gema(origem.x, origem.y, 1.6).setDepth(PROFUNDIDADE.voo))
          const meio = { x: (origem.x + destino.x) / 2, y: Math.min(origem.y, destino.y) + 110 }
          const p = { t: 0 }
          return this.tween({
            targets: p,
            t: 1,
            duration: 520,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              const u = 1 - p.t
              gema.setPosition(u * u * origem.x + 2 * u * p.t * meio.x + p.t * p.t * destino.x, u * u * origem.y + 2 * u * p.t * meio.y + p.t * p.t * destino.y)
              gema.setRotation(p.t * Math.PI * 2)
            },
          }).then(() => {
            if (this.parado) return
            this.objetos.delete(gema)
            gema.destroy()
            if (k < ganhou) {
              huds[para].setEnergia(energiaPara + k + 1)
              tocar(a, 'energia')
              particulas(a, destino.x, destino.y, { cor: CORES_CARTA.gema, quantidade: 8, velocidade: 90 })
            } else {
              particulas(a, destino.x, destino.y, { cor: 0xffffff, quantidade: 5, velocidade: 60 })
              a.etiquetaEm?.(destino.x, destino.y + 18, 'CHEIO!', TEXTO.desabilitado, { tamanho: 10, ms: 600 })
            }
          })
        }),
      )
    }
    await Promise.all(voos)
  }

  // uma gema de energia (losango) desenhada
  gema(x, y, escala = 1) {
    const g = this.arena.add.graphics().setPosition(x, y)
    const r = 6
    const losango = (k) => [
      { x: 0, y: -k },
      { x: k * 0.86, y: 0 },
      { x: 0, y: k },
      { x: -k * 0.86, y: 0 },
    ]
    g.fillStyle(CORES_CARTA.gemaEscura, 1).fillPoints(losango(r + 1.5), true)
    g.fillStyle(CORES_CARTA.gema, 1).fillPoints(losango(r), true)
    g.fillStyle(0xffffff, 0.75).fillPoints([{ x: 0, y: -r + 1.5 }, { x: 2, y: -1 }, { x: 0, y: 0 }, { x: -2, y: -1 }], true)
    return g.setScale(escala)
  }

  acabar(motivo) {
    if (this.estagio !== 'luta' || this.motivo) return
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
      if (o.list) for (const filho of o.list) a.tweens?.killTweensOf(filho)
      o.destroy()
    }
    this.objetos.clear()
  }

  // ---------- entrada ----------

  // humano apertou A no lado j
  atacar(j) {
    if (this.bots[j]) return
    this.apertar(j)
  }

  // ninguém leva dano no CTRL+C CTRL+V
  nocaute() {}

  apertar(j) {
    if (this.estagio !== 'luta' || this.parado) return false
    // ruído do botão: dois apertos quase juntos contam um só
    if (this.relogio - this.ultimoAperto[j] < this.cfg.intervaloMinMs) return false
    this.ultimoAperto[j] = this.relogio
    this.apertos[j]++
    this.cabo = Math.max(-this.cfg.cheio, Math.min(this.cfg.cheio, this.cabo + (j ? -1 : 1)))
    this.efeitoAperto(j)
    const lider = this.cabo > 0 ? 0 : this.cabo < 0 ? 1 : null
    if (lider !== this.lider) {
      this.lider = lider
      this.subtitulo.setText(lider === null ? 'quem vai copiar quem?' : `copiando energia de ${this.rotulo(outro(lider))} para ${this.rotulo(lider)}...`)
    }
    if (Math.abs(this.cabo) >= this.cfg.cheio) this.acabar('cheio')
    return true
  }

  efeitoAperto(j) {
    const a = this.arena
    const t = this.teclasJ[j]
    t.apertadaMs = 70
    this.desenharTecla(t, true)
    t.conta.setText(`×${this.apertos[j]}`)
    a.tweens.killTweensOf(t.conta)
    t.conta.setScale(1.35)
    a.tweens.add({ targets: t.conta, scale: 1, duration: 120 })
    tocar(a, 'copiarTecla', { lado: j })
    // uma gema voa da pasta do outro para a de quem apertou
    if (this.voando >= 12) return
    this.voando++
    const de = this.pastas[outro(j)]
    const para = this.pastas[j]
    const gema = this.naJanela(this.gema(de.x, PASTA.y - 6, 0.8))
    const altura = -64 - Math.random() * 12
    const p = { t: 0 }
    a.tweens.add({
      targets: p,
      t: 1,
      duration: 300,
      onUpdate: () => {
        const u = 1 - p.t
        gema.setPosition(u * de.x + p.t * para.x, u * u * (PASTA.y - 6) + 2 * u * p.t * altura + p.t * p.t * (PASTA.y - 6))
      },
      onComplete: () => {
        this.voando--
        gema.destroy()
      },
    })
  }

  // ---------- quadro a quadro ----------

  atualizar(deltaBruto) {
    if (this.parado || this.limpo) return
    const dt = Math.min(deltaBruto, 50)
    for (const t of this.teclasJ ?? []) {
      if (t.apertadaMs > 0 && (t.apertadaMs -= dt) <= 0) this.desenharTecla(t, false)
    }
    if (this.estagio === 'luta') {
      this.relogio += dt
      for (const j of [0, 1]) {
        const n = this.bots[j]?.atualizar(dt) ?? 0
        for (let k = 0; k < n; k++) this.apertar(j)
      }
      this.tempo = Math.max(0, this.tempo - dt)
      this.atualizarRelogio()
      if (this.tempo <= 0) this.acabar('tempo')
    }
    // o marcador anda atrás do cabo (suave) e a porcentagem segue
    if (this.estagio === 'luta' || this.estagio === 'contagem') {
      this.exibido += (this.cabo - this.exibido) * Math.min(1, dt / 60)
      this.desenharBarra()
      const frac = Math.abs(this.cabo) / this.cfg.cheio
      const cor = this.cabo === 0 ? '#ffffff' : corTexto(CORES.almas[this.cabo > 0 ? 0 : 1])
      this.porcento.setText(`${Math.round(frac * 100)}%`).setColor(cor)
    }
  }

  atualizarRelogio(forcar = false) {
    const s = Math.ceil(this.tempo / 1000)
    if (s === this.ultimoSegundo && !forcar) return
    this.ultimoSegundo = s
    this.textoTempo?.setText(`Tempo restante: ${s} segundo${s === 1 ? '' : 's'}`)
    const t = this.arena.textoRelogio
    if (!t?.scene) return
    t.setText(String(s)).setColor(s <= 2 ? TEXTO.caido : TEXTO.selecionado)
    if (s <= 3 && s > 0 && !forcar) {
      tocar(this.arena, 'contador')
      this.arena.tweens.add({ targets: t, scale: { from: 1.4, to: 1 }, duration: 200 })
    }
  }

  // ---------- testes ----------

  estadoDebug() {
    return {
      estagio: this.estagio,
      tempo: Math.round(this.tempo),
      duracao: this.cfg.duracaoMs,
      motivo: this.motivo,
      apertos: [...this.apertos],
      cabo: this.cabo,
      cheio: this.cfg.cheio,
      cpu: this.bots.map(Boolean),
      final: this.final ? { ...this.final } : null,
      objetos: this.objetos.size,
    }
  }
}
