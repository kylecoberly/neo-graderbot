import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadQuestions } from "@/lib/data";
import { regradeRow, type StoredRow } from "./replay";

// pnpm evals:regrade <label> [<label> …]: re-score stored rounds after a
// grader fix. No model calls; decisions and judge scores are kept.
const labels = process.argv.slice(2);
const questions = new Map(loadQuestions().map((q) => [q.id, q]));
const commit = execSync("git rev-parse --short HEAD").toString().trim();
for (const label of labels) {
  for (const suite of ["core", "adversarial"] as const) {
    const path = `evals/.results/${suite}-${label}.json`;
    if (!existsSync(path)) continue;
    const run = JSON.parse(readFileSync(path, "utf8")) as {
      meta: Record<string, string>;
      rows: Record<string, StoredRow & { inputs: { questionId: string; answer: string } }>;
    };
    const retrieval = run.meta.retrieval !== "off";
    const rows = Object.fromEntries(
      Object.entries(run.rows).map(([id, row]) => [id, regradeRow(row, questions.get(row.inputs.questionId)!, suite, retrieval)]),
    );
    writeFileSync(path, JSON.stringify({ meta: { ...run.meta, regraded: commit }, rows }, null, 2));
    console.log(`${suite}-${label}: regraded ${Object.keys(rows).length} rows`);
  }
}
