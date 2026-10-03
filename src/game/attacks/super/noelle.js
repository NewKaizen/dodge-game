import rain from '../rain.js'

// SUPER de Noelle (PROVISÓRIO: chuva comum). O agente do Noelle substitui
// este arquivo pelo ataque exclusivo (definirAtaque, nome 'superNoelle').
export default (config = {}) => rain({ duracao: 9000, ...config, caixa: null })
