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
//     nele (linha de aviso + bala parada piscando antes de sair)
//
// Config (as antigas continuam valendo):
//   aneis          [{ raio, quantidade, giro (rad/s, sinal = sentido) }]
//   vaos           balas que faltam em cada anel (o vão)
//   respira        amplitude da respiração (px)
//   periodo        ms de uma respiração completa
//   raioBala, aviso
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

    // ---------- balas dos anéis (nascem piscando, paradas) ----------
    const balas = []
    cfg.aneis.forEach((anel, k) => {
      const passo = (Math.PI * 2) / anel.quantidade
      for (let j = cfg.vaos; j < anel.quantidade; j++) {
        const ang0 = j * passo + k * 0.5
        const forma = a.forma(j + k)
        const b = a.bala({
          x: centro.x + Math.cos(ang0) * anel.raio,
          y: centro.y + Math.sin(ang0) * anel.raio,
          raio: rb,
          forma,
          aviso: cfg.aviso,
          atravessa: true,
          girar: 3,
        })
        balas.push({ b, anel, ang0, cor: a.cor(forma) })
      }
    })

    // ---------- estado compartilhado (anda no relógio do ataque) ----------
    // fase: ângulo acumulado (rad por unidade de giro); mult vai de +1 a -1 nas viradas
    const estado = { t: 0, fase: 0, mult: 1, sentido: 1, ativo: false, piscando: false, desfeito: false }
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
      // só começa a girar quando as balas param de piscar (o aviso é no relógio das balas)
      if (!estado.ativo) {
        if (!balas.length || !a.balas.perigosa(balas[0].b)) return
        estado.ativo = true
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
        b.sprite.setTint(pisca ? CORES.aviso : item.cor)
      }
    })

    // alvo da perseguição (alterna entre os corações, como a.alvo())
    if (cfg.persegue > 0) a.aCada(700, () => (alvo = a.alvo()), Infinity, 0)

    // inversões do giro: pisca na cor de aviso e então vira
    if (cfg.inverte > 0) {
      a.aCada(
        cfg.inverte,
        () => {
          estado.piscando = true
          a.depois(cfg.avisoInverte, () => {
            estado.piscando = false
            estado.sentido = -estado.sentido
          })
        },
        Infinity,
        cfg.aviso + Math.max(0, cfg.inverte - cfg.avisoInverte),
      )
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
          for (const { b } of balas) {
            if (b.morta || b.inofensiva) continue
            const d = Math.hypot(b.x - c.x, b.y - c.y)
            if (d >= 60 && d < melhor && dentro(l, b.x, b.y, 6)) {
              melhor = d
              origem = { x: b.x, y: b.y }
            }
          }
          if (!origem) return
          const dir = Math.atan2(c.y - origem.y, c.x - origem.x)
          a.aviso({
            tipo: 'linha',
            x1: origem.x,
            y1: origem.y,
            x2: origem.x + Math.cos(dir) * 50,
            y2: origem.y + Math.sin(dir) * 50,
            espessura: 2,
            ms: cfg.avisoTiro,
          })
          a.bala({
            x: origem.x,
            y: origem.y,
            vx: Math.cos(dir) * cfg.velocidadeTiro,
            vy: Math.sin(dir) * cfg.velocidadeTiro,
            raio: cfg.raioTiro,
            forma: a.forma(i + 1),
            aviso: cfg.avisoTiro,
            girar: 5,
          })
        },
        Infinity,
        cfg.aviso + cfg.tiros,
      )
    }
  },
})

const dentro = (l, x, y, m) => x > l.left + m && x < l.right - m && y > l.top + m && y < l.bottom - m
