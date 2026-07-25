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
    this.lastX = null;
    this.attackingTeam = 'A';
  }

  // 5 forwards (disputam a bola no ponto de contato) + 3 backs (linha de ataque/defesa) por time.
  makeDots() {
    const dots = [];
    ['A', 'B'].forEach(team => {
      for (let i = 0; i < 5; i++) {
        dots.push({team, role: 'forward', slot: i, phase: Math.random() * Math.PI * 2});
      }
      for (let i = 0; i < 3; i++) {
        dots.push({team, role: 'back', slot: i, phase: Math.random() * Math.PI * 2});
      }
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
    const ySpan = yBot - yTop;
    const clampX = v => Math.max(fieldGeom.marginX + 8, Math.min(fieldGeom.marginX + fieldGeom.fieldW - 8, v));
    const clampY = v => Math.max(yTop, Math.min(yBot, v));

    this.dots.forEach(dot => {
      const isAttacking = dot.team === this.attackingTeam;
      const bob = Math.sin(this.jitterSeed + dot.phase) * 3;
      let px;
      let py;

      if (dot.role === 'forward') {
        // Forwards das duas equipes disputam junto ao ponto de contato (ruck/maul).
        const side = isAttacking ? -1 : 1; // ataque chega por trás da bola, defesa a encontra pela frente
        px = x + side * dirSign * (6 + dot.slot * 3) + bob;
        py = centerY + (dot.slot - 2) * 9 + Math.cos(this.jitterSeed * 1.2 + dot.phase) * 4;
      } else if (isAttacking) {
        // Backs do ataque: linha diagonal de apoio, atrás da bola e abertos em largura.
        const depth = 22 + dot.slot * 16;
        px = x - dirSign * depth + bob;
        py = centerY + (dot.slot - 1) * ySpan * 0.24;
      } else {
        // Backs da defesa: linha reta cobrindo toda a largura, entre a bola e o próprio ingoal.
        px = x + dirSign * 42 + bob;
        py = yTop + (dot.slot + 0.5) * (ySpan / 3);
      }

      const clampedX = clampX(px);
      const clampedY = clampY(py);
      ctx.beginPath();
      ctx.fillStyle = dot.team === 'A' ? this.teamA.color : this.teamB.color;
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
