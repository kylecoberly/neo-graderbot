import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "langsmith";
import { defaultRetriever } from "@/lib/agent/defaults";
import type { GradeOutcome } from "@/lib/agent/run";
import { loadQuestions } from "@/lib/data";
import { criteriaFor, feedbackSections, JUDGE_INSTRUCTIONS } from "../evals/graders/feedbackJudge";
import { runJudge } from "../evals/graders/judge";
import type { Report, ReportRow } from "../evals/stats";

// The judge is trusted only as far as it agrees with the instructor. The
// labels are made blind: the judge's scores live in a separate file.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

type Label = "hint" | "reveals" | "wrong";
interface Entry { n: number; row: string; slice: string; questionId: string; answer: string; feedback: string; label: Label | null }
type JudgeScores = { hints: number; accurate: number };
type Row = ReportRow & { output?: GradeOutcome; inputs?: { answer: string; questionId: string } };

const LABELS = "evals/calibration/feedback-labels.json";
const READABLE = "evals/calibration/feedback-labels.md";
const JUDGED = "evals/calibration/feedback-judge.json";
const SIZE = 30;
const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith("--")) ?? "r3-policy";
const questions = new Map(loadQuestions().map((q) => [q.id, q]));
const score = (r: { feedback: { key: string; score: number }[] }, key: string) => r.feedback.find((f) => f.key === key)?.score ?? -1;

const existing = existsSync(LABELS) ? (JSON.parse(readFileSync(LABELS, "utf8")) as { entries: Entry[] }) : null;
const labeled = existing?.entries.filter((e) => e.label) ?? [];

if (!labeled.length) writeTemplate();
else if (args.includes("--upload")) await upload();
else await report(args.includes("--rejudge"));

function writeTemplate() {
  const path = `evals/.results/core-${label}.json`;
  if (!existsSync(path)) {
    console.error(`No ${path}; run that round first.`);
    process.exit(1);
  }
  const run = JSON.parse(readFileSync(path, "utf8")) as Report & { rows: Record<string, Row> };
  const candidates = Object.entries(run.rows).filter(
    ([id, r]) => !id.includes(" #") && r.output?.judgment?.verdict === "reject" && score(r, "judge_hints_not_reveals") !== -1,
  );
  const bySlice = new Map<string, [string, Row][]>();
  for (const c of candidates) bySlice.set(String(c[1].meta?.slice), [...(bySlice.get(String(c[1].meta?.slice)) ?? []), c]);
  const picked: [string, Row][] = [];
  for (let i = 0; picked.length < SIZE && [...bySlice.values()].some((l) => i < l.length); i++) {
    for (const l of bySlice.values()) if (i < l.length && picked.length < SIZE) picked.push(l[i]);
  }
  const entries: Entry[] = picked.map(([row, r], i) => ({
    n: i + 1,
    row,
    slice: String(r.meta?.slice),
    questionId: r.inputs!.questionId,
    answer: r.inputs!.answer,
    feedback: r.output!.judgment!.feedback,
    label: null,
  }));
  const judged: Record<number, JudgeScores> = Object.fromEntries(
    picked.map(([, r], i) => [i + 1, { hints: score(r, "judge_hints_not_reveals"), accurate: score(r, "judge_accurate") }]),
  );
  mkdirSync("evals/calibration", { recursive: true });
  writeFileSync(
    LABELS,
    JSON.stringify(
      {
        run: run.meta,
        instructions:
          'Set each "label" to "hint" (points at the gap without giving the answer), "reveals" (a learner could copy the answer out of it) or "wrong" (says something false about the answer). Read the cases in feedback-labels.md.',
        entries,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(JUDGED, JSON.stringify({ run: run.meta, judged }, null, 2) + "\n");
  const cases = entries.map((e) => {
    const q = questions.get(e.questionId)!;
    return `## ${e.n}. ${e.slice} · ${e.row}\n\n**Question:** ${q.prompt.replace(/\*\*/g, "")}\n\n**Reference:** ${q.reference ?? "(none)"}\n\n**Learner answer:**\n\n\`\`\`\n${e.answer}\n\`\`\`\n\n**Agent's note:** ${e.feedback}\n`;
  });
  writeFileSync(READABLE, `# Label each note\n\nPut labels in feedback-labels.json. The judge's scores are in feedback-judge.json; don't open it until you're done.\n\n${cases.join("\n")}`);
  console.log(`Wrote ${entries.length} cases from run ${run.meta.label ?? label} to ${READABLE}.`);
}

function human(l: Label): { hints: number | null; accurate: number } {
  return { hints: l === "wrong" ? null : l === "hint" ? 1 : 0, accurate: l === "wrong" ? 0 : 1 };
}

async function report(rejudge: boolean) {
  const stored = (JSON.parse(readFileSync(JUDGED, "utf8")) as { judged: Record<number, JudgeScores> }).judged;
  const judged: (Entry & { judge: JudgeScores })[] = rejudge
    ? await Promise.all(
        labeled.map(async (e) => {
          const sections = feedbackSections(questions.get(e.questionId)!, e.answer, e.feedback, defaultRetriever());
          const fs = await runJudge(criteriaFor("reject"), JUDGE_INSTRUCTIONS, sections);
          return { ...e, judge: { hints: score({ feedback: fs }, "judge_hints_not_reveals"), accurate: score({ feedback: fs }, "judge_accurate") } };
        }),
      )
    : labeled.map((e) => ({ ...e, judge: stored[e.n] }));

  const table: Record<string, object> = {};
  for (const key of ["hints", "accurate"] as const) {
    const pairs = judged.map((e) => [e.judge[key], human(e.label!)[key]] as const).filter(([, h]) => h !== null);
    const agree = pairs.filter(([j, h]) => j === h).length;
    table[key === "hints" ? "judge_hints_not_reveals" : "judge_accurate"] = {
      labeled: pairs.length,
      agreement: +(agree / pairs.length).toFixed(2),
      false_fails: pairs.filter(([j, h]) => j === 0 && h === 1).length,
      missed_fails: pairs.filter(([j, h]) => j === 1 && h === 0).length,
      verdict: agree / pairs.length >= 0.8 ? "trust it" : "rewrite the rubric",
    };
  }
  console.log(`${judged.length} labeled cases${rejudge ? ", re-judged with the current rubric" : ""}.`);
  console.table(table);
  for (const e of judged) {
    const h = human(e.label!);
    if ((h.hints !== null && h.hints !== e.judge.hints) || h.accurate !== e.judge.accurate) {
      console.log(`- #${e.n} ${e.row}: you "${e.label}", judge hints=${e.judge.hints} accurate=${e.judge.accurate}\n    ${e.feedback}`);
    }
  }
}

async function upload() {
  const client = new Client();
  const name = "neo-graderbot-judge-calibration";
  if (await client.hasDataset({ datasetName: name })) {
    console.error(`${name} already exists in LangSmith; delete it there to upload a new batch.`);
    process.exit(1);
  }
  const dataset = await client.createDataset(name, {
    description: "The instructor's labels on agent feedback (hint / reveals / wrong), used to calibrate the LLM judge.",
  });
  for (const e of labeled) {
    const q = questions.get(e.questionId)!;
    await client.createExample({
      dataset_id: dataset.id,
      inputs: { question: q.prompt, reference: q.reference, answer: e.answer, feedback: e.feedback },
      outputs: { label: e.label },
      metadata: { slice: e.slice, row: e.row },
    });
  }
  console.log(`Uploaded ${labeled.length} labeled cases to ${name}.`);
}
