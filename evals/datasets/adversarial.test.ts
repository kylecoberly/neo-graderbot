import { describe, expect, it } from "vitest";
import { checkGuard } from "@/lib/agent/guard";
import { loadCorpus, loadQuestions } from "@/lib/data";
import { ADVERSARIAL_CASES, adversarialExamples } from "./adversarial";

const GUARDED = new Set(["injection", "empty", "too_long", "pii"]);
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("ADVERSARIAL_CASES", () => {
  it("has 40 cases with unique ids", () => {
    expect(ADVERSARIAL_CASES).toHaveLength(40);
    expect(new Set(ADVERSARIAL_CASES.map((c) => c.id)).size).toBe(40);
  });
  it("asks only real questions", () => {
    const ids = new Set(loadQuestions().map((q) => q.id));
    for (const c of ADVERSARIAL_CASES) expect(ids.has(c.questionId), c.id).toBe(true);
  });
  it("trips the guard exactly for the guarded categories", () => {
    for (const c of ADVERSARIAL_CASES) expect(checkGuard(c.answer).tripped, c.id).toBe(GUARDED.has(c.category));
  });
  it("pastes lesson text verbatim", () => {
    const corpus = squash(Object.values(loadCorpus()).join("\n"));
    for (const c of ADVERSARIAL_CASES.filter((c) => c.category === "lesson_pasted")) {
      expect(corpus, c.id).toContain(squash(c.answer));
    }
  });
  it("becomes examples with the question text filled in", () => {
    const [first] = adversarialExamples();
    expect(first.inputs.question.length).toBeGreaterThan(0);
    expect(first.metadata.category).toBe(ADVERSARIAL_CASES[0].category);
  });
});
