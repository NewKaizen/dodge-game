import { get } from 'svelte/store'
import { conta, clienteSupabase } from './conta.js'

// Denúncia de nome e foto de outros jogadores (Fase 1E; docs/moderacao.md).
// O navegador só chama a função denunciar() do banco (0004_moderacao.sql): ele
// não lê denúncia nenhuma. Quem revisa usa o scripts/moderar.js, no servidor.
//
//   MOTIVOS                          as opções do seletor ({ id, rotulo }); o rótulo vai como motivo
//   TIPOS_DENUNCIA                   { nome: 'Nome', foto: 'Foto' }
//   denunciar(tag, tipo, motivoId, { cliente? }) -> { ok, erro? }

export const TIPOS_DENUNCIA = { nome: 'nome', foto: 'foto' }
export const MOTIVOS = [
  { id: 'ofensivo', rotulo: 'ofensivo ou xingamento' },
  { id: 'assedio', rotulo: 'assédio ou ameaça' },
  { id: 'improprio', rotulo: 'conteúdo impróprio (violência, sexo)' },
  { id: 'impersonacao', rotulo: 'se passa por outra pessoa' },
  { id: 'outro', rotulo: 'outro motivo' },
]

// as funções do banco falam português nesses códigos; o resto é erro de rede etc.
const CODIGOS_NOSSOS = new Set(['28000', '22023', 'P0002', '23505', '54000', '42501'])

export async function denunciar(tag, tipo, motivoId, { cliente = clienteSupabase() } = {}) {
  if (!cliente || get(conta).estado !== 'logado') return { ok: false, erro: 'entre com sua conta para denunciar' }
  if (!TIPOS_DENUNCIA[tipo]) return { ok: false, erro: 'escolha o que denunciar: o nome ou a foto' }
  const motivo = MOTIVOS.find((m) => m.id === motivoId)
  if (!motivo) return { ok: false, erro: 'escolha o motivo' }
  let r
  try {
    r = await cliente.rpc('denunciar', { p_tag: String(tag ?? '').trim(), p_tipo: tipo, p_motivo: motivo.rotulo })
  } catch {
    return { ok: false, erro: 'sem conexão com o serviço de contas: confira sua internet e tente de novo' }
  }
  if (r.error) return { ok: false, erro: CODIGOS_NOSSOS.has(r.error.code) && r.error.message ? r.error.message : 'não deu para enviar a denúncia agora: tente de novo daqui a pouco' }
  return { ok: true }
}
