import { FONTE } from '../../../../constants.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { semLigaduras } from '../../../../campanha/texto.js'

// Peças em comum das rodadas bônus da ESTAÇÃO ESPACIAL (eventos/estacao/*.js).
//
//   dono(arena, j)           quem desvia na pista j (CORAÇÃO TROCADO muda)
//   pistaViva(arena, j)      a pista j está no meio do ataque (e o dono dela não caiu)
//   ehBot(arena, j)          a pista j é da CPU (no Guia, a caixa da esquerda também é de um bot enquanto você não pegar o controle)
//   ehEspelho(arena, j)      a pista j é a caixa ESPELHO da partida em rede (o coração de lá é do outro PC)
//   criarCofre()             guarda objetos do Phaser e destrói tudo no fim (sem vazar para a rodada seguinte)
//   avisoDoEvento(...)       a instrução curta (até 6 palavras) em cima de cada caixa, que some sozinha
//   ouvirBotao(arena, fn)    fn(lado, 'A' | 'B') a cada aperto; devolve a função que desliga
//   criarCanal(arena, tipo)  mensagens do evento entre os dois PCs (rede); sem rede, vale só aqui

export const dono = (arena, j) => arena.donoDaPista?.(j) ?? j

export function pistaViva(arena, j) {
  const p = arena.pistas?.[j]
  return Boolean(p && p.atacando && !p.ataque?.desarmado && !arena.ko?.[dono(arena, j)])
}

export const ehBot = (arena, j) => {
  const d = dono(arena, j)
  return d === arena.cpu || (arena.controlador === null && d === 0)
}

export const ehEspelho = (arena, j) => Boolean(arena.pistas?.[j]?.espelho)

export function criarCofre(arena) {
  const vivos = new Set()
  return {
    guardar(o) {
      vivos.add(o)
      o.once?.('destroy', () => vivos.delete(o))
      return o
    },
    limpar() {
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy?.()
      }
      vivos.clear()
    },
    get tamanho() {
      return vivos.size
    },
  }
}

// Texto com contorno (fonte do jogo), sem a ligadura "fi"/"fl". `pista`: recorta na caixa; sem ela é objeto de tela.
export function texto(arena, x, y, conteudo, { cor = '#ffffff', tamanho = 12, pista = null, profundidade = 14 } = {}) {
  const t = arena.add
    .text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: Math.max(3, Math.round(tamanho / 4)) })
    .setOrigin(0.5)
    .setDepth(pista ? profundidade : 95)
  if (pista) pista.caixa.recortar(t)
  else ignorarNasCaixas(arena, t)
  return t
}

// "SEM ATRITO! FREIE AO CONTRÁRIO": a regra nova, uma vez, em cima de cada caixa
export function avisoDoEvento(arena, cofre, conteudo, { cor = '#9ee8ff', ms = 2400 } = {}) {
  for (const pista of arena.pistas) {
    const l = pista.caixa.limites
    const t = cofre.guardar(texto(arena, l.centerX, l.top - 13, conteudo, { cor, tamanho: 11 }))
    t.setAlpha(0)
    arena.tweens.add({ targets: t, alpha: 1, duration: 160 })
    arena.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 300, onComplete: () => t.scene && t.destroy() })
  }
}

// Os apertos do jogador (ver controles.js): `lado` já é o lado do jogador (no online, sempre o meu).
// Sem pausa, sem a cena saindo e, no Guia, só depois de você pegar o controle.
export function ouvirBotao(arena, fn) {
  const c = arena.controles
  if (!c?.onBotao) return () => {}
  const ouvinte = (lado, botao) => {
    if (arena.pausado || arena.saindo || arena.controlador === null) return
    fn(lado, botao)
  }
  c.onBotao(ouvinte)
  return () => {
    const i = c.ouvintes?.indexOf(ouvinte) ?? -1
    if (i >= 0) c.ouvintes.splice(i, 1)
  }
}

// O que o evento manda para o outro PC (uma mensagem por tipo): sem rede só devolve a função de ouvir vazia.
//   const canal = criarCanal(arena, 'estTrator')
//   canal.enviar({ ... })                    (a rodada vai junto: mensagem de outra rodada é ignorada)
//   canal.ouvir((dados) => ...)              dados do outro PC, desta rodada
//   canal.fechar()
export function criarCanal(arena, tipo) {
  const rede = arena.rede
  const desligar = []
  return {
    enviar(dados) {
      rede?.enviar?.(tipo, arena.estado?.rodada ?? 0, { ...dados, r: arena.estado?.rodada ?? 0 })
    },
    ouvir(fn) {
      if (!rede?.canal?.ao) return
      desligar.push(
        rede.canal.ao(tipo, (dados) => {
          if (!dados || arena.saindo || dados.r !== arena.estado?.rodada) return
          fn(dados)
        }),
      )
    },
    fechar() {
      desligar.splice(0).forEach((f) => f?.())
    },
  }
}
