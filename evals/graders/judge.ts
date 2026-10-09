import { z } from "zod";
import { chatModel, invokeStructured } from "@/lib/model";
import type { Feedback } from "./types";

// The judge should not be a candidate: a model rates its own phrasing higher
// (Zheng et al. 2023; Wataoka et al. 2024). Opus 5 is neither the agent nor
// the comparison model, and the same judge grades every round, so a paired
// comparison cancels any house style.
export const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? "anthropic:claude-opus-5";

// Opus 5 thinks by default and thinking is billed inside max_tokens, so a
// verdict of two sentences still needs room; 1024 truncated mid-JSON.
const JUDGE_MAX_TOKENS = 4096;

// Reasoning comes before the verdict so the model commits to evidence first.
const verdict = z.object({
  reasoning: z
    .string()
    .describe("Two or three sentences: quote the relevant text, then say whether it meets the criterion"),
  pass: z.boolean(),
});

export interface Criterion<S extends string> {
  rubric: string;
  /** Which sections of the material this criterion may see. Everything else is withheld. */
  sections: readonly S[];
}

function snake(camel: string): string {
  return camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// One call per criterion, and each call sees only the sections its rubric
// names: telling a judge to ignore a section doesn't work, and what it can't
// see, it can't grade. Each result becomes its
// own feedback key (`judge_<criterion>`) so LangSmith can chart them
// separately.
export function judgeKey(criterion: string): string {
  return `judge_${snake(criterion)}`;
}

// Exactly what one criterion's call sees. Exported so the hand-labeling file
// shows a person the same material, no more.
export function judgeMaterial<S extends string>(
  criteria: Record<string, Criterion<S>>,
  sections: Record<S, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(criteria).map(([key, { sections: wanted }]) => [
      judgeKey(key),
      wanted.map((name) => `${name}\n${sections[name]}`).join("\n\n"),
    ]),
  );
}

export async function runJudge<S extends string>(
  criteria: Record<string, Criterion<S>>,
  instructions: string,
  sections: Record<S, string>,
): Promise<Feedback[]> {
  const model = await chatModel(JUDGE_MODEL, { maxTokens: JUDGE_MAX_TOKENS });
  const material = judgeMaterial(criteria, sections);
  return Promise.all(
    Object.entries(criteria).map(async ([key, { rubric }]) => {
      const prompt = material[judgeKey(key)];
      const object = verdict.parse(
        await invokeStructured(model, verdict, [
          {
            role: "system",
            content: `${instructions}

You are checking ONE criterion, strictly, against only the material below. Pass ONLY if every item the criterion covers clears the bar; a single item that misses it fails the whole criterion. Do not give the benefit of the doubt, and do not pass because most of it is fine. Reason first: quote the text the criterion turns on, then decide. When you fail it, your reasoning must quote the offending text so the agent's author can find it. If the section a criterion covers is empty ("(none)"), there is nothing to violate: pass.

Criterion: ${rubric}`,
          },
          { role: "user", content: prompt },
        ]),
      );
      return { key: judgeKey(key), score: object.pass ? 1 : 0, comment: object.reasoning };
    }),
  );
}

// The judge occasionally refuses an ordinary answer outright (2 of ~1,500
// calls in round 2). That says nothing about the agent, so it is retried once
// and then recorded as a score, not thrown into the agent's test result.
export async function safeJudge(run: () => Promise<Feedback[]>): Promise<Feedback[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt < 2) continue;
      return [{ key: "judge_error", score: 1, comment: err instanceof Error ? err.message : String(err) }];
    }
  }
}
