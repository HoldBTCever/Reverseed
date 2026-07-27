import {LEAGUES, TEAMS, generateSquad, teamOverall, leagueOfTeam, SKILL_LABELS, SKILL_CATEGORIES, SKILL_PROFILES, TRAITS, POSITIONS} from './data.js';
import {simulateMatch, TACTICS} from './engine.js';
import {MatchRenderer, renderFormationHtml} from './render.js';
import {generateFixture, initialStandings, applyResult, sortedStandings, firstKnockoutRound, nextKnockoutRound, knockoutStageName} from './fixtures.js';
import {NEA_SEED_MATCHES} from './seedNea.js';
import {getRealRoster, pickStartingXV, rosterWithStatus, getStaff, getStaffQuality, getDualPartner, conditionMultiplier} from './realSquads.js';

const SAVE_KEY = 'rugbyNeaSave_v7';

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

// Condição física atual do jogador (0-100), recuperada "sob demanda" a partir
// da condição registrada logo após sua última partida (state.playerCondition)
// e do tempo de jogo global (state.globalTick) que passou desde então — cada
// rodada finalizada em QUALQUER competição do clube avança o relógio em 1.
// Jogadores com mais resistência/determinação se recuperam mais rápido.
function currentConditionOf(player) {
  const rec = state.playerCondition[player.id];
  if (!rec) return 100;
  const elapsed = state.globalTick - rec.atTick;
  if (elapsed <= 0) return Math.max(0, Math.min(100, rec.condition));
  const recoveryRate = 14 + player.skills.stamina * 0.14 + player.skills.determination * 0.08;
  return Math.min(100, rec.condition + recoveryRate * elapsed);
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
    globalTick: 0, // relógio global (1 por rodada finalizada, em qualquer competição) usado pra recuperação de condição
    playerCondition: {}, // {[playerId]: {condition, atTick}} — condição registrada logo após a última partida do jogador
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
  if (!confirm('Tem certeza que quer começar um novo jogo? O progresso atual será perdido.')) return;
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

function comp(key) {
  return state.competitions[key || state.activeCompetition];
}

function competitionLabel(key) {
  const league = LEAGUES.find(l => l.id === key);
  return league ? league.name : key;
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
    return round ? `Rodada ${round.round}` : null;
  }
  if (c.stage === 'groups') {
    const idx = c.currentRoundIndex;
    const r = c.groupFixtures.A[idx] || c.groupFixtures.B[idx];
    return r ? `Fase de Grupos — Rodada ${idx + 1}` : null;
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
    return `${months} ${months > 1 ? 'meses' : 'mês'}`;
  }
  return `${weeks} semana${weeks > 1 ? 's' : ''}`;
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
    state.playerCondition[p.id] = {condition: Math.max(15, current - fatigue), atTick: state.globalTick};
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
  c.knockoutRounds = [{name: knockoutStageName(matches.length), matches}];
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
  c.knockoutRounds = [{name: knockoutStageName(matches.length), matches}];
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
    c.knockoutRounds.push({name: knockoutStageName(next.length), matches: next});
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
    c.knockoutRounds.push({name: knockoutStageName(next.length), matches: next});
  }
  autoResolveIfEliminated(c);
}

// Texto de status mostrado no painel/tabela quando não há mais tabela de
// pontos corridos pra indicar posição (fase de mata-mata).
function knockoutStatusLabel(c) {
  const rounds = c.knockoutRounds;
  const appeared = rounds.some(r => r.matches.some(m => m.home === c.teamId || m.away === c.teamId));
  if (!appeared) return 'Não se classificou para o mata-mata';
  const last = rounds[rounds.length - 1];
  const stillInLast = last.matches.some(m => m.home === c.teamId || m.away === c.teamId);
  // Só é campeão/vice quem de fato chegou à última fase gerada (a final);
  // quem caiu antes disso está simplesmente eliminado, mesmo que não seja
  // o campeão dessa última fase.
  if (!stillInLast) return 'Eliminado';
  if (last.matches.length === 1 && last.matches[0].played) {
    const final = last.matches[0];
    const championId = final.scoreHome > final.scoreAway ? final.home : final.away;
    return championId === c.teamId ? 'Campeão! 🏆' : 'Vice-campeão';
  }
  return last.name;
}

function competitionStatusLabel(c) {
  if (c.stage === 'league') {
    const rows = sortedStandings(c.standings);
    const pos = rows.findIndex(r => r.teamId === c.teamId) + 1;
    return `${pos}º lugar`;
  }
  if (c.stage === 'groups') {
    const g = c.groupOf[c.teamId];
    const rows = sortedStandings(c.groupStandings[g]);
    const pos = rows.findIndex(r => r.teamId === c.teamId) + 1;
    return `${pos}º no Grupo ${g}`;
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
    <h1>🏉 Escolha seu time</h1>
    <p class="muted">Selecione o clube que você vai comandar como manager. Você disputa o campeonato do seu país, junto com os outros clubes da mesma liga, e acompanha as partidas ao vivo na quadra. Alguns clubes disputam duas ligas ao mesmo tempo.</p>
    <div id="leagueSections"></div>
  `;
  const sections = document.getElementById('leagueSections');
  LEAGUES.forEach(league => {
    const section = document.createElement('div');
    section.className = 'card';
    section.innerHTML = `<h2>${league.name} <span class="muted">— ${league.country}</span></h2>`;
    const grid = document.createElement('div');
    grid.className = 'teamGrid';
    league.teams.forEach(team => {
      const card = document.createElement('div');
      card.className = 'teamCard';
      const dual = getDualPartner(team.id);
      card.innerHTML = `
        <div class="teamCrest" style="background:${team.color}">${crestCode(team)}</div>
        <div class="teamName">${team.name}</div>
        <div class="teamStats">Ataque ${team.attack} · Defesa ${team.defense} · Físico ${team.stamina}</div>
        ${dual ? '<div class="teamStats muted">Disputa duas ligas</div>' : ''}
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
        <th class="teamCol">Time</th><th>PJ</th><th>V</th><th>E</th><th>D</th><th>PF</th><th>PC</th><th>DIF</th><th>Pts</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const t = teamById[r.teamId];
          const mine = r.teamId === mineId;
          return `<tr class="${mine ? 'myTeamRow' : ''}">
            <td class="teamCol">${t.name}</td>
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
    <h3>Mata-mata</h3>
    ${c.knockoutRounds.map(r => `
      <div class="roundBlock card">
        <div class="roundTitle">${r.name}</div>
        ${r.matches.map(m => {
          const home = teamById[m.home];
          const away = teamById[m.away];
          const mine = m.home === c.teamId || m.away === c.teamId;
          return `<div class="matchRow${mine ? ' mine' : ''}">
            <span class="teams">${home.name} <span class="muted">vs</span> ${away.name}</span>
            ${m.played ? `<span class="score">${m.scoreHome} - ${m.scoreAway}</span>` : `<span class="pending">a definir</span>`}
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
        <p><b>${roundName}</b> — ${isHome ? 'em casa' : 'fora'} contra <b>${opp.name}</b></p>
        <button class="playBtn goMatchdayBtn" data-comp="${key}">Preparar partida</button>
      `;
    } else if (c.stage === 'knockout') {
      matchHtml = `<p class="muted">${status}</p>`;
    } else {
      matchHtml = `<p class="muted">Temporada encerrada! Confira a tabela final.</p>`;
    }

    return `
      <div class="card">
        <h3>${competitionLabel(key)} <span class="muted">— ${status}</span></h3>
        ${matchHtml}
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <h1>Painel — ${myTeam.name}</h1>
    ${keys.length > 1 ? `<p class="muted">O ${myTeam.name} disputa duas competições ao mesmo tempo — fique de olho nas duas agendas e reveze o elenco quando os jogos coincidirem.</p>` : ''}
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
      <div class="card"><h3>Grupo A</h3>${renderTableHtml(sortedStandings(c.groupStandings.A), c.teamId)}</div>
      <div class="card"><h3>Grupo B</h3>${renderTableHtml(sortedStandings(c.groupStandings.B), c.teamId)}</div>
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
    <h1>Tabela de Classificação</h1>
    ${keys.map(key => renderCompetitionStandingsBlock(state.competitions[key])).join('')}
  `;
}

function renderRoundRobinInto(list, fixture, c) {
  fixture.forEach(round => {
    const block = document.createElement('div');
    block.className = 'roundBlock card';
    const isCurrent = c.stage !== 'knockout' && round.round === (c.currentRoundIndex + 1);
    block.innerHTML = `<div class="roundTitle">Rodada ${round.round}${isCurrent ? ' (atual)' : ''}</div>`;
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
          : `<span class="pending">a definir</span>`}
      `;
      block.appendChild(row);
    });
    list.appendChild(block);
  });
}

function renderFixture() {
  const keys = Object.keys(state.competitions);
  content.innerHTML = `
    <h1>Fixture — Turno e Returno</h1>
    ${keys.map(key => `<h2>${competitionLabel(key)}</h2><div id="fixtureList-${key}"></div>`).join('')}
  `;
  keys.forEach(key => {
    const c = state.competitions[key];
    const list = document.getElementById(`fixtureList-${key}`);
    if (c.fixture) {
      renderRoundRobinInto(list, c.fixture, c);
    } else if (c.groupFixtures) {
      const titleA = document.createElement('h3'); titleA.textContent = 'Grupo A';
      list.appendChild(titleA);
      renderRoundRobinInto(list, c.groupFixtures.A, c);
      const titleB = document.createElement('h3'); titleB.textContent = 'Grupo B';
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
  return `<td title="Média ${category}"><span class="ratingBar"><span style="width:${avg}%"></span></span>${avg}</td>`;
}

function traitsHtml(meta) {
  if (!meta.traits || !meta.traits.length) return '';
  return meta.traits.map(t => `<span title="${TRAITS[t] ? TRAITS[t].label : t}">${TRAIT_ICON[t] || '★'}</span>`).join(' ');
}

// Painel expandido com a nota individual de cada um dos 22 atributos,
// agrupados por categoria — aberto ao clicar na linha do jogador.
function skillDetailHtml(p, colspan, dipEnabled) {
  const groupHtml = category => `
    <div class="skillDetailGroup">
      <h4>${category[0].toUpperCase()}${category.slice(1)}</h4>
      ${SKILL_CATEGORIES[category].map(k => `
        <div class="skillDetailRow">
          <span class="skillDetailLabel" title="${SKILL_LABELS[k]}">${SKILL_SHORT[k]}</span>
          ${skillCell(p.skills[k])}
        </div>
      `).join('')}
    </div>
  `;
  const dipHtml = dipEnabled && p.skills.determination >= 75 ? `
    <div class="skillDetailGroup">
      <h4>Treino individual (DIP)</h4>
      <div class="skillDetailRow">
        <span class="skillDetailLabel">Foco</span>
        <select class="dipSelect" data-player="${p.id}">
          <option value="">Nenhum (só treino de clube)</option>
          ${SKILL_KEYS.map(k => `<option value="${k}" ${state.dipTraining[p.id] === k ? 'selected' : ''}>${SKILL_LABELS[k]}</option>`).join('')}
        </select>
      </div>
      <div class="skillDetailRow"><span class="muted" style="font-size:11px">Determinação ≥75 libera treino individual intensivo: evolui garantido no atributo escolhido, mais rápido que o treino de clube, à custa de bem mais desgaste físico.</span></div>
    </div>
  ` : '';
  return `
    <tr class="skillDetailTr">
      <td colspan="${colspan}">
        <div class="skillDetailWrap">
          ${Object.keys(SKILL_CATEGORIES).map(groupHtml).join('')}
          <div class="skillDetailGroup">
            <h4>Biometria</h4>
            <div class="skillDetailRow"><span class="skillDetailLabel">Altura</span> ${p.heightCm ? `${p.heightCm} cm` : '—'}</div>
            <div class="skillDetailRow"><span class="skillDetailLabel">Peso</span> ${p.weightKg ? `${p.weightKg} kg` : '—'}</div>
            ${p.meta.traits && p.meta.traits.length ? `<div class="skillDetailRow"><span class="skillDetailLabel">Traits</span> ${p.meta.traits.map(t => `${TRAIT_ICON[t] || '★'} ${TRAITS[t] ? TRAITS[t].label : t}`).join(', ')}</div>` : ''}
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
  return `<td class="${cls}" title="Condição física: ${v}%"><span class="ratingBar"><span style="width:${v}%"></span></span>${v}%</td>`;
}

function metaBadges(meta) {
  const parts = [];
  if (meta.nationalTeam) parts.push(meta.nationalTeam);
  if (meta.age) parts.push(`${meta.age} anos`);
  if (meta.potential) parts.push(`potencial ${meta.potential}`);
  if (meta.dynamicInjury) parts.push('lesão por fadiga');
  if (meta.note) parts.push(meta.note);
  return parts.join(' · ');
}

function statusCell(p) {
  if (p.status === 'lesionado') return `<span style="color:var(--accent-2)">Lesionado (${p.meta.injuryLabel})</span>`;
  if (p.status === 'indisponivel') return '<span style="color:var(--accent-2)">Indisponível (compromisso simultâneo)</span>';
  if (p.status === 'titular') return `<b>Titular #${p.number}</b>`;
  return '<span class="muted">Reserva</span>';
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
      <td class="teamCol">▸ ${p.name}${p.meta.nickname ? ` <span class="muted">"${p.meta.nickname}"</span>` : ''}${p.meta.captain ? ' <b>(C)</b>' : ''}${p.meta.emergencyCallUp ? ' <span class="muted">(convocação de emergência)</span>' : ''} ${traitsHtml(p.meta)}</td>
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
      <th>Status</th><th class="teamCol">Jogador</th><th>Posição</th><th>Overall</th><th>Condição</th>
      <th title="Técnico: ${SKILL_CATEGORIES.técnico.map(k => SKILL_LABELS[k]).join(', ')}">Técnico</th>
      <th title="Mental: ${SKILL_CATEGORIES.mental.map(k => SKILL_LABELS[k]).join(', ')}">Mental</th>
      <th title="Físico: ${SKILL_CATEGORIES.físico.map(k => SKILL_LABELS[k]).join(', ')}">Físico</th>
      <th>Bio</th>
      <th>Obs</th>
    </tr>
  `;
  const staff = getStaff(state.myTeamId);
  const staffHtml = staff ? `
    <div class="card">
      <h3>Comissão técnica</h3>
      <table>
        <tbody>
          ${staff.map(s => `<tr><td class="teamCol">${s.role}</td><td class="teamCol"><b>${s.name}</b>${s.note ? ` <span class="muted">— ${s.note}</span>` : ''}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  content.innerHTML = `
    <h1>Elenco — ${myTeam.name}</h1>
    ${renderFormationHtml(xv, bench, myTeam.color, 'Escalação titular atual')}
    <p class="muted">Técnico, Mental e Físico são médias de categoria — clique num jogador pra ver os 22 atributos individuais, biometria e traits.</p>
    <p class="muted">Pilares e hooker são especialistas de primeira línea: se faltarem, o clube precisa convocar às pressas um juvenil de 18 anos em vez de improvisar com outro jogador.</p>
    <p class="muted">A condição cai após cada partida (mais para quem tem menos resistência) e se recupera com o tempo; jogadores muito desgastados rendem menos e correm mais risco de lesão.</p>
    <p class="muted">O clube treina segunda, terça e quinta: fadiga leve a cada rodada, mas evolução gradual dos atributos ao longo da temporada. Jogadores com determinação ≥75 podem escolher treino individual intensivo (DIP) num atributo específico, clicando no jogador — evolui mais rápido ali, com mais desgaste físico.</p>
    <div class="card">
      <div class="squadHeaderRow">
        <h3>Plantel completo <span class="muted">(${rows.length} jogadores — titulares em destaque)</span></h3>
        <div class="sortToggle" id="squadSortToggle">
          <button class="sortBtn" data-sort="overall">Por overall</button>
          <button class="sortBtn" data-sort="position">Por posição</button>
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
      <th>#</th><th class="teamCol">Jogador</th><th>Posição</th><th>Overall</th>
      <th>Técnico</th><th>Mental</th><th>Físico</th><th>Bio</th>
    </tr>
  `;
  content.innerHTML = `
    <h1>Elenco — ${myTeam.name}</h1>
    ${renderFormationHtml(players, [], myTeam.color, 'Escalação titular')}
    <p class="muted">Técnico, Mental e Físico são médias de categoria — clique num jogador pra ver os 22 atributos individuais.</p>
    <div class="card">
      <h3>Forwards <span class="muted">(overall ${teamOverall(players, 'forward')})</span></h3>
      <div class="tableScroll"><table class="squadTable"><thead>${headHtml}</thead>
      <tbody>${forwards.map(rowHtml).join('')}</tbody></table></div>
    </div>
    <div class="card">
      <h3>Backs <span class="muted">(overall ${teamOverall(players, 'back')})</span></h3>
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
        <h3>Escalar manualmente</h3>
        <div class="sortToggle">
          <button class="sortBtn" id="lineupAutoBtn">Auto-preencher</button>
          <button class="sortBtn" id="lineupSaveABtn">Salvar Time A</button>
          <button class="sortBtn" id="lineupLoadABtn">Usar Time A</button>
          <button class="sortBtn" id="lineupSaveBBtn">Salvar Time B</button>
          <button class="sortBtn" id="lineupLoadBBtn">Usar Time B</button>
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
                  <select disabled><option>— Convocação de emergência (juvenil) —</option></select>
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
                <optgroup label="Especialistas">${specialists.map(optHtml).join('')}</optgroup>
                <optgroup label="Mesma linha">${sameGroup.map(optHtml).join('')}</optgroup>
                <optgroup label="Outras posições">${rest.map(optHtml).join('')}</optgroup>
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
    ? '<p class="muted">⚠️ Alguns jogadores estão indisponíveis hoje: já entraram em campo na outra competição no mesmo dia, em local diferente.</p>'
    : (doubleHeaderIds.size ? '<p class="muted">⚠️ Jogo duplo no mesmo dia e local: parte do time já jogou mais cedo e entra em campo mais desgastada.</p>' : '');

  content.innerHTML = `
    <h1>Dia de jogo — ${competitionLabel(key)} — ${roundName}</h1>
    <div class="card">
      <h3>${isHome ? `${myTeam.name} (casa) vs ${opp.name} (visitante)` : `${opp.name} (casa) vs ${myTeam.name} (visitante)`}</h3>
      <p class="muted">Ataque ${opp.attack} · Defesa ${opp.defense} · Físico ${opp.stamina}</p>
      ${c.stage === 'knockout' ? '<p class="muted">Mata-mata: em caso de empate, a partida vai para a prorrogação até sair um vencedor.</p>' : ''}
      ${clashNote}
      <h3>Escolha sua tática</h3>
      <div class="tacticOptions" id="tacticOptions">
        <button class="tacticBtn" data-t="agresivo"><b>Agresivo</b><span>+ataque, -defesa</span></button>
        <button class="tacticBtn" data-t="equilibrado"><b>Equilibrado</b><span>sem alterações</span></button>
        <button class="tacticBtn" data-t="defensivo"><b>Defensivo</b><span>+defesa, -ataque</span></button>
      </div>
      <button class="playBtn" id="startMatchBtn">Começar partida</button>
    </div>
    ${renderFormationHtml(effectiveXV, bench, myTeam.color, 'Escalação para hoje')}
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
      alert('Escalação salva como Time A.');
    });
    document.getElementById('lineupSaveBBtn').addEventListener('click', () => {
      state.lineupPresets[c.teamId] = state.lineupPresets[c.teamId] || {};
      state.lineupPresets[c.teamId].B = [...manualSlots];
      saveState();
      alert('Escalação salva como Time B.');
    });
    document.getElementById('lineupLoadABtn').addEventListener('click', () => {
      const preset = state.lineupPresets[c.teamId] && state.lineupPresets[c.teamId].A;
      if (!preset) { alert('Time A ainda não foi salvo.'); return; }
      manualSlots = [...preset];
      renderMatchday();
    });
    document.getElementById('lineupLoadBBtn').addEventListener('click', () => {
      const preset = state.lineupPresets[c.teamId] && state.lineupPresets[c.teamId].B;
      if (!preset) { alert('Time B ainda não foi salvo.'); return; }
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
        <button class="ctrlBtn active" id="playPauseBtn">⏸ Pausar</button>
        <button class="ctrlBtn" data-speed="1">1x</button>
        <button class="ctrlBtn" data-speed="2">2x</button>
        <button class="ctrlBtn" data-speed="4">4x</button>
        <button class="ctrlBtn" id="skipBtn">Adiantar até o final ⏭</button>
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
    e.target.textContent = playing ? '⏸ Pausar' : '▶ Continuar';
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
    : '<p class="muted">Sem tries.</p>';

  modal.innerHTML = `
    <div class="summaryBox">
      <h2>Fim de jogo</h2>
      <div class="finalScore">${homeTeam.name} ${result.scoreA} - ${result.scoreB} ${awayTeam.name}</div>
      ${result.wentToTiebreak ? '<p class="muted">Decidido na prorrogação — mata-mata não permite empate.</p>' : ''}
      <h3>Tries ${homeTeam.name}</h3>
      ${scorersHtml(result.scorersA)}
      <h3>Tries ${awayTeam.name}</h3>
      ${scorersHtml(result.scorersB)}
      ${result.motm ? `<p><b>Craque da partida:</b> ${result.motm}</p>` : ''}
      <div class="center"><button class="playBtn" id="continueBtn">Continuar</button></div>
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

  // O tempo passa globalmente (recuperação de condição e alta de lesões de
  // todo o elenco) e registra o desgaste específico de quem entrou em campo
  // nesta rodada.
  state.globalTick++;
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
        state.playerCondition[p.id] = {condition: postMatch, atTick: state.globalTick};
        const injury = rollFatigueInjury(p, postMatch);
        if (injury) {
          state.playerOverrides[p.id] = {...(state.playerOverrides[p.id] || {}), ...injury};
          fatigueInjuries.push(p.name);
        }
      });
      if (fatigueInjuries.length) {
        alert(`Lesão por fadiga: ${fatigueInjuries.join(', ')} não vai poder jogar por um tempo — o desgaste acumulado cobrou o preço.`);
      }
    }
    state.lastMatch[key] = {ids: pendingMyXV.map(p => p.id), roundsElapsed: roundsElapsedAtPlay, venue};
  }

  c.currentRoundIndex++;
  c.roundsElapsed++;
  afterRoundAdvance(c);
  pendingMatchResult = null;
  pendingMyXV = null;
  currentView = 'dashboard';
  saveState();
  render();
}

state = loadState();
render();
