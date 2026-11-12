// COSMÉTICOS DOS SLOTS NOVOS e o BAÚ (docs/baus.md, docs/cosmeticos-ids.md). Puro: sem Phaser, lido
// pelo servidor (server/baus.js, server/supabase/fake.js) e pelo navegador (Coleção, arenas).
//
// Cosméticos NUNCA mudam nada no jogo (regra fixa da Fase 4): só som, desenho e animação.
//
// Slots novos (o 4º, a moldura animada, usa o slot de moldura que já existia):
//   som         o som que toca quando VOCÊ leva um acerto       perfis.som_equipado
//   efeito      um efeito em volta das SUAS cartas              perfis.efeito_equipado
//   lancamento  a animação quando você JOGA uma carta           perfis.lancamento_equipado
//   moldura     moldura animada em volta do avatar              perfis.moldura_equipada (o slot de sempre)
//
// Dois nomes por item:
//   id        o do banco, '<tipo>.<slug>' (catalogo_itens; o formato de sempre): 'som.latido'
//   registro  o do conteúdo (src/game/cosmeticos/registro.js): 'dano-latido'
// A conversão é fixa (registroDoId / idDoRegistro): som.<x> <-> dano-<x>, efeito.<x> <-> efeito-<x>,
// lancamento.<x> <-> lancamento-<x>, moldura.anim_<x> <-> moldura-anim-<x> ('_' no banco = '-' no registro).
//
// O BAÚ: só se ganha jogando (nunca se compra; não existe compra nenhuma). O servidor sorteia com
// crypto.randomInt (server/baus.js) os SORTEIO_TAMANHO números de 0 a ESCALA-1 e o BANCO aplica as regras
// (abrir_bau, 0015_baus_cosmeticos.sql) com a pena (pity) e o inventário travados na mesma transação.
// rolarBau() aqui é o ESPELHO em JS das mesmas regras (o fake.js usa; o teste confere com o SQL).

export const RARIDADES = ['comum', 'raro', 'epico', 'lendario']
export const NOME_RARIDADE = { comum: 'COMUM', raro: 'RARO', epico: 'ÉPICO', lendario: 'LENDÁRIO' }
export const COR_RARIDADE = { comum: '#c8d0e0', raro: '#4aa8ff', epico: '#c070ff', lendario: '#ffb020' }
export const COR_RARIDADE_NUM = { comum: 0xc8d0e0, raro: 0x4aa8ff, epico: 0xc070ff, lendario: 0xffb020 }
export const nivelDaRaridade = (r) => RARIDADES.indexOf(r)

// ---------- as regras do baú (espelho das funções de constante da 0015) ----------

export const ESCALA = 1_000_000 // cada número sorteado vai de 0 a ESCALA - 1
// chance de cada raridade, em milionésimos (soma = ESCALA): 60% · 28% · 10% · 2%
export const PESOS = { comum: 600_000, raro: 280_000, epico: 100_000, lendario: 20_000 }
// quantas recompensas: 1 (50%), 2 (35%), 3 (15%)
export const QUANTIDADE = [
  { n: 1, ate: 500_000 },
  { n: 2, ate: 850_000 },
  { n: 3, ate: ESCALA },
]
export const PITY = 10 // a cada 10 baús sem nada épico ou melhor, o 10º garante um épico (ou melhor)
export const CHANCE_XP_EXTRA = 350_000 // a 2ª e a 3ª recompensa: 35% de ser XP em vez de cosmético
export const XP_BONUS = { comum: 25, raro: 50, epico: 100, lendario: 200 }
export const XP_DUPLICADO = { comum: 15, raro: 30, epico: 60, lendario: 120 } // "já tinha: +N XP"
export const BAU_XP_TETO_DIA = 500 // XP somado dos baús abertos no mesmo dia (São Paulo); passou, 0
export const SORTEIO_TAMANHO = 10 // [quantidade, (raridade, tipo, índice) × 3]
export const MAX_RECOMPENSAS = 3

// as chances publicadas (a tela do baú e docs/baus.md mostram estas)
export const CHANCES = RARIDADES.map((r) => ({ raridade: r, nome: NOME_RARIDADE[r], pct: PESOS[r] / (ESCALA / 100) }))
export const TEXTO_CHANCES = `${CHANCES.map((c) => `${c.nome} ${c.pct}%`).join(' · ')} · épico garantido a cada ${PITY} baús`

// ---------- de onde vêm os baús (o banco confere cada fonte; a chave é a trava) ----------

export const FONTES_BAU = {
  nivel: { nome: 'subiu de nível', chave: (ref) => `nivel:${ref}` },
  dia: { nome: 'baú do dia (1ª partida do dia)', chave: (ref) => `dia:${ref}` },
  desafio: { nome: 'venceu o desafio diário', chave: (ref) => `desafio:${ref}` },
  semanal: { nome: 'venceu o boss semanal', chave: (ref) => `semanal:${ref}` },
  conquista: { nome: 'conquista', chave: (ref) => `conquista:${ref}` },
}
// as conquistas que dão um baú (uma vez cada; espelho de bau_conquistas() da 0015)
export const CONQUISTAS_COM_BAU = ['primeira_vitoria', 'casa_silenciosa', 'cacador_semanal', 'sete_sois', 'mao_firme', 'lenda_da_mesa', 'cadeira_cativa', 'alma_gemea']
export const nomeDaFonte = (fonte) => FONTES_BAU[fonte]?.nome ?? 'baú'

// ---------- o catálogo dos slots novos ----------

export const SLOTS = ['som', 'efeito', 'lancamento', 'moldura']
export const TIPOS_SLOT = ['som', 'efeito', 'lancamento'] // os tipos NOVOS do catálogo (a moldura já existia)
export const COLUNA_DO_SLOT = { som: 'som_equipado', efeito: 'efeito_equipado', lancamento: 'lancamento_equipado', moldura: 'moldura_equipada' }
// o primeiro de cada lista do registro: o padrão de graça (equipado = nada no banco)
export const PADRAO_REGISTRO = { som: 'dano-padrao', efeito: 'efeito-nenhum', lancamento: 'lancamento-padrao', moldura: 'moldura-nenhuma' }
const PREFIXO = { som: 'dano-', efeito: 'efeito-', lancamento: 'lancamento-', moldura: 'moldura-anim-' }
const SLUG_BANCO = { som: '', efeito: '', lancamento: '', moldura: 'anim_' }

const item = (tipo, slug, nome, raridade, cor) => ({
  id: `${tipo}.${SLUG_BANCO[tipo]}${slug}`,
  tipo,
  slot: tipo,
  registro: `${PREFIXO[tipo]}${slug.replace(/_/g, '-')}`,
  nome,
  raridade,
  bau: true,
  ...(cor && { cor }),
})

export const ITENS_SLOTS = [
  // sons de dano (dano-*)
  item('som', 'latido', 'Latido', 'comum'),
  item('som', 'pato', 'Quack', 'comum'),
  item('som', 'buzina', 'Buzina', 'comum'),
  item('som', 'boing', 'Boing', 'comum'),
  item('som', 'miau', 'Miau', 'raro'),
  item('som', 'moeda', 'Moedinha', 'raro'),
  item('som', 'sino', 'Sino', 'raro'),
  item('som', 'vidro', 'Vidro Quebrado', 'epico'),
  item('som', 'cabra', 'Cabra', 'epico'),
  item('som', 'laser', 'Laser', 'lendario'),
  // efeitos de carta (efeito-*)
  item('efeito', 'bolhas', 'Bolhas', 'comum'),
  item('efeito', 'folhas', 'Folhas ao Vento', 'comum'),
  item('efeito', 'brilho', 'Brilho', 'comum'),
  item('efeito', 'estrelas', 'Estrelas', 'raro'),
  item('efeito', 'sombra', 'Sombra', 'raro'),
  item('efeito', 'arco_iris', 'Arco-íris', 'raro'),
  item('efeito', 'chamas', 'Chamas', 'epico'),
  item('efeito', 'eletrico', 'Elétrico', 'epico'),
  item('efeito', 'pixel_fogo', 'Fogo de Pixel', 'epico'),
  item('efeito', 'holografico', 'Holográfico', 'lendario'),
  // lançamentos de carta (lancamento-*)
  item('lancamento', 'confete', 'Confete', 'comum'),
  item('lancamento', 'sakura', 'Sakura', 'comum'),
  item('lancamento', 'raio', 'Raio', 'raro'),
  item('lancamento', 'meteoro', 'Meteoro', 'raro'),
  item('lancamento', 'explosao', 'Explosão', 'epico'),
  item('lancamento', 'tsunami', 'Tsunami', 'epico'),
  item('lancamento', 'arco_iris_borboletas', 'Borboletas de Arco-íris', 'lendario'),
  item('lancamento', 'buraco_negro', 'Buraco Negro', 'lendario'),
  // molduras animadas (moldura-anim-*; a cor é a da borda parada, onde a animação não roda)
  item('moldura', 'coracoes', 'Corações', 'comum', '#ff6f9a'),
  item('moldura', 'estrelas', 'Estrelas Cadentes', 'comum', '#ffe066'),
  item('moldura', 'gelo', 'Gelo', 'comum', '#9fe8ff'),
  item('moldura', 'slime', 'Slime', 'raro', '#7fe05a'),
  item('moldura', 'neon', 'Neon', 'raro', '#ff40e0'),
  item('moldura', 'arco_iris', 'Arco-íris Vivo', 'raro', '#ff9a40'),
  item('moldura', 'fogo', 'Fogo', 'epico', '#ff5a1f'),
  item('moldura', 'glitch', 'Glitch', 'epico', '#40ffd0'),
  item('moldura', 'gerson', 'Gerson', 'lendario', '#7aa05a'),
  item('moldura', 'galaxia', 'Galáxia', 'lendario', '#7a5aff'),
]

// títulos que só saem do baú (o tipo de sempre)
export const TITULOS_BAU = [
  { id: 'titulo.bau_curioso', tipo: 'titulo', nome: 'Curioso(a)', raridade: 'comum', bau: true },
  { id: 'titulo.bau_sortudo', tipo: 'titulo', nome: 'Sortudo(a)', raridade: 'comum', bau: true },
  { id: 'titulo.bau_cacador', tipo: 'titulo', nome: 'Caçador(a) de Baús', raridade: 'raro', bau: true },
  { id: 'titulo.bau_colecionador', tipo: 'titulo', nome: 'Colecionador(a)', raridade: 'raro', bau: true },
  { id: 'titulo.bau_reliquia', tipo: 'titulo', nome: 'Relíquia Viva', raridade: 'epico', bau: true },
  { id: 'titulo.bau_lenda', tipo: 'titulo', nome: 'Lenda do Baú', raridade: 'lendario', bau: true },
]

// tudo que pode sair do baú (o mesmo do catálogo do banco com bau = true)
export const ITENS_BAU = [...ITENS_SLOTS, ...TITULOS_BAU]
const POR_ID = new Map(ITENS_BAU.map((i) => [i.id, i]))
const POR_REGISTRO = new Map(ITENS_SLOTS.map((i) => [i.registro, i]))
export const itemDoBau = (id) => POR_ID.get(id) ?? null
export const ehItemDoBau = (id) => POR_ID.has(id)

// os de cada raridade, na ordem do banco (`order by id collate "C"`: a ordem dos bytes, igual ao < do JS)
const ordenar = (lista) => [...lista].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
export const POOL_BAU = Object.fromEntries(RARIDADES.map((r) => [r, ordenar(ITENS_BAU.filter((i) => i.raridade === r).map((i) => i.id))]))

// banco <-> registro do conteúdo
export function registroDoId(id) {
  if (typeof id !== 'string') return null
  return POR_ID.get(id)?.registro ?? null
}
export const idDoRegistro = (registro) => POR_REGISTRO.get(registro)?.id ?? null
// o slot (som/efeito/lancamento/moldura) de um id do banco; só as molduras ANIMADAS contam como moldura aqui
export const slotDoId = (id) => POR_ID.get(id)?.slot ?? null
export const itensDoSlot = (slot) => ITENS_SLOTS.filter((i) => i.slot === slot)

// Pode equipar? (o mesmo do equipar() do banco para os tipos novos: só o que a conta TEM; null tira)
export function podeEquipar(tipo, id, inventario) {
  if (!TIPOS_SLOT.includes(tipo) && tipo !== 'moldura') return false
  if (id == null) return true
  const i = POR_ID.get(id)
  if (!i || i.tipo !== tipo) return tipo === 'moldura' // moldura de outra origem: quem confere é o banco
  return Boolean(inventario?.has?.(id))
}

// O que um jogador tem equipado, em ids do REGISTRO (o que a arena e o lobby usam). perfil: a linha de
// perfis (ou o resumo do lobby { som, efeito, lancamento, moldura } em ids do banco). Id desconhecido = padrão.
export function equipadosDoPerfil(perfil) {
  const ler = (slot) => {
    const id = perfil?.[COLUNA_DO_SLOT[slot]] ?? perfil?.[slot] ?? null
    const i = POR_ID.get(id)
    return i && i.slot === slot ? i.registro : PADRAO_REGISTRO[slot]
  }
  return Object.fromEntries(SLOTS.map((s) => [s, ler(s)]))
}
export const EQUIPADOS_PADRAO = Object.freeze({ ...PADRAO_REGISTRO })

// O que o LOBBY repassa aos outros jogadores (só ids conhecidos do catálogo; o resto vira null = padrão)
export function cosmeticosPublicos(perfil) {
  const ler = (slot) => {
    const id = perfil?.[COLUNA_DO_SLOT[slot]] ?? null
    return POR_ID.get(id)?.slot === slot ? id : null
  }
  return { som: ler('som'), efeito: ler('efeito'), lancamento: ler('lancamento'), moldura: ler('moldura') }
}

// ---------- o sorteio (espelho de abrir_bau da 0015) ----------

export function quantidadeDoSorteio(u) {
  return QUANTIDADE.find((q) => u < q.ate)?.n ?? 1
}

export function raridadeDoSorteio(u) {
  let acc = 0
  for (const r of RARIDADES) {
    acc += PESOS[r]
    if (u < acc) return r
  }
  return 'lendario'
}

// números válidos? (SORTEIO_TAMANHO inteiros em [0, ESCALA))
export const sorteioValido = (u) => Array.isArray(u) && u.length === SORTEIO_TAMANHO && u.every((x) => Number.isInteger(x) && x >= 0 && x < ESCALA)

// Abre um baú com os números sorteados. desdeEpico: quantos baús seguidos a conta abriu sem nada épico ou
// melhor ANTES deste. possui(id): a conta já tem? Devolve { recompensas, xp, desdeEpico (o novo), pity }:
//   { tipo: 'item', id, raridade }                         cosmético novo
//   { tipo: 'duplicado', id, raridade, xp }                 já tinha (ou saiu duas vezes no mesmo baú): vira XP
//   { tipo: 'xp', raridade, xp }                            bônus de XP (só a 2ª e a 3ª)
export function rolarBau(u, { desdeEpico = 0, possui = () => false, pool = POOL_BAU } = {}) {
  if (!sorteioValido(u)) throw new Error('sorteio inválido')
  const n = quantidadeDoSorteio(u[0])
  const pity = desdeEpico >= PITY - 1
  const saiu = new Set()
  const recompensas = []
  let melhor = -1
  for (let k = 0; k < n; k++) {
    let raridade = raridadeDoSorteio(u[1 + 3 * k])
    if (k === 0 && pity && nivelDaRaridade(raridade) < nivelDaRaridade('epico')) raridade = 'epico'
    melhor = Math.max(melhor, nivelDaRaridade(raridade))
    const lista = pool[raridade] ?? []
    if ((k > 0 && u[2 + 3 * k] < CHANCE_XP_EXTRA) || !lista.length) {
      recompensas.push({ tipo: 'xp', raridade, xp: XP_BONUS[raridade] })
      continue
    }
    const id = lista[u[3 + 3 * k] % lista.length]
    if (saiu.has(id) || possui(id)) recompensas.push({ tipo: 'duplicado', id, raridade, xp: XP_DUPLICADO[raridade] })
    else recompensas.push({ tipo: 'item', id, raridade })
    saiu.add(id)
  }
  const xp = recompensas.reduce((s, r) => s + (r.xp ?? 0), 0)
  return { recompensas, xp, desdeEpico: melhor >= nivelDaRaridade('epico') ? 0 : desdeEpico + 1, pity }
}

// o texto de uma recompensa (a tela do baú)
export function textoDaRecompensa(r, nomeDoItem = (id) => itemDoBau(id)?.nome ?? id) {
  if (r.tipo === 'xp') return `+${r.xp} XP`
  if (r.tipo === 'duplicado') return `${nomeDoItem(r.id)}: já tinha, +${r.xp} XP`
  return nomeDoItem(r.id)
}
