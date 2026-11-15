// O DESENHO da regra RECICLAGEM do Coronel Caçamba (coop/coronelRegra.js tem a lógica; aqui só o Phaser): o item
// verde (recicla, não machuca) e o marrom (contaminado, machuca), a LIXEIRA que enche no HUD e o MÍSSIL RECICLADO.
// Nada aqui decide nada: a regra manda desenhar e a arena (ou os testes, sem Phaser) nem passa por aqui.
import { FONTE } from '../constants.js'
import { tocar } from '../audio.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { particulas } from '../effects/particulas.js'
import { semLigaduras } from '../campanha/texto.js'

export const COR_RECICLA = 0x3ddc6a // verde: só da reciclagem (nenhum ataque que machuca é verde)
export const COR_SUJO = 0x7a3b1c // marrom: o contaminado, que machuca
const estilo = (tamanho, cor, extra = {}) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })

// o símbolo de reciclar: três setas em triângulo (♻), desenhado à mão para não depender da fonte
export function simboloReciclar(g, cx, cy, r, cor = 0xffffff, espessura = 2) {
  g.lineStyle(espessura, cor, 1)
  g.fillStyle(cor, 1)
  const ponto = (k) => ({ x: cx + Math.cos(-Math.PI / 2 + (k * Math.PI * 2) / 3) * r, y: cy + Math.sin(-Math.PI / 2 + (k * Math.PI * 2) / 3) * r })
  for (let k = 0; k < 3; k++) {
    const a = ponto(k)
    const b = ponto(k + 1)
    const ax = a.x + (b.x - a.x) * 0.12
    const ay = a.y + (b.y - a.y) * 0.12
    const bx = a.x + (b.x - a.x) * 0.7
    const by = a.y + (b.y - a.y) * 0.7
    g.lineBetween(ax, ay, bx, by)
    // ponta da seta
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    const s = Math.max(2.5, r * 0.5)
    g.fillTriangle(bx + Math.cos(ang) * s, by + Math.sin(ang) * s, bx + Math.cos(ang + 2.4) * s, by + Math.sin(ang + 2.4) * s, bx + Math.cos(ang - 2.4) * s, by + Math.sin(ang - 2.4) * s)
  }
}

// O item que cai no quadro. tipo 'limpo': lata verde com o ♻ e um halo pulsando; 'sujo': saco marrom com um X
// vermelho e uma borda de perigo (nunca verde, nunca com halo). Devolve a lista de objetos (a ponte apaga).
export function desenharItemDaRegra(cena, caixa, item, tipo) {
  const r = item.raio
  const g = cena.add.graphics().setDepth(7).setPosition(item.x, item.y)
  if (tipo === 'limpo') {
    g.fillStyle(COR_RECICLA, 0.22).fillCircle(0, 0, r + 6) // halo
    g.fillStyle(0x1a6a34, 1).fillRoundedRect(-r + 1, -r, (r - 1) * 2, r * 2, 4)
    g.fillStyle(COR_RECICLA, 1).fillRoundedRect(-r + 2, -r + 1, (r - 2) * 2, r * 2 - 2, 3)
    g.fillStyle(0xb9ffcc, 0.7).fillRect(-r + 4, -r + 3, 2, r * 2 - 7)
    g.lineStyle(2, 0xffffff, 0.95).strokeRoundedRect(-r + 1, -r, (r - 1) * 2, r * 2, 4)
    simboloReciclar(g, 0, 1, r * 0.5, 0xffffff, 1.6)
    cena.tweens.add({ targets: g, scale: { from: 0.92, to: 1.1 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  } else {
    g.fillStyle(0x2a120a, 1).fillCircle(0, 0, r + 1)
    g.fillStyle(COR_SUJO, 1).fillCircle(0, 0, r - 1)
    // borda de perigo: tracejado amarelo e preto
    for (let k = 0; k < 10; k++) {
      const a0 = (k * Math.PI * 2) / 10
      g.lineStyle(2, k % 2 ? 0x111111 : 0xffd23c, 1).beginPath().arc(0, 0, r - 0.5, a0, a0 + (Math.PI * 2) / 10).strokePath()
    }
    g.lineStyle(3, 0xff3a3a, 1)
    g.lineBetween(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4)
    g.lineBetween(-r * 0.4, r * 0.4, r * 0.4, -r * 0.4)
    cena.tweens.add({ targets: g, angle: { from: -8, to: 8 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }
  caixa?.recortar(g)
  return [g]
}

// o estouro verde de um item pego (ou o roxo-marrom do contaminado)
export function estouroDoItem(cena, x, y, tipo) {
  particulas(cena, x, y, { cor: tipo === 'limpo' ? COR_RECICLA : COR_SUJO, quantidade: 12, velocidade: 130 })
}

// A LIXEIRA do HUD: uma lata verde com o ♻, o nome e uma barra de gomos que enche; cheia, pisca e lança o míssil.
//   atualizar(cheio, max, { ganhou })  · cheia() (o pisca) · posicao  { x, y } da boca (de onde o míssil sai)
export function criarLixeira(cena, { x, y }) {
  const c = cena.add.container(x, y).setDepth(27)
  const fundo = cena.add.graphics()
  const gomos = cena.add.graphics()
  const titulo = cena.add.text(0, -57, 'LIXEIRA', estilo(8, '#9dffb0', { strokeThickness: 3 })).setOrigin(0.5)
  const nota = cena.add.text(0, 53, '', estilo(8, '#ffffff', { strokeThickness: 3, align: 'center' })).setOrigin(0.5, 0)
  fundo.fillStyle(0x08140c, 0.82).fillRoundedRect(-17, -48, 34, 100, 6)
  fundo.lineStyle(2, COR_RECICLA, 0.9).strokeRoundedRect(-17, -48, 34, 100, 6)
  simboloReciclar(fundo, 0, -35, 7, 0x9dffb0, 1.6)
  c.add([fundo, gomos, titulo, nota])
  const GOMOS_Y0 = 46
  const estado = { cheio: 0, max: 12 }
  const redesenhar = () => {
    gomos.clear()
    const n = Math.max(1, Math.round(estado.max / 2))
    const alto = 62 / n
    const acesos = Math.floor((estado.cheio / estado.max) * n + 1e-6)
    for (let k = 0; k < n; k++) {
      const yk = GOMOS_Y0 - (k + 1) * alto + 1
      const aceso = k < acesos
      gomos.fillStyle(aceso ? COR_RECICLA : 0x1c2e22, aceso ? 1 : 0.9).fillRect(-10, yk, 20, alto - 2)
      if (aceso) gomos.fillStyle(0xd8ffe0, 0.45).fillRect(-10, yk, 20, 2)
    }
  }
  redesenhar()
  const objetos = [c]
  return {
    objetos,
    container: c,
    posicao: { x, y: y - 40 },
    atualizar(cheio, max, { ganhou = 0 } = {}) {
      estado.cheio = cheio
      estado.max = max
      redesenhar()
      if (ganhou > 0) {
        cena.tweens.killTweensOf(c)
        c.setScale(1)
        cena.tweens.add({ targets: c, scale: 1.14, duration: 110, yoyo: true, ease: 'Quad.easeOut' })
      }
    },
    nota(texto, cor = '#ffffff') {
      nota.setText(semLigaduras(texto)).setColor(cor)
    },
    cheia() {
      cena.tweens.add({ targets: c, scale: 1.3, duration: 130, yoyo: true, repeat: 2 })
      const flash = cena.add.rectangle(x, y, 38, 104, 0xffffff, 0.8).setDepth(28)
      cena.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() })
    },
    destroy() {
      cena.tweens.killTweensOf(c)
      c.destroy()
    },
  }
}

// O MÍSSIL RECICLADO: sai da lixeira, sobe em arco até o chefe e explode (aoChegar roda no impacto). Só enfeite.
export function lancarMissil(cena, de, para, { ms = 420, aoChegar = null } = {}) {
  const g = cena.add.graphics().setDepth(40)
  g.fillStyle(0xffffff, 1).fillRoundedRect(-4, -11, 8, 20, 3)
  g.fillStyle(COR_RECICLA, 1).fillTriangle(-4, -11, 4, -11, 0, -19)
  g.fillStyle(COR_RECICLA, 1).fillTriangle(-4, 6, -9, 12, -4, 12).fillTriangle(4, 6, 9, 12, 4, 12)
  simboloReciclar(g, 0, -1, 3, COR_RECICLA, 1)
  g.setPosition(de.x, de.y)
  tocar(cena, 'voo')
  const meio = { x: (de.x + para.x) / 2 + (para.x >= de.x ? -50 : 50), y: Math.min(de.y, para.y) - 30 }
  const t = { p: 0 }
  let ultimaFumaca = 0
  cena.tweens.add({
    targets: t,
    p: 1,
    duration: ms,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      const u = 1 - t.p
      const x = u * u * de.x + 2 * u * t.p * meio.x + t.p * t.p * para.x
      const y = u * u * de.y + 2 * u * t.p * meio.y + t.p * t.p * para.y
      const ang = Math.atan2(y - g.y, x - g.x)
      if (x !== g.x || y !== g.y) g.setRotation(ang + Math.PI / 2)
      g.setPosition(x, y)
      if (t.p - ultimaFumaca > 0.08) {
        ultimaFumaca = t.p
        particulas(cena, x, y + 6, { cor: 0xd8ffe0, quantidade: 2, velocidade: 30, vida: 300 })
      }
    },
    onComplete: () => {
      g.destroy()
      tocar(cena, 'explosaoGrande')
      flashTela(cena, COR_RECICLA, 0.35, 260)
      shake(cena, 260, 0.012)
      particulas(cena, para.x, para.y, { cor: COR_RECICLA, quantidade: 34, velocidade: 240, vida: 700 })
      particulas(cena, para.x, para.y, { cor: 0xffffff, quantidade: 14, velocidade: 150, vida: 500 })
      aoChegar?.()
    },
  })
}
