# Moderação: denúncias de nome e foto

Antes de abrir o jogo para gente de fora é preciso ter como tirar um nome ou
uma foto ofensivos. Este documento diz **como a denúncia chega**, **quem revisa**,
**com que frequência** e **que comando roda**.

## O que existe

| Peça | Onde | O que faz |
| --- | --- | --- |
| Botão **Denunciar…** | cartões do painel AMIGOS (amigos, pedidos recebidos, gente na sua sala) | escolhe nome ou foto + o motivo (lista fixa) |
| `denunciar(tag, tipo, motivo)` | `supabase/migrations/0004_moderacao.sql` | grava a denúncia; só o navegador logado chama |
| Tabela `denuncias` | mesma migration | `id, denunciante, denunciado, tipo ('nome'\|'foto'), motivo, estado ('aberta'\|'aceita'\|'rejeitada'), criada_em, revisada_em, revisor` |
| `scripts/moderar.js` | `npm run moderar -- <comando>` | lista as abertas, aceita ou rejeita (usa a chave secreta) |
| Filtro de nomes | `src/lib/palavrasBloqueadas.js` + `nome_ofensivo()` no banco | barra nomes com palavras da lista ao **mudar** o nome |

### Regras da denúncia (no banco)

- Precisa estar logado; não dá para denunciar a si mesmo.
- **Uma denúncia aberta por par** (quem denuncia, quem é denunciado) **e tipo**.
  Depois de revisada, a mesma pessoa pode denunciar de novo.
- **Limite: 10 denúncias por dia por conta** (janela de 24 h). Passou, a função
  responde "você já fez denúncias demais hoje".
- Motivo: de 3 a 200 letras (a tela manda um dos textos fixos do seletor).
- Foto só pode ser denunciada se a pessoa tem foto enviada.
- **Ninguém lê denúncia pelo navegador** (nem as próprias, nem as dos outros): a
  tabela tem RLS ligado, sem política e sem `GRANT`. Só o servidor com a chave
  secreta lê e revisa.

## Quem revisa e quando

> Decisão pendente do dono do projeto: o texto abaixo é a proposta padrão.

- **Revisor:** o dono do projeto (ou quem ele indicar e que tenha a chave
  secreta). Poucas pessoas: a chave dá acesso total ao banco.
- **Frequência:** uma vez por dia enquanto o teste for restrito (veja
  `docs/teste-fase1.md`); depois, olhar o `listar` ao abrir o dia e sempre que
  alguém avisar por fora que denunciou.
- **Prazo alvo:** denúncia de foto ou nome ofensivo resolvida em até 24 h.
  Fora do prazo, o próprio denunciante não vê nada mudar: por isso o prazo importa.
- **Pior caso (ofensa grave):** aceite na hora e, se a conta continuar abusando,
  bloqueie o usuário no painel do Supabase (**Authentication → Users → ⋯ → Ban
  user**). O jogo não tem banimento próprio na Fase 1.

## Como revisar (passo a passo)

Precisa do Node 20+ e do repositório. As duas variáveis são as mesmas do Render:

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SECRET_KEY="sb_secret_..."     # nunca em arquivo do repositório

npm run moderar -- listar
```

A lista mostra, da mais antiga para a mais nova: id, data, tipo, a tag de quem foi
denunciado com o **nome ou a foto de agora**, quem denunciou e o motivo. Abra a
foto (a URL aparece) e decida:

```bash
npm run moderar -- aceitar  <id>   # foto: apaga o arquivo e volta ao avatar padrão
                                   # nome: troca por JOGADOR (a tag continua a mesma)
npm run moderar -- rejeitar <id>   # fecha sem mexer no perfil
```

Detalhes:

- O `<id>` pode ser só o começo (8 letras bastam, se não houver outro igual).
- `--revisor "Nome"` registra quem decidiu (padrão: `cli`). `--json` no `listar`
  para guardar a fila.
- **Aceitar** também fecha as outras denúncias abertas do **mesmo jogador e
  tipo** (vira tudo uma decisão só).
- A pessoa pode voltar a mudar o nome ou subir outra foto. Se repetir, aceite de
  novo e considere o ban. O filtro de palavras só pega o óbvio.
- Se o Storage falhar ao apagar a foto, nada é fechado: rode o `aceitar` de novo.

## Filtro de nomes

Lista curta, em pt e en, em `src/lib/palavrasBloqueadas.js` (`PALAVRAS_EXATAS`
só valem como palavra inteira; `PALAVRAS_CONTIDAS` valem coladas e com pontuação
no meio). A função `nome_ofensivo()` da migration 0004 tem **as mesmas listas** e
é conferida em `atualizar_perfil`; o teste `server/__tests__/moderacaoSql.test.js`
falha se as duas divergirem. Para mudar a lista: edite o JS **e** o SQL (um novo
`create or replace function` numa migration nova) juntos.

Limites conhecidos: o filtro só roda quando a pessoa **muda** o nome; o nome
inicial vem do Google e não passa por ele (a denúncia cobre). Não pega
"f d p" com espaços, nem variações criativas.

## O que a revisão NÃO faz (Fase 1)

Sem banimento próprio, sem aviso à pessoa denunciada, sem retorno ao
denunciante, sem fila no navegador. Tudo isso entra na consolidação, se o teste
mostrar que faz falta.
