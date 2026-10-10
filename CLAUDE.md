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

## Estado atual

M1 a M7 do design estão feitos, e o M8 (conteúdo) está em andamento. O jogo cobre a vida inteira até os 18:

- **Motor:** relógio em meses, semente, família com irmãos, eventos sorteados e de calendário escolar por país, decisões que interrompem o avanço, interações, atividades (bicos, lazer, pequenos delitos), bens, escola com turma e professores, amizade, namoro, pets, emoções, traços formados pelas escolhas, estresse dos pais, save e fim aos 18 com continuação como irmão.
- **Interface:** tela de início (vida aleatória ou personalizada), diário com régua de crescimento, abas Escola, Bens, Relações e Atividades em volta do botão de avançar, PWA instalável e offline.
- **Comandos:** `npm test`, `npm start -- --seed=42` (vida no console), `npm run ui` (servidor em http://localhost:4000), `npm run legal-review` (gera `docs/legal-review.md`).

Pendências conhecidas:

- Leis dos 5 países pesquisadas (`docs/fontes-paises.md`), mas nenhuma conferida na fonte primária: `reviewStatus` é `researched` ou `needs_primary_check` (⚠️) e `verifiedAt` está vazio. Checklist em `docs/legal-review.md` (`npm run legal-review`).
- `topics.same_sex_relationship`: legalidade e aceitação (Pew) preenchidas; `risk` vazio até existir mecânica que use.
- Serviço militar (BR alistamento aos 18, RU obrigatório) fica para a vida adulta, fora da v1.
- Ao publicar mudanças, aumentar `CACHE` em `sw.js` para os jogadores receberem a versão nova.
- Vida adulta (18+) fora da versão 1.
