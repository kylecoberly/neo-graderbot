import { describe, expect, it } from "vitest";
import type { Judgment, Passage } from "@/lib/types";
import { evaluatePolicy, type PolicyInput } from "./policy";

const decide = (i: PolicyInput) => evaluatePolicy(i).decision;

const judgment = (over: Partial<Judgment> = {}): Judgment => ({
  basis: "To move a file or folder, use the `mv` command",
  verdict: "reject",
  certainty: "high",
  feedback: "There's one other thing it does too!",
  ...over,
});
const passage: Passage = { lesson: "cli-file-management-1", heading: "Moving", text: "Use `mv`", score: 2.1 };
const base: PolicyInput = { enabled: true, guard: { tripped: false }, judgment: judgment(), passages: [passage], reference: null, answer: "moves files" };
const longRef = "A tag marks up content with angle brackets around its name";

describe("decide", () => {
  it("records when every check passes", () => {
    expect(decide(base)).toEqual({ action: "record", verdict: "reject", feedback: "There's one other thing it does too!" });
  });
  it("defers a guarded answer without a verdict", () => {
    expect(decide({ ...base, guard: { tripped: true, guard: "injection", detail: "dictates_grade" }, judgment: null })).toEqual({
      action: "defer", reason: "guard:injection", verdict: null, feedback: null,
    });
  });
  it("defers on medium or low certainty and keeps the draft", () => {
    expect(decide({ ...base, judgment: judgment({ certainty: "medium" }) })).toEqual({
      action: "defer", reason: "certainty", verdict: "reject", feedback: "There's one other thing it does too!",
    });
  });
  it("defers with no passage and no reference", () => {
    expect(decide({ ...base, passages: [] })).toMatchObject({ action: "defer", reason: "no_retrieval" });
  });
  it("counts a reference as grounding", () => {
    expect(decide({ ...base, passages: [], reference: longRef })).toMatchObject({ action: "record" });
  });
  it("defers a rejection whose note leaks the reference", () => {
    const leaky = judgment({ feedback: "Remember: a tag marks up content with angle brackets around its name" });
    expect(decide({ ...base, reference: longRef, judgment: leaky })).toMatchObject({ action: "defer", reason: "leaks_reference" });
  });
  it("does not check acceptances for leaks", () => {
    const quoting = judgment({ verdict: "accept", feedback: "Yes: a tag marks up content with angle brackets around its name" });
    expect(decide({ ...base, reference: longRef, judgment: quoting })).toMatchObject({ action: "record", verdict: "accept" });
  });
  it("gives the first failing check as the reason", () => {
    expect(decide({ ...base, passages: [], judgment: judgment({ certainty: "low" }) })).toMatchObject({ reason: "certainty" });
  });
  it("records every judged answer when disabled", () => {
    expect(decide({ ...base, enabled: false, passages: [], judgment: judgment({ certainty: "low" }) })).toMatchObject({ action: "record" });
  });
  it("defers an answer pasted from a retrieved passage", () => {
    const pasted = "To move a file or folder, use the mv command and then check the result twice";
    const p = { ...passage, text: "To move a file or folder, use the mv command and then check the result twice please." };
    expect(decide({ ...base, answer: pasted, passages: [p] })).toMatchObject({ action: "defer", reason: "copied_from_lesson" });
  });
  it("refuses an unguarded answer with no judgment", () => {
    expect(() => decide({ ...base, judgment: null })).toThrow(/must be judged/);
  });
});

describe("evaluatePolicy", () => {
  it("explains every check in order", () => {
    expect(evaluatePolicy(base).checks.map((c) => [c.name, c.passed])).toEqual([
      ["guard", true], ["original", true], ["certainty", true], ["grounding", true], ["no_leak", true],
    ]);
  });
  it("defers exactly when some check failed", () => {
    for (const input of [base, { ...base, passages: [] }, { ...base, judgment: judgment({ certainty: "low" }) }]) {
      const { decision, checks } = evaluatePolicy(input);
      expect(decision.action === "defer").toBe(checks.some((c) => !c.passed));
    }
  });
});
