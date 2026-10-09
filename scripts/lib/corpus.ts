import { execFileSync } from "node:child_process";

// The last commit before the readings moved out of the posts repo.
export const POSTS_COMMIT = "27de06d5467c2c76e437733ec063322222510921";

export function stripFrontMatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "").trimStart();
}

export function readLesson(repo: string, slug: string): string {
  const md = execFileSync("git", ["-C", repo, "show", `${POSTS_COMMIT}:${slug}/README.md`], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const lesson = stripFrontMatter(md);
  if (!lesson.trim()) throw new Error(`Lesson "${slug}" is empty at ${POSTS_COMMIT.slice(0, 7)}; drop it from TOPICS.`);
  return lesson;
}
