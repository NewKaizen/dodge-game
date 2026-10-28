# Moderação: denúncias de nome e foto

Antes de abrir o jogo para gente de fora é preciso ter como tirar um nome ou
uma foto ofensivos. Este documento diz **como a denúncia chega**, **quem revisa**,
**com que frequência** e **que comando roda**.

## O que existe

| Peça | Onde | O que faz |
| --- | --- | --- |
| **DENUNCIAR…** | A numa linha da cena AMIGOS (amigos, pedidos recebidos, gente na sua sala) | escolhe nome ou foto + o motivo (lista fixa) |
| `denunciar(tag, tipo, motivo)` | `supabase/migrations/0004_moderacao.sql` | grava a denúncia; só o navegador logado chama |
| Tabela `denuncias` | mesma migration | `id, denunciante, denunciado, tipo ('nome'\|'foto'), motivo, estado ('aberta'\|'aceita'\|'rejeitada'), criada_em, revisada_em, revisor` |
| `scripts/moderar.js` | `npm run moderar -- <comando>` | lista as abertas, aceita ou rejeita (usa a chave secreta) |
| Filtro de palavrões | `src/lib/palavrasBloqueadas.js` + `src/lib/filtro/` + `nome_ofensivo()` no banco (0008) | censura o chat da sala e barra nomes ao **mudar** o nome |

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

## Filtro de palavrões (chat e nomes)

Um só filtro para o **chat da sala** (servidor, `censurarTexto`) e para os
**nomes** (`nomeOfensivo`, no navegador, no servidor e no banco).

### Como funciona

- Motor: biblioteca [`obscenity`](https://github.com/jo3-l/obscenity) 0.4.6
  (MIT, offline, sem chamada de rede), em `dependencies` (o Dockerfile instala
  com `npm ci --omit=dev`). Código em `src/lib/filtro/matcher.js`; fachada em
  `src/lib/palavrasBloqueadas.js`.
- Dados: o dicionário em inglês do próprio obscenity (menos as frases que dão
  falso positivo em português: `negro`, `cum`, `ass`, `anal`, `fag`, `retard`,
  `semen`, `rape`, `bestiality`) **mais** `src/lib/filtro/ptbr.js`
  (palavrões, termos sexuais, xingamentos e ódio em português, siglas como
  `vsf`, `vtnc`, `pqp`, `krl`, `fdp`, `tnc`, `pnc`, `sfd`, e inglês extra).
- Normalização antes de comparar: minúsculas, sem acento, "leet" desfeito
  (`0 1 3 4 5 7 @ $`), `_` e `2 6 8 9` viram espaço, `.` e `*` somem, letras
  repetidas juntadas (`porrrra`, `caraaalho`), caracteres "parecidos" de outros
  alfabetos resolvidos (só no JS).
- Dois jeitos de casar:
  - **EXATAS**: palavra inteira (com `s` de plural opcional). Para termos curtos
    ou que aparecem dentro de palavras inocentes: `cu` barra "cu" e "seu cu!",
    não "curso", "Cuiabá" nem "computador"; `puta` não barra "disputa".
  - **COLADAS**: valem coladas em outras palavras e com separadores no meio
    (`c.a.r.a.l.h.o`, `c a r a l h o`, `xcaralhox`). Só termos longos que não
    têm uso inocente: ao ignorar espaços, letras de palavras vizinhas se juntam
    ("via do" viraria "viado"), por isso `viado` é EXATA.
- **PERMITIDAS** (lista branca): texto inocente que contém um termo
  (`cacetinho`, `cacetete`, `shiitake`, ...). O dicionário em inglês traz as
  dele (`Dickens`, `Scunthorpe`-style).
- **LEVES** (`otario`, `burro`, `idiota`, ...): xingamento brando, **não** é
  barrado por padrão; `nomeOfensivo(t, { leves: true })` e
  `censurarTexto(t, { leves: true })` incluem.
- Decisões de palavras comuns: `pinto`, `negro`, `preto` e `macaco` **não** são
  barradas (palavras do dia a dia); `veado` é (xingamento mais comum que o bicho).
  `kkk` ficou de fora (em português é risada).
- Chat: cada trecho achado vira asteriscos do mesmo tamanho (um por caractere) e
  o resto da mensagem fica igual: `que PORRA de jogo` vira `que ***** de jogo`.

### Como acrescentar uma palavra

1. Edite `src/lib/filtro/ptbr.js`: a palavra em minúsculas, sem acento, só `a-z`
   (`EXATAS` se for curta ou aparecer dentro de outras; `COLADAS` se for longa
   e sem uso inocente). Se um texto inocente cair, ponha em `PERMITIDAS`.
2. Acrescente o caso em `src/lib/__tests__/filtroCasos.js` (`POSITIVOS` ou
   `NEGATIVOS`).
3. Regere a migration: `node scripts/gerar-filtro-sql.mjs` (reescreve
   `supabase/migrations/0008_filtro_palavras.sql`; o teste falha se ela ficar
   desatualizada) e rode `npm test`.
4. Publique o servidor (o chat passa a barrar na hora) e rode a 0008 no banco
   (abaixo). **Nunca** edite as migrations 0001–0007 (já estão no ar).

### Rodar a 0008 no Supabase

No **SQL Editor** do projeto, cole o conteúdo de
`supabase/migrations/0008_filtro_palavras.sql` e rode (pode rodar de novo: é
`create or replace`). Ela só troca `nome_ofensivo()`; `atualizar_perfil` e
`criar_perfil` (0004/0005) já chamam essa função e não mudam. Nomes que já estão
no ar continuam como estão (a 0008 não renomeia ninguém): só vale para quem criar
conta ou trocar de nome daqui para a frente. Para trocar por `JOGADOR` os que já
existem e agora caem no filtro, rode uma vez:
`update public.perfis set nome_exibicao = 'JOGADOR' where public.nome_ofensivo(nome_exibicao);`

O SQL é **gerado** dos mesmos dados do JS; as diferenças que sobram: o banco não
resolve caracteres "parecidos" de outros alfabetos (o JS barra antes). O teste
`server/__tests__/moderacaoSql.test.js` (com `DODGE_PG`, veja o topo do arquivo)
compara o banco com o JS nos casos de `filtroCasos.js`.

O nome de **convidado** (sem conta, sem tag: não dá para denunciar) passa pela
mesma lista no servidor do lobby (`server/lan.js`): o que cai nela aparece como
`JOGADOR` para os outros (na sala e no Jogar Rápido), e trocar para um nome assim
é recusado.

O **nome inicial vindo do Google** também passa pelo filtro (Fase 2F, migration
0005): `criar_perfil` troca um nome da lista por `JOGADOR` (e a tag nasce do nome
já filtrado, nunca da palavra); os perfis que já existiam com nome da lista foram
trocados por `JOGADOR` ao rodar a 0005. O servidor repete o filtro no nome que lê
do perfil (`nomeSeguro`, `src/lib/contaRegras.js`), e `nomeInicialDoGoogle` é o
espelho em JS do SQL (conferido em `pendenciasSql.test.js`).

Limites conhecidos: não pega "f d p" com espaços (as siglas curtas só valem como
palavra inteira), nem variações criativas (a denúncia cobre). O filtro acrescenta
~200 KB (minificado) ao pacote do navegador por causa do obscenity.

## O que a revisão NÃO faz (Fase 1)

Sem banimento próprio, sem aviso à pessoa denunciada, sem retorno ao
denunciante, sem fila no navegador. Tudo isso entra na consolidação, se o teste
mostrar que faz falta.
