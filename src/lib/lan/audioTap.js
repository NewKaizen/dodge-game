// Copia de tudo o que o jogo toca, para a transmissão do modo LAN mandar o som
// junto com a imagem (lib/lan/transmissao.js). Tudo o que liga na saída
// (ctx.destination) liga também num MediaStreamDestination do mesmo contexto.
// Importe ANTES de qualquer som ser ligado (main.js), senão o que já estava
// ligado fica de fora. O jogo inteiro usa um contexto só (audio.js
// contextoAudio(), que também é o do Phaser: config.js).
const copias = new WeakMap() // AudioContext -> MediaStreamAudioDestinationNode

function copiaDe(ctx) {
  let copia = copias.get(ctx)
  if (!copia && typeof ctx.createMediaStreamDestination === 'function') {
    copia = ctx.createMediaStreamDestination()
    copias.set(ctx, copia)
  }
  return copia
}

if (typeof AudioNode !== 'undefined' && !AudioNode.prototype.__copiaLan) {
  const ligar = AudioNode.prototype.connect
  const desligar = AudioNode.prototype.disconnect
  AudioNode.prototype.__copiaLan = true
  AudioNode.prototype.connect = function (destino, ...resto) {
    const r = ligar.call(this, destino, ...resto)
    if (destino instanceof AudioDestinationNode) {
      const copia = copiaDe(this.context)
      if (copia) ligar.call(this, copia, ...resto)
    }
    return r
  }
  AudioNode.prototype.disconnect = function (destino, ...resto) {
    const r = desligar.call(this, destino, ...resto)
    if (destino instanceof AudioDestinationNode) {
      try {
        desligar.call(this, copias.get(this.context), ...resto)
      } catch {}
    }
    return r
  }
}

// Faixa de áudio com tudo o que o contexto toca (null sem suporte)
export function faixaDeAudio(ctx) {
  return (ctx && copiaDe(ctx)?.stream.getAudioTracks()[0]) ?? null
}
