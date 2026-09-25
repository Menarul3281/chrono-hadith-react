/* Mini network canvas — draws a centered node with spokes to related nodes.
   Reusable across the narrator page and (later) the full Graph page. */

const NetworkGraph = (() => {
  class Graph {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.center = opts.center || null;
      this.nodes = opts.nodes || [];
      this.edges = opts.edges || [];
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      this.hover = null;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.hoveredId = null;
      this._bound = false;

      this.resize();
      this.bind();
      this.loop();

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
    }

    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      this.w = Math.max(200, r.width);
      this.h = Math.max(200, r.height);
      this.canvas.width = this.w * this.dpr;
      this.canvas.height = this.h * this.dpr;
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.layout();
    }

    layout() {
      if (!this.center) return;
      const cw = this.w, ch = this.h;
      const cx = cw / 2, cy = ch / 2;
      const r = Math.min(cw, ch) * 0.34;

      this.centerPos = { x: cx, y: cy };

      // Distribute nodes around the center, alternating up and down
      const up = this.nodes.filter((n) => n.side === 'up');
      const down = this.nodes.filter((n) => n.side === 'down');
      const left = this.nodes.filter((n) => !n.side);

      const place = (list, angleStart, angleEnd) => {
        list.forEach((n, i) => {
          const t = list.length === 1 ? 0.5 : i / (list.length - 1);
          const angle = angleStart + (angleEnd - angleStart) * t;
          n._x = cx + Math.cos(angle) * r;
          n._y = cy + Math.sin(angle) * r * 0.9;
        });
      };

      // up: top half, spread from -140° to -40°
      place(up, -Math.PI * 0.78, -Math.PI * 0.22);
      // down: bottom half, spread from 40° to 140°
      place(down, Math.PI * 0.22, Math.PI * 0.78);
      // left: sides
      place(left, Math.PI * 0.85, Math.PI * 1.15);
    }

    draw() {
      const c = this.ctx;
      c.clearRect(0, 0, this.w, this.h);

      if (!this.center || !this.centerPos) return;

      const cx = this.centerPos.x;
      const cy = this.centerPos.y;

      // Draw edges
      for (const n of this.nodes) {
        const isHover = this.hoveredId === n.id;
        c.save();
        c.strokeStyle = n.color || 'rgba(52, 246, 193, 0.35)';
        c.lineWidth = isHover ? 2 : 1.2;
        c.globalAlpha = isHover ? 0.9 : 0.4;
        c.beginPath();
        c.moveTo(cx, cy);
        // Orthogonal-ish route (PCB style)
        const midY = cy + (n._y - cy) * 0.4;
        c.lineTo(cx, midY);
        c.lineTo(n._x, midY);
        c.lineTo(n._x, n._y);
        c.stroke();
        c.restore();
      }

      // Draw center
      const cg = c.createRadialGradient(cx, cy, 4, cx, cy, 40);
      cg.addColorStop(0, 'rgba(52, 246, 193, 0.3)');
      cg.addColorStop(1, 'rgba(52, 246, 193, 0)');
      c.fillStyle = cg;
      c.beginPath();
      c.arc(cx, cy, 40, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.arc(cx, cy, 20, 0, Math.PI * 2);
      c.fillStyle = '#071722';
      c.fill();
      c.strokeStyle = '#34f6c1';
      c.lineWidth = 2;
      c.stroke();

      // Draw nodes
      for (const n of this.nodes) {
        const isHover = this.hoveredId === n.id;
        const r = isHover ? 16 : 13;
        c.save();

        if (isHover) {
          c.shadowBlur = 18;
          c.shadowColor = n.color || '#34f6c1';
        }

        c.beginPath();
        c.arc(n._x, n._y, r, 0, Math.PI * 2);
        c.fillStyle = '#071722';
        c.fill();
        c.strokeStyle = n.color || '#34f6c1';
        c.lineWidth = isHover ? 2.4 : 1.5;
        c.stroke();
        c.restore();

        // Label
        c.fillStyle = isHover ? '#34f6c1' : '#b7cad3';
        c.font = '500 10px Inter, system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        const label = n.short || n.label;
        c.fillText(label, n._x, n._y + r + 6);
      }
    }

    pos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    hit(x, y) {
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (Math.hypot(x - n._x, y - n._y) < 18) return n.id;
      }
      return null;
    }

    bind() {
      if (this._bound) return;
      this._bound = true;

      this.canvas.addEventListener('pointermove', (e) => {
        const p = this.pos(e);
        const h = this.hit(p.x, p.y);
        if (h !== this.hoveredId) {
          this.hoveredId = h;
          this.canvas.style.cursor = h ? 'pointer' : 'default';
        }
      });

      this.canvas.addEventListener('pointerleave', () => {
        this.hoveredId = null;
        this.canvas.style.cursor = 'default';
      });

      this.canvas.addEventListener('click', (e) => {
        const p = this.pos(e);
        const h = this.hit(p.x, p.y);
        if (h) {
          const node = this.nodes.find((n) => n.id === h);
          if (node?.onClick) node.onClick(node);
        }
      });
    }

    loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(this.loop);
    };

    destroy() {
      cancelAnimationFrame(this.raf);
      this.ro?.disconnect();
    }
  }

  return { Graph };
})();