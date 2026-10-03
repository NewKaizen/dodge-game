import rain from '../rain.js'

// SUPER de Berdly (PROVISÓRIO: chuva comum). O agente do Berdly substitui
// este arquivo pelo ataque exclusivo (definirAtaque, nome 'superBerdly').
export default (config = {}) => rain({ duracao: 9000, ...config, caixa: null })
