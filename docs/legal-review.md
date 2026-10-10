# Revisão das leis por país

Gerado por `node scripts/legal-review.js` a partir de `data/countries/`. Não edite à mão: corrija os dados e gere de novo.

Situação de cada item:

- `ai_checked`: o texto da lei foi lido por IA na fonte indicada (link e data abaixo). Falta só a sua confirmação.
- `needs_primary_check`: ⚠️ varia por estado ou região, depende de decisão pendente, ou a fonte primária não pôde ser aberta. O motivo está no texto da fonte.
- `verified`: conferido por uma pessoa.

Para confirmar um item, abra o link, confira e, no JSON do país, preencha `verifiedAt` (data) e troque `reviewStatus` para `"verified"`. Se o valor estiver errado, corrija o campo e a fonte. Pesquisa de base: `docs/fontes-paises.md`.

`risk` dos temas sensíveis continua sem valor: nenhuma mecânica usa ainda e as fontes não dão um número.

## Brasil

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Código Civil (Lei 10.406/2002), art. 5º: "A menoridade cessa aos dezoito anos completos" ([link](https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm), 2026-10-10) | ai_checked |
| [ ] | Idade para beber | 18 | ECA (Lei 8.069/1990), art. 81, II (venda de bebidas alcoólicas a criança ou adolescente proibida) e art. 243 ([link](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm), 2026-10-10) | ai_checked |
| [ ] | Idade para fumar | 18 | ECA (Lei 8.069/1990), art. 81, III (produtos que causam dependência física ou psíquica) ([link](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm), 2026-10-10) | ai_checked |
| [ ] | Idade para dirigir | 18 | CTB (Lei 9.503/1997), art. 140, I: o candidato deve "ser penalmente imputável", ou seja, ter 18 anos (ECA, art. 104) ([link](https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm), 2026-10-10) | ai_checked |
| [ ] | Responsabilidade penal (justiça juvenil) | 12 | ECA, art. 2º (adolescente de 12 a 18 anos), art. 104 (inimputáveis os menores de 18), art. 105 (criança: medidas de proteção do art. 101) e art. 112 (medidas socioeducativas) ([link](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm), 2026-10-10) | ai_checked |
| [ ] | Sistema escolar | mês 2 a 12; elementary 6+ (5 anos); middle 11+ (4 anos); high 15+ (3 anos) | LDB (Lei 9.394/1996), art. 32 (fundamental de 9 anos a partir dos 6) e art. 35 (médio de no mínimo 3 anos); a lei fixa 200 dias letivos (art. 24), e fevereiro a dezembro é a prática das redes, não regra legal ([link](https://www.planalto.gov.br/ccivil_03/leis/l9394.htm), 2026-10-10) | ai_checked |
| [ ] | Casal do mesmo sexo | legal: permitted; aceitação: 52; risco: — | Legal: Resolução 175/2013 do CNJ, art. 1º (vedada a recusa de casamento civil entre pessoas do mesmo sexo). Aceitação: Pew Research Center 2023, 52% apoiam o casamento (https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/) ([link](https://atos.cnj.jus.br/atos/detalhar/1754), 2026-10-10) | ai_checked |

## Estados Unidos

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | ⚠️ Não verificado na fonte primária: 18 na maioria dos estados; 19 no Alabama (Ala. Code § 26-1-1) e Nebraska; 21 no Mississippi (Miss. Code § 1-3-27), que usa 18 em outras leis. Pendente: lei de cada estado; conferido só em fonte secundária ([link](https://www.law.cornell.edu/wex/age_of_majority), 2026-10-10) | needs_primary_check |
| [ ] | Idade para beber | 21 | 23 U.S.C. § 158: retenção de verbas federais de estados que permitam compra ou porte público de álcool por menores de 21 anos ([link](https://www.law.cornell.edu/uscode/text/23/158), 2026-10-10) | ai_checked |
| [ ] | Idade para fumar | 21 | FDA, Tobacco 21: idade mínima federal de venda de produtos de tabaco elevada de 18 para 21, sancionada em 20/12/2019 e em vigor imediatamente ([link](https://www.fda.gov/tobacco-products/retail-sales-tobacco-products/tobacco-21), 2026-10-10) | ai_checked |
| [ ] | Idade para dirigir | 16 | ⚠️ Não verificado na fonte primária: habilitação graduada estadual: permissão de aprendiz entre 14 e 17 anos, licença restrita em geral aos 16 (de 15 a 17 conforme o estado). Pendente: lei de cada estado; o jogo usa 16 ([link](https://www.iihs.org/research-areas/teenagers/graduated-licensing-laws-table), 2026-10-10) | needs_primary_check |
| [ ] | Responsabilidade penal (justiça juvenil) | 10 | ⚠️ Não verificado na fonte primária: a maioria dos estados não fixa idade mínima para a justiça juvenil; onde há, vai de 10 a 12 anos. Pendente: lei de cada estado; o jogo usa 10 ([link](https://ojjdp.ojp.gov/model-programs-guide/literature-reviews/age-boundaries-of-the-juvenile-justice-system), 2026-10-10) | needs_primary_check |
| [ ] | Sistema escolar | mês 9 a 6; elementary 5+ (6 anos); middle 11+ (3 anos); high 14+ (4 anos) | ⚠️ Não verificado na fonte primária: ano letivo em geral de agosto/setembro a maio/junho, definido por estado e distrito; o jogo usa setembro a junho. Pendente: calendário de cada estado e distrito ([link](https://nces.ed.gov/programs/statereform/), 2026-10-10) | needs_primary_check |
| [ ] | Casal do mesmo sexo | legal: permitted; aceitação: 63; risco: — | Legal: Obergefell v. Hodges, 26/06/2015: "same-sex couples may exercise the fundamental right to marry in all States". Aceitação: Pew Research Center 2023, 63% (https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/) ([link](https://www.law.cornell.edu/supremecourt/text/14-556), 2026-10-10) | ai_checked |

## Japão

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Código Civil (民法), art. 4: 年齢十八歳をもって、成年とする ([link](https://laws.e-gov.go.jp/law/129AC0000000089), 2026-10-10) | ai_checked |
| [ ] | Idade para beber | 20 | Lei de proibição do consumo de álcool por menores de 20 anos (二十歳未満ノ者ノ飲酒ノ禁止ニ関スル法律, Taishō 11, lei nº 20), art. 1 ([link](https://laws.e-gov.go.jp/law/211AC1000000020), 2026-10-10) | ai_checked |
| [ ] | Idade para fumar | 20 | Lei de proibição do fumo por menores de 20 anos (二十歳未満ノ者ノ喫煙ノ禁止ニ関スル法律, Meiji 33, lei nº 33), art. 1 ([link](https://laws.e-gov.go.jp/law/133AC1000000033), 2026-10-10) | ai_checked |
| [ ] | Idade para dirigir | 18 | Lei de Trânsito Rodoviário (道路交通法), art. 88(1)(i): licença comum (普通免許) só a partir dos 18 ([link](https://www.japaneselawtranslation.go.jp/en/laws/view/2962), 2026-10-10) | ai_checked |
| [ ] | Responsabilidade penal (justiça juvenil) | 14 | Código Penal (刑法), art. 41: "An act of a person less than 14 years of age is not punishable" ([link](https://www.japaneselawtranslation.go.jp/en/laws/view/3581), 2026-10-10) | ai_checked |
| [ ] | Sistema escolar | mês 4 a 3; elementary 6+ (6 anos); middle 12+ (3 anos); high 15+ (3 anos, exame) | Regulamento da Lei de Educação Escolar (学校教育法施行規則), art. 59 (ano letivo de 1º de abril a 31 de março) e art. 90 (entrada no ensino médio por seleção com exame) ([link](https://laws.e-gov.go.jp/law/322M40000080011), 2026-10-10) | ai_checked |
| [ ] | Casal do mesmo sexo | legal: not_recognized; aceitação: 68; risco: — | ⚠️ Não verificado na fonte primária: Legal: não reconhecida nacionalmente; em 25/03/2026 a Suprema Corte enviou seis ações ao pleno (Grand Bench), com decisão esperada para o início de 2027. Aceitação: Pew Research Center 2023, 68% (https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/). Pendente: decisão do pleno da Suprema Corte (conferir em courts.go.jp quando sair) ([link](https://www.japantimes.co.jp/news/2026/03/26/japan/crime-legal/court-same-sex-marriage/), 2026-10-10) | needs_primary_check |

## Rússia

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Código Civil, art. 21: capacidade civil plena ao atingir 18 anos (texto consolidado no ConsultantPlus; pravo.gov.ru inacessível na conferência) ([link](https://www.consultant.ru/document/cons_doc_LAW_5142/9e6e097ccc381775641f6a57435aa14a854c504c/), 2026-10-10) | ai_checked |
| [ ] | Idade para beber | 18 | Lei Federal 171-FZ, art. 16, item 2, subitem 11: vedada a venda a varejo de bebida alcoólica a menores (ConsultantPlus) ([link](https://www.consultant.ru/document/cons_doc_LAW_8368/d3618b9062472ca3182811e431fa7d71b532e447/), 2026-10-10) | ai_checked |
| [ ] | Idade para fumar | 18 | Lei Federal 15-FZ, art. 20: proibição da venda de tabaco e de produtos com nicotina a menores (ConsultantPlus) ([link](https://www.consultant.ru/document/cons_doc_LAW_142515/382b0b5ae542851db6ce836ce3bac60c5d44ef4b/), 2026-10-10) | ai_checked |
| [ ] | Idade para dirigir | 18 | Lei Federal 196-FZ 'Sobre a segurança viária', art. 26: categoria B a partir dos 18 (ConsultantPlus) ([link](https://www.consultant.ru/document/cons_doc_LAW_8585/70ea47b006c38d44a2a9f4dafac36c108e41f0bd/), 2026-10-10) | ai_checked |
| [ ] | Responsabilidade penal (justiça juvenil) | 14 | Código Penal, art. 20: 16 anos em geral; parte 2, 14 anos para a lista que inclui furto (кража, art. 158). O jogo usa 14 porque seus delitos são furtos (ConsultantPlus) ([link](https://www.consultant.ru/document/cons_doc_LAW_10699/fd969cc22a68d513db2c83a94d6ad355a95dbec7/), 2026-10-10) | ai_checked |
| [ ] | Sistema escolar | mês 9 a 5; elementary 7+ (4 anos); middle 11+ (5 anos); high 16+ (2 anos) | ⚠️ Não verificado na fonte primária: Lei 273-FZ, art. 67: entrada na escola entre 6 anos e meio e 8 anos (conferido; o jogo usa 7). Início em setembro e fim em maio vêm de regulamento do Ministério da Educação, não conferido. Pendente: regulamento do calendário escolar ([link](https://www.consultant.ru/document/cons_doc_LAW_140174/16e2e6dcd017a68bc8b1a445142f9c86a69f3ffa/), 2026-10-10) | needs_primary_check |
| [ ] | Casal do mesmo sexo | legal: restricted; aceitação: 14; risco: — | ⚠️ Não verificado na fonte primária: Legal: casamento só entre homem e mulher na Constituição (emenda de 2020); lei de 'propaganda' estendida a adultos em 2022; 'movimento LGBT internacional' declarado extremista em 2023. Aceitação: Pew Research Center 2019, Q31 'a homossexualidade deve ser aceita pela sociedade', Rússia 14% (74% não, 12% não sabem), relatório de 2020, p. 25 (https://www.pewresearch.org/wp-content/uploads/sites/20/2020/06/PG_2020.06.25_Global-Views-Homosexuality_FINAL.pdf); outra pergunta e outro ano, porque a Rússia não entrou na pesquisa de 2023. Pendente: status legal: Constituição e decisões da Suprema Corte russa não abertas na conferência (pravo.gov.ru inacessível) ([link](https://www.pewresearch.org/wp-content/uploads/sites/20/2020/06/PG_2020.06.25_Global-Views-Homosexuality_FINAL.pdf), 2026-10-10) | needs_primary_check |

## Reino Unido (Inglaterra)

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Family Law Reform Act 1969, s. 1(1): "a person shall attain full age on attaining the age of eighteen" ([link](https://www.legislation.gov.uk/ukpga/1969/46/section/1), 2026-10-10) | ai_checked |
| [ ] | Idade para beber | 18 | Licensing Act 2003, s. 149 (compra de álcool por menores de 18 é crime) e s. 150(4) (exceção: 16 ou 17 anos, cerveja, vinho ou sidra numa refeição acompanhada de um adulto). O jogo usa a idade de compra ([link](https://www.legislation.gov.uk/ukpga/2003/17/section/150), 2026-10-10) | ai_checked |
| [ ] | Idade para fumar | 18 | ⚠️ Não verificado na fonte primária: SI 2007/767 elevou a idade de venda de tabaco de 16 para 18. O Tobacco and Vapes Act 2026 (sanção em 29/04/2026, gov.uk) proíbe vender tabaco a quem nasceu a partir de 1º/01/2009; as vidas do jogo nascem em 2000, então 18 continua valendo para elas. Pendente: data de entrada em vigor da proibição geracional (fontes secundárias citam 1º/01/2027) ([link](https://www.gov.uk/government/news/tobacco-and-vapes-bill-becomes-law), 2026-10-10) | needs_primary_check |
| [ ] | Idade para dirigir | 17 | gov.uk: "Most people can start learning to drive when they're 17" (carro, categoria B) ([link](https://www.gov.uk/vehicles-can-drive), 2026-10-10) | ai_checked |
| [ ] | Responsabilidade penal (justiça juvenil) | 10 | Children and Young Persons Act 1933, s. 50: "no child under the age of ten years can be guilty of any offence" ([link](https://www.legislation.gov.uk/ukpga/Geo5/23-24/12/section/50), 2026-10-10) | ai_checked |
| [ ] | Sistema escolar | mês 9 a 7; elementary 4+ (7 anos); middle 11+ (5 anos); high 16+ (2 anos) | ⚠️ Não verificado na fonte primária: Inglaterra: reception aos 4, secundário aos 11, estudo ou formação até os 18; ano letivo de setembro a julho, mas as datas são definidas por cada conselho local (gov.uk). Pendente: calendário de cada conselho local ([link](https://www.gov.uk/school-term-holiday-dates), 2026-10-10) | needs_primary_check |
| [ ] | Casal do mesmo sexo | legal: permitted; aceitação: 74; risco: — | Legal: Marriage (Same Sex Couples) Act 2013, s. 1(1): "Marriage of same sex couples is lawful". Aceitação: Pew Research Center 2023, 74% (https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/) ([link](https://www.legislation.gov.uk/ukpga/2013/30/section/1), 2026-10-10) | ai_checked |
