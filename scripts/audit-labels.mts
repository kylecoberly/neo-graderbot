import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { defaultRetriever } from "@/lib/agent/defaults";
import { flushTraces } from "@/lib/agent/mask";
import { THE_BAR } from "@/lib/agent/prompt";
import { loadQuestions } from "@/lib/data";
import { chatModel, invokeStructured } from "@/lib/model";
import { SLICES, type Slice, type Verdict } from "@/lib/types";
import { coreExamples } from "../evals/datasets/core";
import { JUDGE_MODEL } from "../evals/graders/judge";
import type { Report } from "../evals/stats";
import { precompute } from "./lib/precompute";

// The 2022 verdicts are one instructor's calls, made at eleven seconds each.
// This asks a second grader, Opus 5, blind to those calls, to grade the core
// set against the same lessons and bar; where the two disagree the instructor
// adjudicates by hand (`concede` in label-audit.json). What comes out is an
// estimate of the labels' own error rate, and the subset of the core set
// both graders agree on, which is the cleanest ground truth this archive has.
// Answers already in the stored file keep their second opinion; only new core
// answers cost a call. Delete label-audit.json to start over.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const AUDIT = "evals/calibration/label-audit.json";
const READABLE = "evals/calibration/label-audit.md";

interface Entry {
  id: string;
  slice: Slice;
  questionId: string;
  instructor: Verdict;
  second: { verdict: Verdict; certainty: "high" | "medium" | "low"; reasoning: string };
  /** Set by the instructor on disagreements: true = the 2022 verdict was wrong. */
  concede: boolean | null;
}
interface Audit { run: { model: string; graded: string }; entries: Entry[] }

const secondOpinion = z.object({
  reasoning: z.string().describe("Two or three sentences: what the answer gets right or wrong against the lesson and the bar."),
  verdict: z.enum(["accept", "reject"]),
  certainty: z.enum(["high", "medium", "low"]),
});

const SYSTEM = `You are an experienced software engineering instructor giving a second opinion on short written answers from a course for working adults. Another instructor already graded each one; you are not shown their verdict. Grade the answer yourself against the lesson passages and the reference answer when given, by this bar:

${THE_BAR}

A reference answer can contain mistakes; when it does, grade against the lesson and say so. Reason first, then decide.`;

const questions = new Map(loadQuestions().map((q) => [q.id, q]));
const examples = coreExamples();

const stored: Audit | null = existsSync(AUDIT) ? (JSON.parse(readFileSync(AUDIT, "utf8")) as Audit) : null;
const have = new Map((stored?.entries ?? []).map((e) => [e.id, e]));
if (examples.some((e) => !have.has(e.id))) await audit();
report(JSON.parse(readFileSync(AUDIT, "utf8")) as Audit);

async function audit() {
  const retrieve = defaultRetriever();
  const model = await chatModel(JUDGE_MODEL, { maxTokens: 4096 });
  let done = 0;
  const { results, failed } = await precompute(
    examples.filter((e) => !have.has(e.id)).map((e) => e.id),
    async (id) => {
      const ex = examples.find((e) => e.id === id)!;
      const q = questions.get(ex.inputs.questionId)!;
      const parts = [`QUESTION\n${q.prompt}`];
      if (q.reference) parts.push(`REFERENCE ANSWER (from the course; may contain mistakes)\n${q.reference}`);
      const passages = retrieve(q);
      if (passages.length) parts.push(`LESSON PASSAGES\n${passages.map((p, i) => `[${i + 1}] ${p.lesson} — ${p.heading}\n${p.text}`).join("\n\n")}`);
      parts.push(`LEARNER ANSWER\n${ex.inputs.answer}`);
      const raw = await invokeStructured(model, secondOpinion, [
        { role: "system", content: SYSTEM },
        { role: "user", content: parts.join("\n\n") },
      ]);
      done += 1;
      if (done % 40 === 0) console.log(`${done}/${examples.length}`);
      return secondOpinion.parse(raw);
    },
    { concurrency: 4 },
  );
  await flushTraces();
  if (failed.length) console.error(`${failed.length} calls failed after retries: ${failed.join(", ")}`);
  const entries: Entry[] = examples.flatMap((e) => {
    const kept = have.get(e.id);
    if (kept) return [kept];
    if (!results[e.id]) return [];
    return [{ id: e.id, slice: e.metadata.slice, questionId: e.inputs.questionId, instructor: e.referenceOutputs.verdict, second: results[e.id], concede: null }];
  });
  const out: Audit = { run: { model: JUDGE_MODEL, graded: new Date().toISOString().slice(0, 10) }, entries };
  writeFileSync(AUDIT, JSON.stringify(out, null, 2) + "\n");
  writeFileSync(READABLE, readable(out));
  console.log(`${entries.length} second opinions in ${AUDIT}; the disagreements are laid out in ${READABLE}`);
}

function readable(a: Audit): string {
  const disputed = a.entries.filter((e) => e.second.verdict !== e.instructor);
  const lines = [
    "# Label audit: where a second grader disagrees with the 2022 verdict",
    "",
    `${a.run.model} graded the ${a.entries.length} core answers blind and disagreed on ${disputed.length}. For each one below, decide whether the 2022 verdict was wrong, and set \`concede\` in label-audit.json: \`true\` if the second grader has it right, \`false\` if the 2022 verdict stands. Then \`pnpm audit:labels\` prints the instructor's error rate.`,
    "",
  ];
  for (const e of disputed) {
    const q = questions.get(e.questionId)!;
    lines.push(`## ${e.id} (${e.slice})`, "", `**Question:** ${q.prompt}`, "");
    if (q.reference) lines.push(`**Reference:** ${q.reference}`, "");
    lines.push(`**Answer:** ${answerText(e.id)}`, "");
    lines.push(`**2022 verdict:** ${e.instructor}. **Second grader:** ${e.second.verdict} (${e.second.certainty}).`, "", `> ${e.second.reasoning}`, "");
  }
  return lines.join("\n");
}

function answerText(id: string): string {
  return examples.find((e) => e.id === id)!.inputs.answer.replace(/\n/g, "\n> ");
}

function report(a: Audit) {
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");
  const rows = (es: Entry[]) => {
    const disputed = es.filter((e) => e.second.verdict !== e.instructor);
    const strict = disputed.filter((e) => e.instructor === "reject").length;
    const conceded = disputed.filter((e) => e.concede === true).length;
    const adjudicated = disputed.filter((e) => e.concede !== null).length;
    return `${es.length} | ${pct(es.length - disputed.length, es.length)} | ${disputed.length} | ${strict} | ${disputed.length - strict} | ${adjudicated ? `${conceded} of ${adjudicated}` : "pending"} | ${adjudicated === disputed.length && disputed.length ? pct(es.length - conceded, es.length) : "–"}`;
  };
  console.log(`## Label audit: ${a.run.model} against the 2022 verdicts (${a.run.graded})\n`);
  console.log("| slice | n | agree | disputed | 2022 stricter | 2022 looser | conceded | 2022 labels right |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const s of SLICES) console.log(`| ${s} | ${rows(a.entries.filter((e) => e.slice === s))} |`);
  console.log(`| all | ${rows(a.entries)} |`);

  // The agent against the labels both graders agree on, read from the stored
  // rounds when they are present: no model calls.
  const agreed = new Set(a.entries.filter((e) => e.second.verdict === e.instructor).map((e) => e.id));
  // Conceded disputes flip the label: the second grader had it right.
  const conceded = new Set(a.entries.filter((e) => e.concede === true).map((e) => e.id));
  for (const label of process.argv.slice(2).length ? process.argv.slice(2) : ["r4-copied-lesson", "final-sonnet"]) {
    const path = `evals/.results/core-${label}.json`;
    if (!existsSync(path)) continue;
    const r = JSON.parse(readFileSync(path, "utf8")) as Report;
    const score = (row: Report["rows"][string], key: string) => row.feedback.find((f) => f.key === key)?.score;
    const on = (ids: (id: string) => boolean, flip: Set<string> = new Set()) => {
      const rows = Object.entries(r.rows)
        .filter(([id]) => ids(id.replace(/ #\d+$/, "")))
        .map(([id, row]) => ({ row, flipped: flip.has(id.replace(/ #\d+$/, "")) }));
      const recorded = rows.filter(({ row }) => score(row, "recorded") === 1);
      // A flipped label turns an agreement into a disagreement and a wrong filed grade into a right one.
      const agree = rows.filter(({ row, flipped }) => (score(row, "verdict_agrees") === 1) !== flipped).length;
      const wrong = recorded.filter(
        ({ row, flipped }) => (score(row, "recorded_false_accept") === 1 || score(row, "recorded_false_reject") === 1) !== flipped,
      ).length;
      return `agreement ${pct(agree, rows.length)}, wrong filed grades ${pct(wrong, recorded.length)} (${wrong} of ${recorded.length} filed, ${rows.length} runs)`;
    };
    console.log(`\n${label}:\n  all 2022 labels      — ${on(() => true)}\n  undisputed labels    — ${on((id) => agreed.has(id))}`);
    if (conceded.size) console.log(`  corrected labels     — ${on(() => true, conceded)}`);
  }
}
