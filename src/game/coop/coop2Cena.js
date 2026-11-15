// O lado da TELA do CO-OP 2.0 (as regras ficam em coop/coop2.js, coop/resgate.js e coop/regraChefe.js): o
// que a CoopArena e a CoopArenaN desenham igual. Tudo pequeno, legível e com UM conceito por vez.
//
//   criarPreviaIntencao(cena, { x, y })        a carta do chefe da PRÓXIMA rodada, menor e apagada
//   criarBarraQuebra(cena, { x, y, largura })  a barra de QUEBRA, embaixo do HP do chefe
//   criarVisualAlmas(cena, caixa)              as almas do resgate no quadro (com o anel de progresso)
//   finalizacaoEmDupla(cena, opcoes)           a cinemática da FINALIZAÇÃO EM DUPLA (Promise)
//   mostrarComoFunciona(cena, opcoes)          o cartão COMO FUNCIONA (a 1ª luta; A fecha) (Promise)
//   criarDicas(cena)                           .mostrar(id, texto): a dica de 1ª vez (uma por vez)
//   pontePhaserDaRegra(cena, caixa)            o desenho dos itens/zonas da regra do chefe
import { FONTE, TEXTO, CENTRO_X, LARGURA, corTexto } from '../constants.js'
import { SIMBOLOS } from '../entities/Carta.js'
import { ehSuper } from '../pvp/cartas.js'
import { TIPOS_CHEFE } from './cartasChefe.js'
import { DUPLAS } from './coop2.js'
import { umaVez, jaViu, marcarVisto } from './dicas.js'
import { semLigaduras } from '../campanha/texto.js'
import { ignorarNasCaixas } from '../recorte.js'
import { tocar } from '../audio.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { particulas } from '../effects/particulas.js'
import { numero } from '../effects/numero.js'

export const COR_QUEBRA = 0xffa23a
export const COR_ATORDOADO = 0xffe14a
const estilo = (tamanho, cor, extra = {}) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
const corDoNaipe = (naipe) => (naipe === 'copas' || naipe === 'ouros' ? '#ff6a80' : '#ffffff')

// ---------- prévia da intenção ----------

// A próxima carta do chefe (coop/regras.js previaCoop): mini carta virada com o naipe + "DEPOIS" e o nome,
// à esquerda da carta da rodada. mostrar(previa) / esconder() / destruir()
export function criarPreviaIntencao(cena, { x, y }) {
  const c = cena.add.container(x, y).setDepth(25).setAlpha(0)
  const fundo = cena.add.graphics()
  fundo.fillStyle(0x140f24, 0.92).fillRoundedRect(-11, -15, 22, 30, 4)
  fundo.lineStyle(1.5, 0x8a7ab0, 1).strokeRoundedRect(-11, -15, 22, 30, 4)
  const selo = cena.add.text(0, 0, '', estilo(13, '#ffffff')).setOrigin(0.5)
  const rotulo = cena.add.text(-16, -6, 'DEPOIS', estilo(7, '#a89cc8', { strokeThickness: 2 })).setOrigin(1, 0.5)
  const nome = cena.add.text(-16, 6, '', estilo(8, '#d8d0f0', { strokeThickness: 2, align: 'right' })).setOrigin(1, 0.5)
  c.add([fundo, selo, rotulo, nome])
  let visivel = false
  return {
    container: c,
    mostrar(previa) {
      if (!previa) return this.esconder()
      const t = previa.tipo
      if (t === 'super') {
        selo.setText('★').setColor('#ffd23c')
        nome.setText('SUPER DO CHEFE!').setColor('#ff8a6a')
      } else if (t === 'atordoado') {
        selo.setText('!').setColor(corTexto(COR_ATORDOADO))
        nome.setText('ATORDOADO: não ataca').setColor(corTexto(COR_ATORDOADO))
      } else if (t === 'oculta') {
        selo.setText('?').setColor('#d0b8ff')
        nome.setText('carta roubada?').setColor('#d0b8ff')
      } else {
        const carta = previa.carta
        selo.setText(ehSuper(carta) ? '★' : SIMBOLOS[carta.naipe]).setColor(corDoNaipe(carta.naipe))
        nome.setText(semLigaduras(`${TIPOS_CHEFE[carta.naipe] ?? ''}: ${carta.nome}`)).setColor('#d8d0f0')
      }
      cena.tweens.killTweensOf(c)
      if (!visivel) c.setScale(0.6)
      visivel = true
      cena.tweens.add({ targets: c, alpha: 0.9, scale: 1, duration: 220, ease: 'Back.easeOut' })
    },
    esconder() {
      if (!visivel) return
      visivel = false
      cena.tweens.killTweensOf(c)
      cena.tweens.add({ targets: c, alpha: 0, duration: 150 })
    },
    destruir() {
      cena.tweens.killTweensOf(c)
      c.destroy()
    },
  }
}

// ---------- barra de quebra ----------

// Embaixo do HP do chefe: "QUEBRA" e a barra laranja; cheia vira "ATORDOADO!" piscando.
// atualizar(valor, max, { atordoado, animado }) · ganhou(pontos) (o +N subindo) · destruir()
export function criarBarraQuebra(cena, { x, y, largura = 100 }) {
  const bx = x - largura / 2
  const fundo = cena.add.rectangle(bx, y, largura, 5, 0x2a2030).setOrigin(0).setDepth(30).setStrokeStyle(1, 0x000000)
  const barra = cena.add.rectangle(bx, y, largura, 5, COR_QUEBRA).setOrigin(0).setDepth(31).setScale(0, 1)
  const brilho = cena.add.rectangle(bx, y, largura, 5, 0xffffff).setOrigin(0).setDepth(32).setAlpha(0)
  const rotulo = cena.add.text(bx - 4, y + 2.5, 'QUEBRA', estilo(7, corTexto(COR_QUEBRA), { strokeThickness: 2 })).setOrigin(1, 0.5).setDepth(31)
  const estado = { valor: 0, max: 100, atordoado: false }
  let pisca = null
  const objetos = [fundo, barra, brilho, rotulo]
  return {
    objetos,
    atualizar(valor, max, { atordoado = false, animado = true } = {}) {
      const f = Math.max(0, Math.min(1, max ? valor / max : 0))
      estado.valor = valor
      estado.max = max
      cena.tweens.killTweensOf(barra)
      if (animado) cena.tweens.add({ targets: barra, scaleX: f, duration: 380, ease: 'Cubic.easeOut' })
      else barra.setScale(f, 1)
      if (atordoado !== estado.atordoado) {
        estado.atordoado = atordoado
        pisca?.stop()
        pisca = null
        barra.setFillStyle(atordoado ? COR_ATORDOADO : COR_QUEBRA)
        rotulo.setText(atordoado ? 'ATORDOADO' : 'QUEBRA').setColor(corTexto(atordoado ? COR_ATORDOADO : COR_QUEBRA))
        if (atordoado) pisca = cena.tweens.add({ targets: brilho, alpha: { from: 0.7, to: 0 }, duration: 420, repeat: -1 })
        else brilho.setAlpha(0)
      }
    },
    // +N pequeno subindo da barra e um brilho
    ganhou(pontos) {
      if (!(pontos > 0)) return
      cena.tweens.add({ targets: brilho, alpha: { from: 0.8, to: 0 }, duration: 320 })
      const t = cena.add
        .text(bx + largura + 6, y + 2, `+${pontos}`, estilo(9, corTexto(COR_QUEBRA)))
        .setOrigin(0, 0.5)
        .setDepth(97)
      ignorarNasCaixas(cena, t)
      cena.tweens.add({ targets: t, y: y - 12, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() })
    },
    destruir() {
      pisca?.stop()
      objetos.forEach((o) => o.destroy())
    },
  }
}

// ---------- almas do resgate ----------

// As almas (coop/resgate.js) desenhadas DENTRO do quadro (recortadas pela câmera dele): um coraçãozinho
// fantasma na cor do caído, boiando, com o anel de progresso em volta e "AJUDA!" em cima.
// sincronizar(almas.lista, cores) todo frame · limpar()
export function criarVisualAlmas(cena, caixa) {
  const desenhos = new Map() // alvo -> { sprite, anel, texto }
  const apagar = (alvo) => {
    const d = desenhos.get(alvo)
    if (!d) return
    desenhos.delete(alvo)
    cena.tweens.killTweensOf(d.sprite)
    ;[d.sprite, d.anel, d.texto].forEach((o) => o.destroy())
  }
  return {
    sincronizar(lista, cores, raio = 18, tempoMs = 1000) {
      const vivas = new Set(lista.map((a) => a.alvo))
      for (const alvo of [...desenhos.keys()]) if (!vivas.has(alvo)) apagar(alvo)
      for (const alma of lista) {
        let d = desenhos.get(alma.alvo)
        const cor = cores[alma.alvo] ?? 0xffffff
        if (!d) {
          const sprite = cena.add.image(alma.x, alma.y, 'coracao').setTint(cor).setAlpha(0.55).setScale(1.1).setDepth(8)
          const anel = cena.add.graphics().setDepth(8)
          const texto = cena.add.text(alma.x, alma.y - 22, 'AJUDA!', estilo(8, corTexto(cor))).setOrigin(0.5).setDepth(8)
          caixa.recortar(sprite, anel, texto)
          cena.tweens.add({ targets: sprite, alpha: 0.3, duration: 420, yoyo: true, repeat: -1 })
          d = { sprite, anel, texto }
          desenhos.set(alma.alvo, d)
        }
        const boia = Math.sin((alma.idade ?? 0) / 260) * 2
        d.sprite.setPosition(alma.x, alma.y + boia)
        d.texto.setPosition(alma.x, alma.y - 22 + boia)
        const f = Math.min(1, alma.progresso / tempoMs)
        d.anel.clear()
        d.anel.lineStyle(2, 0xffffff, 0.35).strokeCircle(alma.x, alma.y, raio)
        if (f > 0) {
          d.anel.lineStyle(3, 0x7dff9a, 1)
          d.anel.beginPath()
          d.anel.arc(alma.x, alma.y, raio, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2, false)
          d.anel.strokePath()
        }
      }
    },
    limpar() {
      for (const alvo of [...desenhos.keys()]) apagar(alvo)
    },
  }
}

// ---------- finalização em dupla ----------

// A FINALIZAÇÃO EM DUPLA: cópias dos personagens de pé correm até o chefe, batem JUNTOS (cortes nas cores
// deles, clarão, tremor), o dano aparece grande e eles voltam. aoImpacto() aplica o dano (uma vez).
//   await finalizacaoEmDupla(cena, { personagens: [{ textura, x, y, flip, escala, cor }], chefe: { x, y },
//                                     dano, titulo, aoImpacto })
export async function finalizacaoEmDupla(cena, { personagens, chefe, dano, titulo = 'FINALIZAÇÃO EM DUPLA!', aoImpacto }) {
  const vivo = () => cena.sys?.isActive() && !cena.saindo
  const esperar = (ms) => new Promise((r) => cena.time.delayedCall(ms, r))
  const tween = (cfg) => new Promise((r) => cena.tweens.add({ ...cfg, onComplete: r }))
  const objetos = []
  const novo = (o) => {
    objetos.push(o)
    ignorarNasCaixas(cena, o)
    return o
  }
  tocar(cena, 'superAtivar')
  flashTela(cena, COR_ATORDOADO, 0.3, 240)
  const faixa = novo(cena.add.rectangle(CENTRO_X, 236, LARGURA, 56, 0x000000, 0.6).setDepth(94).setScale(1, 0))
  const texto = novo(cena.add.text(CENTRO_X, 236, semLigaduras(titulo), estilo(26, corTexto(COR_ATORDOADO), { strokeThickness: 5 })).setOrigin(0.5).setDepth(96).setScale(0.4))
  cena.tweens.add({ targets: faixa, scaleY: 1, duration: 180 })
  await tween({ targets: texto, scale: 1, duration: 260, ease: 'Back.easeOut' })
  await esperar(450)
  if (!vivo()) return limpar()
  cena.tweens.add({ targets: [faixa, texto], alpha: 0, duration: 200 })
  // as cópias correm até o chefe, em leque
  const n = personagens.length
  const copias = personagens.map((p, k) => {
    const s = novo(cena.add.image(p.x, p.y, p.textura).setScale(p.escala ?? 2.5).setFlipX(Boolean(p.flip)).setDepth(60))
    const dx = n === 1 ? 0 : (k / (n - 1) - 0.5) * 120
    return { s, p, destino: { x: chefe.x + dx, y: chefe.y + 34 } }
  })
  tocar(cena, 'voo')
  await Promise.all(copias.map(({ s, destino }, k) => tween({ targets: s, x: destino.x, y: destino.y, duration: 300, delay: k * 50, ease: 'Cubic.easeIn' })))
  if (!vivo()) return limpar()
  // o golpe junto: um corte de cada um, cruzando no chefe
  const cortes = novo(cena.add.graphics().setDepth(62))
  copias.forEach(({ p }, k) => {
    const ang = -0.9 + (k / Math.max(1, n - 1)) * 1.8
    const r = 70
    cortes.lineStyle(6, p.cor ?? 0xffffff, 1)
    cortes.lineBetween(chefe.x - Math.cos(ang) * r, chefe.y - Math.sin(ang) * r, chefe.x + Math.cos(ang) * r, chefe.y + Math.sin(ang) * r)
    particulas(cena, chefe.x, chefe.y, { cor: p.cor ?? 0xffffff, quantidade: 26, velocidade: 300, vida: 700, escala: 1.5 })
  })
  tocar(cena, 'estouro')
  flashTela(cena, 0xffffff, 0.6, 260)
  shake(cena, 420, 0.024)
  aoImpacto?.()
  numero(cena, chefe.x, chefe.y - 50, `${dano}!!`, corTexto(COR_ATORDOADO), { tamanho: 34 })
  cena.tweens.add({ targets: cortes, alpha: 0, duration: 500 })
  await esperar(650)
  if (!vivo()) return limpar()
  await Promise.all(copias.map(({ s, p }) => tween({ targets: s, x: p.x, y: p.y, alpha: 0, duration: 320, ease: 'Cubic.easeOut' })))
  limpar()

  function limpar() {
    for (const o of objetos) {
      cena.tweens.killTweensOf(o)
      o.destroy()
    }
    objetos.length = 0
  }
}

// ---------- como funciona ----------

export const LINHAS_COMO_FUNCIONA = [
  ['QUEBRA', COR_QUEBRA, 'Batam juntos e acertem CRÍTICOS: barra cheia deixa o chefe ATORDOADO.'],
  ['RESGATE', 0x7dff9a, 'Caiu? Vira uma alma: o parceiro encosta nela por 1 s e te levanta.'],
  ['DUPLAS', 0x7fd8ff, `${DUPLAS.pinca.simbolos} PINÇA, ${DUPLAS.barreira.simbolos} BARREIRA, mesmo naipe COMBO.`],
]

// O cartão da primeira luta (dicas.js 'comoFunciona'): 3 linhas, some com A ou sozinho em `maxMs`.
// `aoA(fn)` liga o botão A (a arena chama fn quando alguém aperta A). Promise
export function mostrarComoFunciona(cena, { aoA, maxMs = 9000, forcar = false } = {}) {
  if (!forcar && jaViu('comoFunciona')) return Promise.resolve(false)
  marcarVisto('comoFunciona')
  return new Promise((resolver) => {
    const objetos = []
    const novo = (o) => {
      objetos.push(o)
      ignorarNasCaixas(cena, o)
      return o.setDepth(99)
    }
    const W = 460
    const H = 156
    const y0 = 226
    const g = novo(cena.add.graphics())
    g.fillStyle(0x0b0816, 0.96).fillRoundedRect(CENTRO_X - W / 2, y0 - H / 2, W, H, 10)
    g.lineStyle(3, 0xffe14a, 1).strokeRoundedRect(CENTRO_X - W / 2, y0 - H / 2, W, H, 10)
    novo(cena.add.text(CENTRO_X, y0 - H / 2 + 16, 'CO-OP: COMO FUNCIONA', estilo(14, TEXTO.selecionado)).setOrigin(0.5))
    LINHAS_COMO_FUNCIONA.forEach(([titulo, cor, texto], k) => {
      const y = y0 - 26 + k * 32
      novo(cena.add.text(CENTRO_X - W / 2 + 16, y, titulo, estilo(10, corTexto(cor))).setOrigin(0, 0.5))
      novo(cena.add.text(CENTRO_X - W / 2 + 92, y, semLigaduras(texto), estilo(9, '#ffffff', { strokeThickness: 2, wordWrap: { width: W - 104 } })).setOrigin(0, 0.5))
    })
    const botao = novo(cena.add.text(CENTRO_X, y0 + H / 2 - 14, 'A: ENTENDI', estilo(10, '#ffe14a')).setOrigin(0.5))
    cena.tweens.add({ targets: botao, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 })
    let fechado = false
    const fechar = () => {
      if (fechado) return
      fechado = true
      desligar?.()
      for (const o of objetos) {
        cena.tweens.killTweensOf(o)
        o.destroy()
      }
      tocar(cena, 'cartaDeslizar')
      resolver(true)
    }
    const desligar = aoA?.(fechar)
    cena.time.delayedCall(maxMs, fechar)
    cena.events.once('shutdown', fechar)
  })
}

// ---------- dicas de 1ª vez ----------

// A dica que aparece só a PRIMEIRA vez que a coisa acontece neste PC (dicas.js), uma por vez (a próxima
// espera a da tela sumir). mostrar(id, texto, { x, y }) -> true se mostrou (ou entrou na fila)
export function criarDicas(cena) {
  const fila = []
  let ocupado = false
  const proxima = () => {
    const d = fila.shift()
    if (!d || !cena.sys?.isActive()) {
      ocupado = false
      return
    }
    ocupado = true
    const t = cena.add
      .text(d.x, d.y, semLigaduras(d.texto), estilo(10, '#ffffff', { backgroundColor: '#2a1f4add', padding: { x: 8, y: 5 }, strokeThickness: 2, align: 'center', wordWrap: { width: 230 } }))
      .setOrigin(0.5)
      .setDepth(98)
      .setAlpha(0)
    ignorarNasCaixas(cena, t)
    tocar(cena, 'energia')
    cena.tweens.add({ targets: t, alpha: 1, duration: 200 })
    cena.tweens.add({ targets: t, alpha: 0, delay: d.ms, duration: 300, onComplete: () => (t.destroy(), proxima()) })
  }
  return {
    // (padrão: à direita do chefe, no alto: o balão de fala dele fica à esquerda)
    mostrar(id, texto, { x = LARGURA - 215, y = 150, ms = 2800 } = {}) {
      if (!umaVez(id)) return false
      fila.push({ texto, x, y, ms })
      if (!ocupado) proxima()
      return true
    },
  }
}

// ---------- regra do chefe: o desenho ----------

// O desenho dos itens e zonas da regra (coop/regraChefe.js), recortados pelo quadro
export function pontePhaserDaRegra(cena, caixa) {
  return {
    desenharItem(item) {
      const g = cena.add.graphics().setDepth(7).setPosition(item.x, item.y)
      const r = item.raio
      g.fillStyle(item.cor, 1)
      if (item.forma === 'estrela') {
        const pts = []
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5
          const rr = k % 2 ? r * 0.45 : r
          pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr })
        }
        g.fillPoints(pts, true)
      } else g.fillCircle(0, 0, r)
      g.lineStyle(1.5, 0x000000, 0.8).strokeCircle(0, 0, r + 2)
      caixa.recortar(g)
      cena.tweens.add({ targets: g, angle: 360, duration: 3000, repeat: -1 })
      const objs = [g]
      if (item.rotulo) {
        const t = cena.add.text(item.x, item.y - r - 8, semLigaduras(item.rotulo), estilo(8, '#ffffff')).setOrigin(0.5).setDepth(7)
        caixa.recortar(t)
        objs.push(t)
      }
      return objs
    },
    desenharZona(zona) {
      const r = cena.add.rectangle(zona.x, zona.y, zona.largura, zona.altura, zona.cor, zona.alpha).setDepth(6).setStrokeStyle(1, zona.cor, 0.8)
      caixa.recortar(r)
      return [r]
    },
    apagar(objs) {
      for (const o of objs ?? []) {
        cena.tweens.killTweensOf(o)
        if (o.scene) particulas(cena, o.x, o.y, { cor: 0xffe14a, quantidade: 8, velocidade: 90 })
        o.destroy()
      }
    },
  }
}
