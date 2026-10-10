# Fontes dos países — SyncLife

Pesquisado em 2026-10-10. Antes de marcar um item como verificado, confira na fonte primária indicada e preencha `source` e `verifiedAt` no JSON do país. Itens marcados com ⚠️ têm detalhe que muda com frequência ou varia por região.

## Idades legais

| País | Maioridade | Comprar álcool | Comprar tabaco | Dirigir carro | Fonte primária para conferir |
| --- | --- | --- | --- | --- | --- |
| Brasil | 18 | 18 | 18 | 18 | planalto.gov.br (Código Civil art. 5º; ECA art. 81 e 243; CTB art. 140) |
| Estados Unidos | 18 ⚠️ (19 no Alabama e Nebraska, 21 no Mississippi) | 21 (lei federal de 1984) | 21 (lei federal desde dez/2019) | ⚠️ varia por estado, em geral 16 com restrições | congress.gov; FDA (tabaco); DMV de cada estado |
| Japão | 18 (desde abril de 2022) | 20 | 20 | 18 | e-Gov Japan (Código Civil; leis de menores sobre álcool e tabaco); Ministério da Justiça |
| Rússia | 18 | 18 | 18 | 18 | pravo.gov.ru / consultant.ru (Código Civil; lei de trânsito) |
| Reino Unido (Inglaterra) | 18 | 18 ⚠️ (16–17 podem beber cerveja, vinho ou sidra numa refeição com um adulto) | 18 ⚠️ (verificar a lei de proibição geracional do tabaco para nascidos a partir de 2009) | 17 | gov.uk; legislation.gov.uk |

## Escola, serviço militar e justiça juvenil

| País | Ano letivo | Serviço militar | Responsabilidade penal juvenil | Fonte primária para conferir |
| --- | --- | --- | --- | --- |
| Brasil | fevereiro a dezembro | Alistamento obrigatório para homens aos 18 | Menores de 18 são inimputáveis; de 12 a 17 anos, medidas socioeducativas (ECA) | planalto.gov.br (ECA; Lei do Serviço Militar) |
| Estados Unidos | ⚠️ em geral agosto/setembro a maio/junho | Não obrigatório (homens se registram no Selective Service aos 18) | ⚠️ varia por estado | sss.gov; legislação estadual |
| Japão | abril a março | Não existe | Responsabilidade a partir de 14; casos de menores vão à Vara de Família | e-Gov Japan (Lei de Menores) |
| Rússia | setembro a maio | Obrigatório para homens de 18 a 30 anos ⚠️ (limite subiu de 27 para 30 em 2024) | Em geral a partir de 16; 14 para crimes graves | pravo.gov.ru (Código Penal art. 20; lei do serviço militar) |
| Reino Unido (Inglaterra) | setembro a julho | Não existe | Responsabilidade a partir de 10 | gov.uk; legislation.gov.uk |

## União entre pessoas do mesmo sexo

| País | Status legal | Valor sugerido para `legal` | Fonte primária para conferir |
| --- | --- | --- | --- |
| Brasil | Casamento permitido desde 2013 (Resolução 175 do CNJ, após decisão do STF de 2011) | `permitted` | cnj.jus.br; stf.jus.br |
| Estados Unidos | Casamento permitido em todo o país desde 2015 (Obergefell v. Hodges) | `permitted` | supremecourt.gov |
| Japão | Não reconhecida nacionalmente; muitas prefeituras e cidades emitem certificados de parceria sem efeito de casamento. ⚠️ Suprema Corte deve decidir a constitucionalidade em 2027 | `not_recognized` | courts.go.jp; acompanhar a decisão |
| Rússia | Casamento proibido pela Constituição (2020). Lei de "propaganda" estendida a adultos em 2022; "movimento LGBT internacional" declarado extremista em 2023 | `restricted` (com risco alto) | pravo.gov.ru; Suprema Corte da Rússia |
| Reino Unido (Inglaterra) | Casamento permitido desde 2014 (Marriage (Same Sex Couples) Act 2013) | `permitted` | legislation.gov.uk |

## Aceitação social (campo `acceptance`, 0–100)

Fonte: Pew Research Center. Proposta: usar a porcentagem diretamente como valor de `acceptance`.

| País | Valor | Pergunta e ano |
| --- | --- | --- |
| Brasil | 52 | Apoio ao casamento entre pessoas do mesmo sexo, 2023 |
| Estados Unidos | 63 | Apoio ao casamento entre pessoas do mesmo sexo, 2023 |
| Japão | 68 | Apoio ao casamento entre pessoas do mesmo sexo, 2023 |
| Rússia | 14 | "A homossexualidade deve ser aceita pela sociedade", 2019 (a Rússia não entrou na pesquisa de 2023) |
| Reino Unido | 74 | Apoio ao casamento entre pessoas do mesmo sexo, 2023 |

Links:
- https://www.pewresearch.org/short-reads/2023/11/27/how-people-around-the-world-view-same-sex-marriage/
- https://www.pewresearch.org/global/2020/06/25/global-divide-on-homosexuality/

O valor da Rússia vem de outra pergunta e de outro ano; anote isso no campo `source`.
