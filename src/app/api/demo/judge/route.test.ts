import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageJudgeInput, PageJudgment } from "@/lib/demo/pageJudge";

const seen = vi.hoisted(() => ({ input: null as unknown }));
const createFeedback = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("langsmith", () => ({ Client: vi.fn(function Client() { return { createFeedback }; }) }));
vi.mock("@/lib/demo/fallback", () => ({
  storedResult: (id: string) => (id === stored.id ? { decision: { action: "record", verdict: "accept", feedback: "Stored note" }, certainty: "high", basis: null } : null),
}));
const stored = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/demo/pageJudge", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo/pageJudge")>()),
  makePageJudge: () => async (input: PageJudgeInput, onPartial?: (p: Record<string, unknown>) => void) => {
    seen.input = input;
    onPartial?.({ answers: [] });
    return {
      answers: input.items.map((i) => ({ key: i.key, reason: "", better_verdict: "agent", better_note: "tie", comment: "" })),
      summary: "Fine.",
    };
  },
}));

import { drawPage } from "@/lib/demo/page";
import { labelId } from "@/lib/demo/labels";
import { demoSecret, sign } from "@/lib/demo/token";
import { mulberry32 } from "@/lib/random";
import { parseEvents } from "@/lib/sse";
import { POST } from "./route";

const page = drawPage({ slice: "arrays" }, mulberry32(3));
const token = sign({ kind: "page", questionId: page.question.id, answerIds: page.answers.map((a) => a.id) }, demoSecret());
const item = (key: string, note = "Which part is missing?") => ({
  key,
  visitor: { verdict: "reject", note },
  agent: { verdict: "accept", note: "Nice.", certainty: "high", deferred: false },
});
const call = (body: unknown) => POST(new Request("http://localhost/api/demo/judge", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/demo/judge", () => {
  beforeEach(() => {
    seen.input = null;
    createFeedback.mockClear();
  });
  afterEach(() => {
    delete process.env.LANGSMITH_TRACING;
  });

  it("streams the judge's partials, then its judgment", async () => {
    const { events } = parseEvents(await (await call({ token, items: [item(page.answers[0].id)] })).text());
    expect(events.map((e) => e.event)).toEqual(["partial", "done"]);
    expect((events[1].data as { judgment: PageJudgment }).judgment.answers[0]).toMatchObject({ key: page.answers[0].id, better_verdict: "agent" });
  });

  it("never takes the agent's side from the browser", async () => {
    const a = page.answers[2];
    const forged = { ...item(a.id), agent: { verdict: "accept", note: "\uFDFA".repeat(4000), certainty: "high", deferred: false } };
    await (await call({ token, items: [forged] })).text();
    expect((seen.input as PageJudgeInput).items[0].agent).toEqual({ verdict: null, note: null, certainty: null, deferred: false });
  });

  it("uses the stored result for an answer graded from the fallback", async () => {
    const a = page.answers[3];
    stored.id = a.id;
    await (await call({ token, items: [item(a.id)] })).text();
    expect((seen.input as PageJudgeInput).items[0].agent).toEqual({ verdict: "accept", note: "Stored note", certainty: "high", deferred: false });
  });

  it("takes the agent's side from its signed receipt, not from the request", async () => {
    const a = page.answers[0];
    const signed = sign({ kind: "run", runId: "run-a", key: a.id, verdict: "reject", note: "Which end?", certainty: "high", deferred: false }, demoSecret());
    await (await call({ token, items: [{ ...item(a.id), receipt: signed }] })).text();
    expect((seen.input as PageJudgeInput).items[0].agent).toEqual({ verdict: "reject", note: "Which end?", certainty: "high", deferred: false });
  });

  it("writes the judge's call onto the agent's run itself, only for a receipt matching the answer", async () => {
    process.env.LANGSMITH_TRACING = "true";
    const [a, b] = page.answers;
    const receiptFor = (key: string, runId: string) =>
      sign({ kind: "run", runId, key, verdict: "accept", note: "Nice.", certainty: "high", deferred: false }, demoSecret());
    await (
      await call({
        token,
        items: [
          { ...item(a.id), receipt: receiptFor(a.id, "run-a") },
          { ...item(b.id), receipt: receiptFor(a.id, "run-wrong-key") },
        ],
      })
    ).text();
    expect(createFeedback).toHaveBeenCalledTimes(1);
    expect(createFeedback).toHaveBeenCalledWith("run-a", "judge_better_verdict", { value: "agent", feedbackId: labelId("run-a", "judge_better_verdict") });
  });

  it("gives the judge the dataset's answer text and reference, not the request's", async () => {
    await (await call({ token, items: [item(page.answers[1].id)] })).text();
    const input = seen.input as PageJudgeInput;
    expect(input.items[0].answer).toBe(page.answers[1].answer);
    expect(input.reference).toBe(page.question.reference);
    expect(input.passages.length).toBeGreaterThan(0);
  });

  it("refuses a note over 1,000 characters", async () => {
    expect((await call({ token, items: [item(page.answers[0].id, "x".repeat(1001))] })).status).toBe(400);
  });

  it("refuses answers that are not on the page, repeated, or too many", async () => {
    expect((await call({ token, items: [item("a-999999")] })).status).toBe(400);
    expect((await call({ token, items: [item(page.answers[0].id), item(page.answers[0].id)] })).status).toBe(400);
    expect((await call({ token, items: Array.from({ length: 9 }, (_, i) => item(page.answers[i % 8].id)) })).status).toBe(400);
  });

  it("answers 401 for a forged ticket", async () => {
    expect((await call({ token: "x.y", items: [item(page.answers[0].id)] })).status).toBe(401);
  });
});
