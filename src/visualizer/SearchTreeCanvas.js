const PALETTE = {
  background:   '#0c1017',
  gridLine:     'rgba(255, 255, 255, 0.035)',
  gridDot:      'rgba(255, 255, 255, 0.08)',
  closed:       '#3b82f6',
  closedGlow:   'rgba(59, 130, 246, 0.25)',
  current:      '#06b6d4',
  currentGlow:  'rgba(6, 182, 212, 0.45)',
  open:         '#f59e0b',
  openGlow:     'rgba(245, 158, 11, 0.25)',
  solution:     '#10b981',
  solutionGlow: 'rgba(16, 185, 129, 0.45)',
  edge:         'rgba(148, 163, 184, 0.16)',
  solutionEdge: '#10b981',
  text:         '#ffffff',
  textDark:     '#08141f',
  subtext:      '#94a3b8',
  subtextLight: '#64748b',
  emptyTitle:   '#f1f5f9',
  emptyText:    '#94a3b8',
};

const STATUS_COLORS = {
  closed:   PALETTE.closed,
  current:  PALETTE.current,
  open:     PALETTE.open,
  solution: PALETTE.solution,
};

const STATUS_GLOW = {
  closed:   PALETTE.closedGlow,
  current:  PALETTE.currentGlow,
  open:     PALETTE.openGlow,
  solution: PALETTE.solutionGlow,
};

const MAX_DRAWN   = 260;
const NODE_RADIUS = 14;
const ROW_HEIGHT  = 72;
const MARGIN_X    = 50;

export class SearchTreeCanvas {
  constructor(canvas, options = {}) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.onNodeClick = options.onNodeClick || (() => {});
    this.nodes       = new Map();
    this.order       = [];
    this.currentId   = null;
    this.goalId      = null;
    this.solutionIds = new Set();
    this.hitBoxes    = [];
    this.layout      = new Map();

    canvas.addEventListener('click',     (e) => this.handleClick(e));
    canvas.addEventListener('mousemove', (e) => this.handleHover(e));
    canvas.addEventListener('mouseleave', () => { this.hoveredId = null; });
    this.hoveredId = null;

    this.resize();

    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  reset() {
    this.nodes.clear();
    this.order       = [];
    this.currentId   = null;
    this.goalId      = null;
    this.hoveredId   = null;
    this.solutionIds.clear();
    this.hitBoxes    = [];
    this.layout.clear();
  }

  addFrame(frame) {
    const info = frame.currentNode;
    const node = {
      id:       info.id,
      parentId: info.parentId,
      move:     info.moveFromParent,
      g:        info.g,
      h:        info.h,
      f:        info.f,
      state:    info.state,
      status:   'current',
    };

    if (this.nodes.has(info.id)) {
      Object.assign(this.nodes.get(info.id), node);
    } else {
      this.nodes.set(info.id, node);
      this.order.push(info.id);
    }

    if (this.currentId && this.currentId !== info.id) {
      const previous = this.nodes.get(this.currentId);
      if (previous && previous.status === 'current') previous.status = 'closed';
    }
    this.currentId = info.id;

    for (const top of frame.openTopNodes) {
      if (!this.nodes.has(top.id)) {
        this.nodes.set(top.id, {
          id:       top.id,
          parentId: null,
          move:     top.move,
          g:        top.g,
          h:        top.h,
          f:        top.f,
          state:    null,
          status:   'open',
        });
        this.order.push(top.id);
      }
    }

    if (frame.isGoal) {
      this.goalId = info.id;
      this.markSolution(info.id);
    }
  }

  markSolution(goalId = this.goalId) {
    this.solutionIds.clear();
    for (let node = this.nodes.get(goalId); node; node = this.nodes.get(node.parentId)) {
      this.solutionIds.add(node.id);
      node.status = 'solution';
    }
    this.goalId = goalId;
  }

  computeVisible() {
    const visible = new Set();
    for (const id of this.order.slice(-MAX_DRAWN)) visible.add(id);
    for (const id of this.solutionIds) visible.add(id);
    for (let node = this.nodes.get(this.currentId); node; node = this.nodes.get(node.parentId)) {
      visible.add(node.id);
    }
    return visible;
  }

  computeLayout(width) {
    this.layout.clear();
    const visible = this.computeVisible();
    const rows    = new Map();
    for (const id of visible) {
      const node = this.nodes.get(id);
      if (!node) continue;
      if (!rows.has(node.g)) rows.set(node.g, []);
      rows.get(node.g).push(node);
    }
    const maxPerRow = Math.max(4, Math.floor((width - MARGIN_X * 2) / 40));
    for (const [depth, row] of rows) {
      row.sort((a, b) => a.f - b.f || a.id.localeCompare(b.id));
      const drawn = row.slice(-maxPerRow);
      const span  = width - MARGIN_X * 2;
      drawn.forEach((node, index) => {
        const x = MARGIN_X + (drawn.length === 1 ? span / 2 : (index / (drawn.length - 1)) * span);
        const y = 40 + depth * ROW_HEIGHT;
        this.layout.set(node.id, { x, y, node });
      });
    }
  }

  render() {
    const { ctx, canvas } = this;
    const dpr    = window.devicePixelRatio || 1;
    const width  = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    this._drawGrid(ctx, width, height);

    this.computeLayout(width);
    this.hitBoxes = [];

    if (this.layout.size === 0) {
      this._drawEmpty(ctx, width, height);
      return;
    }

    // Draw edges first
    this._drawEdges(ctx);

    // Draw nodes
    const t = (performance.now() % 1500) / 1500;
    const pulse = 1 + 0.2 * Math.sin(t * Math.PI * 2);

    for (const { x, y, node } of this.layout.values()) {
      this._drawNode(ctx, x, y, node, pulse);
      this.hitBoxes.push({ x, y, radius: NODE_RADIUS, node });
    }

    // Hover tooltip
    if (this.hoveredId) {
      const pos = this.layout.get(this.hoveredId);
      if (pos) this._drawTooltip(ctx, pos.x, pos.y, pos.node, width, height);
    }
  }

  _drawGrid(ctx, width, height) {
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth   = 1;
    const spacing   = 40;
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  _drawEmpty(ctx, width, height) {
    const cx = width / 2;
    const cy = height / 2 - 24;

    // Draw minimalist architectural search tree blueprint
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);

    // Root to child 1 & 2
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx - 36, cy + 16);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx + 36, cy + 16);
    ctx.stroke();

    ctx.setLineDash([]);

    // Nodes
    const drawPlaceholderNode = (x, y, r, fill, stroke) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    drawPlaceholderNode(cx, cy - 20, 10, 'rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.6)');
    drawPlaceholderNode(cx - 36, cy + 16, 8, 'rgba(6, 182, 212, 0.2)', 'rgba(6, 182, 212, 0.5)');
    drawPlaceholderNode(cx + 36, cy + 16, 8, 'rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.5)');
    ctx.restore();

    ctx.fillStyle = PALETTE.emptyTitle;
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('State Space Tree Awaiting Search', width / 2, height / 2 + 28);

    ctx.fillStyle = PALETTE.emptyText;
    ctx.font = '400 11px Inter, system-ui, sans-serif';
    ctx.fillText('Scramble the cube and click Solve to stream real-time frontier expansions', width / 2, height / 2 + 48);
  }

  _drawEdges(ctx) {
    for (const { x, y, node } of this.layout.values()) {
      if (!node.parentId) continue;
      const parent  = this.layout.get(node.parentId);
      if (!parent) continue;

      const onPath  = this.solutionIds.has(node.id) && this.solutionIds.has(node.parentId);

      if (onPath) {
        // Glowing solution path
        ctx.shadowColor   = PALETTE.solutionEdge;
        ctx.shadowBlur    = 6;
        ctx.strokeStyle   = PALETTE.solutionEdge;
        ctx.lineWidth     = 2.5;
      } else {
        ctx.shadowBlur    = 0;
        ctx.strokeStyle   = PALETTE.edge;
        ctx.lineWidth     = 1;
      }

      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y + NODE_RADIUS);
      ctx.quadraticCurveTo(
        parent.x,
        (parent.y + y) / 2,
        x,
        y - NODE_RADIUS
      );
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  _drawNode(ctx, x, y, node, pulse) {
    const isCurrent  = node.status === 'current';
    const isSolution = node.status === 'solution';
    const isHovered  = this.hoveredId === node.id;
    const color      = STATUS_COLORS[node.status] || PALETTE.closed;
    const glowColor  = STATUS_GLOW[node.status]   || PALETTE.closedGlow;
    const radius     = isCurrent ? NODE_RADIUS * pulse : NODE_RADIUS;

    // Glow
    if (isCurrent || isSolution || isHovered) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = isCurrent ? 18 : isHovered ? 14 : 10;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Highlight ring
    if (isCurrent) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6, 182, 212, 0.4)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Hover ring
    if (isHovered && !isCurrent) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, 0.35)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Move label inside
    ctx.fillStyle     = isCurrent ? PALETTE.textDark : PALETTE.text;
    ctx.font          = `700 10.5px "JetBrains Mono", monospace`;
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(node.move || '●', x, y);

    // f = g + h label below
    const hLabel = Number.isInteger(node.h) ? node.h : node.h.toFixed(1);
    const fLabel = Number.isInteger(node.f) ? node.f : node.f.toFixed(1);
    ctx.fillStyle    = PALETTE.subtext;
    ctx.font         = `500 9px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(`${node.g}+${hLabel}=${fLabel}`, x, y + radius + 4);
  }

  _drawTooltip(ctx, x, y, node, canvasW, canvasH) {
    const lines = [
      `Node Move: ${node.move || '(Root Start)'}`,
      `g(n) = ${node.g}  •  h(n) = ${typeof node.h === 'number' ? node.h.toFixed(2) : node.h}`,
      `f(n) = ${typeof node.f === 'number' ? node.f.toFixed(2) : node.f}`,
      node.state ? 'Click to preview on 3D cube' : '',
    ].filter(Boolean);

    const pad = 10;
    const lh  = 17;
    const w   = 200;
    const h   = lines.length * lh + pad * 2;
    let tx     = x + NODE_RADIUS + 8;
    let ty     = y - h / 2;

    if (tx + w > canvasW - 8) tx = x - w - NODE_RADIUS - 8;
    if (ty < 8) ty = 8;
    if (ty + h > canvasH - 8) ty = canvasH - h - 8;

    ctx.save();
    ctx.fillStyle    = 'rgba(15, 20, 31, 0.96)';
    ctx.strokeStyle  = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth    = 1;
    ctx.shadowColor  = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur   = 16;
    this._roundRect(ctx, tx, ty, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillStyle = i === lines.length - 1 && node.state
        ? '#38bdf8'
        : i === 0
        ? '#ffffff'
        : '#cbd5e1';
      ctx.font = i === 0
        ? '600 11px Inter, system-ui, sans-serif'
        : i === lines.length - 1 && node.state
        ? '500 10.5px Inter, system-ui, sans-serif'
        : '11px "JetBrains Mono", monospace';
      ctx.fillText(line, tx + pad, ty + pad + i * lh);
    });
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x    = event.clientX - rect.left;
    const y    = event.clientY - rect.top;
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const box = this.hitBoxes[i];
      if (Math.hypot(box.x - x, box.y - y) <= box.radius + 6) {
        this.onNodeClick(box.node);
        return;
      }
    }
  }

  handleHover(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x    = event.clientX - rect.left;
    const y    = event.clientY - rect.top;
    let found  = null;
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const box = this.hitBoxes[i];
      if (Math.hypot(box.x - x, box.y - y) <= box.radius + 6) {
        found = box.node.id;
        break;
      }
    }
    this.hoveredId = found;
    this.canvas.style.cursor = found ? 'pointer' : 'default';
  }

  resize() {
    const dpr    = window.devicePixelRatio || 1;
    const width  = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.canvas.width  = Math.max(1, Math.floor(width  * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
  }
}
