// TABULEIRO REAL: as jogadas de cada carta do Chaos King e dos dois que vêm antes dele na Expedição (os
// lacaios e o Cavaleiro). Cada entrada é o `cfg` de kingOnda (kingAtaques.js) e, nas cartas de XEQUE e de
// ROQUE, o que a regra (kingRegra.js) liga por cima. Sem a regra (o baralho sozinho, a medição do bot) a
// carta joga só as peças.
import { kingOnda } from './kingAtaques.js'
import { TABULEIRO_MINI } from './kingTabuleiro.js'

const torre = { tipo: 'torre' }
const torreLinha = { tipo: 'torre', modo: 'linha' }
const torreColuna = { tipo: 'torre', modo: 'coluna' }
const bispo = { tipo: 'bispo' }
const cavalo = { tipo: 'cavalo' }
const peao = { tipo: 'peao' }
const peaoRainha = { tipo: 'peao', promove: true }

export const ESPEC = {
  // ---------- o CHEFÃO ----------
  king: {
    // fase 1: peões e torres
    'Peões em Marcha': { cfg: { duracao: 6500, jogadas: [[peao, peao], [peao, peao]], aviso: 950, primeira: 500, intervalo: 500 } },
    'Torre à Vista': { cfg: { duracao: 7000, jogadas: [[torreLinha], [torreColuna], [torre, peao]], aviso: 1000, intervalo: 650 } },
    'Torres Gêmeas': { cfg: { duracao: 7000, jogadas: [[torreLinha, torreColuna]], aviso: 950, intervalo: 800 } },
    'Xeque!': { cfg: { duracao: 8000, jogadas: [[peao]], aviso: 1000, primeira: 2200, intervalo: 800 }, xeque: { aviso: 3000, peca: 'torre' } },
    // fase 2: bispos e cavalos entram
    'Bispos em V': { cfg: { duracao: 7000, jogadas: [[bispo], [bispo, torreLinha]], aviso: 950, intervalo: 650 } },
    'Salto do Cavalo': { cfg: { duracao: 7000, jogadas: [[cavalo], [cavalo, peao], [cavalo, cavalo]], aviso: 900, intervalo: 650 } },
    'Corte Real': { cfg: { duracao: 8000, jogadas: [[torre, bispo], [cavalo, torre], [bispo, cavalo]], aviso: 900, intervalo: 700 } },
    'Xeque Duplo': { cfg: { duracao: 8000, jogadas: [[bispo], [cavalo]], aviso: 950, primeira: 2000, intervalo: 800 }, xeque: { aviso: 2800, peca: 'torre' } },
    // fase 3: promoção e roque
    Promoção: { cfg: { duracao: 8500, jogadas: [[peaoRainha, torre]], aviso: 900, primeira: 400, intervalo: 600 } },
    Roque: { cfg: { duracao: 8000, jogadas: [[torre, bispo], [cavalo, peao]], aviso: 900, primeira: 1800, intervalo: 700 }, roque: true },
    'Xeque da Rainha': { cfg: { duracao: 8500, jogadas: [[bispo], [cavalo, peao]], aviso: 950, primeira: 2000, intervalo: 800 }, xeque: { aviso: 2600, peca: 'rainha' } },
    'Tabuleiro Virado': { cfg: { duracao: 8500, jogadas: [[torreLinha, torreColuna, bispo], [cavalo, torre, bispo]], aviso: 900, primeira: 1800, intervalo: 800 }, roque: true },
    // o SUPER: todas as peças, uma jogada atrás da outra
    'Xeque-Mate': { cfg: { duracao: 9500, jogadas: [[torreLinha, torreColuna, bispo], [cavalo, bispo, torre], [peaoRainha, cavalo]], aviso: 850, primeira: 500, intervalo: 450 } },
    // o ataque fraquinho que acompanha as cartas ♥
    leve: { cfg: { duracao: 4000, jogadas: [[peao]], aviso: 1100, primeira: 500, intervalo: 600 } },
  },

  // ---------- os LACAIOS (aquecimento: peões e a torre, sem regra) ----------
  kingLacaios: {
    'Peões Marchando': { cfg: { duracao: 6000, jogadas: [[peao], [peao, peao]], aviso: 1050, primeira: 500, intervalo: 600 } },
    'Torre de Guarda': { cfg: { duracao: 6000, jogadas: [[torreLinha], [torreColuna]], aviso: 1100, intervalo: 700 } },
    'Formação Fechada': { cfg: { duracao: 6500, jogadas: [[torre, peao], [peao, peao]], aviso: 1000, intervalo: 650 } },
    'Cerco Fechado': { cfg: { duracao: 6500, jogadas: [[torre, peao, peao]], aviso: 1000, intervalo: 700 } },
    'Torre e Peões': { cfg: { duracao: 7000, jogadas: [[torreLinha, torreColuna], [torre, peao]], aviso: 1000, intervalo: 700 } },
    'Avanço Geral': { cfg: { duracao: 7000, jogadas: [[peao, peao, torre]], aviso: 1000, intervalo: 800 } },
    leve: { cfg: { duracao: 3500, jogadas: [[peao]], aviso: 1200, primeira: 500, intervalo: 600 } },
    super: { cfg: { duracao: 7500, jogadas: [[torreLinha, torreColuna], [peao, peao, torre]], aviso: 950, primeira: 500, intervalo: 500 } },
  },

  // ---------- O CAVALEIRO (tenente: um tabuleiro 4 x 4 pequeno e só cavalos) ----------
  kingTenente: {
    'Salto Curto': { cfg: { duracao: 6500, jogadas: [[cavalo]], aviso: 1050, primeira: 700, intervalo: 600, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
    'Dois Saltos': { cfg: { duracao: 7000, jogadas: [[cavalo], [cavalo, cavalo]], aviso: 1000, primeira: 700, intervalo: 650, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
    'Galope': { cfg: { duracao: 7000, jogadas: [[cavalo, cavalo]], aviso: 900, primeira: 700, intervalo: 600, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
    'Salto Duplo': { cfg: { duracao: 7500, jogadas: [[cavalo, cavalo], [cavalo]], aviso: 900, primeira: 700, intervalo: 550, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
    'Carga do Cavaleiro': { cfg: { duracao: 8000, jogadas: [[cavalo, cavalo]], aviso: 850, primeira: 700, intervalo: 450, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
    leve: { cfg: { duracao: 3500, jogadas: [[cavalo]], aviso: 1200, primeira: 700, intervalo: 600, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
    super: { cfg: { duracao: 8500, jogadas: [[cavalo, cavalo], [cavalo, cavalo]], aviso: 850, primeira: 700, intervalo: 450, tabuleiro: TABULEIRO_MINI, caixa: { largura: 190, altura: 190 } } },
  },
}

// O ataque (sem a regra) de uma carta: o do cartaz do baralho
export const ataqueKing = (chefe, nome) => kingOnda({ ...ESPEC[chefe][nome].cfg })
