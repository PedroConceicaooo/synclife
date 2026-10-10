# Revisão das leis por país

Gerado por `node scripts/legal-review.js` a partir de `data/countries/`. Não edite à mão: corrija os dados e gere de novo.

Cada valor foi rascunhado por IA (`reviewStatus: "ai_draft"`) e precisa ser conferido numa fonte primária. Ao conferir, preencha `verifiedAt` (data) e troque `reviewStatus` para `"verified"` em `legalSources` do país; se o valor estiver errado, corrija o campo e a fonte.

Ainda sem dados: `topics.same_sex_relationship` (legalidade, aceitação social de 0 a 100 e risco). Até ser pesquisado, o jogo usa aceitação neutra (50).

## Brasil

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Código Civil (Lei 10.406/2002), art. 5º | ai_draft |
| [ ] | Idade para beber | 18 | ECA (Lei 8.069/1990), art. 81, II, e art. 243 (redação da Lei 13.106/2015) | ai_draft |
| [ ] | Idade para fumar | 18 | ECA (Lei 8.069/1990), art. 81, III | ai_draft |
| [ ] | Idade para dirigir | 18 | Código de Trânsito Brasileiro (Lei 9.503/1997), art. 140, I | ai_draft |
| [ ] | Responsabilidade penal (justiça juvenil) | 12 | ECA (Lei 8.069/1990), arts. 2º, 103-105 e 112: de 12 a 18 anos, ato infracional com medidas socioeducativas; abaixo de 12, medidas de proteção | ai_draft |
| [ ] | Sistema escolar | início no mês 2; elementary 6+ (5 anos); middle 11+ (4 anos); high 15+ (3 anos) | LDB (Lei 9.394/1996) e Lei 11.274/2006 (ensino fundamental de 9 anos, a partir dos 6) | ai_draft |

## Estados Unidos

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Leis estaduais; 18 na maioria dos estados (19 no Alabama e Nebraska, 21 no Mississippi) | ai_draft |
| [ ] | Idade para beber | 21 | National Minimum Drinking Age Act de 1984 (23 U.S.C. § 158) | ai_draft |
| [ ] | Idade para fumar | 21 | Lei federal 'Tobacco 21' (Further Consolidated Appropriations Act, 2020) | ai_draft |
| [ ] | Idade para dirigir | 16 | Leis estaduais de habilitação graduada; 16 é a idade mais comum para a licença provisória | ai_draft |
| [ ] | Responsabilidade penal (justiça juvenil) | 10 | Leis estaduais; muitos estados não têm idade mínima e outros usam entre 10 e 13 anos para a justiça juvenil | ai_draft |
| [ ] | Sistema escolar | início no mês 9; elementary 5+ (6 anos); middle 11+ (3 anos); high 14+ (4 anos) | Varia por estado e distrito; estrutura comum K-5, 6-8 e 9-12 com início em agosto ou setembro | ai_draft |

## Japão

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Código Civil, art. 4 (maioridade aos 18 desde 1º de abril de 2022) | ai_draft |
| [ ] | Idade para beber | 20 | Lei de proibição do consumo de álcool por menores de 20 anos (二十歳未満ノ者ノ飲酒ノ禁止ニ関スル法律) | ai_draft |
| [ ] | Idade para fumar | 20 | Lei de proibição do fumo por menores de 20 anos (二十歳未満ノ者ノ喫煙ノ禁止ニ関スル法律) | ai_draft |
| [ ] | Idade para dirigir | 18 | Lei de Trânsito Rodoviário (道路交通法), art. 88: carteira comum aos 18 | ai_draft |
| [ ] | Responsabilidade penal (justiça juvenil) | 14 | Código Penal, art. 41 (14 anos); abaixo disso, a Lei de Menores encaminha ao conselho tutelar e à família | ai_draft |
| [ ] | Sistema escolar | início no mês 4; elementary 6+ (6 anos); middle 12+ (3 anos); high 15+ (3 anos, exame) | Lei de Educação Escolar (学校教育法): ano letivo em abril; ensino médio com exame de admissão | ai_draft |

## Rússia

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Código Civil da Federação Russa, art. 21 | ai_draft |
| [ ] | Idade para beber | 18 | Lei Federal 171-FZ, art. 16 (venda de álcool proibida a menores de 18) | ai_draft |
| [ ] | Idade para fumar | 18 | Lei Federal 15-FZ, art. 20 (venda de tabaco proibida a menores de 18) | ai_draft |
| [ ] | Idade para dirigir | 18 | Lei Federal 196-FZ 'Sobre a segurança viária', art. 26 (categoria B aos 18) | ai_draft |
| [ ] | Responsabilidade penal (justiça juvenil) | 14 | Código Penal da Federação Russa, art. 20: 16 anos em geral, 14 para crimes listados, entre eles o furto | ai_draft |
| [ ] | Sistema escolar | início no mês 9; elementary 7+ (4 anos); middle 11+ (5 anos); high 16+ (2 anos) | Lei Federal 273-FZ 'Sobre a educação': ano letivo em 1º de setembro, níveis de 4, 5 e 2 anos | ai_draft |

## Reino Unido (Inglaterra)

| Conferido | Item | Valor no jogo | Fonte citada | Situação |
| --- | --- | --- | --- | --- |
| [ ] | Maioridade | 18 | Family Law Reform Act 1969, s. 1 | ai_draft |
| [ ] | Idade para beber | 18 | Licensing Act 2003, s. 146-149 (compra de álcool a partir dos 18) | ai_draft |
| [ ] | Idade para fumar | 18 | Children and Young Persons (Protection from Tobacco) Act 1991, alterado em 2007 para 18 | ai_draft |
| [ ] | Idade para dirigir | 17 | Road Traffic Act 1988, s. 101 (carro a partir dos 17) | ai_draft |
| [ ] | Responsabilidade penal (justiça juvenil) | 10 | Children and Young Persons Act 1933, s. 50 (Inglaterra e País de Gales: 10 anos) | ai_draft |
| [ ] | Sistema escolar | início no mês 9; elementary 4+ (7 anos); middle 11+ (5 anos); high 16+ (2 anos) | Education Act 1996 e Education and Skills Act 2008 (Inglaterra: reception aos 4, secundário aos 11, estudo ou formação até os 18) | ai_draft |
