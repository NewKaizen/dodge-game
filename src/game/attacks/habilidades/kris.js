// Ataques exclusivos das cartas de kris (uma entrada por ataque, com prefixo 'kris'):
//   krisExemplo: definirAtaque({ nome: 'krisExemplo', padrao: {...}, iniciar(a, cfg) {...} })
// As receitas de pvp/baralhos/kris.js chamam A.krisExemplo(...).
//
// Sprites e sons: hab-kris-* (pvp/habilidades/sprites/kris.js, gerados por
// scripts/habilidades/kris.py). Nada aqui usa o tabuleiro, o rastro de lâminas
// nem o eco do SUPER (attacks/super/kris.js).
import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

// ---------- ajudantes ----------

// O que dura `ms` de relógio do ataque cabe antes do fim da onda? (conta as
// pausas de respiro que ainda vêm pela frente, em que os timers ficam parados)
function cabe(a, ms) {
  let extra = 0
  const r = a.respiro
  if (r) {
    const rel = a.tempo - r.origem
    for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
  }
  return a.tempo + ms + extra <= a.fim
}

const emRespiro = (a) => Boolean(a.respiro && a.emRespiro(a.respiro))

function coracaoPerto(a, x, y) {
  let melhor = null
  let dist = Infinity
  for (const c of a.coracoes) {
    if (!c.ativo) continue
    const d = Math.hypot(c.x - x, c.y - y)
    if (d < dist) {
      dist = d
      melhor = c
    }
  }
  return melhor
}

// some aos poucos nos últimos `ms` de vida (já sem machucar)
function apagarNoFim(b, ms = 140) {
  if (b.vida < ms) {
    b.inofensiva = true
    b.sprite.setAlpha(Math.max(0, b.vida / ms))
  }
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

// Como a.aCada(ms, fn, Infinity, atraso), mas cada intervalo é sorteado em
// ms × [1 - variacao, 1 + variacao]: o ritmo nunca fica decorável. Respeita a
// densidade do ritmo como a.aCada (a média continua `ms`).
function aCadaSorteado(a, ms, fn, variacao = 0.25, atraso = null) {
  let i = 0
  const proximo = () => (ms / a.ritmo.densidade) * a.aleatorio(1 - variacao, 1 + variacao)
  const disparar = () => {
    fn(i++)
    a.depois(proximo(), disparar)
  }
  a.depois(atraso ?? proximo(), disparar)
}

// Lados da caixa e o que cada um precisa para nascer algo fora dele e entrar
const LADOS = ['esq', 'dir', 'cima', 'baixo']
const OPOSTO = { esq: 'dir', dir: 'esq', cima: 'baixo', baixo: 'cima' }
const VIZINHOS = { esq: ['cima', 'baixo'], dir: ['cima', 'baixo'], cima: ['esq', 'dir'], baixo: ['esq', 'dir'] }
// ponto `fora` px além da borda `lado`, na coordenada `pos` ao longo dela, e o rumo para dentro
function foraDaBorda(l, lado, pos, fora) {
  if (lado === 'esq') return { x: l.left - fora, y: pos, rumo: 0 }
  if (lado === 'dir') return { x: l.right + fora, y: pos, rumo: Math.PI }
  if (lado === 'cima') return { x: pos, y: l.top - fora, rumo: Math.PI / 2 }
  return { x: pos, y: l.bottom + fora, rumo: -Math.PI / 2 }
}
// a borda mais perto de um ponto (de onde algo "vem" quando mira ali)
function bordaPerto(l, p) {
  const d = { esq: p.x - l.left, dir: l.right - p.x, cima: p.y - l.top, baixo: l.bottom - p.y }
  return LADOS.reduce((m, k) => (d[k] < d[m] ? k : m))
}
const horizontal = (lado) => lado === 'esq' || lado === 'dir' // borda vertical: anda em y

// Velocidade suavizada de cada coração (para prever o caminho). Devolve
// velocidade(coracao) -> { vx, vy } em px/s.
function rastrearCoracoes(a) {
  const rastros = new Map()
  a.aoAtualizar((dt) => {
    for (const c of a.coracoes) {
      if (!c.ativo) continue
      const r = rastros.get(c) ?? { x: c.x, y: c.y, vx: 0, vy: 0 }
      const s = Math.max(1, dt) / 1000
      const k = Math.min(1, dt / 160)
      r.vx += ((c.x - r.x) / s - r.vx) * k
      r.vy += ((c.y - r.y) / s - r.vy) * k
      r.x = c.x
      r.y = c.y
      rastros.set(c, r)
    }
  })
  return (c) => rastros.get(c) ?? { vx: 0, vy: 0 }
}

export default {
  // ♠ Corte Firme: uma espada larga presa pelo cabo no meio da parede (do lado
  // do coração) gira meia volta e corta a meia-lua inteira de uma vez. A
  // meia-lua pisca antes (círculo cortado pela caixa) e a espada aparece
  // erguida, esperando. O lado oposto da caixa fica livre (>= LACUNA_MINIMA),
  // então quem fica parado no lado do coração leva. Nada fixo: às vezes o
  // corte vem do teto/chão (sorteado), o pivô escorrega um pouco pela parede
  // e o sentido do giro é sorteado a cada corte.
  //
  //   alcance    fração da caixa que a lâmina alcança (limitada pela rota de fuga)
  //   giro       ms da meia volta (antes do fator de velocidade)
  //   vertical   chance (0 a 1; true = 1/3) de o corte sair do teto ou do chão
  //   desvio     fração da parede que o pivô pode escorregar do meio
  krisCorteFirme: definirAtaque({
    nome: 'krisCorteFirme',
    padrao: { duracao: 5500, intervalo: 1300, aviso: 720, giro: 480, alcance: 0.56, espessura: 12, vertical: true, desvio: 0.18 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const chanceVertical = cfg.vertical === true ? 1 / 3 : Number(cfg.vertical) || 0
      let seguidasDeitado = 0 // garante um corte vertical de vez em quando

      const corte = () => {
        if (!cabe(a, aviso + 100)) return
        const l = a.caixa
        const alvo = a.alvo()
        const vertical = chanceVertical > 0 && (a.aleatorio(0, 1) < chanceVertical || seguidasDeitado >= 3)
        seguidasDeitado = vertical ? 0 : seguidasDeitado + 1
        const e = cfg.espessura
        let px, py, base // pivô e ângulo que aponta para dentro da caixa
        let ocupado
        const profundidade = vertical ? l.height : l.width
        const R = Math.min(profundidade * cfg.alcance, profundidade - a.lacunaMinima - e / 2 - 4)
        if (!vertical) {
          const esq = alvo.x < l.centerX
          px = esq ? l.left : l.right
          py = l.centerY + a.aleatorio(-cfg.desvio, cfg.desvio) * l.height
          base = esq ? 0 : Math.PI
          ocupado = esq ? [l.left, l.left + R + e / 2] : [l.right - R - e / 2, l.right]
        } else {
          const cima = alvo.y < l.centerY
          px = l.centerX + a.aleatorio(-cfg.desvio, cfg.desvio) * l.width
          py = cima ? l.top : l.bottom
          base = cima ? Math.PI / 2 : -Math.PI / 2
          ocupado = cima ? [l.top, l.top + R + e / 2] : [l.bottom - R - e / 2, l.bottom]
        }
        a.parede({ eixo: vertical ? 'y' : 'x', ocupados: [ocupado] })

        const sentido = a.escolher([1, -1])
        const ini = base - (sentido * Math.PI) / 2
        const ponto = (ang) => ({ x: px + (Math.cos(ang) * R) / 2, y: py + (Math.sin(ang) * R) / 2 })

        // a espada aparece erguida (rente à parede) enquanto a meia-lua pisca
        const p0 = ponto(ini)
        const erguida = a.decoracao(a.cena.add.image(p0.x, p0.y, 'hab-kris-espada').setDepth(5).setRotation(ini).setAlpha(0))
        erguida.setScale((R * 1.04) / erguida.width)
        a.cena.tweens.add({ targets: erguida, alpha: 0.6, duration: aviso * 0.6 })

        a.aviso({ tipo: 'circulo', x: px, y: py, raio: R + e / 2, ms: aviso }, () => {
          erguida.destroy()
          tocar(a.cena, 'hab-kris-corte')
          const giro = cfg.giro / Math.max(0.1, a.balas.fatorVelocidade)
          // o borrão da lâmina: uma fatia clara que vai atrás dela
          const borrao = a.decoracao(a.cena.add.graphics().setDepth(4))
          let acabou = false
          a.bala({
            x: p0.x,
            y: p0.y,
            comprimento: R,
            espessura: e,
            angulo: ini,
            textura: 'hab-kris-espada',
            tamanho: R * 1.04,
            jaAvisada: true,
            atravessa: true,
            pulso: 0,
            atualizar: (b) => {
              const p = Math.min(1, b.idade / giro)
              b.angulo = ini + sentido * Math.PI * p
              const q = ponto(b.angulo)
              b.x = q.x
              b.y = q.y
              borrao.clear()
              const cauda = ini + sentido * Math.PI * Math.max(0, p - 0.35)
              const [de, ate] = sentido > 0 ? [cauda, b.angulo] : [b.angulo, cauda]
              borrao.fillStyle(0xbfe0ff, 0.28)
              borrao.slice(px, py, R + e / 2, de, ate, false)
              borrao.fillPath()
              if (p >= 1 && !acabou) {
                acabou = true
                b.inofensiva = true
                b.vida = 180
                a.cena.tweens.add({ targets: [b.sprite, borrao], alpha: 0, duration: 170 })
              }
            },
          })
        })
      }

      aCadaSorteado(a, cfg.intervalo, corte, 0.2, 200)
    },
  }),

  // ♠ Estocada Dupla: um florete entra pela parede na fileira do coração, fica
  // cravado um instante, recua, MIRA DE NOVO (escorrega até a fileira nova,
  // com a linha piscando) e estoca outra vez. A ponta para em `alcance` da
  // caixa: o fundo do outro lado também é rota de fuga. A parede de cada
  // florete e o tempo entre eles são sorteados; nas cartas fortes dois ficam
  // ativos ao mesmo tempo.
  //
  //   alcance      fração da largura que a ponta alcança
  //   velocidade   px/s da estocada; recuo: px/s da volta
  //   segura       ms cravado antes de recuar
  //   avisoVolta   ms de aviso da segunda estocada (depois de escorregar `escorrega` ms)
  krisEstocadaDupla: definirAtaque({
    nome: 'krisEstocadaDupla',
    padrao: {
      duracao: 6000,
      intervalo: 1450,
      aviso: 520,
      avisoVolta: 430,
      escorrega: 200,
      velocidade: 600,
      recuo: 330,
      segura: 140,
      alcance: 0.66,
      comprimento: 150,
      espessura: 7,
    },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const avisoVolta = Math.max(ATAQUE.telegrafoMs, cfg.avisoVolta)
      const L = cfg.comprimento

      const florete = (daEsquerda) => {
        if (!cabe(a, aviso + 200)) return
        const l = a.caixa
        const dir = daEsquerda ? 1 : -1
        const parede = daEsquerda ? l.left : l.right
        const alcance = Math.min(l.width * cfg.alcance, l.width - a.lacunaMinima - 4)
        const fundo = parede + dir * alcance // onde a ponta para
        const espiando = parede + dir * 6 // ponta só aparecendo
        const fora = parede - dir * 12
        const fileira = (y) => limitar(y, l.top + cfg.espessura, l.bottom - cfg.espessura)
        const linha = (y, ms) => {
          a.parede({ eixo: 'x', ocupados: [daEsquerda ? [l.left, fundo] : [fundo, l.right]] })
          a.aviso({ tipo: 'linha', x1: parede, y1: y, x2: fundo, y2: y, espessura: cfg.espessura + 2, ms })
        }

        const y1 = fileira(a.alvo().y)
        linha(y1, aviso)
        let estado = 'mira'
        let relogio = 0
        let segunda = false
        let destinoY = y1
        let deY = y1
        a.bala({
          x: espiando - (dir * L) / 2,
          y: y1,
          comprimento: L,
          espessura: cfg.espessura,
          angulo: daEsquerda ? 0 : Math.PI,
          textura: 'hab-kris-florete',
          tamanho: L * 1.02,
          jaAvisada: true,
          atravessa: true,
          pulso: 0,
          vida: 9000,
          atualizar: (b, dt) => {
            const f = a.balas.fatorVelocidade
            const s = dt / 1000
            relogio += dt
            let ponta = b.x + (dir * L) / 2
            if (estado === 'mira') {
              b.inofensiva = true
              b.sprite.setAlpha(0.55)
              if (segunda) {
                const k = Math.min(1, relogio / cfg.escorrega)
                b.y = deY + (destinoY - deY) * k
              }
              if (relogio >= (segunda ? cfg.escorrega + avisoVolta : aviso)) {
                estado = 'estoca'
                relogio = 0
                b.inofensiva = false
                tocar(a.cena, 'hab-kris-estoque')
              }
            } else if (estado === 'estoca') {
              ponta += dir * cfg.velocidade * f * s
              if ((ponta - fundo) * dir >= 0) {
                ponta = fundo
                estado = 'segura'
                relogio = 0
                particulas(a.cena, ponta, b.y, { cor: 0xbfe0ff, quantidade: 4, velocidade: 70, vida: 220 })
              }
            } else if (estado === 'segura') {
              if (relogio >= cfg.segura) {
                estado = 'recua'
                relogio = 0
              }
            } else if (estado === 'recua') {
              const destino = segunda ? fora : espiando
              ponta -= dir * cfg.recuo * f * s
              if ((ponta - destino) * dir <= 0) {
                ponta = destino
                relogio = 0
                if (segunda) {
                  b.morta = true
                } else if (cabe(a, cfg.escorrega + avisoVolta) && !emRespiro(a)) {
                  // a segunda estocada: mira a fileira de agora
                  segunda = true
                  estado = 'mira'
                  deY = b.y
                  destinoY = fileira(a.alvo().y)
                  linha(destinoY, cfg.escorrega + avisoVolta)
                } else {
                  segunda = true
                  estado = 'recua'
                }
              }
            }
            b.x = ponta - (dir * L) / 2
          },
        })
      }

      // a parede de cada florete é sorteada (nada de esquerda, direita, esquerda...)
      aCadaSorteado(a, cfg.intervalo, () => florete(a.aleatorio(0, 1) < 0.5), 0.22, 200)
    },
  }),

  // ♦ Olhar Vazio: um olho vazio (contorno sem pupila) entra por uma borda
  // longe do coração (nasce fora da caixa) e vai atrás dele devagar (mais
  // devagar que o coração). Quanto tempo ele segue é sorteado. Quando
  // fixa o olhar, a pupila fica vermelha, a área em volta pisca e ele pisca
  // num clarão que solta faíscas (cílios) para os lados.
  //
  //   seguir      ms seguindo antes de fixar (± 20%, sorteado)
  //   velocidade  px/s com que o olho segue
  //   raio        raio do clarão
  //   cilios      faíscas soltas no clarão
  krisOlharVazio: definirAtaque({
    nome: 'krisOlharVazio',
    padrao: { duracao: 5000, intervalo: 1500, seguir: 1100, velocidade: 60, aviso: 600, raio: 20, cilios: 4, velocidadeCilio: 85 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)

      const olhar = () => {
        const seguir = cfg.seguir * a.aleatorio(0.8, 1.2)
        if (!cabe(a, seguir + aviso + 100)) return
        // entra pela borda mais perto de um ponto longe do coração, 12 px fora dela
        const l = a.caixa
        const longe = a.pontoLonge(75, 18)
        const lado = bordaPerto(l, longe)
        const p = foraDaBorda(l, lado, horizontal(lado) ? longe.y : longe.x, 12)
        let fixou = false
        const olho = a.bala({
          x: p.x,
          y: p.y,
          raio: 8,
          textura: 'hab-kris-olho',
          quadro: 0,
          tamanho: 28,
          jaAvisada: true,
          atravessa: true,
          pulso: 0.05,
          vida: seguir + aviso + 4000, // folga para os respiros; morre no clarão
          atualizar: (b, dt) => {
            b.inofensiva = true // o olho em si não machuca: só a piscada
            if (!fixou) b.sprite.setAlpha(0.95)
            if (fixou) return
            const c = coracaoPerto(a, b.x, b.y)
            if (c) {
              const d = Math.hypot(c.x - b.x, c.y - b.y)
              const passo = Math.min(d, cfg.velocidade * a.balas.fatorVelocidade * (dt / 1000))
              if (d > 0.5) {
                b.x += ((c.x - b.x) / d) * passo
                b.y += ((c.y - b.y) / d) * passo
              }
            }
            // só fixa depois de entrar na caixa (o clarão é sempre dentro dela)
            const dentro = b.x > l.left + 8 && b.x < l.right - 8 && b.y > l.top + 8 && b.y < l.bottom - 8
            if (b.idade >= seguir && dentro && !emRespiro(a)) fixar(b)
          },
        })
        olho.inofensiva = true
        const fixar = (b) => {
          fixou = true
          b.sprite.setFrame(1)
          b.sprite.setAlpha(1)
          a.aviso({ tipo: 'circulo', x: b.x, y: b.y, raio: cfg.raio, ms: aviso }, () => piscar(b))
        }
      }

      const piscar = (olho) => {
        olho.morta = true
        tocar(a.cena, 'hab-kris-olhar')
        a.bala({
          x: olho.x,
          y: olho.y,
          raio: cfg.raio,
          textura: 'hab-kris-clarao',
          tamanho: cfg.raio * 2.3,
          jaAvisada: true,
          atravessa: true,
          vida: 280,
          pulso: 0.15,
          atualizar: (b) => apagarNoFim(b, 120),
        })
        const giro = a.aleatorio(0, Math.PI * 2)
        for (let j = 0; j < cfg.cilios; j++) {
          const ang = giro + (j * Math.PI * 2) / cfg.cilios
          a.bala({
            x: olho.x + Math.cos(ang) * 6,
            y: olho.y + Math.sin(ang) * 6,
            vx: Math.cos(ang) * cfg.velocidadeCilio,
            vy: Math.sin(ang) * cfg.velocidadeCilio,
            raio: 4,
            textura: 'hab-kris-brilho',
            tamanho: 12,
            girar: 6,
            aviso: ATAQUE.telegrafoMs,
            vida: 3000,
          })
        }
      }

      aCadaSorteado(a, cfg.intervalo, olhar, 0.22, 150)
    },
  }),

  // ♦ Passo Calculado: Kris entra na caixa andando. Uma fileira de pegadas
  // (pé esquerdo, pé direito) nasce na borda (o primeiro passo é rente à
  // parede, vindo de fora) e caminha até onde o coração VAI estar, refazendo
  // a conta a cada passo: a fileira faz curva atrás de quem foge. Cada pegada
  // aparece no chão um instante antes e pisa com força; o último passo (no
  // ponto calculado, mais um além dele) é uma pisada maior que espirra
  // pedrinhas. Às vezes vêm dois caminhantes de bordas diferentes, e o
  // segundo mira onde o coração está agora (ficar parado é pisado). Correr em
  // linha reta também é pisado: mude de direção perto da pisada.
  //
  //   distancia     px entre duas pegadas; cadencia: ms entre elas (± 12%)
  //   maxPassos     pegadas no máximo por caminhada (a última é a pisada forte)
  //   antecipa      fração do tempo até a pisada usada para prever o coração
  //   dupla         chance de vir um segundo caminhante junto
  //   estilhacos    pedrinhas da pisada forte; velocidadeEstilhaco: px/s
  krisPassoCalculado: definirAtaque({
    nome: 'krisPassoCalculado',
    padrao: {
      duracao: 5000,
      intervalo: 1150,
      distancia: 26,
      cadencia: 180,
      aviso: 450,
      raio: 12,
      raioForte: 17,
      antecipa: 0.9,
      previsaoMax: 95,
      vida: 260,
      maxPassos: 7,
      dupla: 0.4,
      estilhacos: 4,
      velocidadeEstilhaco: 95,
    },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const velocidade = rastrearCoracoes(a)

      // onde o coração `c` vai estar daqui a `ms` (antecipa = 0: onde está agora)
      const previsto = (c, ms, antecipa) => {
        const l = a.caixa
        const m = cfg.raio + 4
        if (!c?.ativo) {
          const p = a.alvo()
          return { x: limitar(p.x, l.left + m, l.right - m), y: limitar(p.y, l.top + m, l.bottom - m) }
        }
        const r = velocidade(c)
        let px = r.vx * (ms / 1000) * antecipa
        let py = r.vy * (ms / 1000) * antecipa
        const prev = Math.hypot(px, py)
        if (prev > cfg.previsaoMax) {
          px *= cfg.previsaoMax / prev
          py *= cfg.previsaoMax / prev
        }
        return { x: limitar(c.x + px, l.left + m, l.right - m), y: limitar(c.y + py, l.top + m, l.bottom - m) }
      }

      // um caminhante: entra pela borda `lado` e anda até o coração `c`
      const caminhar = (c, lado, antecipa) => {
        const l = a.caixa
        const m = cfg.raio + 4
        const mira = previsto(c, aviso, antecipa)
        // primeiro passo rente à parede, perto da altura (ou coluna) do alvo
        const ao = horizontal(lado) ? limitar(mira.y + a.aleatorio(-40, 40), l.top + m, l.bottom - m) : limitar(mira.x + a.aleatorio(-40, 40), l.left + m, l.right - m)
        const borda = foraDaBorda(l, lado, ao, -m) // -m: m px para DENTRO da borda
        let pos = { x: borda.x, y: borda.y }
        let ang = borda.rumo
        let chegou = 0 // passos dados depois de alcançar o ponto calculado
        let k = 0
        const passo = () => {
          const forte = chegou >= 1 || k >= cfg.maxPassos - 1
          pisar(pos.x, pos.y, ang, k % 2 === 0 ? -1 : 1, forte)
          if (forte) return
          k++
          // refaz a conta: onde o coração vai estar quando a próxima pegada pisar
          const alvo = previsto(c, aviso + cfg.cadencia, antecipa)
          const dx = alvo.x - pos.x
          const dy = alvo.y - pos.y
          const d = Math.hypot(dx, dy)
          if (chegou || d < cfg.distancia * 0.6) {
            chegou++ // chegou ao ponto: mais um passo na mesma direção (a pisada forte)
          } else {
            // vira no máximo ~50° por passo (anda, não teleporta)
            let giro = Math.atan2(dy, dx) - ang
            giro = Math.atan2(Math.sin(giro), Math.cos(giro))
            ang += limitar(giro, -0.9, 0.9)
          }
          const andar = chegou ? cfg.distancia : Math.min(cfg.distancia, d)
          pos = { x: limitar(pos.x + Math.cos(ang) * andar, l.left + m, l.right - m), y: limitar(pos.y + Math.sin(ang) * andar, l.top + m, l.bottom - m) }
          a.depois(cfg.cadencia * a.aleatorio(0.88, 1.12), passo)
        }
        passo()
      }

      let vez = 0
      const caminhada = () => {
        if (!cabe(a, cfg.maxPassos * cfg.cadencia * 1.12 + aviso)) return
        const ativos = a.coracoes.filter((c) => c.ativo)
        const c = ativos[vez++ % Math.max(1, ativos.length)]
        const lado = a.escolher(LADOS)
        caminhar(c, lado, cfg.antecipa)
        if (a.aleatorio(0, 1) < cfg.dupla) {
          // o segundo vem de uma borda vizinha ou da oposta, mirando onde o coração está
          const outro = a.escolher([...VIZINHOS[lado], OPOSTO[lado]])
          a.depois(a.aleatorio(120, 380), () => caminhar(c, outro, 0))
        }
      }

      const pisar = (x, y, ang, lado, forte) => {
        const raio = forte ? cfg.raioForte : cfg.raio
        const pe = a.decoracao(a.cena.add.image(x, y, 'hab-kris-pegada').setDepth(4).setRotation(ang + Math.PI / 2).setAlpha(0).setFlipX(lado > 0))
        if (forte) pe.setScale(1.3)
        a.cena.tweens.add({ targets: pe, alpha: 0.9, duration: aviso * 0.7 })
        a.aviso({ tipo: 'circulo', x, y, raio, ms: aviso }, () => {
          tocar(a.cena, 'hab-kris-passo')
          a.cena.tweens.add({ targets: pe, alpha: 0, delay: 120, duration: 300 })
          a.bala({
            x,
            y,
            raio,
            textura: 'hab-kris-pisada',
            tamanho: raio * 2.2,
            jaAvisada: true,
            atravessa: true,
            vida: cfg.vida,
            pulso: 0.1,
            atualizar: (b) => apagarNoFim(b, 110),
          })
          if (!forte || !cfg.estilhacos) return
          // a pisada forte espirra pedrinhas (a pisada piscou antes: já valem)
          const giro = a.aleatorio(0, Math.PI * 2)
          for (let j = 0; j < cfg.estilhacos; j++) {
            const rumo = giro + (j * Math.PI * 2) / cfg.estilhacos + a.aleatorio(-0.25, 0.25)
            a.bala({
              x: x + Math.cos(rumo) * raio * 0.6,
              y: y + Math.sin(rumo) * raio * 0.6,
              vx: Math.cos(rumo) * cfg.velocidadeEstilhaco,
              vy: Math.sin(rumo) * cfg.velocidadeEstilhaco,
              raio: 3.5,
              textura: 'hab-kris-brilho',
              tamanho: 10,
              girar: 5,
              jaAvisada: true,
              vida: 2400,
            })
          }
        })
      }

      aCadaSorteado(a, cfg.intervalo, caminhada, 0.25, 200)
    },
  }),

  // ♦ Plano Tático: o plano de batalha fica na cabeça de Kris (nada é
  // riscado na caixa). Tropas de peões de xadrez entram marchando por fora da
  // borda e seguem a rota do plano: reto, ou dobrando uma esquina em L para um
  // lado sorteado. A primeira tropa de cada plano marcha pela fileira (ou
  // coluna) do coração; as outras saem de outros lugares, um pouco depois,
  // em tempos sorteados. O único aviso é a própria tropa chegando: quem vem
  // na frente mostra por onde as de trás vão passar.
  //
  //   setas       tropas por plano
  //   tropas      peões por tropa; espaco: px entre eles (± 15%)
  //   reto        chance de a rota não dobrar esquina
  //   escalona    [min, max] ms entre uma tropa e a seguinte do mesmo plano
  krisPlanoTatico: definirAtaque({
    nome: 'krisPlanoTatico',
    padrao: { duracao: 6000, intervalo: 1900, setas: 2, tropas: 3, espaco: 20, velocidade: 160, raio: 6, reto: 0.25, escalona: [180, 520] },
    iniciar(a, cfg) {
      // rota que passa por p; primeiro trecho na horizontal ('h') ou na vertical ('v').
      // Começa `fora` px além da borda e termina fora da caixa do outro lado.
      const rota = (p, primeiro) => {
        const l = a.caixa
        const m = 16
        const fora = a.aleatorio(12, 34)
        const sai = 20
        const dobra = a.aleatorio(0, 1) >= cfg.reto
        if (primeiro === 'h') {
          const daEsq = a.aleatorio(0, 1) < 0.5
          const sx = daEsq ? l.left - fora : l.right + fora
          const dir = daEsq ? 1 : -1
          if (!dobra) return [{ x: sx, y: p.y }, { x: daEsq ? l.right + sai : l.left - sai, y: p.y }]
          const limite = daEsq ? l.right - m : l.left + m
          const tx = (limite - p.x) * dir > 20 ? p.x + dir * a.aleatorio(20, Math.min(70, (limite - p.x) * dir)) : p.x
          // dobra mais para o lado maior da caixa, mas às vezes para o menor
          const desce = (p.y < l.centerY) === a.aleatorio(0, 1) < 0.75
          return [
            { x: sx, y: p.y },
            { x: tx, y: p.y },
            { x: tx, y: desce ? l.bottom + sai : l.top - sai },
          ]
        }
        const deCima = a.aleatorio(0, 1) < 0.5
        const sy = deCima ? l.top - fora : l.bottom + fora
        const dir = deCima ? 1 : -1
        if (!dobra) return [{ x: p.x, y: sy }, { x: p.x, y: deCima ? l.bottom + sai : l.top - sai }]
        const limite = deCima ? l.bottom - m : l.top + m
        const ty = (limite - p.y) * dir > 20 ? p.y + dir * a.aleatorio(20, Math.min(60, (limite - p.y) * dir)) : p.y
        const direita = (p.x < l.centerX) === a.aleatorio(0, 1) < 0.75
        return [
          { x: p.x, y: sy },
          { x: p.x, y: ty },
          { x: direita ? l.right + sai : l.left - sai, y: ty },
        ]
      }

      // uma tropa marcha pela rota (lista de pontos), um peão atrás do outro
      const tropa = (pontos) => {
        const trechos = []
        let total = 0
        for (let i = 1; i < pontos.length; i++) {
          const d = Math.hypot(pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y)
          trechos.push([pontos[i - 1], pontos[i], d])
          total += d
        }
        const em = (s) => {
          for (const [P0, P1, d] of trechos) {
            if (s <= d) {
              const k = s / Math.max(1, d)
              return { x: P0.x + (P1.x - P0.x) * k, y: P0.y + (P1.y - P0.y) * k }
            }
            s -= d
          }
          return { ...pontos[pontos.length - 1] }
        }
        const [A, B] = pontos
        const d0 = Math.max(1, trechos[0][2])
        const dir0 = { x: (B.x - A.x) / d0, y: (B.y - A.y) / d0 }

        let s = 0
        for (let j = 0; j < cfg.tropas; j++) {
          s -= j ? cfg.espaco * a.aleatorio(0.85, 1.15) : 0
          let sj = s
          a.bala({
            x: A.x + dir0.x * sj,
            y: A.y + dir0.y * sj,
            raio: cfg.raio,
            textura: 'hab-kris-peao',
            tamanho: 15,
            jaAvisada: true,
            pulso: 0,
            vida: 8000,
            atualizar: (b, dt) => {
              sj += cfg.velocidade * a.balas.fatorVelocidade * (dt / 1000)
              const q = sj < 0 ? { x: A.x + dir0.x * sj, y: A.y + dir0.y * sj } : em(sj)
              b.x = q.x
              // marcha: um pulinho a cada passo
              b.y = q.y - Math.abs(Math.sin(sj / 7)) * 2
              if (sj > total + 10) b.morta = true
            },
          })
        }
      }

      const plano = () => {
        if (!cabe(a, 600)) return
        const l = a.caixa
        let atraso = 0
        for (let k = 0; k < cfg.setas; k++) {
          const primeiro = a.escolher(['h', 'v'])
          if (k === 0) {
            tropa(rota(a.alvo(), primeiro))
            continue
          }
          atraso += a.aleatorio(cfg.escalona[0], cfg.escalona[1])
          // as outras tropas: ponto sorteado (o alvo é lido na hora em que elas saem)
          a.depois(atraso, () => {
            const p = a.aleatorio(0, 1) < 0.3 ? a.alvo() : { x: a.aleatorio(l.left + 20, l.right - 20), y: a.aleatorio(l.top + 20, l.bottom - 20) }
            tropa(rota(p, primeiro))
          })
        }
      }

      aCadaSorteado(a, cfg.intervalo, plano, 0.2, 200)
    },
  }),

  // ♦ Controle da Alma: a alma vermelha flutua na caixa, presa ao coração por
  // um fio, e bate: a cada batida solta um anel de cacos que se abre para
  // fora com UM vão. O vão nunca fica bem na direção do coração (fica um pouco
  // para um lado sorteado), então é preciso andar até ele (com os controles
  // invertidos da carta). A cada `porLugar` batidas a alma some e reaparece
  // longe; o tempo entre as batidas varia um pouco.
  //
  //   cacos     cacos por anel (antes de abrir o vão); vao: cacos tirados
  //   desvio    [min, max] rad entre a direção do coração e o meio do vão
  krisControleDaAlma: definirAtaque({
    nome: 'krisControleDaAlma',
    padrao: { duracao: 6000, intervalo: 1100, cacos: 16, vao: 3, velocidade: 80, raio: 5, porLugar: 2, desvio: [0.45, 0.95] },
    iniciar(a, cfg) {
      const l0 = a.caixa
      const alma = { x: l0.centerX, y: l0.centerY, visivel: false }
      const img = a.decoracao(a.cena.add.image(alma.x, alma.y, 'hab-kris-alma', 0).setDepth(6).setAlpha(0))
      const fio = a.decoracao(a.cena.add.graphics().setDepth(3))

      const mudar = () => {
        const p = a.pontoLonge(85, 22)
        alma.x = p.x
        alma.y = p.y
        a.cena.tweens.killTweensOf(img)
        img.setPosition(p.x, p.y).setScale(0.4).setAlpha(0)
        a.cena.tweens.add({ targets: img, alpha: 1, scale: 1, duration: 260, ease: 'Back.Out' })
        alma.visivel = true
      }

      // o fio vermelho da alma até o coração (só enfeite)
      a.aoAtualizar((dt, tempo) => {
        fio.clear()
        if (!alma.visivel) return
        const c = coracaoPerto(a, alma.x, alma.y)
        if (!c) return
        const ondula = Math.sin(tempo / 120) * 3
        const mx = (alma.x + c.x) / 2 + ondula
        const my = (alma.y + c.y) / 2 + 6
        fio.lineStyle(1, 0xff2438, 0.55)
        fio.beginPath()
        fio.moveTo(alma.x, alma.y)
        for (let k = 1; k <= 10; k++) {
          const t = k / 10
          const x = (1 - t) * (1 - t) * alma.x + 2 * (1 - t) * t * mx + t * t * c.x
          const y = (1 - t) * (1 - t) * alma.y + 2 * (1 - t) * t * my + t * t * c.y
          fio.lineTo(x, y)
        }
        fio.strokePath()
      })

      let aqui = 0 // batidas no lugar atual
      const bater = () => {
        if (!cabe(a, ATAQUE.telegrafoMs + 100)) return
        if (aqui >= cfg.porLugar) {
          // muda de lugar e só bate na próxima vez (dá tempo de ver onde ela está)
          aqui = 0
          alma.visivel = false
          a.cena.tweens.killTweensOf(img)
          a.cena.tweens.add({ targets: img, alpha: 0, scale: 0.4, duration: 160, onComplete: mudar })
          return
        }
        aqui++
        const c = coracaoPerto(a, alma.x, alma.y)
        const alvo = c ? { x: c.x, y: c.y } : a.alvo()
        const d = Math.hypot(alvo.x - alma.x, alvo.y - alma.y)
        const rumo = Math.atan2(alvo.y - alma.y, alvo.x - alma.x)
        const lado = a.escolher([1, -1])
        const meioVao = rumo + lado * a.aleatorio(cfg.desvio[0], cfg.desvio[1])
        // perto da alma o vão abre mais (o arco é menor lá)
        const vao = d < 50 ? cfg.vao + 2 : cfg.vao
        const delta = (Math.PI * 2) / cfg.cacos
        a.lacuna(Math.max(d, 45) * (vao + 1) * delta - 2 * cfg.raio, 'vão do anel da alma')

        tocar(a.cena, 'hab-kris-pulso')
        img.setFrame(1)
        a.cena.tweens.add({ targets: img, scale: 1.25, duration: 90, yoyo: true, onComplete: () => img.setFrame(0) })
        for (let j = 0; j < cfg.cacos - vao; j++) {
          const ang = meioVao + delta * (j + (vao + 1) / 2)
          a.bala({
            x: alma.x + Math.cos(ang) * 14,
            y: alma.y + Math.sin(ang) * 14,
            vx: Math.cos(ang) * cfg.velocidade,
            vy: Math.sin(ang) * cfg.velocidade,
            raio: cfg.raio,
            textura: 'hab-kris-caco',
            tamanho: 11,
            girar: 4,
            aviso: ATAQUE.telegrafoMs,
            vida: 4000,
          })
        }
      }

      a.depois(0, mudar)
      aCadaSorteado(a, cfg.intervalo, bater, 0.15, cfg.intervalo * 0.6)
    },
  }),

  // ♣ Armadilha de Espinhos: placas de metal vão sendo armadas no chão da
  // caixa, em tempos sorteados. Uma placa armada dá CLIQUE quando o coração
  // pisa nela (ou quando passa tempo demais armada): os furos ficam
  // vermelhos, a placa pisca e os espinhos sobem. As placas reagem a quem
  // anda perto: com o coração por perto o pavio corre mais rápido (a placa
  // treme), e algumas têm sensor e clicam só de o coração passar rente.
  // Onde a placa nova cai é sorteado: debaixo do coração (ficar parado não é
  // seguro), na frente dele (no rumo em que está andando) ou longe. De vez em
  // quando vem uma combinação:
  //   trilha   3 placas em fila (deitada, em pé ou na diagonal) perto do
  //            coração; uma clicou, as outras clicam em sequência (dominó)
  //   par      duas placas dos dois lados do coração e, às vezes, uma debaixo:
  //            saia pelo lado livre
  //
  //   maximo        placas no chão ao mesmo tempo
  //   armar         ms até a placa nova ficar armada
  //   vidaPlaca     ms armada até disparar sozinha (cada placa: × 0,65 a 1,25)
  //   espinhos      ms com os espinhos para cima
  //   debaixo       chance de a placa avulsa cair debaixo do coração; frente: na frente dele
  //   combinacoes   chance de vir uma trilha ou um par em vez de uma placa avulsa
  //   perto         px em que a placa fica nervosa; pressa: quanto o pavio acelera
  //   sensor        px a mais de alcance das placas com sensor (chanceSensor delas)
  //   corrente      uma placa que dispara faz as vizinhas (até `vizinhanca` px) dispararem também
  krisArmadilhaEspinhos: definirAtaque({
    nome: 'krisArmadilhaEspinhos',
    padrao: {
      duracao: 5000,
      intervalo: 650,
      maximo: 6,
      armar: 450,
      aviso: 480,
      espinhos: 650,
      vidaPlaca: 2400,
      debaixo: 0.3,
      frente: 0.3,
      combinacoes: 0.35,
      perto: 46,
      pressa: 2.2,
      sensor: 10,
      chanceSensor: 0.35,
      corrente: false,
      vizinhanca: 56,
      lado: 24,
    },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const velocidade = rastrearCoracoes(a)
      const placas = []

      const vivas = () => placas.filter((p) => p.estado !== 'foi')
      const margem = cfg.lado / 2 + 3
      const naCaixa = (p) => {
        const l = a.caixa
        return { x: limitar(p.x, l.left + margem, l.right - margem), y: limitar(p.y, l.top + margem, l.bottom - margem) }
      }
      const dentro = (p) => {
        const l = a.caixa
        return p.x >= l.left + margem && p.x <= l.right - margem && p.y >= l.top + margem && p.y <= l.bottom - margem
      }
      const livre = (p, folga) => vivas().every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= cfg.lado + folga)

      const colocar = (pos, grupo = null, ordem = 0) => {
        const img = a.decoracao(a.cena.add.image(pos.x, pos.y, 'hab-kris-placa', 0).setDepth(3).setAlpha(0).setScale(0.5))
        img.setDisplaySize(cfg.lado, cfg.lado)
        const escala = img.scaleX
        img.setScale(escala * 0.4)
        a.cena.tweens.add({ targets: img, alpha: 0.75, scale: escala, duration: 200, ease: 'Back.Out' })
        placas.push({
          ...pos,
          img,
          escala,
          estado: 'armando',
          t: 0,
          pavio: cfg.vidaPlaca * a.aleatorio(0.65, 1.25),
          sensor: a.aleatorio(0, 1) < cfg.chanceSensor ? cfg.sensor : 0,
          grupo,
          ordem,
        })
      }

      // placa avulsa: debaixo do coração, na frente dele ou num lugar livre longe dele
      const avulsa = (c, alvo) => {
        const l = a.caixa
        const sorteio = a.aleatorio(0, 1)
        let pos = null
        if (sorteio < cfg.debaixo) pos = naCaixa(alvo)
        else if (sorteio < cfg.debaixo + cfg.frente) {
          const v = c ? velocidade(c) : { vx: 0, vy: 0 }
          // parado não tem "frente": a placa vai para um lado sorteado, colada nele
          const ang = Math.hypot(v.vx, v.vy) > 30 ? Math.atan2(v.vy, v.vx) : a.aleatorio(0, Math.PI * 2)
          const d = a.aleatorio(cfg.lado + 6, cfg.lado + 30)
          pos = naCaixa({ x: alvo.x + Math.cos(ang) * d, y: alvo.y + Math.sin(ang) * d })
        }
        if (pos && !livre(pos, 2)) pos = null
        for (let tentativa = 0; !pos && tentativa < 14; tentativa++) {
          const p = { x: a.aleatorio(l.left + margem, l.right - margem), y: a.aleatorio(l.top + margem, l.bottom - margem) }
          if (Math.hypot(p.x - alvo.x, p.y - alvo.y) >= 40 && livre(p, 12)) pos = p
        }
        if (pos) colocar(pos)
        return Boolean(pos)
      }

      // trilha: 3 placas em fila perto do coração, que disparam em dominó
      const trilha = (alvo) => {
        if (vivas().length + 3 > cfg.maximo) return false
        const rumo = a.escolher([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4])
        const passo = cfg.lado + a.aleatorio(4, 10)
        const desvio = a.aleatorio(-cfg.lado * 0.8, cfg.lado * 0.8) // a fila passa perto, não sempre em cima
        const centro = { x: alvo.x - Math.sin(rumo) * desvio, y: alvo.y + Math.cos(rumo) * desvio }
        const pontos = [-1, 0, 1].map((i) => ({ x: centro.x + Math.cos(rumo) * i * passo, y: centro.y + Math.sin(rumo) * i * passo }))
        if (!pontos.every((p) => dentro(p) && livre(p, 2))) return false
        const grupo = {}
        pontos.forEach((p, i) => colocar(p, grupo, i)) // o dominó parte da placa que clicar primeiro
        return true
      }

      // par: duas placas dos lados do coração (e às vezes uma debaixo dele)
      const par = (alvo) => {
        const comMeio = a.aleatorio(0, 1) < 0.5
        if (vivas().length + (comMeio ? 3 : 2) > cfg.maximo) return false
        const deitado = a.aleatorio(0, 1) < 0.5
        const d = cfg.lado + a.aleatorio(4, 12)
        const lados = [-1, 1].map((s) => ({ x: alvo.x + (deitado ? s * d : 0), y: alvo.y + (deitado ? 0 : s * d) }))
        if (!lados.every((p) => dentro(p) && livre(p, 2))) return false
        lados.forEach((p) => colocar(p))
        const meio = naCaixa(alvo)
        if (comMeio && livre(meio, 2)) colocar(meio)
        return true
      }

      const armar = () => {
        if (vivas().length >= cfg.maximo || !cabe(a, cfg.armar + aviso)) return
        const ativos = a.coracoes.filter((c) => c.ativo)
        const alvo = a.alvo()
        const c = coracaoPerto(a, alvo.x, alvo.y) ?? ativos[0]
        if (a.aleatorio(0, 1) < cfg.combinacoes) {
          const ok = a.escolher([trilha, par])(alvo)
          if (ok) return
        }
        avulsa(c, alvo)
      }

      const clicar = (p) => {
        if (p.estado !== 'armando' && p.estado !== 'armada') return
        p.estado = 'clicou'
        p.img.setFrame(1).setAlpha(1).setPosition(p.x, p.y)
        tocar(a.cena, 'hab-kris-clique')
        // dominó: as outras placas da trilha clicam uma depois da outra
        if (p.grupo) {
          for (const q of placas) {
            if (q === p || q.grupo !== p.grupo) continue
            a.depois(Math.abs(q.ordem - p.ordem) * a.aleatorio(120, 200), () => clicar(q))
          }
        }
        const meio = cfg.lado / 2
        a.aviso({ tipo: 'area', x: p.x - meio, y: p.y - meio, largura: cfg.lado, altura: cfg.lado, ms: aviso }, () => {
          p.img.setAlpha(0)
          tocar(a.cena, 'hab-kris-espinhos')
          a.bala({
            x: p.x,
            y: p.y,
            largura: cfg.lado - 3,
            altura: cfg.lado - 3,
            textura: 'hab-kris-placa',
            quadro: 2,
            tamanho: cfg.lado,
            jaAvisada: true,
            atravessa: true,
            pulso: 0,
            vida: cfg.espinhos,
            atualizar: (b) => {
              // os espinhos sobem de uma vez (pequeno solavanco) e somem no fim
              const k = Math.min(1, b.idade / 70)
              b.sprite.setScale(b.escalaX * (0.85 + 0.15 * k))
              apagarNoFim(b, 140)
              if (b.vida <= 0) p.estado = 'foi'
            },
          })
          a.depois(cfg.espinhos, () => (p.estado = 'foi'))
          if (cfg.corrente) {
            for (const q of placas) {
              if (q !== p && q.estado === 'armada' && Math.hypot(q.x - p.x, q.y - p.y) <= cfg.vizinhanca) a.depois(a.aleatorio(110, 260), () => clicar(q))
            }
          }
        })
      }

      a.aoAtualizar((dt, tempo) => {
        for (const p of placas) {
          if (p.estado !== 'armando' && p.estado !== 'armada') continue
          if (p.estado === 'armando') {
            p.t += dt
            if (p.t >= cfg.armar) {
              p.estado = 'armada'
              p.img.setAlpha(1)
            }
            continue
          }
          const c = coracaoPerto(a, p.x, p.y)
          const nervosa = c && Math.hypot(c.x - p.x, c.y - p.y) <= cfg.perto
          p.t += nervosa ? dt * cfg.pressa : dt
          // nervosa: a placa treme (é o sinal de que o pavio está correndo)
          p.img.setPosition(p.x + (nervosa ? Math.sin(tempo / 18) : 0), p.y)
          const alcance = cfg.lado / 2 + 1 + p.sensor
          const pisou = a.coracoes.some((h) => h.ativo && Math.abs(h.x - p.x) <= alcance && Math.abs(h.y - p.y) <= alcance)
          if (pisou || p.t >= p.pavio) clicar(p)
        }
      })

      aCadaSorteado(a, cfg.intervalo, armar, 0.4, 150)
    },
  }),
  // ♦ Silêncio (o ataque leve que o Ás de ouros de Kris manda junto com o
  // Anular; a regra do Ás é a mesma de todo personagem): a caixa fica muda e
  // escura. Um véu cobre o chão (névoa azul-noite com as bordas apagadas; as
  // balas e o coração ficam por cima) e lâminas pálidas, sem som e sem aviso, entram pelas bordas
  // (nascem fora da caixa). Cada golpe é sorteado, sem repetir muito:
  //   fileira    2 ou 3 lâminas da mesma borda, uma na linha do coração, em tempos quebrados
  //   cruzado    duas lâminas de bordas vizinhas miradas no coração, quase juntas
  //   espreita   uma lâmina entra devagar, para rente à borda, vira para o
  //              coração e investe (a pausa dela é o único aviso)
  //
  //   velocidade  px/s das lâminas; investida: px/s da que espreitava
  //   espreita    ms parada virando para o coração
  //   fileira     lâminas no máximo por fileira
  //   veu         opacidade do véu escuro
  krisSilencio: definirAtaque({
    nome: 'krisSilencio',
    padrao: { duracao: 5000, intervalo: 950, velocidade: 170, investida: 300, espreita: 420, fileira: 3, comprimento: 24, espessura: 6, veu: 0.6 },
    iniciar(a, cfg) {
      // o véu escurece a caixa aos poucos e fica até o fim (some com o ataque)
      const veu = a.decoracao(a.cena.add.graphics().setDepth(2).setAlpha(0))
      // névoa azul-noite no meio e as bordas apagadas (pretas): o silêncio vem de fora
      const pintar = () => {
        const l = a.caixa
        veu.clear()
        veu.fillStyle(0x0c1436, cfg.veu)
        veu.fillRect(l.left, l.top, l.width, l.height)
        for (let k = 0; k < 4; k++) {
          const e = 6 + k * 6
          veu.lineStyle(6, 0x000000, 0.5 - k * 0.11)
          veu.strokeRect(l.left + e - 3, l.top + e - 3, l.width - 2 * e + 6, l.height - 2 * e + 6)
        }
      }
      pintar()
      a.aoAtualizar(pintar) // a caixa pode mudar de tamanho
      a.cena.tweens.add({ targets: veu, alpha: 1, duration: 450 })
      tocar(a.cena, 'hab-kris-silencio') // o único som do ataque

      const lamina = (x, y, ang, vel, extra = {}) =>
        a.bala({
          x,
          y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          comprimento: cfg.comprimento,
          espessura: cfg.espessura,
          angulo: ang,
          textura: 'hab-kris-lamina',
          tamanho: cfg.comprimento * 1.2,
          jaAvisada: true, // a entrada pela borda é o aviso
          pulso: 0,
          vida: 4000,
          ...extra,
        })
      // coordenada sorteada ao longo da borda `lado`
      const aoLongo = (lado, folga = 14) => {
        const l = a.caixa
        return horizontal(lado) ? a.aleatorio(l.top + folga, l.bottom - folga) : a.aleatorio(l.left + folga, l.right - folga)
      }

      const fileira = () => {
        const l = a.caixa
        const alvo = a.alvo()
        const lado = a.escolher(LADOS)
        const n = a.inteiro(2, Math.max(2, cfg.fileira))
        const doCoracao = a.inteiro(0, n - 1) // qual delas vem na linha do coração
        const usados = []
        for (let k = 0; k < n; k++) {
          let pos = horizontal(lado) ? limitar(alvo.y, l.top + 8, l.bottom - 8) : limitar(alvo.x, l.left + 8, l.right - 8)
          if (k !== doCoracao) {
            for (let tentativa = 0; tentativa < 8; tentativa++) {
              pos = aoLongo(lado)
              if (usados.every((u) => Math.abs(u - pos) >= 26)) break
            }
          }
          usados.push(pos)
          a.depois(a.aleatorio(0, 340), () => {
            const p = foraDaBorda(a.caixa, lado, pos, a.aleatorio(10, 28))
            lamina(p.x, p.y, p.rumo + a.aleatorio(-0.18, 0.18), cfg.velocidade * a.aleatorio(0.9, 1.15))
          })
        }
      }

      const cruzado = () => {
        const lado = a.escolher(LADOS)
        const outro = a.escolher(VIZINHOS[lado])
        ;[lado, outro].forEach((ld, i) =>
          a.depois(i ? a.aleatorio(60, 240) : 0, () => {
            const alvo = a.alvo()
            const p = foraDaBorda(a.caixa, ld, aoLongo(ld), a.aleatorio(10, 24))
            lamina(p.x, p.y, Math.atan2(alvo.y - p.y, alvo.x - p.x), cfg.velocidade * 1.05)
          }),
        )
      }

      const espreita = () => {
        const l = a.caixa
        const alvo = a.alvo()
        const lado = a.escolher(LADOS)
        const perto = horizontal(lado) ? alvo.y : alvo.x
        const pos = limitar(perto + a.aleatorio(-50, 50), (horizontal(lado) ? l.top : l.left) + 14, (horizontal(lado) ? l.bottom : l.right) - 14)
        const p = foraDaBorda(l, lado, pos, 16)
        const fundo = a.aleatorio(10, 18) // px para dentro da borda em que ela para
        const adentro = (b) => (lado === 'esq' ? b.x - l.left : lado === 'dir' ? l.right - b.x : lado === 'cima' ? b.y - l.top : l.bottom - b.y)
        let estado = 'entra'
        let relogio = 0
        lamina(p.x, p.y, p.rumo, cfg.velocidade * 0.7, {
          vida: 6000,
          atualizar: (b, dt) => {
            relogio += dt
            if (estado === 'entra') {
              if (adentro(b) >= fundo) {
                b.vx = 0
                b.vy = 0
                estado = 'espreita'
                relogio = 0
              }
            } else if (estado === 'espreita') {
              // vira devagar para o coração mais perto
              const c = coracaoPerto(a, b.x, b.y)
              if (c) {
                let giro = Math.atan2(c.y - b.y, c.x - b.x) - b.angulo
                giro = Math.atan2(Math.sin(giro), Math.cos(giro))
                b.angulo += giro * Math.min(1, dt / 90)
              }
              if (relogio >= cfg.espreita && !emRespiro(a)) {
                estado = 'investe'
                b.vx = Math.cos(b.angulo) * cfg.investida
                b.vy = Math.sin(b.angulo) * cfg.investida
                particulas(a.cena, b.x, b.y, { cor: 0xd6f4ff, quantidade: 3, velocidade: 50, vida: 160 })
              }
            }
          },
        })
      }

      const golpes = { fileira, cruzado, espreita }
      let anterior = null
      let repetidas = 0
      const golpe = () => {
        if (!cabe(a, 450)) return
        let nome = a.escolher(['fileira', 'fileira', 'cruzado', 'espreita'])
        if (nome === anterior && repetidas >= 1) nome = a.escolher(Object.keys(golpes).filter((g) => g !== anterior))
        repetidas = nome === anterior ? repetidas + 1 : 0
        anterior = nome
        golpes[nome]()
      }

      aCadaSorteado(a, cfg.intervalo, golpe, 0.3, 250)
    },
  }),
}
