import { describe, expect, it } from "vitest";
import type { GradedAnswer, Question } from "@/lib/types";
import { ans } from "./fixtures";
import { BAD_REFERENCES, MISGRADED, buildPool, substantiveNote } from "./pool";

const q = (id: string): Question => ({ id, slice: "arrays", prompt: "CLI: `..`", reference: null });
const NOTE = "What does the second dot mean?";

// 4 learners rejected with real notes then accepted, 5 accepted only.
function strong(id: string): GradedAnswer[] {
  return [
    ...["01", "02", "03", "04"].flatMap((l) => [ans(`learner-${l}`, "reject", `wrong ${l}`, NOTE, id), ans(`learner-${l}`, "accept", `right ${l}`, null, id)]),
    ...["05", "06", "07", "08", "09"].map((l) => ans(`learner-${l}`, "accept", `fine ${l}`, null, id)),
  ];
}

describe("substantiveNote", () => {
  it("does not count a bare verdict word", () => {
    for (const n of ["Not quite", "Almost!", "Or?", "And?", "Look closer", "Reword this", "", null]) expect(substantiveNote(n)).toBe(false);
    expect(substantiveNote(NOTE)).toBe(true);
  });
});

describe("buildPool", () => {
  it("keeps a question that meets every rule", () => {
    expect(buildPool([q("cli-x")], strong("cli-x")).map((p) => p.id)).toEqual(["cli-x"]);
  });

  it("drops questions whose reference the audit found wrong", () => {
    const id = BAD_REFERENCES[0];
    expect(buildPool([q(id)], strong(id))).toEqual([]);
  });

  it("drops a question where an identical answer was graded both ways", () => {
    const answers = [...strong("cli-x"), ans("learner-10", "accept", "wrong 01", null, "cli-x")];
    expect(buildPool([q("cli-x")], answers)).toEqual([]);
  });

  it("needs three rejections with real notes", () => {
    const answers = strong("cli-x").map((a) => (a.feedback ? { ...a, feedback: a.learner === "learner-01" ? NOTE : "Not quite" } : a));
    expect(buildPool([q("cli-x")], answers)).toEqual([]);
  });

  it("ignores answers the audit found mis-graded", () => {
    const answers = strong("cli-x");
    const [first] = answers.filter((a) => a.verdict === "reject");
    const relabelled = answers.map((a) => (a === first ? { ...a, id: MISGRADED[0] } : a));
    expect(buildPool([q("cli-x")], relabelled)[0].rejectedLearners).toBe(3);
  });
});
