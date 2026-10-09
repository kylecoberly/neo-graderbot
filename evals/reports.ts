import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Report } from "./stats";

// Two copies of every round. The full report (evals/.results, gitignored:
// megabytes per round, with every output and exactly what the judge saw) is
// what replay, regrade, failures and calibrate read. The compact one
// (evals/results, committed: the scores alone) is enough for the tables and
// the paired comparison, so a fresh clone can reproduce docs/results.md
// without a model call.
export const FULL = "evals/.results";
export const COMPACT = "evals/results";

export function compact(report: Report): Report {
  const scores = (r: Report["rows"][string]) => ({ meta: r.meta, feedback: r.feedback.map(({ key, score }) => ({ key, score })) });
  return { meta: report.meta, rows: Object.fromEntries(Object.entries(report.rows).map(([id, r]) => [id, scores(r)])) };
}

export function writeReports(suite: string, label: string | undefined, report: Report) {
  mkdirSync(FULL, { recursive: true });
  mkdirSync(COMPACT, { recursive: true });
  const body = JSON.stringify(report, null, 2);
  writeFileSync(`${FULL}/${suite}-last-run.json`, body);
  if (!label) return;
  writeFileSync(`${FULL}/${suite}-${label}.json`, body);
  writeFileSync(`${COMPACT}/${suite}-${label}.json`, JSON.stringify(compact(report)) + "\n");
}

export function loadReport(suite: string, label: string): Report {
  for (const dir of [FULL, COMPACT]) {
    const path = `${dir}/${suite}-${label}.json`;
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as Report;
  }
  console.error(`No ${COMPACT}/${suite}-${label}.json; run that round first.`);
  process.exit(1);
}
