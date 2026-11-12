import { CORACAO } from '../constants.js'
import { ENERGIA, registrarGrazes, registrarPerfeitoCombo, quebrarSequencia, COMBO_PERFEITO } from '../pvp/regras.js'
import { SUPER } from '../pvp/cartas.js'
import { criarExercicio, coracaoNovo } from './exercicio.js'
import { criarMesa, cartaDoManual } from './cartasDoManual.js'
import { roteiroDeTiros } from './tiros.js'

// Página 9 do Manual do Ralsei (EXTRA), "Ases, SUPER e perfeitos": como CARREGAR a energia e quando gastá-la.
// As regras são as reais (pvp/regras.js e pvp/cartas.js), numa mesa de verdade (cartasDoManual.criarMesa):
//
//   carregar   dois ataques SEM levar acerto: cada um é um desvio PERFEITO (`registrarPerfeitoCombo`: +2 pela carta J,
//              ×1 no primeiro e ×2 no segundo seguido); grazes também contam (`registrarGrazes`); um acerto quebra o
//              combo (`quebrarSequencia`). Meta: encher as 10 gemas
//   super      com 10 de energia, jogar o ★ SUPER (custa SUPER.custo = 10): paga tudo; é imparável
//   ases       os quatro Ases (custam 3): qual deles CANCELA a carta do adversário?
//
// A máquina é a de manual/exercicio.js; a cena é scenes/ManualRalsei7.js (as páginas 7 a 9 dividem a cena).

export const ENERGIA_INICIAL_P9 = 6
export const ONDA_MS = 6400 // cada ataque: 3 tiros nos primeiros 3 s e o tempo de eles saírem da caixa
export const ONDAS = 2
export const CARTA_DO_ATAQUE = 'ralsei-ouros-11' // um J♦: o ataque vale +2 de energia (energiaPerfeito)
export const AS_ESPADAS = 'ralsei-espadas-1'
export const AS_COPAS = 'ralsei-copas-1'
export const AS_OUROS = 'ralsei-ouros-1'
export const AS_PAUS = 'ralsei-paus-1'
export const SUPER_ID = 'ralsei-espadas-14'
export const MAO_P9 = [AS_ESPADAS, AS_COPAS, AS_OUROS, AS_PAUS, SUPER_ID]
export const SLOTS_SUPER = [AS_ESPADAS, SUPER_ID]
export const SLOTS_ASES = [AS_ESPADAS, AS_COPAS, AS_OUROS, AS_PAUS]

export const FALAS_INTRO9 = [
  'Página 9, um extra! Aqui estão os segredos de quem joga bonito: PERFEITOS, ASES e o SUPER.',
  'Desvio perfeito é passar por um ataque inteiro sem levar dano. Dá energia, e a energia paga o ★ SUPER!',
]

const mesaNova = (energia) => criarMesa({ mao: MAO_P9, energia, semente: 'manual:p9' })

// ---------- carregar ----------

// um roteiro por ataque: 3 tiros mirados nos 3 primeiros segundos de cada um
function roteiroDeOndas(caixa) {
  const ondas = Array.from({ length: ONDAS }, (_, k) => roteiroDeTiros(caixa, { semente: `manual:p9:carregar:${k}`, inicio: k * ONDA_MS + 300, passo: 1200, ate: k * ONDA_MS + 3000, velocidade: 130 }))
  return { gerar: (t, alvo) => ondas.flatMap((o) => o.gerar(t, alvo)) }
}

function tentativaDeCarregar({ caixa }) {
  const cx = (caixa.esquerda + caixa.direita) / 2
  const cy = (caixa.topo + caixa.base) / 2
  const mesa = mesaNova(ENERGIA_INICIAL_P9)
  return {
    alvos: [coracaoNovo(0, cx, cy, { humano: 0 })],
    // 3 tiros por ataque (ondas seguidas); o desvio perfeito é conferido quando o ataque acaba
    roteiro: roteiroDeOndas(caixa),
    mesa,
    ondaConferida: 0,
    duracao: ONDAS * ONDA_MS + 20000,
    hud: { contador: 'ataque 1 de 2', energia: mesa.energia, combo: '', ondas: 0 },
  }
}

function aoPassarCarregar(t, r, p) {
  if (r.acertos.length) {
    quebrarSequencia(t.mesa.estado, 0)
    p.eventos.push({ tipo: 'quebrou' })
    return 'derrota'
  }
  for (let k = 0; k < r.grazes.length; k++) {
    const ganho = registrarGrazes(t.mesa.estado, 0, 1)
    if (ganho > 0) p.eventos.push({ tipo: 'energia', ganho })
  }
  // o ataque acabou sem acerto: desvio perfeito
  while (t.ondaConferida < ONDAS && t.tempo >= (t.ondaConferida + 1) * ONDA_MS) {
    const pf = registrarPerfeitoCombo(t.mesa.estado, 0, cartaDoManual(CARTA_DO_ATAQUE))
    t.ondaConferida++
    t.hud.ondas = t.ondaConferida
    t.hud.combo = `PERFEITO x${pf.multiplicador}!`
    p.eventos.push({ tipo: 'perfeito', multiplicador: pf.multiplicador, ganho: pf.ganho, sequencia: pf.sequencia })
  }
  t.hud.energia = t.mesa.energia
  t.hud.contador = t.ondaConferida >= ONDAS ? 'energia cheia!' : `ataque ${t.ondaConferida + 1} de ${ONDAS}`
  return t.ondaConferida >= ONDAS ? (t.mesa.energia >= ENERGIA.maxima ? 'vitoria' : 'derrota') : undefined
}

export const PASSOS9 = [
  {
    id: 'carregar',
    titulo: 'Perfeito dá energia',
    tipo: 'desafio',
    duracao: ONDAS * ONDA_MS + 20000,
    explicar: `Desvio PERFEITO dá energia, e perfeitos seguidos valem MAIS: x2, x3, até x${COMBO_PERFEITO.teto}! Vamos encher as gemas até ${ENERGIA.maxima}.`,
    tentar: 'Dois ataques sem levar nenhum acerto! Raspar (graze) também ajuda: 5 grazes dão +1.',
    errou: ['O combo quebrou! Qualquer acerto zera a sequência. Vamos de novo?', 'Calma: perfeito é o ataque INTEIRO sem acertos. Siga as linhas pontilhadas!', 'Dica: sair do caminho cedo é mais seguro que raspar.'],
    errouTempo: 'Vamos de novo? Desvie dos tiros até as gemas encherem.',
    acertou: 'ENERGIA CHEIA! O segundo perfeito valeu x2. Agora dá para jogar o ★ SUPER, que custa 10!',
    iniciar: tentativaDeCarregar,
    aoPassar: aoPassarCarregar,
  },
  {
    id: 'super',
    titulo: 'Jogar o SUPER',
    tipo: 'escolha',
    slots: SLOTS_SUPER,
    explicar: `Gemas cheias! O ★ SUPER custa ${SUPER.custo}, a energia toda. Ele é IMPARÁVEL: o Ás de ouros não anula e o Ás de espadas não devolve.`,
    instrucao: 'Escolha o ★ SUPER e confirme!',
    errou: ['O Ás custa 3 e é ótimo, mas a hora agora é do ★, no fim da mão!'],
    preparar: (p) => {
      p.mesa = mesaNova(ENERGIA.maxima)
    },
    avaliar: (id) =>
      id === SUPER_ID
        ? { certo: true, disparar: true, falaAcao: 'SUPER! O Último Capítulo pagou as 10 gemas de uma vez!', fala: 'Ninguém segura o SUPER! No CO-OP ele custa só 8 e tira 33% da vida do chefe; dois SUPERs juntos viram um SUPER COMBO!' }
        : { certo: false, fala: 'O Ás custa 3 e é ótimo, mas a hora agora é do ★, no fim da mão!' },
  },
  {
    id: 'ases',
    titulo: 'Os quatro Ases',
    tipo: 'escolha',
    slots: SLOTS_ASES,
    explicar: 'Todo baralho tem 4 ASES, um de cada naipe. Cada um faz uma coisa especial e custa 3.',
    instrucao: 'Qual Ás CANCELA a carta que o adversário jogou?',
    errou: ['Procure o que CANCELA a carta toda!', 'Olhe os nomes das cartas: um deles anula.'],
    preparar: (p) => {
      p.mesa = mesaNova(ENERGIA.maxima)
    },
    avaliar: (id) => {
      if (id === AS_OUROS) return { certo: true, fala: 'Isso! ♦ Anular cancela a carta toda. E os outros: ♠ Espelho devolve o ataque, ♣ Roubo pega uma carta da mão dele, ♥ Segunda chance cura e protege.' }
      const fala = {
        [AS_ESPADAS]: 'Esse é o Espelho (♠): ele DEVOLVE o ataque do adversário para a caixa dele. Procure o que CANCELA!',
        [AS_COPAS]: 'Segunda chance (♥) cura 25% e você não cai nesta rodada. Eu quero o que CANCELA a carta dele!',
        [AS_PAUS]: 'Roubo (♣) pega uma carta da mão dele. Mas o que CANCELA a carta é outro!',
      }[id]
      return { certo: false, fala }
    },
  },
]

export const TEXTOS9 = {
  concluida: 'Você já sabe o que os melhores jogadores sabem! A página 9 está completa.',
  concluidaPulou: 'Página 9 completa! Volte quando quiser para pegar o adesivo que faltou.',
  fim: 'Isso é tudo do meu caderno! Obrigado por ler até o fim.',
}

// op.passos: o progresso salvo ([null | 'feita' | 'pulada' x3])
export function criarPagina9({ caixa, velocidade = CORACAO.velocidadePadrao, hitbox = CORACAO.hitbox, passos = null, humanos = 1 } = {}) {
  return criarExercicio({ caixa, velocidade, hitbox, passos: PASSOS9, falasIntro: FALAS_INTRO9, textos: TEXTOS9, salvos: passos, humanos })
}
