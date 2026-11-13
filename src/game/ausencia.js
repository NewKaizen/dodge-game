import { FONTE } from './constants.js'
import { ignorarNasCaixas } from './recorte.js'

// AUSENTE / PAUSADO no lugar de quem não está olhando a partida em rede (docs/rede-pvp.md "Aba em
// segundo plano e pausa online"). É SÓ AVISO: a partida não espera ninguém por isso.
//   - AUSENTE: a aba dele está escondida há uns segundos (o servidor marca `segundoPlano` depois de
//     SEGUNDO_PLANO_MS). O jogo dele continua andando (game/segundoPlano.js) com o coração parado.
//   - PAUSADO: ele abriu o menu de pausa por cima da partida (scenes/Pausa.js no modo online); a
//     partida continua, o coração dele fica parado e o relógio da escolha corre.
//   SEM CONEXÃO (caiu) tem o aviso próprio (os 20 s da 2D) e ganha deste.
//
//   marcaDeAusencia(p)   p = um participante (game/rede.js participantesDaPartida) -> 'PAUSADO' | 'AUSENTE' | null
//   assinaturaDeAusencia(lista)  muda quando a marca de alguém muda
//   criarSelos(cena, { lugar(j) -> { x, y, origem }, quem(j) -> participante })
//                        os selinhos no placar dos 2 jogadores; selos.atualizar(agora) (a cada ~250 ms)

export const COR_AUSENCIA = { PAUSADO: '#9be7ff', AUSENTE: '#ffcc66' }
export const SELOS_MS = 250

export function marcaDeAusencia(p) {
  if (!p || p.caiu != null) return null
  if (p.pausado) return 'PAUSADO'
  if (p.segundoPlano) return 'AUSENTE'
  return null
}

// o que mudou na ausência de todos (as arenas de N refazem os cartões só quando muda)
export const assinaturaDeAusencia = (lista) => (lista ?? []).map((p) => `${p.indice}:${marcaDeAusencia(p) ?? ''}`).join('|')

// o lado (0/1) de um participante numa partida de 2: o host da partida é o P1
export const ladoDe = (p) => (p?.host ? 0 : 1)

// partida de 2: o outro lado está com a aba escondida (o servidor marcou)? (pvp/rede/ArenaRede.js `ausente`)
export const outroAusente = (lista, meuLado) => Boolean((lista ?? []).find((p) => ladoDe(p) !== meuLado)?.segundoPlano)

export function criarSelos(cena, { lados, lugar, quem }) {
  const textos = new Map()
  for (const j of lados) {
    const { x, y, origem = [0, 0] } = lugar(j)
    const t = cena.add
      .text(x, y, '', { fontFamily: FONTE, fontSize: '11px', color: COR_AUSENCIA.AUSENTE, stroke: '#000000', strokeThickness: 3, backgroundColor: '#000000aa', padding: { x: 4, y: 1 } })
      .setOrigin(...origem)
      .setDepth(90)
      .setVisible(false)
    ignorarNasCaixas(cena, t)
    textos.set(j, t)
  }
  let proximo = 0
  return {
    atualizar(agora, forcar = false) {
      if (!forcar && agora < proximo) return
      proximo = agora + SELOS_MS
      for (const [j, t] of textos) {
        if (!t.active) continue
        const marca = marcaDeAusencia(quem(j))
        t.setVisible(Boolean(marca))
        if (marca && t.text !== marca) t.setText(marca).setColor(COR_AUSENCIA[marca])
      }
    },
    marca: (j) => (textos.get(j)?.visible ? textos.get(j).text : null),
    destruir() {
      for (const t of textos.values()) t.destroy()
      textos.clear()
    },
  }
}
