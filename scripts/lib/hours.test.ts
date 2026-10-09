import { describe, expect, it } from "vitest";
import { gradingHours, resubmitChains } from "./hours";

const e = (createdAt: string, evaluatorId = "me", isShortAnswer = true, status = "accepted", feedback: string | null = null) => ({
  createdAt,
  evaluatorId,
  isShortAnswer,
  status,
  feedback,
});

describe("gradingHours", () => {
  it("sums gaps within a session and splits sessions at 15 minutes", () => {
    const h = gradingHours([
      e("2022-04-01 09:00:00+00"),
      e("2022-04-01 09:05:00+00"),
      e("2022-04-01 09:10:00+00", "me", false),
      e("2022-04-01 11:00:00+00"),
      e("2022-04-02 08:00:00+00", "me", true, "rejected", "Which end?"),
      e("2022-04-02 08:01:00+00"),
    ]);
    expect(h).toMatchObject({ sessions: 3, days: 2, totalMinutes: 11, shortAnswerMinutes: 6, shortAnswers: 5, notes: 1 });
    expect(h.byDay).toEqual([
      { date: "2022-04-01", minutes: 10 },
      { date: "2022-04-02", minutes: 1 },
    ]);
  });
  it("counts only the evaluator who graded most", () => {
    expect(gradingHours([e("2022-04-01 09:00:00+00"), e("2022-04-01 09:05:00+00"), e("2022-04-01 09:01:00+00", "other")]).totalMinutes).toBe(5);
  });
});

describe("resubmitChains", () => {
  it("counts learner-and-question pairs where a rejection was later followed by an acceptance", () => {
    const perf = (id: number, userId: string, postSlug: string, createdAt: string) => ({ id, userId, postSlug, createdAt });
    const perfs = [
      perf(1, "u1", "q1", "2022-04-01 09:00:00+00"),
      perf(2, "u1", "q1", "2022-04-01 10:00:00+00"),
      perf(3, "u2", "q1", "2022-04-01 09:00:00+00"),
      perf(4, "u2", "q1", "2022-04-01 10:00:00+00"),
      perf(5, "u3", "q2", "2022-04-01 09:00:00+00"),
    ];
    const evals = [
      { performanceId: 1, status: "rejected" },
      { performanceId: 2, status: "accepted" },
      { performanceId: 3, status: "accepted" },
      { performanceId: 4, status: "rejected" },
      { performanceId: 5, status: "rejected" },
    ];
    expect(resubmitChains(perfs, evals)).toBe(1);
  });
});
