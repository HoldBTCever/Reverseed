// Motor de simulação de partida de rugby (15 a side, 80 minutos).

import {teamOverall, teamSkillAvg} from './data.js';

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

function bestBy(players, skillKey, posId) {
  const pool = posId ? players.filter(p => p.posId === posId) : players;
  const source = pool.length ? pool : players;
  return source.reduce((best, p) => (p.skills[skillKey] > best.skills[skillKey] ? p : best), source[0]);
}

function bestByGroup(players, skillKey, group) {
  const pool = players.filter(p => p.group === group);
  const source = pool.length ? pool : players;
  return source.reduce((best, p) => (p.skills[skillKey] > best.skills[skillKey] ? p : best), source[0]);
}

// Qualidade de mão do time concentrada em quem mais toca a bola (9 e 10),
// em vez de uma média diluída entre os 15 jogadores.
function handlingRating(scrumHalf, flyHalf) {
  return scrumHalf.skills.pass * 0.5 + scrumHalf.skills.reception * 0.15
    + flyHalf.skills.pass * 0.25 + flyHalf.skills.reception * 0.10;
}

function handlingErrorChance(handling) {
  return Math.max(0.01, Math.min(0.09, 0.04 - (handling - 65) * 0.0015));
}

// O jogador de pior passe entre 9 e 10 é o mais provável de errar a bola.
function pickHandlingCulprit(scrumHalf, flyHalf) {
  const wSH = Math.pow(100 - scrumHalf.skills.pass, 2) + 1;
  const wFH = Math.pow(100 - flyHalf.skills.pass, 2) + 1;
  return Math.random() * (wSH + wFH) < wSH ? scrumHalf : flyHalf;
}

function breakChance(pace) {
  return Math.max(0.005, Math.min(0.09, 0.035 + (pace - 70) * 0.0018));
}

// Fator de cansaço dentro da própria partida: nos primeiros 40 minutos o time
// joga em plena força; a partir daí perde intensidade progressivamente, mais
// ou menos conforme a resistência média do time (staminaAvg). Times com pouca
// resistência caem bem mais aos 70-80' do que aos 45-50'.
function inMatchFatigueFactor(tick, staminaAvg) {
  if (tick <= 20) return 1;
  const fadeProgress = (tick - 20) / 20; // 0 no intervalo -> 1 aos 80'
  const maxFade = 0.28 * (1 - staminaAvg / 130);
  return 1 - Math.max(0, maxFade) * fadeProgress;
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

export function simulateMatch(teamA, playersA, tacticA, teamB, playersB, tacticB) {
  const sA = teamStrength(teamA, playersA, tacticA);
  const sB = teamStrength(teamB, playersB, tacticB);

  const kickerA = bestBy(playersA, 'kicking', 'AP');
  const kickerB = bestBy(playersB, 'kicking', 'AP');
  const hookerA = bestBy(playersA, 'lineoutThrow', 'HK');
  const hookerB = bestBy(playersB, 'lineoutThrow', 'HK');
  const jumperA = bestBy(playersA, 'jump', 'SL');
  const jumperB = bestBy(playersB, 'jump', 'SL');

  const scrumHalfA = playersA.find(p => p.posId === 'MS');
  const scrumHalfB = playersB.find(p => p.posId === 'MS');
  const flyHalfA = playersA.find(p => p.posId === 'AP');
  const flyHalfB = playersB.find(p => p.posId === 'AP');

  const handlingA = handlingRating(scrumHalfA, flyHalfA);
  const handlingB = handlingRating(scrumHalfB, flyHalfB);
  const handlingErrorA = handlingErrorChance(handlingA);
  const handlingErrorB = handlingErrorChance(handlingB);

  const paceA = teamSkillAvg(playersA, 'speed', 'back');
  const paceB = teamSkillAvg(playersB, 'speed', 'back');
  const fastestBackA = bestByGroup(playersA, 'speed', 'back');
  const fastestBackB = bestByGroup(playersB, 'speed', 'back');

  const staminaAvgA = teamSkillAvg(playersA, 'stamina');
  const staminaAvgB = teamSkillAvg(playersB, 'stamina');

  let pos = 50; // 0 = try-line de A (perigo p/ A), 100 = try-line de B (perigo p/ B)
  let scoreA = 0;
  let scoreB = 0;
  let cardPenaltyA = 0; // ticks restantes de desvantagem por cartão amarelo
  let cardPenaltyB = 0;
  let redCardA = false; // expulso: desvantagem por todo o resto da partida
  let redCardB = false;

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

    const fatigueA = inMatchFatigueFactor(tick, staminaAvgA);
    const fatigueB = inMatchFatigueFactor(tick, staminaAvgB);

    const effAttackA = sA.attack * (cardPenaltyA > 0 ? 0.82 : 1) * (redCardA ? 0.75 : 1) * fatigueA;
    const effDefenseA = sA.defense * (cardPenaltyA > 0 ? 0.82 : 1) * (redCardA ? 0.75 : 1) * fatigueA;
    const effAttackB = sB.attack * (cardPenaltyB > 0 ? 0.82 : 1) * (redCardB ? 0.75 : 1) * fatigueB;
    const effDefenseB = sB.defense * (cardPenaltyB > 0 ? 0.82 : 1) * (redCardB ? 0.75 : 1) * fatigueB;

    let push = ((effAttackA - effDefenseB) - (effAttackB - effDefenseA)) * 0.14;
    push += rand(-9, 9);

    let eventHandled = false;

    // Quiebre de línea, más probable con líneas rápidas (y menos con líneas lentas)
    const breakChanceA = breakChance(paceA);
    const breakChanceB = breakChance(paceB);
    if (Math.random() < breakChanceA) {
      push += rand(15, 26);
      addLog(minute, `¡${fastestBackA.name} rompe la línea con velocidad y avanza para ${teamA.name}!`);
    } else if (Math.random() < breakChanceB) {
      push -= rand(15, 26);
      addLog(minute, `¡${fastestBackB.name} rompe la línea con velocidad y avanza para ${teamB.name}!`);
    }

    // Error de manos: concentrado en el 9 y el 10, que son quienes más tocan la
    // pelota. El cansancio (fatigueA/B < 1 en el segundo tiempo) suma más
    // errores de mano, reflejando peores decisiones con el cuerpo pesado.
    const handlingErrorA_eff = handlingErrorA + (1 - fatigueA) * 0.20;
    const handlingErrorB_eff = handlingErrorB + (1 - fatigueB) * 0.20;
    if (!eventHandled && push > 0 && Math.random() < handlingErrorA_eff) {
      const culprit = pickHandlingCulprit(scrumHalfA, flyHalfA);
      addLog(minute, `Knock-on de ${teamA.name}: a ${culprit.name} se le escapa la pelota en el pase.`);
      push = -rand(4, 10);
      eventHandled = true;
    } else if (!eventHandled && push < 0 && Math.random() < handlingErrorB_eff) {
      const culprit = pickHandlingCulprit(scrumHalfB, flyHalfB);
      addLog(minute, `Knock-on de ${teamB.name}: a ${culprit.name} se le escapa la pelota en el pase.`);
      push = rand(4, 10);
      eventHandled = true;
    }

    // Line-out disputado (lanzamiento vs salto)
    if (!eventHandled && Math.random() < 0.05) {
      const throwingA = Math.random() < 0.5;
      const thrower = throwingA ? hookerA : hookerB;
      const rivalJumper = throwingA ? jumperB : jumperA;
      const throwTeam = throwingA ? teamA : teamB;
      const rivalTeam = throwingA ? teamB : teamA;
      const success = rand(0, 100) < (thrower.skills.lineoutThrow * 0.75 - rivalJumper.skills.jump * 0.25 + 55);
      if (success) {
        addLog(minute, `Line-out limpio para ${throwTeam.name}: lanzamiento preciso de ${thrower.name}.`);
        push += throwingA ? rand(5, 12) : -rand(5, 12);
      } else {
        addLog(minute, `${rivalTeam.name} roba el line-out con el salto de ${rivalJumper.name}.`);
        push += throwingA ? -rand(5, 12) : rand(5, 12);
      }
      eventHandled = true;
    }

    pos = Math.max(0, Math.min(100, pos + push));
    eventHandled = false;

    // Tarjeta amarilla (poco frecuente)
    if (!eventHandled && Math.random() < 0.012) {
      const toA = Math.random() < 0.5;
      const teamCard = toA ? teamA : teamB;
      const players = toA ? playersA : playersB;
      const player = pick(players.filter(p => p.group === 'forward'));
      if (toA) cardPenaltyA = 5; else cardPenaltyB = 5;
      cards.push({minute, team: teamCard.name, player: player.name, type: 'yellow'});
      addLog(minute, `Tarjeta amarilla para ${player.name} (${teamCard.name}). 10 minutos afuera.`);
      eventHandled = true;
    }

    // Tarjeta roja (muy poco frecuente): expulsión por el resto del partido.
    if (!eventHandled && Math.random() < 0.0025) {
      const toA = Math.random() < 0.5;
      const alreadyRed = toA ? redCardA : redCardB;
      if (!alreadyRed) {
        const teamCard = toA ? teamA : teamB;
        const players = toA ? playersA : playersB;
        const player = pick(players.filter(p => p.group === 'forward'));
        if (toA) redCardA = true; else redCardB = true;
        cards.push({minute, team: teamCard.name, player: player.name, type: 'red'});
        addLog(minute, `¡Tarjeta roja para ${player.name} (${teamCard.name})! Jugará el resto del partido con un hombre menos.`);
        eventHandled = true;
      }
    }

    // Try
    if (!eventHandled && pos >= 94 && Math.random() < 0.35) {
      const scorer = pick(playersA.filter(p => p.group === 'back'));
      scoreA += 5;
      scorersA.push({minute, player: scorer.name});
      addLog(minute, `¡TRY de ${teamA.name}! Anota ${scorer.name}.`);
      if (Math.random() * 100 < kickerA.skills.kicking * 0.9) {
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
      if (Math.random() * 100 < kickerB.skills.kicking * 0.9) {
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
      if (Math.random() * 100 < kickerA.skills.kicking * 0.85) {
        scoreA += 3;
        addLog(minute, `Penal para ${teamA.name}. ${kickerA.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `Penal para ${teamA.name}, pero ${kickerA.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
    } else if (!eventHandled && pos <= 28 && pos > 6 && Math.random() < 0.08) {
      if (Math.random() * 100 < kickerB.skills.kicking * 0.85) {
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
