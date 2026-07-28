// Motor de simulação de partida de rugby (15 a side, 80 minutos).

import {teamOverall, teamSkillAvg} from './data.js';

const TACTICS = {
  agresivo: {attackMod: 1.12, defenseMod: 0.90, label: 'Agresivo'},
  equilibrado: {attackMod: 1.0, defenseMod: 1.0, label: 'Equilibrado'},
  defensivo: {attackMod: 0.90, defenseMod: 1.12, label: 'Defensivo'},
};

// ---- Plano de jogo por zona de campo ---------------------------------------
// Reflete o "tablero de mando territorial" que clubes de verdade usam pra
// orientar a equipe conforme a bola entra em cada trecho do campo: perto da
// própria try-line (vermelha) prioriza sair jogando com segurança; passada a
// própria 22 (laranja) busca ganhar terreno e transferir pressão; no campo de
// ataque (verde) impõe os forwards; nos 22m finais (dourada) joga físico e
// direto pro ingoal. Cada zona tem um estilo (afeta ataque/defesa/quiebre/erro
// de mão só quando a bola está nela) e um "código" — grito de identificação da
// jogada, só decorativo/visual.
const ZONE_KEYS = ['red', 'orange', 'green', 'yellow'];

const ZONE_STYLES = {
  chute: {attackMod: 0.94, defenseMod: 1.06, breakMod: 0.82, errorMod: 0.88, label: 'Saída pelo chute'},
  equilibrado: {attackMod: 1.0, defenseMod: 1.0, breakMod: 1.0, errorMod: 1.0, label: 'Equilibrado'},
  forwards: {attackMod: 1.08, defenseMod: 0.95, breakMod: 1.22, errorMod: 1.14, label: 'Forwards / jogo corrido'},
};

// pos: 0 = try-line do time A, 100 = try-line do time B (ver simulateMatch).
// "side" é de qual time estamos olhando a zona: as zonas de B são o espelho
// das de A (perto de 100 = zona vermelha — própria try-line — de B). Faixas
// oficiais do "Plan de Juego Febrero 2026" do Curda: 0-22 / 22-40 / 40-80 /
// 80-ingoal (mais precisas que o tablero territorial anterior, 22/50/78).
function zoneForPos(pos, side) {
  const p = side === 'B' ? 100 - pos : pos;
  if (p <= 22) return 'red';
  if (p <= 40) return 'orange';
  if (p <= 80) return 'green';
  return 'yellow';
}

// ---- Sistema de jogo (identidade tática geral) -----------------------------
// Além do estilo por zona, o "Plan de Juego" real do Curda descreve 3
// sistemas completos que o time escala conforme o rival/momento — cada um
// com uma formação de apoio própria e um jeito de jogar bem diferente.
// Argentina = jogo de controle (poucos passes, chuta bastante, muito
// disciplinado); Irlanda = jogo de fases (muito volume, joga a largura toda,
// mais arriscado); Sudáfrica = jogo frontal (penetrante, domina o contato,
// passes curtos e conservadores). Afeta a partida inteira, multiplicado
// em cima do estilo de cada zona.
const PLAY_SYSTEMS = {
  ninguno: {attackMod: 1, defenseMod: 1, breakMod: 1, errorMod: 1, formation: '', label: ''},
  argentina: {attackMod: 0.94, defenseMod: 1.10, breakMod: 0.82, errorMod: 0.78, formation: '1-3-3-1', label: 'Sistema Argentina — Juego de Control'},
  irlanda: {attackMod: 1.07, defenseMod: 0.96, breakMod: 1.18, errorMod: 1.08, formation: '1-3-2-1+1', label: 'Sistema Irlanda — Juego de Fases'},
  sudafrica: {attackMod: 1.08, defenseMod: 0.99, breakMod: 1.12, errorMod: 0.90, formation: '3-3-2+1', label: 'Sistema Sudáfrica — Juego Frontal'},
};

// Glossário real de códigos de jogada do Curda (tablero territorial + plan de
// juego), oferecido como sugestão rápida na tela de Tática — o técnico pode
// digitar qualquer outra coisa no campo de código.
const PLAY_CODES = [
  'AVIÓN', 'TORMENTA', 'T1', 'BOMBA', 'PASTO', 'HABILITO', 'FRANCIA',
  'BURRO', 'BÚHO', 'GLASGOW-PANZA', 'SUDAFRICA', 'IRLANDA', 'ARGENTINA',
  '90', '100', '1000', 'VERDE', 'AZUL', 'PUMA', 'TUCUMÁN', 'MARADONA',
];

function defaultGamePlan() {
  return {
    system: 'ninguno',
    zones: {
      red: {style: 'equilibrado', code: ''},
      orange: {style: 'equilibrado', code: ''},
      green: {style: 'equilibrado', code: ''},
      yellow: {style: 'equilibrado', code: ''},
    },
    pillars: {disciplina: 50, posse: 50, fisicalidade: 50, defesa: 50},
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export {TACTICS, ZONE_KEYS, ZONE_STYLES, PLAY_SYSTEMS, PLAY_CODES, zoneForPos, defaultGamePlan};

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
// em vez de uma média diluída entre os 15 jogadores. Visão de jogo entra
// junto do passe puro: um 9/10 com boa leitura erra menos, mesmo com
// técnica de passe mediana.
function handlingRating(scrumHalf, flyHalf) {
  return scrumHalf.skills.pass * 0.40 + scrumHalf.skills.reception * 0.12 + scrumHalf.skills.vision * 0.13
    + flyHalf.skills.pass * 0.20 + flyHalf.skills.reception * 0.08 + flyHalf.skills.vision * 0.07;
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

// Turnover/jackal: rouba a bola no chão logo após o tackle, bem dependente
// do especialista defensivo (normalmente um ala).
function turnoverChance(turnoverSkill) {
  return Math.max(0.004, Math.min(0.035, 0.012 + (turnoverSkill - 65) * 0.0006));
}

function hasTrait(players, trait) {
  return players.some(p => p.meta && p.meta.traits && p.meta.traits.includes(trait));
}

function isLineoutSpecialist(player) {
  return !!(player.meta && player.meta.traits && player.meta.traits.includes('lineoutSpecialist'));
}

// Chute efetivo pra conversões/penais: combina técnica de chute com
// compostura, que pesa mais nos minutos finais (momento de pressão).
function kickEffective(player, tick) {
  const clutch = tick > 30 ? 0.28 : 0.15;
  return player.skills.kicking * (1 - clutch) + player.skills.composure * clutch;
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
  const forwards = players.filter(p => p.group === 'forward');

  // Técnica de scrum e peso médio do pack dão um pequeno ajuste ao valor
  // "puro" dos forwards, além de um empurrão extra se houver um líder de
  // pack em campo.
  const scrumAvg = teamSkillAvg(players, 'scrum', 'forward');
  const avgWeight = forwards.length ? forwards.reduce((s, p) => s + (p.weightKg || 100), 0) / forwards.length : 100;
  const weightBonus = Math.max(-4, Math.min(4, (avgWeight - 108) * 0.35));
  const packLeaderMod = hasTrait(forwards, 'packLeader') ? 1.03 : 1;

  const forwardsAtk = (teamOverall(players, 'forward') * 0.85 + scrumAvg * 0.15 + weightBonus) * packLeaderMod;
  const backsAtk = teamOverall(players, 'back');
  const squadAttack = forwardsAtk * 0.4 + backsAtk * 0.6;
  const squadDefense = forwardsAtk * 0.55 + backsAtk * 0.45;
  return {
    attack: (team.attack * 0.5 + squadAttack * 0.5) * tactic.attackMod,
    defense: (team.defense * 0.5 + squadDefense * 0.5) * tactic.defenseMod,
    tacticLabel: tactic.label,
  };
}

// resumeState (opcional): retoma a simulação de um ponto no meio da partida
// em vez de começar do zero (0-0, bola no meio) — usado pra recalcular o
// "futuro" da partida depois de uma substituição ao vivo, sem redigitar o que
// já aconteceu. {pos, scoreA, scoreB, cardPenaltyA, cardPenaltyB, redCardA,
// redCardB, tick} — tick é o último tick já concluído (0 = ainda não começou).
export function simulateMatch(teamA, playersA, tacticA, teamB, playersB, tacticB, gamePlanA, gamePlanB, resumeState) {
  const planA = gamePlanA || defaultGamePlan();
  const planB = gamePlanB || defaultGamePlan();

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

  const turnoverForwardA = bestByGroup(playersA, 'turnover', 'forward');
  const turnoverForwardB = bestByGroup(playersB, 'turnover', 'forward');
  let turnoverChanceA = turnoverChance(turnoverForwardA.skills.turnover);
  let turnoverChanceB = turnoverChance(turnoverForwardB.skills.turnover);

  // Disciplina reduz a chance de cartão (tanto amarelo quanto vermelho).
  const disciplineAvgA = teamSkillAvg(playersA, 'discipline');
  const disciplineAvgB = teamSkillAvg(playersB, 'discipline');
  const disciplineFactor = avg => Math.max(0.4, Math.min(1.1, 1.3 - avg / 100));
  let yellowChanceA = 0.012 * disciplineFactor(disciplineAvgA);
  let yellowChanceB = 0.012 * disciplineFactor(disciplineAvgB);
  let redChanceA = 0.0025 * disciplineFactor(disciplineAvgA);
  let redChanceB = 0.0025 * disciplineFactor(disciplineAvgB);

  // Pilares do plano de jogo: modificadores fixos pra partida inteira (não
  // dependem de zona). Disciplina de zona reduz cartões; posse e controle
  // reduz erro de mão próprio e a chance do rival roubar a bola no tackle;
  // fisicalidade absoluta aumenta a chance de quiebre de línea do time.
  const disciplinaGuardA = clamp(1 - (planA.pillars.disciplina - 50) * 0.006, 0.5, 1.3);
  const disciplinaGuardB = clamp(1 - (planB.pillars.disciplina - 50) * 0.006, 0.5, 1.3);
  yellowChanceA *= disciplinaGuardA; redChanceA *= disciplinaGuardA;
  yellowChanceB *= disciplinaGuardB; redChanceB *= disciplinaGuardB;

  const posseGuardA = clamp(1 - (planA.pillars.posse - 50) * 0.005, 0.6, 1.4);
  const posseGuardB = clamp(1 - (planB.pillars.posse - 50) * 0.005, 0.6, 1.4);
  const handlingErrorBaseA = handlingErrorA * posseGuardA;
  const handlingErrorBaseB = handlingErrorB * posseGuardB;
  turnoverChanceB *= posseGuardA; // boa posse do A dificulta o roubo de bola do B
  turnoverChanceA *= posseGuardB;

  const fisicalidadeFactorA = clamp(1 + (planA.pillars.fisicalidade - 50) * 0.004, 0.7, 1.4);
  const fisicalidadeFactorB = clamp(1 + (planB.pillars.fisicalidade - 50) * 0.004, 0.7, 1.4);

  // Defesa dominante (plan defensivo real: "estar antes", pared conectada,
  // tackle dominante): aumenta o roubo de bola do próprio time e dificulta o
  // quiebre de línea do rival contra essa defesa.
  const defesaGuardA = clamp(1 - ((planA.pillars.defesa != null ? planA.pillars.defesa : 50) - 50) * 0.005, 0.5, 1.3);
  const defesaGuardB = clamp(1 - ((planB.pillars.defesa != null ? planB.pillars.defesa : 50) - 50) * 0.005, 0.5, 1.3);
  const defesaBoostA = clamp(1 + ((planA.pillars.defesa != null ? planA.pillars.defesa : 50) - 50) * 0.006, 0.6, 1.6);
  const defesaBoostB = clamp(1 + ((planB.pillars.defesa != null ? planB.pillars.defesa : 50) - 50) * 0.006, 0.6, 1.6);
  turnoverChanceA *= defesaBoostA;
  turnoverChanceB *= defesaBoostB;

  // Sistema de jogo (identidade tática geral, além do estilo por zona).
  const sysA = PLAY_SYSTEMS[planA.system] || PLAY_SYSTEMS.ninguno;
  const sysB = PLAY_SYSTEMS[planB.system] || PLAY_SYSTEMS.ninguno;

  // 0 = try-line de A (perigo p/ A), 100 = try-line de B (perigo p/ B). Sem
  // resumeState começa do zero (bola no meio); com resumeState, retoma
  // exatamente de onde a partida parou (ver comentário do parâmetro acima).
  let pos = resumeState ? resumeState.pos : 50;
  let scoreA = resumeState ? resumeState.scoreA : 0;
  let scoreB = resumeState ? resumeState.scoreB : 0;
  let cardPenaltyA = resumeState ? resumeState.cardPenaltyA : 0; // ticks restantes de desvantagem por cartão amarelo
  let cardPenaltyB = resumeState ? resumeState.cardPenaltyB : 0;
  let redCardA = resumeState ? resumeState.redCardA : false; // expulso: desvantagem por todo o resto da partida
  let redCardB = resumeState ? resumeState.redCardB : false;

  const ticks = [];
  const log = [];
  const scorersA = [];
  const scorersB = [];
  const cards = [];

  const TOTAL_TICKS = 40; // 2 min por tick = 80 min
  const startTick = resumeState ? resumeState.tick : 0;

  function addLog(minute, text) {
    log.push({minute, text});
  }

  if (!resumeState) addLog(0, `Comienza el partido en cancha: ${teamA.name} vs ${teamB.name}.`);

  for (let tick = startTick + 1; tick <= TOTAL_TICKS; tick++) {
    const minute = tick * 2;

    if (tick === 21) {
      addLog(40, `Descanso. Resultado parcial: ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
    }

    if (cardPenaltyA > 0) cardPenaltyA--;
    if (cardPenaltyB > 0) cardPenaltyB--;

    const fatigueA = inMatchFatigueFactor(tick, staminaAvgA);
    const fatigueB = inMatchFatigueFactor(tick, staminaAvgB);

    // Zona de campo em que a bola está agora, do ponto de vista de cada
    // time (espelhadas — ver zoneForPos) — define qual estilo do plano de
    // jogo de cada equipe está em vigor neste instante.
    const zoneA = zoneForPos(pos, 'A');
    const zoneB = zoneForPos(pos, 'B');
    const styleA = ZONE_STYLES[planA.zones[zoneA].style] || ZONE_STYLES.equilibrado;
    const styleB = ZONE_STYLES[planB.zones[zoneB].style] || ZONE_STYLES.equilibrado;

    const effAttackA = sA.attack * (cardPenaltyA > 0 ? 0.82 : 1) * (redCardA ? 0.75 : 1) * fatigueA * styleA.attackMod * sysA.attackMod;
    const effDefenseA = sA.defense * (cardPenaltyA > 0 ? 0.82 : 1) * (redCardA ? 0.75 : 1) * fatigueA * styleA.defenseMod * sysA.defenseMod;
    const effAttackB = sB.attack * (cardPenaltyB > 0 ? 0.82 : 1) * (redCardB ? 0.75 : 1) * fatigueB * styleB.attackMod * sysB.attackMod;
    const effDefenseB = sB.defense * (cardPenaltyB > 0 ? 0.82 : 1) * (redCardB ? 0.75 : 1) * fatigueB * styleB.defenseMod * sysB.defenseMod;

    let push = ((effAttackA - effDefenseB) - (effAttackB - effDefenseA)) * 0.14;
    push += rand(-9, 9);

    let eventHandled = false;

    // Quiebre de línea, más probable con líneas rápidas (y menos con líneas
    // lentas) — o estilo/fisicalidade/sistema da zona ativa também pesa,
    // assim como a defesa dominante do rival (pared conectada dificulta).
    const breakChanceA = breakChance(paceA) * styleA.breakMod * sysA.breakMod * fisicalidadeFactorA * defesaGuardB;
    const breakChanceB = breakChance(paceB) * styleB.breakMod * sysB.breakMod * fisicalidadeFactorB * defesaGuardA;
    const codeSuffix = (planCode, zoneKey) => {
      const code = planCode && planCode.zones[zoneKey] && planCode.zones[zoneKey].code;
      return code ? ` (código ${code.split('/')[0].trim()})` : '';
    };
    if (Math.random() < breakChanceA) {
      push += rand(15, 26);
      addLog(minute, `¡${fastestBackA.name} rompe la línea con velocidad y avanza para ${teamA.name}!${codeSuffix(planA, zoneA)}`);
    } else if (Math.random() < breakChanceB) {
      push -= rand(15, 26);
      addLog(minute, `¡${fastestBackB.name} rompe la línea con velocidad y avanza para ${teamB.name}!${codeSuffix(planB, zoneB)}`);
    }

    // Turnover/jackal: robo de la pelota en el tackle, muy dependiente del
    // especialista defensivo (normalmente un ala).
    const dominantSuffix = defesa => (defesa != null && defesa >= 70) ? ' (tackle dominante)' : '';
    if (!eventHandled && Math.random() < turnoverChanceA) {
      push += rand(6, 14);
      addLog(minute, `¡${turnoverForwardA.name} le roba la pelota al rival en el tackle para ${teamA.name}!${dominantSuffix(planA.pillars.defesa)}`);
      eventHandled = true;
    } else if (!eventHandled && Math.random() < turnoverChanceB) {
      push -= rand(6, 14);
      addLog(minute, `¡${turnoverForwardB.name} le roba la pelota al rival en el tackle para ${teamB.name}!${dominantSuffix(planB.pillars.defesa)}`);
      eventHandled = true;
    }

    // Error de manos: concentrado en el 9 y el 10, que son quienes más tocan la
    // pelota. El cansancio (fatigueA/B < 1 en el segundo tiempo) suma más
    // errores de mano, reflejando peores decisiones con el cuerpo pesado.
    const handlingErrorA_eff = handlingErrorBaseA * styleA.errorMod * sysA.errorMod + (1 - fatigueA) * 0.20;
    const handlingErrorB_eff = handlingErrorBaseB * styleB.errorMod * sysB.errorMod + (1 - fatigueB) * 0.20;
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

    // Line-out disputado (lanzamiento vs salto). Especialistas em lineout
    // (trait) dão um pequeno bônus extra pra quem lança ou pra quem salta.
    if (!eventHandled && Math.random() < 0.05) {
      const throwingA = Math.random() < 0.5;
      const thrower = throwingA ? hookerA : hookerB;
      const rivalJumper = throwingA ? jumperB : jumperA;
      const throwTeam = throwingA ? teamA : teamB;
      const rivalTeam = throwingA ? teamB : teamA;
      const throwerBonus = isLineoutSpecialist(thrower) ? 8 : 0;
      const jumperBonus = isLineoutSpecialist(rivalJumper) ? 8 : 0;
      const success = rand(0, 100) < (thrower.skills.lineoutThrow * 0.75 + throwerBonus - (rivalJumper.skills.jump * 0.25 + jumperBonus) + 55);
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

    // Tarjeta amarilla (poco frecuente): times mais disciplinados sofrem menos.
    if (!eventHandled && Math.random() < yellowChanceA) {
      const player = pick(playersA.filter(p => p.group === 'forward'));
      cardPenaltyA = 5;
      cards.push({minute, team: teamA.name, player: player.name, type: 'yellow'});
      addLog(minute, `Tarjeta amarilla para ${player.name} (${teamA.name}). 10 minutos afuera.`);
      eventHandled = true;
    } else if (!eventHandled && Math.random() < yellowChanceB) {
      const player = pick(playersB.filter(p => p.group === 'forward'));
      cardPenaltyB = 5;
      cards.push({minute, team: teamB.name, player: player.name, type: 'yellow'});
      addLog(minute, `Tarjeta amarilla para ${player.name} (${teamB.name}). 10 minutos afuera.`);
      eventHandled = true;
    }

    // Tarjeta roja (muy poco frecuente): expulsión por el resto del partido.
    if (!eventHandled && !redCardA && Math.random() < redChanceA) {
      const player = pick(playersA.filter(p => p.group === 'forward'));
      redCardA = true;
      cards.push({minute, team: teamA.name, player: player.name, type: 'red'});
      addLog(minute, `¡Tarjeta roja para ${player.name} (${teamA.name})! Jugará el resto del partido con un hombre menos.`);
      eventHandled = true;
    } else if (!eventHandled && !redCardB && Math.random() < redChanceB) {
      const player = pick(playersB.filter(p => p.group === 'forward'));
      redCardB = true;
      cards.push({minute, team: teamB.name, player: player.name, type: 'red'});
      addLog(minute, `¡Tarjeta roja para ${player.name} (${teamB.name})! Jugará el resto del partido con un hombre menos.`);
      eventHandled = true;
    }

    // Try
    if (!eventHandled && pos >= 94 && Math.random() < 0.35) {
      const scorer = pick(playersA.filter(p => p.group === 'back'));
      scoreA += 5;
      scorersA.push({minute, player: scorer.name});
      addLog(minute, `¡TRY de ${teamA.name}! Anota ${scorer.name}.`);
      if (Math.random() * 100 < kickEffective(kickerA, tick) * 0.9) {
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
      if (Math.random() * 100 < kickEffective(kickerB, tick) * 0.9) {
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
      if (Math.random() * 100 < kickEffective(kickerA, tick) * 0.85) {
        scoreA += 3;
        addLog(minute, `Penal para ${teamA.name}. ${kickerA.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `Penal para ${teamA.name}, pero ${kickerA.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
    } else if (!eventHandled && pos <= 28 && pos > 6 && Math.random() < 0.08) {
      if (Math.random() * 100 < kickEffective(kickerB, tick) * 0.85) {
        scoreB += 3;
        addLog(minute, `Penal para ${teamB.name}. ${kickerB.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `Penal para ${teamB.name}, pero ${kickerB.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
    }

    // Drop goal ocasional: agora tem chance real de errar, dependendo da
    // técnica específica de drop (DRO) e da compostura do chutador.
    if (!eventHandled && pos >= 60 && pos < 80 && Math.random() < 0.02) {
      const dropper = bestBy(playersA, 'dropGoal', 'AP');
      if (Math.random() * 100 < dropper.skills.dropGoal * 0.75 + dropper.skills.composure * 0.15) {
        scoreA += 3;
        addLog(minute, `¡Drop de ${dropper.name}! ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `${dropper.name} intenta el drop pero erra el palo.`);
      }
      pos = 50;
      eventHandled = true;
    } else if (!eventHandled && pos <= 40 && pos > 20 && Math.random() < 0.02) {
      const dropper = bestBy(playersB, 'dropGoal', 'AP');
      if (Math.random() * 100 < dropper.skills.dropGoal * 0.75 + dropper.skills.composure * 0.15) {
        scoreB += 3;
        addLog(minute, `¡Drop de ${dropper.name}! ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
      } else {
        addLog(minute, `${dropper.name} intenta el drop pero erra el palo.`);
      }
      pos = 50;
      eventHandled = true;
    }

    ticks.push({minute, pos, scoreA, scoreB, cardPenaltyA, cardPenaltyB, redCardA, redCardB});
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
