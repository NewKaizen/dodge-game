// CO-OP 2.0 (docs/coop-cartas.md, seção "CO-OP 2.0"): o que faz a dupla (ou o grupo) jogar JUNTO, com
// regras curtas. Lógica pura (sem Phaser), testada em coop/__tests__/coop2.test.js. Quem chama:
// coop/regras.js (resolução, golpes, começo e fim da rodada) e as arenas (CoopArena e CoopArenaN).
//
//   QUEBRA (stagger)     a barra embaixo do HP do chefe. Enche com trabalho em equipe:
//                          - os dois (2+ no grupo) acertam o chefe na mesma rodada  QUEBRA.juntos
//                          - cada CRÍTICO (desvio perfeito)                          QUEBRA.critico
//                          - cada carta de dupla da rodada                           DUPLAS[id].quebra
//                          - cada resgate na hora (coop/resgate.js)                  QUEBRA.resgate
//                          - a regra do chefe (api.adicionarQuebra, coop/regraChefe.js)
//                        Cheia (maxQuebra(n)): o chefe fica ATORDOADO na PRÓXIMA rodada: não ataca (sem
//                        quadro), os golpes comuns batem x QUEBRA.danoAtordoado e a rodada fecha com a
//                        FINALIZAÇÃO EM DUPLA (QUEBRA.finalizacao do HP máx, todos de pé batem juntos).
//                        Depois a barra volta a zero
//   CARTAS DE DUPLA      combinações de naipe de dois jogadores na mesma rodada (no grupo: qualquer par):
//                          ♠ + ♣  ATAQUE EM PINÇA   os golpes de ♠ e ♣ batem x1,3 e muita quebra
//                          ♥ + ♦  BARREIRA DUPLA    escudo de 50% em todos de pé nesta esquiva
//                          mesmo naipe  COMBO x1,25 · mesmo valor  PAR x1,5 (como sempre; agora enchem a quebra)
//   PRÉVIA DA INTENÇÃO   a carta do chefe da PRÓXIMA rodada (previaDoChefe): o time planeja duas rodadas
//
//   somarQuebra(estado, pontos)                       -> { ganho, quebrou }
//   duplasDaResolucao(cartas, aptos)                  BARREIRA (na resolução: o escudo vale na esquiva)
//   duplasDoContra(golpes, caidos)                    PINÇA, COMBO e PAR (no contra-ataque)
//   ganhosDeQuebra(lista, duplas)                     [{ motivo, pontos }] da rodada
//   finalizacaoDaDupla(estado)                        null ou { dano, jogadores } (rodada ATORDOADO)
//   previaDoChefe(estado)                             { tipo: 'carta' | 'super' | 'atordoado' | 'roubada', carta?, dono? }
//                                                     (a regra do chefe ainda pode trocar: regraChefe.js `previa`)
//   dicaDeDupla(carta)                                a linha "DUPLA: ..." da carta (o Guia)
import { especialDaCarta, ehSuper } from '../pvp/cartas.js'

// Números (scripts/balanceamento/simularCoop.mjs mede o efeito na duração das lutas)
//   max               a barra cheia com 2 jogadores; cada jogador a mais soma porJogadorExtra ao máximo
//                     (mais gente = mais CRÍTICOS por rodada)
//   juntos            dois ou mais acertam o chefe na mesma rodada
//   critico           cada golpe com CRÍTICO (passou pela esquiva sem levar dano)
//   resgate           cada parceiro levantado na hora (encostando na alma)
//   danoAtordoado     multiplica os golpes comuns na rodada do chefe atordoado (o SUPER não: ele já tem teto)
//   finalizacao       a FINALIZAÇÃO EM DUPLA: esta fração do HP máximo do chefe, no fim da rodada atordoado
export const QUEBRA = {
  max: 100,
  porJogadorExtra: 0.25,
  juntos: 20,
  critico: 12,
  resgate: 25,
  danoAtordoado: 1.5,
  finalizacao: 0.1,
}

export const maxQuebra = (n = 2) => Math.round(QUEBRA.max * (1 + QUEBRA.porJogadorExtra * Math.max(0, n - 2)))

// As cartas de dupla (o Guia lista estas, na ordem). `naipes`: um jogador com cada (cartas comuns, 2 a K).
// COMBO e PAR são os de sempre (coop/regras.js combosDosGolpes): aqui só ganham a quebra e o nome na lista
export const DUPLAS = {
  pinca: { id: 'pinca', nome: 'ATAQUE EM PINÇA', simbolos: '♠ + ♣', curto: 'os golpes batem x1,3 e enchem a QUEBRA', naipes: ['espadas', 'paus'], fator: 1.3, quebra: 30 },
  barreira: { id: 'barreira', nome: 'BARREIRA DUPLA', simbolos: '♥ + ♦', curto: 'escudo de 50% em todos nesta esquiva', naipes: ['copas', 'ouros'], escudo: 0.5, quebra: 10 },
  combo: { id: 'combo', nome: 'COMBO', simbolos: 'mesmo naipe', curto: 'os golpes batem x1,25', quebra: 15 },
  par: { id: 'par', nome: 'PAR', simbolos: 'mesmo valor', curto: 'os golpes batem x1,5', quebra: 20 },
}
export const ORDEM_DUPLAS = ['pinca', 'barreira', 'combo', 'par']

// A linha da carta de dupla de uma carta do jogador (o Guia mostra no "NO CO-OP"); '' se ela não entra em nenhuma
export function dicaDeDupla(carta) {
  if (!comum(carta)) return ''
  const outro = { espadas: '♣', paus: '♠', copas: '♦', ouros: '♥' }[carta.naipe]
  const d = carta.naipe === 'espadas' || carta.naipe === 'paus' ? DUPLAS.pinca : DUPLAS.barreira
  return `DUPLA: com ${outro} de um parceiro na mesma rodada, ${d.nome} (${d.curto}).`
}

// "DUPLAS: ♠ + ♣ PINÇA · ♥ + ♦ BARREIRA · mesmo naipe COMBO · mesmo valor PAR" (o Guia, a página do chefe)
export const listaDeDuplas = () => `DUPLAS: ${ORDEM_DUPLAS.map((id) => `${DUPLAS[id].simbolos} ${DUPLAS[id].nome.replace('ATAQUE EM ', '').replace(' DUPLA', '')}`).join(' · ')}`

// carta comum (2 a K, sem Ás especial nem SUPER): a que entra numa carta de dupla
const comum = (carta) => Boolean(carta) && !ehSuper(carta) && !especialDaCarta(carta) && carta.valor >= 2 && carta.valor <= 13

// Os jogadores de cada naipe da dupla (dois jogadores diferentes, um em cada naipe). null = não fechou
function parDeNaipes(cartas, aptos, [a, b]) {
  const de = (naipe) => cartas.map((c, j) => (aptos[j] && comum(c) && c.naipe === naipe ? j : -1)).filter((j) => j >= 0)
  const comA = de(a)
  const comB = de(b)
  if (!comA.length || !comB.length) return null
  // (um jogador só joga uma carta: os dois lados são sempre de jogadores diferentes)
  return [...comA, ...comB].sort((x, y) => x - y)
}

// BARREIRA DUPLA (na resolução, antes do quadro): cartas[j] = a carta revelada de j (ou null);
// aptos[j] = j joga nesta rodada (de pé). Devolve [{ id, jogadores }]
export function duplasDaResolucao(cartas, aptos) {
  const jogadores = parDeNaipes(cartas, aptos, DUPLAS.barreira.naipes)
  return jogadores ? [{ id: 'barreira', jogadores }] : []
}

// PINÇA, COMBO e PAR (no contra-ataque): golpes[j] = r.golpes[j] ({ carta, tipo, base } ou null);
// caidos[j]: o golpe de j não conta. Devolve [{ id, jogadores }] (COMBO/PAR: uma entrada por grupo)
export function duplasDoContra(golpes, caidos = []) {
  const vale = golpes.map((g, j) => Boolean(g && !caidos[j] && ['espadas', 'ouros', 'paus'].includes(g.tipo)))
  const cartas = golpes.map((g) => g?.carta ?? null)
  const lista = []
  const pinca = parDeNaipes(cartas, vale, DUPLAS.pinca.naipes)
  if (pinca) lista.push({ id: 'pinca', jogadores: pinca })
  const grupos = (chave) => {
    const mapa = new Map()
    cartas.forEach((c, j) => vale[j] && comum(c) && mapa.set(c[chave], [...(mapa.get(c[chave]) ?? []), j]))
    return [...mapa.values()].filter((js) => js.length >= 2)
  }
  const pares = grupos('valor')
  for (const js of pares) lista.push({ id: 'par', jogadores: js })
  // COMBO de naipe só para quem não fechou PAR (igual a combosDosGolpes: o PAR vem antes)
  const emPar = new Set(pares.flat())
  for (const js of grupos('naipe')) {
    const resto = js.filter((j) => !emPar.has(j))
    if (resto.length >= 2) lista.push({ id: 'combo', jogadores: resto })
  }
  return lista
}

// O que a rodada põe na barra: lista = calcularGolpes (coop/regras.js); duplas = as da rodada
// (resolução + contra). [{ motivo, pontos }]
export function ganhosDeQuebra(lista, duplas = []) {
  const ganhos = []
  const acertaram = new Set(lista.filter((g) => !g.falhou && g.dano > 0).map((g) => g.j))
  if (acertaram.size >= 2) ganhos.push({ motivo: 'juntos', pontos: QUEBRA.juntos })
  const criticos = lista.filter((g) => !g.falhou && g.multiplicadores?.some(([nome]) => nome === 'CRÍTICO')).length
  if (criticos) ganhos.push({ motivo: 'critico', pontos: QUEBRA.critico * criticos })
  for (const d of duplas) if (DUPLAS[d.id]?.quebra) ganhos.push({ motivo: d.id, pontos: DUPLAS[d.id].quebra })
  return ganhos
}

// Soma na barra do chefe. Com o chefe atordoado (ou caído) não soma: a barra está cheia e volta a zero no
// fim da rodada atordoado. Cheia: o chefe fica atordoado na próxima rodada
export function somarQuebra(estado, pontos) {
  const c = estado.chefe
  c.quebra ??= 0
  if (estado.coop2 === false || c.atordoado || c.hp <= 0 || !(pontos > 0)) return { ganho: 0, quebrou: false }
  const max = maxQuebra(estado.n)
  const antes = c.quebra
  c.quebra = Math.min(max, c.quebra + Math.round(pontos * (estado.mods?.quebra ?? 1))) // (relíquias: coop/reliquias.js)
  const quebrou = c.quebra >= max
  if (quebrou) {
    c.atordoado = true
    c.atordoadoEm = null // a rodada em que ele fica parado (iniciarRodadaCoop marca)
  }
  return { ganho: c.quebra - antes, quebrou }
}

// o chefe está parado NESTA rodada (a rodada ATORDOADO)?
export const atordoadoAgora = (estado) => Boolean(estado.chefe.atordoado && estado.chefe.atordoadoEm === estado.rodada)

// A FINALIZAÇÃO EM DUPLA, no fim da rodada ATORDOADO: todos de pé batem juntos. null fora dela
export function finalizacaoDaDupla(estado) {
  if (!atordoadoAgora(estado) || estado.chefe.hp <= 0) return null
  const jogadores = estado.jogadores.map((jog, j) => (!jog.caido && !jog.ausente && !jog.saiu ? j : -1)).filter((j) => j >= 0)
  if (!jogadores.length) return null
  return { dano: Math.max(1, Math.round(estado.chefe.hpMax * QUEBRA.finalizacao * (estado.mods?.finalizacao ?? 1))), jogadores }
}

// A carta do chefe da PRÓXIMA rodada, para a prévia (a intenção 2 rodadas à frente):
//   'atordoado'  a barra encheu: na próxima ele não ataca
//   'super'      a carga do SUPER enche na próxima
//   'roubada'    a Ladra joga a roubada mais antiga ({ carta, dono }: a carta MARCADA, que foge na esquiva e que
//                o time ainda pode recuperar; coop/semanal/ladraRegra.js)
//   'carta'      a próxima do monte (estado.chefe.proxima, já tirada do monte: a promessa vale)
// null = sem prévia (sem carta, a luta acabou)
export function previaDoChefe(estado, { ladraJoga = null } = {}) {
  const c = estado.chefe
  if (!c || c.hp <= 0 || estado.vencedor) return null
  if (c.atordoado && !atordoadoAgora(estado)) return { tipo: 'atordoado' }
  // (na rodada atordoado a carga não sobe: a próxima sobe 1, como sempre)
  if (c.carga + 1 >= c.cargaMax) return { tipo: 'super' }
  if (c.roubadas?.length && ladraJoga?.(estado.rodada + 1)) return { tipo: 'roubada', carta: c.roubadas[0].carta, dono: c.roubadas[0].dono }
  return c.proxima ? { tipo: 'carta', carta: c.proxima } : null
}
