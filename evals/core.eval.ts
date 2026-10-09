import * as ls from "langsmith/vitest";
import { afterAll } from "vitest";
import { agentOptionsFromEnv, defaultGraph, defaultRetriever } from "@/lib/agent/defaults";
import { flushTraces } from "@/lib/agent/mask";
import { grade, type GradeOutcome } from "@/lib/agent/run";
import { nullStore } from "@/lib/agent/store";
import { loadQuestions } from "@/lib/data";
import { coreExamples, limitPerSlice } from "./datasets/core";
import { JUDGE_ON, LIMIT, REPETITIONS, experimentMetadata } from "./experiment";
import { gradeCore } from "./graders/deterministic";
import { criteriaFor, feedbackSections, JUDGE_INSTRUCTIONS } from "./graders/feedbackJudge";
import { judgeMaterial, runJudge, safeJudge } from "./graders/judge";
import { LocalReport } from "./localReport";

const options = agentOptionsFromEnv();
const graph = defaultGraph(nullStore, options);
const questions = new Map(loadQuestions().map((q) => [q.id, q]));

// Nothing about quality is asserted: one model run is too noisy to fail on.
// Scores go to LangSmith and the local report; rounds are compared per
// example against the noise floor.
ls.describe(
  "neo-graderbot-core",
  () => {
    const local = new LocalReport<GradeOutcome>("core", experimentMetadata());
    for (const ex of limitPerSlice(coreExamples(), LIMIT)) {
      ls.test(
        ex.id,
        { inputs: ex.inputs, referenceOutputs: ex.referenceOutputs, metadata: ex.metadata, config: { repetitions: REPETITIONS } },
        async ({ testMetadata }) => {
          const row = local.start(ex.id, testMetadata.repetition, ex.metadata);
          local.context(row, ex.inputs, ex.referenceOutputs, {});
          const question = questions.get(ex.inputs.questionId)!;
          const outcome = await grade(graph, { answerId: ex.id, question, answer: ex.inputs.answer });
          ls.logOutputs({
            decision: outcome.decision,
            judgment: outcome.judgment,
            checks: outcome.checks,
            passages: outcome.passages.map((p) => `${p.lesson} — ${p.heading}`),
          });
          local.output(row, outcome);
          for (const f of gradeCore({ outcome, reference: ex.referenceOutputs, question, answer: ex.inputs.answer, retrievalEnabled: options.retrieval })) {
            ls.logFeedback(f);
            local.record(row, f);
          }
          const j = outcome.judgment;
          if (JUDGE_ON && j && (j.verdict === "reject" || ex.referenceOutputs.verdict === "reject")) {
            const criteria = criteriaFor(j.verdict);
            const sections = feedbackSections(question, ex.inputs.answer, j.feedback, defaultRetriever());
            local.context(row, ex.inputs, ex.referenceOutputs, judgeMaterial(criteria, sections));
            const judge = ls.wrapEvaluator(async (input: { sections: typeof sections }) =>
              runJudge(criteria, JUDGE_INSTRUCTIONS, input.sections),
            );
            for (const f of await safeJudge(() => judge({ sections }))) {
              if (f.key === "judge_error") ls.logFeedback(f);
              local.record(row, f);
            }
          }
        },
      );
    }
    afterAll(async () => {
      local.flush();
      await flushTraces();
    });
  },
  { metadata: experimentMetadata() },
);
