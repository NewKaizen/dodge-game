import { definirAtaque } from './definir.js'
import { FONTE } from '../constants.js'
import { tocar } from '../audio.js'

// O COMPACTADOR do Coronel Caçamba (CO-OP 2.0). Duas placas de aço, uma de cada lado da caixa, fecham DEVAGAR
// em direção ao meio e param deixando um VÃO. O vão aparece desde o começo, marcado em verde-claro (a área
// segura), e as placas esperam fora da caixa antes de andar. Todos têm de caber no vão (ele cresce com o grupo).
// Depois de segurar um instante, as placas abrem e o próximo vão aparece em outro lugar: dá para trocar de
// lugar sem pressa. Não persegue: a placa anda bem mais devagar que o coração.
//
// Justiça: o vão marcado nasce `aviso` ms antes de as placas andarem; elas gastam `fecha` ms para chegar (a
// maior distância pede menos que 60% da velocidade do coração); o vão tem pelo menos 100 px (2 corações cabem);
// as placas só ficam travadas `segura` ms antes de abrir.
//
//   vezes     quantos fechamentos (cada um com um vão novo)
//   vao       largura do vão (px); +28 por jogador além de 2
//   aviso     ms do vão marcado com as placas ainda fora
//   fecha     ms para as placas chegarem no vão
//   segura    ms com as placas fechadas
//   abre      ms para as placas abrirem
export default definirAtaque({
  nome: 'coronelCompactador',
  padrao: { duracao: 7300, vezes: 2, vao: 104, aviso: 600, fecha: 1900, segura: 450, abre: 450, respiro: { meio: 0 } },
  iniciar(a, cfg) {
    const n = Math.max(2, a.coracoes.length)
    const vao = cfg.vao + (n - 2) * 28
    a.lacuna(vao, 'vão do compactador')
    const espessura = 36
    const ciclo = cfg.aviso + cfg.fecha + cfg.segura + cfg.abre + 350
    const facil = (t) => t * t * (3 - 2 * t) // suaviza o começo e o fim

    const comecar = (i) => {
      const l = a.caixa
      const margem = 12
      const centro = a.aleatorio(l.left + vao / 2 + margem, l.right - vao / 2 - margem)
      const esq = centro - vao / 2
      const dir = centro + vao / 2
      const alto = l.height + 24
      // as duas placas esperam fora da caixa, uma em cada lado
      const placa = (x) =>
        a.bala({ x, y: l.centerY, largura: espessura, altura: alto, forma: 'barra', cor: 0x9aa7b4, atravessa: true, jaAvisada: true, pulso: 0 })
      const pe = placa(l.left - espessura / 2)
      const pd = placa(l.right + espessura / 2)
      tocar(a.cena, 'motor')

      // o vão (área segura): faixa verde-clara pulsando + bordas e o aviso escrito
      const g = a.decoracao(a.cena.add.graphics().setDepth(3))
      const rotulo = a.decoracao(a.cena.add.text(centro, l.top + 14, 'VÃO', { fontFamily: FONTE, fontSize: '11px', color: '#c8ffd0', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(8))
      let t = 0
      const fechando = (ms) => Math.min(1, Math.max(0, ms / cfg.fecha))
      a.aoAtualizar((dt) => {
        if (!g.scene) return
        t += dt
        const p = Math.sin(t / 180) * 0.5 + 0.5
        g.clear()
        g.fillStyle(0xb8ffc8, 0.13 + 0.1 * p).fillRect(esq, l.top, vao, l.height)
        g.lineStyle(2, 0xc8ffd0, 0.7 + 0.25 * p)
        g.lineBetween(esq, l.top, esq, l.bottom)
        g.lineBetween(dir, l.top, dir, l.bottom)
        if (t > ciclo - 350) {
          g.clear()
          rotulo.setVisible(false)
          return
        }
        const t1 = t - cfg.aviso
        let f // 0 = placas fora; 1 = fechadas no vão
        if (t1 < 0) f = 0
        else if (t1 < cfg.fecha) f = facil(fechando(t1))
        else if (t1 < cfg.fecha + cfg.segura) f = 1
        else f = 1 - facil(Math.min(1, (t1 - cfg.fecha - cfg.segura) / cfg.abre))
        pe.x = l.left - espessura / 2 + (esq - l.left) * f
        pd.x = l.right + espessura / 2 - (l.right - dir) * f
      })
      a.depois(ciclo - 250, () => {
        pe.morta = true
        pd.morta = true
      })
      return i
    }

    for (let i = 0; i < cfg.vezes; i++) a.depois(i * ciclo, () => comecar(i))
  },
})
