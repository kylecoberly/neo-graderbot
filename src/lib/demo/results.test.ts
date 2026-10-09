import { describe, expect, it } from "vitest";
import { canSubmit, feedbackPayload, summarise, type AgentState, type Entry } from "./results";
import { addEvent, emptyTiming, finish } from "./timing";

const entries: Entry[] = [
  { key: "a", learner: "learner-01", answer: "arr.pop()" },
  { key: "b", learner: "learner-02", answer: "arr.shift()" },
];
const done = (verdict: "accept" | "reject", latencyMs: number | null, deferred = false): AgentState => ({
  status: "done",
  result: {
    key: "x",
    live: latencyMs !== null,
    latencyMs,
    decision: deferred ? { action: "defer", reason: "certainty", verdict, feedback: "Hmm?" } : { action: "record", verdict, feedback: "Which end?" },
    certainty: deferred ? "medium" : "high",
    basis: null,
    receipt: null,
  },
});
const timing = finish(
  [
    { t: 0, key: "a", kind: "attend" as const },
    { t: 10_000, key: "b", kind: "attend" as const },
  ].reduce(addEvent, emptyTiming()),
  30_000,
);
const grades = { a: { verdict: "accept" as const, note: "" }, b: { verdict: "reject" as const, note: "Which end of the array?" } };
const base = { entries, grades, timing, priorMedianMs: null, reference: "`.pop()`", vocabulary: ["array", "pop"], judge: null };

describe("canSubmit", () => {
  it("needs a verdict on every answer, not a note", () => {
    expect(canSubmit({ a: { verdict: "accept", note: "" } }, ["a", "b"])).toBe(false);
    expect(canSubmit(grades, ["a", "b"])).toBe(true);
  });
});

describe("summarise", () => {
  it("holds totals back while an agent call is pending", () => {
    const s = summarise({ ...base, agent: { a: done("accept", 2000), b: { status: "pending", draft: "" } } });
    expect(s.settled).toBe(false);
    expect(s.rows.a.agree).toBe(true);
    expect(s.rows.b.agree).toBeNull();
    expect(s.efficiency).toBeNull();
    expect(s.speed).toBeNull();
  });
  it("totals once every call has settled, counting stored results for agreement but not time", () => {
    const s = summarise({ ...base, agent: { a: done("accept", null), b: done("reject", 4000, true) } });
    expect(s.settled).toBe(true);
    expect(s.agreement).toEqual({ agree: 2, compared: 2 });
    expect(s.efficiency!.agentWallMs).toBe(4000);
    expect(s.speed).toEqual({ kind: "graded", n: 2, m: Math.floor(30_000 / 4000) });
  });
  it("treats a failed call as settled with no verdict", () => {
    const s = summarise({ ...base, agent: { a: { status: "error", message: "unavailable" }, b: done("reject", 3000) } });
    expect(s.settled).toBe(true);
    expect(s.agreement).toEqual({ agree: 1, compared: 1 });
  });
  it("counts a failed call as one the visitor would still have to grade", () => {
    const s = summarise({ ...base, agent: { a: { status: "error", message: "unavailable" }, b: done("reject", 3000) } });
    expect(s.efficiency).toMatchObject({ deferred: 1, recorded: 1 });
  });
  it("scores both sides' notes with the same rubric", () => {
    const s = summarise({ ...base, agent: { a: done("accept", 1000), b: done("reject", 1000) } });
    expect(s.rows.b.visitorRichness!.score).toBeGreaterThan(0);
    expect(s.richness.agent).toBe(s.rows.a.agentRichness!.score + s.rows.b.agentRichness!.score);
  });
  it("compares the agent with the answer key when there is one", () => {
    const keyed = entries.map((e, i) => ({ ...e, intended: (i ? "reject" : "accept") as "accept" | "reject" }));
    const s = summarise({ ...base, entries: keyed, agent: { a: done("reject", 1000), b: done("reject", 1000) } });
    expect(s.keyMatch).toEqual({ agree: 1, compared: 2 });
    expect(summarise({ ...base, agent: { a: done("reject", 1000), b: done("reject", 1000) } }).keyMatch).toBeNull();
  });
  it("in skip mode projects from the first page's pace", () => {
    const s = summarise({ ...base, grades: null, timing: null, priorMedianMs: 12_000, agent: { a: done("accept", 2000), b: done("reject", 3000) } });
    expect(s.speed).toEqual({ kind: "projected", count: 2, yourMs: 24_000, agentMs: 3000 });
    expect(s.agreement).toEqual({ agree: 0, compared: 0 });
  });
  it("tallies the judge", () => {
    const judge = [
      { key: "a", reason: "", better_verdict: "both", better_note: "agent", comment: "" },
      { key: "b", reason: "", better_verdict: "agent", better_note: "agent", comment: "" },
    ];
    const s = summarise({ ...base, judge, agent: { a: done("accept", 1000), b: done("reject", 1000) } });
    expect(s.judgeTally).toEqual({ verdict: { both: 1, agent: 1 }, note: { agent: 2 } });
  });
  it("tallies only judge rows that have finished arriving", () => {
    const judge = [
      { key: "a", reason: "", better_verdict: "both", better_note: "agent", comment: "" },
      { key: "b", reason: "Partly" } as unknown as { key: string; reason: string; better_verdict: string; better_note: string; comment: string },
    ];
    const s = summarise({ ...base, judge, agent: { a: done("accept", 1000), b: done("reject", 1000) } });
    expect(s.judgeTally).toEqual({ verdict: { both: 1 }, note: { agent: 1 } });
  });
});

describe("feedbackPayload", () => {
  it("sends the visitor's verdict for each live run, by its receipt", () => {
    const withReceipt = (state: AgentState, receipt: string): AgentState =>
      state.status === "done" ? { status: "done", result: { ...state.result, receipt } } : state;
    const agent = { a: withReceipt(done("accept", 1000), "ra"), b: done("reject", null) };
    expect(feedbackPayload(entries, agent, grades)).toEqual({ verdicts: [{ receipt: "ra", verdict: "accept" }] });
  });
});
