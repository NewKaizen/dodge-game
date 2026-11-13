// A PONTE entre as partidas e o CONTEÚDO dos cosméticos dos slots novos (docs/baus.md,
// docs/cosmeticos-ids.md). O conteúdo (sons, efeitos, lançamentos, molduras animadas e as prévias) mora
// em src/game/cosmeticos/registro.js; quem o carrega é cosmeticosRegistro.js (só no navegador, pelo
// Vite) e entrega aqui com definirRegistro(). Sem registro (ainda não chegou, falhou, nos testes) tudo
// cai no padrão de sempre.
//
// REGRA: um cosmético NUNCA quebra a partida e NUNCA muda nada nela (só som e desenho). Toda chamada ao
// registro passa por try/catch; o lançamento é decoração (a partida não espera por ele).
//
//   definirRegistro(registro | null)            (cosmeticosRegistro.js; os testes injetam um de mentira)
//   tocarDano(cena, id, padrao)                 o som de dano equipado (padrao(): o som de sempre)
//   efeitoNaCarta(cena, carta, id)              -> { destroy() } (some sozinho quando a carta é destruída)
//   lancar(cena, { x, y, alvoX, alvoY, cor }, id)  -> Promise que SEMPRE resolve (no máximo LANCAR_MAX_MS)
//   molduraAnimada(cena, x, y, tamanho, id)     -> Container | null
//   previaDe(cena, tipo, id, x, y, tamanho)     -> { destroy(), tocar?() } | null ('som'|'efeito'|'lancamento'|'moldura'|'frente'|'verso')
//   frenteNaCarta(cena, carta, id)              true = o estilo da frente desenhou a face (entities/Carta.js); false = a
//                                               Carta desenha a clássica (padrão, id desconhecido, sem registro ou ERRO)
//   versoNaCarta(cena, carta, id)               o mesmo para o verso ilustrado (id do registro, 'verso-<x>')
//   miniaturaDe(cena, tipo, id)                 chave de uma textura parada da carta de amostra ('frente'|'verso') | null
//   cosmeticosDosLados({ sala, perfil, n, emRede })  -> [{ som, efeito, lancamento, moldura }] por lado/vaga
//                                               (ids do REGISTRO; em rede os de cada jogador, pelo lobby;
//                                               fora da rede o lado 0 é quem está logado, o resto o padrão)
//   cosmeticosDosParticipantes(participantes, n)   salas de N: [{ indice, conta }] -> por índice
//   somDoLado(cena, j, padrao) · lancarDoLado(cena, j, de, para, cor)   o mesmo, lendo cena.cosmeticos[j]
import { PADRAO_REGISTRO, EQUIPADOS_PADRAO, equipadosDoPerfil, registroDoId } from '../lib/cosmeticos.js'

export const LANCAR_MAX_MS = 2500

// a classe Carta (entities/Carta.js se registra aqui ao carregar): as prévias dos estilos de carta montam
// cartas de verdade sem o conteúdo precisar importar o Phaser
let ClasseCarta = null
export const definirCarta = (C) => (ClasseCarta = typeof C === 'function' ? C : null)
export const classeCarta = () => ClasseCarta

let registro = null
const falhas = new Map() // função -> quantas vezes falhou (só para o console do dev)

export function definirRegistro(r) {
  registro = r && typeof r === 'object' ? r : null
}
export const registroAtual = () => registro

const ehPadrao = (slot, id) => !id || id === PADRAO_REGISTRO[slot]

function falhou(nome, e) {
  const n = (falhas.get(nome) ?? 0) + 1
  falhas.set(nome, n)
  if (n <= 3 && typeof console !== 'undefined') console.warn(`[cosmeticos] ${nome}: ${e?.message ?? e}`)
}
export const falhasDoRegistro = () => Object.fromEntries(falhas)

// chama registro[nome](...args) sem deixar nada escapar; undefined se não existe ou falhou
function chamar(nome, ...args) {
  const f = registro?.[nome]
  if (typeof f !== 'function') return undefined
  try {
    return f.apply(registro, args)
  } catch (e) {
    falhou(nome, e)
    return undefined
  }
}

const NADA = Object.freeze({ destroy() {} })

export function tocarDano(cena, id, padrao = () => {}) {
  const tocarPadrao = () => {
    try {
      padrao()
    } catch (e) {
      falhou('padrao', e)
    }
  }
  if (ehPadrao('som', id) || typeof registro?.tocarSomDano !== 'function') return tocarPadrao()
  try {
    registro.tocarSomDano(cena, id)
  } catch (e) {
    falhou('tocarSomDano', e)
    tocarPadrao()
  }
}

export function efeitoNaCarta(cena, carta, id) {
  if (ehPadrao('efeito', id) || !carta) return NADA
  const h = chamar('aplicarEfeitoCarta', cena, carta, id)
  if (!h || typeof h.destroy !== 'function') return NADA
  let vivo = true
  const destruir = () => {
    if (!vivo) return
    vivo = false
    try {
      h.destroy()
    } catch (e) {
      falhou('efeito.destroy', e)
    }
  }
  try {
    carta.once?.('destroy', destruir)
  } catch (e) {
    falhou('carta.once', e)
  }
  return { destroy: destruir }
}

export function lancar(cena, opcoes, id) {
  if (ehPadrao('lancamento', id)) return Promise.resolve(false)
  let p
  try {
    p = registro?.animarLancamento?.(cena, { ...opcoes }, id)
  } catch (e) {
    falhou('animarLancamento', e)
    return Promise.resolve(false)
  }
  if (!p || typeof p.then !== 'function') return Promise.resolve(Boolean(p))
  let timer
  const limite = new Promise((ok) => (timer = setTimeout(() => ok(false), LANCAR_MAX_MS)))
  return Promise.race([
    Promise.resolve(p).then(
      () => true,
      (e) => {
        falhou('animarLancamento', e)
        return false
      },
    ),
    limite,
  ]).finally(() => clearTimeout(timer))
}

export function molduraAnimada(cena, x, y, tamanho, id) {
  if (ehPadrao('moldura', id)) return null
  return chamar('desenharMoldura', cena, x, y, tamanho, id) ?? null
}

// profundidade: a prévia nasce na raiz da cena; o que ela criou vai para esta profundidade (por cima das
// caixas da tela, que ficam num container mais alto)
export function previaDe(cena, tipo, id, x, y, tamanho, profundidade = null) {
  const lista = cena?.children?.list
  const antes = profundidade != null && Array.isArray(lista) ? new Set(lista) : null
  const h = chamar('previa', cena, tipo, id, x, y, tamanho)
  if (!h || typeof h.destroy !== 'function') return null
  if (antes) {
    try {
      for (const o of cena.children.list) if (!antes.has(o)) o.setDepth?.(profundidade)
    } catch (e) {
      falhou('previa.profundidade', e)
    }
  }
  return {
    destroy() {
      try {
        h.destroy()
      } catch (e) {
        falhou('previa.destroy', e)
      }
    },
    tocar: typeof h.tocar === 'function'
      ? () => {
          try {
            h.tocar()
          } catch (e) {
            falhou('previa.tocar', e)
          }
        }
      : null,
  }
}

// ESTILO DA FRENTE (0016): o conteúdo desenha a face inteira chamando carta.montarFrente(tema). Qualquer erro
// (no estilo, num desenho, numa textura) devolve false e a Carta limpa o que sobrou e desenha a clássica.
export function frenteNaCarta(cena, carta, id) {
  if (ehPadrao('frente', id) || !carta || typeof registro?.desenharFrente !== 'function') return false
  try {
    return registro.desenharFrente(cena, carta, id) === true
  } catch (e) {
    falhou('desenharFrente', e)
    return false
  }
}

// VERSO ILUSTRADO (0016): o mesmo contrato (false = o verso de sempre, liso na cor do item)
export function versoNaCarta(cena, carta, id) {
  if (!id || !carta || typeof registro?.desenharVerso !== 'function') return false
  try {
    return registro.desenharVerso(cena, carta, id) === true
  } catch (e) {
    falhou('desenharVerso', e)
    return false
  }
}

// a textura parada de uma carta de amostra (Coleção, roleta do baú): chave ou null
export function miniaturaDe(cena, tipo, id) {
  const chave = chamar('miniatura', cena, tipo, id)
  return typeof chave === 'string' && cena?.textures?.exists?.(chave) ? chave : null
}

// o que o lobby mandou de um membro (conta.cosmeticos, ids do banco) -> ids do registro
export const equipadosDoMembro = (m) => {
  const c = m?.conta?.cosmeticos
  if (!c || typeof c !== 'object') return { ...EQUIPADOS_PADRAO }
  const ler = (slot) => registroDoId(c[slot]) ?? PADRAO_REGISTRO[slot]
  return { som: ler('som'), efeito: ler('efeito'), lancamento: ler('lancamento'), moldura: ler('moldura'), frente: ler('frente') }
}

// os cosméticos de cada lado da partida. Modos de 2 (n = 2, porVaga false): [host, convidado], como os
// versos (pvp/versos.js). Salas de N (porVaga): a ordem das vagas (o índice j das arenas de N).
export function cosmeticosDosLados({ sala = null, perfil = null, n = 2, emRede = false, porVaga = false } = {}) {
  const lados = Array.from({ length: n }, () => ({ ...EQUIPADOS_PADRAO }))
  const membros = sala?.membros ?? []
  if (emRede && membros.length > 1) {
    if (porVaga) {
      for (const m of membros) if (Number.isInteger(m.vaga) && m.vaga >= 0 && m.vaga < n) lados[m.vaga] = equipadosDoMembro(m)
    } else {
      const host = membros.find((m) => m.papel === 'host')
      const convidado = membros.find((m) => m.papel === 'convidado')
      lados[0] = equipadosDoMembro(host)
      if (n > 1) lados[1] = equipadosDoMembro(convidado)
    }
    return lados
  }
  if (perfil) lados[0] = equipadosDoPerfil(perfil)
  return lados
}

// salas de N (as arenas de 3 e 4): participantesDaPartida() = [{ indice, conta }] em ordem de vaga
export function cosmeticosDosParticipantes(participantes, n) {
  const lados = Array.from({ length: n }, () => ({ ...EQUIPADOS_PADRAO }))
  for (const p of Array.isArray(participantes) ? participantes : []) if (Number.isInteger(p?.indice) && p.indice >= 0 && p.indice < n) lados[p.indice] = equipadosDoMembro(p)
  return lados
}

// atalhos das arenas: cena.cosmeticos = [{ som, efeito, lancamento, moldura }] por lado
export const somDoLado = (cena, j, padrao) => tocarDano(cena, cena?.cosmeticos?.[j]?.som, padrao)
export function lancarDoLado(cena, j, de, para, cor = 0xffffff) {
  const id = cena?.cosmeticos?.[j]?.lancamento
  if (!de || !para || ehPadrao('lancamento', id)) return Promise.resolve(false)
  return lancar(cena, { x: de.x, y: de.y, alvoX: para.x, alvoY: para.y, cor }, id)
}
