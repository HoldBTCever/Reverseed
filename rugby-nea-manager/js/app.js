import {TEAMS, generateSquad, teamOverall} from './data.js';
import {simulateMatch, TACTICS} from './engine.js';
import {MatchRenderer} from './render.js';
import {generateFixture, initialStandings, applyResult, sortedStandings} from './fixtures.js';

const SAVE_KEY = 'rugbyNeaSave_v1';

const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));
const squadCache = {};
function squadOf(teamId) {
  if (!squadCache[teamId]) squadCache[teamId] = generateSquad(teamById[teamId]);
  return squadCache[teamId];
}

let state = null;
let matchAnim = null; // controle da partida ao vivo em andamento
let pendingMatchResult = null; // resultado já simulado/exibido da partida do usuário nesta rodada

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

function newGame(myTeamId) {
  const ids = TEAMS.map(t => t.id);
  state = {
    myTeamId,
    fixture: generateFixture(ids),
    standings: initialStandings(ids),
    currentRoundIndex: 0,
    tactic: 'equilibrado',
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

function currentRound() {
  return state.fixture[state.currentRoundIndex] || null;
}

function myMatchThisRound() {
  const round = currentRound();
  if (!round) return null;
  return round.matches.find(m => m.home === state.myTeamId || m.away === state.myTeamId) || null;
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
    <h1>🏉 Escolha seu time — Campeonato do Nordeste Argentino</h1>
    <p class="muted">Selecione o clube que você vai comandar como manager. As partidas são simuladas e exibidas ao vivo na quadra.</p>
    <div class="teamGrid" id="teamGrid"></div>
  `;
  const grid = document.getElementById('teamGrid');
  TEAMS.forEach(team => {
    const card = document.createElement('div');
    card.className = 'teamCard';
    card.innerHTML = `
      <div class="teamCrest" style="background:${team.color}">${team.id}</div>
      <div class="teamName">${team.name}</div>
      <div class="teamStats">Ataque ${team.attack} · Defesa ${team.defense} · Físico ${team.stamina}</div>
    `;
    card.addEventListener('click', () => newGame(team.id));
    grid.appendChild(card);
  });
}

function standingsRows() {
  return sortedStandings(state.standings);
}

function renderDashboard() {
  const myTeam = teamById[state.myTeamId];
  const rows = standingsRows();
  const myPos = rows.findIndex(r => r.teamId === state.myTeamId) + 1;
  const round = currentRound();
  const match = myMatchThisRound();
  const seasonOver = !round;

  let matchHtml = '';
  if (seasonOver) {
    matchHtml = `<p class="muted">Temporada encerrada! Confira a tabela final.</p>`;
  } else if (match) {
    const oppId = match.home === state.myTeamId ? match.away : match.home;
    const opp = teamById[oppId];
    const isHome = match.home === state.myTeamId;
    matchHtml = `
      <p><b>Rodada ${round.round}</b> — ${isHome ? 'em casa' : 'fora'} contra <b>${opp.name}</b></p>
      <button class="playBtn" id="goMatchday">Preparar partida</button>
    `;
  }

  content.innerHTML = `
    <h1>Painel — ${myTeam.name}</h1>
    <div class="card">
      <h3>Posição na tabela: ${myPos}º lugar</h3>
      ${matchHtml}
    </div>
    <div class="card">
      <h3>Top 5</h3>
      ${renderTableHtml(rows.slice(0, 5))}
    </div>
  `;
  const goBtn = document.getElementById('goMatchday');
  if (goBtn) goBtn.addEventListener('click', () => { currentView = 'matchday'; render(); });
}

function renderTableHtml(rows) {
  return `
    <table>
      <thead><tr>
        <th class="teamCol">Time</th><th>PJ</th><th>V</th><th>E</th><th>D</th><th>PF</th><th>PC</th><th>DIF</th><th>Pts</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const t = teamById[r.teamId];
          const mine = r.teamId === state.myTeamId;
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

function renderStandings() {
  content.innerHTML = `
    <h1>Tabela de Classificação</h1>
    <div class="card">${renderTableHtml(standingsRows())}</div>
  `;
}

function renderFixture() {
  content.innerHTML = `<h1>Fixture — Turno e Returno</h1><div id="fixtureList"></div>`;
  const list = document.getElementById('fixtureList');
  state.fixture.forEach(round => {
    const block = document.createElement('div');
    block.className = 'roundBlock card';
    const isCurrent = round.round === (state.currentRoundIndex + 1);
    block.innerHTML = `<div class="roundTitle">Rodada ${round.round}${isCurrent ? ' (atual)' : ''}</div>`;
    round.matches.forEach(m => {
      const home = teamById[m.home];
      const away = teamById[m.away];
      const mine = m.home === state.myTeamId || m.away === state.myTeamId;
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

function renderSquad() {
  const players = squadOf(state.myTeamId);
  const forwards = players.filter(p => p.group === 'forward');
  const backs = players.filter(p => p.group === 'back');
  const rowHtml = p => `
    <tr>
      <td>${p.number}</td>
      <td class="teamCol">${p.name}</td>
      <td class="posCol">${p.position}</td>
      <td><span class="ratingBar"><span style="width:${p.rating}%"></span></span>${p.rating}</td>
    </tr>
  `;
  content.innerHTML = `
    <h1>Elenco — ${teamById[state.myTeamId].name}</h1>
    <div class="card">
      <h3>Forwards <span class="muted">(overall ${teamOverall(players, 'forward')})</span></h3>
      <table class="squadTable"><thead><tr><th>#</th><th class="teamCol">Jogador</th><th>Posição</th><th>Rating</th></tr></thead>
      <tbody>${forwards.map(rowHtml).join('')}</tbody></table>
    </div>
    <div class="card">
      <h3>Backs <span class="muted">(overall ${teamOverall(players, 'back')})</span></h3>
      <table class="squadTable"><thead><tr><th>#</th><th class="teamCol">Jogador</th><th>Posição</th><th>Rating</th></tr></thead>
      <tbody>${backs.map(rowHtml).join('')}</tbody></table>
    </div>
  `;
}

function renderMatchday() {
  const match = myMatchThisRound();
  if (!match) { currentView = 'dashboard'; render(); return; }
  const oppId = match.home === state.myTeamId ? match.away : match.home;
  const opp = teamById[oppId];
  const myTeam = teamById[state.myTeamId];
  const isHome = match.home === state.myTeamId;

  content.innerHTML = `
    <h1>Dia de jogo — Rodada ${currentRound().round}</h1>
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
  const match = myMatchThisRound();
  const isHome = match.home === state.myTeamId;
  const homeId = match.home;
  const awayId = match.away;
  const homeTeam = teamById[homeId];
  const awayTeam = teamById[awayId];
  const myTactic = state.tactic;
  const oppTactic = pickOpponentTactic();

  const tacticHome = isHome ? myTactic : oppTactic;
  const tacticAway = isHome ? oppTactic : myTactic;

  const result = simulateMatch(
    homeTeam, squadOf(homeId), tacticHome,
    awayTeam, squadOf(awayId), tacticAway,
  );

  content.innerHTML = `
    <div id="matchWrap">
      <div id="scoreboard">
        <div class="side"><span class="crestSmall" style="background:${homeTeam.color}">${homeTeam.id}</span>${homeTeam.name}</div>
        <div class="center">
          <div class="clock" id="clockEl">0'</div>
          <div class="scoreNum"><span id="scoreHomeEl">0</span> - <span id="scoreAwayEl">0</span></div>
        </div>
        <div class="side">${awayTeam.name}<span class="crestSmall" style="background:${awayTeam.color}">${awayTeam.id}</span></div>
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
  const round = currentRound();
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
  const round = currentRound();
  round.matches.forEach(m => {
    if (m.played) return;
    const home = teamById[m.home];
    const away = teamById[m.away];
    let scoreHome, scoreAway;
    if (m.home === state.myTeamId || m.away === state.myTeamId) {
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
    applyResult(state.standings, m.home, m.away, scoreHome, scoreAway);
  });
  state.currentRoundIndex++;
  pendingMatchResult = null;
  currentView = 'dashboard';
  saveState();
  render();
}

state = loadState();
render();
