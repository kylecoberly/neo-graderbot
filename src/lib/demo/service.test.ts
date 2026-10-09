import { afterEach, describe, expect, it } from "vitest";
import { grade } from "@/lib/agent/run";
import { keyPointPassages } from "./resolve";
import { demoGraph, withTimeout } from "./service";

describe("withTimeout", () => {
  it("rejects a call that outlives the limit", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow("timeout");
  });
  it("passes a prompt result through", async () => {
    await expect(withTimeout(Promise.resolve(3), 10)).resolves.toBe(3);
  });
});

describe("demoGraph in fake mode", () => {
  afterEach(() => {
    delete process.env.GRADERBOT_FAKE_MODEL;
  });

  it("grades a custom item end to end without a model", async () => {
    process.env.GRADERBOT_FAKE_MODEL = "1";
    const out = await grade(demoGraph(keyPointPassages(["lists files"])), {
      answerId: "0",
      question: { id: "custom", slice: "custom", prompt: "What does ls do?", reference: "It lists files." },
      answer: "it lists the files in a folder",
    });
    expect(out.decision).toMatchObject({ action: "record", verdict: "accept" });
  });
});
