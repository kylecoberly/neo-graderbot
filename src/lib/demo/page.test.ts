import { describe, expect, it } from "vitest";
import { loadDemoQuestions } from "@/lib/data";
import { mulberry32 } from "@/lib/random";
import { drawPage } from "./page";

describe("drawPage", () => {
  it("draws a pool question with 8 public answers", () => {
    const { question, answers } = drawPage({}, mulberry32(1));
    expect(loadDemoQuestions().map((p) => p.id)).toContain(question.id);
    expect(answers).toHaveLength(8);
    for (const a of answers) expect(Object.keys(a).sort()).toEqual(["answer", "id", "learner"]);
  });
  it("keeps to a requested slice", () => {
    for (let s = 1; s < 10; s++) expect(drawPage({ slice: "arrays" }, mulberry32(s)).question.slice).toBe("arrays");
  });
  it("avoids questions already seen while others remain", () => {
    const all = loadDemoQuestions().map((p) => p.id);
    const keep = all[0];
    expect(drawPage({ exclude: all.filter((id) => id !== keep) }, mulberry32(2)).question.id).toBe(keep);
    expect(all).toContain(drawPage({ exclude: all }, mulberry32(2)).question.id);
  });
  it("carries the lesson's vocabulary for scoring notes", () => {
    const { question } = drawPage({ slice: "arrays" }, mulberry32(1));
    expect(question.vocabulary.length).toBeGreaterThan(10);
    expect(question.vocabulary).toContain("array");
  });
  it("names the lessons a visitor can read", () => {
    expect(drawPage({ slice: "arrays" }, mulberry32(1)).question.lessons).toContain("js-arrays");
  });
});
