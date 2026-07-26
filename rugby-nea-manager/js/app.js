import {LEAGUES, TEAMS, generateSquad, teamOverall, leagueOfTeam, SKILL_LABELS} from './data.js';
import {simulateMatch, TACTICS} from './engine.js';
import {MatchRenderer} from './render.js';
import {generateFixture, initialStandings, applyResult, sortedStandings} from './fixtures.js';
import {NEA_SEED_MATCHES} from './seedNea.js';
import {getRealRoster, pickStartingXV, rosterWithStatus, getStaff, getDualPartner} from './realSquads.js';

const SAVE_KEY = 'rugbyNeaSave_v4';

const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));
function crestCode(team) {
  return team.id.slice(-3);
}
const squadCache = {};
function squadOf(teamId, fatiguedIds) {
  const realRoster = getRealRoster(teamId);
  if (realRoster) return pickStartingXV(realRoster, fatiguedIds);
  if (!squadCache[teamId]) squadCache[teamId] = generateSquad(teamById[teamId]);
  return squadCache[teamId];
}

let state = null;
let matchAnim = null; // controle da partida ao vivo em andamento
let pendingMatchResult = null; // resultado já simulado/exibido da partida do usuário nesta rodada
let pendingMyXVIds = null; // ids da escalação usada na partida em andamento (p/ rodízio por desgaste)

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

function buildCompetition(teamId) {
  const league = leagueOfTeam(teamId);
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

  return {teamId, league: league.id, fixture, standings, currentRoundIndex};
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
    recentXV: {},
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

function currentRound(key) {
  const c = comp(key);
  return c.fixture[c.currentRoundIndex] || null;
}

function myMatchThisRound(key) {
  const c = comp(key);
  const round = currentRound(key);
  if (!round) return null;
  return round.matches.find(m => m.home === c.teamId || m.away === c.teamId) || null;
}

function otherCompetitionKey(key) {
  return Object.keys(state.competitions).find(k => k !== key) || null;
}

// Jogadores que acabaram de jogar a partida mais recente do clube na OUTRA
// competição — sofrem penalidade leve na escalação, incentivando rodízio.
function fatiguedIdsFor(key) {
  const otherKey = otherCompetitionKey(key);
  if (!otherKey) return new Set();
  return new Set(state.recentXV[otherKey] || []);
}

function allRecentXVIds() {
  const ids = [];
  Object.values(state.recentXV || {}).forEach(arr => { if (arr) ids.push(...arr); });
  return new Set(ids);
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

function renderDashboard() {
  const myTeam = teamById[state.myTeamId];
  const keys = Object.keys(state.competitions);

  const cardsHtml = keys.map(key => {
    const c = state.competitions[key];
    const rows = sortedStandings(c.standings);
    const myPos = rows.findIndex(r => r.teamId === c.teamId) + 1;
    const round = currentRound(key);
    const match = myMatchThisRound(key);
    const seasonOver = !round;

    let matchHtml = '';
    if (seasonOver) {
      matchHtml = `<p class="muted">Temporada encerrada! Confira a tabela final.</p>`;
    } else if (match) {
      const oppId = match.home === c.teamId ? match.away : match.home;
      const opp = teamById[oppId];
      const isHome = match.home === c.teamId;
      matchHtml = `
        <p><b>Rodada ${round.round}</b> — ${isHome ? 'em casa' : 'fora'} contra <b>${opp.name}</b></p>
        <button class="playBtn goMatchdayBtn" data-comp="${key}">Preparar partida</button>
      `;
    }

    return `
      <div class="card">
        <h3>${competitionLabel(key)} <span class="muted">— ${myPos}º lugar</span></h3>
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

function renderStandings() {
  const keys = Object.keys(state.competitions);
  content.innerHTML = `
    <h1>Tabela de Classificação</h1>
    ${keys.map(key => {
      const c = state.competitions[key];
      return `<h2>${competitionLabel(key)}</h2><div class="card">${renderTableHtml(sortedStandings(c.standings), c.teamId)}</div>`;
    }).join('')}
  `;
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
    c.fixture.forEach(round => {
      const block = document.createElement('div');
      block.className = 'roundBlock card';
      const isCurrent = round.round === (c.currentRoundIndex + 1);
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
  });
}

const SKILL_KEYS = Object.keys(SKILL_LABELS);
const SKILL_SHORT = {
  pass: 'PAS', reception: 'REC', lineoutThrow: 'LAT', jump: 'SAL',
  tackle: 'TAC', kicking: 'CHU', speed: 'VEL', strength: 'FOR',
};

function skillCell(value) {
  return `<td title="${value}"><span class="ratingBar"><span style="width:${value}%"></span></span>${value}</td>`;
}

function metaBadges(meta) {
  const parts = [];
  if (meta.nationalTeam) parts.push(meta.nationalTeam);
  if (meta.age) parts.push(`${meta.age} anos`);
  if (meta.potential) parts.push(`potencial ${meta.potential}`);
  if (meta.note) parts.push(meta.note);
  return parts.join(' · ');
}

function statusCell(p) {
  if (p.status === 'lesionado') return `<span style="color:var(--accent-2)">Lesionado (${p.meta.injuryLabel})</span>`;
  if (p.status === 'titular') return `<b>Titular #${p.number}</b>`;
  return '<span class="muted">Reserva</span>';
}

function renderRealSquad() {
  const rows = rosterWithStatus(state.myTeamId, allRecentXVIds());
  const rowHtml = p => `
    <tr class="${p.status === 'lesionado' ? 'injuredRow' : ''}">
      <td>${statusCell(p)}</td>
      <td class="teamCol">${p.name}${p.meta.nickname ? ` <span class="muted">"${p.meta.nickname}"</span>` : ''}${p.meta.captain ? ' <b>(C)</b>' : ''}${p.fatigued ? ' <span class="muted">(jogou recentemente)</span>' : ''}</td>
      <td class="posCol">${p.position}</td>
      <td><b>${p.rating}</b></td>
      ${SKILL_KEYS.map(k => skillCell(p.skills[k])).join('')}
      <td class="posCol">${metaBadges(p.meta)}</td>
    </tr>
  `;
  const headHtml = `
    <tr>
      <th>Status</th><th class="teamCol">Jogador</th><th>Posição</th><th>Overall</th>
      ${SKILL_KEYS.map(k => `<th title="${SKILL_LABELS[k]}">${SKILL_SHORT[k]}</th>`).join('')}
      <th>Obs</th>
    </tr>
  `;
  const staff = getStaff(state.myTeamId);
  const staffHtml = staff ? `
    <div class="card">
      <h3>Comissão técnica</h3>
      <table>
        <tbody>
          ${staff.map(s => `<tr><td class="teamCol">${s.role}</td><td class="teamCol"><b>${s.name}</b></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  content.innerHTML = `
    <h1>Elenco — ${teamById[state.myTeamId].name}</h1>
    <p class="muted">PAS Passe · REC Recepção · LAT Lançamento lateral · SAL Salto · TAC Tackle · CHU Chute · VEL Velocidade · FOR Força</p>
    <div class="card">
      <h3>Plantel completo <span class="muted">(${rows.length} jogadores — titulares em destaque)</span></h3>
      <div class="tableScroll"><table class="squadTable"><thead>${headHtml}</thead>
      <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>
    </div>
    ${staffHtml}
  `;
}

function renderSquad() {
  if (getRealRoster(state.myTeamId)) {
    renderRealSquad();
    return;
  }
  const players = squadOf(state.myTeamId);
  const forwards = players.filter(p => p.group === 'forward');
  const backs = players.filter(p => p.group === 'back');
  const rowHtml = p => `
    <tr>
      <td>${p.number}</td>
      <td class="teamCol">${p.name}</td>
      <td class="posCol">${p.position}</td>
      <td><b>${p.rating}</b></td>
      ${SKILL_KEYS.map(k => skillCell(p.skills[k])).join('')}
    </tr>
  `;
  const headHtml = `
    <tr>
      <th>#</th><th class="teamCol">Jogador</th><th>Posição</th><th>Overall</th>
      ${SKILL_KEYS.map(k => `<th title="${SKILL_LABELS[k]}">${SKILL_SHORT[k]}</th>`).join('')}
    </tr>
  `;
  content.innerHTML = `
    <h1>Elenco — ${teamById[state.myTeamId].name}</h1>
    <p class="muted">PAS Passe · REC Recepção · LAT Lançamento lateral · SAL Salto · TAC Tackle · CHU Chute · VEL Velocidade · FOR Força</p>
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

  content.innerHTML = `
    <h1>Dia de jogo — ${competitionLabel(key)} — Rodada ${currentRound(key).round}</h1>
    <div class="card">
      <h3>${isHome ? `${myTeam.name} (casa) vs ${opp.name} (visitante)` : `${opp.name} (casa) vs ${myTeam.name} (visitante)`}</h3>
      <p class="muted">Ataque ${opp.attack} · Defesa ${opp.defense} · Físico ${opp.stamina}</p>
      <h3>Escolha sua tática</h3>
      <div class="tacticOptions" id="tacticOptions">
        <button class="tacticBtn" data-t="agresivo"><b>Agresivo</b><span>+ataque, -defesa</span></button>
        <button class="tacticBtn" data-t="equilibrado"><b>Equilibrado</b><span>sem alterações</span></button>
        <button class="tacticBtn" data-t="defensivo"><b>Defensivo</b><span>+defesa, -ataque</span></button>
      </div>
      <button class="playBtn" id="startMatchBtn">Começar partida</button>
    </div>
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

  // Time do clube gerenciado entra com rodízio: quem jogou há pouco na outra
  // competição sofre penalidade de escalação, abrindo espaço para o banco.
  const fatigued = fatiguedIdsFor(key);
  const homeSquad = homeId === c.teamId ? squadOf(homeId, fatigued) : squadOf(homeId);
  const awaySquad = awayId === c.teamId ? squadOf(awayId, fatigued) : squadOf(awayId);
  pendingMyXVIds = (homeId === c.teamId ? homeSquad : awaySquad).map(p => p.id);

  const result = simulateMatch(
    homeTeam, homeSquad, tacticHome,
    awayTeam, awaySquad, tacticAway,
  );

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
  const round = currentRound(key);
  round.matches.forEach(m => {
    if (m.played) return;
    const home = teamById[m.home];
    const away = teamById[m.away];
    let scoreHome, scoreAway;
    if (m.home === c.teamId || m.away === c.teamId) {
      // Reaproveita o resultado já simulado e exibido ao vivo, para o placar
      // persistido bater exatamente com o que o usuário assistiu na quadra.
      scoreHome = pendingMatchResult.scoreA;
      scoreAway = pendingMatchResult.scoreB;
    } else {
      const r = simulateMatch(home, squadOf(m.home), 'equilibrado', away, squadOf(m.away), 'equilibrado');
      scoreHome = r.scoreA; scoreAway = r.scoreB;
    }
    m.played = true;
    m.scoreHome = scoreHome;
    m.scoreAway = scoreAway;
    applyResult(c.standings, m.home, m.away, scoreHome, scoreAway);
  });
  c.currentRoundIndex++;
  if (pendingMyXVIds) {
    state.recentXV[key] = pendingMyXVIds;
  }
  pendingMatchResult = null;
  pendingMyXVIds = null;
  currentView = 'dashboard';
  saveState();
  render();
}

state = loadState();
render();
