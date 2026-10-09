import { describe, expect, it } from "vitest";
import { chunkLesson } from "./chunk";

describe("chunkLesson", () => {
  const md = [
    "# CLI: File Management",
    "Intro paragraph about files.",
    "## Moving files and folders",
    "To move a file or folder, use the `mv` command:",
    "```bash",
    "# not a heading",
    "mv a.txt b/",
    "```",
    "## Empty",
    "",
    "## Deleting",
    "To delete a file, use the `rm` command.",
  ].join("\n");

  it("splits on headings outside code fences and skips empty sections", () => {
    const chunks = chunkLesson("cli-file-management-1", md);
    expect(chunks.map((c) => c.heading)).toEqual(["CLI: File Management", "Moving files and folders", "Deleting"]);
    expect(chunks[1].text).toContain("# not a heading");
    expect(chunks[1].id).toBe("cli-file-management-1#1");
  });

  it("packs a long section into pieces under the cap", () => {
    const para = "word ".repeat(140).trim();
    const chunks = chunkLesson("x", `## Long\n${para}\n\n${para}\n\n${para}`);
    expect(chunks).toHaveLength(2);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1500);
  });
});
