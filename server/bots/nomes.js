// APELIDOS dos bots do JOGAR RÁPIDO: nicks de jogo com cara de brasileiro, montados de bichos, comidas,
// folclore e coisas (nunca nome de gente: nenhum prenome, sobrenome ou nome de streamer/conta de
// verdade entra nas listas). Lógica pura, com o sorteio que vier (rng: () => 0..1).
//
//   gerarApelido(rng)                  um apelido (3 a 16 letras, só [A-Za-z0-9_.-], sem acento)
//   gerarApelidos(n, rng, usados?)     n apelidos diferentes (e diferentes dos `usados`)
//   apelidoValido(nome)                as regras do nome de exibição (0001) e o filtro de palavras
import { nomeOfensivo } from '../../src/lib/palavrasBloqueadas.js'

// [palavra, gênero] (o adjetivo concorda)
const COISAS = [
  ['Capivara', 'f'], ['Tatu', 'm'], ['Jabuti', 'm'], ['Sabia', 'm'], ['Tucano', 'm'], ['Arara', 'f'], ['Mico', 'm'], ['Onca', 'f'],
  ['Boto', 'm'], ['Saci', 'm'], ['Curupira', 'm'], ['Iara', 'f'], ['Boitata', 'm'], ['Pipoca', 'f'], ['Coxinha', 'f'], ['Pastel', 'm'],
  ['Pacoca', 'f'], ['Brigadeiro', 'm'], ['Mandioca', 'f'], ['Guarana', 'm'], ['Acai', 'm'], ['Caju', 'm'], ['Pitanga', 'f'], ['Jaca', 'f'],
  ['Goiaba', 'f'], ['Farofa', 'f'], ['Tapioca', 'f'], ['Pamonha', 'f'], ['Quindim', 'm'], ['Trovao', 'm'], ['Cometa', 'm'], ['Foguete', 'm'],
  ['Turbo', 'm'], ['Pixel', 'm'], ['Combo', 'm'], ['Ninja', 'm'], ['Mago', 'm'], ['Pirata', 'm'], ['Jacare', 'm'], ['Tamandua', 'm'],
  ['Preguica', 'f'], ['Sucuri', 'f'], ['Piranha', 'f'], ['Calango', 'm'], ['Tico', 'm'], ['Sagui', 'm'], ['Quati', 'm'], ['Lontra', 'f'],
  ['Canjica', 'f'], ['Cuscuz', 'm'], ['Biscoito', 'm'], ['Bolacha', 'f'], ['Pudim', 'm'], ['Torresmo', 'm'], ['Churros', 'm'], ['Esfiha', 'f'],
  ['Picole', 'm'], ['Sorvete', 'm'], ['Chinelo', 'm'], ['Pandeiro', 'm'], ['Berimbau', 'm'], ['Pipa', 'f'], ['Peteca', 'f'], ['Bodoque', 'm'],
  ['Relampago', 'm'], ['Furacao', 'm'], ['Vulcao', 'm'], ['Meteoro', 'm'], ['Coruja', 'f'], ['Gaviao', 'm'], ['Urubu', 'm'], ['Carcara', 'm'],
]
// [masculino, feminino]
const JEITOS = [
  ['Brabo', 'Braba'], ['Veloz', 'Veloz'], ['Sinistro', 'Sinistra'], ['Monstro', 'Monstra'], ['Lendario', 'Lendaria'], ['Zika', 'Zika'],
  ['Insano', 'Insana'], ['Doido', 'Doida'], ['Sombrio', 'Sombria'], ['Feroz', 'Feroz'], ['Ligeiro', 'Ligeira'], ['Esperto', 'Esperta'],
  ['Marrento', 'Marrenta'], ['Raiz', 'Raiz'], ['Nervoso', 'Nervosa'], ['Bolado', 'Bolada'], ['Sagaz', 'Sagaz'], ['Pistola', 'Pistola'],
  ['Turbinado', 'Turbinada'], ['Calmo', 'Calma'], ['Supremo', 'Suprema'], ['Gelado', 'Gelada'], ['Tranquilo', 'Tranquila'], ['Pesado', 'Pesada'],
]
const ELEMENTOS = ['Fogo', 'Gelo', 'Aco', 'Neon', 'Ouro', 'Prata', 'Lata', 'Vidro', 'Brasa', 'Areia', 'Chumbo', 'Luz']
const TITULOS = ['Rei', 'Mestre', 'Lorde', 'Dom', 'Capitao', 'Doutor', 'Sargento', 'Tio', 'Barao']
const FINAIS = ['BR', 'zin', 'gamer', 'TV', 'GG', 'PRO', 'xD', 'Plays', 'Jr', 'mito']

const escolher = (rng, lista) => lista[Math.floor(rng() * lista.length)]
const numero = (rng) => {
  const r = rng()
  if (r < 0.35) return String(Math.floor(rng() * 90) + 10) // 2 dígitos
  if (r < 0.6) return escolher(rng, ['7', '9', '13', '21', '77', '99', '777', '666', '404', '1000', '123', '2k'])
  if (r < 0.85) return String(1990 + Math.floor(rng() * 21)) // ano
  return String(Math.floor(rng() * 900) + 100)
}
const minusc = (s) => s.toLowerCase()

export function apelidoValido(nome) {
  return typeof nome === 'string' && /^[A-Za-z0-9 _.-]{3,16}$/.test(nome) && nome === nome.trim() && !/\s\s/.test(nome) && !nomeOfensivo(nome)
}

export function gerarApelido(rng = Math.random) {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const [coisa, genero] = escolher(rng, COISAS)
    const jeito = escolher(rng, JEITOS)[genero === 'f' ? 1 : 0]
    const forma = Math.floor(rng() * 9)
    let nome
    switch (forma) {
      case 0:
        nome = `${coisa}${jeito}`
        break
      case 1:
        nome = `${minusc(coisa)}_${minusc(jeito)}`
        break
      case 2:
        nome = `${coisa}${numero(rng)}`
        break
      case 3:
        nome = `${escolher(rng, TITULOS)}${coisa}`
        break
      case 4:
        nome = `${coisa}${escolher(rng, FINAIS)}`
        break
      case 5:
        nome = `${coisa}De${escolher(rng, ELEMENTOS)}`
        break
      case 6:
        nome = `${minusc(coisa)}${numero(rng)}`
        break
      case 7:
        nome = `xX${coisa}Xx`
        break
      default:
        nome = `${minusc(coisa)}.${minusc(jeito)}`
    }
    if (apelidoValido(nome)) return nome
  }
  return `Tatu${Math.floor(rng() * 9000) + 1000}`
}

export function gerarApelidos(n, rng = Math.random, usados = []) {
  const vistos = new Set(usados.map((x) => String(x).toLowerCase()))
  const lista = []
  for (let i = 0; lista.length < n && i < n * 40; i++) {
    const nome = gerarApelido(rng)
    if (vistos.has(nome.toLowerCase())) continue
    vistos.add(nome.toLowerCase())
    lista.push(nome)
  }
  return lista
}
