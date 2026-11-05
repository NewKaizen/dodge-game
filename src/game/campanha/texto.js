// A fonte do jogo junta "fi" e "fl" numa ligadura que, no desenho dela, parece um "A" ("Am" no lugar
// de "fim"). Nos textos corridos da campanha (minúsculas, frases inteiras) isso aparece toda hora: um
// separador invisível (ZWNJ, U+200C) entre as letras impede a ligadura sem mudar nada na tela.
export const ZWNJ = '‌'
export const semLigaduras = (s) => String(s ?? '').replace(/f(?=[ilIL])/g, `f${ZWNJ}`)
