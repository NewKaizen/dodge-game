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
// (~180x156 px por pista; 2 pistas x 96 quadros ≈ 11 MB de textura). O
// borrado da baixa resolução ainda ajuda o visual de fita VHS.
//
// Cada foto: fundo preto, os objetos que a câmera de recorte da pista
// desenharia (willRender), na ordem de profundidade, recortados no
// retângulo da caixa daquele quadro. Junto vai o retângulo da caixa, a cor
// da borda e a posição do coração (o replay desenha a moldura e marca o K.O.).
//
//   const g = new Gravador(cena, { pistas, campos })   campos: região de cada pista (CAMPOS da arena)
//   g.atualizar(dt, ativo)   todo frame (dt de jogo); ativo = esquiva rodando. Quando
//                            deixa de estar ativo, a próxima gravação recomeça do zero
//   g.parar()                congela o que foi gravado (o K.O.)
//   g.quadrosEmOrdem()       [{ tempo, pistas: [{ chave, caixa, borda, coracao } | null] }] do mais antigo ao mais novo
//   g.destruir()             apaga as texturas
export const GRAVACAO = { quadroMs: 1000 / 30, segundos: 3.2, escala: 0.6, faixas: 13 }

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
    this.quadros = new Array(this.total)
    this.proximo = 0
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
    const chave = `${this.prefixo}-${k}-${slot}`
    const dt = this.cena.textures.addDynamicTexture(chave, this.largura, this.altura)
    if (!dt) return null
    dt.setFilter(Phaser.Textures.FilterMode.LINEAR)
    const campo = this.campos[k]
    dt.camera.setOrigin(0, 0).setZoom(GRAVACAO.escala).setScroll(campo.esquerda, campo.topo)
    // faixas horizontais (o replay desloca cada uma: tremida/tracking da fita)
    const h = this.altura / GRAVACAO.faixas
    for (let f = 0; f < GRAVACAO.faixas; f++) {
      const y0 = Math.round(f * h)
      const y1 = Math.round((f + 1) * h)
      dt.add(`f${f}`, 0, 0, y0, this.largura, y1 - y0)
    }
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

  capturar() {
    const slot = this.proximo
    const lista = this.cena.children.list
    const e = GRAVACAO.escala
    const W = this.largura
    const H = this.altura
    const quadro = { tempo: this.tempo, pistas: [] }
    this.pistas.forEach((pista, k) => {
      const cam = pista.caixa.camera
      const dt = pista.aberta && cam.visible ? this.textura(k, slot) : null
      if (!dt) return quadro.pistas.push(null)
      // o que a câmera da caixa desenharia, na ordem de profundidade (sort estável)
      const objetos = lista.filter((o) => o.willRender?.(cam)).sort((a, b) => a.depth - b.depth)
      const campo = this.campos[k]
      const l = pista.caixa.limites
      const x0 = Phaser.Math.Clamp(Math.round((l.left - campo.esquerda) * e), 0, W)
      const x1 = Phaser.Math.Clamp(Math.round((l.right - campo.esquerda) * e), 0, W)
      const y0 = Phaser.Math.Clamp(Math.round((l.top - campo.topo) * e), 0, H)
      const y1 = Phaser.Math.Clamp(Math.round((l.bottom - campo.topo) * e), 0, H)
      dt.clear()
      dt.fill(0x000000, 1)
      dt.draw(objetos)
      // recorte da caixa: pinta de preto o que ficou fora dela
      const pretos = [
        [0, 0, W, y0],
        [0, y1, W, H - y1],
        [0, y0, x0, y1 - y0],
        [x1, y0, W - x1, y1 - y0],
      ]
      for (const [x, y, w, h] of pretos) if (w > 0 && h > 0) dt.fill(0x000000, 1, x, y, w, h)
      dt.render()
      const c = pista.coracoes[0]
      quadro.pistas.push({
        chave: dt.key,
        caixa: { x: l.x, y: l.y, largura: l.width, altura: l.height },
        borda: pista.caixa.retangulo.strokeColor,
        coracao: c ? { x: c.x, y: c.y, ativo: c.ativo } : null,
      })
    })
    this.quadros[slot] = quadro
    this.proximo = (slot + 1) % this.total
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
    for (const lista of this.texturas) for (const dt of lista) if (dt) this.cena.textures.remove(dt)
    this.texturas = this.pistas.map(() => [])
    this.quadros = []
    this.cheios = 0
  }
}
