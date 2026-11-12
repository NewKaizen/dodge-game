# Desafio diário, conquistas e maestria (Fase 4A e 4B)

Menu → **DESAFIO DIÁRIO**. Um desafio por dia, **o mesmo para todo mundo**, que vira à **meia-noite de
São Paulo** (a mesma regra do XP e do boss semanal). Repetição livre o dia todo; o que conta é o seu
**recorde de hoje**, ao lado do recorde dos seus **amigos** hoje. Uma **recompensa principal** por dia,
concedida **uma vez** pelo servidor. Nada de sequência obrigatória: faltar um dia não tira nada.

| Peça | Onde |
| --- | --- |
| O dia, a definição do dia, os pontos, o cosmético da semana (puro) | `src/lib/desafio.js` |
| Conquistas e maestria (puro: regras, níveis, cosméticos) | `src/lib/conquistas.js` |
| A luta (a mesma da campanha, com a "fase" do dia e o modificador) | `src/game/campanha/luta.js` (`criarLuta({ desafio })`, `resumoDaLuta`) |
| Servidor: a corrida do desafio | `server/campanha.js` (ações `desafio` e `comecarDesafio`) |
| Servidor: eventos de conquista e maestria | `server/conquistas.js` (chamado de `server/partidas.js` e `server/campanha.js`) |
| Banco | `supabase/migrations/0013_desafio_diario.sql`, `0014_conquistas_maestria.sql` (espelho em `server/supabase/fake.js`) |
| Navegador | `src/lib/campanha.js` (store `desafioDiario`), `src/lib/conquistasConta.js`, cenas `DesafioDiario` e `CampanhaArena` (`{ desafio }`), abas CONQUISTAS e MAESTRIA da `Colecao` |
| Testes | `src/lib/__tests__/desafio.test.js`, `conquistas.test.js`, `server/__tests__/desafio.test.js`, `conquistas.test.js`, `desafioSql.test.js` (Postgres, com `DODGE_PG`) |

## As regras do desafio

A definição sai da semente `desafio:v<VERSAO>:<AAAA-MM-DD>` (`desafioDoDia`), igual no servidor e no
navegador. O dia que vale é sempre o do **servidor** (`desafioEstado.dia`); o navegador só conta o tempo
até a virada.

- **Quem você joga**: um dos 7 personagens (o baralho é o dele). **Contra**: um dos chefes da campanha
  (Ralsei, Noelle, Berdly, Susie ou Dess; o titã fica de fora), sempre como eco.
- **Aliada**: 60% dos dias uma CPU aliada (outro personagem); senão você luta sozinho(a).
- **Nível**: fácil; com aliada, 1 dia em 3 é médio. Nunca difícil.
- **Regra** (da campanha): nenhuma, *o quadro encolhe*, *tudo ecoa* ou *começa sem energia*.
- **Modificador**: **VELOZ** (ataques 20% mais rápidos), **DENSO** (20% mais balas), **POR UM FIO**
  (metade do HP; só com aliada) ou **ESCURIDÃO** (o quadro no escuro, só a luz em volta do coração; é
  só desenho, o servidor refaz o quadro igual).
- Medição (`EsquivaBot` normal + a CPU de cartas, 60 dias): vence ~85% dos dias.

**Pontos** (calculados pelo servidor com o que ele viu, `pontosDoDesafio`): até 500 pelo dano no chefe;
vitória +1000, +até 400 pelo HP que sobrou, +25 por rodada abaixo de 15; +30 por desvio perfeito, +2 por
raspão (até 200), −10 por acerto levado. Vitória sempre vale mais que qualquer derrota.

## Recompensa (só o servidor concede)

| Regra | Valor |
| --- | --- |
| primeira **vitória** do dia | **60 XP** (uma vez por dia; repetir, reconectar ou mandar em paralelo não dá de novo) |
| outra vitória no mesmo dia | 0 XP (o recorde sobe se for maior) |
| derrota | 0 XP (o recorde conta) |
| suspeita, abandono | nada (nem recorde) |
| vencer em **4 dias** da semana (seg–dom, quaisquer dias) | o **cosmético raro da semana** (`verso/moldura/titulo.diario_AAAA_SS`, um por semana, nunca volta) |
| convidado | joga tudo, não ganha nada (aviso na tela) |

A trava da recompensa é a linha `(conta, dia)` em `desafio_concluidos` (com `pg_advisory_xact_lock` por
conta); a da corrida é o id dela em `desafio_corridas` (chamar de novo devolve o mesmo). O dia da corrida é
o do começo: quem começou antes da meia-noite e acabou depois ainda vale para ontem (o banco aceita hoje
ou ontem, nada além).

## Anti-trapaça

É a máquina da campanha (`docs/campanha.md`, "Anti-trapaça"): o servidor roda a luta (mão, energia, CPU,
semente), recebe a posição do coração a cada passo, confere a plausibilidade (velocidade, caixa,
teleporte, relógio) e **refaz o quadro**; o dano é o maior entre o dele e o relatado. Corrida suspeita =
sem recompensa e sem recorde, com o motivo no log e no banco. Os pontos são calculados no servidor; o
navegador não manda pontos. Limite conhecido: como a semente do dia é a mesma para todos e pública, um
cliente adulterado pode calcular um caminho perfeito (o mesmo risco da campanha); o ganho é o recorde
entre amigos e 60 XP por dia.

## Conquistas e maestria (4B)

**Conquistas** por conta (18, `CONQUISTAS` em `src/lib/conquistas.js`; duas ocultas aparecem como
"???" até ganhar). O servidor só desbloqueia onde já sabe da partida: depois do XP de uma partida
(PVP, CO-OP, 3–4, 2x2, todos contra todos), no fim de uma corrida da campanha e no fim do desafio. Cada
evento vai **uma vez** ao banco (`registrar_evento_conta`, chave conta + `partida:<id>`/`campanha:<id>`/
`desafio:<id>`), que devolve o resumo da conta; as regras puras (`conquistasDoEvento`) dizem quais
valem e `desbloquear_conquistas` grava só as que faltam. "Sem levar dano" e "por um fio" só valem na
campanha e no desafio (onde o servidor vê o dano). As novas chegam ao navegador (`conquistas`) e viram
um aviso no menu. Os contadores (vitórias, partidas) contam a partir da 0014.

**Maestria** por personagem: vitória +3, derrota/empate/participação +1, até **30 pontos por personagem
por dia**. Níveis 1–10 (`MAESTRIA_NIVEIS`: 0, 10, 30, 60, 100, 150, 210, 280, 360, 450). Nível 5 dá um
**título** do personagem, nível 10 uma **moldura** (`titulo.maestria_<p>`, `moldura.maestria_<p>`, nível
1000 no catálogo: a trilha nunca entrega). Só cosmético. O personagem das partidas vem do relato do
navegador (já existia: `personagem`); nome fora da lista não dá maestria. Na campanha é a Kris; no
desafio, o personagem do dia (os dois o servidor sabe).

Na **Coleção**: abas CONQUISTAS (medalhas, data) e MAESTRIA (barra por personagem e os cosméticos de
cada nível); os cosméticos aparecem também nas abas de títulos e molduras, e o do desafio na aba
SEMANAIS.

## Protocolo (versão 17)

`campanha {acao: 'desafio'}` → `desafioEstado {dia, semana, restanteMs, desafio, convidado, disponivel,
xp, meta, cosmetico, recorde, concluido, diasSemana, cosmeticoGanho, concluidos, amigos}` ·
`campanha {acao: 'comecarDesafio', dia}` → `campanhaInicio {..., desafio: id}` (dia velho: `campanhaErro
{motivo: 'virou'}` e o estado novo) · depois as mesmas `carta`, `posicoes`, `fimEsquiva`, `desistir` da
campanha · `campanhaFim {..., desafio: {dia, pontos, rodadas, acertos, grazes, recorde, novoRecorde,
concluido, primeiraHoje, diasSemana, meta, cosmeticoNovo}}`. `conquistas` → `conquistasEstado
{convidado, conquistas: [{id, em}], maestria: [{personagem, pontos, partidas, vitorias}]}` (um pedido a
cada 2 s); aviso do servidor: `conquistas {novas, itensNovos, maestria}`.

## Migrations a rodar

Na ordem, depois da 0012: **`0013_desafio_diario.sql`** e **`0014_conquistas_maestria.sql`**
(idempotentes; `docs/supabase.md` 2.8). Sem elas: o desafio roda, mas a concessão falha ("não deu para
salvar") e não há conquistas; nada mais quebra. Sem Supabase nenhum (LAN), o desafio roda só como
treino. No dev, `DODGE_CONTAS_FALSAS=1 npm run dev` usa o banco falso (`server/supabase/fake.js`).

## Testar

- `npm test`; o SQL: `DODGE_PG="-h <socket> -p <porta> -U postgres" node --test server/__tests__/desafioSql.test.js`.
- No navegador: `DODGE_CONTAS_FALSAS=1 npm run dev`, `window.debugConta.fingir({ id: '<uuid>', nome: 'ANA' })`,
  menu → DESAFIO DIÁRIO. Para mudar o desafio de todos os dias, suba `VERSAO_DESAFIO` (JS) e
  `desafio_versao()` (nova migration).
