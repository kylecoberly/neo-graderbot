import { describe, expect, it, vi } from "vitest";
import { feedbackListener, judgmentSchema, makeJudge } from "./judge";

describe("feedbackListener", () => {
  it("reports feedback only when it grows", () => {
    const seen: string[] = [];
    const listen = feedbackListener((t) => seen.push(t));
    listen({ basis: "x" });
    listen({ basis: "x", verdict: "reject", feedback: "Clo" });
    listen({ basis: "x", verdict: "reject", feedback: "Clo" });
    listen({ basis: "x", verdict: "reject", feedback: "Close" });
    expect(seen).toEqual(["Clo", "Close"]);
  });
});

describe("judgmentSchema", () => {
  it("orders evidence before verdict and feedback last", () => {
    expect(Object.keys(judgmentSchema.shape)).toEqual(["basis", "verdict", "certainty", "feedback"]);
  });
});

describe("makeJudge", () => {
  // A transient failure building the model must not be cached for the life
  // of the process, failing every later grade with the first error.
  it("builds the model again after a failed build", async () => {
    const build = vi.fn().mockRejectedValue(new Error("503 from the provider"));
    const judge = makeJudge("anthropic:claude-haiku-4-5", build);
    const input = { question: { id: "q", slice: "arrays" as const, prompt: "**CLI**", reference: null }, answer: "x", passages: [], reference: null };
    await expect(judge(input)).rejects.toThrow(/503/);
    await expect(judge(input)).rejects.toThrow(/503/);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
