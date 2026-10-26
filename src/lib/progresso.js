// Progresso da conta (Fase 1D): XP, níveis e a trilha de cosméticos.
//
// QUEM MANDA é o banco (supabase/migrations/0003_progresso.sql): o XP e os
// itens só são concedidos pelo servidor, na função conceder_recompensa. Este
// arquivo é o ESPELHO em JS das mesmas regras, para desenhar a barra de XP,
// dizer "próxima recompensa no nível N" e o Supabase falso dos testes. O teste
// src/lib/__tests__/progresso.test.js confere que os números daqui batem com
// os do SQL e com a tabela do docs/online.md: mudou um, mude os três.
//
//   xpParaProximo(nivel)     XP para passar do nível `nivel` ao seguinte
//   xpTotalDoNivel(nivel)    XP total para chegar no nível
//   nivelDoXp(total)         nível de quem tem `total` de XP
//   progressoDoXp(total)     { nivel, noNivel, paraProximo, total }
//   xpDaPartida({...})       { xp, motivo } (o mesmo cálculo do conceder_recompensa)
//   CATALOGO · itemDoCatalogo(id) · itensAte(nivel) · proximaRecompensa(nivel)
//   textoMotivo(codigo)      o aviso para o jogador quando a partida não dá XP (ou dá menos)

// ---------- XP por partida ----------

export const XP_PARTICIPACAO = 40 // jogou a partida até o fim (as duas pontas confirmaram)
export const XP_VITORIA = 20 // bônus de quem venceu (só com resultado confirmado)
export const DURACAO_MINIMA_S = 60 // medida pelo servidor, do começo ao fim
export const RODADAS_MINIMAS = 2 // quando o resultado diz quantas rodadas teve
export const REPETICAO_CHEIA = 3 // partidas por dia contra o mesmo oponente com XP cheio
export const REPETICAO_LIMITE = 5 // depois disso, 0 XP no dia (as do meio valem metade)
export const NIVEL_MAXIMO = 99

// Curva: para passar do nível N ao N+1 são 100 + 25 × (N − 1) XP.
//   nível 1→2: 100 · 2→3: 125 · 3→4: 150 · ... · 14→15: 425
export const xpParaProximo = (nivel) => 100 + 25 * (Math.max(1, Math.floor(Number(nivel) || 1)) - 1)

export function xpTotalDoNivel(nivel) {
  const alvo = Math.min(NIVEL_MAXIMO, Math.max(1, Math.floor(Number(nivel) || 1)))
  let total = 0
  for (let n = 1; n < alvo; n++) total += xpParaProximo(n)
  return total
}

export function nivelDoXp(total) {
  let resto = Math.max(0, Math.floor(Number(total) || 0))
  let nivel = 1
  while (nivel < NIVEL_MAXIMO && resto >= xpParaProximo(nivel)) {
    resto -= xpParaProximo(nivel)
    nivel++
  }
  return nivel
}

// onde está na barra do nível atual (no máximo, a barra fica cheia)
export function progressoDoXp(total) {
  const t = Math.max(0, Math.floor(Number(total) || 0))
  const nivel = nivelDoXp(t)
  const paraProximo = xpParaProximo(nivel)
  const noNivel = nivel >= NIVEL_MAXIMO ? paraProximo : t - xpTotalDoNivel(nivel)
  return { nivel, noNivel, paraProximo, total: t }
}

// Resultados que o servidor grava em cada lado (partida_participantes.resultado):
//   vitoria · derrota · empate      resultado confirmado pelos dois (ou o outro abandonou antes)
//   contestada                      os dois disseram coisas diferentes: só participação
//   participacao                    só um confirmou e o outro continuava lá: só participação
//   abandono · sem_relato           saiu no meio / não mandou o resultado: nada
export const RESULTADOS_JOGADOS = ['vitoria', 'derrota', 'empate', 'contestada', 'participacao']

// O mesmo cálculo do conceder_recompensa (SQL). repeticoes = partidas com XP
// hoje contra esse oponente ANTES desta.
export function xpDaPartida({ resultado, duracaoS, rodadas = null, repeticoes = 0 }) {
  if (!RESULTADOS_JOGADOS.includes(resultado)) return { xp: 0, motivo: resultado ?? 'sem_relato' }
  if ((Number(duracaoS) || 0) < DURACAO_MINIMA_S || (rodadas != null && rodadas < RODADAS_MINIMAS)) return { xp: 0, motivo: 'curta' }
  if (repeticoes >= REPETICAO_LIMITE) return { xp: 0, motivo: 'repeticao' }
  let xp = XP_PARTICIPACAO + (resultado === 'vitoria' ? XP_VITORIA : 0)
  if (repeticoes >= REPETICAO_CHEIA) return { xp: Math.floor(xp / 2), motivo: 'repeticao_metade' }
  return { xp, motivo: resultado }
}

const MOTIVOS = {
  convidado: 'convidado: crie uma conta para ganhar XP',
  mesma_conta: 'a mesma conta dos dois lados não ganha XP',
  cpu: 'partida contra a CPU não vale XP',
  curta: 'partida curta demais para valer XP',
  repeticao: 'já jogaram muito hoje: contra esse oponente, sem XP até amanhã',
  repeticao_metade: 'XP pela metade: várias partidas hoje contra esse oponente',
  contestada: 'os resultados não bateram: só o XP de participação',
  participacao: 'o oponente não confirmou o resultado: só o XP de participação',
  abandono: 'você saiu no meio: sem XP nesta partida',
  sem_relato: 'o resultado não chegou a tempo: sem XP',
  nao_registrada: 'essa partida não foi registrada no servidor',
  indisponivel: 'progresso indisponível neste servidor',
  erro: 'não deu para salvar o progresso agora',
  atrasado: 'o resultado chegou tarde demais',
  espera: 'o XP aparece no perfil assim que o servidor confirmar',
}
export const textoMotivo = (codigo) => MOTIVOS[codigo] ?? ''

// ---------- catálogo (espelho do seed em 0003_progresso.sql) ----------
// id = '<tipo>.<nome>'; padrao: todo mundo tem (não precisa ganhar).
// cor: só para desenhar (moldura em volta do avatar, verso da carta).
export const TIPOS_ITEM = ['avatar', 'titulo', 'moldura', 'verso']
export const NOME_TIPO = { avatar: 'avatar', titulo: 'título', moldura: 'moldura', verso: 'verso de carta' }

export const CATALOGO = [
  { id: 'titulo.novato', tipo: 'titulo', nome: 'Novato', nivel: 1, padrao: true },
  { id: 'moldura.simples', tipo: 'moldura', nome: 'Simples', nivel: 1, padrao: true, cor: '#6dffb0' },
  { id: 'verso.classico', tipo: 'verso', nome: 'Clássico', nivel: 1, padrao: true, cor: '#161226' },
  { id: 'titulo.esquivador', tipo: 'titulo', nome: 'Esquivador', nivel: 2 },
  { id: 'moldura.bronze', tipo: 'moldura', nome: 'Bronze', nivel: 3, cor: '#cd7f32' },
  { id: 'verso.estrelas', tipo: 'verso', nome: 'Estrelado', nivel: 4, cor: '#1e2a6e' },
  { id: 'avatar.king', tipo: 'avatar', nome: 'King', nivel: 5 },
  { id: 'titulo.duelista', tipo: 'titulo', nome: 'Duelista', nivel: 6 },
  { id: 'moldura.prata', tipo: 'moldura', nome: 'Prata', nivel: 7, cor: '#c8d0e0' },
  { id: 'verso.carmesim', tipo: 'verso', nome: 'Carmesim', nivel: 8, cor: '#6e1e2a' },
  { id: 'avatar.queen', tipo: 'avatar', nome: 'Queen', nivel: 9 },
  { id: 'titulo.veterano', tipo: 'titulo', nome: 'Veterano da Mesa', nivel: 10 },
  { id: 'moldura.ouro', tipo: 'moldura', nome: 'Ouro', nivel: 11, cor: '#ffd34d' },
  { id: 'verso.dourado', tipo: 'verso', nome: 'Dourado', nivel: 12, cor: '#6e561e' },
  { id: 'avatar.jevil', tipo: 'avatar', nome: 'Jevil', nivel: 13 },
  { id: 'titulo.cartomante', tipo: 'titulo', nome: 'Cartomante', nivel: 14 },
  { id: 'moldura.arcoiris', tipo: 'moldura', nome: 'Arco-íris', nivel: 15, cor: '#ff5fd2' },
]

// avatares que só a trilha libera (os personagens do jogo continuam de graça)
export const AVATARES_TRILHA = CATALOGO.filter((i) => i.tipo === 'avatar').map((i) => i.id.split('.')[1])

const PORID = new Map(CATALOGO.map((i) => [i.id, i]))
export const itemDoCatalogo = (id) => PORID.get(id) ?? null
export const nomeDoItem = (id) => PORID.get(id)?.nome ?? null
// os da trilha até o nível (os padrão não entram: todo mundo já tem)
export const itensAte = (nivel) => CATALOGO.filter((i) => !i.padrao && i.nivel <= nivel)
// o próximo item da trilha depois do nível atual (null: já tem todos)
export const proximaRecompensa = (nivel) => CATALOGO.find((i) => !i.padrao && i.nivel > nivel) ?? null
// moldura equipada -> cor da borda do avatar
export const corDaMoldura = (id) => itemDoCatalogo(id)?.tipo === 'moldura' ? itemDoCatalogo(id).cor : null
