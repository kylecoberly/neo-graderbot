import { describe, expect, it, vi } from "vitest";
import { safeJudge } from "./judge";

describe("safeJudge", () => {
  it("passes the judge's scores through", async () => {
    expect(await safeJudge(async () => [{ key: "judge_voice", score: 1 }])).toEqual([{ key: "judge_voice", score: 1 }]);
  });
  it("retries once, since the judge's refusals are occasional and spurious", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('stopped with reason "refusal"')).mockResolvedValue([{ key: "judge_voice", score: 0 }]);
    expect(await safeJudge(run)).toEqual([{ key: "judge_voice", score: 0 }]);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("records a judge failure as a score instead of failing the agent's test", async () => {
    const run = vi.fn().mockRejectedValue(new Error('stopped with reason "refusal"'));
    expect(await safeJudge(run)).toEqual([{ key: "judge_error", score: 1, comment: 'stopped with reason "refusal"' }]);
  });
});
