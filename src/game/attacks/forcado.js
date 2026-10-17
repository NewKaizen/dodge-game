import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'
import { tocar } from '../audio.js'

// Forcado. Identidade: o forcado de três dentes ESTOCA de cima ou de baixo
// (sorteado) na coluna do coração, CRAVA, e a palha espirra para os lados.
// O desvio tem dois tempos:
//   1. as pontas dos dentes aparecem na borda, entrando bem de mansinho
//      (é o aviso: nenhuma linha risca a caixa): saia da coluna, ou fique NO
//      VÃO entre dois dentes (o vão é seguro);
//   2. quando o forcado crava, a palha (ou terra) espirra da ponta do dente do
//      meio para os dois lados, saindo devagar e ganhando força: pule por
//      cima/por baixo dela.
//
//   profundidade  o dente do meio entra mais fundo (atravessa a caixa toda):
//                 do outro lado da coluna dele não existe canto seguro.
//   pinca         em média a cada `pinca` estocadas (sorteado; nunca a 1ª), uma pinça: um forcado de cima e um
//                 de baixo, cada um até a metade da caixa, o segundo deslocado
//                 meio vão (o vão de um é o dente do outro) e um pouco depois.
//   palha         quantos fiapos de palha saem para CADA lado na cravada (0 desliga)
//
// Justiça: um forcado (ou uma pinça) por vez: quando o próximo estoca, o que
// sobrou do anterior vira inofensivo. Todo dente espia na borda `aviso` ms
// antes de estocar; o vão entre dentes é > LACUNA_MINIMA; a palha sai a 8% da
// velocidade e só chega nela em ~0,55 s (a cravada, com tremida e som, avisa).
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
    // pinças: acumulador com fase sorteada (a 1ª estocada nunca é pinça)
    const taxaPinca = cfg.pinca > 0 ? 1 / cfg.pinca : 0
    let pincas = a.aleatorio(0, Math.max(0, 1 - taxaPinca) * 0.999)
    let deCima = a.aleatorio(0, 1) < 0.5
    let repetidas = 0 // o mesmo lado no máximo duas vezes seguidas

    a.aCada(
      cfg.intervalo,
      (i) => {
        const geracao = i + 1
        const troca = repetidas >= 1 || a.aleatorio(0, 1) < 0.5
        repetidas = troca ? 0 : repetidas + 1
        if (troca) deCima = !deCima
        pincas += taxaPinca
        const pinca = pincas >= 1
        if (pinca) pincas -= 1
        const comum = { a, cfg, aviso, turno, geracao }
        if (!pinca) {
          estocar({ ...comum, deCima, centro: a.alvo().x, alcance: cfg.alcance, fundo: cfg.alcance + cfg.profundidade })
          return
        }
        // pinça: cada lado só até a metade (os dois nunca ocupam o mesmo y)
        const xc = estocar({ ...comum, deCima, centro: a.alvo().x, alcance: 0.5, fundo: 0.5 })
        a.depois(cfg.atrasoPinca, () => {
          const meioVao = cfg.vao / 2
          const l = a.caixa
          // o segundo desloca meio vão para um lado sorteado (se couber)
          let sinal = a.aleatorio(0, 1) < 0.5 ? 1 : -1
          if (sinal > 0 ? xc + meioVao > centroMax(l, cfg) : xc - meioVao < centroMin(l, cfg)) sinal = -sinal
          estocar({ ...comum, deCima: !deCima, centro: xc + sinal * meioVao, alcance: 0.5, fundo: 0.5, mesmaGeracao: true })
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
// O dente nasce fora da caixa com a ponta na borda, espia (entrando bem
// devagar) por `aviso` ms, estoca, crava e volta.
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

    const espia = 6 // px da ponta que aparecem na borda
    // a ponta espiando mostra a coluna: a CPU lê como zona (sem desenho)
    a.zonaPerigo({ tipo: 'linha', x1: x, y1: borda, x2: x, y2: ponta, espessura: cfg.espessura }, { ms: aviso })
    let estado = 'espiando'
    let parado = 0
    const bala = a.bala({
      x,
      y: borda - (dir * comprimento) / 2 + dir * espia,
      vy: dir * 12, // entra de mansinho enquanto espia
      largura: cfg.espessura,
      altura: comprimento,
      forma: cfg.forma,
      entrando: true,
      arranque: { ms: aviso, vx: 0, vy: dir * cfg.velocidade }, // a estocada (os bots já leem)
      atualizar: (b, dt) => {
        if (estado === 'espiando') {
          if (b.idade < aviso) return
          // um forcado mais novo já estocou: este nem entra
          if (turno.chegou > geracao) {
            b.morta = true
            return
          }
          if (!mesmaGeracao || turno.chegou < geracao) {
            // estocou: o que sobrou dos forcados anteriores não machuca mais
            for (const v of turno.vivos) if (v.geracao < geracao && !v.bala.morta && !v.bala.inofensiva) desarmar(a, v.bala)
          }
          turno.chegou = geracao
          estado = 'entrando' // a velocidade da estocada vem do arranque
        } else if (estado === 'entrando' && (b.y - paradaY) * dir >= 0) {
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
      const vx0 = lado * v * Math.cos(abre)
      const vy0 = v * Math.sin(abre)
      a.bala({
        x: x + lado * 10,
        y,
        vx: vx0 * 0.08,
        vy: vy0 * 0.08,
        raio: 4,
        forma: 'bola',
        cor: 0xe8c860,
        vida: 2600,
        // sai devagar e ganha força em 0,55 s (no lugar do pisca-pisca parado);
        // depois perde força no ar (25% por segundo)
        jaAvisada: true,
        atualizar: (b) => {
          const s = b.idade / 1000
          const g = s < 0.55 ? 0.08 + 0.92 * (s / 0.55) : Math.max(0.2, 1 - 0.25 * (s - 0.55))
          b.vx = vx0 * g
          b.vy = vy0 * g
        },
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
