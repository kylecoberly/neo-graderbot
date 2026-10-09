import { describe, expect, it } from "vitest";
import { addEvent, emptyTiming, finish, type TimingEvent } from "./timing";

const run = (events: TimingEvent[], end: number) => finish(events.reduce(addEvent, emptyTiming()), end);

describe("timing", () => {
  it("charges time to the card being attended until attention moves", () => {
    const s = run([{ t: 0, key: "a", kind: "attend" }, { t: 4000, key: "b", kind: "attend" }], 10_000);
    expect(s.activeMs).toEqual({ a: 4000, b: 6000 });
  });
  it("ignores gaps over 30 seconds", () => {
    const s = run([{ t: 0, key: "a", kind: "attend" }, { t: 60_000, key: "a", kind: "attend" }, { t: 61_000, key: "b", kind: "attend" }], 61_000);
    expect(s.activeMs.a).toBe(1000);
  });
  it("sums keystroke gaps, each capped at 5 seconds", () => {
    const s = run(
      [{ t: 0, key: "a", kind: "type" }, { t: 300, key: "a", kind: "type" }, { t: 20_300, key: "a", kind: "type" }, { t: 20_500, key: "a", kind: "type" }],
      21_000,
    );
    expect(s.typingMs.a).toBe(300 + 5000 + 200);
  });
  it("records the page's wall-clock", () => {
    const s = run([{ t: 1000, key: "a", kind: "attend" }], 9000);
    expect(s.lastT! - s.firstT!).toBe(8000);
  });
});
