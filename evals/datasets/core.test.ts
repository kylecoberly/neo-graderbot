import { describe, expect, it } from "vitest";
import { loadSplits } from "@/lib/data";
import { SLICES } from "@/lib/types";
import { coreExamples, limitPerSlice } from "./core";

describe("coreExamples", () => {
  const examples = coreExamples();
  const held = new Set(loadSplits().heldout);

  it("uses only the core split", () => {
    expect(examples.some((e) => held.has(e.id))).toBe(false);
    expect(examples.length).toBe(loadSplits().core.length);
  });
  it("covers every slice with 50–60 examples", () => {
    for (const slice of SLICES) {
      const n = examples.filter((e) => e.metadata.slice === slice).length;
      expect(n, slice).toBeGreaterThanOrEqual(50);
      expect(n, slice).toBeLessThanOrEqual(60);
    }
  });
  it("marks both halves of each hard pair", () => {
    const paired = examples.filter((e) => e.metadata.hardPair);
    expect(paired.length).toBe(loadSplits().hardPairs.length * 2);
  });
  it("carries the instructor's verdict as the expected outcome", () => {
    expect(examples.every((e) => e.referenceOutputs.verdict === "accept" || e.referenceOutputs.verdict === "reject")).toBe(true);
  });
});

describe("limitPerSlice", () => {
  it("keeps the first n of each slice", () => {
    const xs = [
      { id: 1, metadata: { slice: "arrays" as const } },
      { id: 2, metadata: { slice: "arrays" as const } },
      { id: 3, metadata: { slice: "html" as const } },
    ];
    expect(limitPerSlice(xs, 1).map((x) => x.id)).toEqual([1, 3]);
    expect(limitPerSlice(xs, undefined)).toBe(xs);
  });
});
