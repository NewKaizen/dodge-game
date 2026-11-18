// A REGRA da Ladra de Cartas: PEGA LADRA! (CO-OP 2.0, docs/boss-semanal.md "LADRA DE CARTAS").
//
//   Na esquiva, a carta MARCADA (a roubada mais antiga: a que ela vai jogar contra o time, a mesma que a PRÉVIA
//   mostra) FOGE pelo quadro, zanzando. Encostar nela devolve a carta para a MÃO do dono (recuperarRoubada) e enche
//   a QUEBRA. Ela só fica no quadro por uma janela: depois volta voando para a ladra. Fase 2: fogem as DUAS mais
//   antigas; fase 3: elas correm mais. Um desvia e atrai o ataque enquanto o outro corre atrás da carta.
//
// Lógica pura (testada em coop/__tests__/ladraRegra.test.js); o desenho só roda quando a arena dá `api.cena`.
// Rede (docs/coop-cartas.md "Regra do chefe (API)"): as cartas que fogem saem do estado (estado.chefe.roubadas,
// igual em todos os PCs) e andam por uma função do tempo da esquiva (planejarFuga/posicaoDaFuga, sorteio do
// api.rng); quem decide o toque é o PC dono do coração (a API repassa) e o que o toque faz (devolver a carta,
// a QUEBRA) sai do mesmo estado em todos os PCs.
import { recuperarRoubada } from './ladra.js'
import { corDaVaga } from '../../vagas.js'
import { FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'
import { alvoDoAlarme } from '../../attacks/ladraAlarme.js'

// Os números (docs/boss-semanal.md)
//   porFase      quantas roubadas (das mais antigas) fogem por esquiva, em cada fase
//   velocidade   px/s máximos da carta fugindo (o coração anda 180)
//   janela       ms que cada carta fica no quadro antes de voltar para a ladra
//   entrada      ms do começo da esquiva até a 1ª carta entrar · entre  ms entre uma carta e a próxima
//   quebra       pontos de QUEBRA por carta recuperada
export const PEGA = {
  porFase: [1, 2, 2],
  velocidade: [85, 100, 120],
  janela: [3800, 3600, 3300],
  entrada: 900,
  entre: 1500,
  quebra: 16,
  raio: 12,
  margem: 22,
}
const ENTRA_MS = 420 // a carta desce do alto até o começo do zigue-zague (e sai do mesmo jeito)

// As cartas que fogem nesta esquiva: [{ id, dono, carta, t0, cx, cy, ax, ay, wx, wy, fx, fy, janela }] (rng = api.rng)
export function planejarFuga({ rng, roubadas = [], fase = 0, limites, cfg = PEGA }) {
  const f = Math.min(fase, cfg.porFase.length - 1)
  const marcadas = roubadas.slice(0, cfg.porFase[f])
  const v = cfg.velocidade[f]
  const m = cfg.margem
  return marcadas.map((r, k) => {
    const ax = Math.max(20, limites.width / 2 - m - rng() * 30)
    const ay = Math.max(14, limites.height / 2 - m - rng() * 20)
    // a velocidade máxima do zigue-zague (Lissajous) é ~ hypot(ax wx, ay wy): fica em `v`
    const wx = (v * 0.8) / ax
    const wy = (v * 0.6) / ay
    return {
      id: r.carta.id,
      dono: r.dono,
      carta: r.carta,
      t0: cfg.entrada + k * cfg.entre,
      cx: limites.x + limites.width / 2,
      cy: limites.y + limites.height / 2,
      ax,
      ay,
      wx: wx * (rng() < 0.5 ? 1 : -1),
      wy,
      fx: rng() * Math.PI * 2,
      fy: -Math.PI / 2 + (rng() - 0.5) * 0.6, // começa perto do alto (onde ela entra)
      janela: cfg.janela[f],
    }
  })
}

// Onde a carta está `ms` depois do começo da esquiva: { x, y, visivel, fim }. Antes de entrar ela fica escondida
// bem acima da caixa (nenhum coração chega lá); entra descendo, zanza e no fim da janela sobe e some
const zigue = (fu, t) => ({ x: fu.cx + fu.ax * Math.sin(fu.wx * t + fu.fx), y: fu.cy + fu.ay * Math.sin(fu.wy * t + fu.fy) })
export function posicaoDaFuga(fu, ms, limites) {
  const fora = { x: fu.cx, y: limites.y - 300, visivel: false }
  const idade = ms - fu.t0
  if (idade < 0) return { ...fora, fim: false }
  if (idade > fu.janela + ENTRA_MS) return { ...fora, fim: true }
  const topo = limites.y - 14
  if (idade < ENTRA_MS) {
    const p = zigue(fu, 0)
    const s = idade / ENTRA_MS
    return { x: p.x, y: topo + (p.y - topo) * s, visivel: true, fim: false }
  }
  const p = zigue(fu, (idade - ENTRA_MS) / 1000)
  if (idade > fu.janela) {
    const s = (idade - fu.janela) / ENTRA_MS
    return { x: p.x, y: p.y + (topo - 30 - p.y) * s, visivel: true, fim: false }
  }
  return { ...p, visivel: true, fim: false }
}

// o desenho da carta que foge (só no navegador): a carta de verdade (valor, naipe, a cor do dono) com o brilho
// laranja da ladra e um "PEGA!" pulsando
const NOME_VALOR = { 11: 'J', 12: 'Q', 13: 'K' }
const SIMBOLOS = { espadas: '♠', copas: '♥', ouros: '♦', paus: '♣' }
const COR_NAIPE = { espadas: '#1a1a2e', paus: '#1a1a2e', copas: '#c8283a', ouros: '#c8283a' }
function desenharCartaQueFoge(cena, caixa, fu) {
  const brilho = cena.add.graphics()
  brilho.fillStyle(0xff9a3d, 0.25).fillCircle(0, 0, 19)
  brilho.lineStyle(2, 0xffd060, 0.9).strokeCircle(0, 0, 17)
  const fundo = cena.add.rectangle(0, 0, 18, 25, 0xfbf6ea).setStrokeStyle(2, corDaVaga(fu.dono))
  const estilo = (tam, cor) => ({ fontFamily: FONTE, fontSize: `${tam}px`, color: cor })
  const valor = cena.add.text(0, -5, NOME_VALOR[fu.carta.valor] ?? String(fu.carta.valor), estilo(8, COR_NAIPE[fu.carta.naipe] ?? '#1a1a2e')).setOrigin(0.5)
  const naipe = cena.add.text(0, 6, SIMBOLOS[fu.carta.naipe] ?? '?', estilo(9, COR_NAIPE[fu.carta.naipe] ?? '#1a1a2e')).setOrigin(0.5)
  const pega = cena.add.text(0, -22, 'PEGA!', { ...estilo(8, '#ffd060'), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
  const c = cena.add.container(fu.cx, -300, [brilho, fundo, valor, naipe, pega]).setDepth(9.62)
  cena.tweens.add({ targets: brilho, scale: { from: 0.85, to: 1.15 }, duration: 380, yoyo: true, repeat: -1 })
  cena.tweens.add({ targets: [fundo, valor, naipe], angle: { from: -10, to: 10 }, duration: 260, yoyo: true, repeat: -1 })
  cena.tweens.add({ targets: pega, alpha: { from: 1, to: 0.35 }, duration: 300, yoyo: true, repeat: -1 })
  caixa?.recortar(c)
  return [c]
}

export function criarRegraLadra(opcoes = {}) {
  const cfg = { ...PEGA, ...opcoes }
  return {
    id: 'pegaLadra',
    nome: 'PEGA LADRA!',
    descricao: 'A carta marcada foge pelo quadro: encostem nela para devolver ao dono e encher a QUEBRA!',
    fases: opcoes.fases ?? {
      1: { descricao: 'Agora fogem DUAS cartas roubadas: dividam a caçada!' },
      2: { descricao: 'As cartas roubadas correm mais rápido: cerquem a fujona!' },
    },
    criar(api) {
      let fase = 0
      let decorrido = 0
      let vivas = [] // { fu, item }
      const caixa = () => api.cena?.quadro?.caixa

      const sumir = (item) => {
        // longe da tela antes de apagar (sem o brilho da ponte no lugar)
        for (const o of item.desenho ?? []) o.setPosition?.(-300, -300)
        api.removerItem(item)
      }

      const pegou = (j, item) => {
        const r = recuperarRoubada(api.chefe(), api.jogadores(), item.cartaId)
        if (!r) return
        api.adicionarQuebra(cfg.quebra, 'pegaLadra')
        api.banner(`RECUPERADA! P${r.dono + 1}`, '#ffd060')
        api.dica('pega', 'Carta recuperada: voltou para a mão do dono e encheu a QUEBRA!')
        api.cena?.registrar?.(`pega:${r.carta.id}`)
        if (api.cena) {
          particulas(api.cena, item.x, item.y, { cor: 0xffd060, quantidade: 16, velocidade: 140 })
          tocar(api.cena, 'confirmar')
        }
      }

      return {
        comecarEsquiva() {
          decorrido = 0
          vivas = []
          const roubadas = api.chefe()?.roubadas ?? []
          if (!roubadas.length) return
          const fugas = planejarFuga({ rng: api.rng('fuga'), roubadas, fase, limites: api.limites(), cfg })
          for (const fu of fugas) {
            const item = api.adicionarItem({ x: fu.cx, y: api.limites().y - 300, raio: cfg.raio, cor: 0xffd060, forma: 'circulo', aoPegar: pegou })
            item.cartaId = fu.id
            if (api.cena) {
              for (const o of item.desenho ?? []) {
                api.cena.tweens.killTweensOf(o)
                o.destroy()
              }
              item.desenho = desenharCartaQueFoge(api.cena, caixa(), fu)
            }
            vivas.push({ fu, item })
          }
          api.dica('foge', 'A carta MARCADA (a da prévia) foge pelo quadro: encostem nela para recuperar!')
        },

        atualizar(dt) {
          decorrido += dt
          const l = api.limites()
          for (const v of [...vivas]) {
            const p = posicaoDaFuga(v.fu, decorrido, l)
            if (p.fim) {
              vivas.splice(vivas.indexOf(v), 1)
              sumir(v.item)
              continue
            }
            v.item.x = p.x
            v.item.y = p.y
            for (const o of v.item.desenho ?? []) o.setPosition?.(p.x, p.y)
          }
          vivas = vivas.filter((v) => api.itens().includes(v.item))
        },

        terminarEsquiva() {
          for (const v of vivas) for (const o of v.item.desenho ?? []) o.setPosition?.(-300, -300)
          vivas = []
        },

        faseNova(f) {
          fase = f
        },

        // a CPU aliada corre atrás da carta que foge mais perto (já dentro do quadro); o vão do alarme vem antes
        alvoDoBot(j) {
          const c = api.coracoes().find((x) => x.j === j && x.ativo)
          if (!c) return null
          // o feixe do ALARME chegando vale mais que a carta: atravessar pelo vão
          const vao = alvoDoAlarme(api.cena, c)
          if (vao) return vao
          const l = api.limites()
          let melhor = null
          let d = Infinity
          for (const v of vivas) {
            if (!api.itens().includes(v.item)) continue
            const p = posicaoDaFuga(v.fu, decorrido, l)
            if (!p.visivel || p.y < l.y + 6) continue
            const dist = Math.hypot(p.x - c.x, p.y - c.y)
            if (dist < d) {
              d = dist
              melhor = { x: p.x, y: p.y }
            }
          }
          return melhor
        },

        // (testes e dev)
        estado: () => ({ fase, fugindo: vivas.map((v) => v.fu.id) }),
      }
    },
  }
}

export const REGRA_LADRA = criarRegraLadra()
