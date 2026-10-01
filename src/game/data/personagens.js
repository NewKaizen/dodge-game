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
//
// Personagens extras (sprite: boneco genérico na cor deles até você pôr um PNG,
// ver assets.js). "Passiva" aqui é um efeito embutido nas próprias ações dele.
//   Ralsei (MAGIC) - suporte. Passiva Coração Gentil: toda cura dele também dá
//   +5% MERCY no chefe (o inimigo fica comovido)
//     Prece de Cura    30%  cura 26 do mais ferido
//     Pacificar        40%  +25% MERCY e o próximo ataque vem com 20% menos balas
//     Manto Felpudo    45%  no próximo ataque, quem tiver menos de 50% de HP leva 40% menos dano
//                           (os outros, 20% menos)
//     Bênção Suave     70%  cura 25% do HP máximo de todos (levanta quem caiu)
//   Noelle (MAGIC) - gelo e cura. Passiva Frio: toda magia de gelo deixa o
//   próximo ataque 5% mais lento
//     Cura Gelada      28%  cura 18 do mais ferido
//     Floco de Neve    35%  26 de dano
//     Muralha de Gelo  55%  a party leva 35% menos dano no próximo ataque
//     Nevasca          85%  60-80 de dano e o próximo ataque 20% mais curto
//   Berdly (MAGIC) - vento, muito confiante. Passiva Ego Inflado: cada magia de
//   vento usada deixa as próximas +10% mais fortes (até +30%, a luta toda)
//     Explicação Longa 15%  o chefe cochila: próximo ataque 15% mais curto
//     Rajada de Vento  35%  26 de dano
//     Tornado Genial   60%  14 de dano e o vento leva 30% das balas do próximo ataque
//     Plano Infalível  25%  o próximo FIGHT dele causa +80%, mas 30% de chance de tropeçar (nada acontece)
//   Dess (ROCK) - guitarra e caos. Passiva Bis!: depois de cada ação dela, 20%
//   de chance de a plateia devolver 10% de TP
//     Solo Distorcido  30%  dano sorteado de 10 a 45
//     Riff Pesado      45%  24 de dano e o próximo ataque 15% mais lento
//     Plateia Animada  25%  cura 10 de todos e um aliado sorteado ganha +40% no próximo FIGHT
//     Acorde Final     75%  55-75 de dano; 15% de chance de desafinar (8 de dano, mas cura 15 de todos)
//   Asriel (MAGIC) - estrelas e fogo. Passiva Poder Crescente: as magias de dano
//   dele ficam +15% mais fortes a cada fase do chefe
//     Chuva Estelar    40%  3 estrelas de 8 a 16 de dano cada
//     Esperança        35%  cura 15% do HP máximo de todos e +10% MERCY
//     Espada de Fogo   55%  40 de dano e o próximo FIGHT dele causa +30%
//     Fogo Caótico     75%  55-85 de dano, mas o chefe fica 3% mais rápido (permanente)
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

  // ---------- personagens extras ----------

  ralsei: {
    nome: 'Ralsei',
    cor: 0x6be08a,
    hp: 80,
    defesa: 1,
    fight: { dano: 8, velocidade: 250 },
    act: {
      rotulo: 'MAGIC',
      usaActsDoInimigo: false,
      lista: [
        {
          nome: 'Prece de Cura',
          custoTP: 30,
          executar(ctx) {
            const alvo = ctx.maisFerido()
            ctx.texto(`* ${ctx.ator.nome} juntou as mãos e fez uma prece por ${alvo === ctx.ator ? 'si mesmo' : alvo.nome}.`)
            ctx.curar(alvo, 26)
            coracaoGentil(ctx)
          },
        },
        {
          nome: 'Pacificar',
          custoTP: 40,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} pediu, com toda a educação, que a luta acabasse.`)
            ctx.mercy(ctx.alvo, 25)
            ctx.proximoAtaque({ densidade: 0.8 })
            ctx.texto(`* ${ctx.alvo.nome} ficou sem graça. O próximo ataque vem com menos balas.`)
          },
        },
        {
          nome: 'Manto Felpudo',
          custoTP: 45,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} cobriu a party com um manto bem quentinho.`)
            ctx.party.forEach((m) => ctx.proteger(m, m.hp / m.max < 0.5 ? 0.6 : 0.8))
            ctx.texto('* Quem está mais ferido fica mais protegido no próximo ataque.')
          },
        },
        {
          nome: 'Bênção Suave',
          custoTP: 70,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} espalhou uma luz calma sobre todo mundo.`)
            ctx.party.forEach((m) => ctx.curar(m, Math.ceil(m.max * 0.25)))
            coracaoGentil(ctx)
          },
        },
      ],
    },
  },

  noelle: {
    nome: 'Noelle',
    cor: 0xa8eaff,
    hp: 85,
    defesa: 1,
    fight: { dano: 9, velocidade: 260 },
    act: {
      rotulo: 'MAGIC',
      usaActsDoInimigo: false,
      lista: [
        {
          nome: 'Cura Gelada',
          custoTP: 28,
          executar(ctx) {
            const alvo = ctx.maisFerido()
            ctx.texto(`* ${ctx.ator.nome} passou um floco geladinho nos machucados ${alvo === ctx.ator ? 'dela' : `de ${alvo.nome}`}.`)
            ctx.curar(alvo, 18)
          },
        },
        {
          nome: 'Floco de Neve',
          custoTP: 35,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} lançou um floco de neve afiado!`)
            ctx.dano(ctx.alvo, 26)
            frio(ctx)
          },
        },
        {
          nome: 'Muralha de Gelo',
          custoTP: 55,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} ergueu uma parede de gelo na frente da party.`)
            ctx.party.forEach((m) => ctx.proteger(m, 0.65))
            frio(ctx)
          },
        },
        {
          nome: 'Nevasca',
          custoTP: 85,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} respirou fundo... e o ar congelou!`)
            ctx.dano(ctx.alvo, ctx.sortear(60, 80))
            ctx.proximoAtaque({ duracao: 0.8 })
            frio(ctx)
            ctx.texto(`* ${ctx.alvo.nome} ficou meio congelado. O próximo ataque vai ser mais curto.`)
          },
        },
      ],
    },
  },

  berdly: {
    nome: 'Berdly',
    cor: 0xd8f05a,
    hp: 95,
    defesa: 2,
    fight: { dano: 13, velocidade: 340 },
    act: {
      rotulo: 'MAGIC',
      usaActsDoInimigo: false,
      lista: [
        {
          nome: 'Explicação Longa',
          custoTP: 15,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} começou a explicar a própria genialidade em detalhes.`)
            ctx.proximoAtaque({ duracao: 0.85 })
            ctx.texto(`* ${ctx.alvo.nome} cochilou um pouco. O próximo ataque vai ser mais curto.`)
          },
        },
        {
          nome: 'Rajada de Vento',
          custoTP: 35,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} bateu as mãos e soltou uma rajada de vento!`)
            ctx.dano(ctx.alvo, egoInflado(ctx, 26))
          },
        },
        {
          nome: 'Tornado Genial',
          custoTP: 60,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} girou até virar um tornado. "Calculado!"`)
            ctx.dano(ctx.alvo, egoInflado(ctx, 14))
            ctx.proximoAtaque({ densidade: 0.7 })
            ctx.texto('* O vento vai levar parte das balas do próximo ataque!')
          },
        },
        {
          nome: 'Plano Infalível',
          custoTP: 25,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} anunciou um plano infalível...`)
            if (ctx.sortear(1, 100) <= 30) {
              ctx.texto('* ...e tropeçou no meio do anúncio. Não deu em nada.')
              return
            }
            ctx.fortalecer(ctx.ator, 1.8)
            ctx.texto(`* ...e funcionou! O próximo FIGHT de ${ctx.ator.nome} vai causar +80% de dano.`)
          },
        },
      ],
    },
  },

  dess: {
    nome: 'Dess',
    cor: 0xff5070,
    hp: 100,
    defesa: 1,
    // mais golpes, cada um mais fraco: um combo frenético
    fight: { dano: 14, velocidade: 300, golpes: 4, fatorGolpe: 0.36 },
    act: {
      rotulo: 'ROCK',
      usaActsDoInimigo: false,
      lista: [
        {
          nome: 'Solo Distorcido',
          custoTP: 30,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} mandou um solo de guitarra no volume máximo!`)
            ctx.dano(ctx.alvo, ctx.sortear(10, 45))
            bis(ctx)
          },
        },
        {
          nome: 'Riff Pesado',
          custoTP: 45,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} tocou um riff tão pesado que o chão tremeu!`)
            ctx.dano(ctx.alvo, 24)
            ctx.proximoAtaque({ velocidade: 0.85 })
            ctx.texto(`* ${ctx.alvo.nome} ficou tonto. O próximo ataque vai ser mais lento.`)
            bis(ctx)
          },
        },
        {
          nome: 'Plateia Animada',
          custoTP: 25,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} chamou a plateia! Todo mundo pulou junto.`)
            const vivos = ctx.party.filter((m) => !m.caido)
            ctx.party.forEach((m) => ctx.curar(m, 10))
            if (vivos.length) {
              const sorteado = vivos[ctx.sortear(0, vivos.length - 1)]
              ctx.fortalecer(sorteado, 1.4)
              ctx.texto(`* ${sorteado.nome} se empolgou: +40% no próximo FIGHT!`)
            }
            bis(ctx)
          },
        },
        {
          nome: 'Acorde Final',
          custoTP: 75,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} ergueu a guitarra para o acorde final...`)
            if (ctx.sortear(1, 100) <= 15) {
              ctx.texto('* ...e desafinou feio. Mas a plateia adorou!')
              ctx.dano(ctx.alvo, 8)
              ctx.party.forEach((m) => ctx.curar(m, 15))
            } else {
              ctx.texto('* ...e o som explodiu pelo palco inteiro!')
              ctx.dano(ctx.alvo, ctx.sortear(55, 75))
            }
            bis(ctx)
          },
        },
      ],
    },
  },

  asriel: {
    nome: 'Asriel',
    cor: 0xffb03a,
    hp: 100,
    defesa: 2,
    fight: { dano: 13, velocidade: 300 },
    act: {
      rotulo: 'MAGIC',
      usaActsDoInimigo: false,
      lista: [
        {
          nome: 'Chuva Estelar',
          custoTP: 40,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} chamou uma chuva de estrelas!`)
            for (let i = 0; i < 3; i++) ctx.dano(ctx.alvo, poderCrescente(ctx, ctx.sortear(8, 16)))
          },
        },
        {
          nome: 'Esperança',
          custoTP: 35,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} lembrou a party de não desistir.`)
            ctx.party.forEach((m) => ctx.curar(m, Math.ceil(m.max * 0.15)))
            ctx.mercy(ctx.alvo, 10)
          },
        },
        {
          nome: 'Espada de Fogo',
          custoTP: 55,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} acendeu uma espada de fogo e golpeou!`)
            ctx.dano(ctx.alvo, poderCrescente(ctx, 40))
            ctx.fortalecer(ctx.ator, 1.3)
          },
        },
        {
          nome: 'Fogo Caótico',
          custoTP: 75,
          executar(ctx) {
            ctx.texto(`* ${ctx.ator.nome} soltou um fogo caótico em todas as direções!`)
            ctx.dano(ctx.alvo, poderCrescente(ctx, ctx.sortear(55, 85)))
            ctx.agressividade({ velocidade: 1.03 })
            ctx.texto(`* ${ctx.alvo.nome} ficou irritado e um pouco mais rápido.`)
          },
        },
      ],
    },
  },
}

// ---------- passivas (chamadas de dentro das ações) ----------

// Ralsei: toda cura dele comove o chefe
function coracaoGentil(ctx) {
  if (!ctx.alvo) return
  ctx.mercy(ctx.alvo, 5)
}

// Noelle: magia de gelo deixa o próximo ataque mais lento
function frio(ctx) {
  ctx.proximoAtaque({ velocidade: 0.95 })
}

// Berdly: cada magia de vento aumenta o ego (+10% por uso, até +30%, a luta toda).
// O ego fica guardado no próprio membro da party (ctx.ator.ego).
function egoInflado(ctx, dano) {
  const ego = ctx.ator.ego ?? 0
  ctx.ator.ego = Math.min(3, ego + 1)
  if (ego) ctx.texto(`* O ego de ${ctx.ator.nome} está em +${ego * 10}%!`)
  return Math.round(dano * (1 + ego * 0.1))
}

// Dess: 20% de chance de a plateia devolver 10% de TP
function bis(ctx) {
  if (ctx.sortear(1, 100) > 20) return
  ctx.tp(10)
  ctx.texto('* A plateia gritou "BIS!" e devolveu 10% de TP.')
}

// Asriel: +15% de dano por fase do chefe (fase 0, 1, 2...)
function poderCrescente(ctx, dano) {
  return Math.round(dano * (1 + 0.15 * (ctx.fase ?? 0)))
}
