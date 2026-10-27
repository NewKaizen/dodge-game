// Fim da partida PVP EM REDE: o que cada lado quer fazer e quando os dois concordam
// (lógica pura, testável em Node; a cena é PvpResultado).
//
// Cada jogador escolhe uma opção e o outro vê na hora quem escolheu o quê:
//   REVANCHE            mesmos personagens e mesma arena, partida nova
//   TROCAR PERSONAGEM   volta à escolha de lutador (PvpEscolha) para os DOIS
//                       escolherem de novo, depois o voto da arena como sempre
// Só começa quando os dois escolheram. Se um quer REVANCHE e o outro TROCAR, vale
// TROCAR (quem pediu a troca precisa dela; o outro só escolhe de novo). Quem não
// responde em ESPERA_MS tem a espera cancelada (volta a poder escolher).
// Fora da rede (PVP no mesmo PC) não tem espera nenhuma: A revanche, B troca.
export const ESPERA_MS = 15000

export const ROTULO = {
  revanche: 'REVANCHE',
  trocar: 'TROCAR PERSONAGEM',
  lobby: 'VOLTAR AO LOBBY',
  fila: 'JOGAR NOVAMENTE',
  voltar: 'VOLTAR',
}

// opções da barra de baixo; vazio = PVP no mesmo PC (A: REVANCHE, B: TROCAR PERSONAGEM)
export const opcoesDoFim = ({ rede = false, casual = false } = {}) => {
  if (!rede) return []
  return casual ? ['revanche', 'trocar', 'fila', 'voltar'] : ['revanche', 'trocar', 'lobby']
}

// o que cada lado escolheu (só revanche/trocar entram no acordo)
export const novoAceite = () => ({ minha: null, outra: null, ate: null })

const vale = (e) => (e === 'revanche' || e === 'trocar' ? e : null)

// registra a escolha de um lado ('minha' | 'outra'); a espera começa na primeira
export function registrar(aceite, quem, escolha, agora) {
  const e = vale(escolha)
  if (!e || (quem !== 'minha' && quem !== 'outra')) return aceite
  return { ...aceite, [quem]: e, ate: aceite.ate ?? agora + ESPERA_MS }
}

// os dois escolheram? o que fazer: null (ainda não) | 'revanche' | 'trocar'
export function decidir({ minha, outra }) {
  if (!minha || !outra) return null
  return minha === 'trocar' || outra === 'trocar' ? 'trocar' : 'revanche'
}

export const expirou = ({ ate }, agora) => ate != null && agora >= ate

export const segundosRestantes = ({ ate }, agora) => (ate == null ? 0 : Math.max(0, Math.ceil((ate - agora) / 1000)))

// as duas linhas de status: quem escolheu o quê. Cada uma: { quem, texto, pronto }
export function linhasDoAceite(aceite, agora, nomeOutro = 'OPONENTE') {
  const resta = segundosRestantes(aceite, agora)
  const diz = (e) => (e ? ROTULO[e] : 'escolhendo…')
  const linhas = [
    { quem: 'VOCÊ', texto: diz(aceite.minha), pronto: Boolean(aceite.minha) },
    { quem: nomeOutro, texto: diz(aceite.outra), pronto: Boolean(aceite.outra) },
  ]
  return { linhas, resta, esperando: aceite.ate != null }
}

// frase curta de baixo das linhas: o que falta
export function dicaDoAceite(aceite, agora, nomeOutro = 'OPONENTE') {
  const { minha, outra } = aceite
  const resta = segundosRestantes(aceite, agora)
  if (!minha && !outra) return ''
  if (minha && !outra) return `esperando ${nomeOutro} (${resta}s)`
  if (!minha && outra) return outra === 'trocar' ? `${nomeOutro} quer trocar de personagem (${resta}s)` : `${nomeOutro} quer revanche (${resta}s): aceite em REVANCHE`
  return decidir(aceite) === 'trocar' ? 'trocando de personagem…' : 'revanche!'
}
