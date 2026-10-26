import { processarLinha } from './protocolo.js'
import { definirFonte, MAX_JOGADORES } from './estado.js'
import { pref } from '../game/preferencias.js'
import { criarLeitorPads, normalizarBotoes, chaveDoPad } from '../game/gamepad.js'
import { criarAtribuidor } from '../game/fontes.js'

// Controle físico (Gamepad API) entrando pelo mesmo protocolo do joystick serial e
// do teclado: cada quadro lê navigator.getGamepads() e manda linhas JOY / BTN para
// protocolo.js. A lógica de ler botões e eixos está em game/gamepad.js (testada em
// Node); aqui só tem o que depende do navegador.
//
//   const parar = iniciarGamepads({ aviso, aoPerder })
//     aviso({ id, tipo, titulo, texto, ms })   toast ("controle conectado / jogador 1")
//     aoPerder(motivo)                         um controle sumiu no meio do jogo (a partida local pausa)
//   capturarBotaoPad(fn)                       remapear (CONFIGURAÇÕES): fn(indice) com o próximo botão apertado
//                                              de qualquer controle; nada chega ao jogo enquanto espera
//   controlesLigados()                         [{ pad, vaga, id }] dos controles em uso
//
// Quem liga: o primeiro botão apertado num controle (o Chrome só mostra o controle
// à página depois de um botão; o Firefox já avisa ao plugar). Mexer só o analógico
// não liga (analógico solto costuma "vazar" sozinho). O primeiro A/B/Start que
// acorda os controles não vale como aperto (senão escolheria a 1ª opção do menu sem
// ninguém ter visto a tela); as direções valem na hora.
//
// Vagas: o primeiro controle a apertar é o jogador 1, o segundo é o 2 (game/fontes.js).
// Ao religar, o mesmo controle (mesmo id e índice) volta na mesma vaga. Em modo 1
// jogador (ou numa sala online) o jogo manda todos os controles para o mesmo lado
// (game/controles.js).

const atribuidor = criarAtribuidor({ vagas: MAX_JOGADORES })
const leitor = criarLeitorPads({ zonaMorta: () => pref('zonaMorta'), botoes: () => normalizarBotoes(pref('botoesPad')) })

const ativos = new Map() // índice do controle -> { chave, vaga }
const direcoes = new Map() // índice do controle -> { x, y } (de todos, ligados ou não)
const ultimoJoy = []
let captura = null

export const controlesLigados = () => [...ativos].map(([pad, a]) => ({ pad, vaga: a.vaga, chave: a.chave }))

export function capturarBotaoPad(fn) {
  captura = fn
  // o que estava segurando antes de pedir não conta como o botão novo
  return () => {
    if (captura === fn) captura = null
  }
}

const lerPads = () => {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter(Boolean)
  } catch {
    return []
  }
}

// manda JOY de cada vaga: o controle que mais inclina manda (dois no mesmo lado não brigam)
function enviarDirecoes() {
  for (let v = 0; v < MAX_JOGADORES; v++) {
    let melhor = { x: 0, y: 0 }
    for (const [pad, a] of ativos) {
      if (a.vaga !== v) continue
      const d = direcoes.get(pad) ?? { x: 0, y: 0 }
      if (Math.abs(d.x) + Math.abs(d.y) > Math.abs(melhor.x) + Math.abs(melhor.y)) melhor = d
    }
    if (ultimoJoy[v] === undefined && !melhor.x && !melhor.y) continue
    const linha = `JOY ${v + 1} ${melhor.x} ${melhor.y}`
    if (linha === ultimoJoy[v]) continue
    ultimoJoy[v] = linha
    processarLinha(linha)
  }
}

export function iniciarGamepads({ aviso = () => {}, aoPerder = () => {} } = {}) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('getGamepads' in navigator)) return () => {}
  let quadro = 0

  const ligar = (pad) => {
    const chave = chaveDoPad(pad)
    const { vaga, novo } = atribuidor.vagaDe(chave)
    ativos.set(pad.index, { chave, vaga })
    definirFonte('gamepad', true)
    aviso({
      id: `controle:${chave}:${Date.now()}`,
      tipo: 'info',
      titulo: novo ? 'CONTROLE CONECTADO' : 'CONTROLE RECONECTADO',
      texto: `jogador ${vaga + 1}`,
      ms: 3500,
    })
  }

  const aoQuadro = () => {
    quadro = requestAnimationFrame(aoQuadro)
    const eventos = leitor.atualizar(lerPads())
    if (!eventos.length) return
    const acordados = new Set() // controles ligados por um botão neste quadro
    let mexeu = false

    for (const e of eventos) {
      if (captura && e.tipo !== 'saiu') {
        if (e.tipo === 'joy') direcoes.set(e.pad, { x: e.x, y: e.y })
        else if (e.tipo === 'apertou') {
          const fn = captura
          captura = null
          fn(e.indice)
        }
        continue
      }
      if (e.tipo === 'joy') {
        direcoes.set(e.pad, { x: e.x, y: e.y })
        mexeu = true
      } else if (e.tipo === 'apertou') {
        if (!ativos.has(e.pad)) {
          const era = ativos.size > 0
          const pad = lerPads().find((p) => p.index === e.pad)
          if (pad) {
            ligar(pad)
            if (!era) acordados.add(e.pad)
            mexeu = true
          }
        }
      } else if (e.tipo === 'botao') {
        const a = ativos.get(e.pad)
        if (a && !acordados.has(e.pad)) processarLinha(`BTN ${a.vaga + 1} ${e.botao}`)
      } else if (e.tipo === 'saiu') {
        direcoes.delete(e.pad)
        const a = ativos.get(e.pad)
        if (!a) continue
        ativos.delete(e.pad)
        atribuidor.desligou(a.chave)
        mexeu = true
        aviso({ id: `controle-saiu:${a.chave}:${Date.now()}`, tipo: 'info', titulo: 'CONTROLE DESCONECTADO', texto: `jogador ${a.vaga + 1}`, ms: 4000 })
        if (!ativos.size) definirFonte('gamepad', false)
        aoPerder('controle desconectado')
      }
    }
    if (mexeu) enviarDirecoes()
  }

  // Firefox avisa ao plugar: um controle que já era de alguém volta direto na vaga dele
  const aoConectar = (e) => {
    const pad = e.gamepad
    if (!pad || ativos.has(pad.index) || atribuidor.vagaConhecida(chaveDoPad(pad)) < 0) return
    ligar(pad)
    enviarDirecoes()
  }
  // a janela perdeu o foco: nenhuma direção fica "presa"
  const aoPerderFoco = () => {
    leitor.soltarTudo()
    direcoes.clear()
    enviarDirecoes()
  }
  window.addEventListener('gamepadconnected', aoConectar)
  window.addEventListener('blur', aoPerderFoco)
  quadro = requestAnimationFrame(aoQuadro)

  return () => {
    cancelAnimationFrame(quadro)
    window.removeEventListener('gamepadconnected', aoConectar)
    window.removeEventListener('blur', aoPerderFoco)
    ativos.clear()
    direcoes.clear()
    definirFonte('gamepad', false)
  }
}
