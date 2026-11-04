import { CORACAO } from '../constants.js'
import { criarOnda, moverCoracao } from './onda.js'
import { criarRoteiro, pilotoDeDesvio, LICOES } from './padroes.js'
import { expressaoDoRalsei } from './ralsei.js'

// Página 2 do Manual do Ralsei, "Vamos desviar?": aprender a LER os padrões, uma ideia de cada vez.
// Máquina de estados e regras, SEM Phaser (testada em __tests__/pagina2.test.js); a cena
// (scenes/ManualRalsei2.js) só desenha e repassa o joystick, o botão A e os toques de direção.
//
//   intro -> [ explicar -> demo? -> preparar -> tentar -> (errou -> preparar)* -> acertou ] x 4 -> concluida -> virando -> fim
//                                                 \-> 3 erros na mesma: escolha (tentar de novo | pular esta parte)
//
//   intro      Ralsei fala (FALAS_INTRO2, ou "bem-vindo de volta" ao retomar); A passa
//   explicar   a ideia da mini-lição; A: ver a demonstração (a mistura não tem demonstração)
//   demo       o coração de giz do Ralsei mostra o movimento certo UMA vez (pilotoDeDesvio); A pula
//   preparar   PREPARO_MS de "sua vez!" (o coração já anda); depois as balas
//   tentar     sobreviver a onda (5 a 10 s, LICOES[i].duracao); o coração e as balas pelas regras reais
//   errou      levou um acerto: incentivo e recomeça SÓ esta mini-lição (RETRY_MS, ou A)
//   escolha    3 erros nesta mini-lição: ↑/↓ escolhe "tentar de novo" ou "pular esta parte", A confirma
//   acertou    adesivo da mini-lição; ACERTOU_MS (ou A) e vai para a próxima
//   concluida  adesivo dourado "PÁGINA 2 ✓"; A vira a página
//   virando    a cena anima a virada e chama p.terminouDeVirar()
//   fim        a página 3 ainda não existe ("continua…")
//
// Progresso: p.licoes[i] é null | 'feita' | 'pulada'. Os eventos { tipo: 'licao', indice, resultado }
// e { tipo: 'etapa', etapa: 'concluida' } dizem à cena o que salvar (manual/progresso.js).

export const ETAPAS2 = ['intro', 'explicar', 'demo', 'preparar', 'tentar', 'errou', 'escolha', 'acertou', 'concluida', 'virando', 'fim']
export const FALAS_INTRO2 = [
  'Página 2! Agora você vai aprender a LER os ataques.',
  'Uma ideia de cada vez. Eu mostro primeiro com o meu coração de giz, depois é a sua vez!',
]
export const FALA_VOLTA = 'Que bom que você voltou! Vamos continuar de onde paramos.'

export const PREPARO_MS = 1100
export const RETRY_MS = 1400
export const ACERTOU_MS = 1600
export const ERROS_PARA_PULAR = 3
export const OPCOES_ESCOLHA = ['tentar de novo', 'pular esta parte']

// o que o Ralsei diz em cada mini-lição
export const TEXTOS = {
  chuva: {
    explicar: 'Chuva de cima! Olhe para onde as gotas caem e fique no espaço vazio.',
    demo: 'Olha o meu coração: ele vê a gota chegando e dá um passinho para o lado.',
    tentar: 'Sua vez! Fique no espaço vazio entre as gotas.',
    errou: ['Ops! Olhe para cima: as gotas aparecem antes de cair.', 'Quase! Fique onde não tem gota chegando.', 'Sem pressa: um passinho de lado já basta.'],
    acertou: 'Isso! Você achou o espaço vazio!',
  },
  linha: {
    explicar: 'Linha de lado! Uma fileira vem varrendo a caixa, mas sempre tem um buraco.',
    demo: 'Eu procuro o buraco e espero lá dentro. A fileira passa direto!',
    tentar: 'Sua vez! Procure o buraco!',
    errou: ['Quase! Procure o buraco assim que a fileira aparecer.', 'Vá até o buraco antes da fileira chegar.', 'Cada fileira tem o buraco num lugar: olhe de novo!'],
    acertou: 'Muito bem! Você passou pelo buraco!',
  },
  mira: {
    explicar: 'Mira em você! Antes do tiro aparece uma linha pontilhada mostrando o caminho.',
    demo: 'Quando a linha aparece, eu saio do caminho. O tiro vai reto pela linha!',
    tentar: 'Sua vez! Quando a linha aparecer, saia do caminho.',
    errou: ['Ops! O tiro segue a linha pontilhada: saia de cima dela.', 'Quase! Assim que a linha aparecer, ande para o lado.', 'O tiro não faz curva: fuja da linha e pronto.'],
    acertou: 'Perfeito! Você leu a linha direitinho!',
  },
  mistura: {
    explicar: 'Agora uma mistura curtinha das três, bem devagar. Você consegue!',
    demo: '',
    tentar: 'Gotas, fileira e linha: uma coisa de cada vez. 10 segundos!',
    errou: ['Foi por pouco! Uma coisa de cada vez: gota, buraco, linha.', 'Respire: olhe o que está chegando primeiro.', 'Você já sabe as três. Mais uma vez?'],
    acertou: 'Uau! Você leu tudo! Que orgulho!',
  },
}
export const FALA_ESCOLHA = 'Esta está difícil, né? Tudo bem! Quer tentar de novo ou pular esta parte?'
export const FALA_CONCLUIDA = 'Você conseguiu! A página 2 está completa.'
export const FALA_CONCLUIDA_PULOU = 'Página 2 completa! Volte quando quiser para pegar o adesivo que faltou.'
export const FALA_FIM = 'A página 3 ainda está sendo desenhada… continua!'

const centro = (c) => ({ x: (c.esquerda + c.direita) / 2, y: (c.topo + c.base) / 2 })
// onde o coração começa cada tentativa: no meio (na chuva, um pouco para baixo: dá tempo de ver as gotas)
const inicio = (id, c) => ({ x: centro(c).x, y: id === 'chuva' ? c.topo + (c.base - c.topo) * 0.68 : centro(c).y })

export function licoesValidas(licoes) {
  return LICOES.map((_, i) => (licoes?.[i] === 'feita' || licoes?.[i] === 'pulada' ? licoes[i] : null))
}

// op.licoes: o progresso salvo (retoma na primeira mini-lição que falta)
export function criarPagina2({ caixa, velocidade = CORACAO.velocidadePadrao, hitbox = CORACAO.hitbox, licoes = null } = {}) {
  const salvas = licoesValidas(licoes)
  const retomando = salvas.some(Boolean) && salvas.some((x) => !x)
  const p = {
    caixa,
    velocidade,
    hitbox,
    etapa: 'intro',
    falas: retomando ? [FALA_VOLTA] : FALAS_INTRO2,
    falaIdx: 0,
    tempoEtapa: 0,
    licao: retomando ? salvas.findIndex((x) => !x) : 0,
    licoes: retomando ? salvas : LICOES.map(() => null),
    falhas: LICOES.map(() => 0),
    tentativas: LICOES.map(() => 0),
    coracao: centro(caixa),
    demoCoracao: null, // o coração de giz do Ralsei (só na demo)
    onda: criarOnda(caixa),
    roteiro: null,
    decorrido: 0,
    opcao: 0,
    demoVista: LICOES.map(() => false),
    eventos: [],

    get licaoAtual() {
      return LICOES[p.licao]
    },
    get textos() {
      return TEXTOS[p.licaoAtual?.id] ?? TEXTOS.chuva
    },
    get balas() {
      return p.onda.lista
    },
    get duracao() {
      return p.etapa === 'demo' ? p.licaoAtual.demo : p.licaoAtual.duracao
    },
    get progressoOnda() {
      return p.etapa === 'tentar' || p.etapa === 'errou' || p.etapa === 'escolha' ? Math.min(1, p.decorrido / p.licaoAtual.duracao) : p.etapa === 'acertou' ? 1 : 0
    },
    get adesivos() {
      return p.licoes.filter((x) => x === 'feita').length
    },
    get completa() {
      return p.licoes.every(Boolean)
    },
    get fala() {
      return falaDaEtapa2(p)
    },
    // o joy que o piloto da demo usaria agora para o coração do JOGADOR (usado pelo teste de navegador)
    sugestao() {
      return pilotoDeDesvio(p.onda.lista, p.coracao, caixa, p.velocidade, { hitbox: p.hitbox })
    },

    // A. Devolve true se mudou algo.
    avancar() {
      switch (p.etapa) {
        case 'intro':
          if (p.falaIdx < p.falas.length - 1) {
            p.falaIdx++
            p.eventos.push({ tipo: 'fala' })
          } else irPara('explicar')
          return true
        case 'explicar':
          if (p.licaoAtual.demo > 0) comecarDemo()
          else comecarTentativa()
          return true
        case 'demo':
          comecarTentativa() // pulou a demonstração
          return true
        case 'errou':
          comecarTentativa()
          return true
        case 'escolha':
          if (p.opcao === 0) comecarTentativa()
          else concluirLicao('pulada')
          return true
        case 'acertou':
          proximaLicao()
          return true
        case 'concluida':
          irPara('virando')
          return true
        default:
          return false
      }
    },

    // ↑/↓ (só na escolha)
    mover(direcao) {
      if (p.etapa !== 'escolha' || (direcao !== 'cima' && direcao !== 'baixo')) return false
      const nova = direcao === 'baixo' ? Math.min(1, p.opcao + 1) : Math.max(0, p.opcao - 1)
      if (nova === p.opcao) return false
      p.opcao = nova
      p.eventos.push({ tipo: 'opcao', opcao: nova })
      return true
    },

    terminouDeVirar() {
      if (p.etapa === 'virando') irPara('fim')
    },

    // dt em ms, joy do jogador (-100..100)
    tick(dt, joy) {
      dt = Math.min(Math.max(dt, 0), 50)
      p.tempoEtapa += dt
      if (p.etapa === 'demo') {
        // o coração do Ralsei desvia sozinho (as mesmas regras do jogador); nunca "perde"
        const d = p.demoCoracao
        moverCoracao(d, pilotoDeDesvio(p.onda.lista, d, caixa, p.velocidade, { hitbox: p.hitbox }), p.velocidade, dt, caixa)
        rodarOnda(dt)
        if (p.onda.passo(dt, { ...d, hitbox: p.hitbox })) p.eventos.push({ tipo: 'demoTocou' })
        if (p.decorrido >= p.licaoAtual.demo) {
          p.demoVista[p.licao] = true
          comecarTentativa()
        }
      } else if (p.etapa === 'preparar') {
        moverCoracao(p.coracao, joy, p.velocidade, dt, caixa)
        if (p.tempoEtapa >= PREPARO_MS) irPara('tentar')
      } else if (p.etapa === 'tentar') {
        moverCoracao(p.coracao, joy, p.velocidade, dt, caixa)
        rodarOnda(dt)
        const acertou = p.onda.passo(dt, { x: p.coracao.x, y: p.coracao.y, hitbox: p.hitbox })
        if (acertou) {
          p.falhas[p.licao]++
          p.eventos.push({ tipo: 'acerto', falhas: p.falhas[p.licao], bala: acertou })
          if (p.falhas[p.licao] >= ERROS_PARA_PULAR) {
            p.opcao = 0
            irPara('escolha')
          } else irPara('errou')
        } else if (p.decorrido >= p.licaoAtual.duracao) {
          p.onda.limpar()
          concluirLicao('feita')
        }
      } else if (p.etapa === 'errou') {
        if (p.tempoEtapa >= RETRY_MS) comecarTentativa()
      } else if (p.etapa === 'acertou') {
        if (p.tempoEtapa >= ACERTOU_MS) proximaLicao()
      }
    },

    drenar() {
      const e = p.eventos
      p.eventos = []
      return e
    },
  }

  function irPara(etapa) {
    p.etapa = etapa
    p.tempoEtapa = 0
    p.eventos.push({ tipo: 'etapa', etapa })
  }

  function novaOnda(semente, duracao) {
    p.onda = criarOnda(caixa)
    p.roteiro = criarRoteiro(p.licaoAtual.id, caixa, { semente, duracao })
    p.decorrido = 0
  }

  function rodarOnda(dt) {
    p.decorrido += dt
    const alvo = p.etapa === 'demo' ? p.demoCoracao : p.coracao
    for (const o of p.roteiro.gerar(p.decorrido, alvo)) p.onda.bala(o)
  }

  function comecarDemo() {
    const id = p.licaoAtual.id
    novaOnda(`manual:p2:demo:${id}`, p.licaoAtual.demo)
    p.demoCoracao = inicio(id, caixa)
    irPara('demo')
  }

  function comecarTentativa() {
    const id = p.licaoAtual.id
    // a mesma semente a cada tentativa: o padrão se repete igual (dá para aprender)
    novaOnda(`manual:p2:${id}`)
    p.demoCoracao = null
    p.tentativas[p.licao]++
    const c = inicio(id, caixa)
    p.coracao.x = c.x
    p.coracao.y = c.y
    irPara('preparar')
  }

  function concluirLicao(resultado) {
    // pular não apaga um adesivo já ganho numa vez anterior
    if (p.licoes[p.licao] !== 'feita') p.licoes[p.licao] = resultado
    p.onda.limpar()
    p.eventos.push({ tipo: 'licao', indice: p.licao, resultado })
    if (resultado === 'feita') irPara('acertou')
    else proximaLicao()
  }

  function proximaLicao() {
    const prox = p.licoes.findIndex((x, i) => !x && i > p.licao)
    const qualquer = prox >= 0 ? prox : p.licoes.findIndex((x) => !x)
    if (qualquer < 0) {
      irPara('concluida')
      return
    }
    p.licao = qualquer
    irPara('explicar')
  }

  return p
}

export function falaDaEtapa2(p) {
  const t = p.textos
  switch (p.etapa) {
    case 'intro':
      return p.falas[p.falaIdx]
    case 'explicar':
      return t.explicar
    case 'demo':
      return t.demo
    case 'preparar':
    case 'tentar':
      return t.tentar
    case 'errou':
      return t.errou[(p.falhas[p.licao] - 1) % t.errou.length]
    case 'escolha':
      return FALA_ESCOLHA
    case 'acertou':
      return t.acertou
    case 'concluida':
    case 'virando':
      return p.licoes.every((x) => x === 'feita') ? FALA_CONCLUIDA : FALA_CONCLUIDA_PULOU
    default:
      return FALA_FIM
  }
}

// a cara do Ralsei: os eventos mandam por um instante (expressaoDoRalsei), depois a etapa
export function expressaoDaPagina2(etapa, ultimo = null) {
  const base = expressaoDoRalsei(etapa === 'errou' || etapa === 'escolha' ? 'tentarDeNovo' : etapa, ultimo)
  if (base !== 'feliz') return base
  if (etapa === 'demo') return 'concentrado'
  if (etapa === 'acertou') return 'animado'
  return 'feliz'
}
