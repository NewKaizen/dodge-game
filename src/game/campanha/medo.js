import { contextoAudio, volumeEfeitos } from '../audio.js'
import { AUDIO, FONTE, LARGURA, ALTURA } from '../constants.js'
import { menosMovimento } from '../preferencias.js'

// O MEDO na campanha (docs/campanha.md): enquanto o Silêncio ataca na sua caixa, a tela fica mais
// escura nas bordas (mais escura quanto menos HP), um coração bate grave (mais rápido quanto menos HP)
// e sussurros aparecem em volta da caixa. Só sabor: nada disto muda a partida.
//
//   const m = criarMedo(cena, { profundidade })
//   m.atualizar(dt, { ativo, hp: 0..1, caixa })   todo quadro · m.parar() · m.destruir()
//   batida(forte)                                 um "tum" grave (WebAudio)
export const SUSSURROS = ['shhh…', 'quieto…', 'fica…', 'ninguém vem…', 'cala…', 'shhh']

export function batida(forte = 1) {
  const vol = volumeEfeitos()
  const c = vol > 0 ? contextoAudio() : null
  if (!c) return false
  if (c.state === 'suspended') c.resume()
  const t0 = c.currentTime
  // "tum-tum": duas pancadas graves, a segunda mais fraca
  for (const [atraso, f, pico] of [
    [0, 58, 0.22],
    [0.17, 50, 0.14],
  ]) {
    const t = t0 + atraso
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * 1.6, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(pico * forte * AUDIO.volume * vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + 0.25)
  }
  return true
}

// o intervalo entre batidas: calmo com HP cheio, disparado no fim
export const intervaloDaBatida = (hp) => Math.round(420 + 520 * Math.max(0, Math.min(1, hp)))

export function criarMedo(cena, { profundidade = 3 } = {}) {
  const veu = cena.add.graphics().setDepth(profundidade)
  let forca = 0 // 0..1, sobe e desce devagar
  let proxBatida = 0
  let proxSussurro = 1200
  const vivos = []
  const m = {
    atualizar(dt, { ativo = false, hp = 1, caixa = null } = {}) {
      const alvo = ativo ? 0.45 + 0.5 * (1 - Math.max(0, Math.min(1, hp))) : 0
      forca += (alvo - forca) * Math.min(1, dt / 350)
      veu.clear()
      if (forca > 0.01) {
        // as bordas fechando: faixas pretas cada vez mais largas e opacas (e um fio carmim)
        const n = 9
        for (let k = 0; k < n; k++) {
          const larg = (8 + k * 9) * forca
          const a = 0.11 * forca
          veu.fillStyle(0x000000, a)
          veu.fillRect(0, 0, LARGURA, larg).fillRect(0, ALTURA - larg, LARGURA, larg).fillRect(0, 0, larg, ALTURA).fillRect(LARGURA - larg, 0, larg, ALTURA)
        }
        veu.fillStyle(0x5a0818, 0.12 * forca).fillRect(0, 0, LARGURA, 3).fillRect(0, ALTURA - 3, LARGURA, 3)
      }
      if (!ativo) return
      proxBatida -= dt
      if (proxBatida <= 0) {
        batida(0.6 + 0.4 * (1 - hp))
        proxBatida = intervaloDaBatida(hp)
      }
      if (menosMovimento() || !caixa) return
      proxSussurro -= dt
      if (proxSussurro <= 0) {
        proxSussurro = 1300 + Math.random() * 1400
        m.sussurrar(caixa)
      }
    },
    // uma palavra fraca, violeta, perto da caixa (fora dela), que aparece e some
    sussurrar(caixa) {
      const lado = Math.floor(Math.random() * 4)
      const x = lado === 0 ? caixa.esquerda - 40 : lado === 1 ? caixa.direita + 40 : caixa.esquerda + Math.random() * (caixa.direita - caixa.esquerda)
      const y = lado === 2 ? caixa.topo - 14 : lado === 3 ? caixa.base + 26 : caixa.topo + Math.random() * (caixa.base - caixa.topo)
      const t = cena.add.text(x, y, SUSSURROS[Math.floor(Math.random() * SUSSURROS.length)], { fontFamily: FONTE, fontSize: '11px', color: '#9a6ad0' }).setOrigin(0.5).setAlpha(0).setDepth(profundidade + 0.5)
      vivos.push(t)
      cena.tweens.add({ targets: t, alpha: 0.55, y: y - 6, duration: 700, yoyo: true, hold: 300, onComplete: () => t.destroy() })
    },
    parar() {
      forca = 0
      veu.clear()
    },
    destruir() {
      veu.destroy()
      for (const t of vivos) t.active && t.destroy()
    },
  }
  return m
}
