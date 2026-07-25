// Renderização da quadra 2D e animação da partida ao vivo.

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
    ctx.fillStyle = '#1c6b2e';
    ctx.fillRect(0, 0, width, height);

    // faixas de grama
    const stripes = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < stripes; i += 2) {
      ctx.fillRect((width / stripes) * i, 0, width / stripes, height);
    }

    const marginX = 30;
    const marginY = 24;
    const fieldW = width - marginX * 2;
    const fieldH = height - marginY * 2;

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(marginX, marginY, fieldW, fieldH);

    const lineAt = pct => marginX + fieldW * pct;
    ctx.setLineDash([6, 6]);
    [0.05, 0.22, 0.5, 0.78, 0.95].forEach((pct, idx) => {
      ctx.beginPath();
      ctx.lineWidth = pct === 0.5 ? 2.5 : 1.5;
      ctx.strokeStyle = (pct === 0.05 || pct === 0.95) ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      ctx.setLineDash(pct === 0.05 || pct === 0.95 || pct === 0.5 ? [] : [6, 6]);
      ctx.moveTo(lineAt(pct), marginY);
      ctx.lineTo(lineAt(pct), marginY + fieldH);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('22', lineAt(0.22), marginY - 8);
    ctx.fillText('22', lineAt(0.78), marginY - 8);
    ctx.fillText('50', lineAt(0.5), marginY - 8);

    this.fieldGeom = {marginX, marginY, fieldW, fieldH, lineAt};
  }

  posToX(pos) {
    const {marginX, fieldW} = this.fieldGeom;
    return marginX + (pos / 100) * fieldW;
  }

  draw(pos, scoreA, scoreB, minute) {
    this.drawPitch();
    const {ctx, fieldGeom} = this;
    const centerY = fieldGeom.marginY + fieldGeom.fieldH / 2;
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
