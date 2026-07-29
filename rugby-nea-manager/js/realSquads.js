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
// Sorteio da frequência de treino (ver comentário dentro de mkPlayer):
// faixa 8-20, a maioria fica no meio, poucos batem no teto disciplinado.
function genTrainingFrequency(rng) {
  return 8 + Math.floor(rng() * 13);
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
  // Frequência de treino: disciplina/assiduidade do jogador, numa escala
  // compacta e independente das demais skills (não entra no overall) — ver
  // trainingIntensityCap em app.js pra como isso vira dias de DIP por semana.
  const trainingFrequency = meta.trainingFrequency != null ? meta.trainingFrequency : genTrainingFrequency(rng);

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
    meta: {...meta, traits, trainingFrequency},
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
function rescaleRosterToTeamBase(roster, teamId) {
  const team = TEAMS.find(t => t.id === teamId);
  if (!team) return roster;
  const targetAvg = (team.attack + team.defense + team.stamina) / 3;
  const currentAvg = roster.reduce((s, p) => s + p.rating, 0) / roster.length;
  const factor = (targetAvg - 30) / (currentAvg - 30);
  return roster.map(p => {
    const skills = {};
    Object.entries(p.skills).forEach(([k, v]) => { skills[k] = clamp(30 + (v - 30) * factor); });
    const profile = SKILL_PROFILES[p.posId];
    return {...p, skills, rating: computeOverall(skills, profile)};
  });
}

const CURDA_ROSTER_RAW = [
  // Pilares (ordem: Aranda, Salta, Tiago, Sitjar, Ballasch, Josechi, Petiño,
  // Martin, Jariton, England, Laterza, Samurai, Piacentini, Thanos)
  {...mkPlayer('Estefano Aranda', 'PI', 87, {}, {nationalTeam: 'seleção'}, 88), weightKg: 130},
  {...mkPlayer('Carlos Rodríguez', 'PI', 80, {}, {nickname: 'Salta'}, 85), weightKg: 130},
  {...mkPlayer('Tiago Riveros', 'PI', 78, {}, {birthDate: '2003-04-14', age: 'jovem', potential: 'alto'}, 80), weightKg: 110},
  {...mkPlayer('Martín Sitjar', 'PI', 74, {strength: 92}, {birthDate: '1992-11-17', note: 'o jogador mais pesado do time'}, 78), weightKg: 140},
  {...mkPlayer('Matías Ballasch', 'PI', 76, {lineoutThrow: 97, jump: 80, tackle: 80, strength: 90, scrum: 92}, {birthDate: '2002-01-08', note: 'também joga de hooker', altPos: ['HK']}, 76), weightKg: 110},
  {...mkPlayer('José Santacruz', 'PI', 66, {}, {birthDate: '2000-08-05', nickname: 'Josechi'}, 73), weightKg: 110},
  {...mkPlayer('Petiño Santacruz', 'PI', 71, {}, {}, 71), weightKg: 130},
  {...mkPlayer('Martín Ayala', 'PI', 58, {}, {birthDate: '2000-12-13', note: 'por vezes usado no time intermédio'}, 68), weightKg: 130},
  {...mkPlayer('Adolfo Jariton', 'PI', 72, {lineoutThrow: 99, jump: 85, tackle: 82, strength: 88, scrum: 92, stamina: 80}, {birthDate: '2001-12-18', note: 'também joga de hooker', altPos: ['HK']}, 65), weightKg: 120},
  {...mkPlayer('Fernando Gracía', 'PI', 58, {}, {birthDate: '1992-03-16', nickname: 'England', note: 'pilar mediano'}, 62), weightKg: 100},
  {...mkPlayer('Franco Laterza', 'PI', 60, {lineoutThrow: 55}, {birthDate: '2006-03-21', age: 18, nationalTeam: 'seleção juvenil', note: 'também joga de hooker', altPos: ['HK']}, 60), weightKg: 110},
  {...mkPlayer('Gonzalo Barrios', 'PI', 58, {lineoutThrow: 48}, {birthDate: '2007-08-23', nickname: 'Samurai', age: 18, altPos: ['HK']}, 58), weightKg: 103, heightCm: 180},
  {...mkPlayer('Piacentini', 'PI', 56, {}, {birthDate: '1993-07-14', note: 'pilar mediano'}, 56), weightKg: 130},
  {...mkPlayer('Martín Carvallo', 'PI', 53, {}, {nickname: 'Thanos', age: 31}, 53), weightKg: 116, heightCm: 179},

  // Hookers (ordem: Otaño, Ballasch, Jariton, Centurión, Fabiño, Achon, Laterza, Samurai)
  mkPlayer('Lucas Otaño', 'HK', 80, {}, {birthDate: '2001-11-07', injuryWeeks: 13, injuryLabel: '3 meses', traits: ['injuryProne']}, 82),
  mkPlayer('Alejo Centurión', 'HK', 68, {lineoutThrow: 90, determination: 85}, {birthDate: '2005-03-14', age: 21, nationalTeam: 'seleção juvenil'}, 66),
  {...mkPlayer('Fábio Silva', 'HK', 58, {speed: 80, determination: 85, stamina: 70}, {nickname: 'Fabiño', age: 40, note: 'o mais velho do elenco, mais dedicado porém com menor conhecimento; joga também de ponta e de centro por ser rápido', altPos: ['WG', 'CE']}, 58), weightKg: 90, heightCm: 172},

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
  mkPlayer('Maxi Doldan', 'SL', 38, {}, {age: 18, note: 'juvenil'}, 38),
  mkPlayer('Bruno Vacotti', 'SL', 60, {}, {birthDate: '1986-10-16'}),
  mkPlayer('Elías Rodríguez', 'SL', 74, {strength: 82, speed: 76, determination: 88}, {note: 'muita garra, muito bom em quebrar tackles'}),
  mkPlayer('Juan José Agüero', 'SL', 46, {}, {birthDate: '2001-07-15', nickname: 'Gato', trainingFrequency: 8, note: 'baixa frequência de treino; também joga de ala', altPos: ['AL']}, 46),

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
  mkPlayer('Elías Achon', 'AL', 76, {tackle: 86, stamina: 88, determination: 88, lineoutThrow: 40, pass: 48, reception: 48, ruck: 60, turnover: 60}, {birthDate: '2004-01-31', note: 'hooker ou 3ª línea, joga mais de 3ª; muito bom nos tackles e muita disposição física', altPos: ['HK']}, 65),
  mkPlayer('Edgard Espinoza', 'AL', 62, {jump: 62, strength: 60}, {birthDate: '1994-06-16', nickname: 'Cani', altPos: ['SL'], injuryWeeks: 9, injuryLabel: '2 meses'}, 62),
  mkPlayer('Joaquín Alzueta', 'AL', 68, {}, {nickname: 'Joaco', age: 20, note: 'joga também de centro', altPos: ['CE']}, 59),
  {...mkPlayer('Vic Torres', 'AL', 61, {determination: 80}, {birthDate: '1997-05-13', age: 29, note: 'joga também de ponta; costuma jogar no time intermédio, mas tem evoluído', altPos: ['WG']}, 56), weightKg: 90, heightCm: 182},
  mkPlayer('Nico Fenocchi', 'AL', 53, {jump: 44, strength: 46}, {birthDate: '1988-11-10', altPos: ['SL']}, 53),
  mkPlayer('Fernando Rettich', 'AL', 34, {}, {birthDate: '1973-10-09', trainingFrequency: 8, note: 'veterano do clube, baixa frequência de treino; também joga de segunda línea', altPos: ['SL']}, 34),

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
  mkPlayer('Juan Manuel Rettich', 'AP', 44, {}, {birthDate: '2005-07-30', trainingFrequency: 8, note: 'baixa frequência de treino; também joga de ponta', altPos: ['WG']}, 44),

  // Centro (ordem: Nacho, Urbieta, Choclo, Orrego, LuizMi, Nico Allo, Argaña, Negro, Joaco, Fabiño, Mario)
  mkPlayer('Ignacio Cuevas', 'CE', 93, {pass: 92, reception: 90, tackle: 97, speed: 93, strength: 91, determination: 96}, {birthDate: '2002-01-30', nickname: 'Nacho', captain: true, note: 'melhor jogador do Paraguai; forte, rápido e difícil de ser tackleado; recusa convocações da seleção pra se manter fiel só ao Curda', refusesNationalTeam: true}, 91),
  mkPlayer('Sebas Urbieta', 'CE', 86, {}, {birthDate: '1993-05-11', age: 34, nationalTeam: 'seleção'}, 86),
  mkPlayer('Gianfranco Parodi', 'CE', 85, {pass: 85, tackle: 82, strength: 70}, {birthDate: '2000-03-09', nickname: 'Choclo', nationalTeam: 'seleção', altPos: ['WG']}, 82),
  mkPlayer('Luiz Miguel', 'CE', 90, {speed: 95, sidestep: 93, agility: 90, reception: 86}, {birthDate: '1996-02-21', nickname: 'LuizMi', note: 'também joga de ponta', altPos: ['WG']}, 82),
  mkPlayer('Nico Allo', 'CE', 66, {}, {birthDate: '1999-10-18', age: 25}, 64),
  mkPlayer('Diego Argaña', 'CE', 66, {}, {birthDate: '1990-04-04'}, 63),
  mkPlayer('Marcelo Villaroel', 'CE', 66, {}, {birthDate: '2005-04-07', nickname: 'Negro'}, 60),
  mkPlayer('Mario Domec', 'CE', 60, {}, {}, 48),

  // Wing (ordem: Facu Paiva, LuizMi, Choclo, Micmacher, King, Lewis, Inge, Vic Torres, Fabiño)
  mkPlayer('Facundo Paiva', 'WG', 91, {speed: 92}, {birthDate: '2004-05-18', nationalTeam: 'seleção', note: 'um dos melhores jogadores do Curda'}),
  {...mkPlayer('Benjamín Micmacher', 'WG', 76, {vision: 80, speed: 85, agility: 88}, {birthDate: '2007-04-18', age: 19, note: 'inteligente, rápido e ágil'}, 76), weightKg: 81, heightCm: 178},
  mkPlayer('Juan King', 'WG', 80, {speed: 88, tackle: 82, stamina: 85, kicking: 32, vision: 35, positioning: 35, reception: 55}, {birthDate: '1997-12-06', note: 'ótima disposição, velocidade e tackles, não desiste da jogada', altPos: ['FB']}, 73),
  mkPlayer('Luis Guanes', 'WG', 78, {}, {birthDate: '1992-08-11', nickname: 'Lewis'}, 70),
  mkPlayer('Christian Daniel', 'WG', 64, {}, {nickname: 'Inge'}),

  // Fullback (ordem: Mussi, Arturo, Horacio, Julián, Kirichenko, King)
  mkPlayer('Arturo López', 'FB', 90, {}, {birthDate: '2000-09-14', nationalTeam: 'seleção adulta'}),
  mkPlayer('Horacio Agüero', 'FB', 78, {kicking: 84, reception: 85}, {birthDate: '1995-05-05', note: 'ótima leitura de jogo e bons chutes'}),
  mkPlayer('Ezequiel Rubin Ramirez', 'FB', 45, {}, {birthDate: '2002-10-23', trainingFrequency: 8, note: 'baixa frequência de treino; também joga de ponta', altPos: ['WG']}, 45),
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
const SANJOSE_ROSTER = [
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
  const sanjoseExtraUsed = new Set(SANJOSE_ROSTER.map(p => p.name));
  Object.entries({MS: 2, AP: 1, FB: 1}).forEach(([posId, count]) => {
    for (let i = 0; i < count; i++) {
      const name = randomName(sanjoseExtraRng, sanjoseExtraUsed);
      const variance = Math.floor(sanjoseExtraRng() * 16) - 8;
      const overall = Math.max(32, Math.min(96, 61 + variance));
      SANJOSE_ROSTER.push(mkPlayer(name, posId, overall, {}, {generated: true}));
    }
  });
}

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

const CURDA_STAFF = [
  {role: 'Presidente do Clube', name: 'Tío Nacho'},
  {role: 'Treinador Principal (Head Coach)', name: 'Lito Molina'},
  {role: 'Treinador Geral', name: 'Alexis Cibils'},
  {role: 'Preparador Físico', name: 'Osorio'},
  {role: 'Nutricionista', name: 'Cibils'},
  {role: 'Fisioterapeuta', name: 'Juan Carmona'},
  {role: 'Auxiliar Técnico', name: 'Sebas Bereta', note: 'assume o time B quando NEA e Paraguaio caem no mesmo dia em locais diferentes'},
  {role: 'Treinador das Categorias de Base', name: 'Dante Legui', note: 'comanda as categorias M18, M16, M15 e M14 do clube'},
  {role: 'Auxiliar', name: 'Facundo Rafael Navas'},
];

const CURNE_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Darío Meza'},
  {role: 'Preparador Físico', name: 'Coco Villagra'},
  {role: 'Fisioterapeuta', name: 'Ramona Sena'},
  {role: 'Auxiliar Técnico', name: 'Beto Franco', note: 'assume o time B quando NEA e Interior caem no mesmo dia em locais diferentes'},
];

const STAFF = {
  'ARG-CUR': CURDA_STAFF,
  'PAR-CUR': CURDA_STAFF,
  'ARG-CNE': CURNE_STAFF,
  'INT-CNE': CURNE_STAFF,
};

// Qualidade da comissão técnica: multiplica o ritmo de evolução dos
// atributos no treino (ver tickTraining em app.js). O Curda tem comissão
// toda avaliada como excelente, então evolui mais rápido; a do Curne é boa,
// mas não no mesmo nível.
const STAFF_QUALITY = {
  'ARG-CUR': 1.5,
  'PAR-CUR': 1.5,
  'ARG-CNE': 1.2,
  'INT-CNE': 1.2,
};

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
const YOUTH_BASE_RANGE = {M14: [28, 40], M15: [34, 46], M16: [42, 56], M18: [50, 66]};
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
  const base = min + Math.floor(Math.random() * (max - min + 1));
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

// Plantel inicial das 4 categorias, chamado uma vez ao começar um jogo novo
// como o Curda.
export function createInitialYouthAcademy() {
  const usedNames = new Set(BANNED_YOUTH_NAMES);
  const academy = {};
  YOUTH_CATEGORIES.forEach(cat => {
    academy[cat] = Array.from({length: YOUTH_SQUAD_SIZE}, () => generateYouthPlayer(cat, usedNames));
  });
  // Nacho Lopes: hooker destaque da M18, excelente determinação e ótimo
  // lançamento de lineout.
  academy.M18[0] = mkPlayer('Nacho Lopes', 'HK', 60, {determination: 88, lineoutThrow: 85}, {
    age: 'M18',
    potential: 'alto',
    note: 'Categoria M18 do Curda, sob comando de Dante Legui — ótimo lançamento de lineout e excelente determinação',
    youthCategory: 'M18',
  });
  // Maxi Doldán: segunda-línea da M18, boa qualidade — já debutou no time
  // titular mesmo seguindo na categoria de base.
  academy.M18[1] = mkPlayer('Maxi Doldán', 'SL', 63, {jump: 72, strength: 68}, {
    age: 'M18',
    potential: 'alto',
    note: 'Categoria M18 do Curda, sob comando de Dante Legui — já debutou no time titular por ter boa qualidade',
    youthCategory: 'M18',
  });
  return academy;
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

// ---- Seleção do Paraguai (Los Yacarés) -------------------------------------
// A seleção é a lista real e documentada de convocados (meta.nationalTeam),
// não um auto-pick pelos melhores overalls do país — um jogador pode ter
// nível de seleção (ex.: Álvaro Allo, Gonza Alvarado no Curda) e mesmo assim
// nunca ter sido convocado de fato. Por isso o pool junta só os jogadores
// tagueados como seleção em cada clube onde a Paraguay tem convocados: Curda,
// San José, Cristo Rey, Santa Clara (clubes paraguaios) e os expatriados que
// jogam em clubes argentinos mas defendem a seleção (Belgrano Athletic,
// Santa Fe, CAE, Champagnat). Ignacio "Nacho" Cuevas (Curda) é a exceção:
// recusa convocações pra se manter fiel só ao clube (meta.refusesNationalTeam),
// então nunca entra no pool mesmo sendo o melhor jogador do país. Jogadores
// estrangeiros recém-chegados (ex.: Paco Lamas, argentino) também ficam de
// fora até completarem os anos de residência exigidos (isNationalTeamEligible).
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
  ];
  const pool = clubs.flatMap(({roster, club}) => roster
    .filter(p => p.meta.nationalTeam && isNationalTeamEligible(p))
    .map(p => ({...p, meta: {...p.meta, clubOrigin: club}}))
  );

  const xv = pickStartingXV(pool).map(p => ({...p, condition: 100}));
  const usedIds = new Set(xv.map(p => p.id));
  const bench = pool
    .filter(p => !usedIds.has(p.id) && !p.meta.injuryWeeks)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8)
    .map(p => ({...p, condition: 100, status: 'reserva'}));

  return {xv, bench, pool};
}
