import { describe, expect, it } from "vitest";
import { adversarialStats, coreStats, coreTable, groupRows, paired, unstable, type Report } from "./stats";

const row = (slice: string, scores: Record<string, number>) => ({
  meta: { slice },
  feedback: Object.entries(scores).map(([key, score]) => ({ key, score })),
});

const report: Report = {
  meta: { label: "r1" },
  rows: {
    "a-1": row("arrays", { recorded: 1, verdict_agrees: 1, recorded_false_accept: 0, recorded_false_reject: 0 }),
    "a-1 #2": row("arrays", { recorded: 1, verdict_agrees: 0, recorded_false_accept: 1, recorded_false_reject: 0 }),
    "a-2": row("html", { recorded: 0, verdict_agrees: 0, recorded_false_accept: 0, recorded_false_reject: 0 }),
    "a-3": row("html", { recorded: 1, verdict_agrees: 1, recorded_false_accept: 0, recorded_false_reject: 0 }),
  },
};

describe("coreStats", () => {
  it("rates false accepts against what was recorded, not against everything", () => {
    const s = coreStats(Object.values(report.rows));
    expect(s).toMatchObject({ n: 4, recorded: 3, deferred: 0.25, agreement: 0.5 });
    expect(s.falseAcceptOfRecorded).toBeCloseTo(1 / 3);
    expect(s.falseRejectOfRecorded).toBe(0);
    expect(Number.isNaN(s.voice)).toBe(true);
  });
});

describe("groupRows", () => {
  it("groups by a meta key and adds an all bucket", () => {
    const groups = groupRows(report, "slice");
    expect(Object.keys(groups)).toEqual(["arrays", "html", "all"]);
    expect(groups.all).toHaveLength(4);
  });
});

describe("unstable", () => {
  it("counts examples that disagreed with themselves across repetitions", () => {
    expect(unstable(report, "verdict_agrees")).toBe(1);
  });
});

describe("adversarialStats", () => {
  it("averages safety and expectation", () => {
    expect(adversarialStats([row("arrays", { adversarial_safe: 1, expectation_met: 0 }), row("arrays", { adversarial_safe: 0, expectation_met: 0 })])).toEqual({
      n: 2, safe: 0.5, met: 0,
    });
  });
});

describe("coreTable", () => {
  it("shows two runs side by side", () => {
    const table = coreTable([{ label: "r1", report }, { label: "r2", report }]);
    expect(table).toContain("| slice |");
    expect(table).toContain("| all | 4 | 25% → 25% |");
  });
});

describe("paired", () => {
  const after: Report = {
    meta: { label: "r2" },
    rows: {
      "a-1": row("arrays", { verdict_agrees: 1 }),
      "a-1 #2": row("arrays", { verdict_agrees: 1 }),
      "a-2": row("html", { verdict_agrees: 1 }),
      "a-3": row("html", { verdict_agrees: 0 }),
    },
  };
  it("counts examples whose mean score improved or regressed, per slice", () => {
    // a-1: 0.5 → 1 (improved), a-2: 0 → 1 (improved), a-3: 1 → 0 (regressed)
    expect(paired(report, after, "verdict_agrees", "higher")).toEqual({
      improved: 2, regressed: 1, bySlice: { arrays: { improved: 1, regressed: 0 }, html: { improved: 1, regressed: 1 } },
    });
  });
});
