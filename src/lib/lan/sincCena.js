// Troca de cena em rede com N convidados (Fase 5A; docs/rede-pvp.md "Salas de N").
// Lógica pura, testável em Node (src/lib/__tests__/sincCena.test.js).
//
// O host abre a cena e manda a `cena` (com o número n) para cada convidado; cada
// um responde `cenaOk { n }` quando abriu. Aqui o host sabe quem já está na cena
// atual e quem está atrasado (um convidado lento não segura os outros: cada um
// tem a própria sessão do canal). Quem sai ou cai deixa de ser esperado.
//
//   const sinc = criarSincCena({ agora })
//   sinc.nova(chave, ids) -> n     o host abriu `chave` e mandou para estes convidados
//   sinc.ok(id, n)                 o convidado `id` abriu a cena n (n velho não conta)
//   sinc.saiu(id)                  não espera mais por ele (saiu, caiu ou foi tirado)
//   sinc.estado() -> { n, chave, prontos, faltam, desde }
//   sinc.todos()                   todos os esperados já abriram a atual
//   sinc.atrasados(ms)             quem ainda não abriu a atual depois de `ms`
//   sinc.esperar({ timeoutMs, agendar }) -> Promise<{ ok, faltam }>
export function criarSincCena({ agora = () => Date.now() } = {}) {
  let n = 0
  let chave = null
  let desde = 0
  let esperados = new Set()
  let prontos = new Set()
  let ouvintes = new Set()

  const faltam = () => [...esperados].filter((id) => !prontos.has(id))
  const avisar = () => {
    if (faltam().length) return
    const lista = [...ouvintes]
    ouvintes = new Set()
    for (const fn of lista) fn()
  }

  return {
    nova(novaChave, ids = []) {
      n += 1
      chave = novaChave
      desde = agora()
      esperados = new Set(ids)
      prontos = new Set()
      // quem esperava a cena anterior: ela não vale mais
      const lista = [...ouvintes]
      ouvintes = new Set()
      for (const fn of lista) fn(true)
      return n
    },
    ok(id, numero) {
      if (numero !== n || !esperados.has(id)) return false
      prontos.add(id)
      avisar()
      return true
    },
    saiu(id) {
      esperados.delete(id)
      prontos.delete(id)
      avisar()
    },
    estado: () => ({ n, chave, prontos: [...prontos], faltam: faltam(), desde }),
    todos: () => faltam().length === 0,
    atrasados: (ms) => (agora() - desde >= ms ? faltam() : []),
    esperar({ timeoutMs = 0, agendar = (fn, ms) => setTimeout(fn, ms) } = {}) {
      const minha = n
      if (!faltam().length) return Promise.resolve({ ok: true, faltam: [] })
      return new Promise((resolve) => {
        let feito = false
        const fim = (trocou = false) => {
          if (feito) return
          feito = true
          ouvintes.delete(fim)
          resolve({ ok: !trocou && minha === n && !faltam().length, faltam: minha === n ? faltam() : [] })
        }
        ouvintes.add(fim)
        if (timeoutMs > 0) agendar(() => fim(), timeoutMs)
      })
    },
  }
}
