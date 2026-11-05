// Os TEXTOS do Mundo 1, "A Floresta de Papel" (história original da campanha; os personagens são
// os do jogo). Separados das regras (mundo1.js) para editar à vontade: mudar uma fala aqui não
// muda nada na partida. Formato de cada cena (campanha/dialogo.js):
//   { quem: 'ralsei', texto: '...' }              fala com retrato e nome ('narrador': sem retrato)
//   { quem, texto, se: { lapis: 'verde' } }       só aparece se a escolha guardada bater
//   { escolha: { chave, opcoes: [{ valor, texto }] } }   duas opções (só sabor: nunca muda a partida)
// As escolhas ficam salvas na conta (o servidor guarda) e mudam falas mais adiante.
//
// Resumo: Kris acha um caderno de desenho esquecido nos achados e perdidos da escola. Ao abrir, a
// página vira uma floresta de papel dobrado, e um vento frio, o Vento da Borracha, vai apagando as
// trilhas. Os amigos que entraram antes estão "rabiscados": sem cor, presos à regra escrita na
// primeira página ("só quem desvia continua desenhado"). Cada duelo devolve a tinta de alguém. No
// fim, quem segura o lápis é o Asriel: foi ele quem começou o caderno, anos atrás, e queria terminar
// um desenho perfeito em que ninguém fosse embora.
export const TEXTOS_MUNDO1 = {
  titulo: 'A Floresta de Papel',
  resumo: 'Um caderno esquecido vira floresta, e o Vento da Borracha apaga as trilhas. Devolva a tinta aos amigos.',
  fases: {
    clareira: {
      antes: [
        { quem: 'narrador', texto: 'Nos achados e perdidos da escola, embaixo de um guarda-chuva quebrado, tem um caderno de desenho com a capa verde.' },
        { quem: 'narrador', texto: 'Kris abre na primeira página. O papel estala, cresce e dobra para cima. Árvores de papel. Um céu de folha pautada.' },
        { quem: 'ralsei', texto: 'Kris! Que bom! Eu me perdi aqui faz um tempinho... E olha só: eu estou todo em lápis de cor clarinho.' },
        { quem: 'ralsei', texto: 'Tem uma regra escrita na entrada: "só quem desvia continua desenhado". Acho que o caderno quer um duelo.' },
        { escolha: { chave: 'lapis', opcoes: [{ valor: 'vermelho', texto: 'Pegar o lápis vermelho do chão' }, { valor: 'verde', texto: 'Pegar o lápis verde do chão' }] } },
        { quem: 'ralsei', texto: 'Vermelho, como a sua alma! Combina com você.', se: { lapis: 'vermelho' } },
        { quem: 'ralsei', texto: 'Verde, igual ao meu chapéu! Fico até sem graça.', se: { lapis: 'verde' } },
        { quem: 'ralsei', texto: 'Aqui na clareira só valem as espadas (♠). Vamos com calma, eu prometo pegar leve!' },
      ],
      depois: [
        { quem: 'ralsei', texto: 'Olha! A cor voltou! Meu cachecol está verdinho de novo!' },
        { quem: 'ralsei', texto: 'Sinto um vento frio vindo da trilha... Ele apaga tudo por onde passa. Vamos achar os outros antes dele.' },
      ],
      derrota: [{ quem: 'ralsei', texto: 'Ops! Desculpa, Kris. De novo? Eu acredito em você.' }],
    },
    trilha: {
      antes: [
        { quem: 'narrador', texto: 'A trilha é uma tira de papel que se enrola sozinha. A cada passo ela fica um pouco mais estreita.' },
        { quem: 'noelle', texto: 'K-Kris? Eu entrei atrás de um passarinho de origami e agora a trilha não para de encolher...' },
        { quem: 'noelle', texto: 'Se a gente duelar e eu ficar desenhada de novo, talvez ela pare. Mas cuidado: a caixa vai apertar a cada rodada!' },
      ],
      depois: [
        { quem: 'noelle', texto: 'Ah! Minhas mãos têm cor de novo. E a trilha parou de se enrolar.' },
        { quem: 'noelle', texto: 'Eu vi o Berdly perto do lago. Ele estava discutindo com o próprio eco...' },
      ],
      derrota: [{ quem: 'noelle', texto: 'Desculpa! Eu não queria apertar tanto. Tenta de novo?' }],
    },
    lago: {
      antes: [
        { quem: 'narrador', texto: 'O lago é uma folha de papel vegetal. Tudo o que se diz perto dele volta, um pouco atrasado.' },
        { quem: 'berdly', texto: 'Kris! Eu descobri a regra deste lago. Ele DEVOLVE. Tudo. Até os ataques!' },
        { quem: 'berdly', texto: 'O que você me mandar numa rodada volta para você na seguinte. É genial. É irritante. É genialmente irritante.' },
        { escolha: { chave: 'eco', opcoes: [{ valor: 'responder', texto: 'Gritar "oi" para o lago' }, { valor: 'quieto', texto: 'Ficar em silêncio' }] } },
        { quem: 'berdly', texto: '"...oi." Viu? Ele respondeu. Pense bem no que você joga.', se: { eco: 'responder' } },
        { quem: 'berdly', texto: 'O silêncio também volta, sabia? Pense bem no que você joga.', se: { eco: 'quieto' } },
      ],
      depois: [
        { quem: 'berdly', texto: 'A minha cor! E o lago se calou. Admito: você foi quase tão estratégico quanto eu.' },
        { quem: 'berdly', texto: 'A Susie passou correndo para o bosque. Ela disse que ia "dar um soco no vento".' },
      ],
      derrota: [{ quem: 'berdly', texto: 'O eco venceu! Quer dizer... eu venci. Tecnicamente. Tente outra vez.' }],
    },
    bosque: {
      antes: [
        { quem: 'narrador', texto: 'No Bosque sem Tinta as árvores são só contorno. Até a energia parece ter sido apagada.' },
        { quem: 'susie', texto: 'Kris. Esse vento apagou meu lápis inteiro. Eu tô sem cor e sem paciência.' },
        { quem: 'susie', texto: 'Aqui a gente começa sem energia nenhuma. Zero. Então junta raspando nas balas e bate forte depois.' },
      ],
      depois: [
        { quem: 'susie', texto: 'Heh. Roxo de novo. Valeu, Kris.' },
        { quem: 'susie', texto: 'O vento veio do céu. Tá chovendo papel picado lá na frente. A Dess tá no meio, achando lindo.' },
      ],
      derrota: [{ quem: 'susie', texto: 'Levanta! A gente não vai deixar um vento ganhar, né?' }],
    },
    recortes: {
      antes: [
        { quem: 'narrador', texto: 'Do céu caem recortes: estrelas, luas, letras soltas. Tudo cai de cima, sem parar.' },
        { quem: 'dess', texto: 'Ei, Kris! Não é a coisa mais bonita? Tudo caindo, tudo picadinho. Parece confete de fim de show.' },
        { quem: 'dess', texto: 'Só que eu tô ficando transparente. Duela comigo? Aqui tudo vem de cima, então olha pro alto!' },
      ],
      depois: [
        { quem: 'dess', texto: 'Voltei! Vermelho-vivo. A chuva parou também, que pena. Era bonita.' },
        { quem: 'dess', texto: 'O vento sai da última página. Tem alguém lá, desenhando. Vai lá, que a gente segura as trilhas.' },
      ],
      derrota: [{ quem: 'dess', texto: 'Hah! Os recortes te pegaram. Bis! Bis!' }],
    },
    desenhista: {
      antes: [
        { quem: 'narrador', texto: 'Na última página há uma mesa de papel e alguém de costas, com um lápis enorme na mão.' },
        { quem: 'asriel', texto: 'Oi, Kris. Desculpa o vento. Ele é só a borracha... Eu estava tentando apagar os erros.' },
        { quem: 'asriel', texto: 'Comecei este caderno faz muito tempo. Queria um desenho perfeito, em que ninguém fosse embora. Todo mundo junto, para sempre.' },
        { quem: 'asriel', texto: 'Mas toda vez que alguém se mexia, saía da linha. Então eu apagava e começava de novo.' },
        { quem: 'asriel', texto: 'Você trouxe um lápis vermelho? ...Igual ao que eu usava.', se: { lapis: 'vermelho' } },
        { quem: 'asriel', texto: 'Você trouxe um lápis verde? ...Era a cor que eu nunca tinha coragem de usar.', se: { lapis: 'verde' } },
        { quem: 'asriel', texto: 'Se você desviar de tudo, eu deixo a página virar. Mas eu não vou pegar leve. Cada traço meu vem em dobro.' },
      ],
      depois: [
        { quem: 'asriel', texto: '...Você saiu da linha um monte de vezes. E o desenho ficou mais bonito assim.' },
        { quem: 'asriel', texto: 'Talvez um desenho bom seja um em que as pessoas podem se mexer.' },
        { quem: 'narrador', texto: 'A página vira sozinha. Atrás dela, todos os amigos, coloridos, esperando na clareira.' },
        { quem: 'ralsei', texto: 'Kris! Asriel! Vamos desenhar a próxima página juntos?' },
      ],
      derrota: [{ quem: 'asriel', texto: 'Viu? Saiu da linha. Eu apago... e você tenta de novo, tá?' }],
    },
  },
  // quando o Asriel vira a página no meio da luta (regra `virada`)
  virada: 'A PÁGINA VIROU! A caixa deitou e o Desenhista refez o próprio traço.',
}
