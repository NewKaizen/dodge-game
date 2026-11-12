# O Manual Interativo do Ralsei (páginas 1 a 9)

Tutorial em forma de caderno desenhado a giz de cera, jogável. O Ralsei entrega um manual feito à mão; ao virar
a página os desenhos ganham vida e o jogador mexe no coração **dentro da ilustração**, com as regras reais do
jogo. Começou como UMA página para validar a sensação (plano em
[plano-fases-2-6.md](plano-fases-2-6.md#fase-3-manual-interativo-do-ralsei)); agora são cinco (coração, desvio, cartas, energia e uma partida de verdade contra a CPU), com índice,
progresso salvo e o adesivo de quem termina: MANUAL ESSENCIAL ✓. Depois delas há **quatro páginas EXTRAS (6 a 9)**:
os quatro naipes, graze, jogar em dupla e ases/SUPER/perfeitos. As páginas 1 a 5 são o "essencial"; os extras são
**oferecidos, nunca forçados** (ver [As páginas extras](#as-páginas-extras-6-a-9)).

Entrada: **Menu → GUIA → MANUAL DO RALSEI** abre o **índice** (cena `GuiaEntrada`, modo `indice`): CONTINUAR
(a primeira página que falta, só quando já há progresso), PÁGINA 1 a PÁGINA 5, depois os **EXTRA · PÁGINA 6 a 9**
(letra azul, com o prefixo "EXTRA"), com ✓ nas completas e os adesivos na dica; quem terminou a página 5 ganha o selo
"★ MANUAL ESSENCIAL ✓" embaixo do título. Uma página completa abre do zero ("jogar de novo"); uma página pela metade retoma na
primeira mini-lição (ou passo) que falta. `B` sai do manual a qualquer momento (volta ao índice; `B` de novo, ao GUIA e ao Menu). O guia
de antes, "CARTAS E ARENAS", continua intacto na outra opção do GUIA.

Navegação: página 1 → (a folha vira e a página seguinte continua do mesmo papel, sem fade) → página 2
(`ManualRalsei2`) → página 3 (`ManualRalsei3`) → página 4 (`ManualRalsei4`) → (vira) → página 5 (`ManualRalsei5`) →
(a folha descola) → a partida de verdade (`ManualRalsei5Partida`) → (a folha volta) → parabéns → (vira) → "e agora?".
Dali, **EXTRAS DO MANUAL** abre a página 6 (`ManualRalsei6`) → (vira) → 7 (`ManualRalsei7`) → 8 (`ManualRalsei8`) → 9
(`ManualRalsei9`); a 9 volta ao índice. Os extras também abrem direto do índice, em qualquer ordem.

## A página 1, "Este é o seu coração"

| Etapa (`pagina1.js`) | O que acontece |
| --- | --- |
| `intro` | Ralsei fala em 3 balões curtos (A passa; A durante a digitação completa o texto). |
| `desenhando` | O giz desenha a caixa, o coração e as 3 marcas (traço sendo riscado, ~2,7 s). |
| `marcas` | O jogador leva o coração às 3 marcas (estrela, X, estrela), em qualquer ordem. Cada marca vira um adesivo na fileira de cima. Uma seta torta "você!" aponta o coração até a 1ª marca. |
| `desviar` | 1,1 s de aviso e 6 bolinhas lentas (76 a 84 px/s, 3 mirando no coração) por 8 s. Barra de giz mostra o tempo. |
| `tentarDeNovo` | Acertou: risquinhos em volta do coração, fala de incentivo ("Quase! Tenta de novo?") e recomeça **só o desvio** em 1 s (ou já, com A). Cada erro deixa as balas 10% mais lentas (piso 60%). |
| `concluida` | Estrela dourada "PÁGINA 1 ✓" (adesivo metalizado) + confete de coraçõezinhos de papel. A vira a página. |
| `virando` / `fim` | A folha encolhe contra a espiral (0,9 s) com o verso curvando e sombra na página de baixo; atrás dela está a capa da página 2 (`montarCapaDaPagina2`), e a cena `ManualRalsei2` começa dali, sem fade. |

Uma instrução e uma ação de cada vez; botões na barra de baixo conforme o controle em uso (`botoes.js`:
teclado mostra as teclas reais do jogador 1 já remapeadas, controle mostra A/B, joystick serial BOTÃO A/B).

### Regras reais, de uma fonte só

As regras de bala e coração ficam em **`entities/fisica.js`** (puro, sem Phaser): `passoDoCoracao` (o `Heart.update`:
vetor limitado a 1, px/s, preso à caixa), `avisoDaBala`/`balaEntrando` (o telégrafo: parada e inofensiva, ou entrando
pela borda), `andarBala` (arranque, aceleração, teto de velocidade), `quicarNaCaixa`, `longeDaCaixa` (some a 160 px),
`foraDaCaixa` (bala inteira fora não acerta) e `folgaDaBala`/`acerta` (`folga <= hitbox`). **`Balas` (Bullets.js) e
`Heart` chamam essas funções**, e o manual também: `manual/onda.js` é uma "Pista" de bolso (as balas nascem com as
MESMAS opções de `a.bala({...})` e andam pelo mesmo laço de `Balas.atualizar`). As páginas 1 e 2 usam a onda.

`__tests__/paridade.test.js` prova: roda a classe **Balas e o Heart de verdade** (com um Phaser de mentira só de lógica,
`__tests__/apoio/`, ligado por `module.register`) lado a lado com o manual, com o mesmo joystick e dt variados, e confere
a posição de cada bala e do coração a cada quadro, o sumiço e o quadro/bala do acerto (página 1 e os 4 padrões da
página 2, parado, em zigue-zague e desviando bem). O coração mostra o miolo exato da hitbox; **o tremor do giz nunca
entra na colisão**.

## A página 2, "Vamos desviar?"

Ensina a **ler os padrões**, uma ideia de cada vez (`manual/pagina2.js`, puro; padrões em `manual/padroes.js`):

| Mini-lição | O padrão (versão mansa de um ataque de verdade) | Ralsei | Sobreviver |
| --- | --- | --- | --- |
| Chuva de cima | gotas nascem logo acima da caixa e caem acelerando até 95 px/s (`rain.js`: `entrando`, v² = v0² + 2·g·h); 1 em 3 cai na faixa do coração | "olhe para onde elas caem e fique no espaço vazio" | 6 s |
| Linha de lado | uma fileira de bolinhas (22 px entre centros: o coração não passa) entra pela esquerda e varre a caixa a 82 px/s com UM buraco de 66 px (≥ `LACUNA_MINIMA`, conferido com `validacao.lacunasLivres`); o próximo buraco fica a ≥ 70 px do anterior | "procure o buraco!" | 7 s |
| Mira em você | o tiro nasce fora da caixa (numa das 2 bordas mais longe, como `aimed.js`) mirando no coração; fica **parado e inofensivo 950 ms** (opção `aviso`, ≥ `ATAQUE.telegrafoMs`) enquanto uma **linha pontilhada de giz** mostra o caminho exato; depois vai reto a 110 px/s | "quando a linha aparecer, saia do caminho" | 6,5 s |
| Mistura curta | chuva fraquinha, uma fileira da esquerda, 2 tiros, uma fileira da direita (a 1ª já saiu), chuva e 1 tiro | "uma coisa de cada vez" | 10 s |

Fluxo de cada mini-lição: `explicar` (A) → `demo` (o **coração de giz verde do Ralsei** faz a onda curtinha sozinho,
pelo `pilotoDeDesvio`, com as mesmas regras; A pula; a mistura não tem) → `preparar` (1,1 s, o coração já anda) →
`tentar`. Acertou: risquinhos, fala de incentivo da própria mini-lição e recomeça **só ela** (1,4 s ou A), com o mesmo
padrão (mesma semente: dá para aprender). **3 erros na mesma**: `escolha` com ↑/↓ entre "tentar de novo" e "pular
esta parte" (A confirma; vale em qualquer controle). Cada mini-lição feita vira um adesivo redondo (gota, fileira com
buraco, alvo; a mistura ganha estrela dourada) na fileira de cima; pulada fica sem adesivo. No fim, estrela dourada
"PÁGINA 2 ✓" + confete e a folha vira para a página 3 (cena `ManualRalsei3`, do mesmo papel). Com parte pulada a página também completa (a fala
convida a voltar para pegar o adesivo que faltou).

Ninguém fica parado: os testes (`padroes.test.js`) provam que **ficar parado leva acerto** em toda mini-lição e que o
piloto **sobrevive a todas** em várias sementes (o padrão é justo).

## As páginas de cartas (3 e 4)

As duas páginas usam a mesma cena (`scenes/ManualRalsei3.js`; `ManualRalsei4` só muda a página) e a mesma máquina de
estados (`manual/licaoDeCartas.js`, pura): uma instrução e uma ação de cada vez, `←/→` anda pela mão, `A` confirma.

| Etapa (`licaoDeCartas.js`) | O que acontece |
| --- | --- |
| `intro` | Ralsei fala (ou "Que bom que você voltou!" ao retomar). |
| `escolher` | A instrução do passo; a mão de giz com a carta selecionada levantada e com brilho amarelo. Carta sob o cursor que não pode ser jogada mostra a pílula vermelha `× falta energia (2/3)` (como na arena). |
| `atacando` | A carta "ganha vida": sobe até a lousa, cresce e mergulha nela (`VIVA_MS`); aí o **ataque de verdade** dela roda na lousa por `VITRINE_MS` (A pula depois de 1,7 s). |
| `enchendo` | Passou a vez: a gema do `+1` acende e depois as da rodada nova. |
| `errou` | Fala curtinha do que aquela escolha faz e volta a escolher (3,4 s ou A). Nada é pago. |
| `ajuda` | 3 erros no passo: ↑/↓ entre "tentar de novo", "ver o Ralsei mostrar" e "pular esta parte". |
| `demo` | O coraçãozinho verde do Ralsei anda até a escolha certa e dá pulinhos (não escolhe pelo jogador). |
| `acertou` / `concluida` | Adesivo do passo na fileira em cima da lousa; no fim, estrela dourada "PÁGINA N ✓" + confete e a folha vira. |

**Página 3, "Sua primeira carta"** (`pagina3.js`): três cartas baratas do baralho do Ralsei, de ataques bem diferentes:
Estrela Gentil (♠5, custa 2: estrelas caem de cima), Canção de Ninar (♦4, custa 1: notas atravessam de lado) e
Bolinho Explosivo (♣3, custa 1: bolinhos grudam e estouram). Passo 1 `conhecer`: jogue qualquer uma e veja o ataque
dela. Passo 2 `chuva`: "qual carta faz CHOVER estrelas?"; a errada também ataca (de verdade) e o Ralsei diz o que ela
faz. A energia não é assunto ainda: a mesa da página 3 devolve a energia depois de cada jogada.

**Página 4, "Nem toda rodada pede ataque"** (`pagina4.js`): energia 2, as 10 gemas do HUD em giz (cheias azuis, vazias
só o contorno, o número ao lado) e a mão Bolinho (1), Coro de Estrelas (3), Último Capítulo (★, 10) + PASSAR no fim
(como o botão da arena). Passo 1 `caro`: tente o Coro → pílula `× falta energia (2/3)` e "Ele custa 3 e você só tem
2". Passo 2 `passar`: PASSAR → `+1` (`ENERGIA.passar`) e, na rodada nova, `+2` (`ENERGIA.porRodada`): 2 → 3 → 5.
Passo 3 `jogar`: o Coro agora cabe (o ★ continua `falta energia (5/10)`); ele paga 3 gemas e ataca o boneco. Errar
(a carta que dá mas não é a pedida, o ★, PASSAR fora de hora) só traz a fala; pular o PASSAR faz o Ralsei passar por
você (a energia do passo 3 continua certa), e retomar no passo 3 também.

**A virada da página 4** mostra a capa da página 5 (`montarCapaDaPagina5`) e troca para `ManualRalsei5` sem fade.

### Regras e ataques reais

- **Cartas**: as do baralho (`pvp/cartas.js`), por id (`cartasDoManual.js`: `MAO_P3`, `MAO_P4`); nada inventado.
- **Jogar, pagar, bloquear, passar**: `criarMesa` monta uma partida de verdade (`criarPartida` + `iniciarRodada`) com a
  mão fixa do tutorial; `bloqueio` é `motivoBloqueio`, `jogar` é `resolverRodada(estado, carta, passar)` (paga o
  custo e devolve a caixa que a arena roda), `passar` é `resolverRodada(passar, passar)` + `fimDaRodada` +
  `iniciarRodada`. A mão volta igual depois (dá para tentar de novo).
- **Carta → ataque**: `planoDaVitrine` usa `ataqueDaCarta` (o mesmo de `ataqueDaCartaNoJogo` da arena) na caixa fixa,
  com o dano e o ritmo da caixa e o respiro inicial de `Pista.rodar`. A **vitrine** (`vitrine.js`) roda o plano com o
  `ContextoAtaque` e a classe `Balas` reais (o mesmo relógio da Pista: respiro, ataque, desarmar, fim), na caixa do
  PvP (220x170) e mirando no boneco de treino (`a.alvo()`); ninguém toma dano, o boneco só balança.
- **Na tela**: as balas reais são sprites do jogo, então vivem numa região do mundo fora da tela e uma câmera só delas
  (`vitrineNaTela.js`) desenha essa região em cima da lousa, na escala dela (recorte exato, nada vaza no caderno).

`__tests__/paridadeCartas.test.js` prova: cartas iguais às do baralho; `bloqueio` igual a `motivoBloqueio` de outra
partida real em toda energia de 0 a 10; `jogar` igual a `resolverRodada` (caixa, dano, ritmo, energia paga);
`passar` igual a `resolverRodada` + `iniciarRodada` (com o teto); o plano igual a `ataqueDaCarta` (mesma receita e
números, com uma biblioteca de ataques falsa); e, rodando os **ataques de verdade** na vitrine (Phaser de mentira),
o relógio da Pista e que **só a Estrela Gentil cai de cima** (a dica "faz chover" é verdade). `pagina3.test.js` e
`pagina4.test.js` cobrem as máquinas (escolher, ataque, erro, ajuda, demonstração, pular, adesivos, retomar, gemas).

## A página 5, "Uma partida de verdade"

Uma partida **de verdade** contra a CPU, curta e mansa, com dicas só quando precisa. O caderno em volta é a
cena `ManualRalsei5` (máquina pura em `manual/pagina5.js`); a partida é a cena `ManualRalsei5Partida`, que
**estende a `PvpArena`** (as regras, as cartas, as Pistas, a CPU, o K.O. e o replay de sempre).

| Etapa (`pagina5.js`) | O que acontece |
| --- | --- |
| `intro` | Ralsei fala em 3 balões. No cartão, a **arena do PvP desenhada a giz**, nas posições da arena de verdade (`rabiscoDaArena`: moldura, caixas com os corações, barras de vida, gemas, mãos, PASSAR, o céu, o morro e o canteiro do jardim). |
| `enchendo` | (1,5 s) o desenho cresce até a tela inteira (o lugar exato da arena real) enquanto o resto da página sai, e o giz **ganha cor**. A arena real começa a carregar **por baixo** (`lancarArena`, com `{ cortina: true }`: ela espera). |
| `descolando` | (0,9 s) a folha vira contra a espiral (`virarFolha`) e a mesa some: por baixo está a arena de verdade, onde o desenho estava. A arena abre (`abrir()`: a abertura "JOGADOR 1 vs CPU") e o caderno sai. |
| `partida` | a arena joga (ver abaixo). |
| `voltando` | (0,9 s) no fim, a arena relança o caderno com `{ resultado }`: a folha volta por cima da arena (`virarFolha` com `volta`). |
| `parabens` | ganhando, perdendo ou empatando, o Ralsei comemora ("você aprendeu o básico!") e cola o adesivo dourado **MANUAL ESSENCIAL ✓** (com confete); o progresso salva na hora (`comPagina5`). |
| `virando` / `eAgora` | a folha vira para a página **"e agora?"**: ↑/↓ e `A` entre **JOGAR CONTRA A CPU** (`PvpEscolha`), **ONLINE** (`Lan`), **CARTAS E ARENAS** (`Grimorio`, o guia de antes) e **VOLTAR AO ÍNDICE**. |

"Reduzir animações": sem crescer, colorir, descolar e voltar (cortes; a arena começa sem cortina), balão inteiro,
sem confete. `B` sai para o índice a qualquer hora; no meio da partida ele **pede confirmação** (a `Pausa` já abre no
"TEM CERTEZA?" do SAIR, com `confirmarSaida`; SAIR vai ao índice do manual com `dadosSair`).

### A partida mansa (`manual/partidaDoManual.js`)

Você é a Kris; a CPU é o **Ralsei**, no nível mais fácil (`facil`, o primeiro de `NIVEIS_BOT`: escolha de carta e
esquiva). As vidas ficam em 3/4 (`fatorHp`, por `ajustarPartida` no `criarEstado` da arena): uns 2 a 3 minutos.
Sem relógio na escolha (`tempo: 0`), sem rodada bônus (`prepararBonus`) e sem morte súbita (`atualizarAceleracao`).
A **semente é fixa** (`manual:p5:12`): na 1ª rodada a CPU joga a Estrela Gentil (chove na sua caixa) e a sua mão tem
o SUPER, que ainda não cabe (as dicas têm onde aparecer; `partidaDoManual.test.js` confere com o `escolherJogada` e
o `motivoBloqueio` de verdade). Ganchos novos na `PvpArena` (sem mudar a partida normal): `ladoDaCpu`, `nivelDaCpu`,
`criarEstado` e `irParaResultado`.

### As dicas (`manual/dicasDaPartida.js`)

Um motorzinho puro que reage aos **eventos reais** da arena (nenhuma regra nova: os ganchos só olham):

| Dica | Gatilho real | Máx. | Fases | Seta para |
| --- | --- | --- | --- | --- |
| "Falta energia: que tal PASSAR?" | `apertarA` numa carta com `motivoBloqueio` `sem-energia` | 2 | escolha | o PASSAR |
| "Esse ataque vem de cima: fique embaixo!" | as balas que nascem na **sua** caixa entram por cima e descem (`criarLeitorDeChuva`, o critério do teste da página 3, decidido já na 1ª estrela) | 1 | esquiva | o alto da caixa |
| "Você levou dano: olhe a sua vida aqui." | `aplicarAcerto` no seu coração | 1 | esquiva → escolha | a barra de vida |
| "Calma, desvie com cuidado." | o acerto que deixa a vida em 35% ou menos | 1 | esquiva → escolha | — |
| "A energia enche quando você passa e a cada rodada." | você passou (`escolher` com `null`) ou começou a 2ª rodada | 1 | início, escolha | as gemas |

Uma dica de cada vez (3,8 s na tela, 1,2 s de respiro), a mais urgente primeiro; **nunca trava** o jogo. Nas fases
cheias (abertura, revelação, SUPER, roleta, duelo, resultado) e com a câmera lenta do K.O. ou a pausa, nenhuma dica
aparece: a que estava some e a que chegou espera a fase dela até a validade acabar (e então é esquecida, sem contar).
No baralho todo do Ralsei, só a Estrela Gentil é "de cima" (testado rodando os ataques reais).

O **treinador** (`manual/treinador.js`) é um Ralsei de giz pequenininho no canto de baixo à direita (o lado da CPU:
a sua mão e a sua caixa ficam livres), com o balão do caderno (fonte clara) e uma seta amarela de giz cutucando o
alvo. Calmo: sem deslizar, balão inteiro, seta parada.

## As páginas extras (6 a 9)

Extras (sub-fase 3D): mesmo caderno de giz, mesma voz do Ralsei, mesmos adesivos e o mesmo "tentar de novo / ver /
pular esta parte". Nenhum é obrigatório: não entram no CONTINUAR do essencial (só um extra **já começado e não
terminado** aparece como "CONTINUAR · EXTRA n", depois que o essencial está completo), nem no selo MANUAL ESSENCIAL.
Cada um vale por si e salva o progresso (`p6` a `p9` em `progresso.js`; salvo antigo continua valendo).

| Pág. | Título | Cena | Passos (adesivos) |
| --- | --- | --- | --- |
| 6 | Os quatro naipes | `ManualRalsei6` (a cena das páginas de cartas) | ♠ espadas, ♦ ouros, ♣ paus, ♥ copas (PVP) e "No CO-OP" (5) |
| 7 | Graze: raspando | `ManualRalsei7` | raspar em 3 tiros; 5 grazes = +1 de energia (2) |
| 8 | Jogando em dupla | `ManualRalsei8` | cada um na sua marca; desviar juntos no mesmo quadro (2) |
| 9 | Ases, SUPER e perfeitos | `ManualRalsei9` | carregar energia com perfeitos em combo; jogar o ★; os quatro Ases (3) |

**Página 6** (`manual/pagina6.js`, a mesma máquina das páginas 3 e 4): uma carta de cada naipe do baralho do Ralsei
(Estrela Gentil ♠, Chá Quentinho ♥, Canção de Ninar ♦, Bolinho Explosivo ♣), cada uma solta o ataque **real** dela na
lousa; ♥ cura 7 de vida e manda só um ataque fraquinho. O último passo é a pergunta do CO-OP: qual naipe atrasa o
ataque do chefe para os dois (♦, balas 15% mais lentas); cada naipe errado explica o que faz no CO-OP (♠ golpe forte,
♣ +6% por graze, ♥ cura os dois). Os números vêm de `docs/pvp-regras.md` e `docs/coop-cartas.md`.

**Página 7** (`manual/pagina7.js`): tiros mirados com a linha pontilhada da página 2 (`manual/tiros.js`) e o anelzinho
de giz de graze em volta do coração (raio `CORACAO.graze`, 22 px; o miolo é `CORACAO.hitbox`). Passou pelo anel sem
tocar o miolo = **graze** (`entities/fisica.js` `grazeia`, igual a `Balas.tocar`; cada bala dá 1 graze por coração).
Passo 2: a conta de energia é a do jogo (`registrarGrazes`: +1 a cada 5), numa mesa de verdade. Levou um acerto: o passo
recomeça.

**Página 8** (`manual/pagina8.js`): dois corações no mesmo quadro, como no CO-OP. **Quem move o quê** usa os controles
do jogo: com **2 pessoas locais** (2 controles, controle + teclado, ou o teclado nos dois conjuntos depois que o
jogador 2 entra nas telas de escolha: ver `docs/controles.md`) cada uma move um coração (`joysDosJogadores`); com 1,
todos os controles movem o coração vermelho (`joyDeTodos`, como no resto do manual) e o parceiro é o **Ralsei, a CPU
aliada** (coração verde, o piloto de desvio da página 2). Em "desviar juntos" os tiros alternam entre os corações de pé;
quem leva um acerto cai (fica apagado), o outro segura; só os dois caídos recomeçam o passo.

**Página 9** (`manual/pagina9.js`): numa mesa de verdade (`criarMesa`). Passo 1: dois ataques sem acerto = dois desvios
**perfeitos** (`registrarPerfeitoCombo`: +2 pela carta J, x1 e depois x2; `quebrarSequencia` ao levar um acerto),
grazes também contam; as gemas vão de 6 a 10. Passo 2: com 10 de energia, jogar o ★ SUPER (custa `SUPER.custo` = 10,
imparável); o Ás errado não gasta nada. Passo 3: os quatro Ases custam 3, e a pergunta "qual cancela a carta do
adversário?" (♦ Anular) explica os outros ao errar e ao acertar.

### A máquina dos extras (`manual/exercicio.js`)

Pura (testada com passos de brinquedo e com as 3 páginas): `intro -> [ passo ] x N -> concluida -> virando -> fim`.
Um passo é um **desafio** (corações numa caixa, uma onda e uma meta: `explicar -> preparar -> tentar -> errou/acertou`;
o desafio já mostra os corações parados enquanto o Ralsei explica) ou uma **escolha** de cartas (`explicar ->
escolher -> errou -> disparando? -> acertou`). 3 erros no mesmo passo abrem a ajuda ("tentar de novo" / "pular esta
parte"); passou do tempo sem a meta conta como erro. As balas e os acertos/grazes vêm de `onda.passoMulti` (o mesmo
laço de `Balas.atualizar`/`tocar`, com vários corações); `__tests__/paridade.test.js` roda a classe `Balas` e o `Heart`
reais lado a lado (1 e 2 corações, três jeitos de andar) e confere cada acerto e cada graze (quadro, bala e coração).
A cena `ManualRalsei7` serve as páginas 7 a 9 (a 8 e a 9 só mudam a página, como a 4 em relação à 3).

Navegação e retomada: igual às outras (A confirma, B sai para o índice, ←/→ a mão, ↑/↓ a ajuda; uma página completa
abre do zero, uma pela metade retoma no primeiro passo que falta). Reduzir animações: giz parado, avisos ("GRAZE!",
"PERFEITO x2!") sem subir, o estouro do SUPER sem girar, virada em corte; a linha pontilhada dos tiros fica.

## Progresso salvo

Preferência `manual` em `preferencias.js`, validada por `manual/progresso.js` (lixo salvo vira "nada ainda", nunca
erro): `{ p1: { completa }, p2: { completa, licoes: [null | 'feita' | 'pulada' x4] }, p3: { completa, passos: [x2] },
p4: { completa, passos: [x3] }, p5: { completa }, essencial, p6..p9: { completa, passos: [x5 | x2 | x2 | x3] } }`.
`p3`/`p4`/`p5`/`essencial`/`p6` a `p9` podem faltar (o progresso salvo antes delas continua valendo); `essencial` só vale junto com `p5` (`comPagina5` marca os dois: a página 5
conta ganhando ou perdendo, mesmo sem as outras completas; `essencialCompleto` alimenta o selo do índice). A página 1
salva ao concluir; as outras salvam cada mini-lição/passo (pular nunca apaga um adesivo ganho, `comLicao`/`comPasso`)
e a página ao concluir (`comPagina2`/`comPagina`). `paginaParaRetomar` (só 1 a 5), `extraParaRetomar` (6 a 9, só um já
começado) e `resumoDoIndice` alimentam o índice (`manual/indice.js`, `opcoesDoIndice`).

## Música

`tutorial.mid` ("Caderno do Ralsei", **composição original**): valsa 3/4 de caixinha de música em Fá maior, 96 BPM,
32 compassos (A A' B A'', ~60 s) em loop exato; **celesta** na melodia, **pizzicato** no "um-dois-três" e **piano**
dedilhando o acorde bem baixinho. Toca no GUIA (`GuiaEntrada`) e na página 1. As páginas 2 a 4 tocam `tutorial2.mid`
(a virada de página não reinicia a música): o
mesmo tema a 104 BPM, com **caixinha de música**, colcheia no pizzicato, piano em arpejo e um **glockenspiel**
respondendo (~55 s). Ao abrir "CARTAS E ARENAS" a música do menu volta. Volume: o slider de música, como todas.
Geradas por `scripts/musica/tutorial.mjs` com o escritor de MIDI mínimo `scripts/musica/midi.mjs` (sem dependência);
`src/game/__tests__/musicaTutorial.test.js` confere cabeçalho e trilhas, o loop (toda trilha termina no mesmo tick),
45 a 75 s, a região das notas de cada instrumento, note on/off pareados e que o `.mid` commitado é o que o script gera.

## Direção de arte: um caderno que o Ralsei fez à mão

Caderno de espiral sobre uma mesa de feltro; papel creme quentinho (grão, fibras, vinheta, pautas, margem vermelha,
dobrinha no canto); tudo desenhado com **giz de cera** de verdade (passadas sobrepostas, pressão variável, grão do
papel "comendo" a cera); fita washi segurando o cartão da caixa; doodles nas sobras (sol sorrindo, nuvem,
coraçõezinhos, estrelinhas, trilha de patinhas); adesivos recortados (borda branca + sombrinha). Paleta de giz
(`cera.PALETA`): verde Ralsei, rosa, azul-céu, amarelo-girassol, lavanda, mais tinta, coração e a bolinha roxa.
Texto de instrução sempre na fonte clara; só o título usa letras "tortinhas" (a mesma fonte, cada letra levemente
girada, com o grão da cera). O miolo da hitbox do coração é pintado à parte, exato e nítido, por cima do giz.

O Ralsei é um desenho original nas cores do sprite do jogo (chapéu e manto verdes, cachecol rosa, pelo branquinho,
óculos redondos como na arte do menu), segurando o giz rosa com que fez o caderno. Faz 5 caras
(`ralsei.expressaoDoRalsei`): **feliz** (padrão), **concentrado** (desenhando, com a pontinha da língua),
**surpreso** (0,9 s depois de um acerto), **incentivo** (piscadinha, no "tenta de novo") e **animado** (1,1 s depois
de cada marca e no fim). Respira, o chapéu balança e ele pisca a cada 2,6 a 5 s.

Juice: o gizinho rosa aparece na ponta do traço no "desenhando", com som de giz arranhando; cada marca vira uma
estrelinha dourada colada na fileira de cima, com brilhinhos; as bolinhas deixam um rastro apagadinho; a virada tem
o "fshhh" de folha. Sons de papel sintetizados no contexto de áudio do jogo (`somDePapel`), no volume de efeitos.

Cuidado técnico: **nenhuma imagem do manual gira** (no Chromium com GL de software, uma imagem girada de leve
perdia triângulos inteiros). Balanço é posição/escala; inclinação (a da estrela final) vai assada no canvas.

## Os módulos (`src/game/manual/`)

Tudo puro (sem Phaser, determinístico por semente, testado em `__tests__/`), menos `paginaBase.js`.

| Arquivo | Faz |
| --- | --- |
| `giz.js` | os TRAÇOS (`[{x, y}, ...]`): `linhaGiz`, `retanguloGiz`, `circuloGiz`, `coracaoGiz`, `estrelaGiz`, `xGiz`, `setaGiz`, `preencherGiz` (hachura), `cortarTracos` (o "desenhando"), `desenharTracos` (num `Graphics`: a barra e os risquinhos de acerto) |
| `cera.js` | pinta traços num **canvas 2D** como giz de cera: `passadasDaCera` (2-3 passadas deslocadas, cor variando, pressão por trecho), `preencherCera` (mancha + hachura em 2 ângulos), `pintarDesenho(ctx, camadas)`, `graoDaCera` + `aplicarGrao` (destination-out), `PALETA` |
| `ralsei.js` | o Ralsei em partes (`partesDoRalsei`: corpo, cabeça, chapéu), `rostoDoRalsei(rng, expressao, {piscando})`, `expressaoDoRalsei(etapa, ultimoEvento)`, `piscaEm` |
| `ilustracoes.js` | coração, bala, marcas (traços + camadas assadas), seta, sublinhado, `contornoDoBalao`/`bordaDoBalao`, `letrasTortas`, `rabiscosDaMargem` (sol, nuvem, coração, estrela, pata); páginas de cartas: `desenhoDaCarta` (o miolo de cada carta), `rabiscoDaGema`, `rabiscoDoBoneco` (o espantalho), `iconeDoPasso` |
| `papel.js` | `gerarPapel` (pixels: grão, fibras, manchas, vinheta), `vinheta`, `fibrasDoPapel`, `furosDaEspiral` |
| `confete.js` | `gerarConfete`, `passoConfete` (gravidade, ar, vai-e-vem), `viradaDaPeca` |
| `paginaBase.js` | **a base de toda página** (Phaser + canvas): `garantirPapel` (mesa/folha/espiral), `assar`/`assarCamadas`/`imagemDeCera`, `assarAdesivo`, `assarEstrelaDourada`, `assarLetreiro`, `assarRotulo`, `desenharFita`, `Balao` (digitação pulável), `RalseiDesenhado`, `Confete`, `brilhar`, `virarFolha`, `somDePapel`, e os pedaços jogáveis: `BalasDeGiz` (bolinhas com rastro), `coracaoDeGiz` (miolo exato da hitbox), `riscosDeGolpe`, `barraDeGiz`, `joyDeTodos`, `joysDosJogadores` (um joystick por pessoa) |
| `pagina1.js` | a máquina de estados da página 1 (as balas numa `onda`) |
| `onda.js` | a "Pista" de bolso: balas com as opções de `a.bala` e as regras de `entities/fisica.js`; `moverCoracao` |
| `padroes.js` | os roteiros da página 2 (`criarRoteiro`: chuva, linha, mira, mistura; com semente) e o `pilotoDeDesvio` |
| `pagina2.js` | a máquina de estados da página 2 (demo, tentativa, erro, escolha, adesivos, retomar) |
| `progresso.js` | validação e atualização do progresso salvo; o resumo do índice |
| `cartasDoManual.js` | as cartas das páginas 3 e 4 (as do baralho), `criarMesa` (jogar/pagar/bloquear/passar pelas regras reais) e `planoDaVitrine` |
| `vitrine.js` | o ataque real da carta na lousa: `ContextoAtaque` + `Balas` reais no relógio da Pista, mirando no boneco (roda no Node) |
| `vitrineNaTela.js` | a câmera da vitrine (Phaser): a região do mundo da vitrine desenhada em cima da lousa |
| `licaoDeCartas.js` | a máquina de estados das páginas de cartas (escolher, atacando, enchendo, errou, ajuda, demo, adesivos) |
| `pagina3.js` / `pagina4.js` | as cartas, os passos e as falas das páginas 3 e 4 |
| `pagina6.js` | extra: os quatro naipes (cartas, passos e falas; a máquina é a de `licaoDeCartas.js`) |
| `exercicio.js` | extras: a máquina dos desafios com corações e das escolhas de cartas (páginas 7 a 9) |
| `tiros.js` | os tiros mirados em cadência fixa e o ponto de graze (`posicaoDeGraze`, dos testes) |
| `pagina7.js` / `pagina8.js` / `pagina9.js` | extras: graze, jogar em dupla, ases/SUPER/perfeitos (passos e falas) |
| `cartaDeGiz.js` | as cartas de giz (textura da carta, PASSAR, brilho) das páginas de cartas e da mão da página 9 |
| `indice.js` | as linhas do índice (essencial e extras) |
| `pagina5.js` | a máquina do caderno da página 5 (intro, encher, descolar, voltar, parabéns, "e agora?") |
| `partidaDoManual.js` | a partida mansa da página 5 (CPU, vidas, semente, sem bônus) |
| `dicasDaPartida.js` | o motor de dicas da partida e o leitor de "ataque de cima" |
| `treinador.js` | o Ralsei do canto da arena, com o balão e as setas (Phaser) |

Desempenho: tudo o que não muda é **assado uma vez** numa textura de canvas (sementes fixas: reabrir a cena
reaproveita). Por quadro só se troca a textura das variantes (tremidinho a cada 170 ms, `VARIANTES = 3`) e se move
imagens; o "desenhando" repinta uma textura pequena (a área da caixa) por ~2,7 s.

## Acessibilidade

- "reduzir animações": giz parado, Ralsei parado (sem respirar/piscar/pular; as caras mudam), balão inteiro de uma
  vez, virada de página trocada na hora (corte), seta e brilhos parados, sem rastro das bolinhas, sem confete; nas
  páginas de cartas a carta não voa (só apaga quando o ataque começa), o boneco não balança e o coraçãozinho da
  demonstração não pula; na página 5 a transição para a arena e a volta são cortes, e o treinador entra e sai sem
  deslizar (balão inteiro, seta parada).
  **A linha pontilhada da mira fica** (é informação, não enfeite) e é parada (nunca pisca).
- Clarões desligados: sem confete. O confete segue o nível de "festa" dos gráficos.
- Nenhum clarão (acerto = risquinhos parados). Jogabilidade igual em qualquer ajuste.
- Contraste conferido em `__tests__/cera.test.js` (`contraste.js`): texto ≥ 4,5:1 no balão e no papel; bolinha e
  coração ≥ 3:1 no cartão da caixa.
- Texto em fonte clara com acentos (Verdana/DejaVu, negrito), nunca em letra "de mão".

## Como somar páginas

1. Lógica em `src/game/manual/paginaN.js`, puro, no formato de `criarPagina1`/`criarPagina2`: `etapa`, `tick(dt, joy)`,
   `avancar()`, `fala`, `drenar()` (eventos), mais testes em `__tests__/`. Balas SEMPRE por uma `criarOnda` (as
   regras de `entities/fisica.js`), com as opções de `a.bala`; um padrão novo ganha um caso em `paridade.test.js`.
2. Desenhos novos em `ilustracoes.js` (devolva camadas/traços; nada de Phaser).
3. Cena: use `paginaBase.js` (papel, `Balao`, `RalseiDesenhado`, adesivos, `virarFolha`, `somDePapel`); a página só
   monta o que é dela (cartão, doodles da margem nos lugares livres do seu layout, a ilustração jogável) e
   escolhe a cara do Ralsei com `expressaoDoRalsei` (ou uma regra sua). A página anterior mostra a capa desta atrás da
   folha que vira (exporte um `montarCapaDaPaginaN`) e troca de cena sem fade.
4. Registrar a cena em `config.js` e, se for cena de menu, em `rede.js` (`CENAS_DE_MENU`; a `ManualRalsei5Partida`
   não é: no meio da partida, convite não entra); somar a página em
   `progresso.js` (`PAGINAS`, formato e validação) e no índice (`DICAS_PAGINA` em `manual/indice.js`).
   Uma página de CARTAS nova: passos em `licaoDeCartas.js` (avaliar com `acao` 'atacar' | 'passar' | 'negar'), uma
   mesa de `criarMesa`, e uma entrada em `PAGINAS_CARTAS` de `ManualRalsei3.js`; ataque sempre por `planoDaVitrine`.
   Uma página de EXERCÍCIO nova (corações e metas): passos de `exercicio.js` e uma entrada em `PAGINAS_EXTRA` de
   `ManualRalsei7.js` (mais a subclasse da cena, o registro em `config.js` e em `rede.js`).
5. Cena nova segue o padrão `estadoInicial()` (`__tests__/cenasReaproveitadas.test.js` cobre).

## Antes de produzir mais páginas

- O tremidinho do giz e a linha de dicas ainda são repetidos nas duas cenas (pequenos); dá para subir para a base.
- Testar com 2 pessoas novas (teste de saída da 3A) e anotar onde perguntaram.

## Testes e verificação

`npm test` cobre `manual/__tests__/` (giz, cera, papel, Ralsei e caras, balão/doodles, confete, contraste, máquinas de
estados das páginas 1 a 5, padrões com semente, "dá para passar" e "parado leva acerto", **paridade com Balas/Heart
reais** e **paridade das cartas** (`paridadeCartas.test.js`), progresso das 5 páginas e do manual essencial e a
preferência salva, botões, as **dicas da partida** (`dicasDaPartida.test.js`: cada gatilho, o máximo, as fases cheias,
a validade, o "de cima" com os ataques reais) e a **partida mansa** (`partidaDoManual.test.js`))
e `__tests__/musicaTutorial.test.js` (o MIDI).
O fluxo completo foi jogado no navegador (Playwright + Chromium, software GL), normal e com "reduzir animações":
GUIA → índice vazio → página 1 inteira → virada para a página 2 → as 4 mini-lições (um erro de propósito e o recomeço
na chuva; a demo da linha pulada; 3 erros na mira e "pular esta parte"; a mistura) → estrela dourada → virada (na época, para o
"continua…" da página 3) → índice com ✓ nas duas → e, noutra aba com progresso parcial salvo, CONTINUAR · PÁGINA 2 retomando na
mini-lição 3 ("Que bom que você voltou!"). Nenhum erro de página.
Páginas 3 e 4: CONTINUAR · PÁGINA 2 na mistura → virada para a página 3 → uma carta qualquer (Estrela Gentil chovendo
no boneco) → "qual faz chover?" com o Bolinho errado de propósito (ele ataca e o Ralsei explica) e depois a certa →
estrela dourada → virada para a página 4 → o Bolinho (erro), o Coro bloqueado (pílula 2/3) → PASSAR (gemas 2 → 3 → 5)
→ o ★ ainda bloqueado (5/10, erro) → o Coro paga 3 e ataca → estrela dourada → página 5 "continua…" → índice com ✓
nas quatro. Noutra aba (normal e calma): 3 erros na página 3, ajuda, demonstração, "pular esta parte" e a estrela
com o adesivo faltando. Nenhum erro de página.
Página 5: CONTINUAR · PÁGINA 5 → intro → o desenho cresce, ganha cor e a folha descola → a arena real → o SUPER
bloqueado (dica "falta energia") → PASSAR → a Estrela Gentil chovendo (dica "vem de cima") → os acertos (dicas da
vida e "calma") → a rodada 2 (dica da energia) → (DEV: `pvpArena.setHp(1, 0)` para acabar) → a folha volta →
parabéns com o adesivo → "e agora?" → índice com o selo MANUAL ESSENCIAL. Também com "reduzir animações". E uma
partida PvP normal contra a CPU pelo Menu, sem dicas nem treinador. Nenhum erro de página.
