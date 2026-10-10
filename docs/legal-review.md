# Revisão das leis por país

Gerado por `node scripts/legal-review.js` a partir de `data/countries/`. Não edite à mão: corrija os dados e gere de novo.

Situação de cada item: `researched` (pesquisado, com fonte primária indicada, falta conferir), `needs_primary_check` (⚠️ detalhe que muda ou varia por região; conferir com atenção) ou `verified`. Ao conferir, preencha `verifiedAt` (data) e troque `reviewStatus` para `"verified"` no JSON do país; se o valor estiver errado, corrija o campo e a fonte. Pesquisa de base: `docs/fontes-paises.md`.

`risk` dos temas sensíveis continua sem valor: nenhuma mecânica usa ainda e as fontes não dão um número.

## Brasil

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | planalto.gov.br: Código Civil (Lei 10.406/2002), art. 5º (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para beber | 18 | planalto.gov.br: ECA (Lei 8.069/1990), arts. 81 e 243 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para fumar | 18 | planalto.gov.br: ECA (Lei 8.069/1990), art. 81 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para dirigir | 18 | planalto.gov.br: Código de Trânsito Brasileiro (Lei 9.503/1997), art. 140 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Responsabilidade penal (justiça juvenil) | 12 | planalto.gov.br: ECA (Lei 8.069/1990); menores de 18 são inimputáveis e de 12 a 17 anos recebem medidas socioeducativas (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Sistema escolar | mês 2 a 12; elementary 6+ (5 anos); middle 11+ (4 anos); high 15+ (3 anos) | planalto.gov.br: LDB (Lei 9.394/1996) e Lei 11.274/2006; ano letivo de fevereiro a dezembro (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Casal do mesmo sexo | legal: permitted; aceitação: 52; risco: — | Legal: casamento permitido desde 2013 (Resolução 175 do CNJ, após decisão do STF de 2011), cnj.jus.br e stf.jus.br. Aceitação: Pew Research Center 2023, apoio ao casamento entre pessoas do mesmo sexo: 52%, https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/ (pesquisado em 2026-10-10) | researched |

## Estados Unidos

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | ⚠️ Não verificado na fonte primária: 18 na maioria dos estados; 19 no Alabama e Nebraska, 21 no Mississippi (legislação estadual) (pesquisado em 2026-10-10) | needs_primary_check |
| [ ] | Idade para beber | 21 | congress.gov: National Minimum Drinking Age Act de 1984 (23 U.S.C. § 158) (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para fumar | 21 | FDA: lei federal Tobacco 21, em vigor desde dezembro de 2019 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para dirigir | 16 | ⚠️ Não verificado na fonte primária: varia por estado, em geral 16 com restrições (DMV de cada estado) (pesquisado em 2026-10-10) | needs_primary_check |
| [ ] | Responsabilidade penal (justiça juvenil) | 10 | ⚠️ Não verificado na fonte primária: varia por estado; 10 é uma simplificação do jogo (legislação estadual) (pesquisado em 2026-10-10) | needs_primary_check |
| [ ] | Sistema escolar | mês 9 a 6; elementary 5+ (6 anos); middle 11+ (3 anos); high 14+ (4 anos) | ⚠️ Não verificado na fonte primária: ano letivo em geral de agosto/setembro a maio/junho, varia por estado e distrito; o jogo usa setembro a junho (pesquisado em 2026-10-10) | needs_primary_check |
| [ ] | Casal do mesmo sexo | legal: permitted; aceitação: 63; risco: — | Legal: casamento permitido em todo o país desde 2015 (Obergefell v. Hodges), supremecourt.gov. Aceitação: Pew Research Center 2023, apoio ao casamento entre pessoas do mesmo sexo: 63%, https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/ (pesquisado em 2026-10-10) | researched |

## Japão

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | e-Gov Japan: Código Civil, maioridade aos 18 desde abril de 2022 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para beber | 20 | e-Gov Japan: lei de proibição do consumo de álcool por menores de 20 anos (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para fumar | 20 | e-Gov Japan: lei de proibição do fumo por menores de 20 anos (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para dirigir | 18 | e-Gov Japan: Lei de Trânsito Rodoviário, carteira comum aos 18 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Responsabilidade penal (justiça juvenil) | 14 | e-Gov Japan: responsabilidade a partir de 14; casos de menores vão à Vara de Família (Lei de Menores) (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Sistema escolar | mês 4 a 3; elementary 6+ (6 anos); middle 12+ (3 anos); high 15+ (3 anos, exame) | e-Gov Japan: Lei de Educação Escolar; ano letivo de abril a março, ensino médio com exame de admissão (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Casal do mesmo sexo | legal: not_recognized; aceitação: 68; risco: — | ⚠️ Não verificado na fonte primária: Legal: não reconhecida nacionalmente; muitas prefeituras e cidades emitem certificados de parceria sem efeito de casamento; a Suprema Corte deve decidir a constitucionalidade em 2027, courts.go.jp. Aceitação: Pew Research Center 2023, apoio ao casamento entre pessoas do mesmo sexo: 68%, https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/ (pesquisado em 2026-10-10) | needs_primary_check |

## Rússia

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | pravo.gov.ru: Código Civil da Federação Russa, art. 21 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para beber | 18 | pravo.gov.ru / consultant.ru: Lei Federal 171-FZ, venda de álcool proibida a menores de 18 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para fumar | 18 | pravo.gov.ru / consultant.ru: Lei Federal 15-FZ, venda de tabaco proibida a menores de 18 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para dirigir | 18 | pravo.gov.ru: lei de trânsito, categoria B aos 18 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Responsabilidade penal (justiça juvenil) | 14 | pravo.gov.ru: Código Penal, art. 20; em geral 16 anos, 14 para os crimes listados no próprio artigo, entre eles o furto (art. 158). O jogo usa 14 porque seus delitos são furtos (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Sistema escolar | mês 9 a 5; elementary 7+ (4 anos); middle 11+ (5 anos); high 16+ (2 anos) | pravo.gov.ru: Lei Federal 273-FZ 'Sobre a educação'; ano letivo de setembro a maio (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Casal do mesmo sexo | legal: restricted; aceitação: 14; risco: — | Legal: casamento proibido pela Constituição (2020); lei de 'propaganda' estendida a adultos em 2022; 'movimento LGBT internacional' declarado extremista em 2023; risco alto, pravo.gov.ru e Suprema Corte da Rússia. Aceitação: Pew Research Center 2019, 'a homossexualidade deve ser aceita pela sociedade': 14% (outra pergunta e outro ano; a Rússia não entrou na pesquisa de 2023), https://www.pewresearch.org/global/2020/06/25/global-divide-on-homosexuality/ (pesquisado em 2026-10-10) | researched |

## Reino Unido (Inglaterra)

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | legislation.gov.uk: Family Law Reform Act 1969, s. 1 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Idade para beber | 18 | ⚠️ Não verificado na fonte primária: gov.uk: compra de álcool aos 18; de 16 a 17 podem beber cerveja, vinho ou sidra numa refeição com um adulto (o jogo usa a idade de compra) (pesquisado em 2026-10-10) | needs_primary_check |
| [ ] | Idade para fumar | 18 | ⚠️ Não verificado na fonte primária: gov.uk / legislation.gov.uk: compra de tabaco aos 18; verificar a proibição geracional para nascidos a partir de 2009 (as vidas do jogo começam em 2000) (pesquisado em 2026-10-10) | needs_primary_check |
| [ ] | Idade para dirigir | 17 | gov.uk: carro a partir dos 17 (Road Traffic Act 1988) (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Responsabilidade penal (justiça juvenil) | 10 | legislation.gov.uk: Children and Young Persons Act 1933, s. 50; responsabilidade a partir de 10 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Sistema escolar | mês 9 a 7; elementary 4+ (7 anos); middle 11+ (5 anos); high 16+ (2 anos) | gov.uk: Inglaterra, ano letivo de setembro a julho; reception aos 4, secundário aos 11, estudo ou formação até os 18 (pesquisado em 2026-10-10; conferir na fonte primária) | researched |
| [ ] | Casal do mesmo sexo | legal: permitted; aceitação: 74; risco: — | Legal: casamento permitido desde 2014 (Marriage (Same Sex Couples) Act 2013), legislation.gov.uk. Aceitação: Pew Research Center 2023, apoio ao casamento entre pessoas do mesmo sexo: 74%, https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/ (pesquisado em 2026-10-10) | researched |
