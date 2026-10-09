import { describe, expect, it } from "vitest";
import { loadCorpus } from "./data";
import { sliceOfQuestion, TOPICS } from "./topics";
import { SLICES } from "./types";

describe("topics", () => {
  it("covers every slice", () => expect(Object.keys(TOPICS).sort()).toEqual([...SLICES].sort()));
  it("maps a question to its slice, keeping only a topic's lesson questions", () => {
    expect(sliceOfQuestion("js-arrays-questions-question-4")).toBe("arrays");
    expect(sliceOfQuestion("html-questions-1-question-10")).toBe("html");
    expect(sliceOfQuestion("html-questions-1-question-11")).toBeNull();
    expect(sliceOfQuestion("cli-vocabulary-question-4")).toBeNull();
    expect(sliceOfQuestion("js-arrays")).toBeNull();
  });
});

describe("the exported corpus", () => {
  // An empty lesson yields no chunks, so a slice silently runs on fewer lessons.
  it("has text for every lesson a slice names", () => {
    const corpus = loadCorpus();
    const empty = Object.values(TOPICS).flatMap((t) => t.lessons).filter((l) => !corpus[l]?.trim());
    expect(empty).toEqual([]);
  });
});
