// Dados base: ligas, times e geração de elencos com skills detalhadas.

export const POSITIONS = [
  {id: 'PI', label: 'Pilar', group: 'forward'},
  {id: 'PI', label: 'Pilar', group: 'forward'},
  {id: 'HK', label: 'Hooker', group: 'forward'},
  {id: 'SL', label: 'Segunda Línea', group: 'forward'},
  {id: 'SL', label: 'Segunda Línea', group: 'forward'},
  {id: 'AL', label: 'Ala', group: 'forward'},
  {id: 'AL', label: 'Ala', group: 'forward'},
  {id: 'N8', label: 'Octavo', group: 'forward'},
  {id: 'MS', label: 'Medio Scrum', group: 'back'},
  {id: 'AP', label: 'Apertura', group: 'back'},
  {id: 'CE', label: 'Centro', group: 'back'},
  {id: 'CE', label: 'Centro', group: 'back'},
  {id: 'WG', label: 'Wing', group: 'back'},
  {id: 'WG', label: 'Wing', group: 'back'},
  {id: 'FB', label: 'Fullback', group: 'back'},
];

// Peso de cada skill por posição (0 = irrelevante, 1 = definidor da posição).
// Skills: pass (passe), reception (recepção), lineoutThrow (lançamento lateral),
// jump (salto), tackle (tackle), kicking (chute), speed (velocidade), strength (força).
export const SKILL_PROFILES = {
  PI: {pass: 0.5, reception: 0.4, lineoutThrow: 0.3, jump: 0.4, tackle: 1.0, kicking: 0.2, speed: 0.4, strength: 1.2},
  HK: {pass: 0.7, reception: 0.6, lineoutThrow: 1.3, jump: 0.5, tackle: 1.0, kicking: 0.2, speed: 0.4, strength: 1.0},
  SL: {pass: 0.5, reception: 0.6, lineoutThrow: 0.4, jump: 1.3, tackle: 1.1, kicking: 0.2, speed: 0.4, strength: 1.15},
  AL: {pass: 0.7, reception: 0.7, lineoutThrow: 0.4, jump: 0.6, tackle: 1.2, kicking: 0.3, speed: 0.7, strength: 1.0},
  N8: {pass: 0.7, reception: 0.7, lineoutThrow: 0.5, jump: 0.7, tackle: 1.1, kicking: 0.3, speed: 0.7, strength: 1.15},
  MS: {pass: 1.3, reception: 0.8, lineoutThrow: 0.2, jump: 0.2, tackle: 0.6, kicking: 0.8, speed: 0.7, strength: 0.4},
  AP: {pass: 1.15, reception: 0.9, lineoutThrow: 0.2, jump: 0.2, tackle: 0.6, kicking: 1.3, speed: 0.7, strength: 0.4},
  CE: {pass: 1.0, reception: 0.8, lineoutThrow: 0.2, jump: 0.3, tackle: 1.1, kicking: 0.6, speed: 1.0, strength: 0.7},
  WG: {pass: 0.7, reception: 0.9, lineoutThrow: 0.2, jump: 0.4, tackle: 0.7, kicking: 0.4, speed: 1.3, strength: 0.5},
  FB: {pass: 0.8, reception: 1.2, lineoutThrow: 0.2, jump: 0.5, tackle: 0.8, kicking: 1.0, speed: 1.0, strength: 0.5},
};

export const SKILL_LABELS = {
  pass: 'Passe',
  reception: 'Recepção',
  lineoutThrow: 'Lateral',
  jump: 'Salto',
  tackle: 'Tackle',
  kicking: 'Chute',
  speed: 'Velocidade',
  strength: 'Força',
};

function team(id, name, color, attack, defense, stamina) {
  return {id, name, color, attack, defense, stamina};
}

export const LEAGUES = [
  {
    id: 'nea',
    name: 'Campeonato do Nordeste Argentino (NEA)',
    country: 'Argentina',
    teams: [
      // Ataque/defesa/físico seguem a força real dos clubes na tabela do NEA
      // (Taraguy o mais forte, Capri o mais fraco). A ordem do array em si
      // NÃO pode mudar: ela define o calendário usado por seedNea.js.
      team('ARG-TAR', 'Taraguy', '#2E7D32', 86, 84, 86),
      team('ARG-ARA', 'Aranduroga', '#C62828', 83, 81, 83),
      team('ARG-REG', 'Regatas', '#1565C0', 67, 66, 69),
      team('ARG-CUR', 'Curda', '#F9A825', 73, 72, 75),
      team('ARG-SNJ', 'San José', '#6A1B9A', 70, 69, 72),
      team('ARG-SIX', 'Sixty', '#37474F', 64, 63, 66),
      team('ARG-CAP', 'Capri', '#EF6C00', 55, 54, 58),
      team('ARG-CNE', 'Curne', '#00838F', 76, 75, 77),
      team('ARG-AGU', 'Aguará', '#558B2F', 61, 60, 63),
      team('ARG-SNP', 'San Patricio', '#AD1457', 79, 78, 80),
    ],
  },
  {
    id: 'paraguayo',
    name: 'Campeonato Paraguaio',
    country: 'Paraguai',
    teams: [
      team('PAR-SNJ', 'San José', '#D32F2F', 73, 71, 75),
      team('PAR-CUR', 'Curda', '#FBC02D', 67, 69, 71),
      team('PAR-STC', 'Santa Clara', '#1976D2', 76, 75, 78),
      team('PAR-LUQ', 'Luque', '#7B1FA2', 71, 70, 74),
      team('PAR-ASU', 'Asunción', '#00695C', 80, 78, 82),
      team('PAR-AR1', 'Área 1', '#455A64', 69, 67, 72),
      team('PAR-CRI', 'Cristo Rey', '#8D6E63', 68, 72, 73),
      team('PAR-FDM', 'Fernando de la Mora', '#C2185B', 72, 69, 76),
    ],
  },
];

export const TEAMS = LEAGUES.flatMap(l => l.teams);

// Craques conhecidos de alguns clubes: substituem o nome do jogador de maior
// overall gerado para o time, mantendo posição e atributos.
const STAR_PLAYERS = {
  'ARG-CUR': 'Ignacio Cuevas',
  'ARG-SNJ': 'Paco Lamas',
};

const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));

export function getTeam(id) {
  return teamById[id];
}

export function leagueOfTeam(teamId) {
  return LEAGUES.find(l => l.teams.some(t => t.id === teamId));
}

const FIRST_NAMES = [
  'Facundo', 'Santiago', 'Mateo', 'Joaquín', 'Bautista', 'Lautaro', 'Tomás', 'Nicolás',
  'Agustín', 'Franco', 'Ignacio', 'Emiliano', 'Gonzalo', 'Federico', 'Rodrigo', 'Martín',
  'Pedro', 'Julián', 'Benjamín', 'Ramiro', 'Valentín', 'Cruz', 'Ezequiel', 'Bruno',
  'Marcos', 'Diego', 'Lucas', 'Maximiliano', 'Sebastián', 'Alejo',
];

const LAST_NAMES = [
  'González', 'Rodríguez', 'Fernández', 'Gómez', 'Díaz', 'Álvarez', 'Romero', 'Sosa',
  'Acosta', 'Benítez', 'Medina', 'Herrera', 'Aguirre', 'Ojeda', 'Cardozo', 'Ibáñez',
  'Duarte', 'Ayala', 'Ferreyra', 'Coronel', 'Villalba', 'Maidana', 'Zayas', 'Britez',
  'Melgarejo', 'Vallejos', 'Insaurralde', 'Escobar', 'Leguizamón', 'Toledo',
];

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

const SKILL_KEYS = Object.keys(SKILL_LABELS);

function genSkill(rng, base, weight) {
  // weight ~0.2 (irrelevante) a ~1.3 (definidor da posição)
  const scaled = base * (0.55 + weight * 0.45);
  const variance = Math.floor(rng() * 18) - 9;
  return Math.max(35, Math.min(99, Math.round(scaled + variance)));
}

function computeOverall(skills, profile) {
  let sum = 0;
  let weightSum = 0;
  SKILL_KEYS.forEach(k => {
    const w = profile[k];
    sum += skills[k] * w;
    weightSum += w;
  });
  return Math.round(sum / weightSum);
}

export function generateSquad(team) {
  const rng = mulberry32(seedFromString(team.id));
  const usedNames = new Set();
  const base = (team.attack + team.defense + team.stamina) / 3;

  const players = POSITIONS.map((pos, idx) => {
    let name;
    do {
      const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      name = `${fn} ${ln}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const profile = SKILL_PROFILES[pos.id];
    const skills = {};
    SKILL_KEYS.forEach(k => {
      skills[k] = genSkill(rng, base, profile[k]);
    });
    const overall = computeOverall(skills, profile);

    return {
      id: `${team.id}-${idx}`,
      name,
      position: pos.label,
      posId: pos.id,
      group: pos.group,
      skills,
      rating: overall,
      number: idx + 1,
    };
  });

  const starName = STAR_PLAYERS[team.id];
  if (starName) {
    const star = players.reduce((best, p) => (p.rating > best.rating ? p : best), players[0]);
    star.name = starName;
  }

  return players;
}

export function teamOverall(players, group) {
  const filtered = group ? players.filter(p => p.group === group) : players;
  const sum = filtered.reduce((acc, p) => acc + p.rating, 0);
  return Math.round(sum / filtered.length);
}

export function teamSkillAvg(players, skillKey, group) {
  const filtered = group ? players.filter(p => p.group === group) : players;
  const sum = filtered.reduce((acc, p) => acc + p.skills[skillKey], 0);
  return sum / filtered.length;
}
