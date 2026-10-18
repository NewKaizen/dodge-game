import { definirAtaque } from './definir.js'

// Bolas que entram pelo topo (nascem logo acima da caixa: a entrada é o
// aviso, nada pisca), descem inclinadas e quicam nas paredes da caixa
// `quiques` vezes antes de sair. `gravidade` faz quicar no chão. Posição de
// entrada, lado da inclinação e quais bolas miram são sorteados (com semente).
//
//   mirar   fração das bolas lançadas no coração: direto, ou tabelando no
//           chão quando ele está alto demais para o tiro direto (a inclinação
//           é limitada a `inclinacaoMax` rad da vertical). As outras saem num
//           ângulo sorteado. Sem isso, um coração parado num canto quase nunca
//           era atingido.
export default definirAtaque({
  nome: 'quicantes',
  padrao: { duracao: 6000, intervalo: 1000, velocidade: 150, raio: 8, gravidade: 0, quiques: 4, forma: null, mirar: 0.5, inclinacaoMax: 1.15 },
  iniciar(a, cfg) {
    const l = a.caixa
    let mira = a.aleatorio(0, 1) // acumulador: `mirar` vira a fração de bolas miradas (fase sorteada)

    a.aCada(cfg.intervalo, (i) => {
      let x = a.aleatorio(l.left + 20, l.right - 20)
      const y = l.top - cfg.raio - 2 // logo acima da caixa: entra descendo
      const lado = a.aleatorio(0, 1) < 0.5 ? 1 : -1
      let ang = Math.PI / 2 + lado * a.aleatorio(0.35, 0.8)

      mira += Number(cfg.mirar) || 0
      if (mira >= 1) {
        mira -= 1
        const alvo = a.alvo()
        // com gravidade a bola cai rápido: nasce mais perto do coração na horizontal
        if (cfg.gravidade > 0) x = Math.min(Math.max(alvo.x + lado * 50, l.left + 20), l.right - 20)
        // não nasce em cima de um coração encostado no topo
        if (Math.abs(alvo.x - x) < 40 && alvo.y - y < 40) x = alvo.x + (alvo.x < l.centerX ? 60 : -60)
        const inclinacao = (ty) => Math.atan2(ty - y, alvo.x - x) - Math.PI / 2
        let ty = alvo.y
        if (cfg.gravidade > 0) {
          // com gravidade: mira acima do coração o quanto a bola vai cair no caminho
          for (let k = 0; k < 2; k++) {
            const t = Math.hypot(alvo.x - x, ty - y) / cfg.velocidade
            ty = alvo.y - (cfg.gravidade * t * t) / 2
          }
        } else if (Math.abs(inclinacao(ty)) > cfg.inclinacaoMax) {
          // alto demais para o tiro direto: tabela no chão (mira no reflexo do coração)
          ty = 2 * l.bottom - alvo.y
        }
        const desvio = inclinacao(ty)
        ang = Math.PI / 2 + Math.min(Math.max(desvio, -cfg.inclinacaoMax), cfg.inclinacaoMax)
      }

      a.bala({
        x,
        y,
        vx: Math.cos(ang) * cfg.velocidade,
        vy: Math.sin(ang) * cfg.velocidade,
        ay: cfg.gravidade,
        quicar: cfg.quiques,
        raio: cfg.raio,
        forma: cfg.forma ?? a.forma(i),
        girar: 5,
        entrando: true,
      })
    })
  },
})
