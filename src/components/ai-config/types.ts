export type AiTab =
  | "overview"
  | "persona"
  | "bot-prompt"
  | "screening-flow"
  | "position-rules"
  | "handoff-rules"
  | "tagging-rules"
  | "scoring"
  | "summary-templates"
  | "openclaw"
  | "playground"
  | "logs"
  | "cost-control"
  | "fallback";

export const AI_TABS: { id: AiTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "persona", label: "Persona" },
  { id: "bot-prompt", label: "Bot Prompt" },
  { id: "screening-flow", label: "Screening Flow" },
  { id: "position-rules", label: "Position Rules" },
  { id: "handoff-rules", label: "Handoff Rules" },
  { id: "tagging-rules", label: "Auto Tagging" },
  { id: "scoring", label: "Scoring" },
  { id: "summary-templates", label: "Summary Template" },
  { id: "openclaw", label: "OpenClaw AI" },
  { id: "playground", label: "Playground" },
  { id: "logs", label: "Logs" },
  { id: "cost-control", label: "Cost Control" },
  { id: "fallback", label: "Fallback" },
];
