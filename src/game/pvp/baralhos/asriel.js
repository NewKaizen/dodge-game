// Asriel: equilibrado, com mais figuras que os outros (6; eram 12 antes do
// balanceamento de 2026-10-02). Estrelas, espadas do caos, galáxias.
// 2026-10-07: as receitas mais difíceis ficaram mais espaçadas (medido com o
// bot de esquiva: o Asriel levava ~25% mais acertos por carta que a média dos
// outros; ver "Balanceamento medido com o bot" em docs/pvp-regras.md).
// 2026-10-17: Q♦ Tempo Parado e K♦ Caos Final não invertem mais os controles;
// Hyper Goner com menos losangos e mais fracos (fatorDano); os projéteis
// entram de fora da caixa e os sorteios variam a cada partida.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, lerp, duracaoDe } from '../padroes.js'

export default {
  tema: { formas: ['losango', 'copas', 'bola'], cores: { losango: 0xfff07a, copas: 0xff8ad8, bola: 0x9ad8ff, barra: 0xffffff }, cor: 0xfff07a },
  principal: { espadas: 'chuva', ouros: 'carrossel', paus: 'bombas' },
  leve: (A) => A.rain({ duracao: 4000, intervalo: 520, velocidade: 105, mirar: 0.3 }),
  receitas: {
    blazing: r('Estrelas grandes caem na diagonal, piscam e estouram em cinco estrelinhas, uma por ponta', (A, t) =>
      A.asrielStarBlazing({ duracao: duracaoDe(t), intervalo: lerp(820, 480, t), velocidade: lerp(95, 135, t), velocidadeFilhos: lerp(95, 135, t), mirar: 0.35 + 0.3 * t })),
    saber: r('A espada do caos corta num arco a metade da caixa onde você está, alternando os lados e soltando faíscas', (A, t) =>
      A.asrielChaosSaber({ duracao: duracaoDe(t), aviso: lerp(760, 620, t), golpe: lerp(430, 360, t), pausa: lerp(500, 300, t), duplo: t >= 0.75, faiscas: t >= 0.6 ? 3 : 2, velocidadeFaisca: lerp(80, 110, t) })),
    buster: r('Dois canhões seguem o coração, travam a mira e disparam rajadas de plasma; de vez em quando, um tiro carregado', (A, t) =>
      A.asrielChaosBuster({ duracao: duracaoDe(t), ciclo: lerp(1900, 1450, t), rajada: t >= 0.6 ? 4 : 3, velocidade: lerp(170, 220, t), aviso: lerp(520, 420, t), mira: lerp(480, 380, t), carregado: 3, feixe: lerp(380, 460, t) })),
    // 2026-10-17: menos losangos (no K: 2 a cada ~620 ms, eram 3 a cada 390), um pouco mais lentos, e cada um fere 60% do dano da carta
    goner: r('A caveira de bode abre a boca e suga losangos arco-íris que entram pelas bordas direto para ela', (A, t) =>
      A.asrielHyperGoner({ duracao: duracaoDe(t), intervalo: lerp(780, 620, t), porVez: t >= 0.7 ? 2 : 1, velocidade: lerp(50, 62, t), aceleracao: lerp(85, 115, t), mirar: 0.35 + 0.2 * t, fatorDano: 0.6 })),
    shocker: r('Relâmpagos caem em colunas, às vezes em corrente, e soltam faíscas pelo chão, numa caixa apertada', (A, t) =>
      apertar(A, t, A.asrielShockerBreaker({ duracao: duracaoDe(t), intervalo: lerp(1400, 950, t), quantidade: t >= 0.6 ? 2 : 1, aviso: lerp(650, 520, t), velocidadeFaisca: lerp(90, 125, t) }))),
    tempo: r('O tempo para: as estrelas congelam no ar, ponteiros cercam o coração e tudo dispara junto quando o relógio volta', (A, t) =>
      apertar(A, t * 0.6, A.asrielTempoParado({ duracao: duracaoDe(t), fluxo: lerp(1500, 1300, t), parada: lerp(1300, 1150, t), intervalo: lerp(500, 420, t), velocidade: lerp(95, 115, t), ponteiros: t >= 0.7 ? 5 : 4, velocidadePonteiro: lerp(150, 170, t) }))),
    // o Caos Final era o ataque mais difícil do jogo (quando ainda invertia os
    // controles o ataque todo): estrelas, tiros e colapso mais espaçados e um pouco mais lentos
    final: r('Estrelas miradas, cruz giratória e colapso que explode', (A, t) =>
      apertar(A, t * 0.3, A.caosFinal({
        duracao: duracaoDe(t),
        // 2026-10-17: sem as linhas/círculos de aviso, um pouco mais espaçado e com mais tempo para sair do anel
        estrelas: { intervalo: lerp(620, 500, t), velocidade: lerp(125, 145, t) },
        cruz: { giro: lerp(70, 90, t) / 100, inverte: lerp(2000, 1600, t), tiro: lerp(1700, 1400, t) },
        colapso: { tempoFechar: lerp(1550, 1450, t), fragmentos: 8, velocidade: lerp(100, 115, t) },
      }))),
    cadente: r('Estrelas cadentes riscam a caixa pela linha que pisca e deixam um rastro de poeira estelar parada', (A, t) =>
      A.asrielEstrelaCadente({ duracao: duracaoDe(t), intervalo: lerp(1300, 800, t), aviso: lerp(650, 520, t), velocidade: lerp(230, 280, t), vidaPoeira: lerp(1800, 2600, t), mirar: 0.45 + 0.3 * t })),
    meteoros: r('Meteoros caem nos pontos marcados, abrem crateras em brasa e soltam lascas de rocha', (A, t) =>
      A.asrielChuvaMeteoros({ duracao: duracaoDe(t), intervalo: lerp(1050, 650, t), queda: lerp(900, 700, t), lascas: t >= 0.6 ? 4 : 3, velocidadeLasca: lerp(110, 140, t), cratera: lerp(1400, 2200, t), mirar: 0.4 + 0.3 * t })),
    raio: r('Lasers em cruz', (A, t) => P.lasers(A, t, { orientacao: 'cruz', intervalo: lerp(1700, 1450, t) })),
    supernova: r('Estrelas incham, colapsam e explodem numa área, deixando nuvens de nebulosa à deriva', (A, t) =>
      A.asrielSupernova({ duracao: duracaoDe(t), intervalo: lerp(2200, 1600, t), crescer: lerp(1600, 1300, t), raioEstrela: lerp(14, 17, t), raioExplosao: lerp(46, 54, t), nebulosas: t >= 0.6 ? 6 : 5, velocidadeNebulosa: lerp(30, 45, t), vidaNebulosa: lerp(2000, 2600, t), mirar: 0.5 + 0.2 * t })),
  },
  // a 3ª fase é o Caos Final encurtado (o colapso ainda explode: fica com 50% do tempo)
  super: {
    nome: 'Singularidade Radiante',
    texto: 'Um buraco negro que puxa o seu coração enquanto estrelas descem em espiral, depois implode numa supernova que empurra para fora com anéis arco-íris',
    criar: (A) => A.superAsriel()
  },
  cartas: [
    ['espadas', 1, 'Hiper Espelho'],
    ['espadas', 4, 'Star Blazing', 'blazing'],
    ['espadas', 8, 'Chaos Saber', 'saber'],
    ['espadas', 11, 'Chaos Buster', 'buster'],
    ['espadas', 13, 'Hyper Goner', 'goner'],
    ['ouros', 1, 'Apagar'],
    ['ouros', 3, 'Shocker Breaker', 'shocker'],
    ['ouros', 7, 'Galáxia', 'carrossel'],
    ['ouros', 12, 'Tempo Parado', 'tempo'],
    ['ouros', 13, 'Caos Final', 'final'],
    ['paus', 1, 'Pegar Alma'],
    ['paus', 4, 'Estrela Cadente', 'cadente'],
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
