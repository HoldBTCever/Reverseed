// Elencos reais (curados à mão), com nomes, apelidos, idade, seleção e
// lesões — usados no lugar da geração procedural para os clubes em que
// temos essa informação. Times sem entrada aqui continuam usando
// generateSquad() normalmente.

import {SKILL_PROFILES, SKILL_LABELS} from './data.js';

const SKILL_KEYS = Object.keys(SKILL_LABELS);

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
const XV_SLOTS = ['PI', 'PI', 'HK', 'SL', 'SL', 'AL', 'AL', 'N8', 'MS', 'AP', 'WG', 'CE', 'CE', 'WG', 'FB'];

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

  return {
    id: `real-${autoId++}`,
    name,
    position: POS_INFO[posId].label,
    posId,
    group: POS_INFO[posId].group,
    skills,
    rating: overallOverride != null ? overallOverride : computeOverall(skills, profile),
    number: null,
    meta,
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
  mkPlayer('Facundo Navas', 'WG', 88, {speed: 92}, {nationalTeam: 'seleção', note: 'um dos melhores jogadores do Curda'}),
  mkPlayer('Gianfranco Parodi', 'WG', 82, {}, {nationalTeam: 'seleção'}),
  mkPlayer('Horacio Agüero', 'FB', 78, {kicking: 84, reception: 85}, {note: 'ótima leitura de jogo e bons chutes'}),
  mkPlayer('Ignacio Cuevas', 'CE', 93, {pass: 92, reception: 90, tackle: 97, speed: 93, strength: 91}, {nickname: 'Nacho', captain: true, note: 'melhor jogador do Paraguai; forte, rápido e difícil de ser tackleado'}, 97),
  mkPlayer('Joaquim Mussi', 'FB', 90, {}, {nationalTeam: 'seleção', note: 'melhor fullback do time; também joga de apertura'}),
  mkPlayer('Martín Ayala', 'PI', 58, {}, {note: 'por vezes usado no time intermédio'}),
  mkPlayer('Lautaro', 'N8', 76, {pass: 85}, {note: 'ótima visão de jogo'}),
  mkPlayer('Mariano Garcete', 'SL', 91, {jump: 90, strength: 88}, {nationalTeam: 'ex-capitão da seleção do Paraguai'}),
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
  mkPlayer('Fábio Silva', 'HK', 60, {speed: 80}, {note: 'o mais velho do elenco, mais dedicado porém com menor conhecimento; joga também de ponta por ser rápido'}),
  mkPlayer('Piacentini', 'PI', 56, {}, {note: 'pilar mediano'}),
  mkPlayer('Juan King', 'WG', 80, {speed: 88, tackle: 82}, {note: 'ótima disposição, velocidade e tackles'}),
  mkPlayer('Luis Giménez', 'CE', 80, {}, {nickname: 'Luismi', note: 'também joga de ponta'}),
  mkPlayer('Franco Laterza', 'PI', 76, {}, {nationalTeam: 'seleção juvenil', note: 'também joga de hooker'}),
  mkPlayer('Sebas Benítez', 'SL', 64),
  mkPlayer('René Villar', 'SL', 64),
  mkPlayer('Elías Achon', 'AL', 76, {tackle: 86}, {note: 'hooker ou 3ª línea, joga mais de 3ª; muito bom nos tackles e muita disposição física'}),
  mkPlayer('Nico Allo', 'CE', 66),
  mkPlayer('Diego Argaña', 'CE', 66),
  mkPlayer('Fernando Gracía', 'PI', 58, {}, {nickname: 'England', note: 'pilar mediano'}),
  mkPlayer('Maxi Doldan', 'SL', 64, {}, {age: 18, note: 'juvenil'}),
  mkPlayer('Elías Rodríguez', 'SL', 74, {strength: 82, speed: 76}, {note: 'muita garra, muito bom em quebrar tackles'}),
  mkPlayer('Nico Fenocchi', 'SL', 64),
  mkPlayer('Christian Daniel', 'WG', 64, {}, {nickname: 'Inge'}),
  mkPlayer('Marcelo Villaroel', 'CE', 66, {}, {nickname: 'Negro'}),
  mkPlayer('Sebas Urbieta', 'CE', 80, {}, {nationalTeam: 'seleção'}),
  mkPlayer('Mariano Segovia', 'SL', 64, {}, {nickname: 'Volei'}),
  mkPlayer('Lucas Otaño', 'HK', 72, {}, {injuryWeeks: 13, injuryLabel: '3 meses'}),
  mkPlayer('Fernando Alvarado', 'MS', 80, {}, {nickname: 'Ferchu', age: 'jovem', potential: 'altíssimo', injuryWeeks: 26, injuryLabel: '6 meses'}),
  mkPlayer('Jean Paul Clemont', 'AL', 70, {}, {nickname: 'JP', injuryWeeks: 43, injuryLabel: '10 meses'}),
  mkPlayer('Joaquín Alzueta', 'AL', 68, {}, {nickname: 'Joaco', age: 'jovem', note: 'joga também de centro'}),
  mkPlayer('Vic Torres', 'AL', 61, {}, {age: 'jovem', note: 'joga também de ponta; costuma jogar no time intermédio, mas tem evoluído'}),
];

// O Curda é o mesmo clube nas duas ligas (disputa o NEA argentino e o
// campeonato paraguaio) — mesmo plantel em ambas.
const REAL_SQUADS = {
  'ARG-CUR': CURDA_ROSTER,
  'PAR-CUR': CURDA_ROSTER,
};

const CURDA_STAFF = [
  {role: 'Treinador Principal (Head Coach)', name: 'Lito Molina'},
  {role: 'Treinador Geral', name: 'Alexis Cibils'},
  {role: 'Preparador Físico', name: 'Osorio'},
  {role: 'Nutricionista', name: 'Cibils'},
  {role: 'Fisioterapeuta', name: 'Juan Carmona'},
];

const STAFF = {
  'ARG-CUR': CURDA_STAFF,
  'PAR-CUR': CURDA_STAFF,
};

export function getRealRoster(teamId) {
  return REAL_SQUADS[teamId] || null;
}

export function getStaff(teamId) {
  return STAFF[teamId] || null;
}

// Clubes que disputam duas ligas ao mesmo tempo (mesmo elenco, calendários
// independentes) — ex.: o Curda joga o NEA argentino e o campeonato
// paraguaio simultaneamente, por isso o plantel tão grande.
const DUAL_CLUBS = {
  'ARG-CUR': 'PAR-CUR',
  'PAR-CUR': 'ARG-CUR',
};

export function getDualPartner(teamId) {
  return DUAL_CLUBS[teamId] || null;
}

const FATIGUE_PENALTY = 12;

// Escolhe os 15 titulares (melhor jogador disponível por posição, excluindo
// lesionados), numerados na convenção tradicional 1-15. fatiguedIds (Set de
// ids) representa jogadores que acabaram de jogar no outro torneio do clube
// há pouco tempo: sofrem uma penalidade só para fins de escalação, o que
// incentiva rodízio de elenco em vez de escalar sempre os 15 melhores.
export function pickStartingXV(roster, fatiguedIds) {
  const fatigued = fatiguedIds || new Set();
  const effRating = p => p.rating - (fatigued.has(p.id) ? FATIGUE_PENALTY : 0);
  const available = roster.filter(p => !p.meta.injuryWeeks);
  const used = new Set();

  return XV_SLOTS.map((posId, idx) => {
    const group = POS_INFO[posId].group;
    let pool = available.filter(p => p.posId === posId && !used.has(p.id));
    // Salvaguarda: se faltar alguém na posição exata, prefere alguém da
    // mesma linha (forward/back) antes de pegar qualquer jogador disponível.
    if (!pool.length) pool = available.filter(p => p.group === group && !used.has(p.id));
    if (!pool.length) pool = available.filter(p => !used.has(p.id));
    const pick = pool.reduce((best, p) => (effRating(p) > effRating(best) ? p : best), pool[0]);
    used.add(pick.id);
    return {...pick, number: idx + 1, fatigued: fatigued.has(pick.id)};
  });
}

// Plantel completo com status (titular/reserva/lesionado), para a tela de Elenco.
export function rosterWithStatus(teamId, fatiguedIds) {
  const roster = getRealRoster(teamId);
  if (!roster) return null;
  const xv = pickStartingXV(roster, fatiguedIds);
  const numberById = Object.fromEntries(xv.map(p => [p.id, p.number]));
  const fatigued = fatiguedIds || new Set();

  return [...roster]
    .sort((a, b) => b.rating - a.rating)
    .map(p => ({
      ...p,
      number: numberById[p.id] || null,
      status: p.meta.injuryWeeks ? 'lesionado' : (numberById[p.id] ? 'titular' : 'reserva'),
      fatigued: fatigued.has(p.id),
    }));
}
