// Ataques exclusivos das cartas de susie (uma entrada por ataque, com prefixo 'susie').
// As receitas de pvp/baralhos/susie.js chamam A.susieCabecada(...) etc.
// Sprites e sons: scripts/habilidades/susie.py (chaves 'hab-susie-*').
//
//   susieCabecada   ♠ Cabeçada: a parede da caixa amassa para dentro na
//                     fileira/coluna do coração (BONK) e solta estrelinhas de
//                     tontura que giram em espiral para fora
//   susiePisao      ♠ Pisão: a pisada numa parede sorteada (chão, teto ou
//                     laterais) faz pilares de pedra saírem dela em onda para
//                     os dois lados, e cascalho entra pela parede oposta
//   susieGiro       ♠ Giro do Machado: o machado de cabo longo dá uma volta
//                     inteira em torno de um eixo (o disco pisca antes)
//   susieEncarar    ♦ Encarar: marcas de raiva na borda da caixa "encaram" o
//                     coração (uma linha de olhar que o segue) soltando olhadelas
//                     miradas; quando o olhar trava, dispara raios amarelos pela
//                     linha e fecha com um leque
//   susieRugido     ♦ Rugido: ondas sonoras entram por uma parede sorteada e
//                     atravessam a caixa com um vão (sem aviso de onde ele fica);
//                     o grito empurra o coração
//   susieBombaGiz   ♣ Bomba de Giz: gizes amarrados com pavio são arremessados
//                     para dentro da caixa, explodem numa nuvem de pó de giz e
//                     espalham pedaços de giz que ficam no chão
import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-susie-${nome}`
const ROXO = 0xb05cff
const LILAS = 0xd9a0ff
const AMARELO = 0xffe14a
const GIZ = 0xf0ecff

const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

// O aviso de `ms` cabe antes do fim da onda? (conta as pausas de respiro que
// ainda vêm pela frente, em que os timers ficam parados; ver attacks/foice.js)
function cabe(a, ms) {
  let extra = 0
  const r = a.respiro
  if (r) {
    const rel = a.tempo - r.origem
    for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
  }
  return a.tempo + ms + extra <= a.fim
}

// As quatro paredes da caixa, vistas de dentro. Para cada uma:
//   n          normal para dentro da caixa ({x, y})
//   ao         eixo ao longo da parede ('x' no chão/teto, 'y' nas laterais)
//   borda      coordenada da parede (no eixo da normal)
//   ini, fim   trecho da parede (no eixo `ao`)
//   fundo      tamanho da caixa na direção da normal
//   ponto(u, d)  ponto na coordenada u da parede, d px para dentro (d < 0 = fora)
//   rot        rotação de um sprite desenhado "em pé no chão" para ficar em pé nesta parede
const LADOS = ['baixo', 'cima', 'esquerda', 'direita']
function parede(l, lado) {
  const deitada = lado === 'baixo' || lado === 'cima'
  const n = { baixo: { x: 0, y: -1 }, cima: { x: 0, y: 1 }, esquerda: { x: 1, y: 0 }, direita: { x: -1, y: 0 } }[lado]
  const borda = { baixo: l.bottom, cima: l.top, esquerda: l.left, direita: l.right }[lado]
  return {
    lado,
    n,
    ao: deitada ? 'x' : 'y',
    borda,
    ini: deitada ? l.left : l.top,
    fim: deitada ? l.right : l.bottom,
    fundo: deitada ? l.height : l.width,
    ponto: (u, d) => (deitada ? { x: u, y: borda + n.y * d } : { x: borda + n.x * d, y: u }),
    rot: { baixo: 0, cima: Math.PI, esquerda: Math.PI / 2, direita: -Math.PI / 2 }[lado],
  }
}
const oposto = { baixo: 'cima', cima: 'baixo', esquerda: 'direita', direita: 'esquerda' }

// bala só de colisão (o desenho é outra imagem)
function invisivel(b) {
  b.sprite.setVisible(false)
  return b
}

// ---------- ♠ Cabeçada ----------
//
// A cada `intervalo` a Susie dá uma cabeçada na parede mais perto do
// coração, na altura dele: a faixa pisca (`aviso`), a parede afunda para
// dentro (`profundidade` da caixa, por `cravado` ms) com um BONK e, da ponta
// do amassado, saem `estrelas` estrelinhas de tontura que giram em espiral
// para fora (piscam paradas antes de valer). A outra metade da caixa fica livre.
const susieCabecada = definirAtaque({
  nome: 'susieCabecada',
  padrao: { duracao: 5000, intervalo: 1200, aviso: 600, profundidade: 0.5, largura: 46, cravado: 380, estrelas: 4, raioEstrela: 6, velocidade: 50, voltaEstrela: 80 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const alvo = a.alvo()
      // sorteia paredes laterais ou chão/teto; dentro do par, a mais perto do coração
      const lateral = a.aleatorio(0, 1) < 0.5
      const lado = lateral ? (alvo.x < l.centerX ? -1 : 1) : alvo.y < l.centerY ? -1 : 1
      const vao = lateral ? l.width : l.height // tamanho da caixa na direção da pancada
      const fundo = Math.min(vao * cfg.profundidade, vao - a.lacunaMinima - 8)
      const meia = cfg.largura / 2
      // posição ao longo da parede: a do coração
      const p = lateral ? limitar(alvo.y, l.top + meia, l.bottom - meia) : limitar(alvo.x, l.left + meia, l.right - meia)
      const borda = lateral ? (lado < 0 ? l.left : l.right) : lado < 0 ? l.top : l.bottom
      const dentro = -lado // sentido para dentro da caixa
      const centro = borda + (dentro * fundo) / 2
      const ret = lateral
        ? { x: Math.min(borda, borda + dentro * fundo), y: p - meia, largura: fundo, altura: cfg.largura }
        : { x: p - meia, y: Math.min(borda, borda + dentro * fundo), largura: cfg.largura, altura: fundo }
      a.lacuna(vao - fundo, 'lado livre da cabeçada')

      a.aviso({ tipo: 'area', ...ret, ms: cfg.aviso }, () => {
        tocar(a.cena, 'hab-susie-bonk')
        a.tremer(120, 0.008)
        const cx = lateral ? centro : p
        const cy = lateral ? p : centro
        const b = a.bala({
          x: cx,
          y: cy,
          largura: ret.largura,
          altura: ret.altura,
          textura: T('calombo'),
          jaAvisada: true,
          atravessa: true,
          vida: cfg.cravado,
          pulso: 0,
        })
        // o sprite aponta para +x: gira para apontar para dentro da caixa
        const rot = lateral ? (dentro > 0 ? 0 : Math.PI) : dentro > 0 ? Math.PI / 2 : -Math.PI / 2
        b.sprite.setRotation(rot).setDisplaySize(fundo + 4, cfg.largura + 6)
        const sx = b.sprite.scaleX
        b.sprite.scaleX = sx * 0.3
        a.cena.tweens.add({ targets: b.sprite, scaleX: sx, duration: 70, ease: 'Quad.easeOut' })
        // ponta do amassado: BONK e estrelinhas
        const ponta = { x: lateral ? borda + dentro * fundo : p, y: lateral ? p : borda + dentro * fundo }
        const est = a.decoracao(a.cena.add.image(ponta.x, ponta.y, T('bonk')).setDepth(8).setScale(0.5))
        a.cena.tweens.add({ targets: est, scale: 1.6, alpha: 0, angle: 30, duration: 300, ease: 'Quad.easeOut' })
        particulas(a.cena, ponta.x, ponta.y, { cor: AMARELO, quantidade: 8, velocidade: 120, vida: 300 })
        estrelinhas(a, cfg, ponta, lateral ? { x: dentro, y: 0 } : { x: 0, y: dentro })
      })
    })
  },
})

// As estrelinhas saem da ponta do amassado (piscam paradas um instante, perto
// dela) e se abrem girando; sentido e ângulo sorteados
function estrelinhas(a, cfg, ponta, dir) {
  const n = Math.round(cfg.estrelas)
  const sentido = a.escolher([1, -1])
  const giro = a.aleatorio(0, Math.PI * 2)
  // o centro da espiral fica um pouco para dentro da caixa
  const c = { x: ponta.x + dir.x * 16, y: ponta.y + dir.y * 16 }
  const r0 = 12
  for (let k = 0; k < n; k++) {
    let ang = (k * Math.PI * 2) / n + giro
    let r = r0
    a.bala({
      x: c.x + Math.cos(ang) * r,
      y: c.y + Math.sin(ang) * r,
      raio: cfg.raioEstrela,
      textura: T('estrela'),
      quadro: k % 2,
      tamanho: 14,
      aviso: ATAQUE.telegrafoMs,
      vida: 3200,
      pulso: 0.1,
      atualizar: (b, dt) => {
        const s = (dt / 1000) * a.balas.fatorVelocidade
        r += cfg.velocidade * s
        ang += ((cfg.voltaEstrela / Math.max(r, 20)) * s) * sentido // velocidade de lado ~constante
        b.x = c.x + Math.cos(ang) * r
        b.y = c.y + Math.sin(ang) * r
        b.sprite.setFrame(Math.floor(b.idade / 110) % 2)
        if (r > 190) b.morta = true
      },
    })
  }
}

// ---------- ♠ Pisão ----------
//
// A cada `intervalo` a Susie pisa numa parede da caixa, sorteada (chão, teto
// ou laterais; nunca a mesma duas vezes seguidas). Só a pegada rachada pisca
// na parede (`aviso`), com poeira saindo dela: não há faixa de aviso. Na
// pisada, pilares de pedra saem da parede um depois do outro, numa onda que
// corre ao longo dela para os dois lados a `velocidade` px/s; a altura da
// onda é sorteada entre `alturas` (fração da caixa). O tremor solta
// `cascalhos` da parede oposta (o primeiro na linha do coração), que entram
// de fora da caixa e caem em direção à pisada. O lado de lá da caixa
// (>= LACUNA_MINIMA) nunca é atingido pela onda.
const susiePisao = definirAtaque({
  nome: 'susiePisao',
  padrao: { duracao: 5000, intervalo: 1400, aviso: 600, alturas: [0.32, 0.5], velocidade: 150, passo: 16, subida: 110, erguido: 200, cascalhos: 1, velocidadeCascalho: 90, gravidade: 260 },
  iniciar(a, cfg) {
    let anterior = null
    a.aCada(cfg.intervalo, () => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const p = parede(l, a.escolher(LADOS.filter((lado) => lado !== anterior)))
      anterior = p.lado
      const H = Math.min(p.fundo * a.aleatorio(cfg.alturas[0], cfg.alturas[1]), p.fundo - a.lacunaMinima - 14)
      const u0 = a.aleatorio(p.ini + 30, p.fim - 30)
      const ocupado = p.n.x + p.n.y > 0 ? [p.borda, p.borda + H] : [p.borda - H, p.borda]
      a.parede({ eixo: p.ao === 'x' ? 'y' : 'x', ocupados: [ocupado] })

      // o sinal: só a pegada rachada pisca na parede, soltando poeira
      const pe = p.ponto(u0, 6)
      const marca = a.decoracao(a.cena.add.image(pe.x, pe.y, T('marca')).setDepth(3).setAlpha(0.9).setRotation(p.rot))
      a.cena.tweens.add({ targets: marca, alpha: 0.35, duration: 90, yoyo: true, repeat: -1 })
      a.aCada(150, () => particulas(a.cena, pe.x, pe.y, { cor: LILAS, quantidade: 3, velocidade: 50, vida: 240 }), Math.floor(cfg.aviso / 150), 0)
      a.depois(cfg.aviso, () => {
        a.cena.tweens.killTweensOf(marca)
        marca.setAlpha(1)
        a.cena.tweens.add({ targets: marca, alpha: 0, delay: 600, duration: 300 })
        tocar(a.cena, 'hab-susie-pisao')
        a.tremer(160, 0.01)
        particulas(a.cena, pe.x, pe.y, { cor: LILAS, quantidade: 12, velocidade: 110, vida: 360 })
        // a onda: um pilar a cada `passo` px, saindo da pegada para os dois lados
        const v = cfg.velocidade * a.balas.fatorVelocidade
        for (let d = 0; d <= p.fim - p.ini; d += cfg.passo) {
          for (const s of d === 0 ? [0] : [-1, 1]) {
            const u = u0 + s * d
            if (u < p.ini + 4 || u > p.fim - 4) continue
            a.depois((d / v) * 1000, () => pilar(a, cfg, p, u, H, d / cfg.passo))
          }
        }
        cascalho(a, cfg, p)
      })
    })
  },
})

// o tremor solta cascalho da parede oposta: entra de fora da caixa e "cai"
// (acelera) em direção à parede da pisada; o primeiro vem na linha do coração
function cascalho(a, cfg, p) {
  const l = a.caixa
  const q = parede(l, oposto[p.lado])
  const alvo = a.alvo()
  const uAlvo = p.ao === 'x' ? alvo.x : alvo.y
  for (let k = 0; k < cfg.cascalhos; k++) {
    let u = uAlvo + (k === 0 ? a.aleatorio(-6, 6) : a.escolher([-1, 1]) * a.aleatorio(40, 80))
    if (u < q.ini + 10 || u > q.fim - 10) u = 2 * uAlvo - u // espelha se sair da caixa
    const ini = q.ponto(limitar(u, q.ini + 8, q.fim - 8), -a.aleatorio(10, 26))
    a.depois(a.aleatorio(0, 140), () =>
      a.bala({
        ...ini,
        raio: 5,
        textura: T('cascalho'),
        quadro: a.inteiro(0, 3),
        tamanho: 12,
        jaAvisada: true,
        vx: q.n.x * cfg.velocidadeCascalho,
        vy: q.n.y * cfg.velocidadeCascalho,
        ax: q.n.x * cfg.gravidade,
        ay: q.n.y * cfg.gravidade,
        girar: 6,
        vida: 2600,
      }),
    )
  }
}

// um pilar: sai da parede (a caixa corta o pedaço de fora), fica e volta
function pilar(a, cfg, p, u, H, n) {
  const total = cfg.subida * 2 + cfg.erguido
  let tempo = 0
  const base = p.ponto(u, -H / 2) // escondido do lado de fora da parede
  const deitada = p.ao === 'x'
  const b = a.bala({
    ...base,
    largura: deitada ? cfg.passo - 3 : H,
    altura: deitada ? H : cfg.passo - 3,
    textura: T('pilar'),
    quadro: n % 3,
    jaAvisada: true,
    atravessa: true,
    vida: total + 60,
    pulso: 0,
    atualizar: (bala, dt) => {
      tempo += dt * a.balas.fatorVelocidade
      const f = tempo < cfg.subida ? tempo / cfg.subida : tempo < cfg.subida + cfg.erguido ? 1 : Math.max(0, 1 - (tempo - cfg.subida - cfg.erguido) / cfg.subida)
      bala.x = base.x + p.n.x * f * H
      bala.y = base.y + p.n.y * f * H
      if (tempo >= total) bala.morta = true
    },
  })
  b.sprite.setDisplaySize(cfg.passo + 2, H + 8).setRotation(p.rot)
}

// ---------- ♠ Giro do Machado ----------
//
// A Susie gira o machado de cabo longo em volta de um eixo perto do coração:
// o disco do giro pisca (`aviso`) com o machado se armando e então ele dá
// `voltas` voltas (cada uma em `volta` ms), deixando um rastro roxo. O cabo e
// a cabeça machucam; bem no eixo (`interno` px) não. O próximo giro só vale
// depois que o anterior termina, e sempre sobra uma faixa livre do lado.
const susieGiro = definirAtaque({
  nome: 'susieGiro',
  padrao: { duracao: 5500, aviso: 650, raio: 66, volta: 1150, voltas: 1.1, interno: 14, raioCabeca: 11, espessuraCabo: 5, folga: 200, deslocamento: 0.45 },
  iniciar(a, cfg) {
    const giro = (k) => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const R = Math.min(cfg.raio, (l.width - a.lacunaMinima - 8) / 2)
      const alvo = a.alvo()
      const desvio = a.aleatorio(0, Math.PI * 2)
      let px = limitar(alvo.x + Math.cos(desvio) * R * cfg.deslocamento, l.left + 10, l.right - 10)
      const py = limitar(alvo.y + Math.sin(desvio) * R * cfg.deslocamento, l.top + 10, l.bottom - 10)
      // sempre sobra uma faixa livre de LACUNA_MINIMA (+ folga) à esquerda ou à direita do disco
      const livre = a.lacunaMinima + 6
      if (Math.max(px - R - l.left, l.right - (px + R)) < livre) {
        px = px - R - l.left >= l.right - (px + R) ? l.left + livre + R : l.right - livre - R
      }
      a.parede({ eixo: 'x', ocupados: [[px - R, px + R]] })
      const sentido = a.escolher([1, -1])
      let ang = Math.atan2(alvo.y - py, alvo.x - px) + sentido * Math.PI * 0.6 // começa longe do coração

      // armando: redemoinho no eixo e o machado recuando
      const eixo = a.decoracao(a.cena.add.image(px, py, T('redemoinho')).setDepth(6).setAlpha(0.8))
      a.cena.tweens.add({ targets: eixo, angle: -360 * sentido, duration: 700, repeat: -1 })
      const escala = (R + 4) / 84
      const machado = a.decoracao(a.cena.add.image(px, py, T('giro')).setOrigin(2 / 84, 0.5).setDepth(7).setScale(escala).setRotation(ang).setAlpha(0.45))
      a.cena.tweens.add({ targets: machado, rotation: ang - sentido * 0.35, duration: cfg.aviso, ease: 'Sine.easeOut' })

      a.aviso({ tipo: 'circulo', x: px, y: py, raio: R, ms: cfg.aviso }, () => {
        a.cena.tweens.killTweensOf(machado)
        ang -= sentido * 0.35
        machado.setAlpha(1).setRotation(ang)
        tocar(a.cena, 'hab-susie-giro')
        const fator = a.balas.fatorVelocidade
        const duracao = (cfg.volta * cfg.voltas) / fator
        const w = ((Math.PI * 2) / cfg.volta) * sentido // rad/ms (antes do fator)
        const comp = R - cfg.interno - cfg.raioCabeca
        const posicionar = (cabo, cabeca) => {
          const c = Math.cos(ang)
          const s = Math.sin(ang)
          const m = cfg.interno + comp / 2
          cabo.x = px + c * m
          cabo.y = py + s * m
          cabo.angulo = ang
          cabeca.x = px + c * (R - cfg.raioCabeca)
          cabeca.y = py + s * (R - cfg.raioCabeca)
        }
        const cabo = invisivel(a.bala({ x: px, y: py, comprimento: comp, espessura: cfg.espessuraCabo, angulo: ang, jaAvisada: true, atravessa: true, vida: duracao, pulso: 0 }))
        let rastro = 0
        const cabeca = invisivel(
          a.bala({
            x: px,
            y: py,
            raio: cfg.raioCabeca,
            jaAvisada: true,
            atravessa: true,
            vida: duracao,
            pulso: 0,
            atualizar: (b, dt) => {
              ang += w * dt * a.balas.fatorVelocidade
              posicionar(cabo, b)
              machado.setRotation(ang)
              rastro -= dt
              if (rastro <= 0) {
                rastro = 35
                const eco = a.decoracao(a.cena.add.image(px, py, T('giro')).setOrigin(2 / 84, 0.5).setDepth(5).setScale(escala).setRotation(ang).setTint(ROXO).setAlpha(0.4))
                a.cena.tweens.add({ targets: eco, alpha: 0, duration: 200, onComplete: () => eco.destroy() })
              }
            },
          }),
        )
        posicionar(cabo, cabeca)
        a.depois(duracao, () => {
          a.cena.tweens.killTweensOf(eixo)
          a.cena.tweens.add({ targets: [machado, eixo], alpha: 0, duration: 160 })
          particulas(a.cena, px, py, { cor: ROXO, quantidade: 6, velocidade: 80, vida: 260 })
        })
        // o próximo giro: o aviso dele começa antes, mas só vale depois que este acabou
        a.depois(Math.max(0, duracao + cfg.folga - cfg.aviso), () => giro(k + 1))
      })
    }
    a.depois(0, () => giro(0))
  },
})

// ---------- ♦ Encarar ----------
//
// `olhos` marcas de raiva aparecem na borda da caixa (num dos lados longe do
// coração, sorteado) e encaram o coração: uma linha de olhar pontilhada que o
// persegue girando no máximo `rastrear` rad/s. Enquanto encara, a marca solta
// `olhadelas`: raios rápidos mirados direto no coração, sem linha. Depois de
// `encarar` ms o olhar TRAVA (a linha pisca por `trava` ms, parada) e dispara
// `tiros` raios por ela; com `leque`, fecha a rajada com um leque de 3 (o do
// meio de novo no coração) para pegar quem só deu um passinho para o lado.
// Então a marca some e reaparece em outro lugar. Os raios nascem fora da
// borda e entram.
const susieEncarar = definirAtaque({
  nome: 'susieEncarar',
  padrao: { duracao: 5000, olhos: 2, encarar: 700, trava: 450, rastrear: 1.8, tiros: 3, cadencia: 110, velocidade: 190, raio: 4, pausa: 150, olhadelas: 1, velocidadeOlhadela: 170, leque: 0 },
  iniciar(a, cfg) {
    const g = a.decoracao(a.cena.add.graphics().setDepth(4))
    const olhos = []
    const m = 9 // a marca fica um pouco para dentro da borda

    // ponto na borda: um dos três lados mais longe do coração, num lugar sorteado
    const lugar = () => {
      const l = a.caixa
      const alvo = a.alvo()
      const lados = [
        ['top', alvo.y - l.top],
        ['bottom', l.bottom - alvo.y],
        ['left', alvo.x - l.left],
        ['right', l.right - alvo.x],
      ].sort((p, q) => q[1] - p[1])
      const lado = a.escolher(lados.slice(0, 3))[0]
      const u = a.aleatorio(0.15, 0.85)
      return {
        top: { x: l.left + u * l.width, y: l.top + m },
        bottom: { x: l.left + u * l.width, y: l.bottom - m },
        left: { x: l.left + m, y: l.top + u * l.height },
        right: { x: l.right - m, y: l.top + u * l.height },
      }[lado]
    }

    // um raio que nasce atrás da marca (fora da caixa) e entra na direção ang
    const raio = (o, ang, velocidade) => {
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      const b = a.bala({
        x: o.x - c * (m + 10),
        y: o.y - s * (m + 10),
        vx: c * velocidade,
        vy: s * velocidade,
        raio: cfg.raio,
        textura: T('olhar'),
        tamanho: 18,
        jaAvisada: true,
        vida: 2400,
        pulso: 0,
      })
      b.sprite.setRotation(ang)
    }

    const novoOlho = (j) => {
      const p = lugar()
      const img = a.decoracao(a.cena.add.image(p.x, p.y, T('raiva')).setDepth(7).setScale(0))
      a.cena.tweens.add({ targets: img, scale: 1.1, duration: 160, ease: 'Back.Out' })
      const alvo = a.alvo()
      const o = { j, x: p.x, y: p.y, img, ang: Math.atan2(alvo.y - p.y, alvo.x - p.x), travado: false, ativo: true }
      olhos[j] = o
      return o
    }

    const ciclo = (j) => {
      if (!cabe(a, cfg.encarar + cfg.trava)) {
        if (olhos[j]) olhos[j].ativo = false
        return
      }
      const o = novoOlho(j)
      // olhadelas: raios mirados direto no coração enquanto encara (tempos sorteados)
      for (let k = 0; k < cfg.olhadelas; k++) {
        const quando = ((k + a.aleatorio(0.35, 0.8)) * cfg.encarar) / (cfg.olhadelas + 0.3)
        a.depois(quando, () => {
          if (!o.ativo || o.travado) return
          const alvo = a.alvo()
          a.cena.tweens.add({ targets: o.img, scale: 1.35, duration: 70, yoyo: true })
          raio(o, Math.atan2(alvo.y - o.y, alvo.x - o.x), cfg.velocidadeOlhadela)
        })
      }
      a.depois(cfg.encarar, () => {
        o.travado = true
        tocar(a.cena, 'aviso')
        a.cena.tweens.add({ targets: o.img, scale: 1.5, duration: 90, yoyo: true, repeat: 1 })
        const c = Math.cos(o.ang)
        const s = Math.sin(o.ang)
        a.aviso({ tipo: 'linha', x1: o.x, y1: o.y, x2: o.x + c * 320, y2: o.y + s * 320, espessura: 8, cor: AMARELO, ms: cfg.trava }, () => {
          for (let k = 0; k < cfg.tiros; k++) a.depois(k * cfg.cadencia, () => raio(o, o.ang, cfg.velocidade))
          let fim = cfg.tiros * cfg.cadencia
          if (cfg.leque > 0) {
            a.depois(fim + 60, () => {
              const alvo = a.alvo()
              const meio = Math.atan2(alvo.y - o.y, alvo.x - o.x)
              for (const d of [-1, 0, 1]) raio(o, meio + d * cfg.leque, cfg.velocidade * 0.9)
            })
            fim += 60
          }
          a.depois(fim + cfg.pausa, () => {
            o.ativo = false
            a.cena.tweens.add({ targets: o.img, scale: 0, alpha: 0, duration: 140 })
            ciclo(j)
          })
        })
      })
    }

    // a linha do olhar segue o coração (girando devagar) até travar
    a.aoAtualizar((dt) => {
      g.clear()
      for (const o of olhos) {
        if (!o?.ativo) continue
        if (!o.travado) {
          const alvo = a.alvo()
          const quer = Math.atan2(alvo.y - o.y, alvo.x - o.x)
          let d = quer - o.ang
          d = Math.atan2(Math.sin(d), Math.cos(d))
          const passo = cfg.rastrear * (dt / 1000)
          o.ang += limitar(d, -passo, passo)
        }
        g.fillStyle(AMARELO, o.travado ? 0.9 : 0.55)
        const c = Math.cos(o.ang)
        const s = Math.sin(o.ang)
        for (let r = 12; r < 300; r += 9) g.fillRect(o.x + c * r - 1, o.y + s * r - 1, 2, 2)
      }
    })

    // os olhos começam defasados (com um pouco de sorteio)
    const periodo = cfg.encarar + cfg.trava
    for (let j = 0; j < cfg.olhos; j++) a.depois((j * periodo) / cfg.olhos + a.aleatorio(0, 120), () => ciclo(j))
  },
})

// ---------- ♦ Rugido ----------
//
// O grito estoura numa parede sorteada (de preferência não a mesma da última
// vez; as de cima/baixo também valem): a boca aparece na parede (`aviso`) e
// uma onda sonora em arco ')' entra de fora da caixa e a atravessa a
// `velocidade` px/s, com um vão de `lacuna` px. Nada mostra antes onde fica o
// vão: ele aparece quando a onda entra (sorteado, longe da linha do coração
// quando dá). Enquanto a onda passa, o rugido EMPURRA os corações no sentido
// dela (`empurrao` px/s, menos que a velocidade do coração). Uma onda por vez.
const susieRugido = definirAtaque({
  nome: 'susieRugido',
  padrao: { duracao: 5000, aviso: 500, velocidade: 120, lacuna: 58, passo: 13, curva: 22, empurrao: 50, raio: 6, pausa: 150 },
  iniciar(a, cfg) {
    const empurroes = []
    a.aoAtualizar((dt) => {
      for (const e of empurroes) e.restante -= dt
      const ativos = empurroes.filter((e) => e.restante > 0)
      empurroes.length = 0
      empurroes.push(...ativos)
      if (!ativos.length) return
      const dx = Math.sign(ativos.reduce((soma, e) => soma + e.n.x, 0))
      const dy = Math.sign(ativos.reduce((soma, e) => soma + e.n.y, 0))
      for (const c of a.coracoes) {
        if (!c.ativo) continue
        c.x += (dx * cfg.empurrao * dt) / 1000
        c.y += (dy * cfg.empurrao * dt) / 1000
        c.ajustar()
      }
    })

    let anterior = null
    const rugido = () => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const alvo = a.alvo()
      // parede do grito: sorteada; repetir a anterior é raro
      const lado = a.aleatorio(0, 1) < 0.2 || !anterior ? a.escolher(LADOS) : a.escolher(LADOS.filter((x) => x !== anterior))
      anterior = lado
      const p = parede(l, lado)
      const vao = Math.max(cfg.lacuna, a.lacunaMinima + 6)
      // o vão: sorteado ao longo da parede, de preferência longe da linha do coração
      const uAlvo = p.ao === 'x' ? alvo.x : alvo.y
      let gc = 0
      for (let k = 0; k < 8; k++) {
        gc = a.aleatorio(p.ini + vao / 2 + 4, p.fim - vao / 2 - 4)
        if (Math.abs(gc - uAlvo) >= vao * 0.6) break
      }
      const g0 = gc - vao / 2
      const g1 = gc + vao / 2
      a.parede({ eixo: p.ao, lacunas: [[g0, g1]] })

      // a boca na parede (só diz de onde vem o grito, não onde fica o vão)
      const meio = (p.ini + p.fim) / 2
      const pb = p.ponto(meio, 0)
      // o sprite da boca aponta para +x a partir da origem: gira para apontar para dentro
      const boca = a.decoracao(a.cena.add.image(pb.x, pb.y, T('boca')).setOrigin(0.05, 0.5).setDepth(7).setScale(0.6).setRotation(Math.atan2(p.n.y, p.n.x)))
      a.cena.tweens.add({ targets: boca, scale: 1, duration: 90, yoyo: true, repeat: -1 })

      a.depois(cfg.aviso, () => {
        a.cena.tweens.killTweensOf(boca)
        a.cena.tweens.add({ targets: boca, scale: 1.6, alpha: 0, duration: 260 })
        tocar(a.cena, 'hab-susie-rugido')
        a.tremer(220, 0.006)
        const v = cfg.velocidade
        const metade = (p.fim - p.ini) / 2
        const travessia = ((p.fundo + cfg.curva + 30) / (v * a.balas.fatorVelocidade)) * 1000
        empurroes.push({ n: p.n, restante: travessia * 0.85 })
        // o pedaço do som aponta para +x: gira para o sentido da onda
        const rumo = Math.atan2(p.n.y, p.n.x)
        for (let u = p.ini + cfg.passo / 2; u < p.fim; u += cfg.passo) {
          if (u + cfg.raio + 2 > g0 && u - cfg.raio - 2 < g1) continue // o vão
          // arco: o meio da onda vai na frente; tudo nasce fora da caixa
          const w = (u - meio) / metade
          const atras = cfg.curva * w * w
          const b = a.bala({
            ...p.ponto(u, -(8 + atras)),
            vx: p.n.x * v,
            vy: p.n.y * v,
            raio: cfg.raio,
            textura: T('som'),
            quadro: Math.round((u - p.ini) / cfg.passo) % 2,
            tamanho: 16,
            jaAvisada: true,
            vida: travessia + 200,
            pulso: 0.12,
          })
          const inclina = Math.atan((2 * cfg.curva * w) / metade) * 0.8
          b.sprite.setRotation(rumo - (p.ao === 'y' ? Math.sign(p.n.x) : -Math.sign(p.n.y)) * inclina)
        }
        a.depois(travessia * 0.6 + cfg.pausa, rugido)
      })
    }
    a.depois(0, rugido)
  },
})

// ---------- ♣ Bomba de Giz ----------
//
// A cada `intervalo` (`porVez` de cada vez) a Susie ARREMESSA um maço de gizes
// amarrados com pavio: ele entra por uma borda da caixa (a que não faz o voo
// passar em cima do coração), voa `voo` ms freando e fica onde caiu (parte
// das vezes, `perto` px do coração), piscando enquanto o pavio queima
// (`pavio` ms). O maço machuca em voo e no chão. No fim: PUF, uma nuvem de pó
// de giz fica no lugar por `nuvem` ms e `fragmentos` pedaços de giz se
// espalham em estrela (um deles no coração, na hora do estouro), freiam e
// ficam no chão por `chao` ms antes de sumir. Sem círculo de aviso: o próprio
// maço piscando é o sinal.
const susieBombaGiz = definirAtaque({
  nome: 'susieBombaGiz',
  padrao: { duracao: 5000, intervalo: 1600, porVez: 1, pavio: 1100, voo: 420, fragmentos: 5, velocidade: 130, alcance: 90, chao: 1100, nuvem: 520, raioNuvem: 22, raioGiz: 4, raioBomba: 8, mirar: 0.5, perto: 54, longe: 44 },
  iniciar(a, cfg) {
    const m = 22

    // onde o maço cai: perto do coração (plantada) ou em qualquer lugar não muito em cima dele
    const pouso = (alvo, plantada) => {
      const l = a.caixa
      let melhor = null
      for (let tentativa = 0; tentativa < 12; tentativa++) {
        let p
        if (plantada) {
          const ang = a.aleatorio(0, Math.PI * 2)
          p = { x: limitar(alvo.x + Math.cos(ang) * cfg.perto, l.left + m, l.right - m), y: limitar(alvo.y + Math.sin(ang) * cfg.perto, l.top + m, l.bottom - m) }
        } else p = { x: a.aleatorio(l.left + m, l.right - m), y: a.aleatorio(l.top + m, l.bottom - m) }
        const d = Math.hypot(p.x - alvo.x, p.y - alvo.y)
        const minimo = plantada ? cfg.perto * 0.8 : cfg.longe
        if (d >= minimo) return p
        if (!melhor || d > melhor.d) melhor = { ...p, d }
      }
      return melhor
    }

    // de onde vem o arremesso: a borda cujo voo passa mais longe do coração (empate: a mais perto)
    const origem = (p, alvo) => {
      const l = a.caixa
      let melhor = null
      for (const lado of LADOS) {
        const w = parede(l, lado)
        const u = limitar((w.ao === 'x' ? p.x : p.y) + a.aleatorio(-40, 40), w.ini + 10, w.fim - 10)
        const o = w.ponto(u, -a.aleatorio(14, 24))
        const folga = distSegmento(alvo, o, p)
        const nota = Math.min(folga, 34) * 10 - Math.hypot(p.x - o.x, p.y - o.y)
        if (!melhor || nota > melhor.nota) melhor = { ...o, nota }
      }
      return melhor
    }

    const arremessar = () => {
      if (!cabe(a, cfg.pavio + cfg.voo)) return
      const plantada = a.aleatorio(0, 1) < cfg.mirar
      const alvo = a.alvo()
      const p = pouso(alvo, plantada)
      const o = origem(p, alvo)
      const voo = cfg.voo
      let relogio = 0
      let quadro = 0
      let estourou = false
      const bomba = a.bala({
        x: o.x,
        y: o.y,
        raio: cfg.raioBomba,
        textura: T('bomba'),
        quadro: 0,
        tamanho: 25,
        jaAvisada: true,
        pulso: 0,
        girar: 0,
        vida: voo + cfg.pavio + 200,
        atualizar: (b, dt) => {
          relogio += dt * a.balas.fatorVelocidade
          if (relogio < voo) {
            // voo freando (ease-out), girando
            const q = relogio / voo
            const e = 1 - (1 - q) * (1 - q)
            b.x = o.x + (p.x - o.x) * e
            b.y = o.y + (p.y - o.y) * e
            b.sprite.setRotation(-2.4 * (1 - e))
            return
          }
          // no chão: o pavio queima e o maço pisca mais rápido no fim
          b.x = p.x
          b.y = p.y
          b.sprite.setRotation(0)
          b.pulso = 0.14
          const resta = voo + cfg.pavio - relogio
          const q2 = Math.floor(relogio / (resta < 350 ? 60 : 120)) % 2
          if (q2 !== quadro) b.sprite.setFrame((quadro = q2))
          if (resta <= 0 && !estourou) {
            estourou = true
            b.morta = true
            estourar(p)
          }
        },
      })
      bomba.sprite.setRotation(-2.4)
    }

    const estourar = (p) => {
      tocar(a.cena, 'hab-susie-giz')
      particulas(a.cena, p.x, p.y, { cor: GIZ, quantidade: 18, velocidade: 140, vida: 420 })
      // a nuvem de pó de giz
      const nuvem = a.bala({ x: p.x, y: p.y, raio: cfg.raioNuvem, textura: T('poeira'), tamanho: cfg.raioNuvem * 2.3, jaAvisada: true, atravessa: true, vida: cfg.nuvem, pulso: 0.06, girar: 0.8 })
      nuvem.atualizar = (b) => b.sprite.setAlpha(Math.max(0.2, b.vida / cfg.nuvem))
      // os pedaços de giz: saem em estrela (um no coração), freiam e ficam no chão
      const alvo = a.alvo()
      const giro = Math.atan2(alvo.y - p.y, alvo.x - p.x)
      for (let k = 0; k < cfg.fragmentos; k++) pedaco(a, cfg, p, giro + (k * Math.PI * 2) / cfg.fragmentos, a.inteiro(0, 2))
    }

    a.aCada(cfg.intervalo, () => {
      for (let k = 0; k < cfg.porVez; k++) a.depois(k * a.aleatorio(180, 320), arremessar)
    }, Infinity, 150)
  },
})

// distância do ponto c ao segmento p-q
function distSegmento(c, p, q) {
  const dx = q.x - p.x
  const dy = q.y - p.y
  const t = limitar(((c.x - p.x) * dx + (c.y - p.y) * dy) / Math.max(1e-6, dx * dx + dy * dy), 0, 1)
  return Math.hypot(c.x - (p.x + dx * t), c.y - (p.y + dy * t))
}

function pedaco(a, cfg, p, ang, n) {
  const v0 = cfg.velocidade
  const freio = (v0 * v0) / (2 * cfg.alcance) // para em `alcance` px
  let v = v0
  let parado = 0
  let rabisco = 0
  a.bala({
    x: p.x,
    y: p.y,
    raio: cfg.raioGiz,
    textura: T('giz'),
    quadro: n % 3,
    tamanho: 11,
    jaAvisada: true,
    vx: Math.cos(ang) * v0,
    vy: Math.sin(ang) * v0,
    girar: 9,
    vida: 4000,
    pulso: 0,
    atualizar: (b, dt) => {
      const s = (dt / 1000) * a.balas.fatorVelocidade
      if (v > 0) {
        v = Math.max(0, v - freio * s)
        b.vx = Math.cos(ang) * v
        b.vy = Math.sin(ang) * v
        b.girar = (9 * v) / v0
        // rabisco de giz no chão
        rabisco -= dt
        if (rabisco <= 0) {
          rabisco = 45
          const ponto = a.decoracao(a.cena.add.rectangle(b.x, b.y, 2, 2, GIZ).setDepth(2).setAlpha(0.7))
          a.cena.tweens.add({ targets: ponto, alpha: 0, duration: 700, onComplete: () => ponto.destroy() })
        }
        return
      }
      parado += dt
      b.piscar = parado > cfg.chao - 400 // pisca antes de sumir
      if (parado >= cfg.chao) b.morta = true
    },
  })
}

export default { susieCabecada, susiePisao, susieGiro, susieEncarar, susieRugido, susieBombaGiz }
