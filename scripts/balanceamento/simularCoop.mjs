// Simula partidas inteiras do CO-OP de cartas (regras de verdade, CPU aliada
// jogando as cartas dos dois lados) usando os acertos MEDIDOS de cada carta
// do chefe (medirChefes.mjs, modo quadro): a cada rodada, cada coração que
// está no quadro sorteia uma das amostras daquela carta, naquele nível, para
// aquele tipo de jogador (os dois desviam do mesmo ataque).
//
//   node scripts/balanceamento/simularCoop.mjs chefes.json [partidas] [jogadores]
//     jogadores: 'dificil' (os dois jogam como o bot perfeito), 'normal'
//     (os dois como o bot médio) ou 'misto' (um de cada). Padrão: os três.
//   HP=king=330,queen=330 no ambiente: simula com outro HP de base dos chefes (para ajustar)
//   DANO=king=1.2 no ambiente: multiplica o danoBala do chefe (para ajustar o dano por acerto)
//
// Saída: por chefe e nível, % de vitória, rodadas e minutos (médias; coop/duracao.js estima os minutos
// pelas rodadas, com as rodadas sem esquiva e as finalizações).
//
// EXPEDICAO=1 no ambiente: em vez das lutas soltas, simula a EXPEDIÇÃO inteira de cada chefão (lacaios -> tenente
// -> chefão, coop/expedicao.js): o HP passa de uma luta para a outra, o time cura CURA_ENTRE, a CPU vota a relíquia
// e cada luta tem o aperto da etapa (ETAPA_EXPEDICAO). Mostra a % de cada luta vencida e da expedição completa.
//
// CO-OP 2.0: o contra-ataque é o resolverContraCoop (QUEBRA, cartas de dupla, ATORDOADO e a FINALIZAÇÃO
// EM DUPLA) e quem cai na esquiva pode ser RESGATADO NA HORA pelo parceiro que ficou de pé (chance por tipo
// de jogador, RESGATE_P: nem sempre dá tempo de chegar na alma).

import fs from 'node:fs'
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, aplicarDanoCoop, resolverContraCoop, aplicarGolpe, fimDaRodadaCoop, registrarPerfeitoCombo, resgatarNaHora } from '../../src/game/coop/regras.js'
import { estimarDuracaoLuta, minutos } from '../../src/game/coop/duracao.js'
import { escolherJogadaCoop } from '../../src/game/coop/bot.js'
import { CHEFES } from '../../src/game/coop/chefes/index.js'
import { criarRng, aleatorio } from '../../src/game/pvp/baralho.js'
import { LUTAS, ETAPAS, criarExpedicao, terminarLuta, votoDaCpu, escolherReliquia, dadosDaLuta } from '../../src/game/coop/expedicao.js'

const [arquivo = 'chefes.json', nPartidas = '300', tipos = 'dificil,misto,normal'] = process.argv.slice(2)
// HP=king=330,queen=330 (opcional): testa outro HP de base (FÁCIL) dos chefes sem mexer nos arquivos
for (const par of (process.env.HP ?? '').split(',').filter(Boolean)) {
  const [id, hp] = par.split('=')
  if (CHEFES[id]) CHEFES[id].hp = Number(hp)
}
// DANO=coronel=1.3,king=1.2 (opcional): multiplica o danoBala do chefe (testa mais dano por acerto sem mexer nos arquivos)
for (const par of (process.env.DANO ?? '').split(',').filter(Boolean)) {
  const [id, f] = par.split('=')
  if (CHEFES[id]) CHEFES[id].danoBala *= Number(f)
}
const medida = JSON.parse(fs.readFileSync(arquivo, 'utf8')).resultado
const amostras = Object.fromEntries(medida.map((l) => [l.id, l]))
const PERSONAGENS = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
const GRAZES = { dificil: 3, normal: 2 }
const RESGATE_P = { dificil: 0.75, normal: 0.5 } // o parceiro de pé chega na alma e fica 1 s

function simular(chefe, nivel, jogadores, i, { hp = null, reliquias = [], etapa = null, tag = '' } = {}) {
  const rng = criarRng(`sim:${chefe}:${nivel}:${jogadores}:${i}${tag}`)
  const sorteio = () => aleatorio(rng)
  const party = [PERSONAGENS[i % 7], PERSONAGENS[(i * 3 + 1) % 7]]
  const bots = jogadores === 'misto' ? ['dificil', 'normal'] : [jogadores, jogadores]
  const e = criarPartidaCoop({ party, chefe, nivel, semente: `sim${i}${tag}`, hp, reliquias, etapa })
  let fim = null
  let r = 0
  const conta = { semQuadro: 0, finalizacoes: 0, fases: 0, resgates: 0 }
  for (; r < 60 && !fim; r++) {
    iniciarRodadaCoop(e)
    const res = resolverRodadaCoop(e, ...[0, 1].map((j) => escolherJogadaCoop(e, j, { rng })))
    const q = res.quadro
    if (!q) conta.semQuadro++
    const caiuAgora = [false, false]
    const desempenho = [0, 1].map((j) => {
      if (!q?.jogadores[j]) return { perfeito: false, grazes: 0 }
      const lista = amostras[q.carta.id]?.[nivel]?.[bots[j]]?.acertos ?? [1]
      const k = lista[Math.floor(sorteio() * lista.length)]
      for (let h = 0; h < k; h++) aplicarDanoCoop(e, j, q.danos[j])
      caiuAgora[j] = e.jogadores[j].caido
      const perfeito = k === 0 && !e.jogadores[j].caido
      if (perfeito) registrarPerfeitoCombo(e, j, q.carta)
      return { perfeito, grazes: GRAZES[bots[j]] }
    })
    // RESGATE NA HORA: o parceiro que ficou de pé no quadro levanta quem caiu (às vezes)
    for (const j of [0, 1]) {
      const p = 1 - j
      if (caiuAgora[j] && q?.jogadores[p] && !e.jogadores[p].caido && sorteio() < RESGATE_P[bots[p]] && resgatarNaHora(e, j, p).ok) conta.resgates++
    }
    const contra = resolverContraCoop(e, res.golpes, desempenho)
    contra.golpes.forEach((g) => aplicarGolpe(e, g.dano))
    if (contra.finalizacao && e.chefe.hp > 0) {
      aplicarGolpe(e, contra.finalizacao.dano)
      conta.finalizacoes++
    }
    const f = fimDaRodadaCoop(e)
    if (f.novaFase != null) conta.fases++
    fim = f.vencedor
  }
  const segundos = estimarDuracaoLuta({ rodadas: r, ...conta })
  return { vitoria: fim === 'vitoria', rodadas: r, segundos, ...conta, hp: e.jogadores.map((j) => (j.caido ? 0 : j.hp)), hpMax: e.jogadores.map((j) => j.hpMax), hpParty: e.jogadores.reduce((t, j) => t + j.hp, 0) / e.jogadores.reduce((t, j) => t + j.hpMax, 0) }
}

// a EXPEDIÇÃO inteira de um chefão: quantas lutas o time venceu (0 a 3)
function simularExpedicao(chefao, nivel, jogadores, i) {
  let exp = criarExpedicao({ chefe: chefao, nivel, party: ['kris', 'susie'], semente: `simexp${i}` })
  for (let no = 0; no < ETAPAS.length; no++) {
    const d = dadosDaLuta(exp)
    if (!amostras[`${d.chefe}-f0-0`]) return { lutas: no, faltou: d.chefe }
    const r = simular(d.chefe, nivel, jogadores, i, { hp: d.hp, reliquias: d.reliquias, etapa: ETAPAS[no], tag: `:exp${no}` })
    if (!r.vitoria) return { lutas: no }
    exp = terminarLuta(exp, { vitoria: true, hp: r.hp, hpMax: r.hpMax, rodadas: r.rodadas })
    if (exp.fase === 'escolha') exp = escolherReliquia(exp, exp.oferta[votoDaCpu(exp.oferta, { hp: exp.hp, hpMax: exp.hpMax })])
  }
  return { lutas: ETAPAS.length }
}

const chefes = [...new Set(medida.map((l) => l.chefe))]
const niveis = ['facil', 'medio', 'dificil'].filter((n) => medida[0][n])
const N = Number(nPartidas)
if (process.env.EXPEDICAO) {
  for (const jogadores of tipos.split(',')) {
    console.log(`\n=== EXPEDIÇÃO, jogadores: ${jogadores} (${N} expedições por linha): % que venceu a 1ª, a 2ª e a 3ª luta`)
    console.log('chefão    ' + niveis.map((n) => n.padEnd(30)).join(''))
    for (const chefao of Object.keys(LUTAS).filter((c) => chefes.includes(c))) {
      const colunas = niveis.map((nivel) => {
        const rs = Array.from({ length: N }, (_, i) => simularExpedicao(chefao, nivel, jogadores, i))
        const pct = (k) => String(Math.round((100 * rs.filter((x) => x.lutas >= k).length) / N)).padStart(3) + '%'
        return `${pct(1)} ${pct(2)} ${pct(3)}`.padEnd(30)
      })
      console.log(chefao.padEnd(10) + colunas.join(''))
    }
  }
  process.exit(0)
}
for (const jogadores of tipos.split(',')) {
  console.log(`\n=== jogadores: ${jogadores} (${N} partidas por linha)`)
  console.log('chefe     ' + niveis.map((n) => n.padEnd(40)).join(''))
  for (const chefe of chefes) {
    const colunas = niveis.map((nivel) => {
      const rs = Array.from({ length: N }, (_, i) => simular(chefe, nivel, jogadores, i))
      const vit = rs.filter((x) => x.vitoria)
      const pct = Math.round((100 * vit.length) / N)
      const media = (campo) => rs.reduce((t, x) => t + x[campo], 0) / N
      const rod = media('rodadas').toFixed(1)
      const min = minutos(media('segundos')).toFixed(1)
      const hp = vit.length ? Math.round((100 * vit.reduce((t, x) => t + x.hpParty, 0)) / vit.length) : 0
      return `${String(pct).padStart(3)}% ${rod.padStart(4)} rod ${min}min hp${String(hp).padStart(3)}% Q${media('finalizacoes').toFixed(1)}`.padEnd(40)
    })
    console.log(chefe.padEnd(10) + colunas.join(''))
  }
}
