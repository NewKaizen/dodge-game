// Fichas das ARENAS no Guia (scenes/Grimorio.js): uma página por arena do
// PvP com as rodadas bônus dela ("os SUPERS de cada mapa"). Tudo sai de
// pvp/arenas.js (quais eventos cada arena tem, com o nome/descrição próprios
// da arena) e de pvp/bonus.js (nome, cor, descrição de cada evento): evento
// novo aparece sozinho, evento que sumiu some daqui também. Lógica pura (sem
// Phaser), testável em Node.
//
//   PAGINAS_ARENA                    [{ id, tipo: 'arena' }] (na ordem da votação)
//   PAGINAS_GUIA                     todas as páginas do Guia (as das cartas, de fichas.js, e as das arenas)
//   fichaDaArena(id, { efeitos })    { id, nome, curto, descricao, musica, cor, frequencia, eventos, grupos }
//     eventos[k]                     ficha de cada rodada bônus da arena (ver fichaDoEvento)
//     grupos                         [{ rotulo, inicio, fim }]: primeiro os que caem em
//                                    TODAS as arenas, depois os desta arena
//   cartasDaPreviaBonus()            cartas do PvP que a prévia ao vivo (scenes/GuiaBonus.js)
//                                    sorteia para atacar nas caixas enquanto o evento roda
//
// `efeitos` (opcional) é o mapa id -> efeito de pvp/bonus/eventos/ (EFEITOS): diz
// quais eventos têm prévia ao vivo. Fica por parâmetro porque os efeitos usam Phaser.

import { ARENAS, ARENA, eventosDaArena } from '../pvp/arenas.js'
import { EVENTO, BONUS, ARMAS } from '../pvp/bonus.js'
import { CARTAS, PERSONAGENS_PVP, SIMBOLOS, ehSuper, especialDaCarta, resumoDoAtaque } from '../pvp/cartas.js'
import { PAGINAS } from './fichas.js'
import { semLigaduras } from '../campanha/texto.js'

export const PAGINAS_ARENA = ARENAS.map((a) => ({ id: a.id, tipo: 'arena' }))
// todas as páginas do Guia, na ordem do ↑/↓: cartas (personagens, chefes) e depois as arenas
export const PAGINAS_GUIA = [...PAGINAS, ...PAGINAS_ARENA]

// Como se virar em cada evento (o "como funciona" da ficha). Cada dica vale só
// enquanto o evento tiver o nome para o qual ela foi escrita (`nome`, o nome
// de EVENTOS, não o renomeado da arena): se o id for reaproveitado para outra
// coisa, a ficha fica só com a descrição em vez de mostrar uma dica errada.
const DICAS = {
  duelo: { nome: 'DUELO!', dica: null }, // montada com as armas de bonus.js (dicaDoDuelo)
  malucas: { nome: 'CARTAS MALUCAS', dica: 'Na revelação, cada carta vira outra sorteada (de qualquer personagem), mas a energia gasta é a da sua. O SUPER não muda. Carta barata arrisca menos.' },
  explosoes: { nome: 'CHUVA DE EXPLOSÕES', dica: 'As bombas miram o coração e explodem em área: quando o alvo aparecer, saia de baixo e fique longe do círculo.' },
  festa: { nome: 'MODO FESTA', dica: 'Luzes, confete e zoom no ritmo são só enfeite. Os balões que sobem pelas caixas são balas lentas: estouram se encostar.' },
  pontaCabeca: { nome: 'MUNDO DE PONTA-CABEÇA', dica: 'A tela gira 180°, mas os controles não: na tela, → leva o coração para a esquerda e ↑ para baixo.' },
  apagao: { nome: 'APAGÃO', dica: 'Fique mais no meio da caixa: dá tempo de ver as balas chegando de qualquer lado. O relâmpago clareia tudo por um instante: aproveite para olhar a caixa.' },
  gravidade: { nome: 'GRAVIDADE MALUCA', dica: 'Uma força puxa o coração e muda de lado a cada ~2 s. A seta grande avisa a direção nova: segure para o lado contrário.' },
  trocado: { nome: 'CORAÇÃO TROCADO', dica: 'Os corações trocam de caixa: você desvia do ataque que VOCÊ jogou. Carta forte nessa rodada é faca de dois gumes.' },
  pcEscola: { nome: 'PC DA ESCOLA', dica: 'A caixa roda aos trancos (6 a 14 quadros por segundo) e às vezes trava em "Não está respondendo". Mexa-se cedo e com calma.' },
  aquario: { nome: 'AQUÁRIO', dica: 'Tudo em câmera lenta e o coração boia para cima sozinho: segure ↓ para afundar. Ele tem inércia, então freie antes.' },
  cogumelo: { nome: 'COGUMELO MALUCO', dica: 'O coração alterna entre GIGANTE e MINI (ele pisca antes de trocar). Gigante: procure os espaços largos; mini: passa por quase tudo.' },
  estatua: { nome: 'DANÇA DA ESTÁTUA', dica: 'A música parou? ESTÁTUA! O holofote persegue o coração: se te pegar se mexendo, perde 30% do HP máximo.' },
  gelo: { nome: 'PISTA DE GELO', dica: 'O coração escorrega e custa a frear: toques curtos, e solte antes de chegar onde quer.' },
  terremoto: { nome: 'TERREMOTO', dica: 'O ronco e a poeira avisam. Depois a tela treme, o coração é jogado para um lado e caem pedras do teto da caixa.' },
  popups: { nome: 'POP-UPS', dica: 'O coração fica sempre por cima das janelas, e o vidro deixa adivinhar as balas atrás. Para fechar, é só passar o coração pelo [X] vermelho.' },
  lag: { nome: 'LAG', dica: 'O direcional chega atrasado. O fantasma do coração mostra para onde ele VAI: guie pelo fantasma e antecipe.' },
  teclado: { nome: 'TECLADO EMBARALHADO', dica: 'As setas trocam de lugar (giros e espelhos). O tecladinho entre as caixas mostra o mapa da vez: olhe antes de mexer.' },
  copia: { nome: 'CTRL+C CTRL+V', dica: 'Aperte A sem parar por 5 s: quem estiver na frente na barra copia 1 a 3 de energia do outro. 14 apertos de vantagem enchem a barra e acabam a disputa.' },
  telaAzul: { nome: 'TELA AZUL', dica: 'O chuvisco avisa. Na tela azul a caixa congela e ninguém leva dano; ela volta do mesmo ponto, então já pense na saída.' },
  cursor: { nome: 'CURSOR GIGANTE', dica: 'O cursor persegue o coração; quando aparecem a ampulheta e o anel fechando, ele vai clicar ali. Saia de baixo (às vezes é clique duplo).' },
  chuva: { nome: 'CHUVA DE VERÃO', dica: 'Fique mais para cima: a chuva puxa para baixo, e as pancadas fortes vêm avisadas com setas. Nas poças o coração escorrega (só dentro delas).' },
  ventania: { nome: 'VENTANIA', dica: 'Rajadas em 8 direções empurram o coração. As folhas e a seta na borda mostram de onde vem o vento: segure contra.' },
  abelhas: { nome: 'ENXAME', dica: 'Ficou parado, as abelhas notam ("?", depois "!") e vêm atrás. Continue se mexendo para despistar o enxame.' },
  vagalumes: { nome: 'VAGA-LUMES', dica: 'Escureceu: só os vaga-lumes (que passeiam pela caixa) e um brilho fraco no coração iluminam. Ande perto da luz.' },
  polen: { nome: 'ESPIRRO DE PÓLEN', dica: '"a..." "a... a..." ATCHIM! A seta mostra para onde o espirro vai jogar o coração: afaste-se das balas daquele lado.' },
  trepadeira: { nome: 'TREPADEIRA', dica: 'A faixa piscando na borda avisa onde a vinha vai crescer. Saia dela: as vinhas machucam e fecham a área.' },
  encolhendo: { nome: 'ARENA ENCOLHENDO', dica: 'Paliçadas entram pelas bordas (aviso vermelho com setas), seguram e abrem. Só empurram: fique no miolo.' },
  leoes: { nome: 'LEÕES!', dica: 'Rugido e faixa piscando: um leão vai atravessar ali. Saia da faixa, ou fique onde ele salta (no salto ele não machuca).' },
  lancas: { nome: 'CHUVA DE LANÇAS', dica: 'A sombra crescendo mostra onde a lança cai. Cravada, ela vira obstáculo por um tempo.' },
  bigas: { nome: 'CORRIDA DE BIGAS', dica: 'Carruagens correm em 3 faixas, cada uma num sentido; a poeira avisa a faixa. Nunca vêm as três juntas.' },
  brasas: { nome: 'CHÃO EM BRASAS', dica: 'Parado, a barra de CALOR enche; cheia, queima. Não pare de se mexer, nem que seja em voltinhas.' },
  polegar: { nome: 'POLEGAR DO IMPERADOR', dica: 'O imperador sorteia uma regra para os dois: controles invertidos, coração rápido, lento, mini, gigante ou caixa escura. Leia o nome em cima da caixa.' },
  rede: { nome: 'REDE DO RECIÁRIO', dica: 'Fuja do círculo onde a rede vai cair. Preso, sacuda as setas para se soltar (ou espere). Ela não dá dano, só prende.' },
  plateia: { nome: 'PLATEIA ARREMESSA', dica: 'A sombra no chão da caixa mostra onde o objeto vai cair (e ele ainda quica). Saia de baixo.' },
  geloSeco: { nome: 'GELO SECO', dica: 'Na fumaça da metade de baixo as balas viram vultos. Prefira desviar pela metade de cima.' },
  ritmo: { nome: 'NO RITMO', dica: 'O coração só anda na batida (o anel marca a janela). Planeje um passo por batida.' },
  karaoke: { nome: 'KARAOKÊ', dica: 'Os versos atravessam a caixa e cada palavra é sólida: passe pelos espaços entre as palavras.' },
  mosh: { nome: 'MOSH', dica: 'Uma onda de gente cruza uma faixa da caixa (o aviso aparece na borda de onde ela vem) e empurra o coração. Saia da faixa.' },
  pedra: { nome: 'PEDRA ROLANTE', dica: 'Ronco e faixa vermelha com setas: a pedra gigante vem por ali (às vezes duas). Saia da faixa.' },
  armadilhas: { nome: 'ARMADILHAS', dica: 'Pisou na placa? Clique: dardos saem das paredes pela linha dela. Os espinhos estalam antes de subir: saia das lajes que estalam.' },
  areia: { nome: 'AREIA MOVEDIÇA', dica: 'Poças de areia surgem com aviso, prendem e puxam o coração para o meio. Não dá dano, mas deixa você lento no meio das balas.' },
  relogio: { nome: 'RELÓGIO DO TEMPO', dica: 'O ataque alterna câmera lenta e acelerado (com 1 s de aviso); o coração anda normal. Use o lento para se reposicionar.' },
  // PRAIA e CAFÉ FRANCÊS
  ondaGigante: { nome: 'ONDA GIGANTE', dica: 'A faixa azul piscando mostra por onde a água passa; o vão verde é a saída. Vá para o vão antes de a onda entrar: o próximo vão fica sempre perto do anterior.' },
  caranguejos: { nome: 'CARANGUEJOS', dica: 'Eles andam de lado. Quando um para e ergue as pinças, o anel vermelho mostra o alcance do beliscão: saia do anel antes de ele fechar.' },
  bolaDePraia: { nome: 'BOLA DE PRAIA', dica: 'A sombra mostra onde a bola cai e ela quica em linha reta. Encostou, ela empurra o coração (sem dano): fique longe dela e das quinas.' },
  // ESTAÇÃO ESPACIAL
  semAtrito: { nome: 'SEM ATRITO', dica: 'O direcional vira empuxo: o coração ganha velocidade e continua deslizando. Para frear, empurre para o lado CONTRÁRIO (leva uns 0,7 s). Nas paredes ele quica de leve: use isso para virar.' },
  minhoca: { nome: 'BURACO DE MINHOCA', dica: 'As bordas da caixa se ligam: sair por cima é entrar por baixo (brilho ciano), pela esquerda é entrar pela direita (violeta). Vale para as balas também, uma vez cada: uma bala que sai reaparece do lado oposto, e dá para vê-la chegando na faixa de fora. Use o portal para fugir de um canto.' },
  radar: { nome: 'RADAR', dica: 'A caixa fica escura e o feixe verde dá uma volta a cada ~1,8 s: onde ele passa a bala acende e vai apagando, com um risquinho mostrando para onde ela ia. Decore posição e direção. Balas piscando, chegando de fora ou coladas no coração sempre aparecem.' },
  orbita: { nome: 'ÓRBITA', dica: 'O planeta do meio puxa as balas (elas curvam e somem se caírem nele) e puxa o coração, sempre com menos força que o seu direcional. Encostar nele machuca. Fique nas bordas e deixe as balas darem a volta.' },
  polaridade: { nome: 'POLARIDADE', dica: 'Seu coração é + (vermelho) ou - (azul), e cada bala também (cor e sinal). Polos IGUAIS se repelem, OPOSTOS se atraem. Aperte A para inverter a sua polaridade: copie a da bala que vem e ela desvia; se for oposta, ela vem para cima de você.' },
  oxigenio: { nome: 'OXIGÊNIO', dica: 'A barra de O2 embaixo da caixa esvazia sozinha. As bolhas aparecem com um contorno se fechando (aviso) e recarregam quase metade quando você encosta. A barra dura uns 5 s sozinha: pegue uma ou duas bolhas por ataque. Com a barra vazia o coração engasga: dano pequeno a cada 1,5 s.' },
  trator: { nome: 'RAIO TRATOR', dica: 'Perto de uma bala (o colchete mostra qual), aperte A: ela fica presa no raio, gira em volta do coração e NÃO machuca. Aperte A de novo para lançá-la na caixa do oponente (a mira tracejada mostra a altura). Se demorar demais, ela é lançada sozinha. Errou o alcance? Só uma recarga curta.' },
  manutencao: { nome: 'MANUTENÇÃO', dica: 'Painéis quebrados piscam em âmbar. Pare com o coração em cima de um por 1 s (a barrinha enche): ele vira um escudo azul até o fim da rodada e as balas somem ao encostar nele. Sair antes faz o conserto regredir. Conserte quando a caixa estiver calma.' },
  // CAFÉ FRANCÊS
  latteArt: { nome: 'LATTE ART', dica: 'Por onde o coração anda fica uma linha de leite. Feche um laço com ela em volta das balas e elas somem! A jarrinha embaixo mostra o leite: acaba rápido, mas volta bem mais depressa com o coração parado.' },
  bandeja: { nome: 'BANDEJA', dica: 'Você carrega uma xícara cheia: giros bruscos, arrancadas e freadas fazem o café balançar (medidor embaixo). Balançou demais, derrama e tira um pouquinho de HP. Faça curvas abertas e ande liso.' },
  mimico: { nome: 'MÍMICO', dica: 'Há paredes invisíveis na caixa (elas aparecem fraquinhas no começo). Encostar nelas as revela e você escorrega pelo lado; as balas também quicam nelas, então um tiro pode voltar. Sempre há passagem.' },
  acordeao: { nome: 'ACORDEÃO', dica: 'A caixa é o fole da valsa: o lado que vai fechar pisca com setas e uma nota antes de se mexer. O fole só empurra o coração; ele anda mais devagar que você, então ande antes para o lado livre.' },
  pintor: { nome: 'PINTOR', dica: 'O contorno tracejado mostra onde o pintor vai passar o pincel. Bala que encosta na tinta molhada congela no lugar e vira obstáculo até a tinta secar. A tinta em si não machuca: use as balas paradas como paredes, ou fuja delas.' },
  menuDoDia: { nome: 'MENU DO DIA', dica: 'As balas viram pratos. O quadro em cima da caixa mostra o prato do dia: encostar nele cura um pouco. Qualquer outro prato machuca. Quando o quadro pisca, o prato vai mudar (por meio segundo nenhum prato machuca).' },
  expresso: { nome: 'EXPRESSO', dica: 'Encoste nas xícaras para beber: cada uma deixa o coração mais rápido por uns 5 segundos e os efeitos se somam. Com 4 ao mesmo tempo vem a tremedeira e o direcional balança sozinho. Beba até 3 e espere.' },
  xadrez: { nome: 'XADREZ', dica: 'Você é o cavalo: o coração só pula em L (2 casas e 1 de lado). Os destinos aparecem marcados; empurre o direcional para escolher e o pulo sai na hora. No ar você não leva dano, mas depois do pulo há uma pequena recarga (o anel).' },
  dragao: { nome: 'DRAGÃO', dica: 'O risco dourado ondulado no chão mostra por onde o dragão vai serpentear. O corpo todo machuca, mas a onda deixa sempre um corredor livre em cima ou embaixo.' },
  lanternas: { nome: 'LANTERNAS', dica: 'Um anel dourado fecha onde a lanterna vai nascer (ainda inofensiva). Depois ela acende e sobe balançando: desvie da coluna dela.' },
  transito: { nome: 'TRÂNSITO', dica: 'O semáforo manda: amarelo piscando = a faixa vermelha vai ter veículo (os faróis acendem na borda); verde = eles disparam. Ônibus é lento e longo, moto é rápida. Nunca as 3 faixas juntas.' },
  obra: { nome: 'OBRA', dica: 'A coluna listrada de amarelo e preto é onde a viga vai cair (a viga balança no cabo, avisando). Saia da coluna: a viga machuca só no instante da queda.' },
}

const NOME_ARMA = { tiro: 'tiro', espada: 'espada', bumerangue: 'bumerangue', explosao: 'bombas' }

// Duelo: a arma de cada naipe sai de ARMAS (pvp/bonus.js)
function dicaDoDuelo() {
  const armas = Object.entries(ARMAS)
    .map(([naipe, arma]) => `${SIMBOLOS[naipe] ?? naipe} ${NOME_ARMA[arma] ?? arma}`)
    .join(', ')
  return `Uma caixa só para os dois. A carta escolhida vira arma (${armas}) e A ataca. Não gasta energia; carta mais alta bate mais forte.`
}

// O que a rodada faz com as cartas (campo `cartas` de EVENTOS)
const CARTAS_DO_EVENTO = {
  normal: 'as de sempre',
  malucas: 'viram outras',
  duelo: 'viram arma',
  copia: 'vão para o descarte sem custo',
}

const maiuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

// Em que arenas o evento `id` aparece (com o nome que ele tem em cada uma)
function arenasDoEvento(id) {
  return ARENAS.filter((a) => eventosDaArena(a.id).some((ev) => ev.id === id)).map((a) => ({ id: a.id, nome: a.nome, curto: a.curto, nomeEvento: eventosDaArena(a.id).find((ev) => ev.id === id).nome }))
}

// Ficha de uma rodada bônus, como ela aparece na arena `arenaId`:
//   id, nome (o da arena), nomeOriginal (o de EVENTOS; igual ao nome se não foi renomeado)
//   descricao (com maiúscula), cor, cartas ('normal' | 'malucas' | 'duelo')
//   numeros    [{ rotulo, valor }]: o que acontece com as cartas e onde mais cai
//   dica       como se virar (null se não houver uma para este evento)
//   emTodas    cai em todas as arenas
//   tambemEm   [{ id, nome, curto, nomeEvento }] outras arenas com este evento
//   previa     tem prévia ao vivo (está em `efeitos`)
export function fichaDoEvento(evento, arenaId, { efeitos = {} } = {}) {
  const base = EVENTO[evento.id] ?? evento
  const onde = arenasDoEvento(evento.id)
  const emTodas = onde.length === ARENAS.length
  const tambemEm = onde.filter((a) => a.id !== arenaId)
  const conhecida = DICAS[evento.id]?.nome === base.nome
  const dica = conhecida ? (evento.id === 'duelo' ? dicaDoDuelo() : DICAS[evento.id].dica) : null
  const cartas = evento.cartas ?? 'normal'
  const numeros = [{ rotulo: 'CARTAS', valor: CARTAS_DO_EVENTO[cartas] ?? cartas }]
  if (emTodas) numeros.push({ rotulo: 'ONDE', valor: 'em todas as arenas' })
  else if (!tambemEm.length) numeros.push({ rotulo: 'ONDE', valor: 'só nesta arena' })
  else numeros.push({ rotulo: 'TAMBÉM', valor: tambemEm.map((a) => (a.nomeEvento !== evento.nome ? `${a.curto} (${a.nomeEvento})` : a.curto)).join(', ') })
  if (evento.nome !== base.nome) numeros.push({ rotulo: 'É O', valor: base.nome })
  return {
    id: evento.id,
    nome: evento.nome,
    nomeOriginal: base.nome,
    descricao: semLigaduras(maiuscula(evento.descricao ?? base.descricao ?? '')), // a fonte junta "fi"/"fl" num "A"
    cor: evento.cor ?? base.cor ?? 0xffffff,
    cartas,
    numeros,
    dica: dica && semLigaduras(dica),
    emTodas,
    tambemEm,
    previa: Boolean(efeitos[evento.id]),
  }
}

// Página de uma arena: os dados dela e as rodadas bônus na ordem da tela
// (primeiro as que caem em todas as arenas, depois as da arena, cada grupo
// na ordem de pvp/arenas.js).
export function fichaDaArena(id, { efeitos = {} } = {}) {
  const arena = ARENA[id]
  if (!arena) throw new Error(`fichaDaArena: arena desconhecida '${id}'`)
  const fichas = eventosDaArena(id).map((ev) => fichaDoEvento(ev, id, { efeitos }))
  const eventos = [...fichas.filter((f) => f.emTodas), ...fichas.filter((f) => !f.emTodas)]
  const grupos = []
  eventos.forEach((f, i) => {
    const rotulo = f.emTodas ? 'EM TODAS AS ARENAS' : 'DESTA ARENA'
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.rotulo === rotulo) ultimo.fim = i
    else grupos.push({ rotulo, inicio: i, fim: i })
  })
  return {
    id: arena.id,
    nome: arena.nome,
    curto: arena.curto ?? arena.nome,
    descricao: semLigaduras(arena.descricao ?? ''),
    musica: arena.tituloMusica ?? null,
    cor: arena.cor ?? 0xffffff,
    frequencia: semLigaduras(`A cada ${BONUS.aCadaRodadas} rodadas a roleta sorteia uma destas (nunca a mesma duas vezes seguidas).`),
    eventos,
    grupos,
  }
}

// ---------- prévia ao vivo ----------

// Cartas que a prévia ao vivo de um evento sorteia para as caixas: ataques
// "de verdade" e medianos (♠ ♦ ♣ do 4 ao Q), sem Ás, sem SUPER e sem inverter
// os controles (a inversão confundiria com o evento).
export function cartasDaPreviaBonus() {
  return PERSONAGENS_PVP.flatMap((p) => CARTAS[p] ?? []).filter((c) => {
    if (c.naipe === 'copas' || ehSuper(c) || especialDaCarta(c)) return false
    if (c.valor < 4 || c.valor > 12) return false
    return !resumoDoAtaque(c).inverterMs
  })
}
