export type FileKind = "pdf" | "image" | "unavailable";

export interface FetchedFile {
  label: string;          // "Resume" | "Portfolio"
  sourceUrl: string;
  kind: FileKind;
  mediaType?: string;     // "application/pdf" | "image/jpeg" | "image/png"
  base64?: string;
  reason?: string;        // populated only when kind === "unavailable"
}

export interface SourceRecord {
  label: string;
  status: "read" | "unavailable" | "not_provided";
  detail: string;
}

export interface EvidenceBundle {
  candidateId: string;
  jobPositionId: string | null;
  textContext: string;
  files: FetchedFile[];
  sources: SourceRecord[];
  inputHash: string;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  description: string;
  sortOrder: number;
}

export interface ResolvedRubric {
  configId: string;
  jobPositionId: string | null;
  isGlobalFallback: boolean;
  criteria: RubricCriterion[];
}

export type Verdict = "STRONG" | "PROMISING" | "WEAK" | "INSUFFICIENT_DATA";

export interface CriterionResult {
  name: string;
  score: number | null;   // null = evidence unavailable, NEVER 0 for missing evidence
  reasoning: string;
}

export type InterviewAxis =
  | "communication" | "personality" | "experience"
  | "roleUnderstanding" | "availability" | "attitude";

export interface InterviewQuestion {
  axis: InterviewAxis;
  question: string;
  why: string;
}

export interface AssessmentOutput {
  summary: string;
  strengths: string;
  concerns: string;
  redFlags: string;
  unverifiedClaims: string;
  criteria: CriterionResult[];
  interviewQuestions: InterviewQuestion[];
}
