// CPU do CTRL+C CTRL+V (bonus round, pvp/bonus/Copia.js): aperta A com
// ritmo de gente. Lógica pura (sem Phaser), testável em Node.
//
//   const bot = new BotCopia({ nivel: 'normal', rng, duracaoMs })   rng: () => 0..1
//   todo frame da disputa:  const n = bot.atualizar(dt)   apertos neste frame (quase sempre 0 ou 1)
//
// Gente apertando um botão o mais rápido que dá faz uns 5 a 9 apertos por
// segundo, sem ritmo certinho: demora para começar, cada intervalo varia, o
// braço cansa até o fim e de vez em quando perde o ritmo (tropeço). A CPU
// imita isso; nem o difícil é imbatível (um jogador rápido passa dele).
//
//   ritmo      apertos por segundo no começo
//   variacao   ± fração sorteada em cada intervalo
//   cansaco    quanto o ritmo cai até o fim da disputa (fração)
//   reacaoMs   [min, max] demora para o 1º aperto depois do "COPIAR!"
//   tropeco    chance, a cada aperto, de perder o ritmo por tropecoMs [min, max]
export const NIVEIS_COPIA = {
  facil: { ritmo: 4.8, variacao: 0.3, cansaco: 0.22, reacaoMs: [260, 480], tropeco: 0.06, tropecoMs: [200, 420] },
  normal: { ritmo: 6.3, variacao: 0.25, cansaco: 0.16, reacaoMs: [190, 340], tropeco: 0.035, tropecoMs: [160, 320] },
  dificil: { ritmo: 7.7, variacao: 0.2, cansaco: 0.12, reacaoMs: [150, 270], tropeco: 0.02, tropecoMs: [130, 260] },
}

export class BotCopia {
  constructor({ nivel = 'normal', rng = Math.random, duracaoMs = 5000 } = {}) {
    this.cfg = NIVEIS_COPIA[nivel] ?? NIVEIS_COPIA.normal
    this.rng = rng
    this.duracaoMs = duracaoMs
    this.t = 0
    const [a, b] = this.cfg.reacaoMs
    this.proximo = a + this.rng() * (b - a) // quando sai o próximo aperto (ms desde o começo)
  }

  // intervalo até o próximo aperto, já com cansaço, variação e tropeço
  intervalo() {
    const c = this.cfg
    const cansado = 1 - c.cansaco * Math.min(1, this.t / this.duracaoMs)
    let ms = (1000 / (c.ritmo * cansado)) * (1 + c.variacao * (this.rng() * 2 - 1))
    if (this.rng() < c.tropeco) {
      const [a, b] = c.tropecoMs
      ms += a + this.rng() * (b - a)
    }
    return ms
  }

  atualizar(dt) {
    this.t += dt
    let n = 0
    while (this.t >= this.proximo && n < 4) {
      n++
      this.proximo += this.intervalo()
    }
    return n
  }
}
