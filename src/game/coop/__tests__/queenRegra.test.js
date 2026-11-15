// node --test src/game/coop/__tests__/queenRegra.test.js
// Os ataques da Queen numa caixa de mentira, a regra SINAL DE WI-FI ligada na API (ponte de mentira), o baralho
// por fase e os lacaios/tenente da Expedição (fora da seleção)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WIFI } from '../queenWifi.js'
import { muro, gotas } from '../chefes/queenAtaques.js'
import { RegraDaLuta, descricaoValida } from '../regraChefe.js'
import { CHEFES, ORDEM_CHEFES } from '../chefes/index.js'
import { CARTAS_CHEFES, ataqueDaCartaChefe, faseDoChefe } from '../cartasChefe.js'
import { ataques } from '../../attacks/index.js'
import { criarPartidaCoop } from '../regras.js'
import { LACUNA_MINIMA } from '../../attacks/validacao.js'

const c = (j, x, y = 100, ativo = true) => ({ j, x, y, ativo })

function rodarAtaque(ataque, { coracoes, semente = 'a' }) {
  const paredes = []
  const balas = []
  const timers = []
  let tempo = 0
  const caixa = { left: 100, right: 436, top: 200, bottom: 380, centerX: 268, centerY: 290, width: 336, height: 180 }
  let proximo = 0
  let s = [...semente].reduce((t, ch) => t + ch.charCodeAt(0), 7)
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const a = {
    caixa,
    coracoes,
    ritmo: { velocidade: 1, densidade: 1 },
    lacunaMinima: LACUNA_MINIMA,
    aleatorio: (min, max) => min + rnd() * (max - min),
    inteiro: (min, max) => Math.floor(min + rnd() * (max - min + 1)),
    aCada: (ms, fn, vezes = Infinity, atraso = null) => timers.push({ ms, fn, resto: atraso ?? ms, vezes, i: 0 }),
    depois: (ms, fn) => timers.push({ ms: 1, fn, resto: ms, vezes: 1, i: 0 }),
    alvo: () => ({ x: coracoes[proximo++ % coracoes.length].x, y: coracoes[0].y }),
    deFora: (lado, fracao = 0.5, recuo = 12) => ({ x: caixa.left + fracao * caixa.width, y: caixa.top - recuo, dx: 0, dy: 1 }),
    parede: (p) => paredes.push(p),
    bala: (o) => {
      balas.push(o)
      return o
    },
    limitar: () => a,
  }
  ataque.iniciar(a)
  for (; tempo < ataque.ativa; tempo += 16) {
    for (const t of [...timers]) {
      t.resto -= 16
      while (t.resto <= 0 && t.vezes > 0) {
        t.fn(t.i++)
        t.vezes--
        t.resto += t.ms
      }
    }
  }
  return { paredes, balas, caixa }
}

test('muro: toda parede declara uma lacuna >= mínimo e as barras nascem fora da caixa', () => {
  const dupla = [{ x: 150, y: 350, ativo: true, jogador: 0 }, { x: 380, y: 350, ativo: true, jogador: 1 }]
  for (const cfg of [{ muros: 1, abertura: 92 }, { muros: 2, abertura: 80, fica: 1900 }, { muros: 1, abertura: 104 }, { muros: 1, abertura: 88, primeiro: 900, fixoX: 'centro' }]) {
    const r = rodarAtaque(muro(cfg), { coracoes: dupla, semente: JSON.stringify(cfg) })
    assert.equal(r.paredes.length, cfg.muros)
    for (const p of r.paredes) {
      const [ini, fim] = p.lacunas[0]
      assert.ok(fim - ini >= LACUNA_MINIMA, `lacuna ${fim - ini}`)
      assert.ok(ini >= r.caixa.top && fim <= r.caixa.bottom)
    }
    for (const b of r.balas) {
      assert.ok(b.entrando && (b.y + b.altura / 2 < r.caixa.top || b.y - b.altura / 2 > r.caixa.bottom), 'nasce fora da caixa')
      assert.ok(b.x >= r.caixa.left && b.x <= r.caixa.right)
    }
  }
})

test('gotas: nascem acima da caixa, entrando, e algumas caem ENTRE corações colados', () => {
  const colados = [{ x: 260, y: 350, ativo: true, jogador: 0 }, { x: 290, y: 350, ativo: true, jogador: 1 }]
  const r = rodarAtaque(gotas({ duracao: 6000, intervalo: 500, entre: 1 }), { coracoes: colados })
  assert.ok(r.balas.length >= 6)
  for (const b of r.balas) assert.ok(b.entrando && b.y < r.caixa.top)
  assert.ok(r.balas.every((b) => Math.abs(b.x - 275) <= 16), 'todas no meio da dupla')
  const alvo = rodarAtaque(gotas({ duracao: 4000, intervalo: 500, entre: 0 }), { coracoes: colados })
  assert.ok(alvo.balas.some((b) => Math.abs(b.x - 260) < 14) && alvo.balas.some((b) => Math.abs(b.x - 290) < 14), 'as outras miram cada coração')
})

// ---------- a regra ligada na API (ponte de mentira) ----------

function ponte({ meus = [0, 1], posicoes = [c(0, 100), c(1, 300)], fase = 0, semente = 'w', def = CHEFES.queen.regra } = {}) {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'queen', semente })
  e.rodada = 1
  const log = { enviados: [], feridas: [], quebra: 0, empurroes: [], banners: [] }
  const cs = posicoes
  const p = {
    semente,
    nivel: 'medio',
    n: 2,
    rodada: () => e.rodada,
    estado: () => e,
    meu: (j) => meus.includes(j),
    meuLado: () => meus[0] ?? 0,
    coracoes: () => cs,
    limites: () => ({ x: 0, y: 0, width: 336, height: 180 }),
    desenharItem: () => null,
    desenharZona: () => null,
    apagar: () => {},
    banner: (t) => log.banners.push(t),
    dica: () => {},
    quebra: (q) => (log.quebra += q),
    danoNoChefe: () => {},
    curar: () => {},
    ferir: (j, d) => log.feridas.push([j, d]),
    empurrar: (j, dx, dy) => {
      log.empurroes.push([j, dx, dy])
      cs[j].x += dx
      cs[j].y += dy
    },
    enviar: (acao, dados) => log.enviados.push({ acao, dados }),
  }
  const regra = new RegraDaLuta(def, p)
  for (let f = 1; f <= fase; f++) regra.faseNova(f)
  return { regra, log, cs, e }
}
const carta = (nome) => ({ nome, naipe: 'ouros', valor: 8 })
const rodar = (regra, ms, passo = 50) => {
  for (let t = 0; t < ms; t += passo) regra.atualizar(passo)
}

test('regra: a descrição é UMA frase', () => {
  assert.ok(descricaoValida(CHEFES.queen.regra.descricao))
  for (const f of Object.values(CHEFES.queen.regra.fases)) assert.ok(descricaoValida(f.descricao))
  assert.ok(descricaoValida(CHEFES.queenTenente.regra.descricao))
})

test('regra: perto, nada acontece; longe, cada PC só manda o tique do coração DELE (carência primeiro)', () => {
  const perto = ponte({ posicoes: [c(0, 100), c(1, 160)] })
  perto.regra.comecarEsquiva({ carta: carta('Gotas de Ácido') })
  rodar(perto.regra, 5000)
  assert.equal(perto.log.enviados.length, 0)

  const longe = ponte({ meus: [0] })
  longe.regra.comecarEsquiva({ carta: carta('Gotas de Ácido') })
  rodar(longe.regra, WIFI.graca - 100)
  assert.equal(longe.log.enviados.length, 0)
  rodar(longe.regra, 300)
  const tiques = longe.log.enviados.filter((m) => m.acao === 'u:queda')
  assert.equal(tiques.length, 1)
  assert.equal(tiques[0].dados.j, 0)
  // a mensagem (de qualquer PC) vira dano pequeno naquele coração
  const outro = ponte({ meus: [1] })
  outro.regra.aoMensagem(0, 'u:queda', { j: 0 })
  assert.equal(outro.log.feridas.length, 1)
  assert.equal(outro.log.feridas[0][0], 0)
  assert.ok(outro.log.feridas[0][1] >= 1 && outro.log.feridas[0][1] <= 4)
})

test('regra: reconectar para o tique; o raio encolhe nas fases', () => {
  const r = ponte({ meus: [0] })
  r.regra.comecarEsquiva({ carta: carta('Gotas de Ácido') })
  rodar(r.regra, WIFI.graca + 200)
  assert.equal(r.log.enviados.length, 1)
  r.cs[1].x = 150
  rodar(r.regra, 4000)
  assert.equal(r.log.enviados.length, 1)
  const f0 = ponte({ meus: [0], posicoes: [c(0, 100), c(1, 230)], fase: 0 })
  f0.regra.comecarEsquiva({ carta: carta('x') })
  rodar(f0.regra, 4000)
  assert.equal(f0.log.enviados.length, 0)
  const f1 = ponte({ meus: [0], posicoes: [c(0, 100), c(1, 230)], fase: 1 })
  f1.regra.comecarEsquiva({ carta: carta('x') })
  rodar(f1.regra, 4000)
  assert.ok(f1.log.enviados.length >= 1)
})

test('regra: com um coração só (o outro caiu) não há sinal a perder', () => {
  const r = ponte({ posicoes: [c(0, 100), c(1, 330, 100, false)] })
  r.regra.comecarEsquiva({ carta: carta('x') })
  rodar(r.regra, 6000)
  assert.equal(r.log.enviados.length, 0)
})

test('INTERFERÊNCIA: só os corações do PC são empurrados, em lados opostos, e só com a carta certa', () => {
  const r = ponte({ fase: 1, posicoes: [c(0, 150), c(1, 190)] })
  r.regra.ataque(carta('Interferência'), ataques, { duracao: 7000 })
  r.regra.comecarEsquiva({ carta: carta('Interferência') })
  rodar(r.regra, 7000, 25)
  const soma = (j) => r.log.empurroes.filter((e) => e[0] === j).reduce((t, e) => t + e[1], 0)
  assert.ok(soma(0) < 0 && soma(1) > 0, 'opostos')
  const alheio = ponte({ meus: [], fase: 1 })
  alheio.regra.ataque(carta('Interferência'), ataques, { duracao: 7000 })
  alheio.regra.comecarEsquiva({ carta: carta('Interferência') })
  rodar(alheio.regra, 7000, 25)
  assert.equal(alheio.log.empurroes.length, 0)
  const sem = ponte({ fase: 1 })
  sem.regra.ataque(carta('Gotas de Ácido'), ataques, { duracao: 6000 })
  sem.regra.comecarEsquiva({ carta: carta('Gotas de Ácido') })
  rodar(sem.regra, 6000, 25)
  assert.equal(sem.log.empurroes.length, 0)
})

test('REBOOT: destinos iguais em todos os PCs e a reconexão paga a QUEBRA uma vez por PC', () => {
  const iniciar = (meus) => {
    const r = ponte({ meus, fase: 2, posicoes: [c(0, 140, 150), c(1, 200, 150)], semente: 'rb' })
    r.regra.ataque(carta('REBOOT'), ataques, { duracao: 6000 })
    r.regra.comecarEsquiva({ carta: carta('REBOOT') })
    return r
  }
  const host = iniciar([0, 1])
  rodar(host.regra, 1100, 25)
  assert.ok(Math.hypot(host.cs[0].x - host.cs[1].x, host.cs[0].y - host.cs[1].y) > WIFI.raios[2], 'embaralhou: longe além do raio')
  const guest = iniciar([1])
  rodar(guest.regra, 1100, 25)
  assert.ok(Math.abs(guest.cs[1].x - host.cs[1].x) < 1 && Math.abs(guest.cs[1].y - host.cs[1].y) < 1)
  host.cs[1].x = host.cs[0].x + 20
  host.cs[1].y = host.cs[0].y
  rodar(host.regra, 800, 25)
  assert.equal(host.log.enviados.filter((m) => m.acao === 'u:reconectou').length, 1)
  for (const r of [host, guest]) {
    r.regra.aoMensagem(0, 'u:reconectou', {})
    r.regra.aoMensagem(0, 'u:reconectou', {})
    assert.equal(r.log.quebra, WIFI.bonusQuebra)
  }
})

test('regra: a CPU aliada vai até o parceiro quando se afasta; perto, desvia como sempre', () => {
  const r = ponte({ posicoes: [c(0, 40), c(1, 300)] })
  const alvo = r.regra.alvoDoBot(1)
  assert.ok(alvo && alvo.x === 40)
  assert.equal(ponte({ posicoes: [c(0, 100), c(1, 130)] }).regra.alvoDoBot(1), null)
})

test('regra: terminar limpa e os ganchos não quebram sem Phaser', () => {
  const r = ponte()
  r.regra.comecarEsquiva({ carta: carta('x') })
  r.regra.atualizar(16)
  r.regra.terminarEsquiva()
  r.regra.terminar()
  assert.equal(r.regra.itensVivos.length + r.regra.zonasVivas.length, 0)
  assert.ok(r.regra.terminada)
})

// ---------- o baralho e a Expedição ----------

test('Queen: 4 cartas por fase, ataques montáveis e as cartas da regra no lugar certo', () => {
  const { fases } = CARTAS_CHEFES.queen
  assert.equal(fases.length, 3)
  for (const lista of fases) {
    assert.equal(lista.length, 4)
    for (const k of lista) assert.ok(ataqueDaCartaChefe(k, { ataques }))
  }
  const nomes = new Set(fases.flat().map((k) => k.nome))
  for (const nome of ['Atualização Obrigatória', 'Gotas de Ácido', 'Interferência', 'REBOOT']) assert.ok(nomes.has(nome), nome)
  assert.ok(fases[0].every((k) => k.nome !== 'Interferência' && k.nome !== 'REBOOT'))
  assert.ok(fases[2].some((k) => k.nome === 'REBOOT'))
  assert.equal(faseDoChefe('queen', 0.5), 1)
  assert.equal(faseDoChefe('queen', 0.2), 2)
})

test('lacaios e tenente: registrados, fora da seleção; só o tenente tem regra (leve)', () => {
  for (const id of ['queenLacaios', 'queenTenente']) {
    assert.ok(CHEFES[id].expedicao, id)
    assert.ok(!ORDEM_CHEFES.includes(id), id)
    assert.ok(CHEFES[id].sprite.startsWith('queen-'))
    assert.ok(criarPartidaCoop({ party: ['kris', 'susie'], chefe: id, nivel: 'medio', semente: 'x' }).chefe.hpMax > 0)
  }
  assert.equal(CHEFES.queenLacaios.regra, undefined)
  assert.equal(CHEFES.queenLacaios.fases.length, 1)
  assert.equal(CHEFES.queenTenente.regra.id, 'wifi')
  for (const f of CARTAS_CHEFES.queenTenente.fases) for (const k of f) assert.ok(ataqueDaCartaChefe(k, { ataques }))
  assert.ok(CHEFES.queenLacaios.hp < CHEFES.queenTenente.hp && CHEFES.queenTenente.hp < CHEFES.queen.hp)
})
