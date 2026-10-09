import type { Passage, Question } from "@/lib/types";
import { answerById, questionById } from "./page";
import { itemKeys, type Ticket } from "./tickets";

export interface Item { key: string; question: Question; answer: string; passages: Passage[] | null }

// A visitor's own question has no lesson; its key points stand in for one.
export const keyPointPassages = (points: string[]): Passage[] => [
  { lesson: "your-question", heading: "Key points", text: points.map((p) => `- ${p}`).join("\n"), score: 1 },
];

export function resolveItem(t: Ticket, key: string): Item | null {
  if (!itemKeys(t).includes(key)) return null;
  if (t.kind === "custom") {
    return {
      key,
      question: { id: "custom", slice: "custom", prompt: t.bundle.question, reference: t.bundle.reference },
      answer: t.bundle.responses[Number(key)].answer,
      passages: keyPointPassages(t.bundle.keyPoints),
    };
  }
  const question = questionById(t.questionId);
  const answer = answerById(key);
  return question && answer && answer.questionId === question.id ? { key, question, answer: answer.answer, passages: null } : null;
}
