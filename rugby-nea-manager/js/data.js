// Dados base: ligas, times e geração de elencos com skills detalhadas.

export const POSITIONS = [
  {id: 'PI', label: 'Pilar', group: 'forward'},
  {id: 'HK', label: 'Hooker', group: 'forward'},
  {id: 'PI', label: 'Pilar', group: 'forward'},
  {id: 'SL', label: 'Segunda Línea', group: 'forward'},
  {id: 'SL', label: 'Segunda Línea', group: 'forward'},
  {id: 'AL', label: 'Ala', group: 'forward'},
  {id: 'AL', label: 'Ala', group: 'forward'},
  {id: 'N8', label: 'Octavo', group: 'forward'},
  {id: 'MS', label: 'Medio Scrum', group: 'back'},
  {id: 'AP', label: 'Apertura', group: 'back'},
  {id: 'WG', label: 'Wing', group: 'back'},
  {id: 'CE', label: 'Centro', group: 'back'},
  {id: 'CE', label: 'Centro', group: 'back'},
  {id: 'WG', label: 'Wing', group: 'back'},
  {id: 'FB', label: 'Fullback', group: 'back'},
];

// Peso de cada skill por posição (0 = irrelevante, 1 = definidor da posição).
// Skills técnicas/físicas: pass (passe), reception (recepção), lineoutThrow
// (lançamento lateral), jump (salto), tackle (tackle), kicking (chute),
// speed (velocidade), strength (força). Skills físicas/mentais "estilo FM":
// stamina (resistência — quanto o jogador aguenta os 80 minutos e quão rápido
// se recupera entre partidas) e determination (determinação — resistência
// mental ao cansaço e menor risco de lesão por fadiga).
// Skills adicionais (técnicas, mentais/táticas e físicas): ruck (técnica de
// ruck/breakdown), turnover (jackal — roubo de bola no chão), scrum (técnica
// de scrum), dropGoal (precisão no chute de drop), sidestep (drible/mudança
// de direção), vision (visão de jogo), positioning (posicionamento), discipline
// (disciplina — menos faltas/cartões), leadership (liderança), composure
// (sangue-frio em momentos decisivos), agility (agilidade) e recovery
// (recuperação física entre fases de jogo, distinto de stamina que é
// resistência ao longo dos 80 minutos e entre partidas).
export const SKILL_PROFILES = {
  PI: {pass: 0.5, reception: 0.4, lineoutThrow: 0.3, jump: 0.4, tackle: 1.0, kicking: 0.2, speed: 0.4, strength: 1.2, stamina: 0.9, determination: 0.7,
    ruck: 0.8, turnover: 0.3, scrum: 1.3, dropGoal: 0.1, sidestep: 0.2, vision: 0.3, positioning: 0.5, discipline: 0.6, leadership: 0.4, composure: 0.4, agility: 0.4, recovery: 0.7},
  HK: {pass: 0.7, reception: 0.6, lineoutThrow: 1.3, jump: 0.5, tackle: 1.0, kicking: 0.2, speed: 0.4, strength: 1.0, stamina: 0.9, determination: 0.7,
    ruck: 0.8, turnover: 0.4, scrum: 1.1, dropGoal: 0.1, sidestep: 0.2, vision: 0.4, positioning: 0.5, discipline: 0.6, leadership: 0.5, composure: 0.4, agility: 0.4, recovery: 0.7},
  SL: {pass: 0.5, reception: 0.6, lineoutThrow: 0.4, jump: 1.3, tackle: 1.1, kicking: 0.2, speed: 0.4, strength: 1.15, stamina: 1.0, determination: 0.7,
    ruck: 0.9, turnover: 0.5, scrum: 1.0, dropGoal: 0.1, sidestep: 0.2, vision: 0.4, positioning: 0.6, discipline: 0.5, leadership: 0.5, composure: 0.4, agility: 0.4, recovery: 0.7},
  AL: {pass: 0.7, reception: 0.7, lineoutThrow: 0.4, jump: 0.6, tackle: 1.2, kicking: 0.3, speed: 0.7, strength: 1.0, stamina: 1.2, determination: 0.8,
    ruck: 1.2, turnover: 1.3, scrum: 0.6, dropGoal: 0.1, sidestep: 0.4, vision: 0.6, positioning: 0.7, discipline: 0.6, leadership: 0.5, composure: 0.5, agility: 0.8, recovery: 0.9},
  N8: {pass: 0.7, reception: 0.7, lineoutThrow: 0.5, jump: 0.7, tackle: 1.1, kicking: 0.3, speed: 0.7, strength: 1.15, stamina: 1.2, determination: 0.8,
    ruck: 1.1, turnover: 0.9, scrum: 0.7, dropGoal: 0.15, sidestep: 0.5, vision: 0.7, positioning: 0.7, discipline: 0.6, leadership: 0.6, composure: 0.5, agility: 0.7, recovery: 0.9},
  MS: {pass: 1.3, reception: 0.8, lineoutThrow: 0.2, jump: 0.2, tackle: 0.6, kicking: 0.8, speed: 0.7, strength: 0.4, stamina: 1.0, determination: 0.7,
    ruck: 0.7, turnover: 0.4, scrum: 0.3, dropGoal: 0.4, sidestep: 0.7, vision: 1.2, positioning: 0.9, discipline: 0.6, leadership: 0.7, composure: 0.7, agility: 0.9, recovery: 0.7},
  AP: {pass: 1.15, reception: 0.9, lineoutThrow: 0.2, jump: 0.2, tackle: 0.6, kicking: 1.3, speed: 0.7, strength: 0.4, stamina: 0.8, determination: 0.7,
    ruck: 0.4, turnover: 0.2, scrum: 0.2, dropGoal: 1.3, sidestep: 0.7, vision: 1.3, positioning: 1.0, discipline: 0.6, leadership: 0.8, composure: 1.1, agility: 0.8, recovery: 0.6},
  CE: {pass: 1.0, reception: 0.8, lineoutThrow: 0.2, jump: 0.3, tackle: 1.1, kicking: 0.6, speed: 1.0, strength: 0.7, stamina: 0.9, determination: 0.6,
    ruck: 0.5, turnover: 0.3, scrum: 0.2, dropGoal: 0.2, sidestep: 1.1, vision: 0.9, positioning: 0.8, discipline: 0.5, leadership: 0.6, composure: 0.7, agility: 0.9, recovery: 0.7},
  WG: {pass: 0.7, reception: 0.9, lineoutThrow: 0.2, jump: 0.4, tackle: 0.7, kicking: 0.4, speed: 1.3, strength: 0.5, stamina: 0.8, determination: 0.6,
    ruck: 0.3, turnover: 0.2, scrum: 0.1, dropGoal: 0.1, sidestep: 1.2, vision: 0.6, positioning: 0.7, discipline: 0.4, leadership: 0.4, composure: 0.6, agility: 1.1, recovery: 0.6},
  FB: {pass: 0.8, reception: 1.2, lineoutThrow: 0.2, jump: 0.5, tackle: 0.8, kicking: 1.0, speed: 1.0, strength: 0.5, stamina: 0.8, determination: 0.6,
    ruck: 0.3, turnover: 0.2, scrum: 0.1, dropGoal: 0.3, sidestep: 0.9, vision: 1.0, positioning: 0.9, discipline: 0.5, leadership: 0.5, composure: 0.8, agility: 0.9, recovery: 0.6},
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
  stamina: 'Resistência',
  determination: 'Determinação',
  ruck: 'Ruck',
  turnover: 'Jackal',
  scrum: 'Scrum',
  dropGoal: 'Drop Goal',
  sidestep: 'Drible',
  vision: 'Visão',
  positioning: 'Posicionamento',
  discipline: 'Disciplina',
  leadership: 'Liderança',
  composure: 'Compostura',
  agility: 'Agilidade',
  recovery: 'Recuperação',
};

// Categorias de atributos, usadas pra agrupar a exibição na tela de Elenco
// em vez de uma tabela única com 20+ colunas ilegíveis.
export const SKILL_CATEGORIES = {
  técnico: ['pass', 'reception', 'lineoutThrow', 'jump', 'tackle', 'kicking', 'ruck', 'turnover', 'scrum', 'dropGoal', 'sidestep'],
  mental: ['vision', 'positioning', 'discipline', 'leadership', 'composure', 'determination'],
  físico: ['speed', 'strength', 'stamina', 'agility', 'recovery'],
};

// Traits ocultos: sorteados na geração do jogador, dão personalidade e têm
// efeito mecânico real (ver engine.js / app.js).
export const TRAITS = {
  injuryProne: {label: 'Propenso a Lesões', chance: 0.10},
  lineoutSpecialist: {label: 'Especialista em Lineout', chance: 0.08},
  packLeader: {label: 'Líder de Pack', chance: 0.06},
};

// Faixas biométricas por posição (altura em cm, peso em kg) — não são notas
// de 1-99, são dados reais que dão sabor e alimentam levemente o scrum.
export const BIOMETRIC_RANGES = {
  PI: {heightCm: [172, 188], weightKg: [108, 128]},
  HK: {heightCm: [174, 186], weightKg: [98, 112]},
  SL: {heightCm: [194, 206], weightKg: [108, 122]},
  AL: {heightCm: [186, 196], weightKg: [98, 112]},
  N8: {heightCm: [188, 198], weightKg: [102, 116]},
  MS: {heightCm: [170, 180], weightKg: [75, 88]},
  AP: {heightCm: [176, 186], weightKg: [82, 94]},
  CE: {heightCm: [180, 190], weightKg: [88, 100]},
  WG: {heightCm: [176, 188], weightKg: [80, 92]},
  FB: {heightCm: [178, 188], weightKg: [84, 96]},
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
      // Curda, San José e Curne disputam duas competições com o MESMO
      // plantel — por isso usam o mesmo ataque/defesa/físico nas duas ligas
      // em que jogam (não faria sentido o mesmo time/jogadores render mais
      // ou menos força só por trocar de campeonato).
      team('ARG-TAR', 'Taraguy', '#1A1A1A', 86, 84, 86),
      team('ARG-ARA', 'Aranduroga', '#1A1A1A', 83, 81, 83),
      team('ARG-REG', 'Regatas', '#E53935', 67, 66, 69),
      team('ARG-CUR', 'Curda', '#F9A825', 82, 81, 80),
      team('ARG-SNJ', 'San José', '#0D47A1', 80, 79, 78),
      team('ARG-SIX', 'Sixty', '#4FC3F7', 64, 63, 66),
      team('ARG-CAP', 'Capri', '#C62828', 55, 54, 58),
      team('ARG-CNE', 'Curne', '#FFEB3B', 82, 81, 81),
      team('ARG-AGU', 'Aguará', '#64B5F6', 61, 60, 63),
      team('ARG-SNP', 'San Patricio', '#B71C1C', 79, 78, 80),
    ],
  },
  {
    id: 'paraguayo',
    name: 'URP',
    country: 'Paraguai',
    // Fase de grupos: os dois melhores de cada grupo avançam às semifinais.
    groups: {
      A: ['PAR-CUR', 'PAR-CRI', 'PAR-STC', 'PAR-VHA'],
      B: ['PAR-SNJ', 'PAR-LUQ', 'PAR-ASU', 'PAR-FDM'],
    },
    // Força real do campeonato paraguaio: Curda e San José seguem entre os
    // melhores do campeonato (mesmo ataque/defesa/físico que usam no NEA,
    // já que é o mesmo plantel); Luque e Santa Clara formam o segundo
    // escalão; Cristo Rey e Asunción vêm um pouco atrás disso; Villa Hayes e
    // Fernando de la Mora fecham a tabela.
    teams: [
      team('PAR-SNJ', 'San José', '#0D47A1', 80, 79, 78),
      team('PAR-CUR', 'Curda', '#F9A825', 82, 81, 80),
      team('PAR-STC', 'Santa Clara', '#1976D2', 79, 77, 78),
      team('PAR-LUQ', 'Luque', '#FBC02D', 79, 77, 78),
      team('PAR-ASU', 'Asunción', '#6D4C29', 71, 70, 73),
      team('PAR-VHA', 'Villa Hayes', '#2E7D32', 66, 64, 70),
      team('PAR-CRI', 'Cristo Rey', '#1B5E20', 71, 70, 73),
      team('PAR-FDM', 'Fernando de la Mora', '#D32F2F', 65, 63, 69),
    ],
  },
  {
    id: 'interior',
    name: 'Torneio do Interior',
    country: 'Argentina',
    // Torneo del Interior real (UAR): clubes de fora de Buenos Aires,
    // divididos em 4 zonas de 4 times — os dois melhores de cada zona
    // avançam às quartas de final (ver groupTerm/groups). Dentro de cada
    // zona, a ORDEM dos times já reflete a força real informada (1º = mais
    // forte), com uma diferença de nível pequena entre eles — não representa
    // um campeonato "fraco" tipo os times fictícios que existiam antes.
    // O Curne disputa o NEA argentino e este torneio ao mesmo tempo com o
    // MESMO plantel — por isso mantém o mesmo ataque/defesa/físico do NEA.
    groupTerm: 'Zona',
    groups: {
      A: ['INT-TUC', 'INT-GER', 'INT-MAR', 'INT-MDZ'],
      B: ['INT-TAL', 'INT-CAE', 'INT-URC', 'INT-CNE'],
      C: ['INT-SFE', 'INT-JCC', 'INT-CAT', 'INT-UNC'],
      D: ['INT-JCR', 'INT-DUE', 'INT-TAB', 'INT-OLD'],
    },
    teams: [
      // Zona 1
      team('INT-TUC', 'Tucumán Rugby', '#1B4332', 86, 84, 85),
      team('INT-GER', 'GER', '#0D3B66', 83, 81, 82),
      team('INT-MAR', 'Marista RC', '#C62828', 80, 78, 79),
      team('INT-MDZ', 'Mendoza RC', '#424242', 77, 75, 78),
      // Zona 2
      team('INT-TAL', 'Tala RC', '#0D3B66', 88, 86, 85),
      team('INT-CAE', 'Club Atlético Estudiantes', '#1A1A1A', 86, 84, 83),
      team('INT-URC', 'Uru Curé RC', '#0D1B4C', 84, 82, 82),
      team('INT-CNE', 'Curne', '#FFEB3B', 82, 81, 81),
      // Zona 3
      team('INT-SFE', 'Santa Fe Rugby', '#0D47A1', 88, 86, 85),
      team('INT-JCC', 'Jockey Club de Córdoba', '#C62828', 86, 84, 84),
      team('INT-CAT', 'Córdoba Athletic', '#0D1B4C', 84, 82, 83),
      team('INT-UNC', 'Universitario de Córdoba', '#C62828', 82, 80, 81),
      // Zona 4
      team('INT-JCR', 'Jockey Club de Rosario', '#1B4332', 90, 88, 87),
      team('INT-DUE', 'Duendes RC', '#2E7D32', 88, 86, 85),
      team('INT-TAB', 'La Tablada RC', '#C62828', 83, 81, 82),
      team('INT-OLD', 'Old Resian', '#C62828', 80, 78, 80),
    ],
  },
  {
    id: 'top14',
    name: 'Top 14 (URBA)',
    country: 'Argentina',
    // Campeonato de clubes de Buenos Aires (URBA) — os 14 clubes históricos
    // do Top 14 real, disputando turno e returno numa tabela só (como o
    // NEA); os 8 melhores avançam ao mata-mata (quartas/semi/final).
    teams: [
      team('BUE-SIC', 'San Isidro Club (SIC)', '#4FC3F7', 90, 88, 87),
      team('BUE-CAS', 'CASI', '#4FC3F7', 89, 87, 86),
      team('BUE-ALU', 'Alumni', '#C62828', 88, 86, 85),
      team('BUE-NEW', 'Newman', '#800020', 87, 85, 85),
      team('BUE-HIN', 'Hindú', '#4FC3F7', 86, 84, 84),
      team('BUE-BEL', 'Belgrano (BAC)', '#6D4C29', 85, 83, 83),
      team('BUE-RBV', 'Regatas Bella Vista (CRBV)', '#0D47A1', 84, 82, 82),
      team('BUE-CHA', 'Champagnat', '#0D3B66', 83, 81, 82),
      team('BUE-LPL', 'La Plata RC', '#0D3B66', 82, 80, 81),
      team('BUE-BAC', 'Buenos Aires (BACRC)', '#0D1B4C', 81, 79, 80),
      team('BUE-CUB', 'CUBA', '#0D1B4C', 80, 78, 79),
      team('BUE-CAR', 'Club Atlético del Rosario (CAR)', '#800020', 78, 76, 77),
      team('BUE-TIL', 'Los Tilos', '#81C784', 76, 74, 76),
      team('BUE-MAT', 'Los Matreros', '#C62828', 75, 73, 75),
    ],
  },
];

export const TEAMS = LEAGUES.flatMap(l => l.teams);

const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));

export function getTeam(id) {
  return teamById[id];
}

// Identidade de clube: cores (duas ou três, a `color` do time já é a
// primeira delas), mascote, apelido popular e sigla própria (`initials`,
// quando o clube usa uma diferente do código de 3 letras derivado do id) —
// só documentados pros clubes que o usuário confirmou; os demais seguem só
// com a cor única (`team.color`) que já tinham, sem crest de duas cores nem
// mascote/apelido/sigla inventados. Curda e San José entram duas vezes
// (ARG-* e PAR-*) porque disputam duas ligas com o MESMO clube/plantel — a
// identidade tem que ser idêntica nas duas.
export const TEAM_IDENTITY = {
  'ARG-CUR': {colors: ['#F9A825', '#1A1A1A'], mascotEmoji: '🦉', mascotName: {es: 'El Búho', pt: 'A Coruja'}, nickname: {es: 'El Tractor Amarillo', pt: 'O Trator Amarelo'}},
  'PAR-CUR': {colors: ['#F9A825', '#1A1A1A'], mascotEmoji: '🦉', mascotName: {es: 'El Búho', pt: 'A Coruja'}, nickname: {es: 'El Tractor Amarillo', pt: 'O Trator Amarelo'}},
  'ARG-AGU': {colors: ['#64B5F6', '#0D1B4C'], mascotEmoji: '🐻', mascotName: {es: 'El Oso', pt: 'O Urso'}},
  'ARG-SNJ': {colors: ['#0D47A1', '#FFFFFF'], mascotEmoji: '🐶', mascotName: {es: 'El Bulldog', pt: 'O Bulldog'}},
  'PAR-SNJ': {colors: ['#0D47A1', '#FFFFFF'], mascotEmoji: '🐶', mascotName: {es: 'El Bulldog', pt: 'O Bulldog'}},
  'PAR-ASU': {colors: ['#6D4C29', '#F9A825']},
  'PAR-CRI': {colors: ['#1B5E20', '#1A1A1A'], mascotEmoji: '🦤', mascotName: {es: 'El Avestruz', pt: 'O Avestruz'}},
  'PAR-STC': {colors: ['#1976D2', '#1A1A1A'], mascotEmoji: '🦏', mascotName: {es: 'El Rinoceronte', pt: 'O Rinoceronte'}},
  'PAR-LUQ': {colors: ['#FBC02D', '#6D4C29'], mascotEmoji: '🐷', mascotName: {es: 'El Chancho', pt: 'O Porco'}},
  'ARG-TAR': {colors: ['#1A1A1A', '#FFFFFF'], mascotEmoji: '🐊', mascotName: {es: 'El Yacaré', pt: 'O Jacaré'}},
  'ARG-ARA': {colors: ['#1A1A1A', '#FFFFFF'], mascotEmoji: '🦓', mascotName: {es: 'La Cebra', pt: 'A Zebra'}},
  'ARG-SIX': {colors: ['#4FC3F7', '#FFFFFF'], mascotEmoji: '🦌', mascotName: {es: 'El Ciervo', pt: 'O Veado'}},
  'ARG-CAP': {colors: ['#C62828', '#FFFFFF']},
  'ARG-CNE': {colors: ['#FFEB3B', '#FFFFFF']},
  'INT-CNE': {colors: ['#FFEB3B', '#FFFFFF']},
  'ARG-SNP': {colors: ['#B71C1C', '#1A1A1A']},
  'PAR-FDM': {colors: ['#D32F2F', '#F9A825', '#1A1A1A'], mascotEmoji: '🐃', mascotName: {es: 'El Búfalo', pt: 'O Búfalo'}},
  'PAR-VHA': {colors: ['#2E7D32', '#FFFFFF']},
  'ARG-REG': {colors: ['#E53935', '#FFFFFF'], initials: 'CRR'},
  // Zona 1
  'INT-TUC': {colors: ['#1B4332', '#1A1A1A']},
  'INT-GER': {colors: ['#0D3B66', '#FBC02D']},
  'INT-MAR': {colors: ['#FFFFFF', '#C62828', '#0D1B4C']},
  // Mendoza RC só tem branco como cor real — textColor é só uma necessidade
  // prática de legibilidade (número/sigla branca não pode ficar sobre fundo
  // branco), não representa uma segunda cor de identidade inventada.
  'INT-MDZ': {colors: ['#FFFFFF'], textColor: '#1A1A1A', mascotEmoji: '🐰', mascotName: {es: 'El Conejo', pt: 'O Coelho'}},
  // Zona 2
  'INT-TAL': {colors: ['#0D3B66', '#FFFFFF']},
  'INT-CAE': {colors: ['#1A1A1A', '#FFFFFF', '#FBC02D']},
  'INT-URC': {colors: ['#0D1B4C', '#757575']},
  // Zona 3
  'INT-SFE': {colors: ['#FFFFFF', '#C62828', '#0D47A1']},
  'INT-JCC': {colors: ['#C62828', '#FFFFFF'], mascotEmoji: '🐴', mascotName: {es: 'El Caballo', pt: 'O Cavalo'}},
  'INT-CAT': {colors: ['#0D1B4C', '#C62828']},
  'INT-UNC': {colors: ['#C62828', '#FFFFFF']},
  // Zona 4
  'INT-JCR': {colors: ['#1B4332', '#FFFFFF'], mascotEmoji: '🐴', mascotName: {es: 'El Caballo', pt: 'O Cavalo'}},
  'INT-DUE': {colors: ['#2E7D32', '#1A1A1A'], mascotEmoji: '👻', mascotName: {es: 'El Fantasma', pt: 'O Fantasma'}},
  'INT-TAB': {colors: ['#C62828', '#0D1B4C']},
  'INT-OLD': {colors: ['#C62828', '#FFFFFF', '#0D1B4C']},
  // Top 14 (URBA)
  'BUE-CAS': {colors: ['#4FC3F7', '#FFFFFF'], initials: 'CASI'},
  'BUE-SIC': {colors: ['#4FC3F7', '#FFFFFF', '#1A1A1A'], initials: 'SIC'},
  'BUE-BAC': {colors: ['#0D1B4C', '#C62828'], initials: 'BACRC'},
  'BUE-HIN': {colors: ['#4FC3F7', '#FBC02D']},
  'BUE-NEW': {colors: ['#800020', '#D4AF37'], mascotEmoji: '🦁', mascotName: {es: 'El León', pt: 'O Leão'}},
  'BUE-ALU': {colors: ['#C62828', '#FFFFFF', '#1A1A1A'], initials: 'A.A'},
  'BUE-CUB': {colors: ['#FFFFFF', '#0D1B4C', '#1A1A1A'], initials: 'CUBA'},
  'BUE-CAR': {colors: ['#800020', '#4FC3F7'], initials: 'CAR'},
  'BUE-LPL': {colors: ['#0D3B66', '#FBC02D']},
  'BUE-CHA': {colors: ['#0D3B66', '#FFFFFF', '#D4AF37']},
  'BUE-RBV': {colors: ['#0D47A1', '#FBC02D'], initials: 'CRBV'},
  'BUE-BEL': {colors: ['#6D4C29', '#F9A825'], initials: 'BAC'},
  'BUE-TIL': {colors: ['#81C784', '#FBC02D'], initials: 'LT'},
  'BUE-MAT': {colors: ['#C62828', '#FFFFFF'], initials: 'RCLM'},
};

export function teamIdentity(teamId) {
  return TEAM_IDENTITY[teamId] || null;
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

// Altura/peso reais (não são notas 1-99) sorteados dentro da faixa típica da
// posição, e traits ocultos (ver TRAITS) sorteados independentemente.
export function genBiometrics(rng, posId) {
  const range = BIOMETRIC_RANGES[posId];
  const heightCm = Math.round(range.heightCm[0] + rng() * (range.heightCm[1] - range.heightCm[0]));
  const weightKg = Math.round(range.weightKg[0] + rng() * (range.weightKg[1] - range.weightKg[0]));
  return {heightCm, weightKg};
}

// packLeader e lineoutSpecialist só fazem sentido narrativo pra forwards
// (quem disputa lineout e lidera o pack); backs só concorrem a injuryProne.
const FORWARD_ONLY_TRAITS = new Set(['lineoutSpecialist', 'packLeader']);

export function genTraits(rng, group) {
  const traits = [];
  Object.entries(TRAITS).forEach(([key, def]) => {
    if (FORWARD_ONLY_TRAITS.has(key) && group !== 'forward') return;
    if (rng() < def.chance) traits.push(key);
  });
  return traits;
}

// Sorteia "Nome Sobrenome" a partir dos bancos de nomes genéricos (rioplatenses),
// evitando repetir um nome já usado no mesmo lote (usedNames é opcional).
export function randomName(rng, usedNames) {
  let name;
  do {
    const fn = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    name = `${fn} ${ln}`;
  } while (usedNames && usedNames.has(name));
  if (usedNames) usedNames.add(name);
  return name;
}

export function generateSquad(team) {
  const rng = mulberry32(seedFromString(team.id));
  const usedNames = new Set();
  const base = (team.attack + team.defense + team.stamina) / 3;

  const players = POSITIONS.map((pos, idx) => {
    const name = randomName(rng, usedNames);
    const profile = SKILL_PROFILES[pos.id];
    const skills = {};
    SKILL_KEYS.forEach(k => {
      skills[k] = genSkill(rng, base, profile[k]);
    });
    const overall = computeOverall(skills, profile);
    const {heightCm, weightKg} = genBiometrics(rng, pos.id);
    const traits = genTraits(rng, pos.group);

    return {
      id: `${team.id}-${idx}`,
      name,
      position: pos.label,
      posId: pos.id,
      group: pos.group,
      skills,
      rating: overall,
      number: idx + 1,
      heightCm,
      weightKg,
      meta: {traits},
    };
  });

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
