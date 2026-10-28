// Política do BUZZER do joystick serial: lógica pura, testada em Node (game/__tests__/buzzer.test.js).
// Quem manda a linha pela porta é lib/saida.js; aqui só se decide QUANDO apitar.
//
// O buzzer toca só em momentos pontuais, para o jogador afetado (nunca a cada golpe):
//   baixa(j, hp, hpMax)   HP abaixo de 25%: um apito, uma vez por luta por jogador (rearma se curar acima de 40%)
//   ko(j, hp)             HP chegou a 0 (de positivo): dois apitos, ~350 ms entre eles
//   golpeSuper(j)         levou golpe de SUPER: um apito
//   venceu(j)             fim da luta, jogador vencedor: um apito
//   reiniciar()           nova luta / voltou ao menu: esquece tudo
// Intervalo mínimo de 1 s por jogador entre apitos (eventos que se sobrepõem não empilham);
// o K.O. fura o intervalo (é raro e o aviso mais importante). O firmware toca 250 ms por "BUZZER".

export const LIMITE_HP_BAIXO = 0.25 // abaixo disto apita
export const LIMITE_REARME = 0.4 // curou acima disto: pode apitar de novo
export const INTERVALO_MIN = 1000 // ms por jogador
export const ESPACO_KO = 350 // ms entre os dois apitos do K.O.

// Uma linha BUZZER por joystick aberto: { jogador, aberta } de listarJoysticks()
export function linhasDeTeste(joysticks) {
  const jogadores = new Set()
  for (const j of joysticks) if (j.aberta && Number.isInteger(j.jogador)) jogadores.add(j.jogador)
  return [...jogadores].sort((a, b) => a - b).map((n) => `${n} BUZZER`)
}

export function criarBuzzer({ enviar, ativo = () => true, agora = () => performance.now(), agendar = (fn, ms) => setTimeout(fn, ms) }) {
  const ultimo = []
  const visto = []
  const avisado = []
  let epoca = 0 // invalida o segundo apito do K.O. se a luta acabou

  const linha = (j) => `${j + 1} BUZZER`
  const livre = (j) => agora() - (ultimo[j] ?? -Infinity) >= INTERVALO_MIN
  function apitar(j, { furar = false } = {}) {
    if (!ativo()) return false
    if (!furar && !livre(j)) return false
    ultimo[j] = agora()
    enviar(linha(j))
    return true
  }

  return {
    baixa(j, hp, hpMax) {
      if (!(hpMax > 0)) return
      if (hp > hpMax * LIMITE_REARME) avisado[j] = false
      if (avisado[j] === undefined) avisado[j] = hp < hpMax * LIMITE_HP_BAIXO // já começou baixo: sem aviso
      else if (!avisado[j] && hp > 0 && hp < hpMax * LIMITE_HP_BAIXO && apitar(j)) avisado[j] = true
    },
    ko(j, hp) {
      const antes = visto[j]
      visto[j] = hp
      if (!(antes > 0 && hp <= 0)) return
      if (!apitar(j, { furar: true })) return
      const minha = epoca
      agendar(() => {
        if (minha !== epoca || !ativo()) return
        ultimo[j] = agora()
        enviar(linha(j))
      }, ESPACO_KO)
    },
    golpeSuper(j) {
      apitar(j)
    },
    venceu(j) {
      apitar(j)
    },
    reiniciar() {
      epoca++
      ultimo.length = 0
      visto.length = 0
      avisado.length = 0
    },
  }
}
