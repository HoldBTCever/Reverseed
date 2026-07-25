// Dados base: times do Campeonato do Nordeste Argentino (NEA) e geração de elencos.

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

export const TEAMS = [
  {id: 'TAR', name: 'Taraguy', color: '#2E7D32', attack: 72, defense: 70, stamina: 75},
  {id: 'ARA', name: 'Aranduroga', color: '#C62828', attack: 78, defense: 74, stamina: 80},
  {id: 'REG', name: 'Regatas', color: '#1565C0', attack: 84, defense: 82, stamina: 85},
  {id: 'CUR', name: 'Curda', color: '#F9A825', attack: 66, defense: 68, stamina: 70},
  {id: 'SNJ', name: 'San José', color: '#6A1B9A', attack: 70, defense: 72, stamina: 74},
  {id: 'SIX', name: 'Sixty', color: '#37474F', attack: 68, defense: 65, stamina: 72},
  {id: 'CAP', name: 'Capri', color: '#EF6C00', attack: 74, defense: 71, stamina: 76},
  {id: 'CNE', name: 'Curne', color: '#00838F', attack: 65, defense: 69, stamina: 71},
  {id: 'AGU', name: 'Aguará', color: '#558B2F', attack: 69, defense: 66, stamina: 73},
  {id: 'SNP', name: 'San Patricio', color: '#AD1457', attack: 71, defense: 73, stamina: 77},
];

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

export function generateSquad(team) {
  const rng = mulberry32(seedFromString(team.id));
  const usedNames = new Set();
  const players = POSITIONS.map((pos, idx) => {
    let name;
    do {
      const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      name = `${fn} ${ln}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const base = (team.attack + team.defense) / 2;
    const variance = Math.floor(rng() * 26) - 13;
    const rating = Math.max(45, Math.min(95, Math.round(base + variance)));
    return {
      id: `${team.id}-${idx}`,
      name,
      position: pos.label,
      posId: pos.id,
      group: pos.group,
      rating,
      number: idx + 1,
    };
  });
  return players;
}

export function teamOverall(players, group) {
  const filtered = group ? players.filter(p => p.group === group) : players;
  const sum = filtered.reduce((acc, p) => acc + p.rating, 0);
  return Math.round(sum / filtered.length);
}
