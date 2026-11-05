// MUNDO 1 da campanha: "A Floresta de Papel" (Kris). Só REGRAS e números: o servidor
// (server/campanha.js) lê daqui como cada fase funciona; os textos ficam em mundo1.textos.js.
// Como acrescentar um mundo: docs/campanha.md.
//
// Cada fase:
//   n, id, nome          ordem (1..), id estável (nunca mude: o progresso no banco usa o n)
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
//     virada             o chefe, na metade do HP, vira a página: cura e a caixa fica deitada
//   chefe                true na fase do chefe (a última)
export const MUNDO1 = {
  id: 1,
  chave: 'floresta',
  nome: 'A Floresta de Papel',
  personagem: 'kris',
  cor: 0x7fc46b,
  fases: [
    { n: 1, id: 'clareira', nome: 'Clareira de Rascunho', oponente: 'ralsei', nivel: 'facil', fatorHpCpu: 0.45, metaRodadas: 9, regra: { soNaipe: 'espadas' } },
    { n: 2, id: 'trilha', nome: 'A Trilha que Encolhe', oponente: 'noelle', nivel: 'facil', fatorHpCpu: 0.5, metaRodadas: 7, regra: { caixaEncolhe: 0.1 } },
    { n: 3, id: 'lago', nome: 'O Lago do Eco', oponente: 'berdly', nivel: 'facil', fatorHpCpu: 0.55, metaRodadas: 8, regra: { eco: true } },
    { n: 4, id: 'bosque', nome: 'Bosque sem Tinta', oponente: 'susie', nivel: 'facil', fatorHpCpu: 0.5, metaRodadas: 7, regra: { energiaInicial: 0 } },
    { n: 5, id: 'recortes', nome: 'Chuva de Recortes', oponente: 'dess', nivel: 'facil', fatorHpCpu: 0.55, metaRodadas: 8, regra: { soDeCima: true } },
    { n: 6, id: 'desenhista', nome: 'O Desenhista', oponente: 'asriel', nivel: 'facil', fatorHpCpu: 0.6, metaRodadas: 12, regra: { duplo: true, virada: true }, chefe: true },
  ],
  // os cosméticos exclusivos deste mundo (o banco concede: 0011_campanha.sql)
  //   quando: 'mundo'  vencer o chefe pela primeira vez · 'estrelas'  3 estrelas em todas as fases
  recompensas: [
    { id: 'titulo.andarilho_papel', tipo: 'titulo', nome: 'Andarilho de Papel', quando: 'mundo' },
    { id: 'moldura.floresta_papel', tipo: 'moldura', nome: 'Floresta de Papel', quando: 'mundo', cor: '#7fc46b' },
    { id: 'verso.folha_dobrada', tipo: 'verso', nome: 'Folha Dobrada', quando: 'estrelas', cor: '#3c5a2e' },
  ],
}
