export type AiTab =
  | "overview"
  | "openclaw-rules"
  | "tagging-rules"
  | "scoring"
  | "summary-templates"
  | "playground"
  | "logs"
  | "cost-control"
  | "fallback";

export const AI_TABS: { id: AiTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "openclaw-rules", label: "Bot Rules (หลิน)" },
  { id: "tagging-rules", label: "Auto Tagging" },
  { id: "scoring", label: "Scoring" },
  { id: "summary-templates", label: "Summary Template" },
  { id: "playground", label: "Playground" },
  { id: "logs", label: "Logs" },
  { id: "cost-control", label: "Cost Control" },
  { id: "fallback", label: "Fallback" },
];
