// O motor dos DIÁLOGOS da campanha (puro: a cena CampanhaDialogo só desenha). Estilo caixa de texto
// com retrato e nome, texto "datilografado" (A completa; com "reduzir animações" aparece inteiro) e,
// às vezes, uma escolha de duas opções (só sabor: muda falas, nunca a partida).
//
//   const d = criarDialogo(falas, { escolhas, instantaneo, letraMs })
//   d.atual       { quem, texto, visivel, completo } | { escolha: { chave, opcoes }, indice } | null (acabou)
//   d.avancar(dt) -> quantas letras novas apareceram (a cena toca o "blip" a cada algumas)
//   d.confirmar() -> 'completou' | 'proxima' | 'escolheu' | 'fim'
//   d.mover(±1)   troca a opção marcada
//   d.pular()     vai direto ao fim (ou para na próxima escolha: escolha nunca é pulada)
//   d.escolhas    as escolhas feitas (junto com as que vieram de antes): { chave: valor }
//   d.novas       só as feitas agora (o servidor guarda)
import { TEMPOS } from '../constants.js'

export const LETRAS_POR_BLIP = 3

// a fala vale com as escolhas de agora? ({ se: { chave: valor } })
const vale = (fala, escolhas) => !fala.se || Object.entries(fala.se).every(([k, v]) => escolhas[k] === v)

export function falasValidas(falas) {
  if (!Array.isArray(falas)) return false
  return falas.every((f) => (f.escolha ? typeof f.escolha.chave === 'string' && Array.isArray(f.escolha.opcoes) && f.escolha.opcoes.length === 2 && f.escolha.opcoes.every((o) => typeof o.valor === 'string' && typeof o.texto === 'string' && o.texto.length > 0) : typeof f.quem === 'string' && typeof f.texto === 'string' && f.texto.length > 0))
}

export function criarDialogo(falas, { escolhas = {}, instantaneo = false, letraMs = TEMPOS.letraMs } = {}) {
  const feitas = { ...escolhas }
  const novas = {}
  let i = -1
  let mostradas = 0
  let acumulado = 0
  let indice = 0

  const proximaValida = () => {
    i++
    while (i < falas.length && !vale(falas[i], feitas)) i++
    mostradas = instantaneo ? (falas[i]?.texto?.length ?? 0) : 0
    acumulado = 0
    indice = 0
  }
  proximaValida()

  const d = {
    get acabou() {
      return i >= falas.length
    },
    get atual() {
      const f = falas[i]
      if (!f) return null
      if (f.escolha) return { escolha: f.escolha, indice }
      return { quem: f.quem, texto: f.texto, visivel: f.texto.slice(0, mostradas), completo: mostradas >= f.texto.length }
    },
    get escolhas() {
      return { ...feitas }
    },
    get novas() {
      return { ...novas }
    },
    avancar(dt) {
      const f = falas[i]
      if (!f || f.escolha || mostradas >= f.texto.length) return 0
      acumulado += dt
      const n = Math.floor(acumulado / letraMs)
      if (n <= 0) return 0
      acumulado -= n * letraMs
      const antes = mostradas
      mostradas = Math.min(f.texto.length, mostradas + n)
      return mostradas - antes
    },
    confirmar() {
      const f = falas[i]
      if (!f) return 'fim'
      if (f.escolha) {
        const op = f.escolha.opcoes[indice]
        feitas[f.escolha.chave] = op.valor
        novas[f.escolha.chave] = op.valor
        proximaValida()
        return d.acabou ? 'fim' : 'escolheu'
      }
      if (mostradas < f.texto.length) {
        mostradas = f.texto.length
        return 'completou'
      }
      proximaValida()
      return d.acabou ? 'fim' : 'proxima'
    },
    mover(passo) {
      const f = falas[i]
      if (!f?.escolha) return
      indice = (indice + (passo > 0 ? 1 : -1) + f.escolha.opcoes.length) % f.escolha.opcoes.length
    },
    pular() {
      while (!d.acabou && !falas[i].escolha) proximaValida()
      return d.acabou ? 'fim' : 'escolha'
    },
  }
  return d
}
