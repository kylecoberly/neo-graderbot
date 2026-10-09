import type { Retriever } from "@/lib/retrieval/retrieve";
import type { Question, Verdict } from "@/lib/types";
import type { Criterion } from "./judge";

export type Section = "QUESTION" | "GROUND TRUTH" | "LEARNER ANSWER" | "FEEDBACK";
const ALL: readonly Section[] = ["QUESTION", "GROUND TRUTH", "LEARNER ANSWER", "FEEDBACK"];

export const JUDGE_INSTRUCTIONS =
  "You are reviewing a note that an automated grader wrote to a learner about a short written answer in a software engineering course.";

export const feedbackCriteria: Record<"hintsNotReveals" | "accurate" | "voice", Criterion<Section>> = {
  hintsNotReveals: {
    rubric:
      "The FEEDBACK responds to an answer the grader rejected. It passes if it points the learner toward what is missing or wrong while leaving them something to figure out. It fails if the learner could copy the correct answer out of the FEEDBACK: if it states the key fact from the GROUND TRUTH that the LEARNER ANSWER lacks, or gives corrected code. Naming the area to rethink (\"there's one other thing it does\", \"check your loop condition\") passes.",
    sections: ALL,
  },
  accurate: {
    rubric:
      "Everything the FEEDBACK says or implies about the LEARNER ANSWER is true according to the GROUND TRUTH. It fails if it calls a correct part wrong, points at a non-problem while missing the actual error, approves an answer the GROUND TRUTH shows is wrong, or makes a false technical claim.",
    sections: ALL,
  },
  voice: {
    rubric:
      "The FEEDBACK reads like a busy, kind instructor's margin note: at most two short sentences, direct and informal, with no preamble, no praise sandwich, no bullet points and no restating of the question. These pass: \"that's the method and the path, what's the full URL?\"; \"Those are some of the available HTTP methods\"; \".toEqual is one matcher, but there are more\".",
    sections: ["FEEDBACK"],
  },
};

// An agreed acceptance has nothing for the judge to grade; a rejection note
// is where revealing, inaccuracy and tone actually happen.
export function criteriaFor(agentVerdict: Verdict): Record<string, Criterion<Section>> {
  return agentVerdict === "reject" ? feedbackCriteria : { accurate: feedbackCriteria.accurate };
}

// The judge retrieves for itself, so it sees the same ground truth in every
// round, including the baseline where the agent saw none.
export function feedbackSections(question: Question, answer: string, feedback: string, retrieve: Retriever): Record<Section, string> {
  const truth = [
    question.reference ? `Reference answer: ${question.reference}` : null,
    ...retrieve(question)
      .slice(0, 2)
      .map((p) => `Lesson (${p.lesson} — ${p.heading}):\n${p.text}`),
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    QUESTION: question.prompt,
    "GROUND TRUTH": truth || "(none)",
    "LEARNER ANSWER": answer || "(empty)",
    FEEDBACK: feedback || "(none)",
  };
}
