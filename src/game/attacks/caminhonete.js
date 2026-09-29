import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// Caminhonete desgovernada. Identidade: a caixa vira uma "estrada" com
// faixas. Os faróis acendem a faixa por onde ela vai passar (aviso amarelo +
// buzina), e a caminhonete atravessa a caixa de uma vez, bem mais rápida que
// qualquer bala. Se `re` estiver ligado, logo depois ela volta DE RÉ por outra
// faixa (a do coração naquele instante), vindo do lado por onde saiu.
//
//   faixas      em quantas faixas a caixa é dividida (sempre sobra ao menos uma livre)
//   ocupar      quantas faixas as caminhonetes ocupam por passada
//   re          ms até a volta de ré (0 desliga)
//   largura     comprimento da caminhonete (px); a altura se ajusta à faixa
//   caixa       estrada larga (aviso antes de mudar)
export default definirAtaque({
  nome: 'caminhonete',
  padrao: {
    duracao: 6000,
    intervalo: 1900,
    velocidade: 400,
    faixas: 3,
    ocupar: 1,
    aviso: 750,
    re: 650,
    largura: 78,
    caixa: { largura: 280, altura: 180 },
  },
  iniciar(a, cfg) {
    const COR_FAROL = 0xffe07a
    const ocupar = Math.min(cfg.ocupar, cfg.faixas - 1)

    const geometria = () => {
      const l = a.caixa
      const h = l.height / cfg.faixas
      return { l, h, y: (i) => l.top + h * (i + 0.5), faixaDe: (y) => Math.min(cfg.faixas - 1, Math.max(0, Math.floor((y - l.top) / h))) }
    }

    // escolhe `n` faixas, a primeira sendo a do coração
    const escolher = (n, evitar = []) => {
      const { faixaDe } = geometria()
      const lista = [faixaDe(a.alvo().y)]
      if (evitar.includes(lista[0])) lista[0] = (lista[0] + 1) % cfg.faixas
      while (lista.length < n) {
        const f = a.inteiro(0, cfg.faixas - 1)
        if (!lista.includes(f)) lista.push(f)
      }
      return lista
    }

    const passar = (faixas, daEsquerda, deRe, aviso) => {
      const { l, h, y } = geometria()
      const altura = Math.min(40, h - 10)
      a.parede({ eixo: 'y', ocupados: faixas.map((f) => [y(f) - altura / 2, y(f) + altura / 2]) })
      tocar(a.cena, 'buzina')
      for (const f of faixas) {
        a.aviso({ tipo: 'area', x: l.left, y: y(f) - altura / 2, largura: l.width, altura, ms: aviso, cor: COR_FAROL }, () => {
          const dir = daEsquerda ? 1 : -1
          const b = a.bala({
            x: daEsquerda ? l.left - cfg.largura / 2 - 10 : l.right + cfg.largura / 2 + 10,
            y: y(f),
            vx: dir * cfg.velocidade * (deRe ? 0.8 : 1),
            largura: cfg.largura,
            altura,
            forma: 'caminhonete',
            cor: 0xffffff,
            pulso: 0,
            jaAvisada: true,
          })
          // de ré a frente fica para trás: o desenho aponta contra o movimento
          b.sprite.setFlipX(deRe ? dir > 0 : dir < 0)
          tocar(a.cena, 'motor')
          a.cena.cameras.main.shake(160, 0.005)
        })
      }
    }

    a.aCada(
      cfg.intervalo,
      (i) => {
        const daEsquerda = i % 2 === 0
        const ida = escolher(ocupar)
        passar(ida, daEsquerda, false, cfg.aviso)
        // de ré: volta pelo lado por onde saiu, em outra faixa
        if (cfg.re > 0) a.depois(cfg.re, () => passar(escolher(ocupar, ida), !daEsquerda, true, Math.max(450, cfg.aviso * 0.7)))
      },
      Infinity,
      200,
    )
  },
})
