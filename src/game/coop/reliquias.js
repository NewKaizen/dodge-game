// RELÍQUIAS e a luta que CONTINUA (a EXPEDIÇÃO, coop/expedicao.js: 3 lutas seguidas, lacaios -> tenente ->
// chefão; entre elas o time vota 1 de 3 melhorias e recupera um pouco de HP). Lógica pura.
//
// criarPartidaCoop aceita (coop/regras.js):
//   hp: [hp do P1, hp do P2, ...]     o HP que vem da luta anterior (null = cheio; 0 ou menos começa com 1)
//   reliquias: ['id', ...]            as melhorias ativas (ids de RELIQUIAS; desconhecido é ignorado)
// e guarda no estado:
//   estado.reliquias                  os ids ativos (só leitura; a tela pode listar)
//   estado.mods                       os números que as regras leem (1 = nada muda; 0 = nada a mais):
//     golpe          multiplica o dano de todo golpe dos jogadores (calcularGolpes: aparece como RELÍQUIA)
//     naipe          { espadas, paus, ouros }: multiplica o golpe daquele naipe (calcularGolpes)
//     critico        multiplica o fator do CRÍTICO (COOP.critico)
//     atordoado      multiplica o fator dos golpes no chefe ATORDOADO (QUEBRA.danoAtordoado)
//     finalizacao    multiplica o dano da FINALIZAÇÃO EM DUPLA (coop2.js finalizacaoDaDupla)
//     quebra         multiplica os pontos que entram na barra de QUEBRA (somarQuebra)
//     danoQuadro     multiplica o dano por acerto do ataque do chefe no quadro
//     energiaInicial soma na energia da 1ª rodada
//     retornoHp      quem levanta (resgate, volta sozinho, rodada limpa) volta com esta fração (null = COOP.retornoHp)
//     curaGraze      cada graze de um jogador cura isto no parceiro com menos HP (resolverContraCoop)
//     curaCritico    cada CRÍTICO cura isto em quem bateu (resolverContraCoop)
//     curaMax        teto da cura das relíquias por jogador por rodada
//
// Uma relíquia: { id, nome, descricao (UMA frase curta, aparece na carta), tipo, icone, cor, aplicar(estado) } —
// aplicar roda UMA vez, no fim do criarPartidaCoop, e mexe em estado.mods. As relíquias se ACUMULAM (a Expedição
// passa todas as escolhidas) e não se repetem (a oferta nunca mostra uma que o time já tem).
// tipo: 'ataque' | 'defesa' | 'equipe' (a CPU aliada usa para votar: defesa quando o time está machucado).
// Como tudo vai por id e roda no criarPartidaCoop, a luta em rede continua determinística: os dados da cena
// levam { hp, reliquias } e cada PC monta igual.
export const MODS_PADRAO = () => ({
  golpe: 1,
  naipe: { espadas: 1, paus: 1, ouros: 1 },
  critico: 1,
  atordoado: 1,
  finalizacao: 1,
  quebra: 1,
  danoQuadro: 1,
  energiaInicial: 0,
  retornoHp: null,
  curaGraze: 0,
  curaCritico: 0,
  curaMax: 8,
})

const r = (id, nome, descricao, tipo, icone, cor, aplicar) => ({ id, nome, descricao, tipo, icone, cor, aplicar })

export const RELIQUIAS = {
  amuleto: r('amuleto', 'AMULETO DA DUPLA', 'A barra de QUEBRA enche 25% mais rápido.', 'equipe', '★', 0xffa040, (e) => (e.mods.quebra *= 1.25)),
  lamina: r('lamina', 'LÂMINA AFIADA', 'Seu ♠ dá +20% de dano.', 'ataque', '♠', 0x9ad0ff, (e) => (e.mods.naipe.espadas *= 1.2)),
  trevo: r('trevo', 'TREVO DE PAUS', 'Sua armadilha de ♣ dá +25% de dano.', 'ataque', '♣', 0x70e070, (e) => (e.mods.naipe.paus *= 1.25)),
  diamante: r('diamante', 'DIAMANTE BRUTO', 'Seu ♦ dá +25% de dano.', 'ataque', '♦', 0xff8080, (e) => (e.mods.naipe.ouros *= 1.25)),
  forca: r('forca', 'LUVA DE FERRO', 'Todo golpe do time dá +10% de dano.', 'ataque', '+10%', 0xd0a060, (e) => (e.mods.golpe *= 1.1)),
  mira: r('mira', 'OLHO DE ÁGUIA', 'O CRÍTICO bate 20% mais forte.', 'ataque', 'CRIT', 0xffe060, (e) => (e.mods.critico *= 1.2)),
  estrelinhas: r('estrelinhas', 'ESTRELINHAS', 'Chefe ATORDOADO leva o dobro nos golpes.', 'ataque', '✦✦', 0xffe9a0, (e) => (e.mods.atordoado *= 2 / 1.5)),
  martelo: r('martelo', 'MARTELO DE DUPLA', 'A FINALIZAÇÃO tira o dobro de HP.', 'equipe', 'x2', 0xff9a40, (e) => (e.mods.finalizacao *= 2)),
  casca: r('casca', 'CASCA GROSSA', 'O ataque do chefe tira 15% menos.', 'defesa', '-15%', 0x80c0ff, (e) => (e.mods.danoQuadro *= 0.85)),
  bateria: r('bateria', 'BATERIA EXTRA', 'Comecem cada luta com +2 de energia.', 'equipe', '+2', 0xfff060, (e) => (e.mods.energiaInicial += 2)),
  fenix: r('fenix', 'PENA DE FÊNIX', 'O resgate levanta com 50% do HP.', 'defesa', '♥50%', 0xff7050, (e) => (e.mods.retornoHp = Math.max(e.mods.retornoHp ?? 0, 0.5))),
  laco: r('laco', 'LAÇO DE AMIZADE', 'Grazes curam o parceiro.', 'defesa', '♥♥', 0xff80c0, (e) => (e.mods.curaGraze += 1)),
  vampiro: r('vampiro', 'PRESA DE VAMPIRO', 'Cada CRÍTICO cura 4 HP de quem bateu.', 'defesa', '♥+4', 0xc070ff, (e) => (e.mods.curaCritico += 4)),
}

// as que a Expedição sorteia (o 'amuleto' fica também: é a de exemplo e uma das boas)
export const IDS_RELIQUIAS = Object.keys(RELIQUIAS)

export function aplicarReliquias(estado, ids = []) {
  estado.mods = MODS_PADRAO()
  estado.reliquias = []
  for (const id of ids ?? []) {
    const rel = typeof id === 'object' ? id : RELIQUIAS[id]
    if (!rel || estado.reliquias.includes(rel.id)) continue
    rel.aplicar?.(estado)
    estado.reliquias.push(rel.id)
  }
  return estado
}

// As curas das relíquias no fim do contra-ataque (LAÇO DE AMIZADE e PRESA DE VAMPIRO). desempenho[j] =
// { perfeito, grazes } da rodada. Só quem está de pé recebe; cada um no máximo mods.curaMax por rodada.
// Devolve [{ j, hp }] (o que curou de verdade) e já aplica no estado.
export function curasDasReliquias(estado, desempenho = []) {
  const m = estado.mods
  if (!m || (!m.curaGraze && !m.curaCritico)) return []
  const jog = estado.jogadores
  const dePe = (j) => jog[j] && !jog[j].caido && !jog[j].saiu && !jog[j].ausente
  const somar = new Map()
  const mais = (j, hp) => hp > 0 && dePe(j) && somar.set(j, (somar.get(j) ?? 0) + hp)
  desempenho.forEach((d, j) => {
    if (!d) return
    if (m.curaCritico && d.perfeito && dePe(j)) mais(j, m.curaCritico)
    if (m.curaGraze && d.grazes > 0) {
      // o parceiro de pé com menos HP (fração); sem parceiro de pé, ninguém
      const outros = jog.map((_, k) => k).filter((k) => k !== j && dePe(k))
      if (!outros.length) return
      const alvo = outros.sort((a, b) => jog[a].hp / jog[a].hpMax - jog[b].hp / jog[b].hpMax || a - b)[0]
      mais(alvo, Math.min(d.grazes, 6) * m.curaGraze)
    }
  })
  const curas = []
  for (const [j, hp] of [...somar.entries()].sort((a, b) => a[0] - b[0])) {
    const antes = jog[j].hp
    jog[j].hp = Math.min(jog[j].hpMax, antes + Math.min(hp, m.curaMax))
    if (jog[j].hp > antes) curas.push({ j, hp: jog[j].hp - antes })
  }
  return curas
}

// Convidado em rede: as curas que o host calculou (o estado inteiro chega no fimRodada; isto só adianta)
export function aplicarCurasDoContra(estado, curas) {
  for (const c of Array.isArray(curas) ? curas : []) {
    const jog = estado.jogadores[c?.j]
    if (!jog || jog.caido || !(c.hp > 0)) continue
    jog.hp = Math.min(jog.hpMax, jog.hp + c.hp)
  }
}
