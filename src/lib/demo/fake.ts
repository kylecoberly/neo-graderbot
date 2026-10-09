import type { JudgeFn } from "@/lib/agent/judge";
import type { GeneratorFn } from "./generate";
import type { PageJudgeFn, PageJudgment } from "./pageJudge";

export const fakeMode = (env: Record<string, string | undefined> = process.env) => env.GRADERBOT_FAKE_MODEL === "1";

// For the end-to-end run and local UI work: deterministic, instant, free.
// Short answers and answers ending in a question are rejected; every third
// word count is a "medium" call so deferrals show up too.
export const fakeAgentJudge: JudgeFn = async (input, onFeedback) => {
  const words = input.answer.trim().split(/\s+/).filter(Boolean).length;
  const verdict = words >= 4 && !/\?\s*$/.test(input.answer) ? "accept" : "reject";
  const feedback = verdict === "accept" ? "Nice, that's it." : "What does your answer leave out?";
  onFeedback?.(feedback);
  await new Promise((r) => setTimeout(r, 30 + words * 5));
  const basis = (input.reference ?? input.passages[0]?.text ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  return { basis, verdict, certainty: words % 3 === 0 ? "medium" : "high", feedback };
};

export const fakePageJudge: PageJudgeFn = async (input, onPartial) => {
  const answers = input.items.map((it) => {
    const words = it.answer.trim().split(/\s+/).filter(Boolean).length;
    const better_verdict =
      it.agent.verdict === it.visitor.verdict ? "both" : it.agent.verdict === "reject" && words < 4 ? "agent" : "visitor";
    const [mine, its] = [it.visitor.note.trim().length, (it.agent.note ?? "").trim().length];
    const better_note = mine === its ? "tie" : mine > its ? "visitor" : "agent";
    return { key: it.key, reason: "Fake judge.", better_verdict, better_note, comment: "Fake judge: no model was called." } as const;
  });
  const judgment: PageJudgment = { answers, summary: "Fake judge: no model was called." };
  onPartial?.(judgment);
  return judgment;
};

// Passing slots get an answer the fake agent accepts; failing slots one it rejects.
export const fakeGenerator: GeneratorFn = async (question, slots) => {
  if (/\b(best|opinion)\b/i.test(question)) return { fit: { ok: false, reason: "Fake: that asks for an opinion." } };
  return {
    fit: { ok: true, reason: "fake" },
    reference: "The fake reference answer explains it.",
    keyPoints: ["explains it", "names the thing", "is short"],
    responses: slots.map((s, slot) => ({ slot, answer: s.intended === "accept" ? "The fake reference answer explains it in plain words" : "no idea?" })),
  };
};
