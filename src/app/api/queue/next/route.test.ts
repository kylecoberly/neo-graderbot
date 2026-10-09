import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GRADERBOT_QUEUE_FILE = "/tmp/graderbot-next-route-test/state.json";
});

vi.mock("@/lib/queue/graph", async () => {
  const { buildGraph } = await import("@/lib/agent/graph");
  const { queueEvaluations } = await import("@/lib/queue/store");
  const graph = buildGraph(
    { retrieval: true, policy: true },
    {
      judge: async (_input, onFeedback) => {
        const gate = (globalThis as { __gate?: Promise<void> }).__gate;
        if (gate) await gate;
        onFeedback?.("Close");
        onFeedback?.("Close, but");
        return { basis: "", verdict: "reject", certainty: "high", feedback: "Close, but" };
      },
      retrieve: () => [{ lesson: "cli-intro", heading: "CLI", text: "The CLI.", score: 1 }],
      store: queueEvaluations(),
    },
  );
  return { queueGraph: () => graph };
});

import type { QueueRow, QueueStats } from "@/lib/queue/state";
import { queueStore } from "@/lib/queue/store";
import { parseEvents } from "@/lib/sse";
import { POST } from "./route";

describe("POST /api/queue/next", () => {
  beforeEach(async () => {
    await queueStore().reset();
  });

  it("streams the new row, its feedback, then the decided row", async () => {
    const before = (await queueStore().read()).pending.length;
    const res = await POST(new Request("http://localhost/api/queue/next", { method: "POST" }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const { events } = parseEvents(await res.text());
    expect(events[0].event).toBe("row");
    expect(events.at(-1)!.event).toBe("done");
    const done = events.at(-1)!.data as { row: QueueRow; stats: QueueStats };
    expect(["recorded", "deferred"]).toContain(done.row.status);
    expect(done.stats.remaining).toBe(before - 1);
    expect(events.filter((e) => e.event === "feedback")).toHaveLength(done.row.judgment ? 2 : 0);
  });

  it("refuses a request from another site before grading anything", async () => {
    const before = (await queueStore().read()).pending.length;
    const res = await POST(new Request("http://localhost/api/queue/next", { method: "POST", headers: { origin: "https://evil.example", host: "localhost" } }));
    expect(res.status).toBe(403);
    expect((await queueStore().read()).pending.length).toBe(before);
  });

  it("finishes grading and keeps the outcome when the browser leaves mid-stream", async () => {
    let open!: () => void;
    const g = globalThis as { __gate?: Promise<void> };
    g.__gate = new Promise<void>((resolve) => (open = resolve));
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => void unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    try {
      // Skip held-out answers the guard would stop before the judge runs.
      await queueStore().update((s) => ({ ...s, pending: s.pending.filter((id) => id !== "a-1466") }));
      const res = await POST(new Request("http://localhost/api/queue/next", { method: "POST" }));
      const reader = res.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      const answerId = (parseEvents(first).events[0].data as QueueRow).answerId;
      await reader.cancel();
      open();
      await vi.waitFor(async () => {
        const row = (await queueStore().read()).rows.find((r) => r.answerId === answerId)!;
        expect(row.status).not.toBe("grading");
      });
      const row = (await queueStore().read()).rows.find((r) => r.answerId === answerId)!;
      expect(row.error).toBeNull();
      expect(["recorded", "deferred"]).toContain(row.status);
      await new Promise((r) => setTimeout(r, 50));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      delete g.__gate;
    }
  });

  it("answers 204 when nothing is left", async () => {
    await queueStore().update((s) => ({ ...s, pending: [] }));
    expect((await POST(new Request("http://localhost/api/queue/next", { method: "POST" }))).status).toBe(204);
  });
});

describe("POST /api/queue/next on Vercel", () => {
  afterEach(() => {
    delete process.env.VERCEL;
  });

  it("is not offered, because its store cannot persist there", async () => {
    process.env.VERCEL = "1";
    expect((await POST(new Request("http://localhost/api/queue/next", { method: "POST" }))).status).toBe(404);
  });
});
