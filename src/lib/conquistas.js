// CONQUISTAS e MAESTRIA (Fase 4B, docs/desafio-diario.md "Conquistas e maestria"). Lógica pura, igual
// no servidor e no navegador. Quem DESBLOQUEIA é o servidor (server/conquistas.js), só onde ele já sabe
// da partida (a concessão do XP em server/partidas.js, o fim da campanha e o fim do desafio diário); o
// banco guarda (0014_conquistas_maestria.sql) e nunca concede duas vezes.
//
//   CONQUISTAS                  [{ id, nome, descricao, oculta? }] (oculta: aparece "???" até ganhar)
//   conquistasDoEvento(ev, r)   os ids que o evento cumpre (ev: o que acabou de acontecer; r: o resumo
//                               da conta DEPOIS do evento, que o banco devolve)
//   pontosDeMaestria(resultado) vitória 3 · derrota/empate/participação 1 · o resto 0
//   nivelDaMaestria(pontos)     1..10 · progressoDaMaestria(pontos) { nivel, atual, proximo, fracao }
//   ITENS_MAESTRIA              os cosméticos de cada personagem (título no nível 5, moldura no 10)
//
// Maestria é SÓ cosmética (regra fixa da Fase 4): nunca muda nada na partida. O personagem da partida
// vem do relato do navegador (é só cosmético); o banco limita os pontos por personagem por dia.
import { PERSONAGENS } from '../game/data/personagens.js'

export const PERSONAGENS_MAESTRIA = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
// pontos acumulados para chegar em cada nível (o índice + 1 é o nível)
export const MAESTRIA_NIVEIS = [0, 10, 30, 60, 100, 150, 210, 280, 360, 450]
export const MAESTRIA_MAXIMA = MAESTRIA_NIVEIS.length
export const MAESTRIA_TETO_DIA = 30 // pontos por personagem por dia (fuso de São Paulo)
export const RESULTADOS_MAESTRIA = { vitoria: 3, derrota: 1, empate: 1, participacao: 1 }

export const pontosDeMaestria = (resultado) => RESULTADOS_MAESTRIA[resultado] ?? 0

export function nivelDaMaestria(pontos) {
  const p = Math.max(0, Math.floor(Number(pontos) || 0))
  let n = 1
  while (n < MAESTRIA_MAXIMA && p >= MAESTRIA_NIVEIS[n]) n++
  return n
}

export function progressoDaMaestria(pontos) {
  const p = Math.max(0, Math.floor(Number(pontos) || 0))
  const nivel = nivelDaMaestria(p)
  if (nivel >= MAESTRIA_MAXIMA) return { nivel, atual: p - MAESTRIA_NIVEIS[nivel - 1], proximo: null, fracao: 1 }
  const base = MAESTRIA_NIVEIS[nivel - 1]
  const proximo = MAESTRIA_NIVEIS[nivel] - base
  return { nivel, atual: p - base, proximo, fracao: (p - base) / proximo }
}

// os cosméticos da maestria (nivel_requerido 1000 no banco: a trilha de níveis nunca entrega)
const TITULOS = {
  kris: 'Silêncio que Corta',
  susie: 'Força Bruta, Coração Mole',
  ralsei: 'Príncipe Gentil',
  noelle: 'Neve que Não Derrete',
  berdly: 'Gênio Autoproclamado',
  dess: 'Riff Proibido',
  asriel: 'Estrela que Volta',
}
const corHex = (n) => `#${(n ?? 0xffffff).toString(16).padStart(6, '0')}`
export const NIVEL_TITULO_MAESTRIA = 5
export const NIVEL_MOLDURA_MAESTRIA = 10
export const ITENS_MAESTRIA = PERSONAGENS_MAESTRIA.flatMap((p) => [
  { id: `titulo.maestria_${p}`, tipo: 'titulo', nome: TITULOS[p], personagem: p, maestria: NIVEL_TITULO_MAESTRIA, descricao: `Maestria ${NIVEL_TITULO_MAESTRIA} com ${PERSONAGENS[p].nome}.` },
  { id: `moldura.maestria_${p}`, tipo: 'moldura', nome: `Aura de ${PERSONAGENS[p].nome}`, personagem: p, maestria: NIVEL_MOLDURA_MAESTRIA, cor: corHex(PERSONAGENS[p].cor), descricao: `Maestria ${NIVEL_MOLDURA_MAESTRIA} (a máxima) com ${PERSONAGENS[p].nome}.` },
])
const DA_MAESTRIA = new Map(ITENS_MAESTRIA.map((i) => [i.id, i]))
export const itemDaMaestria = (id) => DA_MAESTRIA.get(id) ?? null
export const itensDaMaestriaAte = (personagem, nivel) => ITENS_MAESTRIA.filter((i) => i.personagem === personagem && i.maestria <= nivel)

// ---------- conquistas ----------

export const CONQUISTAS = [
  { id: 'primeira_vitoria', nome: 'Primeira de Muitas', descricao: 'Vença uma partida (qualquer modo).' },
  { id: 'intocavel', nome: 'Intocável', descricao: 'Vença a campanha ou o desafio diário sem levar nenhum acerto.' },
  { id: 'casa_silenciosa', nome: 'A Luz Voltou', descricao: 'Termine A Casa Silenciosa (vença a última porta).' },
  { id: 'tres_estrelas', nome: 'Três Luzinhas', descricao: 'Tire 3 estrelas numa porta da campanha.' },
  { id: 'elenco_completo', nome: 'Elenco Completo', descricao: 'Jogue com todos os 7 personagens.' },
  { id: 'dupla_afinada', nome: 'Dupla Afinada', descricao: 'Vença uma partida 2x2.' },
  { id: 'ultimo_de_pe', nome: 'Último de Pé', descricao: 'Vença um todos contra todos.' },
  { id: 'mesa_cheia', nome: 'Mesa Cheia', descricao: 'Vença o CO-OP com 3 ou 4 pessoas.' },
  { id: 'cacador_semanal', nome: 'Caçador da Semana', descricao: 'Vença o boss semanal e leve o troféu.' },
  { id: 'bom_dia', nome: 'Bom Dia, Desafio', descricao: 'Vença um desafio diário.' },
  { id: 'sete_sois', nome: 'Sete Sóis', descricao: 'Vença o desafio diário em 7 dias (não precisa ser seguido).' },
  { id: 'constancia', nome: 'Constância', descricao: 'Ganhe o cosmético da semana do desafio diário.' },
  { id: 'mao_firme', nome: 'Mão Firme', descricao: 'Some 10 vitórias.' },
  { id: 'lenda_da_mesa', nome: 'Lenda da Mesa', descricao: 'Some 50 vitórias.' },
  { id: 'cadeira_cativa', nome: 'Cadeira Cativa', descricao: 'Jogue 100 partidas.' },
  { id: 'alma_gemea', nome: 'Alma Gêmea', descricao: `Chegue à maestria ${NIVEL_TITULO_MAESTRIA} com um personagem.` },
  { id: 'por_um_fio', nome: 'Por um Fio', descricao: 'Vença a campanha ou o desafio com 10% do HP ou menos.', oculta: true },
  { id: 'coruja', nome: 'Coruja', descricao: 'Vença o desafio diário entre meia-noite e 5h.', oculta: true },
]
export const IDS_CONQUISTAS = CONQUISTAS.map((c) => c.id)
const POR_ID = new Map(CONQUISTAS.map((c) => [c.id, c]))
export const conquistaDe = (id) => POR_ID.get(id) ?? null

// ev: { tipo: 'partida' | 'campanha' | 'desafio', modo?, resultado, personagem?, acertos?, hpFracao?,
//       mundo?, fase?, ultimaFase?, estrelas?, trofeuSemanal?, cosmeticoSemana?, hora? }
// r:  { partidas, vitorias, maestria: { personagem: pontos }, desafios }
export function conquistasDoEvento(ev = {}, r = {}) {
  const ids = []
  const venceu = ev.resultado === 'vitoria'
  const servidorViu = ev.tipo === 'campanha' || ev.tipo === 'desafio' // o dano é do servidor
  if (venceu) ids.push('primeira_vitoria')
  if (venceu && servidorViu && ev.acertos === 0) ids.push('intocavel')
  if (venceu && servidorViu && Number.isFinite(ev.hpFracao) && ev.hpFracao > 0 && ev.hpFracao <= 0.1) ids.push('por_um_fio')
  if (venceu && ev.tipo === 'campanha' && ev.mundo === 1 && ev.ultimaFase) ids.push('casa_silenciosa')
  if (venceu && ev.tipo === 'campanha' && ev.estrelas === 3) ids.push('tres_estrelas')
  if (venceu && ev.tipo === 'partida' && ev.modo === '2x2') ids.push('dupla_afinada')
  if (venceu && ev.tipo === 'partida' && ev.modo === 'ffa') ids.push('ultimo_de_pe')
  if (venceu && ev.tipo === 'partida' && ev.modo === 'coop4') ids.push('mesa_cheia')
  if (ev.trofeuSemanal) ids.push('cacador_semanal')
  if (venceu && ev.tipo === 'desafio') ids.push('bom_dia')
  if (venceu && ev.tipo === 'desafio' && Number.isInteger(ev.hora) && ev.hora >= 0 && ev.hora < 5) ids.push('coruja')
  if (ev.cosmeticoSemana) ids.push('constancia')
  if ((r.desafios ?? 0) >= 7) ids.push('sete_sois')
  if ((r.vitorias ?? 0) >= 10) ids.push('mao_firme')
  if ((r.vitorias ?? 0) >= 50) ids.push('lenda_da_mesa')
  if ((r.partidas ?? 0) >= 100) ids.push('cadeira_cativa')
  const m = r.maestria ?? {}
  if (PERSONAGENS_MAESTRIA.every((p) => (m[p] ?? 0) > 0)) ids.push('elenco_completo')
  if (Object.values(m).some((p) => nivelDaMaestria(p) >= NIVEL_TITULO_MAESTRIA)) ids.push('alma_gemea')
  return ids.filter((id) => POR_ID.has(id))
}
