import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// RATAZANAS do Coronel Caçamba (dificuldade do CO-OP). Do lixão saem bandos de ratos: primeiro dois OLHINHOS
// vermelhos piscam na borda, na altura de um coração (o aviso, `aviso` ms, com a faixa marcada para a CPU),
// depois o bando atravessa a caixa em fila, ziguezagueando. Quem fica na linha do bando apanha; dá para
// passar por cima ou por baixo (a fila ocupa só uma faixa) ou atravessar entre um bando e o próximo.
//
// Justiça: a faixa do bando tem no máximo 2 x (raio + zigue) de altura e a caixa sempre sobra muito mais que
// LACUNA_MINIMA em cima ou embaixo; os olhinhos avisam o lado e a altura antes de qualquer rato entrar.
//
//   intervalo   ms entre um bando e o próximo
//   ratos       ratos por bando (a fila)
//   velocidade  px/s do bando
//   aviso       ms dos olhinhos piscando
//   zigue       amplitude do ziguezague (px)
//   dois        fração dos bandos que saem DOS DOIS lados ao mesmo tempo (alturas diferentes)
export default definirAtaque({
  nome: 'coronelRatos',
  padrao: { duracao: 6000, intervalo: 1300, ratos: 5, velocidade: 165, aviso: 650, zigue: 9, raio: 6, espaco: 17, dois: 0 },
  iniciar(a, cfg) {
    const aviso = Math.max(450, cfg.aviso)
    const faixa = 2 * (cfg.raio + cfg.zigue)
    a.lacuna(a.caixa.height - faixa * 2, 'acima ou abaixo dos bandos')
    let dois = a.aleatorio(0, 1)

    const bando = (lado, y) => {
      const l = a.caixa
      const dir = lado === 'left' ? 1 : -1
      const x0 = dir > 0 ? l.left : l.right
      // os olhinhos na borda
      const g = a.decoracao(a.cena.add.graphics().setDepth(7))
      let t = 0
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso) return
        t += dt
        g.clear()
        if (t > aviso) return
        const acesos = Math.sin(t / 60) > -0.2
        g.fillStyle(0x2a1a10, 0.55).fillEllipse(x0 + dir * 10, y, 22, 14)
        g.fillStyle(0xff3030, acesos ? 1 : 0.25)
        g.fillCircle(x0 + dir * 7, y - 3, 2.6).fillCircle(x0 + dir * 13, y - 3, 2.6)
      })
      a.zonaPerigo({ tipo: 'area', x: l.left, y: y - faixa / 2, largura: l.width, altura: faixa }, { ms: aviso, dura: (l.width / cfg.velocidade) * 1000 })
      a.depois(aviso, () => {
        tocar(a.cena, 'estalo')
        for (let k = 0; k < cfg.ratos; k++) {
          const fase = k * 1.3
          let idade = 0
          a.bala({
            x: x0 - dir * (cfg.raio + 6 + k * cfg.espaco),
            y,
            vx: dir * cfg.velocidade,
            raio: cfg.raio,
            forma: 'bola',
            cor: 0x8a6a52,
            pulso: 0.12,
            entrando: true,
            atualizar: (b, dt) => {
              idade += dt * (a.balas.fatorVelocidade || 1)
              b.y = y + Math.sin(idade / 90 + fase) * cfg.zigue
            },
          })
        }
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const alvo = a.alvo()
        const m = cfg.raio + cfg.zigue + 2
        const y = Math.min(l.bottom - m, Math.max(l.top + m, alvo.y + a.aleatorio(-6, 6)))
        const lado = a.escolher(['left', 'right'])
        bando(lado, y)
        dois += cfg.dois
        if (dois >= 1) {
          dois -= 1
          // o outro lado, numa altura longe desta (sempre sobra a faixa do meio)
          const outro = y < l.centerY ? Math.min(l.bottom - m, y + l.height * 0.5) : Math.max(l.top + m, y - l.height * 0.5)
          bando(lado === 'left' ? 'right' : 'left', outro)
        }
      },
      Infinity,
      250,
    )
  },
})
