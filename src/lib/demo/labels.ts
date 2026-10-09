import { createHash } from "node:crypto";
import { Client } from "langsmith";
import type { RunReceipt } from "./tickets";
import { demoSecret, verify } from "./token";

// One id per run and label, so a replayed receipt rewrites the same feedback
// (or is refused) instead of piling up duplicates.
export function labelId(runId: string, key: string): string {
  const h = createHash("sha256").update(`${runId}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function readReceipt(receipt: unknown): RunReceipt | null {
  if (typeof receipt !== "string") return null;
  const r = verify<RunReceipt>(receipt, demoSecret());
  return r?.kind === "run" ? r : null;
}

export const labelsOn = () => process.env.LANGSMITH_TRACING === "true";

// Feedback on the agent's own traces. A label LangSmith refuses (a replay of
// an id it already has) is not an error for the visitor.
export async function writeLabels(labels: { runId: string; key: string; score?: number; value?: string }[]): Promise<number> {
  if (!labels.length) return 0;
  const client = new Client();
  const results = await Promise.allSettled(
    labels.map(({ runId, key, ...rest }) => client.createFeedback(runId, key, { ...rest, feedbackId: labelId(runId, key) })),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}
