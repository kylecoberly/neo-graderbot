import { describe, expect, it } from "vitest";
import { loadDemoQuestions } from "@/lib/data";
import { mulberry32 } from "@/lib/random";
import { drawPage } from "./page";
import { keyPointPassages, resolveItem } from "./resolve";
import type { Bundle } from "./tickets";

const bundle: Bundle = {
  question: "What does `ls` do?",
  reference: "It lists the contents of a directory.",
  keyPoints: ["lists files", "in the current directory by default"],
  responses: Array.from({ length: 8 }, (_, i) => ({ kind: "terse_correct" as const, intended: "accept" as const, answer: `answer ${i}` })),
};

describe("resolveItem", () => {
  it("finds an archive answer on its page", () => {
    const { question, answers } = drawPage({}, mulberry32(4));
    const item = resolveItem({ kind: "page", questionId: question.id, answerIds: answers.map((a) => a.id) }, answers[2].id)!;
    expect(item).toMatchObject({ key: answers[2].id, answer: answers[2].answer, passages: null });
    expect(item.question.id).toBe(question.id);
  });
  it("refuses a key that is not on the ticket", () => {
    const id = loadDemoQuestions()[0].id;
    expect(resolveItem({ kind: "page", questionId: id, answerIds: ["a-1"] }, "a-2")).toBeNull();
  });
  it("refuses an answer to a different question, even if the ticket lists it", () => {
    const [a, b] = [drawPage({ slice: "arrays" }, mulberry32(1)), drawPage({ slice: "html" }, mulberry32(1))];
    expect(resolveItem({ kind: "page", questionId: a.question.id, answerIds: [b.answers[0].id] }, b.answers[0].id)).toBeNull();
  });
  it("grounds a custom response on its reference and key points", () => {
    const item = resolveItem({ kind: "custom", bundle }, "3")!;
    expect(item.question).toEqual({ id: "custom", slice: "custom", prompt: bundle.question, reference: bundle.reference });
    expect(item.answer).toBe("answer 3");
    expect(item.passages).toEqual(keyPointPassages(bundle.keyPoints));
  });
});
