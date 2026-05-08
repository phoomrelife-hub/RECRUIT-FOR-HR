export type AiTab =
  | "overview"
  | "openclaw-rules"
  | "tagging-rules"
  | "scoring"
  | "playground"
  | "logs";

export const AI_TABS: { id: AiTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "openclaw-rules", label: "Bot Rules (หลิน)" },
  { id: "tagging-rules", label: "Auto Tagging" },
  { id: "scoring", label: "Scoring" },
  { id: "playground", label: "Playground" },
  { id: "logs", label: "Logs" },
];
