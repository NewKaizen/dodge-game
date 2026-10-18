import { definirAtaque } from './definir.js'

// Rajada rastreadora. Identidade: em vez de um tiro solto, vêm `rajada` tiros
// em sequência rápida (tá-tá-tá) e depois uma calmaria. Cada tiro mira onde o
// coração está NAQUELE instante (então ficar parado é punido, e andar em
// linha reta é seguro) e entra por uma das duas bordas mais distantes dele
// (sorteada a cada tiro), vindo de fora da caixa. Nada de linha de mira: o
// tiro entra devagar e acelera até `velocidade`, e essa entrada é o aviso. A
// mira é a de um instante antes (`reacao` ms): quem já está andando escapa.
//
//   rajada     tiros por rajada
//   cadencia   ms (médios) entre os tiros da rajada
//   partida    fração da velocidade com que o tiro entra (acelera até `velocidade`)
//   aviso      ms que o tiro leva para chegar à velocidade cheia (mínimo 300)
//   reacao     ms entre olhar onde o coração está e o tiro nascer
//   caixa      a rajada acontece numa arena quadrada, com espaço para a mira (aviso antes de mudar)
//
// `intervalo` continua sendo o tempo médio entre tiros: a rajada inteira
// dura `rajada × intervalo`, então a quantidade de balas por segundo não muda.
export default definirAtaque({
  nome: 'aimed',
  padrao: { duracao: 5000, intervalo: 800, velocidade: 140, raio: 7, aviso: 550, partida: 0.5, rajada: 3, cadencia: 260, reacao: 300, caixa: { largura: 190, altura: 190 } },
  iniciar(a, cfg) {
    const recuo = cfg.raio + 4 // nasce fora da caixa, encostado na borda

    const atirar = () => {
      const l = a.caixa
      const alvo = a.alvo()
      const lados = [
        ['top', alvo.y - l.top],
        ['bottom', l.bottom - alvo.y],
        ['left', alvo.x - l.left],
        ['right', l.right - alvo.x],
      ].sort((p, q) => q[1] - p[1])
      const lado = a.escolher(lados.slice(0, 2))[0]
      const t = a.aleatorio(0.15, 0.85)
      const origem = {
        top: { x: l.left + t * l.width, y: l.top - recuo },
        bottom: { x: l.left + t * l.width, y: l.bottom + recuo },
        left: { x: l.left - recuo, y: l.top + t * l.height },
        right: { x: l.right + recuo, y: l.top + t * l.height },
      }[lado]
      const dir = Math.atan2(alvo.y - origem.y, alvo.x - origem.x)
      const cos = Math.cos(dir)
      const sin = Math.sin(dir)
      // entra a `partida` da velocidade e acelera até ela em `aviso` ms
      const v0 = cfg.velocidade * cfg.partida
      const acel = (cfg.velocidade - v0) / (Math.max(300, cfg.aviso) / 1000)

      a.depois(cfg.reacao, () => a.bala({
        x: origem.x,
        y: origem.y,
        vx: cos * v0,
        vy: sin * v0,
        ax: cos * acel,
        ay: sin * acel,
        raio: cfg.raio,
        girar: 5,
        entrando: true,
        atualizar: (b) => {
          // chegou na velocidade cheia: para de acelerar
          if (b.ax !== 0 && b.vx * b.vx + b.vy * b.vy >= cfg.velocidade * cfg.velocidade) {
            b.vx = cos * cfg.velocidade
            b.vy = sin * cfg.velocidade
            b.ax = 0
            b.ay = 0
          }
        },
      }))
    }

    a.aCada(
      cfg.intervalo * cfg.rajada,
      () => {
        // a cadência varia um pouco dentro da rajada (o tá-tá-tá não tem metrônomo)
        let atraso = 0
        for (let k = 0; k < cfg.rajada; k++) {
          if (k === 0) atirar()
          else a.depois(atraso, atirar)
          atraso += cfg.cadencia * a.aleatorio(0.8, 1.2)
        }
      },
      Infinity,
      300,
    )
  },
})
