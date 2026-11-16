// A REGRA do Coronel Caçamba: RECICLAGEM (CO-OP 2.0, docs/coop-cartas.md "Coronel Caçamba").
//
//   Parte do lixo que ele joga é VERDE (reciclável): encostar NÃO machuca e enche a LIXEIRA, uma barra única da
//   dupla (do grupo) no HUD. Cheia, lança um MÍSSIL RECICLADO nele (dano grande e um bom pedaço da QUEBRA).
//   O lixo comum (as cartas dele) machuca. Na fase 2 aparece o lixo MARROM (contaminado): parece com o verde mas
//   machuca ao toque. Na fase 3 a lixeira enche mais rápido. Um desvia e atrai o ataque enquanto o outro pega.
//
// Lógica pura (testada em coop/__tests__/coronelRegra.test.js): o desenho fica em coop/coronelCena.js e só é
// usado quando a arena dá `api.cena`. Rede (docs/coop-cartas.md "Regra do chefe (API)"): todos os itens da
// esquiva nascem juntos no comecarEsquiva (mesmos ids em todos os PCs, escondidos em cima da caixa) e andam
// por uma função do tempo da esquiva; quem decide o toque é só o PC dono do coração (a API repassa), e o que o
// toque faz (encher a lixeira, o míssil, o acerto do marrom) sai do mesmo estado em todos os PCs.
import { registrarZona } from '../attacks/zonas.js'
import { NIVEIS } from '../constants.js'
import { criarLixeira, desenharItemDaRegra, estouroDoItem, lancarMissil, COR_RECICLA, COR_SUJO } from './coronelCena.js'

// Os números (balanceados em docs/coop-cartas.md; o tenente usa uma versão pequena)
//   max          gomos da lixeira (+3 por jogador além de 2)
//   limpos       itens verdes por esquiva em cada fase (+1 por jogador além de 2)
//   sujos        itens marrons por esquiva em cada fase
//   valor        quanto cada verde enche em cada fase (a lixeira enche mais rápido na fase 3)
//   velocidade   fator da queda em cada fase
//   dano         fração do HP máximo do chefe que o míssil tira
//   quebra       pontos de QUEBRA do míssil
//   danoSujo     dano do marrom em cima do dano base do quadro (multiplicado pelo nível)
export const PADRAO_RECICLAGEM = {
  max: 36,
  limpos: [5, 4, 4, 4],
  sujos: [1, 2, 3, 4], // (dificuldade do CO-OP: o marrom já aparece na fase 1 e aperta junto com as cartas)
  valor: [2, 2, 3, 3],
  velocidade: [1, 1.1, 1.2, 1.3],
  dano: 0.07,
  quebra: 30,
  danoSujo: 7,
  hpMaxPadrao: 350,
}

const RAIO_LIMPO = 11
const RAIO_SUJO = 10
const MARGEM_X = 14
const QUEDA = 44 // px/s base
const ENTRADA_MS = 350 // o 1º item só aparece depois do começo da esquiva
const MS_ENTRE = { min: 380, max: 820 }

const limitar = (v, a, b) => Math.min(b, Math.max(a, v))

// Sorteia os itens da esquiva (rng = api.rng, o mesmo em todos os PCs). Cada slot: { tipo, x0, xT, t0, vy, sway, fase }
//   o tipo 'limpo' (verde) ou 'sujo' (marrom), a queda da posição x0 (de cima) até xT (embaixo) começando em t0 ms.
export function planejarItens({ rng, fase = 0, n = 2, limites, cfg = PADRAO_RECICLAGEM }) {
  const f = Math.min(fase, cfg.limpos.length - 1)
  const limpos = cfg.limpos[f] + Math.max(0, n - 2)
  const sujos = cfg.sujos[f]
  const tipos = [...Array(limpos).fill('limpo'), ...Array(sujos).fill('sujo')]
  // embaralha os tipos e as colunas (cada item numa fatia da largura: nunca dois empilhados)
  const embaralhar = (lista) => {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
    }
    return lista
  }
  embaralhar(tipos)
  const total = tipos.length
  const colunas = embaralhar(Array.from({ length: total }, (_, k) => k))
  const largura = limites.width - MARGEM_X * 2
  const fatia = largura / Math.max(1, total)
  const entre = limitar(2600 / Math.max(1, total), MS_ENTRE.min, MS_ENTRE.max)
  return tipos.map((tipo, k) => {
    const x0 = limites.x + MARGEM_X + (colunas[k] + 0.15 + rng() * 0.7) * fatia
    const xT = limitar(x0 + (rng() - 0.5) * 110, limites.x + MARGEM_X, limites.x + limites.width - MARGEM_X)
    return {
      tipo,
      x0,
      xT,
      t0: ENTRADA_MS + k * entre + rng() * 160,
      vy: (QUEDA + rng() * 14) * (cfg.velocidade[f] ?? 1),
      sway: 5 + rng() * 7,
      fase: rng() * Math.PI * 2,
    }
  })
}

// Onde o item está `ms` depois do começo da esquiva: { x, y, visivel, fim }. Antes de t0 ele fica escondido
// bem acima da caixa (os corações nunca chegam lá, então nada o toca); `fim` = já passou do fundo
export function posicaoDoItem(slot, ms, limites) {
  const idade = ms - slot.t0
  if (idade < 0) return { x: slot.x0, y: limites.y - 200, visivel: false, fim: false }
  const queda = (idade / 1000) * slot.vy
  const frac = limitar(queda / Math.max(1, limites.height), 0, 1)
  const y = limites.y - 12 + queda
  const x = limitar(slot.x0 + (slot.xT - slot.x0) * frac + Math.sin((idade / 1000) * 2.4 + slot.fase) * slot.sway, limites.x + 10, limites.x + limites.width - 10)
  const fim = y > limites.y + limites.height + 16
  return { x, y, visivel: y > limites.y - 6 && !fim, fim }
}

// Enche a lixeira: devolve { cheio, missil } (o excesso passa para a próxima lixeira)
export function encherLixeira(cheio, valor, max) {
  const soma = cheio + valor
  if (soma >= max) return { cheio: soma - max, missil: true }
  return { cheio: soma, missil: false }
}

export function criarRegraReciclagem(opcoes = {}) {
  const cfg = { ...PADRAO_RECICLAGEM, ...opcoes }
  return {
    id: 'reciclagem',
    nome: opcoes.nome ?? 'RECICLAGEM',
    descricao: opcoes.descricao ?? 'Lixo VERDE não machuca: peguem para encher a lixeira e lançar o míssil!',
    fases: opcoes.textosDasFases ?? {
      1: { descricao: 'Cuidado: o lixo MARROM está contaminado e machuca!' },
      2: { descricao: 'A lixeira enche mais rápido: peguem o verde!' },
    },
    criar(api) {
      let fase = 0
      let cheio = 0
      let decorrido = 0
      let slots = []
      let vivos = [] // { slot, item }
      let zonaEm = 0
      const pendentes = [] // mísseis no ar (o dano entra no impacto ou, no mais tardar, no fim da esquiva)
      const maxDaLixeira = () => cfg.max + 3 * Math.max(0, api.n - 2)
      const valorDoVerde = () => cfg.valor[Math.min(fase, cfg.valor.length - 1)]
      const hpMax = () => api.cena?.estado?.chefe?.hpMax ?? cfg.hpMaxPadrao
      const caixa = () => api.cena?.quadro?.caixa
      let lixeira = null
      if (api.cena?.chefePos) {
        const c = api.cena.chefePos
        lixeira = api.guardar(criarLixeira(api.cena, { x: c.x + (opcoes.lixeiraDx ?? 150), y: c.y + 10 }))
        lixeira.atualizar(0, maxDaLixeira())
      }

      const sumirDeVez = (item) => {
        // sem o brilho amarelo da ponte fora da caixa: o objeto vai para longe da tela antes de apagar
        for (const o of item.desenho ?? []) o.setPosition?.(-300, -300)
        api.removerItem(item)
      }

      const disparar = () => {
        const dano = Math.max(1, Math.round(hpMax() * cfg.dano))
        api.banner('MÍSSIL RECICLADO!', '#6dff8a')
        api.cena?.registrar?.('missil')
        api.dica('missil', 'Lixeira cheia: o MÍSSIL RECICLADO bate nele e enche a QUEBRA!')
        let feito = false
        const aplicar = () => {
          if (feito) return
          feito = true
          const i = pendentes.indexOf(aplicar)
          if (i >= 0) pendentes.splice(i, 1)
          api.danoNoChefe(dano, 'missil')
          api.adicionarQuebra(cfg.quebra, 'missil')
        }
        pendentes.push(aplicar)
        if (lixeira && api.cena?.chefePos) {
          lixeira.cheia()
          const c = api.cena.chefePos
          lancarMissil(api.cena, lixeira.posicao, { x: c.x, y: c.y - 10 }, { aoChegar: aplicar })
        } else aplicar()
      }

      const pegouLimpo = (j, item) => {
        const r = encherLixeira(cheio, valorDoVerde(), maxDaLixeira())
        cheio = r.cheio
        lixeira?.atualizar(cheio, maxDaLixeira(), { ganhou: valorDoVerde() })
        api.dica('limpo', 'Lixo verde: não machuca! Cada um enche a lixeira.')
        if (api.cena) estouroDoItem(api.cena, item.x, item.y, 'limpo')
        if (r.missil) disparar()
      }

      const pegouSujo = (j, item) => {
        api.dica('sujo', 'Lixo marrom está contaminado: machuca! Só o verde é reciclável.')
        if (api.cena) estouroDoItem(api.cena, item.x, item.y, 'sujo')
        const fator = NIVEIS[api.nivel]?.dano ?? 1
        api.ferir(j, Math.max(1, Math.round(cfg.danoSujo * fator)))
      }

      return {
        comecarEsquiva() {
          decorrido = 0
          zonaEm = 0
          vivos = []
          slots = planejarItens({ rng: api.rng('lixo'), fase, n: api.n, limites: api.limites(), cfg })
          for (const slot of slots) {
            const limpo = slot.tipo === 'limpo'
            const item = api.adicionarItem({
              x: slot.x0,
              y: api.limites().y - 200,
              raio: limpo ? RAIO_LIMPO : RAIO_SUJO,
              cor: limpo ? COR_RECICLA : COR_SUJO,
              forma: 'circulo',
              aoPegar: limpo ? pegouLimpo : pegouSujo,
            })
            item.tipo = slot.tipo
            if (api.cena) {
              for (const o of item.desenho ?? []) {
                api.cena.tweens.killTweensOf(o)
                o.destroy()
              }
              item.desenho = desenharItemDaRegra(api.cena, caixa(), item, slot.tipo)
            }
            vivos.push({ slot, item })
          }
        },

        atualizar(dt) {
          decorrido += dt
          const l = api.limites()
          zonaEm -= dt
          const marcarZonas = zonaEm <= 0
          if (marcarZonas) zonaEm = 90
          for (const v of [...vivos]) {
            const p = posicaoDoItem(v.slot, decorrido, l)
            if (p.fim) {
              vivos.splice(vivos.indexOf(v), 1)
              sumirDeVez(v.item)
              continue
            }
            v.item.x = p.x
            v.item.y = p.y
            for (const o of v.item.desenho ?? []) o.setPosition?.(p.x, p.y)
            // o marrom vale como zona de perigo para a CPU aliada desviar dele
            if (marcarZonas && p.visivel && v.slot.tipo === 'sujo' && api.cena?.quadro?.balas) {
              registrarZona(api.cena.quadro.balas, { tipo: 'circulo', x: p.x, y: p.y, raio: v.item.raio + 6 }, { ms: 0, dura: 160 })
            }
          }
          vivos = vivos.filter((v) => api.itens().includes(v.item))
        },

        terminarEsquiva() {
          // o míssil que ainda estava no ar bate agora (o dano é do estado, igual em todos os PCs)
          for (const aplicar of [...pendentes]) aplicar()
          for (const v of vivos) for (const o of v.item.desenho ?? []) o.setPosition?.(-300, -300)
          vivos = []
        },

        faseNova(f) {
          fase = f
        },

        // a CPU aliada vai atrás do verde mais perto que já está dentro da caixa (nunca do marrom)
        alvoDoBot(j) {
          const c = api.coracoes().find((x) => x.j === j && x.ativo)
          const l = api.limites()
          if (!c) return null
          // o COMPACTADOR está fechando: o vão vale mais que qualquer item
          const vao = api.cena?.vaoDoCompactador
          if (vao && (api.cena.time?.now ?? 0) - vao.em < 250) return vao
          let melhor = null
          let d = Infinity
          for (const v of vivos) {
            if (v.slot.tipo !== 'limpo' || !api.itens().includes(v.item)) continue
            const p = posicaoDoItem(v.slot, decorrido, l)
            if (!p.visivel || p.y > l.y + l.height - 8) continue
            const dist = Math.hypot(p.x - c.x, p.y - c.y)
            if (dist < d) {
              d = dist
              melhor = v.item
            }
          }
          return melhor
        },

        // (testes e dev) o estado da lixeira
        estado: () => ({ cheio, max: maxDaLixeira(), fase, pendentes: pendentes.length }),
      }
    },
  }
}
