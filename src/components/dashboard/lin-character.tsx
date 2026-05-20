"use client"

import { useEffect, useRef, useState } from "react"

// ── Pixel palette ────────────────────────────────────────────────────────────
const T = null             // transparent
const H = '#2c1810'        // dark hair
const L = '#7a4a2e'        // hair lighter
const S = '#f5c5a0'        // skin
const E = '#1a0a00'        // eyes
const M = '#d4654a'        // mouth
const B = '#4a7ec7'        // blue uniform
const Dk = '#2d5a96'       // dark blue accent
const W = '#eef2ff'        // white collar
const P = '#ff85c2'        // pink bow
const K = '#2d2d2d'        // dark shoes

type C = string | null
const PX = 4   // each pixel = 4px → character = 40×64px

// ── Walk frame A (legs spread) ───────────────────────────────────────────────
const FA: C[][] = [
  [T, T, H, H, H, H, H, T, T, T],
  [T, H, H, L, L, L, H, H, T, T],
  [T, H, L, L, L, L, L, H, T, T],
  [P, T, H, H, H, H, H, T, T, T],
  [T, T, S, S, S, S, S, T, T, T],
  [T, S, S, E, S, E, S, S, T, T],
  [T, T, S, S, M, S, S, T, T, T],
  [T, T, W, W, W, W, W, T, T, T],
  [T, Dk,B, B, B, B, B, Dk,T, T],
  [T, Dk,B, B, B, B, B, Dk,T, T],
  [T, Dk,B, B, B, B, B, Dk,T, T],
  [T, T, Dk,B, B, B, Dk,T, T, T],
  [T, S, S, T, T, T, S, S, T, T],
  [T, S, S, T, T, T, S, S, T, T],
  [K, K, K, T, T, T, K, K, K, T],
  [K, K, T, T, T, T, T, K, K, T],
]

// ── Walk frame B (legs together) ─────────────────────────────────────────────
const FB: C[][] = [
  ...FA.slice(0, 12),
  [T, T, S, S, T, S, S, T, T, T],
  [T, T, S, S, T, S, S, T, T, T],
  [T, K, K, K, T, K, K, K, T, T],
  [T, K, K, T, T, T, K, K, T, T],
]

const COLS = FA[0].length
const ROWS = FA.length

function drawFrame(ctx: CanvasRenderingContext2D, frame: C[][], flip: boolean) {
  ctx.clearRect(0, 0, COLS * PX, ROWS * PX)
  if (flip) {
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-COLS * PX, 0)
  }
  frame.forEach((row, r) =>
    row.forEach((color, c) => {
      if (color) {
        ctx.fillStyle = color
        ctx.fillRect(c * PX, r * PX, PX, PX)
      }
    })
  )
  if (flip) ctx.restore()
}

// ── Message pools ─────────────────────────────────────────────────────────────
const IDLE_MSGS = [
  "ทำงานเก่งมากเลยย! 💪",
  "อย่าลืม follow up ผู้สมัครด้วยนะ 😊",
  "HR ที่ดีต้องใส่ใจคนนะคะ 🌟",
  "มีผู้สมัครรอ review อยู่นะ 👀",
  "ดื่มน้ำด้วยนะคะ! 💧",
  "หลินพร้อมช่วยเสมอค่ะ ✨",
  "ขยันมากเลยค่ะคุณ HR! 🎉",
  "อย่าลืมพักตาบ้างนะคะ 🌿",
]

interface Props {
  interviewCount: number
}

export function LinCharacter({ interviewCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [speech, setSpeech] = useState<string | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const dirRef = useRef<1 | -1>(-1)   // -1 = moving left, 1 = moving right
  const posRef = useRef(0)            // current x offset in px

  // ── Pixel art animation (250ms per frame) ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let tick = 0
    const id = setInterval(() => {
      tick = (tick + 1) % 4
      drawFrame(ctx, tick < 2 ? FA : FB, dirRef.current === 1)
    }, 250)
    // draw immediately
    drawFrame(ctx, FA, false)
    return () => clearInterval(id)
  }, [])

  // ── Walking movement (move 0.8px every 20ms ≈ 40px/s) ───────────────────
  useEffect(() => {
    const id = setInterval(() => {
      posRef.current += dirRef.current * 0.8
      if (posRef.current <= -100) dirRef.current = 1
      if (posRef.current >= 0)   dirRef.current = -1
      setOffsetX(posRef.current)
    }, 20)
    return () => clearInterval(id)
  }, [])

  // ── Speech bubble schedule ────────────────────────────────────────────────
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>

    const showMsg = (msg: string, duration = 4500) => {
      setSpeech(msg)
      return setTimeout(() => setSpeech(null), duration)
    }

    // Initial greeting after 2s
    const initTimer = setTimeout(() => {
      const greeting =
        interviewCount > 0
          ? `วันนี้มีนัดสัมภาษณ์ ${interviewCount} คนนะคะ 📋`
          : "วันนี้ไม่มีนัดค่ะ พักผ่อนได้เลย ☕"
      const off = showMsg(greeting, 5000)

      const scheduleIdle = () => {
        const delay = 60_000 + Math.random() * 30_000
        idleTimer = setTimeout(() => {
          const msg = IDLE_MSGS[Math.floor(Math.random() * IDLE_MSGS.length)]
          showMsg(msg)
          scheduleIdle()
        }, delay)
      }
      setTimeout(scheduleIdle, 5200)
      return off
    }, 2000)

    return () => {
      clearTimeout(initTimer)
      clearTimeout(idleTimer)
    }
  }, [interviewCount])

  return (
    <div
      className="fixed bottom-5 right-6 z-50 select-none pointer-events-none flex flex-col items-center"
      style={{ transform: `translateX(${offsetX}px)` }}
    >
      {/* Speech bubble */}
      {speech && (
        <div className="relative mb-1.5 bg-white border border-slate-200 rounded-2xl rounded-br-none px-3 py-2 shadow-lg text-xs text-slate-700 max-w-[180px] text-center leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-200">
          {speech}
          {/* Triangle tail */}
          <div
            className="absolute -bottom-[7px] right-2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "7px solid white",
              filter: "drop-shadow(0 1px 0 #e2e8f0)",
            }}
          />
        </div>
      )}

      {/* Name tag */}
      <span className="text-[9px] text-slate-400 mb-0.5 font-medium tracking-wide">หลิน</span>

      {/* Pixel character */}
      <canvas
        ref={canvasRef}
        width={COLS * PX}
        height={ROWS * PX}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
