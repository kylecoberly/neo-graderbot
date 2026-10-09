import { describe, expect, it } from "vitest";
import type { GradeOutcome } from "@/lib/agent/run";
import type { Question } from "@/lib/types";
import { regradeRow, replayRow } from "./replay";

const question: Question = { id: "q", slice: "html", prompt: "**Git**", reference: null };
const pasted = "Git is a tool for keeping track of different versions of files.";
const output: GradeOutcome = {
  decision: { action: "record", verdict: "accept", feedback: "That's right." },
  checks: [],
  judgment: { basis: "", verdict: "accept", certainty: "high", feedback: "That's right." },
  passages: [{ lesson: "git-intro", heading: "Introduction to Git", text: `${pasted} Git helps you:`, score: 3 }],
  guard: { tripped: false },
  runId: "r",
};

describe("replayRow", () => {
  it("re-decides a stored judgment under the current policy without calling a model", () => {
    const row = { meta: { slice: "html", category: "lesson_pasted" }, inputs: { answer: pasted }, reference: { expect: "defer" }, output, feedback: [] };
    const replayed = replayRow(row, question, "adversarial");
    expect(replayed.output.decision).toMatchObject({ action: "defer", reason: "copied_from_lesson" });
    expect(Object.fromEntries(replayed.feedback.map((f) => [f.key, f.score]))).toEqual({ adversarial_safe: 1, expectation_met: 1 });
  });
  it("keeps the judge's scores, since the note itself is unchanged", () => {
    const row = {
      meta: { slice: "html" },
      inputs: { answer: "It tracks versions" },
      reference: { verdict: "accept", feedback: null },
      output,
      feedback: [{ key: "judge_voice", score: 1 }, { key: "recorded", score: 1 }],
    };
    const keys = replayRow(row, question, "core").feedback.map((f) => f.key);
    expect(keys).toContain("judge_voice");
    expect(keys.filter((k) => k === "recorded")).toHaveLength(1);
  });
});

describe("regradeRow", () => {
  it("re-scores a stored outcome with the current graders and leaves the decision alone", () => {
    const row = {
      meta: { slice: "html" },
      inputs: { answer: pasted },
      reference: { verdict: "accept", feedback: null },
      output,
      feedback: [{ key: "judge_voice", score: 1 }, { key: "retrieval_term_found", score: 1 }],
    };
    const regraded = regradeRow(row, question, "core", true);
    expect(regraded.output.decision).toEqual(output.decision);
    const scores = Object.fromEntries(regraded.feedback.map((f) => [f.key, f.score]));
    expect(scores).toMatchObject({ recorded: 1, judge_voice: 1, retrieval_term_found: 1 });
  });
});
