import { shuffle } from "@/lib/random";
import type { GradedAnswer } from "@/lib/types";

export const PAGE_SIZE = 8;
export const MIN_REJECTED = 3;
export const MAX_REJECTED = 5;

const pick = <T>(items: T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

// One answer per learner, like a real queue, with enough rejections to be
// worth grading. Learners who were never accepted are spent on the rejected
// side first, so the accepted side still has learners left to draw from.
export function planPage(answers: GradedAnswer[], rand: () => number): GradedAnswer[] | null {
  const byLearner = new Map<string, { reject: GradedAnswer[]; accept: GradedAnswer[] }>();
  for (const a of answers) {
    const entry = byLearner.get(a.learner) ?? { reject: [], accept: [] };
    entry[a.verdict].push(a);
    byLearner.set(a.learner, entry);
  }
  const learners = shuffle([...byLearner.keys()].sort(), rand);
  const has = (l: string, v: "reject" | "accept") => byLearner.get(l)![v].length > 0;
  const rejecters = [...learners.filter((l) => has(l, "reject") && !has(l, "accept")), ...learners.filter((l) => has(l, "reject") && has(l, "accept"))];
  for (const k of shuffle([MIN_REJECTED, 4, MAX_REJECTED], rand)) {
    const rejected = rejecters.slice(0, k);
    if (rejected.length < k) continue;
    const accepted = learners.filter((l) => !rejected.includes(l) && has(l, "accept")).slice(0, PAGE_SIZE - k);
    if (accepted.length < PAGE_SIZE - k) continue;
    return shuffle(
      [...rejected.map((l) => pick(byLearner.get(l)!.reject, rand)), ...accepted.map((l) => pick(byLearner.get(l)!.accept, rand))],
      rand,
    );
  }
  return null;
}
