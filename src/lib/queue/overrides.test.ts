import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GradedAnswer, Question } from "@/lib/types";
import { appendOverride, resetOverrideCache } from "./overrides";
import { newRow } from "./state";

const answer: GradedAnswer = { id: "a-1", questionId: "q", slice: "arrays", learner: "learner-01", answer: "x", attempt: 1, verdict: "accept", feedback: null, answeredOn: "2022-03-01" };
const question: Question = { id: "q", slice: "arrays", prompt: "**Q**", reference: null };
const row = { ...newRow(answer, question), status: "deferred" as const, runId: "run-1" };

function fakeClient(exists: boolean) {
  return {
    hasDataset: vi.fn().mockResolvedValue(exists),
    readDataset: vi.fn().mockResolvedValue({ id: "ds-existing" }),
    createDataset: vi.fn().mockResolvedValue({ id: "ds-new" }),
    createExample: vi.fn().mockResolvedValue({}),
  };
}

describe("appendOverride", () => {
  beforeEach(() => resetOverrideCache());

  it("skips without a client", async () => {
    expect(await appendOverride(row, { verdict: "reject", feedback: "x" }, null)).toBe("skipped");
  });
  it("creates the dataset once, then appends", async () => {
    const client = fakeClient(false);
    const c = client as unknown as Parameters<typeof appendOverride>[2];
    expect(await appendOverride(row, { verdict: "reject", feedback: "One more" }, c)).toBe("uploaded");
    await appendOverride(row, { verdict: "accept", feedback: "Yup" }, c);
    expect(client.createDataset).toHaveBeenCalledTimes(1);
    expect(client.createExample).toHaveBeenCalledTimes(2);
    expect(client.createExample.mock.calls[0][0]).toMatchObject({
      dataset_id: "ds-new",
      outputs: { verdict: "reject", feedback: "One more" },
      metadata: { slice: "arrays", runId: "run-1" },
    });
  });
  it("masks contact details before the answer leaves for LangSmith", async () => {
    const client = fakeClient(true);
    const c = client as unknown as Parameters<typeof appendOverride>[2];
    await appendOverride({ ...row, answer: "redo? text 303-555-0142 or a@b.co" }, { verdict: "reject", feedback: "x" }, c);
    expect(client.createExample.mock.calls[0][0].inputs.answer).toBe("redo? text [phone] or [email]");
  });
  it("reports a failure instead of throwing", async () => {
    const client = fakeClient(true);
    client.createExample.mockRejectedValue(new Error("down"));
    const c = client as unknown as Parameters<typeof appendOverride>[2];
    expect(await appendOverride(row, { verdict: "reject", feedback: "x" }, c)).toBe("failed");
  });
});
