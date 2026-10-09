import { describe, expect, it } from "vitest";
import { Bm25, tokenize } from "./bm25";

describe("tokenize", () => {
  it("keeps backticked code as its own token and drops stopwords", () => {
    expect(tokenize("Use `..` to go up, and `mv` to move")).toEqual(["..", "mv", "use", "go", "up", "mv", "move"]);
  });
});

describe("Bm25", () => {
  const docs = [
    "The `mv` command moves or renames files.",
    "The `cp` command copies files.",
    "Files and directories live in a tree.",
  ];
  const index = new Bm25(docs, (d) => d);

  it("ranks the document with the rare term first", () => {
    expect(index.search("CLI: `mv`", 3)[0].item).toBe(docs[0]);
  });
  it("returns only documents that share a term", () => {
    expect(index.search("quaternion", 3)).toEqual([]);
  });
  it("respects k", () => {
    expect(index.search("files", 2)).toHaveLength(2);
  });
});
