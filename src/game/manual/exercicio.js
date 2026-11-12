import { CORACAO } from '../constants.js'
import { criarOnda, moverCoracao } from './onda.js'
import { pilotoDeDesvio } from './padroes.js'
import { expressaoDoRalsei } from './ralsei.js'
import { resultadosValidos } from './licaoDeCartas.js'

// A máquina de estados das páginas EXTRAS do Manual do Ralsei (7, 8 e 9: graze, jogar em dupla, ases/SUPER/
// perfeitos), SEM Phaser (testada em __tests__/exercicio.test.js e nas pagina7/8/9.test.js). Cada página só
// diz os passos e as falas (manual/pagina7.js ...); a cena (scenes/ManualRalsei7.js) desenha e repassa os
// joysticks, o botão A e os toques de direção. Os passos são de dois tipos:
//
//   'desafio'  corações na caixa, uma onda de balas e uma meta (raspar N balas, desviar juntos, carregar energia):
//              explicar -> preparar -> tentar -> (errou -> preparar)* -> acertou
//   'escolha'  uma mão de cartas: ←/→ anda, A confirma (jogar o ★, descobrir o Ás certo):
//              explicar -> escolher -> (errou -> escolher)* -> (disparando)? -> acertou
//
//   intro -> [ passo ] x N -> concluida -> virando -> fim
//                  3 erros no mesmo passo: ajuda (tentar de novo | pular esta parte)
//
// Um passo 'desafio':
//   { id, titulo, tipo: 'desafio', explicar, tentar, errou: [falas], errouTempo?, acertou (texto | fn(ctx)),
//     duracao,                         ms; passou disto sem a meta: 'tempo' (conta como erro)
//     preparo?,                        ms de "sua vez!" antes das balas (PREPARO_MS)
//     iniciar(ctx) -> t,               a tentativa: { alvos: [{ id, x, y, hitbox, graze, ativo, humano | cpu }],
//                                        roteiro: { gerar(ms, alvo) } | null, hud: {...}, ... }
//     aoPassar(t, r, p) -> 'vitoria' | 'derrota' | undefined   depois de cada quadro; r = { acertos, grazes }
//     piloto?(alvo, t, p) -> joy       o coração da CPU aliada (padrão: o piloto de desvio da página 2)
//     fimDoTempo?(t, p)                o que vale quando acaba a duracao (padrão: 'derrota')
//     aoPular?(p) }
// Um passo 'escolha':
//   { id, titulo, tipo: 'escolha', explicar, instrucao, slots: [ids], preparar?(p), avaliar(id, ctx) -> { certo, fala,
//     disparar?, falaAcao? }, acertou?, aoPular?(p) }
//
//   ctx = { p, t, mesa, humanos }
//
// Progresso: p.resultados[i] é null | 'feita' | 'pulada'; os eventos { tipo: 'passo', indice, resultado } e
// { tipo: 'etapa', etapa: 'concluida' } dizem à cena o que salvar (manual/progresso.js).

export const ETAPAS_EXERCICIO = ['intro', 'explicar', 'preparar', 'tentar', 'errou', 'ajuda', 'escolher', 'disparando', 'acertou', 'concluida', 'virando', 'fim']
export const PREPARO_MS = 1100
export const RETRY_MS = 1500
export const ACERTOU_MS = 2600
export const DISPARO_MS = 2700
export const ERROS_PARA_AJUDA = 3
export const OPCOES_AJUDA = ['tentar de novo', 'pular esta parte']
export const FALA_AJUDA = 'Tudo bem errar! Quer tentar de novo ou pular esta parte?'
export const FALA_VOLTA = 'Que bom que você voltou! Vamos continuar de onde paramos.'

const texto = (t, ctx) => (typeof t === 'function' ? t(ctx) : t ?? '')
const PARADO = { x: 0, y: 0 }

// um coração novo no formato das regras reais (hitbox e anel de graze do jogo)
export const coracaoNovo = (id, x, y, extra = {}) => ({ id, x, y, hitbox: CORACAO.hitbox, graze: CORACAO.graze, ativo: true, caido: false, ...extra })

//   op.caixa, op.velocidade, op.hitbox
//   op.passos      os passos (acima) · op.falasIntro · op.textos { concluida, concluidaPulou, fim }
//   op.salvos      o progresso salvo (retoma no primeiro passo que falta)
//   op.humanos     quantas pessoas movem corações (1 ou 2): decide se o parceiro é gente ou a CPU aliada
export function criarExercicio({ caixa, velocidade = CORACAO.velocidadePadrao, hitbox = CORACAO.hitbox, passos, falasIntro, textos, salvos = null, humanos = 1 }) {
  const salvas = resultadosValidos(salvos, passos.length)
  const retomando = salvas.some(Boolean) && salvas.some((x) => !x)
  const p = {
    caixa,
    velocidade,
    hitbox,
    humanos: humanos >= 2 ? 2 : 1,
    passos,
    etapa: 'intro',
    falas: retomando ? [FALA_VOLTA] : falasIntro,
    falaIdx: 0,
    fala: '',
    tempoEtapa: 0,
    passo: retomando ? salvas.findIndex((x) => !x) : 0,
    resultados: retomando ? salvas : passos.map(() => null),
    falhas: passos.map(() => 0),
    tent: null, // a tentativa de um desafio
    mesa: null, // a mesa de cartas de um passo de escolha (e de desafios que gastam energia)
    cursor: 0,
    opcao: 0,
    pendente: null,
    jogada: null,
    ultimoMotivo: null,
    eventos: [],

    get passoAtual() {
      return passos[p.passo]
    },
    get slots() {
      return p.passoAtual.slots ?? []
    },
    get adesivos() {
      return p.resultados.filter((x) => x === 'feita').length
    },
    get completa() {
      return p.resultados.every(Boolean)
    },
    // os corações em cena (vazio fora de um desafio)
    get alvos() {
      return p.tent?.alvos ?? []
    },
    get balas() {
      return p.tent?.onda.lista ?? []
    },
    get hud() {
      return p.tent?.hud ?? null
    },
    // a energia que as gemas mostram (a do desafio em andamento, ou a da mesa de cartas)
    get energiaNaTela() {
      if (p.tent?.hud?.energia !== undefined) return p.tent.hud.energia
      return p.mesa ? p.mesa.energia : null
    },
    get progressoDaTentativa() {
      const t = p.tent
      if (!t || !Number.isFinite(t.duracao ?? p.passoAtual.duracao)) return 0
      return p.etapa === 'tentar' ? Math.min(1, t.tempo / (t.duracao ?? p.passoAtual.duracao)) : p.etapa === 'acertou' ? 1 : 0
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
        case 'explicar':
          if (p.passoAtual.tipo === 'escolha') comecarEscolha()
          else comecarTentativa()
          return true
        case 'escolher':
          confirmar(p.cursor)
          return true
        case 'errou':
          recomecar()
          return true
        case 'ajuda':
          if (p.opcao === 0) recomecar()
          else concluirPasso('pulada')
          return true
        case 'acertou':
          proximoPasso()
          return true
        case 'concluida':
          irPara('virando')
          return true
        default:
          return false
      }
    },

    // direção de um toque: 'esquerda' | 'direita' (escolher) · 'cima' | 'baixo' (ajuda)
    mover(direcao) {
      if (p.etapa === 'escolher' && (direcao === 'esquerda' || direcao === 'direita')) {
        const novo = Math.max(0, Math.min(p.slots.length - 1, p.cursor + (direcao === 'direita' ? 1 : -1)))
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

    // dt em ms; joys = o joystick de cada pessoa (-100..100), na ordem dos corações humanos
    tick(dt, joys = []) {
      dt = Math.min(Math.max(dt, 0), 50)
      p.tempoEtapa += dt
      switch (p.etapa) {
        case 'preparar':
          moverTodos(dt, joys)
          if (p.tempoEtapa >= (p.passoAtual.preparo ?? PREPARO_MS)) irPara('tentar')
          break
        case 'tentar':
          jogarTentativa(dt, joys)
          break
        case 'errou':
          if (p.tempoEtapa >= RETRY_MS) recomecar()
          break
        case 'disparando':
          if (p.tempoEtapa >= DISPARO_MS) concluirPasso('feita', texto(p.pendente.fala, ctx()))
          break
        case 'acertou':
          if (p.tempoEtapa >= ACERTOU_MS) proximoPasso()
          break
        default:
      }
    },

    drenar() {
      const e = p.eventos
      p.eventos = []
      return e
    },
  }

  const ctx = () => ({ p, t: p.tent, mesa: p.mesa, humanos: p.humanos })

  function irPara(etapa, fala) {
    p.etapa = etapa
    p.tempoEtapa = 0
    if (fala !== undefined) p.fala = fala
    p.eventos.push({ tipo: 'etapa', etapa })
  }

  function comecarPasso() {
    p.tent = null
    p.mesa = null
    p.jogada = null
    // um desafio já mostra os corações (parados) enquanto o Ralsei explica: é a tentativa, ainda sem andar
    if (p.passoAtual.tipo !== 'escolha') montarTentativa()
    else p.passoAtual.preparar?.(p) // a mesa de cartas já aparece enquanto o Ralsei explica
    irPara('explicar', texto(p.passoAtual.explicar, ctx()))
  }

  // ---------- desafios ----------

  // monta a tentativa do desafio atual (corações, onda, roteiro, mesa) e a deixa em p.tent
  function montarTentativa() {
    const passo = p.passoAtual
    const t = passo.iniciar({ caixa, p, tentativa: p.falhas[p.passo] + 1, humanos: p.humanos })
    t.onda = criarOnda(caixa)
    t.tempo = 0
    t.duracao = t.duracao ?? passo.duracao
    t.hud = t.hud ?? {}
    t.alvos.forEach((a, i) => Object.assign(a, { hitbox: a.hitbox ?? p.hitbox, graze: a.graze ?? CORACAO.graze, ativo: a.ativo ?? true, caido: false, id: a.id ?? i }))
    let r = 0
    // o alvo da próxima mira: reveza entre os corações de pé
    t.proximaMira = () => {
      const vivos = t.alvos.filter((a) => a.ativo)
      return vivos.length ? vivos[r++ % vivos.length] : t.alvos[0]
    }
    p.tent = t
    p.mesa = t.mesa ?? null
  }

  function comecarTentativa() {
    p.jogada = null
    montarTentativa()
    irPara('preparar', texto(p.passoAtual.tentar, ctx()))
  }

  function moverTodos(dt, joys) {
    const t = p.tent
    for (const a of t.alvos) {
      if (!a.ativo) continue
      const joy = a.cpu ? (p.passoAtual.piloto?.(a, t, p) ?? pilotoDeDesvio(t.onda.lista, a, caixa, velocidade, { hitbox: a.hitbox })) : (joys[a.humano ?? 0] ?? PARADO)
      moverCoracao(a, joy, velocidade, dt, caixa)
    }
  }

  function jogarTentativa(dt, joys) {
    const passo = p.passoAtual
    const t = p.tent
    t.tempo += dt
    moverTodos(dt, joys)
    if (t.roteiro) for (const o of t.roteiro.gerar(t.tempo, t.proximaMira())) t.onda.bala(o)
    const r = t.onda.passoMulti(dt, t.alvos)
    for (const g of r.grazes) p.eventos.push({ tipo: 'graze', indice: g.alvo.id })
    for (const a of r.acertos) p.eventos.push({ tipo: 'acerto', indice: a.alvo.id })
    let res = passo.aoPassar ? passo.aoPassar(t, r, p) : r.acertos.length ? 'derrota' : undefined
    if (!res && t.tempo >= t.duracao) res = passo.fimDoTempo ? passo.fimDoTempo(t, p) : 'tempo'
    if (res === 'vitoria') {
      t.onda.limpar()
      concluirPasso('feita', texto(passo.acertou, ctx()))
    } else if (res) errar(res === 'tempo' ? texto(passo.errouTempo ?? passo.errou[0], ctx()) : null)
  }

  // ---------- escolhas ----------

  function comecarEscolha() {
    const passo = p.passoAtual
    p.cursor = 0
    p.jogada = null
    irPara('escolher', texto(passo.instrucao, ctx()))
  }

  function confirmar(slot) {
    const passo = p.passoAtual
    const id = p.slots[slot]
    const r = passo.avaliar(id, ctx())
    p.eventos.push({ tipo: 'escolheu', slot, certo: Boolean(r.certo) })
    if (!r.certo) return errar(texto(r.fala, ctx()))
    if (r.disparar) {
      const j = p.mesa.jogar(id)
      if (!j.ok) throw new Error(`passo ${passo.id}: "${id}" não pode ser jogada (${j.bloqueio.motivo})`)
      p.jogada = { slot, ...j }
      p.pendente = r
      p.eventos.push({ tipo: 'jogou', slot, carta: j.carta, gasto: j.gasto })
      return irPara('disparando', texto(r.falaAcao, ctx()) || p.fala)
    }
    concluirPasso('feita', texto(r.fala, ctx()))
  }

  // ---------- erros, ajuda e passos ----------

  function errar(fala) {
    const passo = p.passoAtual
    p.falhas[p.passo]++
    p.eventos.push({ tipo: 'erro', falhas: p.falhas[p.passo] })
    if (p.falhas[p.passo] >= ERROS_PARA_AJUDA) {
      p.opcao = 0
      return irPara('ajuda', FALA_AJUDA)
    }
    const lista = passo.errou ?? []
    irPara('errou', fala || (lista.length ? lista[(p.falhas[p.passo] - 1) % lista.length] : ''))
  }

  // depois de um erro (ou de "tentar de novo" na ajuda): o mesmo passo, do começo
  function recomecar() {
    if (p.passoAtual.tipo === 'escolha') comecarEscolha()
    else comecarTentativa()
  }

  function concluirPasso(resultado, fala) {
    if (p.resultados[p.passo] !== 'feita') p.resultados[p.passo] = resultado
    p.eventos.push({ tipo: 'passo', indice: p.passo, resultado })
    p.tent?.onda?.limpar()
    if (resultado === 'feita') return irPara('acertou', fala)
    p.passoAtual.aoPular?.(p)
    proximoPasso()
  }

  function proximoPasso() {
    p.jogada = null
    const prox = p.resultados.findIndex((x, i) => !x && i > p.passo)
    const qualquer = prox >= 0 ? prox : p.resultados.findIndex((x) => !x)
    if (qualquer < 0) {
      p.tent = null
      return irPara('concluida', p.resultados.every((x) => x === 'feita') ? texto(textos.concluida) : texto(textos.concluidaPulou))
    }
    p.passo = qualquer
    comecarPasso()
  }

  p.fala = p.falas[0]
  return p
}

// a cara do Ralsei: os eventos mandam por um instante (expressaoDoRalsei), depois a etapa
export function expressaoDoExercicio(etapa, ultimo = null) {
  const base = expressaoDoRalsei(etapa === 'errou' || etapa === 'ajuda' ? 'tentarDeNovo' : etapa, ultimo)
  if (base !== 'feliz') return base
  if (etapa === 'acertou' || etapa === 'disparando') return 'animado'
  if (etapa === 'tentar' || etapa === 'preparar') return 'concentrado'
  return 'feliz'
}
