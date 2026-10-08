import { definirAtaque } from '../definir.js'
import { ATAQUE, FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Noelle: SNOWGRAVE. A caixa esfria até virar um túmulo de gelo, em
// três atos:
//
//   I. O frio. Um SELO de floco de neve gigante aparece no meio da caixa,
//      girando, e solta flocos pelos braços (um "regador" de 3 braços que
//      desenha espirais). O giro inverte no meio do ato.
//   II. Nevasca. A caixa embranquece, o vento uiva e PAREDES de estilhaços
//      de gelo atravessam a caixa de um lado para o outro. Cada parede tem
//      UMA brecha, que serpenteia devagar de uma parede para a próxima.
//      No meio da nevasca o vento muda de lado (com uma pausa antes).
//   III. SNOWGRAVE. O nome aparece, o selo cresce e brilha, e COLUNAS de gelo
//      explodem do chão: metade delas de uma vez (as ímpares), depois a outra
//      metade (as pares). No fim, um quadrado de luz marca o ÚNICO lugar
//      seguro: o resto da caixa vira espinhos de gelo.
//
// Justiça:
//   - os braços do regador saem do selo, que gira à vista (o selo é o aviso);
//     entre dois braços sobra mais que LACUNA_MINIMA a partir do raio do selo;
//     o NÚCLEO do selo machuca (avisa antes, como toda bala): ninguém se esconde
//     no meio enquanto o regador gira;
//   - toda parede da nevasca tem uma brecha >= LACUNA_MINIMA, e a brecha da
//     parede seguinte anda no máximo `serpenteia` px (dá tempo de acompanhar);
//     o vento só muda de lado depois que a última parede saiu da caixa;
//   - cada coluna de gelo tem aviso (a.aviso) de `avisoColuna` ms; as ímpares
//     e as pares nunca valem ao mesmo tempo, e entre o fim de uma leva e o
//     começo da outra dá tempo de atravessar uma coluna;
//   - o lugar seguro do final é um BURACO no aviso (quatro faixas avisando em
//     volta dele), com lado >= LACUNA_MINIMA, aparece `avisoFinal` ms antes e
//     fica perto o bastante do coração para chegar com folga.
//
// Config:
//   bracos, giro, intervaloFloco, velocidadeFloco   o regador do ato I
//   fimRegador                                      quando o regador para
//   nevasca, fimNevasca                             janela das paredes
//   intervaloParede, velocidadeParede, brecha       as paredes de estilhaços
//   serpenteia                                      quanto a brecha anda entre paredes
//   troca                                           quando o vento muda de lado
//   snowgrave                                       quando o ato III começa
//   avisoColuna, levas                              as colunas (ms de cada leva, a partir do ato III)
//   avisoFinal, raioSeguro, distanciaSeguro         o golpe final (raioSeguro = meio lado do buraco)
export default definirAtaque({
  nome: 'superNoelle',
  padrao: {
    duracao: 9000,
    bracos: 3,
    giro: 0.9,
    intervaloFloco: 170,
    velocidadeFloco: 78,
    fimRegador: 3200,
    nevasca: 3300,
    fimNevasca: 6000,
    troca: 4700,
    intervaloParede: 600,
    velocidadeParede: 140,
    brecha: 54,
    serpenteia: 46,
    snowgrave: 6100,
    avisoColuna: 480,
    levas: [250, 820],
    avisoFinal: 780,
    raioSeguro: 30,
    distanciaSeguro: 85,
  },
  iniciar(a, cfg) {
    garantirTexturas(a.cena)
    const estado = { angulo: 0, sentido: 1, selo: criarSelo(a), veu: criarVeu(a) }
    tocar(a.cena, 'snowgraveFrio')

    // o selo gira o ataque todo (mais rápido no ato III)
    a.aoAtualizar((dt) => {
      estado.angulo += estado.sentido * cfg.giro * (dt / 1000) * (estado.furia ? 2.2 : 1)
      estado.selo.setRotation(estado.angulo)
    })

    regador(a, cfg, estado)
    a.depois(cfg.nevasca, () => nevasca(a, cfg, estado))
    a.depois(cfg.snowgrave, () => snowgrave(a, cfg, estado))
  },
})

// ---------- texturas (geradas uma vez) ----------

export function garantirTexturas(cena) {
  if (cena.textures.exists('super-noelle-floco')) return
  const g = cena.make.graphics({ x: 0, y: 0 }, false)
  const desenharFloco = (cx, cy, r, espessura) => {
    g.lineStyle(espessura, 0xffffff, 1)
    for (let b = 0; b < 6; b++) {
      const ang = (b * Math.PI) / 3
      const ex = cx + Math.cos(ang) * r
      const ey = cy + Math.sin(ang) * r
      g.lineBetween(cx, cy, ex, ey)
      const mx = cx + Math.cos(ang) * r * 0.55
      const my = cy + Math.sin(ang) * r * 0.55
      g.lineBetween(mx, my, mx + Math.cos(ang + 0.75) * r * 0.38, my + Math.sin(ang + 0.75) * r * 0.38)
      g.lineBetween(mx, my, mx + Math.cos(ang - 0.75) * r * 0.38, my + Math.sin(ang - 0.75) * r * 0.38)
    }
    g.fillStyle(0xffffff, 1).fillCircle(cx, cy, espessura)
  }
  desenharFloco(8, 8, 7, 1.6)
  g.generateTexture('super-noelle-floco', 16, 16)
  g.clear()
  desenharFloco(64, 64, 60, 3)
  g.generateTexture('super-noelle-selo', 128, 128)
  // lasca de gelo deitada (ponta para a direita): os estilhaços da nevasca
  g.clear()
  g.fillStyle(0x9fd8ff, 1).fillTriangle(0, 4, 8, 0, 8, 8)
  g.fillStyle(0xeaf7ff, 1).fillTriangle(8, 0, 22, 4, 8, 8)
  g.fillStyle(0xffffff, 1).fillTriangle(9, 3, 20, 4, 9, 5)
  g.generateTexture('super-noelle-lasca', 22, 8)
  g.destroy()
}

// ---------- visual de fundo ----------

function criarSelo(a) {
  const l = a.caixa
  const selo = a.decoracao(a.cena.add.image(l.centerX, l.centerY, 'super-noelle-selo').setDepth(2).setTint(0xbfe8ff).setAlpha(0).setScale(0.2))
  a.cena.tweens.add({ targets: selo, alpha: 0.55, scale: 0.55, duration: 600, ease: 'Back.easeOut' })
  return selo
}

function criarVeu(a) {
  const l = a.caixa
  // frio: azul-escuro por baixo de tudo (as balas brancas saltam aos olhos)
  const frio = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0x0b2a55).setDepth(1).setAlpha(0))
  a.cena.tweens.add({ targets: frio, alpha: 0.55, duration: 700 })
  // geada nas bordas
  const geada = a.decoracao(a.cena.add.graphics().setDepth(3))
  for (let k = 0; k < 3; k++) {
    geada.lineStyle(6 - k * 2, 0xdff6ff, 0.25 + k * 0.15)
    geada.strokeRect(l.left + 2 + k * 3, l.top + 2 + k * 3, l.width - 4 - k * 6, l.height - 4 - k * 6)
  }
  geada.setAlpha(0)
  a.cena.tweens.add({ targets: geada, alpha: 1, duration: 900 })
  // neve calma (enfeite, sem colisão)
  const neve = a.decoracao(
    a.cena.add.particles(l.centerX, l.top - 6, 'faisca', {
      x: { min: l.left - l.centerX, max: l.right - l.centerX },
      quantity: 1,
      frequency: 90,
      lifespan: 2600,
      speedY: { min: 30, max: 55 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.6, end: 0.25 },
      alpha: { start: 0.55, end: 0 },
      tint: 0xdff6ff,
    }),
  )
  neve.setDepth(3)
  return { frio, geada, neve }
}

// ---------- ato I: o regador do selo ----------

function regador(a, cfg, estado) {
  const passo = (Math.PI * 2) / cfg.bracos
  const raioSaida = 24
  // o núcleo do selo: machuca enquanto o regador gira (aviso padrão de bala)
  const l0 = a.caixa
  const nucleo = a.bala({ x: l0.centerX, y: l0.centerY, raio: 16, textura: 'super-noelle-floco', tamanho: 40, cor: 0xbfe8ff, girar: -2, atravessa: true, pulso: 0.12 })
  a.depois(cfg.fimRegador, () => {
    nucleo.inofensiva = true
    a.cena.tweens.add({ targets: nucleo.sprite, alpha: 0, scale: 0.2, duration: 300, onComplete: () => (nucleo.morta = true) })
  })
  // a partir do raio do selo, dois braços vizinhos ficam a mais que a lacuna
  a.lacuna(raioSaida * passo * 1.6, 'entre os braços do selo')
  a.depois(cfg.fimRegador / 2, () => {
    estado.sentido *= -1 // o giro inverte no meio do ato
    tocar(a.cena, 'super-noelle-tique')
  })
  a.aCada(
    cfg.intervaloFloco,
    () => {
      if (a.tempo >= cfg.fimRegador) return
      const l = a.caixa
      for (let k = 0; k < cfg.bracos; k++) {
        const ang = estado.angulo + k * passo
        a.bala({
          x: l.centerX + Math.cos(ang) * raioSaida,
          y: l.centerY + Math.sin(ang) * raioSaida,
          vx: Math.cos(ang) * cfg.velocidadeFloco,
          vy: Math.sin(ang) * cfg.velocidadeFloco,
          raio: 5,
          textura: 'super-noelle-floco',
          tamanho: 14,
          cor: 0xeaf7ff,
          girar: 3,
          jaAvisada: true,
        })
      }
    },
    Infinity,
    300,
  )
}

// ---------- ato II: a nevasca ----------

function nevasca(a, cfg, estado) {
  const l = a.caixa
  tocar(a.cena, 'super-noelle-vento')
  shake(a.cena, 200, 0.005)
  const branco = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0xeaf7ff).setDepth(3).setAlpha(0))
  a.cena.tweens.add({ targets: branco, alpha: 0.22, duration: 600 })
  estado.branco = branco
  // vento: riscos brancos atravessando a caixa no sentido da nevasca
  const vento = a.decoracao(a.cena.add.graphics().setDepth(3))
  let fase = 0
  a.aoAtualizar((dt) => {
    if (a.tempo >= cfg.fimNevasca) return vento.clear()
    fase += dt
    const lado = a.tempo < cfg.troca ? 1 : -1
    vento.clear().lineStyle(1, 0xffffff, 0.35)
    for (let k = 0; k < 9; k++) {
      const y = l.top + ((k * 37 + fase * 0.013) % l.height)
      const x = l.left + ((k * 71 + lado * fase * 0.42) % (l.width + 60) + l.width + 60) % (l.width + 60) - 30
      vento.lineBetween(x, y, x - lado * 24, y)
    }
  })

  a.lacuna(cfg.brecha, 'brecha da parede de gelo')
  let centro = l.centerY
  let lado = 1
  let ultimaSaida = 0
  const paredes = []
  for (let t = 0; cfg.nevasca + t < cfg.fimNevasca - 600; t += cfg.intervaloParede) {
    const quando = cfg.nevasca + t
    // o vento muda de lado: a última parede do lado antigo já saiu da caixa
    const depoisDaTroca = quando >= cfg.troca
    if (depoisDaTroca && lado === 1) {
      if (quando < ultimaSaida) continue
      lado = -1
    }
    paredes.push({ quando, lado })
    ultimaSaida = quando + ((l.width + 40) / cfg.velocidadeParede) * 1000
  }
  paredes.forEach((p, i) =>
    a.depois(p.quando - cfg.nevasca, () => {
      // a brecha serpenteia: anda no máximo `serpenteia` px de uma parede para a outra
      const margem = cfg.brecha / 2 + 6
      const desejo = a.caixa.centerY + Math.sin(i * 1.3) * (a.caixa.height / 2 - margem)
      centro = Math.max(a.caixa.top + margem, Math.min(a.caixa.bottom - margem, centro + Math.max(-cfg.serpenteia, Math.min(cfg.serpenteia, desejo - centro))))
      parede(a, cfg, centro, p.lado)
    }),
  )
  a.depois(cfg.troca - cfg.nevasca, () => tocar(a.cena, 'super-noelle-vento'))
  a.depois(cfg.fimNevasca - cfg.nevasca, () => a.cena.tweens.add({ targets: branco, alpha: 0.08, duration: 500 }))
}

// Uma parede de estilhaços atravessando a caixa, com uma brecha em `centro`
function parede(a, cfg, centro, lado) {
  const l = a.caixa
  const x = lado > 0 ? l.left - 10 : l.right + 10
  const passo = 13
  const ocupados = []
  for (let y = l.top + passo / 2; y < l.bottom; y += passo) {
    if (Math.abs(y - centro) < cfg.brecha / 2) continue
    ocupados.push([y - passo / 2, y + passo / 2])
    a.bala({
      x,
      y,
      vx: lado * cfg.velocidadeParede,
      comprimento: 16,
      espessura: 6,
      angulo: lado > 0 ? 0 : Math.PI, // a ponta da lasca vai na frente
      textura: 'super-noelle-lasca',
      tamanho: 20,
      jaAvisada: true,
    })
  }
  a.parede({ eixo: 'y', ocupados })
  tocar(a.cena, 'super-noelle-tique')
}

// ---------- ato III: SNOWGRAVE ----------

function snowgrave(a, cfg, estado) {
  const l = a.caixa
  estado.furia = true
  tocar(a.cena, 'snowgrave')
  shake(a.cena, 400, 0.01)
  estado.veu.neve.stop?.()
  a.cena.tweens.add({ targets: estado.selo, scale: 1.25, alpha: 0.85, duration: 700, ease: 'Cubic.easeOut' })
  a.cena.tweens.add({ targets: estado.veu.frio, alpha: 0.8, duration: 700 })

  // o nome, em letras de gelo
  const nome = a.decoracao(
    a.cena.add
      .text(l.centerX, l.top + 18, 'SNOWGRAVE', { fontFamily: FONTE, fontSize: '22px', color: '#dff6ff', stroke: '#0b2a55', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0)
      .setScale(1.8),
  )
  a.cena.tweens.add({ targets: nome, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut' })
  a.cena.tweens.add({ targets: nome, alpha: 0.55, duration: 300, delay: 500, yoyo: true, repeat: -1 })

  // colunas de gelo: as ímpares numa leva, as pares na outra
  // colunas largas: a coluna livre entre duas levas tem sempre mais que a lacuna
  const colunas = Math.max(3, Math.floor(l.width / (a.lacunaMinima + 4)))
  const largura = l.width / colunas
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoColuna)
  a.lacuna(largura, 'coluna livre entre as levas de gelo')
  cfg.levas.forEach((ms, paridade) =>
    a.depois(ms, () => {
      tocar(a.cena, 'super-noelle-tique')
      for (let k = paridade; k < colunas; k += 2) {
        const x = a.caixa.left + (k + 0.5) * largura
        a.aviso({ tipo: 'area', x: x - largura / 2 + 2, y: a.caixa.top, largura: largura - 4, altura: a.caixa.height, ms: aviso, cor: 0x9fd8ff }, () => coluna(a, x, largura, k === paridade))
      }
    }),
  )

  // o golpe final: o único lugar seguro, e o resto vira espinhos
  const finalEm = cfg.duracao - cfg.snowgrave - cfg.avisoFinal - 420
  a.depois(finalEm, () => golpeFinal(a, cfg))
}

function coluna(a, x, largura, primeira) {
  const l = a.caixa
  if (primeira) {
    tocar(a.cena, 'super-noelle-estilhaco')
    shake(a.cena, 220, 0.01)
  }
  a.bala({
    x,
    y: l.centerY,
    largura: largura - 6,
    altura: l.height,
    textura: 'super-noelle-feixe',
    jaAvisada: true,
    vida: 360,
    atravessa: true,
    pulso: 0,
    atualizar: (bala) => {
      if (bala.vida < 170) {
        bala.inofensiva = true
        bala.sprite.setAlpha(Math.max(0, bala.vida / 170))
      }
    },
  }).sprite.setRotation(Math.PI / 2)
  // cristais subindo pela coluna
  for (let i = 0; i < 4; i++) {
    const cristal = a.decoracao(a.cena.add.image(x + (i - 1.5) * 5, l.bottom, 'super-noelle-pingente').setDepth(6).setScale(0.8).setAlpha(0.95))
    a.cena.tweens.add({ targets: cristal, y: l.top + 20 + i * 18, alpha: 0, duration: 330, ease: 'Cubic.easeOut', onComplete: () => cristal.destroy() })
  }
  particulas(a.cena, x, l.bottom - 8, { cor: 0xeaf7ff, quantidade: 8, velocidade: 130, vida: 300 })
}

function golpeFinal(a, cfg) {
  const l = a.caixa
  const alvo = a.alvo()
  // o lugar seguro: a `distanciaSeguro` do coração (tem que se mexer), dentro da caixa
  const margem = cfg.raioSeguro + 8
  let melhor = null
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2 + a.aleatorio(0, 0.4)
    const p = {
      x: Math.max(l.left + margem, Math.min(l.right - margem, alvo.x + Math.cos(ang) * cfg.distanciaSeguro)),
      y: Math.max(l.top + margem, Math.min(l.bottom - margem, alvo.y + Math.sin(ang) * cfg.distanciaSeguro)),
    }
    p.d = Math.abs(Math.hypot(p.x - alvo.x, p.y - alvo.y) - cfg.distanciaSeguro)
    if (!melhor || p.d < melhor.d) melhor = p
  }
  const seguro = melhor
  a.lacuna(cfg.raioSeguro * 2, 'lugar seguro do SNOWGRAVE')
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoFinal)
  tocar(a.cena, 'super-noelle-vento')

  // quatro faixas avisam em volta do buraco seguro (o buraco não pisca: é ali)
  const r = cfg.raioSeguro
  const faixas = [
    { x: l.left, y: l.top, largura: l.width, altura: seguro.y - r - l.top },
    { x: l.left, y: seguro.y + r, largura: l.width, altura: l.bottom - seguro.y - r },
    { x: l.left, y: seguro.y - r, largura: seguro.x - r - l.left, altura: r * 2 },
    { x: seguro.x + r, y: seguro.y - r, largura: l.right - seguro.x - r, altura: r * 2 },
  ]
  let primeira = true
  for (const f of faixas) {
    if (f.largura < 2 || f.altura < 2) continue
    const disparar = primeira ? () => espinhos(a, cfg, seguro) : null
    primeira = false
    a.aviso({ tipo: 'area', ...f, ms: aviso, cor: 0x9fd8ff }, disparar)
  }
  const anel = a.decoracao(a.cena.add.graphics().setDepth(9).setPosition(seguro.x, seguro.y))
  anel.fillStyle(0xffffff, 0.22).fillRoundedRect(-r, -r, r * 2, r * 2, 8)
  anel.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-r, -r, r * 2, r * 2, 8)
  anel.setScale(2.2).setAlpha(0)
  a.cena.tweens.add({ targets: anel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' })
  a.cena.tweens.add({ targets: anel, alpha: 0.6, duration: 140, delay: 300, yoyo: true, repeat: -1 })
  a.depois(aviso, () => anel.destroy())
}

function espinhos(a, cfg, seguro) {
  const l = a.caixa
  tocar(a.cena, 'snowgraveFim')
  shake(a.cena, 420, 0.02)
  // clarão branco na caixa inteira
  const clarao = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0xffffff).setDepth(7).setAlpha(0.85))
  a.cena.tweens.add({ targets: clarao, alpha: 0, duration: 520, ease: 'Quad.easeOut' })
  const lado = 20
  for (let y = l.top + lado / 2; y < l.bottom; y += lado) {
    for (let x = l.left + lado / 2; x < l.right; x += lado) {
      // nada nasce dentro do buraco seguro (o quadrado do aviso)
      if (Math.abs(x - seguro.x) < cfg.raioSeguro + lado * 0.5 && Math.abs(y - seguro.y) < cfg.raioSeguro + lado * 0.5) continue
      const b = a.bala({
        x,
        y,
        largura: lado - 6,
        altura: lado - 4,
        textura: 'super-noelle-pingente',
        tamanho: lado + 14,
        jaAvisada: true,
        vida: 420,
        atravessa: true,
        pulso: 0,
        atualizar: (bala) => {
          if (bala.vida < 160) {
            bala.inofensiva = true
            bala.sprite.setAlpha(Math.max(0, bala.vida / 160))
          }
        },
      })
      // os espinhos brotam do chão numa onda que sai do buraco seguro
      const final = b.sprite.scale
      const atraso = Math.min(120, Math.hypot(x - seguro.x, y - seguro.y) * 0.5)
      b.sprite.setScale(final * 0.1, final * 0.1)
      a.cena.tweens.add({ targets: b.sprite, scaleX: final, scaleY: final * 1.15, duration: 110, delay: atraso, ease: 'Back.easeOut' })
    }
  }
  // estilhaços voando para todo lado
  for (let i = 0; i < 4; i++) {
    particulas(a.cena, l.left + ((i + 0.5) * l.width) / 4, l.centerY, { cor: i % 2 ? 0xffffff : 0xbfe8ff, quantidade: 18, velocidade: 300, vida: 600, escala: 1.4 })
  }
}
