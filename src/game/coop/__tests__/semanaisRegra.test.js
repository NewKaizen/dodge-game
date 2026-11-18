// node --test src/game/coop/__tests__/semanaisRegra.test.js
// As regras CO-OP 2.0 dos BOSSES SEMANAIS (docs/boss-semanal.md): OLHOS NO BREU da Escuridão
// (coop/semanal/escuridaoRegra.js) e PEGA LADRA! da Ladra (coop/semanal/ladraRegra.js): o sorteio (igual em todos os
// PCs), o toque pela regra da luta (rede: só o dono do coração decide), a QUEBRA, a prévia e os baralhos novos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RegraDaLuta, rngDaRegra, descricaoValida } from '../regraChefe.js'
import { planejarOlhos, estadoDoOlho, luzPorMs, OLHOS } from '../semanal/escuridaoRegra.js'
import { planejarFuga, posicaoDaFuga, PEGA } from '../semanal/ladraRegra.js'
import { recuperarRoubada } from '../semanal/ladra.js'
import { CHEFES, SEMANAIS } from '../chefes/index.js'
import { CARTAS_CHEFES, ataqueDaCartaChefe } from '../cartasChefe.js'
import { criarPartidaCoop, iniciarRodadaCoop, previaCoop } from '../regras.js'
import { somarQuebra } from '../coop2.js'
import { ataques } from '../../attacks/index.js'
import { criarExpedicao, ehExpedicaoSemanal, expedicaoValida, relatoDaExpedicao, rotaDa, SORTEADA } from '../expedicao.js'

const L = { x: 100, y: 200, width: 336, height: 180 }

test('os dois semanais têm regra CO-OP 2.0 com textos curtos', () => {
  assert.deepEqual([...SEMANAIS].sort(), ['escuridao', 'ladra'])
  for (const id of SEMANAIS) {
    const def = CHEFES[id].regra
    assert.ok(def?.criar, `${id}: sem regra`)
    assert.ok(descricaoValida(def.descricao), `${id}: ${def.descricao}`)
    for (const f of Object.values(def.fases ?? {})) assert.ok(descricaoValida(f.descricao), `${id}: ${f.descricao}`)
  }
})

test('os baralhos novos: 3 fases com os ataques de assinatura, e todo ataque monta', () => {
  const ASSINATURA = { escuridao: ['escuridaoMaos', 'escuridaoEco', 'escuridaoOlhar', 'escuridaoVelas'], ladra: ['ladraTruque', 'ladraBumerangue', 'ladraAlarme', 'ladraEspelho'] }
  for (const id of SEMANAIS) {
    const def = CHEFES[id]
    assert.equal(def.fases.length, 3, `${id}: fases`)
    // a biblioteca que só anota os nomes
    const usados = new Set()
    const A = new Proxy({}, { get: (_, nome) => (...args) => (usados.add(nome), ataques[nome](...args)) })
    for (const carta of [...CARTAS_CHEFES[id].fases.flat(), CARTAS_CHEFES[id].super]) {
      const at = ataqueDaCartaChefe(carta, { ataques: A })
      assert.ok(at && (at.duracao ?? at.ativa) > 0, `${id}: ${carta.nome}`)
    }
    for (const nome of ASSINATURA[id]) assert.ok(usados.has(nome), `${id}: o baralho não usa ${nome}`)
    // o dano subiu (dificuldade) e o MÉDIO/DIFÍCIL têm ajuste próprio
    assert.ok(def.danoBala >= 13 && def.niveis?.medio?.dano > 1 && def.niveis?.dificil?.dano > 1, `${id}: dano`)
  }
})

// ---------- a ponte de mentira ----------

function luta(chefe, { meus = [0, 1], fase = 0, coracoes = null } = {}) {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe, semente: `sem-${chefe}` })
  const log = { quebra: 0, dano: 0, banners: [], enviados: [] }
  const cs = coracoes ?? [
    { j: 0, x: 150, y: 350, ativo: true },
    { j: 1, x: 350, y: 350, ativo: true },
  ]
  let outro = null // o PC do outro lado (rede): recebe o que este manda
  const ponte = {
    semente: `sem-${chefe}`,
    nivel: 'medio',
    n: 2,
    rodada: () => e.rodada,
    estado: () => e,
    meu: (j) => meus.includes(j),
    meuLado: () => meus[0],
    coracoes: () => cs,
    limites: () => L,
    desenharItem: () => null,
    desenharZona: () => null,
    apagar: () => {},
    banner: (t) => log.banners.push(t),
    dica: () => {},
    quebra: (p) => ((log.quebra += p), somarQuebra(e, p)),
    danoNoChefe: (d) => (log.dano += d),
    curar: () => {},
    ferir: () => {},
    empurrar: () => {},
    enviar: (acao, dados) => {
      log.enviados.push({ acao, dados })
      outro?.regra.aoMensagem(meus[0], acao, dados)
    },
  }
  const regra = new RegraDaLuta(CHEFES[chefe].regra, ponte)
  if (fase) regra.faseNova(fase)
  e.rodada = 1
  const r = { regra, log, coracoes: cs, e, ligar: (o) => (outro = o) }
  return r
}

// ---------- ESCURIDÃO: OLHOS NO BREU ----------

test('os olhos saem do sorteio da rodada: iguais para a mesma semente, longe um do outro e dentro da caixa', () => {
  const um = (s = 's') => planejarOlhos({ rng: rngDaRegra(s, 2, 'olhos'), fase: 1, n: 2, limites: L })
  assert.deepEqual(um(), um())
  assert.notDeepEqual(um(), um('outra'))
  for (const fase of [0, 1, 2]) {
    const olhos = planejarOlhos({ rng: rngDaRegra('s', 1, 'olhos'), fase, n: 2, limites: L })
    assert.equal(olhos.length, OLHOS.porFase[fase])
    for (const o of olhos) {
      for (let ms = o.t0; ms < o.t0 + 8000; ms += 200) {
        const e = estadoDoOlho(o, ms, L)
        assert.ok(e.x >= L.x && e.x <= L.x + L.width && e.y >= L.y && e.y <= L.y + L.height, 'o olho fica na caixa')
      }
    }
    // abrem um de cada vez, todos dentro de uma esquiva curta (o último abre antes de 5 s)
    assert.ok(olhos.at(-1).t0 < 5000)
  }
  assert.equal(planejarOlhos({ rng: rngDaRegra('s', 1, 'olhos'), fase: 0, n: 4, limites: L }).length, OLHOS.porFase[0] + 2)
})

test('o olho fica escondido até abrir; na fase 2 pisca, na 3 anda', () => {
  const [o] = planejarOlhos({ rng: rngDaRegra('s', 1, 'olhos'), fase: 0, n: 2, limites: L })
  assert.ok(estadoDoOlho(o, o.t0 - 10, L).y < L.y - 100, 'escondido bem acima: nenhum coração toca')
  assert.equal(estadoDoOlho(o, o.t0 + 10, L).aberto, true)
  const [p] = planejarOlhos({ rng: rngDaRegra('s', 1, 'olhos'), fase: 1, n: 2, limites: L })
  const fechadoAlgumaVez = Array.from({ length: 40 }, (_, k) => estadoDoOlho(p, p.t0 + k * 100, L).aberto).includes(false)
  assert.ok(fechadoAlgumaVez, 'pisca')
  const [q] = planejarOlhos({ rng: rngDaRegra('s', 1, 'olhos'), fase: 2, n: 2, limites: L })
  assert.notDeepEqual([estadoDoOlho(q, q.t0 + 100, L).x, estadoDoOlho(q, q.t0 + 100, L).y], [estadoDoOlho(q, q.t0 + 2000, L).x, estadoDoOlho(q, q.t0 + 2000, L).y], 'anda')
  // juntos fecham no dobro da velocidade (e não mais)
  assert.equal(luzPorMs(2), 2 * luzPorMs(1))
  assert.equal(luzPorMs(4), luzPorMs(2))
  assert.equal(luzPorMs(0), 0)
})

// põe os corações em cima do olho k e roda a esquiva até `ms`
function emCimaDoOlho(l, k, ms, quem = [0]) {
  const o = l.regra.zonasVivas[k]
  let t = 0
  while (t < ms) {
    for (const j of quem) Object.assign(l.coracoes[j], { x: o.x, y: o.y })
    l.regra.atualizar(50)
    t += 50
  }
}

test('ficar em cima fecha o olho: QUEBRA e golpe uma vez; dois juntos fecham mais rápido', () => {
  const sozinho = luta('escuridao')
  sozinho.regra.comecarEsquiva({})
  const olhos = sozinho.regra.zonasVivas.length
  assert.equal(olhos, OLHOS.porFase[0])
  // espera o 1º olho abrir e fica em cima dele
  emCimaDoOlho(sozinho, 0, OLHOS.primeiro + 100)
  emCimaDoOlho(sozinho, 0, OLHOS.fecharMs + 200)
  assert.equal(sozinho.log.enviados.filter((m) => m.acao === 'u:fechou').length, 1)
  assert.equal(sozinho.log.quebra, OLHOS.quebra)
  assert.ok(sozinho.log.dano > 0)
  assert.equal(sozinho.regra.zonasVivas.length, olhos - 1, 'o olho fechado sai')

  const dupla = luta('escuridao')
  dupla.regra.comecarEsquiva({})
  emCimaDoOlho(dupla, 0, OLHOS.primeiro + 100, [0, 1])
  emCimaDoOlho(dupla, 0, OLHOS.fecharMs / 2 + 150, [0, 1])
  assert.equal(dupla.log.quebra, OLHOS.quebra, 'os dois juntos fecham na metade do tempo')
  assert.equal(dupla.log.enviados.filter((m) => m.acao === 'u:fechou').length, 1, 'só o dono do menor coração decide')
})

test('rede: o PC que não é dono do coração não decide; a mensagem fecha o olho lá também', () => {
  const dono = luta('escuridao', { meus: [0] })
  const outro = luta('escuridao', { meus: [1] })
  dono.ligar(outro)
  dono.regra.comecarEsquiva({})
  outro.regra.comecarEsquiva({})
  // o coração 0 entra no olho: o dono repassa a entrada (a zona) para o outro
  const ida = dono.regra.zonasVivas[0]
  for (let t = 0; t < OLHOS.primeiro + OLHOS.fecharMs + 400; t += 50) {
    Object.assign(dono.coracoes[0], { x: ida.x, y: ida.y })
    Object.assign(outro.coracoes[0], { x: ida.x, y: ida.y })
    dono.regra.atualizar(50)
    for (const m of dono.log.enviados.splice(0)) if (m.acao === 'zona') outro.regra.aoMensagem(0, 'zona', m.dados)
    outro.regra.atualizar(50)
  }
  assert.equal(outro.log.enviados.filter((m) => m.acao === 'u:fechou').length, 0, 'o outro PC não decide')
  assert.equal(dono.log.quebra, OLHOS.quebra)
  assert.equal(outro.log.quebra, OLHOS.quebra, 'mesmo estado nos dois PCs')
})

test('olho aberto no fim da esquiva: na rodada seguinte a prévia da carta de depois fica no escuro', () => {
  const l = luta('escuridao')
  l.regra.comecarEsquiva({})
  for (let t = 0; t < 5000; t += 100) l.regra.atualizar(100)
  l.regra.terminarEsquiva()
  const carta = { tipo: 'carta', carta: CARTAS_CHEFES.escuridao.fases[0][0] }
  assert.deepEqual(l.regra.previa(carta), carta, 'nesta rodada ainda não')
  l.e.rodada = 2
  assert.deepEqual(l.regra.previa(carta), { tipo: 'escuro' })
  assert.deepEqual(l.regra.previa({ tipo: 'super' }), { tipo: 'super' }, 'o SUPER continua aparecendo')
  l.e.rodada = 3
  assert.deepEqual(l.regra.previa(carta), carta)
})

// ---------- LADRA: PEGA LADRA! ----------

test('a prévia da Ladra mostra a roubada que ela vai jogar (a marcada)', () => {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'ladra', semente: 'prev' })
  iniciarRodadaCoop(e) // rodada 1: rouba
  const r = e.chefe.roubadas[0]
  const p = previaCoop(e) // a rodada 2 é dela: joga a roubada mais antiga
  assert.equal(p.tipo, 'roubada')
  assert.equal(p.carta.id, r.carta.id)
  assert.equal(p.dono, r.dono)
})

test('a fuga sai do sorteio da rodada e das roubadas; a carta fica no quadro só na janela', () => {
  const roubadas = [
    { carta: { id: 'a', naipe: 'espadas', valor: 7 }, dono: 0 },
    { carta: { id: 'b', naipe: 'copas', valor: 9 }, dono: 1 },
    { carta: { id: 'c', naipe: 'paus', valor: 3 }, dono: 0 },
  ]
  const um = (fase) => planejarFuga({ rng: rngDaRegra('s', 4, 'fuga'), roubadas, fase, limites: L })
  assert.deepEqual(um(0), um(0))
  assert.deepEqual(um(0).map((f) => f.id), ['a'], 'fase 1: só a marcada (a mais antiga)')
  assert.deepEqual(um(1).map((f) => f.id), ['a', 'b'], 'fase 2: as duas mais antigas')
  for (const fase of [0, 1, 2]) {
    for (const fu of um(fase)) {
      assert.equal(posicaoDaFuga(fu, fu.t0 - 1, L).visivel, false)
      assert.ok(posicaoDaFuga(fu, fu.t0 - 1, L).y < L.y - 100)
      let antes = null
      for (let ms = fu.t0 + 450; ms < fu.t0 + fu.janela; ms += 50) {
        const p = posicaoDaFuga(fu, ms, L)
        assert.ok(p.x >= L.x && p.x <= L.x + L.width && p.y >= L.y - 20 && p.y <= L.y + L.height, 'dentro do quadro')
        // nunca mais rápida que o coração (180 px/s)
        if (antes) assert.ok(Math.hypot(p.x - antes.x, p.y - antes.y) / 0.05 <= PEGA.velocidade[fase] * 1.05 + 1, `rápida demais: fase ${fase}`)
        antes = p
      }
      assert.equal(posicaoDaFuga(fu, fu.t0 + fu.janela + 1000, L).fim, true)
    }
  }
  assert.deepEqual(planejarFuga({ rng: rngDaRegra('s', 4, 'fuga'), roubadas: [], fase: 0, limites: L }), [])
})

test('pegar a carta que foge devolve para a mão do dono e enche a QUEBRA; o outro PC repete', () => {
  const dono = luta('ladra', { meus: [0] })
  const outro = luta('ladra', { meus: [1] })
  for (const l of [dono, outro]) {
    iniciarRodadaCoop(l.e) // ela rouba do P1
    l.regra.comecarEsquiva({})
  }
  const marcada = dono.e.chefe.roubadas[0]
  assert.ok(marcada)
  const item = dono.regra.itensVivos[0]
  assert.equal(item.cartaId, marcada.carta.id)
  const mao = dono.e.jogadores[marcada.dono].baralho.mao.length
  // o coração do dono encosta: pega aqui e repassa
  dono.regra.pegar(item, 0)
  outro.regra.aoMensagem(0, 'item', { id: item.id, j: 0 })
  for (const l of [dono, outro]) {
    assert.equal(l.e.chefe.roubadas.length, 0, 'saiu da mão dela')
    assert.equal(l.e.jogadores[marcada.dono].baralho.mao.length, mao + 1)
    assert.ok(l.e.jogadores[marcada.dono].baralho.mao.some((c) => c.id === marcada.carta.id), 'voltou para a mão do dono')
    assert.equal(l.log.quebra, PEGA.quebra)
  }
  // sem roubadas, nada foge
  dono.regra.terminarEsquiva()
  dono.regra.comecarEsquiva({})
  assert.equal(dono.regra.itensVivos.length, 0)
})

test('recuperarRoubada: só a carta pedida, de qualquer posição', () => {
  const chefe = { roubadas: [{ carta: { id: 'a' }, dono: 0 }, { carta: { id: 'b' }, dono: 1 }] }
  const jogadores = [{ baralho: { mao: [] } }, { baralho: { mao: [] } }]
  assert.equal(recuperarRoubada(chefe, jogadores, 'x'), null)
  assert.equal(recuperarRoubada(chefe, jogadores, 'b').dono, 1)
  assert.deepEqual(chefe.roubadas.map((r) => r.carta.id), ['a'])
  assert.deepEqual(jogadores[1].baralho.mao.map((c) => c.id), ['b'])
})

// ---------- EXPEDIÇÃO SEMANAL: o boss semanal é sempre uma expedição ----------

test('expedição semanal: lacaios -> tenente -> o chefe da semana, com a semana; a SORTEADA nunca sorteia um semanal', () => {
  for (const id of SEMANAIS) {
    const exp = criarExpedicao({ chefe: id, nivel: 'medio', party: ['kris', 'susie'], semente: 's', semana: '2026-S47' })
    assert.deepEqual(exp.lutas, [`${id}Lacaios`, `${id}Tenente`, id])
    assert.equal(exp.chefao, id)
    assert.equal(exp.semana, '2026-S47')
    assert.ok(ehExpedicaoSemanal(exp))
    assert.ok(expedicaoValida(exp))
    const [lacaios, tenente] = exp.lutas.map((l) => CHEFES[l])
    for (const [k, l] of [lacaios, tenente].entries()) {
      assert.ok(l.expedicao && l.oculto && !l.semanal, 'fora da seleção e do semanal')
      assert.ok(CARTAS_CHEFES[exp.lutas[k]].fases.every((f) => f.length >= 3))
    }
    assert.ok(lacaios.hp < tenente.hp && tenente.hp < CHEFES[id].hp, 'a hierarquia da vida')
    assert.equal(lacaios.regra, undefined, 'lacaios: aquecimento, sem regra')
    assert.ok(tenente.regra && descricaoValida(tenente.regra.descricao), 'tenente: a regra leve')
    for (const f of Object.values(tenente.regra.fases ?? {})) assert.ok(descricaoValida(f.descricao))
    assert.deepEqual(relatoDaExpedicao({ ...exp, vencidas: 3 }), { chefe: id, lutas: 3, sorteada: false })
  }
  // o tenente apresenta o gimmick: o breu da Escuridão e o roubo da Ladra
  assert.ok(CHEFES.escuridaoTenente.escuro && !CHEFES.escuridaoLacaios.escuro)
  assert.ok(CHEFES.ladraTenente.ladra && CHEFES.ladraTenente.roubadas && !CHEFES.ladraLacaios.ladra)
  // fora do semanal a semana não entra; a SORTEADA só sorteia os 4 chefões
  assert.equal(criarExpedicao({ chefe: 'king', semana: '2026-S47' }).semana, null)
  for (let i = 0; i < 40; i++) assert.ok(rotaDa(SORTEADA, `s${i}`).origem.every((c) => !SEMANAIS.includes(c)))
})
