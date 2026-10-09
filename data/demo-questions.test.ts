import { describe, expect, it } from "vitest";
import { loadAnswers, loadDemoQuestions, loadQuestions } from "@/lib/data";
import { buildPool } from "@/lib/demo/pool";
import { DEMO_SLICES } from "@/lib/topics";

// Entries may be struck by hand; none may be added that the rule rejects.
describe("data/demo-questions.json", () => {
  it("only holds questions the pool rule accepts", () => {
    const allowed = new Set(buildPool(loadQuestions(), loadAnswers()).map((p) => p.id));
    for (const p of loadDemoQuestions()) expect(allowed.has(p.id), p.id).toBe(true);
  });
  it("is not empty", () => {
    expect(loadDemoQuestions().length).toBeGreaterThanOrEqual(8);
  });
  it("covers exactly the slices the grade page offers", () => {
    expect([...new Set(loadDemoQuestions().map((p) => p.slice))].sort()).toEqual([...DEMO_SLICES].sort());
  });
});
