import { describe, expect, it } from "vitest";
import { richness, tokens, vocabularyOf } from "./richness";

const ctx = {
  verdict: "reject" as const,
  answer: "you use arr.pop() to get the first one",
  reference: "Use `.shift()` to remove the element at the start of the array and return it.",
  vocabulary: vocabularyOf(["The `.shift()` method removes the first element of an array.", "Arrays are ordered lists."]),
};

describe("tokens", () => {
  it("keeps code whole and also its parts", () => {
    expect([...tokens("try `arr.pop()` here")]).toEqual(expect.arrayContaining(["arr.pop()", "arr", "pop", "try"]));
  });
  it("drops stopwords and verdict words", () => {
    expect([...tokens("Not quite, look again at the answer")]).toEqual([]);
  });
});

describe("richness", () => {
  it("scores a note that names the learner's code, a lesson term, and asks", () => {
    const r = richness("Which end of the array does pop work on?", ctx);
    expect(r).toMatchObject({ specific: true, grounded: true, nudges: true, safe: true, score: 4 });
  });
  it("gives a bare verdict word nothing but safety", () => {
    expect(richness("Not quite", ctx)).toMatchObject({ specific: false, grounded: false, nudges: false, safe: true, score: 1, words: 2 });
  });
  it("scores an empty note zero", () => {
    expect(richness("   ", ctx).score).toBe(0);
  });
  it("marks a rejection that recites the reference unsafe", () => {
    expect(richness("Use .shift() to remove the element at the start of the array", ctx).safe).toBe(false);
  });
  it("does not check leaks on an acceptance", () => {
    expect(richness("Use .shift() to remove the element at the start of the array", { ...ctx, verdict: "accept" }).safe).toBe(true);
  });
});
