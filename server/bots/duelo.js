// O DUELO (bonus round) do bot do JOGAR RÁPIDO, sem tela: o mesmo papel do pvp/bonus/Duelo.js no PC
// de um convidado em rede (docs/rede-pvp.md "Duelo"). O bot só decide o PRÓPRIO coração: anda pelo
// BotDuelo (pvp/bonus/botDuelo.js, com os números da faixa), ataca com a arma dele (o ataque vai para o
// humano, que cria a réplica) e confere os golpes das RÉPLICAS das armas do humano no coração dele (a
// vítima decide, como no jogo). A espada do bot apara os tiros do humano (dueloRebate). Os números das
// armas são os do jogo (pvp/bonus/dueloRegras.js).
//
//   const d = criarDuelo({ armas, aceleracao, cfg, sorte })
//   d.humano({ x, y, vx, vy })          a posição do coração do humano (dueloCoracao)
//   d.replicar(ataque)                   um dueloAtaque do humano
//   d.rebatido({ id, tipo })             a espada do humano quebrou o meu tiro / virou o meu bumerangue
//   d.passo(dt, { atacar })  -> { ataques: [...], golpes: [{ dano, x, y, ref }], rebates: [...] }
//   d.coracao { x, y, vx, vy } · d.duracao · d.cair()
import { DUELO, ARMAS_DUELO } from '../../src/game/pvp/bonus/dueloRegras.js'
import { BotDuelo, difAngulo } from '../../src/game/pvp/bonus/botDuelo.js'
import { CORACAO, ACELERACAO, parteDoFator } from '../../src/game/constants.js'

const MEIO = CORACAO.tamanho / 2
const limitar = (v, a, b) => Math.max(a, Math.min(b, v))

// o mesmo Duelo.parametros
export function parametrosDaArma({ arma, forca: f = 0 } = {}, aceleracao = 1) {
  const c = ARMAS_DUELO[arma] ?? ARMAS_DUELO.tiro
  const fp = parteDoFator(aceleracao, ACELERACAO.coracao)
  switch (arma) {
    case 'espada':
      return { ...c, alcance: c.alcance + c.alcanceExtra * f }
    case 'bumerangue':
      return { ...c, distancia: c.distancia + c.distanciaExtra * f, velocidade: c.velocidade * fp, alcance: c.distancia + c.distanciaExtra * f }
    case 'explosao':
      return { ...c, raio: c.raio + c.raioExtra * f, alcance: c.distancia }
    default:
      return { ...c, velocidade: (c.velocidade + c.velocidadeExtra * f) * fp, alcance: 320 }
  }
}

export const duracaoDoDuelo = (aceleracao = 1) => Math.max(DUELO.duracaoMinMs, Math.round(DUELO.duracaoMs / aceleracao / 500) * 500)

export function criarDuelo({ armas, aceleracao = 1, cfg = null, sorte = Math.random, eu = 1, velocidade = CORACAO.velocidadePadrao }) {
  const ele = 1 - eu
  const arm = [0, 1].map((j) => armas?.[j] ?? { arma: 'tiro', forca: 0, dano: 3 })
  const params = arm.map((a) => parametrosDaArma(a, aceleracao))
  const vel = velocidade * parteDoFator(aceleracao, ACELERACAO.coracao)
  const { x, y, largura, altura } = DUELO.caixa
  const m = DUELO.borda / 2 + MEIO
  const limites = { left: x - largura / 2 + m, right: x + largura / 2 - m, top: y - altura / 2 + m, bottom: y + altura / 2 - m }
  const area = { left: x - largura / 2, right: x + largura / 2, top: y - altura / 2, bottom: y + altura / 2 }
  const inicio = (j) => ({ x: j ? limites.right - 70 : limites.left + 70, y })
  const coracoes = [0, 1].map((j) => ({ j, ...inicio(j), vx: 0, vy: 0, ko: false, invencivelMs: 0, recargaMs: 0, golpe: null, ladoGolpe: 1, angulo: j ? Math.PI : 0 }))
  const meu = coracoes[eu]
  const outro = coracoes[ele]
  const bot = new BotDuelo({ rng: sorte })
  if (cfg) bot.cfg = { ...bot.cfg, ...cfg }
  let proximoId = 0
  const tiros = []
  const bumerangues = []
  const bombas = []

  const pronto = () => !meu.ko && meu.recargaMs <= 0 && !(arm[eu].arma === 'bumerangue' && bumerangues.some((b) => b.dono === eu && !b.morto)) && !(arm[eu].arma === 'espada' && meu.golpe)

  // ----- as armas (o CRIAR do Duelo.js: a mesma conta, sem desenho) -----
  function criarTiro(j, { id, x, y, angulo }) {
    const p = params[j]
    tiros.push({ id, dono: j, x, y, vx: Math.cos(angulo) * p.velocidade, vy: Math.sin(angulo) * p.velocidade, raio: p.raio, fator: 1 })
  }
  function criarBumerangue(j, { id, x, y, dx, dy, ate }) {
    const p = params[j]
    bumerangues.push({ id, dono: j, x, y, vx: dx * p.velocidade, vy: dy * p.velocidade, v: p.velocidade, a: (p.velocidade * p.velocidade) / (2 * Math.max(1, ate)), raio: p.raio, fase: 'ida', acertou: false, idade: 0 })
  }
  function criarBombas(j, { id, x0, y0, alvos, giros }) {
    const p = params[j]
    ;(alvos ?? []).forEach((alvo, k) => bombas.push({ id: `${id}:${k}`, dono: j, x0, y0, alvo: { x: alvo.x, y: alvo.y }, raio: p.raio, giro: giros?.[k] ?? 0, estado: 'voo', idade: 0 }))
  }
  function criarGolpe(j, { id, angulo, lado }) {
    const c = coracoes[j]
    c.golpe = { id, idade: 0, angulo, lado, acertou: false }
  }
  const virar = (b) => {
    b.fase = 'volta'
    b.acertou = false
    b.v = Math.min(b.v, 40)
  }

  // ----- os ataques do bot (a MIRA do Duelo.js) -----
  function atacar() {
    const c = meu
    const p = params[eu]
    const id = `${eu}:${proximoId++}`
    const ang = Math.atan2(outro.y - c.y, outro.x - c.x)
    let ataque
    switch (arm[eu].arma) {
      case 'espada':
        c.ladoGolpe *= -1
        ataque = { arma: 'espada', id, angulo: ang, lado: c.ladoGolpe }
        criarGolpe(eu, ataque)
        break
      case 'bumerangue': {
        const ate = limitar(Math.hypot(outro.x - c.x, outro.y - c.y) + 30, 70, p.distancia)
        const dx = Math.cos(ang)
        const dy = Math.sin(ang)
        ataque = { arma: 'bumerangue', id, x: c.x + dx * 10, y: c.y + dy * 10, dx, dy, ate }
        criarBumerangue(eu, ataque)
        break
      }
      case 'explosao': {
        const t = ((p.vooMs + p.pavioMs) / 1000) * p.antecipa
        const fx = outro.x + outro.vx * t - c.x
        const fy = outro.y + outro.vy * t - c.y
        const d = Math.hypot(fx, fy) || 1
        const dir = { x: fx / d, y: fy / d }
        const dist = Math.min(p.distancia, d)
        const alvos = []
        for (let k = 0; k < p.bombas; k++) {
          const lado = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * p.leque
          alvos.push({ x: limitar(c.x + dir.x * dist - dir.y * lado, area.left + 12, area.right - 12), y: limitar(c.y + dir.y * dist + dir.x * lado, area.top + 12, area.bottom - 12) })
        }
        ataque = { arma: 'explosao', id, x0: c.x, y0: c.y, alvos, giros: alvos.map(() => sorte() * Math.PI) }
        criarBombas(eu, ataque)
        break
      }
      default: {
        const voo = Math.hypot(outro.x - c.x, outro.y - c.y) / p.velocidade
        const a = Math.atan2(outro.y + outro.vy * voo * p.antecipa - c.y, outro.x + outro.vx * voo * p.antecipa - c.x)
        ataque = { arma: 'tiro', id, x: c.x + Math.cos(a) * 10, y: c.y + Math.sin(a) * 10, angulo: a }
        criarTiro(eu, ataque)
      }
    }
    c.recargaMs = p.recargaMs
    return ataque
  }

  // o que o BotDuelo vê (o mesmo Duelo.estadoBot)
  function estadoBot() {
    const perigos = []
    for (const t of tiros) if (t.dono !== eu && !t.morto) perigos.push({ x: t.x, y: t.y, vx: t.vx, vy: t.vy, raio: t.raio })
    for (const b of bumerangues) if (b.dono !== eu && !b.morto) perigos.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, raio: b.raio })
    for (const b of bombas) {
      if (b.morto) continue
      const p = params[b.dono]
      const resta = b.estado === 'voo' ? p.vooMs - b.idade + p.pavioMs : p.pavioMs - b.idade
      perigos.push({ x: b.alvo.x, y: b.alvo.y, raio: b.raio + 4, desdeMs: Math.max(0, resta - 150), ateMs: resta + 120, bomba: true, minha: b.dono === eu, peso: 1.5 })
    }
    if (!outro.ko && arm[ele].arma === 'espada') {
      const euEspada = arm[eu].arma === 'espada'
      if (outro.golpe || !euEspada) perigos.push({ x: outro.x, y: outro.y, raio: params[ele].alcance + (euEspada ? 6 : 20), peso: euEspada ? 0.3 : 0.8 })
    }
    return {
      eu: { x: meu.x, y: meu.y, arma: arm[eu].arma, pronto: pronto(), velocidade: vel, alcance: params[eu].alcance },
      inimigo: { x: outro.x, y: outro.y, ko: outro.ko, arma: arm[ele].arma, pronto: outro.recargaMs <= 0, alcance: params[ele].alcance },
      limites,
      perigos,
      hitbox: DUELO.hitbox,
    }
  }

  const d = {
    coracao: meu,
    limites,
    duracao: duracaoDoDuelo(aceleracao),
    acertos: 0,
    humano(p) {
      if (!p) return
      outro.x = Number(p.x) || outro.x
      outro.y = Number(p.y) || outro.y
      outro.vx = Number(p.vx) || 0
      outro.vy = Number(p.vy) || 0
    },
    replicar(ataque) {
      if (!ataque || outro.ko) return
      if (ataque.arma === 'tiro') criarTiro(ele, ataque)
      else if (ataque.arma === 'bumerangue') criarBumerangue(ele, ataque)
      else if (ataque.arma === 'explosao') criarBombas(ele, ataque)
      else if (ataque.arma === 'espada') criarGolpe(ele, ataque)
      outro.recargaMs = params[ele].recargaMs
    },
    rebatido({ id, tipo } = {}) {
      if (tipo === 'bumerangue') {
        const b = bumerangues.find((x) => x.id === id && x.fase === 'ida')
        if (b) virar(b)
      } else {
        const t = tiros.find((x) => x.id === id)
        if (t) t.morto = true
      }
    },
    cair() {
      meu.ko = true
    },
    humanoCaiu() {
      outro.ko = true
    },
    // um passo; lutando: pode atacar (na contagem só anda)
    passo(dt, { lutando = true } = {}) {
      const s = dt / 1000
      const saida = { ataques: [], golpes: [], rebates: [] }
      // o bot
      if (!meu.ko) {
        const { joy, atacar: quer } = bot.atualizar(dt, estadoBot())
        let jx = (joy?.x ?? 0) / 100
        let jy = (joy?.y ?? 0) / 100
        const n = Math.hypot(jx, jy)
        if (n > 1) {
          jx /= n
          jy /= n
        }
        const passo = vel * (meu.golpe ? params[eu].lentidao : 1) * s
        const x0 = meu.x
        const y0 = meu.y
        meu.x = limitar(meu.x + jx * passo, limites.left, limites.right)
        meu.y = limitar(meu.y + jy * passo, limites.top, limites.bottom)
        meu.vx = dt > 0 ? (meu.x - x0) / s : 0
        meu.vy = dt > 0 ? (meu.y - y0) / s : 0
        meu.invencivelMs = Math.max(0, meu.invencivelMs - dt)
        if (lutando) {
          meu.recargaMs = Math.max(0, meu.recargaMs - dt)
          if (quer && pronto()) saida.ataques.push(atacar())
        }
      }
      outro.recargaMs = Math.max(0, outro.recargaMs - dt)
      // o golpe acerta o bot: a vítima (o bot) decide
      const ferir = (de, px, py, fator, ref) => {
        if (meu.ko || meu.invencivelMs > 0 || !lutando) return false
        const dano = Math.max(1, Math.round((arm[de].dano ?? 3) * fator))
        meu.invencivelMs = DUELO.invencivelMs
        d.acertos++
        const dx = meu.x - px
        const dy = meu.y - py
        const dd = Math.hypot(dx, dy) || 1
        const emp = params[de].empurrao ?? 10
        meu.x = limitar(meu.x + (dx / dd) * emp, limites.left, limites.right)
        meu.y = limitar(meu.y + (dy / dd) * emp, limites.top, limites.bottom)
        saida.golpes.push({ de, dano, x: Math.round(px), y: Math.round(py), ref })
        return true
      }
      for (const t of tiros) {
        if (t.morto) continue
        t.x += t.vx * s
        t.y += t.vy * s
        if (t.x < area.left || t.x > area.right || t.y < area.top || t.y > area.bottom) {
          t.morto = true
          continue
        }
        if (t.dono !== eu && Math.hypot(meu.x - t.x, meu.y - t.y) < t.raio + DUELO.hitbox && ferir(t.dono, t.x, t.y, t.fator, t.id)) t.morto = true
      }
      for (const b of bumerangues) {
        if (b.morto) continue
        const p = params[b.dono]
        const dono = coracoes[b.dono]
        b.idade += dt
        if (b.fase === 'ida') {
          const dir = Math.hypot(b.vx, b.vy) || 1
          b.v = Math.max(0, b.v - b.a * s)
          b.vx = (b.vx / dir) * b.v
          b.vy = (b.vy / dir) * b.v
          b.x += b.vx * s
          b.y += b.vy * s
          const fora = b.x < area.left + b.raio || b.x > area.right - b.raio || b.y < area.top + b.raio || b.y > area.bottom - b.raio
          if (fora) {
            b.x = limitar(b.x, area.left + b.raio, area.right - b.raio)
            b.y = limitar(b.y, area.top + b.raio, area.bottom - b.raio)
          }
          if (b.v <= 25 || fora) virar(b)
        } else {
          b.v = Math.min(p.velocidade * 1.1, b.v + b.a * s)
          const dx = dono.x - b.x
          const dy = dono.y - b.y
          const dd = Math.hypot(dx, dy) || 1
          b.vx = (dx / dd) * b.v
          b.vy = (dy / dd) * b.v
          b.x += b.vx * s
          b.y += b.vy * s
          if (dd < 12 || dono.ko || b.idade > p.vidaMaxMs) {
            b.morto = true
            continue
          }
        }
        if (b.dono !== eu && !b.acertou && Math.hypot(meu.x - b.x, meu.y - b.y) < b.raio + DUELO.hitbox) b.acertou = ferir(b.dono, b.x, b.y, 1, b.id)
      }
      for (const b of bombas) {
        if (b.morto) continue
        const p = params[b.dono]
        b.idade += dt
        if (b.estado === 'voo') {
          if (b.idade >= p.vooMs) {
            b.estado = 'pavio'
            b.idade = 0
          }
          continue
        }
        if (b.idade < p.pavioMs) continue
        b.morto = true
        if (b.dono !== eu && Math.hypot(meu.x - b.alvo.x, meu.y - b.alvo.y) <= b.raio + DUELO.hitbox) ferir(b.dono, b.alvo.x, b.alvo.y, 1, b.id)
        for (const t of tiros) if (Math.hypot(t.x - b.alvo.x, t.y - b.alvo.y) <= b.raio) t.morto = true
        for (let k = 0; k < p.estilhacos; k++) {
          const ang = b.giro + (k * Math.PI * 2) / p.estilhacos
          tiros.push({ id: `${b.id}:${k}`, dono: b.dono, x: b.alvo.x + Math.cos(ang) * b.raio * 0.5, y: b.alvo.y + Math.sin(ang) * b.raio * 0.5, vx: Math.cos(ang) * p.velocidadeEstilhaco, vy: Math.sin(ang) * p.velocidadeEstilhaco, raio: 4, fator: p.fatorEstilhaco })
        }
      }
      // as espadas: a do humano acerta o bot; a do bot apara os tiros e o bumerangue do humano
      for (const c of coracoes) {
        const g = c.golpe
        if (!g) continue
        const p = params[c.j]
        g.idade += dt
        const ativo = g.idade >= p.preparoMs && g.idade <= p.preparoMs + p.golpeMs
        if (ativo) {
          const meio = ((p.arco / 2) * Math.PI) / 180 + 0.15
          const naLamina = (px, py, raio) => Math.hypot(px - c.x, py - c.y) <= p.alcance + raio && Math.abs(difAngulo(Math.atan2(py - c.y, px - c.x), g.angulo)) <= meio
          if (c.j !== eu && !g.acertou && naLamina(meu.x, meu.y, DUELO.hitbox + 2)) g.acertou = ferir(c.j, meu.x, meu.y, 1, g.id)
          if (c.j === eu) {
            for (const t of tiros) {
              if (t.dono === eu || t.morto || !naLamina(t.x, t.y, t.raio)) continue
              t.morto = true
              saida.rebates.push({ id: t.id, tipo: 'tiro' })
            }
            for (const b of bumerangues) {
              if (b.dono === eu || b.fase !== 'ida' || !naLamina(b.x, b.y, b.raio)) continue
              virar(b)
              saida.rebates.push({ id: b.id, tipo: 'bumerangue' })
            }
          }
        }
        if (g.idade > p.preparoMs + p.golpeMs + 70) c.golpe = null
      }
      for (const lista of [tiros, bumerangues, bombas])
        for (let i = lista.length - 1; i >= 0; i--) if (lista[i].morto) lista.splice(i, 1)
      return saida
    },
  }
  return d
}
