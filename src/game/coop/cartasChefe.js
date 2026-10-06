// Cartas dos chefes no CO-OP de cartas. Lógica pura: os ataques recebem a
// biblioteca attacks/ por parâmetro (no jogo: ataqueDaCartaChefeNoJogo, em
// coop/ataquesDoChefe.js).
//
// Carta do chefe (mesmo formato das cartas do PvP, para a Carta desenhar):
//   { id, personagem: <chefe>, chefe, naipe, valor, nome, descricao, custo: 0, fase }
//   SUPER do chefe: valor 14, naipe 'espadas', id '<chefe>-super'
import { BARALHOS_CHEFES } from './chefes/index.js'
import { ehSuper } from '../pvp/cartas.js'

export const TIPOS_CHEFE = { espadas: 'ATAQUE', ouros: 'CONTROLE', paus: 'ARMADILHA', copas: 'SE CURA' }

// Dano por bala das cartas do chefe: danoBala do chefe (modo clássico) vezes
// esta faixa (2 -> minimo, K -> maximo); o SUPER usa `super`
export const DANO_CHEFE = { minimo: 0.6, maximo: 1, super: 1.1, leve: 0.35 }
// ♦ do chefe deixa as balas mais rápidas (como o ♦ do PvP)
export const RITMO_OUROS = 0.15

const forcaChefe = (valor) => Math.min(1, Math.max(0, (valor - 2) / 11))

export function montarCartasDoChefe(chefe) {
  const def = BARALHOS_CHEFES[chefe]
  if (!def) throw new Error(`chefe sem baralho de cartas: ${chefe}`)
  const fases = def.fases.map((fase, f) =>
    fase.cartas.map(([naipe, valor, nome, ataque, extras = {}], i) => {
      let descricao
      if (naipe === 'copas') {
        const partes = []
        if (extras.cura) partes.push(`cura ${extras.cura} HP`)
        if (extras.guarda) partes.push(`o próximo contra-ataque causa ${Math.round(extras.guarda * 100)}% do dano`)
        descricao = `O chefe se recompõe: ${partes.join('; ')}. Manda só um ataque fraquinho.`
      } else {
        descricao = `${TIPOS_CHEFE[naipe][0]}${TIPOS_CHEFE[naipe].slice(1).toLowerCase()} do chefe.`
        if (extras.inverter) descricao += ' Inverte os controles durante o ataque.'
      }
      return { id: `${chefe}-f${f}-${i}`, personagem: chefe, chefe, naipe, valor, nome, descricao, custo: 0, fase: f }
    }),
  )
  const sup = { id: `${chefe}-super`, personagem: chefe, chefe, naipe: 'espadas', valor: 14, nome: def.super.nome, descricao: `SUPER: ${def.super.texto}. Imparável.`, custo: 0, fase: null }
  return { fases, super: sup }
}

export const CARTAS_CHEFES = Object.fromEntries(Object.keys(BARALHOS_CHEFES).map((c) => [c, montarCartasDoChefe(c)]))

// A linha da definição de uma carta do chefe ([naipe, valor, nome, ataque, extras])
function definicao(carta) {
  const def = BARALHOS_CHEFES[carta.chefe]
  if (!def) throw new Error(`carta de chefe desconhecida: ${carta.id}`)
  if (ehSuper(carta)) return null
  const [, f, i] = /-f(\d+)-(\d+)$/.exec(carta.id) ?? []
  const linha = def.fases[Number(f)]?.cartas[Number(i)]
  if (!linha) throw new Error(`carta de chefe desconhecida: ${carta.id}`)
  return linha
}

// { cura, guarda } de uma carta ♥ do chefe (null nas outras)
export function suporteDoChefe(carta) {
  if (carta?.naipe !== 'copas' || ehSuper(carta)) return null
  const extras = definicao(carta)[4] ?? {}
  return { cura: extras.cura ?? 0, guarda: extras.guarda ?? null }
}

export function inverteControles(carta) {
  if (!carta || ehSuper(carta)) return false
  return Boolean(definicao(carta)[4]?.inverter)
}

// Dano por bala da carta do chefe: danoBala do baralho dele escalado pelo
// valor da carta; `fatorNivel` = NIVEIS[nivel].dano
export function danoDaCartaChefe(carta, fatorNivel = 1) {
  const { danoBala } = BARALHOS_CHEFES[carta.chefe]
  let fator
  if (ehSuper(carta)) fator = DANO_CHEFE.super
  else if (carta.naipe === 'copas') fator = DANO_CHEFE.leve
  else fator = DANO_CHEFE.minimo + (DANO_CHEFE.maximo - DANO_CHEFE.minimo) * forcaChefe(carta.valor)
  return Math.max(1, Math.round(danoBala * fator * fatorNivel))
}

// Multiplicadores de ritmo extras da carta (em cima do ritmo base da luta)
export function ritmoDaCartaChefe(carta) {
  if (carta.naipe !== 'ouros' || ehSuper(carta)) return { velocidade: 1, densidade: 1 }
  return { velocidade: Math.round((1 + RITMO_OUROS * forcaChefe(carta.valor)) * 100) / 100, densidade: 1 }
}

// "Poder" de uma carta do chefe refletida pelo Espelho: o dano que ela
// voltaria a causar no chefe (3 acertos)
export function poderDaCartaChefe(carta, fatorNivel = 1) {
  return danoDaCartaChefe(carta, fatorNivel) * 3
}

// Ataque da carta do chefe. contexto.ataques = biblioteca attacks/ (obrigatória)
export function ataqueDaCartaChefe(carta, contexto = {}) {
  const A = contexto.ataques
  if (!A) throw new Error('ataqueDaCartaChefe: passe contexto.ataques (attacks/index.js)')
  const def = BARALHOS_CHEFES[carta.chefe]
  if (ehSuper(carta)) return def.super.criar(A)
  if (carta.naipe === 'copas') return def.leve(A)
  return definicao(carta)[3](A)
}

// Fase do chefe pela fração de HP (a última fase cujo limite já foi alcançado)
export function faseDoChefe(chefe, fracao) {
  const fases = BARALHOS_CHEFES[chefe].fases
  let fase = 0
  fases.forEach((f, i) => {
    if (fracao <= f.hp) fase = i
  })
  return fase
}

export function superDoChefe(chefe) {
  const def = BARALHOS_CHEFES[chefe]
  return { nome: def.super.nome, texto: def.super.texto }
}
