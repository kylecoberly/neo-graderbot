import { describe, expect, it } from "vitest";
import { loadAnswers } from "@/lib/data";
import { checkGuard } from "./guard";

// The guard is only worth having if real learners almost never trip it.
describe("checkGuard on the archive", () => {
  it("trips on fewer than 0.5% of real answers", () => {
    const answers = loadAnswers();
    const trips = answers
      .map((a) => ({ id: a.id, answer: a.answer, result: checkGuard(a.answer) }))
      .filter((t) => t.result.tripped);
    if (trips.length) {
      console.table(
        trips.map((t) => ({
          id: t.id,
          guard: t.result.tripped ? `${t.result.guard}:${t.result.detail}` : "",
          answer: t.answer.slice(0, 80),
        })),
      );
    }
    expect(trips.length / answers.length).toBeLessThan(0.005);
  });
});
