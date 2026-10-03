import rain from '../rain.js'

// SUPER de Dess (PROVISÓRIO: chuva comum). O agente do Dess substitui
// este arquivo pelo ataque exclusivo (definirAtaque, nome 'superDess').
export default (config = {}) => rain({ duracao: 9000, ...config, caixa: null })
