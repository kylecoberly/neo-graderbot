import { Annotation, END, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import type { Retriever } from "@/lib/retrieval/retrieve";
import type { Decision, GuardResult, Judgment, Passage, PolicyCheck, Question } from "@/lib/types";
import { checkGuard, normaliseAnswer } from "./guard";
import type { JudgeFn } from "./judge";
import { evaluatePolicy } from "./policy";
import type { EvaluationStore } from "./store";
import { evaluationTools } from "./tools";

export const GradeState = Annotation.Root({
  answerId: Annotation<string>,
  question: Annotation<Question>,
  answer: Annotation<string>,
  guardResult: Annotation<GuardResult>,
  passages: Annotation<Passage[]>,
  judgment: Annotation<Judgment | null>,
  decision: Annotation<Decision>,
  checks: Annotation<PolicyCheck[]>,
});
export type GradeStateType = typeof GradeState.State;

export interface AgentOptions {
  retrieval: boolean;
  policy: boolean;
}

export interface AgentDeps {
  judge: JudgeFn;
  retrieve: Retriever;
  store: EvaluationStore;
}

// retrieval/policy switches exist for the ablation rounds; the queue runs with
// both on. The reference answer counts as retrieval, so "retrieval off" means
// the model grades from the question alone.
export function buildGraph(options: AgentOptions, deps: AgentDeps) {
  const tools = evaluationTools(deps.store);
  const reference = (s: GradeStateType) => (options.retrieval ? s.question.reference : null);
  return new StateGraph(GradeState)
    .addNode("guard", (s) => ({
      answer: normaliseAnswer(s.answer),
      guardResult: options.policy ? checkGuard(s.answer) : ({ tripped: false } as const),
    }))
    .addNode("retrieve", (s) => ({ passages: options.retrieval ? deps.retrieve(s.question) : [] }))
    .addNode("judge", async (s, config: LangGraphRunnableConfig) => ({
      judgment: await deps.judge(
        { question: s.question, answer: s.answer, passages: s.passages ?? [], reference: reference(s) },
        (feedback) => config.writer?.({ feedback }),
      ),
    }))
    .addNode("act", async (s, config: LangGraphRunnableConfig) => {
      const { decision, checks } = evaluatePolicy({
        enabled: options.policy,
        guard: s.guardResult,
        judgment: s.judgment ?? null,
        passages: s.passages ?? [],
        reference: reference(s),
        answer: s.answer,
      });
      if (decision.action === "record") {
        await tools.record.invoke({ answerId: s.answerId, verdict: decision.verdict, feedback: decision.feedback }, config);
      } else {
        await tools.defer.invoke(
          { answerId: s.answerId, reason: decision.reason, verdict: decision.verdict, feedback: decision.feedback },
          config,
        );
      }
      return { decision, checks };
    })
    .addEdge(START, "guard")
    .addConditionalEdges("guard", (s) => (s.guardResult.tripped ? "act" : "retrieve"), ["act", "retrieve"])
    .addEdge("retrieve", "judge")
    .addEdge("judge", "act")
    .addEdge("act", END)
    .compile();
}

export type GradeGraph = ReturnType<typeof buildGraph>;
