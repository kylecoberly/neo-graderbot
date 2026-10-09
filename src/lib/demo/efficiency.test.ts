import { describe, expect, it } from "vitest";
import { agreement, efficiency, median, speedLine, speedText } from "./efficiency";

const live = (latencyMs: number, deferred = false) => ({ live: true, latencyMs, deferred });
const stored = (deferred = false) => ({ live: false, latencyMs: null, deferred });

describe("efficiency", () => {
  it("prices deferrals and a 20% spot-check at the visitor's median pace", () => {
    const e = efficiency([10_000, 20_000, 30_000, 40_000], [live(3000, true), live(5000), live(4000), live(2000)]);
    expect(e.byHandMs).toBe(100_000);
    expect(e.medianMs).toBe(25_000);
    expect(e.withAgentMs).toBe(Math.round((1 + 0.2 * 3) * 25_000 + 5000));
  });
  it("never counts a stored result's time", () => {
    expect(efficiency([1000], [stored(), live(800)]).agentWallMs).toBe(800);
    expect(efficiency([1000], [stored()]).agentWallMs).toBeNull();
  });
});

describe("speedLine", () => {
  it("counts how many the agent grades, one at a time, in the visitor's time", () => {
    const s = speedLine({ gradedCount: 8, activeTotalMs: 96_000, priorMedianMs: null, results: [live(4000), live(2000)] });
    expect(s).toEqual({ kind: "graded", n: 8, m: 32 });
    expect(speedText(s)).toBe("In the time it took you to grade 8 responses, GraderBot could have graded 32.");
  });
  it("projects from the first page when the visitor skipped grading", () => {
    const s = speedLine({ gradedCount: 0, activeTotalMs: null, priorMedianMs: 12_000, results: [live(4000), live(6000)] });
    expect(s).toEqual({ kind: "projected", count: 2, yourMs: 24_000, agentMs: 6000 });
    expect(speedText(s)).toBe("At your pace on the first page, these 2 would have taken you about 24 s; GraderBot took 6 s.");
  });
  it("reports GraderBot's time alone when there is no pace to compare", () => {
    const s = speedLine({ gradedCount: 0, activeTotalMs: null, priorMedianMs: null, results: [live(4000), live(6000)] });
    expect(s).toEqual({ kind: "agentOnly", count: 2, agentMs: 6000 });
    expect(speedText(s)).toBe("GraderBot graded these 2 in 6 s. Grade an archive page first to see how that compares with your pace.");
  });
  it("says so when no call was live", () => {
    const s = speedLine({ gradedCount: 8, activeTotalMs: 9000, priorMedianMs: null, results: [stored()] });
    expect(s).toEqual({ kind: "unavailable" });
    expect(speedText(s)).toBe("GraderBot's grades on this page were recorded earlier, so there's no live timing to compare.");
  });
});

describe("agreement and median", () => {
  it("leaves out answers the agent gave no verdict on", () => {
    expect(agreement([{ visitor: "accept", agent: "accept" }, { visitor: "reject", agent: "accept" }, { visitor: "reject", agent: null }])).toEqual({ agree: 1, compared: 2 });
  });
  it("takes the middle", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
  });
});
