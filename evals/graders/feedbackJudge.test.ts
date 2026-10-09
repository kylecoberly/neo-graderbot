import { describe, expect, it } from "vitest";
import type { Passage, Question } from "@/lib/types";
import { criteriaFor, feedbackCriteria, feedbackSections } from "./feedbackJudge";
import { judgeMaterial } from "./judge";

const question: Question = { id: "q", slice: "arrays", prompt: "**CLI: `mv`**", reference: null };
const passage: Passage = { lesson: "cli-file-management-1", heading: "Moving", text: "Use `mv` to move or rename.", score: 2 };

describe("criteriaFor", () => {
  it("judges every criterion on a rejection, accuracy alone on an acceptance", () => {
    expect(Object.keys(criteriaFor("reject"))).toEqual(["hintsNotReveals", "accurate", "voice"]);
    expect(Object.keys(criteriaFor("accept"))).toEqual(["accurate"]);
  });
});

describe("feedbackSections", () => {
  it("gives the judge its own ground truth", () => {
    const sections = feedbackSections({ ...question, reference: "Moves or renames" }, "it moves", "One more thing!", () => [passage]);
    expect(sections["GROUND TRUTH"]).toContain("Reference answer: Moves or renames");
    expect(sections["GROUND TRUTH"]).toContain("Use `mv` to move or rename.");
  });
  it("says (none) when there is no ground truth", () => {
    expect(feedbackSections(question, "it moves", "x", () => [])["GROUND TRUTH"]).toBe("(none)");
  });
  it("shows the voice criterion only the feedback", () => {
    const sections = feedbackSections(question, "SECRET ANSWER", "One more thing!", () => [passage]);
    expect(judgeMaterial(feedbackCriteria, sections).judge_voice).toBe("FEEDBACK\nOne more thing!");
  });
});
