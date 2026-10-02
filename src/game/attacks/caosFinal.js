import { definirAtaque } from './definir.js'
import { CORES } from '../constants.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'

// Caos Final: finalização em três fases, cada uma pedindo movimento o tempo todo.
//
//   1. Chuva de estrelas: estrelas saem do topo miradas no coração (linha de
//      aviso + estrela piscando) e, ao bater na borda, estouram em
//      fragmentos (o ponto de impacto pisca desde o disparo)
//   2. Cruz do caos: duas lâminas cruzadas giram em volta do centro da caixa
//      (aviso das duas linhas antes). O giro inverte de tempos em tempos (as
//      lâminas piscam antes) e o núcleo dispara tiros mirados. Numa caixa
//      com lado < 150 px fica uma lâmina só
//   3. Colapso: um anel do tamanho da caixa, com um vão do lado do coração,
//      fecha no ponto onde o coração estava e explode em fragmentos. Até
//      `aneis` seguidos (um só numa caixa com lado < 150 px)
//
// Feito para caixas de pelo menos ~160x135 (caixaApertada de cartas.js cabe).
//
// Config (objetos parciais completam com o padrão):
//   duracao   tempo ativo total
//   fases     fração da duração de cada fase [estrelas, cruz, colapso]
//   estrelas  { intervalo, velocidade, raio, aviso, espalhar, fragmentos, velocidadeFragmento }
//   cruz      { bracos (2 = cruz, 1 = uma lâmina; null = 1 só em caixa pequena), giro, espessura, aviso, inverte, avisoInverte, viradaMs, tiro, velocidadeTiro, avisoTiro }
//   colapso   { aneis, intervalo, quantidade, abertura, tempoFechar, aviso, fragmentos, velocidade, raio }
const PADRAO = {
  estrelas: { intervalo: 320, velocidade: 150, raio: 7, aviso: 450, espalhar: 70, fragmentos: 3, velocidadeFragmento: 95 },
  cruz: { bracos: null, giro: 1.0, espessura: 10, aviso: 650, inverte: 1400, avisoInverte: 450, viradaMs: 300, tiro: 950, velocidadeTiro: 130, avisoTiro: 450 },
  colapso: { aneis: 2, intervalo: 700, quantidade: 22, abertura: 1.15, tempoFechar: 1200, aviso: 550, fragmentos: 10, velocidade: 120, raio: 6 },
}

export default definirAtaque({
  nome: 'caosFinal',
  padrao: {
    duracao: 7000,
    fases: [0.3, 0.3, 0.4],
    estrelas: {},
    cruz: {},
    colapso: {},
  },
  iniciar(a, cfg) {
    const est = { ...PADRAO.estrelas, ...cfg.estrelas }
    const cruz = { ...PADRAO.cruz, ...cfg.cruz }
    const col = { ...PADRAO.colapso, ...cfg.colapso }
    const soma = cfg.fases.reduce((s, f) => s + f, 0)
    const dur = cfg.fases.map((f) => (cfg.duracao * f) / soma)
    const inicio2 = dur[0]
    const inicio3 = dur[0] + dur[1]

    faseEstrelas(a, est, Math.max(0, dur[0] - 700))
    a.depois(inicio2, () => faseCruz(a, cruz, dur[1]))
    a.depois(inicio3, () => faseColapso(a, col, dur[2]))
  },
})

// ---------- fase 1: chuva de estrelas ----------

function faseEstrelas(a, cfg, ate) {
  let parar = false
  a.depois(ate, () => (parar = true))
  a.aCada(
    cfg.intervalo,
    (i) => {
      if (parar) return
      const l = a.caixa
      const c = a.alvo()
      const x0 = limitar(c.x + a.aleatorio(-cfg.espalhar, cfg.espalhar), l.left + 12, l.right - 12)
      const y0 = l.top + 8
      // sempre descendo: entre 25° e 155° (nada quase na horizontal)
      let dir = Math.atan2(Math.max(c.y - y0, 1), c.x - x0)
      dir = limitar(dir, 0.44, Math.PI - 0.44)
      const cos = Math.cos(dir)
      const sin = Math.sin(dir)

      // ponto onde a estrela bate na borda da caixa
      const m = cfg.raio
      const tx = cos > 0 ? (l.right - m - x0) / cos : cos < 0 ? (l.left + m - x0) / cos : Infinity
      const ty = (l.bottom - m - y0) / sin
      const dist = Math.max(0, Math.min(tx, ty))
      const impacto = { x: x0 + cos * dist, y: y0 + sin * dist }
      const veloc = Math.min(cfg.velocidade * a.balas.fatorVelocidade, a.balas.velocidadeMax)
      const viagem = (dist / veloc) * 1000

      a.aviso({ tipo: 'linha', x1: x0, y1: y0, x2: x0 + cos * 46, y2: y0 + sin * 46, espessura: 2, ms: cfg.aviso })
      a.bala({
        x: x0,
        y: y0,
        vx: cos * cfg.velocidade,
        vy: sin * cfg.velocidade,
        raio: cfg.raio,
        forma: a.forma(i),
        aviso: cfg.aviso,
        vida: viagem,
        girar: 6,
      })

      if (cfg.fragmentos <= 0) return
      // o ponto de impacto pisca desde o disparo (aviso + viagem >= 450 ms)
      a.aviso({ tipo: 'circulo', x: impacto.x, y: impacto.y, raio: 16, ms: cfg.aviso + viagem }, () => {
        particulas(a.cena, impacto.x, impacto.y, { cor: a.cor(a.forma(i)), quantidade: 6, velocidade: 90 })
        // fragmentos voltam para dentro da caixa, em leque
        const base = Math.atan2(a.caixa.centerY - impacto.y, a.caixa.centerX - impacto.x)
        for (let k = 0; k < cfg.fragmentos; k++) {
          const ang = base + (k - (cfg.fragmentos - 1) / 2) * 0.6
          a.bala({
            x: impacto.x,
            y: impacto.y,
            vx: Math.cos(ang) * cfg.velocidadeFragmento,
            vy: Math.sin(ang) * cfg.velocidadeFragmento,
            raio: 5,
            forma: a.forma(i + k + 1),
            girar: 6,
            vida: 1400, // somem antes de atravessar a caixa toda (não sujam a fase seguinte)
            jaAvisada: true,
          })
        }
      })
    },
    Infinity,
    200,
  )
}

// ---------- fase 2: cruz do caos ----------

function faseCruz(a, cfg, duracao) {
  const l = a.caixa
  const cx = l.centerX
  const cy = l.centerY
  const raio = Math.hypot(l.width, l.height) / 2 + 8
  const angulo0 = Math.PI / 4 // começa em X
  // numa caixa pequena a cruz não deixa espaço: fica uma lâmina só
  const laminasN = cfg.bracos ?? (Math.min(l.width, l.height) < 150 ? 1 : 2)

  // cada quadrante tem que ter espaço para o coração no maior círculo que cabe na caixa
  const fatia = (Math.PI * 2) / (2 * laminasN)
  a.lacuna(fatia * (Math.min(l.width, l.height) / 2) - cfg.espessura, 'quadrante da cruz')
  tocar(a.cena, 'aviso')

  const nucleo = a.decoracao(a.cena.add.image(cx, cy, 'brilho').setTint(a.cor(a.forma(0))).setScale(0.5).setDepth(4))
  a.cena.tweens.add({ targets: nucleo, scale: 0.75, duration: 200, yoyo: true, repeat: -1 })

  const estado = { fase: 0, mult: 1, sentido: 1, piscando: false, ativa: false, fim: false }
  const laminas = []
  const corLamina = a.cor('barra')

  for (let k = 0; k < laminasN; k++) {
    const ang = angulo0 + (k * Math.PI) / 2
    a.aviso({
      tipo: 'linha',
      x1: cx - Math.cos(ang) * raio,
      y1: cy - Math.sin(ang) * raio,
      x2: cx + Math.cos(ang) * raio,
      y2: cy + Math.sin(ang) * raio,
      espessura: cfg.espessura,
      ms: cfg.aviso,
    })
  }

  a.depois(cfg.aviso, () => {
    if (estado.fim) return
    tocar(a.cena, 'laser')
    estado.ativa = true
    for (let k = 0; k < laminasN; k++) {
      const lamina = a.bala({
        x: cx,
        y: cy,
        comprimento: raio * 2,
        espessura: cfg.espessura,
        angulo: angulo0 + (k * Math.PI) / 2,
        forma: 'barra',
        atravessa: true,
        jaAvisada: true,
        pulso: 0,
        atualizar: (b, dt) => {
          // a primeira lâmina avança o giro compartilhado; as duas leem
          if (k === 0) {
            const fator = a.balas.fatorVelocidade
            const s = (dt / 1000) * fator
            const passo = (2 * s * 1000) / Math.max(1, cfg.viradaMs)
            estado.mult += limitar(estado.sentido - estado.mult, -passo, passo)
            // ponta da lâmina dentro do teto de velocidade
            const giro = Math.min(cfg.giro, (a.balas.velocidadeMax * 0.9) / (raio * fator))
            estado.fase += estado.mult * giro * s
          }
          b.angulo = angulo0 + (k * Math.PI) / 2 + estado.fase
          b.sprite.setTint(estado.piscando && Math.sin(b.idade / 45) > 0 ? CORES.aviso : corLamina)
        },
      })
      laminas.push(lamina)
    }
  })

  // inversões do giro: as lâminas piscam e então viram
  a.aCada(
    cfg.inverte,
    () => {
      if (!estado.ativa || estado.fim) return
      estado.piscando = true
      a.depois(cfg.avisoInverte, () => {
        estado.piscando = false
        estado.sentido = -estado.sentido
      })
    },
    Infinity,
    cfg.aviso + Math.max(0, cfg.inverte - cfg.avisoInverte),
  )

  // o núcleo atira no coração
  a.aCada(
    cfg.tiro,
    (i) => {
      if (!estado.ativa || estado.fim) return
      const c = a.alvo()
      const dir = Math.atan2(c.y - cy, c.x - cx)
      a.aviso({ tipo: 'linha', x1: cx, y1: cy, x2: cx + Math.cos(dir) * 50, y2: cy + Math.sin(dir) * 50, espessura: 2, ms: cfg.avisoTiro })
      a.bala({
        x: cx,
        y: cy,
        vx: Math.cos(dir) * cfg.velocidadeTiro,
        vy: Math.sin(dir) * cfg.velocidadeTiro,
        raio: 6,
        forma: a.forma(i + 2),
        aviso: cfg.avisoTiro,
        girar: 5,
      })
    },
    Infinity,
    cfg.aviso + cfg.tiro * 0.5,
  )

  // fim da fase: as lâminas se desfazem (inofensivas) antes do colapso
  a.depois(Math.max(cfg.aviso, duracao - 250), () => {
    estado.fim = true
    nucleo.setVisible(false)
    for (const b of laminas) {
      b.inofensiva = true
      b.vida = 220
      b.sprite.setAlpha(0.35)
    }
  })
}

// ---------- fase 3: colapso ----------

function faseColapso(a, cfg, duracao) {
  const l = a.caixa
  const rx = l.width / 2 - 8
  const ry = l.height / 2 - 8
  // abertura medida no menor raio da elipse (no começo do fechamento); numa caixa pequena ela cresce
  const abertura = Math.max(cfg.abertura, (a.lacunaMinima + 2 * cfg.raio + 4) / Math.min(rx, ry))
  a.lacuna(abertura * Math.min(rx, ry) - 2 * cfg.raio, 'vão do colapso')

  // cabe quantos anéis na fase (o último ainda explode antes do fim, com 300 ms de folga)
  const ciclo = cfg.aviso + cfg.tempoFechar
  const cabem = Math.max(1, Math.floor((duracao - ciclo - 300) / cfg.intervalo) + 1)
  // numa caixa pequena (lado < 150) dois anéis juntos não deixam espaço: fica um só
  const aneis = Math.min(cfg.aneis, cabem, Math.min(l.width, l.height) < 150 ? 1 : Infinity)

  for (let n = 0; n < aneis; n++) {
    a.depois(n * cfg.intervalo, () => {
      const { centerX: cx, centerY: cy } = a.caixa
      const c = a.alvo()
      // ponto de colapso: onde o coração está agora (sem colar na borda)
      const alvo = { x: limitar(c.x, l.left + 30, l.right - 30), y: limitar(c.y, l.top + 30, l.bottom - 30) }
      // o vão fica do lado do coração (com uma variação), para dar tempo de chegar nele
      const vao = Math.atan2(c.y - cy, c.x - cx) + a.aleatorio(-1.1, 1.1)
      const passo = (Math.PI * 2 - abertura) / (cfg.quantidade - 1)
      const s = cfg.tempoFechar / 1000
      tocar(a.cena, 'aviso')

      for (let k = 0; k < cfg.quantidade; k++) {
        const ang = vao + abertura / 2 + k * passo
        const x = cx + Math.cos(ang) * rx
        const y = cy + Math.sin(ang) * ry
        a.bala({
          x,
          y,
          vx: (alvo.x - x) / s,
          vy: (alvo.y - y) / s,
          vida: cfg.tempoFechar * 0.9,
          raio: cfg.raio,
          forma: a.forma(k + n),
          aviso: cfg.aviso,
          girar: 3,
        })
      }

      // o ponto de colapso pisca o tempo todo e explode quando o anel chega
      a.aviso({ tipo: 'circulo', x: alvo.x, y: alvo.y, raio: 24, ms: cfg.aviso + cfg.tempoFechar }, () => {
        tocar(a.cena, 'explosao')
        particulas(a.cena, alvo.x, alvo.y, { cor: 0xffc040, quantidade: 18, velocidade: 170 })
        const giro = a.aleatorio(0, Math.PI * 2)
        for (let k = 0; k < cfg.fragmentos; k++) {
          const ang = giro + (k * Math.PI * 2) / cfg.fragmentos
          a.bala({
            x: alvo.x,
            y: alvo.y,
            vx: Math.cos(ang) * cfg.velocidade,
            vy: Math.sin(ang) * cfg.velocidade,
            raio: cfg.raio,
            forma: a.forma(k),
            girar: 6,
            jaAvisada: true,
          })
        }
      })
    })
  }
}

const limitar = (v, min, max) => Math.max(min, Math.min(max, v))
