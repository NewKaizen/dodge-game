// Fichas do Grimório (scenes/Grimorio.js): as páginas (personagens do PvP e
// chefes do CO-OP), as cartas de cada página na ordem da tela e tudo que a
// tela mostra de uma carta (números, textos do PvP e do CO-OP e como montar a
// prévia do ataque). Lógica pura (sem Phaser), testável em Node: a biblioteca
// de ataques entra por parâmetro, como em pvp/cartas.js.
//
//   PAGINAS                          [{ id, tipo: 'personagem' | 'chefe' }]
//   cartasDaPagina(pagina)           cartas na ordem da tela, cada uma com .grupo
//   gruposDaPagina(pagina)           [{ rotulo, inicio, fim }] (naipes ou fases)
//   fichaDaCarta(carta)              { tipo, numeros, textos }
//   previaDaCarta(carta, ataques)    { criar, dano, ritmo, inverter, tema, velocidadeMax, rotulo }
//                                    ou { semAtaque: 'motivo' }
import { CARTAS, PERSONAGENS_PVP, TEMAS, SIMBOLOS, SUPER, ehSuper, especialDaCarta, nomeDoValor, ataqueDaCarta, resumoDoAtaque, DIFICULDADE_PVP } from '../pvp/cartas.js'
import { descricaoCoop, COOP } from '../coop/regras.js'
import { CARTAS_CHEFES, ataqueDaCartaChefe, danoDaCartaChefe, ritmoDaCartaChefe, inverteControles, poderDaCartaChefe, suporteDoChefe, TIPOS_CHEFE } from '../coop/cartasChefe.js'
import { CHEFES, ORDEM_CHEFES } from '../coop/chefes/index.js'
import { DESAFIO, DIFICULDADES } from '../constants.js'
import { PERSONAGENS } from '../data/personagens.js'
import { TEXTOS } from '../pvp/padroes.js'

export const PAGINAS = [...PERSONAGENS_PVP.map((id) => ({ id, tipo: 'personagem' })), ...ORDEM_CHEFES.map((id) => ({ id, tipo: 'chefe' }))]

// Teto de velocidade das balas na arena PvP (o mesmo da PvpArena)
const VELOCIDADE_MAX_PVP = 300

export const TIPO_NAIPE = { espadas: 'ATAQUE', ouros: 'CONTROLE', paus: 'ARMADILHA', copas: 'SUPORTE' }
const ORDEM_NAIPE = ['espadas', 'ouros', 'paus', 'copas']
const NOME_ESPECIAL = { espelho: 'ESPELHO', anular: 'ANULAR', roubo: 'ROUBO', segundaChance: 'SEGUNDA CHANCE' }
const pct = (f) => `${Math.round(f * 100)}%`

// O que cada ataque da biblioteca faz (as cartas do chefe só dizem o naipe)
const TEXTO_ATAQUE = {
  rain: TEXTOS.chuva,
  sides: TEXTOS.estocadas,
  aimed: TEXTOS.mira,
  spiral: TEXTOS.espiral,
  colunas: TEXTOS.colunas,
  ondas: TEXTOS.ondas,
  lasers: TEXTOS.lasers,
  quicantes: TEXTOS.quicantes,
  anel: TEXTOS.anel,
  divisores: TEXTOS.divisores,
  carrossel: TEXTOS.carrossel,
  foice: TEXTOS.foice,
  bombas: TEXTOS.bombas,
  forcado: TEXTOS.forcado,
  rachaduras: TEXTOS.rachaduras,
  caosFinal: TEXTOS.caosFinal,
  caminhonete: 'Caminhonete desgovernada cruza a caixa pela faixa que os faróis acendem',
  brasas: 'Brasas sobem do chão balançando e estouram em fagulhas',
}

// Biblioteca de mentira que só anota os nomes: A.juntos(A.rain(), A.aimed())
// vira { nome: 'rain + aimed' } (o mesmo formato de attacks/definir.js)
const ANOTAR = new Proxy(
  {},
  {
    get: (_, nome) =>
      (...args) => {
        if (nome === 'juntos') return { nome: args.map((a) => a.nome).join(' + ') }
        if (nome === 'sequencia') return { nome: args.map((a) => a.nome).join(' > ') }
        if (nome === 'comCaixa') return args[1]
        return { nome }
      },
  },
)

const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1)

// 'colunas + aimed > ondas' -> 'Colunas despencam do alto e, junto, rajadas miradas no coração. Depois, paredes...'
export function textoDoAtaque(nome) {
  const frase = (n) => TEXTO_ATAQUE[n] ?? n
  return nome
    .split(' > ')
    .map((etapa) => etapa.split(' + ').map((n, i) => (i ? minuscula(frase(n)) : frase(n))).join(' e, junto, '))
    .map((etapa, i) => (i ? `Depois, ${minuscula(etapa)}` : etapa))
    .join('. ')
}

// ---------- páginas ----------

// Cartas da página na ordem da tela: personagem por naipe (♠ ♦ ♣ ♥, do Ás ao
// K) e o SUPER no fim; chefe por fase e o SUPER no fim. Cópias (a tela pode
// mexer nelas à vontade), cada uma com `grupo` (o rótulo do grupo dela).
export function cartasDaPagina(pagina) {
  if (pagina.tipo === 'chefe') {
    const { fases, super: sup } = CARTAS_CHEFES[pagina.id]
    return [...fases.flatMap((cartas, f) => cartas.map((c) => ({ ...c, grupo: `FASE ${f + 1}` }))), { ...sup, grupo: '★' }]
  }
  const todas = CARTAS[pagina.id] ?? []
  const normais = ORDEM_NAIPE.flatMap((naipe) =>
    todas
      .filter((c) => c.naipe === naipe && !ehSuper(c))
      .sort((a, b) => a.valor - b.valor)
      .map((c) => ({ ...c, grupo: `${SIMBOLOS[naipe]} ${TIPO_NAIPE[naipe]}` })),
  )
  return [...normais, ...todas.filter(ehSuper).map((c) => ({ ...c, grupo: '★' }))]
}

// Grupos seguidos da página: [{ rotulo, inicio, fim }] (índices de cartasDaPagina, fim incluído)
export function gruposDaPagina(pagina) {
  const grupos = []
  cartasDaPagina(pagina).forEach((c, i) => {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.rotulo === c.grupo) ultimo.fim = i
    else grupos.push({ rotulo: c.grupo, inicio: i, fim: i })
  })
  return grupos
}

// Nome da página (personagem ou chefe) e quantas cartas
export function tituloDaPagina(pagina) {
  if (pagina.tipo === 'chefe') return { nome: CHEFES[pagina.id].nome, detalhe: `CHEFE DO CO-OP · ${DIFICULDADES[CHEFES[pagina.id].dificuldade].rotulo}` }
  return { nome: PERSONAGENS[pagina.id]?.nome ?? pagina.id, detalhe: 'BARALHO DO PVP E DO CO-OP' }
}

// ---------- ficha da carta ----------

// O que a tela escreve sobre a carta:
//   tipo      '♠ ATAQUE · 7' (SUPER: '★ SUPER · imparável'; Ás: '♠ ESPECIAL · ESPELHO')
//   numeros   [{ rotulo, valor }] linhas curtas (custo, dano por bala, ritmo...)
//   textos    [{ titulo, texto, modo }] descrições (PvP, CO-OP, respostas do CO-OP)
export function fichaDaCarta(carta) {
  return carta.chefe ? fichaDoChefe(carta) : fichaDoJogador(carta)
}

function fichaDoJogador(carta) {
  const especial = especialDaCarta(carta)
  const sup = ehSuper(carta)
  const tipo = sup ? '★ SUPER · imparável' : especial ? `${SIMBOLOS[carta.naipe]} ESPECIAL · ${NOME_ESPECIAL[especial]}` : `${SIMBOLOS[carta.naipe]} ${TIPO_NAIPE[carta.naipe]} · ${nomeDoValor(carta.valor)}`
  const { dano, ritmo, inverterMs } = resumoDoAtaque(carta)
  const numeros = [{ rotulo: 'CUSTO', valor: sup ? `${SUPER.custo} (CO-OP: ${COOP.custoSuper})` : `${carta.custo} de energia` }]
  if (dano) numeros.push({ rotulo: 'DANO', valor: `${dano} por bala` })
  // ritmo: o aperto do PvP vale para todas; só o ♦ acelera além dele
  const extra = ritmo.velocidade / DIFICULDADE_PVP.velocidade
  if (extra > 1.005) numeros.push({ rotulo: 'BALAS', valor: `+${pct(extra - 1)} rápidas` })
  if (inverterMs) numeros.push({ rotulo: 'EXTRA', valor: 'inverte controles' })
  return {
    tipo,
    numeros,
    textos: [
      { titulo: 'NO PVP', texto: carta.descricao, modo: 'pvp' },
      { titulo: 'NO CO-OP', texto: descricaoCoop(carta), modo: 'coop' },
    ],
  }
}

function fichaDoChefe(carta) {
  const sup = ehSuper(carta)
  const def = CHEFES[carta.chefe]
  const tipo = sup ? '★ SUPER DO CHEFE' : `${SIMBOLOS[carta.naipe]} ${TIPOS_CHEFE[carta.naipe]} · ${nomeDoValor(carta.valor)}`
  const numeros = [{ rotulo: 'QUANDO', valor: sup ? `a cada ${COOP.cargaSuper} rodadas (fase 2+)` : `fase ${carta.fase + 1} de ${def.fases.length}` }]
  numeros.push({ rotulo: 'DANO', valor: `${danoDaCartaChefe(carta)} por bala (FÁCIL)` })
  const ritmo = ritmoDaCartaChefe(carta)
  if (ritmo.velocidade > 1.005) numeros.push({ rotulo: 'BALAS', valor: `+${pct(ritmo.velocidade - 1)} rápidas` })
  if (inverteControles(carta)) numeros.push({ rotulo: 'EXTRA', valor: 'inverte controles' })

  let respostas
  if (sup) {
    respostas = `Vai nas DUAS caixas e nada cancela nem reflete (o Espelho vira um golpe simples). Cada A♦ Anular tira ${COOP.anularCarga} da carga e atrasa o próximo.`
  } else if (carta.naipe === 'copas') {
    const { cura, guarda } = suporteDoChefe(carta)
    respostas = `Cancelar a carta impede a cura${guarda ? ' e a guarda' : ''}: A♠ Espelho, A♦ Anular, A♣ Roubo ou um SUPER na caixa onde ela cair.${cura ? ` Deixar passar: o chefe recupera ${cura} HP.` : ''}`
  } else {
    respostas = `A♠ Espelho devolve (golpe de ${poderDaCartaChefe(carta)} no chefe), A♦ Anular cancela, A♣ Roubo tira ela da caixa do parceiro e um SUPER varre. ♦ deixa as balas mais lentas na sua caixa.`
  }
  return {
    tipo,
    numeros,
    textos: [
      { titulo: 'O QUE FAZ', texto: oQueFaz(carta), modo: 'chefe' },
      { titulo: 'COMO RESPONDER', texto: respostas, modo: 'coop' },
    ],
  }
}

// Texto do chefe com o ataque por extenso (o SUPER e o ♥ já explicam o que fazem)
function oQueFaz(carta) {
  if (ehSuper(carta) || carta.naipe === 'copas') return carta.descricao
  const tipo = TIPOS_CHEFE[carta.naipe]
  let texto = `${tipo[0]}${tipo.slice(1).toLowerCase()} do chefe: ${minuscula(textoDoAtaque(ataqueDaCartaChefe(carta, { ataques: ANOTAR }).nome))}.`
  if (inverteControles(carta)) texto += ' Inverte os controles durante o ataque.'
  return texto
}

// ---------- prévia do ataque ----------

// Como rodar o ataque da carta numa Pista:
//   criar()         monta o ataque (um novo a cada volta da prévia)
//   dano, ritmo     como as arenas passam para pista.rodar
//   inverter        o ataque inverte os controles de quem desvia
//   tema            formas/cores das balas
//   velocidadeMax   teto de velocidade das balas
//   rotulo          o que a prévia está mostrando
// Carta sem ataque (Ás de copas): { semAtaque: 'motivo' }
export function previaDaCarta(carta, ataques) {
  if (!ataques) throw new Error('previaDaCarta: passe a biblioteca de ataques (attacks/index.js)')
  if (carta.chefe) return previaDoChefe(carta, ataques)
  const especial = especialDaCarta(carta)
  if (!ataqueDaCarta(carta, { ataques })) return { semAtaque: especial === 'segundaChance' ? 'O Ás de copas não manda ataque: ele cura e segura quem joga.' : 'Esta carta não manda ataque.' }
  const { dano, ritmo, inverterMs } = resumoDoAtaque(carta)
  let rotulo = 'o ataque desta carta'
  if (ehSuper(carta)) rotulo = 'SUPER: três fases seguidas'
  else if (especial === 'espelho') rotulo = 'o eco (sem nada para refletir)'
  else if (especial) rotulo = 'o ataque leve que vai junto'
  else if (carta.naipe === 'copas') rotulo = 'o ataque fraquinho que vai junto'
  return {
    criar: () => ataqueDaCarta(carta, { ataques }),
    dano,
    ritmo,
    inverter: inverterMs > 0,
    tema: TEMAS[carta.personagem] ?? {},
    velocidadeMax: VELOCIDADE_MAX_PVP,
    rotulo,
  }
}

function previaDoChefe(carta, ataques) {
  const def = CHEFES[carta.chefe]
  const desafio = def.desafio ?? {}
  const extra = ritmoDaCartaChefe(carta)
  // ritmo de uma luta no FÁCIL (o mesmo da CoopArena: aperto geral, do chefe e da carta)
  const ritmo = {
    velocidade: DESAFIO.velocidade * (desafio.velocidade ?? 1) * extra.velocidade,
    densidade: DESAFIO.densidade * (desafio.densidade ?? 1) * extra.densidade,
  }
  let rotulo = 'o ataque desta carta'
  if (ehSuper(carta)) rotulo = 'SUPER do chefe (nas duas caixas)'
  else if (carta.naipe === 'copas') rotulo = 'o ataque fraquinho que vai junto'
  return {
    criar: () => ataqueDaCartaChefe(carta, { ataques }),
    dano: danoDaCartaChefe(carta),
    ritmo,
    inverter: inverteControles(carta),
    tema: def.tema,
    velocidadeMax: DIFICULDADES[def.dificuldade].velocidadeMaxBala * DESAFIO.velocidadeMax,
    rotulo,
  }
}
