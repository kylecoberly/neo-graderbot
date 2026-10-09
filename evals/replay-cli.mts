import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { loadQuestions } from "@/lib/data";
import { replayRow, type StoredRow } from "./replay";

// pnpm evals:replay <from-label> <to-label>
const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error("usage: pnpm evals:replay <from-label> <to-label>");
  process.exit(1);
}
const questions = new Map(loadQuestions().map((q) => [q.id, q]));
const commit = execSync("git rev-parse --short HEAD").toString().trim();
for (const suite of ["core", "adversarial"] as const) {
  const run = JSON.parse(readFileSync(`evals/.results/${suite}-${from}.json`, "utf8")) as {
    meta: Record<string, string>;
    rows: Record<string, StoredRow & { inputs: { questionId: string; answer: string } }>;
  };
  const rows = Object.fromEntries(
    Object.entries(run.rows).map(([id, row]) => [id, replayRow(row, questions.get(row.inputs.questionId)!, suite)]),
  );
  writeFileSync(
    `evals/.results/${suite}-${to}.json`,
    JSON.stringify({ meta: { ...run.meta, label: to, commit, replayOf: from }, rows }, null, 2),
  );
  console.log(`${suite}: replayed ${Object.keys(rows).length} rows of ${from} as ${to}`);
}
