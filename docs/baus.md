# Baús e os slots novos de cosmético

Quatro slots novos de cosmético (som de dano, efeito de carta, lançamento de carta e moldura animada) e o **BAÚ**,
que só se ganha **jogando**. **Não existe compra nenhuma**: nem baú, nem item, nem moeda. Cosméticos **nunca** mudam
nada na partida (regra fixa da Fase 4): só som e desenho, e a partida nunca espera por eles.

| Peça | Onde |
| --- | --- |
| Catálogo dos slots, chances, pena, sorteio (puro) | `src/lib/cosmeticos.js` (ids em [cosmeticos-ids.md](cosmeticos-ids.md)) |
| Banco | `supabase/migrations/0015_baus_cosmeticos.sql` (espelho em `server/supabase/fake.js`) |
| Servidor: conceder e abrir | `server/baus.js` (chamado de `server/partidas.js`, `server/campanha.js`; mensagens em `server/lan.js`) |
| Navegador: estado, abrir, aviso | `src/lib/bausConta.js` (o aviso `bauGanho` vai para `src/game/conta/popupBau.js`) |
| Ponte para o conteúdo | `src/game/cosmeticosSlots.js` (+ `cosmeticosRegistro.js`, que carrega `src/game/cosmeticos/registro.js`) |
| Telas | Coleção: abas **BAÚS**, SONS, EFEITOS, LANÇAMENTOS (as molduras animadas na aba MOLDURAS); a **roleta** em `src/game/conta/roletaBau.js` (o desenho do baú em `bau.js`); o pop-up em `src/game/scenes/BauPopup.js` |
| Testes | `src/lib/__tests__/cosmeticos.test.js`, `src/game/__tests__/cosmeticosSlots.test.js`, `server/__tests__/baus.test.js`, `bausSql.test.js` (Postgres, com `DODGE_PG`), `src/lib/__tests__/roleta.test.js` (a fita), `src/game/__tests__/filaBau.test.js` (a fila do pop-up) |

## De onde vêm os baús (só o servidor concede)

Cada fonte tem uma **chave** por conta (`unique (user_id, chave)` em `baus`): repetir, reconectar ou mandar em paralelo
nunca dá dois. O banco confere a fonte de novo antes de conceder.

| Fonte | Chave | Quando | O banco confere |
| --- | --- | --- | --- |
| subiu de nível | `nivel:<N>` | cada nível novo (partida, campanha, desafio e até o XP de outro baú) | a conta já está no nível N (N ≥ 2) |
| baú do dia | `dia:<AAAA-MM-DD>` | a 1ª partida **terminada** do dia (PVP/CO-OP/3–4/2x2/FFA com resultado jogado e não curta; campanha ou desafio com vitória/derrota) | o dia é o de hoje no banco (São Paulo) |
| desafio diário | `desafio:<dia>` | a 1ª vitória do desafio do dia | `desafio_concluidos` (0013) |
| boss semanal | `semanal:<semana>` | vencer o boss da semana (o troféu) | `trofeus_semanais` (0010) |
| conquistas | `conquista:<id>` | `primeira_vitoria`, `casa_silenciosa`, `cacador_semanal`, `sete_sois`, `mao_firme`, `lenda_da_mesa`, `cadeira_cativa`, `alma_gemea` (uma vez cada) | a conta tem a conquista (0014) |

Ritmo esperado de quem joga todo dia: 1 (baú do dia) + 1 se vencer o desafio + 1 a cada nível (um nível leva de 3 a
10 partidas, conforme o nível) ≈ **1–2 por dia**; o boss semanal e as conquistas são extras raros.

## O que tem dentro (as chances publicadas)

O servidor sorteia 10 números com `crypto.randomInt` (Node; o navegador nunca sorteia) e o **banco** aplica as
regras (`abrir_bau`) com a conta travada. `rolarBau` (JS) é o espelho exato; o teste confere os dois com os mesmos
números.

| Raridade | Chance de cada recompensa |
| --- | --- |
| Comum | 60% |
| Raro | 28% |
| Épico | 10% |
| Lendário | 2% |

- **Quantas recompensas**: 1 (50%), 2 (35%) ou 3 (15%).
- A **1ª** é sempre um cosmético; a 2ª e a 3ª têm 35% de ser **bônus de XP** (comum 25, raro 50, épico 100, lendário 200).
- O cosmético é um dos itens do baú da raridade sorteada, por igual (46 itens: 12 sons, 10 efeitos, 8 lançamentos,
  10 molduras animadas e 6 títulos).
- **Pena (pity)**: depois de 9 baús seguidos sem nada épico ou melhor, o 10º garante a 1ª recompensa **épica** (ou
  melhor, se sair lendário). A tela mostra quantos faltam.
- **Repetido** (já tinha, ou saiu duas vezes no mesmo baú): vira XP, "já tinha: +N XP" (comum 15, raro 30, épico 60,
  lendário 120).
- **Teto**: o XP dos baús abertos no mesmo dia soma no máximo **500** (uma fonte à parte, com teto próprio; os limites
  de XP das partidas não mudam). O XP pode subir o nível: a trilha entrega os itens e o nível novo dá outro baú.
- Abrir de novo um baú já aberto devolve o mesmo resultado; dois "abrir" ao mesmo tempo abrem baús diferentes.

As mesmas chances aparecem na aba BAÚS da Coleção.

## O pop-up e a roleta (só interface: chances, pena e concessão não mudaram)

**Pop-up "VOCÊ GANHOU UM BAÚ!"**: quando o servidor manda `bauGanho` (nível novo, baú do dia, desafio diário, boss
semanal, conquista) o aviso entra numa fila (`src/game/conta/filaBau.js`, pura e testada) e aparece **na hora** por
cima de qualquer menu ou tela de resultado (`Menu`, `Lan`, `PvpResultado`, `PvpResultadoN`, `Vitoria`, `GameOver`,
`CampanhaFim`, `PartyFim`, `DesafioDiario`...; a lista é `CENAS_DO_POPUP`). **Nunca interrompe uma partida**: com uma
arena (ou votação, pausa, escolha de partida) na tela o aviso espera e sai ~0,7 s depois de a tela de resultado
aparecer. Dois avisos seguidos viram um pop-up só. Quem liga tudo é `popupBau.js` (`Game.svelte`); a cena
`BauPopup` pausa a cena de baixo e fica com os botões (A/B/C) até fechar. Se uma partida começar com o pop-up aberto
(convite aceito, o host iniciou a sala), ele fecha sozinho e o aviso volta para a fila.

| Botão | O que faz |
| --- | --- |
| **ABRIR AGORA** (A) | roda a roleta ali mesmo, sem trocar de tela |
| **DEPOIS** (B / C / Esc) | fecha; o baú continua na aba BAÚS (`BAÚS (n)`) e o PERFIL do menu mostra "n BAÚS PARA ABRIR" |

**Roleta** (`roletaBau.js`, usada pelo pop-up e pela aba BAÚS da Coleção): uma fita horizontal de cartas na cor da
raridade passa por baixo de um marcador, com um tique a cada carta. Ao abrir ela já gira (rápida e constante) **enquanto
o servidor sorteia** (`abrir_bau`); quando a resposta chega, desacelera (~3,4 s) e para em cima do item de verdade. As
outras cartas são iscas do catálogo sorteadas pelas **mesmas chances publicadas** (`src/lib/roleta.js`,
`construirFita`: a carta real fica em `fita[parada]`, o gerador é injetável nos testes). Baú com 2 ou 3 recompensas: um
giro por cosmético (os seguintes de ~2,4 s) e o bônus de XP vira uma ficha; "já tinha: +N XP" aparece na legenda e na
ficha. Ao parar: brilho e partículas pela raridade (comum discreto, raro e épico com anel e clarão, **lendário** com
arco-íris, raios de luz e tremor de tela). No fim: **EQUIPAR AGORA** (cosmético novo; usa o `equipar` de sempre),
**ABRIR OUTRO (n)** e **FECHAR**.

Controles: A (ou clique) pula o giro e passa para a próxima recompensa, ←→ escolhem o botão, A confirma, B fecha; mouse
e toque clicam nos botões. Com **movimento reduzido** (Config) não há rolagem: só a revelação. O texto passa por
`semLigaduras`. Há uma proteção de 350 ms para o A que o jogador ainda tinha na mão.

Dev: `window.debugBau.simular(['nivel'], 3)` finge o aviso do servidor; `window.debugBau.forcar = { recompensas: [...], xpGanho, ... }`
faz a roleta usar esse resultado no lugar do servidor (para ver o lendário e o baú de 3 recompensas).

## Os slots e quem vê

| Slot | Coluna | O que faz | Quem vê/ouve |
| --- | --- | --- | --- |
| som de dano | `perfis.som_equipado` | toca quando VOCÊ leva um acerto | todos na partida (o som de quem levou) |
| efeito de carta | `perfis.efeito_equipado` | em volta das suas cartas na mão | todos que veem a sua mão (PVP de 2 mostra as duas) |
| lançamento | `perfis.lancamento_equipado` | quando a sua carta vai para a mesa (a revelação) | todos (cada um roda o seu e o dos outros) |
| moldura animada | `perfis.moldura_equipada` (o slot de sempre) | em volta do avatar | perfil, menu, Coleção e o lobby da sala (os outros membros) |

Equipar é a `equipar()` de sempre (o banco confere que a conta tem o item; `null` volta ao padrão). O lobby repassa
`conta.cosmeticos {som, efeito, lancamento, moldura}` (só ids conhecidos do catálogo) de cada membro: PROTOCOLO 18.
As arenas (`PvpArena`, `PvpArenaN`, `CoopArena`, `CoopArenaN`, `CampanhaArena`) leem `cosmeticosDaPartida()`
(`src/game/rede.js`): em rede os de cada jogador, fora dela o lado 0 é a conta logada e o resto o padrão (CPU,
2º jogador no mesmo PC, convidado). Toda chamada ao conteúdo passa pela ponte com try/catch; o lançamento tem um
limite de 2,5 s e ninguém espera por ele; sem conteúdo (ou com erro) fica o padrão de sempre.

## Protocolo (versão 18)

`baus {acao: 'estado'}` → `bausEstado {convidado, disponivel, fechados, abertos, desdeEpico, pity, lista}` (1 por s) ·
`baus {acao: 'abrir'}` → `bauAberto {bauId, fonte, recompensas: [{tipo: 'item'|'duplicado'|'xp', id?, raridade, xp?}],
xpGanho, teto, xpTotal, nivelAntes, nivelDepois, itensNovos, pity, desdeEpico, fechados, repetido}` ou `bausErro
{motivo, msg}` (um "abrir" por conexão a cada 1,5 s) · `baus {acao: 'equipar', tipo, item}` → `equipado {ok, ...}`
(o caminho do dev com contas falsas) · aviso do servidor: `bauGanho {fontes, fechados}` (o pop-up "VOCÊ GANHOU UM BAÚ!", abaixo).

## Migration

Rode a **`0015_baus_cosmeticos.sql`** depois da 0014 (idempotente; `docs/supabase.md` 2.9). RLS ligado em `baus` e
`baus_contas` (cada conta lê só o seu); `conceder_bau`, `abrir_bau`, `baus_estado` e `equipar_conta` só com a chave do
servidor (revogadas de `anon`/`authenticated`); `equipar` continua do navegador. Sem a 0015: o jogo funciona, só não
há baús (o servidor loga o erro e segue).

## Testar

- `npm test`; o SQL: `DODGE_PG="-h <socket> -p <porta> -U postgres" node --test server/__tests__/bausSql.test.js`.
- No navegador: `DODGE_CONTAS_FALSAS=1 npm run dev`, `window.debugConta.fingir({ id: '<uuid>', nome: 'ANA' })`: a conta
  de teste nasce com 3 baús (`server/contasFalsas.js`). PERFIL → COLEÇÃO → BAÚS → A.
