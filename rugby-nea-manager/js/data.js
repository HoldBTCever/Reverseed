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

// Tipos de treino (exercícios reais de clube), cada um trabalhando um
// conjunto de atributos relacionados ao mesmo tempo — em vez do técnico
// escolher atributos soltos, ele escolhe QUE TIPO de treino roda em cada dia
// (ver renderTrainingFocusHtml/tickTraining em app.js). Todo atributo
// aparece em pelo menos um tipo.
export const TRAINING_TYPES = {
  duelo: {label: 'Duelo', skills: ['vision', 'pass', 'reception', 'speed']},
  tocata: {label: 'Tocata', skills: ['stamina', 'positioning', 'vision', 'pass']},
  contato: {label: 'Contato', skills: ['tackle', 'ruck', 'turnover', 'strength']},
  formacao: {label: 'Formação (scrum/maul)', skills: ['scrum', 'strength', 'discipline', 'positioning']},
  touch: {label: 'Touch (line-out)', skills: ['lineoutThrow', 'jump', 'strength', 'positioning']},
  pique: {label: 'Pique', skills: ['speed', 'agility', 'stamina', 'recovery']},
  chuteAGol: {label: 'Chute a gol', skills: ['kicking', 'dropGoal', 'composure', 'positioning']},
  quebraDeLinha: {label: 'Quebra de linha', skills: ['sidestep', 'agility', 'speed', 'vision']},
  lideranca: {label: 'Liderança', skills: ['leadership', 'discipline', 'composure', 'determination']},
  recuperacao: {label: 'Recuperação', skills: ['recovery', 'stamina', 'discipline']},
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
// Escudos oficiais em base64 (PNG/JPEG redimensionados p/ ~200px) — só os
// clubes cujo brasão o usuário enviou; os demais seguem sem  e caem
// no crest CSS com mascote/sigla (ver crestContent em app.js).
const LOGO_CURDA = 'data:image/png;base64,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';
const LOGO_SAN_PATRICIO = 'data:image/jpeg;base64,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';

export const TEAM_IDENTITY = {
  'ARG-CUR': {colors: ['#F9A825', '#1A1A1A'], logo: LOGO_CURDA, mascotEmoji: '🦉', mascotName: {es: 'El Búho', pt: 'A Coruja'}, nickname: {es: 'El Tractor Amarillo', pt: 'O Trator Amarelo'}},
  'PAR-CUR': {colors: ['#F9A825', '#1A1A1A'], logo: LOGO_CURDA, mascotEmoji: '🦉', mascotName: {es: 'El Búho', pt: 'A Coruja'}, nickname: {es: 'El Tractor Amarillo', pt: 'O Trator Amarelo'}},
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
  'ARG-SNP': {colors: ['#B71C1C', '#1A1A1A'], logo: LOGO_SAN_PATRICIO},
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
