# Mecânicas do Rugby NEA Manager

Referência de como as skills dos jogadores são afetadas e o que mais influencia
o resultado das partidas e a evolução do elenco. O mesmo conteúdo (resumido)
também está disponível dentro do jogo, no menu **Sobre o jogo**, nos dois
idiomas da UI (espanhol/português) — se uma mecânica mudar, atualize os dois
lugares: este arquivo e os blocos `ABOUT_HTML_PT`/`ABOUT_HTML_ES` em
`js/app.js` (função `renderAbout`).

## Atributos e posições

Cada jogador tem 22 skills (técnicas, mentais e físicas), de 0 a 99, definidas
em `SKILL_LABELS` (`js/data.js`). Cada posição tem um "perfil" de pesos — 0 a
1,3 por skill — em `SKILL_PROFILES` (`js/data.js`), que diz quais skills a
definem:

| Posição | Skills principais (peso ≥ 1,0) |
|---|---|
| Pilar (PI) | Scrum, Força, Tackle |
| Hooker (HK) | Lateral, Scrum, Tackle, Força |
| Segunda Línea (SL) | Salto, Força, Tackle, Resistência, Scrum |
| Ala (AL) | Jackal, Tackle, Resistência, Ruck, Força |
| Octavo (N8) | Resistência, Força, Tackle, Ruck |
| Medio Scrum (MS) | Passe, Comunicação, Visão, Resistência |
| Apertura (AP) | Chute, Drop Goal, Visão, Comunicação, Passe, Compostura, Posicionamento |
| Centro (CE) | Tackle, Drible, Passe, Velocidade |
| Wing (WG) | Velocidade, Drible, Agilidade |
| Fullback (FB) | Recepção, Chute, Velocidade, Visão |

O overall de um jogador numa posição é a média ponderada das 22 skills usando
o perfil daquela posição (`computeOverall`). Jogadores gerados
proceduralmente (`generateSquad`) e curados à mão (`mkPlayer`, em
`realSquads.js`) usam a mesma fórmula de base (`base * (0.55 + peso*0.45)`)
pra gerar as skills, então já nascem com as skills da posição mais
desenvolvidas que o resto — não é preciso ajustar manualmente.

Jogador escalado numa posição alternativa (`meta.altPos`, não a posição
natural) joga com um desconto de ~4% no overall efetivo
(`effectiveOverallAt`). **Primeira línea (pilar/hooker) é a única exceção
real**: nunca aceita improviso — só entra ali quem é especialista de verdade,
natural ou treinado (ver "Treino de nova posição" abaixo). Sem especialista
disponível, o clube convoca um juvenil de 18 anos de urgência
(`emergencyYouthPlayer`).

## Comissão técnica (staff)

Cada membro do staff (`STAFF` em `realSquads.js`) tem `role`/`name`/`note`
como sempre, e opcionalmente `skills` — 0 a 99, mesma escala dos jogadores,
schema em `STAFF_SKILL_LABELS`: `youthDevelopment` (trabalho com a base),
`backsCoaching`, `forwardsCoaching`, `kickingCoaching`, `sportsNutrition`
(nutrição esportiva), `communication`, `patience`, `didactics`. Nem todo
mundo no staff tem `skills` — a maioria continua só com texto
(`role`/`note`), igual antes.

Exemplos:
- **Figu Super** (Preparador Técnico do Curda) — `youthDevelopment: 88,
  backsCoaching: 85, kickingCoaching: 82, communication: 84, patience: 90,
  didactics: 87`, refletindo que lida muito bem com jovens/infantis, é ótimo
  treinador de backs e de chute, com boa comunicação, paciência e didática.
- **Cemilson** (Nutricionista do Curda) — `sportsNutrition: 91,
  communication: 78`, referência em nutrição esportiva com boa comunicação
  com o grupo.

`specialtyStaffBonus(teamId, specialtyKey)` escala `getStaffQuality(teamId)`
por 0,7x a 1,3x conforme a média de skill de quem no staff tem aquela
especialidade — sem ninguém cadastrado numa especialidade, cai pro
`getStaffQuality` geral do time (sem bônus nem malus extra). Efeitos reais:

- `trainingQualityFor` (app.js) escolhe, pra cada skill sendo treinada, o
  especialista certo: `kickingCoaching` pra `kicking`/`dropGoal`,
  `backsCoaching`/`forwardsCoaching` conforme o grupo do jogador (ou da
  posição-alvo, no treino de nova posição), senão `getStaffQuality` genérico.
  Usado no DIP, no treino de nova posição e no treino geral de foco livre.
- `generateYouthPlayer` (realSquads.js) soma um pequeno bônus ao nível bruto
  dos novos garotos de M14 gerados a cada ciclo da academia, proporcional à
  diferença entre `specialtyStaffBonus(..., 'youthDevelopment')` e o
  `getStaffQuality` genérico do time.
- `currentConditionOf` (app.js) acelera a recuperação semanal de condição
  física de todo o elenco, proporcional à diferença entre
  `specialtyStaffBonus(..., 'sportsNutrition')` e o `getStaffQuality`
  genérico do time (mesmo cálculo do bônus da base acima).
- `tickAttendanceExtras` (app.js) usa `specialtyStaffBonus(...,
  'communication')`, em vez do `getStaffQuality` genérico, como qualidade do
  churrasco semanal e do churrasco dos forwards — que já evoluíam a skill de
  comunicação dos jogadores que aparecem (ver `applyChurrascoEffect`).

## Treino semanal

Executado uma vez por rodada finalizada (`tickTraining`, chamado em
`finalizeRound`):

- **Foco de clube (seg/ter/qui)** — `state.trainingFocus`: um tipo de treino
  por dia (`TRAINING_TYPES` em `data.js`: Duelo, Tocata, Contato, Formação,
  Touch, Pique, Chute a gol, Quebra de linha, Liderança, Recuperação), cada
  um evoluindo um grupo de skills relacionadas em todo o elenco.
- **Treino individual (DIP)** — `state.dipTraining[playerId]`: um atributo
  por jogador, evolução garantida e mais rápida, à custa de mais desgaste
  físico. Rende conforme a assiduidade do jogador na categoria `individual`
  (0 a `MAX_INTENSIVE_DAYS_PER_WEEK` = 5 dias/semana, ver
  `trainingIntensityCap`).
- **Treino de nova posição** — `state.positionTraining[playerId]`:
  substitui o DIP normal (mesmo slot de treino intensivo); em vez de um
  atributo solto, foca só nas skills de peso ≥ 1,0 da posição alvo.
  `POSITION_TRAINING_ROUNDS_NEEDED = 10` semanas rendendo pra posições
  normais; `FRONT_ROW_TRAINING_ROUNDS_NEEDED = 13` semanas (~3 meses) pra
  pilar/hooker. Ao concluir, `grantAltPos` adiciona a posição como
  alternativa permanente (via `state.playerOverrides`, sem mutar o elenco
  estático).
- **Grupo de line-out** — `state.trainingGroups.lineout`: lançador, saltador
  e levantadores treinam juntos (`LINEOUT_GROUP_ROLE_SKILL`), cada papel
  evoluindo a skill certa e o grupo ganhando entrosamento mais rápido entre
  si (`bumpChemistry`).
- **Academia / vídeo / churrasco** — `tickAttendanceExtras`: academia evolui
  força/agilidade/resistência (`ACADEMIA_SKILL_POOL`), vídeo evolui
  visão/posicionamento (`VIDEO_SKILL_POOL`), churrasco evolui comunicação e
  entrosamento geral (churrasco dos forwards é só do pack, evento mais raro).

Cada jogador tem assiduidade própria (`meta.trainingAttendance`, escala 8-20)
em 6 categorias independentes (`ATTENDANCE_CATEGORIES`): churrasco, geral,
individual, grupo, academia, video.

## Condição física, fadiga e motivação

- Condição cai depois de cada partida (mais pra quem tem menos resistência,
  `declineAfterMatch`) e se recupera com o tempo até a próxima partida.
- Jogador desgastado e mal recuperado corre risco de lesão por fadiga
  (`rollFatigueInjury`) — fica fora do elenco disponível por semanas.
- **Motivação** (`tickMotivationDrift`, chamado em `finalizeRound` sempre
  que o time joga): jogador que passa `MOTIVATION_DRIFT_THRESHOLD_ROUNDS = 3`
  rodadas seguidas sem entrar em campo (`state.roundsSinceSelected`) reage
  conforme a média de disciplina + determinação — os limiares foram
  calibrados na distribuição real do elenco curado do Curda, não em números
  redondos:
  - Média < 45 (a maioria do elenco): perde 1 ponto de assiduidade em
    `geral` e `academia` por rodada, até o piso de 8.
  - Média ≥ 60 (uns poucos profissionais, ~8% do elenco do Curda): ganha 1
    ponto por rodada nas mesmas duas categorias, até o teto de 20.
  - Entre 45 e 60: neutro, sem reação.

## Entrosamento (chemistry)

`state.chemistry`, chave `"idA|idB"` (0-100). Cresce devagar entre qualquer
par que joga junto (`bumpChemistryForXV`, +1,5 por partida) e mais rápido com
treino de grupo dedicado. O entrosamento médio do quarteto de line-out e do
pack de scrum (`computeChemistryBonuses`) dá um bônus pequeno no timing/
sucesso dessas duas fases no motor de simulação (`engine.js`).

## Tática

- Plano de jogo (`state.gamePlan`) dividido em 4 zonas do campo (vermelha,
  laranja, verde, dourada/ingoal), cada uma com um estilo (chute,
  forwards/jogo corrido, equilibrado — `ZONE_STYLES`) e uma formação de pods
  dos forwards (`POD_FORMATIONS`: 3-3-2, 1-3-3-1, 3-3-1-1, 2-2-2-2 ou 4-4 —
  esse último pensado pra pick-and-go perto do ingoal).
- Pilares táticos gerais (posse, disciplina etc.) ajustáveis por slider.
- Sistemas de jogo reais (`PLAY_SYSTEMS`: Irlanda, Argentina, Sudáfrica...)
  mudam a formação visual dos pods na quadra (`render.js`).
- A IA rival reage taticamente: ajusta o plano antes do jogo pela diferença
  de força entre os times e no intervalo conforme o placar
  (`tickAiTacticalReactivity` e equivalente pré-jogo).

## Simulação da partida (`engine.js`)

- Clima sorteado a cada partida (`rollWeather`), afeta o aproveitamento de
  chute a gol (`kickEffective`).
- Mandante tem uma pequena vantagem fixa (`homeKickBonusA` e outros bônus).
- Moral/sequência de resultados recentes de cada time (`teamForm`,
  `moraleModFromForm`) influencia o desempenho.
- Eventos possíveis a cada tick (2 minutos de jogo): quebra de linha,
  turnover, erro de manuseio (knock-on), scrum, line-out, cartão
  amarelo/vermelho, try, conversão, penal, drop goal — em geral mutuamente
  exclusivos por tick (`eventHandled`).
- Estatísticas do pós-jogo (`stats`/`statsAtCheckpoint`) são reais —
  território, quebras, turnovers, erros, scrums/line-outs ganhos,
  conversões/penais/drops, cartões — contadas evento por evento durante a
  simulação, não geradas aleatoriamente pra exibição. Sobrevivem
  corretamente a substituições ao vivo e à reação tática do intervalo via
  `resumeState`/`statsCheckpointTick`.
- Quando um try é marcado, a linha de três-quartos do time que ganhou a
  jogada varre a quadra até o escanteio (`MatchRenderer.startTrySequence`
  em `render.js`), com a partida pausando ~1,5s reais pra dar tempo de
  acompanhar.
- No line-out, quem ganha a touch forma uma linha de ataque funda (pronta
  pra correr com espaço); quem defende fica achatado, colado perto da
  disputa (`lineoutLayout` em `render.js`).
- A IA rival também faz substituições táticas durante a partida
  (`tryTriggerAiSub`/`handleAiSubTickEvents`), só em times com elenco real
  (`getRealRoster`), nunca no time do próprio usuário.

## Recrutamento e formação de base

Só ativo pra quem gerencia o Curda (`ARG-CUR`/`PAR-CUR`):

- **Captação de promessas** (`tickScouting`, 35% de chance/rodada): surge um
  jogador revelado num clube menor do Paraguaio (`generateScoutProspect`),
  disponível em `state.scoutingProspects` (máx. 3) pra convidar
  (`inviteProspect` — aceite depende da determinação do jogador).
- **Academia de base** (`tickYouthAcademy`, 18% de chance/rodada): categorias
  M14 a M18 (`createInitialYouthAcademy`) sobem de nível com o tempo; quem
  se forma na M18 entra pro elenco principal (`state.recruitedPlayers`).
- **Recém-chegados estrangeiros** (`tickForeignArrival`, 8% de chance/
  rodada — mecânica deliberadamente mais rara que as outras duas): raramente
  um novo morador de Assunção decide tentar rugby, procurando o Curda
  primeiro. Nacionalidade sorteada por peso
  (`FOREIGN_ARRIVAL_NATIONALITIES`): Argentina (34%) e Uruguai (27%) mais
  comuns, Brasil raro (18%, com pouca bagagem no esporte — multiplicador de
  skill 0,5-0,7), Europa (13%) e Nova Zelândia raríssima (8%, mas bem mais
  apta — multiplicador 1,25-1,55). Entra na mesma fila de captação
  (`state.scoutingProspects`), com origem "Recém-chegado — {país}".

## Multi-competição

Clubes como o Curda disputam duas ligas ao mesmo tempo (NEA argentino +
campeonato paraguaio), com o mesmo elenco real (`getDualPartner`). Regra de
choque de agenda: se as duas competições caírem na mesma data em locais
diferentes, o mesmo jogador não pode ser escalado nas duas (`excludedIds` em
`pickStartingXV`/`rosterWithStatus`).
