import { ataques as A } from '../../attacks/index.js'

// Coronel Caçamba — EXTREMO. Fazendeiro esquentado com um forcado, fogo de
// churrasqueira e uma caminhonete que ele NÃO sabe dirigir: tenta atropelar
// o coração, erra e volta de ré. Cada fase põe mais caminhonete na estrada.
// "Acenar" e "Pedir Carona" enfraquecem o próximo ataque; SPARE quando a
// PACIÊNCIA chega a 100%.
export default {
  id: 'coronel',
  nome: 'Coronel Caçamba',
  dificuldade: 'extremo',
  sprite: 'coronel',
  fundo: 'coronel',
  musica: 'coronel',

  hp: 500,
  defesa: 4,
  danoBala: 12,

  rotuloMercy: 'PACIÊNCIA',
  descricao: 'Fazendeiro de pavio curto. Jura que dirige bem. Não dirige.',
  textoInicial: '* O Coronel Caçamba buzina e acelera na sua direção!',
  inventario: { bandagem: 2, cha: 2, pocao: 3, doce: 1, cristal: 1 },

  tema: {
    formas: ['chama', 'bola'],
    cores: { chama: 0xff8a1c, bola: 0xffd24c, barra: 0xd8d8e0 },
    cor: 0xff8a1c,
  },

  acts: [
    {
      nome: 'Acenar',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} acenou para ele parar.`)
        ctx.texto('* O Coronel acenou de volta e tirou o pé do acelerador. O próximo ataque vem mais lento!')
        ctx.proximoAtaque({ velocidade: 0.8 })
        ctx.mercy(ctx.alvo, 8)
      },
    },
    {
      nome: 'Pedir Carona',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} esticou o polegar.`)
        ctx.texto('* O Coronel freou pra pensar... O próximo ataque vai ser mais curto!')
        ctx.proximoAtaque({ duracao: 0.6, densidade: 0.9 })
        ctx.mercy(ctx.alvo, 12)
      },
    },
    {
      nome: 'Elogiar Caminhonete',
      executar(ctx) {
        if (ctx.alvo.flags.elogiou) {
          ctx.texto(`* ${ctx.ator.nome} elogiou a caminhonete de novo.`)
          ctx.texto('* Ele já sabe que ela é bonita. Mas gostou.')
          ctx.mercy(ctx.alvo, 6)
          return
        }
        ctx.alvo.flags.elogiou = true
        ctx.texto(`* ${ctx.ator.nome} disse que a caminhonete é a mais bonita da região.`)
        ctx.texto('* O Coronel ficou todo orgulhoso! Mas agora quer mostrar o quanto ela corre...')
        ctx.agressividade({ velocidade: 1.08 })
        ctx.mercy(ctx.alvo, 22)
      },
    },
  ],

  podePoupar: (chefe) => chefe.mercy >= 100,
  textoNaoPoupa: (chefe) => `* O Coronel ainda quer te atropelar. (PACIÊNCIA ${chefe.mercy}%)`,
  aoFimDoTurno: (chefe, ctx) => ctx.mercy(chefe, 2),

  fases: [
    {
      hp: 1,
      flavor: ['* Cheiro de fumaça e feno.', '* A caminhonete ronca atrás dele.', '* Ele ajeita o chapéu de palha.'],
      falas: ['Sai da frente, sô!', 'Essa estrada é minha!', 'Fom-fom!'],
      ataques: [
        A.brasas(),
        A.forcado(),
        A.caminhonete({ re: 0 }),
        A.aimed({ forma: 'chama', velocidade: 170, intervalo: 700 }),
      ],
    },
    {
      hp: 0.75,
      entrada: 'Espera aí que eu vou dar a volta!',
      velocidadeFundo: 1.4,
      flavor: ['* A caminhonete dá ré fazendo bipe.', '* O forcado brilha no farol.'],
      falas: ['Olha a ré!', 'Eu dirijo muito bem!', 'Quem pôs esse coração aí?!'],
      ataques: [
        A.caminhonete(),
        A.juntos(A.brasas({ intervalo: 320 }), A.aimed({ forma: 'chama', intervalo: 1100, velocidade: 180 })),
        A.forcado({ intervalo: 1200, parada: 200 }),
        A.spiral({ forma: 'chama', velocidade: 130 }),
      ],
    },
    {
      hp: 0.5,
      entrada: 'AGORA EU PISO FUNDO!',
      velocidadeFundo: 1.9,
      flavor: ['* O motor ruge.', '* Faíscas voam da churrasqueira.'],
      falas: ['Segura o chapéu!', 'Fom-fom! FOM-FOM!', 'Não tem freio não!'],
      ataques: [
        A.caminhonete({ intervalo: 1500, velocidade: 440 }),
        A.comCaixa({ largura: 280, altura: 180 }, A.juntos(A.caminhonete({ intervalo: 2400, re: 0 }), A.brasas({ intervalo: 420 }))),
        A.sequencia(A.forcado({ duracao: 3500, intervalo: 1000 }), A.caminhonete({ duracao: 3500 })),
        A.juntos(A.spiral({ velocidade: 140, bracos: 4 }), A.forcado({ intervalo: 1900 })),
      ],
    },
    {
      hp: 0.25,
      entrada: 'Chamei os primos! Todo mundo de caminhonete!',
      velocidadeFundo: 2.4,
      flavor: ['* Faróis por todo lado.', '* Isso não é mais uma estrada. É um congestionamento.'],
      falas: ['BI-BI!', 'Última volta!', 'Primo, pela esquerda!'],
      ataques: [
        A.caminhonete({ faixas: 4, ocupar: 2, intervalo: 1500, caixa: { largura: 280, altura: 190 } }),
        A.comCaixa({ largura: 280, altura: 180 }, A.juntos(A.caminhonete({ intervalo: 1700 }), A.aimed({ forma: 'chama', intervalo: 1300, velocidade: 190 }))),
        A.sequencia(A.brasas({ duracao: 3000, intervalo: 180 }), A.forcado({ duracao: 3000, intervalo: 900, parada: 180 }), A.caminhonete({ duracao: 3500, velocidade: 460 })),
        A.juntos(A.forcado({ intervalo: 1300 }), A.brasas({ intervalo: 300, estouro: 3 })),
      ],
    },
  ],
}
