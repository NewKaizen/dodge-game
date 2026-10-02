import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'

// Forcado. Identidade: três dentes paralelos que entram pela lateral numa
// estocada, param lá dentro por um instante e voltam. Um dente mira a fileira
// do coração, então o jeito é se enfiar NO VÃO entre os dentes (ou fugir para
// cima/baixo). As linhas de cada dente piscam antes (até onde a ponta chega).
//
// Para ficar parado nunca dar certo:
//   profundidade  o dente do meio entra mais fundo (e é mais comprido): na
//                 fileira dele não existe canto seguro do outro lado da caixa.
//   rastrear      enquanto está lá dentro, o forcado desliza na vertical
//                 puxando o dente mais próximo para a fileira do coração. Só
//                 persegue quem está DENTRO da mandíbula (entre o primeiro e o
//                 último dente): os vãos andam juntos com o forcado e nunca
//                 encolhem, então ninguém é esmagado; basta ir acompanhando.
//   pinca         a cada `pinca` estocadas, uma pinça: um forcado de cada lado,
//                 cada um até a metade da caixa, o segundo com os dentes
//                 deslocados meio vão e um pouco depois. O vão seguro da
//                 esquerda é a fileira de um dente na direita, e vice-versa.
//
// Justiça: um forcado (ou uma pinça) por vez. Quando o próximo é anunciado, os
// anteriores são puxados de volta antes de ele chegar e, se ainda sobrar algum
// dente na caixa quando o novo chega, ele vira inofensivo. Assim os vãos de dois forcados nunca se
// somam. Na pinça os dois lados não se cruzam (cada um vai até a metade).
//
// Config:
//   dentes        quantidade de dentes
//   vao           distância entre dentes (px); o vão livre é vao - espessura
//   alcance       até onde a ponta dos dentes de fora entra (fração da largura)
//   profundidade  quanto o(s) dente(s) do meio entra(m) a mais (fração; 0 desliga)
//   parada        ms parado lá dentro antes de voltar
//   retorno       velocidade da volta (fração de `velocidade`)
//   rastrear      px/s do deslize vertical (0 desliga)
//   rastreioMax   quanto o forcado pode deslizar da fileira avisada (px)
//   pinca         uma pinça a cada N estocadas (0 desliga)
//   atrasoPinca   ms entre os dois lados da pinça
export default definirAtaque({
  nome: 'forcado',
  padrao: {
    duracao: 5500,
    intervalo: 1500,
    velocidade: 360,
    comprimento: 170,
    espessura: 9,
    dentes: 3,
    vao: 64,
    alcance: 0.8,
    profundidade: 0.2,
    parada: 260,
    retorno: 0.8,
    rastrear: 60,
    rastreioMax: 32,
    pinca: 3,
    atrasoPinca: 300,
    aviso: 600,
    forma: 'barra',
  },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    // dentes no ar ({ bala, geracao, recolher(v) }) e a geração mais nova que já chegou
    const turno = { vivos: [], chegou: 0 }

    a.aCada(
      cfg.intervalo,
      (i) => {
        const geracao = i + 1
        // anunciou o próximo: perto de ele chegar, os anteriores são puxados de
        // volta rápido (o que ainda sobrar na caixa quando ele chegar é desarmado)
        a.depois(aviso * 0.6, () => {
          const pressa = (a.caixa.width * 1.05) / ((aviso * 0.4) / 1000)
          for (const v of turno.vivos) if (v.geracao < geracao && !v.bala.morta) v.recolher(pressa)
        })

        const daEsquerda = i % 2 === 0
        const pinca = cfg.pinca > 0 && (i + 1) % cfg.pinca === 0
        const comum = { a, cfg, aviso, turno, geracao }
        if (!pinca) {
          estocar({ ...comum, daEsquerda, centro: a.alvo().y, alcance: cfg.alcance, fundo: cfg.alcance + cfg.profundidade })
          return
        }
        // pinça: cada lado só até a metade (os dois nunca ocupam o mesmo x)
        const metade = Math.min(cfg.alcance, 0.5)
        const yc = estocar({ ...comum, daEsquerda, centro: a.alvo().y, alcance: metade, fundo: metade })
        a.depois(cfg.atrasoPinca, () => {
          const meioVao = vaoDe(a.caixa, cfg) / 2
          // meio vão para baixo; se não couber (preso na borda), para cima
          const cabeAbaixo = yc + meioVao <= centroMax(a.caixa, cfg)
          estocar({ ...comum, daEsquerda: !daEsquerda, centro: yc + (cabeAbaixo ? meioVao : -meioVao), alcance: metade, fundo: metade })
        })
      },
      Infinity,
      300,
    )
  },
})

// Vão entre dentes: se os dentes não cabem na caixa, aperta (o validador avisa se ficar estreito demais)
function vaoDe(l, cfg) {
  return cfg.dentes > 1 ? Math.min(cfg.vao, (l.height - 2 * cfg.espessura) / (cfg.dentes - 1)) : 0
}
const extensaoDe = (l, cfg) => ((cfg.dentes - 1) / 2) * vaoDe(l, cfg)
const centroMin = (l, cfg) => l.top + cfg.espessura + extensaoDe(l, cfg)
const centroMax = (l, cfg) => l.bottom - cfg.espessura - extensaoDe(l, cfg)
const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

// Um forcado entrando por um lado. Devolve o centro (y) usado.
//   alcance  ponta dos dentes de fora; fundo  ponta do(s) dente(s) do meio
function estocar({ a, cfg, aviso, turno, geracao, daEsquerda, centro, alcance, fundo }) {
  const l = a.caixa
  const dir = daEsquerda ? 1 : -1
  const meio = (cfg.dentes - 1) / 2
  const vao = vaoDe(l, cfg)
  // centraliza no pedido, mas mantém todos os dentes dentro da caixa
  const yc = limitar(centro, centroMin(l, cfg), Math.max(centroMin(l, cfg), centroMax(l, cfg)))
  const ys = Array.from({ length: cfg.dentes }, (_, k) => yc + (k - meio) * vao)
  a.parede({ eixo: 'y', ocupados: ys.map((y) => [y - cfg.espessura / 2, y + cfg.espessura / 2]) })

  // estado do forcado inteiro (todos os dentes deslizam juntos)
  const garfo = { ys, desloc: 0, quadro: -1, recolhendo: false }
  const borda = daEsquerda ? l.left : l.right
  const fundoReal = Math.min(1, Math.max(alcance, fundo))

  ys.forEach((y, k) => {
    // dente(s) do meio: mais fundo e mais comprido (o cabo continua cobrindo a entrada)
    const r = Math.abs(k - meio) < 1 ? fundoReal : alcance
    const comprimento = cfg.comprimento + (r - alcance) * l.width
    const ponta = borda + dir * l.width * r
    const paradaX = ponta - (dir * comprimento) / 2
    const inicioX = borda - (dir * comprimento) / 2

    a.aviso({ tipo: 'linha', x1: borda, y1: y, x2: ponta, y2: y, espessura: cfg.espessura, ms: aviso }, () => {
      // um forcado mais novo já chegou (pinça atrasada num ritmo muito rápido): este não entra
      if (turno.chegou > geracao) return
      turno.chegou = geracao
      // chegou: o que sobrou de forcados anteriores não machuca mais
      for (const v of turno.vivos) if (v.geracao < geracao && !v.bala.morta && !v.bala.inofensiva) desarmar(a, v.bala)

      let estado = 'entrando'
      let parado = 0
      const bala = a.bala({
        x: inicioX,
        y,
        vx: dir * cfg.velocidade,
        largura: comprimento,
        altura: cfg.espessura,
        forma: cfg.forma,
        jaAvisada: true,
        atualizar: (b, dt) => {
          rastrear(a, cfg, garfo, dt)
          b.y = y + garfo.desloc
          if (estado === 'entrando' && (b.x - paradaX) * dir >= 0) {
            b.x = paradaX
            b.vx = 0
            estado = 'parado'
          } else if (estado === 'parado' && (parado += dt) >= cfg.parada) {
            voltar(cfg.velocidade * cfg.retorno)
          } else if (estado === 'voltando' && (b.x + (dir * comprimento) / 2 - borda) * dir <= 0) {
            b.morta = true // a ponta saiu da caixa: some
          }
        },
      })
      const voltar = (velocidade) => {
        estado = 'voltando'
        garfo.recolhendo = true
        bala.vx = -dir * Math.max(velocidade, Math.abs(bala.vx))
      }
      const { vivos } = turno
      for (let j = vivos.length - 1; j >= 0; j--) if (vivos[j].bala.morta) vivos.splice(j, 1) // limpa os que já sumiram
      vivos.push({ bala, geracao, recolher: voltar })
    })
  })
  return yc
}

// Desliza o forcado na vertical: o dente mais próximo vai para a fileira do
// coração, a no máximo `rastrear` px/s e `rastreioMax` px da fileira avisada.
// Um passo por quadro (todos os dentes chamam, só o primeiro conta).
function rastrear(a, cfg, garfo, dt) {
  if (garfo.quadro === a.tempo) return
  garfo.quadro = a.tempo
  if (!(cfg.rastrear > 0) || garfo.recolhendo || garfo.ys.length < 2) return
  const { ys } = garfo
  const topo = ys[0] + garfo.desloc
  const base = ys[ys.length - 1] + garfo.desloc
  // só quem está dentro da mandíbula: lá os vãos só se movem, nunca fecham
  const dentro = a.coracoes.filter((c) => c.ativo && c.y > topo && c.y < base)
  if (!dentro.length) return
  let melhor = null
  for (const c of dentro) {
    for (const y of ys) {
      const d = c.y - (y + garfo.desloc)
      if (!melhor || Math.abs(d) < Math.abs(melhor)) melhor = d
    }
  }
  const l = a.caixa
  const min = Math.max(-cfg.rastreioMax, l.top + cfg.espessura - ys[0])
  const max = Math.min(cfg.rastreioMax, l.bottom - cfg.espessura - ys[ys.length - 1])
  const alvo = limitar(garfo.desloc + melhor, Math.min(min, 0), Math.max(max, 0))
  const velocidade = Math.min(cfg.rastrear * a.balas.fatorVelocidade, a.balas.velocidadeMax)
  const passo = (velocidade * dt) / 1000
  garfo.desloc += limitar(alvo - garfo.desloc, -passo, passo)
}

// Dente velho que ainda estava na caixa quando o novo chegou: some sem dano
function desarmar(a, b) {
  b.inofensiva = true
  b.vida = Math.min(b.vida, 150)
  a.cena.tweens.add({ targets: b.sprite, alpha: 0, duration: 150 })
}
