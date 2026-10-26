// Controle físico (Gamepad API): lógica pura, testada em Node
// (__tests__/gamepad.test.js). Quem chama navigator.getGamepads() e manda as
// linhas JOY/BTN para o protocolo é lib/gamepad.js.
//
//   direcaoDoPad(pad, zonaMorta)        { x, y } de -100 a 100 (D-pad ou analógico esquerdo)
//   criarLeitorPads({ zonaMorta, botoes })
//     .atualizar(pads)                  lê todos os controles de uma vez e devolve os eventos:
//        { tipo: 'botao', pad, botao: 'A' | 'B' | 'C', indice }   botão do jogo (só na hora que aperta)
//        { tipo: 'apertou', pad, indice }                         qualquer botão físico apertado (ativa o controle, remapeia)
//        { tipo: 'joy', pad, x, y }                               direção mudou
//        { tipo: 'saiu', pad }                                    o controle sumiu (cabo puxado)
//   normalizarBotoes(pref('botoesPad'))  mapa { A: [...], B: [...], C: [...] } completo e válido
//   atribuirBotao(mapa, 'A', 5)          { mapa, tirada } ou { erro }, como atribuirTecla (teclas.js)
//   nomeBotao(9)                         'START'
//
// Mapa "standard" do navegador: 0 A (sul) · 1 B (leste) · 2 X · 3 Y · 4/5 LB/RB · 6/7 LT/RT ·
// 8 Select · 9 Start · 10/11 L3/R3 · 12-15 D-pad (cima, baixo, esquerda, direita).
// Controles fora do padrão (mapping vazio): os mesmos índices e, se houver 8 eixos ou mais,
// os eixos 6 e 7 como D-pad (o jeito de muitos controles genéricos no Linux); o que não
// bater, o jogador troca em CONFIGURAÇÕES.

export const ACOES_PAD = ['A', 'B', 'C']
export const ROTULO_PAD = { A: 'A · CONFIRMAR', B: 'B · VOLTAR', C: 'PAUSA' }

// A e X confirmam, B e Y voltam, Start pausa
export const BOTOES_PADRAO = { A: [0, 2], B: [1, 3], C: [9] }

export const ZONA_MORTA_PADRAO = 0.35
export const ZONA_MORTA_LIMITES = { min: 0.1, max: 0.8 }

// os botões do D-pad são direções, não dá para usá-los como A/B/C
const DPAD = { cima: 12, baixo: 13, esquerda: 14, direita: 15 }
const INDICES_DPAD = Object.values(DPAD)
const MAX_INDICE = 31
const LIMIAR_BOTAO = 0.5 // botões analógicos (gatilhos) contam como apertados passando da metade

export const zonaMortaValida = (v) => typeof v === 'number' && Number.isFinite(v) && v >= ZONA_MORTA_LIMITES.min && v <= ZONA_MORTA_LIMITES.max

const indiceValido = (i) => Number.isInteger(i) && i >= 0 && i <= MAX_INDICE && !INDICES_DPAD.includes(i)

export const copiarBotoes = (mapa) => Object.fromEntries(ACOES_PAD.map((a) => [a, [...mapa[a]]]))

// Problemas de um mapa de botões (lista vazia = válido)
export function problemasDosBotoes(mapa) {
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return ['não é um mapa']
  const problemas = []
  const dono = new Map()
  for (const a of ACOES_PAD) {
    const lista = mapa[a]
    if (!Array.isArray(lista) || lista.length === 0) {
      problemas.push(`${a}: sem botão`)
      continue
    }
    for (const i of lista) {
      if (!indiceValido(i)) problemas.push(`${a}: botão inválido ${i}`)
      else if (dono.has(i)) problemas.push(`${a}: botão ${i} repetido (já em ${dono.get(i)})`)
      else dono.set(i, a)
    }
  }
  return problemas
}

// O mapa salvo (ou null) -> mapa completo e válido; qualquer problema volta ao padrão
export function normalizarBotoes(salvo) {
  return salvo && problemasDosBotoes(salvo).length === 0 ? copiarBotoes(salvo) : copiarBotoes(BOTOES_PADRAO)
}

export const ehPadraoBotoes = (mapa) => JSON.stringify(copiarBotoes(mapa)) === JSON.stringify(BOTOES_PADRAO)

export function donoDoBotao(mapa, indice) {
  return ACOES_PAD.find((a) => mapa[a].includes(indice)) ?? null
}

// Põe `indice` como o (único) botão da ação. Se ele era de outra ação, sai de lá;
// se aquela ficar sem nenhum, ela fica com os antigos desta (troca). Devolve
//   { mapa, tirada: null } · { mapa, tirada: { acao, trocou } } · { mapa, igual: true } · { erro }
export function atribuirBotao(mapa, acao, indice) {
  if (!ACOES_PAD.includes(acao)) return { erro: 'ação desconhecida' }
  if (INDICES_DPAD.includes(indice)) return { erro: 'o D-pad só serve para as direções' }
  if (!indiceValido(indice)) return { erro: 'botão desconhecido' }
  const novo = copiarBotoes(mapa)
  const antigos = novo[acao]
  if (antigos.length === 1 && antigos[0] === indice) return { mapa: novo, igual: true }
  const outra = donoDoBotao(novo, indice)
  let tirada = null
  if (outra && outra !== acao) {
    const lista = novo[outra].filter((i) => i !== indice)
    const trocou = lista.length === 0
    novo[outra] = trocou ? antigos.filter((i) => i !== indice) : lista
    tirada = { acao: outra, trocou }
  }
  novo[acao] = [indice]
  return { mapa: novo, tirada }
}

const NOMES_PADRAO = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →', 'HOME']
export const nomeBotao = (i) => NOMES_PADRAO[i] ?? `BOTÃO ${i}`
export const resumoBotoes = (lista) => lista.map(nomeBotao)

// ---------- leitura de um controle ----------

const apertado = (b) => Boolean(b && (b.pressed || (typeof b.value === 'number' && b.value > LIMIAR_BOTAO)))
const numero = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

// Direção do controle, -100..100 por eixo. O D-pad vale mais que o analógico.
// O analógico tem zona morta circular: dentro dela é 0 e, fora, o valor recomeça do
// zero na borda dela (não dá "tranco" ao sair do centro).
export function direcaoDoPad(pad, zonaMorta = ZONA_MORTA_PADRAO) {
  const b = pad?.buttons ?? []
  const eixos = pad?.axes ?? []
  let x = (apertado(b[DPAD.direita]) ? 1 : 0) - (apertado(b[DPAD.esquerda]) ? 1 : 0)
  let y = (apertado(b[DPAD.baixo]) ? 1 : 0) - (apertado(b[DPAD.cima]) ? 1 : 0)
  if (!x && !y && pad?.mapping !== 'standard' && eixos.length >= 8) {
    x = Math.sign(Math.round(numero(eixos[6])))
    y = Math.sign(Math.round(numero(eixos[7])))
  }
  if (x || y) return { x: x * 100, y: y * 100 }

  const ax = numero(eixos[0])
  const ay = numero(eixos[1])
  const m = Math.hypot(ax, ay)
  const zona = zonaMortaValida(zonaMorta) ? zonaMorta : ZONA_MORTA_PADRAO
  if (m <= zona) return { x: 0, y: 0 }
  const forca = Math.min(1, (m - zona) / (1 - zona))
  const limita = (v) => Math.max(-100, Math.min(100, Math.round((v / m) * forca * 100)))
  return { x: limita(ax), y: limita(ay) }
}

// Chave de um controle: o mesmo aparelho religado costuma voltar com o mesmo id e índice
export const chaveDoPad = (pad) => `${pad.id ?? '?'}#${pad.index ?? 0}`

// Lê vários controles por quadro e transforma o estado em eventos. Guarda o que já
// estava apertado (para só avisar na hora que aperta) e a última direção.
export function criarLeitorPads({ zonaMorta = () => ZONA_MORTA_PADRAO, botoes = () => BOTOES_PADRAO } = {}) {
  const estados = new Map() // índice -> { apertados: Set, x, y }

  return {
    atualizar(pads) {
      const eventos = []
      const vistos = new Set()
      for (const pad of pads ?? []) {
        if (!pad || pad.connected === false) continue
        vistos.add(pad.index)
        let e = estados.get(pad.index)
        if (!e) estados.set(pad.index, (e = { apertados: new Set(), x: 0, y: 0 }))

        const agora = new Set()
        ;(pad.buttons ?? []).forEach((b, i) => apertado(b) && agora.add(i))
        const mapa = botoes()
        for (const i of agora) {
          if (e.apertados.has(i)) continue
          eventos.push({ tipo: 'apertou', pad: pad.index, indice: i })
          const botao = ACOES_PAD.find((a) => mapa[a]?.includes(i))
          if (botao) eventos.push({ tipo: 'botao', pad: pad.index, botao, indice: i })
        }
        e.apertados = agora

        const { x, y } = direcaoDoPad(pad, zonaMorta())
        if (x !== e.x || y !== e.y) {
          e.x = x
          e.y = y
          eventos.push({ tipo: 'joy', pad: pad.index, x, y })
        }
      }
      for (const [indice, e] of estados) {
        if (vistos.has(indice)) continue
        estados.delete(indice)
        eventos.push({ tipo: 'saiu', pad: indice, estavaMexendo: e.x !== 0 || e.y !== 0 })
      }
      return eventos
    },

    // zera a direção de todos (perdeu o foco: nada fica "preso"); o que está apertado continua contando como apertado
    soltarTudo() {
      const eventos = []
      for (const [indice, e] of estados) {
        if (e.x || e.y) eventos.push({ tipo: 'joy', pad: indice, x: 0, y: 0 })
        e.x = e.y = 0
      }
      return eventos
    },
  }
}
