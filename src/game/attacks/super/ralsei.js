import rain from '../rain.js'

// SUPER de Ralsei (PROVISÓRIO: chuva comum). O agente do Ralsei substitui
// este arquivo pelo ataque exclusivo (definirAtaque, nome 'superRalsei').
export default (config = {}) => rain({ duracao: 9000, ...config, caixa: null })
