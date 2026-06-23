"use client";
import { useEffect, useRef } from "react";
import { OFFICE, ASSISTANT_COLOR, ASSISTANT_NAME } from "@/lib/assistant/office";

const TILE = 32;

export function OfficeCanvas({ thinking }: { thinking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const o = OFFICE;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = o.cols * TILE * dpr;
    canvas.height = o.rows * TILE * dpr;
    canvas.style.width = `${o.cols * TILE}px`;
    canvas.style.height = `${o.rows * TILE}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    function frame() {
      draw(ctx);
      raf.current = requestAnimationFrame(frame);
    }
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  function draw(ctx: CanvasRenderingContext2D) {
    const o = OFFICE;
    const t = performance.now();
    const active = thinkingRef.current;
    ctx.clearRect(0, 0, o.cols * TILE, o.rows * TILE);
    for (let y = 0; y < o.rows; y++) for (let x = 0; x < o.cols; x++) drawTile(ctx, x, y, o.tiles[y * o.cols + x]);
    drawChair(ctx, o.seat.x, o.seat.y);
    drawDesk(ctx, o.desk.x, o.desk.y, active);
    drawSeated(ctx, o.seat.x, o.seat.y, active, t);
  }

  // ── draw helpers (copied/adapted from ads-dashboard office-canvas.tsx) ──
  function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, type: number) {
    const px = x * TILE, py = y * TILE;
    if (type === 1) {
      ctx.fillStyle = "#0c1120"; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#222d49"; ctx.fillRect(px, py, TILE, TILE - 7);
      ctx.fillStyle = "#2c3a5e"; ctx.fillRect(px, py, TILE, 4);
      ctx.fillStyle = "#161f36"; ctx.fillRect(px, py + TILE - 7, TILE, 7);
    } else if (type === 2) {
      ctx.fillStyle = "#13233c"; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "rgba(91,108,255,0.14)"; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    } else {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#0b1322" : "#0d1626"; ctx.fillRect(px, py, TILE, TILE);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.022)"; ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }
  function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const px = x * TILE, py = y * TILE;
    ctx.fillStyle = "#2a3350"; roundRect(ctx, px + 9, py + 12, TILE - 18, TILE - 16, 3); ctx.fill();
    ctx.fillStyle = "#222a42"; roundRect(ctx, px + 9, py + 6, TILE - 18, 8, 3); ctx.fill();
  }
  function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean) {
    const px = x * TILE, py = y * TILE;
    ctx.fillStyle = "#2a2017"; ctx.fillRect(px + 2, py + 8, TILE - 4, TILE - 12);
    ctx.fillStyle = "#5a4631"; ctx.fillRect(px + 2, py + 8, TILE - 4, 5);
    ctx.fillStyle = "#070b14"; ctx.fillRect(px + 8, py + 2, TILE - 16, 11);
    ctx.fillStyle = active ? "#31c48d" : "#1d3a52"; ctx.fillRect(px + 10, py + 4, TILE - 20, 7);
    if (active) {
      ctx.fillStyle = "rgba(49,196,141,0.25)"; ctx.fillRect(px + 6, py, TILE - 12, 15);
    }
  }
  function drawHead(ctx: CanvasRenderingContext2D, cx: number, top: number) {
    ctx.fillStyle = "#0a0d16"; ctx.beginPath(); ctx.arc(cx, top, 5.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f0d4ad"; ctx.beginPath(); ctx.arc(cx, top, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2118"; ctx.beginPath(); ctx.arc(cx, top - 0.5, 5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#15110c"; ctx.fillRect(cx - 3.2, top + 0.5, 1.6, 1.8); ctx.fillRect(cx + 1.6, top + 0.5, 1.6, 1.8);
  }
  function drawSeated(ctx: CanvasRenderingContext2D, sx: number, sy: number, typing: boolean, t: number) {
    const cx = sx * TILE + TILE / 2, cy = sy * TILE + TILE / 2;
    ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(cx, cy + 10, 8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    const top = cy - 12;
    box(ctx, cx - 6, top + 6, 12, 10, ASSISTANT_COLOR);
    ctx.fillStyle = shade(ASSISTANT_COLOR, -28); ctx.fillRect(cx - 6, top + 12, 12, 4);
    const tap = typing ? Math.sin(t / 90) * 1.5 : 0;
    box(ctx, cx - 5, top + 1, 2.5, 6, shade(ASSISTANT_COLOR, 18));
    box(ctx, cx + 2.5, top + 1 + tap, 2.5, 6, shade(ASSISTANT_COLOR, 18));
    drawHead(ctx, cx, top + 2);
    if (typing) bubble(ctx, cx, top - 8, "…", "#5b6cff");
    ctx.font = "600 9px 'DM Sans', sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(232,234,245,0.92)"; ctx.fillText(ASSISTANT_NAME, cx, cy + 22);
  }
  function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
    ctx.fillStyle = "#0a0d16"; ctx.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  }
  function shade(hex: string, amt: number) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }
  function bubble(ctx: CanvasRenderingContext2D, cx: number, cy: number, txt: string, color: string) {
    ctx.fillStyle = "#0f1424"; ctx.strokeStyle = color; ctx.lineWidth = 1;
    roundRect(ctx, cx - 8, cy - 9, 16, 13, 4); ctx.fill(); ctx.stroke();
    ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = color; ctx.fillText(txt, cx, cy + 1);
  }
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  return (
    <div className="inline-block rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
      <canvas ref={canvasRef} style={{ display: "block", imageRendering: "pixelated" }} />
    </div>
  );
}
