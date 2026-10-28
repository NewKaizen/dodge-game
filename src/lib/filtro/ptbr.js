// Dados do filtro de palavrões (docs/moderacao.md). Só dados: o motor está em
// matcher.js e o SQL (0008) é gerado daqui por scripts/gerar-filtro-sql.mjs.
//
// Escreva tudo em minúsculas, sem acento, só letras a-z (o filtro tira acento,
// desfaz "leet" e junta letras repetidas antes de comparar). Letras b/e/o/l
// repetidas ("porrrra", "poooorra") já são aceitas sem você fazer nada.
//
//   EXATAS     palavra inteira (com "s" de plural opcional): "cu" barra "cu" e
//              "seu cu!", não "curso" nem "Cuiabá". Use para termos curtos ou
//              que aparecem dentro de palavras inocentes ("puta" em "computador").
//   COLADAS    sem limite de palavra e também com separadores no meio
//              ("c.a.r.a.l.h.o", "vai se foder" junto). Só termos longos e
//              sem uso inocente: letras de palavras vizinhas se juntam, então
//              "via do" viraria "viado" se "viado" fosse colada.
//   PERMITIDAS texto inocente que contém uma COLADA/palavra do inglês
//              (cacetinho = pão); some do filtro.
//   LEVES      xingamentos brandos: NÃO são barrados por padrão (só se pedir
//              com { leves: true }).
//   EN_REMOVIDAS  frases do dicionário em inglês do obscenity que dão falso
//              positivo em português (cumprir, analista, negro, semente...);
//              as versões seguras estão em EXATAS.

export const EXATAS = [
  // siglas e abreviações de internet
  'fdp', 'pqp', 'vsf', 'vsfd', 'vtnc', 'vtmnc', 'tnc', 'tmnc', 'pnc', 'sfd', 'krl', 'crl', 'crlh', 'kct', 'fdd', 'mrd', 'stfu', 'kys',
  // puta e derivados
  'puta', 'puto', 'putinha', 'putona', 'putaria', 'putao', 'putamerda',
  // porra, caralho, cacete
  'porra', 'caralho', 'karalho', 'caralio', 'caraio', 'carai', 'karai', 'calalho', 'caralhao', 'cacete',
  // merda, bosta
  'merda', 'merdinha', 'merdao', 'merdoso', 'bosta', 'bostinha', 'bostao',
  // foder
  'foda', 'fode', 'foder', 'fodeu', 'fodido', 'fodida', 'fodase', 'fodasse', 'fodaci', 'fodam', 'fodendo', 'fodao', 'fodinha', 'fuder', 'fudeu', 'fudido', 'fudida', 'fudendo', 'fudase',
  // cu e anatomia ("cu" só como palavra inteira: curso, Cuiabá e cultura passam)
  'cu', 'cuzao', 'cuzona', 'cuzinho', 'cuzudo', 'buceta', 'bucetinha', 'boceta', 'bocetinha', 'xoxota', 'xereca', 'xana', 'xaninha', 'piroca', 'pirocao', 'pirocudo',
  // sexo
  'punheta', 'punheteiro', 'siririca', 'boquete', 'tesao', 'vagabunda', 'vagabundo', 'prostituta',
  // ofensas a mulheres
  'vadia', 'vadiona', 'vagaba', 'rapariga', 'biscate', 'quenga',
  // homofobia e transfobia ("veado" também é o bicho: aqui vale como xingamento)
  'viado', 'viada', 'viadinho', 'viadao', 'viadagem', 'veado', 'bicha', 'bichona', 'boiola', 'baitola', 'sapatao', 'paneleiro', 'traveco', 'gayzao',
  // racismo e capacitismo ("negro", "preto" e "macaco" ficam de fora: palavras comuns)
  'crioulo', 'crioula', 'mongoloide', 'retardado', 'retardada', 'debiloide',
  // ódio e extremismo
  'nazi', 'nazis', 'nazista', 'nazistas', 'neonazista', 'klan',
  // ofensas fortes
  'arrombado', 'arrombada', 'escroto', 'escrota', 'cornudo', 'corno', 'corna', 'desgracado', 'desgracada', 'lazarento', 'cretino', 'cretina',
  // inglês que o dicionário do obscenity não cobre, ou cobre com falso positivo em português
  'ass', 'asshole', 'assholes', 'jackass', 'dumbass', 'cum', 'cumshot', 'rape', 'raped', 'rapes', 'raping', 'rapist', 'rapists', 'fag', 'fags', 'faggot', 'faggots', 'fagot', 'retard', 'retards', 'retarded', 'semen', 'spic', 'gook', 'wetback', 'beaner', 'paki', 'niger', 'niga', 'nigas', 'nigers', 'bullshit', 'dipshit', 'shithead', 'motherfucker', 'dickhead', 'cocksucker', 'wanker',
]

// Termos que valem colados em outras palavras e com separadores no meio. Nada
// que termine em "cu" ou "puta" (curso, computador): viram falso positivo ao juntar palavras.
export const COLADAS = [
  'caralho', 'cacete', 'bucet', 'bocet', 'arrombado', 'arrombada', 'filhodaputa', 'filhadaputa', 'fiodaputa', 'putaquepariu', 'vagabundo', 'vagabunda',
  'punhet', 'siririca', 'estupr', 'pedofil', 'zoofil', 'necrofil', 'hitler', 'siegheil', 'nigger', 'nigga', 'faggot', 'fuck', 'cunt', 'motherfuck',
]

// texto inocente que contém uma COLADA ou uma palavra do dicionário em inglês
export const PERMITIDAS = ['cacetinho', 'cacetinhos', 'cacetete', 'cacetetes', 'cucumber', 'scunthorpe', 'shiitake', 'assassin', 'assassino']

export const LEVES = ['otario', 'otaria', 'burro', 'burra', 'idiota', 'imbecil', 'babaca', 'trouxa', 'bobo', 'inutil', 'lixo', 'noob', 'cagado', 'cagar', 'sacana', 'bunda', 'palhaco', 'ridiculo', 'nojento', 'estupido', 'estupida', 'safado', 'safada']

export const EN_REMOVIDAS = ['negro', 'cum', 'ass', 'anal', 'fag', 'retard', 'semen', 'rape', 'bestiality']
