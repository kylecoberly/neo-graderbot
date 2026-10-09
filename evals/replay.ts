import { normaliseAnswer } from "@/lib/agent/guard";
import { evaluatePolicy } from "@/lib/agent/policy";
import type { GradeOutcome } from "@/lib/agent/run";
import type { Question, Verdict } from "@/lib/types";
import type { Expectation } from "./datasets/adversarial";
import { gradeAdversarial, gradeCore } from "./graders/deterministic";
import type { Feedback } from "./graders/types";

export interface StoredRow {
  meta: Record<string, unknown>;
  inputs?: { answer: string };
  reference?: unknown;
  output?: GradeOutcome;
  feedback: Feedback[];
  judgeMaterial?: Record<string, string>;
}

function grade(row: StoredRow, output: GradeOutcome, question: Question, suite: "core" | "adversarial", retrievalEnabled: boolean): Feedback[] {
  const graded =
    suite === "core"
      ? gradeCore({
          outcome: output,
          reference: row.reference as { verdict: Verdict; feedback: string | null },
          question,
          answer: row.inputs!.answer,
          retrievalEnabled,
        })
      : gradeAdversarial(output, (row.reference as { expect: Expectation }).expect);
  return [...graded, ...row.feedback.filter((f) => f.key.startsWith("judge_"))];
}

// A fix to a grader (not to the agent) is applied to past rounds by
// re-scoring their stored outcomes; every decision stays as it was.
export function regradeRow(
  row: StoredRow,
  question: Question,
  suite: "core" | "adversarial",
  retrievalEnabled: boolean,
): StoredRow & { output: GradeOutcome } {
  if (!row.output || !row.inputs) throw new Error("regrade needs the stored output and inputs");
  return { ...row, output: row.output, feedback: grade(row, row.output, question, suite, retrievalEnabled) };
}

// A change that only touches the policy needs no new model calls: the stored
// judgment, passages and guard result are re-decided under the current code,
// so the comparison with the original round is exactly paired.
export function replayRow(row: StoredRow, question: Question, suite: "core" | "adversarial"): StoredRow & { output: GradeOutcome } {
  const before = row.output;
  if (!before || !row.inputs) throw new Error("replay needs the stored output and inputs");
  const { decision, checks } = evaluatePolicy({
    enabled: true,
    guard: before.guard,
    judgment: before.judgment,
    passages: before.passages,
    reference: question.reference,
    answer: normaliseAnswer(row.inputs.answer),
  });
  const output: GradeOutcome = { ...before, decision, checks };
  return { ...row, output, feedback: grade(row, output, question, suite, true) };
}
