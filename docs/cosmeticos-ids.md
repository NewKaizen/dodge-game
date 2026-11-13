# Ids dos cosméticos dos slots novos

A lista que o servidor (o catálogo do baú, `src/lib/cosmeticos.js` e `supabase/migrations/0015_baus_cosmeticos.sql`)
e o conteúdo (`src/game/cosmeticos/registro.js`) usam. Cada item tem **dois nomes**:

- **registro**: o id do conteúdo (o que `tocarSomDano`, `aplicarEfeitoCarta`, `animarLancamento`, `desenharMoldura` e
  `previa` recebem);
- **banco**: o id do catálogo (`catalogo_itens`, `inventario`, `perfis.*_equipado`), no formato de sempre `<tipo>.<slug>`.

A conversão é fixa (`registroDoId` / `idDoRegistro`): `som.<x>` ↔ `dano-<x>`, `efeito.<x>` ↔ `efeito-<x>`,
`lancamento.<x>` ↔ `lancamento-<x>`, `moldura.anim_<x>` ↔ `moldura-anim-<x>`, `frente.<x>` ↔ `frente-<x>` e (só os versos
do baú) `verso.<x>` ↔ `verso-<x>` (o `_` do banco vira `-` no registro). Os estilos de carta e os versos ilustrados
vieram na `0016_cartas_estilos.sql`.
O primeiro de cada lista do registro é o **padrão de graça** (nada equipado no banco). As raridades seguem as do
conteúdo. Mudou um id ou uma raridade: mude `ITENS_SLOTS` (JS), o `insert` da migration (nova migration, se a 0015
já rodou) e esta tabela; `src/lib/__tests__/cosmeticos.test.js` confere esta página.

## Padrões (de graça, não saem do baú)

| Slot | registro |
| --- | --- |
| som de dano | `dano-padrao` |
| efeito de carta | `efeito-nenhum` |
| lançamento de carta | `lancamento-padrao` |
| moldura animada | `moldura-nenhuma` |
| estilo de carta (frente) | `frente-classica` |
| verso de carta | o `verso.classico` de sempre (os versos lisos da trilha não têm registro) |

## Sons de dano (`perfis.som_equipado`)

| registro | banco | nome | raridade |
| --- | --- | --- | --- |
| `dano-latido` | `som.latido` | Latido | comum |
| `dano-pato` | `som.pato` | Quack | comum |
| `dano-moeda` | `som.moeda` | Moedinha | comum |
| `dano-boing` | `som.boing` | Boing | comum |
| `dano-uuf` | `som.uuf` | Uuf! | comum |
| `dano-buzina` | `som.buzina` | Buzina | raro |
| `dano-miau` | `som.miau` | Miau | raro |
| `dano-vidro` | `som.vidro` | Vidro Quebrado | raro |
| `dano-laser` | `som.laser` | Laser | raro |
| `dano-pum` | `som.pum` | Pum | raro |
| `dano-sino` | `som.sino` | Sino | épico |
| `dano-cabra` | `som.cabra` | Cabra | lendário |

## Efeitos de carta (`perfis.efeito_equipado`)

| registro | banco | nome | raridade |
| --- | --- | --- | --- |
| `efeito-bolhas` | `efeito.bolhas` | Bolhas | comum |
| `efeito-folhas` | `efeito.folhas` | Folhas ao Vento | comum |
| `efeito-brilho` | `efeito.brilho` | Brilho | comum |
| `efeito-estrelas` | `efeito.estrelas` | Estrelas | raro |
| `efeito-sombra` | `efeito.sombra` | Sombra | raro |
| `efeito-eletrico` | `efeito.eletrico` | Elétrico | raro |
| `efeito-arco-iris` | `efeito.arco_iris` | Arco-íris | épico |
| `efeito-chamas` | `efeito.chamas` | Chamas | épico |
| `efeito-pixel-fogo` | `efeito.pixel_fogo` | Fogo de Pixel | épico |
| `efeito-holografico` | `efeito.holografico` | Holográfico | lendário |

## Lançamentos de carta (`perfis.lancamento_equipado`)

| registro | banco | nome | raridade |
| --- | --- | --- | --- |
| `lancamento-confete` | `lancamento.confete` | Confete | comum |
| `lancamento-explosao` | `lancamento.explosao` | Explosão | comum |
| `lancamento-sakura` | `lancamento.sakura` | Sakura | raro |
| `lancamento-raio` | `lancamento.raio` | Raio | raro |
| `lancamento-meteoro` | `lancamento.meteoro` | Meteoro | épico |
| `lancamento-tsunami` | `lancamento.tsunami` | Tsunami | épico |
| `lancamento-arco-iris-borboletas` | `lancamento.arco_iris_borboletas` | Borboletas de Arco-íris | épico |
| `lancamento-buraco-negro` | `lancamento.buraco_negro` | Buraco Negro | lendário |

## Molduras animadas (`perfis.moldura_equipada`, o slot de moldura de sempre)

| registro | banco | nome | raridade |
| --- | --- | --- | --- |
| `moldura-anim-coracoes` | `moldura.anim_coracoes` | Corações | comum |
| `moldura-anim-slime` | `moldura.anim_slime` | Slime | comum |
| `moldura-anim-estrelas` | `moldura.anim_estrelas` | Estrelas Cadentes | raro |
| `moldura-anim-gelo` | `moldura.anim_gelo` | Gelo | raro |
| `moldura-anim-neon` | `moldura.anim_neon` | Neon | raro |
| `moldura-anim-glitch` | `moldura.anim_glitch` | Glitch | raro |
| `moldura-anim-arco-iris` | `moldura.anim_arco_iris` | Arco-íris Vivo | épico |
| `moldura-anim-fogo` | `moldura.anim_fogo` | Fogo | épico |
| `moldura-anim-gerson` | `moldura.anim_gerson` | Gerson | lendário |
| `moldura-anim-galaxia` | `moldura.anim_galaxia` | Galáxia | lendário |

## Estilos de carta (`perfis.frente_equipada`, 0016)

| registro | banco | nome | raridade |
| --- | --- | --- | --- |
| `frente-mal-desenhada` | `frente.mal_desenhada` | Mal Desenhada | comum |
| `frente-jornal` | `frente.jornal` | Jornal | comum |
| `frente-pixel` | `frente.pixel` | Pixel 8-bit | raro |
| `frente-sakura` | `frente.sakura` | Sakura | raro |
| `frente-cervos-nara` | `frente.cervos_nara` | Cervos de Nara | raro |
| `frente-dark` | `frente.dark` | Dark Mode | raro |
| `frente-aquarela` | `frente.aquarela` | Aquarela | épico |
| `frente-origami` | `frente.origami` | Origami | épico |
| `frente-holografica` | `frente.holografica` | Holográfica | épico |
| `frente-tarot` | `frente.tarot` | Tarot | lendário |

## Versos ilustrados (`perfis.verso_equipado`, o slot de verso de sempre; 0016)

| registro | banco | nome | raridade |
| --- | --- | --- | --- |
| `verso-noite-estrelada` | `verso.noite_estrelada` | Lua e Estrelas | comum |
| `verso-circuito` | `verso.circuito` | Placa de Circuito | comum |
| `verso-patinhas` | `verso.patinhas` | Patinhas de Gato | comum |
| `verso-aboboras` | `verso.aboboras` | Abóboras | comum |
| `verso-lago-koi` | `verso.lago_koi` | Lago das Carpas | raro |
| `verso-vitral` | `verso.vitral` | Vitral | raro |
| `verso-cervo-nara` | `verso.cervo_nara` | Cervo de Nara | raro |
| `verso-fliperama` | `verso.fliperama` | Fliperama | raro |
| `verso-filigrana` | `verso.filigrana` | Filigrana Vitoriana | épico |
| `verso-onda` | `verso.onda` | Onda do Mar | épico |
| `verso-dragao-pixel` | `verso.dragao_pixel` | Dragão de Pixel | épico |
| `verso-galaxia` | `verso.galaxia` | Galáxia | lendário |

## Títulos do baú (sem conteúdo no registro: são texto)

`titulo.bau_curioso` (comum), `titulo.bau_sortudo` (comum), `titulo.bau_cacador` (raro), `titulo.bau_colecionador`
(raro), `titulo.bau_reliquia` (épico), `titulo.bau_lenda` (lendário).
