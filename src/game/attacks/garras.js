import { definirAtaque } from './definir.js'

// GARRAS (campanha, o Silêncio; vale em qualquer modo). Uma garra de três dedos aparece FORA da caixa
// numa borda, parada e piscando (o "!" do aviso), apontando para onde o coração está; depois os três
// dedos avançam rápido em leque. Forte: uma segunda garra vem logo depois, da borda oposta. Fugir é
// sair da linha do dedo do meio e ficar entre os dedos de fora (a `abertura` deixa espaço).
//
//   aviso      ms parada antes do bote (>= ATAQUE.telegrafoMs)
//   abertura   rad entre os dedos
//   dupla      a segunda garra, da borda oposta, `atrasoDupla` ms depois
export default definirAtaque({
  nome: 'garras',
  padrao: { duracao: 5000, intervalo: 1150, velocidade: 200, raio: 6, aviso: 560, abertura: 0.24, dupla: true, atrasoDupla: 260, forma: null, caixa: null },
  iniciar(a, cfg) {
    const lados = ['left', 'top', 'right', 'bottom']
    let n = a.inteiro(0, 3)
    const garra = (lado) => {
      const alvo = a.alvo()
      const o = a.deFora(lado, a.aleatorio(0.12, 0.88), cfg.raio + 5)
      const ang = Math.atan2(alvo.y - o.y, alvo.x - o.x)
      for (const k of [-1, 0, 1]) {
        const d = ang + k * cfg.abertura
        a.bala({ x: o.x, y: o.y, vx: Math.cos(d) * cfg.velocidade, vy: Math.sin(d) * cfg.velocidade, raio: cfg.raio, aviso: cfg.aviso, entrando: false, girar: 0, ...(cfg.forma ? { forma: cfg.forma } : {}) })
      }
    }
    a.aCada(
      cfg.intervalo,
      () => {
        const lado = lados[n++ % 4]
        garra(lado)
        if (cfg.dupla) a.depois(cfg.atrasoDupla, () => garra(lados[(lados.indexOf(lado) + 2) % 4]))
      },
      Infinity,
      300,
    )
  },
})
