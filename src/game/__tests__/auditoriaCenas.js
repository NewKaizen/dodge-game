// Varredura estática das cenas (sem Phaser): quais campos `this.X =` sobrevivem de uma
// abertura para a outra? O Phaser REAPROVEITA a instância da cena, então um campo que o
// create() não recria (objeto já destruído, flag, contador) quebra a abertura seguinte.
// Usada por cenasReaproveitadas.test.js.

// Um campo está "coberto" quando a abertura o refaz sozinha:
//  - atribuição incondicional no nível de cima do init()/create() (4 espaços de recuo);
//  - ou ele aparece no `estadoInicial = () => ({ ... })` da cena (Object.assign no começo).
export function varrerCena(fonte) {
  const metodoDe = (l) => l.match(/^  (?:async |static )?([a-zA-Z_]\w*)\s*\(.*\)\s*\{\s*$/)?.[1]
  const campos = new Map() // campo -> { topo, metodos }
  let metodo = null
  for (const l of fonte.split('\n')) {
    metodo = metodoDe(l) ?? metodo
    for (const m of l.matchAll(/this\.([a-zA-Z_]\w*)\s*=(?![=>])/g)) {
      const o = campos.get(m[1]) ?? { topo: false, metodos: new Set() }
      if (new RegExp(`^    this\\.${m[1]}\\s*=`).test(l) && (metodo === 'create' || metodo === 'init')) o.topo = true
      o.metodos.add(metodo)
      campos.set(m[1], o)
    }
  }
  return { campos, reset: chavesDoEstadoInicial(fonte), aplicaNoComeco: aplicaNoComeco(fonte) }
}

// chaves do objeto literal de `const estadoInicial = () => ({ ... })` (ou estadoInicialDaTela)
export function chavesDoEstadoInicial(fonte) {
  const ini = fonte.search(/export const estadoInicial\w*\s*=\s*\(\)\s*=>\s*\(\{|const estadoInicial\w*\s*=\s*\(\)\s*=>\s*\(\{/)
  if (ini < 0) return new Set()
  const fim = fonte.indexOf('\n})', ini)
  const corpo = fonte.slice(ini, fim)
  return new Set([...corpo.matchAll(/^  ([a-zA-Z_]\w*):/gm)].map((m) => m[1]))
}

// o Object.assign(this, estadoInicial...) é a 1ª instrução do init() (ou do create(), sem init)?
// (o create do PvpResultado monta os dados da abertura antes, e o teste dele cobre isso)
export function aplicaNoComeco(fonte) {
  const comInit = /\n  init\(/.test(fonte)
  const re = comInit ? /\n  init\([^)]*\) \{\n    Object\.assign\(this, estadoInicial/ : /\n  create\([^)]*\) \{\n    Object\.assign\(this, estadoInicial/
  return re.test(fonte) || /Object\.assign\(this, estadoInicial/.test(fonte)
}

// ouvintes: cada `.on(` em eventos da cena/registry precisa de um `.off(` (a instância é reaproveitada)
export function ouvintesSemRemocao(fonte) {
  const ons = [...fonte.matchAll(/(?:this\.events|this\.registry\.events|this\.game\.events|this\.input(?:\.keyboard)?)\.on\(\s*'([^']+)'/g)].map((m) => m[1])
  const offs = [...fonte.matchAll(/\.off\(\s*'([^']+)'/g)].map((m) => m[1])
  return ons.filter((e) => !offs.includes(e))
}
