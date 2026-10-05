// Ataques exclusivos das cartas de berdly (uma entrada por ataque, com prefixo 'berdly').
// As receitas de pvp/baralhos/berdly.js chamam A.berdlyBicada(...) etc.
// Sprites e sons: pvp/habilidades/sprites/berdly.js (gerados por scripts/habilidades/berdly.py).
//
// Justiça (ver attacks/validacao.js): toda bala ou pisca o aviso padrão do
// a.bala ou nasce depois de um a.aviso (linha/área/círculo) que mostra onde
// ela vai passar; nada fecha a caixa inteira, e o movimento feito à mão em
// `atualizar` é multiplicado por a.balas.fatorVelocidade.
import { definirAtaque } from '../definir.js'
import { ATAQUE, FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-berdly-${nome}`
const limitar = (v, min, max) => Math.min(Math.max(v, min), max)
const fator = (a) => a.balas.fatorVelocidade

// some com a decoração (e a destrói) num fade
function sumir(a, obj, ms, extra = {}) {
  a.cena.tweens.add({ targets: obj, alpha: 0, duration: ms, ...extra, onComplete: () => obj.destroy() })
}

// texto pequeno do "nerd" (graus, QI...) que sobe e some
function rotulo(a, x, y, texto, ms = 700, cor = '#d8f05a') {
  const t = a.decoracao(
    a.cena.add.text(x, y, texto, { fontFamily: FONTE, fontSize: '10px', color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(8),
  )
  a.cena.tweens.add({ targets: t, y: y - 10, duration: ms })
  sumir(a, t, 250, { delay: ms })
  return t
}

// ponto da caixa a `dist` px do alvo (tenta vários ângulos; fica com o mais longe se a borda atrapalhar)
function pontoEmVolta(a, alvo, dist, margem, angulo = null) {
  const l = a.caixa
  let melhor = null
  for (let k = 0; k < 8; k++) {
    const ang = (angulo ?? a.aleatorio(0, Math.PI * 2)) + k * 0.8
    const p = { x: limitar(alvo.x + Math.cos(ang) * dist, l.left + margem, l.right - margem), y: limitar(alvo.y + Math.sin(ang) * dist, l.top + margem, l.bottom - margem) }
    const d = Math.hypot(p.x - alvo.x, p.y - alvo.y)
    if (d >= dist * 0.8) return p
    if (!melhor || d > melhor.d) melhor = { ...p, d }
  }
  return melhor
}

export default {
  // ♠ BICADA: um bico entra pela borda e bica onde o coração está, "tuc-tuc-tuc":
  // cada bicada mira de novo, avança, crava e volta. A linha da bicada pisca antes.
  berdlyBicada: definirAtaque({
    nome: 'berdlyBicada',
    padrao: { duracao: 5000, intervalo: 1700, bicadas: 3, cadencia: 470, velocidade: 300, aviso: 450, comprimento: 26, espessura: 10, alem: 30 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const bicar = (lado) => {
        const l = a.caixa
        const alvo = a.alvo()
        const desvio = a.aleatorio(-22, 22)
        const origem = {
          left: { x: l.left, y: limitar(alvo.y + desvio, l.top + 10, l.bottom - 10) },
          right: { x: l.right, y: limitar(alvo.y + desvio, l.top + 10, l.bottom - 10) },
          top: { x: limitar(alvo.x + desvio, l.left + 10, l.right - 10), y: l.top },
        }[lado]
        const dir = Math.atan2(alvo.y - origem.y, alvo.x - origem.x)
        const cos = Math.cos(dir)
        const sin = Math.sin(dir)
        const fundo = limitar(Math.hypot(alvo.x - origem.x, alvo.y - origem.y) + cfg.alem, 60, Math.hypot(l.width, l.height) * 0.75)
        a.aviso({ tipo: 'linha', x1: origem.x, y1: origem.y, x2: origem.x + cos * fundo, y2: origem.y + sin * fundo, espessura: cfg.espessura, ms: aviso }, () => {
          let p = 0 // quanto a ponta já entrou na caixa
          let fase = 'entra'
          let parado = 0
          const posicionar = (b) => {
            b.x = origem.x + cos * (p - cfg.comprimento / 2)
            b.y = origem.y + sin * (p - cfg.comprimento / 2)
          }
          const b = a.bala({
            x: 0,
            y: 0,
            comprimento: cfg.comprimento,
            espessura: cfg.espessura,
            angulo: dir,
            textura: T('bico'),
            tamanho: cfg.comprimento * 1.05,
            jaAvisada: true,
            atravessa: true,
            pulso: 0,
            atualizar: (b, dt) => {
              const passo = cfg.velocidade * fator(a) * (dt / 1000)
              if (fase === 'entra') {
                p = Math.min(fundo, p + passo)
                if (p >= fundo) {
                  fase = 'crava'
                  const pontaX = origem.x + cos * p
                  const pontaY = origem.y + sin * p
                  tocar(a.cena, 'hab-berdly-bicada')
                  const m = a.decoracao(a.cena.add.image(pontaX, pontaY, T('marca')).setDepth(6).setScale(0.6))
                  a.cena.tweens.add({ targets: m, scale: 1.6, duration: 160 })
                  sumir(a, m, 220, { delay: 120 })
                }
              } else if (fase === 'crava') {
                parado += dt
                if (parado >= 70) fase = 'volta'
              } else {
                p -= passo * 1.4
                if (p <= 0) b.morta = true
              }
              posicionar(b)
            },
          })
          posicionar(b)
          b.sprite.setPosition(b.x, b.y)
        })
      }
      const lados = ['left', 'top', 'right']
      a.aCada(
        cfg.intervalo,
        (i) => {
          const lado = lados[i % lados.length]
          for (let k = 0; k < cfg.bicadas; k++) a.depois(k * cfg.cadencia, () => bicar(lado))
        },
        Infinity,
        300,
      )
    },
  }),

  // ♠ PENAS VOADORAS: um bater de asas solta um leque de penas da borda mais
  // longe do coração; elas vêm flutuando (balançam de um lado para o outro).
  berdlyPenas: definirAtaque({
    nome: 'berdlyPenas',
    padrao: { duracao: 5000, intervalo: 1000, quantidade: 5, abertura: 0.3, velocidade: 130, amplitude: 9, frequencia: 7, raio: 5 },
    iniciar(a, cfg) {
      a.aCada(
        cfg.intervalo,
        (i) => {
          const l = a.caixa
          const alvo = a.alvo()
          const daEsquerda = alvo.x - l.left > l.right - alvo.x
          const origem = { x: daEsquerda ? l.left + 8 : l.right - 8, y: limitar(alvo.y + a.aleatorio(-30, 30), l.top + 16, l.bottom - 16) }
          const dir = Math.atan2(alvo.y - origem.y, alvo.x - origem.x)
          const sopro = a.decoracao(a.cena.add.image(origem.x, origem.y, T('plumas')).setDepth(4).setScale(1.5).setAlpha(0.9))
          a.cena.tweens.add({ targets: sopro, scale: 3, duration: 400 })
          sumir(a, sopro, 400)
          tocar(a.cena, 'hab-berdly-vento')
          for (let k = 0; k < cfg.quantidade; k++) {
            const ang = dir + (k - (cfg.quantidade - 1) / 2) * cfg.abertura
            const cos = Math.cos(ang)
            const sin = Math.sin(ang)
            const fase = k * 1.7 + i
            let base = null
            let voo = 0
            const b = a.bala({
              x: origem.x + cos * 10,
              y: origem.y + sin * 10,
              raio: cfg.raio,
              textura: T('pena'),
              quadro: (i + k) % 2,
              tamanho: 20,
              pulso: 0,
              atualizar: (b, dt) => {
                if (!base) base = { x: b.x, y: b.y }
                const s = (dt / 1000) * fator(a)
                voo += s
                base.x += cos * cfg.velocidade * s
                base.y += sin * cfg.velocidade * s
                const onda = Math.sin(voo * cfg.frequencia + fase)
                b.x = base.x - sin * onda * cfg.amplitude
                b.y = base.y + cos * onda * cfg.amplitude
                b.sprite.rotation = ang + 0.45 * Math.cos(voo * cfg.frequencia + fase)
              },
            })
            b.sprite.rotation = ang
          }
        },
        Infinity,
        300,
      )
    },
  }),

  // ♠ MERGULHO AÉREO: um mergulho em diagonal de cima, passando pelo coração;
  // no chão ele arremete e sobe de novo (um V). O V inteiro pisca antes.
  berdlyMergulho: definirAtaque({
    nome: 'berdlyMergulho',
    padrao: { duracao: 6000, intervalo: 1200, velocidade: 360, aviso: 560, angulo: 0.95, comprimento: 34, espessura: 13 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      a.aCada(
        cfg.intervalo,
        () => {
          const l = a.caixa
          const alvo = a.alvo()
          const sentido = alvo.x > l.centerX ? 1 : -1 // vem do lado oposto ao coração
          const th = cfg.angulo + a.aleatorio(-0.12, 0.12)
          const dx = Math.cos(th) * sentido
          const dy = Math.sin(th)
          const yAlvo = limitar(alvo.y, l.top + 4, l.bottom - 12)
          const subir = (yAlvo - l.top) / dy
          const entrada = { x: alvo.x - dx * subir, y: l.top }
          const fundoY = l.bottom - cfg.espessura / 2
          const descer = (fundoY - yAlvo) / dy
          const fundo = { x: alvo.x + dx * descer, y: fundoY }
          const volta = (fundoY - l.top) / dy
          const saida = { x: fundo.x + dx * volta, y: l.top }
          const linha = (p, q) => a.aviso({ tipo: 'linha', x1: p.x, y1: p.y, x2: q.x, y2: q.y, espessura: cfg.espessura, ms: aviso })
          linha(entrada, fundo)
          linha(fundo, saida)
          a.depois(aviso, () => {
            tocar(a.cena, 'hab-berdly-vento')
            let subiu = false
            let rastro = 0
            const recuo = cfg.comprimento / 2 + 4
            a.bala({
              x: entrada.x - dx * recuo,
              y: entrada.y - dy * recuo,
              vx: dx * cfg.velocidade,
              vy: dy * cfg.velocidade,
              comprimento: cfg.comprimento,
              espessura: cfg.espessura,
              angulo: Math.atan2(dy, dx),
              textura: T('mergulho'),
              tamanho: cfg.comprimento * 1.1,
              jaAvisada: true,
              pulso: 0,
              atualizar: (b, dt) => {
                if (!subiu && b.y >= fundoY) {
                  subiu = true
                  b.y = fundoY
                  b.vy = -Math.abs(b.vy)
                  b.angulo = Math.atan2(b.vy, b.vx)
                  particulas(a.cena, b.x, l.bottom - 2, { cor: 0xd8f05a, quantidade: 8, velocidade: 90, vida: 300 })
                }
                // penugem caindo do rastro (só visual)
                rastro += dt
                if (rastro >= 55) {
                  rastro = 0
                  const p = a.decoracao(a.cena.add.image(b.x, b.y, T('plumas')).setDepth(3).setAlpha(0.85))
                  a.cena.tweens.add({ targets: p, y: b.y + 16, angle: a.aleatorio(-90, 90), duration: 520 })
                  sumir(a, p, 520)
                }
              },
            })
          })
        },
        Infinity,
        300,
      )
    },
  }),

  // ♦ CORREÇÃO: a caneta vermelha do Berdly marca um X em cima do coração
  // ("errado!"). As duas linhas do X piscam antes, a caneta risca uma de cada
  // vez e a tinta fica um pouco na caixa antes de secar.
  berdlyCorrecao: definirAtaque({
    nome: 'berdlyCorrecao',
    padrao: { duracao: 4000, intervalo: 1400, tamanho: 32, traco: 260, aviso: 450, tinta: 1000, espessura: 7 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const COR = 0xff4040

      const riscar = (caneta, [x1, y1, x2, y2]) => {
        const comprimento = Math.hypot(x2 - x1, y2 - y1)
        const angulo = Math.atan2(y2 - y1, x2 - x1)
        const n = Math.ceil(comprimento / 9)
        tocar(a.cena, 'hab-berdly-caneta')
        caneta.setPosition(x1, y1)
        a.cena.tweens.add({ targets: caneta, x: x2, y: y2, duration: cfg.traco })
        for (let j = 0; j < n; j++) {
          a.depois((j * cfg.traco) / n, () => {
            const f = (j + 0.5) / n
            a.bala({
              x: x1 + (x2 - x1) * f,
              y: y1 + (y2 - y1) * f,
              comprimento: comprimento / n + 3,
              espessura: cfg.espessura,
              angulo,
              textura: T('tinta'),
              tamanho: comprimento / n + 4,
              jaAvisada: true,
              atravessa: true,
              pulso: 0,
              vida: cfg.tinta,
              atualizar: (b) => {
                if (b.vida < 300) b.sprite.setAlpha(Math.max(0.15, b.vida / 300))
              },
            })
          })
        }
      }

      a.aCada(
        cfg.intervalo,
        () => {
          const l = a.caixa
          const alvo = a.alvo()
          const h = cfg.tamanho
          const cx = limitar(alvo.x, l.left + h * 0.5, l.right - h * 0.5)
          const cy = limitar(alvo.y, l.top + h * 0.5, l.bottom - h * 0.5)
          const tracos = [
            [cx - h, cy - h, cx + h, cy + h],
            [cx + h, cy - h, cx - h, cy + h],
          ]
          const caneta = a.decoracao(
            a.cena.add
              .image(tracos[0][0], tracos[0][1], T('caneta'))
              .setOrigin(1.5 / 22, 20.5 / 22)
              .setDepth(7)
              .setScale(1.3)
              .setAlpha(0),
          )
          a.cena.tweens.add({ targets: caneta, alpha: 1, duration: 200 })
          tracos.forEach((tr, k) => {
            const espera = aviso + k * (cfg.traco + 60)
            a.aviso({ tipo: 'linha', x1: tr[0], y1: tr[1], x2: tr[2], y2: tr[3], espessura: cfg.espessura, cor: COR, ms: espera }, () => riscar(caneta, tr))
          })
          sumir(a, caneta, 200, { delay: aviso + 2 * cfg.traco + 120 })
        },
        Infinity,
        300,
      )
    },
  }),

  // ♦ RAJADA DE VENTO: uma faixa na altura do coração pisca e uma lufada de
  // vento atravessa a caixa por ela (vários riscos de vento de uma vez).
  berdlyRajada: definirAtaque({
    nome: 'berdlyRajada',
    padrao: { duracao: 5000, intervalo: 1100, riscos: 5, faixa: 34, velocidade: 300, aviso: 480, eco: false },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const meia = cfg.faixa / 2

      const lufada = (daEsquerda, y) => {
        const l = a.caixa
        a.aviso({ tipo: 'area', x: l.left, y: y - meia, largura: l.width, altura: cfg.faixa, cor: 0x9fe8ff, ms: aviso }, () => {
          tocar(a.cena, 'hab-berdly-vento')
          const dir = daEsquerda ? 1 : -1
          for (let k = 0; k < cfg.riscos; k++) {
            a.depois(k * 55, () => {
              const b = a.bala({
                x: daEsquerda ? l.left - 18 : l.right + 18,
                y: y + a.aleatorio(-meia + 4, meia - 4),
                largura: 24,
                altura: 6,
                vx: dir * cfg.velocidade * a.aleatorio(0.9, 1.15),
                vy: a.aleatorio(-12, 12),
                textura: T('rajada'),
                tamanho: 30,
                jaAvisada: true,
              })
              b.sprite.setFlipX(!daEsquerda)
            })
          }
          // riscos de vento só visuais por cima da faixa
          for (let k = 0; k < 3; k++) {
            const v = a.decoracao(
              a.cena.add.image(daEsquerda ? l.left : l.right, y + (k - 1) * meia * 0.7, T('vento')).setDepth(3).setAlpha(0.8).setScale(1.4, 1),
            )
            a.cena.tweens.add({ targets: v, x: daEsquerda ? l.right : l.left, duration: 380, delay: k * 60 })
            sumir(a, v, 380, { delay: k * 60 })
          }
        })
      }

      a.aCada(
        cfg.intervalo,
        (i) => {
          const l = a.caixa
          const daEsquerda = i % 2 === 0
          const y = limitar(a.alvo().y, l.top + meia, l.bottom - meia)
          lufada(daEsquerda, y)
          if (cfg.eco) {
            const yEco = limitar(y + (y > l.centerY ? -1 : 1) * cfg.faixa * 1.3, l.top + meia, l.bottom - meia)
            a.depois(420, () => lufada(!daEsquerda, yEco))
          }
        },
        Infinity,
        300,
      )
    },
  }),

  // ♦ CÁLCULO GENIAL: símbolos de matemática saem do alto numa tabela
  // calculada: batem numa parede e ricocheteiam direto no coração. A
  // trajetória (com o ângulo, claro) aparece antes.
  berdlyCalculo: definirAtaque({
    nome: 'berdlyCalculo',
    padrao: { duracao: 5000, intervalo: 1300, tiros: 2, cadencia: 260, velocidade: 170, aviso: 600, raio: 6 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const paredes = ['left', 'bottom', 'right']

      const tiro = (n) => {
        const l = a.caixa
        const r = cfg.raio
        const alvo = a.alvo()
        const origem = { x: a.aleatorio(l.left + 16, l.right - 16), y: l.top + r + 3 }
        const parede = paredes[n % paredes.length]
        // o "espelho" do coração na parede: mirar nele faz a bala ricochetear no coração
        const espelho = {
          left: { x: 2 * (l.left + r) - alvo.x, y: alvo.y },
          right: { x: 2 * (l.right - r) - alvo.x, y: alvo.y },
          bottom: { x: alvo.x, y: 2 * (l.bottom - r) - alvo.y },
        }[parede]
        let batida
        if (parede === 'bottom') {
          const f = (l.bottom - r - origem.y) / (espelho.y - origem.y)
          batida = { x: origem.x + (espelho.x - origem.x) * f, y: l.bottom - r }
        } else {
          const xp = parede === 'left' ? l.left + r : l.right - r
          const f = (xp - origem.x) / (espelho.x - origem.x)
          batida = { x: xp, y: origem.y + (espelho.y - origem.y) * f }
        }
        const dir = Math.atan2(espelho.y - origem.y, espelho.x - origem.x)
        const volta = Math.atan2(alvo.y - batida.y, alvo.x - batida.x)
        a.aviso({ tipo: 'linha', x1: origem.x, y1: origem.y, x2: batida.x, y2: batida.y, espessura: 2, cor: 0xd8f05a, ms: aviso })
        a.aviso({ tipo: 'linha', x1: batida.x, y1: batida.y, x2: alvo.x + Math.cos(volta) * 30, y2: alvo.y + Math.sin(volta) * 30, espessura: 2, cor: 0xd8f05a, ms: aviso })
        // ângulo entre a trajetória e a parede (o "cálculo" que ele faz questão de mostrar)
        const [ddx, ddy] = [Math.abs(Math.cos(dir)), Math.abs(Math.sin(dir))]
        const graus = Math.round((Math.atan2(parede === 'bottom' ? ddy : ddx, parede === 'bottom' ? ddx : ddy) * 180) / Math.PI)
        rotulo(a, limitar(batida.x, l.left + 18, l.right - 18), limitar(batida.y, l.top + 12, l.bottom - 12), `${graus}°`, aviso)
        tocar(a.cena, 'hab-berdly-calculo')
        a.bala({
          x: origem.x,
          y: origem.y,
          vx: Math.cos(dir) * cfg.velocidade,
          vy: Math.sin(dir) * cfg.velocidade,
          raio: r,
          textura: T('simbolos'),
          quadro: n % 6,
          tamanho: 16,
          girar: 3,
          pulso: 0,
          quicar: 1,
          aviso,
        })
      }

      let n = 0
      a.aCada(
        cfg.intervalo,
        () => {
          for (let k = 0; k < cfg.tiros; k++) {
            const m = n++
            a.depois(k * cfg.cadencia, () => tiro(m))
          }
        },
        Infinity,
        300,
      )
    },
  }),

  // ♦ TORNADO: um funil de vento nasce numa borda, atravessa a caixa
  // perseguindo devagar a altura do coração e cospe detritos (papel, folha,
  // lápis) que sobem e caem em arco.
  berdlyTornado: definirAtaque({
    nome: 'berdlyTornado',
    padrao: { duracao: 5500, intervalo: 2000, velocidade: 85, deriva: 30, largura: 20, altura: 52, detritos: 450, velocidadeDetrito: 110, gravidade: 170 },
    iniciar(a, cfg) {
      const cuspir = (t) => {
        const ang = a.aleatorio(-Math.PI * 0.85, -Math.PI * 0.15)
        a.bala({
          x: t.x + a.aleatorio(-6, 6),
          y: t.y - cfg.altura / 2 + 6,
          raio: 4,
          textura: T('detrito'),
          quadro: a.inteiro(0, 2),
          tamanho: 11,
          vx: Math.cos(ang) * cfg.velocidadeDetrito,
          vy: Math.sin(ang) * cfg.velocidadeDetrito,
          ay: cfg.gravidade,
          girar: a.escolher([-6, 6]),
          pulso: 0,
        })
      }

      a.aCada(
        cfg.intervalo,
        (i) => {
          const l = a.caixa
          const daEsquerda = i % 2 === 0
          const dir = daEsquerda ? 1 : -1
          const meiaAltura = cfg.altura / 2
          let alvoY = a.alvo().y
          let relogio = 0
          let acumulado = 0
          tocar(a.cena, 'hab-berdly-vento')
          a.bala({
            x: daEsquerda ? l.left + cfg.largura / 2 + 2 : l.right - cfg.largura / 2 - 2,
            y: limitar(alvoY, l.top + meiaAltura, l.bottom - meiaAltura),
            largura: cfg.largura,
            altura: cfg.altura,
            vx: dir * cfg.velocidade,
            textura: T('tornado'),
            tamanho: cfg.altura * 1.1,
            aviso: 550,
            atravessa: true,
            atualizar: (b, dt) => {
              const lim = a.caixa
              relogio += dt
              b.sprite.setFrame(Math.floor(relogio / 90) % 2)
              if (Math.floor(relogio / 300) !== Math.floor((relogio - dt) / 300)) alvoY = a.alvo().y
              const passo = cfg.deriva * fator(a) * (dt / 1000)
              b.y = limitar(b.y + limitar(alvoY - b.y, -passo, passo), lim.top + meiaAltura, lim.bottom - meiaAltura)
              acumulado += dt
              if (acumulado >= cfg.detritos) {
                acumulado -= cfg.detritos
                cuspir(b)
              }
              if (b.x < lim.left - cfg.largura || b.x > lim.right + cfg.largura) b.morta = true
            },
          })
        },
        Infinity,
        300,
      )
    },
  }),

  // ♦ QI ELEVADO: o gráfico do QI do Berdly sobe na caixa. Colunas crescem
  // do chão em escada (a mais alta do lado do coração); na vez seguinte o
  // gráfico vem de cabeça para baixo, do teto. Cada coluna pisca antes.
  berdlyQI: definirAtaque({
    nome: 'berdlyQI',
    padrao: { duracao: 6000, intervalo: 1600, colunas: 5, aviso: 450, escalonar: 90, subida: 220, descida: 220, folga: 62 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      let qi = 140
      a.aCada(
        cfg.intervalo,
        (i) => {
          const l = a.caixa
          const n = cfg.colunas
          const slot = l.width / n
          const largura = slot - 5
          const doTeto = i % 2 === 1
          const alvo = a.alvo()
          const subindoParaDireita = alvo.x >= l.centerX // a coluna mais alta fica do lado do coração
          const maxima = l.height - cfg.folga
          const minima = l.height * 0.2
          // as colunas somem antes das da próxima vez começarem a valer (o relógio real do aCada)
          const intervaloReal = cfg.intervalo / a.ritmo.densidade
          const fixa = Math.max(200, intervaloReal - cfg.escalonar * (n - 1) - cfg.subida - cfg.descida - 150)
          qi += 10
          for (let k = 0; k < n; k++) {
            const degrau = subindoParaDireita ? k : n - 1 - k
            const altura = minima + ((maxima - minima) * degrau) / (n - 1)
            const x = l.left + slot * k + slot / 2
            const ordem = degrau // da mais baixa para a mais alta
            const yFinal = doTeto ? l.top + altura / 2 : l.bottom - altura / 2
            const yEscondida = doTeto ? l.top - altura / 2 : l.bottom + altura / 2
            a.aviso(
              { tipo: 'area', x: x - largura / 2, y: doTeto ? l.top : l.bottom - altura, largura, altura, cor: 0xd8f05a, ms: aviso + ordem * cfg.escalonar },
              () => {
                let relogio = 0
                const b = a.bala({
                  x,
                  y: yEscondida,
                  largura,
                  altura,
                  textura: T('barra'),
                  jaAvisada: true,
                  atravessa: true,
                  atualizar: (b, dt) => {
                    relogio += dt * fator(a)
                    let f
                    if (relogio < cfg.subida) f = relogio / cfg.subida
                    else if (relogio < cfg.subida + fixa) f = 1
                    else f = 1 - (relogio - cfg.subida - fixa) / cfg.descida
                    if (f <= 0 && relogio > cfg.subida) {
                      b.morta = true
                      return
                    }
                    b.y = yEscondida + (yFinal - yEscondida) * Math.min(1, f)
                  },
                })
                b.sprite.setDisplaySize(largura + 2, altura).setFlipY(doTeto)
                if (degrau === n - 1) {
                  tocar(a.cena, 'hab-berdly-calculo')
                  rotulo(a, x, doTeto ? l.top + altura + 10 : l.bottom - altura - 10, `QI ${qi}`, cfg.subida + fixa)
                }
              },
            )
          }
        },
        Infinity,
        300,
      )
    },
  }),

  // ♦ VENDAVAL SUPREMO: a ventania leva o material escolar da sala inteira
  // (livros, folhas, lápis, óculos) atravessando a caixa; no meio o vento vira
  // (a seta no alto avisa) e tudo passa a vir do outro lado.
  berdlyVendaval: definirAtaque({
    nome: 'berdlyVendaval',
    padrao: { duracao: 7000, intervalo: 300, velocidade: 170, amplitude: 16, aviso: 450, avisoVirada: 700, mirar: 0.34 },
    iniciar(a, cfg) {
      let sentido = 1
      let mira = 0.5
      const seta = a.decoracao(a.cena.add.image(a.caixa.centerX, a.caixa.top + 12, T('seta')).setDepth(7).setAlpha(0.85))

      // riscos de vento no fundo (só visual), sempre a favor do vento
      a.aCada(110, () => {
        const l = a.caixa
        const y = a.aleatorio(l.top + 4, l.bottom - 4)
        const v = a.decoracao(a.cena.add.image(sentido > 0 ? l.left - 20 : l.right + 20, y, T('vento')).setDepth(2).setAlpha(0.5))
        a.cena.tweens.add({ targets: v, x: sentido > 0 ? l.right + 20 : l.left - 20, y: y + 10, duration: 420 })
        sumir(a, v, 150, { delay: 300 })
      })

      // a virada do vento: a seta pisca e gira antes
      const virada = Math.round(cfg.duracao / 2)
      a.depois(virada - cfg.avisoVirada, () => {
        a.cena.tweens.add({ targets: seta, alpha: 0.2, duration: 90, yoyo: true, repeat: Math.floor(cfg.avisoVirada / 180) })
      })
      a.depois(virada, () => {
        sentido = -1
        seta.setFlipX(true).setAlpha(0.85)
        tocar(a.cena, 'hab-berdly-vento')
      })

      a.aCada(
        cfg.intervalo,
        (i) => {
          const l = a.caixa
          mira += cfg.mirar
          const mirada = mira >= 1
          if (mirada) mira -= 1
          const y = mirada ? limitar(a.alvo().y, l.top + 8, l.bottom - 8) : a.aleatorio(l.top + 8, l.bottom - 8)
          const fase = a.aleatorio(0, Math.PI * 2)
          const vy0 = a.aleatorio(-6, 18)
          let voo = 0
          if (i % 4 === 0) tocar(a.cena, 'hab-berdly-vento')
          a.bala({
            x: sentido > 0 ? l.left - 10 : l.right + 10,
            y,
            raio: 6,
            vx: sentido * cfg.velocidade * a.aleatorio(0.85, 1.15),
            vy: vy0,
            textura: T('material'),
            quadro: i % 4,
            tamanho: 16,
            girar: sentido * a.aleatorio(3, 7),
            pulso: 0,
            aviso: Math.max(ATAQUE.telegrafoMs, cfg.aviso),
            atualizar: (b, dt) => {
              voo += dt / 1000
              b.vy = vy0 + Math.cos(voo * 5 + fase) * cfg.amplitude * 5
            },
          })
        },
        Infinity,
        250,
      )
    },
  }),

  // ♣ PENA ARMADA: penas-dardo são cravadas no chão em volta do coração,
  // apontando para ele, e ficam tremendo (armadas). A linha de tiro pisca e,
  // depois de um tempo, elas disparam para onde ele estava.
  berdlyPenaArmada: definirAtaque({
    nome: 'berdlyPenaArmada',
    padrao: { duracao: 5000, intervalo: 1300, quantidade: 2, distancia: 64, armar: 1100, velocidade: 270, comprimento: 22, espessura: 7 },
    iniciar(a, cfg) {
      const armar = Math.max(ATAQUE.telegrafoMs, cfg.armar)
      a.aCada(
        cfg.intervalo,
        () => {
          const alvo = a.alvo()
          const base = a.aleatorio(0, Math.PI * 2)
          for (let k = 0; k < cfg.quantidade; k++) {
            const ang = base + (k * Math.PI * 2) / cfg.quantidade + a.aleatorio(-0.3, 0.3)
            const p = pontoEmVolta(a, alvo, cfg.distancia, 12, ang)
            const dir = Math.atan2(alvo.y - p.y, alvo.x - p.x)
            const pena = a.decoracao(a.cena.add.image(p.x, p.y, T('pena-armada')).setDepth(6).setRotation(dir).setScale(2).setAlpha(0))
            a.cena.tweens.add({ targets: pena, scale: 1, alpha: 1, duration: 140, ease: 'Quad.easeIn' })
            a.cena.tweens.add({ targets: pena, rotation: dir + 0.09, duration: 60, yoyo: true, repeat: -1, delay: 160 })
            const espera = armar + k * 120
            a.aviso({ tipo: 'linha', x1: p.x, y1: p.y, x2: p.x + Math.cos(dir) * 260, y2: p.y + Math.sin(dir) * 260, espessura: cfg.espessura, ms: espera }, () => {
              a.cena.tweens.killTweensOf(pena)
              pena.destroy()
              tocar(a.cena, 'hab-berdly-bicada')
              a.bala({
                x: p.x,
                y: p.y,
                vx: Math.cos(dir) * cfg.velocidade,
                vy: Math.sin(dir) * cfg.velocidade,
                comprimento: cfg.comprimento,
                espessura: cfg.espessura,
                angulo: dir,
                textura: T('pena-armada'),
                tamanho: cfg.comprimento * 1.1,
                jaAvisada: true,
                pulso: 0,
              })
            })
          }
        },
        Infinity,
        300,
      )
    },
  }),

  // ♣ CICLONE: o olho de um ciclone se arma no chão perto do coração. O
  // círculo dele pisca; então uma roda de folhas aparece na borda e é sugada
  // girando até o centro, que no fim cospe algumas folhas para fora.
  berdlyCiclone: definirAtaque({
    nome: 'berdlyCiclone',
    padrao: { duracao: 6000, intervalo: 1600, folhas: 8, raio: 78, sugar: 1500, giro: 2.4, aviso: 650, estouro: 5, velocidadeEstouro: 120, distancia: 42 },
    iniciar(a, cfg) {
      const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
      const raioFolha = 5
      a.lacuna(((Math.PI * 2) / cfg.folhas) * cfg.raio - 2 * raioFolha, 'vão entre as folhas do ciclone')
      a.aCada(
        cfg.intervalo,
        (i) => {
          const c = pontoEmVolta(a, a.alvo(), cfg.distancia, 26)
          const olho = a.decoracao(a.cena.add.sprite(c.x, c.y, T('ciclone'), 0).setDepth(3).setScale(0.2).setAlpha(0.9))
          a.cena.tweens.add({ targets: olho, scale: 1.2, duration: aviso })
          a.cena.tweens.add({ targets: olho, angle: 360, duration: 700, repeat: -1 })
          a.aviso({ tipo: 'circulo', x: c.x, y: c.y, raio: cfg.raio, cor: 0x9fe8ff, ms: aviso }, () => {
            tocar(a.cena, 'hab-berdly-vento')
            a.aviso({ tipo: 'circulo', x: c.x, y: c.y, raio: 16, cor: 0x9fe8ff, ms: Math.max(ATAQUE.telegrafoMs, cfg.sugar) })
            const sentido = i % 2 ? -1 : 1
            for (let k = 0; k < cfg.folhas; k++) {
              const ang0 = (k * Math.PI * 2) / cfg.folhas
              let relogio = 0
              a.bala({
                x: c.x + Math.cos(ang0) * cfg.raio,
                y: c.y + Math.sin(ang0) * cfg.raio,
                raio: raioFolha,
                textura: T('folha'),
                quadro: k % 2,
                tamanho: 12,
                jaAvisada: true,
                pulso: 0,
                atualizar: (b, dt) => {
                  relogio += dt * fator(a)
                  const f = relogio / cfg.sugar
                  if (f >= 1) {
                    b.morta = true
                    return
                  }
                  const r = cfg.raio * (1 - f) ** 1.3
                  const ang = ang0 + sentido * cfg.giro * (relogio / 1000)
                  b.x = c.x + Math.cos(ang) * r
                  b.y = c.y + Math.sin(ang) * r
                  b.sprite.rotation = ang + Math.PI / 2
                },
              })
            }
            a.depois(Math.max(ATAQUE.telegrafoMs, cfg.sugar), () => {
              particulas(a.cena, c.x, c.y, { cor: 0x9fe8ff, quantidade: 10, velocidade: 110, vida: 320 })
              const giro = a.aleatorio(0, Math.PI * 2)
              for (let k = 0; k < cfg.estouro; k++) {
                const ang = giro + (k * Math.PI * 2) / cfg.estouro
                a.bala({
                  x: c.x,
                  y: c.y,
                  raio: raioFolha,
                  vx: Math.cos(ang) * cfg.velocidadeEstouro,
                  vy: Math.sin(ang) * cfg.velocidadeEstouro,
                  textura: T('folha'),
                  quadro: k % 2,
                  tamanho: 12,
                  girar: 6 * sentido,
                  jaAvisada: true,
                  pulso: 0,
                })
              }
              a.cena.tweens.killTweensOf(olho)
              sumir(a, olho, 300, { scale: 0.2 })
            })
          })
        },
        Infinity,
        300,
      )
    },
  }),
}
