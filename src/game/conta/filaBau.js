// A fila do aviso "VOCÊ GANHOU UM BAÚ!" (docs/baus.md). Puro: sem Phaser, testado em
// __tests__/filaBau.test.js. Quem desenha é a cena BauPopup e quem liga tudo é popupBau.js.
//
// O servidor avisa (bauGanho) a qualquer hora, inclusive no meio de uma partida. A regra:
//   - o aviso fica NA FILA enquanto qualquer cena que não seja de menu/resultado estiver na tela;
//   - ele aparece assim que só houver cenas liberadas (CENAS_DO_POPUP) por um instante (ESTAVEL_MS: o tempo
//     da tela de resultado se mostrar primeiro);
//   - ABRIR AGORA (abriu) gasta o aviso; DEPOIS (depois) também: o baú continua fechado na aba BAÚS e a
//     contagem (fechados) não se perde; um aviso novo mostra o pop-up de novo, com a contagem atual;
//   - se uma partida começar com o pop-up aberto, ele fecha sem gastar o aviso (interromper).
//
//   const fila = criarFilaBau()
//   fila.chegou({ fontes, fechados })     o bauGanho do servidor
//   fila.atualizar(agora, cenas)          o aviso para mostrar agora ({ fontes, fechados }) ou null
//   fila.abriu() · fila.depois() · fila.interromper() · fila.contar(n)
//   fila.fechados() · fila.pendente() · fila.mostrando()
export const ESTAVEL_MS = 700

// as cenas onde o pop-up pode aparecer: menus e telas de resultado (nunca partida, escolha de partida,
// votação, pausa, carregando ou a Coleção, que tem a própria roleta)
export const CENAS_DO_POPUP = new Set([
  'Menu', 'Lan', 'Perfil', 'Amigos', 'Config', 'Grimorio', 'GuiaBonus', 'GuiaEntrada', 'GaleriaCosmeticos',
  'ManualRalsei', 'ManualRalsei2', 'ManualRalsei3', 'ManualRalsei4', 'ManualRalsei5', 'ManualRalsei6', 'ManualRalsei7', 'ManualRalsei8', 'ManualRalsei9',
  'PvpResultado', 'PvpResultadoN', 'Vitoria', 'GameOver', 'CampanhaFim', 'PartyFim', 'DesafioDiario', 'Campanha',
])

export const podeMostrarPopup = (cenas) => Array.isArray(cenas) && cenas.length > 0 && cenas.every((k) => CENAS_DO_POPUP.has(k))

export function criarFilaBau({ estavelMs = ESTAVEL_MS } = {}) {
  let pendente = null
  let total = 0
  let desde = null
  let mostrando = false

  const gastar = () => {
    pendente = null
    mostrando = false
    desde = null
  }

  return {
    chegou(aviso) {
      const fontes = Array.isArray(aviso?.fontes) ? aviso.fontes : []
      const fechados = Math.max(0, Math.floor(Number(aviso?.fechados) || 0))
      total = Math.max(total, fechados)
      pendente = { fontes: [...(pendente?.fontes ?? []), ...fontes], fechados: total }
    },
    atualizar(agora, cenas) {
      if (!pendente || mostrando) return null
      if (!podeMostrarPopup(cenas)) {
        desde = null
        return null
      }
      desde ??= agora
      if (agora - desde < estavelMs) return null
      mostrando = true
      return { fontes: [...pendente.fontes], fechados: total }
    },
    abriu: gastar,
    depois: gastar,
    interromper() {
      mostrando = false
      desde = null
    },
    // a contagem de baús fechados mudou (abriu um, ou o estado do servidor chegou)
    contar(n) {
      total = Math.max(0, Math.floor(Number(n) || 0))
    },
    fechados: () => total,
    pendente: () => pendente,
    mostrando: () => mostrando,
  }
}
