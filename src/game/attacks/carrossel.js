import { definirAtaque } from './definir.js'
import { CORES } from '../constants.js'

// Carrossel: anéis de balas girando em volta de um centro, cada um com um
// vão. Ficar parado não funciona mais:
//   - os anéis "respiram" juntos com amplitude grande: a faixa segura entre
//     eles anda para dentro e para fora (a largura dela não muda). Quando
//     abrem, a faixa sai da caixa e o refúgio vira o miolo; quando fecham, o
//     miolo some e o refúgio volta a ser a faixa -> é preciso cruzar o anel
//     de dentro pelo vão, de tempos em tempos
//   - o giro INVERTE de sentido a cada `inverte` ms; antes da virada as balas
//     piscam na cor de aviso por `avisoInverte` ms e a virada é suave
//   - o centro do carrossel persegue devagar o coração (`persegue` px/s)
//   - de vez em quando a bala do anel mais perto do coração dispara um tiro
//     nele: ela pisca na cor de aviso (carregando) e o tiro sai dela, mirado
//     onde o coração estava quando ela começou a carregar (sem linha de mira)
//   - o carrossel se MONTA vindo de fora: cada bala nasce fora da caixa, na
//     reta do seu lugar, e voa até ele (translúcida e inofensiva) por `aviso`
//     ms; só então vale e começa a girar. Nada fica parado piscando
//   - nada é decorável: cada anel começa girado num ângulo sorteado e o tempo
//     entre as inversões varia (80% a 120% de `inverte`)
//
// Config (as antigas continuam valendo):
//   aneis          [{ raio, quantidade, giro (rad/s, sinal = sentido) }]
//   vaos           balas que faltam em cada anel (o vão)
//   respira        amplitude da respiração (px)
//   periodo        ms de uma respiração completa
//   raioBala
//   aviso          ms da montagem (as balas voando de fora até o anel)
//   inverte        ms entre inversões do giro (0 = nunca inverte)
//   avisoInverte   ms piscando antes de cada inversão
//   viradaMs       ms que o giro leva para trocar de sentido (suave)
//   persegue       px/s do centro indo atrás do coração (0 = centro fixo)
//   margemCentro   distância mínima do centro até a borda da caixa
//   tiros          ms entre tiros saindo dos anéis (0 = sem tiros)
//   velocidadeTiro, avisoTiro, raioTiro
//
// O giro é limitado para a ponta do anel não passar de a.balas.velocidadeMax
// (somando a respiração e a perseguição).
export default definirAtaque({
  nome: 'carrossel',
  padrao: {
    duracao: 6500,
    aneis: [
      { raio: 42, quantidade: 8, giro: 1.1 },
      { raio: 112, quantidade: 18, giro: -0.8 },
    ],
    vaos: 2,
    respira: 22,
    periodo: 3200,
    raioBala: 7,
    aviso: 600,
    inverte: 2600,
    avisoInverte: 450,
    viradaMs: 350,
    persegue: 22,
    margemCentro: 36,
    tiros: 1700,
    velocidadeTiro: 120,
    avisoTiro: 450,
    raioTiro: 6,
  },
  iniciar(a, cfg) {
    const l = a.caixa
    const rb = cfg.raioBala
    const centro = { x: l.centerX, y: l.centerY }
    let alvo = { x: centro.x, y: centro.y }

    // rotas de fuga. A faixa entre anéis tem largura constante (os anéis
    // respiram juntos); o vão de cada anel é medido entre as balas vizinhas
    // ((vaos + 1) passos) no raio médio. O miolo só é refúgio com os anéis
    // abertos, então vale o maior tamanho dele.
    for (let k = 1; k < cfg.aneis.length; k++) {
      a.lacuna(cfg.aneis[k].raio - cfg.aneis[k - 1].raio - 2 * rb, 'faixa entre anéis')
    }
    a.lacuna(2 * (cfg.aneis[0].raio + cfg.respira - rb), 'miolo aberto do carrossel')
    cfg.aneis.forEach((anel, k) => {
      const passo = (Math.PI * 2) / anel.quantidade
      a.lacuna((cfg.vaos + 1) * passo * anel.raio - 2 * rb, `vão do anel ${k + 1}`)
    })

    // ---------- balas dos anéis (nascem fora e voam até o lugar) ----------
    // raio (a partir do centro) em que a reta de ângulo `ang` sai da caixa
    const saida = (ang) => {
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      const tx = cos > 1e-6 ? (l.right - centro.x) / cos : cos < -1e-6 ? (l.left - centro.x) / cos : Infinity
      const ty = sin > 1e-6 ? (l.bottom - centro.y) / sin : sin < -1e-6 ? (l.top - centro.y) / sin : Infinity
      return Math.min(tx, ty)
    }
    const balas = []
    const coracoes = (a.coracoes ?? []).filter((c) => c.ativo)
    cfg.aneis.forEach((anel, k) => {
      const passo = (Math.PI * 2) / anel.quantidade
      // cada anel começa girado num ângulo sorteado; das tentativas, fica a que
      // não monta nenhuma bala em cima de um coração (a montagem não é armadilha)
      let giro0 = 0
      let melhor = -1
      for (let tentativa = 0; tentativa < 8 && melhor < 26; tentativa++) {
        const g = a.aleatorio(0, Math.PI * 2)
        let perto = Infinity
        for (let j = cfg.vaos; j < anel.quantidade; j++) {
          const x = centro.x + Math.cos(j * passo + g) * anel.raio
          const y = centro.y + Math.sin(j * passo + g) * anel.raio
          for (const c of coracoes) perto = Math.min(perto, Math.hypot(c.x - x, c.y - y))
        }
        if (perto > melhor) {
          melhor = perto
          giro0 = g
        }
      }
      for (let j = cfg.vaos; j < anel.quantidade; j++) {
        const ang0 = j * passo + giro0
        const forma = a.forma(j + k)
        // nasce logo fora da caixa (ou no próprio lugar, se ele já é fora)
        const r0 = Math.max(anel.raio, saida(ang0) + rb + 4)
        const b = a.bala({
          x: centro.x + Math.cos(ang0) * r0,
          y: centro.y + Math.sin(ang0) * r0,
          raio: rb,
          forma,
          jaAvisada: true,
          atravessa: true,
          girar: 3,
        })
        b.inofensiva = true // montagem: voa até o lugar sem machucar
        b.sprite.setAlpha(0.45)
        balas.push({ b, anel, ang0, r0, cor: a.cor(forma), carga: 0 })
      }
    })

    // ---------- estado compartilhado (anda no relógio do ataque) ----------
    // fase: ângulo acumulado (rad por unidade de giro); mult vai de +1 a -1 nas viradas
    const estado = { t: 0, fase: 0, mult: 1, sentido: 1, ativo: false, piscando: false, desfeito: false, montagem: 0 }
    const respiraVel = (cfg.respira * Math.PI * 2) / (cfg.periodo / 1000) // px/s radial máximo

    const desfazer = () => {
      // o carrossel some sozinho no fim da onda (numa sequência, não sobra anel parado no caminho)
      estado.desfeito = true
      for (const { b } of balas) {
        if (b.morta) continue
        b.inofensiva = true
        b.vida = 250
        b.sprite.setAlpha(0.35)
      }
    }

    a.aoAtualizar((dt, tempo) => {
      if (estado.desfeito) return
      if (Number.isFinite(a.fim) && tempo >= a.fim - 300) return desfazer()
      // montagem: as balas voam de fora até o lugar; só então valem e o carrossel gira
      if (!estado.ativo) {
        estado.montagem += dt
        const p = Math.min(1, estado.montagem / Math.max(1, cfg.aviso))
        const suave = 1 - (1 - p) ** 2 // chega freando
        for (const { b, anel, ang0, r0 } of balas) {
          if (b.morta) continue
          const r = r0 + (anel.raio - r0) * suave
          b.x = centro.x + Math.cos(ang0) * r
          b.y = centro.y + Math.sin(ang0) * r
        }
        if (p < 1) return
        for (const { b } of balas) {
          b.inofensiva = false
          b.sprite.setAlpha(1)
        }
        estado.ativo = true
        return
      }
      const fator = a.balas.fatorVelocidade
      const s = (dt / 1000) * fator
      estado.t += s

      // virada suave do giro
      const passoVirada = (2 * s * 1000) / Math.max(1, cfg.viradaMs)
      estado.mult += Math.max(-passoVirada, Math.min(passoVirada, estado.sentido - estado.mult))
      estado.fase += estado.mult * s

      // centro persegue o coração, sem sair do miolo da caixa
      if (cfg.persegue > 0) {
        const dx = alvo.x - centro.x
        const dy = alvo.y - centro.y
        const d = Math.hypot(dx, dy)
        const passo = Math.min(d, cfg.persegue * s)
        if (d > 0.5) {
          centro.x += (dx / d) * passo
          centro.y += (dy / d) * passo
        }
        const mx = Math.min(cfg.margemCentro, l.width / 2)
        const my = Math.min(cfg.margemCentro, l.height / 2)
        centro.x = Math.max(l.left + mx, Math.min(l.right - mx, centro.x))
        centro.y = Math.max(l.top + my, Math.min(l.bottom - my, centro.y))
      }

      // teto de velocidade: tangencial + respiração + perseguição <= velocidadeMax
      const vmax = a.balas.velocidadeMax
      const livre = Number.isFinite(vmax) ? Math.max(vmax * 0.3, vmax - respiraVel * fator - cfg.persegue * fator) : Infinity
      const onda = Math.sin((estado.t * 1000 * Math.PI * 2) / cfg.periodo) * cfg.respira
      const pisca = estado.piscando && Math.sin(tempo / 45) > 0

      for (const item of balas) {
        const { b, anel, ang0 } = item
        if (b.morta) continue
        const rMax = anel.raio + cfg.respira
        const giro = Math.sign(anel.giro) * Math.min(Math.abs(anel.giro), livre / Math.max(1, rMax * fator))
        const r = Math.max(rb, anel.raio + onda)
        const ang = ang0 + giro * estado.fase
        b.x = centro.x + Math.cos(ang) * r
        b.y = centro.y + Math.sin(ang) * r
        // a bala que vai atirar pisca enquanto carrega
        if (item.carga > 0) item.carga -= dt
        const carregando = item.carga > 0 && Math.sin(tempo / 40) > 0
        b.sprite.setTint(pisca || carregando ? CORES.aviso : item.cor)
      }
    })

    // alvo da perseguição (alterna entre os corações, como a.alvo())
    if (cfg.persegue > 0) a.aCada(700, () => (alvo = a.alvo()), Infinity, 0)

    // inversões do giro: pisca na cor de aviso e então vira. O tempo até a
    // próxima varia (80% a 120% de `inverte`): não dá para contar o ritmo
    if (cfg.inverte > 0) {
      const inverter = () => {
        if (estado.desfeito) return
        estado.piscando = true
        a.depois(cfg.avisoInverte, () => {
          estado.piscando = false
          estado.sentido = -estado.sentido
          a.depois(Math.max(cfg.avisoInverte + 200, cfg.inverte * a.aleatorio(0.8, 1.2) - cfg.avisoInverte), inverter)
        })
      }
      a.depois(cfg.aviso + Math.max(0, cfg.inverte * a.aleatorio(0.8, 1.2) - cfg.avisoInverte), inverter)
    }

    // tiros saindo do anel, na direção do coração
    if (cfg.tiros > 0) {
      a.aCada(
        cfg.tiros,
        (i) => {
          if (!estado.ativo || estado.desfeito) return
          const c = a.alvo()
          // bala do anel mais perto do coração, mas não em cima dele
          let origem = null
          let melhor = Infinity
          for (const item of balas) {
            const { b } = item
            if (b.morta || b.inofensiva) continue
            const d = Math.hypot(b.x - c.x, b.y - c.y)
            if (d >= 60 && d < melhor && dentro(l, b.x, b.y, 6)) {
              melhor = d
              origem = item
            }
          }
          if (!origem) return
          // a bala do anel pisca carregando (é o aviso) e então atira de onde
          // estiver, mirando onde o coração estava quando ela começou a carregar
          origem.carga = cfg.avisoTiro
          a.depois(cfg.avisoTiro, () => {
            const { b } = origem
            if (estado.desfeito || b.morta || b.inofensiva || !dentro(l, b.x, b.y, 6)) return
            if (Math.hypot(b.x - c.x, b.y - c.y) < 50) return // girou para perto demais do alvo: não atira
            const dir = Math.atan2(c.y - b.y, c.x - b.x)
            a.bala({
              x: b.x,
              y: b.y,
              vx: Math.cos(dir) * cfg.velocidadeTiro,
              vy: Math.sin(dir) * cfg.velocidadeTiro,
              raio: cfg.raioTiro,
              forma: a.forma(i + 1),
              jaAvisada: true, // a bala que atira piscou carregando
              girar: 5,
            })
          })
        },
        Infinity,
        cfg.aviso + cfg.tiros,
      )
    }
  },
})

const dentro = (l, x, y, m) => x > l.left + m && x < l.right - m && y > l.top + m && y < l.bottom - m
