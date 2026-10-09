export const SESSION_GAP_MIN = 15;

export interface Hours {
  cutoffMinutes: number;
  sessions: number;
  days: number;
  totalMinutes: number;
  shortAnswerMinutes: number;
  shortAnswers: number;
  notes: number;
  resubmitChains?: number;
  byDay: { date: string; minutes: number }[];
}
interface Ev { createdAt: string; evaluatorId: string; isShortAnswer: boolean; status: string; feedback: string | null }

const at = (s: string) => Date.parse(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));

// Time between consecutive evaluations, when it is under the cutoff, is time
// spent grading the later one; a longer gap starts a new sitting. Only the
// instructor who graded most is counted, so a guest grader can't pad it.
export function gradingHours(evals: Ev[]): Hours {
  const counts = new Map<string, number>();
  for (const e of evals) counts.set(e.evaluatorId, (counts.get(e.evaluatorId) ?? 0) + 1);
  const me = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mine = evals.filter((e) => e.evaluatorId === me).sort((a, b) => at(a.createdAt) - at(b.createdAt));
  const byDay = new Map<string, number>();
  let sessions = 0;
  let total = 0;
  let short = 0;
  mine.forEach((e, i) => {
    const gap = i ? (at(e.createdAt) - at(mine[i - 1].createdAt)) / 60_000 : Infinity;
    if (gap > SESSION_GAP_MIN) {
      sessions += 1;
      return;
    }
    total += gap;
    if (e.isShortAnswer) short += gap;
    const day = e.createdAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + gap);
  });
  return {
    cutoffMinutes: SESSION_GAP_MIN,
    sessions,
    days: new Set(mine.map((e) => e.createdAt.slice(0, 10))).size,
    totalMinutes: Math.round(total),
    shortAnswerMinutes: Math.round(short),
    shortAnswers: mine.filter((e) => e.isShortAnswer).length,
    notes: mine.filter((e) => e.status === "rejected" && e.feedback?.trim()).length,
    byDay: [...byDay.entries()].sort().map(([date, minutes]) => ({ date, minutes: Math.round(minutes) })),
  };
}

// A learner rejected on a question who came back and was accepted: the
// "everyone can resubmit until it's right" loop the platform was built for.
export function resubmitChains(
  perfs: { id: number; userId: string; postSlug: string; createdAt: string }[],
  evals: { performanceId: number; status: string }[],
): number {
  const status = new Map(evals.map((e) => [e.performanceId, e.status]));
  const byPair = new Map<string, { createdAt: string; status: string | undefined }[]>();
  for (const p of perfs) {
    const k = `${p.userId}\u0000${p.postSlug}`;
    byPair.set(k, [...(byPair.get(k) ?? []), { createdAt: p.createdAt, status: status.get(p.id) }]);
  }
  let chains = 0;
  for (const attempts of byPair.values()) {
    const sorted = attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const firstReject = sorted.findIndex((a) => a.status === "rejected");
    if (firstReject >= 0 && sorted.slice(firstReject + 1).some((a) => a.status === "accepted")) chains += 1;
  }
  return chains;
}
