import { definirFonte } from './estado.js'
import { processarLinha } from './protocolo.js'

let porta = null
let leitor = null
let escritor = null
let fila = Promise.resolve() // uma escrita de cada vez, na ordem em que foram pedidas

export const serialSuportado = () => typeof navigator !== 'undefined' && 'serial' in navigator
export const serialAberto = () => porta !== null

// O jogador desligou o joystick de propósito (CONFIGURAÇÕES): não reconecta sozinho
// até ele parear de novo
let desligadoPeloJogador = false

// Abre a porta e começa a ler. Resolve assim que a porta abre, com { fechou }: uma
// promessa que só termina quando a porta fecha (cabo puxado ou desconectarSerial)
async function abrirPorta(nova, baudRate) {
  if (porta) throw new Error('joystick já conectado')
  porta = nova
  try {
    await porta.open({ baudRate })
  } catch (e) {
    porta = null
    throw e
  }
  const codificador = new TextEncoderStream()
  const escrita = codificador.readable.pipeTo(porta.writable)
  escritor = codificador.writable.getWriter()
  leitor = porta.readable.pipeThrough(new TextDecoderStream()).getReader()
  definirFonte('serial', true)

  const fechou = (async () => {
    let buffer = ''
    try {
      while (true) {
        const { value, done } = await leitor.read()
        if (done) break
        buffer += value
        const linhas = buffer.split('\n')
        buffer = linhas.pop()
        linhas.forEach(processarLinha)
      }
    } finally {
      leitor.releaseLock()
      leitor = null
      try {
        await fila
        await escritor.close()
        await escrita
        await porta.close()
      } catch {} // cabo puxado: a porta já foi embora
      escritor = null
      porta = null
      definirFonte('serial', false)
    }
  })()
  return { fechou } // dentro de um objeto: senão o await esperaria a porta fechar
}

// Pareia um joystick novo via Web Serial. PRECISA de um gesto do jogador (clique ou
// botão): o navegador só mostra a lista de portas assim (CONFIGURAÇÕES, "CONECTAR
// JOYSTICK SERIAL"). Resolve assim que a porta abre, com { fechou }: uma promessa que
// termina quando a porta fecha.
export async function conectarSerial(baudRate = 9600) {
  if (!serialSuportado()) {
    throw new Error('Web Serial não suportado neste navegador')
  }
  const nova = await navigator.serial.requestPort()
  desligadoPeloJogador = false
  return abrirPorta(nova, baudRate)
}

// Ao carregar a página: abre sozinho um joystick que o jogador já autorizou antes
// (navigator.serial.getPorts) e religa quando o cabo é recolocado (evento 'connect').
// Sem gesto não dá para abrir uma porta NOVA: essa só pelo conectarSerial. Devolve a
// função que desliga os ouvintes.
export function vigiarSerial(baudRate = 9600) {
  if (!serialSuportado()) return () => {}
  let parado = false

  const tentar = async (p, vezes = 2) => {
    if (parado || porta || desligadoPeloJogador) return
    try {
      await abrirPorta(p, baudRate)
    } catch (e) {
      // acabou de ser plugado (ainda ocupada) ou outra aba/programa está com ela
      if (vezes > 1) setTimeout(() => tentar(p, vezes - 1), 600)
      else console.debug('[serial] não abriu sozinho', e?.message)
    }
  }
  const aoLigar = (e) => tentar(e.target)
  navigator.serial.addEventListener('connect', aoLigar)

  navigator.serial
    .getPorts()
    .then(async (portas) => {
      for (const p of portas) {
        if (parado || porta) break
        await tentar(p, 1)
      }
    })
    .catch(() => {})

  return () => {
    parado = true
    navigator.serial.removeEventListener('connect', aoLigar)
  }
}

// Manda uma linha para o Arduino principal ('\n' no fim). Sem porta aberta, nada
export function enviarSerial(linha) {
  if (!escritor) return fila
  const atual = escritor
  fila = fila.then(() => atual.write(`${linha}\n`)).catch((erro) => console.warn('[serial] falhou ao enviar', linha, erro))
  return fila
}

// Fecha a porta depois de mandar o que já estava na fila
export async function desconectarSerial({ esquecer = false } = {}) {
  if (esquecer) desligadoPeloJogador = true
  await fila
  await leitor?.cancel()
}
