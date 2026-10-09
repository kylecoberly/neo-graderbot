import type { DeferReason, Verdict } from "@/lib/types";

export interface EvaluationStore {
  record(answerId: string, evaluation: { verdict: Verdict; feedback: string }): Promise<void>;
  defer(answerId: string, deferral: { reason: DeferReason; verdict: Verdict | null; feedback: string | null }): Promise<void>;
}

// Evals measure the decision, not the write.
export const nullStore: EvaluationStore = {
  record: async () => {},
  defer: async () => {},
};
