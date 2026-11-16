// REGRA DO CHEFE (CO-OP 2.0, docs/coop-cartas.md "Regra do chefe (API)"): o gancho para cada chefe ganhar
// UMA mecânica própria que dura a luta toda (tabuleiro de xadrez, fio de Wi-Fi entre os corações, dado do
// caos que troca uma regra por rodada, lixo para reciclar que enche um balde e lança um míssil...).
// Lógica pura (sem Phaser): a arena (CoopArena / CoopArenaN) liga isto com uma PONTE que desenha, mexe nos
// corações e fala com a rede; os testes ligam com uma ponte de mentira (coop/__tests__/regraChefe.test.js).
//
// No arquivo do chefe (coop/chefes/<id>.js):
//
//   regra: {
//     id: 'estrelas',
//     nome: 'CHUVA DE ESTRELAS',
//     descricao: 'Peguem as estrelas no quadro para encher a QUEBRA.',   (UMA frase curta: vai no banner)
//     fases: { 1: { descricao: 'Agora as estrelas valem o dobro.' } },  (opcional: banner na fase nova)
//     criar(api) {                                                       (uma vez por luta, em todos os PCs)
//       return {
//         comecar() {},                     a luta começou (depois do banner)
//         inicioDaRodada(rodada) {},        a carta do chefe já está na mesa
//         ataque(carta, A, padrao) {},      opcional: devolva outro ataque (da biblioteca A) no lugar do padrão
//                                           da carta (ex.: A.juntos(padrao, A.rain(...))); null = o padrão
//         comecarEsquiva({ carta }) {},     o quadro abriu (o ataque começa)
//         atualizar(dt) {},                 todo frame da esquiva (ms)
//         terminarEsquiva() {},             o quadro fechou (os itens sem `fica` somem sozinhos)
//         fimDaRodada({ novaFase }) {},     a rodada acabou
//         faseNova(f) {},                   o chefe mudou de fase
//         aoMensagem(lado, acao, dados) {}, chegou um api.enviar (de qualquer PC, também deste)
//         alvoDoBot(j) {},                  opcional: { x, y } para onde a CPU aliada quer ir
//         terminar() {},                    a luta acabou (a API já limpa itens, zonas e objetos guardados)
//       }
//     },
//   }
//
// A API (o `api` do criar):
//   api.rodada · api.n · api.nivel · api.semente      (leitura)
//   api.rng(tag)                 sorteio DETERMINÍSTICO da rodada: () => [0, 1), o mesmo em todos os PCs
//                                para a mesma (semente, rodada, tag)
//   api.jogadores()              os jogadores do estado (só leitura: HP, caído, energia...)
//   api.coracoes()               [{ j, x, y, ativo }] os corações no quadro agora
//   api.limites()                { x, y, width, height } do quadro agora
//   api.adicionarItem({ x, y, raio, cor, forma, rotulo, fica, aoPegar(j, item) })   item que se PEGA
//                                encostando o coração; some ao pegar (e no fim da esquiva, sem `fica`)
//   api.adicionarZona({ x, y, largura, altura, cor, alpha, fica, aoEntrar(j), aoSair(j) })   área no quadro
//   api.removerItem(item) · api.removerZona(zona) · api.itens() · api.zonas()
//   api.dentro(zona, x, y)       o ponto está na zona?
//   api.adicionarQuebra(pontos, motivo)   enche a barra de QUEBRA (coop2.js)
//   api.danoNoChefe(dano, motivo)         golpe extra no chefe (número na tela)
//   api.curar(j, hp) · api.ferir(j, dano) cura / acerto no jogador j (o acerto passa pelo escudo dele)
//   api.empurrar(j, dx, dy)               move o coração j (só no PC dono dele: os outros veem pela rede)
//   api.banner(texto, cor) · api.dica(id, texto)   aviso curto / dica que só aparece UMA vez por PC
//   api.enviar(acao, dados)               efeito de UM jogador para todos: roda aoMensagem(lado, acao, dados)
//                                         aqui e nos outros PCs (lado = o jogador deste PC)
//   api.meu(j)                            o coração j é simulado neste PC (o meu, ou a CPU aliada daqui)?
//   api.guardar(obj) · api.cena           enfeite Phaser próprio (guardado = destruído no fim); use pouco
//
// REDE (o que faz a regra ser segura com 2 a 4 PCs): os ganchos rodam em TODOS os PCs no mesmo ponto da
// rodada, com o mesmo estado; tudo que eles fazem tem de sair do estado, do tempo da esquiva ou do api.rng
// (nunca Math.random). O único que nasce num PC só é o que um CORAÇÃO faz (pegar item, entrar/sair de
// zona): só o PC dono daquele coração decide e a API repassa (mensagem `regra`, pelo mesmo canal do dano,
// antes do fimEsquiva dele); os outros PCs repetem o aoPegar/aoEntrar/aoSair quando chega. Por isso, o que o
// aoPegar faz (quebra, dano no chefe, cura) acontece uma vez em cada PC, igual em todos.
import { criarRng, aleatorio } from '../pvp/baralho.js'

const RAIO_CORACAO = 7 // ~ o raio de toque do coração

export function rngDaRegra(semente, rodada, tag = '') {
  const rng = criarRng(`${semente}:${rodada}:regra:${tag}`)
  return () => aleatorio(rng)
}

// UMA frase curta (o banner do começo da luta): sem ponto no meio e no máximo 90 letras
export function descricaoValida(descricao) {
  const s = String(descricao ?? '').trim()
  return s.length > 0 && s.length <= 90 && !/[.!?]\s+\S/.test(s)
}

// A regra da luta. def = o `regra` do chefe (ou null: sem regra, tudo vira nada); ponte = o que a arena dá:
//   { semente, nivel, n, rodada(), estado(), meu(j), coracoes(), limites(), desenharItem(item) -> h,
//     desenharZona(zona) -> h, apagar(h), banner(texto, cor), dica(id, texto), quebra(pontos, motivo),
//     danoNoChefe(dano, motivo), curar(j, hp), ferir(j, dano), empurrar(j, dx, dy), enviar(acao, dados),
//     cena }
export class RegraDaLuta {
  constructor(def, ponte) {
    this.def = def ?? null
    this.ponte = ponte
    this.itensVivos = []
    this.zonasVivas = []
    this.guardados = []
    this.contador = 0 // ids dos itens/zonas: na mesma ordem em todos os PCs
    this.rodadaDoContador = null
    this.esquivando = false
    this.terminada = false
    this.inst = null
    if (!this.def) return
    if (!descricaoValida(this.def.descricao)) console.warn(`[regra] a descrição de '${this.def.id}' deve ser UMA frase curta`)
    this.inst = this.def.criar?.(this.criarApi()) ?? {}
  }

  get ativa() {
    return Boolean(this.def) && !this.terminada
  }

  // ---------- a API da regra ----------

  criarApi() {
    const p = this.ponte
    const regra = this
    return {
      get rodada() {
        return p.rodada()
      },
      n: p.n,
      nivel: p.nivel,
      semente: p.semente,
      cena: p.cena ?? null,
      rng: (tag = '') => rngDaRegra(p.semente, p.rodada(), tag),
      jogadores: () => p.estado().jogadores,
      coracoes: () => p.coracoes(),
      limites: () => p.limites(),
      adicionarItem: (opcoes) => regra.adicionarItem(opcoes),
      removerItem: (item) => regra.removerItem(item),
      itens: () => [...regra.itensVivos],
      adicionarZona: (opcoes) => regra.adicionarZona(opcoes),
      removerZona: (zona) => regra.removerZona(zona),
      zonas: () => [...regra.zonasVivas],
      dentro: (zona, x, y) => Math.abs(x - zona.x) <= zona.largura / 2 && Math.abs(y - zona.y) <= zona.altura / 2,
      adicionarQuebra: (pontos, motivo = regra.def.id) => p.quebra(pontos, motivo),
      danoNoChefe: (dano, motivo = regra.def.id) => p.danoNoChefe(dano, motivo),
      curar: (j, hp) => p.curar(j, hp),
      ferir: (j, dano) => p.ferir(j, dano),
      empurrar: (j, dx, dy) => p.meu(j) && p.empurrar(j, dx, dy),
      banner: (texto, cor) => p.banner(texto, cor),
      dica: (id, texto) => p.dica(`regra:${regra.def.id}:${id}`, texto),
      enviar: (acao, dados = null) => regra.enviar(acao, dados),
      meu: (j) => p.meu(j),
      guardar: (obj) => {
        regra.guardados.push(obj)
        return obj
      },
    }
  }

  proximoId(tipo) {
    const rodada = this.ponte.rodada()
    if (this.rodadaDoContador !== rodada) {
      this.rodadaDoContador = rodada
      this.contador = 0
    }
    return `${tipo}:${rodada}:${this.contador++}`
  }

  adicionarItem({ x, y, raio = 9, cor = 0xffe14a, forma = 'estrela', rotulo = '', fica = false, aoPegar = null } = {}) {
    const item = { id: this.proximoId('item'), tipo: 'item', x, y, raio, cor, forma, rotulo, fica, aoPegar }
    item.desenho = this.ponte.desenharItem?.(item) ?? null
    this.itensVivos.push(item)
    return item
  }

  removerItem(item) {
    const i = this.itensVivos.indexOf(item)
    if (i < 0) return false
    this.itensVivos.splice(i, 1)
    this.ponte.apagar?.(item.desenho)
    return true
  }

  adicionarZona({ x, y, largura, altura, cor = 0x7fd8ff, alpha = 0.25, fica = false, aoEntrar = null, aoSair = null } = {}) {
    const zona = { id: this.proximoId('zona'), tipo: 'zona', x, y, largura, altura, cor, alpha, fica, aoEntrar, aoSair, dentro: new Set() }
    zona.desenho = this.ponte.desenharZona?.(zona) ?? null
    this.zonasVivas.push(zona)
    return zona
  }

  removerZona(zona) {
    const i = this.zonasVivas.indexOf(zona)
    if (i < 0) return false
    this.zonasVivas.splice(i, 1)
    this.ponte.apagar?.(zona.desenho)
    return true
  }

  // api.enviar: roda aqui (lado = o jogador deste PC) e a arena manda aos outros
  enviar(acao, dados) {
    const lado = this.ponte.meuLado?.() ?? 0
    this.ponte.enviar?.(`u:${acao}`, dados)
    this.inst?.aoMensagem?.(lado, acao, dados)
  }

  // ---------- os ganchos (a arena chama) ----------

  chamar(gancho, ...args) {
    if (!this.ativa) return undefined
    const fn = this.inst?.[gancho]
    if (typeof fn !== 'function') return undefined
    try {
      return fn.apply(this.inst, args)
    } catch (erro) {
      console.error(`[regra] '${this.def.id}'.${gancho} falhou`, erro)
      return undefined
    }
  }

  comecar() {
    this.chamar('comecar')
  }

  inicioDaRodada(rodada) {
    this.chamar('inicioDaRodada', rodada)
  }

  // o ataque da carta (A = attacks/, padrao = o ataque de sempre): a regra pode trocar
  ataque(carta, A, padrao) {
    return this.chamar('ataque', carta, A, padrao) ?? padrao
  }

  comecarEsquiva(info) {
    this.esquivando = true
    this.chamar('comecarEsquiva', info)
  }

  // todo frame da esquiva: o gancho, depois o toque dos corações DESTE PC nos itens e zonas
  atualizar(dt) {
    if (!this.ativa || !this.esquivando) return
    this.chamar('atualizar', dt)
    const coracoes = (this.ponte.coracoes() ?? []).filter((c) => c.ativo && this.ponte.meu(c.j))
    for (const item of [...this.itensVivos]) {
      const quem = coracoes.find((c) => Math.hypot(c.x - item.x, c.y - item.y) <= item.raio + RAIO_CORACAO)
      if (!quem) continue
      this.pegar(item, quem.j)
      this.ponte.enviar?.('item', { id: item.id, j: quem.j })
    }
    for (const zona of this.zonasVivas) {
      for (const c of coracoes) {
        const dentro = Math.abs(c.x - zona.x) <= zona.largura / 2 && Math.abs(c.y - zona.y) <= zona.altura / 2
        if (dentro === zona.dentro.has(c.j)) continue
        this.trocarZona(zona, c.j, dentro)
        this.ponte.enviar?.('zona', { id: zona.id, j: c.j, dentro })
      }
    }
  }

  pegar(item, j) {
    if (!this.removerItem(item)) return
    try {
      item.aoPegar?.(j, item)
    } catch (erro) {
      console.error(`[regra] aoPegar de '${this.def.id}' falhou`, erro)
    }
  }

  trocarZona(zona, j, dentro) {
    if (dentro) zona.dentro.add(j)
    else zona.dentro.delete(j)
    try {
      ;(dentro ? zona.aoEntrar : zona.aoSair)?.(j, zona)
    } catch (erro) {
      console.error(`[regra] zona de '${this.def.id}' falhou`, erro)
    }
  }

  // o que chegou de outro PC (mensagem `regra`): o mesmo pegar/zona/enviar de lá, aqui
  aoMensagem(lado, acao, dados) {
    if (!this.ativa) return
    if (acao === 'item') {
      const item = this.itensVivos.find((i) => i.id === dados?.id)
      if (item) this.pegar(item, dados.j ?? lado)
    } else if (acao === 'zona') {
      const zona = this.zonasVivas.find((z) => z.id === dados?.id)
      if (zona && Boolean(dados.dentro) !== zona.dentro.has(dados.j)) this.trocarZona(zona, dados.j, Boolean(dados.dentro))
    } else if (typeof acao === 'string' && acao.startsWith('u:')) this.chamar('aoMensagem', lado, acao.slice(2), dados)
  }

  terminarEsquiva() {
    if (!this.esquivando) return
    this.esquivando = false
    this.chamar('terminarEsquiva')
    for (const item of [...this.itensVivos]) if (!item.fica) this.removerItem(item)
    for (const zona of [...this.zonasVivas]) if (!zona.fica) this.removerZona(zona)
  }

  fimDaRodada(info) {
    this.chamar('fimDaRodada', info)
  }

  // o texto da fase nova (def.fases[f].descricao) e o gancho; devolve o texto (ou null)
  faseNova(f) {
    if (!this.ativa) return null
    this.chamar('faseNova', f)
    return this.def.fases?.[f]?.descricao ?? null
  }

  alvoDoBot(j) {
    const alvo = this.chamar('alvoDoBot', j)
    if (alvo) return alvo
    // sem alvo próprio: o item mais perto do coração da CPU
    const c = (this.ponte.coracoes() ?? []).find((x) => x.j === j && x.ativo)
    if (!c || !this.itensVivos.length) return null
    return [...this.itensVivos].sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]
  }

  terminar() {
    if (this.terminada || !this.def) return
    this.chamar('terminar')
    this.terminada = true
    for (const item of [...this.itensVivos]) this.removerItem(item)
    for (const zona of [...this.zonasVivas]) this.removerZona(zona)
    for (const obj of this.guardados.splice(0)) obj?.destroy?.()
  }
}

// A regra de EXEMPLO (neutra: nenhum chefe usa; os testes e o dev usam, `regra: 'exemplo'` nos dados da
// CoopArena no dev). Uma estrela por esquiva, num lugar sorteado pela rodada: quem pegar enche a QUEBRA.
export const REGRA_EXEMPLO = {
  id: 'exemplo',
  nome: 'ESTRELA CADENTE',
  descricao: 'Peguem a estrela no quadro para encher a QUEBRA.',
  fases: { 1: { descricao: 'Agora a estrela vale o dobro.' } },
  criar(api) {
    let valor = 15
    return {
      faseNova() {
        valor = 30
      },
      comecarEsquiva() {
        const l = api.limites()
        const r = api.rng('estrela')
        api.adicionarItem({
          x: l.x + 24 + r() * (l.width - 48),
          y: l.y + 20 + r() * (l.height * 0.5),
          raio: 9,
          forma: 'estrela',
          aoPegar: () => {
            api.adicionarQuebra(valor, 'estrela')
            api.dica('estrela', 'Estrela pega: a QUEBRA encheu um pouco!')
          },
        })
      },
    }
  },
}

export const REGRAS = { exemplo: REGRA_EXEMPLO }
