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
//
// Ações com TP (custo em % da barra; o TP é reservado na escolha e gasto no turno):
//   Kris (junto com os ACTs do chefe)
//     Palavra Amiga    20%  +20% MERCY no alvo e o chefe fica 5% mais lento (permanente)
//     Plano de Ataque  35%  o próximo FIGHT de cada um da party causa +60% de dano
//     Formação Escudo  60%  no próximo turno do chefe a party leva metade do dano
//                           e o ataque vem com 15% menos balas
//   Susie (MAGIC)
//     Rude Buster      50%  45 de dano
//     Ultimate Heal    32%  cura 12 do mais ferido
//     Rugido Selvagem  25%  próximo ataque 25% mais lento e com a onda mais curta
//     Machado Maluco   40%  dano sorteado: 20% de chance de 4, 60% de 20-50, 20% de 80-100
//     Abraço de Grupo  80%  cura 35% do HP máximo de todos (levanta quem caiu)
export const PERSONAGENS = {
  kris: {
    nome: 'Kris',
    cor: 0x4aa8ff,
    hp: 90,
    defesa: 2,
    fight: { dano: 12 },
    act: {
      rotulo: 'ACT',
      usaActsDoInimigo: true,
      lista: [
        {
          nome: 'Palavra Amiga',
          custoTP: 20,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} falou com calma, sem levantar a arma.`)
            ctx.mercy(ctx.alvo, 20)
            ctx.agressividade({ velocidade: 0.95 })
            ctx.texto(`* ${ctx.alvo.nome} hesitou por um instante.`)
          },
        },
        {
          nome: 'Plano de Ataque',
          custoTP: 35,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} rabiscou um plano no chão.`)
            ctx.party.filter((m) => !m.caido).forEach((m) => ctx.fortalecer(m, 1.6))
            ctx.texto('* O próximo FIGHT de cada um vai causar +60% de dano!')
          },
        },
        {
          nome: 'Formação Escudo',
          custoTP: 60,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} puxou todo mundo para trás do escudo.`)
            ctx.party.forEach((m) => ctx.proteger(m, 0.5))
            ctx.proximoAtaque({ densidade: 0.85 })
            ctx.texto('* No próximo ataque, a party leva metade do dano!')
          },
        },
      ],
    },
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
        {
          nome: 'Rugido Selvagem',
          custoTP: 25,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} rugiu tão alto que o chão tremeu!`)
            ctx.proximoAtaque({ velocidade: 0.75, duracao: 0.6 })
            ctx.texto(`* ${ctx.alvo.nome} ficou assustado. O próximo ataque vai ser mais fraco.`)
          },
        },
        {
          nome: 'Machado Maluco',
          custoTP: 40,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} girou o machado de olhos fechados...`)
            const sorte = ctx.sortear(1, 100)
            if (sorte <= 20) {
              ctx.texto('* ...e acertou de raspão. Que vergonha.')
              ctx.dano(ctx.alvo, 4)
            } else if (sorte <= 80) {
              ctx.texto('* ...e acertou!')
              ctx.dano(ctx.alvo, ctx.sortear(20, 50))
            } else {
              ctx.texto('* ...e acertou EM CHEIO!!')
              ctx.dano(ctx.alvo, ctx.sortear(80, 100))
            }
          },
        },
        {
          nome: 'Abraço de Grupo',
          custoTP: 80,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} deu um abraço de urso em todo mundo.`)
            ctx.party.forEach((m) => ctx.curar(m, Math.ceil(m.max * 0.35)))
          },
        },
      ],
    },
  },
}
