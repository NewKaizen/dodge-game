// Manifesto dos sprites e sons do menu inicial (a Boot carrega tudo)
import sala from './sala.js'
import telao from './telao.js'
import logo from './logo.js'

const TODOS = { sala, telao, logo }
export const IMAGENS_MENU = Object.values(TODOS).flatMap((m) => m?.imagens ?? [])
export const SONS_MENU = Object.values(TODOS).flatMap((m) => m?.sons ?? [])
