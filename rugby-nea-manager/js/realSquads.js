// Elencos reais (curados à mão), com nomes, apelidos, idade, seleção e
// lesões — usados no lugar da geração procedural para os clubes em que
// temos essa informação. Times sem entrada aqui continuam usando
// generateSquad() normalmente.

import {SKILL_PROFILES, SKILL_LABELS, genBiometrics, genTraits} from './data.js';

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
    meta: {...meta, traits},
  };
}

const CURDA_ROSTER = [
  mkPlayer('Agustín Dupuy', 'MS', 88, {}, {age: 19, potential: 'altíssimo', nationalTeam: 'seleção adulta', note: 'também joga de apertura'}),
  mkPlayer('Agustín Vázquez', 'SL', 76, {}, {nickname: 'Prolijo'}),
  mkPlayer('Alejo Centurión', 'HK', 78, {lineoutThrow: 90}, {age: 19, nationalTeam: 'seleção juvenil'}),
  mkPlayer('Álvaro Allo', 'AL', 78, {jump: 92}, {note: 'excelente no salto para o line-out'}),
  mkPlayer('Arturo López', 'FB', 87, {}, {nationalTeam: 'seleção adulta'}),
  mkPlayer('Camilo Orrego', 'AP', 76, {kicking: 85, strength: 78}, {note: 'melhor como centro (12/13), mais pesado; chuta bem'}),
  mkPlayer('Carlos Salta', 'PI', 68, {}, {note: 'natural de Salta'}),
  mkPlayer('Diego Miño', 'MS', 90, {pass: 95}, {nationalTeam: 'seleção do Paraguai adulta'}),
  mkPlayer('Facundo Paiva', 'WG', 88, {speed: 92}, {nationalTeam: 'seleção', note: 'um dos melhores jogadores do Curda'}),
  mkPlayer('Gianfranco Parodi', 'WG', 82, {}, {nationalTeam: 'seleção'}),
  mkPlayer('Horacio Agüero', 'FB', 78, {kicking: 84, reception: 85}, {note: 'ótima leitura de jogo e bons chutes'}),
  mkPlayer('Ignacio Cuevas', 'CE', 93, {pass: 92, reception: 90, tackle: 97, speed: 93, strength: 91, determination: 92}, {nickname: 'Nacho', captain: true, note: 'melhor jogador do Paraguai; forte, rápido e difícil de ser tackleado'}, 97),
  mkPlayer('Joaquim Mussi', 'FB', 90, {}, {nationalTeam: 'seleção', note: 'melhor fullback do time; também joga de apertura'}),
  mkPlayer('Martín Ayala', 'PI', 58, {}, {note: 'por vezes usado no time intermédio'}),
  mkPlayer('Lautaro', 'N8', 76, {pass: 85}, {note: 'ótima visão de jogo'}),
  mkPlayer('Mariano Garcete', 'SL', 91, {jump: 90, strength: 88, determination: 90}, {nationalTeam: 'ex-capitão da seleção do Paraguai', traits: ['packLeader']}),
  mkPlayer('Matías Ballasch', 'PI', 70, {}, {note: 'também joga de hooker'}),
  mkPlayer('Estefano Aranda', 'PI', 84, {}, {nationalTeam: 'seleção'}),
  mkPlayer('Martín Sitjar', 'PI', 74, {strength: 92}, {note: 'o jogador mais pesado do time'}),
  mkPlayer('Bruno Heisecke', 'SL', 68),
  mkPlayer('José Santacruz', 'PI', 66, {}, {nickname: 'Josechi'}),
  mkPlayer('Benjamín Micmacher', 'WG', 68),
  mkPlayer('Adolfo Jariton', 'PI', 66, {}, {note: 'também joga de hooker'}),
  mkPlayer('Marcos Riquelme', 'N8', 74, {}, {note: 'joga de 3ª línea, melhor como oitavo'}),
  mkPlayer('Benjamín Moratal', 'AP', 68, {}, {note: 'usado como 9 ou 10'}),
  mkPlayer('Julián Díaz', 'FB', 70, {}, {age: 'jovem', potential: 'muito alto', note: 'também joga de apertura'}),
  mkPlayer('Ignacio Murdoch', 'MS', 72),
  mkPlayer('Luciano Marsal', 'MS', 70),
  mkPlayer('Tiago Riveros', 'PI', 66, {}, {age: 'jovem', potential: 'alto'}),
  mkPlayer('Fábio Silva', 'HK', 60, {speed: 80, determination: 85, stamina: 70}, {note: 'o mais velho do elenco, mais dedicado porém com menor conhecimento; joga também de ponta por ser rápido'}),
  mkPlayer('Piacentini', 'PI', 56, {}, {note: 'pilar mediano'}),
  mkPlayer('Juan King', 'WG', 80, {speed: 88, tackle: 82, stamina: 85}, {note: 'ótima disposição, velocidade e tackles'}),
  mkPlayer('Luis Giménez', 'CE', 80, {}, {nickname: 'Luismi', note: 'também joga de ponta'}),
  mkPlayer('Franco Laterza', 'PI', 76, {}, {nationalTeam: 'seleção juvenil', note: 'também joga de hooker'}),
  mkPlayer('Sebas Benítez', 'SL', 64),
  mkPlayer('René Villar', 'SL', 64),
  mkPlayer('Elías Achon', 'AL', 76, {tackle: 86, stamina: 88}, {note: 'hooker ou 3ª línea, joga mais de 3ª; muito bom nos tackles e muita disposição física'}),
  mkPlayer('Nico Allo', 'CE', 66),
  mkPlayer('Diego Argaña', 'CE', 66),
  mkPlayer('Fernando Gracía', 'PI', 58, {}, {nickname: 'England', note: 'pilar mediano'}),
  mkPlayer('Maxi Doldan', 'SL', 64, {}, {age: 18, note: 'juvenil'}),
  mkPlayer('Elías Rodríguez', 'SL', 74, {strength: 82, speed: 76, determination: 88}, {note: 'muita garra, muito bom em quebrar tackles'}),
  mkPlayer('Nico Fenocchi', 'SL', 64),
  mkPlayer('Christian Daniel', 'WG', 64, {}, {nickname: 'Inge'}),
  mkPlayer('Marcelo Villaroel', 'CE', 66, {}, {nickname: 'Negro'}),
  mkPlayer('Sebas Urbieta', 'CE', 80, {}, {nationalTeam: 'seleção'}),
  mkPlayer('Mariano Segovia', 'SL', 64, {}, {nickname: 'Volei'}),
  mkPlayer('Lucas Otaño', 'HK', 72, {}, {injuryWeeks: 13, injuryLabel: '3 meses', traits: ['injuryProne']}),
  mkPlayer('Fernando Alvarado', 'MS', 80, {}, {nickname: 'Ferchu', age: 'jovem', potential: 'altíssimo', injuryWeeks: 26, injuryLabel: '6 meses'}),
  mkPlayer('Jean Paul Clemont', 'AL', 70, {}, {nickname: 'JP', injuryWeeks: 43, injuryLabel: '10 meses'}),
  mkPlayer('Joaquín Alzueta', 'AL', 68, {}, {nickname: 'Joaco', age: 'jovem', note: 'joga também de centro'}),
  mkPlayer('Vic Torres', 'AL', 61, {}, {age: 'jovem', note: 'joga também de ponta; costuma jogar no time intermédio, mas tem evoluído'}),
  mkPlayer('Gonza Alvarado', 'SL', 78, {jump: 91, lineoutThrow: 60}, {note: 'excelente no salto para o line-out, no estilo do Álvaro Allo', traits: ['lineoutSpecialist']}),
];

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
  mkPlayer('Agustín Benítez', 'PI', 75),
  mkPlayer('Rodolfo Rivadeneira', 'HK', 79),
  mkPlayer('Nahuel Kacerosky', 'SL', 80),
  mkPlayer('Ignacio Martínez', 'SL', 76),
  mkPlayer('Ariel Núñez', 'AL', 81),
  mkPlayer('Francisco Bareiro', 'AL', 77),
  mkPlayer('Mateo Rodríguez', 'N8', 82),
  mkPlayer('Gonzalo Bareiro', 'MS', 84),
  mkPlayer('Joaquín Lamas', 'AP', 86, {}, {note: 'possível parente de Paco Lamas'}),
  mkPlayer('Santiago Álvarez', 'WG', 83),
  mkPlayer('Thomas Guzmán', 'CE', 80),
  mkPlayer('Patricio Cabrera', 'CE', 78),
  mkPlayer('Juan Chilavert', 'WG', 82),
  mkPlayer('Santiago Espínola', 'FB', 79),
  // Convocados do NEA — banco
  mkPlayer('Emilio Gorostiaga', 'PI', 68),
  mkPlayer('César Pérez', 'PI', 67),
  mkPlayer('Enrique Quintero', 'HK', 70),
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
  mkPlayer('Carlos Martins', 'AL', 66),
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
  mkPlayer('Paco Lamas', 'FB', 88, {}, {captain: true, note: 'melhor jogador do San José'}, 90),
];

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

// O Curda é o mesmo clube nas duas ligas (disputa o NEA argentino e o
// campeonato paraguaio) — mesmo plantel em ambas. O San José também disputa
// as duas ligas ao mesmo tempo, com o mesmo plantel real dos dois lados.
// O Curne segue o mesmo padrão: disputa o NEA argentino e o Torneio do
// Interior (regional) com o mesmo plantel.
const REAL_SQUADS = {
  'ARG-CUR': CURDA_ROSTER,
  'PAR-CUR': CURDA_ROSTER,
  'ARG-SNJ': SANJOSE_ROSTER,
  'PAR-SNJ': SANJOSE_ROSTER,
  'ARG-CNE': CURNE_ROSTER,
  'INT-CNE': CURNE_ROSTER,
};

const CURDA_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Lito Molina'},
  {role: 'Treinador Geral', name: 'Alexis Cibils'},
  {role: 'Preparador Físico', name: 'Osorio'},
  {role: 'Nutricionista', name: 'Cibils'},
  {role: 'Fisioterapeuta', name: 'Juan Carmona'},
  {role: 'Auxiliar Técnico', name: 'Sebas Bereta', note: 'assume o time B quando NEA e Paraguaio caem no mesmo dia em locais diferentes'},
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

export function getRealRoster(teamId) {
  return REAL_SQUADS[teamId] || null;
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
export function pickStartingXV(roster, options = {}) {
  const conditionOf = options.conditionOf || (() => 100);
  const excludedIds = options.excludedIds || new Set();
  const metaOverrides = options.metaOverrides || {};
  const skillOverrides = options.skillOverrides || {};
  const effRating = p => p.rating * conditionMultiplier(conditionOf(p));

  const withMeta = roster.map(p => applyOverrides(p, metaOverrides, skillOverrides));
  const available = withMeta.filter(p => !p.meta.injuryWeeks && !excludedIds.has(p.id));
  const used = new Set();

  return XV_SLOTS.map((posId, idx) => {
    const group = POS_INFO[posId].group;
    let pool = available.filter(p => p.posId === posId && !used.has(p.id));
    if (!pool.length && FRONT_ROW.has(posId)) {
      // Sem especialista de primeira línea disponível: não improvisa com
      // jogador de outra posição, convoca um juvenil de emergência.
      const emergency = emergencyYouthPlayer(posId);
      used.add(emergency.id);
      return {...emergency, number: idx + 1, condition: 100};
    }
    // Salvaguarda: se faltar alguém na posição exata (fora da primeira
    // línea), prefere alguém da mesma linha (forward/back) antes de pegar
    // qualquer jogador disponível.
    if (!pool.length) pool = available.filter(p => p.group === group && !used.has(p.id));
    if (!pool.length) pool = available.filter(p => !used.has(p.id));
    const pick = pool.reduce((best, p) => (effRating(p) > effRating(best) ? p : best), pool[0]);
    used.add(pick.id);
    return {...pick, number: idx + 1, condition: conditionOf(pick)};
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
