"use client";

import { useEffect, useState, useCallback } from "react";
import type { ScheduleInfo, ScheduleSlot } from "@/app/api/schedule/[token]/route";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "pick"; info: ScheduleInfo; selected: ScheduleSlot | null }
  | { phase: "confirming"; info: ScheduleInfo; selected: ScheduleSlot }
  | { phase: "done"; selected: ScheduleSlot; candidateName: string };

export default function BookingClient({ token }: { token: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/${token}`);
      if (res.status === 404) {
        setState({ phase: "error", message: "ลิงก์นี้หมดอายุหรือถูกใช้งานแล้วค่ะ" });
        return;
      }
      if (!res.ok) throw new Error("Server error");
      const info: ScheduleInfo = await res.json();
      if (info.slots.length === 0) {
        setState({ phase: "error", message: "ขณะนี้ยังไม่มีช่วงเวลาว่างค่ะ ทีมงานจะติดต่อกลับเพื่อนัดหมายค่ะ" });
        return;
      }
      setState({ phase: "pick", info, selected: null });
    } catch {
      setState({ phase: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ" });
    }
  }, [token]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  async function confirmBooking(selected: ScheduleSlot, candidateName: string) {
    setState((s) =>
      s.phase === "pick" ? { phase: "confirming", info: s.info, selected } : s
    );
    try {
      const res = await fetch(`/api/schedule/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selected.date,
          startTime: selected.startTime,
          endTime: selected.endTime,
        }),
      });
      if (!res.ok) {
        setState({ phase: "error", message: "ไม่สามารถจองได้ในขณะนี้ กรุณาลองใหม่ค่ะ" });
        return;
      }
      setState({ phase: "done", selected, candidateName });
    } catch {
      setState({ phase: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ" });
    }
  }

  // ── Group slots by date ────────────────────────────────────────────────────
  function groupByDate(slots: ScheduleSlot[]) {
    const map = new Map<string, { label: string; slots: ScheduleSlot[] }>();
    for (const slot of slots) {
      if (!map.has(slot.date)) {
        map.set(slot.date, { label: slot.dateLabel, slots: [] });
      }
      map.get(slot.date)!.slots.push(slot);
    }
    return Array.from(map.entries());
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state.phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm text-slate-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">😕</div>
          <p className="text-slate-700 font-medium">{state.message}</p>
          <p className="text-sm text-slate-400">— ทีม Relife Solutions</p>
        </div>
      </div>
    );
  }

  if (state.phase === "done") {
    const { selected, candidateName } = state;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-lg p-8 text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-xl font-bold text-slate-800">นัดสัมภาษณ์ยืนยันแล้วค่ะ!</h2>
          <p className="text-slate-600">คุณ{candidateName}</p>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 space-y-1 text-sm">
            <p className="font-semibold text-blue-800">📅 {selected.dateLabel}</p>
            <p className="text-blue-700">🕐 {selected.startTime} - {selected.endTime} น.</p>
          </div>
          <p className="text-xs text-slate-400">
            ทีมงานจะส่งรายละเอียดเพิ่มเติมทาง LINE นะคะ 💬
          </p>
        </div>
      </div>
    );
  }

  // pick or confirming
  const { info, selected } = state;
  const isConfirming = state.phase === "confirming";
  const grouped = groupByDate(info.slots);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-5 py-5 sticky top-0 z-10 shadow-sm">
        <p className="text-xs text-slate-400 mb-0.5">Relife Solutions</p>
        <h1 className="text-lg font-bold text-slate-800">เลือกวันสัมภาษณ์ใหม่</h1>
        <p className="text-sm text-slate-500 mt-0.5">สวัสดีคุณ{info.candidateName} 👋 กรุณาเลือกวันและเวลาที่สะดวกค่ะ</p>
      </div>

      {/* Slots */}
      <div className="px-4 py-5 space-y-5 max-w-md mx-auto">
        {grouped.map(([date, group]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
              {group.label}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {group.slots.map((slot) => {
                const isSelected =
                  selected?.date === slot.date && selected?.startTime === slot.startTime;
                return (
                  <button
                    key={`${slot.date}-${slot.startTime}`}
                    onClick={() =>
                      !isConfirming &&
                      setState((s) =>
                        s.phase === "pick"
                          ? { ...s, selected: isSelected ? null : slot }
                          : s
                      )
                    }
                    className={`rounded-2xl border-2 py-3 px-2 text-center transition-all text-sm font-medium ${
                      isSelected
                        ? "border-blue-500 bg-blue-500 text-white shadow-md scale-105"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 active:scale-95"
                    }`}
                  >
                    <span className="block text-base font-bold">{slot.startTime}</span>
                    <span className="block text-[10px] opacity-75">- {slot.endTime} น.</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm bar */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-4 max-w-md mx-auto">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-700">
              <span>📅</span>
              <span className="font-medium">{selected.dateLabel}</span>
              <span className="text-blue-400">·</span>
              <span>{selected.startTime} - {selected.endTime} น.</span>
            </div>
            <button
              onClick={() => confirmBooking(selected, info.candidateName)}
              disabled={isConfirming}
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold text-sm shadow-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isConfirming ? "กำลังยืนยัน..." : "✅ ยืนยันนัดสัมภาษณ์"}
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-slate-400">กรุณาเลือกช่วงเวลาด้านบนค่ะ</p>
        )}
      </div>
    </div>
  );
}
