import { RESPIRO, CAIXA, CAIXA_DINAMICA } from '../constants.js'

// Define um padrão de ataque configurável:
//
//   export default definirAtaque({
//     nome: 'rain',
//     padrao: { duracao: 5000, velocidade: 160 },  // valores padrão da config
//     iniciar(a, cfg) { ... },                      // a: ver attacks/contexto.js
//   })
//
// O resultado é uma função: rain({ velocidade: 300 }) devolve o ataque pronto.
//
// Toda onda respira: um instante de calmaria no início e outro no meio (ver
// RESPIRO em constants.js). Nas pausas o relógio do ataque para (nenhum
// aviso, disparo ou timer avança; balas que já estão voando continuam). A
// `duracao` de um ataque é o tempo ATIVO (cfg.duracao); as pausas se somam
// a ele. Para mudar ou desligar por ataque: rain({ respiro: { meio: 0 } }).
//
// Caixa: `caixa: { largura, altura, x?, y? }` no padrão do ataque (ou na
// config) faz a onda rodar numa caixa diferente. Antes da onda a caixa mostra
// uma pré-visualização e muda (preparoCaixa); rain({ caixa: null }) desliga.
// Ondas em `juntos` usam a caixa padrão; para outra: comCaixa(forma, juntos(...)).
export function definirAtaque({ nome, padrao = {}, iniciar }) {
  return (config = {}) => {
    const cfg = { duracao: 5000, ...padrao, ...config }
    return onda({ nome, ativa: cfg.duracao, corpo: (a) => iniciar(a, cfg), respiro: cfg.respiro, caixa: cfg.caixa })
  }
}

// Vários ataques ao mesmo tempo. O grupo é UMA onda: respira junto (início
// e meio sincronizados para todos os ataques do grupo).
export function juntos(...lista) {
  // ataques escritos à mão ({ nome, duracao, iniciar }, sem definirAtaque) também valem
  const ativaDe = (at) => at.ativa ?? at.duracao
  const corpoDe = (at) => at.corpo ?? at.iniciar
  return onda({
    nome: lista.map((at) => at.nome).join(' + '),
    ativa: Math.max(0, ...lista.map(ativaDe)),
    corpo: (a) => lista.forEach((at) => corpoDe(at)(a.limitar(paraRelogio(a.respiro, ativaDe(at))))),
  })
}

// Um ataque depois do outro. Cada onda respira por conta própria.
export function sequencia(...lista) {
  // a caixa da 1ª onda quem prepara é quem inicia a sequência (Battle); aqui só as trocas entre ondas
  const anteriores = lista.map((at, i) => (i === 0 ? at.caixa : lista[i - 1].caixa))
  const inicios = []
  let total = 0
  lista.forEach((at, i) => {
    inicios.push(total)
    total += preparoCaixa(anteriores[i], at.caixa) + at.duracao
  })
  const iniciar = (a) => lista.forEach((at, i) => a.depois(inicios[i], () => executar(at, a, anteriores[i])))
  return {
    nome: lista.map((at) => at.nome).join(' > '),
    duracao: total,
    ativa: total,
    caixa: lista[0]?.caixa ?? null,
    corpo: iniciar,
    iniciar,
    filhos: lista,
    // "reduz uma onda": com 2+ ondas perde a última; com uma só, encurta ela
    encurtar: (fator) => (lista.length > 1 ? sequencia(...lista.slice(0, -1)) : sequencia(encurtar(lista[0], fator))),
  }
}

// Versão mais curta do ataque (fator < 1), usada pelo DEFEND e por ACTs.
// Ataque simples ou `juntos`: fica com `fator` do tempo ativo (respiros
// mantidos, mínimo ATIVA_MINIMA). `sequencia`: perde a última onda.
export function encurtar(ataque, fator) {
  if (!(fator < 0.999)) return ataque
  return ataque.encurtar?.(fator) ?? ataque
}

const ATIVA_MINIMA = 1500

// ---------- ondas e respiros ----------

// Uma onda: respiro de início -> 1ª metade -> respiro do meio -> 2ª metade.
//   ativa    ms de ataque de verdade (sem contar as pausas)
//   corpo    função (a) que agenda o ataque; roda no começo da onda, mas os
//            timers ficam parados durante as pausas
//   respiro  { inicio, meio } em ms; padrão RESPIRO
function onda({ nome, ativa, corpo, respiro, caixa = null }) {
  const r = { ...RESPIRO, ...respiro }
  const metade = Math.round(ativa / 2)
  const pausas = [
    [0, r.inicio],
    [r.inicio + metade, r.inicio + metade + r.meio],
  ].filter(([ini, fim]) => fim > ini)
  const duracao = ativa + r.inicio + r.meio
  return {
    nome,
    duracao, // ativa + pausas
    ativa,
    corpo,
    respiro: r,
    caixa: normalizarCaixa(caixa),
    encurtar: (fator) => onda({ nome, ativa: Math.max(ATIVA_MINIMA, Math.round(ativa * fator)), corpo, respiro, caixa }),
    comCaixa: (nova) => onda({ nome, ativa, corpo, respiro, caixa: nova }),
    iniciar: (a) => {
      const w = a.limitar(duracao)
      w.respiro = { origem: a.tempo, pausas }
      corpo(w)
    },
  }
}

// Tempo de relógio (com as pausas) necessário para `ativa` ms de ataque
export function paraRelogio(respiro, ativa) {
  let relogio = ativa
  for (const [ini, fim] of respiro?.pausas ?? []) if (ini < relogio) relogio += fim - ini
  return relogio
}

// ---------- caixa dinâmica ----------

// ms de pré-visualização + transição antes de uma onda que muda a caixa
export const PREPARO_CAIXA_MS = CAIXA_DINAMICA.avisoMs + CAIXA_DINAMICA.transicaoMs

// Forma de caixa sem redundância: null quando é igual à padrão
function normalizarCaixa(c) {
  if (!c) return null
  const forma = { largura: c.largura ?? CAIXA.largura, altura: c.altura ?? CAIXA.altura, x: c.x ?? 0, y: c.y ?? 0 }
  const padrao = forma.largura === CAIXA.largura && forma.altura === CAIXA.altura && !forma.x && !forma.y
  return padrao ? null : forma
}

const mesmaCaixa = (p, q) => JSON.stringify(normalizarCaixa(p)) === JSON.stringify(normalizarCaixa(q))

// Tempo que a caixa leva para passar de `de` para `para` (0 se já é igual)
export function preparoCaixa(de, para) {
  return mesmaCaixa(de, para) ? 0 : PREPARO_CAIXA_MS
}

// Roda a onda `at`: se ela pede outra caixa, mostra o aviso, muda e só então começa
function executar(at, a, caixaAtual) {
  const preparo = preparoCaixa(caixaAtual, at.caixa)
  if (!preparo) return at.iniciar(a.limitar(at.duracao))
  a.caixaPara(at.caixa)
  a.depois(preparo, () => at.iniciar(a.limitar(at.duracao)))
}

// Mesmo ataque, mas rodando numa caixa de outra forma ({ largura, altura, x?, y? }; null = padrão)
export function comCaixa(forma, ataque) {
  return ataque.comCaixa?.(forma) ?? ataque
}
