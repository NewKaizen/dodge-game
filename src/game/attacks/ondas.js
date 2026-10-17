import { definirAtaque } from './definir.js'
import { CORACAO } from '../constants.js'

// Paredes neon que atravessam a caixa, uma a cada `intervalo` (ritmo fixo),
// com uma abertura que ondula suavemente (seno) para dar tempo de seguir. A
// parede nasce fora da caixa e entra deslizando devagar até disparar: nada
// pisca, a própria entrada é o aviso. O seno começa numa fase sorteada e o passo de uma parede para a
// outra varia um pouco (com semente): o caminho da abertura não se repete.
// direcao: 'esquerda' | 'direita' (paredes verticais) ou 'baixo' (horizontais)
//
//   mirar   fração das paredes em que, se o coração estiver parado bem na
//           linha da abertura, ela é empurrada para o lado (sem passar de
//           `amplitude` + metade da abertura de deslocamento). Sem isso, o meio
//           da caixa ficava quase sempre dentro da abertura e dava para
//           esperar parado. A parede leva mais de um segundo para atravessar:
//           sobra tempo para ir até a abertura nova.
export default definirAtaque({
  nome: 'ondas',
  padrao: { duracao: 6000, intervalo: 800, velocidade: 130, abertura: 64, amplitude: 40, passo: 0.8, espessura: 10, direcao: 'esquerda', mirar: 0.5 },
  iniciar(a, cfg) {
    const l = a.caixa
    const meia = cfg.abertura / 2
    a.lacuna(cfg.abertura, 'abertura da onda')
    let mira = a.aleatorio(0, 1) // acumulador: `mirar` vira a fração de paredes empurradas (fase sorteada)
    let fase = a.aleatorio(0, Math.PI * 2) // onde o seno começa
    // quanto a abertura pode pular de uma parede para a seguinte: metade do que o
    // coração anda entre duas paredes (o seno sozinho pode pular mais; isso vale)
    const salto = CORACAO.velocidadePadrao * 0.5 * (cfg.intervalo / a.ritmo.densidade / 1000)
    let anterior = null

    // centro da abertura: o do seno, ou empurrado para fora da linha do coração
    const centroDa = (natural, coracao, min, max) => {
      let centro = limitar(natural, min, max)
      mira += Number(cfg.mirar) || 0
      if (mira >= 1) {
        mira -= 1
        if (Math.abs(centro - coracao) < meia) {
          // empurra para o lado com mais espaço, só o bastante para tirar o coração da abertura (+ margem)
          const empurrao = meia + 10
          const lado = centro !== coracao ? Math.sign(centro - coracao) : coracao < (min + max) / 2 ? 1 : -1
          const candidato = coracao + lado * empurrao
          let destino = limitar(candidato >= min && candidato <= max ? candidato : coracao - lado * empurrao, min, max)
          if (anterior !== null) {
            // sem pular mais que `salto` da abertura anterior (ou que o próprio seno pularia)
            const folga = Math.max(salto, Math.abs(centro - anterior))
            destino = limitar(destino, anterior - folga, anterior + folga)
          }
          centro = destino
        }
      }
      anterior = centro
      return centro
    }

    a.aCada(cfg.intervalo, (i) => {
      if (i > 0) fase += cfg.passo * a.aleatorio(0.6, 1.4)
      const onda = Math.sin(fase) * cfg.amplitude
      const fora = cfg.espessura / 2 + 2 // nasce encostada na borda, do lado de fora

      if (cfg.direcao === 'baixo') {
        const centro = centroDa(l.centerX + onda, a.alvo().x, l.left + meia, l.right - meia)
        const [ini, fim] = [centro - meia, centro + meia]
        a.parede({ eixo: 'x', lacunas: [[ini, fim]] })
        const y = l.top - fora
        barra(a, (l.left + ini) / 2, y, ini - l.left, cfg.espessura, 0, cfg.velocidade)
        barra(a, (fim + l.right) / 2, y, l.right - fim, cfg.espessura, 0, cfg.velocidade)
        return
      }

      const sinal = cfg.direcao === 'esquerda' ? -1 : 1
      const centro = centroDa(l.centerY + onda, a.alvo().y, l.top + meia, l.bottom - meia)
      const [ini, fim] = [centro - meia, centro + meia]
      a.parede({ eixo: 'y', lacunas: [[ini, fim]] })
      const x = sinal < 0 ? l.right + fora : l.left - fora
      barra(a, x, (l.top + ini) / 2, cfg.espessura, ini - l.top, sinal * cfg.velocidade, 0)
      barra(a, x, (fim + l.bottom) / 2, cfg.espessura, l.bottom - fim, sinal * cfg.velocidade, 0)
    })
  },
})

// A parede entra devagar (40% da velocidade) por ENTRADA_MS e então segue
// na velocidade cheia: o deslizar na borda é o aviso (os bots leem o arranque)
const ENTRADA_MS = 400
function barra(a, x, y, largura, altura, vx, vy) {
  if (largura < 1 || altura < 1) return
  a.bala({ x, y, largura, altura, vx: vx * 0.4, vy: vy * 0.4, forma: 'barra', entrando: true, arranque: { ms: ENTRADA_MS, vx, vy } })
}

function limitar(v, min, max) {
  return Math.min(Math.max(v, min), max)
}
