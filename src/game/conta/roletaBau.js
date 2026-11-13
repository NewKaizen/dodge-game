import { get } from 'svelte/store'
import { LARGURA, ALTURA } from '../constants.js'
import { tocar } from '../audio.js'
import { menosMovimento } from '../preferencias.js'
import { semLigaduras } from '../campanha/texto.js'
import { itemDoCatalogo, NOME_TIPO } from '../../lib/progresso.js'
import { COR_RARIDADE, COR_RARIDADE_NUM, NOME_RARIDADE, nomeDaFonte, itemDoBau, nivelDaRaridade } from '../../lib/cosmeticos.js'
import { construirFita, itemDaRecompensa, sortearIsca } from '../../lib/roleta.js'
import { bausConta, abrirBau, desistirDeAbrir } from '../../lib/bausConta.js'
import { equipar } from '../../lib/conta.js'
import { desenharBau, iconeDoTipo } from './bau.js'
import { miniaturaDe } from '../cosmeticosSlots.js'
import { texto } from './ui.js'

// A ROLETA DO BAÚ (docs/baus.md): o módulo que abre um baú na tela, usado pelo pop-up "VOCÊ GANHOU UM BAÚ!"
// (cena BauPopup, por cima de qualquer menu ou tela de resultado) e pela aba BAÚS da Coleção.
//
// Uma fita horizontal de cartas (um item do catálogo em cada uma, na cor da raridade) corre por baixo de um
// marcador, desacelera e para na recompensa de VERDADE. Quem decide o que sai é o servidor (lib/bausConta.js
// abrirBau -> abrir_bau): a fita gira à espera da resposta e só depois freia em cima do item que veio; as
// outras cartas são iscas sorteadas pelas chances publicadas (lib/roleta.js). Baú com 2 ou 3 recompensas: um
// giro por cosmético (o 1º de ~3,4 s, os outros de ~2,4 s); o bônus de XP aparece como ficha. "já tinha"
// mostra o XP. Depois: EQUIPAR AGORA (cosmético novo), ABRIR OUTRO (n) e FECHAR.
//
// Entrada: A confirma, B/C volta (no pop-up, B = DEPOIS), ←→ escolhe o botão, o mouse/toque clica nos botões;
// A, B, C ou um clique na tela PULAM o giro (e passam do item que acabou de parar). Movimento reduzido: sem
// rolagem, só a revelação. Todo texto passa por semLigaduras.
//
//   const r = criarRoletaBau(cena, { popup, fontes, fechados, aoFechar, aoAbrir, aoDepois })
//     popup: true começa no cartaz (ABRIR AGORA / DEPOIS); false abre direto (a aba BAÚS da Coleção)
//     aoAbrir(): apertou ABRIR AGORA · aoDepois(): apertou DEPOIS · aoFechar({ abriu }): a roleta saiu da tela
//   r.botao('A' | 'B' | 'C') · r.direcao('cima' | 'baixo' | 'esquerda' | 'direita') · r.destruir()
//   r.estado: 'popup' | 'abrindo' | 'girando' | 'parado' | 'fim' | 'erro' | 'fechado'
const L = 104 // a carta
const A = 128
const PASSO = 112 // de uma carta à outra
const CX = LARGURA / 2
const YF = 214 // o centro da fita
const POOL = Math.ceil(LARGURA / PASSO) + 4
const V_ESPERA = 1500 // px/s enquanto o servidor não responde
const ESPERA_MINIMA_MS = 700
const ESPERA_MAXIMA_MS = 8000
const PROTECAO_MS = 350 // o A que ainda estava na mão de quem acabou de ver o pop-up não vale
// (só no dev) window.debugBau.forcar = { recompensas: [...], xpGanho, ... }: a roleta usa este resultado no lugar do servidor
const forcado = () => (import.meta.env?.DEV && typeof window !== 'undefined' ? window.debugBau?.forcar ?? null : null)
const mod = (a, n) => ((a % n) + n) % n

// arco-íris (lendário): matiz 0..1 -> cor 0xRRGGBB
export function arcoIris(t) {
  const h = (((t % 1) + 1) % 1) * 6
  const f = h - Math.floor(h)
  const [r, g, b] = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][Math.floor(h) % 6]
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)
}

const tipoDoIcone = (c) => (c.tipo === 'xp' ? 'xp' : itemDoBau(c.id)?.slot ?? 'titulo')
const nomeDaCarta = (c) => (c.tipo === 'xp' ? `+${c.xp} XP` : itemDoBau(c.id)?.nome ?? c.id)

export function criarRoletaBau(cena, { popup = false, fontes = [], fechados = 0, aoFechar = () => {}, aoAbrir = () => {}, aoDepois = () => {}, profundidade = 3000, rng = Math.random } = {}) {
  const calmo = menosMovimento()
  const criadoEm = performance.now()
  const timers = []
  const tweens = []
  const raiz = cena.add.container(0, 0).setDepth(profundidade)
  const veu = cena.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA, ALTURA, 0x05040a, 0.95).setInteractive()
  raiz.add(veu)
  const r = { estado: popup ? 'popup' : 'abrindo' }

  // ---------- camadas ----------
  const camPopup = cena.add.container(0, 0)
  const camRoleta = cena.add.container(0, 0).setVisible(false)
  const camFx = cena.add.container(0, 0)
  const camBotoes = cena.add.container(0, 0)
  raiz.add([camPopup, camRoleta, camFx, camBotoes])
  const T = (cam, x, y, conteudo, tamanho, cor, extra) => {
    const t = texto(cena, x, y, semLigaduras(conteudo), tamanho, cor, extra).setOrigin(0.5)
    cam.add(t)
    return t
  }
  const tw = (config) => {
    const t = cena.tweens.add(config)
    tweens.push(t)
    return t
  }
  const depois = (ms, fn) => {
    const t = cena.time.delayedCall(ms, () => r.estado !== 'fechado' && fn())
    timers.push(t)
    return t
  }

  // ---------- o título e as legendas (a roleta) ----------
  const titulo = T(camRoleta, CX, 40, 'ABRINDO O BAÚ…', 22, '#ffd23a', { strokeThickness: 4 })
  const nomeTxt = T(camRoleta, CX, 302, '', 22, '#ffffff', { strokeThickness: 4 })
  const subTxt = T(camRoleta, CX, 328, '', 13, '#d4d4e4')
  const extraTxt = T(camRoleta, CX, 350, '', 14, '#7fe08a', { align: 'center', wordWrap: { width: LARGURA - 80 } })
  const dica = T(raiz, CX, ALTURA - 12, '', 11, '#9a9ab0')

  // ---------- a fita ----------
  const banda = cena.add.graphics()
  banda.fillStyle(0x0b0914, 1).fillRect(0, YF - A / 2 - 14, LARGURA, A + 28)
  banda.fillStyle(0xffffff, 0.05).fillRect(0, YF - A / 2 - 14, LARGURA, 2).fillRect(0, YF + A / 2 + 12, LARGURA, 2)
  camRoleta.add(banda)
  const cartas = []
  const gFita = cena.add.container(0, 0)
  camRoleta.add(gFita)
  for (let s = 0; s < POOL; s++) {
    const c = cena.add.container(0, YF)
    const g = cena.add.graphics()
    const ic = cena.add.graphics()
    // estilos de carta e versos ilustrados (0016): a miniatura de uma carta no lugar do ícone
    const mini = cena.add.image(0, -22, '__WHITE').setVisible(false)
    const nome = texto(cena, 0, 32, '', 11, '#ffffff', { align: 'center', wordWrap: { width: L - 8 } }).setOrigin(0.5, 0.5)
    c.add([g, ic, mini, nome])
    gFita.add(c)
    cartas.push({ c, g, ic, mini, nome, idx: NaN })
  }
  // as bordas escurecem (a roleta "some" nas pontas) e o marcador fica no meio
  const sombra = cena.add.graphics()
  for (let k = 0; k < 8; k++) {
    const l = 24 + k * 14
    const a = 0.55 * (1 - k / 8)
    sombra.fillStyle(0x05040a, a).fillRect(0, YF - A / 2 - 14, l, A + 28).fillRect(LARGURA - l, YF - A / 2 - 14, l, A + 28)
  }
  camRoleta.add(sombra)
  const marcador = cena.add.graphics()
  marcador.fillStyle(0xffe040, 1).fillRect(CX - 1.5, YF - A / 2 - 20, 3, A + 40)
  marcador.fillTriangle(CX - 11, YF - A / 2 - 24, CX + 11, YF - A / 2 - 24, CX, YF - A / 2 - 8)
  marcador.fillTriangle(CX - 11, YF + A / 2 + 24, CX + 11, YF + A / 2 + 24, CX, YF + A / 2 + 8)
  camRoleta.add(marcador)
  const halo = cena.add.graphics()
  camRoleta.add(halo)

  let off = 0 // a posição da fita (px) embaixo do marcador
  let fase = 'espera' // 'espera' | 'giro' | 'parado'
  const espera = Array.from({ length: 36 }, () => sortearIsca(rng))
  let fita = null
  let congelado = new Map() // as cartas que já estavam na tela quando um giro novo começa (não mudam de cara)
  let corte = 0
  let giro = null // { off0, D, T, p, t, vencedor }
  let ultimoTick = 0
  let ultimoSom = 0
  let abriuEm = 0
  let resultado = null
  let k = 0 // a recompensa da vez
  let coletadas = []
  let vencedorAbs = null
  let corHalo = 0xffffff
  let lendario = false
  let equipado = false
  let msgEquipar = null

  const itemEm = (i) => (fita && i >= corte ? fita[Math.min(i - corte, fita.length - 1)] : congelado.get(i) ?? espera[mod(i, espera.length)])

  function pintar(slot, c) {
    const cor = COR_RARIDADE_NUM[c.raridade] ?? 0xffffff
    slot.g.clear()
    slot.g.fillStyle(0x120f1e, 1).fillRect(-L / 2, -A / 2, L, A)
    slot.g.fillStyle(cor, 0.2).fillRect(-L / 2 + 3, -A / 2 + 3, L - 6, A - 6)
    slot.g.lineStyle(3, cor, 1).strokeRect(-L / 2 + 1.5, -A / 2 + 1.5, L - 3, A - 3)
    slot.g.fillStyle(cor, 1).fillRect(-L / 2, A / 2 - 9, L, 9)
    slot.ic.clear()
    const item = c.tipo === 'xp' ? null : itemDoBau(c.id)
    const chave = item && (item.slot === 'frente' || item.slot === 'verso') ? miniaturaDe(cena, item.slot, item.registro) : null
    if (chave) {
      slot.mini.setTexture(chave).setDisplaySize(44, 63).setPosition(0, -18).setVisible(true)
      slot.ic.lineStyle(2, cor, 1).strokeRect(-23, -50.5, 46, 65)
    } else {
      slot.mini.setVisible(false)
      iconeDoTipo(slot.ic, tipoDoIcone(c), 0, -22, 44, cor)
    }
    slot.nome.setText(semLigaduras(nomeDaCarta(c))).setColor(COR_RARIDADE[c.raridade] ?? '#ffffff')
  }

  function posicionar() {
    const primeiro = Math.floor((off - CX) / PASSO) - 1
    for (let s = 0; s < POOL; s++) {
      const i = primeiro + s
      const slot = cartas[mod(i, POOL)]
      if (slot.idx !== i) {
        slot.idx = i
        pintar(slot, itemEm(i))
      }
      slot.c.x = CX + i * PASSO - off
    }
  }
  const repintarTudo = () => {
    cartas.forEach((s) => (s.idx = NaN))
    posicionar()
  }

  // ---------- efeitos ----------
  function estourar(x, y, cor, n, { arco = false, raio = 220 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rng() * 0.4
      const d = raio * (0.35 + rng() * 0.75)
      const tam = 4 + Math.floor(rng() * 6)
      const p = cena.add.rectangle(x, y, tam, tam, arco ? arcoIris(i / n) : i % 4 ? cor : 0xffffff)
      camFx.add(p)
      tw({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, alpha: 0, angle: 200, duration: 600 + rng() * 500, ease: 'Cubic.easeOut', onComplete: () => p.destroy() })
    }
  }
  function clarao(alfa, ms = 420, cor = 0xffffff) {
    const f = cena.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA, ALTURA, cor, calmo ? alfa * 0.4 : alfa)
    camFx.add(f)
    tw({ targets: f, alpha: 0, duration: ms, onComplete: () => f.destroy() })
  }
  function anel(cor, arco = false) {
    for (let j = 0; j < (arco ? 3 : 1); j++) {
      const g = cena.add.graphics()
      g.lineStyle(4, arco ? arcoIris(j / 3) : cor, 1).strokeRect(-L / 2 - 6, -A / 2 - 6, L + 12, A + 12)
      g.setPosition(CX, YF)
      camFx.add(g)
      tw({ targets: g, scale: 2.6 + j * 0.5, alpha: 0, delay: j * 90, duration: 700, ease: 'Cubic.easeOut', onComplete: () => g.destroy() })
    }
  }

  function revelarVencedor(rec) {
    const raridade = rec.raridade
    const nivel = nivelDaRaridade(raridade)
    const cor = COR_RARIDADE_NUM[raridade] ?? 0xffffff
    corHalo = cor
    lendario = raridade === 'lendario'
    tocar(cena, 'roletaFim')
    if (nivel >= 2) depois(140, () => tocar(cena, 'confirmar'))
    if (lendario) depois(300, () => tocar(cena, 'explosaoGrande'))
    const n = calmo ? [4, 6, 8, 10][nivel] : [8, 18, 36, 90][nivel]
    estourar(CX, YF, cor, n, { arco: lendario, raio: [150, 210, 280, 420][nivel] })
    if (nivel >= 1 && !calmo) anel(cor, lendario)
    if (nivel >= 2) clarao(lendario ? 0.8 : 0.35, lendario ? 700 : 380, lendario ? 0xfff2b0 : cor)
    if (lendario && !calmo) {
      cena.cameras.main.shake(320, 0.009)
      // raios de luz subindo da carta
      for (let i = 0; i < 9; i++) {
        const ray = cena.add.rectangle(CX + (i - 4) * 46, YF + A / 2, 10, 20, arcoIris(i / 9), 0.8).setOrigin(0.5, 1)
        camFx.add(ray)
        tw({ targets: ray, scaleY: 18 + rng() * 12, alpha: 0, delay: i * 25, duration: 850, ease: 'Cubic.easeOut', onComplete: () => ray.destroy() })
      }
    }
    const venc = cartas[mod(vencedorAbs, POOL)]
    if (!calmo) tw({ targets: venc.c, scale: 1.16, duration: 160, yoyo: true, hold: 120 })
    // legendas
    const d = textoDaCarta(rec)
    nomeTxt.setText(semLigaduras(d.nome)).setColor(COR_RARIDADE[raridade] ?? '#ffffff').setScale(calmo ? 1 : 0.6)
    if (!calmo) tw({ targets: nomeTxt, scale: 1, duration: 260, ease: 'Back.easeOut' })
    subTxt.setText(semLigaduras(`${NOME_RARIDADE[raridade] ?? ''}${d.rotulo ? ` · ${d.rotulo}` : ''}`)).setColor(COR_RARIDADE[raridade] ?? '#d4d4e4')
    extraTxt.setText(semLigaduras(d.extra)).setColor(rec.duplicado ? '#ffb040' : '#7fe08a')
  }

  function textoDaCarta(rec) {
    if (rec.tipo === 'xp') return { nome: `+${rec.xp} XP`, rotulo: 'BÔNUS DE XP', extra: '' }
    const item = itemDoCatalogo(rec.id)
    const rotulo = (NOME_TIPO[item?.tipo] ?? 'cosmético').toUpperCase()
    return { nome: nomeDaCarta(rec), rotulo, extra: rec.duplicado ? `já tinha: +${rec.xp} XP` : 'NOVO!' }
  }

  // ---------- as fichas do que já saiu ----------
  const camFichas = cena.add.container(0, 0)
  camRoleta.add(camFichas)
  function desenharFichas() {
    camFichas.removeAll(true)
    const n = coletadas.length
    const w = 168
    coletadas.forEach((c, i) => {
      const x = CX + (i - (n - 1) / 2) * (w + 12)
      const y = 394
      const cor = COR_RARIDADE_NUM[c.raridade] ?? 0xffffff
      const g = cena.add.graphics()
      g.fillStyle(0x120f1e, 1).fillRect(x - w / 2, y - 20, w, 40)
      g.fillStyle(cor, 0.18).fillRect(x - w / 2 + 3, y - 17, w - 6, 34)
      g.lineStyle(3, cor, 1).strokeRect(x - w / 2 + 1.5, y - 18.5, w - 3, 37)
      iconeDoTipo(g, tipoDoIcone(c), x - w / 2 + 22, y, 26, cor)
      camFichas.add(g)
      const nome = texto(cena, x - w / 2 + 42, y - 8, semLigaduras(nomeDaCarta(c)), 11, COR_RARIDADE[c.raridade], { wordWrap: { width: w - 48 } }).setOrigin(0, 0.5)
      camFichas.add(nome)
      const sub = c.tipo === 'xp' ? 'bônus' : c.duplicado ? `já tinha +${c.xp} XP` : 'novo!'
      camFichas.add(texto(cena, x - w / 2 + 42, y + 9, semLigaduras(sub), 10, c.duplicado ? '#ffb040' : '#7fe08a').setOrigin(0, 0.5))
    })
  }

  // ---------- o giro ----------
  function iniciarGiro(rec, curto) {
    const real = itemDaRecompensa(rec)
    const v0 = V_ESPERA
    const p = 4
    const durAlvo = curto ? 2.4 : 3.4
    const base = Math.floor(off / PASSO)
    const antes = new Map()
    for (let i = base - 8; i <= base + 8; i++) antes.set(i, itemEm(i))
    congelado = antes
    const K = Math.max(7, Math.min(22, Math.round((v0 * durAlvo) / p / PASSO)))
    corte = base + 6
    const paradaAbs = base + K
    const jitter = (rng() < 0.5 ? -1 : 1) * (6 + rng() * (L / 2 - 20))
    const alvo = paradaAbs * PASSO + jitter
    const D = Math.max(PASSO, alvo - off)
    fita = construirFita({ real, tamanho: paradaAbs - corte + 8, parada: paradaAbs - corte, rng })
    vencedorAbs = paradaAbs
    repintarTudo()
    giro = { off0: off, D, T: (p * D) / v0, p, t: 0, rec }
    fase = 'giro'
    r.estado = 'girando'
    ultimoTick = Math.floor((off + PASSO / 2) / PASSO)
    titulo.setColor('#ffd23a')
    titulo.setText(semLigaduras(resultado.recompensas.length > 1 ? `BAÚ: RECOMPENSA ${k + 1} DE ${resultado.recompensas.length}` : 'SORTEANDO…'))
    nomeTxt.setText('')
    subTxt.setText('')
    extraTxt.setText('')
    halo.clear()
    atualizarDica()
    if (calmo) terminarGiro()
  }

  function terminarGiro() {
    if (!giro) return
    off = giro.off0 + giro.D
    const rec = itemDaRecompensa(giro.rec)
    giro = null
    fase = 'parado'
    r.estado = 'parado'
    posicionar()
    coletadas.push(rec)
    desenharFichas()
    titulo.setText(semLigaduras(`${NOME_RARIDADE[rec.raridade] ?? ''}!`)).setColor(COR_RARIDADE[rec.raridade] ?? '#ffd23a')
    revelarVencedor(rec)
    atualizarDica()
    const ultima = k >= resultado.recompensas.length - 1
    depois(calmo ? 500 : ultima ? 1100 : 1200, () => r.estado === 'parado' && avancar())
  }

  function avancar() {
    if (r.estado !== 'parado' && r.estado !== 'abrindo') return
    k += 1
    halo.clear()
    lendario = false
    const recs = resultado.recompensas
    if (k >= recs.length) return mostrarFim()
    const rec = recs[k]
    if (rec.tipo === 'xp') {
      // o bônus de XP não gira: vira uma ficha
      r.estado = 'parado'
      const c = itemDaRecompensa(rec)
      coletadas.push(c)
      desenharFichas()
      tocar(cena, 'mover')
      nomeTxt.setText(semLigaduras(`+${rec.xp} XP`)).setColor(COR_RARIDADE[rec.raridade])
      subTxt.setText(semLigaduras(`${NOME_RARIDADE[rec.raridade]} · BÔNUS DE XP`)).setColor(COR_RARIDADE[rec.raridade])
      extraTxt.setText('')
      estourar(CX, 394, COR_RARIDADE_NUM[rec.raridade], calmo ? 3 : 10, { raio: 70 })
      return depois(calmo ? 350 : 650, () => r.estado === 'parado' && avancar())
    }
    iniciarGiro(rec, true)
  }

  // ---------- o fim ----------
  const novoMelhor = () => {
    const novos = (resultado?.recompensas ?? []).filter((x) => x.tipo === 'item')
    return novos.sort((a, b) => nivelDaRaridade(b.raridade) - nivelDaRaridade(a.raridade))[0] ?? null
  }

  function mostrarFim() {
    r.estado = 'fim'
    fase = 'parado'
    sel = 0
    titulo.setColor('#ffd23a').setText('BAÚ ABERTO!')
    const res = resultado
    const partes = []
    if (res.xpGanho > 0) partes.push(`+${res.xpGanho} XP no total`)
    if (res.teto) partes.push('(o XP de baús de hoje chegou no teto)')
    if (res.nivelDepois != null && res.nivelAntes != null && res.nivelDepois > res.nivelAntes) partes.push(`subiu para o nível ${res.nivelDepois}: +1 baú!`)
    if (res.pity) partes.push('épico garantido!')
    nomeTxt.setText('')
    subTxt.setText('')
    extraTxt.setText(semLigaduras(partes.join('   ') || ' ')).setColor('#ffe9a0')
    desenharBotoes()
    atualizarDica()
  }

  function falhar(msg) {
    r.estado = 'erro'
    fase = 'parado'
    titulo.setText('NÃO DEU PARA ABRIR')
    nomeTxt.setText('')
    subTxt.setText('')
    extraTxt.setText(semLigaduras(msg || 'não deu para abrir o baú')).setColor('#ff7a7a')
    desenharBotoes()
    atualizarDica()
  }

  async function equiparAgora() {
    const rec = novoMelhor()
    if (!rec || equipado) return
    const item = itemDoBau(rec.id)
    equipado = true
    desenharBotoes()
    extraTxt.setText('equipando…').setColor('#ffe9a0')
    const res = await equipar(item.tipo, rec.id)
    if (r.estado === 'fechado') return
    msgEquipar = res.ok ? { texto: `${item.nome} equipado!`, cor: '#7fe08a' } : { texto: res.erro || 'não deu para equipar', cor: '#ff7a7a' }
    if (!res.ok) equipado = false
    extraTxt.setText(semLigaduras(msgEquipar.texto)).setColor(msgEquipar.cor)
    desenharBotoes()
  }

  // ---------- abrir ----------
  function comecarAbertura() {
    r.estado = 'abrindo'
    camPopup.setVisible(false)
    camRoleta.setVisible(true)
    resultado = null
    k = 0
    coletadas = []
    fita = null
    congelado = new Map()
    giro = null
    equipado = false
    msgEquipar = null
    camFichas.removeAll(true)
    nomeTxt.setText('')
    subTxt.setText('')
    extraTxt.setText('')
    halo.clear()
    titulo.setColor('#ffd23a').setText('ABRINDO O BAÚ…')
    fase = 'espera'
    abriuEm = cena.time.now
    repintarTudo()
    limparBotoes()
    tocar(cena, 'confirmar')
    if (!forcado()) abrirBau()
    atualizarDica()
  }

  function receber(res) {
    resultado = res
    if (!res.recompensas.length) return falhar('o baú veio vazio: tente de novo')
    k = -1
    if (res.recompensas[0].tipo === 'xp') {
      // (nunca acontece: a 1ª é sempre um cosmético) sem giro
      r.estado = 'parado'
      return avancar()
    }
    k = 0
    iniciarGiro(res.recompensas[0], false)
  }

  // ---------- os botões ----------
  let botoes = []
  let sel = 0
  const zonas = []
  function limparBotoes() {
    botoes = []
    gBot = null
    rotulosBot = []
    camBotoes.removeAll(true)
    zonas.length = 0
  }
  let gBot = null
  let rotulosBot = []
  function pintarBotoes() {
    if (!gBot) return
    const { y, w, gap } = r.layoutBotoes
    const total = botoes.length * w + (botoes.length - 1) * gap
    gBot.clear()
    botoes.forEach((b, i) => {
      const x = CX - total / 2 + i * (w + gap)
      const ativo = i === sel
      gBot.fillStyle(ativo ? 0xffe040 : 0xffffff, ativo ? 0.18 : 0.05).fillRect(x, y - 20, w, 40)
      gBot.lineStyle(3, ativo ? 0xffe040 : 0x6a6a7c, 1).strokeRect(x + 1.5, y - 18.5, w - 3, 37)
      rotulosBot[i]?.setColor(ativo ? '#ffe040' : b.cor ?? '#ffffff')
    })
  }
  function definirBotoes(lista, y) {
    camBotoes.removeAll(true)
    zonas.length = 0
    botoes = lista
    sel = Math.min(sel, botoes.length - 1)
    const w = botoes.length === 3 ? 250 : 260
    const gap = 16
    const total = botoes.length * w + (botoes.length - 1) * gap
    r.layoutBotoes = { y, w, gap }
    gBot = cena.add.graphics()
    camBotoes.add(gBot)
    rotulosBot = botoes.map((b, i) => {
      const x = CX - total / 2 + i * (w + gap)
      const t = texto(cena, x + w / 2, y, semLigaduras(b.rotulo), 15, b.cor ?? '#ffffff').setOrigin(0.5)
      camBotoes.add(t)
      const z = cena.add.rectangle(x + w / 2, y, w, 40, 0xffffff, 0).setInteractive({ useHandCursor: true })
      z.on('pointerover', () => {
        if (sel === i) return
        sel = i
        tocar(cena, 'mover')
        pintarBotoes()
      })
      // (adiado: confirmar() refaz os botões, e este aqui ainda está tratando o clique)
      z.on('pointerdown', () => {
        sel = i
        depois(0, confirmar)
      })
      camBotoes.add(z)
      zonas.push(z)
      return t
    })
    pintarBotoes()
  }

  function desenharBotoes() {
    if (r.estado === 'popup') return definirBotoes([{ rotulo: 'ABRIR AGORA', cor: '#ffd23a' }, { rotulo: 'DEPOIS', cor: '#c8d0e0' }], 410)
    if (r.estado === 'fim') {
      const lista = []
      if (novoMelhor() && !equipado) lista.push({ rotulo: 'EQUIPAR AGORA', cor: '#7fe08a', acao: 'equipar' })
      const n = get(bausConta).fechados
      if (n > 0) lista.push({ rotulo: `ABRIR OUTRO (${n})`, cor: '#ffd23a', acao: 'outro' })
      lista.push({ rotulo: 'FECHAR', cor: '#c8d0e0', acao: 'fechar' })
      return definirBotoes(lista, 436)
    }
    if (r.estado === 'erro') return definirBotoes([{ rotulo: 'FECHAR', cor: '#c8d0e0', acao: 'fechar' }], 436)
    limparBotoes()
  }

  function confirmar() {
    if (r.estado === 'popup') {
      tocar(cena, 'confirmar')
      if (sel === 0) {
        aoAbrir()
        return comecarAbertura()
      }
      return depoisDisso()
    }
    if (r.estado === 'fim' || r.estado === 'erro') {
      const acao = botoes[sel]?.acao
      if (acao === 'equipar') {
        tocar(cena, 'confirmar')
        return equiparAgora()
      }
      if (acao === 'outro') {
        tocar(cena, 'confirmar')
        sel = 0
        return comecarAbertura()
      }
      tocar(cena, 'cancelar')
      return fechar(true)
    }
  }

  function depoisDisso() {
    aoDepois()
    fechar(false)
  }

  function fechar(abriu) {
    if (r.estado === 'fechado') return
    r.destruir()
    aoFechar({ abriu })
  }

  // ---------- popup (o cartaz) ----------
  if (popup) {
    const bau = cena.add.container(CX, 190)
    const luz = cena.add.graphics()
    for (let i = 0; i < 7; i++) luz.fillStyle(0xffd23a, 0.04 + i * 0.012).fillCircle(0, 0, 150 - i * 18)
    bau.add(luz)
    const gBau = cena.add.graphics()
    desenharBau(gBau, 0, 0, 2.1, { aberto: false })
    bau.add(gBau)
    camPopup.add(bau)
    const n = Math.max(1, fontes.length)
    T(camPopup, CX, 52, n > 1 ? `VOCÊ GANHOU ${n} BAÚS!` : 'VOCÊ GANHOU UM BAÚ!', 28, '#ffd23a', { strokeThickness: 5 })
    const motivos = [...new Set(fontes.map(nomeDaFonte))].slice(0, 3).join(' · ')
    T(camPopup, CX, 296, motivos || 'baú novo na sua conta', 14, '#ffe9a0', { align: 'center', wordWrap: { width: LARGURA - 100 } })
    T(camPopup, CX, 326, fechados > 1 ? `${fechados} baús fechados esperando por você` : 'abra agora e veja o que veio', 13, '#d4d4e4')
    T(camPopup, CX, 360, 'DEPOIS guarda o baú na aba BAÚS da COLEÇÃO', 11, '#9a9ab0')
    if (!calmo) {
      tw({ targets: bau, y: 182, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      tw({ targets: bau, angle: { from: -2, to: 2 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    clarao(0.4, 380, 0xffd23a)
    tocar(cena, 'roletaFim')
    desenharBotoes()
  }

  function atualizarDica() {
    const e = r.estado
    const t =
      e === 'popup' ? '←→ ESCOLHER  ·  A CONFIRMAR  ·  B DEPOIS'
      : e === 'abrindo' ? 'esperando o servidor sortear…'
      : e === 'girando' ? 'A: PULAR'
      : e === 'parado' ? 'A: CONTINUAR'
      : e === 'fim' || e === 'erro' ? '←→ ESCOLHER  ·  A CONFIRMAR  ·  B FECHAR'
      : ''
    dica.setText(semLigaduras(t))
  }

  // ---------- o quadro ----------
  function quadro(time, delta) {
    if (r.estado === 'fechado') return
    const dt = Math.min(0.05, (delta || 16) / 1000)
    if (r.estado === 'abrindo') {
      if (!calmo) off += V_ESPERA * dt
      const b = forcado() ? { ultimo: forcado() } : get(bausConta)
      const esperou = cena.time.now - abriuEm
      if (esperou >= (calmo ? 0 : ESPERA_MINIMA_MS)) {
        if (b.ultimo) receber(b.ultimo)
        else if (b.erroAbrir) falhar(b.erroAbrir)
        else if (esperou > ESPERA_MAXIMA_MS) desistirDeAbrir()
      }
    } else if (giro) {
      giro.t += dt
      const u = Math.min(1, giro.t / giro.T)
      off = giro.off0 + giro.D * (1 - (1 - u) ** giro.p)
      if (u >= 1) terminarGiro()
    }
    if (r.estado === 'abrindo' || r.estado === 'girando' || r.estado === 'parado' || r.estado === 'fim' || r.estado === 'erro') {
      posicionar()
      // o tique de cada carta que passa pelo marcador
      const c = Math.floor((off + PASSO / 2) / PASSO)
      if (c !== ultimoTick) {
        ultimoTick = c
        if (fase !== 'parado' && time - ultimoSom > 30) {
          ultimoSom = time
          tocar(cena, 'roleta')
        }
      }
    }
    if (r.estado === 'parado' || r.estado === 'fim') {
      halo.clear()
      if (coletadas.length && r.estado === 'parado') {
        const cor = lendario ? arcoIris(time / 700) : corHalo
        const pulso = 0.55 + 0.45 * Math.sin(time / 120)
        halo.lineStyle(4, cor, pulso).strokeRect(CX - L / 2 - 5, YF - A / 2 - 5, L + 10, A + 10)
        if (lendario) halo.lineStyle(3, arcoIris(time / 700 + 0.5), pulso).strokeRect(CX - L / 2 - 11, YF - A / 2 - 11, L + 22, A + 22)
        else if (nivelDaRaridade(coletadas.at(-1).raridade) >= 2) halo.lineStyle(2, cor, pulso * 0.6).strokeRect(CX - L / 2 - 10, YF - A / 2 - 10, L + 20, A + 20)
      }
    }
  }
  cena.events.on('update', quadro)

  // ---------- entrada ----------
  function pular() {
    if (r.estado === 'girando' && giro) terminarGiro()
    else if (r.estado === 'parado') avancar()
  }

  r.botao = (b) => {
    if (r.estado === 'fechado' || performance.now() - criadoEm < PROTECAO_MS) return
    if (r.estado === 'girando' || r.estado === 'parado') return pular()
    if (r.estado === 'popup') {
      if (b === 'A') return confirmar()
      sel = 1 // B / C = DEPOIS
      return confirmar()
    }
    if (r.estado === 'fim' || r.estado === 'erro') {
      if (b === 'A') return confirmar()
      tocar(cena, 'cancelar')
      return fechar(true)
    }
  }

  r.direcao = (d) => {
    if (r.estado === 'fechado' || !botoes.length || (d !== 'esquerda' && d !== 'direita' && d !== 'cima' && d !== 'baixo')) return
    const passo = d === 'esquerda' || d === 'cima' ? -1 : 1
    sel = (sel + passo + botoes.length) % botoes.length
    tocar(cena, 'mover')
    pintarBotoes()
  }

  veu.on('pointerdown', () => {
    if (r.estado === 'girando' || r.estado === 'parado') pular()
  })

  r.destruir = () => {
    if (r.estado === 'fechado') return
    r.estado = 'fechado'
    cena.events.off('update', quadro)
    timers.forEach((t) => t.remove(false))
    tweens.forEach((t) => t.stop())
    raiz.destroy(true)
  }

  // ---------- começo ----------
  atualizarDica()
  if (!popup) comecarAbertura()
  return r
}
