# Contribuindo

## Antes de abrir PR

Rode, nesta ordem:

```sh
npm run lint    # ESLint (eslint.config.js): erros de correção, sem regras de estilo
npm test        # testes unitários (node --test), sem rede
npm run build   # o Vite precisa compilar
```

- `npm run lint` pega o que o teste unitário não vê: um nome usado sem import
  (`no-undef`), uma chave repetida num objeto, código depois de `return`, um import
  reatribuído. Ele roda também nos `.svelte`. O resultado tem que ter **0 erros**; os
  avisos de variável não usada são só um lembrete.
- `npm test` não depende do lint: os dois podem ser rodados separadamente.
- O lint não reformata nada. Não existem regras de estilo nem `prettier` aqui.

Se um aviso for falso positivo (por exemplo, uma global do jogo), declare a global em
`eslint.config.js` em vez de desligar a regra para o projeto inteiro.
