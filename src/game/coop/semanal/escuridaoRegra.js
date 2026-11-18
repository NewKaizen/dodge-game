// A REGRA da Escuridão: OLHOS NO BREU (CO-OP 2.0, docs/boss-semanal.md "ESCURIDÃO").
//
//   Na esquiva, OLHOS da Escuridão se abrem no escuro, um de cada vez (brilham por cima do breu e sussurram do
//   lado deles, na panorâmica das pistas de som). Um coração parado em cima de um olho aberto FECHA o olho com a
//   própria luz (o anel dourado enche); dois juntos fecham no dobro da velocidade. Cada olho fechado enche a
//   QUEBRA e fere a sombra. Fechar TODOS da esquiva acende um clarão (o breu abre e mostra as balas).
//   Olho que fica aberto no fim da esquiva deixa a PRÓXIMA RODADA no escuro: nela a prévia da carta de depois vira
//   "?" (o gancho `previa` da regra) e o time joga sem saber o que vem. Fase 2: os olhos PISCAM (fechado de vez em quando, aí a luz não pega); fase 3: os olhos
//   ANDAM devagar pelo quadro.
//
// Lógica pura (testada em coop/__tests__/escuridaoRegra.test.js); o desenho só roda quando a arena dá `api.cena`.
// Rede: os olhos saem do api.rng (os mesmos em todos os PCs), nascem juntos no comecarEsquiva (zonas com os mesmos
// ids, escondidas acima da caixa até abrir) e andam por uma função do tempo. Quem está em cima de cada olho vem
// da API (o PC dono do coração decide a entrada e a saída da zona e repassa); quem DECIDE que o olho fechou é o
// PC dono do menor coração em cima dele (api.enviar 'fechou'): todos aplicam a QUEBRA e o golpe uma vez só.
import { pistaSonora } from '../../audio.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

// Os números (docs/boss-semanal.md)
//   porFase     olhos por esquiva em cada fase (+1 por jogador além de 2)
//   fecharMs    ms de um coração em cima para fechar (cada coração a mais acelera; até `juntos` x)
//   primeiro    ms até o 1º olho abrir · entre  ms entre um olho e o próximo, por fase
//   quebra      pontos de QUEBRA por olho fechado · dano  fração do HP máximo do chefe por olho fechado
//   piscar      a partir da fase `de`: aberto `aberto` ms, fechado `fechado` ms (a luz só pega aberto)
//   deriva      a partir da fase `de`: os olhos andam `velocidade` px/s, quicando nas bordas
export const OLHOS = {
  porFase: [2, 3, 3],
  fecharMs: 1150,
  juntos: 2,
  primeiro: 650,
  entre: [1500, 1250, 1100],
  quebra: 13,
  dano: 0.015,
  raio: 15,
  margem: 26,
  distancia: 70,
  piscar: { de: 1, aberto: 1700, fechado: 650 },
  deriva: { de: 2, velocidade: 24 },
  hpMaxPadrao: 420,
}

const limitar = (v, a, b) => Math.min(b, Math.max(a, v))
// vai e volta entre a e b (o olho que anda quica nas bordas)
function quicar(v, a, b) {
  const L = b - a
  if (L <= 0) return a
  const m = (((v - a) % (2 * L)) + 2 * L) % (2 * L)
  return a + (m <= L ? m : 2 * L - m)
}

// Os olhos da esquiva: [{ k, x0, y0, t0, vx, vy, pisca }] (rng = api.rng: iguais em todos os PCs)
export function planejarOlhos({ rng, fase = 0, n = 2, limites, cfg = OLHOS }) {
  const f = Math.min(fase, cfg.porFase.length - 1)
  const quantos = cfg.porFase[f] + Math.max(0, n - 2)
  const m = cfg.margem
  const olhos = []
  for (let k = 0; k < quantos; k++) {
    // longe dos outros olhos (algumas tentativas; a última vale)
    let x = 0
    let y = 0
    for (let t = 0; t < 8; t++) {
      x = limites.x + m + rng() * (limites.width - 2 * m)
      y = limites.y + m + rng() * (limites.height - 2 * m)
      if (olhos.every((o) => Math.hypot(o.x0 - x, o.y0 - y) >= cfg.distancia)) break
    }
    const ang = rng() * Math.PI * 2
    const anda = f >= cfg.deriva.de ? cfg.deriva.velocidade : 0
    olhos.push({ k, x0: x, y0: y, t0: cfg.primeiro + k * cfg.entre[f], vx: Math.cos(ang) * anda, vy: Math.sin(ang) * anda, pisca: f >= cfg.piscar.de ? rng() * (cfg.piscar.aberto + cfg.piscar.fechado) : null })
  }
  return olhos
}

// O olho `ms` depois do começo da esquiva: { x, y, nasceu, aberto }. Antes de nascer fica escondido acima da caixa
export function estadoDoOlho(o, ms, limites, cfg = OLHOS) {
  if (ms < o.t0) return { x: o.x0, y: limites.y - 300, nasceu: false, aberto: false }
  const idade = (ms - o.t0) / 1000
  const m = cfg.margem
  const x = quicar(o.x0 + o.vx * idade, limites.x + m, limites.x + limites.width - m)
  const y = quicar(o.y0 + o.vy * idade, limites.y + m, limites.y + limites.height - m)
  let aberto = true
  if (o.pisca != null) {
    const ciclo = cfg.piscar.aberto + cfg.piscar.fechado
    // os primeiros 600 ms sempre abertos (o olho acabou de abrir)
    aberto = ms - o.t0 < 600 || (ms - o.t0 + o.pisca) % ciclo < cfg.piscar.aberto
  }
  return { x, y, nasceu: true, aberto }
}

// quanto a luz enche por ms com `quantos` corações em cima (aberto)
export const luzPorMs = (quantos, cfg = OLHOS) => (quantos > 0 ? Math.min(cfg.juntos, quantos) / cfg.fecharMs : 0)

// ---------- desenho (só no navegador) ----------

const PROFUNDIDADE = 9.58 // acima do breu (9.5) e dos avisos dos ataques (9.55)
function desenharOlho(cena, caixa) {
  const g = cena.add.graphics().setDepth(PROFUNDIDADE)
  caixa?.recortar(g)
  return g
}
function pintarOlho(g, { x, y, abre, aberto, luz, tempo, fechado }) {
  g.clear()
  if (abre <= 0) return
  const r = OLHOS.raio
  if (fechado) {
    // fechado de vez: a pálpebra costurada de luz
    g.lineStyle(2, 0xffe9a0, 0.8 * abre).lineBetween(x - r, y, x + r, y)
    for (let k = -2; k <= 2; k++) g.lineBetween(x + k * 6, y - 2, x + k * 6, y + 2)
    return
  }
  const alto = (aberto ? 1 : 0.12) * abre
  // o halo roxo (a luz do olho no breu) e o anel da luz do coração
  g.fillStyle(0x8a7cff, 0.16 + 0.06 * Math.sin(tempo / 160)).fillCircle(x, y, r + 9)
  g.fillStyle(0x0b0918, 1).fillEllipse(x, y, r * 2 + 4, (r + 2) * 1.1 * Math.max(0.2, alto))
  g.fillStyle(0xe8e0ff, 1).fillEllipse(x, y, r * 2, r * 1.05 * alto + 0.5)
  if (alto > 0.3) {
    g.fillStyle(0xd02a4a, 1).fillCircle(x + Math.sin(tempo / 400) * 3, y, 6 * alto)
    g.fillStyle(0x0b0918, 1).fillEllipse(x + Math.sin(tempo / 400) * 3, y, 2.5, 9 * alto)
    g.fillStyle(0xffffff, 0.9).fillCircle(x - 3, y - 3, 1.4)
  }
  g.lineStyle(2, 0x8a7cff, 1).strokeEllipse(x, y, r * 2 + 4, (r + 2) * 1.1 * Math.max(0.2, alto))
  if (luz > 0) {
    g.lineStyle(3, 0xffe14a, 0.95).beginPath().arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, luz)).strokePath()
  }
}

export function criarRegraEscuridao(opcoes = {}) {
  const cfg = { ...OLHOS, ...opcoes }
  return {
    id: 'olhosNoBreu',
    nome: 'OLHOS NO BREU',
    descricao: 'Olhos se abrem no escuro: fiquem em cima deles para fechar e encher a QUEBRA!',
    fases: opcoes.fases ?? {
      1: { descricao: 'Os olhos PISCAM: a luz só fecha o olho aberto!' },
      2: { descricao: 'Os olhos ANDAM pelo breu: persigam e fechem!' },
    },
    criar(api) {
      let fase = 0
      let tempo = 0
      let olhos = [] // { plano, zona, luz, fechado, pedido, g, abriu, somEm }
      let escondidaNa = null // a rodada em que a prévia fica no escuro (algum olho ficou aberto na anterior)
      let rodadaDaEsquiva = null
      const hpMax = () => api.chefe()?.hpMax ?? cfg.hpMaxPadrao

      const apagarDesenho = (o) => {
        if (o.g) {
          api.cena?.tweens?.killTweensOf(o.g)
          o.g.destroy()
          o.g = null
        }
      }

      const fechar = (o) => {
        if (o.fechado) return
        o.fechado = true
        o.luz = 1
        api.removerZona(o.zona)
        api.adicionarQuebra(cfg.quebra, 'olho')
        api.danoNoChefe(Math.max(1, Math.round(hpMax() * cfg.dano)), 'olho')
        api.dica('fechou', 'Olho fechado: a QUEBRA enche e a sombra sente!')
        api.cena?.registrar?.(`olho:${o.plano.k}`)
        if (api.cena) {
          const p = estadoDoOlho(o.plano, tempo, api.limites(), cfg)
          particulas(api.cena, p.x, p.y, { cor: 0xffe14a, quantidade: 14, velocidade: 120 })
          tocar(api.cena, 'brilhoRank')
        }
        if (olhos.length && olhos.every((x) => x.fechado)) {
          api.banner('O BREU RECUA!', '#ffe9a0')
          api.cena?.escuridao?.clarao?.()
        }
      }

      return {
        comecarEsquiva() {
          tempo = 0
          rodadaDaEsquiva = api.rodada
          for (const o of olhos) apagarDesenho(o)
          const planos = planejarOlhos({ rng: api.rng('olhos'), fase, n: api.n, limites: api.limites(), cfg })
          olhos = planos.map((plano) => {
            const lado = cfg.raio * 2 + 4
            const zona = api.adicionarZona({ x: plano.x0, y: api.limites().y - 300, largura: lado, altura: lado, cor: 0x8a7cff, alpha: 0 })
            // a zona não aparece (o olho é o desenho)
            if (api.cena) {
              api.cena.tweens?.killTweensOf?.(zona.desenho)
              for (const d of zona.desenho ?? []) d.destroy?.()
              zona.desenho = []
            }
            return { plano, zona, luz: 0, fechado: false, pedido: false, g: api.cena?.quadro ? desenharOlho(api.cena, api.cena.quadro.caixa) : null, abriu: false, somEm: 0 }
          })
          api.dica('olhos', 'Olhos no breu: parem em cima deles para fechar (juntos é mais rápido)!')
        },

        atualizar(dt) {
          tempo += dt
          const l = api.limites()
          const coracoes = api.coracoes()
          const eu = coracoes.find((c) => c.ativo && api.meu(c.j))
          for (const o of olhos) {
            const e = estadoDoOlho(o.plano, tempo, l, cfg)
            o.zona.x = e.x
            o.zona.y = e.y
            if (e.nasceu && !o.abriu) {
              o.abriu = true
              if (api.cena) tocar(api.cena, 'abismo')
            }
            if (!o.fechado && e.nasceu) {
              // quem está em cima (a API mantém zona.dentro igual em todos os PCs)
              const dentro = [...o.zona.dentro].filter((j) => coracoes.some((c) => c.j === j && c.ativo)).sort((a, b) => a - b)
              if (e.aberto) o.luz = Math.min(1, o.luz + dt * luzPorMs(dentro.length, cfg))
              // quem decide é o dono do menor coração em cima
              if (o.luz >= 1 && !o.pedido && dentro.length && api.meu(dentro[0])) {
                o.pedido = true
                api.enviar('fechou', { k: o.plano.k, r: rodadaDaEsquiva })
              }
              // o sussurro do olho, do lado dele (só o som deste PC, relativo ao meu coração)
              o.somEm -= dt
              if (eu && e.aberto && o.somEm <= 0 && api.cena) {
                o.somEm = 1100
                const pan = limitar((e.x - eu.x) / Math.max(1, l.width / 2), -1, 1)
                pistaSonora({ pan, freq: 196, timbre: 'sino', volume: 0.35 })
              }
            }
            if (o.g) {
              const abre = e.nasceu ? Math.min(1, (tempo - o.plano.t0) / 300) : 0
              pintarOlho(o.g, { x: e.x, y: e.y, abre, aberto: e.aberto, luz: o.luz, tempo, fechado: o.fechado })
            }
          }
        },

        aoMensagem(lado, acao, dados) {
          if (acao !== 'fechou' || dados?.r !== rodadaDaEsquiva) return
          const o = olhos.find((x) => x.plano.k === dados.k)
          if (o) fechar(o)
        },

        terminarEsquiva() {
          // olho aberto no fim: na próxima rodada a prévia fica no escuro
          const aberto = olhos.some((o) => !o.fechado)
          escondidaNa = aberto ? api.rodada + 1 : null
          if (aberto) {
            api.dica('aberto', 'Olho aberto no fim: na próxima rodada a prévia dela fica NO ESCURO!')
            api.cena?.registrar?.('previaNoEscuro')
          }
          for (const o of olhos) apagarDesenho(o)
          olhos = []
        },

        // a prévia: na rodada depois de uma esquiva com olho aberto, a carta de depois fica no escuro (o SUPER e o
        // ATORDOADO não: o SUPER tem a barra de carga dele e o ATORDOADO é mérito do time)
        previa(p) {
          if (escondidaNa != null && api.rodada === escondidaNa && p?.tipo === 'carta') return { tipo: 'escuro' }
          return p
        },

        faseNova(f) {
          fase = f
        },

        // a CPU aliada vai para o olho aberto mais perto (fechar juntos é mais rápido)
        alvoDoBot(j) {
          const c = api.coracoes().find((x) => x.j === j && x.ativo)
          if (!c) return null
          const l = api.limites()
          let melhor = null
          let d = Infinity
          for (const o of olhos) {
            if (o.fechado) continue
            const e = estadoDoOlho(o.plano, tempo, l, cfg)
            if (!e.nasceu) continue
            const dist = Math.hypot(e.x - c.x, e.y - c.y)
            if (dist < d) {
              d = dist
              melhor = { x: e.x, y: e.y, raio: cfg.raio * 0.5 }
            }
          }
          return melhor
        },

        terminar() {
          for (const o of olhos) apagarDesenho(o)
        },

        // (testes e dev)
        estado: () => ({ fase, escondidaNa, olhos: olhos.map((o) => ({ k: o.plano.k, luz: Math.round(o.luz * 100) / 100, fechado: o.fechado })) }),
      }
    },
  }
}

export const REGRA_ESCURIDAO = criarRegraEscuridao()
