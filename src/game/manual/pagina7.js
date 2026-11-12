import { CORACAO } from '../constants.js'
import { ENERGIA, registrarGrazes } from '../pvp/regras.js'
import { criarExercicio, coracaoNovo } from './exercicio.js'
import { criarMesa } from './cartasDoManual.js'
import { roteiroDeTiros } from './tiros.js'

// Página 7 do Manual do Ralsei (EXTRA), "Graze: raspando": passar PERTO de uma bala, sem encostar no miolo do
// coração, é um GRAZE, e graze dá energia. As regras são as reais: o anel é `CORACAO.graze` (22 px), o miolo
// é `CORACAO.hitbox` (4,2 px), cada bala dá no máximo 1 graze (entities/fisica.js: grazeia, igual a Balas.tocar)
// e a energia vem de `registrarGrazes` (pvp/regras.js: +1 a cada ENERGIA.grazesPorPonto = 5 grazes).
//
//   raspar    tiros mirados com linha pontilhada: raspe em 3 (um passinho de lado, só o bastante)
//   energia   5 grazes = +1 de energia (a gema acende; a conta é a do jogo)
//
// Levou um acerto no miolo: recomeça só aquele passo. A máquina é a de manual/exercicio.js; a cena é scenes/ManualRalsei7.js.

export const META_RASPAR = 3
export const META_ENERGIA = ENERGIA.grazesPorPonto
export const ENERGIA_INICIAL_P7 = 4
const MAO_P7 = ['ralsei-paus-3']
const DURACAO = 60000 // sem pressa: ninguém é cortado por tempo

export const FALAS_INTRO7 = [
  'Página 7, um extra! Sabia que passar RASPANDO numa bala dá energia?',
  'Isso se chama GRAZE. O anelzinho em volta do seu coração é a zona de graze: a bala entra nele, mas não encosta no miolo.',
]

// os tiros: devagar e espaçados, para dar tempo de ver a linha e dar o passinho
const tiros = (caixa, id) => roteiroDeTiros(caixa, { semente: `manual:p7:${id}`, inicio: 500, passo: 1900, velocidade: 105 })

function tentativa({ caixa }, { id, meta, comEnergia }) {
  const cx = (caixa.esquerda + caixa.direita) / 2
  const cy = (caixa.topo + caixa.base) / 2
  const mesa = comEnergia ? criarMesa({ mao: MAO_P7, energia: ENERGIA_INICIAL_P7, semente: 'manual:p7' }) : null
  const t = {
    alvos: [coracaoNovo(0, cx, cy, { humano: 0 })],
    roteiro: tiros(caixa, id),
    mesa,
    grazes: 0,
    meta,
    hud: { contador: `graze: 0 de ${meta}`, grazes: 0, meta, anel: true },
  }
  if (mesa) {
    t.hud.energia = mesa.energia
    t.hud.grazesParaGema = 0
  }
  return t
}

function aoPassar(t, r, p) {
  if (r.acertos.length) return 'derrota'
  for (let k = 0; k < r.grazes.length; k++) {
    t.grazes++
    t.hud.grazes = t.grazes
    t.hud.contador = `graze: ${Math.min(t.grazes, t.meta)} de ${t.meta}`
    if (t.mesa) {
      const ganho = registrarGrazes(t.mesa.estado, 0, 1)
      t.hud.energia = t.mesa.energia
      t.hud.grazesParaGema = t.mesa.estado.jogadores[0].grazes
      if (ganho > 0) p.eventos.push({ tipo: 'energia', ganho })
    }
  }
  return t.grazes >= t.meta ? 'vitoria' : undefined
}

export const PASSOS7 = [
  {
    id: 'raspar',
    titulo: 'Raspando',
    tipo: 'desafio',
    duracao: DURACAO,
    explicar: 'Veja o anelzinho em volta do coração: se um tiro passar por ele SEM tocar no miolo, é um graze! Vamos raspar em 3 tiros.',
    tentar: 'Quando a linha pontilhada aparecer, dê um passinho de lado: deixe o tiro passar bem pertinho!',
    errou: [
      'Ops! Encostou no miolo. É só um passinho: o tiro tem de passar RASPANDO, não acertando.',
      'Quase! Saia da linha, mas fique pertinho dela, dentro do anel.',
      'Dica: espere o tiro sair e só então dê o passinho de lado.',
    ],
    errouTempo: 'Sem pressa! Fique perto da linha do tiro e saia dela só no último instante.',
    acertou: 'Isso! Três grazes! Raspar é um jeito corajoso de desviar.',
    iniciar: (c) => tentativa(c, { id: 'raspar', meta: META_RASPAR, comEnergia: false }),
    aoPassar,
  },
  {
    id: 'energia',
    titulo: 'Graze vira energia',
    tipo: 'desafio',
    duracao: DURACAO,
    explicar: `Agora o segredo: a cada ${META_ENERGIA} grazes você ganha +1 de ENERGIA. Passar raspando é jogar com coragem!`,
    tentar: `Raspe em ${META_ENERGIA} tiros e veja a gema acender!`,
    errou: ['Ops! Não deixe o tiro encostar no miolo. Só raspar!', 'Quase! Fique pertinho da linha, mas fora dela.', 'Com calma: um graze de cada vez.'],
    errouTempo: 'Sem pressa! Um graze de cada vez.',
    acertou: 'Mais uma gema de energia! E no CO-OP, cada graze deixa a carta de paus (♣) bater mais forte: +6% por graze.',
    iniciar: (c) => tentativa(c, { id: 'energia', meta: META_ENERGIA, comEnergia: true }),
    aoPassar,
  },
]

export const TEXTOS7 = {
  concluida: 'Você aprendeu a raspar! A página 7 está completa.',
  concluidaPulou: 'Página 7 completa! Volte quando quiser para pegar o adesivo que faltou.',
  fim: 'Vamos para a página 8!',
}

// op.passos: o progresso salvo ([null | 'feita' | 'pulada' x2])
export function criarPagina7({ caixa, velocidade = CORACAO.velocidadePadrao, hitbox = CORACAO.hitbox, passos = null, humanos = 1 } = {}) {
  return criarExercicio({ caixa, velocidade, hitbox, passos: PASSOS7, falasIntro: FALAS_INTRO7, textos: TEXTOS7, salvos: passos, humanos })
}
