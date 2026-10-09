import { defaultRetriever } from "@/lib/agent/defaults";
import { loadAnswers, loadDemoQuestions, loadQuestions } from "@/lib/data";
import { TOPICS } from "@/lib/topics";
import type { GradedAnswer, Question, Slice } from "@/lib/types";
import { usableAnswers } from "./pool";
import { vocabularyOf } from "./richness";
import { planPage } from "./sampler";

export interface PublicAnswer { id: string; learner: string; answer: string }
export interface PublicQuestion {
  id: string;
  slice: Slice;
  label: string;
  prompt: string;
  reference: string | null;
  lessons: string[];
  // Terms from the reference and the passages the agent would retrieve, so
  // the browser can score whether a note uses the lesson's language.
  vocabulary: string[];
}

let cache: { questions: Map<string, Question>; answers: Map<string, GradedAnswer>; byQuestion: Map<string, GradedAnswer[]> } | null = null;
function data() {
  if (!cache) {
    const usable = usableAnswers(loadAnswers());
    const byQuestion = new Map<string, GradedAnswer[]>();
    for (const a of usable) byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), a]);
    cache = { questions: new Map(loadQuestions().map((q) => [q.id, q])), answers: new Map(usable.map((a) => [a.id, a])), byQuestion };
  }
  return cache;
}

export const answerById = (id: string) => data().answers.get(id) ?? null;
export const questionById = (id: string) => data().questions.get(id) ?? null;

export function publicQuestion(q: Question): PublicQuestion {
  const slice = q.slice as Slice;
  const vocabulary = vocabularyOf([q.reference ?? "", ...defaultRetriever()(q).map((p) => p.text)]);
  return { id: q.id, slice, label: TOPICS[slice].label, prompt: q.prompt, reference: q.reference, lessons: TOPICS[slice].lessons, vocabulary };
}

export function drawPage(opts: { slice?: Slice; exclude?: string[] }, rand: () => number) {
  const inSlice = loadDemoQuestions().filter((p) => !opts.slice || p.slice === opts.slice);
  const fresh = inSlice.filter((p) => !opts.exclude?.includes(p.id));
  const choices = fresh.length ? fresh : inSlice;
  const entry = choices[Math.floor(rand() * choices.length)];
  const page = planPage(data().byQuestion.get(entry.id) ?? [], rand);
  if (!page) throw new Error(`Pool question ${entry.id} cannot fill a balanced page; rerun pnpm demo:pool.`);
  return {
    question: publicQuestion(data().questions.get(entry.id)!),
    answers: page.map(({ id, learner, answer }): PublicAnswer => ({ id, learner, answer })),
  };
}
