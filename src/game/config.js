import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES } from './constants.js'
import { contextoAudio } from './audio.js'
import Boot from './scenes/Boot.js'
import Menu from './scenes/Menu.js'
import Pausa from './scenes/Pausa.js'
import Config from './scenes/Config.js'
import Entrada from './scenes/Entrada.js'
import BauPopup from './scenes/BauPopup.js'
import Carregando from './carregando.js'
import Religando from './religando.js'
// o conteúdo dos cosméticos dos slots novos (som de dano, efeito, lançamento, moldura animada)
import './cosmeticosRegistro.js'

// A ordem de TODAS as cenas (a de desenho: as de depois ficam por cima). As do boot entram no config; as outras
// são carregadas na primeira vez que alguém abre (cenasPreguicosas.js) e ocupam o mesmo lugar nesta lista.
export const ORDEM_DAS_CENAS = ['Boot', 'Menu', 'EscolhaParty', 'EscolhaPartyN', 'PvpEscolha', 'PvpVoto', 'PvpArena', 'PvpResultado', 'PvpEscolhaN', 'PvpArenaN', 'PvpResultadoN', 'PartyVoto', 'PartyFim', 'PartyIntro', 'ModoCoop', 'Selecao', 'Dificuldade', 'CoopArena', 'CoopArenaN', 'Expedicao', 'ExpedicaoFim', 'Vitoria', 'GameOver', 'Entrada', 'Pausa', 'Config', 'Grimorio', 'GuiaBonus', 'GuiaEntrada', 'ManualRalsei', 'ManualRalsei2', 'ManualRalsei3', 'ManualRalsei4', 'ManualRalsei5', 'ManualRalsei5Partida', 'ManualRalsei6', 'ManualRalsei7', 'ManualRalsei8', 'ManualRalsei9', 'Lan', 'Perfil', 'Amigos', 'Colecao', 'Campanha', 'CampanhaArena', 'CampanhaFim', 'DesafioDiario', 'GaleriaCosmeticos', 'Carregando', 'Religando', 'BauPopup']
const CENAS_DO_BOOT = [Boot, Menu, Entrada, Pausa, Config, Carregando, Religando, BauPopup]
// Tudo menos o Menu e o que fica por cima de qualquer cena (pausa, configurações, carregando, religando, baú):
// as partidas (PVP, CO-OP e as salas de 3 ou 4), a campanha, o manual do Ralsei, LAN/online, a galeria, os guias,
// perfil e coleção, party, Expedição (fase 3.6 do plano de otimização, docs/desempenho.md). A primeira abertura de
// cada uma mostra o CARREGANDO… enquanto o pedaço chega.
export const CENAS_SOB_DEMANDA = {
  PvpEscolha: () => import('./scenes/PvpEscolha.js'),
  PvpVoto: () => import('./scenes/PvpVoto.js'),
  PvpArena: () => import('./scenes/PvpArena.js'),
  PvpResultado: () => import('./scenes/PvpResultado.js'),
  ModoCoop: () => import('./scenes/ModoCoop.js'),
  Selecao: () => import('./scenes/Selecao.js'),
  Dificuldade: () => import('./scenes/Dificuldade.js'),
  CoopArena: () => import('./scenes/CoopArena.js'),
  Vitoria: () => import('./scenes/Vitoria.js'),
  GameOver: () => import('./scenes/GameOver.js'),
  Campanha: () => import('./scenes/Campanha.js'),
  CampanhaArena: () => import('./scenes/CampanhaArena.js'),
  CampanhaFim: () => import('./scenes/CampanhaFim.js'),
  ManualRalsei: () => import('./scenes/ManualRalsei.js'),
  ManualRalsei2: () => import('./scenes/ManualRalsei2.js'),
  ManualRalsei3: () => import('./scenes/ManualRalsei3.js'),
  ManualRalsei4: () => import('./scenes/ManualRalsei4.js'),
  ManualRalsei5: () => import('./scenes/ManualRalsei5.js'),
  ManualRalsei5Partida: () => import('./scenes/ManualRalsei5Partida.js'),
  ManualRalsei6: () => import('./scenes/ManualRalsei6.js'),
  ManualRalsei7: () => import('./scenes/ManualRalsei7.js'),
  ManualRalsei8: () => import('./scenes/ManualRalsei8.js'),
  ManualRalsei9: () => import('./scenes/ManualRalsei9.js'),
  Lan: () => import('./scenes/Lan.js'),
  GaleriaCosmeticos: () => import('./scenes/GaleriaCosmeticos.js'),
  DesafioDiario: () => import('./scenes/DesafioDiario.js'),
  Amigos: () => import('./scenes/Amigos.js'),
  GuiaBonus: () => import('./scenes/GuiaBonus.js'),
  GuiaEntrada: () => import('./scenes/GuiaEntrada.js'),
  Grimorio: () => import('./scenes/Grimorio.js'),
  Colecao: () => import('./scenes/Colecao.js'),
  Perfil: () => import('./scenes/Perfil.js'),
  EscolhaParty: () => import('./scenes/EscolhaParty.js'),
  EscolhaPartyN: () => import('./scenes/EscolhaPartyN.js'),
  PartyVoto: () => import('./scenes/PartyVoto.js'),
  PartyFim: () => import('./scenes/PartyFim.js'),
  PartyIntro: () => import('./scenes/PartyIntro.js'),
  PvpArenaN: () => import('./scenes/PvpArenaN.js'),
  CoopArenaN: () => import('./scenes/CoopArenaN.js'),
  PvpEscolhaN: () => import('./scenes/PvpEscolhaN.js'),
  PvpResultadoN: () => import('./scenes/PvpResultadoN.js'),
  Expedicao: () => import('./scenes/Expedicao.js'),
  ExpedicaoFim: () => import('./scenes/ExpedicaoFim.js'),
}

// (dev e testes) ?renderer=canvas|webgl força o renderer, para medir um contra o outro
// (docs/desempenho.md). Fora do dev só vale num build com VITE_FERRAMENTAS_PERF=1; no build
// normal a conta some e fica o AUTO de sempre.
function tipoDoRenderer() {
  if (!(import.meta.env?.DEV || import.meta.env?.VITE_FERRAMENTAS_PERF === '1')) return Phaser.AUTO
  const pedido = new URLSearchParams(globalThis.location?.search ?? '').get('renderer')
  if (pedido === 'canvas') return Phaser.CANVAS
  if (pedido === 'webgl') return Phaser.WEBGL
  return Phaser.AUTO
}

// tamanho: { largura, altura, zoomCss } de prepararResolucao() (resolucao.js)
export function criarConfig(parent, { largura = LARGURA, altura = ALTURA, zoomCss = 1 } = {}) {
  return {
    type: tipoDoRenderer(),
    parent,
    width: largura,
    height: altura,
    backgroundColor: CORES.fundo,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: zoomCss },
    // um contexto de áudio só para o jogo inteiro (a transmissão LAN copia o som dele)
    audio: { context: contextoAudio() ?? undefined },
    scene: CENAS_DO_BOOT,
  }
}
