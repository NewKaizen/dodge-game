import { FONTE } from '../../../../constants.js'
import { RES } from '../../../../resolucao.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { semLigaduras } from '../../../../campanha/texto.js'
import { fatores } from '../../../../acessibilidade.js'
import { planoCamera, quadroDoFeed, ANGULOS, CAMERA, fatorDoPlano } from './planos.js'
import { avisoNasCaixas, tocar } from './util.js'

// CÂMERA DE SEGURANÇA (CIDADE GRANDE): a caixa passa a ser vista por uma câmera de segurança velha:
//   - imagem em PRETO E BRANCO (filtro ColorMatrix na câmera da caixa), linhas de varredura, chuvisco e
//     uma faixa de "tracking" que desce; o coração ganha um enquadramento (a imagem cinza esconde a cor);
//   - a imagem só ATUALIZA 7 vezes por segundo (CAMERA.fps, sempre o mesmo ritmo): coração e balas
//     aparecem sempre onde estavam no último quadro do feed. A SIMULAÇÃO segue lisa e ao vivo (a hitbox é a
//     real): o que atrasa é só o que você VÊ. Implementação: depois de cada frame, os objetos da caixa
//     (caixa.recortados) voltam para a posição do último quadro do feed e, antes do frame seguinte, para a
//     posição de verdade (passo());
//   - de tempos em tempos a câmera TROCA DE ÂNGULO: "CAM 2" espelha esquerda/direita, "CAM 3" cima/baixo
//     (CAM 1 é a imagem normal). Aviso de 850 ms (o rótulo pisca e vira "CAM 2?"). O espelho é só da imagem:
//     o controle continua o mesmo. A CPU não depende da imagem (decide pela simulação), só perde o brilho
//     da leitura "ao vivo": ela erra um pouquinho mais logo depois de cada troca de ângulo.
// O plano (planoCamera) é o mesmo nas duas caixas.

const TIPOS_FIXOS = new Set(['Graphics', 'Text', 'Container', 'RenderTexture', 'DynamicTexture']) // desenhados/animados por conta própria

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = []
  let cam = 1
  let proxima = 0
  let anunciado = -1
  let quadroAnterior = -1
  let chiado = 0 // ms de chuvisco forte depois de uma troca
  let visuais = [] // por pista
  let aoPosUpdate = null
  let avisos = []

  const meus = new Set() // objetos do próprio evento (não congelam)

  // ---------- feed congelado ----------
  const tirarFoto = (v) => {
    v.foto.clear()
    for (const o of v.pista.caixa.recortados) {
      if (!o.scene || meus.has(o) || TIPOS_FIXOS.has(o.type)) continue
      v.foto.set(o, { x: o.x, y: o.y, rotation: o.rotation, scaleX: o.scaleX, scaleY: o.scaleY, alpha: o.alpha, visible: o.visible })
    }
  }

  // o estado de verdade (guardado antes de mostrar o do feed) volta antes de a simulação andar
  const restaurar = (v) => {
    for (const [o, s] of v.verdadeiro) {
      if (!o.scene) continue
      o.setPosition(s.x, s.y).setRotation(s.rotation).setScale(s.scaleX, s.scaleY).setAlpha(s.alpha).setVisible(s.visible)
    }
    v.verdadeiro.clear()
  }

  const mostrarFeed = (v) => {
    for (const o of v.pista.caixa.recortados) {
      if (!o.scene || meus.has(o) || TIPOS_FIXOS.has(o.type)) continue
      v.verdadeiro.set(o, { x: o.x, y: o.y, rotation: o.rotation, scaleX: o.scaleX, scaleY: o.scaleY, alpha: o.alpha, visible: o.visible })
      const f = v.foto.get(o)
      if (f) o.setPosition(f.x, f.y).setRotation(f.rotation).setScale(f.scaleX, f.scaleY).setAlpha(f.alpha).setVisible(f.visible)
      else o.setVisible(false) // nasceu depois do último quadro: ainda não está na imagem
    }
  }

  // ---------- ângulo (espelho da imagem) ----------
  const aplicarAngulo = () => {
    const a = ANGULOS[cam] ?? ANGULOS[1]
    if (cam === 1) return
    const e = RES.escala
    for (const v of visuais) {
      if (v.pista.destruida) continue
      for (const { camera, limites } of v.pista.caixa.recortes) {
        camera.setZoom(e)
        camera.zoomX = a.espelhoX ? -e : e
        camera.zoomY = a.espelhoY ? -e : e
        camera.setScroll(a.espelhoX ? limites.right : limites.left, a.espelhoY ? limites.bottom : limites.top)
      }
    }
  }

  const restaurarCameras = () => {
    for (const v of visuais) {
      if (v.pista.destruida) continue
      v.pista.caixa.reaplicar?.()
    }
  }

  // ---------- visual ----------
  const criarVisual = (pista) => {
    const caixa = pista.caixa
    const filtros = []
    const ligar = (camera) => {
      const f = camera?.filters?.internal?.addColorMatrix?.()
      if (f) {
        f.colorMatrix.grayscale(1)
        filtros.push([camera, f])
      }
    }
    ligar(caixa.camera)
    ligar(caixa.cameraFaixa)
    const linhas = arena.add.graphics().setDepth(30)
    const chuvisco = arena.add.graphics().setDepth(31)
    const moldura = arena.add.graphics().setDepth(29)
    caixa.recortar(linhas, chuvisco, moldura)
    const rec = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 1).setDepth(41)
    const hora = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '9px', color: '#d8d8d8', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 1).setDepth(41)
    ignorarNasCaixas(arena, rec, hora)
    const grande = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '22px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(40).setAlpha(0)
    caixa.recortar(grande)
    for (const o of [linhas, chuvisco, moldura, grande]) meus.add(o)
    return { pista, filtros, linhas, chuvisco, moldura, rec, hora, grande, foto: new Map(), verdadeiro: new Map(), faixaY: 0 }
  }

  const desenharLinhas = (v) => {
    const l = v.pista.caixa.limites
    const g = v.linhas
    g.clear()
    g.fillStyle(0x000000, 0.2)
    for (let y = l.top + 1; y < l.bottom; y += 3) g.fillRect(l.left, y, l.width, 1)
    // faixa de "tracking" descendo devagar
    const y0 = l.top + ((v.faixaY % (l.height + 30)) - 20)
    g.fillStyle(0xffffff, 0.07).fillRect(l.left, Math.max(l.top, y0), l.width, Math.min(16, l.bottom - Math.max(l.top, y0)))
    // cantos escuros (lente)
    g.fillStyle(0x000000, 0.18).fillRect(l.left, l.top, l.width, 3).fillRect(l.left, l.bottom - 3, l.width, 3)
  }

  const desenharChuvisco = (v, forte) => {
    const l = v.pista.caixa.limites
    const g = v.chuvisco
    g.clear()
    const n = forte ? 90 : 14
    for (let k = 0; k < n; k++) {
      g.fillStyle(0xffffff, forte ? 0.5 : 0.22 + Math.random() * 0.2)
      g.fillRect(l.left + Math.random() * l.width, l.top + Math.random() * l.height, 1 + Math.random() * (forte ? 8 : 2), 1)
    }
    // de vez em quando um riscado horizontal
    if (forte || Math.random() < 0.18) g.fillStyle(0xffffff, 0.25).fillRect(l.left, l.top + Math.random() * l.height, l.width, 1)
  }

  // enquadramento do coração (como a câmera "detecta o alvo"): usa a posição do FEED
  const desenharMoldura = (v) => {
    const g = v.moldura
    g.clear()
    const c = v.pista.coracoes[0]
    if (!c?.ativo) return
    const f = v.foto.get(c.sprite)
    const x = f?.x ?? c.x
    const y = f?.y ?? c.y
    const r = 13
    g.lineStyle(2, 0xffffff, 0.95)
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.lineBetween(x + sx * r, y + sy * r, x + sx * (r - 6), y + sy * r)
      g.lineBetween(x + sx * r, y + sy * r, x + sx * r, y + sy * (r - 6))
    }
  }

  const textos = (v, falta) => {
    const l = v.pista.caixa.limites
    const aviso = falta !== null && falta > 0
    const pisca = Math.floor(t / 130) % 2 === 0
    v.rec.setPosition(l.left + 1, l.top - 3)
    v.rec.setText(semLigaduras(`● REC  CAM ${aviso ? `${cam}→${plano[proxima]?.cam ?? cam}` : cam}`))
    v.rec.setColor(aviso && pisca ? '#ffd23a' : '#ffffff')
    v.hora.setPosition(l.right - 1, l.top - 3)
    const s = Math.floor(t / 1000)
    v.hora.setText(`00:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
  }

  const trocar = (p) => {
    cam = p.cam
    chiado = 260
    tocar(arena, 'tvCorte')
    for (const v of visuais) {
      v.grande.setText(semLigaduras(`CAM ${cam}`)).setAlpha(1)
      arena.tweens.add({ targets: v.grande, alpha: 0, delay: 500, duration: 300 })
      arena.tweens.add({ targets: v.grande, scale: { from: 1.6, to: 1 }, duration: 200, ease: 'Back.easeOut' })
    }
  }

  const anunciar = (p) => {
    tocar(arena, 'aviso')
    for (const v of visuais) {
      v.grande.setText(semLigaduras(`CAM ${p.cam}?`)).setAlpha(0.9)
      arena.tweens.add({ targets: v.grande, alpha: { from: 0.2, to: 0.95 }, yoyo: true, repeat: 2, duration: 130 })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoCamera(sorte)
      cam = 1
      proxima = 0
      anunciado = -1
      quadroAnterior = -1
      chiado = 0
      visuais = arena.pistas.map(criarVisual)
      avisos = avisoNasCaixas(arena, 'VOCÊ VÊ PELA CÂMERA!', { cor: '#e0e0e0', ms: 1300, atraso: 100 })
      aoPosUpdate = () => aplicarAngulo()
      arena.events.on('postupdate', aoPosUpdate)
      tocar(arena, 'tvVinheta')
    },

    // a pista vai andar neste frame: o estado de verdade volta antes
    passo(j, delta) {
      const v = visuais[j]
      if (ativo && v) restaurar(v)
      return delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      chiado = Math.max(0, chiado - delta)
      const p = plano[proxima]
      if (p) {
        if (anunciado < proxima && t >= p.avisoEm) {
          anunciado = proxima
          anunciar(p)
        }
        if (t >= p.em) {
          trocar(p)
          proxima++
        }
      }
      const falta = p && anunciado === proxima ? p.em - t : null
      const quadro = quadroDoFeed(t, CAMERA.fps)
      const novo = quadro !== quadroAnterior
      quadroAnterior = quadro
      const calmo = fatores().piscar === false
      for (const v of visuais) {
        if (v.pista.destruida) continue
        v.faixaY += delta * 0.04
        if (novo) {
          tirarFoto(v) // quadro novo do feed: a imagem é atualizada
          desenharLinhas(v)
          desenharChuvisco(v, chiado > 0 && !calmo)
        }
        desenharMoldura(v)
        mostrarFeed(v)
        textos(v, falta)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), cam, quadro: quadroAnterior, fps: CAMERA.fps, proxima, objetosNoFeed: visuais.map((v) => v.foto.size), plano: plano.slice(0, 3).map((p) => ({ em: Math.round(p.em), cam: p.cam })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      if (aoPosUpdate) arena.events.off('postupdate', aoPosUpdate)
      aoPosUpdate = null
      for (const v of visuais) {
        restaurar(v)
        for (const [camera, f] of v.filtros) camera?.filters?.internal?.remove?.(f)
        arena.tweens.killTweensOf(v.grande)
        for (const o of [v.linhas, v.chuvisco, v.moldura, v.grande, v.rec, v.hora]) o.destroy()
      }
      restaurarCameras()
      visuais = []
      meus.clear()
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
      cam = 1
    },
  }
}
