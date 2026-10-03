import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Ralsei: ÚLTIMO CAPÍTULO. A caixa vira o livro de histórias que ele
// mesmo escreveu -- cada página que vira é mais séria que a anterior -- em
// três atos:
//
//   I. Sopros em leque. Uma página voa de um canto da caixa: a sombra de uma
//      asa de dragão cresce sobre aquele canto (telegrafo) enquanto um leque
//      exato pisca mostrando onde o fogo vai sair; só então saem rajadas de
//      chamas verdes cobrindo APENAS aquela fatia angular -- o resto da
//      caixa, inclusive o próprio canto, fica sempre livre.
//   II. Moldura de espinhos. Espinhos brotam em toda a borda da caixa. Uma
//      única "janela" (onde os espinhos continuam brotos, inofensivos)
//      desliza sem parar ao redor do perímetro inteiro -- dá pra segui-la
//      raspando a borda. De vez em quando a moldura "floresce" (os espinhos
//      crescem bem mais) por um instante; mesmo no pico, o meio da caixa
//      nunca é alcançado: sempre dá pra recuar para o centro.
//   III. Sombra do dragão. As páginas se fecham; atrás da caixa cresce a
//      sombra de um dragão (só as asas e os olhos -- nunca o Ralsei em si) e
//      um fio de fogo verde, em vez de avançar reto, ONDULA como uma cobra
//      -- um balanço lento e generoso, nunca mais que uma fatia da largura
//      da caixa de cada vez, em vez de uma parede ou um giro acelerado.
//
// Justiça:
//   - cada sopro pisca (asa crescendo + leque + `a.aviso`) por `avisoSopro`
//     ms antes de qualquer chama sair; o leque cobre só uma fatia angular a
//     partir do canto (o resto da caixa, inclusive o canto de onde ele sai,
//     fica livre: `a.lacuna`);
//   - os espinhos nascem brotos (inofensivos) e piscam por `avisoMoldura` ms
//     antes de valer; a "janela" (onde eles continuam brotos) tem pelo menos
//     LACUNA_MINIMA de arco e nunca para de deslizar; o raio de pico de cada
//     florescer fica bem abaixo de meia caixa (`a.lacuna`: o núcleo sempre
//     livre) e também pisca (`avisoPulso`) antes de crescer;
//   - o fio de fogo nasce todo de uma vez, parado e piscando por
//     `avisoInvocacao` ms antes de ondular; cada "conta" é só um pingo de
//     fogo (não uma parede): sempre dá pra contornar pela lateral, e o
//     balanço nunca cobre mais que `amplitude` de cada lado do centro.
//
// Config:
//   sopros              [ms, canto] de cada rajada (canto: supEsq/supDir/infEsq/infDir)
//   avisoSopro          ms de aviso de cada sopro (asa + leque)
//   meiaAberturaSopro   meio-ângulo do leque (rad)
//   rajadasPorSopro, intervaloRajada, chamasPorRajada, velocidadeChama, raioChama
//   moldura.inicio      ms (desde o início do ataque) em que a moldura nasce
//   moldura.avisoMoldura, .espacoEspinho, .raioBase, .gapFracao, .voltas
//   moldura.pulsos      [ms desde o fim do avisoMoldura, avisoPulso, duração]
//   moldura.duracaoAtiva
//   dragao.inicio, .avisoInvocacao, .contas, .amplitude, .omega, .defasagem,
//         .raio, .duracaoSway
export default definirAtaque({
  nome: 'superRalsei',
  padrao: {
    duracao: 9000,
    sopros: [
      [150, 'supEsq'],
      [1100, 'infDir'],
      [2050, 'supDir'],
    ],
    avisoSopro: 650,
    meiaAberturaSopro: Math.PI / 4.6,
    rajadasPorSopro: 3,
    intervaloRajada: 100,
    chamasPorRajada: 6,
    velocidadeChama: 150,
    raioChama: 7,
    moldura: {
      inicio: 3100,
      avisoMoldura: 600,
      espacoEspinho: 24,
      raioBase: 9,
      gapFracao: 0.24,
      voltas: 1.4,
      pulsos: [
        [700, 480, 260],
        [1500, 480, 260],
      ],
      duracaoAtiva: 2500,
    },
    dragao: {
      inicio: 6200,
      avisoInvocacao: 700,
      contas: 14,
      amplitude: null, // null = calculado da caixa (0.3 da largura)
      omega: 3.2,
      defasagem: 0.4,
      raio: 9,
      duracaoSway: 1900,
    },
  },
  iniciar(a, cfg) {
    let ativo = 0
    const estado = { moldura: null, dragao: null }

    for (const [ms, canto] of cfg.sopros) a.depois(ms, () => sopro(a, cfg, canto))
    a.depois(cfg.moldura.inicio, () => (estado.moldura = montarMoldura(a, cfg, cfg.moldura)))
    a.depois(cfg.dragao.inicio, () => (estado.dragao = montarDragao(a, cfg, cfg.dragao)))

    a.aoAtualizar((dt) => {
      ativo += dt
      if (estado.moldura) atualizarMoldura(estado.moldura, ativo)
      if (estado.dragao) atualizarDragao(estado.dragao, ativo)
    })
  },
})

// ---------- I. sopros em leque ----------

const CANTOS = {
  supEsq: (l) => ({ x: l.left, y: l.top, ang: Math.atan2(l.height, l.width), flipX: false, flipY: true }),
  supDir: (l) => ({ x: l.right, y: l.top, ang: Math.atan2(l.height, -l.width), flipX: true, flipY: true }),
  infEsq: (l) => ({ x: l.left, y: l.bottom, ang: Math.atan2(-l.height, l.width), flipX: false, flipY: false }),
  infDir: (l) => ({ x: l.right, y: l.bottom, ang: Math.atan2(-l.height, -l.width), flipX: true, flipY: false }),
}

function sopro(a, cfg, nomeCanto) {
  const l = a.caixa
  const info = CANTOS[nomeCanto](l)
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoSopro)
  const diag = Math.hypot(l.width, l.height)
  const lado = info.flipX ? -1 : 1

  // uma página voa do canto: a pista visual de que o perigo vem dali
  tocar(a.cena, 'super-ralsei-pagina')
  const pag = a.decoracao(
    a.cena.add.image(info.x, info.y, 'super-ralsei-pagina').setDepth(8).setScale(0.3).setAlpha(0).setAngle(a.aleatorio(-18, 18)),
  )
  a.cena.tweens.add({
    targets: pag,
    alpha: 0.95,
    scale: 0.8,
    angle: pag.angle + lado * 240,
    x: info.x + lado * 60,
    y: info.y + (info.flipY ? -36 : 36),
    duration: aviso * 0.75,
    ease: 'Cubic.easeOut',
  })
  a.cena.tweens.add({ targets: pag, alpha: 0, delay: aviso * 0.75, duration: 220 })

  // a sombra da asa cresce sobre o canto
  const asa = a.decoracao(
    a.cena.add
      .image(info.x, info.y, 'super-ralsei-asa')
      .setOrigin(0.05, 0.92)
      .setFlipX(info.flipX)
      .setFlipY(info.flipY)
      .setDepth(3)
      .setAlpha(0)
      .setScale(0.35),
  )
  const escalaAsa = (diag * 0.56) / Math.max(1, asa.width)
  a.cena.tweens.add({ targets: asa, alpha: 0.48, scale: escalaAsa, duration: aviso, ease: 'Quad.easeIn' })

  // leque exato por onde o fogo vai sair, pulsando por cima da sombra
  const leque = desenharLeque(a, info.x, info.y, info.ang, cfg.meiaAberturaSopro, diag * 0.56)

  // telegrafo "oficial" (uma área generosa em volta do canto, como nos outros SUPERs)
  const bx = info.flipX ? l.right - l.width * 0.6 : l.left
  const by = info.flipY ? l.bottom - l.height * 0.6 : l.top
  a.aviso({ tipo: 'area', x: bx, y: by, largura: l.width * 0.6, altura: l.height * 0.6, ms: aviso })

  // rota de fuga: o leque cobre só uma fatia angular a partir do canto -- o
  // resto da caixa, inclusive o próprio canto, fica sempre livre
  a.lacuna(Math.min(l.width, l.height) * 0.5, `leque livre (${nomeCanto})`)

  a.depois(aviso, () => {
    a.cena.tweens.killTweensOf(leque)
    leque.destroy()
    a.cena.tweens.add({ targets: asa, alpha: 0, duration: 260 })
    tocar(a.cena, 'super-ralsei-sopro')
    shake(a.cena, 90, 0.004)
    particulas(a.cena, info.x, info.y, { cor: 0x6be08a, quantidade: 14, velocidade: 160, vida: 380 })
    for (let r = 0; r < cfg.rajadasPorSopro; r++) a.depois(r * cfg.intervaloRajada, () => rajada(a, cfg, info, diag))
  })
}

function desenharLeque(a, x, y, angCentro, meiaAngulo, raio) {
  const g = a.decoracao(a.cena.add.graphics().setDepth(4))
  const passos = 12
  const pontos = [{ x, y }]
  for (let i = 0; i <= passos; i++) {
    const ang = angCentro - meiaAngulo + (2 * meiaAngulo * i) / passos
    pontos.push({ x: x + Math.cos(ang) * raio, y: y + Math.sin(ang) * raio })
  }
  g.fillStyle(0x6be08a, 0.2)
  g.lineStyle(2, 0xc8ffd8, 0.85)
  g.fillPoints(pontos, true)
  g.strokePoints(pontos, true)
  a.cena.tweens.add({ targets: g, alpha: 0.42, duration: 110, yoyo: true, repeat: -1 })
  return g
}

function rajada(a, cfg, info, diag) {
  tocar(a.cena, 'super-ralsei-sopro')
  const meia = cfg.meiaAberturaSopro
  const n = cfg.chamasPorRajada
  for (let i = 0; i < n; i++) {
    const ang = info.ang - meia + (2 * meia * i) / Math.max(1, n - 1) + a.aleatorio(-0.04, 0.04)
    const v = cfg.velocidadeChama * a.aleatorio(0.88, 1.12)
    a.bala({
      x: info.x,
      y: info.y,
      raio: cfg.raioChama,
      textura: 'super-ralsei-chama',
      quadro: a.inteiro(0, 2),
      tamanho: cfg.raioChama * 2.6,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      jaAvisada: true,
      atravessa: true,
      pulso: 0.18,
      vida: (diag / v) * 1000 + 200,
    })
  }
}

// ---------- II. moldura de espinhos ----------

// Ponto na borda da caixa a `s` px do canto superior-esquerdo, andando no
// sentido horário (topo -> direita -> baixo -> esquerda). `dentro` é o
// ângulo (atan2) que aponta para DENTRO da caixa a partir dali.
function pontoPerimetro(l, s) {
  const { width: w, height: h } = l
  if (s < w) return { x: l.left + s, y: l.top, dentro: Math.PI / 2 }
  s -= w
  if (s < h) return { x: l.right, y: l.top + s, dentro: Math.PI }
  s -= h
  if (s < w) return { x: l.right - s, y: l.bottom, dentro: -Math.PI / 2 }
  s -= w
  return { x: l.left, y: l.bottom - s, dentro: 0 }
}

function montarMoldura(a, cfg, M) {
  const l = a.caixa
  const perimetro = 2 * (l.width + l.height)
  const n = Math.max(20, Math.round(perimetro / M.espacoEspinho))
  const avisoM = Math.max(ATAQUE.telegrafoMs, M.avisoMoldura)
  const gapArco = Math.max(a.lacunaMinima * 1.3, perimetro * M.gapFracao)
  const raioPulso = Math.min(l.width, l.height) * 0.3

  // o núcleo da caixa nunca é alcançado, mesmo no pico de um florescer
  a.lacuna(Math.min(l.width, l.height) - 2 * raioPulso, 'núcleo da moldura sempre livre')
  tocar(a.cena, 'super-ralsei-espinho')

  const espinhos = []
  for (let i = 0; i < n; i++) {
    const p = pontoPerimetro(l, (i / n) * perimetro)
    const esp = a.bala({
      x: p.x,
      y: p.y,
      raio: M.raioBase,
      textura: 'super-ralsei-espinho',
      quadro: 1,
      tamanho: M.raioBase * 2.8,
      aviso: avisoM,
      vida: M.duracaoAtiva + 500,
      atravessa: true,
      pulso: 0,
    })
    esp.sprite.setRotation(p.dentro + Math.PI / 2)
    esp.s = (i / n) * perimetro
    esp.unidade = esp.escalaX / M.raioBase
    espinhos.push(esp)
  }

  const m = { espinhos, perimetro, gapArco, raioBase: M.raioBase, raioPulso, raioAtivo: M.raioBase, nasceuEm: null, avisoM, duracaoAtiva: M.duracaoAtiva, voltas: M.voltas }

  for (const [ini, avisoPulso, dur] of M.pulsos) {
    const ap = Math.max(ATAQUE.telegrafoMs, avisoPulso)
    a.depois(avisoM + ini, () => shake(a.cena, 60, 0.003))
    a.depois(avisoM + ini + ap, () => {
      m.raioAtivo = raioPulso
      tocar(a.cena, 'super-ralsei-espinho')
      shake(a.cena, 130, 0.007)
    })
    a.depois(avisoM + ini + ap + dur, () => (m.raioAtivo = M.raioBase))
  }

  return m
}

// chamado todo frame (ativo = ms já ativos do ataque inteiro, sem contar pausas)
function atualizarMoldura(m, ativo) {
  if (m.nasceuEm === null) m.nasceuEm = ativo
  const decorrido = ativo - m.nasceuEm - m.avisoM
  if (decorrido < 0) return
  const gapS = ((decorrido / m.duracaoAtiva) * m.voltas * m.perimetro) % m.perimetro
  for (const esp of m.espinhos) {
    if (esp.morta) continue
    const d = Math.abs(esp.s - gapS)
    const distCirc = Math.min(d, m.perimetro - d)
    const seguro = distCirc < m.gapArco / 2
    esp.sprite.setFrame(seguro ? 0 : 1)
    const raio = seguro ? Math.min(3, m.raioBase) : m.raioAtivo
    esp.raio = raio
    esp.escalaX = esp.escalaY = esp.unidade * raio
    esp.inofensiva = seguro
  }
}

// ---------- III. sombra do dragão ----------

function montarDragao(a, cfg, D) {
  const l = a.caixa
  const avisoD = Math.max(ATAQUE.telegrafoMs, D.avisoInvocacao)
  const amplitude = D.amplitude ?? l.width * 0.3

  tocar(a.cena, 'super-ralsei-dragao')
  shake(a.cena, 260, 0.01)

  const sombra = a.decoracao(
    a.cena.add.image(l.centerX, l.top - 4, 'super-ralsei-sombra-dragao').setOrigin(0.5, 0.76).setDepth(1).setAlpha(0).setScale(0.45),
  )
  const escalaSombra = (l.width * 0.96) / Math.max(1, sombra.width)
  a.cena.tweens.add({ targets: sombra, alpha: 0.82, scale: escalaSombra, duration: avisoD, ease: 'Quad.easeOut' })
  a.cena.tweens.add({ targets: sombra, y: sombra.y + 6, delay: avisoD, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  a.aviso({ tipo: 'area', x: l.left, y: l.top, largura: l.width, altura: l.height * 0.55, ms: avisoD })

  // sempre sobra espaço nas duas bordas, fora do alcance do balanço
  a.lacuna(l.width - 2 * amplitude - 2 * D.raio, 'margem livre fora do balanço do sopro')

  const n = D.contas
  const espacamento = (l.height * 0.9) / Math.max(1, n - 1)
  const topo = l.top + (l.height - espacamento * (n - 1)) / 2
  const contas = []
  for (let i = 0; i < n; i++) {
    const y = topo + i * espacamento
    const conta = a.bala({
      x: l.centerX,
      y,
      raio: D.raio,
      textura: 'super-ralsei-chama',
      quadro: i % 3,
      tamanho: D.raio * 2.6,
      aviso: avisoD,
      vida: D.duracaoSway + 600,
      atravessa: true,
      pulso: 0.15,
    })
    conta.i = i
    conta.y0 = y
    contas.push(conta)
  }

  return { contas, avisoD, amplitude, omega: D.omega, defasagem: D.defasagem, centroX: l.centerX, nasceuEm: null }
}

function atualizarDragao(d, ativo) {
  if (d.nasceuEm === null) d.nasceuEm = ativo
  const decorrido = ativo - d.nasceuEm - d.avisoD
  if (decorrido < 0) return
  const t = decorrido / 1000
  for (const c of d.contas) {
    if (c.morta) continue
    c.x = d.centroX + Math.sin(d.omega * t - c.i * d.defasagem) * d.amplitude
    c.y = c.y0
  }
}
