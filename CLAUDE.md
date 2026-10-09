# CLAUDE.md — SyncLife

Leia este arquivo antes de qualquer tarefa. O design completo está em `docs/design.md`; consulte a seção relevante antes de implementar algo novo.

## O projeto

Simulador de vida em texto, mobile-first. O mundo é feito de pessoas: todo NPC tem vida própria simulada. Versão 1 vai do nascimento aos 18 anos.

## Regras que nunca podem ser quebradas

1. **Código em inglês.** Nomes de variáveis, funções, arquivos, chaves de JSON e commits em inglês. Comentários podem ser em português.
2. **Motor não conhece HTML.** Nada em `src/engine` ou `src/systems` pode acessar `document`, `window` ou DOM. O motor precisa rodar no Node, pelo terminal.
3. **Dados não contêm texto.** Arquivos em `data/` só têm ids, condições e efeitos. Todo texto mostrado ao jogador fica em `locales/<idioma>/`, ligado pelo mesmo id.
4. **Dados não contêm código.** Condições e efeitos usam um vocabulário fechado (`op`, `factor` etc.) interpretado pelo motor. Nunca use `eval` nem funções dentro de JSON.
5. **Tempo é um inteiro de meses**: `year * 12 + (month - 1)`. Idade é calculada a partir de `birth`. Avanços são de 6 ou 12 meses; pontos de decisão interrompem o avanço.
6. **Toda aleatoriedade passa pelo gerador com semente** (`seed` no save). Nunca use `Math.random()`. Mesma semente = mesma vida.
7. **Chances anuais escalam com o tempo avançado.** Em 6 meses, use a probabilidade equivalente a meio ano: `1 - (1 - p) ** (months / 12)`.
8. **Idade mínima fica no próprio dado.** Toda interação, atividade ou evento sensível declara `minAge`. Para personagens menores de 18 não existe nenhuma ação de intimidade sexual.
9. **Afinidade é separada por lado**: `affinity: { [personId]: number }`. Efeitos de afinidade declaram `side` (`player`, `target` ou `both`).
10. **Países herdam do país padrão** e só declaram o que é diferente. O motor não tem nenhum `if (country === ...)`.

## Convenções

- ES modules (`import`/`export`), funções puras sempre que possível; estado passa como parâmetro.
- Ids com prefixo: `p_` pessoas, `r_` relações.
- Valores de status de 0 a 100, sempre limitados (clamp).
- Dinheiro em escalas (`small`, `medium`, `large`) resolvidas pela moeda do país.
- Testes com `node:test` em `tests/`. Toda função do motor ganha teste.
- Commits pequenos, um assunto por commit, mensagem em inglês no imperativo (`add month-based clock`).

## Marco atual

**M1 — Tempo e personagem.** Pronto quando, via `npm start`:
- um personagem nasce num dos 5 países, com mês de nascimento;
- o jogo avança 6 ou 12 meses por vez até os 18 anos;
- aniversários acontecem no mês certo, mesmo no meio de um avanço;
- a mesma semente gera sempre a mesma vida;
- existem testes para relógio, idade e gerador aleatório.

Fora do M1: família, eventos, interações, interface, save.
