// O canal direto (WebRTC, lib/lan/transmissao.js) está entregando? Lógica
// pura, testável em Node.
//
// Um RTCDataChannel pode ficar "aberto" sem entregar nada ao outro lado (visto
// com o convidado no Brave com os escudos ligados): quem manda acha que foi e o
// outro nunca recebe a troca de cena (tela parada). Por isso, com o canal
// aberto, cada lado manda um "vivo" numerado pelo canal direto a cada VIVO_MS
// e quem recebe responde PELO SERVIDOR (o caminho garantido). Sem resposta há
// MUDO_APOS_MS, o direto está mudo: tudo vai pelo servidor até uma resposta
// voltar (aí o direto volta a valer sozinho).
//
//   const vigia = criarVigiaDireto({ agora })
//   vigia.abriu()        o canal direto abriu (começa a contar dali)
//   vigia.fechou()       fechou (ou a conexão recomeçou)
//   vigia.vivo()         o número do próximo "vivo" (mandar pelo direto)
//   vigia.ok(n)          chegou a resposta (pelo servidor) do vivo n
//   vigia.mudo()         true: aberto, mas o outro não recebe há MUDO_APOS_MS
export const VIVO_MS = 1000
export const MUDO_APOS_MS = 3500

export function criarVigiaDireto({ agora = () => Date.now(), mudoAposMs = MUDO_APOS_MS } = {}) {
  let abertoEm = null
  let ultimoOk = null
  let n = 0
  let enviados = new Set() // os vivos deste canal (resposta de um canal velho não vale)
  return {
    abriu() {
      abertoEm = agora()
      ultimoOk = null
      enviados = new Set()
    },
    fechou() {
      abertoEm = null
      ultimoOk = null
      enviados = new Set()
    },
    vivo() {
      n += 1
      enviados.add(n)
      if (enviados.size > 64) enviados.delete(enviados.values().next().value)
      return n
    },
    ok(num) {
      if (abertoEm == null || !enviados.has(num)) return false
      ultimoOk = agora()
      return true
    },
    mudo() {
      if (abertoEm == null) return false
      return agora() - (ultimoOk ?? abertoEm) >= mudoAposMs
    },
    aberto: () => abertoEm != null,
  }
}
