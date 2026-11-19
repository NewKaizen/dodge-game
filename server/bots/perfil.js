// O PERFIL de um bot novo do JOGAR RÁPIDO (docs/online.md "Bots do Jogar Rápido"): tudo o que um perfil
// de gente tem e que os outros veem (nome, avatar, cosméticos equipados, nível, XP, partidas e
// vitórias, quando a conta nasceu) e o que só o servidor sabe (a faixa e o q de jogo, os "mains", o
// quanto ele joga por dia). Lógica pura (rng: () => 0..1); quem grava é o banco (criar_bot, 0019).
//
//   gerarPerfilDeBot({ nome, rng })   -> { nome, faixa, q, nivel, xp, partidas, vitorias, favoritos, favorito,
//                                          diasDeConta, avatar: { tipo, id }, itens: [id], equipar: { tipo: id },
//                                          atividade }   (atividade: partidas por dia, a média)
//   distribuirNiveis(n, rng)          n níveis espalhados (muitos baixos, alguns altos)
import { xpTotalDoNivel, xpParaProximo, itensAte } from '../../src/lib/progresso.js'
import { ITENS_BAU } from '../../src/lib/cosmeticos.js'
import { AVATARES_JOGO } from '../../src/lib/contaRegras.js'
import { FAIXAS, ORDEM_FAIXAS, estimarJogador } from './habilidade.js'
import { IDS_PERSONAGENS } from './decisoes.js'

const escolher = (rng, lista) => lista[Math.floor(rng() * lista.length)]
const entre = (rng, a, b) => a + (b - a) * rng()
const normal = (rng) => Math.sqrt(-2 * Math.log(1 - rng() * 0.999999)) * Math.cos(2 * Math.PI * rng())
const PESO_RARIDADE = { comum: 6, raro: 3, epico: 1.2, lendario: 0.35 }

// muitos níveis baixos e médios, alguns altos (um servidor de verdade é assim)
export function nivelSorteado(rng) {
  const r = rng()
  if (r < 0.28) return 1 + Math.floor(rng() * 5) // 1–5
  if (r < 0.58) return 6 + Math.floor(rng() * 7) // 6–12
  if (r < 0.84) return 13 + Math.floor(rng() * 13) // 13–25
  return 26 + Math.floor(rng() * 20) // 26–45
}

export function distribuirNiveis(n, rng) {
  return Array.from({ length: n }, () => nivelSorteado(rng))
}

// a faixa: o nível diz um pouco (como no jogador), com bastante variação
export function faixaDoBot(nivel, rng) {
  const q = Math.max(0.03, Math.min(0.95, estimarJogador({ nivel }) + normal(rng) * 0.16))
  let melhor = ORDEM_FAIXAS[0]
  for (const f of ORDEM_FAIXAS) if (Math.abs(FAIXAS[f] - q) < Math.abs(FAIXAS[melhor] - q)) melhor = f
  return melhor
}

function sortearComPeso(rng, lista) {
  const total = lista.reduce((s, i) => s + (PESO_RARIDADE[i.raridade] ?? 1), 0)
  let r = rng() * total
  for (const i of lista) {
    r -= PESO_RARIDADE[i.raridade] ?? 1
    if (r <= 0) return i
  }
  return lista[lista.length - 1]
}

export function gerarPerfilDeBot({ nome, rng = Math.random, nivel = nivelSorteado(rng), faixa = faixaDoBot(nivel, rng) }) {
  const q = Math.round(Math.max(0.02, Math.min(0.98, FAIXAS[faixa] + entre(rng, -0.045, 0.045))) * 1000) / 1000
  const xp = xpTotalDoNivel(nivel) + Math.floor(rng() * xpParaProximo(nivel))
  // quase todo XP veio de partidas (40 a 60 cada), o resto da campanha, desafios e baús
  const partidas = Math.max(0, Math.round((xp * entre(rng, 0.7, 0.92)) / entre(rng, 46, 54)))
  const taxa = Math.max(0.2, Math.min(0.75, 0.32 + q * 0.32 + normal(rng) * 0.05))
  const vitorias = Math.round(partidas * taxa)
  const atividade = Math.round(entre(rng, 1.5, 12) * 10) / 10
  const diasDeConta = Math.max(2, Math.round(partidas / Math.max(1, atividade) + entre(rng, 0, 40)))
  const favoritos = [escolher(rng, IDS_PERSONAGENS)]
  if (rng() < 0.55) favoritos.push(escolher(rng, IDS_PERSONAGENS.filter((p) => p !== favoritos[0])))
  // os itens: a trilha toda até o nível (como o conceder_recompensa dá) e uns do baú, para quem já jogou
  const trilha = itensAte(nivel)
  const doBau = []
  const nBau = nivel < 4 ? 0 : Math.min(6, Math.floor(entre(rng, 0, 1 + nivel / 8)))
  for (let k = 0; k < nBau; k++) {
    const i = sortearComPeso(rng, ITENS_BAU)
    if (!doBau.includes(i)) doBau.push(i)
  }
  const tem = [...trilha, ...doBau]
  const equipar = {}
  for (const tipo of ['titulo', 'moldura', 'verso', 'som', 'efeito', 'lancamento', 'frente']) {
    const opcoes = tem.filter((i) => i.tipo === tipo)
    if (!opcoes.length || rng() > 0.6) continue
    // gente equipa o mais novo (ou o do baú, que é mais bonito) com mais frequência
    equipar[tipo] = (rng() < 0.6 ? opcoes[opcoes.length - 1] : escolher(rng, opcoes)).id
  }
  const avataresTrilha = trilha.filter((i) => i.tipo === 'avatar').map((i) => i.id.split('.')[1])
  const avatar = rng() < 0.3 ? { tipo: 'padrao', id: null } : { tipo: 'jogo', id: escolher(rng, [...AVATARES_JOGO, ...avataresTrilha]) }
  return { nome, faixa, q, nivel, xp, partidas, vitorias, favoritos, favorito: favoritos[0], diasDeConta, avatar, itens: tem.map((i) => i.id), equipar, atividade }
}
