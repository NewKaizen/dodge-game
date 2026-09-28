import { jogo } from './estado.js'
import { processarLinha } from './protocolo.js'

// Abre a porta via Web Serial e repassa cada linha para o protocolo
export async function conectarSerial(baudRate = 9600) {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial não suportado neste navegador')
  }

  const porta = await navigator.serial.requestPort()
  await porta.open({ baudRate })
  jogo.update((s) => ({ ...s, conectado: true, fonte: 'serial' }))

  const leitor = porta.readable.pipeThrough(new TextDecoderStream()).getReader()
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
    jogo.update((s) => ({ ...s, conectado: false, fonte: null }))
  }
}
