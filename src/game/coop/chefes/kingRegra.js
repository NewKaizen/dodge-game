// TABULEIRO REAL: a REGRA do Chaos King (coop/regraChefe.js). O quadro vira um tabuleiro, as peças piscam as
// casas que vão golpear (kingAtaques.js) e, nas cartas de XEQUE, uma peça prende UM coração numa gaiola:
// o parceiro tem de CAPTURAR a peça pisando na casa dela antes do golpe. Na fase 3, o ROQUE troca os
// corações de lado e um peão chega ao fim e vira RAINHA.
//
// Rede: o XEQUE sai só do estado (api.rng, quem está de pé, onde cada coração NASCE), igual em todos os PCs;
// o que um coração faz (pisar na casa da captura) é uma zona (api.adicionarZona): só o PC dono dele decide e
// a API repassa. A gaiola só empurra o coração que é deste PC (api.empurrar).
import { kingOnda, golpearCasas, criarIcone, apagarIcone } from './kingAtaques.js'
import { criarGrade, retanguloDe, retanguloDaGaiola, empurraoParaDentro, empurraoDoRoque, planejarXeque, TABULEIRO } from './kingTabuleiro.js'
import { tocar } from '../../audio.js'

const OURO = 0xffd23c
const TEXTO_OURO = '#ffd23c'

// espec = { [id do chefe]: { [nome da carta]: { cfg, xeque?: { aviso, peca }, roque?: true } } }
// opcoes: { nome, descricao, fases, espec, tabuleiro }
export function criarRegraKing({ id = 'tabuleiro', nome = 'TABULEIRO REAL', descricao, fases, espec }) {
  return {
    id,
    nome,
    descricao,
    fases,
    criar(api) {
      // o estado da rodada (zera no fim da esquiva)
      let gaiola = null // { j, ret } enquanto o coração j está preso
      let captura = null // { zona, x, y } a casa da peça a capturar
      const vivos = () => api.jogadores().map((j) => !j.caido)
      const limites = (cfg) => {
        const l = api.limites()
        return criarGrade({ x: l.x, y: l.y, width: l.width, height: l.height }, cfg.tabuleiro ?? TABULEIRO)
      }

      // ---- XEQUE ----
      function iniciarXeque(a, grade, plano, xeque) {
        const ret = retanguloDaGaiola(grade, plano.gaiola)
        const q = retanguloDe(grade, plano.captura.c, plano.captura.r)
        const aviso = Math.max(2300, Math.round(xeque.aviso / Math.sqrt(Math.max(1, a.ritmo.velocidade))))
        let resolvido = false
        gaiola = { j: plano.j, ret }

        // a gaiola: grades douradas em volta das casas 2 x 2 e uma seta verde (a SAÍDA) para cima
        const g = a.cena.add.graphics().setDepth(4.4)
        g.fillStyle(OURO, 0.22).fillRect(ret.left, ret.top, ret.right - ret.left, ret.bottom - ret.top)
        g.lineStyle(3, OURO, 1).strokeRect(ret.left + 1, ret.top + 1, ret.right - ret.left - 2, ret.bottom - ret.top - 2)
        g.lineStyle(2, OURO, 0.85)
        for (let x = ret.left + 14; x < ret.right - 6; x += 14) g.lineBetween(x, ret.top + 1, x, ret.bottom - 1)
        a.decoracao(g)
        const seta = a.cena.add.graphics().setDepth(4.5)
        const sx = (ret.left + ret.right) / 2
        seta.fillStyle(0x6dff8a, 0.9).fillTriangle(sx, ret.top + 9, sx - 7, ret.top + 21, sx + 7, ret.top + 21)
        a.decoracao(seta)
        a.cena.tweens.add({ targets: seta, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 })
        const contagem = a.cena.add
          .text(sx, (ret.top + ret.bottom) / 2 + 8, '', { fontFamily: 'monospace', fontSize: '22px', color: TEXTO_OURO, stroke: '#000000', strokeThickness: 4 })
          .setOrigin(0.5)
          .setDepth(4.7)
        a.decoracao(contagem)

        // a peça do xeque (torre ou rainha) na casa que se captura: a casa fica dourada
        const icone = criarIcone(a, grade, xeque.peca ?? 'torre', plano.captura.c, plano.captura.r, { escala: 0.86 })
        const zona = api.adicionarZona({
          x: q.cx,
          y: q.cy,
          largura: q.largura,
          altura: q.altura,
          cor: OURO,
          alpha: 0.28,
          aoEntrar: (j) => capturar(j),
        })
        captura = { zona, x: q.cx, y: q.cy }
        const marca = a.cena.add.graphics().setDepth(4.55)
        marca.lineStyle(3, OURO, 1).strokeRect(q.x + 2, q.y + 2, q.largura - 4, q.altura - 4)
        a.decoracao(marca)
        a.cena.tweens.add({ targets: marca, alpha: 0.3, duration: 320, yoyo: true, repeat: -1 })
        const rotulo = a.cena.add.text(q.cx, q.y + q.altura + 6, 'CAPTURE!', { fontFamily: 'monospace', fontSize: '13px', color: TEXTO_OURO, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(4.7)
        a.decoracao(rotulo)

        api.banner('XEQUE!', TEXTO_OURO)
        api.dica('xeque', 'XEQUE! Um de vocês está preso: o outro pisa na casa da peça dourada para CAPTURAR.')
        tocar(a.cena, 'tensao')

        const soltar = () => {
          gaiola = null
          for (const o of [g, seta, contagem, marca, rotulo]) {
            a.cena.tweens.killTweensOf(o)
            a.cena.tweens.add({ targets: o, alpha: 0, duration: 260, onComplete: () => o.destroy?.() })
          }
          apagarIcone(a, icone)
        }
        let golpe = null
        const capturar = () => {
          if (resolvido) return
          resolvido = true
          golpe?.cancelar()
          if (captura) api.removerZona(captura.zona)
          captura = null
          api.adicionarQuebra(25, 'xeque')
          api.banner('CAPTURA!', '#6dff8a')
          tocar(a.cena, 'combo')
          soltar()
        }
        // o golpe: as quatro casas da gaiola, depois do aviso (cancelado se capturaram)
        golpe = golpearCasas(a, grade, plano.gaiola.casas, {
          aviso,
          golpe: 380,
          aoGolpear: () => {
            resolvido = true
            api.removerZona(captura.zona)
            captura = null
            a.depois(450, soltar)
          },
        })
        // 3, 2, 1 em cima da gaiola
        for (let k = 0; k < 3; k++) {
          const falta = Math.round(aviso - (k + 1) * (aviso / 3))
          a.depois(falta, () => !resolvido && contagem.scene && contagem.setText(String(3 - k)))
        }
        a.depois(aviso + 30, () => contagem.scene && contagem.setText(''))
        a.depois(0, () => contagem.scene && contagem.setText('3'))
      }

      // ---- ROQUE ----
      function iniciarRoque(a, grade) {
        a.depois(380, () => {
          api.banner('ROQUE!', '#9be7ff')
          api.dica('roque', 'ROQUE: os corações trocam de lado! Olhem onde as peças piscam depois.')
          tocar(a.cena, 'inverter')
          const g = a.cena.add.graphics().setDepth(4.8)
          const y = grade.top + grade.height / 2
          const cx = grade.left + grade.width / 2
          g.lineStyle(4, 0x9be7ff, 0.9)
          g.lineBetween(cx - 60, y - 10, cx + 60, y - 10)
          g.lineBetween(cx - 60, y + 10, cx + 60, y + 10)
          g.fillStyle(0x9be7ff, 0.9).fillTriangle(cx + 74, y - 10, cx + 58, y - 18, cx + 58, y - 2).fillTriangle(cx - 74, y + 10, cx - 58, y + 2, cx - 58, y + 18)
          a.decoracao(g)
          a.cena.tweens.add({ targets: g, alpha: 0.2, duration: 160, yoyo: true, repeat: 3 })
        })
        a.depois(1300, () => {
          for (const c of api.coracoes()) {
            if (!c.ativo || !api.meu(c.j)) continue
            const { dx, dy } = empurraoDoRoque(grade, c.x)
            api.empurrar(c.j, dx, dy)
          }
          tocar(a.cena, 'escudo')
        })
      }

      return {
        // o ataque da carta: o do tabuleiro (as peças), com o XEQUE e o ROQUE se a carta pede
        ataque(carta) {
          const e = espec[carta.chefe]?.[carta.nome]
          if (!e) return null
          const cfg = { ...e.cfg }
          const grade = limites(cfg)
          const plano = e.xeque ? planejarXeque({ grade, vivos: vivos(), sorteio: api.rng('xeque') }) : null
          if (plano) cfg.protegidas = plano.protegidas
          if (plano || e.roque) {
            cfg.aoIniciar = (a, g) => {
              if (plano) iniciarXeque(a, g, plano, e.xeque)
              if (e.roque) iniciarRoque(a, g)
            }
          }
          return kingOnda(cfg)
        },
        comecarEsquiva() {
          gaiola = null
          captura = null
        },
        // a gaiola prende o coração: todo frame, empurra de volta para dentro (só o coração que é deste PC)
        atualizar() {
          if (!gaiola || !api.meu(gaiola.j)) return
          const c = api.coracoes().find((x) => x.j === gaiola.j && x.ativo)
          if (!c) return
          const { dx, dy } = empurraoParaDentro(gaiola.ret, c.x, c.y)
          if (dx || dy) api.empurrar(gaiola.j, dx, dy)
        },
        terminarEsquiva() {
          gaiola = null
          captura = null
        },
        // a CPU aliada: corre para a casa da peça a capturar (quem está preso fica onde está)
        alvoDoBot(j) {
          if (gaiola?.j === j) return null
          return captura ? { x: captura.x, y: captura.y, raio: 10 } : null
        },
        // (testes) o estado da rodada
        estado: () => ({ gaiola, captura }),
      }
    },
  }
}
