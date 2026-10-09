import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { parsePartialJson } from "@langchain/core/output_parsers";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatAnthropic } from "@langchain/anthropic";
import type { z } from "zod";

// The only place a model is constructed. A model is a "provider:id" string so
// the agent, the comparison candidate and the judges are a one-string swap,
// and LangChain traces each call with its token usage, which LangSmith prices.
export const AGENT_MODEL = process.env.AGENT_MODEL ?? "anthropic:claude-haiku-4-5";

export type ChatModel = ChatAnthropic;

// Built directly rather than through initChatModel, whose runtime import of
// the provider package Vercel's file tracer cannot follow under pnpm: every
// live call failed in production. No temperature: Sonnet 5 rejects sampling
// parameters, and the comparison wants each model under its own defaults.
export async function chatModel(spec: string, opts: { maxTokens: number; apiKey?: string }): Promise<ChatModel> {
  const [provider, id] = spec.split(":", 2);
  if (!id) throw new Error(`Model spec must be provider:id (got "${spec}")`);
  if (provider !== "anthropic") throw new Error(`Only the anthropic provider is wired up (got "${spec}")`);
  return new ChatAnthropic({ model: id, maxTokens: opts.maxTokens, apiKey: opts.apiKey });
}

type JsonSchema = Record<string, unknown>;

// What Anthropic's structured-output grammar can enforce: types, required
// keys, enums, consts, unions, and closed objects. Numeric bounds and array
// caps are dropped; they stay in the zod schema for the caller's parse. This
// exists because LangChain's withStructuredOutput runs the SDK's transform,
// which demotes `enum` into the description, and a cheaper model will then
// write a value the enum doesn't allow; and because strict tool calling
// rejects the integer bounds zod 4 emits.
export function structuredOutputSchema(schema: z.ZodType): JsonSchema {
  return strict(toJsonSchema(schema) as JsonSchema);
}

function strict(s: JsonSchema): JsonSchema {
  if (typeof s.$ref === "string") return { $ref: s.$ref };
  const out: JsonSchema = {};
  if (s.$defs && typeof s.$defs === "object") {
    out.$defs = Object.fromEntries(Object.entries(s.$defs as Record<string, JsonSchema>).map(([k, v]) => [k, strict(v)]));
  }
  const union = (s.anyOf ?? s.oneOf) as JsonSchema[] | undefined;
  if (Array.isArray(union)) out.anyOf = union.map(strict);
  else out.type = s.type;
  if (s.enum) out.enum = s.enum;
  if (s.const !== undefined) out.const = s.const;
  if (typeof s.description === "string") out.description = s.description;
  if (s.type === "object" || s.properties) {
    const properties = (s.properties ?? {}) as Record<string, JsonSchema>;
    out.properties = Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, strict(v)]));
    out.required = s.required ?? Object.keys(properties);
    out.additionalProperties = false;
  }
  if (s.type === "array" && s.items && typeof s.items === "object") out.items = strict(s.items as JsonSchema);
  return out;
}

// Thinking blocks are skipped: only text blocks carry the JSON.
function textOf(message: AIMessage | AIMessageChunk): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof (block as { text?: unknown }).text === "string")
    .map((block) => block.text)
    .join("");
}

const withSchema = (model: ChatModel, schema: z.ZodType) =>
  model.withConfig({ outputConfig: { format: { type: "json_schema", schema: structuredOutputSchema(schema) } } });

function parseReply(text: string, stop: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    if (stop && stop !== "end_turn") throw new Error(`Model stopped with reason "${String(stop)}" before finishing the JSON: ${text.slice(0, 200)}`);
    throw new Error(`Model reply was not JSON: ${text.slice(0, 200)}`);
  }
}

// One call, the schema enforced server-side, the JSON handed back as-is:
// callers validate with the zod schema they passed, as strictly as they mean
// to. Masking of traced inputs is done once, for every call, in
// src/lib/agent/mask.ts.
export async function invokeStructured(
  model: ChatModel,
  schema: z.ZodType,
  messages: BaseLanguageModelInput,
  options: { signal?: AbortSignal } = {},
): Promise<unknown> {
  const reply = await withSchema(model, schema).invoke(messages, options);
  return parseReply(textOf(reply), reply.response_metadata?.stop_reason);
}

// invokeStructured, streamed: onPartial receives the JSON parsed so far on
// every text chunk. This is how the queue shows feedback as it is written.
export async function streamStructured(
  model: ChatModel,
  schema: z.ZodType,
  messages: BaseLanguageModelInput,
  onPartial: (partial: Record<string, unknown>) => void,
  options: { signal?: AbortSignal; runName?: string } = {},
): Promise<unknown> {
  let text = "";
  let stop: unknown;
  for await (const chunk of await withSchema(model, schema).stream(messages, options)) {
    stop = chunk.response_metadata?.stop_reason ?? stop;
    const piece = textOf(chunk);
    if (!piece) continue;
    text += piece;
    const partial = parsePartialJson(text);
    if (partial && typeof partial === "object") onPartial(partial as Record<string, unknown>);
  }
  return parseReply(text, stop);
}
