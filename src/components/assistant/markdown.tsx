"use client";
import React from "react";

/** Minimal markdown: **bold**, `code`, bullet lines (- / •), paragraphs. */
export function Md({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => {
        const bullet = /^\s*[-•]\s+/.test(line);
        const content = bullet ? line.replace(/^\s*[-•]\s+/, "") : line;
        return (
          <p key={i} className={bullet ? "pl-4 relative before:content-['•'] before:absolute before:left-0" : line.trim() === "" ? "h-2" : ""}>
            {renderInline(content)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(s: string): React.ReactNode[] {
  // split on **bold** and `code`
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="px-1 rounded bg-slate-100 text-[0.85em]">{p.slice(1, -1)}</code>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
