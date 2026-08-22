// Motor de simulação de partida de rugby (15 a side, 80 minutos).

import {teamOverall, teamSkillAvg} from './data.js';
import {conditionMultiplier} from './realSquads.js';

// attackMod/defenseMod entram na disputa de terreno (push) com o MESMO
// sinal — ver o comentário sobre "push" em simulateMatch — então uma troca
// simétrica (ex.: ataque +12%/defesa -10%, como era antes) quase se anula
// na média (~+2%), fazendo agresivo e defensivo renderem resultados quase
// idênticos ao equilibrado. Por isso os mods aqui são deliberadamente
// ASSIMÉTRICOS: agresivo ganha bem mais terreno médio do que perde na
// defesa própria (jogo mais aberto, mais território, mas também mais
// vazado e mais indisciplinado); defensivo cede um pouco de território
// médio em troca de jogar bem mais seguro (menos erro de mão, menos
// quebra de linha sofrida, menos cartão). breakMod/concedeBreakMod,
// errorMod e cardMod dão a cada tática uma "assinatura" de jogo própria,
// não só um deslocamento no placar médio.
const TACTICS = {
  agresivo: {attackMod: 1.18, defenseMod: 0.94, breakMod: 1.22, concedeBreakMod: 1.15, errorMod: 1.18, cardMod: 1.20, label: 'Agresivo'},
  equilibrado: {attackMod: 1.0, defenseMod: 1.0, breakMod: 1.0, concedeBreakMod: 1.0, errorMod: 1.0, cardMod: 1.0, label: 'Equilibrado'},
  defensivo: {attackMod: 0.90, defenseMod: 1.14, breakMod: 0.82, concedeBreakMod: 0.85, errorMod: 0.84, cardMod: 0.85, label: 'Defensivo'},
};

// ---- Vantagem de mandante ---------------------------------------------
// Efeito real e bem documentado do rugby: torcida, conhecimento do
// gramado e zero desgaste de viagem pro mandante — o visitante chega mais
// cansado e joga sob mais pressão (do público E do juiz local). Pequeno
// mas consistente: attackMod/defenseMod entram no push do mesmo jeito que
// tática/clima/moral (multiplicando effAttack/effDefense, escalados pelo
// mesmo fator 0.14 do push) — NÃO como bônus fixo somado direto no push a
// cada tick, que combinado (mesmo pequeno) vira um viés sistemático e não
// aleatório repetido 40 vezes por partida, dominando qualquer outro fator.
// Reduz cartão do mandante e aumenta o do visitante, melhora o
// aproveitamento de chute do mandante, e aumenta um pouco o erro de mão do
// visitante. Só se aplica quando a partida tem mandante de fato — amistosos
// de seleção e torneios relâmpago são jogados em campo neutro (ver
// matchContext.neutralVenue).
const HOME_ADVANTAGE = {
  attackMod: 1.03,
  defenseMod: 1.03,
  homeCardMod: 0.90,
  awayCardMod: 1.10,
  homeKickBonus: 3,
  awayErrorMod: 1.06,
};

// ---- Clima -----------------------------------------------------------
// Sorteado uma vez por partida (rollWeather, chamado fora daqui — em
// app.js — pra persistir o mesmo clima entre os recálculos de substituição
// ao vivo via resumeState). Chuva atrapalha bastante o jogo de mãos e o
// chute e reduz a quebra de linha (bola molhada, grama pesada); vento
// forte só prejudica o chute e um pouco o erro de mão; tempo firme é o
// padrão, sem efeito nenhum. Afeta os dois times igualmente — não há lado
// "favorecido" pelo clima, só handicapa o jogo como um todo.
const WEATHER_TYPES = {
  seco: {attackMod: 1, defenseMod: 1, errorMod: 1, breakMod: 1, kickMod: 1, label: 'Tempo firme'},
  chuva: {attackMod: 0.93, defenseMod: 1.04, errorMod: 1.35, breakMod: 0.80, kickMod: 0.80, label: 'Chuva'},
  vento: {attackMod: 0.97, defenseMod: 1.0, errorMod: 1.10, breakMod: 0.95, kickMod: 0.72, label: 'Vento forte'},
};
function rollWeather() {
  const roll = Math.random();
  if (roll < 0.18) return 'chuva';
  if (roll < 0.32) return 'vento';
  return 'seco';
}

// ---- Moral / sequência de resultados -----------------------------------
// form: array com os últimos resultados do time (mais recente por último),
// 'W'/'L'/'D' — ver state.teamForm em app.js, atualizado sempre que uma
// partida é confirmada na tabela (finalizeRound). Sequência de vitórias dá
// confiança (pequeno bônus geral no ataque/defesa); sequência de derrotas
// prejudica — os últimos resultados pesam mais que os mais antigos, e o
// efeito é sempre pequeno (no máximo ±6%): moral inclina a partida, nunca
// decide sozinha.
function moraleModFromForm(form) {
  if (!form || !form.length) return 1;
  const recent = form.slice(-5);
  let score = 0;
  let maxScore = 0;
  recent.forEach((r, i) => {
    const weight = i + 1;
    if (r === 'W') score += weight;
    else if (r === 'L') score -= weight;
    maxScore += weight;
  });
  const norm = maxScore ? score / maxScore : 0; // -1..1
  return clamp(1 + norm * 0.06, 0.94, 1.06);
}

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

// chute tinha attackMod/defenseMod quase espelhados (0.94/1.06 ~ soma zero
// no push, ver TACTICS acima) — a saída pelo chute perto da própria try-line
// ficava, na prática, pior do que não escolher nada. defenseMod bem mais
// alto corrige isso: jogar seguro ali realmente ajuda a sair da própria
// zona de perigo, não é só "abrir mão do ataque à toa".
const ZONE_STYLES = {
  chute: {attackMod: 0.94, defenseMod: 1.16, breakMod: 0.80, errorMod: 0.85, label: 'Saída pelo chute'},
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
// attackMod/defenseMod entram no push com o mesmo sinal (ver TACTICS acima)
// — o Sistema Argentina original (0.94/1.10) quase se anulava (~+4% líquido)
// e mal se diferenciava de jogar sem sistema nenhum, apesar de ter uma
// identidade clara (controle/território, não velocidade de linha). Por
// isso o defenseMod dele é bem mais alto que o custo do attackMod, e ganhou
// concedeBreakMod (reduz a quebra de linha do RIVAL contra esse sistema,
// não só a própria) — sem isso, "jogar seguro" só se auto-limitava sem
// nenhum ganho defensivo real em troca.
const PLAY_SYSTEMS = {
  ninguno: {attackMod: 1, defenseMod: 1, breakMod: 1, concedeBreakMod: 1, errorMod: 1, formation: '', label: ''},
  argentina: {attackMod: 0.95, defenseMod: 1.14, breakMod: 0.82, concedeBreakMod: 0.85, errorMod: 0.78, formation: '1-3-3-1', label: 'Sistema Argentina — Juego de Control'},
  irlanda: {attackMod: 1.09, defenseMod: 0.95, breakMod: 1.18, concedeBreakMod: 1.05, errorMod: 1.08, formation: '1-3-2-1+1', label: 'Sistema Irlanda — Juego de Fases'},
  sudafrica: {attackMod: 1.10, defenseMod: 1.02, breakMod: 1.14, concedeBreakMod: 0.95, errorMod: 0.90, formation: '3-3-2+1', label: 'Sistema Sudáfrica — Juego Frontal'},
};

// Glossário real de códigos de jogada do Curda (tablero territorial + plan de
// juego), oferecido como sugestão rápida na tela de Tática — o técnico pode
// digitar qualquer outra coisa no campo de código.
const PLAY_CODES = [
  'AVIÓN', 'TORMENTA', 'T1', 'BOMBA', 'PASTO', 'HABILITO', 'FRANCIA',
  'BURRO', 'BÚHO', 'GLASGOW-PANZA', 'SUDAFRICA', 'IRLANDA', 'ARGENTINA',
  '90', '100', '1000', 'VERDE', 'AZUL', 'PUMA', 'TUCUMÁN', 'MARADONA',
];

// Formato dos "pods" de forwards dentro de CADA zona (independente do
// sistema de jogo geral) — como o pack se agrupa pra atacar naquele pedaço
// do campo: pods grandes concentram poder de choque (mais go-forward, mais
// arriscado se ficam isolados longe do apoio); formatos mais espalhados em
// duplas priorizam manter a bola (menos erro de mão, menos potência por
// pod). Usado tanto no motor (ver simulateMatch) quanto na posição visual
// dos forwards em jogo aberto (ver podSizesFor/podInfoForNumber em render.js).
const POD_FORMATIONS = {
  '3-3-2': {attackMod: 1.04, defenseMod: 1.0, breakMod: 1.08, errorMod: 1.02},
  '1-3-3-1': {attackMod: 1.10, defenseMod: 0.94, breakMod: 1.15, errorMod: 1.10},
  '3-3-1-1': {attackMod: 1.02, defenseMod: 1.06, breakMod: 1.0, errorMod: 0.96},
  '2-2-2-2': {attackMod: 0.96, defenseMod: 1.0, breakMod: 0.92, errorMod: 0.85},
  // Dois grupos de 4 bem juntos — o formato clássico de pick-and-go perto do
  // próprio ingoal rival: não busca quebrar linha (breakMod baixo, não é
  // disso que se trata), é o mais seguro de todos (errorMod baixo, carregada
  // simples sem passe) e o mais forte no choque (attackMod mais alto de
  // todos) pra ganhar metro a metro até a linha.
  '4-4': {attackMod: 1.14, defenseMod: 1.02, breakMod: 0.85, errorMod: 0.80},
};
const POD_FORMATION_NEUTRAL = {attackMod: 1, defenseMod: 1, breakMod: 1, errorMod: 1};

function defaultGamePlan() {
  return {
    system: 'ninguno',
    zones: {
      red: {style: 'equilibrado', code: '', pods: '3-3-2'},
      orange: {style: 'equilibrado', code: '', pods: '3-3-2'},
      green: {style: 'equilibrado', code: '', pods: '3-3-2'},
      yellow: {style: 'equilibrado', code: '', pods: '3-3-2'},
    },
    pillars: {disciplina: 50, posse: 50, fisicalidade: 50, defesa: 50},
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Estatísticas reais da partida (ver resumo pós-jogo em app.js/showSummary):
// cada contador soma exatamente no ponto do motor onde o evento já é
// resolvido com um vencedor claro (não é inferido depois, por parsing de
// log ou de posição) — por isso, ao contrário de scoreA/scoreB, precisa ser
// carregado explicitamente pelo resumeState (ver performLiveSub/
// halftimeResumeState em app.js), senão uma substituição ao vivo reiniciaria
// os contadores do zero pro segundo trecho recalculado.
function emptyMatchStats() {
  return {
    A: emptyTeamStats(),
    B: emptyTeamStats(),
  };
}
function emptyTeamStats() {
  return {
    lineBreaks: 0, turnoversWon: 0, handlingErrors: 0,
    scrumsWon: 0, scrumsTotal: 0, lineoutsWon: 0, lineoutsTotal: 0,
    conversionsMade: 0, conversionsAttempted: 0,
    penaltiesMade: 0, penaltiesAttempted: 0,
    dropGoalsMade: 0, dropGoalsAttempted: 0,
  };
}
function cloneMatchStats(stats) {
  if (!stats) return emptyMatchStats();
  return {A: {...stats.A}, B: {...stats.B}};
}

export {TACTICS, ZONE_KEYS, ZONE_STYLES, PLAY_SYSTEMS, PLAY_CODES, POD_FORMATIONS, WEATHER_TYPES, zoneForPos, defaultGamePlan, pickLineoutUnit, rollWeather};

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
// técnica de passe mediana. Comunicação entra pesado aqui também — é o que
// faz o chamado da jogada chegar certo antes da bola sair da mão.
function handlingRating(scrumHalf, flyHalf) {
  return scrumHalf.skills.pass * 0.30 + scrumHalf.skills.reception * 0.10 + scrumHalf.skills.vision * 0.10 + scrumHalf.skills.comunicacao * 0.15
    + flyHalf.skills.pass * 0.15 + flyHalf.skills.reception * 0.07 + flyHalf.skills.vision * 0.06 + flyHalf.skills.comunicacao * 0.07;
}

function handlingErrorChance(handling) {
  return Math.max(0.01, Math.min(0.09, 0.04 - (handling - 65) * 0.0015));
}

// O jogador de pior combinação passe+comunicação entre 9 e 10 é o mais
// provável de errar a bola — um 9/10 com mãos boas mas mal entrosado no
// chamado da jogada também erra.
function pickHandlingCulprit(scrumHalf, flyHalf) {
  const quality = p => p.skills.pass * 0.65 + p.skills.comunicacao * 0.35;
  const wSH = Math.pow(100 - quality(scrumHalf), 2) + 1;
  const wFH = Math.pow(100 - quality(flyHalf), 2) + 1;
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

// Lesão recente no ombro (ver app.js/tickInjuries): mesmo já recuperado,
// atrapalha por umas semanas o lançamento, o salto e o levante — tudo que
// depende de força/mobilidade de ombro. Pequena penalidade, não zera o jogador.
function shoulderPenalty(player) {
  return player.meta && player.meta.recentInjuryBodyPart === 'shoulder' ? 1 : 0;
}

function avgOf(players, fn) {
  return players.length ? players.reduce((s, p) => s + fn(p), 0) / players.length : 0;
}

// Bônus de entrosamento (chemistry) do time gerenciado, calculado em app.js a
// partir de quanto os jogadores já jogaram/treinaram juntos (ver
// bumpChemistryForXV/tickGroupTraining) e injetado como meta.teamLineoutChemistry/
// meta.teamScrumChemistry em todo o elenco antes da simulação — times sem
// esse dado (rivais procedurais) simplesmente não têm bônus nenhum. Melhora
// o TIMING de quem já treinou/jogou junto, não a sorte crua do lance.
function chemistryBonus(player, key) {
  return (player.meta && typeof player.meta[key] === 'number') ? player.meta[key] : 0;
}

// Escolhe o trio que decide o lineout: o hooker que lança, o segunda-línea
// que mais salta, e os dois forwards mais fortes disponíveis (fora esses
// dois) pra levantar — como não temos "posição de levantador" cadastrada,
// os dois de maior força fazem esse papel, que é o real critério físico.
function pickLineoutUnit(players) {
  const thrower = bestBy(players, 'lineoutThrow', 'HK');
  const jumper = bestBy(players, 'jump', 'SL');
  const rest = players
    .filter(p => p.group === 'forward' && p.id !== thrower.id && p.id !== jumper.id)
    .sort((a, b) => b.skills.strength - a.skills.strength);
  return {thrower, jumper, lifters: rest.slice(0, 2)};
}

// Qualidade do saltador: impulsão (skill "salto") ajustada pela altura (mais
// alto alcança mais alto no ar) e pelo peso (mais pesado é mais lento pra
// subir), mais condição física e o desconto de ombro machucado.
function lineoutJumperScore(jumper) {
  const heightEdge = ((jumper.heightCm || 198) - 198) * 0.35;
  const weightDrag = Math.max(0, (jumper.weightKg || 112) - 112) * 0.12;
  const fitness = conditionMultiplier(jumper.condition);
  return (jumper.skills.jump * 0.9 + heightEdge - weightDrag) * fitness - shoulderPenalty(jumper) * 6;
}

// Qualidade dos dois levantadores: força (principal), altura (mais alcance
// pra erguer) e condição física — sem uma skill dedicada de "técnica de
// levante", a força já concentra a maior parte disso no perfil de forward.
function lineoutLifterScore(lifters) {
  if (!lifters.length) return 55;
  const strength = avgOf(lifters, p => p.skills.strength);
  const heightEdge = (avgOf(lifters, p => p.heightCm || 185) - 185) * 0.2;
  const fitness = avgOf(lifters, p => conditionMultiplier(p.condition));
  const shoulder = lifters.reduce((s, p) => s + shoulderPenalty(p), 0) * 4;
  return (strength * 0.85 + heightEdge) * fitness - shoulder;
}

// Qualidade do lançamento: técnica de lateral (lineoutThrow) e controle
// mental (compostura) — jogando fora de casa pesa bem mais a cabeça fria,
// já que o ambiente/pressão do visitante exige mais controle emocional pra
// acertar o mesmo lançamento que sairia natural em casa.
function lineoutThrowerScore(thrower, isAway, bonus) {
  const composureWeight = isAway ? 0.32 : 0.16;
  return thrower.skills.lineoutThrow * (1 - composureWeight) + thrower.skills.composure * composureWeight
    + bonus - shoulderPenalty(thrower) * 6;
}

// Chute efetivo pra conversões/penais: combina técnica de chute com
// compostura, que pesa mais nos minutos finais (momento de pressão).
function kickEffective(player, tick, weatherKickMod = 1) {
  const clutch = tick > 30 ? 0.28 : 0.15;
  return (player.skills.kicking * (1 - clutch) + player.skills.composure * clutch) * weatherKickMod;
}

// Fator de cansaço dentro da própria partida: nos primeiros 40 minutos o time
// joga em plena força; a partir daí perde intensidade progressivamente, mais
// ou menos conforme a resistência média do time (staminaAvg). Times com pouca
// resistência caem bem mais aos 70-80' do que aos 45-50'.
export function inMatchFatigueFactor(tick, staminaAvg) {
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

// Disputa de scrum: além da técnica de cada forward (skill "scrum"), entra o
// peso do pack PRÓPRIO comparado ao do RIVAL (não só o peso absoluto), a
// altura dos segundas-línea (mais alavanca no empuxo), a coordenação do
// empurre (proxy: disciplina do pack + líder de pack), a qualidade do
// lançamento do 9 (passe/posicionamento), o hookeio e a liderança do hooker
// (skill "scrum" dele + liderança — é ele quem avisa o 9 quando o scrum tá
// estável pra soltar a bola) e a leitura dos alas (liderança/disciplina — são
// eles que avisam quando é hora de empurrar mais forte, logo que a bola
// entra). Retorna só a parte ESTÁTICA (sem fadiga, que entra tick a tick).
function scrumTeamBaseScore(players, rivalAvgWeight) {
  const forwards = players.filter(p => p.group === 'forward');
  const locks = players.filter(p => p.posId === 'SL');
  const hooker = players.find(p => p.posId === 'HK');
  const scrumHalf = players.find(p => p.posId === 'MS');
  const flankers = players.filter(p => p.posId === 'AL');

  const scrumTechAvg = avgOf(forwards, p => p.skills.scrum);
  const avgWeight = avgOf(forwards, p => p.weightKg || 108);
  const weightEdge = clamp((avgWeight - rivalAvgWeight) * 0.55, -10, 10);
  const locksHeightEdge = locks.length ? (avgOf(locks, p => p.heightCm || 198) - 198) * 0.22 : 0;
  const coordination = avgOf(forwards, p => p.skills.discipline) * 0.15 + (hasTrait(forwards, 'packLeader') ? 4 : 0);
  const hookQuality = hooker ? hooker.skills.scrum * 0.35 + hooker.skills.leadership * 0.12 : 0;
  const feedQuality = scrumHalf ? scrumHalf.skills.pass * 0.10 + scrumHalf.skills.positioning * 0.08 : 0;
  const flankerCall = flankers.length ? (avgOf(flankers, p => p.skills.leadership) * 0.08 + avgOf(flankers, p => p.skills.discipline) * 0.08) : 0;
  const shoulderHit = forwards.reduce((s, p) => s + shoulderPenalty(p), 0) * 2;
  const chemistryEdge = forwards.length ? chemistryBonus(forwards[0], 'teamScrumChemistry') : 0;

  return scrumTechAvg * 0.75 + weightEdge + locksHeightEdge + coordination + hookQuality + feedQuality + flankerCall + chemistryEdge - shoulderHit;
}

// resumeState (opcional): retoma a simulação de um ponto no meio da partida
// em vez de começar do zero (0-0, bola no meio) — usado pra recalcular o
// "futuro" da partida depois de uma substituição ao vivo, sem redigitar o que
// já aconteceu. {pos, scoreA, scoreB, cardPenaltyA, cardPenaltyB, redCardA,
// redCardB, tick} — tick é o último tick já concluído (0 = ainda não começou).
//
// matchContext (opcional): {neutralVenue, formA, formB, weather} — teamA é
// sempre o mandante por convenção do resto do app (ver call sites), então
// neutralVenue=true é o único jeito de desligar a vantagem de mandante
// (amistosos de seleção, torneios relâmpago). formA/formB são os arrays de
// resultados recentes de cada time (ver moraleModFromForm); weather é uma
// chave de WEATHER_TYPES já sorteada fora daqui (rollWeather), pra ficar
// igual em todos os recálculos de um resumeState da mesma partida.
//
// statsCheckpointTick (opcional): tira uma "foto" das estatísticas (ver
// emptyMatchStats) bem no fim desse tick, devolvida em statsAtCheckpoint —
// usado só pelo ajuste tático de intervalo (ver app.js): a chamada inicial
// roda os 80 minutos inteiros com a tática antiga, mas se a tática mudar no
// intervalo, o SEGUNDO tempo é recalculado do zero via resumeState — sem
// essa foto do minuto 40, não teria como saber quanto das estatísticas
// finais já eram do 1º tempo (que fica valendo) e quanto era do 2º tempo
// descartado (que não pode contar).
export function simulateMatch(teamA, playersA, tacticA, teamB, playersB, tacticB, gamePlanA, gamePlanB, resumeState, matchContext = {}, statsCheckpointTick = null) {
  const planA = gamePlanA || defaultGamePlan();
  const planB = gamePlanB || defaultGamePlan();
  const tacticObjA = TACTICS[tacticA] || TACTICS.equilibrado;
  const tacticObjB = TACTICS[tacticB] || TACTICS.equilibrado;
  const {neutralVenue = false, formA = null, formB = null, weather = 'seco', rivalMod = 1, rivalSide = null} = matchContext;
  const weatherObj = WEATHER_TYPES[weather] || WEATHER_TYPES.seco;
  // Dificuldade escolhida pelo usuário no início do jogo: um multiplicador
  // de ataque/defesa aplicado só no lado RIVAL (ver newGame/DIFFICULTY_MOD
  // em app.js) — nunca no próprio lado do usuário, então só entra em jogo
  // nas partidas que ele realmente disputa.
  const difficultyModA = rivalSide === 'A' ? rivalMod : 1;
  const difficultyModB = rivalSide === 'B' ? rivalMod : 1;
  const moraleModA = moraleModFromForm(formA);
  const moraleModB = moraleModFromForm(formB);
  const homeKickBonusA = neutralVenue ? 0 : HOME_ADVANTAGE.homeKickBonus;

  const sA = teamStrength(teamA, playersA, tacticA);
  const sB = teamStrength(teamB, playersB, tacticB);

  const kickerA = bestBy(playersA, 'kicking', 'AP');
  const kickerB = bestBy(playersB, 'kicking', 'AP');
  const lineoutA = pickLineoutUnit(playersA);
  const lineoutB = pickLineoutUnit(playersB);
  const hookerA = lineoutA.thrower;
  const hookerB = lineoutB.thrower;
  const jumperA = lineoutA.jumper;
  const jumperB = lineoutB.jumper;

  // Peso médio do pack de cada time, pra comparar com o RIVAL na disputa de
  // scrum (não só o peso absoluto — ver scrumTeamBaseScore).
  const forwardsA = playersA.filter(p => p.group === 'forward');
  const forwardsB = playersB.filter(p => p.group === 'forward');
  const avgWeightA = avgOf(forwardsA, p => p.weightKg || 108);
  const avgWeightB = avgOf(forwardsB, p => p.weightKg || 108);
  const scrumBaseA = scrumTeamBaseScore(playersA, avgWeightB);
  const scrumBaseB = scrumTeamBaseScore(playersB, avgWeightA);

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

  // Disciplina reduz a chance de cartão (tanto amarelo quanto vermelho). A
  // tática também pesa aqui: agresivo pressiona mais e se disciplina menos
  // (cardMod > 1), defensivo joga mais seguro (cardMod < 1). O mandante
  // também se disciplina melhor (juiz e torcida em casa), o visitante pior.
  const disciplineAvgA = teamSkillAvg(playersA, 'discipline');
  const disciplineAvgB = teamSkillAvg(playersB, 'discipline');
  const disciplineFactor = avg => Math.max(0.4, Math.min(1.1, 1.3 - avg / 100));
  const homeCardModA = neutralVenue ? 1 : HOME_ADVANTAGE.homeCardMod;
  const homeCardModB = neutralVenue ? 1 : HOME_ADVANTAGE.awayCardMod;
  let yellowChanceA = 0.012 * disciplineFactor(disciplineAvgA) * tacticObjA.cardMod * homeCardModA;
  let yellowChanceB = 0.012 * disciplineFactor(disciplineAvgB) * tacticObjB.cardMod * homeCardModB;
  let redChanceA = 0.0025 * disciplineFactor(disciplineAvgA) * tacticObjA.cardMod * homeCardModA;
  let redChanceB = 0.0025 * disciplineFactor(disciplineAvgB) * tacticObjB.cardMod * homeCardModB;

  // Pilares do plano de jogo: modificadores fixos pra partida inteira (não
  // dependem de zona). Disciplina reduz cartões — coeficiente dobrado (era
  // 0.006) porque cartão já é um evento raro por natureza; com o coeficiente
  // antigo, nem o extremo 0/100 do pilar mudava o placar médio de forma
  // perceptível. Posse e controle reduz erro de mão próprio e a chance do
  // rival roubar a bola no tackle; fisicalidade absoluta aumenta a chance de
  // quiebre de línea do time.
  const disciplinaGuardA = clamp(1 - (planA.pillars.disciplina - 50) * 0.012, 0.35, 1.5);
  const disciplinaGuardB = clamp(1 - (planB.pillars.disciplina - 50) * 0.012, 0.35, 1.5);
  yellowChanceA *= disciplinaGuardA; redChanceA *= disciplinaGuardA;
  yellowChanceB *= disciplinaGuardB; redChanceB *= disciplinaGuardB;

  // Comunicação baixa do 9/10 também vira indisciplina tática: chamado que
  // não chega certo confunde a marcação/o pack sob pressão, aumentando a
  // chance de cartão — comunicação alta faz o oposto, o time se organiza e
  // se disciplina melhor.
  const commsGuard = (sh, fh) => clamp(1.5 - (sh.skills.comunicacao + fh.skills.comunicacao) / 200, 0.85, 1.3);
  const commsGuardA = commsGuard(scrumHalfA, flyHalfA);
  const commsGuardB = commsGuard(scrumHalfB, flyHalfB);
  yellowChanceA *= commsGuardA; redChanceA *= commsGuardA;
  yellowChanceB *= commsGuardB; redChanceB *= commsGuardB;

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
  // Contadores de "preso na própria área" pro alívio territorial (ver mais
  // abaixo) — não são carregados de resumeState: um recálculo ao vivo só
  // reseta essa paciência, o pior caso é adiar o alívio por até 3 ticks a mais.
  let pinnedLowStreak = 0; // pos <= 15 por ticks seguidos = A sufocado
  let pinnedHighStreak = 0; // pos >= 85 por ticks seguidos = B sufocado
  const stats = cloneMatchStats(resumeState && resumeState.stats);
  let statsAtCheckpoint = null;
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
    // Formato dos pods de forwards NESSA zona específica (independente do
    // sistema geral) — ver POD_FORMATIONS: pods grandes rendem mais
    // go-forward mas mais risco de erro; formatos em duplas seguram melhor a
    // bola mas com menos potência de choque.
    const podsA = POD_FORMATIONS[planA.zones[zoneA].pods] || POD_FORMATION_NEUTRAL;
    const podsB = POD_FORMATIONS[planB.zones[zoneB].pods] || POD_FORMATION_NEUTRAL;

    const homeAttackModA = neutralVenue ? 1 : HOME_ADVANTAGE.attackMod;
    const homeDefenseModA = neutralVenue ? 1 : HOME_ADVANTAGE.defenseMod;
    const effAttackA = sA.attack * (cardPenaltyA > 0 ? 0.82 : 1) * (redCardA ? 0.75 : 1) * fatigueA * styleA.attackMod * sysA.attackMod * podsA.attackMod * weatherObj.attackMod * moraleModA * homeAttackModA * difficultyModA;
    const effDefenseA = sA.defense * (cardPenaltyA > 0 ? 0.82 : 1) * (redCardA ? 0.75 : 1) * fatigueA * styleA.defenseMod * sysA.defenseMod * podsA.defenseMod * weatherObj.defenseMod * moraleModA * homeDefenseModA * difficultyModA;
    const effAttackB = sB.attack * (cardPenaltyB > 0 ? 0.82 : 1) * (redCardB ? 0.75 : 1) * fatigueB * styleB.attackMod * sysB.attackMod * podsB.attackMod * weatherObj.attackMod * moraleModB * difficultyModB;
    const effDefenseB = sB.defense * (cardPenaltyB > 0 ? 0.82 : 1) * (redCardB ? 0.75 : 1) * fatigueB * styleB.defenseMod * sysB.defenseMod * podsB.defenseMod * weatherObj.defenseMod * moraleModB * difficultyModB;

    let push = ((effAttackA - effDefenseB) - (effAttackB - effDefenseA)) * 0.14;
    push += rand(-9, 9);

    // Fase da jogada neste tick, usada pela renderização pra desenhar a
    // formação certa (chute inicial, scrum, lineout, jogo aberto etc.) —
    // eventos mais tardios no tick (try/penal/drop) têm prioridade sobre
    // scrum/lineout se os dois acontecerem no mesmo tick.
    let phase = (tick === startTick + 1 && !resumeState) ? 'kickoff' : 'open';

    let eventHandled = false;

    // Quiebre de línea, más probable con líneas rápidas (y menos con líneas
    // lentas) — o estilo/fisicalidade/sistema da zona ativa também pesa,
    // assim como a defesa dominante do rival (pared conectada dificulta) e a
    // tática/sistema de cada time (breakMod pro próprio ataque,
    // concedeBreakMod do rival pra quanto a própria defesa segura).
    const breakChanceA = breakChance(paceA) * styleA.breakMod * sysA.breakMod * podsA.breakMod * fisicalidadeFactorA * defesaGuardB * tacticObjA.breakMod * tacticObjB.concedeBreakMod * sysB.concedeBreakMod * weatherObj.breakMod;
    const breakChanceB = breakChance(paceB) * styleB.breakMod * sysB.breakMod * podsB.breakMod * fisicalidadeFactorB * defesaGuardA * tacticObjB.breakMod * tacticObjA.concedeBreakMod * sysA.concedeBreakMod * weatherObj.breakMod;
    const codeSuffix = (planCode, zoneKey) => {
      const code = planCode && planCode.zones[zoneKey] && planCode.zones[zoneKey].code;
      return code ? ` (código ${code.split('/')[0].trim()})` : '';
    };
    if (Math.random() < breakChanceA) {
      push += rand(15, 26);
      addLog(minute, `¡${fastestBackA.name} rompe la línea con velocidad y avanza para ${teamA.name}!${codeSuffix(planA, zoneA)}`);
      phase = 'break';
      stats.A.lineBreaks++;
    } else if (Math.random() < breakChanceB) {
      push -= rand(15, 26);
      addLog(minute, `¡${fastestBackB.name} rompe la línea con velocidad y avanza para ${teamB.name}!${codeSuffix(planB, zoneB)}`);
      phase = 'break';
      stats.B.lineBreaks++;
    }

    // Turnover/jackal: robo de la pelota en el tackle, muy dependiente del
    // especialista defensivo (normalmente un ala).
    const dominantSuffix = defesa => (defesa != null && defesa >= 70) ? ' (tackle dominante)' : '';
    if (!eventHandled && Math.random() < turnoverChanceA) {
      push += rand(6, 14);
      addLog(minute, `¡${turnoverForwardA.name} le roba la pelota al rival en el tackle para ${teamA.name}!${dominantSuffix(planA.pillars.defesa)}`);
      eventHandled = true;
      phase = 'turnover';
      stats.A.turnoversWon++;
    } else if (!eventHandled && Math.random() < turnoverChanceB) {
      push -= rand(6, 14);
      addLog(minute, `¡${turnoverForwardB.name} le roba la pelota al rival en el tackle para ${teamB.name}!${dominantSuffix(planB.pillars.defesa)}`);
      eventHandled = true;
      phase = 'turnover';
      stats.B.turnoversWon++;
    }

    // Error de manos: concentrado en el 9 y el 10, que son quienes más tocan la
    // pelota. El cansancio (fatigueA/B < 1 en el segundo tiempo) suma más
    // errores de mano, reflejando peores decisiones con el cuerpo pesado. A
    // tática agresiva também erra mais (mais risco), a defensiva erra menos.
    // Chuva/vento (weatherObj.errorMod) atrapalha os dois lados igual; o
    // visitante ainda erra um pouco mais por jogar fora (pressão da torcida).
    const homeErrorModB = neutralVenue ? 1 : HOME_ADVANTAGE.awayErrorMod;
    const handlingErrorA_eff = handlingErrorBaseA * styleA.errorMod * sysA.errorMod * podsA.errorMod * tacticObjA.errorMod * weatherObj.errorMod + (1 - fatigueA) * 0.20;
    const handlingErrorB_eff = handlingErrorBaseB * styleB.errorMod * sysB.errorMod * podsB.errorMod * tacticObjB.errorMod * weatherObj.errorMod * homeErrorModB + (1 - fatigueB) * 0.20;
    if (!eventHandled && push > 0 && Math.random() < handlingErrorA_eff) {
      const culprit = pickHandlingCulprit(scrumHalfA, flyHalfA);
      addLog(minute, `Knock-on de ${teamA.name}: a ${culprit.name} se le escapa la pelota en el pase.`);
      push = -rand(4, 10);
      eventHandled = true;
      phase = 'knockon';
      stats.A.handlingErrors++;
    } else if (!eventHandled && push < 0 && Math.random() < handlingErrorB_eff) {
      const culprit = pickHandlingCulprit(scrumHalfB, flyHalfB);
      addLog(minute, `Knock-on de ${teamB.name}: a ${culprit.name} se le escapa la pelota en el pase.`);
      push = rand(4, 10);
      eventHandled = true;
      phase = 'knockon';
      stats.B.handlingErrors++;
    }

    // Line-out disputado: o time que lança combina a técnica+compostura do
    // hooker (mais peso na compostura se estiver jogando fora, ver
    // lineoutThrowerScore) com o salto do seu próprio jumper (altura, peso e
    // condição física) e o levante dos seus dois forwards mais fortes;
    // quem defende contesta só com o salto+levante do lado rival. Lesão
    // recente no ombro pesa nos três papéis (thrower, jumper, levantadores).
    if (!eventHandled && Math.random() < 0.05) {
      const throwingA = Math.random() < 0.5;
      const throwUnit = throwingA ? lineoutA : lineoutB;
      const rivalUnit = throwingA ? lineoutB : lineoutA;
      const throwTeam = throwingA ? teamA : teamB;
      const rivalTeam = throwingA ? teamB : teamA;
      const throwerBonus = isLineoutSpecialist(throwUnit.thrower) ? 8 : 0;
      const jumperBonus = isLineoutSpecialist(rivalUnit.jumper) ? 8 : 0;

      const throwQuality = lineoutThrowerScore(throwUnit.thrower, !throwingA, throwerBonus) * 0.5
        + lineoutJumperScore(throwUnit.jumper) * 0.35
        + lineoutLifterScore(throwUnit.lifters) * 0.15
        + chemistryBonus(throwUnit.thrower, 'teamLineoutChemistry');
      const contestQuality = (lineoutJumperScore(rivalUnit.jumper) + jumperBonus) * 0.75
        + lineoutLifterScore(rivalUnit.lifters) * 0.25;

      const success = rand(0, 100) < clamp(76 + (throwQuality - contestQuality) * 0.45, 12, 97);
      const throwStats = throwingA ? stats.A : stats.B;
      throwStats.lineoutsTotal++;
      if (success) {
        addLog(minute, `Line-out limpio para ${throwTeam.name}: lanzamiento preciso de ${throwUnit.thrower.name}, bien sostenido en el aire.`);
        push += throwingA ? rand(5, 12) : -rand(5, 12);
        throwStats.lineoutsWon++;
      } else {
        addLog(minute, `${rivalTeam.name} roba el line-out con el salto de ${rivalUnit.jumper.name}.`);
        push += throwingA ? -rand(5, 12) : rand(5, 12);
      }
      eventHandled = true;
      phase = 'lineout';
    }

    // Scrum disputado: técnica de scrum de cada forward, peso do pack PRÓPRIO
    // vs o do RIVAL, altura dos segundas-línea, coordenação do empurre,
    // hookeio+liderança do hooker, qualidade do lançamento do 9 e a leitura
    // dos alas (ver scrumTeamBaseScore) — tudo multiplicado pela fadiga atual
    // do pack, igual o resto do jogo.
    if (!eventHandled && Math.random() < 0.045) {
      const feedA = Math.random() < 0.5;
      const scrumScoreA = scrumBaseA * fatigueA;
      const scrumScoreB = scrumBaseB * fatigueB;
      const ownScore = feedA ? scrumScoreA : scrumScoreB;
      const rivalScore = feedA ? scrumScoreB : scrumScoreA;
      const feedTeam = feedA ? teamA : teamB;
      const rivalTeam = feedA ? teamB : teamA;
      const diff = ownScore - rivalScore;
      const feedStats = feedA ? stats.A : stats.B;
      feedStats.scrumsTotal++;
      if (diff > 10) {
        push += (feedA ? 1 : -1) * rand(8, 16);
        addLog(minute, `¡Scrum dominante de ${feedTeam.name}! El pack avanza con autoridad.`);
        feedStats.scrumsWon++;
      } else if (diff < -10) {
        push += (feedA ? -1 : 1) * rand(8, 16);
        if (Math.random() < 0.3) {
          addLog(minute, `Scrum inestable de ${feedTeam.name}: penal para ${rivalTeam.name}.`);
        } else {
          addLog(minute, `Scrum inestable de ${feedTeam.name}: ${rivalTeam.name} gana terreno en el empuje.`);
        }
      } else {
        push += (feedA ? 1 : -1) * rand(1, 5);
        addLog(minute, `Scrum estable, salida limpia para ${feedTeam.name}.`);
        feedStats.scrumsWon++;
      }
      eventHandled = true;
      phase = 'scrum';
    }

    // Saída de emergência da própria 22: chance FIXA de aliviar a pressão
    // perto da própria linha, não escalada pela diferença de qualidade pro
    // rival — mesmo o time mais fraco sabe executar um chute de saída básico
    // na maior parte das vezes. Sem isso, só o diferencial attack/defense
    // decide quem sai da própria área, e o time mais fraco quase nunca sai.
    if (pos + push <= 15 && Math.random() < 0.12) {
      push += rand(10, 20);
      addLog(minute, `${teamA.name} despeja bien y gana terreno.`);
      phase = 'exit';
    } else if (pos + push >= 85 && Math.random() < 0.12) {
      push -= rand(10, 20);
      addLog(minute, `${teamB.name} despeja bien y gana terreno.`);
      phase = 'exit';
    }

    pos = Math.max(0, Math.min(100, pos + push));
    eventHandled = false;

    // Alívio territorial: sem isso, uma vez que a bola fica perto de um
    // extremo ela tende a ficar ali (passeio aleatório com viés grudado na
    // borda 0-100) — e como pos só reseta pro meio-campo num try/penal/drop,
    // um time que nunca consegue pontuar também nunca ganha esse reset,
    // ficando sufocado o jogo inteiro sem chance real de ataque. Depois de
    // ficar preso perto da própria linha por ticks seguidos, o time simula
    // um bom despeje/contra-ataque e volta pro jogo.
    if (pos <= 15) {
      pinnedLowStreak++;
      pinnedHighStreak = 0;
    } else if (pos >= 85) {
      pinnedHighStreak++;
      pinnedLowStreak = 0;
    } else {
      pinnedLowStreak = 0;
      pinnedHighStreak = 0;
    }
    if (pinnedLowStreak >= 3) {
      pos = Math.min(100, pos + rand(25, 40));
      addLog(minute, `${teamA.name} sale del área de peligro con un buen despeje.`);
      pinnedLowStreak = 0;
      phase = 'exit';
    } else if (pinnedHighStreak >= 3) {
      pos = Math.max(0, pos - rand(25, 40));
      addLog(minute, `${teamB.name} sale del área de peligro con un buen despeje.`);
      pinnedHighStreak = 0;
      phase = 'exit';
    }

    // Tarjeta amarilla (poco frecuente): times mais disciplinados sofrem menos.
    if (!eventHandled && Math.random() < yellowChanceA) {
      const player = pick(playersA.filter(p => p.group === 'forward'));
      cardPenaltyA = 5;
      cards.push({minute, team: teamA.name, player: player.name, type: 'yellow'});
      addLog(minute, `Tarjeta amarilla para ${player.name} (${teamA.name}). 10 minutos afuera.`);
      eventHandled = true;
      phase = 'card';
    } else if (!eventHandled && Math.random() < yellowChanceB) {
      const player = pick(playersB.filter(p => p.group === 'forward'));
      cardPenaltyB = 5;
      cards.push({minute, team: teamB.name, player: player.name, type: 'yellow'});
      addLog(minute, `Tarjeta amarilla para ${player.name} (${teamB.name}). 10 minutos afuera.`);
      eventHandled = true;
      phase = 'card';
    }

    // Tarjeta roja (muy poco frecuente): expulsión por el resto del partido.
    if (!eventHandled && !redCardA && Math.random() < redChanceA) {
      const player = pick(playersA.filter(p => p.group === 'forward'));
      redCardA = true;
      cards.push({minute, team: teamA.name, player: player.name, type: 'red'});
      addLog(minute, `¡Tarjeta roja para ${player.name} (${teamA.name})! Jugará el resto del partido con un hombre menos.`);
      eventHandled = true;
      phase = 'card';
    } else if (!eventHandled && !redCardB && Math.random() < redChanceB) {
      const player = pick(playersB.filter(p => p.group === 'forward'));
      redCardB = true;
      cards.push({minute, team: teamB.name, player: player.name, type: 'red'});
      addLog(minute, `¡Tarjeta roja para ${player.name} (${teamB.name})! Jugará el resto del partido con un hombre menos.`);
      eventHandled = true;
      phase = 'card';
    }

    // Evento raro de oportunismo: chance FIXA e pequena de pontuar "do
    // nada" — intercepto, erro grosseiro do rival etc. — independente de
    // onde a bola estava. Sem isso, toda pontuação depende só de dominar
    // território, que por sua vez depende quase todo do gap de força; isso
    // garante que mesmo o time mais fraco tenha uma chance ocasional de
    // furar o domínio territorial do rival.
    if (!eventHandled && Math.random() < 0.008) {
      const scorer = bestByGroup(playersA, 'vision', 'back');
      scoreA += 5;
      scorersA.push({minute, player: scorer.name});
      addLog(minute, `¡Intercepción de ${scorer.name} y try de la nada para ${teamA.name}!`);
      stats.A.conversionsAttempted++;
      if (Math.random() * 100 < (kickEffective(kickerA, tick, weatherObj.kickMod) + homeKickBonusA) * 0.9) {
        scoreA += 2;
        addLog(minute, `${kickerA.name} convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.A.conversionsMade++;
      } else {
        addLog(minute, `${kickerA.name} falla la conversión.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'try';
    } else if (!eventHandled && Math.random() < 0.008) {
      const scorer = bestByGroup(playersB, 'vision', 'back');
      scoreB += 5;
      scorersB.push({minute, player: scorer.name});
      addLog(minute, `¡Intercepción de ${scorer.name} y try de la nada para ${teamB.name}!`);
      stats.B.conversionsAttempted++;
      if (Math.random() * 100 < kickEffective(kickerB, tick, weatherObj.kickMod) * 0.9) {
        scoreB += 2;
        addLog(minute, `${kickerB.name} convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.B.conversionsMade++;
      } else {
        addLog(minute, `${kickerB.name} falla la conversión.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'try';
    }

    // Try — kickEffective já leva o vento/chuva embutido (weatherObj.kickMod);
    // o mandante ainda ganha um bônus fixo de aproveitamento (torcida/campo
    // conhecido), o visitante não.
    if (!eventHandled && pos >= 90 && Math.random() < 0.55) {
      const scorer = pick(playersA.filter(p => p.group === 'back'));
      scoreA += 5;
      scorersA.push({minute, player: scorer.name});
      addLog(minute, `¡TRY de ${teamA.name}! Anota ${scorer.name}.`);
      stats.A.conversionsAttempted++;
      if (Math.random() * 100 < (kickEffective(kickerA, tick, weatherObj.kickMod) + homeKickBonusA) * 0.9) {
        scoreA += 2;
        addLog(minute, `${kickerA.name} convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.A.conversionsMade++;
      } else {
        addLog(minute, `${kickerA.name} falla la conversión.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'try';
    } else if (!eventHandled && pos <= 10 && Math.random() < 0.55) {
      const scorer = pick(playersB.filter(p => p.group === 'back'));
      scoreB += 5;
      scorersB.push({minute, player: scorer.name});
      addLog(minute, `¡TRY de ${teamB.name}! Anota ${scorer.name}.`);
      stats.B.conversionsAttempted++;
      if (Math.random() * 100 < kickEffective(kickerB, tick, weatherObj.kickMod) * 0.9) {
        scoreB += 2;
        addLog(minute, `${kickerB.name} convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.B.conversionsMade++;
      } else {
        addLog(minute, `${kickerB.name} falla la conversión.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'try';
    }

    // Penal — faixa alargada (62+) e chance mais alta (0.11) do que antes:
    // ficar perto da linha sem converter o try (ex.: pos>=94 mas errou o
    // try acima) também tem que dar chance de penal, não só de nada
    // acontecer — senão fica muita jogada "morta" perto do ingoal.
    if (!eventHandled && pos >= 55 && Math.random() < 0.18) {
      stats.A.penaltiesAttempted++;
      if (Math.random() * 100 < (kickEffective(kickerA, tick, weatherObj.kickMod) + homeKickBonusA) * 0.85) {
        scoreA += 3;
        addLog(minute, `Penal para ${teamA.name}. ${kickerA.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.A.penaltiesMade++;
      } else {
        addLog(minute, `Penal para ${teamA.name}, pero ${kickerA.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'penalty';
    } else if (!eventHandled && pos <= 45 && Math.random() < 0.18) {
      stats.B.penaltiesAttempted++;
      if (Math.random() * 100 < kickEffective(kickerB, tick, weatherObj.kickMod) * 0.85) {
        scoreB += 3;
        addLog(minute, `Penal para ${teamB.name}. ${kickerB.name} patea y convierte. ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.B.penaltiesMade++;
      } else {
        addLog(minute, `Penal para ${teamB.name}, pero ${kickerB.name} erra el pique.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'penalty';
    }

    // Drop goal ocasional: agora tem chance real de errar, dependendo da
    // técnica específica de drop (DRO) e da compostura do chutador.
    if (!eventHandled && pos >= 60 && pos < 80 && Math.random() < 0.02) {
      const dropper = bestBy(playersA, 'dropGoal', 'AP');
      stats.A.dropGoalsAttempted++;
      if (Math.random() * 100 < dropper.skills.dropGoal * 0.75 + dropper.skills.composure * 0.15) {
        scoreA += 3;
        addLog(minute, `¡Drop de ${dropper.name}! ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.A.dropGoalsMade++;
      } else {
        addLog(minute, `${dropper.name} intenta el drop pero erra el palo.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'dropgoal';
    } else if (!eventHandled && pos <= 40 && pos > 20 && Math.random() < 0.02) {
      const dropper = bestBy(playersB, 'dropGoal', 'AP');
      stats.B.dropGoalsAttempted++;
      if (Math.random() * 100 < dropper.skills.dropGoal * 0.75 + dropper.skills.composure * 0.15) {
        scoreB += 3;
        addLog(minute, `¡Drop de ${dropper.name}! ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}.`);
        stats.B.dropGoalsMade++;
      } else {
        addLog(minute, `${dropper.name} intenta el drop pero erra el palo.`);
      }
      pos = 50;
      eventHandled = true;
      phase = 'dropgoal';
    }

    // statsSnapshot: foto das estatísticas (ver emptyMatchStats) logo após
    // este tick — dá pra qualquer resimulação por resumeState (substituição
    // ao vivo, ajuste tático) recomeçar as estatísticas exatamente de onde
    // a partida realmente estava, em vez de herdar as estatísticas da
    // partida INTEIRA já simulada (ver currentResumeState em app.js).
    ticks.push({minute, pos, scoreA, scoreB, cardPenaltyA, cardPenaltyB, redCardA, redCardB, phase, statsSnapshot: cloneMatchStats(stats)});
    if (statsCheckpointTick != null && tick === statsCheckpointTick) {
      statsAtCheckpoint = cloneMatchStats(stats);
    }
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
    stats,
    statsAtCheckpoint,
    motm: motm ? motm.name : null,
    weather,
    weatherLabel: weatherObj.label,
  };
}
