# SyncLife — Atividades (referência de design)

Atualizado em 2026-10-10. Este arquivo complementa o `docs/design.md`. Os nomes aqui estão em português para leitura; no código, ids em inglês e textos em `locales/pt-BR`.

## 1. Estrutura da aba Atividades

```
Atividades
├── Cuidados com o corpo
├── Atividades físicas
│   ├── Basquete, Futebol, Natação, Corrida, Academia, CrossFit
│   ├── Artes marciais  →  submenu com 10 modalidades
│   └── Dança           →  submenu com 7 estilos
└── (bicos, pequenos crimes e o que já existe continuam como hoje)
```

Itens que não fazem sentido para o personagem não aparecem: por idade, por sexo (barbeiro e barbear só para homens; cabeleireira para mulheres, conforme pedido) ou por lei do país.

## 2. Cuidados com o corpo

Pedidos por você:

| Serviço | Para quem | Efeito principal |
| --- | --- | --- |
| Barbeiro | Homens | Muda o corte (avatar); pequeno ganho de aparência e felicidade |
| Cabeleireira | Mulheres | Muda corte e cor (avatar); pequeno ganho de aparência e felicidade |
| Barbear | Homens adultos | Muda a barba (avatar) |
| Manicure | Todos | Pequeno ganho de felicidade |
| Massagem | Todos | Reduz estresse, aumenta felicidade |
| Salão de bronzeamento | Conforme o país | Pequeno ganho de aparência; risco de evento de saúde se usar demais |
| Salão de depilação | Adolescentes e adultos | Pequeno ganho de aparência |

Sugestões para acrescentar:

| Serviço | Idade | Por que vale a pena |
| --- | --- | --- |
| Dentista | Todas | Consulta, clareamento (adultos) e **aparelho ortodôntico** (adolescentes), um marco clássico da adolescência com eventos próprios |
| Dermatologista | 10+ | Tratamento de acne na adolescência; melhora aparência e felicidade |
| Ótica | Todas | Óculos ou lentes; entra no avatar (acessório) |
| Designer de sobrancelha | 14+ | Pequeno ganho de aparência |
| Maquiagem | 12+ | Pequeno ganho de aparência; pais rígidos podem proibir |
| Tatuagem | Conforme o país | Muda o avatar; idade mínima e consentimento dos pais variam por país |
| Piercing | Conforme o país | Mesma lógica da tatuagem |
| Nutricionista | 12+ | Ajuda a saúde; dá bônus em atividades físicas |
| Cirurgia plástica | 18+ | Ganho de aparência com custo alto e risco de complicação |

Regras que vêm do país: idade mínima para tatuagem, piercing e bronzeamento artificial (no Brasil a Anvisa proíbe câmaras de bronzeamento desde 2009; na Inglaterra são proibidas para menores de 18). Confirmar na fonte primária antes de colocar nos JSONs.

## 3. Sistema de habilidade (vale para todas as atividades físicas)

Cada atividade tem uma barra de habilidade de 0 a 100%, como as barras de status.

**Limite de treinos:** no máximo **2 treinos por atividade a cada avanço de tempo**, igual ao limite de interações com pessoas. Assim não dá para "spamar" treinos. Consequência: quem avança de 6 em 6 meses treina 4 vezes por ano; quem avança de ano em ano, 2 vezes. Isso é intencional e premia quem acompanha a vida de perto.

**Ganho por treino:**

```
ganho = 5 × (1 − habilidade / 110) × aptidão física (0,8 a 1,2) × sorte (0,7 a 1,3)
mínimo de 1 ponto por treino
```

O ganho diminui conforme a pessoa melhora. Simulação com 4 treinos por ano:

| Aptidão | 25% | 50% | 75% | 90% |
| --- | --- | --- | --- | --- |
| Baixa (0,8) | 1,9 ano | 4,2 anos | 7,9 anos | 11,3 anos |
| Média (1,0) | 1,5 ano | 3,4 anos | 6,3 anos | 9,2 anos |
| Alta (1,2) | 1,3 ano | 2,8 anos | 5,2 anos | 7,7 anos |

Para artes coletivas de aptidão social (dança em grupo) ou cognitiva (xadrez, no futuro), troca-se a aptidão usada na fórmula.

**Perda por inatividade:** depois de 1 ano sem treinar, a habilidade cai 1 ponto a cada 6 meses, até um piso de metade do máximo já atingido.

**Diário:** todo treino gera uma linha, por exemplo: "Treino de jiu-jitsu: você aprendeu a raspagem de tesoura. Habilidade +5%." Treinos sem golpe novo: "Você treinou passagem de guarda. Habilidade +4%."

**Golpes e movimentos:** a cada 2 treinos, a pessoa aprende o próximo golpe da lista da modalidade (seção 6), na ordem. Depois de aprender todos, os treinos seguem dando habilidade.

**Graduação (faixa, corda, prajied, nível):** a promoção não é automática. Ela exige, ao mesmo tempo:

1. habilidade mínima para a próxima graduação;
2. tempo mínimo na graduação atual (por exemplo, 1 ano);
3. idade mínima, quando a federação define (exemplo: jiu-jitsu adulto, seção 5);
4. passar no **exame**, um evento com chance baseada na habilidade, que pode reprovar.

Isso transforma a troca de faixa num momento importante no diário, e impede virar faixa preta em poucos anos.

**Efeitos nos status:** treinar dá pequeno ganho de saúde e felicidade e reduz estresse. Academia e CrossFit dão também aparência. Lutas têm pequena chance de lesão (saúde cai e o personagem fica alguns meses sem treinar).

## 4. Quem paga e quem autoriza

| Idade | Regra |
| --- | --- |
| Até 11 anos | Precisa de **autorização dos pais**; os pais pagam a mensalidade. A chance de aceitarem depende do dinheiro da família, da afinidade e dos traços (generoso, rígido) |
| 12 a 17 anos | Precisa de autorização; pode pagar com o próprio dinheiro (mesada, bicos) ou pedir que os pais paguem |
| 18+ | Decide sozinho; paga com o próprio dinheiro ou usa **"Pedir para os pais pagarem"** |

**"Pedir para os pais pagarem"** vira uma interação geral com os pais, que serve para qualquer coisa que tenha preço no jogo: mensalidade de atividade, faculdade, carteira de motorista, bicicleta, celular, carro, casa. A chance depende de: preço do item em relação ao dinheiro da família, afinidade dos pais com o jogador, traços dos pais, estresse deles e se o jogador pediu algo recentemente (pedir demais irrita). Recusa pode baixar a afinidade; aceitar pode gerar um evento ("Seu pai pagou a sua faculdade, mas disse que espera notas boas").

Idades mínimas sugeridas para começar: academia de musculação 14+ (com supervisão), CrossFit 12+, Krav Maga 12+, boxe e muay thai 7+, demais artes marciais e danças 4+ a 6+, natação a partir de bebê (adaptação ao meio líquido com os pais).

## 5. Graduações por modalidade

Atenção: graduações variam por federação e por escola. Abaixo está o sistema mais comum ou o de uma federação de referência, indicado em cada caso. Itens marcados com ⚠️ variam bastante e vale conferir antes de fechar os dados.

### Jiu-Jitsu (IBJJF)

- **Infantil (4 a 15 anos):** branca, cinza (cinza-branca, cinza, cinza-preta), amarela (amarela-branca, amarela, amarela-preta), laranja (laranja-branca, laranja, laranja-preta), verde (verde-branca, verde, verde-preta).
- **Adulto (16+):** branca, azul (16+), roxa (16+), marrom (18+), preta (19+). Depois, coral vermelha e preta, coral vermelha e branca e vermelha (décadas de faixa preta).
- **Graus:** até 4 listras (graus) em cada faixa antes da próxima. Ótimo para o jogo: cada grau é uma pequena conquista.

### Judô (sistema mais usado no Brasil) ⚠️

Branca, cinza, azul, amarela, laranja, verde, roxa, marrom, preta (1º a 5º dan), depois coral e vermelha. No Japão (Kodokan) o sistema para adultos é bem mais simples (branca, marrom, preta).

### Karatê ⚠️

Varia muito por estilo. Sequência comum no Shotokan no Brasil: branca, amarela, vermelha, laranja, verde, roxa, marrom, preta (dans).

### Taekwondo (padrão World Taekwondo, simplificado) ⚠️

Branca, amarela, verde, azul, vermelha, preta. Muitas escolas usam faixas intermediárias com ponteira. Menores de 15 anos recebem a faixa "poom" (vermelha e preta) em vez de dan.

### Muay Thai (Confederação Brasileira de Muay Thai)

Usa o **prajied**, uma corda no braço, em vez de faixa. Ordem: branco; branco e vermelho; vermelho; vermelho e azul-claro; azul-claro; azul-claro e azul-escuro; azul-escuro; azul-escuro e preto; preto; preto e branco; preto, branco e vermelho. Do preto em diante, é professor ou mestre. Na Tailândia tradicional não há graduação; o nível vem das lutas.

### Capoeira (Confederação Nacional de Capoeira do Brasil)

Cordas: crua (sem cor), verde, amarela, azul, verde e amarela, verde e azul, amarela e azul (estagiário), verde, amarela e azul (formado), branca e verde (monitor), branca e amarela (instrutor), branca e azul (contramestre), branca (mestre). Antes da primeira corda há o **batizado**, um evento clássico. Muitos grupos usam sistemas próprios.

### Krav Maga (Federação Sul-Americana de Krav Maga)

Branca, amarela, laranja, verde, azul, marrom, preta (dans) e vermelha e branca (honra). As faixas marcam conteúdo: armas brancas a partir da verde, defesa contra arma de fogo a partir da azul.

### Wing Chun Kung Fu

Sem faixa na maioria das escolas. Os níveis seguem as formas aprendidas: Siu Nim Tao, Chum Kiu, Biu Jee, Mook Jong (boneco de madeira), Luk Dim Bun Kwan (bastão) e Baat Jaam Dao (facas), esta última no nível de mestre.

### Systema (Sistema Russo)

Tradicionalmente não tem graduação. No jogo: iniciante, praticante, avançado, instrutor.

### Boxe

Não tem faixa. No jogo: iniciante, amador (com cartel de vitórias e derrotas), amador de elite, profissional, campeão.

### Danças

- **Balé clássico:** pré-balé, básico, intermediário, avançado; na carreira, corpo de baile, solista, primeira bailarina ou primeiro bailarino.
- **Demais estilos:** iniciante, básico, intermediário, avançado, profissional.

### Esportes

- **Futebol e basquete:** escolinha, time da escola, base de clube (sub-15, sub-17, sub-20), profissional. A entrada na base é pela **peneira**, um evento com teste.
- **Natação:** adaptação ao meio líquido, os 4 estilos (abaixo), equipe da escola, atleta federado.
- **Corrida:** iniciante, corredor de rua, corredor de prova, atleta.
- **Academia e CrossFit:** iniciante, intermediário, avançado.

## 6. Golpes e movimentos (aprendidos na ordem, 1 a cada 2 treinos)

| Modalidade | Lista |
| --- | --- |
| Jiu-Jitsu | Guarda fechada, fuga de quadril, raspagem de tesoura, passagem de guarda, montada, armlock, triângulo, mata-leão |
| Judô | Ukemi (amortecimento de queda), O-goshi, O-soto-gari, Ippon-seoi-nage, Kesa-gatame (imobilização) |
| Karatê | Oi-zuki, Gyaku-zuki, Mae-geri, Mawashi-geri, kata Heian Shodan |
| Taekwondo | Ap chagi (frontal), Dollyo chagi (circular), Yeop chagi (lateral), Dwi chagi (de costas), poomsae Taegeuk Il Jang |
| Muay Thai | Jab e direto, chute circular, teep (chute frontal), joelhada, cotovelada, clinch |
| Boxe | Jab, direto, cruzado, uppercut, esquiva em pêndulo |
| Capoeira | Ginga, meia-lua de frente, armada, aú, rasteira, queixada |
| Krav Maga | Soco direto, chute frontal, defesa 360°, liberação de agarrão no pescoço, defesa contra soco |
| Wing Chun | Forma Siu Nim Tao, soco em cadeia, Pak Sao, Bong Sao, Chi Sao (mãos pegajosas) |
| Systema | Respiração de combate, quedas e rolamentos, golpe relaxado, fuga de agarrões |
| Balé | Plié, tendu, arabesque, pirouette, grand jeté |
| Breakdance | Toprock, 6-step, freeze, windmill, headspin |
| Dança contemporânea | Contração e release, trabalho de chão, improvisação, giro em espiral |
| Funk | Passinho, jogo de pernas, coreografia em grupo, freestyle |
| Forró | Passo básico, abertura lateral, giro simples, giro da dama, caminhada |
| Jazz | Jazz walk, chassé, pas de bourrée, kick ball change, jazz square |
| Sapateado | Shuffle, flap, ball change, cramp roll, time step |
| Natação | Crawl, costas, peito, borboleta, virada olímpica |
| Corrida | Correr 5 km, 10 km, meia maratona (21 km), maratona (42 km, em geral 18+) |
| Academia | Agachamento, supino, levantamento terra, remada, desenvolvimento |
| CrossFit | Burpee, kettlebell swing, double under, muscle-up, snatch |
| Futebol | Passe, drible, chute a gol, cabeceio, cobrança de falta |
| Basquete | Drible, arremesso, bandeja, passe, enterrada |

Para personagens menores de idade, os movimentos de dança precisam ser adequados à idade (nada sensualizado), seguindo as regras de conteúdo do design.

## 7. Competições

Competições aparecem como **eventos com convite ou inscrição**, de acordo com o nível:

| Nível | Requisito | Recompensa |
| --- | --- | --- |
| Escolar ou local | Qualquer nível | Medalha, felicidade |
| Regional | Habilidade 30%+ ou graduação equivalente | Medalha, troféu, felicidade, popularidade |
| Estadual | 50%+ | Troféu, prestígio, pequena premiação |
| Nacional | 70%+ | Premiação em dinheiro, convite para equipe |
| Internacional | 85%+ | Premiação maior, fama |

- **Categorias:** crianças competem por idade e graduação; adultos por graduação e peso (lutas).
- **Resultado:** desempenho = habilidade + aptidão + sorte − nível dos adversários. Gera colocação (ouro, prata, bronze ou eliminado) e linha no diário.
- **Lutas:** risco de lesão maior em competição do que em treino.
- **Estante de conquistas:** medalhas e troféus ficam guardados no perfil, como lembrança da vida.
- **Exceções reais:** Krav Maga e Systema não têm competições esportivas, porque são sistemas de defesa pessoal. No lugar, entram exames, seminários e eventos de demonstração. Wing Chun tem poucos torneios (de Chi Sao). Breaking tem campeonatos e foi modalidade olímpica em Paris 2024.
- **Esportes coletivos:** em vez de inscrição individual, o jogador entra no time (peneira) e o time disputa campeonatos; o desempenho dele pesa no resultado.
- **Corrida:** provas de rua por distância; a maratona normalmente exige 18 anos.

## 8. Formato de dados sugerido

```json
{
  "id": "bjj",
  "category": "martial_arts",
  "conditions": { "minAge": 4 },
  "aptitude": "physical",
  "cost": "small",
  "needsParentPermissionUnder": 18,
  "ranks": {
    "kids": ["white", "gray_white", "gray", "gray_black", "yellow_white", "yellow", "yellow_black", "orange_white", "orange", "orange_black", "green_white", "green", "green_black"],
    "adult": [
      { "id": "white" },
      { "id": "blue", "minAge": 16, "minSkill": 20, "minMonths": 24 },
      { "id": "purple", "minAge": 16, "minSkill": 40, "minMonths": 24 },
      { "id": "brown", "minAge": 18, "minSkill": 60, "minMonths": 18 },
      { "id": "black", "minAge": 19, "minSkill": 80, "minMonths": 12 }
    ],
    "stripes": 4
  },
  "techniques": ["closed_guard", "hip_escape", "scissor_sweep", "guard_pass", "mount", "armbar", "triangle", "rear_naked_choke"],
  "competitions": true,
  "injuryRisk": 0.03
}
```

Textos ("Faixa roxa", "Raspagem de tesoura") ficam em `locales/pt-BR/activities.json`.
