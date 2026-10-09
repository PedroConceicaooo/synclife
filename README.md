# SyncLife

Simulador de vida em texto, pensado primeiro para celular e inspirado no BitLife, mas mais próximo da vida real.

O diferencial: **o mundo é feito de pessoas**. Pais, irmãos, colegas e professores têm vida própria — brigam, se separam, conhecem outras pessoas — independente do jogador. As histórias surgem das regras, não de roteiros.

## Status

Em desenvolvimento. Versão 1: do nascimento aos 18 anos, em 5 países (Brasil, Estados Unidos, Japão, Rússia e Reino Unido/Inglaterra), interface em português.

## Stack

- HTML, CSS e JavaScript puro (ES modules), sem framework
- Node.js 20+ para rodar e testar o motor no terminal
- PWA para celular; empacotamento para lojas no futuro

## Estrutura

```
src/
  engine/      tempo, sorteios (seed), estado, condições e efeitos
  systems/     relações, eventos, interações, atividades, dinheiro
  ui/          telas e componentes
  i18n/        carregamento de textos e formatação
data/          events, interactions, activities, countries, names (JSON, sem texto)
locales/       textos do jogo por idioma (pt-BR)
tests/         testes do motor
docs/          documento de design
```

## Como rodar

```bash
npm start     # roda o motor no terminal
npm test      # roda os testes
```

## Documentação

O design completo está em [`docs/design.md`](docs/design.md). Regras de desenvolvimento para quem (ou o que) mexe no código estão em [`CLAUDE.md`](CLAUDE.md).

## Marcos

- [ ] M1 — Tempo e personagem (console)
- [ ] M2 — Família e relações
- [ ] M3 — Motor de eventos
- [ ] M4 — Interações e atividades
- [ ] M5 — Interface básica (mobile-first)
- [ ] M6 — Save e fim aos 18
- [ ] M7 — Países e i18n
- [ ] M8+ — Conteúdo
