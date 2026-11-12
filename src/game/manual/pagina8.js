import { CORACAO } from '../constants.js'
import { criarExercicio, coracaoNovo } from './exercicio.js'
import { criarRoteiro } from './padroes.js'
import { RAIO_MARCA } from './pagina1.js'

// Página 8 do Manual do Ralsei (EXTRA), "Jogando em dupla": dois corações no MESMO quadro, como no CO-OP
// (docs/coop-cartas.md, "Quadro único"): o ataque vai para os dois, cada um cuida do seu coração.
//
//   marcas   cada coração vai à sua marca (o vermelho à esquerda, o outro à direita)
//   dupla    9 s de ataque no quadro único: um cair não acaba (o outro segura); os dois caírem, sim
//
// QUEM MOVE O QUÊ: com 2 pessoas (2 controles, controle + teclado, ou o teclado nos dois conjuntos: WASD e setas),
// cada uma move um coração. Com 1 pessoa, todos os controles movem o coração vermelho e o parceiro é o RALSEI
// (a CPU aliada do CO-OP, coração verde). A cena escolhe pelos controles (paginaBase: joysDosJogadores).
// Os corações e as balas são os do jogo (onda.js: passoMulti); o desvio da CPU aliada é o piloto da página 2.

export const COR_DOS_CORACOES = ['vermelho', 'azul']
const DURACAO_DUPLA = 9000

export const falasIntro8 = (humanos) => [
  'Página 8, um extra! Dois corações, uma caixa só: assim é o CO-OP e a tela dividida.',
  humanos >= 2 ? 'Cada pessoa move o seu coração. O ataque vai para os dois, e cada um cuida do seu!' : 'Você move o coração vermelho. O verde é o meu: sou o seu parceiro! Com duas pessoas jogando, cada uma move um.',
]
export const FALAS_INTRO8 = falasIntro8(1)

const centro = (c) => ({ x: (c.esquerda + c.direita) / 2, y: (c.topo + c.base) / 2 })
const quase = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= RAIO_MARCA

// os corações: o 1 (vermelho) é sempre de uma pessoa; o 2 é de outra pessoa ou da CPU aliada
function coracoes(caixa, humanos, xs) {
  const c = centro(caixa)
  const larg = caixa.direita - caixa.esquerda
  return [coracaoNovo(0, caixa.esquerda + larg * xs[0], c.y, { humano: 0 }), humanos >= 2 ? coracaoNovo(1, caixa.esquerda + larg * xs[1], c.y, { humano: 1 }) : coracaoNovo(1, caixa.esquerda + larg * xs[1], c.y, { cpu: true })]
}

function marcas({ caixa, humanos }) {
  const c = centro(caixa)
  const larg = caixa.direita - caixa.esquerda
  const lista = [
    { x: caixa.esquerda + larg * 0.14, y: c.y, pega: false },
    { x: caixa.esquerda + larg * 0.86, y: c.y, pega: false },
  ]
  return {
    alvos: coracoes(caixa, humanos, [0.42, 0.58]),
    roteiro: null,
    marcas: lista,
    hud: { contador: 'marcas: 0 de 2' },
  }
}

export const PASSOS8 = [
  {
    id: 'marcas',
    titulo: 'Cada um na sua marca',
    tipo: 'desafio',
    duracao: 120000,
    explicar: (c) => (c.humanos >= 2 ? 'Cada pessoa tem o seu coração: o vermelho e o azul. Levem cada um à sua marca, ao mesmo tempo!' : 'Você é o coração vermelho e eu sou o verde. Leve o seu à marca da esquerda: eu levo o meu à da direita!'),
    tentar: (c) => (c.humanos >= 2 ? 'Mexam os dois corações: cada um até a sua marca!' : 'Sua vez! Leve o coração vermelho até a marca da esquerda.'),
    errou: ['Vamos de novo!'],
    acertou: 'Os dois chegaram! No CO-OP vocês dividem um quadro só e desviam do MESMO ataque.',
    iniciar: marcas,
    // o parceiro (CPU) segue para a marca dele, devagar, depois de um instante
    piloto(a, t) {
      const m = t.marcas[a.id]
      if (m.pega || t.tempo < 500) return { x: 0, y: 0 }
      const d = Math.hypot(m.x - a.x, m.y - a.y) || 1
      return { x: ((m.x - a.x) / d) * 100, y: ((m.y - a.y) / d) * 100 }
    },
    aoPassar(t, r, p) {
      t.alvos.forEach((a, i) => {
        const m = t.marcas[i]
        if (m.pega || !quase(a, m)) return
        m.pega = true
        p.eventos.push({ tipo: 'marca', indice: i })
      })
      const n = t.marcas.filter((m) => m.pega).length
      t.hud.contador = `marcas: ${n} de 2`
      return n === 2 ? 'vitoria' : undefined
    },
  },
  {
    id: 'dupla',
    titulo: 'Desviar juntos',
    tipo: 'desafio',
    duracao: DURACAO_DUPLA + 600,
    explicar: 'Agora desviem JUNTOS, no mesmo quadro. As balas vão para os dois: cada um cuida do seu coração!',
    tentar: 'Aguentem 9 segundos! Se um cair, o outro segura a barra.',
    errou: ['Os dois caíram! Na luta de verdade isso é game over. Vamos treinar de novo?', 'Quase! Olhem cada um o seu cantinho e não parem de se mexer.', 'Dica: um olha a chuva, o outro olha a fileira. Dupla é combinar!'],
    acertou: ({ t }) => {
      const vivos = t.alvos.filter((a) => a.ativo).length
      return vivos === t.alvos.length ? 'Os dois de pé! Que dupla! No CO-OP, golpes do mesmo naipe viram COMBO ×1,25 e do mesmo valor, PAR ×1,5.' : 'Um caiu, mas o outro segurou! No CO-OP, uma carta de copas (♥) levanta quem caiu.'
    },
    iniciar({ caixa, humanos }) {
      return {
        alvos: coracoes(caixa, humanos, [0.3, 0.7]),
        roteiro: criarRoteiro('mistura', caixa, { semente: 'manual:p8:dupla', duracao: DURACAO_DUPLA }),
        hud: { contador: 'sobrevivam 9 s', caidos: 0 },
      }
    },
    aoPassar(t, r, p) {
      for (const { alvo } of r.acertos) {
        alvo.ativo = false
        alvo.caido = true
        t.hud.caidos = t.alvos.filter((a) => a.caido).length
        p.eventos.push({ tipo: 'caiu', indice: alvo.id })
      }
      if (!t.alvos.some((a) => a.ativo)) return 'derrota'
      const resta = Math.max(0, DURACAO_DUPLA - t.tempo)
      t.hud.contador = `sobrevivam ${Math.ceil(resta / 1000)} s`
      return t.tempo >= DURACAO_DUPLA ? 'vitoria' : undefined
    },
  },
]

export const TEXTOS8 = {
  concluida: 'Vocês jogaram em dupla! A página 8 está completa.',
  concluidaPulou: 'Página 8 completa! Volte quando quiser para pegar o adesivo que faltou.',
  fim: 'Vamos para a página 9!',
}

// op.humanos: 1 (o parceiro é o Ralsei) ou 2 (duas pessoas) · op.passos: o progresso salvo ([null | 'feita' | 'pulada' x2])
export function criarPagina8({ caixa, velocidade = CORACAO.velocidadePadrao, hitbox = CORACAO.hitbox, passos = null, humanos = 1 } = {}) {
  return criarExercicio({ caixa, velocidade, hitbox, passos: PASSOS8, falasIntro: falasIntro8(humanos), textos: TEXTOS8, salvos: passos, humanos })
}
