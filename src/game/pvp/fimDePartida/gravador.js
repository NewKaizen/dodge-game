import Phaser from 'phaser'

// Gravador do replay: buffer circular com os últimos GRAVACAO.segundos das
// duas pistas, em "fotos" de baixa resolução.
//
// Por que fotos (e não o estado das balas para redesenhar)? Os ataques criam
// de tudo dentro da caixa: balas, mas também Graphics, sprites próprios,
// containers, textos, partículas, filtros... Redesenhar a partir do estado
// exigiria saber copiar cada tipo. A foto pega exatamente o que a câmera
// da caixa mostrou, sem re-simular nada e sem depender do ataque. Ela é
// tirada com uma DynamicTexture por quadro (desenho na GPU, nada volta para
// a CPU: sem getImageData), a 30 quadros/s e GRAVACAO.escala do tamanho
// (~180x156 px por pista; 2 pistas x 96 quadros ≈ 11 MB de textura).
//
// Cada foto: fundo preto, os objetos que a câmera de recorte da pista
// desenharia (willRender), na ordem de profundidade, recortados no
// retângulo da caixa daquele quadro. O CORAÇÃO fica de fora da foto: vai
// só a posição, a cor, a escala e o pisca dele, e o replay desenha o
// sprite de verdade por cima (nítido no zoom e livre para se despedaçar).
// Junto vão o retângulo da caixa e a cor da borda (o replay desenha a moldura).
//
// CLOSE: dos últimos GRAVACAO.close.quadros sai também uma foto em
// resolução maior (GRAVACAO.close.escala) de uma janela em volta do
// coração: é a "câmera 2" do replay, o zoom dramático no golpe, sem o
// borrado da foto pequena ampliada. Quadros mais antigos perdem o close.
//
//   const g = new Gravador(cena, { pistas, campos })   campos: região de cada pista (CAMPOS da arena)
//   g.atualizar(dt, ativo)   todo frame (dt de jogo); ativo = esquiva rodando. Quando
//                            deixa de estar ativo, a próxima gravação recomeça do zero
//   g.parar()                congela o que foi gravado (o K.O.)
//   g.quadrosEmOrdem()       [{ tempo, pistas: [{ chave, caixa, borda, coracao, close } | null] }] do mais antigo ao mais novo
//                            coracao: { x, y, ativo, visivel, alpha, escala, cor } | null
//                            close:   { chave, x, y } (canto do mundo da janela) | null
//   g.destruir()             apaga as texturas
export const GRAVACAO = {
  quadroMs: 1000 / 30,
  segundos: 3.2,
  escala: 0.6,
  close: { quadros: 18, escala: 1.25, largura: 184, altura: 150 }, // janela em px de jogo em volta do coração
}

let geracao = 0 // chaves únicas por gravador (a revanche cria outro antes do anterior sumir)

export default class Gravador {
  constructor(cena, { pistas, campos }) {
    this.cena = cena
    this.pistas = pistas
    this.campos = campos
    this.prefixo = `fim-replay-${++geracao}`
    this.total = Math.round((GRAVACAO.segundos * 1000) / GRAVACAO.quadroMs)
    const par = (v) => Math.ceil(v / 2) * 2
    this.largura = par((campos[0].direita - campos[0].esquerda) * GRAVACAO.escala)
    this.altura = par((campos[0].base - campos[0].topo) * GRAVACAO.escala)
    this.texturas = pistas.map(() => []) // DynamicTexture por quadro, criadas aos poucos
    this.closes = pistas.map(() => []) // idem, as do close (buffer menor)
    this.donosClose = pistas.map(() => []) // o quadro que usa cada textura de close (para tirar o close dele quando ela for reaproveitada)
    this.quadros = new Array(this.total)
    this.proximo = 0
    this.proximoClose = 0
    this.cheios = 0
    this.acumulado = 0
    this.tempo = 0
    this.ativo = false
    this.gravando = true
  }

  // A textura do quadro `slot` da pista k (criada na primeira volta do buffer)
  textura(k, slot) {
    const lista = this.texturas[k]
    if (lista[slot]) return lista[slot]
    const dt = this.cena.textures.addDynamicTexture(`${this.prefixo}-${k}-${slot}`, this.largura, this.altura)
    if (!dt) return null
    dt.setFilter(Phaser.Textures.FilterMode.LINEAR)
    const campo = this.campos[k]
    dt.camera.setOrigin(0, 0).setZoom(GRAVACAO.escala).setScroll(campo.esquerda, campo.topo)
    lista[slot] = dt
    return dt
  }

  texturaClose(k, slot) {
    const lista = this.closes[k]
    if (lista[slot]) return lista[slot]
    const { largura, altura, escala } = GRAVACAO.close
    const dt = this.cena.textures.addDynamicTexture(`${this.prefixo}-close-${k}-${slot}`, Math.round(largura * escala), Math.round(altura * escala))
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
      // nova esquiva: o replay é só desta rodada
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
    const lista = this.cena.children.list
    const quadro = { tempo: this.tempo, pistas: [] }
    this.pistas.forEach((pista, k) => {
      const cam = pista.caixa.camera
      const dt = pista.aberta && cam.visible ? this.textura(k, slot) : null
      if (!dt) return quadro.pistas.push(null)
      // o que a câmera da caixa desenharia, na ordem de profundidade (sort estável), menos o coração
      const coracoes = new Set(pista.coracoes.map((c) => c.sprite))
      const objetos = lista.filter((o) => !coracoes.has(o) && o.willRender?.(cam)).sort((a, b) => a.depth - b.depth)
      const campo = this.campos[k]
      const l = pista.caixa.limites
      this.fotografar(dt, objetos, l, campo.esquerda, campo.topo, GRAVACAO.escala)
      const c = pista.coracoes[0]
      const s = c?.sprite
      const coracao = c ? { x: c.x, y: c.y, ativo: c.ativo, visivel: Boolean(s?.visible), alpha: s?.alpha ?? 1, escala: s?.scaleX ?? 1, cor: s?.tintTopLeft ?? c.cor } : null
      // close em volta do coração
      let close = null
      if (coracao?.ativo) {
        const tc = this.texturaClose(k, slotClose)
        if (tc) {
          const { largura, altura, escala } = GRAVACAO.close
          const x = coracao.x - largura / 2
          const y = coracao.y - altura / 2
          tc.camera.setScroll(x, y)
          this.fotografar(tc, objetos, l, x, y, escala)
          const antigo = this.donosClose[k][slotClose]
          if (antigo) antigo.close = null
          close = { chave: tc.key, x, y }
        }
      }
      const registro = {
        chave: dt.key,
        caixa: { x: l.x, y: l.y, largura: l.width, altura: l.height },
        borda: pista.caixa.retangulo.strokeColor,
        coracao,
        close,
      }
      if (close) this.donosClose[k][slotClose] = registro
      quadro.pistas.push(registro)
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
    for (const lista of [...this.texturas, ...this.closes]) for (const dt of lista) if (dt) this.cena.textures.remove(dt)
    this.texturas = this.pistas.map(() => [])
    this.closes = this.pistas.map(() => [])
    this.donosClose = this.pistas.map(() => [])
    this.quadros = []
    this.cheios = 0
  }
}
