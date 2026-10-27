import { get } from 'svelte/store'
import { LARGURA } from '../constants.js'
import { tocar } from '../audio.js'
import { interceptarBotao } from '../controles.js'
import { podeEntrarEmSala } from '../rede.js'
import { conta } from '../../lib/conta.js'
import { amigos, responderConvite } from '../../lib/amigos.js'
import { lan } from '../../lib/lan/rede.js'
import { nomeDoItem, textoMotivo } from '../../lib/progresso.js'
import { criarFilaAvisos } from './fila.js'
import { novosIds } from './lista.js'
import { caixa, criarAvatar, COR, texto } from './ui.js'

// Avisos (toasts) por cima dos menus, dentro do jogo. Substituem a notificação
// de convite que era do Svelte e acrescentam o que antes ninguém via:
//   - pedido de amizade recebido (A em AMIGOS > PEDIDOS responde)
//   - convite de amigo: A aceita, B recusa, com a contagem (60 s)
//   - "o convite tirou você da fila" (aceitar um convite estando na fila do JOGAR RÁPIDO)
//   - "+XP" de quem ficou quando o oponente saiu no meio (antes só aparecia no perfil)
//   - erro da conta (login cancelado, perfil que não carregou)
//
// A fila é uma só para o jogo todo (fila.js). Quem desenha são as cenas de menu:
// cada uma chama montarAvisos(this) no create(). Na partida (arenas) ninguém
// desenha, então o aviso espera na fila e aparece quando voltar a um menu
// (podeEntrarEmSala(): a mesma regra de aceitar convite só no menu).
//
//   instalarAvisos()       uma vez (Game.svelte): liga as lojas (conta, amigos, lan) à fila
//   montarAvisos(cena)     nas cenas de menu: desenha o aviso da vez no canto de cima à direita
//   avisar(aviso)          põe um aviso na fila (ver fila.js)
export const avisos = criarFilaAvisos()
export const avisar = (aviso) => avisos.empurrar(aviso)

const MODOS = { pvp: 'PVP', coop: 'CO-OP' }
const SAIU_NO_MEIO = /saiu (no meio da partida|da partida)/
const QUEDA = /não voltou a tempo|não deu para voltar à partida/
const JANELA_SAIDA_MS = 30_000
const FILA_PENDENTE_MS = 10_000

let cenaVisivel = null // a cena que está desenhando o aviso agora (para o som)
let quadroVisivel = 0 // performance.now() do último quadro com um aviso na tela

// ---------- lojas -> fila ----------

export function instalarAvisos() {
  const parar = [interceptarBotao(aoBotaoDoAviso)]

  // erro da conta (login cancelado...): antes ficava na barra de cima
  let erroAntes = ''
  // pedidos de amizade: a primeira leitura é só o ponto de partida
  let cargaVista = false
  let baseSet = null
  parar.push(
    conta.subscribe((c) => {
      if (c.erro && c.erro !== erroAntes) avisar({ id: `conta-erro:${Date.now()}`, tipo: 'erro', titulo: 'CONTA', texto: c.erro, ms: 9000 })
      erroAntes = c.erro
      if (c.estado !== 'logado') {
        cargaVista = false
        baseSet = null
      }
    }),
  )

  const convitesNaFila = new Set()
  parar.push(
    amigos.subscribe((s) => {
      if (s.carregando) cargaVista = true
      else if (cargaVista) {
        const ids = s.recebidos.map((p) => p.id)
        for (const id of novosIds(baseSet, ids)) {
          const p = s.recebidos.find((x) => x.id === id)
          avisar({ id: `amizade:${id}:${Date.now()}`, tipo: 'amizade', titulo: `${p.nome} quer ser seu amigo`, texto: `${p.tag} · nível ${p.nivel}\nresponda em AMIGOS > PEDIDOS`, avatar: p.avatar })
        }
        baseSet = new Set(ids)
      }

      const agora = new Set(s.convites.map((c) => c.id))
      for (const c of s.convites) {
        if (convitesNaFila.has(c.id)) continue
        convitesNaFila.add(c.id)
        avisar({ id: `convite:${c.id}`, tipo: 'convite', conviteId: c.id, titulo: `${c.de.nome} convidou você`, texto: `${c.de.tag} · sala ${MODOS[c.modo] ?? 'PVP'}`, avatar: c.de.avatar, ate: c.ate })
      }
      for (const id of [...convitesNaFila]) {
        if (agora.has(id)) continue
        convitesNaFila.delete(id)
        avisos.descartar(`convite:${id}`)
      }
    }),
  )

  let recompensaVista = null
  let saiuEm = 0
  let erroLan = ''
  parar.push(
    lan.subscribe((s) => {
      if (filaPendente && s.fase === 'sala') {
        avisar({ id: `fila-saiu:${Date.now()}`, tipo: 'info', titulo: 'VOCÊ SAIU DA FILA', texto: 'o convite do seu amigo tirou você da fila do JOGAR RÁPIDO', ms: 6000 })
        filaPendente = 0
      } else if (filaPendente && Date.now() - filaPendente > FILA_PENDENTE_MS) filaPendente = 0

      if (s.erro && s.erro !== erroLan && SAIU_NO_MEIO.test(s.erro)) saiuEm = Date.now()
      // a partida acabou por uma queda de conexão (2D): o aviso espera a tela de menu
      if (s.erro && s.erro !== erroLan && QUEDA.test(s.erro)) avisar({ id: `queda:${Date.now()}`, tipo: 'erro', titulo: 'CONEXÃO', texto: s.erro, ms: 9000 })
      erroLan = s.erro

      const r = s.recompensa
      if (!r || r === recompensaVista) return
      recompensaVista = r
      // as telas de resultado já mostram o XP delas
      if (r.xpGanho <= 0 || telaDeResultadoAberta()) return
      const subiu = r.nivelDepois != null && r.nivelAntes != null && r.nivelDepois > r.nivelAntes
      const linhas = []
      if (Date.now() - saiuEm < JANELA_SAIDA_MS) linhas.push('o oponente saiu da partida: o XP ficou com você')
      else if (textoMotivo(r.motivo)) linhas.push(textoMotivo(r.motivo))
      if (subiu) linhas.push(`subiu para o nível ${r.nivelDepois}!`)
      if (r.itensNovos.length) linhas.push(`novo: ${r.itensNovos.map((i) => nomeDoItem(i) ?? i).join(', ')}`)
      avisar({ id: `xp:${r.partidaId}:${Date.now()}`, tipo: 'xp', titulo: `+${r.xpGanho} XP`, texto: linhas.join('\n'), ms: 7000 })
    }),
  )
  return () => parar.forEach((f) => f())
}

let filaPendente = 0
const TELAS_DE_RESULTADO = ['PvpResultado', 'Vitoria', 'GameOver']
let jogoDoMenu = null
const telaDeResultadoAberta = () => Boolean(jogoDoMenu?.scene.getScenes(true).some((c) => TELAS_DE_RESULTADO.includes(c.scene.key)))

// ---------- A aceita, B recusa ----------

function aoBotaoDoAviso(botao) {
  if (botao !== 'A' && botao !== 'B') return false
  const a = avisos.atual()
  // só vale com o aviso mesmo na tela (um quadro atrás, no máximo)
  if (a?.tipo !== 'convite' || performance.now() - quadroVisivel > 150) return false
  const aceitar = botao === 'A'
  if (aceitar && get(lan).fila) filaPendente = Date.now()
  if (cenaVisivel?.sys?.isActive()) tocar(cenaVisivel, aceitar ? 'confirmar' : 'cancelar')
  responderConvite(a.conviteId, aceitar)
  avisos.descartar(a.id)
  return true
}

// ---------- o desenho ----------

const LARGURA_AVISO = 336
const POS = { x: LARGURA - LARGURA_AVISO - 12, y: 40 }
const BORDA = { convite: 0xffe040, amizade: 0x3fd6c8, xp: 0x6dffb0, erro: 0xff7a7a, info: 0xffffff }
const COR_TITULO = { convite: '#ffe040', amizade: '#7fe8de', xp: '#7fe08a', erro: '#ff7a7a', info: '#ffffff' }

// `selecao: true` nas telas de escolha (PVP, party): ali só aparecem os avisos 'info'
// (controle conectado, jogador 2 entrou); convite e pedido de amizade esperam o menu
export function montarAvisos(cena, { selecao = false } = {}) {
  jogoDoMenu = cena.game
  const raiz = cena.add.container(POS.x, POS.y).setDepth(2000)
  let idAtual = null
  let segTexto = null
  let segAntes = -1

  const desenhar = (a) => {
    raiz.removeAll(true)
    const fundo = cena.add.graphics()
    const g = cena.add.graphics()
    raiz.add([fundo, g]) // por baixo dos textos
    const x0 = a.avatar ? 58 : 14
    const largura = LARGURA_AVISO - x0 - 12
    const titulo = texto(cena, x0, 10, a.titulo, 13, COR_TITULO[a.tipo] ?? '#ffffff', { wordWrap: { width: largura } })
    const corpo = a.texto ? texto(cena, x0, titulo.y + titulo.height + 4, a.texto, 11, COR.descricao, { wordWrap: { width: largura }, lineSpacing: 3 }) : null
    let fim = (corpo ? corpo.y + corpo.height : titulo.y + titulo.height) + 10
    let rodape = null
    if (a.tipo === 'convite') {
      const y = fim + 8
      for (const [cx, letra, rotulo] of [[x0 + 9, 'A', 'ACEITAR'], [x0 + 105, 'B', 'RECUSAR']]) {
        g.fillStyle(0xffffff, 1).fillCircle(cx, y, 9)
        raiz.add(texto(cena, cx, y, letra, 13, '#0b0914').setOrigin(0.5))
        raiz.add(texto(cena, cx + 14, y, rotulo, 12, '#ffffff').setOrigin(0, 0.5))
      }
      segTexto = texto(cena, LARGURA_AVISO - 14, y, '', 12, COR.gold).setOrigin(1, 0.5)
      rodape = segTexto
      fim = y + 18
    }
    const altura = Math.max(a.avatar ? 64 : 0, fim)
    caixa(fundo, 0, 0, LARGURA_AVISO, altura, BORDA[a.tipo] ?? 0xffffff, 0x0b0914, 0.97)
    raiz.add([titulo, ...(corpo ? [corpo] : [])])
    if (rodape) raiz.add(rodape)
    if (a.avatar) raiz.add(criarAvatar(cena, 30, 32, a.avatar, 32))
    raiz.setAlpha(0)
    cena.tweens.add({ targets: raiz, alpha: 1, duration: 140 })
    if (a.tipo === 'convite' || a.tipo === 'amizade') tocar(cena, 'confirmar')
    segAntes = -1
  }

  const aoQuadro = () => {
    const agora = Date.now()
    const a = selecao ? avisos.atualizar(agora, true, (x) => x.tipo === 'info') : avisos.atualizar(agora, podeEntrarEmSala())
    if (!a) {
      if (idAtual) raiz.removeAll(true)
      idAtual = null
      return
    }
    if (a.id !== idAtual) {
      idAtual = a.id
      desenhar(a)
    }
    cenaVisivel = cena
    quadroVisivel = performance.now()
    if (a.tipo === 'convite' && segTexto?.scene) {
      const seg = Math.max(0, Math.ceil((a.ate - agora) / 1000))
      if (seg !== segAntes) {
        segAntes = seg
        segTexto.setText(`${seg} s`)
      }
    }
  }
  cena.events.on('update', aoQuadro)
  cena.events.once('shutdown', () => {
    cena.events.off('update', aoQuadro)
    if (cenaVisivel === cena) cenaVisivel = null
    idAtual = null // o próximo menu desenha de novo
  })
}
