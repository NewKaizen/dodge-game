// SINAL DE WI-FI (regra da Queen, coop/chefes/queen.js): a lógica PURA (sem Phaser), para os testes e a regra
// usarem igual em todos os PCs. A ideia: os corações têm de ficar perto uns dos outros (dentro do RAIO do
// sinal). Quem fica sem nenhum parceiro no raio por mais que a CARÊNCIA ("graça") perde a conexão e leva um
// tiquinho de dano a cada intervalo, até reconectar. Os ataques da Queen tentam SEPARAR a dupla (muros que
// dividem o quadro, empurrões em sentidos opostos, o REBOOT que embaralha os corações).
//
// Rede: cada PC decide só o que é do PRÓPRIO coração (api.meu): o tique sai de `MonitorDeSinal` e vai a todos
// por api.enviar; os sorteios (destinos do REBOOT, janelas de empurrão) vêm do api.rng, iguais em todos.

export const WIFI = {
  raios: [150, 120, 100], // px por fase do chefe (no quadro de 336 de largura; o quadro maior do grupo escala)
  larguraRef: 336,
  graca: 1400, // ms sem parceiro no raio antes do 1º tique
  intervalo: 1000, // ms entre os tiques seguintes
  danoFracao: 0.2, // o tique tira isto do danoBala do chefe (vezes o fator do nível): pequeno
  colados: 0.4, // fração do raio que vale "colados" (a reconexão do REBOOT)
  bonusQuebra: 16, // QUEBRA que o REBOOT dá a quem reconecta a tempo
  janelaReconexao: 3200, // ms depois do REBOOT para reconectar e ganhar a QUEBRA
}

export const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// O raio da fase (0, 1, 2) no quadro de largura `largura` (o grupo de 3 e 4 tem quadro maior)
export function raioDaFase(fase, largura = WIFI.larguraRef, raios = WIFI.raios) {
  const r = raios[Math.min(raios.length - 1, Math.max(0, fase))]
  return Math.round(r * Math.max(1, largura / WIFI.larguraRef))
}

// Dano de um tique: pequeno e fixo pelo chefe e pelo nível
export function danoDoTique(danoBala, fatorNivel = 1, fracao = WIFI.danoFracao) {
  return Math.max(1, Math.round(danoBala * fracao * fatorNivel))
}

const ativos = (cs) => (cs ?? []).filter((c) => c.ativo)

// Cada coração de pé e o parceiro MAIS PERTO dele: { j, vizinho, d, ligado }. Com menos de 2 corações no quadro
// não há sinal para perder (devolve []). Com 3 e 4 é uma corrente: cada um só precisa de UM parceiro no raio.
export function sinalDeCada(cs, raio) {
  const vivos = ativos(cs)
  if (vivos.length < 2) return []
  return vivos.map((c) => {
    let vizinho = null
    let melhor = Infinity
    for (const o of vivos) {
      if (o === c) continue
      const d = distancia(c, o)
      if (d < melhor) {
        melhor = d
        vizinho = o.j
      }
    }
    return { j: c.j, vizinho, d: melhor, ligado: melhor <= raio }
  })
}

// As ligações desenhadas: cada coração com o parceiro mais perto, sem repetir o par. [{ a, b, d }] (a < b)
export function arestas(cs) {
  const vistos = new Set()
  const lista = []
  for (const s of sinalDeCada(cs, Infinity)) {
    const a = Math.min(s.j, s.vizinho)
    const b = Math.max(s.j, s.vizinho)
    const chave = `${a}:${b}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    lista.push({ a, b, d: s.d })
  }
  return lista
}

// Barras do sinal (0 a 3) pela distância: 3 até a metade do raio, 2 até 3/4, 1 até o raio, 0 fora
export function barras(d, raio) {
  if (d > raio) return 0
  if (d <= raio * 0.5) return 3
  if (d <= raio * 0.75) return 2
  return 1
}

// Todos os corações de pé formam UM grupo ligado (cada par a até `raio` um do outro, direta ou pela corrente)?
export function todosLigados(cs, raio) {
  const vivos = ativos(cs)
  if (vivos.length < 2) return true
  const visto = new Set([vivos[0].j])
  const fila = [vivos[0]]
  while (fila.length) {
    const c = fila.pop()
    for (const o of vivos) {
      if (visto.has(o.j) || distancia(c, o) > raio) continue
      visto.add(o.j)
      fila.push(o)
    }
  }
  return visto.size === vivos.length
}

// O relógio da conexão de cada coração: a carência, depois um tique a cada intervalo. atualizar() devolve
// quantos tiques novos deste coração (0 quase sempre) e se ele acabou de reconectar depois de cair.
export class MonitorDeSinal {
  constructor({ graca = WIFI.graca, intervalo = WIFI.intervalo } = {}) {
    this.graca = graca
    this.intervalo = intervalo
    this.fora = new Map() // j -> ms sem sinal
    this.tiques = new Map() // j -> tiques já dados nesta queda
  }

  atualizar(j, ligado, dt) {
    if (ligado) {
      const caiu = (this.tiques.get(j) ?? 0) > 0
      this.fora.set(j, 0)
      this.tiques.set(j, 0)
      return { tiques: 0, voltou: caiu }
    }
    const fora = (this.fora.get(j) ?? 0) + dt
    this.fora.set(j, fora)
    const devidos = fora < this.graca ? 0 : Math.floor((fora - this.graca) / this.intervalo) + 1
    const novos = devidos - (this.tiques.get(j) ?? 0)
    this.tiques.set(j, devidos)
    return { tiques: Math.max(0, novos), voltou: false }
  }

  // 0 a 1: o quanto da carência já passou (para a barrinha de "vai cair")
  carencia(j) {
    return Math.min(1, (this.fora.get(j) ?? 0) / this.graca)
  }

  caido(j) {
    return (this.tiques.get(j) ?? 0) > 0
  }

  zerar() {
    this.fora.clear()
    this.tiques.clear()
  }
}

// ---------- EMPURRÃO (INTERFERÊNCIA): os corações são levados em sentidos opostos ----------

// Quanto o coração `j` é empurrado neste frame: para longe do centro dos OUTROS corações, na horizontal.
// `forca` em px/s, dt em ms. Colado no outro (|dx| < 3), o lado vem de `lado` (0 ou 1, sorteado pela rodada).
export function empurrao(cs, j, forca, dt, lado = 0) {
  const vivos = ativos(cs)
  const eu = vivos.find((c) => c.j === j)
  const outros = vivos.filter((c) => c.j !== j)
  if (!eu || !outros.length) return { dx: 0, dy: 0 }
  const centro = outros.reduce((s, c) => s + c.x, 0) / outros.length
  let sentido = Math.sign(eu.x - centro)
  if (Math.abs(eu.x - centro) < 3) sentido = (j + lado) % 2 ? 1 : -1
  return { dx: (sentido * forca * dt) / 1000, dy: 0 }
}

// As janelas de empurrão de um ataque de `duracao` ms: [{ ini, aviso, fim }] (ms desde o começo da esquiva).
// `aviso` = quando as setas começam a piscar (avisoMs antes de `ini`). O sorteio é do api.rng (igual em todos).
export function janelasDeEmpurrao(rng, duracao, { quantidade = 2, duracaoJanela = 1200, avisoMs = 700, primeira = 1100, folga = 900 } = {}) {
  const janelas = []
  const fim = duracao - 700 // sem janela nova colada no fim do ataque
  let t = primeira // (o aviso da 1ª janela cabe dentro do `primeira`)
  for (let k = 0; k < quantidade; k++) {
    const sobra = Math.max(0, fim - (t + duracaoJanela) - (quantidade - k - 1) * (duracaoJanela + avisoMs + folga))
    const ini = Math.round(t + rng() * Math.min(sobra, 500))
    if (ini + duracaoJanela > fim) break
    janelas.push({ ini, aviso: Math.max(0, ini - avisoMs), fim: ini + duracaoJanela })
    t = ini + duracaoJanela + avisoMs + folga
  }
  return janelas
}

// A janela de empurrão que vale em `t` (ms): { tipo: 'aviso' | 'empurra', janela } ou null
export function janelaAgora(janelas, t) {
  for (const w of janelas) {
    if (t >= w.ini && t < w.fim) return { tipo: 'empurra', janela: w }
    if (t >= w.aviso && t < w.ini) return { tipo: 'aviso', janela: w }
  }
  return null
}

// ---------- REBOOT: o quadro embaralha os corações ----------

// Para onde cada coração (0..n-1) é levado: cantos do quadro, sorteados. Com 2, um de cada lado (longe além do
// raio); com 3 e 4, os cantos embaralhados. `limites` { x, y, width, height }.
export function destinosDoReboot(n, limites, rng, margem = 28) {
  const esq = limites.x + margem
  const dir = limites.x + limites.width - margem
  const alto = limites.y + margem + 8
  const baixo = limites.y + limites.height - margem
  const cantos = [
    { x: esq, y: baixo },
    { x: dir, y: baixo },
    { x: esq, y: alto },
    { x: dir, y: alto },
  ]
  const lista = cantos.slice()
  for (let i = lista.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1))
    ;[lista[i], lista[k]] = [lista[k], lista[i]]
  }
  if (n === 2) {
    // um de cada lado (sempre separados além do raio): o 1º canto sorteado e o do lado oposto
    const a = lista[0]
    const b = lista.find((c) => c.x !== a.x) ?? lista[1]
    return [a, b]
  }
  return lista.slice(0, n)
}
