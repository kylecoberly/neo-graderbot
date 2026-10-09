import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DeferReason } from "@/lib/types";
import type { EvaluationStore } from "./store";

// Every grade goes to the instructor's queue; these two tools say how. A
// filed grade is ready to approve, a deferred one is flagged with the reason
// it needs a closer look. The model never holds either: the policy in code
// decides which one runs, and each shows up in the trace as a tool call.
export function evaluationTools(store: EvaluationStore) {
  const record = tool(
    async ({ answerId, verdict, feedback }) => {
      await store.record(answerId, { verdict, feedback });
      return `recorded ${verdict} for ${answerId}`;
    },
    {
      name: "file_grade",
      description: "File the grade and note in the instructor's queue as ready to approve.",
      schema: z.object({ answerId: z.string(), verdict: z.enum(["accept", "reject"]), feedback: z.string() }),
    },
  );
  const defer = tool(
    async ({ answerId, reason, verdict, feedback }) => {
      await store.defer(answerId, { reason: reason as DeferReason, verdict, feedback });
      return `deferred ${answerId}: ${reason}`;
    },
    {
      name: "defer_to_instructor",
      description: "Flag the answer in the instructor's queue with the reason it needs a closer look, and the agent's draft if it has one.",
      schema: z.object({
        answerId: z.string(),
        reason: z.string(),
        verdict: z.enum(["accept", "reject"]).nullable(),
        feedback: z.string().nullable(),
      }),
    },
  );
  return { record, defer };
}
