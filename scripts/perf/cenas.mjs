// As cenas que as ferramentas de desempenho (medir.mjs, paridade.mjs) abrem. Cada uma:
//   inicio   código rodado na página depois do Menu (`s` = a cena ativa; pode usar await)
//   piloto   'arena' = a partida anda sozinha (piloto.mjs); 'escolha' = fica na escolha de cartas
//   espera   a fase da arena em que a medida começa (window.pvpArena/coopArena .fase)
//   grupo    'menu' | 'pvp' | 'coop' | 'telas' (as metas do plano são por grupo)
// A ordem aqui é a das tabelas.
const SEMENTE = 'perf'

const arena = (a) => ({
  grupo: 'pvp',
  nome: `PvP ${a.toUpperCase()}, esquiva`,
  inicio: `s.scene.start('PvpArena', { p1: 'kris', p2: 'susie', arena: '${a}', tempo: 2500, semente: '${SEMENTE}' })`,
  piloto: 'arena',
  espera: 'esquiva',
})
const coop = (chefe, nome) => ({
  grupo: 'coop',
  nome: `CO-OP ${nome}, esquiva`,
  inicio: `s.scene.start('CoopArena', { chefe: '${chefe}', nivel: 'dificil', party: ['kris', 'susie'], tempo: 2500, semente: '${SEMENTE}' })`,
  piloto: 'arena',
  espera: 'esquiva',
})

export const CENAS = {
  menu: { grupo: 'menu', nome: 'Menu', inicio: null },
  'pvp-castelo': arena('castelo'),
  'pvp-cafe': { ...arena('cafe'), nome: 'PvP CAFÉ, esquiva' },
  'pvp-cidade': arena('cidade'),
  'pvp-praia': arena('praia'),
  'pvp-chinatown': arena('chinatown'),
  'pvp-estacao': { ...arena('estacao'), nome: 'PvP ESTAÇÃO, esquiva' },
  'pvp-palco': arena('palco'),
  // a escolha de cartas (mãos levantadas), sem relógio: ninguém confirma
  'pvp-escolha': {
    grupo: 'telas',
    nome: 'PvP CASTELO, escolha de cartas',
    inicio: `s.scene.start('PvpArena', { p1: 'kris', p2: 'susie', arena: 'castelo', tempo: 0, semente: '${SEMENTE}' })`,
    piloto: 'escolha',
    espera: 'escolha',
  },
  'coop-king': coop('king', 'King'),
  'coop-queen': coop('queen', 'Queen'),
  'coop-jevil': coop('jevil', 'Jevil'),
  'coop-coronel': coop('coronel', 'Coronel'),
  'coop-escuridao': coop('escuridao', 'ESCURIDÃO (semanal)'),
  expedicao: {
    grupo: 'coop',
    nome: 'Expedição (Jevil, fase 1), esquiva',
    inicio: `const m = await import('/src/game/coop/expedicao.js'); const exp = m.criarExpedicao({ chefe: 'jevil', nivel: 'dificil', party: ['kris', 'susie'], semente: '${SEMENTE}' }); s.scene.start('CoopArena', { ...m.dadosDaLuta(exp), tempo: 2500 })`,
    piloto: 'arena',
    espera: 'esquiva',
  },
  'galeria-estilos': { grupo: 'telas', nome: 'Galeria: estilos de carta', inicio: `s.scene.start('GaleriaCosmeticos', { tipo: 'frente' })` },
  'galeria-efeitos': { grupo: 'telas', nome: 'Galeria: efeitos de carta', inicio: `s.scene.start('GaleriaCosmeticos', { tipo: 'efeito' })` },
  'campanha-mapa': { grupo: 'telas', nome: 'Campanha: mapa', inicio: `s.scene.start('Campanha', { mundo: 1 })` },
  'campanha-luta': { grupo: 'telas', nome: 'Campanha: luta', inicio: `s.scene.start('CampanhaArena', { mundo: 1, fase: 1 })`, piloto: 'arena' },
}

// o modo rápido: uma cena de cada tipo
export const RAPIDO = ['menu', 'pvp-castelo', 'pvp-cafe', 'coop-king', 'galeria-estilos', 'campanha-mapa']

export function escolherCenas(lista) {
  if (!lista || lista === 'todas' || lista === 'all') return Object.keys(CENAS)
  if (lista === 'rapido') return RAPIDO
  const ids = []
  for (const parte of lista.split(',').map((x) => x.trim()).filter(Boolean)) {
    // prefixo: "pvp" = todas as pvp-*, "coop" = todas as coop-*
    const achadas = CENAS[parte] ? [parte] : Object.keys(CENAS).filter((id) => id.startsWith(parte) || CENAS[id].grupo === parte)
    if (!achadas.length) throw new Error(`cena desconhecida: ${parte} (cenas: ${Object.keys(CENAS).join(', ')})`)
    for (const id of achadas) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}
