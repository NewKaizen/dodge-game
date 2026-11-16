// EXPEDIÇÃO · 2ª luta da Queen: O FIREWALL, o tenente (~3 minutos). Apresenta a regra SINAL DE WI-FI na versão
// LEVE (o tutorial disfarçado): o raio do sinal é bem GENEROSO, a carência é longa, o tique é fraquinho e só um
// muro divide o quadro por ataque (sem INTERFERÊNCIA nem REBOOT). Fica fora da seleção de chefes (`expedicao`).
//   scene.start('CoopArena', { chefe: 'queenTenente', nivel, party })
// Formato: ver coop/chefes/index.js.
import { criarRegraWifi } from '../queenRegra.js'
import { gotas, muro } from './queenAtaques.js'

const DANO_BALA = 12 // era 9

const muroComGotas = (A, opcoesMuro, opcoesGotas) => {
  const m = muro(opcoesMuro)
  return A.juntos(m, gotas({ ...opcoesGotas, duracao: m.ativa }))
}

export default {
  nome: 'O Firewall',
  expedicao: true,
  oculto: true,
  dificuldade: 'facil',
  sprite: 'queen-firewall',
  fundo: 'queen',
  musica: 'queen',
  textoInicial: 'O Firewall bloqueia o caminho!',
  tema: {
    formas: ['hex'],
    cores: { hex: 0xff8a1c, barra: 0xff4fc8, bola: 0xff8a1c },
    cor: 0xff8a1c,
  },
  hp: 420, // era 380: a 2ª luta da Expedição aperta mais que os lacaios
  desafio: { velocidade: 1.06, densidade: 1.12 },
  danoBala: DANO_BALA,
  niveis: { medio: { dano: 1.8 }, dificil: { dano: 1.35 } }, // (dificuldade do CO-OP: o tenente aperta mais que os lacaios)
  regra: criarRegraWifi({
    id: 'wifi',
    nome: 'SINAL DE WI-FI',
    descricao: 'Fiquem perto um do outro: sem sinal entre os corações, os dois levam dano.',
    fases: { 1: { descricao: 'O alcance do sinal diminuiu um pouco: fiquem perto!' } },
    danoBala: DANO_BALA,
    raios: [190, 170], // bem generoso (o quadro tem 336 de largura): só cai se um for para cada canto
    graca: 2200,
    intervalo: 1300,
    efeitos: {},
  }),
  leve: (A) => A.ondas({ duracao: 3800, velocidade: 100, intervalo: 1400 }),
  fases: [
    {
      hp: 1,
      falas: ['Acesso negado!', 'Eu bloqueio tudo que passa por aqui!', 'Fiquem juntinhos... eu vigio o sinal!'],
      cartas: [
        ['espadas', 5, 'Gotas de Ácido', (A) => A.juntos(gotas({ duracao: 6000, intervalo: 750, velocidade: 145, entre: 0.5 }), A.queenCursor({ duracao: 6000, clique: 1700 }))],
        ['paus', 6, 'Firewall', (A) => muroComGotas(A, { muros: 1, abertura: 104, fica: 2400 }, { intervalo: 1300, velocidade: 120, entre: 0.4, inicio: 900 })],
        ['ouros', 6, 'Laser do Roteador', (A) => A.juntos(A.lasers({ quantidade: 1, intervalo: 1300, duracao: 6000 }), A.queenCarregando({ duracao: 6000, intervalo: 1400, carga: 1100 }))],
        ['paus', 6, 'Porta Bloqueada', (A) => A.queenPulso({ duracao: 6500, emite: 1150, batida: 720 })],
        ['copas', 4, 'Reiniciar', null, { cura: 20 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Firewall reforçado! Ninguém passa!',
      falas: ['Reforçando as paredes!', 'Sem sinal, sem diversão!', 'Acesso negado, de novo!'],
      cartas: [
        ['espadas', 7, 'Chuva de Ácido', (A) => A.juntos(gotas({ duracao: 6500, intervalo: 600, velocidade: 160, entre: 0.55 }), A.queenPopup({ duracao: 6500, intervalo: 1300 }))],
        ['paus', 8, 'Firewall Reforçado', (A) => muroComGotas(A, { muros: 1, abertura: 96, fica: 2600 }, { intervalo: 1000, velocidade: 135, entre: 0.45, inicio: 800 })],
        ['ouros', 7, 'Pacote Rápido', (A) => A.juntos(A.ondas({ direcao: 'baixo', duracao: 6500, velocidade: 130, intervalo: 1300, abertura: 86, amplitude: 65 }), A.queenCursor({ duracao: 6500, clique: 1500 }))],
        ['espadas', 8, 'Firewall Carregando', (A) => A.juntos(muroComGotas(A, { muros: 1, abertura: 92, fica: 2400 }, { intervalo: 1100, velocidade: 140, entre: 0.45, inicio: 800 }), A.queenCarregando({ intervalo: 1500, carga: 1050 }))],
        ['copas', 6, 'Antivírus', null, { cura: 14, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Parede de Fogo',
    texto: 'Um firewall fecha o quadro e as gotas de ácido caem',
    criar: (A) => A.juntos(muroComGotas(A, { muros: 1, abertura: 96, fica: 2400 }, { intervalo: 750, velocidade: 150, entre: 0.5, inicio: 700 }), A.queenPulso({ emite: 1200, batida: 700 })),
  },
}
