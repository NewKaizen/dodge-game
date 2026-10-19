import Phaser from 'phaser'

// Gravador do replay: buffer circular com os últimos GRAVACAO.segundos de
// cada FONTE (as duas pistas e a caixa do duelo), em "fotos" de baixa resolução.
//
// Por que fotos (e não o estado das balas para redesenhar)? Os ataques criam
// de tudo dentro da caixa: balas, mas também Graphics, sprites próprios,
// containers, textos, partículas, filtros... Redesenhar a partir do estado
// exigiria saber copiar cada tipo. A foto pega exatamente o que a câmera
// mostrou, sem re-simular nada e sem depender do ataque. Ela é tirada com
// uma DynamicTexture por quadro (desenho na GPU, nada volta para a CPU: sem
// getImageData), a 30 quadros/s e GRAVACAO.escala do tamanho
// (~180x156 px por pista; 2 pistas x 96 quadros ≈ 11 MB de textura).
//
// Cada foto: fundo preto, os objetos da fonte na ordem de profundidade,
// recortados no retângulo da caixa daquele quadro. Os CORAÇÕES ficam de fora
// da foto: vão só a posição, a cor, a escala e o pisca deles, e o replay
// desenha o sprite de verdade por cima (nítido no zoom e livre para se
// despedaçar). Junto vão o retângulo da caixa e a cor da borda (o replay
// desenha a moldura).
//
// CLOSE: dos últimos GRAVACAO.close.quadros sai também, para cada coração,
// uma foto em resolução maior (GRAVACAO.close.escala) de uma janela em volta
// dele: é a "câmera 2" do replay, o zoom dramático no golpe, sem o borrado da
// foto pequena ampliada. Quadros mais antigos perdem o close. No duelo os
// dois corações dividem a caixa e ninguém sabe ainda quem vai cair: os dois
// ganham close.
//
// Fonte (quem monta é o FimDePartida):
//   { campo,           região do mundo da foto { esquerda, direita, topo, base }
//     gravando(),      conta para manter a gravação ligada
//     visivel(),       tira a foto deste quadro
//     objetos(),       o que desenhar (o gravador tira os corações), sem ordem
//     coracoes(),      [{ sprite, x, y, ativo, cor, j }]
//     limites(),       { left, right, top, bottom, x, y, width, height } da caixa
//     borda() }        cor da moldura
//
//   const g = new Gravador(cena, { fontes })
//   g.atualizar(dt, ativo)   todo frame (dt de jogo); ativo = alguma fonte gravando. Quando
//                            deixa de estar ativo, a próxima gravação recomeça do zero
//   g.parar()                congela o que foi gravado (o K.O.)
//   g.quadrosEmOrdem()       [{ tempo, fontes: [{ chave, caixa, borda, coracoes, closes } | null] }] do mais antigo ao mais novo
//                            coracoes: [{ x, y, ativo, visivel, alpha, escala, cor, j }]
//                            closes:   [{ chave, x, y } (canto do mundo da janela) | null], um por coração
//   g.destruir()             apaga as texturas
//
// Foto: no máximo uma por frame. Abaixo de 30 fps sai uma por frame (menos
// quadros); o replay toca com quantos houver.
export const GRAVACAO = {
  quadroMs: 1000 / 30,
  segundos: 3.2,
  escala: 0.6,
  close: { quadros: 18, escala: 1.25, largura: 184, altura: 150 }, // janela em px de jogo em volta do coração
}

let geracao = 0 // chaves únicas por gravador (a revanche cria outro antes do anterior sumir)

export default class Gravador {
  constructor(cena, { fontes }) {
    this.cena = cena
    this.fontes = fontes
    this.prefixo = `fim-replay-${++geracao}`
    this.total = Math.round((GRAVACAO.segundos * 1000) / GRAVACAO.quadroMs)
    const par = (v) => Math.ceil(v / 2) * 2
    this.tamanhos = fontes.map(({ campo }) => ({ largura: par((campo.direita - campo.esquerda) * GRAVACAO.escala), altura: par((campo.base - campo.topo) * GRAVACAO.escala) }))
    this.limparBuffers()
    this.quadros = new Array(this.total)
    this.proximo = 0
    this.proximoClose = 0
    this.cheios = 0
    this.acumulado = 0
    this.tempo = 0
    this.ativo = false
    this.gravando = true
  }

  limparBuffers() {
    this.texturas = this.fontes.map(() => []) // DynamicTexture por quadro, criadas aos poucos
    this.closes = this.fontes.map(() => []) // [fonte][coração][slot] as do close (buffer menor)
    this.donosClose = this.fontes.map(() => []) // o registro que usa cada textura de close (para tirar o close dele quando ela for reaproveitada)
  }

  // A textura do quadro `slot` da fonte k (criada na primeira volta do buffer)
  textura(k, slot) {
    const lista = this.texturas[k]
    if (lista[slot]) return lista[slot]
    const { largura, altura } = this.tamanhos[k]
    const dt = this.cena.textures.addDynamicTexture(`${this.prefixo}-${k}-${slot}`, largura, altura)
    if (!dt) return null
    dt.setFilter(Phaser.Textures.FilterMode.LINEAR)
    const campo = this.fontes[k].campo
    dt.camera.setOrigin(0, 0).setZoom(GRAVACAO.escala).setScroll(campo.esquerda, campo.topo)
    lista[slot] = dt
    return dt
  }

  texturaClose(k, i, slot) {
    const lista = (this.closes[k][i] ??= [])
    if (lista[slot]) return lista[slot]
    const { largura, altura, escala } = GRAVACAO.close
    const dt = this.cena.textures.addDynamicTexture(`${this.prefixo}-close-${k}-${i}-${slot}`, Math.round(largura * escala), Math.round(altura * escala))
    if (!dt) return null
    dt.setFilter(Phaser.Textures.FilterMode.LINEAR)
    dt.camera.setOrigin(0, 0).setZoom(escala)
    lista[slot] = dt
    return dt
  }

  atualizar(dt, ativo) {
    if (!this.gravando) return
    if (!ativo) {
      this.ativo = false
      return
    }
    if (!this.ativo) {
      // nova esquiva (ou duelo): o replay é só desta rodada
      this.ativo = true
      this.cheios = 0
      this.proximo = 0
      this.acumulado = GRAVACAO.quadroMs // já tira a primeira foto
      this.tempo = 0
    }
    this.tempo += dt
    this.acumulado += dt
    if (this.acumulado < GRAVACAO.quadroMs) return
    this.acumulado = Math.min(this.acumulado - GRAVACAO.quadroMs, GRAVACAO.quadroMs) // sem rajada depois de um engasgo
    this.capturar()
  }

  // Desenha em dt os objetos (já ordenados) e pinta de preto o que ficou
  // fora da caixa (l: limites da caixa; x0, y0: canto do mundo da foto; e: escala)
  fotografar(dt, objetos, l, x0, y0, e) {
    const W = dt.width
    const H = dt.height
    const cx0 = Phaser.Math.Clamp(Math.round((l.left - x0) * e), 0, W)
    const cx1 = Phaser.Math.Clamp(Math.round((l.right - x0) * e), 0, W)
    const cy0 = Phaser.Math.Clamp(Math.round((l.top - y0) * e), 0, H)
    const cy1 = Phaser.Math.Clamp(Math.round((l.bottom - y0) * e), 0, H)
    dt.clear()
    dt.fill(0x000000, 1)
    dt.draw(objetos)
    const pretos = [
      [0, 0, W, cy0],
      [0, cy1, W, H - cy1],
      [0, cy0, cx0, cy1 - cy0],
      [cx1, cy0, W - cx1, cy1 - cy0],
    ]
    for (const [x, y, w, h] of pretos) if (w > 0 && h > 0) dt.fill(0x000000, 1, x, y, w, h)
    dt.render()
  }

  capturar() {
    const slot = this.proximo
    const slotClose = this.proximoClose
    const quadro = { tempo: this.tempo, fontes: [] }
    this.fontes.forEach((fonte, k) => {
      const dt = fonte.visivel() ? this.textura(k, slot) : null
      if (!dt) return quadro.fontes.push(null)
      // na ordem de profundidade (sort estável), menos os corações
      const coracoes = fonte.coracoes()
      const sprites = new Set(coracoes.map((c) => c.sprite))
      const objetos = fonte
        .objetos()
        .filter((o) => !sprites.has(o))
        .sort((a, b) => a.depth - b.depth)
      const l = fonte.limites()
      this.fotografar(dt, objetos, l, fonte.campo.esquerda, fonte.campo.topo, GRAVACAO.escala)
      const estados = coracoes.map(({ sprite: s, x, y, ativo, cor, j }) => ({ x, y, ativo, visivel: Boolean(s?.visible), alpha: s?.alpha ?? 1, escala: s?.scaleX ?? 1, cor: s?.tintTopLeft ?? cor, j }))
      const registro = {
        chave: dt.key,
        caixa: { x: l.x, y: l.y, largura: l.width, altura: l.height },
        borda: fonte.borda(),
        coracoes: estados,
        closes: [],
      }
      // close em volta de cada coração
      estados.forEach((c, i) => {
        registro.closes[i] = null
        if (!c.ativo) return
        const tc = this.texturaClose(k, i, slotClose)
        if (!tc) return
        const { largura, altura, escala } = GRAVACAO.close
        const x = c.x - largura / 2
        const y = c.y - altura / 2
        tc.camera.setScroll(x, y)
        this.fotografar(tc, objetos, l, x, y, escala)
        const donos = (this.donosClose[k][i] ??= [])
        if (donos[slotClose]) donos[slotClose].closes[i] = null
        donos[slotClose] = registro
        registro.closes[i] = { chave: tc.key, x, y }
      })
      quadro.fontes.push(registro)
    })
    this.quadros[slot] = quadro
    this.proximo = (slot + 1) % this.total
    this.proximoClose = (slotClose + 1) % GRAVACAO.close.quadros
    this.cheios = Math.min(this.total, this.cheios + 1)
  }

  parar() {
    this.gravando = false
  }

  quadrosEmOrdem() {
    const n = this.cheios
    const inicio = (this.proximo - n + this.total) % this.total
    return Array.from({ length: n }, (_, i) => this.quadros[(inicio + i) % this.total]).filter(Boolean)
  }

  destruir() {
    this.gravando = false
    for (const lista of [...this.texturas, ...this.closes.flat()]) for (const dt of lista ?? []) if (dt) this.cena.textures.remove(dt)
    this.limparBuffers()
    this.quadros = []
    this.cheios = 0
  }
}
