// Casos compartilhados do filtro de palavrões (filtro.test.js e moderacaoSql.test.js).
// Só ASCII/acentos comuns: o SQL não tem os "caracteres parecidos" do obscenity.
export const POSITIVOS = [
  // siglas
  'fdp', 'seu FDP', 'vsf', 'VTNC', 'vtmnc', 'pqp', 'krl', 'crl', 'tnc', 'pnc', 'sfd', 'stfu',
  // porra e disfarces
  'porra', 'PORRA!', 'p.o.r.r.a', 'p0rr4', 'porrrra', 'poooorra!!',
  // merda, foder, caralho, cacete
  'merda', 'm3rd4', 'merdinha', 'foda', 'fodase', 'foda-se', 'f0d3r', 'fudeu', 'caralho', 'c4r4lh0', 'c.a.r.a.l.h.o', 'c a r a l h o', 'karalho', 'xcaralhox', 'cacete', 'que cacete',
  // cu, buceta
  'cu', 'seu cu', 'vai tomar no cu', 'cuzão', 'Cuzao', 'buceta', 'bucetinha', 'b0c3t4', 'xoxota',
  // puta e afins
  'puta', 'Put4', 'puta_boy', 'filho da puta', 'filhodaputa', 'putaria', 'vagabundo', 'vadia', 'rapariga', 'punheta', 'siririca',
  // homofobia, racismo, ódio
  'viado', 'v1ad0', 'viadinho', 'veado', 'bicha', 'crioulo', 'nazista', 'Hitl3r', 'hitler99', 'N1gger', 'nigga', 'estuprador', 'pedófilo',
  // ofensas fortes
  'arrombado', 'escroto', 'desgraçado', 'retardado',
  // inglês
  'fuck', 'f*ck', 'f u c k', 'motherfucker', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'whore', 'slut', 'faggot', 'retard', 'cunt',
]

export const NEGATIVOS = [
  // palavras com pedaço de palavrão dentro
  'computador', 'disputa', 'Cuiabá', 'curso', 'cultura', 'cuco', 'cucumber', 'assassin', 'assim', 'assunto', 'classe', 'massa', 'Scunthorpe', 'analista', 'análise', 'cumprimentar', 'cumprir', 'Dickens', 'Bostoniano', 'Shiitake', 'rapel', 'semente', 'sexta', 'título', 'viaduto', 'tetanus', 'Uranus', 'arsenal', 'peacock', 'Essex', 'bassista',
  // palavras comuns que não ofendem
  'pinto', 'negro', 'preto', 'macaco', 'porrada', 'cacetinho', 'cacetete', 'otário', 'burro', 'GG, revanche?', 'boa partida, galera', 'meu computador travou',
  // frases que juntam palavras vizinhas
  'por razões técnicas', 'via do centro', 'cara lhe disse', 'tomar no curso', 'esse hit foi bom', 'this hit',
  // nomes de jogador
  'Kris', 'Susie 2000', 'Ralsei', 'Noelle', 'Ana Maria', 'João', 'Jogador 7',
]
