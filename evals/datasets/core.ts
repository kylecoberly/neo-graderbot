import { loadAnswers, loadQuestions, loadSplits } from "@/lib/data";
import type { GradedAnswer, Question, Slice, Splits, Verdict } from "@/lib/types";

export interface CoreExample {
  id: string;
  inputs: { answerId: string; questionId: string; question: string; answer: string };
  referenceOutputs: { verdict: Verdict; feedback: string | null };
  metadata: { slice: Slice; hardPair: boolean; hasReference: boolean; attempt: number };
}

// The expected outcome is what the instructor actually decided in 2022, and
// the note they actually wrote, not something written for the eval.
export function coreExamples(
  questions: Question[] = loadQuestions(),
  answers: GradedAnswer[] = loadAnswers(),
  splits: Splits = loadSplits(),
): CoreExample[] {
  const byId = new Map(answers.map((a) => [a.id, a]));
  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const paired = new Set(splits.hardPairs.flat());
  return splits.core.map((id) => {
    const a = byId.get(id);
    if (!a) throw new Error(`splits.json names ${id}, which answers.json lacks`);
    const q = byQuestion.get(a.questionId);
    if (!q) throw new Error(`answer ${id} names question ${a.questionId}, which questions.json lacks`);
    return {
      id,
      inputs: { answerId: id, questionId: q.id, question: q.prompt, answer: a.answer },
      referenceOutputs: { verdict: a.verdict, feedback: a.feedback },
      metadata: { slice: a.slice, hardPair: paired.has(id), hasReference: q.reference !== null, attempt: a.attempt },
    };
  });
}

export function limitPerSlice<T extends { metadata: { slice: Slice } }>(examples: T[], limit: number | undefined): T[] {
  if (!limit) return examples;
  const seen = new Map<Slice, number>();
  return examples.filter((e) => {
    const n = seen.get(e.metadata.slice) ?? 0;
    seen.set(e.metadata.slice, n + 1);
    return n < limit;
  });
}
