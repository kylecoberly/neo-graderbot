import type { Decision, DeferReason, GuardResult, Judgment, Passage, PolicyCheck } from "@/lib/types";
import { copiesPassage, leaksReference } from "./leak";

export interface PolicyInput {
  enabled: boolean;
  guard: GuardResult;
  judgment: Judgment | null;
  passages: Passage[];
  reference: string | null;
  answer: string;
}

const REASON: Record<Exclude<PolicyCheck["name"], "guard">, DeferReason> = {
  original: "copied_from_lesson",
  certainty: "certainty",
  grounding: "no_retrieval",
  no_leak: "leaks_reference",
};

// Whether the agent may write a grade is decided here, in code, so it can be
// tuned without re-prompting and measured by the evals.
export function evaluatePolicy(i: PolicyInput): { decision: Decision; checks: PolicyCheck[] } {
  if (!i.enabled) {
    if (!i.judgment) throw new Error("With the policy off every answer must be judged");
    return { decision: { action: "record", verdict: i.judgment.verdict, feedback: i.judgment.feedback }, checks: [] };
  }
  const checks: PolicyCheck[] = [
    { name: "guard", passed: !i.guard.tripped, detail: i.guard.tripped ? `${i.guard.guard}: ${i.guard.detail}` : "clean" },
  ];
  if (i.guard.tripped) {
    return { decision: { action: "defer", reason: `guard:${i.guard.guard}`, verdict: null, feedback: null }, checks };
  }
  const j = i.judgment;
  if (!j) throw new Error("An unguarded answer must be judged");
  checks.push(
    { name: "original", passed: !copiesPassage(i.answer, i.passages), detail: "checked against retrieved passages" },
    { name: "certainty", passed: j.certainty === "high", detail: j.certainty },
    {
      name: "grounding",
      passed: i.passages.length > 0 || i.reference !== null,
      detail: `${i.passages.length} passage(s)${i.reference ? " + reference" : ""}`,
    },
    {
      name: "no_leak",
      passed: !(j.verdict === "reject" && leaksReference(j.feedback, i.reference, i.answer)),
      detail: j.verdict === "reject" ? "checked against the reference" : "acceptance, not checked",
    },
  );
  const failed = checks.find((c) => !c.passed);
  if (failed) {
    const reason = REASON[failed.name as keyof typeof REASON];
    return { decision: { action: "defer", reason, verdict: j.verdict, feedback: j.feedback }, checks };
  }
  return { decision: { action: "record", verdict: j.verdict, feedback: j.feedback }, checks };
}
