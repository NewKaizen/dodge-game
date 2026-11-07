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
//     furia              o chefe, depois da virada e com 30% do HP, ataca mais forte e mais longo
//     titan              o chefe é um TITÃ: as cartas que você não jogou são arremessadas em você antes do ataque dele
//   pressao              0..0.5: somado à força do que vem na SUA caixa (a escada fica mais funda)
//   assinatura           o golpe do oponente: o ataque que a CPU manda na SUA caixa usa estes modelos
//                        (campanha/ataques.js), um por rodada em rodízio; um item pode ser um combo ['garras', 'chuva'] · assinaturaVirada: depois da virada
//   chefe                true na fase do chefe (a última)
export const MUNDO1 = {
  id: 1,
  chave: 'casa',
  nome: 'A Casa Silenciosa',
  personagem: 'kris',
  cor: 0x5fb8b0,
  fases: [
    { n: 1, id: 'sala', nome: 'A Sala de Aula', oponente: 'ralsei', nivel: 'facil', fatorHpCpu: 0.7, metaRodadas: 8, pressao: 0.1, regra: { soNaipe: 'espadas' }, assinatura: ['redemoinho', 'garras'] },
    { n: 2, id: 'corredor', nome: 'O Corredor que Fecha', oponente: 'noelle', nivel: 'facil', fatorHpCpu: 0.75, metaRodadas: 8, pressao: 0.15, regra: { caixaEncolhe: 0.1 }, assinatura: ['estilhacos', 'garras', 'sementes'] },
    { n: 3, id: 'ginasio', nome: 'O Ginásio Vazio', oponente: 'berdly', nivel: 'facil', fatorHpCpu: 0.8, metaRodadas: 8, pressao: 0.2, regra: { eco: true }, assinatura: ['feixes', ['sementes', 'garras']] },
    { n: 4, id: 'rua', nome: 'A Rua de Volta', oponente: 'susie', nivel: 'facil', fatorHpCpu: 0.8, metaRodadas: 9, pressao: 0.25, regra: { energiaInicial: 0 }, assinatura: ['mandibula', 'feixes', ['galhos', 'garras']] },
    { n: 5, id: 'chuva', nome: 'A Sala Onde Chove', oponente: 'dess', nivel: 'facil', fatorHpCpu: 0.85, metaRodadas: 9, pressao: 0.3, regra: { soDeCima: true }, assinatura: ['chuva', ['chuva', 'sementes'], 'garras'] },
    { n: 6, id: 'quarto', nome: 'O Último Quarto', oponente: 'asriel', nivel: 'facil', fatorHpCpu: 1, metaRodadas: 12, pressao: 0.3, regra: { duplo: true, virada: true, furia: true, titan: true }, assinatura: ['mandibula', 'feixes', 'garras', 'estilhacos'], assinaturaVirada: [['mandibula', 'garras'], ['feixes', 'estilhacos']], chefe: true },
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
