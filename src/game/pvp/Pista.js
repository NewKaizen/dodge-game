import { ATAQUE, CORACAO, CORES, TEMPOS } from '../constants.js'
import BattleBox from '../entities/BattleBox.js'
import Balas from '../entities/Bullets.js'
import Heart from '../entities/Heart.js'
import ContextoAtaque from '../attacks/contexto.js'
import { preparoCaixa } from '../attacks/definir.js'
import { novaRodada, validarEspacoLivre } from '../attacks/validacao.js'
import { particulas } from '../effects/particulas.js'
import { tocar } from '../audio.js'

// Pista: UMA caixa de esquiva completa (caixa + balas + coração + contexto
// de ataque), para existir várias na mesma cena (modo PvP: cada jogador
// desvia na sua pista do ataque que o outro jogou). Cada pista tem a sua
// câmera de recorte (a da BattleBox) e as câmeras não desenham os objetos
// umas das outras (recorte.js).
//
//   const pista = new Pista(cena, { x, y, largura, altura, jogador, cor, tema, velocidadeMax, velocidade, dinamica })
//     x, y              centro da caixa padrão (mundo 640x480)
//     largura, altura   tamanho padrão; as formas dos ataques escalam com ele
//     jogador           dono do coração (número) ou lista de jogadores
//     cor               cor do coração (padrão CORES.almas[jogador]) e da borda
//     tema              formas/cores de bala (como defChefe.tema)
//     velocidadeMax     limite de velocidade das balas (px/s)
//     velocidade        px/s do coração (padrão: registry 'velocidade', o do painel)
//     dinamica          limites da caixa dinâmica (ver BattleBox); por padrão a
//                       caixa pode crescer até 40px para cada lado da padrão.
//                       Pistas vizinhas: passe dinamica.campo (região onde a
//                       caixa pode ficar) sem cruzar o campo da outra
//
//   pista.mostrar()                      abre a caixa e põe o coração nela (Promise)
//   pista.esconder()                     fecha a caixa (Promise)
//   pista.rodar(ataque, { dano, ritmo, semente })
//       Promise que resolve quando o ataque termina: preparo da caixa (se o
//       ataque pede outra forma), respiros, o ataque e a volta da caixa ao
//       padrão. Abre a caixa antes, se estiver fechada. Uma por vez: um
//       rodar() novo interrompe o anterior (a Promise do anterior resolve).
//   pista.parar()                        interrompe o ataque em andamento (a Promise resolve)
//   pista.atualizar(dt, joy)             todo frame; joy = {x, y} (-100..100) do dono,
//                                        ou função (jogador) => {x, y} se a pista tem vários corações
//   pista.aoAcertar = (dano, bala, coracao) => {}   devolva false para o acerto não contar
//   pista.aoGraze = (coracao, bala) => {}
//   pista.destruir()
//
//   pista.caixa (BattleBox), pista.balas (Balas), pista.coracoes (Heart[]), pista.rodando
export default class Pista {
  constructor(cena, { x, y, largura, altura, jogador = 0, cor, tema = {}, velocidadeMax = Infinity, velocidade, dinamica } = {}) {
    this.cena = cena
    this.jogadores = [jogador].flat()
    this.tema = tema
    this.velocidade = velocidade // px/s do coração (padrão: registry 'velocidade')
    // a caixa só muda de forma dentro do seu campo (padrão: 40px em volta da
    // caixa padrão); pistas vizinhas devem passar campos que não se cruzam
    const folga = 40
    const campo = dinamica?.campo ?? { esquerda: x - largura / 2 - folga, direita: x + largura / 2 + folga, topo: y - altura / 2 - folga, base: y + altura / 2 + folga }
    this.caixa = new BattleBox(cena, {
      x,
      y,
      largura,
      altura,
      cor: cor ?? CORES.caixa,
      dinamica: {
        larguraMax: Math.min(largura + folga * 2, campo.direita - campo.esquerda),
        alturaMax: Math.min(altura + folga * 2, campo.base - campo.topo),
        ...dinamica,
        campo,
      },
    })
    this.balas = new Balas(cena, this.caixa)
    this.balas.velocidadeMax = velocidadeMax
    this.coracoes = this.jogadores.map((j) => new Heart(cena, this.caixa, cor ?? CORES.almas[j] ?? CORES.almas[0], j))
    this.caixa.aoMudar = () => this.coracoes.forEach((c) => c.ativo && c.ajustar()) // a caixa empurra os corações

    this.aberta = false
    this.destruida = false
    this.ataque = null // { ctx, nome, restante, desarmado, proximaValidacao, resolver }
    this.voltando = null // resolve da volta da caixa ao padrão
    this.geracao = 0 // conta os rodar(): um rodar() antigo não mexe na caixa do novo
    this.abrindo = null // Promise da abertura em andamento (e quem a resolve)
    this.terminarAbertura = null
    this.fechando = null // idem para o fechamento
    this.terminarFechamento = null
    this.aoAcertar = null
    this.aoGraze = null
    this.ultimoGraze = 0
  }

  get rodando() {
    return this.ataque !== null
  }

  // ---------- caixa ----------

  // As Promises de mostrar/esconder sempre resolvem, mesmo quando uma
  // interrompe a outra no meio da animação (a BattleBox mata o tween anterior)
  mostrar() {
    if (this.aberta) return this.abrindo ?? Promise.resolve()
    this.terminarFechamento?.() // abrir no meio do fechamento: o esconder() termina aqui
    this.aberta = true
    this.abrindo = new Promise((resolver) => {
      this.terminarAbertura = () => {
        this.abrindo = null
        this.terminarAbertura = null
        resolver()
      }
      this.caixa.mostrar(() => {
        const l = this.caixa.limites
        this.coracoes.forEach((c, k) => c.mostrar(l.x + (l.width * (k + 1)) / (this.coracoes.length + 1), l.bottom - 30))
        this.terminarAbertura?.()
      })
    })
    return this.abrindo
  }

  esconder() {
    this.parar()
    this.voltando?.() // fechar cancela a volta ao padrão (a caixa fechada já volta)
    if (!this.aberta) return this.fechando ?? Promise.resolve()
    this.terminarAbertura?.() // fechar no meio da abertura: o mostrar() termina aqui
    this.aberta = false
    this.coracoes.forEach((c) => c.esconder())
    this.fechando = new Promise((resolver) => {
      this.terminarFechamento = () => {
        this.fechando = null
        this.terminarFechamento = null
        resolver()
      }
      this.caixa.esconder(() => this.terminarFechamento?.())
    })
    return this.fechando
  }

  // ---------- ataque ----------

  async rodar(ataque, { dano = 5, ritmo = {}, semente } = {}) {
    if (this.ataque) this.parar()
    this.voltando?.() // a volta ao padrão do ataque anterior é cancelada pela mudança deste
    const geracao = ++this.geracao
    await this.mostrar()
    if (geracao !== this.geracao || this.destruida || !this.aberta) return // outro rodar() ou esconder() enquanto a caixa abria
    novaRodada() // avisos de justiça voltam a aparecer (são por ataque)
    const r = { velocidade: 1, densidade: 1, ...ritmo }
    this.balas.fatorVelocidade = r.velocidade
    const ctx = new ContextoAtaque({
      cena: this.cena,
      balas: this.balas,
      caixa: this.caixa,
      coracoes: this.coracoes,
      tema: this.tema,
      dano,
      ritmo: r,
      semente: semente ?? `${ATAQUE.semente}:${ataque.nome}`,
      nome: ataque.nome,
    })

    // igual ao turno inimigo da Battle: se o ataque pede outra caixa, o aviso
    // e a mudança acontecem no respiro inicial e o ataque só começa depois
    const preparo = preparoCaixa(null, ataque.caixa)
    const inicio = Math.max(ATAQUE.respiroMs, preparo)
    const fim = new Promise((resolver) => {
      this.ataque = { ctx, nome: ataque.nome, restante: inicio + ataque.duracao + ATAQUE.respiroMs, desarmado: false, proximaValidacao: 0, resolver }
    })
    if (preparo) ctx.caixaPara(ataque.caixa)
    ctx.depois(inicio, () => ataque.iniciar(ctx.limitar(ataque.duracao)))
    ctx.depois(inicio + ataque.duracao, () => {
      this.balas.desarmar(ATAQUE.respiroMs)
      this.ataque.desarmado = true
    })
    await fim
    // só volta ao padrão se nenhum outro rodar() começou nesse meio tempo
    if (!this.destruida && geracao === this.geracao) await this.voltarAoPadrao()
  }

  // Termina o ataque em andamento (balas e decorações somem na hora)
  parar() {
    const at = this.ataque
    if (!at) return
    this.ataque = null
    at.ctx.limpar()
    this.balas.limpar()
    this.balas.fatorVelocidade = 1
    at.resolver()
  }

  // Caixa de volta à forma padrão (com o aviso de sempre), para o próximo ataque
  voltarAoPadrao() {
    if (!this.aberta) return Promise.resolve()
    return new Promise((resolver) => {
      const terminar = () => {
        this.voltando = null
        resolver()
      }
      this.voltando = terminar
      if (!this.caixa.mudarPara(null, { aoTerminar: terminar })) terminar()
    })
  }

  // ---------- frame ----------

  atualizar(dt, joy) {
    this.coracoes.forEach((c) => c.tick(dt))
    // passos pequenos para as balas rápidas não atravessarem o coração
    const passos = Math.max(1, Math.ceil(dt / 20))
    for (let k = 0; k < passos; k++) this.passo(dt / passos, joy)
  }

  passo(dt, joy) {
    const velocidade = this.velocidade ?? this.cena.registry.get('velocidade') ?? CORACAO.velocidadePadrao
    for (const c of this.coracoes) if (c.ativo) c.update(typeof joy === 'function' ? joy(c.jogador) : joy, velocidade, dt)

    this.caixa.atualizar(dt) // aviso/transição da caixa no mesmo relógio do ataque
    const at = this.ataque
    if (!at) return
    at.ctx.atualizar(dt)
    this.balas.atualizar(
      dt,
      this.coracoes,
      (coracao, bala) => this.acertou(coracao, bala),
      (coracao, bala) => this.grazeou(coracao, bala),
    )

    if (import.meta.env.DEV && !at.desarmado) {
      at.proximaValidacao -= dt
      if (at.proximaValidacao <= 0) {
        at.proximaValidacao = ATAQUE.validarACadaMs
        validarEspacoLivre({ padrao: at.nome, limites: this.caixa.limites, balas: this.balas, tempo: at.ctx.tempo })
      }
    }

    at.restante -= dt
    if (at.restante <= 0) this.parar()
  }

  acertou(coracao, bala) {
    if (coracao.invencivel) return false
    if (this.aoAcertar?.(bala.dano, bala, coracao) === false) return false
    coracao.tomarDano(TEMPOS.invencivelMs)
    particulas(this.cena, coracao.x, coracao.y, { cor: coracao.cor, quantidade: 10, velocidade: 110 })
    tocar(this.cena, 'dano')
    return true
  }

  grazeou(coracao, bala) {
    if (coracao.invencivel) return
    coracao.piscarGraze()
    if (this.cena.time.now - this.ultimoGraze > 70) tocar(this.cena, 'graze')
    this.ultimoGraze = this.cena.time.now
    this.aoGraze?.(coracao, bala)
  }

  destruir() {
    this.destruida = true
    this.aberta = false
    this.parar()
    this.voltando?.()
    this.terminarAbertura?.()
    this.terminarFechamento?.()
    this.balas.limpar()
    this.coracoes.forEach((c) => c.destruir())
    this.caixa.destruir()
  }
}
