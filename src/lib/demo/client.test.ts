import { afterEach, describe, expect, it, vi } from "vitest";
import { gradeItem, readStream, runJudge } from "./client";

const streamOf = (...chunks: string[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    }),
  );

describe("readStream", () => {
  it("reassembles events split across chunks", async () => {
    const seen: { event: string; data: unknown }[] = [];
    await readStream(streamOf('event: feedback\ndata: {"te', 'xt":"Hi"}\n\nevent: done\ndata: {}\n\n'), (e) => void seen.push(e));
    expect(seen).toEqual([
      { event: "feedback", data: { text: "Hi" } },
      { event: "done", data: {} },
    ]);
  });
});

describe("gradeItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports an expired page", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
    expect(await gradeItem("t", "a-1", () => {})).toEqual({ status: "error", message: "expired" });
  });

  it("passes drafts along and settles on the result", async () => {
    const result = { key: "a-1", live: true, latencyMs: 5, decision: { action: "record", verdict: "accept", feedback: "Hi" }, certainty: "high", basis: null, receipt: null };
    vi.stubGlobal("fetch", async () => streamOf(`event: feedback\ndata: {"text":"Hi"}\n\nevent: done\ndata: ${JSON.stringify({ result })}\n\n`));
    const drafts: string[] = [];
    expect(await gradeItem("t", "a-1", (d) => drafts.push(d))).toEqual({ status: "done", result });
    expect(drafts).toEqual(["Hi"]);
  });

  it("settles on the server's error", async () => {
    vi.stubGlobal("fetch", async () => streamOf('event: error\ndata: {"message":"Live grading is unavailable right now."}\n\n'));
    expect(await gradeItem("t", "0", () => {})).toEqual({ status: "error", message: "Live grading is unavailable right now." });
  });

  it("settles as an error when the network fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await gradeItem("t", "a-1", () => {})).toEqual({ status: "error", message: "Live grading is unavailable right now." });
  });

  it("settles as an error when the stream breaks mid-way", async () => {
    const broken = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode('event: feedback\ndata: {"text":"Hi"}\n\n'));
          c.error(new Error("connection reset"));
        },
      }),
    );
    vi.stubGlobal("fetch", async () => broken);
    expect(await gradeItem("t", "a-1", () => {})).toMatchObject({ status: "error" });
  });

  it("settles as soon as the result arrives, without waiting for the stream to close", async () => {
    const result = { key: "a-1", live: true, latencyMs: 5, decision: { action: "record", verdict: "accept", feedback: "Hi" }, certainty: "high", basis: null, receipt: null };
    const open = new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(`event: done\ndata: ${JSON.stringify({ result })}\n\n`));
        },
      }),
    );
    vi.stubGlobal("fetch", async () => open);
    expect(await gradeItem("t", "a-1", () => {})).toEqual({ status: "done", result });
  });
});

describe("runJudge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports an expired page", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
    expect(await runJudge("t", [], () => {})).toBe("expired");
  });

  it("returns null when the network fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await runJudge("t", [], () => {})).toBeNull();
  });
});
