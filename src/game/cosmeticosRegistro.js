// Carrega o CONTEÚDO dos cosméticos dos slots novos (src/game/cosmeticos/registro.js) e entrega à
// ponte (cosmeticosSlots.js). Só roda no navegador (config.js importa): o import.meta.glob é do Vite e
// não quebra o build quando a pasta ainda não existe (devolve {}): aí tudo fica no padrão.
import { definirRegistro } from './cosmeticosSlots.js'

const modulos = import.meta.glob('./cosmeticos/registro.js', { eager: true })
const registro = Object.values(modulos)[0] ?? null
definirRegistro(registro)

export default registro
