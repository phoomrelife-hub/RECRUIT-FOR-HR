export type AiTab =
  | "overview"
  | "providers"
  | "persona"
  | "prompts"
  | "screening-flow"
  | "position-rules"
  | "faqs"
  | "templates"
  | "guardrails"
  | "handoff-rules"
  | "tagging-rules"
  | "scoring"
  | "summary-templates"
  | "playground"
  | "logs"
  | "cost-control"
  | "fallback";

export const AI_TABS: { id: AiTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "providers", label: "Provider & Model" },
  { id: "persona", label: "Persona" },
  { id: "prompts", label: "System Prompt" },
  { id: "screening-flow", label: "Screening Flow" },
  { id: "position-rules", label: "Position Rules" },
  { id: "faqs", label: "Knowledge/FAQ" },
  { id: "templates", label: "Response Templates" },
  { id: "guardrails", label: "Guardrails" },
  { id: "handoff-rules", label: "Handoff Rules" },
  { id: "tagging-rules", label: "Auto Tagging" },
  { id: "scoring", label: "Scoring" },
  { id: "summary-templates", label: "Summary Template" },
  { id: "playground", label: "Playground" },
  { id: "logs", label: "Logs" },
  { id: "cost-control", label: "Cost Control" },
  { id: "fallback", label: "Fallback" },
];
