import { definirSeriais, MAX_JOGADORES } from './estado.js'
import { processarLinha } from './protocolo.js'
import { criarMapa, reescreverLinha, rotearSaida, modoRele } from './joysticks.js'
import { pref, definirPref } from '../game/preferencias.js'

// Joysticks serial: UM Arduino por porta USB (docs/protocolo-serial.md). Cada porta
// autorizada é uma fonte de controle; o jogo decide qual jogador é cada uma (lib/joysticks.js).
//
//   criarGerenciadorSerial({ navegador, aoLinha, aoMudar, carregar, salvar })   a lógica, com tudo injetável (testes)
//       .conectar()          pareia mais uma porta (requestPort, precisa de gesto)
//       .vigiar()            abre as já autorizadas e as que forem plugadas; devolve quem desliga
//       .enviar(linha)       roteia (PING/GAME/MENU/DISCONNECT: todas; "<n> VIDA/BUZZER": a do jogador n)
//       .trocarJogadores()   P1 <-> P2 dos joysticks (o firmware não sabe: o OLED não mostra P1/P2)
//       .desconectar({ esquecer })  fecha todas
//       .lista() / .abertas() / .quantas()

export const serialSuportado = () => typeof navigator !== 'undefined' && 'serial' in navigator

export function criarGerenciadorSerial({
  navegador = globalThis.navigator,
  aoLinha = () => {},
  aoMudar = () => {},
  carregar = () => null,
  salvar = () => {},
  baudRate = 9600,
  agendar = (fn, ms) => setTimeout(fn, ms),
  vagas = MAX_JOGADORES,
} = {}) {
  const mapa = criarMapa({ vagas, salvo: carregar(), aoSalvar: salvar })
  const entradas = new Map() // porta -> { escritor, leitor, fila }
  let desligadoPeloJogador = false // desligou de propósito: não reconecta sozinho até parear de novo

  const abertas = () => [...entradas.keys()].map((porta) => ({ porta, jogador: mapa.jogadorDe(porta) }))

  function escrever(porta, linha) {
    const e = entradas.get(porta)
    if (!e) return Promise.resolve()
    e.fila = e.fila.then(() => e.escritor.write(`${linha}\n`)).catch((erro) => console.warn('[serial] falhou ao enviar', linha, erro))
    return e.fila
  }

  async function abrir(porta) {
    if (entradas.has(porta)) throw new Error('joystick já conectado')
    let info = {}
    try {
      info = porta.getInfo?.() ?? {}
    } catch {}
    mapa.registrar(porta, info)
    await porta.open({ baudRate })
    const codificador = new TextEncoderStream()
    const escrita = codificador.readable.pipeTo(porta.writable)
    const leitor = porta.readable.pipeThrough(new TextDecoderStream()).getReader()
    const e = { escritor: codificador.writable.getWriter(), leitor, fila: Promise.resolve() }
    entradas.set(porta, e)
    mapa.ligou(porta)
    aoMudar()

    const fechou = (async () => {
      let buffer = ''
      try {
        while (true) {
          const { value, done } = await leitor.read()
          if (done) break
          buffer += value
          const linhas = buffer.split('\n')
          buffer = linhas.pop()
          // todas as placas se dizem jogador 1: vale o jogador da porta (pode ter sido trocado agora)
          linhas.forEach((l) => l.trim() && aoLinha(reescreverLinha(l, mapa.jogadorDe(porta), { rele: modoRele(abertas()) })))
        }
      } catch {} // cabo puxado
      finally {
        leitor.releaseLock()
        entradas.delete(porta)
        mapa.desligou(porta)
        try {
          await e.fila
          await e.escritor.close()
          await escrita
          await porta.close()
        } catch {} // a porta já foi embora
        aoMudar()
      }
    })()
    return { fechou } // dentro de um objeto: senão o await esperaria a porta fechar
  }

  return {
    // PRECISA de um gesto do jogador. Cada chamada soma mais um joystick
    async conectar() {
      if (!navegador?.serial) throw new Error('Web Serial não suportado neste navegador')
      const nova = await navegador.serial.requestPort()
      desligadoPeloJogador = false
      return abrir(nova)
    },

    vigiar() {
      if (!navegador?.serial) return () => {}
      let parado = false
      const tentar = async (p, vezes = 2) => {
        if (parado || entradas.has(p) || desligadoPeloJogador) return
        try {
          await abrir(p)
        } catch (err) {
          // acabou de ser plugada (ainda ocupada) ou outra aba/programa está com ela
          if (vezes > 1) agendar(() => tentar(p, vezes - 1), 600)
          else console.debug('[serial] não abriu sozinho', err?.message)
        }
      }
      const aoLigar = (ev) => tentar(ev.target)
      navegador.serial.addEventListener('connect', aoLigar)
      navegador.serial
        .getPorts()
        .then(async (portas) => {
          for (const p of portas) if (!parado) await tentar(p, 1) // na ordem do pareamento
        })
        .catch(() => {})
      return () => {
        parado = true
        navegador.serial.removeEventListener('connect', aoLigar)
      }
    },

    enviar(linha) {
      const alvos = rotearSaida(linha, abertas())
      return Promise.all(alvos.map((a) => escrever(a.porta, a.linha)))
    },

    trocarJogadores() {
      if (!mapa.trocar()) return false
      aoMudar()
      return true
    },

    async desconectar({ esquecer = false } = {}) {
      if (esquecer) desligadoPeloJogador = true
      await Promise.all([...entradas.values()].map(async (e) => (await e.fila, e.leitor.cancel())))
    },

    lista: () => mapa.lista(),
    quantas: () => entradas.size,
    jogadorDe: (porta) => mapa.jogadorDe(porta),
  }
}

// ---------- o gerenciador do jogo ----------
const g = criarGerenciadorSerial({
  aoLinha: processarLinha,
  aoMudar: () => {
    definirSeriais(g.quantas())
    ouvintes.forEach((fn) => fn())
  },
  carregar: () => pref('joysticksSerial'),
  salvar: (m) => definirPref('joysticksSerial', m),
})
const ouvintes = new Set()

// avisa quando um joystick abre, fecha ou troca de jogador (lib/saida.js reenvia o estado)
export function aoMudarJoysticks(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export const conectarSerial = () => g.conectar()
export const vigiarSerial = () => g.vigiar()
export const enviarSerial = (linha) => g.enviar(linha)
export const trocarJogadoresSerial = () => g.trocarJogadores()
export const desconectarSerial = (opcoes) => g.desconectar(opcoes)
export const listarJoysticks = () => g.lista()
export const serialAberto = () => g.quantas() > 0
export const quantosJoysticks = () => g.quantas()
