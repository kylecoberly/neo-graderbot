import { z } from "zod";
import { AGENT_MODEL, chatModel, streamStructured, type ChatModel } from "@/lib/model";
import type { Judgment } from "@/lib/types";
import { buildMessages, type JudgeInput } from "./prompt";

// Sonnet 5 thinks by default and thinking is billed inside max_tokens; a
// smaller budget truncates the JSON on the comparison model.
export const AGENT_MAX_TOKENS = 8192;

// Evidence before the verdict so the model commits to it first; feedback
// last so it streams while everything else is already settled.
export const judgmentSchema = z.object({
  basis: z.string().describe("The sentence or two from the lesson passages or reference answer the verdict rests on, copied verbatim. Empty string if none applies."),
  verdict: z.enum(["accept", "reject"]),
  certainty: z.enum(["high", "medium", "low"]),
  feedback: z.string().describe("The note to the learner, in the instructor's voice. On a rejection it must not state the correct answer."),
});

export type JudgeFn = (input: JudgeInput, onFeedback?: (text: string) => void) => Promise<Judgment>;

export function feedbackListener(onFeedback?: (text: string) => void): (partial: Record<string, unknown>) => void {
  let last = "";
  return (partial) => {
    const feedback = typeof partial.feedback === "string" ? partial.feedback : "";
    if (!feedback || feedback === last) return;
    last = feedback;
    onFeedback?.(feedback);
  };
}

export function makeJudge(spec = AGENT_MODEL, build: typeof chatModel = chatModel): JudgeFn {
  let model: Promise<ChatModel> | null = null;
  return async (input, onFeedback) => {
    // A failed build is forgotten, so a transient error doesn't fail every
    // later grade in the process.
    model ??= build(spec, { maxTokens: AGENT_MAX_TOKENS }).catch((err: unknown) => {
      model = null;
      throw err;
    });
    const raw = await streamStructured(await model, judgmentSchema, buildMessages(input), feedbackListener(onFeedback), {
      runName: "judge",
    });
    return judgmentSchema.parse(raw);
  };
}
