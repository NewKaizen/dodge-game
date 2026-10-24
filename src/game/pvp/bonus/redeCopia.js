import { ouvirRodada } from './redeMinigame.js'
import { caboDaCopia } from '../bonus.js'

// O CTRL+C CTRL+V em rede (docs/rede-pvp.md, "Duelo e CTRL+C CTRL+V"): cada PC
// conta os PRÓPRIOS apertos de A (sem atraso) e manda o total; o cabo de guerra
// na tela usa os dois números (o do outro chega um pouco atrasado). Quando o
// tempo acaba (ou a barra enche) para um, ele manda o total final e o outro
// acaba na hora também. SÓ o host apura (com o total final dos dois), aplica
// copiarEnergia e manda o resultado; o convidado mostra o mesmo, sem aplicar
// regra nenhuma (a arena sincroniza o `estado` no fim da rodada).
//
// Mensagens (chave = rodada; a rápida leva `r` = rodada nos dados):
//   copiaPronto              {}                      abri a janela (os dois começam o 3-2-1 juntos)
//   copiaApertos (rápida)    { r, n }                quantos A eu apertei até agora (cumulativo)
//   copiaFinal               { apertos, motivo }     acabou para mim, com este total ('tempo' | 'cheio')
//   copiaResultado (host)    { apertos, cabo, vencedor, quantia, perdeu, ganhou, energias, motivo }
//                            energias: a energia dos dois ANTES da cópia (para a animação)
//
//   const rede = new RedeCopia(copia, { canal, meuLado, souHost, rodada })
//   await rede.sincronizarInicio()
//   rede.apertei(n) / rede.acabei(motivo, n)
//   await rede.decidir(copia)    host: espera o copiaFinal do outro, apura, aplica e manda;
//                                convidado: espera o copiaResultado (null se o host sumiu)
//   rede.desligar()

export const REDE_COPIA = {
  prontoMs: 10000, // espera máxima pelo copiaPronto do outro
  finalMs: 4000, // host: espera máxima pelo copiaFinal do convidado (depois, vale o último total que chegou)
  resultadoMs: 8000, // convidado: espera máxima pelo copiaResultado
}

export class RedeCopia {
  constructor(copia, { canal, meuLado, souHost, rodada }, cfg = REDE_COPIA) {
    this.canal = canal
    this.meuLado = meuLado
    this.outroLado = 1 - meuLado
    this.souHost = Boolean(souHost)
    this.rodada = rodada
    this.cfg = cfg
    this.fimEnviado = false
    this.ouvindo = ouvirRodada(canal, rodada, {
      copiaFinal: (d) => copia.fimDoOutro(d),
      copiaResultado: null,
    })
    this.pararApertos = canal.ao('copiaApertos', (d) => {
      if (d?.r === rodada) copia.apertosDoOutro(d.n)
    })
  }

  sincronizarInicio() {
    this.canal.enviar('copiaPronto', this.rodada, {})
    return this.ouvindo.esperarCorreio('copiaPronto', this.cfg.prontoMs)
  }

  apertei(n) {
    this.canal.enviarRapido('copiaApertos', { r: this.rodada, n })
  }

  acabei(motivo, n) {
    if (this.fimEnviado) return
    this.fimEnviado = true
    this.canal.enviar('copiaFinal', this.rodada, { apertos: n, motivo })
  }

  async decidir(copia) {
    if (!this.souHost) return resultadoValido(await this.ouvindo.esperar('copiaResultado', this.cfg.resultadoMs))
    const fim = await this.ouvindo.esperar('copiaFinal', this.cfg.finalMs)
    if (copia.parado) return null
    const apertos = [...copia.apertos]
    apertos[this.outroLado] = Math.max(apertos[this.outroLado], Number(fim?.apertos) || 0)
    const cabo = caboDaCopia(apertos, copia.cfg)
    const final = { ...copia.decidir(apertos, cabo), motivo: Math.abs(cabo) >= copia.cfg.cheio ? 'cheio' : 'tempo' }
    this.canal.enviar('copiaResultado', this.rodada, final)
    return final
  }

  desligar() {
    this.ouvindo.desligar()
    this.pararApertos()
  }
}

// o resultado que veio do host, conferido (null: não veio / veio quebrado)
export function resultadoValido(r) {
  if (!r || ![0, 1, null].includes(r.vencedor ?? null)) return null
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    apertos: [0, 1].map((j) => n(r.apertos?.[j])),
    cabo: n(r.cabo),
    vencedor: r.vencedor ?? null,
    quantia: n(r.quantia),
    perdeu: n(r.perdeu),
    ganhou: n(r.ganhou),
    energias: Array.isArray(r.energias) ? [0, 1].map((j) => n(r.energias[j])) : null,
    motivo: r.motivo === 'cheio' ? 'cheio' : 'tempo',
  }
}
