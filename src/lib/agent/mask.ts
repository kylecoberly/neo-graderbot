import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { Client } from "langsmith";

export const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
export const PHONE = /(?<![\d.])(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g;

export function maskPii(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

// Traced inputs hold LangChain message objects as well as plain data; every
// string inside either is masked, and what LangSmith receives is a plain copy.
export function maskDeep<T>(value: T): T {
  if (typeof value === "string") return maskPii(value) as T;
  if (Array.isArray(value)) return value.map(maskDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v)])) as T;
  }
  return value;
}

// A learner can type contact details into an answer. The guard keeps such an
// answer from being graded; this keeps it out of the trace. An explicit tracer
// also stops LangChain adding the environment's unmasked one.
let client: Client | null = null;

export function tracingCallbacks(env: Record<string, string | undefined> = process.env): LangChainTracer[] {
  if (env.LANGSMITH_TRACING !== "true" && env.LANGCHAIN_TRACING_V2 !== "true") return [];
  client ??= new Client({ hideInputs: (inputs) => maskDeep(inputs), hideOutputs: (outputs) => maskDeep(outputs) });
  return [new LangChainTracer({ client })];
}

// Nothing else flushes this client: short-lived processes (scripts, eval runs)
// must await it before exiting or their last traces are lost.
export async function flushTraces(): Promise<void> {
  await client?.awaitPendingTraceBatches();
}
