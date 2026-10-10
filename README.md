# SyncLife

Simulador de vida em texto, feito para celular. Você nasce num de cinco países (Brasil, Estados Unidos, Japão, Rússia ou Reino Unido) e vive até os 18 anos: família, escola, amigos, namoro, bicos, bens e escolhas que formam a sua personalidade. Todo mundo à sua volta tem vida própria.

**Jogar:** https://pedroconceicaooo.github.io/synclife/

No celular, abra o link e use "Adicionar à tela inicial" (Chrome no Android, Safari no iPhone). Depois da primeira visita, o jogo funciona sem internet.

O jogo é uma simulação: leis, escolas e costumes de cada país são aproximados. As fontes de cada valor estão em `docs/legal-review.md`.

## Desenvolvimento

Requer Node 20 ou mais novo. Não há dependências para instalar.

```
npm test                 # testes (node:test)
npm start -- --seed=42   # uma vida inteira no console, sempre igual para a mesma semente
npm run ui               # servidor local em http://localhost:4000
npm run legal-review     # gera docs/legal-review.md a partir dos dados dos países
```

- `docs/design.md`: o design completo.
- `CLAUDE.md`: regras do projeto e estado atual.
- Ao publicar mudanças, aumente `CACHE` em `sw.js` para os jogadores receberem a versão nova.
