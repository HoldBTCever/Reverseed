// Renderização da quadra 2D (campo de rugby completo) e animação da partida ao vivo.

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

export class MatchRenderer {
  constructor(canvas, teamA, teamB) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.teamA = teamA;
    this.teamB = teamB;
    this.dots = this.makeDots();
    this.currentPos = 50;
    this.jitterSeed = 0;
    this.lastX = null;
    this.attackingTeam = 'A';
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
    const stripes = 16;
    const totalW = width;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1c6b2e' : '#1a6329';
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

    // campo de jogo tem 100m (try-line a try-line); 22m = 22%, 10m da metade = 40%/60%.
    const marks = [
      {pct: 0.22, dash: true, w: 1.5},
      {pct: 0.40, dash: true, w: 1, faint: true}, // linha dos 10m (offside de saída), lado A
      {pct: 0.5, dash: false, w: 2.5},
      {pct: 0.60, dash: true, w: 1, faint: true}, // linha dos 10m, lado B
      {pct: 0.78, dash: true, w: 1.5},
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

    // traves (H) centralizadas em cada linha de try, dentro do in-goal
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
    });

    this.fieldGeom = {marginX: fieldX0, marginY: y0, fieldW, fieldH, lineAt, centerY: goalY};
  }

  posToX(pos) {
    const {marginX, fieldW} = this.fieldGeom;
    return marginX + (pos / 100) * fieldW;
  }

  draw(pos, scoreA, scoreB, minute) {
    this.drawPitch();
    const {ctx, fieldGeom} = this;
    const centerY = fieldGeom.centerY;
    const x = this.posToX(pos);

    this.jitterSeed += 0.12;

    // Time atacante = quem está empurrando o jogo para a frente (posição crescendo = A ataca).
    if (this.lastX !== null) {
      const delta = x - this.lastX;
      if (Math.abs(delta) > 0.05) {
        this.attackingTeam = delta > 0 ? 'A' : 'B';
      }
    }
    this.lastX = x;
    const dirSign = this.attackingTeam === 'A' ? 1 : -1; // sentido do ataque no eixo x

    const yTop = fieldGeom.marginY + 10;
    const yBot = fieldGeom.marginY + fieldGeom.fieldH - 10;
    const yHalfSpan = (yBot - yTop) / 2;
    const clampX = v => Math.max(fieldGeom.marginX + 10, Math.min(fieldGeom.marginX + fieldGeom.fieldW - 10, v));
    const clampY = v => Math.max(yTop, Math.min(yBot, v));

    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.dots.forEach(dot => {
      const isAttacking = dot.team === this.attackingTeam;
      const bob = Math.sin(this.jitterSeed + dot.phase) * 3;
      let px;

      if (dot.kind === 'tight' || dot.kind === 'loose') {
        // Forwards das duas equipes disputam junto ao ponto de contato (ruck/maul/scrum/line-out).
        const depth = dot.kind === 'tight' ? TIGHT_DEPTH : LOOSE_DEPTH;
        const side = isAttacking ? -1 : 1; // ataque chega por trás da bola, defesa a encontra pela frente
        const d = isAttacking ? depth.attack : depth.defense;
        px = x + side * dirSign * d + bob;
      } else if (isAttacking) {
        // Backs do ataque: recuam em relação à bola, cada um na sua profundidade típica de linha.
        px = x - dirSign * dot.attackDepth + bob;
      } else {
        // Backs da defesa: avançam em relação à bola, formando a linha defensiva.
        px = x + dirSign * dot.defenseDepth + bob;
      }

      const py = centerY + dot.y * yHalfSpan + Math.cos(this.jitterSeed * 1.2 + dot.phase) * 3;
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

    // bola
    ctx.save();
    ctx.translate(x, centerY);
    ctx.rotate(Math.sin(this.jitterSeed) * 0.15);
    ctx.beginPath();
    ctx.fillStyle = '#5b3a1a';
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();

    this.currentPos = pos;
  }
}
