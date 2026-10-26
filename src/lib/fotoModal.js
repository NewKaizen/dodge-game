import { writable, get } from 'svelte/store'

// A foto do perfil precisa de DOM (o seletor de arquivo do navegador e o
// recorte com arrastar e zoom), então este é o único pedaço do perfil que
// continua em Svelte: ui/FotoModal.svelte, por cima do jogo. A cena Perfil
// (game/scenes/Perfil.js) chama pedirFoto() e espera o resultado; enquanto o
// modal está aberto o teclado fica com ele (nada chega ao jogo).
//
//   pedirFoto()      -> Promise<{ ok, aviso?, erro?, cancelado? }>
//   fotoModal        a loja que o FotoModal.svelte lê ({ resolver } ou null)
//   concluirFoto(r)  o modal devolve o resultado e fecha
export const fotoModal = writable(null)

export function pedirFoto() {
  // já tem um aberto: não abre outro
  if (get(fotoModal)) return Promise.resolve({ ok: false, cancelado: true })
  return new Promise((resolver) => fotoModal.set({ resolver }))
}

export function concluirFoto(resultado) {
  const aberto = get(fotoModal)
  fotoModal.set(null)
  aberto?.resolver(resultado)
}
