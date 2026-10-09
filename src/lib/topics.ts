import type { Slice } from "./types";

// The archive holds four kinds of question. Lesson questions, with one
// checkable answer in the lesson ("How do you add an element to the end of an
// array?"), are the kind the agent grades well; pseudocode programs and the
// HTML "is this conventional style?" questions are graded on formatting, and
// one-word vocabulary terms give retrieval too little to find. The first ten
// HTML questions are lesson questions; the other twenty-one are style.
export const TOPICS: Record<Slice, { questionPost: string; lessons: string[]; label: string; questions?: number }> = {
  arrays: { label: "JS arrays", questionPost: "js-arrays-questions", lessons: ["js-arrays"] },
  html: { label: "HTML", questionPost: "html-questions-1", lessons: ["html-intro", "html-syntax"], questions: 10 },
};

// The slices with a question strong enough for a demo page (data/demo-questions.json,
// drawn by scripts/demo-pool.mts).
export const DEMO_SLICES: Slice[] = ["arrays", "html"];

const BY_POST = new Map(Object.entries(TOPICS).map(([slice, t]) => [t.questionPost, slice as Slice]));

// A question id is "<post>-question-<n>"; a topic may keep only its first n.
export function sliceOfQuestion(questionId: string): Slice | null {
  const m = /^(.*)-question-(\d+)$/.exec(questionId);
  if (!m) return null;
  const slice = BY_POST.get(m[1]);
  if (!slice) return null;
  const limit = TOPICS[slice].questions;
  return limit === undefined || Number(m[2]) <= limit ? slice : null;
}
