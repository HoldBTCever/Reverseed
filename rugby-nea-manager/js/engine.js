// Motor de simulação de partida de rugby (15 a side, 80 minutos).

import {teamOverall} from './data.js';

const TACTICS = {
  agresivo: {attackMod: 1.12, defenseMod: 0.90, label: 'Agresivo'},
  equilibrado: {attackMod: 1.0, defenseMod: 1.0, label: 'Equilibrado'},
  defensivo: {attackMod: 0.90, defenseMod: 1.12, label: 'Defensivo'},
};

export {TACTICS};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function teamStrength(team, players, tacticKey) {
  const tactic = TACTICS[tacticKey] || TACTICS.equilibrado;
  const forwardsAtk = teamOverall(players, 'forward');
  const backsAtk = teamOverall(players, 'back');
  const squadAttack = forwardsAtk * 0.4 + backsAtk * 0.6;
  const squadDefense = forwardsAtk * 0.55 + backsAtk * 0.45;
  return {
    attack: (team.attack * 0.5 + squadAttack * 0.5) * tactic.attackMod,
    defense: (team.defense * 0.5 + squadDefense * 0.5) * tactic.defenseMod,
    tacticLabel: tactic.label,
  };
}

function bestKicker(players) {
  const candidates = players.filter(p => p.posId === 'AP' || p.posId === 'FB');
  const pool = candidates.length ? candidates : players;
  return pool.reduce((best, p) => (p.rating > best.rating ? p : best), pool[0]);
}

export function simulateMatch(teamA, playersA, tacticA, teamB, playersB, tacticB) {
  const sA = teamStrength(teamA, playersA, tacticA);
  const sB = teamStrength(teamB, playersB, tacticB);
  const kickerA = bestKicker(playersA);
  const kickerB = bestKicker(playersB);

  let pos = 50; // 0 = try-line de A (perigo p/ A), 100 = try-line de B (perigo p/ B)
  let scoreA = 0;
  let scoreB = 0;
  let cardPenaltyA = 0; // ticks restantes de desvantagem por cartão
  let cardPenaltyB = 0;

  const ticks = [];
  const log = [];
  const scorersA = [];
  const scorersB = [];
  const cards = [];

  const TOTAL_TICKS = 40; // 2 min por tick = 80 min

  function addLog(minute, text) {
    log.push({minute, text});
  }

  addLog(0, `Comienza el partido en cancha: ${teamA.name} vs ${teamB.name}.`);

  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    const minute = tick * 2;

    if (tick === 21) {
      addLog(40, `Descanso. Resultado parcial: ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
    }

    if (cardPenaltyA > 0) cardPenaltyA--;
    if (cardPenaltyB > 0) cardPenaltyB--;

    const effAttackA = sA.attack * (cardPenaltyA > 0 ? 0.82 : 1);
    const effDefenseA = sA.defense * (cardPenaltyA > 0 ? 0.82 : 1);
    const effAttackB = sB.attack * (cardPenaltyB > 0 ? 0.82 : 1);
    const effDefenseB = sB.defense * (cardPenaltyB > 0 ? 0.82 : 1);

    let push = ((effAttackA - effDefenseB) - (effAttackB - effDefenseA)) * 0.14;
    push += rand(-9, 9);

    if (Math.random() < 0.06) {
      push += pick([-1, 1]) * rand(15, 26); // quiebre / turnover brusco
      addLog(minute, push > 0 ? `${teamA.name} rompe la línea y avanza fuerte.` : `${teamB.name} recupera y avanza fuerte.`);
    }

    pos = Math.max(0, Math.min(100, pos + push));

    let eventHandled = false;

    // Tarjeta amarilla (poco frecuente)
    if (!eventHandled && Math.random() < 0.012) {
      const toA = Math.random() < 0.5;
      const team = toA ? teamA : teamB;
      const players = toA ? playersA : playersB;
      const player = pick(players.filter(p => p.group === 'forward'));
      if (toA) cardPenaltyA = 5; else cardPenaltyB = 5;
      cards.push({minute, team: team.name, player: player.name});
      addLog(minute, `Tarjeta amarilla para ${player.name} (${team.name}). 10 minutos afuera.`);
      eventHandled = true;
    }

    // Try
    if (!eventHandled && pos >= 94 && Math.random() < 0.35) {
      const scorer = pick(playersA.filter(p => p.group === 'back'));
      scoreA += 5;
      scorersA.push({minute, player: scorer.name});
      addLog(minute, `¡TRY de ${teamA.name}! Anota ${scorer.name}.`);
      if (Math.random() < (kickerA.rating / 100) * 0.9) {
        scoreA += 2;
        addLog(minute, `${kickerA.name} convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `${kickerA.name} falla la conversión.`);
      }
      pos = 50;
      eventHandled = true;
    } else if (!eventHandled && pos <= 6 && Math.random() < 0.35) {
      const scorer = pick(playersB.filter(p => p.group === 'back'));
      scoreB += 5;
      scorersB.push({minute, player: scorer.name});
      addLog(minute, `¡TRY de ${teamB.name}! Anota ${scorer.name}.`);
      if (Math.random() < (kickerB.rating / 100) * 0.9) {
        scoreB += 2;
        addLog(minute, `${kickerB.name} convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `${kickerB.name} falla la conversión.`);
      }
      pos = 50;
      eventHandled = true;
    }

    // Penal
    if (!eventHandled && pos >= 72 && pos < 94 && Math.random() < 0.08) {
      if (Math.random() < (kickerA.rating / 100) * 0.85) {
        scoreA += 3;
        addLog(minute, `Penal para ${teamA.name}. ${kickerA.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `Penal para ${teamA.name}, pero ${kickerA.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
    } else if (!eventHandled && pos <= 28 && pos > 6 && Math.random() < 0.08) {
      if (Math.random() < (kickerB.rating / 100) * 0.85) {
        scoreB += 3;
        addLog(minute, `Penal para ${teamB.name}. ${kickerB.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `Penal para ${teamB.name}, pero ${kickerB.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
    }

    // Drop goal ocasional
    if (!eventHandled && pos >= 60 && pos < 80 && Math.random() < 0.015) {
      scoreA += 3;
      addLog(minute, `¡Drop de ${kickerA.name}! ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      pos = 50;
      eventHandled = true;
    } else if (!eventHandled && pos <= 40 && pos > 20 && Math.random() < 0.015) {
      scoreB += 3;
      addLog(minute, `¡Drop de ${kickerB.name}! ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      pos = 50;
      eventHandled = true;
    }

    ticks.push({minute, pos, scoreA, scoreB});
  }

  addLog(80, `Final del partido: ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);

  let motm = null;
  if (scoreA !== scoreB) {
    const winnerPlayers = scoreA > scoreB ? playersA : playersB;
    motm = winnerPlayers.reduce((best, p) => (p.rating > best.rating ? p : best), winnerPlayers[0]);
  }

  return {
    teamA: teamA.name,
    teamB: teamB.name,
    scoreA,
    scoreB,
    ticks,
    log,
    scorersA,
    scorersB,
    cards,
    motm: motm ? motm.name : null,
  };
}
