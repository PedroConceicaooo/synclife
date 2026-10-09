# SyncLife — Documento de Design (v1)

Atualizado em 2026-10-09 (inclui seção Interface). Fonte principal: Claude Doc "SyncLife — Documento de Design (v1)". Ao mudar o design, atualize os dois.

## Visão geral

SyncLife é um simulador de vida em texto, pensado primeiro para celular e inspirado no BitLife, mas mais próximo da vida real. O diferencial é que o mundo é feito de pessoas: pais, irmãos, colegas e professores têm vida própria, brigam, se separam e conhecem outras pessoas, independente do jogador.

As histórias surgem das regras, não de roteiros escritos à mão. O jogador vive a vida que quiser, e as consequências vêm do mundo: família, sociedade e leis do país onde ele vive.

## Escopo da versão 1

A versão 1 vai do nascimento aos 18 anos, em 5 países. Ela testa tudo o que importa: família com vida própria, relações, estado emocional, escolhas por fase e diferenças entre países.

**Entra:** bebê, criança e adolescente; família, irmãos, amigos, professores e namoro de escola; mesada, bicos e pequenos crimes; avanço de 6 meses ou 1 ano; save local; interface em português.

**Fica de fora:** vida adulta (faculdade, trabalho formal, casamento, filhos), regiões preenchidas, outros idiomas e outros países. O formato de dados já prevê tudo isso, mas o conteúdo fica para depois.

## Mundo, pessoas e relações

Todo mundo no jogo, inclusive o jogador, é o mesmo tipo de objeto: uma pessoa com idade, status, personalidade e dinheiro. As relações ficam numa estrutura à parte, ligando duas pessoas com um papel para cada uma (mãe e filho, marido e esposa, aluno e professor).

A cada avanço de tempo, o motor simula também as relações que não envolvem o jogador. Se a afinidade entre os pais cai abaixo de um limite, cresce a chance de divórcio; depois de um tempo, cada um pode conhecer alguém, gerando padrastos, madrastas e meio-irmãos.

Na versão 1, a afinidade é separada por lado: cada pessoa tem o seu valor sobre a outra. Você pode estar em 20 com sua mãe enquanto ela está em 80 com você.

## Status, estado emocional e personalidade

Quatro status de 0 a 100: felicidade, saúde, inteligência e aparência. Inteligência afeta notas, escola e carreira; aparência afeta namoro e popularidade.

O estado emocional tem duas camadas. O estado padrão vem da felicidade; eventos podem sobrepor um estado temporário que dura alguns meses e volta ao padrão.

| Felicidade | Estado padrão |
| --- | --- |
| 80–100 | Radiante |
| 60–79 | Feliz |
| 40–59 | Neutro |
| 20–39 | Triste |
| 0–19 | Deprimido |

Estados temporários: irritado, ansioso, apaixonado, envergonhado. Eles mudam as opções e as chances de sucesso das interações.

Cada pessoa tem 2 ou 3 traços de personalidade (paciente, explosivo, tímido, sociável, generoso, rígido, teimoso), que fazem NPCs se comportarem de forma diferente sem precisar de mais barras. Nos NPCs adultos, os traços são fixos. No personagem jogável, eles **se formam** pelas escolhas da infância: um bebê que briga sempre com a hora de dormir tende a virar uma criança teimosa.

**Aptidões ocultas.** Três valores que o jogador não vê: cognitiva, física e social. Elas definem a velocidade com que inteligência, saúde e vida social crescem ao longo da infância. Os resultados das escolhas do bebê são chances, nunca bônus garantidos, e os pais pesam mais que o bebê: pais que leem, brincam e dão atenção aumentam as aptidões, conforme a personalidade e o tempo livre deles.

**Estresse.** Adultos têm um valor de estresse (0 a 100). Um bebê difícil, desemprego ou falta de dinheiro aumentam o estresse dos pais. Estresse alto faz o casal brigar mais (a afinidade entre eles cai e a chance de divórcio sobe) e deixa os pais menos dispostos a dar presentes e dinheiro.

## Tempo e pontos de decisão

O relógio interno conta em meses (ano × 12 + mês − 1). O jogador escolhe avançar 6 meses ou 1 ano; avançar 1 mês fica como opção futura para momentos intensos.

- **Idade e aniversários:** calculados pelo mês de nascimento, então o aniversário pode cair no meio de um avanço.
- **Calendário por país:** escola e faculdade acontecem em datas reais de cada país (ano letivo começa em fevereiro no Brasil e em abril no Japão).
- **Chance proporcional:** eventos têm chance anual; em 6 meses, a chance é aproximadamente a metade. Assim, quem avança de 6 em 6 meses não recebe o dobro de eventos.
- **Pontos de decisão:** decisões com data (fim do ano letivo, fim do semestre, escolha aos 18) interrompem o avanço. O jogo para ali, pergunta e só depois segue o tempo restante.

## Fases da vida

Cada fase tem seu próprio conjunto de eventos e interações disponíveis.

| Fase | Idade | O que marca a fase |
| --- | --- | --- |
| Bebê | 0–2 | Temperamento (recusar papinha, brigar com a hora de dormir), curiosidade e pequenos acidentes, babá ou creche, chegada de um irmão. Forma aptidões e traços e afeta o estresse dos pais |
| Criança | 3–11 | Creche e escola, primeiros amigos, viagens com os pais, birras com intenção (pedir brinquedo), mesada |
| Adolescente | 12–17 | Colegas, professores, primeiro namoro, conflitos com os pais, bicos |
| Adulto | 18+ | Fora da versão 1 |

Ritmo: dois ou três eventos por avanço de tempo, alguns com escolha. Mesmo na fase de bebê, todo avanço tem pelo menos uma decisão.

Eventos de bebê que valem como referência:

- **Chegada de um irmão:** fazer carinho ou beliscar escondido define a afinidade inicial entre os dois, o que pesa se o jogador continuar a vida como esse irmão aos 18.
- **Babá:** cooperar ou aprontar; uma babá que desiste força os pais a contratar outra mais cara, mexendo no dinheiro da família.
- **Curiosidade:** engolir moeda, morder cabo, puxar a toalha da mesa. Resistir ou ceder; a consequência máxima é machucado, susto e pronto-socorro.

## Interações e barra de relação

O jogador abre o perfil de uma pessoa e escolhe entre até seis categorias; cada uma abre um submenu. Só aparecem categorias com pelo menos uma opção disponível para aquela pessoa.

| Afinidade | Cor | Significado |
| --- | --- | --- |
| 80–100 | Verde | Muito próximos |
| 60–79 | Verde-claro | Boa relação |
| 40–59 | Amarelo | Neutra / morna |
| 20–39 | Laranja | Tensa |
| 0–19 | Vermelho | Hostil |

Regras da barra:

- **Queda com o tempo:** sem interação, a afinidade cai sozinha.
- **Resultado não garantido:** depende da afinidade, dos recursos, da personalidade e do estado emocional da outra pessoa.
- **Limite por período:** número limitado de ações com cada pessoa a cada avanço de tempo.

A barra é dupla: o perfil mostra o quanto você gosta da pessoa e o quanto ela gosta de você.

| Categoria | Opções |
| --- | --- |
| Conversar | Conversar, elogiar, desabafar, pedir conselho |
| Passar tempo | Cinema, viagem, treinar, jantar, passear |
| Pedir / negociar | Pedir dinheiro, pedir algo, fazer acordo, vender algo, pedir aumento de mesada |
| Dar | Presente, dinheiro |
| Conflito | Discutir, xingar, insultar |
| Relação | Específicas do vínculo: aniversário de namoro, terminar, terapia, divórcio |

| Tipo de pessoa | Interações principais (até 18 anos) |
| --- | --- |
| Pais e responsáveis | Todas as categorias, mais pedir permissão para sair ou viajar com amigos, ajudar em casa sem pagamento, apresentar namorado(a) |
| Irmãos | Brincar, conversar, implicar, brigar, pedir ajuda, dedurar para os pais, assumir a culpa |
| Amigos | Sair, convidar para casa, jogar, fofocar, pedir ajuda com a lição, estudar juntos, apresentar a outros, brigar, se afastar |
| Professores | Tirar dúvida, pedir ajuda ou ponto extra, puxar conversa, elogiar, piada na aula, irritar, reclamar; afeta notas e advertências |
| Crush / namoro da escola | Puxar conversa, mensagem ou bilhete, chamar para sair, presente, pedir em namoro, comemorar, discutir, terminar |

Interações com mecânica própria:

- **Apresentar namorado(a) aos pais:** a reação depende dos traços dos pais e da aceitação social do país. Pais rígidos podem proibir o namoro, o que libera **namorar escondido**: a cada avanço há chance de os pais descobrirem, com queda forte na afinidade deles com o jogador.
- **Assumir a culpa (irmãos):** quando um evento mostra um irmão fazendo algo errado, o jogador pode levar a culpa. A afinidade do irmão com o jogador sobe muito; a dos pais com o jogador cai.
- **Estudar juntos (amigos e colegas):** aumenta a afinidade dos dois lados e dá um pequeno ganho de inteligência para ambos.
- **Ajudar em casa sem pagamento (pais):** diferente do acordo por dinheiro. Reduz o estresse dos pais e aumenta a afinidade deles com o jogador, o que melhora as chances em pedidos e presentes futuros.

## Atividades e dinheiro

O personagem menor de idade tem quatro fontes de dinheiro. Ações que não dependem de outra pessoa ficam num menu próprio, **Atividades**.

| Fonte | Como funciona |
| --- | --- |
| Mesada | Paga todo mês pelos pais. Valor depende do dinheiro da família, da personalidade dos pais e da afinidade; pode ser cortada como castigo ou aumentada a pedido |
| Ajudar os pais | Via "fazer acordo": ajuda numa tarefa difícil em troca de dinheiro ou algo específico |
| Bicos informais | Em Atividades: capinar, carregar compras, lavar carro, passear com cachorros, vender no recreio, cuidar de crianças (14+). Cada um tem idade mínima, ganho, custo e chance de pequenos eventos |
| Pequenos crimes | Em Atividades: furtar alguém, roubar encomendas, furtar loja. Chance de ser pego e consequências vêm do país (justiça juvenil) e da família |

**Vender no recreio** é um bico com investimento e risco: o jogador usa o próprio dinheiro para comprar mercadoria (doces, itens da moda) e revende na escola. O lucro pode ser maior que o de outros bicos, mas um professor rígido pode confiscar a mercadoria e dar advertência.

Valores de dinheiro usam escalas (pequeno, médio, grande) definidas por país, não números fixos.

## Eventos

Um único formato de evento serve para o jogador e para o mundo.

- **Eventos do jogador:** acontecem com o personagem (vacina, briga na escola) e podem ter opções de escolha, cada uma com seus efeitos.
- **Eventos do mundo:** acontecem em relações entre NPCs (divórcio dos pais, novo namoro de um deles). O motor percorre as relações a cada avanço e testa esses eventos.
- **Ligação entre os dois:** quando um evento do mundo envolve o jogador, dispara um ponto de decisão. Exemplo: os pais se divorciam e o jogador escolhe com quem morar.

Interações também podem gerar eventos com uma chance (irritar o professor pode gerar advertência depois). Cada resultado tem vários textos sorteados, para não repetir.

## Países, leis e regiões

Cada país é um arquivo de dados que herda de um país padrão e só declara o que é diferente. O motor não conhece nenhum país.

Cada tema sensível tem três dimensões independentes:

- **Legal:** permitido, restrito, não reconhecido ou crime.
- **Aceitação social:** 0 a 100; define a reação de família, colegas e sociedade, ajustada pela personalidade de cada NPC.
- **Risco:** chance de consequência quando o personagem se expõe.

O jogador pode viver a vida que quiser; os riscos vêm do mundo (ser descoberto, rejeição, polícia), nunca de tratar a identidade do personagem como errada. Emigrar ou pedir asilo é uma consequência natural para a vida adulta.

| País | O que esse país testa |
| --- | --- |
| Brasil | Base de comparação; ano letivo de fevereiro a dezembro; ENEM/vestibular; justiça juvenil pelo ECA |
| Estados Unidos | Beber só aos 21; ano letivo no meio do ano; leis estaduais (regiões no futuro) |
| Japão | Ano letivo em abril; maioridade 18, beber e fumar 20; pressão escolar e exames de entrada; união do mesmo sexo não reconhecida nacionalmente |
| Rússia | Serviço militar obrigatório para homens; leis restritivas sobre temas LGBT |
| Reino Unido (região Inglaterra) | Ano letivo em setembro; GCSE e A-levels; primeiro teste do sistema de regiões |

Toda lei registrada guarda fonte e data de verificação, porque leis mudam e rascunhos feitos com IA precisam de revisão. A tela inicial avisa que o jogo é uma simulação e pode ter imprecisões.

## Regras de conteúdo e idade

O filtro de conteúdo funciona em três camadas, sem depender de bloquear caso a caso.

1. **Idade no próprio dado:** toda interação ou evento sensível tem idade mínima, e o motor nunca oferece o que a condição não permite.
2. **Menores de 18:** não existe nenhuma ação de intimidade sexual. Namoro se limita a conversar, sair, presentes, ficar de mãos dadas. Namoro entre pessoas do mesmo sexo usa as mesmas interações; para menores, as consequências são sociais (pais, colegas, bullying, ter que esconder).
3. **Adultos (fora da versão 1):** intimidade só entre personagens adultos, tratada de forma implícita, com uma frase curta e corte de cena. Os efeitos mecânicos continuam existindo.

Na fase de bebê, nenhuma escolha do jogador leva à morte do personagem. Acidentes domésticos terminam em machucado, susto ou pronto-socorro, com tom leve e sem descrição gráfica.

Todo texto gerado com IA que envolva personagens menores passa por revisão humana antes de entrar no jogo.

## Fim aos 18 e continuação

Aos 18 anos, o jogo mostra um resumo da vida (principais acontecimentos, status finais, relações mais fortes) e oferece duas opções:

- **Começar uma vida nova**, num mundo novo.
- **Continuar como um irmão ou irmã** vivo e menor de 18 anos, incluindo meio-irmãos. Sem irmão elegível, só aparece a vida nova.

Ao continuar, o mundo é o mesmo: o personagem anterior vira um NPC comum, com vida própria simulada. No save, `playerId` passa a apontar para o irmão e `pastLives` guarda os personagens já jogados.

## Idiomas (i18n)

Código e chaves em inglês; o jogo começa em português do Brasil e pode receber outros idiomas sem mudar o motor.

- **Dados sem texto:** eventos, interações e países só têm ids. Os textos ficam em `locales/<idioma>/`, ligados pelo mesmo id.
- **Gênero gramatical:** sintaxe `{player|quietinho|quietinha}`; o motor escolhe a forma pelo sexo da pessoa indicada.
- **Idioma reserva:** se faltar um texto num idioma, o jogo mostra o português.
- **Números, moedas e datas:** formatados com `Intl.NumberFormat` e `Intl.DateTimeFormat`.
- **Nomes locais:** nomes de etapas escolares (como Shōgakkō) ficam nos textos traduzidos, com explicação no idioma do jogador.

## Formatos de dados

Três princípios valem para todos os formatos:

1. **Dados nunca contêm código.** Condições e efeitos usam um vocabulário fechado que o motor interpreta.
2. **Tudo tem um id estável.** As referências entre dados são sempre por id.
3. **Tempo é um número de meses.** Arquivos escritos à mão podem usar `{ "year": 2010, "month": 4 }`, e o motor converte.

### Person

```json
{
  "id": "p_0002",
  "firstName": "Akemi",
  "lastName": "Tanaka",
  "sex": "F",
  "birth": 23893,
  "death": null,
  "countryId": "JP",
  "regionId": null,
  "stats": { "happiness": 62, "health": 80, "intelligence": 71, "looks": 55 },
  "aptitudes": { "cognitive": 0.6, "physical": 0.4, "social": 0.7 },
  "stress": 35,
  "emotion": { "type": "angry", "until": 24316 },
  "traits": ["patient", "sociable"],
  "traitTendencies": {},
  "money": 150000,
  "occupation": { "type": "job", "title": "nurse" },
  "flags": {}
}
```

`traitTendencies` acumula as escolhas da infância do personagem jogável (ex.: `{ "stubborn": 4 }`) até que um traço se fixe.

### Relationship

```json
{
  "id": "r_0001",
  "roles": { "p_0002": "mother", "p_0001": "son" },
  "type": "family",
  "affinity": { "p_0001": 20, "p_0002": 80 },
  "state": null,
  "since": 24120,
  "lastInteraction": 24300,
  "interactionsThisPeriod": 1
}
```

`affinity[X]` é o quanto X gosta da outra pessoa. Efeitos de afinidade dizem qual lado muda com `side`: `player`, `target` ou `both`.

### Interaction

```json
{
  "id": "ask_money",
  "category": "ask",
  "conditions": { "targetRole": ["mother", "father", "guardian"], "minAge": 5 },
  "chance": {
    "base": 0.4,
    "modifiers": [
      { "factor": "affinity", "weight": 0.5 },
      { "factor": "targetEmotion", "value": "angry", "adjust": -0.3 },
      { "factor": "targetTrait", "value": "generous", "adjust": 0.2 }
    ]
  },
  "success": [
    { "op": "transferMoney", "from": "target", "to": "player", "amount": "small" },
    { "op": "affinity", "side": "target", "delta": -2 }
  ],
  "failure": [ { "op": "affinity", "side": "both", "delta": -4 } ]
}
```

### Activity

```json
{
  "id": "mow_lawn",
  "category": "odd_jobs",
  "conditions": { "minAge": 10 },
  "earnings": "small",
  "effects": [ { "op": "stat", "target": "player", "stat": "health", "delta": 1 } ],
  "randomEvents": [ { "event": "neighbor_extra_tip", "chance": 0.15 } ]
}
```

### Event

```json
{
  "id": "divorce",
  "subject": "relationship",
  "conditions": { "type": "romantic", "state": "married", "maxAffinity": 25 },
  "yearlyChance": 0.2,
  "effects": [ { "op": "relationshipState", "value": "divorced" } ],
  "ifInvolvesPlayer": { "trigger": "choose_who_to_live_with" }
}
```

Eventos do jogador usam `"subject": "player"` e uma lista `options`, cada opção com `id` e `effects`.

### Country

```json
{
  "id": "JP",
  "inherits": "default",
  "currency": { "code": "JPY", "scale": { "small": 2000, "medium": 20000, "large": 200000 } },
  "ages": { "majority": 18, "drinking": 20, "smoking": 20, "driving": 18 },
  "education": {
    "schoolYearStartMonth": 4,
    "stages": [
      { "id": "elementary", "startAge": 6, "years": 6 },
      { "id": "middle", "startAge": 12, "years": 3 },
      { "id": "high", "startAge": 15, "years": 3, "entranceExam": true }
    ]
  },
  "topics": {
    "same_sex_union": { "legal": "not_recognized", "acceptance": 50, "risk": 0, "source": "", "verifiedAt": "" }
  },
  "names": "names/jp.json",
  "regions": []
}
```

O valor `50` de aceitação é exemplo, não dado real.

### Save

```json
{
  "saveVersion": 1,
  "seed": 918273,
  "currentMonth": 24316,
  "playerId": "p_0001",
  "pastLives": [],
  "people": {},
  "relationships": {},
  "firedEvents": [],
  "history": []
}
```

`saveVersion` permite converter saves antigos quando um formato mudar. `seed` alimenta todos os sorteios: a mesma semente reproduz a mesma vida, o que facilita corrigir bugs.

## Interface

A tela gira em torno do **diário da vida**: cada avanço de tempo acrescenta um bloco de texto contando o que aconteceu. Referência de estrutura: o BitLife. A identidade visual (cores, ícones, estilo dos botões) é própria do SyncLife.

### Tela principal

| Área | Conteúdo |
| --- | --- |
| Cabeçalho, à esquerda | Bandeira do país, nome completo do personagem e, embaixo, a fase da vida (Bebê, Criança, Adolescente) |
| Cabeçalho, à direita | Saldo com o símbolo da moeda do país (US$ 1.250, R$ 300, ¥ 2.000), formatado com `Intl.NumberFormat`; embaixo, o rótulo "Saldo" |
| Centro | Diário da vida, com rolagem; o bloco mais recente fica embaixo e a tela rola até ele após cada avanço |
| Navegação | Botão grande central para avançar, com as duas opções lado a lado: 6 meses e 1 ano. Não existe voltar no tempo; abas ao redor: fase atual, relacionamentos, atividades e bens |
| Rodapé fixo | As quatro barras de status (felicidade, saúde, inteligência, aparência) com porcentagem, sempre visíveis |

Países aparecem sempre pelo nome completo no idioma do jogo ("Estados Unidos", nunca "US") e com bandeira. Emojis de bandeira não aparecem no Windows (viram as letras "US"), então as bandeiras usam imagens SVG embutidas, não emojis.

### Diário da vida

Cada bloco começa com a idade ("Idade: 3 anos" ou "Idade: 3 anos e 6 meses"). A data do calendário é opcional e, se aparecer, fica só no diário, não no cabeçalho.

O **primeiro bloco** apresenta o personagem e a família: nome completo, sexo, cidade e país de nascimento, data de aniversário, e o nome, a profissão e a idade de cada pai ou mãe. Exemplo: "Eu nasci menina em Chicago, Estados Unidos. Meu aniversário é 14 de março. Meu nome é Sofia Reed. Minha mãe é Laura Reed, enfermeira (29 anos). Meu pai é Daniel Reed, motorista de ônibus (31 anos)."

Os **blocos seguintes** registram tudo o que aconteceu no período: eventos e a escolha feita com o resultado, aniversários, mudanças de status relevantes, dinheiro ganho ou perdido (mesada, bicos, presentes) e eventos do mundo que envolvem pessoas próximas ("Seus pais tiveram uma briga feia"). Nada que mude o personagem acontece sem aparecer no diário.

### Escolhas

Eventos com escolha e pontos de decisão aparecem num pop-up por cima da tela principal, durante o avanço. Depois da escolha, o resultado entra no bloco do período.

### Telas secundárias

- **Início:** nova vida aleatória ou vida personalizada (nome, sexo, país, cidade).
- **Relacionamentos:** só pessoas próximas: família (pais, irmãos, padrastos), namorado(a) e amigos. Cada uma com nome, papel e barra de relação dupla; tocar abre o perfil com as categorias de interação. Conhecidos (colegas de classe, professores, colegas de trabalho no futuro) ficam dentro da tela do lugar onde convivem, como a escola, para a lista não ficar poluída. Um colega que vira amigo passa para Relacionamentos.
- **Atividades e bens:** listas com ícone, título e uma linha de descrição.

### Para depois

Talento especial do personagem (por exemplo, basquete), mostrado com um ícone ao lado do nome.

### Problemas encontrados no M5 (corrigir no M5.1)

- [ ] Nome do personagem não aparece na tela.
- [ ] País aparece como código ("US") em vez de nome completo e bandeira.
- [ ] Saldo aparece como a palavra "dinheiro" em vez do símbolo da moeda do país.
- [ ] O diário não apresenta o personagem nem os pais ao nascer.
- [ ] Status ficam parados em 50: não há valores iniciais sorteados, crescimento pelas aptidões nem efeitos de eventos sobre eles.
- [ ] Poucos eventos: em um ano houve só um (separação dos pais). A regra de pelo menos uma decisão por avanço não está sendo cumprida.
- [ ] Dinheiro entra sem explicação: em 18 anos acumulou cerca de 4.212 sem que o diário mostrasse de onde veio, e não há em que gastar.

## Arquitetura técnica e marcos

HTML, CSS e JavaScript puro, com módulos separados e repositório no GitHub desde o primeiro dia. A regra principal: o motor (lógica) não sabe que existe HTML, então pode ser testado no console e a interface pode ser trocada depois.

**Foco em celular.** A interface é pensada primeiro para tela de celular: uma coluna, botões grandes, tudo alcançável com o polegar. O jogo começa como PWA, instalável pelo navegador. Para as lojas, o mesmo código pode ser empacotado depois (por exemplo, com Capacitor), sem reescrever o jogo.

```
src/
  engine/      tempo, sorteios (seed), estado, condições e efeitos
  systems/     relações, eventos, interações, atividades, dinheiro
  ui/          telas e componentes
  i18n/        carregamento de textos e formatação
data/          events, interactions, activities, countries, names
locales/       pt-BR (e futuros idiomas)
docs/          este documento
```

Cada marco termina com algo jogável ou testável:

1. **M1 — Tempo e personagem:** nasce, envelhece mês a mês e chega aos 18, só no console.
2. **M2 — Família e relações:** pais gerados, afinidade com queda no tempo, simulação das relações entre NPCs.
3. **M3 — Motor de eventos:** condições, chance proporcional ao tempo, opções e pontos de decisão.
4. **M4 — Interações e atividades:** categorias, chance de sucesso, limite por período, mesada e bicos.
5. **M5 — Interface básica:** status, barra de relação, perfil de pessoas, avançar 6 meses ou 1 ano.
6. **M6 — Save e fim aos 18:** salvar e carregar, resumo da vida, continuar como irmão.
7. **M7 — Países e i18n:** país padrão, 5 países, textos em `locales/pt-BR`.
8. **M8+ — Conteúdo:** eventos e interações até a vida parecer variada.

## Decisões em aberto

- [ ] Checar se o nome SyncLife está livre nas lojas de aplicativos e como domínio.
- [ ] Quando e em quais lojas lançar (Google Play, App Store).
- [ ] Quantas interações por pessoa a cada avanço de tempo.
- [ ] Lista final de traços de personalidade e de estados emocionais temporários.
- [ ] Pesquisa e preenchimento das leis dos 5 países, com fonte e data.
