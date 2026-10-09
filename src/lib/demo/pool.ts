import { mulberry32 } from "@/lib/random";
import type { GradedAnswer, Question, Slice } from "@/lib/types";
import { planPage } from "./sampler";

export interface PoolQuestion {
  id: string;
  slice: Slice;
  learners: number;
  rejectedLearners: number;
  acceptedLearners: number;
  notedRejections: number;
}

// From the 2026-10-08 audit of the archive against the agent's disagreements.
export const BAD_REFERENCES: string[] = ["html-questions-1-question-8"];
export const MISGRADED = ["a-21660"];

const MIN_LEARNERS = 8;
const MIN_REJECTED_LEARNERS = 3;
const MIN_ACCEPTED_LEARNERS = 4;
const MIN_NOTED_REJECTIONS = 3;
const NOTE_MIN_CHARS = 12;
const BARE = /^(not quite|almost|look closer|reword this|or|and|nope|no|close)[\s.!?]*$/i;

export function substantiveNote(note: string | null): boolean {
  const n = note?.trim() ?? "";
  return n.length >= NOTE_MIN_CHARS && !BARE.test(n);
}

export const usableAnswers = (answers: GradedAnswer[]) => answers.filter((a) => !MISGRADED.includes(a.id));

// A page is only as convincing as its question: the pool keeps questions with
// a sound reference, real rejection notes, and no answer the instructor graded
// both ways.
export function buildPool(questions: Question[], answers: GradedAnswer[]): PoolQuestion[] {
  const byQuestion = new Map<string, GradedAnswer[]>();
  for (const a of usableAnswers(answers)) byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), a]);
  const pool: PoolQuestion[] = [];
  for (const q of questions) {
    const list = byQuestion.get(q.id) ?? [];
    if (BAD_REFERENCES.includes(q.id) || !list.length) continue;
    const learnersWith = (keep: (a: GradedAnswer) => boolean) => new Set(list.filter(keep).map((a) => a.learner)).size;
    const verdicts = new Map<string, Set<string>>();
    for (const a of list) verdicts.set(a.answer.trim(), (verdicts.get(a.answer.trim()) ?? new Set()).add(a.verdict));
    const entry: PoolQuestion = {
      id: q.id,
      slice: q.slice as Slice,
      learners: learnersWith(() => true),
      rejectedLearners: learnersWith((a) => a.verdict === "reject"),
      acceptedLearners: learnersWith((a) => a.verdict === "accept"),
      notedRejections: learnersWith((a) => a.verdict === "reject" && substantiveNote(a.feedback)),
    };
    if (
      entry.learners >= MIN_LEARNERS &&
      entry.rejectedLearners >= MIN_REJECTED_LEARNERS &&
      entry.acceptedLearners >= MIN_ACCEPTED_LEARNERS &&
      entry.notedRejections >= MIN_NOTED_REJECTIONS &&
      ![...verdicts.values()].some((v) => v.size > 1) &&
      planPage(list, mulberry32(1)) !== null
    ) {
      pool.push(entry);
    }
  }
  return pool.sort((a, b) => b.notedRejections - a.notedRejections || a.id.localeCompare(b.id));
}
