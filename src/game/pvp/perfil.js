// Perfil de um personagem no PvP, tirado só dos dados do baralho (cartas.js)
// e das regras (regras.js). Lógica pura, sem Phaser: usado pela escolha de
// personagem (PvpEscolha) e pela tela de resultado (PvpResultado).
//
//   perfilPvp('susie') -> {
//     hp,              HP no PvP (hpInicial de regras.js)
//     total,           cartas no baralho
//     naipes,          { espadas, copas, ouros, paus } quantas de cada
//     figuras,         quantas J/Q/K
//     fortes,          as 3 cartas mais fortes (sem os Ases), da mais forte
//     estilo,          { rotulo: 'AGRESSIVO', frase: 'muito ataque direto', cor }
//   }

import { CARTAS, NAIPES, danoDaCarta, nomeDoValor } from './cartas.js'
import { hpInicial } from './regras.js'

// Cor de cada naipe na interface (fundo escuro): copas e ouros na família do
// vermelho, espadas e paus na do roxo/azul, como nas cartas, só que claras
export const COR_NAIPE = { espadas: 0xb8a8ff, copas: 0xff5a78, ouros: 0xffa040, paus: 0x6fd8a0 }
// Cor clara de cada jogador para TEXTO (o vermelho da alma some no fundo escuro)
export const TEXTO_JOGADOR = ['#ff5a66', '#ffd23a']
export const TIPO_NAIPE = { espadas: 'ATAQUE', copas: 'SUPORTE', ouros: 'CONTROLE', paus: 'ARMADILHA' }

// Estilo pelo naipe que domina o baralho
const ESTILOS = {
  espadas: { rotulo: 'AGRESSIVO', frase: 'muito ataque direto', cor: 0xff6a5a },
  copas: { rotulo: 'SUPORTE', frase: 'cura, escudo e fôlego', cor: 0x6be08a },
  ouros: { rotulo: 'CONTROLE', frase: 'aperta e acelera', cor: 0xffb040 },
  paus: { rotulo: 'ARMADILHEIRO', frase: 'bombas e truques', cor: 0x6fd8a0 },
}
const PUXADO = { espadas: 'ataque', copas: 'suporte', ouros: 'controle', paus: 'armadilha' }

// Força de uma carta para ordenar as "mais fortes": valor, depois dano por
// bala, depois naipe (ataque na frente). Ases ficam de fora (são especiais).
const ORDEM_NAIPE = { espadas: 0, paus: 1, ouros: 2, copas: 3 }
const maisForte = (a, b) => b.valor - a.valor || danoDaCarta(b) - danoDaCarta(a) || ORDEM_NAIPE[a.naipe] - ORDEM_NAIPE[b.naipe]

// 'K', 'Q', '10'... (A para o Ás)
export const rotuloCarta = (carta) => nomeDoValor(carta.valor)

export function perfilPvp(personagem) {
  const cartas = CARTAS[personagem] ?? []
  const naipes = Object.fromEntries(NAIPES.map((n) => [n, cartas.filter((c) => c.naipe === n).length]))
  const figuras = cartas.filter((c) => c.valor >= 11).length
  const fortes = cartas.filter((c) => c.valor > 1).sort(maisForte).slice(0, 3)
  return { hp: hpInicial(personagem), total: cartas.length, naipes, figuras, fortes, estilo: estiloDe(naipes, figuras, cartas.length) }
}

// Naipe dominante -> estilo. Sem um naipe claramente na frente: equilibrado
// (ou "imprevisível" quando metade do baralho é figura).
function estiloDe(naipes, figuras, total) {
  const ordem = NAIPES.slice().sort((a, b) => naipes[b] - naipes[a] || ORDEM_NAIPE[a] - ORDEM_NAIPE[b])
  const [primeiro, segundo] = ordem
  const folga = naipes[primeiro] - naipes[segundo]
  if (folga >= 2) {
    const base = ESTILOS[primeiro]
    // um segundo naipe acima dos outros vira um "puxado para"
    const extra = naipes[segundo] > naipes[ordem[2]] ? ` + ${PUXADO[segundo]}` : ''
    return { ...base, frase: base.frase + extra }
  }
  if (total && figuras / total >= 0.5) return { rotulo: 'IMPREVISÍVEL', frase: 'cheio de figuras fortes', cor: 0xfff07a }
  if (folga === 1) return { rotulo: 'EQUILIBRADO', frase: `puxado para ${PUXADO[primeiro]}`, cor: 0x6dd0ff }
  return { rotulo: 'EQUILIBRADO', frase: 'um pouco de tudo', cor: 0x6dd0ff }
}
