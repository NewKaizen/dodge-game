# Contas com Supabase (login Google, perfil e foto)

Guia para ligar as contas do jogo. **É opcional:** sem estas variáveis o jogo
funciona igual (LAN, casual, ONLINE por código), só aparece "contas
indisponíveis" e todo mundo joga como convidado.

Como as peças se juntam:

| Peça | Papel |
| --- | --- |
| Supabase Auth | login com Google; a sessão fica guardada no navegador (supabase-js) |
| Postgres (`perfis`, `estatisticas_basicas`) | perfil público; RLS deixa o navegador só **ler** e mudar nome/avatar pela função `atualizar_perfil` |
| Storage (bucket `avatares`) | fotos de perfil, leitura pública; **só o servidor grava** |
| Servidor Node (`server/contas.js`) | entrega a URL + chave anon em `GET /api/config`, valida o JWT no lobby e recebe as fotos (`/api/avatar`) |
| Postgres (`amizades`, `pedidos_amizade`, `bloqueios`) | amigos (migration 0002); o navegador só usa as funções, o servidor lê para filtrar presença e convites |
| Postgres (`partidas`, `concessoes`, `inventario`, `catalogo_itens`) | XP, níveis e Coleção (migration 0003); só o servidor concede (`conceder_recompensa`), o navegador lê o catálogo e o próprio inventário e equipa |
| Postgres (colunas `ref`/`oponente_ref`) | CO-OP com XP, convidados no limite diário e filtro do nome do Google (migration 0005) |
| Postgres (`denuncias`) | denúncias de nome e foto (migration 0004); o navegador só chama `denunciar()`, a revisão é pelo `scripts/moderar.js` (`docs/moderacao.md`) |

A chave `service_role` fica **só no servidor**. O navegador recebe a URL e a
chave `anon` pelo `/api/config` (nada de `VITE_*` no build).

---

## 1. Criar o projeto

1. Entre em <https://supabase.com> → **New project**.
2. Escolha um nome (ex.: `dodge-game`), uma senha forte para o banco (guarde)
   e a região mais perto dos jogadores (ex.: *South America (São Paulo)*).
3. Espere o projeto subir (1–2 minutos).

## 2. Rodar a migration

1. No painel: **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `supabase/migrations/0001_contas.sql` e clique em **Run**.
3. Confira em **Table Editor** que existem `perfis` e `estatisticas_basicas`, as
   duas com o cadeado de **RLS enabled**.

A migration também cria o bucket `avatares` (público, só WebP, até 256 KB por
arquivo). Se preferir usar a CLI: `supabase link` + `supabase db push`.

> Pode rodar de novo sem medo: os comandos usam `if not exists` / `or replace`.

### 2.1 Migration 0002: amigos (Fase 1B)

Depois da 0001, rode do mesmo jeito (SQL Editor → New query → Run) o conteúdo
de `supabase/migrations/0002_amigos.sql`. Ela cria `pedidos_amizade`,
`amizades` e `bloqueios` (as três com RLS ligado e **sem nenhuma política**: o
navegador não lê nem escreve nelas direto) e as funções que o jogo chama:
`enviar_pedido_amizade(tag)`, `responder_pedido_amizade`, `cancelar_pedido_amizade`,
`remover_amigo`, `bloquear`, `desbloquear`, `listar_amigos` e `listar_bloqueados`.
Todas usam `auth.uid()` (o cliente nunca diz quem ele é).

Regras: quem bloqueou (ou foi bloqueado) não manda pedido; pedir amizade a quem
já te pediu aceita na hora; no máximo 30 pedidos enviados em aberto, 100
recebidos por pessoa e 200 amigos; bloquear desfaz a amizade e apaga os pedidos
dos dois lados. Também pode rodar de novo sem problema.

Conferir: em **Table Editor** as três tabelas aparecem com o cadeado de RLS; o
servidor (chave secret) lê essas tabelas para a presença e os convites, então
nada muda nas variáveis de ambiente.

### 2.2 Migration 0003: XP, níveis e Coleção (Fase 1D)

Depois da 0002, rode do mesmo jeito o conteúdo de
`supabase/migrations/0003_progresso.sql`. Ela cria:

- `partidas` e `partida_participantes` (o registro de cada partida PVP online),
  `concessoes` (uma linha por conta por partida: o que impede dar XP duas vezes),
  `catalogo_itens` (a trilha de cosméticos, já preenchida) e `inventario`;
- as colunas `moldura_equipada` e `verso_equipado` em `perfis`;
- as funções **do servidor** `registrar_partida`, `encerrar_partida` e
  `conceder_recompensa` (o navegador não consegue chamar: `revoke` para `anon`
  e `authenticated`; o servidor chama com a chave secret);
- a função do navegador `equipar(tipo, item)` (só equipa o que a conta tem).

RLS: o navegador lê o catálogo e **só o próprio** inventário; não lê partidas
nem concessões e não escreve em nada disso. Pode rodar de novo sem problema.

Conferir: em **Table Editor** aparecem as cinco tabelas novas com o cadeado de
RLS, e `catalogo_itens` tem 17 linhas. Nada muda nas variáveis de ambiente.
Regras do XP, da validação dos resultados e a curva: `docs/online.md`.

Para testar o SQL num Postgres local (descartável):
`DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test` roda as três
migrations duas vezes num banco temporário e confere a `conceder_recompensa`
(idempotente, duas sessões ao mesmo tempo, permissões do navegador). O
`moderacaoSql.test.js` roda as quatro e confere `denunciar` (limites, RLS fechada)
e o filtro de nomes; o `amigosSql.test.js` roda a 0001–0002 e confere que cada
função de amigos só age sobre a conta do JWT.

### 2.3 Migration 0004: moderação (Fase 1E)

Depois da 0003, rode `supabase/migrations/0004_moderacao.sql`. Ela cria:

- a tabela `denuncias` (RLS ligado, **sem nenhuma política**: o navegador não
  lê nem escreve; quem lê é o servidor com a chave secret);
- a função do navegador `denunciar(tag, tipo, motivo)`: precisa de login, não
  aceita denunciar a si mesmo, uma denúncia aberta por par e tipo, no máximo 10
  por dia por conta;
- `nome_ofensivo()` e uma nova `atualizar_perfil` que barra nomes da lista de
  palavras (a mesma lista de `src/lib/palavrasBloqueadas.js`).

Quem revisa e como: `docs/moderacao.md`. Pode rodar de novo sem problema.
Conferir: em **Table Editor** aparece `denuncias` com o cadeado de RLS.

### 2.4 Migration 0005: pendências da Fase 1 (Fase 2F)

Depois da 0004, rode `supabase/migrations/0005_pendencias.sql` (depende da 0001,
da 0003 e da 0004; roda de novo sem estragar). Ela:

- passa a contar a repetição diária do XP **por modo** (PVP e CO-OP separados) em
  `conceder_recompensa`, o que deixa o CO-OP de 2 jogadores dar XP pelo mesmo
  caminho do PVP (o PVP não muda);
- guarda a chave do convidado (`partida_participantes.ref`, `concessoes.oponente_ref`)
  para o limite diário contra convidados ser **por conexão** (o mesmo endereço da
  conta continua contando como um só) e cria `convidados_limite_dia()` (10);
- faz o nome inicial vindo do Google passar pelo filtro de nomes (`nome_ofensivo`):
  nome da lista vira `JOGADOR` (a tag nasce do nome já filtrado) e os perfis
  que já existiam com nome da lista também viram `JOGADOR` (a tag não muda).

Sem rodar a 0005 o servidor novo funciona igual ao antigo: o CO-OP é registrado e
decidido, mas o limite diário conta modos e convidados juntos como antes, e o nome
do Google só passa pelo filtro do servidor (o `JOGADOR` que os outros veem), não no banco.
O `pendenciasSql.test.js` roda a 0001–0005 duas vezes e confere tudo isso.

## 3. Conferir o bucket

Em **Storage** deve aparecer o bucket `avatares`, marcado como **Public**.
Se não apareceu (projeto antigo sem a tabela `storage.buckets`), crie à mão:

- **New bucket** → nome `avatares` → **Public bucket** ligado.
- *Allowed MIME types*: `image/webp`. *File size limit*: `256 KB`.
- **Não** crie políticas (policies) de escrita para esse bucket: quem grava é
  o servidor com a `service_role`, que não passa pelas políticas.

## 4. Ligar o login com Google

### 4.1 No Google Cloud Console

1. Abra <https://console.cloud.google.com> e crie (ou escolha) um projeto.
2. **APIs e serviços → Tela de consentimento OAuth**: tipo **Externo**, preencha
   nome do app (ex.: DODGE), e-mail de suporte e e-mail do desenvolvedor.
   Escopos: os padrão (`email`, `profile`, `openid`) bastam. Enquanto estiver em
   "Teste", adicione os e-mails de quem vai testar em **Usuários de teste**.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: `https://SEU-APP.onrender.com` e
     `http://localhost:5180` (e `http://localhost:5173` para o `npm run dev`).
   - **URIs de redirecionamento autorizados**: só a do Supabase:
     `https://<ref-do-projeto>.supabase.co/auth/v1/callback`
     (está em Supabase → **Authentication → Providers → Google**, campo
     *Callback URL*).
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.

### 4.2 No Supabase

1. **Authentication → Providers → Google** → ligue **Enable**.
2. Cole o *Client ID* e o *Client Secret* do passo anterior e salve.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://SEU-APP.onrender.com`
   - **Redirect URLs** (uma por linha):
     - `https://SEU-APP.onrender.com/**`
     - `http://localhost:5180/**`
     - `http://localhost:5173/**`

   O jogo volta do Google para a mesma página em que estava (`redirectTo` =
   endereço atual); endereço fora dessa lista cai na *Site URL*.

## 5. Pegar as chaves

Em **Project Settings → API** (ou **API Keys**):

| Variável | Onde está | Pode ir para o navegador? |
| --- | --- | --- |
| `SUPABASE_URL` | *Project URL* (`https://<ref>.supabase.co`) | sim |
| `SUPABASE_PUBLISHABLE_KEY` | chave *publishable* (`sb_publishable_...`; antiga `anon`) | sim (o RLS protege) |
| `SUPABASE_SECRET_KEY` | chave *secret* (`sb_secret_...`; antiga `service_role`) | **nunca** |

Os nomes antigos `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` continuam valendo.
`SUPABASE_JWKS_URL` não é usada (o servidor valida o token com `auth.getUser`).

## 6. Configurar no Render

No serviço `dodge-game` → **Environment** → preencha as três variáveis (o
`render.yaml` já declara as três com `sync: false`, então o painel pede os
valores). Salve: o Render reinicia o serviço.

No log do deploy deve aparecer `Contas:   ligadas (Supabase)`.

Docker / outra hospedagem: passe as três variáveis ao **rodar** o contêiner
(`docker run -e SUPABASE_URL=... -e SUPABASE_PUBLISHABLE_KEY=... -e SUPABASE_SECRET_KEY=...`).
Não precisam existir no build.

## 7. Testar localmente

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
export SUPABASE_SECRET_KEY=<sb_secret_...>

npm run online          # compila e sobe em http://localhost:5180
# ou: npm run dev       # http://localhost:5173 (o Vite também liga /api/*)
```

1. Abra a página, aperte uma tecla (o teclado liga sozinho) e vá em **PERFIL** no menu
   inicial: **ENTRAR COM GOOGLE**.
2. Entre: volta para o jogo; o **PERFIL** mostra o seu avatar, nome, `#tag`,
   nível, XP, título e estatísticas (e leva à **COLEÇÃO** e aos **AMIGOS**).
3. Troque o nome, escolha um personagem como avatar, envie uma foto (o
   seletor e o recorte quadrado com prévia abrem por cima do jogo) e remova a foto.
4. No **Table Editor → perfis** confira as mudanças; em **Storage → avatares**
   aparece `<seu id>.webp`.
5. Abra o modo ONLINE/LAN e crie uma sala: o nome no lobby é o do perfil.
6. Amigos (precisa da migration 0002): entre com **duas contas Google** em dois
   navegadores/perfis. Numa, ONLINE → **AMIGOS** (ou PERFIL → AMIGOS) →
   **+ ADICIONAR PELA TAG** → digite a tag da outra (`nome#1234`, no perfil) e
   Enter. A outra recebe o aviso "quer ser seu amigo" e responde em
   **PEDIDOS** (A → **ACEITAR**). Os dois aparecem com bolinha verde;
   **CONVIDAR** (A na linha do amigo) cria uma sala e a outra conta recebe o
   aviso com **A aceitar / B recusar**.
7. XP (precisa da migration 0003): com as duas contas, joguem uma partida PVP
   online inteira (Jogar Rápido ou sala de amigos, mais de 60 s). O painel de
   XP aparece no fim; no **Table Editor** confira `partidas` (`recompensada`),
   `concessoes` e o `xp` em `perfis`. Roteiro completo em `docs/online.md`.

Sem as variáveis, `curl localhost:5180/api/config` responde
`{"disponivel":false}` e o jogo mostra "contas indisponíveis".

Os testes automáticos (`npm test`) não precisam de nada disso: usam um Supabase
falso (`server/supabase/fake.js`).

## Regras que valem (e onde estão)

- **Nome de exibição**: 3 a 16 caracteres, letras (com acento), números,
  espaço, `_ . -`, e sem palavras da lista bloqueada (`docs/moderacao.md`). Conferido no navegador (`src/lib/contaRegras.js`), na função
  `atualizar_perfil` e nos `CHECK` da tabela.
- **Tag** (`joao#4821`): gerada pelo banco quando a conta é criada; única e
  fixa (não muda com o nome). É por ela que os amigos vão achar você (1B).
- **Nível, XP, tag e foto** (`avatar_url`): o navegador não consegue gravar
  (sem `GRANT` de escrita e sem política de update). Quem grava é o servidor.
- **XP e itens**: só pela `conceder_recompensa`, que só o servidor chama, uma
  vez por partida (as regras estão em `docs/online.md`).
- **Foto**: PNG/JPEG/WebP de até 2 MB e entre 64 e 4096 px de lado. O servidor
  confere os bytes do arquivo (não a extensão), recodifica em WebP 256×256 sem
  metadados (sai EXIF/GPS) e grava em `avatares/<id>.webp`. Máximo de 5
  envios por minuto por conta e 40 pedidos por minuto por endereço (barrado
  antes de falar com o Supabase Auth, para token falso não custar nada).
- **Amigos**: a tag (`joao#4821`) é como se acha alguém. Presença e convites
  vivem no servidor do lobby e só valem entre amigos (amizade dos dois lados e
  sem bloqueio). Veja `docs/online.md`.
- **Lobby**: o `ola` leva o JWT só para o servidor que serviu a página (nunca
  para o servidor de outro PC da LAN). Token inválido = joga como convidado.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| "contas indisponíveis" | falta alguma das três variáveis no servidor (veja o log) |
| Google diz `redirect_uri_mismatch` | a URI de redirecionamento no Google não é a `.../auth/v1/callback` do Supabase |
| Volta do Google para outra página | o endereço não está em **Redirect URLs** do Supabase |
| "não deu para carregar o perfil" | a migration não rodou (sem a tabela `perfis` ou sem o gatilho) — rode de novo |
| Foto dá erro 502 | o bucket `avatares` não existe, ou a `SUPABASE_SECRET_KEY` está errada |
| Conta criada antes da migration sem perfil | rode a migration de novo: ela cria o perfil de quem ainda não tem |
