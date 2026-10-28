// Joysticks serial, um Arduino por porta USB (docs/protocolo-serial.md): lógica pura,
// testada em Node (__tests__/joysticks.test.js). Quem abre as portas é lib/serial.js.
//
//   chaveBase(info)                 'vid:pid' da porta (getInfo), ou 'serial' se o navegador não diz
//   criarMapa({ vagas, salvo, aoSalvar })   qual porta é qual jogador
//       .registrar(porta, info)     { chave, jogador }: a primeira vez cria a chave (base + #índice entre placas
//                                   iguais, na ordem em que apareceram) e a vaga; depois devolve a mesma
//       .ligou(porta) / .desligou(porta)        a porta está aberta / saiu (a vaga fica guardada)
//       .jogadorDe(porta)           1..vagas, ou 0 se a porta não é conhecida
//       .portaDe(jogador)           a porta ABERTA desse jogador (ou null: CPU/ausente)
//       .trocar()                   troca os jogadores 1 e 2 entre as portas abertas
//       .lista()                    [{ porta, chave, jogador, aberta }] na ordem de registro
//   reescreverLinha(linha, jogador, { rele })   JOY/BTN recebidos: o número da linha é trocado pelo da porta
//   rotearSaida(linha, abertas)     para quais portas vai uma linha do jogo: [{ porta, linha }]
//   modoRele(abertas)               uma porta só, jogador 1: a placa principal pode ter uma secundária
//   rotulo(item, indice)            texto para a lista da tela de configurações

export const chaveBase = (info) => {
  const v = info?.usbVendorId
  const p = info?.usbProductId
  return Number.isFinite(v) && Number.isFinite(p) ? `${v.toString(16)}:${p.toString(16)}` : 'serial'
}

export function criarMapa({ vagas = 2, salvo = null, aoSalvar = () => {} } = {}) {
  const guardado = {} // chave -> jogador (é isto que vai para o navegador)
  if (salvo && typeof salvo === 'object') {
    for (const [c, j] of Object.entries(salvo)) if (Number.isInteger(j) && j >= 1 && j <= vagas) guardado[c] = j
  }
  const portas = new Map() // porta -> { chave, aberta }, na ordem em que apareceram

  const ocupadas = (soAbertas) => {
    const s = new Set()
    for (const [, e] of portas) if (!soAbertas || e.aberta) s.add(guardado[e.chave])
    for (const c of Object.keys(guardado)) if (!soAbertas && ![...portas.values()].some((e) => e.chave === c)) s.add(guardado[c])
    return s
  }
  const livre = (usadas) => {
    for (let v = 1; v <= vagas; v++) if (!usadas.has(v)) return v
    return 0
  }
  const salvar = () => aoSalvar({ ...guardado })

  return {
    registrar(porta, info) {
      const ja = portas.get(porta)
      if (ja) return { chave: ja.chave, jogador: guardado[ja.chave], novo: false }
      const base = chaveBase(info)
      const indice = [...portas.values()].filter((e) => e.chave.startsWith(`${base}#`)).length
      const chave = `${base}#${indice}`
      portas.set(porta, { chave, aberta: false })
      let jogador = guardado[chave]
      const novo = !jogador
      if (!jogador) jogador = livre(ocupadas(false)) || livre(ocupadas(true)) || ((portas.size - 1) % vagas) + 1
      // a vaga lembrada já está com outra porta aberta: esta pega a livre (se houver)
      else if ([...portas].some(([p, e]) => p !== porta && e.aberta && guardado[e.chave] === jogador)) jogador = livre(ocupadas(true)) || jogador
      if (guardado[chave] !== jogador) {
        guardado[chave] = jogador
        salvar()
      }
      return { chave, jogador, novo }
    },
    ligou(porta) {
      const e = portas.get(porta)
      if (e) e.aberta = true
    },
    desligou(porta) {
      const e = portas.get(porta)
      if (e) e.aberta = false
    },
    jogadorDe(porta) {
      const e = portas.get(porta)
      return e ? guardado[e.chave] : 0
    },
    portaDe(jogador) {
      for (const [p, e] of portas) if (e.aberta && guardado[e.chave] === jogador) return p
      return null
    },
    trocar() {
      const abertas = [...portas.values()].filter((e) => e.aberta)
      if (!abertas.length) return false
      const antes = abertas.map((e) => guardado[e.chave])
      // com 2 vagas: 1 <-> 2; uma placa só vai para a outra vaga
      abertas.forEach((e, k) => (guardado[e.chave] = (antes[k] % vagas) + 1))
      salvar()
      return true
    },
    lista: () => [...portas].map(([porta, e]) => ({ porta, chave: e.chave, jogador: guardado[e.chave], aberta: e.aberta })),
  }
}

// "JOY 1 -35 80" / "JOY -35 80" / "BTN 2 A" / "BTN A" recebidos de uma porta.
// O firmware é o mesmo em todas as placas e cada uma, sozinha na porta, se diz jogador 1:
// o número que vem na linha é trocado pelo jogador da porta. Exceção, o modo RELÉ (uma porta
// só, com a placa principal ligada à secundária pelo SoftwareSerial): a placa principal repassa
// as linhas da secundária com o "2", então os números 1 e 2 da linha valem como vieram.
// O resto passa como veio (o protocolo.js ignora o que não conhece)
export function reescreverLinha(linha, jogador, { rele = false } = {}) {
  const texto = String(linha).trim()
  const [tipo, ...args] = texto.split(/\s+/)
  const T = tipo.toUpperCase()
  const dono = (id) => (rele && (id === '1' || id === '2') ? id : jogador)
  if (T === 'JOY') {
    const [x, y] = args.length >= 3 ? args.slice(1) : args
    return `JOY ${dono(args.length >= 3 ? args[0] : '1')} ${x} ${y}`
  }
  if (T === 'BTN') {
    const [id, b] = args.length >= 2 ? args : ['1', args[0]]
    return `BTN ${dono(id)} ${b}`
  }
  return texto
}

const POR_JOGADOR = /^(\d+)\s+(VIDA|BUZZER|LED)(\s.*)?$/i
const COM_PREFIXO = /^\d+\s+/

// Para quais portas vai uma linha do jogo. `abertas` = [{ porta, jogador }]
//   PING, GAME, MENU, DISCONNECT (estado)   todas as portas abertas, sem número na frente
//   "<n> VIDA ..." / "<n> BUZZER"           só a porta do jogador n (CPU ou ausente: nada). Com
//        uma placa por porta ela é "o jogador 1" para si mesma, então vai "1 VIDA ..." (nunca "2 ...").
//   Modo relé (uma porta só, jogador 1): a linha vai como está; a placa principal executa "1 ..." e
//        repassa "2 ..." à secundária.
export function rotearSaida(linha, abertas) {
  const texto = String(linha).trim()
  if (!texto) return []
  const m = POR_JOGADOR.exec(texto)
  if (!m) {
    const comando = texto.replace(COM_PREFIXO, '')
    return abertas.map((a) => ({ porta: a.porta, linha: comando }))
  }
  const n = Number(m[1])
  if (abertas.length === 1 && abertas[0].jogador === 1) return n === 1 || n === 2 ? [{ porta: abertas[0].porta, linha: texto }] : []
  const alvo = abertas.find((a) => a.jogador === n)
  return alvo ? [{ porta: alvo.porta, linha: texto.replace(COM_PREFIXO, '1 ') }] : []
}

// a placa está sozinha na porta e é o jogador 1: pode haver uma secundária atrás dela
export const modoRele = (abertas) => abertas.length === 1 && abertas[0].jogador === 1

export const rotulo = (item, indice) => `JOYSTICK ${indice + 1} · porta USB ${item.chave.split('#')[0]}${item.aberta ? '' : ' (desplugado)'} · JOGADOR ${item.jogador}`
