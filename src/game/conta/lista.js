// Contas lógicas das telas de conta (Perfil, Amigos, Coleção): rolagem de
// listas, abas, grade, ordem e regras dos botões. Sem Phaser (testadas em
// __tests__/listaConta.test.js).

// onde a janela de `linhas` linhas começa para a seleção `sel` ficar à vista
// (no meio, quando dá, como a lista de salas da Lan)
export function janela(total, sel, linhas) {
  if (total <= linhas) return 0
  return Math.min(Math.max(0, sel - Math.floor(linhas / 2)), total - linhas)
}

// quantas linhas ficaram escondidas acima e abaixo da janela
export function escondidas(total, inicio, linhas) {
  return { acima: Math.max(0, inicio), abaixo: Math.max(0, total - (inicio + linhas)) }
}

// aba vizinha (dá a volta)
export const abaVizinha = (total, atual, passo) => (((atual + passo) % total) + total) % total

// Move o cursor numa grade de `colunas` colunas com `total` itens.
//   -> { indice, sair }   sair: 'cima' quando já estava na primeira linha (sobe para as abas)
export function moverNaGrade(indice, total, colunas, direcao) {
  if (total <= 0) return { indice: 0, sair: direcao === 'cima' ? 'cima' : null }
  const i = Math.min(Math.max(0, indice), total - 1)
  const linha = Math.floor(i / colunas)
  const col = i % colunas
  const ultimaLinha = Math.floor((total - 1) / colunas)
  if (direcao === 'esquerda') return { indice: col > 0 ? i - 1 : i, sair: null }
  if (direcao === 'direita') return { indice: col < colunas - 1 && i + 1 < total ? i + 1 : i, sair: null }
  if (direcao === 'cima') return linha === 0 ? { indice: i, sair: 'cima' } : { indice: i - colunas, sair: null }
  if (direcao === 'baixo') {
    if (linha >= ultimaLinha) return { indice: i, sair: null }
    return { indice: Math.min(i + colunas, total - 1), sair: null }
  }
  return { indice: i, sair: null }
}

// corta com reticências (sem medir fonte): para nomes em lugares apertados
export function abreviar(texto, max) {
  const letras = [...String(texto ?? '')]
  return letras.length <= max ? letras.join('') : `${letras.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`
}

// amigos online primeiro, depois por ordem alfabética
export function ordenarAmigos(amigos, status) {
  return [...amigos].sort((a, b) => Number(status(b.id) !== 'offline') - Number(status(a.id) !== 'offline') || a.nome.localeCompare(b.nome))
}

export const segundosRestantes = (ate, agora) => Math.max(0, Math.ceil((ate - agora) / 1000))

// Por que o CONVIDAR está apagado ('' = pode convidar). Os mesmos motivos do
// painel de antes (Amigos.svelte); o servidor confere de novo.
export function motivoSemConvite({ conectado, status, pendenteAte = 0, agora = 0, sala = null, souHost = false }) {
  if (!conectado) return 'sem conexão com o servidor'
  if (status === 'offline') return 'está offline'
  if (status === 'em_partida') return 'está numa partida'
  if (pendenteAte > agora) return 'convite enviado: espere a resposta'
  if (sala && !souHost) return 'só o host da sala convida'
  if (sala?.emPartida) return 'a sala está numa partida'
  if (sala && sala.membros.length >= sala.max) return 'a sala está cheia'
  return ''
}

// pedidos que chegaram desde a última leitura (ids novos), sem contar a primeira carga
export function novosIds(antes, agoraIds) {
  if (antes == null) return []
  return agoraIds.filter((id) => !antes.has(id))
}
