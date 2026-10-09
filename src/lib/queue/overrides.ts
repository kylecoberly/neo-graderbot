import { Client } from "langsmith";
import { maskPii } from "@/lib/agent/mask";
import type { Verdict } from "@/lib/types";
import type { OverrideUpload, QueueRow } from "./state";

export const OVERRIDES_DATASET = "neo-graderbot-overrides";

type DatasetClient = Pick<Client, "hasDataset" | "readDataset" | "createDataset" | "createExample">;
let datasetId: Promise<string> | null = null;

async function ensureDataset(client: DatasetClient): Promise<string> {
  if (await client.hasDataset({ datasetName: OVERRIDES_DATASET })) {
    return (await client.readDataset({ datasetName: OVERRIDES_DATASET })).id;
  }
  const created = await client.createDataset(OVERRIDES_DATASET, {
    description: "Instructor decisions from the Neo GraderBot queue: every resolved deferral and every spot-check of a recorded grade.",
  });
  return created.id;
}

export function resetOverrideCache() {
  datasetId = null;
}

// Every instructor decision becomes a labelled example: production traffic
// feeding the next offline eval.
export async function appendOverride(
  row: QueueRow,
  review: { verdict: Verdict; feedback: string },
  client: DatasetClient | null = process.env.LANGSMITH_API_KEY ? new Client() : null,
): Promise<OverrideUpload> {
  if (!client) return "skipped";
  try {
    datasetId ??= ensureDataset(client);
    await client.createExample({
      dataset_id: await datasetId,
      inputs: { answerId: row.answerId, questionId: row.questionId, question: row.prompt, answer: maskPii(row.answer) },
      outputs: { verdict: review.verdict, feedback: maskPii(review.feedback) },
      metadata: {
        slice: row.slice,
        runId: row.runId,
        agentAction: row.decision?.action ?? null,
        agentVerdict: row.decision?.verdict ?? null,
        deferReason: row.decision?.action === "defer" ? row.decision.reason : null,
        source: "queue",
      },
    });
    return "uploaded";
  } catch (err) {
    datasetId = null;
    console.error("Could not upload the override to LangSmith:", err);
    return "failed";
  }
}
