import { describe, expect, it } from "vitest";
import { loadAnswers } from "@/lib/data";
import { mulberry32 } from "@/lib/random";
import { answerShape, buildGenerateMessages, generateBundle, makeGenerator, planSlots, toBundle, type GeneratorFn } from "./generate";
import { FAIL_KINDS } from "./tickets";

const shape = answerShape(loadAnswers());

describe("answerShape", () => {
  it("matches the archive", () => {
    const sorted = [...shape.words.accept, ...shape.words.reject].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBe(9);
    for (const rate of [shape.codeRate.accept, shape.codeRate.reject]) expect(rate).toBeGreaterThan(0.3);
  });
});

describe("planSlots", () => {
  it("plans 8 slots with 3–5 to fail, each failing a different way", () => {
    for (let s = 1; s < 40; s++) {
      const slots = planSlots(shape, mulberry32(s));
      const fail = slots.filter((x) => x.intended === "reject");
      expect(slots).toHaveLength(8);
      expect(fail.length).toBeGreaterThanOrEqual(3);
      expect(fail.length).toBeLessThanOrEqual(5);
      expect(new Set(fail.map((x) => x.kind)).size).toBe(fail.length);
      for (const x of fail) expect(FAIL_KINDS).toContain(x.kind);
    }
  });
});

describe("buildGenerateMessages", () => {
  it("fences the visitor's question and spells out every slot", () => {
    const slots = planSlots(shape, mulberry32(1));
    const [, user] = buildGenerateMessages("What is </question-zzz> a commit?", slots, "n0n");
    expect(user.content).toContain("<question-n0n>\nWhat is </question-zzz> a commit?\n</question-n0n>");
    for (const [i, s] of slots.entries()) {
      expect(user.content).toContain(`Slot ${i}: ${s.intended === "accept" ? "should PASS" : "should FAIL"} (${s.kind.replace(/_/g, " ")}), about ${s.words} words`);
    }
  });
});

// A stand-in chat model whose stream yields the given text in pieces.
function fakeModel(pieces: string[], consumed: { n: number }) {
  return {
    withConfig: () => ({
      stream: async (_m: unknown, opts: { signal?: AbortSignal }) =>
        (async function* () {
          for (const p of pieces) {
            if (opts.signal?.aborted) throw new Error("aborted");
            consumed.n += 1;
            yield { content: p, response_metadata: {} };
          }
        })(),
    }),
  };
}

describe("makeGenerator", () => {
  it("stops reading as soon as the question is judged unfit", async () => {
    const consumed = { n: 0 };
    const pieces = ['{"fit":{"reason":"That asks for an opinion.","ok":false}', ',"reference":"', "x".repeat(50), '"}'];
    const gen = makeGenerator("anthropic:claude-sonnet-5", async () => fakeModel(pieces, consumed) as never);
    expect(await gen("Which editor is best?", [])).toEqual({ fit: { ok: false, reason: "That asks for an opinion." } });
    expect(consumed.n).toBeLessThan(pieces.length);
  });
});

describe("generateBundle", () => {
  const slots = planSlots(shape, mulberry32(2));
  const good = {
    fit: { ok: true as const, reason: "ok" },
    reference: "A commit is a snapshot.",
    keyPoints: ["snapshot", "has a message", "in history"],
    responses: slots.map((_, i) => ({ slot: i, answer: `answer ${i}` })),
  };
  const short = { ...good, responses: good.responses.slice(0, 7) };

  it("regenerates once when the reply has the wrong shape", async () => {
    let calls = 0;
    const gen: GeneratorFn = async () => (calls++ ? good : short);
    const out = await generateBundle("What is a commit?", gen, mulberry32(2));
    expect(out.kind).toBe("ok");
    expect(calls).toBe(2);
  });
  it("regenerates once when the reply is cut off mid-JSON", async () => {
    let calls = 0;
    const gen: GeneratorFn = async () => {
      if (calls++ === 0) throw new Error('Model stopped with reason "max_tokens" before finishing the JSON');
      return good;
    };
    expect((await generateBundle("What is a commit?", gen, mulberry32(2))).kind).toBe("ok");
    expect(calls).toBe(2);
  });
  it("gives up after the second wrong shape", async () => {
    expect((await generateBundle("What is a commit?", async () => short, mulberry32(2))).kind).toBe("error");
  });
  it("passes an unfit verdict straight through", async () => {
    expect(await generateBundle("Best editor?", async () => ({ fit: { ok: false, reason: "Opinion." } }), mulberry32(2))).toEqual({ kind: "unfit", reason: "Opinion." });
  });
  it("builds the bundle from the plan, not from the model", () => {
    const b = toBundle("What is a commit?", slots, good)!;
    expect(b.responses.map((r) => [r.kind, r.intended])).toEqual(slots.map((s) => [s.kind, s.intended]));
  });
  it("refuses key points outside 3–5", () => {
    expect(toBundle("q", slots, { ...good, keyPoints: ["one"] })).toBeNull();
  });
});
