import { randomUUID } from "node:crypto";
import { flushTraces } from "@/lib/agent/mask";
import { grade } from "@/lib/agent/run";
import { storedResult } from "@/lib/demo/fallback";
import { resolveItem } from "@/lib/demo/resolve";
import { GRADE_TIMEOUT_MS, demoGraph, withTimeout } from "@/lib/demo/service";
import { readTicket, type RunReceipt } from "@/lib/demo/tickets";
import { demoSecret, sign } from "@/lib/demo/token";
import type { AgentResult } from "@/lib/demo/types";
import { rejectCrossSite } from "@/lib/sameOrigin";
import { encodeEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; key?: unknown };
  const ticket = readTicket(body.token);
  if (!ticket) return Response.json({ error: "expired" }, { status: 401 });
  const item = typeof body.key === "string" ? resolveItem(ticket, body.key) : null;
  if (!item) return Response.json({ error: "That answer is not on this page." }, { status: 400 });

  const encoder = new TextEncoder();
  // A reload mid-grade closes the stream; grading still finishes and is traced.
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
    },
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };
      const runId = randomUUID();
      const started = performance.now();
      try {
        const out = await withTimeout(
          grade(demoGraph(item.passages), { answerId: item.key, question: item.question, answer: item.answer }, {
            runId,
            metadata: { demo: ticket.kind, questionId: item.question.id, key: item.key },
            onFeedback: (text) => send("feedback", { text }),
          }),
          GRADE_TIMEOUT_MS,
        );
        const result: AgentResult = {
          key: item.key,
          live: true,
          latencyMs: Math.round(performance.now() - started),
          decision: out.decision,
          certainty: out.judgment?.certainty ?? null,
          basis: out.judgment?.basis ?? null,
          receipt: sign(
            {
              kind: "run",
              runId,
              key: item.key,
              verdict: out.decision.verdict,
              note: out.decision.feedback,
              certainty: out.judgment?.certainty ?? null,
              deferred: out.decision.action === "defer",
            } satisfies RunReceipt,
            demoSecret(),
          ),
        };
        send("done", { result });
      } catch (err) {
        // The visitor sees a stored grade either way; the log is how anyone learns why.
        console.error("demo grade failed:", err instanceof Error ? err.message : String(err));
        const stored = ticket.kind === "page" ? storedResult(item.key) : null;
        if (stored) send("done", { result: { key: item.key, live: false, latencyMs: null, receipt: null, ...stored } satisfies AgentResult });
        else send("error", { message: "Live grading is unavailable right now." });
      }
      await flushTraces();
      if (!closed) controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
