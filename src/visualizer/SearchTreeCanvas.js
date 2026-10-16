/**
 * SearchTreeCanvas
 * ---------------------------------------------------------------------------
 * Canvas-2D renderer for the Pocket Cube state-space expansion tree.
 *
 * Public API (stable — the React wrapper depends on it):
 *   new SearchTreeCanvas(canvasElement, { onNodeClick })
 *   .reset()
 *   .addFrame(frame)        // telemetry frame (see contract below)
 *   .markSolution(goalId)
 *   .resize()
 *   .dispose()              // cancels the RAF loop + removes every listener
 *
 * Telemetry frame contract:
 *   { step, algorithm,
 *     currentNode: { id, parentId, moveFromParent, path, state, g, h, f },
 *     openSetCount, closedSetCount,
 *     openTopNodes: [{ id, move, g, h, f }],
 *     isGoal }
 *
 * Semantics: Closed = neutral gray, Frontier/open = light gray (outlined),
 * Exploring/current = signal amber (the single accent), solution path = muted
 * green with thick edges. Redundancy beyond hue: closed nodes are filled, the
 * frontier is an outlined ring, the current node carries a ring, and the
 * solution path is thicker.
 * Node badges show the move label and `g+h=f`.
 *
 * Browser-only (needs a 2D context), dependency-free, valid ESM. Safe to
 * import in Node/SSR: nothing touches `window`/`document` at module scope.
 */

/* ── Palette (dark panel theme) ─────────────────────────────────────────── */

const PALETTE = {
  background:   '#101012',
  gridLine:     'rgba(255, 255, 255, 0.028)',
  gridDot:      'rgba(255, 255, 255, 0.05)',
  closed:       '#5a5f6a',
  closedGlow:   'rgba(255, 255, 255, 0.04)',
  current:      '#e39a3c',
  currentGlow:  'rgba(227, 154, 60, 0.24)',
  open:         '#8b909c',
  openGlow:     'rgba(255, 255, 255, 0.05)',
  solution:     '#57a06b',
  solutionGlow: 'rgba(87, 160, 107, 0.24)',
  edge:         'rgba(255, 255, 255, 0.09)',
  edgeStrong:   'rgba(255, 255, 255, 0.32)',
  solutionEdge: '#57a06b',
  text:         '#ededef',
  textDark:     '#0a0a0b',
  subtext:      '#a1a1aa',
  subtextLight: '#74747d',
  emptyTitle:   '#ededef',
  emptyText:    '#74747d',
  border:       'rgba(255, 255, 255, 0.1)',
  surface:      'rgba(16, 16, 18, 0.96)',
  axis:         'rgba(255, 255, 255, 0.14)',
  axisGuide:    'rgba(255, 255, 255, 0.06)',
  focusRing:    'rgba(255, 255, 255, 0.38)',
  highlightFooter: '#e39a3c',
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

/* ── Layout / rendering constants ───────────────────────────────────────── */

const MAX_DRAWN      = 260;   // rolling cap of nodes drawn (perf)
const HARD_MAX       = MAX_DRAWN + 60;
const NODE_RADIUS    = 14;
const SPRITE_PAD     = 16;    // room for the glow in the cached node sprite
const ROW_HEIGHT     = 68;
const MIN_ROW_HEIGHT = 26;
const MARGIN_X       = 58;
const TOP_PAD        = 54;
const BOTTOM_PAD     = 44;
const GUTTER_X       = 24;
const MIN_CELL       = 66;    // min horizontal step so pills never overlap
const MAX_CELL       = 190;
const PILL_H         = 13;
const MOVE_EASE      = 11;    // position easing rate (1/s)
const ENTER_EASE     = 9;     // fade/scale-in easing rate (1/s)

const FONT_UI   = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_MONO = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

/* ── Small helpers ─────────────────────────────────────────────────────── */

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return { r: 148, g: 163, b: 184 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** amount > 0 lightens toward white, amount < 0 darkens toward black. */
function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c) => Math.round(c + (target - c) * p);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fmtNum(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/* ── Renderer ──────────────────────────────────────────────────────────── */

export class SearchTreeCanvas {
  constructor(canvas, options = {}) {
    this.canvas = canvas || null;
    this.ctx =
      this.canvas && typeof this.canvas.getContext === 'function'
        ? this.canvas.getContext('2d')
        : null;
    this.onNodeClick = (options && options.onNodeClick) || (() => {});

    /* model */
    this.nodes       = new Map();
    this.order       = [];
    this.currentId   = null;
    this.goalId      = null;
    this.solutionIds = new Set();

    /* layout */
    this.layout      = new Map();  // id -> { x, y, depth, node }   (targets)
    this.pos         = new Map();  // id -> { x, y, alpha, scale }  (animated)
    this.rows        = [];         // [{ depth, y, count, dropped }]
    this.rowsHidden  = 0;
    this.hitBoxes    = [];
    this.hoveredId   = null;

    this.stats = { step: 0, algorithm: '', open: 0, closed: 0 };

    /* render state */
    this.disposed    = false;
    this._rafId      = 0;
    this._timerId    = 0;
    this._lastTime   = this._now();
    this._errorCount = 0;
    this._sprites    = new Map();  // status -> { dpr, canvas }
    this._textCache  = new Map();
    this._pattern    = null;
    this._vignette   = null;
    this._detail     = 'full';
    this._layoutScale = 1;
    this._spanX      = 1;

    /* bound listeners (kept so dispose() can remove exactly these) */
    this._onClick = (event) => this.handleClick(event);
    this._onMove  = (event) => this.handleHover(event);
    this._onLeave = () => {
      if (this.hoveredId !== null) {
        this.hoveredId = null;
        this._setCursor(false);
      }
    };

    if (this.canvas && this.canvas.addEventListener) {
      this.canvas.addEventListener('click', this._onClick);
      this.canvas.addEventListener('mousemove', this._onMove);
      this.canvas.addEventListener('mouseleave', this._onLeave);
    }

    /* keep the backing store in sync if the panel is resized by CSS */
    this._observer = null;
    if (typeof ResizeObserver === 'function' && this.canvas) {
      try {
        this._observer = new ResizeObserver(() => {
          if (!this.disposed) this.resize();
        });
        this._observer.observe(this.canvas);
      } catch (_err) {
        this._observer = null;
      }
    }

    this.resize();

    /* render loop (cancelled by dispose()) */
    this._schedule = () => {
      if (this.disposed) return;
      if (typeof requestAnimationFrame === 'function') {
        this._rafId = requestAnimationFrame(this._tick);
      }
    };

    this._tick = (timestamp) => {
      if (this.disposed) return;
      this._rafId = 0;
      const now = typeof timestamp === 'number' ? timestamp : this._now();
      let dt = (now - this._lastTime) / 1000;
      this._lastTime = now;
      if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
      if (dt > 0.1) dt = 0.1;

      try {
        this.render(dt, now);
        this._errorCount = 0;
      } catch (err) {
        /* A broken frame must never kill the visualiser; instead of failing
           forever at 60 fps we back the loop off so a persistent error cannot
           burn the CPU (and a transient one recovers by itself). */
        this._errorCount += 1;
        if (this._errorCount <= 2 && typeof console !== 'undefined' && console.error) {
          console.error('[SearchTreeCanvas] render failed', err);
        }
      }

      if (this.disposed) return;

      if (this._errorCount > 0 && typeof setTimeout === 'function') {
        const delay = Math.min(1000, 120 * Math.pow(2, Math.min(this._errorCount - 1, 3)));
        this._timerId = setTimeout(() => {
          this._timerId = 0;
          this._tick(this._now());
        }, delay);
        return;
      }
      this._schedule();
    };

    this._schedule();
  }

  /* ── Lifecycle ───────────────────────────────────────────────────────── */

  /** Stops the RAF loop and detaches every listener. Idempotent. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this._rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = 0;

    if (this._timerId && typeof clearTimeout === 'function') {
      clearTimeout(this._timerId);
    }
    this._timerId = 0;

    if (this._observer) {
      try { this._observer.disconnect(); } catch (_err) { /* ignore */ }
      this._observer = null;
    }

    const canvas = this.canvas;
    if (canvas && canvas.removeEventListener) {
      canvas.removeEventListener('click', this._onClick);
      canvas.removeEventListener('mousemove', this._onMove);
      canvas.removeEventListener('mouseleave', this._onLeave);
    }

    this.nodes.clear();
    this.order = [];
    this.layout.clear();
    this.pos.clear();
    this.solutionIds.clear();
    this.hitBoxes = [];
    this.rows = [];
    this.rowsHidden = 0;
    this.currentId = null;
    this.goalId = null;
    this.hoveredId = null;
    this._sprites.clear();
    this._textCache.clear();
    this._pattern = null;
    this._vignette = null;
  }

  /** Clears the tree. Safe to call at any time, including mid-search. */
  reset() {
    this.nodes.clear();
    this.order = [];
    this.currentId = null;
    this.goalId = null;
    this.hoveredId = null;
    this.solutionIds.clear();
    this.hitBoxes = [];
    this.layout.clear();
    this.pos.clear();
    this.rows = [];
    this.rowsHidden = 0;
    this.stats = { step: 0, algorithm: '', open: 0, closed: 0 };
    this._setCursor(false);
  }

  /** Matches the canvas backing store to its CSS box (devicePixelRatio aware). */
  resize() {
    if (this.disposed || !this.canvas) return;
    const dpr = this._dpr();
    const width = this._clientWidth();
    const height = this._clientHeight();
    this._syncBackingStore(width, height, dpr);
    this._sprites.clear();       // dpr may have changed → rebuild sprites
    this._textCache.clear();
    this._vignette = null;
    this._pattern = null;
  }

  /* ── Data ingest ─────────────────────────────────────────────────────── */

  addFrame(frame) {
    if (this.disposed || !frame || !frame.currentNode) return;
    const info = frame.currentNode;
    if (info.id === undefined || info.id === null) return;

    const id = info.id;
    let node = this.nodes.get(id);
    if (!node) {
      node = { id, seq: this.order.length, parentId: null, move: null, g: 0, h: 0, f: 0, state: null, status: 'current' };
      this.nodes.set(id, node);
      this.order.push(id);
    }

    node.parentId = info.parentId === undefined ? node.parentId : info.parentId;
    node.move     = info.moveFromParent === undefined ? node.move : info.moveFromParent;
    node.g        = info.g === undefined ? node.g : info.g;
    node.h        = info.h === undefined ? node.h : info.h;
    node.f        = info.f === undefined ? node.f : info.f;
    if (info.state !== undefined && info.state !== null) node.state = info.state;
    if (!this.solutionIds.has(id)) node.status = 'current';

    if (this.currentId !== null && this.currentId !== id) {
      const previous = this.nodes.get(this.currentId);
      if (previous && previous.status === 'current') previous.status = 'closed';
    }
    this.currentId = id;

    const openTop = Array.isArray(frame.openTopNodes) ? frame.openTopNodes : [];
    for (let i = 0; i < openTop.length; i++) {
      const top = openTop[i];
      if (!top || top.id === undefined || top.id === null) continue;
      const existing = this.nodes.get(top.id);
      if (existing) {
        if (typeof top.g === 'number') existing.g = top.g;
        if (typeof top.h === 'number') existing.h = top.h;
        if (typeof top.f === 'number') existing.f = top.f;
        if (!existing.move && top.move) existing.move = top.move;
        if (existing.status !== 'solution' && existing.status !== 'current') {
          existing.status = 'open';
        }
      } else {
        this.nodes.set(top.id, {
          id: top.id,
          seq: this.order.length,
          parentId: null,
          move: top.move || null,
          g: top.g,
          h: top.h,
          f: top.f,
          state: null,
          status: 'open',
        });
        this.order.push(top.id);
      }
    }

    if (Number.isFinite(frame.step)) this.stats.step = frame.step;
    if (frame.algorithm) this.stats.algorithm = frame.algorithm;
    if (Number.isFinite(frame.openSetCount)) this.stats.open = frame.openSetCount;
    if (Number.isFinite(frame.closedSetCount)) this.stats.closed = frame.closedSetCount;

    if (frame.isGoal) {
      this.goalId = id;
      this.markSolution(id);
    }
  }

  /** Walks the parent chain from `goalId` and flags it as the solution path. */
  markSolution(goalId = this.goalId) {
    for (const id of this.solutionIds) {
      const node = this.nodes.get(id);
      if (node && node.status === 'solution') node.status = 'closed';
    }
    this.solutionIds.clear();

    if (goalId === undefined || goalId === null) {
      this.goalId = null;
      return;
    }

    const seen = new Set();
    let node = this.nodes.get(goalId);
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      this.solutionIds.add(node.id);
      node.status = 'solution';
      const parentId = node.parentId;
      node = parentId === undefined || parentId === null ? null : this.nodes.get(parentId);
    }
    this.goalId = goalId;
  }

  /* ── Visibility / layout ─────────────────────────────────────────────── */

  computeVisible() {
    const visible = new Set();
    const start = Math.max(0, this.order.length - MAX_DRAWN);
    for (let i = start; i < this.order.length; i++) visible.add(this.order[i]);

    const keep = new Set();
    this._addChain(keep, this.currentId);
    this._addChain(keep, this.goalId);
    this._addChain(keep, this.hoveredId);
    for (const id of this.solutionIds) keep.add(id);
    for (const id of keep) visible.add(id);

    /* hard ceiling so a pathological frame can never explode the draw cost */
    if (visible.size > HARD_MAX) {
      for (let i = start; i < this.order.length && visible.size > HARD_MAX; i++) {
        const id = this.order[i];
        if (!keep.has(id)) visible.delete(id);
      }
    }
    return visible;
  }

  _addChain(target, id) {
    let node = id === undefined || id === null ? null : this.nodes.get(id);
    let guard = 0;
    while (node && guard++ < 1024) {
      target.add(node.id);
      node = node.parentId === undefined || node.parentId === null
        ? null
        : this.nodes.get(node.parentId);
    }
  }

  _depthOf(node) {
    return Number.isFinite(node.g) ? Math.max(0, Math.round(node.g)) : 0;
  }

  _rowKey(node) {
    const parent = node.parentId === undefined || node.parentId === null
      ? null
      : this.layout.get(node.parentId);
    if (parent) return clamp((parent.x - MARGIN_X) / (this._spanX || 1), 0, 1);
    const total = Math.max(1, this.order.length);
    return clamp(node.seq / total, 0, 1);
  }

  _rowPriority(node) {
    if (node.status === 'current') return 0;
    if (node.status === 'solution') return 1;
    if (node.status === 'open') return 2;
    return 3;
  }

  computeLayout(width, height) {
    this.layout.clear();
    this.rows = [];
    this.rowsHidden = 0;

    const visible = this.computeVisible();
    if (visible.size === 0) return;

    /* group by depth (path cost g) */
    const rowMap = new Map();
    for (const id of visible) {
      const node = this.nodes.get(id);
      if (!node) continue;
      const depth = this._depthOf(node);
      let row = rowMap.get(depth);
      if (!row) { row = []; rowMap.set(depth, row); }
      row.push(node);
    }
    if (rowMap.size === 0) return;

    const spanX = Math.max(0, width - MARGIN_X * 2);
    this._spanX = spanX || 1;
    const usableY = Math.max(40, height - TOP_PAD - BOTTOM_PAD);

    let depths = [...rowMap.keys()].sort((a, b) => a - b);
    let rowHeight = depths.length > 1
      ? Math.min(ROW_HEIGHT, usableY / (depths.length - 1))
      : ROW_HEIGHT;

    /* extremely deep searches: keep the deepest (most relevant) rows readable */
    if (rowHeight < MIN_ROW_HEIGHT && depths.length > 2 && usableY > 0) {
      const maxRows = Math.max(2, Math.floor(usableY / MIN_ROW_HEIGHT) + 1);
      if (depths.length > maxRows) {
        this.rowsHidden = depths.length - maxRows;
        depths = depths.slice(-maxRows);
        rowHeight = Math.min(ROW_HEIGHT, usableY / Math.max(1, depths.length - 1));
      }
    }
    rowHeight = Math.max(14, rowHeight);

    this._detail =
      rowHeight >= 50 ? 'full' : rowHeight >= 32 ? 'compact' : 'minimal';
    this._layoutScale = clamp(rowHeight / ROW_HEIGHT, 0.7, 1);

    const maxPerRow = Math.max(2, Math.floor(spanX / MIN_CELL) + 1);
    const baseY = TOP_PAD;

    for (let r = 0; r < depths.length; r++) {
      const depth = depths[r];
      const row = rowMap.get(depth);

      /* stable ordering: follow the parent's column, else discovery order */
      row.sort((a, b) => (this._rowKey(a) - this._rowKey(b)) || (a.seq - b.seq));

      let chosen = row;
      if (row.length > maxPerRow) {
        const byPriority = row.slice().sort(
          (a, b) => (this._rowPriority(a) - this._rowPriority(b)) || (a.seq - b.seq)
        );
        const keep = new Set();
        for (let i = 0; i < maxPerRow; i++) keep.add(byPriority[i].id);
        chosen = row.filter((node) => keep.has(node.id));
      }

      const count = chosen.length;
      const cell = count > 1
        ? clamp(spanX / (count - 1), MIN_CELL, MAX_CELL)
        : 0;
      const rowSpan = Math.min(spanX, cell * Math.max(0, count - 1));
      const startX = MARGIN_X + (spanX - rowSpan) / 2;
      const y = baseY + r * rowHeight;

      for (let i = 0; i < count; i++) {
        const node = chosen[i];
        const x = count === 1
          ? MARGIN_X + spanX / 2
          : startX + (i / (count - 1)) * rowSpan;
        this.layout.set(node.id, { x, y, depth, node });
      }

      this.rows.push({ depth, y, count, dropped: row.length - count });
    }
  }

  /** Eases every node toward its layout target (entrance, reflow, fade-out). */
  updatePositions(dt) {
    const pos = this.pos;
    const moveK = 1 - Math.exp(-MOVE_EASE * dt);
    const enterK = 1 - Math.exp(-ENTER_EASE * dt);

    for (const [id, target] of this.layout) {
      let p = pos.get(id);
      if (!p) {
        const parentId = target.node.parentId;
        const parent = parentId === undefined || parentId === null ? null : pos.get(parentId);
        p = {
          x: parent ? parent.x : target.x,
          y: parent ? parent.y : target.y,
          alpha: 0,
          scale: parent ? 0.55 : 0.85,
        };
        pos.set(id, p);
      }
      p.x += (target.x - p.x) * moveK;
      p.y += (target.y - p.y) * moveK;
      p.alpha += (1 - p.alpha) * enterK;
      p.scale += (1 - p.scale) * enterK;
    }

    /* nodes that dropped out of the visible window fade away, then vanish */
    for (const [id, p] of pos) {
      if (this.layout.has(id)) continue;
      p.alpha -= p.alpha * enterK * 1.6;
      if (p.alpha < 0.02) pos.delete(id);
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  render(dt = 1 / 60, now = this._now()) {
    if (this.disposed) return;
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const dpr = this._dpr();
    const width = this._clientWidth();
    const height = this._clientHeight();
    this._syncBackingStore(width, height, dpr);

    if (width < 4 || height < 4) {
      /* nothing meaningful to paint (collapsed panel / zero-size canvas) */
      this.hitBoxes = [];
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, width, height);

    this._drawBackdrop(ctx, width, height);

    if (this.nodes.size === 0) {
      this.hitBoxes = [];
      this.layout.clear();
      this.pos.clear();
      this.rows = [];
      this._drawEmpty(ctx, width, height, now);
      return;
    }

    this.computeLayout(width, height);
    if (this.layout.size === 0) {
      this.hitBoxes = [];
      this._drawEmpty(ctx, width, height, now);
      return;
    }

    this.updatePositions(dt);

    const focus = this._computeFocus();
    const hitBoxes = [];

    this._drawDepthAxis(ctx, width, height);
    this._drawEdges(ctx, focus);
    this._drawNodes(ctx, width, height, now, focus, hitBoxes);
    this.hitBoxes = hitBoxes;

    this._drawOverlay(ctx, width);
    this._drawTooltip(ctx, width, height);
  }

  _computeFocus() {
    const ids = new Set();
    const hovering = this.hoveredId !== null && this.hoveredId !== undefined;
    for (const id of this.solutionIds) ids.add(id);
    this._addChain(ids, this.currentId);
    this._addChain(ids, this.goalId);
    if (hovering) this._addChain(ids, this.hoveredId);
    return { ids, hovering };
  }

  /* ── Backdrop ────────────────────────────────────────────────────────── */

  _drawBackdrop(ctx, width, height) {
    const pattern = this._dotPattern(ctx);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = PALETTE.gridDot;
      const spacing = 32;
      for (let y = spacing; y < height; y += spacing) {
        for (let x = spacing; x < width; x += spacing) ctx.fillRect(x, y, 1, 1);
      }
    }

    const key = width + 'x' + height;
    if (!this._vignette || this._vignette.key !== key) {
      const grad = ctx.createRadialGradient(
        width * 0.5, height * 0.42, Math.min(width, height) * 0.12,
        width * 0.5, height * 0.52, Math.max(width, height) * 0.78
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.020)');
      grad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
      this._vignette = { key, grad };
    }
    ctx.fillStyle = this._vignette.grad;
    ctx.fillRect(0, 0, width, height);
  }

  _dotPattern(ctx) {
    if (this._pattern) return this._pattern;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }
    try {
      const tile = document.createElement('canvas');
      tile.width = 32;
      tile.height = 32;
      const tctx = tile.getContext('2d');
      if (!tctx) return null;
      tctx.fillStyle = PALETTE.gridDot;
      tctx.fillRect(31, 31, 1, 1);
      this._pattern = ctx.createPattern(tile, 'repeat');
      return this._pattern;
    } catch (_err) {
      return null;
    }
  }

  /* ── Depth axis ──────────────────────────────────────────────────────── */

  _drawDepthAxis(ctx, width, height) {
    const rows = this.rows;
    if (!rows.length || width < 130) return;

    const count = rows.length;
    const xAt = (i) => GUTTER_X + (count > 1 ? (i / (count - 1)) * 6 : 0);
    const currentDepth = this.currentId === null
      ? -1
      : this._depthOf(this.nodes.get(this.currentId) || {});

    ctx.save();
    ctx.lineWidth = 1;

    /* faint horizontal depth rules */
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = PALETTE.axisGuide;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const y = rows[i].y + 0.5;
      if (y < 10 || y > height - 10) continue;
      ctx.moveTo(GUTTER_X + 12, y);
      ctx.lineTo(width - 14, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    /* slight diagonal spine through the depth ticks */
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = xAt(i);
      if (i === 0) ctx.moveTo(x, rows[i].y);
      else ctx.lineTo(x, rows[i].y);
    }
    ctx.strokeStyle = PALETTE.axis;
    ctx.stroke();

    /* ticks + depth labels */
    ctx.font = `500 9px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const x = xAt(i);
      const y = rows[i].y;
      if (y < 6 || y > height - 6) continue;

      ctx.beginPath();
      ctx.moveTo(x - 4, y + 0.5);
      ctx.lineTo(x + 4, y + 0.5);
      ctx.strokeStyle = PALETTE.axis;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.fill();

      ctx.fillStyle = rows[i].depth === currentDepth
        ? rgba(PALETTE.current, 0.9)
        : PALETTE.subtextLight;
      ctx.fillText(`d${rows[i].depth}`, x - 8, y);
    }

    if (rows[0].y > 44 && height > 180 && count >= 3) {
      ctx.save();
      ctx.translate(6, rows[0].y - 10);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `600 8.5px ${FONT_UI}`;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('DEPTH', 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ── Edges ───────────────────────────────────────────────────────────── */

  _drawEdges(ctx, focus) {
    const normal = [];
    const faint = [];
    const strong = [];
    const solution = [];
    const radius = NODE_RADIUS * (this._layoutScale || 1);

    for (const [id, entry] of this.layout) {
      const node = entry.node;
      const parentId = node.parentId;
      if (parentId === undefined || parentId === null) continue;
      if (!this.layout.has(parentId)) continue;

      const a = this.pos.get(parentId);
      const b = this.pos.get(id);
      if (!a || !b) continue;
      const alpha = Math.min(a.alpha, b.alpha);
      if (alpha < 0.12) continue;

      const edge = { a, b, radius };
      const isSolution = this.solutionIds.has(id) && this.solutionIds.has(parentId);
      const isFocus = focus.ids.has(id) && focus.ids.has(parentId);

      if (isSolution) solution.push(edge);
      else if (isFocus) strong.push(edge);
      else if (focus.hovering) faint.push(edge);
      else normal.push(edge);
    }

    this._strokeEdgeBatch(ctx, faint, PALETTE.edge, 1, 0.38);
    this._strokeEdgeBatch(ctx, normal, PALETTE.edge, 1, 1);
    this._strokeEdgeBatch(ctx, strong, PALETTE.edgeStrong, 1.6, 1);
    this._strokeEdgeBatch(ctx, solution, PALETTE.solutionEdge, 2.4, 1, 10);
  }

  /** One path per style bucket → a single stroke call for potentially 250 edges. */
  _strokeEdgeBatch(ctx, edges, color, lineWidth, alpha, glow = 0) {
    if (!edges.length) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.beginPath();
    for (let i = 0; i < edges.length; i++) {
      const { a, b, radius } = edges[i];
      const x1 = a.x;
      const y1 = a.y + radius;
      const x2 = b.x;
      const y2 = b.y - radius;
      const dy = y2 - y1;
      ctx.moveTo(x1, y1);
      if (dy > 2) {
        ctx.bezierCurveTo(x1, y1 + dy * 0.42, x2, y2 - dy * 0.42, x2, y2);
      } else {
        ctx.lineTo(x2, y2);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ── Nodes ───────────────────────────────────────────────────────────── */

  _drawNodes(ctx, width, height, now, focus, hitBoxes) {
    const detail = this._detail;
    const layoutScale = this._layoutScale || 1;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
    const dense = this.nodes.size > 24;

    for (const [id, entry] of this.layout) {
      const p = this.pos.get(id);
      if (!p || p.alpha <= 0.01) continue;
      const node = entry.node;

      const isCurrent = node.status === 'current';
      const isSolution = node.status === 'solution';
      const isHovered = this.hoveredId === id;
      const isAncestor = focus.hovering && !isHovered && focus.ids.has(id);

      let alpha = p.alpha;
      if (focus.hovering && !focus.ids.has(id) && !isHovered) {
        alpha *= isCurrent ? 1 : 0.45;
      } else if (dense && node.status === 'closed' && !focus.ids.has(id)) {
        alpha *= 0.58;
      }

      const scale = layoutScale * p.scale * (isCurrent ? 1 + 0.05 * pulse : 1);
      const x = p.x;
      const y = p.y;
      const r = NODE_RADIUS * scale;

      if (x < -40 || x > width + 40 || y < -40 || y > height + 40) continue;
      if (alpha <= 0.02) continue;

      /* body */
      ctx.globalAlpha = alpha;
      const sprite = this._nodeSprite(node.status);
      if (sprite) {
        const size = (NODE_RADIUS + SPRITE_PAD) * 2 * scale;
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = STATUS_COLORS[node.status] || PALETTE.closed;
        ctx.fill();
      }

      /* pulsing halo for the node currently being expanded */
      if (isCurrent) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3 + 4 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(PALETTE.current, 0.35 * (1 - pulse) + 0.08);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* breadcrumb ring for ancestors of the hovered node */
      if (isAncestor) {
        ctx.beginPath();
        ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.focusRing;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* move label inside the node */
      const fontSize = Math.max(7, Math.round(10.5 * scale));
      ctx.font = `700 ${fontSize}px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.textDark;
      ctx.fillText(node.move ? String(node.move) : '●', x, y + 0.5);

      /* rounded-rect badge with g+h=f */
      const showPill =
        detail === 'full' || isCurrent || isHovered || isSolution || isAncestor;
      if (showPill && y + r + PILL_H < height - 4) {
        const gLabel = fmtNum(node.g);
        const hLabel = fmtNum(node.h);
        const fLabel = fmtNum(node.f);
        const label =
          detail === 'minimal' && !(isCurrent || isHovered)
            ? hLabel
            : `${gLabel}+${hLabel}=${fLabel}`;
        this._drawPill(
          ctx, x, y + r + 3, label,
          STATUS_COLORS[node.status] || PALETTE.closed,
          alpha,
          detail === 'minimal' ? 0 : (isCurrent ? 1 : 0.85)
        );
      }

      ctx.globalAlpha = 1;
      hitBoxes.push({ x, y, radius: r, node });
    }
    ctx.globalAlpha = 1;
  }

  _drawPill(ctx, cx, top, text, color, alpha, textAlpha) {
    if (textAlpha <= 0) return;
    const w = this._measure(ctx, text, `500 9px ${FONT_MONO}`) + 12;
    const x = cx - w / 2;
    const radius = 4;

    ctx.globalAlpha = alpha * 0.92;
    this._roundRect(ctx, x, top, w, PILL_H, radius);
    ctx.fillStyle = 'rgba(10, 14, 22, 0.78)';
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.34);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = alpha * textAlpha;
    ctx.font = `500 9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = shade(color, 0.42);
    ctx.fillText(text, cx, top + PILL_H / 2 + 0.5);
    ctx.globalAlpha = 1;
  }

  /* Cached per-status node sprite: gradient body + rings (+ soft glow). */
  _nodeSprite(status) {
    const dpr = this._dpr();
    const cached = this._sprites.get(status);
    if (cached && cached.dpr === dpr) return cached.canvas;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }

    const size = (NODE_RADIUS + SPRITE_PAD) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(size * dpr));
    canvas.height = Math.max(1, Math.ceil(size * dpr));
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const color = STATUS_COLORS[status] || PALETTE.closed;
    const glowColor = STATUS_GLOW[status] || PALETTE.closedGlow;

    /* glow only where it is meaningful: the live frontier pointer + solution */
    const glowPad = status === 'current' ? SPRITE_PAD : status === 'solution' ? SPRITE_PAD * 0.7 : 0;
    if (glowPad > 0) {
      const halo = g.createRadialGradient(cx, cy, NODE_RADIUS * 0.85, cx, cy, NODE_RADIUS + glowPad);
      halo.addColorStop(0, glowColor);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(cx, cy, NODE_RADIUS + glowPad, 0, Math.PI * 2);
      g.fill();
    }

    /* radial gradient body */
    const body = g.createRadialGradient(
      cx - NODE_RADIUS * 0.34, cy - NODE_RADIUS * 0.42, NODE_RADIUS * 0.12,
      cx, cy, NODE_RADIUS
    );
    body.addColorStop(0, shade(color, 0.5));
    body.addColorStop(0.55, color);
    body.addColorStop(1, shade(color, -0.4));
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, NODE_RADIUS, 0, Math.PI * 2);
    g.fill();

    /* thin inner highlight ring */
    g.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, NODE_RADIUS - 0.8, 0, Math.PI * 2);
    g.stroke();

    /* dark outer contour so nodes read against the panel */
    g.strokeStyle = 'rgba(8, 15, 25, 0.6)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(cx, cy, NODE_RADIUS + 0.5, 0, Math.PI * 2);
    g.stroke();

    this._sprites.set(status, { dpr, canvas });
    return canvas;
  }

  /* ── Empty / awaiting state ──────────────────────────────────────────── */

  _drawEmpty(ctx, width, height, now) {
    if (width < 60 || height < 60) return;
    const cx = width / 2;
    const cy = height / 2;
    const compact = width < 320 || height < 220;
    const breath = 0.5 + 0.5 * Math.sin(now * 0.0016);
    const scale = compact ? 0.8 : 1;
    const rootY = cy - 44 * scale;

    /* soft glow behind the blueprint */
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.42);
    halo.addColorStop(0, `rgba(59, 130, 246, ${0.05 + 0.03 * breath})`);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    const children = [
      { dx: -42, dy: 40, color: PALETTE.closed, alpha: 0.55 },
      { dx: 0, dy: 26, color: PALETTE.open, alpha: 0.55 },
      { dx: 42, dy: 40, color: PALETTE.closed, alpha: 0.55 },
    ];

    ctx.save();
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = `rgba(148, 163, 184, ${0.14 + 0.06 * breath})`;
    ctx.beginPath();
    for (const child of children) {
      const x2 = cx + child.dx * scale;
      const y2 = rootY + child.dy * scale;
      ctx.moveTo(cx, rootY + 10 * scale);
      ctx.bezierCurveTo(
        cx, rootY + child.dy * 0.4 * scale,
        x2, y2 - child.dy * 0.4 * scale,
        x2, y2 - 8 * scale
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const node = (x, y, r, color, alpha) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, alpha * 0.22);
      ctx.fill();
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };

    node(cx, rootY, 11 * scale, PALETTE.current, 0.5 + 0.3 * breath);
    for (const child of children) {
      node(cx + child.dx * scale, rootY + child.dy * scale, 8 * scale, child.color, child.alpha);
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.emptyTitle;
    ctx.font = `600 ${compact ? 12 : 13}px ${FONT_UI}`;
    ctx.fillText('State space tree awaiting search', cx, rootY + 92 * scale);

    if (!compact) {
      ctx.fillStyle = PALETTE.emptyText;
      ctx.font = `400 11px ${FONT_UI}`;
      ctx.fillText(
        'Scramble the cube and click Solve to stream real-time frontier expansions',
        cx, rootY + 112 * scale
      );
    }
  }

  /* ── Overlay: live stats line ────────────────────────────────────────── */

  _drawOverlay(ctx, width) {
    // The legend lives in the panel header (crisp, accessible DOM), so the canvas
    // only carries the compact live stats line.
    this._drawStatsChip(ctx, width);
  }

  _drawStatsChip(ctx, width) {
    if (width < 200) return;
    const parts = [];
    if (this.stats.algorithm) parts.push(String(this.stats.algorithm));
    if (this.stats.step) parts.push(`step ${this.stats.step}`);
    if (this.stats.open) parts.push(`|O| ${this.stats.open}`);
    if (this.stats.closed) parts.push(`|C| ${this.stats.closed}`);
    if (this.rowsHidden > 0) parts.push(`▲ ${this.rowsHidden} shallower depths hidden`);
    if (!parts.length) return;

    ctx.save();
    ctx.font = `500 9.5px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.subtextLight;
    ctx.fillText(parts.join('  ·  '), width - 14, 14.5);
    ctx.restore();
  }

  /* ── Tooltip ─────────────────────────────────────────────────────────── */

  _drawTooltip(ctx, width, height) {
    const id = this.hoveredId;
    if (id === null || id === undefined) return;
    if (width < 150 || height < 96) return;

    const node = this.nodes.get(id);
    const p = this.pos.get(id);
    if (!node || !p) return;

    const status = node.status || 'closed';
    const color = STATUS_COLORS[status] || PALETTE.closed;
    const depth = this._depthOf(node);
    const title = node.move ? `Move ${node.move}` : 'Root state';
    const rows = [
      ['g', fmtNum(node.g)],
      ['h', fmtNum(node.h)],
      ['f', `${fmtNum(node.g)} + ${fmtNum(node.h)} = ${fmtNum(node.f)}`],
      ['depth', `d${depth}`],
    ];

    const pad = 11;
    const titleFont = `600 11px ${FONT_UI}`;
    const labelFont = `500 9px ${FONT_MONO}`;
    const valueFont = `500 10px ${FONT_MONO}`;
    const footFont = `500 10px ${FONT_UI}`;
    const footer = node.state ? 'Click to preview on 3D cube' : '';

    let contentW = this._measure(ctx, title, titleFont);
    for (const [label, value] of rows) {
      const w = this._measure(ctx, label, labelFont) + this._measure(ctx, value, valueFont) + 18;
      if (w > contentW) contentW = w;
    }
    if (footer) {
      const w = this._measure(ctx, footer, footFont);
      if (w > contentW) contentW = w;
    }

    const boxW = clamp(contentW + pad * 2 + 8, 168, Math.max(168, width - 24));
    const boxH = pad * 2 + 18 + rows.length * 15 + (footer ? 20 : 0) + 6;

    let tx = p.x + NODE_RADIUS + 14;
    let ty = p.y - boxH / 2;
    if (tx + boxW > width - 8) tx = p.x - boxW - NODE_RADIUS - 14;
    tx = clamp(tx, 8, Math.max(8, width - boxW - 8));
    ty = clamp(ty, 8, Math.max(8, height - boxH - 8));

    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    this._roundRect(ctx, tx, ty, boxW, boxH, 9);
    ctx.fillStyle = 'rgba(24, 24, 28, 0.97)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    /* status accent bar */
    ctx.beginPath();
    ctx.arc(tx + 6, ty + 10, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.font = titleFont;
    ctx.textAlign = 'left';
    ctx.fillText(title, tx + pad + 4, ty + pad + 5);

    let y = ty + pad + 22;
    for (const [label, value] of rows) {
      ctx.font = labelFont;
      ctx.fillStyle = PALETTE.subtextLight;
      ctx.textAlign = 'left';
      ctx.fillText(label, tx + pad + 4, y);

      ctx.font = valueFont;
      ctx.fillStyle = PALETTE.subtext;
      ctx.textAlign = 'right';
      ctx.fillText(value, tx + boxW - pad, y);
      y += 15;
    }

    if (footer) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + pad, y - 4.5);
      ctx.lineTo(tx + boxW - pad, y - 4.5);
      ctx.stroke();

      ctx.font = footFont;
      ctx.fillStyle = PALETTE.highlightFooter;
      ctx.textAlign = 'left';
      ctx.fillText(footer, tx + pad + 4, y + 7);
    }
    ctx.restore();
  }

  /* ── Geometry / measurement utilities ────────────────────────────────── */

  _measure(ctx, text, font) {
    const key = font + '\u0000' + text;
    let w = this._textCache.get(key);
    if (w === undefined) {
      const previous = ctx.font;
      ctx.font = font;
      w = ctx.measureText(text).width;
      ctx.font = previous;
      if (this._textCache.size > 800) this._textCache.clear();
      this._textCache.set(key, w);
    }
    return w;
  }

  _roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  _dpr() {
    const raw = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const value = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
    return clamp(value, 1, 3); // guard against absurd DPRs on tiny panels
  }

  _clientWidth() {
    const canvas = this.canvas;
    if (!canvas) return 0;
    if (typeof canvas.clientWidth === 'number') {
      return Math.max(0, Math.floor(canvas.clientWidth));
    }
    /* no CSS box available (detached canvas): derive from the backing store */
    return Math.max(0, Math.floor((canvas.width || 0) / this._dpr()));
  }

  _clientHeight() {
    const canvas = this.canvas;
    if (!canvas) return 0;
    if (typeof canvas.clientHeight === 'number') {
      return Math.max(0, Math.floor(canvas.clientHeight));
    }
    return Math.max(0, Math.floor((canvas.height || 0) / this._dpr()));
  }

  _syncBackingStore(width, height, dpr) {
    if (!this.canvas) return;
    const bw = Math.max(1, Math.round(width * dpr));
    const bh = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
  }

  _now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /* ── Interaction ─────────────────────────────────────────────────────── */

  handleClick(event) {
    if (this.disposed) return;
    const hit = this._hitTest(event);
    if (hit) this.onNodeClick(hit);
  }

  handleHover(event) {
    if (this.disposed) return;
    const hit = this._hitTest(event);
    const id = hit ? hit.id : null;
    if (id !== this.hoveredId) this.hoveredId = id;
    this._setCursor(Boolean(hit));
  }

  _hitTest(event) {
    const canvas = this.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const box = this.hitBoxes[i];
      if (Math.hypot(box.x - x, box.y - y) <= box.radius + 6) return box.node;
    }
    return null;
  }

  _setCursor(isPointer) {
    const canvas = this.canvas;
    if (!canvas || !canvas.style) return;
    const next = isPointer ? 'pointer' : 'default';
    if (canvas.style.cursor !== next) canvas.style.cursor = next;
  }
}
