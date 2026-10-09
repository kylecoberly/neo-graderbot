import { describe, expect, it } from "vitest";
import type { GradeOutcome } from "@/lib/agent/run";
import type { GradedAnswer, Question } from "@/lib/types";
import { applyDecision, applyOutcome, applyReview, newRow, queueStats, reserveNext, seedState } from "./state";

const answer = (id: string, slice: GradedAnswer["slice"]): GradedAnswer => ({
  id, questionId: `${slice}-q`, slice, learner: "learner-01", answer: "x", attempt: 1, verdict: "reject", feedback: "nope", answeredOn: "2022-03-01",
});
const question = (slice: GradedAnswer["slice"]): Question => ({ id: `${slice}-q`, slice, prompt: "**Q**", reference: null });
const lookup = (id: string) => {
  const slice = id.split("-")[0] as GradedAnswer["slice"];
  return { answer: answer(id, slice), question: question(slice) };
};
const outcome = (action: "record" | "defer"): GradeOutcome => ({
  decision: action === "record" ? { action, verdict: "accept", feedback: "Yup" } : { action, reason: "certainty", verdict: "accept", feedback: "Yup" },
  checks: [], judgment: { basis: "", verdict: "accept", certainty: "high", feedback: "Yup" }, passages: [], guard: { tripped: false }, runId: "run-1",
});

describe("queue state", () => {
  it("interleaves held-out answers across slices", () => {
    const s = seedState([answer("cli-1", "arrays"), answer("cli-2", "arrays"), answer("git-1", "html")]);
    expect(s.pending).toEqual(["cli-1", "git-1", "cli-2"]);
  });

  it("reserves the next answer as a grading row on top", () => {
    const next = reserveNext({ pending: ["cli-1", "git-1"], rows: [] }, lookup)!;
    expect(next.state.pending).toEqual(["git-1"]);
    expect(next.row).toMatchObject({ answerId: "cli-1", status: "grading", archive: { verdict: "reject", feedback: "nope" } });
    expect(reserveNext({ pending: [], rows: [] }, lookup)).toBeNull();
  });

  it("files a row by the decision", () => {
    const start = { pending: [], rows: [newRow(answer("cli-1", "arrays"), question("arrays"))] };
    expect(applyDecision(start, "cli-1", { action: "record", verdict: "accept", feedback: "Yup" }).rows[0].status).toBe("recorded");
    const done = applyOutcome(start, "cli-1", outcome("defer"));
    expect(done.rows[0]).toMatchObject({ status: "deferred", runId: "run-1", draft: "Yup" });
  });

  it("marks a spot-check as agreement only for recorded rows", () => {
    const recorded = applyOutcome({ pending: [], rows: [newRow(answer("cli-1", "arrays"), question("arrays"))] }, "cli-1", outcome("record"));
    const review = { verdict: "reject" as const, feedback: "One more thing", at: "2026-10-08T00:00:00Z", override: "skipped" as const };
    expect(applyReview(recorded, "cli-1", review).rows[0].review!.agreed).toBe(false);
    expect(applyReview(recorded, "cli-1", { ...review, verdict: "accept" }).rows[0].review!.agreed).toBe(true);
    const deferred = applyOutcome({ pending: [], rows: [newRow(answer("cli-1", "arrays"), question("arrays"))] }, "cli-1", outcome("defer"));
    expect(applyReview(deferred, "cli-1", review).rows[0].review!.agreed).toBeNull();
  });

  it("counts the stats the header shows", () => {
    let s = { pending: ["git-1"], rows: [newRow(answer("cli-1", "arrays"), question("arrays")), newRow(answer("cli-2", "arrays"), question("arrays"))] };
    s = applyOutcome(s, "cli-1", outcome("record"));
    s = applyOutcome(s, "cli-2", outcome("defer"));
    s = applyReview(s, "cli-1", { verdict: "accept", feedback: "Yup", at: "t", override: "skipped" });
    expect(queueStats(s)).toEqual({ recorded: 1, needsYou: 1, reviewed: 1, spotChecked: 1, agreed: 1, remaining: 1 });
  });
});
