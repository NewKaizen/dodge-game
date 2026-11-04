import { expressaoDoRalsei } from './ralsei.js'

// A máquina de estados das páginas de CARTAS do Manual do Ralsei (páginas 3 e 4), SEM Phaser
// (testada em __tests__/pagina3.test.js e pagina4.test.js). Cada página só diz as cartas, os passos
// e as falas (manual/pagina3.js, pagina4.js); as regras de jogar/pagar/passar são as reais
// (manual/cartasDoManual.js: criarMesa). A cena desenha e repassa ←/→, ↑/↓ e o botão A.
//
//   intro -> [ escolher -> (atacando | enchendo)? -> acertou | errou -> escolher ]  x passos -> concluida -> virando -> fim
//                              3 erros no mesmo passo: ajuda (tentar de novo | ver o Ralsei mostrar | pular esta parte)
//
//   intro      Ralsei fala (falasIntro, ou a fala de "bem-vindo de volta" ao retomar); A passa
//   escolher   UMA instrução; ←/→ anda pela mão (as cartas e, se a página tiver, PASSAR); A confirma
//   atacando   a carta jogada "ganha vida" (VIVA_MS) e o ataque REAL dela roda na caixa do boneco
//              (VITRINE_MS; A pula depois de PULAR_VITRINE_MS)
//   enchendo   passou a vez: as gemas enchem (+passar, depois a rodada nova); ENCHER_MS
//   errou      incentivo curtinho (o que aquela escolha faz); ERROU_MS ou A e volta a escolher
//   ajuda      3 erros neste passo: ↑/↓ escolhe, A confirma
//   demo       o coraçãozinho verde do Ralsei anda até a escolha certa e dá pulinhos (A pula)
//   acertou    adesivo do passo; ACERTOU_MS ou A
//   concluida  estrela dourada "PÁGINA N ✓"; A vira a página
//   virando    a cena anima a virada e chama p.terminouDeVirar()
//   fim        a próxima página
//
// Um passo:
//   { id, titulo, certo,                        certo = o slot que a demonstração aponta
//     instrucao(ctx), demo, acertou?(ctx),       textos (função ou texto)
//     avaliar(slot, ctx) -> { certo, acao, fala, falaAcao }
//        acao 'atacar'  joga a carta (mesa.jogar) e mostra o ataque; depois conta como certo/errado
//        acao 'passar'  passa a vez (mesa.passar) e enche as gemas
//        acao 'negar'   a carta não pode ser jogada: a pílula "× falta energia (2/3)" aparece nela
//        sem acao       só a fala
//     aoPular?(mesa) } o que acontece com a mesa quando o passo é pulado (ou já estava feito ao retomar)
//   ctx = { mesa, carta(id), slot }
//
// Progresso: p.resultados[i] é null | 'feita' | 'pulada'; o evento { tipo: 'passo', indice, resultado } e
// { tipo: 'etapa', etapa: 'concluida' } dizem à cena o que salvar.

export const PASSAR = 'passar' // o "slot" PASSAR no fim da mão (página 4)
export const VIVA_MS = 800
export const VITRINE_MS = 5200
export const PULAR_VITRINE_MS = 1700
export const ENCHER_MS = 2300
export const ENCHE_PASSAR_MS = 350 // quando a gema do "+1 por passar" acende
export const ENCHE_RODADA_MS = 1250 // quando as da rodada nova acendem
export const ERROU_MS = 3400
export const ACERTOU_MS = 2600
export const ERROS_PARA_AJUDA = 3
export const DEMO_PASSO_MS = 420
export const DEMO_FIM_MS = 1400
export const OPCOES_AJUDA = ['tentar de novo', 'ver o Ralsei mostrar', 'pular esta parte']
export const FALA_AJUDA = 'Tudo bem errar! Quer tentar de novo, ver eu mostrar ou pular esta parte?'
export const FALA_VOLTA = 'Que bom que você voltou! Vamos continuar de onde paramos.'

export const ETAPAS_CARTAS = ['intro', 'escolher', 'atacando', 'enchendo', 'errou', 'ajuda', 'demo', 'acertou', 'concluida', 'virando', 'fim']

const texto = (t, ctx) => (typeof t === 'function' ? t(ctx) : t ?? '')

export const resultadosValidos = (lista, n) => Array.from({ length: n }, (_, i) => (lista?.[i] === 'feita' || lista?.[i] === 'pulada' ? lista[i] : null))

//   op.mesa        criarMesa(...) da página
//   op.slots       ids da mão na ordem da tela (cartas e, opcional, PASSAR)
//   op.passos      os passos (acima)
//   op.falasIntro  as falas do começo
//   op.textos      { concluida, concluidaPulou, fim }
//   op.salvos      o progresso salvo dos passos (retoma no primeiro que falta)
export function criarLicaoDeCartas({ mesa, slots, passos, falasIntro, textos, salvos = null }) {
  const salvas = resultadosValidos(salvos, passos.length)
  const retomando = salvas.some(Boolean) && salvas.some((x) => !x)
  const p = {
    mesa,
    slots,
    passos,
    etapa: 'intro',
    falas: retomando ? [FALA_VOLTA] : falasIntro,
    falaIdx: 0,
    fala: '',
    tempoEtapa: 0,
    passo: retomando ? salvas.findIndex((x) => !x) : 0,
    resultados: retomando ? salvas : passos.map(() => null),
    falhas: passos.map(() => 0),
    cursor: 0,
    opcao: 0,
    jogada: null, // { slot, carta, caixa, gasto } da carta jogada (atacando)
    passe: null, // { antes, depoisDePassar, depois, ... } do último PASSAR (enchendo)
    bloqueio: null, // { slot, codigo, motivo, curto } da última carta negada (a pílula nela)
    pendente: null, // o resultado da avaliação que espera o ataque/as gemas
    demoCursor: null, // onde está o coraçãozinho do Ralsei (índice de slot, fracionário no caminho)
    eventos: [],

    get passoAtual() {
      return passos[p.passo]
    },
    get slotAtual() {
      return slots[p.cursor]
    },
    get adesivos() {
      return p.resultados.filter((x) => x === 'feita').length
    },
    get completa() {
      return p.resultados.every(Boolean)
    },
    // a energia que as gemas mostram agora (no "enchendo" elas acendem aos poucos)
    get energiaNaTela() {
      const e = p.passe
      if (p.etapa === 'enchendo' && e) return p.tempoEtapa < ENCHE_PASSAR_MS ? e.antes : p.tempoEtapa < ENCHE_RODADA_MS ? e.depoisDePassar : e.depois
      // a carta gasta a energia quando "ganha vida" (antes disso a gema ainda está cheia)
      if (p.etapa === 'atacando' && p.jogada && p.tempoEtapa < VIVA_MS * 0.5) return mesa.energia + p.jogada.gasto
      return mesa.energia
    },
    // o "pode jogar?" de cada slot (pvp/regras.js motivoBloqueio; PASSAR sempre pode)
    bloqueioDe(slot) {
      const id = slots[slot]
      return id === PASSAR ? null : mesa.bloqueio(id)
    },
    // fase da carta "ganhando vida" (0..1) e do ataque (ms) para a cena
    get vivaFase() {
      return p.etapa === 'atacando' ? Math.min(1, p.tempoEtapa / VIVA_MS) : 0
    },

    // A. Devolve true se mudou algo.
    avancar() {
      switch (p.etapa) {
        case 'intro':
          if (p.falaIdx < p.falas.length - 1) {
            p.falaIdx++
            p.fala = p.falas[p.falaIdx]
            p.eventos.push({ tipo: 'fala' })
          } else comecarPasso()
          return true
        case 'escolher':
          confirmar(p.cursor)
          return true
        case 'atacando':
          if (p.tempoEtapa < PULAR_VITRINE_MS) return false
          resolver(p.pendente)
          return true
        case 'enchendo':
          if (p.tempoEtapa < ENCHE_RODADA_MS) return false
          resolver(p.pendente)
          return true
        case 'errou':
          voltarAEscolher()
          return true
        case 'ajuda':
          if (p.opcao === 0) voltarAEscolher()
          else if (p.opcao === 1) comecarDemo()
          else concluirPasso('pulada')
          return true
        case 'demo':
          voltarAEscolher()
          return true
        case 'acertou':
          proximoPasso()
          return true
        case 'concluida':
          irPara('virando', p.fala)
          return true
        default:
          return false
      }
    },

    // direção de um toque: 'esquerda' | 'direita' (escolher) · 'cima' | 'baixo' (ajuda)
    mover(direcao) {
      if (p.etapa === 'escolher' && (direcao === 'esquerda' || direcao === 'direita')) {
        const novo = Math.max(0, Math.min(slots.length - 1, p.cursor + (direcao === 'direita' ? 1 : -1)))
        if (novo === p.cursor) return false
        p.cursor = novo
        p.eventos.push({ tipo: 'cursor', slot: novo })
        return true
      }
      if (p.etapa === 'ajuda' && (direcao === 'cima' || direcao === 'baixo')) {
        const nova = Math.max(0, Math.min(OPCOES_AJUDA.length - 1, p.opcao + (direcao === 'baixo' ? 1 : -1)))
        if (nova === p.opcao) return false
        p.opcao = nova
        p.eventos.push({ tipo: 'opcao', opcao: nova })
        return true
      }
      return false
    },

    terminouDeVirar() {
      if (p.etapa === 'virando') irPara('fim', texto(textos.fim))
    },

    tick(dt) {
      dt = Math.min(Math.max(dt, 0), 50)
      p.tempoEtapa += dt
      const t = p.tempoEtapa
      if (p.etapa === 'atacando' && t >= VIVA_MS + VITRINE_MS) resolver(p.pendente)
      else if (p.etapa === 'enchendo' && t >= ENCHER_MS) resolver(p.pendente)
      else if (p.etapa === 'errou' && t >= ERROU_MS) voltarAEscolher()
      else if (p.etapa === 'acertou' && t >= ACERTOU_MS) proximoPasso()
      else if (p.etapa === 'demo') {
        const alvo = slots.indexOf(p.passoAtual.certo)
        const caminho = Math.abs(alvo - p.cursor) * DEMO_PASSO_MS
        const k = caminho ? Math.min(1, t / caminho) : 1
        p.demoCursor = p.cursor + (alvo - p.cursor) * k
        if (t >= caminho + DEMO_FIM_MS) voltarAEscolher()
      }
    },

    drenar() {
      const e = p.eventos
      p.eventos = []
      return e
    },
  }

  const ctx = (slot = p.cursor) => ({ mesa, slot, id: slots[slot], carta: (id) => mesa.cartas.find((c) => c.id === id) ?? null })

  function irPara(etapa, fala) {
    p.etapa = etapa
    p.tempoEtapa = 0
    p.fala = fala
    p.eventos.push({ tipo: 'etapa', etapa })
  }

  function comecarPasso() {
    p.bloqueio = null
    irPara('escolher', texto(p.passoAtual.instrucao, ctx()))
  }

  function voltarAEscolher() {
    p.demoCursor = null
    p.jogada = null
    comecarPasso()
  }

  function confirmar(slot) {
    const id = slots[slot]
    const r = p.passoAtual.avaliar(id, ctx(slot))
    p.bloqueio = null
    if (r.acao === 'negar') {
      const b = id === PASSAR ? null : mesa.bloqueio(id)
      if (b) {
        p.bloqueio = { slot, ...b }
        p.eventos.push({ tipo: 'negada', slot, bloqueio: b })
      }
      return resolver(r)
    }
    if (r.acao === 'atacar') {
      const j = mesa.jogar(id)
      if (!j.ok) throw new Error(`passo ${p.passoAtual.id}: "${id}" não pode ser jogada (${j.bloqueio.motivo})`)
      p.jogada = { slot, ...j }
      p.pendente = r
      p.eventos.push({ tipo: 'jogou', slot, carta: j.carta, caixa: j.caixa, gasto: j.gasto })
      return irPara('atacando', texto(r.falaAcao, ctx(slot)) || p.fala)
    }
    if (r.acao === 'passar') {
      p.passe = mesa.passar()
      p.pendente = r
      p.eventos.push({ tipo: 'passou', passe: p.passe })
      return irPara('enchendo', texto(r.falaAcao, ctx(slot)) || p.fala)
    }
    return resolver(r)
  }

  function resolver(r) {
    p.pendente = null
    if (r.certo) concluirPasso('feita', texto(r.fala, ctx()) || texto(p.passoAtual.acertou, ctx()))
    else errar(texto(r.fala, ctx()))
  }

  function errar(fala) {
    p.falhas[p.passo]++
    p.eventos.push({ tipo: 'erro', falhas: p.falhas[p.passo] })
    if (p.falhas[p.passo] >= ERROS_PARA_AJUDA) {
      p.opcao = 0
      irPara('ajuda', FALA_AJUDA)
    } else irPara('errou', fala)
  }

  function comecarDemo() {
    p.bloqueio = null
    p.demoCursor = p.cursor
    irPara('demo', texto(p.passoAtual.demo, ctx()))
  }

  function concluirPasso(resultado, fala) {
    if (p.resultados[p.passo] !== 'feita') p.resultados[p.passo] = resultado
    p.eventos.push({ tipo: 'passo', indice: p.passo, resultado })
    if (resultado === 'feita') return irPara('acertou', fala)
    p.passoAtual.aoPular?.(mesa)
    proximoPasso()
  }

  function proximoPasso() {
    p.jogada = null
    const prox = p.resultados.findIndex((x, i) => !x && i > p.passo)
    const qualquer = prox >= 0 ? prox : p.resultados.findIndex((x) => !x)
    if (qualquer < 0) {
      p.bloqueio = null
      return irPara('concluida', p.resultados.every((x) => x === 'feita') ? texto(textos.concluida) : texto(textos.concluidaPulou))
    }
    p.passo = qualquer
    comecarPasso()
  }

  // retomando: os passos que já estavam resolvidos deixam a mesa como estaria (ex.: a energia do PASSAR)
  if (retomando) for (let i = 0; i < p.passo; i++) passos[i].aoPular?.(mesa)
  p.fala = p.falas[0]
  return p
}

// a cara do Ralsei: os eventos mandam por um instante (expressaoDoRalsei), depois a etapa
export function expressaoDasCartas(etapa, ultimo = null) {
  const base = expressaoDoRalsei(etapa === 'errou' || etapa === 'ajuda' ? 'tentarDeNovo' : etapa, ultimo)
  if (base !== 'feliz') return base
  if (etapa === 'demo') return 'concentrado'
  if (etapa === 'acertou' || etapa === 'atacando') return 'animado'
  return 'feliz'
}
