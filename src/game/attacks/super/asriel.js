import Phaser from 'phaser'
import { definirAtaque } from '../definir.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Asriel: SINGULARIDADE RADIANTE. Dois atos, um o espelho do outro:
//
//   I. O Vazio (1ª metade). Uma singularidade nasce no meio da caixa e CRESCE
//      em pulsos (cada pulso pisca antes de valer, como um buraco negro
//      "respirando"); o anel que sobra até a borda é sempre >= lacunaMinima
//      (a zona de escape). Ao mesmo tempo, estrelas nascem fora da caixa e
//      são PUXADAS para o centro: nascem paradas e piscando (telegrafo
//      normal) e, ao valer, aceleram em linha reta até o meio -- é o único
//      ataque do jogo com esse "puxão" (nunca mexe no coração de verdade,
//      só nas balas que convergem até ele).
//   II. A Supernova (2ª metade). O vazio implode num instante (COLAPSO) e no
//      mesmo ponto nasce a supernova. Em cada onda, pontos de luz (nós de
//      constelação) acendem num círculo em volta do centro e disparam um
//      raio reto para fora -- o oposto do ato 1: agora tudo é empurrado para
//      longe. Cada onda gira os raios, então o vão entre eles nunca fica no
//      mesmo lugar duas vezes seguidas.
//
// Justiça:
//   - cada pulso do vazio pisca `vazio.aviso` (>= telegrafoMs) no tamanho que
//     vai valer antes de crescer de verdade; o raio máximo é calculado para
//     sempre sobrar um anel de pelo menos `a.lacunaMinima` até a borda mais
//     perto (ver `raioMax` em iniciar) -- a zona de escape fica nas bordas;
//   - as estrelas da chuva nascem fora da caixa já piscando (telegrafo padrão
//     de `a.bala`) e só aceleram depois disso: dá pra ver de onde vêm e por
//     onde vão passar antes delas se moverem;
//   - os raios da supernova piscam uma linha (`a.aviso`) do nó até a borda da
//     caixa por `estouro.aviso` antes de valer; o vão entre dois raios
//     vizinhos (medido onde eles nascem) é validado com `a.lacuna`.
//
// Config (objetos parciais completam com o padrão):
//   vazio    { fracoes, tempos, aviso, margem }  -- os pulsos de crescimento
//   chuva    { inicio, intervalo1, n1, intervalo2, n2, velocidade, aceleracao, aviso }
//   estouro  { ondas, raios, giro, aviso, intervalo, raioNo, velocidade, aceleracao }
const ARCO = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]

const PADRAO = {
  vazio: { fracoes: [0.4, 0.62, 0.82, 1], tempos: [0, 1250, 2500, 3650], aviso: 650, margem: 8 },
  chuva: { inicio: 450, intervalo1: 430, n1: 5, intervalo2: 250, n2: 7, velocidade: 55, aceleracao: 130, aviso: 500 },
  estouro: { ondas: 3, raios: 6, giro: Math.PI / 6, aviso: 620, intervalo: 780, raioNo: 50, velocidade: 150, aceleracao: 90 },
}

export default definirAtaque({
  nome: 'superAsriel',
  padrao: { duracao: 9000, vazio: {}, chuva: {}, estouro: {} },
  iniciar(a, cfg) {
    const V = { ...PADRAO.vazio, ...cfg.vazio }
    const C = { ...PADRAO.chuva, ...cfg.chuva }
    const E = { ...PADRAO.estouro, ...cfg.estouro }
    const metade = cfg.duracao / 2
    const l = a.caixa
    const cx = l.centerX
    const cy = l.centerY

    // ---------- I. o vazio cresce e puxa ----------
    // raio máximo: sempre sobra um anel >= lacunaMinima até a borda mais perto
    const folga = Math.min(l.width, l.height) / 2
    const raioMax = Math.max(20, folga - a.lacunaMinima - V.margem)
    a.lacuna(folga - raioMax, 'anel de fuga em volta do vazio')

    const vazio = { bala: null, ativo: true }
    const buraco = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-buraco', 0).setDepth(3).setScale(0).setAlpha(0))
    a.cena.tweens.add({ targets: buraco, alpha: 1, duration: 200 })
    a.aoAtualizar((dt, t) => buraco.scene && buraco.setFrame(Math.floor(t / 90) % 6))

    V.tempos.forEach((t, i) => a.depois(t, () => crescerVazio(a, V, cx, cy, raioMax * V.fracoes[i], vazio, buraco)))

    // chuva de estrelas puxadas para o centro (ritmo acelera com o tempo)
    a.aCada(C.intervalo1, (i) => chuvaEstrela(a, C, cx, cy, i), C.n1, C.inicio)
    a.aCada(C.intervalo2, (i) => chuvaEstrela(a, C, cx, cy, C.n1 + i), C.n2, C.inicio + C.n1 * C.intervalo1)

    // ---------- II. colapso -> supernova ----------
    a.depois(metade, () => colapsar(a, vazio, buraco, cx, cy))
    const raioNo = Math.max(E.raioNo, a.lacunaMinima + 6)
    for (let onda = 0; onda < E.ondas; onda++) {
      a.depois(metade + 350 + onda * E.intervalo, () => ondaEstouro(a, E, cx, cy, onda, raioNo))
    }
  },
})

// ---------- ato I: o vazio ----------

function crescerVazio(a, cfg, cx, cy, raio, estado, buraco) {
  a.aviso({ tipo: 'circulo', x: cx, y: cy, raio, ms: cfg.aviso }, () => {
    if (!estado.ativo) return
    tocar(a.cena, 'super-asriel-pulso')
    shake(a.cena, 90, 0.004)
    if (estado.bala) {
      estado.bala.inofensiva = true
      estado.bala.vida = 1
    }
    const bala = a.bala({ x: cx, y: cy, raio, jaAvisada: true, atravessa: true, pulso: 0.05, vida: 999999 })
    bala.sprite.setVisible(false) // quem desenha é o buraco (decoração) por baixo
    estado.bala = bala
    const escala = (raio * 2) / buraco.width
    a.cena.tweens.add({ targets: buraco, scaleX: escala, scaleY: escala, duration: 300, ease: 'Back.Out' })
    particulas(a.cena, cx, cy, { cor: 0xd9d9ff, quantidade: 8, velocidade: 90, vida: 320 })
  })
}

// uma estrela nasce fora da caixa, pisca parada e, ao valer, acelera reto até o centro
function chuvaEstrela(a, cfg, cx, cy, i) {
  const l = a.caixa
  const borda = Math.hypot(l.width, l.height) / 2 + 34
  const ang = a.aleatorio(0, Math.PI * 2)
  const x0 = cx + Math.cos(ang) * borda
  const y0 = cy + Math.sin(ang) * borda
  const dir = Math.atan2(cy - y0, cx - x0)
  a.bala({
    x: x0,
    y: y0,
    vx: Math.cos(dir) * cfg.velocidade,
    vy: Math.sin(dir) * cfg.velocidade,
    ax: Math.cos(dir) * cfg.aceleracao,
    ay: Math.sin(dir) * cfg.aceleracao,
    raio: 6,
    textura: 'super-asriel-estrelas',
    quadro: i % 6,
    tamanho: 18,
    aviso: cfg.aviso,
    girar: 5,
    vida: 3400,
  })
}

// ---------- transição: o vazio implode ----------

function colapsar(a, estado, buraco, cx, cy) {
  estado.ativo = false
  if (estado.bala) {
    estado.bala.inofensiva = true
    estado.bala.vida = 1
  }
  tocar(a.cena, 'super-asriel-colapso')
  shake(a.cena, 220, 0.013)
  a.cena.tweens.killTweensOf(buraco)
  a.cena.tweens.add({ targets: buraco, scale: 0, angle: 280, duration: 260, ease: 'Cubic.easeIn', onComplete: () => buraco.setVisible(false) })
  const nova = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-nova').setDepth(3).setScale(0).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD))
  a.cena.tweens.add({ targets: nova, scale: 1.5, duration: 260, delay: 180, ease: 'Back.Out' })
  a.cena.tweens.add({ targets: nova, scale: 1.25, duration: 650, delay: 440, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  particulas(a.cena, cx, cy, { cor: 0xffffff, quantidade: 22, velocidade: 170, vida: 420 })
}

// ---------- ato II: a supernova ----------

// uma onda: `raios` nós acendem num círculo e cada um dispara uma estrela reta para fora
function ondaEstouro(a, cfg, cx, cy, onda, raioNo) {
  const base = onda * cfg.giro
  for (let k = 0; k < cfg.raios; k++) {
    const ang = base + (k * Math.PI * 2) / cfg.raios
    const cor = ARCO[k % ARCO.length]
    const nx = cx + Math.cos(ang) * raioNo
    const ny = cy + Math.sin(ang) * raioNo
    const no = a.decoracao(a.cena.add.image(nx, ny, 'super-asriel-no', 0).setDepth(4).setTint(cor).setScale(0.6).setAlpha(0))
    a.cena.tweens.add({ targets: no, alpha: 1, scale: 1.2, duration: 160, ease: 'Back.Out' })
    const pulsar = a.cena.tweens.add({ targets: no, scale: 1.45, duration: 220, delay: 180, yoyo: true, repeat: -1 })

    const comp = Math.hypot(a.caixa.width, a.caixa.height)
    a.aviso(
      { tipo: 'linha', x1: nx, y1: ny, x2: nx + Math.cos(ang) * comp, y2: ny + Math.sin(ang) * comp, espessura: 3, ms: cfg.aviso },
      () => {
        pulsar.stop()
        a.cena.tweens.add({ targets: no, alpha: 0, scale: 1.8, duration: 160 })
        tocar(a.cena, 'super-asriel-estoura')
        a.bala({
          x: nx,
          y: ny,
          vx: Math.cos(ang) * cfg.velocidade,
          vy: Math.sin(ang) * cfg.velocidade,
          ax: Math.cos(ang) * cfg.aceleracao,
          ay: Math.sin(ang) * cfg.aceleracao,
          raio: 7,
          textura: 'super-asriel-estrelas',
          quadro: k % 6,
          tamanho: 20,
          jaAvisada: true,
          girar: 6,
          vida: 2200,
        })
        particulas(a.cena, nx, ny, { cor, quantidade: 6, velocidade: 110, vida: 260 })
      },
    )
  }
  // vão entre dois raios vizinhos, medido perto do centro (onde eles nascem): só cresce dali para fora
  a.lacuna(raioNo, 'vão entre raios da supernova')
}
