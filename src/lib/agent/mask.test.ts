import { describe, expect, it } from "vitest";
import { maskDeep, maskPii, tracingCallbacks } from "./mask";

describe("maskPii", () => {
  it("replaces email addresses and phone numbers", () => {
    expect(maskPii("mail a.b@x.com or call (303) 555-0142")).toBe("mail [email] or call [phone]");
  });
  it("leaves ordinary answers alone", () => {
    expect(maskPii("mv moves or renames a file")).toBe("mv moves or renames a file");
  });
});

describe("maskDeep", () => {
  it("masks every string inside traced inputs and outputs", () => {
    const traced = { answer: "a@b.co", messages: [{ role: "user", content: "text 303-555-0142" }], score: 2 };
    expect(maskDeep(traced)).toEqual({ answer: "[email]", messages: [{ role: "user", content: "text [phone]" }], score: 2 });
  });
});

describe("tracingCallbacks", () => {
  it("adds nothing when tracing is off", () => expect(tracingCallbacks({})).toEqual([]));
  it("adds one masking tracer when tracing is on", () => {
    expect(tracingCallbacks({ LANGSMITH_TRACING: "true", LANGSMITH_API_KEY: "x" })).toHaveLength(1);
  });
});
