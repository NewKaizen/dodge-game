// scripts/moderar.js com o Supabase falso: argumentos, listar, aceitar (foto e
// nome), rejeitar e os erros. Sem rede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretar, criarModerador, executar, formatarLista, NOME_NEUTRO } from '../../scripts/moderar.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { BUCKET_AVATARES } from '../contas.js'

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const C = '00000000-0000-0000-0000-00000000000c'
const D1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const D2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const D3 = 'bbbbbbbb-0000-0000-0000-000000000003'
const D4 = 'cccccccc-0000-0000-0000-000000000004'

function cenario() {
  const sb = criarSupabaseFalso({
    perfis: [
      { id: A, tag: 'ana#1111', nome_exibicao: 'Ana', avatar_tipo: 'padrao', avatar_id: null, avatar_url: null },
      { id: B, tag: 'beto#2222', nome_exibicao: 'Beto Mau', avatar_tipo: 'enviado', avatar_id: null, avatar_url: `https://x/${B}.webp?v=1` },
      { id: C, tag: 'caio#3333', nome_exibicao: 'Caio', avatar_tipo: 'padrao', avatar_id: null, avatar_url: null },
    ],
  })
  sb.arquivos.set(`${BUCKET_AVATARES}/${B}.webp`, { dados: Buffer.from('x') })
  const den = (id, denunciante, denunciado, tipo, criada_em) => ({ id, denunciante, denunciado, tipo, motivo: 'motivo ' + tipo, estado: 'aberta', criada_em, revisada_em: null, revisor: null })
  sb.tabelas.denuncias.push(den(D2, C, B, 'foto', '2026-10-25T12:00:00Z'), den(D1, A, B, 'foto', '2026-10-25T10:00:00Z'), den(D3, A, B, 'nome', '2026-10-25T11:00:00Z'), den(D4, B, C, 'nome', '2026-10-25T13:00:00Z'))
  return sb
}
const denuncia = (sb, id) => sb.tabelas.denuncias.find((d) => d.id === id)
const perfil = (sb, id) => sb.tabelas.perfis.find((p) => p.id === id)

test('argumentos: comandos, id, revisor e erros', () => {
  assert.deepEqual(interpretar([]), { comando: 'ajuda' })
  assert.deepEqual(interpretar(['--help']), { comando: 'ajuda' })
  assert.deepEqual(interpretar(['listar']), { comando: 'listar', json: false })
  assert.deepEqual(interpretar(['listar', '--json']), { comando: 'listar', json: true })
  assert.deepEqual(interpretar(['aceitar', 'AAAAAAAA']), { comando: 'aceitar', id: 'aaaaaaaa', revisor: null })
  assert.deepEqual(interpretar(['rejeitar', D1, '--revisor', 'Maria']), { comando: 'rejeitar', id: D1, revisor: 'Maria' })
  assert.match(interpretar(['aceitar']).erro, /precisa do id/)
  assert.match(interpretar(['aceitar', 'x; drop']).erro, /id inválido/)
  assert.match(interpretar(['aceitar', 'abc']).erro, /id inválido/) // curto demais
  assert.match(interpretar(['apagar', D1]).erro, /comando desconhecido/)
  assert.match(interpretar(['listar', D1]).erro, /não recebe id/)
  assert.match(interpretar(['aceitar', D1, D2]).erro, /demais/)
  assert.match(interpretar(['listar', '--tudo']).erro, /opção desconhecida/)
  assert.match(interpretar(['rejeitar', D1, '--revisor']).erro, /precisa de um nome/)
})

test('listar: só as abertas, da mais antiga para a mais nova, com o nome e a foto de agora', async () => {
  const sb = cenario()
  sb.tabelas.denuncias.push({ id: 'dddddddd-0000-0000-0000-000000000005', denunciante: A, denunciado: C, tipo: 'nome', motivo: 'velha', estado: 'rejeitada', criada_em: '2026-10-01T00:00:00Z', revisada_em: '2026-10-02T00:00:00Z', revisor: 'x' })
  const itens = await criarModerador(sb).listar()
  assert.deepEqual(itens.map((i) => i.id), [D1, D3, D2, D4])
  assert.equal(itens[0].denunciado, 'beto#2222')
  assert.equal(itens[0].denunciante, 'ana#1111')
  assert.equal(itens[1].nome_atual, 'Beto Mau')
  assert.match(itens[0].foto_atual, /beto|x\//)
  const texto = formatarLista(itens)
  assert.match(texto, /FOTO/)
  assert.match(texto, /motivo: motivo nome/)
  assert.equal(formatarLista([]), 'nenhuma denúncia aberta')
})

test('aceitar foto: apaga o arquivo, volta ao padrão e fecha as outras do mesmo caso', async () => {
  const sb = cenario()
  const r = await criarModerador(sb, { agora: () => new Date('2026-10-26T00:00:00Z') }).aceitar(D1, 'Maria')
  assert.equal(r.tipo, 'foto')
  assert.equal(r.tambemFechadas, 1) // a D2 (outra pessoa, mesma foto)
  assert.equal(sb.arquivos.has(`${BUCKET_AVATARES}/${B}.webp`), false)
  assert.deepEqual([perfil(sb, B).avatar_tipo, perfil(sb, B).avatar_url, perfil(sb, B).nome_exibicao], ['padrao', null, 'Beto Mau'])
  assert.deepEqual([denuncia(sb, D1).estado, denuncia(sb, D1).revisor, denuncia(sb, D1).revisada_em], ['aceita', 'Maria', '2026-10-26T00:00:00.000Z'])
  assert.equal(denuncia(sb, D2).estado, 'aceita')
  // a de NOME do mesmo jogador e as dos outros continuam abertas
  assert.equal(denuncia(sb, D3).estado, 'aberta')
  assert.equal(denuncia(sb, D4).estado, 'aberta')
})

test('aceitar nome: troca por JOGADOR e mantém a tag', async () => {
  const sb = cenario()
  await criarModerador(sb).aceitar(D3)
  assert.equal(perfil(sb, B).nome_exibicao, NOME_NEUTRO)
  assert.equal(perfil(sb, B).tag, 'beto#2222')
  assert.equal(perfil(sb, B).avatar_tipo, 'enviado') // a foto não é mexida
  assert.equal(denuncia(sb, D3).revisor, 'cli')
  assert.equal(sb.chamadas.some((c) => c.op === 'remove'), false)
})

test('rejeitar: só fecha; o perfil não muda', async () => {
  const sb = cenario()
  const antes = JSON.stringify(sb.tabelas.perfis)
  await criarModerador(sb).rejeitar(D4, 'Maria')
  assert.equal(denuncia(sb, D4).estado, 'rejeitada')
  assert.equal(JSON.stringify(sb.tabelas.perfis), antes)
  assert.equal(sb.chamadas.some((c) => c.op === 'remove'), false)
})

test('erros: id que não existe, já revisada, começo ambíguo, falha do Storage e do banco', async () => {
  const sb = cenario()
  const mod = criarModerador(sb)
  await assert.rejects(mod.aceitar('ffffffff'), /não achei denúncia aberta/)
  await mod.rejeitar(D4)
  await assert.rejects(mod.aceitar(D4), /já foi rejeitada/)
  await assert.rejects(mod.aceitar('aaaaaaaa'), /mais de uma denúncia/) // D1 e D2 começam igual
  // o Storage falha: nada é fechado e a foto continua
  sb.falhar.remove = true
  await assert.rejects(mod.aceitar(D1), /apagar a foto/)
  assert.equal(denuncia(sb, D1).estado, 'aberta')
  assert.equal(perfil(sb, B).avatar_tipo, 'enviado')
  sb.falhar.remove = false
  sb.falhar.denuncias = true
  await assert.rejects(mod.listar(), /ler denúncias/)
})

test('executar: sem chaves, comando inválido e fluxo feliz com cliente injetado', async () => {
  const sb = cenario()
  const saidas = []
  const erros = []
  const io = { criarCliente: async () => sb, saida: (t) => saidas.push(t), erro: (t) => erros.push(t) }
  assert.equal(await executar(['listar'], {}, io), 2)
  assert.match(erros.at(-1), /faltam SUPABASE_URL/)
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }
  assert.equal(await executar(['apagar'], env, io), 2)
  assert.equal(await executar([], env, io), 0)
  assert.equal(await executar(['listar', '--json'], env, io), 0)
  assert.equal(JSON.parse(saidas.at(-1)).length, 4)
  assert.equal(await executar(['aceitar', D3, '--revisor', 'Ana'], env, io), 0)
  assert.match(saidas.at(-1), /nome trocado por JOGADOR/)
  assert.equal(await executar(['aceitar', D3], env, io), 1)
  assert.match(erros.at(-1), /já foi aceita/)
  // as chaves nunca aparecem na saída
  assert.equal([...saidas, ...erros].some((t) => t.includes('sb_secret_x')), false)
})
