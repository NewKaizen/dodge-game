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
  palavras (lista ampliada pela 0008: `supabase/migrations/0008_filtro_palavras.sql`, gerada de `src/lib/filtro/`; veja `docs/moderacao.md`).

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

### 2.5 Migration 0006: base para 3 e 4 jogadores (Fase 5A)

Depois da 0005, rode `supabase/migrations/0006_n_jogadores.sql` (depende da 0003 e
da 0005; roda de novo sem estragar). Ela:

- aceita os modos `coop4` (CO-OP de 3–4), `ffa` (todos contra todos) e `2x2` e
  lados de 0 a 3 (`partidas.vencedor_lado` também);
- cria `partida_participantes.time` (0/1, só no 2x2) e `.colocacao` (1º a 4º, só no
  todos contra todos), gravados por `registrar_partida` e `encerrar_partida` (as
  chaves são opcionais no JSON: os modos de 2 não mandam);
- faz `conceder_recompensa` ler **uma linha por conta** (com N lados o "outro lado"
  são vários): o "oponente" do limite diário é o primeiro outro lado com conta.

Os modos de 2 dão exatamente o mesmo XP de antes. O servidor ainda **não registra**
partidas dos modos novos (`MODOS_COM_XP` em `server/partidas.js`): rodar a 0006 antes
da 5B é seguro e não muda nada para quem joga. `nJogadoresSql.test.js` roda a
0001–0006 duas vezes e confere os modos de 2, uma partida de 4 lados e o 2x2.

### 2.6 Migration 0011: campanha (modo história)

Depois das anteriores (0007–0010 estão descritas em `docs/online.md` e `docs/boss-semanal.md`), rode
`supabase/migrations/0011_campanha.sql` (depende da 0001, 0003 e 0010; roda de novo sem estragar).
Ela cria `campanha_progresso`, `campanha_escolhas` e `campanha_corridas` (RLS: cada um lê só o seu),
põe os cosméticos do Mundo 1 no catálogo (`campanha = 'mundo1'`, nível 1000) e as funções que **só o
servidor** chama: `progresso_campanha`, `campanha_escolher` e `conceder_campanha` (idempotente pelo
id da corrida, com o teto de 300 XP de campanha por dia). Detalhes e o modelo anti-trapaça em
[campanha.md](campanha.md). `campanhaSql.test.js` roda a 0001–0012 duas vezes (com `DODGE_PG`).

### 2.7 Migration 0012: nomes do Mundo 1 da campanha

`supabase/migrations/0012_campanha_mundo1.sql` (depende da 0011; idempotente). O Mundo 1 virou "A Casa
Silenciosa": a 0012 só troca os **nomes** dos três cosméticos (Quem Deixou a Luz Acesa, Vitral
Silencioso, Porta Entreaberta). Os ids e o `campanha_quando` continuam os da 0011.

### 2.8 Migrations 0013 e 0014: desafio diário, conquistas e maestria

Rode, nesta ordem, `supabase/migrations/0013_desafio_diario.sql` (depende da 0001, 0002, 0003 e 0010) e
`supabase/migrations/0014_conquistas_maestria.sql` (depende da 0013). As duas rodam de novo sem estragar.
A 0013 cria `desafio_corridas`, `desafio_recordes`, `desafio_concluidos` e `desafio_semanas` e as funções
`desafio_estado` e `conceder_desafio`; a 0014 cria `conta_eventos`, `maestria` e `conquistas`, os 14
cosméticos de maestria no catálogo e as funções `registrar_evento_conta`, `desbloquear_conquistas` e
`conquistas_da_conta`. RLS: cada conta lê só o seu; só o servidor (`service_role`) chama as funções.
Sem elas o resto do jogo funciona, mas o desafio dá erro ao salvar e não há conquistas. Detalhes em
[desafio-diario.md](desafio-diario.md). `desafioSql.test.js` roda a 0001–0014 duas vezes (com `DODGE_PG`).

### 2.9 Migration 0015: baús e os slots novos de cosmético

Rode `supabase/migrations/0015_baus_cosmeticos.sql` (depende da 0001, 0003, 0010, 0013 e 0014; roda de novo
sem estragar). Ela abre os tipos `som`, `efeito` e `lancamento` no catálogo (com `raridade` e `bau`), põe os
46 itens do baú, cria `perfis.som_equipado`/`efeito_equipado`/`lancamento_equipado`, as tabelas `baus` e
`baus_contas` e as funções `conceder_bau`, `abrir_bau`, `baus_estado`, `equipar_conta` (só o servidor) e a
`equipar` nova (o navegador; os mesmos parâmetros). Sem ela o jogo entra normal (o servidor lê os slots numa
consulta à parte), mas não há baús. Detalhes em [baus.md](baus.md). `bausSql.test.js` roda a 0001–0015 duas
vezes (com `DODGE_PG`).

### 2.10 Migration 0016: estilos de carta e versos ilustrados

Rode `supabase/migrations/0016_cartas_estilos.sql` depois da 0015 (roda de novo sem estragar). Ela abre o tipo
`frente` no catálogo, cria `perfis.frente_equipada` (null = a frente clássica), põe os 22 itens novos do baú (10
estilos de carta e 12 versos ilustrados, todos com `bau = true` e raridade) e troca a `equipar_conta`/`equipar` para
aceitar o tipo `frente` (só o que a conta tem; as mesmas permissões da 0015). Sem ela o jogo entra normal (o servidor
e o navegador leem `frente_equipada` numa consulta à parte) e o baú só sorteia os itens da 0015. Detalhes em
[cosmeticos.md](cosmeticos.md).

**Atenção**: depois da 0016, **não rode a 0015 de novo** (ela recria a checagem dos ids sem o tipo `frente` e para
com erro, porque já existem itens `frente.*`). Para reaplicar, rode só a 0016. `bausSql.test.js` roda a 0001–0015
duas vezes e depois a 0016 duas vezes (com `DODGE_PG`).

### 2.11 Migration 0017: a Expedição do CO-OP

Rode `supabase/migrations/0017_expedicao.sql` depois da 0016 (depende da 0001, 0003, 0006, 0010, 0013 e 0015;
roda de novo sem estragar). Ela cria:

- os 4 **versos exclusivos** da Expedição no catálogo (`verso.exp_tabuleiro`, `verso.exp_sinal`, `verso.exp_dado`,
  `verso.exp_reciclador`; coluna nova `catalogo_itens.expedicao` = o chefão), com `nivel_requerido` 1000 e
  `bau = false` (nem a trilha nem o baú entregam);
- as tabelas `expedicoes` (uma linha por partida e conta: o XP a mais, a âncora da idempotência e do teto do dia) e
  `expedicoes_chefes` (a 1ª expedição completa de cada conta contra cada chefão: a trava do verso), com RLS (cada
  conta lê só as suas; o navegador não escreve);
- a função `conceder_expedicao(partida, chefão, lutas)` (SECURITY DEFINER, só o servidor): confere a partida de
  CO-OP **validada**, a duração mínima por luta e, conta por conta, o relato dela dizendo o mesmo chefão e as
  mesmas lutas; soma `expedicao_xp_luta()` por luta vencida + `expedicao_xp_completa()` (teto
  `expedicao_xp_teto_dia()`) e dá o verso na 1ª vez; chamar de novo devolve o que já foi;
- a fonte de baú nova **`expedicao`** (chave `expedicao:<AAAA-MM-DD>:<chefão>`; o `conceder_bau` é recriado com o
  ramo novo e as checagens de `baus.fonte`/`baus.chave` trocadas): o banco só concede se a conta completou a
  expedição daquele chefão naquele dia.

Sem a 0017 o jogo entra e joga normal (inclusive a Expedição): o servidor loga o erro de `conceder_expedicao` e
segue com o XP de sempre da partida. Depois da 0017, para reaplicar a 0015 rode a 0017 em seguida (a 0015 recria
o `conceder_bau` sem a fonte nova). Detalhes em [coop-cartas.md](coop-cartas.md) ("Expedição") e
[baus.md](baus.md). `expedicaoSql.test.js` roda a 0001–0015 duas vezes e depois a 0016 e a 0017 duas vezes (com
`DODGE_PG`).

### 2.12 Migration 0018: a Expedição semanal

O BOSS SEMANAL virou SEMPRE uma expedição (lacaios → tenente → o chefe da semana; [boss-semanal.md](boss-semanal.md)).
Rode `supabase/migrations/0018_expedicao_semanal.sql` **depois da 0017** (depende da 0010 e da 0017; roda de novo sem
estragar). A 0017 **não** foi editada; a 0018:

- abre a lista dos chefões da expedição para os semanais: `expedicao_chefes()` ganha `escuridao` e `ladra` (o
  `conceder_expedicao` passa a aceitar os dois: XP por luta, bônus de completar, baú do dia por chefão) e a função
  nova `semanal_chefes()` (`escuridao`, `ladra`);
- os 2 **versos exclusivos** novos (`verso.exp_breu` da Escuridão, `verso.exp_cofre` da Ladra; `expedicao_item()`
  e o check `catalogo_expedicao_formato` com os chefes novos);
- troca os checks de `expedicoes.chefe` e `expedicoes_chefes.chefe` (os da 0017 tinham a lista fixa) por
  `expedicoes_chefe_valido` / `expedicoes_chefes_chefe_valido`, com os semanais;
- recria o `conceder_bau`: a fonte `expedicao` confere o chefão por `expedicao_chefes()` (era a regex fixa da 0017);
- recria o `conceder_trofeu_semanal` (0010): o troféu da semana só sai para a conta cujo relato **completou a
  expedição semanal** (`relato.expedicao.chefe` em `semanal_chefes()` e `relato.expedicao.lutas = 3`), além de tudo
  o que a 0010 já conferia. O servidor Node confere o mesmo antes (`ladosDoTrofeu`, com o chefe da semana da partida).

Sem a 0018 o jogo funciona: a expedição semanal só não rende o extra da expedição (o `conceder_expedicao` recusa o
chefão semanal e o servidor loga) e o troféu sai como na 0010. **Atenção**: depois da 0018, **não rode a 0017 de novo
sozinha** (ela recria o check do catálogo só com os 4 chefões e para com erro, porque já existem os versos dos
semanais); para reaplicar, rode a 0017 e logo depois a 0018. `expedicaoSql.test.js` roda a 0001–0015 duas vezes, a
0016 e a 0017 duas vezes e depois a 0018 duas vezes (com `DODGE_PG`), e confere o verso e o baú da Ladra e o troféu só
para quem completou a expedição.

### 2.13 Migration 0019: os bots do JOGAR RÁPIDO

Rode `supabase/migrations/0019_bots.sql` **depois da 0018** (depende de 0001–0016; roda de novo sem estragar). Ela
prepara os **bots do JOGAR RÁPIDO** ([online.md](online.md#bots-do-jogar-rápido)): perfis de jogadores que o
servidor controla para a fila casual de PVP 1x1 não ficar vazia. A 0019:

- cria a tabela **`public.bots`** (`user_id`, `faixa`, `q`, `favoritos`, `atividade`, `ativo`, `atividade_em`): é o
  ÚNICO lugar que diz que uma conta é bot. **RLS ligada e nenhuma policy**, sem grant para `anon`/`authenticated`: o
  navegador não lê nem sabe que ela existe (só a `service_role` do servidor);
- a função **`criar_bot(p_spec)`**: cria a conta do bot em `auth.users` **sem e-mail, telefone, senha ou identidade**
  (não dá para entrar nela; com o `banned_until` eterno de garantia) e o gatilho da 0001 cria o perfil e as
  estatísticas como para qualquer conta (a tag sai do apelido). Depois grava o nível e o XP, a data da conta no
  passado, a trilha toda até o nível no inventário (como a `conceder_recompensa` daria), os itens de baú sorteados, os
  cosméticos equipados (pela `equipar_conta`: só o que ele tem) e as estatísticas. Confere o nome pelas regras de
  sempre (`normalizar_nome`) e a faixa;
- **`bots_listar()`** e **`bot_perfil(p_user)`**: o servidor lê o grupo de bots e o perfil atual de um deles;
- **`bot_atividade(p_user, p_partidas, p_vitorias, p_xp)`**: a "vida fora da fila" (XP, nível, itens da trilha e
  estatísticas de partidas que o bot "jogou por aí"); só para contas de `public.bots` e com teto (20 partidas e 60 XP
  por partida de uma vez).

Nada mais muda: o perfil, as estatísticas e o inventário do bot são linhas das tabelas de sempre, lidas pelas mesmas
consultas e RLS das contas de gente; o XP das partidas contra bot sai pela mesma `conceder_recompensa` (para os dois
lados, com os mesmos limites do dia). Os bots **nascem sozinhos**: o servidor semeia o grupo (60 bots) na primeira vez
que liga com a 0019 (e de novo se ficarem menos de 40). Sem a 0019 o jogo funciona como antes (sem bots: o servidor
loga `[bots] não deu para carregar os bots` e a fila é só de gente). `DODGE_BOTS=0` no ambiente desliga os bots sem
mexer no banco.

- **Ver os bots** (SQL Editor): `select p.nome_exibicao, p.tag, p.nivel, b.faixa from public.bots b join public.perfis p
  on p.id = b.user_id order by p.nivel;`
- **Tirar todos os bots**: `delete from auth.users where id in (select user_id from public.bots);` (o perfil, as
  estatísticas, o inventário, as concessões de XP dele, os pedidos de amizade e a linha em `public.bots` vão junto, em
  cascata; nas partidas já registradas o lado dele fica sem conta, como o de um convidado, e o XP de quem jogou contra
  ele continua). Com o servidor ligado e os bots ligados, ele semeia um grupo novo na próxima vez que ligar: desligue com
  `DODGE_BOTS=0` antes.

`botsSql.test.js` roda a 0001–0019 (a 0019 duas vezes) com `DODGE_PG` e confere a conta do bot igual às outras, o
navegador lendo o perfil dele mas sem ver `public.bots` nem chamar as funções do servidor, o XP de uma partida contra o
bot para os dois, o teto da atividade e a remoção em cascata.

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
