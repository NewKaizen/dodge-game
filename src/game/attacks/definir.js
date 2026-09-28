// Define um padrão de ataque configurável:
//
//   export default definirAtaque({
//     nome: 'rain',
//     padrao: { duracao: 5000, velocidade: 160 },  // valores padrão da config
//     iniciar(a, cfg) { ... },                      // a: ver attacks/contexto.js
//   })
//
// O resultado é uma função: rain({ velocidade: 300 }) devolve o ataque pronto.
export function definirAtaque({ nome, padrao = {}, iniciar }) {
  return (config = {}) => {
    const cfg = { duracao: 5000, ...padrao, ...config }
    return { nome, duracao: cfg.duracao, iniciar: (a) => iniciar(a, cfg) }
  }
}

// Vários ataques ao mesmo tempo
export function juntos(...lista) {
  return {
    nome: lista.map((at) => at.nome).join(' + '),
    duracao: Math.max(0, ...lista.map((at) => at.duracao)),
    iniciar: (a) => lista.forEach((at) => at.iniciar(a.limitar(at.duracao))),
  }
}

// Um ataque depois do outro
export function sequencia(...lista) {
  const inicios = []
  let total = 0
  for (const at of lista) {
    inicios.push(total)
    total += at.duracao
  }
  return {
    nome: lista.map((at) => at.nome).join(' > '),
    duracao: total,
    iniciar: (a) => lista.forEach((at, i) => a.depois(inicios[i], () => at.iniciar(a.limitar(at.duracao)))),
  }
}
