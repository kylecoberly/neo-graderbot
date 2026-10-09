import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/random";
import { ans } from "./fixtures";
import { MAX_REJECTED, MIN_REJECTED, PAGE_SIZE, planPage } from "./sampler";

// learner-01..05 rejected once then accepted; learner-06..10 accepted only.
const mixed = () => [
  ...["01", "02", "03", "04", "05"].flatMap((l) => [ans(`learner-${l}`, "reject"), ans(`learner-${l}`, "accept")]),
  ...["06", "07", "08", "09", "10"].map((l) => ans(`learner-${l}`, "accept")),
];

describe("planPage", () => {
  it("draws 8 answers from 8 learners with 3–5 rejected", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const page = planPage(mixed(), mulberry32(seed))!;
      expect(page).toHaveLength(PAGE_SIZE);
      expect(new Set(page.map((a) => a.learner)).size).toBe(PAGE_SIZE);
      const rejected = page.filter((a) => a.verdict === "reject").length;
      expect(rejected).toBeGreaterThanOrEqual(MIN_REJECTED);
      expect(rejected).toBeLessThanOrEqual(MAX_REJECTED);
    }
  });

  it("spends reject-only learners first so the accepted side still fills", () => {
    // 3 learners never accepted; 5 accepted only. Only one page is possible.
    const answers = [
      ...["01", "02", "03"].map((l) => ans(`learner-${l}`, "reject")),
      ...["04", "05", "06", "07", "08"].map((l) => ans(`learner-${l}`, "accept")),
    ];
    const page = planPage(answers, mulberry32(7))!;
    expect(page.filter((a) => a.verdict === "reject").map((a) => a.learner).sort()).toEqual(["learner-01", "learner-02", "learner-03"]);
  });

  it("returns null when no balanced page exists", () => {
    const answers = ["01", "02", "03", "04", "05", "06", "07", "08"].map((l) => ans(`learner-${l}`, "accept"));
    expect(planPage(answers, mulberry32(1))).toBeNull();
  });

  it("is reproducible for a seed", () => {
    const fixture = mixed();
    expect(planPage(fixture, mulberry32(3))!.map((a) => a.id)).toEqual(planPage(fixture, mulberry32(3))!.map((a) => a.id));
  });
});
