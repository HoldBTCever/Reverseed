import {LEAGUES, TEAMS, generateSquad, teamOverall, leagueOfTeam, SKILL_LABELS, SKILL_CATEGORIES, SKILL_PROFILES, TRAITS, POSITIONS, teamIdentity, TRAINING_TYPES, ATTENDANCE_CATEGORIES} from './data.js';
import {simulateMatch, TACTICS, ZONE_KEYS, ZONE_STYLES, PLAY_SYSTEMS, PLAY_CODES, POD_FORMATIONS, WEATHER_TYPES, zoneForPos, defaultGamePlan, pickLineoutUnit, rollWeather, inMatchFatigueFactor} from './engine.js';
import {MatchRenderer, renderFormationHtml, renderBenchSectionHtml, FORMATION_POSITIONS} from './render.js';
import {generateFixture, initialStandings, applyResult, sortedStandings, firstKnockoutRound, nextKnockoutRound, knockoutStageName} from './fixtures.js';
import {NEA_SEED_MATCHES} from './seedNea.js';
import {PARAGUAYO_FIXTURE} from './seedParaguayo.js';
import {getRealRoster, pickStartingXV, rosterWithStatus, getStaff, getStaffQuality, specialtyStaffBonus, getFacilityQuality, getDualPartner, conditionMultiplier, getParaguaySquad, setRecruitedPlayers, YOUTH_CATEGORIES, YOUTH_CATEGORY_TOTAL_SIZE, createInitialYouthAcademy, ensureCuratedYouthPlayers, advanceYouthAcademy, effectiveOverallAt, STAFF_SKILL_LABELS} from './realSquads.js';

// Dificuldade escolhida uma vez no início do jogo (ver renderTeamSelect/
// newGame): multiplicador de ataque/defesa aplicado só no lado RIVAL das
// partidas do próprio usuário (nunca no seu time — ver matchContext.rivalMod/
// rivalSide, repassado pro engine.js em renderLive). Valores modestos, na
// mesma faixa da vantagem de mandante (HOME_ADVANTAGE ±3% em engine.js), pra
// não distorcer o resto do equilíbrio da simulação.
const DIFFICULTY_MOD = {facil: 0.90, medio: 1, dificil: 1.12};

// ---- Seleção Paraguay (Los Yacarés) ---------------------------------------
// Time "virtual" pra amistosos e torneios aleatórios: não disputa nenhuma
// competição de clubes, é escalado sob demanda com getParaguaySquad() (melhor
// XV do Curda + San José, exceto o Nacho — ver realSquads.js).
const PARAGUAY_TEAM = {id: 'SEL-PAR', name: 'Selección Paraguay', color: '#D32F2F', attack: 90, defense: 88, stamina: 85};
// Adversários fictícios pros amistosos/torneios, com força relativa
// aproximada do rugby sul-americano real (Argentina bem forte, Uruguai/Chile
// no meio, Brasil/Peru/Colômbia mais fracos).
const NATIONAL_TEAMS = [
  {id: 'NT-ARG', name: 'Argentina XV', color: '#75AADB', attack: 94, defense: 92, stamina: 90},
  {id: 'NT-URU', name: 'Uruguay XV', color: '#0038A8', attack: 85, defense: 84, stamina: 82},
  {id: 'NT-CHI', name: 'Chile XV', color: '#D52B1E', attack: 83, defense: 82, stamina: 81},
  {id: 'NT-BRA', name: 'Brasil', color: '#009739', attack: 74, defense: 73, stamina: 76},
  {id: 'NT-PER', name: 'Perú', color: '#D91023', attack: 68, defense: 66, stamina: 70},
  {id: 'NT-COL', name: 'Colombia', color: '#FCD116', attack: 65, defense: 64, stamina: 68},
];

// ---- Américas Rugby Championship (ARC) -------------------------------------
// Torneio real: Argentina XV, Uruguay XV, Chile XV e a Seleção Paraguay, todos
// contra todos (turno único, 3 rodadas) — ver startArc/finishArcRound. Enquanto
// durar, os jogadores convocados (meta.nationalTeam, mesmo pool do
// getParaguaySquad) ficam indisponíveis pros clubes de origem, no NEA e no
// Paraguaio (ver arcCalledUpIds, usado em clashInfoFor e na tela de Plantel) —
// esse é o "impacto no plantel" que o torneio causa nos clubes convocantes.
const ARC_TEAMS = [PARAGUAY_TEAM, ...NATIONAL_TEAMS.filter(t => ['NT-ARG', 'NT-URU', 'NT-CHI'].includes(t.id))];

const SAVE_KEY = 'rugbyNeaSave_v15';

// Clubes menores do Paraguaio (procedurais, sem elenco curado) de onde o
// Curda pode captar promessas reveladas (ver tickScouting).
const SMALL_PARAGUAY_TEAM_IDS = ['PAR-STC', 'PAR-LUQ', 'PAR-ASU', 'PAR-JAR', 'PAR-CRI', 'PAR-FDM'];

// Plano de jogo padrão do Curda, extraído dos documentos táticos reais do
// clube: "Tablero de Mando Territorial" (zonas/códigos), "Plan de Juego
// Febrero 2026" (zonas mais precisas 0-22/22-40/40-80/80-ingoal + os 3
// sistemas de jogo Argentina/Irlanda/Sudáfrica + glossário de códigos) e
// "Plan Defensivo de Juego" (pilar de defesa dominante — "estar antes",
// pared conectada, tackle dominante). Serve de ponto de partida quando o
// manager assume o Curda; pode ser editado livremente na tela de Tática.
// Times sem plano configurado jogam com defaultGamePlan() (sem sistema,
// equilibrado em toda zona, sem efeito nenhum).
function curdaDefaultGamePlan() {
  return {
    system: 'sudafrica', // identidade "Dominar el contacto" do clube
    zones: {
      red: {style: 'chute', code: 'AVIÓN/TORMENTA/T1', pods: '3-3-1-1'}, // saída segura: um forward recuado cobre o contra-chute
      orange: {style: 'chute', code: 'TORMENTA/T1/BOMBA', pods: '3-3-2'},
      green: {style: 'forwards', code: 'IRLANDA/BURRO', pods: '3-3-2'},
      yellow: {style: 'forwards', code: 'SUDAFRICA', pods: '4-4'}, // pick-and-go perto do ingoal, o uso real desse formato
    },
    pillars: {disciplina: 75, posse: 75, fisicalidade: 85, defesa: 85},
  };
}

// Plano de jogo do rival pra uma partida: sem isso, todo adversário jogava
// com o plano neutro (defaultGamePlan, zero modificador), enquanto só o
// clube gerenciado tinha acesso à tela de Tática — na prática um bônus
// unilateral que tornava a temporada fácil demais mesmo contra os times mais
// fortes do campeonato. Escalado pela força do próprio time (ataque/defesa/
// físico): clubes fortes jogam de forma organizada (quase no nível do Curda),
// clubes fracos ficam perto do neutro.
function aiGamePlanFor(team) {
  const strength = (team.attack + team.defense + team.stamina) / 3;
  const t = Math.max(0, Math.min(1, (strength - 55) / 31)); // ~0 nos times mais fracos, ~1 nos mais fortes
  const pillar = Math.round(40 + t * 38);
  let system = 'ninguno';
  if (t > 0.3) {
    system = (team.attack - team.defense >= 2) ? 'irlanda' : (team.defense - team.attack >= 2) ? 'argentina' : 'sudafrica';
  }
  const zoneStyle = t > 0.35 ? 'forwards' : 'equilibrado';
  return {
    system,
    zones: {
      red: {style: 'chute', code: '', pods: '3-3-2'},
      orange: {style: 'equilibrado', code: '', pods: '3-3-2'},
      green: {style: zoneStyle, code: '', pods: '3-3-2'},
      yellow: {style: zoneStyle, code: '', pods: '3-3-2'},
    },
    pillars: {disciplina: pillar, posse: pillar, fisicalidade: pillar, defesa: pillar},
  };
}

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
    navTreino: 'Entrenamiento',
    newGameBtn: 'Nuevo juego',
    newGameBtnTitle: 'Empezar un juego nuevo',
    langToggleBtn: 'Português',
    teamSelectTitle: '🏉 Elegí tu equipo',
    teamSelectDesc: 'Elegí el club que vas a dirigir como manager. Disputás el campeonato de tu país, junto con los demás clubes de la misma liga, y seguís los partidos en vivo en la cancha. Algunos clubes disputan dos ligas al mismo tiempo.',
    difficultyTitle: 'Dificultad',
    difficultyDesc: 'Elegí antes de tocar tu club — no se puede cambiar después de empezar. Solo afecta a los rivales EN TUS partidos, no cambia el resto de la liga.',
    difficultyFacil: 'Fácil',
    difficultyFacilDesc: 'Rivales un poco más flojos en tus partidos.',
    difficultyMedio: 'Medio',
    difficultyMedioDesc: 'Equilibrio normal del juego.',
    difficultyDificil: 'Difícil',
    difficultyDificilDesc: 'Rivales más duros en tus partidos.',
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
    copaArgentinaTitle: '🏆 Copa Argentina',
    copaIda: 'Ida',
    copaVolta: 'Vuelta',
    copaAgregado: 'Global: {my} - {opp}',
    copaCampeao: 'Campeón',
    copaVice: 'Subcampeón',
    notQualified: 'No se clasificó para los playoffs',
    eliminated: 'Eliminado',
    champion: '¡Campeón! 🏆',
    runnerUp: 'Subcampeón',
    positionLeague: '{pos}º lugar',
    positionGroup: '{pos}º — {label}',
    standingsTitle: 'Tabla de Posiciones',
    roundLabel: 'Fecha {n}',
    groupPhaseRound: 'Fase de {term} — Fecha {n}',
    currentSuffix: ' (actual)',
    fixtureTitle: 'Fixture — Ida y Vuelta',
    dipTitle: 'Entrenamiento individual (DIP)',
    focusLabel: 'Foco',
    noneClubTraining: 'Ninguno (solo entrenamiento de club)',
    dipHelp: 'Entrenamiento individual intensivo (DIP): mejora garantizada en el atributo elegido, más rápido que el entrenamiento de club, a costa de mucho más desgaste físico. Rinde según la frecuencia de entreno del jugador — de 0 (frecuencia 15 o menos) hasta 5 veces por semana (frecuencia 20).',
    dipDaysCap: 'Esta semana rinde {days}/{max} veces (frecuencia de entreno y físico actuales).',
    posTrainingNone: 'Sin nueva posición',
    posTrainingLabel: 'Entrenar nueva posición',
    posTrainingProgress: '{pos}: semana {current}/{total}',
    posTrainingLearnedAlert: '{list} completó el entrenamiento y ahora también puede jugar en una nueva posición.',
    assiduidadeTitle: 'Asiduidad',
    treinoIndisponivel: 'Este club no tiene plantel curado, así que no hay entrenamiento individual para gestionar.',
    trainingFocusTitle: 'Foco de entrenamiento de la semana',
    trainingFocusHelp: 'Elegí un tipo de entrenamiento por día — cada tipo trabaja varios atributos relacionados a la vez (ej.: "Duelo" mejora decisión, pase, recepción y aceleración juntos), siempre respetando la posición de cada jugador. Sin nada elegido, vuelve al sorteo automático.',
    trainingAutomatico: 'Automático',
    lineoutGroupTitle: 'Grupo de entrenamiento: line-out',
    lineoutGroupHelp: 'Elegí los lanzadores, saltadores y levantadores que van a entrenar juntos — cualquier cantidad, incluidos los juveniles M16/M18 (16+ años) de la base. Cada uno mejora la skill de su rol (lanzamiento, salto, fuerza) y el grupo entero gana entrosamiento entre sí, lo que mejora el timing del line-out en los partidos. Rinde según la determinación y el físico de cada uno, igual que el DIP.',
    lineoutGroupHooker: 'Lanzadores',
    lineoutGroupJumper: 'Saltadores',
    lineoutGroupLifter: 'Levantadores',
    lineoutGroupActivate: 'Activar entrenamiento de grupo esta semana',
    trainSeg: 'Lunes',
    trainTer: 'Martes',
    trainQui: 'Jueves',
    trainLivre: 'Libre (automático)',
    navTatica: 'Táctica',
    taticaTitle: 'Táctica — {team}',
    taticaHelp: 'Definí el plan de juego por zona del campo, igual que el "tablero de mando territorial" que usan los clubes de verdad: tocá una franja de la cancha para editar esa zona. Cada zona tiene un estilo y una formación de pods propios, que se aplican en la simulación en vivo (y se ven en la franja de colores arriba de la cancha, con el código de la jugada activa).',
    zonasCampoTitle: 'Zonas del campo',
    zonaVermelha: 'Zona Roja (0-22 propia)',
    zonaLaranja: 'Zona Naranja (22-40)',
    zonaVerde: 'Zona Verde (40-80)',
    zonaDourada: 'Zona Dorada (80-Ingoal)',
    estiloDeJogo: 'Estilo de juego',
    codigoComunicacao: 'Código de comunicación',
    codigoPlaceholder: 'ej: AVIÓN',
    estiloChute: 'Salida por el pie',
    estiloEquilibrado: 'Equilibrado',
    estiloForwards: 'Forwards / juego corrido',
    podFormacaoLabel: 'Formación de forwards (pods)',
    podDesc_332: 'Dos grupos de 3 adelante y un grupo de 2 de apoyo más atrás.',
    podDesc_1331: 'Un forward abierto en cada punta del campo, dos grupos de 3 en el medio.',
    podDesc_3311: 'Dos grupos de 3 adelante, un jugador de apoyo y otro más retrasado.',
    podDesc_2222: 'Cuatro parejas escalonadas — un back queda detrás de las dos primeras, dando opción de pase.',
    podDesc_44: 'Dos grupos de 4 bien juntos — pick and go cerca del ingoal, ganando metros de a poco con potencia.',
    sistemaTitle: 'Sistema de juego',
    sistemaHelp: 'La identidad táctica general del equipo, además del estilo por zona — cada sistema tiene su propia formación de apoyo. Se aplica en todo el partido.',
    sistema_ninguno: 'Ninguno (solo estilo por zona)',
    sistema_argentina: 'Argentina — Juego de Control (pocos pases, mucho pie, muy disciplinado)',
    sistema_irlanda: 'Irlanda — Juego de Fases (mucho volumen, ocupa todo el ancho, arriesgado)',
    sistema_sudafrica: 'Sudáfrica — Juego Frontal (penetrante, domina el contacto, pases cortos)',
    formacaoApoio: 'Formación de apoyo: {f}',
    pilaresTitle: 'Pilares de identidad',
    pilaresHelp: 'Modificadores fijos para todo el partido, sin importar la zona.',
    pilar_disciplina: 'Disciplina de zona',
    pilar_posse: 'Posesión y control',
    pilar_fisicalidade: 'Fisicalidad absoluta',
    pilar_defesa: 'Defensa dominante (estar antes, pared, tackle)',
    resetarPlano: 'Restablecer a equilibrado',
    carregarPlanoCurda: 'Cargar plan del Tablero de Mando (Curda)',
    pdfUploadTitle: 'Enviar prancheta táctica en PDF',
    pdfUploadHelp: 'Subí el PDF que te llega antes de cada partido. El archivo queda guardado acá como referencia — para que el equipo "se ajuste" a la nueva estrategia, actualizá manualmente el estilo/código de cada zona arriba según lo que diga el documento (todavía no hay lectura automática del contenido del PDF).',
    pdfListaVazia: 'Todavía no subiste ninguna prancheta.',
    verPdf: 'Ver PDF',
    removerPdf: 'Eliminar',
    pdfTipoInvalido: 'Ese archivo no es un PDF.',
    pdfErroSalvar: 'No se pudo guardar el PDF en este navegador.',
    pdfNaoEncontrado: 'No se encontró el archivo guardado.',
    navSelecao: 'Selección',
    navSobre: 'Sobre el juego',
    selecaoTitle: 'Selección Paraguay',
    selecaoEscalacao: 'Formación titular',
    selecaoConvocados: 'Convocados',
    selecaoColClube: 'Club',
    selecaoHistoricoTitle: 'Historial',
    selecaoSemHistorico: 'Todavía no se jugó ningún partido de la selección.',
    selecaoColPartida: 'Partido',
    selecaoColResultado: 'Resultado',
    selecaoColTipo: 'Tipo',
    selecaoTorneioLinha: 'Torneo aleatorio',
    selecaoAmistosoLabel: 'Amistoso',
    arcTitle: 'Américas Rugby Championship',
    arcIntro: 'Argentina XV, Uruguay XV, Chile XV y la Selección Paraguay se enfrentan todos contra todos, en forma automática — vos manejás el Curda, no la Selección. Los jugadores convocados no están disponibles para sus clubes de origen mientras el torneo esté en curso.',
    arcProximaRodada: 'Próxima fecha: Fecha {n}',
    arcCampeao: 'Campeón del ARC: {champion}',
    convocadoSelecao: 'Convocado a la Selección',
    arcConvocadosNota: '⚠️ Algunos jugadores están convocados al Américas Rugby Championship y no están disponibles para el club mientras dure el torneo.',
    captacaoTitle: 'Captación de promesas',
    captacaoHelp: 'De vez en cuando aparece una promesa revelada en un club chico del Paraguayo, lista para ser invitada al Curda — el jugador decide si acepta o no.',
    captacaoVazio: 'Ninguna promesa disponible por ahora. Volvé a mirar después de la próxima fecha.',
    captacaoColOrigem: 'Club de origen',
    captacaoConvidar: 'Invitar',
    captacaoAceitou: '¡{name} aceptó la invitación y se sumó al Curda!',
    captacaoRecusou: '{name} rechazó la invitación — prefirió seguir en el {club}.',
    captacaoRecusouEstrangeiro: '{name} rechazó la invitación — decidió no seguir con el rugby por ahora.',
    baseTitle: 'Categorías de base (Dante Legui)',
    baseHelp: 'M14, M15, M16 y M18: cada tanto toda la base sube una categoría — quien estaba en M18 se gradúa y se suma directo al plantel principal. Cada categoría tiene al menos 23 jugadores; acá se muestran solo los más destacados.',
    baseFormados: '¡Se graduaron de las categorías de base y se sumaron al plantel principal: {names}!',
    agendaBloqueado: 'Jugá primero el partido pendiente de {comp} — las dos competencias siguen la misma agenda semanal.',
    agendaIrPara: 'Ir a {comp}',
    navAgenda: 'Agenda',
    agendaTitle: 'Agenda del mes',
    agendaHelp: 'Entrenamiento lunes, martes y jueves; partidos los sábados. Hacé clic en un partido pendiente para ir a prepararlo.',
    agendaTreino: 'Entrenamiento',
    biometria: 'Biometría',
    altura: 'Altura',
    peso: 'Peso',
    traitsLabel: 'Rasgos',
    altPosPrefix: 'tb.',
    altPosTitle: 'También puede jugar en esta posición',
    media: 'Promedio {category}',
    condicaoFisica: 'Condición física: {v}%',
    anos: '{age} años',
    potencial: 'potencial {p}',
    lesaoFadigaBadge: 'lesión por fatiga',
    lesionado: 'Lesionado ({label})',
    indisponivel: 'No disponible (compromiso simultáneo)',
    titular: 'Titular #{n}',
    reserva: 'Reserva',
    reservas: 'Reservas',
    escolherReserva: 'Elegir suplente',
    removerReserva: 'Quitar de la lista',
    elencoTitle: 'Plantel — {team}',
    escalacaoAtual: 'Formación titular actual',
    escalacaoSimples: 'Formación titular',
    explicacaoCategorias: 'Técnico, Mental y Físico son promedios de categoría — hacé clic en un jugador para ver los 22 atributos individuales, biometría y rasgos.',
    explicacaoPrimeiraLinea: 'Pilares y hooker son especialistas de primera línea: si faltan, el club tiene que convocar de urgencia a un juvenil de 18 años en vez de improvisar con otro jugador.',
    explicacaoCondicao: 'La condición baja después de cada partido (más para quien tiene menos resistencia) y se recupera con el tiempo; los jugadores muy desgastados rinden menos y corren más riesgo de lesión.',
    explicacaoTreino: 'El club entrena lunes, martes y jueves: fatiga leve en cada fecha, pero evolución gradual de los atributos a lo largo de la temporada. La frecuencia de entreno de cada jugador (escala propia, no es una skill de juego) define cuántas veces por semana puede hacer entrenamiento individual intensivo (DIP) en un atributo específico, haciendo clic en el jugador: frecuencia 20 = 5 veces, 19 = 4, 18 = 3, 17 = 2, 16 = 1, 15 = ningún DIP pero asiste a todos los entrenamientos generales; por debajo de 15 falta a algunos entrenamientos generales por mes.',
    plantelCompleto: 'Plantel completo ({n} jugadores — titulares destacados)',
    porOverall: 'Por overall',
    porPosicao: 'Por posición',
    verTodosPostos: 'Ver todos los puestos',
    semDestaquePosto: 'Ningún destacado en este puesto todavía',
    colStatus: 'Estado',
    colJogador: 'Jugador',
    colPosicao: 'Posición',
    colOverall: 'Overall',
    colCondicao: 'Condición',
    colTecnico: 'Técnico',
    colMental: 'Mental',
    colFisico: 'Físico',
    colBio: 'Bio',
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
    fecharSeletor: 'Cerrar selector',
    verMais: 'Ver más',
    verMenos: 'Ver menos',
    subsBtnLabel: '🔄 Sustituciones ({used}/{max})',
    subsPanelTitle: 'Sustituciones ({used}/{max})',
    subsPickOut: 'Elegí quién sale',
    subsPickIn: 'Elegí quién entra por {name}',
    subsNoneLeft: 'Ya usaste las {max} sustituciones disponibles.',
    subsBankEmpty: 'No hay suplentes disponibles para esa posición.',
    subsEnCancha: 'Mover un titular',
    subsPickInFor: 'Elegí quién entra por {name} ({pos})',
    subsCancelMove: 'Cancelar movimiento',
    subChangeLog: 'Cambio en {team}: entra {in}, sale {out}.',
    subMoveLog: '{team}: {player} pasa de {from} a {to}.',
    medBloodLog: '🩸 Corte en {player} ({team}): sale al bloodbin, entra {in} de forma temporal.',
    medHiaLog: '🏥 Golpe en la cabeza de {player} ({team}): va a la evaluación HIA, entra {in} de forma temporal.',
    medHiaFailLog: '⛔ {player} ({team}) no pasó la evaluación HIA y no vuelve más a la cancha.',
    medReturnLog: '✅ {player} ({team}) vuelve a la cancha.',
    diaDeJogo: 'Día de partido — {comp} — {round}',
    casaVs: '{home} (local) vs {away} (visitante)',
    weatherLine: 'Clima: {weather}',
    weatherSeco: '☀️ Tiempo firme',
    weatherChuva: '🌧️ Lluvia',
    weatherVento: '💨 Viento fuerte',
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
    statsTitle: 'Estadísticas del partido',
    statTerritorio: 'Territorio',
    statQuiebres: 'Quiebres de línea',
    statTurnovers: 'Turnovers ganados',
    statErrores: 'Errores de manejo',
    statScrums: 'Scrums ganados',
    statLineouts: 'Lineouts ganados',
    statConversiones: 'Conversiones',
    statPenales: 'Penales',
    statDrops: 'Drop goals',
    statTarjetas: 'Tarjetas',
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
    navTreino: 'Treino',
    newGameBtn: 'Novo jogo',
    newGameBtnTitle: 'Começar um novo jogo',
    langToggleBtn: 'Español',
    teamSelectTitle: '🏉 Escolha seu time',
    teamSelectDesc: 'Selecione o clube que você vai comandar como manager. Você disputa o campeonato do seu país, junto com os outros clubes da mesma liga, e acompanha as partidas ao vivo na quadra. Alguns clubes disputam duas ligas ao mesmo tempo.',
    difficultyTitle: 'Dificuldade',
    difficultyDesc: 'Escolha antes de clicar no seu clube — não dá pra mudar depois de começar. Só afeta os rivais NAS SUAS partidas, não muda o resto da liga.',
    difficultyFacil: 'Fácil',
    difficultyFacilDesc: 'Rivais um pouco mais fracos nas suas partidas.',
    difficultyMedio: 'Médio',
    difficultyMedioDesc: 'Equilíbrio normal do jogo.',
    difficultyDificil: 'Difícil',
    difficultyDificilDesc: 'Rivais mais duros nas suas partidas.',
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
    copaArgentinaTitle: '🏆 Copa Argentina',
    copaIda: 'Ida',
    copaVolta: 'Volta',
    copaAgregado: 'Agregado: {my} - {opp}',
    copaCampeao: 'Campeão',
    copaVice: 'Vice-campeão',
    notQualified: 'Não se classificou para o mata-mata',
    eliminated: 'Eliminado',
    champion: 'Campeão! 🏆',
    runnerUp: 'Vice-campeão',
    positionLeague: '{pos}º lugar',
    positionGroup: '{pos}º — {label}',
    standingsTitle: 'Tabela de Classificação',
    roundLabel: 'Rodada {n}',
    groupPhaseRound: 'Fase de {term} — Rodada {n}',
    currentSuffix: ' (atual)',
    fixtureTitle: 'Fixture — Turno e Returno',
    dipTitle: 'Treino individual (DIP)',
    focusLabel: 'Foco',
    noneClubTraining: 'Nenhum (só treino de clube)',
    dipHelp: 'Treino individual intensivo (DIP): evolui garantido no atributo escolhido, mais rápido que o treino de clube, à custa de bem mais desgaste físico. Rende conforme a frequência de treino do jogador — de 0 (frequência 15 ou menos) até 5x por semana (frequência 20).',
    dipDaysCap: 'Essa semana rende {days}/{max} vezes (frequência de treino e físico atuais).',
    posTrainingNone: 'Sem nova posição',
    posTrainingLabel: 'Treinar nova posição',
    posTrainingProgress: '{pos}: semana {current}/{total}',
    posTrainingLearnedAlert: '{list} terminou o treinamento e agora também pode jogar numa posição nova.',
    assiduidadeTitle: 'Assiduidade',
    treinoIndisponivel: 'Esse clube não tem plantel curado, então não tem treino individual pra gerenciar.',
    trainingFocusTitle: 'Foco de treino da semana',
    trainingFocusHelp: 'Escolha um tipo de treino por dia — cada tipo trabalha vários atributos relacionados ao mesmo tempo (ex.: "Duelo" evolui decisão, passe, recepção e aceleração juntos), sempre respeitando a posição de cada jogador. Sem nada escolhido, volta pro sorteio automático.',
    trainingAutomatico: 'Automático',
    lineoutGroupTitle: 'Grupo de treino: line-out',
    lineoutGroupHelp: 'Escolha os lançadores, saltadores e levantadores que vão treinar juntos — quantos quiser, incluindo os juvenis M16/M18 (16+ anos) da base. Cada um evolui a skill do seu papel (lançamento, salto, força) e o grupo inteiro ganha entrosamento entre si, o que melhora o timing do line-out nas partidas. Rende conforme a determinação e o físico de cada um, igual o DIP.',
    lineoutGroupHooker: 'Lançadores',
    lineoutGroupJumper: 'Saltadores',
    lineoutGroupLifter: 'Levantadores',
    lineoutGroupActivate: 'Ativar treino de grupo essa semana',
    trainSeg: 'Segunda',
    trainTer: 'Terça',
    trainQui: 'Quinta',
    trainLivre: 'Livre (automático)',
    navTatica: 'Tática',
    taticaTitle: 'Tática — {team}',
    taticaHelp: 'Defina o plano de jogo por zona do campo, igual ao "tablero de mando territorial" que os clubes de verdade usam: toque numa faixa do campo pra editar aquela zona. Cada zona tem um estilo e uma formação de pods próprios, aplicados na simulação ao vivo (e visíveis na faixa colorida acima do campo, com o código da jogada em vigor).',
    zonasCampoTitle: 'Zonas do campo',
    zonaVermelha: 'Zona Vermelha (0-22 própria)',
    zonaLaranja: 'Zona Laranja (22-40)',
    zonaVerde: 'Zona Verde (40-80)',
    zonaDourada: 'Zona Dourada (80-Ingoal)',
    estiloDeJogo: 'Estilo de jogo',
    codigoComunicacao: 'Código de comunicação',
    codigoPlaceholder: 'ex: AVIÃO',
    estiloChute: 'Saída pelo chute',
    estiloEquilibrado: 'Equilibrado',
    estiloForwards: 'Forwards / jogo corrido',
    podFormacaoLabel: 'Formação dos forwards (pods)',
    podDesc_332: 'Dois grupos de 3 na frente e um grupo de 2 de apoio mais atrás.',
    podDesc_1331: 'Um forward aberto em cada ponta do campo, dois grupos de 3 no meio.',
    podDesc_3311: 'Dois grupos de 3 na frente, um jogador de apoio e outro mais recuado.',
    podDesc_2222: 'Quatro duplas escalonadas — um back fica atrás das duas primeiras, dando opção de passe.',
    podDesc_44: 'Dois grupos de 4 bem juntos — pick and go perto do ingoal, ganhando metros aos poucos com potência.',
    sistemaTitle: 'Sistema de jogo',
    sistemaHelp: 'A identidade tática geral do time, além do estilo por zona — cada sistema tem sua própria formação de apoio. Vale pra partida inteira.',
    sistema_ninguno: 'Nenhum (só estilo por zona)',
    sistema_argentina: 'Argentina — Jogo de Controle (poucos passes, muito pé, bem disciplinado)',
    sistema_irlanda: 'Irlanda — Jogo de Fases (muito volume, ocupa toda a largura, arriscado)',
    sistema_sudafrica: 'Sudáfrica — Jogo Frontal (penetrante, domina o contato, passes curtos)',
    formacaoApoio: 'Formação de apoio: {f}',
    pilaresTitle: 'Pilares de identidade',
    pilaresHelp: 'Modificadores fixos pra partida inteira, independente da zona.',
    pilar_disciplina: 'Disciplina de zona',
    pilar_posse: 'Posse e controle',
    pilar_fisicalidade: 'Fisicalidade absoluta',
    pilar_defesa: 'Defesa dominante (estar antes, pared, tackle)',
    resetarPlano: 'Resetar pra equilibrado',
    carregarPlanoCurda: 'Carregar plano do Tablero de Mando (Curda)',
    pdfUploadTitle: 'Enviar prancheta tática em PDF',
    pdfUploadHelp: 'Suba o PDF que chega antes de cada partida. O arquivo fica guardado aqui como referência — pra o time "se ajustar" à nova estratégia, atualize manualmente o estilo/código de cada zona acima conforme o documento (ainda não há leitura automática do conteúdo do PDF).',
    pdfListaVazia: 'Você ainda não enviou nenhuma prancheta.',
    verPdf: 'Ver PDF',
    removerPdf: 'Remover',
    pdfTipoInvalido: 'Esse arquivo não é um PDF.',
    pdfErroSalvar: 'Não foi possível salvar o PDF neste navegador.',
    pdfNaoEncontrado: 'Arquivo salvo não encontrado.',
    navSelecao: 'Seleção',
    navSobre: 'Sobre o jogo',
    selecaoTitle: 'Seleção Paraguay',
    selecaoEscalacao: 'Formação titular',
    selecaoConvocados: 'Convocados',
    selecaoColClube: 'Clube',
    selecaoHistoricoTitle: 'Histórico',
    selecaoSemHistorico: 'Ainda não rolou nenhuma partida da seleção.',
    selecaoColPartida: 'Partida',
    selecaoColResultado: 'Resultado',
    selecaoColTipo: 'Tipo',
    selecaoTorneioLinha: 'Torneio aleatório',
    selecaoAmistosoLabel: 'Amistoso',
    arcTitle: 'Américas Rugby Championship',
    arcIntro: 'Argentina XV, Uruguai XV, Chile XV e a Seleção Paraguai se enfrentam todos contra todos, de forma automática — você comanda o Curda, não a Seleção. Os jogadores convocados ficam indisponíveis pros clubes de origem enquanto o torneio estiver rolando.',
    arcProximaRodada: 'Próxima rodada: Rodada {n}',
    arcCampeao: 'Campeão do ARC: {champion}',
    convocadoSelecao: 'Convocado à Seleção',
    arcConvocadosNota: '⚠️ Alguns jogadores estão convocados pro Américas Rugby Championship e ficam indisponíveis pro clube enquanto o torneio durar.',
    captacaoTitle: 'Captação de promessas',
    captacaoHelp: 'De vez em quando surge uma promessa revelada num clube menor do Paraguaio, pronta pra ser convidada pro Curda — o jogador decide se aceita ou não.',
    captacaoVazio: 'Nenhuma promessa disponível por enquanto. Volte a olhar depois da próxima rodada.',
    captacaoColOrigem: 'Clube de origem',
    captacaoConvidar: 'Convidar',
    captacaoAceitou: '{name} aceitou o convite e se juntou ao Curda!',
    captacaoRecusou: '{name} recusou o convite — preferiu continuar no {club}.',
    captacaoRecusouEstrangeiro: '{name} recusou o convite — decidiu não seguir com o rugby por enquanto.',
    baseTitle: 'Categorias de base (Dante Legui)',
    baseHelp: 'M14, M15, M16 e M18: de vez em quando toda a base sobe uma categoria — quem estava na M18 se forma e vai direto pro plantel principal. Cada categoria tem pelo menos 23 jogadores; aqui mostramos só os mais destacados.',
    baseFormados: 'Se formaram nas categorias de base e se juntaram ao plantel principal: {names}!',
    agendaBloqueado: 'Jogue primeiro a partida pendente do {comp} — as duas competições seguem a mesma agenda semanal.',
    agendaIrPara: 'Ir pro {comp}',
    navAgenda: 'Agenda',
    agendaTitle: 'Agenda do mês',
    agendaHelp: 'Treino segunda, terça e quinta; jogos aos sábados. Clique num jogo pendente pra ir prepará-lo.',
    agendaTreino: 'Treino',
    biometria: 'Biometria',
    altura: 'Altura',
    peso: 'Peso',
    traitsLabel: 'Traits',
    altPosPrefix: 'tb.',
    altPosTitle: 'Também pode jogar nesta posição',
    media: 'Média {category}',
    condicaoFisica: 'Condição física: {v}%',
    anos: '{age} anos',
    potencial: 'potencial {p}',
    lesaoFadigaBadge: 'lesão por fadiga',
    lesionado: 'Lesionado ({label})',
    indisponivel: 'Indisponível (compromisso simultâneo)',
    titular: 'Titular #{n}',
    reserva: 'Reserva',
    reservas: 'Reservas',
    escolherReserva: 'Escolher reserva',
    removerReserva: 'Remover da lista',
    elencoTitle: 'Elenco — {team}',
    escalacaoAtual: 'Escalação titular atual',
    escalacaoSimples: 'Escalação titular',
    explicacaoCategorias: 'Técnico, Mental e Físico são médias de categoria — clique num jogador pra ver os 22 atributos individuais, biometria e traits.',
    explicacaoPrimeiraLinea: 'Pilares e hooker são especialistas de primeira línea: se faltarem, o clube precisa convocar às pressas um juvenil de 18 anos em vez de improvisar com outro jogador.',
    explicacaoCondicao: 'A condição cai após cada partida (mais para quem tem menos resistência) e se recupera com o tempo; jogadores muito desgastados rendem menos e correm mais risco de lesão.',
    explicacaoTreino: 'O clube treina segunda, terça e quinta: fadiga leve a cada rodada, mas evolução gradual dos atributos ao longo da temporada. A frequência de treino de cada jogador (escala própria, não é uma skill de jogo) define quantas vezes por semana ele pode fazer treino individual intensivo (DIP) num atributo específico, clicando no jogador: frequência 20 = 5 vezes, 19 = 4, 18 = 3, 17 = 2, 16 = 1, 15 = nenhum DIP mas frequência plena nos treinos gerais; abaixo de 15 falta alguns treinos gerais por mês.',
    plantelCompleto: 'Plantel completo ({n} jogadores — titulares em destaque)',
    porOverall: 'Por overall',
    porPosicao: 'Por posição',
    verTodosPostos: 'Ver todos os postos',
    semDestaquePosto: 'Nenhum destaque nesse posto ainda',
    colStatus: 'Status',
    colJogador: 'Jogador',
    colPosicao: 'Posição',
    colOverall: 'Overall',
    colCondicao: 'Condição',
    colTecnico: 'Técnico',
    colMental: 'Mental',
    colFisico: 'Físico',
    colBio: 'Bio',
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
    fecharSeletor: 'Fechar seletor',
    verMais: 'Ver mais',
    verMenos: 'Ver menos',
    subsBtnLabel: '🔄 Substituições ({used}/{max})',
    subsPanelTitle: 'Substituições ({used}/{max})',
    subsPickOut: 'Escolha quem sai',
    subsPickIn: 'Escolha quem entra no lugar de {name}',
    subsNoneLeft: 'Você já usou as {max} substituições disponíveis.',
    subsBankEmpty: 'Não tem reserva disponível pra essa posição.',
    subsEnCancha: 'Mover um titular',
    subsPickInFor: 'Escolha quem entra no lugar de {name} ({pos})',
    subsCancelMove: 'Cancelar movimentação',
    subChangeLog: 'Substituição no {team}: entra {in}, sai {out}.',
    subMoveLog: '{team}: {player} passa de {from} para {to}.',
    medBloodLog: '🩸 Corte em {player} ({team}): sai pro sangue, entra {in} temporariamente.',
    medHiaLog: '🏥 Pancada na cabeça de {player} ({team}): vai fazer avaliação de HIA, entra {in} temporariamente.',
    medHiaFailLog: '⛔ {player} ({team}) não passou na avaliação de HIA e não volta mais pro jogo.',
    medReturnLog: '✅ {player} ({team}) volta pro jogo.',
    diaDeJogo: 'Dia de jogo — {comp} — {round}',
    casaVs: '{home} (casa) vs {away} (visitante)',
    weatherLine: 'Clima: {weather}',
    weatherSeco: '☀️ Tempo firme',
    weatherChuva: '🌧️ Chuva',
    weatherVento: '💨 Vento forte',
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
    statsTitle: 'Estatísticas da partida',
    statTerritorio: 'Território',
    statQuiebres: 'Quebras de linha',
    statTurnovers: 'Turnovers ganhos',
    statErrores: 'Erros de manuseio',
    statScrums: 'Scrums ganhos',
    statLineouts: 'Lineouts ganhos',
    statConversiones: 'Conversões',
    statPenales: 'Penais',
    statDrops: 'Drop goals',
    statTarjetas: 'Cartões',
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
  paraguayo: 'URP',
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
  composure: 'Compostura', agility: 'Agilidad', recovery: 'Recuperación', comunicacao: 'Comunicación',
};

function skillLabel(key) {
  return lang === 'es' ? (SKILL_LABELS_ES[key] || SKILL_LABELS[key]) : SKILL_LABELS[key];
}

// O que cada atributo realmente faz na simulação (ver engine.js) — pra quem
// só tem overall/ruck/agility/recovery/sidestep/tackle não tem uma fórmula
// própria isolada, o texto é honesto sobre isso: eles pesam no overall da
// posição (ver SKILL_PROFILES em data.js), não têm um cálculo específico à
// parte como o chute ou o line-out têm.
const SKILL_DESC = {
  pass: 'Qualidade do passe — do médio scrum e do apertura, define a chance de erro de mão (handling) que perde a posse.',
  reception: 'Qualidade ao receber a bola — junto com o passe, define a chance de erro de mão; pesa mais pro fullback (recepção de chutes altos).',
  lineoutThrow: 'Precisão do lançamento no line-out — decide, junto com a compostura, se a bola chega limpa no saltador.',
  jump: 'Salto no line-out — junto da altura e do peso, decide quem vence a disputa da bola no ar.',
  tackle: 'Qualidade do desarme defensivo — não tem fórmula própria isolada, mas é o que mais pesa no overall defensivo de quase toda posição.',
  kicking: 'Precisão de chute — decide o resultado de chutes a gol e territoriais, ponderado com a compostura em momentos decisivos.',
  speed: 'Velocidade de corrida — define o ritmo ofensivo do time e quem rompe a defesa nas jogadas de ruptura.',
  strength: 'Força física — pesa no confronto do scrum e na sustentação dos levantadores no line-out.',
  stamina: 'Resistência ao longo dos 80 minutos — quanto o jogador aguenta sem perder rendimento, e quão rápido recupera condição entre partidas.',
  determination: 'Determinação — resistência mental ao cansaço; reduz o risco de lesão por fadiga.',
  ruck: 'Técnica de ruck (disputa da bola no chão após o tackle) — pesa no overall técnico, mais forte pros alas e o oitavo.',
  turnover: 'Chance de roubar a bola no chão (jackal) logo após o tackle rival — quanto maior, mais chance de virar a posse.',
  scrum: 'Técnica de scrum — decide o resultado da disputa do scrum, junto com o peso do pack.',
  dropGoal: 'Precisão no chute de drop — decide a chance de conversão quando o time tenta um drop goal.',
  sidestep: 'Capacidade de driblar (mudança de direção) — pesa no overall ofensivo, mais forte pros centros e pontas.',
  vision: 'Visão de jogo — entra na qualidade de decisão do médio scrum/apertura e na saída de bola do scrum.',
  positioning: 'Posicionamento tático — ajuda na saída de bola do scrum e no overall geral, mais forte pros postos de decisão.',
  discipline: 'Disciplina — reduz a chance de cartão amarelo/vermelho e melhora a coordenação do pack no scrum.',
  leadership: 'Liderança — melhora os chamados táticos do pack no scrum e pesa mais pros postos de comando.',
  composure: 'Sangue-frio em momentos decisivos — pesa no chute, no drop goal e no lançamento de line-out sob pressão.',
  agility: 'Agilidade — pesa no overall físico, mais forte pros jogadores de ataque que precisam mudar de direção rápido.',
  recovery: 'Recuperação física entre fases de jogo (rucks e tackles seguidos) — distinta da resistência, que é sobre os 80 minutos inteiros.',
  comunicacao: 'Comunicação — o chamado da jogada chegando certo antes da bola sair da mão; pesa forte no handling do médio scrum e do apertura (junto com o passe, define a chance de erro de mão do time), também afeta a disciplina tática (comunicação baixa nesses dois postos aumenta a chance de cartão do time inteiro) e evolui nos churrascos do grupo.',
};

const SKILL_DESC_ES = {
  pass: 'Calidad del pase — del medio scrum y del apertura, define la chance de error de mano (handling) que pierde la posesión.',
  reception: 'Calidad al recibir la pelota — junto con el pase, define la chance de error de mano; pesa más para el fullback (recepción de patadas altas).',
  lineoutThrow: 'Precisión del lanzamiento en el line-out — decide, junto con la compostura, si la pelota llega limpia al saltador.',
  jump: 'Salto en el line-out — junto con la altura y el peso, decide quién gana la disputa de la pelota en el aire.',
  tackle: 'Calidad del desarme defensivo — no tiene fórmula propia aislada, pero es lo que más pesa en el overall defensivo de casi toda posición.',
  kicking: 'Precisión de patada — decide el resultado de patadas a los palos y territoriales, ponderado con la compostura en momentos decisivos.',
  speed: 'Velocidad de carrera — define el ritmo ofensivo del equipo y quién rompe la defensa en las jugadas de ruptura.',
  strength: 'Fuerza física — pesa en el enfrentamiento del scrum y en el sostén de los levantadores en el line-out.',
  stamina: 'Resistencia a lo largo de los 80 minutos — cuánto aguanta el jugador sin perder rendimiento, y qué tan rápido recupera condición entre partidos.',
  determination: 'Determinación — resistencia mental al cansancio; reduce el riesgo de lesión por fatiga.',
  ruck: 'Técnica de ruck (disputa de la pelota en el piso tras el tackle) — pesa en el overall técnico, más fuerte para los alas y el octavo.',
  turnover: 'Chance de robar la pelota en el piso (jackal) justo después del tackle rival — cuanto mayor, más chance de dar vuelta la posesión.',
  scrum: 'Técnica de scrum — decide el resultado de la disputa del scrum, junto con el peso del pack.',
  dropGoal: 'Precisión en la patada de drop — decide la chance de conversión cuando el equipo intenta un drop goal.',
  sidestep: 'Capacidad de quiebre (cambio de dirección) — pesa en el overall ofensivo, más fuerte para centros y wings.',
  vision: 'Visión de juego — entra en la calidad de decisión del medio scrum/apertura y en la salida de pelota del scrum.',
  positioning: 'Posicionamiento táctico — ayuda en la salida de pelota del scrum y en el overall general, más fuerte para los puestos de decisión.',
  discipline: 'Disciplina — reduce la chance de tarjeta amarilla/roja y mejora la coordinación del pack en el scrum.',
  leadership: 'Liderazgo — mejora los llamados tácticos del pack en el scrum y pesa más para los puestos de mando.',
  composure: 'Sangre fría en momentos decisivos — pesa en la patada, el drop goal y el lanzamiento de line-out bajo presión.',
  agility: 'Agilidad — pesa en el overall físico, más fuerte para los jugadores de ataque que necesitan cambiar de dirección rápido.',
  recovery: 'Recuperación física entre fases de juego (rucks y tackles seguidos) — distinta de la resistencia, que es sobre los 80 minutos enteros.',
  comunicacao: 'Comunicación — el llamado de la jugada llegando correcto antes de que la pelota salga de la mano; pesa fuerte en el handling del medio scrum y del apertura (junto con el pase, define la chance de error de mano del equipo), también afecta la disciplina táctica (comunicación baja en esos dos puestos aumenta la chance de tarjeta de todo el equipo) y evoluciona en los asados del plantel.',
};

function skillDesc(key) {
  return lang === 'es' ? (SKILL_DESC_ES[key] || SKILL_DESC[key]) : SKILL_DESC[key];
}

// Assiduidade quebrada em 6 atividades (ver ATTENDANCE_CATEGORIES em
// data.js) — mesmo padrão de label/desc/abreviação dos skillLabel/skillDesc
// acima, só que pra cada atividade em vez de cada atributo de jogo.
// "CHU" já é a abreviação do skill kicking (Chute) — usa "CHR" pro
// churrasco pra não colidir na tela de detalhe do jogador.
const ATTENDANCE_SHORT = {churrasco: 'CHR', geral: 'GER', individual: 'IND', grupo: 'GRU', academia: 'ACA', video: 'VID'};
const ATTENDANCE_LABEL = {
  churrasco: 'Churrascos', geral: 'Treino geral', individual: 'Treino individual',
  grupo: 'Treino em grupo', academia: 'Academia', video: 'Análise de vídeo/palestras',
};
const ATTENDANCE_LABEL_ES = {
  churrasco: 'Asados', geral: 'Entreno general', individual: 'Entreno individual',
  grupo: 'Entreno en grupo', academia: 'Gimnasio', video: 'Análisis de video/charlas',
};
const ATTENDANCE_DESC = {
  churrasco: 'Toda quinta-feira, depois do treino — janta do time (de vez em quando, numa quarta-feira, os forwards marcam um churrasco só deles). Quem aparece entrosa com o resto do plantel presente e evolui um pouco a comunicação. Escala 8-20, sem desgaste físico.',
  geral: 'Assiduidade ao treino de clube de segunda/terça/quinta (foco da semana). Escala 8-20: abaixo de 15 o jogador chega a faltar treinos gerais.',
  individual: 'Assiduidade ao treino intensivo individual (DIP) no atributo escolhido no Elenco. Escala 8-20: 20 = 5x/semana, 15 ou menos = nenhuma sessão.',
  grupo: 'Assiduidade ao treino em grupo (ex.: grupo de line-out). Escala 8-20, mesmo funcionamento do treino individual.',
  academia: 'Assiduidade à musculação/mobilidade — evolui força, agilidade e resistência. Escala 8-20.',
  video: 'Assiduidade à análise de vídeo e palestras táticas — evolui visão de jogo e posicionamento. Escala 8-20.',
};
const ATTENDANCE_DESC_ES = {
  churrasco: 'Todos los jueves, después del entreno — cena del equipo (de vez en cuando, un miércoles, los forwards organizan un asado propio). Quien aparece se entrosa con el resto del plantel presente y evoluciona un poco la comunicación. Escala 8-20, sin desgaste físico.',
  geral: 'Asiduidad al entreno de club de lunes/martes/jueves (foco de la semana). Escala 8-20: por debajo de 15 el jugador llega a faltar entrenos generales.',
  individual: 'Asiduidad al entreno intensivo individual (DIP) en el atributo elegido en el Plantel. Escala 8-20: 20 = 5x/semana, 15 o menos = ninguna sesión.',
  grupo: 'Asiduidad al entreno en grupo (ej.: grupo de line-out). Escala 8-20, mismo funcionamiento del entreno individual.',
  academia: 'Asiduidad al gimnasio/movilidad — evoluciona fuerza, agilidad y resistencia. Escala 8-20.',
  video: 'Asiduidad al análisis de video y charlas tácticas — evoluciona visión de juego y posicionamiento. Escala 8-20.',
};
function attendanceLabel(key) {
  return lang === 'es' ? (ATTENDANCE_LABEL_ES[key] || ATTENDANCE_LABEL[key]) : ATTENDANCE_LABEL[key];
}
function attendanceDesc(key) {
  return lang === 'es' ? (ATTENDANCE_DESC_ES[key] || ATTENDANCE_DESC[key]) : ATTENDANCE_DESC[key];
}

const TRAINING_TYPES_ES = {
  duelo: 'Duelo',
  tocata: 'Tocata',
  contato: 'Contacto',
  formacao: 'Formación (scrum/maul)',
  touch: 'Touch (line-out)',
  pique: 'Pique',
  chuteAGol: 'Pateo a los palos',
  quebraDeLinha: 'Quiebre de línea',
  lideranca: 'Liderazgo',
  recuperacao: 'Recuperación',
};

function trainingTypeLabel(key) {
  const def = TRAINING_TYPES[key];
  if (!def) return key;
  return lang === 'es' ? (TRAINING_TYPES_ES[key] || def.label) : def.label;
}

function trainingTypeSkillsLabel(key) {
  const def = TRAINING_TYPES[key];
  return def ? def.skills.map(skillLabel).join(', ') : '';
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
  const agendaBtn = mainNav.querySelector('[data-view="agenda"]');
  const standingsBtn = mainNav.querySelector('[data-view="standings"]');
  const fixtureBtn = mainNav.querySelector('[data-view="fixture"]');
  const squadBtn = mainNav.querySelector('[data-view="squad"]');
  const trainingBtn = mainNav.querySelector('[data-view="training"]');
  const tacticsBtn = mainNav.querySelector('[data-view="tactics"]');
  const selectionBtn = mainNav.querySelector('[data-view="selection"]');
  const aboutBtn = mainNav.querySelector('[data-view="about"]');
  if (dashboardBtn) dashboardBtn.textContent = t('navPainel');
  if (agendaBtn) agendaBtn.textContent = t('navAgenda');
  if (standingsBtn) standingsBtn.textContent = t('navTabela');
  if (fixtureBtn) fixtureBtn.textContent = t('navFixture');
  if (squadBtn) squadBtn.textContent = t('navElenco');
  if (trainingBtn) trainingBtn.textContent = t('navTreino');
  if (tacticsBtn) tacticsBtn.textContent = t('navTatica');
  if (selectionBtn) selectionBtn.textContent = t('navSelecao');
  if (aboutBtn) aboutBtn.textContent = t('navSobre');
  const newGameBtnEl = document.getElementById('newGameBtn');
  newGameBtnEl.textContent = t('newGameBtn');
  newGameBtnEl.title = t('newGameBtnTitle');
  const langBtn = document.getElementById('langToggleBtn');
  if (langBtn) langBtn.textContent = t('langToggleBtn');
}

const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));
// Seleções (amistosos avulsos e o ARC) não são clubes de LEAGUES/TEAMS, mas
// precisam estar em teamById pra reaproveitar renderTableHtml/
// renderRoundRobinInto/crestStyle sem duplicar essa renderização.
[PARAGUAY_TEAM, ...NATIONAL_TEAMS].forEach(nt => { teamById[nt.id] = nt; });
function crestCode(team) {
  return team.id.slice(-3);
}

// Identidade de clube (cores duplas ou triplas, mascote, apelido — ver
// TEAM_IDENTITY em data.js): crest em faixas diagonais via CSS puro (sem
// imagem/arte nova) e mascote em emoji no lugar do código de 3 letras quando
// existe.
function crestStyle(team) {
  const identity = teamIdentity(team.id);
  if (!identity) return `background:${team.color}`;
  // Escudo oficial (imagem) sobrepõe o crest CSS de cores/mascote — fundo
  // branco neutro pra não brigar com a arte do brasão em vez do gradiente.
  if (identity.logo) return 'background:#fff';
  const colors = identity.colors;
  const bg = colors.length === 1
    ? `background:${colors[0]}`
    : `background:linear-gradient(135deg, ${colors.map((c, i) => `${c} ${Math.round(i * (100 / colors.length))}%, ${c} ${Math.round((i + 1) * (100 / colors.length))}%`).join(', ')})`;
  // textColor: só pra clubes de cor clara sem mascote (ex.: Mendoza RC, só
  // branco) — sem isso o código de 3 letras/sigla (branco por padrão) fica
  // ilegível sobre o crest. Não é uma cor de identidade, é só legibilidade.
  return identity.textColor ? `${bg}; color:${identity.textColor}` : bg;
}
function crestContent(team) {
  const identity = teamIdentity(team.id);
  if (identity && identity.logo) return `<img class="teamCrestImg" src="${identity.logo}" alt="${escapeHtmlAttr(team.name)}" />`;
  if (identity && identity.mascotEmoji) return identity.mascotEmoji;
  if (identity && identity.initials) return identity.initials;
  return crestCode(team);
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
// Jogadores com mais resistência/determinação se recuperam mais rápido, e um
// nutricionista especialista (ver STAFF_SKILL_LABELS.sportsNutrition, ex.:
// Cemilson no Curda) acelera a recuperação de todo o elenco — mesmo cálculo
// de "excedente sobre o baseline" usado no bônus da base em generateYouthPlayer,
// então times sem especialista em nutrição não mudam nada.
function currentConditionOf(player) {
  const rec = state.playerCondition[player.id];
  if (!rec) return 100;
  const elapsedDays = currentCalendarDay() - rec.atDay;
  if (elapsedDays <= 0) return Math.max(0, Math.min(100, rec.condition));
  const nutritionBonus = specialtyStaffBonus(state.myTeamId, 'sportsNutrition') - getStaffQuality(state.myTeamId);
  const recoveryPerWeek = 14 + player.skills.stamina * 0.14 + player.skills.determination * 0.08 + nutritionBonus * 6;
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
let openLineupSlot = null; // índice (0-14) do slot com o seletor de jogador aberto no campo clicável, ou null se fechado
let lineupPickerAnchor = null; // {x, y} do clique que abriu o seletor, pra flutuar o popup perto do cursor
// Se o seletor aberto (Dia de Jogo OU Plantel — só um fica aberto por vez)
// está mostrando a lista de especialistas completa ou só o top 5 (padrão) —
// reseta pra colapsado sempre que um slot novo é aberto/fechado.
let lineupPickerExpanded = false;
let manualBenchSlots = null; // array de até MAX_BENCH playerIds (reservas escolhidas pra hoje) em edição na tela de Dia de Jogo
let openBenchSlot = null; // índice do slot de reserva com o seletor aberto, ou null se fechado
let benchPickerAnchor = null; // {x, y} do clique que abriu o seletor de reserva
let openTacticZone = null; // qual zona (red/orange/green/yellow) está com o editor aberto no campo tático da tela de Tática, ou null se fechado

// Mesma mecânica de clique+popup do editor de Dia de Jogo, mas pro campo
// clicável da tela de Plantel ("Escalação atual") — edita direto o preset
// Time A (state.lineupPresets[teamId].A) em vez do manualSlots efêmero da
// partida, já que aqui não existe uma partida específica em andamento.
let squadFormSlot = null;
let squadFormAnchor = null;

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ---- Armazenamento dos PDFs táticos (IndexedDB) ----------------------------
// PDFs de "prancheta tática" que o técnico envia pro time podem ter vários MB
// — grande demais pra guardar em base64 no localStorage (junto do save,
// arriscando estourar a cota do navegador). Guardamos o Blob no IndexedDB e
// só a metadata (nome, tamanho, data) fica no save normal, em state.gamePlanPdfs.
const PDF_DB_NAME = 'rugbyNeaTacticalPdfs';
const PDF_STORE = 'pdfs';

function openPdfDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDF_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PDF_STORE)) {
        req.result.createObjectStore(PDF_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfBlob(id, blob) {
  const db = await openPdfDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadPdfBlob(id) {
  const db = await openPdfDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readonly');
    const req = tx.objectStore(PDF_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePdfBlob(id) {
  const db = await openPdfDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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
  // Torneio nacional paraguaio: turno único de 7 rodadas com o calendário
  // REAL (ver seedParaguayo.js), não o gerado pelo método do círculo — os
  // confrontos exatos vêm de tabela oficial, não seguem a ordem genérica.
  const fixture = league.id === 'paraguayo'
    ? PARAGUAYO_FIXTURE.map((matches, idx) => ({
        round: idx + 1,
        matches: matches.map(m => ({...m, played: false, scoreHome: null, scoreAway: null})),
      }))
    : generateFixture(ids);
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

  // roundsElapsedBaseline guarda o ponto de partida (ex.: NEA já entra na 7ª
  // rodada, com resultados históricos reais pré-carregados) — a trava de
  // intercalação entre competições (competitionBlockedReason) compara o
  // AVANÇO desde esse ponto, não o valor absoluto, senão o NEA nasceria
  // bloqueado por já estar "na frente" antes mesmo do usuário jogar algo.
  return {teamId, league: league.id, stage: 'league', fixture, standings, currentRoundIndex, roundsElapsed: currentRoundIndex, roundsElapsedBaseline: currentRoundIndex, knockoutRounds: []};
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
    groupOf, groupFixtures, groupStandings, groupTerm: league.groupTerm || 'Grupo',
    currentRoundIndex: 0, roundsElapsed: 0, roundsElapsedBaseline: 0, knockoutRounds: [],
  };
}

// "Grupo A"/"Zona 1" — o termo ('Grupo' ou 'Zona', ver league.groupTerm) e o
// número/letra variam por competição; "Grupo"/"Zona" são grafados igual em
// espanhol e português, então não precisa de chave de i18n pra isso.
function groupDisplayName(c, g) {
  if (c.league === 'paraguayo') return g; // "Oro"/"Descenso" já são nomes prontos
  if (c.groupTerm === 'Zona') {
    const idx = Object.keys(c.groupStandings).indexOf(g);
    return `Zona ${idx + 1}`;
  }
  return `${c.groupTerm || 'Grupo'} ${g}`;
}

function buildCompetition(teamId) {
  const league = leagueOfTeam(teamId);
  return league.groups ? buildGroupCompetition(league, teamId) : buildLeagueCompetition(league, teamId);
}

function newGame(myTeamId, difficulty) {
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
    difficulty: DIFFICULTY_MOD[difficulty] ? difficulty : 'medio', // 'facil' | 'medio' | 'dificil' — escolhida uma vez no início, ver DIFFICULTY_MOD
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
    positionTraining: {}, // {[playerId]: posId} — jogador treinando pra uma posição nova (substitui o DIP normal, ver tickTraining)
    positionTrainingProgress: {}, // {[playerId]: semanasRendidas} — progresso fracionário até POSITION_TRAINING_ROUNDS_NEEDED
    roundsSinceSelected: {}, // {[playerId]: rodadas seguidas sem entrar em campo} — alimenta tickMotivationDrift
    trainingFocus: {seg: null, ter: null, qui: null}, // tipo de treino (ver TRAINING_TYPES) escolhido pelo técnico pra cada dia, ou null = automático
    chemistry: {}, // {"idA|idB": 0-100} — entrosamento entre pares de jogadores, cresce jogando junto ou treinando em grupo (ver bumpChemistry)
    trainingGroups: {lineout: {throwerIds: [], jumperIds: [], lifterIds: [], active: false}}, // grupos de treino conjunto — listas, não vaga única (ver tickGroupTraining)
    gamePlan: (myTeamId === 'ARG-CUR' || myTeamId === 'PAR-CUR') ? curdaDefaultGamePlan() : defaultGamePlan(), // plano de jogo por zona de campo (ver tela de Tática)
    gamePlanPdfs: [], // [{id, name, size, uploadedAt}] — metadados dos PDFs táticos enviados (conteúdo binário fica no IndexedDB, ver pdfStore)
    nationalTeamMatches: [], // histórico de amistosos/torneios da Seleção Paraguay (ver renderSelection)
    teamForm: {}, // {[teamId]: ['W'|'L'|'D', ...]} — últimos resultados de cada time (mais recente por último), atualizado em finalizeRound; alimenta o bônus/malus de moral (ver moraleModFromForm em engine.js)
    scoutingProspects: [], // promessas de clubes menores do Paraguaio disponíveis pra convidar (só time Curda)
    recruitedPlayers: [], // jogadores captados/formados que se juntaram ao Curda (fundidos em getRealRoster)
    youthAcademy: (myTeamId === 'ARG-CUR' || myTeamId === 'PAR-CUR') ? createInitialYouthAcademy() : null, // categorias M14/M15/M16/M18 do Curda, comandadas por Dante Legui
  };
  setRecruitedPlayers(state.recruitedPlayers);
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
// Dificuldade escolhida na tela de novo jogo, ANTES de clicar no time (ver
// renderTeamSelect) — só existe até o clique virar um newGame(team.id, ...).
let newGameDifficulty = 'medio';
let squadSortMode = 'overall'; // 'overall' (padrão) ou 'position' (1-15 titulares por camisa, depois reservas por posto)
// Posto exibido (sozinho) quando squadSortMode === 'position', em cada caixa
// (plantel principal e cada categoria de base) de forma independente;
// null = ver todos os postos. Começa em pilares, como pedido.
let squadPositionFilter = 'PI';

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

// Tooltip customizado pros botões do editor de escalação (camisas do XV e
// cartões de reserva, ver data-tip nos templates) — substitui o atributo
// title nativo do navegador, que em alguns aparelhos aparecia malposicionado
// e com contraste ruim contra o tema escuro. Fica sempre posicionado como
// position:fixed anexado direto ao body, pra nunca ser cortado pelo
// overflow-x:auto do carrossel de reservas (".benchRow"). Delegado no
// document (registrado uma única vez aqui), então funciona em qualquer
// tela re-renderizada sem precisar reanexar listener por elemento. Só
// aparece com mouse de verdade — em toque, o próprio clique já abre o
// seletor, então um tooltip por toque só atrapalharia.
let activeTooltipEl = null;
function hideCustomTooltip() {
  if (activeTooltipEl) { activeTooltipEl.remove(); activeTooltipEl = null; }
}
function showCustomTooltip(target) {
  const text = target.dataset.tip;
  if (!text) return;
  hideCustomTooltip();
  const tip = document.createElement('div');
  tip.className = 'customTooltip';
  tip.textContent = text;
  document.body.appendChild(tip);
  const rect = target.getBoundingClientRect();
  const tw = tip.offsetWidth;
  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
  let top = rect.top - tip.offsetHeight - 8;
  if (top < 6) top = rect.bottom + 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  activeTooltipEl = tip;
}
document.addEventListener('pointerover', ev => {
  if (ev.pointerType === 'touch') return;
  const el = ev.target.closest('[data-tip]');
  if (el) showCustomTooltip(el);
});
document.addEventListener('pointerout', ev => {
  if (ev.target.closest('[data-tip]')) hideCustomTooltip();
});
document.addEventListener('pointerdown', hideCustomTooltip);
document.addEventListener('scroll', hideCustomTooltip, true);

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
    const idx = c.currentRoundIndex;
    const rounds = Object.values(c.groupFixtures).map(fx => fx[idx]).filter(Boolean);
    if (!rounds.length) return null;
    return rounds.flatMap(r => r.matches);
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
    const r = Object.values(c.groupFixtures).some(fx => fx[idx]);
    const term = c.groupTerm === 'Zona' ? 'Zonas' : 'Grupos';
    return r ? t('groupPhaseRound', {term, n: idx + 1}) : null;
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

// Impede jogar vários jogos seguidos de UMA competição enquanto a outra (pro
// clube dual) fica parada — as duas rodam na mesma agenda semanal, então
// roundsElapsed das duas precisa ficar sempre bem próximo (ver clashInfoFor,
// que já assume "mesmo roundsElapsed = mesma data"). Bloqueia `key` se a
// outra competição ainda tem jogo pendente E está atrasada em relação a ela.
function competitionBlockedReason(key) {
  const otherKey = otherCompetitionKey(key);
  if (!otherKey) return null;
  const c = comp(key);
  const other = comp(otherKey);
  if (!myMatchThisRound(otherKey)) return null; // outra competição já terminou a temporada, sem trava
  const progress = x => x.roundsElapsed - (x.roundsElapsedBaseline || 0);
  if (progress(other) < progress(c)) return otherKey;
  return null;
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
// "Mesma rodada" tem que comparar o AVANÇO desde o próprio baseline de cada
// competição (ver roundsElapsedBaseline/progress em competitionBlockedReason),
// não o roundsElapsed bruto — senão nunca bate quando as duas competições
// começam de baselines diferentes (ex.: NEA já entra na 7ª rodada com
// resultados históricos, a Apertura começa do zero), e o choque de agenda
// nunca dispara mesmo estando na mesma "semana" real.
function progressOf(x) {
  return x.roundsElapsed - (x.roundsElapsedBaseline || 0);
}
function scheduleClashInfoFor(key, match) {
  const c = comp(key);
  const otherKey = otherCompetitionKey(key);
  const empty = {excludedIds: new Set(), doubleHeaderIds: new Set()};
  if (!otherKey) return empty;
  const sibling = state.lastMatch[otherKey];
  if (!sibling || sibling.progress !== progressOf(c)) return empty;
  const thisVenue = venueOf(match, c.teamId);
  if (thisVenue === sibling.venue) {
    return {excludedIds: new Set(), doubleHeaderIds: new Set(sibling.ids)};
  }
  return {excludedIds: new Set(sibling.ids), doubleHeaderIds: new Set()};
}

// IDs de jogadores atualmente convocados pro Américas Rugby Championship
// (mesmo pool do getParaguaySquad — titulares + banco), indisponíveis pros
// clubes de origem enquanto o torneio não terminar (ver ARC_TEAMS/startArc).
function arcCalledUpIds() {
  if (!state.arc || state.arc.finished) return new Set();
  const {xv, bench} = getParaguaySquad();
  return new Set([...xv, ...bench].map(p => p.id));
}

// Junta choque de agenda (entre as duas competições do clube dual) com a
// convocação pro ARC — as duas causas de indisponibilidade se combinam numa
// única lista de excludedIds pra quem monta a escalação.
function clashInfoFor(key, match) {
  const base = scheduleClashInfoFor(key, match);
  const arcIds = arcCalledUpIds();
  if (!arcIds.size) return base;
  return {
    excludedIds: new Set([...base.excludedIds, ...arcIds]),
    doubleHeaderIds: base.doubleHeaderIds,
  };
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

// Partes do corpo possíveis numa lesão dinâmica por fadiga — chave interna
// em inglês (não aparece pra o usuário), só o "shoulder" tem efeito mecânico
// específico hoje (lineout/scrum em engine.js, ver shoulderPenalty); as
// outras só entram no rótulo exibido da lesão, via INJURY_BODY_PART_LABEL.
const INJURY_BODY_PARTS = ['shoulder', 'knee', 'ankle', 'rib', 'thigh'];
const INJURY_BODY_PART_LABEL = {
  es: {shoulder: 'hombro', knee: 'rodilla', ankle: 'tobillo', rib: 'costilla', thigh: 'muslo'},
  pt: {shoulder: 'ombro', knee: 'joelho', ankle: 'tornozelo', rib: 'costela', thigh: 'coxa'},
};

// Semanas em que uma lesão de ombro já recuperada ainda pesa (mais leve) no
// lineout/scrum — ver shoulderPenalty em engine.js, alimentado por
// meta.recentInjuryBodyPart, ligado abaixo em tickInjuries.
const SHOULDER_RECOVERY_WEEKS = 4;

// Risco de lesão por fadiga: só entra em jogo quando o jogador termina a
// partida muito desgastado; determinação alta reduz o risco (jogadores mais
// durões se cuidam/se seguram melhor mesmo cansados).
function rollFatigueInjury(player, postMatchCondition) {
  if (postMatchCondition >= 35) return null;
  let risk = Math.max(0.02, 0.10 - player.skills.determination * 0.0008);
  if (player.meta && player.meta.traits && player.meta.traits.includes('injuryProne')) risk *= 1.8;
  if (Math.random() >= risk) return null;
  const weeks = 1 + Math.floor(Math.random() * 4);
  const bodyPart = INJURY_BODY_PARTS[Math.floor(Math.random() * INJURY_BODY_PARTS.length)];
  return {injuryWeeks: weeks, injuryLabel: injuryLabelWithBodyPart(weeks, bodyPart), dynamicInjury: true, bodyPart};
}

function weeksLabel(weeks) {
  if (weeks >= 8) {
    const months = Math.round(weeks / 4.33);
    return t(months > 1 ? 'mesN' : 'mes1', {n: months});
  }
  return t(weeks > 1 ? 'semanaN' : 'semana1', {n: weeks});
}

function injuryLabelWithBodyPart(weeks, bodyPart) {
  const base = weeksLabel(weeks);
  const partLabel = bodyPart && INJURY_BODY_PART_LABEL[lang][bodyPart];
  return partLabel ? `${base} (${partLabel})` : base;
}

// Passa 1 semana pra qualquer lesão em andamento do elenco do clube
// gerenciado (tanto as lesões estáticas do elenco curado quanto as dinâmicas
// por fadiga), dando alta assim que chega a zero. Chamada uma vez por
// rodada finalizada (mesmo relógio global usado pra recuperação de condição).
// Ao curar uma lesão de ombro, mantém uma penalidade residual leve por mais
// algumas semanas (recentInjuryBodyPart), que o motor usa no lineout/scrum
// (ver shoulderPenalty em engine.js) — mesmo recuperado, o ombro ainda não
// está 100%. Um fisioterapeuta especialista (ver STAFF_SKILL_LABELS.
// physiotherapy, ex.: Juan Carmona) dá uma chance de tirar uma semana extra
// da recuperação a cada rodada — mesmo excedente sobre o baseline usado nos
// outros bônus de especialidade, então times sem especialista não mudam nada.
function tickInjuries() {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return;
  const physioBonus = Math.max(0, specialtyStaffBonus(state.myTeamId, 'physiotherapy') - getStaffQuality(state.myTeamId));
  roster.forEach(p => {
    const override = state.playerOverrides[p.id];
    const effectiveWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;

    if (effectiveWeeks) {
      const extraWeek = Math.random() < physioBonus ? 1 : 0;
      const remaining = Math.max(0, effectiveWeeks - 1 - extraWeek);
      const bodyPart = (override && override.bodyPart) || p.meta.bodyPart;
      const justHealed = remaining === 0;
      state.playerOverrides[p.id] = {
        ...(override || {}),
        injuryWeeks: remaining,
        injuryLabel: remaining > 0 ? injuryLabelWithBodyPart(remaining, bodyPart) : undefined,
        ...(justHealed && bodyPart === 'shoulder' ? {recentInjuryBodyPart: 'shoulder', recentInjuryWeeksLeft: SHOULDER_RECOVERY_WEEKS} : {}),
      };
      return;
    }

    const recentWeeksLeft = override && override.recentInjuryWeeksLeft;
    if (recentWeeksLeft) {
      const remaining = Math.max(0, recentWeeksLeft - 1);
      state.playerOverrides[p.id] = {
        ...override,
        recentInjuryWeeksLeft: remaining > 0 ? remaining : undefined,
        recentInjuryBodyPart: remaining > 0 ? override.recentInjuryBodyPart : undefined,
      };
    }
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

// Entrosamento (chemistry) entre um par de jogadores, 0-100: cresce devagar
// só de jogar junto (bumpChemistryForXV, chamado após cada partida) e mais
// rápido com treino de grupo dedicado (ver tickGroupTraining). Guardado só
// como {"idA|idB": valor} — ordem alfabética dos ids pra não duplicar o par.
function chemistryKey(idA, idB) {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}
function bumpChemistry(idA, idB, amount) {
  if (!idA || !idB || idA === idB) return;
  state.chemistry = state.chemistry || {};
  const key = chemistryKey(idA, idB);
  state.chemistry[key] = Math.min(100, (state.chemistry[key] || 0) + amount);
}
function chemistryBetween(idA, idB) {
  if (!state.chemistry || !idA || !idB || idA === idB) return 0;
  return state.chemistry[chemistryKey(idA, idB)] || 0;
}
// Entrosamento sobe um pouco entre TODOS os pares de quem jogou junto numa
// partida (titulares + quem entrou) — times que mantêm a base entrosam mais
// com o tempo, natural de jogar sempre com os mesmos companheiros.
function bumpChemistryForXV(players) {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      bumpChemistry(players[i].id, players[j].id, 1.5);
    }
  }
}

function avgPairChemistry(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) pairs.push(chemistryBetween(ids[i], ids[j]));
  }
  return pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 0;
}

// Bônus de entrosamento do quarteto de line-out (lançador+saltador+2
// levantadores, mesma seleção que engine.js usa pra decidir o lineout — ver
// pickLineoutUnit) e do pack de scrum (todos os forwards titulares), a
// partir de quem já jogou/treinou junto (ver chemistryBetween). Escala de
// 0-100 pra um bônus pequeno (poucos pontos), somado no timing do
// lineout/scrum em engine.js (ver chemistryBonus lá).
function computeChemistryBonuses(squad) {
  const unit = pickLineoutUnit(squad);
  const unitIds = [unit.thrower, unit.jumper, ...unit.lifters].map(p => p.id);
  const forwardIds = squad.filter(p => p.group === 'forward').map(p => p.id);
  return {
    lineout: avgPairChemistry(unitIds) * 0.08,
    scrum: avgPairChemistry(forwardIds) * 0.06,
  };
}

function attachChemistryMeta(squad) {
  const bonuses = computeChemistryBonuses(squad);
  return squad.map(p => ({...p, meta: {...p.meta, teamLineoutChemistry: bonuses.lineout, teamScrumChemistry: bonuses.scrum}}));
}

// Sorteia uma skill pra evoluir no treino de clube, com mais chance nas
// skills que definem a posição do jogador (peso do SKILL_PROFILES). Se `pool`
// for dado (foco de treino escolhido pelo técnico pra segunda/terça/quinta),
// sorteia só entre essas skills, ainda pesado pela posição — cai pro sorteio
// livre entre todas as skills se o pool estiver vazio ou não fizer sentido
// pra posição do jogador (peso zero em todas as opções do foco).
function weightedRandomSkill(posId, pool) {
  const profile = SKILL_PROFILES[posId];
  const keys = (pool && pool.length && pool.some(k => profile[k] > 0)) ? pool : SKILL_KEYS;
  const totalWeight = keys.reduce((sum, k) => sum + profile[k], 0);
  let roll = Math.random() * totalWeight;
  for (const k of keys) {
    roll -= profile[k];
    if (roll <= 0) return k;
  }
  return keys[keys.length - 1];
}

// Treino intensivo (DIP individual ou em grupo) rende conforme a assiduidade
// do jogador NAQUELA categoria específica (meta.trainingAttendance —
// ATTENDANCE_CATEGORIES em data.js, escala compacta ~8-20, independente das
// demais skills): 20 = 5x/semana, 19 = 4x, 18 = 3x, 17 = 2x, 16 = 1x, 15 =
// nenhuma sessão intensiva mas presença plena na atividade; abaixo de 15 o
// jogador chega a faltar. O quanto disso vira crescimento de skill/fadiga é
// sempre days/MAX, então quem tem assiduidade mediana ainda treina, só que
// rende proporcionalmente menos — nunca trava o jogador inteiro fora do
// treino intensivo. `category` é 'individual' (DIP) por padrão, ou 'grupo'
// pro treino em grupo (ver tickGroupTraining).
const MAX_INTENSIVE_DAYS_PER_WEEK = 5;
function trainingIntensityCap(player, currentCondition, category = 'individual') {
  const freq = (player.meta.trainingAttendance && player.meta.trainingAttendance[category]) || 0;
  let days = Math.max(0, Math.min(MAX_INTENSIVE_DAYS_PER_WEEK, freq - 15));
  if (currentCondition < 45) days = Math.max(0, days - 1);
  return days;
}

// Treino pra nova posição: substitui o DIP normal (mesmo slot de treino
// intensivo, ver tickTraining) por evolução focada só nas skills que
// DEFINEM a posição alvo (peso >= 1.0 no SKILL_PROFILES) — em vez do
// manager escolher um atributo solto, escolhe a posição e o jogador foca
// tudo nela. Depois de rondar o número de semanas necessário (mesma fração
// de rendimento do DIP, por frequência/físico — ver trainingIntensityCap),
// o jogador "aprende" a posição de vez (vira posição alternativa
// permanente, ver grantAltPos) e só a partir daí fica apto pra ser
// escalado ali (ver canPlay/FRONT_ROW_POS no seletor de escalação —
// continua sem improviso ANTES de terminar o treino). Primeira línea
// (pilar/hooker) pode ser treinada como qualquer outra posição, só que
// exige bem mais tempo: scrum de verdade não se aprende em semanas, leva
// uns 3 meses de trabalho técnico dedicado até ficar seguro pra jogar ali.
const POSITION_TRAINING_ROUNDS_NEEDED = 10; // ~10 semanas, posições em geral
const FRONT_ROW_TRAINING_ROUNDS_NEEDED = 13; // ~3 meses, pilar/hooker
function positionTrainingRoundsNeeded(posId) {
  return FRONT_ROW_POS.has(posId) ? FRONT_ROW_TRAINING_ROUNDS_NEEDED : POSITION_TRAINING_ROUNDS_NEEDED;
}

// Concede uma posição alternativa nova a um jogador (aprendida por treino,
// ver tickTraining), sem mutar o elenco estático — grava em
// state.playerOverrides (o mesmo mecanismo já usado pras lesões dinâmicas),
// que é aplicado a cada leitura do elenco via applyOverrides/canPlay.
function grantAltPos(player, posId) {
  const baseAltPos = (player.meta.altPos || []);
  const existing = state.playerOverrides[player.id] || {};
  const currentAltPos = existing.altPos || baseAltPos;
  if (currentAltPos.includes(posId)) return;
  state.playerOverrides[player.id] = {...existing, altPos: [...currentAltPos, posId]};
}

// Motivação: jogador que passa rodadas seguidas sem entrar em campo (ver
// pendingMyXV em finalizeRound) reage conforme disciplina/determinação —
// a maioria, com disciplina/determinação mediana pra baixo, vai perdendo
// frequência de treino geral e de academia aos poucos (fica desanimado,
// falta mais); uns poucos profissionais de verdade (disciplina e
// determinação bem altas as duas) fazem o oposto: treinam ainda mais pra
// forçar a volta ao time. Só reage depois de MOTIVATION_DRIFT_THRESHOLD_ROUNDS
// rodadas seguidas de fora, e continua se ajustando enquanto durar (ver
// ATTENDANCE_CATEGORIES em data.js pra escala 8-20).
const MOTIVATION_DRIFT_THRESHOLD_ROUNDS = 3;
const MOTIVATION_DRIFT_CATEGORIES = ['geral', 'academia'];
function tickMotivationDrift(playedIds) {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return;
  state.roundsSinceSelected = state.roundsSinceSelected || {};
  roster.forEach(p => {
    if (p.meta.injuryWeeks) return; // lesionado não conta pro streak — já sabe que não ia jogar mesmo
    if (playedIds.has(p.id)) {
      state.roundsSinceSelected[p.id] = 0;
      return;
    }
    const streak = (state.roundsSinceSelected[p.id] || 0) + 1;
    state.roundsSinceSelected[p.id] = streak;
    if (streak < MOTIVATION_DRIFT_THRESHOLD_ROUNDS) return;

    // Limiares calibrados na distribuição real do elenco curado (não em
    // valores "redondos" abstratos): disciplina/determinação são skills de
    // peso baixo no perfil da maioria das posições, então a recalibração do
    // elenco (ver SPREAD_FACTOR em realSquads.js) empurra a maior parte do
    // plantel bem pra baixo nelas — só uns 8% do elenco real do Curda passa
    // de 60 nessas duas juntas, e a maioria fica abaixo de 45.
    const moraleScore = ((p.skills.discipline || 50) + (p.skills.determination || 50)) / 2;
    let delta = 0;
    if (moraleScore >= 60) delta = 1; // poucos: ficam mais motivados, treinam mais
    else if (moraleScore < 45) delta = -1; // maioria: desanima aos poucos

    if (delta === 0) return;
    const existing = state.playerOverrides[p.id] || {};
    const current = existing.trainingAttendance || p.meta.trainingAttendance || {};
    const next = {...current};
    MOTIVATION_DRIFT_CATEGORIES.forEach(cat => {
      next[cat] = Math.max(8, Math.min(20, (current[cat] != null ? current[cat] : 14) + delta));
    });
    state.playerOverrides[p.id] = {...existing, trainingAttendance: next};
  });
}

// Treino do clube: segunda, terça e quinta, uma vez por rodada finalizada.
// Fadiga leve pra todo mundo (registrada como mais uma queda de condição,
// que se recupera igual à fadiga de partida) e chance de evolução gradual
// de algum atributo. Treino individual intensivo (DIP), focado num atributo
// escolhido no Elenco, evolui garantido e mais rápido ali, à custa de bem
// mais desgaste físico — mas só rende (parcial ou totalmente) conforme a
// frequência de treino do jogador (ver trainingIntensityCap). Fora do DIP,
// quem tem frequência abaixo de 15 às vezes falta o treino geral do clube
// (sem desgaste, mas também sem chance de evoluir naquela rodada). A
// qualidade da comissão técnica (getStaffQuality) acelera tudo isso. Só se
// aplica ao elenco real do clube gerenciado — mesma restrição de tickInjuries.
// Qualidade de treino efetiva pra uma skill específica: se for chute
// (kicking/dropGoal), usa o especialista de chute do staff; senão, usa o
// especialista de backs ou de forwards conforme o GRUPO do jogador (não a
// posição exata) — ver specialtyStaffBonus/STAFF_SKILL_LABELS em
// realSquads.js. Cai pro getStaffQuality geral do time quando ninguém no
// staff tem aquela especialidade cadastrada (a maioria não tem).
function trainingQualityFor(teamId, group, skillKey) {
  if (skillKey === 'kicking' || skillKey === 'dropGoal') return specialtyStaffBonus(teamId, 'kickingCoaching');
  if (group === 'back') return specialtyStaffBonus(teamId, 'backsCoaching');
  if (group === 'forward') return specialtyStaffBonus(teamId, 'forwardsCoaching');
  return getStaffQuality(teamId);
}

function tickTraining() {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return;
  const quality = getStaffQuality(state.myTeamId);
  // Foco de treino da semana: o técnico escolhe um TIPO de treino (ver
  // TRAINING_TYPES em data.js) pra segunda/terça/quinta, não atributos
  // soltos — cada tipo já junta vários atributos relacionados (ex.: "Duelo"
  // evolui decisão, passe, recepção e aceleração juntos). O pool da semana
  // é a união dos atributos de todos os tipos escolhidos nos três dias; dia
  // sem tipo escolhido não entra, e sem nada escolhido em nenhum dos três
  // cai pro sorteio livre de sempre (ver weightedRandomSkill).
  const focusTypes = Object.values(state.trainingFocus || {}).filter(k => typeof k === 'string' && TRAINING_TYPES[k]);
  const focusPool = [...new Set(focusTypes.flatMap(k => TRAINING_TYPES[k].skills))];
  state.positionTraining = state.positionTraining || {};
  state.positionTrainingProgress = state.positionTrainingProgress || {};
  const learned = [];
  roster.forEach(p => {
    const override = state.playerOverrides[p.id];
    const injuryWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;
    if (injuryWeeks) return; // lesionado não treina

    const current = currentConditionOf(p);
    const posTarget = state.positionTraining[p.id];
    const dipKey = state.dipTraining[p.id];
    const days = (posTarget || dipKey) ? trainingIntensityCap(p, current, 'individual') : 0;
    let fatigue;
    if (posTarget && days > 0) {
      const frac = days / MAX_INTENSIVE_DAYS_PER_WEEK;
      const profile = SKILL_PROFILES[posTarget];
      const keyPool = Object.keys(profile).filter(k => profile[k] >= 1.0);
      const posSkillKey = weightedRandomSkill(posTarget, keyPool);
      const posQuality = trainingQualityFor(state.myTeamId, POS_GROUP[posTarget], posSkillKey);
      growSkill(p.id, p.skills, posSkillKey, 2 * posQuality * frac);
      fatigue = (10 + Math.random() * 8) * frac;
      const progress = (state.positionTrainingProgress[p.id] || 0) + frac;
      if (progress >= positionTrainingRoundsNeeded(posTarget)) {
        grantAltPos(p, posTarget);
        delete state.positionTraining[p.id];
        delete state.positionTrainingProgress[p.id];
        learned.push(`${p.name} (${POS_LABEL[posTarget]})`);
      } else {
        state.positionTrainingProgress[p.id] = progress;
      }
    } else if (posTarget) {
      fatigue = 1 + Math.random() * 2; // sem rendimento essa semana (frequência/físico baixos), mas mantém o alvo
    } else if (dipKey && days > 0) {
      const frac = days / MAX_INTENSIVE_DAYS_PER_WEEK;
      const dipQuality = trainingQualityFor(state.myTeamId, p.group, dipKey);
      growSkill(p.id, p.skills, dipKey, 2 * dipQuality * frac);
      fatigue = (10 + Math.random() * 8) * frac;
    } else {
      const freq = (p.meta.trainingAttendance && p.meta.trainingAttendance.geral) || 0;
      const missChance = freq < 15 ? Math.min(0.6, (15 - freq) * 0.08) : 0;
      if (Math.random() < missChance) {
        fatigue = 1 + Math.random() * 2; // faltou o treino geral: quase sem desgaste, mas também sem evolução
      } else {
        fatigue = 3 + Math.random() * 5;
        // A CHANCE de evoluir essa semana usa a qualidade geral do time (não
        // dá pra saber de antemão se vai sair uma skill de chute antes de
        // sortear); a MAGNITUDE do ganho, sim, já reflete o especialista
        // certo pra skill sorteada.
        if (Math.random() < 0.3 * quality) {
          const freeSkillKey = weightedRandomSkill(p.posId, focusPool);
          const freeQuality = trainingQualityFor(state.myTeamId, p.group, freeSkillKey);
          growSkill(p.id, p.skills, freeSkillKey, Math.max(1, Math.round(freeQuality)));
        }
      }
    }
    state.playerCondition[p.id] = {condition: Math.max(15, current - fatigue), atDay: currentCalendarDay()};
  });
  return learned;
}

// Papel de cada lista do grupo de line-out -> skill que evolui em quem tá
// nela: lançadores melhoram a técnica de lançamento, saltadores a técnica/
// impulsão de salto, levantadores a força — exatamente as skills que entram
// na conta do lineout em engine.js (lineoutThrowerScore/lineoutJumperScore/
// lineoutLifterScore). Cada lista aceita qualquer número de jogadores.
const LINEOUT_GROUP_ROLE_SKILL = {throwerIds: 'lineoutThrow', jumperIds: 'jump', lifterIds: 'strength'};

// Acha um jogador treinável pelo id: primeiro no plantel principal, depois
// nas categorias de base M16/M18 (16+ anos) — a base mais nova (M14/M15)
// fica de fora, ainda não tem maturidade física pra treinar com o time
// principal. Jogador da base treinado aqui já acumula a evolução (ver
// growSkill/state.skillGrowth) que "acorda" sozinha quando ele for
// promovido ao plantel principal.
function findTrainablePlayer(id) {
  const roster = getRealRoster(state.myTeamId);
  const fromRoster = roster && roster.find(p => p.id === id);
  if (fromRoster) return fromRoster;
  const academy = state.youthAcademy || {};
  for (const cat of ['M16', 'M18']) {
    const found = (academy[cat] || []).find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

// Treino em grupo: além de cada um evoluir a skill do papel que treina
// (sempre escalado pelo mesmo cap de frequência/físico do DIP — ver
// trainingIntensityCap, é o mesmo motivo que impede alguém com pouca
// frequência de treino de "treinar DIP vários dias"), o grupo inteiro ganha
// entrosamento entre si, mais rápido que o entrosamento passivo de só jogar
// junto (ver bumpChemistryForXV) — só que cada PAR trava no elo mais fraco
// dos dois. Um jogador pode estar em mais de uma lista (ex.: treina como
// saltador E como levantador) — divide o ganho entre os papéis, pra não
// inflar demais.
function tickGroupTraining() {
  if (!getRealRoster(state.myTeamId)) return;
  const group = state.trainingGroups && state.trainingGroups.lineout;
  if (!group || !group.active) return;
  // Estrutura fixa (ver STAFF_SKILL_LABELS.setPieceCoaching, ex.: Lito
  // Molina) acelera o treino de grupo de line-out em vez do getStaffQuality
  // genérico.
  const quality = specialtyStaffBonus(state.myTeamId, 'setPieceCoaching');

  const skillsById = {};
  Object.entries(LINEOUT_GROUP_ROLE_SKILL).forEach(([role, skillKey]) => {
    (group[role] || []).forEach(id => {
      if (!skillsById[id]) skillsById[id] = new Set();
      skillsById[id].add(skillKey);
    });
  });
  const players = Object.keys(skillsById).map(findTrainablePlayer).filter(Boolean);
  if (players.length < 2) return; // precisa de pelo menos 2 pra fazer sentido treinar em grupo

  const capOf = {};
  players.forEach(p => {
    const override = state.playerOverrides[p.id];
    const injuryWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;
    if (injuryWeeks) { capOf[p.id] = 0; return; }
    const current = currentConditionOf(p);
    const days = trainingIntensityCap(p, current, 'grupo');
    capOf[p.id] = days;
    if (days > 0) {
      const frac = days / MAX_INTENSIVE_DAYS_PER_WEEK;
      const skills = skillsById[p.id];
      const growthEach = (1.6 * quality * frac) / skills.size;
      skills.forEach(skillKey => growSkill(p.id, p.skills, skillKey, growthEach));
      const fatigue = (8 + Math.random() * 6) * frac;
      state.playerCondition[p.id] = {condition: Math.max(15, current - fatigue), atDay: currentCalendarDay()};
    }
  });

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const weakest = Math.min(capOf[a.id], capOf[b.id]);
      if (weakest <= 0) continue;
      bumpChemistry(a.id, b.id, 4 * (weakest / MAX_INTENSIVE_DAYS_PER_WEEK));
    }
  }
}

// Pool fixo de skills que cada atividade de assiduidade evolui — academia
// (musculação/mobilidade) mexe no físico, análise de vídeo/palestras mexe
// na cabeça tática. Mesmo cap 8-20 por assiduidade das demais atividades:
// abaixo de 15 o jogador chega a faltar (sem desgaste, sem evolução).
const ACADEMIA_SKILL_POOL = ['strength', 'agility', 'stamina'];
const VIDEO_SKILL_POOL = ['vision', 'positioning'];

// loadControl: excedente de especialidade em preparação física (ver
// STAFF_SKILL_LABELS.physicalConditioning, ex.: Alexis Cibils/Juan Carmona)
// sobre o getStaffQuality genérico — controle de carga de verdade reduz o
// desgaste desnecessário da academia sem mudar a evolução. Times sem
// especialista (loadControl 0) não mudam nada.
function tickCategoryTraining(roster, quality, category, pool, loadControl = 0) {
  roster.forEach(p => {
    const override = state.playerOverrides[p.id];
    const injuryWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;
    if (injuryWeeks) return;
    const att = (p.meta.trainingAttendance && p.meta.trainingAttendance[category]) || 0;
    const missChance = att < 15 ? Math.min(0.6, (15 - att) * 0.08) : 0;
    if (Math.random() < missChance) return;
    const current = currentConditionOf(p);
    const fatigue = Math.max(0.5, 2 + Math.random() * 3 - loadControl * 3);
    state.playerCondition[p.id] = {condition: Math.max(15, current - fatigue), atDay: currentCalendarDay()};
    if (Math.random() < 0.3 * quality) {
      growSkill(p.id, p.skills, weightedRandomSkill(p.posId, pool), Math.max(1, Math.round(quality)));
    }
  });
}

// Churrasco: convívio do grupo, toda quinta-feira depois do treino, não é
// treino — quem aparece entrosa com todo mundo que também apareceu
// (bumpChemistry, mesmo mecanismo do treino em grupo) e evolui um pouco a
// comunicação, essencial pro chamado da jogada entre o 9 e o 10 (ver
// handlingRating em engine.js). Sem desgaste físico nenhum (é um churrasco,
// não um treino).
function tickChurrascoAttendees(roster) {
  return roster.filter(p => {
    const override = state.playerOverrides[p.id];
    const injuryWeeks = override && override.injuryWeeks != null ? override.injuryWeeks : p.meta.injuryWeeks;
    if (injuryWeeks) return false;
    const att = (p.meta.trainingAttendance && p.meta.trainingAttendance.churrasco) || 0;
    return Math.random() * 20 < att;
  });
}

function applyChurrascoEffect(attendees, quality, chemistryAmount) {
  for (let i = 0; i < attendees.length; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      bumpChemistry(attendees[i].id, attendees[j].id, chemistryAmount);
    }
    if (Math.random() < 0.25 * quality) {
      growSkill(attendees[i].id, attendees[i].skills, 'comunicacao', Math.max(1, Math.round(quality)));
    }
  }
}

function tickChurrasco(roster, quality) {
  applyChurrascoEffect(tickChurrascoAttendees(roster), quality, 1.2);
}

// Churrasco dos forwards: evento à parte do churrasco semanal — só o pack,
// numa quarta-feira, bem mais raro (a cada 2-3 meses, não toda semana).
// Mesmo efeito de entrosamento/comunicação, mas reforça especificamente a
// coesão do pack (scrum/lineout), já que é só entre forwards.
const FORWARDS_CHURRASCO_WEEKLY_CHANCE = 0.09; // ~1x a cada 11 semanas (~2-3 meses)
function tickForwardsChurrasco(roster, quality) {
  if (Math.random() >= FORWARDS_CHURRASCO_WEEKLY_CHANCE) return;
  const forwards = roster.filter(p => p.group === 'forward');
  applyChurrascoEffect(tickChurrascoAttendees(forwards), quality, 2.5);
}

// Reúne as 4 atividades de assiduidade que ainda não tinham lugar no motor
// (academia, análise de vídeo/palestras, churrasco semanal e churrasco dos
// forwards) — chamada junto de tickTraining/tickGroupTraining a cada
// rodada finalizada.
function tickAttendanceExtras() {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return;
  const quality = getStaffQuality(state.myTeamId);
  // Academia usa o especialista em preparação física (ex.: Alexis Cibils,
  // Juan Carmona) tanto pra evoluir mais rápido quanto pro controle de carga
  // (menos desgaste desnecessário) — ver tickCategoryTraining. Multiplicada
  // ainda pela ESTRUTURA FÍSICA do clube (getFacilityQuality) — ter ou não
  // academia própria de verdade, tipo a sede do Curda em Assunção, é uma
  // dimensão separada do staff: mesmo staff bom não compensa treinar sem
  // instalação dedicada.
  const conditioningQuality = specialtyStaffBonus(state.myTeamId, 'physicalConditioning') * getFacilityQuality(state.myTeamId);
  const conditioningLoadControl = conditioningQuality - getStaffQuality(state.myTeamId);
  tickCategoryTraining(roster, conditioningQuality, 'academia', ACADEMIA_SKILL_POOL, conditioningLoadControl);
  tickCategoryTraining(roster, quality, 'video', VIDEO_SKILL_POOL);
  // Churrasco evolui comunicação (ver applyChurrascoEffect) — quem no staff
  // tem boa comunicação (ex.: Figu Super, Cemilson) puxa isso pra cima.
  const churrascoQuality = specialtyStaffBonus(state.myTeamId, 'communication');
  tickChurrasco(roster, churrascoQuality);
  tickForwardsChurrasco(roster, churrascoQuality);
}

// ---- Captação de promessas (clubes menores do Paraguaio) ------------------
// Gera um jogador revelação a partir de um clube menor do Paraguaio
// (procedural): sorteia um jogador do elenco gerado daquele clube e aplica um
// "salto" de evolução (ele "evoluiu" nesse tempo), escalando as skills na
// mesma proporção do aumento de overall pra manter o detalhamento coerente.
function generateScoutProspect() {
  const teamId = SMALL_PARAGUAY_TEAM_IDS[Math.floor(Math.random() * SMALL_PARAGUAY_TEAM_IDS.length)];
  const team = teamById[teamId];
  const squad = generateSquad(team);
  const base = squad[Math.floor(Math.random() * squad.length)];
  const boost = 8 + Math.floor(Math.random() * 10);
  const newRating = Math.min(92, base.rating + boost);
  const ratio = newRating / base.rating;
  const skills = {};
  Object.keys(base.skills).forEach(k => {
    skills[k] = Math.max(30, Math.min(99, Math.round(base.skills[k] * ratio)));
  });
  return {
    ...base,
    id: `prospect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    skills,
    rating: newRating,
    meta: {...base.meta, age: 'jovem', note: `Revelação surgida do ${team.name}; evoluiu bastante nesta temporada`, scoutedFrom: team.name},
  };
}

// A cada rodada finalizada, chance de surgir uma nova promessa disponível
// pra convocação — só quando o clube gerenciado é o Curda (a mecânica é
// específica desse clube, ver mensagem do manager sobre captação).
function tickScouting() {
  if (state.myTeamId !== 'ARG-CUR' && state.myTeamId !== 'PAR-CUR') return;
  state.scoutingProspects = state.scoutingProspects || [];
  if (state.scoutingProspects.length >= 3) return;
  if (Math.random() < 0.35) {
    state.scoutingProspects.push(generateScoutProspect());
  }
}

// O jogador decide se aceita o convite: mais determinado, mais ambicioso,
// mais chance de topar a mudança pro Curda — mas nunca é garantido.
function inviteProspect(prospectId) {
  const prospects = state.scoutingProspects || [];
  const prospect = prospects.find(p => p.id === prospectId);
  if (!prospect) return;
  const determination = prospect.skills.determination || 65;
  const acceptChance = Math.max(0.35, Math.min(0.85, 0.55 + (determination - 65) * 0.006));
  const accepted = Math.random() < acceptChance;
  state.scoutingProspects = prospects.filter(p => p.id !== prospectId);
  const isForeignArrival = !!prospect.meta.nationality;
  if (accepted) {
    state.recruitedPlayers = state.recruitedPlayers || [];
    state.recruitedPlayers.push({
      ...prospect,
      meta: isForeignArrival ? prospect.meta : {...prospect.meta, note: `Contratado do ${prospect.meta.scoutedFrom}; ${prospect.meta.note}`},
    });
    setRecruitedPlayers(state.recruitedPlayers);
    saveState();
    alert(t('captacaoAceitou', {name: prospect.name}));
  } else {
    saveState();
    if (isForeignArrival) {
      alert(t('captacaoRecusouEstrangeiro', {name: prospect.name}));
    } else {
      alert(t('captacaoRecusou', {name: prospect.name, club: prospect.meta.scoutedFrom}));
    }
  }
  renderRealSquad();
}

// ---- Recém-chegados estrangeiros a Assunção (tentando rugby pela primeira
// vez) ------------------------------------------------------------------
// Raramente um novo morador estrangeiro de Assunción decide tentar rugby, e
// na maioria das vezes procura o Curda primeiro (clube mais tradicional/
// visível da cidade) — mais argentinos e uruguaios (países vizinhos com
// forte cultura de rugby), poucos brasileiros (pouco conhecimento do
// esporte por lá), e raríssimos europeus/neozelandeses (mais aptos, mas bem
// mais raro alguém de tão longe se estabelecer em Assunción). skillMult
// reflete essa bagagem esportiva: bem abaixo de 1 pra quem nunca viu uma
// bola oval, bem acima de 1 pra quem já cresceu com o esporte na cultura.
const FOREIGN_ARRIVAL_NATIONALITIES = [
  {country: 'Argentina', weight: 34, skillMult: [0.9, 1.1]},
  {country: 'Uruguai', weight: 27, skillMult: [0.85, 1.05]},
  {country: 'Brasil', weight: 18, skillMult: [0.5, 0.7]},
  {country: 'Europa', weight: 13, skillMult: [1.0, 1.2]},
  {country: 'Nova Zelândia', weight: 8, skillMult: [1.25, 1.55]},
];

function pickForeignNationality() {
  const total = FOREIGN_ARRIVAL_NATIONALITIES.reduce((s, n) => s + n.weight, 0);
  let roll = Math.random() * total;
  for (const n of FOREIGN_ARRIVAL_NATIONALITIES) {
    roll -= n.weight;
    if (roll <= 0) return n;
  }
  return FOREIGN_ARRIVAL_NATIONALITIES[FOREIGN_ARRIVAL_NATIONALITIES.length - 1];
}

// Gera um recém-chegado tentando rugby pela primeira vez: nível bruto de
// novato (base baixa-mediana, sem clube anterior), escalado pela bagagem
// esportiva do país de origem (ver FOREIGN_ARRIVAL_NATIONALITIES) e com as
// skills geradas na mesma fórmula ponderada por posição de sempre (ver
// SKILL_PROFILES/mkPlayer em realSquads.js), pra que a posição sorteada já
// nasça com as skills que a definem mais desenvolvidas que o resto.
function generateForeignProspect() {
  const nat = pickForeignNationality();
  const posIds = Object.keys(SKILL_PROFILES);
  const posId = posIds[Math.floor(Math.random() * posIds.length)];
  const profile = SKILL_PROFILES[posId];
  const rawBase = 38 + Math.random() * 20; // 38-58: recém-chegado sem clube anterior
  const mult = nat.skillMult[0] + Math.random() * (nat.skillMult[1] - nat.skillMult[0]);
  const base = rawBase * mult;
  const skills = {};
  SKILL_KEYS.forEach(k => {
    const scaled = base * (0.55 + profile[k] * 0.45);
    const variance = Math.random() * 16 - 8;
    skills[k] = Math.max(25, Math.min(99, Math.round(scaled + variance)));
  });
  const weightSum = SKILL_KEYS.reduce((s, k) => s + profile[k], 0);
  const rating = Math.round(SKILL_KEYS.reduce((s, k) => s + skills[k] * profile[k], 0) / weightSum);
  // Nome/biometria/traits vêm de um jogador procedural qualquer (bancos de
  // nome são genéricos rioplatenses pra todo mundo no jogo, ver randomName
  // em data.js) — só a posição, skills, overall e nacionalidade são
  // substituídos pelos deste recém-chegado.
  const sourceTeam = teamById[SMALL_PARAGUAY_TEAM_IDS[Math.floor(Math.random() * SMALL_PARAGUAY_TEAM_IDS.length)]];
  const nameSquad = generateSquad(sourceTeam);
  const namePlayer = nameSquad[Math.floor(Math.random() * nameSquad.length)];
  return {
    ...namePlayer,
    id: `foreign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    posId,
    position: POS_LABEL[posId],
    group: POSITIONS.find(p => p.id === posId).group,
    skills,
    rating,
    meta: {
      ...namePlayer.meta,
      age: 'jovem',
      nationality: nat.country,
      yearsInParaguay: 0,
      note: `Novo morador de Assunção, vindo de/da ${nat.country}, decidiu tentar rugby`,
      scoutedFrom: `Recém-chegado — ${nat.country}`,
    },
  };
}

// A cada rodada finalizada, chance rara de aparecer um recém-chegado
// estrangeiro decidindo tentar rugby (ver generateForeignProspect) — entra
// na mesma fila de captação (state.scoutingProspects) e usa o mesmo fluxo
// de convite/aceite (inviteProspect), só que com a origem "recém-chegado"
// em vez de clube menor do Paraguaio.
function tickForeignArrival() {
  if (state.myTeamId !== 'ARG-CUR' && state.myTeamId !== 'PAR-CUR') return;
  state.scoutingProspects = state.scoutingProspects || [];
  if (state.scoutingProspects.length >= 3) return;
  if (Math.random() < 0.08) {
    state.scoutingProspects.push(generateForeignProspect());
  }
}

function renderScoutingHtml() {
  const prospects = state.scoutingProspects || [];
  return `
    <div class="card">
      <h3>${t('captacaoTitle')}</h3>
      <p class="muted">${t('captacaoHelp')}</p>
      ${prospects.length === 0 ? `<p class="muted">${t('captacaoVazio')}</p>` : `
        <div class="tableScroll"><table class="squadTable">
          <thead><tr>
            <th class="teamCol">${t('colJogador')}</th>
            <th>${t('colPosicao')}</th>
            <th>${t('colOverall')}</th>
            <th>${t('captacaoColOrigem')}</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${prospects.map(p => `
              <tr>
                <td class="teamCol">${escapeHtmlAttr(p.name)}</td>
                <td class="posCol">${p.position}</td>
                <td><b>${p.rating}</b></td>
                <td class="muted">${escapeHtmlAttr(p.meta.scoutedFrom || '')}</td>
                <td><button class="ctrlBtn" data-invite="${p.id}">${t('captacaoConvidar')}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      `}
    </div>
  `;
}

// ---- Categorias de base (M14/M15/M16/M18, Dante Legui) ---------------------
// A cada rodada finalizada, chance da base inteira "subir" uma categoria —
// quem estava na M18 se forma e é promovido de vez ao plantel principal do
// Curda (via recruitedPlayers/setRecruitedPlayers, mesmo mecanismo da
// captação de promessas), e entra uma nova leva de garotos de 14 anos.
function tickYouthAcademy() {
  if (state.myTeamId !== 'ARG-CUR' && state.myTeamId !== 'PAR-CUR') return;
  if (!state.youthAcademy) state.youthAcademy = createInitialYouthAcademy();
  if (Math.random() > 0.18) return;

  const {academy, graduates} = advanceYouthAcademy(state.youthAcademy);
  state.youthAcademy = academy;

  if (graduates.length) {
    state.recruitedPlayers = state.recruitedPlayers || [];
    state.recruitedPlayers.push(...graduates);
    setRecruitedPlayers(state.recruitedPlayers);
    alert(t('baseFormados', {names: graduates.map(p => p.name).join(', ')}));
  }
}

// positionFilter: posto único a mostrar em CADA categoria (independente do
// plantel principal), ou null pra ver todos os postos — ver squadPositionFilter.
function renderYouthAcademyHtml(positionFilter = null) {
  const academy = state.youthAcademy || createInitialYouthAcademy();
  return `
    <div class="card">
      <h3>${t('baseTitle')}</h3>
      <p class="muted">${t('baseHelp')}</p>
      <div class="youthGrid">
        ${YOUTH_CATEGORIES.map(cat => {
          const catPlayers = positionFilter
            ? academy[cat].filter(p => canPlay(p, positionFilter))
              .sort((a, b) => effectiveOverallAt(b, positionFilter) - effectiveOverallAt(a, positionFilter))
            : academy[cat];
          return `
          <div class="youthCategoryCol">
            <div class="youthCategoryLabel">${cat} <span class="muted">(${academy[cat].length} de ${YOUTH_CATEGORY_TOTAL_SIZE}+)</span></div>
            ${catPlayers.map(p => `
              <div class="youthPlayerRow" title="${escapeHtmlAttr(p.name)} — ${p.position}">
                <span class="youthPlayerName">${escapeHtmlAttr(p.name)}</span>
                <span class="muted">${p.position.slice(0, 3)} · ${positionFilter ? effectiveOverallAt(p, positionFilter) : p.rating}</span>
              </div>
            `).join('')}
            ${positionFilter && !catPlayers.length ? `<p class="muted" style="font-size:11px">${t('semDestaquePosto')}</p>` : ''}
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
}

// ---- Transições de estágio e mata-mata ------------------------------------

// Mata-mata não admite empate: sorteia (com peso igual) quem avança e soma
// 3 pontos ao vencedor, representando uma prorrogação/disputa de pênaltis
// resolvida sem simular minuto a minuto.
function breakTie(scoreHome, scoreAway) {
  const homeWins = Math.random() < 0.5;
  return homeWins ? [scoreHome + 3, scoreAway] : [scoreHome, scoreAway + 3];
}

// Últimos resultados de um time (mais recente por último) — alimenta o
// bônus/malus de moral da simulação (ver moraleModFromForm em engine.js).
// Default [] pra saves antigos sem state.teamForm ainda.
function teamFormFor(teamId) {
  state.teamForm = state.teamForm || {};
  return state.teamForm[teamId] || [];
}

// Registra o resultado (W/L/D) de AMBOS os times envolvidos — chamado de
// applyMatchToStandings, o único ponto por onde passa todo resultado
// confirmado do jogo (liga, grupos E mata-mata, já que moral não deveria
// ignorar uma eliminação só porque a fase não tem tabela de pontos).
// Guarda só os últimos 8 (moraleModFromForm usa os últimos 5).
function recordTeamForm(homeId, awayId, scoreHome, scoreAway) {
  state.teamForm = state.teamForm || {};
  const codeHome = scoreHome > scoreAway ? 'W' : scoreHome < scoreAway ? 'L' : 'D';
  const codeAway = scoreAway > scoreHome ? 'W' : scoreAway < scoreHome ? 'L' : 'D';
  const push = (id, code) => {
    const arr = state.teamForm[id] || (state.teamForm[id] = []);
    arr.push(code);
    if (arr.length > 8) arr.shift();
  };
  push(homeId, codeHome);
  push(awayId, codeAway);
}

// Clima e vantagem de mandante entram igual pros dois lados: o mandante
// (homeId, sempre o primeiro time por convenção — ver simulateMatch em
// engine.js) ganha a vantagem de jogar em casa; moral vem do histórico
// recente de cada time (teamFormFor); o clima é sorteado a cada partida.
function simulateOtherMatch(homeId, awayId) {
  const home = teamById[homeId];
  const away = teamById[awayId];
  const r = simulateMatch(home, squadOf(homeId), 'equilibrado', away, squadOf(awayId), 'equilibrado', undefined, undefined, undefined, {
    formA: teamFormFor(homeId),
    formB: teamFormFor(awayId),
    weather: rollWeather(),
  });
  return {scoreHome: r.scoreA, scoreAway: r.scoreB};
}

function applyMatchToStandings(c, m, scoreHome, scoreAway) {
  recordTeamForm(m.home, m.away, scoreHome, scoreAway);
  if (c.stage === 'league') {
    applyResult(c.standings, m.home, m.away, scoreHome, scoreAway);
  } else if (c.stage === 'groups') {
    const g = c.groupOf[m.home];
    applyResult(c.groupStandings[g], m.home, m.away, scoreHome, scoreAway);
  }
  // estágio 'knockout' não tem tabela — só avanço de chaveamento (mas o
  // resultado ainda entra na moral via recordTeamForm acima).
}

function startKnockoutFromLeague(c) {
  const top8 = sortedStandings(c.standings).slice(0, 8).map(r => r.teamId);
  const matches = firstKnockoutRound(top8);
  c.stage = 'knockout';
  c.currentRoundIndex = 0;
  c.knockoutRounds = [{name: knockoutStageName(matches.length, lang), matches}];
}

// Torneio nacional paraguaio: depois da 7ª rodada (turno único), os 4
// melhores formam a chave OURO e os 4 piores a chave DESCENSO — cada uma
// disputa mais 3 rodadas de turno único ENTRE SI (reaproveita generateFixture
// pra 4 times, que produz exatamente o padrão real 1x4+2x3 / 1x3+2x4 /
// 1x2+3x4 visto na tabela oficial). Reaproveita o estágio 'groups' existente
// (grupos nomeados com fixture/tabela próprios) em vez de criar um estágio
// novo do zero.
function startSuperGroupsFromLeague(c) {
  const ranked = sortedStandings(c.standings).map(r => r.teamId);
  const oro = ranked.slice(0, 4);
  const descenso = ranked.slice(4, 8);
  const groupOf = {};
  oro.forEach(id => { groupOf[id] = 'Oro'; });
  descenso.forEach(id => { groupOf[id] = 'Descenso'; });
  c.stage = 'groups';
  c.groupOf = groupOf;
  c.groupTerm = '';
  // generateFixture devolve turno + returno (ida e volta, 2*(n-1) rodadas); a
  // tabela real só tem mais 3 rodadas de turno único entre os 4 de cada
  // chave, então usamos só a primeira metade (as primeiras n-1 rodadas).
  c.groupFixtures = {Oro: generateFixture(oro).slice(0, oro.length - 1), Descenso: generateFixture(descenso).slice(0, descenso.length - 1)};
  c.groupStandings = {Oro: initialStandings(oro), Descenso: initialStandings(descenso)};
  c.currentRoundIndex = 0;
}

// Fecha o torneio nacional paraguaio: só a chave OURO (1º-4º) segue pro
// mata-mata (semifinal 1ºx4º/2ºx3º + final), decidindo o campeão — a chave
// DESCENSO (5º-8º) não tem playoff próprio nesse jogo (não existe sistema de
// acesso/descenso entre temporadas aqui), então a tabela dela ao fim das 3
// rodadas já é o resultado final pra esses 4 times.
function startKnockoutFromSuperGroups(c) {
  const oroRanked = sortedStandings(c.groupStandings['Oro']).map(r => r.teamId);
  const matches = firstKnockoutRound(oroRanked);
  c.stage = 'knockout';
  c.currentRoundIndex = 0;
  c.knockoutRounds = [{name: knockoutStageName(matches.length, lang), matches}];
}

// Generaliza pra qualquer número de grupos (2 no Paraguaio, 4 no Torneo del
// Interior): pega os 2 melhores de CADA grupo e cruza o 1º de um grupo com o
// 2º do PRÓXIMO grupo (nunca o 2º do mesmo grupo), evitando reencontro de
// zona logo na primeira rodada do mata-mata. Com 2 grupos, isso reproduz
// exatamente o cruzamento de sempre (1ºA x 2ºB, 1ºB x 2ºA).
function startKnockoutFromGroups(c) {
  const groupKeys = Object.keys(c.groupStandings);
  const top2ByGroup = groupKeys.map(g => sortedStandings(c.groupStandings[g]).slice(0, 2).map(r => r.teamId));
  const n = groupKeys.length;
  const matches = top2ByGroup.map((top2, i) => ({
    home: top2[0],
    away: top2ByGroup[(i + 1) % n][1],
    played: false, scoreHome: null, scoreAway: null,
  }));
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
    if (c.league === 'paraguayo') startSuperGroupsFromLeague(c);
    else startKnockoutFromLeague(c);
  } else if (c.stage === 'groups') {
    const maxLen = Math.max(...Object.values(c.groupFixtures).map(f => f.length));
    if (c.currentRoundIndex < maxLen) return;
    if (c.league === 'paraguayo') {
      // Só quem está na chave Ouro segue pro mata-mata (ver
      // startKnockoutFromSuperGroups) — quem caiu na Descenso já terminou a
      // temporada, sem mais rodadas.
      if (c.groupOf[c.teamId] === 'Oro') startKnockoutFromSuperGroups(c);
      return;
    }
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
    return t('positionGroup', {pos, label: groupDisplayName(c, g)});
  }
  return knockoutStatusLabel(c);
}

// ---- Copa Argentina (Torneo del Interior x Top 14 URBA) -------------------
// O campeão do Torneo del Interior enfrenta o campeão do Top 14 (URBA) numa
// final de ida e volta. Só existe pro clube gerenciado se ELE MESMO vencer
// uma dessas duas competições — a outra é simulada inteira em segundo plano
// (sem o usuário jogar nada nela) só pra descobrir quem é o rival.
const COPA_ARGENTINA_PAIR = {interior: 'top14', top14: 'interior'};

// Quem já é o campeão de uma competição em fase de mata-mata (final já
// disputada), independente de qual time é o "meu" — usado pra descobrir o
// rival da Copa Argentina simulando a OUTRA competição do zero.
function knockoutChampionId(c) {
  const last = c.knockoutRounds[c.knockoutRounds.length - 1];
  if (!last || last.matches.length !== 1 || !last.matches[0].played) return null;
  const final = last.matches[0];
  return final.scoreHome > final.scoreAway ? final.home : final.away;
}

// Resolve uma liga inteira (fixture + mata-mata) via simulação instantânea
// de fundo, só pra saber quem seria o campeão — usada pra achar o rival da
// Copa Argentina na competição que o clube gerenciado NÃO disputa.
function simulateEntireLeagueForChampion(leagueId) {
  const league = LEAGUES.find(l => l.id === leagueId);
  const c = buildCompetition(league.teams[0].id);
  if (c.stage === 'league') {
    c.fixture.forEach(round => round.matches.forEach(m => {
      const {scoreHome, scoreAway} = simulateOtherMatch(m.home, m.away);
      m.played = true; m.scoreHome = scoreHome; m.scoreAway = scoreAway;
      applyResult(c.standings, m.home, m.away, scoreHome, scoreAway);
    }));
    startKnockoutFromLeague(c);
  } else {
    Object.entries(c.groupFixtures).forEach(([g, fixture]) => {
      fixture.forEach(round => round.matches.forEach(m => {
        const {scoreHome, scoreAway} = simulateOtherMatch(m.home, m.away);
        m.played = true; m.scoreHome = scoreHome; m.scoreAway = scoreAway;
        applyResult(c.groupStandings[g], m.home, m.away, scoreHome, scoreAway);
      }));
    });
    startKnockoutFromGroups(c);
  }
  while (true) {
    const round = c.knockoutRounds[c.knockoutRounds.length - 1];
    round.matches.forEach(m => {
      if (m.played) return;
      let {scoreHome, scoreAway} = simulateOtherMatch(m.home, m.away);
      if (scoreHome === scoreAway) [scoreHome, scoreAway] = breakTie(scoreHome, scoreAway);
      m.played = true; m.scoreHome = scoreHome; m.scoreAway = scoreAway;
    });
    if (round.matches.length === 1) break;
    c.knockoutRounds.push({name: '', matches: nextKnockoutRound(round.matches)});
  }
  return knockoutChampionId(c);
}

function buildCopaArgentina(myTeamId, opponentId) {
  return {
    myTeamId, opponentId,
    legs: [
      {home: myTeamId, away: opponentId, played: false, scoreHome: null, scoreAway: null},
      {home: opponentId, away: myTeamId, played: false, scoreHome: null, scoreAway: null},
    ],
  };
}

// Chamada depois de toda rodada finalizada — dispara a Copa Argentina se o
// clube gerenciado acabou de ser campeão do Interior ou do Top 14 (só uma
// vez por partida salva).
function maybeTriggerCopaArgentina(key, c) {
  if (!COPA_ARGENTINA_PAIR[key] || state.copaArgentina) return;
  if (c.stage !== 'knockout' || knockoutChampionId(c) !== c.teamId) return;
  const opponentId = simulateEntireLeagueForChampion(COPA_ARGENTINA_PAIR[key]);
  state.copaArgentina = buildCopaArgentina(c.teamId, opponentId);
}

function copaArgentinaAggregate(copa) {
  let myTotal = 0, oppTotal = 0;
  copa.legs.forEach(leg => {
    if (leg.scoreHome == null) return;
    if (leg.home === copa.myTeamId) { myTotal += leg.scoreHome; oppTotal += leg.scoreAway; }
    else { myTotal += leg.scoreAway; oppTotal += leg.scoreHome; }
  });
  return {myTotal, oppTotal};
}

function copaArgentinaChampion(copa) {
  const {myTotal, oppTotal} = copaArgentinaAggregate(copa);
  if (myTotal !== oppTotal) return myTotal > oppTotal ? copa.myTeamId : copa.opponentId;
  return Math.random() < 0.5 ? copa.myTeamId : copa.opponentId;
}

// ---- Tela "Sobre o jogo": referência de mecânicas pro jogador consultar a
// qualquer momento — não é i18n chave-por-chave (o texto é longo demais pra
// isso valer a pena) e sim dois blocos de HTML inteiros, um por idioma,
// escolhidos por `lang` (mesma variável que já controla o resto da UI).
// Mesma estrutura de conteúdo do MECANICAS.md no repositório — se atualizar
// uma mecânica aqui, atualizar lá também (ver comentário no topo daquele
// arquivo).
const ABOUT_HTML_PT = `
  <div class="card">
    <h3>Atributos e posições</h3>
    <p>Cada jogador tem 22 skills (técnicas, mentais e físicas), de 0 a 99. Cada posição tem um "perfil" de pesos (0 a 1,3) que diz quais skills a definem — por exemplo, pilar pesa forte em Scrum/Força/Tackle, abertura pesa forte em Chute/Drop Goal/Visão/Comunicação. O overall de um jogador numa posição é a média dessas skills ponderada pelo perfil daquela posição.</p>
    <p>Jogador escalado fora da posição natural (posição alternativa) joga com um desconto de ~4% no overall efetivo. Primeira línea (pilar/hooker) é a única exceção real: nunca aceita improviso — só entra ali quem é especialista de verdade (natural ou treinado, ver abaixo). Sem especialista disponível, o clube convoca um juvenil de 18 anos de urgência.</p>
  </div>
  <div class="card">
    <h3>Comissão técnica</h3>
    <p>Além do papel/função de cada um, alguns membros do staff têm skills próprias (0-99, como as dos jogadores): trabalho com a base, treino de backs, treino de forwards, treino de chute, estruturas fixas (scrum/ruck/line-out), preparação física, fisioterapia, nutrição esportiva, comunicação, paciência e didática. Ex.: o preparador técnico Figu Super lida muito bem com jovens/infantis, é ótimo treinador de backs e de chute, com boa comunicação, paciência e didática — isso acelera de verdade o treino de backs, de chute e o nível dos novos garotos que entram na base, não é só um texto de sabor. O nutricionista Cemilson é referência em nutrição esportiva e tem boa comunicação com o grupo: isso acelera a recuperação da condição física de todo o elenco entre uma partida e outra, e ajuda a evolução da comunicação nos churrascos do time. O head coach Lito Molina é referência de toda a região do Nordeste Argentino (NEA) nas estruturas fixas do jogo (scrum, ruck e line-out) — um dos melhores, senão o melhor, especialista da região —, o que acelera bastante o treino de grupo de line-out; o auxiliar técnico Sebas Bereta, que assume o time B quando as duas competições caem no mesmo dia em locais diferentes, também é de bom a ótimo nessa mesma especialidade. O treinador geral Alexis Cibils é muito bom em preparação física e controle de carga da academia, o que acelera a evolução física na academia e reduz o desgaste desnecessário do treino. E o fisioterapeuta Juan Carmona é excelente em fisioterapia, dando uma chance real de encurtar em uma semana a recuperação de cada lesão.</p>
    <p>Todo clube com plantel real (curado) tem sua própria comissão, escalada pelo porte do clube: Curda e San José são os dois grandes clubes dual-competição do Paraguaio, com comissão completa (8 pessoas) e de ponta; Curne e Duendes RC são clubes médios, com staff menor e sem nutricionista dedicado; clubes menores como Cristo Rey, Santa Clara, Belgrano Athletic, Santa Fe RC, Club Atlético Estudiantes e Champagnat têm só 1-2 pessoas na comissão (em geral só o treinador principal, às vezes com um preparador físico), sem fisioterapeuta nem nutricionista — e treinam mais devagar que a média.</p>
  </div>
  <div class="card">
    <h3>Estrutura do clube</h3>
    <p>Além da comissão técnica (as pessoas), cada clube tem uma qualidade de ESTRUTURA FÍSICA (as instalações em si) que multiplica especificamente o rendimento da academia — uma dimensão separada do staff: mesmo com bons treinadores, treinar sem instalação dedicada rende menos e cansa mais. O Curda tem sede própria completa no meio de Assunção — academia, campo de hóquei, arquibancadas, vestiário, sala de vídeo, churrasqueira, tudo organizado — além de uma filial em Surubi-í, com dois campos de rugby, vestiário, salão de festa, churrasqueira e um espaço grande pra montar tendas, palcos e lojas de campeonato. A maioria dos outros clubes não tem nada parecido, então mesmo com staff comparável treinam mais devagar na academia.</p>
  </div>
  <div class="card">
    <h3>Treino semanal</h3>
    <ul>
      <li><b>Foco de clube (seg/ter/qui):</b> escolha um tipo de treino por dia (Duelo, Tocata, Contato, Formação, Touch, Pique, Chute a gol, Quebra de linha, Liderança, Recuperação) — cada tipo evolui um grupo de skills relacionadas em todo o elenco.</li>
      <li><b>Treino individual (DIP):</b> escolha UM atributo por jogador pra evoluir garantido, mais rápido, à custa de mais desgaste físico. Rende conforme a assiduidade do jogador naquela atividade (0 a 5x por semana).</li>
      <li><b>Treino de nova posição:</b> em vez do DIP normal, o jogador foca só nas skills que definem uma posição nova. Depois de ~10 semanas rendendo (pilar/hooker exige ~3 meses, 13 semanas — scrum de verdade não se aprende rápido), ele aprende a posição de vez e vira alternativa permanente.</li>
      <li><b>Grupo de line-out:</b> lançador, saltador e levantadores treinam juntos — cada papel evolui a skill certa (lançamento, salto, força) e o grupo ganha entrosamento mais rápido entre si.</li>
      <li><b>Academia, vídeo, churrasco:</b> academia evolui força/agilidade/resistência; vídeo evolui visão/posicionamento; churrasco evolui comunicação e entrosamento geral do grupo (churrasco dos forwards é só do pack, mais raro).</li>
      <li>Cada jogador tem assiduidade própria (8 a 20) em 6 atividades independentes — dá pra ser assíduo numa e relapso noutra.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Condição física, fadiga e motivação</h3>
    <ul>
      <li>Condição cai depois de cada partida (mais pra quem tem menos resistência) e se recupera com o tempo até a próxima.</li>
      <li>Jogador desgastado e mal recuperado corre risco de lesão por fadiga — fica fora por semanas.</li>
      <li><b>Motivação:</b> quem passa 3+ rodadas seguidas sem entrar em campo reage conforme disciplina + determinação — a maioria vai perdendo frequência de treino geral/academia aos poucos; uns poucos profissionais de verdade (as duas skills bem altas) fazem o oposto e treinam ainda mais pra forçar a volta.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Entrosamento (chemistry)</h3>
    <p>Cresce devagar entre qualquer dupla que joga junto, e mais rápido com treino de grupo dedicado. O entrosamento médio do quarteto de line-out e do pack de scrum dá um bônus pequeno no timing/sucesso dessas duas fases no motor de simulação.</p>
  </div>
  <div class="card">
    <h3>Tática</h3>
    <ul>
      <li>Plano de jogo dividido em 4 zonas do campo (vermelha, laranja, verde, dourada/ingoal), cada uma com um estilo (chute, forwards/jogo corrido, equilibrado) e uma formação de pods dos forwards (3-3-2, 1-3-3-1, 3-3-1-1, 2-2-2-2 ou 4-4 — esse último pra pick-and-go perto do ingoal).</li>
      <li>Pilares táticos gerais (posse, disciplina etc.) ajustáveis por slider.</li>
      <li>Sistemas de jogo reais (Irlanda, Argentina, Sudáfrica...) mudam a formação visual dos pods na quadra.</li>
      <li>A IA rival reage taticamente: ajusta antes do jogo pela diferença de força entre os times e no intervalo conforme o placar.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Simulação da partida</h3>
    <ul>
      <li>Clima sorteado a cada partida, afeta o aproveitamento de chute a gol.</li>
      <li>Mandante tem uma pequena vantagem fixa.</li>
      <li>Moral/sequência de resultados recentes de cada time influencia o desempenho.</li>
      <li>Eventos possíveis a cada tick: quebra de linha, turnover, erro de manuseio (knock-on), scrum, line-out, cartão amarelo/vermelho, try, conversão, penal, drop goal.</li>
      <li>Estatísticas do pós-jogo são reais (território, quebras, turnovers, erros, scrums/line-outs ganhos, conversões/penais/drops, cartões) — calculadas evento por evento, não geradas aleatoriamente.</li>
      <li>Quando um try é marcado, a linha de três-quartos do time que ganhou a jogada varre a quadra até o escanteio — quem ganha um line-out forma uma linha de ataque funda, quem defende fica achatado perto da disputa.</li>
      <li>A IA rival também faz substituições táticas durante a partida.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Recrutamento e formação de base</h3>
    <ul>
      <li><b>Captação de promessas:</b> chance por rodada de surgir um jogador revelado num clube menor do Paraguaio, disponível pra convidar.</li>
      <li><b>Academia de base (M14 a M18):</b> sobe de categoria com o tempo; quem se forma na M18 entra pro elenco principal.</li>
      <li><b>Recém-chegados estrangeiros:</b> raramente aparece um novo morador de Assunção decidindo tentar rugby, procurando o Curda primeiro — argentinos e uruguaios mais comuns, brasileiros raros e com pouca bagagem no esporte, europeus e neozelandeses raríssimos mas bem mais aptos.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Multi-competição</h3>
    <p>Clubes como o Curda disputam duas ligas ao mesmo tempo (NEA argentino + campeonato paraguaio), com o mesmo elenco. Regra de choque de agenda: se as duas competições caírem na mesma data em locais diferentes, o mesmo jogador não pode ser escalado nas duas.</p>
  </div>
`;

const ABOUT_HTML_ES = `
  <div class="card">
    <h3>Atributos y posiciones</h3>
    <p>Cada jugador tiene 22 skills (técnicas, mentales y físicas), de 0 a 99. Cada posición tiene un "perfil" de pesos (0 a 1,3) que dice qué skills la definen — por ejemplo, pilar pesa fuerte en Scrum/Fuerza/Tackle, apertura pesa fuerte en Pateo/Drop Goal/Visión/Comunicación. El overall de un jugador en una posición es el promedio de esas skills ponderado por el perfil de esa posición.</p>
    <p>Jugador alineado fuera de su posición natural (posición alternativa) juega con un descuento de ~4% en el overall efectivo. Primera línea (pilar/hooker) es la única excepción real: nunca acepta improvisación — solo entra ahí quien es especialista de verdad (natural o entrenado, ver abajo). Sin especialista disponible, el club convoca de urgencia a un juvenil de 18 años.</p>
  </div>
  <div class="card">
    <h3>Comisión técnica</h3>
    <p>Además del rol/función de cada uno, algunos miembros del staff tienen skills propias (0-99, como las de los jugadores): trabajo con la base, entrenamiento de backs, entrenamiento de forwards, entrenamiento de pateo, estructuras fijas (scrum/ruck/line-out), preparación física, fisioterapia, nutrición deportiva, comunicación, paciencia y didáctica. Ej.: el preparador técnico Figu Super lidia muy bien con jóvenes/niños, es un excelente entrenador de backs y de pateo, con buena comunicación, paciencia y didáctica — eso acelera de verdad el entrenamiento de backs, de pateo y el nivel de los nuevos chicos que entran a la base, no es solo un texto de sabor. El nutricionista Cemilson es referente en nutrición deportiva y tiene buena comunicación con el grupo: eso acelera la recuperación de la condición física de todo el plantel entre un partido y otro, y ayuda a la evolución de la comunicación en los asados del equipo. El head coach Lito Molina es referente de toda la región del Nordeste Argentino (NEA) en las estructuras fijas del juego (scrum, ruck y line-out) — uno de los mejores, si no el mejor, especialista de la región —, lo que acelera bastante el entrenamiento de grupo de line-out; el auxiliar técnico Sebas Bereta, que asume el equipo B cuando las dos competiciones caen el mismo día en lugares distintos, también es de bueno a excelente en esa misma especialidad. El entrenador general Alexis Cibils es muy bueno en preparación física y control de carga de la academia, lo que acelera la evolución física en la academia y reduce el desgaste innecesario del entrenamiento. Y el fisioterapeuta Juan Carmona es excelente en fisioterapia, dando una chance real de acortar en una semana la recuperación de cada lesión.</p>
    <p>Todo club con plantel real (curado) tiene su propia comisión, escalada según el porte del club: Curda y San José son los dos grandes clubes dual-competición del paraguayo, con comisión completa (8 personas) y de primer nivel; Curne y Duendes RC son clubes medianos, con staff más chico y sin nutricionista dedicado; clubes más chicos como Cristo Rey, Santa Clara, Belgrano Athletic, Santa Fe RC, Club Atlético Estudiantes y Champagnat tienen solo 1-2 personas en la comisión (en general solo el entrenador principal, a veces con un preparador físico), sin fisioterapeuta ni nutricionista — y entrenan más lento que el promedio.</p>
  </div>
  <div class="card">
    <h3>Estructura del club</h3>
    <p>Además de la comisión técnica (las personas), cada club tiene una calidad de ESTRUCTURA FÍSICA (las instalaciones en sí) que multiplica específicamente el rendimiento de la academia — una dimensión separada del staff: incluso con buenos entrenadores, entrenar sin instalación dedicada rinde menos y cansa más. El Curda tiene sede propia completa en el medio de Asunción — academia, cancha de hockey, tribunas, vestuario, sala de video, quincho, todo organizado — además de una filial en Surubi-í, con dos canchas de rugby, vestuario, salón de fiestas, quincho y un espacio grande para montar carpas, escenarios y locales de campeonato. La mayoría de los otros clubes no tiene nada parecido, así que aunque el staff sea comparable entrenan más lento en la academia.</p>
  </div>
  <div class="card">
    <h3>Entrenamiento semanal</h3>
    <ul>
      <li><b>Foco de club (lun/mar/jue):</b> elegí un tipo de entrenamiento por día (Duelo, Toque, Contacto, Formación, Touch, Pique, Pateo a los palos, Quiebre de línea, Liderazgo, Recuperación) — cada tipo evoluciona un grupo de skills relacionadas en todo el plantel.</li>
      <li><b>Entrenamiento individual (DIP):</b> elegí UN atributo por jugador para evolucionar garantizado, más rápido, a costa de más desgaste físico. Rinde según la asiduidad del jugador en esa actividad (0 a 5 veces por semana).</li>
      <li><b>Entrenamiento de nueva posición:</b> en vez del DIP normal, el jugador enfoca todo en las skills que definen una posición nueva. Después de ~10 semanas rindiendo (pilar/hooker exige ~3 meses, 13 semanas — el scrum de verdad no se aprende rápido), aprende la posición de una vez y se vuelve alternativa permanente.</li>
      <li><b>Grupo de line-out:</b> lanzador, saltador y levantadores entrenan juntos — cada rol evoluciona la skill correcta (lanzamiento, salto, fuerza) y el grupo gana más rápido entrosamiento entre sí.</li>
      <li><b>Academia, video, asado:</b> academia evoluciona fuerza/agilidad/resistencia; video evoluciona visión/posicionamiento; asado evoluciona comunicación y entrosamiento general del grupo (asado de forwards es solo del pack, más raro).</li>
      <li>Cada jugador tiene asiduidad propia (8 a 20) en 6 actividades independientes — puede ser asiduo en una y relajado en otra.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Condición física, fatiga y motivación</h3>
    <ul>
      <li>La condición baja después de cada partido (más para quien tiene menos resistencia) y se recupera con el tiempo hasta el próximo.</li>
      <li>Jugador desgastado y mal recuperado corre riesgo de lesión por fatiga — queda afuera por semanas.</li>
      <li><b>Motivación:</b> quien pasa 3+ fechas seguidas sin entrar en cancha reacciona según disciplina + determinación — la mayoría va perdiendo asiduidad de entrenamiento general/academia de a poco; unos pocos profesionales de verdad (las dos skills bien altas) hacen lo opuesto y entrenan todavía más para forzar la vuelta.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Entrosamiento (chemistry)</h3>
    <p>Crece lento entre cualquier dupla que juega junta, y más rápido con entrenamiento de grupo dedicado. El entrosamiento promedio del cuarteto de line-out y del pack de scrum da un bono chico en el timing/éxito de esas dos fases en el motor de simulación.</p>
  </div>
  <div class="card">
    <h3>Táctica</h3>
    <ul>
      <li>Plan de juego dividido en 4 zonas de la cancha (roja, naranja, verde, dorada/ingoal), cada una con un estilo (pateo, forwards/juego corrido, equilibrado) y una formación de pods de forwards (3-3-2, 1-3-3-1, 3-3-1-1, 2-2-2-2 o 4-4 — este último para pick-and-go cerca del ingoal).</li>
      <li>Pilares tácticos generales (posesión, disciplina, etc.) ajustables por control deslizante.</li>
      <li>Sistemas de juego reales (Irlanda, Argentina, Sudáfrica...) cambian la formación visual de los pods en la cancha.</li>
      <li>La IA rival reacciona tácticamente: ajusta antes del partido según la diferencia de nivel entre los equipos y en el entretiempo según el marcador.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Simulación del partido</h3>
    <ul>
      <li>Clima sorteado en cada partido, afecta el rendimiento del pateo a los palos.</li>
      <li>El local tiene una pequeña ventaja fija.</li>
      <li>La moral/racha de resultados recientes de cada equipo influye en el rendimiento.</li>
      <li>Eventos posibles en cada tick: quiebre de línea, turnover, error de manejo (knock-on), scrum, line-out, tarjeta amarilla/roja, try, conversión, penal, drop goal.</li>
      <li>Las estadísticas del post-partido son reales (territorio, quiebres, turnovers, errores, scrums/line-outs ganados, conversiones/penales/drops, tarjetas) — calculadas evento por evento, no generadas al azar.</li>
      <li>Cuando se marca un try, la línea de tres cuartos del equipo que ganó la jugada barre la cancha hasta el escenario — quien gana un line-out forma una línea de ataque profunda, quien defiende queda achatado cerca de la disputa.</li>
      <li>La IA rival también hace cambios tácticos durante el partido.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Captación y formación de base</h3>
    <ul>
      <li><b>Captación de promesas:</b> chance por fecha de que surja un jugador revelado en un club chico del Paraguayo, disponible para invitar.</li>
      <li><b>Academia de base (M14 a M18):</b> sube de categoría con el tiempo; quien se gradúa de la M18 entra al plantel principal.</li>
      <li><b>Recién llegados extranjeros:</b> rara vez aparece un nuevo residente de Asunción decidiendo probar el rugby, buscando primero al Curda — argentinos y uruguayos más comunes, brasileños raros y con poco bagaje en el deporte, europeos y neozelandeses rarísimos pero mucho más aptos.</li>
    </ul>
  </div>
  <div class="card">
    <h3>Multi-competición</h3>
    <p>Clubes como el Curda disputan dos ligas al mismo tiempo (NEA argentino + campeonato paraguayo), con el mismo plantel. Regla de choque de agenda: si las dos competiciones caen en la misma fecha en lugares distintos, el mismo jugador no puede ser alineado en las dos.</p>
  </div>
`;

function renderAbout() {
  content.innerHTML = `
    <h1>${t('navSobre')}</h1>
    ${lang === 'pt' ? ABOUT_HTML_PT : ABOUT_HTML_ES}
  `;
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
  else if (currentView === 'agenda') renderAgenda();
  else if (currentView === 'standings') renderStandings();
  else if (currentView === 'fixture') renderFixture();
  else if (currentView === 'squad') renderSquad();
  else if (currentView === 'training') renderTraining();
  else if (currentView === 'tactics') renderTactics();
  else if (currentView === 'selection') renderSelection();
  else if (currentView === 'about') renderAbout();
  else if (currentView === 'matchday') renderMatchday();
  else if (currentView === 'live') renderLive();
  else if (currentView === 'copaLive') renderCopaArgentinaLive();
}

function renderTeamSelect() {
  const difficultyOption = key => `
    <button type="button" class="sortBtn difficultyBtn ${newGameDifficulty === key ? 'selected' : ''}" data-difficulty="${key}">
      <b>${t('difficulty' + key.charAt(0).toUpperCase() + key.slice(1))}</b>
      <span class="muted">${t('difficulty' + key.charAt(0).toUpperCase() + key.slice(1) + 'Desc')}</span>
    </button>
  `;
  content.innerHTML = `
    <h1>${t('teamSelectTitle')}</h1>
    <p class="muted">${t('teamSelectDesc')}</p>
    <div class="card">
      <h3>${t('difficultyTitle')}</h3>
      <p class="muted">${t('difficultyDesc')}</p>
      <div class="difficultyOptions">
        ${difficultyOption('facil')}
        ${difficultyOption('medio')}
        ${difficultyOption('dificil')}
      </div>
    </div>
    <div id="leagueSections"></div>
  `;
  Array.from(document.querySelectorAll('[data-difficulty]')).forEach(btn => {
    btn.addEventListener('click', () => {
      newGameDifficulty = btn.dataset.difficulty;
      renderTeamSelect();
    });
  });
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
        <div class="teamCrest" style="${crestStyle(team)}">${crestContent(team)}</div>
        <div class="teamName">${team.name}</div>
        <div class="teamStats">${t('statsLine', {a: team.attack, d: team.defense, s: team.stamina})}</div>
        ${dual ? `<div class="teamStats muted">${t('dualLeague')}</div>` : ''}
      `;
      card.addEventListener('click', () => newGame(team.id, newGameDifficulty));
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

// ---- Agenda do mês (jogos + treino) ---------------------------------------
// state.calendarDay é "dias desde o início da temporada"; mapeamos pra uma
// data real só pra ter uma grade de calendário de verdade (nomes de dia da
// semana/mês via toLocaleDateString). Cada semana de 7 dias segue sempre
// segunda->domingo: treino às segunda/terça/quinta, jogo aos sábados —
// mesma convenção já usada no resto do jogo (explicacaoTreino etc.).
function seasonStartDate() {
  const d = new Date(2026, 1, 2);
  const day = d.getDay(); // 0=dom, 1=seg, ...
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); // volta pra segunda-feira daquela semana
  return d;
}

function dateForOffset(offsetDays) {
  const d = new Date(seasonStartDate());
  d.setDate(d.getDate() + offsetDays);
  return d;
}

// índice do dia dentro da semana (0=seg ... 6=dom)
const WEEKDAY_ROLE = ['treino', 'treino', 'livre', 'treino', 'livre', 'jogo', 'livre'];
const TRAINING_DAY_KEY = {0: 'seg', 1: 'ter', 3: 'qui'};

function trainingFocusForWeekday(d) {
  const key = TRAINING_DAY_KEY[d];
  if (!key) return null;
  const val = state.trainingFocus && state.trainingFocus[key];
  return typeof val === 'string' && TRAINING_TYPES[val] ? val : null;
}

// Quantas rodadas dessa competição já são conhecidas (fixture gerado por
// inteiro na fase de liga/grupos; mata-mata só existe rodada a rodada,
// conforme é gerada).
function totalRoundsKnown(c) {
  if (c.stage === 'league') return c.fixture.length;
  if (c.stage === 'groups') return Math.max(...Object.values(c.groupFixtures).map(f => f.length));
  if (c.stage === 'knockout') return c.knockoutRounds.length;
  return 0;
}

// A própria partida do clube numa rodada específica (0-indexed), em
// qualquer estágio da competição — generaliza myMatchThisRound (que só olha
// a rodada ATUAL) pra poder desenhar o calendário inteiro.
function myMatchAtRoundIndex(c, idx) {
  if (c.stage === 'league') {
    const round = c.fixture[idx];
    return round ? round.matches.find(m => m.home === c.teamId || m.away === c.teamId) || null : null;
  }
  if (c.stage === 'groups') {
    const g = c.groupOf[c.teamId];
    const round = c.groupFixtures[g][idx];
    return round ? round.matches.find(m => m.home === c.teamId || m.away === c.teamId) || null : null;
  }
  if (c.stage === 'knockout') {
    const round = c.knockoutRounds[idx];
    return round ? round.matches.find(m => m.home === c.teamId || m.away === c.teamId) || null : null;
  }
  return null;
}

function renderAgenda() {
  const locale = lang === 'es' ? 'es-PY' : 'pt-BR';
  const todayOffset = state.calendarDay;
  const currentWeek = Math.floor(todayOffset / 7);
  const startWeek = Math.max(0, currentWeek - 1);
  const WEEKS_TO_SHOW = 5;
  const competitionsForCalendar = Object.entries(state.competitions);

  const weekdayHeaders = Array.from({length: 7}, (_, i) => dateForOffset(i).toLocaleDateString(locale, {weekday: 'short'}));

  const weekRowsHtml = Array.from({length: WEEKS_TO_SHOW}, (_, wi) => {
    const w = startWeek + wi;
    const cellsHtml = Array.from({length: 7}, (_, d) => {
      const offset = w * 7 + d;
      const date = dateForOffset(offset);
      const isToday = offset === todayOffset;
      const role = WEEKDAY_ROLE[d];
      let extraHtml = '';
      if (role === 'treino') {
        const focusType = trainingFocusForWeekday(d);
        extraHtml = `<div class="agendaTrainingBadge">${t('agendaTreino')}${focusType ? `: ${trainingTypeLabel(focusType)}` : ''}</div>`;
      } else if (role === 'jogo') {
        competitionsForCalendar.forEach(([key, c]) => {
          if (w >= totalRoundsKnown(c)) return;
          const m = myMatchAtRoundIndex(c, w);
          if (!m) return;
          const oppId = m.home === c.teamId ? m.away : m.home;
          const opp = teamById[oppId];
          const isHome = m.home === c.teamId;
          const resultText = m.played ? `${m.scoreHome}-${m.scoreAway}` : (isHome ? t('home') : t('away'));
          const pendingBlocked = !m.played && competitionBlockedReason(key);
          extraHtml += `
            <div class="agendaMatchBadge ${m.played ? 'played' : 'pending'}" style="border-color:${opp.color}" ${!m.played && !pendingBlocked ? `data-goto-comp="${key}"` : ''}>
              <b>${competitionLabel(key)}</b> vs ${escapeHtmlAttr(opp.name)} <span class="muted">${resultText}</span>
            </div>
          `;
        });
      }
      return `
        <div class="agendaCell ${isToday ? 'today' : ''} agenda-${role}">
          <div class="agendaCellDate">${date.getDate()}</div>
          ${extraHtml}
        </div>
      `;
    }).join('');
    return `<div class="agendaWeekRow">${cellsHtml}</div>`;
  }).join('');

  content.innerHTML = `
    <h1>${t('agendaTitle')}</h1>
    <p class="muted">${t('agendaHelp')}</p>
    <div class="card">
      <div class="agendaHeaderRow">${weekdayHeaders.map(h => `<div class="agendaHeaderCell">${h}</div>`).join('')}</div>
      ${weekRowsHtml}
    </div>
  `;

  Array.from(document.querySelectorAll('[data-goto-comp]')).forEach(el => {
    el.addEventListener('click', () => {
      state.activeCompetition = el.dataset.gotoComp;
      currentView = 'matchday';
      render();
    });
  });
}

function renderCopaArgentinaCardHtml() {
  const copa = state.copaArgentina;
  if (!copa) return '';
  const myTeam = teamById[copa.myTeamId];
  const oppTeam = teamById[copa.opponentId];
  const {myTotal, oppTotal} = copaArgentinaAggregate(copa);

  const legsHtml = copa.legs.map((leg, i) => {
    const homeTeam = teamById[leg.home];
    const awayTeam = teamById[leg.away];
    const label = i === 0 ? t('copaIda') : t('copaVolta');
    const scoreText = leg.played ? `${leg.scoreHome} - ${leg.scoreAway}` : t('pending');
    return `<p>${label}: ${homeTeam.name} <span class="muted">vs</span> ${awayTeam.name} — <b>${scoreText}</b></p>`;
  }).join('');

  const statusHtml = copa.championId
    ? `<p><b>${copa.championId === copa.myTeamId ? t('copaCampeao') : t('copaVice')}</b>: ${teamById[copa.championId].name}</p>`
    : `<button class="playBtn goCopaBtn">${t('prepareMatch')}</button>`;

  return `
    <div class="card">
      <h3>${t('copaArgentinaTitle')} <span class="muted">— ${myTeam.name} vs ${oppTeam.name}</span></h3>
      ${legsHtml}
      <p class="muted">${t('copaAgregado', {my: myTotal, opp: oppTotal})}</p>
      ${statusHtml}
    </div>
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
    const blockedBy = match ? competitionBlockedReason(key) : null;
    if (match) {
      const oppId = match.home === c.teamId ? match.away : match.home;
      const opp = teamById[oppId];
      const isHome = match.home === c.teamId;
      if (blockedBy) {
        matchHtml = `
          <p><b>${roundName}</b> — ${isHome ? t('home') : t('away')} contra <b>${opp.name}</b></p>
          <p class="muted">${t('agendaBloqueado', {comp: competitionLabel(blockedBy)})}</p>
          <button class="ctrlBtn goMatchdayBtn" data-comp="${blockedBy}">${t('agendaIrPara', {comp: competitionLabel(blockedBy)})}</button>
        `;
      } else {
        matchHtml = `
          <p><b>${roundName}</b> — ${isHome ? t('home') : t('away')} contra <b>${opp.name}</b></p>
          <button class="playBtn goMatchdayBtn" data-comp="${key}">${t('prepareMatch')}</button>
        `;
      }
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
    <div class="dashboardHeaderRow">
      <div class="teamCrest dashboardCrest" style="${crestStyle(myTeam)}">${crestContent(myTeam)}</div>
      <div>
        <h1>${t('dashboardTitle', {team: myTeam.name})}</h1>
      </div>
    </div>
    ${keys.length > 1 ? `<p class="muted">${t('dashboardDualNote', {team: myTeam.name})}</p>` : ''}
    ${cardsHtml}
    ${renderCopaArgentinaCardHtml()}
  `;

  const goCopaBtn = document.querySelector('.goCopaBtn');
  if (goCopaBtn) {
    goCopaBtn.addEventListener('click', () => {
      currentView = 'copaLive';
      render();
    });
  }

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
    body += Object.keys(c.groupStandings).map(g => `
      <div class="card"><h3>${groupDisplayName(c, g)}</h3>${renderTableHtml(sortedStandings(c.groupStandings[g]), c.teamId)}</div>
    `).join('');
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

function renderRoundRobinInto(list, fixture, c, isActive = true) {
  fixture.forEach(round => {
    const block = document.createElement('div');
    block.className = 'roundBlock card';
    const isCurrent = isActive && c.stage !== 'knockout' && round.round === (c.currentRoundIndex + 1);
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
    // paraguayo passa por 'league' E DEPOIS 'groups' (Oro/Descenso) na mesma
    // competição, então c.fixture e c.groupFixtures podem coexistir — mostra
    // os dois nesse caso, em vez de só o primeiro que existir.
    if (c.fixture) {
      renderRoundRobinInto(list, c.fixture, c, c.stage === 'league');
    }
    if (c.groupFixtures) {
      Object.keys(c.groupFixtures).forEach(g => {
        const title = document.createElement('h3'); title.textContent = groupDisplayName(c, g);
        list.appendChild(title);
        renderRoundRobinInto(list, c.groupFixtures[g], c, c.stage === 'groups');
      });
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
  agility: 'AGI', recovery: 'RCP', comunicacao: 'COM',
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

// Posições alternativas do jogador (meta.altPos) — mostradas como um "tb."
// (também) discreto ao lado do posto principal, pra ficar visível que ele
// pode ser escalado noutro posto (ver canPlay/pickStartingXV).
function altPosHtml(meta) {
  if (!meta.altPos || !meta.altPos.length) return '';
  return ` <span class="muted altPosBadge" title="${t('altPosTitle')}">(${t('altPosPrefix')} ${meta.altPos.map(id => POS_LABEL[id]).join('/')})</span>`;
}

// Painel expandido com a nota individual de cada um dos 22 atributos,
// agrupados por categoria — aberto ao clicar na linha do jogador. O DIP
// (treino individual intensivo) fica na aba Treinamento, não aqui.
function skillDetailHtml(p, colspan) {
  const groupHtml = category => `
    <div class="skillDetailGroup">
      <h4>${category[0].toUpperCase()}${category.slice(1)}</h4>
      ${SKILL_CATEGORIES[category].map(k => `
        <div class="skillDetailRow">
          <span class="skillDetailLabel" title="${escapeHtmlAttr(skillLabel(k))}: ${escapeHtmlAttr(skillDesc(k))}">${SKILL_SHORT[k]}</span>
          ${skillCell(p.skills[k])}
        </div>
      `).join('')}
    </div>
  `;
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
          ${p.meta.trainingAttendance ? `
          <div class="skillDetailGroup">
            <h4>${t('assiduidadeTitle')}</h4>
            ${ATTENDANCE_CATEGORIES.map(cat => `
              <div class="skillDetailRow">
                <span class="skillDetailLabel" title="${escapeHtmlAttr(attendanceLabel(cat))}: ${escapeHtmlAttr(attendanceDesc(cat))}">${ATTENDANCE_SHORT[cat]}</span>
                ${p.meta.trainingAttendance[cat]}
              </div>
            `).join('')}
          </div>` : ''}
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

function statusCell(p) {
  if (p.status === 'lesionado') return `<span style="color:var(--accent-2)">${t('lesionado', {label: p.meta.injuryLabel})}</span>`;
  if (p.status === 'indisponivel') {
    const label = arcCalledUpIds().has(p.id) ? t('convocadoSelecao') : t('indisponivel');
    return `<span style="color:var(--accent-2)">${label}</span>`;
  }
  if (p.status === 'titular') return `<b>${t('titular', {n: p.number})}</b>`;
  return `<span class="muted">${t('reserva')}</span>`;
}

// Ordem de posto (forwards antes de backs, seguindo a numeração tradicional
// 1-15) usada pra ordenar "por posição": titulares primeiro por número de
// camisa (1 a 15), depois reservas agrupadas por posto e, dentro do mesmo
// posto, do melhor pro pior.
const POS_ORDER_INDEX = {PI: 0, HK: 1, SL: 2, AL: 3, N8: 4, MS: 5, AP: 6, WG: 7, CE: 8, FB: 9};

// Opções do filtro "por posição": um botão por posto (na ordem 1-15) mais
// "ver todos" — usado tanto no plantel principal quanto na base (ver
// renderRealSquad/renderYouthAcademyHtml).
const POS_FILTER_OPTIONS = Object.keys(POS_ORDER_INDEX).map(id => ({
  id,
  label: POSITIONS.find(p => p.id === id).label,
}));

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

// Foco de treino do clube pra segunda/terça/quinta, escolhido pelo técnico:
// em vez de marcar atributos soltos, ele escolhe UM TIPO de treino por dia
// (ver TRAINING_TYPES em data.js — cada tipo já evolui vários atributos
// relacionados ao mesmo tempo, ex.: "Duelo" trabalha decisão+passe+recepção+
// aceleração juntos). Dia sem tipo escolhido volta pro sorteio automático
// (ver tickTraining).
function renderTrainingFocusHtml() {
  const focus = state.trainingFocus || {seg: null, ter: null, qui: null};
  const dayLabel = {seg: t('trainSeg'), ter: t('trainTer'), qui: t('trainQui')};
  const dayColumnHtml = day => {
    const rawSelected = focus[day];
    const selected = typeof rawSelected === 'string' && TRAINING_TYPES[rawSelected] ? rawSelected : null;
    const optionsHtml = Object.keys(TRAINING_TYPES).map(k => `
      <label class="trainingFocusOption trainingTypeOption ${selected === k ? 'selected' : ''}">
        <input type="radio" class="trainingFocusRadio" name="trainingFocus-${day}" data-day="${day}" value="${k}"
          ${selected === k ? 'checked' : ''} />
        <span class="trainingTypeName">${trainingTypeLabel(k)}</span>
        <span class="muted trainingTypeSkills">${trainingTypeSkillsLabel(k)}</span>
      </label>
    `).join('');
    return `
      <div class="trainingFocusDayCol">
        <div class="trainingFocusDayLabel">${dayLabel[day]}</div>
        <label class="trainingFocusOption trainingTypeOption ${selected === null ? 'selected' : ''}">
          <input type="radio" class="trainingFocusRadio" name="trainingFocus-${day}" data-day="${day}" value=""
            ${selected === null ? 'checked' : ''} />
          <span class="trainingTypeName">${t('trainingAutomatico')}</span>
        </label>
        ${optionsHtml}
      </div>
    `;
  };
  return `
    <div class="card">
      <h3>${t('trainingFocusTitle')}</h3>
      <p class="muted">${t('trainingFocusHelp')}</p>
      <div class="trainingFocusGrid">
        ${['seg', 'ter', 'qui'].map(dayColumnHtml).join('')}
      </div>
    </div>
  `;
}

// Grupo de treino de line-out: o técnico escolhe quem lança, quem salta e
// os dois levantadores — ao ativar, cada um evolui a skill do seu papel
// (ver LINEOUT_GROUP_ROLE_SKILL/tickGroupTraining) e o quarteto ganha
// entrosamento entre si, que entra no timing do lineout nas partidas (ver
// computeChemistryBonuses/engine.js).
// Pool selecionável pro grupo de line-out: todo o plantel principal (forwards,
// não lesionados) + os forwards das categorias de base M16/M18 (16+ anos) —
// M14/M15 fica de fora, cedo demais pra treinar com o time principal (ver
// findTrainablePlayer). Qualquer papel aceita quantos jogadores o técnico
// quiser (mais de um lançador, vários saltadores etc.).
function lineoutTrainablePool() {
  const roster = getRealRoster(state.myTeamId) || [];
  const fromRoster = roster.filter(p => !p.meta.injuryWeeks && p.group === 'forward');
  const academy = state.youthAcademy || {};
  const fromYouth = ['M16', 'M18'].flatMap(cat => (academy[cat] || []).filter(p => p.group === 'forward'));
  return [...fromRoster, ...fromYouth];
}

function renderLineoutGroupHtml() {
  if (!getRealRoster(state.myTeamId)) return '';
  const group = (state.trainingGroups && state.trainingGroups.lineout) || {throwerIds: [], jumperIds: [], lifterIds: [], active: false};
  const pool = lineoutTrainablePool();
  const roleChecklist = (role, label) => {
    const selected = group[role] || [];
    return `
      <div class="lineoutGroupRoleCol">
        <div class="trainingFocusDayLabel">${label} <span class="muted">(${selected.length})</span></div>
        ${pool.map(p => `
          <label class="trainingFocusOption trainingTypeOption ${selected.includes(p.id) ? 'selected' : ''}">
            <input type="checkbox" class="lineoutGroupCheck" data-role="${role}" value="${p.id}" ${selected.includes(p.id) ? 'checked' : ''} />
            <span class="trainingTypeName">${escapeHtmlAttr(p.name)}${p.meta.youthCategory ? ` <span class="muted">(${p.meta.youthCategory})</span>` : ''}</span>
          </label>
        `).join('')}
      </div>
    `;
  };
  return `
    <div class="card">
      <h3>${t('lineoutGroupTitle')}</h3>
      <p class="muted">${t('lineoutGroupHelp')}</p>
      <div class="trainingFocusGrid">
        ${roleChecklist('throwerIds', t('lineoutGroupHooker'))}
        ${roleChecklist('jumperIds', t('lineoutGroupJumper'))}
        ${roleChecklist('lifterIds', t('lineoutGroupLifter'))}
      </div>
      <label class="trainingFocusOption trainingTypeOption ${group.active ? 'selected' : ''}" style="margin-top:6px">
        <input type="checkbox" id="lineoutGroupActive" ${group.active ? 'checked' : ''} />
        <span class="trainingTypeName">${t('lineoutGroupActivate')}</span>
      </label>
    </div>
  `;
}

function renderRealSquad() {
  const myOptions = {conditionOf: currentConditionOf, metaOverrides: state.playerOverrides, skillOverrides: state.skillGrowth, excludedIds: arcCalledUpIds()};
  let rows = rosterWithStatus(state.myTeamId, myOptions);
  if (squadSortMode === 'position') {
    if (squadPositionFilter) {
      // Com um posto específico selecionado, inclui quem também joga ali
      // como alternativa (altPos) — não só quem tem esse posto como natural
      // — e ordena pelo overall EFETIVO nesse posto (não o overall natural,
      // que seria enganoso pra quem só joga ali como segunda opção).
      rows = rows.filter(p => canPlay(p, squadPositionFilter))
        .sort((a, b) => effectiveOverallAt(b, squadPositionFilter) - effectiveOverallAt(a, squadPositionFilter));
    } else {
      rows = sortRowsByPosition(rows);
    }
  }
  const {xv} = formationDataFor(state.myTeamId, myOptions);
  const myTeam = teamById[state.myTeamId];
  const posFilterActive = squadSortMode === 'position' && squadPositionFilter;
  const rowHtml = p => `
    <tr class="squadRow ${p.status === 'lesionado' ? 'injuredRow' : ''}" data-player="${p.id}">
      <td>${statusCell(p)}</td>
      <td class="teamCol">▸ ${p.name}${p.meta.nickname ? ` <span class="muted">"${p.meta.nickname}"</span>` : ''}${p.meta.captain ? ' <b>(C)</b>' : ''}${p.meta.emergencyCallUp ? ` <span class="muted">(${t('convocacaoEmergenciaBadge')})</span>` : ''} ${traitsHtml(p.meta)}</td>
      <td class="posCol">${p.position}${altPosHtml(p.meta)}</td>
      <td><b>${posFilterActive ? effectiveOverallAt(p, squadPositionFilter) : p.rating}</b></td>
      ${conditionCell(p.condition)}
      ${categoryCell(p.skills, 'técnico')}
      ${categoryCell(p.skills, 'mental')}
      ${categoryCell(p.skills, 'físico')}
      <td class="posCol">${p.heightCm ? `${p.heightCm}cm/${p.weightKg}kg` : '—'}</td>
    </tr>
    ${skillDetailHtml(p, 9)}
  `;
  const headHtml = `
    <tr>
      <th>${t('colStatus')}</th><th class="teamCol">${t('colJogador')}</th><th>${t('colPosicao')}</th><th>${t('colOverall')}</th><th>${t('colCondicao')}</th>
      <th title="${t('colTecnico')}: ${SKILL_CATEGORIES.técnico.map(k => skillLabel(k)).join(', ')}">${t('colTecnico')}</th>
      <th title="${t('colMental')}: ${SKILL_CATEGORIES.mental.map(k => skillLabel(k)).join(', ')}">${t('colMental')}</th>
      <th title="${t('colFisico')}: ${SKILL_CATEGORIES.físico.map(k => skillLabel(k)).join(', ')}">${t('colFisico')}</th>
      <th>${t('colBio')}</th>
    </tr>
  `;
  const staff = getStaff(state.myTeamId);
  const staffSkillsLine = s => {
    if (!s.skills) return '';
    const parts = Object.entries(s.skills).map(([k, v]) => `${STAFF_SKILL_LABELS[k] || k} ${v}`);
    return `<div class="muted staffSkillsRow">${parts.join(' · ')}</div>`;
  };
  const staffHtml = staff ? `
    <div class="card">
      <h3>${t('comissaoTecnica')}</h3>
      <table>
        <tbody>
          ${staff.map(s => `<tr><td class="teamCol">${s.role}</td><td class="teamCol"><b>${s.name}</b>${s.note ? ` <span class="muted">— ${s.note}</span>` : ''}${staffSkillsLine(s)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';
  const isCurda = state.myTeamId === 'ARG-CUR' || state.myTeamId === 'PAR-CUR';
  const scoutingHtml = isCurda ? renderScoutingHtml() : '';
  const youthHtml = isCurda ? renderYouthAcademyHtml(squadSortMode === 'position' ? squadPositionFilter : null) : '';
  const posFilterHtml = squadSortMode === 'position' ? `
    <div class="posFilterToggle" id="squadPosFilterToggle">
      ${POS_FILTER_OPTIONS.map(o => `<button class="posFilterBtn ${squadPositionFilter === o.id ? 'selected' : ''}" data-pos="${o.id}">${o.label}</button>`).join('')}
      <button class="posFilterBtn ${squadPositionFilter === null ? 'selected' : ''}" data-pos="">${t('verTodosPostos')}</button>
    </div>
  ` : '';

  content.innerHTML = `
    <h1>${t('elencoTitle', {team: myTeam.name})}</h1>
    ${renderSquadFormationEditorHtml(state.myTeamId, myOptions, myTeam.color, xv)}
    <p class="muted">${t('explicacaoCategorias')}</p>
    <p class="muted">${t('explicacaoPrimeiraLinea')}</p>
    <p class="muted">${t('explicacaoCondicao')}</p>
    <div class="card">
      <div class="squadHeaderRow">
        <h3>${t('plantelCompleto', {n: rows.length})}</h3>
        <div class="sortToggle" id="squadSortToggle">
          <button class="sortBtn" data-sort="overall">${t('porOverall')}</button>
          <button class="sortBtn" data-sort="position">${t('porPosicao')}</button>
        </div>
      </div>
      ${posFilterHtml}
      <div class="tableScroll"><table class="squadTable"><thead>${headHtml}</thead>
      <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>
    </div>
    ${scoutingHtml}
    ${youthHtml}
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

  const posFilterToggle = document.getElementById('squadPosFilterToggle');
  if (posFilterToggle) {
    Array.from(posFilterToggle.children).forEach(btn => {
      btn.addEventListener('click', () => {
        squadPositionFilter = btn.dataset.pos || null;
        renderRealSquad();
      });
    });
  }

  Array.from(document.querySelectorAll('.squadRow')).forEach(tr => {
    tr.addEventListener('click', () => {
      const detail = tr.nextElementSibling;
      detail.classList.toggle('open');
      tr.classList.toggle('expanded');
    });
  });

  Array.from(document.querySelectorAll('[data-invite]')).forEach(btn => {
    btn.addEventListener('click', () => inviteProspect(btn.dataset.invite));
  });

  // Campo clicável da "Escalação atual" — mesma mecânica do editor de Dia de
  // Jogo, mas gravando direto no preset Time A (ver squadFormSlots).
  Array.from(document.querySelectorAll('.lineupShirtBtn')).forEach(btn => {
    btn.addEventListener('click', ev => {
      const idx = Number(btn.dataset.slot);
      if (squadFormSlot === idx) {
        squadFormSlot = null;
        squadFormAnchor = null;
      } else {
        squadFormSlot = idx;
        squadFormAnchor = {x: ev.clientX, y: ev.clientY};
      }
      lineupPickerExpanded = false;
      renderRealSquad();
    });
  });
  Array.from(document.querySelectorAll('.lineupPickBtn')).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = squadFormSlot;
      const newId = btn.dataset.pick;
      const currentSlots = [...squadFormSlots(state.myTeamId, xv)];
      const dupIdx = currentSlots.findIndex((pid, i) => pid === newId && i !== idx);
      if (dupIdx !== -1) currentSlots[dupIdx] = currentSlots[idx];
      currentSlots[idx] = newId;
      state.lineupPresets[state.myTeamId] = state.lineupPresets[state.myTeamId] || {};
      state.lineupPresets[state.myTeamId].A = currentSlots;
      squadFormSlot = null;
      squadFormAnchor = null;
      lineupPickerExpanded = false;
      saveState();
      renderRealSquad();
    });
  });
  const expandSquadFormBtn = document.getElementById('expandSquadFormPickerBtn');
  if (expandSquadFormBtn) {
    expandSquadFormBtn.addEventListener('click', () => {
      lineupPickerExpanded = !lineupPickerExpanded;
      renderRealSquad();
    });
  }
  const closeSquadFormBtn = document.getElementById('closeSquadFormPickerBtn');
  if (closeSquadFormBtn) {
    closeSquadFormBtn.addEventListener('click', () => {
      squadFormSlot = null;
      squadFormAnchor = null;
      lineupPickerExpanded = false;
      renderRealSquad();
    });
  }
  const squadFormBackdrop = document.getElementById('squadFormPickerBackdrop');
  if (squadFormBackdrop) {
    squadFormBackdrop.addEventListener('click', () => {
      squadFormSlot = null;
      squadFormAnchor = null;
      lineupPickerExpanded = false;
      renderRealSquad();
    });
  }
  const squadFormAutoBtn = document.getElementById('squadFormAutoBtn');
  if (squadFormAutoBtn) {
    squadFormAutoBtn.addEventListener('click', () => {
      state.lineupPresets[state.myTeamId] = state.lineupPresets[state.myTeamId] || {};
      state.lineupPresets[state.myTeamId].A = slotsFromXV(xv);
      squadFormSlot = null;
      squadFormAnchor = null;
      saveState();
      renderRealSquad();
    });
  }
}

// ---- Aba Treinamento: normal (foco por dia), grupos menores (line-out) e
// individual (DIP), tudo num só lugar em vez de espalhado no Elenco. ------
function renderDipListHtml() {
  const roster = getRealRoster(state.myTeamId);
  if (!roster) return '';
  const rows = roster
    .filter(p => !p.meta.injuryWeeks)
    .map(p => ({...p, condition: currentConditionOf(p)}))
    .sort((a, b) => ((b.meta.trainingAttendance && b.meta.trainingAttendance.individual) || 0) - ((a.meta.trainingAttendance && a.meta.trainingAttendance.individual) || 0));
  const posTarget = p => (state.positionTraining || {})[p.id];
  // Posições treináveis: qualquer uma menos a própria e as que já sabe jogar
  // (posto natural ou altPos já aprendido/curado) — inclusive primeira
  // línea (pilar/hooker), só que essa exige bem mais tempo de treino (ver
  // positionTrainingRoundsNeeded/FRONT_ROW_TRAINING_ROUNDS_NEEDED). Até
  // terminar o treino o jogador continua sem poder ser escalado ali (ver
  // FRONT_ROW_POS no seletor de escalação — sem improviso ANTES de
  // aprender de verdade).
  const trainablePositions = p => {
    const known = new Set([p.posId, ...(p.meta.altPos || [])]);
    return Object.keys(SKILL_PROFILES).filter(posId => !known.has(posId));
  };
  const rowHtml = p => {
    const days = trainingIntensityCap(p, p.condition, 'individual');
    const indAtt = (p.meta.trainingAttendance && p.meta.trainingAttendance.individual) || 0;
    const target = posTarget(p);
    const roundsNeeded = target ? positionTrainingRoundsNeeded(target) : POSITION_TRAINING_ROUNDS_NEEDED;
    const progress = Math.min(roundsNeeded, Math.floor((state.positionTrainingProgress || {})[p.id] || 0));
    const capOrProgress = target
      ? `<span class="muted dipListCap">${t('posTrainingProgress', {pos: POS_LABEL[target], current: progress, total: roundsNeeded})}</span>`
      : `<span class="muted dipListCap">${t('dipDaysCap', {days, max: MAX_INTENSIVE_DAYS_PER_WEEK})}</span>`;
    return `
      <div class="dipListRow">
        <span class="dipListName">${escapeHtmlAttr(p.name)}</span>
        <span class="muted dipListMeta" title="${escapeHtmlAttr(attendanceLabel('individual'))}">${ATTENDANCE_SHORT.individual} ${indAtt} · ${Math.round(p.condition)}%</span>
        <select class="dipSelect" data-player="${p.id}" ${target ? 'disabled' : ''}>
          <option value="">${t('noneClubTraining')}</option>
          ${SKILL_KEYS.map(k => `<option value="${k}" ${state.dipTraining[p.id] === k ? 'selected' : ''}>${skillLabel(k)}</option>`).join('')}
        </select>
        <select class="posTrainingSelect" data-player="${p.id}">
          <option value="">${t('posTrainingNone')}</option>
          ${trainablePositions(p).map(posId => `<option value="${posId}" ${target === posId ? 'selected' : ''}>${POS_LABEL[posId]}</option>`).join('')}
        </select>
        ${capOrProgress}
      </div>
    `;
  };
  return `
    <div class="card">
      <h3>${t('dipTitle')}</h3>
      <p class="muted">${t('dipHelp')}</p>
      <div class="dipList">${rows.map(rowHtml).join('')}</div>
    </div>
  `;
}

function renderTraining() {
  const myTeam = teamById[state.myTeamId];
  if (!getRealRoster(state.myTeamId)) {
    content.innerHTML = `
      <h1>${t('navTreino')} — ${myTeam.name}</h1>
      <p class="muted">${t('treinoIndisponivel')}</p>
    `;
    return;
  }
  content.innerHTML = `
    <h1>${t('navTreino')} — ${myTeam.name}</h1>
    <p class="muted">${t('explicacaoTreino')}</p>
    ${renderTrainingFocusHtml()}
    ${renderLineoutGroupHtml()}
    ${renderDipListHtml()}
  `;

  Array.from(document.querySelectorAll('.trainingFocusRadio')).forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.trainingFocus = state.trainingFocus || {seg: null, ter: null, qui: null};
      state.trainingFocus[radio.dataset.day] = radio.value || null;
      saveState();
      renderTraining();
    });
  });

  const emptyLineoutGroup = () => ({throwerIds: [], jumperIds: [], lifterIds: [], active: false});
  Array.from(document.querySelectorAll('.lineoutGroupCheck')).forEach(cb => {
    cb.addEventListener('change', () => {
      state.trainingGroups = state.trainingGroups || {lineout: emptyLineoutGroup()};
      state.trainingGroups.lineout = state.trainingGroups.lineout || emptyLineoutGroup();
      const role = cb.dataset.role;
      const arr = state.trainingGroups.lineout[role] || [];
      state.trainingGroups.lineout[role] = cb.checked
        ? [...arr, cb.value]
        : arr.filter(id => id !== cb.value);
      saveState();
      renderTraining();
    });
  });
  const lineoutActiveCb = document.getElementById('lineoutGroupActive');
  if (lineoutActiveCb) {
    lineoutActiveCb.addEventListener('change', () => {
      state.trainingGroups = state.trainingGroups || {lineout: emptyLineoutGroup()};
      state.trainingGroups.lineout = state.trainingGroups.lineout || emptyLineoutGroup();
      state.trainingGroups.lineout.active = lineoutActiveCb.checked;
      saveState();
      renderTraining();
    });
  }

  Array.from(document.querySelectorAll('.dipSelect')).forEach(sel => {
    sel.addEventListener('change', () => {
      const pid = sel.dataset.player;
      if (sel.value) state.dipTraining[pid] = sel.value;
      else delete state.dipTraining[pid];
      saveState();
    });
  });

  Array.from(document.querySelectorAll('.posTrainingSelect')).forEach(sel => {
    sel.addEventListener('change', () => {
      const pid = sel.dataset.player;
      state.positionTraining = state.positionTraining || {};
      state.positionTrainingProgress = state.positionTrainingProgress || {};
      if (sel.value) {
        // Treinar posição nova substitui o DIP normal — o jogador foca tudo
        // nas skills que definem a posição alvo (ver tickTraining), em vez
        // de escolher um atributo solto.
        state.positionTraining[pid] = sel.value;
        state.positionTrainingProgress[pid] = 0;
        delete state.dipTraining[pid];
      } else {
        delete state.positionTraining[pid];
        delete state.positionTrainingProgress[pid];
      }
      saveState();
      renderTraining();
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
      <td class="posCol">${p.position}${altPosHtml(p.meta)}</td>
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
const POS_GROUP = Object.fromEntries(POSITIONS.map(p => [p.id, p.group]));
const FRONT_ROW_POS = new Set(['PI', 'HK']);

// Verdadeiro se o jogador pode ocupar essa posição: a dele mesmo, ou uma
// posição alternativa listada em meta.altPos (jogadores que a observação de
// scout diz que "também jogam" ali).
function canPlay(p, posId) {
  return p.posId === posId || (p.meta.altPos && p.meta.altPos.includes(posId));
}

// Quantos especialistas aparecem por padrão no seletor de posição antes de
// precisar clicar em "ver mais" (ver renderDiaDeJogo/renderSquadFormation...).
const LINEUP_PICKER_MAX = 5;

// Lista completa (sem cortar em 5), ordenada do melhor pro pior overall
// efetivo naquela posição — usada em "outras posições", que deve mostrar TODO
// o elenco disponível pra improviso (exceto primeira línea, que não aceita
// improviso, ver FRONT_ROW_POS).
function sortCandidates(list, posId) {
  return [...list].sort((a, b) => effectiveOverallAt(b, posId) - effectiveOverallAt(a, posId));
}

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
    // Estampa o posto/rótulo/grupo de acordo com ONDE ele foi escalado (pode
    // ser diferente do posto natural dele, via posição alternativa ou
    // escolha livre do manager) — mesmo ajuste feito em pickStartingXV, pro
    // motor e pra quadra ficarem consistentes com a escalação manual.
    return {...player, posId: slot.id, position: POS_LABEL[slot.id], group: slot.group, number: idx + 1};
  });
  if (xv.some(p => !p)) return null;
  return xv;
}

// Reservas escaladas manualmente pra hoje (até MAX_BENCH, regra real do
// rugby) — sem isso, "banco" era simplesmente todo o elenco elegível que não
// estava no XV (podiam ser dezenas de jogadores, e o manager não escolhia
// quem entre eles realmente viaja pra partida).
const MAX_BENCH = 8;

// Preenche o banco automaticamente: garante primeiro cobertura de primeira
// línea (2 pilares + 1 hooker, se houver disponível — scrum não aceita
// improviso nessas posições, ver FRONT_ROW_POS/canPlay) e só depois completa
// o resto dos slots pelos melhores overalls disponíveis, de qualquer posto.
// Sem isso, um preenchimento puramente por overall podia deixar o time sem
// NENHUM pilar/hooker reserva — bench de puros backs "melhor avaliados".
function autoBenchSlots(teamId, myOptions, xvIds) {
  const eligible = manualEligiblePlayers(teamId, myOptions).filter(p => !xvIds.has(p.id));
  const pickedIds = new Set();
  const picked = [];
  const pickBest = pool => {
    const candidate = pool.filter(p => !pickedIds.has(p.id)).sort((a, b) => b.rating - a.rating)[0];
    if (candidate) { picked.push(candidate); pickedIds.add(candidate.id); }
  };
  pickBest(eligible.filter(p => p.posId === 'PI'));
  pickBest(eligible.filter(p => p.posId === 'PI'));
  pickBest(eligible.filter(p => p.posId === 'HK'));
  for (const p of [...eligible].sort((a, b) => b.rating - a.rating)) {
    if (picked.length >= MAX_BENCH) break;
    if (!pickedIds.has(p.id)) { picked.push(p); pickedIds.add(p.id); }
  }
  return picked.slice(0, MAX_BENCH).map(p => p.id);
}

// Resolve os jogadores reais a partir de manualBenchSlots — diferente do XV,
// o banco não tem posição fixa por slot, então não precisa reprocessar
// posId/group, só filtra quem ainda é válido (saiu do elenco, foi lesionado
// etc. viram null e o slot fica vazio).
function resolveManualBench(teamId, myOptions) {
  if (!manualBenchSlots) return null;
  const eligible = manualEligiblePlayers(teamId, myOptions);
  const byId = Object.fromEntries(eligible.map(p => [p.id, p]));
  return manualBenchSlots.map(pid => (pid && byId[pid]) || null).filter(Boolean);
}

function matchSignature(key, c, match) {
  return `${key}|${c.stage}|${c.currentRoundIndex}|${match.home}|${match.away}`;
}

function shortPlayerName(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

// Editor de escalação clicável: um mapa do campo (mesmo layout visual da
// formação estática) onde cada camisa é um botão. Clicar numa camisa abre,
// logo abaixo, a lista de jogadores elegíveis pra aquela posição — primeira
// línea (pilar/hooker) só mostra especialistas daquele posto específico (sem
// improviso); as demais posições mostram primeiro quem joga ali (posto
// natural ou alternativo) e, em seguida, todo o resto do elenco disponível.
function renderLineupEditorHtml(teamId, myOptions, teamColor) {
  const eligible = manualEligiblePlayers(teamId, myOptions);
  const byId = Object.fromEntries(eligible.map(p => [p.id, p]));
  // IDs titulares recalculados a partir da escalação manual ATUAL (não da
  // automática) — senão quem acabou de ser trocado pra dentro/fora do
  // titular continuava (ou sumia) errado do seletor de reserva embaixo.
  const startingIds = new Set((manualSlots || []).filter(Boolean));
  const benchIds = new Set((manualBenchSlots || []).filter(Boolean));
  const benchPlayers = (manualBenchSlots || []).map(pid => (pid && byId[pid]) || null);

  const shirts = POSITIONS.map((slot, idx) => {
    const posId = slot.id;
    const currentId = manualSlots ? manualSlots[idx] : null;
    const player = currentId ? byId[currentId] : null;
    const pos = FORMATION_POSITIONS[idx + 1] || {top: '50%', left: '50%'};
    const cond = player ? Math.round(player.condition) : 100;
    const label = player ? shortPlayerName(player.name) : '🆘';
    const openClass = openLineupSlot === idx ? ' slotOpen' : '';
    const titleAttr = `#${idx + 1} ${POS_LABEL[posId]}${player ? ' — ' + player.name : ''}`;
    return `
      <button type="button" class="shirtSlot lineupShirtBtn${openClass}" data-slot="${idx}" data-filled="${player ? '1' : '0'}" style="top:${pos.top}; left:${pos.left};" data-tip="${escapeHtmlAttr(titleAttr)}">
        <span class="shirt" style="background:${teamColor}">${idx + 1}</span>
        <span class="shirtName">${escapeHtmlAttr(label)}</span>
        <span class="ratingBar shirtCond"><span style="width:${cond}%"></span></span>
      </button>
    `;
  }).join('');

  let pickerHtml = '';
  if (openLineupSlot != null) {
    const idx = openLineupSlot;
    const slot = POSITIONS[idx];
    const posId = slot.id;
    const currentId = manualSlots ? manualSlots[idx] : null;
    const allSpecialists = sortCandidates(eligible.filter(p => canPlay(p, posId)), posId);
    const specialists = lineupPickerExpanded ? allSpecialists : allSpecialists.slice(0, LINEUP_PICKER_MAX);
    const hasMoreSpecialists = allSpecialists.length > LINEUP_PICKER_MAX;
    const outros = FRONT_ROW_POS.has(posId) ? [] : sortCandidates(eligible.filter(p => !canPlay(p, posId)), posId);
    const playerRow = p => `
      <button type="button" class="lineupPickBtn ${p.id === currentId ? 'selected' : ''}" data-pick="${p.id}">
        <span>${escapeHtmlAttr(p.name)}${p.posId !== posId ? ' ⇄' : ''}</span>
        <span class="muted">${effectiveOverallAt(p, posId)} · ${Math.round(p.condition)}%</span>
      </button>
    `;
    const popupW = Math.min(300, window.innerWidth - 24);
    const popupMaxH = Math.min(420, window.innerHeight - 24);
    const anchor = lineupPickerAnchor || {x: window.innerWidth / 2, y: window.innerHeight / 2};
    let left = anchor.x + 14;
    let top = anchor.y + 14;
    if (left + popupW > window.innerWidth - 12) left = anchor.x - popupW - 14;
    left = Math.max(12, Math.min(left, window.innerWidth - popupW - 12));
    if (top + popupMaxH > window.innerHeight - 12) top = window.innerHeight - popupMaxH - 12;
    top = Math.max(12, top);

    pickerHtml = `
      <div class="lineupPicker lineupPickerFloating" style="left:${left}px; top:${top}px; width:${popupW}px; max-height:${popupMaxH}px;">
        <h4>#${idx + 1} ${POS_LABEL[posId]}</h4>
        ${!specialists.length ? `<p class="muted">${t('convocacaoEmergencia')}</p>` : `
          <div class="lineupPickGroupLabel">${t('especialistas')}</div>
          <div class="lineupPickList">${specialists.map(playerRow).join('')}</div>
          ${hasMoreSpecialists ? `<button type="button" class="ctrlBtn" id="expandLineupPickerBtn">${lineupPickerExpanded ? t('verMenos') : `${t('verMais')} (+${allSpecialists.length - LINEUP_PICKER_MAX})`}</button>` : ''}
        `}
        ${outros.length ? `
          <div class="lineupPickGroupLabel">${t('outrasPosicoes')}</div>
          <div class="lineupPickList">${outros.map(playerRow).join('')}</div>
        ` : ''}
        <button type="button" class="ctrlBtn" id="closeLineupPickerBtn">${t('fecharSeletor')}</button>
      </div>
    `;
  }

  return `
    <div class="card formationCard">
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
      <div class="pitchOuter">
        <div class="pitchLine" style="top:0"></div>
        <div class="pitchLine" style="top:22%"></div>
        <div class="pitchLine solid" style="top:50%"></div>
        <div class="pitchLine" style="top:78%"></div>
        <div class="pitchLine" style="top:100%"></div>
        ${shirts}
      </div>
      ${openLineupSlot != null ? '<div class="lineupPickerBackdrop" id="lineupPickerBackdrop"></div>' : ''}
      ${pickerHtml}
      ${renderBenchEditorHtml(benchPlayers, eligible, startingIds, benchIds, teamColor)}
    </div>
  `;
}

// Banco clicável (mesma mecânica de clique+popup do XV, mas sem posição fixa
// por slot): até MAX_BENCH botões, cada um abre o seletor de quem entra
// naquele lugar do banco — em vez do banco ser "todo mundo que não é
// titular" (podiam ser dezenas de reservas), agora é uma lista fechada que o
// manager escolhe, igual escalação real de 23.
function renderBenchEditorHtml(benchPlayers, eligible, startingIds, benchIds, teamColor) {
  const slots = Array.from({length: MAX_BENCH}, (_, i) => benchPlayers[i] || null);
  const cards = slots.map((p, idx) => {
    const openClass = openBenchSlot === idx ? ' slotOpen' : '';
    const label = p ? shortPlayerName(p.name) : '+';
    const cond = p ? Math.round(p.condition) : 100;
    const titleAttr = p ? `${p.name} — ${p.position}` : t('escolherReserva');
    return `
      <button type="button" class="benchCard benchEditBtn${openClass}" data-benchslot="${idx}" data-filled="${p ? '1' : '0'}" data-tip="${escapeHtmlAttr(titleAttr)}">
        <div class="benchShirt" style="background:${teamColor}">${p ? p.posId : '+'}</div>
        <div class="benchName">${escapeHtmlAttr(label)}</div>
        ${p ? `<span class="ratingBar shirtCond"><span style="width:${cond}%"></span></span>` : ''}
      </button>
    `;
  }).join('');

  let pickerHtml = '';
  if (openBenchSlot != null) {
    const idx = openBenchSlot;
    const current = slots[idx];
    const options = eligible
      .filter(p => !startingIds.has(p.id) && (!benchIds.has(p.id) || (current && p.id === current.id)))
      .sort((a, b) => b.rating - a.rating);
    const playerRow = p => `
      <button type="button" class="lineupPickBtn ${current && p.id === current.id ? 'selected' : ''}" data-benchpick="${p.id}">
        <span>${escapeHtmlAttr(p.name)}</span>
        <span class="muted">${p.position} · ${p.rating} · ${Math.round(p.condition)}%</span>
      </button>
    `;
    const popupW = Math.min(300, window.innerWidth - 24);
    const popupMaxH = Math.min(420, window.innerHeight - 24);
    const anchor = benchPickerAnchor || {x: window.innerWidth / 2, y: window.innerHeight / 2};
    let left = anchor.x + 14;
    let top = anchor.y + 14;
    if (left + popupW > window.innerWidth - 12) left = anchor.x - popupW - 14;
    left = Math.max(12, Math.min(left, window.innerWidth - popupW - 12));
    if (top + popupMaxH > window.innerHeight - 12) top = window.innerHeight - popupMaxH - 12;
    top = Math.max(12, top);

    pickerHtml = `
      <div class="lineupPicker lineupPickerFloating" style="left:${left}px; top:${top}px; width:${popupW}px; max-height:${popupMaxH}px;">
        <h4>${t('reserva')} ${idx + 1}</h4>
        ${current ? `<button type="button" class="lineupPickBtn" data-benchpick="">${t('removerReserva')}</button>` : ''}
        ${!options.length ? `<p class="muted">${t('subsBankEmpty')}</p>` : `<div class="lineupPickList">${options.map(playerRow).join('')}</div>`}
        <button type="button" class="ctrlBtn" id="closeBenchPickerBtn">${t('fecharSeletor')}</button>
      </div>
    `;
  }

  return `
    <div class="benchSection">
      <div class="benchTitle">${t('reservas')}</div>
      <div class="benchRow">${cards}</div>
      ${openBenchSlot != null ? '<div class="lineupPickerBackdrop" id="benchPickerBackdrop"></div>' : ''}
      ${pickerHtml}
    </div>
  `;
}

// Lineup ativo da tela de Plantel: usa o preset Time A se já existir, senão
// cai pra escalação automática (mesma regra do editor de Dia de Jogo).
function squadFormSlots(teamId, autoXV) {
  const preset = state.lineupPresets[teamId] && state.lineupPresets[teamId].A;
  return preset || slotsFromXV(autoXV);
}

// Campo clicável igual ao de Dia de Jogo, só que na tela de Plantel — edita
// direto o preset Time A, sem precisar entrar numa partida específica pra
// mexer na escalação preferida do time.
function renderSquadFormationEditorHtml(teamId, myOptions, teamColor, autoXV) {
  const eligible = manualEligiblePlayers(teamId, myOptions);
  const byId = Object.fromEntries(eligible.map(p => [p.id, p]));
  const slots = squadFormSlots(teamId, autoXV);
  // Reservas recalculadas a partir da escalação ATUAL (não da automática) —
  // mesma correção aplicada ao editor de Dia de Jogo.
  const startingIds = new Set(slots.filter(Boolean));
  const bench = eligible.filter(p => !startingIds.has(p.id)).sort((a, b) => b.rating - a.rating);

  const shirts = POSITIONS.map((slot, idx) => {
    const posId = slot.id;
    const currentId = slots[idx];
    const player = currentId ? byId[currentId] : null;
    const pos = FORMATION_POSITIONS[idx + 1] || {top: '50%', left: '50%'};
    const cond = player ? Math.round(player.condition) : 100;
    const label = player ? shortPlayerName(player.name) : '🆘';
    const openClass = squadFormSlot === idx ? ' slotOpen' : '';
    const titleAttr = `#${idx + 1} ${POS_LABEL[posId]}${player ? ' — ' + player.name : ''}`;
    return `
      <button type="button" class="shirtSlot lineupShirtBtn${openClass}" data-slot="${idx}" style="top:${pos.top}; left:${pos.left};" data-tip="${escapeHtmlAttr(titleAttr)}">
        <span class="shirt" style="background:${teamColor}">${idx + 1}</span>
        <span class="shirtName">${escapeHtmlAttr(label)}</span>
        <span class="ratingBar shirtCond"><span style="width:${cond}%"></span></span>
      </button>
    `;
  }).join('');

  let pickerHtml = '';
  if (squadFormSlot != null) {
    const idx = squadFormSlot;
    const slot = POSITIONS[idx];
    const posId = slot.id;
    const currentId = slots[idx];
    const allSpecialists = sortCandidates(eligible.filter(p => canPlay(p, posId)), posId);
    const specialists = lineupPickerExpanded ? allSpecialists : allSpecialists.slice(0, LINEUP_PICKER_MAX);
    const hasMoreSpecialists = allSpecialists.length > LINEUP_PICKER_MAX;
    const outros = FRONT_ROW_POS.has(posId) ? [] : sortCandidates(eligible.filter(p => !canPlay(p, posId)), posId);
    const playerRow = p => `
      <button type="button" class="lineupPickBtn ${p.id === currentId ? 'selected' : ''}" data-pick="${p.id}">
        <span>${escapeHtmlAttr(p.name)}${p.posId !== posId ? ' ⇄' : ''}</span>
        <span class="muted">${effectiveOverallAt(p, posId)} · ${Math.round(p.condition)}%</span>
      </button>
    `;
    const popupW = Math.min(300, window.innerWidth - 24);
    const popupMaxH = Math.min(420, window.innerHeight - 24);
    const anchor = squadFormAnchor || {x: window.innerWidth / 2, y: window.innerHeight / 2};
    let left = anchor.x + 14;
    let top = anchor.y + 14;
    if (left + popupW > window.innerWidth - 12) left = anchor.x - popupW - 14;
    left = Math.max(12, Math.min(left, window.innerWidth - popupW - 12));
    if (top + popupMaxH > window.innerHeight - 12) top = window.innerHeight - popupMaxH - 12;
    top = Math.max(12, top);

    pickerHtml = `
      <div class="lineupPicker lineupPickerFloating" style="left:${left}px; top:${top}px; width:${popupW}px; max-height:${popupMaxH}px;">
        <h4>#${idx + 1} ${POS_LABEL[posId]}</h4>
        ${!specialists.length ? `<p class="muted">${t('convocacaoEmergencia')}</p>` : `
          <div class="lineupPickGroupLabel">${t('especialistas')}</div>
          <div class="lineupPickList">${specialists.map(playerRow).join('')}</div>
          ${hasMoreSpecialists ? `<button type="button" class="ctrlBtn" id="expandSquadFormPickerBtn">${lineupPickerExpanded ? t('verMenos') : `${t('verMais')} (+${allSpecialists.length - LINEUP_PICKER_MAX})`}</button>` : ''}
        `}
        ${outros.length ? `
          <div class="lineupPickGroupLabel">${t('outrasPosicoes')}</div>
          <div class="lineupPickList">${outros.map(playerRow).join('')}</div>
        ` : ''}
        <button type="button" class="ctrlBtn" id="closeSquadFormPickerBtn">${t('fecharSeletor')}</button>
      </div>
    `;
  }

  return `
    <div class="card formationCard">
      <div class="squadHeaderRow">
        <h3>${t('escalacaoAtual')}</h3>
        <div class="sortToggle">
          <button class="sortBtn" id="squadFormAutoBtn">${t('autoPreencher')}</button>
        </div>
      </div>
      <div class="pitchOuter">
        <div class="pitchLine" style="top:0"></div>
        <div class="pitchLine" style="top:22%"></div>
        <div class="pitchLine solid" style="top:50%"></div>
        <div class="pitchLine" style="top:78%"></div>
        <div class="pitchLine" style="top:100%"></div>
        ${shirts}
      </div>
      ${squadFormSlot != null ? '<div class="lineupPickerBackdrop" id="squadFormPickerBackdrop"></div>' : ''}
      ${pickerHtml}
      ${renderBenchSectionHtml(bench, teamColor)}
    </div>
  `;
}

// ---- Tela de Tática: plano de jogo por zona + upload de PDFs -------------
function escapeHtmlAttr(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

const ZONE_COLORS = {red: '#c0392b', orange: '#d68a2c', green: '#1f7a43', yellow: '#c9a227'};
const ZONE_LABEL_KEY = {red: 'zonaVermelha', orange: 'zonaLaranja', green: 'zonaVerde', yellow: 'zonaDourada'};
const ZONE_STYLE_LABEL_KEY = {chute: 'estiloChute', equilibrado: 'estiloEquilibrado', forwards: 'estiloForwards'};
// Altura de cada zona na imagem do campo, proporcional aos metros reais
// (0-22/22-40/40-80/80-Ingoal, ver zoneForPos em engine.js) — soma 100%.
const ZONE_HEIGHT_PCT = {red: 22, orange: 18, green: 40, yellow: 20};
const POD_FORMATION_KEYS = Object.keys(POD_FORMATIONS);
const podDescKey = pods => 'podDesc_' + pods.replace(/-/g, '');

function ensureGamePlan() {
  if (!state.gamePlan) state.gamePlan = defaultGamePlan();
  if (!state.gamePlan.system) state.gamePlan.system = 'ninguno';
  if (state.gamePlan.pillars.defesa == null) state.gamePlan.pillars.defesa = 50;
  // Saves antigos não tinham formação de pods por zona — cai pro formato
  // neutro (3-3-2) em vez de quebrar (ver POD_FORMATIONS em engine.js).
  ZONE_KEYS.forEach(z => {
    if (!state.gamePlan.zones[z].pods) state.gamePlan.zones[z].pods = '3-3-2';
  });
  if (!state.gamePlanPdfs) state.gamePlanPdfs = [];
  return state.gamePlan;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Editor da zona clicada no campo tático: estilo de jogo, formação de pods
// dos forwards e código de comunicação — mesmos três campos de antes, só que
// agora abrem sob demanda embaixo da faixa colorida em vez de ficarem todos
// visíveis o tempo todo num grid de cards.
function renderTacticZoneEditorHtml(zoneKey, plan) {
  const zone = plan.zones[zoneKey];
  return `
    <div class="tacticZoneEditor" style="border-top: 3px solid ${ZONE_COLORS[zoneKey]}">
      <h4>${t(ZONE_LABEL_KEY[zoneKey])}</h4>
      <label class="zoneFieldLabel">${t('estiloDeJogo')}</label>
      <select class="zoneStyleSelect" data-zone="${zoneKey}">
        ${Object.keys(ZONE_STYLES).map(s => `<option value="${s}" ${zone.style === s ? 'selected' : ''}>${t(ZONE_STYLE_LABEL_KEY[s])}</option>`).join('')}
      </select>
      <label class="zoneFieldLabel">${t('podFormacaoLabel')}</label>
      <select class="zonePodsSelect" data-zone="${zoneKey}">
        ${POD_FORMATION_KEYS.map(p => `<option value="${p}" ${zone.pods === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
      <p class="muted podDescText">${t(podDescKey(zone.pods))}</p>
      <label class="zoneFieldLabel">${t('codigoComunicacao')}</label>
      <input type="text" class="zoneCodeInput" list="playCodesList" data-zone="${zoneKey}" maxlength="24" value="${escapeHtmlAttr(zone.code)}" placeholder="${t('codigoPlaceholder')}" />
      <datalist id="playCodesList">
        ${PLAY_CODES.map(c => `<option value="${c}"></option>`).join('')}
      </datalist>
      <button type="button" class="ctrlBtn" id="closeTacticZoneBtn">${t('fecharSeletor')}</button>
    </div>
  `;
}

function renderTactics() {
  const plan = ensureGamePlan();
  const myTeam = teamById[state.myTeamId];
  const isCurda = state.myTeamId === 'ARG-CUR' || state.myTeamId === 'PAR-CUR';

  content.innerHTML = `
    <h1>${t('taticaTitle', {team: myTeam.name})}</h1>
    <p class="muted">${t('taticaHelp')}</p>
    <div class="card">
      <h3>${t('sistemaTitle')}</h3>
      <p class="muted">${t('sistemaHelp')}</p>
      <select class="systemSelect" id="systemSelect">
        ${Object.keys(PLAY_SYSTEMS).map(s => `<option value="${s}" ${plan.system === s ? 'selected' : ''}>${t('sistema_' + s)}</option>`).join('')}
      </select>
      ${plan.system !== 'ninguno' ? `<p class="muted systemFormation">${t('formacaoApoio', {f: PLAY_SYSTEMS[plan.system].formation})}</p>` : ''}
    </div>
    <div class="card">
      <h3>${t('zonasCampoTitle')}</h3>
      <div class="tacticalFieldOuter">
        ${ZONE_KEYS.slice().reverse().map(z => `
          <button type="button" class="tacticZoneBand${openTacticZone === z ? ' zoneOpen' : ''}" data-zone="${z}" style="height:${ZONE_HEIGHT_PCT[z]}%; background:${ZONE_COLORS[z]}66;">
            <div class="tacticZoneLabel">${t(ZONE_LABEL_KEY[z])}</div>
            <div class="tacticZoneInfo">${t(ZONE_STYLE_LABEL_KEY[plan.zones[z].style])} · ${plan.zones[z].pods}${plan.zones[z].code ? ` · "${escapeHtmlAttr(plan.zones[z].code)}"` : ''}</div>
          </button>
        `).join('')}
      </div>
      ${openTacticZone ? renderTacticZoneEditorHtml(openTacticZone, plan) : ''}
    </div>
    <div class="card">
      <h3>${t('pilaresTitle')}</h3>
      <p class="muted">${t('pilaresHelp')}</p>
      ${['disciplina', 'posse', 'fisicalidade', 'defesa'].map(p => `
        <div class="pillarRow">
          <label>${t('pilar_' + p)} <span class="pillarVal" data-pillar-val="${p}">${plan.pillars[p]}</span></label>
          <input type="range" min="0" max="100" step="5" class="pillarSlider" data-pillar="${p}" value="${plan.pillars[p]}" />
        </div>
      `).join('')}
      <div class="tacticaBtnRow">
        <button class="ctrlBtn" id="resetGamePlanBtn">${t('resetarPlano')}</button>
        ${isCurda ? `<button class="ctrlBtn" id="loadCurdaPlanBtn">${t('carregarPlanoCurda')}</button>` : ''}
      </div>
    </div>
    <div class="card">
      <h3>${t('pdfUploadTitle')}</h3>
      <p class="muted">${t('pdfUploadHelp')}</p>
      <input type="file" id="pdfUploadInput" accept="application/pdf" />
      <div id="pdfListWrap" class="pdfList">
        ${state.gamePlanPdfs.length === 0 ? `<p class="muted">${t('pdfListaVazia')}</p>` : state.gamePlanPdfs.map(p => `
          <div class="pdfRow" data-pdf-id="${p.id}">
            <span class="pdfName">📄 ${escapeHtmlAttr(p.name)}</span>
            <span class="muted">${formatFileSize(p.size)}</span>
            <button class="ctrlBtn pdfViewBtn" data-id="${p.id}">${t('verPdf')}</button>
            <button class="ctrlBtn pdfDeleteBtn" data-id="${p.id}">${t('removerPdf')}</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('systemSelect').addEventListener('change', e => {
    ensureGamePlan().system = e.target.value;
    saveState();
    renderTactics();
  });
  Array.from(document.querySelectorAll('.tacticZoneBand')).forEach(btn => {
    btn.addEventListener('click', () => {
      const z = btn.dataset.zone;
      openTacticZone = openTacticZone === z ? null : z;
      renderTactics();
    });
  });
  Array.from(document.querySelectorAll('.zoneStyleSelect')).forEach(sel => {
    sel.addEventListener('change', () => {
      ensureGamePlan().zones[sel.dataset.zone].style = sel.value;
      saveState();
      renderTactics();
    });
  });
  Array.from(document.querySelectorAll('.zonePodsSelect')).forEach(sel => {
    sel.addEventListener('change', () => {
      ensureGamePlan().zones[sel.dataset.zone].pods = sel.value;
      saveState();
      renderTactics();
    });
  });
  Array.from(document.querySelectorAll('.zoneCodeInput')).forEach(inp => {
    inp.addEventListener('input', () => {
      ensureGamePlan().zones[inp.dataset.zone].code = inp.value;
      saveState();
    });
    inp.addEventListener('blur', () => renderTactics());
  });
  const closeTacticZoneBtn = document.getElementById('closeTacticZoneBtn');
  if (closeTacticZoneBtn) {
    closeTacticZoneBtn.addEventListener('click', () => {
      openTacticZone = null;
      renderTactics();
    });
  }
  Array.from(document.querySelectorAll('.pillarSlider')).forEach(sl => {
    sl.addEventListener('input', () => {
      ensureGamePlan().pillars[sl.dataset.pillar] = Number(sl.value);
      document.querySelector(`.pillarVal[data-pillar-val="${sl.dataset.pillar}"]`).textContent = sl.value;
      saveState();
    });
  });
  document.getElementById('resetGamePlanBtn').addEventListener('click', () => {
    state.gamePlan = defaultGamePlan();
    openTacticZone = null;
    saveState();
    renderTactics();
  });
  const loadCurdaBtn = document.getElementById('loadCurdaPlanBtn');
  if (loadCurdaBtn) {
    loadCurdaBtn.addEventListener('click', () => {
      state.gamePlan = curdaDefaultGamePlan();
      openTacticZone = null;
      saveState();
      renderTactics();
    });
  }

  document.getElementById('pdfUploadInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert(t('pdfTipoInvalido')); return; }
    const id = `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await savePdfBlob(id, file);
      state.gamePlanPdfs = state.gamePlanPdfs || [];
      state.gamePlanPdfs.push({id, name: file.name, size: file.size, uploadedAt: Date.now()});
      saveState();
      renderTactics();
    } catch (err) {
      alert(t('pdfErroSalvar'));
    }
  });

  Array.from(document.querySelectorAll('.pdfViewBtn')).forEach(btn => {
    btn.addEventListener('click', async () => {
      const blob = await loadPdfBlob(btn.dataset.id);
      if (!blob) { alert(t('pdfNaoEncontrado')); return; }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  });
  Array.from(document.querySelectorAll('.pdfDeleteBtn')).forEach(btn => {
    btn.addEventListener('click', async () => {
      await deletePdfBlob(btn.dataset.id);
      state.gamePlanPdfs = state.gamePlanPdfs.filter(p => p.id !== btn.dataset.id);
      saveState();
      renderTactics();
    });
  });
}

// ---- Tela de Seleção: elenco do Paraguay + ARC/amistosos, tudo automático -
// O usuário administra o Curda, não a Seleção: essa tela é só consulta (ver
// renderSelection) — os compromissos da Seleção acontecem sozinhos a cada
// rodada avançada pelo clube (ver tickSelecaoAuto, chamado em finalizeRound).
// Começa o Américas Rugby Championship: turno único (3 rodadas) entre as 4
// seleções do ARC_TEAMS. generateFixture devolve turno+returno (ida e volta);
// o torneio real é só "todos contra todos" uma vez, então usa só a primeira
// metade (as primeiras n-1 rodadas) — mesmo ajuste feito pras chaves
// Ouro/Descenso do torneio paraguaio (ver startSuperGroupsFromLeague).
function startArc() {
  const ids = ARC_TEAMS.map(t => t.id);
  state.arc = {
    fixture: generateFixture(ids).slice(0, ids.length - 1),
    standings: initialStandings(ids),
    currentRoundIndex: 0,
    finished: false,
  };
  saveState();
}

// Confronto entre duas seleções que NÃO a do Paraguay, resolvido inteiramente
// em segundo plano (sem animação) — nenhuma partida da Seleção é jogada pelo
// usuário, ver autoPlayArcRound/finishArcRound.
function simulateArcMatch(homeId, awayId) {
  const home = teamById[homeId];
  const away = teamById[awayId];
  const r = simulateMatch(home, generateSquad(home), 'equilibrado', away, generateSquad(away), 'equilibrado', undefined, undefined, undefined, {
    neutralVenue: true,
    weather: rollWeather(),
  });
  return {scoreHome: r.scoreA, scoreAway: r.scoreB};
}

// Fecha a rodada atual do ARC: aplica o resultado (já jogado ao vivo) da
// partida do Paraguay, resolve em segundo plano o outro confronto da rodada,
// atualiza a tabela e avança pra próxima rodada (ou marca o torneio
// encerrado, liberando os convocados de volta pros clubes — ver
// arcCalledUpIds).
function finishArcRound(scorePY, scoreOpp) {
  const arc = state.arc;
  const round = arc.fixture[arc.currentRoundIndex];
  round.matches.forEach(m => {
    if (m.home === PARAGUAY_TEAM.id || m.away === PARAGUAY_TEAM.id) {
      const homeIsPY = m.home === PARAGUAY_TEAM.id;
      m.scoreHome = homeIsPY ? scorePY : scoreOpp;
      m.scoreAway = homeIsPY ? scoreOpp : scorePY;
    } else {
      const r = simulateArcMatch(m.home, m.away);
      m.scoreHome = r.scoreHome;
      m.scoreAway = r.scoreAway;
    }
    m.played = true;
    applyResult(arc.standings, m.home, m.away, m.scoreHome, m.scoreAway);
  });
  arc.currentRoundIndex++;
  if (arc.currentRoundIndex >= arc.fixture.length) arc.finished = true;
  saveState();
}

function arcChampionName() {
  if (!state.arc || !state.arc.finished) return '';
  const ranked = sortedStandings(state.arc.standings);
  return teamById[ranked[0].teamId].name;
}

// Resolve a rodada atual do ARC inteiramente em segundo plano (sem partida ao
// vivo) — a Seleção não é administrável pelo usuário, então nem a partida do
// Paraguay tem animação: o resultado só aparece pronto na tabela do ARC.
function autoPlayArcRound() {
  const arc = state.arc;
  const round = arc.fixture[arc.currentRoundIndex];
  const pyMatch = round.matches.find(m => m.home === PARAGUAY_TEAM.id || m.away === PARAGUAY_TEAM.id);
  const homeIsPY = pyMatch.home === PARAGUAY_TEAM.id;
  const r = simulateArcMatch(pyMatch.home, pyMatch.away);
  const scorePY = homeIsPY ? r.scoreHome : r.scoreAway;
  const scoreOpp = homeIsPY ? r.scoreAway : r.scoreHome;
  finishArcRound(scorePY, scoreOpp);
}

// Amistoso avulso da Seleção fora da janela do ARC, também resolvido em
// segundo plano — só entra no histórico (ver renderSelection).
function autoPlaySelecaoFriendly() {
  const opponent = NATIONAL_TEAMS[Math.floor(Math.random() * NATIONAL_TEAMS.length)];
  const {xv: paraguaySquad} = getParaguaySquad();
  const r = simulateMatch(PARAGUAY_TEAM, paraguaySquad, 'equilibrado', opponent, generateSquad(opponent), 'equilibrado', undefined, undefined, undefined, {
    neutralVenue: true,
    weather: rollWeather(),
  });
  state.nationalTeamMatches = state.nationalTeamMatches || [];
  state.nationalTeamMatches.push({
    opponent: opponent.name,
    scorePY: r.scoreA,
    scoreOpp: r.scoreB,
    label: t('selecaoAmistosoLabel'),
  });
}

// Avança os compromissos da Seleção Paraguay sozinha, no mesmo passo semanal
// que já mexe treino/lesão/scouting do clube (ver finalizeRound) — o usuário
// nunca joga/controla a Seleção, só vê o resultado depois (ver renderSelection).
// state.arcAutoNextDay guarda o próximo "dia do calendário" (currentCalendarDay)
// em que algo deve acontecer sozinho: começar o ARC, jogar a próxima rodada,
// ou (com o ARC encerrado) rolar mais um amistoso avulso.
function tickSelecaoAuto() {
  const day = state.calendarDay;
  if (state.arcAutoNextDay == null) state.arcAutoNextDay = day + 21;
  if (day < state.arcAutoNextDay) return;

  if (!state.arc) {
    startArc();
    state.arcAutoNextDay = day + 14;
  } else if (!state.arc.finished) {
    autoPlayArcRound();
    state.arcAutoNextDay = day + 14;
  } else {
    autoPlaySelecaoFriendly();
    state.arcAutoNextDay = day + 21 + Math.floor(Math.random() * 21);
  }
  saveState();
}

function renderSelection() {
  state.nationalTeamMatches = state.nationalTeamMatches || [];
  const {xv, bench} = getParaguaySquad();
  const history = state.nationalTeamMatches.slice().reverse().slice(0, 12);
  const arc = state.arc;

  const rosterRows = [
    ...xv.map(p => ({...p, status: 'titular'})),
    ...bench,
  ];

  const selecaoStaff = getStaff(PARAGUAY_TEAM.id);
  const selecaoStaffHtml = selecaoStaff ? `
    <div class="card">
      <h3>${t('comissaoTecnica')}</h3>
      <table>
        <tbody>
          ${selecaoStaff.map(s => `<tr><td class="teamCol">${s.role}</td><td class="teamCol"><b>${escapeHtmlAttr(s.name)}</b>${s.note ? ` <span class="muted">— ${escapeHtmlAttr(s.note)}</span>` : ''}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const arcSectionHtml = `
    <div class="card">
      <h3>${t('arcTitle')}</h3>
      ${!arc ? `
        <p class="muted">${t('arcIntro')}</p>
      ` : `
        <div class="tableScroll">${renderTableHtml(sortedStandings(arc.standings), PARAGUAY_TEAM.id)}</div>
        <div id="arcFixtureList"></div>
        ${arc.finished
          ? `<p class="muted">🏆 ${t('arcCampeao', {champion: escapeHtmlAttr(arcChampionName())})}</p>`
          : `<p class="muted">${t('arcProximaRodada', {n: arc.currentRoundIndex + 1})}</p>`}
      `}
    </div>
  `;

  content.innerHTML = `
    <h1>${t('selecaoTitle')}</h1>
    ${arcSectionHtml}
    ${renderFormationHtml(xv, bench, PARAGUAY_TEAM.color, t('selecaoEscalacao'))}
    ${selecaoStaffHtml}
    <div class="card">
      <h3>${t('selecaoConvocados')}</h3>
      <div class="tableScroll"><table class="squadTable">
        <thead><tr>
          <th>${t('colStatus')}</th>
          <th class="teamCol">${t('colJogador')}</th>
          <th>${t('colPosicao')}</th>
          <th>${t('colOverall')}</th>
          <th>${t('selecaoColClube')}</th>
        </tr></thead>
        <tbody>
          ${rosterRows.map(p => `
            <tr>
              <td>${p.status === 'titular' ? '#' + p.number : t('reserva')}</td>
              <td class="teamCol">${escapeHtmlAttr(p.name)}${p.meta.nickname ? ` "${escapeHtmlAttr(p.meta.nickname)}"` : ''}</td>
              <td class="posCol">${p.position}</td>
              <td>${p.rating}</td>
              <td class="muted">${escapeHtmlAttr(p.meta.clubOrigin || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <h3>${t('selecaoHistoricoTitle')}</h3>
      ${history.length === 0 ? `<p class="muted">${t('selecaoSemHistorico')}</p>` : `
        <div class="tableScroll"><table>
          <thead><tr><th class="teamCol">${t('selecaoColPartida')}</th><th>${t('selecaoColResultado')}</th><th>${t('selecaoColTipo')}</th></tr></thead>
          <tbody>
            ${history.map(m => `
              <tr>
                <td class="teamCol">${m.isTournament ? t('selecaoTorneioLinha') : `${PARAGUAY_TEAM.name} vs ${escapeHtmlAttr(m.opponent)}`}</td>
                <td>${m.isTournament ? '🏆' : `${m.scorePY} - ${m.scoreOpp}`}</td>
                <td class="muted">${escapeHtmlAttr(m.label)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      `}
    </div>
  `;

  if (arc) {
    const fakeC = {teamId: PARAGUAY_TEAM.id, stage: 'league', currentRoundIndex: arc.currentRoundIndex};
    renderRoundRobinInto(document.getElementById('arcFixtureList'), arc.fixture, fakeC);
  }
}

// Uma perna (ida ou volta) da final da Copa Argentina — mesmo padrão
// autocontido do amistoso da seleção (não mexe em state.competitions),
// usando o plantel real de cada clube (squadOf) em vez de uma escalação
// avulsa.
function renderCopaArgentinaLive() {
  const copa = state.copaArgentina;
  const legIndex = copa.legs.findIndex(l => !l.played);
  const leg = copa.legs[legIndex];
  const homeTeam = teamById[leg.home];
  const awayTeam = teamById[leg.away];
  const homeSquad = squadOf(leg.home);
  const awaySquad = squadOf(leg.away);
  // Ida e volta de verdade, com mandante real — mesma vantagem de
  // mandante/moral/clima de qualquer outra partida de clube.
  const result = simulateMatch(homeTeam, homeSquad, 'equilibrado', awayTeam, awaySquad, 'equilibrado', undefined, undefined, undefined, {
    formA: teamFormFor(leg.home),
    formB: teamFormFor(leg.away),
    weather: rollWeather(),
  });

  content.innerHTML = `
    <div id="matchWrap">
      <h1>${t('copaArgentinaTitle')} — ${legIndex === 0 ? t('copaIda') : t('copaVolta')}</h1>
      <div id="scoreboard">
        <div class="side"><span class="crestSmall" style="${crestStyle(homeTeam)}">${crestContent(homeTeam)}</span>${homeTeam.name}</div>
        <div class="center">
          <div class="clock" id="clockEl">0'</div>
          <div class="scoreNum"><span id="scoreHomeEl">0</span> - <span id="scoreAwayEl">0</span></div>
        </div>
        <div class="side">${awayTeam.name}<span class="crestSmall" style="${crestStyle(awayTeam)}">${crestContent(awayTeam)}</span></div>
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
      <div id="copaLegDone" class="card" style="display:none">
        <h3>${t('fimDeJogo')}</h3>
        <p class="finalScoreSmall"></p>
        <button class="playBtn" id="backToDashboardFromCopaBtn">${t('continuar')}</button>
      </div>
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
  // Cada tick representa 2 minutos de jogo — 650ms fazia a bola "teleportar"
  // de posição em vez de dar tempo de acompanhar o movimento. 1000ms deixa a
  // partida inteira (40 ticks) em ~40s no 1x, ainda rápido mas dá pra ver a
  // bola correndo de verdade.
  const baseMsPerTick = 1000;
  // Quanto tempo real a animação de try (varredura da linha de três-quartos
  // até o escanteio, ver MatchRenderer.startTrySequence) segura o avanço dos
  // ticks — sem isso, no 2x/4x o try passaria rápido demais pra dar tempo de
  // ver a jogada.
  const TRY_ANIM_MS = 1500;
  let lastTime = performance.now();
  let accum = 0;
  let lastPhase = 'kickoff';
  let freezeUntil = 0;

  function pushLog(minute, text) {
    const line = document.createElement('div');
    line.className = 'tickerLine';
    line.innerHTML = `<span class="min">${minute}'</span>${text}`;
    ticker.prepend(line);
  }

  function applyMinute(minute) {
    if (logByMinute[minute]) logByMinute[minute].forEach(txt => pushLog(minute, txt));
  }

  applyMinute(0);

  function finish() {
    playing = false;
    matchAnim = null;
    leg.played = true;
    leg.scoreHome = result.scoreA;
    leg.scoreAway = result.scoreB;
    if (copa.legs.every(l => l.played)) copa.championId = copaArgentinaChampion(copa);
    saveState();
    const doneCard = document.getElementById('copaLegDone');
    doneCard.style.display = '';
    doneCard.querySelector('.finalScoreSmall').textContent = `${homeTeam.name} ${result.scoreA} - ${result.scoreB} ${awayTeam.name}`;
    document.getElementById('backToDashboardFromCopaBtn').addEventListener('click', () => {
      currentView = 'dashboard';
      render();
    });
  }

  function step(now) {
    if (!matchAnim || matchAnim.stopped) return;
    const dt = now - lastTime;
    lastTime = now;
    if (playing) {
      if (now >= freezeUntil) {
        accum += dt * speed;
        const msPerTick = baseMsPerTick;
        while (accum >= msPerTick && tickIndex < ticks.length) {
          accum -= msPerTick;
          const prevTk = ticks[tickIndex - 1] || {scoreA: 0, scoreB: 0};
          tickIndex++;
          const tk = ticks[tickIndex - 1];
          applyMinute(tk.minute);
          scoreHomeEl.textContent = tk.scoreA;
          scoreAwayEl.textContent = tk.scoreB;
          clockEl.textContent = tk.minute + "'";
          if (tk.phase === 'try' && lastPhase !== 'try') {
            renderer.startTrySequence(tk.scoreA > prevTk.scoreA ? 'A' : 'B');
            freezeUntil = now + TRY_ANIM_MS;
          }
          lastPhase = tk.phase || 'open';
          if (now < freezeUntil) break;
        }
      }
      const curr = ticks[Math.min(tickIndex, ticks.length - 1)] || {pos: 50};
      const prev = ticks[Math.max(tickIndex - 1, 0)] || {pos: 50};
      const frac = Math.min(1, accum / baseMsPerTick);
      const interpPos = prev.pos + (curr.pos - prev.pos) * frac;
      renderer.draw(interpPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent, lastPhase);
      if (tickIndex >= ticks.length) {
        finish();
        return;
      }
    } else {
      renderer.draw(renderer.currentPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent, lastPhase);
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
      const tk = ticks[tickIndex - 1];
      applyMinute(tk.minute);
    }
    scoreHomeEl.textContent = result.scoreA;
    scoreAwayEl.textContent = result.scoreB;
    clockEl.textContent = "80'";
    renderer.draw(50, result.scoreA, result.scoreB, "80'");
    if (matchAnim) { matchAnim.stopped = true; cancelAnimationFrame(matchAnim.raf); }
    finish();
  });
}

function renderMatchday() {
  const key = state.activeCompetition;
  const c = comp(key);
  const match = myMatchThisRound(key);
  if (!match) { currentView = 'dashboard'; render(); return; }
  if (competitionBlockedReason(key)) { currentView = 'dashboard'; render(); return; }
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
    openLineupSlot = null;
    lineupPickerAnchor = null;
    manualBenchSlots = null;
    openBenchSlot = null;
    benchPickerAnchor = null;
  }

  const isRealRoster = !!getRealRoster(c.teamId);
  const {xv: autoXV, bench} = formationDataFor(c.teamId, myOptions);
  if (isRealRoster && !manualSlots) manualSlots = slotsFromXV(autoXV);
  const manualXV = isRealRoster ? resolveManualXV(c.teamId, myOptions) : null;
  const effectiveXV = manualXV || autoXV;
  if (isRealRoster && !manualBenchSlots) {
    manualBenchSlots = autoBenchSlots(c.teamId, myOptions, new Set((manualSlots || []).filter(Boolean)));
  }

  // Distingue as duas causas de exclusão pra mostrar a nota certa: choque de
  // agenda (mesma data, local diferente) é um aviso de UM jogo só; convocação
  // pro ARC vale por várias rodadas seguidas, então merece uma nota própria
  // (ver arcCalledUpIds/clashInfoFor, que juntam as duas na mesma excludedIds).
  const arcIds = arcCalledUpIds();
  const scheduleExcludedCount = [...excludedIds].filter(id => !arcIds.has(id)).length;
  const hasArcExclusion = [...excludedIds].some(id => arcIds.has(id));
  const clashNote = scheduleExcludedCount
    ? `<p class="muted">${t('excluidoHoje')}</p>`
    : (doubleHeaderIds.size ? `<p class="muted">${t('jogoDuplo')}</p>` : '');
  const arcNote = hasArcExclusion ? `<p class="muted">${t('arcConvocadosNota')}</p>` : '';

  content.innerHTML = `
    <h1>${t('diaDeJogo', {comp: competitionLabel(key), round: roundName})}</h1>
    <div class="card">
      <h3>${isHome ? t('casaVs', {home: myTeam.name, away: opp.name}) : t('casaVs', {home: opp.name, away: myTeam.name})}</h3>
      <p class="muted">${t('statsLine', {a: opp.attack, d: opp.defense, s: opp.stamina})}</p>
      ${c.stage === 'knockout' ? `<p class="muted">${t('mataDesempate')}</p>` : ''}
      ${clashNote}
      ${arcNote}
      <h3>${t('escolhaTatica')}</h3>
      <div class="tacticOptions" id="tacticOptions">
        <button class="tacticBtn" data-t="agresivo"><b>${t('taticaAgresivo')}</b><span>${t('taticaAgresivoDesc')}</span></button>
        <button class="tacticBtn" data-t="equilibrado"><b>${t('taticaEquilibrado')}</b><span>${t('taticaEquilibradoDesc')}</span></button>
        <button class="tacticBtn" data-t="defensivo"><b>${t('taticaDefensivo')}</b><span>${t('taticaDefensivoDesc')}</span></button>
      </div>
      <button class="playBtn" id="startMatchBtn">${t('comecarPartida')}</button>
    </div>
    ${isRealRoster ? '' : renderFormationHtml(effectiveXV, bench, myTeam.color, t('escalacaoHoje'))}
    ${isRealRoster ? renderLineupEditorHtml(c.teamId, myOptions, myTeam.color) : ''}
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
    Array.from(document.querySelectorAll('.lineupShirtBtn')).forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const idx = Number(btn.dataset.slot);
        if (openLineupSlot === idx) {
          openLineupSlot = null;
          lineupPickerAnchor = null;
        } else {
          openLineupSlot = idx;
          lineupPickerAnchor = {x: ev.clientX, y: ev.clientY};
        }
        lineupPickerExpanded = false;
        renderMatchday();
      });
    });
    Array.from(document.querySelectorAll('.lineupPickBtn')).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = openLineupSlot;
        const newId = btn.dataset.pick;
        const dupIdx = manualSlots.findIndex((pid, i) => pid === newId && i !== idx);
        if (dupIdx !== -1) manualSlots[dupIdx] = manualSlots[idx];
        manualSlots[idx] = newId;
        openLineupSlot = null;
        lineupPickerAnchor = null;
        lineupPickerExpanded = false;
        pruneBenchAgainstXV();
        renderMatchday();
      });
    });
    const expandPickerBtn = document.getElementById('expandLineupPickerBtn');
    if (expandPickerBtn) {
      expandPickerBtn.addEventListener('click', () => {
        lineupPickerExpanded = !lineupPickerExpanded;
        renderMatchday();
      });
    }
    const closePickerBtn = document.getElementById('closeLineupPickerBtn');
    if (closePickerBtn) {
      closePickerBtn.addEventListener('click', () => {
        openLineupSlot = null;
        lineupPickerAnchor = null;
        lineupPickerExpanded = false;
        renderMatchday();
      });
    }
    const pickerBackdrop = document.getElementById('lineupPickerBackdrop');
    if (pickerBackdrop) {
      pickerBackdrop.addEventListener('click', () => {
        openLineupSlot = null;
        lineupPickerAnchor = null;
        lineupPickerExpanded = false;
        renderMatchday();
      });
    }
    // Tira do banco qualquer jogador que acabou de virar titular (troca de
    // XV automático, Time A ou Time B) — senão ele ficava escalado nos dois
    // lugares ao mesmo tempo.
    const pruneBenchAgainstXV = () => {
      if (!manualBenchSlots) return;
      const startingNow = new Set((manualSlots || []).filter(Boolean));
      manualBenchSlots = manualBenchSlots.map(pid => (pid && startingNow.has(pid)) ? null : pid);
    };
    document.getElementById('lineupAutoBtn').addEventListener('click', () => {
      manualSlots = slotsFromXV(autoXV);
      openLineupSlot = null;
      lineupPickerAnchor = null;
      manualBenchSlots = autoBenchSlots(c.teamId, myOptions, new Set(manualSlots.filter(Boolean)));
      openBenchSlot = null;
      benchPickerAnchor = null;
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
      // Sem Time A salvo ainda: cai pra melhor escalação automática atual,
      // igual já é o padrão antes de qualquer edição manual.
      manualSlots = preset ? [...preset] : slotsFromXV(autoXV);
      pruneBenchAgainstXV();
      renderMatchday();
    });
    document.getElementById('lineupLoadBBtn').addEventListener('click', () => {
      const preset = state.lineupPresets[c.teamId] && state.lineupPresets[c.teamId].B;
      if (preset) {
        manualSlots = [...preset];
        pruneBenchAgainstXV();
        renderMatchday();
        return;
      }
      // Sem Time B salvo ainda: em vez de dar erro, já monta um Time B
      // diferente do Time A na hora — os melhores disponíveis EXCLUINDO quem
      // já está no Time A — pra nunca cair num "Time B" idêntico/vazio.
      const primaryIds = new Set(autoXV.map(p => p.id));
      const altOptions = {...myOptions, excludedIds: new Set([...(myOptions.excludedIds || []), ...primaryIds])};
      const altXV = squadOf(c.teamId, altOptions);
      manualSlots = slotsFromXV(altXV);
      pruneBenchAgainstXV();
      renderMatchday();
    });

    Array.from(document.querySelectorAll('.benchEditBtn')).forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const idx = Number(btn.dataset.benchslot);
        if (openBenchSlot === idx) {
          openBenchSlot = null;
          benchPickerAnchor = null;
        } else {
          openBenchSlot = idx;
          benchPickerAnchor = {x: ev.clientX, y: ev.clientY};
        }
        renderMatchday();
      });
    });
    Array.from(document.querySelectorAll('[data-benchpick]')).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = openBenchSlot;
        const newId = btn.dataset.benchpick || null;
        if (!manualBenchSlots) manualBenchSlots = new Array(MAX_BENCH).fill(null);
        if (newId) {
          const dupIdx = manualBenchSlots.findIndex((pid, i) => pid === newId && i !== idx);
          if (dupIdx !== -1) manualBenchSlots[dupIdx] = null;
        }
        manualBenchSlots[idx] = newId;
        openBenchSlot = null;
        benchPickerAnchor = null;
        renderMatchday();
      });
    });
    const closeBenchPickerBtn = document.getElementById('closeBenchPickerBtn');
    if (closeBenchPickerBtn) {
      closeBenchPickerBtn.addEventListener('click', () => {
        openBenchSlot = null;
        benchPickerAnchor = null;
        renderMatchday();
      });
    }
    const benchPickerBackdrop = document.getElementById('benchPickerBackdrop');
    if (benchPickerBackdrop) {
      benchPickerBackdrop.addEventListener('click', () => {
        openBenchSlot = null;
        benchPickerAnchor = null;
        renderMatchday();
      });
    }

    setupLineupDragDrop(renderMatchday);
  }
}

// Arrastar-e-soltar pra trocar/substituir jogadores no editor de escalação:
// arrasta uma camisa (titular ou reserva) até outra pra trocarem de lugar —
// dentro do XV troca posição, dentro do banco reordena, e entre XV e banco é
// a própria substituição (o titular arrastado vira reserva no slot largado, e
// vice-versa). Baseado em Pointer Events (não HTML5 DnD) pra funcionar igual
// com mouse e toque; só intercepta o clique normal de abrir o seletor (ver
// handlers de .lineupShirtBtn/.benchEditBtn acima) quando o ponteiro realmente
// se move além do limiar de arrasto — um toque/clique parado no lugar não é
// afetado.
function setupLineupDragDrop(rerender) {
  const DRAG_THRESHOLD = 8;
  let drag = null; // {pointerId, source: {type, idx, el}, sourceEl, startX, startY, moved, ghost}

  function slotInfoFromEl(el) {
    const shirt = el && el.closest && el.closest('.lineupShirtBtn');
    if (shirt) return {type: 'xv', idx: Number(shirt.dataset.slot), el: shirt};
    const bench = el && el.closest && el.closest('.benchEditBtn');
    if (bench) return {type: 'bench', idx: Number(bench.dataset.benchslot), el: bench};
    return null;
  }

  function clearDragHighlight() {
    document.querySelectorAll('.dragOverTarget').forEach(el => el.classList.remove('dragOverTarget'));
  }

  function applySwap(source, target) {
    if (source.type === target.type && source.idx === target.idx) return false;
    if (source.type === 'xv' && target.type === 'xv') {
      [manualSlots[source.idx], manualSlots[target.idx]] = [manualSlots[target.idx], manualSlots[source.idx]];
    } else if (source.type === 'bench' && target.type === 'bench') {
      if (!manualBenchSlots) return false;
      [manualBenchSlots[source.idx], manualBenchSlots[target.idx]] = [manualBenchSlots[target.idx], manualBenchSlots[source.idx]];
    } else {
      if (!manualBenchSlots) manualBenchSlots = new Array(MAX_BENCH).fill(null);
      const xvIdx = source.type === 'xv' ? source.idx : target.idx;
      const benchIdx = source.type === 'bench' ? source.idx : target.idx;
      [manualSlots[xvIdx], manualBenchSlots[benchIdx]] = [manualBenchSlots[benchIdx], manualSlots[xvIdx]];
    }
    return true;
  }

  function cleanupDrag() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    if (drag) {
      if (drag.ghost) drag.ghost.remove();
      drag.sourceEl.classList.remove('dragging');
    }
    clearDragHighlight();
  }

  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true;
      drag.sourceEl.classList.add('dragging');
      const ghost = drag.sourceEl.cloneNode(true);
      ghost.className = drag.sourceEl.className.replace(/\bdragging\b/, '').trim() + ' dragGhost';
      ghost.style.position = 'fixed';
      ghost.style.margin = '0';
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    if (!drag.moved) return;
    ev.preventDefault();
    drag.ghost.style.left = `${ev.clientX}px`;
    drag.ghost.style.top = `${ev.clientY}px`;
    drag.ghost.style.transform = 'translate(-50%, -50%) scale(1.08)';
    clearDragHighlight();
    const target = slotInfoFromEl(document.elementFromPoint(ev.clientX, ev.clientY));
    if (target && !(target.type === drag.source.type && target.idx === drag.source.idx)) {
      target.el.classList.add('dragOverTarget');
    }
  }

  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const wasMoved = drag.moved;
    const target = wasMoved ? slotInfoFromEl(document.elementFromPoint(ev.clientX, ev.clientY)) : null;
    cleanupDrag();
    const didSwap = target && applySwap(drag.source, target);
    drag = null;
    if (didSwap) rerender();
  }

  function onCancel() {
    cleanupDrag();
    drag = null;
  }

  Array.from(document.querySelectorAll('.lineupShirtBtn[data-filled="1"], .benchEditBtn[data-filled="1"]')).forEach(el => {
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const source = slotInfoFromEl(el);
      if (!source) return;
      drag = {pointerId: ev.pointerId, source, sourceEl: el, startX: ev.clientX, startY: ev.clientY, moved: false, ghost: null};
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    });
  });
}

// Tática inicial do adversário: pondera pela força relativa em vez de
// sortear totalmente ao acaso — o favorito tende a jogar mais controlado
// (não precisa arriscar), a zebra tende a arriscar mais (só ganha se sair
// do script). Continua tendo variação, só desloca a distribuição.
function pickOpponentTactic(myTeam, oppTeam) {
  const diff = (oppTeam.attack + oppTeam.defense) - (myTeam.attack + myTeam.defense);
  const roll = Math.random();
  if (diff > 15) return roll < 0.55 ? 'defensivo' : roll < 0.85 ? 'equilibrado' : 'agresivo';
  if (diff < -15) return roll < 0.55 ? 'agresivo' : roll < 0.85 ? 'equilibrado' : 'defensivo';
  return roll < 0.25 ? 'agresivo' : roll < 0.75 ? 'equilibrado' : 'defensivo';
}

// Ajuste da tática do adversário no intervalo, conforme o placar do primeiro
// tempo (do ponto de vista do PRÓPRIO adversário): perdendo de 10+ precisa
// arriscar tudo pra ter chance; ganhando de 10+ segura o resultado em vez de
// continuar se expondo. Placar equilibrado mantém a tática que já vinha
// fazendo — sem isso a IA jogava do mesmo jeito o jogo inteiro mesmo
// perdendo de goleada, o que deixava a partida sem risco nenhum no segundo
// tempo.
function reactiveOpponentTactic(currentTactic, oppScoreDiff) {
  if (oppScoreDiff <= -10) return 'agresivo';
  if (oppScoreDiff >= 10) return 'defensivo';
  return currentTactic;
}

const WEATHER_I18N_KEY = {seco: 'weatherSeco', chuva: 'weatherChuva', vento: 'weatherVento'};
function weatherLabelText(weatherKey) {
  return t(WEATHER_I18N_KEY[weatherKey] || 'weatherSeco');
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
  const userTeam = isHome ? homeTeam : awayTeam;
  const oppTeamObj = isHome ? awayTeam : homeTeam;
  let oppTactic = pickOpponentTactic(userTeam, oppTeamObj);

  let tacticHome = isHome ? myTactic : oppTactic;
  let tacticAway = isHome ? oppTactic : myTactic;

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
  // Entrosamento (ver computeChemistryBonuses) só faz sentido pro elenco
  // curado e persistente do clube gerenciado — rivais procedurais não têm
  // histórico de chemistry rastreado, então ficam com bônus zero (default).
  const rawMySquad = manualXV || squadOf(c.teamId, myOptions);
  const mySquad = getRealRoster(c.teamId) ? attachChemistryMeta(rawMySquad) : rawMySquad;
  const homeSquad = homeId === c.teamId ? mySquad : squadOf(homeId);
  const awaySquad = awayId === c.teamId ? mySquad : squadOf(awayId);
  pendingMyXV = mySquad;

  // Substituições ao vivo: só faz sentido pra times com elenco real (curado),
  // que têm banco de reservas — times procedurais só têm os 15 gerados. Até
  // 8 trocas por partida (regra real do rugby); quem sai não volta a entrar.
  // O banco é o escolhido manualmente na tela de Dia de Jogo (manualBenchSlots)
  // — não mais "todo o elenco elegível que não é titular" (podiam ser
  // dezenas de jogadores disponíveis pra entrar, em vez dos ~8 reais).
  const myRosterReal = !!getRealRoster(c.teamId);
  const manualBench = myRosterReal ? resolveManualBench(c.teamId, myOptions) : null;
  const myBench = manualBench && manualBench.length
    ? manualBench
    : (myRosterReal ? rosterWithStatus(c.teamId, myOptions).filter(p => p.status === 'reserva') : []);
  const MAX_SUBS = 8;
  let subsUsed = 0;
  let subOutSelected = null; // id do titular em campo escolhido pra sair
  // Id do titular (já em campo, noutro posto) escolhido pra se mover pro
  // posto do subOutSelected — enquanto isso fica setado, o painel pede quem
  // do banco cobre o posto que ELE deixou vago (ver performPositionSwapSub).
  let subSwapSelected = null;
  let subsOpen = false;
  const subbedOffIds = new Set();
  // Acumula todo mundo que entrou em campo (titulares + quem entrou depois),
  // pra aplicar desgaste/lesão de pós-jogo em todos eles, não só em quem
  // terminou a partida — ver finish() mais abaixo.
  const playedPlayersById = {};
  mySquad.forEach(p => { playedPlayersById[p.id] = p; });

  // O plano de jogo por zona (tela de Tática) só é editável pelo clube
  // gerenciado — o rival entra com um plano de IA escalado pela própria
  // força (ver aiGamePlanFor), pra não ser um adversário tacticamente inerte.
  const myPlan = ensureGamePlan();
  const gamePlanHome = homeId === c.teamId ? myPlan : aiGamePlanFor(homeTeam);
  const gamePlanAway = awayId === c.teamId ? myPlan : aiGamePlanFor(awayTeam);

  // Clima sorteado uma vez só pra partida toda — precisa ficar igual em
  // qualquer recálculo por substituição ao vivo (ver performLiveSub, que
  // reusa este mesmo matchContext). Vantagem de mandante e moral entram
  // pelo mesmo matchContext, sempre relativo ao mandante real da partida.
  // Dificuldade (ver DIFFICULTY_MOD): só entra nas partidas do PRÓPRIO
  // usuário, e só no lado RIVAL — nunca no seu próprio time.
  const matchContext = {
    formA: teamFormFor(homeId),
    formB: teamFormFor(awayId),
    weather: rollWeather(),
    rivalMod: DIFFICULTY_MOD[state.difficulty] || 1,
    rivalSide: homeId === c.teamId ? 'B' : (awayId === c.teamId ? 'A' : null),
  };

  const result = simulateMatch(
    homeTeam, homeSquad, tacticHome,
    awayTeam, awaySquad, tacticAway,
    gamePlanHome, gamePlanAway,
    undefined, matchContext, 20,
  );

  // Ajuste tático do adversário no intervalo: reavalia o placar parcial (tick
  // 20 = minuto 40) do PONTO DE VISTA do próprio adversário e, se a tática
  // mudar, recalcula o segundo tempo inteiro a partir dali via resumeState —
  // mesmo mecanismo já usado pelas substituições ao vivo (ver performLiveSub).
  const halftimeTick = result.ticks[19];
  if (halftimeTick) {
    const oppScoreDiff = isHome
      ? (halftimeTick.scoreB - halftimeTick.scoreA)
      : (halftimeTick.scoreA - halftimeTick.scoreB);
    const newOppTactic = reactiveOpponentTactic(oppTactic, oppScoreDiff);
    if (newOppTactic !== oppTactic) {
      oppTactic = newOppTactic;
      tacticHome = isHome ? myTactic : oppTactic;
      tacticAway = isHome ? oppTactic : myTactic;
      const halftimeResumeState = {
        pos: halftimeTick.pos, scoreA: halftimeTick.scoreA, scoreB: halftimeTick.scoreB,
        cardPenaltyA: halftimeTick.cardPenaltyA || 0, cardPenaltyB: halftimeTick.cardPenaltyB || 0,
        redCardA: !!halftimeTick.redCardA, redCardB: !!halftimeTick.redCardB,
        tick: 20,
        // Estatísticas só do 1º tempo (ver statsCheckpointTick) — sem isso, o
        // 2º tempo recalculado ia somar em cima das estatísticas do 2º tempo
        // ANTIGO (descartado), inflando os números do resumo pós-jogo.
        stats: result.statsAtCheckpoint,
      };
      const secondHalf = simulateMatch(
        homeTeam, homeSquad, tacticHome,
        awayTeam, awaySquad, tacticAway,
        gamePlanHome, gamePlanAway,
        halftimeResumeState, matchContext,
      );
      result.ticks = result.ticks.slice(0, 20).concat(secondHalf.ticks);
      result.log = result.log.filter(l => l.minute <= 40).concat(secondHalf.log);
      result.scorersA = result.scorersA.filter(s => s.minute <= 40).concat(secondHalf.scorersA);
      result.scorersB = result.scorersB.filter(s => s.minute <= 40).concat(secondHalf.scorersB);
      result.cards = result.cards.filter(cd => cd.minute <= 40).concat(secondHalf.cards);
      result.stats = secondHalf.stats;
      const lastHalftimeTick = result.ticks[result.ticks.length - 1];
      if (lastHalftimeTick) { result.scoreA = lastHalftimeTick.scoreA; result.scoreB = lastHalftimeTick.scoreB; }
      if (secondHalf.motm) result.motm = secondHalf.motm;
    }
  }

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
        <div class="side"><span class="crestSmall" style="${crestStyle(homeTeam)}">${crestContent(homeTeam)}</span>${homeTeam.name}</div>
        <div class="center">
          <div class="clock" id="clockEl">0'</div>
          <div class="scoreNum"><span id="scoreHomeEl">0</span> - <span id="scoreAwayEl">0</span></div>
        </div>
        <div class="side">${awayTeam.name}<span class="crestSmall" style="${crestStyle(awayTeam)}">${crestContent(awayTeam)}</span></div>
      </div>
      <p class="muted weatherLine">${t('weatherLine', {weather: weatherLabelText(matchContext.weather)})}</p>
      <div id="tacticalBanner" class="tacticalBanner"></div>
      <canvas id="pitch"></canvas>
      <div id="matchControls">
        <button class="ctrlBtn active" id="playPauseBtn">${t('pausar')}</button>
        <button class="ctrlBtn" data-speed="1">1x</button>
        <button class="ctrlBtn" data-speed="2">2x</button>
        <button class="ctrlBtn" data-speed="4">4x</button>
        <button class="ctrlBtn" id="skipBtn">${t('adiantar')}</button>
        ${myRosterReal ? `<button class="ctrlBtn" id="subsBtn">${t('subsBtnLabel', {used: 0, max: MAX_SUBS})}</button>` : ''}
      </div>
      <div id="subsPanel" class="subsPanel"></div>
      <div id="ticker"></div>
    </div>
  `;

  const canvas = document.getElementById('pitch');
  const renderer = new MatchRenderer(canvas, homeTeam, awayTeam, gamePlanHome, gamePlanAway);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());

  const ticker = document.getElementById('ticker');
  const clockEl = document.getElementById('clockEl');
  const scoreHomeEl = document.getElementById('scoreHomeEl');
  const scoreAwayEl = document.getElementById('scoreAwayEl');
  const tacticalBannerEl = document.getElementById('tacticalBanner');
  let lastBannerKey = null;

  function updateTacticalBanner(pos) {
    const info = renderer.getActiveZoneInfo(pos);
    if (!info.code && info.style === 'equilibrado' && info.system === 'ninguno') {
      tacticalBannerEl.classList.remove('show');
      lastBannerKey = null;
      return;
    }
    const bannerKey = `${info.team.id}|${info.zoneKey}|${info.style}|${info.code}|${info.system}`;
    if (bannerKey === lastBannerKey) return;
    lastBannerKey = bannerKey;
    const styleLabel = t(ZONE_STYLE_LABEL_KEY[info.style] || 'estiloEquilibrado');
    const zoneLabel = t(ZONE_LABEL_KEY[info.zoneKey]);
    const systemLabel = info.system !== 'ninguno' ? ` <span class="tacticalSystem">· ${t('sistema_' + info.system).split(' — ')[0]}</span>` : '';
    tacticalBannerEl.style.borderColor = ZONE_COLORS[info.zoneKey];
    tacticalBannerEl.innerHTML = `
      <span class="crestSmall" style="${crestStyle(info.team)}">${crestContent(info.team)}</span>
      <b>${zoneLabel}</b> — ${styleLabel}${info.code ? ` · <span class="tacticalCode">${escapeHtmlAttr(info.code)}</span>` : ''}${systemLabel}
    `;
    tacticalBannerEl.classList.add('show');
  }

  let ticks = result.ticks;
  const logByMinute = {};
  result.log.forEach(l => {
    if (!logByMinute[l.minute]) logByMinute[l.minute] = [];
    logByMinute[l.minute].push(l.text);
  });

  let tickIndex = 0;
  // Condição exibida NO PAINEL DE SUBSTITUIÇÕES, ao vivo: a condição de
  // pré-partida (p.condition) é fixa a partida inteira — mostrá-la sem
  // ajuste enquanto o jogo já está rolando faz parecer que ninguém cansa
  // (sempre 100% mesmo aos 80'), o que é impossível. Aplica a mesma curva
  // de cansaço do motor (inMatchFatigueFactor — só entra a partir do
  // intervalo, tick 20/minuto 40), mas alimentada por uma resistência
  // FÍSICA composta, não só resistência crua: resistência (stamina) pesa
  // mais, por ser sobre os 80 minutos inteiros, com uma contribuição menor
  // de recuperação entre fases (recovery) e de resistência mental ao
  // cansaço (determination) — mesmas skills físicas já usadas em
  // declineAfterMatch/recoveryPerWeek. Não altera p.condition em si (que
  // segue sendo usado pra decidir o desgaste real de pós-partida).
  const physicalResistanceOf = p => p.skills.stamina * 0.6 + p.skills.recovery * 0.25 + p.skills.determination * 0.15;
  const liveConditionOf = p => {
    const preMatch = p.condition != null ? p.condition : 100;
    const factor = inMatchFatigueFactor(tickIndex, physicalResistanceOf(p));
    return Math.round(Math.max(15, preMatch * factor));
  };
  let playing = true;
  let speed = 1;
  // Cada tick representa 2 minutos de jogo — 650ms fazia a bola "teleportar"
  // de posição em vez de dar tempo de acompanhar o movimento. 1000ms deixa a
  // partida inteira (40 ticks) em ~40s no 1x, ainda rápido mas dá pra ver a
  // bola correndo de verdade.
  const baseMsPerTick = 1000;
  // Quanto tempo real a animação de try (varredura da linha de três-quartos
  // até o escanteio, ver MatchRenderer.startTrySequence) segura o avanço dos
  // ticks — sem isso, no 2x/4x o try passaria rápido demais pra dar tempo de
  // ver a jogada.
  const TRY_ANIM_MS = 1500;
  let lastTime = performance.now();
  let accum = 0;
  let lastPhase = 'kickoff';
  let freezeUntil = 0;

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
    // Desgaste pós-jogo (ver finalizeRound) deve valer pra todo mundo que
    // entrou em campo, não só quem terminou a partida — inclui quem foi
    // substituído no meio do jogo.
    pendingMyXV = Object.values(playedPlayersById);
    showSummary(result, isHome);
  }

  function step(now) {
    if (!matchAnim || matchAnim.stopped) return;
    const dt = now - lastTime;
    lastTime = now;
    if (playing) {
      if (now >= freezeUntil) {
        accum += dt * speed;
        const msPerTick = baseMsPerTick;
        while (accum >= msPerTick && tickIndex < ticks.length) {
          accum -= msPerTick;
          const prevTk = ticks[tickIndex - 1] || {scoreA: 0, scoreB: 0};
          tickIndex++;
          const t = ticks[tickIndex - 1];
          applyMinute(t.minute);
          handleMedicalTickEvents();
          handleAiSubTickEvents();
          scoreHomeEl.textContent = ticks[tickIndex - 1].scoreA;
          scoreAwayEl.textContent = ticks[tickIndex - 1].scoreB;
          clockEl.textContent = t.minute + "'";
          if (t.phase === 'try' && lastPhase !== 'try') {
            renderer.startTrySequence(t.scoreA > prevTk.scoreA ? 'A' : 'B');
            freezeUntil = now + TRY_ANIM_MS;
          }
          lastPhase = t.phase || 'open';
          if (now < freezeUntil) break;
        }
      }
      const curr = ticks[Math.min(tickIndex, ticks.length - 1)] || {pos: 50};
      const prev = ticks[Math.max(tickIndex - 1, 0)] || {pos: 50};
      const frac = Math.min(1, accum / baseMsPerTick);
      const interpPos = prev.pos + (curr.pos - prev.pos) * frac;
      renderer.draw(interpPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent, lastPhase);
      updateTacticalBanner(interpPos);
      if (tickIndex >= ticks.length) {
        finish();
        return;
      }
    } else {
      renderer.draw(renderer.currentPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent, lastPhase);
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
      handleMedicalTickEvents();
      handleAiSubTickEvents();
    }
    scoreHomeEl.textContent = result.scoreA;
    scoreAwayEl.textContent = result.scoreB;
    clockEl.textContent = "80'";
    renderer.draw(50, result.scoreA, result.scoreB, "80'");
    if (matchAnim) { matchAnim.stopped = true; cancelAnimationFrame(matchAnim.raf); }
    finish();
  });

  // ---- Substituições ao vivo -----------------------------------------------
  // Troca um titular em campo por alguém do banco no minuto atual e recalcula
  // o "futuro" da partida a partir dali (resumeState), descartando o trecho
  // que ainda não tinha sido mostrado ao vivo — o que já rolou no ticker fica
  // intacto.
  function currentResumeState() {
    if (tickIndex === 0) {
      return {pos: 50, scoreA: 0, scoreB: 0, cardPenaltyA: 0, cardPenaltyB: 0, redCardA: false, redCardB: false, tick: 0};
    }
    const last = ticks[tickIndex - 1];
    return {
      pos: last.pos, scoreA: last.scoreA, scoreB: last.scoreB,
      cardPenaltyA: last.cardPenaltyA || 0, cardPenaltyB: last.cardPenaltyB || 0,
      redCardA: !!last.redCardA, redCardB: !!last.redCardB,
      tick: tickIndex,
      // Estatísticas reais até ESTE tick (ver statsSnapshot em engine.js) —
      // usar result.stats aqui pegaria as estatísticas da partida INTEIRA já
      // simulada (0-80'), inflando o resumo pós-jogo a cada substituição ao
      // vivo (o placar batia, mas os tries/conversões/penais listados não).
      stats: last.statsSnapshot,
    };
  }

  // Troca genérica num dos dois lados (usada tanto pela substituição manual
  // quanto pelos eventos médicos automáticos abaixo): recalcula o "futuro" da
  // partida via resumeState e funde o resultado no que já está em tela.
  // Aplica uma ou mais trocas de titular ATOMICAMENTE (uma resimulação só
  // pro conjunto inteiro) — as trocas são resolvidas por ÍNDICE, capturado
  // ANTES de qualquer mutação: como a troca de posição reusa o id de um
  // titular já em campo como "quem entra" de outro posto, procurar de novo
  // por id DEPOIS da primeira mutação encontraria o slot errado (o id passa
  // a existir em dois lugares até a segunda troca ser aplicada).
  function performLiveSubMulti(squadArr, changes, logTexts) {
    const indices = changes.map(({outId}) => squadArr.findIndex(p => p.id === outId));
    if (indices.some(i => i === -1)) return null;
    const applied = changes.map(({inPlayer}, i) => {
      const idx = indices[i];
      const outPlayer = squadArr[idx];
      const newPlayer = {...inPlayer, posId: outPlayer.posId, position: outPlayer.position, group: outPlayer.group, number: outPlayer.number};
      return {idx, outPlayer, newPlayer};
    });
    applied.forEach(({idx, newPlayer}) => { squadArr[idx] = newPlayer; });

    const resumeState = currentResumeState();
    const newSegment = simulateMatch(
      homeTeam, homeSquad, tacticHome,
      awayTeam, awaySquad, tacticAway,
      gamePlanHome, gamePlanAway,
      resumeState, matchContext,
    );
    const currentMinute = resumeState.tick * 2;

    ticks = ticks.slice(0, tickIndex).concat(newSegment.ticks);
    result.ticks = ticks;
    Object.keys(logByMinute).forEach(m => { if (Number(m) > currentMinute) delete logByMinute[m]; });
    newSegment.log.forEach(l => {
      if (!logByMinute[l.minute]) logByMinute[l.minute] = [];
      logByMinute[l.minute].push(l.text);
    });
    (logTexts || []).forEach(logText => {
      if (!logText) return;
      if (!logByMinute[currentMinute]) logByMinute[currentMinute] = [];
      logByMinute[currentMinute].push(logText);
      pushLog(currentMinute, logText);
    });

    result.scorersA = result.scorersA.filter(s => s.minute <= currentMinute).concat(newSegment.scorersA);
    result.scorersB = result.scorersB.filter(s => s.minute <= currentMinute).concat(newSegment.scorersB);
    result.cards = result.cards.filter(cd => cd.minute <= currentMinute).concat(newSegment.cards);
    result.stats = newSegment.stats;
    const lastTick = ticks[ticks.length - 1];
    if (lastTick) { result.scoreA = lastTick.scoreA; result.scoreB = lastTick.scoreB; }
    if (newSegment.motm) result.motm = newSegment.motm;

    return {changes: applied, currentMinute};
  }

  function performLiveSub(squadArr, outId, inPlayer, logText) {
    const res = performLiveSubMulti(squadArr, [{outId, inPlayer}], logText ? [logText] : []);
    if (!res) return null;
    const {outPlayer, newPlayer} = res.changes[0];
    return {outPlayer, newPlayer, currentMinute: res.currentMinute};
  }

  function performSubstitution(outId, inPlayer) {
    if (subsUsed >= MAX_SUBS) return;
    const outPlayerRef = mySquad.find(p => p.id === outId);
    if (!outPlayerRef) return;
    const subTeamName = isHome ? homeTeam.name : awayTeam.name;
    const subText = t('subChangeLog', {team: subTeamName, in: inPlayer.name, out: outPlayerRef.name});
    const res = performLiveSub(mySquad, outId, inPlayer, subText);
    if (!res) return;
    playedPlayersById[res.newPlayer.id] = res.newPlayer;
    subsUsed++;
    subbedOffIds.add(res.outPlayer.id);
  }

  // Reposiciona um titular já em campo pro posto de quem está saindo (ex.:
  // o abertura vira medio scrum) e cobre o posto que ele deixou vago com
  // alguém do banco — no rúgbi de verdade isso gasta só UMA substituição
  // (só quem realmente entra do banco conta; reposicionar dois titulares
  // entre si é de graça).
  function performPositionSwapSub(outId, swapPlayerId, benchInPlayer) {
    if (subsUsed >= MAX_SUBS) return;
    const outPlayerRef = mySquad.find(p => p.id === outId);
    const swapPlayerRef = mySquad.find(p => p.id === swapPlayerId);
    if (!outPlayerRef || !swapPlayerRef) return;
    const subTeamName = isHome ? homeTeam.name : awayTeam.name;
    const moveText = t('subMoveLog', {team: subTeamName, player: swapPlayerRef.name, from: swapPlayerRef.position, to: outPlayerRef.position});
    const subText = t('subChangeLog', {team: subTeamName, in: benchInPlayer.name, out: outPlayerRef.name});
    const res = performLiveSubMulti(mySquad, [
      {outId: outPlayerRef.id, inPlayer: swapPlayerRef},
      {outId: swapPlayerRef.id, inPlayer: benchInPlayer},
    ], [moveText, subText]);
    if (!res) return;
    res.changes.forEach(({newPlayer}) => { playedPlayersById[newPlayer.id] = newPlayer; });
    subsUsed++;
    subbedOffIds.add(outPlayerRef.id);
  }

  // ---- Eventos médicos automáticos (sangue / HIA) --------------------------
  // No rugby de verdade existem duas saídas TEMPORÁRIAS (não contam como
  // substituição definitiva, não usam uma das 8 trocas do técnico):
  //  - Bloodbin: corte que não para de sangrar a tempo — sai, se trata, e
  //    sempre volta depois de um tempo (aqui, ~14').
  //  - HIA (Head Injury Assessment): pancada na cabeça — sai pra avaliação
  //    (~12'); se "passa" no teste volta a jogar, se "reprova" a saída vira
  //    definitiva (o substituto fica em campo, mas sem gastar uma das 8).
  // Só times com elenco real (banco de verdade) entram nesse sorteio.
  function pickBestBenchFor(benchList, squadArr, posId) {
    const free = benchList.filter(p => !squadArr.some(m => m.id === p.id));
    const specialists = free.filter(p => canPlay(p, posId));
    const pool = specialists.length ? specialists : (FRONT_ROW_POS.has(posId) ? [] : free);
    if (!pool.length) return null;
    return pool.reduce((best, p) => (effectiveOverallAt(p, posId) > effectiveOverallAt(best, posId) ? p : best), pool[0]);
  }

  const pendingMedicalReturns = []; // {side, tempPlayerId, originalPlayer, returnAtTick, kind}
  const pendingMedicalCount = {home: 0, away: 0};
  const BLOOD_DURATION_TICKS = 7; // ~14' (2' por tick)
  const HIA_DURATION_TICKS = 6; // ~12'
  const HIA_PASS_CHANCE = 0.7;

  function squadForSide(side) { return side === 'home' ? homeSquad : awaySquad; }
  function teamNameForSide(side) { return side === 'home' ? homeTeam.name : awayTeam.name; }
  function benchForSide(side) {
    const teamId = side === 'home' ? homeId : awayId;
    if (!getRealRoster(teamId)) return [];
    if (teamId === c.teamId) return myBench;
    return rosterWithStatus(teamId).filter(p => p.status === 'reserva');
  }

  function tryTriggerMedicalEvent() {
    const sides = Math.random() < 0.5 ? ['home', 'away'] : ['away', 'home'];
    for (const side of sides) {
      const teamId = side === 'home' ? homeId : awayId;
      if (!getRealRoster(teamId) || pendingMedicalCount[side] > 0) continue;
      const roll = Math.random();
      let kind = null;
      if (roll < 0.006) kind = 'blood';
      else if (roll < 0.010) kind = 'hia';
      if (!kind) continue;

      const squadArr = squadForSide(side);
      const victim = squadArr[Math.floor(Math.random() * squadArr.length)];
      const replacement = pickBestBenchFor(benchForSide(side), squadArr, victim.posId);
      if (!replacement) continue; // sem cobertura no banco pra essa posição

      const logText = t(kind === 'blood' ? 'medBloodLog' : 'medHiaLog', {team: teamNameForSide(side), player: victim.name, in: replacement.name});
      const res = performLiveSub(squadArr, victim.id, replacement, logText);
      if (!res) continue;
      if (teamId === c.teamId) playedPlayersById[res.newPlayer.id] = res.newPlayer;
      pendingMedicalCount[side]++;
      pendingMedicalReturns.push({
        side, tempPlayerId: res.newPlayer.id, originalPlayer: res.outPlayer,
        returnAtTick: tickIndex + (kind === 'blood' ? BLOOD_DURATION_TICKS : HIA_DURATION_TICKS),
        kind,
      });
      return; // só 1 evento médico por tick, pra não empilhar re-simulações
    }
  }

  function processMedicalReturns() {
    for (let i = pendingMedicalReturns.length - 1; i >= 0; i--) {
      const ev = pendingMedicalReturns[i];
      if (ev.returnAtTick > tickIndex) continue;
      pendingMedicalReturns.splice(i, 1);
      pendingMedicalCount[ev.side]--;
      const teamId = ev.side === 'home' ? homeId : awayId;
      if (ev.kind === 'hia' && Math.random() >= HIA_PASS_CHANCE) {
        const logText = t('medHiaFailLog', {team: teamNameForSide(ev.side), player: ev.originalPlayer.name});
        if (!logByMinute[tickIndex * 2]) logByMinute[tickIndex * 2] = [];
        logByMinute[tickIndex * 2].push(logText);
        pushLog(tickIndex * 2, logText);
        continue; // não volta: o substituto fica em campo em definitivo
      }
      const logText = t('medReturnLog', {team: teamNameForSide(ev.side), player: ev.originalPlayer.name});
      const res = performLiveSub(squadForSide(ev.side), ev.tempPlayerId, ev.originalPlayer, logText);
      if (res && teamId === c.teamId) playedPlayersById[res.newPlayer.id] = res.newPlayer;
    }
  }

  function handleMedicalTickEvents() {
    if (tickIndex === 0) return;
    processMedicalReturns();
    tryTriggerMedicalEvent();
  }

  // ---- Substituições táticas da IA rival ------------------------------------
  // O motor não rastreia fadiga por jogador dentro da partida (só a média do
  // time inteiro, ver inMatchFatigueFactor em engine.js), então o gatilho é o
  // próprio relógio — o mesmo padrão real de troca: primeira-línea renovada
  // por volta dos 50-60', resto do pack em seguida, backs entrando mais na
  // reta final. Só mexe no time RIVAL (o usuário sempre controla as próprias
  // trocas pelo painel de substituições) e só em times com elenco real —
  // procedurais não têm banco de jogadores nomeados pra entrar em campo.
  const AI_SUB_MAX = MAX_SUBS;
  const aiSubsUsed = {home: 0, away: 0};
  const aiSubbedOffIds = {home: new Set(), away: new Set()};

  // Janela de posições liberadas pra troca em cada fase da partida — null
  // (68'+) libera qualquer posição, inclusive backs.
  function aiSubPositionPool(tick) {
    if (tick < 30) return ['PI', 'HK'];
    if (tick < 34) return ['PI', 'HK', 'SL', 'AL', 'N8'];
    return null;
  }

  function tryTriggerAiSub(side) {
    const teamId = side === 'home' ? homeId : awayId;
    if (teamId === c.teamId) return; // usuário controla suas próprias trocas
    if (!getRealRoster(teamId)) return; // sem banco nomeado pra entrar
    if (aiSubsUsed[side] >= AI_SUB_MAX) return;
    if (pendingMedicalCount[side] > 0) return; // não empilha com evento médico pendente
    if (tickIndex < 25) return; // antes de ~50' a IA não mexe

    const pool = aiSubPositionPool(tickIndex);
    const squadArr = squadForSide(side);
    const candidates = squadArr.filter(p => !aiSubbedOffIds[side].has(p.id) && (!pool || pool.includes(p.posId)));
    if (!candidates.length) return;

    // Time perdendo de 10+ arrisca uma troca a mais (impacto ofensivo);
    // ganhando de 10+ prioriza frescor na frente pra segurar o placar no
    // ponto de contato — mesmo espírito do ajuste tático de intervalo
    // (reactiveOpponentTactic), só que espalhado ao longo do 2º tempo.
    const lastTick = ticks[Math.max(tickIndex - 1, 0)];
    const myScore = side === 'home' ? lastTick.scoreA : lastTick.scoreB;
    const oppScore = side === 'home' ? lastTick.scoreB : lastTick.scoreA;
    const diff = myScore - oppScore;
    const urgency = diff <= -10 ? 0.06 : diff >= 10 ? -0.02 : 0;
    const progress = tickIndex / 40;
    const chance = Math.max(0, 0.05 + progress * 0.09 + urgency);
    if (Math.random() > chance) return;

    // Troca quem está rendendo menos em campo, não sorteia à toa.
    const outPlayer = candidates.reduce((worst, p) => (p.rating < worst.rating ? p : worst), candidates[0]);
    const replacement = pickBestBenchFor(benchForSide(side), squadArr, outPlayer.posId);
    if (!replacement) return;

    const logText = t('subChangeLog', {team: teamNameForSide(side), in: replacement.name, out: outPlayer.name});
    const res = performLiveSub(squadArr, outPlayer.id, replacement, logText);
    if (!res) return;
    aiSubsUsed[side]++;
    // Marca os DOIS lados da troca — quem saiu não volta, e quem entrou não
    // pode ser trocado de novo depois (sem isso os mesmos dois jogadores
    // ficavam entrando e saindo em looping, gastando as 8 trocas à toa).
    aiSubbedOffIds[side].add(res.outPlayer.id);
    aiSubbedOffIds[side].add(res.newPlayer.id);
  }

  function handleAiSubTickEvents() {
    if (tickIndex === 0) return;
    tryTriggerAiSub('home');
    tryTriggerAiSub('away');
  }

  const subsBtn = document.getElementById('subsBtn');
  const subsPanelEl = document.getElementById('subsPanel');

  function updateSubsButtonLabel() {
    if (subsBtn) subsBtn.textContent = t('subsBtnLabel', {used: subsUsed, max: MAX_SUBS});
  }

  function renderSubsPanel() {
    if (!subsPanelEl) return;
    if (!subsOpen) { subsPanelEl.innerHTML = ''; return; }

    const availableBench = myBench.filter(p => !subbedOffIds.has(p.id) && !mySquad.some(m => m.id === p.id));

    // Banco ainda não entrou em campo — continua com a condição de
    // pré-partida normal (fresco), sem a curva de cansaço ao vivo (essa só
    // se aplica a quem já está desgastando em campo, ver onFieldRows).
    const benchRow = (p, posId) => `
      <button type="button" class="lineupPickBtn" data-in="${p.id}">
        <span>${escapeHtmlAttr(p.name)}${p.posId !== posId ? ' ⇄' : ''}</span>
        <span class="muted">${effectiveOverallAt(p, posId)} · ${Math.round(p.condition)}%</span>
      </button>
    `;

    // PASSO 2 do reposicionamento: já escolheu mover um titular pro posto de
    // quem sai — agora só falta quem do banco cobre o posto que ELE (o
    // titular movido) deixou vago. Substitui o painel inteiro nesse passo
    // pra manter o fluxo focado numa coisa de cada vez.
    if (subSwapSelected) {
      const swapPlayer = mySquad.find(p => p.id === subSwapSelected);
      if (!swapPlayer) {
        subSwapSelected = null;
      } else {
        const posId = swapPlayer.posId;
        const specialists = availableBench.filter(p => canPlay(p, posId));
        const outros = FRONT_ROW_POS.has(posId) ? [] : availableBench.filter(p => !canPlay(p, posId));
        subsPanelEl.innerHTML = `
          <div class="lineupPicker">
            <h4>${t('subsPanelTitle', {used: subsUsed, max: MAX_SUBS})}</h4>
            <div class="lineupPickGroupLabel">${t('subsPickInFor', {name: swapPlayer.name, pos: swapPlayer.position})}</div>
            ${!specialists.length && !outros.length ? `<p class="muted">${t('subsBankEmpty')}</p>` : ''}
            ${specialists.length ? `<div class="lineupPickList">${specialists.map(p => benchRow(p, posId)).join('')}</div>` : ''}
            ${outros.length ? `<div class="lineupPickGroupLabel">${t('outrasPosicoes')}</div><div class="lineupPickList">${outros.map(p => benchRow(p, posId)).join('')}</div>` : ''}
            <button type="button" class="ctrlBtn" id="cancelSwapBtn">${t('subsCancelMove')}</button>
            <button type="button" class="ctrlBtn" id="closeSubsBtn">${t('fecharSeletor')}</button>
          </div>
        `;
        Array.from(subsPanelEl.querySelectorAll('[data-in]')).forEach(btn => {
          btn.addEventListener('click', () => {
            const benchInPlayer = availableBench.find(p => p.id === btn.dataset.in);
            if (!benchInPlayer || !subOutSelected || !subSwapSelected) return;
            performPositionSwapSub(subOutSelected, subSwapSelected, benchInPlayer);
            subOutSelected = null;
            subSwapSelected = null;
            updateSubsButtonLabel();
            renderSubsPanel();
          });
        });
        const cancelBtn = document.getElementById('cancelSwapBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { subSwapSelected = null; renderSubsPanel(); });
        const closeBtnStep2 = document.getElementById('closeSubsBtn');
        if (closeBtnStep2) closeBtnStep2.addEventListener('click', () => { subsOpen = false; subOutSelected = null; subSwapSelected = null; renderSubsPanel(); });
        return;
      }
    }

    // Lista de quem pode entrar, renderizada logo ABAIXO do botão do jogador
    // escolhido pra sair (em vez de sempre lá embaixo do painel) — assim fica
    // óbvio pra qual titular aquela lista se refere. Além do banco, também
    // lista titulares já em campo que podem ser REPOSICIONADOS pra cá (ex.:
    // o abertura vira medio scrum) — escolher um deles abre o passo 2 acima.
    const pickerHtmlFor = outPlayer => {
      const posId = outPlayer.posId;
      const specialists = availableBench.filter(p => canPlay(p, posId));
      const outros = FRONT_ROW_POS.has(posId) ? [] : availableBench.filter(p => !canPlay(p, posId));
      const onFieldCandidates = FRONT_ROW_POS.has(posId)
        ? mySquad.filter(p => p.id !== outPlayer.id && canPlay(p, posId))
        : sortCandidates(mySquad.filter(p => p.id !== outPlayer.id), posId);
      const onFieldRow = p => `
        <button type="button" class="lineupPickBtn" data-swap="${p.id}">
          <span>${escapeHtmlAttr(p.name)}${p.posId !== posId ? ' ⇄' : ''} <span class="muted">(${p.position})</span></span>
          <span class="muted">${effectiveOverallAt(p, posId)} · ${liveConditionOf(p)}%</span>
        </button>
      `;
      return `
        <div class="subsInlinePicker">
          <div class="lineupPickGroupLabel">${t('subsPickIn', {name: outPlayer.name})}</div>
          ${!specialists.length && !outros.length ? `<p class="muted">${t('subsBankEmpty')}</p>` : ''}
          ${specialists.length ? `<div class="lineupPickList">${specialists.map(p => benchRow(p, posId)).join('')}</div>` : ''}
          ${outros.length ? `<div class="lineupPickGroupLabel">${t('outrasPosicoes')}</div><div class="lineupPickList">${outros.map(p => benchRow(p, posId)).join('')}</div>` : ''}
          ${onFieldCandidates.length ? `<div class="lineupPickGroupLabel">${t('subsEnCancha')}</div><div class="lineupPickList">${onFieldCandidates.map(onFieldRow).join('')}</div>` : ''}
        </div>
      `;
    };

    const onFieldRows = mySquad.map(p => `
      <button type="button" class="lineupPickBtn ${subOutSelected === p.id ? 'selected' : ''}" data-out="${p.id}">
        <span>#${p.number} ${escapeHtmlAttr(p.name)}</span>
        <span class="muted">${p.position} · ${liveConditionOf(p)}%</span>
      </button>
      ${subOutSelected === p.id ? pickerHtmlFor(p) : ''}
    `).join('');

    subsPanelEl.innerHTML = `
      <div class="lineupPicker">
        <h4>${t('subsPanelTitle', {used: subsUsed, max: MAX_SUBS})}</h4>
        ${subsUsed >= MAX_SUBS ? `<p class="muted">${t('subsNoneLeft', {max: MAX_SUBS})}</p>` : `
          <div class="lineupPickGroupLabel">${t('subsPickOut')}</div>
          <div class="lineupPickList">${onFieldRows}</div>
        `}
        <button type="button" class="ctrlBtn" id="closeSubsBtn">${t('fecharSeletor')}</button>
      </div>
    `;

    Array.from(subsPanelEl.querySelectorAll('[data-out]')).forEach(btn => {
      btn.addEventListener('click', () => {
        subOutSelected = btn.dataset.out === subOutSelected ? null : btn.dataset.out;
        renderSubsPanel();
      });
    });
    Array.from(subsPanelEl.querySelectorAll('[data-in]')).forEach(btn => {
      btn.addEventListener('click', () => {
        const inPlayer = availableBench.find(p => p.id === btn.dataset.in);
        if (!inPlayer || !subOutSelected) return;
        performSubstitution(subOutSelected, inPlayer);
        subOutSelected = null;
        updateSubsButtonLabel();
        renderSubsPanel();
      });
    });
    Array.from(subsPanelEl.querySelectorAll('[data-swap]')).forEach(btn => {
      btn.addEventListener('click', () => {
        subSwapSelected = btn.dataset.swap;
        renderSubsPanel();
      });
    });
    const closeBtn = document.getElementById('closeSubsBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => { subsOpen = false; subOutSelected = null; subSwapSelected = null; renderSubsPanel(); });
  }

  if (subsBtn) {
    subsBtn.addEventListener('click', () => {
      subsOpen = !subsOpen;
      subOutSelected = null;
      subSwapSelected = null;
      renderSubsPanel();
    });
  }
}

function computeTerritoryPct(ticks) {
  if (!ticks || !ticks.length) return {pctA: 50, pctB: 50};
  let a = 0, b = 0;
  ticks.forEach(tk => {
    if (tk.pos > 50) a += 1;
    else if (tk.pos < 50) b += 1;
    else { a += 0.5; b += 0.5; }
  });
  const total = a + b;
  if (total <= 0) return {pctA: 50, pctB: 50};
  const pctA = Math.round((a / total) * 100);
  return {pctA, pctB: 100 - pctA};
}

function statBarRow(label, homeColor, awayColor, homeNum, awayNum, homeText, awayText) {
  const total = homeNum + awayNum;
  const homeShare = total > 0 ? (homeNum / total) * 100 : 50;
  const awayShare = 100 - homeShare;
  return `
    <div class="statRow">
      <div class="statLabel">${label}</div>
      <div class="statValLine">
        <span class="statVal">${homeText}</span>
        <span class="statVal">${awayText}</span>
      </div>
      <div class="statBarTrack">
        <div class="statBarFill" style="width:${homeShare}%; background:${homeColor};"></div>
        <div class="statBarFill" style="width:${awayShare}%; background:${awayColor};"></div>
      </div>
    </div>
  `;
}

function cardText(yellow, red) {
  const parts = [];
  if (yellow > 0) parts.push(`🟨×${yellow}`);
  if (red > 0) parts.push(`🟥×${red}`);
  return parts.length ? parts.join(' ') : '—';
}

function renderMatchStatsHtml(result, homeTeam, awayTeam) {
  const stats = result.stats;
  if (!stats) return '';
  const A = stats.A, B = stats.B;
  const homeColor = homeTeam.color || '#3b82f6';
  const awayColor = awayTeam.color || '#ef4444';
  const territory = computeTerritoryPct(result.ticks);

  const cardsA = (result.cards || []).filter(c => c.team === homeTeam.name);
  const cardsB = (result.cards || []).filter(c => c.team === awayTeam.name);
  const yellowA = cardsA.filter(c => c.type === 'yellow').length;
  const redA = cardsA.filter(c => c.type === 'red').length;
  const yellowB = cardsB.filter(c => c.type === 'yellow').length;
  const redB = cardsB.filter(c => c.type === 'red').length;
  const showCards = (yellowA + redA + yellowB + redB) > 0;
  const showDrops = (A.dropGoalsAttempted + B.dropGoalsAttempted) > 0;

  let rows = '';
  rows += statBarRow(t('statTerritorio'), homeColor, awayColor, territory.pctA, territory.pctB, `${territory.pctA}%`, `${territory.pctB}%`);
  rows += statBarRow(t('statQuiebres'), homeColor, awayColor, A.lineBreaks, B.lineBreaks, `${A.lineBreaks}`, `${B.lineBreaks}`);
  rows += statBarRow(t('statTurnovers'), homeColor, awayColor, A.turnoversWon, B.turnoversWon, `${A.turnoversWon}`, `${B.turnoversWon}`);
  rows += statBarRow(t('statErrores'), homeColor, awayColor, A.handlingErrors, B.handlingErrors, `${A.handlingErrors}`, `${B.handlingErrors}`);
  rows += statBarRow(t('statScrums'), homeColor, awayColor, A.scrumsWon, B.scrumsWon, `${A.scrumsWon}/${A.scrumsTotal}`, `${B.scrumsWon}/${B.scrumsTotal}`);
  rows += statBarRow(t('statLineouts'), homeColor, awayColor, A.lineoutsWon, B.lineoutsWon, `${A.lineoutsWon}/${A.lineoutsTotal}`, `${B.lineoutsWon}/${B.lineoutsTotal}`);
  rows += statBarRow(t('statConversiones'), homeColor, awayColor, A.conversionsMade, B.conversionsMade, `${A.conversionsMade}/${A.conversionsAttempted}`, `${B.conversionsMade}/${B.conversionsAttempted}`);
  rows += statBarRow(t('statPenales'), homeColor, awayColor, A.penaltiesMade, B.penaltiesMade, `${A.penaltiesMade}/${A.penaltiesAttempted}`, `${B.penaltiesMade}/${B.penaltiesAttempted}`);
  if (showDrops) {
    rows += statBarRow(t('statDrops'), homeColor, awayColor, A.dropGoalsMade, B.dropGoalsMade, `${A.dropGoalsMade}/${A.dropGoalsAttempted}`, `${B.dropGoalsMade}/${B.dropGoalsAttempted}`);
  }
  if (showCards) {
    rows += statBarRow(t('statTarjetas'), homeColor, awayColor, yellowA + redA, yellowB + redB, cardText(yellowA, redA), cardText(yellowB, redB));
  }

  return `
    <div class="statsSection">
      <h3>${t('statsTitle')}</h3>
      ${rows}
    </div>
  `;
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
      ${renderMatchStatsHtml(result, homeTeam, awayTeam)}
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
  const progressAtPlay = progressOf(c);

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
  const learnedPositions = tickTraining();
  tickGroupTraining();
  tickAttendanceExtras();
  tickScouting();
  tickForeignArrival();
  tickYouthAcademy();
  tickSelecaoAuto();
  if (learnedPositions && learnedPositions.length) {
    alert(t('posTrainingLearnedAlert', {list: learnedPositions.join(', ')}));
  }
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
      // Quem jogou junto entrosa um pouco mais (ver bumpChemistryForXV) —
      // convocações avulsas não contam, não fazem parte do elenco persistente.
      const persistentXV = pendingMyXV.filter(p => !p.meta.emergencyCallUp);
      bumpChemistryForXV(persistentXV);
      tickMotivationDrift(new Set(persistentXV.map(p => p.id)));
    }
    state.lastMatch[key] = {ids: pendingMyXV.map(p => p.id), roundsElapsed: roundsElapsedAtPlay, progress: progressAtPlay, venue};
  }

  afterRoundAdvance(c);
  maybeTriggerCopaArgentina(key, c);
  pendingMatchResult = null;
  pendingMyXV = null;
  currentView = 'dashboard';
  saveState();
  render();
}

state = loadState();
if (state) {
  setRecruitedPlayers(state.recruitedPlayers || []);
  // Saves anteriores à criação de um novo destaque da M18 (ver
  // curatedM18Players em realSquads.js) não ganham o destaque sozinhos — a
  // academia só é gerada uma vez, no início de uma partida nova. Encaixa
  // aqui, no carregamento, e salva de novo se algo mudou.
  if (state.youthAcademy) {
    const patchedAcademy = ensureCuratedYouthPlayers(state.youthAcademy);
    if (patchedAcademy !== state.youthAcademy) {
      state.youthAcademy = patchedAcademy;
      saveState();
    }
  }
}
render();
