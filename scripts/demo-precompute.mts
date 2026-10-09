import { writeFileSync } from "node:fs";
import { flushTraces } from "@/lib/agent/mask";
import { grade } from "@/lib/agent/run";
import { loadAnswers, loadDemoQuestions, loadQuestions } from "@/lib/data";
import { storedResult } from "@/lib/demo/fallback";
import { usableAnswers } from "@/lib/demo/pool";
import { demoGraph } from "@/lib/demo/service";
import { precompute } from "./lib/precompute";

// One live grading of every answer the demo can show, stored so a page still
// shows GraderBot's grade when a live call fails. Costs real money (Sonnet 5:
// under a cent an answer); answers already stored are skipped unless --all.
if (process.env.GRADERBOT_FAKE_MODEL !== "1") process.loadEnvFile(".env.local");
const pool = new Set(loadDemoQuestions().map((p) => p.id));
const questions = new Map(loadQuestions().map((q) => [q.id, q]));
const all = process.argv.includes("--all");
const answers = new Map(
  usableAnswers(loadAnswers())
    .filter((a) => pool.has(a.questionId) && (all || !storedResult(a.id)))
    .map((a) => [a.id, a]),
);
const graph = demoGraph(null);
const started = Date.now();
let done = 0;

const { results, failed } = await precompute(
  [...answers.keys()],
  async (id) => {
    const a = answers.get(id)!;
    const out = await grade(graph, { answerId: id, question: questions.get(a.questionId)!, answer: a.answer }, { metadata: { demo: "precompute" } });
    done += 1;
    if (done % 50 === 0) console.log(`${done}/${answers.size}`);
    return { decision: out.decision, certainty: out.judgment?.certainty ?? null, basis: out.judgment?.basis ?? null };
  },
  { concurrency: 4 },
);
await flushTraces();

const kept = Object.fromEntries(
  usableAnswers(loadAnswers())
    .filter((a) => pool.has(a.questionId) && !answers.has(a.id))
    .flatMap((a) => (storedResult(a.id) ? [[a.id, storedResult(a.id)!] as const] : [])),
);
const sorted = Object.fromEntries(Object.entries({ ...kept, ...results }).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("data/demo-fallback.json", JSON.stringify(sorted, null, 2) + "\n");
const recorded = Object.values(results).filter((r) => r.decision.action === "record").length;
console.log(
  `${Object.keys(results).length} stored (${recorded} recorded, ${Object.keys(results).length - recorded} deferred), ${failed.length} failed${failed.length ? `: ${failed.join(", ")}` : ""}; ${Math.round((Date.now() - started) / 1000)} s`,
);
