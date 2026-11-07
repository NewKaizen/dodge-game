// Os TEXTOS do Mundo 1, "A Casa Silenciosa" (história original da campanha; os personagens são os do
// jogo). Separados das regras (mundo1.js) para editar à vontade: mudar uma fala aqui não muda nada na
// partida. Guia de tom e estilo: docs/campanha.md ("Vozes roubadas").
// Formato de cada cena (campanha/dialogo.js):
//   { quem: 'ralsei', texto: '...' }              fala com retrato e nome ('narrador': sem retrato;
//                                                 'silencio': o vilão, sem rosto, em letras grandes)
//   { quem, texto, se: { bilhete: 'guardar' } }   só aparece se a escolha guardada bater
//   { escolha: { chave, opcoes: [{ valor, texto }] } }   duas opções (só sabor: nunca muda a partida)
// As escolhas ficam salvas na conta (o servidor guarda) e mudam falas mais adiante.
//
// `luta` são as falas curtas DURANTE a partida (balão em cima de quem fala; só sabor):
//   inicio      quando a luta começa
//   ferido      o oponente com metade do HP (o Silêncio está soltando)
//   quase       o oponente com 1/4 do HP
//   voceMal     você com pouco HP (os amigos já libertados torcem)
//   perfeito    você desviou de tudo numa rodada
//
// A Kris quase não fala: as "respostas" dela são silêncios ('...') ou gestos na voz do narrador; as
// escolhas são ações, nunca falas. Ela fala UMA vez no mundo inteiro, no fim do chefe: é o clímax.
// Quem ainda está preso aparece como ECO (ecos: true): apagado, frio. Quem já foi libertado (as
// fases vencidas antes desta: mundos/index.js `libertosAte`) aparece com cor de novo.
//
// Resumo: na noite do Festival das Luzes, a cidade apagou de uma vez e as vozes sumiram. Uma sombra,
// o SILÊNCIO, feita de tudo o que ninguém teve coragem de dizer, prendeu os amigos de Kris dentro das
// próprias lembranças. As portas da casa levam até eles. A cada amigo libertado, uma luz volta e
// mais alguém sobe a escada junto. No último quarto, o do irmão que foi embora sem se despedir, o
// Silêncio espera — e só uma coisa o desfaz: Kris dizer o que nunca disse.
export const TEXTOS_MUNDO1 = {
  titulo: 'A Casa Silenciosa',
  resumo: 'O Silêncio roubou as vozes da cidade e prendeu seus amigos nas próprias lembranças. Traga cada um de volta.',
  // quem ainda está preso: retrato apagado e com brilho frio, nome em tom frio
  ecos: true,
  cenarioMapa: 'mapa',
  fases: {
    sala: {
      cenario: 'sala',
      tema: 'O Silêncio levou as cartas. No baralho, só sobraram espadas.',
      antes: [
        { quem: 'narrador', texto: 'Na noite do Festival das Luzes, a cidade inteira apagou de uma vez.' },
        { quem: 'narrador', texto: 'Quando Kris acordou, ninguém mais falava. Nem os pássaros. Nem o rádio. Nem a mãe.' },
        { quem: 'narrador', texto: 'Alguma coisa roubou as vozes. E levou junto as pessoas de quem Kris mais gosta.' },
        { quem: 'narrador', texto: 'As portas da casa agora dão em lembranças. A primeira dá na sala de aula.' },
        { quem: 'ralsei', texto: '...e por isso, quando alguém vai embora, a gente—' },
        { quem: 'silencio', texto: 'SHHH.' },
        { quem: 'narrador', texto: 'A sombra no quadro-negro se mexe. Não tem olhos. Só uma boca costurada.' },
        { quem: 'ralsei', texto: 'Kris?! Você consegue me ver? Ele me prendeu aqui. Eu não consigo lembrar o fim da frase!' },
        { quem: 'silencio', texto: 'NINGUÉM PRECISA TERMINAR NADA. CALAR É MAIS FÁCIL.' },
        { quem: 'ralsei', texto: 'Quando ele fala por mim, eu ataco sem querer. Me desculpa, de verdade!' },
        { quem: 'narrador', texto: 'Na mesa, um bilhete dobrado. Uma letra que Kris conhece bem.' },
        { escolha: { chave: 'bilhete', opcoes: [{ valor: 'guardar', texto: 'Guardar o bilhete no bolso, sem abrir' }, { valor: 'deixar', texto: 'Deixar o bilhete onde está' }] } },
        { quem: 'narrador', texto: 'O papel é leve. Kris o guarda no bolso, perto do coração.', se: { bilhete: 'guardar' } },
        { quem: 'narrador', texto: 'Kris não toca no bilhete. Ele continua ali, dobrado, esperando alguém.', se: { bilhete: 'deixar' } },
        { quem: 'ralsei', texto: 'Ele levou quase todas as cartas. Só sobraram espadas. Vai ter que bastar!' },
        { quem: 'ralsei', texto: 'Me acerta até ele me soltar. Eu aguento. ...Eu acho!' },
      ],
      depois: [
        { quem: 'narrador', texto: 'A sombra escorre do quadro-negro e foge por baixo da porta, chiando.' },
        { quem: 'narrador', texto: 'A cor volta para Ralsei como tinta caindo na água.' },
        { quem: 'ralsei', texto: 'Eu lembrei! ...quando alguém vai embora, a gente deixa uma luz acesa. Para achar o caminho de volta.' },
        { quem: 'ralsei', texto: 'Kris, o Silêncio pegou os outros também. Eu ouvi a Noelle chorando no corredor.' },
        { quem: 'ralsei', texto: 'Eu vou com você. Cada amigo que a gente trouxer de volta é uma luz a mais contra ele.' },
      ],
      derrota: [
        { quem: 'silencio', texto: 'VIU? É MAIS FÁCIL FICAR QUIETO.' },
        { quem: 'ralsei', texto: 'Não escuta ele, Kris! Respira e tenta de novo. Eu ainda estou aqui!' },
      ],
      luta: {
        inicio: [{ quem: 'silencio', texto: 'VOCÊ NUNCA FALA MESMO. POR QUE LUTAR?' }],
        ferido: [{ quem: 'ralsei', texto: 'Isso! Ele está me soltando!' }],
        quase: [{ quem: 'ralsei', texto: 'Só mais um pouco, Kris!' }],
        voceMal: [{ quem: 'ralsei', texto: 'Cuidado! Não deixa ele te pegar também!' }],
        perfeito: [{ quem: 'ralsei', texto: 'Uau! Nem encostou!' }],
      },
    },
    corredor: {
      cenario: 'corredor',
      tema: 'As paredes fecham a cada rodada. Cuidado com os cristais de gelo.',
      antes: [
        { quem: 'narrador', texto: 'O corredor da escola não termina. E as paredes estão andando.' },
        { quem: 'ralsei', texto: 'Ali, Kris! No fim do corredor!' },
        { quem: 'narrador', texto: 'Noelle está encolhida contra os armários. Cristais de gelo crescem à volta dela.' },
        { quem: 'noelle', texto: 'Kris? Não, não chega perto! As paredes fecham quando alguém chega perto!' },
        { quem: 'silencio', texto: 'ELA NUNCA DISSE NADA A NINGUÉM. FICOU PEQUENA. EU SÓ AJUDEI.' },
        { quem: 'noelle', texto: 'Eu tinha um cartão pra você. Ensaiei o ano inteiro. E não tive coragem de entregar.' },
        { quem: 'ralsei', texto: 'Noelle, a gente está aqui! Você não está sozinha!' },
        { quem: 'noelle', texto: 'Então... fica perto? Mesmo apertado? Mesmo com o gelo?' },
        { quem: 'narrador', texto: 'Kris não diz nada. Mas dá um passo à frente.' },
      ],
      depois: [
        { quem: 'narrador', texto: 'O gelo racha de cima a baixo. As paredes respiram fundo e voltam para o lugar.' },
        { quem: 'noelle', texto: 'Kris... você ficou. Mesmo quando apertou.' },
        { quem: 'noelle', texto: 'O cartão! Achei! ...Tá em branco. Eu nunca soube o que escrever.' },
        { quem: 'noelle', texto: 'Mas agora eu sei. Eu te conto quando tudo voltar. Prometo.' },
        { quem: 'ralsei', texto: 'Duas luzes! Ouviram? Vem do ginásio. Tem alguém discursando sozinho lá.' },
      ],
      derrota: [
        { quem: 'silencio', texto: 'APERTADO, NÃO É? DESISTA.' },
        { quem: 'noelle', texto: 'Kris! Eu seguro o gelo o quanto der. Vem de novo!' },
      ],
      luta: {
        inicio: [{ quem: 'noelle', texto: 'Me desculpa! Eu não controlo o gelo!' }],
        ferido: [{ quem: 'noelle', texto: 'Tá derretendo... continua, Kris!' }],
        quase: [{ quem: 'silencio', texto: 'NÃO! ELA É MINHA!' }],
        voceMal: [{ quem: 'ralsei', texto: 'Kris, respira! Procura o vão!' }],
        perfeito: [{ quem: 'noelle', texto: 'Como você passou por ali?!' }],
      },
    },
    ginasio: {
      cenario: 'ginasio',
      tema: 'Tudo aqui ecoa: o ataque que você manda volta. E os holofotes miram.',
      antes: [
        { quem: 'narrador', texto: 'No ginásio, holofotes giram sobre uma arquibancada vazia. Tudo aqui ecoa.' },
        { quem: 'berdly', texto: 'KRIS! Finalmente, uma plateia! Bem na hora da minha premiação!' },
        { quem: 'berdly', texto: 'Melhor aluno, melhor cérebro, melhor... melhor...' },
        { quem: 'silencio', texto: 'ELE FALA SEM PARAR PARA NÃO OUVIR O QUE IMPORTA.' },
        { quem: 'berdly', texto: 'Ninguém veio, Kris. Eu preparei tudo. E ninguém veio.' },
        { quem: 'noelle', texto: 'Berdly... a gente está aqui agora.' },
        { quem: 'berdly', texto: 'Cuidado. Aqui tudo volta. O que você me mandar, o eco devolve. Física básica!' },
        { escolha: { chave: 'eco', opcoes: [{ valor: 'palmas', texto: 'Bater palmas, uma vez' }, { valor: 'quieto', texto: 'Ficar em silêncio' }] } },
        { quem: 'narrador', texto: 'Uma palma. O ginásio devolve dez. Depois, cem.', se: { eco: 'palmas' } },
        { quem: 'berdly', texto: '...Isso. Era exatamente isso que eu queria ouvir.', se: { eco: 'palmas' } },
        { quem: 'narrador', texto: 'Kris fica quieto. O silêncio volta, mais pesado.', se: { eco: 'quieto' } },
        { quem: 'silencio', texto: 'VIU? NEM ELE SE IMPORTA.', se: { eco: 'quieto' } },
        { quem: 'berdly', texto: 'Não. Ele está aqui. Para mim, isso já é uma ovação.', se: { eco: 'quieto' } },
      ],
      depois: [
        { quem: 'narrador', texto: 'Os holofotes param de girar. Um deles fica só em Berdly.' },
        { quem: 'berdly', texto: 'Sabe o que eu nunca disse no discurso? Que eu tinha medo de ninguém aparecer.' },
        { quem: 'berdly', texto: 'Você apareceu. Vocês três. Vale mais que qualquer troféu. Anotem: eu disse isso!' },
        { quem: 'ralsei', texto: 'Três luzes, Kris! Lá fora, na rua... tem alguém sentada no ponto de ônibus.' },
      ],
      derrota: [
        { quem: 'silencio', texto: 'O ECO SEMPRE FALA POR ÚLTIMO.' },
        { quem: 'berdly', texto: 'Hah! Hoje não. Revanche, Kris! Eu calculei as chances: são ótimas!' },
      ],
      luta: {
        inicio: [{ quem: 'silencio', texto: 'APLAUSOS... PARA NINGUÉM.' }],
        ferido: [{ quem: 'berdly', texto: 'Ahá! Minha mente está voltando! Toda ela!' }],
        quase: [{ quem: 'berdly', texto: 'Mais um golpe, Kris! Pela ciência!' }],
        voceMal: [{ quem: 'noelle', texto: 'Kris! Cuidado com os holofotes!' }],
        perfeito: [{ quem: 'berdly', texto: 'Uma esquiva digna de prêmio!' }],
      },
    },
    rua: {
      cenario: 'rua',
      tema: 'Você chega sem forças: começa com zero de energia. Os faróis cortam a rua.',
      antes: [
        { quem: 'narrador', texto: 'A rua de casa não termina. Os postes só acendem quando Kris passa.' },
        { quem: 'narrador', texto: 'As pernas pesam. É o cansaço de quem andou a noite toda.' },
        { quem: 'narrador', texto: 'No ponto de ônibus, Susie. Sentada. Os olhos acesos de um jeito errado.' },
        { quem: 'susie', texto: 'Ah. Chegou o fã-clube.' },
        { quem: 'susie', texto: 'Fiquei te esperando aqui a noite toda. Pro festival. Você disse que vinha.' },
        { quem: 'kris', texto: '...' },
        { quem: 'silencio', texto: 'ELA QUERIA DIZER QUE VOCÊ É O MELHOR AMIGO DELA. NUNCA VAI DIZER.' },
        { quem: 'susie', texto: 'CALA A BOCA! ...Não você, Kris. Ele.' },
        { quem: 'berdly', texto: 'Susie, você está sendo controlada! É científico!' },
        { quem: 'susie', texto: 'Eu SEI, Berdly! Eu só... não consigo parar.' },
        { quem: 'susie', texto: 'Então vem. Sem energia, sem nada. Do zero. Do jeito que a gente sempre fez.' },
      ],
      depois: [
        { quem: 'narrador', texto: 'Um farol de ônibus corta a névoa. A sombra solta Susie com um chiado.' },
        { quem: 'susie', texto: 'Ugh. Minha cabeça.' },
        { quem: 'susie', texto: '...Ei. Valeu por não ter desistido de mim. Não conta pra ninguém que eu disse isso.' },
        { quem: 'berdly', texto: 'Eu ouvi tudo!' },
        { quem: 'susie', texto: 'Berdly.' },
        { quem: 'berdly', texto: 'Não ouvi nada. Nadinha.' },
        { quem: 'susie', texto: 'Bora. Ainda falta gente. E eu quero socar essa sombra pessoalmente.' },
      ],
      derrota: [
        { quem: 'silencio', texto: 'CANSADO? DEITE. DURMA. ESQUEÇA.' },
        { quem: 'susie', texto: 'Ei! Nem pensa em dormir! Levanta, Kris. Eu espero.' },
      ],
      luta: {
        inicio: [{ quem: 'susie', texto: 'Desculpa adiantado! Vai doer!' }],
        ferido: [{ quem: 'susie', texto: 'Isso! Bate mais! ...Em mim. Isso é estranho.' }],
        quase: [{ quem: 'silencio', texto: 'ELA NÃO PRECISA DE VOCÊ!' }],
        voceMal: [{ quem: 'ralsei', texto: 'Kris, deixa a energia juntar!' }],
        perfeito: [{ quem: 'susie', texto: 'Heh. Exibido.' }],
      },
    },
    chuva: {
      cenario: 'chuva',
      tema: 'Chove dentro de casa. Todo ataque na sua caixa cai do teto.',
      antes: [
        { quem: 'narrador', texto: 'Na sala de estar, chove. A água cai do teto e não molha nada.' },
        { quem: 'narrador', texto: 'No sofá, Dess toca um violão que não faz som.' },
        { quem: 'dess', texto: 'Oi, Kris. Trouxe a turma toda, hein? Chegaram no fim do show.' },
        { quem: 'dess', texto: 'Eu ia tocar uma última música no festival. Ele levou o som. Ficou só a chuva.' },
        { quem: 'silencio', texto: 'ALGUMAS MÚSICAS NÃO DEVEM SER TOCADAS. ALGUMAS PESSOAS NÃO VOLTAM.' },
        { quem: 'dess', texto: 'Ele fica repetindo isso. Sobre o quarto lá em cima. Sobre quem foi embora.' },
        { quem: 'noelle', texto: 'Dess... de quem ele está falando?' },
        { quem: 'dess', texto: 'Pergunta pro Kris. O Kris sabe.' },
        { quem: 'narrador', texto: 'Kris olha para a escada. Lá no alto, uma porta. Encostada.' },
        { quem: 'dess', texto: 'Olha pro alto. Aqui tudo vem de cima: a chuva, as lembranças. Vem me tirar daqui.' },
      ],
      depois: [
        { quem: 'narrador', texto: 'A chuva para. As gotas ficam suspensas no ar. Depois, sobem.' },
        { quem: 'narrador', texto: 'E, pela primeira vez desde aquela noite, um acorde. Baixinho.' },
        { quem: 'dess', texto: 'Ouviu isso? Voltou. Vou guardar o refrão pra quando tudo acabar.' },
        { quem: 'dess', texto: 'Kris. O quarto lá de cima é do seu irmão, né? O Silêncio nasceu ali.' },
        { quem: 'susie', texto: 'Então a gente sobe. Todo mundo junto.' },
      ],
      derrota: [
        { quem: 'silencio', texto: 'A CHUVA NÃO PARA. NUNCA PARA.' },
        { quem: 'dess', texto: 'Para sim. Toda chuva para. Tenta de novo, Kris.' },
      ],
      luta: {
        inicio: [{ quem: 'dess', texto: 'Atenção! Vem tudo de cima!' }],
        ferido: [{ quem: 'dess', texto: 'O som está voltando... continua!' }],
        quase: [{ quem: 'silencio', texto: 'NÃO! A MÚSICA ACABOU!' }],
        voceMal: [{ quem: 'susie', texto: 'Ei! Olha pra cima, Kris!' }],
        perfeito: [{ quem: 'dess', texto: 'Nem uma gota. Estilo!' }],
      },
    },
    quarto: {
      cenario: 'quarto',
      tema: 'Tudo chega duas vezes. Na metade, a porta se abre. No fim, ele se desespera.',
      antes: [
        { quem: 'narrador', texto: 'No fim da escada, a porta do quarto. Uma luz fina passa por baixo.' },
        { quem: 'narrador', texto: 'Kris conhece este quarto. Era do irmão. Ninguém dorme nele desde que ele foi embora.' },
        { quem: 'asriel', texto: 'Oi, Kris.' },
        { quem: 'silencio', texto: '...OI, KRIS.' },
        { quem: 'narrador', texto: 'A voz sai duas vezes. Uma é de Asriel. A outra é da sombra, grudada nas costas dele.' },
        { quem: 'narrador', texto: 'A sombra engole Asriel e cresce. Bate no teto. Atravessa o teto.' },
        { quem: 'narrador', texto: 'O quarto vira um céu escuro. E, no céu, dois olhos do tamanho de janelas.' },
        { quem: 'silencio', texto: 'EU SOU UM TITÃ. FEITO DE TUDO O QUE NINGUÉM TEVE CORAGEM DE DIZER.' },
        { quem: 'asriel', texto: 'Eu fui embora tão depressa naquela manhã. A gente tinha brigado. Ninguém pediu desculpa.' },
        { quem: 'asriel', texto: 'Você guardou o bilhete. Eu escrevi correndo. Só dizia: volto logo.', se: { bilhete: 'guardar' } },
        { quem: 'asriel', texto: 'Você deixou o bilhete na mesa. Tudo bem. Eu também deixei tanta coisa sem dizer.', se: { bilhete: 'deixar' } },
        { quem: 'silencio', texto: 'EU SOU TUDO O QUE VOCÊS NÃO DISSERAM. CADA DESCULPA. CADA SAUDADE.' },
        { quem: 'silencio', texto: 'E VOCÊ, KRIS, É QUEM MAIS ME ALIMENTA. VOCÊ NUNCA DIZ NADA.' },
        { quem: 'silencio', texto: '...NÃO. NÃO É O KRIS QUE ESCOLHE AS CARTAS, É?' },
        { quem: 'silencio', texto: 'É VOCÊ. DO OUTRO LADO DA TELA. EU ESTOU VENDO A SUA MÃO.' },
        { quem: 'silencio', texto: 'CADA CARTA QUE VOCÊ NÃO JOGAR, EU JOGO EM VOCÊ.' },
        { quem: 'susie', texto: 'Ei, sombra feia! O Kris não está sozinho!' },
        { quem: 'ralsei', texto: 'A gente acendeu cinco luzes até aqui, Kris. Falta só uma.' },
        { quem: 'asriel', texto: 'Se você ficar quieto, a casa fica assim para sempre. Por favor... me tira daqui.' },
        { quem: 'kris', texto: '...' },
        { quem: 'narrador', texto: 'Kris fecha o punho. E dá um passo para dentro.' },
      ],
      depois: [
        { quem: 'narrador', texto: 'A sombra se desfaz em mil mariposas. Asriel cai de joelhos: inteiro, colorido, ofegante.' },
        { quem: 'asriel', texto: 'Kris... você veio. Mesmo depois de tudo.' },
        { quem: 'narrador', texto: 'Kris abre a boca. Fecha. Todo mundo espera.' },
        { quem: 'kris', texto: 'Volta pra casa.' },
        { quem: 'narrador', texto: 'Três palavras. A casa inteira estremece. As luzes da cidade acendem, uma rua de cada vez.' },
        { quem: 'asriel', texto: '...Eu volto. Eu prometo. E dessa vez eu deixo a luz acesa.' },
        { quem: 'narrador', texto: 'Lá embaixo, o telefone toca. É a primeira coisa que a cidade diz em muito tempo.' },
        { quem: 'susie', texto: 'Atende logo, seu lerdo. A gente espera.' },
        { quem: 'narrador', texto: 'Kris desce a escada correndo. E deixa a luz acesa.' },
      ],
      derrota: [
        { quem: 'silencio', texto: 'QUIETO. COMO SEMPRE.' },
        { quem: 'asriel', texto: 'Kris... não. Não para agora. Por favor.' },
      ],
      luta: {
        inicio: [{ quem: 'silencio', texto: 'VOCÊ NÃO TEM NADA A DIZER. NUNCA TEVE.' }],
        ferido: [{ quem: 'asriel', texto: 'Kris... continua... ele está soltando!' }],
        quase: [{ quem: 'asriel', texto: 'Agora, Kris! Não para!' }],
        voceMal: [{ quem: 'ralsei', texto: 'Kris! A gente está aqui! Levanta!' }],
        perfeito: [{ quem: 'susie', texto: 'ISSO! Mostra pra ele!' }],
      },
    },
  },
  // quando o chefe se refaz no meio da luta (regra `virada`): a faixa de cima e os gritos dos amigos
  virada: 'A PORTA SE ABRIU POR INTEIRO. Seus amigos gritam o seu nome!',
  viradaFalas: [
    { quem: 'ralsei', texto: 'KRIS! A gente está com você!' },
    { quem: 'noelle', texto: 'Não desiste!' },
    { quem: 'berdly', texto: 'Calculei: você vai vencer!' },
    { quem: 'susie', texto: 'ACABA COM ELE!' },
    { quem: 'dess', texto: 'Toca alto, Kris!' },
  ],
  // o TITÃ (regra `titan`): o nome na tela, a apresentação e o que ele diz ao arremessar as SUAS cartas
  // (fala com quem joga, não com a Kris: quebra a quarta parede)
  titan: {
    nome: 'O TITÃ DO SILÊNCIO',
    apresentacao: 'O TITÃ DO SILÊNCIO',
    arremesso: [
      { quem: 'silencio', texto: 'SUAS CARTAS? AGORA SÃO MINHAS.' },
      { quem: 'silencio', texto: 'ESSAS VOCÊ NEM QUIS JOGAR, NÉ?' },
      { quem: 'silencio', texto: 'EU CONHEÇO A SUA MÃO MELHOR QUE VOCÊ.' },
      { quem: 'silencio', texto: 'QUANTO MAIS VOCÊ GUARDA, MAIS EU TENHO.' },
      { quem: 'silencio', texto: 'NÃO OLHE PARA O KRIS. OLHE PARA MIM.' },
      { quem: 'silencio', texto: 'JOGADOR. VOCÊ AINDA ESTÁ AÍ?' },
    ],
    passou: { quem: 'silencio', texto: 'PASSOU A VEZ? ENTÃO TOMA A MÃO INTEIRA.' },
  },
  // quando o chefe, quase vencido, entra em fúria (regra `furia`)
  furia: 'O SILÊNCIO ESTÁ DESESPERADO: ele ataca com tudo o que tem!',
  furiaFala: { quem: 'silencio', texto: 'EU NÃO VOU VOLTAR PARA O ESCURO SOZINHO!' },
}
