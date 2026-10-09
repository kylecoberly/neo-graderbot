import { describe, expect, it } from "vitest";
import { precompute } from "./precompute";

describe("precompute", () => {
  it("keeps every answer's result, retrying a failure once and listing what still failed", async () => {
    const tries = new Map<string, number>();
    const grade = async (id: string) => {
      const n = (tries.get(id) ?? 0) + 1;
      tries.set(id, n);
      if (id === "flaky" && n === 1) throw new Error("529 overloaded");
      if (id === "broken") throw new Error("refusal");
      return { decision: { action: "record" as const, verdict: "accept" as const, feedback: id }, certainty: "high" as const, basis: null };
    };
    const out = await precompute(["a", "flaky", "broken", "b"], grade, { concurrency: 2 });
    expect(Object.keys(out.results).sort()).toEqual(["a", "b", "flaky"]);
    expect(out.failed).toEqual(["broken"]);
    expect(tries.get("broken")).toBe(2);
  });

  it("never runs more than the concurrency at once", async () => {
    let running = 0;
    let peak = 0;
    const grade = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return { decision: { action: "record" as const, verdict: "accept" as const, feedback: "" }, certainty: null, basis: null };
    };
    await precompute(Array.from({ length: 10 }, (_, i) => `a-${i}`), grade, { concurrency: 3 });
    expect(peak).toBe(3);
  });
});
