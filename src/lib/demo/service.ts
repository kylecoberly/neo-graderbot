import { defaultRetriever } from "@/lib/agent/defaults";
import { buildGraph, type GradeGraph } from "@/lib/agent/graph";
import { makeJudge, type JudgeFn } from "@/lib/agent/judge";
import { nullStore } from "@/lib/agent/store";
import type { Passage } from "@/lib/types";
import { fakeAgentJudge, fakeMode } from "./fake";

export const GRADE_TIMEOUT_MS = 25_000;

// The model the evals say to ship (docs/results.md); the ablation rounds
// keep Haiku as AGENT_MODEL's default so they stay comparable.
export const DEMO_AGENT_MODEL = process.env.DEMO_AGENT_MODEL ?? "anthropic:claude-sonnet-5";

const g = globalThis as { __demoJudge?: JudgeFn; __demoGraph?: GradeGraph };
const judge = () => (fakeMode() ? fakeAgentJudge : (g.__demoJudge ??= makeJudge(DEMO_AGENT_MODEL)));
const OPTIONS = { retrieval: true, policy: true };

// The demo writes no grades anywhere: the visitor's page is the only record.
export function demoGraph(passages: Passage[] | null): GradeGraph {
  if (passages) return buildGraph(OPTIONS, { judge: judge(), retrieve: () => passages, store: nullStore });
  if (fakeMode()) return buildGraph(OPTIONS, { judge: fakeAgentJudge, retrieve: defaultRetriever(), store: nullStore });
  g.__demoGraph ??= buildGraph(OPTIONS, { judge: judge(), retrieve: defaultRetriever(), store: nullStore });
  return g.__demoGraph;
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}
