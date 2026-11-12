import { limitar, MISTURA_ADD } from '../../phaserPuro.js'
import { definirAtaque } from '../definir.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'
import { fatores, duracaoPulso } from '../../acessibilidade.js'
import { criarPrevisao } from './previsao.js'
import { angulosDosRaios, angulosDoMeio } from './asrielGeometria.js'

// SUPER de Asriel: SINGULARIDADE RADIANTE. A única carta do jogo que mexe no
// coração sem ser bala: a gravidade dele é de verdade.
//
//   I. O Vazio (até o colapso). Um buraco negro nasce no meio da caixa, cresce em
//      pulsos e PUXA o coração para si (o puxão entra direto na posição, como
//      a correnteza de um rio: dá para nadar contra, nunca é mais forte que o
//      coração). Cada pulso aperta o puxão. Estrelas descem em BRAÇOS DE
//      ESPIRAL (um disco de acreção): nascem na borda, giram em volta do
//      vazio cada vez mais rápido conforme chegam perto (como planetas) e
//      somem engolidas por ele.
//      Já no ato I, JATOS do vazio: uma linha fina é riscada através do ponto
//      onde o coração VAI estar (previsão) e, depois do aviso, uma coluna de
//      estrelas corre por ela de uma borda à outra: ficar parado não adianta.
//   II. A Supernova. O vazio implode (clarão, tremor) e explode: o puxão VIRA
//      empurrão (o coração é jogado contra as paredes) enquanto anéis de
//      estrelas arco-íris se expandem do centro, cada um com uma brecha. A
//      brecha muda de lugar a cada anel: é preciso correr pela borda (contra
//      o empurrão) até ela. O último anel é duplo. Entre um anel e outro,
//      ESTRELAS CADENTES nascem (piscando) na parede de lá e cruzam a caixa
//      em direção a onde o coração vai estar: não dá para só ficar encostado
//      na parede esperando a brecha.
//   III. CAOS FINAL (logo depois dos anéis, sem pausa). O núcleo da
//      supernova incha e 6 raios de luz ficam riscados na caixa; depois de
//      `aviso` ms cada raio dispara uma coluna de estrelas para fora. Os
//      raios deixam fatias livres entre eles; logo que o último raio passa,
//      uma 2ª onda risca raios no MEIO das fatias (a antiga fatia segura vira
//      raio, e a que era raio já está livre) e dispara de novo, fechando com
//      um clarão arco-íris. O centro (raio < raioNo) nunca é atingido.
//
// Justiça:
//   - o puxão/empurrão nunca passa de `forcaMax` px/s (o coração anda
//     CORACAO.velocidadePadrao = 180) nem de PUXAO_MAX da velocidade de verdade
//     do coração (painel mais lento, eventos): sempre dá para fugir; só começa depois
//     do primeiro pulso piscar, e para nas pausas de respiro; o puxão para
//     `FOLGA_PUXAO` px antes da borda do vazio (sozinho, nunca encosta o
//     coração nele: quem machuca é o vazio crescer, e isso pisca antes);
//   - o vazio pisca no tamanho novo (`aviso`) antes de cada pulso, e o raio
//     máximo sempre deixa um anel >= lacunaMinima até a borda mais perto;
//   - as estrelas da espiral nascem paradas e piscando (aviso de a.bala); no
//     mesmo braço, duas estrelas seguidas ficam a mais de `lacunaMinima` uma
//     da outra ao longo do caminho;
//   - o jato risca a linha `jatos.aviso` ms antes (zona de perigo, a CPU desvia),
//     as estrelas nascem FORA da caixa e entram pela linha riscada (a linha tem
//     `espessura` px, o resto da caixa fica livre);
//   - a estrela cadente pisca `cadentes.aviso` ms antes de andar, nasce a mais de 90 px do coração
//     e são no máximo duas entre dois anéis (a 2ª 230 ms depois da 1ª);
//   - cada anel da supernova nasce parado e piscando como um círculo de nós
//     com a brecha já visível, e a brecha anda no máximo `passoBrecha` rad
//     de um anel para o outro;
//   - o Caos Final risca cada raio (a.aviso, zona de perigo) `caos.aviso` /
//     `caos.avisoSegunda` ms antes de disparar; os raios têm folga angular
//     mínima entre si (asrielGeometria.js), então cada fatia mede pelo menos
//     LACUNA_MINIMA a `caos.raioLacuna` px do centro, e a 2ª onda só risca
//     depois da 1ª disparar.
//   - a pausa do meio da onda foi desligada (respiro.meio = 0): os atos se
//     sobrepõem em vez de parar.
//
// Config: vazio, espiral, jatos, nova, caos (objetos parciais completam com PADRAO)
const ARCO = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
const TAU = Math.PI * 2
const FOLGA_PUXAO = 6 // px entre o coração e a borda do vazio onde o puxão para
const PUXAO_MAX = 0.45 // fração da velocidade do coração (a de agora) que o puxão/empurrão pode ter

export const PADRAO = {
  vazio: { fracoes: [0.32, 0.55, 0.78, 1], tempos: [0, 700, 1400, 2000], aviso: 500, margem: 6, forcas: [30, 50, 66, 78] },
  espiral: { bracos: 4, inicio: 350, intervalo: 600, giroBracos: 0.72, velRadial: 44, velTangencial: 80, omegaMax: 5, aviso: 450 },
  nova: {
    colapso: 4200,
    aneis: 5,
    intervalo: 540,
    atrasoAnel: 400,
    estrelas: 18,
    cadentes: { velocidade: 170, aviso: 450, atraso: 300 },
    abertura: 1.25,
    passoBrecha: 0.85,
    velocidade: 112,
    aviso: 500,
    raioNo: 40,
    empurrao: 50,
    duracaoEmpurrao: 3600,
  },
  jatos: { inicio: 1100, intervalo: 800, vezes: 4, aviso: 520, coluna: 3, espaco: 80, velocidade: 260, largura: 3, abertura: 15 },
  caos: { inicio: 7850, aviso: 540, raios: 6, jitter: 0.1, coluna: 4, espaco: 60, velocidade: 290, raioNo: 36, avisoSegunda: 540, raioLacuna: 60 },
  forcaMax: 80,
}

export default definirAtaque({
  nome: 'superAsriel',
  padrao: { duracao: 9800, respiro: { meio: 0 }, vazio: {}, espiral: {}, jatos: {}, nova: {}, caos: {} },
  iniciar(a, cfg) {
    const V = { ...PADRAO.vazio, ...cfg.vazio }
    const S = { ...PADRAO.espiral, ...cfg.espiral }
    const N = { ...PADRAO.nova, ...cfg.nova, cadentes: { ...PADRAO.nova.cadentes, ...cfg.nova?.cadentes } }
    const C = { ...PADRAO.caos, ...cfg.caos }
    const J = { ...PADRAO.jatos, ...cfg.jatos }
    const forcaMax = cfg.forcaMax ?? PADRAO.forcaMax
    const colapso = N.colapso
    const l = a.caixa
    const cx = l.centerX
    const cy = l.centerY

    // gravidade: > 0 puxa para o centro, < 0 empurra para fora (px/s)
    const g = { forca: 0, raioVazio: 0, ativo: true }
    // e nunca passa de PUXAO_MAX da velocidade do coração de verdade (painel lento, eventos)
    a.aoAtualizar((dt) => {
      const teto = Math.min(forcaMax, a.tetoPerseguidor(PUXAO_MAX))
      puxar(a, g, cx, cy, limitar(g.forca, -teto, teto), dt)
    })

    // ---------- I. o vazio cresce e puxa ----------
    const folga = Math.min(l.width, l.height) / 2
    const raioMax = Math.max(20, folga - a.lacunaMinima - V.margem)
    a.lacuna(folga - raioMax, 'anel de fuga em volta do vazio')

    const buraco = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-buraco', 0).setDepth(3).setScale(0).setAlpha(0))
    a.cena.tweens.add({ targets: buraco, alpha: 1, duration: 200 })
    a.aoAtualizar((dt, t) => buraco.scene && buraco.setFrame(Math.floor(t / 90) % 6))
    // o horizonte de eventos: um aro arco-íris no raio que machuca (o sprite do buraco é menor que a hitbox)
    const horizonte = a.decoracao(a.cena.add.graphics().setDepth(3.2))
    a.aoAtualizar((dt, t) => {
      if (!horizonte.scene) return
      horizonte.clear()
      if (!g.ativo || g.raioVazio <= 0) return
      horizonte.lineStyle(2, ARCO[Math.floor(t / 110) % ARCO.length], 0.9)
      horizonte.strokeCircle(cx, cy, g.raioVazio)
    })
    const disco = criarDisco(a, cx, cy, Math.hypot(l.width, l.height) / 2)
    a.aoAtualizar((dt) => girarDisco(disco, g, dt))

    const vazio = { bala: null }
    V.tempos.forEach((t, i) => a.depois(t, () => crescerVazio(a, V, cx, cy, raioMax * V.fracoes[i], V.forcas[i], vazio, buraco, g)))

    // braços da espiral: uma estrela por braço a cada `intervalo`; os braços giram devagar
    const n = Math.max(1, Math.floor((colapso - S.inicio - 300) / S.intervalo))
    a.aCada(S.intervalo, (i) => {
      for (let k = 0; k < S.bracos; k++) estrelaEspiral(a, S, cx, cy, g, (k * TAU) / S.bracos + i * S.giroBracos, i + k)
    }, n, S.inicio)
    // distância entre duas estrelas seguidas do mesmo braço logo que a nova nasce (na borda):
    // o braço girou `giroBracos`, a anterior andou um pouco para dentro e para frente
    const r0 = Math.hypot(l.width, l.height) / 2
    const T = S.intervalo / 1000
    a.lacuna(Math.hypot(r0 * (S.giroBracos - (S.velTangencial / r0) * T), S.velRadial * T), 'estrelas seguidas no braço da espiral')

    // jatos do vazio já no ato I: uma linha fina riscada através de onde o coração VAI estar
    // (previsão) e, `aviso` ms depois, uma coluna de estrelas corre por ela de ponta a ponta
    const previsao = criarPrevisao(a)
    a.aCada(J.intervalo, (i) => g.ativo && jatoDoVazio(a, J, previsao, i), J.vezes, J.inicio)

    // ---------- II. colapso -> supernova ----------
    let nucleo = null
    a.depois(colapso, () => {
      nucleo = colapsar(a, vazio, buraco, disco, cx, cy, g)
      g.forca = -N.empurrao
      a.depois(N.duracaoEmpurrao, () => (g.forca = 0))
    })
    let brecha = a.aleatorio(0, TAU)
    for (let k = 0; k < N.aneis; k++) {
      const ultimo = k === N.aneis - 1
      a.depois(colapso + N.atrasoAnel + k * N.intervalo, () => {
        brecha += a.escolher([-1, 1]) * a.aleatorio(N.passoBrecha * 0.45, N.passoBrecha)
        anelNova(a, N, cx, cy, brecha, k, 0)
        a.tremer(100 + k * 18, 0.004 + k * 0.0015)
        clarao(a, ARCO[k % ARCO.length], 0.1 + k * 0.02, 260)
        // entre este anel e o próximo, estrelas cadentes miradas (duas nos últimos anéis)
        if (!ultimo) {
          a.depois(N.cadentes.atraso, () => estrelaCadente(a, N, previsao))
          if (k >= 4) a.depois(N.cadentes.atraso + 230, () => estrelaCadente(a, N, previsao))
        }
        // o último anel é duplo: um segundo anel colado, com a mesma brecha
        if (ultimo) a.depois(170, () => anelNova(a, N, cx, cy, brecha, k + 1, 0.5))
      })
    }
    // a brecha medida onde ela é menor (logo que o anel sai, no raio dos nós)
    a.lacuna(N.abertura * N.raioNo, 'brecha do anel da supernova')

    // ---------- III. Caos Final ----------
    a.depois(C.inicio, () => caosFinal(a, C, cx, cy, () => nucleo))
    a.lacuna(arcoDaFatia(C), 'fatia livre entre dois raios do Caos Final')
  },
})

// ---------- gravidade de verdade: mexe no coração ----------

function puxar(a, g, cx, cy, forca, dt) {
  if (!forca) return
  const passo = (forca * dt) / 1000
  for (const c of a.coracoes) {
    if (!c.ativo) continue
    const dx = cx - c.x
    const dy = cy - c.y
    const d = Math.hypot(dx, dy)
    if (d < 1) continue
    // puxando: não arrasta para dentro do próprio vazio. Para um pouco antes
    // da borda dele (hitbox + folga): o puxão sozinho nunca causa dano
    const borda = g.raioVazio + (c.hitbox ?? 5) + FOLGA_PUXAO
    const mover = forca > 0 ? Math.min(passo, Math.max(0, d - borda)) : passo
    c.x += (dx / d) * mover
    c.y += (dy / d) * mover
    c.ajustar()
  }
}

// ---------- ato I: o vazio ----------

function crescerVazio(a, cfg, cx, cy, raio, forca, estado, buraco, g) {
  a.aviso({ tipo: 'circulo', x: cx, y: cy, raio, ms: cfg.aviso }, () => {
    if (!g.ativo) return
    tocar(a.cena, 'super-asriel-pulso')
    a.tremer(110, 0.005)
    if (estado.bala) {
      estado.bala.inofensiva = true
      estado.bala.vida = 1
    }
    const bala = a.bala({ x: cx, y: cy, raio, jaAvisada: true, atravessa: true, pulso: 0.05, vida: 999999 })
    bala.sprite.setVisible(false) // quem desenha é o buraco (decoração) por baixo
    estado.bala = bala
    g.raioVazio = raio
    g.forca = forca
    const escala = (raio * 2) / buraco.width
    a.cena.tweens.add({ targets: buraco, scaleX: escala, scaleY: escala, duration: 300, ease: 'Back.Out' })
    particulas(a.cena, cx, cy, { cor: 0xd9d9ff, quantidade: 10, velocidade: 100, vida: 320 })
  })
}

// estrela que desce em espiral: raio diminui, e gira mais rápido quanto mais perto
// (velocidade tangencial = L / r, como um planeta), até ser engolida
function estrelaEspiral(a, cfg, cx, cy, g, ang0, i) {
  const l = a.caixa
  const r0 = Math.hypot(l.width, l.height) / 2 + 6
  const L = cfg.velTangencial * r0
  const fator = () => a.balas.fatorVelocidade ?? 1
  const p = { r: r0, ang: ang0 }
  a.bala({
    x: cx + Math.cos(ang0) * r0,
    y: cy + Math.sin(ang0) * r0,
    raio: 6,
    textura: 'super-asriel-estrelas',
    quadro: i % 6,
    tamanho: 17,
    aviso: cfg.aviso,
    girar: 4,
    vida: 9000,
    atualizar: (b, dt) => {
      arcoIris(b, i)
      // o colapso engole o que ainda estava caindo
      if (!g.ativo) {
        b.morta = true
        particulas(a.cena, b.x, b.y, { cor: 0xffffff, quantidade: 3, velocidade: 80, vida: 200 })
        return
      }
      const s = (dt / 1000) * fator()
      p.r -= cfg.velRadial * s
      p.ang += Math.min(cfg.omegaMax, L / (p.r * p.r)) * s
      b.x = cx + Math.cos(p.ang) * p.r
      b.y = cy + Math.sin(p.ang) * p.r
      if (p.r <= g.raioVazio * 0.85 || p.r < 4) {
        b.morta = true
        particulas(a.cena, b.x, b.y, { cor: 0xb8a8ff, quantidade: 4, velocidade: 60, vida: 220 })
      }
    },
  })
}

// disco de acreção: pontinhos decorativos girando para dentro (mostram a força do puxão)
function criarDisco(a, cx, cy, raio) {
  const pontos = []
  for (let k = 0; k < 22; k++) {
    const img = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-no', 0).setDepth(2).setScale(0.35).setAlpha(0).setTint(ARCO[k % ARCO.length]))
    pontos.push({ img, r: a.aleatorio(raio * 0.3, raio), ang: a.aleatorio(0, TAU) })
  }
  return { pontos, cx, cy, raio }
}

function girarDisco(d, g, dt) {
  if (!d.pontos.length) return
  const forca = Math.max(0, g.forca)
  const s = dt / 1000
  d.relogio = (d.relogio ?? 0) + dt
  const fase = Math.floor(d.relogio / 140)
  for (const [k, p] of d.pontos.entries()) {
    p.img.setTint(ARCO[(k + fase) % ARCO.length])
    p.r -= (10 + forca * 0.9) * s
    p.ang += (40 + forca) / Math.max(20, p.r) * s * 3
    if (p.r <= g.raioVazio + 2) p.r = d.raio
    p.img.setPosition(d.cx + Math.cos(p.ang) * p.r, d.cy + Math.sin(p.ang) * p.r)
    p.img.setAlpha(forca ? Math.min(0.75, 0.2 + forca / 120) : 0)
  }
}

// ---------- transição: o vazio implode ----------

function colapsar(a, estado, buraco, disco, cx, cy, g) {
  g.ativo = false
  g.raioVazio = 0
  if (estado.bala) {
    estado.bala.inofensiva = true
    estado.bala.vida = 1
  }
  for (const p of disco.pontos) a.cena.tweens.add({ targets: p.img, x: cx, y: cy, alpha: 0, duration: 220, ease: 'Cubic.easeIn' })
  disco.pontos = []
  tocar(a.cena, 'super-asriel-colapso')
  a.tremer(300, 0.02)
  clarao(a, 0xffffff, 0.4, 420)
  anelDeChoque(a, cx, cy, 0xffffff, 230)
  a.cena.tweens.killTweensOf(buraco)
  a.cena.tweens.add({ targets: buraco, scale: 0, angle: 280, duration: 260, ease: 'Cubic.easeIn', onComplete: () => buraco.setVisible(false) })
  const nova = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-nova').setDepth(3).setScale(0).setAlpha(0.95).setBlendMode(MISTURA_ADD))
  a.cena.tweens.add({ targets: nova, scale: 1.6, duration: 260, delay: 180, ease: 'Back.Out' })
  a.cena.tweens.add({ targets: nova, scale: 1.25, duration: duracaoPulso(600), delay: 440, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  a.depois(380, () => tocar(a.cena, 'super-asriel-estoura'))
  particulas(a.cena, cx, cy, { cor: 0xffffff, quantidade: 34, velocidade: 220, vida: 480 })
  for (let k = 0; k < ARCO.length; k++) particulas(a.cena, cx, cy, { cor: ARCO[k], quantidade: 6, velocidade: 150 + k * 18, vida: 520 })
  return nova
}

// ---------- ato II: anéis da supernova ----------

// `estrelas` nós num círculo em volta do centro, menos os da brecha; piscam
// parados e depois saem juntos para fora (o anel cresce mantendo a brecha)
function anelNova(a, cfg, cx, cy, brecha, k, defasagem) {
  const passo = TAU / cfg.estrelas
  tocar(a.cena, 'super-asriel-pulso')
  for (let i = 0; i < cfg.estrelas; i++) {
    const ang = brecha + cfg.abertura / 2 + (defasagem + i) * passo
    // fora da brecha: o anel cobre TAU - abertura
    const rel = (((ang - brecha) % TAU) + TAU) % TAU
    if (rel < cfg.abertura / 2 || rel > TAU - cfg.abertura / 2) continue
    a.bala({
      x: cx + Math.cos(ang) * cfg.raioNo,
      y: cy + Math.sin(ang) * cfg.raioNo,
      vx: Math.cos(ang) * cfg.velocidade,
      vy: Math.sin(ang) * cfg.velocidade,
      raio: 6,
      textura: 'super-asriel-estrelas',
      quadro: (i + k) % 6,
      tamanho: 17,
      aviso: cfg.aviso,
      girar: 6,
      vida: 2600,
      atualizar: (b) => arcoIris(b, i + k),
    })
  }
}

// Estrela cadente: nasce na parede oposta à do coração (pisca `aviso` ms) e cruza
// a caixa em direção a onde ele vai estar. Nunca nasce a menos de 90 px dele
function estrelaCadente(a, cfg, previsao) {
  const l = a.caixa
  const C = cfg.cadentes
  const alvo = a.alvo()
  const futuro = previsao.prever(alvo, C.aviso + 300)
  // a parede mais longe do coração
  const horizontal = Math.abs(alvo.x - l.centerX) / l.width >= Math.abs(alvo.y - l.centerY) / l.height
  const dir = horizontal ? Math.sign(l.centerX - alvo.x) || 1 : Math.sign(l.centerY - alvo.y) || 1
  const p = horizontal ? { x: dir > 0 ? l.right - 6 : l.left + 6, y: limitar(futuro.y + a.aleatorio(-40, 40), l.top + 10, l.bottom - 10) } : { x: limitar(futuro.x + a.aleatorio(-40, 40), l.left + 10, l.right - 10), y: dir > 0 ? l.bottom - 6 : l.top + 6 }
  if (Math.hypot(p.x - alvo.x, p.y - alvo.y) < 90) return
  // a parede de onde nasce é a de lá: o tiro vai da parede mais longe até o coração
  const ang = Math.atan2(futuro.y - p.y, futuro.x - p.x)
  tocar(a.cena, 'super-asriel-pulso')
  a.bala({
    x: p.x,
    y: p.y,
    vx: Math.cos(ang) * C.velocidade,
    vy: Math.sin(ang) * C.velocidade,
    raio: 7,
    textura: 'super-asriel-estrelas',
    quadro: a.inteiro(0, 5),
    tamanho: 20,
    aviso: C.aviso,
    girar: 8,
    vida: 3200,
    atualizar: (b) => arcoIris(b, 0),
  })
}

// ---------- ato I: jatos do vazio ----------

// Linha através do ponto onde o coração vai estar, em ângulo sorteado (inclinada, nunca encostada na
// borda): borda a borda. Depois do aviso uma coluna de estrelas entra por uma ponta e cruza a caixa.
function jatoDoVazio(a, J, previsao, i) {
  const l = a.caixa
  const alvo = a.alvo()
  const p = previsao.prever(alvo, J.aviso + 150)
  const ang = a.aleatorio(0, TAU)
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  // quanto andar a partir de p, em cada sentido, até sair da caixa
  const ate = (sx, sy) => {
    let t = Infinity
    if (sx > 0) t = Math.min(t, (l.right - p.x) / sx)
    else if (sx < 0) t = Math.min(t, (l.left - p.x) / sx)
    if (sy > 0) t = Math.min(t, (l.bottom - p.y) / sy)
    else if (sy < 0) t = Math.min(t, (l.top - p.y) / sy)
    return t
  }
  const frente = ate(dx, dy)
  const tras = ate(-dx, -dy)
  const fora = 14
  const cor = ARCO[i % ARCO.length]
  const ini = { x: p.x - dx * (tras + fora), y: p.y - dy * (tras + fora) }
  const fim = { x: p.x + dx * frente, y: p.y + dy * frente }
  a.aviso({ tipo: 'linha', x1: p.x - dx * tras, y1: p.y - dy * tras, x2: fim.x, y2: fim.y, espessura: (J.largura - 1) * J.abertura + 14, ms: J.aviso, estilo: 'fino', cor }, () => {
    tocar(a.cena, 'super-asriel-pulso')
    a.tremer(90, 0.004)
    for (let j = 0; j < J.coluna; j++) {
      a.depois(j * J.espaco, () => {
        for (let w = 0; w < J.largura; w++) {
          // `largura` estrelas lado a lado: o jato é um feixe, não um fio
          const off = (w - (J.largura - 1) / 2) * J.abertura
          a.bala({
          x: ini.x - dy * off,
          y: ini.y + dx * off,
          vx: dx * J.velocidade,
          vy: dy * J.velocidade,
          raio: 6,
          textura: 'super-asriel-estrelas',
          quadro: (i + j + w) % 6,
          tamanho: 18,
          jaAvisada: true,
          entrando: true,
          girar: 7,
          vida: 3000,
          atualizar: (b) => arcoIris(b, i + j + w),
          })
        }
      })
    }
  })
}

// ---------- brilho arco-íris e clarões ----------

// a estrela troca de quadro (de cor) sem parar: o arco-íris gira em volta dela
function arcoIris(b, base) {
  b.sprite.setFrame((base + Math.floor(b.idade / 85)) % ARCO.length)
}

// clarão colorido sobre o fundo da caixa (por baixo das balas: nunca esconde nada que machuca)
function clarao(a, cor, alfa, ms) {
  const f = fatores().clarao
  if (!f) return
  const l = a.caixa
  const r = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, cor).setDepth(2.5).setAlpha(alfa * f).setBlendMode(MISTURA_ADD))
  a.cena.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => r.destroy() })
}

// círculo fino que se abre do centro (só enfeite: some em `ms`)
function anelDeChoque(a, cx, cy, cor, ms) {
  const f = fatores().clarao
  if (!f) return
  const g = a.decoracao(a.cena.add.graphics().setDepth(2.6).setBlendMode(MISTURA_ADD))
  const estado = { r: 6, alfa: 0.7 * f }
  const meia = Math.hypot(a.caixa.width, a.caixa.height) / 2
  a.cena.tweens.add({
    targets: estado,
    r: meia,
    alfa: 0,
    duration: ms,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      g.clear()
      g.lineStyle(3, cor, estado.alfa)
      g.strokeCircle(cx, cy, estado.r)
    },
    onComplete: () => g.destroy(),
  })
}

// ---------- ato III: Caos Final ----------

// largura do arco (px) da menor fatia livre, no raio medido
function arcoDaFatia(C) {
  return (TAU / C.raios - 2 * C.jitter) * C.raioLacuna
}

function caosFinal(a, C, cx, cy, nucleo) {
  const l = a.caixa
  const meia = Math.hypot(l.width, l.height) / 2
  const base = a.aleatorio(0, TAU)
  const primeira = angulosDosRaios(C.raios, base, C.jitter, () => a.aleatorio(-1, 1))
  const segunda = angulosDoMeio(primeira)
  const n = nucleo()
  if (n) a.cena.tweens.add({ targets: n, scale: 1.65, duration: C.aviso, ease: 'Cubic.easeIn' })

  const onda = (angulos, aviso, final, depois) => {
    let prontos = 0
    angulos.forEach((ang, i) => {
      const cor = ARCO[(i + (final ? 3 : 0)) % ARCO.length]
      a.aviso({ tipo: 'linha', x1: cx, y1: cy, x2: cx + Math.cos(ang) * meia, y2: cy + Math.sin(ang) * meia, espessura: 18, ms: aviso, estilo: 'fino', cor }, () => {
        for (let j = 0; j < C.coluna; j++) {
          a.depois(j * C.espaco, () => estrelaDoRaio(a, C, cx, cy, ang, i + j))
        }
        if (++prontos === angulos.length) depois()
      })
    })
    tocar(a.cena, 'super-asriel-pulso')
  }

  onda(primeira, C.aviso, false, () => {
    tocar(a.cena, 'super-asriel-estoura')
    a.tremer(220, 0.014)
    clarao(a, 0xffffff, 0.3, 300)
    // a 2ª onda: raios no meio das fatias, riscados enquanto a 1ª passa
    onda(segunda, C.avisoSegunda, true, () => {
      tocar(a.cena, 'super-asriel-colapso')
      a.tremer(380, 0.024)
      clarao(a, 0xffffff, 0.4, 520)
      anelDeChoque(a, cx, cy, 0xffe14a, 360)
      for (let k = 0; k < ARCO.length; k++) particulas(a.cena, cx, cy, { cor: ARCO[k], quantidade: 8, velocidade: 170 + k * 25, vida: 560 })
      if (n) a.cena.tweens.add({ targets: n, scale: 0.4, alpha: 0, duration: 500, ease: 'Cubic.easeIn' })
    })
  })
}

function estrelaDoRaio(a, C, cx, cy, ang, i) {
  a.bala({
    x: cx + Math.cos(ang) * C.raioNo,
    y: cy + Math.sin(ang) * C.raioNo,
    vx: Math.cos(ang) * C.velocidade,
    vy: Math.sin(ang) * C.velocidade,
    raio: 6,
    textura: 'super-asriel-estrelas',
    quadro: i % 6,
    tamanho: 18,
    jaAvisada: true, // o raio riscado foi o aviso
    girar: 7,
    vida: 1800,
    atualizar: (b) => arcoIris(b, i),
  })
}
