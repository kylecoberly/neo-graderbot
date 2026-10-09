import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { TOPICS } from "@/lib/topics";
import { SLICES } from "@/lib/types";
import {
  assertNoLearnerHandles,
  buildAnswers,
  buildQuestions,
  findHardPairs,
  handlesOf,
  pseudonyms,
  redact,
  split,
  toEvaluations,
  toPerformances,
} from "./lib/archive";
import { readLesson } from "./lib/corpus";
import { gradingHours, resubmitChains } from "./lib/hours";
import { parseCopyBlocks, records } from "./lib/pgcopy";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { GRADERBOT_DUMP: dump, GRADERBOT_POSTS_REPO: posts, GRADERBOT_CLIENT: client, GRADERBOT_SALT: salt } = process.env;
if (!dump || !posts || !client || !salt) {
  console.error("Set GRADERBOT_DUMP, GRADERBOT_POSTS_REPO, GRADERBOT_CLIENT and GRADERBOT_SALT in .env.local.");
  process.exit(1);
}

const tables = parseCopyBlocks(readFileSync(dump, "utf8"));
const perfTable = tables.get("performance");
const evalTable = tables.get("evaluation");
if (!perfTable || !evalTable) throw new Error("The dump has no performance/evaluation COPY blocks.");

const { performances, unparsable } = toPerformances(records(perfTable));
const evaluations = toEvaluations(records(evalTable));
const names = pseudonyms(performances.map((p) => p.userId), salt);
const handles = handlesOf(names.keys());
const questions = buildQuestions(performances, client, handles);
const answers = buildAnswers(performances, evaluations, names, client);
const splits = split(answers, findHardPairs(answers));
const corpus = Object.fromEntries(
  SLICES.flatMap((s) => TOPICS[s].lessons).map((slug) => [slug, redact(readLesson(posts, slug), client, handles)]),
);

// Aggregates only: no evaluator id, learner or answer leaves the script.
const typeOf = new Map(performances.map((p) => [p.id, p.type]));
const hours = {
  ...gradingHours(evaluations.map((e) => ({ ...e, isShortAnswer: typeOf.get(e.performanceId) === "question" }))),
  resubmitChains: resubmitChains(performances.filter((p) => p.type === "question"), evaluations),
};

const files: Record<string, string> = {
  "data/questions.json": JSON.stringify(questions, null, 2) + "\n",
  "data/answers.json": JSON.stringify(answers, null, 2) + "\n",
  "data/splits.json": JSON.stringify(splits, null, 2) + "\n",
  "data/grading-hours.json": JSON.stringify(hours, null, 2) + "\n",
  ...Object.fromEntries(Object.entries(corpus).map(([slug, md]) => [`data/corpus/${slug}.md`, md])),
};
assertNoLearnerHandles(Object.values(files).join("\n"), [...names.keys()]);

rmSync("data/corpus", { recursive: true, force: true });
mkdirSync("data/corpus", { recursive: true });
for (const [path, body] of Object.entries(files)) writeFileSync(path, body);

const core = new Set(splits.core);
const held = new Set(splits.heldout);
console.table(
  SLICES.map((slice) => {
    const inSlice = answers.filter((a) => a.slice === slice);
    const ids = new Set(inSlice.map((a) => a.id));
    return {
      slice,
      questions: questions.filter((q) => q.slice === slice).length,
      with_reference: questions.filter((q) => q.slice === slice && q.reference).length,
      answers: inSlice.length,
      reject_rate: +(inSlice.filter((a) => a.verdict === "reject").length / inSlice.length).toFixed(2),
      core: inSlice.filter((a) => core.has(a.id)).length,
      heldout: inSlice.filter((a) => held.has(a.id)).length,
      hard_pairs: splits.hardPairs.filter(([r]) => ids.has(r)).length,
    };
  }),
);
console.log(
  `Grading: ${hours.shortAnswers} short answers; ${(hours.totalMinutes / 60).toFixed(1)} h over ${hours.sessions} sittings on ${hours.days} days; ${(hours.shortAnswerMinutes / 60).toFixed(1)} h on short answers; ${hours.notes} notes.`,
);
console.log(`${unparsable} performance payloads were unparsable and skipped. Learners: ${names.size}.`);
