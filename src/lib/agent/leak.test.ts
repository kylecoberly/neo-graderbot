import { describe, expect, it } from "vitest";
import { copiesPassage, leaksReference } from "./leak";

const ref = "PROGRAM product\n  SET number_1 TO INPUT\n  SET number_2 TO INPUT\n  OUTPUT number_1 * number_2";

describe("leaksReference", () => {
  it("flags a six-word run of the reference the learner did not write", () => {
    expect(leaksReference("You need: SET number_2 TO INPUT OUTPUT number_1 * number_2", ref, "PROGRAM p\nSET a TO INPUT")).toBe(true);
  });
  it("ignores runs the learner already wrote", () => {
    const answer = "PROGRAM product\nSET number_1 TO INPUT\nSET number_2 TO INPUT\nOUTPUT number_1 + number_2";
    expect(leaksReference("PROGRAM product SET number_1 TO INPUT is fine; check the operator", ref, answer)).toBe(false);
  });
  it("is case and punctuation insensitive", () => {
    const tag = "A tag marks up content with angle brackets";
    expect(leaksReference("a TAG marks-up content, with angle brackets!", tag, "it styles text")).toBe(true);
  });
  it("never flags references under four words", () => {
    expect(leaksReference("The answer is yes, you see", "Yes", "no")).toBe(false);
  });
  it("is false without a reference", () => {
    expect(leaksReference("anything at all here today friends", null, "x")).toBe(false);
  });
});

describe("copiesPassage", () => {
  const passage = { lesson: "git-intro", heading: "Introduction to Git", text: "Git is a tool for keeping track of different versions of files. Git helps you:", score: 3 };
  it("flags twelve words in a row from a passage", () => {
    expect(copiesPassage("Git is a tool for keeping track of different versions of files.", [passage])).toBe(true);
  });
  it("lets a learner use the lesson's words in their own sentence", () => {
    expect(copiesPassage("Git keeps track of the different versions of your files as they change over time.", [passage])).toBe(false);
  });
});
