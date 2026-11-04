// Gancho de módulos do Node (module.register): `import Phaser from 'phaser'` vira o Phaser de mentira.
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'phaser') return { url: new URL('./phaserDeMentira.mjs', import.meta.url).href, shortCircuit: true }
  return proximo(especificador, contexto)
}
