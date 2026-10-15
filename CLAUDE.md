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
- **Cuidados com o corpo** (`docs/atividades.md` seção 2): manicure, massagem, depilação, sobrancelha, maquiagem (pais rígidos proíbem até os 15), dermatologista, dentista, nutricionista (bônus nos treinos), barbeiro e cabeleireira com escolha de corte e cor no avatar, ótica (óculos no avatar), aparelho ortodôntico (2 anos, no sorriso, com eventos) e piercing de orelha com autorização dos pais; bronzeamento, tatuagem, cirurgia plástica e barbear ficam para os 18+. Sem dinheiro, o jogador pode pedir aos pais (`data/requests/parents_pay.json`). Matrícula sem pagamento acumula atraso e só cai depois de 6 meses.
- **Atividades físicas** (`docs/atividades.md`): 23 modalidades com habilidade, golpes, níveis e faixas com exame e graus, lesões, matrícula com autorização dos pais e mensalidade, e competições com medalhas.
- **Esportes coletivos** (futebol e basquete, `docs/atividades.md` seção 7): aula paga sem time, peneira com nota escondida e frase do técnico, time da escola (peneira no início do ano letivo), clubes fictícios com base por categoria (`data/clubs/`, gerados por `npm run generate-clubs`), ligas por país Série A a D (`data/leagues/`) com tabela simulada a cada temporada (`clubSeasons`), inscrição em peneira de clube, convite de olheiro, jogos da liga com tempo de jogo (titular, rodízio ou banco), promoção, manutenção ou dispensa no fim do ano letivo, e auxílio atleta dos 14 aos 19, regra do jogo igual em todos os países (`athleteAllowance`).
- **Mesada** (`docs/design.md`, seção "Mesada"): só começa depois do evento `allowance_offer` (6 a 12 anos, quase certo aos 12, conversa na voz do pai ou da mãe), com valor por faixa de idade (`familyAllowance` no país padrão). Castigos cortam a mesada por um tempo, e o jogador pode pedir aumento aos pais (uma vez por período). Save na versão 3 (quem já recebia mesada em saves antigos continua recebendo).
- **Interface:** tela de início (vida aleatória ou personalizada), diário com régua de crescimento, abas Escola, Bens, Relações e Atividades em volta do botão de avançar, PWA instalável e offline. A aba Atividades funciona em níveis (`src/ui/activityNav.js`): cartões das categorias, depois Esportes, Artes marciais e Dança, listas curtas com etiqueta à direita e a página da modalidade (treinar, matrícula, competições, "Clubes e peneiras"); o voltar do celular sobe um nível. A aba Escola mostra os times.
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
- `sibling_mischief` ("Seu irmão ou sua irmã quebrou a janela") não diz qual irmão: com dois ou mais, o efeito de assumir a culpa vai para um deles sem que o texto diga qual.
- **Ajustes pedidos pelo Pedro: ver `docs/ajustes-pedidos.md`.** Em 2026-10-15 os três (bandeiras, mesada por evento e por idade, aba Atividades em níveis) foram feitos e confirmados; ajustes novos entram naquele arquivo. Não apague esta linha; ao resolver um ajuste, marque-o como feito naquele arquivo.
