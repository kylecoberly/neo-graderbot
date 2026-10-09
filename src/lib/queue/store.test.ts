import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyDecision, newRow } from "./state";
import { createQueueStore, reserve, seedFromData } from "./store";

const tmp = () => join(mkdtempSync(join(tmpdir(), "graderbot-")), "state.json");

describe("queue store", () => {
  it("keeps both of two concurrent updates", async () => {
    const q = { id: "q", slice: "arrays" as const, prompt: "**Q**", reference: null };
    const a = (id: string) => ({ id, questionId: "q", slice: "arrays" as const, learner: "learner-01", answer: "x", attempt: 1, verdict: "accept" as const, feedback: null, answeredOn: "2022-03-01" });
    const store = createQueueStore(tmp(), () => ({ pending: [], rows: [newRow(a("a"), q), newRow(a("b"), q)] }));
    await Promise.all([
      store.update((s) => applyDecision(s, "a", { action: "record", verdict: "accept", feedback: "Yup" })),
      store.update((s) => applyDecision(s, "b", { action: "defer", reason: "certainty", verdict: null, feedback: null })),
    ]);
    expect((await store.read()).rows.map((r) => r.status)).toEqual(["recorded", "deferred"]);
  });

  it("never hands the same answer to two concurrent reservations", async () => {
    const store = createQueueStore(tmp(), seedFromData);
    const [x, y] = await Promise.all([reserve(store), reserve(store)]);
    expect(x!.row.answerId).not.toBe(y!.row.answerId);
    expect((await store.read()).rows).toHaveLength(2);
  });

  it("reseeds on reset", async () => {
    const store = createQueueStore(tmp(), seedFromData);
    await reserve(store);
    const fresh = await store.reset();
    expect(fresh.rows).toEqual([]);
    expect(fresh.pending.length).toBeGreaterThanOrEqual(20);
  });
});
