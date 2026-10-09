import { loadCorpus } from "@/lib/data";
import { makeRetriever, type Retriever } from "@/lib/retrieval/retrieve";
import { buildGraph, type AgentOptions, type GradeGraph } from "./graph";
import { makeJudge } from "./judge";
import type { EvaluationStore } from "./store";

export function agentOptionsFromEnv(env: Record<string, string | undefined> = process.env): AgentOptions {
  return { retrieval: env.AGENT_RETRIEVAL !== "off", policy: env.AGENT_POLICY !== "off" };
}

let retriever: Retriever | null = null;

export function defaultRetriever(): Retriever {
  retriever ??= makeRetriever(loadCorpus());
  return retriever;
}

export function defaultGraph(store: EvaluationStore, options: AgentOptions = agentOptionsFromEnv()): GradeGraph {
  return buildGraph(options, { judge: makeJudge(), retrieve: defaultRetriever(), store });
}
