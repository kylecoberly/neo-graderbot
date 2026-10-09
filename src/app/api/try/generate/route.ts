import { flushTraces } from "@/lib/agent/mask";
import { fakeGenerator, fakeMode } from "@/lib/demo/fake";
import { generateBundle, makeGenerator, type GeneratorFn } from "@/lib/demo/generate";
import { checkQuestion } from "@/lib/demo/ownQuestion";
import { vocabularyOf } from "@/lib/demo/richness";
import { demoSecret, sign } from "@/lib/demo/token";
import { rejectCrossSite } from "@/lib/sameOrigin";
import { encodeEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const g = globalThis as { __generator?: GeneratorFn };

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { question?: unknown };
  if (typeof body.question !== "string") return Response.json({ error: "Write a question." }, { status: 400 });
  const checked = checkQuestion(body.question);
  if (!checked.ok) return Response.json({ error: checked.reason }, { status: 400 });
  const generator = fakeMode() ? fakeGenerator : (g.__generator ??= makeGenerator());

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
    },
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };
      let written = -1;
      try {
        const out = await generateBundle(checked.question, generator, Math.random, (n) => {
          if (n !== written) send("progress", { written: (written = n) });
        });
        if (out.kind === "unfit") send("unfit", { reason: out.reason });
        else if (out.kind === "error") throw new Error("wrong shape twice");
        else {
          const { bundle } = out;
          send("done", {
            token: sign({ kind: "custom", bundle }, demoSecret()),
            question: { prompt: bundle.question, reference: bundle.reference, vocabulary: vocabularyOf([bundle.reference, ...bundle.keyPoints]) },
            entries: bundle.responses.map((r, i) => ({ key: String(i), learner: null, answer: r.answer, kind: r.kind, intended: r.intended })),
          });
        }
      } catch (err) {
        console.error("demo generation failed:", err instanceof Error ? err.message : String(err));
        send("error", { message: "Couldn't write answers for that question. Try rephrasing it." });
      }
      await flushTraces();
      if (!closed) controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
