import {LEAGUES, TEAMS, generateSquad, teamOverall, leagueOfTeam, SKILL_LABELS, SKILL_CATEGORIES, SKILL_PROFILES, TRAITS, POSITIONS} from './data.js';
import {simulateMatch, TACTICS} from './engine.js';
import {MatchRenderer, renderFormationHtml} from './render.js';
import {generateFixture, initialStandings, applyResult, sortedStandings, firstKnockoutRound, nextKnockoutRound, knockoutStageName} from './fixtures.js';
import {NEA_SEED_MATCHES} from './seedNea.js';
import {getRealRoster, pickStartingXV, rosterWithStatus, getStaff, getStaffQuality, getDualPartner, conditionMultiplier} from './realSquads.js';

const SAVE_KEY = 'rugbyNeaSave_v8';

// ---- Idioma (i18n) --------------------------------------------------------
// Espanhol paraguaio é o idioma padrão do app; português fica disponível
// através do botão de troca no topbar, com a escolha salva no localStorage.
const LANG_KEY = 'rugbyNeaLang';

const I18N = {
  es: {
    confirmNewGame: '¿Seguro que querés empezar un juego nuevo? El progreso actual se va a perder.',
    navPainel: 'Panel',
    navTabela: 'Tabla',
    navFixture: 'Fixture',
    navElenco: 'Plantel',
    newGameBtn: 'Nuevo juego',
    newGameBtnTitle: 'Empezar un juego nuevo',
    langToggleBtn: 'Português',
    teamSelectTitle: '🏉 Elegí tu equipo',
    teamSelectDesc: 'Elegí el club que vas a dirigir como manager. Disputás el campeonato de tu país, junto con los demás clubes de la misma liga, y seguís los partidos en vivo en la cancha. Algunos clubes disputan dos ligas al mismo tiempo.',
    statsLine: 'Ataque {a} · Defensa {d} · Físico {s}',
    dualLeague: 'Disputa dos ligas',
    colTime: 'Equipo',
    colPJ: 'PJ',
    colV: 'G',
    colE: 'E',
    colD: 'P',
    colPF: 'PF',
    colPC: 'PC',
    colDIF: 'DIF',
    colPts: 'Pts',
    bracketTitle: 'Playoffs',
    pending: 'a definir',
    home: 'en casa',
    away: 'de visitante',
    prepareMatch: 'Preparar partido',
    seasonOver: '¡Temporada terminada! Mirá la tabla final.',
    dashboardTitle: 'Panel — {team}',
    dashboardDualNote: '{team} disputa dos competencias al mismo tiempo — estate atento a las dos agendas y rotá el plantel cuando los partidos coincidan.',
    notQualified: 'No se clasificó para los playoffs',
    eliminated: 'Eliminado',
    champion: '¡Campeón! 🏆',
    runnerUp: 'Subcampeón',
    positionLeague: '{pos}º lugar',
    positionGroup: '{pos}º en el Grupo {g}',
    groupA: 'Grupo A',
    groupB: 'Grupo B',
    standingsTitle: 'Tabla de Posiciones',
    roundLabel: 'Fecha {n}',
    groupPhaseRound: 'Fase de Grupos — Fecha {n}',
    currentSuffix: ' (actual)',
    fixtureTitle: 'Fixture — Ida y Vuelta',
    dipTitle: 'Entrenamiento individual (DIP)',
    focusLabel: 'Foco',
    noneClubTraining: 'Ninguno (solo entrenamiento de club)',
    dipHelp: 'Determinación ≥75 habilita entrenamiento individual intensivo: mejora garantizada en el atributo elegido, más rápido que el entrenamiento de club, a costa de mucho más desgaste físico.',
    biometria: 'Biometría',
    altura: 'Altura',
    peso: 'Peso',
    traitsLabel: 'Rasgos',
    media: 'Promedio {category}',
    condicaoFisica: 'Condición física: {v}%',
    anos: '{age} años',
    potencial: 'potencial {p}',
    lesaoFadigaBadge: 'lesión por fatiga',
    lesionado: 'Lesionado ({label})',
    indisponivel: 'No disponible (compromiso simultáneo)',
    titular: 'Titular #{n}',
    reserva: 'Reserva',
    elencoTitle: 'Plantel — {team}',
    escalacaoAtual: 'Formación titular actual',
    escalacaoSimples: 'Formación titular',
    explicacaoCategorias: 'Técnico, Mental y Físico son promedios de categoría — hacé clic en un jugador para ver los 22 atributos individuales, biometría y rasgos.',
    explicacaoPrimeiraLinea: 'Pilares y hooker son especialistas de primera línea: si faltan, el club tiene que convocar de urgencia a un juvenil de 18 años en vez de improvisar con otro jugador.',
    explicacaoCondicao: 'La condición baja después de cada partido (más para quien tiene menos resistencia) y se recupera con el tiempo; los jugadores muy desgastados rinden menos y corren más riesgo de lesión.',
    explicacaoTreino: 'El club entrena lunes, martes y jueves: fatiga leve en cada fecha, pero evolución gradual de los atributos a lo largo de la temporada. Los jugadores con determinación ≥75 pueden elegir entrenamiento individual intensivo (DIP) en un atributo específico, haciendo clic en el jugador — mejora más rápido ahí, con más desgaste físico.',
    plantelCompleto: 'Plantel completo ({n} jugadores — titulares destacados)',
    porOverall: 'Por overall',
    porPosicao: 'Por posición',
    colStatus: 'Estado',
    colJogador: 'Jugador',
    colPosicao: 'Posición',
    colOverall: 'Overall',
    colCondicao: 'Condición',
    colTecnico: 'Técnico',
    colMental: 'Mental',
    colFisico: 'Físico',
    colBio: 'Bio',
    colObs: 'Obs',
    comissaoTecnica: 'Cuerpo técnico',
    forwardsTitle: 'Forwards (overall {n})',
    backsTitle: 'Backs (overall {n})',
    escalarManual: 'Formación manual',
    autoPreencher: 'Autocompletar',
    salvarTimeA: 'Guardar Equipo A',
    usarTimeA: 'Usar Equipo A',
    salvarTimeB: 'Guardar Equipo B',
    usarTimeB: 'Usar Equipo B',
    convocacaoEmergencia: '— Convocatoria de emergencia (juvenil) —',
    convocacaoEmergenciaBadge: 'convocatoria de emergencia',
    especialistas: 'Especialistas',
    mesmaLinha: 'Misma línea',
    outrasPosicoes: 'Otras posiciones',
    diaDeJogo: 'Día de partido — {comp} — {round}',
    casaVs: '{home} (local) vs {away} (visitante)',
    mataDesempate: 'Playoffs: en caso de empate, el partido va a tiempo suplementario hasta que salga un ganador.',
    excluidoHoje: '⚠️ Algunos jugadores no están disponibles hoy: ya jugaron en la otra competencia el mismo día, en otra sede.',
    jogoDuplo: '⚠️ Doble partido el mismo día y sede: parte del equipo ya jugó más temprano y entra a la cancha más desgastado.',
    escolhaTatica: 'Elegí tu táctica',
    taticaAgresivo: 'Agresivo',
    taticaAgresivoDesc: '+ataque, -defensa',
    taticaEquilibrado: 'Equilibrado',
    taticaEquilibradoDesc: 'sin cambios',
    taticaDefensivo: 'Defensivo',
    taticaDefensivoDesc: '+defensa, -ataque',
    comecarPartida: 'Empezar partido',
    escalacaoHoje: 'Formación de hoy',
    escalacaoSalvaA: 'Formación guardada como Equipo A.',
    escalacaoSalvaB: 'Formación guardada como Equipo B.',
    timeANaoSalvo: 'El Equipo A todavía no fue guardado.',
    timeBNaoSalvo: 'El Equipo B todavía no fue guardado.',
    pausar: '⏸ Pausar',
    continuarPlay: '▶ Continuar',
    adiantar: 'Adelantar hasta el final ⏭',
    fimDeJogo: 'Fin del partido',
    decididoProrrogacao: 'Decidido en tiempo suplementario — los playoffs no permiten empate.',
    triesDe: 'Tries {team}',
    semTries: 'Sin tries.',
    craqueDaPartida: 'Mejor jugador del partido:',
    continuar: 'Continuar',
    lesaoFadigaAlert: 'Lesión por fatiga: {names} no va a poder jugar por un tiempo — el desgaste acumulado cobró su precio.',
    semana1: '{n} semana',
    semanaN: '{n} semanas',
    mes1: '{n} mes',
    mesN: '{n} meses',
  },
  pt: {
    confirmNewGame: 'Tem certeza que quer começar um novo jogo? O progresso atual será perdido.',
    navPainel: 'Painel',
    navTabela: 'Tabela',
    navFixture: 'Fixture',
    navElenco: 'Elenco',
    newGameBtn: 'Novo jogo',
    newGameBtnTitle: 'Começar um novo jogo',
    langToggleBtn: 'Español',
    teamSelectTitle: '🏉 Escolha seu time',
    teamSelectDesc: 'Selecione o clube que você vai comandar como manager. Você disputa o campeonato do seu país, junto com os outros clubes da mesma liga, e acompanha as partidas ao vivo na quadra. Alguns clubes disputam duas ligas ao mesmo tempo.',
    statsLine: 'Ataque {a} · Defesa {d} · Físico {s}',
    dualLeague: 'Disputa duas ligas',
    colTime: 'Time',
    colPJ: 'PJ',
    colV: 'V',
    colE: 'E',
    colD: 'D',
    colPF: 'PF',
    colPC: 'PC',
    colDIF: 'DIF',
    colPts: 'Pts',
    bracketTitle: 'Mata-mata',
    pending: 'a definir',
    home: 'em casa',
    away: 'fora',
    prepareMatch: 'Preparar partida',
    seasonOver: 'Temporada encerrada! Confira a tabela final.',
    dashboardTitle: 'Painel — {team}',
    dashboardDualNote: 'O {team} disputa duas competições ao mesmo tempo — fique de olho nas duas agendas e reveze o elenco quando os jogos coincidirem.',
    notQualified: 'Não se classificou para o mata-mata',
    eliminated: 'Eliminado',
    champion: 'Campeão! 🏆',
    runnerUp: 'Vice-campeão',
    positionLeague: '{pos}º lugar',
    positionGroup: '{pos}º no Grupo {g}',
    groupA: 'Grupo A',
    groupB: 'Grupo B',
    standingsTitle: 'Tabela de Classificação',
    roundLabel: 'Rodada {n}',
    groupPhaseRound: 'Fase de Grupos — Rodada {n}',
    currentSuffix: ' (atual)',
    fixtureTitle: 'Fixture — Turno e Returno',
    dipTitle: 'Treino individual (DIP)',
    focusLabel: 'Foco',
    noneClubTraining: 'Nenhum (só treino de clube)',
    dipHelp: 'Determinação ≥75 libera treino individual intensivo: evolui garantido no atributo escolhido, mais rápido que o treino de clube, à custa de bem mais desgaste físico.',
    biometria: 'Biometria',
    altura: 'Altura',
    peso: 'Peso',
    traitsLabel: 'Traits',
    media: 'Média {category}',
    condicaoFisica: 'Condição física: {v}%',
    anos: '{age} anos',
    potencial: 'potencial {p}',
    lesaoFadigaBadge: 'lesão por fadiga',
    lesionado: 'Lesionado ({label})',
    indisponivel: 'Indisponível (compromisso simultâneo)',
    titular: 'Titular #{n}',
    reserva: 'Reserva',
    elencoTitle: 'Elenco — {team}',
    escalacaoAtual: 'Escalação titular atual',
    escalacaoSimples: 'Escalação titular',
    explicacaoCategorias: 'Técnico, Mental e Físico são médias de categoria — clique num jogador pra ver os 22 atributos individuais, biometria e traits.',
    explicacaoPrimeiraLinea: 'Pilares e hooker são especialistas de primeira línea: se faltarem, o clube precisa convocar às pressas um juvenil de 18 anos em vez de improvisar com outro jogador.',
    explicacaoCondicao: 'A condição cai após cada partida (mais para quem tem menos resistência) e se recupera com o tempo; jogadores muito desgastados rendem menos e correm mais risco de lesão.',
    explicacaoTreino: 'O clube treina segunda, terça e quinta: fadiga leve a cada rodada, mas evolução gradual dos atributos ao longo da temporada. Jogadores com determinação ≥75 podem escolher treino individual intensivo (DIP) num atributo específico, clicando no jogador — evolui mais rápido ali, com mais desgaste físico.',
    plantelCompleto: 'Plantel completo ({n} jogadores — titulares em destaque)',
    porOverall: 'Por overall',
    porPosicao: 'Por posição',
    colStatus: 'Status',
    colJogador: 'Jogador',
    colPosicao: 'Posição',
    colOverall: 'Overall',
    colCondicao: 'Condição',
    colTecnico: 'Técnico',
    colMental: 'Mental',
    colFisico: 'Físico',
    colBio: 'Bio',
    colObs: 'Obs',
    comissaoTecnica: 'Comissão técnica',
    forwardsTitle: 'Forwards (overall {n})',
    backsTitle: 'Backs (overall {n})',
    escalarManual: 'Escalar manualmente',
    autoPreencher: 'Auto-preencher',
    salvarTimeA: 'Salvar Time A',
    usarTimeA: 'Usar Time A',
    salvarTimeB: 'Salvar Time B',
    usarTimeB: 'Usar Time B',
    convocacaoEmergencia: '— Convocação de emergência (juvenil) —',
    convocacaoEmergenciaBadge: 'convocação de emergência',
    especialistas: 'Especialistas',
    mesmaLinha: 'Mesma linha',
    outrasPosicoes: 'Outras posições',
    diaDeJogo: 'Dia de jogo — {comp} — {round}',
    casaVs: '{home} (casa) vs {away} (visitante)',
    mataDesempate: 'Mata-mata: em caso de empate, a partida vai para a prorrogação até sair um vencedor.',
    excluidoHoje: '⚠️ Alguns jogadores estão indisponíveis hoje: já entraram em campo na outra competição no mesmo dia, em local diferente.',
    jogoDuplo: '⚠️ Jogo duplo no mesmo dia e local: parte do time já jogou mais cedo e entra em campo mais desgastada.',
    escolhaTatica: 'Escolha sua tática',
    taticaAgresivo: 'Agresivo',
    taticaAgresivoDesc: '+ataque, -defesa',
    taticaEquilibrado: 'Equilibrado',
    taticaEquilibradoDesc: 'sem alterações',
    taticaDefensivo: 'Defensivo',
    taticaDefensivoDesc: '+defesa, -ataque',
    comecarPartida: 'Começar partida',
    escalacaoHoje: 'Escalação para hoje',
    escalacaoSalvaA: 'Escalação salva como Time A.',
    escalacaoSalvaB: 'Escalação salva como Time B.',
    timeANaoSalvo: 'Time A ainda não foi salvo.',
    timeBNaoSalvo: 'Time B ainda não foi salvo.',
    pausar: '⏸ Pausar',
    continuarPlay: '▶ Continuar',
    adiantar: 'Adiantar até o final ⏭',
    fimDeJogo: 'Fim de jogo',
    decididoProrrogacao: 'Decidido na prorrogação — mata-mata não permite empate.',
    triesDe: 'Tries {team}',
    semTries: 'Sem tries.',
    craqueDaPartida: 'Craque da partida:',
    continuar: 'Continuar',
    lesaoFadigaAlert: 'Lesão por fadiga: {names} não vai poder jogar por um tempo — o desgaste acumulado cobrou o preço.',
    semana1: '{n} semana',
    semanaN: '{n} semanas',
    mes1: '{n} mês',
    mesN: '{n} meses',
  },
};

let lang = localStorage.getItem(LANG_KEY) === 'pt' ? 'pt' : 'es';

function t(key, vars) {
  let str = (I18N[lang] && I18N[lang][key] != null) ? I18N[lang][key] : (I18N.es[key] != null ? I18N.es[key] : key);
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
  }
  return str;
}

// Nomes de competição e país variam pouco entre os dois idiomas (o resto do
// conteúdo — clubes, jogadores, observações de scouting — não é traduzido,
// só a interface do app).
const LEAGUE_NAME_ES = {
  nea: 'Campeonato del Nordeste Argentino (NEA)',
  paraguayo: 'Campeonato Paraguayo',
  interior: 'Torneo del Interior',
};
const COUNTRY_ES = {
  'Paraguai': 'Paraguay',
};

function leagueName(league) {
  if (lang === 'es' && LEAGUE_NAME_ES[league.id]) return LEAGUE_NAME_ES[league.id];
  return league.name;
}

function countryName(country) {
  if (lang === 'es' && COUNTRY_ES[country]) return COUNTRY_ES[country];
  return country;
}

// Rótulos e abreviações de atributos em espanhol — o restante do conteúdo
// (nomes de jogadores, observações de scout, staff) permanece como está.
const SKILL_LABELS_ES = {
  pass: 'Pase', reception: 'Recepción', lineoutThrow: 'Lateral', jump: 'Salto',
  tackle: 'Tackle', kicking: 'Patada', speed: 'Velocidad', strength: 'Fuerza',
  stamina: 'Resistencia', determination: 'Determinación',
  ruck: 'Ruck', turnover: 'Jackal', scrum: 'Scrum', dropGoal: 'Drop Goal', sidestep: 'Quiebre',
  vision: 'Visión', positioning: 'Posicionamiento', discipline: 'Disciplina', leadership: 'Liderazgo',
  composure: 'Compostura', agility: 'Agilidad', recovery: 'Recuperación',
};

function skillLabel(key) {
  return lang === 'es' ? (SKILL_LABELS_ES[key] || SKILL_LABELS[key]) : SKILL_LABELS[key];
}

const TRAITS_ES = {
  injuryProne: 'Propenso a Lesiones',
  lineoutSpecialist: 'Especialista en Line-out',
  packLeader: 'Líder del Pack',
};

function traitLabel(key) {
  if (lang === 'es') return TRAITS_ES[key] || (TRAITS[key] ? TRAITS[key].label : key);
  return TRAITS[key] ? TRAITS[key].label : key;
}

function setLang(newLang) {
  lang = newLang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang === 'es' ? 'es-PY' : 'pt-BR';
  applyStaticTranslations();
  render();
}

function applyStaticTranslations() {
  const dashboardBtn = mainNav.querySelector('[data-view="dashboard"]');
  const standingsBtn = mainNav.querySelector('[data-view="standings"]');
  const fixtureBtn = mainNav.querySelector('[data-view="fixture"]');
  const squadBtn = mainNav.querySelector('[data-view="squad"]');
  if (dashboardBtn) dashboardBtn.textContent = t('navPainel');
  if (standingsBtn) standingsBtn.textContent = t('navTabela');
  if (fixtureBtn) fixtureBtn.textContent = t('navFixture');
  if (squadBtn) squadBtn.textContent = t('navElenco');
  const newGameBtnEl = document.getElementById('newGameBtn');
  newGameBtnEl.textContent = t('newGameBtn');
  newGameBtnEl.title = t('newGameBtnTitle');
  const langBtn = document.getElementById('langToggleBtn');
  if (langBtn) langBtn.textContent = t('langToggleBtn');
}

const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));
function crestCode(team) {
  return team.id.slice(-3);
}
const squadCache = {};
function squadOf(teamId, options) {
  const realRoster = getRealRoster(teamId);
  if (realRoster) return pickStartingXV(realRoster, options);
  if (!squadCache[teamId]) squadCache[teamId] = generateSquad(teamById[teamId]);
  return squadCache[teamId];
}

// Dia do calendário da temporada "de hoje": cada rodada finalizada (de
// qualquer competição do clube) avança exatamente 7 dias — o intervalo real
// entre uma partida e outra do MESMO time NO MESMO campeonato é sempre uma
// rodada, logo sempre 7 dias, que é o tempo que os jogadores têm pra
// recuperar a energia até o próximo jogo daquela competição.
function currentCalendarDay() {
  return state.calendarDay;
}

// Condição física atual do jogador (0-100), recuperada "sob demanda" a partir
// da condição registrada logo após sua última partida (state.playerCondition)
// e dos dias corridos desde então (7 dias = 1 rodada da mesma competição).
// Jogadores com mais resistência/determinação se recuperam mais rápido.
function currentConditionOf(player) {
  const rec = state.playerCondition[player.id];
  if (!rec) return 100;
  const elapsedDays = currentCalendarDay() - rec.atDay;
  if (elapsedDays <= 0) return Math.max(0, Math.min(100, rec.condition));
  const recoveryPerWeek = 14 + player.skills.stamina * 0.14 + player.skills.determination * 0.08;
  return Math.min(100, rec.condition + (recoveryPerWeek / 7) * elapsedDays);
}

// Local do jogo do ponto de vista do clube gerenciado: 'home' (seu próprio
// estádio) ou o id do adversário (cada partida fora é numa cidade distinta).
function venueOf(match, teamId) {
  return match.home === teamId ? 'home' : match.home;
}

let state = null;
let matchAnim = null; // controle da partida ao vivo em andamento
let pendingMatchResult = null; // resultado já simulado/exibido da partida do usuário nesta rodada
let pendingMyXV = null; // escalação (jogadores inteiros) usada na partida em andamento
let manualSlots = null; // array de 15 playerIds (ou null nalguma posição = automático) em edição na tela de Dia de Jogo
let manualSlotsSignature = null; // identifica pra qual partida o manualSlots atual pertence, pra resetar ao mudar de jogo

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// ---- Construção de competições -------------------------------------------
// Uma competição pode ter três estágios ao longo da temporada:
//  'league'   — turno e returno simples (ex.: NEA), com tabela única.
//  'groups'   — dois grupos de turno e returno rodando em paralelo (Paraguaio).
//  'knockout' — mata-mata (quartas/semi/final), sem tabela, gerado sob demanda
//               a partir de quem se classificou na fase anterior.

function buildLeagueCompetition(league, teamId) {
  const ids = league.teams.map(t => t.id);
  const fixture = generateFixture(ids);
  const standings = initialStandings(ids);
  let currentRoundIndex = 0;

  // O NEA começa a partir da 7ª rodada, refletindo a tabela real do campeonato em andamento.
  if (league.id === 'nea') {
    NEA_SEED_MATCHES.forEach(seed => {
      const round = fixture[seed.round - 1];
      const match = round.matches.find(m => m.home === seed.home && m.away === seed.away);
      if (!match) return;
      match.played = true;
      match.scoreHome = seed.scoreHome;
      match.scoreAway = seed.scoreAway;
      applyResult(standings, seed.home, seed.away, seed.scoreHome, seed.scoreAway);
    });
    currentRoundIndex = 7;
  }

  return {teamId, league: league.id, stage: 'league', fixture, standings, currentRoundIndex, roundsElapsed: currentRoundIndex, knockoutRounds: []};
}

function buildGroupCompetition(league, teamId) {
  const groupOf = {};
  Object.entries(league.groups).forEach(([g, ids]) => ids.forEach(id => { groupOf[id] = g; }));
  const groupFixtures = {};
  const groupStandings = {};
  Object.entries(league.groups).forEach(([g, ids]) => {
    groupFixtures[g] = generateFixture(ids);
    groupStandings[g] = initialStandings(ids);
  });

  return {
    teamId, league: league.id, stage: 'groups',
    groupOf, groupFixtures, groupStandings,
    currentRoundIndex: 0, roundsElapsed: 0, knockoutRounds: [],
  };
}

function buildCompetition(teamId) {
  const league = leagueOfTeam(teamId);
  return league.groups ? buildGroupCompetition(league, teamId) : buildLeagueCompetition(league, teamId);
}

function newGame(myTeamId) {
  const competitions = {};
  const primary = buildCompetition(myTeamId);
  competitions[primary.league] = primary;

  // Clubes que disputam duas ligas ao mesmo tempo (ex.: Curda) entram com as
  // duas competições já rodando, calendários independentes.
  const partnerId = getDualPartner(myTeamId);
  if (partnerId) {
    const secondary = buildCompetition(partnerId);
    competitions[secondary.league] = secondary;
  }

  state = {
    myTeamId,
    competitions,
    activeCompetition: primary.league,
    tactic: 'equilibrado',
    calendarDay: 0, // dia do calendário da temporada — avança 7 (uma semana) a cada rodada finalizada, de qualquer competição
    playerCondition: {}, // {[playerId]: {condition, atDay}} — condição registrada logo após a última partida do jogador (atDay = dia do calendário da temporada, ver currentCalendarDay)
    playerOverrides: {}, // {[playerId]: {injuryWeeks, injuryLabel, dynamicInjury}} — lesões dinâmicas por fadiga
    lastMatch: {}, // {[competitionKey]: {ids, roundsElapsed, venue}} — última escalação usada em cada competição, p/ detectar choque de agenda
    lineupPresets: {}, // {[teamId]: {A: [15 playerIds ou null], B: [...]}} — escalações salvas (Time A / Time B)
    skillGrowth: {}, // {[playerId]: {skillKey: novoValorAbsoluto}} — evolução de atributos por treino (ver tickTraining)
    dipTraining: {}, // {[playerId]: skillKey} — foco de treino individual intensivo (DIP) escolhido pelo manager
  };
  saveState();
  render();
}

function resetGame() {
  if (!confirm(t('confirmNewGame'))) return;
  localStorage.removeItem(SAVE_KEY);
  state = null;
  currentView = 'dashboard';
  render();
}

const content = document.getElementById('content');
const mainNav = document.getElementById('mainNav');
const topbarRight = document.getElementById('topbarRight');
const myTeamBadge = document.getElementById('myTeamBadge');

let currentView = 'dashboard';
let squadSortMode = 'overall'; // 'overall' (padrão) ou 'position' (1-15 titulares por camisa, depois reservas por posto)

document.getElementById('newGameBtn').addEventListener('click', resetGame);
mainNav.addEventListener('click', e => {
  const btn = e.target.closest('.navBtn');
  if (!btn) return;
  currentView = btn.dataset.view;
  render();
});
document.getElementById('langToggleBtn').addEventListener('click', () => setLang(lang === 'es' ? 'pt' : 'es'));
document.documentElement.lang = lang === 'es' ? 'es-PY' : 'pt-BR';
applyStaticTranslations();

function comp(key) {
  return state.competitions[key || state.activeCompetition];
}

function competitionLabel(key) {
  const league = LEAGUES.find(l => l.id === key);
  return league ? leagueName(league) : key;
}

// Retorna a lista de partidas (por referência, mutável) da rodada/estágio
// atualmente ativo da competição, seja qual for o estágio.
function activeRoundMatches(c) {
  if (c.stage === 'league') {
    const round = c.fixture[c.currentRoundIndex];
    return round ? round.matches : null;
  }
  if (c.stage === 'groups') {
    const a = c.groupFixtures.A[c.currentRoundIndex];
    const b = c.groupFixtures.B[c.currentRoundIndex];
    if (!a && !b) return null;
    return [...(a ? a.matches : []), ...(b ? b.matches : [])];
  }
  if (c.stage === 'knockout') {
    const round = c.knockoutRounds[c.currentRoundIndex];
    return round ? round.matches : null;
  }
  return null;
}

function activeRoundName(c) {
  if (c.stage === 'league') {
    const round = c.fixture[c.currentRoundIndex];
    return round ? t('roundLabel', {n: round.round}) : null;
  }
  if (c.stage === 'groups') {
    const idx = c.currentRoundIndex;
    const r = c.groupFixtures.A[idx] || c.groupFixtures.B[idx];
    return r ? t('groupPhaseRound', {n: idx + 1}) : null;
  }
  if (c.stage === 'knockout') {
    const round = c.knockoutRounds[c.currentRoundIndex];
    return round ? round.name : null;
  }
  return null;
}

function myMatchThisRound(key) {
  const c = comp(key);
  const matches = activeRoundMatches(c);
  if (!matches) return null;
  return matches.find(m => m.home === c.teamId || m.away === c.teamId) || null;
}

function otherCompetitionKey(key) {
  return Object.keys(state.competitions).find(k => k !== key) || null;
}

// Verifica se a partida que o clube está prestes a jogar em `key` cai na
// MESMA rodada relativa ("mesma data") da última partida já disputada na
// OUTRA competição. Se cair:
//  - mesmo local (ambas em casa, no próprio estádio do clube): jogo duplo no
//    mesmo dia é fisicamente possível, mas quem já jogou entra bem mais
//    desgastado (doubleHeaderIds).
//  - locais diferentes (pelo menos uma fora): fisicamente impossível estar
//    nos dois lugares — quem já jogou fica indisponível (excludedIds), o que
//    pode forçar até convocação de emergência do juvenil na primeira línea.
function clashInfoFor(key, match) {
  const c = comp(key);
  const otherKey = otherCompetitionKey(key);
  const empty = {excludedIds: new Set(), doubleHeaderIds: new Set()};
  if (!otherKey) return empty;
  const sibling = state.lastMatch[otherKey];
  if (!sibling || sibling.roundsElapsed !== c.roundsElapsed) return empty;
  const thisVenue = venueOf(match, c.teamId);
  if (thisVenue === sibling.venue) {
    return {excludedIds: new Set(), doubleHeaderIds: new Set(sibling.ids)};
  }
  return {excludedIds: new Set(sibling.ids), doubleHeaderIds: new Set()};
}

// Condição efetiva usada numa partida específica: igual à condição atual do
// jogador, exceto para quem está fazendo um "jogo duplo" no mesmo dia (mesmo
// local), que entra em campo com uma penalidade extra de desgaste.
function buildMatchConditionOf(doubleHeaderIds) {
  return player => {
    const base = currentConditionOf(player);
    return doubleHeaderIds.has(player.id) ? Math.max(5, base - 25) : base;
  };
}

// Piora na condição de um jogador ao final de uma partida cheia, a partir da
// condição com que ele ENTROU em campo. Resistência e determinação altas
// amortecem bastante a queda (jogadores "de garra" seguram melhor os 80').
function declineAfterMatch(player, preMatchCondition) {
  const stamina = player.skills.stamina;
  const determination = player.skills.determination;
  const decline = 40 * (1.5 - stamina / 100) * (0.9 - determination / 500);
  return Math.max(8, preMatchCondition - decline);
}

// Risco de lesão por fadiga: só entra em jogo quando o jogador termina a
// partida muito desgastado; determinação alta reduz o risco (jogadores mais
// durões se cuidam/se seguram melhor mesmo cansados).
function rollFatigueInjury(player, postMatchCondition) {
  if (postMatchCondition >= 35) return null;
  let risk = Math.max(0.02, 0.10 - player.skills.determination * 0.0008);
  if (player.meta && player.meta.traits && player.meta.traits.includes('injuryProne')) risk *= 1.8;
  if (Math.random() >= risk) return null;
  const weeks = 1 + Math.floor(Math.random() * 4);
  return {injuryWeeks: weeks, injuryLabel: weeksLabel(weeks), dynamicInjury: true};
}

function weeksLabel(weeks) {
  if (weeks >= 8) {
    const months = Math.round(weeks / 4.33);
    return t(months > 1 ? 'mesN' : 'mes1', {n: months});
  }
  return t(weeks > 1 ? 'semanaN' : 'semana1', {n: weeks});
}

// Passa 1 semana pra qualquer lesão em andamento do elenco do clube
// gerenciado (tanto as lesões estáticas do elenco curado quanto as dinâmicas
// por fadiga), dando alta assim que chega a zero. Chamada uma vez por
// rodada finalizada (mesmo relógio global usado pra recuperação de condição).
function tickInjuries() {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return;
  roster.forEach(p => {
    const override = state.playerOverrides[p.id];
    const effectiveWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;
    if (!effectiveWeeks) return;
    const remaining = Math.max(0, effectiveWeeks - 1);
    state.playerOverrides[p.id] = {
      ...(override || {}),
      injuryWeeks: remaining,
      injuryLabel: remaining > 0 ? weeksLabel(remaining) : undefined,
    };
  });
}

// Soma `amount` ao valor mais atual (já com evolução anterior) de uma skill
// e grava em state.skillGrowth como valor absoluto — o overall recalculado
// nunca cai por causa do treino (applyOverrides em realSquads.js já garante
// isso ao escolher o maior entre o overall "de scout" e o recomputado).
function growSkill(playerId, baseSkills, key, amount) {
  const current = (state.skillGrowth[playerId] && state.skillGrowth[playerId][key] != null)
    ? state.skillGrowth[playerId][key] : baseSkills[key];
  const next = Math.max(current, Math.min(99, Math.round(current + amount)));
  if (next === current) return;
  state.skillGrowth[playerId] = {...(state.skillGrowth[playerId] || {}), [key]: next};
}

// Sorteia uma skill pra evoluir no treino de clube, com mais chance nas
// skills que definem a posição do jogador (peso do SKILL_PROFILES).
function weightedRandomSkill(posId) {
  const profile = SKILL_PROFILES[posId];
  const totalWeight = SKILL_KEYS.reduce((sum, k) => sum + profile[k], 0);
  let roll = Math.random() * totalWeight;
  for (const k of SKILL_KEYS) {
    roll -= profile[k];
    if (roll <= 0) return k;
  }
  return SKILL_KEYS[SKILL_KEYS.length - 1];
}

// Treino do clube: segunda, terça e quinta, uma vez por rodada finalizada.
// Fadiga leve pra todo mundo (registrada como mais uma queda de condição,
// que se recupera igual à fadiga de partida) e chance de evolução gradual
// de algum atributo. Jogadores com determinação ≥75 podem entrar em treino
// individual intensivo (DIP), focado num atributo escolhido no Elenco: evolui
// garantido e mais rápido ali, à custa de bem mais desgaste físico. A
// qualidade da comissão técnica (getStaffQuality) acelera tudo isso. Só se
// aplica ao elenco real do clube gerenciado — mesma restrição de tickInjuries.
function tickTraining() {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return;
  const quality = getStaffQuality(state.myTeamId);
  roster.forEach(p => {
    const override = state.playerOverrides[p.id];
    const injuryWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;
    if (injuryWeeks) return; // lesionado não treina

    const dipKey = state.dipTraining[p.id];
    const dipEligible = dipKey && p.skills.determination >= 75;
    let fatigue;
    if (dipEligible) {
      growSkill(p.id, p.skills, dipKey, 2 * quality);
      fatigue = 10 + Math.random() * 8;
    } else {
      fatigue = 3 + Math.random() * 5;
      if (Math.random() < 0.3 * quality) {
        growSkill(p.id, p.skills, weightedRandomSkill(p.posId), Math.max(1, Math.round(quality)));
      }
    }
    const current = currentConditionOf(p);
    state.playerCondition[p.id] = {condition: Math.max(15, current - fatigue), atDay: currentCalendarDay()};
  });
}

// ---- Transições de estágio e mata-mata ------------------------------------

// Mata-mata não admite empate: sorteia (com peso igual) quem avança e soma
// 3 pontos ao vencedor, representando uma prorrogação/disputa de pênaltis
// resolvida sem simular minuto a minuto.
function breakTie(scoreHome, scoreAway) {
  const homeWins = Math.random() < 0.5;
  return homeWins ? [scoreHome + 3, scoreAway] : [scoreHome, scoreAway + 3];
}

function simulateOtherMatch(homeId, awayId) {
  const home = teamById[homeId];
  const away = teamById[awayId];
  const r = simulateMatch(home, squadOf(homeId), 'equilibrado', away, squadOf(awayId), 'equilibrado');
  return {scoreHome: r.scoreA, scoreAway: r.scoreB};
}

function applyMatchToStandings(c, m, scoreHome, scoreAway) {
  if (c.stage === 'league') {
    applyResult(c.standings, m.home, m.away, scoreHome, scoreAway);
  } else if (c.stage === 'groups') {
    const g = c.groupOf[m.home];
    applyResult(c.groupStandings[g], m.home, m.away, scoreHome, scoreAway);
  }
  // estágio 'knockout' não tem tabela — só avanço de chaveamento.
}

function startKnockoutFromLeague(c) {
  const top8 = sortedStandings(c.standings).slice(0, 8).map(r => r.teamId);
  const matches = firstKnockoutRound(top8);
  c.stage = 'knockout';
  c.currentRoundIndex = 0;
  c.knockoutRounds = [{name: knockoutStageName(matches.length, lang), matches}];
}

function startKnockoutFromGroups(c) {
  const topA = sortedStandings(c.groupStandings.A).slice(0, 2).map(r => r.teamId);
  const topB = sortedStandings(c.groupStandings.B).slice(0, 2).map(r => r.teamId);
  const matches = [
    {home: topA[0], away: topB[1], played: false, scoreHome: null, scoreAway: null},
    {home: topB[0], away: topA[1], played: false, scoreHome: null, scoreAway: null},
  ];
  c.stage = 'knockout';
  c.currentRoundIndex = 0;
  c.knockoutRounds = [{name: knockoutStageName(matches.length, lang), matches}];
}

// Depois que o time do usuário é eliminado do mata-mata, não há mais
// nenhuma partida dele pra jogar — o resto do chaveamento é resolvido
// automaticamente para a temporada não travar esperando uma partida que
// nunca vai acontecer.
function autoResolveIfEliminated(c) {
  while (c.stage === 'knockout') {
    const round = c.knockoutRounds[c.currentRoundIndex];
    if (!round) break;
    const stillIn = round.matches.some(m => m.home === c.teamId || m.away === c.teamId);
    if (stillIn) break;
    round.matches.forEach(m => {
      if (m.played) return;
      let {scoreHome, scoreAway} = simulateOtherMatch(m.home, m.away);
      if (scoreHome === scoreAway) [scoreHome, scoreAway] = breakTie(scoreHome, scoreAway);
      m.played = true;
      m.scoreHome = scoreHome;
      m.scoreAway = scoreAway;
    });
    c.currentRoundIndex++;
    if (round.matches.length <= 1) break; // era a final
    const next = nextKnockoutRound(round.matches);
    c.knockoutRounds.push({name: knockoutStageName(next.length, lang), matches: next});
  }
}

function afterRoundAdvance(c) {
  if (c.stage === 'league') {
    if (c.currentRoundIndex < c.fixture.length) return;
    startKnockoutFromLeague(c);
  } else if (c.stage === 'groups') {
    const maxLen = Math.max(c.groupFixtures.A.length, c.groupFixtures.B.length);
    if (c.currentRoundIndex < maxLen) return;
    startKnockoutFromGroups(c);
  } else if (c.stage === 'knockout') {
    const justPlayed = c.knockoutRounds[c.currentRoundIndex - 1];
    if (!justPlayed || justPlayed.matches.length <= 1) return; // final já disputada
    const next = nextKnockoutRound(justPlayed.matches);
    c.knockoutRounds.push({name: knockoutStageName(next.length, lang), matches: next});
  }
  autoResolveIfEliminated(c);
}

// Texto de status mostrado no painel/tabela quando não há mais tabela de
// pontos corridos pra indicar posição (fase de mata-mata).
function knockoutStatusLabel(c) {
  const rounds = c.knockoutRounds;
  const appeared = rounds.some(r => r.matches.some(m => m.home === c.teamId || m.away === c.teamId));
  if (!appeared) return t('notQualified');
  const last = rounds[rounds.length - 1];
  const stillInLast = last.matches.some(m => m.home === c.teamId || m.away === c.teamId);
  // Só é campeão/vice quem de fato chegou à última fase gerada (a final);
  // quem caiu antes disso está simplesmente eliminado, mesmo que não seja
  // o campeão dessa última fase.
  if (!stillInLast) return t('eliminated');
  if (last.matches.length === 1 && last.matches[0].played) {
    const final = last.matches[0];
    const championId = final.scoreHome > final.scoreAway ? final.home : final.away;
    return championId === c.teamId ? t('champion') : t('runnerUp');
  }
  return last.name;
}

function competitionStatusLabel(c) {
  if (c.stage === 'league') {
    const rows = sortedStandings(c.standings);
    const pos = rows.findIndex(r => r.teamId === c.teamId) + 1;
    return t('positionLeague', {pos});
  }
  if (c.stage === 'groups') {
    const g = c.groupOf[c.teamId];
    const rows = sortedStandings(c.groupStandings[g]);
    const pos = rows.findIndex(r => r.teamId === c.teamId) + 1;
    return t('positionGroup', {pos, g});
  }
  return knockoutStatusLabel(c);
}

function render() {
  if (!state) {
    renderTeamSelect();
    mainNav.classList.add('hidden');
    topbarRight.classList.add('hidden');
    return;
  }

  mainNav.classList.remove('hidden');
  topbarRight.classList.remove('hidden');
  const myTeam = teamById[state.myTeamId];
  myTeamBadge.textContent = myTeam.name;
  myTeamBadge.style.background = myTeam.color;
  myTeamBadge.style.color = '#fff';

  Array.from(mainNav.children).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });

  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'standings') renderStandings();
  else if (currentView === 'fixture') renderFixture();
  else if (currentView === 'squad') renderSquad();
  else if (currentView === 'matchday') renderMatchday();
  else if (currentView === 'live') renderLive();
}

function renderTeamSelect() {
  content.innerHTML = `
    <h1>${t('teamSelectTitle')}</h1>
    <p class="muted">${t('teamSelectDesc')}</p>
    <div id="leagueSections"></div>
  `;
  const sections = document.getElementById('leagueSections');
  LEAGUES.forEach(league => {
    const section = document.createElement('div');
    section.className = 'card';
    section.innerHTML = `<h2>${leagueName(league)} <span class="muted">— ${countryName(league.country)}</span></h2>`;
    const grid = document.createElement('div');
    grid.className = 'teamGrid';
    league.teams.forEach(team => {
      const card = document.createElement('div');
      card.className = 'teamCard';
      const dual = getDualPartner(team.id);
      card.innerHTML = `
        <div class="teamCrest" style="background:${team.color}">${crestCode(team)}</div>
        <div class="teamName">${team.name}</div>
        <div class="teamStats">${t('statsLine', {a: team.attack, d: team.defense, s: team.stamina})}</div>
        ${dual ? `<div class="teamStats muted">${t('dualLeague')}</div>` : ''}
      `;
      card.addEventListener('click', () => newGame(team.id));
      grid.appendChild(card);
    });
    section.appendChild(grid);
    sections.appendChild(section);
  });
}

function renderTableHtml(rows, mineId) {
  return `
    <table>
      <thead><tr>
        <th class="teamCol">${t('colTime')}</th><th>${t('colPJ')}</th><th>${t('colV')}</th><th>${t('colE')}</th><th>${t('colD')}</th><th>${t('colPF')}</th><th>${t('colPC')}</th><th>${t('colDIF')}</th><th>${t('colPts')}</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const tm = teamById[r.teamId];
          const mine = r.teamId === mineId;
          return `<tr class="${mine ? 'myTeamRow' : ''}">
            <td class="teamCol">${tm.name}</td>
            <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
            <td>${r.pf}</td><td>${r.pc}</td><td>${r.pf - r.pc}</td><td><b>${r.pts}</b></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderBracketHtml(c) {
  return `
    <h3>${t('bracketTitle')}</h3>
    ${c.knockoutRounds.map(r => `
      <div class="roundBlock card">
        <div class="roundTitle">${r.name}</div>
        ${r.matches.map(m => {
          const home = teamById[m.home];
          const away = teamById[m.away];
          const mine = m.home === c.teamId || m.away === c.teamId;
          return `<div class="matchRow${mine ? ' mine' : ''}">
            <span class="teams">${home.name} <span class="muted">vs</span> ${away.name}</span>
            ${m.played ? `<span class="score">${m.scoreHome} - ${m.scoreAway}</span>` : `<span class="pending">${t('pending')}</span>`}
          </div>`;
        }).join('')}
      </div>
    `).join('')}
  `;
}

function renderDashboard() {
  const myTeam = teamById[state.myTeamId];
  const keys = Object.keys(state.competitions);

  const cardsHtml = keys.map(key => {
    const c = state.competitions[key];
    const match = myMatchThisRound(key);
    const roundName = activeRoundName(c);
    const status = competitionStatusLabel(c);

    let matchHtml = '';
    if (match) {
      const oppId = match.home === c.teamId ? match.away : match.home;
      const opp = teamById[oppId];
      const isHome = match.home === c.teamId;
      matchHtml = `
        <p><b>${roundName}</b> — ${isHome ? t('home') : t('away')} contra <b>${opp.name}</b></p>
        <button class="playBtn goMatchdayBtn" data-comp="${key}">${t('prepareMatch')}</button>
      `;
    } else if (c.stage === 'knockout') {
      matchHtml = `<p class="muted">${status}</p>`;
    } else {
      matchHtml = `<p class="muted">${t('seasonOver')}</p>`;
    }

    return `
      <div class="card">
        <h3>${competitionLabel(key)} <span class="muted">— ${status}</span></h3>
        ${matchHtml}
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <h1>${t('dashboardTitle', {team: myTeam.name})}</h1>
    ${keys.length > 1 ? `<p class="muted">${t('dashboardDualNote', {team: myTeam.name})}</p>` : ''}
    ${cardsHtml}
  `;

  Array.from(document.querySelectorAll('.goMatchdayBtn')).forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCompetition = btn.dataset.comp;
      currentView = 'matchday';
      render();
    });
  });
}

function renderCompetitionStandingsBlock(c) {
  let body = '';
  if (c.standings) {
    body += `<div class="card">${renderTableHtml(sortedStandings(c.standings), c.teamId)}</div>`;
  }
  if (c.groupStandings) {
    body += `
      <div class="card"><h3>${t('groupA')}</h3>${renderTableHtml(sortedStandings(c.groupStandings.A), c.teamId)}</div>
      <div class="card"><h3>${t('groupB')}</h3>${renderTableHtml(sortedStandings(c.groupStandings.B), c.teamId)}</div>
    `;
  }
  if (c.stage === 'knockout' && c.knockoutRounds.length) {
    body += renderBracketHtml(c);
  }
  return `<h2>${competitionLabel(c.league)}</h2>${body}`;
}

function renderStandings() {
  const keys = Object.keys(state.competitions);
  content.innerHTML = `
    <h1>${t('standingsTitle')}</h1>
    ${keys.map(key => renderCompetitionStandingsBlock(state.competitions[key])).join('')}
  `;
}

function renderRoundRobinInto(list, fixture, c) {
  fixture.forEach(round => {
    const block = document.createElement('div');
    block.className = 'roundBlock card';
    const isCurrent = c.stage !== 'knockout' && round.round === (c.currentRoundIndex + 1);
    block.innerHTML = `<div class="roundTitle">${t('roundLabel', {n: round.round})}${isCurrent ? t('currentSuffix') : ''}</div>`;
    round.matches.forEach(m => {
      const home = teamById[m.home];
      const away = teamById[m.away];
      const mine = m.home === c.teamId || m.away === c.teamId;
      const row = document.createElement('div');
      row.className = 'matchRow' + (mine ? ' mine' : '');
      row.innerHTML = `
        <span class="teams">${home.name} <span class="muted">vs</span> ${away.name}</span>
        ${m.played
          ? `<span class="score">${m.scoreHome} - ${m.scoreAway}</span>`
          : `<span class="pending">${t('pending')}</span>`}
      `;
      block.appendChild(row);
    });
    list.appendChild(block);
  });
}

function renderFixture() {
  const keys = Object.keys(state.competitions);
  content.innerHTML = `
    <h1>${t('fixtureTitle')}</h1>
    ${keys.map(key => `<h2>${competitionLabel(key)}</h2><div id="fixtureList-${key}"></div>`).join('')}
  `;
  keys.forEach(key => {
    const c = state.competitions[key];
    const list = document.getElementById(`fixtureList-${key}`);
    if (c.fixture) {
      renderRoundRobinInto(list, c.fixture, c);
    } else if (c.groupFixtures) {
      const titleA = document.createElement('h3'); titleA.textContent = t('groupA');
      list.appendChild(titleA);
      renderRoundRobinInto(list, c.groupFixtures.A, c);
      const titleB = document.createElement('h3'); titleB.textContent = t('groupB');
      list.appendChild(titleB);
      renderRoundRobinInto(list, c.groupFixtures.B, c);
    }
    if (c.stage === 'knockout' && c.knockoutRounds.length) {
      const bracketWrap = document.createElement('div');
      bracketWrap.innerHTML = renderBracketHtml(c);
      list.appendChild(bracketWrap);
    }
  });
}

const SKILL_KEYS = Object.keys(SKILL_LABELS);
const SKILL_SHORT = {
  pass: 'PAS', reception: 'REC', lineoutThrow: 'LAT', jump: 'SAL',
  tackle: 'TAC', kicking: 'CHU', speed: 'VEL', strength: 'FOR',
  stamina: 'RES', determination: 'DET',
  ruck: 'RUK', turnover: 'TUR', scrum: 'SCR', dropGoal: 'DRO', sidestep: 'DRI',
  vision: 'VIS', positioning: 'POS', discipline: 'DIS', leadership: 'LID', composure: 'CAL',
  agility: 'AGI', recovery: 'RCP',
};

const TRAIT_ICON = {
  injuryProne: '🩹',
  lineoutSpecialist: '🙌',
  packLeader: '🛡️',
};

function categoryAvg(skills, keys) {
  const sum = keys.reduce((acc, k) => acc + skills[k], 0);
  return Math.round(sum / keys.length);
}

// Usado dentro de .skillDetailRow (uma <div>, não uma <table>) — precisa ser
// um <span>, não um <td>: um <td> solto fora de tabela quebra o parser HTML
// (o navegador fecha as divs abertas cedo e derrama o resto do conteúdo pra
// fora da estrutura de grupos, sumindo com os rótulos).
function skillCell(value) {
  return `<span class="skillValue" title="${value}"><span class="ratingBar"><span style="width:${value}%"></span></span>${value}</span>`;
}

// Célula compacta com a média de uma categoria de atributos (técnico/mental/
// físico), usada na tabela principal em vez de uma coluna por skill — com 22
// atributos ao todo, uma coluna por skill deixaria a tabela ilegível.
function categoryCell(skills, category) {
  const avg = categoryAvg(skills, SKILL_CATEGORIES[category]);
  return `<td title="${t('media', {category})}"><span class="ratingBar"><span style="width:${avg}%"></span></span>${avg}</td>`;
}

function traitsHtml(meta) {
  if (!meta.traits || !meta.traits.length) return '';
  return meta.traits.map(tr => `<span title="${traitLabel(tr)}">${TRAIT_ICON[tr] || '★'}</span>`).join(' ');
}

// Painel expandido com a nota individual de cada um dos 22 atributos,
// agrupados por categoria — aberto ao clicar na linha do jogador.
function skillDetailHtml(p, colspan, dipEnabled) {
  const groupHtml = category => `
    <div class="skillDetailGroup">
      <h4>${category[0].toUpperCase()}${category.slice(1)}</h4>
      ${SKILL_CATEGORIES[category].map(k => `
        <div class="skillDetailRow">
          <span class="skillDetailLabel" title="${skillLabel(k)}">${SKILL_SHORT[k]}</span>
          ${skillCell(p.skills[k])}
        </div>
      `).join('')}
    </div>
  `;
  const dipHtml = dipEnabled && p.skills.determination >= 75 ? `
    <div class="skillDetailGroup">
      <h4>${t('dipTitle')}</h4>
      <div class="skillDetailRow">
        <span class="skillDetailLabel">${t('focusLabel')}</span>
        <select class="dipSelect" data-player="${p.id}">
          <option value="">${t('noneClubTraining')}</option>
          ${SKILL_KEYS.map(k => `<option value="${k}" ${state.dipTraining[p.id] === k ? 'selected' : ''}>${skillLabel(k)}</option>`).join('')}
        </select>
      </div>
      <div class="skillDetailRow"><span class="muted" style="font-size:11px">${t('dipHelp')}</span></div>
    </div>
  ` : '';
  return `
    <tr class="skillDetailTr">
      <td colspan="${colspan}">
        <div class="skillDetailWrap">
          ${Object.keys(SKILL_CATEGORIES).map(groupHtml).join('')}
          <div class="skillDetailGroup">
            <h4>${t('biometria')}</h4>
            <div class="skillDetailRow"><span class="skillDetailLabel">${t('altura')}</span> ${p.heightCm ? `${p.heightCm} cm` : '—'}</div>
            <div class="skillDetailRow"><span class="skillDetailLabel">${t('peso')}</span> ${p.weightKg ? `${p.weightKg} kg` : '—'}</div>
            ${p.meta.traits && p.meta.traits.length ? `<div class="skillDetailRow"><span class="skillDetailLabel">${t('traitsLabel')}</span> ${p.meta.traits.map(tr => `${TRAIT_ICON[tr] || '★'} ${traitLabel(tr)}`).join(', ')}</div>` : ''}
          </div>
          ${dipHtml}
        </div>
      </td>
    </tr>
  `;
}

function conditionCell(value) {
  const v = Math.round(value);
  let cls = '';
  if (v < 40) cls = 'conditionCritical';
  else if (v < 70) cls = 'conditionLow';
  return `<td class="${cls}" title="${t('condicaoFisica', {v})}"><span class="ratingBar"><span style="width:${v}%"></span></span>${v}%</td>`;
}

function metaBadges(meta) {
  const parts = [];
  if (meta.nationalTeam) parts.push(meta.nationalTeam);
  if (meta.age) parts.push(t('anos', {age: meta.age}));
  if (meta.potential) parts.push(t('potencial', {p: meta.potential}));
  if (meta.dynamicInjury) parts.push(t('lesaoFadigaBadge'));
  if (meta.note) parts.push(meta.note);
  return parts.join(' · ');
}

function statusCell(p) {
  if (p.status === 'lesionado') return `<span style="color:var(--accent-2)">${t('lesionado', {label: p.meta.injuryLabel})}</span>`;
  if (p.status === 'indisponivel') return `<span style="color:var(--accent-2)">${t('indisponivel')}</span>`;
  if (p.status === 'titular') return `<b>${t('titular', {n: p.number})}</b>`;
  return `<span class="muted">${t('reserva')}</span>`;
}

// Ordem de posto (forwards antes de backs, seguindo a numeração tradicional
// 1-15) usada pra ordenar "por posição": titulares primeiro por número de
// camisa (1 a 15), depois reservas agrupadas por posto e, dentro do mesmo
// posto, do melhor pro pior.
const POS_ORDER_INDEX = {PI: 0, HK: 1, SL: 2, AL: 3, N8: 4, MS: 5, AP: 6, WG: 7, CE: 8, FB: 9};

function sortRowsByPosition(rows) {
  return [...rows].sort((a, b) => {
    if (a.number != null && b.number != null) return a.number - b.number;
    if (a.number != null) return -1;
    if (b.number != null) return 1;
    const posA = POS_ORDER_INDEX[a.posId] ?? 99;
    const posB = POS_ORDER_INDEX[b.posId] ?? 99;
    if (posA !== posB) return posA - posB;
    return b.rating - a.rating;
  });
}

function renderRealSquad() {
  const myOptions = {conditionOf: currentConditionOf, metaOverrides: state.playerOverrides, skillOverrides: state.skillGrowth};
  let rows = rosterWithStatus(state.myTeamId, myOptions);
  if (squadSortMode === 'position') rows = sortRowsByPosition(rows);
  const {xv, bench} = formationDataFor(state.myTeamId, myOptions);
  const myTeam = teamById[state.myTeamId];
  const rowHtml = p => `
    <tr class="squadRow ${p.status === 'lesionado' ? 'injuredRow' : ''}" data-player="${p.id}">
      <td>${statusCell(p)}</td>
      <td class="teamCol">▸ ${p.name}${p.meta.nickname ? ` <span class="muted">"${p.meta.nickname}"</span>` : ''}${p.meta.captain ? ' <b>(C)</b>' : ''}${p.meta.emergencyCallUp ? ` <span class="muted">(${t('convocacaoEmergenciaBadge')})</span>` : ''} ${traitsHtml(p.meta)}</td>
      <td class="posCol">${p.position}</td>
      <td><b>${p.rating}</b></td>
      ${conditionCell(p.condition)}
      ${categoryCell(p.skills, 'técnico')}
      ${categoryCell(p.skills, 'mental')}
      ${categoryCell(p.skills, 'físico')}
      <td class="posCol">${p.heightCm ? `${p.heightCm}cm/${p.weightKg}kg` : '—'}</td>
      <td class="posCol">${metaBadges(p.meta)}</td>
    </tr>
    ${skillDetailHtml(p, 10, true)}
  `;
  const headHtml = `
    <tr>
      <th>${t('colStatus')}</th><th class="teamCol">${t('colJogador')}</th><th>${t('colPosicao')}</th><th>${t('colOverall')}</th><th>${t('colCondicao')}</th>
      <th title="${t('colTecnico')}: ${SKILL_CATEGORIES.técnico.map(k => skillLabel(k)).join(', ')}">${t('colTecnico')}</th>
      <th title="${t('colMental')}: ${SKILL_CATEGORIES.mental.map(k => skillLabel(k)).join(', ')}">${t('colMental')}</th>
      <th title="${t('colFisico')}: ${SKILL_CATEGORIES.físico.map(k => skillLabel(k)).join(', ')}">${t('colFisico')}</th>
      <th>${t('colBio')}</th>
      <th>${t('colObs')}</th>
    </tr>
  `;
  const staff = getStaff(state.myTeamId);
  const staffHtml = staff ? `
    <div class="card">
      <h3>${t('comissaoTecnica')}</h3>
      <table>
        <tbody>
          ${staff.map(s => `<tr><td class="teamCol">${s.role}</td><td class="teamCol"><b>${s.name}</b>${s.note ? ` <span class="muted">— ${s.note}</span>` : ''}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  content.innerHTML = `
    <h1>${t('elencoTitle', {team: myTeam.name})}</h1>
    ${renderFormationHtml(xv, bench, myTeam.color, t('escalacaoAtual'))}
    <p class="muted">${t('explicacaoCategorias')}</p>
    <p class="muted">${t('explicacaoPrimeiraLinea')}</p>
    <p class="muted">${t('explicacaoCondicao')}</p>
    <p class="muted">${t('explicacaoTreino')}</p>
    <div class="card">
      <div class="squadHeaderRow">
        <h3>${t('plantelCompleto', {n: rows.length})}</h3>
        <div class="sortToggle" id="squadSortToggle">
          <button class="sortBtn" data-sort="overall">${t('porOverall')}</button>
          <button class="sortBtn" data-sort="position">${t('porPosicao')}</button>
        </div>
      </div>
      <div class="tableScroll"><table class="squadTable"><thead>${headHtml}</thead>
      <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>
    </div>
    ${staffHtml}
  `;

  const sortToggle = document.getElementById('squadSortToggle');
  Array.from(sortToggle.children).forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.sort === squadSortMode);
    btn.addEventListener('click', () => {
      squadSortMode = btn.dataset.sort;
      renderRealSquad();
    });
  });

  Array.from(document.querySelectorAll('.squadRow')).forEach(tr => {
    tr.addEventListener('click', () => {
      const detail = tr.nextElementSibling;
      detail.classList.toggle('open');
      tr.classList.toggle('expanded');
    });
  });

  Array.from(document.querySelectorAll('.dipSelect')).forEach(sel => {
    sel.addEventListener('click', e => e.stopPropagation());
    sel.addEventListener('change', () => {
      const pid = sel.dataset.player;
      if (sel.value) state.dipTraining[pid] = sel.value;
      else delete state.dipTraining[pid];
      saveState();
    });
  });
}

function renderSquad() {
  if (getRealRoster(state.myTeamId)) {
    renderRealSquad();
    return;
  }
  const players = squadOf(state.myTeamId);
  const myTeam = teamById[state.myTeamId];
  const forwards = players.filter(p => p.group === 'forward');
  const backs = players.filter(p => p.group === 'back');
  const rowHtml = p => `
    <tr class="squadRow" data-player="${p.id}">
      <td>${p.number}</td>
      <td class="teamCol">▸ ${p.name} ${traitsHtml(p.meta)}</td>
      <td class="posCol">${p.position}</td>
      <td><b>${p.rating}</b></td>
      ${categoryCell(p.skills, 'técnico')}
      ${categoryCell(p.skills, 'mental')}
      ${categoryCell(p.skills, 'físico')}
      <td class="posCol">${p.heightCm ? `${p.heightCm}cm/${p.weightKg}kg` : '—'}</td>
    </tr>
    ${skillDetailHtml(p, 8)}
  `;
  const headHtml = `
    <tr>
      <th>#</th><th class="teamCol">${t('colJogador')}</th><th>${t('colPosicao')}</th><th>${t('colOverall')}</th>
      <th>${t('colTecnico')}</th><th>${t('colMental')}</th><th>${t('colFisico')}</th><th>${t('colBio')}</th>
    </tr>
  `;
  content.innerHTML = `
    <h1>${t('elencoTitle', {team: myTeam.name})}</h1>
    ${renderFormationHtml(players, [], myTeam.color, t('escalacaoSimples'))}
    <p class="muted">${t('explicacaoCategorias')}</p>
    <div class="card">
      <h3>${t('forwardsTitle', {n: teamOverall(players, 'forward')})}</h3>
      <div class="tableScroll"><table class="squadTable"><thead>${headHtml}</thead>
      <tbody>${forwards.map(rowHtml).join('')}</tbody></table></div>
    </div>
    <div class="card">
      <h3>${t('backsTitle', {n: teamOverall(players, 'back')})}</h3>
      <div class="tableScroll"><table class="squadTable"><thead>${headHtml}</thead>
      <tbody>${backs.map(rowHtml).join('')}</tbody></table></div>
    </div>
  `;

  Array.from(document.querySelectorAll('.squadRow')).forEach(tr => {
    tr.addEventListener('click', () => {
      const detail = tr.nextElementSibling;
      detail.classList.toggle('open');
      tr.classList.toggle('expanded');
    });
  });
}

// Monta a lista de titulares + reservas de um time pra exibição visual (campo
// com camisas em formação). Times sem elenco real (procedurais) não têm banco.
function formationDataFor(teamId, options) {
  const xv = squadOf(teamId, options);
  const roster = getRealRoster(teamId);
  const bench = roster ? rosterWithStatus(teamId, options).filter(p => p.status === 'reserva') : [];
  return {xv, bench};
}

// ---- Editor manual de escalação (Time A / Time B) -------------------------
// O manager pode escolher manualmente quem joga cada posição, em vez de
// depender só da seleção automática por overall/condição. Só faz sentido pra
// elencos reais (times procedurais só têm os 15 jogadores gerados, sem banco).

const POS_LABEL = Object.fromEntries(POSITIONS.map(p => [p.id, p.label]));
const FRONT_ROW_POS = new Set(['PI', 'HK']);

function manualEligiblePlayers(teamId, myOptions) {
  const full = rosterWithStatus(teamId, myOptions);
  return full.filter(p => p.status !== 'lesionado' && p.status !== 'indisponivel');
}

// Converte a escalação automática (já calculada por squadOf/pickStartingXV,
// considerando condição e choque de agenda) no formato do editor manual —
// null numa posição indica convocação de emergência (não é um jogador do
// elenco selecionável).
function slotsFromXV(xv) {
  return xv.map(p => (p.meta && p.meta.emergencyCallUp ? null : p.id));
}

// Recalcula os 15 jogadores a partir da seleção manual atual. Retorna null
// (cai pro automático) se alguma posição de primeira línea ficou sem
// especialista disponível — nesse caso a convocação de emergência do juvenil
// é feita pela seleção automática normal, não pelo editor manual.
function resolveManualXV(teamId, myOptions) {
  if (!manualSlots) return null;
  const eligible = manualEligiblePlayers(teamId, myOptions);
  const byId = Object.fromEntries(eligible.map(p => [p.id, p]));
  const xv = POSITIONS.map((slot, idx) => {
    const pid = manualSlots[idx];
    const player = pid && byId[pid];
    if (!player) return null;
    return {...player, number: idx + 1};
  });
  if (xv.some(p => !p)) return null;
  return xv;
}

function matchSignature(key, c, match) {
  return `${key}|${c.stage}|${c.currentRoundIndex}|${match.home}|${match.away}`;
}

function renderLineupEditorHtml(teamId, myOptions) {
  const eligible = manualEligiblePlayers(teamId, myOptions);
  return `
    <div class="card">
      <div class="squadHeaderRow">
        <h3>${t('escalarManual')}</h3>
        <div class="sortToggle">
          <button class="sortBtn" id="lineupAutoBtn">${t('autoPreencher')}</button>
          <button class="sortBtn" id="lineupSaveABtn">${t('salvarTimeA')}</button>
          <button class="sortBtn" id="lineupLoadABtn">${t('usarTimeA')}</button>
          <button class="sortBtn" id="lineupSaveBBtn">${t('salvarTimeB')}</button>
          <button class="sortBtn" id="lineupLoadBBtn">${t('usarTimeB')}</button>
        </div>
      </div>
      <div class="lineupEditorGrid">
        ${POSITIONS.map((slot, idx) => {
          const posId = slot.id;
          const currentId = manualSlots ? manualSlots[idx] : null;
          if (FRONT_ROW_POS.has(posId)) {
            const specialists = eligible.filter(p => p.posId === posId);
            if (!specialists.length) {
              return `
                <div class="lineupSlot">
                  <label>#${idx + 1} ${POS_LABEL[posId]}</label>
                  <select disabled><option>${t('convocacaoEmergencia')}</option></select>
                </div>
              `;
            }
            return `
              <div class="lineupSlot">
                <label>#${idx + 1} ${POS_LABEL[posId]}</label>
                <select data-slot="${idx}">
                  ${specialists.map(p => `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name} (${p.rating}, ${Math.round(p.condition)}%)</option>`).join('')}
                </select>
              </div>
            `;
          }
          const group = slot.group;
          const specialists = eligible.filter(p => p.posId === posId);
          const sameGroup = eligible.filter(p => p.posId !== posId && p.group === group);
          const rest = eligible.filter(p => p.group !== group);
          const optHtml = p => `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name} (${p.rating}, ${Math.round(p.condition)}%)</option>`;
          return `
            <div class="lineupSlot">
              <label>#${idx + 1} ${POS_LABEL[posId]}</label>
              <select data-slot="${idx}">
                <optgroup label="${t('especialistas')}">${specialists.map(optHtml).join('')}</optgroup>
                <optgroup label="${t('mesmaLinha')}">${sameGroup.map(optHtml).join('')}</optgroup>
                <optgroup label="${t('outrasPosicoes')}">${rest.map(optHtml).join('')}</optgroup>
              </select>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderMatchday() {
  const key = state.activeCompetition;
  const c = comp(key);
  const match = myMatchThisRound(key);
  if (!match) { currentView = 'dashboard'; render(); return; }
  const oppId = match.home === c.teamId ? match.away : match.home;
  const opp = teamById[oppId];
  const myTeam = teamById[c.teamId];
  const isHome = match.home === c.teamId;
  const roundName = activeRoundName(c);

  // Pré-visualização da escalação de hoje, já considerando eventual choque de
  // agenda com a outra competição (mesmo cálculo usado quando a partida
  // realmente começar em renderLive, então o que se vê aqui é o que vai jogar).
  const {excludedIds, doubleHeaderIds} = clashInfoFor(key, match);
  const myOptions = {
    conditionOf: buildMatchConditionOf(doubleHeaderIds),
    excludedIds,
    metaOverrides: state.playerOverrides,
    skillOverrides: state.skillGrowth,
  };

  // Reseta a escalação manual em edição sempre que a partida muda (rodada
  // diferente, ou outra competição/adversário).
  const sig = matchSignature(key, c, match);
  if (manualSlotsSignature !== sig) {
    manualSlots = null;
    manualSlotsSignature = sig;
  }

  const isRealRoster = !!getRealRoster(c.teamId);
  const {xv: autoXV, bench} = formationDataFor(c.teamId, myOptions);
  if (isRealRoster && !manualSlots) manualSlots = slotsFromXV(autoXV);
  const manualXV = isRealRoster ? resolveManualXV(c.teamId, myOptions) : null;
  const effectiveXV = manualXV || autoXV;

  const clashNote = excludedIds.size
    ? `<p class="muted">${t('excluidoHoje')}</p>`
    : (doubleHeaderIds.size ? `<p class="muted">${t('jogoDuplo')}</p>` : '');

  content.innerHTML = `
    <h1>${t('diaDeJogo', {comp: competitionLabel(key), round: roundName})}</h1>
    <div class="card">
      <h3>${isHome ? t('casaVs', {home: myTeam.name, away: opp.name}) : t('casaVs', {home: opp.name, away: myTeam.name})}</h3>
      <p class="muted">${t('statsLine', {a: opp.attack, d: opp.defense, s: opp.stamina})}</p>
      ${c.stage === 'knockout' ? `<p class="muted">${t('mataDesempate')}</p>` : ''}
      ${clashNote}
      <h3>${t('escolhaTatica')}</h3>
      <div class="tacticOptions" id="tacticOptions">
        <button class="tacticBtn" data-t="agresivo"><b>${t('taticaAgresivo')}</b><span>${t('taticaAgresivoDesc')}</span></button>
        <button class="tacticBtn" data-t="equilibrado"><b>${t('taticaEquilibrado')}</b><span>${t('taticaEquilibradoDesc')}</span></button>
        <button class="tacticBtn" data-t="defensivo"><b>${t('taticaDefensivo')}</b><span>${t('taticaDefensivoDesc')}</span></button>
      </div>
      <button class="playBtn" id="startMatchBtn">${t('comecarPartida')}</button>
    </div>
    ${renderFormationHtml(effectiveXV, bench, myTeam.color, t('escalacaoHoje'))}
    ${isRealRoster ? renderLineupEditorHtml(c.teamId, myOptions) : ''}
  `;

  const opts = document.getElementById('tacticOptions');
  Array.from(opts.children).forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.t === state.tactic);
    btn.addEventListener('click', () => {
      state.tactic = btn.dataset.t;
      saveState();
      renderMatchday();
    });
  });
  document.getElementById('startMatchBtn').addEventListener('click', () => {
    currentView = 'live';
    render();
  });

  if (isRealRoster) {
    Array.from(document.querySelectorAll('.lineupEditorGrid select[data-slot]')).forEach(select => {
      select.addEventListener('change', () => {
        const idx = Number(select.dataset.slot);
        const newId = select.value;
        const dupIdx = manualSlots.findIndex((pid, i) => pid === newId && i !== idx);
        if (dupIdx !== -1) manualSlots[dupIdx] = manualSlots[idx];
        manualSlots[idx] = newId;
        renderMatchday();
      });
    });
    document.getElementById('lineupAutoBtn').addEventListener('click', () => {
      manualSlots = slotsFromXV(autoXV);
      renderMatchday();
    });
    document.getElementById('lineupSaveABtn').addEventListener('click', () => {
      state.lineupPresets[c.teamId] = state.lineupPresets[c.teamId] || {};
      state.lineupPresets[c.teamId].A = [...manualSlots];
      saveState();
      alert(t('escalacaoSalvaA'));
    });
    document.getElementById('lineupSaveBBtn').addEventListener('click', () => {
      state.lineupPresets[c.teamId] = state.lineupPresets[c.teamId] || {};
      state.lineupPresets[c.teamId].B = [...manualSlots];
      saveState();
      alert(t('escalacaoSalvaB'));
    });
    document.getElementById('lineupLoadABtn').addEventListener('click', () => {
      const preset = state.lineupPresets[c.teamId] && state.lineupPresets[c.teamId].A;
      if (!preset) { alert(t('timeANaoSalvo')); return; }
      manualSlots = [...preset];
      renderMatchday();
    });
    document.getElementById('lineupLoadBBtn').addEventListener('click', () => {
      const preset = state.lineupPresets[c.teamId] && state.lineupPresets[c.teamId].B;
      if (!preset) { alert(t('timeBNaoSalvo')); return; }
      manualSlots = [...preset];
      renderMatchday();
    });
  }
}

function pickOpponentTactic() {
  const pool = ['agresivo', 'equilibrado', 'equilibrado', 'defensivo'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function renderLive() {
  const key = state.activeCompetition;
  const c = comp(key);
  const match = myMatchThisRound(key);
  const isHome = match.home === c.teamId;
  const homeId = match.home;
  const awayId = match.away;
  const homeTeam = teamById[homeId];
  const awayTeam = teamById[awayId];
  const myTactic = state.tactic;
  const oppTactic = pickOpponentTactic();

  const tacticHome = isHome ? myTactic : oppTactic;
  const tacticAway = isHome ? oppTactic : myTactic;

  // Time do clube gerenciado entra com condição física real: jogadores mais
  // desgastados rendem menos (e a escalação prefere quem está mais fresco).
  // Se a partida cair no mesmo dia da última partida já disputada na outra
  // competição, aplica o choque de agenda: mesmo local permite escalar com
  // penalidade extra, locais diferentes tornam quem já jogou indisponível.
  const {excludedIds, doubleHeaderIds} = clashInfoFor(key, match);
  const myOptions = {
    conditionOf: buildMatchConditionOf(doubleHeaderIds),
    excludedIds,
    metaOverrides: state.playerOverrides,
    skillOverrides: state.skillGrowth,
  };
  // Se o manager escalou manualmente na tela de Dia de Jogo, usa essa
  // escalação em vez da seleção automática (cai pro automático se alguma
  // posição de primeira línea tiver ficado sem especialista disponível).
  const manualXV = getRealRoster(c.teamId) ? resolveManualXV(c.teamId, myOptions) : null;
  const mySquad = manualXV || squadOf(c.teamId, myOptions);
  const homeSquad = homeId === c.teamId ? mySquad : squadOf(homeId);
  const awaySquad = awayId === c.teamId ? mySquad : squadOf(awayId);
  pendingMyXV = mySquad;

  const result = simulateMatch(
    homeTeam, homeSquad, tacticHome,
    awayTeam, awaySquad, tacticAway,
  );

  // Mata-mata não permite empate: se a simulação terminou empatada, resolve
  // aqui mesmo (antes de exibir/animar) para que o placar mostrado ao vivo
  // já seja o mesmo que será persistido na tabela/chaveamento.
  if (c.stage === 'knockout' && result.scoreA === result.scoreB) {
    const [a, b] = breakTie(result.scoreA, result.scoreB);
    result.scoreA = a;
    result.scoreB = b;
    result.wentToTiebreak = true;
    if (result.ticks.length) {
      const lastTick = result.ticks[result.ticks.length - 1];
      lastTick.scoreA = a;
      lastTick.scoreB = b;
    }
  }

  content.innerHTML = `
    <div id="matchWrap">
      <div id="scoreboard">
        <div class="side"><span class="crestSmall" style="background:${homeTeam.color}">${crestCode(homeTeam)}</span>${homeTeam.name}</div>
        <div class="center">
          <div class="clock" id="clockEl">0'</div>
          <div class="scoreNum"><span id="scoreHomeEl">0</span> - <span id="scoreAwayEl">0</span></div>
        </div>
        <div class="side">${awayTeam.name}<span class="crestSmall" style="background:${awayTeam.color}">${crestCode(awayTeam)}</span></div>
      </div>
      <canvas id="pitch"></canvas>
      <div id="matchControls">
        <button class="ctrlBtn active" id="playPauseBtn">${t('pausar')}</button>
        <button class="ctrlBtn" data-speed="1">1x</button>
        <button class="ctrlBtn" data-speed="2">2x</button>
        <button class="ctrlBtn" data-speed="4">4x</button>
        <button class="ctrlBtn" id="skipBtn">${t('adiantar')}</button>
      </div>
      <div id="ticker"></div>
    </div>
  `;

  const canvas = document.getElementById('pitch');
  const renderer = new MatchRenderer(canvas, homeTeam, awayTeam);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());

  const ticker = document.getElementById('ticker');
  const clockEl = document.getElementById('clockEl');
  const scoreHomeEl = document.getElementById('scoreHomeEl');
  const scoreAwayEl = document.getElementById('scoreAwayEl');

  const ticks = result.ticks;
  const logByMinute = {};
  result.log.forEach(l => {
    if (!logByMinute[l.minute]) logByMinute[l.minute] = [];
    logByMinute[l.minute].push(l.text);
  });

  let tickIndex = 0;
  let playing = true;
  let speed = 1;
  const baseMsPerTick = 650;
  let lastTime = performance.now();
  let accum = 0;

  function pushLog(minute, text) {
    const line = document.createElement('div');
    line.className = 'tickerLine';
    line.innerHTML = `<span class="min">${minute}'</span>${text}`;
    ticker.prepend(line);
  }

  function applyMinute(minute) {
    if (logByMinute[minute]) logByMinute[minute].forEach(t => pushLog(minute, t));
  }

  // minuto 0 log
  applyMinute(0);

  function finish() {
    playing = false;
    matchAnim = null;
    pendingMatchResult = result;
    showSummary(result, isHome);
  }

  function step(now) {
    if (!matchAnim || matchAnim.stopped) return;
    const dt = now - lastTime;
    lastTime = now;
    if (playing) {
      accum += dt * speed;
      const msPerTick = baseMsPerTick;
      while (accum >= msPerTick && tickIndex < ticks.length) {
        accum -= msPerTick;
        tickIndex++;
        const t = ticks[tickIndex - 1];
        applyMinute(t.minute);
        scoreHomeEl.textContent = t.scoreA;
        scoreAwayEl.textContent = t.scoreB;
        clockEl.textContent = t.minute + "'";
      }
      const curr = ticks[Math.min(tickIndex, ticks.length - 1)] || {pos: 50};
      const prev = ticks[Math.max(tickIndex - 1, 0)] || {pos: 50};
      const frac = Math.min(1, accum / baseMsPerTick);
      const interpPos = prev.pos + (curr.pos - prev.pos) * frac;
      renderer.draw(interpPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent);
      if (tickIndex >= ticks.length) {
        finish();
        return;
      }
    } else {
      renderer.draw(renderer.currentPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent);
    }
    matchAnim.raf = requestAnimationFrame(step);
  }

  matchAnim = {stopped: false, raf: null};
  matchAnim.raf = requestAnimationFrame(step);

  document.getElementById('playPauseBtn').addEventListener('click', e => {
    playing = !playing;
    e.target.textContent = playing ? t('pausar') : t('continuarPlay');
  });

  Array.from(document.querySelectorAll('[data-speed]')).forEach(btn => {
    btn.addEventListener('click', () => {
      speed = Number(btn.dataset.speed);
      Array.from(document.querySelectorAll('[data-speed]')).forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('skipBtn').addEventListener('click', () => {
    while (tickIndex < ticks.length) {
      tickIndex++;
      const t = ticks[tickIndex - 1];
      applyMinute(t.minute);
    }
    scoreHomeEl.textContent = result.scoreA;
    scoreAwayEl.textContent = result.scoreB;
    clockEl.textContent = "80'";
    renderer.draw(50, result.scoreA, result.scoreB, "80'");
    if (matchAnim) { matchAnim.stopped = true; cancelAnimationFrame(matchAnim.raf); }
    finish();
  });
}

function showSummary(result, isHome) {
  const match = myMatchThisRound();
  const homeTeam = teamById[match.home];
  const awayTeam = teamById[match.away];

  const modal = document.createElement('div');
  modal.className = 'summaryModal';
  const scorersHtml = list => list.length
    ? `<ul>${list.map(s => `<li>${s.minute}' - ${s.player}</li>`).join('')}</ul>`
    : `<p class="muted">${t('semTries')}</p>`;

  modal.innerHTML = `
    <div class="summaryBox">
      <h2>${t('fimDeJogo')}</h2>
      <div class="finalScore">${homeTeam.name} ${result.scoreA} - ${result.scoreB} ${awayTeam.name}</div>
      ${result.wentToTiebreak ? `<p class="muted">${t('decididoProrrogacao')}</p>` : ''}
      <h3>${t('triesDe', {team: homeTeam.name})}</h3>
      ${scorersHtml(result.scorersA)}
      <h3>${t('triesDe', {team: awayTeam.name})}</h3>
      ${scorersHtml(result.scorersB)}
      ${result.motm ? `<p><b>${t('craqueDaPartida')}</b> ${result.motm}</p>` : ''}
      <div class="center"><button class="playBtn" id="continueBtn">${t('continuar')}</button></div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('continueBtn').addEventListener('click', () => {
    modal.remove();
    finalizeRound();
  });
}

function finalizeRound() {
  const key = state.activeCompetition;
  const c = comp(key);
  const matches = activeRoundMatches(c);
  const myMatch = matches.find(m => m.home === c.teamId || m.away === c.teamId);
  const roundsElapsedAtPlay = c.roundsElapsed;

  matches.forEach(m => {
    if (m.played) return;
    let scoreHome, scoreAway;
    if (m.home === c.teamId || m.away === c.teamId) {
      // Reaproveita o resultado já simulado e exibido ao vivo (já com
      // eventual desempate de mata-mata aplicado), para o placar persistido
      // bater exatamente com o que o usuário assistiu na quadra.
      scoreHome = pendingMatchResult.scoreA;
      scoreAway = pendingMatchResult.scoreB;
    } else {
      const r = simulateOtherMatch(m.home, m.away);
      scoreHome = r.scoreHome;
      scoreAway = r.scoreAway;
      if (c.stage === 'knockout' && scoreHome === scoreAway) {
        [scoreHome, scoreAway] = breakTie(scoreHome, scoreAway);
      }
    }
    m.played = true;
    m.scoreHome = scoreHome;
    m.scoreAway = scoreAway;
    applyMatchToStandings(c, m, scoreHome, scoreAway);
  });

  c.currentRoundIndex++;
  c.roundsElapsed++;

  // O calendário avança uma semana (7 dias): é o tempo que separa uma
  // partida e outra do MESMO time NO MESMO campeonato, e é o que os
  // jogadores têm pra recuperar a energia até a próxima rodada.
  state.calendarDay += 7;
  tickInjuries();
  tickTraining();
  if (pendingMyXV && pendingMyXV.length) {
    const venue = myMatch ? venueOf(myMatch, c.teamId) : 'home';
    // Condição/lesão por fadiga só existem pra elencos reais (curados): times
    // procedurais não têm banco pra revezar nem identidade persistente digna
    // de rastrear partida a partida.
    if (getRealRoster(c.teamId)) {
      const fatigueInjuries = [];
      pendingMyXV.forEach(p => {
        if (p.meta.emergencyCallUp) return; // convocação avulsa, não é jogador persistente do elenco
        const postMatch = declineAfterMatch(p, p.condition != null ? p.condition : 100);
        state.playerCondition[p.id] = {condition: postMatch, atDay: currentCalendarDay()};
        const injury = rollFatigueInjury(p, postMatch);
        if (injury) {
          state.playerOverrides[p.id] = {...(state.playerOverrides[p.id] || {}), ...injury};
          fatigueInjuries.push(p.name);
        }
      });
      if (fatigueInjuries.length) {
        alert(t('lesaoFadigaAlert', {names: fatigueInjuries.join(', ')}));
      }
    }
    state.lastMatch[key] = {ids: pendingMyXV.map(p => p.id), roundsElapsed: roundsElapsedAtPlay, venue};
  }

  afterRoundAdvance(c);
  pendingMatchResult = null;
  pendingMyXV = null;
  currentView = 'dashboard';
  saveState();
  render();
}

state = loadState();
render();
