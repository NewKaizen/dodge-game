import { resumoDoIndice, paginaParaRetomar, extraParaRetomar, PAGINAS } from './progresso.js'

// As linhas do índice do Manual do Ralsei (lógica pura sobre o progresso salvo; a cena GuiaEntrada só desenha).
// As páginas 1 a 5 são o manual ESSENCIAL; as 6 a 9 são EXTRAS, marcados no índice (`extra: true`, prefixo "EXTRA",
// cor azul): oferecidos, nunca forçados.
//
//   opcoesDoIndice(progresso)   [{ rotulo, cor, cena, dica, completa?, extra?, recomecar? }]
//     CONTINUAR · PÁGINA n   a 1ª página ESSENCIAL que falta (só quando já há progresso)
//     CONTINUAR · EXTRA n    com o essencial completo, o extra que a pessoa já começou e não terminou
//     uma linha por página, com ✓ (completa), adesivos e "jogar de novo" na dica

export const DICAS_PAGINA = {
  1: 'o seu coração, as marcas e um desvio curtinho',
  2: 'ler os ataques: chuva, linha, mira e uma mistura',
  3: 'cada carta é um ataque: veja ela ganhar vida',
  4: 'energia, custo e quando passar a vez',
  5: 'uma partida de verdade contra a CPU, com dicas do Ralsei',
  6: 'extra: o que cada naipe faz, com exemplos de PVP e CO-OP',
  7: 'extra: passar raspando nas balas dá energia',
  8: 'extra: dois corações no mesmo quadro (CO-OP e tela dividida)',
  9: 'extra: carregar energia, o ★ SUPER e os quatro Ases',
}
export const COR_EXTRA = '#8fd0ff'

// as linhas do índice (lógica pura sobre o progresso salvo)
export function opcoesDoIndice(progresso) {
  const resumo = resumoDoIndice(progresso)
  const retomar = paginaParaRetomar(progresso)
  const comecou = resumo.some((r) => r.completa || r.comecada)
  const extra = extraParaRetomar(progresso)
  const linhas = []
  if (retomar && comecou) linhas.push({ rotulo: `CONTINUAR · PÁGINA ${retomar}`, cor: '#7dffa0', cena: PAGINAS[retomar - 1].cena, dica: 'volta de onde você parou' })
  else if (!retomar && extra) linhas.push({ rotulo: `CONTINUAR · EXTRA ${extra}`, cor: '#7dffa0', cena: PAGINAS[extra - 1].cena, dica: 'volta ao extra que você começou' })
  for (const r of resumo) {
    const adesivos = r.total > 1 && (r.comecada || r.completa) ? ` · adesivos: ${r.adesivos} de ${r.total}` : ''
    const prefixo = r.extra ? 'EXTRA · ' : ''
    linhas.push({ rotulo: `${prefixo}PÁGINA ${r.pagina} · ${r.titulo.toUpperCase()}`, cor: r.extra ? COR_EXTRA : '#ffd23a', cena: r.cena, completa: r.completa, extra: Boolean(r.extra), dica: `${DICAS_PAGINA[r.pagina]}${adesivos}${r.completa ? ' · jogar de novo' : ''}`, recomecar: r.completa })
  }
  return linhas
}

