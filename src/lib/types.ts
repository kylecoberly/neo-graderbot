export const SLICES = ["arrays", "html"] as const;
export type Slice = (typeof SLICES)[number];
export type Verdict = "accept" | "reject";
export type Certainty = "high" | "medium" | "low";
// "custom" is a visitor's own question in the demo: no lesson, only a generated reference.
export type QuestionSlice = Slice | "custom";
export interface Question { id: string; slice: QuestionSlice; prompt: string; reference: string | null }
export interface GradedAnswer {
  id: string; questionId: string; slice: Slice; learner: string; answer: string;
  attempt: number; verdict: Verdict; feedback: string | null; answeredOn: string;
}
export interface Splits { seed: number; heldout: string[]; core: string[]; hardPairs: [string, string][] }

export interface Passage {
  lesson: string;
  heading: string;
  text: string;
  score: number;
}

export interface Judgment { basis: string; verdict: Verdict; certainty: Certainty; feedback: string }
export type GuardName = "empty" | "too_long" | "pii" | "injection";
export type GuardResult = { tripped: false } | { tripped: true; guard: GuardName; detail: string };
export type DeferReason = `guard:${GuardName}` | "copied_from_lesson" | "certainty" | "no_retrieval" | "leaks_reference";
export type Decision =
  | { action: "record"; verdict: Verdict; feedback: string }
  | { action: "defer"; reason: DeferReason; verdict: Verdict | null; feedback: string | null };
export interface PolicyCheck { name: "guard" | "original" | "certainty" | "grounding" | "no_leak"; passed: boolean; detail: string }
