// Renderização da quadra 2D (campo de rugby completo) e animação da partida ao vivo.

export class MatchRenderer {
  constructor(canvas, teamA, teamB) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.teamA = teamA;
    this.teamB = teamB;
    this.dots = this.makeDots();
    this.currentPos = 50;
    this.jitterSeed = 0;
  }

  makeDots() {
    const dots = [];
    for (let i = 0; i < 8; i++) {
      dots.push({team: 'A', dx: (Math.random() - 0.5) * 60, dy: (Math.random() - 0.5) * 140});
    }
    for (let i = 0; i < 8; i++) {
      dots.push({team: 'B', dx: (Math.random() - 0.5) * 60, dy: (Math.random() - 0.5) * 140});
    }
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

    // linhas de 22m, 10m e meio de campo
    const marks = [
      {pct: 0.22, dash: true, w: 1.5},
      {pct: 0.32, dash: true, w: 1, faint: true}, // 10m da linha dos 22
      {pct: 0.5, dash: false, w: 2.5},
      {pct: 0.68, dash: true, w: 1, faint: true},
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

    // marcas de 5m e 15m ao longo das laterais (tick marks)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let p = 0.06; p < 1; p += 0.08) {
      const x = lineAt(p);
      [y0, y1].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + (y === y0 ? 8 : -8));
        ctx.stroke();
      });
    }

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

    this.dots.forEach((dot, i) => {
      const isA = dot.team === 'A';
      const bias = isA ? -50 : 50;
      const followX = x + bias * 0.28 + Math.sin(this.jitterSeed + i) * 10 + dot.dx * 0.35;
      const followY = centerY + dot.dy * 0.9 + Math.cos(this.jitterSeed * 1.3 + i) * 6;
      const clampedX = Math.max(fieldGeom.marginX + 8, Math.min(fieldGeom.marginX + fieldGeom.fieldW - 8, followX));
      const clampedY = Math.max(fieldGeom.marginY + 8, Math.min(fieldGeom.marginY + fieldGeom.fieldH - 8, followY));
      ctx.beginPath();
      ctx.fillStyle = isA ? this.teamA.color : this.teamB.color;
      ctx.arc(clampedX, clampedY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();
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
