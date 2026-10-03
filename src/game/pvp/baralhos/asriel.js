// Asriel: equilibrado, com mais figuras que os outros (6; eram 12 antes do
// balanceamento de 2026-10-02). Estrelas, espadas do caos, galáxias.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, metade, lerp } from '../padroes.js'

export default {
  tema: { formas: ['losango', 'copas', 'bola'], cores: { losango: 0xfff07a, copas: 0xff8ad8, bola: 0x9ad8ff, barra: 0xffffff }, cor: 0xfff07a },
  hp: 95,
  principal: { espadas: 'chuva', ouros: 'carrossel', paus: 'bombas' },
  leve: (A) => A.rain({ duracao: 4000, intervalo: 520, velocidade: 105, mirar: 0.3 }),
  receitas: {
    buster: r('Lâmina do caos vai e volta, depois chuva de estrelas', (A, t) =>
      A.sequencia(P.foice(A, t, { duracao: metade(t), varridas: 2, aviso: 600, avisoVolta: 450 }), P.chuva(A, t, { duracao: metade(t) }))),
    goner: r('Espiral de estrelas com chuva', (A, t) => A.juntos(P.espiral(A, t, { esparso: 1.5 }), P.chuva(A, t, { esparso: 2.6, caixa: null }))),
    shocker: r('Raios verticais numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'vertical', quantidade: 1 }))),
    tempo: r('Espiral que inverte com rajadas miradas numa caixa apertada', (A, t) =>
      apertar(A, t * 0.6, A.juntos(P.espiral(A, t * 0.6, { esparso: 1.5, caixa: null }), P.mira(A, t, { esparso: 2.6, caixa: null, rajada: 2 })))),
    final: r('Estrelas miradas, cruz giratória e colapso que explode', (A, t) => apertar(A, t * 0.3, P.caosFinal(A, t, { esparso: 1.2 }))),
    meteoros: r('Bombas com chuva de estrelas', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.3 }), P.chuva(A, t, { esparso: 2, caixa: null }))),
    raio: r('Lasers em cruz', (A, t) => P.lasers(A, t, { orientacao: 'cruz', intervalo: lerp(1500, 1250, t) })),
    supernova: r('Bombas e projéteis que se dividem', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.3 }), P.divisores(A, t, { esparso: 1.5 }))),
  },
  // a 3ª fase é o Caos Final encurtado (o colapso ainda explode: fica com 50% do tempo)
  super: {
    nome: 'Singularidade Radiante',
    texto: 'Um buraco negro que puxa o seu coração enquanto estrelas descem em espiral, depois implode numa supernova que empurra para fora com anéis arco-íris',
    criar: (A) => A.superAsriel()
  },
  cartas: [
    ['espadas', 1, 'Hiper Espelho'],
    ['espadas', 4, 'Star Blazing', 'chuva'],
    ['espadas', 8, 'Chaos Saber', 'foice'],
    ['espadas', 11, 'Chaos Buster', 'buster'],
    ['espadas', 13, 'Hyper Goner', 'goner'],
    ['ouros', 1, 'Apagar'],
    ['ouros', 3, 'Shocker Breaker', 'shocker'],
    ['ouros', 7, 'Galáxia', 'carrossel'],
    ['ouros', 12, 'Tempo Parado', 'tempo', { inverter: 1500 }],
    ['ouros', 13, 'Caos Final', 'final', { inverter: 2000 }],
    ['paus', 1, 'Pegar Alma'],
    ['paus', 4, 'Estrela Cadente', 'bombas'],
    ['paus', 8, 'Chuva de Meteoros', 'meteoros'],
    ['paus', 10, 'Raio Caótico', 'raio'],
    ['paus', 13, 'Supernova', 'supernova'],
    ['copas', 1, 'Salvar'],
    ['copas', 5, 'Lembrança', ['cura']],
    ['copas', 8, 'Amizade', ['escudo', 'energia']],
    ['copas', 10, 'Esperança', ['cura', 'compra']],
    ['copas', 12, 'Sonho', ['cura', 'escudo']],
  ],
}
