import { jogo } from './estado.js'
import { processarLinha } from './protocolo.js'

let porta = null
let leitor = null
let escritor = null
let fila = Promise.resolve() // uma escrita de cada vez, na ordem em que foram pedidas

// Abre a porta via Web Serial e repassa cada linha para o protocolo. Resolve
// quando a porta fecha (cabo puxado ou desconectarSerial)
export async function conectarSerial(baudRate = 9600) {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial não suportado neste navegador')
  }

  porta = await navigator.serial.requestPort()
  await porta.open({ baudRate })
  const codificador = new TextEncoderStream()
  const escrita = codificador.readable.pipeTo(porta.writable)
  escritor = codificador.writable.getWriter()
  leitor = porta.readable.pipeThrough(new TextDecoderStream()).getReader()
  jogo.update((s) => ({ ...s, conectado: true, fonte: 'serial' }))

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
    jogo.update((s) => ({ ...s, conectado: false, fonte: null }))
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
export async function desconectarSerial() {
  await fila
  await leitor?.cancel()
}
