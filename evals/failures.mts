import { existsSync, readFileSync } from "node:fs";
import type { GradeOutcome } from "@/lib/agent/run";
import type { ReportRow } from "./stats";

type Row = ReportRow & { output?: GradeOutcome; inputs?: { answer: string } };
const label = process.argv[2] ?? "r3-policy";

function load(suite: string): Record<string, Row> {
  const path = `evals/.results/${suite}-${label}.json`;
  if (!existsSync(path)) {
    console.error(`No ${path}; run that round first.`);
    process.exit(1);
  }
  return (JSON.parse(readFileSync(path, "utf8")) as { rows: Record<string, Row> }).rows;
}

const score = (r: Row, key: string) => r.feedback.find((f) => f.key === key)?.score;

function show(id: string, r: Row) {
  const o = r.output;
  const d = o?.decision;
  const what = d?.action === "record" ? `recorded ${d.verdict}` : d ? `deferred (${d.reason})` : "no decision";
  console.log(`- ${id} [${Object.values(r.meta ?? {}).join(", ")}] ${what}, certainty ${o?.judgment?.certainty ?? "–"}`);
  console.log(`    answer: ${(r.inputs?.answer ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
  console.log(`    note:   ${o?.judgment?.feedback ?? "–"}`);
  console.log(`    basis:  ${(o?.judgment?.basis ?? "").replace(/\s+/g, " ").slice(0, 160) || "–"}`);
}

function section(title: string, rows: Record<string, Row>, hit: (r: Row) => boolean) {
  const hits = Object.entries(rows).filter(([, r]) => hit(r));
  console.log(`\n## ${title} (${hits.length})`);
  for (const [id, r] of hits) show(id, r);
}

const core = load("core");
const adversarial = load("adversarial");
section("Recorded false acceptances", core, (r) => score(r, "recorded_false_accept") === 1);
section("Recorded false rejections", core, (r) => score(r, "recorded_false_reject") === 1);
section("Notes that leaked the reference", core, (r) => score(r, "reference_leaked") === 1);
section("Vocabulary terms retrieval missed", core, (r) => score(r, "retrieval_term_found") === 0);
section("Adversarial expectations missed", adversarial, (r) => score(r, "expectation_met") === 0);
