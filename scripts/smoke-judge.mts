import { existsSync } from "node:fs";
import { makeJudge } from "@/lib/agent/judge";
import { loadAnswers, loadCorpus, loadQuestions } from "@/lib/data";
import { makeRetriever } from "@/lib/retrieval/retrieve";

// Proves the two things the plan depends on before anything is built on them:
// structured output under each model's default thinking, and feedback that
// actually streams.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const questions = new Map(loadQuestions().map((q) => [q.id, q]));
const retrieve = makeRetriever(loadCorpus());
const answers = loadAnswers();
const samples = [
  answers.find((a) => a.slice === "arrays" && a.verdict === "reject")!,
  answers.find((a) => a.slice === "arrays" && a.verdict === "accept")!,
];

let failed = false;
for (const spec of ["anthropic:claude-haiku-4-5", "anthropic:claude-sonnet-5"]) {
  const judge = makeJudge(spec);
  for (const a of samples) {
    const q = questions.get(a.questionId)!;
    let updates = 0;
    const started = Date.now();
    try {
      const j = await judge({ question: q, answer: a.answer, passages: retrieve(q), reference: q.reference }, () => {
        updates += 1;
      });
      console.log(`${spec} ${a.id}: ${j.verdict}/${j.certainty} (instructor ${a.verdict}), ${updates} feedback updates, ${Date.now() - started}ms`);
      console.log(`  basis: ${j.basis.slice(0, 120)}\n  feedback: ${j.feedback}`);
      if (updates < 2) {
        console.error("  feedback did not stream");
        failed = true;
      }
    } catch (err) {
      console.error(`${spec} ${a.id}: ${(err as Error).message}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
