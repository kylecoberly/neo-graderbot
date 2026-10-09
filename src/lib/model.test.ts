import { ChatAnthropic } from "@langchain/anthropic";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { chatModel, structuredOutputSchema } from "./model";

describe("chatModel", () => {
  // Built directly, not through initChatModel's runtime import, which
  // Vercel's file tracer cannot follow under pnpm's layout.
  it("builds an Anthropic model without a runtime import", async () => {
    const model = await chatModel("anthropic:claude-haiku-4-5", { maxTokens: 100, apiKey: "test-key" });
    expect(model).toBeInstanceOf(ChatAnthropic);
    expect((model as unknown as ChatAnthropic).model).toBe("claude-haiku-4-5");
    expect((model as unknown as ChatAnthropic).maxTokens).toBe(100);
  });

  it("rejects a spec without a provider", async () => {
    await expect(chatModel("claude-haiku-4-5", { maxTokens: 10 })).rejects.toThrow(/provider:id/);
  });
});

describe("structuredOutputSchema", () => {
  it("keeps enums in the grammar and closes objects", () => {
    const schema = structuredOutputSchema(z.object({ verdict: z.enum(["accept", "reject"]) }));
    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["verdict"],
      properties: { verdict: { enum: ["accept", "reject"] } },
    });
  });
});
