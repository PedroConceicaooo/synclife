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
- **Atividades físicas** (`docs/atividades.md`): 23 modalidades com habilidade, golpes, níveis e faixas com exame e graus, lesões, matrícula com autorização dos pais e mensalidade, e competições com medalhas.
- **Esportes coletivos** (futebol e basquete, `docs/atividades.md` seção 7): aula paga sem time, peneira com nota escondida e frase do técnico, time da escola (peneira no início do ano letivo), clubes fictícios com base por categoria (`data/clubs/`, gerados por `npm run generate-clubs`), ligas por país Série A a D (`data/leagues/`), inscrição em peneira de clube, convite de olheiro, promoção, manutenção ou dispensa no fim do ano letivo, e bolsa de formação dos 14 aos 19 (`youthStipend`). Save na versão 2.
- **Interface:** tela de início (vida aleatória ou personalizada), diário com régua de crescimento, abas Escola, Bens, Relações e Atividades em volta do botão de avançar, PWA instalável e offline. Atividades tem grupos (artes marciais, dança) e, nos esportes coletivos, "Clubes e peneiras"; a aba Escola mostra os times.
- **Comandos:** `npm test`, `npm start -- --seed=42` (vida no console), `npm run ui` (servidor em http://localhost:4000), `npm run legal-review` (gera `docs/legal-review.md`), `npm run generate-clubs` (clubes e ligas profissionais).

Pendências conhecidas:

- Leis dos 5 países lidas por IA na fonte primária em 2026-10-10 (`reviewStatus: "ai_checked"`, com `checkedUrl`). O que varia por estado ou região usa um valor nacional documentado (`"simplified"`). Nenhum tem `verifiedAt`: falta a confirmação humana pelo checklist `docs/legal-review.md` (`npm run legal-review`).
- Reconferir o casamento no Japão depois de 2027-06 (decisão do pleno da Suprema Corte).
- Reino Unido: o Tobacco and Vapes Act 2026 proíbe, desde 2027, vender tabaco a nascidos a partir de 2009. As vidas começam em 2000; se o ano inicial mudar ou fumar virar mecânica, a idade precisa depender do ano de nascimento.
- `topics.same_sex_relationship`: legalidade e aceitação (Pew) preenchidas; `risk` vazio até existir mecânica que use.
- Serviço militar (BR alistamento aos 18, RU obrigatório) fica para a vida adulta, fora da v1.
- Ao publicar mudanças, aumentar `CACHE` em `sw.js` para os jogadores receberem a versão nova.
- Vida adulta (18+) fora da versão 1.
- Time da faculdade (`college`): já existe nos `teamLevels` de futebol e basquete e nas ligas `*_college`, mas sem conteúdo. Fazer junto com a vida adulta (peneira no início do ano letivo da faculdade, nota mínima ~40).
- Bolsa de formação (`youthStipend`): é regra do jogo, igual em todos os países (decisão de 2026-10-14). Os outros 4 países estão como `simplified` (regra do jogo, sem lei equivalente). Só o Brasil cita lei (Lei 14.597/2023, art. 99, §3º), ainda `needs_primary_check` porque o texto não abriu na consulta; a idade "a partir de 14" é decisão do projeto.
- Esportes coletivos ainda sem jogos da liga nem tempo de jogo (`docs/atividades.md` 7.4) e sem história simulada dos clubes (posição por temporada, 7.6).
- O evento antigo `join_sports_team` ("O time da escola está fazendo testes") é anterior às peneiras e não põe ninguém em time; decidir se vira uma peneira, sai ou fica como lembrança genérica.
