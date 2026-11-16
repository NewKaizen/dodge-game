// O desenho da regra SINAL DE WI-FI da Queen (a lógica fica em coop/queenWifi.js): o RAIO do sinal em volta de
// cada coração, o fio entre os parceiros com as barrinhas de sinal, o "SEM SINAL" que enche antes de cair, as
// setas da INTERFERÊNCIA e os marcadores do REBOOT. Sem `import` de Phaser (quem chama passa a cena): dá para
// importar no Node junto com o arquivo do chefe. Tudo vive DENTRO do quadro (cena.quadro.caixa.recortar).
import { FONTE } from '../constants.js'
import { barras } from './queenWifi.js'

export const COR_SINAL = { forte: 0x40f0ff, medio: 0xffe14a, fraco: 0xff9a3a, caido: 0xff4f6a, rosa: 0xff4fc8 }
const corDasBarras = (n) => (n >= 3 ? COR_SINAL.forte : n === 2 ? COR_SINAL.medio : n === 1 ? COR_SINAL.fraco : COR_SINAL.caido)
const texto = (cena, tamanho, cor) => cena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, align: 'center' }).setOrigin(0.5)

// as 3 barrinhas de sinal (n = 0..3) com o centro em (x, y)
function iconeDeSinal(g, x, y, n, cor, escala = 1) {
  const w = 3 * escala
  g.fillStyle(0x0b0a18, 0.78).fillRoundedRect(x - 9 * escala, y - 8 * escala, 18 * escala, 15 * escala, 3)
  for (let k = 0; k < 3; k++) {
    const h = (4 + k * 3) * escala
    const bx = x - 6 * escala + k * (w + 1.5 * escala)
    g.fillStyle(k < n ? cor : 0x4a4660, k < n ? 1 : 0.9).fillRect(bx, y + 5 * escala - h, w, h)
  }
}

// chevron (>) apontando para `dir` (+1 direita, -1 esquerda)
function chevron(g, x, y, dir, tam) {
  g.beginPath()
  g.moveTo(x - dir * tam * 0.5, y - tam)
  g.lineTo(x + dir * tam * 0.5, y)
  g.lineTo(x - dir * tam * 0.5, y + tam)
  g.strokePath()
}

// pontilhado de (x1, y1) a (x2, y2)
function pontilhado(g, x1, y1, x2, y2, passo = 7) {
  const d = Math.hypot(x2 - x1, y2 - y1)
  const n = Math.floor(d / passo)
  for (let k = 0; k < n; k += 2) {
    const a = k / n
    const b = Math.min(1, (k + 1) / n)
    g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)
  }
}

export function criarVisualWifi(cena) {
  const caixa = cena.quadro.caixa
  const aneis = cena.add.graphics().setDepth(3)
  const fio = cena.add.graphics().setDepth(8)
  const ui = cena.add.graphics().setDepth(12)
  const aviso = texto(cena, 10, '#ff6a80').setDepth(13).setVisible(false)
  const titulo = texto(cena, 11, '#9be7ff').setDepth(13).setVisible(false)
  caixa.recortar(aneis, fio, ui, aviso, titulo)
  const objetos = [aneis, fio, ui, aviso, titulo]

  return {
    objetos,
    // v: { tempo, coracoes, raio, sinais, arestas, monitor, flash, empurrao, reboot, bonus }
    desenhar(v) {
      aneis.clear()
      fio.clear()
      ui.clear()
      aviso.setVisible(false)
      titulo.setVisible(false)
      const por = new Map(v.coracoes.filter((c) => c.ativo).map((c) => [c.j, c]))
      const pulso = 0.5 + 0.5 * Math.sin(v.tempo / 260)

      // o raio de cada coração (um disco leve e um anel): é o que "alcança" o parceiro
      for (const s of v.sinais) {
        const c = por.get(s.j)
        if (!c) continue
        const cor = s.ligado ? COR_SINAL.forte : COR_SINAL.caido
        aneis.fillStyle(cor, s.ligado ? 0.05 : 0.05 + 0.03 * pulso).fillCircle(c.x, c.y, v.raio)
        aneis.lineStyle(1.5, cor, s.ligado ? 0.34 : 0.55).strokeCircle(c.x, c.y, v.raio)
      }

      // o fio entre os parceiros: cor e barrinhas pela distância; fora do raio, pontilhado vermelho
      for (const e of v.arestas) {
        const a = por.get(e.a)
        const b = por.get(e.b)
        if (!a || !b) continue
        const n = barras(e.d, v.raio)
        const cor = corDasBarras(n)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        if (n > 0) {
          fio.lineStyle(2.5, cor, 0.85).lineBetween(a.x, a.y, b.x, b.y)
          // pacotinhos de dados correndo pelo fio
          for (let k = 0; k < 3; k++) {
            const p = (v.tempo / 900 + k / 3) % 1
            fio.fillStyle(0xffffff, 0.9).fillCircle(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, 1.8)
          }
        } else {
          fio.lineStyle(2, COR_SINAL.caido, v.flash ? 1 : 0.85)
          pontilhado(fio, a.x, a.y, b.x, b.y)
        }
        iconeDeSinal(ui, mx, my - 16, n, cor, 1.5)
        if (n === 0) {
          const carencia = Math.max(v.monitor.carencia(e.a), v.monitor.carencia(e.b))
          // a barrinha de "vai cair": enche durante a carência
          ui.fillStyle(0x0b0a18, 0.85).fillRect(mx - 21, my + 1, 42, 6)
          ui.fillStyle(COR_SINAL.caido, 1).fillRect(mx - 20, my + 2, 40 * carencia, 4)
          aviso.setText(carencia >= 1 ? 'CONEXÃO CAIU!' : 'SEM SINAL').setPosition(mx, my + 17).setVisible(true).setColor(carencia >= 1 ? '#ff4f6a' : '#ffb0b8')
        }
      }

      // INTERFERÊNCIA: setas em cada coração para onde o sinal ruim vai empurrar (o aviso pisca antes)
      if (v.empurrao) {
        const { tipo, direcoes } = v.empurrao
        const ativo = tipo === 'empurra'
        const alfa = ativo ? 0.95 : Math.sin(v.tempo / 70) > 0 ? 0.9 : 0.25
        ui.lineStyle(ativo ? 3 : 2, COR_SINAL.forte, alfa)
        for (const { j, dir } of direcoes) {
          const c = por.get(j)
          if (!c) continue
          const deslize = ativo ? ((v.tempo / 90) % 8) * dir : 0
          for (let k = 0; k < 3; k++) chevron(ui, c.x + dir * (16 + k * 7) + deslize * 0.5, c.y, dir, ativo ? 5 : 4)
        }
        titulo.setText(ativo ? 'INTERFERÊNCIA!' : 'INTERFERÊNCIA...').setColor(ativo ? '#9be7ff' : '#ffe9a0').setPosition(cena.quadro.caixa.limites.centerX, cena.quadro.caixa.limites.top + 12).setVisible(true)
      }

      // REBOOT: os lugares para onde os corações vão ser levados (aviso) e a contagem da reconexão
      if (v.reboot) {
        const l = cena.quadro.caixa.limites
        for (const d of v.reboot.destinos) {
          const r = 11 + 3 * pulso
          ui.lineStyle(2, COR_SINAL.rosa, 0.95).strokeCircle(d.x, d.y, r)
          ui.lineStyle(1, 0xffffff, 0.7).strokeCircle(d.x, d.y, r * 0.55)
        }
        titulo
          .setText(v.reboot.texto)
          .setColor('#ff9ae0')
          .setPosition(l.centerX, l.centerY - 10)
          .setVisible(true)
      } else if (v.bonus) {
        const l = cena.quadro.caixa.limites
        // a janela para reconectar e ganhar a QUEBRA: uma barrinha de tempo no topo
        const f = Math.max(0, v.bonus.restanteMs / v.bonus.totalMs)
        ui.fillStyle(0x0b0a18, 0.85).fillRect(l.centerX - 42, l.top + 5, 84, 6)
        ui.fillStyle(COR_SINAL.rosa, 1).fillRect(l.centerX - 41, l.top + 6, 82 * f, 4)
        titulo.setText('RECONECTEM!').setColor('#ff9ae0').setPosition(l.centerX, l.top + 21).setVisible(true)
      }
    },

    destruir() {
      for (const o of objetos) {
        cena.tweens?.killTweensOf(o)
        o.destroy?.()
      }
      objetos.length = 0
    },
  }
}
