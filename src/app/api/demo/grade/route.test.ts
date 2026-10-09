import { beforeEach, describe, expect, it, vi } from "vitest";

const control = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/demo/service", async (orig) => {
  const real = await orig<typeof import("@/lib/demo/service")>();
  const { buildGraph } = await import("@/lib/agent/graph");
  const { nullStore } = await import("@/lib/agent/store");
  return {
    ...real,
    demoGraph: () =>
      buildGraph(
        { retrieval: true, policy: true },
        {
          judge: async (_i, onFeedback) => {
            if (control.fail) throw new Error("credit balance too low");
            onFeedback?.("Look again");
            return { basis: "", verdict: "reject", certainty: "high", feedback: "Look again" };
          },
          retrieve: () => [{ lesson: "cli-intro", heading: "CLI", text: "The CLI.", score: 1 }],
          store: nullStore,
        },
      ),
  };
});
vi.mock("@/lib/demo/fallback", () => ({
  storedResult: (id: string) => (id.startsWith("a-") ? { decision: { action: "record", verdict: "accept", feedback: "Stored" }, certainty: "high", basis: null } : null),
}));

import { drawPage } from "@/lib/demo/page";
import { demoSecret, sign, verify } from "@/lib/demo/token";
import type { AgentResult } from "@/lib/demo/types";
import { mulberry32 } from "@/lib/random";
import { parseEvents } from "@/lib/sse";
import { POST } from "./route";

const page = drawPage({}, mulberry32(5));
const token = sign({ kind: "page", questionId: page.question.id, answerIds: page.answers.map((a) => a.id) }, demoSecret());
const custom = sign(
  {
    kind: "custom",
    bundle: { question: "q?", reference: "r", keyPoints: ["k"], responses: [{ kind: "partial", intended: "reject", answer: "half of it" }] },
  },
  demoSecret(),
);
const call = (body: unknown) => POST(new Request("http://localhost/api/demo/grade", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/demo/grade", () => {
  beforeEach(() => {
    control.fail = false;
  });

  it("streams the note, then a live result with a receipt", async () => {
    const { events } = parseEvents(await (await call({ token, key: page.answers[0].id })).text());
    expect(events[0]).toEqual({ event: "feedback", data: { text: "Look again" } });
    const { result } = events.at(-1)!.data as { result: AgentResult };
    expect(result).toMatchObject({ key: page.answers[0].id, live: true, decision: { action: "record", verdict: "reject" } });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(verify<{ kind: string; key: string }>(result.receipt!, demoSecret())).toMatchObject({
      kind: "run",
      key: page.answers[0].id,
      verdict: "reject",
      note: "Look again",
      certainty: "high",
      deferred: false,
    });
  });

  it("falls back to the stored result when the live call fails, and logs why", async () => {
    control.fail = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { events } = parseEvents(await (await call({ token, key: page.answers[1].id })).text());
    const { result } = events.at(-1)!.data as { result: AgentResult };
    expect(result).toMatchObject({ live: false, latencyMs: null, receipt: null, decision: { feedback: "Stored" } });
    expect(log).toHaveBeenCalledWith("demo grade failed:", "credit balance too low");
    log.mockRestore();
  });

  it("has no fallback for a visitor's own question", async () => {
    control.fail = true;
    const { events } = parseEvents(await (await call({ token: custom, key: "0" })).text());
    expect(events.at(-1)).toEqual({ event: "error", data: { message: "Live grading is unavailable right now." } });
  });

  it("answers 401 for an expired or forged ticket", async () => {
    expect((await call({ token: "nope", key: "a-1" })).status).toBe(401);
  });

  it("answers 400 for an answer that is not on the page", async () => {
    expect((await call({ token, key: "a-999999" })).status).toBe(400);
  });

  it("refuses another site", async () => {
    const res = await POST(
      new Request("http://localhost/api/demo/grade", { method: "POST", body: JSON.stringify({ token, key: page.answers[0].id }), headers: { origin: "https://evil.example" } }),
    );
    expect(res.status).toBe(403);
  });
});
