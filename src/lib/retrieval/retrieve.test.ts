import { describe, expect, it } from "vitest";
import { TOPICS } from "@/lib/topics";
import { SLICES, type Question } from "@/lib/types";
import { makeRetriever } from "./retrieve";

const corpus: Record<string, string> = Object.fromEntries(
  SLICES.flatMap((s) => TOPICS[s].lessons).map((l) => [l, ""]),
);
corpus["js-arrays"] = "## Adding and Removing Elements\nUse `.pop` to remove an element from the end of an array.\n\n## Spreading\nUse `...` to copy an array.";
corpus["html-syntax"] = "## Anatomy of a tag\nA tag has a name, and most tags come in an opening and closing pair.";

const q = (slice: Question["slice"], prompt: string): Question => ({ id: "q", slice, prompt, reference: null });

describe("makeRetriever", () => {
  const retrieve = makeRetriever(corpus);

  it("finds the passage about the term", () => {
    const [top] = retrieve(q("arrays", "**What does `.pop()` do?**"));
    expect(top).toMatchObject({ lesson: "js-arrays", heading: "Adding and Removing Elements" });
  });
  it("never leaves the question's slice", () => {
    expect(retrieve(q("html", "**What is an HTML tag?**")).every((p) => p.lesson.startsWith("html-"))).toBe(true);
  });
  it("has no lessons for a visitor's own question", () => {
    expect(retrieve(q("custom", "**CLI: `mv`**"))).toEqual([]);
  });

  it("returns nothing when the lessons don't share a term", () => {
    expect(retrieve(q("arrays", "**Quaternion**"))).toEqual([]);
  });
  it("fails loudly when a lesson is missing from the corpus", () => {
    expect(() => makeRetriever({})).toThrow(/corpus has no lesson/);
  });
});
