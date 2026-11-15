// RELÍQUIAS e a luta que CONTINUA (para a EXPEDIÇÃO, que ainda não existe: 3 lutas seguidas, lacaios ->
// tenente -> chefão; entre elas o time vota 1 de 3 melhorias e recupera um pouco de HP). Lógica pura.
//
// criarPartidaCoop aceita (coop/regras.js):
//   hp: [hp do P1, hp do P2, ...]     o HP que vem da luta anterior (null = cheio; 0 ou menos começa com 1)
//   reliquias: ['id', ...]            as melhorias ativas (ids de RELIQUIAS; desconhecido é ignorado)
// e guarda no estado:
//   estado.reliquias                  os ids ativos (só leitura; a tela pode listar)
//   estado.mods                       os números que as regras leem (1 = nada muda):
//     golpe        multiplica o dano de todo golpe dos jogadores (calcularGolpes: aparece como RELÍQUIA)
//     quebra       multiplica os pontos que entram na barra de QUEBRA (somarQuebra)
//     danoQuadro   multiplica o dano por acerto do ataque do chefe no quadro
//     energiaInicial  soma na energia da 1ª rodada
//
// Uma relíquia: { id, nome, descricao (uma frase), aplicar(estado) } — aplicar roda UMA vez, no fim do
// criarPartidaCoop, e mexe em estado.mods (ou no HP/energia). Como tudo vai por id e roda no criarPartidaCoop,
// a luta em rede continua determinística: os dados da cena levam { hp, reliquias } e cada PC monta igual.
export const MODS_PADRAO = () => ({ golpe: 1, quebra: 1, danoQuadro: 1, energiaInicial: 0 })

export const RELIQUIAS = {
  // exemplo (os testes usam; a Expedição põe as dela aqui)
  amuleto: { id: 'amuleto', nome: 'AMULETO DA DUPLA', descricao: 'A QUEBRA enche 25% mais rápido.', aplicar: (e) => (e.mods.quebra *= 1.25) },
}

export function aplicarReliquias(estado, ids = []) {
  estado.mods = MODS_PADRAO()
  estado.reliquias = []
  for (const id of ids ?? []) {
    const r = typeof id === 'object' ? id : RELIQUIAS[id]
    if (!r) continue
    r.aplicar?.(estado)
    estado.reliquias.push(r.id)
  }
  return estado
}
