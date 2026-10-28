// Vibração (rumble) do controle físico: lógica pura, testada em Node
// (__tests__/vibracao.test.js). Quem acha os controles no navegador e liga isto
// ao BUZZER/VIDA do joystick serial é lib/vibracao.js.
//
//   criarVibracao({ alvos, ativa, intensidade, agora, agendar, cancelar })
//     alvos(vaga)       lista de objetos Gamepad do jogador `vaga` (0 = jogador 1)
//     ativa()           preferência "vibração" ligada?
//     intensidade()     0 a 1 (fator que multiplica toda a força)
//     .vibrar(vaga, 'golpe' | 'ko' | 'dupla')   quantos controles receberam o efeito
//     .testar(pad)      'ok' | 'sem-atuador' (ignora o liga/desliga, usa a intensidade)
//     .parar()          cancela os efeitos em andamento (pausa, janela sem foco, menu)
//     .bloquear(sim)    true: nada vibra (partida pausada); também para o que estiver tocando
//   padraoDe(evento, intensidade)   passos [{ atraso, duracao, forte, fraca }] já escalados
//   intensidadeEfetiva(prefs)       a intensidade que vale (a escolhida, ou a automática)
//
// API do navegador: Chrome/Edge têm gamepad.vibrationActuator.playEffect('dual-rumble', ...);
// há também gamepad.hapticActuators[0].pulse(valor, ms) (Firefox antigo). Sem nenhum dos dois
// (Safari, boa parte do Firefox, controles sem motor) nada acontece e nada dá erro.

export const INTENSIDADES = [0.25, 0.5, 0.75, 1]
export const INTENSIDADE_PADRAO = 0.75
// quem já reduz tremor ("reduzir tremor" ou "reduzir animações") começa com a vibração mais fraca
export const INTENSIDADE_REDUZIDA = 0.25
export const INTERVALO_GOLPE = 250 // ms por jogador: vários tiros juntos vibram uma vez só (como o BUZZER)

export const intensidadeValida = (v) => v === null || INTENSIDADES.includes(v)

export function intensidadeEfetiva({ vibracaoIntensidade = null, tremor = 'normal', reduzirMovimento = false } = {}) {
  if (INTENSIDADES.includes(vibracaoIntensidade)) return vibracaoIntensidade
  return tremor !== 'normal' || reduzirMovimento ? INTENSIDADE_REDUZIDA : INTENSIDADE_PADRAO
}

// força de cada motor vai de 0 a 1: forte = motor grave, fraca = motor agudo
export const PADROES = {
  golpe: [{ atraso: 0, duracao: 120, forte: 0.5, fraca: 0.7 }], // levou um acerto
  ko: [{ atraso: 0, duracao: 400, forte: 1, fraca: 0.5 }], // caiu / foi eliminado
  dupla: [
    { atraso: 0, duracao: 90, forte: 0.6, fraca: 0.8 },
    { atraso: 180, duracao: 90, forte: 0.6, fraca: 0.8 },
  ], // momento grande (super, vitória) e o teste
}

const limitar = (v) => Math.min(1, Math.max(0, v))

export function padraoDe(evento, intensidade = INTENSIDADE_PADRAO) {
  const base = PADROES[evento]
  if (!base) return []
  const k = limitar(intensidade)
  return base.map((p) => ({ ...p, forte: limitar(p.forte * k), fraca: limitar(p.fraca * k) }))
}

export function atuadorDe(pad) {
  if (pad?.vibrationActuator && typeof pad.vibrationActuator.playEffect === 'function') return { tipo: 'efeito', a: pad.vibrationActuator }
  const h = pad?.hapticActuators?.[0]
  if (h && typeof h.pulse === 'function') return { tipo: 'pulso', a: h }
  return null
}

export const temAtuador = (pad) => atuadorDe(pad) !== null

// um passo num controle; nunca lança (o navegador pode recusar, ex.: aba em segundo plano)
function tocar(pad, passo) {
  const at = atuadorDe(pad)
  if (!at) return false
  try {
    let r
    if (at.tipo === 'efeito') {
      r = at.a.playEffect(at.a.type ?? 'dual-rumble', {
        startDelay: 0,
        duration: passo.duracao,
        strongMagnitude: passo.forte,
        weakMagnitude: passo.fraca,
      })
    } else {
      r = at.a.pulse(Math.max(passo.forte, passo.fraca), passo.duracao)
    }
    r?.catch?.(() => {})
    return true
  } catch {
    return false
  }
}

function parar(pad) {
  try {
    const r = pad?.vibrationActuator?.reset?.()
    r?.catch?.(() => {})
  } catch {}
}

export function criarVibracao({
  alvos = () => [],
  ativa = () => true,
  intensidade = () => INTENSIDADE_PADRAO,
  agora = () => Date.now(),
  agendar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (id) => clearTimeout(id),
} = {}) {
  const ultimoGolpe = []
  let timers = new Set()
  let tocando = new Set() // controles que receberam algo desde o último parar()
  let bloqueado = false

  function pararTudo() {
    for (const id of timers) cancelar(id)
    timers = new Set()
    for (const pad of tocando) parar(pad)
    tocando = new Set()
  }

  function reproduzir(pads, evento, forcar = false) {
    const passos = padraoDe(evento, intensidade())
    let n = 0
    for (const pad of pads) {
      if (!temAtuador(pad)) continue
      n++
      tocando.add(pad)
      for (const passo of passos) {
        if (passo.atraso <= 0) tocar(pad, passo)
        else {
          const id = agendar(() => {
            timers.delete(id)
            if (forcar || !bloqueado) tocar(pad, passo)
          }, passo.atraso)
          timers.add(id)
        }
      }
    }
    return n
  }

  return {
    vibrar(vaga, evento) {
      if (bloqueado || !ativa() || !(intensidade() > 0) || !PADROES[evento]) return 0
      if (evento === 'golpe') {
        const t = agora()
        if (t - (ultimoGolpe[vaga] ?? -Infinity) < INTERVALO_GOLPE) return 0
        ultimoGolpe[vaga] = t
      }
      return reproduzir(alvos(vaga) ?? [], evento)
    },
    testar(pad) {
      if (!temAtuador(pad)) return 'sem-atuador'
      reproduzir([pad], 'dupla', true) // o teste vale até com a Pausa aberta (CONFIGURAÇÕES vem dela)
      return 'ok'
    },
    parar: pararTudo,
    bloquear(sim) {
      bloqueado = Boolean(sim)
      if (bloqueado) pararTudo()
    },
    get bloqueado() {
      return bloqueado
    },
  }
}
