import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'
import { tocar } from '../audio.js'

// Caminhonete: TRÂNSITO. A caixa vira uma estrada com faixas e as
// caminhonetes passam em FILA (estilo Frogger): cada faixa tem o seu sentido
// (alternados) e a sua velocidade, e sempre sobra espaço entre uma caminhonete
// e a próxima. O jogo é costurar o trânsito: entrar no vão, andar junto com
// ele, trocar de faixa quando o vão chega na borda.
// Às vezes (`re`) uma caminhonete FREIA no meio do caminho (luz de freio e
// "pi-pi-pi" de ré) e volta de ré por onde veio.
//
// Justiça:
//   - toda caminhonete é anunciada pelos faróis piscando na entrada da faixa
//     (`aviso` ms) antes de aparecer;
//   - numa faixa, a distância entre duas caminhonetes seguidas é sempre >=
//     `vao` (+ comprimento): o vão tem mais que LACUNA_MINIMA;
//   - a ré só acontece se não houver outra caminhonete atrás dela na faixa
//     (ela nunca esmaga o vão de trás), com luz de freio `avisoRe` ms antes;
//   - as caminhonetes ocupam a faixa quase toda: entre uma faixa e outra sobra
//     só uma fresta mais fina que o coração (não dá para morar nela).
//
//   faixas      quantas faixas (a caixa inteira é estrada)
//   velocidade  px/s médios; cada faixa varia entre 75% e 125% disso
//   intervalo   ms médios entre duas caminhonetes na mesma faixa
//   vao         distância mínima (px) entre uma caminhonete e a próxima na faixa
//   re          chance (0..1) de uma caminhonete dar ré no meio da caixa
//   aviso       ms dos faróis piscando antes de ela entrar
//   avisoRe     ms da luz de freio antes da ré
//   largura     comprimento da caminhonete (px); a altura se ajusta à faixa
//   caixa       estrada larga (aviso antes de mudar)
export default definirAtaque({
  nome: 'caminhonete',
  padrao: {
    duracao: 6000,
    faixas: 3,
    velocidade: 120,
    intervalo: 1500,
    vao: 70,
    re: 0,
    aviso: 520,
    avisoRe: 480,
    largura: 80,
    caixa: { largura: 280, altura: 180 },
  },
  iniciar(a, cfg) {
    const COR_FAROL = 0xffe07a
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const avisoRe = Math.max(ATAQUE.telegrafoMs, cfg.avisoRe)
    const geometria = () => {
      const l = a.caixa
      const h = l.height / cfg.faixas
      return { l, h, y: (i) => l.top + h * (i + 0.5), altura: Math.max(14, h - 8) }
    }

    // a estrada: tracejado entre as faixas (enfeite)
    const pista = a.decoracao(a.cena.add.graphics().setDepth(1))
    a.aoAtualizar(() => {
      const { l, h } = geometria()
      pista.clear().fillStyle(0x2a2630, 0.55).fillRect(l.left, l.top, l.width, l.height)
      pista.fillStyle(0xffe07a, 0.5)
      const deslize = (a.tempo * 0.05) % 24
      for (let i = 1; i < cfg.faixas; i++) {
        for (let x = l.left - 24 + deslize; x < l.right; x += 24) pista.fillRect(Math.max(l.left, x), l.top + h * i - 1, 12, 2)
      }
    })

    // cada faixa: sentido alternado, velocidade própria e a fila dela
    const faixas = Array.from({ length: cfg.faixas }, (_, i) => ({
      i,
      dir: i % 2 === 0 ? 1 : -1,
      velocidade: cfg.velocidade * a.aleatorio(0.75, 1.25),
      fila: [], // caminhonetes vivas, da mais nova para a mais velha
      proxima: a.aleatorio(0, cfg.intervalo * 0.8),
    }))
    a.lacuna(cfg.vao, 'vão entre caminhonetes')

    const entrar = (f) => {
      const { l, y, altura } = geometria()
      const dir = f.dir
      const borda = dir > 0 ? l.left : l.right
      // faróis piscando na entrada da faixa
      f.pendente = true
      a.aviso({ tipo: 'area', x: dir > 0 ? l.left : l.right - 34, y: y(f.i) - altura / 2, largura: 34, altura, ms: aviso, cor: COR_FAROL }, () => {
        f.pendente = false
        const vel = f.velocidade
        const b = a.bala({
          x: borda - dir * (cfg.largura / 2 + 4),
          y: y(f.i),
          vx: dir * vel,
          largura: cfg.largura,
          altura,
          forma: 'caminhonete',
          cor: 0xffffff,
          pulso: 0,
          jaAvisada: true,
        })
        b.sprite.setFlipX(dir < 0)
        f.fila.unshift(b)
        tocar(a.cena, 'motor')
        // ré: freia no meio da caixa e volta, se não tiver ninguém atrás dela
        if (cfg.re > 0 && a.aleatorio(0, 1) < cfg.re) {
          const meio = (l.width * a.aleatorio(0.35, 0.6)) / vel
          a.depois(meio * 1000, () => darRe(f, b))
        }
      })
    }

    const darRe = (f, b) => {
      if (b.morta || f.fila[0] !== b || f.pendente) return // tem alguém atrás (ou entrando): não dá ré
      const vx = b.vx
      b.vx = 0
      b.sprite.setTint(0xff6a6a) // luz de freio
      tocar(a.cena, 'buzina')
      f.bloqueada = true // ninguém entra na faixa enquanto ela dá ré
      a.depois(avisoRe, () => {
        if (b.morta) return
        b.sprite.clearTint()
        b.sprite.setFlipX(!b.sprite.flipX)
        b.vx = -vx * 0.9
        a.depois(((a.caixa.width + cfg.largura) / Math.abs(b.vx)) * 1000, () => (f.bloqueada = false))
      })
    }

    a.aoAtualizar((dt) => {
      const { l } = geometria()
      for (const f of faixas) {
        f.fila = f.fila.filter((b) => !b.morta)
        f.proxima -= dt * (a.ritmo?.densidade ?? 1) // o ritmo do nível deixa o trânsito mais cheio
        if (f.proxima > 0 || f.bloqueada || f.pendente) continue
        // só entra se a última que entrou já abriu `vao` da borda
        const ultima = f.fila[0]
        const borda = f.dir > 0 ? l.left : l.right
        const andou = ultima ? (ultima.x - borda) * f.dir - cfg.largura / 2 : Infinity
        if (andou < cfg.vao - (f.velocidade * aviso) / 1000) continue
        f.proxima = cfg.intervalo * a.aleatorio(0.8, 1.25)
        entrar(f)
      }
    })
  },
})
