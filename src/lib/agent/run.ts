import { randomUUID } from "node:crypto";
import type { Decision, GuardResult, Judgment, Passage, PolicyCheck, Question } from "@/lib/types";
import type { GradeGraph, GradeStateType } from "./graph";
import { tracingCallbacks } from "./mask";

export interface GradeInput {
  answerId: string;
  question: Question;
  answer: string;
}

export interface GradeOutcome {
  decision: Decision;
  checks: PolicyCheck[];
  judgment: Judgment | null;
  passages: Passage[];
  guard: GuardResult;
  runId: string;
}

export async function grade(
  graph: GradeGraph,
  input: GradeInput,
  opts: { onFeedback?: (text: string) => void; runId?: string; metadata?: Record<string, unknown> } = {},
): Promise<GradeOutcome> {
  const runId = opts.runId ?? randomUUID();
  let final: GradeStateType | undefined;
  const stream = await graph.stream(input, {
    streamMode: ["custom", "values"],
    runId,
    runName: "grade",
    metadata: opts.metadata,
    callbacks: tracingCallbacks(),
  });
  for await (const [mode, chunk] of stream as unknown as AsyncIterable<[string, unknown]>) {
    if (mode === "custom") {
      const feedback = (chunk as { feedback?: unknown }).feedback;
      if (typeof feedback === "string") opts.onFeedback?.(feedback);
    } else {
      final = chunk as GradeStateType;
    }
  }
  if (!final?.decision) throw new Error(`Grading ${input.answerId} finished without a decision`);
  return {
    decision: final.decision,
    checks: final.checks ?? [],
    judgment: final.judgment ?? null,
    passages: final.passages ?? [],
    guard: final.guardResult,
    runId,
  };
}
