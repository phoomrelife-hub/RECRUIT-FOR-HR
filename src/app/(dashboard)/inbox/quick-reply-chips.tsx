"use client";

import { VISIBLE_CHIP_COUNT } from "@/lib/quick-reply-template";

type Chip = {
  id: string;
  title: string;
};

interface Props {
  quickReplies: Chip[];
  onSelect: (id: string) => void;
}

/**
 * The top templates by sortOrder, always visible above the composer. Scrolls
 * horizontally rather than wrapping — the inbox is used on phones, where a
 * wrapped three-line chip row would eat the message area.
 */
export function QuickReplyChips({ quickReplies, onSelect }: Props) {
  const chips = quickReplies.slice(0, VISIBLE_CHIP_COUNT);
  if (chips.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-0.5 px-0.5">
      {chips.map((qr) => (
        <button
          key={qr.id}
          onClick={() => onSelect(qr.id)}
          className="text-xs whitespace-nowrap shrink-0 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 rounded-full px-3 py-1 transition-colors"
        >
          {qr.title}
        </button>
      ))}
    </div>
  );
}
