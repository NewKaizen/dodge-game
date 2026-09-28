// Ganchos de desenvolvimento (só em `npm run dev`), usados pelos testes
// automáticos e para ajustar ataques pelo console do navegador:
//
//   debugJogo.set({ invencivel: true, acelerar: 3 })
//   debugJogo.estado()          fase, HP, TP, inventário, menus, barras do FIGHT...
//   testarAtaque(ataques.foice({ varridas: 2 }))    (durante a batalha, no menu)
//   listarAtaques()
export const debug = { invencivel: false, acelerar: 1 }

export function registrarDebug(game) {
  if (!import.meta.env.DEV) return
  window.debugJogo = {
    set: (opcoes) => Object.assign(debug, opcoes),
    config: debug,
    cena: () => game.scene.getScenes(true).map((s) => s.scene.key),
    estado: () => {
      const batalha = game.scene.getScene('Battle')
      return batalha?.sys.isActive() ? batalha.estadoDebug() : null
    },
    // muda o HP de um membro da party (para testar itens)
    ferir: (nome, hp) => {
      const batalha = game.scene.getScene('Battle')
      const membro = batalha?.party.find((m) => m.nome === nome)
      if (!membro) return false
      membro.hp = hp
      batalha.atualizarUI()
      return true
    },
    // dados com que uma cena foi iniciada (ex.: modo da vitória)
    dadosCena: (chave) => game.scene.getScene(chave)?.sys.settings.data ?? null,
  }
}
