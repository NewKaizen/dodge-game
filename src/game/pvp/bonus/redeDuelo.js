import { criarInterpolador, ouvirRodada, agoraMs } from './redeMinigame.js'

// O DUELO em rede (docs/rede-pvp.md, "Duelo e CTRL+C CTRL+V"): cada PC simula o
// PRÓPRIO coração (movimento, i-frames, empurrão) e manda a posição; o do outro
// anda pelas posições que chegam (interpolado). As armas de cada um saem na
// hora no PC dele e viram RÉPLICA no outro (mesmos parâmetros, só enfeite lá).
//
// Quem decide é a VÍTIMA: cada PC confere golpes só no coração daqui (decide(j)),
// inclusive das réplicas das armas do outro, e chama arena.acertou(meuLado, dano)
// (a arena manda o dano para o outro PC). O aparo da espada é de quem segura a
// espada (ela protege o dono: ele é a vítima dos tiros/bumerangue que apara):
// a espada daqui quebra as réplicas e avisa (dueloRebate) o dono da arma, que
// quebra/vira a de verdade. A espada-réplica do outro não apara nada aqui.
//
// Mensagens (chave = rodada; as rápidas levam `r` = rodada nos dados):
//   dueloPronto              {}                         abri a caixa (os dois começam o 3-2-1 juntos)
//   dueloCoracao (rápida)    { r, t, x, y, vx, vy }     meu coração, ~30/s (t: meu relógio)
//   dueloAtaque              { arma, id, ... }          ataquei (Duelo.js: atirar/golpear/... devolvem isto)
//   dueloDano                { de, dano, x, y, ref }    levei este golpe (ref: id do tiro/golpe que acertou);
//                                                       só enfeite e placar do duelo: o HP vai pela arena
//   dueloRebate              { id, tipo, x, y }         minha espada quebrou o seu tiro / virou o seu bumerangue
//   dueloFim                 { motivo }                 a luta acabou para mim ('tempo' | 'ko')
//
//   const rede = new RedeDuelo(duelo, { canal, meuLado, rodada })
//   rede.decide(j)                 true: o coração j é daqui (colisões e aparos dele são daqui)
//   await rede.sincronizarInicio() manda dueloPronto e espera o do outro (timeout)
//   rede.atualizar(c) / moverOutro(c)   todo frame: manda o meu, anda o do outro
//   rede.ataquei(a) / leveiGolpe(d) / rebati(d) / acabei(motivo)
//   await rede.esperarFimDoOutro() o dueloFim do outro (timeout): depois dele já
//                                  chegou todo o dano que ele levou
//   rede.desligar()                para de ouvir (solta as esperas)

export const REDE_DUELO = {
  envioMs: 33, // ~30 posições por segundo
  atrasoMs: 60, // o coração do outro é desenhado no mínimo este tanto no passado (mais, se a rede varia: redeMinigame.js)
  prontoMs: 10000, // espera máxima pelo dueloPronto do outro
  fimMs: 6000, // espera máxima pelo dueloFim do outro (depois do meu)
}

const arredondar = (v) => Math.round(v * 10) / 10

export class RedeDuelo {
  constructor(duelo, { canal, meuLado, rodada }, cfg = REDE_DUELO) {
    this.duelo = duelo
    this.canal = canal
    this.meuLado = meuLado
    this.outroLado = 1 - meuLado
    this.rodada = rodada
    this.cfg = cfg
    this.interp = criarInterpolador({ atrasoMs: cfg.atrasoMs })
    this.ultimoEnvio = -Infinity
    this.fimEnviado = false
    this.ouvindo = ouvirRodada(canal, rodada, {
      dueloAtaque: (d) => duelo.replicarAtaque(this.outroLado, d),
      dueloDano: (d) => duelo.danoNoOutro(d),
      dueloRebate: (d) => duelo.rebatido(d),
      dueloFim: (d) => duelo.fimDoOutro(d),
    })
    this.pararPosicoes = canal.ao('dueloCoracao', (d) => {
      if (d?.r === rodada) this.interp.adicionar(d, agoraMs())
    })
  }

  decide(j) {
    return j === this.meuLado
  }

  sincronizarInicio() {
    this.canal.enviar('dueloPronto', this.rodada, {})
    return this.ouvindo.esperarCorreio('dueloPronto', this.cfg.prontoMs)
  }

  // meu coração para o outro PC (no relógio de verdade: na câmera lenta do
  // K.O. o coração anda devagar lá também, porque anda devagar aqui)
  atualizar(c) {
    const agora = agoraMs()
    if (!c || agora - this.ultimoEnvio < this.cfg.envioMs) return
    this.ultimoEnvio = agora
    this.canal.enviarRapido('dueloCoracao', { r: this.rodada, t: Math.round(agora), x: arredondar(c.x), y: arredondar(c.y), vx: Math.round(c.vx), vy: Math.round(c.vy) })
  }

  // o coração do outro: onde ele estava um pouquinho atrás (nada chegou: fica parado)
  moverOutro(c) {
    const p = this.interp.posicao(agoraMs())
    if (!p) return
    c.x = p.x
    c.y = p.y
    c.vx = p.vx
    c.vy = p.vy
  }

  ataquei(ataque) {
    this.canal.enviar('dueloAtaque', this.rodada, ataque)
  }

  leveiGolpe(dados) {
    this.canal.enviar('dueloDano', this.rodada, dados)
  }

  rebati(dados) {
    this.canal.enviar('dueloRebate', this.rodada, dados)
  }

  acabei(motivo) {
    if (this.fimEnviado) return
    this.fimEnviado = true
    this.canal.enviar('dueloFim', this.rodada, { motivo })
  }

  esperarFimDoOutro() {
    return this.ouvindo.esperar('dueloFim', this.cfg.fimMs)
  }

  desligar() {
    this.ouvindo.desligar()
    this.pararPosicoes()
  }

  estadoDebug() {
    return { meuLado: this.meuLado, rodada: this.rodada, amostras: this.interp.quantas, atraso: this.interp.atraso === null ? null : Math.round(this.interp.atraso), fimDoOutro: this.ouvindo.recebida('dueloFim') }
  }
}
