import { PASSO_MS } from '../../passoFixo.js'

// GRAVADOR DO REPLAY em DADOS (docs/desempenho.md "Fase 4"). Antes eram fotos: cada quadro da caixa
// desenhado numa textura (~11 MB de texturas e ~6 ms por quadro a 8x de CPU, por isso só gravava perto
// de um K.O.: o antigo limiar.js). Agora a esquiva anda em tiques fixos (passoFixo.js) e o ataque sai
// igual da mesma semente, então basta gravar o que NÃO vem da semente, tique a tique:
//
//   o começo     o ataque (o mesmo objeto) e as opções do rodar() (dano, ritmo, SEMENTE, aceleração,
//                mira) e a caixa naquele instante
//   cada passo   o tique, o dt, a caixa no começo do passo (eventos de bônus mexem nela), a velocidade do
//                coração e o teto/fator das balas (idem), a pista congelada e, de cada coração, a posição
//                DEPOIS de andar (a entrada do jogador já aplicada: joystick, controles invertidos, CPU,
//                gravidade...), a hitbox e o desenho (visível, alpha, escala, cor)
//   os acertos   (passo, coração, número da bala no ataque) de cada acerto que CONTOU: escudo, 2ª chance e
//                i-frames já decididos pelas regras
//
// São ~30 números por passo (Array simples), sempre ligado: o custo é zero perto das fotos. O replay
// (ressimulacao.js) monta uma pista de mentira com as mesmas opções e refaz o ataque a partir do começo,
// com os corações nas posições gravadas: as balas, avisos, lasers e decorações saem os mesmos, tique a tique.
//
// O que a semente não refaz (o que os eventos de bônus e a arena desenham dentro da caixa) vira UMA foto
// do ambiente no instante do K.O. (fotoDoAmbiente): o fundo parado por baixo (e por cima) do ataque refeito.
// Os objetos da simulação da pista são marcados (o.daSimulacao) quando nascem dentro de Pista.simulando().
//
// O DUELO (bônus) não é uma pista: a caixa do duelo grava, a 30 quadros/s, só o ESTADO de desenho dos seus
// objetos (imagens e comandos dos Graphics) e dos corações, nos últimos GRAVACAO.segundos (GravacaoDuelo).
//
//   const g = new Gravador(arena, { pistas, campos, duelo })   duelo: a fonte do duelo (index.js fonteDuelo)
//   g.atualizarDuelo(dt)       todo quadro (dt de jogo): a foto de dados do duelo, se ele está lutando
//   g.parar(validas)           o K.O.: congela tudo; validas(k) diz que pistas valem (a esquiva desta rodada)
//   g.quadros(alvos)           [{ tempo, pistas: [registro | null] }] dos últimos GRAVACAO.segundos, um por
//                              tique; registro = { caixa, borda, coracao, close, outros } (o que a TV lê)
//   g.fonte(k)                 a fonte k ({ tipo: 'pista' | 'duelo', ... }) para montar o renderizador
//   g.destruir()
export const GRAVACAO = {
  quadroMs: 1000 / 30, // a unidade de tempo das fases da TV (transmissao.js)
  segundos: 3.2,
  escala: 0.6, // a imagem aberta da TV (a mesma resolução das fotos de antes)
  close: { escala: 1.25, largura: 184, altura: 150 }, // janela em px de jogo em volta do coração
  duelo: { quadroMs: 1000 / 30 },
}

// layout de um passo no Array: cabeçalho + POR_CORACAO por coração
export const PASSO = { tique: 0, dt: 1, congelada: 2, velocidade: 3, fator: 4, teto: 5, lx: 6, ly: 7, lw: 8, lh: 9, borda: 10, cabecalho: 11 }
export const CORACAO_G = { x: 0, y: 1, ativo: 2, hitbox: 3, graze: 4, visivel: 5, alpha: 6, escala: 7, cor: 8, tamanho: 9 }

// marca o que nasce na cena enquanto alguma pista simula (Pista.simulando)
function instalarMarcador(cena, gravacoes) {
  const aoEntrar = (o) => {
    for (const g of gravacoes) if (g.dentro > 0) return void (o.daSimulacao = true)
  }
  cena.events.on('addedtoscene', aoEntrar)
  return () => cena.events.off('addedtoscene', aoEntrar)
}

// A gravação de UMA pista (pista.gravacao): o trecho do ataque desta rodada
export class GravacaoPista {
  constructor(cena) {
    this.cena = cena
    this.trecho = null
    this.dentro = 0 // > 0: a pista está simulando (o que nasce agora é da simulação)
    this.parada = false
    this.atual = -1 // o passo em andamento (os acertos dele entram), -1 = não grava
    this.l = [0, 0, 0, 0]
  }

  comecar(pista, ataque, opcoes) {
    if (this.parada) return
    const l = pista.caixa.limites
    this.trecho = {
      ataque,
      opcoes: { ...opcoes, ritmo: { ...(opcoes.ritmo ?? {}) } },
      caixa: [l.x, l.y, l.width, l.height],
      coracoes: pista.coracoes.length,
      tamanho: PASSO.cabecalho + CORACAO_G.tamanho * pista.coracoes.length,
      dados: [],
      passos: 0,
      acertos: new Set(),
    }
    this.atual = -1
  }

  // a caixa no começo do passo (antes dos corações andarem)
  limites(pista) {
    const l = pista.caixa.limites
    const v = this.l
    v[0] = l.x
    v[1] = l.y
    v[2] = l.width
    v[3] = l.height
  }

  passo(pista, dt, velocidade) {
    const t = this.trecho
    if (!t || this.parada) {
      this.atual = -1
      return
    }
    const d = t.dados
    const l = this.l
    d.push(this.cena.passoFixo?.tiques ?? 0, dt, pista.congelada ? 1 : 0, velocidade, pista.balas.fatorVelocidade, pista.balas.velocidadeMax, l[0], l[1], l[2], l[3], pista.caixa.retangulo.strokeColor)
    for (const c of pista.coracoes) {
      const s = c.sprite
      d.push(c.x, c.y, c.ativo ? 1 : 0, c.hitbox, c.graze, s?.visible ? 1 : 0, s?.alpha ?? 1, s?.scaleX ?? 1, s?.tintTopLeft ?? c.cor)
    }
    this.atual = t.passos++
  }

  // um acerto que contou (o K.O. para a gravação dentro do acerto: o passo dele ainda entra)
  acerto(pista, coracao, bala) {
    const t = this.trecho
    if (!t || this.atual < 0 || bala.numero === undefined) return
    t.acertos.add(chaveAcerto(this.atual, pista.coracoes.indexOf(coracao), bala.numero))
  }

  parar() {
    this.parada = true
  }

  // o tique do passo i
  tique(i) {
    return this.trecho.dados[i * this.trecho.tamanho]
  }

  // registro de desenho do passo i (o que a TV lê), coração `foco` em destaque
  registro(i, foco = 0) {
    const t = this.trecho
    const d = t.dados
    const o = i * t.tamanho
    const coracoes = []
    for (let k = 0; k < t.coracoes; k++) {
      const c = o + PASSO.cabecalho + k * CORACAO_G.tamanho
      coracoes.push({ x: d[c], y: d[c + 1], ativo: d[c + 2] === 1, visivel: d[c + 5] === 1, alpha: d[c + 6], escala: d[c + 7], cor: d[c + 8], j: k })
    }
    const coracao = coracoes[foco] ?? null
    return {
      passo: i,
      caixa: { x: d[o + PASSO.lx], y: d[o + PASSO.ly], largura: d[o + PASSO.lw], altura: d[o + PASSO.lh] },
      borda: d[o + PASSO.borda],
      coracao,
      close: Boolean(coracao?.ativo),
      outros: coracoes.filter((_, n) => n !== foco),
    }
  }
}

export const chaveAcerto = (passo, coracao, numero) => `${passo}:${coracao}:${numero}`

// O DUELO: o estado de desenho dos objetos da caixa (imagens e Graphics) e dos corações, a 30/s, num anel
export class GravacaoDuelo {
  constructor(fonte) {
    this.fonte = fonte
    this.total = Math.ceil((GRAVACAO.segundos * 1000) / GRAVACAO.duelo.quadroMs) + 1
    this.quadros = []
    this.ativo = false
    this.parada = false
    this.tempo = 0
    this.acumulado = 0
    this.ids = new WeakMap()
    this.proximoId = 0
  }

  id(o) {
    let n = this.ids.get(o)
    if (n === undefined) this.ids.set(o, (n = ++this.proximoId))
    return n
  }

  atualizar(dt) {
    if (this.parada) return
    if (!this.fonte.gravando()) {
      this.ativo = false
      return
    }
    if (!this.ativo) {
      this.ativo = true
      this.quadros = []
      this.tempo = 0
      this.acumulado = GRAVACAO.duelo.quadroMs // já grava o primeiro
    }
    this.tempo += dt
    this.acumulado += dt
    if (this.acumulado < GRAVACAO.duelo.quadroMs) return
    this.acumulado = Math.min(this.acumulado - GRAVACAO.duelo.quadroMs, GRAVACAO.duelo.quadroMs)
    this.capturar()
  }

  capturar() {
    const f = this.fonte
    const coracoes = f.coracoes()
    const sprites = new Set(coracoes.map((c) => c.sprite))
    const objetos = []
    for (const o of f.objetos()) {
      if (sprites.has(o)) continue
      const base = { id: this.id(o), d: o.depth, x: o.x, y: o.y, r: o.rotation, sx: o.scaleX, sy: o.scaleY, a: o.alpha, b: o.blendMode }
      if (o.type === 'Graphics') objetos.push({ ...base, t: 'g', cmds: o.commandBuffer.slice() })
      else if ((o.type === 'Image' || o.type === 'Sprite') && o.texture?.key) objetos.push({ ...base, t: 'i', key: o.texture.key, frame: o.frame?.name, ox: o.originX, oy: o.originY, tint: o.tintTopLeft, tm: o.tintMode, fx: o.flipX, fy: o.flipY })
    }
    const l = f.limites()
    this.quadros.push({
      tempo: this.tempo,
      caixa: { x: l.x, y: l.y, largura: l.width, altura: l.height },
      borda: f.borda(),
      coracoes: coracoes.map(({ sprite: s, x, y, ativo, cor, j }) => ({ x, y, ativo, visivel: Boolean(s?.visible), alpha: s?.alpha ?? 1, escala: s?.scaleX ?? 1, cor: s?.tintTopLeft ?? cor, j })),
      objetos,
    })
    if (this.quadros.length > this.total) this.quadros.shift()
  }

  parar() {
    this.parada = true
  }
}

export default class Gravador {
  constructor(cena, { pistas, campos, duelo = null }) {
    this.cena = cena
    this.pistas = pistas
    this.gravacoes = pistas.map((pista) => (pista.gravacao = new GravacaoPista(cena)))
    this.campos = campos
    this.duelo = duelo ? new GravacaoDuelo(duelo) : null
    this.validas = pistas.map(() => false)
    this.ambiente = pistas.map(() => null)
    this.desligarMarcador = instalarMarcador(cena, this.gravacoes)
  }

  get kDuelo() {
    return this.pistas.length
  }

  atualizarDuelo(dt) {
    this.duelo?.atualizar(dt)
  }

  // o K.O.: congela; a foto do ambiente das pistas que valem (a esquiva desta rodada)
  parar(validas = () => true) {
    if (this.parado) return
    this.parado = true
    this.duelo?.parar()
    this.gravacoes.forEach((g, k) => {
      g.parar()
      this.validas[k] = Boolean(g.trecho?.passos) && validas(k)
      if (this.validas[k]) this.ambiente[k] = fotoDoAmbiente(this.cena, this.pistas[k], this.campos[k], k)
    })
  }

  // a fonte k para montar o renderizador do replay
  fonte(k) {
    if (k === this.kDuelo) return this.duelo?.quadros.length ? { tipo: 'duelo', gravacao: this.duelo, campo: this.duelo.fonte.campo } : null
    if (!this.validas[k]) return null
    return { tipo: 'pista', pista: this.pistas[k], gravacao: this.gravacoes[k], campo: this.campos[k], ambiente: this.ambiente[k] }
  }

  // Os quadros da TV: alvos = [{ k, i }] (fonte e o coração em destaque nela)
  quadros(alvos) {
    if (!alvos.length) return []
    if (alvos.some((m) => m.k === this.kDuelo)) {
      const qs = this.duelo?.quadros ?? []
      const vista = (q, i) => ({ caixa: q.caixa, borda: q.borda, coracao: q.coracoes[i] ?? null, close: Boolean(q.coracoes[i]?.ativo), outros: q.coracoes.filter((_, n) => n !== i), quadro: q })
      return qs.map((q) => ({ tempo: q.tempo, pistas: alvos.map((m) => (m.k === this.kDuelo ? vista(q, m.i) : null)) }))
    }
    // pistas: um quadro por tique (o último passo de cada tique), nos últimos GRAVACAO.segundos
    const fontes = alvos.map((m) => (this.validas[m.k] ? this.gravacoes[m.k] : null))
    const fim = Math.max(-Infinity, ...fontes.filter(Boolean).map((g) => g.tique(g.trecho.passos - 1)))
    if (!Number.isFinite(fim)) return []
    const inicio = fim - Math.round((GRAVACAO.segundos * 1000) / PASSO_MS)
    // por fonte, o último passo de cada tique da janela
    const porTique = new Map()
    fontes.forEach((g, n) => {
      if (!g) return
      for (let i = 0; i < g.trecho.passos; i++) {
        const tq = g.tique(i)
        if (tq < inicio) continue
        let linha = porTique.get(tq)
        if (!linha) porTique.set(tq, (linha = alvos.map(() => -1)))
        linha[n] = i
      }
    })
    const tiques = [...porTique.keys()].sort((a, b) => a - b)
    const ultimo = alvos.map(() => -1)
    return tiques.map((tq) => {
      const linha = porTique.get(tq)
      return {
        tempo: tq * PASSO_MS,
        pistas: alvos.map((m, n) => {
          if (linha[n] >= 0) ultimo[n] = linha[n]
          return ultimo[n] >= 0 ? fontes[n].registro(ultimo[n], m.i) : null
        }),
      }
    })
  }

  destruir() {
    this.desligarMarcador?.()
    this.desligarMarcador = null
    for (const a of this.ambiente) a?.destruir()
    this.ambiente = this.pistas.map(() => null)
    this.gravacoes.forEach((g, k) => {
      if (this.pistas[k]?.gravacao === g) this.pistas[k].gravacao = null
      g.trecho = null
    })
    if (this.duelo) this.duelo.quadros = []
  }
}

// ---------- a foto do ambiente (uma, no K.O.) ----------

let geracao = 0
export const PROFUNDIDADE_AMBIENTE = 5 // abaixo: por baixo do ataque refeito; dali para cima: por cima

// O que a câmera da caixa desenha e NÃO é da simulação da pista (eventos de bônus, enfeites da arena), em
// duas texturas: o que fica por baixo e o que fica por cima do ataque refeito. Na resolução do close.
function fotoDoAmbiente(cena, pista, campo, k) {
  const cam = pista.caixa.camera
  const coracoes = new Set(pista.coracoes.flatMap((c) => [c.sprite, c.anel, c.forma, c.tag, c.reticula]).filter(Boolean))
  // (sem os de mistura ADD e afins: numa textura transparente eles viram um quadrado escuro; são brilhos que
  // acompanham o coração, que a foto parada nem acertaria)
  const objetos = cena.children.list.filter((o) => !o.daSimulacao && !coracoes.has(o) && o !== pista.caixa.retangulo && !o.blendMode && o.willRender?.(cam))
  if (!objetos.length) return null
  const e = GRAVACAO.close.escala
  const largura = Math.ceil((campo.direita - campo.esquerda) * e)
  const altura = Math.ceil((campo.base - campo.topo) * e)
  const prefixo = `fim-ambiente-${++geracao}-${k}`
  const camadas = []
  for (const [nome, lista] of [
    ['abaixo', objetos.filter((o) => o.depth < PROFUNDIDADE_AMBIENTE)],
    ['acima', objetos.filter((o) => o.depth >= PROFUNDIDADE_AMBIENTE)],
  ]) {
    if (!lista.length) {
      camadas.push(null)
      continue
    }
    const dt = cena.textures.addDynamicTexture(`${prefixo}-${nome}`, largura, altura)
    if (!dt) {
      camadas.push(null)
      continue
    }
    dt.camera.setOrigin(0, 0).setZoom(e).setScroll(campo.esquerda, campo.topo)
    dt.draw(lista.sort((a, b) => a.depth - b.depth))
    dt.render()
    camadas.push(dt.key)
  }
  return {
    abaixo: camadas[0],
    acima: camadas[1],
    escala: e,
    destruir() {
      for (const chave of camadas) if (chave && cena.textures?.exists(chave)) cena.textures.remove(chave)
    },
  }
}
