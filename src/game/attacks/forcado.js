import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'
import { tocar } from '../audio.js'

// Forcado. Identidade: o forcado de três dentes ESTOCA de cima (e de baixo,
// alternando) na coluna do coração, CRAVA, e a palha espirra para os lados.
// O desvio tem dois tempos:
//   1. os dentes piscam (até onde as pontas chegam): saia da coluna, ou fique
//      NO VÃO entre dois dentes (o vão é seguro);
//   2. quando o forcado crava, a palha (ou terra) espirra da ponta do dente do
//      meio para os dois lados: pule por cima/por baixo dela.
//
//   profundidade  o dente do meio entra mais fundo (atravessa a caixa toda):
//                 do outro lado da coluna dele não existe canto seguro.
//   pinca         a cada `pinca` estocadas, uma pinça: um forcado de cima e um
//                 de baixo, cada um até a metade da caixa, o segundo deslocado
//                 meio vão (o vão de um é o dente do outro) e um pouco depois.
//   palha         quantos fiapos de palha saem para CADA lado na cravada (0 desliga)
//
// Justiça: um forcado (ou uma pinça) por vez: quando o próximo chega, o que
// sobrou do anterior vira inofensivo. Todo dente pisca `aviso` ms antes; o vão
// entre dentes é > LACUNA_MINIMA; a palha nasce parada piscando (o aviso
// normal das balas) antes de se espalhar.
//
// Config:
//   dentes, vao, espessura    o garfo (o vão livre é vao - espessura)
//   alcance                   até onde as pontas de fora chegam (fração da altura)
//   velocidade, retorno       px/s da estocada e fração dela na volta
//   parada                    ms cravado antes de voltar
//   palha, velocidadePalha    a palha que espirra na cravada
//   atrasoPinca               ms entre os dois forcados da pinça
//   (rastrear: aceito por compatibilidade; o forcado novo não persegue)
export default definirAtaque({
  nome: 'forcado',
  padrao: {
    duracao: 5500,
    intervalo: 1500,
    velocidade: 520,
    retorno: 0.7,
    espessura: 9,
    dentes: 3,
    vao: 62,
    alcance: 0.72,
    profundidade: 0.28,
    parada: 280,
    palha: 3,
    velocidadePalha: 120,
    pinca: 3,
    atrasoPinca: 280,
    aviso: 600,
    forma: 'barra',
  },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const turno = { vivos: [], chegou: 0 }
    a.lacuna(cfg.vao - cfg.espessura, 'vão entre os dentes do forcado')

    a.aCada(
      cfg.intervalo,
      (i) => {
        const geracao = i + 1
        const deCima = i % 2 === 0
        const pinca = cfg.pinca > 0 && (i + 1) % cfg.pinca === 0
        const comum = { a, cfg, aviso, turno, geracao }
        if (!pinca) {
          estocar({ ...comum, deCima, centro: a.alvo().x, alcance: cfg.alcance, fundo: cfg.alcance + cfg.profundidade })
          return
        }
        // pinça: cada lado só até a metade (os dois nunca ocupam o mesmo y)
        const xc = estocar({ ...comum, deCima: true, centro: a.alvo().x, alcance: 0.5, fundo: 0.5 })
        a.depois(cfg.atrasoPinca, () => {
          const meioVao = cfg.vao / 2
          const cabe = xc + meioVao <= centroMax(a.caixa, cfg)
          estocar({ ...comum, deCima: false, centro: xc + (cabe ? meioVao : -meioVao), alcance: 0.5, fundo: 0.5, mesmaGeracao: true })
        })
      },
      Infinity,
      300,
    )
  },
})

const extensaoDe = (cfg) => ((cfg.dentes - 1) / 2) * cfg.vao
const centroMin = (l, cfg) => l.left + cfg.espessura + extensaoDe(cfg)
const centroMax = (l, cfg) => l.right - cfg.espessura - extensaoDe(cfg)
const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

// Um forcado estocando na coluna `centro`. Devolve o x usado.
//   alcance  ponta dos dentes de fora; fundo  ponta do(s) dente(s) do meio
function estocar({ a, cfg, aviso, turno, geracao, deCima, centro, alcance, fundo, mesmaGeracao = false }) {
  const l = a.caixa
  const dir = deCima ? 1 : -1
  const meio = (cfg.dentes - 1) / 2
  const xc = limitar(centro, centroMin(l, cfg), Math.max(centroMin(l, cfg), centroMax(l, cfg)))
  const xs = Array.from({ length: cfg.dentes }, (_, k) => xc + (k - meio) * cfg.vao)
  a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - cfg.espessura / 2, x + cfg.espessura / 2]) })
  const borda = deCima ? l.top : l.bottom
  const fundoReal = Math.min(1, Math.max(alcance, fundo))

  xs.forEach((x, k) => {
    const doMeio = Math.abs(k - meio) < 1
    const r = doMeio ? fundoReal : alcance
    const comprimento = l.height * r
    const ponta = borda + dir * comprimento
    const paradaY = borda + (dir * comprimento) / 2
    const inicioY = borda - (dir * comprimento) / 2

    a.aviso({ tipo: 'linha', x1: x, y1: borda, x2: x, y2: ponta, espessura: cfg.espessura, ms: aviso }, () => {
      if (turno.chegou > geracao) return
      if (!mesmaGeracao || turno.chegou < geracao) {
        // chegou: o que sobrou dos forcados anteriores não machuca mais
        for (const v of turno.vivos) if (v.geracao < geracao && !v.bala.morta && !v.bala.inofensiva) desarmar(a, v.bala)
      }
      turno.chegou = geracao

      let estado = 'entrando'
      let parado = 0
      const bala = a.bala({
        x,
        y: inicioY,
        vy: dir * cfg.velocidade,
        largura: cfg.espessura,
        altura: comprimento,
        forma: cfg.forma,
        jaAvisada: true,
        atualizar: (b, dt) => {
          if (estado === 'entrando' && (b.y - paradaY) * dir >= 0) {
            b.y = paradaY
            b.vy = 0
            estado = 'cravado'
            if (doMeio) cravar(a, cfg, x, ponta, dir)
          } else if (estado === 'cravado' && (parado += dt) >= cfg.parada) {
            estado = 'voltando'
            b.vy = -dir * cfg.velocidade * cfg.retorno
          } else if (estado === 'voltando' && (b.y + (dir * comprimento) / 2 - borda) * dir <= 0) {
            b.morta = true // a ponta saiu da caixa
          }
        },
      })
      const { vivos } = turno
      for (let j = vivos.length - 1; j >= 0; j--) if (vivos[j].bala.morta) vivos.splice(j, 1)
      vivos.push({ bala, geracao })
    })
  })
  return xc
}

// O forcado cravou: tremidinha e a palha espirra da ponta para os dois lados
function cravar(a, cfg, x, ponta, dir) {
  tocar(a.cena, 'impacto')
  a.cena.cameras.main.shake(90, 0.004)
  if (!(cfg.palha > 0)) return
  const l = a.caixa
  const y = limitar(ponta - dir * 10, l.top + 8, l.bottom - 8)
  for (const lado of [-1, 1]) {
    for (let k = 0; k < cfg.palha; k++) {
      // leque: um reto, os outros um pouco para cima e para baixo
      const abre = (k - (cfg.palha - 1) / 2) * 0.32
      const v = cfg.velocidadePalha * (1 - Math.abs(abre) * 0.4)
      a.bala({
        x: x + lado * 10,
        y,
        vx: lado * v * Math.cos(abre),
        vy: v * Math.sin(abre),
        ax: -lado * v * 0.25, // a palha perde força no ar
        raio: 4,
        forma: 'bola',
        cor: 0xe8c860,
        vida: 2600,
      })
    }
  }
}

// Dente velho que ainda estava na caixa quando o novo chegou: some sem dano
function desarmar(a, b) {
  b.inofensiva = true
  b.vida = Math.min(b.vida, 150)
  a.cena.tweens.add({ targets: b.sprite, alpha: 0, duration: 150 })
}
