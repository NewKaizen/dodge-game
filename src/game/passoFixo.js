// PASSO FIXO da simulação da esquiva (docs/desempenho.md "Fase 4"): o coração, as balas, os ataques,
// as regras dos chefes, os eventos de bônus e a colisão andam em TIQUES de 1/60 s, tirados de um
// acumulador, qualquer que seja a taxa da tela (30, 60, 144 Hz) e mesmo com a CPU engasgando. O desenho
// INTERPOLA entre o tique anterior e o atual (interpolarPista), então a 144 Hz o movimento fica liso.
// Sem Phaser: testado em src/game/__tests__/passoFixo.test.js.
//
//   const passo = criarPassoFixo()
//   const n = passo.avancar(deltaMs, (dt) => simular(dt))   // n tiques (0..MAX_TIQUES) de PASSO_MS
//   passo.alfa                                              // 0..1: onde o quadro cai entre o tique
//                                                           // anterior (0) e o atual (1)
//
// O relógio da simulação fica À FRENTE do da tela (até um tique): roda tique enquanto o acumulador passa
// de FOLGA_MS, e o quadro mostra o estado no tempo exato da tela, entre o tique anterior e o atual. A
// 60 Hz cada quadro roda exatamente um tique e alfa = 1 (o desenho é o estado atual, como antes da fase
// 4: a paridade visual não muda). A FOLGA absorve o arredondamento (o quadro de 16,667 ms do medidor
// contra o tique de 16,6666... ms) sem tique extra.
//
// Espiral da morte: no máximo MAX_TIQUES por quadro; o atraso que sobrar é jogado fora (o jogo anda mais
// devagar num engasgo longo em vez de travar tentando alcançar).
export const PASSO_MS = 1000 / 60
export const MAX_TIQUES = 5
export const FOLGA_MS = 0.5

export function criarPassoFixo({ passoMs = PASSO_MS, maxTiques = MAX_TIQUES, folgaMs = FOLGA_MS } = {}) {
  let acumulado = 0 // tempo da tela - tempo da simulação (negativo: a simulação está à frente)
  return {
    passoMs,
    alfa: 1,
    tiques: 0, // total de tiques rodados (já conta o tique em andamento)
    // limite: o teto de tiques deste quadro (o debug.acelerar sobe o teto junto: limiteDeTiques)
    avancar(deltaMs, tique, limite = maxTiques) {
      if (deltaMs > 0 && Number.isFinite(deltaMs)) acumulado += deltaMs
      let n = 0
      while (acumulado > folgaMs && n < limite) {
        this.tiques++
        tique(passoMs)
        acumulado -= passoMs
        n++
      }
      if (acumulado > folgaMs) acumulado = 0 // engasgo longo: não tenta alcançar
      this.alfa = Math.min(1, Math.max(0, 1 + acumulado / passoMs))
      return n
    },
    // recomeça (cena nova, rodada nova): o próximo quadro roda do zero
    zerar() {
      acumulado = 0
      this.alfa = 1
    },
  }
}

// o teto de tiques por quadro com o jogo acelerado (debug.acelerar: o delta já vem multiplicado)
export const limiteDeTiques = (acelerar = 1) => Math.ceil(MAX_TIQUES * Math.max(1, acelerar))

// O quadro de uma cena com pistas (cena.pistas): desfaz a interpolação do quadro anterior, roda os tiques
// (tique(dt)) e interpola o desenho. O passo fixo mora em cena.passoFixo (criado na primeira vez)
export function andarEsquiva(cena, delta, tique, acelerar = 1) {
  cena.passoFixo ??= criarPassoFixo()
  const pistas = cena.pistas ?? []
  for (const p of pistas) p.desfazerInterpolacao?.()
  cena.passoFixo.avancar(delta, tique, limiteDeTiques(acelerar))
  const alfa = cena.passoFixo.alfa
  for (const p of pistas) p.interpolar?.(alfa)
}

// ---------- interpolação do desenho ----------
//
// A simulação mexe em x/y (corações e balas); o sprite é só o desenho. No começo de cada tique a pista
// guarda a posição de antes (lembrarAnterior), e depois dos tiques do quadro o sprite vai para o ponto
// entre o anterior e o atual (aplicar). Antes do próximo tique o deslocamento é desfeito (desfazer): a
// simulação nunca vê um sprite fora do lugar. O deslocamento é RELATIVO (sprite += ponto - atual), então
// sprites que um ataque põe fora do x/y da bala (a ponta da Noelle) continuam no lugar certo.

// guarda a posição de antes do tique (balas novas no meio do tique não têm: não interpolam)
export function lembrarAnterior(lista) {
  for (const o of lista) {
    o.xAnt = o.x
    o.yAnt = o.y
  }
}

// desloca os objetos de desenho de `o` (lista `alvos`) para o ponto interpolado; guarda o deslocamento
export function aplicarInterpolacao(o, alvos, alfa) {
  if (o.xAnt === undefined) return
  const dx = (o.xAnt - o.x) * (1 - alfa)
  const dy = (o.yAnt - o.y) * (1 - alfa)
  if (dx === 0 && dy === 0) return
  const feitos = []
  for (const s of alvos) {
    if (!s || !s.scene) continue
    const x0 = s.x
    const y0 = s.y
    s.x = x0 + dx
    s.y = y0 + dy
    feitos.push(s, x0, y0, s.x, s.y)
  }
  o.interp = feitos
}

// volta os sprites para o x/y da simulação (só os que ninguém mexeu depois de aplicar)
export function desfazerInterpolacao(o) {
  const f = o.interp
  if (!f) return
  o.interp = null
  for (let k = 0; k < f.length; k += 5) {
    const s = f[k]
    if (!s.scene || s.x !== f[k + 3] || s.y !== f[k + 4]) continue
    s.x = f[k + 1]
    s.y = f[k + 2]
  }
}
