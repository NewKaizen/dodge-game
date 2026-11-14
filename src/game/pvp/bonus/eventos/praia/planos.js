// A parte PURA (sem Phaser) dos 8 eventos da arena PRAIA: as contas de regra de cada um (rastro de
// areia, crista da onda, sombra dos guarda-sóis, tesouro enterrado, pêndulo da pipa, fantasma das
// pegadas, concha e a gaivota). Os arquivos de desenho (praia/*.js) só desenham e ligam estas regras
// ao coração e às balas. Tudo é repetível pela semente (o `sorte` é o rng do evento, igual nos dois
// PCs em rede) ou só depende do tempo, sempre com aviso >= 400 ms e saída garantida
// (testes em pvp/__tests__/eventosPraia.test.js).
//
// `l` é o retângulo da caixa: { left, right, top, bottom, width, height }. Tempos em ms, `t` = relógio do
// evento (soma dos delta), distâncias em px.

import { CORACAO } from '../../../../constants.js'

const entre = (sorte, a, b) => a + (b - a) * sorte()
export const limitar = (v, a, b) => Math.max(a, Math.min(b, v))
const centroX = (l) => (l.left + l.right) / 2
const centroY = (l) => (l.top + l.bottom) / 2
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

// o coração anda no máximo isto (px/s)
export const VEL = CORACAO.velocidadePadrao

// ---------- CASTELO DE AREIA ----------
// O coração deixa uma trilha de blocos de areia molhada. Cada bloco endurece depois de `endureceMs`
// (até lá é só enfeite) e aí BLOQUEIA balas: cada bala que bate num bloco some e o bloco perde 1 de
// `aguenta` (some quando zera). A trilha tem no máximo `maximo` blocos (o mais velho cai primeiro) e
// cada bloco dura `vidaMs`. O coração atravessa a areia sem problema (a trilha nunca prende).
export const CASTELO = { passoPx: 12, raio: 8, endureceMs: 450, vidaMs: 5500, maximo: 12, aguenta: 2 }

export const novaTrilha = () => ({ blocos: [], ultimo: null })

// Põe um bloco na posição (x, y) se o coração andou `passoPx` desde o último; devolve o bloco ou null.
export function deixarRastro(trilha, x, y, t, cfg = CASTELO) {
  const u = trilha.ultimo
  if (u && dist(x, y, u.x, u.y) < cfg.passoPx) return null
  const bloco = { x, y, t, vida: cfg.aguenta }
  trilha.ultimo = { x, y }
  trilha.blocos.push(bloco)
  while (trilha.blocos.length > cfg.maximo) trilha.blocos.shift()
  return bloco
}

// o bloco já endureceu (e ainda não venceu)?
export const duro = (b, t, cfg = CASTELO) => b.vida > 0 && t - b.t >= cfg.endureceMs && t - b.t < cfg.vidaMs

// A bala (folga(x, y) = distância do ponto à borda da bala, negativa dentro) bate em algum bloco duro?
export function blocoQueBloqueia(trilha, t, folga, cfg = CASTELO) {
  for (const b of trilha.blocos) if (duro(b, t, cfg) && folga(b.x, b.y) <= cfg.raio) return b
  return null
}

// A bala bateu no bloco: ele perde uma vida. true = desmoronou
export function golpearBloco(bloco) {
  bloco.vida = Math.max(0, bloco.vida - 1)
  return bloco.vida <= 0
}

// tira os blocos vencidos ou desmoronados; devolve os que saíram
export function podarTrilha(trilha, t, cfg = CASTELO) {
  const saem = trilha.blocos.filter((b) => b.vida <= 0 || t - b.t >= cfg.vidaMs)
  if (saem.length) trilha.blocos = trilha.blocos.filter((b) => !saem.includes(b))
  return saem
}

// ---------- SURF ----------
// A crista da onda é uma faixa horizontal que sobe e desce devagar (soma de duas senóides) com uma
// ondulação que corre por ela. Fora da faixa o tempo de "caindo" sobe; passou de `avisoMs` aparece o
// alerta e em `limiteMs` é o CAIDÃO (dano pequeno): depois dele, `recuperaMs` de folga para subir de novo.
// Dentro da faixa o contador desce rápido. A crista nunca anda mais que ~0,5x a velocidade do coração.
export const SURF = { banda: 58, ondulacao: 7, avisoMs: 450, limiteMs: 1700, recuperaMs: 1300, comecoMs: 1300, dano: 0.05 }

export function planejarSurf(sorte) {
  return { f1: entre(sorte, 0.85, 1.2), f2: entre(sorte, 1.5, 2.05), p1: entre(sorte, 0, 6.28), p2: entre(sorte, 0, 6.28), ondas: entre(sorte, 0.04, 0.05) }
}

export const alturaDaBanda = (l, cfg = SURF) => Math.min(cfg.banda, (l.bottom - l.top) * 0.4)

// y do centro da crista na coluna x, no instante t
export function cristaY(plano, l, x, t, cfg = SURF) {
  const h = alturaDaBanda(l, cfg)
  const amp = Math.max(0, (l.bottom - l.top - h) / 2 - cfg.ondulacao - 4)
  const base = 0.6 * Math.sin((plano.f1 * t) / 1000 + plano.p1) + 0.4 * Math.sin((plano.f2 * t) / 1000 + plano.p2)
  const onda = cfg.ondulacao * Math.sin((x - l.left) * plano.ondas - (t / 1000) * 2.2)
  return centroY(l) + amp * base + onda
}

export const naCrista = (y, cristaCentro, l, cfg = SURF, folga = 0) => Math.abs(y - cristaCentro) <= alturaDaBanda(l, cfg) / 2 + folga

export const novoSurf = (cfg = SURF) => ({ foraMs: 0, imuneMs: cfg.comecoMs })

// Um passo do contador de queda; devolve 'caiu' no instante do caidão, senão null
export function passoSurf(est, dentro, dt, cfg = SURF) {
  if (est.imuneMs > 0) {
    est.imuneMs = Math.max(0, est.imuneMs - dt)
    est.foraMs = 0
    return null
  }
  est.foraMs = dentro ? Math.max(0, est.foraMs - 2 * dt) : est.foraMs + dt
  if (est.foraMs >= cfg.limiteMs) {
    est.foraMs = 0
    est.imuneMs = cfg.recuperaMs
    return 'caiu'
  }
  return null
}

export const alertaSurf = (est, cfg = SURF) => est.imuneMs <= 0 && est.foraMs >= cfg.avisoMs

// ---------- SOL DO MEIO-DIA ----------
// Guarda-sóis passeiam em órbitas suaves (senóides): só a sombra de cada um protege. Fora da sombra o
// CALOR sobe de 0 a 1 em `sobeMs`; na sombra desce em `desceMs`. Cheio: queimou (dano pequeno) e o calor
// volta para `depois` (a próxima queimadura demora ~1,4 s, nunca em rajada).
export const SOL = { raio: 42, sobeMs: 2600, desceMs: 1000, dano: 0.04, depois: 0.45, aviso: 0.5, velocidadeMax: 40 }

export function planejarGuardaSois(sorte, l, n = 2) {
  return Array.from({ length: n }, (_, k) => ({
    cx: l.left + l.width * (n === 1 ? 0.5 : 0.28 + (0.44 * k) / (n - 1)),
    cy: centroY(l) + entre(sorte, -12, 12),
    ax: Math.min(l.width * 0.2, 46),
    ay: Math.min(l.height * 0.2, 36),
    wx: entre(sorte, 0.32, 0.5),
    wy: entre(sorte, 0.45, 0.65),
    px: entre(sorte, 0, 6.28),
    py: entre(sorte, 0, 6.28),
  }))
}

export function posicaoDoGuardaSol(g, t) {
  return { x: g.cx + g.ax * Math.sin((g.wx * t) / 1000 + g.px), y: g.cy + g.ay * Math.sin((g.wy * t) / 1000 + g.py) }
}

export function naSombra(guardaSois, t, x, y, cfg = SOL) {
  return guardaSois.some((g) => {
    const p = posicaoDoGuardaSol(g, t)
    return dist(x, y, p.x, p.y) <= cfg.raio
  })
}

// o guarda-sol cuja sombra está mais perto de (x, y): { x, y } do centro dele
export function sombraMaisPerto(guardaSois, t, x, y) {
  let melhor = null
  for (const g of guardaSois) {
    const p = posicaoDoGuardaSol(g, t)
    const d = dist(x, y, p.x, p.y)
    if (!melhor || d < melhor.d) melhor = { x: p.x, y: p.y, d }
  }
  return melhor
}

// Um passo do calor; devolve { calor, queimou }
export function passoCalor(calor, sombra, dt, cfg = SOL) {
  if (sombra) return { calor: Math.max(0, calor - dt / cfg.desceMs), queimou: false }
  const novo = calor + dt / cfg.sobeMs
  if (novo >= 1) return { calor: cfg.depois, queimou: true }
  return { calor: novo, queimou: false }
}

// ---------- CAÇA AO TESOURO ----------
// Um tesouro enterrado num ponto escondido da caixa. O detector apita mais rápido quanto mais perto
// (intervalo linear entre `bipPertoMs` e `bipLongeMs`). Ficar em cima (a menos de `raioCava`) por
// `cavaMs` desenterra: cura `cura` do HP máximo (cheio de vida: +1 de energia). Ao sair, o progresso
// volta o dobro mais rápido. Depois de `esperaMs` surge outro, até `maxAchados` por caixa.
export const TESOURO = { cavaMs: 600, raioCava: 15, bipPertoMs: 130, bipLongeMs: 950, distLonge: 200, cura: 0.06, maxAchados: 3, esperaMs: 1600, distCoracao: 70, distAnterior: 60 }

export function planejarTesouro(sorte, l, coracao, anterior = null, cfg = TESOURO) {
  const margem = 24
  let melhor = null
  for (let k = 0; k < 40; k++) {
    const p = { x: entre(sorte, l.left + margem, l.right - margem), y: entre(sorte, l.top + margem, l.bottom - margem) }
    const dc = coracao ? dist(p.x, p.y, coracao.x, coracao.y) : Infinity
    const da = anterior ? dist(p.x, p.y, anterior.x, anterior.y) : Infinity
    if (dc >= cfg.distCoracao && da >= cfg.distAnterior) return p
    const nota = Math.min(dc / cfg.distCoracao, da / cfg.distAnterior)
    if (!melhor || nota > melhor.nota) melhor = { ...p, nota }
  }
  return { x: melhor.x, y: melhor.y } // caixa pequena: o melhor que deu
}

export function intervaloDoBip(d, cfg = TESOURO) {
  const k = limitar(d / cfg.distLonge, 0, 1)
  return cfg.bipPertoMs + (cfg.bipLongeMs - cfg.bipPertoMs) * k
}

// Um passo da escavação; devolve { prog (ms), achou }
export function passoCava(prog, dentro, dt, cfg = TESOURO) {
  const novo = dentro ? prog + dt : Math.max(0, prog - 2 * dt)
  return novo >= cfg.cavaMs ? { prog: 0, achou: true } : { prog: novo, achou: false }
}

// ---------- PIPA ----------
// O coração pendurado numa pipa: um pêndulo. A mola puxa de volta para a âncora (a pipa), o direcional
// soma força (`forca` px/s²), a corda de `corda` px é o limite e o amortecimento é leve. A âncora passeia
// devagar (<= ~22 px/s). Com a mola e a força certas, qualquer ponto da corda dá para segurar com 0,72 do
// direcional. A saída é a velocidade (o direcional do jogo = velocidade / VEL).
export const PIPA = { corda: 94, mola: 4.2, forca: 520, amortece: 0.5, vMax: VEL, ancoraMax: 22 }

export function planejarPipa(sorte) {
  return { wx: entre(sorte, 0.22, 0.3), wy: entre(sorte, 0.3, 0.4), px: entre(sorte, 0, 6.28), py: entre(sorte, 0, 6.28) }
}

export function ancoraDaPipa(plano, l, t) {
  return {
    x: centroX(l) + Math.min(l.width * 0.2, 44) * Math.sin((plano.wx * t) / 1000 + plano.px),
    y: centroY(l) + Math.min(l.height * 0.14, 24) * Math.sin((plano.wy * t) / 1000 + plano.py),
  }
}

// Um passo do pêndulo. est = { x, y, vx, vy }, input = { x, y } em -1..1. Devolve o mesmo est (mudado).
// vMax: teto de velocidade (px/s). A corda segura: passou do comprimento, a posição volta para o círculo
// e a parte da velocidade que puxa para fora some.
export function passoPipa(est, ancora, input, dt, cfg = PIPA, vMax = cfg.vMax) {
  const s = dt / 1000
  const rx = est.x - ancora.x
  const ry = est.y - ancora.y
  est.vx += (-cfg.mola * rx + cfg.forca * input.x - cfg.amortece * est.vx) * s
  est.vy += (-cfg.mola * ry + cfg.forca * input.y - cfg.amortece * est.vy) * s
  const v = Math.hypot(est.vx, est.vy)
  if (v > vMax) {
    est.vx *= vMax / v
    est.vy *= vMax / v
  }
  est.x += est.vx * s
  est.y += est.vy * s
  const nx = est.x - ancora.x
  const ny = est.y - ancora.y
  const r = Math.hypot(nx, ny)
  if (r > cfg.corda) {
    const ux = nx / r
    const uy = ny / r
    est.x = ancora.x + ux * cfg.corda
    est.y = ancora.y + uy * cfg.corda
    const radial = est.vx * ux + est.vy * uy
    if (radial > 0) {
      est.vx -= radial * ux
      est.vy -= radial * uy
    }
  }
  return est
}

// ---------- PEGADAS ----------
// O coração grava o caminho; um fantasma refaz EXATAMENTE esse caminho `atrasoMs` depois (a posição do
// fantasma em t é a do coração em t - atrasoMs). Ele nasce translúcido e inofensivo por `nasceMs` (dá para
// sair do caminho) e só então machuca. As pegadas ficam na areia e somem em `pegadaVidaMs`.
export const PEGADAS = { atrasoMs: 2000, nasceMs: 700, raio: 9, passoPegada: 16, pegadaVidaMs: 2300, dano: 4 }

export const novoHistorico = () => []

export function gravarPasso(hist, t, x, y, cfg = PEGADAS) {
  hist.push({ t, x, y })
  const corte = t - cfg.atrasoMs - 400
  while (hist.length > 2 && hist[1].t < corte) hist.shift()
}

// onde o coração estava em t - atrasoMs ({ x, y, vx, vy } em px/s), ou null se ainda não deu o atraso
export function posicaoDoFantasma(hist, t, cfg = PEGADAS) {
  const alvo = t - cfg.atrasoMs
  if (!hist.length || hist[0].t > alvo) return null
  let i = 0
  while (i + 1 < hist.length && hist[i + 1].t <= alvo) i++
  const a = hist[i]
  const b = hist[Math.min(i + 1, hist.length - 1)]
  const k = b.t > a.t ? limitar((alvo - a.t) / (b.t - a.t), 0, 1) : 0
  const x = a.x + (b.x - a.x) * k
  const y = a.y + (b.y - a.y) * k
  const dt = Math.max(1, b.t - a.t) / 1000
  return { x, y, vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt }
}

// ---------- CONCHA ----------
// Uma concha gigante abre: `abrindoMs` abrindo (ainda não protege), `abertaMs` aberta, com invulnerabilidade
// dentro dela; nos últimos `avisoMs` ela pisca e fecha (aviso). No estalo, quem ainda está dentro leva dano
// (`dano` do HP máximo). Fica `fechadaMs` fechada (inofensiva) e reabre em outro lugar.
export const CONCHA = { raio: 30, abrindoMs: 550, abertaMs: 3800, avisoMs: 1100, fechadaMs: 1300, dano: 0.05, distAnterior: 80 }

export const cicloDaConcha = (cfg = CONCHA) => cfg.abrindoMs + cfg.abertaMs + cfg.fechadaMs

// { fase: 'abrindo' | 'aberta' | 'fechando' | 'fechada', p (0..1 na fase), falta (ms até o estalo, 0 depois dele), protege }
export function faseDaConcha(idade, cfg = CONCHA) {
  const estalo = cfg.abrindoMs + cfg.abertaMs
  if (idade < cfg.abrindoMs) return { fase: 'abrindo', p: idade / cfg.abrindoMs, falta: estalo - idade, protege: false }
  if (idade < estalo - cfg.avisoMs) return { fase: 'aberta', p: (idade - cfg.abrindoMs) / (cfg.abertaMs - cfg.avisoMs), falta: estalo - idade, protege: true }
  if (idade < estalo) return { fase: 'fechando', p: (idade - (estalo - cfg.avisoMs)) / cfg.avisoMs, falta: estalo - idade, protege: true }
  return { fase: 'fechada', p: limitar((idade - estalo) / cfg.fechadaMs, 0, 1), falta: 0, protege: false }
}

export function planejarConcha(sorte, l, anterior = null, cfg = CONCHA) {
  const m = cfg.raio + 8
  let melhor = null
  for (let k = 0; k < 40; k++) {
    const p = { x: entre(sorte, l.left + m, l.right - m), y: entre(sorte, l.top + m, l.bottom - m) }
    const d = anterior ? dist(p.x, p.y, anterior.x, anterior.y) : Infinity
    if (d >= cfg.distAnterior) return p
    if (!melhor || d > melhor.d) melhor = { ...p, d }
  }
  return { x: melhor.x, y: melhor.y } // a caixa é pequena: o mais longe que deu
}

// ---------- GAIVOTA LADRA ----------
// A gaivota roda em volta da caixa (`voltaMs`), TRAVA a mira no coração (sombra e anel no chão, `avisoMs`),
// mergulha (`mergulhoMs`) e foge (`fugaMs`). Só pega quem ainda estiver a menos de `raioAlvo` do alvo
// travado na janela do golpe (fim do mergulho): basta sair do anel. Rouba `rouba` de energia (sem
// energia, um arranhão de `danoSemEnergia` do HP máximo).
export const GAIVOTA = { voltaMs: { min: 1700, max: 2500 }, avisoMs: 800, mergulhoMs: 260, fugaMs: 800, raioAlvo: 19, rouba: 1, danoSemEnergia: 0.03, primeiraMs: { min: 900, max: 1500 } }

export function planejarGaivota(sorte, primeira = false, cfg = GAIVOTA) {
  const v = primeira ? cfg.primeiraMs : cfg.voltaMs
  return { voltaMs: entre(sorte, v.min, v.max), sentido: sorte() < 0.5 ? 1 : -1, fase0: entre(sorte, 0, 6.28) }
}

export const duracaoDoCiclo = (plano, cfg = GAIVOTA) => plano.voltaMs + cfg.avisoMs + cfg.mergulhoMs + cfg.fugaMs

// { fase: 'voa' | 'mira' | 'mergulha' | 'foge' | 'fim', p, golpe (true na janela em que pega) }
export function faseDaGaivota(idade, plano, cfg = GAIVOTA) {
  const aMira = plano.voltaMs
  const aMergulho = aMira + cfg.avisoMs
  const aFuga = aMergulho + cfg.mergulhoMs
  const fim = aFuga + cfg.fugaMs
  if (idade < aMira) return { fase: 'voa', p: idade / aMira, golpe: false }
  if (idade < aMergulho) return { fase: 'mira', p: (idade - aMira) / cfg.avisoMs, golpe: false }
  if (idade < aFuga) {
    const p = (idade - aMergulho) / cfg.mergulhoMs
    return { fase: 'mergulha', p, golpe: p >= 0.5 }
  }
  if (idade < fim) {
    const p = (idade - aFuga) / cfg.fugaMs
    return { fase: 'foge', p, golpe: p <= 0.12 }
  }
  return { fase: 'fim', p: 1, golpe: false }
}

// a gaivota pegou? (o coração dentro do anel travado)
export const gaivotaPegou = (alvo, coracao, cfg = GAIVOTA) => dist(alvo.x, alvo.y, coracao.x, coracao.y) <= cfg.raioAlvo + (coracao.hitbox ?? CORACAO.hitbox)
