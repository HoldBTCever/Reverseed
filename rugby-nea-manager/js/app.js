import {LEAGUES, TEAMS, generateSquad, teamOverall, leagueOfTeam, SKILL_LABELS, SKILL_CATEGORIES, SKILL_PROFILES, TRAITS, POSITIONS, teamIdentity} from './data.js';
import {simulateMatch, TACTICS, ZONE_KEYS, ZONE_STYLES, PLAY_SYSTEMS, PLAY_CODES, zoneForPos, defaultGamePlan} from './engine.js';
import {MatchRenderer, renderFormationHtml, renderBenchSectionHtml, FORMATION_POSITIONS} from './render.js';
import {generateFixture, initialStandings, applyResult, sortedStandings, firstKnockoutRound, nextKnockoutRound, knockoutStageName} from './fixtures.js';
import {NEA_SEED_MATCHES} from './seedNea.js';
import {getRealRoster, pickStartingXV, rosterWithStatus, getStaff, getStaffQuality, getDualPartner, conditionMultiplier, getParaguaySquad, setRecruitedPlayers, YOUTH_CATEGORIES, YOUTH_CATEGORY_TOTAL_SIZE, createInitialYouthAcademy, advanceYouthAcademy} from './realSquads.js';

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
  {id: 'NT-URU', name: 'Uruguay', color: '#0038A8', attack: 85, defense: 84, stamina: 82},
  {id: 'NT-CHI', name: 'Chile', color: '#D52B1E', attack: 83, defense: 82, stamina: 81},
  {id: 'NT-BRA', name: 'Brasil', color: '#009739', attack: 74, defense: 73, stamina: 76},
  {id: 'NT-PER', name: 'Perú', color: '#D91023', attack: 68, defense: 66, stamina: 70},
  {id: 'NT-COL', name: 'Colombia', color: '#FCD116', attack: 65, defense: 64, stamina: 68},
];

const SAVE_KEY = 'rugbyNeaSave_v15';

// Clubes menores do Paraguaio (procedurais, sem elenco curado) de onde o
// Curda pode captar promessas reveladas (ver tickScouting).
const SMALL_PARAGUAY_TEAM_IDS = ['PAR-STC', 'PAR-LUQ', 'PAR-ASU', 'PAR-VHA', 'PAR-CRI', 'PAR-FDM'];

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
      red: {style: 'chute', code: 'AVIÓN/TORMENTA/T1'},
      orange: {style: 'chute', code: 'TORMENTA/T1/BOMBA'},
      green: {style: 'forwards', code: 'IRLANDA/BURRO'},
      yellow: {style: 'forwards', code: 'SUDAFRICA'},
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
      red: {style: 'chute', code: ''},
      orange: {style: 'equilibrado', code: ''},
      green: {style: zoneStyle, code: ''},
      yellow: {style: zoneStyle, code: ''},
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
    positionGroup: '{pos}º — {label}',
    standingsTitle: 'Tabla de Posiciones',
    roundLabel: 'Fecha {n}',
    groupPhaseRound: 'Fase de {term} — Fecha {n}',
    currentSuffix: ' (actual)',
    fixtureTitle: 'Fixture — Ida y Vuelta',
    dipTitle: 'Entrenamiento individual (DIP)',
    focusLabel: 'Foco',
    noneClubTraining: 'Ninguno (solo entrenamiento de club)',
    dipHelp: 'Determinación ≥75 habilita entrenamiento individual intensivo: mejora garantizada en el atributo elegido, más rápido que el entrenamiento de club, a costa de mucho más desgaste físico.',
    trainingFocusTitle: 'Foco de entrenamiento de la semana',
    trainingFocusHelp: 'Elegí hasta 3 atributos por día de entrenamiento — el entrenamiento pasivo del plantel prioriza esos atributos (siempre respetando la posición de cada jugador). Sin nada marcado, vuelve al sorteo automático.',
    trainSeg: 'Lunes',
    trainTer: 'Martes',
    trainQui: 'Jueves',
    trainLivre: 'Libre (automático)',
    navTatica: 'Táctica',
    taticaTitle: 'Táctica — {team}',
    taticaHelp: 'Definí el plan de juego por zona del campo, igual que el "tablero de mando territorial" que usan los clubes de verdad: cada zona tiene un estilo propio, que se aplica en la simulación en vivo (y se ve en la franja de colores arriba de la cancha, con el código de la jugada activa).',
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
    selecaoTitle: 'Selección Paraguay',
    selecaoHelp: 'Convocatoria armada con los mejores jugadores disponibles de Curda y San José, respetando la posición de cada uno.',
    selecaoNachoNote: '⚠️ Ignacio "Nacho" Cuevas (Curda) es el mejor jugador del país, pero rechaza las convocatorias de la selección para mantenerse fiel solo al Curda — nunca aparece acá.',
    selecaoEscalacao: 'Formación titular',
    selecaoConvocados: 'Convocados',
    selecaoColClube: 'Club',
    selecaoAcoesTitle: 'Amistosos y torneos',
    gerarAmistoso: 'Amistoso aleatorio',
    gerarTorneio: 'Torneo aleatorio (4 selecciones)',
    selecaoHistoricoTitle: 'Historial',
    selecaoSemHistorico: 'Todavía no se jugó ningún partido de la selección.',
    selecaoColPartida: 'Partido',
    selecaoColResultado: 'Resultado',
    selecaoColTipo: 'Tipo',
    selecaoTorneioLinha: 'Torneo aleatorio',
    selecaoAmistosoLabel: 'Amistoso',
    selecaoTorneioResumo: 'Campeón: {champion}',
    selecaoVoltar: 'Volver a la Selección',
    selecaoTorneioTitle: '🏆 Resultado del torneo',
    selecaoSemifinal: 'Semifinal',
    selecaoFinal: 'Final',
    captacaoTitle: 'Captación de promesas',
    captacaoHelp: 'De vez en cuando aparece una promesa revelada en un club chico del Paraguayo, lista para ser invitada al Curda — el jugador decide si acepta o no.',
    captacaoVazio: 'Ninguna promesa disponible por ahora. Volvé a mirar después de la próxima fecha.',
    captacaoColOrigem: 'Club de origen',
    captacaoConvidar: 'Invitar',
    captacaoAceitou: '¡{name} aceptó la invitación y se sumó al Curda!',
    captacaoRecusou: '{name} rechazó la invitación — prefirió seguir en el {club}.',
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
    lineupClickHelp: 'Hacé clic en una camiseta del campo para elegir quién juega ahí. Pilar y hooker solo muestran especialistas de esa posición exacta (sin improvisar); las demás posiciones muestran primero quien juega ahí, y abajo el resto del plantel disponible.',
    fecharSeletor: 'Cerrar selector',
    subsBtnLabel: '🔄 Sustituciones ({used}/{max})',
    subsPanelTitle: 'Sustituciones ({used}/{max})',
    subsPickOut: 'Elegí quién sale',
    subsPickIn: 'Elegí quién entra por {name}',
    subsNoneLeft: 'Ya usaste las {max} sustituciones disponibles.',
    subsBankEmpty: 'No hay suplentes disponibles para esa posición.',
    subChangeLog: 'Cambio en {team}: entra {in}, sale {out}.',
    medBloodLog: '🩸 Corte en {player} ({team}): sale al bloodbin, entra {in} de forma temporal.',
    medHiaLog: '🏥 Golpe en la cabeza de {player} ({team}): va a la evaluación HIA, entra {in} de forma temporal.',
    medHiaFailLog: '⛔ {player} ({team}) no pasó la evaluación HIA y no vuelve más a la cancha.',
    medReturnLog: '✅ {player} ({team}) vuelve a la cancha.',
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
    positionGroup: '{pos}º — {label}',
    standingsTitle: 'Tabela de Classificação',
    roundLabel: 'Rodada {n}',
    groupPhaseRound: 'Fase de {term} — Rodada {n}',
    currentSuffix: ' (atual)',
    fixtureTitle: 'Fixture — Turno e Returno',
    dipTitle: 'Treino individual (DIP)',
    focusLabel: 'Foco',
    noneClubTraining: 'Nenhum (só treino de clube)',
    dipHelp: 'Determinação ≥75 libera treino individual intensivo: evolui garantido no atributo escolhido, mais rápido que o treino de clube, à custa de bem mais desgaste físico.',
    trainingFocusTitle: 'Foco de treino da semana',
    trainingFocusHelp: 'Escolha até 3 atributos por dia de treino — o treino passivo do plantel prioriza esses atributos (ainda respeitando a posição de cada jogador). Sem nada marcado, volta pro sorteio automático.',
    trainSeg: 'Segunda',
    trainTer: 'Terça',
    trainQui: 'Quinta',
    trainLivre: 'Livre (automático)',
    navTatica: 'Tática',
    taticaTitle: 'Tática — {team}',
    taticaHelp: 'Defina o plano de jogo por zona do campo, igual ao "tablero de mando territorial" que os clubes de verdade usam: cada zona tem um estilo próprio, aplicado na simulação ao vivo (e visível na faixa colorida acima do campo, com o código da jogada em vigor).',
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
    selecaoTitle: 'Seleção Paraguay',
    selecaoHelp: 'Convocação montada com os melhores jogadores disponíveis do Curda e do San José, respeitando a posição de cada um.',
    selecaoNachoNote: '⚠️ Ignacio "Nacho" Cuevas (Curda) é o melhor jogador do país, mas recusa convocações da seleção pra se manter fiel só ao Curda — nunca aparece aqui.',
    selecaoEscalacao: 'Formação titular',
    selecaoConvocados: 'Convocados',
    selecaoColClube: 'Clube',
    selecaoAcoesTitle: 'Amistosos e torneios',
    gerarAmistoso: 'Amistoso aleatório',
    gerarTorneio: 'Torneio aleatório (4 seleções)',
    selecaoHistoricoTitle: 'Histórico',
    selecaoSemHistorico: 'Ainda não rolou nenhuma partida da seleção.',
    selecaoColPartida: 'Partida',
    selecaoColResultado: 'Resultado',
    selecaoColTipo: 'Tipo',
    selecaoTorneioLinha: 'Torneio aleatório',
    selecaoAmistosoLabel: 'Amistoso',
    selecaoTorneioResumo: 'Campeão: {champion}',
    selecaoVoltar: 'Voltar pra Seleção',
    selecaoTorneioTitle: '🏆 Resultado do torneio',
    selecaoSemifinal: 'Semifinal',
    selecaoFinal: 'Final',
    captacaoTitle: 'Captação de promessas',
    captacaoHelp: 'De vez em quando surge uma promessa revelada num clube menor do Paraguaio, pronta pra ser convidada pro Curda — o jogador decide se aceita ou não.',
    captacaoVazio: 'Nenhuma promessa disponível por enquanto. Volte a olhar depois da próxima rodada.',
    captacaoColOrigem: 'Clube de origem',
    captacaoConvidar: 'Convidar',
    captacaoAceitou: '{name} aceitou o convite e se juntou ao Curda!',
    captacaoRecusou: '{name} recusou o convite — preferiu continuar no {club}.',
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
    lineupClickHelp: 'Clique numa camisa do campo pra escolher quem joga ali. Pilar e hooker só mostram especialistas daquela posição exata (sem improviso); as demais posições mostram primeiro quem joga ali, e embaixo o resto do plantel disponível.',
    fecharSeletor: 'Fechar seletor',
    subsBtnLabel: '🔄 Substituições ({used}/{max})',
    subsPanelTitle: 'Substituições ({used}/{max})',
    subsPickOut: 'Escolha quem sai',
    subsPickIn: 'Escolha quem entra no lugar de {name}',
    subsNoneLeft: 'Você já usou as {max} substituições disponíveis.',
    subsBankEmpty: 'Não tem reserva disponível pra essa posição.',
    subChangeLog: 'Substituição no {team}: entra {in}, sai {out}.',
    medBloodLog: '🩸 Corte em {player} ({team}): sai pro sangue, entra {in} temporariamente.',
    medHiaLog: '🏥 Pancada na cabeça de {player} ({team}): vai fazer avaliação de HIA, entra {in} temporariamente.',
    medHiaFailLog: '⛔ {player} ({team}) não passou na avaliação de HIA e não volta mais pro jogo.',
    medReturnLog: '✅ {player} ({team}) volta pro jogo.',
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
  const agendaBtn = mainNav.querySelector('[data-view="agenda"]');
  const standingsBtn = mainNav.querySelector('[data-view="standings"]');
  const fixtureBtn = mainNav.querySelector('[data-view="fixture"]');
  const squadBtn = mainNav.querySelector('[data-view="squad"]');
  const tacticsBtn = mainNav.querySelector('[data-view="tactics"]');
  const selectionBtn = mainNav.querySelector('[data-view="selection"]');
  if (dashboardBtn) dashboardBtn.textContent = t('navPainel');
  if (agendaBtn) agendaBtn.textContent = t('navAgenda');
  if (standingsBtn) standingsBtn.textContent = t('navTabela');
  if (fixtureBtn) fixtureBtn.textContent = t('navFixture');
  if (squadBtn) squadBtn.textContent = t('navElenco');
  if (tacticsBtn) tacticsBtn.textContent = t('navTatica');
  if (selectionBtn) selectionBtn.textContent = t('navSelecao');
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

// Identidade de clube (cores duplas ou triplas, mascote, apelido — ver
// TEAM_IDENTITY em data.js): crest em faixas diagonais via CSS puro (sem
// imagem/arte nova) e mascote em emoji no lugar do código de 3 letras quando
// existe.
function crestStyle(team) {
  const identity = teamIdentity(team.id);
  if (!identity) return `background:${team.color}`;
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
  if (identity && identity.mascotEmoji) return identity.mascotEmoji;
  if (identity && identity.initials) return identity.initials;
  return crestCode(team);
}
// Linha com apelido/mascote do clube (quando documentado) pra mostrar junto
// do nome do time — ex.: "El Tractor Amarillo" · 🦉 La Lechuza.
function teamIdentityLine(team) {
  const identity = teamIdentity(team.id);
  if (!identity) return '';
  const parts = [];
  if (identity.nickname) {
    const nick = identity.nickname[lang] || identity.nickname.es;
    parts.push(`«${escapeHtmlAttr(nick)}»`);
  }
  if (identity.mascotName) {
    const mascot = identity.mascotName[lang] || identity.mascotName.es;
    parts.push(`${identity.mascotEmoji || ''} ${escapeHtmlAttr(mascot)}`.trim());
  }
  return parts.length ? `<div class="teamIdentityLine muted">${parts.join(' · ')}</div>` : '';
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
let openLineupSlot = null; // índice (0-14) do slot com o seletor de jogador aberto no campo clicável, ou null se fechado

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
    trainingFocus: {seg: [], ter: [], qui: []}, // até 3 skillKeys escolhidos pelo técnico pra cada dia de treino do clube
    gamePlan: (myTeamId === 'ARG-CUR' || myTeamId === 'PAR-CUR') ? curdaDefaultGamePlan() : defaultGamePlan(), // plano de jogo por zona de campo (ver tela de Tática)
    gamePlanPdfs: [], // [{id, name, size, uploadedAt}] — metadados dos PDFs táticos enviados (conteúdo binário fica no IndexedDB, ver pdfStore)
    nationalTeamMatches: [], // histórico de amistosos/torneios da Seleção Paraguay (ver renderSelection)
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
  // Foco de treino da semana escolhido pelo técnico pra segunda/terça/quinta
  // (até 3 atributos por dia — ver renderTrainingFocusHtml). Dias sem foco
  // definido não entram no pool, então o treino passivo cai pro sorteio livre
  // de sempre se o técnico não escolheu nada específico pra nenhum dos três dias.
  const focusPool = Object.values(state.trainingFocus || {}).flat().filter(Boolean);
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
        growSkill(p.id, p.skills, weightedRandomSkill(p.posId, focusPool), Math.max(1, Math.round(quality)));
      }
    }
    const current = currentConditionOf(p);
    state.playerCondition[p.id] = {condition: Math.max(15, current - fatigue), atDay: currentCalendarDay()};
  });
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
  if (accepted) {
    state.recruitedPlayers = state.recruitedPlayers || [];
    state.recruitedPlayers.push({
      ...prospect,
      meta: {...prospect.meta, note: `Contratado do ${prospect.meta.scoutedFrom}; ${prospect.meta.note}`},
    });
    setRecruitedPlayers(state.recruitedPlayers);
    saveState();
    alert(t('captacaoAceitou', {name: prospect.name}));
  } else {
    saveState();
    alert(t('captacaoRecusou', {name: prospect.name, club: prospect.meta.scoutedFrom}));
  }
  renderRealSquad();
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

function renderYouthAcademyHtml() {
  const academy = state.youthAcademy || createInitialYouthAcademy();
  return `
    <div class="card">
      <h3>${t('baseTitle')}</h3>
      <p class="muted">${t('baseHelp')}</p>
      <div class="youthGrid">
        ${YOUTH_CATEGORIES.map(cat => `
          <div class="youthCategoryCol">
            <div class="youthCategoryLabel">${cat} <span class="muted">(${academy[cat].length} de ${YOUTH_CATEGORY_TOTAL_SIZE}+)</span></div>
            ${academy[cat].map(p => `
              <div class="youthPlayerRow" title="${escapeHtmlAttr(p.name)} — ${p.position}">
                <span class="youthPlayerName">${escapeHtmlAttr(p.name)}</span>
                <span class="muted">${p.position.slice(0, 3)} · ${p.rating}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
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
    startKnockoutFromLeague(c);
  } else if (c.stage === 'groups') {
    const maxLen = Math.max(...Object.values(c.groupFixtures).map(f => f.length));
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
    return t('positionGroup', {pos, label: groupDisplayName(c, g)});
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
  else if (currentView === 'agenda') renderAgenda();
  else if (currentView === 'standings') renderStandings();
  else if (currentView === 'fixture') renderFixture();
  else if (currentView === 'squad') renderSquad();
  else if (currentView === 'tactics') renderTactics();
  else if (currentView === 'selection') renderSelection();
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
        <div class="teamCrest" style="${crestStyle(team)}">${crestContent(team)}</div>
        <div class="teamName">${team.name}</div>
        ${teamIdentityLine(team)}
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
  if (!key) return [];
  return (state.trainingFocus && state.trainingFocus[key]) || [];
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
        const focus = trainingFocusForWeekday(d);
        extraHtml = `<div class="agendaTrainingBadge">${t('agendaTreino')}${focus.length ? `: ${focus.map(k => skillLabel(k)).join(', ')}` : ''}</div>`;
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
        ${teamIdentityLine(myTeam)}
      </div>
    </div>
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
      Object.keys(c.groupFixtures).forEach(g => {
        const title = document.createElement('h3'); title.textContent = groupDisplayName(c, g);
        list.appendChild(title);
        renderRoundRobinInto(list, c.groupFixtures[g], c);
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

// Posições alternativas do jogador (meta.altPos) — mostradas como um "tb."
// (também) discreto ao lado do posto principal, pra ficar visível que ele
// pode ser escalado noutro posto (ver canPlay/pickStartingXV).
function altPosHtml(meta) {
  if (!meta.altPos || !meta.altPos.length) return '';
  return ` <span class="muted altPosBadge" title="${t('altPosTitle')}">(${t('altPosPrefix')} ${meta.altPos.map(id => POS_LABEL[id]).join('/')})</span>`;
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

// Foco de treino do clube pra segunda/terça/quinta, escolhido pelo técnico:
// cada dia pode ficar sem nenhum foco (sorteio automático, comportamento
// padrão) ou travado em até 3 atributos, deixando o treino passivo do
// plantel (fora do DIP individual) mais direcionado — ver tickTraining.
function renderTrainingFocusHtml() {
  const focus = state.trainingFocus || {seg: [], ter: [], qui: []};
  const dayLabel = {seg: t('trainSeg'), ter: t('trainTer'), qui: t('trainQui')};
  const dayColumnHtml = day => {
    const selected = focus[day] || [];
    const optionsHtml = Object.keys(SKILL_CATEGORIES).map(cat => `
      <div class="trainingFocusCatLabel">${cat[0].toUpperCase()}${cat.slice(1)}</div>
      ${SKILL_CATEGORIES[cat].map(k => `
        <label class="trainingFocusOption">
          <input type="checkbox" class="trainingFocusCheck" data-day="${day}" value="${k}"
            ${selected.includes(k) ? 'checked' : ''}
            ${!selected.includes(k) && selected.length >= 3 ? 'disabled' : ''} />
          ${skillLabel(k)}
        </label>
      `).join('')}
    `).join('');
    return `
      <div class="trainingFocusDayCol">
        <div class="trainingFocusDayLabel">${dayLabel[day]} <span class="muted">(${selected.length}/3)</span></div>
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
      <td class="posCol">${p.position}${altPosHtml(p.meta)}</td>
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
  const isCurda = state.myTeamId === 'ARG-CUR' || state.myTeamId === 'PAR-CUR';
  const scoutingHtml = isCurda ? renderScoutingHtml() : '';
  const youthHtml = isCurda ? renderYouthAcademyHtml() : '';

  content.innerHTML = `
    <h1>${t('elencoTitle', {team: myTeam.name})}</h1>
    ${renderFormationHtml(xv, bench, myTeam.color, t('escalacaoAtual'))}
    <p class="muted">${t('explicacaoCategorias')}</p>
    <p class="muted">${t('explicacaoPrimeiraLinea')}</p>
    <p class="muted">${t('explicacaoCondicao')}</p>
    <p class="muted">${t('explicacaoTreino')}</p>
    ${renderTrainingFocusHtml()}
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

  Array.from(document.querySelectorAll('.trainingFocusCheck')).forEach(cb => {
    cb.addEventListener('change', () => {
      state.trainingFocus = state.trainingFocus || {seg: [], ter: [], qui: []};
      const day = cb.dataset.day;
      const arr = state.trainingFocus[day] || [];
      if (cb.checked) {
        if (arr.length >= 3) { cb.checked = false; return; }
        state.trainingFocus[day] = [...arr, cb.value];
      } else {
        state.trainingFocus[day] = arr.filter(k => k !== cb.value);
      }
      saveState();
      renderRealSquad();
    });
  });

  Array.from(document.querySelectorAll('[data-invite]')).forEach(btn => {
    btn.addEventListener('click', () => inviteProspect(btn.dataset.invite));
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
const FRONT_ROW_POS = new Set(['PI', 'HK']);

// Verdadeiro se o jogador pode ocupar essa posição: a dele mesmo, ou uma
// posição alternativa listada em meta.altPos (jogadores que a observação de
// scout diz que "também jogam" ali).
function canPlay(p, posId) {
  return p.posId === posId || (p.meta.altPos && p.meta.altPos.includes(posId));
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
function renderLineupEditorHtml(teamId, myOptions, teamColor, bench) {
  const eligible = manualEligiblePlayers(teamId, myOptions);
  const byId = Object.fromEntries(eligible.map(p => [p.id, p]));

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
      <button type="button" class="shirtSlot lineupShirtBtn${openClass}" data-slot="${idx}" style="top:${pos.top}; left:${pos.left};" title="${escapeHtmlAttr(titleAttr)}">
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
    const specialists = eligible.filter(p => canPlay(p, posId));
    const outros = FRONT_ROW_POS.has(posId) ? [] : eligible.filter(p => !canPlay(p, posId));
    const playerRow = p => `
      <button type="button" class="lineupPickBtn ${p.id === currentId ? 'selected' : ''}" data-pick="${p.id}">
        <span>${escapeHtmlAttr(p.name)}${p.posId !== posId ? ' ⇄' : ''}</span>
        <span class="muted">${p.rating} · ${Math.round(p.condition)}%</span>
      </button>
    `;
    pickerHtml = `
      <div class="lineupPicker">
        <h4>#${idx + 1} ${POS_LABEL[posId]}</h4>
        ${!specialists.length ? `<p class="muted">${t('convocacaoEmergencia')}</p>` : `
          <div class="lineupPickGroupLabel">${t('especialistas')}</div>
          <div class="lineupPickList">${specialists.map(playerRow).join('')}</div>
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
      <p class="muted">${t('lineupClickHelp')}</p>
      <div class="pitchOuter">
        <div class="pitchLine" style="top:0"></div>
        <div class="pitchLine" style="top:22%"></div>
        <div class="pitchLine solid" style="top:50%"></div>
        <div class="pitchLine" style="top:78%"></div>
        <div class="pitchLine" style="top:100%"></div>
        ${shirts}
      </div>
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

function ensureGamePlan() {
  if (!state.gamePlan) state.gamePlan = defaultGamePlan();
  if (!state.gamePlan.system) state.gamePlan.system = 'ninguno';
  if (state.gamePlan.pillars.defesa == null) state.gamePlan.pillars.defesa = 50;
  if (!state.gamePlanPdfs) state.gamePlanPdfs = [];
  return state.gamePlan;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    <div class="zoneGrid">
      ${ZONE_KEYS.map(z => `
        <div class="zoneCard" style="border-top: 4px solid ${ZONE_COLORS[z]}">
          <h3>${t(ZONE_LABEL_KEY[z])}</h3>
          <label class="zoneFieldLabel">${t('estiloDeJogo')}</label>
          <select class="zoneStyleSelect" data-zone="${z}">
            ${Object.keys(ZONE_STYLES).map(s => `<option value="${s}" ${plan.zones[z].style === s ? 'selected' : ''}>${t(ZONE_STYLE_LABEL_KEY[s])}</option>`).join('')}
          </select>
          <label class="zoneFieldLabel">${t('codigoComunicacao')}</label>
          <input type="text" class="zoneCodeInput" list="playCodesList" data-zone="${z}" maxlength="24" value="${escapeHtmlAttr(plan.zones[z].code)}" placeholder="${t('codigoPlaceholder')}" />
        </div>
      `).join('')}
      <datalist id="playCodesList">
        ${PLAY_CODES.map(c => `<option value="${c}"></option>`).join('')}
      </datalist>
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
  Array.from(document.querySelectorAll('.zoneStyleSelect')).forEach(sel => {
    sel.addEventListener('change', () => {
      ensureGamePlan().zones[sel.dataset.zone].style = sel.value;
      saveState();
    });
  });
  Array.from(document.querySelectorAll('.zoneCodeInput')).forEach(inp => {
    inp.addEventListener('input', () => {
      ensureGamePlan().zones[inp.dataset.zone].code = inp.value;
      saveState();
    });
  });
  Array.from(document.querySelectorAll('.pillarSlider')).forEach(sl => {
    sl.addEventListener('input', () => {
      ensureGamePlan().pillars[sl.dataset.pillar] = Number(sl.value);
      document.querySelector(`.pillarVal[data-pillar-val="${sl.dataset.pillar}"]`).textContent = sl.value;
      saveState();
    });
  });
  document.getElementById('resetGamePlanBtn').addEventListener('click', () => {
    state.gamePlan = defaultGamePlan();
    saveState();
    renderTactics();
  });
  const loadCurdaBtn = document.getElementById('loadCurdaPlanBtn');
  if (loadCurdaBtn) {
    loadCurdaBtn.addEventListener('click', () => {
      state.gamePlan = curdaDefaultGamePlan();
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

// ---- Tela de Seleção: elenco do Paraguay + amistosos/torneios aleatórios --
function renderSelection() {
  state.nationalTeamMatches = state.nationalTeamMatches || [];
  const {xv, bench} = getParaguaySquad();
  const history = state.nationalTeamMatches.slice().reverse().slice(0, 12);

  const rosterRows = [
    ...xv.map(p => ({...p, status: 'titular'})),
    ...bench,
  ];

  content.innerHTML = `
    <h1>${t('selecaoTitle')}</h1>
    <p class="muted">${t('selecaoHelp')}</p>
    <p class="muted">${t('selecaoNachoNote')}</p>
    ${renderFormationHtml(xv, bench, PARAGUAY_TEAM.color, t('selecaoEscalacao'))}
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
      <h3>${t('selecaoAcoesTitle')}</h3>
      <div class="tacticaBtnRow">
        <button class="playBtn" id="randomFriendlyBtn">${t('gerarAmistoso')}</button>
        <button class="playBtn" id="randomTournamentBtn">${t('gerarTorneio')}</button>
      </div>
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

  document.getElementById('randomFriendlyBtn').addEventListener('click', () => {
    const opponent = NATIONAL_TEAMS[Math.floor(Math.random() * NATIONAL_TEAMS.length)];
    renderNationalFriendlyLive(opponent);
  });
  document.getElementById('randomTournamentBtn').addEventListener('click', runRandomTournament);
}

// Amistoso ao vivo da Seleção, com a mesma animação 2D usada nas partidas de
// clube — mas autocontido (não mexe em currentView/competições).
function renderNationalFriendlyLive(opponent) {
  const {xv: paraguaySquad} = getParaguaySquad();
  const opponentSquad = generateSquad(opponent);
  const result = simulateMatch(PARAGUAY_TEAM, paraguaySquad, 'equilibrado', opponent, opponentSquad, 'equilibrado');

  content.innerHTML = `
    <div id="matchWrap">
      <div id="scoreboard">
        <div class="side"><span class="crestSmall" style="${crestStyle(PARAGUAY_TEAM)}">${crestContent(PARAGUAY_TEAM)}</span>${PARAGUAY_TEAM.name}</div>
        <div class="center">
          <div class="clock" id="clockEl">0'</div>
          <div class="scoreNum"><span id="scoreHomeEl">0</span> - <span id="scoreAwayEl">0</span></div>
        </div>
        <div class="side">${opponent.name}<span class="crestSmall" style="${crestStyle(opponent)}">${crestContent(opponent)}</span></div>
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
      <div id="nationalFriendlyDone" class="card" style="display:none">
        <h3>${t('fimDeJogo')}</h3>
        <p class="finalScoreSmall"></p>
        <button class="playBtn" id="backToSelectionBtn">${t('selecaoVoltar')}</button>
      </div>
    </div>
  `;

  const canvas = document.getElementById('pitch');
  const renderer = new MatchRenderer(canvas, PARAGUAY_TEAM, opponent);
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
    if (logByMinute[minute]) logByMinute[minute].forEach(txt => pushLog(minute, txt));
  }

  applyMinute(0);

  function finish() {
    playing = false;
    matchAnim = null;
    state.nationalTeamMatches = state.nationalTeamMatches || [];
    state.nationalTeamMatches.push({
      opponent: opponent.name,
      scorePY: result.scoreA,
      scoreOpp: result.scoreB,
      label: t('selecaoAmistosoLabel'),
    });
    saveState();
    const doneCard = document.getElementById('nationalFriendlyDone');
    doneCard.style.display = '';
    doneCard.querySelector('.finalScoreSmall').textContent = `${PARAGUAY_TEAM.name} ${result.scoreA} - ${result.scoreB} ${opponent.name}`;
    document.getElementById('backToSelectionBtn').addEventListener('click', renderSelection);
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
        const tk = ticks[tickIndex - 1];
        applyMinute(tk.minute);
        scoreHomeEl.textContent = tk.scoreA;
        scoreAwayEl.textContent = tk.scoreB;
        clockEl.textContent = tk.minute + "'";
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

// Torneio aleatório: Paraguay + 3 seleções sorteadas, mata-mata instantâneo
// (semis + final, sem animação ao vivo — só o resultado de cada jogo).
function runRandomTournament() {
  const shuffled = [...NATIONAL_TEAMS].sort(() => Math.random() - 0.5).slice(0, 3);
  const teams = [PARAGUAY_TEAM, ...shuffled].sort(() => Math.random() - 0.5);
  const {xv: paraguaySquad} = getParaguaySquad();
  const squadCacheLocal = {};
  const squadFor = team => {
    if (team.id === PARAGUAY_TEAM.id) return paraguaySquad;
    if (!squadCacheLocal[team.id]) squadCacheLocal[team.id] = generateSquad(team);
    return squadCacheLocal[team.id];
  };

  function playInstant(teamA, teamB) {
    const r = simulateMatch(teamA, squadFor(teamA), 'equilibrado', teamB, squadFor(teamB), 'equilibrado');
    let scoreA = r.scoreA;
    let scoreB = r.scoreB;
    if (scoreA === scoreB) {
      const [a, b] = breakTie(scoreA, scoreB);
      scoreA = a; scoreB = b;
    }
    return {teamA, teamB, scoreA, scoreB, winner: scoreA > scoreB ? teamA : teamB};
  }

  const semi1 = playInstant(teams[0], teams[1]);
  const semi2 = playInstant(teams[2], teams[3]);
  const final = playInstant(semi1.winner, semi2.winner);

  state.nationalTeamMatches = state.nationalTeamMatches || [];
  state.nationalTeamMatches.push({
    isTournament: true,
    label: t('selecaoTorneioResumo', {champion: final.winner.name}),
    bracket: {semi1, semi2, final},
  });
  saveState();

  showTournamentSummary({semi1, semi2, final});
}

function showTournamentSummary(bracket) {
  const matchLine = m => `${m.teamA.name} ${m.scoreA} - ${m.scoreB} ${m.teamB.name}`;
  const modal = document.createElement('div');
  modal.className = 'summaryModal';
  modal.innerHTML = `
    <div class="summaryBox">
      <h2>${t('selecaoTorneioTitle')}</h2>
      <p><b>${t('selecaoSemifinal')} 1:</b> ${matchLine(bracket.semi1)}</p>
      <p><b>${t('selecaoSemifinal')} 2:</b> ${matchLine(bracket.semi2)}</p>
      <p><b>${t('selecaoFinal')}:</b> ${matchLine(bracket.final)}</p>
      <p class="finalScore">🏆 ${escapeHtmlAttr(bracket.final.winner.name)}</p>
      <button class="playBtn" id="closeTournamentBtn">${t('continuar')}</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('closeTournamentBtn').addEventListener('click', () => {
    modal.remove();
    renderSelection();
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
    ${isRealRoster ? '' : renderFormationHtml(effectiveXV, bench, myTeam.color, t('escalacaoHoje'))}
    ${isRealRoster ? renderLineupEditorHtml(c.teamId, myOptions, myTeam.color, bench) : ''}
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
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.slot);
        openLineupSlot = openLineupSlot === idx ? null : idx;
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
        renderMatchday();
      });
    });
    const closePickerBtn = document.getElementById('closeLineupPickerBtn');
    if (closePickerBtn) {
      closePickerBtn.addEventListener('click', () => {
        openLineupSlot = null;
        renderMatchday();
      });
    }
    document.getElementById('lineupAutoBtn').addEventListener('click', () => {
      manualSlots = slotsFromXV(autoXV);
      openLineupSlot = null;
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

  // Substituições ao vivo: só faz sentido pra times com elenco real (curado),
  // que têm banco de reservas — times procedurais só têm os 15 gerados. Até
  // 8 trocas por partida (regra real do rugby); quem sai não volta a entrar.
  const myRosterReal = !!getRealRoster(c.teamId);
  const myBench = myRosterReal ? rosterWithStatus(c.teamId, myOptions).filter(p => p.status === 'reserva') : [];
  const MAX_SUBS = 8;
  let subsUsed = 0;
  let subOutSelected = null; // id do titular em campo escolhido pra sair
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

  const result = simulateMatch(
    homeTeam, homeSquad, tacticHome,
    awayTeam, awaySquad, tacticAway,
    gamePlanHome, gamePlanAway,
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
        <div class="side"><span class="crestSmall" style="${crestStyle(homeTeam)}">${crestContent(homeTeam)}</span>${homeTeam.name}</div>
        <div class="center">
          <div class="clock" id="clockEl">0'</div>
          <div class="scoreNum"><span id="scoreHomeEl">0</span> - <span id="scoreAwayEl">0</span></div>
        </div>
        <div class="side">${awayTeam.name}<span class="crestSmall" style="${crestStyle(awayTeam)}">${crestContent(awayTeam)}</span></div>
      </div>
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
      accum += dt * speed;
      const msPerTick = baseMsPerTick;
      while (accum >= msPerTick && tickIndex < ticks.length) {
        accum -= msPerTick;
        tickIndex++;
        const t = ticks[tickIndex - 1];
        applyMinute(t.minute);
        handleMedicalTickEvents();
        scoreHomeEl.textContent = ticks[tickIndex - 1].scoreA;
        scoreAwayEl.textContent = ticks[tickIndex - 1].scoreB;
        clockEl.textContent = t.minute + "'";
      }
      const curr = ticks[Math.min(tickIndex, ticks.length - 1)] || {pos: 50};
      const prev = ticks[Math.max(tickIndex - 1, 0)] || {pos: 50};
      const frac = Math.min(1, accum / baseMsPerTick);
      const interpPos = prev.pos + (curr.pos - prev.pos) * frac;
      renderer.draw(interpPos, scoreHomeEl.textContent, scoreAwayEl.textContent, clockEl.textContent);
      updateTacticalBanner(interpPos);
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
      handleMedicalTickEvents();
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
    };
  }

  // Troca genérica num dos dois lados (usada tanto pela substituição manual
  // quanto pelos eventos médicos automáticos abaixo): recalcula o "futuro" da
  // partida via resumeState e funde o resultado no que já está em tela.
  function performLiveSub(squadArr, outId, inPlayer, logText) {
    const idx = squadArr.findIndex(p => p.id === outId);
    if (idx === -1) return null;
    const outPlayer = squadArr[idx];
    const newPlayer = {...inPlayer, posId: outPlayer.posId, position: outPlayer.position, group: outPlayer.group, number: outPlayer.number};
    squadArr[idx] = newPlayer;

    const resumeState = currentResumeState();
    const newSegment = simulateMatch(
      homeTeam, homeSquad, tacticHome,
      awayTeam, awaySquad, tacticAway,
      gamePlanHome, gamePlanAway,
      resumeState,
    );
    const currentMinute = resumeState.tick * 2;

    ticks = ticks.slice(0, tickIndex).concat(newSegment.ticks);
    result.ticks = ticks;
    Object.keys(logByMinute).forEach(m => { if (Number(m) > currentMinute) delete logByMinute[m]; });
    newSegment.log.forEach(l => {
      if (!logByMinute[l.minute]) logByMinute[l.minute] = [];
      logByMinute[l.minute].push(l.text);
    });
    if (logText) {
      if (!logByMinute[currentMinute]) logByMinute[currentMinute] = [];
      logByMinute[currentMinute].push(logText);
      pushLog(currentMinute, logText);
    }

    result.scorersA = result.scorersA.filter(s => s.minute <= currentMinute).concat(newSegment.scorersA);
    result.scorersB = result.scorersB.filter(s => s.minute <= currentMinute).concat(newSegment.scorersB);
    result.cards = result.cards.filter(cd => cd.minute <= currentMinute).concat(newSegment.cards);
    const lastTick = ticks[ticks.length - 1];
    if (lastTick) { result.scoreA = lastTick.scoreA; result.scoreB = lastTick.scoreB; }
    if (newSegment.motm) result.motm = newSegment.motm;

    return {outPlayer, newPlayer, currentMinute};
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
    return pool.reduce((best, p) => (p.rating > best.rating ? p : best), pool[0]);
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

  const subsBtn = document.getElementById('subsBtn');
  const subsPanelEl = document.getElementById('subsPanel');

  function updateSubsButtonLabel() {
    if (subsBtn) subsBtn.textContent = t('subsBtnLabel', {used: subsUsed, max: MAX_SUBS});
  }

  function renderSubsPanel() {
    if (!subsPanelEl) return;
    if (!subsOpen) { subsPanelEl.innerHTML = ''; return; }

    const availableBench = myBench.filter(p => !subbedOffIds.has(p.id) && !mySquad.some(m => m.id === p.id));
    const onFieldRows = mySquad.map(p => `
      <button type="button" class="lineupPickBtn ${subOutSelected === p.id ? 'selected' : ''}" data-out="${p.id}">
        <span>#${p.number} ${escapeHtmlAttr(p.name)}</span>
        <span class="muted">${p.position}</span>
      </button>
    `).join('');

    let pickInHtml = '';
    if (subOutSelected) {
      const outPlayer = mySquad.find(p => p.id === subOutSelected);
      const posId = outPlayer.posId;
      const specialists = availableBench.filter(p => canPlay(p, posId));
      const outros = FRONT_ROW_POS.has(posId) ? [] : availableBench.filter(p => !canPlay(p, posId));
      const benchRow = p => `
        <button type="button" class="lineupPickBtn" data-in="${p.id}">
          <span>${escapeHtmlAttr(p.name)}${p.posId !== posId ? ' ⇄' : ''}</span>
          <span class="muted">${p.rating} · ${Math.round(p.condition)}%</span>
        </button>
      `;
      pickInHtml = `
        <div class="lineupPickGroupLabel">${t('subsPickIn', {name: outPlayer.name})}</div>
        ${!specialists.length && !outros.length ? `<p class="muted">${t('subsBankEmpty')}</p>` : ''}
        ${specialists.length ? `<div class="lineupPickList">${specialists.map(benchRow).join('')}</div>` : ''}
        ${outros.length ? `<div class="lineupPickGroupLabel">${t('outrasPosicoes')}</div><div class="lineupPickList">${outros.map(benchRow).join('')}</div>` : ''}
      `;
    }

    subsPanelEl.innerHTML = `
      <div class="lineupPicker">
        <h4>${t('subsPanelTitle', {used: subsUsed, max: MAX_SUBS})}</h4>
        ${subsUsed >= MAX_SUBS ? `<p class="muted">${t('subsNoneLeft', {max: MAX_SUBS})}</p>` : `
          <div class="lineupPickGroupLabel">${t('subsPickOut')}</div>
          <div class="lineupPickList">${onFieldRows}</div>
        `}
        ${pickInHtml}
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
    const closeBtn = document.getElementById('closeSubsBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => { subsOpen = false; subOutSelected = null; renderSubsPanel(); });
  }

  if (subsBtn) {
    subsBtn.addEventListener('click', () => {
      subsOpen = !subsOpen;
      subOutSelected = null;
      renderSubsPanel();
    });
  }
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
  tickScouting();
  tickYouthAcademy();
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
if (state) setRecruitedPlayers(state.recruitedPlayers || []);
render();
