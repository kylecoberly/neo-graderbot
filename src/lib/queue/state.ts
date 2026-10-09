import type { GradeOutcome } from "@/lib/agent/run";
import { SLICES, type Decision, type GradedAnswer, type Judgment, type Passage, type PolicyCheck, type Question, type Slice, type Verdict } from "@/lib/types";

export type RowStatus = "grading" | "recorded" | "deferred" | "failed";
export type OverrideUpload = "uploaded" | "skipped" | "failed";

export interface Review {
  verdict: Verdict;
  feedback: string;
  at: string;
  agreed: boolean | null;
  override: OverrideUpload;
}

export interface QueueRow {
  answerId: string;
  questionId: string;
  slice: Slice;
  prompt: string;
  learner: string;
  answer: string;
  archive: { verdict: Verdict; feedback: string | null };
  status: RowStatus;
  draft: string;
  decision: Decision | null;
  judgment: Judgment | null;
  passages: Passage[];
  checks: PolicyCheck[];
  runId: string | null;
  error: string | null;
  review: Review | null;
}

export interface QueueState {
  pending: string[];
  rows: QueueRow[];
}

export interface QueueStats {
  recorded: number;
  needsYou: number;
  reviewed: number;
  spotChecked: number;
  agreed: number;
  remaining: number;
}

// Round-robin across slices, so a short demo still shows every kind of question.
export function seedState(heldout: GradedAnswer[]): QueueState {
  const bySlice = SLICES.map((s) => heldout.filter((a) => a.slice === s));
  const pending: string[] = [];
  for (let i = 0; bySlice.some((l) => i < l.length); i++) for (const l of bySlice) if (i < l.length) pending.push(l[i].id);
  return { pending, rows: [] };
}

export function newRow(answer: GradedAnswer, question: Question): QueueRow {
  return {
    answerId: answer.id,
    questionId: question.id,
    slice: answer.slice,
    prompt: question.prompt,
    learner: answer.learner,
    answer: answer.answer,
    archive: { verdict: answer.verdict, feedback: answer.feedback },
    status: "grading",
    draft: "",
    decision: null,
    judgment: null,
    passages: [],
    checks: [],
    runId: null,
    error: null,
    review: null,
  };
}

export function reserveNext(
  state: QueueState,
  lookup: (answerId: string) => { answer: GradedAnswer; question: Question },
): { state: QueueState; row: QueueRow } | null {
  const [next, ...pending] = state.pending;
  if (!next) return null;
  const { answer, question } = lookup(next);
  const row = newRow(answer, question);
  return { state: { pending, rows: [row, ...state.rows] }, row };
}

function update(state: QueueState, answerId: string, change: (r: QueueRow) => QueueRow): QueueState {
  return { ...state, rows: state.rows.map((r) => (r.answerId === answerId ? change(r) : r)) };
}

const statusOf = (d: Decision): RowStatus => (d.action === "record" ? "recorded" : "deferred");

export function applyDecision(state: QueueState, answerId: string, decision: Decision): QueueState {
  return update(state, answerId, (r) => ({ ...r, decision, status: statusOf(decision) }));
}

export function applyOutcome(state: QueueState, answerId: string, outcome: GradeOutcome): QueueState {
  return update(state, answerId, (r) => ({
    ...r,
    decision: outcome.decision,
    judgment: outcome.judgment,
    passages: outcome.passages,
    checks: outcome.checks,
    runId: outcome.runId,
    draft: outcome.judgment?.feedback ?? "",
    status: statusOf(outcome.decision),
  }));
}

export function markFailed(state: QueueState, answerId: string, message: string): QueueState {
  return update(state, answerId, (r) => ({ ...r, status: "failed", error: message }));
}

// "Agreed" is about the verdict: keeping the agent's verdict but rewording
// its note is still agreement.
export function applyReview(state: QueueState, answerId: string, review: Omit<Review, "agreed">): QueueState {
  return update(state, answerId, (r) => ({
    ...r,
    review: { ...review, agreed: r.decision?.action === "record" ? review.verdict === r.decision.verdict : null },
  }));
}

export function queueStats(state: QueueState): QueueStats {
  const recorded = state.rows.filter((r) => r.status === "recorded");
  return {
    recorded: recorded.length,
    needsYou: state.rows.filter((r) => (r.status === "deferred" || r.status === "failed") && !r.review).length,
    reviewed: state.rows.filter((r) => r.review).length,
    spotChecked: recorded.filter((r) => r.review).length,
    agreed: recorded.filter((r) => r.review?.agreed).length,
    remaining: state.pending.length,
  };
}
