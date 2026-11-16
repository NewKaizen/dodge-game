// TABULEIRO REAL: as jogadas de cada carta do Chaos King e dos dois que vêm antes dele na Expedição (os
// lacaios e o Cavaleiro). Cada entrada é o `cfg` de kingOnda (kingAtaques.js) e, nas cartas de XEQUE e de
// ROQUE, o que a regra (kingRegra.js) liga por cima. Sem a regra (o baralho sozinho, a medição do bot) a
// carta joga só as peças.
//
// DIFICULDADE DO CO-OP (docs/coop-cartas.md "Dificuldade do CO-OP"): `extra` é o ataque de ASSINATURA que vem
// junto com as peças, ao mesmo tempo ((A) => ataque da biblioteca attacks/): as LINHAS DE XEQUE (kingXeque), a
// MURALHA DE PEÕES (kingMuralha) e a CAVALGADA (kingCavalgada). As cartas de XEQUE e de ROQUE ficam sem extra
// (a gaiola e a troca de lado já apertam; nada cai em quem está preso) e a muralha vem sem as peças do tabuleiro
// (o refúgio das peças não sabe da brecha da muralha).
import { kingOnda } from './kingAtaques.js'
import { TABULEIRO_MINI } from './kingTabuleiro.js'

const torre = { tipo: 'torre' }
const torreLinha = { tipo: 'torre', modo: 'linha' }
const torreColuna = { tipo: 'torre', modo: 'coluna' }
const bispo = { tipo: 'bispo' }
const cavalo = { tipo: 'cavalo' }
const peao = { tipo: 'peao' }
const peaoRainha = { tipo: 'peao', promove: true }
const MINI = { tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } }

export const ESPEC = {
  // ---------- o CHEFÃO ----------
  king: {
    // fase 1: peões e torres (a muralha marcha e as torres dão xeque em +)
    'Peões em Marcha': { cfg: { duracao: 7000, jogadas: [], aviso: 900 }, extra: (A) => A.kingMuralha({ duracao: 7000, fileiras: 4, passo: 780 }) },
    'Torre à Vista': { cfg: { duracao: 7000, jogadas: [[torreLinha], [torreColuna], [torre, peao]], aviso: 900, intervalo: 550 }, extra: (A) => A.kingXeque({ duracao: 7000, pecas: 'torre', intervalo: 1700, aviso: 850 }) },
    'Torres Gêmeas': { cfg: { duracao: 7000, jogadas: [[torreLinha, torreColuna]], aviso: 900, intervalo: 700 }, extra: (A) => A.kingXeque({ duracao: 7000, pecas: 'torre', intervalo: 1500, aviso: 800, eco: 0.35 }) },
    'Xeque!': { cfg: { duracao: 8000, jogadas: [[peao], [peao, peao]], aviso: 950, primeira: 2000, intervalo: 650 }, xeque: { aviso: 2800, peca: 'torre' } },
    // fase 2: bispos e cavalos entram (o xeque do bispo em x, os cavalos saltam onde o coração estava)
    'Bispos em V': { cfg: { duracao: 7000, jogadas: [[bispo], [bispo, torreLinha]], aviso: 900, intervalo: 600 }, extra: (A) => A.kingXeque({ duracao: 7000, pecas: 'bispo', intervalo: 1300, aviso: 780 }) },
    'Salto do Cavalo': { cfg: { duracao: 7000, jogadas: [[cavalo], [cavalo, peao], [cavalo, cavalo]], aviso: 850, intervalo: 600 }, extra: (A) => A.kingCavalgada({ duracao: 7000, intervalo: 1050, lascas: 4 }) },
    Cavalgada: { cfg: { duracao: 7500, jogadas: [[peao, peao]], aviso: 900, primeira: 1500, intervalo: 1500 }, extra: (A) => A.kingCavalgada({ duracao: 7500, intervalo: 720, lascas: 8, velocidadeLasca: 155 }) },
    'Corte Real': { cfg: { duracao: 8000, jogadas: [[torre, bispo], [cavalo, torre], [bispo, cavalo]], aviso: 850, intervalo: 650 }, extra: (A) => A.kingXeque({ duracao: 8000, pecas: 'alterna', intervalo: 1500, aviso: 800, eco: 0.5 }) },
    'Xeque Duplo': { cfg: { duracao: 8000, jogadas: [[bispo], [cavalo], [bispo, peao]], aviso: 900, primeira: 1800, intervalo: 650 }, xeque: { aviso: 2600, peca: 'torre' } },
    // fase 3: promoção e roque (a muralha promove em massa; o xeque da dama é a estrela de 8 pontas)
    Promoção: { cfg: { duracao: 8500, jogadas: [[peaoRainha, torre]], aviso: 850, primeira: 400, intervalo: 650 }, extra: (A) => A.kingXeque({ duracao: 8500, pecas: 'bispo', intervalo: 1600, aviso: 800 }) },
    // a muralha sozinha (as peças do tabuleiro não sabem da brecha: juntas, fechariam o refúgio)
    'Muralha Real': { cfg: { duracao: 8500, jogadas: [] }, extra: (A) => A.kingMuralha({ duracao: 8500, fileiras: 5, passo: 720, promove: 0.6, velocidadeTiro: 180 }) },
    Roque: { cfg: { duracao: 8000, jogadas: [[torre, bispo], [cavalo, peao], [bispo, bispo]], aviso: 850, primeira: 1600, intervalo: 600 }, roque: true },
    'Xeque da Rainha': { cfg: { duracao: 8500, jogadas: [[bispo], [cavalo, peao], [bispo, cavalo]], aviso: 900, primeira: 1800, intervalo: 650 }, xeque: { aviso: 2400, peca: 'rainha' } },
    'Tabuleiro Virado': { cfg: { duracao: 8500, jogadas: [[torreLinha, torreColuna, bispo], [cavalo, torre, bispo]], aviso: 850, primeira: 1600, intervalo: 700 }, roque: true },
    'Mate Iminente': { cfg: { duracao: 8500, jogadas: [[cavalo, peao], [torre]], aviso: 850, primeira: 900, intervalo: 900 }, extra: (A) => A.kingXeque({ duracao: 8500, pecas: 'dama', intervalo: 1350, aviso: 760, eco: 0.5, avisoEco: 480 }) },
    // o SUPER: todas as peças, uma jogada atrás da outra, com a dama em xeque e os cavalos saltando
    'Xeque-Mate': { cfg: { duracao: 9500, jogadas: [[torreLinha, torreColuna, bispo], [cavalo, bispo, torre], [peaoRainha, cavalo]], aviso: 850, primeira: 500, intervalo: 500 }, extra: (A) => A.juntos(A.kingXeque({ duracao: 9500, pecas: 'dama', intervalo: 1900, aviso: 800 }), A.kingCavalgada({ duracao: 9500, intervalo: 1500, lascas: 4 })) },
    // o ataque fraquinho que acompanha as cartas ♥ (agora com um xeque solto)
    leve: { cfg: { duracao: 4500, jogadas: [[peao]], aviso: 1000, primeira: 500, intervalo: 600 }, extra: (A) => A.kingXeque({ duracao: 4500, pecas: 'torre', intervalo: 2000, aviso: 900 }) },
  },

  // ---------- os LACAIOS (peões e a torre, sem regra; a muralha já marcha aqui) ----------
  kingLacaios: {
    'Peões Marchando': { cfg: { duracao: 6500, jogadas: [], aviso: 950 }, extra: (A) => A.kingMuralha({ duracao: 6500, fileiras: 3, passo: 860, promove: 0.25 }) },
    'Torre de Guarda': { cfg: { duracao: 6500, jogadas: [[torreLinha], [torreColuna]], aviso: 1000, intervalo: 650 }, extra: (A) => A.kingXeque({ duracao: 6500, pecas: 'torre', intervalo: 1900, aviso: 900 }) },
    'Formação Fechada': { cfg: { duracao: 6500, jogadas: [[torre, peao], [peao, peao]], aviso: 950, intervalo: 600 } },
    'Cerco Fechado': { cfg: { duracao: 6500, jogadas: [[torre, peao, peao]], aviso: 950, intervalo: 650 }, extra: (A) => A.kingXeque({ duracao: 6500, pecas: 'torre', intervalo: 1800, aviso: 900 }) },
    'Torre e Peões': { cfg: { duracao: 7000, jogadas: [[torreLinha, torreColuna], [torre, peao]], aviso: 950, intervalo: 650 }, extra: (A) => A.kingXeque({ duracao: 7000, pecas: 'torre', intervalo: 1600, aviso: 850 }) },
    'Avanço Geral': { cfg: { duracao: 7000, jogadas: [] }, extra: (A) => A.kingMuralha({ duracao: 7000, fileiras: 4, passo: 800, promove: 0.4 }) },
    leve: { cfg: { duracao: 3500, jogadas: [[peao]], aviso: 1100, primeira: 500, intervalo: 600 } },
    super: { cfg: { duracao: 7500, jogadas: [[torreLinha, torreColuna], [peao, peao, torre]], aviso: 900, primeira: 500, intervalo: 500 }, extra: (A) => A.kingXeque({ duracao: 7500, pecas: 'torre', intervalo: 1600, aviso: 850 }) },
  },

  // ---------- O CAVALEIRO (tenente: um tabuleiro 4 x 4 pequeno e só cavalos; os saltos caem onde vocês estavam) ----------
  kingTenente: {
    'Salto Curto': { cfg: { duracao: 6500, jogadas: [[cavalo]], aviso: 950, primeira: 700, intervalo: 600, ...MINI }, extra: (A) => A.kingCavalgada({ duracao: 6500, intervalo: 1300, lascas: 0, raio: 22 }) },
    'Dois Saltos': { cfg: { duracao: 7000, jogadas: [[cavalo], [cavalo, cavalo]], aviso: 900, primeira: 700, intervalo: 600, ...MINI }, extra: (A) => A.kingCavalgada({ duracao: 7000, intervalo: 1150, lascas: 4, raio: 22 }) },
    Galope: { cfg: { duracao: 7000, jogadas: [[cavalo, cavalo]], aviso: 850, primeira: 700, intervalo: 550, ...MINI }, extra: (A) => A.kingCavalgada({ duracao: 7000, intervalo: 1000, lascas: 4, raio: 22, velocidadeLasca: 140 }) },
    'Salto Duplo': { cfg: { duracao: 7500, jogadas: [[cavalo, cavalo], [cavalo]], aviso: 850, primeira: 700, intervalo: 500, ...MINI }, extra: (A) => A.kingCavalgada({ duracao: 7500, intervalo: 850, lascas: 8, raio: 22, velocidadeLasca: 140 }) },
    'Carga do Cavaleiro': { cfg: { duracao: 8000, jogadas: [[cavalo, cavalo]], aviso: 800, primeira: 700, intervalo: 420, ...MINI }, extra: (A) => A.kingCavalgada({ duracao: 8000, intervalo: 800, lascas: 8, raio: 22, velocidadeLasca: 150 }) },
    leve: { cfg: { duracao: 3500, jogadas: [[cavalo]], aviso: 1100, primeira: 700, intervalo: 600, ...MINI } },
    super: { cfg: { duracao: 8500, jogadas: [[cavalo, cavalo], [cavalo, cavalo]], aviso: 800, primeira: 700, intervalo: 420, ...MINI }, extra: (A) => A.kingCavalgada({ duracao: 8500, intervalo: 700, lascas: 8, raio: 22, velocidadeLasca: 150 }) },
  },
}

// O ataque inteiro de uma jogada: as peças (kingOnda) e, por cima, o `extra` (o ataque de assinatura da carta).
// A = attacks/ (sem ela, como nos testes do tabuleiro, só as peças). Com caixa própria (o Cavaleiro) os dois
// rodam na caixa dele
export function ataqueDaJogada(cfg, extra, A) {
  const pecas = kingOnda(cfg)
  if (!extra || !A) return pecas
  const juntos = A.juntos(pecas, extra(A))
  return cfg.caixa ? A.comCaixa(cfg.caixa, juntos) : juntos
}

// O ataque (sem a regra) de uma carta: o do cartaz do baralho
export const ataqueKing = (chefe, nome, A) => ataqueDaJogada({ ...ESPEC[chefe][nome].cfg }, ESPEC[chefe][nome].extra, A)
