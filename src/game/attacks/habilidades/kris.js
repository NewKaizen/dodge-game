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

export default {
  // ♠ Corte Firme: uma espada larga presa pelo cabo no meio da parede (do lado
  // do coração) gira meia volta e corta a meia-lua inteira de uma vez. A
  // meia-lua pisca antes (círculo cortado pela caixa) e a espada aparece
  // erguida, esperando. O lado oposto da caixa fica livre (>= LACUNA_MINIMA),
  // então quem fica parado no lado do coração leva; o próximo corte vem da
  // outra parede. De tempos em tempos o corte vem do teto/chão.
  //
  //   alcance    fração da caixa que a lâmina alcança (limitada pela rota de fuga)
  //   giro       ms da meia volta (antes do fator de velocidade)
  //   vertical   1 a cada 3 cortes sai do teto ou do chão
  krisCorteFirme: definirAtaque({
    nome: 'krisCorteFirme',
    padrao: { duracao: 5500, intervalo: 1300, aviso: 720, giro: 480, alcance: 0.56, espessura: 12, vertical: true },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      let n = 0

      const corte = () => {
        if (!cabe(a, aviso + 100)) return
        const l = a.caixa
        const alvo = a.alvo()
        const k = n++
        const vertical = cfg.vertical && k % 3 === 2
        const e = cfg.espessura
        let px, py, base // pivô e ângulo que aponta para dentro da caixa
        let ocupado
        const profundidade = vertical ? l.height : l.width
        const R = Math.min(profundidade * cfg.alcance, profundidade - a.lacunaMinima - e / 2 - 4)
        if (!vertical) {
          const esq = alvo.x < l.centerX
          px = esq ? l.left : l.right
          py = l.centerY
          base = esq ? 0 : Math.PI
          ocupado = esq ? [l.left, l.left + R + e / 2] : [l.right - R - e / 2, l.right]
        } else {
          const cima = alvo.y < l.centerY
          px = l.centerX
          py = cima ? l.top : l.bottom
          base = cima ? Math.PI / 2 : -Math.PI / 2
          ocupado = cima ? [l.top, l.top + R + e / 2] : [l.bottom - R - e / 2, l.bottom]
        }
        a.parede({ eixo: vertical ? 'y' : 'x', ocupados: [ocupado] })

        const sentido = k % 2 === 0 ? 1 : -1
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

      a.aCada(cfg.intervalo, corte, Infinity, 200)
    },
  }),

  // ♠ Estocada Dupla: um florete entra pela parede na fileira do coração, fica
  // cravado um instante, recua, MIRA DE NOVO (escorrega até a fileira nova,
  // com a linha piscando) e estoca outra vez. A ponta para em `alcance` da
  // caixa: o fundo do outro lado também é rota de fuga. Os floretes alternam
  // as paredes; nas cartas fortes dois ficam ativos ao mesmo tempo.
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

      a.aCada(cfg.intervalo, (i) => florete(i % 2 === 0), Infinity, 200)
    },
  }),

  // ♦ Olhar Vazio: um olho vazio (contorno sem pupila) aparece longe do
  // coração e vai atrás dele devagar (mais devagar que o coração). Quando
  // fixa o olhar, a pupila fica vermelha, a área em volta pisca e ele pisca
  // num clarão que solta faíscas (cílios) para os lados.
  //
  //   seguir      ms seguindo antes de fixar
  //   velocidade  px/s com que o olho segue
  //   raio        raio do clarão
  //   cilios      faíscas soltas no clarão
  krisOlharVazio: definirAtaque({
    nome: 'krisOlharVazio',
    padrao: { duracao: 5000, intervalo: 1500, seguir: 1100, velocidade: 60, aviso: 600, raio: 20, cilios: 4, velocidadeCilio: 85 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)

      const olhar = () => {
        if (!cabe(a, cfg.seguir + aviso + 100)) return
        const p = a.pontoLonge(75, 18)
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
          vida: cfg.seguir + aviso + 4000, // folga para os respiros; morre no clarão
          atualizar: (b, dt) => {
            b.inofensiva = true // o olho em si não machuca: só a piscada
            if (b.idade < 250) b.sprite.setAlpha(b.idade / 250)
            else if (!fixou) b.sprite.setAlpha(0.95)
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
            if (b.idade >= cfg.seguir && !emRespiro(a)) fixar(b)
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

      a.aCada(cfg.intervalo, olhar, Infinity, 150)
    },
  }),

  // ♦ Passo Calculado: Kris calcula onde o coração VAI estar. Uma fileira de
  // pegadas (pé esquerdo, pé direito) anda até esse ponto e passa um passo
  // dele; cada pegada pisca no chão antes e pisa com força. Andar sempre em
  // linha reta é pisado; mudar de direção (ou dar um passo de lado) escapa.
  //
  //   passos      pegadas até o ponto calculado (mais uma depois dele)
  //   distancia   px entre duas pegadas; cadencia: ms entre elas
  //   antecipa    fração do tempo até a pisada usada para prever o coração
  krisPassoCalculado: definirAtaque({
    nome: 'krisPassoCalculado',
    padrao: { duracao: 5000, intervalo: 1400, passos: 4, distancia: 26, cadencia: 200, aviso: 480, raio: 12, antecipa: 0.8, previsaoMax: 90, vida: 260 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      // velocidade suavizada de cada coração (para prever o caminho)
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

      let vez = 0
      const caminhada = () => {
        const total = cfg.passos * cfg.cadencia + aviso
        if (!cabe(a, total)) return
        const l = a.caixa
        const ativos = a.coracoes.filter((c) => c.ativo)
        const c = ativos[vez++ % Math.max(1, ativos.length)]
        const m = cfg.raio + 4
        const alvo = c ? { x: c.x, y: c.y } : { x: l.centerX, y: l.centerY }
        const r = (c && rastros.get(c)) || { vx: 0, vy: 0 }
        const ate = (((cfg.passos - 1) * cfg.cadencia + aviso) / 1000) * cfg.antecipa
        let px = r.vx * ate
        let py = r.vy * ate
        const prev = Math.hypot(px, py)
        if (prev > cfg.previsaoMax) {
          px *= cfg.previsaoMax / prev
          py *= cfg.previsaoMax / prev
        }
        const P = { x: limitar(alvo.x + px, l.left + m, l.right - m), y: limitar(alvo.y + py, l.top + m, l.bottom - m) }

        // de onde a fileira vem: um ângulo em que o caminho inteiro cabe na caixa
        const atras = (cfg.passos - 1) * cfg.distancia
        const dentro = (x, y) => x >= l.left + m && x <= l.right - m && y >= l.top + m && y <= l.bottom - m
        let ang = a.aleatorio(0, Math.PI * 2)
        let passo = cfg.distancia
        for (let tentativa = 0; tentativa < 16; tentativa++) {
          const cand = a.aleatorio(0, Math.PI * 2)
          const dx = Math.cos(cand)
          const dy = Math.sin(cand)
          if (dentro(P.x - dx * atras, P.y - dy * atras) && dentro(P.x + dx * cfg.distancia, P.y + dy * cfg.distancia)) {
            ang = cand
            break
          }
          if (tentativa === 15) passo = cfg.distancia * 0.6 // caixa apertada: passos mais curtos
        }
        const dx = Math.cos(ang)
        const dy = Math.sin(ang)
        for (let k = 0; k <= cfg.passos; k++) {
          const lado = k % 2 === 0 ? -1 : 1
          const d = (k - (cfg.passos - 1)) * passo
          const x = limitar(P.x + dx * d - dy * lado * 6, l.left + m, l.right - m)
          const y = limitar(P.y + dy * d + dx * lado * 6, l.top + m, l.bottom - m)
          a.depois(k * cfg.cadencia, () => pisar(x, y, ang, lado))
        }
      }

      const pisar = (x, y, ang, lado) => {
        const pe = a.decoracao(a.cena.add.image(x, y, 'hab-kris-pegada').setDepth(4).setRotation(ang + Math.PI / 2).setAlpha(0).setFlipX(lado > 0))
        a.cena.tweens.add({ targets: pe, alpha: 0.9, duration: aviso * 0.7 })
        a.aviso({ tipo: 'circulo', x, y, raio: cfg.raio, ms: aviso }, () => {
          tocar(a.cena, 'hab-kris-passo')
          a.cena.tweens.add({ targets: pe, alpha: 0, delay: 120, duration: 300 })
          a.bala({
            x,
            y,
            raio: cfg.raio,
            textura: 'hab-kris-pisada',
            tamanho: cfg.raio * 2.2,
            jaAvisada: true,
            atravessa: true,
            vida: cfg.vida,
            pulso: 0.1,
            atualizar: (b) => apagarNoFim(b, 110),
          })
        })
      }

      a.aCada(cfg.intervalo, caminhada, Infinity, 200)
    },
  }),

  // ♦ Plano Tático: setas de um plano de batalha (com uma curva em L) são
  // riscadas na caixa, e uma tropa de peões de xadrez marcha por cada uma,
  // dobrando a esquina. A primeira seta de cada plano passa pelo coração; as
  // outras cortam a caixa em outro lugar. O caminho inteiro pisca antes.
  //
  //   setas       setas por plano
  //   tropas      peões por seta; espaco: px entre eles
  krisPlanoTatico: definirAtaque({
    nome: 'krisPlanoTatico',
    padrao: { duracao: 6000, intervalo: 1900, setas: 2, tropas: 3, espaco: 20, velocidade: 160, aviso: 700, raio: 6 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)

      // caminho em L que passa por p; primeiro trecho na horizontal ('h') ou na vertical ('v')
      const rota = (p, primeiro) => {
        const l = a.caixa
        const m = 16
        const fora = 14
        if (primeiro === 'h') {
          const daEsq = a.aleatorio(0, 1) < 0.5
          const sx = daEsq ? l.left - fora : l.right + fora
          const dir = daEsq ? 1 : -1
          const limite = daEsq ? l.right - m : l.left + m
          const tx = (limite - p.x) * dir > 20 ? p.x + dir * a.aleatorio(20, Math.min(70, (limite - p.x) * dir)) : p.x
          const desce = p.y < l.centerY
          return [
            { x: sx, y: p.y },
            { x: tx, y: p.y },
            { x: tx, y: desce ? l.bottom + fora : l.top - fora },
          ]
        }
        const deCima = a.aleatorio(0, 1) < 0.5
        const sy = deCima ? l.top - fora : l.bottom + fora
        const dir = deCima ? 1 : -1
        const limite = deCima ? l.bottom - m : l.top + m
        const ty = (limite - p.y) * dir > 20 ? p.y + dir * a.aleatorio(20, Math.min(60, (limite - p.y) * dir)) : p.y
        const direita = p.x < l.centerX
        return [
          { x: p.x, y: sy },
          { x: p.x, y: ty },
          { x: direita ? l.right + fora : l.left - fora, y: ty },
        ]
      }

      const seta = (pontos) => {
        const [A, B, C] = pontos
        a.aviso({ tipo: 'linha', x1: A.x, y1: A.y, x2: B.x, y2: B.y, espessura: 4, ms: aviso })
        a.aviso({ tipo: 'linha', x1: B.x, y1: B.y, x2: C.x, y2: C.y, espessura: 4, ms: aviso })
        // ponta da seta, dentro da caixa, perto de onde a tropa sai
        const l = a.caixa
        const ang = Math.atan2(C.y - B.y, C.x - B.x)
        const px = limitar(C.x, l.left + 9, l.right - 9)
        const py = limitar(C.y, l.top + 9, l.bottom - 9)
        const ponta = a.decoracao(a.cena.add.image(px, py, 'hab-kris-seta').setDepth(4).setRotation(ang).setAlpha(0))
        a.cena.tweens.add({ targets: ponta, alpha: 0.9, duration: 200 })
        a.cena.tweens.add({ targets: ponta, alpha: 0.6, duration: 120, yoyo: true, repeat: -1, delay: 200 })

        const trechos = [
          [A, B, Math.hypot(B.x - A.x, B.y - A.y)],
          [B, C, Math.hypot(C.x - B.x, C.y - B.y)],
        ]
        const total = trechos[0][2] + trechos[1][2]
        const em = (s) => {
          if (s <= trechos[0][2]) {
            const k = s / Math.max(1, trechos[0][2])
            return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k }
          }
          const k = (s - trechos[0][2]) / Math.max(1, trechos[1][2])
          return { x: B.x + (C.x - B.x) * k, y: B.y + (C.y - B.y) * k }
        }
        const dir0 = { x: (B.x - A.x) / Math.max(1, trechos[0][2]), y: (B.y - A.y) / Math.max(1, trechos[0][2]) }

        a.depois(aviso, () => {
          a.cena.tweens.killTweensOf(ponta)
          a.cena.tweens.add({ targets: ponta, alpha: 0, delay: (total / cfg.velocidade) * 700, duration: 300 })
          for (let j = 0; j < cfg.tropas; j++) {
            let s = -j * cfg.espaco
            a.bala({
              x: A.x + dir0.x * s,
              y: A.y + dir0.y * s,
              raio: cfg.raio,
              textura: 'hab-kris-peao',
              tamanho: 15,
              jaAvisada: true,
              pulso: 0,
              vida: 8000,
              atualizar: (b, dt) => {
                s += cfg.velocidade * a.balas.fatorVelocidade * (dt / 1000)
                const q = s < 0 ? { x: A.x + dir0.x * s, y: A.y + dir0.y * s } : em(s)
                b.x = q.x
                // marcha: um pulinho a cada passo
                b.y = q.y - Math.abs(Math.sin(s / 7)) * 2
                if (s > total + 10) b.morta = true
              },
            })
          }
        })
      }

      let vez = 0
      const plano = () => {
        if (!cabe(a, aviso + 100)) return
        const l = a.caixa
        for (let k = 0; k < cfg.setas; k++) {
          const p = k === 0 ? a.alvo() : { x: a.aleatorio(l.left + 20, l.right - 20), y: a.aleatorio(l.top + 20, l.bottom - 20) }
          seta(rota(p, (vez + k) % 2 === 0 ? 'h' : 'v'))
        }
        vez++
      }

      a.aCada(cfg.intervalo, plano, Infinity, 200)
    },
  }),

  // ♦ Controle da Alma: a alma vermelha flutua na caixa, presa ao coração por
  // um fio, e bate: a cada batida solta um anel de cacos que se abre para
  // fora com UM vão. O vão nunca fica bem na direção do coração (fica um pouco
  // para o lado), então é preciso andar até ele (com os controles invertidos
  // da carta). A cada `porLugar` batidas a alma some e reaparece longe.
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

      let batidas = 0
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
        batidas++
        const c = coracaoPerto(a, alma.x, alma.y)
        const alvo = c ? { x: c.x, y: c.y } : a.alvo()
        const d = Math.hypot(alvo.x - alma.x, alvo.y - alma.y)
        const rumo = Math.atan2(alvo.y - alma.y, alvo.x - alma.x)
        const lado = batidas % 2 === 0 ? 1 : -1
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
      a.aCada(cfg.intervalo, bater, Infinity, cfg.intervalo * 0.6)
    },
  }),

  // ♣ Armadilha de Espinhos: placas de metal vão sendo armadas no chão da
  // caixa. Uma placa armada dá CLIQUE quando o coração pisa nela (ou quando
  // passa tempo demais armada): os furos ficam vermelhos, a placa pisca e os
  // espinhos sobem. Uma parte das placas é armada debaixo do coração (com
  // tempo de sobra para sair), então ficar parado também não é seguro.
  //
  //   maximo      placas no chão ao mesmo tempo
  //   armar       ms até a placa nova ficar armada
  //   vidaPlaca   ms armada até disparar sozinha
  //   espinhos    ms com os espinhos para cima
  //   debaixo     fração das placas armadas debaixo do coração
  //   corrente    uma placa que dispara faz as vizinhas (até `vizinhanca` px) dispararem também
  krisArmadilhaEspinhos: definirAtaque({
    nome: 'krisArmadilhaEspinhos',
    padrao: { duracao: 5000, intervalo: 650, maximo: 6, armar: 450, aviso: 480, espinhos: 650, vidaPlaca: 2400, debaixo: 0.34, corrente: false, vizinhanca: 56, lado: 24 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const placas = []
      let mira = 0

      const vivas = () => placas.filter((p) => p.estado !== 'foi')

      const armar = () => {
        if (vivas().length >= cfg.maximo || !cabe(a, cfg.armar + aviso)) return
        const l = a.caixa
        const m = cfg.lado / 2 + 3
        const alvo = a.alvo()
        let pos = null
        mira += cfg.debaixo
        if (mira >= 1) {
          mira -= 1
          const p = { x: limitar(alvo.x, l.left + m, l.right - m), y: limitar(alvo.y, l.top + m, l.bottom - m) }
          if (vivas().every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= cfg.lado + 2)) pos = p
        }
        for (let tentativa = 0; !pos && tentativa < 14; tentativa++) {
          const p = { x: a.aleatorio(l.left + m, l.right - m), y: a.aleatorio(l.top + m, l.bottom - m) }
          const longeDoCoracao = Math.hypot(p.x - alvo.x, p.y - alvo.y) >= 40
          const longeDasOutras = vivas().every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= cfg.lado + 12)
          if (longeDoCoracao && longeDasOutras) pos = p
        }
        if (!pos) return
        const img = a.decoracao(a.cena.add.image(pos.x, pos.y, 'hab-kris-placa', 0).setDepth(3).setAlpha(0).setScale(0.5))
        img.setDisplaySize(cfg.lado, cfg.lado)
        const escala = img.scaleX
        img.setScale(escala * 0.4)
        a.cena.tweens.add({ targets: img, alpha: 0.75, scale: escala, duration: 200, ease: 'Back.Out' })
        placas.push({ ...pos, img, escala, estado: 'armando', t: 0 })
      }

      const clicar = (p) => {
        if (p.estado !== 'armando' && p.estado !== 'armada') return
        p.estado = 'clicou'
        p.img.setFrame(1).setAlpha(1)
        tocar(a.cena, 'hab-kris-clique')
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
              if (q !== p && q.estado === 'armada' && Math.hypot(q.x - p.x, q.y - p.y) <= cfg.vizinhanca) a.depois(160, () => clicar(q))
            }
          }
        })
      }

      a.aoAtualizar((dt) => {
        for (const p of placas) {
          if (p.estado !== 'armando' && p.estado !== 'armada') continue
          p.t += dt
          if (p.estado === 'armando') {
            if (p.t >= cfg.armar) {
              p.estado = 'armada'
              p.img.setAlpha(1)
            }
            continue
          }
          const pisou = a.coracoes.some((c) => c.ativo && Math.abs(c.x - p.x) <= cfg.lado / 2 + 1 && Math.abs(c.y - p.y) <= cfg.lado / 2 + 1)
          if (pisou || p.t >= cfg.vidaPlaca) clicar(p)
        }
      })

      a.aCada(cfg.intervalo, armar, Infinity, 150)
    },
  }),
}
