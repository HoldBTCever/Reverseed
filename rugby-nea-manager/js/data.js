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
const LOGO_CURDA = 'data:image/jpeg;base64,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';
const LOGO_ARANDUROGA = 'data:image/jpeg;base64,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';
const LOGO_DUENDES = 'data:image/png;base64,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';
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
  'ARG-ARA': {colors: ['#1A1A1A', '#FFFFFF'], logo: LOGO_ARANDUROGA, mascotEmoji: '🦓', mascotName: {es: 'La Cebra', pt: 'A Zebra'}},
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
  'INT-DUE': {colors: ['#2E7D32', '#1A1A1A'], logo: LOGO_DUENDES, mascotEmoji: '👻', mascotName: {es: 'El Fantasma', pt: 'O Fantasma'}},
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
