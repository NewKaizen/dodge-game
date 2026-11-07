// MUNDO 1 da campanha: "A Casa Silenciosa" (Kris). Só REGRAS e números: o servidor
// (server/campanha.js) lê daqui como cada fase funciona; os textos ficam em mundo1.textos.js.
// Como acrescentar um mundo: docs/campanha.md.
//
// Cada fase:
//   n, id, nome          ordem (1..), id dos textos (o progresso no banco usa o n, não o id)
//   oponente             quem está preso ali (o personagem; os textos e o eco)
//   inimigo              o CHEFE da luta (campanha/chefes.js, no formato do CO-OP)
//   nivel                o nível da luta (NIVEIS: facil | medio | dificil)
//   aliado               a CPU aliada (a última pessoa libertada) ou null (sozinha)
//   metaRodadas          a 3ª estrela: vencer em até tantas rodadas
//   regra                a regra especial da fase (campanha/luta.js):
//     soNaipe            só cartas desse naipe no seu baralho
//     caixaEncolhe       o quadro perde esta fração da largura e da altura a cada rodada
//     eco                o ataque do chefe vem com o ataque leve dele junto (o ginásio ecoa)
//     energiaInicial     a sua energia na 1ª rodada
//     soDeCima           todo ataque do chefe vem de cima (as cartas dele: campanha/chefes.js)
//     titan              o chefe é um TITÃ: as cartas que você não jogou são arremessadas em você
//   chefe                true na fase do chefe (a última)
export const MUNDO1 = {
  id: 1,
  chave: 'casa',
  nome: 'A Casa Silenciosa',
  personagem: 'kris',
  cor: 0x5fb8b0,
  fases: [
    { n: 1, id: 'sala', nome: 'A Sala de Aula', oponente: 'ralsei', inimigo: 'c_ralsei', nivel: 'facil', aliado: null, metaRodadas: 9, regra: { soNaipe: 'espadas' } },
    { n: 2, id: 'corredor', nome: 'O Corredor que Fecha', oponente: 'noelle', inimigo: 'c_noelle', nivel: 'facil', aliado: 'ralsei', metaRodadas: 9, regra: { caixaEncolhe: 0.06 } },
    { n: 3, id: 'ginasio', nome: 'O Ginásio Vazio', oponente: 'berdly', inimigo: 'c_berdly', nivel: 'facil', aliado: 'noelle', metaRodadas: 9, regra: { eco: true } },
    { n: 4, id: 'rua', nome: 'A Rua de Volta', oponente: 'susie', inimigo: 'c_susie', nivel: 'facil', aliado: 'berdly', metaRodadas: 10, regra: { energiaInicial: 0 } },
    { n: 5, id: 'chuva', nome: 'A Sala Onde Chove', oponente: 'dess', inimigo: 'c_dess', nivel: 'facil', aliado: 'susie', metaRodadas: 10, regra: { soDeCima: true } },
    { n: 6, id: 'quarto', nome: 'O Último Quarto', oponente: 'asriel', inimigo: 'c_tita', nivel: 'medio', aliado: 'susie', metaRodadas: 14, regra: { titan: true }, chefe: true },
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
