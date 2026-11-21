// CONTROLES NA TELA (celular / tablet): a lógica pura da fonte "toque", testada em Node
// (__tests__/toque.test.js). Quem desenha os controles e ouve os dedos é
// ui/ControlesToque.svelte (via lib/toque.js); aqui só tem conta e estado.
//
//   joystickDoToque(origem, ponto, { raio, zonaMorta })
//        { x, y } de -100 a 100: analógico, com zona morta circular (a força recomeça do zero na borda
//        dela, como o analógico do controle em gamepad.js) e chegando a 100 um pouco antes da borda
//        (ALCANCE), para o dedo não precisar ir até o fim. A diagonal sai inteira (|v| <= 100, suave)
//   arrastarBase(origem, ponto, raio)   o joystick FLUTUANTE: o dedo passou da borda, a base vem junto
//   direcaoDigital(x, y, anterior, { limiar })
//        'cima' | 'baixo' | 'esquerda' | 'direita' | null para os MENUS, com histerese: perto da
//        diagonal a direção não fica pulando entre dois eixos, e só solta bem abaixo do limiar
//   criarRepetidor({ espera, intervalo })
//        .passo(direcao, agora)   a direção a "apertar" neste quadro (ou null): na hora que muda e,
//                                 segurando, de novo depois de `espera` ms e a cada `intervalo` ms
//   criarToque({ enviar, vibrar, raio, zonaMorta })   os dedos (multitoque) -> linhas do protocolo
//        .apertar(id, alvo, x, y, agora)   alvo: 'joystick' | 'A' | 'B' | 'C'   (id = pointerId do dedo)
//        .mover(id, x, y)  .soltar(id, agora) -> { tocou }  .soltarTudo()
//        .estado()   { joystick: { origem, ponto, x, y } | null, botoes: Set }  (para desenhar)
//        .segurando()   o joystick está inclinado (os menus repetem a direção: game/controles.js)
//      enviar(linha): 'JOY 1 x y' / 'BTN 1 A' (lib/protocolo.js). O toque é sempre o jogador 1.

export const RAIO_PADRAO = 56 // px CSS do joystick (vezes o TAMANHO de CONFIGURAÇÕES)
export const ZONA_MORTA_TOQUE = 0.14
export const ALCANCE = 0.85 // a 85% do raio já é 100
export const LIMIAR_MENU = 50 // o mesmo de game/controles.js
export const TOQUE_RAPIDO_MS = 450 // dedo que encosta e sai sem inclinar: vale como toque na tela
export const REPETIR_MENU = { espera: 450, intervalo: 120 }

// Opções da tela de CONFIGURAÇÕES (aba TOQUE), validadas em preferencias.js
export const MODOS_TOQUE = ['auto', 'sempre', 'escondido']
export const TAMANHO_TOQUE = { min: 0.7, max: 1.5, padrao: 1 }
export const OPACIDADE_TOQUE = { min: 0.2, max: 0.9, padrao: 0.55 }
export const tamanhoToqueValido = (v) => typeof v === 'number' && Number.isFinite(v) && v >= TAMANHO_TOQUE.min - 1e-9 && v <= TAMANHO_TOQUE.max + 1e-9
export const opacidadeToqueValida = (v) => typeof v === 'number' && Number.isFinite(v) && v >= OPACIDADE_TOQUE.min - 1e-9 && v <= OPACIDADE_TOQUE.max + 1e-9

const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

export function joystickDoToque(origem, ponto, { raio = RAIO_PADRAO, zonaMorta = ZONA_MORTA_TOQUE } = {}) {
  const dx = num(ponto?.x) - num(origem?.x)
  const dy = num(ponto?.y) - num(origem?.y)
  const d = Math.hypot(dx, dy)
  const zona = raio * zonaMorta
  if (!(raio > 0) || d <= zona) return { x: 0, y: 0 }
  const forca = Math.min(1, (d - zona) / (raio * ALCANCE - zona))
  const eixo = (v) => {
    const r = Math.round((v / d) * forca * 100)
    return r === 0 ? 0 : Math.max(-100, Math.min(100, r)) // sem -0
  }
  return { x: eixo(dx), y: eixo(dy) }
}

export function arrastarBase(origem, ponto, raio = RAIO_PADRAO) {
  const dx = ponto.x - origem.x
  const dy = ponto.y - origem.y
  const d = Math.hypot(dx, dy)
  if (d <= raio) return origem
  const k = (d - raio) / d
  return { x: origem.x + dx * k, y: origem.y + dy * k }
}

const EIXO = { esquerda: 'x', direita: 'x', cima: 'y', baixo: 'y' }
const SINAL = { esquerda: -1, direita: 1, cima: -1, baixo: 1 }

function dominante(x, y) {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'direita' : 'esquerda'
  return y > 0 ? 'baixo' : 'cima'
}

export function direcaoDigital(x, y, anterior = null, { limiar = LIMIAR_MENU } = {}) {
  const v = { x: num(x), y: num(y) }
  if (anterior && EIXO[anterior]) {
    const meu = v[EIXO[anterior]] * SINAL[anterior]
    // continua segurando: só solta bem abaixo do limiar (60%)
    if (meu >= limiar * 0.6) {
      const outro = Math.abs(v[EIXO[anterior] === 'x' ? 'y' : 'x'])
      // troca de eixo só se o outro passou com folga (25%) e passou do limiar
      if (outro >= limiar && outro > meu * 1.25) return dominante(v.x, v.y)
      return anterior
    }
  }
  if (Math.max(Math.abs(v.x), Math.abs(v.y)) < limiar) return null
  return dominante(v.x, v.y)
}

export function criarRepetidor({ espera = REPETIR_MENU.espera, intervalo = REPETIR_MENU.intervalo } = {}) {
  let atual = null
  let proximo = 0
  return {
    passo(direcao, agora) {
      if (direcao !== atual) {
        atual = direcao
        proximo = agora + espera
        return direcao
      }
      if (!direcao || agora < proximo) return null
      proximo += intervalo
      if (proximo <= agora) proximo = agora + intervalo // quadro muito longo: não dispara em rajada
      return direcao
    },
    zerar() {
      atual = null
    },
  }
}

export function criarToque({ enviar = () => {}, vibrar = () => {}, raio = () => RAIO_PADRAO, zonaMorta = ZONA_MORTA_TOQUE } = {}) {
  let stick = null // { id, origem, ponto, x, y, direcao }
  const botoes = new Map() // id do dedo -> 'A' | 'B' | 'C'
  let ultimoJoy = 'JOY 1 0 0'

  const mandarJoy = (x, y) => {
    const linha = `JOY 1 ${x} ${y}`
    if (linha === ultimoJoy) return
    ultimoJoy = linha
    enviar(linha)
  }

  const atualizarStick = () => {
    const r = raio()
    stick.origem = arrastarBase(stick.origem, stick.ponto, r)
    const { x, y } = joystickDoToque(stick.origem, stick.ponto, { raio: r, zonaMorta })
    stick.x = x
    stick.y = y
    if (x || y) stick.inclinou = true
    const direcao = direcaoDigital(x, y, stick.direcao)
    if (direcao && direcao !== stick.direcao) vibrar('direcao')
    stick.direcao = direcao
    mandarJoy(x, y)
  }

  return {
    apertar(id, alvo, x, y, agora = 0) {
      if (alvo === 'joystick') {
        if (stick) return false // um dedo só no joystick: o segundo não rouba
        stick = { id, origem: { x, y }, ponto: { x, y }, x: 0, y: 0, direcao: null, inicio: agora, inclinou: false }
        return true
      }
      if (alvo !== 'A' && alvo !== 'B' && alvo !== 'C') return false
      if ([...botoes.values()].includes(alvo)) {
        botoes.set(id, alvo) // outro dedo no mesmo botão: não aperta de novo
        return true
      }
      botoes.set(id, alvo)
      vibrar('botao')
      enviar(`BTN 1 ${alvo}`)
      return true
    },
    mover(id, x, y) {
      if (!stick || stick.id !== id) return
      stick.ponto = { x, y }
      atualizarStick()
    },
    // devolve { tocou: true } quando o dedo do joystick só tocou e saiu (rápido, sem inclinar):
    // lib/toque.js repassa esse toque à tela (escolher uma opção do menu tocando nela)
    soltar(id, agora = 0) {
      botoes.delete(id)
      if (stick?.id !== id) return { tocou: false }
      const tocou = !stick.inclinou && agora - stick.inicio <= TOQUE_RAPIDO_MS
      stick = null
      mandarJoy(0, 0)
      return { tocou }
    },
    soltarTudo() {
      botoes.clear()
      stick = null
      mandarJoy(0, 0)
    },
    estado() {
      return {
        joystick: stick && { origem: { ...stick.origem }, ponto: { ...stick.ponto }, x: stick.x, y: stick.y },
        botoes: new Set(botoes.values()),
      }
    },
    segurando: () => Boolean(stick && (stick.x || stick.y)),
  }
}
