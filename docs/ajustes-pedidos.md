# SyncLife — Ajustes pedidos (abertos)

Criado em 2026-10-15. Lista dos ajustes que o Pedro pediu ao jogar. Cada um tem o que foi visto, o que já foi conferido e o critério de pronto. O `CLAUDE.md` aponta para este arquivo. Ao resolver um ajuste, troque `Aberto` por `Feito (data)` e deixe o texto como histórico.

## 1. Bug: bandeiras não aparecem na tela inicial — Feito (2026-10-15)

**O que se vê:** na escolha de país, só a bandeira do Brasil carrega. Estados Unidos, Japão, Reino Unido e Rússia mostram o ícone de imagem quebrada.

**Já conferido:** os 5 arquivos existem em `src/ui/flags/` (`BR`, `US`, `JP`, `GB`, `RU`.svg), são XML válido, e `src/ui/render.js` monta o caminho `src/ui/flags/${country.id}.svg` (tela inicial e cabeçalho). O `sw.js` usa `CACHE = 'synclife-v5'` e as bandeiras não estão na lista `SHELL`.

**Hipóteses, nesta ordem:**

1. Os SVGs, menos o `BR.svg`, não foram commitados ou enviados ao GitHub Pages (`git ls-files src/ui/flags`; aba Network em https://pedroconceicaooo.github.io/synclife/ e em `npm run ui`).
2. O service worker devolve resposta vazia 504 para as bandeiras (elas não estão em `SHELL`). Testar com o cache limpo; ao corrigir, aumentar `CACHE` e incluir as 5 bandeiras em `SHELL`.
3. Maiúsculas e minúsculas no nome do arquivo (o GitHub Pages diferencia, o Windows não) ou `id` do país diferente do nome do SVG.

**Pronto quando:** as 5 bandeiras aparecem na tela inicial e no cabeçalho, no servidor local e no GitHub Pages, com e sem service worker; e há um teste que confere que existe um SVG para cada país em `data/countries/` (e que cada um está na lista de arquivos do cache).

**O que foi feito (2026-10-15, commit `7e9cbda`):**

- Hipótese 1 descartada: os 5 SVGs estão no git com o nome certo, e o GitHub Pages devolve 200 com `image/svg+xml` para todos.
- Hipótese 3 descartada: os ids dos países são iguais aos nomes dos arquivos (maiúsculas).
- Não foi possível reproduzir no Chrome: as 5 bandeiras carregam no servidor local e no GitHub Pages, com o service worker ligado ou não, e também sem rede depois de jogar.
- Hipótese 2 corrigida mesmo assim: o service worker só guardava uma bandeira depois de vê-la, e quase todas só aparecem na tela de vida personalizada. Num navegador que não baixa imagens escondidas (o Safari do iPhone, por exemplo), só a bandeira do cabeçalho ficaria guardada para uso sem rede, o que bate com "só a do Brasil". As 5 bandeiras agora entram no `SHELL`, o `CACHE` foi para `synclife-v6`, e há um teste em `tests/uiSyntax.test.js` para isso.

**Confirmado pelo Pedro em 2026-10-15:** depois do push, as 5 bandeiras aparecem no aparelho onde o defeito tinha aparecido.

## 2. Mesada por evento e por idade — Feito (2026-10-15)

**O que se vê:** os pais pagam mesada todo mês, sem o jogador pedir, desde os 3 anos, no mesmo valor em qualquer idade (no Brasil, cerca de R$ 20 a R$ 45 por mês; `small` = 25). É muito para uma criança e faz o dinheiro cair sem esforço. Hoje isso está em `payAllowance`, em `src/systems/money.js` (`ALLOWANCE_MIN_AGE = 3`), chamado de `src/systems/game.js`.

**O que fazer** (a regra completa está em `docs/design.md`, seção "Mesada"):

1. Novo evento `allowance_offer`: 6 a 12 anos, uma vez por vida, chance por afinidade, dinheiro da família, traços e estresse, quase certo aos 12. Diálogo dos pais com variações por traço (generoso, rígido, padrão) e 3 opções: aceitar e agradecer; pedir um valor maior (chance de funcionar; 25% a mais, ou "Não abusa, hein?"); dizer que prefere ganhar ajudando em casa (volta a partir dos 12). Textos só em `locales/pt-BR`.
2. A mesada só é paga depois do evento (um sinalizador na pessoa). Saves antigos que já recebem continuam recebendo: aumentar `saveVersion` e converter.
3. Valor por faixa de idade em dado do país padrão (`familyAllowance`, com escala e multiplicador, no mesmo formato de `athleteAllowance`). Valores iniciais, como parte do `small`: 6 a 8 anos, 40%; 9 a 11, 80%; 12 a 14, 140%; 15 a 17, 200%.
4. Condições ou efeitos novos entram no vocabulário fechado do motor, com teste. Ajustar os testes de `money` e `game` que esperam mesada aos 3 anos.
5. Em outra etapa: cortar a mesada como castigo e "pedir aumento" (um por período).

**Pronto quando:** uma vida simulada de 18 anos só começa a receber mesada depois do evento, o diário mostra a conversa, e o valor mensal cresce com a idade.

**O que foi feito (2026-10-15, commits `9a11e24` e `8650f66`):**

- Evento `allowance_offer` (`data/events/allowance_offer.json`): dos 6 aos 17 anos, chance anual de 12% que sobe com a afinidade, o dinheiro e o traço generoso dos pais e cai com pais rígidos ou estressados; a partir dos 12 fica quase certa (até 95%). Um dos pais fala (sorteado), com texto padrão, generoso ou rígido.
- Opções: aceitar (afinidade +2); pedir mais (chance; se der certo, mesada 25% maior; se não, "Não abusa, hein?" e afinidade −2); ajudar em casa (afinidade +3, a oferta volta a partir dos 12 anos e no mínimo 12 meses depois).
- A mesada só é paga depois do evento (`person.allowance`). Faixas em `familyAllowance` no país padrão: 40%, 80%, 140% e 200% do `small`, mês a mês pela idade.
- Vocabulário novo, com testes: condição `awaitsAllowanceOffer`, efeito `allowance`, fatores `parentsWealth`, `parentsStress` e `fromAge`, `chanceModifiers` em eventos do jogador, `speaker` e opções com `check`.
- Save na versão 3: quem já recebia continua recebendo, sem o evento. `CACHE` em `synclife-v7`.
- Item 5, feito depois no mesmo dia: os castigos (advertência da escola, pais chamados, polícia) cortam a mesada por 3, 6 ou 12 meses, com linha no diário no corte e na volta; a interação "Pedir aumento da mesada" (uma vez por período, pedir demais irrita) aumenta 10% até o dobro. Regra em `docs/design.md`, seção "Mesada".

**Confirmado pelo Pedro em 2026-10-15:** a conversa aparece aos 6 anos numa vida nova (depois de recarregar a página para o service worker trocar de versão).

## 3. Navegação da aba Atividades em níveis — Feito (2026-10-15)

**O que se vê:** a aba Atividades é uma lista longa (bicos, depois atividades físicas, depois danças e artes marciais). É preciso rolar para ver tudo, o último item fica cortado atrás do botão +1 ano / +6 meses, e cada item repete "Você já fez isso neste período." em duas linhas.

**O que fazer** (a regra completa está em `docs/design.md`, seção "Navegação da aba Atividades"):

1. Nível 1: grade de 2 colunas com cartões grandes (ícone, título, "N opções"): Bicos, Lazer, Atividades físicas, Cuidados com o corpo, Pequenos crimes. Cabe na tela sem rolar. Cartão sem opção disponível para a idade, o sexo ou o país não aparece.
2. Nível 2: página da categoria. Atividades físicas abre cartões **Esportes**, **Artes marciais** e **Dança**. Bicos abre a lista dos bicos.
3. Nível 3: a lista da subcategoria (Artes marciais com 10 modalidades, Dança com 7 estilos, Esportes). Nível 4: página da modalidade (Treinar, Clubes e peneiras, Competições, habilidade e graduação).
4. Cabeçalho de página com seta de voltar, título e caminho curto. O botão voltar do celular sobe um nível. Ao abrir a aba, cai no nível 1; depois de fazer uma atividade, continua na mesma página; depois de avançar o tempo, volta ao diário.
5. Linhas curtas: nome à esquerda e etiqueta à direita ("R$ 25", "Feito neste período", "Precisa de matrícula"); itens já feitos esmaecidos e no fim. Atividade de um toque (um bico) tem o botão na própria linha.
6. A lista nunca passa por baixo da barra de abas nem do botão +1 ano / +6 meses. A página começa no topo ao entrar e volta à posição anterior ao voltar.

**Pronto quando:** no celular (tela estreita), o início da aba cabe sem rolar, todas as atividades atuais continuam acessíveis (nenhuma some), e há teste para a lógica de navegação (nível, voltar, itens ocultos por idade).

**O que foi feito (2026-10-15, commits `cfe2f56` e `81a8559`):**

- `src/ui/activityNav.js` (lógica pura, com testes em `tests/activityNav.test.js`): transforma as atividades disponíveis e um caminho na página a mostrar, sobe um nível, monta o caminho curto e cai no nível válido mais próximo quando uma página deixa de valer. Os testes conferem, com o jogo de verdade aos 5, 10, 14 e 17 anos, que nenhuma atividade fica inacessível.
- Esportes ganharam o grupo `sports` nos dados (futebol, basquete, natação, corrida, academia e CrossFit).
- Tela: cartões em 2 colunas nos níveis 1 e 2, linhas curtas com etiqueta à direita (preço, ganho, "Feito neste período", "Precisa de matrícula", "Pedir aos pais"), itens feitos esmaecidos e no fim, bico feito na própria linha, página da modalidade (treinar, matrícula, competições, clubes e peneiras), e barbeiro, cabeleireira e clubes como páginas do mesmo caminho. A lista antiga com grupos que abriam para baixo saiu.
- O último item fica acima do botão +1 ano / +6 meses (espaço no fim de todas as telas). O voltar do celular sobe um nível, a página de cima volta à posição de rolagem, e ao sair da aba o voltar funciona como antes. `CACHE` em `synclife-v8`.

**Confirmado pelo Pedro em 2026-10-15:** funcionando no `npm run ui`.
