// Elencos reais (curados à mão), com nomes, apelidos, idade, seleção e
// lesões — usados no lugar da geração procedural para os clubes em que
// temos essa informação. Times sem entrada aqui continuam usando
// generateSquad() normalmente.

import {SKILL_PROFILES, SKILL_LABELS, genBiometrics, genTraits, randomName, TEAMS} from './data.js';

const SKILL_KEYS = Object.keys(SKILL_LABELS);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

const POS_INFO = {
  PI: {label: 'Pilar', group: 'forward'},
  HK: {label: 'Hooker', group: 'forward'},
  SL: {label: 'Segunda Línea', group: 'forward'},
  AL: {label: 'Ala', group: 'forward'},
  N8: {label: 'Octavo', group: 'forward'},
  MS: {label: 'Medio Scrum', group: 'back'},
  AP: {label: 'Apertura', group: 'back'},
  CE: {label: 'Centro', group: 'back'},
  WG: {label: 'Wing', group: 'back'},
  FB: {label: 'Fullback', group: 'back'},
};

// Ordem-padrão de camisa 1-15 (11=ponta, 12/13=centros, 14=ponta, como no rugby real).
const XV_SLOTS = ['PI', 'HK', 'PI', 'SL', 'SL', 'AL', 'AL', 'N8', 'MS', 'AP', 'WG', 'CE', 'CE', 'WG', 'FB'];

function clamp(v) {
  return Math.max(30, Math.min(99, Math.round(v)));
}

function computeOverall(skills, profile) {
  let sum = 0;
  let weightSum = 0;
  SKILL_KEYS.forEach(k => {
    sum += skills[k] * profile[k];
    weightSum += profile[k];
  });
  return Math.round(sum / weightSum);
}

let autoId = 0;

// base = nível geral do jogador (30-99). overrides ajusta skills específicas
// citadas na descrição (ex.: um pilar "mais pesado do time" ganha força extra).
// overallOverride força o overall final (usado quando o overall "de scout"
// do jogador é maior do que a média ponderada das skills sugeriria).
// Sorteio da assiduidade nas 6 atividades (ver ATTENDANCE_CATEGORIES em
// data.js e comentário dentro de mkPlayer): cada categoria numa faixa
// 8-20 independente, mas partindo de um "comprometimento" de base do
// jogador — quem é assíduo tende a ser assíduo em várias frentes, mas com
// folga suficiente pra faltar bastante numa atividade específica (ex.:
// vai sempre ao treino geral mas não pisa na academia).
function genTrainingAttendance(rng) {
  const base = 12 + rng() * 8;
  const jitter = () => Math.max(8, Math.min(20, Math.round(base + (rng() - 0.5) * 9)));
  return {churrasco: jitter(), geral: jitter(), individual: jitter(), grupo: jitter(), academia: jitter(), video: jitter()};
}

// Mesma assiduidade fixa nas 6 categorias — usado nos jogadores reais
// curados à mão que só têm uma nota geral tipo "baixa frequência de treino".
function uniformAttendance(v) {
  return {churrasco: v, geral: v, individual: v, grupo: v, academia: v, video: v};
}

function mkPlayer(name, posId, base, overrides = {}, meta = {}, overallOverride = null) {
  const profile = SKILL_PROFILES[posId];
  const skills = {};
  SKILL_KEYS.forEach(k => {
    skills[k] = clamp(base * (0.55 + profile[k] * 0.45));
  });
  Object.entries(overrides).forEach(([k, v]) => { skills[k] = clamp(v); });

  // Altura/peso e traits ocultos são sorteados de forma determinística (semente
  // pelo nome+posição), exceto quando o próprio meta já vem com traits explícitos
  // (ex.: um jogador com nota descrevendo especialidade de lineout).
  const rng = mulberry32(seedFromString(name + posId));
  const {heightCm, weightKg} = genBiometrics(rng, posId);
  const traits = meta.traits || genTraits(rng, POS_INFO[posId].group);
  // Assiduidade nas 6 atividades (churrasco/geral/individual/grupo/academia/
  // video — ver ATTENDANCE_CATEGORIES em data.js), escala compacta 8-20,
  // independente das demais skills (não entra no overall) — ver
  // trainingIntensityCap em app.js pra como isso vira dias de treino/DIP.
  const trainingAttendance = meta.trainingAttendance != null ? meta.trainingAttendance : genTrainingAttendance(rng);

  return {
    id: `real-${autoId++}`,
    name,
    position: POS_INFO[posId].label,
    posId,
    group: POS_INFO[posId].group,
    skills,
    rating: overallOverride != null ? overallOverride : computeOverall(skills, profile),
    number: null,
    heightCm,
    weightKg,
    meta: {...meta, traits, trainingAttendance},
  };
}

// Monta um elenco PARCIALMENTE real: os jogadores confirmados (nome, posição
// e overall vindos de fontes reais, ex.: convocatórias da seleção) entram
// como estão; o resto do elenco é preenchido com nomes fictícios genéricos
// (mesmo gerador de generateSquad(), com semente própria por clube pra dar
// sempre o mesmo elenco) na faixa de força típica do time, marcados com
// meta.generated=true. Conforme mais nomes reais desse clube aparecerem, dá
// pra ir trocando entradas de `depthCounts` por jogadores reais em `known`
// (reduzindo a contagem da posição correspondente), até o elenco inteiro
// virar real.
function buildPartialRealRoster(clubId, known, depthCounts, baseOverall) {
  const rng = mulberry32(seedFromString(clubId + '-filler'));
  const usedNames = new Set(known.map(p => p.name));
  const filler = [];
  Object.entries(depthCounts).forEach(([posId, count]) => {
    for (let i = 0; i < count; i++) {
      const name = randomName(rng, usedNames);
      const variance = Math.floor(rng() * 16) - 8;
      const overall = Math.max(32, Math.min(96, baseOverall + variance));
      filler.push(mkPlayer(name, posId, overall, {}, {generated: true}));
    }
  });
  return [...known, ...filler];
}

// Elenco reorganizado por ordem real de titularidade em cada posição (a ordem
// dentro de cada bloco de comentário abaixo é a ordem de profundidade
// informada). Jogadores "dois-em-um" (ex.: Ballasch/Jariton pilar-hooker,
// Charlie/Gonza/Cani/René/Prolijo/Fenocchi segunda-terceira) mantêm um único
// conjunto de skills reais, mas com overrides nas skills mais relevantes de
// cada posição (lineoutThrow pro hooker, jump/strength pra segunda línea
// etc.) para que o overall EFETIVO calculado por effectiveOverallAt() em
// cada posição fique nitidamente diferente, em vez de aplicar uma
// penalidade genérica igual pra todo mundo.
// Recalibra as skills (e o overall que elas produzem) de um elenco curado
// pra bater com a força estrutural do clube declarada em data.js (attack/
// defense/stamina, calibrados pelo ranking real de clubes argentinos). Sem
// isso, um elenco com muitos jogadores nomeados vai ganhando overalls "de
// sensação" item a item ao longo do tempo até destoar muito da força que o
// time deveria ter na liga — chegou a acontecer do XV titular do Curda ter
// overall médio ~83 sendo, pela tabela real, um time mediano (base 64).
// Comprime cada skill em torno do mesmo piso que clamp() já usa (30),
// preservando a hierarquia interna do elenco: quem já era o melhor continua
// sendo o melhor, só que numa escala compatível com o resto da liga.
// Alarga a diferença entre os destaques e o resto do elenco. 1 = mantém a
// dispersão original (sem alargar); > 1 aumenta o quanto quem já estava
// acima da média do plantel sobe e quem estava abaixo desce.
const SPREAD_FACTOR = 3.5;

function rescaleRosterToTeamBase(roster, teamId) {
  const team = TEAMS.find(t => t.id === teamId);
  if (!team) return roster;
  const targetAvg = (team.attack + team.defense + team.stamina) / 3;

  // Etapa 1 (alargamento) e etapa 2 (recentragem na base do time) são as
  // duas mesmas transformações lineares de sempre, só que compostas SEM
  // aplicar clamp() entre elas — se a etapa 1 já clampasse em 30-99 antes da
  // etapa 2 rodar, um SPREAD_FACTOR alto satura quase todo mundo em 30 ou 99
  // de cara, e a etapa 2 (que só reescala proporcionalmente) fica sem
  // informação pra trabalhar (todo mundo clampado no mesmo valor vira o
  // mesmo valor de novo). Compor as duas ANTES de clampar preserva a forma
  // da distribuição; o clamp final entra só uma vez, no resultado.
  //
  // Etapa 1: alarga em torno da média do PLANTEL COMPLETO (não só do XV
  // titular — o XV é só a nata do elenco, a distância entre um titular e
  // outro já é pequena por definição; o contraste que queremos é entre
  // destaques e reservas/jogadores fracos). Esticar em torno da própria
  // média preserva essa média por construção.
  const meanSkillOfRoster = {};
  SKILL_KEYS.forEach(k => {
    meanSkillOfRoster[k] = roster.reduce((s, p) => s + p.skills[k], 0) / roster.length;
  });
  const spread = roster.map(p => {
    const skills = {};
    SKILL_KEYS.forEach(k => {
      const mean = meanSkillOfRoster[k];
      skills[k] = mean + (p.skills[k] - mean) * SPREAD_FACTOR; // sem clamp ainda
    });
    const profile = SKILL_PROFILES[p.posId];
    return {...p, skills, rating: computeOverall(skills, profile)};
  });

  // Etapa 2: recentra a força do XV TITULAR (recalculado sobre o elenco já
  // alargado; quem realmente entra em campo, não o plantel completo) na
  // base estrutural do clube — senão reforços de banco fraco (ex.:
  // jogadores de baixa frequência de treino) "puxam" a média geral pra
  // baixo e o cálculo compensa inflando os titulares pra cima, destorcendo
  // justamente o time que efetivamente joga. Usa um DESLOCAMENTO (soma uma
  // constante), não um fator multiplicativo: multiplicar desfaria boa parte
  // do alargamento da etapa 1 sempre que o alvo for mais baixo que a média
  // atual (a compressão relativa cancela quase todo o ganho, não importa o
  // quão forte for SPREAD_FACTOR) — somar uma constante preserva TODAS as
  // distâncias absolutas entre os jogadores, só desloca o time inteiro pra
  // que a média do XV caia exatamente no alvo.
  const xv1 = pickStartingXV(spread, {});
  const currentAvg = xv1.reduce((s, p) => s + p.rating, 0) / xv1.length;
  const shift = targetAvg - currentAvg;
  const shifted = spread.map(p => {
    const skills = {};
    Object.entries(p.skills).forEach(([k, v]) => { skills[k] = clamp(v + shift); });
    const profile = SKILL_PROFILES[p.posId];
    return {...p, skills, rating: computeOverall(skills, profile)};
  });

  // Etapa 3 (pequeno ajuste pontual, só pra quem viola a hierarquia real):
  // o alargamento da etapa 1 opera SKILL por SKILL em torno da média do
  // plantel inteiro, então mesmo jogadores com nível documentado de fora
  // (convocados da seleção paraguaia, Nacho e Garcete — melhores que eles
  // mas nunca convocados, um por recusar e o outro por já não estar mais na
  // lista — e o Camilo Orrego, bom jogador mas sem nível de seleção) podem
  // sair fora de ordem dependendo de que skills específicas cada um tem
  // acima/abaixo da média (ex.: o Allo, especialista de salto, tinha quase
  // todas as OUTRAS skills abaixo da média, saindo pior avaliado que os
  // próprios convocados). KNOWN_STRENGTH_TARGET corrige só essas violações
  // pontuais, escalando pro overall final desejado (pra cima OU pra baixo,
  // conforme o caso). Precisa ser um ajuste pequeno: como esses jogadores
  // ocupam a maioria das posições titulares, uma correção grande também
  // move a média geral do time, destoando do 5º-7º lugar real no NEA (a
  // distância que mostra nível de seleção de verdade aparece no Paraguaio,
  // na força ESTRUTURAL do time — bem mais alta lá — não no overall do
  // jogador).
  return shifted.map(p => {
    const target = KNOWN_STRENGTH_TARGET[p.name];
    if (target == null) return p;
    const factor = target / p.rating;
    const skills = {};
    Object.entries(p.skills).forEach(([k, v]) => { skills[k] = clamp(v * factor); });
    const profile = SKILL_PROFILES[p.posId];
    return {...p, skills, rating: computeOverall(skills, profile)};
  });
}

// Overall alvo (pós-recalibração pro NEA/Paraguaio) pros jogadores do Curda
// que a recalibração normal deixa fora de ordem: Garcete no mesmo nível do
// Mussi (o melhor convocado da seleção adulta, hoje 78), Nacho 2 pontos
// acima do Garcete, Allo no mesmo patamar da seleção, e o Orrego — bom
// jogador do Curda, mas sem nível de seleção — abaixo de todos os
// convocados. O NÚMERO AQUI (a chave do mapa) não é o overall final — é o
// alvo que, depois do clamp() em 30-99 absorver parte do ganho ou perda
// proporcional, produz o overall final desejado; cada valor foi calibrado
// testando o resultado real (ver getRealRoster('PAR-CUR') pra conferir).
const KNOWN_STRENGTH_TARGET = {
  'Ignacio Cuevas': 80, // final: 80
  'Mariano Garcete': 84, // final: 78
  'Álvaro Allo': 85, // final: 71
  'Camilo Orrego': 52, // final: 53 (Parodi - 4)
};

const CURDA_ROSTER_RAW = [
  // Pilares, em ordem de qualidade (melhor pro pior): Aranda, Salta, Tiago
  // Riveros, Sitjar, Josechi, Sapriza (lesionado, mas 6º em nível), Ballasch,
  // Jariton, Petiño, Laterza, Ayala — daí um salto de qualidade maior pro
  // último grupo: Piacentini, England, Samurai, Thanos.
  {...mkPlayer('Estefano Aranda', 'PI', 87, {}, {nationalTeam: 'seleção'}, 54), weightKg: 130},
  {...mkPlayer('Carlos Rodríguez', 'PI', 84, {}, {nickname: 'Salta'}, 50), weightKg: 130},
  {...mkPlayer('Tiago Riveros', 'PI', 81, {}, {birthDate: '2003-04-14', age: 'jovem', potential: 'alto'}, 45), weightKg: 110},
  {...mkPlayer('Martín Sitjar', 'PI', 77, {strength: 92}, {birthDate: '1992-11-17', note: 'o jogador mais pesado do time'}, 43), weightKg: 140},
  {...mkPlayer('José Santacruz', 'PI', 79, {}, {birthDate: '2000-08-05', nickname: 'Josechi'}, 44), weightKg: 110},
  {...mkPlayer('Santiago Sapriza', 'PI', 78, {}, {birthDate: '2000-01-15', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino', injuryWeeks: 13, injuryLabel: '3 meses'}, 42)},
  {...mkPlayer('Matías Ballasch', 'PI', 65, {lineoutThrow: 88, jump: 74, tackle: 73, strength: 81, scrum: 84}, {birthDate: '2002-01-08', note: 'também joga de hooker', altPos: ['HK']}, 41), weightKg: 110},
  {...mkPlayer('Adolfo Jariton', 'PI', 55, {lineoutThrow: 88, jump: 72, tackle: 72, strength: 80, scrum: 82}, {birthDate: '2001-12-18', note: 'também joga de hooker', altPos: ['HK']}, 40), weightKg: 120},
  {...mkPlayer('Petiño Santacruz', 'PI', 74, {}, {}, 39), weightKg: 130},
  {...mkPlayer('Franco Laterza', 'PI', 20, {lineoutThrow: 99, pass: 80, reception: 80, comunicacao: 80, leadership: 80}, {birthDate: '2006-03-21', age: 18, nationalTeam: 'seleção juvenil', note: 'também joga de hooker — excelente no lineout, com muita liderança e comunicação pro posto', altPos: ['HK']}, 37), weightKg: 110},
  {...mkPlayer('Martín Ayala', 'PI', 70, {}, {birthDate: '2000-12-13', note: 'por vezes usado no time intermédio'}, 35), weightKg: 130},
  {...mkPlayer('Piacentini', 'PI', 61, {}, {birthDate: '1993-07-14', note: 'pilar mediano'}, 30), weightKg: 130},
  {...mkPlayer('Fernando Gracía', 'PI', 58, {}, {birthDate: '1992-03-16', nickname: 'England', note: 'pilar mediano'}, 30), weightKg: 100},
  {...mkPlayer('Gonzalo Barrios', 'PI', 53, {lineoutThrow: 48}, {birthDate: '2007-08-23', nickname: 'Samurai', age: 18, altPos: ['HK']}, 30), weightKg: 103, heightCm: 180},
  {...mkPlayer('Martín Carvallo', 'PI', 45, {}, {nickname: 'Thanos', age: 31}, 30), weightKg: 116, heightCm: 179},

  // Hookers (ordem: Otaño, Ballasch, Jariton, Centurión, Fabiño, Achon, Laterza, Samurai)
  mkPlayer('Lucas Otaño', 'HK', 80, {}, {birthDate: '2001-11-07', injuryWeeks: 13, injuryLabel: '3 meses', traits: ['injuryProne']}, 82),
  mkPlayer('Alejo Centurión', 'HK', 68, {lineoutThrow: 92, scrum: 85, tackle: 82, strength: 84, stamina: 82, determination: 88}, {birthDate: '2005-03-14', age: 21, nationalTeam: 'seleção juvenil'}, 66),
  {...mkPlayer('Fábio Silva', 'HK', 58, {lineoutThrow: 80, scrum: 72, tackle: 70, strength: 68, speed: 80, determination: 85, stamina: 70}, {nickname: 'Fabiño', age: 40, note: 'o mais velho do elenco, mais dedicado porém com menor conhecimento; joga também de ponta e de centro por ser rápido', altPos: ['WG', 'CE']}, 58), weightKg: 90, heightCm: 172},

  // Segunda línea (primários) — Garcete, Javo, Volei, Dr Bro, Bruno Heisecke,
  // Sebas Benítez, Pesoka, Abel, Maxi; os "dois-em-um" com a terceira línea
  // (Charlie, Gonza, René, Prolijo, Cani, Fenocchi) viraram primário ala/AL
  // logo abaixo, já que o próprio pedido descreve que "jogam principalmente
  // como terceira, mas podem cobrir a vaga de segunda".
  mkPlayer('Mariano Garcete', 'SL', 94, {jump: 90, strength: 88, determination: 90}, {birthDate: '1998-03-09', nationalTeam: 'ex-capitão da seleção do Paraguai', traits: ['packLeader']}, 94),
  mkPlayer('Javier Pérez', 'SL', 88, {}, {nickname: 'Javo', nationalTeam: 'seleção do Paraguai adulta'}, 88),
  mkPlayer('Mariano Segovia', 'SL', 72, {}, {birthDate: '1998-10-09', nickname: 'Volei'}, 72),
  mkPlayer('Manuel', 'SL', 68, {}, {nickname: 'Dr Bro'}, 68),
  mkPlayer('Bruno Heisecke', 'SL', 58, {}, {birthDate: '2000-10-25'}, 58),
  mkPlayer('Sebas Benítez', 'SL', 50, {}, {}, 50),
  mkPlayer('Pesoka', 'SL', 47, {}, {age: 40}, 47),
  mkPlayer('Abel Locatti', 'SL', 40, {}, {birthDate: '1989-02-17'}, 40),
  mkPlayer('Bruno Vacotti', 'SL', 60, {}, {birthDate: '1986-10-16'}),
  mkPlayer('Elías Rodríguez', 'SL', 74, {strength: 82, speed: 76, determination: 88}, {note: 'muita garra, muito bom em quebrar tackles'}),
  mkPlayer('Juan José Agüero', 'SL', 46, {}, {birthDate: '2001-07-15', nickname: 'Gato', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino; também joga de ala', altPos: ['AL']}, 46),

  // Terceira línea / ala (ordem: Alvaro, Charlie, Gonza, JP, Prolijo, René,
  // Achon, Cani, Joaco, Vic Torres, Fenocchi) — Charlie/Gonza/René/Prolijo/
  // Cani/Fenocchi jogam principalmente aqui, mas cobrem a segunda línea
  // (altPos SL, com overrides de jump/strength pra diferenciar o overall
  // efetivo de cada um nas duas posições).
  mkPlayer('Álvaro Allo', 'AL', 78, {jump: 92}, {birthDate: '2003-10-07', age: 23, note: 'excelente no salto para o line-out'}, 84),
  mkPlayer('Carlos Plate', 'AL', 80, {jump: 96, strength: 93}, {birthDate: '1993-03-23', nickname: 'Charlie', age: 31, nationalTeam: 'seleção do Paraguai adulta', altPos: ['SL', 'N8']}, 80),
  mkPlayer('Gonza Alvarado', 'AL', 81, {jump: 99, lineoutThrow: 60, strength: 96, tackle: 92}, {birthDate: '1993-06-13', note: 'excelente no salto para o line-out, no estilo do Álvaro Allo', traits: ['lineoutSpecialist'], altPos: ['SL']}, 81),
  mkPlayer('Jean Paul Clemont', 'AL', 70, {}, {birthDate: '2001-10-31', nickname: 'JP', injuryWeeks: 43, injuryLabel: '10 meses'}, 74),
  mkPlayer('Agustín Vázquez', 'AL', 71, {jump: 60, strength: 62}, {birthDate: '1991-03-19', nickname: 'Prolijo', altPos: ['SL']}, 71),
  mkPlayer('René Villar', 'AL', 68, {jump: 82, strength: 80}, {altPos: ['SL']}, 68),
  mkPlayer('Elías Achon', 'AL', 76, {tackle: 80, stamina: 82, determination: 82, lineoutThrow: 38, scrum: 40, strength: 55, pass: 48, reception: 48, ruck: 60, turnover: 60}, {birthDate: '2004-01-31', note: 'hooker ou 3ª línea, joga mais de 3ª; muito bom nos tackles e muita disposição física, mas ainda o mais cru dos hookers do plantel (pouco lançamento de lineout)', altPos: ['HK']}, 65),
  mkPlayer('Edgard Espinoza', 'AL', 62, {jump: 62, strength: 60}, {birthDate: '1994-06-16', nickname: 'Cani', altPos: ['SL'], injuryWeeks: 9, injuryLabel: '2 meses'}, 62),
  mkPlayer('Joaquín Alzueta', 'AL', 68, {}, {nickname: 'Joaco', age: 20, note: 'joga também de centro', altPos: ['CE']}, 59),
  {...mkPlayer('Vic Torres', 'AL', 61, {determination: 80}, {birthDate: '1997-05-13', age: 29, note: 'joga também de ponta; costuma jogar no time intermédio, mas tem evoluído', altPos: ['WG']}, 56), weightKg: 90, heightCm: 182},
  mkPlayer('Nico Fenocchi', 'AL', 53, {jump: 44, strength: 46}, {birthDate: '1988-11-10', altPos: ['SL']}, 53),
  mkPlayer('Fernando Rettich', 'AL', 34, {}, {birthDate: '1973-10-09', trainingAttendance: uniformAttendance(8), note: 'veterano do clube, baixa frequência de treino; também joga de segunda línea', altPos: ['SL']}, 34),
  mkPlayer('Raúl Casabianca', 'AL', 40, {}, {birthDate: '1988-01-05', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino'}, 40),
  mkPlayer('Matías Benjamín Viveros', 'AL', 38, {}, {birthDate: '2007-08-10', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino'}, 38),

  // Oitavo (ordem: Marco Riquelme, Lautaro, Charlie)
  mkPlayer('Marcos Riquelme', 'N8', 78, {}, {birthDate: '1991-08-29', note: 'joga de 3ª línea, melhor como oitavo', altPos: ['AL']}, 78),
  mkPlayer('Lautaro', 'N8', 76, {pass: 85}, {birthDate: '1998-06-01', note: 'ótima visão de jogo'}, 74),

  // Medio scrum (ordem: Miño, Murdoch "Chucky", Dupuy, Ferchu, Luciano)
  mkPlayer('Diego Miño', 'MS', 93, {pass: 95}, {birthDate: '1997-10-23', nationalTeam: 'seleção do Paraguai adulta'}),
  mkPlayer('Ignacio Murdoch', 'MS', 85, {pass: 90}, {birthDate: '1998-12-30', nickname: 'Chucky'}, 81),
  mkPlayer('Agustín Dupuy', 'MS', 91, {kicking: 82, vision: 85, dropGoal: 75}, {birthDate: '2007-08-25', age: 19, potential: 'altíssimo', nationalTeam: 'seleção adulta', note: 'também joga de apertura', altPos: ['AP']}, 79),
  mkPlayer('Fernando Alvarado', 'MS', 80, {}, {birthDate: '2006-09-13', nickname: 'Ferchu', age: 'jovem', potential: 'altíssimo', injuryWeeks: 26, injuryLabel: '6 meses'}, 78),
  mkPlayer('Luciano Marsal', 'MS', 70, {}, {birthDate: '1999-07-06'}),

  // Abertura (ordem: Mussi, Dupuy, Orrego, Moratal, Julián, Kirichenko)
  mkPlayer('Joaquim Mussi', 'FB', 93, {kicking: 90, vision: 88, dropGoal: 80}, {birthDate: '2004-12-27', nationalTeam: 'seleção', note: 'melhor fullback do time; também joga de apertura', altPos: ['AP']}, 90),
  mkPlayer('Camilo Orrego', 'AP', 96, {kicking: 87, pass: 92, speed: 88, sidestep: 90, tackle: 88, vision: 86, agility: 88, positioning: 86, reception: 85, composure: 82, strength: 82}, {birthDate: '1997-02-18', note: 'nível 1a equipe como centro (12/13), mais pesado; chuta bem', altPos: ['CE']}, 76),
  mkPlayer('Benjamín Moratal', 'AP', 68, {}, {birthDate: '2005-04-25', note: 'usado como 9 ou 10', altPos: ['MS']}),
  mkPlayer('Julián Díaz', 'FB', 70, {kicking: 78, vision: 72, dropGoal: 60}, {age: 'jovem', potential: 'muito alto', note: 'também joga de apertura', altPos: ['AP']}),
  mkPlayer('Tiago Kirichenko', 'AP', 62, {reception: 82, positioning: 80, speed: 70, pass: 74}, {birthDate: '2007-06-28', age: 'jovem', altPos: ['FB']}),
  mkPlayer('Juan Manuel Rettich', 'AP', 44, {}, {birthDate: '2005-07-30', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino; também joga de ponta', altPos: ['WG']}, 44),

  // Centro (ordem: Nacho, Urbieta, Choclo, Orrego, LuizMi, Nico Allo, Argaña, Negro, Joaco, Fabiño, Mario)
  mkPlayer('Ignacio Cuevas', 'CE', 93, {pass: 92, reception: 90, tackle: 97, speed: 93, strength: 91, determination: 96}, {birthDate: '2002-01-30', nickname: 'Nacho', captain: true, note: 'melhor jogador do Paraguai; forte, rápido e difícil de ser tackleado; recusa convocações da seleção pra se manter fiel só ao Curda', refusesNationalTeam: true}, 91),
  mkPlayer('Sebas Urbieta', 'CE', 86, {}, {birthDate: '1993-05-11', age: 34, nationalTeam: 'seleção'}, 86),
  mkPlayer('Gianfranco Parodi', 'CE', 85, {pass: 85, tackle: 82, strength: 70}, {birthDate: '2000-03-09', nickname: 'Choclo', nationalTeam: 'seleção', altPos: ['WG']}, 82),
  mkPlayer('Luiz Miguel', 'CE', 90, {speed: 95, sidestep: 93, agility: 90, reception: 86}, {birthDate: '1996-02-21', nickname: 'LuizMi', note: 'também joga de ponta', nationalTeam: 'seleção', altPos: ['WG']}, 82),
  mkPlayer('Nico Allo', 'CE', 66, {}, {birthDate: '1999-10-18', age: 25}, 64),
  mkPlayer('Diego Argaña', 'CE', 66, {}, {birthDate: '1990-04-04'}, 63),
  mkPlayer('Marcelo Villaroel', 'CE', 66, {}, {birthDate: '2005-04-07', nickname: 'Negro'}, 60),
  mkPlayer('Juan José Gato', 'CE', 58, {}, {note: 'também joga de fullback', altPos: ['FB']}, 55),
  mkPlayer('Mario Domec', 'CE', 60, {}, {}, 48),
  mkPlayer('Maximiliano Rubin', 'CE', 38, {}, {birthDate: '2007-05-23', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino; também joga de ponta', altPos: ['WG']}, 38),
  mkPlayer('Piero Portaluppi', 'CE', 36, {}, {birthDate: '2007-02-26', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino; também joga de ponta', altPos: ['WG']}, 36),

  // Wing (ordem: Facu Paiva, LuizMi, Choclo, Micmacher, King, Lewis, Inge, Vic Torres, Fabiño)
  mkPlayer('Facundo Paiva', 'WG', 91, {speed: 92}, {birthDate: '2004-05-18', nationalTeam: 'seleção', note: 'um dos melhores jogadores do Curda'}),
  {...mkPlayer('Benjamín Micmacher', 'WG', 76, {vision: 80, speed: 85, agility: 88}, {birthDate: '2007-04-18', age: 19, note: 'inteligente, rápido e ágil'}, 76), weightKg: 81, heightCm: 178},
  mkPlayer('Juan King', 'WG', 80, {speed: 88, tackle: 82, stamina: 85, kicking: 32, vision: 35, positioning: 35, reception: 55}, {birthDate: '1997-12-06', note: 'ótima disposição, velocidade e tackles, não desiste da jogada', altPos: ['FB']}, 73),
  mkPlayer('Luis Guanes', 'WG', 78, {}, {birthDate: '1992-08-11', nickname: 'Lewis'}, 70),
  mkPlayer('Christian Daniel', 'WG', 64, {}, {nickname: 'Inge'}),
  {...mkPlayer('Nicolás Olivo', 'WG', 40, {}, {birthDate: '1997-02-01', nickname: 'Tucu', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino'}, 40), heightCm: 174, weightKg: 80},

  // Fullback (ordem: Mussi, Arturo, Horacio, Julián, Kirichenko, King)
  mkPlayer('Arturo López', 'FB', 90, {}, {birthDate: '2000-09-14', nationalTeam: 'seleção adulta'}),
  mkPlayer('Horacio Agüero', 'FB', 78, {kicking: 84, reception: 85}, {birthDate: '1995-05-05', note: 'ótima leitura de jogo e bons chutes'}),
  mkPlayer('Ezequiel Rubin Ramirez', 'FB', 45, {}, {birthDate: '2002-10-23', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino; também joga de ponta', altPos: ['WG']}, 45),
  mkPlayer('Renato Cardona', 'FB', 42, {}, {birthDate: '1992-01-24', trainingAttendance: uniformAttendance(8), note: 'baixa frequência de treino; também joga de médio scrum', altPos: ['MS']}, 42),
];

const CURDA_ROSTER = rescaleRosterToTeamBase(CURDA_ROSTER_RAW, 'ARG-CUR');

// Elenco real do San José, a partir das listas de convocados reais do clube
// para o mesmo fim de semana: um jogo do NEA (contra o Curda, sábado 16:30)
// e um jogo do Apertura paraguaio (18:30, mesma "Cancha URP") — exatamente o
// choque de agenda de mesmo local que o clube dual pode encarar. Os
// convocados do NEA são claramente o time principal (overall mais alto); os
// que sobraram pro Apertura formam o time intermédio. Três jogadores
// (Adrián León, Nicolás Arias, Jerónimo Arrellaga) aparecem nas duas listas:
// jogam os dois compromissos no mesmo dia.
const SANJOSE_ROSTER_RAW = [
  // Convocados do NEA (time principal) — titulares
  mkPlayer('Nicolás Cáceres', 'PI', 78),
  mkPlayer('Agustín Benítez', 'HK', 84, {}, {nationalTeam: 'seleção'}, 84),
  mkPlayer('Rodolfo Rivadeneira', 'HK', 80, {}, {nationalTeam: 'seleção'}, 80),
  mkPlayer('Nahuel Kacerosky', 'SL', 86, {}, {nationalTeam: 'seleção'}, 86),
  mkPlayer('Ignacio Martínez', 'SL', 76),
  mkPlayer('Ariel Núñez', 'AL', 88, {}, {nationalTeam: 'seleção'}, 88),
  mkPlayer('Francisco Bareiro', 'AL', 79, {}, {nationalTeam: 'seleção'}, 79),
  mkPlayer('Mateo Rodríguez', 'N8', 82),
  mkPlayer('Gonzalo Bareiro', 'MS', 81, {}, {nationalTeam: 'seleção'}, 81),
  mkPlayer('Joaquín Lamas', 'AP', 82, {}, {nationalTeam: 'seleção'}, 82),
  mkPlayer('Santiago Álvarez', 'WG', 83),
  mkPlayer('Thomas Guzmán', 'AP', 87, {}, {nationalTeam: 'seleção'}, 87),
  mkPlayer('Patricio Cabrera', 'CE', 82, {}, {nationalTeam: 'seleção'}, 82),
  mkPlayer('Juan Chilavert', 'WG', 83, {}, {nationalTeam: 'seleção'}, 83),
  mkPlayer('Santiago Espínola', 'FB', 79),
  mkPlayer('Juan Martín Sebriano', 'AL', 86, {}, {nationalTeam: 'seleção'}, 86),
  mkPlayer('Rafael Bareiro', 'N8', 78, {}, {nationalTeam: 'seleção'}, 78),
  mkPlayer('Juan González', 'WG', 78, {}, {nationalTeam: 'seleção'}, 78),
  mkPlayer('Ramiro Amarilla', 'CE', 78, {}, {nationalTeam: 'seleção'}, 78),
  // Convocados do NEA — banco
  mkPlayer('Emilio Gorostiaga', 'PI', 68),
  mkPlayer('César Pérez', 'PI', 78, {}, {nationalTeam: 'seleção'}, 78),
  mkPlayer('Enrique Quinteros', 'PI', 87, {}, {nationalTeam: 'seleção'}, 87),
  mkPlayer('Adrián León', 'SL', 74, {}, {note: 'joga NEA e Apertura no mesmo fim de semana'}),
  mkPlayer('Nicolás Arias', 'SL', 73, {}, {note: 'joga NEA e Apertura no mesmo fim de semana'}),
  mkPlayer('Jerónimo Arrellaga', 'AL', 75, {}, {note: 'joga NEA e Apertura no mesmo fim de semana'}),
  mkPlayer('Marcos Romanach', 'AL', 69),
  mkPlayer('Kevin Grau', 'N8', 71),
  // Convocados do Apertura paraguaio (time intermédio) — titulares
  mkPlayer('Luciano Aguilar', 'PI', 62),
  mkPlayer('Camilo García', 'PI', 60),
  mkPlayer('Marcelo Fretes', 'HK', 63),
  mkPlayer('Rubén Guerrero', 'SL', 65),
  mkPlayer('Sharif Ruiz', 'SL', 61),
  mkPlayer('Carlos Martins', 'SL', 86, {}, {nationalTeam: 'seleção'}, 86),
  mkPlayer('Bruno Sánchez', 'AL', 64),
  mkPlayer('Bruno Cabriza', 'N8', 67),
  mkPlayer('Giovani Salgueiro', 'MS', 68),
  mkPlayer('Luciano Weston', 'AP', 70),
  mkPlayer('Facundo Berdejo', 'WG', 69),
  mkPlayer('Enzo Villamayor', 'CE', 65),
  mkPlayer('Marcelo Matiauda', 'CE', 63),
  mkPlayer('Joaquín Zarate', 'WG', 66),
  mkPlayer('Angelo Bogado', 'FB', 64),
  // Convocados do Apertura — banco
  mkPlayer('Elixandro Gómez', 'PI', 55),
  mkPlayer('Joaquín Núñez', 'PI', 53),
  mkPlayer('Bautista Núñes', 'HK', 56),
  mkPlayer('Jorge Matiauda', 'SL', 58),
  mkPlayer('Santino Scribano', 'SL', 54),
  // Craque e capitão do time
  mkPlayer('Paco Lamas', 'FB', 88, {}, {captain: true, note: 'melhor jogador do San José; nascido em Buenos Aires, o San José às vezes busca reforços na Argentina', nationality: 'Argentina', yearsInParaguay: 3}, 90),
];

// San José também disputa duas competições ao mesmo tempo (NEA + Apertura
// paraguaio) com o mesmo plantel — reforça um pouco mais a profundidade
// (mesmo esquema do Curne acima) pra ficar no patamar de elenco "em dobro".
{
  const sanjoseExtraRng = mulberry32(seedFromString('ARG-SNJ-extra'));
  const sanjoseExtraUsed = new Set(SANJOSE_ROSTER_RAW.map(p => p.name));
  Object.entries({MS: 2, AP: 1, FB: 1}).forEach(([posId, count]) => {
    for (let i = 0; i < count; i++) {
      const name = randomName(sanjoseExtraRng, sanjoseExtraUsed);
      const variance = Math.floor(sanjoseExtraRng() * 16) - 8;
      const overall = Math.max(32, Math.min(96, 61 + variance));
      SANJOSE_ROSTER_RAW.push(mkPlayer(name, posId, overall, {}, {generated: true}));
    }
  });
}

// Igual ao Curda (ver rescaleRosterToTeamBase/CURDA_ROSTER): sem isso, o XV
// titular do San José ficava com overall médio ~83 (nível de seleção
// inteira), quando pela tabela real ele também é um time mediano do NEA
// (base ~61, 5º-7º lugar — mesmo patamar do Curda).
const SANJOSE_ROSTER = rescaleRosterToTeamBase(SANJOSE_ROSTER_RAW, 'ARG-SNJ');

// Elenco do Curne, mesmo clube que disputa o NEA argentino e também o
// Torneio do Interior (competição regional própria, times de cidades do
// interior de Corrientes) — mesmo plantel nos dois lados, igual ao esquema
// do Curda e do San José.
const CURNE_ROSTER = [
  // Titulares
  mkPlayer('Bruno Zacarías', 'PI', 82, {}, {note: 'pilar direito, forte no scrum'}),
  mkPlayer('Nahuel Portillo', 'PI', 79),
  mkPlayer('Tomás Escalante', 'HK', 83, {lineoutThrow: 88}, {captain: true, note: 'capitão, lançador de lineout mais preciso do time'}),
  mkPlayer('Ezequiel Miranda', 'SL', 84, {jump: 90}, {note: 'salto de lineout, referência do pack'}),
  mkPlayer('Franco Basualdo', 'SL', 80),
  mkPlayer('Rodrigo Cañete', 'AL', 81),
  mkPlayer('Matías Insaurralde', 'AL', 78),
  mkPlayer('Gastón Verón', 'N8', 85, {}, {note: 'motor do jogo aos contatos, muito determinado'}),
  mkPlayer('Iván Recalde', 'MS', 83),
  mkPlayer('Lucas Denis', 'AP', 86, {kicking: 88}, {note: 'principal cobrador de penais e conversões'}),
  mkPlayer('Braian Sanabria', 'WG', 84, {speed: 91}),
  mkPlayer('Octavio Meza', 'CE', 82),
  mkPlayer('Fabricio Aquino', 'CE', 80),
  mkPlayer('Ramiro Cardozo', 'WG', 83, {speed: 90}),
  mkPlayer('Julián Torales', 'FB', 85, {kicking: 80}),
  // Banco / rotação
  mkPlayer('Emanuel Godoy', 'PI', 70),
  mkPlayer('Cristian Ovelar', 'PI', 68),
  mkPlayer('Damián Ríos', 'PI', 66),
  mkPlayer('Facundo Britez', 'HK', 71),
  mkPlayer('Néstor Galarza', 'HK', 65),
  mkPlayer('Agustín Duarte', 'SL', 73),
  mkPlayer('Braulio Chaparro', 'SL', 70),
  mkPlayer('Ulises Maidana', 'AL', 74),
  mkPlayer('Kevin Villagra', 'AL', 69),
  mkPlayer('Ariel Coronel', 'N8', 72),
  mkPlayer('Gabriel Cabañas', 'MS', 71),
  mkPlayer('Facundo Leiva', 'MS', 66),
  mkPlayer('Nicolás Franco', 'AP', 73),
  mkPlayer('Emiliano Ledesma', 'WG', 72),
  mkPlayer('Tobías Amarilla', 'CE', 71),
  mkPlayer('Federico Barreto', 'CE', 68),
  mkPlayer('Santino Vera', 'WG', 70),
  mkPlayer('Joaquín Espínola', 'FB', 69),
  // Juvenis em ascensão
  mkPlayer('Ignacio Sena', 'PI', 58, {}, {age: 19}),
  mkPlayer('Bautista Ojeda', 'SL', 57, {}, {age: 19}),
  mkPlayer('Thiago Núñez', 'CE', 59, {}, {age: 18}),
];

// Curne disputa duas competições ao mesmo tempo (NEA + Torneio do Interior)
// com o mesmo plantel, igual Curda e San José — precisa de um elenco "em
// dobro" (~2x o tamanho de um clube de liga única) pra cobrir Time A e Time
// B em caso de choque de agenda no mesmo dia em locais diferentes. Reforça
// a profundidade com jogadores fictícios extras (mesmo gerador de nomes
// genéricos usado em buildPartialRealRoster) até chegar nesse tamanho.
{
  const curneExtraRng = mulberry32(seedFromString('ARG-CNE-extra'));
  const curneExtraUsed = new Set(CURNE_ROSTER.map(p => p.name));
  Object.entries({PI: 2, HK: 1, SL: 2, AL: 2, N8: 1, MS: 1, AP: 1, WG: 3, CE: 2, FB: 1}).forEach(([posId, count]) => {
    for (let i = 0; i < count; i++) {
      const name = randomName(curneExtraRng, curneExtraUsed);
      const variance = Math.floor(curneExtraRng() * 16) - 8;
      const overall = Math.max(32, Math.min(96, 70 + variance));
      CURNE_ROSTER.push(mkPlayer(name, posId, overall, {}, {generated: true}));
    }
  });
}

// Elenco do Duendes RC (Torneio do Interior), a partir das duas listas de
// convocados enviadas pelo usuário: "Duendes Rugby Club" (time titular) e
// "Duendes Rugby Club Reserva" (time reserva, claramente mais fraco — só
// nomes e número de camisa, sem outros dados, por isso os titulares usam a
// numeração 1-15 padrão pra deduzir a posição de cada um). Francisco
// Angaroni, Ramiro Urban e Juan M(anuel) Narvaja aparecem nas duas listas —
// tratados como um único jogador cada (o mesmo atleta circula entre os dois
// times), não duplicados.
const DUENDES_ROSTER = [
  // Titulares
  mkPlayer('Francisco Angaroni', 'PI', 80, {}, {note: 'também aparece na lista do time reserva'}),
  mkPlayer('Bernardo Lis', 'HK', 78),
  mkPlayer('Federico Bautista', 'PI', 79),
  mkPlayer('Pedro Rivas', 'SL', 80),
  mkPlayer('Ramiro Urban', 'SL', 81, {}, {note: 'também aparece na lista do time reserva'}),
  mkPlayer('Marcos Simioni', 'AL', 79),
  mkPlayer('Nicolás Sánchez', 'AL', 85, {}, {captain: true}),
  mkPlayer('Matías Landi', 'N8', 82),
  mkPlayer('Juan I. Araujo', 'MS', 78),
  mkPlayer('Patricio Rodríguez Vidal', 'AP', 83),
  mkPlayer('Joaquín Brogliati', 'WG', 80),
  mkPlayer('Guido Chesini', 'CE', 79),
  mkPlayer('Felipe Roldán', 'CE', 78),
  mkPlayer('Martín Pellegrino', 'WG', 80),
  mkPlayer('Juan Manuel Narvaja', 'FB', 84, {}, {note: 'também aparece na lista do time reserva'}),
  // Time reserva (nível bem abaixo do time titular)
  mkPlayer('Santiago Ruffinati', 'HK', 62, {}, {note: 'time reserva'}),
  mkPlayer('Jonathan Moski', 'PI', 60, {}, {note: 'time reserva'}),
  mkPlayer('Francisco Ibarguren', 'SL', 63, {}, {note: 'time reserva'}),
  mkPlayer('Nicolás Solans', 'AL', 61, {}, {note: 'time reserva'}),
  mkPlayer('Jeremías Del Mastro', 'AL', 62, {}, {note: 'time reserva'}),
  mkPlayer('Franco Discaciatti', 'N8', 64, {}, {note: 'time reserva'}),
  mkPlayer('Valentín Larrazábal', 'MS', 60, {}, {note: 'time reserva'}),
  mkPlayer('Giuliano Francescangeli', 'AP', 63, {}, {note: 'time reserva'}),
  mkPlayer('Santiago Cáceres', 'WG', 61, {}, {note: 'time reserva'}),
  mkPlayer('Julián Denhoff', 'CE', 60, {}, {note: 'time reserva'}),
  mkPlayer('Agustín Raparo', 'CE', 66, {}, {captain: true, note: 'capitão do time reserva'}),
  mkPlayer('Patricio Bullentini', 'WG', 62, {}, {note: 'time reserva'}),
];

// Elencos parcialmente reais dos clubes que apareceram nas convocatórias e
// escalações reais da seleção paraguaia, mas ainda não tinham elenco
// próprio no jogo (usavam generateSquad() genérico). Cada um mistura os
// jogadores reais confirmados (ver comentário de cada bloco) com
// preenchimento fictício gerado por buildPartialRealRoster() na força típica
// do time. Jogadores sem posição confirmada nas fontes (só apareceram na
// lista geral de convocados, não numa escalação titular) têm a posição
// estimada, sinalizada em nota.
const CRISTO_REY_KNOWN = [
  mkPlayer('Camilo Blasco', 'PI', 87, {}, {nationalTeam: 'seleção'}, 87),
  mkPlayer('Rodrigo Robadin', 'N8', 74, {}, {nationalTeam: 'seleção'}, 74),
  mkPlayer('Ignacio Vega', 'CE', 75, {}, {nationalTeam: 'seleção'}, 75),
];
const CRISTO_REY_ROSTER = buildPartialRealRoster('PAR-CRI', CRISTO_REY_KNOWN, {
  PI: 3, HK: 2, SL: 3, AL: 3, N8: 1, MS: 2, AP: 2, CE: 2, WG: 3, FB: 2,
}, 41);

const SANTA_CLARA_KNOWN = [
  mkPlayer('Jordi Chávez', 'HK', 84, {}, {nationalTeam: 'seleção'}, 84),
  mkPlayer('Gastón Salvi', 'PI', 80, {}, {nationalTeam: 'seleção'}, 80),
  mkPlayer('Alejandro Heyn', 'WG', 76, {}, {nationalTeam: 'seleção'}, 76),
];
const SANTA_CLARA_ROSTER = buildPartialRealRoster('PAR-STC', SANTA_CLARA_KNOWN, {
  PI: 3, HK: 1, SL: 3, AL: 3, N8: 2, MS: 2, AP: 2, CE: 3, WG: 2, FB: 2,
}, 47);

const BELGRANO_ATH_KNOWN = [
  mkPlayer('Mateo Gasparotti', 'PI', 76, {}, {nationalTeam: 'seleção'}, 76),
];
const BELGRANO_ATH_ROSTER = buildPartialRealRoster('BUE-BEL', BELGRANO_ATH_KNOWN, {
  PI: 3, HK: 2, SL: 3, AL: 3, N8: 2, MS: 2, AP: 2, CE: 3, WG: 3, FB: 2,
}, 83);

const SANTA_FE_KNOWN = [
  mkPlayer('Gonzalo del Pazo', 'SL', 76, {}, {nationalTeam: 'seleção'}, 76),
  mkPlayer('Juan Cruz Strada', 'CE', 76, {}, {nationalTeam: 'seleção'}, 76),
];
const SANTA_FE_ROSTER = buildPartialRealRoster('INT-SFE', SANTA_FE_KNOWN, {
  PI: 4, HK: 2, SL: 2, AL: 3, N8: 2, MS: 2, AP: 2, CE: 2, WG: 3, FB: 2,
}, 81);

const CAE_KNOWN = [
  mkPlayer('Juan Mernes', 'HK', 77, {}, {nationalTeam: 'seleção'}, 77),
];
const CAE_ROSTER = buildPartialRealRoster('INT-CAE', CAE_KNOWN, {
  PI: 4, HK: 1, SL: 3, AL: 3, N8: 2, MS: 2, AP: 2, CE: 3, WG: 3, FB: 2,
}, 84);

const CHAMPAGNAT_KNOWN = [
  mkPlayer('Matías Muniagurria', 'AP', 76, {}, {nationalTeam: 'seleção'}, 76),
];
const CHAMPAGNAT_ROSTER = buildPartialRealRoster('BUE-CHA', CHAMPAGNAT_KNOWN, {
  PI: 4, HK: 2, SL: 3, AL: 3, N8: 2, MS: 2, AP: 1, CE: 3, WG: 3, FB: 2,
}, 67);

// O Curda é o mesmo clube nas duas ligas (disputa o NEA argentino e o
// campeonato paraguaio) — mesmo plantel em ambas. O San José também disputa
// as duas ligas ao mesmo tempo, com o mesmo plantel real dos dois lados.
// O Curne segue o mesmo padrão: disputa o NEA argentino e o Torneio do
// Interior (regional) com o mesmo plantel.
const REAL_SQUADS = {
  'ARG-CUR': CURDA_ROSTER,
  'PAR-CUR': CURDA_ROSTER,
  'ARG-SNJ': SANJOSE_ROSTER,
  'INT-DUE': DUENDES_ROSTER,
  'PAR-SNJ': SANJOSE_ROSTER,
  'ARG-CNE': CURNE_ROSTER,
  'INT-CNE': CURNE_ROSTER,
  'PAR-CRI': CRISTO_REY_ROSTER,
  'PAR-STC': SANTA_CLARA_ROSTER,
  'BUE-BEL': BELGRANO_ATH_ROSTER,
  'INT-SFE': SANTA_FE_ROSTER,
  'INT-CAE': CAE_ROSTER,
  'BUE-CHA': CHAMPAGNAT_ROSTER,
};

// Skills de comissão técnica (0-99, mesma escala dos jogadores) — campo
// opcional em cada membro do staff, igual `note` já era (a maioria continua
// só com role/nome, sem números). Quando presentes, alimentam bônus de
// treino por especialidade (ver specialtyStaffBonus mais abaixo e o uso em
// tickTraining/tickYouthAcademy em app.js) em vez do multiplicador único e
// genérico de STAFF_QUALITY.
export const STAFF_SKILL_LABELS = {
  youthDevelopment: 'Trabalho com a base',
  backsCoaching: 'Treino de backs',
  forwardsCoaching: 'Treino de forwards',
  kickingCoaching: 'Treino de chute',
  setPieceCoaching: 'Estruturas fixas (scrum/ruck/line-out)',
  physicalConditioning: 'Preparação física',
  physiotherapy: 'Fisioterapia',
  sportsNutrition: 'Nutrição esportiva',
  communication: 'Comunicação',
  patience: 'Paciência',
  didactics: 'Didática',
};

const CURDA_STAFF = [
  {role: 'Presidente do Clube', name: 'Tío Nacho'},
  {
    role: 'Treinador Principal (Head Coach)',
    name: 'Lito Molina',
    skills: {setPieceCoaching: 98, didactics: 91},
    note: 'Referência de toda a região do Nordeste Argentino (NEA) na comissão técnica — um dos melhores, senão o melhor, especialista da região nas estruturas fixas do jogo (scrum, ruck e line-out); gosta que o time realmente aprenda a tática e a técnica, não só decore jogadas',
  },
  {
    role: 'Treinador Geral',
    name: 'Alexis Cibils',
    skills: {physicalConditioning: 89, communication: 82, didactics: 85},
    note: 'Muito bom em preparação física e condicionamento, organização dos treinos e controle de carga da academia — comunicação e didática acima da média',
  },
  {
    role: 'Preparador Técnico',
    name: 'Figu Super',
    skills: {youthDevelopment: 88, backsCoaching: 85, kickingCoaching: 82, communication: 84, patience: 90, didactics: 87},
    note: 'Lida muito bem com jovens e infantis, ótimo treinador de backs e de chute — comunicação, paciência e didática acima da média',
  },
  {role: 'Preparador Físico', name: 'Osorio'},
  {
    role: 'Nutricionista',
    name: 'Cemilson',
    skills: {sportsNutrition: 91, communication: 78},
    note: 'Referência em nutrição esportiva do plantel, com boa comunicação com os jogadores',
  },
  {
    role: 'Fisioterapeuta',
    name: 'Juan Carmona',
    skills: {physiotherapy: 93, physicalConditioning: 80},
    note: 'Excelente em fisioterapia, também muito bom na análise de condicionamento físico dos jogadores',
  },
  {
    role: 'Auxiliar Técnico',
    name: 'Sebas Bereta',
    skills: {setPieceCoaching: 83},
    note: 'De bom a ótimo nas estruturas fixas do jogo — sustenta bem o nível quando assume o time B, nos dias em que NEA e Paraguaio caem no mesmo dia em locais diferentes',
  },
  {role: 'Treinador das Categorias de Base', name: 'Dante Legui', note: 'comanda as categorias M18, M16, M15 e M14 do clube'},
  {role: 'Auxiliar', name: 'Facundo Rafael Navas'},
];

const CURNE_STAFF = [
  {
    role: 'Treinador Principal (Head Coach)',
    name: 'Darío Meza',
    skills: {forwardsCoaching: 80, communication: 78},
    note: 'Bom treinador de forwards, com boa comunicação — comissão regional sólida, mas sem o nível de referência do Curda',
  },
  {role: 'Preparador Físico', name: 'Coco Villagra'},
  {role: 'Fisioterapeuta', name: 'Ramona Sena'},
  {role: 'Auxiliar Técnico', name: 'Beto Franco', note: 'assume o time B quando NEA e Interior caem no mesmo dia em locais diferentes'},
];

// San José: o outro clube grande e dual-competição do Paraguaio (disputa NEA
// argentino + campeonato paraguaio, igual o Curda), com comissão técnica
// fictícia (não há fonte pública confiável pra staff real do clube) mas do
// mesmo porte/tamanho do Curda — um rival de verdade, não um "time B".
const SANJOSE_STAFF = [
  {role: 'Presidente do Clube', name: 'Rubén Ovelar'},
  {
    role: 'Treinador Principal (Head Coach)',
    name: 'Marcelo Achinelli',
    skills: {forwardsCoaching: 90, setPieceCoaching: 88, didactics: 84},
    note: 'Excelente treinador de forwards e de estruturas fixas — identidade forte de pack, muito exigente e didático',
  },
  {
    role: 'Treinador Geral',
    name: 'Nicolás Bogado',
    skills: {backsCoaching: 87, communication: 85},
    note: 'Muito bom treinador de backs, ótima comunicação com o plantel',
  },
  {
    role: 'Preparador Técnico',
    name: 'Hugo Servín',
    skills: {kickingCoaching: 86, patience: 88},
    note: 'Referência em chute a gol do clube, muito paciente com os mais jovens',
  },
  {role: 'Preparador Físico', name: 'Diego Cardozo', skills: {physicalConditioning: 85}},
  {
    role: 'Nutricionista',
    name: 'Lourdes Aquino',
    skills: {sportsNutrition: 84, communication: 75},
    note: 'Boa nutricionista esportiva, comunicação decente com o grupo',
  },
  {role: 'Fisioterapeuta', name: 'Marcos Benítez', skills: {physiotherapy: 86}},
  {role: 'Auxiliar Técnico', name: 'Walter Duarte'},
];

// Duendes RC: clube da NEA de porte médio, uma só competição — staff menor
// que Curda/San José e sem nutricionista dedicado.
const DUENDES_STAFF = [
  {
    role: 'Treinador Principal (Head Coach)',
    name: 'Ezequiel Portillo',
    skills: {forwardsCoaching: 78, didactics: 76},
    note: 'Bom treinador de forwards, didático com o grupo',
  },
  {role: 'Preparador Físico', name: 'Gastón Ríos', skills: {physicalConditioning: 74}},
  {role: 'Fisioterapeuta', name: 'Norma Aguirre', skills: {physiotherapy: 77}},
  {role: 'Auxiliar Técnico', name: 'Bruno Pellegrini'},
];

// Clubes menores (só um jogador real conhecido cada, resto do plantel
// gerado — ver buildPartialRealRoster) têm comissão técnica bem mais
// enxuta: a maioria só tem o treinador principal, sem nutricionista nem
// fisioterapeuta dedicados, e sem skills numéricas (não são especialistas
// de destaque, só cumprem a função). Nomes fictícios.
const CRISTO_REY_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Fabián Ayala'},
  {role: 'Preparador Físico', name: 'Ramón Cabañas'},
];
const SANTA_CLARA_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Derlis Zárate'},
];
const BELGRANO_ATH_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Tomás Iriarte'},
  {role: 'Preparador Físico', name: 'Lucas Ferrando'},
];
const SANTA_FE_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Nahuel Coronel'},
];
const CAE_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Ariel Bracco'},
];
const CHAMPAGNAT_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Ignacio Sarasola'},
  {role: 'Preparador Físico', name: 'Matías Ledesma'},
];

// Comissão técnica real da seleção paraguaia (post "STAFF 2026" do
// @urp_oficial).
const SELECAO_STAFF = [
  {role: 'Head Coach', name: 'Ramiro Peman'},
  {role: 'Entrenador Asistente', name: 'Pablo Filippini'},
  {role: 'Entrenador Asistente', name: 'Juan Ávila'},
  {role: 'Entrenador Asistente', name: 'Ignacio Basterra'},
  {role: 'Preparador Físico', name: 'Juan Manuel Brizuela'},
  {role: 'Preparador Físico', name: 'Leonardo Eraso'},
  {role: 'Analista de Vídeo', name: 'Eugenio Astesiano'},
  {role: 'Fisioterapeuta', name: 'Patricia López'},
  {role: 'Fisioterapeuta', name: 'Rodrigo Burgos'},
  {role: 'Médico', name: 'Danilo Trinidad'},
  {role: 'Nutricionista', name: 'Álvaro Andrada'},
  {role: 'Manager', name: 'Oscar Méndez'},
  {role: 'Logística', name: 'Sharif Ruiz'},
];

const STAFF = {
  'ARG-CUR': CURDA_STAFF,
  'PAR-CUR': CURDA_STAFF,
  'ARG-SNJ': SANJOSE_STAFF,
  'PAR-SNJ': SANJOSE_STAFF,
  'INT-DUE': DUENDES_STAFF,
  'ARG-CNE': CURNE_STAFF,
  'INT-CNE': CURNE_STAFF,
  'PAR-CRI': CRISTO_REY_STAFF,
  'PAR-STC': SANTA_CLARA_STAFF,
  'BUE-BEL': BELGRANO_ATH_STAFF,
  'INT-SFE': SANTA_FE_STAFF,
  'INT-CAE': CAE_STAFF,
  'BUE-CHA': CHAMPAGNAT_STAFF,
  'SEL-PAR': SELECAO_STAFF,
};

// Qualidade da comissão técnica: multiplica o ritmo de evolução dos
// atributos no treino (ver tickTraining em app.js). Escalada pelo tamanho/
// relevância de cada clube: Curda e San José são os dois grandes clubes
// dual-competição do Paraguaio (comissão de ponta); Curne e Duendes são
// clubes médios de uma só competição (comissão boa, mas não de ponta); os
// clubes menores (só um jogador real conhecido, resto do plantel gerado —
// ver buildPartialRealRoster) têm comissão enxuta e fica abaixo de 1 —
// treinam mais devagar que a média, sem staff dedicado pra cada área.
const STAFF_QUALITY = {
  'ARG-CUR': 1.5,
  'PAR-CUR': 1.5,
  'ARG-SNJ': 1.4,
  'PAR-SNJ': 1.4,
  'ARG-CNE': 1.2,
  'INT-CNE': 1.2,
  'INT-DUE': 1.15,
  'BUE-BEL': 1.0,
  'BUE-CHA': 1.0,
  'PAR-CRI': 0.9,
  'INT-SFE': 0.9,
  'PAR-STC': 0.85,
  'INT-CAE': 0.85,
};

// Estrutura física do clube — separado da qualidade do STAFF (pessoas):
// aqui é sobre as INSTALAÇÕES em si. O Curda tem sede própria completa no
// meio de Assunção (academia, campo de hóquei, arquibancadas, vestiário,
// sala de vídeo, churrasqueira, tudo organizado) mais uma filial em
// Surubi-í (dois campos de rugby, vestiário, salão de festa, churrasqueira
// e um espaço grande pra montar tendas/palcos/lojas de campeonato) — a
// maioria dos outros clubes não tem nada parecido, então mesmo com staff
// comparável treinam mais devagar na academia por falta de estrutura
// dedicada. Só afeta o treino de academia (ver tickAttendanceExtras em
// app.js) — não o staff em si nem as outras atividades de assiduidade.
const FACILITY_QUALITY = {
  'ARG-CUR': 1.4,
  'PAR-CUR': 1.4,
  'ARG-SNJ': 1.0,
  'PAR-SNJ': 1.0,
  'ARG-CNE': 0.85,
  'INT-CNE': 0.85,
  'INT-DUE': 0.8,
  'BUE-BEL': 0.75,
  'BUE-CHA': 0.75,
  'PAR-CRI': 0.7,
  'INT-SFE': 0.7,
  'PAR-STC': 0.65,
  'INT-CAE': 0.65,
};

export function getFacilityQuality(teamId) {
  return FACILITY_QUALITY[teamId] != null ? FACILITY_QUALITY[teamId] : 0.6;
}

// Jogadores captados de clubes menores do Paraguaio que aceitaram o convite
// pra jogar no Curda (ver tickScouting/inviteProspect em app.js). Fica num
// registro à parte em vez de mutar CURDA_ROSTER porque essa lista muda ao
// longo da partida/sessão — getRealRoster funde os dois transparentemente
// pra todo o resto do app (squadOf, rosterWithStatus, editor de escalação
// etc.) continuar funcionando sem precisar saber da diferença.
let recruitedIntoCurda = [];

export function setRecruitedPlayers(players) {
  recruitedIntoCurda = players || [];
}

export function getRealRoster(teamId) {
  const base = REAL_SQUADS[teamId] || null;
  if (!base) return null;
  if ((teamId === 'ARG-CUR' || teamId === 'PAR-CUR') && recruitedIntoCurda.length) {
    return [...base, ...recruitedIntoCurda];
  }
  return base;
}

export function getStaff(teamId) {
  return STAFF[teamId] || null;
}

export function getStaffQuality(teamId) {
  return STAFF_QUALITY[teamId] || 1;
}

// Bônus de treino por ESPECIALIDADE do staff (ver STAFF_SKILL_LABELS) — em
// vez do multiplicador único e genérico de getStaffQuality, olha só pra
// quem no staff tem aquela especialidade definida (ex.: 'backsCoaching')
// e escala getStaffQuality por ela: 0,7x (skill baixa) a 1,3x (skill alta,
// 99). Sem ninguém com aquela especialidade cadastrada, cai pro
// getStaffQuality geral do time, sem bônus nem malus extra — a maioria do
// staff continua sem `skills`, só role/note, e isso não deve puxar nada
// pra baixo. Usa o MELHOR (não a média) de quem tem aquela especialidade:
// um segundo especialista mais fraco na mesma área alivia a carga do
// principal (menos gente pra ele cobrir sozinho), mas nunca rebaixa o
// nível — o time treina no padrão do melhor disponível.
export function specialtyStaffBonus(teamId, specialtyKey) {
  const staff = STAFF[teamId] || [];
  const withSkill = staff.filter(s => s.skills && s.skills[specialtyKey] != null);
  if (!withSkill.length) return getStaffQuality(teamId);
  const best = Math.max(...withSkill.map(s => s.skills[specialtyKey]));
  return getStaffQuality(teamId) * (0.7 + (best / 99) * 0.6);
}

// Clubes que disputam duas ligas ao mesmo tempo (mesmo elenco, calendários
// independentes) — ex.: Curda e San José jogam o NEA argentino e o
// campeonato paraguaio simultaneamente, por isso plantéis tão grandes.
const DUAL_CLUBS = {
  'ARG-CUR': 'PAR-CUR',
  'PAR-CUR': 'ARG-CUR',
  'ARG-SNJ': 'PAR-SNJ',
  'PAR-SNJ': 'ARG-SNJ',
  'ARG-CNE': 'INT-CNE',
  'INT-CNE': 'ARG-CNE',
};

export function getDualPartner(teamId) {
  return DUAL_CLUBS[teamId] || null;
}

// Primeira línea (pilares e hooker) são especialistas: ao contrário das
// demais posições, ninguém "improvisa" ali quando falta gente.
const FRONT_ROW = new Set(['PI', 'HK']);

// Convocação de emergência do juvenil: usada só quando um clube não tem mais
// nenhum especialista de primeira línea disponível (lesões/condição esgotada
// pelo cansaço/choque de agenda). Jogador de 18 anos, recém-saído das
// categorias de base.
function emergencyYouthPlayer(posId) {
  const player = mkPlayer(
    `Juvenil convocado (${POS_INFO[posId].label})`,
    posId,
    48,
    {},
    {age: 18, note: 'Promovido às pressas do juvenil (18 anos) por falta de especialistas de primeira línea', emergencyCallUp: true},
  );
  return player;
}

// ---- Categorias de base do Curda (Dante Legui) -----------------------------
// M14 -> M15 -> M16 -> M18: quatro categorias, cada uma com seu próprio
// plantel de garotos gerados proceduralmente. De tempos em tempos (ver
// tickYouthAcademy em app.js) toda a base "sobe" uma categoria — quem estava
// na M18 se forma e é promovido ao plantel principal do Curda, e entra uma
// nova leva de garotos de 14 na base da pirâmide.
export const YOUTH_CATEGORIES = ['M14', 'M15', 'M16', 'M18'];
// Cada categoria tem um plantel de verdade bem maior (pelo menos 23
// jogadores, como qualquer time juvenil de clube), mas só mostramos os
// destaques (YOUTH_SQUAD_SIZE) — o resto do plantel existe narrativamente,
// sem precisar gerar/guardar 23 registros individuais por categoria.
export const YOUTH_CATEGORY_TOTAL_SIZE = 23;
const YOUTH_SQUAD_SIZE = 6;
// Faixas rebaixadas de propósito em relação aos destaques nomeados de cada
// categoria (ver curatedM18Players — hoje na faixa 58-65, fora o Nacho Lopes
// que é deliberadamente o mais fraco): um garoto anônimo gerado pelo sistema
// nunca deve nascer melhor que os prospectos de verdade que o manager já
// identificou e nomeou. advanceYouthAcademy só REALOCA o mesmo jogador de
// categoria em categoria (não regenera as skills), então essa faixa aqui —
// usada de novo só pra repor a M14 a cada ciclo — é o teto de verdade de
// qualquer "anônimo" que um dia se forma e entra no plantel principal.
const YOUTH_BASE_RANGE = {M14: [22, 32], M15: [26, 36], M16: [30, 42], M18: [34, 50]};
const YOUTH_POTENTIALS = ['limitado', 'médio', 'alto', 'altíssimo'];

// Nomes que nunca devem ser sorteados pra base — evita repetir jogadores que
// o manager já pediu pra tirar do plantel.
const BANNED_YOUTH_NAMES = new Set([
  'Gonzalo Melgarejo', 'Bautista Díaz', 'Mateo Aguirre',
  'Benjamín Leguizamón', 'Nicolás Gómez', 'Bruno Vallejos',
]);

function generateYouthPlayer(category, usedNames) {
  const posIds = Object.keys(POS_INFO);
  const posId = posIds[Math.floor(Math.random() * posIds.length)];
  const [min, max] = YOUTH_BASE_RANGE[category];
  // Um preparador de verdade bom com a base (ver STAFF_SKILL_LABELS.
  // youthDevelopment, ex.: Figu Super) sobe um pouco o nível bruto de quem
  // entra na academia — a diferença entre o bônus DAQUELE especialista e o
  // bônus genérico do time (sem ninguém marcado nessa especialidade,
  // specialtyStaffBonus cai pro mesmo valor de getStaffQuality e isso dá 0).
  const youthBonus = Math.round((specialtyStaffBonus('ARG-CUR', 'youthDevelopment') - getStaffQuality('ARG-CUR')) * 6);
  const base = min + Math.floor(Math.random() * (max - min + 1)) + youthBonus;
  const name = randomName(Math.random, usedNames);
  const potentialRoll = Math.random();
  const potential = potentialRoll > 0.88 ? YOUTH_POTENTIALS[3] : potentialRoll > 0.6 ? YOUTH_POTENTIALS[2] : potentialRoll > 0.25 ? YOUTH_POTENTIALS[1] : YOUTH_POTENTIALS[0];
  return mkPlayer(name, posId, base, {}, {
    age: category,
    potential,
    note: `Categoria ${category} do Curda, sob comando de Dante Legui`,
    youthCategory: category,
  });
}

// Destaques nomeados da M18 — usados tanto pra criar uma academia nova
// (createInitialYouthAcademy) quanto pra "encaixar" em academias de saves
// JÁ EXISTENTES (ver ensureCuratedYouthPlayers): a academia só é gerada uma
// vez, no começo de uma partida nova, então adicionar um novo nome aqui
// sozinho NÃO aparece pra quem já tem partida salva — precisa ser reaplicado
// no carregamento do save (ver chamada em app.js logo após loadState()).
function curatedM18Players() {
  return [
    // Nacho Lopes: hooker da M18, boa determinação e potencial alto, mas
    // ainda o mais cru dos hookers do clube — o menos pronto entre os
    // especialistas de primeira línea disponíveis hoje.
    mkPlayer('Nacho Lopes', 'HK', 30, {determination: 62, lineoutThrow: 46}, {
      age: 'M18',
      potential: 'alto',
      note: 'Categoria M18 do Curda, sob comando de Dante Legui — boa determinação e potencial alto, mas ainda o hooker mais cru do clube',
      youthCategory: 'M18',
    }),
    // Maxi Doldán: segunda-línea da M18, boa qualidade — já debutou no time
    // titular mesmo seguindo na categoria de base.
    mkPlayer('Maxi Doldán', 'SL', 63, {jump: 72, strength: 68}, {
      age: 'M18',
      potential: 'alto',
      note: 'Categoria M18 do Curda, sob comando de Dante Legui — já debutou no time titular por ter boa qualidade',
      youthCategory: 'M18',
    }),
    // Gael: centro/ponta da M18, 16 anos, bom potencial, ótima frequência de
    // treino e determinação.
    mkPlayer('Gael', 'CE', 65, {determination: 87}, {
      age: 'M18',
      potential: 'alto',
      trainingAttendance: uniformAttendance(19),
      note: 'Categoria M18 do Curda, sob comando de Dante Legui — 16 anos, joga de centro e ponta, bom potencial, ótima frequência de treino e determinação',
      youthCategory: 'M18',
      altPos: ['WG'],
    }),
    // Lúcio Nicolás: médio scrum (#9) da M18.
    {...mkPlayer('Lúcio Nicolás', 'MS', 58, {}, {
      age: 'M18',
      potential: 'alto',
      note: 'Categoria M18 do Curda, sob comando de Dante Legui — médio scrum (#9)',
      youthCategory: 'M18',
    }), heightCm: 170, weightKg: 70},
    // Gonzalo Saba: centro/ponta da M18.
    {...mkPlayer('Gonzalo Saba', 'CE', 58, {}, {
      age: 'M18',
      potential: 'alto',
      note: 'Categoria M18 do Curda, sob comando de Dante Legui — joga de centro ou ponta',
      youthCategory: 'M18',
      altPos: ['WG'],
    }), heightCm: 170, weightKg: 70},
  ];
}

// Nomes antigos de destaques que foram corrigidos depois — usado só pra
// achar e RENOMEAR a entrada errada em saves que já a receberam (ver
// ensureCuratedYouthPlayers), em vez de deixar as duas penduradas.
const RENAMED_YOUTH_PLAYERS = {
  'Gael': ['Lael'],
};

// Plantel inicial das 4 categorias, chamado uma vez ao começar um jogo novo
// como o Curda.
export function createInitialYouthAcademy() {
  const usedNames = new Set(BANNED_YOUTH_NAMES);
  const academy = {};
  YOUTH_CATEGORIES.forEach(cat => {
    academy[cat] = Array.from({length: YOUTH_SQUAD_SIZE}, () => generateYouthPlayer(cat, usedNames));
  });
  curatedM18Players().forEach((player, idx) => { academy.M18[idx] = player; });
  return academy;
}

// Encaixa os destaques nomeados da M18 (ver curatedM18Players) numa
// academia de um save JÁ EXISTENTE, criado antes de um destaque ser
// adicionado (ou antes de um nome ser corrigido) — substitui o primeiro
// slot gerado proceduralmente disponível (nunca mexe num destaque nomeado
// que já esteja lá certo). Se o destaque já está presente com um nome
// ANTIGO (ver RENAMED_YOUTH_PLAYERS), renomeia essa mesma entrada em vez de
// adicionar uma segunda. Devolve o MESMO objeto recebido se nada precisou
// mudar, pra quem chama saber se vale a pena salvar de novo.
export function ensureCuratedYouthPlayers(academy) {
  if (!academy || !academy.M18) return academy;
  const curated = curatedM18Players();
  const curatedNames = new Set(curated.map(p => p.name));
  const allOldNames = new Set(Object.values(RENAMED_YOUTH_PLAYERS).flat());
  const m18 = [...academy.M18];
  let changed = false;
  curated.forEach(player => {
    if (m18.some(existing => existing.name === player.name)) return; // já está certo
    const oldNames = RENAMED_YOUTH_PLAYERS[player.name] || [];
    const renameIdx = m18.findIndex(existing => oldNames.includes(existing.name));
    const targetIdx = renameIdx !== -1
      ? renameIdx
      : m18.findIndex(existing => !curatedNames.has(existing.name) && !allOldNames.has(existing.name));
    if (targetIdx !== -1) { m18[targetIdx] = player; changed = true; }
  });
  return changed ? {...academy, M18: m18} : academy;
}

// Função pura: recebe o estado atual da academia e devolve a nova academia
// (cada categoria sobe uma faixa) + a lista de quem se formou na M18 e está
// pronto pra ser promovido ao plantel principal (quem chama decide o que
// fazer com eles — ver tickYouthAcademy em app.js).
export function advanceYouthAcademy(academy) {
  const usedNames = new Set(BANNED_YOUTH_NAMES);
  const graduates = (academy.M18 || []).map(p => ({
    ...p,
    meta: {...p.meta, age: 'jovem', potential: p.meta.potential, youthCategory: undefined, note: `Formado nas categorias de base do Curda sob comando de Dante Legui; promovido ao plantel principal`},
  }));
  const next = {
    M18: academy.M16 || [],
    M16: academy.M15 || [],
    M15: academy.M14 || [],
    M14: Array.from({length: YOUTH_SQUAD_SIZE}, () => generateYouthPlayer('M14', usedNames)),
  };
  return {academy: next, graduates};
}

// Converte a condição física (0-100) num multiplicador de desempenho.
// Acima de ~85 o jogador rende praticamente no talento cheio; abaixo disso a
// queda física começa a custar caro nas decisões e na execução técnica.
export function conditionMultiplier(condition) {
  const c = Math.max(0, Math.min(100, condition == null ? 100 : condition));
  return 0.72 + 0.28 * (c / 100);
}

// Aplica lesões dinâmicas (metaOverrides) e evolução por treino
// (skillOverrides — valores absolutos que sobrescrevem as skills base) a um
// jogador, sem mutar o elenco estático. O overall nunca cai por causa do
// treino (só sobe, se a recomputação das skills superar o overall "de
// scout" original).
function applyOverrides(p, metaOverrides, skillOverrides) {
  let player = p;
  if (metaOverrides[p.id]) player = {...player, meta: {...player.meta, ...metaOverrides[p.id]}};
  if (skillOverrides[p.id]) {
    const skills = {...player.skills, ...skillOverrides[p.id]};
    const recomputed = computeOverall(skills, SKILL_PROFILES[player.posId]);
    player = {...player, skills, rating: Math.max(player.rating, recomputed)};
  }
  return player;
}

// Escolhe os 15 titulares (melhor jogador disponível por posição, excluindo
// lesionados e indisponíveis), numerados na convenção tradicional 1-15.
//   options.conditionOf(player) -> condição física 0-100 (default 100):
//     penaliza a nota efetiva usada na escalação, sem impedir a escalação em
//     si. Recebe o jogador inteiro (não só o id) para poder considerar
//     resistência/determinação na recuperação, se o chamador quiser.
//   options.excludedIds -> Set de ids indisponíveis (ex.: já escalados na
//     partida simultânea do outro torneio, em local diferente no mesmo dia):
//     exclusão dura, o jogador nem entra no pool.
//   options.metaOverrides -> {[id]: {injuryWeeks, injuryLabel, ...}} lesões
//     dinâmicas (por fadiga) que sobrescrevem o meta estático do jogador.
//   options.skillOverrides -> {[id]: {skillKey: novoValor}} evolução por
//     treino (ver tickTraining em app.js).
// Verdadeiro se o jogador pode ocupar essa posição: no posto que é o dele
// mesmo, ou numa posição alternativa listada em meta.altPos (jogadores que a
// observação de scout diz que "também jogam" ali).
function canPlay(p, posId) {
  return p.posId === posId || (p.meta.altPos && p.meta.altPos.includes(posId));
}

// Overall "efetivo" de um jogador numa posição específica: no posto dele
// mesmo é só o rating de scout já conhecido; numa posição alternativa,
// RECALCULA a média ponderada das skills reais dele usando o perfil daquela
// posição (em vez de aplicar uma penalidade fixa igual pra todo mundo) — um
// jogador "dois-em-um" de verdade (ex.: um hooker que também cobre pilar)
// mostra dois números bem diferentes, cada um refletindo se as skills dele
// (lançamento de lineout vs. força de scrum, por exemplo) pesam mais pra um
// lado ou pro outro. Ainda leva um desconto pequeno (4%) por não ser
// especialista, mesmo quando as skills computam bem nos dois postos.
export function effectiveOverallAt(p, posId) {
  if (p.posId === posId) return p.rating;
  return Math.round(computeOverall(p.skills, SKILL_PROFILES[posId]) * 0.96);
}

// Fator de condição SÓ pra decidir quem escala (mais rígido que o
// conditionMultiplier geral usado pra força em partida): acima de 90% não
// tem penalidade nenhuma, e cada ponto abaixo disso custa caro — a
// escalação automática prioriza quem está fresco (>90%) em vez de sempre
// puxar o "nome" mais talentoso mesmo desgastado.
function selectionConditionFactor(condition) {
  const c = condition == null ? 100 : condition;
  if (c >= 90) return 1;
  return Math.max(0.55, 1 - (90 - c) * 0.006);
}

export function pickStartingXV(roster, options = {}) {
  const conditionOf = options.conditionOf || (() => 100);
  const excludedIds = options.excludedIds || new Set();
  const metaOverrides = options.metaOverrides || {};
  const skillOverrides = options.skillOverrides || {};
  const effRatingAt = (p, posId) => effectiveOverallAt(p, posId) * selectionConditionFactor(conditionOf(p));

  const withMeta = roster.map(p => applyOverrides(p, metaOverrides, skillOverrides));
  const available = withMeta.filter(p => !p.meta.injuryWeeks && !excludedIds.has(p.id));
  const used = new Set();

  return XV_SLOTS.map((posId, idx) => {
    const group = POS_INFO[posId].group;
    let pool = available.filter(p => canPlay(p, posId) && !used.has(p.id));
    if (!pool.length && FRONT_ROW.has(posId)) {
      // Sem especialista (nem alternativa) de primeira línea disponível: não
      // improvisa com qualquer jogador, convoca um juvenil de emergência.
      const emergency = emergencyYouthPlayer(posId);
      used.add(emergency.id);
      return {...emergency, number: idx + 1, condition: 100};
    }
    // Salvaguarda: se faltar alguém na posição exata ou alternativa (fora da
    // primeira línea), prefere alguém da mesma linha (forward/back) antes de
    // pegar qualquer jogador disponível.
    if (!pool.length) pool = available.filter(p => p.group === group && !used.has(p.id));
    if (!pool.length) pool = available.filter(p => !used.has(p.id));
    const pick = pool.reduce((best, p) => (effRatingAt(p, posId) > effRatingAt(best, posId) ? p : best), pool[0]);
    used.add(pick.id);
    // Estampa o posto, o rótulo, o grupo (forward/back) e o OVERALL
    // recalculado pra essa posição específica (ver effectiveOverallAt) de
    // acordo com ONDE ele está jogando nesta partida — importante pro motor
    // (que identifica 9/10, lançador de lineout etc. pelo posId, e usa o
    // rating pra força do time), pra separação forwards/backs e pro rótulo
    // mostrado na camisa/tooltip da quadra.
    return {...pick, posId, position: POS_INFO[posId].label, group: POS_INFO[posId].group, rating: effectiveOverallAt(pick, posId), number: idx + 1, condition: conditionOf(pick)};
  });
}

// Plantel completo com status (titular/reserva/lesionado/indisponível) e
// condição física, para a tela de Elenco. Mesmas opções de pickStartingXV.
export function rosterWithStatus(teamId, options = {}) {
  const roster = getRealRoster(teamId);
  if (!roster) return null;
  const conditionOf = options.conditionOf || (() => 100);
  const metaOverrides = options.metaOverrides || {};
  const skillOverrides = options.skillOverrides || {};
  const xv = pickStartingXV(roster, options);
  const numberById = Object.fromEntries(xv.map(p => [p.id, p.number]));
  const excludedIds = options.excludedIds || new Set();

  return [...roster]
    .map(p => applyOverrides(p, metaOverrides, skillOverrides))
    .sort((a, b) => b.rating - a.rating)
    .map(p => {
      let status = 'reserva';
      if (p.meta.injuryWeeks) status = 'lesionado';
      else if (numberById[p.id]) status = 'titular';
      else if (excludedIds.has(p.id)) status = 'indisponivel';
      return {
        ...p,
        number: numberById[p.id] || null,
        status,
        condition: conditionOf(p),
      };
    });
}

// Regra de elegibilidade por nacionalidade: jogador estrangeiro (ex.: um
// argentino recrutado pelo San José em Buenos Aires, como o Paco Lamas) só
// pode defender a seleção paraguaia depois de um número mínimo de anos no
// país (5 por padrão, salvo meta.eligibleAfterYears customizado). Jogador
// sem meta.nationality (ou nascido no Paraguai) é elegível sem restrição.
function isNationalTeamEligible(p) {
  if (p.meta.refusesNationalTeam) return false;
  const foreign = p.meta.nationality && p.meta.nationality !== 'Paraguai';
  if (!foreign) return true;
  const required = p.meta.eligibleAfterYears != null ? p.meta.eligibleAfterYears : 5;
  return (p.meta.yearsInParaguay || 0) >= required;
}

// meta.nationalTeam também guarda jogadores que NÃO estão convocados hoje:
// "seleção juvenil" é a seleção de base (categoria de idade, não a Yacaré XV
// adulta) e "ex-capitão..."/"ex-..." é alguém que já defendeu o país mas não
// está mais na lista atual (ex.: Mariano Garcete — confirmado pelos próprios
// comentários do post oficial do plantel 2026, "¿Ya no está más Mariano
// Garcete?"). Só tags que indicam convocação ADULTA ATUAL contam pro pool do
// Yacaré XV de hoje.
function isActiveAdultNationalTeamTag(tag) {
  if (!tag) return false;
  return !/juvenil|^ex-/i.test(tag);
}

// Convocados do "Plantel 2026" (post do @urp_oficial) cujo clube não tem
// elenco próprio no jogo — entram só pra seleção, com o clube real guardado
// em meta.clubOrigin (não o rótulo genérico do grupo "clubs" em
// getParaguaySquad). Leonardo Segovia e Matías Alcaraz têm clube não
// confirmado (não apareceram em nenhuma lista de convocados, só na
// escalação titular/banco).
const SELECAO_ONLY_KNOWN = [
  mkPlayer('Leonardo Segovia', 'N8', 82, {}, {nationalTeam: 'seleção'}, 82),
  mkPlayer('Matías Alcaraz', 'CE', 77, {}, {nationalTeam: 'seleção'}, 77),
  mkPlayer('Francisco Gaspes', 'PI', 76, {}, {nationalTeam: 'seleção', clubOrigin: 'Hurling'}, 76),
  mkPlayer('Nicolas Toth', 'HK', 75, {}, {nationalTeam: 'seleção', clubOrigin: 'Lomas Athletic'}, 75),
  mkPlayer('Joaquin Dominguez', 'AL', 75, {}, {nationalTeam: 'seleção', clubOrigin: 'ASBC Bédarrides'}, 75),
  mkPlayer('Lautaro Gonzalez', 'WG', 76, {}, {nationalTeam: 'seleção', clubOrigin: 'Palermo Bajo'}, 76),
  mkPlayer('Valentino Marciali', 'SL', 75, {}, {nationalTeam: 'seleção', clubOrigin: 'Atlético de Rosario'}, 75),
  mkPlayer('Valentino Quatrocchi', 'CE', 75, {}, {nationalTeam: 'seleção', clubOrigin: 'San Luis'}, 75),
  mkPlayer('Francisco Calello', 'N8', 74, {}, {nationalTeam: 'seleção', clubOrigin: 'San Cirano'}, 74),
  mkPlayer('Manuel Todaro', 'FB', 76, {}, {nationalTeam: 'seleção', clubOrigin: 'Universitario de Rosario'}, 76),
];

// Escalação titular + banco oficiais mais recentes (post "FORMACIÓN" do
// @urp_oficial, 10 de julho de 2026, vs Chile XV) — FIXA, na ordem real de
// camisa, não um auto-pick pelos melhores overalls do país. A seleção é
// convocação documentada, não otimização: um jogador pode ter nível de
// seleção (ex.: Álvaro Allo, Gonza Alvarado no Curda) e nunca ter sido
// convocado, e a escalação oficial não muda só porque o overall de alguém
// mudou de um treino pro outro.
const SELECAO_XV_ORDER = [
  'Camilo Blasco', 'Jordi Chávez', 'Enrique Quinteros', 'Nahuel Kacerosky', 'Carlos Martins',
  'Juan Martín Sebriano', 'Ariel Núñez', 'Leonardo Segovia', 'Diego Miño', 'Thomas Guzmán',
  'Facundo Paiva', 'Sebas Urbieta', 'Gianfranco Parodi', 'Arturo López', 'Joaquim Mussi',
];
const SELECAO_BENCH_ORDER = [
  'Agustín Benítez', 'Gastón Salvi', 'Estefano Aranda', 'Javier Pérez',
  'Matías Alcaraz', 'Agustín Dupuy', 'Patricio Cabrera', 'Juan Chilavert',
];

// ---- Seleção do Paraguai (Los Yacarés) -------------------------------------
// O pool de CONVOCADOS junta todo jogador tagueado como seleção ATUAL adulta
// em cada clube onde a Paraguay tem convocados: Curda, San José, Cristo Rey,
// Santa Clara (clubes paraguaios), os expatriados que jogam em clubes
// argentinos mas defendem a seleção (Belgrano Athletic, Santa Fe, CAE,
// Champagnat), e os dois sem clube confirmado (SELECAO_ONLY_KNOWN) —
// conferido contra o plantel 2026 oficial (posts do Instagram do URP).
// Ignacio "Nacho" Cuevas (Curda) é a exceção: recusa convocações pra se
// manter fiel só ao clube (meta.refusesNationalTeam), então nunca entra no
// pool mesmo sendo o melhor jogador do país. Jogadores estrangeiros
// recém-chegados (ex.: Paco Lamas, argentino) também ficam de fora até
// completarem os anos de residência exigidos (isNationalTeamEligible). Usa
// CURDA_ROSTER (o mesmo overall único usado nas partidas do clube, não uma
// versão "pré-ajuste" separada só pra seleção) — o Curda ser muito mais
// forte no Paraguaio do que no NEA é modelado no nível estrutural do TIME
// por competição (ver os valores de attack/defense/stamina de
// PAR-CUR/PAR-SNJ em data.js, bem mais altos que os de ARG-CUR/ARG-SNJ),
// não no overall individual do jogador.
//
// Já o XV TITULAR e o BANCO são FIXOS (SELECAO_XV_ORDER/SELECAO_BENCH_ORDER,
// a escalação real documentada) — não um pickStartingXV pelos melhores do
// pool. O pool inteiro (bem mais amplo que os 23 da escalação) continua
// disponível pra quem quiser consultar todos os convocados, e é o que
// bloqueia os clubes de origem durante o ARC (ver arcCalledUpIds).
export function getParaguaySquad() {
  const clubs = [
    {roster: [...CURDA_ROSTER, ...recruitedIntoCurda], club: 'Curda'},
    {roster: SANJOSE_ROSTER, club: 'San José'},
    {roster: CRISTO_REY_ROSTER, club: 'Cristo Rey'},
    {roster: SANTA_CLARA_ROSTER, club: 'Santa Clara'},
    {roster: BELGRANO_ATH_ROSTER, club: 'Belgrano Athletic'},
    {roster: SANTA_FE_ROSTER, club: 'Santa Fe'},
    {roster: CAE_ROSTER, club: 'Club Atlético Estudiantes'},
    {roster: CHAMPAGNAT_ROSTER, club: 'Champagnat'},
    {roster: SELECAO_ONLY_KNOWN, club: ''},
  ];
  const pool = clubs.flatMap(({roster, club}) => roster
    .filter(p => isActiveAdultNationalTeamTag(p.meta.nationalTeam) && isNationalTeamEligible(p))
    .map(p => ({...p, meta: {...p.meta, clubOrigin: p.meta.clubOrigin || club}}))
  );

  const byName = name => pool.find(p => p.name === name);
  const xv = SELECAO_XV_ORDER
    .map(name => byName(name))
    .filter(Boolean)
    .map((p, i) => ({...p, number: i + 1, condition: 100}));
  const xvIds = new Set(xv.map(p => p.id));
  const bench = SELECAO_BENCH_ORDER
    .map(name => byName(name))
    .filter(p => p && !xvIds.has(p.id))
    .map((p, i) => ({...p, number: 16 + i, condition: 100, status: 'reserva'}));

  return {xv, bench, pool};
}
