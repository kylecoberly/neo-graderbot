import { describe, expect, it } from "vitest";
import { fakePageJudge } from "./fake";

describe("fakePageJudge", () => {
  it("answers every item without a model, and says so", async () => {
    const seen: unknown[] = [];
    const out = await fakePageJudge(
      {
        question: "q",
        reference: null,
        passages: [],
        items: [
          { key: "a", answer: "x", visitor: { verdict: "accept", note: "" }, agent: { verdict: "accept", note: "Nice.", certainty: "high", deferred: false } },
          { key: "b", answer: "y", visitor: { verdict: "accept", note: "Good" }, agent: { verdict: "reject", note: "Look again?", certainty: "high", deferred: false } },
        ],
      },
      (p) => seen.push(p),
    );
    expect(out.answers.map((a) => [a.key, a.better_verdict, a.better_note])).toEqual([
      ["a", "both", "agent"],
      ["b", "agent", "agent"],
    ]);
    expect(out.answers[0].comment).toBe("Fake judge: no model was called.");
    expect(seen).toHaveLength(1);
  });
});
