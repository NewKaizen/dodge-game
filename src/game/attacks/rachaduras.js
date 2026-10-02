import { definirAtaque } from './definir.js'
import { ATAQUE, CORACAO } from '../constants.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'

// Chão Rachado. O chão da caixa racha a partir de um ponto colado no coração:
// `ramos` rachaduras em zigue-zague crescem para fora (cada trecho pisca antes,
// e o aviso vai "andando" do centro para as pontas) e depois o chão ERUPCIONA
// em espinhos ao longo das linhas, na mesma ordem. A cada `intervalo` nasce
// uma rachadura nova no lugar onde o coração está AGORA, então não dá para
// ficar parado: um dos ramos sempre passa por cima do coração.
//
// Com `fragmentos`, a ponta de cada ramo, ao erupcionar, cospe estilhaços em
// leque para fora (para longe do centro da rachadura).
//
// Justiça:
//   - todo trecho pisca pelo menos ATAQUE.telegrafoMs antes de machucar;
//   - os ramos saem bem espalhados (jitter pequeno no ângulo) e, antes de
//     rachar, procura um espaço livre de LACUNA_MINIMA ao alcance do coração
//     durante o aviso; se não achar, sorteia de novo e depois tira um ramo;
//   - uma rachadura por vez: quando uma nova erupciona, os espinhos que ainda
//     sobraram da anterior somem sem dano.
//
// Config:
//   ramos         rachaduras saindo de cada ponto
//   segmentos     trechos em zigue-zague por ramo
//   comprimento   tamanho de cada ramo (px)
//   espessura     largura dos espinhos (px)
//   desvio        distância do ponto de origem até o coração (px)
//   zigue         quanto cada trecho entorta (rad)
//   crescer       ms entre o aviso de um trecho e o do seguinte
//   aviso         ms de aviso de cada trecho (mínimo ATAQUE.telegrafoMs)
//   erupcao       ms que os espinhos ficam para fora
//   fragmentos    estilhaços por ponta de ramo (0 desliga)
//   velocidade    velocidade dos estilhaços (px/s)
//   leque         abertura do leque de estilhaços (rad)
//   raioFragmento, forma (espinhos), formaFragmento
export default definirAtaque({
  nome: 'rachaduras',
  padrao: {
    duracao: 5500,
    intervalo: 1150,
    ramos: 3,
    segmentos: 3,
    comprimento: 96,
    espessura: 10,
    desvio: 16,
    zigue: 0.35,
    crescer: 90,
    aviso: 650,
    erupcao: 380,
    fragmentos: 0,
    velocidade: 120,
    leque: 0.7,
    raioFragmento: 4,
    forma: 'barra',
    formaFragmento: null,
  },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const segmentos = Math.max(1, Math.round(cfg.segmentos))
    const espinhos = [] // { bala, geracao }

    // A rachadura inteira (todos os avisos) cabe antes do fim da onda? Conta as
    // pausas de respiro que ainda vêm pela frente (nelas os timers param).
    const cabe = (ms) => {
      let extra = 0
      const r = a.respiro
      if (r) {
        const rel = a.tempo - r.origem
        for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
      }
      return a.tempo + ms + extra <= a.fim
    }

    a.aCada(
      cfg.intervalo,
      (i) => {
        if (!cabe((segmentos - 1) * cfg.crescer + aviso)) return
        const geracao = i + 1
        const alvo = a.alvo()
        const ramos = planejar(a, cfg, alvo, segmentos, aviso)
        let primeira = true

        ramos.forEach((trechos, r) => {
          trechos.forEach((s, j) => {
            const ultimo = j === trechos.length - 1
            a.depois(j * cfg.crescer, () => {
              a.aviso({ tipo: 'linha', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, espessura: cfg.espessura, ms: aviso }, () => {
                if (primeira) {
                  primeira = false
                  // uma rachadura por vez: o que sobrou da anterior some sem dano
                  for (const e of espinhos) if (e.geracao < geracao && !e.bala.morta) desarmar(a, e.bala)
                  for (let k = espinhos.length - 1; k >= 0; k--) if (espinhos[k].bala.morta) espinhos.splice(k, 1)
                  tocar(a.cena, 'explosao')
                }
                erupcionar(a, cfg, s, geracao, espinhos, r + j)
                if (ultimo && cfg.fragmentos > 0) estilhacar(a, cfg, s, r)
              })
            })
          })
        })
      },
      Infinity,
      250,
    )
  },
})

// ---------- geometria ----------

const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

// Distância de um ponto a um trecho
function distTrecho(px, py, s) {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const t = limitar(((px - s.x1) * dx + (py - s.y1) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy))
}

// Corta o trecho (x, y) -> (x + dx, y + dy) na borda da caixa. Devolve a
// fração que cabe (1 = inteiro).
function caber(l, x, y, dx, dy) {
  let t = 1
  if (dx > 0) t = Math.min(t, (l.right - 1 - x) / dx)
  if (dx < 0) t = Math.min(t, (l.left + 1 - x) / dx)
  if (dy > 0) t = Math.min(t, (l.bottom - 1 - y) / dy)
  if (dy < 0) t = Math.min(t, (l.top + 1 - y) / dy)
  return Math.max(0, t)
}

// Sorteia os ramos (listas de trechos) a partir de um ponto colado no coração.
// O ramo 0 sai na direção do coração e passa por cima dele. Garante um espaço
// livre de LACUNA_MINIMA que o coração alcança durante o aviso.
function planejar(a, cfg, alvo, segmentos, aviso) {
  const l = a.caixa
  const margem = 6
  // até onde o coração chega durante o aviso (com folga)
  const alcance = ((CORACAO.velocidadePadrao * aviso) / 1000) * 0.8
  const folga = a.lacunaMinima / 2 + cfg.espessura / 2

  let melhor = null
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    // a cada 4 tentativas sem saída, um ramo a menos
    const ramos = Math.max(1, Math.round(cfg.ramos) - Math.floor(tentativa / 4))
    const giro = a.aleatorio(0, Math.PI * 2)
    const ox = limitar(alvo.x + Math.cos(giro) * cfg.desvio, l.left + margem, l.right - margem)
    const oy = limitar(alvo.y + Math.sin(giro) * cfg.desvio, l.top + margem, l.bottom - margem)
    // o ramo 0 aponta para o coração (se a origem caiu em cima dele, qualquer direção serve)
    const base = Math.hypot(alvo.x - ox, alvo.y - oy) > 1 ? Math.atan2(alvo.y - oy, alvo.x - ox) : giro
    const passo = (Math.PI * 2) / ramos
    const tamanho = cfg.comprimento / segmentos

    const lista = []
    for (let r = 0; r < ramos; r++) {
      // jitter pequeno: os ramos ficam bem espalhados (setores largos entre eles)
      let ang = base + r * passo + (r === 0 ? 0 : a.aleatorio(-0.15, 0.15) * passo)
      let x = ox
      let y = oy
      const trechos = []
      for (let j = 0; j < segmentos; j++) {
        // o primeiro trecho do ramo 0 vai reto no coração; o resto entorta
        if (r > 0 || j > 0) ang += a.aleatorio(-cfg.zigue, cfg.zigue)
        const dx = Math.cos(ang) * tamanho
        const dy = Math.sin(ang) * tamanho
        const f = caber(l, x, y, dx, dy)
        if (f * tamanho < 6) break // bateu na borda
        trechos.push({ x1: x, y1: y, x2: x + dx * f, y2: y + dy * f, ang })
        x += dx * f
        y += dy * f
        if (f < 1) break
      }
      if (trechos.length) lista.push(trechos)
    }

    const todos = lista.flat()
    const livre = espacoLivre(l, alvo, alcance, todos, a.lacunaMinima)
    if (!melhor || livre > melhor.livre) melhor = { lista, livre }
    if (livre >= folga) break
  }
  // maior círculo livre ao alcance, descontada a meia espessura dos espinhos
  a.lacuna(2 * (melhor.livre - cfg.espessura / 2), 'espaço livre perto da rachadura')
  return melhor.lista
}

// Maior folga (distância até o espinho mais próximo) entre os pontos da caixa
// ao alcance do coração, com espaço para um círculo de LACUNA_MINIMA dentro dela
function espacoLivre(l, alvo, alcance, trechos, lacuna) {
  const r = lacuna / 2
  let melhor = 0
  for (let y = l.top + r; y <= l.bottom - r; y += 6) {
    for (let x = l.left + r; x <= l.right - r; x += 6) {
      if (Math.hypot(x - alvo.x, y - alvo.y) > alcance) continue
      let d = Infinity
      for (const s of trechos) d = Math.min(d, distTrecho(x, y, s))
      if (d > melhor) melhor = d
    }
  }
  return melhor
}

// ---------- erupção ----------

function erupcionar(a, cfg, s, geracao, espinhos, i) {
  const comprimento = Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
  const cx = (s.x1 + s.x2) / 2
  const cy = (s.y1 + s.y2) / 2
  // marca escura da rachadura no chão enquanto os espinhos estão para fora
  const g = a.decoracao(a.cena.add.graphics().setDepth(3))
  g.lineStyle(3, 0x000000, 0.6)
  g.lineBetween(s.x1, s.y1, s.x2, s.y2)
  a.cena.tweens.add({ targets: g, alpha: 0, delay: cfg.erupcao, duration: 250 })
  if (i % 2 === 0) particulas(a.cena, cx, cy, { cor: a.cor(cfg.forma), quantidade: 5, velocidade: 90, vida: 300 })

  const bala = a.bala({
    x: cx,
    y: cy,
    comprimento: comprimento + 2, // cobre a emenda entre trechos
    espessura: cfg.espessura,
    angulo: s.ang,
    forma: cfg.forma,
    vida: cfg.erupcao,
    atravessa: true,
    jaAvisada: true,
    pulso: 0,
  })
  // os espinhos saem do chão: crescem rápido na espessura (só visual)
  const alvoY = bala.sprite.scaleY
  bala.sprite.scaleY = alvoY * 0.3
  a.cena.tweens.add({ targets: bala.sprite, scaleY: alvoY, duration: 90, ease: 'Back.Out' })
  espinhos.push({ bala, geracao })
}

// Estilhaços em leque saindo da ponta do ramo, para fora
function estilhacar(a, cfg, s, r) {
  const n = Math.round(cfg.fragmentos)
  for (let k = 0; k < n; k++) {
    const f = n > 1 ? k / (n - 1) - 0.5 : 0
    const ang = s.ang + f * cfg.leque
    a.bala({
      x: s.x2,
      y: s.y2,
      vx: Math.cos(ang) * cfg.velocidade,
      vy: Math.sin(ang) * cfg.velocidade,
      raio: cfg.raioFragmento,
      forma: cfg.formaFragmento ?? a.forma(r + k),
      girar: 7,
      jaAvisada: true, // nascem na ponta que acabou de piscar
    })
  }
}

// Espinho velho que ainda estava para fora quando a rachadura nova estourou
function desarmar(a, b) {
  b.inofensiva = true
  b.vida = Math.min(b.vida, 150)
  a.cena.tweens.killTweensOf(b.sprite)
  a.cena.tweens.add({ targets: b.sprite, alpha: 0, duration: 150 })
}
