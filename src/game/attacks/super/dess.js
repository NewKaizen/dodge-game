import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'
import { criarPrevisao } from './previsao.js'

// SUPER de Dess: ÚLTIMO BIS. A caixa vira um braço de guitarra com TRASTES
// (faixas verticais, como um Guitar Hero de verdade) e o show tem um PULSO
// fixo: tudo acontece em cima de uma batida (a.aCada no tempo da música), com
// as luzes do palco piscando junto. Quatro partes, cada vez mais rápidas:
//
//   I.   Levada  - uma nota por tempo, num traste só.
//   II.  Refrão  - duas notas por tempo (power chord), sempre sobrando um traste.
//   III. Solo    - meio tempo cada nota: uma escala correndo pelo braço, com
//        "bends" (duas notas) de vez em quando.
//   IV.  Mergulho do whammy - a guitarra cai do alto e crava no palco; três
//        ondas de choque circulares varrem a caixa a partir do impacto (e ainda
//        caem dois acordes por baixo delas).
//
// Cada nota é uma bala que entra pelo alto do traste e despenca acelerando;
// quando bate no chão do palco, EXPLODE (sprite de explosão + som
// explosaoGrande): a explosão machuca um círculo no chão e solta estilhaços
// para cima. A nota do traste em que o coração está cai na coluna dele
// (parado, apanha).
//
// Justiça:
//   - a nota entra visível pelo alto e leva ~`queda` ms até o chão (é o aviso);
//     o traste dela acende de leve enquanto ela cai;
//   - um traste fica "aceso" da entrada da nota até a explosão acabar; um
//     traste só recebe nota se, somado aos acesos, ainda sobrar pelo menos um
//     traste inteiro apagado (a.parede com eixo x valida essa soma);
//   - a nota que mira o coração cai no traste PARA ONDE ele está indo (previsão do
//     movimento dele): quem corre para outro traste dá de cara com ela. Em compensação,
//     só cai nota em cima de um traste com coração se o vizinho dele estiver apagado
//     (a rota de fuga fica ao alcance, a uma corridinha, e não do outro lado do braço);
//   - o palco treme e solta fagulhas só de leve: o que machuca é sempre o que está desenhado;
//   - a onda de choque final nasce no centro, parada e piscando por
//     `avisoClimax` ms (pode ficar em cima dela à vontade) antes de abrir um
//     vão angular (sorteado perto do coração, nunca embaixo dele) e sair
//     correndo para fora: o vão vale em QUALQUER raio, então dá tempo de se
//     posicionar nele enquanto a onda ainda está parada. As seguintes abrem
//     o vão perto do da anterior (no máximo `desvioVao` rad), e não do outro
//     lado da caixa.
//
// Config:
//   bpm            andamento do show (define o tempo de cada batida)
//   queda          ms que a nota da Levada leva do alto ao chão
//   quedaAcorde    idem, as do Refrão
//   quedaSolo      idem, as do Solo
//   notaSolo       fração do tempo entre duas notas do Solo (0.5 = meio tempo)
//   bendSolo       chance de uma nota do Solo vir em bend (2 trastes)
//   raioNota       raio da nota que cai
//   raioExplosao   fração da largura do traste que a explosão machuca (raio)
//   estilhacos     estilhaços que cada explosão solta para cima
//   avisoClimax    aviso das ondas de choque do Mergulho
//   acordesFinais  ms (desde o Mergulho) dos acordes que caem por baixo das ondas de choque
//   ondas          quantas ondas de choque o Mergulho solta
//   intervaloOndas ms entre as ondas de choque
//   desvioVao      quanto o vão da 2ª onda pode se afastar do da 1ª (rad)
//   fases          { verso, refrao, solo, climax } ms de cada parte (soma = duracao)
const CORES_SHOW = [0xff5070, 0xffb03a, 0xffe14a, 0xffffff]

export default definirAtaque({
  nome: 'superDess',
  padrao: {
    duracao: 9000,
    bpm: 128,
    queda: 580,
    quedaAcorde: 620,
    quedaSolo: 520,
    notaSolo: 0.54,
    bendSolo: 0.45,
    raioNota: 9,
    raioExplosao: 0.55,
    estilhacos: 3,
    avisoClimax: 700,
    intervaloOndas: 480,
    desvioVao: 0.55,
    ondas: 3,
    acordesFinais: [350, 1100],
    fases: { verso: 2400, refrao: 2400, solo: 2100, climax: 2100 },
  },
  iniciar(a, cfg) {
    const beat = Math.round(60000 / cfg.bpm)
    const palco = montarPalco(a)
    palco.acesos = new Array(palco.lanes).fill(0) // avisos/golpes em andamento em cada traste
    palco.previsao = criarPrevisao(a)
    const luzes = montarLuzes(a)
    let k = 0
    const corDoGolpe = () => CORES_SHOW[k++ % CORES_SHOW.length]

    // o pulso do show: as luzes do palco piscam em TODO tempo, do início ao fim
    a.aCada(beat, () => pulsar(a, luzes))

    // ---------- I. Levada: um acorde por tempo ----------
    a.aCada(
      beat,
      () => {
        const lanes = escolherTrastes(a, palco, 1, 0.8, cfg.queda)
        acorde(a, cfg, palco, lanes, cfg.queda, corDoGolpe())
      },
      Math.max(1, Math.round(cfg.fases.verso / beat)),
    )

    // ---------- II. Refrão: power chord (2 trastes) ----------
    a.depois(cfg.fases.verso, () => {
      a.aCada(
        beat,
        () => {
          const trastes = escolherTrastes(a, palco, 2, 0.9, cfg.quedaAcorde)
          acorde(a, cfg, palco, trastes, cfg.quedaAcorde, corDoGolpe())
        },
        Math.max(1, Math.round(cfg.fases.refrao / beat)),
      )
    })

    // ---------- III. Solo: escala correndo pelo braço ----------
    a.depois(cfg.fases.verso + cfg.fases.refrao, () => {
      const passoNota = beat * cfg.notaSolo
      // a escala começa num traste e sentido sorteados
      let atual = a.inteiro(1, palco.lanes - 2)
      let dir = a.escolher([-1, 1])
      a.aCada(
        passoNota,
        () => {
          atual += dir
          if (atual <= 0 || atual >= palco.lanes - 1) dir *= -1
          const bend = palco.lanes > 3 && a.aleatorio(0, 1) < cfg.bendSolo
          const trastes = bend ? [...new Set([atual, limitar(atual + dir, 0, palco.lanes - 1)])] : [atual]
          acorde(a, cfg, palco, livres(a, palco, trastes), cfg.quedaSolo, corDoGolpe())
        },
        Math.max(1, Math.round(cfg.fases.solo / passoNota) - 1),
      )
    })

    // ---------- IV. Mergulho do whammy ----------
    const inicioMergulho = cfg.fases.verso + cfg.fases.refrao + cfg.fases.solo
    a.depois(inicioMergulho, () => climax(a, cfg, palco))
    // o palco ainda toca por baixo das ondas de choque: dois acordes (com a rota de fuga de sempre)
    for (const ms of cfg.acordesFinais) {
      a.depois(inicioMergulho + ms, () => acorde(a, cfg, palco, escolherTrastes(a, palco, 1, 0.8, cfg.queda), cfg.queda, corDoGolpe()))
    }
  },
})

function limitar(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

// ---------- o palco: trastes verticais do braço da guitarra ----------

function montarPalco(a) {
  const l = a.caixa
  const minimo = a.lacunaMinima + 6
  const lanes = Math.max(3, Math.min(6, Math.floor(l.width / minimo)))
  const larguraReal = l.width / lanes
  a.lacuna(larguraReal, 'traste livre')
  const trastes = []
  for (let i = 0; i < lanes; i++) {
    const x = l.left + (i + 0.5) * larguraReal
    const img = a.decoracao(
      a.cena.add
        .image(x, l.centerY, 'super-dess-traste', i % 2)
        .setDisplaySize(larguraReal - 3, l.height)
        .setDepth(2)
        .setAlpha(0.14),
    )
    trastes.push({ x, img })
  }
  return { lanes, larguraReal, left: l.left, trastes }
}

function trasteDoAlvo(palco, alvo) {
  return limitar(Math.floor((alvo.x - palco.left) / palco.larguraReal), 0, palco.lanes - 1)
}

// Dos trastes pedidos, só os que podem acender sem apagar a última rota:
// somados aos que já estão acesos (piscando ou batendo), sempre sobra pelo
// menos um traste inteiro apagado. Em cima do coração só cai nota se ele tiver
// um traste vizinho apagado para onde correr (um traste = ~0,3 s de corrida):
// a rota de fuga fica ao alcance, não do outro lado do braço
function livres(a, palco, pedidos) {
  const ok = []
  const dosCoracoes = a.coracoes.filter((c) => c.ativo).map((c) => trasteDoAlvo(palco, c))
  const quente = (k) => palco.acesos[k] > 0 || pedidos.includes(k)
  for (const i of pedidos) {
    const acesos = palco.acesos.filter((n, k) => n > 0 || ok.includes(k) || k === i).length
    if (acesos > palco.lanes - 1) continue
    if (dosCoracoes.includes(i) && ![i - 1, i + 1].some((k) => k >= 0 && k < palco.lanes && !quente(k))) continue
    ok.push(i)
  }
  return ok
}

// onde o coração estará quando a nota chegar ao chão (previsão do movimento dele):
// quem corre para outro traste dá de cara com a nota que cai nele
function mira(a, palco, queda) {
  return palco.previsao.prever(a.alvo(), queda * 0.6)
}

// sorteia até `qtd` trastes para acender (contando os que já estão acesos,
// sempre sobra pelo menos 1 traste inteiro apagado); prefere os que já estão
// acesos ou colados neles, para o braço não acender inteiro
function escolherTrastes(a, palco, qtd, mirar, queda = 600) {
  const total = palco.lanes
  const n = Math.min(qtd, total - 1)
  const indices = []
  if (a.aleatorio(0, 1) < mirar) indices.push(...livres(a, palco, [trasteDoAlvo(palco, mira(a, palco, queda))]))
  for (let tentativa = 0; indices.length < n && tentativa < 12; tentativa++) {
    const i = a.inteiro(0, total - 1)
    if (!indices.includes(i)) indices.push(...livres(a, palco, [...indices, i]).filter((k) => !indices.includes(k)))
  }
  // confere o conjunto final (um traste novo pode ser justamente o vizinho livre do coração)
  return livres(a, palco, indices)
}

// ---------- o acorde: a nota despenca no traste e explode no chão ----------

function acorde(a, cfg, palco, lanes, queda, cor) {
  const l = a.caixa
  if (!lanes.length) return
  for (const i of lanes) palco.acesos[i]++
  // a parede é a soma de tudo que está aceso agora (este acorde + as notas anteriores ainda no ar ou explodindo)
  const ocupados = []
  palco.acesos.forEach((n, i) => n > 0 && ocupados.push([palco.left + i * palco.larguraReal, palco.left + (i + 1) * palco.larguraReal]))
  a.parede({ eixo: 'x', ocupados })
  const alvo = a.alvo()
  const doAlvo = trasteDoAlvo(palco, alvo)

  for (const i of lanes) {
    const traste = palco.trastes[i].img
    const r = cfg.raioNota
    const esq = palco.left + i * palco.larguraReal
    // no traste do coração, a nota cai na coluna dele (dentro do traste)
    const x = i === doAlvo ? limitar(alvo.x, esq + r, esq + palco.larguraReal - r) : palco.trastes[i].x
    a.cena.tweens.add({ targets: traste, alpha: 0.4, duration: queda * 0.85, ease: 'Sine.easeIn' })
    // entra de fora e despenca acelerando: ~`queda` ms até o chão
    const y0 = l.top - 14
    const H = l.bottom - 8 - y0
    const T = queda / 1000
    a.bala({
      x,
      y: y0,
      vy: (0.5 * H) / T,
      ay: H / (T * T),
      raio: r,
      textura: 'super-dess-nota',
      tamanho: r * 2.6,
      cor,
      girar: 6,
      pulso: 0.05,
      jaAvisada: true,
      atualizar: (b) => {
        if (b.y < a.caixa.bottom - 8) return
        b.morta = true
        a.cena.tweens.add({ targets: traste, alpha: 0.14, duration: 220 })
        explodir(a, cfg, palco, b.x, a.caixa.bottom - 6, cor, () => palco.acesos[i]--) // o traste apaga: já pode receber nota de novo
      },
    })
  }
}

// A nota bateu no chão: explosão (quadros bonus-explosao-0..7, som, tremor),
// um círculo que machuca no chão e estilhaços que sobem
const ANIM_EXPLOSAO = 'super-dess-explosao'
let ultimoEstrondo = -Infinity
// só o desenho: os 8 quadros da explosão (sprites do bônus), recortados na caixa
function explosaoVisual(a, x, y, tamanho) {
  if (!a.cena.anims.exists(ANIM_EXPLOSAO)) {
    a.cena.anims.create({ key: ANIM_EXPLOSAO, frames: Array.from({ length: 8 }, (_, k) => ({ key: `bonus-explosao-${k}` })), frameRate: 24, repeat: 0 })
  }
  const fogo = a.decoracao(a.cena.add.sprite(x, y, 'bonus-explosao-0').setDepth(7))
  fogo.setScale(tamanho / Math.max(1, fogo.width)).setRotation(a.aleatorio(-0.4, 0.4))
  fogo.play(ANIM_EXPLOSAO)
  fogo.once('animationcomplete', () => fogo.destroy())
}

function explodir(a, cfg, palco, x, y, cor, aoApagar) {
  const raio = palco.larguraReal * cfg.raioExplosao
  explosaoVisual(a, x, y - raio * 0.3, raio * 2.6)
  // um estrondo por acorde (as notas do mesmo acorde explodem juntas)
  if (a.tempo - ultimoEstrondo > 90 || a.tempo < ultimoEstrondo) {
    ultimoEstrondo = a.tempo
    tocar(a.cena, 'explosaoGrande')
    a.tremer(70, 0.002)
  }
  particulas(a.cena, x, y, { cor, quantidade: 4, velocidade: 130, vida: 260 })
  const area = a.bala({ x, y, raio, jaAvisada: true, atravessa: true, vida: 220, pulso: 0, cor })
  area.sprite.setVisible(false) // quem aparece é a explosão
  a.depois(240, aoApagar)
  for (let k = 0; k < cfg.estilhacos; k++) {
    const ang = a.aleatorio(-Math.PI + 0.45, -0.45)
    const v = a.aleatorio(120, 170)
    a.bala({ x, y: y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, ay: 120, raio: 4, textura: 'super-dess-impacto', tamanho: 11, cor, girar: 8, jaAvisada: true, vida: 1400 })
  }
}

// ---------- palco: luzes pulsando no tempo ----------

function montarLuzes(a) {
  const l = a.caixa
  const cores = [0xff5070, 0xffb03a, 0xffe14a]
  return cores.map((cor, k) => {
    const x = l.left + l.width * (0.2 + k * 0.3)
    const g = a.decoracao(a.cena.add.graphics().setDepth(1).setPosition(x, l.top - 6).setAlpha(0.25))
    g.fillStyle(cor, 0.16)
    g.fillTriangle(0, 0, -l.width * 0.22, l.height + 14, l.width * 0.22, l.height + 14)
    return g
  })
}

function pulsar(a, luzes) {
  for (const g of luzes) a.cena.tweens.add({ targets: g, scaleY: 1.1, duration: 90, yoyo: true, ease: 'Sine.easeOut' })
}

// ---------- IV. mergulho do whammy: a guitarra crava e explode em ondas ----------

function climax(a, cfg, palco) {
  const l = a.caixa
  const cx = l.centerX
  const cy = l.centerY

  for (const t of palco.trastes) a.cena.tweens.add({ targets: t.img, alpha: 0.08, duration: 300 })

  const sombra = a.decoracao(a.cena.add.ellipse(cx, cy, 10, 6, 0x000000, 0.4).setDepth(3))
  a.cena.tweens.add({ targets: sombra, scaleX: 10, scaleY: 4, duration: 420 })
  const guitarra = a.decoracao(
    a.cena.add.image(cx, l.top - 50, 'super-dess-guitarra').setDepth(8).setScale(0.9).setAngle(-16).setAlpha(0.97),
  )
  tocar(a.cena, 'super-dess-mergulho')
  let vao = null
  a.cena.tweens.add({ targets: guitarra, y: cy, angle: 0, duration: 420, ease: 'Cubic.easeIn' })

  // onde a guitarra crava pisca enquanto ela cai (a pancada do centro também é avisada)
  a.aviso({ tipo: 'circulo', x: cx, y: cy, raio: 18, ms: Math.max(ATAQUE.telegrafoMs, 420), cor: 0xffe14a }, () => {
    tocar(a.cena, 'super-dess-estouro')
    tocar(a.cena, 'explosaoGrande')
    a.tremer(220, 0.014)
    explosaoVisual(a, cx, cy, 90)
    particulas(a.cena, cx, cy, { cor: 0xffe14a, quantidade: 22, velocidade: 210, vida: 420 })
    a.cena.tweens.add({ targets: guitarra, angle: 6, duration: 50, yoyo: true, repeat: 6 })
    a.bala({ x: cx, y: cy, raio: 15, textura: 'super-dess-impacto', tamanho: 50, cor: 0xffe14a, jaAvisada: true, atravessa: true, vida: 180, pulso: 0 })
    vao = anelChoque(a, cfg, cx, cy)
  })
  for (let k = 1; k < cfg.ondas; k++) a.depois(420 + k * cfg.intervaloOndas, () => (vao = anelChoque(a, cfg, cx, cy, vao)))

  a.depois(cfg.fases.climax - 180, () => {
    a.cena.tweens.add({ targets: guitarra, alpha: 0, scale: 1.3, duration: 260 })
  })
}

// onda de choque circular que nasce no centro (parada, piscando) e sai
// correndo para fora com um vão angular (vale em qualquer raio: dá pra entrar
// nele enquanto a onda ainda está parada, piscando). Com `vaoAnterior`, o vão
// fica perto do da onda anterior (devolve o vão, para a próxima)
function anelChoque(a, cfg, cx, cy, vaoAnterior = null) {
  const l = a.caixa
  const alvo = a.alvo()
  const raio = Math.hypot(l.width, l.height) / 2 + 30
  const quantidade = 18
  const abertura = 1.0
  const angAlvo = Math.atan2(alvo.y - cy, alvo.x - cx)
  const vao = vaoAnterior === null ? angAlvo + a.escolher([-1, 1]) * a.aleatorio(0.8, 1.7) : vaoAnterior + a.escolher([-1, 1]) * a.aleatorio(0.2, cfg.desvioVao)
  a.lacuna(abertura * raio * 0.5, 'vão da onda de choque')
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoClimax)
  const passo = (Math.PI * 2 - abertura) / (quantidade - 1)
  const vel = raio / 0.8
  tocar(a.cena, 'super-dess-acorde')
  for (let k = 0; k < quantidade; k++) {
    const ang = vao + abertura / 2 + k * passo
    a.bala({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      raio: 7,
      textura: 'super-dess-nota',
      tamanho: 18,
      cor: k % 2 ? 0xffb03a : 0xff5070,
      aviso,
      vida: 1000,
      girar: 5,
      atravessa: true,
    })
  }
  return vao
}
