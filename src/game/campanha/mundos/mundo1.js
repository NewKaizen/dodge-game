// MUNDO 1 da campanha: "A Casa Silenciosa" (Kris). Só REGRAS e números: o servidor
// (server/campanha.js) lê daqui como cada fase funciona; os textos ficam em mundo1.textos.js.
// Como acrescentar um mundo: docs/campanha.md.
//
// Cada fase:
//   n, id, nome          ordem (1..), id dos textos (o progresso no banco usa o n, não o id)
//   oponente             a CPU (personagem do jogo, com o baralho de sempre)
//   nivel                nível da CPU (pvp/bot.js e botEsquiva.js)
//   fatorHpCpu           o HP da CPU = o do PvP × isto
//   metaRodadas          a 3ª estrela: vencer em até tantas rodadas
//   regra                a regra especial da fase (campanha/partida.js):
//     soNaipe            só cartas desse naipe podem ser jogadas (e passar a vez)
//     caixaEncolhe       a caixa perde esta fração da largura e da altura a cada rodada
//     eco                o ataque que você mandou na rodada passada volta na sua caixa
//     energiaInicial     a energia da 1ª rodada (a sua)
//     soDeCima           todo ataque na sua caixa vem de cima
//     duplo              o chefe manda dois ataques juntos
//     virada             o chefe, na metade do HP, se refaz (a porta se abre): cura e a caixa fica deitada
//   chefe                true na fase do chefe (a última)
export const MUNDO1 = {
  id: 1,
  chave: 'casa',
  nome: 'A Casa Silenciosa',
  personagem: 'kris',
  cor: 0x5fb8b0,
  fases: [
    { n: 1, id: 'sala', nome: 'A Sala de Aula', oponente: 'ralsei', nivel: 'facil', fatorHpCpu: 0.45, metaRodadas: 9, regra: { soNaipe: 'espadas' } },
    { n: 2, id: 'corredor', nome: 'O Corredor que Fecha', oponente: 'noelle', nivel: 'facil', fatorHpCpu: 0.5, metaRodadas: 7, regra: { caixaEncolhe: 0.1 } },
    { n: 3, id: 'ginasio', nome: 'O Ginásio Vazio', oponente: 'berdly', nivel: 'facil', fatorHpCpu: 0.55, metaRodadas: 8, regra: { eco: true } },
    { n: 4, id: 'rua', nome: 'A Rua de Volta', oponente: 'susie', nivel: 'facil', fatorHpCpu: 0.5, metaRodadas: 7, regra: { energiaInicial: 0 } },
    { n: 5, id: 'chuva', nome: 'A Sala Onde Chove', oponente: 'dess', nivel: 'facil', fatorHpCpu: 0.55, metaRodadas: 8, regra: { soDeCima: true } },
    { n: 6, id: 'quarto', nome: 'O Último Quarto', oponente: 'asriel', nivel: 'facil', fatorHpCpu: 0.6, metaRodadas: 12, regra: { duplo: true, virada: true }, chefe: true },
  ],
  // os cosméticos exclusivos deste mundo (o banco concede: 0011_campanha.sql; os nomes de agora: 0012)
  //   quando: 'mundo'  vencer o chefe pela primeira vez · 'estrelas'  3 estrelas em todas as fases
  //   (os ids são os da 0011 e não mudam: o inventário guarda o id)
  recompensas: [
    { id: 'titulo.andarilho_papel', tipo: 'titulo', nome: 'Quem Deixou a Luz Acesa', quando: 'mundo', descricao: 'Para quem atravessou a casa e não apagou a luz ao sair.' },
    { id: 'moldura.floresta_papel', tipo: 'moldura', nome: 'Vitral Silencioso', quando: 'mundo', cor: '#3fb3a8', descricao: 'Vidro azul-petróleo com a borda dourada, de uma janela que ninguém mais abre.' },
    { id: 'verso.folha_dobrada', tipo: 'verso', nome: 'Porta Entreaberta', quando: 'estrelas', cor: '#1c0f33', descricao: 'Um verso escuro com uma fresta de luz. Três estrelas em cada porta.' },
  ],
}
