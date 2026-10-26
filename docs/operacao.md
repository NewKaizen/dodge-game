# Operação: backups, ambientes e o que olhar nos logs

Para quem mantém o jogo no ar (Render + Supabase). Nada aqui é código: são
decisões e rotinas.

## Backups (Supabase)

- **Plano grátis:** o Supabase **não garante backup restaurável** no plano
  gratuito e pausa projetos sem uso (hoje, cerca de 1 semana). **Confira no
  painel** (**Project Settings → Database → Backups**, e **Billing** para os
  limites do plano), porque isso muda com o tempo. Os planos pagos têm backups
  diários; o "Point in Time Recovery" é um extra.
- **O que vale guardar:** `perfis`, `estatisticas_basicas`, `amizades`,
  `pedidos_amizade`, `bloqueios`, `partidas`, `partida_participantes`,
  `concessoes`, `inventario`, `denuncias`. As fotos do bucket `avatares` são
  recriáveis (as pessoas sobem de novo), mas dá para baixar.
- **Exportar à mão (pg_dump):** em **Project Settings → Database → Connection
  string**, copie a URI de conexão (use a "Session pooler" se sua rede só tem
  IPv4):

  ```bash
  # só os dados e a estrutura do schema "public" (as contas do Auth ficam de fora)
  pg_dump "postgresql://postgres.xxxx:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres" \
    --schema=public --no-owner --no-privileges -Fc -f dodge-$(date +%F).dump
  # restaurar num projeto de teste (vazio, com as migrations já rodadas):
  pg_restore --data-only --no-owner -d "URI_DO_PROJETO_DE_TESTE" dodge-AAAA-MM-DD.dump
  ```

  Guarde o arquivo fora do repositório (tem e-mails de login no `auth.users`
  só se você incluir esse schema; o comando acima não inclui).
- **Rotina sugerida:** um `pg_dump` por semana durante o teste restrito, e
  sempre **antes de rodar uma migration nova** em produção.
- **Reprodutível:** como as migrations em `supabase/migrations/` rodam de novo
  sem estragar nada, a **estrutura** se refaz em minutos; o que um backup
  protege é o **progresso dos jogadores** (XP, amigos, inventário).

## Ambientes separados

Recomendação: **dois projetos Supabase** (o plano grátis costuma permitir dois ativos; confira o limite atual no painel).

| | Produção | Teste |
| --- | --- | --- |
| Supabase | projeto `dodge` | projeto `dodge-teste` |
| Render | o serviço público | um segundo serviço (ou `npm run online` local) apontando para o projeto de teste |
| Login Google | as URLs da produção | acrescente a URL de teste em **Redirect URLs** do projeto de teste |
| Uso | jogadores de verdade | ensaiar **migration nova**, testar `scripts/moderar.js`, conferir fluxos com duas contas |

Regra: **migration nova roda primeiro no teste**, depois (com backup) na
produção. Nunca teste com a chave secreta da produção na sua máquina; use as
chaves do projeto de teste nas variáveis do shell.

## O que olhar nos logs do Render

Render → o serviço → **Logs**. O servidor escreve pouco de propósito:

| Linha | O que significa | Quando se preocupar |
| --- | --- | --- |
| `[metricas] {...}` | uma linha a cada 15 min (e ao desligar) com contadores e p50/p90 da espera na fila; veja `docs/online.md` | `avatar_envios_falha` alto; `fila_pares_desfeitos` perto de `fila_pares`; `partidas_abandonadas` perto de `partidas_iniciadas`; `p90` de espera acima de 30 s com pouca gente (normal) ou com muita (ruim) |
| `[contas] ...` | contas desligadas (faltou variável) ou erro de rota | qualquer uma depois do deploy |
| `[partidas] ... contestada` | os dois lados discordaram do vencedor | se repetir, suspeite de bug de relato ou de trapaça |
| `[partidas] não deu para registrar/conceder ...` | o Supabase falhou ao gravar a partida ou o XP | **sempre**: o jogador jogou e não ganhou; veja o estado do Supabase |
| `[fila] partida rápida ...` | pareamento feito (host, pings, regra) | só para entender queixa de lag |
| reinícios do serviço | Render acordou, caiu ou fez deploy | memória acima do limite do plano |

Plano grátis do Render: o serviço **dorme** depois de uns 15 minutos sem
visita e leva até ~1 minuto para acordar (o jogo mostra "o servidor pode estar
ligando"); o estado em memória (salas, fila) **some** a cada reinício, mas as
contas, o XP e a Coleção ficam no Supabase. Para o teste, abra o site 2 minutos
antes de todo mundo entrar. Um monitor externo gratuito batendo em `/saude` a
cada 10 min evita o sono (e avisa se cair).

### Endereço de quem chama (limite do /api/avatar)

O limite por endereço usa a **última entrada** do `X-Forwarded-For` (a que o
proxy do Render acrescenta). Se um dia puser outro serviço na frente (por
exemplo Cloudflare), todos passam a ter o endereço dele e dividem o mesmo
limite de 40 pedidos por minuto: ajuste `AVATAR_POR_IP_POR_MINUTO` em
`server/contas.js` ou a lógica de `enderecoDoPedido` junto com essa mudança.
O endereço fica só na memória, para contar; nunca é gravado nem logado.

## Segredos

- `SUPABASE_SECRET_KEY` só no Render e no seu shell de moderação. Se vazar:
  **Project Settings → API Keys** → gere outra e atualize o Render.
- O navegador só recebe URL e a chave publicável (`/api/config`).
- Nada de chave em arquivo do repositório, em issue ou em print.
