// O CO-OP 2.0 DENTRO DAS ARENAS (docs/coop-cartas.md "CO-OP 2.0"): os métodos que a CoopArena (2 jogadores, ou
// 1 + CPU aliada) e a CoopArenaN (3 e 4, online) usam iguais, ligados nas duas com ligarCoop2(Cena). As regras
// ficam em coop/coop2.js, coop/resgate.js e coop/regraChefe.js; o desenho em coop/coop2Cena.js.
//
// A cena dá (cada uma do seu jeito):
//   this.estado, this.quadro, this.ko, this.rodadaAtual, this.personagens[j] { x, y, sprite, direita? }, this.ids,
//   this.inimigo, this.huds[j], this.armadas[j], this.rede (ou null), this.semente, this.idNivel, this.defChefe,
//   mostrarBanner, etiquetaEm, esperar, noQuadro(j), danoNoCoracao(j, dano), aplicarAcerto(j, dano), atualizarCaidos,
//   atualizarChefe e:
//     vagasCoop2()          quantos jogadores (2, 3 ou 4)
//     corDoJogador(j)       a cor do coração de j
//     nomeCurto(j)          o nome de j para os avisos
//     avisoDe(j)            o texto de aviso do canto de j (CAIU!, DE PÉ!)
//     souDonoDoCoracao(j)   o coração j é simulado neste PC (o meu, ou o da CPU aliada)
//     chefePos              { x, y } do chefe
// E põe no estadoInicial (a instância é reaproveitada: cenasReaproveitadas.test.js): previaChefe, barraQuebra,
// almas, visualAlmas, regra, dicasCoop, comoFunciona, marcaAtordoado, quebraParaAnunciar, logCoop2.
import { FONTE, TEXTO, LARGURA, corTexto } from '../constants.js'
import { tocar } from '../audio.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'
import { semLigaduras } from '../campanha/texto.js'
import { aplicarGolpe, resgatarNaHora, previaCoop } from './regras.js'
import { DUPLAS, QUEBRA, atordoadoAgora, somarQuebra } from './coop2.js'
import { criarAlmas, posicaoDaAlma, RESGATE } from './resgate.js'
import { RegraDaLuta, REGRAS } from './regraChefe.js'
import { criarPreviaIntencao, criarBarraQuebra, criarVisualAlmas, finalizacaoEmDupla, mostrarComoFunciona, criarDicas, pontePhaserDaRegra, COR_ATORDOADO } from './coop2Cena.js'

export const METODOS_COOP2 = {
  // a prévia, a barra de QUEBRA, as almas do resgate, as dicas e a regra do chefe.
  // posicoes = { previa: { x, y }, barra: { x, y } }; regraDev = id de REGRAS (só no dev)
  criarCoop2({ previa, barra, regraDev = null }) {
    this.previaChefe = criarPreviaIntencao(this, previa)
    this.barraQuebra = criarBarraQuebra(this, { x: barra.x, y: barra.y, largura: 100 })
    this.almas = criarAlmas()
    this.visualAlmas = criarVisualAlmas(this, this.quadro.caixa)
    this.dicasCoop = criarDicas(this)
    const def = this.defChefe.regra ?? (regraDev ? REGRAS[regraDev] : null)
    this.regra = new RegraDaLuta(def, this.ponteDaRegra())
    this.atualizarChefe({ animado: false })
    this.events.once('shutdown', () => {
      this.regra?.terminar()
      this.visualAlmas?.limpar()
    })
  },

  // a ponte da regra do chefe (coop/regraChefe.js): o desenho, os corações, a rede
  ponteDaRegra() {
    return {
      ...pontePhaserDaRegra(this, this.quadro.caixa),
      semente: this.semente,
      nivel: this.idNivel,
      n: this.vagasCoop2(),
      cena: this,
      rodada: () => this.estado.rodada,
      estado: () => this.estado,
      meu: (j) => this.souDonoDoCoracao(j),
      meuLado: () => this.rede?.meuLado ?? this.rede?.meu ?? 0,
      coracoes: () => this.quadro.coracoes.map((c, j) => ({ j, x: c.x, y: c.y, ativo: c.ativo && !this.ko[j] })),
      limites: () => {
        const l = this.quadro.caixa.limites
        return { x: l.x, y: l.y, width: l.width, height: l.height }
      },
      banner: (texto, cor = TEXTO.selecionado) => this.mostrarBanner(semLigaduras(texto), cor, { y: 236, tamanho: 18, ms: 1100 }),
      dica: (id, texto) => this.dicasCoop.mostrar(id, texto),
      quebra: (pontos) => this.somarQuebraDaRegra(pontos),
      danoNoChefe: (dano) => this.golpeExtraNoChefe(dano),
      curar: (j, hp) => this.curarDaRegra(j, hp),
      ferir: (j, dano) => this.aplicarAcerto(j, this.danoNoCoracao(j, dano)),
      empurrar: (j, dx, dy) => {
        const c = this.quadro.coracoes[j]
        if (!c?.ativo) return
        c.x += dx
        c.y += dy
        c.ajustar()
      },
      enviar: (acao, dados) => this.rede?.enviarRegra(acao, dados),
    }
  },

  // (debug) o que o CO-OP 2.0 mostrou nesta luta (estadoDebug().coop2; os testes no navegador leem)
  registrar(tipo) {
    this.logCoop2.push({ rodada: this.estado.rodada, tipo })
    if (this.logCoop2.length > 200) this.logCoop2.shift()
  },

  // a regra encheu a barra (roda em todos os PCs: ver coop/regraChefe.js)
  somarQuebraDaRegra(pontos) {
    const { ganho, quebrou } = somarQuebra(this.estado, pontos)
    if (ganho) this.barraQuebra.ganhou(ganho)
    this.atualizarChefe()
    if (quebrou) this.quebraParaAnunciar = true
  },

  // cura da regra no jogador j (de pé): o número no placar dele
  curarDaRegra(j, hp) {
    const jog = this.estado.jogadores[j]
    if (!jog || jog.caido) return 0
    const antes = jog.hp
    jog.hp = Math.min(jog.hpMax, jog.hp + Math.max(0, Math.round(hp)))
    const cura = jog.hp - antes
    if (cura) {
      this.huds[j].setHp(jog.hp)
      tocar(this, 'cura')
    }
    return cura
  },

  // golpe extra da regra no chefe (sem carta): o número e o tremor
  golpeExtraNoChefe(dano) {
    const efetivo = aplicarGolpe(this.estado, Math.max(0, Math.round(dano)))
    if (!efetivo) return 0
    tocar(this, 'golpe')
    this.inimigo.dano(Math.min(1, efetivo / 60))
    numero(this, this.chefePos.x, this.chefePos.y - 40, String(efetivo), '#ffe9a0', { tamanho: 22, desvio: 10 })
    this.atualizarChefe()
    return efetivo
  },

  // a barra (embaixo do HP) e as estrelinhas do atordoado: a arena chama no atualizarChefe dela
  atualizarCoop2Chefe({ animado = true } = {}) {
    const c = this.estado.chefe
    this.barraQuebra?.atualizar(c.quebra ?? 0, c.quebraMax ?? 100, { atordoado: Boolean(c.atordoado), animado })
    this.mostrarAtordoado(atordoadoAgora(this.estado))
  },

  // a prévia da próxima carta (some quando o quadro abre e volta depois do contra-ataque)
  atualizarPreviaChefe() {
    this.previaChefe?.mostrar(previaCoop(this.estado))
  },

  // estrelinhas girando em cima do chefe enquanto ele está atordoado
  mostrarAtordoado(sim) {
    if (!this.inimigo) return
    if (sim && !this.marcaAtordoado) {
      const c = this.add.container(this.chefePos.x, this.chefePos.y - 50).setDepth(29)
      const estrela = () => this.add.text(0, 0, '★', { fontFamily: FONTE, fontSize: '14px', color: corTexto(COR_ATORDOADO), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
      const estrelas = [estrela(), estrela(), estrela()]
      c.add(estrelas)
      const giro = { t: 0 }
      const posicionar = () => estrelas.forEach((e, k) => e.setPosition(Math.cos(giro.t + (k * Math.PI * 2) / 3) * 26, Math.sin(giro.t + (k * Math.PI * 2) / 3) * 7))
      posicionar()
      this.tweens.add({ targets: giro, t: Math.PI * 2, duration: 1400, repeat: -1, onUpdate: posicionar })
      this.marcaAtordoado = { c, giro }
      this.inimigo.sprite.setTint(0xfff0a0)
    } else if (!sim && this.marcaAtordoado) {
      this.tweens.killTweensOf(this.marcaAtordoado.giro)
      this.marcaAtordoado.c.destroy()
      this.marcaAtordoado = null
      this.inimigo.sprite.clearTint()
    }
  },

  // CO-OP 2.0 na abertura: o cartão COMO FUNCIONA (só na primeira luta deste PC) e o banner da regra do chefe
  async aberturaCoop2() {
    if (this.saindo) return
    await mostrarComoFunciona(this, {
      aoA: (fechar) => {
        this.comoFunciona = fechar
        return () => (this.comoFunciona = null)
      },
      maxMs: this.rede ? 7000 : 15000,
    })
    if (this.saindo) return
    const def = this.regra?.def
    if (def) {
      tocar(this, 'tensao')
      this.mostrarBanner(semLigaduras(def.nome), corTexto(this.defChefe.tema.cor), { y: 226, tamanho: 24, ms: 1900 })
      this.etiquetaEm(LARGURA / 2, 256, semLigaduras(def.descricao), '#ffffff', { atraso: 200, tamanho: 11, ms: 1900 })
      await this.esperar(2200)
    }
    this.regra?.comecar()
  },

  // carta de dupla: o nome grande no meio e a linha do que ela faz
  async anunciarDupla(id, { ms = 1100 } = {}) {
    const d = DUPLAS[id]
    if (!d) return
    this.registrar(`dupla:${id}`)
    tocar(this, 'combo')
    flashTela(this, 0x7fd8ff, 0.2, 200)
    this.mostrarBanner(semLigaduras(`${d.nome}!`), '#9be7ff', { y: 226, tamanho: 26, ms })
    this.etiquetaEm(LARGURA / 2, 256, semLigaduras(`${d.simbolos}: ${d.curto}`), '#ffffff', { atraso: 150, tamanho: 11, ms })
    this.dicasCoop.mostrar('duplas', 'Carta de dupla! Combinem naipes na mesma rodada (a lista está no GUIA).')
    await this.esperar(ms - 200)
  },

  // as cartas de dupla da revelação (BARREIRA): a quebra que elas deram e o nome grande
  async duplasDaRevelacao(r) {
    for (const d of r.duplas ?? []) {
      await this.esperar(500)
      if (this.saindo) return
      if (d.quebra?.ganho) this.barraQuebra.ganhou(d.quebra.ganho)
      if (d.quebra?.quebrou) this.quebraParaAnunciar = true
      await this.anunciarDupla(d.id)
    }
  },

  // a barra encheu: QUEBROU! (na próxima rodada ele fica atordoado)
  async anunciarQuebrou() {
    this.quebraParaAnunciar = false
    this.registrar('quebrou')
    const { x, y } = this.chefePos
    tocar(this, 'quebrar')
    flashTela(this, COR_ATORDOADO, 0.35, 260)
    shake(this, 320, 0.016)
    this.inimigo.dano(0.9)
    particulas(this, x, y - 20, { cor: COR_ATORDOADO, quantidade: 34, velocidade: 260, vida: 800 })
    this.mostrarBanner('QUEBROU!', corTexto(COR_ATORDOADO), { y: 236, tamanho: 36, ms: 1100 })
    this.etiquetaEm(LARGURA / 2, 270, semLigaduras('na próxima rodada ele fica ATORDOADO'), '#ffffff', { atraso: 200, tamanho: 11, ms: 1100 })
    this.atualizarChefe()
    this.atualizarPreviaChefe()
    await this.esperar(1300)
  },

  // começo da rodada ATORDOADO: ele não joga carta nesta rodada
  async anunciarAtordoado() {
    this.registrar('atordoado')
    this.atualizarPreviaChefe() // (a prévia passa a mostrar a carta de depois dele)
    tocar(this, 'tensao')
    this.mostrarBanner('ATORDOADO!', corTexto(COR_ATORDOADO), { y: 236, tamanho: 32, ms: 1200 })
    this.etiquetaEm(LARGURA / 2, 268, semLigaduras(`ele não ataca: batam com tudo (x${String(QUEBRA.danoAtordoado).replace('.', ',')})!`), '#ffffff', { atraso: 200, tamanho: 11, ms: 1200 })
    this.dicasCoop.mostrar('atordoado', 'Chefe ATORDOADO: sem ataque nesta rodada, e ela fecha com a FINALIZAÇÃO EM DUPLA!', { ms: 3400 })
    await this.esperar(1400)
  },

  // ---------- resgate na hora ----------

  // o coração de j quebrou: fica a alma dele no quadro (se tem parceiro de pé no quadro para buscar)
  deixarAlma(j) {
    const coracao = this.quadro.coracoes[j]
    const q = this.rodadaAtual?.quadro
    const n = this.vagasCoop2()
    let parceiro = false
    for (let k = 0; k < n; k++) if (k !== j && q?.jogadores[k] && !this.ko[k] && this.quadro.coracoes[k]?.ativo) parceiro = true
    if (!coracao?.ativo || !parceiro || !this.quadro.rodando) return
    const p = posicaoDaAlma(coracao.x, coracao.y, this.quadro.caixa.limites)
    this.almas.adicionar(j, p.x, p.y)
    this.registrar(`alma:${j}`)
    this.sincronizarAlmas()
    this.dicasCoop.mostrar('alma', 'Encoste na alma para levantar o parceiro!')
  },

  sincronizarAlmas() {
    const cores = Array.from({ length: this.vagasCoop2() }, (_, j) => this.corDoJogador(j))
    this.visualAlmas.sincronizar(this.almas.lista, cores, RESGATE.raio, RESGATE.tempoMs)
  },

  // todo frame da esquiva (coop/resgate.js): só este PC completa o resgate do coração que é dele (em rede,
  // o dos outros chega pela mensagem `resgate`)
  atualizarResgates(delta) {
    if (this.fase !== 'esquiva' || !this.almas?.lista.length) return
    const coracoes = this.quadro.coracoes.map((c, j) => ({ j, x: c.x, y: c.y, ativo: c.ativo && !this.ko[j] && this.noQuadro(j) }))
    const feitos = this.almas.atualizar(delta, coracoes, { podeCompletar: (j) => this.souDonoDoCoracao(j) })
    this.sincronizarAlmas()
    for (const { alvo, quem } of feitos) if (this.aplicarResgate(quem, alvo)) this.rede?.enviarResgate(quem, alvo)
  },

  // `quem` levantou `alvo` na hora (daqui, ou de outro PC pela rede): HP, o coração volta piscando onde a alma
  // estava, o golpe dele volta a valer e a QUEBRA enche
  aplicarResgate(quem, alvo) {
    const alma = this.almas.lista.find((a) => a.alvo === alvo)
    const res = resgatarNaHora(this.estado, alvo, quem)
    if (!res.ok) return false
    this.registrar(`resgate:${quem}>${alvo}`)
    this.almas.remover(alvo)
    this.sincronizarAlmas()
    this.ko[alvo] = false
    const coracao = this.quadro.coracoes[alvo]
    const l = this.quadro.caixa.limites
    const p = alma ?? { x: l.centerX, y: l.centerY }
    if (this.fase === 'esquiva' && this.quadro.rodando && coracao) {
      coracao.mostrar(p.x, p.y)
      coracao.tomarDano(RESGATE.invencivelMs)
    }
    tocar(this, 'cura')
    particulas(this, p.x, p.y, { cor: 0x7dff9a, quantidade: 26, velocidade: 180 })
    this.etiquetaEm(l.centerX, l.y - 12, semLigaduras(`${this.nomeCurto(quem)} LEVANTOU ${this.nomeCurto(alvo)}!`), TEXTO.cura, { tamanho: 14, ms: 1200 })
    const aviso = this.avisoDe(alvo)
    aviso?.setText('DE PÉ!').setColor(TEXTO.cura)
    this.time.delayedCall(900, () => this.fase === 'esquiva' && aviso?.scene && aviso.text === 'DE PÉ!' && aviso.setText(''))
    this.huds[alvo].setHp(this.estado.jogadores[alvo].hp)
    this.atualizarCaidos()
    const armada = this.armadas[alvo]
    if (armada) {
      armada.setIndisponivel?.(false)
      armada.carga?.setText(String(this.rodadaAtual?.golpes[alvo]?.base ?? '')).setColor('#ffd23c')
    }
    this.barraQuebra.ganhou(QUEBRA.resgate)
    this.atualizarChefe()
    if (res.quebrou) this.quebraParaAnunciar = true
    return true
  },

  // a esquiva começou / acabou: almas e itens da regra
  comecarEsquivaCoop2(q) {
    this.almas.limpar()
    this.visualAlmas.limpar()
    this.regra.comecarEsquiva({ carta: q.carta })
  },

  terminarEsquivaCoop2() {
    this.regra.terminarEsquiva()
    this.almas.limpar()
    this.visualAlmas.limpar()
  },

  // todo frame do quadro (depois dos corações andarem)
  atualizarCoop2NoQuadro(delta) {
    if (this.fase !== 'esquiva' || !this.quadro.rodando) return
    this.atualizarResgates(delta)
    this.regra?.atualizar(delta)
  },

  // ---------- depois dos golpes do contra-ataque ----------

  // a QUEBRA da rodada (já somada no estado), o QUEBROU! e, na rodada ATORDOADO, a FINALIZAÇÃO EM DUPLA
  async fecharContraCoop2({ quebra = null, finalizacao = null, curas = null } = {}) {
    // (Expedição) as curas das relíquias (LAÇO DE AMIZADE, PRESA DE VAMPIRO): o HP já está no estado
    if (curas?.length) {
      for (const { j, hp } of curas) {
        const p = this.personagens?.[j]
        if (p) this.etiquetaEm(p.x, p.y - 70, `+${hp}`, TEXTO.cura ?? '#7dff9a', { tamanho: 14, ms: 1000 })
      }
      tocar(this, 'cura')
      this.atualizarHuds?.()
      this.registrar(`curaReliquia:${curas.map((c) => `${c.j}+${c.hp}`).join(',')}`)
    }
    if (quebra?.total) {
      this.barraQuebra.ganhou(quebra.total)
      this.dicasCoop.mostrar('quebra', 'Batam juntos e acertem CRÍTICOS para encher a QUEBRA!')
    }
    this.atualizarChefe()
    if (quebra?.quebrou) this.quebraParaAnunciar = true
    if (this.quebraParaAnunciar && this.estado.chefe.hp > 0) await this.anunciarQuebrou()
    if (this.saindo) return
    if (finalizacao && this.estado.chefe.hp > 0) await this.finalizar(finalizacao)
    if (this.saindo) return
    this.atualizarPreviaChefe()
  },

  // FINALIZAÇÃO EM DUPLA (coop2Cena.js): os de pé batem juntos no chefe atordoado
  async finalizar({ dano, jogadores }) {
    this.registrar(`finalizacao:${dano}`)
    const personagens = jogadores.map((j) => {
      const p = this.personagens[j]
      return { textura: this.ids[j], x: p.x, y: p.y, flip: Boolean(p.direita ?? j === 1), escala: p.sprite.scaleX, cor: this.corDoJogador(j) }
    })
    const titulo = jogadores.length === 1 ? 'FINALIZAÇÃO!' : jogadores.length === 2 ? 'FINALIZAÇÃO EM DUPLA!' : 'FINALIZAÇÃO EM GRUPO!'
    await finalizacaoEmDupla(this, {
      personagens,
      chefe: this.chefePos,
      dano,
      titulo,
      aoImpacto: () => {
        const efetivo = aplicarGolpe(this.estado, dano)
        jogadores.forEach((j) => (this.estatisticas[j].danoCausado += Math.round(efetivo / jogadores.length)))
        this.inimigo.dano(1)
        this.atualizarChefe()
      },
    })
  },

  // a CPU aliada (só na CoopArena): a alma do parceiro (resgate) ou o item da regra
  alvoDaCpu(cpu) {
    const alma = this.almas?.lista.find((a) => a.alvo !== cpu)
    if (alma) return { x: alma.x, y: alma.y, raio: RESGATE.raio * 0.6 }
    const item = this.regra?.alvoDoBot(cpu)
    return item ? { x: item.x, y: item.y } : null
  },

  // (dev) a barra de QUEBRA neste valor; cheia, o chefe fica atordoado na próxima rodada (vale em todos os PCs)
  setQuebra(valor) {
    this.rede?.espalhar('setQuebra', [valor])
    const c = this.estado.chefe
    c.quebra = Math.max(0, Math.min(c.quebraMax, valor))
    if (c.quebra >= c.quebraMax && !c.atordoado) {
      c.atordoado = true
      c.atordoadoEm = null
    }
    this.atualizarChefe()
    this.atualizarPreviaChefe()
  },

  // o que o estadoDebug() de cada arena junta
  debugCoop2() {
    const c = this.estado.chefe
    return {
      proxima: c.proxima?.id ?? null,
      quebra: c.quebra,
      quebraMax: c.quebraMax,
      atordoado: c.atordoado,
      atordoadoEm: c.atordoadoEm,
      previa: previaCoop(this.estado),
      almas: (this.almas?.lista ?? []).map((a) => ({ alvo: a.alvo, x: Math.round(a.x), y: Math.round(a.y), progresso: Math.round(a.progresso), quem: a.quem })),
      regra: this.regra?.def?.id ?? null,
      itensRegra: (this.regra?.itensVivos ?? []).map((i) => ({ id: i.id, x: Math.round(i.x), y: Math.round(i.y) })),
      log: [...this.logCoop2],
    }
  },
}

export function ligarCoop2(Cena) {
  for (const [nome, fn] of Object.entries(METODOS_COOP2)) Object.defineProperty(Cena.prototype, nome, { value: fn, writable: true, configurable: true })
  return Cena
}
