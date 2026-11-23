// CENAS CARREGADAS SOB DEMANDA (fase 3.6 do plano de otimização, docs/desempenho.md).
//
// Os modos que nem todo jogador abre (campanha, manual do Ralsei, LAN/online, galeria de cosméticos...) não
// entram no pacote principal: cada um é um import() dinâmico, baixado e avaliado só na primeira vez que alguém
// abre a cena. O pacote do boot fica menor (menos para baixar, compilar e avaliar antes do Menu).
//
//   instalarCenasPreguicosas(game, { cenas, ordem })
//       cenas  { Chave: () => import('./scenes/Chave.js'), ... }  (o default do módulo é a classe da cena)
//       ordem  a lista de TODAS as chaves na ordem do config: a cena carregada entra no mesmo lugar da lista de
//              cenas do Phaser em que estaria (a ordem é a ordem de desenho: as de cima ficam por cima)
//
// Quem abre a cena não muda nada: scene.start/launch/run/switch com a chave de sempre. Se a cena ainda não chegou,
// o pedido espera o import (com o quadro CARREGANDO… por cima quando a tela de antes já saiu) e é refeito igualzinho
// quando ela chega. Enquanto isso window.__cenasCarregando > 0 (a paridade espera, scripts/perf/deterministico.mjs).
// Cada cena carregada avisa game.events 'cenanova' (a resolução e a BATATA ligam os ganchos nela).
export function instalarCenasPreguicosas(game, { cenas, ordem }) {
  const mgr = game.scene
  const pendentes = new Map() // chave -> Promise
  globalThis.__cenasCarregando = 0

  const carregada = (chave) => Boolean(mgr.keys?.[chave])
  const reordenar = () => {
    const pos = new Map(ordem.map((k, i) => [k, i]))
    const lista = mgr.scenes
    const fora = lista.filter((s) => !pos.has(s.sys.settings.key))
    const dentro = lista.filter((s) => pos.has(s.sys.settings.key)).sort((a, b) => pos.get(a.sys.settings.key) - pos.get(b.sys.settings.key))
    lista.length = 0
    lista.push(...dentro, ...fora)
  }

  function carregar(chave) {
    if (!pendentes.has(chave)) {
      globalThis.__cenasCarregando++
      const p = cenas[chave]()
        .then((m) => {
          if (!carregada(chave)) {
            const cena = mgr.add(chave, m.default, false)
            reordenar()
            game.events.emit('cenanova', cena ?? mgr.getScene(chave))
          }
        })
        .finally(() => globalThis.__cenasCarregando--)
      pendentes.set(chave, p)
    }
    return pendentes.get(chave)
  }

  // o quadro CARREGANDO… enquanto o import não chega (só se nada mais estiver na tela)
  const cobrir = (chave) => {
    if (!carregada('Carregando') || mgr.isActive('Carregando')) return false
    const ativas = mgr.getScenes(true).filter((s) => s.sys.settings.key !== chave)
    if (ativas.length) return false
    mgr.start('Carregando', { destino: chave })
    return true
  }

  // start/run/switch esperam a cena chegar e são refeitos; o resto (get, isActive...) responde "não existe" até lá
  const embrulhar = (nome, chaveDe) => {
    const original = mgr[nome].bind(mgr)
    mgr[nome] = (...args) => {
      const chave = chaveDe(args)
      if (typeof chave !== 'string' || !cenas[chave] || carregada(chave)) return original(...args)
      // a cena de antes (switch) dorme já, como no switch de sempre; a nova entra quando chegar
      if (nome === 'switch') mgr.sleep(args[0])
      carregar(chave)
        .then(() => {
          const cobriu = cobrir(chave)
          if (nome === 'switch') original(args[0], args[1], args[2])
          else original(...args)
          if (cobriu || mgr.isActive('Carregando')) {
            mgr.bringToTop('Carregando')
            game.events.emit('carregando-aberto')
          }
        })
        .catch((erro) => console.error(`[cenas] não deu para carregar ${chave}`, erro))
      cobrir(chave) // (no start do ScenePlugin a cena de antes já parou: a fila faz o stop antes)
      return mgr
    }
  }
  embrulhar('start', (a) => a[0])
  embrulhar('run', (a) => a[0])
  embrulhar('switch', (a) => a[1])

  // (ferramentas: a paridade visual carrega tudo antes de congelar o relógio, scripts/perf/deterministico.mjs: a
  // cena nasce no mesmo quadro que nasceria sem a espera do import)
  globalThis.__carregarTodasAsCenas = () => Promise.all(Object.keys(cenas).map(carregar))
  return { carregar, carregada }
}
