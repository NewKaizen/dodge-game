import { definirAtaque } from './definir.js'
import { CORES } from '../constants.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'

// Caos Final: finalização em três fases, cada uma pedindo movimento o tempo todo.
//
//   1. Chuva de estrelas: estrelas entram de fora, pelo topo, miradas no
//      coração (sem linha de aviso nem estrela parada piscando: a entrada é o
//      aviso) e, ao bater na borda, estouram em fragmentos
//   2. Cruz do caos: duas lâminas cruzadas giram em volta do centro da caixa
//      (o único aviso grande que sobrou: as duas linhas, curto, antes de elas
//      aparecerem). O giro inverte em tempos sorteados (as lâminas piscam
//      antes) e o núcleo dispara tiros mirados (ele incha um instante antes de
//      cada tiro, sem linha). Numa caixa com lado < 150 px fica uma lâmina só
//   3. Colapso: um anel um pouco maior que a caixa, com um vão do lado do
//      coração, entra de fora e fecha no ponto onde o coração estava e explode
//      em fragmentos (sem círculo piscando: o anel fechando mostra o ponto).
//      Até `aneis` seguidos (um só numa caixa com lado < 150 px)
//
// Feito para caixas de pelo menos ~160x135 (caixaApertada de cartas.js cabe).
//
// Config (objetos parciais completam com o padrão):
//   duracao   tempo ativo total
//   fases     fração da duração de cada fase [estrelas, cruz, colapso]
//   estrelas  { intervalo, velocidade, raio, fora, espalhar, fragmentos, velocidadeFragmento }
//   cruz      { bracos (2 = cruz, 1 = uma lâmina; null = 1 só em caixa pequena), giro, espessura, aviso, inverte, avisoInverte, viradaMs, tiro, velocidadeTiro, carga }
//   colapso   { aneis, intervalo, quantidade, abertura, tempoFechar, fora, fragmentos, velocidade, raio }
//
// Nada de padrão fixo: intervalos, a variação do giro e a ordem saem dos sorteios com semente.
const PADRAO = {
  estrelas: { intervalo: 320, velocidade: 150, raio: 7, fora: 12, espalhar: 70, fragmentos: 3, velocidadeFragmento: 95 },
  cruz: { bracos: null, giro: 1.0, espessura: 10, aviso: 500, inverte: 1400, avisoInverte: 450, viradaMs: 300, tiro: 950, velocidadeTiro: 130, carga: 260 },
  colapso: { aneis: 2, intervalo: 700, quantidade: 22, abertura: 1.15, tempoFechar: 1200, fora: 14, fragmentos: 10, velocidade: 120, raio: 6 },
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

// a.depois repetido com o intervalo variando um pouco (±variacao): como a.aCada, sem ritmo fixo
function aCadaSorteado(a, ms, fn, atraso, variacao = 0.15) {
  let i = 0
  const disparar = () => {
    fn(i++)
    a.depois((ms / a.ritmo.densidade) * a.aleatorio(1 - variacao, 1 + variacao), disparar)
  }
  a.depois(atraso, disparar)
}

// ---------- fase 1: chuva de estrelas ----------

function faseEstrelas(a, cfg, ate) {
  let parar = false
  a.depois(ate, () => (parar = true))
  aCadaSorteado(
    a,
    cfg.intervalo,
    (i) => {
      if (parar) return
      const l = a.caixa
      const c = a.alvo()
      const x0 = limitar(c.x + a.aleatorio(-cfg.espalhar, cfg.espalhar), l.left + 12, l.right - 12)
      // nasce fora da caixa, acima da borda de cima
      const y0 = l.top - cfg.fora
      // sempre descendo: entre 25° e 155° (nada quase na horizontal)
      let dir = Math.atan2(Math.max(c.y - y0, 1), c.x - x0)
      dir = limitar(dir, 0.44, Math.PI - 0.44)
      const cos = Math.cos(dir)
      const sin = Math.sin(dir)
      const m = cfg.raio
      let estourou = false

      a.bala({
        x: x0,
        y: y0,
        vx: cos * cfg.velocidade,
        vy: sin * cfg.velocidade,
        raio: cfg.raio,
        forma: a.forma(i),
        jaAvisada: true,
        vida: 4000,
        girar: 6,
        atualizar: (b) => {
          // bateu na borda (lados ou chão): estoura em fragmentos que voltam para dentro, em leque
          const lim = a.caixa
          if (estourou || (b.x > lim.left + m && b.x < lim.right - m && b.y < lim.bottom - m)) return
          estourou = true
          b.morta = true
          if (cfg.fragmentos <= 0 || b.inofensiva || a.tempo > a.fim) return
          particulas(a.cena, b.x, b.y, { cor: a.cor(a.forma(i)), quantidade: 6, velocidade: 90 })
          const base = Math.atan2(lim.centerY - b.y, lim.centerX - b.x) + a.aleatorio(-0.2, 0.2)
          for (let k = 0; k < cfg.fragmentos; k++) {
            const ang = base + (k - (cfg.fragmentos - 1) / 2) * 0.6
            a.bala({
              x: b.x,
              y: b.y,
              vx: Math.cos(ang) * cfg.velocidadeFragmento,
              vy: Math.sin(ang) * cfg.velocidadeFragmento,
              raio: 5,
              forma: a.forma(i + k + 1),
              girar: 6,
              vida: 1400, // somem antes de atravessar a caixa toda (não sujam a fase seguinte)
              jaAvisada: true,
            })
          }
        },
      })
    },
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

  // inversões do giro (em tempos sorteados): as lâminas piscam e então viram
  aCadaSorteado(
    a,
    cfg.inverte,
    () => {
      if (!estado.ativa || estado.fim) return
      estado.piscando = true
      a.depois(cfg.avisoInverte, () => {
        estado.piscando = false
        estado.sentido = -estado.sentido
      })
    },
    cfg.aviso + Math.max(0, cfg.inverte - cfg.avisoInverte) * a.aleatorio(0.8, 1.2),
    0.25,
  )

  // o núcleo atira no coração: incha um instante (a carga) e dispara, sem linha de aviso
  aCadaSorteado(
    a,
    cfg.tiro,
    (i) => {
      if (!estado.ativa || estado.fim) return
      a.cena.tweens.add({ targets: nucleo, alpha: 0.4, duration: cfg.carga / 2, yoyo: true })
      a.depois(cfg.carga, () => {
        if (!estado.ativa || estado.fim) return
        const c = a.alvo()
        const dir = Math.atan2(c.y - cy, c.x - cx)
        tocar(a.cena, 'estalo')
        a.bala({
          x: cx + Math.cos(dir) * 10,
          y: cy + Math.sin(dir) * 10,
          vx: Math.cos(dir) * cfg.velocidadeTiro,
          vy: Math.sin(dir) * cfg.velocidadeTiro,
          raio: 6,
          forma: a.forma(i + 2),
          jaAvisada: true, // sai do núcleo, que está à vista e acabou de inchar
          girar: 5,
        })
      })
    },
    cfg.aviso + cfg.tiro * a.aleatorio(0.35, 0.65),
    0.2,
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
  // o anel nasce um pouco FORA da caixa e entra fechando
  const rx = l.width / 2 + cfg.fora
  const ry = l.height / 2 + cfg.fora
  // abertura medida no menor raio da elipse (no começo do fechamento); numa caixa pequena ela cresce
  const abertura = Math.max(cfg.abertura, (a.lacunaMinima + 2 * cfg.raio + 4) / Math.min(rx, ry))
  a.lacuna(abertura * Math.min(rx, ry) - 2 * cfg.raio, 'vão do colapso')

  // cabe quantos anéis na fase (o último ainda explode antes do fim, com 300 ms de folga)
  const ciclo = cfg.tempoFechar
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
      const fechar = cfg.tempoFechar * a.aleatorio(0.92, 1.08)
      const passo = (Math.PI * 2 - abertura) / (cfg.quantidade - 1)
      const s = fechar / 1000
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
          vida: fechar * 0.9,
          raio: cfg.raio,
          forma: a.forma(k + n),
          jaAvisada: true, // entra de fora: o anel fechando é o aviso
          girar: 3,
        })
      }

      // explode quando o anel chega no ponto de colapso
      a.depois(fechar, () => {
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
