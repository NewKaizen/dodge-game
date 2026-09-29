import Phaser from 'phaser'
import { NIVEIS, ATAQUE, FONTE, LARGURA } from '../constants.js'
import { ataques } from '../attacks/index.js'
import { juntos, sequencia, comCaixa } from '../attacks/definir.js'
import { shake } from '../effects/shake.js'

// Nível da luta (FÁCIL / MÉDIO / DIFÍCIL, escolhido na tela Dificuldade).
// Os números ficam em NIVEIS (constants.js); aqui só o que o nível FAZ na
// batalha além de multiplicar: a camada de caos, o tremor e a etiqueta.

// Nível gravado no registry (padrão FÁCIL)
export function nivelDe(registry, id) {
  const chave = NIVEIS[id] ? id : NIVEIS[registry.get('nivel')] ? registry.get('nivel') : 'facil'
  return { id: chave, ...NIVEIS[chave] }
}

// Sorteia se este turno vem com caos. Gerador próprio (semente fixa por
// chefe e nível) para não mexer na sorte do resto da batalha.
export function sortearCaos(cena, nivel) {
  if (!nivel.caos) return false
  cena.rngCaos ??= new Phaser.Math.RandomDataGenerator([`${ATAQUE.semente}:caos:${cena.idChefe}:${nivel.id}`])
  return cena.rngCaos.frac() < nivel.caos.chance
}

// Mesmo ataque com uma camada de caos junto: tiros mirados leves, espaçados,
// na caixa que o ataque já usa. Em `sequencia` a camada vai em cada onda
// (cada uma na sua caixa); fora isso vira juntos(ataque, extra) mantendo a
// caixa do ataque.
export function comCaos(ataque, caos) {
  if (ataque.filhos) return sequencia(...ataque.filhos.map((filho) => comCaos(filho, caos)))
  const ativa = ataque.ativa ?? ataque.duracao
  const extra = ataques.aimed({
    duracao: ativa,
    intervalo: caos.intervalo,
    velocidade: caos.velocidade,
    rajada: caos.rajada,
    raio: 6,
    caixa: null,
  })
  const nome = ataque.nome
  const junto = comCaixa(ataque.caixa, juntos(ataque, extra))
  return Object.assign(junto, { nome: `${nome} + caos` })
}

// Começo do turno inimigo: tremor e pulso vermelho na tela; quando o turno
// vem com caos a etiqueta do nível pisca
export function abrirTurno(cena, nivel, caos) {
  if (nivel.tremor) {
    shake(cena, 220, nivel.tremor)
    cena.cameras.main.flash(140, 255, 40, 70, true)
  }
  const t = cena.etiquetaNivel
  if (caos && t) {
    cena.tweens.killTweensOf(t)
    t.setScale(1)
    cena.tweens.add({ targets: t, scale: 1.5, duration: 140, yoyo: true, repeat: 2 })
  }
}

// Etiqueta fixa no canto com o nível da luta (não aparece no FÁCIL)
export function criarEtiquetaNivel(cena, nivel) {
  if (!nivel.caos) return null
  const t = cena.add
    .text(LARGURA - 8, 6, nivel.rotulo, { fontFamily: FONTE, fontSize: '14px', color: nivel.cor, stroke: '#000000', strokeThickness: 3 })
    .setOrigin(1, 0)
    .setDepth(30)
    .setAlpha(0.85)
  cena.cameraCaixa?.ignore(t)
  cena.etiquetaNivel = t
  return t
}
