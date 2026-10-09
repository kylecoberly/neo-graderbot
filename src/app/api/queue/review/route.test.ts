import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GRADERBOT_QUEUE_FILE = "/tmp/graderbot-review-route-test/state.json";
  delete process.env.LANGSMITH_API_KEY;
});

import { applyDecision } from "@/lib/queue/state";
import { queueStore, reserve } from "@/lib/queue/store";
import { POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/api/queue/review", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/queue/review", () => {
  let answerId: string;

  beforeEach(async () => {
    await queueStore().reset();
    answerId = (await reserve())!.row.answerId;
  });

  it("refuses a row that is still grading", async () => {
    expect((await post({ answerId, verdict: "reject", feedback: "x" })).status).toBe(404);
  });

  it("records a spot-check that overrides the agent", async () => {
    await queueStore().update((s) => applyDecision(s, answerId, { action: "record", verdict: "accept", feedback: "Yup" }));
    const res = await post({ answerId, verdict: "reject", feedback: "One more thing" });
    const body = await res.json();
    expect(body.row.review).toMatchObject({ verdict: "reject", agreed: false, override: "skipped" });
    expect(body.stats).toMatchObject({ spotChecked: 1, agreed: 0 });
  });

  it("refuses a request from another site", async () => {
    const res = await POST(new Request("http://localhost/api/queue/review", {
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", host: "localhost" },
      body: JSON.stringify({ answerId, verdict: "reject", feedback: "x" }),
    }));
    expect(res.status).toBe(403);
  });

  it("refuses a second review of the same row, so the overrides dataset gets no duplicate", async () => {
    await queueStore().update((s) => applyDecision(s, answerId, { action: "record", verdict: "accept", feedback: "Yup" }));
    expect((await post({ answerId, verdict: "accept", feedback: "Yup" })).status).toBe(200);
    const again = await post({ answerId, verdict: "reject", feedback: "Changed my mind" });
    expect(again.status).toBe(409);
    const row = (await queueStore().read()).rows.find((r) => r.answerId === answerId)!;
    expect(row.review).toMatchObject({ verdict: "accept" });
  });

  it("rejects a malformed body", async () => {
    expect((await post({ answerId })).status).toBe(400);
  });
});
