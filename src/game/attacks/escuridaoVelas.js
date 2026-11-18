import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'
import { AVISO_NO_ESCURO } from './escuridaoMaos.js'

// VELAS QUE SE APAGAM da Escuridão (boss semanal). Velas acendem longe dos corações: são as únicas luzes do
// breu (brilham por cima do escuro). Depois de `vida` ms a chama treme, encolhe e um anel mostra até onde vai
// o estrago; quando ela apaga (PUF), a sombra estoura em estilhaços para todos os lados. Ficar perto da vela é
// gostoso (é a luz)... até ela apagar.
//
// Justiça: a vela acende a pelo menos `longe` px dos corações; a chama treme `aviso` ms (mín. 800) antes de
// apagar, com o anel do estouro (zona circulo para a CPU); os estilhaços nascem na vela e se afastam, cada vez
// mais longe um do outro (com até 9 estilhaços a brecha a 90 px já passa de LACUNA_MINIMA).
//
//   intervalo   ms entre uma vela e a próxima · simultaneas  velas acesas por vez (1 a 3)
//   vida        ms da vela acesa e quieta · aviso  ms tremendo
//   estilhacos  balas por estouro · velocidade  px/s · torto  gira o estouro (0..1 de uma fatia) entre as velas
export default definirAtaque({
  nome: 'escuridaoVelas',
  padrao: { duracao: 6500, intervalo: 1300, simultaneas: 1, vida: 700, aviso: 900, estilhacos: 8, velocidade: 120, raio: 5, longe: 70, segunda: 0 },
  iniciar(a, cfg) {
    const aviso = Math.max(800, cfg.aviso)
    // (a vela acende a `longe` px dos corações; o anel do estouro avisa: a +20 px já dá para estar)
    a.lacuna((2 * Math.PI * (cfg.longe + 20)) / Math.max(1, cfg.estilhacos) - cfg.raio * 2, 'entre os estilhaços, longe da vela')
    const acesas = []
    let giro = a.aleatorio(0, Math.PI * 2)

    const vela = (x, y) => {
      const g = a.decoracao(a.cena.add.graphics().setDepth(AVISO_NO_ESCURO))
      const total = cfg.vida + aviso
      const v = { x, y }
      acesas.push(v)
      let t = 0
      a.zonaPerigo({ tipo: 'circulo', x, y, raio: 40 }, { ms: total, dura: 450 })
      a.aoAtualizar((dt) => {
        if (!g.scene || t > total) return
        t += dt
        g.clear()
        if (t > total) return
        const tremendo = t > cfg.vida
        const p = tremendo ? (t - cfg.vida) / aviso : 0
        // a luz da vela (um halo) e a vela
        g.fillStyle(0xffd27a, 0.12 * (1 - p * 0.7)).fillCircle(x, y - 6, 26)
        g.fillStyle(0xe8e0d0, 1).fillRect(x - 3, y - 4, 6, 11)
        g.fillStyle(0x8a7cff, 1).fillRect(x - 4, y + 7, 8, 2)
        const treme = tremendo ? Math.sin(t / 30) * 2 * p : 0
        const chama = 5 * (1 - p * 0.6)
        g.fillStyle(0xffb040, 1).fillEllipse(x + treme, y - 8, chama, chama * 1.8)
        g.fillStyle(0xfff2b0, 1).fillEllipse(x + treme, y - 7, chama * 0.45, chama)
        if (tremendo) {
          // o anel do estouro fechando
          g.lineStyle(2, 0xb8b0ff, 0.4 + 0.5 * p).strokeCircle(x, y, 40 - 26 * p)
          g.lineStyle(1, 0xb8b0ff, 0.3).strokeCircle(x, y, 40)
        }
      })
      a.depois(cfg.vida, () => tocar(a.cena, 'sopro'))
      a.depois(total, () => {
        acesas.splice(acesas.indexOf(v), 1)
        tocar(a.cena, 'apagao')
        const n = cfg.estilhacos
        giro += (Math.PI * 2 * 0.5) / Math.max(1, n)
        for (let k = 0; k < n; k++) {
          const ang = giro + (k / n) * Math.PI * 2
          a.bala({ x: x + Math.cos(ang) * 6, y: y + Math.sin(ang) * 6, vx: Math.cos(ang) * cfg.velocidade, vy: Math.sin(ang) * cfg.velocidade, raio: cfg.raio, forma: 'losango', cor: 0x8a7cff, jaAvisada: true, girar: 5 })
        }
        // com `segunda`, um segundo anel mais lento, defasado meia fatia
        if (cfg.segunda > 0) {
          a.depois(220, () => {
            for (let k = 0; k < n; k++) {
              const ang = giro + ((k + 0.5) / n) * Math.PI * 2
              a.bala({ x: x + Math.cos(ang) * 6, y: y + Math.sin(ang) * 6, vx: Math.cos(ang) * cfg.velocidade * cfg.segunda, vy: Math.sin(ang) * cfg.velocidade * cfg.segunda, raio: cfg.raio, forma: 'bola', cor: 0xb8b0ff, jaAvisada: true })
            }
          })
        }
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        if (acesas.length >= cfg.simultaneas) return
        const l = a.caixa
        // longe dos corações e das outras velas
        let p = a.pontoLonge(cfg.longe, 24)
        for (let k = 0; k < 4 && acesas.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 70); k++) p = a.pontoLonge(cfg.longe * 0.8, 24)
        vela(Math.min(l.right - 20, Math.max(l.left + 20, p.x)), Math.min(l.bottom - 16, Math.max(l.top + 20, p.y)))
      },
      Infinity,
      200,
    )
  },
})
