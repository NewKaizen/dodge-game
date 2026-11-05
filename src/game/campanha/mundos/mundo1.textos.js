// Os TEXTOS do Mundo 1, "A Casa Silenciosa" (história original da campanha; os personagens são os do
// jogo). Separados das regras (mundo1.js) para editar à vontade: mudar uma fala aqui não muda nada na
// partida. Guia de tom e estilo: docs/campanha.md ("Silêncio e ecos").
// Formato de cada cena (campanha/dialogo.js):
//   { quem: 'ralsei', texto: '...' }              fala com retrato e nome ('narrador': sem retrato)
//   { quem, texto, se: { bilhete: 'guardar' } }   só aparece se a escolha guardada bater
//   { escolha: { chave, opcoes: [{ valor, texto }] } }   duas opções (só sabor: nunca muda a partida)
// As escolhas ficam salvas na conta (o servidor guarda) e mudam falas mais adiante.
// A Kris quase não fala: as "respostas" dela são silêncios ('...') ou gestos na voz do narrador, e
// as escolhas são ações, nunca falas. Os outros aparecem como ECOS (ecos: true): não são bem eles,
// são o que ficou deles — frases pela metade, coisas que não foram ditas.
//
// Resumo (sem contar o fim): depois de uma noite que ninguém explica, a cidade fica quieta, e todas
// as portas da casa de Kris passam a dar em lugares conhecidos — a sala de aula, o corredor da
// escola, o ginásio, a rua, a sala de estar — vazios e tortos. Em cada um, um eco de alguém
// repete o que não conseguiu terminar. No fim da escada fica o último quarto, onde mora a ausência
// que fez a casa se calar.
export const TEXTOS_MUNDO1 = {
  titulo: 'A Casa Silenciosa',
  resumo: 'Depois daquela noite, toda porta da casa dá num lugar conhecido. Vazio. Só restaram ecos.',
  // os ecos (quem não é a Kris nem o narrador): retrato apagado e com brilho, nome em tom frio
  ecos: true,
  cenarioMapa: 'mapa',
  fases: {
    sala: {
      cenario: 'sala',
      tema: 'As cadeiras flutuam perto do teto. No baralho, só sobraram espadas.',
      antes: [
        { quem: 'narrador', texto: 'Depois daquela noite, a cidade ficou quieta demais.' },
        { quem: 'narrador', texto: 'Na casa de Kris, as portas não dão mais nos mesmos cômodos.' },
        { quem: 'narrador', texto: 'A primeira dá na sala de aula. As cadeiras flutuam perto do teto. O quadro guarda a lição de ontem, pela metade.' },
        { quem: 'ralsei', texto: '...e por isso, quando alguém vai embora, a gente—' },
        { quem: 'ralsei', texto: 'Ah. Kris. Você veio para a aula?' },
        { quem: 'narrador', texto: 'A voz chega um instante atrasada. Como um eco.' },
        { quem: 'ralsei', texto: 'Eu não lembro o fim da frase. Faz tempo que eu tento.' },
        { quem: 'kris', texto: '...' },
        { quem: 'narrador', texto: 'Na mesa, um bilhete dobrado. Uma letra que Kris conhece.' },
        { escolha: { chave: 'bilhete', opcoes: [{ valor: 'guardar', texto: 'Guardar o bilhete no bolso, sem abrir' }, { valor: 'deixar', texto: 'Deixar o bilhete onde está' }] } },
        { quem: 'narrador', texto: 'O papel é leve. Kris o guarda no bolso.', se: { bilhete: 'guardar' } },
        { quem: 'narrador', texto: 'Kris não toca no bilhete. Ele continua ali, dobrado, esperando alguém.', se: { bilhete: 'deixar' } },
        { quem: 'ralsei', texto: 'No baralho só sobraram espadas. As outras cartas... alguém levou.' },
        { quem: 'ralsei', texto: 'Fica até o sinal tocar? Só um pouco.' },
      ],
      depois: [
        { quem: 'ralsei', texto: 'Ah. Eu lembrei.' },
        { quem: 'ralsei', texto: '...quando alguém vai embora, a gente deixa uma luz acesa.' },
        { quem: 'narrador', texto: 'O eco se desfaz como giz apagado. Lá embaixo, outra porta range.' },
      ],
      derrota: [{ quem: 'ralsei', texto: 'Tudo bem. A aula recomeça. Ela sempre recomeça.' }],
    },
    corredor: {
      cenario: 'corredor',
      tema: 'Os armários respiram. A cada rodada, as paredes chegam mais perto.',
      antes: [
        { quem: 'narrador', texto: 'O corredor da escola está mais comprido do que era.' },
        { quem: 'narrador', texto: 'A cada passo, as paredes chegam um pouco mais perto.' },
        { quem: 'noelle', texto: 'Kris? Eu ia te entregar uma coisa. Estava aqui, no meu armário...' },
        { quem: 'noelle', texto: 'Eu ensaiei tanto o que ia dizer. Agora não sobrou espaço para nada.' },
        { quem: 'narrador', texto: 'Kris não diz nada. Mas fica.' },
        { quem: 'noelle', texto: 'Se as paredes fecharem... fica perto? Só até passar.' },
      ],
      depois: [
        { quem: 'noelle', texto: 'Achei. Era só um cartão. Eu nunca escrevi nada dentro.' },
        { quem: 'noelle', texto: 'Acho que eu só queria que alguém soubesse que eu estava aqui.' },
        { quem: 'narrador', texto: 'As paredes se afastam devagar. O cartão em branco fica no chão.' },
      ],
      derrota: [{ quem: 'noelle', texto: 'Desculpa. Deixei apertar demais. De novo?' }],
    },
    ginasio: {
      cenario: 'ginasio',
      tema: 'Aqui tudo volta. O ataque que você manda volta para você.',
      antes: [
        { quem: 'narrador', texto: 'No ginásio, cada passo volta duas vezes. A arquibancada está vazia.' },
        { quem: 'berdly', texto: 'Kris! Bem na hora da premiação. Ninguém mais veio.' },
        { quem: 'berdly', texto: 'Eu ensaiei o discurso. Agradeço a todos que... que...' },
        { quem: 'berdly', texto: 'Aqui tudo volta. As palavras, os passos. O que você me mandar, volta para você.' },
        { escolha: { chave: 'eco', opcoes: [{ valor: 'palmas', texto: 'Bater palmas, uma vez' }, { valor: 'quieto', texto: 'Ficar em silêncio' }] } },
        { quem: 'narrador', texto: 'Uma palma. O ginásio devolve dez.', se: { eco: 'palmas' } },
        { quem: 'berdly', texto: '...Obrigado. Foi o suficiente.', se: { eco: 'palmas' } },
        { quem: 'narrador', texto: 'Kris não faz barulho. O silêncio volta também, mais pesado.', se: { eco: 'quieto' } },
        { quem: 'berdly', texto: 'Tudo bem. Eu também nunca sei o que dizer.', se: { eco: 'quieto' } },
      ],
      depois: [
        { quem: 'berdly', texto: 'Sabe o que eu nunca disse no discurso? Que eu tinha medo de ninguém aparecer.' },
        { quem: 'berdly', texto: 'Você apareceu.' },
        { quem: 'narrador', texto: 'As lâmpadas do teto se apagam, uma por uma, sem pressa.' },
      ],
      derrota: [{ quem: 'berdly', texto: 'O eco ganhou. Ele sempre fala por último.' }],
    },
    rua: {
      cenario: 'rua',
      tema: 'Você chega aqui sem forças: começa sem energia nenhuma.',
      antes: [
        { quem: 'narrador', texto: 'A rua de casa não termina. Os postes só acendem quando Kris passa.' },
        { quem: 'narrador', texto: 'As pernas pesam. É o cansaço de quem andou a noite toda.' },
        { quem: 'susie', texto: 'Ei. Senta aí. Eu também não consigo mais andar.' },
        { quem: 'susie', texto: 'Fiquei te esperando no ponto. Você não veio. Ninguém veio.' },
        { quem: 'kris', texto: '...' },
        { quem: 'susie', texto: 'Não precisa explicar. Eu só queria ter dito tchau direito.' },
        { quem: 'susie', texto: 'A gente começa sem nada. Zero. Vai juntando no caminho.' },
      ],
      depois: [
        { quem: 'susie', texto: 'Heh. Ainda tá de pé.' },
        { quem: 'susie', texto: 'Vai. Eu fico mais um pouco. Alguém tem que ficar.' },
        { quem: 'narrador', texto: 'O poste atrás dela apaga. O da frente acende.' },
      ],
      derrota: [{ quem: 'susie', texto: 'Levanta. Devagar. Eu espero.' }],
    },
    chuva: {
      cenario: 'chuva',
      tema: 'Chove dentro de casa. Todo ataque na sua caixa cai do teto.',
      antes: [
        { quem: 'narrador', texto: 'Na sala de estar, chove. A água cai do teto e não molha nada.' },
        { quem: 'narrador', texto: 'No sofá, alguém afina um violão que não faz som.' },
        { quem: 'dess', texto: 'Oi, Kris. Faz tempo, né? Ou não faz. Perdi a conta.' },
        { quem: 'dess', texto: 'Eu ia tocar uma última música no fim do show. Nunca deu tempo.' },
        { quem: 'narrador', texto: 'Kris senta no braço do sofá e escuta a música que não toca.' },
        { quem: 'dess', texto: 'Olha pro alto. Aqui tudo vem de cima. A chuva, as lembranças.' },
      ],
      depois: [
        { quem: 'dess', texto: 'Lembra do refrão? Eu também não. Ficou bonito assim, sem.' },
        { quem: 'dess', texto: 'Tem alguém no último quarto. Deixou a porta encostada.' },
        { quem: 'narrador', texto: 'A chuva para. As gotas ficam suspensas no ar, esperando.' },
      ],
      derrota: [{ quem: 'dess', texto: 'Molhou? Não molha. Tenta de novo.' }],
    },
    quarto: {
      cenario: 'quarto',
      tema: 'A lembrança mais funda. Tudo o que ela manda chega duas vezes.',
      antes: [
        { quem: 'narrador', texto: 'No fim da escada, a porta do quarto. Uma luz fina passa por baixo.' },
        { quem: 'narrador', texto: 'Kris conhece este quarto. Ninguém dorme nele há muito tempo.' },
        { quem: 'asriel', texto: 'Oi, Kris.' },
        { quem: 'asriel', texto: '...oi, Kris.' },
        { quem: 'asriel', texto: 'Você cresceu. Ou eu é que fiquei pequeno.' },
        { quem: 'asriel', texto: 'Eu fui embora tão depressa. Nem acendi a luz para me despedir.' },
        { quem: 'asriel', texto: 'Você guardou o bilhete. Eu escrevi correndo. Só dizia: volto logo.', se: { bilhete: 'guardar' } },
        { quem: 'asriel', texto: 'Você deixou o bilhete na mesa. Tudo bem. Eu também deixei tanta coisa.', se: { bilhete: 'deixar' } },
        { quem: 'asriel', texto: 'Eu sou só o que ficou. A parte que não sabe ir embora.' },
        { quem: 'asriel', texto: 'Se você ficar, a casa continua assim. Quieta. Para sempre.' },
        { quem: 'kris', texto: '...' },
        { quem: 'narrador', texto: 'Kris dá um passo para dentro.' },
      ],
      depois: [
        { quem: 'asriel', texto: '...Você não vai ficar. Eu sei.' },
        { quem: 'asriel', texto: 'Mas você veio. Isso eu vou lembrar.' },
        { quem: 'narrador', texto: 'O quarto escurece. O eco não diz mais nada.' },
        { quem: 'narrador', texto: 'Kris volta pelo corredor. Antes de sair, acende a luz.' },
        { quem: 'narrador', texto: 'E deixa acesa.' },
      ],
      derrota: [{ quem: 'asriel', texto: 'Fica. Só mais um pouco.' }],
    },
  },
  // quando o chefe se refaz no meio da luta (regra `virada`)
  virada: 'A PORTA SE ABRIU POR INTEIRO. O teto desceu, e a lembrança se refez.',
}
