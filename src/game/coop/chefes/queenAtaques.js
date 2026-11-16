import { definirAtaque } from '../../attacks/definir.js'

// Os ataques da QUEEN que combinam com a regra SINAL DE WI-FI (coop/queenWifi.js): eles tentam SEPARAR a dupla.
// Não ficam em attacks/ (a biblioteca dos outros chefes): as cartas da Queen chamam estes direto.
//
//   gotas  GOTAS DE ÁCIDO: pingos verdes que caem do alto. Metade cai ENTRE os dois corações (quem está colado
//          tem de abrir e depois voltar), a outra metade mira um coração. Entram devagar e aceleram: dá tempo
//   muro   ATUALIZAÇÃO OBRIGATÓRIA / FIREWALL: uma "janela" (duas barras, uma do alto e uma de baixo) fecha o
//          quadro numa coluna entre os corações, com UMA abertura generosa, fica um tempo e recua. A entrada
//          lenta pela borda é o aviso; a abertura é validada (a.parede) e sempre cabe a dupla
//
// Tudo com a semente do ataque (a.aleatorio): igual nos dois PCs. A coluna do muro olha onde estão os corações,
// por isso arredonda para múltiplos de 8 px (um PC enxerga o coração do outro um pouco atrasado).

export const ACIDO = 0x9dff3a
const FOLGA_DO_MURO = 38 // o muro nunca nasce a menos que isto (px) de um coração

// ---------- GOTAS DE ÁCIDO ----------

export const gotas = definirAtaque({
  nome: 'gotas',
  padrao: { duracao: 5600, intervalo: 700, velocidade: 150, partida: 0.45, raio: 7, entre: 0.5, inicio: null, vazio: 100 },
  iniciar(a, cfg) {
    const l = a.caixa
    const v0 = cfg.velocidade * cfg.partida
    const queda = (cfg.velocidade ** 2 - v0 ** 2) / (2 * Math.max(40, l.height + cfg.raio * 2))
    // acumulador: `entre` é a fração de gotas que caem no meio da dupla (a fase é sorteada)
    let acumulado = a.aleatorio(0, Math.max(0, 1 - cfg.entre) * 0.999)

    const solta = (x) => {
      const xc = Math.min(l.right - cfg.raio - 4, Math.max(l.left + cfg.raio + 4, x))
      const p = a.deFora('top', (xc - l.left) / l.width, cfg.raio + 10)
      a.bala({ x: xc, y: p.y, vy: v0, ay: queda, raio: cfg.raio, forma: 'chama', cor: ACIDO, girar: 0, pulso: 0.1, entrando: true })
    }

    a.aCada(
      cfg.intervalo,
      () => {
        acumulado += cfg.entre
        const vivos = a.coracoes.filter((c) => c.ativo).sort((p, q) => p.x - q.x)
        let x
        if (acumulado >= 1) {
          acumulado -= 1
          // no meio de um par vizinho que está perto (colado: a gota obriga a abrir); longe não adianta
          const pares = []
          for (let k = 0; k + 1 < vivos.length; k++) if (vivos[k + 1].x - vivos[k].x <= cfg.vazio) pares.push([vivos[k], vivos[k + 1]])
          const par = pares.length ? pares[a.inteiro(0, pares.length - 1)] : null
          x = par ? (par[0].x + par[1].x) / 2 + a.aleatorio(-5, 5) : a.alvo().x + a.aleatorio(-10, 10)
        } else x = a.alvo().x + a.aleatorio(-10, 10)
        solta(x)
      },
      Infinity,
      cfg.inicio,
    )
  },
})

// ---------- O MURO (janela de atualização / firewall) ----------

// Onde cai a coluna do muro: no maior vão entre dois corações vizinhos; colados (sem vão), ao lado do grupo.
// Sempre a FOLGA_DO_MURO de qualquer coração e dentro do quadro. `fixoX` (REBOOT) vale se couber.
export function colunaDoMuro(l, xs, fixoX = null) {
  const ordem = [...xs].sort((p, q) => p - q)
  const margem = 36
  const dentro = (x) => Math.min(l.right - margem, Math.max(l.left + margem, x))
  const livre = (x) => ordem.every((cx) => Math.abs(cx - x) >= FOLGA_DO_MURO)
  const candidatos = []
  if (fixoX != null) candidatos.push(fixoX)
  if (ordem.length >= 2) {
    let melhor = [ordem[0], ordem[1]]
    for (let k = 0; k + 1 < ordem.length; k++) if (ordem[k + 1] - ordem[k] > melhor[1] - melhor[0]) melhor = [ordem[k], ordem[k + 1]]
    candidatos.push((melhor[0] + melhor[1]) / 2)
  }
  if (ordem.length) {
    candidatos.push(ordem[ordem.length - 1] + FOLGA_DO_MURO + 4, ordem[0] - FOLGA_DO_MURO - 4)
  }
  candidatos.push(l.centerX, l.left + l.width * 0.25, l.left + l.width * 0.75)
  for (const c of candidatos) {
    const x = Math.round(dentro(c) / 8) * 8
    if (livre(x)) return x
  }
  return Math.round(dentro(candidatos[0]) / 8) * 8
}

// Posição (y do centro) da barra do muro `t` ms depois de nascer: entra, fica, recua. dir -1: do alto; +1: de baixo
export function posicaoDaBarra({ yFora, yFinal }, t, { entra, fica, sai }) {
  const suave = (p) => 1 - (1 - p) ** 2
  if (t < entra) return yFora + (yFinal - yFora) * suave(t / entra)
  if (t < entra + fica) return yFinal
  if (t < entra + fica + sai) return yFinal + (yFora - yFinal) * suave((t - entra - fica) / sai)
  return null
}

export const MURO = { muros: 1, abertura: 88, espessura: 14, entra: 750, fica: 2600, sai: 550, primeiro: 500, folga: 500, fixoX: null }

// Tempo ativo de um muro (do nascimento ao recuo) e do ataque inteiro
const vidaDoMuro = (c) => c.entra + c.fica + c.sai
const duracaoDoMuro = (c) => c.primeiro + c.muros * vidaDoMuro(c) + (c.muros - 1) * c.folga + 250

const muroBase = definirAtaque({
  nome: 'muro',
  padrao: MURO,
  iniciar(a, cfg) {
    const l = a.caixa
    const meia = cfg.abertura / 2
    for (let k = 0; k < cfg.muros; k++) {
      a.depois(cfg.primeiro + k * (vidaDoMuro(cfg) + cfg.folga), () => {
        // o sorteio do vão vem SEMPRE (mesmo número de sorteios em todos os PCs)
        const centro = a.aleatorio(l.top + meia + 16, l.bottom - meia - 16)
        const xs = a.coracoes.filter((c) => c.ativo).map((c) => c.x)
        const x = colunaDoMuro(l, xs, cfg.fixoX === 'centro' ? l.centerX : cfg.fixoX)
        const topoVao = centro - meia
        const baseVao = centro + meia
        a.parede({ eixo: 'y', lacunas: [[topoVao, baseVao]] })
        const tempos = { entra: cfg.entra, fica: cfg.fica, sai: cfg.sai }
        const barra = (h, yFora, yFinal) => {
          if (h < 4) return
          a.bala({
            x,
            y: yFora,
            largura: cfg.espessura,
            altura: h,
            forma: 'barra',
            entrando: true,
            atualizar: (b) => {
              const y = posicaoDaBarra({ yFora, yFinal }, b.idade, tempos)
              if (y == null) b.morta = true
              else b.y = y
            },
          })
        }
        const hTopo = topoVao - l.top
        const hBase = l.bottom - baseVao
        barra(hTopo, l.top - hTopo / 2 - 5, l.top + hTopo / 2)
        barra(hBase, l.bottom + hBase / 2 + 5, l.bottom - hBase / 2)
      })
    }
  },
})

// muro({ muros: 2, abertura: 80, fica: 2400 }): a duração se ajusta aos muros (a menos que venha em `duracao`)
export const muro = (config = {}) => {
  const c = { ...MURO, ...config }
  return muroBase({ ...c, duracao: config.duracao ?? duracaoDoMuro(c) })
}
