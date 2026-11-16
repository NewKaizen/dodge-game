// Queen (MÉDIO). Formato: ver o comentário em coop/chefes/index.js.
//
// CO-OP 2.0: a regra SINAL DE WI-FI (coop/queenRegra.js, lógica em coop/queenWifi.js). Os corações têm de ficar
// perto um do outro, dentro do raio do sinal; sem sinal por mais que a carência, os dois levam um tique de
// dano até reconectar. Os ataques dela tentam SEPARAR a dupla (coop/chefes/queenAtaques.js):
//   fase 1  gotas de ácido (caem ENTRE vocês) e a ATUALIZAÇÃO OBRIGATÓRIA (um muro que divide o quadro)
//   fase 2  o raio ENCOLHE; INTERFERÊNCIA (empurra cada um para um lado), chuva de ácido e dois muros
//   fase 3  REBOOT: ela embaralha os corações e fecha um firewall entre vocês; reconectar enche a QUEBRA
import { criarRegraWifi } from '../queenRegra.js'
import { gotas, muro } from './queenAtaques.js'

const DANO_BALA = 11

// os efeitos da regra em cada carta (pelo nome): empurrões da INTERFERÊNCIA e o REBOOT
export const EFEITOS_QUEEN = {
  Interferência: { empurrar: { forca: 55, quantidade: 2, duracaoJanela: 1100 } },
  'Interferência Total': { empurrar: { forca: 75, quantidade: 3, duracaoJanela: 1100 } },
  REBOOT: { reboot: { teleporte: 1000 } },
}

// um muro e as gotas que acompanham (a mesma duração: o ataque acaba junto)
const muroComGotas = (A, opcoesMuro, opcoesGotas) => {
  const m = muro(opcoesMuro)
  return A.juntos(m, gotas({ ...opcoesGotas, duracao: m.ativa }))
}

export default {
  nome: 'Queen',
  dificuldade: 'medio',
  sprite: 'queen',
  fundo: 'queen',
  musica: 'queen',
  desafio: { velocidade: 1.12, densidade: 1.15 },
  textoInicial: 'Queen aparece num holograma gigante!',
  tema: {
    formas: ['hex'],
    cores: { hex: 0x40f0ff, barra: 0xff4fc8, bola: 0x40f0ff },
    cor: 0x40f0ff,
  },
  hp: 460, // CO-OP 2.0: era 270; a regra do sinal soma tiques e muros (~3,4 min no MÉDIO, simularCoop.mjs)
  danoBala: DANO_BALA,
  // DIFÍCIL: os padrões da Queen já ficam muito densos no difícil: ritmo um
  // pouco mais calmo que o dos outros e menos HP (fica entre o King e o Jevil)
  niveis: { dificil: { velocidade: 0.97, densidade: 0.95, hp: 0.85 } },
  regra: criarRegraWifi({
    id: 'wifi',
    nome: 'SINAL DE WI-FI',
    descricao: 'Fiquem pertinho: sem sinal entre os corações, os dois levam dano.',
    fases: {
      1: { descricao: 'O alcance do sinal encolheu: cheguem mais perto!' },
      2: { descricao: 'REBOOT: ela embaralha vocês; reconectem para encher a QUEBRA.' },
    },
    danoBala: DANO_BALA,
    efeitos: EFEITOS_QUEEN,
  }),
  leve: (A) => A.ondas({ duracao: 4000, velocidade: 110, intervalo: 1300 }),
  fases: [
    {
      hp: 1,
      falas: ['Carregando... a sua derrota!', 'Fiquem pertinho um do outro... ou o sinal cai!', 'Sintam o poder do Wi-Fi!'],
      cartas: [
        ['espadas', 4, 'Gotas de Ácido', () => gotas({ duracao: 5600, intervalo: 800, velocidade: 140, entre: 0.5 })],
        ['paus', 5, 'Atualização Obrigatória', (A) => muroComGotas(A, { muros: 1, abertura: 92 }, { intervalo: 1100, velocidade: 130, entre: 0.4, inicio: 900 })],
        ['ouros', 6, 'Laser do Roteador', (A) => A.lasers({ quantidade: 1, intervalo: 1300 })],
        ['copas', 4, 'Reiniciar', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.66,
      entrada: 'Atualizando para a versão 2.0! O sinal encolheu!',
      velocidadeFundo: 1.4,
      falas: ['Versão 2.0! Muito melhor!', 'Sem sinal? Que pena!', 'Dancem, dancem!'],
      cartas: [
        ['ouros', 8, 'Interferência', (A) => A.ondas({ direcao: 'baixo', duracao: 6200, velocidade: 120, intervalo: 1500, abertura: 84, amplitude: 70 })],
        ['espadas', 9, 'Chuva de Ácido', () => gotas({ duracao: 6000, intervalo: 560, velocidade: 165, entre: 0.55 })],
        ['paus', 10, 'Atualização 2.0', (A) => muroComGotas(A, { muros: 2, abertura: 84, fica: 1900 }, { intervalo: 900, velocidade: 150, entre: 0.5, inicio: 800 })],
        ['copas', 9, 'Antivírus', null, { cura: 18, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.33,
      entrada: 'REBOOT! Agora eu embaralho tudo!',
      velocidadeFundo: 1.9,
      falas: ['REBOOT!', 'Eu não travo! Eu NÃO TRAVO!', 'Reiniciando... separando vocês!'],
      cartas: [
        ['ouros', 12, 'REBOOT', (A) => muroComGotas(A, { muros: 1, abertura: 88, primeiro: 900, fica: 2800, fixoX: 'centro' }, { intervalo: 700, velocidade: 160, entre: 0.5, inicio: 1500 })],
        ['espadas', 11, 'Interferência Total', (A) => A.ondas({ direcao: 'baixo', duracao: 6600, velocidade: 135, intervalo: 1300, abertura: 80, amplitude: 75 })],
        ['paus', 13, 'Atualização Crítica', (A) => muroComGotas(A, { muros: 2, abertura: 80, fica: 1900 }, { intervalo: 700, velocidade: 170, entre: 0.55, inicio: 700 })],
        ['copas', 10, 'Backup na Nuvem', null, { cura: 22, guarda: 0.5 }],
      ],
    },
  ],
  super: {
    nome: 'Tela Azul',
    texto: 'Lasers em cruz e ondas de dados no modo turbo, nas duas caixas',
    criar: (A) => A.sequencia(A.lasers({ orientacao: 'cruz', duracao: 3200, intervalo: 1050 }), A.juntos(A.ondas({ duracao: 3600, velocidade: 200, intervalo: 700, amplitude: 50 }), A.quicantes({ duracao: 3600, intervalo: 1500, velocidade: 170 }))),
  },
}
