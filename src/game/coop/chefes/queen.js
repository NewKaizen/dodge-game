// Queen (MÉDIO). Formato: ver o comentário em coop/chefes/index.js.
//
// CO-OP 2.0: a regra SINAL DE WI-FI (coop/queenRegra.js, lógica em coop/queenWifi.js). Os corações têm de ficar
// perto um do outro, dentro do raio do sinal; sem sinal por mais que a carência, os dois levam um tique de
// dano até reconectar. Os ataques dela tentam SEPARAR a dupla (coop/chefes/queenAtaques.js):
//   fase 1  gotas de ácido (caem ENTRE vocês) e a ATUALIZAÇÃO OBRIGATÓRIA (um muro que divide o quadro)
//   fase 2  o raio ENCOLHE; INTERFERÊNCIA (empurra cada um para um lado), chuva de ácido e dois muros
//   fase 3  REBOOT: ela embaralha os corações e fecha um firewall entre vocês; reconectar enche a QUEBRA
//
// DIFICULDADE DO CO-OP (docs/coop-cartas.md "Dificuldade do CO-OP"): os ataques de assinatura dela entram junto: os
// POP-UPS (a janela abre, o X fecha e ela estoura), o CARREGANDO... (a barra de progresso na linha de um coração
// vira laser em 100%), o CURSOR (a setinha persegue e clica) e o SINAL NO COMPASSO (anéis de Wi-Fi que só
// machucam na batida). Ficar colado no parceiro (a regra) e fugir do cursor ao mesmo tempo é o aperto dela.
import { criarRegraWifi } from '../queenRegra.js'
import { gotas, muro } from './queenAtaques.js'

const DANO_BALA = 13 // era 11 (dificuldade do CO-OP: o acerto dói mais)

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
  // DIFÍCIL: os padrões dela ficam densos no difícil: o ritmo fica no do nível, com menos HP que o dos outros
  niveis: { medio: { dano: 2 }, dificil: { dano: 1.4 } },
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
  leve: (A) => A.juntos(A.ondas({ duracao: 4500, velocidade: 120, intervalo: 1200 }), A.queenPopup({ duracao: 4500, intervalo: 1700 })),
  fases: [
    {
      hp: 1,
      falas: ['Carregando... a sua derrota!', 'Fiquem pertinho um do outro... ou o sinal cai!', 'Clique aqui! Hahaha!'],
      cartas: [
        ['espadas', 4, 'Gotas de Ácido', (A) => A.juntos(gotas({ duracao: 6000, intervalo: 620, velocidade: 155, entre: 0.55 }), A.queenCursor({ duracao: 6000, clique: 1600 }))],
        ['paus', 5, 'Atualização Obrigatória', (A) => muroComGotas(A, { muros: 1, abertura: 88 }, { intervalo: 850, velocidade: 145, entre: 0.45, inicio: 800 })],
        ['ouros', 6, 'Laser do Roteador', (A) => A.juntos(A.lasers({ quantidade: 1, intervalo: 1150 }), A.queenCarregando({ intervalo: 1500, carga: 1150 }))],
        ['espadas', 5, 'Pop-ups', (A) => A.queenPopup({ duracao: 6500, intervalo: 800 })],
        ['copas', 4, 'Reiniciar', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.66,
      entrada: 'Atualizando para a versão 2.0! O sinal encolheu!',
      velocidadeFundo: 1.4,
      falas: ['Versão 2.0! Muito melhor!', 'Sem sinal? Que pena!', 'Dancem no compasso!'],
      cartas: [
        ['ouros', 8, 'Interferência', (A) => A.juntos(A.ondas({ direcao: 'baixo', duracao: 6500, velocidade: 130, intervalo: 1350, abertura: 80, amplitude: 70 }), A.queenCursor({ duracao: 6500, clique: 1500 }))],
        ['espadas', 9, 'Chuva de Ácido', (A) => A.juntos(gotas({ duracao: 6500, intervalo: 470, velocidade: 175, entre: 0.6 }), A.queenPopup({ duracao: 6500, intervalo: 1400 }))],
        ['paus', 10, 'Atualização 2.0', (A) => muroComGotas(A, { muros: 2, abertura: 80, fica: 1900 }, { intervalo: 700, velocidade: 160, entre: 0.5, inicio: 700 })],
        ['espadas', 9, 'Carregando...', (A) => A.queenCarregando({ duracao: 7000, intervalo: 850, carga: 1000, cruz: 0.35 })],
        ['paus', 9, 'Sinal no Compasso', (A) => A.juntos(A.queenPulso({ duracao: 7000, emite: 1050, batida: 680 }), gotas({ duracao: 7000, intervalo: 1100, velocidade: 140, entre: 0.5 }))],
        ['copas', 9, 'Antivírus', null, { cura: 18, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.33,
      entrada: 'REBOOT! Agora eu embaralho tudo!',
      velocidadeFundo: 1.9,
      falas: ['REBOOT!', 'Eu não travo! Eu NÃO TRAVO!', 'Spam! Spam! SPAM!'],
      cartas: [
        ['ouros', 12, 'REBOOT', (A) => muroComGotas(A, { muros: 1, abertura: 84, primeiro: 900, fica: 2800, fixoX: 'centro' }, { intervalo: 560, velocidade: 170, entre: 0.55, inicio: 1500 })],
        ['espadas', 11, 'Interferência Total', (A) => A.juntos(A.ondas({ direcao: 'baixo', duracao: 7000, velocidade: 140, intervalo: 1250, abertura: 78, amplitude: 75 }), A.queenCursor({ duracao: 7000, clique: 1500, cursores: 2 }))],
        ['paus', 13, 'Atualização Crítica', (A) => A.juntos(muroComGotas(A, { muros: 2, abertura: 80, fica: 1900 }, { intervalo: 600, velocidade: 175, entre: 0.55, inicio: 700 }), A.queenCarregando({ intervalo: 1700, carga: 1050 }))],
        ['espadas', 12, 'Spam de Pop-ups', (A) => A.juntos(A.queenPopup({ duracao: 7000, intervalo: 600, pixels: 8 }), A.queenCursor({ duracao: 7000, clique: 1700 }))],
        ['ouros', 11, 'Sinal Total', (A) => A.juntos(A.queenPulso({ duracao: 7000, roteadores: 2, emite: 900, batida: 620 }), A.queenCarregando({ duracao: 7000, intervalo: 1600, carga: 1100 }))],
        ['copas', 10, 'Backup na Nuvem', null, { cura: 22, guarda: 0.5 }],
      ],
    },
  ],
  super: {
    nome: 'Tela Azul',
    texto: 'Lasers em cruz e ondas de dados no modo turbo, nas duas caixas',
    criar: (A) => A.sequencia(A.juntos(A.lasers({ orientacao: 'cruz', duracao: 3400, intervalo: 1050 }), A.queenPopup({ duracao: 3400, intervalo: 900 })), A.juntos(A.ondas({ duracao: 3800, velocidade: 200, intervalo: 700, amplitude: 50 }), A.queenPulso({ duracao: 3800, emite: 1000, batida: 600 }))),
  },
}
