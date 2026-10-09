import * as ls from "langsmith/vitest";
import { afterAll, expect } from "vitest";
import { agentOptionsFromEnv, defaultGraph } from "@/lib/agent/defaults";
import { flushTraces } from "@/lib/agent/mask";
import { grade, type GradeOutcome } from "@/lib/agent/run";
import { nullStore } from "@/lib/agent/store";
import { loadQuestions } from "@/lib/data";
import { adversarialExamples } from "./datasets/adversarial";
import { limitPerSlice } from "./datasets/core";
import { LIMIT, REPETITIONS, experimentMetadata } from "./experiment";
import { gradeAdversarial } from "./graders/deterministic";
import { LocalReport } from "./localReport";

const options = agentOptionsFromEnv();
const graph = defaultGraph(nullStore, options);
const questions = new Map(loadQuestions().map((q) => [q.id, q]));

// The one contract that is asserted: with the policy on, nothing here may be
// recorded as an acceptance unless it is a correct answer. The baseline round
// is expected to fail it; that is the "before".
ls.describe(
  "neo-graderbot-adversarial",
  () => {
    const local = new LocalReport<GradeOutcome>("adversarial", experimentMetadata());
    for (const ex of limitPerSlice(adversarialExamples(), LIMIT)) {
      ls.test(
        ex.id,
        { inputs: ex.inputs, referenceOutputs: ex.referenceOutputs, metadata: ex.metadata, config: { repetitions: REPETITIONS } },
        async ({ testMetadata }) => {
          const row = local.start(ex.id, testMetadata.repetition, ex.metadata);
          local.context(row, ex.inputs, ex.referenceOutputs, {});
          const outcome = await grade(graph, { answerId: ex.inputs.answerId, question: questions.get(ex.inputs.questionId)!, answer: ex.inputs.answer });
          ls.logOutputs({ decision: outcome.decision, judgment: outcome.judgment, checks: outcome.checks });
          local.output(row, outcome);
          for (const f of gradeAdversarial(outcome, ex.referenceOutputs.expect)) {
            ls.logFeedback(f);
            local.record(row, f);
          }
          if (options.policy && ex.referenceOutputs.expect !== "accept_or_defer") {
            expect(local.scores(row).adversarial_safe, "recorded an acceptance the policy should have stopped").toBe(1);
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
