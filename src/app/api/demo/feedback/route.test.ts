import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createFeedback = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("langsmith", () => ({ Client: vi.fn(function Client() { return { createFeedback }; }) }));

import { labelId } from "@/lib/demo/labels";
import { demoSecret, sign } from "@/lib/demo/token";
import { POST } from "./route";

const receipt = (runId: string, verdict: "accept" | "reject" | null = "accept") => sign({ kind: "run", runId, key: "a-1", verdict }, demoSecret());
const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/demo/feedback", { method: "POST", body: JSON.stringify(body), headers }));

describe("POST /api/demo/feedback", () => {
  beforeEach(() => {
    process.env.LANGSMITH_TRACING = "true";
    createFeedback.mockClear();
  });
  afterEach(() => {
    delete process.env.LANGSMITH_TRACING;
  });

  it("works out agreement from the agent's signed verdict, not the browser's claim", async () => {
    const res = await call({
      verdicts: [
        { receipt: receipt("r1", "accept"), verdict: "accept" },
        { receipt: receipt("r2", "accept"), verdict: "reject" },
      ],
    });
    expect(await res.json()).toEqual({ written: 2 });
    expect(createFeedback).toHaveBeenCalledWith("r1", "visitor_agrees", { score: 1, value: "accept", feedbackId: labelId("r1", "visitor_agrees") });
    expect(createFeedback).toHaveBeenCalledWith("r2", "visitor_agrees", { score: 0, value: "reject", feedbackId: labelId("r2", "visitor_agrees") });
  });

  it("gives a replayed label the same id, so it cannot pile up", () => {
    expect(labelId("r1", "visitor_agrees")).toBe(labelId("r1", "visitor_agrees"));
    expect(labelId("r1", "visitor_agrees")).not.toBe(labelId("r2", "visitor_agrees"));
    expect(labelId("r1", "visitor_agrees")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("skips receipts this server did not sign, tickets posing as receipts, and runs with no verdict", async () => {
    const page = sign({ kind: "page", questionId: "q", answerIds: ["a-1"] }, demoSecret());
    const res = await call({
      verdicts: [
        { receipt: "forged.receipt", verdict: "accept" },
        { receipt: page, verdict: "accept" },
        { receipt: receipt("r3", null), verdict: "accept" },
      ],
    });
    expect(await res.json()).toEqual({ written: 0 });
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("counts a label LangSmith refuses as not written", async () => {
    createFeedback.mockRejectedValueOnce(new Error("409 conflict"));
    expect(await (await call({ verdicts: [{ receipt: receipt("r1"), verdict: "accept" }] })).json()).toEqual({ written: 0 });
  });

  it("refuses a bad verdict or too many items", async () => {
    expect((await call({ verdicts: [{ receipt: receipt("r1"), verdict: "maybe" }] })).status).toBe(400);
    expect((await call({ verdicts: Array.from({ length: 9 }, () => ({ receipt: receipt("r"), verdict: "accept" })) })).status).toBe(400);
  });

  it("does nothing when tracing is off", async () => {
    delete process.env.LANGSMITH_TRACING;
    expect((await call({ verdicts: [{ receipt: receipt("r1"), verdict: "accept" }] })).status).toBe(204);
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("refuses another site", async () => {
    expect((await call({ verdicts: [] }, { origin: "https://evil.example" })).status).toBe(403);
  });
});
