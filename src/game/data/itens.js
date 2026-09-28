// Itens da party. O inventário inicial (quantidades) vem de cada chefe.
//
//   nome, descricao
//   alvo       'aliado' (o jogador escolhe Kris ou Susie) ou 'party' (todos)
//   usar(ctx)  efeito; ctx.aliado é quem recebe (se alvo 'aliado'),
//              ctx.curar(membro, n), ctx.tp(n), ctx.party, ctx.texto(msg)
export const ITENS = {
  bandagem: {
    nome: 'Bandagem',
    descricao: 'Cura 30 HP.',
    alvo: 'aliado',
    usar: (ctx) => ctx.curar(ctx.aliado, 30),
  },
  cha: {
    nome: 'Chá Quente',
    descricao: 'Cura 60 HP.',
    alvo: 'aliado',
    usar: (ctx) => ctx.curar(ctx.aliado, 60),
  },
  doce: {
    nome: 'Doce',
    descricao: 'Cura 20 HP e dá +10% de TP.',
    alvo: 'aliado',
    usar: (ctx) => {
      ctx.curar(ctx.aliado, 20)
      ctx.tp(10)
      ctx.texto('* O TP subiu 10%!')
    },
  },
  pocao: {
    nome: 'Poção Grande',
    descricao: 'Cura 120 HP de um personagem.',
    alvo: 'aliado',
    usar: (ctx) => ctx.curar(ctx.aliado, 120),
  },
  cristal: {
    nome: 'Cristal Cura Total',
    descricao: 'Cura toda a party por completo.',
    alvo: 'party',
    usar: (ctx) => ctx.party.forEach((m) => ctx.curar(m, m.max - m.hp)),
  },
}
