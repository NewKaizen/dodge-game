import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conta } from '../conta.js'
import { denunciar, MOTIVOS } from '../moderacao.js'

const logado = () => conta.update((s) => ({ ...s, estado: 'logado' }))
const falso = (resposta) => {
  const chamadas = []
  return { chamadas, rpc: async (nome, args) => (chamadas.push({ nome, args }), typeof resposta === 'function' ? resposta() : resposta) }
}

test('denunciar: manda o rótulo do motivo para a função do banco', async () => {
  logado()
  const c = falso({ data: 'id', error: null })
  assert.deepEqual(await denunciar('ana#1234', 'foto', 'ofensivo', { cliente: c }), { ok: true })
  assert.deepEqual(c.chamadas, [{ nome: 'denunciar', args: { p_tag: 'ana#1234', p_tipo: 'foto', p_motivo: MOTIVOS[0].rotulo } }])
})

test('denunciar: confere antes de chamar e traduz os erros', async () => {
  logado()
  const c = falso({ data: null, error: null })
  assert.equal((await denunciar('u', 'cor', 'ofensivo', { cliente: c })).ok, false)
  assert.equal((await denunciar('u', 'nome', 'nada', { cliente: c })).ok, false)
  assert.equal(c.chamadas.length, 0)
  // mensagem do banco (código nosso) passa; erro estranho vira texto genérico
  const dup = await denunciar('u', 'nome', 'outro', { cliente: falso({ data: null, error: { code: '23505', message: 'você já denunciou isso: a equipe vai analisar' } }) })
  assert.match(dup.erro, /já denunciou isso/)
  const feio = await denunciar('u', 'nome', 'outro', { cliente: falso({ data: null, error: { code: 'XX000', message: 'relation "x" does not exist' } }) })
  assert.doesNotMatch(feio.erro, /relation/)
  const rede = await denunciar('u', 'nome', 'outro', { cliente: falso(() => { throw new Error('fetch failed') }) })
  assert.match(rede.erro, /sem conexão/)
  // deslogado
  conta.update((s) => ({ ...s, estado: 'deslogado' }))
  assert.match((await denunciar('u', 'nome', 'outro', { cliente: c })).erro, /entre com sua conta/)
})
