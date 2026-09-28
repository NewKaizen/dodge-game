// Personagens jogáveis. O sprite é a textura de mesmo id (arte/sprites.js ou
// o arquivo que você colocar em assets.js); o ícone do painel é icone-<id>.
//
//   hp, defesa
//   cor                   borda do painel, barra de HP e nome
//   comandos              botões do menu (padrão: COMANDOS em constants.js)
//   fight                 sobrescreve FIGHT de constants.js (dano, velocidade, critico...)
//   act.rotulo            nome do botão de ACT ('ACT', 'MAGIC'...)
//   act.usaActsDoInimigo  mostra os ACTs do chefe (como a Kris)
//   act.lista             ACTs/magias próprios: { nome, custoTP, executar(ctx) }
//                         o ctx está documentado em Battle.contextoAcao()
export const PERSONAGENS = {
  kris: {
    nome: 'Kris',
    cor: 0x4aa8ff,
    hp: 90,
    defesa: 2,
    fight: { dano: 12 },
    act: { rotulo: 'ACT', usaActsDoInimigo: true, lista: [] },
  },

  susie: {
    nome: 'Susie',
    cor: 0xb05cff,
    hp: 110,
    defesa: 1,
    fight: { dano: 16, velocidade: 320 },
    act: {
      rotulo: 'MAGIC',
      usaActsDoInimigo: false,
      lista: [
        {
          nome: 'Rude Buster',
          custoTP: 50,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} usou RUDE BUSTER!`)
            ctx.dano(ctx.alvo, 45)
          },
        },
        {
          nome: 'Ultimate Heal',
          custoTP: 32,
          executar(ctx) {
            const alvo = ctx.maisFerido()
            ctx.texto(`* ${ctx.ator.nome} tentou curar ${alvo.nome}...`)
            ctx.curar(alvo, 12)
          },
        },
      ],
    },
  },
}
