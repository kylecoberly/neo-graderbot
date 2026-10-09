import type { GradedAnswer, Verdict } from "@/lib/types";

let n = 0;

export function ans(learner: string, verdict: Verdict, answer = `answer ${n}`, feedback: string | null = null, questionId = "q1"): GradedAnswer {
  n += 1;
  return { id: `a-${n}`, questionId, slice: "arrays", learner, answer, attempt: 1, verdict, feedback, answeredOn: "2022-04-01" };
}
