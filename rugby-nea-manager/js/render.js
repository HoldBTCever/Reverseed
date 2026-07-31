// Renderização da quadra 2D (campo de rugby completo) e animação da partida ao vivo,
// além da escalação visual (campo estático com as camisas em formação).

import {zoneForPos, PLAY_SYSTEMS} from './engine.js';

// Cores das 4 zonas táticas, no mesmo espírito do "tablero de mando
// territorial" real (vermelho perto da própria try-line, dourado nos 22m
// finais de ataque).
const ZONE_RIBBON_COLORS = {
  red: '#c0392b',
  orange: '#d68a2c',
  green: '#1f7a43',
  yellow: '#c9a227',
};

// As 15 posições da numeração tradicional do rugby, com onde cada uma se
// posiciona em relação à bola (profundidade) e à largura do campo (y).
// "tight" = forwards de contato direto (pilares, hooker, segunda linha);
// ficam sempre junto à disputa, dos dois lados. As demais posições recuam
// (ataque) ou avançam (defesa) em relação à bola, cada uma com sua
// profundidade e abertura típicas.
const ROLE_TEMPLATE = [
  {num: 1, kind: 'tight', y: -0.10},
  {num: 2, kind: 'tight', y: 0.00},
  {num: 3, kind: 'tight', y: 0.10},
  {num: 4, kind: 'tight', y: -0.06},
  {num: 5, kind: 'tight', y: 0.06},
  {num: 6, kind: 'loose', y: -0.22},
  {num: 7, kind: 'loose', y: 0.22},
  {num: 8, kind: 'loose', y: 0.00},
  {num: 9, kind: 'halfback', y: 0.05, attackDepth: 16, defenseDepth: 12},
  {num: 10, kind: 'back', y: 0.16, attackDepth: 36, defenseDepth: 38},
  {num: 11, kind: 'back', y: -0.90, attackDepth: 55, defenseDepth: 46},
  {num: 12, kind: 'back', y: 0.30, attackDepth: 46, defenseDepth: 44},
  {num: 13, kind: 'back', y: 0.45, attackDepth: 48, defenseDepth: 44},
  {num: 14, kind: 'back', y: 0.90, attackDepth: 55, defenseDepth: 46},
  {num: 15, kind: 'back', y: -0.02, attackDepth: 72, defenseDepth: 82},
];

const TIGHT_DEPTH = {attack: 8, defense: 8};
const LOOSE_DEPTH = {attack: 13, defense: 11};

// Sequência de try: quando a linha de três-quartos varre o campo até o
// escanteio (ver startTrySequence), cada camisa da linha entra com um
// atraso diferente (9 sai primeiro, a ponta chega por último pra terminar
// a jogada) e abre pra um afastamento lateral diferente, formando o leque
// clássico de uma jogada de linha em fases até o try.
const TRY_SWEEP_DELAY = {9: 0, 10: 0.06, 12: 0.14, 13: 0.22, 15: 0.3, 11: 0.38, 14: 0.38};
const TRY_SWEEP_WIDE = {9: 0.22, 10: 0.38, 12: 0.52, 13: 0.66, 15: 0.48, 11: 0.85, 14: 0.85};

// Formato de cunha de um pack real de scrum (profundidade a partir da bola
// e afastamento lateral por número de camisa): 1ª linha (1/2/3) colada e
// centralizada, 2ª linha (4/5) um passo atrás e mais aberta, 3ª linha
// (6/7) mais atrás e mais aberta ainda, e o 8 na base entre os
// segunda-línea e os alas.
const SCRUM_PACK_OFFSET = {
  1: {depth: 13, wide: -0.09},
  2: {depth: 13, wide: 0},
  3: {depth: 13, wide: 0.09},
  4: {depth: 22, wide: -0.13},
  5: {depth: 22, wide: 0.13},
  6: {depth: 34, wide: -0.20},
  7: {depth: 34, wide: 0.20},
  8: {depth: 28, wide: 0},
};

// Lê a "formação" real do sistema de jogo escolhido (ex.: Irlanda =
// '1-3-2-1+1', jogo de fases com forwards espalhados em vários pods pela
// largura do campo; Argentina = '1-3-3-1', mais compacto; Sudáfrica =
// '3-3-2+1', jogo frontal com pods maiores e mais perto do ponto de contato)
// e devolve quantos forwards entram em cada pod, sempre somando os 8
// forwards reais (1 a 8) — normaliza formações cuja soma não bata com 8.
function parsePodSizes(formation) {
  const raw = (formation || '').split(/[-+]/).map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0);
  if (!raw.length) return [8]; // sem sistema definido: um único bloco (comportamento antigo)
  const total = raw.reduce((a, b) => a + b, 0);
  if (total === 8) return raw;
  const scaled = raw.map(n => Math.max(1, Math.round((n * 8) / total)));
  const diff = 8 - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] += diff;
  return scaled.filter(n => n > 0);
}

export class MatchRenderer {
  constructor(canvas, teamA, teamB, gamePlanA, gamePlanB) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.teamA = teamA;
    this.teamB = teamB;
    this.gamePlanA = gamePlanA || null;
    this.gamePlanB = gamePlanB || null;
    this.dots = this.makeDots();
    this.currentPos = 50;
    this.jitterSeed = 0;
    this.lastX = null;
    this.attackingTeam = 'A';
    this.trySequence = null;
  }

  // Dispara a animação de try: a linha de três-quartos do time que marcou
  // varre o campo em fases até o escanteio, em vez da bola só aparecer
  // presa no meio de campo (ver TRY_SWEEP_DELAY/TRY_SWEEP_WIDE e o uso de
  // trySequence dentro de draw()). O lado do escanteio é sorteado a cada
  // try, pra não repetir sempre a mesma pontinha.
  startTrySequence(team) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const startPos = team === 'A' ? 74 : 26;
    const endPos = team === 'A' ? 99 : 1;
    this.trySequence = {team, side, startPos, endPos, startTime: performance.now(), duration: 1500};
  }

  // Os 15 jogadores de cada equipe, com numeração e posto reais.
  makeDots() {
    const dots = [];
    ['A', 'B'].forEach(team => {
      ROLE_TEMPLATE.forEach(role => {
        dots.push({team, ...role, phase: Math.random() * Math.PI * 2});
      });
    });
    return dots;
  }

  // Tamanho de cada pod de forwards NA ZONA onde a bola está agora (ver
  // POD_FORMATIONS em engine.js — cada zona do plano tático pode ter um
  // formato de pod diferente: pods grandes concentram poder de choque,
  // formatos em duplas espalham mais pela largura). Cai pra formação do
  // sistema geral se a zona não tiver um formato próprio definido (saves
  // antigos), e pro comportamento padrão (bloco único) se não houver plano.
  podSizesFor(team, pos) {
    const plan = team === 'A' ? this.gamePlanA : this.gamePlanB;
    if (!plan) return parsePodSizes('');
    const zoneKey = zoneForPos(pos, team);
    const zone = plan.zones && plan.zones[zoneKey];
    if (zone && zone.pods) return parsePodSizes(zone.pods);
    const sys = plan.system ? PLAY_SYSTEMS[plan.system] : null;
    return parsePodSizes(sys ? sys.formation : '');
  }

  // Distribui os 8 forwards (numerados 1-8, na ordem) pelos pods calculados
  // acima — recalculado a cada chamada porque muda de zona pra zona (o
  // "sistema" de pods, ao contrário do Plano de Jogo antigo, não fica fixo a
  // partida inteira).
  podInfoForNumber(sizes, num) {
    let cursor = 0;
    for (let podIdx = 0; podIdx < sizes.length; podIdx++) {
      cursor += sizes[podIdx];
      if (num <= cursor) {
        const n = sizes.length;
        const podY = n > 1 ? -0.82 + (1.64 * podIdx) / (n - 1) : 0;
        return {podY, podIndex: podIdx, podCount: n};
      }
    }
    return null;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  drawPitch() {
    const {ctx, width, height} = this;

    // In-goal (área de try) ocupa ~9% de cada lado; campo de jogo fica no meio.
    const inGoalW = width * 0.09;
    const marginY = 22;
    const fieldX0 = inGoalW;
    const fieldX1 = width - inGoalW;
    const fieldW = fieldX1 - fieldX0;
    const fieldH = height - marginY * 2;
    const y0 = marginY;
    const y1 = height - marginY;

    // grama de fundo, com listras de corte alternadas em toda a extensão (in-goal incluído)
    // — tom mais vivo e mais contrastado (referência: campo real de grama
    // cortada, listras bem marcadas, não duas tonalidades quase iguais).
    const stripes = 16;
    const totalW = width;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#3f9e3f' : '#2e8b3a';
      ctx.fillRect((totalW / stripes) * i, 0, totalW / stripes + 1, height);
    }

    // in-goal com leve textura diferenciada (tracejado diagonal)
    [[0, inGoalW], [fieldX1, width]].forEach(([x0, x1]) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, fieldH);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 3;
      for (let d = -fieldH; d < (x1 - x0) + fieldH; d += 14) {
        ctx.beginPath();
        ctx.moveTo(x0 + d, y0);
        ctx.lineTo(x0 + d - fieldH, y0 + fieldH);
        ctx.stroke();
      }
      ctx.restore();
    });

    // contorno do campo de jogo (touchlines + linhas de fundo/try) e do dead-ball
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y0, width, fieldH); // dead-ball lines (bordas externas)

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(fieldX0, y0); ctx.lineTo(fieldX0, y1); // try line A
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fieldX1, y0); ctx.lineTo(fieldX1, y1); // try line B
    ctx.stroke();

    const lineAt = pct => fieldX0 + fieldW * pct;

    // campo de jogo tem 100m (try-line a try-line); 5m = 5%, 22m = 22%, 10m da
    // metade = 40%/60%. Convenção real: 22m e meio de campo são linhas
    // SÓLIDAS; 5m e 10m são tracejadas.
    const marks = [
      {pct: 0.05, dash: true, w: 1, faint: true}, // linha dos 5m, lado A
      {pct: 0.22, dash: false, w: 2},
      {pct: 0.40, dash: true, w: 1, faint: true}, // linha dos 10m (offside de saída), lado A
      {pct: 0.5, dash: false, w: 2.5},
      {pct: 0.60, dash: true, w: 1, faint: true}, // linha dos 10m, lado B
      {pct: 0.78, dash: false, w: 2},
      {pct: 0.95, dash: true, w: 1, faint: true}, // linha dos 5m, lado B
    ];
    marks.forEach(m => {
      ctx.beginPath();
      ctx.setLineDash(m.dash ? [7, 7] : []);
      ctx.lineWidth = m.w;
      ctx.strokeStyle = m.faint ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)';
      ctx.moveTo(lineAt(m.pct), y0);
      ctx.lineTo(lineAt(m.pct), y1);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // linhas de 5m e 15m, paralelas às laterais (largura real de 70m: 5m ≈ 7,1%, 15m ≈ 21,4%).
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    [0.071, 0.214, 0.786, 0.929].forEach(pctY => {
      const y = y0 + fieldH * pctY;
      ctx.beginPath();
      ctx.moveTo(fieldX0, y);
      ctx.lineTo(fieldX1, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // círculo central
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.arc(lineAt(0.5), (y0 + y1) / 2, Math.min(fieldH * 0.16, 28), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('22', lineAt(0.22), y0 - 7);
    ctx.fillText('22', lineAt(0.78), y0 - 7);
    ctx.fillText('50', lineAt(0.5), y0 - 7);

    // bandeirinhas de escanteio (nos 4 cantos do campo de jogo)
    const flagPositions = [
      [fieldX0, y0], [fieldX0, y1], [fieldX1, y0], [fieldX1, y1],
    ];
    flagPositions.forEach(([x, y]) => {
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      const dir = y === y0 ? -1 : 1;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y + dir * 3);
      ctx.lineTo(x, y + dir * 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + dir * 14);
      ctx.stroke();
    });

    // traves (H) centralizadas em cada linha de try, dentro do in-goal —
    // vista de cima: a barra transversal aparece como a linha vertical
    // (largura das traves), e cada ponta é a base de um poste, com a
    // proteção acolchoada vermelha característica dos postes reais.
    const goalY = (y0 + y1) / 2;
    const postGap = Math.min(fieldH * 0.22, 30);
    [{x: fieldX0, dir: -1}, {x: fieldX1, dir: 1}].forEach(({x, dir}) => {
      const postX = x + dir * inGoalW * 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(postX, goalY - postGap);
      ctx.lineTo(postX, goalY + postGap);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(postX - 5, goalY - postGap * 0.35);
      ctx.lineTo(postX + 5, goalY - postGap * 0.35);
      ctx.stroke();

      // almofada vermelha na base de cada poste
      const padH = postGap * 0.3;
      ctx.fillStyle = '#e53935';
      ctx.fillRect(postX - 2.5, goalY - postGap - padH / 2, 5, padH);
      ctx.fillRect(postX - 2.5, goalY + postGap - padH / 2, 5, padH);
    });

    this.fieldGeom = {marginX: fieldX0, marginY: y0, fieldW, fieldH, lineAt, centerY: goalY};
  }

  posToX(pos) {
    const {marginX, fieldW} = this.fieldGeom;
    return marginX + (pos / 100) * fieldW;
  }

  // Fita colorida com as 4 zonas táticas do plano de jogo (mesmas faixas do
  // "tablero de mando territorial" real), com uma seta marcando onde a bola
  // está agora — deixa visível, quadro a quadro, em qual zona a tática de
  // cada time está em vigor.
  drawZoneRibbon(pos) {
    const {ctx, fieldGeom} = this;
    const {marginX, fieldW, marginY} = fieldGeom;
    const y = marginY - 14;
    const h = 6;
    const bounds = [0, 0.22, 0.40, 0.80, 1];
    const keys = ['red', 'orange', 'green', 'yellow'];
    keys.forEach((k, i) => {
      const x0 = marginX + fieldW * bounds[i];
      const x1 = marginX + fieldW * bounds[i + 1];
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = ZONE_RIBBON_COLORS[k];
      ctx.fillRect(x0, y, x1 - x0, h);
    });
    ctx.globalAlpha = 1;

    const x = this.posToX(pos);
    ctx.beginPath();
    ctx.moveTo(x, y + h + 3);
    ctx.lineTo(x - 5, y - 3);
    ctx.lineTo(x + 5, y - 3);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // Info da zona/tática em vigor pro time que está com a iniciativa do jogo
  // agora (attackingTeam) — usado pelo app pra montar o aviso tático (banner)
  // acima do campo, com o código de comunicação daquela zona.
  getActiveZoneInfo(pos) {
    const isA = this.attackingTeam === 'A';
    const team = isA ? this.teamA : this.teamB;
    const plan = isA ? this.gamePlanA : this.gamePlanB;
    const zoneKey = zoneForPos(pos, this.attackingTeam);
    const zoneConf = plan && plan.zones ? plan.zones[zoneKey] : null;
    return {
      team,
      zoneKey,
      style: zoneConf ? zoneConf.style : 'equilibrado',
      code: zoneConf ? zoneConf.code : '',
      system: plan && plan.system ? plan.system : 'ninguno',
    };
  }

  // Formação de scrum: os dois packs (numeração 1-8) se compactam colados na
  // bola, cada time do seu próprio lado (A sempre do lado do seu próprio
  // ingoal, B do seu), em forma de cunha real (não uma linha só): 1ª linha
  // (1/2/3) bem colada e centralizada, 2ª linha (4/5, os segunda-línea)
  // um passo atrás e mais aberta, 3ª linha (6/7, os alas) mais atrás e mais
  // aberta ainda, e o 8 na base, entre os segunda-línea e os alas — igual
  // pros dois packs, já que a ligação em si não muda com a posse. Os backs
  // é que mudam MUITO conforme quem tem a iniciativa (this.attackingTeam):
  // o time que vai atacar já abre a linha, funda e espalhada, pronta pra
  // receber a bola assim que ela sair; o time que defende fica compacto e
  // fechado perto da base do scrum (impedido de avançar pela lei do
  // offside até a bola sair).
  scrumLayout(dot, x) {
    const isForward = dot.kind === 'tight' || dot.kind === 'loose';
    const teamSign = dot.team === 'A' ? -1 : 1;
    if (isForward) {
      const off = SCRUM_PACK_OFFSET[dot.num] || {depth: 4, wide: 0};
      return {px: x + teamSign * off.depth, wideY: off.wide};
    }
    if (dot.num === 9) {
      return {px: x + teamSign * 18, wideY: dot.y * 0.6};
    }
    if (dot.team === this.attackingTeam) {
      return {px: x + teamSign * dot.attackDepth * 0.85, wideY: dot.y};
    }
    return {px: x + teamSign * dot.defenseDepth * 0.6, wideY: dot.y * 0.85};
  }

  // Formação de lineout: fila de forwards perpendicular à linha de touch (o
  // hooker lança de dentro da touch, os demais 7 entram em fila rumo ao
  // centro do campo) — as duas filas, uma de cada time, ficam paralelas e
  // bem próximas, mas com afastamento suficiente pra não se sobrepor (as
  // duas filas inteiras — inclusive os dois hookers — ficavam quase
  // exatamente uma em cima da outra antes, com só 5px de diferença). O 9
  // fica perto da frente da fila, pronto pra receber; os demais backs
  // abrem numa linha padrão, funda e espalhada pela largura toda.
  lineoutLayout(dot, x) {
    const isForward = dot.kind === 'tight' || dot.kind === 'loose';
    const teamOffset = dot.team === 'A' ? -12 : 12;
    if (isForward) {
      if (dot.num === 2) {
        return {px: x + teamOffset, wideY: -0.95};
      }
      const order = [4, 5, 6, 7, 8, 1, 3];
      const slot = order.indexOf(dot.num);
      return {px: x + teamOffset, wideY: -0.82 + (slot / (order.length - 1)) * 0.55};
    }
    const sideSign = dot.team === 'A' ? -1 : 1;
    if (dot.num === 9) {
      return {px: x + sideSign * 14, wideY: -0.12};
    }
    return {px: x + sideSign * dot.attackDepth * 0.9, wideY: dot.y};
  }

  // Pontapé inicial: os 30 jogadores alinhados na linha do meio-campo — o
  // time que bate (B, por convenção) numa fileira compacta logo atrás do
  // centro, o time que recebe (A) espalhado bem mais fundo no seu próprio
  // campo, pronto pra correr com a bola.
  kickoffLayout(dot, x) {
    const isForward = dot.kind === 'tight' || dot.kind === 'loose';
    if (dot.team === 'B') {
      return {px: x + 3, wideY: dot.y};
    }
    const depth = isForward ? 16 : 28;
    return {px: x - depth, wideY: dot.y};
  }

  draw(pos, scoreA, scoreB, minute, matchPhase = 'open') {
    this.drawPitch();
    this.drawZoneRibbon(pos);
    const {ctx, fieldGeom} = this;
    const centerY = fieldGeom.centerY;
    const x = this.posToX(pos);

    this.jitterSeed += 0.09;

    // Time atacante = quem está empurrando o jogo para a frente (posição crescendo = A ataca).
    if (this.lastX !== null) {
      const delta = x - this.lastX;
      if (Math.abs(delta) > 0.05) {
        this.attackingTeam = delta > 0 ? 'A' : 'B';
      }
    }
    this.lastX = x;
    const dirSign = this.attackingTeam === 'A' ? 1 : -1; // sentido do ataque no eixo x

    const trySeq = this.trySequence;
    const inTrySeq = matchPhase === 'try' && !!trySeq;
    const seqProgress = inTrySeq
      ? Math.max(0, Math.min(1, (performance.now() - trySeq.startTime) / trySeq.duration))
      : 0;

    const yTop = fieldGeom.marginY + 10;
    const yBot = fieldGeom.marginY + fieldGeom.fieldH - 10;
    const yHalfSpan = (yBot - yTop) / 2;
    const clampX = v => Math.max(fieldGeom.marginX + 10, Math.min(fieldGeom.marginX + fieldGeom.fieldW - 10, v));
    const clampY = v => Math.max(yTop, Math.min(yBot, v));

    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Estilo de zona em vigor AGORA pra cada equipe, do ponto de vista de
    // quem ataca (ver ZONE_STYLES em engine.js) — muda a forma da linha de
    // ataque: "chute" (saída pelo pé) puxa o time mais fundo e mais estreito
    // (cobertura de chute), "forwards" (jogo corrido/físico) puxa os backs
    // mais colados nos forwards e mais estreitos (bola raramente sai da
    // zona de contato), "equilibrado" mantém a linha padrão.
    const zoneStyleFor = team => {
      const plan = team === 'A' ? this.gamePlanA : this.gamePlanB;
      if (!plan || !plan.zones) return 'equilibrado';
      const zoneKey = zoneForPos(pos, team);
      const z = plan.zones[zoneKey];
      return z ? z.style : 'equilibrado';
    };
    const styleForA = zoneStyleFor('A');
    const styleForB = zoneStyleFor('B');
    const isSetPiece = matchPhase === 'scrum' || matchPhase === 'lineout' || matchPhase === 'kickoff';
    // Pods de forwards da zona atual (ver POD_FORMATIONS em engine.js) — só
    // recalcula uma vez por frame, não por jogador.
    const podSizesA = this.podSizesFor('A', pos);
    const podSizesB = this.podSizesFor('B', pos);

    this.dots.forEach(dot => {
      const isAttacking = dot.team === this.attackingTeam;
      const isForward = dot.kind === 'tight' || dot.kind === 'loose';
      // Forwards balançam pouco (grudados no contato); backs correm mais,
      // então oscilam um pouco mais — mas bem menos que antes, pra não
      // parecer um tremor aleatório. Numa formação parada (scrum/lineout/
      // pontapé inicial) quase não balança, é gente esperando o jogo começar.
      const bobAmp = isSetPiece ? 0.35 : (isForward ? 1.1 : 2);
      const bob = Math.sin(this.jitterSeed + dot.phase) * bobAmp;
      const bobY = Math.cos(this.jitterSeed * 1.2 + dot.phase) * bobAmp;
      let px;
      let wideY = dot.y;

      if (inTrySeq && dot.team === trySeq.team && !isForward) {
        // Linha de três-quartos do time que marcou varre o campo até o
        // escanteio, cada camisa com seu atraso e abertura (ver
        // TRY_SWEEP_DELAY/TRY_SWEEP_WIDE) — a jogada de fases da referência.
        const delay = TRY_SWEEP_DELAY[dot.num] ?? 0.3;
        const localT = Math.max(0, Math.min(1, (seqProgress - delay) / (1 - delay)));
        const posNow = trySeq.startPos + (trySeq.endPos - trySeq.startPos) * localT;
        px = this.posToX(posNow) + bob * 0.5;
        wideY = trySeq.side * (TRY_SWEEP_WIDE[dot.num] ?? 0.5) * localT;
      } else if (matchPhase === 'scrum') {
        ({px, wideY} = this.scrumLayout(dot, x));
      } else if (matchPhase === 'lineout') {
        ({px, wideY} = this.lineoutLayout(dot, x));
      } else if (matchPhase === 'kickoff') {
        ({px, wideY} = this.kickoffLayout(dot, x));
      } else if (isForward) {
        // Forwards do time atacante se espalham nos "pods" do sistema de
        // jogo escolhido (ex.: Irlanda joga vários pods pela largura toda,
        // Argentina fica mais compacta) — cada pod ataca por um canal
        // diferente, com os pods mais largos vindo um pouco mais atrás
        // (apoio chegando de fora). O time que defende continua compacto
        // em volta do ponto de contato, como uma defesa em linha real.
        const depth = dot.kind === 'tight' ? TIGHT_DEPTH : LOOSE_DEPTH;
        const podInfo = isAttacking ? this.podInfoForNumber(dot.team === 'A' ? podSizesA : podSizesB, dot.num) : null;
        if (isAttacking && podInfo && podInfo.podCount > 1) {
          const spread = Math.abs(podInfo.podIndex - (podInfo.podCount - 1) / 2);
          px = x - dirSign * (depth.attack + spread * 2.5) + bob;
          wideY = podInfo.podY;
        } else {
          const side = isAttacking ? -1 : 1; // ataque chega por trás da bola, defesa a encontra pela frente
          const d = isAttacking ? depth.attack : depth.defense;
          px = x + side * dirSign * d + bob;
        }
      } else if (isAttacking) {
        // Backs do ataque: recuam em relação à bola, cada um na sua
        // profundidade típica de linha, ajustada pelo estilo da zona atual.
        const style = dot.team === 'A' ? styleForA : styleForB;
        const depthMul = style === 'chute' ? 1.2 : style === 'forwards' ? 0.72 : 1;
        const widthMul = style === 'chute' ? 0.6 : style === 'forwards' ? 0.5 : 1;
        px = x - dirSign * dot.attackDepth * depthMul + bob;
        wideY = dot.y * widthMul;
      } else {
        // Backs da defesa: avançam em relação à bola, formando a linha defensiva.
        px = x + dirSign * dot.defenseDepth + bob;
      }
      if (isSetPiece) px += bob;

      const py = centerY + wideY * yHalfSpan + bobY;
      const clampedX = clampX(px);
      const clampedY = clampY(py);
      ctx.beginPath();
      ctx.fillStyle = dot.team === 'A' ? this.teamA.color : this.teamB.color;
      ctx.arc(clampedX, clampedY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(dot.num), clampedX, clampedY + 0.5);
    });

    // Bola de rugby de verdade: branca, sem costura de futebol americano —
    // só a forma oval com sombreamento leve pra dar volume. A posição
    // também reage à fase da jogada em vez de ficar sempre grudada no eixo
    // central: sai lateral no line-out (jogada real vem da touch, ver
    // lineoutLayout), ganha destaque nos chutes a gol (bola "no ar" indo
    // pros paus) e balança suavemente em jogo aberto, como se estivesse
    // passando de mão em mão.
    let ballWideY = 0;
    let ballBobY = 0;
    let ballScale = 1;
    let ballX = x;
    if (inTrySeq) {
      // A bola acompanha o progresso geral da jogada (não o atraso de
      // nenhuma camisa em particular), chegando ao escanteio junto com quem
      // termina a jogada — com um leve "estufar" no instante do try.
      const posNow = trySeq.startPos + (trySeq.endPos - trySeq.startPos) * seqProgress;
      ballX = this.posToX(posNow);
      ballWideY = trySeq.side * 0.85 * seqProgress;
      ballBobY = Math.sin(this.jitterSeed * 2) * 1;
      ballScale = 1 + seqProgress * 0.2;
    } else if (matchPhase === 'lineout') {
      ballWideY = -0.85; // lançada da lateral, perto de onde o hooker joga (ver lineoutLayout)
    } else if (matchPhase === 'penalty' || matchPhase === 'dropgoal' || matchPhase === 'try') {
      ballScale = 1.15; // chute a gol: bola maior, "no ar" indo pros paus
      ballBobY = Math.sin(this.jitterSeed * 2) * 1.5;
    } else if (matchPhase !== 'scrum' && matchPhase !== 'kickoff') {
      // jogo aberto/quebra/turnover/knock-on: deriva lateral leve, dando a
      // impressão de bola circulando de mão em mão em vez de presa no meio.
      ballWideY = Math.sin(this.jitterSeed * 0.7) * 0.18;
      ballBobY = Math.cos(this.jitterSeed * 0.9) * 1.2;
    }
    const ballY = centerY + ballWideY * yHalfSpan + ballBobY;

    ctx.save();
    ctx.translate(ballX, ballY);
    ctx.rotate(Math.sin(this.jitterSeed) * 0.15);
    ctx.scale(ballScale, ballScale);
    ctx.beginPath();
    const ballGrad = ctx.createLinearGradient(0, -5.5, 0, 5.5);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.5, '#f2f2f2');
    ballGrad.addColorStop(1, '#d9d9d9');
    ctx.fillStyle = ballGrad;
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Flash "¡TRY!" perto do escanteio, no fim da varredura.
    if (inTrySeq && seqProgress > 0.72) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (seqProgress - 0.72) / 0.18);
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      const flashY = ballY - 18 * trySeq.side;
      ctx.strokeText('¡TRY!', ballX, flashY);
      ctx.fillText('¡TRY!', ballX, flashY);
      ctx.restore();
    }

    this.currentPos = pos;
  }
}

// ---- Escalação visual (campo estático, formação-padrão) -------------------
// Layout percentual (top/left) por número de camisa, de cima (defesa/linha de
// fundo) pra baixo (fullback), no formato tradicional de "prancheta" de time:
// 1-2-3 na frente, 4-5 atrás, 6-8-7 na terceira linha, 9 e 10 no meio, 12-13
// no meio-campo, 11 e 14 bem abertos e 15 solto atrás. 100% responsivo: é só
// percentual dentro de um container com aspect-ratio fixo.
export const FORMATION_POSITIONS = {
  1: {top: '6%', left: '30%'},
  2: {top: '6%', left: '50%'},
  3: {top: '6%', left: '70%'},
  4: {top: '18%', left: '38%'},
  5: {top: '18%', left: '62%'},
  6: {top: '29%', left: '20%'},
  8: {top: '29%', left: '50%'},
  7: {top: '29%', left: '80%'},
  9: {top: '41%', left: '50%'},
  10: {top: '52%', left: '50%'},
  12: {top: '63%', left: '38%'},
  13: {top: '71%', left: '64%'},
  11: {top: '82%', left: '12%'},
  14: {top: '82%', left: '88%'},
  15: {top: '93%', left: '50%'},
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function shortName(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function conditionClass(condition) {
  if (condition == null) return '';
  if (condition < 40) return 'conditionCritical';
  if (condition < 70) return 'conditionLow';
  return '';
}

function shirtHtml(p, teamColor) {
  const pos = FORMATION_POSITIONS[p.number] || {top: '50%', left: '50%'};
  const cond = p.condition != null ? Math.round(p.condition) : 100;
  const emergencyBadge = p.meta && p.meta.emergencyCallUp ? ' 🆘' : '';
  return `
    <div class="shirtSlot ${conditionClass(p.condition)}" style="top:${pos.top}; left:${pos.left};" title="${escapeHtml(p.name)} — ${p.position} — condição ${cond}%">
      <div class="shirt" style="background:${teamColor}">${p.number}</div>
      <div class="shirtName">${escapeHtml(shortName(p.name))}${emergencyBadge}</div>
      <span class="ratingBar shirtCond"><span style="width:${cond}%"></span></span>
    </div>
  `;
}

function benchCardHtml(p, teamColor) {
  const cond = p.condition != null ? Math.round(p.condition) : 100;
  const injured = p.status === 'lesionado';
  return `
    <div class="benchCard ${conditionClass(p.condition)} ${injured ? 'injuredRow' : ''}" title="${escapeHtml(p.name)} — ${p.position}">
      <div class="benchShirt" style="background:${teamColor}">${p.posId}</div>
      <div class="benchName">${escapeHtml(shortName(p.name))}</div>
      ${injured
        ? '<div class="benchInjured">Lesionado</div>'
        : `<span class="ratingBar shirtCond"><span style="width:${cond}%"></span></span>`}
    </div>
  `;
}

// Reaproveitado tanto pela formação estática quanto pelo editor clicável de
// escalação em app.js.
export function renderBenchSectionHtml(bench, teamColor) {
  return bench && bench.length ? `
    <div class="benchSection">
      <div class="benchTitle">Reservas</div>
      <div class="benchRow">${bench.map(p => benchCardHtml(p, teamColor)).join('')}</div>
    </div>
  ` : '';
}

// xv: até 15 jogadores titulares (com .number 1-15 já atribuído).
// bench: reservas (opcional — times procedurais não têm banco).
export function renderFormationHtml(xv, bench, teamColor, title) {
  const shirts = xv.filter(p => FORMATION_POSITIONS[p.number]).map(p => shirtHtml(p, teamColor)).join('');
  const benchHtml = renderBenchSectionHtml(bench, teamColor);

  return `
    <div class="card formationCard">
      ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
      <div class="pitchOuter">
        <div class="pitchLine" style="top:0"></div>
        <div class="pitchLine" style="top:22%"></div>
        <div class="pitchLine solid" style="top:50%"></div>
        <div class="pitchLine" style="top:78%"></div>
        <div class="pitchLine" style="top:100%"></div>
        ${shirts}
      </div>
      ${benchHtml}
    </div>
  `;
}
