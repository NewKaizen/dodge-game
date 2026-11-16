import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// LATAS QUICANTES do Coronel Caçamba (dificuldade do CO-OP). O caminhão despeja latas pelo alto: cada lata entra
// pela borda de cima já andando (a entrada é o aviso), cai com gravidade e QUICA no chão da caixa e nas paredes,
// perdendo um pouco de força a cada quique. Nunca são retas: o lugar seguro muda a cada pulo e ficar parado no
// chão é o pior lugar (é ali que elas batem). Em `rajada` saem várias latas juntas, em leque.
//
// Justiça: toda lata nasce FORA da caixa (em cima) e entra voando; a largura entre latas de uma mesma rajada é
// sempre maior que LACUNA_MINIMA; somem depois de `quiques` pulos no chão.
//
//   intervalo   ms entre uma rajada e a próxima
//   rajada      latas por rajada
//   velocidade  px/s horizontais máximos de uma lata
//   gravidade   px/s² da queda
//   quiques     pulos no chão antes de sumir
//   perda       fração da velocidade que fica a cada pulo no chão
export default definirAtaque({
  nome: 'coronelLatas',
  padrao: { duracao: 6000, intervalo: 900, rajada: 2, velocidade: 90, gravidade: 380, quiques: 2, perda: 0.78, raio: 8 },
  iniciar(a, cfg) {
    a.lacuna(a.caixa.width / Math.max(1, cfg.rajada) - cfg.raio * 2, 'entre as latas de uma rajada')
    a.aCada(
      cfg.intervalo,
      () => {
        const l = a.caixa
        tocar(a.cena, 'explosao')
        const fatia = l.width / cfg.rajada
        for (let k = 0; k < cfg.rajada; k++) {
          const x = l.left + fatia * (k + a.aleatorio(0.2, 0.8))
          const vx = a.aleatorio(-1, 1) * cfg.velocidade
          let pulos = 0
          a.bala({
            x,
            y: l.top - cfg.raio - 8,
            vx,
            vy: a.aleatorio(30, 70),
            ay: cfg.gravidade,
            raio: cfg.raio,
            forma: 'losango',
            cor: 0xa7adb8,
            girar: a.aleatorio(-7, 7),
            pulso: 0,
            entrando: true,
            atualizar: (b) => {
              const lc = a.caixa
              // o chão: quica perdendo força (e some depois de `quiques` pulos)
              if (b.y + b.raio >= lc.bottom && b.vy > 0) {
                b.y = lc.bottom - b.raio
                b.vy = -Math.abs(b.vy) * cfg.perda
                b.vx *= 0.92
                pulos++
                if (pulos > cfg.quiques) b.morta = true
              }
              // as paredes (só depois de entrar pelo alto) e o teto
              if (b.y > lc.top) {
                if (b.x - b.raio < lc.left && b.vx < 0) b.vx = Math.abs(b.vx)
                else if (b.x + b.raio > lc.right && b.vx > 0) b.vx = -Math.abs(b.vx)
                if (b.y - b.raio < lc.top && b.vy < 0) b.vy = Math.abs(b.vy) * 0.5
              }
            },
          })
        }
      },
      Infinity,
      200,
    )
  },
})
