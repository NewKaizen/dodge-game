import { sairSala } from '../lib/lan/rede.js'

// A "pausa" das partidas online (docs/rede-pvp.md "Aba em segundo plano e pausa online"): o C (Esc /
// Start) abre o menu da cena Pausa no modo online POR CIMA da partida, que continua para todos. As
// arenas em rede (PvpArena, CoopArena, PvpArenaN, CoopArenaN) e a campanha/desafio diário chamam isto.
//   abrirPausaOnline(cena, { subtitulo, sair })   sair: quem sai da partida (padrão: sairSala, que
//                                                 leva ao lobby/menu como o "Sair da sala" de cima)
export function abrirPausaOnline(cena, { subtitulo = '', sair = () => sairSala() } = {}) {
  const s = cena.scene
  if (cena.saindo || s.isActive('Pausa') || s.isPaused('Pausa')) return false
  s.launch('Pausa', { online: true, cena: s.key, subtitulo, sair })
  s.bringToTop('Pausa') // a Pausa vem antes das arenas na lista de cenas
  return true
}
