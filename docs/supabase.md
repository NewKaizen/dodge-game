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
| `SUPABASE_ANON_KEY` | chave `anon` / *publishable* | sim (o RLS protege) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` / *secret* | **nunca** |

## 6. Configurar no Render

No serviço `dodge-game` → **Environment** → preencha as três variáveis (o
`render.yaml` já declara as três com `sync: false`, então o painel pede os
valores). Salve: o Render reinicia o serviço.

No log do deploy deve aparecer `Contas:   ligadas (Supabase)`.

Docker / outra hospedagem: passe as três variáveis ao **rodar** o contêiner
(`docker run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e SUPABASE_SERVICE_ROLE_KEY=...`).
Não precisam existir no build.

## 7. Testar localmente

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon>
export SUPABASE_SERVICE_ROLE_KEY=<service_role>

npm run online          # compila e sobe em http://localhost:5180
# ou: npm run dev       # http://localhost:5173 (o Vite também liga /api/*)
```

1. Abra a página: embaixo dos botões do joystick aparece **Entrar com Google**.
2. Entre: volta para o jogo com o seu avatar e nome. Clique nele para abrir o
   **PERFIL** (nome, `#tag`, nível, XP, título, estatísticas zeradas até a 1D).
3. Troque o nome, escolha um personagem como avatar, envie uma foto (recorte
   quadrado com prévia) e remova a foto.
4. No **Table Editor → perfis** confira as mudanças; em **Storage → avatares**
   aparece `<seu id>.webp`.
5. Abra o modo ONLINE/LAN e crie uma sala: o nome no lobby é o do perfil.

Sem as variáveis, `curl localhost:5180/api/config` responde
`{"disponivel":false}` e o jogo mostra "contas indisponíveis".

Os testes automáticos (`npm test`) não precisam de nada disso: usam um Supabase
falso (`server/supabase/fake.js`).

## Regras que valem (e onde estão)

- **Nome de exibição**: 3 a 16 caracteres, letras (com acento), números,
  espaço, `_ . -`. Conferido no navegador (`src/lib/contaRegras.js`), na função
  `atualizar_perfil` e nos `CHECK` da tabela.
- **Tag** (`joao#4821`): gerada pelo banco quando a conta é criada; única e
  fixa (não muda com o nome). É por ela que os amigos vão achar você (1B).
- **Nível, XP, tag e foto** (`avatar_url`): o navegador não consegue gravar
  (sem `GRANT` de escrita e sem política de update). Quem grava é o servidor.
- **Foto**: PNG/JPEG/WebP de até 2 MB e entre 64 e 4096 px de lado. O servidor
  confere os bytes do arquivo (não a extensão), recodifica em WebP 256×256 sem
  metadados (sai EXIF/GPS) e grava em `avatares/<id>.webp`. Máximo de 5
  envios por minuto por conta.
- **Lobby**: o `ola` leva o JWT só para o servidor que serviu a página (nunca
  para o servidor de outro PC da LAN). Token inválido = joga como convidado.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| "contas indisponíveis" | falta alguma das três variáveis no servidor (veja o log) |
| Google diz `redirect_uri_mismatch` | a URI de redirecionamento no Google não é a `.../auth/v1/callback` do Supabase |
| Volta do Google para outra página | o endereço não está em **Redirect URLs** do Supabase |
| "não deu para carregar o perfil" | a migration não rodou (sem a tabela `perfis` ou sem o gatilho) — rode de novo |
| Foto dá erro 502 | o bucket `avatares` não existe, ou a `SUPABASE_SERVICE_ROLE_KEY` está errada |
| Conta criada antes da migration sem perfil | rode a migration de novo: ela cria o perfil de quem ainda não tem |
