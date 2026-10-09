import { describe, expect, it } from "vitest";
import { itemKeys, readTicket, type Bundle } from "./tickets";
import { TOKEN_TTL_MS, demoSecret, sign, verify } from "./token";

const S = "s".repeat(32);

describe("sign/verify", () => {
  it("round-trips a payload", () => {
    expect(verify(sign({ kind: "page", ids: ["a"] }, S, 1000), S, 2000)).toMatchObject({ kind: "page", ids: ["a"] });
  });
  it("rejects a tampered payload", () => {
    const [body, mac] = sign({ ids: ["a"] }, S).split(".");
    const forged = Buffer.from(JSON.stringify({ ids: ["b"], iat: Date.now() })).toString("base64url");
    expect(verify(`${forged}.${mac}`, S)).toBeNull();
    expect(verify(`${body}.${mac}x`, S)).toBeNull();
  });
  it("rejects another secret", () => {
    expect(verify(sign({ a: 1 }, S), "t".repeat(32))).toBeNull();
  });
  it("expires after two hours", () => {
    const t = sign({ a: 1 }, S, 0);
    expect(verify(t, S, TOKEN_TTL_MS - 1)).not.toBeNull();
    expect(verify(t, S, TOKEN_TTL_MS + 1)).toBeNull();
  });
  it("rejects garbage without throwing", () => {
    for (const t of ["", "x", "a.b.c", "%%%.%%%"]) expect(verify(t, S)).toBeNull();
  });
});

describe("demoSecret", () => {
  it("uses the configured secret", () => {
    expect(demoSecret({ GRADERBOT_PAGE_SECRET: S })).toBe(S);
  });
  it("refuses to run in production without one", () => {
    expect(() => demoSecret({ NODE_ENV: "production" })).toThrow(/GRADERBOT_PAGE_SECRET/);
  });
  it("makes up a stable one for development", () => {
    expect(demoSecret({})).toBe(demoSecret({}));
  });
});

describe("tickets", () => {
  const bundle: Bundle = {
    question: "q",
    reference: "r",
    keyPoints: ["k"],
    responses: Array.from({ length: 8 }, () => ({ kind: "terse_correct" as const, intended: "accept" as const, answer: "a" })),
  };
  it("keys a custom ticket's responses by position", () => {
    expect(itemKeys({ kind: "custom", bundle })).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
  });
  it("reads a page ticket and refuses a run receipt", () => {
    expect(readTicket(sign({ kind: "page", questionId: "q", answerIds: ["a-1"] }, demoSecret()))).toMatchObject({ kind: "page" });
    expect(readTicket(sign({ kind: "run", runId: "r", key: "a-1" }, demoSecret()))).toBeNull();
    expect(readTicket(42)).toBeNull();
  });
});
