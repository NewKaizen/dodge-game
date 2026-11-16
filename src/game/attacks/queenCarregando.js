import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'
import { FONTE } from '../constants.js'

// CARREGANDO... da Queen (dificuldade do CO-OP). Uma BARRA DE PROGRESSO aparece na linha (ou na coluna) de um
// coração e enche com a porcentagem escrita; em 100% ela vira um LASER na faixa inteira. As barras alternam
// deitadas e em pé e vêm em sequência, cada uma mirando um coração: o laser de agora empurra para onde a
// próxima barra vai mirar. Com `cruz`, a barra deitada e a em pé carregam juntas (uma cruz no coração).
//
// Justiça: a faixa inteira aparece contornada desde o 0% e enche por `carga` ms (mín. 650) antes de valer; a
// faixa tem `espessura` px (a caixa sobra muito em volta); o laser dura `dura` ms.
//
//   intervalo   ms entre uma barra e a próxima
//   carga       ms de 0% a 100%
//   espessura   altura (largura) da faixa do laser
//   cruz        0..1: fração das barras que vêm em cruz
export default definirAtaque({
  nome: 'queenCarregando',
  padrao: { duracao: 6500, intervalo: 1100, carga: 1100, espessura: 18, dura: 420, cruz: 0 },
  iniciar(a, cfg) {
    const carga = Math.max(650, cfg.carga)
    let cruz = a.aleatorio(0, 1)

    const barra = (deitada, pos) => {
      const l = a.caixa
      const e = cfg.espessura
      const area = deitada ? { x: l.left, y: pos - e / 2, largura: l.width, altura: e } : { x: pos - e / 2, y: l.top, largura: e, altura: l.height }
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      const txt = a.decoracao(a.cena.add.text(deitada ? l.centerX : pos, deitada ? pos : l.centerY, '0%', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(8))
      let t = 0
      a.aoAtualizar((dt) => {
        if (!g.scene || t > carga) return
        t += dt
        g.clear()
        if (t > carga) {
          txt.destroy()
          return
        }
        const f = Math.min(1, t / carga)
        g.lineStyle(2, 0x40f0ff, 0.9).strokeRect(area.x, area.y, area.largura, area.altura)
        g.fillStyle(0x40f0ff, 0.12 + 0.3 * f)
        if (deitada) g.fillRect(area.x, area.y, area.largura * f, area.altura)
        else g.fillRect(area.x, area.y + area.altura * (1 - f), area.largura, area.altura * f)
        txt.setText(`${Math.floor(f * 100)}%`)
      })
      a.zonaPerigo({ tipo: 'area', ...area }, { ms: carga, dura: cfg.dura })
      a.depois(carga, () => {
        tocar(a.cena, 'laser')
        a.bala({ x: area.x + area.largura / 2, y: area.y + area.altura / 2, largura: area.largura, altura: area.altura - 4, forma: 'barra', cor: 0xff4fc8, vida: cfg.dura, atravessa: true, jaAvisada: true, pulso: 0 })
        a.tremer(80, 0.006)
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      (i) => {
        const l = a.caixa
        const alvo = a.alvo()
        const m = cfg.espessura / 2 + 2
        const y = Math.round(Math.min(l.bottom - m, Math.max(l.top + m, alvo.y)))
        const x = Math.round(Math.min(l.right - m, Math.max(l.left + m, alvo.x)))
        cruz += cfg.cruz
        if (cruz >= 1) {
          cruz -= 1
          barra(true, y)
          barra(false, x)
        } else if (i % 2 === 0) barra(true, y)
        else barra(false, x)
        tocar(a.cena, 'contador')
      },
      Infinity,
      200,
    )
  },
})
