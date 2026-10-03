import rain from '../rain.js'

// SUPER de Asriel (PROVISÓRIO: chuva comum). O agente do Asriel substitui
// este arquivo pelo ataque exclusivo (definirAtaque, nome 'superAsriel').
export default (config = {}) => rain({ duracao: 9000, ...config, caixa: null })
