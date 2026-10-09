import { defaultGraph } from "@/lib/agent/defaults";
import type { GradeGraph } from "@/lib/agent/graph";
import { queueEvaluations } from "./store";

const g = globalThis as { __graderbotGraph?: GradeGraph };

// The queue always runs the whole agent, whatever the eval switches say.
export function queueGraph(): GradeGraph {
  g.__graderbotGraph ??= defaultGraph(queueEvaluations(), { retrieval: true, policy: true });
  return g.__graderbotGraph;
}
