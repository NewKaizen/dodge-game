import { contextoAudio } from '../game/audio.js'

// Som no celular: o navegador só libera o AudioContext num GESTO, e no iPhone (Safari) o gesto
// que vale é o touchend / pointerup / click (o touchstart não vale). O contexto é um só para o jogo
// inteiro (efeitos, Phaser e a música MIDI do soundfont, game/midi.js), então destravar ele aqui
// destrava tudo. No iPhone também toca um buffer mudo de 1 amostra no primeiro gesto (o jeito
// antigo, que ainda é o mais garantido de "acordar" o áudio).
// Fica ouvindo para sempre (custa nada): o iPhone deixa o contexto 'interrupted' depois de uma
// ligação, do bloqueio de tela ou de outro app tocar som, e o próximo toque religa.
// Aba escondida: o contexto fica suspenso de propósito (audio.js silenciarEmFundo) e o resume dele
// não faz nada até a aba voltar.
export function instalarDestravarAudio() {
  if (typeof window === 'undefined') return () => {}
  let acordou = false
  const destravar = () => {
    const ctx = contextoAudio()
    if (!ctx) return
    if (ctx.state !== 'running') ctx.resume?.()?.catch?.(() => {})
    if (acordou) return
    acordou = true
    try {
      const buffer = ctx.createBuffer(1, 1, 22050)
      const fonte = ctx.createBufferSource()
      fonte.buffer = buffer
      fonte.connect(ctx.destination)
      fonte.start(0)
    } catch {}
  }
  const eventos = ['touchend', 'pointerup', 'click', 'keydown']
  for (const ev of eventos) window.addEventListener(ev, destravar, true)
  return () => eventos.forEach((ev) => window.removeEventListener(ev, destravar, true))
}
