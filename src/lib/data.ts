import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Hours } from "../../scripts/lib/hours";
import type { PoolQuestion } from "./demo/pool";
import type { GradedAnswer, Question, Splits } from "./types";

const DATA = join(process.cwd(), "data");

function json<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

export const loadQuestions = () => json<Question[]>("questions.json");
export const loadAnswers = () => json<GradedAnswer[]>("answers.json");
export const loadSplits = () => json<Splits>("splits.json");
export const loadGradingHours = () => json<Hours>("grading-hours.json");
export const loadDemoQuestions = () => json<PoolQuestion[]>("demo-questions.json");

export function loadCorpus(): Record<string, string> {
  const dir = join(DATA, "corpus");
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => [f.slice(0, -3), readFileSync(join(dir, f), "utf8")]),
  );
}
